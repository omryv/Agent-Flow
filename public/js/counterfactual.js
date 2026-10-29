/*! AgentFlow — Copyright (c) 2026 Visigence. Proprietary. */
'use strict';

// ── Logic Engine bridge ───────────────────────────────────────────────────────
//
// This module assumes the four Logic Engine reasoning modules
// (facts.js, graph.js, revision.js, explain.js) are loaded as ES modules
// and exposed on window.LogicEngine via the bootstrap loader in index.html.
//
// The bridge converts an AgentFlow run into a Logic Engine fact set,
// computes Pareto-optimal counterfactual revisions for a selected node,
// and materializes adopted revisions into AgentFlow's native counterfactual
// schema so they render through the existing _materializeCounterfactualRun
// pipeline without further special handling.

const ANSWER_NODE_ID = '__answer__';
const MAX_SUGGESTIONS = 4;
const MAX_EDITS_PER_REVISION = 2;

function _logicEngine() {
  if (typeof window === 'undefined' || !window.LogicEngine) {
    return null;
  }
  return window.LogicEngine;
}

function _terminalNodeIds(run) {
  const hasOutgoing = new Set();
  (run.edges || []).forEach(edge => hasOutgoing.add(edge.from));
  return run.nodes.filter(node => !hasOutgoing.has(node.id)).map(node => node.id);
}

function _sourceNodeIds(run) {
  const hasIncoming = new Set();
  (run.edges || []).forEach(edge => hasIncoming.add(edge.to));
  return run.nodes.filter(node => !hasIncoming.has(node.id)).map(node => node.id);
}

/**
 * Convert an AgentFlow run to a Logic Engine fact set.
 *
 * Each AgentFlow edge becomes a Fact. A virtual answer node is added as the
 * sink for every terminal node, so the reachability question becomes
 * "can the source reach the final answer". This lets a single Query model
 * the agent's overall outcome rather than requiring per-edge analysis.
 *
 * Returns { factSet, sourceId, answerId } or null if Logic Engine is unavailable.
 */
function traceToFacts(run) {
  const LE = _logicEngine();
  if (!LE || !run || !Array.isArray(run.nodes) || run.nodes.length === 0) return null;

  const factStrings = [];
  (run.edges || []).forEach(edge => {
    if (edge && typeof edge.from === 'string' && typeof edge.to === 'string') {
      factStrings.push(edge.from + ' > ' + edge.to);
    }
  });

  const terminals = _terminalNodeIds(run);
  terminals.forEach(terminalId => {
    factStrings.push(terminalId + ' > ' + ANSWER_NODE_ID);
  });

  const sources = _sourceNodeIds(run);
  if (sources.length === 0 || terminals.length === 0) return null;

  let factSet;
  try {
    factSet = LE.parseFacts(factStrings);
  } catch (e) {
    return null;
  }

  return {
    factSet,
    sourceId: sources[0],
    answerId: ANSWER_NODE_ID,
    allSourceIds: sources,
  };
}

/**
 * Compute Pareto-optimal counterfactual suggestions for a selected node.
 *
 * The query is "can the trace source reach the final answer". The revisions
 * returned are the smallest sets of edges whose removal would disconnect
 * the answer, restricted to revisions that involve the selected node either
 * as the source or as the target of at least one removed edge. This focuses
 * the suggestions on the user's current point of attention.
 *
 * Returns an array of suggestion objects, each shaped as:
 *   {
 *     id: stable string identifier,
 *     cost: number,
 *     collateral: number,
 *     affectedNodeIds: array of node ids whose status would flip to failed,
 *     removedEdges: array of {from, to} pairs,
 *     summary: short human-readable description,
 *   }
 */
