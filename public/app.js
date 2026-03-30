const state = { items: [], selectedId: null };

const sessionList = document.querySelector('#sessionList');
const detail = document.querySelector('#detail');
const stats = document.querySelector('#stats');
const searchInput = document.querySelector('#search');
const detailHint = document.querySelector('#detailHint');

async function boot() {
  await Promise.all([loadMeta(), loadSessions()]);
  setInterval(loadSessions, 2500);
}

async function loadMeta() {
  const response = await fetch('/api/meta');
  const data = await response.json();
  stats.innerHTML = '';
  const values = [
    ['sessions', data.stats.total],
    ['failures', data.stats.failures],
    ['hosts', data.stats.uniqueHosts],
    ['proxy', `:${data.proxyPort}`],
  ];
  for (const [label, value] of values) {
    const pill = document.createElement('div');
    pill.className = 'stat-pill';
    pill.textContent = `${label}: ${value}`;
    stats.appendChild(pill);
  }
}

async function loadSessions() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
  const response = await fetch(`/api/sessions?${params.toString()}`);
  const data = await response.json();
  state.items = data.items;
  renderSessions();
  if (state.selectedId) {
    await loadDetail(state.selectedId);
  }
}

function renderSessions() {
  sessionList.innerHTML = '';
  for (const item of state.items) {
    const button = document.createElement('button');
    button.className = 'session-item';
    if ((item.statusCode ?? 0) >= 400) button.dataset.status = 'error';
    button.innerHTML = `
      <span class="session-top">[${item.statusCode ?? '...'}] ${item.method} ${item.host}</span>
      <span class="session-bottom">${item.path} · ${item.durationMs ?? 0}ms · ${item.notes.join(', ') || 'plain flow'}</span>
    `;
    button.onclick = () => {
      state.selectedId = item.id;
      loadDetail(item.id);
    };
    sessionList.appendChild(button);
  }
}

async function loadDetail(id) {
  const response = await fetch(`/api/sessions/${id}`);
  if (!response.ok) return;
  const data = await response.json();
  detailHint.textContent = data.session.url;
  detail.textContent = JSON.stringify(data, null, 2);
}

document.querySelector('#reloadRules').onclick = async () => {
  await fetch('/api/rules/reload', { method: 'POST' });
  await loadMeta();
};

document.querySelector('#exportPrompt').onclick = async () => {
  const response = await fetch('/api/export', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ format: 'markdown', ids: state.selectedId ? [state.selectedId] : undefined, search: searchInput.value.trim() || undefined }),
  });
  const data = await response.json();
  detailHint.textContent = 'Prompt pack';
  detail.textContent = typeof data.output === 'string' ? data.output : JSON.stringify(data.output, null, 2);
};

searchInput.addEventListener('input', () => {
  loadSessions();
});

boot();
