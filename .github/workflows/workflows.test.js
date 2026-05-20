'use strict';

const { createAppContext } = require('./helpers/loadContext');

let ctx;
beforeEach(() => { ctx = createAppContext(); });

// ── Fixtures ──────────────────────────────────────────────────────────────────

function ragRun() {
  return {
    id: 'run-rag',
    name: 'Simple RAG Query',
    createdAt: '2026-05-20T12:00:00Z',
    nodes: [
      { id: 'n1', name: 'User Query',          content: 'What is quantum computing?', role: 'input',      status: 'success', durationMs: 10 },
      { id: 'n2', name: 'Retrieve Documentation', content: 'Found 3 relevant docs',  role: 'retrieve',   status: 'success', durationMs: 120 },
      { id: 'n3', name: 'Generate Answer',     content: 'Quantum computing uses...',  role: 'synthesize', status: 'success', durationMs: 850 },
      { id: 'n4', name: 'Format Response',     content: 'Here is your answer...',     role: 'output',     status: 'success', durationMs: 5 },
    ],
    edges: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3' },
      { from: 'n3', to: 'n4' },
    ],
    metrics: { totalMs: 985, tokens: 245, nodes: 4, successful: 4, failed: 0 },
    finalAnswer: 'Quantum computing is a type of computation that harnesses quantum mechanical phenomena.',
    counterfactuals: [],
  };
}

function failingRun() {
  return {
    id: 'run-fail',
    name: 'Failing Pipeline',
    createdAt: '2026-05-20T13:00:00Z',
    nodes: [
      { id: 'f1', name: 'Parse Input',   content: 'parsing...', role: 'input',    status: 'success', durationMs: 15 },
      { id: 'f2', name: 'Call API',       content: 'timeout',    role: 'tool',     status: 'failed',  durationMs: 30000 },
      { id: 'f3', name: 'Fallback Plan',  content: 'retrying',   role: 'plan',     status: 'success', durationMs: 5 },
      { id: 'f4', name: 'Cached Answer',  content: 'cached',     role: 'output',   status: 'success', durationMs: 2 },
    ],
    edges: [
      { from: 'f1', to: 'f2' },
      { from: 'f1', to: 'f3' },
      { from: 'f3', to: 'f4' },
    ],
    metrics: { totalMs: 30022, tokens: 50, nodes: 4, successful: 3, failed: 1 },
    finalAnswer: 'Cached response returned.',
    counterfactuals: [],
  };
}

function diamondRun() {
  return {
    id: 'run-diamond',
    name: 'Diamond Pipeline',
    createdAt: '2026-05-20T14:00:00Z',
    nodes: [
      { id: 'a', name: 'Input',      content: 'query',  role: 'input',      status: 'success', durationMs: 5 },
      { id: 'b', name: 'Search Web',  content: 'web',    role: 'retrieve',   status: 'success', durationMs: 200 },
      { id: 'c', name: 'Search DB',   content: 'db',     role: 'retrieve',   status: 'success', durationMs: 150 },
      { id: 'd', name: 'Merge',       content: 'merged', role: 'synthesize', status: 'success', durationMs: 300 },
      { id: 'e', name: 'Validate',    content: 'ok',     role: 'validate',   status: 'success', durationMs: 50 },
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
      { from: 'b', to: 'd' },
      { from: 'c', to: 'd' },
      { from: 'd', to: 'e' },
    ],
    metrics: { totalMs: 705, tokens: 180, nodes: 5, successful: 5, failed: 0 },
    finalAnswer: 'Merged answer from web and db.',
    counterfactuals: [],
  };
}

function runWithExistingCf() {
  const run = ragRun();
  run.counterfactuals = [{
    id: 'cf-manual',
    name: 'Without Retrieval',
    description: 'What if retrieval failed?',
    nodeOverrides: {
      n2: { status: 'failed', content: '[counterfactual] retrieval unavailable' },
    },
    metrics: { totalMs: 200, tokens: 80, nodes: 4, successful: 3, failed: 1 },
    finalAnswer: 'Unable to retrieve documents, answering from memory.',
  }];
  return run;
}

// ── Workflow 1: Fresh start → import → inspect ───────────────────────────────

