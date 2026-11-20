'use client'

import { supabase } from './supabase'

export type AIMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AIRequest = {
  prompt?: string
  messages?: AIMessage[]
  image?: string
  provider?: string
  model?: string
}

export type AIResult = {
  text: string
  provider: string
  model: string
  remaining: number | null
  source: string
}

export async function askAIResult(input: AIRequest): Promise<AIResult> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (!token) {
    throw new Error('Oturum bulunamadı. Tekrar giriş yapmalısın.')
  }

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })

  const result = await response.json().catch(() => null)

  if (!response.ok || !result?.text) {
    throw new Error(
      result?.error || 'Yapay zekâ isteği tamamlanamadı. Lütfen tekrar dene.'
    )
  }

  return {
    text: String(result.text),
    provider: String(result.provider || ''),
    model: String(result.model || ''),
    remaining:
      typeof result.remaining === 'number' ? result.remaining : null,
    source: String(result.source || ''),
  }
}

export async function askAI(input: AIRequest): Promise<string> {
  const result = await askAIResult(input)
  return result.text
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Görsel okunamadı.'))

    reader.readAsDataURL(file)
  })
}
