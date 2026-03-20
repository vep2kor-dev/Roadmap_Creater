/**
 * Dynamic Roadmap - JavaScript Module
 * This file handles all the dynamic functionality for the roadmap
 * Supports multiple projects viewed in one place.
 */

// ============================================
// CORE DATA STRUCTURE
// ============================================

let roadmapData = {
    projects: [
        {
            id: 'p1',
            name: "Enterprise Platform",
            color: "#00d9ff",
            phases: [
                {
                    id: 1,
                    name: "Phase 1: Foundation",
                    startDate: "2026-01-01",
                    endDate: "2026-03-15",
                    milestones: [
                        { id: 1, title: "Architecture Sign-off", description: "Finalize system design", status: "completed", targetDate: "2026-01-20", tags: ["core"] },
                        { id: 2, title: "Database Setup", description: "Provision production DBs", status: "in-progress", targetDate: "2026-02-15", tags: ["backend"] }
                    ]
                }
            ]
        },
        {
            id: 'p2',
            name: "Mobile App Rollout",
            color: "#ffc107",
            phases: [
                {
                    id: 2,
                    name: "Phase 1: UX Design",
                    startDate: "2026-02-01",
                    endDate: "2026-04-30",
                    milestones: [
                        { id: 3, title: "Hi-Fi Mockups", description: "Figma design completion", status: "planned", targetDate: "2026-03-31", tags: ["design"] }
                    ]
                }
            ]
        }
    ]
};

let currentView = 'gantt'; // default view
let collapsedProjects = new Set(); // Track collapsed project IDs

// Timeline View Settings
let isTimelineAllCollapsed = false;
let overriddenTimelineDates = new Set();
let isTimelineAllMonthsCollapsed = false;
let collapsedTimelineMonths = new Set();

// Gantt View Settings
let ganttSettings = {
    viewType: 'full', // 'full', 'month', 'year'
    selectedMonth: new Date().getMonth(),
    selectedYear: new Date().getFullYear()
};

// ============================================
// INITIALIZATION & MIGRATION
// ============================================

function initRoadmap() {
    try {
        loadFromStorage();
        migrateLegacyData();
        renderRoadmap();
    } catch (e) {
        console.error("Initialization failed:", e);
        document.body.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #ef4444;">
                <h2>⚠️ Roadmap Failed to Load</h2>
                <p>${e.message}</p>
                <button class="btn" style="margin: 20px auto;" onclick="resetRoadmap()">Reset Application</button>
            </div>
        `;
    }
}

/**
 * Ensures old single-project data is nested into a "Default Project"
 */
function migrateLegacyData() {
    if (roadmapData.phases && !roadmapData.projects) {
        roadmapData.projects = [{
            id: 'migrated-' + Date.now(),
            name: "Default Project",
            color: "#00d9ff",
            phases: roadmapData.phases
        }];
        delete roadmapData.phases;
        saveToStorage();
    }
    if (!roadmapData.projects) roadmapData.projects = [];
    if (!roadmapData.allowedAuthors) roadmapData.allowedAuthors = [];
}

// ============================================
// RENDER DISPATCHER
// ============================================

function renderRoadmap() {
    try {
        const cardView = document.getElementById('cardView');
        const timelineView = document.getElementById('timelineView');
        const timelineTitle = document.getElementById('timelineTitle');

        if (!cardView || !timelineView) {
            console.error("Critical UI containers missing");
            return;
        }

        // Hide UI initially
        cardView.style.display = 'none';
        timelineView.style.display = 'none';
        
        const timelineControls = document.querySelector('.timeline-controls');
        const ganttControls = document.querySelector('.gantt-controls');
        
        if (timelineControls) timelineControls.style.display = 'none';
        if (ganttControls) ganttControls.style.display = 'none';

        switch (currentView) {
            case 'timeline':
                timelineView.style.display = 'block';
                if (timelineTitle) timelineTitle.innerHTML = '<span>📅</span> Project Timeline';
                if (timelineControls) timelineControls.style.display = 'flex';
                renderTimelineView();
                break;
            case 'gantt':
                timelineView.style.display = 'block';
                if (timelineTitle) timelineTitle.innerHTML = '<span>📊</span> Portfolio Gantt';
                if (ganttControls) ganttControls.style.display = 'flex';
                renderGanttView();
                break;
            default:
                cardView.style.display = 'block';
                renderCardView();
        }

        // Update active menu item UI
        document.querySelectorAll('.dropdown-item').forEach(item => item.classList.remove('active'));
        const activeItem = document.getElementById(`item-${currentView}`);
        if (activeItem) activeItem.classList.add('active');

        saveToStorage();
    } catch (e) {
        console.error("Rendering failed:", e);
    }
}

function switchView(viewName) {
    currentView = viewName;
    renderRoadmap();
}

// ============================================
// CARD VIEW RENDERING
// ============================================

function renderCardView() {
    const container = document.getElementById('roadmap');

    if (roadmapData.projects.length === 0) {
        container.innerHTML = renderEmptyState("No projects found", "Click 'Add Project' to get started");
        return;
    }

    container.innerHTML = roadmapData.projects.map(project => {
        const isCollapsed = collapsedProjects.has(project.id);
        
        return `
        <div class="project-section ${isCollapsed ? 'collapsed' : ''}" style="--project-color: ${project.color}">
            <div class="project-header">
                <div style="display: flex; align-items: center; gap: 12px; cursor: pointer;" onclick="toggleProjectCollapse('${project.id}')">
                    <span class="collapse-toggle">${isCollapsed ? '▶' : '▼'}</span>
                    <h2 style="margin-bottom: 0;">${escapeHtml(project.name)}</h2>
                </div>
                <div class="project-actions">
                    <button class="btn-sm btn-primary" onclick="openAddPhaseModal('${project.id}')">➕ Add Phase</button>
                    <button class="btn-sm" onclick="editProject('${project.id}')">Edit Project</button>
                    <button class="btn-sm btn-danger-text" onclick="deleteProject('${project.id}')">Delete</button>
                </div>
            </div>
            ${!isCollapsed ? `
                <div class="phases-grid">
                    ${project.phases.map((phase, idx) => `
                        <div class="phase-card">
                            <div class="phase-card-header">
                                <div>
                                    <span class="phase-idx">${idx + 1}</span>
                                    <h3>${escapeHtml(phase.name)}</h3>
                                    <div class="phase-date">${formatDate(phase.startDate)} - ${formatDate(phase.endDate)}</div>
                                </div>
                                <div class="phase-actions">
                                    <button class="icon-btn" title="Edit Phase" onclick="editPhase('${project.id}', ${phase.id})">✎</button>
                                    <button class="icon-btn delete" title="Delete Phase" onclick="deletePhase('${project.id}', ${phase.id})">×</button>
                                </div>
                            </div>
                            <div class="milestones-list">
                                ${phase.milestones.map(m => renderMilestoneItem(project.id, phase.id, m)).join('')}
                                <button class="add-m-btn" onclick="openAddMilestoneModal('${project.id}', ${phase.id})">+ Add Milestone</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;}).join('');
}

