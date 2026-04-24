/*! AgentFlow — Copyright (c) 2026 Visigence. Proprietary. */
'use strict';

// ── Modal ────────────────────────────────────────────────
let _modalEl = null;

function showModal(html) {
  closeModal();
  _modalEl = document.createElement('div');
  _modalEl.className = 'modal-backdrop';
  _modalEl.dataset.action = 'modalBackdrop';
  _modalEl.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(_modalEl);
  setTimeout(() => _modalEl?.querySelector('input,textarea,select,button')?.focus(), 30);
}
function closeModal() { if (_modalEl) { _modalEl.remove(); _modalEl = null; } }
function modalOpen() { return !!_modalEl; }

// ── Navigation ───────────────────────────────────────────
function selectRun(id)  { setState({ activeRunId: id, selectedNodeId: null, activeCounterfactual: null, activeTab: 'graph' }); }
function selectNode(id) { setState({ selectedNodeId: state.selectedNodeId === id ? null : id }); }
function setTab(tab)    { setState({ activeTab: tab }); }
function setCf(id)      { setState({ activeCounterfactual: id || null, selectedNodeId: null }); }
function toggleCf(id)   { setState({ activeCounterfactual: state.activeCounterfactual === id ? null : id, activeTab: 'graph' }); }

// ── Destructive ──────────────────────────────────────────
function deleteActiveRun() {
  if (!state.activeRunId) return;
  if (!confirm('Delete this run? This cannot be undone.')) return;
  const runs = state.runs.filter(r => r.id !== state.activeRunId);
  setState({
    runs,
    activeRunId: runs[0]?.id || null,
    selectedNodeId: null,
    activeCounterfactual: null,
  });
}

function deleteNode(id) {
  const runs = state.runs.map(r => {
    if (r.id !== state.activeRunId) return r;
    return Object.assign({}, r, {
      nodes: r.nodes.filter(n => n.id !== id),
      edges: r.edges.filter(e => e.from !== id && e.to !== id),
    });
  });
  const positions = Object.assign({}, state.nodePositions || {});
  if (positions[state.activeRunId]) {
    const copy = Object.assign({}, positions[state.activeRunId]);
    delete copy[id];
    positions[state.activeRunId] = copy;
  }
  setState({ runs, selectedNodeId: null, nodePositions: positions });
}

// ── Export / Import ──────────────────────────────────────
function handleExport() {
  const run = state.runs.find(r => r.id === state.activeRunId);
  if (!run) return;
  const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  a.download = run.id.replace(/[^A-Za-z0-9_-]/g, '_') + '.agentflow.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function openImportDialog() {
  showModal(`
    <h2>${ICONS.import} Import Run</h2>
    <p style="font-size:12px;color:var(--text-2);margin-bottom:12px;">
      Accepts <strong>.agentflow.json</strong> or raw trace exports from
      <strong>LangSmith</strong>, <strong>LangFuse</strong>, or <strong>W&amp;B Weave</strong>.
      Max 2&nbsp;MB.
    </p>
    <input type="file" id="import-file" accept="application/json,.json" data-role="import-file"/>
    <div id="import-format-badge" style="font-size:11px;color:var(--accent-2);margin-top:8px;min-height:16px;"></div>
    <div id="import-error" class="error-msg"></div>
    <div class="modal-actions">
      <button class="btn" data-action="closeModal">Cancel</button>
      <button class="btn primary" data-action="doImport">Import</button>
    </div>
  `);
}

function _onImportFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    document.getElementById('import-error').textContent = 'File too large (max 2 MB).';
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const obj = JSON.parse(ev.target.result);
      const fmt = detectFormat(obj);
      const badge = document.getElementById('import-format-badge');
      if (!badge) return;
      const labels = { langsmith: 'LangSmith trace', langfuse: 'LangFuse trace', weave: 'W&B Weave call' };
      badge.textContent = fmt ? ('Detected: ' + labels[fmt]) : 'Detected: AgentFlow native (or unknown)';
    } catch { /* ignore */ }
  };
  reader.readAsText(file);
}

