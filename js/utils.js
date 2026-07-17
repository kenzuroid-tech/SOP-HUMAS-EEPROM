/**
 * EEPROM Humas Management System
 * Utility Functions
 * 
 * Helpers: toast, modal, formatting, DOM, export, etc.
 */

import { APP_CONFIG } from './config.js';

// ============================================================
// DATE & TIME UTILITIES
// ============================================================

/**
 * Format date to Indonesian locale string
 * @param {string|Date} date
 * @param {Object} options - Intl.DateTimeFormat options
 */
export function formatDate(date, options = {}) {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d)) return '-';
    const defaultOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    return d.toLocaleDateString('id-ID', { ...defaultOptions, ...options });
}

/**
 * Format datetime to Indonesian locale
 */
export function formatDateTime(date, options = {}) {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d)) return '-';
    const defaultOptions = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return d.toLocaleString('id-ID', { ...defaultOptions, ...options });
}

/**
 * Format relative time (e.g., "2 jam lalu", "besok")
 */
export function formatRelativeTime(date) {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d)) return '-';
    const now = new Date();
    const diff = now - d;
    const diffAbs = Math.abs(diff);
    const isFuture = diff < 0;

    const minutes = Math.floor(diffAbs / 60000);
    const hours = Math.floor(diffAbs / 3600000);
    const days = Math.floor(diffAbs / 86400000);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    const prefix = isFuture ? 'dalam ' : '';
    const suffix = isFuture ? '' : ' lalu';

    if (minutes < 1) return 'baru saja';
    if (minutes < 60) return `${prefix}${minutes} menit${suffix}`;
    if (hours < 24) return `${prefix}${hours} jam${suffix}`;
    if (days === 1) return isFuture ? 'besok' : 'kemarin';
    if (days < 7) return `${prefix}${days} hari${suffix}`;
    if (weeks < 4) return `${prefix}${weeks} minggu${suffix}`;
    return `${prefix}${months} bulan${suffix}`;
}

/**
 * Get days until deadline
 */
export function getDaysUntil(date) {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    return Math.ceil((d - now) / 86400000);
}

/**
 * Check if date is overdue
 */
export function isOverdue(date) {
    if (!date) return false;
    return new Date(date) < new Date();
}

/**
 * Format file size
 */
export function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

// ============================================================
// STRING UTILITIES
// ============================================================

/**
 * Truncate text with ellipsis
 */
export function truncate(str, maxLength = 50) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert snake_case to Title Case
 */
export function snakeToTitle(str) {
    if (!str) return '';
    return str.split('_').map(capitalize).join(' ');
}

/**
 * Get user initials from name
 */
export function getInitials(name) {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

/**
 * Generate random color from string (deterministic)
 */
export function stringToColor(str) {
    const colors = ['#6C63FF', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#F97316', '#84CC16'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

/**
 * Slugify string
 */
export function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ============================================================
// DOM UTILITIES
// ============================================================

/**
 * Query selector shorthand
 */
export const $ = (selector, parent = document) => parent.querySelector(selector);
export const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

/**
 * Create element with attributes and children
 */
export function createElement(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, val]) => {
        if (key === 'class') el.className = val;
        else if (key === 'style' && typeof val === 'object') Object.assign(el.style, val);
        else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), val);
        else if (key === 'html') el.innerHTML = val;
        else el.setAttribute(key, val);
    });
    children.flat().forEach(child => {
        if (typeof child === 'string') el.appendChild(document.createTextNode(child));
        else if (child instanceof Node) el.appendChild(child);
    });
    return el;
}

/**
 * Add/remove loading state to button
 */
export function setButtonLoading(btn, loading = true) {
    if (!btn) return;
    if (loading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-sm"></span> Loading...';
        btn.disabled = true;
    } else {
        btn.innerHTML = btn.dataset.originalText || 'Submit';
        btn.disabled = false;
    }
}

/**
 * Smooth scroll to element
 */
export function scrollTo(selector) {
    const el = document.querySelector(selector);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
    }
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

let toastContainer = null;

function getToastContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

/**
 * Show toast notification
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {number} duration
 */
