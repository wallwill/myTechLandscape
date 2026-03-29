// --- Logger ---
const LOG_LEVELS = { trace: 0, debug: 1, info: 2, warn: 3, error: 4, off: 5 };
const logger = (() => {
  let level = LOG_LEVELS[(localStorage.getItem('logLevel') || 'info')
    .toLowerCase()] ?? LOG_LEVELS.info;

  const fmt = (lvl, args) => [`[${lvl.toUpperCase()}]`, ...args];

  return {
    setLevel(l) {
      level = LOG_LEVELS[l.toLowerCase()] ?? LOG_LEVELS.info;
      localStorage.setItem('logLevel', l);
      console.info(`[LOGGER] level set to ${l}`);
    },
    getLevel() { return Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === level); },
    trace(...a) { if (level <= LOG_LEVELS.trace) console.debug(...fmt('trace', a)); },
    debug(...a) { if (level <= LOG_LEVELS.debug) console.debug(...fmt('debug', a)); },
    info(...a)  { if (level <= LOG_LEVELS.info)  console.info(...fmt('info',  a)); },
    warn(...a)  { if (level <= LOG_LEVELS.warn)  console.warn(...fmt('warn',  a)); },
    error(...a) { if (level <= LOG_LEVELS.error) console.error(...fmt('error', a)); },
  };
})();

// Expose logger on window for console access: logger.setLevel('debug')
window.logger = logger;

const STAGES = [
  { value: 'Invest',    color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
  { value: 'Maintain',  color: '#2563eb', bg: '#dbeafe', border: '#93c5fd' },
  { value: 'Tolerate',  color: '#d97706', bg: '#fef3c7', border: '#fcd34d' },
  { value: 'Eliminate', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
];

const STATE = {
  user: null,
  teams: [],
  currentTeamId: null,
  projects: [],
  assignMap: {},
  currentProject: null,
};

// --- API ---
async function api(method, url, body) {
  logger.debug(`→ ${method} ${url}`, body !== undefined ? body : '');
  const t0 = performance.now();
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  const ms = (performance.now() - t0).toFixed(1);
  if (!res.ok) {
    logger.warn(`← ${method} ${url} ${res.status} (${ms}ms)`, data);
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  logger.trace(`← ${method} ${url} ${res.status} (${ms}ms)`, data);
  return data;
}

// --- Init ---
async function init() {
  logger.info('init: starting app');
  try {
    const me = await api('GET', '/api/auth/me');
    if (!me) { logger.debug('init: no session, showing login'); showLogin(); return; }
    STATE.user = me;
    logger.info('init: session found', { user: me.username, role: me.role });
    await startApp();
  } catch (e) {
    logger.debug('init: auth check failed, showing login', e.message);
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-overlay').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
  setTimeout(() => document.getElementById('login-username').focus(), 50);
}

async function startApp() {
  logger.debug('startApp: loading teams and landscape');
  document.getElementById('login-overlay').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');

  try {
    STATE.teams = await api('GET', '/api/teams');
    STATE.currentTeamId = STATE.user.teamId || STATE.teams[0]?.id || null;
    logger.debug('startApp: teams loaded', { count: STATE.teams.length, currentTeamId: STATE.currentTeamId });

    populateTeamSelector();
    updateUserMenu();

    const [projects, assignments] = await Promise.all([
      api('GET', '/api/landscape'),
      STATE.currentTeamId ? api('GET', `/api/assignments?team_id=${STATE.currentTeamId}`) : Promise.resolve([]),
    ]);

    STATE.projects = projects;
    logger.info('startApp: ready', { projects: projects.length, assignments: assignments.length, teamId: STATE.currentTeamId });
    buildAssignMap(assignments);
    populateCategoryFilter();
    render();
    updateStats();
  } catch (e) {
    logger.error('startApp: failed to load', e.message);
    document.getElementById('app').innerHTML = `<div class="no-results">Failed to load: ${esc(e.message)}</div>`;
  }
}

function buildAssignMap(assignments) {
  STATE.assignMap = {};
  assignments.forEach(a => { STATE.assignMap[a.project_id] = a; });
}

// --- Team selector ---
function populateTeamSelector() {
  const sel = document.getElementById('team-selector');
  if (!STATE.teams.length) {
    sel.innerHTML = '<option value="">No teams</option>';
    return;
  }
  sel.innerHTML = STATE.teams.map(t =>
    `<option value="${t.id}" ${t.id === STATE.currentTeamId ? 'selected' : ''}>${esc(t.name)}</option>`
  ).join('');
}

async function onTeamChange() {
  STATE.currentTeamId = parseInt(document.getElementById('team-selector').value) || null;
  logger.debug('onTeamChange', { currentTeamId: STATE.currentTeamId });
  if (!STATE.currentTeamId) { STATE.assignMap = {}; render(); updateStats(); return; }
  const assignments = await api('GET', `/api/assignments?team_id=${STATE.currentTeamId}`);
  buildAssignMap(assignments);
  render();
  updateStats();
}

// --- User menu ---
function updateUserMenu() {
  document.getElementById('user-display-name').textContent = STATE.user.username;
  document.getElementById('user-avatar').textContent = STATE.user.username[0].toUpperCase();
  if (STATE.user.role === 'admin') {
    document.getElementById('btn-admin-panel').classList.remove('hidden');
  }
}

// --- Filters ---
function populateCategoryFilter() {
  const sel = document.getElementById('filter-category');
  const cats = [...new Set(STATE.projects.map(p => p.category))].sort();
  sel.innerHTML = '<option value="">All Categories</option>' +
    cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

function getFilteredProjects() {
  const search = document.getElementById('search').value.toLowerCase().trim();
  const cat    = document.getElementById('filter-category').value;
  const stage  = document.getElementById('filter-stage').value;
  const cncf   = document.getElementById('filter-cncf').value;

  return STATE.projects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search) &&
        !(p.category || '').toLowerCase().includes(search) &&
        !(p.subcategory || '').toLowerCase().includes(search)) return false;
    if (cat && p.category !== cat) return false;
    if (cncf && p.project !== cncf) return false;
    const assigned = STATE.assignMap[p.id]?.stage;
    if (stage === 'unassigned' && assigned) return false;
    if (stage && stage !== 'unassigned' && assigned !== stage) return false;
    return true;
  });
}

// --- Render ---
function render() {
  const app = document.getElementById('app');
  const projects = getFilteredProjects();

  if (!projects.length) {
    app.innerHTML = '<div class="no-results">No projects match your filters.</div>';
    return;
  }

  const grouped = {};
  for (const p of projects) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  }

  app.innerHTML = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => `
    <section class="category-section">
      <div class="category-header">
        ${esc(cat)}
        <span class="category-count">${items.length}</span>
      </div>
      <div class="projects-grid">
        ${items.map(p => renderCard(p)).join('')}
      </div>
    </section>
  `).join('');

  app.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', () => openDetailModal(card.dataset.id));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openDetailModal(card.dataset.id); });
  });
}

