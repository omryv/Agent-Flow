/*! AgentFlow — Copyright (c) 2026 Visigence. Proprietary. */
'use strict';

let state = _loadInitialState();

function _cloneNode(node) {
  return Object.assign({}, node);
}

function _cloneEdge(edge) {
  return Object.assign({}, edge);
}

function _cloneNodeOverrides(nodeOverrides) {
  const copy = {};
  Object.entries(nodeOverrides || {}).forEach(([nodeId, override]) => {
    copy[nodeId] = Object.assign({}, override);
  });
  return copy;
}

function _cloneCounterfactual(cf) {
  return Object.assign({}, cf, {
    nodes: Array.isArray(cf.nodes) ? cf.nodes.map(_cloneNode) : undefined,
    edges: Array.isArray(cf.edges) ? cf.edges.map(_cloneEdge) : undefined,
    metrics: Object.assign({}, cf.metrics || {}),
    nodeOverrides: _cloneNodeOverrides(cf.nodeOverrides),
  });
}

function _cloneRun(run) {
  return Object.assign({}, run, {
    nodes: Array.isArray(run.nodes) ? run.nodes.map(_cloneNode) : [],
    edges: Array.isArray(run.edges) ? run.edges.map(_cloneEdge) : [],
    metrics: Object.assign({}, run.metrics || {}),
    counterfactuals: Array.isArray(run.counterfactuals)
      ? run.counterfactuals.map(_cloneCounterfactual)
      : [],
  });
}

function _cloneNodePositions(nodePositions) {
  const copy = {};
  Object.entries(nodePositions || {}).forEach(([runId, positions]) => {
    copy[runId] = {};
    Object.entries(positions || {}).forEach(([nodeId, pos]) => {
      copy[runId][nodeId] = { x: Number(pos?.x) || 0, y: Number(pos?.y) || 0 };
    });
  });
  return copy;
}

function _isValidRun(run) {
  return !validateRunSchema(run);
}

function _materializeCounterfactualRun(run, cf) {
  const nodeOverrides = cf.nodeOverrides || {};
  const nodes = Array.isArray(cf.nodes)
    ? cf.nodes.map(_cloneNode)
    : run.nodes.map(node =>
        nodeOverrides[node.id]
          ? Object.assign({}, node, nodeOverrides[node.id])
          : _cloneNode(node));
  const edges = Array.isArray(cf.edges)
    ? cf.edges.map(_cloneEdge)
    : run.edges.map(_cloneEdge);

  return Object.assign({}, run, {
    nodes,
    edges,
    metrics: Object.assign({}, cf.metrics || run.metrics || {}),
    finalAnswer: typeof cf.finalAnswer === 'string' ? cf.finalAnswer : run.finalAnswer,
  });
}

function _buildRunView(run, counterfactualId) {
  if (!run) return null;
  if (!counterfactualId) {
    return {
      run,
      originalRun: run,
      isCounterfactual: false,
      overriddenNodeIds: new Set(),
    };
  }

  const cf = (run.counterfactuals || []).find(item => item.id === counterfactualId);
  if (!cf) {
    return {
      run,
      originalRun: run,
      isCounterfactual: false,
      overriddenNodeIds: new Set(),
    };
  }

  const originalNodes = new Map(run.nodes.map(node => [node.id, node]));
  const cfRun = _materializeCounterfactualRun(run, cf);
  const overriddenNodeIds = new Set(Object.keys(cf.nodeOverrides || {}));

  cfRun.nodes.forEach(node => {
    const original = originalNodes.get(node.id);
    if (!original) {
      overriddenNodeIds.add(node.id);
      return;
    }
    if (
      node.name !== original.name ||
      node.role !== original.role ||
      node.status !== original.status ||
      node.content !== original.content ||
      (node.durationMs ?? null) !== (original.durationMs ?? null)
    ) {
      overriddenNodeIds.add(node.id);
    }
  });

  return {
    run: cfRun,
    originalRun: run,
    isCounterfactual: true,
    overriddenNodeIds,
  };
}

function _normalizeState(raw) {
  const fallback = makeSampleData();
  const source = raw && typeof raw === 'object' ? raw : fallback;
  const validRuns = Array.isArray(source.runs) ? source.runs.filter(_isValidRun) : [];
  const runs = (validRuns.length > 0 ? validRuns : fallback.runs).map(_cloneRun);
  const runIds = new Set(runs.map(run => run.id));

  const activeRunId = typeof source.activeRunId === 'string' && runIds.has(source.activeRunId)
    ? source.activeRunId
    : (runs[0]?.id || null);
  const activeRun = runs.find(run => run.id === activeRunId) || null;

  const activeCounterfactual = typeof source.activeCounterfactual === 'string' && activeRun
    && (activeRun.counterfactuals || []).some(cf => cf.id === source.activeCounterfactual)
      ? source.activeCounterfactual
      : null;

  const view = _buildRunView(activeRun, activeCounterfactual);
  const selectedNodeId = typeof source.selectedNodeId === 'string'
    && view?.run.nodes.some(node => node.id === source.selectedNodeId)
      ? source.selectedNodeId
      : null;

  return {
    runs,
    activeRunId,
    selectedNodeId,
    activeTab: source.activeTab === 'counterfactuals' ? 'counterfactuals' : 'graph',
    activeCounterfactual,
    nodePositions: _cloneNodePositions(source.nodePositions),
  };
}

function _loadInitialState() {
  return _normalizeState(SafeStore.load());
}

function setState(patch) {
  state = _normalizeState(Object.assign({}, state, patch || {}));
  SafeStore.save(state);
  if (typeof render === 'function') render();
  return state;
}

function getActiveRunView() {
  const run = state.runs.find(item => item.id === state.activeRunId) || null;
  return _buildRunView(run, state.activeCounterfactual);
}
