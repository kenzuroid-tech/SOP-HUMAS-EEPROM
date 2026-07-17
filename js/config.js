/**
 * EEPROM Humas Management System
 * Configuration File
 * 
 * IMPORTANT: Replace SUPABASE_URL and SUPABASE_ANON_KEY
 * with your actual Supabase project credentials.
 * Find them in: Supabase Dashboard → Settings → API
 */

// ============================================================
// SUPABASE CONFIGURATION
// ============================================================

export const SUPABASE_URL = 'https://kigeopwjpfismdgpwzjh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZ2VvcHdqcGZpc21kZ3B3empoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNTcwMDIsImV4cCI6MjA5OTgzMzAwMn0.aM4NuLQ3-27xbBiIgXhHbT7cnzlk4IgFNrhhlixGTto';

// ============================================================
// APP CONFIGURATION
// ============================================================

export const APP_CONFIG = {
    name: 'EEPROM Humas',
    fullName: 'EEPROM Humas Management System',
    version: '1.0.0',
    description: 'Sistem Manajemen Internal Divisi Humas Komunitas EEPROM',
    organization: 'Komunitas EEPROM',
    division: 'Divisi Humas',
    
    // Demo mode: uses mock data instead of Supabase
    // Set to false when Supabase is configured
    demoMode: false,
    
    // Storage bucket names (must match schema.sql)
    storage: {
        avatars: 'avatars',
        documents: 'documents',
        programCovers: 'program-covers',
        attachments: 'attachments',
    },
    
    // Pagination
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
    
    // File upload limits (bytes)
    maxAvatarSize: 5 * 1024 * 1024,       // 5MB
    maxDocumentSize: 50 * 1024 * 1024,    // 50MB
    
    // Toast notification duration (ms)
    toastDuration: 3500,
    
    // Date format
    dateFormat: 'id-ID',
    timezone: 'Asia/Jakarta',
};

// ============================================================
// PROGRAM KERJA CONFIGURATION
// ============================================================

export const PROGRAMS = [
    { code: 'PRASTUDI',     name: 'Prastudi',           icon: 'book-open',    color: '#6C63FF' },
    { code: 'EXPO_KELEM',   name: 'Expo Kelembagaan',   icon: 'layout',       color: '#8B5CF6' },
    { code: 'GEMILANG',     name: 'Gemilang Prestasi',  icon: 'award',        color: '#EC4899' },
    { code: 'OPEN_REC',     name: 'Open Recruitment',   icon: 'users-plus',   color: '#F59E0B' },
    { code: 'TES_TULIS',    name: 'Tes Tulis',          icon: 'pen-line',     color: '#10B981' },
    { code: 'TES_WAWANCARA',name: 'Tes Wawancara',      icon: 'message-square',color: '#06B6D4' },
    { code: 'DIKLAT_RUANG', name: 'Diklat Ruang',       icon: 'presentation', color: '#F97316' },
    { code: 'DIKLAT_LAPANG',name: 'Diklat Lapang',      icon: 'mountain',     color: '#84CC16' },
];

// ============================================================
// STATUS CONFIGURATIONS
// ============================================================

export const TASK_STATUS = {
    todo:        { label: 'To Do',       color: '#94A3B8', bg: 'rgba(148,163,184,0.15)', icon: 'circle' },
    in_progress: { label: 'In Progress', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)',  icon: 'clock' },
    review:      { label: 'Review',      color: '#06B6D4', bg: 'rgba(6,182,212,0.15)',   icon: 'eye' },
    done:        { label: 'Done',        color: '#10B981', bg: 'rgba(16,185,129,0.15)',  icon: 'check-circle' },
    cancelled:   { label: 'Cancelled',   color: '#EF4444', bg: 'rgba(239,68,68,0.15)',  icon: 'x-circle' },
};

export const TASK_PRIORITY = {
    low:    { label: 'Low',    color: '#10B981', icon: 'chevron-down' },
    medium: { label: 'Medium', color: '#F59E0B', icon: 'minus' },
    high:   { label: 'High',   color: '#EF4444', icon: 'chevron-up' },
    urgent: { label: 'Urgent', color: '#DC2626', icon: 'alert-triangle' },
};

