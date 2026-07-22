/**
 * EEPROM Humas Management System
 * Task Management Page
 */

import { fetchTasks, createTask, updateTask, deleteTask, updateTaskStatus, submitTransferRequest, markTaskDoneWithProof } from '../api/tasks.js';
import { fetchPrograms } from '../api/programs.js';
import { store, hasPermission } from '../store.js';
import { TASK_STATUS, TASK_PRIORITY } from '../config.js';
import { toast, confirmDelete, showModal, formatDate, formatRelativeTime, debounce, searchFilter, fieldFilter, createPagination, serializeForm, setButtonLoading, copyToClipboard, exportCSV } from '../utils.js';
import { fetchMembers } from '../auth.js';

let allTasks = [];
let filters = { status: 'all', priority: 'all', program: 'all', search: '' };
let currentPage = 1;
const PAGE_SIZE = 10;
let viewMode = 'list'; // 'list' | 'kanban'

export async function render(container) {
    container.innerHTML = getSkeletonHTML();
    
    const [tasksResult, programsResult] = await Promise.all([
        fetchTasks(),
        fetchPrograms(),
    ]);
    
    allTasks = tasksResult.data || [];
    const programs = programsResult.data || [];
    
    container.innerHTML = getPageHTML(programs);
    
    if (window.lucide) lucide.createIcons({ nodes: [container] });
    
    renderTaskList();
    setupEvents(programs);
}

// ============================================================
// HTML TEMPLATE
// ============================================================

