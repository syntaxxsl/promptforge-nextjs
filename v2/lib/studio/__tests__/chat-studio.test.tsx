import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

// The stream is mocked at the client boundary: this test is about the studio
// wiring (thread creation, message persistence, transcript rendering), not about
// the SSE parser, which has its own suite.
const { streamChatMock } = vi.hoisted(() => ({ streamChatMock: vi.fn() }))

vi.mock('@/lib/studio/chat-client', () => ({
  streamChat: (options: unknown) => streamChatMock(options)
}))

import ChatStudio from '@/components/studio/ChatStudio'

interface StreamOptions {
  messages: { role: string; content: string }[]
  signal?: AbortSignal
  onDelta: (delta: string) => void
  onDone: (meta: { provider?: string; model?: string }) => void
}

function mockModelsFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ models: [], providers: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
    )
  )
}

beforeEach(() => {
  window.localStorage.clear()
  streamChatMock.mockReset()
  mockModelsFetch()
})

describe('ChatStudio', () => {
  it('shows the empty state before any thread exists', async () => {
    render(<ChatStudio userId="u1" />)
    expect(await screen.findByText('AI Chat Studio')).toBeTruthy()
    expect(screen.getByText(/Henüz sohbet yok/i)).toBeTruthy()
  })

  it('sends a message, streams the answer and stores both in the thread', async () => {
    streamChatMock.mockImplementation(async (options: StreamOptions) => {
      options.onDelta('Mer')
      options.onDelta('haba')
      options.onDone({ provider: 'openai', model: 'gpt-4o-mini' })
    })

    render(<ChatStudio userId="u1" />)

    const textarea = await screen.findByPlaceholderText('Mesaj yazın…')
    fireEvent.change(textarea, { target: { value: 'selam' } })
    fireEvent.click(screen.getByLabelText('Gönder'))

    await waitFor(() => expect(screen.getByText('Merhaba')).toBeTruthy())
    expect(streamChatMock).toHaveBeenCalledTimes(1)

    const options = streamChatMock.mock.calls[0][0] as unknown as StreamOptions
    expect(options.messages.map((m) => `${m.role}:${m.content}`)).toEqual(['user:selam'])

    // The transcript survives a re-render from the store.
    const stored = JSON.parse(window.localStorage.getItem('pf-v2:1:u1:chat-threads') || '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].messages.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant'])
    expect(stored[0].messages[1].content).toBe('Merhaba')
  })

  it('keeps a cancelled answer as partial text instead of failing', async () => {
    streamChatMock.mockImplementation(async (options: StreamOptions) => {
      options.onDelta('yarım')
      // Simulate an aborted provider call: no onDone and no onError.
      expect(options.signal).toBeDefined()
    })

    render(<ChatStudio userId="u1" />)

    const textarea = await screen.findByPlaceholderText('Mesaj yazın…')
    fireEvent.change(textarea, { target: { value: 'uzun bir şey yaz' } })
    fireEvent.click(screen.getByLabelText('Gönder'))

    await waitFor(() => expect(screen.getByText('yarım')).toBeTruthy())
  })

  it('renames a thread through the in-page dialog', async () => {
    render(<ChatStudio userId="u1" />)

    fireEvent.click(await screen.findByRole('button', { name: /Yeni sohbet/i }))
    await waitFor(() => expect(screen.getAllByText('Yeni sohbet').length).toBeGreaterThan(1))

    fireEvent.click(screen.getByLabelText('Sohbeti yeniden adlandır'))

    const dialog = await screen.findByRole('dialog')
    const input = within(dialog).getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Araştırma' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }))

    await waitFor(() => expect(screen.getAllByText('Araştırma').length).toBeGreaterThan(0))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('refuses to send an empty message', async () => {
    render(<ChatStudio userId="u1" />)
    await screen.findByPlaceholderText('Mesaj yazın…')

    expect(screen.getByLabelText('Gönder')).toHaveProperty('disabled', true)
    expect(streamChatMock).not.toHaveBeenCalled()
  })
})