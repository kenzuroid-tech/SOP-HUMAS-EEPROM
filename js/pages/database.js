/**
 * EEPROM Humas Management System
 * Database (Participants) Page
 */

import { fetchParticipants, createParticipant, updateParticipant, deleteParticipant, fetchParticipantStats } from '../api/database.js';
import { store, hasPermission } from '../store.js';
import { PARTICIPANT_TYPES } from '../config.js';
import { toast, confirmDelete, showModal, formatDate, debounce, createPagination, exportCSV } from '../utils.js';

let allParticipants = [];
let filters = { type: 'all', search: '' };
let currentPage = 1;
const PAGE_SIZE = 15;

export async function render(container) {
    container.innerHTML = getSkeletonHTML();
    
    const { data: participants } = await fetchParticipants();
    allParticipants = participants || [];
    
    const stats = await fetchParticipantStats();
    
    container.innerHTML = getPageHTML(stats);
    if (window.lucide) lucide.createIcons({ nodes: [container] });
    
    renderTable();
    setupEvents();
}

function getPageHTML(stats) {
    const canCreate = hasPermission('database', 'create');
    
    return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Database</h1>
                <p class="page-subtitle">Database mahasiswa baru, alumni, pendaftar, dan contact person</p>
            </div>
            <div class="page-actions">
                ${canCreate ? `
                    <button class="btn btn-primary" id="add-participant-btn">
                        <i data-lucide="user-plus"></i> Tambah Data
                    </button>
                ` : ''}
                <button class="btn btn-outline" id="export-db-btn">
                    <i data-lucide="download"></i> Export CSV
                </button>
            </div>
        </div>
        
        <!-- Type Stats Cards -->
        <div class="db-stats-grid">
            <div class="db-stat-card all ${filters.type === 'all' ? 'active' : ''}" data-filter-type="all">
                <div class="db-stat-icon" style="background: rgba(108,99,255,0.15); color: #6C63FF">
                    <i data-lucide="users"></i>
                </div>
                <div>
                    <div class="db-stat-number">${stats.total}</div>
                    <div class="db-stat-label">Total Data</div>
                </div>
            </div>
            ${Object.entries(PARTICIPANT_TYPES).map(([key, conf]) => `
                <div class="db-stat-card ${filters.type === key ? 'active' : ''}" data-filter-type="${key}">
                    <div class="db-stat-icon" style="background: ${conf.color}22; color: ${conf.color}">
                        <i data-lucide="${conf.icon}"></i>
                    </div>
                    <div>
                        <div class="db-stat-number">${stats[key] || 0}</div>
                        <div class="db-stat-label">${conf.label}</div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <!-- Toolbar -->
        <div class="toolbar">
            <div class="search-input-wrapper">
                <i data-lucide="search"></i>
                <input type="text" placeholder="Cari nama, NIM, email..." id="db-search">
            </div>
        </div>
        
        <!-- Table -->
        <div class="card">
            <div class="table-wrapper" id="db-table-wrapper"></div>
        </div>
        <div id="db-pagination"></div>
    `;
}

function renderTable() {
    const wrapper = document.getElementById('db-table-wrapper');
    const paginationContainer = document.getElementById('db-pagination');
    if (!wrapper) return;
    
    let filtered = [...allParticipants];
    if (filters.type !== 'all') filtered = filtered.filter(p => p.type === filters.type);
    if (filters.search) {
        const s = filters.search.toLowerCase();
        filtered = filtered.filter(p =>
            p.full_name?.toLowerCase().includes(s) ||
            p.nim?.toLowerCase().includes(s) ||
            p.email?.toLowerCase().includes(s) ||
            p.phone?.includes(s)
        );
    }
    
    const total = filtered.length;
    const start = (currentPage - 1) * PAGE_SIZE;
    const paginated = filtered.slice(start, start + PAGE_SIZE);
    
    if (paginated.length === 0) {
        wrapper.innerHTML = `
            <div class="empty-state">
                <i data-lucide="database"></i>
                <h3>Tidak ada data</h3>
                <p>${filters.search ? 'Tidak ada data yang cocok' : 'Tambahkan data baru'}</p>
            </div>
        `;
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }
    
    const activeType = filters.type !== 'all' ? filters.type : null;
    
    wrapper.innerHTML = `
        <div class="table-info text-sm text-muted p-4">Menampilkan ${start + 1}-${Math.min(start + PAGE_SIZE, total)} dari ${total} data</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Nama</th>
                    ${!activeType || activeType === 'mahasiswa_baru' || activeType === 'alumni' || activeType === 'pendaftar' ? '<th>NIM / Angkatan</th>' : ''}
                    <th>Email / HP</th>
                    ${activeType === 'pendaftar' ? '<th>Status Seleksi</th><th>Skor</th>' : ''}
                    ${activeType === 'contact_person' ? '<th>Jabatan</th><th>Organisasi</th>' : ''}
                    ${activeType === 'alumni' ? '<th>Lulus</th><th>Pekerjaan</th>' : ''}
                    ${!activeType ? '<th>Tipe</th>' : ''}
                    <th>Aksi</th>
                </tr>
            </thead>
            <tbody>
                ${paginated.map(p => getParticipantRow(p, activeType)).join('')}
            </tbody>
        </table>
    `;
    
    if (window.lucide) lucide.createIcons({ nodes: [wrapper] });
    
    // Pagination
    if (paginationContainer) {
        const pagination = createPagination({
            total, page: currentPage, pageSize: PAGE_SIZE,
            onPageChange: (page) => { currentPage = page; renderTable(); }
        });
        paginationContainer.innerHTML = '';
        if (pagination) paginationContainer.appendChild(pagination);
    }
    
    // Row actions
    wrapper.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            const participant = allParticipants.find(p => p.id === id);
            
            if (action === 'edit' && participant) showParticipantForm(participant);
            
            if (action === 'delete') {
                confirmDelete(btn.dataset.name || 'data ini', async () => {
                    const { error } = await deleteParticipant(id);
                    if (error) { toast.error('Gagal menghapus data'); return; }
                    allParticipants = allParticipants.filter(p => p.id !== id);
                    toast.success('Data berhasil dihapus');
                    renderTable();
                });
            }
        });
    });
}