function computeNodeCounterfactuals(run, selectedNodeId) {
  const LE = _logicEngine();
  if (!LE || !run || !selectedNodeId) return [];

  const traceFacts = traceToFacts(run);
  if (!traceFacts) return [];

  const { factSet, sourceId, answerId, allSourceIds } = traceFacts;

  const allRevisions = [];
  allSourceIds.forEach(src => {
    const query = new LE.Query(src, answerId);
    let revisions;
    try {
      revisions = LE.reviseToFalsify(factSet, query, MAX_EDITS_PER_REVISION);
    } catch (e) {
      return;
    }
    revisions.forEach(rev => allRevisions.push({ rev, src }));
  });

  const suggestions = [];
  const seenSignatures = new Set();

  allRevisions.forEach(({ rev }) => {
    const removedEdges = [];
    const affectedNodeIds = new Set();
    let touchesSelected = false;

    rev.editsRemoved.forEach(fact => {
      removedEdges.push({ from: fact.source, to: fact.target });
      // Every removed edge breaks its source step. Cutting a virtual
      // "terminal > __answer__" edge means the terminal step itself failed.
      affectedNodeIds.add(fact.source);
      if (fact.source === selectedNodeId || fact.target === selectedNodeId) {
        touchesSelected = true;
      }
    });

    if (!touchesSelected || affectedNodeIds.size === 0) return;

    const signature = removedEdges
      .map(e => e.from + '>' + e.to)
      .sort()
      .join('|');
    if (seenSignatures.has(signature)) return;
    seenSignatures.add(signature);

    const affectedArray = Array.from(affectedNodeIds);
    const affectedNames = affectedArray
      .map(id => {
        const node = run.nodes.find(n => n.id === id);
        return node ? node.name : id;
      })
      .filter(Boolean);

    const summary = affectedNames.length === 1
      ? 'If "' + affectedNames[0] + '" had failed, the final answer would not have been reached.'
      : 'If ' + affectedNames.length + ' steps had failed, the final answer would not have been reached.';

    suggestions.push({
      id: 'cf-suggested-' + signature.replace(/[^A-Za-z0-9_-]/g, '_'),
      cost: rev.cost,
      collateral: rev.collateral,
      affectedNodeIds: affectedArray,
      removedEdges,
      summary,
    });
  });

  suggestions.sort((a, b) => {
    if (a.cost !== b.cost) return a.cost - b.cost;
    return a.collateral - b.collateral;
  });

  return suggestions.slice(0, MAX_SUGGESTIONS);
}

/**
 * Materialize a Logic Engine suggestion into an AgentFlow counterfactual.
 *
 * The translation rule is: every node that would lose its outgoing edge
 * in the suggested revision becomes a node-level override flipping its
 * status to "failed". This is the semantically faithful mapping from
 * Logic Engine's edge-removal vocabulary into AgentFlow's node-override
 * vocabulary, because in an execution trace you cannot remove an edge
 * without breaking its source step.
 *
 * The returned object slots directly into run.counterfactuals and renders
 * through _materializeCounterfactualRun without further translation.
 */
function materializeRevision(run, suggestion) {
  if (!run || !suggestion) return null;

  const nodeOverrides = {};
  let primaryName = null;

  suggestion.affectedNodeIds.forEach(id => {
    const node = run.nodes.find(n => n.id === id);
    nodeOverrides[id] = {
      status: 'failed',
      content: node && node.content
        ? '[counterfactual] ' + node.content
        : '[counterfactual] step did not complete',
    };
    if (!primaryName && node) primaryName = node.name;
  });

  const failedCount = (run.metrics && run.metrics.failed) || 0;
  const successfulCount = (run.metrics && run.metrics.successful) || run.nodes.length;
  const newFailed = failedCount + suggestion.affectedNodeIds.length;
  const newSuccessful = Math.max(0, successfulCount - suggestion.affectedNodeIds.length);

  const name = primaryName
    ? 'Without "' + primaryName + '"'
    : 'Suggested counterfactual';

  const collateralFragment = suggestion.collateral === 0
    ? 'with no other reasoning steps affected'
    : 'with ' + suggestion.collateral + ' other reasoning step' +
      (suggestion.collateral === 1 ? '' : 's') + ' also disconnected';

  const description = 'Computed by Logic Engine: minimum edit of cost ' +
    suggestion.cost + ', ' + collateralFragment + '.';

  return {
    id: suggestion.id,
    name,
    description,
    nodeOverrides,
    metrics: {
      failed: newFailed,
      successful: newSuccessful,
    },
    finalAnswer: '[counterfactual] final answer would not have been produced',
    source: 'logic-engine',
    cost: suggestion.cost,
    collateral: suggestion.collateral,
  };
}

// Expose the bridge on the global namespace alongside the rest of AgentFlow.
if (typeof window !== 'undefined') {
  window.AgentFlowCounterfactual = {
    traceToFacts,
    computeNodeCounterfactuals,
    materializeRevision,
  };
}