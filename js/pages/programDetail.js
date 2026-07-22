/**
 * EEPROM Humas Management System
 * Program Detail Page
 */

import { fetchProgramByCode, updateProgram, fetchProgramChecklist } from '../api/programs.js';
import { fetchTasks, createTask, updateTask, deleteTask, updateTaskStatus } from '../api/tasks.js';
import { fetchDocuments } from '../api/documents.js';
import { fetchEvaluationByProgram } from '../api/evaluations.js';
import { PROGRAMS, PROGRAM_STATUS, TASK_STATUS, TASK_PRIORITY } from '../config.js';
import { store, hasPermission } from '../store.js';
import { toast, confirmDelete, showModal, formatDate, formatRelativeTime, getProgressColor, createProgressBar, copyToClipboard } from '../utils.js';

let currentProgram = null;
let currentTab = 'overview';

export async function render(container, params) {
    const code = params.code?.toUpperCase();
    container.innerHTML = getSkeletonHTML();
    
    // Fetch program data
    const { data: program, error } = await fetchProgramByCode(code);
    if (error || !program) {
        container.innerHTML = `
            <div class="error-page">
                <i data-lucide="alert-circle"></i>
                <h2>Program tidak ditemukan</h2>
                <p>Program dengan kode "${code}" tidak ada.</p>
                <button class="btn btn-primary" onclick="navigate('/programs')">Kembali</button>
            </div>
        `;
        if (window.lucide) lucide.createIcons({ nodes: [container] });
        return;
    }
    
    currentProgram = program;
    const config = PROGRAMS.find(p => p.code === program.code) || {};
    const statusConf = PROGRAM_STATUS[program.status] || PROGRAM_STATUS.planning;
    const color = config.color || '#6C63FF';
    const icon = config.icon || 'briefcase';
    
    // Fetch parallel data
    const [tasksResult, docsResult, evalResult, checklistResult] = await Promise.all([
        fetchTasks({ program_id: program.id }),
        fetchDocuments({ program_id: program.id }),
        fetchEvaluationByProgram(program.id),
        fetchProgramChecklist(program.id),
    ]);
    
    const tasks = tasksResult.data || [];
    const docs = docsResult.data || [];
    const evaluation = evalResult.data;
    const checklist = checklistResult.data || [];
    
    const user = store.get('user');
    const canEditProgram = hasPermission('programs', 'edit') || user?.role === 'super_admin' || user?.role === 'ketua_humas';
    
    let calculatedProgress = 0;
    if (tasks.length > 0) {
        const doneCount = tasks.filter(t => t.status === 'done').length;
        calculatedProgress = Math.round((doneCount / tasks.length) * 100);
    }
    
    container.innerHTML = `
        <!-- Program Header -->
        <div class="program-detail-header" style="border-left: 4px solid ${color}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
                <button class="btn btn-ghost btn-sm" onclick="navigate('/programs')">
                    <i data-lucide="arrow-left"></i> Kembali
                </button>
                ${canEditProgram ? `
                    <button class="btn btn-ghost btn-sm text-primary" id="edit-program-btn" style="border:1px solid rgba(108,99,255,0.25);">
                        <i data-lucide="edit"></i> Edit Program
                    </button>
                ` : ''}
            </div>
            <div class="program-detail-title-row">
                <div class="program-icon-lg" style="background: ${color}22; color: ${color}">
                    <i data-lucide="${icon}"></i>
                </div>
                <div class="program-detail-info">
                    <h1 class="page-title">${program.name}</h1>
                    <div class="program-detail-meta">
                        <span class="badge" style="background: ${statusConf.bg}; color: ${statusConf.color}">${statusConf.label}</span>
                        ${program.start_date ? `<span><i data-lucide="calendar"></i> ${formatDate(program.start_date)} - ${formatDate(program.end_date)}</span>` : ''}
                        ${program.pic_name ? `<span><i data-lucide="user"></i> PIC: ${program.pic_name}</span>` : ''}
                    </div>
                    <p class="text-muted">${program.description || ''}</p>
                </div>
                <div class="program-detail-progress">
                    <div class="circular-progress" style="--progress: ${calculatedProgress}; --color: ${color}">
                        <div class="circular-progress-inner">
                            <span class="circular-value" style="color: ${color}">${calculatedProgress}%</span>
                            <span class="circular-label">Progress</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Quick Stats -->
        <div class="program-quick-stats">
            <div class="quick-stat">
                <i data-lucide="check-square" style="color:#10B981"></i>
                <span><strong>${tasks.filter(t => t.status === 'done').length}</strong>/${tasks.length} Task Selesai</span>
            </div>
            <div class="quick-stat">
                <i data-lucide="image" style="color:#F59E0B"></i>
                <span><strong>${docs.length}</strong> Dokumentasi</span>
            </div>
            <div class="quick-stat">
                <i data-lucide="check-circle" style="color:#6C63FF"></i>
                <span><strong>${checklist.filter(c => c.done).length}</strong>/${checklist.length} Checklist</span>
            </div>
            ${evaluation ? `
                <div class="quick-stat">
                    <i data-lucide="star" style="color:#F59E0B"></i>
                    <span>Skor Evaluasi: <strong>${evaluation.overall_score || '-'}/10</strong></span>
                </div>
            ` : ''}
        </div>
        
        <!-- Tabs -->
        <div class="tabs-wrapper">
            <div class="tabs" id="program-tabs">
                <button class="tab active" data-tab="overview">
                    <i data-lucide="layout-dashboard"></i> Overview
                </button>
                <button class="tab" data-tab="tasks">
                    <i data-lucide="check-square"></i> Task
                    <span class="tab-badge">${tasks.length}</span>
                </button>
                <button class="tab" data-tab="documents">
                    <i data-lucide="image"></i> Dokumentasi
                    <span class="tab-badge">${docs.length}</span>
                </button>
                <button class="tab" data-tab="evaluation">
                    <i data-lucide="bar-chart-2"></i> Evaluasi
                </button>
            </div>
        </div>
        
        <!-- Tab Content -->
        <div id="program-tab-content"></div>
    `;
    
    if (window.lucide) lucide.createIcons({ nodes: [container] });
    
    // Render initial tab
    renderTab('overview', { program, tasks, docs, evaluation, checklist, color });
    
    // Tab switching
    container.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            renderTab(tab.dataset.tab, { program, tasks, docs, evaluation, checklist, color });
        });
    });

    // Edit Program button listener
    document.getElementById('edit-program-btn')?.addEventListener('click', () => {
        showEditProgramForm(program);
    });
}

