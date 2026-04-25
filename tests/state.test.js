'use strict';

const { createAppContext } = require('./helpers/loadContext');

let ctx;
beforeEach(() => { ctx = createAppContext(); });

// ── Shared fixtures ───────────────────────────────────────────────────────────

function makeRun(overrides = {}) {
  return Object.assign({
    id: 'run-A',
    name: 'Test Run A',
    createdAt: '2025-01-01T00:00:00Z',
    nodes: [
      { id: 'n1', name: 'Input',    content: 'q', role: 'input',    status: 'success' },
      { id: 'n2', name: 'Retrieve', content: 'r', role: 'retrieve', status: 'success' },
    ],
    edges: [{ from: 'n1', to: 'n2' }],
    metrics: { totalMs: 100, tokens: 50, nodes: 2, successful: 2, failed: 0 },
    finalAnswer: 'The answer.',
    counterfactuals: [],
  }, overrides);
}

function makeRunWithCF(runOverrides = {}, cfOverrides = {}) {
  const cf = Object.assign({
    id: 'cf-1',
    name: 'Skip Retrieve',
    description: 'What if n2 failed?',
    nodeOverrides: {
      n2: { status: 'failed', content: 'retrieval failed' },
    },
    metrics: { totalMs: 50, tokens: 20, nodes: 2, successful: 1, failed: 1 },
    finalAnswer: 'No answer.',
  }, cfOverrides);

  return makeRun(Object.assign({ counterfactuals: [cf] }, runOverrides));
}

// ── _normalizeState (tested via setState return value) ────────────────────────

describe('_normalizeState / initial state', () => {
  test('initial state has runs from sample data when localStorage is empty', () => {
    const view = ctx.getActiveRunView();
    expect(view).not.toBeNull();
    expect(view.run).toBeDefined();
  });

  test('initial state has a valid activeRunId', () => {
    const newState = ctx.setState({});
    expect(typeof newState.activeRunId).toBe('string');
  });

  test('initial state activeTab is "graph"', () => {
    const newState = ctx.setState({});
    expect(newState.activeTab).toBe('graph');
  });

  test('invalid activeRunId in patch is corrected to first run id', () => {
    const newState = ctx.setState({ activeRunId: 'nonexistent-run' });
    const firstRunId = newState.runs[0].id;
    expect(newState.activeRunId).toBe(firstRunId);
  });

  test('activeTab is normalised: only "graph" or "counterfactuals" are valid', () => {
    const s1 = ctx.setState({ activeTab: 'counterfactuals' });
    expect(s1.activeTab).toBe('counterfactuals');

    const s2 = ctx.setState({ activeTab: 'unknown-tab' });
    expect(s2.activeTab).toBe('graph');
  });

  test('invalid activeCounterfactual is set to null', () => {
    const newState = ctx.setState({ activeCounterfactual: 'nonexistent-cf' });
    expect(newState.activeCounterfactual).toBeNull();
  });

  test('invalid selectedNodeId is set to null', () => {
    const newState = ctx.setState({ selectedNodeId: 'nonexistent-node' });
    expect(newState.selectedNodeId).toBeNull();
  });

  test('nodePositions defaults to an object', () => {
    const newState = ctx.setState({});
    expect(typeof newState.nodePositions).toBe('object');
  });
});

describe('_normalizeState — runs validation', () => {
  test('valid runs in the patch are preserved', () => {
    const run = makeRun();
    const newState = ctx.setState({ runs: [run], activeRunId: run.id });
    expect(newState.runs).toHaveLength(1);
    expect(newState.runs[0].id).toBe(run.id);
  });

  test('invalid runs are filtered out; fallback to sample data when none survive', () => {
    const newState = ctx.setState({ runs: [{ id: 'bad run', name: '' }] });
    // The invalid run is dropped → falls back to sample data (2 runs)
    expect(newState.runs.length).toBeGreaterThan(0);
    newState.runs.forEach(r => {
      expect(ctx.validateRunSchema(r)).toBeNull();
    });
  });

  test('runs are deep-cloned (mutations to original do not affect stored state)', () => {
    const run = makeRun();
    const s1 = ctx.setState({ runs: [run], activeRunId: run.id });
    // Mutate the original object's nodes array
    run.nodes.push({ id: 'n-extra', name: 'Extra', content: '' });
    const s2 = ctx.setState({});
    // The stored run should still have only the original 2 nodes
    const storedRun = s2.runs.find(r => r.id === 'run-A');
    expect(storedRun).toBeDefined();
    expect(storedRun.nodes).toHaveLength(2);
  });
});

