'use client'

import { useEffect, useState } from 'react'
import { StatsCard } from '@/components/StatsCard'
import type { Stats } from '@/lib/types'

type Range = 'today' | 'week' | 'month' | 'all'

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [range, setRange] = useState<Range>('week')

  useEffect(() => {
    // The API doesn't support range filtering yet — range buttons are visual
    // The stats already use date-filtered queries (sent_today, sent_week)
    fetch('/api/proxy/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {})
  }, [])

  if (!stats) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Estadísticas</h1>
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {([['today','Hoy'], ['week','Semana'], ['month','Mes'], ['all','Todos']] as [Range, string][]).map(([r, label]) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                range === r ? 'bg-green-500 text-zinc-950 font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatsCard title="Enviados hoy" value={stats.sent_today} />
        <StatsCard title="Enviados semana" value={stats.sent_week} />
        <StatsCard title="Pendientes" value={stats.pending} />
        <StatsCard title="Hot leads" value={stats.hot_leads} />
        <StatsCard title="Tasa respuesta" value={`${stats.response_rate}%`} />
        <StatsCard title="Tasa conversión" value={`${stats.conversion_rate}%`} />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="font-medium mb-4">Por estado</h3>
          {stats.by_status.length === 0 ? (
            <p className="text-zinc-500 text-sm">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {stats.by_status.map(s => {
                const total = stats.by_status.reduce((acc, x) => acc + x.count, 0)
                const pct = total > 0 ? Math.round((s.count / total) * 100) : 0
                return (
                  <div key={s.status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize">{s.status.replace('_', ' ')}</span>
                      <span className="text-zinc-400">{s.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="font-medium mb-4">Por vertical</h3>
          {!stats.by_vertical || stats.by_vertical.length === 0 ? (
            <p className="text-zinc-500 text-sm">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {(stats.by_vertical || []).slice(0, 10).map(v => {
                const max = Math.max(...(stats.by_vertical || []).map(x => x.count))
                return (
                  <div key={v.vertical}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-xs">{v.vertical}</span>
                      <span className="text-zinc-400">{v.count}</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${max > 0 ? (v.count / max) * 100 : 0}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="font-medium mb-4">Por ciudad</h3>
          {stats.by_city.length === 0 ? (
            <p className="text-zinc-500 text-sm">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {stats.by_city.slice(0, 10).map(c => {
                const max = Math.max(...stats.by_city.map(x => x.count))
                return (
                  <div key={c.city}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-xs">{c.city}</span>
                      <span className="text-zinc-400">{c.count}</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-400 rounded-full transition-all" style={{ width: `${max > 0 ? (c.count / max) * 100 : 0}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}