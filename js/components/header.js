/**
 * EEPROM Humas Management System
 * Header / Topbar Component
 */

import { store } from '../store.js';
import { navigate } from '../router.js';
import { toggleMobileSidebar } from './sidebar.js';
import { formatRelativeTime, getInitials, stringToColor } from '../utils.js';
import { logout } from '../auth.js';

// ============================================================
// HEADER RENDER
// ============================================================

export function renderHeader() {
    const header = document.getElementById('app-header');
    if (!header) return;
    
    const user = store.get('user');
    const notifications = store.get('notifications');
    const unread = store.get('unreadNotifications');
    
    header.innerHTML = `
        <div class="header-left">
            <button class="btn-icon mobile-menu-btn" id="mobile-menu-btn" title="Menu">
                <i data-lucide="menu"></i>
            </button>
            <div class="breadcrumb">
                <span id="page-title">Dashboard</span>
            </div>
        </div>
        
        <div class="header-center">
            <div class="search-bar" id="global-search-bar">
                <i data-lucide="search"></i>
                <input type="text" placeholder="Cari task, program, template..." id="global-search-input">
                <kbd>⌘K</kbd>
            </div>
        </div>
        
        <div class="header-right">
            <!-- Theme Toggle -->
            <button class="btn-icon theme-toggle-btn" id="theme-toggle-btn" title="Ganti Tema">
                <i data-lucide="moon"></i>
            </button>
            
            <!-- Notifications -->
            <div class="notification-btn-wrapper" id="notif-wrapper">
                <button class="btn-icon notification-btn" id="notif-btn" title="Notifikasi">
                    <i data-lucide="bell"></i>
                    ${unread > 0 ? `<span class="notif-badge">${unread > 9 ? '9+' : unread}</span>` : ''}
                </button>
                <div class="notification-dropdown" id="notif-dropdown">
                    <div class="notif-header">
                        <h4>Notifikasi</h4>
                        <button class="btn-text text-sm" id="mark-all-read">Tandai semua dibaca</button>
                    </div>
                    <div class="notif-list" id="notif-list">
                        <div class="notif-empty">
                            <i data-lucide="bell-off"></i>
                            <p>Tidak ada notifikasi baru</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- User Menu -->
            <div class="user-menu-wrapper" id="user-menu-wrapper">
                <button class="user-menu-btn" id="user-menu-btn">
                    <div class="avatar avatar-sm" style="background: linear-gradient(135deg, ${stringToColor(user?.full_name || 'U')}, ${stringToColor((user?.full_name || 'U') + '2')})">
                        ${user?.avatar_url ? `<img src="${user.avatar_url}" alt="${user.full_name}">` : getInitials(user?.full_name || 'User')}
                    </div>
                    <div class="user-info-header">
                        <span class="user-name-header">${user?.nickname || user?.full_name?.split(' ')[0] || 'User'}</span>
                        <span class="user-role-header">${getRoleLabel(user?.role)}</span>
                    </div>
                    <i data-lucide="chevron-down"></i>
                </button>
                
                <div class="user-dropdown" id="user-dropdown">
                    <div class="dropdown-header">
                        <div class="avatar avatar-md" style="background: linear-gradient(135deg, ${stringToColor(user?.full_name || 'U')}, ${stringToColor((user?.full_name || 'U') + '2')})">
                            ${user?.avatar_url ? `<img src="${user.avatar_url}" alt="${user.full_name}">` : getInitials(user?.full_name || 'User')}
                        </div>
                        <div>
                            <div class="fw-600">${user?.full_name || 'User'}</div>
                            <div class="text-muted text-sm">${user?.email || ''}</div>
                        </div>
                    </div>
                    <hr class="dropdown-divider">
                    <button class="dropdown-item" data-route="/settings">
                        <i data-lucide="user"></i> Profil Saya
                    </button>
                    <button class="dropdown-item" data-route="/settings">
                        <i data-lucide="settings"></i> Pengaturan
                    </button>
                    <hr class="dropdown-divider">
                    <button class="dropdown-item text-danger" id="logout-btn">
                        <i data-lucide="log-out"></i> Keluar
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Init icons
    if (window.lucide) lucide.createIcons({ nodes: [header] });
    
    // Render notifikasi
    renderNotifications();
    
    // Event listeners
    setupHeaderEvents(header);
}

// ============================================================
// EVENT HANDLERS
// ============================================================

// Flag untuk mencegah event listener duplikat (karena renderHeader bisa dipanggil ulang)
let _headerEventsInit = false;

function setupHeaderEvents(header) {
    // Mobile menu
    document.getElementById('mobile-menu-btn')?.addEventListener('click', toggleMobileSidebar);
    
    // Theme toggle
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        themeToggleBtn.innerHTML = isLight ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
        if (window.lucide) lucide.createIcons({ nodes: [themeToggleBtn] });
        
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('eeprom_theme', newTheme);
            
            themeToggleBtn.innerHTML = newTheme === 'light' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
            if (window.lucide) lucide.createIcons({ nodes: [themeToggleBtn] });
        });
    }
    
    // Notification dropdown
    const notifBtn = document.getElementById('notif-btn');
    const notifDropdown = document.getElementById('notif-dropdown');
    const notifWrapper = document.getElementById('notif-wrapper');
    
    notifBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        notifWrapper.classList.toggle('open');
        document.getElementById('user-menu-wrapper')?.classList.remove('open');
    });
    
    // User menu dropdown
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userMenuWrapper = document.getElementById('user-menu-wrapper');
    
    userMenuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        userMenuWrapper.classList.toggle('open');
        notifWrapper?.classList.remove('open');
    });
    
    // Close dropdowns on outside click — hanya pasang sekali
    if (!_headerEventsInit) {
        document.addEventListener('click', (e) => {
            const nw = document.getElementById('notif-wrapper');
            const umw = document.getElementById('user-menu-wrapper');
            if (!nw?.contains(e.target)) nw?.classList.remove('open');
            if (!umw?.contains(e.target)) umw?.classList.remove('open');
        }, { capture: true });
        
        // Keyboard shortcut for search — hanya pasang sekali
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('global-search-input')?.focus();
            }
        });
        
        // Subscribe to store changes (hanya sekali)
        store.subscribe(['user', 'unreadNotifications'], () => renderHeader());
        
        _headerEventsInit = true;
    }
    
    // Logout — dengan konfirmasi
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        // Tampilkan konfirmasi kecil
        const confirmed = window.confirm('Yakin ingin keluar dari aplikasi?');
        if (!confirmed) return;
        await logout();
    });
    
    // Dropdown items navigation
    header.querySelectorAll('.dropdown-item[data-route]').forEach(btn => {
        btn.addEventListener('click', () => {
            navigate(btn.dataset.route);
            userMenuWrapper?.classList.remove('open');
        });
    });
    
    // Mark all notifications as read
    document.getElementById('mark-all-read')?.addEventListener('click', markAllNotificationsRead);
    
    // Global search
    const searchInput = document.getElementById('global-search-input');
    searchInput?.addEventListener('input', debounce(handleGlobalSearch, 300));
}

// ============================================================
// NOTIFICATIONS
// ============================================================

function renderNotifications() {
    const notifList = document.getElementById('notif-list');
    if (!notifList) return;
    
    const user = store.get('user');
    if (!user) return;
    
    let notifications = store.get('notifications') || [];
    notifications = notifications.filter(n => !n.user_id || n.user_id === user.id);
    
    if (!notifications.length) {
        notifList.innerHTML = `
            <div class="notif-empty">
                <i data-lucide="bell-off"></i>
                <p>Tidak ada notifikasi</p>
            </div>
        `;
    } else {
        notifList.innerHTML = notifications.slice(0, 10).map(n => `
            <div class="notif-item${n.is_read ? '' : ' unread'}" data-notif-id="${n.id}">
                <div class="notif-icon ${n.type}">
                    <i data-lucide="${getNotifIcon(n.type)}"></i>
                </div>
                <div class="notif-content">
                    <div class="notif-title">${n.title}</div>
                    <div class="notif-msg text-sm text-muted">${n.message || ''}</div>
                    <div class="notif-time text-xs text-muted">${formatRelativeTime(n.created_at)}</div>
                </div>
            </div>
        `).join('');
    }
    
    if (window.lucide) lucide.createIcons({ nodes: [notifList] });
}

function markAllNotificationsRead() {
    const notifications = store.get('notifications').map(n => ({ ...n, is_read: true }));
    store.set({ notifications, unreadNotifications: 0 });
    renderNotifications();
}

function getNotifIcon(type) {
    const icons = {
        task: 'check-square',
        program: 'briefcase',
        deadline: 'clock',
        system: 'info',
        mention: 'at-sign',
    };
    return icons[type] || 'bell';
}

// ============================================================
// GLOBAL SEARCH
// ============================================================

function handleGlobalSearch(e) {
    const term = e.target.value.toLowerCase().trim();
    if (!term) return;
    
    // Quick search across tasks and programs
    const tasks = store.get('tasks').filter(t => 
        t.title?.toLowerCase().includes(term) || 
        t.description?.toLowerCase().includes(term)
    ).slice(0, 3);
    
    const programs = store.get('programs').filter(p => 
        p.name?.toLowerCase().includes(term)
    ).slice(0, 2);
    
    // TODO: Show search results dropdown
    console.log('Search results:', { tasks, programs });
}

// ============================================================
// HELPERS
// ============================================================

function getRoleLabel(role) {
    const labels = {
        super_admin: 'Super Admin',
        ketua_humas: 'Ketua Humas',
        anggota_humas: 'Anggota Humas',
    };
    return labels[role] || role || 'Member';
}

function debounce(fn, delay) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}