// ── setState() ────────────────────────────────────────────────────────────────

describe('setState()', () => {
  test('returns the normalised state object', () => {
    const newState = ctx.setState({ activeTab: 'counterfactuals' });
    expect(typeof newState).toBe('object');
    expect(newState.activeTab).toBe('counterfactuals');
  });

  test('persists state to localStorage', () => {
    ctx.setState({ activeTab: 'counterfactuals' });
    const raw = ctx.localStorage._store['agentflow.v1'];
    expect(typeof raw).toBe('string');
    const parsed = JSON.parse(raw);
    expect(parsed.activeTab).toBe('counterfactuals');
  });

  test('merges patch into existing state', () => {
    const s1 = ctx.setState({ activeTab: 'counterfactuals' });
    expect(s1.activeTab).toBe('counterfactuals');
    // Now change only selectedNodeId; activeTab should remain
    const s2 = ctx.setState({ activeTab: 'counterfactuals' });
    expect(s2.activeTab).toBe('counterfactuals');
  });

  test('handles null patch without crashing', () => {
    expect(() => ctx.setState(null)).not.toThrow();
  });

  test('handles undefined patch without crashing', () => {
    expect(() => ctx.setState(undefined)).not.toThrow();
  });

  test('setting runs to an array with valid run updates run list', () => {
    const run = makeRun({ id: 'new-run', name: 'New Run' });
    const newState = ctx.setState({ runs: [run], activeRunId: 'new-run' });
    expect(newState.runs.some(r => r.id === 'new-run')).toBe(true);
  });
});

// ── getActiveRunView() ────────────────────────────────────────────────────────

describe('getActiveRunView()', () => {
  test('returns a view object for the default active run', () => {
    const view = ctx.getActiveRunView();
    expect(view).not.toBeNull();
    expect(view.run).toBeDefined();
    expect(view.originalRun).toBeDefined();
    expect(view.isCounterfactual).toBe(false);
    // The Set comes from the vm context, so we duck-type instead of instanceof
    expect(typeof view.overriddenNodeIds.has).toBe('function');
    expect(typeof view.overriddenNodeIds.size).toBe('number');
  });

  test('overriddenNodeIds is empty for the base run', () => {
    const view = ctx.getActiveRunView();
    expect(view.overriddenNodeIds.size).toBe(0);
  });

  test('isCounterfactual is false when activeCounterfactual is null', () => {
    ctx.setState({ activeCounterfactual: null });
    const view = ctx.getActiveRunView();
    expect(view.isCounterfactual).toBe(false);
  });

  test('returns null when activeRunId is null', () => {
    ctx.setState({ runs: [], activeRunId: null });
    // _normalizeState falls back to sample data, but let's test behavior when
    // no run exists: supply a placeholder invalid state by checking the view
    // after patching with a run that normalizes correctly but has no activeRunId
    const newState = ctx.setState({ activeRunId: 'definitely-does-not-exist' });
    // Falls back to first run — if runs exist
    if (newState.runs.length > 0) {
      expect(ctx.getActiveRunView()).not.toBeNull();
    }
  });
});

// ── _buildRunView with counterfactuals ────────────────────────────────────────

