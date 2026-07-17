-- ============================================================
-- EEPROM HUMAS MANAGEMENT SYSTEM
-- Database Schema for Supabase (PostgreSQL)
-- Version: 1.0.0
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('super_admin', 'ketua_humas', 'anggota_humas');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'done', 'cancelled');
CREATE TYPE program_status AS ENUM ('planning', 'active', 'completed', 'cancelled');
CREATE TYPE template_type AS ENUM ('whatsapp', 'instagram', 'surat', 'pengumuman');
CREATE TYPE document_category AS ENUM ('kegiatan', 'rapat', 'publikasi', 'administrasi', 'lainnya');
CREATE TYPE participant_type AS ENUM ('mahasiswa_baru', 'alumni', 'pendaftar', 'contact_person');
CREATE TYPE notification_type AS ENUM ('task', 'program', 'deadline', 'system', 'mention');
CREATE TYPE log_action AS ENUM ('create', 'update', 'delete', 'login', 'logout', 'upload', 'download');

-- ============================================================
-- TABLE: roles
-- Defines access level for each role
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name user_role NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No seed data — roles akan diisi manual melalui aplikasi atau SQL Editor

-- ============================================================
-- TABLE: profiles
-- Extended user data linked to Supabase Auth
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(200) NOT NULL,
    nickname VARCHAR(100),
    role user_role NOT NULL DEFAULT 'anggota_humas',
    avatar_url TEXT,
    phone VARCHAR(20),
    nim VARCHAR(20),
    angkatan VARCHAR(10),
    divisi VARCHAR(100) DEFAULT 'Humas',
    jabatan VARCHAR(100),
    bio TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: programs (Program Kerja)
-- 8 program kerja Humas EEPROM
-- ============================================================

CREATE TABLE IF NOT EXISTS programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE, -- e.g. 'PRASTUDI', 'EXPO', etc.
    name VARCHAR(200) NOT NULL,
    short_name VARCHAR(50),
    description TEXT,
    objectives TEXT[],             -- Array tujuan program
    target_output TEXT,
    status program_status DEFAULT 'planning',
    pic_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    start_date DATE,
    end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    budget DECIMAL(15,2),
    actual_budget DECIMAL(15,2),
    location VARCHAR(200),
    expected_participants INTEGER,
    actual_participants INTEGER,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    cover_image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- No seed data — programs akan diisi melalui aplikasi

-- ============================================================
-- TABLE: tasks
-- Task management per program atau global
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    priority task_priority DEFAULT 'medium',
    status task_status DEFAULT 'todo',
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    deadline TIMESTAMPTZ,
    reminder_at TIMESTAMPTZ,
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    tags TEXT[],
    attachments JSONB DEFAULT '[]',  -- [{name, url, size, type}]
    checklist JSONB DEFAULT '[]',    -- [{id, text, done}]
    notes TEXT,
    is_recurring BOOLEAN DEFAULT false,
    parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: task_progress
-- History/log perubahan progress task
-- ============================================================

CREATE TABLE IF NOT EXISTS task_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    old_status task_status,
    new_status task_status,
    old_progress INTEGER,
    new_progress INTEGER,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: timeline
-- Kalender semua kegiatan
-- ============================================================