export function showToast(message, type = 'info', duration = APP_CONFIG.toastDuration) {
    const container = getToastContainer();
    const id = `toast-${Date.now()}`;
    
    const icons = {
        success: 'check-circle',
        error: 'x-circle',
        warning: 'alert-triangle',
        info: 'info',
    };
    
    const toast = document.createElement('div');
    toast.id = id;
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i data-lucide="${icons[type]}"></i>
        </div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" onclick="document.getElementById('${id}').remove()">
            <i data-lucide="x"></i>
        </button>
        <div class="toast-progress"></div>
    `;
    
    container.appendChild(toast);
    
    // Trigger Lucide icons render
    if (window.lucide) lucide.createIcons({ nodes: [toast] });
    
    // Animate in
    requestAnimationFrame(() => toast.classList.add('toast-show'));
    
    // Progress bar
    const progress = toast.querySelector('.toast-progress');
    if (progress) {
        progress.style.animationDuration = `${duration}ms`;
        progress.classList.add('toast-progress-animate');
    }
    
    // Auto remove
    const timer = setTimeout(() => {
        toast.classList.remove('toast-show');
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, duration);
    
    toast.querySelector('.toast-close')?.addEventListener('click', () => {
        clearTimeout(timer);
    });
    
    return id;
}

// Convenience methods
export const toast = {
    success: (msg, dur) => showToast(msg, 'success', dur),
    error: (msg, dur) => showToast(msg, 'error', dur),
    warning: (msg, dur) => showToast(msg, 'warning', dur),
    info: (msg, dur) => showToast(msg, 'info', dur),
};

// ============================================================
// MODAL SYSTEM
// ============================================================

let modalStack = [];

/**
 * Show modal
 * @param {Object} options - { title, content, size, onConfirm, onCancel, confirmText, cancelText, confirmClass }
 */
export function showModal(options = {}) {
    const {
        id = `modal-${Date.now()}`,
        title = 'Modal',
        content = '',
        size = 'md',
        onConfirm = null,
        onCancel = null,
        confirmText = 'Simpan',
        cancelText = 'Batal',
        confirmClass = 'btn-primary',
        showFooter = true,
        closeOnBackdrop = true,
    } = options;
    
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = `modal-overlay`;
    modal.innerHTML = `
        <div class="modal modal-${size}">
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                <button class="modal-close btn-icon" data-modal-close>
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="modal-body">
                ${typeof content === 'string' ? content : ''}
            </div>
            ${showFooter ? `
            <div class="modal-footer">
                <button class="btn btn-ghost" data-modal-cancel>${cancelText}</button>
                <button class="btn ${confirmClass}" data-modal-confirm>${confirmText}</button>
            </div>` : ''}
        </div>
    `;
    
    // Append content node if not string
    if (content instanceof Node) {
        modal.querySelector('.modal-body').appendChild(content);
    }
    
    document.body.appendChild(modal);
    modalStack.push(id);
    
    // Init Lucide icons
    if (window.lucide) lucide.createIcons({ nodes: [modal] });
    
    // Animate in
    requestAnimationFrame(() => modal.classList.add('modal-open'));
    
    // Event listeners
    const closeModal = () => {
        modal.classList.remove('modal-open');
        setTimeout(() => {
            modal.remove();
            modalStack = modalStack.filter(m => m !== id);
        }, 300);
    };
    
    modal.querySelector('[data-modal-close]')?.addEventListener('click', () => {
        onCancel?.();
        closeModal();
    });
    
    modal.querySelector('[data-modal-cancel]')?.addEventListener('click', () => {
        onCancel?.();
        closeModal();
    });
    
    modal.querySelector('[data-modal-confirm]')?.addEventListener('click', () => {
        onConfirm?.();
        closeModal();
    });
    
    if (closeOnBackdrop) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                onCancel?.();
                closeModal();
            }
        });
    }
    
    // ESC key close
    const escHandler = (e) => {
        if (e.key === 'Escape' && modalStack[modalStack.length - 1] === id) {
            onCancel?.();
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    return { id, close: closeModal };
}

/**
 * Show confirmation delete dialog
 */
export function confirmDelete(itemName, onConfirm) {
    return showModal({
        title: 'Konfirmasi Hapus',
        content: `
            <div class="confirm-delete-body">
                <div class="confirm-icon danger">
                    <i data-lucide="trash-2"></i>
                </div>
                <p>Apakah kamu yakin ingin menghapus <strong>${itemName}</strong>?</p>
                <p class="text-muted text-sm">Tindakan ini tidak dapat dibatalkan.</p>
            </div>
        `,
        confirmText: 'Hapus',
        cancelText: 'Batal',
        confirmClass: 'btn-danger',
        onConfirm,
    });
}

// ============================================================
// LOADING OVERLAY
// ============================================================

let loadingOverlay = null;

export function showLoading(message = 'Memuat...') {
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loading-overlay';
        loadingOverlay.className = 'loading-overlay';
        document.body.appendChild(loadingOverlay);
    }
    loadingOverlay.innerHTML = `
        <div class="loading-content">
            <div class="spinner"></div>
            <p class="loading-text">${message}</p>
        </div>
    `;
    loadingOverlay.classList.add('loading-show');
}

export function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.remove('loading-show');
    }
}

// ============================================================
// PAGINATION
// ============================================================

/**
 * Create pagination component
 * @param {Object} options - { total, page, pageSize, onPageChange }
 */
export function createPagination({ total, page, pageSize, onPageChange }) {
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) return null;
    
    const container = document.createElement('div');
    container.className = 'pagination';
    
    const createBtn = (label, pageNum, isActive = false, isDisabled = false) => {
        const btn = document.createElement('button');
        btn.className = `page-btn${isActive ? ' active' : ''}${isDisabled ? ' disabled' : ''}`;
        btn.innerHTML = label;
        btn.disabled = isDisabled;
        if (!isDisabled && !isActive) {
            btn.addEventListener('click', () => onPageChange(pageNum));
        }
        return btn;
    };
    
    // Previous
    container.appendChild(createBtn('<i data-lucide="chevron-left"></i>', page - 1, false, page === 1));
    
    // Page numbers
    const range = getPaginationRange(page, totalPages);
    range.forEach(item => {
        if (item === '...') {
            const dots = document.createElement('span');
            dots.className = 'page-dots';
            dots.textContent = '...';
            container.appendChild(dots);
        } else {
            container.appendChild(createBtn(item, item, item === page));
        }
    });
    
    // Next
    container.appendChild(createBtn('<i data-lucide="chevron-right"></i>', page + 1, false, page === totalPages));
    
    if (window.lucide) lucide.createIcons({ nodes: [container] });
    
    return container;
}

function getPaginationRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
    if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', current - 1, current, current + 1, '...', total];
}

// ============================================================
// EXPORT UTILITIES
// ============================================================

/**
 * Export data as CSV
 */
export function exportCSV(data, filename = 'export.csv') {
    if (!data || !data.length) return toast.warning('Tidak ada data untuk diekspor');
    
    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map(row => 
            headers.map(h => {
                const val = row[h] ?? '';
                const str = String(val).replace(/"/g, '""');
                return `"${str}"`;
            }).join(',')
        )
    ];
    
    downloadBlob(csvRows.join('\n'), filename, 'text/csv;charset=utf-8;');
    toast.success('Data berhasil diekspor sebagai CSV');
}

/**
 * Export table as PDF using jsPDF
 */
export function exportPDF(title, headers, rows, filename = 'export.pdf') {
    if (!window.jspdf) {
        toast.error('Library PDF belum dimuat');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 22);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Diekspor: ${formatDateTime(new Date())}`, 14, 30);
    
    if (window.jspdf?.autoTable) {
        doc.autoTable({
            head: [headers],
            body: rows,
            startY: 38,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [108, 99, 255] },
            alternateRowStyles: { fillColor: [245, 245, 255] },
        });
    }
    
    doc.save(filename);
    toast.success('Data berhasil diekspor sebagai PDF');
}

