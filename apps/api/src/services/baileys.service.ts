/**
 * Baileys Service — reads WhatsApp connection state from shared status file
 *
 * The daemon (daemon.js) owns the WhatsApp connection via baileys-relay.js.
 * This service reads the shared status.json and qr.txt that daemon writes.
 * Dashboard API endpoints use this to show QR/connection status.
 */

import { existsSync } from 'fs'

type QRState = 'idle' | 'connecting' | 'waiting' | 'connected' | 'disconnected' | 'reconnecting'

const STATUS_FILE = '/home/hermes/data/baileys-connect/status.json'
const QR_PATH = '/home/hermes/data/baileys-connect/qr.txt'

interface StatusData {
  state: QRState
  phone: string | null
  qr_available: boolean
  updated_at?: string
}

class BaileysService {
  async init() {
    console.log('[Baileys] Service initialized — daemon owns connection')
  }

  async startQRFlow(): Promise<void> {
    console.log('[Baileys] startQRFlow called on API — daemon must be running')
    throw new Error('Start the daemon first: pm2 start outreach-daemon')
  }

  async reconnect(): Promise<void> {
    console.log('[Baileys] reconnect called on API — daemon must be running')
    throw new Error('Daemon owns the connection')
  }

  async disconnect(): Promise<void> {
    const fs = require('fs')
    const controlFile = '/home/hermes/data/baileys-connect/control.json'
    fs.writeFileSync(controlFile, JSON.stringify({ action: 'disconnect', at: new Date().toISOString() }))
    console.log('[Baileys] Disconnect signal sent to daemon')
  }

  getStatus() {
    try {
      if (!existsSync(STATUS_FILE)) {
        return { status: 'idle' as QRState, phone: null, qr_available: false }
      }
      const fs = require('fs')
      const raw = fs.readFileSync(STATUS_FILE, 'utf8')
      const data: StatusData = JSON.parse(raw)
      return {
        status: data.state || 'idle',
        phone: data.phone || null,
        qr_available: data.qr_available || false
      }
    } catch {
      return { status: 'idle' as QRState, phone: null, qr_available: false }
    }
  }

  getQRPNGBuffer(): Buffer | null {
    const fs = require('fs')
    try {
      if (!existsSync(QR_PATH)) return null
      const buf = fs.readFileSync(QR_PATH)
      // Raw PNG file
      if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
        return buf
      }
      // Base64 data URL
      const str = buf.toString('utf8').trim()
      if (str.startsWith('data:')) {
        return Buffer.from(str.split(',')[1], 'base64')
      }
    } catch {}
    return null
  }

  async sendMessage(phone: string, text: string): Promise<string> {
    const fs = require('fs')
    const triggerFile = '/home/hermes/data/baileys-connect/send-trigger.json'
    const payload = { phone, text, queued_at: new Date().toISOString() }
    fs.writeFileSync(triggerFile, JSON.stringify(payload))
    console.log('[Baileys] Message queued via send-trigger.json')
    return 'queued'
  }
}

const baileysService = new BaileysService()

export { baileysService }
export type { QRState }
