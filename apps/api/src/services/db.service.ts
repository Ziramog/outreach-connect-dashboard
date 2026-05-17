// Polyfill WebSocket for Node.js < 22 (required for Supabase realtime)
const getWebSocket = () => { try { return require('ws') } catch { return undefined } }
const ws = getWebSocket()
const globalAny: any = global
if (ws && !globalAny.WebSocket) {
  globalAny.WebSocket = ws.WebSocket || ws
}

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from '../config.js'
import { v4 as uuidv4 } from 'uuid'
import type { Lead, RawLead, Stats } from '../../../../packages/shared/types'

// Mapping from Supabase column names to Lead interface
function mapRow(row: any): Lead {
  return {
    id: row.id,
    vertical: row.vertical || 'inmobiliarias',
    nombre: row.nombre || row.name || '',
    telefono: row.telefono || row.phone || '',
    whatsapp: row.whatsapp || null,
    email: row.email || null,
    direccion: row.direccion || row.direccion || null,
    zona: row.zona || null,
    ciudad: row.ciudad || row.city || 'Córdoba',
    provincia: row.provincia || row.provincia || 'Córdoba',
    fuente: row.fuente || row.fuente || 'google_maps',
    website: row.website || null,
    google_maps_url: row.google_maps_url || null,
    productos_servicios: row.productos_servicios || null,
    instagram: row.instagram || null,
    facebook: row.facebook || null,
    scraped_at: row.scraped_at || row.created_at || new Date().toISOString(),
    enriched_at: row.enriched_at || null,
    outreach_status: row.outreach_status || row.status || 'pending',
    outreach_sent_at: row.outreach_sent_at || null,
    outreach_response: row.outreach_response || null,
    actions_history: []
  }
}

class DbService {
  private supabase: SupabaseClient | null = null

