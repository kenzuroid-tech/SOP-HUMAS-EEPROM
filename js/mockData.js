/**
 * EEPROM Humas Management System
 * Mock Data for Demo Mode
 * 
 * Used when APP_CONFIG.demoMode = true
 * Simulates Supabase responses for development/preview
 */

export const MOCK_USER = {
    id: 'mock-user-001',
    email: '244107020014@student.polinema.ac.id',
    full_name: 'Siti Nikmatus Sholihah',
    nickname: 'Nishoa',
    role: 'super_admin',
    avatar_url: null,
    phone: '082331773806',
    nim: '244107020014',
    angkatan: '2024',
    divisi: 'Humas',
    jabatan: 'Ketua Divisi Humas',
    bio: 'Ketua Divisi Humas EEPROM periode 2025/2026',
    is_active: true,
};

export const MOCK_PROGRAMS = [
    {
        id: 'prog-001', code: 'PRASTUDI', name: 'Prastudi', short_name: 'Prastudi',
        description: 'Program orientasi pra-studi untuk mahasiswa baru EEPROM',
        status: 'planning', progress: 0, sort_order: 1,
        start_date: '2025-08-01', end_date: '2025-08-31',
        pic_id: 'mock-user-001', pic_name: 'Siti Nikmatus Sholihah',
        total_tasks: 12, done_tasks: 0, total_documents: 0, total_events: 0,
        color: '#6C63FF', icon: 'book-open',
    },
    {
        id: 'prog-002', code: 'EXPO_KELEM', name: 'Expo Kelembagaan', short_name: 'Expo Kelem',
        description: 'Pameran kelembagaan untuk memperkenalkan EEPROM kepada mahasiswa baru',
        status: 'planning', progress: 0, sort_order: 2,
        start_date: '2025-09-01', end_date: '2025-09-30',
        pic_id: 'mock-user-002', pic_name: 'Siti Rahayu',
        total_tasks: 8, done_tasks: 0, total_documents: 0, total_events: 0,
        color: '#8B5CF6', icon: 'layout',
    },
    {
        id: 'prog-003', code: 'GEMILANG', name: 'Gemilang Prestasi', short_name: 'Gemilang',
        description: 'Program apresiasi prestasi anggota EEPROM',
        status: 'planning', progress: 0, sort_order: 3,
        start_date: '2025-10-01', end_date: '2025-10-31',
        pic_id: 'mock-user-003', pic_name: 'Budi Santoso',
        total_tasks: 10, done_tasks: 0, total_documents: 0, total_events: 0,
        color: '#EC4899', icon: 'award',
    },
    {
        id: 'prog-004', code: 'OPEN_REC', name: 'Open Recruitment', short_name: 'Open Rec',
        description: 'Rekrutmen terbuka anggota baru Humas EEPROM',
        status: 'planning', progress: 0, sort_order: 4,
        start_date: '2025-09-15', end_date: '2025-10-15',
        pic_id: 'mock-user-002', pic_name: 'Siti Rahayu',
        total_tasks: 15, done_tasks: 0, total_documents: 0, total_events: 0,
        color: '#F59E0B', icon: 'users-plus',
    },
    {
        id: 'prog-005', code: 'TES_TULIS', name: 'Tes Tulis', short_name: 'Tes Tulis',
        description: 'Pelaksanaan tes tulis seleksi anggota baru',
        status: 'planning', progress: 0, sort_order: 5,
        start_date: '2025-10-20', end_date: '2025-10-25',
        pic_id: 'mock-user-003', pic_name: 'Budi Santoso',
        total_tasks: 6, done_tasks: 0, total_documents: 0, total_events: 0,
        color: '#10B981', icon: 'pen-line',
    },
    {
        id: 'prog-006', code: 'TES_WAWANCARA', name: 'Tes Wawancara', short_name: 'Tes Interview',
        description: 'Pelaksanaan tes wawancara seleksi anggota baru',
        status: 'planning', progress: 0, sort_order: 6,
        start_date: '2025-10-27', end_date: '2025-11-05',
        pic_id: 'mock-user-001', pic_name: 'Siti Nikmatus Sholihah',
        total_tasks: 8, done_tasks: 0, total_documents: 0, total_events: 0,
        color: '#06B6D4', icon: 'message-square',
    },
    {
        id: 'prog-007', code: 'DIKLAT_RUANG', name: 'Diklat Ruang', short_name: 'Diklat Ruang',
        description: 'Pendidikan dan latihan dalam ruangan untuk anggota baru',
        status: 'planning', progress: 0, sort_order: 7,
        start_date: '2025-11-10', end_date: '2025-11-20',
        pic_id: 'mock-user-004', pic_name: 'Dewi Lestari',
        total_tasks: 10, done_tasks: 0, total_documents: 0, total_events: 0,
        color: '#F97316', icon: 'presentation',
    },
    {
        id: 'prog-008', code: 'DIKLAT_LAPANG', name: 'Diklat Lapang', short_name: 'Diklat Lapang',
        description: 'Pendidikan dan latihan lapangan untuk anggota baru',
        status: 'planning', progress: 0, sort_order: 8,
        start_date: '2025-11-25', end_date: '2025-12-05',
        pic_id: 'mock-user-004', pic_name: 'Dewi Lestari',
        total_tasks: 12, done_tasks: 0, total_documents: 0, total_events: 0,
        color: '#84CC16', icon: 'mountain',
    },
];