function getParticipantRow(p, activeType) {
    const typeConf = PARTICIPANT_TYPES[p.type] || {};
    
    const statusColors = {
        accepted: '#10B981',
        rejected: '#EF4444',
        pending: '#F59E0B',
    };
    
    return `
        <tr>
            <td>
                <div class="table-name-cell">
                    <div class="avatar avatar-sm" style="background: ${typeConf.color}22; color: ${typeConf.color}">
                        ${p.full_name.charAt(0)}
                    </div>
                    <div>
                        <div class="fw-600">${p.full_name}</div>
                        <div class="text-xs text-muted">${p.nickname || ''}</div>
                    </div>
                </div>
            </td>
            ${!activeType || activeType !== 'contact_person' ? `
                <td>
                    <div>${p.nim || '-'}</div>
                    <div class="text-xs text-muted">Angk. ${p.angkatan || '-'}</div>
                </td>
            ` : ''}
            <td>
                <div>${p.email || '-'}</div>
                <div class="text-xs text-muted">${p.phone || '-'}</div>
            </td>
            ${activeType === 'pendaftar' ? `
                <td>
                    <span class="badge" style="background: ${(statusColors[p.final_status] || '#94A3B8')}22; color: ${statusColors[p.final_status] || '#94A3B8'}">
                        ${p.final_status || 'Pending'}
                    </span>
                </td>
                <td>
                    <div>Tulis: ${p.written_test_score || '-'}</div>
                    <div class="text-xs text-muted">Interview: ${p.interview_score || '-'}</div>
                </td>
            ` : ''}
            ${activeType === 'contact_person' ? `
                <td>${p.cp_role || '-'}</td>
                <td>${p.organization || '-'}</td>
            ` : ''}
            ${activeType === 'alumni' ? `
                <td>${p.graduation_year || '-'}</td>
                <td>${p.current_job || '-'}</td>
            ` : ''}
            ${!activeType ? `
                <td>
                    <span class="badge" style="background: ${typeConf.color}22; color: ${typeConf.color}">
                        <i data-lucide="${typeConf.icon}"></i> ${typeConf.label}
                    </span>
                </td>
            ` : ''}
            <td>
                <div class="table-actions">
                    ${hasPermission('database', 'edit') ? `
                        <button class="btn-icon btn-sm" title="Edit" data-action="edit" data-id="${p.id}">
                            <i data-lucide="edit"></i>
                        </button>
                    ` : ''}
                    ${hasPermission('database', 'delete') ? `
                        <button class="btn-icon btn-sm text-danger" title="Hapus" data-action="delete" data-id="${p.id}" data-name="${p.full_name}">
                            <i data-lucide="trash-2"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `;
}

function showParticipantForm(participant = null) {
    const isEdit = !!participant;
    const type = participant?.type || filters.type !== 'all' ? filters.type : 'mahasiswa_baru';
    
    showModal({
        title: isEdit ? 'Edit Data' : 'Tambah Data Baru',
        size: 'lg',
        content: `
            <form id="participant-form" class="form">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Tipe *</label>
                        <select name="type" class="form-input" required>
                            ${Object.entries(PARTICIPANT_TYPES).map(([k, v]) => 
                                `<option value="${k}" ${(participant?.type || type) === k ? 'selected' : ''}>${v.label}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Nama Lengkap *</label>
                        <input type="text" name="full_name" class="form-input" value="${participant?.full_name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Panggilan</label>
                        <input type="text" name="nickname" class="form-input" value="${participant?.nickname || ''}">
                    </div>
                    <div class="form-group">
                        <label>NIM</label>
                        <input type="text" name="nim" class="form-input" value="${participant?.nim || ''}">
                    </div>
                    <div class="form-group">
                        <label>Angkatan</label>
                        <input type="text" name="angkatan" class="form-input" value="${participant?.angkatan || ''}">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email" class="form-input" value="${participant?.email || ''}">
                    </div>
                    <div class="form-group">
                        <label>No. HP</label>
                        <input type="text" name="phone" class="form-input" value="${participant?.phone || ''}">
                    </div>
                    <div class="form-group span-2">
                        <label>Catatan</label>
                        <textarea name="notes" class="form-input" rows="2">${participant?.notes || ''}</textarea>
                    </div>
                </div>
            </form>
        `,
        confirmText: isEdit ? 'Simpan' : 'Tambah',
        onConfirm: async () => {
            const form = document.getElementById('participant-form');
            const fd = new FormData(form);
            const data = Object.fromEntries(fd);
            
            if (isEdit) {
                const { error } = await updateParticipant(participant.id, data);
                if (error) { toast.error('Gagal mengupdate data'); return; }
                allParticipants = allParticipants.map(p => p.id === participant.id ? { ...p, ...data } : p);
                toast.success('Data berhasil diupdate!');
            } else {
                const { data: newData, error } = await createParticipant(data);
                if (error) { toast.error('Gagal menambah data'); return; }
                allParticipants.push(newData);
                toast.success('Data berhasil ditambahkan!');
            }
            renderTable();
        },
    });
}

