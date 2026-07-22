/**
 * EEPROM Humas Management System
 * Authentication Module
 * 
 * Handles Supabase Auth + Demo mode login
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, APP_CONFIG } from './config.js';
import { store } from './store.js';
import { toast, showLoading, hideLoading } from './utils.js';
import { MOCK_USER, MOCK_MEMBERS } from './mockData.js';

// ============================================================
// SUPABASE CLIENT
// ============================================================

let supabaseClient = null;

/**
 * Initialize Supabase client
 * Called once on app start
 */
export function initSupabase() {
    if (APP_CONFIG.demoMode) {
        console.log('🎭 Demo Mode: Supabase disabled');
        return null;
    }
    
    if (!window.supabase) {
        console.error('Supabase SDK not loaded');
        return null;
    }
    
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    });
    
    return supabaseClient;
}

/**
 * Get supabase client instance
 */
export function getSupabase() {
    if (!supabaseClient && !APP_CONFIG.demoMode) {
        console.error('Supabase not initialized. Call initSupabase() first.');
    }
    return supabaseClient;
}

// ============================================================
// AUTHENTICATION FUNCTIONS
// ============================================================

/**
 * Login with email and password
 */
export async function login(email, password) {
    showLoading('Masuk...');
    
    try {
        // Demo mode login
        if (APP_CONFIG.demoMode) {
            await simulateDelay(800);
            
            // Demo credentials
            const demoUsers = {
                'admin@eeprom.ac.id':    { ...MOCK_USER, role: 'super_admin',  full_name: 'Siti Nikmatus Sholihah' },
                'ketua@eeprom.ac.id':    { ...MOCK_USER, role: 'ketua_humas',  full_name: 'Siti Rahayu (Ketua Humas)', id: 'mock-user-002' },
                'staff@eeprom.ac.id':    { ...MOCK_USER, role: 'anggota_humas',  full_name: 'Budi Santoso (Anggota Humas)', id: 'mock-user-003' },
            };
            
            if (!demoUsers[email]) {
                throw new Error('Email tidak terdaftar. Gunakan: admin@eeprom.ac.id / ketua@eeprom.ac.id / staff@eeprom.ac.id');
            }
            
            if (password.length < 6) {
                throw new Error('Password minimal 6 karakter');
            }
            
            const user = demoUsers[email];
            store.set({ user, isAuthenticated: true });
            
            // Save to localStorage (bukan sessionStorage) agar session bertahan di PWA
            localStorage.setItem('eeprom_user', JSON.stringify(user));
            
            hideLoading();
            toast.success(`Selamat datang, ${user.full_name}! 🎉`);
            return { data: { user }, error: null };
        }
        
        // Real Supabase login
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        
        if (error) throw error;
        
        // Fetch profile
        const profile = await fetchProfile(data.user.id);
        
        // Load notifications from DB
        if (!APP_CONFIG.demoMode && supabaseClient) {
            const { data: notifs } = await supabaseClient
                .from('notifications')
                .select('*')
                .eq('user_id', data.user.id)
                .order('created_at', { ascending: false })
                .limit(20);
                
            if (notifs) {
                store.set({ 
                    notifications: notifs,
                    unreadNotifications: notifs.filter(n => !n.is_read).length
                });
            }
        }
        
        store.set({ user: profile, isAuthenticated: true });
        
        // Log activity
        await logActivity('login', null, null, null);
        
        hideLoading();
        toast.success(`Selamat datang, ${profile.full_name}! 🎉`);
        return { data: { user: profile }, error: null };
        
    } catch (error) {
        hideLoading();
        toast.error(error.message || 'Login gagal. Periksa email dan password.');
        return { data: null, error };
    }
}

/**
 * Logout
 */
export async function logout() {
    showLoading('Keluar...');
    
    try {
        if (!APP_CONFIG.demoMode && supabaseClient) {
            await supabaseClient.auth.signOut();
        }
        
        // Hapus semua storage
        localStorage.removeItem('eeprom_user');
        sessionStorage.removeItem('eeprom_user');
        store.reset();
        
        // Redirect ke halaman login — gunakan origin agar tidak salah path
        const loginUrl = window.location.origin + window.location.pathname.replace(/\/app\.html.*/, '') + '/index.html';
        window.location.replace(loginUrl);
    } catch (error) {
        console.error('Logout error:', error);
        // Force redirect meski ada error
        localStorage.removeItem('eeprom_user');
        sessionStorage.removeItem('eeprom_user');
        window.location.replace('./index.html');
    } finally {
        hideLoading();
    }
}

/**
 * Check active session on app load
 * Returns true if authenticated
 */
