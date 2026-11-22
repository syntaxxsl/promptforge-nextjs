'use client'

// Web Search — real search adapter, honest about configuration.
//
// The /api/web-search route performs a genuine HTTP call when BRAVE_API_KEY or
// TAVILY_API_KEY is present on the server. When it is not, the route answers 501
// and this UI shows "bağlı değil" instead of fabricating results.

import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import SaveOutputButton from '@/components/studio/SaveOutputButton'
import Markdown from '@/components/Markdown'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import { completeChat } from '@/lib/studio/chat-client'
import type { WebSearchResult } from '@/lib/ai/web-search'

interface SearchState {
  configured: boolean | null
  provider: string | null
  results: WebSearchResult[]
  error: string | null
  query: string
}

const INITIAL: SearchState = {
  configured: null,
  provider: null,
  results: [],
  error: null,
  query: ''
}

export default function WebSearchStudio({ userId }: { userId: string }) {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>(INITIAL)
  const [searching, setSearching] = useState(false)
  const [analysis, setAnalysis] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [model, setModel] = useState<ModelSelection>({})
  const [selected, setSelected] = useState<string[]>([])

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/web-search')
      .then((response) => response.json())
      .then((data: { configured?: boolean; provider?: string | null }) => {
        if (cancelled) return
        setState((prev) => ({
          ...prev,
          configured: Boolean(data.configured),
          provider: data.provider ?? null
        }))
      })
      .catch(() => {
        if (!cancelled) setState((prev) => ({ ...prev, configured: false }))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedResults = useMemo(
    () => state.results.filter((result) => selected.includes(result.url)),
    [state.results, selected]
  )

  async function search() {
    if (!query.trim()) return
    setSearching(true)
    setAnalysis('')
    setSelected([])
    try {
      const response = await fetch('/api/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), count: 8 })
      })
      const data = (await response.json()) as {
        configured?: boolean
        provider?: string | null
        results?: WebSearchResult[]
        error?: string
      }
      setState({
        configured: Boolean(data.configured),
        provider: data.provider ?? null,
        results: data.results ?? [],
        error: data.error ?? null,
        query: query.trim()
      })
    } catch {
      setState({
        configured: false,
        provider: null,
        results: [],
        error: 'Arama isteği gönderilemedi.',
        query: query.trim()
      })
    } finally {
      setSearching(false)
    }
  }

  async function analyze() {
    if (selectedResults.length === 0) return
    setAnalyzing(true)
    setAnalysis('')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const context = selectedResults
        .map(
          (result, index) =>
            `[Kaynak ${index + 1}] ${result.title}\nURL: ${result.url}\nÖzet: ${result.snippet}`
        )
        .join('\n\n')

      const result = await completeChat({
        messages: [
          {
            role: 'system',
            content:
              'Sen bir araştırma analistisin. Yalnızca verilen arama sonuçlarına dayanarak yazarsın. Kaynakları [Kaynak N] biçiminde gösterirsin. Sonuçlarda olmayan bilgi eklemezsin.'
          },
          {
            role: 'user',
            content: `Sorgu: ${state.query}\n\nArama sonuçları:\n${context}\n\nBu sonuçları karşılaştırarak bir özet yaz: ortak noktalar, farklılıklar, güvenilirlik değerlendirmesi ve sonuç. Markdown kullan.`
          }
        ],
        provider: model.provider,
        model: model.model,
        temperature: 0.3,
        maxTokens: 1800,
        signal: controller.signal
      })
      setAnalysis(result.text)
    } catch (err) {
      setAnalysis(`Analiz başarısız: ${(err as Error)?.message || 'bilinmeyen hata'}`)
    } finally {
      setAnalyzing(false)
      abortRef.current = null
    }
  }

  function toggle(url: string) {
    setSelected((prev) =>
      prev.includes(url) ? prev.filter((item) => item !== url) : [...prev, url]
    )
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-white">Web Search</h1>
          <p className="text-xs text-white/45">
            Gerçek arama sonuçları, kaynak karşılaştırması ve özet.
          </p>
        </div>
        <ModelPicker value={model} onChange={setModel} />
      </header>

      {state.configured === false && (
        <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-3 text-[11px] leading-relaxed text-amber-200/85">
          <p className="font-medium">Web arama sağlayıcısı bağlı değil.</p>
          <p className="mt-1 text-amber-200/70">
            Sunucu ortamına <code className="rounded bg-black/40 px-1">BRAVE_API_KEY</code> veya{' '}
            <code className="rounded bg-black/40 px-1">TAVILY_API_KEY</code> eklendiğinde arama
            gerçek sonuç döndürür. Bu sürümde sahte sonuç üretilmez.
          </p>
        </div>
      )}

      {state.configured === true && (
        <p className="text-[11px] text-emerald-300/70">
          Sağlayıcı bağlı: {state.provider}
        </p>
      )}

      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
          <Icon name="search" className="h-4 w-4 text-white/35" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') search()
            }}
            placeholder="Aramak istediğiniz konu…"
            className="w-full bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={search}
          disabled={searching || !query.trim()}
          className="rounded-xl bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-40"
        >
          {searching ? 'Aranıyor…' : 'Ara'}
        </button>
      </div>

      {state.error && (
        <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {state.error}
        </p>
      )}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        <div className="pf-scroll min-h-0 space-y-2 overflow-y-auto pr-1">
          {state.results.length === 0 && !searching && (
            <p className="rounded-lg border border-dashed border-white/10 p-4 text-xs text-white/40">
              {state.configured === false
                ? 'Sağlayıcı bağlanmadan sonuç listelenmez.'
                : 'Arama yapıldığında sonuçlar burada listelenir.'}
            </p>
          )}
          {state.results.map((result) => {
            const isSelected = selected.includes(result.url)
            return (
              <div
                key={result.url}
                className={`rounded-lg border p-2.5 transition ${
                  isSelected
                    ? 'border-indigo-400/40 bg-indigo-500/10'
                    : 'border-white/8 bg-white/[0.02] hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(result.url)}
                    className="mt-1 accent-indigo-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white/85">{result.title}</p>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-0.5 block truncate text-[10px] text-indigo-300 hover:underline"
                    >
                      {result.url}
                    </a>
                    <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-white/45">
                      {result.snippet}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex min-h-0 flex-col rounded-xl border border-white/8 bg-black/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">
              Analiz
            </p>
            <button
              type="button"
              onClick={analyze}
              disabled={analyzing || selectedResults.length === 0}
              className="rounded border border-white/10 px-2 py-1 text-[11px] text-white/60 transition hover:border-white/25 disabled:opacity-40"
            >
              {analyzing ? 'Analiz ediliyor…' : `Seçilenleri analiz et (${selectedResults.length})`}
            </button>
          </div>
          <div className="pf-scroll min-h-0 flex-1 overflow-y-auto">
            {analysis ? (
              <><Markdown content={analysis} /><div className="mt-2"><SaveOutputButton userId={userId} tool="Web arama analizi" title="Web arama analizi" content={analysis}/></div></>
            ) : (
              <p className="text-xs text-white/35">
                Sonuçlardan birkaçını seçip analiz ettirin; ortak noktalar ve farklılıklar
                çıkarılır.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
