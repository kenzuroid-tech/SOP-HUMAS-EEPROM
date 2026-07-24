/**
 * EEPROM Humas Management System
 * Tasks API Module
 */

import { APP_CONFIG } from '../config.js';
import { getSupabase } from '../auth.js';
import { MOCK_TASKS, MOCK_MEMBERS } from '../mockData.js';
import { store } from '../store.js';

let db = null;
function getDB() { return db || (db = getSupabase()); }

// ============================================================
// ACTIVITY LOG
// ============================================================

/**
 * Catat aktivitas ke store (demo) atau Supabase (real)
 * @param {string} action - 'create'|'update'|'delete'|'status_change'|'upload'|'transfer'
 * @param {string} resourceType - 'task'|'program'|'document'
 * @param {string} resourceName - Nama resource
 * @param {Object} [meta] - Data tambahan
 */
export async function logActivity(action, resourceType, resourceName, meta = {}) {
    const user = store.get('user');
    if (!user) return;

    const log = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        user_id: user.id,
        user_name: user.nickname || user.full_name?.split(' ')[0] || 'User',
        user_full_name: user.full_name,
        action,
        resource_type: resourceType,
        resource_name: resourceName,
        meta,
        created_at: new Date().toISOString(),
    };

    if (APP_CONFIG.demoMode) {
        // Simpan ke store (prepend supaya yang terbaru di atas)
        const existing = store.get('activityLogs') || [];
        // Batasi 50 log terakhir
        store.set({ activityLogs: [log, ...existing].slice(0, 50) });
        return;
    }

    // Real mode: insert ke Supabase
    try {
        await getDB()
            .from('activity_logs')
            .insert({
                user_id: user.id,
                action,
                resource_type: resourceType,
                resource_name: resourceName,
                meta,
            });
    } catch (err) {
        console.warn('logActivity error:', err);
    }
}

/**
 * Ambil daftar aktivitas terbaru
 * @param {number} limit
 */
export async function fetchActivityLogs(limit = 15) {
    if (APP_CONFIG.demoMode) {
        await delay(200);
        const logs = store.get('activityLogs') || [];
        return { data: logs.slice(0, limit), error: null };
    }

    const { data, error } = await getDB()
        .from('activity_logs')
        .select('*, profiles(full_name, nickname, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (!error && data) {
        // Normalisasi: ambil nama dari relasi profiles
        const normalized = data.map(log => ({
            ...log,
            user_name: log.profiles?.nickname || log.profiles?.full_name?.split(' ')[0] || 'User',
            user_full_name: log.profiles?.full_name || 'User',
        }));
        return { data: normalized, error: null };
    }

    return { data: data || [], error };
}

// ============================================================
// NOTIFICATIONS
// ============================================================

/**
 * Fetch notifikasi dari Supabase untuk user yang sedang login
 * dan populate ke store agar header bisa menampilkannya
 */
export async function fetchNotifications(limit = 20) {
    const user = store.get('user');
    if (!user) return { data: [], error: null };
    
    if (APP_CONFIG.demoMode) {
        await delay(200);
        const notifications = store.get('notifications') || [];
        // Filter hanya notif untuk user ini
        const myNotifs = notifications.filter(n => !n.user_id || n.user_id === user.id);
        return { data: myNotifs, error: null };
    }
    
    try {
        const { data, error } = await getDB()
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (!error && data) {
            // Merge dengan notifikasi lokal yang mungkin ada
            const localNotifs = (store.get('notifications') || []).filter(n => 
                !n.user_id || n.user_id === user.id
            );
            
            // Gabungkan: DB notifs + lokal yang belum ada di DB (berdasarkan id)
            const dbIds = new Set(data.map(n => n.id));
            const uniqueLocal = localNotifs.filter(n => !dbIds.has(n.id));
            const merged = [...data, ...uniqueLocal].sort(
                (a, b) => new Date(b.created_at) - new Date(a.created_at)
            );
            
            const unread = merged.filter(n => !n.is_read).length;
            store.set({ 
                notifications: merged, 
                unreadNotifications: unread 
            });
            
            return { data: merged, error: null };
        }
        
        return { data: data || [], error };
    } catch (err) {
        console.warn('fetchNotifications error:', err);
        // Fallback ke store lokal
        const notifications = (store.get('notifications') || []).filter(n => 
            !n.user_id || n.user_id === user.id
        );
        return { data: notifications, error: null };
    }
}

