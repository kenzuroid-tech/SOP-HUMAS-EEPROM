# EEPROM Humas Management System

Sistem manajemen internal Divisi Humas Komunitas EEPROM untuk mendokumentasikan seluruh kegiatan selama satu periode kepengurusan.

## 🚀 Cara Menjalankan

### Demo Mode (tanpa Supabase)
1. Buka `index.html` di browser via server lokal (misalnya Live Server VS Code)
2. Gunakan salah satu akun demo:
   - **Super Admin**: `admin@eeprom.ac.id` + password apapun (min. 6 karakter)
   - **Ketua Humas**: `ketua@eeprom.ac.id` + password apapun
   - **Staff Humas**: `staff@eeprom.ac.id` + password apapun

### Mode Supabase (Produksi)
1. Buat project di [supabase.com](https://supabase.com)
2. Jalankan SQL di `sql/schema.sql` di Query Editor Supabase
3. Edit `js/config.js`:
   ```js
   export const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
   export const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
   // Ubah:
   demoMode: false,
   ```
4. Buat Storage Buckets: `avatars`, `documents`, `program-covers`
5. Buka `index.html` via server lokal

## 📁 Struktur Proyek

```
SOP Humas EEPROM/
├── index.html          # Login page
├── app.html            # App shell (SPA)
├── style.css           # Design system global
├── sql/
│   └── schema.sql      # Database schema PostgreSQL
└── js/
    ├── config.js       # Konfigurasi app & Supabase
    ├── mockData.js     # Data dummy untuk Demo Mode
    ├── utils.js        # Utility functions
    ├── store.js        # Reactive state management
    ├── auth.js         # Authentication
    ├── router.js       # SPA Router
    ├── api/
    │   ├── programs.js
    │   ├── tasks.js
    │   ├── timeline.js
    │   ├── documents.js
    │   ├── templates.js
    │   ├── evaluations.js
    │   └── database.js
    ├── components/
    │   ├── sidebar.js
    │   └── header.js
    └── pages/
        ├── dashboard.js
        ├── programs.js
        ├── programDetail.js
        ├── tasks.js
        ├── timeline.js
        ├── templates.js
        ├── database.js
        ├── documents.js
        ├── evaluations.js
        └── settings.js
```

## ✨ Fitur

| Fitur | Deskripsi |
|-------|-----------|
| 🔐 **Auth** | Login multi-role (Super Admin, Ketua, Staff) |
| 📊 **Dashboard** | Stats, progress program, chart, mini calendar, activity log |
| 📋 **Program Kerja** | 8 program kerja dengan detail, checklist, progress |
| ✅ **Task Management** | List & Kanban view, filter, priority, deadline tracking |
| 🗓️ **Timeline** | Kalender interaktif semua event kegiatan |
| 📝 **Template** | Library template WA/IG/surat dengan copy-to-clipboard |
| 🗄️ **Database** | Data mahasiswa baru, alumni, pendaftar, contact person |
| 📸 **Dokumentasi** | Gallery foto dengan drag-drop upload & lightbox |
| ⭐ **Evaluasi** | Form evaluasi per program dengan scoring 1-10 |
| ⚙️ **Settings** | Edit profil, ganti password, upload avatar |

## 🎨 Teknologi

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Design**: Dark Mode, Glassmorphism, Poppins Font, Lucide Icons
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Charts**: Chart.js
- **Routing**: Custom SPA Router (hash-based)

## 👥 Role & Permission

| Fitur | Super Admin | Ketua Humas | Staff Humas |
|-------|:-----------:|:-----------:|:-----------:|
| Kelola Program | ✅ | ✅ | 👁️ |
| Kelola Task | ✅ | ✅ | ✅ |
| Upload Dokumentasi | ✅ | ✅ | ✅ |
| Kelola Template | ✅ | ✅ | 👁️ |
| Kelola Database | ✅ | ✅ | 👁️ |
| Isi Evaluasi | ✅ | ✅ | ❌ |
| Kelola Anggota | ✅ | ❌ | ❌ |