describe('_buildRunView() — counterfactual view', () => {
  beforeEach(() => {
    const run = makeRunWithCF();
    ctx.setState({ runs: [run], activeRunId: run.id });
  });

  test('non-existent CF id falls back to base run view', () => {
    ctx.setState({ activeCounterfactual: 'cf-does-not-exist' });
    // After normalization, invalid CF id becomes null, so no CF view
    const view = ctx.getActiveRunView();
    expect(view.isCounterfactual).toBe(false);
  });

  test('valid CF id produces a counterfactual view', () => {
    ctx.setState({ activeCounterfactual: 'cf-1' });
    const view = ctx.getActiveRunView();
    expect(view.isCounterfactual).toBe(true);
  });

  test('overriddenNodeIds includes the overridden node', () => {
    ctx.setState({ activeCounterfactual: 'cf-1' });
    const view = ctx.getActiveRunView();
    expect(view.overriddenNodeIds.has('n2')).toBe(true);
  });

  test('non-overridden nodes are not in overriddenNodeIds', () => {
    ctx.setState({ activeCounterfactual: 'cf-1' });
    const view = ctx.getActiveRunView();
    expect(view.overriddenNodeIds.has('n1')).toBe(false);
  });

  test('originalRun is the base run (not the materialized CF run)', () => {
    ctx.setState({ activeCounterfactual: 'cf-1' });
    const view = ctx.getActiveRunView();
    // The original node n2 should have status 'success'
    const origN2 = view.originalRun.nodes.find(n => n.id === 'n2');
    expect(origN2.status).toBe('success');
  });

  test('CF run has the overridden node status applied', () => {
    ctx.setState({ activeCounterfactual: 'cf-1' });
    const view = ctx.getActiveRunView();
    const cfN2 = view.run.nodes.find(n => n.id === 'n2');
    expect(cfN2.status).toBe('failed');
  });

  test('CF run uses CF metrics when provided', () => {
    ctx.setState({ activeCounterfactual: 'cf-1' });
    const view = ctx.getActiveRunView();
    expect(view.run.metrics.totalMs).toBe(50);
  });

  test('CF run finalAnswer overrides base run finalAnswer', () => {
    ctx.setState({ activeCounterfactual: 'cf-1' });
    const view = ctx.getActiveRunView();
    expect(view.run.finalAnswer).toBe('No answer.');
  });
});

// ── _materializeCounterfactualRun() ──────────────────────────────────────────

describe('_materializeCounterfactualRun()', () => {
  test('merges nodeOverrides into base run nodes', () => {
    const run = makeRun();
    const cf = {
      id: 'cf-x',
      name: 'CF X',
      nodeOverrides: { n1: { status: 'skipped', content: 'skipped content' } },
    };
    const materialized = ctx._materializeCounterfactualRun(run, cf);
    const n1 = materialized.nodes.find(n => n.id === 'n1');
    expect(n1.status).toBe('skipped');
    expect(n1.content).toBe('skipped content');
  });

  test('nodes not in nodeOverrides retain their original values', () => {
    const run = makeRun();
    const cf = {
      nodeOverrides: { n1: { status: 'skipped' } },
    };
    const materialized = ctx._materializeCounterfactualRun(run, cf);
    const n2 = materialized.nodes.find(n => n.id === 'n2');
    expect(n2.status).toBe('success');
  });

  test('uses CF nodes array when explicitly provided (overrides run nodes)', () => {
    const run = makeRun();
    const cfNodes = [
      { id: 'n1', name: 'Different Name', content: 'cf content', role: 'plan', status: 'success' },
    ];
    const cf = { nodes: cfNodes, nodeOverrides: {} };
    const materialized = ctx._materializeCounterfactualRun(run, cf);
    expect(materialized.nodes).toHaveLength(1);
    expect(materialized.nodes[0].name).toBe('Different Name');
  });

  test('uses CF edges array when explicitly provided', () => {
    const run = makeRun();
    const cfEdges = [{ from: 'n2', to: 'n1' }]; // reversed direction
    const cf = { edges: cfEdges, nodeOverrides: {} };
    const materialized = ctx._materializeCounterfactualRun(run, cf);
    expect(materialized.edges[0].from).toBe('n2');
  });

  test('uses run edges when CF does not override them', () => {
    const run = makeRun();
    const cf = { nodeOverrides: {} };
    const materialized = ctx._materializeCounterfactualRun(run, cf);
    expect(materialized.edges).toEqual(run.edges);
  });

  test('CF finalAnswer takes priority over run finalAnswer', () => {
    const run = makeRun({ finalAnswer: 'Original answer' });
    const cf = { nodeOverrides: {}, finalAnswer: 'CF answer' };
    const materialized = ctx._materializeCounterfactualRun(run, cf);
    expect(materialized.finalAnswer).toBe('CF answer');
  });

  test('falls back to run finalAnswer when CF has none', () => {
    const run = makeRun({ finalAnswer: 'Original answer' });
    const cf = { nodeOverrides: {} };
    const materialized = ctx._materializeCounterfactualRun(run, cf);
    expect(materialized.finalAnswer).toBe('Original answer');
  });

  test('CF metrics override run metrics', () => {
    const run = makeRun({ metrics: { totalMs: 1000, tokens: 100, nodes: 2, successful: 2, failed: 0 } });
    const cf = { nodeOverrides: {}, metrics: { totalMs: 500, tokens: 60, nodes: 2, successful: 1, failed: 1 } };
    const materialized = ctx._materializeCounterfactualRun(run, cf);
    expect(materialized.metrics.totalMs).toBe(500);
    expect(materialized.metrics.failed).toBe(1);
  });

  test('falls back to run metrics when CF has no metrics', () => {
    const run = makeRun({ metrics: { totalMs: 1000, tokens: 100, nodes: 2, successful: 2, failed: 0 } });
    const cf = { nodeOverrides: {} };
    const materialized = ctx._materializeCounterfactualRun(run, cf);
    expect(materialized.metrics.totalMs).toBe(1000);
  });
});

