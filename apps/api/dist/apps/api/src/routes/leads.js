"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadsRouter = void 0;
const express_1 = require("express");
const db_service_js_1 = require("../services/db.service.js");
const baileys_service_js_1 = require("../services/baileys.service.js");
exports.leadsRouter = (0, express_1.Router)();
exports.leadsRouter.get('/', async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            city: req.query.city,
            vertical: req.query.vertical,
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 50
        };
        const result = await db_service_js_1.dbService.getLeads(filters);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.leadsRouter.get('/cities', async (req, res) => {
    try {
        const cities = await db_service_js_1.dbService.getDistinctCities();
        res.json({ cities });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.leadsRouter.get('/verticals', async (req, res) => {
    try {
        const verticals = await db_service_js_1.dbService.getDistinctVerticals();
        res.json({ verticals });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.leadsRouter.get('/:id', async (req, res) => {
    try {
        const lead = await db_service_js_1.dbService.getLeadById(req.params.id);
        if (!lead)
            return res.status(404).json({ error: 'Lead not found' });
        res.json(lead);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.leadsRouter.get('/:id/messages', async (req, res) => {
    try {
        const supabase = db_service_js_1.dbService.supabase;
        if (!supabase)
            return res.status(500).json({ error: 'DB not initialized' });
        // Actual columns: lead_id, status, changed_at, ycloud_message_id (no content/direction/sent_at)
        const { data: messages, error } = await supabase
            .from('outreach_history')
            .select('id, lead_id, status, changed_at, ycloud_message_id')
            .eq('lead_id', req.params.id)
            .order('changed_at', { ascending: true });
        if (error)
            throw error;
        // Map to OutreachMessage shape for frontend compatibility
        const mapped = (messages || []).map((m) => ({
            id: m.id,
            lead_id: m.lead_id,
            direction: m.status, // status holds 'inbound', 'outbound', 'outbound_auto'
            sent_at: m.changed_at,
            message_id: m.ycloud_message_id || undefined,
            content: '' // actual message content not stored in this table
        }));
        res.json({ messages: mapped });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.leadsRouter.post('/:id/action', async (req, res) => {
    try {
        const { action } = req.body;
        const lead = await db_service_js_1.dbService.getLeadById(req.params.id);
        if (!lead)
            return res.status(404).json({ error: 'Lead not found' });
        const validActions = ['send_intro', 'send_followup', 'mark_hot', 'discard', 'reset', 'enrich'];
        if (!validActions.includes(action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }
        let messageSent;
        if (action === 'send_intro' || action === 'send_followup') {
            const settings = db_service_js_1.dbService.getSettings();
            const templateKey = action === 'send_intro' ? 'intro' : 'followup_2';
            const text = settings.message_templates[templateKey]
                .replace('{name}', lead.nombre)
                .replace('{city}', lead.ciudad)
                .replace('{vertical}', lead.vertical)
                .replace('{provincia}', lead.provincia)
                .replace('{website}', lead.website || '')
                .replace('{productos}', lead.productos_servicios || '')
                .replace('{email}', lead.email || '');
            const phoneNormalized = String(lead.telefono).replace(/\D/g, '');
            await baileys_service_js_1.baileysService.sendMessage(phoneNormalized, text);
            messageSent = text;
            // Log outbound message to outreach_history
            try {
                const supabase = db_service_js_1.dbService.supabase;
                if (supabase) {
                    // Actual outreach_history columns: lead_id, status, changed_at, ycloud_message_id
                    const { error } = await supabase.from('outreach_history').insert({
                        lead_id: req.params.id,
                        status: 'outbound',
                        changed_at: new Date().toISOString()
                    });
                    if (error)
                        console.error('[leads] outreach_history insert error:', error.message);
                }
            }
            catch (e) {
                console.error('[leads] outreach_history write error:', e.message);
            }
        }
        if (action === 'send_intro') {
            await db_service_js_1.dbService.updateLeadStatus(req.params.id, 'outreach_sent');
        }
        else if (action === 'send_followup') {
            await db_service_js_1.dbService.updateLeadStatus(req.params.id, 'outreach_sent');
        }
        else if (action === 'mark_hot') {
            await db_service_js_1.dbService.updateLeadStatus(req.params.id, 'qualified');
        }
        else if (action === 'discard') {
            await db_service_js_1.dbService.updateLeadStatus(req.params.id, 'rejected');
        }
        else if (action === 'reset') {
            await db_service_js_1.dbService.updateLeadStatus(req.params.id, 'pending');
        }
        const updated = await db_service_js_1.dbService.getLeadById(req.params.id);
        res.json({ ok: true, lead: updated, message_sent: messageSent });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.leadsRouter.post('/import', async (req, res) => {
    try {
        const { leads } = req.body;
        if (!Array.isArray(leads)) {
            return res.status(400).json({ error: 'leads must be an array' });
        }
        const result = await db_service_js_1.dbService.importLeads(leads);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
//# sourceMappingURL=leads.js.map