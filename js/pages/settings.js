/**
 * EEPROM Humas Management System
 * Settings Page
 */

import { store } from '../store.js';
import { updateProfile, changePassword, uploadAvatar, logout } from '../auth.js';
import { toast, showModal, confirmDelete, setButtonLoading, isValidEmail } from '../utils.js';

export async function render(container) {
    const user = store.get('user');
    
    container.innerHTML = getPageHTML(user);
    if (window.lucide) lucide.createIcons({ nodes: [container] });
    
    setupEvents(user);
}

function getPageHTML(user) {
    const roleLabels = {
        super_admin: 'Super Admin',
        ketua_humas: 'Ketua Humas',
        anggota_humas: 'Anggota Humas',
    };
    
    return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Setting</h1>
                <p class="page-subtitle">Kelola profil dan preferensi akun Anda</p>
            </div>
        </div>
        
        <div class="settings-layout">
            <!-- Sidebar Menu -->
            <div class="settings-nav-card card">
                <div class="settings-nav-profile">
                    <div class="settings-avatar-wrapper">
                        <div class="avatar avatar-xl" id="settings-avatar" style="background: linear-gradient(135deg, #6C63FF, #8B5CF6); font-size: 1.5rem">
                            ${user?.avatar_url ? `<img src="${user.avatar_url}" alt="${user?.full_name}">` : (user?.full_name?.charAt(0) || 'U')}
                        </div>
                        <button class="avatar-edit-btn" id="avatar-upload-btn" title="Ganti foto">
                            <i data-lucide="camera"></i>
                        </button>
                        <input type="file" id="avatar-file-input" accept="image/*" class="hidden">
                    </div>
                    <div class="settings-nav-name">${user?.full_name || 'User'}</div>
                    <div class="settings-nav-role badge badge-primary">${roleLabels[user?.role] || user?.role}</div>
                </div>
                <nav class="settings-nav">
                    <button class="settings-nav-item active" data-section="profile">
                        <i data-lucide="user"></i> Profil Saya
                    </button>
                    <button class="settings-nav-item" data-section="password">
                        <i data-lucide="lock"></i> Ubah Password
                    </button>
                    <button class="settings-nav-item" data-section="preferences">
                        <i data-lucide="sliders"></i> Preferensi
                    </button>
                    <hr class="divider">
                    <button class="settings-nav-item text-danger" id="logout-settings-btn">
                        <i data-lucide="log-out"></i> Keluar
                    </button>
                </nav>
            </div>
            
            <!-- Content Sections -->
            <div class="settings-content">
                <!-- Profile Section -->
                <div class="settings-section active" id="section-profile">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i data-lucide="user"></i> Informasi Profil</h3>
                        </div>
                        <div class="card-body">
                            <form id="profile-form" class="form">
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label>Nama Lengkap *</label>
                                        <input type="text" name="full_name" class="form-input" value="${user?.full_name || ''}" required>
                                    </div>
                                    <div class="form-group">
                                        <label>Nama Panggilan</label>
                                        <input type="text" name="nickname" class="form-input" value="${user?.nickname || ''}">
                                    </div>
                                    <div class="form-group">
                                        <label>Email</label>
                                        <input type="email" name="email" class="form-input" value="${user?.email || ''}" disabled>
                                        <span class="form-hint">Email tidak dapat diubah</span>
                                    </div>
                                    <div class="form-group">
                                        <label>No. HP</label>
                                        <input type="text" name="phone" class="form-input" value="${user?.phone || ''}" placeholder="08xxxxxxxxxx">
                                    </div>
                                    <div class="form-group">
                                        <label>NIM</label>
                                        <input type="text" name="nim" class="form-input" value="${user?.nim || ''}">
                                    </div>
                                    <div class="form-group">
                                        <label>Angkatan</label>
                                        <input type="text" name="angkatan" class="form-input" value="${user?.angkatan || ''}" placeholder="e.g. 2022">
                                    </div>
                                    <div class="form-group">
                                        <label>Jabatan</label>
                                        <input type="text" name="jabatan" class="form-input" value="${user?.jabatan || ''}" placeholder="e.g. Staff Humas">
                                    </div>
                                    <div class="form-group">
                                        <label>Divisi</label>
                                        <input type="text" name="divisi" class="form-input" value="${user?.divisi || 'Humas'}" disabled>
                                    </div>
                                    <div class="form-group span-2">
                                        <label>Bio / Deskripsi</label>
                                        <textarea name="bio" class="form-input" rows="3" placeholder="Ceritakan sedikit tentang diri Anda...">${user?.bio || ''}</textarea>
                                    </div>
                                </div>
                                <div class="form-actions">
                                    <button type="submit" class="btn btn-primary" id="save-profile-btn">
                                        <i data-lucide="save"></i> Simpan Perubahan
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                
                <!-- Password Section -->
                <div class="settings-section" id="section-password">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i data-lucide="lock"></i> Ubah Password</h3>
                        </div>
                        <div class="card-body">
                            <form id="password-form" class="form">
                                <div class="form-group">
                                    <label>Password Baru *</label>
                                    <div class="password-input-wrapper">
                                        <input type="password" name="new_password" class="form-input" placeholder="Minimal 8 karakter..." required id="new-pass-input">
                                        <button type="button" class="password-toggle" id="toggle-new-pass">
                                            <i data-lucide="eye"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>Konfirmasi Password *</label>
                                    <div class="password-input-wrapper">
                                        <input type="password" name="confirm_password" class="form-input" placeholder="Ulangi password baru..." required id="confirm-pass-input">
                                        <button type="button" class="password-toggle" id="toggle-confirm-pass">
                                            <i data-lucide="eye"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <!-- Password strength -->
                                <div class="password-strength" id="password-strength">
                                    <div class="strength-bars">
                                        <div class="strength-bar" id="bar-1"></div>
                                        <div class="strength-bar" id="bar-2"></div>
                                        <div class="strength-bar" id="bar-3"></div>
                                        <div class="strength-bar" id="bar-4"></div>
                                    </div>
                                    <span class="strength-label" id="strength-label">Masukkan password</span>
                                </div>
                                
                                <div class="form-actions">
                                    <button type="submit" class="btn btn-primary" id="save-password-btn">
                                        <i data-lucide="lock"></i> Ubah Password
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                
                <!-- Preferences Section -->
                <div class="settings-section" id="section-preferences">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i data-lucide="sliders"></i> Preferensi</h3>
                        </div>
                        <div class="card-body">
                            <div class="preference-item">
                                <div class="preference-info">
                                    <div class="preference-label">Notifikasi Deadline</div>
                                    <div class="text-sm text-muted">Terima notifikasi saat deadline task mendekat</div>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" checked>
                                    <span class="toggle-track"></span>
                                </label>
                            </div>
                            <div class="preference-item">
                                <div class="preference-info">
                                    <div class="preference-label">Notifikasi Task Baru</div>
                                    <div class="text-sm text-muted">Terima notifikasi saat ada task baru ditugaskan</div>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" checked>
                                    <span class="toggle-track"></span>
                                </label>
                            </div>
                            <div class="preference-item">
                                <div class="preference-info">
                                    <div class="preference-label">Sidebar Collapsed Default</div>
                                    <div class="text-sm text-muted">Sidebar dimulai dalam keadaan kecil</div>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="pref-sidebar-collapsed">
                                    <span class="toggle-track"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <!-- App Info -->
                    <div class="card mt-4">
                        <div class="card-header">
                            <h3 class="card-title"><i data-lucide="info"></i> Informasi Aplikasi</h3>
                        </div>
                        <div class="card-body">
                            <dl class="info-list">
                                <dt>Aplikasi</dt><dd>EEPROM Humas Management System</dd>
                                <dt>Versi</dt><dd>1.0.0</dd>
                                <dt>Mode</dt><dd>
                                    <span class="badge badge-warning">Demo Mode</span>
                                </dd>
                                <dt>Role Anda</dt><dd>${roleLabels[user?.role] || user?.role}</dd>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function setupEvents(user) {
    // Section navigation
    document.querySelectorAll('.settings-nav-item[data-section]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`section-${btn.dataset.section}`)?.classList.add('active');
        });
    });
    
    // Logout
    document.getElementById('logout-settings-btn')?.addEventListener('click', () => {
        showModal({
            title: 'Konfirmasi Keluar',
            content: `
                <div class="confirm-delete-body">
                    <div class="confirm-icon" style="background: rgba(239,68,68,0.1); color: #EF4444">
                        <i data-lucide="log-out"></i>
                    </div>
                    <p>Apakah kamu yakin ingin keluar dari sistem?</p>
                </div>
            `,
            confirmText: 'Ya, Keluar',
            cancelText: 'Batal',
            confirmClass: 'btn-danger',
            onConfirm: logout,
        });
    });
    
    // Avatar upload
    document.getElementById('avatar-upload-btn')?.addEventListener('click', () => {
        document.getElementById('avatar-file-input')?.click();
    });
    
    document.getElementById('avatar-file-input')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Ukuran file maksimal 5MB');
            return;
        }
        toast.info('Mengupload foto profil...');
        const { url, error } = await uploadAvatar(file);
        if (error) {
            toast.error('Gagal upload foto profil');
        } else {
            toast.success('Foto profil berhasil diubah!');
            const avatar = document.getElementById('settings-avatar');
            if (avatar) avatar.innerHTML = `<img src="${url}" alt="Avatar">`;
        }
    });
    
    // Profile form
    document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-profile-btn');
        setButtonLoading(btn, true);
        
        const fd = new FormData(e.target);
        const updates = {
            full_name: fd.get('full_name'),
            nickname: fd.get('nickname'),
            phone: fd.get('phone'),
            nim: fd.get('nim'),
            angkatan: fd.get('angkatan'),
            jabatan: fd.get('jabatan'),
            bio: fd.get('bio'),
        };
        
        const { error } = await updateProfile(updates);
        setButtonLoading(btn, false);
        
        if (error) {
            toast.error('Gagal menyimpan profil');
        } else {
            toast.success('Profil berhasil disimpan!');
        }
    });
    
    // Password form
    document.getElementById('password-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-password-btn');
        const fd = new FormData(e.target);
        const newPass = fd.get('new_password');
        const confirmPass = fd.get('confirm_password');
        
        if (newPass.length < 8) {
            toast.warning('Password minimal 8 karakter');
            return;
        }
        if (newPass !== confirmPass) {
            toast.error('Konfirmasi password tidak cocok');
            return;
        }
        
        setButtonLoading(btn, true);
        const { error } = await changePassword(newPass);
        setButtonLoading(btn, false);
        
        if (error) {
            toast.error('Gagal mengubah password');
        } else {
            toast.success('Password berhasil diubah!');
            e.target.reset();
        }
    });
    
    // Password strength
    document.getElementById('new-pass-input')?.addEventListener('input', (e) => {
        updatePasswordStrength(e.target.value);
    });
    
    // Password toggle visibility
    setupPasswordToggle('new-pass-input', 'toggle-new-pass');
    setupPasswordToggle('confirm-pass-input', 'toggle-confirm-pass');
}

function setupPasswordToggle(inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    
    btn?.addEventListener('click', () => {
        const isText = input.type === 'text';
        input.type = isText ? 'password' : 'text';
        btn.innerHTML = `<i data-lucide="${isText ? 'eye' : 'eye-off'}"></i>`;
        if (window.lucide) lucide.createIcons({ nodes: [btn] });
    });
}

function updatePasswordStrength(password) {
    const bars = [1,2,3,4].map(i => document.getElementById(`bar-${i}`));
    const label = document.getElementById('strength-label');
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    const colors = ['', '#EF4444', '#F59E0B', '#10B981', '#6C63FF'];
    const labels = ['', 'Lemah', 'Cukup', 'Kuat', 'Sangat Kuat'];
    
    bars.forEach((bar, i) => {
        if (!bar) return;
        bar.style.background = i < strength ? colors[strength] : 'rgba(255,255,255,0.1)';
    });
    
    if (label) {
        label.textContent = labels[strength] || 'Masukkan password';
        label.style.color = colors[strength] || '#94A3B8';
    }
}