// ============================================================
// FETCH
// ============================================================

export async function fetchTasks(filters = {}) {
    if (APP_CONFIG.demoMode) {
        await delay(400);
        let tasks = [...MOCK_TASKS];
        
        if (filters.program_id) tasks = tasks.filter(t => t.program_id === filters.program_id);
        if (filters.status && filters.status !== 'all') tasks = tasks.filter(t => t.status === filters.status);
        if (filters.priority && filters.priority !== 'all') tasks = tasks.filter(t => t.priority === filters.priority);
        if (filters.assigned_to) tasks = tasks.filter(t => t.assigned_to === filters.assigned_to);
        if (filters.search) {
            const s = filters.search.toLowerCase();
            tasks = tasks.filter(t => t.title?.toLowerCase().includes(s) || t.description?.toLowerCase().includes(s));
        }
        
        store.set({ tasks });
        return { data: tasks, error: null, count: tasks.length };
    }
    
    let query = getDB()
        .from('v_tasks')
        .select('*', { count: 'exact' });
    
    if (filters.program_id) query = query.eq('program_id', filters.program_id);
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
    if (filters.priority && filters.priority !== 'all') query = query.eq('priority', filters.priority);
    if (filters.search) query = query.ilike('title', `%${filters.search}%`);
    
    const { data, error, count } = await query.order('deadline', { ascending: true, nullsLast: true });
    
    if (!error) store.set({ tasks: data });
    return { data, error, count };
}

export async function fetchTaskById(id) {
    if (APP_CONFIG.demoMode) {
        await delay(200);
        const task = MOCK_TASKS.find(t => t.id === id);
        return { data: task || null, error: null };
    }
    
    const { data, error } = await getDB()
        .from('v_tasks')
        .select('*')
        .eq('id', id)
        .single();
    
    return { data, error };
}

// ============================================================
// CREATE / UPDATE / DELETE
// ============================================================

export async function createTask(taskData) {
    if (APP_CONFIG.demoMode) {
        await delay(600);
        const members = MOCK_MEMBERS;
        const assignee = members.find(m => m.id === taskData.assigned_to);
        const programs = store.get('programs');
        const program = programs.find(p => p.id === taskData.program_id);
        
        const newTask = {
            id: `task-${Date.now()}`,
            ...taskData,
            assignee_name: assignee?.full_name || null,
            assignee_nickname: assignee?.nickname || null,
            program_name: program?.name || null,
            program_code: program?.code || null,
            created_at: new Date().toISOString(),
            progress: 0,
        };
        
        const tasks = [...store.get('tasks'), newTask];
        store.set({ tasks });
        await logActivity('create', 'task', newTask.title);
        return { data: newTask, error: null };
    }
    
    const user = store.get('user');
    const { data, error } = await getDB()
        .from('tasks')
        .insert({ ...taskData, created_by: user.id })
        .select()
        .single();
    
    if (!error) {
        await fetchTasks();
        await logActivity('create', 'task', data.title);
    }
    return { data, error };
}

export async function updateTask(id, updates) {
    if (APP_CONFIG.demoMode) {
        await delay(400);
        const tasks = store.get('tasks').map(t =>
            t.id === id ? { ...t, ...updates } : t
        );
        store.set({ tasks });
        const updated = tasks.find(t => t.id === id);
        // Hanya log jika bukan update internal (transfer/assignment)
        if (!updates._silent) {
            await logActivity('update', 'task', updated?.title || id);
        }
        return { data: updated, error: null };
    }
    
    const { _silent, ...cleanUpdates } = updates;
    const { data, error } = await getDB()
        .from('tasks')
        .update(cleanUpdates)
        .eq('id', id)
        .select()
        .single();
    
    if (!error) {
        await fetchTasks();
        if (!_silent) {
            await logActivity('update', 'task', data?.title || id);
        }
    }
    return { data, error };
}