function renderCard(p) {
  const a = STATE.assignMap[p.id];
  const stage = a?.stage || '';
  const si = STAGES.find(s => s.value === stage);

  const badgeMap = { graduated: 'badge-graduated', incubating: 'badge-incubating', sandbox: 'badge-sandbox' };
  const badge = p.project && badgeMap[p.project]
    ? `<span class="badge ${badgeMap[p.project]}">${esc(p.project)}</span>` : '';

  const stageChip = si
    ? `<span class="stage-chip" style="background:${si.bg};color:${si.color};border-color:${si.border}">${esc(stage)}</span>`
    : `<span class="stage-chip stage-chip-none">Unassigned</span>`;

  const ownerBadge = a?.owner ? `<span class="owner-badge">${esc(a.owner)}</span>` : '';
  const notesIcon = a?.notes ? `<span class="notes-icon" title="${esc(a.notes)}">&#128203;</span>` : '';
  const borderStyle = si ? `border-left: 3px solid ${si.color};` : '';

  return `
    <div class="project-card" data-id="${esc(p.id)}" style="${borderStyle}" role="button" tabindex="0" aria-label="${esc(p.name)}">
      <div class="project-top">
        <div class="project-name">${esc(p.name)}</div>
        <div class="project-badges">${badge}</div>
      </div>
      <div class="project-sub">${esc(p.subcategory)}</div>
      ${p.description ? `<div class="project-desc">${esc(p.description)}</div>` : ''}
      <div class="project-footer">
        ${stageChip}
        ${ownerBadge}
        ${notesIcon}
      </div>
    </div>
  `;
}