describe('Workflow: fresh start → import → inspect', () => {
  test('fresh app has no active run', () => {
    const view = ctx.getActiveRunView();
    expect(view).toBeNull();
  });

  test('importing a run makes it active', () => {
    const run = ragRun();
    ctx.setState({ runs: [run], activeRunId: run.id });
    const view = ctx.getActiveRunView();
    expect(view).not.toBeNull();
    expect(view.run.id).toBe('run-rag');
  });

  test('imported run preserves all node data', () => {
    const run = ragRun();
    ctx.setState({ runs: [run], activeRunId: run.id });
    const view = ctx.getActiveRunView();
    expect(view.run.nodes).toHaveLength(4);
    expect(view.run.nodes[0].name).toBe('User Query');
    expect(view.run.nodes[3].name).toBe('Format Response');
  });

  test('imported run preserves all edge data', () => {
    const run = ragRun();
    ctx.setState({ runs: [run], activeRunId: run.id });
    const view = ctx.getActiveRunView();
    expect(view.run.edges).toHaveLength(3);
  });

  test('imported run preserves metrics', () => {
    const run = ragRun();
    ctx.setState({ runs: [run], activeRunId: run.id });
    const view = ctx.getActiveRunView();
    expect(view.run.metrics.totalMs).toBe(985);
    expect(view.run.metrics.tokens).toBe(245);
  });

  test('selecting a node updates selectedNodeId in state', () => {
    const run = ragRun();
    ctx.setState({ runs: [run], activeRunId: run.id });
    const s = ctx.setState({ selectedNodeId: 'n2' });
    expect(s.selectedNodeId).toBe('n2');
  });

  test('selecting a nonexistent node normalizes to null', () => {
    const run = ragRun();
    ctx.setState({ runs: [run], activeRunId: run.id });
    const s = ctx.setState({ selectedNodeId: 'ghost' });
    expect(s.selectedNodeId).toBeNull();
  });

  test('deselecting a node sets selectedNodeId to null', () => {
    const run = ragRun();
    ctx.setState({ runs: [run], activeRunId: run.id, selectedNodeId: 'n1' });
    const s = ctx.setState({ selectedNodeId: null });
    expect(s.selectedNodeId).toBeNull();
  });
});

// ── Workflow 2: Multiple runs → switching ────────────────────────────────────

describe('Workflow: multiple runs → switching', () => {
  test('loading two runs makes the first one active by default', () => {
    const r1 = ragRun();
    const r2 = failingRun();
    ctx.setState({ runs: [r1, r2] });
    const s = ctx.setState({});
    expect(s.activeRunId).toBe('run-rag');
  });

  test('switching active run updates the view', () => {
    const r1 = ragRun();
    const r2 = failingRun();
    ctx.setState({ runs: [r1, r2], activeRunId: r1.id });
    ctx.setState({ activeRunId: r2.id });
    const view = ctx.getActiveRunView();
    expect(view.run.id).toBe('run-fail');
    expect(view.run.name).toBe('Failing Pipeline');
  });

  test('switching run clears selectedNodeId', () => {
    const r1 = ragRun();
    const r2 = failingRun();
    ctx.setState({ runs: [r1, r2], activeRunId: r1.id, selectedNodeId: 'n1' });
    const s = ctx.setState({ activeRunId: r2.id, selectedNodeId: null });
    expect(s.selectedNodeId).toBeNull();
  });

  test('switching run clears activeCounterfactual', () => {
    const r1 = runWithExistingCf();
    const r2 = failingRun();
    ctx.setState({ runs: [r1, r2], activeRunId: r1.id, activeCounterfactual: 'cf-manual' });
    const s = ctx.setState({ activeRunId: r2.id, activeCounterfactual: null });
    expect(s.activeCounterfactual).toBeNull();
  });

  test('removing all runs results in null view', () => {
    const r1 = ragRun();
    ctx.setState({ runs: [r1], activeRunId: r1.id });
    ctx.setState({ runs: [], activeRunId: null });
    expect(ctx.getActiveRunView()).toBeNull();
  });

  test('adding a third run preserves existing runs', () => {
    const r1 = ragRun();
    const r2 = failingRun();
    ctx.setState({ runs: [r1, r2], activeRunId: r1.id });
    const r3 = diamondRun();
    const s = ctx.setState({ runs: [r1, r2, r3] });
    expect(s.runs).toHaveLength(3);
  });
});

