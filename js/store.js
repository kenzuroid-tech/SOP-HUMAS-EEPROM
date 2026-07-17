/**
 * EEPROM Humas Management System
 * Global State Store (Reactive)
 * 
 * Simple pub/sub state management without framework
 */

// ============================================================
// INITIAL STATE
// ============================================================

const initialState = {
    // Auth
    user: null,
    isAuthenticated: false,
    
    // App
    currentPage: 'dashboard',
    currentProgramCode: null,
    isLoading: false,
    sidebarCollapsed: false,
    sidebarMobileOpen: false,
    
    // Data caches
    programs: [],
    tasks: [],
    timeline: [],
    templates: [],
    documents: [],
    participants: [],
    evaluations: [],
    members: [],
    activityLogs: [],
    notifications: [],
    unreadNotifications: 0,
    
    // Filters
    taskFilters: { status: 'all', priority: 'all', program: 'all', search: '' },
    documentFilters: { category: 'all', program: 'all', search: '' },
    participantFilters: { type: 'all', search: '' },
    templateFilters: { type: 'all', search: '' },
    
    // Pagination
    taskPage: 1,
    documentPage: 1,
    participantPage: 1,
    
    // Stats
    stats: null,
    
    // UI
    lastUpdated: null,
};

// ============================================================
// STORE CLASS
// ============================================================

class Store {
    constructor(state) {
        this._state = { ...state };
        this._subscribers = new Map();
    }
    
    /**
     * Get current state (or slice)
     * @param {string} [key] - Optional state key
     */
    get(key) {
        if (key) return this._state[key];
        return { ...this._state };
    }
    
    /**
     * Update state and notify subscribers
     * @param {Object|Function} updater - Partial state or updater function
     */
    set(updater) {
        const prev = { ...this._state };
        const updates = typeof updater === 'function' ? updater(prev) : updater;
        this._state = { ...this._state, ...updates };
        
        // Notify subscribers for changed keys
        Object.keys(updates).forEach(key => {
            if (prev[key] !== this._state[key]) {
                this._notify(key, this._state[key], prev[key]);
            }
        });
        
        // Always notify wildcard subscribers
        this._notify('*', this._state, prev);
    }
    
    /**
     * Subscribe to state changes
     * @param {string|string[]} keys - State key(s) to watch, or '*' for all
     * @param {Function} callback - Called with (newVal, oldVal, key)
     * @returns {Function} Unsubscribe function
     */
    subscribe(keys, callback) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        const id = Symbol();
        
        keyList.forEach(key => {
            if (!this._subscribers.has(key)) {
                this._subscribers.set(key, new Map());
            }
            this._subscribers.get(key).set(id, callback);
        });
        
        // Return unsubscribe function
        return () => {
            keyList.forEach(key => {
                this._subscribers.get(key)?.delete(id);
            });
        };
    }
    
    /**
     * Notify subscribers
     */
    _notify(key, newVal, oldVal) {
        this._subscribers.get(key)?.forEach(callback => {
            try {
                callback(newVal, oldVal, key);
            } catch (err) {
                console.error(`Store subscriber error for key "${key}":`, err);
            }
        });
    }
    
    /**
     * Reset state to initial
     */
    reset() {
        this.set(initialState);
    }
    
    /**
     * Computed getter
     */
    computed(key, computeFn) {
        Object.defineProperty(this, key, {
            get: () => computeFn(this._state),
            enumerable: true,
        });
    }
}

// ============================================================
// CREATE & EXPORT STORE INSTANCE
// ============================================================

export const store = new Store(initialState);

// ============================================================
// COMPUTED PROPERTIES
// ============================================================

/**
 * Get completed tasks count
 */
export function getTaskStats(tasks) {
    return {
        total: tasks.length,
        todo: tasks.filter(t => t.status === 'todo').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        review: tasks.filter(t => t.status === 'review').length,
        done: tasks.filter(t => t.status === 'done').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length,
        overdue: tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && !['done', 'cancelled'].includes(t.status)).length,
    };
}

/**
 * Get upcoming deadlines (next 7 days)
 */
export function getUpcomingDeadlines(tasks) {
    const now = new Date();
    const next7days = new Date(now.getTime() + 7 * 86400000);
    return tasks
        .filter(t => t.deadline && new Date(t.deadline) >= now && new Date(t.deadline) <= next7days && !['done', 'cancelled'].includes(t.status))
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
}

/**
 * Get program progress average
 */
export function getAvgProgress(programs) {
    if (!programs.length) return 0;
    return Math.round(programs.reduce((sum, p) => sum + (p.progress || 0), 0) / programs.length);
}

/**
 * Check if user has permission
 */
export function hasPermission(resource, action) {
    const role = store.get('user')?.role;
    if (!role) return false;
    if (role === 'super_admin') return true;
    
    const permissions = {
        ketua_humas: {
            programs: ['view', 'create', 'edit'],
            tasks: ['view', 'create', 'edit', 'delete'],
            timeline: ['view', 'create', 'edit', 'delete'],
            templates: ['view', 'create', 'edit', 'delete'],
            database: ['view', 'create', 'edit'],
            documents: ['view', 'upload', 'delete'],
            evaluations: ['view', 'create', 'edit'],
            settings: ['view'],
        },
        anggota_humas: {
            programs: ['view'],
            tasks: ['view', 'create'],
            timeline: ['view'],
            templates: ['view'],
            database: ['view'],
            documents: ['view', 'upload'],
            evaluations: ['view'],
            settings: ['view'],
        },
    };
    
    return permissions[role]?.[resource]?.includes(action) ?? false;
}

// ============================================================
// LOCAL STORAGE PERSISTENCE
// ============================================================

const PERSIST_KEYS = ['taskFilters', 'documentFilters'];

/**
 * Load persisted state from localStorage
 */
export function loadPersistedState() {
    PERSIST_KEYS.forEach(key => {
        try {
            const val = localStorage.getItem(`eeprom_${key}`);
            if (val !== null) {
                store.set({ [key]: JSON.parse(val) });
            }
        } catch (_) {}
    });
}

/**
 * Persist state changes to localStorage
 */
export function initPersistence() {
    store.subscribe(PERSIST_KEYS, (val, _, key) => {
        try {
            localStorage.setItem(`eeprom_${key}`, JSON.stringify(val));
        } catch (_) {}
    });
}
