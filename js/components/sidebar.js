/**
 * EEPROM Humas Management System
 * Sidebar Component
 */

import { NAV_ITEMS, PROGRAMS, APP_CONFIG } from '../config.js';
import { store } from '../store.js';
import { navigate } from '../router.js';
import { getInitials, stringToColor } from '../utils.js';

// ============================================================
// SIDEBAR RENDER
// ============================================================

export function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    
    const user = store.get('user');
    const collapsed = store.get('sidebarCollapsed');
    
    sidebar.className = `sidebar${collapsed ? ' collapsed' : ''}`;
    
    sidebar.innerHTML = `
        <!-- Logo -->
        <div class="sidebar-brand">
            <div class="brand-logo">
                <img src="./images/eeprom no bg.png" alt="EEPROM Logo" style="width:32px; height:32px; object-fit:contain;">
            </div>
            <div class="brand-text">
                <span class="brand-name">EEPROM</span>
                <span class="brand-sub">Humas System</span>
            </div>
            <button class="sidebar-toggle btn-icon" id="sidebar-toggle">
                <i data-lucide="panel-left-close"></i>
            </button>
        </div>
        
        <!-- Navigation -->
        <nav class="sidebar-nav">
            <ul class="nav-list" id="nav-list"></ul>
        </nav>
    `;
    
    // Render nav items
    renderNavItems(user);
    
    // Sidebar toggle
    const toggleBtn = document.getElementById('sidebar-toggle');
    toggleBtn?.addEventListener('click', toggleSidebar);
    
    // Mobile overlay click
    const overlay = document.getElementById('sidebar-overlay');
    overlay?.addEventListener('click', closeMobileSidebar);
    
    // Init icons
    if (window.lucide) lucide.createIcons({ nodes: [sidebar] });
    
    // Subscribe to store changes
    store.subscribe(['sidebarCollapsed', 'currentPage'], () => {
        updateSidebarState();
    });
}

// ============================================================
// NAV ITEMS
// ============================================================

function renderNavItems(user) {
    const navList = document.getElementById('nav-list');
    if (!navList) return;
    
    const currentPage = store.get('currentPage');
    
    NAV_ITEMS.forEach(item => {
        // Check role access
        if (!item.roles.includes(user?.role)) return;
        
        const li = document.createElement('li');
        li.className = 'nav-item';
        
        if (item.children) {
            // Collapsible section
            const isOpen = currentPage && item.children.some(c => c.path.includes(currentPage));
            li.innerHTML = `
                <button class="nav-link nav-parent${isOpen ? ' open' : ''}" data-nav-id="${item.id}">
                    <span class="nav-icon"><i data-lucide="${item.icon}"></i></span>
                    <span class="nav-label">${item.label}</span>
                    <span class="nav-arrow"><i data-lucide="chevron-right"></i></span>
                </button>
                <ul class="nav-children${isOpen ? ' open' : ''}" id="nav-children-${item.id}">
                    ${item.children.map(child => `
                        <li>
                            <a class="nav-link nav-child" data-route="${child.path}" href="#${child.path}">
                                <span class="nav-dot" style="background: ${child.color}"></span>
                                <span class="nav-label">${child.label}</span>
                            </a>
                        </li>
                    `).join('')}
                </ul>
            `;
            
            const parentBtn = li.querySelector('.nav-parent');
            const children = li.querySelector('.nav-children');
            
            parentBtn.addEventListener('click', (e) => {
                if (!e.target.closest('.nav-child')) {
                    parentBtn.classList.toggle('open');
                    children.classList.toggle('open');
                }
            });
        } else {
            const isActive = `/${currentPage}` === item.path;
            li.innerHTML = `
                <a class="nav-link${isActive ? ' active' : ''}" data-route="${item.path}" href="#${item.path}">
                    <span class="nav-icon"><i data-lucide="${item.icon}"></i></span>
                    <span class="nav-label">${item.label}</span>
                    ${item.id === 'tasks' ? `<span class="nav-badge" id="nav-tasks-badge"></span>` : ''}
                    ${item.id === 'notifications' ? `<span class="nav-badge" id="nav-notif-badge"></span>` : ''}
                </a>
            `;
        }
        
        navList.appendChild(li);
    });
    
    // Update task badge
    updateTaskBadge();
    
    // Nav click handler
    navList.addEventListener('click', (e) => {
        const link = e.target.closest('.nav-link:not(.nav-parent)');
        if (link?.dataset.route) {
            e.preventDefault();
            navigate(link.dataset.route);
            
            // Close mobile sidebar
            if (window.innerWidth < 1024) {
                closeMobileSidebar();
            }
            
            // Update active state
            navList.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        }
    });
}

function updateTaskBadge() {
    const badge = document.getElementById('nav-tasks-badge');
    if (!badge) return;
    
    const tasks = store.get('tasks');
    const overdue = tasks.filter(t => 
        t.deadline && new Date(t.deadline) < new Date() && 
        !['done', 'cancelled'].includes(t.status)
    ).length;
    
    if (overdue > 0) {
        badge.textContent = overdue;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// ============================================================
// SIDEBAR TOGGLE
// ============================================================

function toggleSidebar() {
    const collapsed = !store.get('sidebarCollapsed');
    store.set({ sidebarCollapsed: collapsed });
    updateSidebarState();
}

function updateSidebarState() {
    const sidebar = document.getElementById('sidebar');
    const mainWrapper = document.getElementById('main-wrapper');
    const collapsed = store.get('sidebarCollapsed');
    
    if (sidebar) sidebar.classList.toggle('collapsed', collapsed);
    if (mainWrapper) mainWrapper.classList.toggle('sidebar-collapsed', collapsed);
    
    const toggleIcon = sidebar?.querySelector('#sidebar-toggle i[data-lucide]');
    if (toggleIcon) {
        const newIcon = collapsed ? 'panel-left-open' : 'panel-left-close';
        toggleIcon.setAttribute('data-lucide', newIcon);
        if (window.lucide) lucide.createIcons({ nodes: [toggleIcon.parentElement] });
    }
}

/**
 * Toggle mobile sidebar
 */
export function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const isOpen = store.get('sidebarMobileOpen');
    
    store.set({ sidebarMobileOpen: !isOpen });
    sidebar?.classList.toggle('mobile-open', !isOpen);
    overlay?.classList.toggle('show', !isOpen);
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    store.set({ sidebarMobileOpen: false });
    sidebar?.classList.remove('mobile-open');
    overlay?.classList.remove('show');
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
