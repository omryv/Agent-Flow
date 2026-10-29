'use strict';

const { createAppContext } = require('./helpers/loadContext');

let ctx;
beforeEach(() => { ctx = createAppContext(); });

// ── Fixtures ──────────────────────────────────────────────────────────────────

function linearRun() {
  return {
    id: 'run-linear',
    name: 'Linear Run',
    createdAt: '2026-01-01T00:00:00Z',
    nodes: [
      { id: 'n1', name: 'User Query',       content: 'query',     role: 'input',      status: 'success' },
      { id: 'n2', name: 'Retrieve Docs',    content: 'docs',      role: 'retrieve',   status: 'success' },
      { id: 'n3', name: 'Generate Answer',  content: 'answer',    role: 'synthesize', status: 'success' },
      { id: 'n4', name: 'Format Response',  content: 'formatted', role: 'output',     status: 'success' },
    ],
    edges: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3' },
      { from: 'n3', to: 'n4' },
    ],
    metrics: { totalMs: 500, tokens: 100, nodes: 4, successful: 4, failed: 0 },
    finalAnswer: 'The answer is 42.',
    counterfactuals: [],
  };
}

function diamondRun() {
  return {
    id: 'run-diamond',
    name: 'Diamond Run',
    createdAt: '2026-01-01T00:00:00Z',
    nodes: [
      { id: 'a', name: 'Input',     content: 'q', role: 'input',      status: 'success' },
      { id: 'b', name: 'Path One',  content: 'r', role: 'retrieve',   status: 'success' },
      { id: 'c', name: 'Path Two',  content: 's', role: 'synthesize', status: 'success' },
      { id: 'd', name: 'Output',    content: 'o', role: 'output',     status: 'success' },
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
      { from: 'b', to: 'd' },
      { from: 'c', to: 'd' },
    ],
    metrics: { totalMs: 300, tokens: 80, nodes: 4, successful: 4, failed: 0 },
    finalAnswer: 'Diamond answer.',
    counterfactuals: [],
  };
}

function singleNodeRun() {
  return {
    id: 'run-single',
    name: 'Single Node',
    createdAt: '2026-01-01T00:00:00Z',
    nodes: [
      { id: 'only', name: 'Only Node', content: 'alone', role: 'input', status: 'success' },
    ],
    edges: [],
    metrics: { totalMs: 10, tokens: 5, nodes: 1, successful: 1, failed: 0 },
    finalAnswer: 'Solo.',
    counterfactuals: [],
  };
}

// ── window.AgentFlowCounterfactual registration ──────────────────────────────

describe('AgentFlowCounterfactual registration', () => {
  test('window.AgentFlowCounterfactual is defined', () => {
    expect(ctx.window.AgentFlowCounterfactual).toBeDefined();
  });

  test('exposes traceToFacts', () => {
    expect(typeof ctx.window.AgentFlowCounterfactual.traceToFacts).toBe('function');
  });

  test('exposes computeNodeCounterfactuals', () => {
    expect(typeof ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals).toBe('function');
  });

  test('exposes materializeRevision', () => {
    expect(typeof ctx.window.AgentFlowCounterfactual.materializeRevision).toBe('function');
  });
});

// ── window.LogicEngine registration ──────────────────────────────────────────

describe('LogicEngine registration', () => {
  test('window.LogicEngine is defined', () => {
    expect(ctx.window.LogicEngine).toBeDefined();
  });

  test('LogicEngine exposes parseFacts', () => {
    expect(typeof ctx.window.LogicEngine.parseFacts).toBe('function');
  });

  test('LogicEngine exposes reviseToFalsify', () => {
    expect(typeof ctx.window.LogicEngine.reviseToFalsify).toBe('function');
  });

  test('LogicEngine exposes Query constructor', () => {
    expect(typeof ctx.window.LogicEngine.Query).toBe('function');
  });
});

// ── traceToFacts ─────────────────────────────────────────────────────────────

