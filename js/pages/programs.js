/**
 * EEPROM Humas Management System
 * Programs List Page
 */

import { fetchPrograms } from '../api/programs.js';
import { store } from '../store.js';
import { PROGRAMS, PROGRAM_STATUS } from '../config.js';
import { getProgressColor, formatDate } from '../utils.js';

export async function render(container) {
    container.innerHTML = getSkeletonHTML();
    
    const { data: programs } = await fetchPrograms();
    
    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">Program Kerja</h1>
                <p class="page-subtitle">Kelola seluruh program kerja Divisi Humas EEPROM</p>
            </div>
        </div>
        
        <!-- Summary Stats -->
        <div class="program-stats-row">
            <div class="program-stat-pill">
                <span class="dot" style="background:#94A3B8"></span>
                ${programs.filter(p => p.status === 'planning').length} Planning
            </div>
            <div class="program-stat-pill">
                <span class="dot" style="background:#6C63FF"></span>
                ${programs.filter(p => p.status === 'active').length} Aktif
            </div>
            <div class="program-stat-pill">
                <span class="dot" style="background:#10B981"></span>
                ${programs.filter(p => p.status === 'completed').length} Selesai
            </div>
        </div>
        
        <!-- Programs Grid -->
        <div class="programs-grid" id="programs-grid">
            ${programs.map(p => getProgramCard(p)).join('')}
        </div>
    `;
    
    if (window.lucide) lucide.createIcons({ nodes: [container] });
    
    // Animate progress bars
    setTimeout(() => {
        container.querySelectorAll('.progress-fill[data-width]').forEach(el => {
            el.style.width = el.dataset.width + '%';
        });
    }, 200);
}

function getProgramCard(program) {
    const config = PROGRAMS.find(p => p.code === program.code) || {};
    const statusConf = PROGRAM_STATUS[program.status] || PROGRAM_STATUS.planning;
    const color = config.color || '#6C63FF';
    const icon = config.icon || 'briefcase';
    const progressColor = getProgressColor(program.progress || 0);
    
    return `
        <div class="program-card" onclick="navigate('/programs/${program.code?.toLowerCase()}')">
            <div class="program-card-header" style="background: linear-gradient(135deg, ${color}22, ${color}11)">
                <div class="program-icon" style="background: ${color}22; color: ${color}">
                    <i data-lucide="${icon}"></i>
                </div>
                <span class="badge" style="background: ${statusConf.bg}; color: ${statusConf.color}">
                    ${statusConf.label}
                </span>
            </div>
            <div class="program-card-body">
                <h3 class="program-card-title">${program.name}</h3>
                <p class="program-card-desc text-muted text-sm">${program.description || 'Tidak ada deskripsi'}</p>
                
                <div class="program-card-meta">
                    ${program.start_date ? `
                        <div class="meta-item">
                            <i data-lucide="calendar"></i>
                            <span>${formatDate(program.start_date, { day: 'numeric', month: 'short' })} - ${formatDate(program.end_date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                    ` : ''}
                    ${program.pic_name ? `
                        <div class="meta-item">
                            <i data-lucide="user"></i>
                            <span>${program.pic_name}</span>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Progress -->
                <div class="program-card-progress">
                    <div class="progress-header">
                        <span class="text-sm text-muted">Progress</span>
                        <span class="text-sm fw-600" style="color: ${progressColor}">${program.progress || 0}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" data-width="${program.progress || 0}" style="width: 0%; background: ${progressColor}; transition: width 1s ease"></div>
                    </div>
                </div>
                
                <!-- Footer Stats -->
                <div class="program-card-footer">
                    <div class="stat-mini">
                        <i data-lucide="check-square"></i>
                        ${program.done_tasks || 0}/${program.total_tasks || 0} Task
                    </div>
                    <div class="stat-mini">
                        <i data-lucide="image"></i>
                        ${program.total_documents || 0} Foto
                    </div>
                    <div class="stat-mini">
                        <i data-lucide="calendar"></i>
                        ${program.total_events || 0} Event
                    </div>
                    <div class="program-card-arrow">
                        <i data-lucide="arrow-right"></i>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getSkeletonHTML() {
    return `<div class="programs-grid">${[1,2,3,4,5,6,7,8].map(() => 
        `<div class="card skeleton h-72"></div>`
    ).join('')}</div>`;
}
