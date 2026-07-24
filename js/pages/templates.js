/**
 * EEPROM Humas Management System
 * Templates Page
 */

import { fetchTemplates, createTemplate, updateTemplate, deleteTemplate, incrementUseCount } from '../api/templates.js';
import { store, hasPermission } from '../store.js';
import { TEMPLATE_TYPES } from '../config.js';
import { toast, confirmDelete, showModal, copyToClipboard, debounce, formatRelativeTime } from '../utils.js';
import { getSupabase } from '../auth.js';

// ============================================================
// JARKOM GENERATOR — Smart parser & replacer
// ============================================================

const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** ISO "YYYY-MM-DD" → "D Bulan YYYY" (Indonesian) */
function formatDateID(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return '';
    return `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
}

/** "D Bulan YYYY" → "YYYY-MM-DD" for <input type="date"> */
function parseIDtoISO(idDate) {
    if (!idDate) return '';
    const parts = idDate.trim().split(' ');
    if (parts.length < 3) return '';
    const day = parts[0].padStart(2, '0');
    const mIdx = BULAN_ID.findIndex(b => b.toLowerCase() === parts[1].toLowerCase());
    if (mIdx === -1) return '';
    return `${parts[2]}-${String(mIdx + 1).padStart(2, '0')}-${day}`;
}

/** ISO date → Indonesian day name */
function getHariID(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? '' : HARI_ID[d.getDay()];
}

/** Escape special regex characters */
function escapeRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * Parse current values embedded in existing template content.
 * Detects: nama, angkatan, kegiatan, hari, tanggal, pukul, lokasi, dc, nb
 */
function parseJarkomFromTemplate(content) {
    const get = (rx, src) => { const m = src.match(rx); return m ? m[1].trim() : ''; };

    // Nama — "Perkenalkan saya NAME dari"
    const nama = get(/[Pp]erkenalkan\s+saya\s+([^\n]+?)\s+dari\s/u, content);

    // Angkatan — first "Angkatan NN" (digits only)
    const angkatan = get(/Angkatan\s+(\d+)/, content);

    // Kegiatan — bold text after "kegiatan \*"
    const kegiatan = get(/kegiatan\s+\*([^*]+)\*/i, content);

    // Schedule fields — after label + arbitrary whitespace/colon
    const lineVal = (label) =>
        get(new RegExp(`${label}\\s*[:\\t ]+([^\\n]+)`), content).replace(/^:\s*/, '').trim();

    const hari = lineVal('Hari');
    const tanggal = lineVal('Tanggal');
    const pukul = lineVal('Pukul');
    const lokasi = lineVal('Lokasi');
    const dc = lineVal('DC');
    const nb = get(/NB\s*[:\t ]+([^\n]+(?:\n(?![A-Z*📝])[^\n]+)*)/u, content).replace(/^:\s*/, '').trim();

    return { nama, angkatan, kegiatan, hari, tanggal, pukul, lokasi, dc, nb };
}

/**
 * Apply user's edited values to the original template content.
 * Each value is replaced globally (all occurrences).
 */
function applyJarkomReplacements(content, original, newVal) {
    let r = content;

    // Safe global replace (only when value actually changed)
    const repAll = (old, neo) => {
        if (!old || old === neo) return;
        r = r.split(old).join(neo);
    };

    // Nama — replace the name wherever it appears
    repAll(original.nama, newVal.nama);

    // Angkatan — "Angkatan 16" → "Angkatan {new}" globally
    if (original.angkatan && newVal.angkatan !== original.angkatan) {
        r = r.split(`Angkatan ${original.angkatan}`).join(`Angkatan ${newVal.angkatan}`);
    }

    // Kegiatan — replace the kegiatan text (usually in bold)
    repAll(original.kegiatan, newVal.kegiatan);

    // Schedule fields — replace value on the line after the label
    const replaceLineVal = (label, oldV, newV) => {
        if (!oldV || oldV === newV) return;
        r = r.replace(
            new RegExp(`(${escapeRx(label)}\\s*[:\\t ]+)${escapeRx(oldV)}`, 'g'),
            `$1${newV}`
        );
    };

    replaceLineVal('Hari', original.hari, newVal.hari);
    replaceLineVal('Tanggal', original.tanggal, newVal.tanggal);
    replaceLineVal('Pukul', original.pukul, newVal.pukul);
    replaceLineVal('Lokasi', original.lokasi, newVal.lokasi);
    replaceLineVal('DC', original.dc, newVal.dc);

    // NB — replace existing, or append before closing salam if newly added
    const hasNBinTemplate = /NB\s*[:\t ]/.test(content);
    if (hasNBinTemplate) {
        if (original.nb !== newVal.nb) {
            r = r.replace(
                new RegExp(`(NB\\s*[:\\t ]+)${escapeRx(original.nb)}`, 'g'),
                `$1${newVal.nb}`
            );
        }
    } else if (newVal.nb) {
        // Append NB before closing wassalam
        const idx = r.lastIndexOf('*Wassalamu');
        const nbLine = `\n📝 *NB :*\n${newVal.nb}\n\n`;
        r = idx > -1 ? r.slice(0, idx) + nbLine + r.slice(idx) : r + `\n\n📝 *NB :*\n${newVal.nb}`;
    }

    return r;
}

let allTemplates = [];
let filters = { type: 'all', search: '' };

export async function render(container) {
    container.innerHTML = getSkeletonHTML();

    const { data: templates } = await fetchTemplates();
    allTemplates = templates || [];

    container.innerHTML = getPageHTML();
    if (window.lucide) lucide.createIcons({ nodes: [container] });

    renderTemplates();
    setupEvents();
}

function getPageHTML() {
    const canCreate = hasPermission('templates', 'create');

    return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Template</h1>
                <p class="page-subtitle">Library template pesan, caption, surat, dan pengumuman</p>
            </div>
            ${canCreate ? `
                <button class="btn btn-primary" id="add-template-btn">
                    <i data-lucide="plus"></i> Tambah Template
                </button>
            ` : ''}
        </div>
        
        <!-- Type Filter Tabs -->
        <div class="template-type-tabs">
            <button class="template-type-tab active" data-type="all">
                <i data-lucide="layout-template"></i> Semua
                <span class="tab-badge">${allTemplates.length}</span>
            </button>
            ${Object.entries(TEMPLATE_TYPES).map(([key, conf]) => `
                <button class="template-type-tab" data-type="${key}" style="--tab-color: ${conf.color}">
                    <i data-lucide="${conf.icon}"></i> ${conf.label}
                    <span class="tab-badge">${allTemplates.filter(t => t.type === key).length}</span>
                </button>
            `).join('')}
        </div>
        
        <!-- Search -->
        <div class="template-search">
            <div class="search-input-wrapper">
                <i data-lucide="search"></i>
                <input type="text" placeholder="Cari template..." id="template-search">
            </div>
        </div>
        
        <!-- Templates Grid -->
        <div class="templates-grid" id="templates-grid"></div>
    `;
}

