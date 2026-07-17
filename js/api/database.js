/**
 * EEPROM Humas Management System
 * Database (Participants) API Module
 */

import { APP_CONFIG } from '../config.js';
import { getSupabase } from '../auth.js';
import { MOCK_PARTICIPANTS } from '../mockData.js';
import { store } from '../store.js';

let db = null;
function getDB() { return db || (db = getSupabase()); }

export async function fetchParticipants(filters = {}) {
    if (APP_CONFIG.demoMode) {
        await delay(350);
        let data = [...MOCK_PARTICIPANTS];
        if (filters.type && filters.type !== 'all') data = data.filter(p => p.type === filters.type);
        if (filters.program_id) data = data.filter(p => p.program_id === filters.program_id);
        if (filters.search) {
            const s = filters.search.toLowerCase();
            data = data.filter(p =>
                p.full_name?.toLowerCase().includes(s) ||
                p.nim?.toLowerCase().includes(s) ||
                p.email?.toLowerCase().includes(s) ||
                p.phone?.includes(s)
            );
        }
        store.set({ participants: data });
        return { data, error: null, count: data.length };
    }
    
    let query = getDB().from('participants').select('*', { count: 'exact' });
    if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type);
    if (filters.program_id) query = query.eq('program_id', filters.program_id);
    if (filters.search) query = query.or(
        `full_name.ilike.%${filters.search}%,nim.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
    );
    
    const { data, error, count } = await query.order('full_name');
    if (!error) store.set({ participants: data });
    return { data, error, count };
}

export async function createParticipant(participantData) {
    if (APP_CONFIG.demoMode) {
        await delay(500);
        const newParticipant = {
            id: `par-${Date.now()}`,
            ...participantData,
            added_by: store.get('user')?.id,
            created_at: new Date().toISOString(),
        };
        store.set({ participants: [...store.get('participants'), newParticipant] });
        return { data: newParticipant, error: null };
    }
    
    const user = store.get('user');
    const { data, error } = await getDB()
        .from('participants')
        .insert({ ...participantData, added_by: user.id })
        .select().single();
    if (!error) await fetchParticipants();
    return { data, error };
}

export async function updateParticipant(id, updates) {
    if (APP_CONFIG.demoMode) {
        await delay(400);
        const participants = store.get('participants').map(p => p.id === id ? { ...p, ...updates } : p);
        store.set({ participants });
        return { data: participants.find(p => p.id === id), error: null };
    }
    const { data, error } = await getDB().from('participants').update(updates).eq('id', id).select().single();
    if (!error) await fetchParticipants();
    return { data, error };
}

export async function deleteParticipant(id) {
    if (APP_CONFIG.demoMode) {
        await delay(400);
        store.set({ participants: store.get('participants').filter(p => p.id !== id) });
        return { error: null };
    }
    const { error } = await getDB().from('participants').delete().eq('id', id);
    if (!error) await fetchParticipants();
    return { error };
}

export async function fetchParticipantStats() {
    const participants = store.get('participants');
    return {
        total: participants.length,
        mahasiswa_baru: participants.filter(p => p.type === 'mahasiswa_baru').length,
        alumni: participants.filter(p => p.type === 'alumni').length,
        pendaftar: participants.filter(p => p.type === 'pendaftar').length,
        contact_person: participants.filter(p => p.type === 'contact_person').length,
    };
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));
