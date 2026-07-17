/**
 * EEPROM Humas Management System
 * Documents API Module
 */

import { APP_CONFIG } from '../config.js';
import { getSupabase } from '../auth.js';
import { MOCK_DOCUMENTS } from '../mockData.js';
import { store } from '../store.js';

let db = null;
function getDB() { return db || (db = getSupabase()); }

export async function fetchDocuments(filters = {}) {
    if (APP_CONFIG.demoMode) {
        await delay(350);
        let docs = [...MOCK_DOCUMENTS];
        if (filters.program_id) docs = docs.filter(d => d.program_id === filters.program_id);
        if (filters.category && filters.category !== 'all') docs = docs.filter(d => d.category === filters.category);
        if (filters.search) {
            const s = filters.search.toLowerCase();
            docs = docs.filter(d => d.title?.toLowerCase().includes(s) || d.description?.toLowerCase().includes(s));
        }
        store.set({ documents: docs });
        return { data: docs, error: null, count: docs.length };
    }
    
    let query = getDB().from('documents').select('*, profiles!uploaded_by(full_name)', { count: 'exact' });
    if (filters.program_id) query = query.eq('program_id', filters.program_id);
    if (filters.category && filters.category !== 'all') query = query.eq('category', filters.category);
    if (filters.search) query = query.ilike('title', `%${filters.search}%`);
    
    const { data, error, count } = await query.order('created_at', { ascending: false });
    if (!error) store.set({ documents: data });
    return { data, error, count };
}

export async function uploadDocument(file, metadata) {
    if (APP_CONFIG.demoMode) {
        await delay(1000);
        const fakeUrl = URL.createObjectURL(file);
        const newDoc = {
            id: `doc-${Date.now()}`,
            ...metadata,
            file_url: fakeUrl,
            thumbnail_url: file.type.startsWith('image/') ? fakeUrl : null,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            storage_path: `demo/${file.name}`,
            view_count: 0,
            uploaded_by: store.get('user')?.id,
            uploader_name: store.get('user')?.full_name,
            created_at: new Date().toISOString(),
        };
        store.set({ documents: [...store.get('documents'), newDoc] });
        return { data: newDoc, error: null };
    }
    
    const user = store.get('user');
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    
    const { error: uploadError } = await getDB().storage
        .from(APP_CONFIG.storage.documents)
        .upload(path, file);
    
    if (uploadError) return { data: null, error: uploadError };
    
    const { data: { publicUrl } } = getDB().storage
        .from(APP_CONFIG.storage.documents)
        .getPublicUrl(path);
    
    const { data, error } = await getDB().from('documents').insert({
        ...metadata,
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: path,
        uploaded_by: user.id,
    }).select().single();
    
    if (!error) await fetchDocuments();
    return { data, error };
}

export async function updateDocument(id, updates) {
    if (APP_CONFIG.demoMode) {
        await delay(400);
        const documents = store.get('documents').map(d => d.id === id ? { ...d, ...updates } : d);
        store.set({ documents });
        return { data: documents.find(d => d.id === id), error: null };
    }
    const { data, error } = await getDB().from('documents').update(updates).eq('id', id).select().single();
    if (!error) await fetchDocuments();
    return { data, error };
}

export async function deleteDocument(id) {
    if (APP_CONFIG.demoMode) {
        await delay(400);
        store.set({ documents: store.get('documents').filter(d => d.id !== id) });
        return { error: null };
    }
    
    const doc = store.get('documents').find(d => d.id === id);
    if (doc?.storage_path) {
        await getDB().storage.from(APP_CONFIG.storage.documents).remove([doc.storage_path]);
    }
    
    const { error } = await getDB().from('documents').delete().eq('id', id);
    if (!error) await fetchDocuments();
    return { error };
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));