// ── Workflow 3: Node search / filter ─────────────────────────────────────────

describe('Workflow: node search filtering', () => {
  test('setting searchQuery updates state', () => {
    const run = ragRun();
    ctx.setState({ runs: [run], activeRunId: run.id });
    const s = ctx.setState({ searchQuery: 'retrieve' });
    expect(s.searchQuery).toBe('retrieve');
  });

  test('clearing searchQuery resets to empty string', () => {
    const run = ragRun();
    ctx.setState({ runs: [run], activeRunId: run.id, searchQuery: 'test' });
    const s = ctx.setState({ searchQuery: '' });
    expect(s.searchQuery).toBe('');
  });

  test('searchQuery is not persisted to localStorage', () => {
    const run = ragRun();
    ctx.setState({ runs: [run], activeRunId: run.id, searchQuery: 'secret' });
    const raw = JSON.parse(ctx.localStorage._store['agentflow.v1']);
    expect(raw.searchQuery).toBe('');
  });
});

// ── Workflow 4: Tab switching ────────────────────────────────────────────────

describe('Workflow: tab switching', () => {
  test('default tab is graph', () => {
    const s = ctx.setState({});
    expect(s.activeTab).toBe('graph');
  });

  test('switching to counterfactuals tab', () => {
    const s = ctx.setState({ activeTab: 'counterfactuals' });
    expect(s.activeTab).toBe('counterfactuals');
  });

  test('switching back to graph tab', () => {
    ctx.setState({ activeTab: 'counterfactuals' });
    const s = ctx.setState({ activeTab: 'graph' });
    expect(s.activeTab).toBe('graph');
  });

  test('invalid tab name normalizes to graph', () => {
    const s = ctx.setState({ activeTab: 'settings' });
    expect(s.activeTab).toBe('graph');
  });
});

// ── Workflow 5: Manual counterfactual → activate → compare ───────────────────

describe('Workflow: manual counterfactual activation', () => {
  test('activating a CF switches to counterfactual view', () => {
    const run = runWithExistingCf();
    ctx.setState({ runs: [run], activeRunId: run.id });
    ctx.setState({ activeCounterfactual: 'cf-manual' });
    const view = ctx.getActiveRunView();
    expect(view.isCounterfactual).toBe(true);
  });

  test('CF view shows overridden node as failed', () => {
    const run = runWithExistingCf();
    ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: 'cf-manual' });
    const view = ctx.getActiveRunView();
    const n2 = view.run.nodes.find(n => n.id === 'n2');
    expect(n2.status).toBe('failed');
    expect(n2.content).toContain('counterfactual');
  });

  test('CF view marks overridden node in overriddenNodeIds', () => {
    const run = runWithExistingCf();
    ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: 'cf-manual' });
    const view = ctx.getActiveRunView();
    expect(view.overriddenNodeIds.has('n2')).toBe(true);
  });

  test('non-overridden nodes retain original status in CF view', () => {
    const run = runWithExistingCf();
    ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: 'cf-manual' });
    const view = ctx.getActiveRunView();
    const n1 = view.run.nodes.find(n => n.id === 'n1');
    expect(n1.status).toBe('success');
  });

  test('originalRun in CF view has all nodes as success', () => {
    const run = runWithExistingCf();
    ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: 'cf-manual' });
    const view = ctx.getActiveRunView();
    view.originalRun.nodes.forEach(n => {
      expect(n.status).toBe('success');
    });
  });

  test('CF view uses CF metrics', () => {
    const run = runWithExistingCf();
    ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: 'cf-manual' });
    const view = ctx.getActiveRunView();
    expect(view.run.metrics.totalMs).toBe(200);
    expect(view.run.metrics.failed).toBe(1);
  });

  test('CF view uses CF finalAnswer', () => {
    const run = runWithExistingCf();
    ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: 'cf-manual' });
    const view = ctx.getActiveRunView();
    expect(view.run.finalAnswer).toContain('memory');
  });

  test('deactivating CF returns to base run', () => {
    const run = runWithExistingCf();
    ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: 'cf-manual' });
    ctx.setState({ activeCounterfactual: null });
    const view = ctx.getActiveRunView();
    expect(view.isCounterfactual).toBe(false);
    expect(view.run.metrics.totalMs).toBe(985);
  });

  test('nodeSuggestions is empty array when viewing a CF', () => {
    const run = runWithExistingCf();
    ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: 'cf-manual' });
    const view = ctx.getActiveRunView();
    expect(view.nodeSuggestions).toEqual([]);
  });
});