export const PROGRAM_STATUS = {
    planning:  { label: 'Planning',  color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' },
    active:    { label: 'Active',    color: '#6C63FF', bg: 'rgba(108,99,255,0.15)'  },
    completed: { label: 'Completed', color: '#10B981', bg: 'rgba(16,185,129,0.15)'  },
    cancelled: { label: 'Cancelled', color: '#EF4444', bg: 'rgba(239,68,68,0.15)'  },
};

export const TEMPLATE_TYPES = {
    whatsapp:    { label: 'Broadcast WA',     icon: 'message-circle', color: '#25D366' },
    instagram:   { label: 'Caption Instagram', icon: 'instagram',      color: '#E1306C' },
    surat:       { label: 'Template Surat',   icon: 'file-text',      color: '#6C63FF' },
    pengumuman:  { label: 'Pengumuman',       icon: 'megaphone',      color: '#F59E0B' },
};

export const DOCUMENT_CATEGORIES = {
    kegiatan:      { label: 'Kegiatan',      icon: 'camera',        color: '#6C63FF' },
    rapat:         { label: 'Rapat',         icon: 'users',         color: '#8B5CF6' },
    publikasi:     { label: 'Publikasi',     icon: 'image',         color: '#EC4899' },
    administrasi:  { label: 'Administrasi',  icon: 'folder',        color: '#F59E0B' },
    lainnya:       { label: 'Lainnya',       icon: 'archive',       color: '#64748B' },
};

export const PARTICIPANT_TYPES = {
    mahasiswa_baru:  { label: 'Mahasiswa Baru', icon: 'user-plus',   color: '#6C63FF' },
    alumni:          { label: 'Alumni',          icon: 'graduation-cap', color: '#10B981' },
    pendaftar:       { label: 'Pendaftar',       icon: 'clipboard',   color: '#F59E0B' },
    contact_person:  { label: 'Contact Person',  icon: 'phone',       color: '#06B6D4' },
};

// ============================================================
// NAVIGATION CONFIGURATION
// ============================================================

export const NAV_ITEMS = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: 'layout-dashboard',
        path: '/dashboard',
        roles: ['super_admin', 'ketua_humas', 'anggota_humas'],
    },
    {
        id: 'programs',
        label: 'Program Kerja',
        icon: 'briefcase',
        path: '/programs',
        roles: ['super_admin', 'ketua_humas', 'anggota_humas'],
        children: PROGRAMS.map(p => ({
            id: p.code.toLowerCase(),
            label: p.name,
            icon: p.icon,
            path: `/programs/${p.code.toLowerCase()}`,
            color: p.color,
        })),
    },
    {
        id: 'timeline',
        label: 'Timeline',
        icon: 'calendar',
        path: '/timeline',
        roles: ['super_admin', 'ketua_humas', 'anggota_humas'],
    },
    {
        id: 'tasks',
        label: 'Task Management',
        icon: 'check-square',
        path: '/tasks',
        roles: ['super_admin', 'ketua_humas', 'anggota_humas'],
    },
    {
        id: 'templates',
        label: 'Template',
        icon: 'layout-template',
        path: '/templates',
        roles: ['super_admin', 'ketua_humas', 'anggota_humas'],
    },
    {
        id: 'database',
        label: 'Database',
        icon: 'database',
        path: '/database',
        roles: ['super_admin', 'ketua_humas', 'anggota_humas'],
    },
    {
        id: 'documents',
        label: 'Dokumentasi',
        icon: 'image',
        path: '/documents',
        roles: ['super_admin', 'ketua_humas', 'anggota_humas'],
    },
    {
        id: 'evaluations',
        label: 'Evaluasi',
        icon: 'bar-chart-2',
        path: '/evaluations',
        roles: ['super_admin', 'ketua_humas'],
    },
    {
        id: 'settings',
        label: 'Setting',
        icon: 'settings',
        path: '/settings',
        roles: ['super_admin', 'ketua_humas', 'anggota_humas'],
    },
];
