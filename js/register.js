/**
 * EEPROM Humas — Formulir Pendaftaran Publik
 * js/register.js
 *
 * Lapisan keamanan:
 *  1. Supabase RLS (server)  — anon hanya bisa INSERT, type='pendaftar'
 *  2. Honeypot               — jebak bot otomatis
 *  3. Rate limiting          — max 3/jam, cooldown 60 detik per device
 *  4. Sanitisasi input       — strip HTML, enforce max length
 *  5. Validasi format        — NIM, WA, email, required fields
 *  6. Unique constraint      — DB menolak NIM duplikat (error 23505)
 *
 * SQL yang WAJIB dijalankan di Supabase SQL Editor sebelum go-live:
 * ---------------------------------------------------------------
 * ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
 *
 * -- Hanya INSERT dengan type='pendaftar' yang boleh dari anon
 * CREATE POLICY "Public can register"
 * ON participants FOR INSERT TO anon
 * WITH CHECK (type = 'pendaftar');
 *
 * -- Hanya user login yang bisa baca/ubah/hapus
 * CREATE POLICY "Auth users full access"
 * ON participants FOR ALL TO authenticated
 * USING (true) WITH CHECK (true);
 *
 * -- Unique NIM agar tidak bisa daftar dua kali
 * ALTER TABLE participants
 *   ADD CONSTRAINT participants_nim_unique UNIQUE (nim);
 * ---------------------------------------------------------------
 */

'use strict';

// ============================================================
// KONFIGURASI — edit sesuai kebutuhan
// ============================================================

const SUPABASE_URL = 'https://kigeopwjpfismdgpwzjh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZ2VvcHdqcGZpc21kZ3B3empoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNTcwMDIsImV4cCI6MjA5OTgzMzAwMn0.aM4NuLQ3-27xbBiIgXhHbT7cnzlk4IgFNrhhlixGTto';

/**
 * Ganti ke false untuk menutup pendaftaran tanpa mengubah kode lain.
 * Admin cukup edit baris ini dan refresh/redeploy.
 */
const REGISTRATION_OPEN = true;

/** Pesan yang tampil saat pendaftaran ditutup */
const CLOSED_MESSAGE = 'Pendaftaran sedang ditutup. Pantau info resmi EEPROM untuk jadwal selanjutnya.';

const RATE = {
    cooldownMs : 60_000,  // 60 detik antar percobaan submit
    maxPerHour : 3,       // Maks 3 submit per jam per browser
    storageKey : 'eeprom_reg_v1',
};

// ============================================================
// SUPABASE CLIENT (anon — INSERT only via RLS)
// ============================================================

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
});

// ============================================================
// DOM HELPER
// ============================================================

const $ = (id) => document.getElementById(id);

// ============================================================
// SECURITY: RATE LIMITING
// ============================================================

function getRateRecord() {
    try {
        return JSON.parse(localStorage.getItem(RATE.storageKey)) || { attempts: [], last: 0 };
    } catch {
        return { attempts: [], last: 0 };
    }
}

function saveRateRecord(rec) {
    try { localStorage.setItem(RATE.storageKey, JSON.stringify(rec)); } catch { /* ignore */ }
}

/**
 * Cek apakah submit diperbolehkan.
 * @returns {{ ok: boolean, reason?: string, rec?: object, now?: number }}
 */
function checkRate() {
    const now = Date.now();
    const rec = getRateRecord();
    const oneHrAgo = now - 3_600_000;

    // Cooldown antara submit
    const msSinceLast = now - (rec.last || 0);
    if (rec.last && msSinceLast < RATE.cooldownMs) {
        const waitSec = Math.ceil((RATE.cooldownMs - msSinceLast) / 1000);
        return { ok: false, reason: `Tunggu ${waitSec} detik sebelum mencoba lagi.` };
    }

    // Kuota per jam
    rec.attempts = (rec.attempts || []).filter((t) => t > oneHrAgo);
    if (rec.attempts.length >= RATE.maxPerHour) {
        const nextSlot = rec.attempts[0] + 3_600_000;
        const waitMin = Math.ceil((nextSlot - now) / 60_000);
        return {
            ok: false,
            reason: `Terlalu banyak percobaan. Coba lagi dalam ${waitMin} menit.`,
        };
    }

    return { ok: true, rec, now };
}

function recordAttempt(rec, now) {
    rec.attempts.push(now);
    rec.last = now;
    saveRateRecord(rec);
}

// ============================================================
// SECURITY: SANITISASI INPUT
// ============================================================

/**
 * Strip karakter berbahaya + enforce max length.
 * @param {*} val
 * @param {number} maxLen
 */
