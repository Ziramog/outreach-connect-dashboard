import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'

const router = Router()

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

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
      const supabase = getSupabase()
      const { data: leads } = await supabase
        .from('leads')
        .select('id, nombre, telefono, outreach_status')
        .or(`telefono.ilike.*${digits},whatsapp.ilike.*${digits}`)
        .limit(1)

      const leadId = leads?.[0]?.id || null

      // Save inbound message to outreach_history
      await supabase.from('outreach_history').insert({
        lead_id: leadId,
        direction: 'inbound',
        message_id: msgId,
        content: text,
        sent_at: timestamp
      })

      // Update lead status to 'replied' if matched
      if (leadId) {
        await supabase
          .from('leads')
          .update({ outreach_status: 'replied' })
          .eq('id', leadId)
      }

      console.log(`[Webhook] Inbound from ${from}: "${text.substring(0, 50)}" → lead ${leadId || 'unknown'}`)
    }
  } catch (err: any) {
    console.error('[Webhook] Error:', err.message)
  }
})

export const webhookRouter = router
