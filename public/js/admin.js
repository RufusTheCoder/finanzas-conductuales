import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

const app = document.getElementById('admin-app');
const statusEl = document.getElementById('admin-status');

// Auth gate
const loginScreen = document.getElementById('screen-login');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

function showAdmin() {
  loginScreen.hidden = true;
  app.hidden = false;
  loadQuestions();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.style.display = 'none';
  const data = new FormData(e.target);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.get('email'), password: data.get('password') }),
    });
    if (!res.ok) throw new Error('Credenciales inválidas');
    showAdmin();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.style.display = 'block';
  }
});

document.getElementById('dev-skip').addEventListener('click', showAdmin);

// Tab management
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tabName = button.dataset.tab;

    // Update active tab button
    tabButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    // Update active tab content
    tabPanes.forEach(pane => pane.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Load tab content
    switch(tabName) {
      case 'questions':
        loadQuestions();
        break;
      case 'users':
        loadUsers();
        break;
      case 'progress':
        loadProgress();
        break;
      case 'reports':
        loadReports();
        break;
    }
  });
});

// Questions tab
const refreshQuestionsBtn = document.getElementById('refresh-questions');
const questionsContainer = document.getElementById('questions-table');

refreshQuestionsBtn.addEventListener('click', loadQuestions);

async function loadQuestions() {
  setStatus('Cargando preguntas...', false);
  questionsContainer.innerHTML = '';

  try {
    const url = `${SUPABASE_URL}/rest/v1/questions?select=*,question_metrics(views,answers,avg_time_seconds,confusion_rate,feedback)&order=id.asc`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const questions = await response.json();
    renderQuestions(questions);
    setStatus(`Cargadas ${questions.length} preguntas.`, false);
  } catch (error) {
    setStatus(`Error al cargar preguntas: ${error.message}`, true);
  }
}

function renderQuestions(questions) {
  if (!questions.length) {
    questionsContainer.innerHTML = '<p>No hay preguntas disponibles.</p>';
    return;
  }

  questionsContainer.innerHTML = questions
    .map((question) => {
      const metrics = question.question_metrics?.[0] || {};
      return `
        <div class="card admin-card">
          <div class="admin-row">
            <div><strong>ID</strong> ${question.id}</div>
            <div><strong>Phase</strong> ${question.phase}</div>
            <div><strong>Module</strong> ${question.module}</div>
            <div><strong>Sesgo</strong> ${question.sesgo_key || '-'}</div>
          </div>
          <p class="question-prompt">${question.prompt}</p>
          <p><strong>Diagnostic:</strong> ${question.diagnostic ? 'Yes' : 'No'}</p>
          <div class="admin-grid">
            <label>
              Quality score
              <input type="number" min="0" max="100" value="${question.quality_score}" data-field="quality_score" data-id="${question.id}" />
            </label>
            <label>
              Importance
              <select data-field="importance" data-id="${question.id}">
                <option value="high" ${question.importance === 'high' ? 'selected' : ''}>high</option>
                <option value="normal" ${question.importance === 'normal' ? 'selected' : ''}>normal</option>
                <option value="low" ${question.importance === 'low' ? 'selected' : ''}>low</option>
              </select>
            </label>
            <button class="btn-primary btn-small" data-action="save" data-id="${question.id}">Salvar</button>
          </div>
          <div class="admin-metrics">
            <div><strong>Views:</strong> ${metrics.views || 0}</div>
            <div><strong>Avg time:</strong> ${metrics.avg_time_seconds ?? '-'}s</div>
            <div><strong>Confusion:</strong> ${metrics.confusion_rate ?? '-'} </div>
            <div><strong>Answers:</strong> ${JSON.stringify(metrics.answers || {})}</div>
            <div><strong>Feedback:</strong> ${JSON.stringify(metrics.feedback || {})}</div>
          </div>
        </div>
      `;
    })
    .join('');

  questionsContainer.querySelectorAll('[data-action="save"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const questionId = button.dataset.id;
      const qualityInput = questionsContainer.querySelector(`input[data-id="${questionId}"]`);
      const importanceSelect = questionsContainer.querySelector(`select[data-id="${questionId}"]`);

      if (!qualityInput || !importanceSelect) {
        setStatus('No se encontraron los campos para guardar.', true);
        return;
      }

      const payload = {
        quality_score: Number(qualityInput.value),
        importance: importanceSelect.value,
      };

      await updateQuestion(questionId, payload);
    });
  });
}

