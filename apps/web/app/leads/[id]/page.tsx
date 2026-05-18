'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { Lead, OutreachMessage } from '@/lib/types'
import { StatusBadge } from '@/components/StatusBadge'

export default function LeadDetailPage() {
  const { id } = useParams()
  const [lead, setLead] = useState<Lead | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<OutreachMessage[]>([])

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/proxy/leads/${id}`).then(r => r.json()),
      fetch(`/api/proxy/leads/${id}/messages`).then(r => r.json()).catch(() => ({ messages: [] }))
    ]).then(([leadData, msgData]) => {
      setLead(leadData)
      setNotes(leadData.notes || '')
      setMessages(msgData.messages || [])
    }).finally(() => setLoading(false))
  }, [id])

  const handleAction = async (action: string) => {
    try {
      const data = await fetch(`/api/proxy/leads/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      }).then(r => r.json())
      if (data.lead) setLead(data.lead)
      // Refresh messages after action
      const msgData = await fetch(`/api/proxy/leads/${id}/messages`).then(r => r.json()).catch(() => ({ messages: [] }))
      setMessages(msgData.messages || [])
    } catch {}
  }

  const actions = [
    { key: 'send_intro', label: 'Enviar intro', color: 'bg-blue-500 text-white' },
    { key: 'send_followup', label: 'Enviar seguimiento', color: 'bg-yellow-500 text-zinc-950' },
    { key: 'mark_hot', label: 'Marcar hot', color: 'bg-red-500 text-white' },
    { key: 'discard', label: 'Descartar', color: 'bg-zinc-700 text-zinc-300' },
    { key: 'reset', label: 'Resetear', color: 'bg-zinc-800 text-zinc-300' }
  ]

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" /></div>
  }

  if (!lead) return <div className="text-zinc-500">Lead no encontrado</div>

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">{lead.nombre}</h1>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <span className="text-xs text-zinc-500 uppercase">Teléfono</span>
            <p className="font-medium">{lead.telefono}</p>
          </div>
          <div>
            <span className="text-xs text-zinc-500 uppercase">Ciudad</span>
            <p className="font-medium">{lead.ciudad}</p>
          </div>
          <div>
            <span className="text-xs text-zinc-500 uppercase">Estado</span>
            <div className="mt-1"><StatusBadge status={lead.outreach_status} /></div>
          </div>
          <div>
            <span className="text-xs text-zinc-500 uppercase">Vertical</span>
            <p className="font-medium">{lead.vertical}</p>
          </div>
          <div>
            <span className="text-xs text-zinc-500 uppercase">Creado</span>
            <p className="font-medium">{new Date(lead.scraped_at).toLocaleDateString('es-AR')}</p>
          </div>
          <div>
            <span className="text-xs text-zinc-500 uppercase">Enviado</span>
            <p className="font-medium">{lead.outreach_sent_at ? new Date(lead.outreach_sent_at).toLocaleDateString('es-AR') : 'Nunca'}</p>
          </div>
        </div>

        {(lead.email || lead.website) && (
          <div className="flex gap-4 mb-4">
            {lead.email && <a href={`mailto:${lead.email}`} className="text-sm text-green-400 hover:underline">{lead.email}</a>}
            {lead.website && <a href={lead.website} target="_blank" rel="noopener" className="text-sm text-green-400 hover:underline">{lead.website}</a>}
          </div>
        )}

        <div className="mb-4">
          <span className="text-xs text-zinc-500 uppercase">Notas</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 resize-none"
            rows={3}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {actions.map(a => (
            <button
              key={a.key}
              onClick={() => handleAction(a.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${a.color}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {messages.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
          <h3 className="font-medium mb-4">Actividad de mensajes</h3>
          <div className="space-y-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex items-center gap-3 ${msg.direction === 'inbound' ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className={`w-2 h-2 rounded-full ${
                  msg.direction === 'inbound' ? 'bg-blue-400' :
                  msg.direction === 'outbound_auto' ? 'bg-yellow-400' : 'bg-green-400'
                }`} />
                <div className="text-xs text-zinc-500">
                  {msg.direction === 'inbound' ? 'Recibido' : msg.direction === 'outbound_auto' ? 'Auto' : 'Enviado'}
                </div>
                <div className="text-xs text-zinc-600">
                  {new Date(msg.sent_at).toLocaleString('es-AR')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="font-medium mb-4">Historial de acciones</h3>
        {lead.actions_history.length === 0 ? (
          <p className="text-zinc-500 text-sm">Sin acciones</p>
        ) : (
          <div className="relative pl-4 border-l-2 border-zinc-800 space-y-4">
            {lead.actions_history.map((action, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-zinc-700" />
                <div>
                  <span className="font-medium text-sm">{action.action.replace('_', ' ')}</span>
                  <span className="text-xs text-zinc-500 ml-2">{new Date(action.timestamp).toLocaleString('es-AR')}</span>
                </div>
                {action.message_sent && (
                  <p className="text-xs text-zinc-400 mt-1 bg-zinc-800 rounded p-2">{action.message_sent}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}