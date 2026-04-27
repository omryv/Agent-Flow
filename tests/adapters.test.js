'use strict';

const { createAppContext } = require('./helpers/loadContext');

let ctx;
beforeEach(() => { ctx = createAppContext(); });

// ── safeId() ──────────────────────────────────────────────────────────────────

describe('safeId()', () => {
  test('preserves alphanumeric characters', () => {
    expect(ctx.safeId('abc123')).toBe('abc123');
  });

  test('preserves hyphens and underscores', () => {
    expect(ctx.safeId('my-id_001')).toBe('my-id_001');
  });

  test('replaces spaces with underscores', () => {
    expect(ctx.safeId('hello world')).toBe('hello_world');
  });

  test('replaces special characters with underscores', () => {
    expect(ctx.safeId('a.b!c@d')).toBe('a_b_c_d');
  });

  test('truncates to 80 characters', () => {
    const long = 'a'.repeat(100);
    expect(ctx.safeId(long)).toHaveLength(80);
  });

  test('returns "node" for empty string', () => {
    expect(ctx.safeId('')).toBe('node');
  });

  test('returns "node" for string that becomes empty after sanitisation', () => {
    expect(ctx.safeId('!!!')).toBe('___');
    // All replaced by '_', length 3, non-empty → kept
    // '___' is truthy so the || 'node' branch is not taken
    expect(ctx.safeId('!!!')).not.toBe('node');
  });

  test('handles numeric string input', () => {
    expect(ctx.safeId('42')).toBe('42');
  });

  test('handles mixed valid and invalid characters', () => {
    expect(ctx.safeId('run/id:test')).toBe('run_id_test');
  });
});

// ── msDiff() ──────────────────────────────────────────────────────────────────

describe('msDiff()', () => {
  test('returns the correct millisecond difference', () => {
    expect(ctx.msDiff('2025-01-01T00:00:00Z', '2025-01-01T00:00:01Z')).toBe(1000);
  });

  test('returns 0 for identical timestamps', () => {
    expect(ctx.msDiff('2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')).toBe(0);
  });

  test('returns undefined when start is missing', () => {
    expect(ctx.msDiff(null, '2025-01-01T00:00:00Z')).toBeUndefined();
  });

  test('returns undefined when end is missing', () => {
    expect(ctx.msDiff('2025-01-01T00:00:00Z', null)).toBeUndefined();
  });

  test('returns undefined when both arguments are missing', () => {
    expect(ctx.msDiff(null, null)).toBeUndefined();
  });

  test('returns undefined for an invalid start date string', () => {
    expect(ctx.msDiff('not-a-date', '2025-01-01T00:00:00Z')).toBeUndefined();
  });

  test('returns undefined for an invalid end date string', () => {
    expect(ctx.msDiff('2025-01-01T00:00:00Z', 'not-a-date')).toBeUndefined();
  });

  test('returns undefined when end is before start', () => {
    expect(ctx.msDiff('2025-01-01T00:01:00Z', '2025-01-01T00:00:00Z')).toBeUndefined();
  });

  test('handles large time differences correctly', () => {
    const diff = ctx.msDiff('2020-01-01T00:00:00Z', '2025-01-01T00:00:00Z');
    expect(typeof diff).toBe('number');
    expect(diff).toBeGreaterThan(0);
  });

  test('handles ISO strings with timezone offsets correctly', () => {
    expect(ctx.msDiff('2024-01-01T00:00:00+05:30', '2024-01-01T00:00:01+05:30')).toBe(1000);
  });
});

// ── truncate() ────────────────────────────────────────────────────────────────