function doImport() {
  const file = document.getElementById('import-file')?.files?.[0];
  const errEl = document.getElementById('import-error');
  if (!file) { errEl.textContent = 'Please select a file.'; return; }
  if (!/\.json$/i.test(file.name)) { errEl.textContent = 'Must be a .json file.'; return; }
  if (file.size > 2 * 1024 * 1024) { errEl.textContent = 'File too large (max 2 MB).'; return; }

  const reader = new FileReader();
  reader.onerror = () => { errEl.textContent = 'Could not read file.'; };
  reader.onload = e => {
    let parsed;
    try { parsed = JSON.parse(e.target.result); }
    catch { errEl.textContent = 'Invalid JSON.'; return; }

    const nativeErr = validateRunSchema(parsed);
    if (!nativeErr) return _finishImport(parsed);

    const { run, error } = importFromThirdParty(parsed);
    if (error) { errEl.textContent = `Not native (${nativeErr}). Adapter: ${error}`; return; }

    const adapterErr = validateRunSchema(run);
    if (adapterErr) { errEl.textContent = 'Adapter output invalid: ' + adapterErr; return; }
    _finishImport(run);
  };
  reader.readAsText(file);
}

function _finishImport(run) {
  if (state.runs.find(r => r.id === run.id)) {
    run = Object.assign({}, run, { id: 'run-' + Date.now() });
  }
  closeModal();
  setState({
    runs: [...state.runs, run],
    activeRunId: run.id,
    selectedNodeId: null,
    activeCounterfactual: null,
  });
}

// ── Dialogs ──────────────────────────────────────────────
function openNewRunDialog() {
  showModal(`
    <h2>${ICONS.plus} New Run</h2>
    <label for="nr-name">Run name</label>
    <input id="nr-name" maxlength="200" autocomplete="off" placeholder="e.g. Customer-support QA"/>
    <label for="nr-answer">Final answer (optional)</label>
    <textarea id="nr-answer" maxlength="10000" placeholder="Final response text…"></textarea>
    <div id="nr-error" class="error-msg"></div>
    <div class="modal-actions">
      <button class="btn" data-action="closeModal">Cancel</button>
      <button class="btn primary" data-action="createNewRun">Create</button>
    </div>
  `);
}

function createNewRun() {
  const name = clampStr(document.getElementById('nr-name')?.value.trim(), 200);
  const answer = clampStr(document.getElementById('nr-answer')?.value, 10000);
  const err = document.getElementById('nr-error');
  if (!name) { err.textContent = 'Name is required.'; return; }
  const run = {
    id: 'run-' + Date.now(),
    name,
    createdAt: new Date().toISOString(),
    nodes: [], edges: [],
    metrics: { totalMs: 0, tokens: 0, nodes: 0, successful: 0, failed: 0 },
    finalAnswer: answer,
    counterfactuals: [],
  };
  closeModal();
  setState({ runs: [...state.runs, run], activeRunId: run.id, selectedNodeId: null, activeCounterfactual: null });
}

function openAddNodeDialog() {
  if (!state.activeRunId) return;
  const roles = ROLE_KEYS.map(k => `<option value="${esc(k)}">${esc(ROLES[k].label)}</option>`).join('');
  const statuses = STATUS_KEYS.map(k => `<option value="${esc(k)}">${esc(STATUSES[k].label)}</option>`).join('');
  showModal(`
    <h2>${ICONS.node} Add Node</h2>
    <label for="an-name">Name</label>
    <input id="an-name" maxlength="200" autocomplete="off"/>
    <label for="an-role">Role</label>
    <select id="an-role">${roles}</select>
    <label for="an-status">Status</label>
    <select id="an-status">${statuses}</select>
    <label for="an-content">Content</label>
    <textarea id="an-content" maxlength="10000"></textarea>
    <div id="an-error" class="error-msg"></div>
    <div class="modal-actions">
      <button class="btn" data-action="closeModal">Cancel</button>
      <button class="btn primary" data-action="addNode">Add</button>
    </div>
  `);
}