export const MOCK_TASKS = [
    {
        id: 'task-001', program_id: 'prog-004', title: 'Desain poster Open Recruitment',
        description: 'Buat poster digital untuk promosi open recruitment di media sosial',
        category: 'Desain', priority: 'high', status: 'done', progress: 100,
        assigned_to: 'mock-user-002', assignee_name: 'Siti Rahayu', assignee_nickname: 'Siti',
        program_name: 'Open Recruitment', program_code: 'OPEN_REC',
        deadline: '2025-09-10T23:59:00Z', completed_at: '2025-09-09T15:00:00Z',
        created_at: '2025-09-01T08:00:00Z', tags: ['desain', 'publikasi'],
    },
    {
        id: 'task-002', program_id: 'prog-004', title: 'Buat form pendaftaran online',
        description: 'Setup Google Form untuk pendaftaran open recruitment',
        category: 'Administrasi', priority: 'high', status: 'done', progress: 100,
        assigned_to: 'mock-user-001', assignee_name: 'Ahmad Fauzi', assignee_nickname: 'Fauzi',
        program_name: 'Open Recruitment', program_code: 'OPEN_REC',
        deadline: '2025-09-12T23:59:00Z', completed_at: '2025-09-11T10:00:00Z',
        created_at: '2025-09-01T08:00:00Z', tags: ['administrasi', 'form'],
    },
    {
        id: 'task-003', program_id: 'prog-004', title: 'Broadcast informasi ke grup alumni',
        description: 'Kirim broadcast pesan open recruitment ke seluruh grup alumni dan angkatan',
        category: 'Publikasi', priority: 'medium', status: 'in_progress', progress: 60,
        assigned_to: 'mock-user-003', assignee_name: 'Budi Santoso', assignee_nickname: 'Budi',
        program_name: 'Open Recruitment', program_code: 'OPEN_REC',
        deadline: '2025-10-05T23:59:00Z', completed_at: null,
        created_at: '2025-09-20T08:00:00Z', tags: ['publikasi', 'broadcast'],
    },
    {
        id: 'task-004', program_id: 'prog-003', title: 'Kumpulkan data prestasi anggota',
        description: 'Rekap seluruh prestasi anggota EEPROM periode 2024/2025',
        category: 'Administrasi', priority: 'high', status: 'in_progress', progress: 70,
        assigned_to: 'mock-user-004', assignee_name: 'Dewi Lestari', assignee_nickname: 'Dewi',
        program_name: 'Gemilang Prestasi', program_code: 'GEMILANG',
        deadline: '2025-10-15T23:59:00Z', completed_at: null,
        created_at: '2025-10-01T08:00:00Z', tags: ['data', 'prestasi'],
    },
    {
        id: 'task-005', program_id: 'prog-003', title: 'Desain sertifikat penghargaan',
        description: 'Buat template sertifikat untuk penerima penghargaan Gemilang Prestasi',
        category: 'Desain', priority: 'medium', status: 'todo', progress: 0,
        assigned_to: 'mock-user-002', assignee_name: 'Siti Rahayu', assignee_nickname: 'Siti',
        program_name: 'Gemilang Prestasi', program_code: 'GEMILANG',
        deadline: '2025-10-20T23:59:00Z', completed_at: null,
        created_at: '2025-10-05T08:00:00Z', tags: ['desain', 'sertifikat'],
    },
    {
        id: 'task-006', program_id: 'prog-005', title: 'Buat soal tes tulis',
        description: 'Susun soal tes tulis seleksi staff humas baru',
        category: 'Konten', priority: 'urgent', status: 'in_progress', progress: 50,
        assigned_to: 'mock-user-001', assignee_name: 'Ahmad Fauzi', assignee_nickname: 'Fauzi',
        program_name: 'Tes Tulis', program_code: 'TES_TULIS',
        deadline: '2025-10-18T23:59:00Z', completed_at: null,
        created_at: '2025-10-10T08:00:00Z', tags: ['tes', 'konten'],
    },
];

