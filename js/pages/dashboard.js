/**
 * EEPROM Humas Management System
 * Dashboard Page Module
 */

import { store, getTaskStats, getUpcomingDeadlines, getAvgProgress } from '../store.js';
import { fetchPrograms } from '../api/programs.js';
import { fetchTasks } from '../api/tasks.js';
import { formatDate, formatRelativeTime, formatDateTime, createProgressBar, getProgressColor } from '../utils.js';
import { MOCK_STATS, MOCK_ACTIVITY_LOGS } from '../mockData.js';
import { APP_CONFIG, TASK_STATUS, TASK_PRIORITY } from '../config.js';
import { getSupabase } from '../auth.js';

// ============================================================
// RENDER
// ============================================================

export async function render(container) {
    container.innerHTML = getSkeletonHTML();
    
    // Fetch data
    const [programsResult, tasksResult] = await Promise.all([
        fetchPrograms(),
        fetchTasks(),
    ]);
    
    const programs = programsResult.data || [];
    const tasks = tasksResult.data || [];
    const stats = APP_CONFIG.demoMode ? MOCK_STATS : await fetchStats();
    const taskStats = getTaskStats(tasks);
    const upcomingDeadlines = getUpcomingDeadlines(tasks);
    
    container.innerHTML = getDashboardHTML(programs, tasks, taskStats, upcomingDeadlines, stats);
    
    // Init charts
    initCharts(programs, taskStats);
    
    // Init calendar mini
    initMiniCalendar();
    
    // Init icons
    if (window.lucide) lucide.createIcons({ nodes: [container] });
    
    // Animate stats
    animateCounters();
}

// ============================================================
// HTML TEMPLATE
// ============================================================

function getDashboardHTML(programs, tasks, taskStats, upcomingDeadlines, stats) {
    const user = store.get('user');
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Selamat Pagi' : hour < 17 ? 'Selamat Siang' : 'Selamat Malam';
    
    return `
        <div class="page-header">
            <div>
                <h1 class="page-title">${greeting}, ${user?.nickname || user?.full_name?.split(' ')[0] || 'Tim'}! 👋</h1>
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
            
            <div class="stat-card" data-animate="counter">
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
            
            <!-- Task Chart -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i data-lucide="pie-chart"></i> Status Task</h3>
                </div>
                <div class="card-body chart-container">
                    <canvas id="task-chart" height="200"></canvas>
                    <div class="chart-legend" id="task-chart-legend"></div>
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
            
            <!-- Activity Log -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i data-lucide="activity"></i> Aktivitas Terbaru</h3>
                </div>
                <div class="card-body">
                    <div class="activity-list">
                        ${MOCK_ACTIVITY_LOGS.map(log => getActivityItem(log)).join('')}
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Progress Chart -->
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i data-lucide="bar-chart-2"></i> Grafik Progress Program Kerja</h3>
            </div>
            <div class="card-body">
                <canvas id="progress-chart" height="80"></canvas>
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
        create: { icon: 'plus-circle', color: '#10B981' },
        update: { icon: 'edit', color: '#6C63FF' },
        delete: { icon: 'trash-2', color: '#EF4444' },
        login: { icon: 'log-in', color: '#06B6D4' },
        logout: { icon: 'log-out', color: '#94A3B8' },
        upload: { icon: 'upload', color: '#F59E0B' },
        download: { icon: 'download', color: '#8B5CF6' },
    };
    
    const config = actionIcons[log.action] || actionIcons.update;
    const actionLabel = {
        create: 'menambahkan', update: 'mengubah', delete: 'menghapus',
        login: 'masuk ke sistem', logout: 'keluar dari sistem',
        upload: 'mengunggah', download: 'mengunduh',
    };
    
    return `
        <div class="activity-item">
            <div class="activity-icon" style="background: ${config.color}20; color: ${config.color}">
                <i data-lucide="${config.icon}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-text">
                    <strong>${log.user_name}</strong> ${actionLabel[log.action] || log.action} 
                    <span>${log.resource_name || ''}</span>
                </div>
                <div class="activity-time text-xs text-muted">${formatRelativeTime(log.created_at)}</div>
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