CREATE TABLE IF NOT EXISTS timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) DEFAULT 'kegiatan', -- kegiatan, rapat, deadline, milestone
    start_datetime TIMESTAMPTZ NOT NULL,
    end_datetime TIMESTAMPTZ,
    all_day BOOLEAN DEFAULT false,
    location VARCHAR(200),
    color VARCHAR(20) DEFAULT '#6C63FF',
    pic_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    attendees UUID[],             -- Array of profile IDs
    is_public BOOLEAN DEFAULT true,
    reminder_minutes INTEGER DEFAULT 60,
    recurrence_rule TEXT,         -- iCal RRULE
    parent_event_id UUID REFERENCES timeline(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: templates
-- Template pesan, caption, surat, pengumuman
-- ============================================================

CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type template_type NOT NULL,
    title VARCHAR(300) NOT NULL,
    content TEXT NOT NULL,
    variables TEXT[],             -- Placeholder variables e.g. ['{{nama}}', '{{tanggal}}']
    tags TEXT[],
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    is_favorite BOOLEAN DEFAULT false,
    use_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- No seed data — templates akan diisi melalui aplikasi

-- ============================================================
-- TABLE: documents (Dokumentasi)
-- Upload foto/file via Supabase Storage
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    category document_category DEFAULT 'kegiatan',
    file_name VARCHAR(300) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    storage_path TEXT NOT NULL,   -- Path in Supabase Storage
    thumbnail_url TEXT,
    tags TEXT[],
    event_date DATE,
    photographer VARCHAR(200),
    is_featured BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: evaluations
-- Evaluasi per program kerja
-- ============================================================

CREATE TABLE IF NOT EXISTS evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    evaluator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    period VARCHAR(50),           -- e.g. 'Periode 2024/2025'
    
    -- Quantitative scores (1-10)
    score_planning INTEGER CHECK (score_planning BETWEEN 1 AND 10),
    score_execution INTEGER CHECK (score_execution BETWEEN 1 AND 10),
    score_communication INTEGER CHECK (score_communication BETWEEN 1 AND 10),
    score_teamwork INTEGER CHECK (score_teamwork BETWEEN 1 AND 10),
    score_outcome INTEGER CHECK (score_outcome BETWEEN 1 AND 10),
    overall_score DECIMAL(4,2),  -- Calculated average
    
    -- Qualitative feedback
    yang_berjalan_baik TEXT,
    kendala TEXT,
    solusi TEXT,
    saran_tahun_depan TEXT,
    catatan_tambahan TEXT,
    
    -- Metadata
    participant_feedback JSONB DEFAULT '{}',  -- Aggregated feedback
    is_final BOOLEAN DEFAULT false,
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: participants
-- Database mahasiswa baru, alumni, pendaftar, CP
-- ============================================================

CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type participant_type NOT NULL,
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    
    -- Personal data
    full_name VARCHAR(200) NOT NULL,
    nickname VARCHAR(100),
    nim VARCHAR(20),
    angkatan VARCHAR(10),
    email VARCHAR(255),
    phone VARCHAR(20),
    instagram VARCHAR(100),
    address TEXT,
    
    -- Academic data
    ipk DECIMAL(3,2),
    prodi VARCHAR(200),
    
    -- Recruitment data (for pendaftar)
    registration_date DATE,
    interview_date DATE,
    interview_score DECIMAL(5,2),
    written_test_score DECIMAL(5,2),
    final_status VARCHAR(50),     -- 'accepted', 'rejected', 'pending'
    rejection_reason TEXT,
    
    -- Contact Person specific
    cp_role VARCHAR(200),
    organization VARCHAR(200),
    
    -- Alumni specific
    graduation_year VARCHAR(10),
    current_job VARCHAR(200),
    
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: freshman_groups (Kelompok Mahasiswa Baru)
-- ============================================================

CREATE TABLE IF NOT EXISTS freshman_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    group_name VARCHAR(100) NOT NULL,
    group_number INTEGER,
    mentor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    co_mentor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    color VARCHAR(20),
    members UUID[],               -- Array of participant IDs
    meeting_schedule TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: activity_logs (Audit Trail)
-- Log semua aksi user
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action log_action NOT NULL,
    resource_type VARCHAR(100),   -- 'task', 'program', 'document', etc.
    resource_id UUID,
    resource_name VARCHAR(300),
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: notifications
-- In-app notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(300) NOT NULL,
    message TEXT,
    resource_type VARCHAR(100),
    resource_id UUID,
    action_url TEXT,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    sent_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES for Performance
-- ============================================================

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);
CREATE INDEX idx_programs_status ON programs(status);
CREATE INDEX idx_programs_sort_order ON programs(sort_order);
CREATE INDEX idx_tasks_program_id ON tasks(program_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_task_progress_task_id ON task_progress(task_id);
CREATE INDEX idx_timeline_start_datetime ON timeline(start_datetime);
CREATE INDEX idx_timeline_program_id ON timeline(program_id);
CREATE INDEX idx_documents_program_id ON documents(program_id);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_participants_type ON participants(type);
CREATE INDEX idx_participants_program_id ON participants(program_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_resource ON activity_logs(resource_type, resource_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_programs_updated_at BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_timeline_updated_at BEFORE UPDATE ON timeline FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_evaluations_updated_at BEFORE UPDATE ON evaluations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_participants_updated_at BEFORE UPDATE ON participants FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'anggota_humas')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-calculate overall_score on evaluation update
CREATE OR REPLACE FUNCTION calculate_evaluation_score()
RETURNS TRIGGER AS $$
BEGIN
    NEW.overall_score = (
        COALESCE(NEW.score_planning, 0) +
        COALESCE(NEW.score_execution, 0) +
        COALESCE(NEW.score_communication, 0) +
        COALESCE(NEW.score_teamwork, 0) +
        COALESCE(NEW.score_outcome, 0)
    ) / NULLIF(
        (CASE WHEN NEW.score_planning IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN NEW.score_execution IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN NEW.score_communication IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN NEW.score_teamwork IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN NEW.score_outcome IS NOT NULL THEN 1 ELSE 0 END),
        0
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_evaluation_score
    BEFORE INSERT OR UPDATE ON evaluations
    FOR EACH ROW EXECUTE FUNCTION calculate_evaluation_score();

-- Auto-log task status changes
CREATE OR REPLACE FUNCTION log_task_progress()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status OR OLD.progress IS DISTINCT FROM NEW.progress THEN
        INSERT INTO task_progress (task_id, user_id, old_status, new_status, old_progress, new_progress)
        VALUES (NEW.id, auth.uid(), OLD.status, NEW.status, OLD.progress, NEW.progress);
    END IF;
    
    -- Auto-set completed_at when done
    IF NEW.status = 'done' AND OLD.status != 'done' THEN
        NEW.completed_at = NOW();
    ELSIF NEW.status != 'done' THEN
        NEW.completed_at = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_progress_log
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION log_task_progress();

-- Function to get dashboard stats
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_programs', (SELECT COUNT(*) FROM programs WHERE is_active = true),
        'active_programs', (SELECT COUNT(*) FROM programs WHERE status = 'active' AND is_active = true),
        'completed_programs', (SELECT COUNT(*) FROM programs WHERE status = 'completed'),
        'total_tasks', (SELECT COUNT(*) FROM tasks),
        'tasks_todo', (SELECT COUNT(*) FROM tasks WHERE status = 'todo'),
        'tasks_in_progress', (SELECT COUNT(*) FROM tasks WHERE status = 'in_progress'),
        'tasks_done', (SELECT COUNT(*) FROM tasks WHERE status = 'done'),
        'tasks_overdue', (SELECT COUNT(*) FROM tasks WHERE deadline < NOW() AND status NOT IN ('done', 'cancelled')),
        'total_documents', (SELECT COUNT(*) FROM documents),
        'total_participants', (SELECT COUNT(*) FROM participants),
        'upcoming_events', (
            SELECT COUNT(*) FROM timeline 
            WHERE start_datetime > NOW() AND start_datetime <= NOW() + INTERVAL '7 days'
        ),
        'avg_program_progress', (SELECT COALESCE(AVG(progress), 0) FROM programs WHERE is_active = true)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE freshman_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES policies
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_select_all_admin" ON profiles FOR SELECT USING (get_user_role() IN ('super_admin', 'ketua_humas'));
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE USING (get_user_role() = 'super_admin');
CREATE POLICY "profiles_insert_admin" ON profiles FOR INSERT WITH CHECK (get_user_role() = 'super_admin');

-- PROGRAMS policies
CREATE POLICY "programs_select_all" ON programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "programs_insert_admin" ON programs FOR INSERT WITH CHECK (get_user_role() IN ('super_admin', 'ketua_humas'));
CREATE POLICY "programs_update_admin" ON programs FOR UPDATE USING (get_user_role() IN ('super_admin', 'ketua_humas'));
CREATE POLICY "programs_delete_superadmin" ON programs FOR DELETE USING (get_user_role() = 'super_admin');

-- TASKS policies
CREATE POLICY "tasks_select_all" ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks_insert_auth" ON tasks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tasks_update_own_or_admin" ON tasks FOR UPDATE USING (
    assigned_to = auth.uid() OR created_by = auth.uid() OR get_user_role() IN ('super_admin', 'ketua_humas')
);
CREATE POLICY "tasks_delete_admin" ON tasks FOR DELETE USING (
    created_by = auth.uid() OR get_user_role() IN ('super_admin', 'ketua_humas')
);

-- TASK_PROGRESS policies
CREATE POLICY "task_progress_select" ON task_progress FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_progress_insert" ON task_progress FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- TIMELINE policies
CREATE POLICY "timeline_select_all" ON timeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "timeline_insert_admin" ON timeline FOR INSERT WITH CHECK (get_user_role() IN ('super_admin', 'ketua_humas'));
CREATE POLICY "timeline_update_admin" ON timeline FOR UPDATE USING (get_user_role() IN ('super_admin', 'ketua_humas'));
CREATE POLICY "timeline_delete_admin" ON timeline FOR DELETE USING (get_user_role() IN ('super_admin', 'ketua_humas'));

-- TEMPLATES policies
CREATE POLICY "templates_select_all" ON templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "templates_insert_admin" ON templates FOR INSERT WITH CHECK (get_user_role() IN ('super_admin', 'ketua_humas'));
CREATE POLICY "templates_update_admin" ON templates FOR UPDATE USING (get_user_role() IN ('super_admin', 'ketua_humas'));
CREATE POLICY "templates_delete_admin" ON templates FOR DELETE USING (get_user_role() IN ('super_admin', 'ketua_humas'));

-- DOCUMENTS policies
CREATE POLICY "documents_select_all" ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "documents_insert_auth" ON documents FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "documents_update_own_admin" ON documents FOR UPDATE USING (
    uploaded_by = auth.uid() OR get_user_role() IN ('super_admin', 'ketua_humas')
);
CREATE POLICY "documents_delete_admin" ON documents FOR DELETE USING (
    uploaded_by = auth.uid() OR get_user_role() IN ('super_admin', 'ketua_humas')
);

-- EVALUATIONS policies
CREATE POLICY "evaluations_select_all" ON evaluations FOR SELECT TO authenticated USING (true);
CREATE POLICY "evaluations_insert_admin" ON evaluations FOR INSERT WITH CHECK (get_user_role() IN ('super_admin', 'ketua_humas'));
CREATE POLICY "evaluations_update_admin" ON evaluations FOR UPDATE USING (get_user_role() IN ('super_admin', 'ketua_humas'));
CREATE POLICY "evaluations_delete_superadmin" ON evaluations FOR DELETE USING (get_user_role() = 'super_admin');

-- PARTICIPANTS policies
CREATE POLICY "participants_select_all" ON participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "participants_insert_admin" ON participants FOR INSERT WITH CHECK (get_user_role() IN ('super_admin', 'ketua_humas'));
CREATE POLICY "participants_update_admin" ON participants FOR UPDATE USING (get_user_role() IN ('super_admin', 'ketua_humas'));
CREATE POLICY "participants_delete_superadmin" ON participants FOR DELETE USING (get_user_role() IN ('super_admin', 'ketua_humas'));

-- FRESHMAN_GROUPS policies
CREATE POLICY "freshman_groups_select_all" ON freshman_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "freshman_groups_manage_admin" ON freshman_groups FOR ALL USING (get_user_role() IN ('super_admin', 'ketua_humas'));

-- ACTIVITY_LOGS policies
CREATE POLICY "activity_logs_select_admin" ON activity_logs FOR SELECT USING (get_user_role() IN ('super_admin', 'ketua_humas'));
CREATE POLICY "activity_logs_insert_auth" ON activity_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- NOTIFICATIONS policies
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (user_id = auth.uid());
CREATE POLICY "notifications_send_admin" ON notifications FOR INSERT WITH CHECK (
    get_user_role() IN ('super_admin', 'ketua_humas') OR sent_by = auth.uid()
);

-- ============================================================
-- STORAGE BUCKETS (Run in Supabase Dashboard)
-- ============================================================

-- Create storage buckets via SQL (Supabase Storage)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('documents', 'documents', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']),
    ('program-covers', 'program-covers', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('attachments', 'attachments', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_own_upload" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "documents_auth_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "documents_auth_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "documents_own_delete" ON storage.objects FOR DELETE USING (
    bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================
-- VIEWS for convenience
-- ============================================================

-- View: tasks with assignee info
CREATE OR REPLACE VIEW v_tasks AS
SELECT 
    t.*,
    p.full_name AS assignee_name,
    p.avatar_url AS assignee_avatar,
    p.nickname AS assignee_nickname,
    pr.name AS program_name,
    pr.code AS program_code
FROM tasks t
LEFT JOIN profiles p ON t.assigned_to = p.id
LEFT JOIN programs pr ON t.program_id = pr.id;

-- View: upcoming deadlines
CREATE OR REPLACE VIEW v_upcoming_deadlines AS
SELECT 
    t.id,
    t.title,
    t.deadline,
    t.priority,
    t.status,
    t.progress,
    p.full_name AS assignee_name,
    pr.name AS program_name,
    EXTRACT(EPOCH FROM (t.deadline - NOW())) / 86400 AS days_until_deadline
FROM tasks t
LEFT JOIN profiles p ON t.assigned_to = p.id
LEFT JOIN programs pr ON t.program_id = pr.id
WHERE t.deadline > NOW() AND t.status NOT IN ('done', 'cancelled')
ORDER BY t.deadline ASC;

-- View: program progress summary
CREATE OR REPLACE VIEW v_program_summary AS
SELECT 
    prog.*,
    p.full_name AS pic_name,
    p.avatar_url AS pic_avatar,
    (SELECT COUNT(*) FROM tasks WHERE program_id = prog.id) AS total_tasks,
    (SELECT COUNT(*) FROM tasks WHERE program_id = prog.id AND status = 'done') AS done_tasks,
    (SELECT COUNT(*) FROM documents WHERE program_id = prog.id) AS total_documents,
    (SELECT COUNT(*) FROM timeline WHERE program_id = prog.id) AS total_events
FROM programs prog
LEFT JOIN profiles p ON prog.pic_id = p.id
WHERE prog.is_active = true
ORDER BY prog.sort_order;