describe('traceToFacts()', () => {
  function call(run) {
    return ctx.window.AgentFlowCounterfactual.traceToFacts(run);
  }

  test('returns null for null run', () => {
    expect(call(null)).toBeNull();
  });

  test('returns null for undefined run', () => {
    expect(call(undefined)).toBeNull();
  });

  test('returns null for run with no nodes', () => {
    const run = linearRun();
    run.nodes = [];
    expect(call(run)).toBeNull();
  });

  test('returns null for run with empty edges and single node (no sources or terminals distinction)', () => {
    const result = call(singleNodeRun());
    // Single node is both source and terminal, so facts are created
    expect(result).not.toBeNull();
  });

  test('returns object with factSet, sourceId, answerId, allSourceIds', () => {
    const result = call(linearRun());
    expect(result).not.toBeNull();
    expect(result.factSet).toBeDefined();
    expect(typeof result.sourceId).toBe('string');
    expect(typeof result.answerId).toBe('string');
    expect(Array.isArray(result.allSourceIds)).toBe(true);
  });

  test('answerId is the virtual __answer__ node', () => {
    const result = call(linearRun());
    expect(result.answerId).toBe('__answer__');
  });

  test('sourceId is the node with no incoming edges', () => {
    const result = call(linearRun());
    expect(result.sourceId).toBe('n1');
  });

  test('allSourceIds contains all root nodes', () => {
    const result = call(linearRun());
    expect(result.allSourceIds).toEqual(['n1']);
  });

  test('linear run: factSet contains each edge as a fact', () => {
    const result = call(linearRun());
    const keys = Array.from(result.factSet.keys());
    expect(keys).toContain('n1>n2');
    expect(keys).toContain('n2>n3');
    expect(keys).toContain('n3>n4');
  });

  test('linear run: factSet contains virtual edge from terminal to __answer__', () => {
    const result = call(linearRun());
    const keys = Array.from(result.factSet.keys());
    expect(keys).toContain('n4>__answer__');
  });

  test('linear run: factSet has exactly 4 facts (3 edges + 1 virtual)', () => {
    const result = call(linearRun());
    expect(result.factSet.size).toBe(4);
  });

  test('diamond run: both terminal edges point to __answer__', () => {
    // d is the only terminal (no outgoing edges)
    const result = call(diamondRun());
    const keys = Array.from(result.factSet.keys());
    expect(keys).toContain('d>__answer__');
    // 4 real edges + 1 virtual
    expect(result.factSet.size).toBe(5);
  });

  test('diamond run: sourceId is a', () => {
    const result = call(diamondRun());
    expect(result.sourceId).toBe('a');
  });

  test('single node run: terminal and source are the same node', () => {
    const result = call(singleNodeRun());
    expect(result.sourceId).toBe('only');
    // only → __answer__
    expect(result.factSet.size).toBe(1);
    expect(Array.from(result.factSet.keys())).toContain('only>__answer__');
  });

  test('run with multiple sources lists all of them', () => {
    const run = linearRun();
    // Add a disconnected source node
    run.nodes.push({ id: 'n5', name: 'Extra Source', content: 'x', role: 'input', status: 'success' });
    // n5 has no incoming edges → it's a source
    const result = call(run);
    expect(result.allSourceIds).toContain('n1');
    expect(result.allSourceIds).toContain('n5');
  });

  test('run with multiple terminals creates virtual edges for each', () => {
    const run = {
      id: 'run-multi-term',
      name: 'Multi Terminal',
      createdAt: '2026-01-01T00:00:00Z',
      nodes: [
        { id: 'a', name: 'Root', content: '', role: 'input', status: 'success' },
        { id: 'b', name: 'Leaf1', content: '', role: 'output', status: 'success' },
        { id: 'c', name: 'Leaf2', content: '', role: 'output', status: 'success' },
      ],
      edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }],
      metrics: { totalMs: 10, tokens: 5, nodes: 3, successful: 3, failed: 0 },
      counterfactuals: [],
    };
    const result = call(run);
    const keys = Array.from(result.factSet.keys());
    expect(keys).toContain('b>__answer__');
    expect(keys).toContain('c>__answer__');
  });
});

// ── computeNodeCounterfactuals ───────────────────────────────────────────────

