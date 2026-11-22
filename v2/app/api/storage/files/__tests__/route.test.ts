import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetRateLimits } from '@/lib/ai/guards'

const { getUser, list, createSignedUrl, upload, remove } = vi.hoisted(() => ({
  getUser: vi.fn(),
  list: vi.fn(),
  createSignedUrl: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn()
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => ({
    auth: { getUser },
    storage: {
      from: () => ({ list, createSignedUrl, upload, remove })
    }
  })
}))

const { GET, POST, DELETE } = await import('../route')
const URL = 'http://localhost/api/storage/files'

function configureSupabase(configured = true) {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', configured ? 'https://project.supabase.co' : '')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', configured ? 'anon-key' : '')
}

function signedIn(userId = 'user-1') {
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null })
}

beforeEach(() => {
  resetRateLimits()
  getUser.mockReset()
  list.mockReset().mockResolvedValue({ data: [], error: null })
  createSignedUrl.mockReset().mockResolvedValue({ data: { signedUrl: 'https://signed.example/file' }, error: null })
  upload.mockReset().mockResolvedValue({ data: { path: 'user-1/file.txt' }, error: null })
  remove.mockReset().mockResolvedValue({ data: [], error: null })
  configureSupabase()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('/api/storage/files access control', () => {
  it('returns 503 when Supabase is not configured', async () => {
    configureSupabase(false)
    const response = (await GET())!
    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('supabase_not_configured')
  })

  it('rejects unauthenticated file listing', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    const response = (await GET())!
    expect(response.status).toBe(401)
    expect(list).not.toHaveBeenCalled()
  })

  it('returns private non-cacheable file metadata and signed links', async () => {
    signedIn()
    list.mockResolvedValue({
      data: [{ id: 'file-id', name: '123e4567-e89b-12d3-a456-426614174000-report.pdf', created_at: '2026-01-01T00:00:00Z', metadata: { size: 42, mimetype: 'application/pdf' } }],
      error: null
    })

    const response = (await GET())!
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(body.files).toHaveLength(1)
    expect(body.files[0]).toMatchObject({
      id: 'file-id',
      name: 'report.pdf',
      path: 'user-1/123e4567-e89b-12d3-a456-426614174000-report.pdf',
      size: 42,
      contentType: 'application/pdf',
      downloadUrl: 'https://signed.example/file'
    })
    expect(list).toHaveBeenCalledWith('user-1', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
  })
})

describe('POST /api/storage/files validation', () => {
  it('rejects anonymous uploads before parsing or storing a file', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    const request = new NextRequest(URL, { method: 'POST' })
    const response = (await POST(request))!

    expect(response.status).toBe(401)
    expect(upload).not.toHaveBeenCalled()
  })

  it('rejects unsupported MIME types', async () => {
    signedIn()
    const form = new FormData()
    form.set('file', new File(['content'], 'payload.exe', { type: 'application/x-msdownload' }))
    const request = new NextRequest(URL, { method: 'POST' })
    vi.spyOn(request, 'formData').mockResolvedValue(form)

    const response = (await POST(request))!
    expect(response.status).toBe(415)
    expect((await response.json()).code).toBe('unsupported_type')
    expect(upload).not.toHaveBeenCalled()
  })

  it('rejects files larger than the configured limit', async () => {
    signedIn()
    const request = new NextRequest(URL, {
      method: 'POST',
      headers: { 'content-length': String(4 * 1024 * 1024 + 16 * 1024 + 1) }
    })

    const response = (await POST(request))!
    expect(response.status).toBe(413)
    expect(upload).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/storage/files ownership', () => {
  it('rejects paths outside the current user folder', async () => {
    signedIn()
    const request = new NextRequest(`${URL}?path=user-2%2Fprivate.pdf`, { method: 'DELETE' })

    const response = (await DELETE(request))!
    expect(response.status).toBe(400)
    expect((await response.json()).code).toBe('invalid_path')
    expect(remove).not.toHaveBeenCalled()
  })

  it('rejects traversal paths', async () => {
    signedIn()
    const request = new NextRequest(`${URL}?path=user-1%2F..%2Fother%2Fsecret.pdf`, { method: 'DELETE' })

    const response = (await DELETE(request))!
    expect(response.status).toBe(400)
    expect(remove).not.toHaveBeenCalled()
  })

  it('removes only a path inside the authenticated user folder', async () => {
    signedIn()
    const request = new NextRequest(`${URL}?path=user-1%2Ffile.pdf`, { method: 'DELETE' })

    const response = (await DELETE(request))!
    expect(response.status).toBe(200)
    expect(remove).toHaveBeenCalledWith(['user-1/file.pdf'])
  })
})