export const MOCK_MEMBERS = [
    { id: 'mock-user-001', full_name: 'Ahmad Fauzi', nickname: 'Fauzi', role: 'super_admin', jabatan: 'Ketua Humas', avatar_url: null },
    { id: 'mock-user-002', full_name: 'Siti Rahayu', nickname: 'Siti', role: 'ketua_humas', jabatan: 'Wakil Ketua Humas', avatar_url: null },
    { id: 'mock-user-003', full_name: 'Budi Santoso', nickname: 'Budi', role: 'anggota_humas', jabatan: 'Anggota Humas', avatar_url: null },
    { id: 'mock-user-004', full_name: 'Dewi Lestari', nickname: 'Dewi', role: 'anggota_humas', jabatan: 'Anggota Humas', avatar_url: null },
    { id: 'mock-user-005', full_name: 'Rizki Pratama', nickname: 'Rizki', role: 'anggota_humas', jabatan: 'Anggota Humas', avatar_url: null },
];

export const MOCK_TIMELINE = [
    {
        id: 'evt-001', title: 'Kick-off Open Recruitment', event_type: 'kegiatan',
        start_datetime: '2025-09-15T08:00:00Z', end_datetime: '2025-09-15T12:00:00Z',
        location: 'Gedung Teknik Elektro Lt. 2', color: '#F59E0B',
        program_name: 'Open Recruitment', all_day: false,
    },
    {
        id: 'evt-002', title: 'Deadline Pengumpulan Berkas', event_type: 'deadline',
        start_datetime: '2025-10-10T23:59:00Z', end_datetime: null,
        location: null, color: '#EF4444',
        program_name: 'Open Recruitment', all_day: true,
    },
    {
        id: 'evt-003', title: 'Pelaksanaan Tes Tulis', event_type: 'kegiatan',
        start_datetime: '2025-10-20T08:00:00Z', end_datetime: '2025-10-20T12:00:00Z',
        location: 'Ruang 301 Gedung TE', color: '#10B981',
        program_name: 'Tes Tulis', all_day: false,
    },
    {
        id: 'evt-004', title: 'Rapat Koordinasi Humas', event_type: 'rapat',
        start_datetime: '2025-10-22T15:00:00Z', end_datetime: '2025-10-22T17:00:00Z',
        location: 'Sekretariat EEPROM', color: '#6C63FF',
        program_name: null, all_day: false,
    },
    {
        id: 'evt-005', title: 'Tes Wawancara Tahap 1', event_type: 'kegiatan',
        start_datetime: '2025-10-27T09:00:00Z', end_datetime: '2025-10-27T17:00:00Z',
        location: 'Gedung Teknik Elektro', color: '#06B6D4',
        program_name: 'Tes Wawancara', all_day: false,
    },
    {
        id: 'evt-006', title: 'Gemilang Prestasi', event_type: 'milestone',
        start_datetime: '2025-10-30T18:00:00Z', end_datetime: '2025-10-30T21:00:00Z',
        location: 'Aula Teknik Elektro', color: '#EC4899',
        program_name: 'Gemilang Prestasi', all_day: false,
    },
];

