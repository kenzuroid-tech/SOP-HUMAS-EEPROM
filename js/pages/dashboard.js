/**
 * EEPROM Humas Management System
 * Dashboard Page Module
 */

import { store, getTaskStats, getUpcomingDeadlines, getAvgProgress } from '../store.js';
import { fetchPrograms } from '../api/programs.js';
import { fetchTasks, fetchTransferRequests, fetchActivityLogs } from '../api/tasks.js';
import { formatDate, formatRelativeTime, formatDateTime, createProgressBar, getProgressColor } from '../utils.js';
import { MOCK_STATS } from '../mockData.js';
import { APP_CONFIG, TASK_STATUS, TASK_PRIORITY } from '../config.js';
import { getSupabase } from '../auth.js';

// ============================================================
// RENDER
// ============================================================

export async function render(container) {
    container.innerHTML = getSkeletonHTML();
    
    // Fetch data secara paralel
    const [programsResult, tasksResult, transfersResult, activityResult] = await Promise.all([
        fetchPrograms(),
        fetchTasks(),
        fetchTransferRequests(),
        fetchActivityLogs(10),
    ]);
    
    const programs = programsResult.data || [];
    const tasks = tasksResult.data || [];
    const transferRequests = transfersResult.data || [];
    const activityLogs = activityResult.data || [];
    const stats = APP_CONFIG.demoMode ? MOCK_STATS : await fetchStats();
    const taskStats = getTaskStats(tasks);
    const upcomingDeadlines = getUpcomingDeadlines(tasks);
    
    container.innerHTML = getDashboardHTML(programs, tasks, taskStats, upcomingDeadlines, stats, transferRequests, activityLogs);
    
    // Init charts
    initCharts(programs, taskStats);
    
    // Init calendar mini
    initMiniCalendar();
    
    // Init icons
    if (window.lucide) lucide.createIcons({ nodes: [container] });
    
    // Animate stats
    animateCounters();
    
    // Init interactive events (untuk dashboard anggota)
    initDashboardEvents(container, tasks);
}

// ============================================================
// HTML TEMPLATE
// ============================================================

function getDashboardHTML(programs, tasks, taskStats, upcomingDeadlines, stats, transferRequests, activityLogs) {
    const user = store.get('user');
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Selamat Pagi' : hour < 17 ? 'Selamat Siang' : 'Selamat Malam';
    
    const isAdmin = user?.role === 'super_admin' || user?.role === 'ketua_humas';
    
    if (isAdmin) {
        return getAdminDashboardHTML(programs, tasks, taskStats, upcomingDeadlines, stats, greeting, user, transferRequests, activityLogs);
    } else {
        return getStaffDashboardHTML(programs, tasks, taskStats, upcomingDeadlines, greeting, user, transferRequests);
    }
}