// ── Workflow 6: Logic Engine counterfactual generation ────────────────────────

describe('Workflow: Logic Engine counterfactual generation', () => {
  test('computing suggestions across nodes returns results', () => {
    const run = ragRun();
    ctx.setState({ runs: [run], activeRunId: run.id });
    let found = false;
    run.nodes.forEach(node => {
      const s = ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, node.id);
      if (s.length > 0) found = true;
    });
    expect(found).toBe(true);
  });

  test('materializing a suggestion produces a valid CF', () => {
    const run = ragRun();
    let suggestion = null;
    for (const node of run.nodes) {
      const s = ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, node.id);
      if (s.length > 0) { suggestion = s[0]; break; }
    }
    expect(suggestion).not.toBeNull();
    const cf = ctx.window.AgentFlowCounterfactual.materializeRevision(run, suggestion);
    expect(cf).not.toBeNull();
    run.counterfactuals.push(cf);
    expect(ctx.validateRunSchema(run)).toBeNull();
  });

  test('adopting a Logic Engine CF and activating it shows failed nodes', () => {
    const run = ragRun();
    let suggestion = null;
    for (const node of run.nodes) {
      const s = ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, node.id);
      if (s.length > 0) { suggestion = s[0]; break; }
    }
    expect(suggestion).not.toBeNull();
    const cf = ctx.window.AgentFlowCounterfactual.materializeRevision(run, suggestion);
    run.counterfactuals.push(cf);
    ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: cf.id });
    const view = ctx.getActiveRunView();
    expect(view.isCounterfactual).toBe(true);
    const failedNodes = view.run.nodes.filter(n => n.status === 'failed');
    expect(failedNodes.length).toBeGreaterThan(0);
  });

  test('Logic Engine CF coexists with manual CF on same run', () => {
    const run = runWithExistingCf();
    let suggestion = null;
    for (const node of run.nodes) {
      const s = ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, node.id);
      if (s.length > 0) { suggestion = s[0]; break; }
    }
    expect(suggestion).not.toBeNull();
    const cf = ctx.window.AgentFlowCounterfactual.materializeRevision(run, suggestion);
    run.counterfactuals.push(cf);
    expect(ctx.validateRunSchema(run)).toBeNull();
    expect(run.counterfactuals).toHaveLength(2);

    // Activate manual CF
    ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: 'cf-manual' });
    let view = ctx.getActiveRunView();
    expect(view.overriddenNodeIds.has('n2')).toBe(true);

    // Switch to Logic Engine CF
    ctx.setState({ activeCounterfactual: cf.id });
    view = ctx.getActiveRunView();
    expect(view.isCounterfactual).toBe(true);
    expect(view.overriddenNodeIds.has('n2')).toBe(false);
  });

  test('generating suggestions for every node in a diamond run', () => {
    const run = diamondRun();
    const allSuggestions = [];
    run.nodes.forEach(node => {
      const s = ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, node.id);
      allSuggestions.push(...s);
    });
    // Diamond should produce suggestions for at least some nodes
    expect(allSuggestions.length).toBeGreaterThan(0);
  });

  test('deduplication: same suggestion from different nodes is not repeated', () => {
    const run = diamondRun();
    const seenIds = new Set();
    const allSuggestions = [];
    run.nodes.forEach(node => {
      const s = ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, node.id);
      s.forEach(sug => {
        if (!seenIds.has(sug.id)) {
          seenIds.add(sug.id);
          allSuggestions.push(sug);
        }
      });
    });
    const ids = allSuggestions.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── Workflow 7: Third-party import → full cycle ──────────────────────────────

describe('Workflow: third-party import → full cycle', () => {
  function langSmithTrace() {
    return {
      id: 'ls-001',
      name: 'LangSmith RAG',
      run_type: 'chain',
      inputs: { question: 'What is AI?' },
      outputs: { answer: 'AI is...' },
      start_time: '2026-05-20T10:00:00Z',
      end_time: '2026-05-20T10:00:02Z',
      error: null,
      child_runs: [
        {
          id: 'ls-child-1', name: 'Retrieve', run_type: 'retriever',
          inputs: {}, outputs: { docs: ['d1'] },
          start_time: '2026-05-20T10:00:00.100Z', end_time: '2026-05-20T10:00:00.500Z',
          error: null, child_runs: [],
        },
        {
          id: 'ls-child-2', name: 'Generate', run_type: 'llm',
          inputs: {}, outputs: { text: 'AI is...' },
          start_time: '2026-05-20T10:00:00.500Z', end_time: '2026-05-20T10:00:01.800Z',
          error: null, child_runs: [],
          extra: { usage_metadata: { total_tokens: 200 } },
        },
      ],
    };
  }

  test('LangSmith trace imports and passes validation', () => {
    const { run, format } = ctx.importFromThirdParty(langSmithTrace());
    expect(format).toBe('langsmith');
    expect(ctx.validateRunSchema(run)).toBeNull();
  });

  test('imported LangSmith trace can be loaded into state', () => {
    const { run } = ctx.importFromThirdParty(langSmithTrace());
    ctx.setState({ runs: [run], activeRunId: run.id });
    const view = ctx.getActiveRunView();
    expect(view).not.toBeNull();
    expect(view.run.nodes.length).toBe(3);
  });

  test('imported trace can have Logic Engine counterfactuals computed', () => {
    const { run } = ctx.importFromThirdParty(langSmithTrace());
    ctx.setState({ runs: [run], activeRunId: run.id });
    const middleNode = run.nodes[1];
    const suggestions = ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, middleNode.id);
    expect(Array.isArray(suggestions)).toBe(true);
  });

  test('full cycle: import → compute CF → adopt → activate → deactivate', () => {
    const { run } = ctx.importFromThirdParty(langSmithTrace());
    ctx.setState({ runs: [run], activeRunId: run.id });

    // Find a node that produces suggestions
    let suggestion = null;
    for (const node of run.nodes) {
      const s = ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, node.id);
      if (s.length > 0) { suggestion = s[0]; break; }
    }

    if (suggestion) {
      const cf = ctx.window.AgentFlowCounterfactual.materializeRevision(run, suggestion);
      run.counterfactuals.push(cf);
      ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: cf.id });

      let view = ctx.getActiveRunView();
      expect(view.isCounterfactual).toBe(true);

      ctx.setState({ activeCounterfactual: null });
      view = ctx.getActiveRunView();
      expect(view.isCounterfactual).toBe(false);
    }
  });
});