function renderTemplates() {
    const grid = document.getElementById('templates-grid');
    if (!grid) return;

    let filtered = [...allTemplates];
    if (filters.type !== 'all') filtered = filtered.filter(t => t.type === filters.type);
    if (filters.search) {
        const s = filters.search.toLowerCase();
        filtered = filtered.filter(t =>
            t.title?.toLowerCase().includes(s) || t.content?.toLowerCase().includes(s)
        );
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i data-lucide="layout-template"></i>
                <h3>Tidak ada template</h3>
                <p>Tambahkan template baru untuk memulai</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(t => getTemplateCard(t)).join('');
    if (window.lucide) lucide.createIcons({ nodes: [grid] });
}

function getTemplateCard(template) {
    const typeConf = TEMPLATE_TYPES[template.type] || {};
    const preview = template.content.split('\n').slice(0, 3).join('\n');
    const isJarkom = template.title && template.title.toLowerCase().includes('jarkom');

    return `
        <div class="template-card" data-template-id="${template.id}">
            <div class="template-card-header">
                <div class="template-type-badge" style="background: ${typeConf.color}22; color: ${typeConf.color}">
                    <i data-lucide="${typeConf.icon}"></i>
                    ${typeConf.label}
                </div>
                ${isJarkom ? `<span class="jarkom-badge"><i data-lucide="send"></i> Jarkom</span>` : ''}
                ${template.is_favorite ? `<i data-lucide="star" class="text-warning" style="width:16px;height:16px;"></i>` : ''}
            </div>
            
            <h3 class="template-card-title">${template.title}</h3>
            
            <div class="template-preview">
                <pre class="template-preview-text">${preview}${template.content.split('\n').length > 3 ? '\n...' : ''}</pre>
            </div>
            
            <div class="template-card-tags">
                ${(template.tags || []).map(tag => `<span class="tag">#${tag}</span>`).join('')}
            </div>
            
            <div class="template-card-footer">
                <span class="text-xs text-muted">
                    <i data-lucide="copy"></i> Digunakan ${template.use_count || 0}x
                </span>
                <div class="template-card-btns">
                    ${isJarkom ? `
                        <button class="btn btn-success btn-sm jarkom-btn" title="Buat Jarkom" data-action="jarkom" data-id="${template.id}">
                            <i data-lucide="send"></i> Buat Jarkom
                        </button>
                    ` : ''}
                    <button class="btn btn-ghost btn-sm view-btn" title="Lihat Template" data-action="view" data-id="${template.id}">
                        <i data-lucide="eye"></i> Lihat
                    </button>
                    <button class="btn btn-ghost btn-sm" title="Edit" data-action="edit" data-id="${template.id}">
                        <i data-lucide="edit"></i> Edit
                    </button>
                    ${hasPermission('templates', 'delete') ? `
                        <button class="btn btn-ghost btn-sm text-danger" title="Hapus" data-action="delete" data-id="${template.id}" data-title="${template.title}">
                            <i data-lucide="trash-2"></i> Hapus
                        </button>
                    ` : ''}
                    <button class="btn btn-primary btn-sm copy-btn" data-id="${template.id}" data-content="${encodeURIComponent(template.content)}">
                        <i data-lucide="clipboard-copy"></i> Salin
                    </button>
                </div>
            </div>
        </div>
    `;
}

function showTemplateForm(template = null) {
    const isEdit = !!template;
    const isSurat = template?.type === 'surat';

    const formHTML = `
        <form id="template-form" class="form">
            <div class="form-group">
                <label>Jenis Template *</label>
                <select name="type" class="form-input" required id="tpl-type-select">
                    ${Object.entries(TEMPLATE_TYPES).map(([k, v]) =>
        `<option value="${k}" ${template?.type === k ? 'selected' : ''}>${v.label}</option>`
    ).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Judul Template *</label>
                <input type="text" name="title" class="form-input" placeholder="Nama template..." value="${template?.title || ''}" required>
            </div>
            
            <!-- File Upload (untuk Template Surat) -->
            <div class="form-group" id="tpl-file-group" style="display: ${isSurat ? 'block' : 'none'}">
                <label>Upload File Surat (Word/PDF)</label>
                <div class="file-upload-area" id="tpl-file-area">
                    ${template?.file_url ? `
                        <div class="file-attached">
                            <i data-lucide="file-text" style="width:20px;height:20px;color:var(--primary);"></i>
                            <span>File sudah diupload</span>
                            <a href="${template.file_url}" target="_blank" class="btn btn-ghost btn-sm" style="margin-left:auto;">
                                <i data-lucide="external-link"></i> Buka
                            </a>
                        </div>
                    ` : ''}
                    <input type="file" name="file" id="tpl-file-input" accept=".doc,.docx,.pdf,.odt" style="display:none;">
                    <button type="button" class="btn btn-ghost" id="tpl-file-btn" style="width:100%;padding:20px;border:2px dashed var(--border-hover);border-radius:12px;">
                        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
                            <i data-lucide="upload-cloud" style="width:32px;height:32px;color:var(--primary);"></i>
                            <span style="font-size:0.85rem;">Klik untuk upload file .docx / .pdf</span>
                            <span style="font-size:0.75rem;color:var(--text-muted);">Maks. 10MB</span>
                        </div>
                    </button>
                    <div id="tpl-file-name" style="margin-top:8px;font-size:0.85rem;color:var(--text-secondary);display:none;">
                        <i data-lucide="paperclip" style="width:14px;height:14px;"></i>
                        <span id="tpl-file-name-text"></span>
                    </div>
                </div>
                <span class="form-hint">Upload surat dalam format Word (.docx) atau PDF (.pdf)</span>
            </div>
            
            <!-- Link URL (untuk Template Surat - penomoran dll) -->
            <div class="form-group" id="tpl-link-group" style="display: ${isSurat ? 'block' : 'none'}">
                <label><i data-lucide="link" style="width:14px;height:14px;display:inline;vertical-align:middle;"></i> Link Spreadsheet / Dokumen Online</label>
                <input type="url" name="link_url" class="form-input" placeholder="https://docs.google.com/spreadsheets/d/..." value="${template?.link_url || ''}">
                <span class="form-hint">Link penomoran surat, Google Sheets, atau dokumen online lainnya</span>
            </div>
            
            <!-- Konten Template (opsional untuk surat) -->
            <div class="form-group" id="tpl-content-group">
                <label id="tpl-content-label">Konten Template *</label>
                <textarea name="content" class="form-input font-mono" rows="10" placeholder="Isi template... Gunakan {{nama_variabel}} untuk placeholder" id="tpl-content-textarea">${template?.content || ''}</textarea>
                <span class="form-hint" id="tpl-content-hint">Gunakan {{variabel}} untuk bagian yang dapat diganti</span>
            </div>
            
            <div class="form-group">
                <label>Tags (pisahkan dengan koma)</label>
                <input type="text" name="tags_str" class="form-input" placeholder="e.g. surat, undangan" value="${(template?.tags || []).join(', ')}">
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" name="is_favorite" ${template?.is_favorite ? 'checked' : ''}> Favorit
                </label>
            </div>
        </form>
    `;

    showModal({
        title: isEdit ? 'Edit Template' : 'Tambah Template',
        content: formHTML,
        size: 'lg',
        confirmText: isEdit ? 'Simpan' : 'Tambah',
        onConfirm: async () => {
            const form = document.getElementById('template-form');
            const fd = new FormData(form);
            const tagsStr = fd.get('tags_str') || '';
            const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
            const type = fd.get('type');

            const data = {
                type,
                title: fd.get('title'),
                content: fd.get('content') || '',
                tags,
                is_favorite: fd.has('is_favorite'),
                link_url: fd.get('link_url') || null,
            };

            // Handle file upload for 'surat' type
            const fileInput = document.getElementById('tpl-file-input');
            if (type === 'surat' && fileInput?.files?.length > 0) {
                const file = fileInput.files[0];
                toast.info('Mengupload file...');

                const fileExt = file.name.split('.').pop();
                const fileName = `templates/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

                const { error: uploadErr } = await getSupabase().storage
                    .from('documents')
                    .upload(fileName, file, { upsert: true });

                if (uploadErr) {
                    console.error('Upload error:', uploadErr);
                    toast.error('Gagal mengupload file: ' + uploadErr.message);
                    return;
                }

                const { data: urlData } = getSupabase().storage
                    .from('documents')
                    .getPublicUrl(fileName);

                data.file_url = urlData.publicUrl;
                if (!data.content) {
                    data.content = `[File: ${file.name}]`;
                }
            }

            if (isEdit) {
                const { error } = await updateTemplate(template.id, data);
                if (error) { toast.error('Gagal mengupdate template'); return; }
                toast.success('Template berhasil diupdate!');
            } else {
                const { error } = await createTemplate(data);
                if (error) { toast.error('Gagal menambah template'); return; }
                toast.success('Template berhasil ditambahkan!');
            }

            const { data: updated } = await fetchTemplates(filters);
            allTemplates = updated || [];
            renderTemplates();
        },
    });

    // Setup dynamic form behavior
    setTimeout(() => {
        if (window.lucide) lucide.createIcons();

        const typeSelect = document.getElementById('tpl-type-select');
        const fileGroup = document.getElementById('tpl-file-group');
        const linkGroup = document.getElementById('tpl-link-group');
        const contentLabel = document.getElementById('tpl-content-label');
        const contentTextarea = document.getElementById('tpl-content-textarea');
        const contentHint = document.getElementById('tpl-content-hint');
        const fileBtn = document.getElementById('tpl-file-btn');
        const fileInput = document.getElementById('tpl-file-input');
        const fileNameEl = document.getElementById('tpl-file-name');
        const fileNameText = document.getElementById('tpl-file-name-text');

        function updateFormForType(type) {
            if (type === 'surat') {
                fileGroup.style.display = 'block';
                linkGroup.style.display = 'block';
                contentLabel.textContent = 'Catatan (opsional)';
                contentTextarea.removeAttribute('required');
                contentTextarea.placeholder = 'Catatan tambahan untuk surat ini (opsional)...';
                contentTextarea.rows = 4;
                contentHint.textContent = 'Opsional — deskripsi atau catatan tambahan tentang surat ini';
            } else {
                fileGroup.style.display = 'none';
                linkGroup.style.display = 'none';
                contentLabel.textContent = 'Konten Template *';
                contentTextarea.setAttribute('required', '');
                contentTextarea.placeholder = 'Isi template... Gunakan {{nama_variabel}} untuk placeholder';
                contentTextarea.rows = 10;
                contentHint.textContent = 'Gunakan {{variabel}} untuk bagian yang dapat diganti';
            }
        }

        typeSelect?.addEventListener('change', (e) => updateFormForType(e.target.value));
        updateFormForType(typeSelect?.value);

        // File upload button
        fileBtn?.addEventListener('click', () => fileInput?.click());
        fileInput?.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                if (file.size > 10 * 1024 * 1024) {
                    toast.error('File terlalu besar. Maksimal 10MB.');
                    fileInput.value = '';
                    return;
                }
                fileNameText.textContent = file.name;
                fileNameEl.style.display = 'flex';
                fileNameEl.style.alignItems = 'center';
                fileNameEl.style.gap = '6px';
                if (window.lucide) lucide.createIcons({ nodes: [fileNameEl] });
            }
        });
    }, 100);
}

