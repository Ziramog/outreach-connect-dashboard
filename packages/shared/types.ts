export type QRStatus = 'idle' | 'waiting' | 'scanned' | 'connected' | 'disconnected'
export type OutreachStatus = 'pending' | 'enriched' | 'outreach_sent' | 'replied' | 'qualified' | 'rejected'
export type LeadStatus = OutreachStatus

export interface LeadAction {
  action: string
  timestamp: string
  message_sent?: string
}

export interface Lead {
  id: string
  vertical: string
  nombre: string
  telefono: string
  whatsapp?: string
  email?: string
  direccion?: string
  zona?: string
  ciudad: string
  provincia: string
  fuente: string
  website?: string
  google_maps_url?: string
  productos_servicios?: string
  instagram?: string
  facebook?: string
  scraped_at: string
  enriched_at?: string
  outreach_status: OutreachStatus
  outreach_sent_at?: string
  outreach_response?: string
  actions_history: LeadAction[]
}

export interface RawLead {
  vertical: string
  nombre: string
  telefono: string
  whatsapp?: string
  email?: string
  direccion?: string
  zona?: string
  ciudad?: string
  provincia?: string
  fuente?: string
  website?: string
  google_maps_url?: string
}

export interface DaemonStatus {
  running: boolean
  pid?: number
  uptime?: number
  leads_processed_today: number
  next_run?: string
  last_run?: string
}

export interface Stats {
  sent_today: number
  sent_week: number
  pending: number
  hot_leads: number
  response_rate: number
  conversion_rate: number
  by_city: { city: string; count: number }[]
  by_status: { status: string; count: number }[]
  by_vertical?: { vertical: string; count: number }[]
}

export interface Settings {
  business_hours: {
    start: string
    end: string
    timezone: string
    days: number[]
  }
  cities: string[]
  target_verticals: string[]
  target_provincias: string[]
  message_templates: {
    intro: string
    followup_1: string
    followup_2: string
  }
  cooldown_minutes: number
  daily_limit: number
}

export interface ApiResponse<T> {
  data?: T
  error?: string
  ok?: boolean
  message?: string
}