/**
 * Print element
 */
export function printElement(elementId, title = document.title) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: 'Poppins', sans-serif; color: #1e293b; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
                th { background: #6C63FF; color: white; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>${element.innerHTML}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
}

/**
 * Download Blob as file
 */
function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================
// FORM UTILITIES
// ============================================================

/**
 * Serialize form data to object
 */
export function serializeForm(form) {
    const data = {};
    const fd = new FormData(form);
    for (const [key, val] of fd.entries()) {
        if (data[key]) {
            if (!Array.isArray(data[key])) data[key] = [data[key]];
            data[key].push(val);
        } else {
            data[key] = val;
        }
    }
    return data;
}

/**
 * Show form validation errors
 */
export function showFormErrors(form, errors) {
    // Clear previous errors
    form.querySelectorAll('.field-error').forEach(el => el.remove());
    form.querySelectorAll('.form-group.error').forEach(el => el.classList.remove('error'));
    
    Object.entries(errors).forEach(([field, message]) => {
        const input = form.querySelector(`[name="${field}"]`);
        if (input) {
            const group = input.closest('.form-group');
            if (group) {
                group.classList.add('error');
                const err = document.createElement('span');
                err.className = 'field-error';
                err.textContent = message;
                group.appendChild(err);
            }
        }
    });
}

