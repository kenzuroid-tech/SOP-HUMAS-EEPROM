/**
 * EEPROM Humas Management System
 * Documents / Gallery Page
 */

import { fetchDocuments, uploadDocument, updateDocument, deleteDocument } from '../api/documents.js';
import { fetchPrograms } from '../api/programs.js';
import { store, hasPermission } from '../store.js';
import { DOCUMENT_CATEGORIES } from '../config.js';
import { toast, confirmDelete, showModal, formatDate, formatFileSize, debounce, createPagination } from '../utils.js';

let allDocuments = [];
let filters = { category: 'all', program: 'all', search: '' };
let currentPage = 1;
const PAGE_SIZE = 12;
let viewMode = 'grid'; // 'grid' | 'list'

export async function render(container) {
    container.innerHTML = getSkeletonHTML();
    
    const [docsResult, programsResult] = await Promise.all([
        fetchDocuments(),
        fetchPrograms(),
    ]);
    
    allDocuments = docsResult.data || [];
    const programs = programsResult.data || [];
    
    container.innerHTML = getPageHTML(programs);
    if (window.lucide) lucide.createIcons({ nodes: [container] });
    
    renderGallery();
    setupEvents(programs);
}

function getPageHTML(programs) {
    const canUpload = hasPermission('documents', 'upload');
    
    return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Dokumentasi</h1>
                <p class="page-subtitle">Gallery foto dan dokumentasi kegiatan Humas EEPROM</p>
            </div>
            ${canUpload ? `
                <button class="btn btn-primary" id="upload-btn">
                    <i data-lucide="upload"></i> Upload Foto
                </button>
            ` : ''}
        </div>
        
        <!-- Category Filters -->
        <div class="doc-category-tabs">
            <button class="doc-cat-tab active" data-cat="all">
                <i data-lucide="grid"></i> Semua <span class="tab-badge">${allDocuments.length}</span>
            </button>
            ${Object.entries(DOCUMENT_CATEGORIES).map(([key, conf]) => `
                <button class="doc-cat-tab" data-cat="${key}" style="--cat-color: ${conf.color}">
                    <i data-lucide="${conf.icon}"></i> ${conf.label}
                    <span class="tab-badge">${allDocuments.filter(d => d.category === key).length}</span>
                </button>
            `).join('')}
        </div>
        
        <!-- Toolbar -->
        <div class="toolbar">
            <div class="toolbar-left">
                <div class="search-input-wrapper">
                    <i data-lucide="search"></i>
                    <input type="text" placeholder="Cari dokumentasi..." id="doc-search">
                </div>
                <select class="select-input" id="filter-doc-program">
                    <option value="all">Semua Program</option>
                    ${programs.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
            </div>
            <div class="toolbar-right">
                <div class="view-toggle">
                    <button class="view-btn active" id="grid-view-btn" title="Grid View">
                        <i data-lucide="grid"></i>
                    </button>
                    <button class="view-btn" id="list-view-btn" title="List View">
                        <i data-lucide="list"></i>
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Gallery Content -->
        <div id="gallery-content"></div>
        <div id="doc-pagination"></div>
        
        <!-- Lightbox -->
        <div class="lightbox" id="lightbox" onclick="closeLightbox()">
            <button class="lightbox-close" onclick="closeLightbox()"><i data-lucide="x"></i></button>
            <button class="lightbox-prev" id="lightbox-prev"><i data-lucide="chevron-left"></i></button>
            <div class="lightbox-img-wrapper">
                <img src="" alt="" id="lightbox-img">
                <div class="lightbox-caption" id="lightbox-caption"></div>
            </div>
            <button class="lightbox-next" id="lightbox-next"><i data-lucide="chevron-right"></i></button>
        </div>
    `;
}

function renderGallery() {
    const container = document.getElementById('gallery-content');
    const pagination = document.getElementById('doc-pagination');
    if (!container) return;
    
    let filtered = [...allDocuments];
    if (filters.category !== 'all') filtered = filtered.filter(d => d.category === filters.category);
    if (filters.program !== 'all') filtered = filtered.filter(d => d.program_id === filters.program);
    if (filters.search) {
        const s = filters.search.toLowerCase();
        filtered = filtered.filter(d => d.title?.toLowerCase().includes(s) || d.description?.toLowerCase().includes(s));
    }
    
    const total = filtered.length;
    const start = (currentPage - 1) * PAGE_SIZE;
    const paginated = filtered.slice(start, start + PAGE_SIZE);
    
    if (paginated.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-lucide="image"></i>
                <h3>Tidak ada dokumentasi</h3>
                <p>${filters.search ? 'Coba ubah kata kunci pencarian' : 'Upload foto kegiatan untuk memulai'}</p>
            </div>
        `;
        if (pagination) pagination.innerHTML = '';
        return;
    }
    
    if (viewMode === 'list') {
        renderListView(container, paginated);
    } else {
        renderGridView(container, paginated, filtered);
    }
    
    if (pagination) {
        const pag = createPagination({
            total, page: currentPage, pageSize: PAGE_SIZE,
            onPageChange: (page) => { currentPage = page; renderGallery(); }
        });
        pagination.innerHTML = '';
        if (pag) pagination.appendChild(pag);
    }
    
    if (window.lucide) lucide.createIcons({ nodes: [container] });
}