async function updateQuestion(id, payload) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/questions?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body}`);
    }
    setStatus(`Pregunta ${id} actualizada.`);
    await loadQuestions();
  } catch (error) {
    setStatus(`Error al actualizar pregunta ${id}: ${error.message}`, true);
  }
}

// Users tab
const refreshUsersBtn = document.getElementById('refresh-users');
const usersContainer = document.getElementById('users-table');

refreshUsersBtn.addEventListener('click', loadUsers);

async function loadUsers() {
  setStatus('Cargando usuarios...', false);
  usersContainer.innerHTML = '';

  try {
    const url = `${SUPABASE_URL}/rest/v1/users?select=*&order=created_at.desc`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const users = await response.json();
    renderUsers(users);
    setStatus(`Cargados ${users.length} usuarios.`, false);
  } catch (error) {
    setStatus(`Error al cargar usuarios: ${error.message}`, true);
  }
}

function renderUsers(users) {
  if (!users.length) {
    usersContainer.innerHTML = '<p>No hay usuarios registrados.</p>';
    return;
  }

  usersContainer.innerHTML = `
    <div class="admin-summary">
      <div class="summary-item">
        <strong>Total usuarios:</strong> ${users.length}
      </div>
      <div class="summary-item">
        <strong>Ultima semana:</strong> ${users.filter(u => new Date(u.created_at) > new Date(Date.now() - 7*24*60*60*1000)).length}
      </div>
    </div>
    <div class="users-list">
      ${users.map(user => `
        <div class="card admin-card">
          <div class="admin-row">
            <div><strong>Email</strong> ${user.email}</div>
            <div><strong>Nombre</strong> ${user.name || '-'}</div>
            <div><strong>Creado</strong> ${new Date(user.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Progress tab
const refreshProgressBtn = document.getElementById('refresh-progress');
const progressContainer = document.getElementById('progress-table');

refreshProgressBtn.addEventListener('click', loadProgress);

async function loadProgress() {
  setStatus('Cargando progreso...', false);
  progressContainer.innerHTML = '';

  try {
    const url = `${SUPABASE_URL}/rest/v1/progress?select=*,users(email)&order=updated_at.desc`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const progress = await response.json();
    renderProgress(progress);
    setStatus(`Cargado progreso de ${progress.length} usuarios.`, false);
  } catch (error) {
    setStatus(`Error al cargar progreso: ${error.message}`, true);
  }
}

function renderProgress(progressData) {
  if (!progressData.length) {
    progressContainer.innerHTML = '<p>No hay progreso registrado.</p>';
    return;
  }

  // Calculate summary stats
  const completedBIT = progressData.filter(p => p.bit_result).length;
  const totalUsers = progressData.length;
  const completionRate = totalUsers > 0 ? ((completedBIT / totalUsers) * 100).toFixed(1) : 0;

  // BIT profile distribution
  const profiles = {};
  progressData.forEach(p => {
    if (p.bit_result) {
      profiles[p.bit_result] = (profiles[p.bit_result] || 0) + 1;
    }
  });

  progressContainer.innerHTML = `
    <div class="admin-summary">
      <div class="summary-item">
        <strong>Usuarios con progreso:</strong> ${totalUsers}
      </div>
      <div class="summary-item">
        <strong>BIT completado:</strong> ${completedBIT} (${completionRate}%)
      </div>
      <div class="summary-item">
        <strong>Perfiles BIT:</strong> ${Object.entries(profiles).map(([k,v]) => `${k}: ${v}`).join(', ')}
      </div>
    </div>
    <div class="progress-list">
      ${progressData.map(p => `
        <div class="card admin-card">
          <div class="admin-row">
            <div><strong>Usuario</strong> ${p.users?.email || p.user_id}</div>
            <div><strong>BIT Resultado</strong> ${p.bit_result || 'No completado'}</div>
            <div><strong>Preguntas BIT</strong> ${p.bit_done?.length || 0}</div>
            <div><strong>Actualizado</strong> ${new Date(p.updated_at).toLocaleDateString()}</div>
          </div>
          ${p.bit_answers ? `
            <div class="admin-metrics">
              <div><strong>Respuestas BIT:</strong> ${Object.keys(p.bit_answers).length} preguntas</div>
              <div><strong>Sesgos identificados:</strong> ${p.sesgos ? Object.keys(p.sesgos).length : 0}</div>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

// Reports tab
const refreshReportsBtn = document.getElementById('refresh-reports');
const reportsContainer = document.getElementById('reports-content');

refreshReportsBtn.addEventListener('click', loadReports);

async function loadReports() {
  setStatus('Generando reportes...', false);
  reportsContainer.innerHTML = '';

  try {
    // Load all data for comprehensive reports
    const [usersRes, progressRes, questionsRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/users`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/progress?select=*,users(email)`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/questions`, { headers })
    ]);

    if (!usersRes.ok || !progressRes.ok || !questionsRes.ok) {
      throw new Error('Error al cargar datos para reportes');
    }

    const users = await usersRes.json();
    const progress = await progressRes.json();
    const questions = await questionsRes.json();

    renderReports(users, progress, questions);
    setStatus('Reportes generados.', false);
  } catch (error) {
    setStatus(`Error al generar reportes: ${error.message}`, true);
  }
}

function renderReports(users, progress, questions) {
  const totalUsers = users.length;
  const activeUsers = progress.length;
  const completedBIT = progress.filter(p => p.bit_result).length;
  const completionRate = activeUsers > 0 ? ((completedBIT / activeUsers) * 100).toFixed(1) : 0;

  // BIT profiles distribution
  const profiles = {};
  progress.forEach(p => {
    if (p.bit_result) {
      profiles[p.bit_result] = (profiles[p.bit_result] || 0) + 1;
    }
  });

  // Questions by phase
  const questionsByPhase = {};
  questions.forEach(q => {
    questionsByPhase[q.phase] = (questionsByPhase[q.phase] || 0) + 1;
  });

  reportsContainer.innerHTML = `
    <div class="reports-grid">
      <div class="card admin-card">
        <h3>📊 Métricas Generales</h3>
        <div class="admin-metrics">
          <div><strong>Usuarios registrados:</strong> ${totalUsers}</div>
          <div><strong>Usuarios activos:</strong> ${activeUsers}</div>
          <div><strong>BIT completado:</strong> ${completedBIT}</div>
          <div><strong>Tasa de completación:</strong> ${completionRate}%</div>
        </div>
      </div>

      <div class="card admin-card">
        <h3>🎯 Distribución de Perfiles BIT</h3>
        <div class="admin-metrics">
          ${Object.entries(profiles).map(([profile, count]) => `
            <div><strong>${profile}:</strong> ${count} (${((count/completedBIT)*100).toFixed(1)}%)</div>
          `).join('')}
        </div>
      </div>

      <div class="card admin-card">
        <h3>❓ Preguntas por Fase</h3>
        <div class="admin-metrics">
          ${Object.entries(questionsByPhase).map(([phase, count]) => `
            <div><strong>${phase}:</strong> ${count} preguntas</div>
          `).join('')}
        </div>
      </div>

      <div class="card admin-card">
        <h3>📈 Actividad Reciente</h3>
        <div class="admin-metrics">
          <div><strong>Ultima semana:</strong> ${users.filter(u => new Date(u.created_at) > new Date(Date.now() - 7*24*60*60*1000)).length} nuevos usuarios</div>
          <div><strong>Progreso actualizado:</strong> ${progress.filter(p => new Date(p.updated_at) > new Date(Date.now() - 24*60*60*1000)).length} en las últimas 24h</div>
        </div>
      </div>
    </div>
  `;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.hidden = false;
  statusEl.style.color = isError ? '#9B1830' : '#111';
}

