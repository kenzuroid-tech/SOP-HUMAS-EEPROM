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
        return { data: newTask, error: null };
    }
    
    const user = store.get('user');
    const { data, error } = await getDB()
        .from('tasks')
        .insert({ ...taskData, created_by: user.id })
        .select()
        .single();
    
    if (!error) await fetchTasks();
    return { data, error };
}

export async function updateTask(id, updates) {
    if (APP_CONFIG.demoMode) {
        await delay(400);
        const tasks = store.get('tasks').map(t =>
            t.id === id ? { ...t, ...updates } : t
        );
        store.set({ tasks });
        return { data: tasks.find(t => t.id === id), error: null };
    }
    
    const { data, error } = await getDB()
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    
    if (!error) await fetchTasks();
    return { data, error };
}

export async function deleteTask(id) {
    if (APP_CONFIG.demoMode) {
        await delay(400);
        const tasks = store.get('tasks').filter(t => t.id !== id);
        store.set({ tasks });
        return { error: null };
    }
    
    const { error } = await getDB().from('tasks').delete().eq('id', id);
    if (!error) await fetchTasks();
    return { error };
}

export async function updateTaskStatus(id, status) {
    const progress = status === 'done' ? 100 : status === 'todo' ? 0 : undefined;
    const updates = { status };
    if (progress !== undefined) updates.progress = progress;
    return updateTask(id, updates);
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
