-- ============================================================
-- EEPROM Humas — Setup Keamanan Halaman Pendaftaran Publik
-- File: sql/register_security_setup.sql
--
-- Jalankan script ini di:
-- Supabase Dashboard → SQL Editor → New Query → Paste → Run
--
-- WAJIB dijalankan sebelum register.html digunakan publik!
-- ============================================================


-- ============================================================
-- 1. AKTIFKAN ROW LEVEL SECURITY (RLS)
--    Tanpa ini, anon key bisa baca SEMUA data peserta!
-- ============================================================

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 2. POLICY: Publik (anon) hanya bisa INSERT sebagai 'pendaftar'
--    - Tidak bisa SELECT (baca data orang lain)
--    - Tidak bisa UPDATE atau DELETE
--    - Hanya bisa INSERT dengan type = 'pendaftar'
-- ============================================================

-- Hapus policy lama jika sudah ada (agar tidak konflik)
DROP POLICY IF EXISTS "Public can register" ON participants;

CREATE POLICY "Public can register"
ON participants
FOR INSERT
TO anon
WITH CHECK (type = 'pendaftar');


-- ============================================================
-- 3. POLICY: User yang login bisa akses semua data
-- ============================================================

DROP POLICY IF EXISTS "Auth users full access" ON participants;

CREATE POLICY "Auth users full access"
ON participants
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);


-- ============================================================
-- 4. UNIQUE CONSTRAINT pada NIM
--    Mencegah pendaftaran ganda dengan NIM yang sama.
--    Error code 23505 akan ditangkap oleh register.js
-- ============================================================

-- Hapus constraint lama jika ada
ALTER TABLE participants
    DROP CONSTRAINT IF EXISTS participants_nim_unique;

-- Tambah unique constraint (hanya untuk baris non-null)
ALTER TABLE participants
    ADD CONSTRAINT participants_nim_unique
    UNIQUE (nim);


-- ============================================================
-- 5. VERIFIKASI — Cek apakah setup berhasil
-- ============================================================

-- Cek RLS aktif
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename = 'participants';

-- Cek policies yang aktif
SELECT
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'participants'
ORDER BY policyname;

-- Cek constraints
SELECT
    conname AS constraint_name,
    contype AS constraint_type
FROM pg_constraint
WHERE conrelid = 'participants'::regclass
ORDER BY conname;


-- ============================================================
-- CATATAN KEAMANAN
-- ============================================================
--
-- Anon key Supabase memang terekspos di frontend (register.html).
-- Ini NORMAL dan AMAN selama RLS diaktifkan dengan benar.
-- Yang melindungi bukan kerahasiaan key, tapi POLICY di atas.
--
-- Dengan setup ini:
-- ✅ Publik hanya bisa DAFTAR (INSERT)
-- ✅ Publik TIDAK bisa baca daftar peserta lain
-- ✅ Publik TIDAK bisa ubah atau hapus data
-- ✅ NIM tidak bisa didaftarkan dua kali
-- ✅ Hanya user login (admin) yang bisa kelola semua data
--
-- ============================================================