function renderMilestoneItem(projectId, phaseId, m) {
    const statusClass = `status-${m.status.replace('-', '')}`;
    return `
        <div class="milestone-item">
            <span class="m-status-dot ${statusClass}"></span>
            <div class="m-content" onclick="editMilestone('${projectId}', ${phaseId}, ${m.id})">
                <span class="m-title">${escapeHtml(m.title)}</span>
                <span class="m-date">${formatDate(m.targetDate)}</span>
            </div>
            <button class="icon-btn delete" style="width: 24px; height: 24px; font-size: 0.75rem;" title="Delete Milestone" onclick="deleteMilestone('${projectId}', ${phaseId}, ${m.id})">×</button>
        </div>
    `;
}

// ============================================
// GANTT VIEW UTILITIES & SETTINGS
// ============================================

function updateGanttSettings(key, value) {
    ganttSettings[key] = value;
    renderRoadmap();
}

function syncGanttUI() {
    const viewType = document.getElementById('ganttViewType');
    const month = document.getElementById('ganttMonth');
    const year = document.getElementById('ganttYear');
    const monthGroup = document.getElementById('monthSelectorGroup');
    const yearGroup = document.getElementById('yearSelectorGroup');

    if (viewType) viewType.value = ganttSettings.viewType;
    if (month) month.value = ganttSettings.selectedMonth;
    
    if (year && year.options.length === 0) {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear - 2; y <= currentYear + 5; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            year.appendChild(opt);
        }
    }
    if (year) year.value = ganttSettings.selectedYear;

    if (monthGroup) monthGroup.style.display = ganttSettings.viewType === 'month' ? 'block' : 'none';
    if (yearGroup) yearGroup.style.display = (ganttSettings.viewType === 'month' || ganttSettings.viewType === 'year') ? 'block' : 'none';
}

// ============================================
// GANTT VIEW RENDERING (HIEARCHICAL)
// ============================================

