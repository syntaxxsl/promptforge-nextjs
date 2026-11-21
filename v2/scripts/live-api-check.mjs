#!/usr/bin/env node
/**
 * PromptForge V2 — live provider check.
 *
 * Runs real HTTP calls against each provider using keys from the environment.
 * A provider with no key is reported as SKIPPED, never as passing.
 *
 * Usage:
 *   node scripts/live-api-check.mjs
 *   node scripts/live-api-check.mjs --provider openai
 *   node scripts/live-api-check.mjs --timeout 20000
 *
 * Keys are read from env only and are never printed. Output shows at most the
 * first 4 characters of a key's presence marker, never the value.
 */

const PROVIDERS = [
  { id: 'openai', env: 'OPENAI_API_KEY', kind: 'openai_compat', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'anthropic', env: 'ANTHROPIC_API_KEY', kind: 'anthropic', base: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-5' },
  { id: 'gemini', env: 'GEMINI_API_KEY', kind: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash' },
  { id: 'groq', env: 'GROQ_API_KEY', kind: 'openai_compat', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { id: 'openrouter', env: 'OPENROUTER_API_KEY', kind: 'openai_compat', base: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { id: 'deepseek', env: 'DEEPSEEK_API_KEY', kind: 'openai_compat', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { id: 'mistral', env: 'MISTRAL_API_KEY', kind: 'openai_compat', base: 'https://api.mistral.ai/v1', model: 'mistral-small-latest' },
  { id: 'xai', env: 'XAI_API_KEY', kind: 'openai_compat', base: 'https://api.x.ai/v1', model: 'grok-4' }
]

const args = process.argv.slice(2)
const only = args.includes('--provider') ? args[args.indexOf('--provider') + 1] : null
const timeoutArg = args.includes('--timeout') ? Number(args[args.indexOf('--timeout') + 1]) : 15000
const TIMEOUT_MS = Number.isFinite(timeoutArg) && timeoutArg > 0 ? timeoutArg : 15000

const results = []

function headers(provider, key) {
  if (provider.kind === 'anthropic') {
    return { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }
  }
  if (provider.kind === 'gemini') {
    return { 'content-type': 'application/json', 'x-goog-api-key': key }
  }
  const h = { 'content-type': 'application/json', authorization: `Bearer ${key}` }
  if (provider.id === 'openrouter') {
    h['http-referer'] = process.env.OPENROUTER_APP_URL || 'https://promptforge.app'
    h['x-title'] = process.env.OPENROUTER_APP_TITLE || 'PromptForge'
  }
  return h
}

function chatUrl(provider, stream) {
  const base = provider.base.replace(/\/+$/, '')
  if (provider.kind === 'anthropic') return `${base}/messages`
  if (provider.kind === 'gemini') {
    return `${base}/models/${provider.model}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`
  }
  return `${base}/chat/completions`
}

function chatBody(provider, stream) {
  if (provider.kind === 'anthropic') {
    return { model: provider.model, max_tokens: 32, messages: [{ role: 'user', content: 'Say OK.' }], stream }
  }
  if (provider.kind === 'gemini') {
    return { contents: [{ role: 'user', parts: [{ text: 'Say OK.' }] }], generationConfig: { maxOutputTokens: 32 } }
  }
  return { model: provider.model, max_tokens: 32, messages: [{ role: 'user', content: 'Say OK.' }], stream }
}

function extractText(provider, json) {
  if (provider.kind === 'anthropic') return (json.content || []).map((c) => c.text || '').join('')
  if (provider.kind === 'gemini') {
    const parts = json.candidates?.[0]?.content?.parts || []
    return parts.map((p) => p.text || '').join('')
  }
  return json.choices?.[0]?.message?.content || ''
}

async function withTimeout(fn, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fn(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

async function check(provider, key) {
  const record = { provider: provider.id, models: 'SKIPPED', auth: 'SKIPPED', completion: 'SKIPPED', streaming: 'SKIPPED', badKey: 'SKIPPED', timeout: 'SKIPPED', notes: [] }

  // 1. Model list
  try {
    const res = await withTimeout(
      (signal) => fetch(`${provider.base.replace(/\/+$/, '')}/models`, { headers: headers(provider, key), signal }),
      TIMEOUT_MS
    )
    record.models = res.ok ? 'PASS' : `FAIL(${res.status})`
  } catch (e) {
    record.models = `FAIL(${e.name === 'AbortError' ? 'timeout' : 'network'})`
  }

  // 2. Auth + completion
  let text = ''
  try {
    const res = await withTimeout(
      (signal) =>
        fetch(chatUrl(provider, false), {
          method: 'POST',
          headers: headers(provider, key),
          body: JSON.stringify(chatBody(provider, false)),
          signal
        }),
      TIMEOUT_MS
    )
    if (res.ok) {
      const json = await res.json()
      text = extractText(provider, json)
      record.auth = 'PASS'
      record.completion = text ? 'PASS' : 'FAIL(empty)'
    } else {
      record.auth = `FAIL(${res.status})`
      record.completion = `FAIL(${res.status})`
    }
  } catch (e) {
    record.auth = `FAIL(${e.name === 'AbortError' ? 'timeout' : 'network'})`
    record.completion = 'FAIL'
  }

  // 3. Streaming
  try {
    const res = await withTimeout(
      (signal) =>
        fetch(chatUrl(provider, true), {
          method: 'POST',
          headers: headers(provider, key),
          body: JSON.stringify(chatBody(provider, true)),
          signal
        }),
      TIMEOUT_MS
    )
    if (res.ok && res.body) {
      const reader = res.body.getReader()
      let seen = 0
      const decoder = new TextDecoder()
      while (seen < 4096) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        seen += chunk.length
        if (chunk.includes('data:') || chunk.includes('"candidates"')) break
      }
      record.streaming = seen > 0 ? 'PASS' : 'FAIL(empty)'
    } else {
      record.streaming = `FAIL(${res.status})`
    }
  } catch (e) {
    record.streaming = `FAIL(${e.name === 'AbortError' ? 'timeout' : 'network'})`
  }

  // 4. Bad key must be rejected (401/403), not accepted
  try {
    const res = await withTimeout(
      (signal) =>
        fetch(chatUrl(provider, false), {
          method: 'POST',
          headers: headers(provider, 'invalid-key-for-test'),
          body: JSON.stringify(chatBody(provider, false)),
          signal
        }),
      TIMEOUT_MS
    )
    record.badKey = res.status === 401 || res.status === 403 ? 'PASS' : `FAIL(${res.status})`
  } catch (e) {
    record.badKey = `FAIL(${e.name === 'AbortError' ? 'timeout' : 'network'})`
  }

  // 5. Timeout / abort path
  try {
    const controller = new AbortController()
    controller.abort()
    await fetch(chatUrl(provider, false), {
      method: 'POST',
      headers: headers(provider, key),
      body: JSON.stringify(chatBody(provider, false)),
      signal: controller.signal
    })
    record.timeout = 'FAIL(no abort)'
  } catch (e) {
    record.timeout = e.name === 'AbortError' ? 'PASS' : `FAIL(${e.name})`
  }

  return record
}

async function main() {
  const selected = only ? PROVIDERS.filter((p) => p.id === only) : PROVIDERS
  if (selected.length === 0) {
    console.error(`Unknown provider: ${only}`)
    process.exit(2)
  }

  for (const provider of selected) {
    const key = process.env[provider.env]
    if (!key) {
      results.push({
        provider: provider.id,
        models: 'SKIPPED',
        auth: 'SKIPPED',
        completion: 'SKIPPED',
        streaming: 'SKIPPED',
        badKey: 'SKIPPED',
        timeout: 'SKIPPED',
        notes: [`${provider.env} yok`]
      })
      continue
    }
    process.stdout.write(`→ ${provider.id} ... `)
    const record = await check(provider, key)
    console.log('done')
    results.push(record)
  }

  console.log('\nProvider     models    auth      completion streaming badKey    timeout')
  console.log('─'.repeat(78))
  for (const r of results) {
    console.log(
      `${r.provider.padEnd(12)} ${String(r.models).padEnd(9)} ${String(r.auth).padEnd(9)} ${String(r.completion).padEnd(10)} ${String(r.streaming).padEnd(9)} ${String(r.badKey).padEnd(9)} ${r.timeout}`
    )
    if (r.notes?.length) console.log(`  note: ${r.notes.join(', ')}`)
  }

  const skipped = results.filter((r) => r.models === 'SKIPPED').length
  const failed = results.filter((r) => Object.entries(r).some(([k, v]) => k !== 'provider' && k !== 'notes' && String(v).startsWith('FAIL'))).length
  const passed = results.length - skipped - failed

  console.log('─'.repeat(78))
  console.log(`PASS: ${passed}   FAIL: ${failed}   SKIPPED: ${skipped}   (toplam ${results.length})`)
  if (skipped > 0) {
    console.log('\nSKIPPED = ilgili API anahtarı ortamda yok. Bu bir başarı değildir.')
    console.log('Anahtarları .env.local içine koyup tekrar çalıştırın; değerler asla yazdırılmaz.')
  }
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('Live check crashed:', e?.message || e)
  process.exit(1)
})