function getAdminDashboardHTML(programs, tasks, taskStats, upcomingDeadlines, stats, greeting, user, transferRequests, activityLogs) {
    return `
        <div class="page-header">
            <div>
                <h1 class="page-title">${greeting}, ${user?.nickname || user?.full_name?.split(' ')[0] || 'Tim'}! 👋 (Super Admin)</h1>
                <p class="page-subtitle">Berikut ringkasan kegiatan Humas EEPROM hari ini, ${formatDate(new Date())}</p>
            </div>
            <div class="page-actions">
                <button class="btn btn-outline" onclick="navigate('/tasks')">
                    <i data-lucide="plus"></i> Tambah Task
                </button>
                <button class="btn btn-primary" onclick="navigate('/programs')">
                    <i data-lucide="briefcase"></i> Program Kerja
                </button>
            </div>
        </div>
        
        <!-- Stats Cards -->
        <div class="stats-grid">
            <div class="stat-card" data-animate="counter">
                <div class="stat-icon" style="background: rgba(108,99,255,0.15); color: #6C63FF">
                    <i data-lucide="briefcase"></i>
                </div>
                <div class="stat-content">
                    <div class="stat-value" data-target="${stats.total_programs}">${stats.total_programs}</div>
                    <div class="stat-label">Total Program</div>
                    <div class="stat-sub">
                        <span class="badge badge-success">${stats.active_programs} aktif</span>
                        <span class="badge badge-muted">${stats.completed_programs} selesai</span>
                    </div>
                </div>
            </div>
            
            <div class="stat-card" data-animate="counter" id="stat-total-tasks" style="cursor: pointer;" title="Lihat daftar task selesai">
                <div class="stat-icon" style="background: rgba(16,185,129,0.15); color: #10B981">
                    <i data-lucide="check-square"></i>
                </div>
                <div class="stat-content">
                    <div class="stat-value" data-target="${taskStats.total}">${taskStats.total}</div>
                    <div class="stat-label">Total Task</div>
                    <div class="stat-sub">
                        <span class="badge badge-success">${taskStats.done} selesai</span>
                        <span class="badge badge-warning">${taskStats.in_progress} proses</span>
                    </div>
                </div>
            </div>
            
            <div class="stat-card ${taskStats.overdue > 0 ? 'danger' : ''}" data-animate="counter">
                <div class="stat-icon" style="background: rgba(239,68,68,0.15); color: #EF4444">
                    <i data-lucide="alert-triangle"></i>
                </div>
                <div class="stat-content">
                    <div class="stat-value" data-target="${taskStats.overdue}">${taskStats.overdue}</div>
                    <div class="stat-label">Task Terlambat</div>
                    <div class="stat-sub">
                        <span class="badge badge-danger">${taskStats.todo} belum mulai</span>
                    </div>
                </div>
            </div>
            
            <div class="stat-card" data-animate="counter">
                <div class="stat-icon" style="background: rgba(245,158,11,0.15); color: #F59E0B">
                    <i data-lucide="image"></i>
                </div>
                <div class="stat-content">
                    <div class="stat-value" data-target="${stats.total_documents}">${stats.total_documents}</div>
                    <div class="stat-label">Dokumentasi</div>
                    <div class="stat-sub">
                        <span class="badge badge-primary">${stats.upcoming_events} event mendatang</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Main Grid -->
        <div class="dashboard-grid">
            <!-- Program Progress -->
            <div class="card dashboard-card-lg">
                <div class="card-header">
                    <h3 class="card-title"><i data-lucide="briefcase"></i> Progress Program Kerja</h3>
                    <button class="btn btn-ghost btn-sm" onclick="navigate('/programs')">
                        Lihat Semua <i data-lucide="arrow-right"></i>
                    </button>
                </div>
                <div class="card-body">
                    <div class="programs-progress-list">
                        ${programs.map(p => getProgramProgressItem(p)).join('')}
                    </div>
                </div>
            </div>
            
        </div>
        
        <div class="dashboard-grid-3">
            <!-- Upcoming Deadlines -->
            <div class="card dashboard-card-lg">
                <div class="card-header">
                    <h3 class="card-title"><i data-lucide="clock"></i> Deadline Terdekat</h3>
                    <button class="btn btn-ghost btn-sm" onclick="navigate('/tasks')">
                        Lihat Semua <i data-lucide="arrow-right"></i>
                    </button>
                </div>
                <div class="card-body">
                    ${upcomingDeadlines.length === 0 
                        ? `<div class="empty-state compact"><i data-lucide="check-circle"></i><p>Tidak ada deadline dalam 7 hari ke depan</p></div>`
                        : `<div class="deadline-list">
                            ${upcomingDeadlines.slice(0, 5).map(task => getDeadlineItem(task)).join('')}
                           </div>`
                    }
                </div>
            </div>
            
            <!-- Mini Calendar -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i data-lucide="calendar"></i> Kalender</h3>
                    <button class="btn btn-ghost btn-sm" onclick="navigate('/timeline')">
                        Full View <i data-lucide="maximize-2"></i>
                    </button>
                </div>
                <div class="card-body" id="mini-calendar-container">
                    <div id="mini-calendar"></div>
                </div>
            </div>
            
            <!-- Transfer Requests -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i data-lucide="user-plus"></i> Request Pergantian Tugas</h3>
                </div>
                <div class="card-body">
                    ${transferRequests.length === 0 
                        ? `<div class="empty-state compact"><p>Tidak ada request pending</p></div>`
                        : `<div class="activity-list">
                            ${transferRequests.map(req => getTransferRequestItem(req, user)).join('')}
                           </div>`
                    }
                </div>
            </div>
            
            <!-- Activity Log -->
            <div class="card dashboard-card-lg">
                <div class="card-header">
                    <h3 class="card-title"><i data-lucide="activity"></i> Aktivitas Terbaru</h3>
                    <span class="badge badge-success" style="font-size:11px">Live</span>
                </div>
                <div class="card-body">
                    ${activityLogs.length === 0
                        ? `<div class="empty-state compact">
                               <i data-lucide="clock"></i>
                               <p>Belum ada aktivitas. Mulai tambahkan atau ubah task!</p>
                           </div>`
                        : `<div class="activity-list">
                               ${activityLogs.map(log => getActivityItem(log)).join('')}
                           </div>`
                    }
                </div>
            </div>
        </div>

    `;
}