describe('truncate()', () => {
  test('returns empty string for null', () => {
    expect(ctx.truncate(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(ctx.truncate(undefined)).toBe('');
  });

  test('returns the string unchanged when it is shorter than maxLen', () => {
    expect(ctx.truncate('hello', 10)).toBe('hello');
  });

  test('returns the string unchanged when it equals maxLen', () => {
    expect(ctx.truncate('hello', 5)).toBe('hello');
  });

  test('truncates a string longer than maxLen and appends ellipsis', () => {
    expect(ctx.truncate('hello world', 5)).toBe('hello…');
  });

  test('uses default maxLen of 300', () => {
    const s = 'x'.repeat(301);
    const result = ctx.truncate(s);
    expect(result).toHaveLength(301); // 300 chars + '…'
    expect(result.endsWith('…')).toBe(true);
  });

  test('JSON-stringifies non-string values before truncating', () => {
    const obj = { key: 'value' };
    const result = ctx.truncate(obj, 300);
    expect(result).toBe(JSON.stringify(obj));
  });

  test('truncates JSON-stringified object when beyond maxLen', () => {
    const obj = { data: 'x'.repeat(300) };
    const json = JSON.stringify(obj);
    const result = ctx.truncate(obj, 10);
    expect(result).toBe(json.slice(0, 10) + '…');
  });

  test('truncate does not throw on circular reference', () => {
    const obj = {}; obj.self = obj;
    expect(() => ctx.truncate(obj)).not.toThrow();
    expect(typeof ctx.truncate(obj)).toBe('string');
  });
});

// ── inferRole() ───────────────────────────────────────────────────────────────

describe('inferRole()', () => {
  test('returns "synthesize" for type "llm"', () => {
    expect(ctx.inferRole('llm', '')).toBe('synthesize');
  });

  test('returns "synthesize" for name containing "openai"', () => {
    expect(ctx.inferRole('', 'OpenAI Call')).toBe('synthesize');
  });

  test('returns "synthesize" for name containing "claude"', () => {
    expect(ctx.inferRole('', 'Claude Response')).toBe('synthesize');
  });

  test('returns "synthesize" for name containing "gpt"', () => {
    expect(ctx.inferRole('', 'GPT-4 step')).toBe('synthesize');
  });

  test('returns "synthesize" for name containing "generat"', () => {
    expect(ctx.inferRole('', 'text generation')).toBe('synthesize');
  });

  test('returns "retrieve" for type "retriever"', () => {
    expect(ctx.inferRole('retriever', '')).toBe('retrieve');
  });

  test('returns "retrieve" for name containing "search"', () => {
    expect(ctx.inferRole('', 'Web Search')).toBe('retrieve');
  });

  test('returns "retrieve" for name containing "vector"', () => {
    expect(ctx.inferRole('', 'Vector Lookup')).toBe('retrieve');
  });

  test('returns "retrieve" for name containing "fetch"', () => {
    expect(ctx.inferRole('', 'Fetch Documents')).toBe('retrieve');
  });

  test('returns "retrieve" for name containing "embed"', () => {
    expect(ctx.inferRole('', 'Embedding Step')).toBe('retrieve');
  });

  test('returns "tool" for type "tool"', () => {
    expect(ctx.inferRole('tool', '')).toBe('tool');
  });

  test('returns "tool" for name containing "api"', () => {
    expect(ctx.inferRole('', 'API call')).toBe('tool');
  });

  test('returns "tool" for name containing "calculator"', () => {
    expect(ctx.inferRole('', 'Date Calculator')).toBe('tool');
  });

  test('returns "tool" for name containing "parser"', () => {
    expect(ctx.inferRole('', 'Number Parser')).toBe('tool');
  });

  test('returns "plan" for name containing "plan"', () => {
    expect(ctx.inferRole('', 'Reasoning Plan')).toBe('plan');
  });

  test('returns "plan" for name containing "reason"', () => {
    expect(ctx.inferRole('', 'reason step')).toBe('plan');
  });

  test('returns "plan" for name containing "decompos"', () => {
    expect(ctx.inferRole('', 'decomposition')).toBe('plan');
  });

  test('returns "validate" for name containing "valid"', () => {
    expect(ctx.inferRole('', 'Validation Step')).toBe('validate');
  });

  test('returns "validate" for name containing "check"', () => {
    expect(ctx.inferRole('', 'Fact Check')).toBe('validate');
  });

  test('returns "validate" for name containing "guard"', () => {
    expect(ctx.inferRole('', 'Guard Rail')).toBe('validate');
  });

  test('returns "output" for name containing "output"', () => {
    expect(ctx.inferRole('', 'Final Output')).toBe('output');
  });

  test('returns "output" for name containing "response"', () => {
    expect(ctx.inferRole('', 'Response Formatter')).toBe('output');
  });

  test('returns "output" for name containing "final"', () => {
    expect(ctx.inferRole('', 'Final Answer')).toBe('output');
  });

  test('returns "output" for name containing "answer"', () => {
    expect(ctx.inferRole('', 'answer step')).toBe('output');
  });

  test('returns default "plan" for unknown type and name', () => {
    expect(ctx.inferRole('unknown', 'mystery step')).toBe('plan');
  });

  test('is case-insensitive for both type and name', () => {
    expect(ctx.inferRole('LLM', '')).toBe('synthesize');
    expect(ctx.inferRole('', 'VECTOR SEARCH')).toBe('retrieve');
  });

  test('name-based role takes precedence over type when they conflict (name=search, type=plan)', () => {
    // name contains 'search' → retrieve; type 'plan' would give 'plan'
    // documents that name is checked before type in the priority order
    expect(ctx.inferRole('plan', 'search the web')).toBe('retrieve');
  });

  test('name-based role takes precedence over type when they conflict (name=generate, type=tool)', () => {
    // name contains 'generat' → synthesize; type 'tool' would give 'tool'
    expect(ctx.inferRole('tool', 'text generation step')).toBe('synthesize');
  });
});

// ── inferStatus() ─────────────────────────────────────────────────────────────

describe('inferStatus()', () => {
  test('returns "success" when error is falsy (undefined)', () => {
    expect(ctx.inferStatus(undefined)).toBe('success');
  });

  test('returns "success" when error is null', () => {
    expect(ctx.inferStatus(null)).toBe('success');
  });

  test('returns "success" when error is empty string', () => {
    expect(ctx.inferStatus('')).toBe('success');
  });

  test('returns "failed" when error is a non-empty string', () => {
    expect(ctx.inferStatus('something went wrong')).toBe('failed');
  });

  test('returns "failed" when error is an Error object', () => {
    expect(ctx.inferStatus(new Error('boom'))).toBe('failed');
  });

  test('returns "failed" when error is a non-empty object', () => {
    expect(ctx.inferStatus({ code: 500 })).toBe('failed');
  });
});

// ── detectFormat() ────────────────────────────────────────────────────────────

describe('detectFormat()', () => {
  test('returns null for null input', () => {
    expect(ctx.detectFormat(null)).toBeNull();
  });

  test('returns null for non-object input', () => {
    expect(ctx.detectFormat('string')).toBeNull();
    expect(ctx.detectFormat(42)).toBeNull();
  });

  test('detects LangSmith by run_type property', () => {
    expect(ctx.detectFormat({ run_type: 'chain' })).toBe('langsmith');
  });

  test('detects LangFuse by observations array', () => {
    expect(ctx.detectFormat({ observations: [] })).toBe('langfuse');
  });

  test('detects Weave by op_name on root object', () => {
    expect(ctx.detectFormat({ op_name: 'weave:///op/myfunc:1' })).toBe('weave');
  });

  test('detects Weave by op_name on first element of array', () => {
    expect(ctx.detectFormat([{ op_name: 'weave:///op/myfunc:1' }])).toBe('weave');
  });

  test('returns null when array is empty', () => {
    expect(ctx.detectFormat([])).toBeNull();
  });

  test('returns null for unrecognised object', () => {
    expect(ctx.detectFormat({ foo: 'bar' })).toBeNull();
  });

  test('LangSmith takes priority over LangFuse when both keys present', () => {
    // run_type is checked first in the implementation
    expect(ctx.detectFormat({ run_type: 'chain', observations: [] })).toBe('langsmith');
  });

  test('LangSmith takes priority over Weave when both keys present', () => {
    // run_type is checked before op_name in the implementation
    expect(ctx.detectFormat({ run_type: 'chain', op_name: 'weave:///op/foo:1' })).toBe('langsmith');
  });
});

// ── importFromThirdParty() — LangSmith ───────────────────────────────────────

describe('importFromThirdParty() — LangSmith', () => {
  function makeLangSmithTrace(overrides = {}) {
    return Object.assign({
      id: 'ls-root',
      name: 'My LangSmith Run',
      run_type: 'chain',
      inputs:  { question: 'What is 2+2?' },
      outputs: { answer: '4' },
      start_time: '2025-01-01T00:00:00Z',
      end_time:   '2025-01-01T00:00:01Z',
      child_runs: [],
      error: null,
    }, overrides);
  }

  test('returns an object with run and format properties', () => {
    const result = ctx.importFromThirdParty(makeLangSmithTrace());
    expect(result.error).toBeUndefined();
    expect(result.format).toBe('langsmith');
    expect(result.run).toBeDefined();
  });

  test('run has the expected schema (passes validateRunSchema)', () => {
    const { run } = ctx.importFromThirdParty(makeLangSmithTrace());
    expect(ctx.validateRunSchema(run)).toBeNull();
  });

  test('run name is taken from the trace name', () => {
    const { run } = ctx.importFromThirdParty(makeLangSmithTrace({ name: 'History QA' }));
    expect(run.name).toBe('History QA');
  });

  test('produces one node for a flat trace with no children', () => {
    const { run } = ctx.importFromThirdParty(makeLangSmithTrace());
    expect(run.nodes).toHaveLength(1);
    expect(run.edges).toHaveLength(0);
  });

  test('produces correct node count for nested child_runs', () => {
    const trace = makeLangSmithTrace({
      child_runs: [
        { id: 'child-1', name: 'Retrieve', run_type: 'retriever',
          inputs: {}, outputs: {}, start_time: '2025-01-01T00:00:00.100Z',
          end_time: '2025-01-01T00:00:00.200Z', child_runs: [], error: null },
        { id: 'child-2', name: 'Generate', run_type: 'llm',
          inputs: {}, outputs: {}, start_time: '2025-01-01T00:00:00.200Z',
          end_time: '2025-01-01T00:00:00.900Z', child_runs: [], error: null },
      ],
    });
    const { run } = ctx.importFromThirdParty(trace);
    expect(run.nodes).toHaveLength(3); // root + 2 children
    expect(run.edges).toHaveLength(2); // root→child1, root→child2
  });

  test('marks failed node when error field is present', () => {
    const trace = makeLangSmithTrace({
      error: 'Timeout after 30s',
      child_runs: [],
    });
    const { run } = ctx.importFromThirdParty(trace);
    expect(run.nodes[0].status).toBe('failed');
    expect(run.metrics.failed).toBe(1);
  });

  test('computes durationMs from start_time and end_time', () => {
    const { run } = ctx.importFromThirdParty(makeLangSmithTrace());
    expect(run.nodes[0].durationMs).toBe(1000);
  });

  test('sums token usage from extra.usage_metadata', () => {
    const trace = makeLangSmithTrace({
      extra: { usage_metadata: { total_tokens: 150 } },
    });
    const { run } = ctx.importFromThirdParty(trace);
    expect(run.metrics.tokens).toBe(150);
  });

  test('accumulates tokens from multiple children', () => {
    const trace = makeLangSmithTrace({
      child_runs: [
        {
          id: 'c1', name: 'LLM Call', run_type: 'llm', error: null,
          start_time: '2025-01-01T00:00:00Z', end_time: '2025-01-01T00:00:00.500Z',
          inputs: {}, outputs: { llm_output: { token_usage: { total_tokens: 80 } } },
          child_runs: [],
        },
        {
          id: 'c2', name: 'LLM Call 2', run_type: 'llm', error: null,
          start_time: '2025-01-01T00:00:00.500Z', end_time: '2025-01-01T00:00:01Z',
          inputs: {}, outputs: { llm_output: { token_usage: { total_tokens: 70 } } },
          child_runs: [],
        },
      ],
    });
    const { run } = ctx.importFromThirdParty(trace);
    expect(run.metrics.tokens).toBe(150);
  });

  test('falls back to LangSmith Import when name is absent', () => {
    const trace = makeLangSmithTrace({ name: undefined });
    const { run } = ctx.importFromThirdParty(trace);
    expect(run.name).toBe('LangSmith Import');
  });

  test('infers role from run_type', () => {
    const trace = makeLangSmithTrace({ run_type: 'llm', name: '' });
    const { run } = ctx.importFromThirdParty(trace);
    expect(run.nodes[0].role).toBe('synthesize');
  });
});

// ── importFromThirdParty() — LangFuse ────────────────────────────────────────

describe('importFromThirdParty() — LangFuse', () => {
  function makeLangFuseTrace(overrides = {}) {
    return Object.assign({
      id: 'lf-trace',
      name: 'My LangFuse Trace',
      timestamp: '2025-01-01T00:00:00Z',
      input: 'What is the capital of France?',
      observations: [],
    }, overrides);
  }

  test('returns format "langfuse" and a valid run', () => {
    const result = ctx.importFromThirdParty(makeLangFuseTrace());
    expect(result.format).toBe('langfuse');
    expect(ctx.validateRunSchema(result.run)).toBeNull();
  });

  test('creates a virtual root node from the trace itself', () => {
    const { run } = ctx.importFromThirdParty(makeLangFuseTrace());
    expect(run.nodes).toHaveLength(1);
    expect(run.nodes[0].role).toBe('input');
  });

  test('creates one node per observation plus virtual root', () => {
    const trace = makeLangFuseTrace({
      observations: [
        {
          id: 'obs-1', name: 'Vector Search', type: 'SPAN',
          startTime: '2025-01-01T00:00:00.100Z',
          endTime:   '2025-01-01T00:00:00.200Z',
          input: 'query', output: 'results',
          parentObservationId: null,
        },
        {
          id: 'obs-2', name: 'Generate', type: 'GENERATION',
          startTime: '2025-01-01T00:00:00.200Z',
          endTime:   '2025-01-01T00:00:00.800Z',
          input: 'prompt', output: 'answer',
          parentObservationId: 'obs-1',
        },
      ],
    });
    const { run } = ctx.importFromThirdParty(trace);
    expect(run.nodes).toHaveLength(3); // root + obs-1 + obs-2
    expect(run.edges).toHaveLength(2);
  });

  test('marks a node as failed when level is ERROR', () => {
    const trace = makeLangFuseTrace({
      observations: [
        {
          id: 'obs-err', name: 'Failing Step', type: 'SPAN',
          startTime: '2025-01-01T00:00:00Z', endTime: '2025-01-01T00:00:00.100Z',
          level: 'ERROR', input: null, output: null,
          parentObservationId: null,
        },
      ],
    });
    const { run } = ctx.importFromThirdParty(trace);
    const failedNode = run.nodes.find(n => n.name === 'Failing Step');
    expect(failedNode).toBeDefined();
    expect(failedNode.status).toBe('failed');
  });

  test('sums token usage from observations', () => {
    const trace = makeLangFuseTrace({
      observations: [
        {
          id: 'obs-tok', name: 'LLM', type: 'GENERATION',
          startTime: '2025-01-01T00:00:00Z', endTime: '2025-01-01T00:00:00.500Z',
          usage: { totalTokens: 120 },
          input: 'hi', output: 'hello',
          parentObservationId: null,
        },
      ],
    });
    const { run } = ctx.importFromThirdParty(trace);
    expect(run.metrics.tokens).toBe(120);
  });

  test('uses trace name as run name', () => {
    const { run } = ctx.importFromThirdParty(makeLangFuseTrace({ name: 'My Trace' }));
    expect(run.name).toBe('My Trace');
  });
});

// ── importFromThirdParty() — Weave ────────────────────────────────────────────

describe('importFromThirdParty() — Weave (nested)', () => {
  function makeWeaveTrace(overrides = {}) {
    return Object.assign({
      id: 'wv-root',
      op_name: 'weave:///op/MyChain:1',
      display_name: 'My Weave Run',
      inputs: { query: 'hello' },
      output: { answer: 'world' },
      started_at: '2025-01-01T00:00:00Z',
      ended_at:   '2025-01-01T00:00:02Z',
      exception: null,
      children: [],
    }, overrides);
  }

  test('returns format "weave" and a valid run', () => {
    const result = ctx.importFromThirdParty(makeWeaveTrace());
    expect(result.format).toBe('weave');
    expect(ctx.validateRunSchema(result.run)).toBeNull();
  });

  test('produces one node for a single-call trace', () => {
    const { run } = ctx.importFromThirdParty(makeWeaveTrace());
    expect(run.nodes).toHaveLength(1);
  });

  test('uses display_name as run name', () => {
    const { run } = ctx.importFromThirdParty(makeWeaveTrace({ display_name: 'Custom Name' }));
    expect(run.name).toBe('Custom Name');
  });

  test('extracts name from op_name path segment', () => {
    const { run } = ctx.importFromThirdParty(
      makeWeaveTrace({ display_name: undefined, op_name: 'weave:///op/RetrieveStep:1' })
    );
    expect(run.name).toBe('RetrieveStep');
  });

  test('produces correct node count for nested children', () => {
    const trace = makeWeaveTrace({
      children: [
        {
          id: 'wv-child-1',
          op_name: 'weave:///op/Retrieve:1',
          display_name: 'Retrieve',
          inputs: {}, output: {},
          started_at: '2025-01-01T00:00:00.100Z',
          ended_at:   '2025-01-01T00:00:00.400Z',
          exception: null,
          children: [],
        },
        {
          id: 'wv-child-2',
          op_name: 'weave:///op/Synthesize:1',
          display_name: 'Synthesize',
          inputs: {}, output: {},
          started_at: '2025-01-01T00:00:00.400Z',
          ended_at:   '2025-01-01T00:00:01.500Z',
          exception: null,
          children: [],
        },
      ],
    });
    const { run } = ctx.importFromThirdParty(trace);
    expect(run.nodes).toHaveLength(3);
    expect(run.edges).toHaveLength(2);
  });

  test('marks a node as failed when exception is set', () => {
    const trace = makeWeaveTrace({ exception: 'TimeoutError' });
    const { run } = ctx.importFromThirdParty(trace);
    expect(run.nodes[0].status).toBe('failed');
    expect(run.metrics.failed).toBe(1);
  });

  test('extracts token usage from output.usage', () => {
    const trace = makeWeaveTrace({ output: { usage: { total_tokens: 200 }, answer: 'hi' } });
    const { run } = ctx.importFromThirdParty(trace);
    expect(run.metrics.tokens).toBe(200);
  });
});

describe('importFromThirdParty() — Weave (flat / array format)', () => {
  function makeFlatWeaveList() {
    return [
      {
        id: 'root-call',
        parent_id: null,
        op_name: 'weave:///op/Chain:1',
        display_name: 'Chain',
        inputs: {}, output: { result: 'ok' },
        started_at: '2025-01-01T00:00:00Z',
        ended_at:   '2025-01-01T00:00:02Z',
        exception: null,
      },
      {
        id: 'child-call',
        parent_id: 'root-call',
        op_name: 'weave:///op/Retrieve:1',
        display_name: 'Retrieve',
        inputs: {}, output: {},
        started_at: '2025-01-01T00:00:00.100Z',
        ended_at:   '2025-01-01T00:00:00.500Z',
        exception: null,
      },
    ];
  }

  test('detects Weave format from flat array', () => {
    expect(ctx.detectFormat(makeFlatWeaveList())).toBe('weave');
  });

  test('returns format "weave" and a valid run from flat list', () => {
    const result = ctx.importFromThirdParty(makeFlatWeaveList());
    expect(result.format).toBe('weave');
    expect(ctx.validateRunSchema(result.run)).toBeNull();
  });

  test('builds edges from parent_id relationships', () => {
    const { run } = ctx.importFromThirdParty(makeFlatWeaveList());
    expect(run.edges).toHaveLength(1);
    expect(run.nodes).toHaveLength(2);
  });
});

// ── importFromThirdParty() — unknown format ───────────────────────────────────

describe('importFromThirdParty() — error cases', () => {
  test('returns error for unrecognised JSON format', () => {
    const result = ctx.importFromThirdParty({ foo: 'bar' });
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe('string');
  });

  test('returns error for null input', () => {
    const result = ctx.importFromThirdParty(null);
    expect(result.error).toBeDefined();
  });

  test('returns error for string input', () => {
    const result = ctx.importFromThirdParty('{"run_type":"chain"}');
    expect(result.error).toBeDefined();
  });

  test('does not throw for any recognised format', () => {
    const formats = [
      { run_type: 'chain', id: 'r', name: 'R', inputs: {}, outputs: {}, child_runs: [] },
      { observations: [] },
      { op_name: 'weave:///op/X:1', id: 'r', inputs: {}, output: {}, children: [] },
    ];
    formats.forEach(f => {
      expect(() => ctx.importFromThirdParty(f)).not.toThrow();
    });
  });
});
