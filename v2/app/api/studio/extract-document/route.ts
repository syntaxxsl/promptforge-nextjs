import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitKey } from '@/lib/ai/guards'
import * as mammoth from 'mammoth'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

export const runtime = 'nodejs'
export const maxDuration = 30
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_TEXT_CHARS = 500_000

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
    const limit = checkRateLimit(rateLimitKey(data.user.id, null), { limit: 12, windowMs: 60_000 })
    if (!limit.allowed) return NextResponse.json({ error: 'Çok sık dosya yükleniyor. Biraz sonra tekrar dene.' }, { status: 429 })
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Dosya seçilmedi.' }, { status: 400 })
    if (!file.size || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Dosya boş veya 10 MB sınırını aşıyor.' }, { status: 413 })
    const name = file.name.toLowerCase()
    const bytes = Buffer.from(await file.arrayBuffer())
    let text = ''
    let pages: number | undefined
    let format = ''
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      if (bytes.subarray(0, 5).toString() !== '%PDF-') return NextResponse.json({ error: 'Geçerli bir PDF dosyası değil.' }, { status: 400 })
      const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise
      pages = document.numPages
      if (pages > 150) return NextResponse.json({ error: 'PDF en fazla 150 sayfa olabilir.' }, { status: 413 })
      const output: string[] = []
      for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
        const page = await document.getPage(pageNumber)
        const content = await page.getTextContent()
        const line = content.items.map((item) => ('str' in item ? item.str : '')).filter(Boolean).join(' ')
        output.push('[Sayfa ' + pageNumber + ']\n' + line)
        if (output.join('\n').length > MAX_TEXT_CHARS) break
      }
      text = output.join('\n\n')
      format = 'PDF'
    } else if (name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      if (bytes.subarray(0, 2).toString() !== 'PK') return NextResponse.json({ error: 'Geçerli bir DOCX dosyası değil.' }, { status: 400 })
      const extracted = await mammoth.extractRawText({ buffer: bytes })
      text = extracted.value
      format = 'DOCX'
    } else if (/\.(txt|md|csv|json)$/.test(name) || ['text/plain', 'text/markdown', 'text/csv', 'application/json'].includes(file.type)) {
      text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
      format = name.split('.').pop()?.toUpperCase() || 'TEXT'
    } else {
      return NextResponse.json({ error: 'Desteklenen dosyalar: PDF, DOCX, TXT, MD, CSV ve JSON.' }, { status: 415 })
    }
    text = text.replace(/\u0000/g, '').trim().slice(0, MAX_TEXT_CHARS)
    if (!text) return NextResponse.json({ error: 'Belgeden okunabilir metin çıkarılamadı. PDF taranmış görüntülerden oluşuyor olabilir.' }, { status: 422 })
    return NextResponse.json({ text, pages, format, truncated: text.length >= MAX_TEXT_CHARS }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Belge çözümlenemedi. Dosyanın bozuk veya parola korumalı olmadığını kontrol et.' }, { status: 422 })
  }
}