function getStaffDashboardHTML(programs, tasks, taskStats, upcomingDeadlines, greeting, user, transferRequests) {
    const myTasks = tasks.filter(t => t.assigned_to === user.id);
    const myTaskStats = getTaskStats(myTasks);
    const teamTasks = tasks.filter(t => t.assigned_to !== user.id);
    
    // Kelompokkan tugas teman berdasarkan assignee
    const teamByAssignee = {};
    teamTasks.forEach(t => {
        const key = t.assignee_name || 'Tidak Diassign';
        if (!teamByAssignee[key]) teamByAssignee[key] = [];
        teamByAssignee[key].push(t);
    });

    return `
        <div class="page-header">
            <div>
                <h1 class="page-title">${greeting}, ${user?.nickname || user?.full_name?.split(' ')[0] || 'Tim'}! 👋</h1>
                <p class="page-subtitle">Daftar tugas Anda — ${formatDate(new Date())}</p>
            </div>
            <div class="page-actions">
                <button class="btn btn-outline" onclick="navigate('/tasks')">
                    <i data-lucide="layout-dashboard"></i> Lihat Semua Task
                </button>
            </div>
        </div>
        
        <!-- Stats Cards Ringkas -->
        <div class="stats-grid">
            <div class="stat-card" data-animate="counter">
                <div class="stat-icon" style="background: rgba(108,99,255,0.15); color: #6C63FF">
                    <i data-lucide="check-square"></i>
                </div>
                <div class="stat-content">
                    <div class="stat-value" data-target="${myTaskStats.total}">${myTaskStats.total}</div>
                    <div class="stat-label">Task Saya</div>
                    <div class="stat-sub">
                        <span class="badge badge-success">${myTaskStats.done} selesai</span>
                    </div>
                </div>
            </div>
            <div class="stat-card" data-animate="counter">
                <div class="stat-icon" style="background: rgba(245,158,11,0.15); color: #F59E0B">
                    <i data-lucide="loader"></i>
                </div>
                <div class="stat-content">
                    <div class="stat-value" data-target="${myTaskStats.in_progress}">${myTaskStats.in_progress}</div>
                    <div class="stat-label">Sedang Dikerjakan</div>
                    <div class="stat-sub"><span class="badge badge-warning">On progress</span></div>
                </div>
            </div>
            <div class="stat-card ${myTaskStats.overdue > 0 ? 'danger' : ''}" data-animate="counter">
                <div class="stat-icon" style="background: rgba(239,68,68,0.15); color: #EF4444">
                    <i data-lucide="alert-triangle"></i>
                </div>
                <div class="stat-content">
                    <div class="stat-value" data-target="${myTaskStats.overdue}">${myTaskStats.overdue}</div>
                    <div class="stat-label">Terlambat</div>
                    <div class="stat-sub"><span class="badge badge-danger">${myTaskStats.overdue > 0 ? 'Segera selesaikan!' : 'Aman'}</span></div>
                </div>
            </div>
            <div class="stat-card" data-animate="counter">
                <div class="stat-icon" style="background: rgba(6,182,212,0.15); color: #06B6D4">
                    <i data-lucide="users"></i>
                </div>
                <div class="stat-content">
                    <div class="stat-value" data-target="${teamTasks.length}">${teamTasks.length}</div>
                    <div class="stat-label">Task Tim</div>
                    <div class="stat-sub"><span class="badge badge-primary">Satu Divisi</span></div>
                </div>
            </div>
        </div>
        
        <!-- TUGAS SAYA (utama) -->
        <div class="card" style="margin-bottom: 1.5rem">
            <div class="card-header">
                <h3 class="card-title"><i data-lucide="check-circle"></i> Tugas Saya</h3>
                <span class="badge badge-primary">${myTasks.length} task</span>
            </div>
            <div class="card-body" style="padding: 0">
                ${myTasks.length === 0
                    ? `<div class="empty-state" style="padding:2rem">
                           <i data-lucide="inbox"></i>
                           <h3>Belum Ada Tugas</h3>
                           <p>Anda belum memiliki tugas yang di-assign.</p>
                       </div>`
                    : myTasks.map(t => getMyTaskRow(t)).join('')
                }
            </div>
        </div>
        
        <!-- TUGAS TIM & TRANSFER REQUESTS (Grid) -->
        <div id="team-tasks-grid" class="dashboard-grid-equal" style="align-items: start;">
            <div class="card" style="margin-bottom: 0;">
                <div class="card-header">
                    <h3 class="card-title"><i data-lucide="users"></i> Tugas Anggota Lain</h3>
                    <span class="text-xs text-muted">Bisa dilihat, ubah status hanya oleh pemilik tugas</span>
                </div>
                <div class="card-body" style="padding: 0">
                    ${teamTasks.length === 0
                        ? '<div class="empty-state compact" style="padding:1.5rem"><p class="text-muted">Tidak ada tugas dari anggota lain.</p></div>'
                        : teamTasks.map(t => getTeamTaskRow(t, user)).join('')
                    }
                </div>
            </div>
            
            ${(() => {
                const myRequests = transferRequests.filter(req => req.owner_id === user.id || req.requester_id === user.id);
                if (myRequests.length === 0) return '';
                return '<div class="card" style="margin-bottom: 0;" id="transfer-requests-card"><div class="card-header"><h3 class="card-title"><i data-lucide="user-plus"></i> Request Pergantian Tugas Saya</h3></div><div class="card-body"><div class="activity-list">' + myRequests.map(req => getTransferRequestItem(req, user)).join('') + '</div></div></div>';
            })()}
        </div>
    `;
}

function getMyTaskRow(task) {
    const status = TASK_STATUS[task.status] || TASK_STATUS.todo;
    const color = getProgressColor(task.progress || 0);
    const isOverdue = task.deadline && new Date(task.deadline) < new Date() && !['done', 'cancelled'].includes(task.status);
    const priority = TASK_PRIORITY[task.priority] || TASK_PRIORITY.medium;
    
    const nextStatusMap = { todo: 'in_progress', in_progress: 'review', review: 'done', done: 'todo' };
    const nextStatus = nextStatusMap[task.status] || 'in_progress';
    const nextStatusConf = TASK_STATUS[nextStatus];
    
    return `
        <div class="staff-task-row ${isOverdue ? 'overdue-row' : ''}" data-task-id="${task.id}">
            <div class="staff-task-status-bar" style="background: ${status.color}"></div>
            <div class="staff-task-main">
                <div class="staff-task-info">
                    <div class="staff-task-title">${task.title}</div>
                    <div class="staff-task-meta">
                        ${task.program_name ? `<span class="staff-task-tag"><i data-lucide="briefcase" style="width:11px;height:11px"></i>${task.program_name}</span>` : ''}
                        ${task.deadline ? `<span class="staff-task-tag ${isOverdue ? 'text-danger' : ''}"><i data-lucide="clock" style="width:11px;height:11px"></i>${isOverdue ? 'Terlambat!' : formatDate(task.deadline, { day: 'numeric', month: 'short' })}</span>` : ''}
                        <span class="staff-task-tag" style="color:${priority.color}"><i data-lucide="${priority.icon}" style="width:11px;height:11px"></i>${priority.label}</span>
                    </div>
                </div>
                <div class="staff-task-progress-wrap">
                    <div class="progress-bar sm" style="width:80px">
                        <div class="progress-fill" style="width:${task.progress || 0}%;background:${color}"></div>
                    </div>
                    <span class="text-xs" style="color:${color};min-width:30px;text-align:right">${task.progress || 0}%</span>
                </div>
                <div class="staff-task-status-badge">
                    <span class="badge" style="background:${status.color}20;color:${status.color}">
                        <i data-lucide="${status.icon}" style="width:11px;height:11px"></i>
                        ${status.label}
                    </span>
                </div>
                <div class="staff-task-actions">
                    <button class="btn btn-primary btn-sm" 
                        data-action="status" 
                        data-id="${task.id}" 
                        data-status="${task.status}"
                        title="Ubah status ke ${nextStatusConf?.label}">
                        <i data-lucide="refresh-cw"></i>
                        → ${nextStatusConf?.label || 'Next'}
                    </button>
                </div>
            </div>
        </div>
    `;
}

