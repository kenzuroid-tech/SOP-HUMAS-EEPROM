/**
 * EEPROM Humas Management System
 * Templates API Module
 */

import { APP_CONFIG } from '../config.js';
import { getSupabase } from '../auth.js';
import { MOCK_TEMPLATES } from '../mockData.js';
import { store } from '../store.js';

let db = null;
function getDB() { return db || (db = getSupabase()); }

export async function fetchTemplates(filters = {}) {
    if (APP_CONFIG.demoMode) {
        await delay(300);
        let templates = [...MOCK_TEMPLATES];
        if (filters.type && filters.type !== 'all') templates = templates.filter(t => t.type === filters.type);
        if (filters.search) {
            const s = filters.search.toLowerCase();
            templates = templates.filter(t => t.title?.toLowerCase().includes(s) || t.content?.toLowerCase().includes(s));
        }
        store.set({ templates });
        return { data: templates, error: null };
    }
    
    let query = getDB().from('templates').select('*');
    if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type);
    if (filters.search) query = query.ilike('title', `%${filters.search}%`);
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) console.error('fetchTemplates error:', error);
    if (!error) store.set({ templates: data });
    return { data, error };
}

export async function createTemplate(templateData) {
    if (APP_CONFIG.demoMode) {
        await delay(500);
        const newTemplate = {
            id: `tpl-${Date.now()}`,
            ...templateData,
            use_count: 0,
            created_at: new Date().toISOString(),
        };
        store.set({ templates: [...store.get('templates'), newTemplate] });
        return { data: newTemplate, error: null };
    }
    
    const user = store.get('user');
    const { data, error } = await getDB()
        .from('templates')
        .insert({ ...templateData, created_by: user.id })
        .select().single();
    if (!error) await fetchTemplates();
    return { data, error };
}

export async function updateTemplate(id, updates) {
    if (APP_CONFIG.demoMode) {
        await delay(400);
        const templates = store.get('templates').map(t => t.id === id ? { ...t, ...updates } : t);
        store.set({ templates });
        return { data: templates.find(t => t.id === id), error: null };
    }
    const { data, error } = await getDB().from('templates').update(updates).eq('id', id).select().single();
    if (!error) await fetchTemplates();
    return { data, error };
}

export async function deleteTemplate(id) {
    if (APP_CONFIG.demoMode) {
        await delay(400);
        store.set({ templates: store.get('templates').filter(t => t.id !== id) });
        return { error: null };
    }
    const { error } = await getDB().from('templates').delete().eq('id', id);
    if (!error) await fetchTemplates();
    return { error };
}

export async function incrementUseCount(id) {
    if (APP_CONFIG.demoMode) {
        const templates = store.get('templates').map(t => t.id === id ? { ...t, use_count: (t.use_count || 0) + 1 } : t);
        store.set({ templates });
        return { error: null };
    }
    const template = store.get('templates').find(t => t.id === id);
    if (template) {
        await getDB().from('templates').update({ use_count: (template.use_count || 0) + 1 }).eq('id', id);
    }
    return { error: null };
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));