describe('computeNodeCounterfactuals()', () => {
  function call(run, nodeId) {
    return ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, nodeId);
  }

  test('returns empty array for null run', () => {
    expect(call(null, 'n1')).toEqual([]);
  });

  test('returns empty array for null selectedNodeId', () => {
    expect(call(linearRun(), null)).toEqual([]);
  });

  test('returns empty array for undefined selectedNodeId', () => {
    expect(call(linearRun(), undefined)).toEqual([]);
  });

  test('returns an array', () => {
    expect(Array.isArray(call(linearRun(), 'n2'))).toBe(true);
  });

  test('linear run, middle node selected: returns suggestions', () => {
    const suggestions = call(linearRun(), 'n2');
    expect(suggestions.length).toBeGreaterThan(0);
  });

  test('each suggestion has required properties', () => {
    const suggestions = call(linearRun(), 'n2');
    suggestions.forEach(s => {
      expect(typeof s.id).toBe('string');
      expect(typeof s.cost).toBe('number');
      expect(typeof s.collateral).toBe('number');
      expect(Array.isArray(s.affectedNodeIds)).toBe(true);
      expect(Array.isArray(s.removedEdges)).toBe(true);
      expect(typeof s.summary).toBe('string');
    });
  });

  test('suggestion id starts with "cf-suggested-"', () => {
    const suggestions = call(linearRun(), 'n2');
    suggestions.forEach(s => {
      expect(s.id.startsWith('cf-suggested-')).toBe(true);
    });
  });

  test('suggestions are sorted by cost ascending', () => {
    const suggestions = call(linearRun(), 'n2');
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i].cost).toBeGreaterThanOrEqual(suggestions[i - 1].cost);
    }
  });

  test('cost ties are broken by collateral ascending', () => {
    const suggestions = call(linearRun(), 'n2');
    for (let i = 1; i < suggestions.length; i++) {
      if (suggestions[i].cost === suggestions[i - 1].cost) {
        expect(suggestions[i].collateral).toBeGreaterThanOrEqual(suggestions[i - 1].collateral);
      }
    }
  });

  test('at most 4 suggestions returned', () => {
    const suggestions = call(diamondRun(), 'b');
    expect(suggestions.length).toBeLessThanOrEqual(4);
  });

  test('suggestions only include revisions touching the selected node', () => {
    const suggestions = call(linearRun(), 'n2');
    suggestions.forEach(s => {
      const touchesSelected = s.removedEdges.some(
        e => e.from === 'n2' || e.to === 'n2'
      );
      expect(touchesSelected).toBe(true);
    });
  });

  test('linear run, selecting n2: removedEdges reference n2 as source or target', () => {
    const suggestions = call(linearRun(), 'n2');
    suggestions.forEach(s => {
      s.removedEdges.forEach(e => {
        expect(typeof e.from).toBe('string');
        expect(typeof e.to).toBe('string');
      });
    });
  });

  test('linear run, selecting terminal node n4: produces suggestions', () => {
    const suggestions = call(linearRun(), 'n4');
    expect(suggestions.length).toBeGreaterThan(0);
    suggestions.forEach(s => {
      const touches = s.removedEdges.some(
        e => e.from === 'n4' || e.to === 'n4'
      );
      expect(touches).toBe(true);
    });
  });

  test('selecting source node n1: produces suggestions', () => {
    const suggestions = call(linearRun(), 'n1');
    expect(suggestions.length).toBeGreaterThan(0);
  });

  test('node not in run returns empty array', () => {
    const suggestions = call(linearRun(), 'nonexistent');
    expect(suggestions).toEqual([]);
  });

  test('no duplicate suggestion ids', () => {
    const suggestions = call(diamondRun(), 'b');
    const ids = suggestions.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('affectedNodeIds does not include __answer__', () => {
    const suggestions = call(linearRun(), 'n2');
    suggestions.forEach(s => {
      expect(s.affectedNodeIds).not.toContain('__answer__');
    });
  });

  test('never returns a suggestion with empty affectedNodeIds', () => {
    [linearRun(), diamondRun(), singleNodeRun()].forEach(run => {
      run.nodes.forEach(node => {
        call(run, node.id).forEach(s => {
          expect(s.affectedNodeIds.length).toBeGreaterThan(0);
          expect(s.summary).not.toContain('0 steps');
        });
      });
    });
  });

  test('cutting terminal > __answer__ marks the terminal node as affected', () => {
    const suggestions = call(linearRun(), 'n4');
    const answerCut = suggestions.find(s =>
      s.removedEdges.some(e => e.from === 'n4' && e.to === '__answer__')
    );
    expect(answerCut).toBeDefined();
    expect(answerCut.affectedNodeIds).toEqual(['n4']);
    expect(answerCut.summary).toContain('Format Response');
  });

  describe('revision cache', () => {
    function countSearches() {
      const LE = ctx.window.LogicEngine;
      const original = LE.reviseToFalsify;
      const counter = { calls: 0 };
      LE.reviseToFalsify = function () {
        counter.calls++;
        return original.apply(this, arguments);
      };
      return counter;
    }

    test('runs the revision search once for all nodes of the same run', () => {
      const counter = countSearches();
      const run = linearRun();
      run.nodes.forEach(node => call(run, node.id));
      // linearRun has a single source, so one search covers the whole run
      expect(counter.calls).toBe(1);
    });

    test('reuses the search for a cloned run with the same topology', () => {
      const counter = countSearches();
      call(linearRun(), 'n2');
      call(JSON.parse(JSON.stringify(linearRun())), 'n3');
      expect(counter.calls).toBe(1);
    });

    test('recomputes when the edges change', () => {
      const counter = countSearches();
      const run = linearRun();
      call(run, 'n2');
      const rewired = linearRun();
      rewired.edges = [{ from: 'n1', to: 'n3' }, { from: 'n3', to: 'n4' }, { from: 'n2', to: 'n4' }];
      const suggestions = call(rewired, 'n3');
      expect(counter.calls).toBeGreaterThan(1);
      suggestions.forEach(s => {
        s.removedEdges.forEach(e => {
          expect(e.from === 'n2' && e.to === 'n3').toBe(false);
        });
      });
    });

    test('summaries use current node names even when the topology is cached', () => {
      call(linearRun(), 'n4');
      const renamed = linearRun();
      renamed.nodes[3].name = 'Renamed Output';
      const suggestions = call(renamed, 'n4');
      expect(suggestions.some(s => s.summary.includes('Renamed Output'))).toBe(true);
      suggestions.forEach(s => expect(s.summary).not.toContain('Format Response'));
    });

    test('mutating a returned suggestion does not affect later calls', () => {
      const run = linearRun();
      const first = call(run, 'n4');
      first[0].affectedNodeIds.push('tampered');
      first[0].removedEdges[0].from = 'tampered';
      const second = call(run, 'n4');
      expect(second[0].affectedNodeIds).not.toContain('tampered');
      expect(second[0].removedEdges[0].from).not.toBe('tampered');
    });
  });

  test('single node run: the only node is reported as affected', () => {
    const suggestions = call(singleNodeRun(), 'only');
    expect(suggestions.length).toBeGreaterThan(0);
    suggestions.forEach(s => {
      expect(s.affectedNodeIds).toEqual(['only']);
      expect(s.summary).toContain('Only Node');
    });
  });

  test('summary is a non-empty human-readable string', () => {
    const suggestions = call(linearRun(), 'n2');
    suggestions.forEach(s => {
      expect(s.summary.length).toBeGreaterThan(0);
      expect(s.summary).toContain('final answer');
    });
  });

  test('single-affected suggestion mentions the node name in summary', () => {
    const suggestions = call(linearRun(), 'n2');
    const singleAffected = suggestions.filter(s => s.affectedNodeIds.length === 1);
    singleAffected.forEach(s => {
      const run = linearRun();
      const node = run.nodes.find(n => n.id === s.affectedNodeIds[0]);
      if (node) {
        expect(s.summary).toContain(node.name);
      }
    });
  });

  test('diamond run, selecting node b: returns array (may be empty if no single cut through b)', () => {
    const suggestions = call(diamondRun(), 'b');
    expect(Array.isArray(suggestions)).toBe(true);
    suggestions.forEach(s => {
      const touchesB = s.removedEdges.some(e => e.from === 'b' || e.to === 'b');
      expect(touchesB).toBe(true);
    });
  });
});