function renderTab(tab, data) {
    const container = document.getElementById('program-tab-content');
    if (!container) return;
    
    switch (tab) {
        case 'overview':
            container.innerHTML = renderOverviewTab(data);
            break;
        case 'tasks':
            container.innerHTML = renderTasksTab(data);
            setupTaskEvents(data);
            break;
        case 'documents':
            container.innerHTML = renderDocumentsTab(data);
            break;
        case 'evaluation':
            container.innerHTML = renderEvaluationTab(data);
            setupEvaluationEvents(data);
            break;
    }
    
    if (window.lucide) lucide.createIcons({ nodes: [container] });
}

function renderOverviewTab({ program, tasks, checklist, color }) {
    const tasksByStatus = {
        todo: tasks.filter(t => t.status === 'todo'),
        in_progress: tasks.filter(t => t.status === 'in_progress'),
        done: tasks.filter(t => t.status === 'done'),
    };
    
    return `
        <div class="tab-content">
            <div class="overview-grid">
                <!-- Checklist -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i data-lucide="check-circle"></i> Checklist Program</h3>
                        <span class="text-muted text-sm">${checklist.filter(c => c.done).length}/${checklist.length}</span>
                    </div>
                    <div class="card-body">
                        ${checklist.length === 0 
                            ? `<div class="empty-state compact"><i data-lucide="list"></i><p>Belum ada checklist</p></div>`
                            : checklist.map(item => `
                                <div class="checklist-item">
                                    <div class="checkbox ${item.done ? 'checked' : ''}" style="${item.done ? `background:${color}; border-color:${color}` : ''}">
                                        ${item.done ? '<i data-lucide="check"></i>' : ''}
                                    </div>
                                    <span class="${item.done ? 'line-through text-muted' : ''}">${item.text}</span>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
                
                <!-- Task Summary -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i data-lucide="check-square"></i> Ringkasan Task</h3>
                    </div>
                    <div class="card-body">
                        ${Object.entries(tasksByStatus).map(([status, statusTasks]) => `
                            <div class="task-status-summary">
                                <div class="task-status-label" style="color: ${TASK_STATUS[status]?.color}">
                                    <i data-lucide="${TASK_STATUS[status]?.icon}"></i>
                                    ${TASK_STATUS[status]?.label}
                                </div>
                                <div class="task-status-bar">
                                    <div class="progress-bar sm">
                                        <div class="progress-fill" style="width: ${tasks.length ? (statusTasks.length/tasks.length*100) : 0}%; background: ${TASK_STATUS[status]?.color}"></div>
                                    </div>
                                    <span class="task-status-count">${statusTasks.length}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Program Info -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i data-lucide="info"></i> Informasi Program</h3>
                    </div>
                    <div class="card-body">
                        <dl class="info-list">
                            <dt>Mulai</dt><dd>${formatDate(program.start_date)}</dd>
                            <dt>Selesai</dt><dd>${formatDate(program.end_date)}</dd>
                            <dt>PIC</dt><dd>${program.pic_name || '-'}</dd>
                            <dt>Status</dt><dd>${PROGRAM_STATUS[program.status]?.label || '-'}</dd>
                            <dt>Peserta</dt><dd>${program.actual_participants || program.expected_participants || '-'} orang</dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderTasksTab({ program, tasks }) {
    const user = store.get('user');
    const canCreate = hasPermission('tasks', 'create');
    
    return `
        <div class="tab-content">
            <div class="tab-toolbar">
                <div class="search-input-wrapper">
                    <i data-lucide="search"></i>
                    <input type="text" placeholder="Cari task..." id="task-search">
                </div>
                <select id="task-status-filter" class="select-input">
                    <option value="all">Semua Status</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                </select>
                ${canCreate ? `
                    <button class="btn btn-primary" id="add-task-btn">
                        <i data-lucide="plus"></i> Tambah Task
                    </button>
                ` : ''}
            </div>
            
            <div class="task-list" id="program-task-list">
                ${tasks.length === 0
                    ? `<div class="empty-state"><i data-lucide="check-square"></i><h3>Belum ada task</h3><p>Tambahkan task untuk program ini</p></div>`
                    : tasks.map(task => getTaskRow(task, canCreate)).join('')
                }
            </div>
        </div>
    `;
}

function getTaskRow(task, canEdit) {
    const status = TASK_STATUS[task.status] || TASK_STATUS.todo;
    const priority = TASK_PRIORITY[task.priority] || TASK_PRIORITY.medium;
    const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done';
    
    return `
        <div class="task-row ${isOverdue ? 'overdue' : ''}" data-task-id="${task.id}">
            <div class="task-row-status">
                <div class="status-dot" style="background: ${status.color}; box-shadow: 0 0 8px ${status.color}44"></div>
            </div>
            <div class="task-row-content">
                <div class="task-row-title">${task.title}</div>
                <div class="task-row-meta">
                    <span class="badge" style="background: ${priority.color}20; color: ${priority.color}">
                        <i data-lucide="${priority.icon}"></i> ${priority.label}
                    </span>
                    ${task.assignee_name ? `<span class="text-sm text-muted"><i data-lucide="user"></i> ${task.assignee_name}</span>` : ''}
                    ${task.deadline ? `
                        <span class="text-sm ${isOverdue ? 'text-danger' : 'text-muted'}">
                            <i data-lucide="clock"></i> ${formatDate(task.deadline, { day: 'numeric', month: 'short' })}
                        </span>
                    ` : ''}
                </div>
            </div>
            <div class="task-row-progress">
                <div class="progress-bar sm">
                    <div class="progress-fill" style="width: ${task.progress || 0}%; background: ${status.color}"></div>
                </div>
                <span class="text-xs text-muted">${task.progress || 0}%</span>
            </div>
            ${canEdit ? `
                <div class="task-row-actions">
                    <button class="btn-icon btn-sm" title="Edit" onclick="editTask('${task.id}')">
                        <i data-lucide="edit"></i>
                    </button>
                    <button class="btn-icon btn-sm text-danger" title="Hapus" onclick="deleteTaskItem('${task.id}', '${task.title}')">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

function renderDocumentsTab({ docs }) {
    if (docs.length === 0) {
        return `
            <div class="tab-content">
                <div class="empty-state">
                    <i data-lucide="image"></i>
                    <h3>Belum ada dokumentasi</h3>
                    <p>Upload foto kegiatan untuk program ini</p>
                    <button class="btn btn-primary" onclick="navigate('/documents')">
                        <i data-lucide="upload"></i> Upload Foto
                    </button>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="tab-content">
            <div class="gallery-grid">
                ${docs.map(doc => `
                    <div class="gallery-item" onclick="openLightbox('${doc.file_url}', '${doc.title}')">
                        <img src="${doc.thumbnail_url || doc.file_url}" alt="${doc.title}" loading="lazy">
                        <div class="gallery-overlay">
                            <div class="gallery-title">${doc.title}</div>
                            <div class="gallery-date text-sm">${formatDate(doc.event_date)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderEvaluationTab({ program, evaluation }) {
    const canEdit = hasPermission('evaluations', 'create') || hasPermission('evaluations', 'edit');
    
    if (!evaluation) {
        return `
            <div class="tab-content">
                ${canEdit ? `
                    <div class="evaluation-form-wrapper">
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title"><i data-lucide="bar-chart-2"></i> Form Evaluasi — ${program.name}</h3>
                            </div>
                            <div class="card-body">
                                ${getEvaluationForm(program, null)}
                            </div>
                        </div>
                    </div>
                ` : `
                    <div class="empty-state">
                        <i data-lucide="bar-chart-2"></i>
                        <h3>Belum ada evaluasi</h3>
                        <p>Evaluasi program belum diisi</p>
                    </div>
                `}
            </div>
        `;
    }
    
    return `
        <div class="tab-content">
            <div class="evaluation-view">
                <!-- Score Cards -->
                <div class="score-grid">
                    ${[
                        { label: 'Perencanaan', score: evaluation.score_planning, icon: 'clipboard-list' },
                        { label: 'Pelaksanaan', score: evaluation.score_execution, icon: 'play-circle' },
                        { label: 'Komunikasi', score: evaluation.score_communication, icon: 'message-circle' },
                        { label: 'Kerjasama', score: evaluation.score_teamwork, icon: 'users' },
                        { label: 'Hasil', score: evaluation.score_outcome, icon: 'target' },
                    ].map(s => `
                        <div class="score-card">
                            <div class="score-icon"><i data-lucide="${s.icon}"></i></div>
                            <div class="score-value" style="color: ${getScoreColor(s.score)}">${s.score || '-'}</div>
                            <div class="score-label text-sm text-muted">${s.label}</div>
                        </div>
                    `).join('')}
                    <div class="score-card overall">
                        <div class="score-icon"><i data-lucide="star"></i></div>
                        <div class="score-value" style="color: #F59E0B; font-size: 2rem">${evaluation.overall_score || '-'}</div>
                        <div class="score-label text-sm">Nilai Akhir</div>
                    </div>
                </div>
                
                <!-- Qualitative -->
                <div class="evaluation-sections">
                    ${[
                        { title: 'Yang Berjalan Baik', icon: 'thumbs-up', color: '#10B981', key: 'yang_berjalan_baik' },
                        { title: 'Kendala', icon: 'alert-triangle', color: '#F59E0B', key: 'kendala' },
                        { title: 'Solusi', icon: 'lightbulb', color: '#6C63FF', key: 'solusi' },
                        { title: 'Saran Tahun Depan', icon: 'arrow-right-circle', color: '#EC4899', key: 'saran_tahun_depan' },
                    ].map(section => evaluation[section.key] ? `
                        <div class="evaluation-section" style="border-left: 3px solid ${section.color}">
                            <div class="eval-section-title" style="color: ${section.color}">
                                <i data-lucide="${section.icon}"></i> ${section.title}
                            </div>
                            <div class="eval-section-content">${evaluation[section.key]}</div>
                        </div>
                    ` : '').join('')}
                </div>
                
                ${canEdit ? `
                    <button class="btn btn-outline" id="edit-eval-btn">
                        <i data-lucide="edit"></i> Edit Evaluasi
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

function getEvaluationForm(program, evaluation) {
    return `
        <form id="evaluation-form">
            <input type="hidden" name="program_id" value="${program.id}">
            
            <h4 class="form-section-title">Penilaian (1-10)</h4>
            <div class="score-input-grid">
                ${[
                    { name: 'score_planning', label: 'Perencanaan', value: evaluation?.score_planning || '' },
                    { name: 'score_execution', label: 'Pelaksanaan', value: evaluation?.score_execution || '' },
                    { name: 'score_communication', label: 'Komunikasi', value: evaluation?.score_communication || '' },
                    { name: 'score_teamwork', label: 'Kerjasama Tim', value: evaluation?.score_teamwork || '' },
                    { name: 'score_outcome', label: 'Hasil/Output', value: evaluation?.score_outcome || '' },
                ].map(s => `
                    <div class="form-group">
                        <label>${s.label}</label>
                        <input type="number" name="${s.name}" min="1" max="10" value="${s.value}" class="form-input" placeholder="1-10">
                    </div>
                `).join('')}
            </div>
            
            <h4 class="form-section-title">Evaluasi Kualitatif</h4>
            ${[
                { name: 'yang_berjalan_baik', label: 'Yang Berjalan Baik', value: evaluation?.yang_berjalan_baik || '' },
                { name: 'kendala', label: 'Kendala yang Dihadapi', value: evaluation?.kendala || '' },
                { name: 'solusi', label: 'Solusi yang Diterapkan', value: evaluation?.solusi || '' },
                { name: 'saran_tahun_depan', label: 'Saran untuk Tahun Depan', value: evaluation?.saran_tahun_depan || '' },
            ].map(f => `
                <div class="form-group">
                    <label>${f.label}</label>
                    <textarea name="${f.name}" class="form-input" rows="3" placeholder="Tuliskan evaluasi...">${f.value}</textarea>
                </div>
            `).join('')}
            
            <div class="form-actions">
                <button type="submit" class="btn btn-primary" id="save-eval-btn">
                    <i data-lucide="save"></i> Simpan Evaluasi
                </button>
            </div>
        </form>
    `;
}

function setupTaskEvents(data) {
    window.editTask = async (id) => {
        toast.info('Fitur edit task akan segera hadir');
    };
    
    window.deleteTaskItem = async (id, title) => {
        confirmDelete(title, async () => {
            const { error } = await deleteTask(id);
            if (error) {
                toast.error('Gagal menghapus task');
            } else {
                toast.success('Task berhasil dihapus');
                render(document.getElementById('main-content'), { code: data.program.code.toLowerCase() });
            }
        });
    };
    
    document.getElementById('add-task-btn')?.addEventListener('click', () => {
        navigate('/tasks');
    });
}

function setupEvaluationEvents(data) {
    const form = document.getElementById('evaluation-form');
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const evalData = {
            program_id: formData.get('program_id'),
            score_planning: parseInt(formData.get('score_planning')) || null,
            score_execution: parseInt(formData.get('score_execution')) || null,
            score_communication: parseInt(formData.get('score_communication')) || null,
            score_teamwork: parseInt(formData.get('score_teamwork')) || null,
            score_outcome: parseInt(formData.get('score_outcome')) || null,
            yang_berjalan_baik: formData.get('yang_berjalan_baik'),
            kendala: formData.get('kendala'),
            solusi: formData.get('solusi'),
            saran_tahun_depan: formData.get('saran_tahun_depan'),
        };
        
        const { upsertEvaluation } = await import('../api/evaluations.js');
        const { error } = await upsertEvaluation(evalData);
        
        if (error) {
            toast.error('Gagal menyimpan evaluasi');
        } else {
            toast.success('Evaluasi berhasil disimpan!');
            render(document.getElementById('main-content'), { code: data.program.code.toLowerCase() });
        }
    });
}

function showEditProgramForm(program) {
    const formHTML = `
        <form id="edit-program-form" class="form">
            <div class="form-group">
                <label>Nama Program Kerja</label>
                <input type="text" class="form-input" value="${program.name}" disabled>
                <span class="form-hint">Nama program tidak dapat diubah</span>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div class="form-group">
                    <label>Tanggal Mulai Persiapan *</label>
                    <input type="date" name="start_date" class="form-input" value="${program.start_date ? program.start_date.split('T')[0] : ''}" required>
                </div>
                <div class="form-group">
                    <label>Deadline Kegiatan *</label>
                    <input type="date" name="end_date" class="form-input" value="${program.end_date ? program.end_date.split('T')[0] : ''}" required>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div class="form-group">
                    <label>PIC Program</label>
                    <input type="text" name="pic_name" class="form-input" placeholder="Nama penanggung jawab..." value="${program.pic_name || ''}">
                </div>
                <div class="form-group">
                    <label>Status Program *</label>
                    <select name="status" class="form-input" required>
                        <option value="planning" ${program.status === 'planning' ? 'selected' : ''}>Planning</option>
                        <option value="active" ${program.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="completed" ${program.status === 'completed' ? 'selected' : ''}>Completed</option>
                        <option value="cancelled" ${program.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>
            </div>
            
            <div class="form-group">
                <label>Deskripsi Kegiatan</label>
                <textarea name="description" class="form-input" rows="4" placeholder="Deskripsi detail kegiatan...">${program.description || ''}</textarea>
            </div>
        </form>
    `;
    
    showModal({
        title: 'Edit Detail Program Kerja',
        content: formHTML,
        confirmText: 'Simpan Perubahan',
        onConfirm: async () => {
            const form = document.getElementById('edit-program-form');
            const fd = new FormData(form);
            
            const updates = {
                start_date: fd.get('start_date'),
                end_date: fd.get('end_date'),
                pic_name: fd.get('pic_name'),
                status: fd.get('status'),
                description: fd.get('description'),
            };
            
            const { error } = await updateProgram(program.id, updates);
            if (error) {
                toast.error('Gagal mengupdate program: ' + error.message);
            } else {
                toast.success('Program berhasil diupdate!');
                render(document.getElementById('main-content'), { code: program.code.toLowerCase() });
            }
        }
    });
}

function getScoreColor(score) {
    if (!score) return '#94A3B8';
    if (score >= 8) return '#10B981';
    if (score >= 6) return '#F59E0B';
    return '#EF4444';
}

function getSkeletonHTML() {
    return `
        <div class="program-detail-header skeleton h-40"></div>
        <div class="stats-grid mt-4">${[1,2,3,4].map(() => `<div class="card skeleton h-20"></div>`).join('')}</div>
        <div class="card skeleton h-96 mt-4"></div>
    `;
}
