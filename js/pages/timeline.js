/**
 * EEPROM Humas Management System
 * Timeline / Calendar Page
 */

import { fetchTimeline, createTimelineEvent, updateTimelineEvent, deleteTimelineEvent } from '../api/timeline.js';
import { fetchPrograms } from '../api/programs.js';
import { fetchTasks } from '../api/tasks.js';
import { store, hasPermission } from '../store.js';
import { toast, confirmDelete, showModal, formatDate, formatDateTime } from '../utils.js';
import { MOCK_TIMELINE } from '../mockData.js';

let currentDate = new Date();
let events = [];

export async function render(container) {
    container.innerHTML = getSkeletonHTML();
    
    const [eventsResult, programsResult, tasksResult] = await Promise.all([
        fetchTimeline(),
        fetchPrograms(),
        fetchTasks()
    ]);
    
    let baseEvents = eventsResult.data || [];
    const programs = programsResult.data || [];
    const tasks = tasksResult.data || [];
    
    // Inject Programs and Tasks as virtual events
    programs.forEach(p => {
        if (p.end_date) {
            baseEvents.push({
                id: `prog-${p.id}`,
                title: `[Program] ${p.name}`,
                start_datetime: p.end_date,
                event_type: 'milestone',
                color: '#6C63FF',
                is_readonly: true
            });
        }
    });
    
    tasks.forEach(t => {
        if (t.deadline) {
            let color = '#EF4444'; // default red for not done
            if (t.status === 'done') color = '#10B981';
            else if (t.status === 'in_progress' || t.status === 'review') color = '#F59E0B';
            
            baseEvents.push({
                id: `task-${t.id}`,
                title: `[Task] ${t.title} (${t.assignee_name || 'Unassigned'})`,
                start_datetime: t.deadline,
                event_type: 'deadline',
                color: color,
                is_readonly: true
            });
        }
    });
    
    events = baseEvents;
    
    container.innerHTML = getPageHTML(programs);
    if (window.lucide) lucide.createIcons({ nodes: [container] });
    
    renderCalendar();
    renderEventList();
    setupEvents(programs);
}

