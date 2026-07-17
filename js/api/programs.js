/**
 * EEPROM Humas Management System
 * Programs API Module
 */

import { APP_CONFIG } from '../config.js';
import { getSupabase } from '../auth.js';
import { MOCK_PROGRAMS } from '../mockData.js';
import { store } from '../store.js';

let db = null;
function getDB() { return db || (db = getSupabase()); }

// ============================================================
// FETCH
// ============================================================

export async function fetchPrograms() {
    if (APP_CONFIG.demoMode) {
        await delay(400);
        const programs = MOCK_PROGRAMS;
        store.set({ programs });
        return { data: programs, error: null };
    }
    
    const { data, error } = await getDB()
        .from('v_program_summary')
        .select('*')
        .order('sort_order');
    
    if (!error) store.set({ programs: data });
    return { data, error };
}

export async function fetchProgramByCode(code) {
    if (APP_CONFIG.demoMode) {
        await delay(300);
        const program = MOCK_PROGRAMS.find(p => p.code.toLowerCase() === code.toLowerCase());
        return { data: program || null, error: program ? null : new Error('Not found') };
    }
    
    const { data, error } = await getDB()
        .from('v_program_summary')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();
    
    return { data, error };
}

export async function fetchProgramById(id) {
    if (APP_CONFIG.demoMode) {
        await delay(300);
        const program = MOCK_PROGRAMS.find(p => p.id === id);
        return { data: program || null, error: null };
    }
    
    const { data, error } = await getDB()
        .from('v_program_summary')
        .select('*')
        .eq('id', id)
        .single();
    
    return { data, error };
}

// ============================================================
// CREATE / UPDATE / DELETE
// ============================================================

export async function createProgram(programData) {
    if (APP_CONFIG.demoMode) {
        await delay(600);
        const newProgram = {
            id: `prog-${Date.now()}`,
            ...programData,
            progress: 0, total_tasks: 0, done_tasks: 0,
            total_documents: 0, total_events: 0,
            created_at: new Date().toISOString(),
        };
        const programs = [...store.get('programs'), newProgram];
        store.set({ programs });
        return { data: newProgram, error: null };
    }
    
    const user = store.get('user');
    const { data, error } = await getDB()
        .from('programs')
        .insert({ ...programData, created_by: user.id })
        .select()
        .single();
    
    if (!error) await fetchPrograms();
    return { data, error };
}

export async function updateProgram(id, updates) {
    if (APP_CONFIG.demoMode) {
        await delay(500);
        const programs = store.get('programs').map(p =>
            p.id === id ? { ...p, ...updates } : p
        );
        store.set({ programs });
        return { data: programs.find(p => p.id === id), error: null };
    }
    
    const { data, error } = await getDB()
        .from('programs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    
    if (!error) await fetchPrograms();
    return { data, error };
}

export async function deleteProgram(id) {
    if (APP_CONFIG.demoMode) {
        await delay(500);
        const programs = store.get('programs').filter(p => p.id !== id);
        store.set({ programs });
        return { error: null };
    }
    
    const { error } = await getDB().from('programs').delete().eq('id', id);
    if (!error) await fetchPrograms();
    return { error };
}

export async function updateProgramProgress(id, progress) {
    return updateProgram(id, { progress });
}

// ============================================================
// CHECKLIST
// ============================================================

export async function fetchProgramChecklist(programId) {
    if (APP_CONFIG.demoMode) {
        await delay(200);
        // Return mock checklist based on program
        const checklists = {
            'prog-004': [
                { id: 'ck-1', text: 'Buat poster publikasi', done: true },
                { id: 'ck-2', text: 'Setup form pendaftaran', done: true },
                { id: 'ck-3', text: 'Broadcast ke grup WA', done: false },
                { id: 'ck-4', text: 'Rekap pendaftar', done: false },
                { id: 'ck-5', text: 'Evaluasi rekrutmen', done: false },
            ],
        };
        return { data: checklists[programId] || [], error: null };
    }
    
    // Fetch from tasks with checklist type
    const { data, error } = await getDB()
        .from('tasks')
        .select('id, title as text, status')
        .eq('program_id', programId)
        .order('sort_order');
    
    const checklist = data?.map(t => ({ id: t.id, text: t.text, done: t.status === 'done' })) || [];
    return { data: checklist, error };
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));
