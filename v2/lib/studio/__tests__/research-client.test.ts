import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCapabilities, streamResearch, type ResearchStreamEvent } from '../research-client'

function streamResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
        controller.close()
      }
    }),
    { status, headers: { 'Content-Type': 'text/event-stream' } }
  )
}

function frame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fetchCapabilities', () => {
  it('returns null when the endpoint is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })))
    expect(await fetchCapabilities()).toBeNull()
  })

  it('parses the capability payload', async () => {
    const payload = {
      storage: 'local',
      supabase: { configured: false, reason: 'yok', missing: ['NEXT_PUBLIC_SUPABASE_URL'] },
      ai: { serverKeyProviders: [], note: '' },
      webSearch: { configured: false, provider: null, note: '' },
      runs: [],
      runsAvailable: false
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })))

    const caps = await fetchCapabilities()
    expect(caps?.storage).toBe('local')
    expect(caps?.supabase.configured).toBe(false)
  })
})

describe('streamResearch', () => {
  it('posts the research request and streams every event in order', async () => {
    const fetchMock = vi.fn(async () =>
      streamResponse([
        frame({ type: 'sources', sources: [], webConfigured: false, webProvider: null }),
        frame({ type: 'stage_start', stage: 'understand' }),
        // Deliberately split mid-frame: the parser must buffer across chunks.
        `data: ${JSON.stringify({ type: 'stage_delta', stage: 'understand', delta: 'Merh' })}\n`,
        `\n${frame({ type: 'stage_done', stage: 'understand', output: 'Merh' })}`,
        frame({ type: 'run_done', run: { id: 'res_1', status: 'complete' } })
      ])
    )
    vi.stubGlobal('fetch', fetchMock)

    const events: ResearchStreamEvent[] = []
    await streamResearch({
      topic: 'Konu',
      goal: 'Hedef',
      depth: 'standard',
      onEvent: (event) => events.push(event)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toMatchObject({
      topic: 'Konu',
      depth: 'standard',
      stream: true
    })

    expect(events.map((event) => event.type)).toEqual([
      'sources',
      'stage_start',
      'stage_delta',
      'stage_done',
      'run_done'
    ])
  })

  it('surfaces the server error message instead of a generic failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Supabase yapılandırılmamış.' }), { status: 503 })
      )
    )

    await expect(
      streamResearch({ topic: 'Konu', goal: '', depth: 'quick', onEvent: () => {} })
    ).rejects.toThrow('Supabase yapılandırılmamış.')
  })

  it('reports a stream that closed without run_done as incomplete', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse([frame({ type: 'stage_start', stage: 'plan' })])))

    await expect(
      streamResearch({ topic: 'Konu', goal: '', depth: 'quick', onEvent: () => {} })
    ).rejects.toThrow('tamamlanmadan kapandı')
  })

  it('does not throw when the caller aborts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse([])))

    const controller = new AbortController()
    controller.abort()

    await expect(
      streamResearch({
        topic: 'Konu',
        goal: '',
        depth: 'quick',
        signal: controller.signal,
        onEvent: () => {}
      })
    ).resolves.toBeUndefined()
  })
})