function renderGridView(container, paginated, allFiltered) {
    container.innerHTML = `
        <div class="gallery-grid">
            ${paginated.map((doc, i) => `
                <div class="gallery-item ${doc.is_featured ? 'featured' : ''}" 
                     data-index="${allDocuments.indexOf(doc)}"
                     onclick="openLightboxItem(${allDocuments.indexOf(doc)})">
                    <img src="${doc.thumbnail_url || doc.file_url}" alt="${doc.title}" loading="lazy">
                    <div class="gallery-overlay">
                        <div class="gallery-item-title">${doc.title}</div>
                        <div class="gallery-item-meta text-xs">
                            ${doc.category ? `<span>${DOCUMENT_CATEGORIES[doc.category]?.label || doc.category}</span>` : ''}
                            ${doc.event_date ? `<span>${formatDate(doc.event_date, { day: 'numeric', month: 'short' })}</span>` : ''}
                        </div>
                    </div>
                    ${doc.is_featured ? `<div class="gallery-featured-badge"><i data-lucide="star"></i></div>` : ''}
                    ${hasPermission('documents', 'delete') ? `
                        <button class="gallery-delete-btn btn-icon btn-sm text-danger" 
                                onclick="event.stopPropagation(); deleteDocItem('${doc.id}', '${doc.title}')"
                                title="Hapus">
                            <i data-lucide="trash-2"></i>
                        </button>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function renderListView(container, paginated) {
    container.innerHTML = `
        <div class="card">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Preview</th>
                        <th>Judul</th>
                        <th>Kategori</th>
                        <th>Program</th>
                        <th>Tanggal</th>
                        <th>Ukuran</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    ${paginated.map(doc => `
                        <tr>
                            <td>
                                <img src="${doc.thumbnail_url || doc.file_url}" alt="${doc.title}" 
                                     class="table-thumbnail" onclick="openLightboxItem(${allDocuments.indexOf(doc)})">
                            </td>
                            <td>
                                <div class="fw-600">${doc.title}</div>
                                <div class="text-xs text-muted">${doc.description?.slice(0, 50) || ''}</div>
                            </td>
                            <td>
                                <span class="badge" style="background: ${DOCUMENT_CATEGORIES[doc.category]?.color}22; color: ${DOCUMENT_CATEGORIES[doc.category]?.color}">
                                    ${DOCUMENT_CATEGORIES[doc.category]?.label || doc.category}
                                </span>
                            </td>
                            <td class="text-muted text-sm">${doc.program_name || '-'}</td>
                            <td class="text-muted text-sm">${formatDate(doc.event_date)}</td>
                            <td class="text-muted text-sm">${formatFileSize(doc.file_size)}</td>
                            <td>
                                <div class="table-actions">
                                    <a href="${doc.file_url}" target="_blank" class="btn-icon btn-sm" title="Lihat">
                                        <i data-lucide="external-link"></i>
                                    </a>
                                    ${hasPermission('documents', 'delete') ? `
                                        <button class="btn-icon btn-sm text-danger" onclick="deleteDocItem('${doc.id}', '${doc.title}')">
                                            <i data-lucide="trash-2"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ============================================================
// UPLOAD MODAL
// ============================================================

function showUploadModal(programs) {
    showModal({
        title: 'Upload Dokumentasi',
        size: 'lg',
        content: `
            <form id="upload-form" class="form">
                <div class="upload-drop-zone" id="drop-zone">
                    <input type="file" id="file-input" accept="image/*" multiple class="upload-file-input">
                    <div class="upload-drop-content">
                        <i data-lucide="upload-cloud"></i>
                        <p>Drag & drop foto di sini atau <button type="button" class="btn-text" onclick="document.getElementById('file-input').click()">pilih file</button></p>
                        <span class="text-xs text-muted">JPG, PNG, WebP — Maks 50MB per file</span>
                    </div>
                    <div id="file-preview" class="file-preview"></div>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Judul *</label>
                        <input type="text" name="title" class="form-input" placeholder="Judul dokumentasi..." required>
                    </div>
                    <div class="form-group">
                        <label>Kategori</label>
                        <select name="category" class="form-input">
                            ${Object.entries(DOCUMENT_CATEGORIES).map(([k, v]) => 
                                `<option value="${k}">${v.label}</option>`
                            ).join('')}
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
                        <label>Tanggal Kegiatan</label>
                        <input type="date" name="event_date" class="form-input">
                    </div>
                    <div class="form-group span-2">
                        <label>Deskripsi</label>
                        <textarea name="description" class="form-input" rows="2" placeholder="Deskripsi foto..."></textarea>
                    </div>
                </div>
            </form>
        `,
        confirmText: 'Upload',
        onConfirm: async () => {
            const form = document.getElementById('upload-form');
            const fileInput = document.getElementById('file-input');
            const files = fileInput.files;
            
            if (!files.length) {
                toast.warning('Pilih file foto terlebih dahulu');
                return;
            }
            
            const fd = new FormData(form);
            const metadata = {
                title: fd.get('title'),
                category: fd.get('category'),
                program_id: fd.get('program_id') || null,
                event_date: fd.get('event_date') || null,
                description: fd.get('description'),
            };
            
            toast.info('Mengupload foto...');
            
            for (const file of Array.from(files)) {
                const { data, error } = await uploadDocument(file, {
                    ...metadata,
                    title: files.length > 1 ? `${metadata.title} (${file.name})` : metadata.title,
                });
                
                if (error) {
                    toast.error(`Gagal upload ${file.name}`);
                } else {
                    allDocuments.unshift(data);
                }
            }
            
            toast.success(`${files.length} foto berhasil diupload!`);
            renderGallery();
        },
    });
    
    // File preview
    setTimeout(() => {
        const fileInput = document.getElementById('file-input');
        const preview = document.getElementById('file-preview');
        const dropZone = document.getElementById('drop-zone');
        
        fileInput?.addEventListener('change', () => updatePreview(fileInput.files, preview));
        
        // Drag and drop
        dropZone?.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            fileInput.files = e.dataTransfer.files;
            updatePreview(e.dataTransfer.files, preview);
        });
        
        if (window.lucide) lucide.createIcons({ nodes: [dropZone] });
    }, 100);
}

function updatePreview(files, previewContainer) {
    if (!previewContainer) return;
    previewContainer.innerHTML = Array.from(files).map(file => {
        const url = URL.createObjectURL(file);
        return `<div class="preview-thumb"><img src="${url}" alt="${file.name}"><span class="text-xs">${file.name}</span></div>`;
    }).join('');
}

// ============================================================
// LIGHTBOX
// ============================================================

let lightboxIndex = 0;

window.openLightboxItem = function(index) {
    lightboxIndex = index;
    const doc = allDocuments[index];
    if (!doc) return;
    
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    const caption = document.getElementById('lightbox-caption');
    
    img.src = doc.file_url;
    img.alt = doc.title;
    caption.textContent = `${doc.title}${doc.event_date ? ' — ' + formatDate(doc.event_date) : ''}`;
    lightbox.classList.add('open');
};

window.closeLightbox = function() {
    document.getElementById('lightbox')?.classList.remove('open');
};

window.deleteDocItem = function(id, title) {
    confirmDelete(title, async () => {
        const { error } = await deleteDocument(id);
        if (error) { toast.error('Gagal menghapus dokumentasi'); return; }
        allDocuments = allDocuments.filter(d => d.id !== id);
        toast.success('Dokumentasi dihapus');
        renderGallery();
    });
};

// ============================================================
// SETUP EVENTS
// ============================================================

function setupEvents(programs) {
    document.getElementById('upload-btn')?.addEventListener('click', () => showUploadModal(programs));
    
    document.getElementById('doc-search')?.addEventListener('input', debounce((e) => {
        filters.search = e.target.value;
        currentPage = 1;
        renderGallery();
    }, 300));
    
    document.getElementById('filter-doc-program')?.addEventListener('change', (e) => {
        filters.program = e.target.value;
        currentPage = 1;
        renderGallery();
    });
    
    document.querySelectorAll('.doc-cat-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.doc-cat-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            filters.category = tab.dataset.cat;
            currentPage = 1;
            renderGallery();
        });
    });
    
    document.getElementById('grid-view-btn')?.addEventListener('click', () => {
        viewMode = 'grid';
        document.getElementById('grid-view-btn').classList.add('active');
        document.getElementById('list-view-btn').classList.remove('active');
        renderGallery();
    });
    
    document.getElementById('list-view-btn')?.addEventListener('click', () => {
        viewMode = 'list';
        document.getElementById('list-view-btn').classList.add('active');
        document.getElementById('grid-view-btn').classList.remove('active');
        renderGallery();
    });
    
    // Lightbox navigation
    document.getElementById('lightbox-prev')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openLightboxItem((lightboxIndex - 1 + allDocuments.length) % allDocuments.length);
    });
    document.getElementById('lightbox-next')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openLightboxItem((lightboxIndex + 1) % allDocuments.length);
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        const lightbox = document.getElementById('lightbox');
        if (!lightbox?.classList.contains('open')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') openLightboxItem((lightboxIndex - 1 + allDocuments.length) % allDocuments.length);
        if (e.key === 'ArrowRight') openLightboxItem((lightboxIndex + 1) % allDocuments.length);
    });
}

function getSkeletonHTML() {
    return `<div class="gallery-grid">${[1,2,3,4,5,6,7,8].map(() => `<div class="card skeleton" style="aspect-ratio:4/3"></div>`).join('')}</div>`;
}