function setupEvents() {
    document.getElementById('add-template-btn')?.addEventListener('click', () => showTemplateForm());

    document.getElementById('template-search')?.addEventListener('input', debounce((e) => {
        filters.search = e.target.value;
        renderTemplates();
    }, 300));

    document.querySelectorAll('.template-type-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.template-type-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            filters.type = tab.dataset.type;
            renderTemplates();
        });
    });

    document.getElementById('templates-grid')?.addEventListener('click', async (e) => {
        // Jarkom button
        const jarkomBtn = e.target.closest('[data-action="jarkom"]');
        if (jarkomBtn) {
            const id = jarkomBtn.dataset.id;
            const template = allTemplates.find(t => t.id === id);
            if (template) showJarkomForm(template);
            return;
        }

        // Copy button
        const copyBtn = e.target.closest('.copy-btn');
        if (copyBtn) {
            const content = decodeURIComponent(copyBtn.dataset.content);
            const id = copyBtn.dataset.id;
            await copyToClipboard(content);
            await incrementUseCount(id);
            toast.success('Template berhasil disalin! 📋');
            copyBtn.innerHTML = '<i data-lucide="check"></i> Disalin!';
            setTimeout(() => {
                copyBtn.innerHTML = '<i data-lucide="clipboard-copy"></i> Salin';
                if (window.lucide) lucide.createIcons({ nodes: [copyBtn] });
            }, 2000);
            if (window.lucide) lucide.createIcons({ nodes: [copyBtn] });
            return;
        }

        // Edit
        const editBtn = e.target.closest('[data-action="edit"]');
        if (editBtn) {
            const id = editBtn.dataset.id;
            const template = allTemplates.find(t => t.id === id);
            if (template) showTemplateForm(template);
            return;
        }

        // View
        const viewBtn = e.target.closest('[data-action="view"]');
        if (viewBtn) {
            const id = viewBtn.dataset.id;
            const template = allTemplates.find(t => t.id === id);
            if (template) showTemplateView(template);
            return;
        }

        // Delete
        const deleteBtn = e.target.closest('[data-action="delete"]');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            const title = deleteBtn.dataset.title;
            confirmDelete(title, async () => {
                const { error } = await deleteTemplate(id);
                if (error) { toast.error('Gagal menghapus template'); return; }
                toast.success('Template dihapus');
                allTemplates = store.get('templates');
                renderTemplates();
            });
        }
    });
}

