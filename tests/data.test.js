'use strict';

const { createAppContext } = require('./helpers/loadContext');

let ctx;
beforeEach(() => { ctx = createAppContext(); });

// ── makeSampleData() ──────────────────────────────────────────────────────────

describe('makeSampleData()', () => {
  test('returns an object with a runs array', () => {
    const data = ctx.makeSampleData();
    expect(Array.isArray(data.runs)).toBe(true);
  });

  test('returns exactly two runs', () => {
    const data = ctx.makeSampleData();
    expect(data.runs).toHaveLength(2);
  });

  test('each run passes validateRunSchema', () => {
    const data = ctx.makeSampleData();
    data.runs.forEach(run => {
      expect(ctx.validateRunSchema(run)).toBeNull();
    });
  });

  test('first run has counterfactuals', () => {
    const { runs } = ctx.makeSampleData();
    expect(Array.isArray(runs[0].counterfactuals)).toBe(true);
    expect(runs[0].counterfactuals.length).toBeGreaterThan(0);
  });

  test('second run has an empty counterfactuals array', () => {
    const { runs } = ctx.makeSampleData();
    expect(runs[1].counterfactuals).toEqual([]);
  });

  test('activeRunId is set to the first run id', () => {
    const data = ctx.makeSampleData();
    expect(data.activeRunId).toBe(data.runs[0].id);
  });

  test('selectedNodeId is null', () => {
    expect(ctx.makeSampleData().selectedNodeId).toBeNull();
  });

  test('activeTab is "graph"', () => {
    expect(ctx.makeSampleData().activeTab).toBe('graph');
  });

  test('activeCounterfactual is null', () => {
    expect(ctx.makeSampleData().activeCounterfactual).toBeNull();
  });

  test('runs have nodes with the expected roles', () => {
    const validRoles = ['input', 'retrieve', 'plan', 'tool', 'synthesize', 'validate', 'output'];
    const { runs } = ctx.makeSampleData();
    runs.forEach(run => {
      run.nodes.forEach(node => {
        expect(validRoles).toContain(node.role);
      });
    });
  });

  test('runs have edges connecting existing node ids', () => {
    const { runs } = ctx.makeSampleData();
    runs.forEach(run => {
      const nodeIds = new Set(run.nodes.map(n => n.id));
      run.edges.forEach(e => {
        expect(nodeIds.has(e.from)).toBe(true);
        expect(nodeIds.has(e.to)).toBe(true);
      });
    });
  });

  test('runs have metrics with expected shape', () => {
    const { runs } = ctx.makeSampleData();
    runs.forEach(run => {
      expect(typeof run.metrics.totalMs).toBe('number');
      expect(typeof run.metrics.tokens).toBe('number');
      expect(typeof run.metrics.nodes).toBe('number');
      expect(typeof run.metrics.successful).toBe('number');
      expect(typeof run.metrics.failed).toBe('number');
    });
  });
});

// ── validateRunSchema() ───────────────────────────────────────────────────────

/** Minimal valid run fixture for building test variants. */
function minimalValidRun() {
  return {
    id: 'run-1',
    name: 'Test Run',
    nodes: [
      { id: 'n1', name: 'Node One', content: 'hello' },
    ],
    edges: [],
  };
}

describe('validateRunSchema() — happy path', () => {
  test('accepts a minimal valid run with no optional fields', () => {
    expect(ctx.validateRunSchema(minimalValidRun())).toBeNull();
  });

  test('accepts a run with full optional fields on nodes', () => {
    const run = minimalValidRun();
    run.nodes[0].role       = 'input';
    run.nodes[0].status     = 'success';
    run.nodes[0].durationMs = 100;
    expect(ctx.validateRunSchema(run)).toBeNull();
  });

  test('accepts a run with valid counterfactuals', () => {
    const run = Object.assign(minimalValidRun(), {
      counterfactuals: [
        {
          id: 'cf-1',
          name: 'Skip step',
          nodeOverrides: { n1: { status: 'skipped' } },
        },
      ],
    });
    expect(ctx.validateRunSchema(run)).toBeNull();
  });

  test('accepts empty nodes and edges arrays', () => {
    const run = { id: 'r1', name: 'Empty', nodes: [], edges: [] };
    expect(ctx.validateRunSchema(run)).toBeNull();
  });

  test('accepts valid edge', () => {
    const run = {
      id: 'r1',
      name: 'With Edge',
      nodes: [
        { id: 'n1', name: 'A', content: '' },
        { id: 'n2', name: 'B', content: '' },
      ],
      edges: [{ from: 'n1', to: 'n2' }],
    };
    expect(ctx.validateRunSchema(run)).toBeNull();
  });
});