function renderGanttView() {
    syncGanttUI();
    const container = document.getElementById('timeline');
    if (roadmapData.projects.length === 0) {
        container.innerHTML = renderEmptyState("Gantt view unavailable", "Create projects and phases first");
        return;
    }

    const today = new Date();
    let minDate, maxDate;

    if (ganttSettings.viewType === 'month') {
        minDate = new Date(ganttSettings.selectedYear, ganttSettings.selectedMonth, 1);
        maxDate = new Date(ganttSettings.selectedYear, ganttSettings.selectedMonth + 1, 1); // Start of next month
    } else if (ganttSettings.viewType === 'year') {
        minDate = new Date(ganttSettings.selectedYear, 0, 1);
        maxDate = new Date(ganttSettings.selectedYear + 1, 0, 1); // Start of next year
    } else {
        // Date Bounds Calculation (Full View)
        let allDates = [today];
        roadmapData.projects.forEach(p => p.phases.forEach(ph => {
            allDates.push(parseLocalDate(ph.startDate), parseLocalDate(ph.endDate));
            ph.milestones.forEach(m => allDates.push(parseLocalDate(m.targetDate)));
        }));
        minDate = allDates.length ? new Date(Math.min(...allDates.filter(Boolean))) : new Date(today.getFullYear(), 0, 1);
        maxDate = allDates.length ? new Date(Math.max(...allDates.filter(Boolean))) : new Date(today.getFullYear() + 1, 11, 31);

        // Padding to full months
        minDate.setDate(1);
        maxDate.setMonth(maxDate.getMonth() + 1);
        maxDate.setDate(1); // Start of next month for better range math
    }

    const minTime = minDate.getTime();
    const maxTime = maxDate.getTime();
    const totalMs = Math.max(maxTime - minTime, 86400000); // at least 1 day

    const getPos = (dateOrStr) => {
        const d = (typeof dateOrStr === 'string') ? parseLocalDate(dateOrStr) : dateOrStr;
        if (!d) return 0;
        const pos = ((d.getTime() - minTime) / totalMs) * 100;
        return Math.max(0, Math.min(100, pos)); // Clamp to 0-100%
    };

    const isVisible = (start, end) => {
        const s = parseLocalDate(start).getTime();
        const e = parseLocalDate(end).getTime();
        return (s <= maxTime && e >= minTime);
    };

    // Generate Header (Months or Days)
    let headerHtml = '';
    if (ganttSettings.viewType === 'month') {
        let currDay = 1;
        while (currDay <= 31) {
            const dayDate = new Date(ganttSettings.selectedYear, ganttSettings.selectedMonth, currDay);
            // Verify date is still in the same month (for months with < 31 days)
            if (dayDate.getMonth() !== ganttSettings.selectedMonth) break;

            const width = (86400000 / totalMs) * 100;
            headerHtml += `<div class="gantt-month gantt-day-header" style="left: ${getPos(dayDate)}%; width: ${width}%;">
                ${currDay}
            </div>`;
            currDay++;
        }
    } else {
        let currHeader = new Date(minDate);
        while (currHeader < maxDate) {
            const mStart = new Date(currHeader.getFullYear(), currHeader.getMonth(), 1);
            const mEnd = new Date(currHeader.getFullYear(), currHeader.getMonth() + 1, 1);
            const width = ((mEnd.getTime() - mStart.getTime()) / totalMs) * 100;
            headerHtml += `<div class="gantt-month" style="left: ${getPos(mStart)}%; width: ${width}%">
                ${mStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
            </div>`;
            currHeader.setMonth(currHeader.getMonth() + 1);
        }
    }

    // Today indicator specifically for the header
    const todayMs = today.getTime();
    if (todayMs >= minTime && todayMs <= maxTime) {
        const todayPos = getPos(today);
        headerHtml += `<div class="gantt-today-pin" style="left: ${todayPos}%">
            <span>TODAY</span>
        </div>`;
    }

    // Build Rows
    let bodyHtml = '';

    roadmapData.projects.forEach(project => {
        const isCollapsed = collapsedProjects.has(project.id);
        
        // Filter phases for visibility in current view range
        const visiblePhases = project.phases.filter(ph => isVisible(ph.startDate, ph.endDate));
        
        // If view is not full, and there are no visible phases in this project, skip it
        if (ganttSettings.viewType !== 'full' && visiblePhases.length === 0) return;

        // Project Header Row
        bodyHtml += `
            <div class="gantt-row gantt-project-row" style="--project-color: ${project.color}">
                <div class="gantt-label" onclick="toggleProjectCollapse('${project.id}')" style="cursor: pointer;">
                    <strong>
                        <span class="gantt-toggle-arrow">${isCollapsed ? '▶' : '▼'}</span>
                        📂 ${escapeHtml(project.name)}
                    </strong>
                </div>
                <div class="gantt-track project-track-bg" onclick="toggleProjectCollapse('${project.id}')" style="cursor: pointer;"></div>
            </div>
        `;

        if (!isCollapsed) {
            visiblePhases.forEach(phase => {
                const sTime = Math.max(parseLocalDate(phase.startDate).getTime(), minTime);
                const eTime = Math.min(parseLocalDate(phase.endDate).getTime(), maxDate.getTime());
                
                const pL = ((sTime - minTime) / totalMs) * 100;
                const pW = Math.max(((eTime - sTime) / totalMs) * 100, 0.5);

                bodyHtml += `
                    <div class="gantt-row" style="--project-color: ${project.color}">
                        <div class="gantt-label">
                            <span>${escapeHtml(phase.name)}</span>
                            <small>${formatDate(phase.startDate)} - ${formatDate(phase.endDate)}</small>
                        </div>
                        <div class="gantt-track">
                            <div class="gantt-phase-bar" style="left: ${pL}%; width: ${pW}%" onclick="editPhase('${project.id}', ${phase.id})">
                                 <span class="gantt-phase-label">${escapeHtml(phase.name)}</span>
                            </div>
                            ${(() => {
                                // Group milestones by day to avoid overlapping markers
                                const groups = {};
                                phase.milestones.forEach(m => {
                                    const mTime = parseLocalDate(m.targetDate).getTime();
                                    if (mTime >= minTime && mTime <= maxTime) {
                                        if (!groups[m.targetDate]) groups[m.targetDate] = [];
                                        groups[m.targetDate].push(m);
                                    }
                                });

                                return Object.values(groups).map(ms => {
                                    const first = ms[0];
                                    const mL = getPos(first.targetDate);
                                    
                                    // Determine combined color indicator
                                    let status = 'planned';
                                    if (ms.some(m => m.status === 'in-progress')) status = 'in-progress';
                                    else if (ms.every(m => m.status === 'completed')) status = 'completed';
                                    const color = status === 'completed' ? '#00ff88' : status === 'in-progress' ? '#00d9ff' : '#ffc107';
                                    
                                    const tooltipDetail = ms.map(m => `
                                        <div style="margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">
                                            <strong>${escapeHtml(m.title)}</strong>
                                            ${m.description ? `<br><small class="tooltip-desc">${escapeHtml(m.description)}</small>` : ''}
                                        </div>
                                    `).join('');

                                    return `<div class="gantt-milestone-marker" style="left: ${mL}%; background: ${color}" 
                                                         onclick="event.stopPropagation(); ${ms.length === 1 
                                                            ? `editMilestone('${project.id}', ${phase.id}, ${first.id})` 
                                                            : `showMilestonesDetail('${project.id}', ${phase.id}, '${first.targetDate}')`}">
                                                <span class="gantt-tooltip">
                                                    ${ms.length > 1 ? `<div style="color: #0ea5e9; font-weight: 800; margin-bottom: 8px;">View Details (${ms.length})</div>` : ''}
                                                    ${tooltipDetail}
                                                    <small style="opacity: 0.7;">${formatDate(first.targetDate)}</small>
                                                </span>
                                            </div>`;
                                }).join('');
                            })()}
                        </div>
                    </div>
                `;
            });
        }
    });

    container.innerHTML = `
        <div class="gantt-container">
            <div class="gantt-header">
                <div class="gantt-label-header">Projects & Phases</div>
                <div class="gantt-months">${headerHtml}</div>
            </div>
            <div class="gantt-body">${bodyHtml}</div>
        </div>
    `;
}