function setupEvents() {
    document.getElementById('add-participant-btn')?.addEventListener('click', () => showParticipantForm());
    
    document.getElementById('export-db-btn')?.addEventListener('click', () => {
        const exportData = allParticipants
            .filter(p => filters.type === 'all' || p.type === filters.type)
            .map(p => ({
                'Tipe': PARTICIPANT_TYPES[p.type]?.label || p.type,
                'Nama': p.full_name,
                'NIM': p.nim || '-',
                'Angkatan': p.angkatan || '-',
                'Email': p.email || '-',
                'HP': p.phone || '-',
            }));
        exportCSV(exportData, `database-eeprom-${filters.type}.csv`);
    });
    
    document.getElementById('db-search')?.addEventListener('input', debounce((e) => {
        filters.search = e.target.value;
        currentPage = 1;
        renderTable();
    }, 300));
    
    document.querySelectorAll('[data-filter-type]').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('[data-filter-type]').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            filters.type = card.dataset.filterType;
            currentPage = 1;
            renderTable();
        });
    });
}

function getSkeletonHTML() {
    return `
        <div class="db-stats-grid">${[1,2,3,4,5].map(() => `<div class="card skeleton h-24"></div>`).join('')}</div>
        <div class="card skeleton h-96 mt-4"></div>
    `;
}
