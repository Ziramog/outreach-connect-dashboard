import { Router, Request, Response } from 'express'
import { baileysService } from '../services/baileys.service.js'

export const qrRouter = Router()

qrRouter.get('/status', (_req: Request, res: Response) => {
  const status = baileysService.getStatus()
  res.json(status)
})

qrRouter.get('/image', (_req: Request, res: Response) => {
  const buffer = baileysService.getQRPNGBuffer()
  if (!buffer) {
    return res.status(404).json({ error: 'No QR available' })
  }
  res.setHeader('Cache-Control', 'no-store, no-cache')
  res.setHeader('Content-Type', 'image/png')
  res.send(buffer)
})

qrRouter.post('/start', async (_req: Request, res: Response) => {
  try {
    await baileysService.startQRFlow()
    res.json({ ok: true, message: 'QR generation started' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

qrRouter.post('/disconnect', async (_req: Request, res: Response) => {
  try {
    await baileysService.disconnect()
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

qrRouter.post('/regenerate', async (_req: Request, res: Response) => {
  try {
    const fs = require('fs')
    const controlFile = '/home/hermes/data/baileys-connect/control.json'
    fs.writeFileSync(controlFile, JSON.stringify({ action: 'reconnect', at: new Date().toISOString() }))
    res.json({ ok: true, message: 'Reconnect signal sent to daemon' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

qrRouter.post('/send', async (req: Request, res: Response) => {
  try {
    const { phone, text } = req.body
    if (!phone || !text) {
      return res.status(400).json({ error: 'phone and text are required' })
    }
    await baileysService.sendMessage(phone, text)
    res.json({ ok: true, queued: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})