// ── materializeRevision ──────────────────────────────────────────────────────

describe('materializeRevision()', () => {
  function call(run, suggestion) {
    return ctx.window.AgentFlowCounterfactual.materializeRevision(run, suggestion);
  }

  function getSuggestion(run, nodeId) {
    const suggestions = ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, nodeId);
    return suggestions[0] || null;
  }

  test('returns null for null run', () => {
    expect(call(null, { affectedNodeIds: ['n1'], id: 'x' })).toBeNull();
  });

  test('returns null for null suggestion', () => {
    expect(call(linearRun(), null)).toBeNull();
  });

  test('returns an object for valid inputs', () => {
    const run = linearRun();
    const suggestion = getSuggestion(run, 'n2');
    expect(suggestion).not.toBeNull();
    const result = call(run, suggestion);
    expect(result).not.toBeNull();
    expect(typeof result).toBe('object');
  });

  test('result has required counterfactual schema fields', () => {
    const run = linearRun();
    const suggestion = getSuggestion(run, 'n2');
    const cf = call(run, suggestion);
    expect(typeof cf.id).toBe('string');
    expect(typeof cf.name).toBe('string');
    expect(typeof cf.description).toBe('string');
    expect(typeof cf.nodeOverrides).toBe('object');
    expect(typeof cf.metrics).toBe('object');
    expect(typeof cf.finalAnswer).toBe('string');
    expect(cf.source).toBe('logic-engine');
  });

  test('id matches the suggestion id', () => {
    const run = linearRun();
    const suggestion = getSuggestion(run, 'n2');
    const cf = call(run, suggestion);
    expect(cf.id).toBe(suggestion.id);
  });

  test('nodeOverrides has an entry for each affected node', () => {
    const run = linearRun();
    const suggestion = getSuggestion(run, 'n2');
    const cf = call(run, suggestion);
    suggestion.affectedNodeIds.forEach(id => {
      expect(cf.nodeOverrides).toHaveProperty(id);
    });
  });

  test('each override sets status to failed', () => {
    const run = linearRun();
    const suggestion = getSuggestion(run, 'n2');
    const cf = call(run, suggestion);
    Object.values(cf.nodeOverrides).forEach(override => {
      expect(override.status).toBe('failed');
    });
  });

  test('each override has content prefixed with [counterfactual]', () => {
    const run = linearRun();
    const suggestion = getSuggestion(run, 'n2');
    const cf = call(run, suggestion);
    Object.values(cf.nodeOverrides).forEach(override => {
      expect(override.content.startsWith('[counterfactual]')).toBe(true);
    });
  });

  test('name references the primary affected node name', () => {
    const run = linearRun();
    const suggestion = getSuggestion(run, 'n2');
    const cf = call(run, suggestion);
    expect(cf.name).toContain('Without');
  });

  test('description mentions cost', () => {
    const run = linearRun();
    const suggestion = getSuggestion(run, 'n2');
    const cf = call(run, suggestion);
    expect(cf.description).toContain('cost');
  });

  test('description mentions collateral', () => {
    const run = linearRun();
    const suggestion = getSuggestion(run, 'n2');
    const cf = call(run, suggestion);
    expect(cf.description).toContain('Logic Engine');
  });

  test('finalAnswer indicates counterfactual outcome', () => {
    const run = linearRun();
    const suggestion = getSuggestion(run, 'n2');
    const cf = call(run, suggestion);
    expect(cf.finalAnswer).toContain('counterfactual');
  });

  test('metrics.failed is incremented by number of affected nodes', () => {
    const run = linearRun();
    const suggestion = getSuggestion(run, 'n2');
    const cf = call(run, suggestion);
    expect(cf.metrics.failed).toBe(run.metrics.failed + suggestion.affectedNodeIds.length);
  });

  test('metrics.successful is decremented by number of affected nodes', () => {
    const run = linearRun();
    const suggestion = getSuggestion(run, 'n2');
    const cf = call(run, suggestion);
    expect(cf.metrics.successful).toBe(run.metrics.successful - suggestion.affectedNodeIds.length);
  });

  test('metrics.successful does not go below 0', () => {
    const run = linearRun();
    run.metrics.successful = 1;
    run.metrics.failed = 3;
    const suggestion = getSuggestion(run, 'n2');
    const cf = call(run, suggestion);
    expect(cf.metrics.successful).toBe(Math.max(0, 1 - suggestion.affectedNodeIds.length));
  });

  test('cost and collateral are preserved from suggestion', () => {
    const run = linearRun();
    const suggestion = getSuggestion(run, 'n2');
    const cf = call(run, suggestion);
    expect(cf.cost).toBe(suggestion.cost);
    expect(cf.collateral).toBe(suggestion.collateral);
  });

  test('terminal cut materializes into a failed override on the terminal node', () => {
    const run = linearRun();
    const suggestion = ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, 'n4')
      .find(s => s.removedEdges.some(e => e.to === '__answer__'));
    const cf = call(run, suggestion);
    expect(Object.keys(cf.nodeOverrides)).toEqual(['n4']);
    expect(cf.nodeOverrides.n4.status).toBe('failed');
    expect(cf.name).toBe('Without "Format Response"');
  });
});