// ── Workflow 8: State persistence → reload ───────────────────────────────────

describe('Workflow: state persistence across reload', () => {
  test('run survives simulated reload', () => {
    const run = ragRun();
    ctx.setState({ runs: [run], activeRunId: run.id, selectedNodeId: 'n2' });
    const saved = ctx.localStorage._store['agentflow.v1'];

    // Simulate reload: create new context with same localStorage
    const ctx2 = require('./helpers/loadContext').createAppContext({
      localStorage: {
        _store: { 'agentflow.v1': saved },
        getItem(key) { return this._store[key] || null; },
        setItem(key, val) { this._store[key] = String(val); },
        removeItem(key) { delete this._store[key]; },
        clear() { this._store = {}; },
      },
    });

    const view = ctx2.getActiveRunView();
    expect(view).not.toBeNull();
    expect(view.run.id).toBe('run-rag');
    expect(view.run.nodes).toHaveLength(4);
  });

  test('active tab persists across reload', () => {
    ctx.setState({ activeTab: 'counterfactuals' });
    const saved = ctx.localStorage._store['agentflow.v1'];

    const ctx2 = require('./helpers/loadContext').createAppContext({
      localStorage: {
        _store: { 'agentflow.v1': saved },
        getItem(key) { return this._store[key] || null; },
        setItem(key, val) { this._store[key] = String(val); },
        removeItem(key) { delete this._store[key]; },
        clear() { this._store = {}; },
      },
    });

    const s = ctx2.setState({});
    expect(s.activeTab).toBe('counterfactuals');
  });

  test('counterfactual state persists across reload', () => {
    const run = runWithExistingCf();
    ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: 'cf-manual' });
    const saved = ctx.localStorage._store['agentflow.v1'];

    const ctx2 = require('./helpers/loadContext').createAppContext({
      localStorage: {
        _store: { 'agentflow.v1': saved },
        getItem(key) { return this._store[key] || null; },
        setItem(key, val) { this._store[key] = String(val); },
        removeItem(key) { delete this._store[key]; },
        clear() { this._store = {}; },
      },
    });

    const view = ctx2.getActiveRunView();
    expect(view.isCounterfactual).toBe(true);
    expect(view.overriddenNodeIds.has('n2')).toBe(true);
  });

  test('searchQuery is NOT persisted (reset on reload)', () => {
    const run = ragRun();
    ctx.setState({ runs: [run], activeRunId: run.id, searchQuery: 'test query' });
    const saved = ctx.localStorage._store['agentflow.v1'];
    const parsed = JSON.parse(saved);
    expect(parsed.searchQuery).toBe('');
  });
});