export const MOCK_TEMPLATES = [
    {
        id: 'tpl-001', type: 'whatsapp', title: 'Broadcast Open Recruitment',
        content: `Halo, Sobat EEPROM! 👋\n\n📢 *OPEN RECRUITMENT HUMAS EEPROM 2025*\n\nDivisi Humas EEPROM membuka kesempatan bagi kalian yang ingin bergabung dan berkontribusi! 🔥\n\n📌 Syarat:\n✅ Mahasiswa aktif Teknik Elektro\n✅ Berkomitmen dan bertanggung jawab\n✅ Memiliki semangat belajar tinggi\n\n📅 Pendaftaran: 15 September - 10 Oktober 2025\n📍 Tempat: Gedung Teknik Elektro\n🔗 Link Daftar: bit.ly/open-rec-humas-2025\n\nSegera daftarkan dirimu! 🚀\n\n_Humas EEPROM_`,
        tags: ['recruitment', 'broadcast'], use_count: 12, is_favorite: true,
        created_at: '2025-09-01T00:00:00Z',
    },
    {
        id: 'tpl-002', type: 'instagram', title: 'Caption Open Recruitment',
        content: `🎯 OPEN RECRUITMENT HUMAS EEPROM 2025\n\nJadilah bagian dari tim Humas terbaik di Teknik Elektro! \n\n🗓️ Pendaftaran dibuka 15 Sept - 10 Okt 2025\n📍 Gedung Teknik Elektro\n\nSwipe untuk info lengkap! ➡️\n\n#EEPROM #HumasEEPROM #OpenRecruitment #TeknikElektro`,
        tags: ['instagram', 'recruitment'], use_count: 8, is_favorite: true,
        created_at: '2025-09-01T00:00:00Z',
    },
    {
        id: 'tpl-003', type: 'surat', title: 'Surat Undangan Kegiatan',
        content: `SURAT UNDANGAN\nNo: 001/EEPROM/X/2025\n\nYth.\n{{nama_tujuan}}\nDi tempat\n\nDengan hormat,\nDalam rangka {{nama_kegiatan}}, Divisi Humas EEPROM mengundang Bapak/Ibu/Sdr. untuk hadir pada:\n\nHari/Tanggal : {{hari}}, {{tanggal}}\nWaktu        : {{waktu}} WIB\nTempat       : {{tempat}}\nAcara        : {{nama_kegiatan}}\n\nAtas perhatian dan kehadiran Bapak/Ibu/Sdr., kami ucapkan terima kasih.\n\nHormat kami,\n\nAhmad Fauzi\nKetua Humas EEPROM\n2021`,
        tags: ['surat', 'undangan'], use_count: 5, is_favorite: false,
        created_at: '2025-09-01T00:00:00Z',
    },
    {
        id: 'tpl-004', type: 'pengumuman', title: 'Pengumuman Kegiatan',
        content: `📢 PENGUMUMAN\n\n{{judul_pengumuman}}\n\nKepada seluruh {{target}},\n\nDengan ini kami informasikan bahwa:\n\n{{isi_pengumuman}}\n\nUntuk informasi lebih lanjut, silakan hubungi:\n📱 {{nama_cp}} ({{nomor_cp}})\n\nTerima kasih atas perhatiannya.\n\nHumas EEPROM\n{{tanggal}}`,
        tags: ['pengumuman'], use_count: 15, is_favorite: true,
        created_at: '2025-09-01T00:00:00Z',
    },
    {
        id: 'tpl-005', type: 'whatsapp', title: 'Reminder Deadline Tugas',
        content: `📌 *REMINDER DEADLINE*\n\nHai Tim Humas! 👋\n\nMengingatkan bahwa deadline untuk tugas:\n\n📋 *{{nama_tugas}}*\n⏰ Deadline: {{deadline}}\n👤 PIC: {{nama_pic}}\n\nTolong segera diselesaikan ya!\n\n_Humas EEPROM_`,
        tags: ['reminder', 'internal'], use_count: 22, is_favorite: false,
        created_at: '2025-09-01T00:00:00Z',
    },
    {
        id: 'tpl-006', type: 'instagram', title: 'Caption Dokumentasi Kegiatan',
        content: `📸 {{judul_kegiatan}}\n\n{{deskripsi_kegiatan}}\n\nTerima kasih kepada semua yang telah hadir dan berpartisipasi! 🙏\n\n📅 {{tanggal}}\n📍 {{lokasi}}\n\n#EEPROM #HumasEEPROM #{{hashtag_program}} #TeknikElektro`,
        tags: ['instagram', 'dokumentasi'], use_count: 18, is_favorite: true,
        created_at: '2025-09-01T00:00:00Z',
    },
];