export async function checkSession() {
    // Demo mode: check localStorage (persistent) lalu sessionStorage (fallback)
    if (APP_CONFIG.demoMode) {
        const stored = localStorage.getItem('eeprom_user') || sessionStorage.getItem('eeprom_user');
        if (stored) {
            try {
                const user = JSON.parse(stored);
                store.set({ user, isAuthenticated: true });
                // Migrate ke localStorage jika masih di sessionStorage
                localStorage.setItem('eeprom_user', JSON.stringify(user));
                return true;
            } catch (_) {}
        }
        return false;
    }
    
    // Real mode: check Supabase session
    if (!supabaseClient) return false;
    
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            const profile = await fetchProfile(session.user.id);
            
            // Load notifications from DB
            if (!APP_CONFIG.demoMode && supabaseClient) {
                const { data: notifs } = await supabaseClient
                    .from('notifications')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .order('created_at', { ascending: false })
                    .limit(20);
                    
                if (notifs) {
                    store.set({ 
                        notifications: notifs,
                        unreadNotifications: notifs.filter(n => !n.is_read).length
                    });
                }
            }
            
            store.set({ user: profile, isAuthenticated: true });
            return true;
        }
        return false;
    } catch (_) {
        return false;
    }
}

/**
 * Listen to auth state changes (real Supabase mode)
 */
export function onAuthStateChange(callback) {
    if (APP_CONFIG.demoMode) return () => {};
    if (!supabaseClient) return () => {};
    
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            const profile = await fetchProfile(session.user.id);
            
            // Load notifications from DB
            if (!APP_CONFIG.demoMode && supabaseClient) {
                const { data: notifs } = await supabaseClient
                    .from('notifications')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .order('created_at', { ascending: false })
                    .limit(20);
                    
                if (notifs) {
                    store.set({ 
                        notifications: notifs,
                        unreadNotifications: notifs.filter(n => !n.is_read).length
                    });
                }
            }
            
            store.set({ user: profile, isAuthenticated: true });
            callback('SIGNED_IN', profile);
        } else if (event === 'SIGNED_OUT') {
            store.reset();
            callback('SIGNED_OUT', null);
        } else if (event === 'TOKEN_REFRESHED') {
            callback('TOKEN_REFRESHED', store.get('user'));
        }
    });
    
    return () => subscription.unsubscribe();
}

// ============================================================
// PROFILE FUNCTIONS
// ============================================================

/**
 * Fetch user profile from Supabase
 */
export async function fetchProfile(userId) {
    if (APP_CONFIG.demoMode) return MOCK_USER;
    
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) throw error;
    return data;
}

/**
 * Fetch all members (profiles) from Supabase
 */
export async function fetchMembers() {
    if (APP_CONFIG.demoMode) return { data: MOCK_MEMBERS, error: null };
    
    if (!supabaseClient) return { data: [], error: 'Supabase client not initialized' };
    
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('id, full_name, nickname, role, jabatan, avatar_url')
        .order('full_name');
        
    return { data, error };
}

/**
 * Update user profile
 */
export async function updateProfile(updates) {
    const user = store.get('user');
    if (!user) throw new Error('Not authenticated');
    
    if (APP_CONFIG.demoMode) {
        await simulateDelay(600);
        const updatedUser = { ...user, ...updates };
        store.set({ user: updatedUser });
        // Simpan ke localStorage untuk PWA persistence
        localStorage.setItem('eeprom_user', JSON.stringify(updatedUser));
        return { data: updatedUser, error: null };
    }
    
    const { data, error } = await supabaseClient
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single();
    
    if (error) throw error;
    store.set({ user: data });
    return { data, error: null };
}

/**
 * Change password
 */
export async function changePassword(newPassword) {
    if (APP_CONFIG.demoMode) {
        await simulateDelay(600);
        return { error: null };
    }
    
    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
    return { error };
}

/**
 * Upload avatar image
 */
export async function uploadAvatar(file) {
    const user = store.get('user');
    if (!user) throw new Error('Not authenticated');
    
    if (APP_CONFIG.demoMode) {
        await simulateDelay(800);
        const fakeUrl = URL.createObjectURL(file);
        await updateProfile({ avatar_url: fakeUrl });
        return { url: fakeUrl, error: null };
    }
    
    const fileExt = file.name.split('.').pop();
    const path = `${user.id}/avatar.${fileExt}`;
    
    const { error: uploadError } = await supabaseClient.storage
        .from(APP_CONFIG.storage.avatars)
        .upload(path, file, { upsert: true });
    
    if (uploadError) throw uploadError;
    
    const { data: { publicUrl } } = supabaseClient.storage
        .from(APP_CONFIG.storage.avatars)
        .getPublicUrl(path);
    
    await updateProfile({ avatar_url: publicUrl });
    return { url: publicUrl, error: null };
}

// ============================================================
// ACTIVITY LOGGING
// ============================================================

/**
 * Log user activity
 */
export async function logActivity(action, resourceType, resourceId, resourceName, data = {}) {
    if (APP_CONFIG.demoMode) return;
    if (!supabaseClient) return;
    
    const user = store.get('user');
    if (!user) return;
    
    try {
        await supabaseClient.from('activity_logs').insert({
            user_id: user.id,
            action,
            resource_type: resourceType,
            resource_id: resourceId,
            resource_name: resourceName,
            new_data: data,
        });
    } catch (_) {
        // Non-critical, fail silently
    }
}

// ============================================================
// HELPERS
// ============================================================

function simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get current authenticated user
 */
export function getCurrentUser() {
    return store.get('user');
}

/**
 * Check if current user has specific role
 */
export function hasRole(...roles) {
    const user = store.get('user');
    return user && roles.includes(user.role);
}