// --- Stats ---
function updateStats() {
  const total = STATE.projects.length;
  const assigned = Object.keys(STATE.assignMap).length;
  const unassigned = total - assigned;
  const stageCounts = {};
  STAGES.forEach(s => { stageCounts[s.value] = 0; });
  Object.values(STATE.assignMap).forEach(a => { if (stageCounts[a.stage] !== undefined) stageCounts[a.stage]++; });

  const stageHtml = STAGES.map(s => stageCounts[s.value] > 0 ? `
    <span class="stat">
      <span class="dot" style="background:${s.color}"></span>
      ${esc(s.value)}: <strong>${stageCounts[s.value]}</strong>
    </span>` : '').join('');

  document.getElementById('stats').innerHTML = `
    <span class="stat">Total: <strong>${total}</strong></span>
    <span class="stat">Assigned: <strong>${assigned}</strong></span>
    <span class="stat">Unassigned: <strong>${unassigned}</strong></span>
    ${stageHtml}
  `;
}

// --- Detail Modal ---
async function openDetailModal(projectId) {
  logger.debug('openDetailModal', { projectId });
  const p = STATE.projects.find(x => x.id === projectId);
  if (!p) return;
  STATE.currentProject = p;

  const a = STATE.assignMap[projectId] || {};
  const titleEl = document.getElementById('modal-project-name');

  if (p.homepage_url && /^https?:\/\//i.test(p.homepage_url)) {
    titleEl.innerHTML = `<a href="${esc(p.homepage_url)}" target="_blank" rel="noopener noreferrer">${esc(p.name)}</a>`;
  } else {
    titleEl.textContent = p.name;
  }

  document.getElementById('modal-project-sub').textContent = `${p.category} › ${p.subcategory}`;
  const descEl = document.getElementById('modal-description');
  descEl.textContent = p.description || '';
  descEl.style.display = p.description ? '' : 'none';

  const stageEl = document.getElementById('modal-stage');
  stageEl.value = a.stage || '';
  applyStageSelectStyle(stageEl, a.stage || '');

  document.getElementById('modal-owner').value = a.owner || '';
  document.getElementById('modal-notes').value = a.notes || '';
  document.getElementById('modal-remove').style.display = a.stage ? '' : 'none';

  const auditEl = document.getElementById('modal-audit-log');
  auditEl.innerHTML = '<div class="audit-empty">Loading history...</div>';
  document.getElementById('detail-modal').classList.remove('hidden');

  try {
    const log = await api('GET', `/api/audit?team_id=${STATE.currentTeamId}&project_id=${encodeURIComponent(projectId)}`);
    if (!log.length) {
      auditEl.innerHTML = '<div class="audit-empty">No changes recorded yet.</div>';
    } else {
      auditEl.innerHTML = log.map(entry => {
        const date = new Date(entry.created_at * 1000).toLocaleString();
        const actionLabel = { assign: 'Assigned to', update: 'Updated to', remove: 'Removed' }[entry.action] || entry.action;
        const si = STAGES.find(s => s.value === entry.new_stage);
        const stageSpan = entry.new_stage
          ? `<span class="audit-stage" style="${si ? `color:${si.color}` : ''}">${esc(entry.new_stage)}</span>` : '';
        return `
          <div class="audit-entry">
            <div class="audit-meta">
              <strong>${esc(entry.username || 'Unknown')}</strong>
              <span class="audit-action">${esc(actionLabel)}</span>
              ${stageSpan}
            </div>
            <div class="audit-date">${date}</div>
            ${entry.notes ? `<div class="audit-note-text">${esc(entry.notes)}</div>` : ''}
          </div>
        `;
      }).join('');
    }
  } catch (e) {
    auditEl.innerHTML = '<div class="audit-empty">Could not load history.</div>';
  }
}

function closeDetailModal() {
  document.getElementById('detail-modal').classList.add('hidden');
  STATE.currentProject = null;
}