export async function deleteTask(id) {
    if (APP_CONFIG.demoMode) {
        await delay(400);
        const allTasks = store.get('tasks');
        const target = allTasks.find(t => t.id === id);
        const tasks = allTasks.filter(t => t.id !== id);
        store.set({ tasks });
        await logActivity('delete', 'task', target?.title || id);
        return { error: null };
    }
    
    // Ambil judul dulu sebelum hapus
    const { data: target } = await getDB().from('tasks').select('title').eq('id', id).single();
    const { error } = await getDB().from('tasks').delete().eq('id', id);
    if (!error) {
        await fetchTasks();
        await logActivity('delete', 'task', target?.title || id);
    }
    return { error };
}

export async function updateTaskStatus(id, status) {
    const progress = status === 'done' ? 100 : status === 'todo' ? 0 : undefined;
    const updates = { status, _silent: true }; // skip generic update log
    if (progress !== undefined) updates.progress = progress;
    
    const result = await updateTask(id, updates);
    
    // Log status change secara spesifik
    if (!result.error) {
        const task = store.get('tasks').find(t => t.id === id);
        await logActivity('status_change', 'task', task?.title || id, { status });
    }
    return result;
}

export async function updateTaskProgress(id, progress) {
    const status = progress === 100 ? 'done' : progress > 0 ? 'in_progress' : 'todo';
    return updateTask(id, { progress, status });
}

// ============================================================
// TASK PROGRESS HISTORY
// ============================================================

