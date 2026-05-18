import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { dbService } from '../services/db.service.js'

const router = Router()

// YCloud webhook verification
router.get('/ycloud', (req: Request, res: Response) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  // TODO: match with YCloud webhook verify token
  if (mode === 'subscribe' && token === process.env.YCLOUD_WEBHOOK_TOKEN) {
    res.send(String(challenge))
    return
  }
  res.send('ERROR')
})

// YCloud incoming message webhook
router.post('/ycloud', async (req: Request, res: Response) => {
  try {
    // Acknowledge immediately
    res.send('OK')

    const messages = req.body?.entry?.[0]?.changes?.[0]?.value?.messages
    if (!messages || !Array.isArray(messages)) return

    for (const msg of messages) {
      const from = msg.from
      const text = msg.text?.body || ''
      const msgId = msg.id
      const timestamp = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000).toISOString() : new Date().toISOString()

      if (!from || !text) continue

      // Find lead by phone (normalize to digits)
      const digits = from.replace(/\D/g, '')
      const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
      const { data: leads } = await supabase
        .from('leads')
        .select('id, nombre, telefono, ciudad, outreach_status')
        .or(`telefono.ilike.*${digits},whatsapp.ilike.*${digits}`)
        .limit(1)

      const leadId = leads?.[0]?.id || null

      // Save inbound message to outreach_history
      // Actual columns: lead_id, status (not direction), changed_at (not sent_at), ycloud_message_id
      await supabase.from('outreach_history').insert({
        lead_id: leadId,
        status: 'inbound',
        changed_at: timestamp,
        ycloud_message_id: msgId
      })

      // Update lead status to 'replied' if matched
      if (leadId) {
        await supabase
          .from('leads')
          .update({ outreach_status: 'replied' })
          .eq('id', leadId)

        // Auto follow-up: queue next message if intro was already sent
        try {
          const { data: leadData } = await supabase
            .from('leads')
            .select('outreach_sent_at, outreach_status, telefono')
            .eq('id', leadId)
            .single()

          if (leadData?.outreach_sent_at) {
            // Lead has received intro — auto queue followup_2
            const settings = dbService.getSettings()
            const followupText = (settings.message_templates as any).followup_2
              ?.replace('{name}', leads?.[0]?.nombre || 'Contacto')
              ?.replace('{city}', leads?.[0]?.ciudad || '')

            if (followupText) {
              const phoneDigits = String(leadData.telefono).replace(/\D/g, '')
              const fs = require('fs')
              fs.writeFileSync('/home/hermes/data/baileys-connect/send-trigger.json', JSON.stringify({
                phone: phoneDigits,
                message: followupText,
                auto: true
              }))
              console.log(`[Webhook] Auto follow-up queued for lead ${leadId}`)

              // Log auto outbound to history (actual schema: status, changed_at, ycloud_message_id)
              await supabase.from('outreach_history').insert({
                lead_id: leadId,
                status: 'outbound_auto',
                changed_at: new Date().toISOString()
              })
            }
          }
        } catch (e: any) {
          console.error('[Webhook] Auto follow-up error:', e.message)
        }
      }

      console.log(`[Webhook] Inbound from ${from}: "${text.substring(0, 50)}" → lead ${leadId || 'unknown'}`)
    }
  } catch (err: any) {
    console.error('[Webhook] Error:', err.message)
  }
})

export const webhookRouter = router