function showTemplateView(template) {
    const typeConf = TEMPLATE_TYPES[template.type] || {};
    const hasFile = template.type === 'surat' && template.file_url;

    const viewHTML = `
        <div class="template-view">
            <div class="template-view-meta" style="margin-bottom: 16px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <div class="template-type-badge" style="background: ${typeConf.color}22; color: ${typeConf.color}">
                    <i data-lucide="${typeConf.icon}"></i>
                    ${typeConf.label}
                </div>
                ${(template.tags || []).map(tag => `<span class="tag">#${tag}</span>`).join('')}
            </div>
            
            ${hasFile ? `
                <div style="
                    background: rgba(108,99,255,0.1);
                    border: 1px solid rgba(108,99,255,0.25);
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 16px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                ">
                    <div style="
                        width: 48px; height: 48px;
                        background: rgba(108,99,255,0.2);
                        border-radius: 12px;
                        display: flex; align-items: center; justify-content: center;
                        flex-shrink: 0;
                    ">
                        <i data-lucide="file-text" style="width:24px;height:24px;color:var(--primary);"></i>
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;font-size:0.9rem;">File Surat</div>
                        <div style="font-size:0.8rem;color:var(--text-muted);">Klik tombol di samping untuk membuka atau download file</div>
                    </div>
                    <div style="display:flex;gap:8px;flex-shrink:0;">
                        <a href="${template.file_url}" target="_blank" class="btn btn-primary btn-sm" style="text-decoration:none;">
                            <i data-lucide="external-link"></i> Buka File
                        </a>
                        <a href="${template.file_url}" download class="btn btn-ghost btn-sm" style="text-decoration:none;">
                            <i data-lucide="download"></i> Download
                        </a>
                    </div>
                </div>
            ` : ''}
            
            ${template.link_url ? `
                <a href="${template.link_url}" target="_blank" style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: rgba(16,185,129,0.1);
                    border: 1px solid rgba(16,185,129,0.25);
                    border-radius: 12px;
                    padding: 16px;
                    margin-bottom: 16px;
                    text-decoration: none;
                    color: inherit;
                    transition: all 0.2s;
                " onmouseover="this.style.background='rgba(16,185,129,0.15)'" onmouseout="this.style.background='rgba(16,185,129,0.1)'">
                    <div style="
                        width: 40px; height: 40px;
                        background: rgba(16,185,129,0.2);
                        border-radius: 10px;
                        display: flex; align-items: center; justify-content: center;
                        flex-shrink: 0;
                    ">
                        <i data-lucide="sheet" style="width:20px;height:20px;color:#10B981;"></i>
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;font-size:0.85rem;color:#10B981;">Penomoran Surat / Spreadsheet</div>
                        <div style="font-size:0.75rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${template.link_url}</div>
                    </div>
                    <i data-lucide="external-link" style="width:16px;height:16px;color:#10B981;flex-shrink:0;"></i>
                </a>
            ` : ''}
            ${template.content && !template.content.startsWith('[File:') ? `
                <pre style="
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 16px;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    font-family: 'Poppins', sans-serif;
                    font-size: 0.9rem;
                    line-height: 1.7;
                    color: var(--text);
                    max-height: 60vh;
                    overflow-y: auto;
                ">${template.content}</pre>
            ` : ''}
        </div>
    `;

    showModal({
        title: template.title,
        content: viewHTML,
        size: 'lg',
        confirmText: hasFile ? 'Tutup' : 'Salin Template',
        onConfirm: async () => {
            if (!hasFile) {
                await copyToClipboard(template.content);
                await incrementUseCount(template.id);
                toast.success('Template berhasil disalin! 📋');
            }
        },
    });

    setTimeout(() => {
        if (window.lucide) lucide.createIcons();
    }, 100);
}

// ============================================================
// JARKOM GENERATOR
// ============================================================

function showJarkomForm(template) {
    // 1. Parse nilai-nilai yang sudah ada di template
    const original = parseJarkomFromTemplate(template.content);
    const isoDate = parseIDtoISO(original.tanggal);

    // Helper: escape HTML attribute values
    const esc = (s) => (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');

    const formHTML = `
        <div class="jarkom-form-wrap">
            <!-- Info strip -->
            <div class="jarkom-template-info">
                <i data-lucide="file-text" style="width:16px;height:16px;flex-shrink:0;"></i>
                <span>Template: <strong>${template.title}</strong> — ubah kolom yang perlu diganti saja</span>
            </div>

            <div class="jarkom-fields-grid">
                <!-- Nama Pengirim -->
                <div class="form-group">
                    <label for="jf-nama">Nama Pengirim <span class="required-star">*</span></label>
                    <input type="text" id="jf-nama" class="form-input jarkom-input"
                           placeholder="cth: Haydar Rafi Anis"
                           value="${esc(original.nama)}">
                </div>

                <!-- Angkatan -->
                <div class="form-group">
                    <label for="jf-angkatan">Angkatan <span class="required-star">*</span>
                        <span class="optional-label">(target)</span>
                    </label>
                    <input type="text" id="jf-angkatan" class="form-input jarkom-input"
                           placeholder="cth: 16"
                           value="${esc(original.angkatan)}">
                </div>

                <!-- Kegiatan (full width) -->
                <div class="form-group jarkom-full-col">
                    <label for="jf-kegiatan">Nama Kegiatan <span class="required-star">*</span></label>
                    <input type="text" id="jf-kegiatan" class="form-input jarkom-input"
                           placeholder="cth: Tes Tulis Komunitas EEPROM 2025"
                           value="${esc(original.kegiatan)}">
                </div>

                <!-- Tanggal — date picker -->
                <div class="form-group">
                    <label for="jf-tanggal-picker">Tanggal <span class="required-star">*</span></label>
                    <div class="jarkom-date-wrap">
                        <input type="date" id="jf-tanggal-picker" class="form-input jarkom-input jarkom-date-input"
                               value="${isoDate}">
                        <div class="jarkom-date-preview" id="jf-tanggal-preview">
                            ${original.tanggal || '<em style="opacity:.5">Pilih tanggal...</em>'}
                        </div>
                    </div>
                </div>

                <!-- Hari — auto-filled dari date picker -->
                <div class="form-group">
                    <label for="jf-hari">Hari <span class="required-star">*</span>
                        <span class="jarkom-auto-badge" id="jf-hari-auto-badge" title="Terisi otomatis dari tanggal">
                            <i data-lucide="wand-2" style="width:10px;height:10px;"></i> Auto
                        </span>
                    </label>
                    <input type="text" id="jf-hari" class="form-input jarkom-input"
                           placeholder="cth: Selasa"
                           value="${esc(original.hari)}"
                           readonly>
                </div>

                <!-- Pukul -->
                <div class="form-group">
                    <label for="jf-pukul">Pukul <span class="required-star">*</span></label>
                    <input type="text" id="jf-pukul" class="form-input jarkom-input"
                           placeholder="cth: 19.00 WIB – selesai"
                           value="${esc(original.pukul)}">
                </div>

                <!-- Lokasi -->
                <div class="form-group">
                    <label for="jf-lokasi">Lokasi <span class="required-star">*</span></label>
                    <input type="text" id="jf-lokasi" class="form-input jarkom-input"
                           placeholder="cth: Basecamp Komunitas EEPROM"
                           value="${esc(original.lokasi)}">
                </div>

                <!-- DC — textarea karena bisa panjang -->
                <div class="form-group jarkom-full-col">
                    <label for="jf-dc">Dresscode (DC) <span class="optional-label">(opsional)</span></label>
                    <textarea id="jf-dc" class="form-input jarkom-input" rows="3"
                              placeholder="cth: Baju Bengkel, Celana Kain Hitam Panjang...">${esc(original.dc)}</textarea>
                </div>

                <!-- NB -->
                <div class="form-group jarkom-full-col">
                    <label for="jf-nb">NB / Catatan Tambahan <span class="optional-label">(kosongkan jika tidak ada)</span></label>
                    <textarea id="jf-nb" class="form-input jarkom-input" rows="2"
                              placeholder="cth: Harap datang 15 menit lebih awal">${esc(original.nb)}</textarea>
                </div>
            </div>

            <!-- Live Preview -->
            <div class="jarkom-preview-section">
                <div class="jarkom-preview-header">
                    <i data-lucide="message-circle" style="width:15px;height:15px;"></i>
                    <span>Preview Pesan WhatsApp</span>
                    <div style="margin-left:auto;display:flex;gap:6px;">
                        <button class="btn btn-primary btn-sm" id="jarkom-copy-btn">
                            <i data-lucide="clipboard-copy" style="width:14px;height:14px;"></i> Salin Sekarang
                        </button>
                    </div>
                </div>
                <pre id="jarkom-preview" class="jarkom-preview-text">${template.content}</pre>
            </div>
        </div>
    `;

    showModal({
        title: `✉️ Buat Jarkom — ${template.title}`,
        content: formHTML,
        size: 'xl',
        confirmText: 'Salin & Selesai',
        onConfirm: async () => {
            const text = document.getElementById('jarkom-preview')?.textContent || '';
            await copyToClipboard(text);
            await incrementUseCount(template.id);
            toast.success('Jarkom berhasil disalin! 📋');

            const saveCheck = document.getElementById('jarkom-save-check');
            if (saveCheck?.checked) {
                const title = document.getElementById('jarkom-save-title')?.value.trim()
                    || `${template.title} — ${new Date().toLocaleDateString('id-ID')}`;
                const { error } = await createTemplate({
                    type: 'whatsapp', title, content: text,
                    tags: [...(template.tags || []), 'jarkom'], is_favorite: false,
                });
                if (!error) {
                    toast.success('Template baru disimpan!');
                    const { data: updated } = await fetchTemplates();
                    allTemplates = updated || [];
                    renderTemplates();
                } else {
                    toast.error('Gagal menyimpan template');
                }
            }
        },
    });

    setTimeout(() => {
        if (window.lucide) lucide.createIcons();

        // Nilai yang sedang aktif (dimulai dari nilai original)
        const cur = { ...original };

        function updatePreview() {
            const el = document.getElementById('jarkom-preview');
            if (!el) return;
            el.textContent = applyJarkomReplacements(template.content, original, cur);
        }

        // Wire up text inputs
        [['jf-nama', 'nama'], ['jf-angkatan', 'angkatan'], ['jf-kegiatan', 'kegiatan'],
        ['jf-pukul', 'pukul'], ['jf-lokasi', 'lokasi'], ['jf-dc', 'dc'], ['jf-nb', 'nb']]
            .forEach(([id, key]) => {
                document.getElementById(id)?.addEventListener('input', (e) => {
                    cur[key] = e.target.value;
                    updatePreview();
                });
            });

        // Date picker → auto-fill hari + tanggal
        document.getElementById('jf-tanggal-picker')?.addEventListener('change', (e) => {
            const iso = e.target.value;
            if (!iso) return;
            const tgl = formatDateID(iso);
            const hari = getHariID(iso);
            cur.tanggal = tgl;
            cur.hari = hari;
            const prevEl = document.getElementById('jf-tanggal-preview');
            const hariEl = document.getElementById('jf-hari');
            if (prevEl) prevEl.textContent = tgl;
            if (hariEl) hariEl.value = hari;
            updatePreview();
        });

        // Salin dari preview
        document.getElementById('jarkom-copy-btn')?.addEventListener('click', async () => {
            const text = document.getElementById('jarkom-preview')?.textContent || '';
            await copyToClipboard(text);
            await incrementUseCount(template.id);
            toast.success('Jarkom disalin! 📋');
        });

        // Toggle save title
        document.getElementById('jarkom-save-check')?.addEventListener('change', (e) => {
            const wrap = document.getElementById('jarkom-save-title-wrap');
            if (wrap) wrap.style.display = e.target.checked ? 'block' : 'none';
            if (e.target.checked) {
                const el = document.getElementById('jarkom-save-title');
                if (el && !el.value) el.value = `${template.title} — ${new Date().toLocaleDateString('id-ID')}`;
            }
        });

        // Initial preview (tampilkan template asli dulu)
        updatePreview();
    }, 120);
}

function getSkeletonHTML() {
    return `<div class="templates-grid">${[1, 2, 3, 4, 5, 6].map(() => `<div class="card skeleton h-56"></div>`).join('')}</div>`;
}