async function saveDetailModal() {
  const p = STATE.currentProject;
  if (!p) return;
  const stage = document.getElementById('modal-stage').value;
  const owner = document.getElementById('modal-owner').value.trim();
  const notes = document.getElementById('modal-notes').value.trim();
  logger.info('saveDetailModal', { projectId: p.id, name: p.name, stage, owner });

  await api('POST', '/api/assignments', {
    projectId: p.id, projectName: p.name, stage, owner, notes, teamId: STATE.currentTeamId,
  });

  if (stage) {
    STATE.assignMap[p.id] = { ...(STATE.assignMap[p.id] || {}), project_id: p.id, stage, owner, notes };
  } else {
    delete STATE.assignMap[p.id];
  }

  closeDetailModal();
  render();
  updateStats();
}

async function removeAssignment() {
  const p = STATE.currentProject;
  if (!p) return;
  await api('POST', '/api/assignments', { projectId: p.id, projectName: p.name, stage: '', teamId: STATE.currentTeamId });
  delete STATE.assignMap[p.id];
  closeDetailModal();
  render();
  updateStats();
}

function applyStageSelectStyle(el, stage) {
  const si = STAGES.find(s => s.value === stage);
  if (si) {
    el.style.color = si.color;
    el.style.borderColor = si.border;
    el.style.background = si.bg;
    el.style.fontWeight = '700';
  } else {
    el.style.color = '';
    el.style.borderColor = '';
    el.style.background = '';
    el.style.fontWeight = '';
  }
}

// --- Admin Modal ---
async function openAdminModal() {
  document.getElementById('admin-modal').classList.remove('hidden');
  await Promise.all([refreshAdminTeams(), refreshAdminUsers()]);
}

function closeAdminModal() {
  document.getElementById('admin-modal').classList.add('hidden');
}

async function refreshAdminTeams() {
  STATE.teams = await api('GET', '/api/teams');
  document.querySelector('#teams-table tbody').innerHTML = STATE.teams.map(t => `
    <tr>
      <td><strong>${esc(t.name)}</strong></td>
      <td class="muted">${new Date(t.created_at * 1000).toLocaleDateString()}</td>
      <td><button class="btn-icon btn-danger-icon" onclick="deleteTeam(${t.id})">Delete</button></td>
    </tr>
  `).join('') || '<tr><td colspan="3" class="muted" style="text-align:center;padding:1rem">No teams yet</td></tr>';

  const sel = document.getElementById('new-user-team');
  sel.innerHTML = '<option value="">No team</option>' +
    STATE.teams.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');

  populateTeamSelector();
}

async function addTeam() {
  const name = document.getElementById('new-team-name').value.trim();
  if (!name) return;
  try {
    await api('POST', '/api/teams', { name });
    document.getElementById('new-team-name').value = '';
    await refreshAdminTeams();
  } catch (e) { alert(e.message); }
}

async function deleteTeam(id) {
  if (!confirm('Delete this team? All assignments for this team will be permanently removed.')) return;
  await api('DELETE', `/api/teams/${id}`);
  await refreshAdminTeams();
}

async function refreshAdminUsers() {
  const users = await api('GET', '/api/users');
  document.querySelector('#users-table tbody').innerHTML = users.map(u => `
    <tr>
      <td><strong>${esc(u.username)}</strong></td>
      <td><span class="role-badge role-${u.role}">${esc(u.role)}</span></td>
      <td class="muted">${esc(u.team_name || '—')}</td>
      <td class="muted">${new Date(u.created_at * 1000).toLocaleDateString()}</td>
      <td>${u.id !== STATE.user.id ? `<button class="btn-icon btn-danger-icon" onclick="deleteUser(${u.id})">Delete</button>` : ''}</td>
    </tr>
  `).join('');
}

async function addUser() {
  const username = document.getElementById('new-user-username').value.trim();
  const password = document.getElementById('new-user-password').value;
  const teamId = document.getElementById('new-user-team').value || null;
  const role = document.getElementById('new-user-role').value;
  if (!username || !password) return alert('Username and password are required');
  try {
    await api('POST', '/api/users', { username, password, role, teamId: teamId ? parseInt(teamId) : null });
    document.getElementById('new-user-username').value = '';
    document.getElementById('new-user-password').value = '';
    await refreshAdminUsers();
  } catch (e) { alert(e.message); }
}

async function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  await api('DELETE', `/api/users/${id}`);
  await refreshAdminUsers();
}