function getPageHTML(programs) {
    const stats = getQuickStats(allTasks);
    
    return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Task Management</h1>
                <p class="page-subtitle">Kelola seluruh tugas dan progress divisi Humas</p>
            </div>
            <div class="page-actions">
                ${hasPermission('tasks', 'create') ? `
                    <button class="btn btn-primary" id="add-task-btn">
                        <i data-lucide="plus"></i> Tambah Task
                    </button>
                ` : ''}
                <button class="btn btn-outline" id="export-task-btn">
                    <i data-lucide="download"></i> Export
                </button>
            </div>
        </div>
        
        <!-- Quick Stats -->
        <div class="task-stats-row">
            ${Object.entries(TASK_STATUS).map(([key, conf]) => `
                <button class="task-stat-pill ${filters.status === key ? 'active' : ''}" data-filter-status="${key}">
                    <i data-lucide="${conf.icon}"></i>
                    <span>${conf.label}</span>
                    <strong>${stats[key] || 0}</strong>
                </button>
            `).join('')}
        </div>
        
        <!-- Toolbar -->
        <div class="toolbar">
            <div class="toolbar-left">
                <div class="search-input-wrapper">
                    <i data-lucide="search"></i>
                    <input type="text" placeholder="Cari task..." id="task-search-input">
                </div>
                <select class="select-input" id="filter-priority">
                    <option value="all">Semua Prioritas</option>
                    ${Object.entries(TASK_PRIORITY).map(([k, v]) => 
                        `<option value="${k}">${v.label}</option>`
                    ).join('')}
                </select>
                <select class="select-input" id="filter-program">
                    <option value="all">Semua Program</option>
                    ${programs.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
            </div>
            <div class="toolbar-right">
                <div class="view-toggle">
                    <button class="view-btn ${viewMode === 'list' ? 'active' : ''}" id="list-view-btn" title="List View">
                        <i data-lucide="list"></i>
                    </button>
                    <button class="view-btn ${viewMode === 'kanban' ? 'active' : ''}" id="kanban-view-btn" title="Kanban View">
                        <i data-lucide="layout-dashboard"></i>
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Task Content -->
        <div id="task-content"></div>
        <div id="task-pagination"></div>
    `;
}

// ============================================================
// RENDER TASK LIST
// ============================================================

function renderTaskList() {
    const container = document.getElementById('task-content');
    const paginationContainer = document.getElementById('task-pagination');
    if (!container) return;
    
    // Apply filters
    let filtered = allTasks;
    if (filters.status !== 'all') filtered = filtered.filter(t => t.status === filters.status);
    if (filters.priority !== 'all') filtered = filtered.filter(t => t.priority === filters.priority);
    if (filters.program !== 'all') filtered = filtered.filter(t => t.program_id === filters.program);
    if (filters.search) {
        const s = filters.search.toLowerCase();
        filtered = filtered.filter(t => 
            t.title?.toLowerCase().includes(s) || t.description?.toLowerCase().includes(s)
        );
    }
    
    if (viewMode === 'kanban') {
        renderKanban(container, filtered);
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }
    
    // Group tasks by program
    const groupedTasks = {};
    filtered.forEach(task => {
        const prog = task.program_name || 'Lainnya (Tanpa Program)';
        if (!groupedTasks[prog]) groupedTasks[prog] = [];
        groupedTasks[prog].push(task);
    });

    const programGroups = Object.keys(groupedTasks).sort();
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-lucide="check-square"></i>
                <h3>Tidak ada task</h3>
                <p>${filters.search || filters.status !== 'all' ? 'Coba ubah filter pencarian' : 'Tambahkan task baru untuk memulai'}</p>
            </div>
        `;
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }
    
    let html = `
        <div class="task-list-header mb-4">
            <span class="text-muted text-sm">${filtered.length} task ditemukan</span>
        </div>
    `;

    programGroups.forEach(prog => {
        html += `
            <div class="task-group mb-6">
                <h3 class="task-group-title" style="margin-bottom: 1rem; font-size: 1.1rem; font-weight: 600; color: var(--text-color); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i data-lucide="briefcase" style="width: 18px; height: 18px; color: var(--primary-color);"></i>
                    ${prog} <span style="font-size: 0.85rem; font-weight: normal; color: var(--text-muted); background: var(--bg-hover); padding: 2px 8px; border-radius: 12px; margin-left: 0.5rem;">${groupedTasks[prog].length} task</span>
                </h3>
                <div class="task-cards">
                    ${groupedTasks[prog].map(task => getTaskCard(task)).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    
    // Pagination (disabled because we show grouped lists now)
    if (paginationContainer) {
        paginationContainer.innerHTML = '';
    }
    
    if (window.lucide) lucide.createIcons({ nodes: [container] });
}

function getTaskCard(task) {
    const status = TASK_STATUS[task.status] || TASK_STATUS.todo;
    const priority = TASK_PRIORITY[task.priority] || TASK_PRIORITY.medium;
    const isOverdue = task.deadline && new Date(task.deadline) < new Date() && !['done', 'cancelled'].includes(task.status);
    const daysLeft = task.deadline ? Math.ceil((new Date(task.deadline) - new Date()) / 86400000) : null;
    
    return `
        <div class="task-card ${isOverdue ? 'overdue' : ''} priority-${task.priority}" data-task-id="${task.id}">
            <div class="task-card-header">
                <div class="task-card-status" style="background: ${status.bg}; color: ${status.color}">
                    <i data-lucide="${status.icon}"></i>
                    ${status.label}
                </div>
                <div class="task-card-priority" style="color: ${priority.color}">
                    <i data-lucide="${priority.icon}"></i>
                    ${priority.label}
                </div>
            </div>
            
            <div class="task-card-title">${task.title}</div>
            ${task.description ? `<div class="task-card-desc text-sm text-muted">${task.description.slice(0, 100)}${task.description.length > 100 ? '...' : ''}</div>` : ''}
            
            ${task.program_name ? `
                <div class="task-card-program">
                    <i data-lucide="briefcase"></i> ${task.program_name}
                </div>
            ` : ''}
            
            <!-- Progress -->
            <div class="task-card-progress">
                <div class="progress-bar sm">
                    <div class="progress-fill" style="width: ${task.progress || 0}%; background: ${status.color}"></div>
                </div>
                <span class="text-xs">${task.progress || 0}%</span>
            </div>
            
            <div class="task-card-footer">
                <div class="task-card-footer-top">
                    <div class="task-card-assignee">
                        ${task.assignee_name ? `
                            <div class="avatar avatar-xs" style="background: #6C63FF22; color: #6C63FF">
                                ${task.assignee_name.charAt(0)}
                            </div>
                            <span class="text-sm">${task.assignee_nickname || task.assignee_name.split(' ')[0]}</span>
                        ` : '<span class="text-sm text-muted">Unassigned</span>'}
                    </div>
                    
                    ${task.deadline ? `
                        <div class="task-deadline ${isOverdue ? 'text-danger' : daysLeft <= 3 ? 'text-warning' : 'text-muted'}">
                            <i data-lucide="clock"></i>
                            ${isOverdue ? 'Terlambat!' : daysLeft === 0 ? 'Hari ini' : daysLeft === 1 ? 'Besok' : formatDate(task.deadline, { day: 'numeric', month: 'short' })}
                        </div>
                    ` : ''}
                </div>
                
                <div class="task-card-actions">
                    ${(() => {
                        const currentUser = store.get('user');
                        if (!currentUser) return '';
                        
                        const isAdmin = currentUser.role === 'super_admin' || currentUser.role === 'ketua_humas';
                        const isOwner = task.assigned_to === currentUser.id;
                        
                        let buttons = '';
                        
                        if (isAdmin || isOwner) {
                            buttons += `
                                <button class="btn btn-ghost btn-sm" title="Ubah Status" data-action="status" data-id="${task.id}" data-status="${task.status}">
                                    <i data-lucide="refresh-cw"></i> Status
                                </button>
                            `;
                        }
                        
                        if (isAdmin) {
                            buttons += `
                                <button class="btn btn-ghost btn-sm" title="Edit" data-action="edit" data-id="${task.id}">
                                    <i data-lucide="edit"></i> Edit
                                </button>
                                <button class="btn btn-ghost btn-sm text-danger" title="Hapus" data-action="delete" data-id="${task.id}" data-title="${task.title}">
                                    <i data-lucide="trash-2"></i> Hapus
                                </button>
                            `;
                        }
                        
                        if (!isAdmin && !isOwner) {
                            buttons += `
                                <button class="btn btn-ghost btn-sm" title="Ajukan Pergantian Tugas" data-action="transfer_request" data-id="${task.id}" data-owner="${task.assigned_to}">
                                    <i data-lucide="user-plus"></i> Ambil Alih
                                </button>
                            `;
                        }
                        
                        return buttons;
                    })()}
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// KANBAN VIEW
// ============================================================

function renderKanban(container, tasks) {
    const columns = ['todo', 'in_progress', 'review', 'done'];
    
    container.innerHTML = `
        <div class="kanban-board">
            ${columns.map(status => {
                const conf = TASK_STATUS[status];
                const colTasks = tasks.filter(t => t.status === status);
                return `
                    <div class="kanban-column" data-status="${status}">
                        <div class="kanban-col-header" style="color: ${conf.color}">
                            <div class="kanban-col-title">
                                <i data-lucide="${conf.icon}"></i>
                                ${conf.label}
                            </div>
                            <span class="kanban-count">${colTasks.length}</span>
                        </div>
                        <div class="kanban-cards" id="kanban-${status}">
                            ${colTasks.length === 0 
                                ? `<div class="kanban-empty">Tidak ada task</div>`
                                : colTasks.map(t => getKanbanCard(t)).join('')
                            }
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    if (window.lucide) lucide.createIcons({ nodes: [container] });
}

function getKanbanCard(task) {
    const priority = TASK_PRIORITY[task.priority] || TASK_PRIORITY.medium;
    
    return `
        <div class="kanban-card" data-task-id="${task.id}">
            <div class="kanban-card-priority" style="background: ${priority.color}"></div>
            <div class="kanban-card-title">${task.title}</div>
            ${task.assignee_name ? `<div class="kanban-assignee text-xs text-muted"><i data-lucide="user"></i> ${task.assignee_name}</div>` : ''}
            ${task.deadline ? `<div class="kanban-deadline text-xs"><i data-lucide="clock"></i> ${formatDate(task.deadline, { day: 'numeric', month: 'short' })}</div>` : ''}
            <div class="kanban-card-actions">
                ${(() => {
                    const currentUser = store.get('user');
                    if (!currentUser) return '';
                    
                    const isAdmin = currentUser.role === 'super_admin' || currentUser.role === 'ketua_humas';
                    const isOwner = task.assigned_to === currentUser.id;
                    
                    let buttons = '';
                    
                    if (isAdmin) {
                        buttons += `
                            <button class="btn-icon btn-xs" data-action="edit" data-id="${task.id}" title="Edit"><i data-lucide="edit"></i></button>
                            <button class="btn-icon btn-xs text-danger" data-action="delete" data-id="${task.id}" data-title="${task.title}" title="Hapus"><i data-lucide="trash-2"></i></button>
                        `;
                    } else if (!isOwner) {
                        buttons += `
                            <button class="btn-icon btn-xs" data-action="transfer_request" data-id="${task.id}" data-owner="${task.assigned_to}" title="Ambil Alih"><i data-lucide="user-plus"></i></button>
                        `;
                    }
                    
                    return buttons;
                })()}
            </div>
        </div>
    `;
}

// ============================================================
// TASK FORM MODAL
// ============================================================

async function showTaskForm(task = null, programs = []) {
    const isEdit = !!task;
    const { data: membersList } = await fetchMembers();
    const members = membersList || [];
    
    const formHTML = `
        <form id="task-form" class="form">
            <div class="form-grid">
                <div class="form-group span-2">
                    <label>Judul Task *</label>
                    <input type="text" name="title" class="form-input" placeholder="Judul task..." value="${task?.title || ''}" required>
                </div>
                <div class="form-group span-2">
                    <label>Deskripsi</label>
                    <textarea name="description" class="form-input" rows="3" placeholder="Deskripsi task...">${task?.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Program</label>
                    <select name="program_id" class="form-input">
                        <option value="">Tidak terkait program</option>
                        ${programs.map(p => `<option value="${p.id}" ${task?.program_id === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Kategori</label>
                    <input type="text" name="category" class="form-input" placeholder="e.g. Desain, Publikasi..." value="${task?.category || ''}">
                </div>
                <div class="form-group">
                    <label>Prioritas *</label>
                    <select name="priority" class="form-input" required>
                        ${Object.entries(TASK_PRIORITY).map(([k, v]) => 
                            `<option value="${k}" ${(task?.priority || 'medium') === k ? 'selected' : ''}>${v.label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Status *</label>
                    <select name="status" class="form-input" required>
                        ${Object.entries(TASK_STATUS).filter(([k]) => k !== 'cancelled').map(([k, v]) => 
                            `<option value="${k}" ${(task?.status || 'todo') === k ? 'selected' : ''}>${v.label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>PIC / Assignee</label>
                    <select name="assigned_to" class="form-input">
                        <option value="">Pilih Assignee</option>
                        ${members.map(m => `<option value="${m.id}" ${task?.assigned_to === m.id ? 'selected' : ''}>${m.full_name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Deadline</label>
                    <input type="datetime-local" name="deadline" class="form-input" value="${task?.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : ''}">
                </div>
                <div class="form-group span-2">
                    <label>Progress (%)</label>
                    <div class="range-wrapper">
                        <input type="range" name="progress" min="0" max="100" step="5" value="${task?.progress || 0}" id="progress-range">
                        <span id="progress-display">${task?.progress || 0}%</span>
                    </div>
                </div>
            </div>
        </form>
    `;
    
    const { close } = showModal({
        title: isEdit ? 'Edit Task' : 'Tambah Task Baru',
        content: formHTML,
        size: 'lg',
        confirmText: isEdit ? 'Simpan Perubahan' : 'Tambah Task',
        onConfirm: async () => {
            const form = document.getElementById('task-form');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);
            
            if (!data.title.trim()) {
                toast.warning('Judul task tidak boleh kosong');
                return;
            }
            
            if (isEdit) {
                const { error } = await updateTask(task.id, data);
                if (error) { toast.error('Gagal mengupdate task'); return; }
                toast.success('Task berhasil diupdate!');
            } else {
                const { error } = await createTask(data);
                if (error) { toast.error('Gagal menambah task'); return; }
                toast.success('Task berhasil ditambahkan!');
            }
            
            allTasks = store.get('tasks');
            renderTaskList();
        },
    });
    
    // Progress range listener
    setTimeout(() => {
        const range = document.getElementById('progress-range');
        const display = document.getElementById('progress-display');
        range?.addEventListener('input', () => {
            if (display) display.textContent = range.value + '%';
        });
    }, 100);
}

// ============================================================
// EVENT SETUP
// ============================================================

function setupEvents(programs) {
    // Add task button
    document.getElementById('add-task-btn')?.addEventListener('click', async () => {
        await showTaskForm(null, programs);
    });
    
    // Export
    document.getElementById('export-task-btn')?.addEventListener('click', () => {
        const exportData = allTasks.map(t => ({
            'Judul': t.title,
            'Status': TASK_STATUS[t.status]?.label || t.status,
            'Prioritas': TASK_PRIORITY[t.priority]?.label || t.priority,
            'Program': t.program_name || '-',
            'PIC': t.assignee_name || '-',
            'Deadline': t.deadline ? formatDate(t.deadline) : '-',
            'Progress': `${t.progress || 0}%`,
        }));
        exportCSV(exportData, 'tasks-eeprom.csv');
    });
    
    // Search
    document.getElementById('task-search-input')?.addEventListener('input', debounce((e) => {
        filters.search = e.target.value;
        currentPage = 1;
        renderTaskList();
    }, 300));
    
    // Filters
    document.getElementById('filter-priority')?.addEventListener('change', (e) => {
        filters.priority = e.target.value;
        currentPage = 1;
        renderTaskList();
    });
    
    document.getElementById('filter-program')?.addEventListener('change', (e) => {
        filters.program = e.target.value;
        currentPage = 1;
        renderTaskList();
    });
    
    // Status filter pills
    document.querySelectorAll('[data-filter-status]').forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.dataset.filterStatus;
            filters.status = filters.status === status ? 'all' : status;
            currentPage = 1;
            document.querySelectorAll('[data-filter-status]').forEach(b => b.classList.remove('active'));
            if (filters.status !== 'all') btn.classList.add('active');
            renderTaskList();
        });
    });
    
    // View toggle
    document.getElementById('list-view-btn')?.addEventListener('click', () => {
        viewMode = 'list';
        document.getElementById('list-view-btn').classList.add('active');
        document.getElementById('kanban-view-btn').classList.remove('active');
        renderTaskList();
    });
    
    document.getElementById('kanban-view-btn')?.addEventListener('click', () => {
        viewMode = 'kanban';
        document.getElementById('kanban-view-btn').classList.add('active');
        document.getElementById('list-view-btn').classList.remove('active');
        renderTaskList();
    });
    
    // Task card action events — delegated ONCE on #task-content
    const taskContent = document.getElementById('task-content');
    if (taskContent) {
        taskContent.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            const task = allTasks.find(t => t.id === id);
            
            if (action === 'edit' && task) {
                const { data: programs } = await fetchPrograms();
                await showTaskForm(task, programs);
            }
            
            if (action === 'delete') {
                const title = btn.dataset.title || 'task ini';
                confirmDelete(title, async () => {
                    const { error } = await deleteTask(id);
                    if (error) {
                        toast.error('Gagal menghapus task');
                    } else {
                        toast.success('Task berhasil dihapus');
                        allTasks = store.get('tasks');
                        renderTaskList();
                    }
                });
            }
            
            if (action === 'status' && task) {
                // Task Done tidak bisa diubah kembali
                if (task.status === 'done') {
                    toast.warning('Task sudah selesai dan tidak dapat diubah kembali.');
                    return;
                }
                
                const statuses = ['todo', 'in_progress', 'review', 'done'];
                const currentIdx = statuses.indexOf(task.status);
                const nextStatus = statuses[(currentIdx + 1) % statuses.length];
                
                // Jika next status adalah DONE → wajib upload bukti foto
                if (nextStatus === 'done') {
                    showTaskProofModal(task, async (file) => {
                        if (!file) {
                            toast.warning('Bukti foto wajib diunggah untuk menyelesaikan task.');
                            return;
                        }
                        const { error } = await markTaskDoneWithProof(task.id, file);
                        if (error) {
                            toast.error('Gagal menyelesaikan task');
                        } else {
                            toast.success('Task berhasil diselesaikan! 🎉');
                            allTasks = store.get('tasks');
                            renderTaskList();
                        }
                    });
                    return;
                }
                
                const { error } = await updateTaskStatus(id, nextStatus);
                if (error) {
                    toast.error('Gagal mengubah status');
                } else {
                    toast.success(`Status diubah ke ${TASK_STATUS[nextStatus].label}`);
                    allTasks = store.get('tasks');
                    renderTaskList();
                }
            }
            
            if (action === 'transfer_request' && task) {
                const formHTML = `
                    <div class="form-group">
                        <p class="text-muted" style="margin-bottom:0.75rem">
                            Mengajukan alih tugas untuk: <strong>${task.title}</strong><br>
                            Pemilik: <strong>${task.assignee_name || 'Tidak diketahui'}</strong>
                        </p>
                        <label>Alasan Pengambilalihan Tugas *</label>
                        <textarea id="transfer-reason" class="form-input" rows="3" placeholder="Jelaskan alasan mengapa Anda ingin mengambil alih task ini..." required></textarea>
                        <p class="text-xs text-muted mt-2">Request ini akan dikirimkan ke pemilik task saat ini untuk disetujui.</p>
                    </div>
                `;
                
                showModal({
                    title: 'Ajukan Pergantian Tugas',
                    content: formHTML,
                    confirmText: 'Ajukan Request',
                    onConfirm: async () => {
                        const reason = document.getElementById('transfer-reason').value;
                        if (!reason.trim()) {
                            toast.warning('Alasan tidak boleh kosong');
                            return false; // Jangan tutup modal
                        }
                        
                        const { error } = await submitTransferRequest(id, btn.dataset.owner, reason);
                        if (error) {
                            toast.error('Gagal mengajukan pergantian tugas: ' + (error.message || error));
                        } else {
                            toast.success('Request berhasil diajukan! Menunggu persetujuan owner.');
                        }
                    }
                });
            }
        });
    }
}

// ============================================================
// PROOF MODAL — Upload bukti foto saat task Done
// ============================================================

function showTaskProofModal(task, onConfirm) {
    document.getElementById('task-proof-modal')?.remove();
    
    const modal = document.createElement('div');
    modal.id = 'task-proof-modal';
    modal.className = 'modal-overlay proof-modal-overlay';
    modal.innerHTML = `
        <div class="modal proof-modal">
            <div class="modal-header">
                <h3 class="modal-title"><i data-lucide="camera"></i> Upload Bukti Penyelesaian</h3>
                <button class="btn-icon" id="tpm-close"><i data-lucide="x"></i></button>
            </div>
            <div class="modal-body">
                <div class="proof-task-info">
                    <i data-lucide="check-square" style="color:#10B981"></i>
                    <span>Menyelesaikan: <strong>${task.title}</strong></span>
                </div>
                <p class="text-muted" style="margin: 0.75rem 0 1rem">
                    Unggah foto/screenshot sebagai bukti bahwa task ini telah diselesaikan.
                    Setelah dikonfirmasi, <strong>status tidak bisa dikembalikan.</strong>
                </p>
                <div class="proof-upload-area" id="tpm-upload-area">
                    <input type="file" id="tpm-file-input" accept="image/*" style="display:none">
                    <div class="proof-upload-placeholder" id="tpm-placeholder">
                        <i data-lucide="upload-cloud"></i>
                        <p>Klik atau drag &amp; drop foto di sini</p>
                        <span class="text-xs text-muted">JPG, PNG, WEBP — maks. 2MB</span>
                    </div>
                    <div class="proof-preview" id="tpm-preview" style="display:none">
                        <img id="tpm-preview-img" src="" alt="Preview bukti">
                        <button class="proof-remove-btn" id="tpm-remove" title="Hapus foto">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" id="tpm-cancel">Batal</button>
                <button class="btn btn-success" id="tpm-confirm" disabled>
                    <i data-lucide="check-circle"></i> Selesaikan Task
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    if (window.lucide) lucide.createIcons({ nodes: [modal] });
    requestAnimationFrame(() => modal.classList.add('modal-open'));
    
    let selectedFile = null;
    
    const fileInput  = modal.querySelector('#tpm-file-input');
    const uploadArea = modal.querySelector('#tpm-upload-area');
    const placeholder= modal.querySelector('#tpm-placeholder');
    const preview    = modal.querySelector('#tpm-preview');
    const previewImg = modal.querySelector('#tpm-preview-img');
    const confirmBtn = modal.querySelector('#tpm-confirm');
    
    function setFile(file) {
        if (!file.type.startsWith('image/')) { 
            toast.warning('File harus berupa gambar (JPG/PNG/WEBP)'); 
            return; 
        }
        if (file.size > 2 * 1024 * 1024) { 
            toast.warning('Ukuran file maksimal 2MB'); 
            return; 
        }
        selectedFile = file;
        previewImg.src = URL.createObjectURL(file);
        placeholder.style.display = 'none';
        preview.style.display = 'block';
        confirmBtn.disabled = false;
    }
    
    uploadArea.addEventListener('click', (e) => { 
        if (!e.target.closest('#tpm-remove')) fileInput.click(); 
    });
    uploadArea.addEventListener('dragover',  (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
    uploadArea.addEventListener('dragleave', ()  => uploadArea.classList.remove('drag-over'));
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault(); uploadArea.classList.remove('drag-over');
        const f = e.dataTransfer.files[0]; if (f) setFile(f);
    });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });
    
    modal.querySelector('#tpm-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFile = null; fileInput.value = ''; previewImg.src = '';
        placeholder.style.display = 'flex'; preview.style.display = 'none';
        confirmBtn.disabled = true;
    });
    
    function closeModal() { modal.classList.remove('modal-open'); setTimeout(() => modal.remove(), 300); }
    
    modal.querySelector('#tpm-close').addEventListener('click', closeModal);
    modal.querySelector('#tpm-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    
    confirmBtn.addEventListener('click', async () => {
        if (!selectedFile) return;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i data-lucide="loader"></i> Menyimpan...';
        if (window.lucide) lucide.createIcons({ nodes: [confirmBtn] });
        closeModal();
        await onConfirm(selectedFile);
    });
}

function getQuickStats(tasks) {
    return {
        todo: tasks.filter(t => t.status === 'todo').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        review: tasks.filter(t => t.status === 'review').length,
        done: tasks.filter(t => t.status === 'done').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length,
    };
}

function getSkeletonHTML() {
    return `
        <div class="page-header skeleton h-20"></div>
        <div class="task-stats-row">${[1,2,3,4,5].map(() => `<div class="skeleton h-12 w-24 rounded-full"></div>`).join('')}</div>
        <div class="task-cards mt-4">${[1,2,3,4,5,6].map(() => `<div class="card skeleton h-40"></div>`).join('')}</div>
    `;
}