describe('validateRunSchema() — root-level errors', () => {
  test('rejects null', () => {
    expect(ctx.validateRunSchema(null)).toBe('Root must be an object.');
  });

  test('rejects a string', () => {
    expect(ctx.validateRunSchema('hello')).toBe('Root must be an object.');
  });

  test('rejects an array — treated as an object missing id', () => {
    // Arrays pass typeof === 'object' and !== null, so the schema proceeds to
    // validate the id field (which is absent on an array), producing an id error.
    expect(ctx.validateRunSchema([])).toMatch(/invalid "id"/);
  });

  test('rejects missing id', () => {
    const run = minimalValidRun();
    delete run.id;
    expect(ctx.validateRunSchema(run)).toMatch(/invalid "id"/);
  });

  test('rejects id that fails SAFE_ID_RE (contains space)', () => {
    const run = Object.assign(minimalValidRun(), { id: 'run 1' });
    expect(ctx.validateRunSchema(run)).toMatch(/invalid "id"/);
  });

  test('rejects id longer than 80 characters', () => {
    const run = Object.assign(minimalValidRun(), { id: 'a'.repeat(81) });
    expect(ctx.validateRunSchema(run)).toMatch(/invalid "id"/);
  });

  test('rejects id that is not a string', () => {
    const run = Object.assign(minimalValidRun(), { id: 123 });
    expect(ctx.validateRunSchema(run)).toMatch(/invalid "id"/);
  });

  test('rejects missing name', () => {
    const run = minimalValidRun();
    delete run.name;
    expect(ctx.validateRunSchema(run)).toMatch(/"name"/);
  });

  test('rejects empty name', () => {
    const run = Object.assign(minimalValidRun(), { name: '' });
    expect(ctx.validateRunSchema(run)).toMatch(/"name"/);
  });

  test('rejects name longer than 200 characters', () => {
    const run = Object.assign(minimalValidRun(), { name: 'x'.repeat(201) });
    expect(ctx.validateRunSchema(run)).toMatch(/"name"/);
  });

  test('rejects nodes that is not an array', () => {
    const run = Object.assign(minimalValidRun(), { nodes: {} });
    expect(ctx.validateRunSchema(run)).toMatch(/"nodes"/);
  });

  test('rejects edges that is not an array', () => {
    const run = Object.assign(minimalValidRun(), { edges: null });
    expect(ctx.validateRunSchema(run)).toMatch(/"edges"/);
  });

  test('rejects more than 500 nodes', () => {
    const run = Object.assign(minimalValidRun(), {
      nodes: Array.from({ length: 501 }, (_, i) => ({
        id: `n${i}`, name: `Node ${i}`, content: '',
      })),
    });
    expect(ctx.validateRunSchema(run)).toMatch(/Too many nodes/);
  });

  test('rejects more than 2000 edges', () => {
    const run = Object.assign(minimalValidRun(), {
      edges: Array.from({ length: 2001 }, () => ({ from: 'n1', to: 'n1' })),
    });
    expect(ctx.validateRunSchema(run)).toMatch(/Too many edges/);
  });
});