  init() {
    if (!config.supabaseUrl || !config.supabaseServiceKey) {
      console.warn('[DbService] SUPABASE_URL or SUPABASE_SERVICE_KEY not set, using no-op mode')
      return
    }
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey)
    console.log('[DbService] Connected to Supabase:', config.supabaseUrl)
  }

  private getClient(): SupabaseClient {
    if (!this.supabase) throw new Error('Supabase not initialized')
    return this.supabase
  }

  async getLeads(filters: { status?: string; city?: string; vertical?: string; page?: number; limit?: number }) {
    const page = filters.page || 1
    const limit = filters.limit || 50
    const offset = (page - 1) * limit

    let query = this.getClient()
      .from('leads')
      .select('*', { count: 'exact' })

    if (filters.status) {
      query = query.eq('outreach_status', filters.status)
    }
    if (filters.city) {
      query = query.eq('ciudad', filters.city)
    }
    if (filters.vertical) {
      query = query.eq('vertical', filters.vertical)
    }

    const { data, error, count } = await query
      .order('scraped_at', { ascending: false })
      .range(offset, offset + limit - 1)
      .throwOnError()

    if (error) throw error

    return {
      leads: (data || []).map(mapRow),
      total: count || 0,
      page
    }
  }

  async getLeadById(id: string): Promise<Lead | null> {
    const { data, error } = await this.getClient()
      .from('leads')
      .select('*')
      .eq('id', id)
      .single()
      .throwOnError()

    if (error || !data) return null
    return mapRow(data)
  }

  async insertLead(lead: RawLead): Promise<Lead> {
    const id = uuidv4()
    const now = new Date().toISOString()

    const { data, error } = await this.getClient()
      .from('leads')
      .insert({
        id,
        vertical: lead.vertical || 'inmobiliarias',
        nombre: lead.nombre,
        telefono: lead.telefono,
        whatsapp: lead.whatsapp || null,
        email: lead.email || null,
        direccion: lead.direccion || null,
        zona: lead.zona || null,
        ciudad: lead.ciudad || 'Córdoba',
        provincia: lead.provincia || 'Córdoba',
        fuente: lead.fuente || 'google_maps',
        website: lead.website || null,
        google_maps_url: lead.google_maps_url || null,
        scraped_at: now,
        outreach_status: 'pending'
      })
      .select()
      .single()
      .throwOnError()

    if (error) throw error
    return mapRow(data)
  }

  async importLeads(leads: RawLead[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0
    let skipped = 0
    const now = new Date().toISOString()

    for (const lead of leads) {
      const { data: existing } = await this.getClient()
        .from('leads')
        .select('id')
        .eq('telefono', lead.telefono)
        .eq('vertical', lead.vertical || 'inmobiliarias')
        .maybeSingle()

      if (existing) {
        skipped++
        continue
      }

      const id = uuidv4()
      const { error } = await this.getClient()
        .from('leads')
        .insert({
          id,
          vertical: lead.vertical || 'inmobiliarias',
          nombre: lead.nombre,
          telefono: lead.telefono,
          whatsapp: lead.whatsapp || null,
          email: lead.email || null,
          direccion: lead.direccion || null,
          zona: lead.zona || null,
          ciudad: lead.ciudad || 'Córdoba',
          provincia: lead.provincia || 'Córdoba',
          fuente: lead.fuente || 'google_maps',
          website: lead.website || null,
          google_maps_url: lead.google_maps_url || null,
          scraped_at: now,
          outreach_status: 'pending'
        })

      if (error) {
        console.error('[DbService] Insert error:', error.message)
        skipped++
      } else {
        imported++
      }
    }

    return { imported, skipped }
  }

  async updateLeadStatus(id: string, status: string) {
    const update: any = { outreach_status: status }
    if (status === 'outreach_sent') {
      update.outreach_sent_at = new Date().toISOString()
    }

    const { data, error } = await this.getClient()
      .from('leads')
      .update(update)
      .eq('id', id)
      .select()
      .single()
      .throwOnError()

    if (error) throw error
    return mapRow(data)
  }

  async updateLead(id: string, updates: Partial<Lead>) {
    const { data, error } = await this.getClient()
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
      .throwOnError()

    if (error) throw error
    return mapRow(data)
  }

  async getStats(): Promise<Stats> {
    const client = this.getClient()
    const today = new Date().toISOString().split('T')[0]

    const { count: totalLeads } = await client
      .from('leads')
      .select('*', { count: 'exact', head: true })

    const { count: pending } = await client
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('outreach_status', 'pending')

    const { count: hotLeads } = await client
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('outreach_status', 'qualified')

    const { count: outreachSent } = await client
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('outreach_status', 'outreach_sent')

    const { count: replied } = await client
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('outreach_status', 'replied')

    const statusCounts: Record<string, number> = {}
    let statusPage = 0
    while (true) {
      const { data } = await client
        .from('leads')
        .select('outreach_status')
        .range(statusPage * 1000, (statusPage + 1) * 1000 - 1)
      if (!data || data.length === 0) break
      for (const row of data) {
        const s = row.outreach_status || 'pending'
        statusCounts[s] = (statusCounts[s] || 0) + 1
      }
      if (data.length < 1000) break
      statusPage++
    }
    const by_status = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

    const verticalCounts: Record<string, number> = {}
    let verticalPage = 0
    while (true) {
      const { data } = await client
        .from('leads')
        .select('vertical')
        .range(verticalPage * 1000, (verticalPage + 1) * 1000 - 1)
      if (!data || data.length === 0) break
      for (const row of data) {
        const v = row.vertical || 'inmobiliarias'
        verticalCounts[v] = (verticalCounts[v] || 0) + 1
      }
      if (data.length < 1000) break
      verticalPage++
    }
    const by_vertical = Object.entries(verticalCounts).map(([vertical, count]) => ({ vertical, count }))

    const ciudadCounts: Record<string, number> = {}
    let ciudadPage = 0
    while (true) {
      const { data } = await client
        .from('leads')
        .select('ciudad')
        .range(ciudadPage * 1000, (ciudadPage + 1) * 1000 - 1)
      if (!data || data.length === 0) break
      for (const row of data) {
        const c = row.ciudad || 'Desconocida'
        ciudadCounts[c] = (ciudadCounts[c] || 0) + 1
      }
      if (data.length < 1000) break
      ciudadPage++
    }
    const by_city = Object.entries(ciudadCounts).map(([city, count]) => ({ city, count }))

    const sentToday = outreachSent || 0
    const responseRate = outreachSent ? Math.round(((replied || 0) / outreachSent) * 100) : 0

    return {
      sent_today: sentToday,
      sent_week: sentToday,
      pending: pending || 0,
      hot_leads: hotLeads || 0,
      response_rate: responseRate,
      conversion_rate: responseRate,
      by_city,
      by_status,
      by_vertical
    }
  }

  async getDistinctCities(): Promise<string[]> {
    const { data, error } = await this.getClient()
      .from('leads')
      .select('ciudad')
      .not('ciudad', 'is', null)
      .not('ciudad', 'eq', '')

    if (error) throw error
    const cities = [...new Set((data || []).map((r: any) => r.ciudad).filter(Boolean))].sort()
    return cities
  }

  async getDistinctVerticals(): Promise<{ vertical: string; count: number }[]> {
    const counts: Record<string, number> = {}
    let page = 0
    while (true) {
      const { data, error } = await this.getClient()
        .from('leads')
        .select('vertical')
        .range(page * 1000, (page + 1) * 1000 - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      for (const row of data || []) {
        const v = row.vertical || 'inmobiliarias'
        if (v) counts[v] = (counts[v] || 0) + 1
      }
      if (data.length < 1000) break
      page++
    }
    return Object.entries(counts)
      .map(([vertical, count]) => ({ vertical, count }))
      .sort((a, b) => b.count - a.count)
  }

  getSettings() {
    return {
      business_hours: { start: '08:00', end: '17:00', timezone: 'America/Argentina/Cordoba', days: [1, 2, 3, 4, 5] },
      cities: [],
      target_verticals: [],
      target_provincias: [],
      message_templates: { intro: '', followup_1: '', followup_2: '' },
      cooldown_minutes: 30,
      daily_limit: 100
    }
  }

  updateSettings(partial: any) {
    return partial
  }
}

const dbService = new DbService()

export { dbService }