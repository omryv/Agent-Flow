'use strict';

// ── Modal system ──────────────────────────────────────────────
let _modalEl = null;
function showModal(html) { /* paste verbatim */ }
function closeModal()    { /* paste verbatim */ }
function modalOpen()     { return !!_modalEl; }

// ── Navigation ───────────────────────────────────────────────
function selectRun(id)  { setState({ activeRunId: id, selectedNodeId: null, activeCounterfactual: null, activeTab: 'graph' }); }
function selectNode(id) { setState({ selectedNodeId: state.selectedNodeId === id ? null : id }); }
function setTab(tab)    { setState({ activeTab: tab }); }
function setCf(id)      { setState({ activeCounterfactual: id || null, selectedNodeId: null }); }
function toggleCf(id)   { setState({ activeCounterfactual: state.activeCounterfactual === id ? null : id, activeTab: 'graph' }); }

// ── CRUD ─────────────────────────────────────────────────────
function deleteActiveRun()   { /* paste verbatim */ }
function deleteNode(id)      { /* paste verbatim */ }

// ── Import / Export ──────────────────────────────────────────
function handleExport()      { /* paste verbatim */ }
function openImportDialog() {
  showModal(`
    <h2>${ICONS.import} Import Run</h2>
    <p style="font-size:12px;color:var(--text-2);margin-bottom:12px;">
      Accepts <strong>.agentflow.json</strong> or raw trace exports from
      <strong>LangSmith</strong>, <strong>LangFuse</strong>, or <strong>W&amp;B Weave</strong>.
      Max 2 MB.
    </p>
    <input type="file" id="import-file" accept=".json" style="color:var(--text)"/>
    <div id="import-format-badge" style="font-size:11px;color:var(--accent);margin-top:6px;min-height:16px;"></div>
    <div id="import-error" class="error-msg"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn primary" onclick="doImport()">Import</button>
    </div>
  `);

  // Live format detection as soon as a file is picked
  setTimeout(() => {
    document.getElementById('import-file')?.addEventListener('change', function () {
      const file = this.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const obj    = JSON.parse(e.target.result);
          const fmt    = detectFormat(obj);
          const badge  = document.getElementById('import-format-badge');
          const labels = { langsmith: '🔗 LangSmith trace', langfuse: '🪴 LangFuse trace', weave: '🏋️ W&B Weave call' };
          badge.textContent = fmt
            ? `Detected: ${labels[fmt] || fmt}`
            : 'Detected: AgentFlow native (or unknown)';
        } catch { /* ignore */ }
      };
      reader.readAsText(file);
    });
  }, 50);
}

function doImport() {
  const file  = document.getElementById('import-file')?.files?.[0];
  const errEl = document.getElementById('import-error');
  if (!file)            { errEl.textContent = 'Please select a file.'; return; }
  if (file.size > 2 * 1024 * 1024) { errEl.textContent = 'File too large (max 2 MB).'; return; }

  const reader = new FileReader();
  reader.onload = e => {
    let parsed;
    try   { parsed = JSON.parse(e.target.result); }
    catch { errEl.textContent = 'Invalid JSON.'; return; }

    // Try native AgentFlow schema first
    const nativeErr = validateRunSchema(parsed);
    if (!nativeErr) {
      _finishImport(parsed);
      return;
    }

    // Try third-party adapters
    const { run, error } = importFromThirdParty(parsed);
    if (error) {
      // Show both errors so the user has context
      errEl.textContent = `Not native format (${nativeErr}). Adapter: ${error}`;
      return;
    }

    // Adapter produced a run — validate it before accepting
    const adapterErr = validateRunSchema(run);
    if (adapterErr) { errEl.textContent = 'Adapter output invalid: ' + adapterErr; return; }
    _finishImport(run);
  };
  reader.readAsText(file);
}

function _finishImport(run) {
  if (state.runs.find(r => r.id === run.id))
    run = Object.assign({}, run, { id: 'run-' + Date.now() });
  closeModal();
  setState({ runs: [...state.runs, run], activeRunId: run.id,
             selectedNodeId: null, activeCounterfactual: null });
}

// ── Dialogs ──────────────────────────────────────────────────
function openNewRunDialog()  { /* paste verbatim */ }
function createNewRun()      { /* paste verbatim */ }
function openAddNodeDialog() { /* paste verbatim */ }
function addNode()           { /* paste verbatim */ }
function openEditNodeDialog(nodeId) { /* paste verbatim */ }
function saveEditNode(nodeId)       { /* paste verbatim */ }
function openAddCfDialog()   { /* paste verbatim */ }
function createCf()          { /* paste verbatim */ }

// ── Keyboard ─────────────────────────────────────────────────
function attachEvents() {
  document.onkeydown = (e) => {
    if (e.key === 'Escape') closeModal();
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedNodeId && !modalOpen()) {
      const tag = document.activeElement?.tagName;
      if (!['INPUT','TEXTAREA','SELECT'].includes(tag)) deleteNode(state.selectedNodeId);
    }
  };
}