/**
 * Clear form errors
 */
export function clearFormErrors(form) {
    form.querySelectorAll('.field-error').forEach(el => el.remove());
    form.querySelectorAll('.form-group.error').forEach(el => el.classList.remove('error'));
}

// ============================================================
// SEARCH & FILTER
// ============================================================

/**
 * Debounce function
 */
export function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

/**
 * Filter array of objects by search term
 */
export function searchFilter(items, term, fields) {
    if (!term) return items;
    const lower = term.toLowerCase();
    return items.filter(item =>
        fields.some(field => {
            const val = String(item[field] ?? '').toLowerCase();
            return val.includes(lower);
        })
    );
}

/**
 * Filter array by field values
 */
export function fieldFilter(items, filters) {
    return items.filter(item =>
        Object.entries(filters).every(([key, val]) => {
            if (!val || val === 'all') return true;
            return String(item[key]) === String(val);
        })
    );
}

// ============================================================
// AVATAR
// ============================================================

/**
 * Generate avatar element (image or initials)
 */
export function createAvatar(name, imageUrl, size = 'md') {
    const el = document.createElement('div');
    el.className = `avatar avatar-${size}`;
    
    if (imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = name;
        img.onerror = () => {
            img.remove();
            el.style.background = stringToColor(name);
            el.textContent = getInitials(name);
        };
        el.appendChild(img);
    } else {
        el.style.background = `linear-gradient(135deg, ${stringToColor(name)}, ${stringToColor(name + '2')})`;
        el.textContent = getInitials(name);
    }
    
    return el;
}

// ============================================================
// PROGRESS BAR
// ============================================================

/**
 * Get progress color based on percentage
 */
export function getProgressColor(progress) {
    if (progress >= 80) return '#10B981';
    if (progress >= 50) return '#6C63FF';
    if (progress >= 25) return '#F59E0B';
    return '#EF4444';
}

/**
 * Create animated progress bar element
 */
export function createProgressBar(progress, showLabel = true) {
    const color = getProgressColor(progress);
    const el = document.createElement('div');
    el.className = 'progress-wrapper';
    el.innerHTML = `
        ${showLabel ? `<div class="progress-label"><span>${progress}%</span></div>` : ''}
        <div class="progress-bar">
            <div class="progress-fill" style="width: 0%; background: ${color}" data-target="${progress}"></div>
        </div>
    `;
    
    // Animate after render
    requestAnimationFrame(() => {
        setTimeout(() => {
            const fill = el.querySelector('.progress-fill');
            if (fill) fill.style.width = `${progress}%`;
        }, 100);
    });
    
    return el;
}

// ============================================================
// MISC
// ============================================================

/**
 * Generate unique ID
 */
export function generateId() {
    return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Deep clone object
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Wait for milliseconds
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format currency to IDR
 */
export function formatCurrency(amount) {
    if (!amount && amount !== 0) return '-';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
}

/**
 * Validate email
 */
export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
