/**
 * EEPROM Humas Management System
 * Evaluations Page
 */

import { fetchEvaluations } from '../api/evaluations.js';
import { fetchPrograms } from '../api/programs.js';
import { store, hasPermission } from '../store.js';
import { formatDate, getProgressColor } from '../utils.js';
import { PROGRAMS } from '../config.js';

export async function render(container) {
    container.innerHTML = getSkeletonHTML();
    
    const [evalsResult, programsResult] = await Promise.all([
        fetchEvaluations(),
        fetchPrograms(),
    ]);
    
    const evaluations = evalsResult.data || [];
    const programs = programsResult.data || [];
    
    container.innerHTML = getPageHTML(programs, evaluations);
    if (window.lucide) lucide.createIcons({ nodes: [container] });
}

function getPageHTML(programs, evaluations) {
    const evalMap = {};
    evaluations.forEach(e => { evalMap[e.program_id] = e; });
    
    const totalScore = evaluations.reduce((sum, e) => sum + (e.overall_score || 0), 0);
    const avgScore = evaluations.length ? (totalScore / evaluations.length).toFixed(1) : '-';
    const evaluated = evaluations.length;
    const notEvaluated = programs.length - evaluated;
    
    return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Evaluasi</h1>
                <p class="page-subtitle">Evaluasi kinerja dan pembelajaran dari setiap program kerja</p>
            </div>
        </div>
        
        <!-- Summary -->
        <div class="eval-summary-grid">
            <div class="eval-summary-card">
                <div class="eval-summary-icon" style="background: rgba(108,99,255,0.15); color: #6C63FF">
                    <i data-lucide="star"></i>
                </div>
                <div>
                    <div class="eval-summary-value">${avgScore}</div>
                    <div class="text-muted text-sm">Rata-rata Skor</div>
                </div>
            </div>
            <div class="eval-summary-card">
                <div class="eval-summary-icon" style="background: rgba(16,185,129,0.15); color: #10B981">
                    <i data-lucide="check-circle"></i>
                </div>
                <div>
                    <div class="eval-summary-value">${evaluated}</div>
                    <div class="text-muted text-sm">Sudah Dievaluasi</div>
                </div>
            </div>
            <div class="eval-summary-card">
                <div class="eval-summary-icon" style="background: rgba(245,158,11,0.15); color: #F59E0B">
                    <i data-lucide="clock"></i>
                </div>
                <div>
                    <div class="eval-summary-value">${notEvaluated}</div>
                    <div class="text-muted text-sm">Belum Dievaluasi</div>
                </div>
            </div>
        </div>
        
        <!-- Program Evaluation Cards -->
        <div class="eval-cards-grid">
            ${programs.map(program => {
                const evaluation = evalMap[program.id];
                const config = PROGRAMS.find(p => p.code === program.code) || {};
                return getEvalCard(program, evaluation, config);
            }).join('')}
        </div>
    `;
}

function getEvalCard(program, evaluation, config) {
    const color = config.color || '#6C63FF';
    const icon = config.icon || 'briefcase';
    const hasEval = !!evaluation;
    const canEdit = hasPermission('evaluations', 'create');
    
    return `
        <div class="eval-card" onclick="navigate('/programs/${program.code?.toLowerCase()}')">
            <div class="eval-card-header" style="background: linear-gradient(135deg, ${color}22, transparent)">
                <div class="eval-card-icon" style="background: ${color}22; color: ${color}">
                    <i data-lucide="${icon}"></i>
                </div>
                <div class="eval-card-program">
                    <h3>${program.name}</h3>
                    <span class="text-sm text-muted">${program.status}</span>
                </div>
                ${hasEval ? `
                    <div class="eval-card-score" style="color: ${getScoreColor(evaluation.overall_score)}">
                        <span class="score-big">${evaluation.overall_score || '-'}</span>
                        <span class="text-xs">/10</span>
                    </div>
                ` : `
                    <div class="eval-card-no-score">
                        <i data-lucide="minus-circle"></i>
                        <span class="text-xs text-muted">Belum ada</span>
                    </div>
                `}
            </div>
            
            ${hasEval ? `
                <div class="eval-card-scores">
                    ${[
                        { label: 'Plan', score: evaluation.score_planning },
                        { label: 'Execute', score: evaluation.score_execution },
                        { label: 'Comm', score: evaluation.score_communication },
                        { label: 'Team', score: evaluation.score_teamwork },
                        { label: 'Output', score: evaluation.score_outcome },
                    ].map(s => `
                        <div class="mini-score">
                            <div class="mini-score-bar">
                                <div class="mini-score-fill" style="height: ${(s.score || 0) * 10}%; background: ${getScoreColor(s.score)}"></div>
                            </div>
                            <div class="mini-score-value" style="color: ${getScoreColor(s.score)}">${s.score || '-'}</div>
                            <div class="mini-score-label text-xs">${s.label}</div>
                        </div>
                    `).join('')}
                </div>
                
                ${evaluation.yang_berjalan_baik ? `
                    <div class="eval-card-snippet">
                        <span class="eval-snippet-label" style="color: #10B981"><i data-lucide="thumbs-up"></i></span>
                        <span class="text-sm text-muted">${evaluation.yang_berjalan_baik.slice(0, 80)}...</span>
                    </div>
                ` : ''}
            ` : `
                <div class="eval-card-empty">
                    ${canEdit ? `
                        <p class="text-muted text-sm">Evaluasi belum diisi</p>
                        <button class="btn btn-outline btn-sm mt-2" onclick="event.stopPropagation(); navigate('/programs/${program.code?.toLowerCase()}')">
                            <i data-lucide="plus"></i> Isi Evaluasi
                        </button>
                    ` : `
                        <p class="text-muted text-sm">Evaluasi belum tersedia</p>
                    `}
                </div>
            `}
        </div>
    `;
}

function getScoreColor(score) {
    if (!score) return '#94A3B8';
    if (score >= 8) return '#10B981';
    if (score >= 6) return '#F59E0B';
    return '#EF4444';
}

function getSkeletonHTML() {
    return `<div class="eval-cards-grid">${[1,2,3,4,5,6,7,8].map(() => `<div class="card skeleton h-48"></div>`).join('')}</div>`;
}