export const MOCK_PARTICIPANTS = [
    {
        id: 'par-001', type: 'mahasiswa_baru', full_name: 'Muhammad Rizal', nickname: 'Rizal',
        nim: '2025001001', angkatan: '2025', email: 'rizal@student.ac.id',
        phone: '081111111111', prodi: 'Teknik Elektro', notes: 'Aktif dan antusias',
        created_at: '2025-08-15T00:00:00Z',
    },
    {
        id: 'par-002', type: 'mahasiswa_baru', full_name: 'Anisa Pratiwi', nickname: 'Anisa',
        nim: '2025001002', angkatan: '2025', email: 'anisa@student.ac.id',
        phone: '082222222222', prodi: 'Teknik Elektro', notes: '',
        created_at: '2025-08-15T00:00:00Z',
    },
    {
        id: 'par-003', type: 'alumni', full_name: 'Hendra Wijaya', nickname: 'Hendra',
        nim: '2018001001', angkatan: '2018', email: 'hendra@alumni.ac.id',
        phone: '083333333333', graduation_year: '2022', current_job: 'PT. PLN Indonesia',
        created_at: '2025-01-01T00:00:00Z',
    },
    {
        id: 'par-004', type: 'pendaftar', full_name: 'Fajar Nugroho', nickname: 'Fajar',
        nim: '2023001005', angkatan: '2023', email: 'fajar@student.ac.id',
        phone: '084444444444', prodi: 'Teknik Elektro', registration_date: '2025-09-20',
        final_status: 'accepted', written_test_score: 85, interview_score: 88,
        created_at: '2025-09-20T00:00:00Z',
    },
    {
        id: 'par-005', type: 'contact_person', full_name: 'Dr. Bambang Susilo', nickname: 'Pak Bambang',
        email: 'bambang@univ.ac.id', phone: '085555555555',
        cp_role: 'Dosen Pembimbing', organization: 'Universitas EEPROM',
        created_at: '2025-01-01T00:00:00Z',
    },
];