function addNode() {
  const name = clampStr(document.getElementById('an-name')?.value.trim(), 200);
  const role = document.getElementById('an-role')?.value;
  const status = document.getElementById('an-status')?.value;
  const content = clampStr(document.getElementById('an-content')?.value, 10000);
  const errEl = document.getElementById('an-error');
  if (!name) { errEl.textContent = 'Name is required.'; return; }
  if (!ROLE_KEYS.includes(role)) { errEl.textContent = 'Invalid role.'; return; }
  if (!STATUS_KEYS.includes(status)) { errEl.textContent = 'Invalid status.'; return; }

  const node = { id: 'n' + Date.now(), name, role, status, content };
  const runs = state.runs.map(r => r.id === state.activeRunId
    ? Object.assign({}, r, { nodes: [...r.nodes, node] })
    : r);
  closeModal();
  setState({ runs, selectedNodeId: node.id });
}

function openEditNodeDialog(nodeId) {
  const run = state.runs.find(r => r.id === state.activeRunId);
  const node = run?.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const roles = ROLE_KEYS.map(k => `<option value="${esc(k)}" ${k === node.role ? 'selected' : ''}>${esc(ROLES[k].label)}</option>`).join('');
  const statuses = STATUS_KEYS.map(k => `<option value="${esc(k)}" ${k === node.status ? 'selected' : ''}>${esc(STATUSES[k].label)}</option>`).join('');
  showModal(`
    <h2>Edit Node</h2>
    <input type="hidden" id="en-id" value="${esc(node.id)}"/>
    <label for="en-name">Name</label>
    <input id="en-name" maxlength="200" autocomplete="off" value="${esc(node.name)}"/>
    <label for="en-role">Role</label>
    <select id="en-role">${roles}</select>
    <label for="en-status">Status</label>
    <select id="en-status">${statuses}</select>
    <label for="en-content">Content</label>
    <textarea id="en-content" maxlength="10000">${esc(node.content)}</textarea>
    <div id="en-error" class="error-msg"></div>
    <div class="modal-actions">
      <button class="btn" data-action="closeModal">Cancel</button>
      <button class="btn primary" data-action="saveEditNode">Save</button>
    </div>
  `);
}

function saveEditNode() {
  const id = document.getElementById('en-id')?.value;
  const name = clampStr(document.getElementById('en-name')?.value.trim(), 200);
  const role = document.getElementById('en-role')?.value;
  const status = document.getElementById('en-status')?.value;
  const content = clampStr(document.getElementById('en-content')?.value, 10000);
  const errEl = document.getElementById('en-error');
  if (!name) { errEl.textContent = 'Name is required.'; return; }
  if (!ROLE_KEYS.includes(role)) { errEl.textContent = 'Invalid role.'; return; }
  if (!STATUS_KEYS.includes(status)) { errEl.textContent = 'Invalid status.'; return; }

  const runs = state.runs.map(r => r.id !== state.activeRunId ? r : Object.assign({}, r, {
    nodes: r.nodes.map(n => n.id === id ? Object.assign({}, n, { name, role, status, content }) : n)
  }));
  closeModal();
  setState({ runs });
}