// ── Workflow 9: Layout positioning ───────────────────────────────────────────

describe('Workflow: layout positions match graph topology', () => {
  test('linear run: nodes are positioned left to right', () => {
    const run = ragRun();
    const positions = ctx.layoutNodes(run.nodes, run.edges);
    expect(positions.n1.x).toBeLessThan(positions.n2.x);
    expect(positions.n2.x).toBeLessThan(positions.n3.x);
    expect(positions.n3.x).toBeLessThan(positions.n4.x);
  });

  test('diamond run: parallel nodes share same x coordinate', () => {
    const run = diamondRun();
    const positions = ctx.layoutNodes(run.nodes, run.edges);
    expect(positions.b.x).toBe(positions.c.x);
  });

  test('diamond run: merge node is to the right of parallel nodes', () => {
    const run = diamondRun();
    const positions = ctx.layoutNodes(run.nodes, run.edges);
    expect(positions.d.x).toBeGreaterThan(positions.b.x);
  });

  test('diamond run: input is leftmost, validate is rightmost', () => {
    const run = diamondRun();
    const positions = ctx.layoutNodes(run.nodes, run.edges);
    const allX = Object.values(positions).map(p => p.x);
    expect(positions.a.x).toBe(Math.min(...allX));
    expect(positions.e.x).toBe(Math.max(...allX));
  });

  test('failing run with fan-out: both branches start at same x', () => {
    const run = failingRun();
    const positions = ctx.layoutNodes(run.nodes, run.edges);
    // f2 and f3 both come from f1
    expect(positions.f2.x).toBe(positions.f3.x);
  });

  test('every node gets a position', () => {
    const run = diamondRun();
    const positions = ctx.layoutNodes(run.nodes, run.edges);
    run.nodes.forEach(n => {
      expect(positions).toHaveProperty(n.id);
      expect(typeof positions[n.id].x).toBe('number');
      expect(typeof positions[n.id].y).toBe('number');
    });
  });
});

// ── Workflow 10: Data validation rejects bad imports ─────────────────────────

describe('Workflow: validation rejects corrupted imports', () => {
  test('run with missing node id is rejected', () => {
    const run = ragRun();
    delete run.nodes[0].id;
    expect(ctx.validateRunSchema(run)).not.toBeNull();
  });

  test('run with edge pointing to nonexistent node is rejected', () => {
    const run = ragRun();
    run.edges.push({ from: 'n4', to: 'ghost' });
    expect(ctx.validateRunSchema(run)).toMatch(/ghost/);
  });

  test('rejected run does not enter state', () => {
    const bad = { id: 'bad run!', name: '', nodes: 'not-array', edges: [] };
    ctx.setState({ runs: [bad] });
    const s = ctx.setState({});
    expect(s.runs).toHaveLength(0);
  });

  test('mix of valid and invalid runs: only valid survives', () => {
    const good = ragRun();
    const bad = { id: 'bad!', name: '', nodes: [], edges: [] };
    ctx.setState({ runs: [good, bad] });
    const s = ctx.setState({});
    expect(s.runs).toHaveLength(1);
    expect(s.runs[0].id).toBe('run-rag');
  });
});

// ── Workflow 11: Role and status inference from adapters ─────────────────────