export const MOCK_DOCUMENTS = [
    {
        id: 'doc-001', program_id: 'prog-001', title: 'Opening Ceremony Prastudi 2025',
        category: 'kegiatan', event_date: '2025-08-05',
        file_url: 'https://picsum.photos/seed/eeprom1/800/600',
        thumbnail_url: 'https://picsum.photos/seed/eeprom1/400/300',
        file_name: 'opening-prastudi.jpg', file_type: 'image/jpeg', file_size: 2048000,
        description: 'Dokumentasi pembukaan Prastudi 2025', photographer: 'Tim Humas',
        tags: ['prastudi', 'opening'], view_count: 45, is_featured: true,
        uploaded_by: 'mock-user-002', uploader_name: 'Siti Rahayu',
        created_at: '2025-08-06T08:00:00Z',
    },
    {
        id: 'doc-002', program_id: 'prog-001', title: 'Kelompok 1 Prastudi - Dinamika',
        category: 'kegiatan', event_date: '2025-08-10',
        file_url: 'https://picsum.photos/seed/eeprom2/800/600',
        thumbnail_url: 'https://picsum.photos/seed/eeprom2/400/300',
        file_name: 'kelompok1-prastudi.jpg', file_type: 'image/jpeg', file_size: 1890000,
        description: 'Sesi dinamika kelompok 1', photographer: 'Tim Humas',
        tags: ['prastudi', 'dinamika'], view_count: 32, is_featured: false,
        uploaded_by: 'mock-user-003', uploader_name: 'Budi Santoso',
        created_at: '2025-08-11T08:00:00Z',
    },
    {
        id: 'doc-003', program_id: 'prog-002', title: 'Stand Expo Kelembagaan EEPROM',
        category: 'kegiatan', event_date: '2025-09-15',
        file_url: 'https://picsum.photos/seed/eeprom3/800/600',
        thumbnail_url: 'https://picsum.photos/seed/eeprom3/400/300',
        file_name: 'stand-expo.jpg', file_type: 'image/jpeg', file_size: 2200000,
        description: 'Stand pameran EEPROM di Expo Kelembagaan', photographer: 'Tim Humas',
        tags: ['expo', 'stand'], view_count: 67, is_featured: true,
        uploaded_by: 'mock-user-002', uploader_name: 'Siti Rahayu',
        created_at: '2025-09-16T08:00:00Z',
    },
    {
        id: 'doc-004', program_id: 'prog-004', title: 'Pendaftaran Open Recruitment',
        category: 'publikasi', event_date: '2025-09-20',
        file_url: 'https://picsum.photos/seed/eeprom4/800/600',
        thumbnail_url: 'https://picsum.photos/seed/eeprom4/400/300',
        file_name: 'open-rec-poster.jpg', file_type: 'image/jpeg', file_size: 980000,
        description: 'Poster digital open recruitment Humas EEPROM 2025', photographer: 'Tim Humas',
        tags: ['open-rec', 'poster', 'publikasi'], view_count: 120, is_featured: true,
        uploaded_by: 'mock-user-002', uploader_name: 'Siti Rahayu',
        created_at: '2025-09-21T08:00:00Z',
    },
];

export const MOCK_ACTIVITY_LOGS = [
    { id: 'log-001', user_id: 'mock-user-001', action: 'create', resource_type: 'task', resource_name: 'Desain poster Open Recruitment', created_at: new Date(Date.now() - 3600000).toISOString(), user_name: 'Ahmad Fauzi' },
    { id: 'log-002', user_id: 'mock-user-002', action: 'update', resource_type: 'task', resource_name: 'Buat form pendaftaran online', created_at: new Date(Date.now() - 7200000).toISOString(), user_name: 'Siti Rahayu' },
    { id: 'log-003', user_id: 'mock-user-003', action: 'upload', resource_type: 'document', resource_name: 'Stand Expo Kelembagaan', created_at: new Date(Date.now() - 10800000).toISOString(), user_name: 'Budi Santoso' },
    { id: 'log-004', user_id: 'mock-user-004', action: 'create', resource_type: 'program', resource_name: 'Diklat Lapang', created_at: new Date(Date.now() - 14400000).toISOString(), user_name: 'Dewi Lestari' },
    { id: 'log-005', user_id: 'mock-user-001', action: 'update', resource_type: 'program', resource_name: 'Gemilang Prestasi', created_at: new Date(Date.now() - 18000000).toISOString(), user_name: 'Ahmad Fauzi' },
];

export const MOCK_STATS = {
    total_programs: 8,
    active_programs: 2,
    completed_programs: 2,
    total_tasks: 63,
    tasks_todo: 22,
    tasks_in_progress: 18,
    tasks_done: 20,
    tasks_overdue: 3,
    total_documents: 38,
    total_participants: 47,
    upcoming_events: 4,
    avg_program_progress: 50,
};