function getPageHTML(programs) {
    const canCreate = hasPermission('timeline', 'create');
    
    return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Timeline</h1>
                <p class="page-subtitle">Kalender semua kegiatan Humas EEPROM</p>
            </div>
            ${canCreate ? `
                <button class="btn btn-primary" id="add-event-btn">
                    <i data-lucide="plus"></i> Tambah Event
                </button>
            ` : ''}
        </div>
        
        <div class="timeline-layout">
            <!-- Calendar -->
            <div class="card timeline-calendar-card">
                <div class="calendar-header">
                    <button class="btn-icon" id="prev-month"><i data-lucide="chevron-left"></i></button>
                    <h3 id="calendar-month-label"></h3>
                    <button class="btn-icon" id="next-month"><i data-lucide="chevron-right"></i></button>
                </div>
                <div id="calendar-grid"></div>
            </div>
            
            <!-- Events Sidebar -->
            <div class="timeline-events-panel">
                <!-- Upcoming Events -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i data-lucide="calendar"></i> Semua Event</h3>
                        <span class="badge badge-primary" id="events-count">${events.length}</span>
                    </div>
                    <div class="card-body">
                        <div id="event-list"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const label = document.getElementById('calendar-month-label');
    if (!grid || !label) return;
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const today = new Date();
    
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    
    label.textContent = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    
    let html = `
        <div class="calendar-grid">
            ${dayNames.map(d => `<div class="cal-header">${d}</div>`).join('')}
    `;
    
    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        html += `<div class="cal-day other-month" style="min-width: 0; overflow: hidden;">${prevMonthDays - i}</div>`;
    }
    
    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        const dayEvents = events.filter(e => {
            const eDate = new Date(e.start_datetime);
            return eDate.getDate() === d && eDate.getMonth() === month && eDate.getFullYear() === year;
        });
        
        const hasEvent = dayEvents.length > 0;
        html += `
            <div class="cal-day${isToday ? ' today' : ''}${hasEvent ? ' has-event' : ''}" data-date="${date.toISOString().split('T')[0]}" style="min-width: 0; overflow: hidden;">
                <span>${d}</span>
                ${hasEvent ? `
                    <div style="display:flex; flex-direction:column; gap:2px; width:100%; max-width:100%; margin-top:2px; padding:0 2px; box-sizing:border-box; overflow:hidden;">
                        ${dayEvents.slice(0, 2).map(e => {
                            // Coba hapus prefiks [Task] atau [Program] agar teks muat lebih banyak
                            const shortTitle = e.title.replace(/^\\[.*?\\]\\s*/, '');
                            return `<div style="background:${e.color || '#6C63FF'}33; color:${e.color || '#6C63FF'}; font-size:9px; font-weight:600; padding:2px 4px; border-radius:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:left; border-left: 2px solid ${e.color || '#6C63FF'}; max-width:100%; box-sizing:border-box;">
                                ${shortTitle}
                            </div>`;
                        }).join('')}
                        ${dayEvents.length > 2 ? `<div style="font-size:9px; color:var(--text-muted); font-weight:600; text-align:center;">+${dayEvents.length - 2}</div>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    // Next month days
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    const remaining = totalCells - (firstDay + daysInMonth);
    for (let d = 1; d <= remaining; d++) {
        html += `<div class="cal-day other-month" style="min-width: 0; overflow: hidden;">${d}</div>`;
    }
    
    html += `</div>`;
    grid.innerHTML = html;
    
    // Day click handler
    grid.querySelectorAll('.cal-day:not(.other-month)').forEach(day => {
        day.addEventListener('click', () => {
            const dateStr = day.dataset.date;
            const dayEvents = events.filter(e => e.start_datetime?.startsWith(dateStr));
            
            // Highlight selected day
            grid.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
            day.classList.add('selected');
            
            // Show day events
            renderEventList(dayEvents.length > 0 ? dayEvents : null, dateStr);
        });
    });
}

function renderEventList(filteredEvents = null, dateLabel = null) {
    const list = document.getElementById('event-list');
    const badge = document.getElementById('events-count');
    const cardTitle = document.querySelector('.timeline-events-panel .card-title');
    if (!list) return;
    
    let toShow = filteredEvents;
    
    // Filter berdasarkan bulan aktif jika tidak ada tanggal spesifik yang diklik
    if (!toShow) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        toShow = events.filter(e => {
            if (!e.start_datetime) return false;
            const d = new Date(e.start_datetime);
            return d.getFullYear() === year && d.getMonth() === month;
        });
        
        if (cardTitle) {
            const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            cardTitle.innerHTML = `<i data-lucide="calendar"></i> Event ${monthNames[month]} ${year}`;
        }
    } else if (dateLabel && cardTitle) {
        const d = new Date(dateLabel);
        if (!isNaN(d)) {
            const dStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            cardTitle.innerHTML = `<i data-lucide="calendar"></i> Event ${dStr}`;
        }
    }
    
    if (badge) badge.textContent = toShow.length;
    
    const sorted = [...toShow].sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
    
    if (sorted.length === 0) {
        list.innerHTML = `
            <div class="empty-state compact">
                <i data-lucide="calendar"></i>
                <p>${dateLabel ? 'Tidak ada event pada hari ini' : 'Tidak ada event'}</p>
            </div>
        `;
        return;
    }
    
    const eventTypeIcons = {
        kegiatan: 'star',
        rapat: 'users',
        deadline: 'alert-circle',
        milestone: 'flag',
    };
    
    list.innerHTML = sorted.map(event => `
        <div class="event-item" data-event-id="${event.id}">
            <div class="event-color-bar" style="background: ${event.color || '#6C63FF'}"></div>
            <div class="event-content">
                <div class="event-title">${event.title}</div>
                <div class="event-meta text-sm text-muted">
                    <span><i data-lucide="clock"></i> ${formatDateTime(event.start_datetime, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    ${event.location ? `<span><i data-lucide="map-pin"></i> ${event.location}</span>` : ''}
                    ${event.program_name ? `<span><i data-lucide="briefcase"></i> ${event.program_name}</span>` : ''}
                </div>
            </div>
            <div class="event-type-icon" style="color: ${event.color || '#6C63FF'}">
                <i data-lucide="${eventTypeIcons[event.event_type] || 'calendar'}"></i>
            </div>
            ${hasPermission('timeline', 'delete') && !event.is_readonly ? `
                <button class="btn-icon btn-sm text-danger" data-action="delete-event" data-id="${event.id}" data-title="${event.title}">
                    <i data-lucide="trash-2"></i>
                </button>
            ` : ''}
        </div>
    `).join('');
    
    if (window.lucide) lucide.createIcons({ nodes: [list] });
    
    // Delete event handler
    list.querySelectorAll('[data-action="delete-event"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const title = btn.dataset.title;
            confirmDelete(title, async () => {
                const { error } = await deleteTimelineEvent(id);
                if (error) { toast.error('Gagal menghapus event'); return; }
                events = events.filter(ev => ev.id !== id);
                toast.success('Event dihapus');
                renderCalendar();
                renderEventList();
            });
        });
    });
}

function showEventForm(programs) {
    const formHTML = `
        <form id="event-form" class="form">
            <div class="form-group">
                <label>Judul Event *</label>
                <input type="text" name="title" class="form-input" placeholder="Nama event..." required>
            </div>
            <div class="form-group">
                <label>Deskripsi</label>
                <textarea name="description" class="form-input" rows="2" placeholder="Deskripsi singkat..."></textarea>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>Tipe Event</label>
                    <select name="event_type" class="form-input">
                        <option value="kegiatan">Kegiatan</option>
                        <option value="rapat">Rapat</option>
                        <option value="deadline">Deadline</option>
                        <option value="milestone">Milestone</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Program</label>
                    <select name="program_id" class="form-input">
                        <option value="">Tidak terkait program</option>
                        ${programs.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Waktu Mulai *</label>
                    <input type="datetime-local" name="start_datetime" class="form-input" required>
                </div>
                <div class="form-group">
                    <label>Waktu Selesai</label>
                    <input type="datetime-local" name="end_datetime" class="form-input">
                </div>
            </div>
            <div class="form-group">
                <label>Lokasi</label>
                <input type="text" name="location" class="form-input" placeholder="Nama tempat...">
            </div>
            <div class="form-group">
                <label>Warna</label>
                <div class="color-picker">
                    ${['#6C63FF','#8B5CF6','#EC4899','#F59E0B','#10B981','#06B6D4','#F97316','#EF4444'].map(c => `
                        <label class="color-option">
                            <input type="radio" name="color" value="${c}" ${c === '#6C63FF' ? 'checked' : ''}>
                            <span class="color-swatch" style="background: ${c}"></span>
                        </label>
                    `).join('')}
                </div>
            </div>
        </form>
    `;
    
    showModal({
        title: 'Tambah Event',
        content: formHTML,
        size: 'lg',
        confirmText: 'Tambah Event',
        onConfirm: async () => {
            const form = document.getElementById('event-form');
            const fd = new FormData(form);
            const data = {
                title: fd.get('title'),
                description: fd.get('description'),
                event_type: fd.get('event_type'),
                program_id: fd.get('program_id') || null,
                start_datetime: fd.get('start_datetime'),
                end_datetime: fd.get('end_datetime') || null,
                location: fd.get('location'),
                color: fd.get('color') || '#6C63FF',
            };
            
            const { data: newEvent, error } = await createTimelineEvent(data);
            if (error) { toast.error('Gagal menambah event'); return; }
            
            events.push({ ...newEvent, program_name: programs.find(p => p.id === data.program_id)?.name });
            toast.success('Event berhasil ditambahkan!');
            renderCalendar();
            renderEventList();
        },
    });
}

function setupEvents(programs) {
    document.getElementById('add-event-btn')?.addEventListener('click', () => showEventForm(programs));
    
    document.getElementById('prev-month')?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
        renderEventList();
    });
    
    document.getElementById('next-month')?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
        renderEventList();
    });
}

function getSkeletonHTML() {
    return `
        <div class="timeline-layout">
            <div class="card skeleton h-96"></div>
            <div class="card skeleton h-96"></div>
        </div>
    `;
}