export async function fetchTaskHistory(taskId) {
    if (APP_CONFIG.demoMode) {
        await delay(200);
        return { data: [], error: null };
    }
    
    const { data, error } = await getDB()
        .from('task_progress')
        .select('*, profiles(full_name, avatar_url)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
    
    return { data, error };
}

// ============================================================
// STATS
// ============================================================

export async function fetchTaskStats() {
    const tasks = store.get('tasks');
    if (tasks.length > 0) {
        return computeStats(tasks);
    }
    
    const { data } = await fetchTasks();
    return computeStats(data || []);
}

function computeStats(tasks) {
    return {
        total: tasks.length,
        todo: tasks.filter(t => t.status === 'todo').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        review: tasks.filter(t => t.status === 'review').length,
        done: tasks.filter(t => t.status === 'done').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length,
        overdue: tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && !['done', 'cancelled'].includes(t.status)).length,
        completion_rate: tasks.length ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0,
    };
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ============================================================
// TRANSFER REQUESTS
// ============================================================

export async function submitTransferRequest(taskId, ownerId, reason) {
    const user = store.get('user');
    if (!user) return { data: null, error: new Error('Tidak terautentikasi') };
    
    if (APP_CONFIG.demoMode) {
        await delay(600);
        let requests = store.get('transfer_requests') || [];
        const taskTitle = store.get('tasks').find(t => t.id === taskId)?.title || 'Task';
        
        const newReq = {
            id: `req-${Date.now()}`,
            task_id: taskId,
            requester_id: user.id,
            requester_name: user.full_name,
            owner_id: ownerId,
            reason,
            status: 'pending',
            tasks: { title: taskTitle },
            requester: { full_name: user.full_name, avatar_url: user.avatar_url },
            created_at: new Date().toISOString()
        };
        requests = [newReq, ...requests];
        store.set({ transfer_requests: requests });
        
        // Buat notifikasi untuk OWNER (bukan requester)
        const notifs = store.get('notifications') || [];
        const newNotif = {
            id: `notif-${Date.now()}`,
            type: 'warning',
            title: 'Permintaan Pergantian Tugas',
            message: `${user.full_name} mengajukan pergantian tugas untuk "${taskTitle}".`,
            user_id: ownerId, // Penting: notifikasi hanya untuk owner tugas
            created_at: new Date().toISOString(),
            is_read: false
        };
        store.set({ 
            notifications: [newNotif, ...notifs],
            // Hanya increment jika user saat ini adalah owner (demo mode: bisa jadi user yang sama)
            unreadNotifications: (store.get('unreadNotifications') || 0) + (ownerId === user.id ? 1 : 0)
        });
        
        return { data: newReq, error: null };
    }
    
    try {
        const { data, error } = await getDB()
            .from('task_transfer_requests')
            .insert({
                task_id: taskId,
                requester_id: user.id,
                owner_id: ownerId,
                reason,
                status: 'pending'
            })
            .select()
            .single();
        
        if (error) {
            console.error('[submitTransferRequest] Supabase error:', error);
            // Fallback: simpan di store lokal jika tabel belum ada
            let requests = store.get('transfer_requests') || [];
            const taskTitle = store.get('tasks').find(t => t.id === taskId)?.title || 'Task';
            const fallbackReq = {
                id: `req-${Date.now()}`,
                task_id: taskId,
                requester_id: user.id,
                requester_name: user.full_name,
                owner_id: ownerId,
                reason,
                status: 'pending',
                tasks: { title: taskTitle },
                requester: { full_name: user.full_name, avatar_url: user.avatar_url },
                created_at: new Date().toISOString(),
                _local: true
            };
            store.set({ transfer_requests: [fallbackReq, ...requests] });
            
            // Buat notifikasi lokal untuk OWNER
            // Catatan: di real mode, notif lokal ini hanya berguna jika owner
            // sedang online di session yang sama (unlikely). Tapi kita tetap simpan
            // agar konsisten, dengan user_id ownerId agar tidak muncul di requester.
            const notifs = store.get('notifications') || [];
            const newNotif = {
                id: `notif-${Date.now()}`,
                type: 'warning',
                title: 'Permintaan Pergantian Tugas',
                message: `${user.full_name} mengajukan pergantian tugas untuk "${taskTitle}".`,
                user_id: ownerId, // Penting agar notif spesifik untuk owner
                created_at: new Date().toISOString(),
                is_read: false
            };
            store.set({ 
                notifications: [newNotif, ...notifs],
                // Jangan increment badge di session requester — notif ini untuk owner
                unreadNotifications: (store.get('unreadNotifications') || 0) + (ownerId === user.id ? 1 : 0)
            });
            
            return { data: fallbackReq, error: null }; // Return sukses dengan fallback
        }
        
        // Buat notifikasi di database Supabase untuk owner
        try {
            const taskTitle = store.get('tasks').find(t => t.id === taskId)?.title || 'Task';
            await getDB().from('notifications').insert({
                user_id: ownerId,
                type: 'task', // Harus sesuai enum notification_type (task/program/deadline/system/mention)
                title: 'Permintaan Pergantian Tugas',
                message: `${user.full_name} mengajukan pergantian tugas untuk "${taskTitle}".`,
                resource_type: 'task',
                resource_id: taskId,
                action_url: '#/dashboard',
                sent_by: user.id, // Diperlukan oleh RLS policy notifications_send_admin
                is_read: false
            });
        } catch (notifErr) {
            console.error('[submitTransferRequest] Failed to insert notification:', notifErr);
        }
        
        return { data, error: null };
    } catch (err) {
        console.error('[submitTransferRequest] Exception:', err);
        return { data: null, error: err };
    }
}

export async function fetchTransferRequests() {
    if (APP_CONFIG.demoMode) {
        await delay(400);
        const requests = store.get('transfer_requests') || [];
        return { data: requests, error: null };
    }
    
    try {
        const { data, error } = await getDB()
            .from('task_transfer_requests')
            .select('*, tasks(title), requester:profiles!requester_id(full_name, avatar_url), owner:profiles!owner_id(full_name)')
            .order('created_at', { ascending: false })
            .limit(20);
        
        // Merge dengan request lokal (fallback) jika ada
        const localRequests = (store.get('transfer_requests') || []).filter(r => r._local);
        const merged = [...(data || []), ...localRequests];
        
        return { data: merged, error };
    } catch (err) {
        const localRequests = store.get('transfer_requests') || [];
        return { data: localRequests, error: null };
    }
}

export async function updateTransferRequestStatus(requestId, taskId, newOwnerId, status) {
    if (APP_CONFIG.demoMode) {
        await delay(400);
        let requests = store.get('transfer_requests') || [];
        const req = requests.find(r => r.id === requestId);
        if (req) req.status = status;
        store.set({ transfer_requests: requests });
        
        if (status === 'approved') {
            await updateTask(taskId, { assigned_to: newOwnerId, _silent: true });
        }
        
        // Hapus notif lokal
        const notifs = store.get('notifications') || [];
        const filteredNotifs = notifs.filter(n => !(n.title === 'Permintaan Pergantian Tugas' && n.message.includes(`"${store.get('tasks').find(t => t.id === taskId)?.title || ''}"`)));
        store.set({
            notifications: filteredNotifs,
            unreadNotifications: filteredNotifs.filter(n => !n.is_read).length
        });
        
        return { error: null };
    }
    
    // Handle local fallback requests
    const requests = store.get('transfer_requests') || [];
    const localReq = requests.find(r => r.id === requestId && r._local);
    if (localReq) {
        localReq.status = status;
        store.set({ transfer_requests: requests });
        if (status === 'approved') {
            await updateTask(taskId, { assigned_to: newOwnerId, _silent: true });
        }
        
        // Hapus notif lokal
        const notifs = store.get('notifications') || [];
        const filteredNotifs = notifs.filter(n => !(n.title === 'Permintaan Pergantian Tugas' && n.message.includes(`"${store.get('tasks').find(t => t.id === taskId)?.title || ''}"`)));
        store.set({
            notifications: filteredNotifs,
            unreadNotifications: filteredNotifs.filter(n => !n.is_read).length
        });
        
        return { error: null };
    }
    
    const updates = { status };
    if (status === 'approved') updates.approved_at = new Date().toISOString();
    else if (status === 'rejected') updates.rejected_at = new Date().toISOString();
    
    const { error } = await getDB()
        .from('task_transfer_requests')
        .update(updates)
        .eq('id', requestId);
        
    if (!error) {
        if (status === 'approved') {
            await getDB().from('tasks').update({ assigned_to: newOwnerId }).eq('id', taskId);
        }
        
        // Hapus notifikasi terkait request ini
        try {
            await getDB()
                .from('notifications')
                .delete()
                .eq('resource_type', 'task')
                .eq('resource_id', taskId)
                .eq('title', 'Permintaan Pergantian Tugas');
        } catch (err) {
            console.error('Failed to remove notification', err);
        }
        
        // Hapus juga dari local store agar UI langsung terupdate
        const notifs = store.get('notifications') || [];
        const filteredNotifs = notifs.filter(n => !(n.title === 'Permintaan Pergantian Tugas' && n.message.includes(`"${store.get('tasks').find(t => t.id === taskId)?.title || ''}"`)));
        store.set({
            notifications: filteredNotifs,
            unreadNotifications: filteredNotifs.filter(n => !n.is_read).length
        });
    }
    
    return { error };
}

// ============================================================
// TASK PROOF (BUKTI FOTO DONE)
// ============================================================

/**
 * Upload bukti foto penyelesaian task & set status done
 * @param {string} taskId
 * @param {File} file - File foto
 */
export async function markTaskDoneWithProof(taskId, file) {
    const user = store.get('user');
    
    if (APP_CONFIG.demoMode) {
        await delay(500);
        // Demo: simpan sebagai object URL lokal
        const localUrl = URL.createObjectURL(file);
        const result = await updateTask(taskId, { 
            status: 'done', 
            progress: 100, 
            proof_url: localUrl,
            proof_uploaded_at: new Date().toISOString(),
            proof_uploaded_by: user?.id,
            _silent: true 
        });
        await logActivity('status_change', 'task', 
            store.get('tasks').find(t => t.id === taskId)?.title || taskId, 
            { status: 'done', has_proof: true }
        );
        return result;
    }
    
    try {
        // Upload ke Supabase Storage bucket 'attachments'
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `task-proofs/${taskId}/${Date.now()}.${ext}`;
        
        const { error: uploadError } = await getDB().storage
            .from('attachments')
            .upload(path, file, { upsert: true, contentType: file.type });
        
        let proofUrl = null;
        if (!uploadError) {
            const { data: { publicUrl } } = getDB().storage
                .from('attachments')
                .getPublicUrl(path);
            proofUrl = publicUrl;
        } else {
            console.error('[markTaskDoneWithProof] Storage upload failed:', uploadError);
            return { data: null, error: uploadError };
        }
        
        // Update task status ke done
        const result = await updateTask(taskId, {
            status: 'done',
            progress: 100,
            proof_url: proofUrl,
            proof_uploaded_at: new Date().toISOString(),
            proof_uploaded_by: user?.id,
            _silent: true
        });
        
        await logActivity('status_change', 'task', result.data?.title || taskId, { status: 'done', has_proof: !!proofUrl });
        return result;
    } catch (err) {
        console.error('[markTaskDoneWithProof]:', err);
        return { data: null, error: err };
    }
}