function getTeamTaskRow(task, currentUser) {
    const status = TASK_STATUS[task.status] || TASK_STATUS.todo;
    const isOverdue = task.deadline && new Date(task.deadline) < new Date() && !['done', 'cancelled'].includes(task.status);
    const initials = (task.assignee_name || '?').charAt(0).toUpperCase();
    const avatarColors = ['#6C63FF', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'];
    const avatarColor = avatarColors[(task.assignee_name?.charCodeAt(0) || 0) % avatarColors.length];
    
    return `
        <div class="staff-task-row team-task-row ${isOverdue ? 'overdue-row' : ''}" data-task-id="${task.id}">
            <div class="staff-task-status-bar" style="background: ${status.color}; opacity: 0.4"></div>
            <div class="staff-task-main">
                <div class="team-task-avatar" style="background:${avatarColor}22;color:${avatarColor}">${initials}</div>
                <div class="staff-task-info">
                    <div class="staff-task-title" style="color:var(--text-muted)">${task.title}</div>
                    <div class="staff-task-meta">
                        <span class="staff-task-tag" style="color:${avatarColor}"><i data-lucide="user" style="width:11px;height:11px"></i>${task.assignee_name || 'Unassigned'}</span>
                        ${task.program_name ? `<span class="staff-task-tag"><i data-lucide="briefcase" style="width:11px;height:11px"></i>${task.program_name}</span>` : ''}
                    </div>
                </div>
                <div class="staff-task-status-badge">
                    <span class="badge" style="background:${status.color}20;color:${status.color};opacity:0.8">
                        ${status.label}
                    </span>
                </div>
                <div class="staff-task-actions">
                    <button class="btn btn-ghost btn-sm text-muted" 
                        data-action="transfer_request" 
                        data-id="${task.id}" 
                        data-owner="${task.assigned_to}"
                        title="Ajukan Alih Tugas">
                        <i data-lucide="user-plus"></i> Ambil Alih
                    </button>
                </div>
            </div>
        </div>
    `;
}


// ============================================================
// ITEM TEMPLATES
// ============================================================

function getProgramProgressItem(program) {
    const color = getProgressColor(program.progress || 0);
    const statusConfig = {
        planning: { label: 'Planning', class: 'badge-muted' },
        active: { label: 'Aktif', class: 'badge-primary' },
        completed: { label: 'Selesai', class: 'badge-success' },
        cancelled: { label: 'Batal', class: 'badge-danger' },
    };
    const status = statusConfig[program.status] || statusConfig.planning;
    
    return `
        <div class="program-progress-item" onclick="navigate('/programs/${program.code?.toLowerCase() || program.id}')">
            <div class="program-progress-info">
                <div class="program-name">${program.name}</div>
                <div class="program-meta">
                    <span class="badge ${status.class}">${status.label}</span>
                    <span class="text-muted text-sm">${program.done_tasks || 0}/${program.total_tasks || 0} task</span>
                </div>
            </div>
            <div class="program-progress-bar-wrapper">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${program.progress || 0}%; background: ${color}; transition: width 1s ease"></div>
                </div>
                <span class="progress-percent" style="color: ${color}">${program.progress || 0}%</span>
            </div>
        </div>
    `;
}

function getDeadlineItem(task) {
    const days = Math.ceil((new Date(task.deadline) - new Date()) / 86400000);
    const isUrgent = days <= 2;
    const isTomorrow = days === 1;
    
    const daysLabel = days === 0 ? 'Hari ini!' : isTomorrow ? 'Besok' : `${days} hari lagi`;
    const priorityConfig = TASK_PRIORITY[task.priority] || TASK_PRIORITY.medium;
    
    return `
        <div class="deadline-item ${isUrgent ? 'urgent' : ''}" onclick="navigate('/tasks')">
            <div class="deadline-priority" style="background: ${priorityConfig.color}20; color: ${priorityConfig.color}">
                <i data-lucide="${priorityConfig.icon}"></i>
            </div>
            <div class="deadline-info">
                <div class="deadline-title">${task.title}</div>
                <div class="deadline-meta text-sm text-muted">${task.program_name || 'Global'} • ${task.assignee_name || 'Unassigned'}</div>
            </div>
            <div class="deadline-days ${isUrgent ? 'text-danger' : 'text-muted'}">
                <i data-lucide="clock"></i>
                ${daysLabel}
            </div>
        </div>
    `;
}

function getActivityItem(log) {
    const actionIcons = {
        create:        { icon: 'plus-circle',    color: '#10B981' },
        update:        { icon: 'edit-3',          color: '#6C63FF' },
        delete:        { icon: 'trash-2',         color: '#EF4444' },
        status_change: { icon: 'refresh-cw',      color: '#F59E0B' },
        login:         { icon: 'log-in',          color: '#06B6D4' },
        logout:        { icon: 'log-out',         color: '#94A3B8' },
        upload:        { icon: 'upload',          color: '#F59E0B' },
        download:      { icon: 'download',        color: '#8B5CF6' },
        transfer:      { icon: 'user-plus',       color: '#EC4899' },
    };
    
    const config = actionIcons[log.action] || actionIcons.update;
    
    const actionLabel = {
        create:        'menambahkan',
        update:        'mengubah',
        delete:        'menghapus',
        status_change: 'mengubah status',
        login:         'masuk ke sistem',
        logout:        'keluar dari sistem',
        upload:        'mengunggah',
        download:      'mengunduh',
        transfer:      'mengajukan alih tugas',
    };
    
    // Tambahan info untuk status_change
    let extraInfo = '';
    if (log.action === 'status_change' && log.meta?.status) {
        const statusConf = TASK_STATUS[log.meta.status];
        extraInfo = statusConf 
            ? ` → <span style="color:${statusConf.color}; font-weight:600">${statusConf.label}</span>`
            : '';
    }
    
    const initials = (log.user_name || log.user_full_name || 'U').charAt(0).toUpperCase();
    const avatarColors = ['#6C63FF', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#EF4444'];
    const avatarColor = avatarColors[(log.user_name?.charCodeAt(0) || 0) % avatarColors.length];
    
    return `
        <div class="activity-item">
            <div class="activity-icon" style="background: ${avatarColor}22; color: ${avatarColor}; font-weight: 700; font-size: 13px;">
                ${initials}
            </div>
            <div class="activity-content">
                <div class="activity-text">
                    <strong>${log.user_name || log.user_full_name || 'User'}</strong>
                    ${actionLabel[log.action] || log.action}
                    <span style="color: var(--primary-color)">${log.resource_name || ''}</span>${extraInfo}
                </div>
                <div class="activity-time text-xs text-muted">${formatRelativeTime(log.created_at)}</div>
            </div>
            <div class="activity-action-icon" style="color: ${config.color}; opacity: 0.8">
                <i data-lucide="${config.icon}" style="width:14px;height:14px"></i>
            </div>
        </div>
    `;
}

function getTransferRequestItem(req, user) {
    const isOwner = req.owner_id === user?.id;
    const isPending = req.status === 'pending';
    
    let actionHtml = '';
    if (isPending) {
        if (isOwner) {
            actionHtml = `
                <div class="flex gap-2">
                    <button class="btn btn-primary btn-xs" onclick="handleTransferApproval('${req.id}', '${req.task_id}', '${req.requester_id}', 'approved')">Approve</button>
                    <button class="btn btn-outline btn-xs" onclick="handleTransferApproval('${req.id}', '${req.task_id}', '${req.requester_id}', 'rejected')">Reject</button>
                </div>
            `;
        } else {
            actionHtml = `<div class="badge badge-warning text-xs">Menunggu Konfirmasi</div>`;
        }
    } else if (req.status === 'approved') {
        actionHtml = `<div class="badge badge-success text-xs">Disetujui</div>`;
    } else if (req.status === 'rejected') {
        actionHtml = `<div class="badge badge-danger text-xs">Ditolak</div>`;
    }

    return `
        <div class="activity-item">
            <div class="activity-icon" style="background: #F59E0B20; color: #F59E0B">
                <i data-lucide="user-plus"></i>
            </div>
            <div class="activity-content">
                <div class="activity-text" style="font-size: 13px;">
                    <strong>${req.requester?.full_name || req.requester_name}</strong> ingin mengambil alih task 
                    <strong>${req.tasks?.title || req.tasks?.title || 'Task'}</strong>
                </div>
                <div class="activity-time text-xs text-muted" style="margin-bottom: 8px;">
                    Alasan: "${req.reason}"
                </div>
                ${actionHtml}
            </div>
        </div>
    `;
}

// ============================================================
// CHARTS
// ============================================================

function initCharts(programs, taskStats) {
    if (!window.Chart) return;
    
    // Task status doughnut chart
    const taskCtx = document.getElementById('task-chart');
    if (taskCtx) {
        new Chart(taskCtx, {
            type: 'doughnut',
            data: {
                labels: ['To Do', 'In Progress', 'Review', 'Done', 'Cancelled'],
                datasets: [{
                    data: [taskStats.todo, taskStats.in_progress, taskStats.review, taskStats.done, taskStats.cancelled],
                    backgroundColor: ['#94A3B8', '#F59E0B', '#06B6D4', '#10B981', '#EF4444'],
                    borderWidth: 0,
                    hoverOffset: 6,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ${ctx.raw} task`,
                        },
                    },
                },
            },
        });
        
        // Custom legend
        const legend = document.getElementById('task-chart-legend');
        if (legend) {
            const items = [
                { label: 'To Do', count: taskStats.todo, color: '#94A3B8' },
                { label: 'In Progress', count: taskStats.in_progress, color: '#F59E0B' },
                { label: 'Done', count: taskStats.done, color: '#10B981' },
                { label: 'Cancelled', count: taskStats.cancelled, color: '#EF4444' },
            ];
            legend.innerHTML = items.map(item => `
                <div class="legend-item">
                    <div class="legend-dot" style="background: ${item.color}"></div>
                    <span class="legend-label">${item.label}</span>
                    <span class="legend-count">${item.count}</span>
                </div>
            `).join('');
        }
    }
    
    // Progress bar chart
    const progressCtx = document.getElementById('progress-chart');
    if (progressCtx && programs.length > 0) {
        new Chart(progressCtx, {
            type: 'bar',
            data: {
                labels: programs.map(p => p.short_name || p.name),
                datasets: [{
                    label: 'Progress (%)',
                    data: programs.map(p => p.progress || 0),
                    backgroundColor: programs.map(p => (p.color || '#6C63FF') + '99'),
                    borderColor: programs.map(p => p.color || '#6C63FF'),
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` Progress: ${ctx.raw}%`,
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#94A3B8', callback: (v) => v + '%' },
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94A3B8', maxRotation: 0 },
                    },
                },
            },
        });
    }
}

// ============================================================
// MINI CALENDAR
// ============================================================

function initMiniCalendar() {
    const container = document.getElementById('mini-calendar');
    if (!container) return;
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = now.getDate();
    
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    
    let html = `
        <div class="mini-calendar">
            <div class="mini-cal-header">
                <span>${monthNames[month]} ${year}</span>
            </div>
            <div class="mini-cal-grid">
                ${dayNames.map(d => `<div class="mini-cal-day-header">${d}</div>`).join('')}
    `;
    
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        html += `<div class="mini-cal-day empty"></div>`;
    }
    
    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = d === today;
        html += `<div class="mini-cal-day${isToday ? ' today' : ''}">${d}</div>`;
    }
    
    html += `</div></div>`;
    container.innerHTML = html;
}

// ============================================================
// ANIMATIONS
// ============================================================

function animateCounters() {
    document.querySelectorAll('[data-target]').forEach(el => {
        const target = parseInt(el.dataset.target) || 0;
        let current = 0;
        const step = Math.ceil(target / 30);
        const timer = setInterval(() => {
            current = Math.min(current + step, target);
            el.textContent = current;
            if (current >= target) clearInterval(timer);
        }, 30);
    });
}

// ============================================================
// SKELETON
// ============================================================

function getSkeletonHTML() {
    return `
        <div class="page-header">
            <div>
                <div class="skeleton h-8 w-64 mb-2"></div>
                <div class="skeleton h-4 w-48"></div>
            </div>
        </div>
        <div class="stats-grid">
            ${[1,2,3,4].map(() => `<div class="card skeleton h-28"></div>`).join('')}
        </div>
        <div class="dashboard-grid">
            <div class="card skeleton h-96"></div>
            <div class="card skeleton h-96"></div>
        </div>
    `;
}

async function fetchStats() {
    // Real Supabase stats
    const { data } = await getSupabase().rpc('get_dashboard_stats');
    return data || {};
}

// ============================================================
// GLOBAL HANDLERS
// ============================================================

/**
 * Modal upload bukti foto untuk penyelesaian task
 */
function showProofModal(task, onConfirm) {
    // Hapus modal lama jika ada
    document.getElementById('proof-modal')?.remove();
    
    const modal = document.createElement('div');
    modal.id = 'proof-modal';
    modal.className = 'modal-overlay proof-modal-overlay';
    modal.innerHTML = `
        <div class="modal proof-modal">
            <div class="modal-header">
                <h3 class="modal-title"><i data-lucide="camera"></i> Upload Bukti Penyelesaian</h3>
                <button class="btn-icon modal-close" id="proof-modal-close">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="modal-body">
                <p class="text-muted" style="margin-bottom:1rem">
                    Untuk menandai <strong>${task.title}</strong> sebagai <strong style="color:#10B981">Selesai</strong>, 
                    Anda wajib mengunggah foto/screenshot sebagai bukti penyelesaian.
                </p>
                <div class="proof-upload-area" id="proof-upload-area">
                    <input type="file" id="proof-file-input" accept="image/*" style="display:none">
                    <div class="proof-upload-placeholder" id="proof-placeholder">
                        <i data-lucide="upload-cloud"></i>
                        <p>Klik atau drag & drop foto di sini</p>
                        <span class="text-xs text-muted">PNG, JPG, JPEG hingga 2MB</span>
                    </div>
                    <div class="proof-preview" id="proof-preview" style="display:none">
                        <img id="proof-preview-img" src="" alt="Preview">
                        <button class="proof-remove-btn" id="proof-remove">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                </div>
                <p class="text-xs text-muted mt-2" style="margin-top:0.75rem">
                    ⚠️ Setelah status diubah ke Selesai dengan bukti foto, status tidak bisa dikembalikan.
                </p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" id="proof-cancel">Batal</button>
                <button class="btn btn-success" id="proof-confirm" disabled>
                    <i data-lucide="check-circle"></i> Tandai Selesai
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    if (window.lucide) lucide.createIcons({ nodes: [modal] });
    
    // Animasi masuk
    requestAnimationFrame(() => modal.classList.add('modal-open'));
    
    let selectedFile = null;
    
    const fileInput = modal.querySelector('#proof-file-input');
    const uploadArea = modal.querySelector('#proof-upload-area');
    const placeholder = modal.querySelector('#proof-placeholder');
    const preview = modal.querySelector('#proof-preview');
    const previewImg = modal.querySelector('#proof-preview-img');
    const confirmBtn = modal.querySelector('#proof-confirm');
    
    // Klik area upload
    uploadArea.addEventListener('click', (e) => {
        if (!e.target.closest('#proof-remove')) fileInput.click();
    });
    
    // Drag & drop
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) setFile(file);
    });
    
    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) setFile(fileInput.files[0]);
    });
    
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
        const url = URL.createObjectURL(file);
        previewImg.src = url;
        placeholder.style.display = 'none';
        preview.style.display = 'block';
        confirmBtn.disabled = false;
    }
    
    // Hapus file
    modal.querySelector('#proof-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFile = null;
        fileInput.value = '';
        previewImg.src = '';
        placeholder.style.display = 'flex';
        preview.style.display = 'none';
        confirmBtn.disabled = true;
    });
    
    // Tutup modal
    function closeModal() {
        modal.classList.remove('modal-open');
        setTimeout(() => modal.remove(), 300);
    }
    
    modal.querySelector('#proof-modal-close').addEventListener('click', closeModal);
    modal.querySelector('#proof-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    
    // Confirm
    confirmBtn.addEventListener('click', async () => {
        if (!selectedFile) return;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i data-lucide="loader"></i> Menyimpan...';
        if (window.lucide) lucide.createIcons({ nodes: [confirmBtn] });
        closeModal();
        await onConfirm(selectedFile);
    });
}

/**
 * Generic modal helper untuk dashboard
 */
function showModal({ title, content, size = 'md', confirmText = 'OK', onConfirm } = {}) {
    document.getElementById('dashboard-modal')?.remove();
    
    const modal = document.createElement('div');
    modal.id = 'dashboard-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal modal-${size}">
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                <button class="btn-icon modal-close" id="dash-modal-close">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="modal-body">${content}</div>
            <div class="modal-footer">
                <button class="btn btn-outline" id="dash-modal-cancel">Batal</button>
                <button class="btn btn-primary" id="dash-modal-confirm">${confirmText}</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    if (window.lucide) lucide.createIcons({ nodes: [modal] });
    requestAnimationFrame(() => modal.classList.add('modal-open'));
    
    function closeModal() {
        modal.classList.remove('modal-open');
        setTimeout(() => modal.remove(), 300);
    }
    
    modal.querySelector('#dash-modal-close').addEventListener('click', closeModal);
    modal.querySelector('#dash-modal-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    
    modal.querySelector('#dash-modal-confirm').addEventListener('click', async () => {
        const result = await onConfirm?.();
        if (result !== false) closeModal();
    });
}

/**
 * Setup event listeners untuk dashboard interaktif (terutama role anggota)
 */
function initDashboardEvents(container, tasks) {
    // Delegated event listener untuk seluruh dashboard
    container.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        
        const action = btn.dataset.action;
        const taskId = btn.dataset.id;
        const task = tasks.find(t => t.id === taskId);
        if (!task && action !== 'transfer_request') return;
        
        const user = store.get('user');
        
        // ── Ubah Status Task (hanya pemilik) ──
        if (action === 'status') {
            // Cek kepemilikan dengan toleran (UUID bisa berbeda format)
            const isOwner = task.assigned_to === user?.id 
                || task.assignee_email === user?.email
                || task.assigned_to_email === user?.email;
            const isAdmin = user?.role === 'super_admin' || user?.role === 'ketua_humas';
            
            if (!isOwner && !isAdmin) {
                const { toast } = await import('../utils.js');
                toast.warning('Hanya pemilik task yang dapat mengubah status.');
                return;
            }
            
            // Task Done tidak bisa diubah lagi
            if (task.status === 'done') {
                const { toast } = await import('../utils.js');
                toast.warning('Task sudah selesai dan tidak dapat diubah kembali.');
                return;
            }
            
            const statuses = ['todo', 'in_progress', 'review', 'done'];
            const currentIdx = statuses.indexOf(task.status);
            const nextStatus = statuses[(currentIdx + 1) % statuses.length];
            
            // ── Jika next status adalah DONE → wajib upload bukti foto ──
            if (nextStatus === 'done') {
                const { toast } = await import('../utils.js');
                const { markTaskDoneWithProof } = await import('../api/tasks.js');
                
                showProofModal(task, async (file) => {
                    if (!file) {
                        toast.warning('Bukti foto wajib diunggah untuk menyelesaikan task.');
                        return;
                    }
                    btn.disabled = true;
                    const result = await markTaskDoneWithProof(taskId, file);
                    if (result.error) {
                        toast.error('Gagal menandai task sebagai selesai');
                    } else {
                        toast.success('Task berhasil diselesaikan! 🎉');
                        const appContainer = document.getElementById('app-content');
                        if (appContainer) render(appContainer);
                    }
                });
                return;
            }
            
            const { updateTaskStatus } = await import('../api/tasks.js');
            const { toast } = await import('../utils.js');
            const { TASK_STATUS: TS } = await import('../config.js');
            
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader"></i>';
            if (window.lucide) lucide.createIcons({ nodes: [btn] });
            
            const { error } = await updateTaskStatus(taskId, nextStatus);
            if (error) {
                toast.error('Gagal mengubah status');
                btn.disabled = false;
            } else {
                toast.success(`Status diubah ke ${TS[nextStatus]?.label || nextStatus}`);
                const appContainer = document.getElementById('app-content');
                if (appContainer) render(appContainer);
            }
        }
        
        // ── Ajukan Alih Tugas ──
        if (action === 'transfer_request') {
            const { submitTransferRequest } = await import('../api/tasks.js');
            const { toast } = await import('../utils.js');
            const ownerId = btn.dataset.owner;
            const targetTask = tasks.find(t => t.id === taskId);
            
            const formHTML = `
                <div class="form-group">
                    <p class="text-muted" style="margin-bottom:0.75rem">
                        Anda akan mengajukan alih tugas untuk: 
                        <strong>${targetTask?.title || 'Task'}</strong><br>
                        Pemilik saat ini: <strong>${targetTask?.assignee_name || 'Tidak diketahui'}</strong>
                    </p>
                    <label>Alasan Pengambilalihan *</label>
                    <textarea id="transfer-reason" class="form-input" rows="3" 
                        placeholder="Jelaskan alasan mengapa Anda ingin mengambil alih tugas ini..."></textarea>
                    <p class="text-xs text-muted mt-2">Request ini akan dikirimkan ke pemilik tugas untuk disetujui.</p>
                </div>
            `;
            
            showModal({
                title: 'Ajukan Alih Tugas',
                content: formHTML,
                confirmText: 'Kirim Request',
                onConfirm: async () => {
                    const reason = document.getElementById('transfer-reason')?.value?.trim();
                    if (!reason) {
                        const { toast: t } = await import('../utils.js');
                        t.warning('Alasan tidak boleh kosong');
                        return false; // Jangan tutup modal
                    }
                    const { error } = await submitTransferRequest(taskId, ownerId, reason);
                    if (error) {
                        const { toast: t } = await import('../utils.js');
                        t.error('Gagal mengajukan alih tugas: ' + (error.message || error));
                    } else {
                        const { toast: t } = await import('../utils.js');
                        t.success('Request berhasil dikirim! Menunggu persetujuan pemilik tugas.');
                        
                        // Render ulang dashboard agar request baru muncul di widget
                        const appContainer = document.getElementById('app-content');
                        if (appContainer) render(appContainer);
                    }
                }
            });
        }
    });
    
    // ── Lihat Daftar Task Selesai (Klik Stat Card Total Task) ──
    const statTotalTasks = document.getElementById('stat-total-tasks');
    if (statTotalTasks) {
        statTotalTasks.addEventListener('click', () => {
            const user = store.get('user');
            
            const completedTasks = tasks.filter(t => t.status === 'done');
            let contentHTML = '';
            
            if (completedTasks.length === 0) {
                contentHTML = `<div class="empty-state compact"><p>Belum ada task yang diselesaikan.</p></div>`;
            } else {
                contentHTML = `
                    <div class="task-list" style="display:flex; flex-direction:column; gap:12px; max-height:400px; overflow-y:auto; padding-right:8px;">
                        ${completedTasks.map(task => `
                            <div class="card" style="padding:12px; border:1px solid var(--border-light); border-radius:var(--radius-md);">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px">
                                    <div style="flex:1">
                                        <h4 style="margin:0; font-size:14px; font-weight:600; color:var(--text)">${task.title}</h4>
                                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
                                            <i data-lucide="user" style="width:12px; height:12px; display:inline-block; vertical-align:-2px;"></i> ${task.assignee_name || 'Tidak diketahui'} &bull; 
                                            <i data-lucide="folder" style="width:12px; height:12px; display:inline-block; vertical-align:-2px;"></i> ${task.program_name || '-'}
                                        </div>
                                    </div>
                                    ${task.proof_url ? `
                                        <button class="btn btn-sm btn-outline" style="padding: 6px 12px; font-size:12px; flex-shrink:0" onclick="window.open('${task.proof_url}', '_blank')">
                                            <i data-lucide="image" style="width:14px; height:14px"></i> Bukti
                                        </button>
                                    ` : `
                                        <span class="badge badge-muted" style="font-size:11px">Tanpa Foto</span>
                                    `}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
            
            showModal({
                title: '<span style="display:flex;align-items:center;gap:8px"><i data-lucide="check-square" style="color:#10B981"></i> Daftar Task Selesai</span>',
                content: contentHTML,
                confirmText: 'Tutup',
                onConfirm: () => true
            });
            
            // Sembunyikan tombol "Batal" karena ini hanya modal informasi
            const modal = document.getElementById('dashboard-modal');
            if (modal) {
                const cancelBtn = modal.querySelector('#dash-modal-cancel');
                if (cancelBtn) cancelBtn.style.display = 'none';
            }
        });
    }
}

window.handleTransferApproval = async function(requestId, taskId, newOwnerId, status) {
    const { updateTransferRequestStatus } = await import('../api/tasks.js');
    const { toast } = await import('../utils.js');
    const { store } = await import('../store.js');
    
    const { error } = await updateTransferRequestStatus(requestId, taskId, newOwnerId, status);
    
    if (error) {
        toast.error('Gagal memproses request');
    } else {
        const label = status === 'approved' ? 'Disetujui' : 'Ditolak';
        const badgeColor = status === 'approved' ? 'badge-success' : 'badge-danger';
        toast.success(`Request berhasil ${label.toLowerCase()}`);
        
        // Update UI in-place — cari semua tombol approve/reject dalam item ini lalu ganti dengan badge
        const allItems = document.querySelectorAll('.activity-item');
        allItems.forEach(item => {
            const approveBtn = item.querySelector(`[onclick*="'${requestId}'"]`);
            if (approveBtn) {
                const actionsDiv = approveBtn.closest('.flex, div');
                if (actionsDiv) {
                    actionsDiv.outerHTML = '<div class="badge ' + badgeColor + ' text-xs">' + label + '</div>';
                }
            }
        });
        
        // Hapus notifikasi terkait dari store agar badge lonceng langsung hilang
        const allNotifs = store.get('notifications') || [];
        const taskTitle = store.get('tasks')?.find(t => t.id === taskId)?.title || '';
        const filteredNotifs = allNotifs.filter(n => 
            !(n.title === 'Permintaan Pergantian Tugas' && (n.resource_id === taskId || (taskTitle && n.message && n.message.includes('"' + taskTitle + '"'))))
        );
        store.set({
            notifications: filteredNotifs,
            unreadNotifications: filteredNotifs.filter(n => !n.is_read).length
        });
    }
};