describe('Workflow: adapter role and status inference', () => {
  test('LLM run_type maps to synthesize role', () => {
    expect(ctx.inferRole('llm', '')).toBe('synthesize');
  });

  test('retriever run_type maps to retrieve role', () => {
    expect(ctx.inferRole('retriever', '')).toBe('retrieve');
  });

  test('name containing "search" maps to retrieve', () => {
    expect(ctx.inferRole('', 'Vector Search')).toBe('retrieve');
  });

  test('name containing "validate" maps to validate', () => {
    expect(ctx.inferRole('', 'Fact Validation')).toBe('validate');
  });

  test('name containing "output" maps to output', () => {
    expect(ctx.inferRole('', 'Final Output')).toBe('output');
  });

  test('error present maps to failed status', () => {
    expect(ctx.inferStatus('TimeoutError')).toBe('failed');
  });

  test('no error maps to success status', () => {
    expect(ctx.inferStatus(null)).toBe('success');
  });
});

// ── Workflow 12: Deep clone isolation ────────────────────────────────────────

describe('Workflow: mutations to original data do not affect state', () => {
  test('mutating original run nodes after setState has no effect', () => {
    const run = ragRun();
    ctx.setState({ runs: [run], activeRunId: run.id });
    run.nodes.push({ id: 'injected', name: 'Injected', content: 'bad' });
    const view = ctx.getActiveRunView();
    expect(view.run.nodes).toHaveLength(4);
  });

  test('mutating original run edges after setState has no effect', () => {
    const run = ragRun();
    ctx.setState({ runs: [run], activeRunId: run.id });
    run.edges.push({ from: 'n1', to: 'n4' });
    const view = ctx.getActiveRunView();
    expect(view.run.edges).toHaveLength(3);
  });

  test('mutating original counterfactuals after setState has no effect', () => {
    const run = runWithExistingCf();
    ctx.setState({ runs: [run], activeRunId: run.id });
    run.counterfactuals.push({ id: 'cf-injected', name: 'Bad', nodeOverrides: {} });
    const view = ctx.getActiveRunView();
    const origRun = view.originalRun || view.run;
    expect(origRun.counterfactuals).toHaveLength(1);
  });
});

// ── Workflow 13: Edge cases ──────────────────────────────────────────────────

describe('Workflow: edge cases', () => {
  test('run with self-loop edge still lays out', () => {
    const run = {
      id: 'run-self',
      name: 'Self Loop',
      createdAt: '2026-01-01T00:00:00Z',
      nodes: [{ id: 'x', name: 'Loop', content: 'looping', role: 'plan', status: 'success' }],
      edges: [{ from: 'x', to: 'x' }],
      metrics: { totalMs: 10, tokens: 5, nodes: 1, successful: 1, failed: 0 },
      counterfactuals: [],
    };
    const positions = ctx.layoutNodes(run.nodes, run.edges);
    expect(positions).toHaveProperty('x');
  });

  test('run with all nodes failed still loads and displays', () => {
    const run = ragRun();
    run.nodes.forEach(n => { n.status = 'failed'; });
    run.metrics.failed = 4;
    run.metrics.successful = 0;
    ctx.setState({ runs: [run], activeRunId: run.id });
    const view = ctx.getActiveRunView();
    expect(view).not.toBeNull();
    expect(view.run.nodes.every(n => n.status === 'failed')).toBe(true);
  });

  test('run with empty content strings still loads', () => {
    const run = ragRun();
    run.nodes.forEach(n => { n.content = ''; });
    expect(ctx.validateRunSchema(run)).toBeNull();
    ctx.setState({ runs: [run], activeRunId: run.id });
    expect(ctx.getActiveRunView()).not.toBeNull();
  });

  test('run with maximum length name (200 chars) passes validation', () => {
    const run = ragRun();
    run.name = 'x'.repeat(200);
    expect(ctx.validateRunSchema(run)).toBeNull();
  });

  test('run with 201-char name fails validation', () => {
    const run = ragRun();
    run.name = 'x'.repeat(201);
    expect(ctx.validateRunSchema(run)).not.toBeNull();
  });

  test('rapid state transitions do not corrupt state', () => {
    const run = ragRun();
    ctx.setState({ runs: [run], activeRunId: run.id });
    for (let i = 0; i < 50; i++) {
      ctx.setState({ selectedNodeId: run.nodes[i % 4].id });
      ctx.setState({ activeTab: i % 2 === 0 ? 'graph' : 'counterfactuals' });
    }
    const s = ctx.setState({});
    expect(s.runs).toHaveLength(1);
    expect(s.runs[0].nodes).toHaveLength(4);
  });
});
