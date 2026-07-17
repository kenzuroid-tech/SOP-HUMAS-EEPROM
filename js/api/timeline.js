/**
 * EEPROM Humas Management System
 * Timeline API Module
 */

import { APP_CONFIG } from '../config.js';
import { getSupabase } from '../auth.js';
import { MOCK_TIMELINE } from '../mockData.js';
import { store } from '../store.js';

let db = null;
function getDB() { return db || (db = getSupabase()); }

export async function fetchTimeline(filters = {}) {
    if (APP_CONFIG.demoMode) {
        await delay(300);
        let events = [...MOCK_TIMELINE];
        if (filters.program_id) events = events.filter(e => e.program_id === filters.program_id);
        if (filters.start) events = events.filter(e => new Date(e.start_datetime) >= new Date(filters.start));
        if (filters.end) events = events.filter(e => new Date(e.start_datetime) <= new Date(filters.end));
        return { data: events, error: null };
    }
    
    let query = getDB()
        .from('timeline')
        .select('*, programs(name, code, color:cover_image_url), profiles!pic_id(full_name)');
    
    if (filters.program_id) query = query.eq('program_id', filters.program_id);
    if (filters.start) query = query.gte('start_datetime', filters.start);
    if (filters.end) query = query.lte('start_datetime', filters.end);
    
    const { data, error } = await query.order('start_datetime');
    return { data, error };
}

export async function createTimelineEvent(eventData) {
    if (APP_CONFIG.demoMode) {
        await delay(500);
        const newEvent = { id: `evt-${Date.now()}`, ...eventData, created_at: new Date().toISOString() };
        return { data: newEvent, error: null };
    }
    
    const user = store.get('user');
    const { data, error } = await getDB()
        .from('timeline')
        .insert({ ...eventData, created_by: user.id })
        .select().single();
    return { data, error };
}

export async function updateTimelineEvent(id, updates) {
    if (APP_CONFIG.demoMode) {
        await delay(400);
        return { data: { id, ...updates }, error: null };
    }
    const { data, error } = await getDB().from('timeline').update(updates).eq('id', id).select().single();
    return { data, error };
}

export async function deleteTimelineEvent(id) {
    if (APP_CONFIG.demoMode) {
        await delay(400);
        return { error: null };
    }
    const { error } = await getDB().from('timeline').delete().eq('id', id);
    return { error };
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));
