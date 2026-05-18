"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookRouter = void 0;
const express_1 = require("express");
const supabase_js_1 = require("@supabase/supabase-js");
const db_service_js_1 = require("../services/db.service.js");
const router = (0, express_1.Router)();
// YCloud webhook verification
router.get('/ycloud', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    // TODO: match with YCloud webhook verify token
    if (mode === 'subscribe' && token === process.env.YCLOUD_WEBHOOK_TOKEN) {
        res.send(String(challenge));
        return;
    }
    res.send('ERROR');
});
// YCloud incoming message webhook
router.post('/ycloud', async (req, res) => {
    try {
        // Acknowledge immediately
        res.send('OK');
        const messages = req.body?.entry?.[0]?.changes?.[0]?.value?.messages;
        if (!messages || !Array.isArray(messages))
            return;
        for (const msg of messages) {
            const from = msg.from;
            const text = msg.text?.body || '';
            const msgId = msg.id;
            const timestamp = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000).toISOString() : new Date().toISOString();
            if (!from || !text)
                continue;
            // Find lead by phone (normalize to digits)
            const digits = from.replace(/\D/g, '');
            const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
            const { data: leads } = await supabase
                .from('leads')
                .select('id, nombre, telefono, ciudad, outreach_status')
                .or(`telefono.ilike.*${digits},whatsapp.ilike.*${digits}`)
                .limit(1);
            const leadId = leads?.[0]?.id || null;
            // Save inbound message to outreach_history
            // Actual columns: lead_id, status (not direction), changed_at (not sent_at), ycloud_message_id
            await supabase.from('outreach_history').insert({
                lead_id: leadId,
                status: 'inbound',
                changed_at: timestamp,
                ycloud_message_id: msgId
            });
            // Update lead status to 'replied' if matched
            if (leadId) {
                await supabase
                    .from('leads')
                    .update({ outreach_status: 'replied' })
                    .eq('id', leadId);
                // Auto follow-up: queue next message if intro was already sent
                try {
                    const { data: leadData } = await supabase
                        .from('leads')
                        .select('outreach_sent_at, outreach_status, telefono')
                        .eq('id', leadId)
                        .single();
                    if (leadData?.outreach_sent_at) {
                        // Lead has received intro — auto queue followup_2
                        const settings = db_service_js_1.dbService.getSettings();
                        const followupText = settings.message_templates.followup_2
                            ?.replace('{name}', leads?.[0]?.nombre || 'Contacto')
                            ?.replace('{city}', leads?.[0]?.ciudad || '');
                        if (followupText) {
                            const phoneDigits = String(leadData.telefono).replace(/\D/g, '');
                            const fs = require('fs');
                            fs.writeFileSync('/home/hermes/data/baileys-connect/send-trigger.json', JSON.stringify({
                                phone: phoneDigits,
                                message: followupText,
                                auto: true
                            }));
                            console.log(`[Webhook] Auto follow-up queued for lead ${leadId}`);
                            // Log auto outbound to history (actual schema: status, changed_at, ycloud_message_id)
                            await supabase.from('outreach_history').insert({
                                lead_id: leadId,
                                status: 'outbound_auto',
                                changed_at: new Date().toISOString()
                            });
                        }
                    }
                }
                catch (e) {
                    console.error('[Webhook] Auto follow-up error:', e.message);
                }
            }
            console.log(`[Webhook] Inbound from ${from}: "${text.substring(0, 50)}" → lead ${leadId || 'unknown'}`);
        }
    }
    catch (err) {
        console.error('[Webhook] Error:', err.message);
    }
});
exports.webhookRouter = router;
//# sourceMappingURL=webhook.js.map