function san(val, maxLen = 200) {
    return String(val ?? '')
        .trim()
        .replace(/[<>"'`\\]/g, '')   // strip HTML/injection chars
        .slice(0, maxLen);
}

// ============================================================
// VALIDASI FORM
// ============================================================

const RULES = {
    nama: (v) =>
        !v ? 'Nama lengkap wajib diisi'
        : v.length < 3 ? 'Nama terlalu pendek (minimal 3 karakter)'
        : '',

    panggilan: (v) => (!v ? 'Nama panggilan wajib diisi' : ''),

    nim: (v) =>
        !v ? 'NIM wajib diisi'
        : !/^\d{10,20}$/.test(v) ? 'NIM harus berupa angka (10–20 digit)'
        : '',

    angkatan: (v) => (!v ? 'Angkatan wajib dipilih' : ''),

    prodi: (v) => (!v ? 'Program studi wajib diisi' : ''),

    wa: (v) => {
        if (!v) return 'Nomor WhatsApp wajib diisi';
        const clean = v.replace(/[\s\-().+]/g, '');
        if (!/^(62|0)[0-9]{8,13}$/.test(clean))
            return 'Format tidak valid. Contoh: 081234567890 atau 6281234567890';
        return '';
    },

    email: (v) =>
        v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
            ? 'Format email tidak valid'
            : '',

    motivasi: (v) =>
        v.length > 500 ? `Maksimal 500 karakter (sekarang ${v.length})` : '',
};

function validate(data) {
    const errs = {};
    for (const [k, fn] of Object.entries(RULES)) {
        const msg = fn(data[k] || '');
        if (msg) errs[k] = msg;
    }
    return errs;
}

function showErrors(errs) {
    // Clear semua
    document.querySelectorAll('.field-err').forEach((el) => {
        el.textContent = '';
        el.classList.remove('visible');
    });
    document.querySelectorAll('.reg-input').forEach((el) => el.classList.remove('input-err'));

    // Set error
    for (const [field, msg] of Object.entries(errs)) {
        const errEl = $(`err-${field}`);
        const inpEl = $(`f-${field}`);
        if (errEl) { errEl.textContent = msg; errEl.classList.add('visible'); }
        if (inpEl) inpEl.classList.add('input-err');
    }
}

function clearError(field) {
    const errEl = $(`err-${field}`);
    const inpEl = $(`f-${field}`);
    if (errEl) { errEl.textContent = ''; errEl.classList.remove('visible'); }
    if (inpEl) inpEl.classList.remove('input-err');
}

// ============================================================
// UI STATE
// ============================================================

function setSubmitting(loading) {
    const btn  = $('submit-btn');
    const text = $('submit-text');
    const spin = $('submit-spin');
    if (!btn) return;
    btn.disabled = loading;
    if (text) text.textContent = loading ? 'Mengirim...' : 'Daftar Sekarang →';
    if (spin) spin.style.display = loading ? 'inline-block' : 'none';
}

function showGlobalError(msg) {
    const el = $('global-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'flex';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearGlobalError() {
    const el = $('global-error');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
}

function showSuccess({ nama, nim, angkatan }) {
    // Isi data konfirmasi
    const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
    const refCode = `#EPR-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    set('suc-nama',     nama);
    set('suc-nim',      nim);
    set('suc-angkatan', `Angkatan ${angkatan}`);
    set('suc-ref',      refCode);
    set('suc-ref-repeat', refCode);  // Sync repeat display

    // Ganti tampilan
    $('reg-wrap').style.display    = 'none';
    $('reg-success').style.display = 'flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// SUBMIT HANDLER
// ============================================================

async function handleSubmit(e) {
    e.preventDefault();
    clearGlobalError();

    // SECURITY 1: Honeypot — bot pasti mengisi field tersembunyi ini
    const hp = $('hp-website');
    if (hp && hp.value !== '') {
        // Fake success agar bot tidak tahu deteksi berhasil
        console.warn('[Security] Honeypot triggered — bot submission rejected');
        $('reg-wrap').style.display    = 'none';
        $('reg-success').style.display = 'flex';
        return;
    }

    // SECURITY 2: Rate limit
    const rateCheck = checkRate();
    if (!rateCheck.ok) {
        showGlobalError(rateCheck.reason);
        return;
    }

    // Kumpulkan data mentah dari form
    const raw = {
        nama      : $('f-nama')?.value      ?? '',
        panggilan : $('f-panggilan')?.value ?? '',
        nim       : $('f-nim')?.value       ?? '',
        angkatan  : $('f-angkatan')?.value  ?? '',
        prodi     : $('f-prodi')?.value     ?? '',
        wa        : $('f-wa')?.value        ?? '',
        email     : $('f-email')?.value     ?? '',
        motivasi  : $('f-motivasi')?.value  ?? '',
    };

    // SECURITY 3: Sanitisasi — strip HTML, enforce panjang max
    const data = {
        nama      : san(raw.nama,      100),
        panggilan : san(raw.panggilan, 50),
        nim       : san(raw.nim,       20).replace(/\D/g, ''), // digit only
        angkatan  : san(raw.angkatan,  10),
        prodi     : san(raw.prodi,     100),
        wa        : san(raw.wa,        20),
        email     : san(raw.email,     100).toLowerCase(),
        motivasi  : san(raw.motivasi,  500),
    };

    // SECURITY 4: Validasi format
    const errs = validate(data);
    if (Object.keys(errs).length > 0) {
        showErrors(errs);
        const firstErr = document.querySelector('.input-err');
        firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    // Mulai loading
    setSubmitting(true);

    try {
        // Catat rate limit attempt (sebelum insert untuk cegah race condition)
        recordAttempt(rateCheck.rec, rateCheck.now);

        // SECURITY 5 & 6:
        // type SELALU 'pendaftar' — tidak boleh dari input user
        // Jika NIM duplikat → DB unique constraint error (code 23505)
        const { error } = await db.from('participants').insert({
            type      : 'pendaftar',    // HARDCODED — tidak dari user input
            full_name : data.nama,
            nickname  : data.panggilan,
            nim       : data.nim,
            angkatan  : data.angkatan,
            prodi     : data.prodi,
            phone     : data.wa,
            email     : data.email  || null,
            notes     : data.motivasi || null,
        });

        if (error) {
            // NIM sudah terdaftar (unique constraint violation)
            if (error.code === '23505' || error.message?.toLowerCase().includes('duplicate')) {
                showErrors({ nim: `NIM ${data.nim} sudah terdaftar. Hubungi panitia jika ada kesalahan.` });
                setSubmitting(false);
                return;
            }
            throw error;
        }

        // Berhasil!
        showSuccess({ nama: data.nama, nim: data.nim, angkatan: data.angkatan });

    } catch (err) {
        console.error('[Register] Submission error:', err);
        showGlobalError(
            'Gagal mengirim data. Periksa koneksi internet dan coba lagi. ' +
            'Jika masalah berlanjut, hubungi panitia.'
        );
        setSubmitting(false);
    }
}

// ============================================================
// INLINE ERROR CLEAR + CHAR COUNTER
// ============================================================

function bindInputEvents() {
    const fieldIds = {
        'f-nama'      : 'nama',
        'f-panggilan' : 'panggilan',
        'f-nim'       : 'nim',
        'f-angkatan'  : 'angkatan',
        'f-prodi'     : 'prodi',
        'f-wa'        : 'wa',
        'f-email'     : 'email',
        'f-motivasi'  : 'motivasi',
    };

    for (const [elId, field] of Object.entries(fieldIds)) {
        $(elId)?.addEventListener('input', () => clearError(field));
    }

    // Karakter counter untuk textarea motivasi
    $('f-motivasi')?.addEventListener('input', function () {
        const counter = $('motivasi-counter');
        if (counter) {
            const len = this.value.length;
            counter.textContent = `${len} / 500`;
            counter.style.color = len > 450 ? '#F59E0B' : len > 500 ? '#EF4444' : '#64748b';
        }
    });

    // NIM: hanya angka
    $('f-nim')?.addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '');
    });
}

// ============================================================
// ANGKATAN SELECT — generate tahun secara dinamis
// ============================================================

function populateAngkatan() {
    const select = $('f-angkatan');
    if (!select) return;
    const currentYear = new Date().getFullYear();
    // Dari tahun ini + 1 ke belakang sampai 2018
    for (let y = currentYear + 1; y >= 2018; y--) {
        const opt = document.createElement('option');
        opt.value = String(y);
        opt.textContent = `Angkatan ${y}`;
        select.appendChild(opt);
    }
}

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    populateAngkatan();

    if (!REGISTRATION_OPEN) {
        // Tampilkan pesan tutup
        const msgEl = $('closed-msg');
        if (msgEl) msgEl.textContent = CLOSED_MESSAGE;
        $('page-loading').style.display = 'none';
        $('reg-closed').style.display   = 'flex';
        $('reg-wrap').style.display     = 'none';
        $('reg-success').style.display  = 'none';
        return;
    }

    // Tampilkan form
    $('page-loading').style.display = 'none';
    $('reg-closed').style.display   = 'none';
    $('reg-wrap').style.display     = '';
    $('reg-success').style.display  = 'none';

    $('reg-form')?.addEventListener('submit', handleSubmit);
    bindInputEvents();
});
