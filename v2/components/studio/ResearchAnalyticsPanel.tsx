'use client'

// Research Studio — analytics panel
//
// Presentational only: every number arrives already computed by
// lib/studio/research-analytics.ts from runs that exist. When there are no runs
// this renders an empty state — never a zeroed-out chart that looks like data.

import Icon from '@/components/Icon'
import { computeAnalytics, formatDuration } from '@/lib/studio/research-analytics'
import type { ResearchRun } from '@/lib/studio/research-pipeline'

const DEPTH_LABELS: Record<string, string> = {
  quick: 'Hızlı',
  standard: 'Standart',
  deep: 'Derin'
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="pf-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
      {note && <p className="mt-0.5 text-[10px] text-muted">{note}</p>}
    </div>
  )
}

function BarRow({
  label,
  count,
  max,
  suffix
}: {
  label: string
  count: number
  max: number
  suffix?: string
}) {
  const width = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="min-w-0 truncate text-foreground/80">{label}</span>
        <span className="shrink-0 text-muted">
          {count}
          {suffix ? ` ${suffix}` : ''}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${width}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

export default function ResearchAnalyticsPanel({ runs }: { runs: ResearchRun[] }) {
  const stats = computeAnalytics(runs)

  if (stats.total === 0) {
    return (
      <div className="pf-card flex flex-col items-center gap-2 p-8 text-center">
        <Icon name="activity" className="h-6 w-6 text-muted" />
        <p className="text-sm font-medium text-foreground">Henüz kayıtlı araştırma yok</p>
        <p className="max-w-sm text-xs text-muted">
          Bu panel yalnızca gerçekten tamamlanmış veya başarısız olmuş araştırmalardan
          hesaplanır. Bir araştırma çalıştırdığınızda sayılar kendiliğinden dolacak.
        </p>
      </div>
    )
  }

  const maxModel = Math.max(...stats.modelUsage.map((row) => row.count), 1)
  const maxDepth = Math.max(...stats.depthUsage.map((row) => row.count), 1)
  const maxDay = Math.max(...stats.activity.map((day) => day.count), 1)
  const hasActivity = stats.activity.some((day) => day.count > 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi label="Toplam" value={String(stats.total)} note="kayıtlı araştırma" />
        <Kpi label="Başarılı" value={String(stats.complete)} note={`${stats.failed} başarısız`} />
        <Kpi
          label="Başarı oranı"
          value={stats.successRate === null ? '—' : `%${stats.successRate}`}
          note="tamamlanan / toplam"
        />
        <Kpi
          label="Ort. süre"
          value={formatDuration(stats.avgRunMs)}
          note="aşama zaman damgalarından"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="pf-card p-3">
          <h3 className="mb-2 text-xs font-semibold text-foreground">Model kullanımı</h3>
          {stats.modelUsage.length === 0 ? (
            <p className="text-[11px] text-muted">
              Model bilgisi kaydedilmemiş araştırmalar var.
            </p>
          ) : (
            <div className="space-y-2">
              {stats.modelUsage.map((row) => (
                <BarRow
                  key={row.key}
                  label={row.key}
                  count={row.count}
                  max={maxModel}
                  suffix="araştırma"
                />
              ))}
            </div>
          )}
        </div>

        <div className="pf-card p-3">
          <h3 className="mb-2 text-xs font-semibold text-foreground">Derinlik dağılımı</h3>
          {stats.depthUsage.length === 0 ? (
            <p className="text-[11px] text-muted">Derinlik bilgisi kaydedilmemiş.</p>
          ) : (
            <div className="space-y-2">
              {stats.depthUsage.map((row) => (
                <BarRow
                  key={row.depth}
                  label={DEPTH_LABELS[row.depth] ?? row.depth}
                  count={row.count}
                  max={maxDepth}
                  suffix="araştırma"
                />
              ))}
            </div>
          )}
          <p className="mt-3 text-[10px] text-muted">
            Gerçek web kaynağı bulunan araştırma: {stats.webRuns}
          </p>
        </div>
      </div>

      <div className="pf-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground">Son 14 gün</h3>
          <span className="text-[10px] text-muted">
            {stats.totalStages} aşama · {stats.failedStages} başarısız aşama
          </span>
        </div>
        {hasActivity ? (
          <div className="flex h-20 items-end gap-1">
            {stats.activity.map((day) => {
              const height = day.count === 0 ? 2 : Math.max(8, Math.round((day.count / maxDay) * 100))
              return (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-sm ${day.count > 0 ? 'bg-primary' : 'bg-surface-2'}`}
                    style={{ height: `${height}%` }}
                    title={`${day.date}: ${day.count}`}
                  />
                  <span className="text-[9px] text-muted">{day.date.slice(8)}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-[11px] text-muted">
            Son 14 günde kaydedilmiş araştırma yok.
          </p>
        )}
        <p className="mt-2 text-[10px] text-muted">
          Son çalışma: {stats.lastRunAt ? new Date(stats.lastRunAt).toLocaleString('tr-TR') : '—'}
        </p>
      </div>

      <p className="text-[10px] leading-relaxed text-muted">
        Tüm değerler kayıtlı araştırma kayıtlarından hesaplanır; örnek veri veya
        tahmini seri kullanılmaz.
      </p>
    </div>
  )
}