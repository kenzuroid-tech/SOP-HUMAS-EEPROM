/**
 * EEPROM Humas Management System
 * Client-side Router
 * 
 * SPA routing tanpa framework
 */

import { store } from './store.js';
import { showLoading, hideLoading } from './utils.js';
import { checkSession } from './auth.js';
import { renderSidebar } from './components/sidebar.js';
import { renderHeader } from './components/header.js';

// ============================================================
// ROUTE DEFINITIONS
// ============================================================

const routes = {
    '/dashboard':               () => import('./pages/dashboard.js'),
    '/programs':                () => import('./pages/programs.js'),
    '/programs/:code':          () => import('./pages/programDetail.js'),
    '/timeline':                () => import('./pages/timeline.js'),
    '/tasks':                   () => import('./pages/tasks.js'),
    '/templates':               () => import('./pages/templates.js'),
    '/database':                () => import('./pages/database.js'),
    '/documents':               () => import('./pages/documents.js'),
    '/evaluations':             () => import('./pages/evaluations.js'),
    '/settings':                () => import('./pages/settings.js'),
};

// ============================================================
// ROUTER STATE
// ============================================================

let currentRoute = null;
let currentModule = null;
let mainContent = null;

// ============================================================
// ROUTER CORE
// ============================================================

/**
 * Initialize the router
 */
export async function initRouter() {
    mainContent = document.getElementById('main-content');
    if (!mainContent) {
        console.error('Router: #main-content element not found');
        return;
    }
    
    // Handle browser back/forward
    window.addEventListener('popstate', () => navigate(window.location.hash.slice(1) || '/dashboard', false));
    
    // Handle all link clicks with data-route
    document.addEventListener('click', (e) => {
        const link = e.target.closest('[data-route]');
        if (link) {
            e.preventDefault();
            navigate(link.dataset.route);
        }
    });
    
    // Navigate to current hash or default
    const hash = window.location.hash.slice(1) || '/dashboard';
    await navigate(hash, false);
}

/**
 * Navigate to a route
 * @param {string} path - Route path (e.g., '/dashboard', '/programs/open_rec')
 * @param {boolean} pushState - Whether to push to browser history
 */
export async function navigate(path, pushState = true) {
    // Check authentication
    const isAuth = store.get('isAuthenticated');
    if (!isAuth) {
        window.location.href = './index.html';
        return;
    }
    
    // Find matching route
    const { route, params } = matchRoute(path);
    if (!route) {
        console.warn(`Route not found: ${path}`);
        await navigate('/dashboard', false);
        return;
    }
    
    // Skip if same route (unless forced)
    if (currentRoute === path) return;
    currentRoute = path;
    
    // Update browser history
    if (pushState) {
        window.history.pushState({ path }, '', `#${path}`);
    }
    
    // Update sidebar active state
    updateSidebarActive(path);
    
    // Update page title
    updatePageTitle(path);
    
    // Load and render page
    showLoading();
    
    try {
        // Transition out
        if (mainContent.children.length > 0) {
            mainContent.classList.add('page-exit');
            await sleep(200);
        }
        
        // Load module
        const loader = routes[route];
        const module = await loader();
        currentModule = module;
        
        // Clear and render
        mainContent.innerHTML = '';
        mainContent.classList.remove('page-exit');
        
        // Call module's render function
        if (typeof module.render === 'function') {
            await module.render(mainContent, params);
        }
        
        // Animate in
        mainContent.classList.add('page-enter');
        requestAnimationFrame(() => {
            mainContent.classList.remove('page-enter');
            mainContent.classList.add('page-active');
        });
        
        // Init Lucide icons for new content
        if (window.lucide) {
            lucide.createIcons({ nodes: [mainContent] });
        }
        
        // Scroll to top
        mainContent.scrollTop = 0;
        
        // Store current page
        store.set({ currentPage: path.split('/')[1] || 'dashboard' });
        
    } catch (error) {
        console.error(`Route error for "${path}":`, error);
        mainContent.innerHTML = `
            <div class="error-page">
                <i data-lucide="alert-circle"></i>
                <h2>Terjadi Kesalahan</h2>
                <p>${error.message}</p>
                <button class="btn btn-primary" onclick="navigate('/dashboard')">
                    Kembali ke Dashboard
                </button>
            </div>
        `;
        if (window.lucide) lucide.createIcons({ nodes: [mainContent] });
    } finally {
        hideLoading();
    }
}

/**
 * Match path against route patterns
 */
function matchRoute(path) {
    // Exact match first
    if (routes[path]) {
        return { route: path, params: {} };
    }
    
    // Pattern matching (e.g., /programs/:code)
    for (const route of Object.keys(routes)) {
        if (!route.includes(':')) continue;
        
        const routeParts = route.split('/');
        const pathParts = path.split('/');
        
        if (routeParts.length !== pathParts.length) continue;
        
        const params = {};
        const match = routeParts.every((part, i) => {
            if (part.startsWith(':')) {
                params[part.slice(1)] = pathParts[i];
                return true;
            }
            return part === pathParts[i];
        });
        
        if (match) return { route, params };
    }
    
    return { route: null, params: {} };
}

/**
 * Update sidebar active link
 */
function updateSidebarActive(path) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        const linkPath = link.dataset.route;
        if (linkPath === path || (path.startsWith(linkPath) && linkPath !== '/')) {
            link.classList.add('active');
        }
    });
}

/**
 * Update page title
 */
function updatePageTitle(path) {
    const titles = {
        '/dashboard': 'Dashboard',
        '/programs': 'Program Kerja',
        '/timeline': 'Timeline',
        '/tasks': 'Task Management',
        '/templates': 'Template',
        '/database': 'Database',
        '/documents': 'Dokumentasi',
        '/evaluations': 'Evaluasi',
        '/settings': 'Setting',
    };
    
    const segment = '/' + path.split('/')[1];
    const title = titles[segment] || 'EEPROM Humas';
    document.title = `${title} — EEPROM Humas`;
    
    // Update header breadcrumb if exists
    const breadcrumb = document.getElementById('page-title');
    if (breadcrumb) breadcrumb.textContent = title;
}

/**
 * Go back in history
 */
export function goBack() {
    window.history.back();
}

/**
 * Refresh current page
 */
export async function refreshCurrentPage() {
    if (currentModule && typeof currentModule.refresh === 'function') {
        await currentModule.refresh();
    } else {
        await navigate(currentRoute, false);
    }
}

// ============================================================
// HELPER
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Make navigate globally accessible
window.navigate = navigate;