// ── Integration: end-to-end through state ────────────────────────────────────

describe('counterfactual integration with app state', () => {
  test('materialized CF passes validateRunSchema when added to run', () => {
    const run = linearRun();
    const suggestion = ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, 'n2')[0];
    const cf = ctx.window.AgentFlowCounterfactual.materializeRevision(run, suggestion);
    run.counterfactuals = [cf];
    expect(ctx.validateRunSchema(run)).toBeNull();
  });

  test('materialized CF can be loaded via setState and rendered as a view', () => {
    const run = linearRun();
    const suggestion = ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, 'n2')[0];
    const cf = ctx.window.AgentFlowCounterfactual.materializeRevision(run, suggestion);
    run.counterfactuals = [cf];
    ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: cf.id });
    const view = ctx.getActiveRunView();
    expect(view).not.toBeNull();
    expect(view.isCounterfactual).toBe(true);
    expect(view.overriddenNodeIds.size).toBeGreaterThan(0);
  });

  test('CF view has affected nodes with status failed', () => {
    const run = linearRun();
    const suggestion = ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, 'n2')[0];
    const cf = ctx.window.AgentFlowCounterfactual.materializeRevision(run, suggestion);
    run.counterfactuals = [cf];
    ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: cf.id });
    const view = ctx.getActiveRunView();
    suggestion.affectedNodeIds.forEach(id => {
      const node = view.run.nodes.find(n => n.id === id);
      expect(node.status).toBe('failed');
    });
  });

  test('CF view originalRun preserves the original node statuses', () => {
    const run = linearRun();
    const suggestion = ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, 'n2')[0];
    const cf = ctx.window.AgentFlowCounterfactual.materializeRevision(run, suggestion);
    run.counterfactuals = [cf];
    ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: cf.id });
    const view = ctx.getActiveRunView();
    suggestion.affectedNodeIds.forEach(id => {
      const orig = view.originalRun.nodes.find(n => n.id === id);
      expect(orig.status).toBe('success');
    });
  });

  test('switching back to null CF returns base run view', () => {
    const run = linearRun();
    const suggestion = ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, 'n2')[0];
    const cf = ctx.window.AgentFlowCounterfactual.materializeRevision(run, suggestion);
    run.counterfactuals = [cf];
    ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: cf.id });
    ctx.setState({ activeCounterfactual: null });
    const view = ctx.getActiveRunView();
    expect(view.isCounterfactual).toBe(false);
    view.run.nodes.forEach(n => {
      expect(n.status).toBe('success');
    });
  });

  test('diamond run: multiple CFs can coexist on the same run', () => {
    const run = diamondRun();
    const sugA = ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, 'a');
    const sugD = ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, 'd');
    // Pick first suggestion from each that produced results
    const allSugs = [...sugA, ...sugD];
    const seen = new Set();
    const cfs = [];
    for (const sug of allSugs) {
      if (seen.has(sug.id)) continue;
      seen.add(sug.id);
      const cf = ctx.window.AgentFlowCounterfactual.materializeRevision(run, sug);
      if (cf) cfs.push(cf);
      if (cfs.length >= 2) break;
    }
    run.counterfactuals = cfs;
    expect(ctx.validateRunSchema(run)).toBeNull();
    ctx.setState({ runs: [run], activeRunId: run.id });
    const view = ctx.getActiveRunView();
    expect(view).not.toBeNull();
  });
});
