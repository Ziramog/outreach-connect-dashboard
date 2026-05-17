import type { Lead, DaemonStatus, Stats, Settings, QRStatus, OutreachMessage } from '../../../packages/shared/types'

export type { Lead, DaemonStatus, Stats, Settings, QRStatus, OutreachMessage }

export interface ApiResponse<T> {
  data?: T
  error?: string
  ok?: boolean
  message?: string
}