describe('validateRunSchema() — node-level errors', () => {
  function runWithNode(nodeOverrides) {
    const run = minimalValidRun();
    run.nodes[0] = Object.assign({}, run.nodes[0], nodeOverrides);
    return run;
  }

  test('rejects node with missing id', () => {
    const run = runWithNode({ id: undefined });
    expect(ctx.validateRunSchema(run)).toMatch(/Node 0: invalid "id"/);
  });

  test('rejects node with id containing special chars', () => {
    const run = runWithNode({ id: 'bad id!' });
    expect(ctx.validateRunSchema(run)).toMatch(/Node 0: invalid "id"/);
  });

  test('rejects node with missing name', () => {
    const run = runWithNode({ name: '' });
    expect(ctx.validateRunSchema(run)).toMatch(/Node 0: invalid "name"/);
  });

  test('rejects node with name longer than 200 chars', () => {
    const run = runWithNode({ name: 'x'.repeat(201) });
    expect(ctx.validateRunSchema(run)).toMatch(/Node 0: invalid "name"/);
  });

  test('rejects node where content is not a string', () => {
    const run = runWithNode({ content: 42 });
    expect(ctx.validateRunSchema(run)).toMatch(/Node 0: "content" must be a string/);
  });

  test('rejects node with content longer than 10000 chars', () => {
    const run = runWithNode({ content: 'x'.repeat(10001) });
    expect(ctx.validateRunSchema(run)).toMatch(/Node 0: content too long/);
  });

  test('rejects node with unknown role', () => {
    const run = runWithNode({ role: 'wizard' });
    expect(ctx.validateRunSchema(run)).toMatch(/Node 0: invalid role/);
  });

  test('accepts node with no role (role is optional)', () => {
    const run = runWithNode({});
    delete run.nodes[0].role;
    expect(ctx.validateRunSchema(run)).toBeNull();
  });

  test('rejects node with unknown status', () => {
    const run = runWithNode({ status: 'unknown' });
    expect(ctx.validateRunSchema(run)).toMatch(/Node 0: invalid status/);
  });

  test('accepts node with no status (status is optional)', () => {
    const run = runWithNode({});
    delete run.nodes[0].status;
    expect(ctx.validateRunSchema(run)).toBeNull();
  });

  test('rejects node with negative durationMs', () => {
    const run = runWithNode({ durationMs: -1 });
    expect(ctx.validateRunSchema(run)).toMatch(/Node 0: invalid durationMs/);
  });

  test('rejects node with non-numeric durationMs', () => {
    const run = runWithNode({ durationMs: 'fast' });
    expect(ctx.validateRunSchema(run)).toMatch(/Node 0: invalid durationMs/);
  });

  test('accepts node with durationMs of 0', () => {
    const run = runWithNode({ durationMs: 0 });
    expect(ctx.validateRunSchema(run)).toBeNull();
  });
});

describe('validateRunSchema() — edge-level errors', () => {
  function runWithEdge(edgeOverrides) {
    const run = minimalValidRun();
    run.nodes.push({ id: 'n2', name: 'Node Two', content: '' });
    run.edges = [Object.assign({ from: 'n1', to: 'n2' }, edgeOverrides)];
    return run;
  }

  test('rejects edge with invalid from id', () => {
    const run = runWithEdge({ from: 'bad id' });
    expect(ctx.validateRunSchema(run)).toMatch(/Edge 0: invalid "from"/);
  });

  test('rejects edge with invalid to id', () => {
    const run = runWithEdge({ to: 'bad!to' });
    expect(ctx.validateRunSchema(run)).toMatch(/Edge 0: invalid "to"/);
  });

  test('rejects edge with non-string from', () => {
    const run = runWithEdge({ from: 123 });
    expect(ctx.validateRunSchema(run)).toMatch(/Edge 0: invalid "from"/);
  });
});

describe('validateRunSchema() — counterfactual errors', () => {
  test('rejects counterfactuals that is not an array', () => {
    const run = Object.assign(minimalValidRun(), { counterfactuals: {} });
    expect(ctx.validateRunSchema(run)).toMatch(/"counterfactuals" must be an array/);
  });

  test('rejects CF with invalid id', () => {
    const run = Object.assign(minimalValidRun(), {
      counterfactuals: [{ id: 'bad id!', name: 'x', nodeOverrides: {} }],
    });
    expect(ctx.validateRunSchema(run)).toMatch(/CF 0: invalid "id"/);
  });

  test('rejects CF with missing name', () => {
    const run = Object.assign(minimalValidRun(), {
      counterfactuals: [{ id: 'cf1', name: '', nodeOverrides: {} }],
    });
    expect(ctx.validateRunSchema(run)).toMatch(/CF 0: invalid "name"/);
  });

  test('rejects CF with missing nodeOverrides', () => {
    const run = Object.assign(minimalValidRun(), {
      counterfactuals: [{ id: 'cf1', name: 'CF', nodeOverrides: null }],
    });
    expect(ctx.validateRunSchema(run)).toMatch(/CF 0: invalid "nodeOverrides"/);
  });

  test('rejects CF where nodeOverrides is not an object', () => {
    const run = Object.assign(minimalValidRun(), {
      counterfactuals: [{ id: 'cf1', name: 'CF', nodeOverrides: 'bad' }],
    });
    expect(ctx.validateRunSchema(run)).toMatch(/CF 0: invalid "nodeOverrides"/);
  });
});