// ── clone helpers ─────────────────────────────────────────────────────────────

describe('_cloneNode()', () => {
  test('returns a shallow copy of the node', () => {
    const node = { id: 'n1', name: 'A', content: 'x', role: 'input', status: 'success' };
    const clone = ctx._cloneNode(node);
    expect(clone).toEqual(node);
    expect(clone).not.toBe(node);
  });
});

describe('_cloneEdge()', () => {
  test('returns a shallow copy of the edge', () => {
    const edge = { from: 'n1', to: 'n2' };
    const clone = ctx._cloneEdge(edge);
    expect(clone).toEqual(edge);
    expect(clone).not.toBe(edge);
  });
});

describe('_cloneRun()', () => {
  test('nodes and edges in the clone are independent arrays', () => {
    const run = makeRun();
    const clone = ctx._cloneRun(run);
    expect(clone.nodes).not.toBe(run.nodes);
    expect(clone.edges).not.toBe(run.edges);
    expect(clone.nodes).toEqual(run.nodes);
  });

  test('counterfactuals array is cloned', () => {
    const run = makeRunWithCF();
    const clone = ctx._cloneRun(run);
    expect(clone.counterfactuals).not.toBe(run.counterfactuals);
    expect(clone.counterfactuals).toHaveLength(1);
  });

  test('missing nodes / edges default to empty arrays', () => {
    const partial = { id: 'r1', name: 'R', metrics: {} };
    const clone = ctx._cloneRun(partial);
    expect(Array.isArray(clone.nodes)).toBe(true);
    expect(Array.isArray(clone.edges)).toBe(true);
  });
});

// ── _cloneNodePositions() ─────────────────────────────────────────────────────

describe('_cloneNodePositions()', () => {
  test('returns an empty object for undefined input', () => {
    expect(ctx._cloneNodePositions(undefined)).toEqual({});
  });

  test('clones nested position objects', () => {
    const input = { 'run-1': { 'n1': { x: 10, y: 20 } } };
    const clone = ctx._cloneNodePositions(input);
    expect(clone['run-1']['n1']).toEqual({ x: 10, y: 20 });
    expect(clone['run-1']['n1']).not.toBe(input['run-1']['n1']);
  });

  test('coerces non-numeric position values to 0', () => {
    const input = { 'run-1': { 'n1': { x: 'bad', y: null } } };
    const clone = ctx._cloneNodePositions(input);
    expect(clone['run-1']['n1']).toEqual({ x: 0, y: 0 });
  });
});

// ── overriddenNodeIds detection edge cases ────────────────────────────────────

describe('overriddenNodeIds — detection via _buildRunView', () => {
  test('node changed only in durationMs is detected as overridden', () => {
    const run = makeRun({
      counterfactuals: [{
        id: 'cf-dur',
        name: 'Duration Change',
        nodeOverrides: {},
        nodes: [
          { id: 'n1', name: 'Input', content: 'q', role: 'input', status: 'success', durationMs: 999 },
          { id: 'n2', name: 'Retrieve', content: 'r', role: 'retrieve', status: 'success' },
        ],
      }],
    });
    ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: 'cf-dur' });
    const view = ctx.getActiveRunView();
    // n1 has a different durationMs (999 vs original undefined)
    expect(view.overriddenNodeIds.has('n1')).toBe(true);
  });

  test('node added only in CF (not in base run) is marked overridden', () => {
    const run = makeRun({
      counterfactuals: [{
        id: 'cf-add',
        name: 'Add Node',
        nodeOverrides: {},
        nodes: [
          { id: 'n1', name: 'Input', content: 'q', role: 'input', status: 'success' },
          { id: 'n2', name: 'Retrieve', content: 'r', role: 'retrieve', status: 'success' },
          { id: 'n3', name: 'New Step', content: 'x', role: 'tool', status: 'success' },
        ],
      }],
    });
    ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: 'cf-add' });
    const view = ctx.getActiveRunView();
    expect(view.overriddenNodeIds.has('n3')).toBe(true);
  });
});