function toggleProjectCollapse(projectId) {
    if (collapsedProjects.has(projectId)) {
        collapsedProjects.delete(projectId);
    } else {
        collapsedProjects.add(projectId);
    }
    renderRoadmap(); // Master dispatch ensures current view refreshes
}

// ============================================
// TIMELINE VIEWS (SIMPLIFIED RE-IMPLEMENTATION)
// ============================================

function renderTimelineView() {
    const container = document.getElementById('timeline');
    const projectFilterSelect = document.getElementById('projectFilter');
    const phaseFilterSelect = document.getElementById('phaseFilter');
    
    // Populate filters if they exist
    if (projectFilterSelect && projectFilterSelect.options.length <= 1) {
        const currentFilter = projectFilterSelect.value;
        projectFilterSelect.innerHTML = '<option value="all">All Projects</option>' + 
            roadmapData.projects.map(p => `<option value="${p.id}" ${currentFilter === p.id ? 'selected' : ''}>${p.name}</option>`).join('');
        
        // Ensure phase filter is also initialized
        updatePhaseFilterOptions();
    }

    const projectFilter = projectFilterSelect ? projectFilterSelect.value : 'all';
    const phaseFilter = phaseFilterSelect ? phaseFilterSelect.value : 'all';

    let allMilestones = [];
    roadmapData.projects.forEach(p => {
        if (projectFilter !== 'all' && p.id !== projectFilter) return;

        p.phases.forEach(ph => {
            if (phaseFilter !== 'all' && String(ph.id) !== phaseFilter) return;

            ph.milestones.forEach(m => {
                allMilestones.push({ ...m, projectName: p.name, projectColor: p.color });
            });
        });
    });

    // Grouping by date
    const grouped = {};
    allMilestones.forEach(m => {
        if (!grouped[m.targetDate]) grouped[m.targetDate] = [];
        grouped[m.targetDate].push(m);
    });

    const sortedDates = Object.keys(grouped).sort((a, b) => parseLocalDate(a) - parseLocalDate(b));

    if (allMilestones.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--text-dim);">
                <span style="font-size: 3rem; display: block; margin-bottom: 16px;">🔍</span>
                <p style="font-size: 1.1rem;">No milestones found matching your criteria</p>
                <button class="btn btn-sm" style="margin-top: 12px;" onclick="resetTimelineFilters()">Clear Filters</button>
            </div>
        `;
        return;
    }

     // Final month-wise grouping
    const monthGroups = {};
    sortedDates.forEach(date => {
        const d = parseLocalDate(date);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthGroups[mKey]) monthGroups[mKey] = [];
        monthGroups[mKey].push(date);
    });

    const sortedMonthKeys = Object.keys(monthGroups).sort();

    container.innerHTML = `
        <div class="timeline-v-scroll" style="padding-bottom: 80px;">
            ${sortedMonthKeys.map(mKey => {
                const [year, month] = mKey.split('-');
                const d = new Date(year, month - 1, 1);
                const monthName = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                
                // Determine monthly collapse state
                let isMonthCollapsed = isTimelineAllMonthsCollapsed;
                if (collapsedTimelineMonths.has(mKey)) isMonthCollapsed = !isMonthCollapsed;

                return `
                    <div class="timeline-month-header" onclick="toggleTimelineMonth('${mKey}')" style="cursor: pointer;">
                        <span class="gantt-toggle-arrow" style="margin-right: 12px; font-size: 0.7rem; color: #94a3b8; transition: transform 0.2s; display: inline-block; transform: ${isMonthCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}">▼</span>
                        ${monthName}
                    </div>
                    ${isMonthCollapsed ? '' : monthGroups[mKey].map(date => {
                        const ms = grouped[date];
                        
                        // Aggregated status logic
                        let status = '';
                        if (ms.every(m => m.status === 'completed')) status = 'completed';
                        else if (ms.some(m => m.status === 'in-progress')) status = 'inprogress';
                        
                        // Determine collapse state
                        let isCollapsed = isTimelineAllCollapsed;
                        if (overriddenTimelineDates.has(date)) isCollapsed = !isCollapsed;

                        const rowStatusClass = status ? `status-${status}` : '';
                        const collapseClass = isCollapsed ? 'is-collapsed' : '';
                        const first = ms[0];

                        return `
                        <div class="timeline-v-item ${rowStatusClass} ${collapseClass}" style="--p-color: ${first.projectColor}" onclick="event.stopPropagation(); toggleTimelineDate('${date}')">
                            <div class="v-bubble" title="Click to ${isCollapsed ? 'Expand' : 'Collapse'}">
                                ${(() => {
                                    const dObj = parseLocalDate(date);
                                    return `<span class="v-day">${dObj.getDate()}</span><span class="v-month">${dObj.toLocaleDateString('en-US', { month: 'short' })}</span>`;
                                })()}
                            </div>
                            <div class="v-cards-stack">
                                ${ms.map(m => `
                                    <div class="v-content status-${m.status.replace('-', '')}" style="--p-color: ${m.projectColor}">
                                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                                            <small style="color: var(--p-color); font-weight: 700;">${escapeHtml(m.projectName)}</small>
                                            <span class="badge-${m.status.replace('-', '')}" style="font-size: 0.65rem;">${m.status.toUpperCase()}</span>
                                        </div>
                                        <h4>${escapeHtml(m.title)}</h4>
                                        <p>${escapeHtml(m.description || '')}</p>
                                    </div>
                                `).join('')}
                            </div>
                        </div>`;
                    }).join('')}
                `;
            }).join('')}
        </div>
    `;
}

function toggleTimelineMonth(mKey) {
    if (collapsedTimelineMonths.has(mKey)) {
        collapsedTimelineMonths.delete(mKey);
    } else {
        collapsedTimelineMonths.add(mKey);
    }
    renderTimelineView();
}

function toggleTimelineAllMonths() {
    isTimelineAllMonthsCollapsed = !isTimelineAllMonthsCollapsed;
    collapsedTimelineMonths.clear();
    renderTimelineView();
}

function toggleTimelineAll() {
    isTimelineAllCollapsed = !isTimelineAllCollapsed;
    overriddenTimelineDates.clear(); // Reset overrides when global toggle used
    renderTimelineView();
}

function toggleTimelineDate(date) {
    if (overriddenTimelineDates.has(date)) {
        overriddenTimelineDates.delete(date);
    } else {
        overriddenTimelineDates.add(date);
    }
    renderTimelineView();
}

function updateTimelineFilters() {
    renderTimelineView();
}

function updatePhaseFilterOptions() {
    const projectFilter = document.getElementById('projectFilter');
    const phaseFilter = document.getElementById('phaseFilter');
    if (!projectFilter || !phaseFilter) return;

    const selectedProjectId = projectFilter.value;
    if (selectedProjectId === 'all') {
        const allPhases = [];
        roadmapData.projects.forEach(p => {
            p.phases.forEach(ph => {
                allPhases.push({ id: ph.id, name: ph.name, projectName: p.name });
            });
        });

        phaseFilter.innerHTML = '<option value="all">All Phases</option>' + 
            allPhases.map(ph => `<option value="${ph.id}">${ph.name} (${ph.projectName})</option>`).join('');
        phaseFilter.value = 'all';
        return;
    }

    const project = roadmapData.projects.find(p => p.id === selectedProjectId);
    if (project) {
        phaseFilter.innerHTML = '<option value="all">All Phases</option>' + 
            project.phases.map(ph => `<option value="${ph.id}">${ph.name}</option>`).join('');
    } else {
        phaseFilter.innerHTML = '<option value="all">All Phases</option>';
    }
    phaseFilter.value = 'all';
}

function resetTimelineFilters() {
    const projectFilter = document.getElementById('projectFilter');
    const phaseFilter = document.getElementById('phaseFilter');
    if (projectFilter) projectFilter.value = 'all';
    updatePhaseFilterOptions();
    renderTimelineView();
}

function renderHorizontalTimeline() {
    // Similar to timeline but flex-row, focused on project streams
    renderGanttView(); // Temporarily fallback to Gantt as it's the best "one place" view
}

// ============================================
// PROJECT MANAGEMENT
// ============================================

function openAddProjectModal() {
    document.getElementById('projectModalTitle').textContent = 'Add New Project';
    document.getElementById('projectForm').reset();
    document.getElementById('projectId').value = '';
    document.getElementById('projectModal').classList.add('active');
}

function editProject(id) {
    const p = roadmapData.projects.find(p => p.id === id);
    if (!p) return;
    document.getElementById('projectModalTitle').textContent = 'Edit Project';
    document.getElementById('projectId').value = p.id;
    document.getElementById('projectName').value = p.name;
    document.getElementById('projectColor').value = p.color || '#00d9ff';
    document.getElementById('projectModal').classList.add('active');
}

function deleteProject(id) {
    if (confirm('Delete this project and all its data?')) {
        roadmapData.projects = roadmapData.projects.filter(p => p.id !== id);
        renderRoadmap();
    }
}

document.getElementById('projectForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('projectId').value;
    const name = document.getElementById('projectName').value;
    const color = document.getElementById('projectColor').value;

    if (id) {
        const p = roadmapData.projects.find(p => p.id === id);
        if (p) { p.name = name; p.color = color; }
    } else {
        roadmapData.projects.push({ id: 'p-' + Date.now(), name, color, phases: [] });
    }
    document.getElementById('projectModal').classList.remove('active');
    renderRoadmap();
});

// ============================================
// PHASE & MILESTONE UPDATES (NESTED)
// ============================================

function openAddPhaseModal(projectId) {
    document.getElementById('phaseModalTitle').textContent = 'Add Phase';
    document.getElementById('phaseForm').reset();
    document.getElementById('phaseId').value = '';
    document.getElementById('phaseProjectId').value = projectId;
    document.getElementById('phaseModal').classList.add('active');
}

function editPhase(projectId, phaseId) {
    const p = roadmapData.projects.find(p => p.id === projectId);
    const ph = p?.phases.find(ph => ph.id === phaseId);
    if (!ph) return;

    document.getElementById('phaseModalTitle').textContent = 'Edit Phase';
    document.getElementById('phaseId').value = ph.id;
    document.getElementById('phaseProjectId').value = projectId;
    document.getElementById('phaseName').value = ph.name;
    document.getElementById('phaseStartDate').value = ph.startDate;
    document.getElementById('phaseEndDate').value = ph.endDate;
    document.getElementById('phaseModal').classList.add('active');
}

document.getElementById('phaseForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const projectId = document.getElementById('phaseProjectId').value;
    const phaseId = document.getElementById('phaseId').value;
    const p = roadmapData.projects.find(p => p.id === projectId);

    const data = {
        name: document.getElementById('phaseName').value,
        startDate: document.getElementById('phaseStartDate').value,
        endDate: document.getElementById('phaseEndDate').value,
    };

    if (phaseId) {
        const ph = p.phases.find(ph => ph.id == phaseId);
        Object.assign(ph, data);
    } else {
        p.phases.push({ id: Date.now(), ...data, milestones: [] });
    }
    document.getElementById('phaseModal').classList.remove('active');
    renderRoadmap();
});

function deletePhase(projectId, phaseId) {
    const p = roadmapData.projects.find(p => p.id === projectId);
    if (p && confirm('Delete phase?')) {
        p.phases = p.phases.filter(ph => ph.id !== phaseId);
        renderRoadmap();
    }
}

// Milestone extensions
function openAddMilestoneModal(projectId, phaseId) {
    document.getElementById('milestoneModalTitle').textContent = 'Add Milestone';
    document.getElementById('milestoneForm').reset();
    document.getElementById('milestoneId').value = '';
    document.getElementById('milestoneProjectId').value = projectId;
    document.getElementById('milestonePhaseId').value = phaseId;
    document.getElementById('deleteMilestoneBtn').style.display = 'none';
    document.getElementById('milestoneModal').classList.add('active');
}

function editMilestone(projectId, phaseId, milestoneId) {
    const p = roadmapData.projects.find(p => p.id === projectId);
    const ph = p?.phases.find(ph => ph.id === phaseId);
    const m = ph?.milestones.find(m => m.id === milestoneId);
    if (!m) return;

    document.getElementById('milestoneModalTitle').textContent = 'Edit Milestone';
    document.getElementById('milestoneId').value = m.id;
    document.getElementById('milestoneProjectId').value = projectId;
    document.getElementById('milestonePhaseId').value = phaseId;
    document.getElementById('milestoneTitle').value = m.title;
    document.getElementById('milestoneDescription').value = m.description;
    document.getElementById('milestoneStatus').value = m.status;
    document.getElementById('milestoneDate').value = m.targetDate;
    document.getElementById('milestoneTags').value = m.tags.join(', ');
    document.getElementById('deleteMilestoneBtn').style.display = 'block';
    document.getElementById('milestoneModal').classList.add('active');
}

document.getElementById('milestoneForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const projectId = document.getElementById('milestoneProjectId').value;
    const phaseId = document.getElementById('milestonePhaseId').value;
    const milestoneId = document.getElementById('milestoneId').value;
    const ph = roadmapData.projects.find(p => p.id === projectId)?.phases.find(ph => ph.id == phaseId);

    const tags = document.getElementById('milestoneTags').value;
    const data = {
        title: document.getElementById('milestoneTitle').value,
        description: document.getElementById('milestoneDescription').value,
        status: document.getElementById('milestoneStatus').value,
        targetDate: document.getElementById('milestoneDate').value,
        tags: tags ? tags.split(',').map(t => t.trim()) : []
    };

    if (milestoneId) {
        const m = ph.milestones.find(m => m.id == milestoneId);
        Object.assign(m, data);
    } else {
        ph.milestones.push({ id: Date.now(), ...data });
    }
    document.getElementById('milestoneModal').classList.remove('active');
    renderRoadmap();
});

function deleteMilestone(projectId, phaseId, milestoneId) {
    const p = roadmapData.projects.find(p => p.id === projectId);
    const ph = p?.phases.find(ph => ph.id === phaseId);
    if (ph && confirm('Delete milestone?')) {
        ph.milestones = ph.milestones.filter(m => m.id !== milestoneId);
        document.getElementById('milestoneModal').classList.remove('active');
        renderRoadmap();
    }
}

function deleteMilestoneFromModal() {
    const projectId = document.getElementById('milestoneProjectId').value;
    const phaseId = document.getElementById('milestonePhaseId').value;
    const milestoneId = document.getElementById('milestoneId').value;
    if (milestoneId) {
        deleteMilestone(projectId, parseInt(phaseId), parseInt(milestoneId));
    }
}

// ============================================
// IMPORT/EXPORT FUNCTIONS
// ============================================

function exportRoadmap() {
    const dataStr = JSON.stringify(roadmapData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roadmap-portfolio.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importRoadmap() {
    document.getElementById('importFile').click();
}

function openBulkImportModal() {
    document.getElementById('bulkPasteArea').value = '';
    document.getElementById('bulkModal').classList.add('active');
}

function openTeamModal() {
    const list = roadmapData.allowedAuthors || [];
    document.getElementById('fullTeamRegistry').value = list.join('\n');
    renderTeamChips();
    document.getElementById('teamModal').classList.add('active');
}

function renderTeamChips() {
    const list = roadmapData.allowedAuthors || [];
    const container = document.getElementById('teamChipsContainer');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = '<p style="color: #94a3b8; font-size: 0.8rem; margin: auto;">No members added yet.</p>';
        return;
    }

    container.innerHTML = list.map(name => `
        <div class="team-chip">
            <span>${escapeHtml(name || "(Blank)")}</span>
            <button onclick="removeTeamMember('${name.replace(/'/g, "\\'")}')" title="Remove">×</button>
        </div>
    `).join('');
}

function addIndividualMember() {
    const input = document.getElementById('addTeamMember');
    const name = input.value.trim();
    if (name) {
        if (!roadmapData.allowedAuthors) roadmapData.allowedAuthors = [];
        if (!roadmapData.allowedAuthors.includes(name)) {
            roadmapData.allowedAuthors.push(name);
            document.getElementById('fullTeamRegistry').value = roadmapData.allowedAuthors.join('\n');
            renderTeamChips();
        }
    }
    input.value = '';
    input.focus();
}

function removeTeamMember(name) {
    roadmapData.allowedAuthors = roadmapData.allowedAuthors.filter(n => n !== name);
    document.getElementById('fullTeamRegistry').value = roadmapData.allowedAuthors.join('\n');
    renderTeamChips();
}

function syncChipsFromText() {
    const raw = document.getElementById('fullTeamRegistry').value;
    roadmapData.allowedAuthors = raw.split('\n').map(s => s.trim());
    renderTeamChips();
}

function saveFullTeamRegistry() {
    syncChipsFromText(); // Final sync
    saveToStorage();
    closeTeamModal();
}

function closeTeamModal() {
    document.getElementById('teamModal').classList.remove('active');
}

function closeBulkModal() {
    document.getElementById('bulkModal').classList.remove('active');
}

function processBulkImport() {
    const rawData = document.getElementById('bulkPasteArea').value; // Don't trim yet, we need leading spaces
    const filterInput = document.getElementById('bulkFilter').value.trim().toLowerCase();
    const filterKeywords = filterInput ? filterInput.split('+').map(k => k.trim()) : [];
    
    // Normalize team registry for faster lookup
    const approvedTeam = new Set((roadmapData.allowedAuthors || []).map(a => a.toLowerCase()));

    if (!rawData) return;

    const lines = rawData.split('\n');
    let lastProject = null;
    let lastPhase = null;
    let count = 0;

    const parseExcelDate = (str) => {
        if (!str || typeof str !== 'string' || !str.includes('/')) return null;
        const parts = str.split('/');
        let year = parts[2] ? (parts[2].length === 2 ? '20' + parts[2] : parts[2]) : new Date().getFullYear();
        return `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    };

    if (document.getElementById('clearOnImport').checked) {
        roadmapData.projects = [];
    }

    lines.forEach(line => {
        const cols = line.split('\t');
        if (cols.length < 5) return;

        const nameCell = cols[2] || "";
        const leadingSpaces = nameCell.match(/^\s*/)[0].length;
        const name = nameCell.trim();
        const typeCol = (cols[4] || "").toLowerCase();
        const status = (cols[7] || "").toLowerCase();

        // Indentation Rules:
        // 0 spaces = Project
        // 1 space  = Phase
        // 1+ spaces or dash = Milestone
        let inferredType = 'task';
        if (leadingSpaces === 0 && name && !name.startsWith('—')) inferredType = 'project';
        else if (leadingSpaces === 1 || typeCol.includes('version')) inferredType = 'version';
        else inferredType = 'task';

        // Extract Dates: Plan Start (Col 10), Plan Finish (Col 11)
        const planStart = parseExcelDate(cols[10]);
        const planFinish = parseExcelDate(cols[11]);
        const targetDate = planFinish || planStart || new Date().toISOString().split('T')[0];

        // Filtering: Only apply to milestones (tasks). 
        // We always process Project/Version rows to maintain context, even if they don't match.
        if (filterKeywords.length > 0 && inferredType === 'task') {
            const matches = filterKeywords.some(k => name.toLowerCase().includes(k));
            if (!matches) return;
        }

        // --- TEAM REGISTRY FILTER ---
        // Only apply if the team registry has entries
        if (approvedTeam.size > 0 && inferredType === 'task') {
            const assignee = (cols[5] || "").trim().toLowerCase();
            // User mentioned they also keep "Blank" (unassigned) tasks sometimes.
            // If they want specifically ONLY the team, we check for match.
            if (!approvedTeam.has(assignee)) return;
        }

        // --- HIERARCHY MAPPING ---

        if (inferredType === 'project') {
            let p = roadmapData.projects.find(p => p.name.toLowerCase() === name.toLowerCase());
            if (!p) {
                p = { id: 'p-' + Date.now() + Math.random(), name: name, color: '#0ea5e9', phases: [] };
                roadmapData.projects.push(p);
            }
            lastProject = p;
            lastPhase = null;
        }
        else if (inferredType === 'version') {
            if (!lastProject) {
                lastProject = { id: 'p-' + Date.now(), name: "Imported Project", color: '#0ea5e9', phases: [] };
                roadmapData.projects.push(lastProject);
            }
            let ph = lastProject.phases.find(ph => ph.name.toLowerCase() === name.toLowerCase());
            if (!ph) {
                ph = {
                    id: Date.now() + Math.random(),
                    name: name,
                    startDate: planStart || targetDate,
                    endDate: planFinish || targetDate,
                    milestones: []
                };
                lastProject.phases.push(ph);
            }
            lastPhase = ph;
        }
        else { // Milestone/Task
            if (!lastProject) return;

            if (!lastPhase) {
                lastPhase = { id: Date.now() + Math.random(), name: "Other Tasks", startDate: targetDate, endDate: targetDate, milestones: [] };
                lastProject.phases.push(lastPhase);
            }

            let mappedStatus = 'planned';
            if (status.includes('done') || status.includes('complete')) mappedStatus = 'completed';
            else if (status.includes('review') || status.includes('progress')) mappedStatus = 'in-progress';

            lastPhase.milestones.push({
                id: Date.now() + Math.random(),
                title: name.replace(/^—\s*/, ''),
                description: `Key: ${cols[3] || ''} | Assignee: ${cols[5] || ''}`,
                status: mappedStatus,
                targetDate: targetDate,
                tags: [cols[6] || 'excel']
            });

            if (planStart && planStart < lastPhase.startDate) lastPhase.startDate = planStart;
            if (planFinish && planFinish > lastPhase.endDate) lastPhase.endDate = planFinish;
            count++;
        }
    });

    // --- Post-Import Cleanup (If filtered) ---
    // If a filter was used, remove any empty phases or projects created as skeletons
    if (filterKeywords.length > 0) {
        roadmapData.projects.forEach(p => {
            p.phases = p.phases.filter(ph => ph.milestones.length > 0);
        });
        roadmapData.projects = roadmapData.projects.filter(p => p.phases.length > 0);
    }

    closeBulkModal();
    renderRoadmap();
    alert(`Import complete! ${count} milestones synced.`);
}

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (!imported.projects) throw new Error('Invalid format: Missing "projects" array');
            roadmapData = imported;
            renderRoadmap();
            alert('Portfolio imported successfully!');
        } catch (error) {
            alert('Error importing: ' + error.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function resetRoadmap() {
    if (confirm('Are you sure you want to delete ALL projects and clear the roadmap? This action cannot be undone.')) {
        roadmapData = { projects: [] };
        saveToStorage();
        renderRoadmap();
    }
}

// ============================================
// UTILITIES (EXISTING + IMPROVED)
// ============================================

function toggleView() {
    const views = ['card', 'timeline', 'gantt'];
    currentView = views[(views.indexOf(currentView) + 1) % views.length];
    renderRoadmap();
}

function renderEmptyState(title, subtitle) {
    return `<div class="empty-state">
        <div class="empty-icon">📂</div>
        <h3>${title}</h3>
        <p>${subtitle}</p>
    </div>`;
}

function parseLocalDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDate(dateStr) {
    const d = parseLocalDate(dateStr);
    return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

function escapeHtml(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

function saveToStorage() { localStorage.setItem('roadmapPortfolio', JSON.stringify(roadmapData)); }
function loadFromStorage() {
    const data = localStorage.getItem('roadmapPortfolio') || localStorage.getItem('roadmapData');
    if (data) roadmapData = JSON.parse(data);
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('active');
}

function showMilestonesDetail(projectId, phaseId, dateStr) {
    const p = roadmapData.projects.find(p => p.id === projectId);
    const ph = p?.phases.find(ph => ph.id === phaseId);
    if (!ph) return;

    const msOnDate = ph.milestones.filter(m => m.targetDate === dateStr);
    const title = document.getElementById('detailModalTitle');
    const body = document.getElementById('detailModalBody');

    if (title) title.textContent = `📅 Items for ${formatDate(dateStr)}`;
    if (body) {
        body.innerHTML = msOnDate.map(m => {
            const statusColor = m.status === 'completed' ? '#10b981' : m.status === 'in-progress' ? '#0ea5e9' : '#f59e0b';
            return `
                <div class="milestone-item" onclick="editMilestone('${projectId}', ${phaseId}, ${m.id}); closeDetailModal()" style="border-left: 4px solid ${statusColor}; background: #f8fafc; padding: 16px; border-radius: 12px; transition: 0.2s; cursor: pointer;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <strong style="color: var(--text-primary); font-size: 1rem;">${escapeHtml(m.title)}</strong>
                        <span class="badge-${m.status.replace('-', '')}" style="font-size: 0.65rem;">${m.status.toUpperCase()}</span>
                    </div>
                    ${m.description ? `<p style="font-size: 0.813rem; color: var(--text-secondary); margin: 0;">${escapeHtml(m.description)}</p>` : ''}
                </div>
            `;
        }).join('');
    }

    document.getElementById('detailModal').classList.add('active');
}

// UI Handlers
function closeProjectModal() { document.getElementById('projectModal').classList.remove('active'); }
function closePhaseModal() { document.getElementById('phaseModal').classList.remove('active'); }
function closeMilestoneModal() { document.getElementById('milestoneModal').classList.remove('active'); }

// Handle closing by clicking outside
[document.getElementById('projectModal'), document.getElementById('phaseModal'), document.getElementById('milestoneModal'), document.getElementById('teamModal'), document.getElementById('bulkModal'), document.getElementById('detailModal')].forEach(modal => {
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === this) this.classList.remove('active');
        });
    }
});

// Handle Escape key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeProjectModal();
        closePhaseModal();
        closeMilestoneModal();
        closeTeamModal();
        closeBulkModal();
        closeDetailModal();
    }
});

document.addEventListener('DOMContentLoaded', initRoadmap);