function openAddCfDialog() {
  const run = state.runs.find(r => r.id === state.activeRunId);
  if (!run || run.nodes.length === 0) { alert('Add at least one node first.'); return; }
  const nodeOpts = run.nodes.map(n => `<option value="${esc(n.id)}">${esc(n.name)}</option>`).join('');
  showModal(`
    <h2>${ICONS.cf} New Counterfactual</h2>
    <label for="cf-name">Scenario name</label>
    <input id="cf-name" maxlength="200" autocomplete="off" placeholder="e.g. What if retrieval failed"/>
    <label for="cf-desc">Description</label>
    <textarea id="cf-desc" maxlength="1000" placeholder="What's the hypothesis?"></textarea>
    <label for="cf-node">Override which node</label>
    <select id="cf-node">${nodeOpts}</select>
    <label for="cf-status">New status</label>
    <select id="cf-status">
      <option value="failed">Failed</option>
      <option value="skipped">Skipped</option>
      <option value="success">Success</option>
    </select>
    <label for="cf-content">New content</label>
    <textarea id="cf-content" maxlength="10000" placeholder="What would this node have produced?"></textarea>
    <div id="cf-error" class="error-msg"></div>
    <div class="modal-actions">
      <button class="btn" data-action="closeModal">Cancel</button>
      <button class="btn primary" data-action="createCf">Create</button>
    </div>
  `);
}

function createCf() {
  const run = state.runs.find(r => r.id === state.activeRunId);
  if (!run) return;
  const name = clampStr(document.getElementById('cf-name')?.value.trim(), 200);
  const description = clampStr(document.getElementById('cf-desc')?.value, 1000);
  const nodeId = document.getElementById('cf-node')?.value;
  const status = document.getElementById('cf-status')?.value;
  const content = clampStr(document.getElementById('cf-content')?.value, 10000);
  const errEl = document.getElementById('cf-error');
  if (!name) { errEl.textContent = 'Name is required.'; return; }
  if (!run.nodes.find(n => n.id === nodeId)) { errEl.textContent = 'Invalid node.'; return; }
  if (!STATUS_KEYS.includes(status)) { errEl.textContent = 'Invalid status.'; return; }

  const cf = {
    id: 'cf-' + Date.now(),
    name, description,
    nodeOverrides: { [nodeId]: { status, content } },
    metrics: Object.assign({}, run.metrics),
    finalAnswer: run.finalAnswer,
  };
  const runs = state.runs.map(r => r.id !== run.id ? r : Object.assign({}, r, {
    counterfactuals: [...(r.counterfactuals || []), cf]
  }));
  closeModal();
  setState({ runs, activeCounterfactual: cf.id });
}

// ── Action dispatch ──────────────────────────────────────
const ACTIONS = {
  closeModal, doImport, handleExport, openImportDialog, openNewRunDialog,
  createNewRun, openAddNodeDialog, addNode, openEditNodeDialog, saveEditNode,
  openAddCfDialog, createCf, deleteActiveRun, deleteNode, resetLayout,
  selectRun, selectNode, setTab, setCf, toggleCf,
  modalBackdrop(_id, _el, e) { if (e.target === _el) closeModal(); },
};

function _dispatch(action, id, el, e) {
  const fn = ACTIONS[action];
  if (typeof fn !== 'function') return;
  try { fn(id, el, e); }
  catch (err) { ErrorBoundary.show(err, 'action:' + action); }
}

function _delegatedClick(e) {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  _dispatch(t.dataset.action, t.dataset.id, t, e);
}

function _delegatedChange(e) {
  const t = e.target.closest('[data-change]');
  if (t) { _dispatch(t.dataset.change, t.value, t, e); return; }
  if (e.target.dataset.role === 'import-file') _onImportFileChange(e);
}

function _delegatedMouseDown(e) {
  const t = e.target.closest('[data-drag-handle]');
  if (!t) return;
  initDrag(e, t.dataset.dragId);
}

function _onKey(e) {
  if (e.key === 'Escape') { closeModal(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedNodeId && !modalOpen()) {
    const tag = document.activeElement?.tagName;
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) deleteNode(state.selectedNodeId);
  }
}

function installDelegation() {
  const app = document.getElementById('app');
  if (!app) return;
  app.addEventListener('click', _delegatedClick);
  app.addEventListener('change', _delegatedChange);
  app.addEventListener('mousedown', _delegatedMouseDown);
  document.addEventListener('click', _delegatedClick);
  document.addEventListener('change', _delegatedChange);
  document.addEventListener('keydown', _onKey);
}

function attachEvents() { /* kept for compat, render calls it */ }
