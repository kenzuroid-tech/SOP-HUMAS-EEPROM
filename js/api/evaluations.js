/**
 * EEPROM Humas Management System
 * Evaluations API Module
 */

import { APP_CONFIG } from '../config.js';
import { getSupabase } from '../auth.js';
import { store } from '../store.js';

let db = null;
function getDB() { return db || (db = getSupabase()); }

const MOCK_EVALUATIONS = [
    {
        id: 'eval-001',
        program_id: 'prog-001',
        program_name: 'Prastudi',
        evaluator_id: 'mock-user-001',
        evaluator_name: 'Ahmad Fauzi',
        period: 'Periode 2024/2025',
        score_planning: 9, score_execution: 8, score_communication: 9,
        score_teamwork: 9, score_outcome: 8, overall_score: 8.6,
        yang_berjalan_baik: 'Koordinasi tim sangat baik. Publikasi berjalan lancar dan menarik banyak peserta. Materi prastudi relevan dan bermanfaat.',
        kendala: 'Beberapa peserta tidak hadir di hari terakhir. Kurangnya koordinasi dengan divisi lain di awal.',
        solusi: 'Perlu membuat sistem absensi yang lebih ketat. Rapat koordinasi antar divisi sebaiknya dilakukan lebih awal.',
        saran_tahun_depan: 'Tambah sesi bonding antar peserta. Buat konten digital yang lebih menarik untuk publikasi. Siapkan backup plan untuk setiap sesi.',
        is_final: true,
        created_at: '2025-09-01T00:00:00Z',
    },
    {
        id: 'eval-002',
        program_id: 'prog-002',
        program_name: 'Expo Kelembagaan',
        evaluator_id: 'mock-user-001',
        evaluator_name: 'Ahmad Fauzi',
        period: 'Periode 2024/2025',
        score_planning: 8, score_execution: 7, score_communication: 8,
        score_teamwork: 8, score_outcome: 9, overall_score: 8.0,
        yang_berjalan_baik: 'Stand EEPROM sangat menarik dan berhasil menarik banyak pengunjung. Dekorasi dan konsep booth kreatif.',
        kendala: 'Persiapan yang kurang matang di H-2. Beberapa materi promosi terlambat dicetak.',
        solusi: 'Finalisasi semua materi minimal H-5 dari hari H. Checklist persiapan perlu lebih detail.',
        saran_tahun_depan: 'Buat interactive booth yang lebih engaging. Siapkan demo produk/karya terbaik EEPROM. Tambah merchandise untuk pengunjung.',
        is_final: true,
        created_at: '2025-10-01T00:00:00Z',
    },
];

export async function fetchEvaluations(filters = {}) {
    if (APP_CONFIG.demoMode) {
        await delay(300);
        let evals = [...MOCK_EVALUATIONS];
        if (filters.program_id) evals = evals.filter(e => e.program_id === filters.program_id);
        store.set({ evaluations: evals });
        return { data: evals, error: null };
    }
    
    let query = getDB()
        .from('evaluations')
        .select('*, programs(name, code), profiles!evaluator_id(full_name)');
    
    if (filters.program_id) query = query.eq('program_id', filters.program_id);
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error) store.set({ evaluations: data });
    return { data, error };
}

export async function fetchEvaluationByProgram(programId) {
    if (APP_CONFIG.demoMode) {
        await delay(200);
        const evaluation = MOCK_EVALUATIONS.find(e => e.program_id === programId);
        return { data: evaluation || null, error: null };
    }
    
    const { data, error } = await getDB()
        .from('evaluations')
        .select('*')
        .eq('program_id', programId)
        .single();
    
    return { data, error };
}

export async function upsertEvaluation(evaluationData) {
    if (APP_CONFIG.demoMode) {
        await delay(600);
        const evaluations = store.get('evaluations');
        const existing = evaluations.find(e => e.program_id === evaluationData.program_id);
        
        const scores = [
            evaluationData.score_planning,
            evaluationData.score_execution,
            evaluationData.score_communication,
            evaluationData.score_teamwork,
            evaluationData.score_outcome,
        ].filter(Boolean);
        
        const overall_score = scores.length ? 
            (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0;
        
        const eval_data = {
            id: existing?.id || `eval-${Date.now()}`,
            ...existing,
            ...evaluationData,
            overall_score: parseFloat(overall_score),
            updated_at: new Date().toISOString(),
        };
        
        const updated = existing
            ? evaluations.map(e => e.id === existing.id ? eval_data : e)
            : [...evaluations, eval_data];
        
        store.set({ evaluations: updated });
        return { data: eval_data, error: null };
    }
    
    const user = store.get('user');
    const { data, error } = await getDB()
        .from('evaluations')
        .upsert({ ...evaluationData, evaluator_id: user.id }, { onConflict: 'program_id' })
        .select().single();
    
    if (!error) await fetchEvaluations();
    return { data, error };
}

export async function deleteEvaluation(id) {
    if (APP_CONFIG.demoMode) {
        await delay(400);
        store.set({ evaluations: store.get('evaluations').filter(e => e.id !== id) });
        return { error: null };
    }
    const { error } = await getDB().from('evaluations').delete().eq('id', id);
    if (!error) await fetchEvaluations();
    return { error };
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));
