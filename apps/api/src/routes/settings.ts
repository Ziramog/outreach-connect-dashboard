import { Router, Request, Response } from 'express'
import { dbService } from '../services/db.service.js'
import type { Settings } from '../../../../packages/shared/types'
import { writeFileSync } from 'fs'

const WARMUP_FILE = '/home/hermes/data/baileys-connect/warmup.json'

export const settingsRouter = Router()

settingsRouter.get('/', (_req: Request, res: Response) => {
  try {
    const settings = dbService.getSettings()
    res.json(settings)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

settingsRouter.put('/', (req: Request, res: Response) => {
  try {
    const partial = req.body as Partial<Settings>
    const updated = dbService.updateSettings(partial)

    // Write warmup config to shared file for daemon to read
    if (partial.warmup !== undefined) {
      writeFileSync(WARMUP_FILE, JSON.stringify({
        enabled: partial.warmup.enabled ?? false,
        start_limit: partial.warmup.start_limit ?? 5,
        duration_days: partial.warmup.duration_days ?? 3,
        daily_limit: partial.daily_limit ?? 100,
        updated_at: new Date().toISOString()
      }))
    }

    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})