// --- Change Password ---
function openPasswordModal() {
  ['pw-current', 'pw-new', 'pw-confirm'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pw-error').classList.add('hidden');
  closeUserDropdown();
  document.getElementById('password-modal').classList.remove('hidden');
}

function closePasswordModal() {
  document.getElementById('password-modal').classList.add('hidden');
}

async function savePassword() {
  const current = document.getElementById('pw-current').value;
  const newPw   = document.getElementById('pw-new').value;
  const confirm = document.getElementById('pw-confirm').value;
  const errEl   = document.getElementById('pw-error');
  errEl.classList.add('hidden');

  if (newPw !== confirm) {
    errEl.textContent = 'New passwords do not match';
    errEl.classList.remove('hidden');
    return;
  }
  try {
    await api('POST', '/api/auth/change-password', { currentPassword: current, newPassword: newPw });
    closePasswordModal();
    alert('Password updated successfully');
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
  }
}

// --- Admin tabs ---
function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('tab-teams').classList.toggle('hidden', tab !== 'teams');
  document.getElementById('tab-users').classList.toggle('hidden', tab !== 'users');
}

// --- User dropdown ---
function toggleUserDropdown() {
  document.getElementById('user-dropdown').classList.toggle('hidden');
}
function closeUserDropdown() {
  document.getElementById('user-dropdown').classList.add('hidden');
}

// --- Login ---
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  logger.info('handleLogin: attempting login', { username });
  try {
    STATE.user = await api('POST', '/api/auth/login', { username, password });
    logger.info('handleLogin: login successful', { username, role: STATE.user.role });
    await startApp();
  } catch (err) {
    logger.warn('handleLogin: login failed', { username, error: err.message });
    errEl.textContent = err.message || 'Login failed';
    errEl.classList.remove('hidden');
  }
}

// --- Logout ---
async function logout() {
  await api('POST', '/api/auth/logout');
  STATE.user = null; STATE.projects = []; STATE.assignMap = {};
  showLogin();
}

// --- Export ---
function exportCSV() {
  window.location.href = `/api/export/csv?team_id=${STATE.currentTeamId}`;
}
function exportPDF() {
  window.print();
}

// --- Escape ---
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Event bindings ---
document.getElementById('login-form').addEventListener('submit', handleLogin);
document.getElementById('search').addEventListener('input', render);
document.getElementById('filter-category').addEventListener('change', render);
document.getElementById('filter-stage').addEventListener('change', render);
document.getElementById('filter-cncf').addEventListener('change', render);
document.getElementById('team-selector').addEventListener('change', onTeamChange);
document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
document.getElementById('btn-export-pdf').addEventListener('click', exportPDF);

document.getElementById('user-btn').addEventListener('click', e => { e.stopPropagation(); toggleUserDropdown(); });
document.addEventListener('click', closeUserDropdown);
document.getElementById('user-dropdown').addEventListener('click', e => e.stopPropagation());
document.getElementById('btn-change-password').addEventListener('click', openPasswordModal);
document.getElementById('btn-admin-panel').addEventListener('click', () => { closeUserDropdown(); openAdminModal(); });
document.getElementById('btn-logout').addEventListener('click', () => { closeUserDropdown(); logout(); });

document.getElementById('modal-close').addEventListener('click', closeDetailModal);
document.getElementById('modal-cancel').addEventListener('click', closeDetailModal);
document.getElementById('modal-save').addEventListener('click', saveDetailModal);
document.getElementById('modal-remove').addEventListener('click', removeAssignment);
document.getElementById('detail-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeDetailModal(); });
document.getElementById('modal-stage').addEventListener('change', function () { applyStageSelectStyle(this, this.value); });

document.getElementById('admin-close').addEventListener('click', closeAdminModal);
document.getElementById('admin-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAdminModal(); });
document.getElementById('btn-add-team').addEventListener('click', addTeam);
document.getElementById('btn-add-user').addEventListener('click', addUser);
document.getElementById('new-team-name').addEventListener('keydown', e => { if (e.key === 'Enter') addTeam(); });
document.querySelectorAll('.admin-tab').forEach(t => t.addEventListener('click', () => switchAdminTab(t.dataset.tab)));

document.getElementById('password-close').addEventListener('click', closePasswordModal);
document.getElementById('pw-cancel').addEventListener('click', closePasswordModal);
document.getElementById('pw-save').addEventListener('click', savePassword);
document.getElementById('password-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closePasswordModal(); });

init();
