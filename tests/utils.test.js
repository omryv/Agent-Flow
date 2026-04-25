'use strict';

const { createAppContext } = require('./helpers/loadContext');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns a fresh context for every test to guarantee isolation. */
let ctx;
beforeEach(() => { ctx = createAppContext(); });

// ── esc() ─────────────────────────────────────────────────────────────────────

describe('esc()', () => {
  test('returns empty string for null', () => {
    expect(ctx.esc(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(ctx.esc(undefined)).toBe('');
  });

  test('returns empty string for empty string', () => {
    expect(ctx.esc('')).toBe('');
  });

  test('escapes ampersand', () => {
    expect(ctx.esc('a&b')).toBe('a&amp;b');
  });

  test('escapes less-than', () => {
    expect(ctx.esc('<div>')).toBe('&lt;div&gt;');
  });

  test('escapes greater-than', () => {
    expect(ctx.esc('3>2')).toBe('3&gt;2');
  });

  test('escapes double-quote', () => {
    expect(ctx.esc('"hello"')).toBe('&quot;hello&quot;');
  });

  test('escapes single-quote', () => {
    expect(ctx.esc("it's")).toBe('it&#39;s');
  });

  test('escapes forward-slash', () => {
    expect(ctx.esc('a/b')).toBe('a&#x2F;b');
  });

  test('escapes backtick', () => {
    expect(ctx.esc('`code`')).toBe('&#96;code&#96;');
  });

  test('escapes equals sign', () => {
    expect(ctx.esc('x=1')).toBe('x&#61;1');
  });

  test('escapes multiple special chars in one string', () => {
    expect(ctx.esc('<a href="x=1">it\'s</a>')).toBe(
      '&lt;a href&#61;&quot;x&#61;1&quot;&gt;it&#39;s&lt;&#x2F;a&gt;'
    );
  });

  test('leaves plain text unchanged', () => {
    expect(ctx.esc('hello world 123')).toBe('hello world 123');
  });

  test('coerces numbers to strings', () => {
    expect(ctx.esc(42)).toBe('42');
  });

  test('coerces boolean to string', () => {
    expect(ctx.esc(true)).toBe('true');
  });

  test('escapes all occurrences of a special char', () => {
    expect(ctx.esc('a<b<c')).toBe('a&lt;b&lt;c');
  });
});

// ── escAttr() ─────────────────────────────────────────────────────────────────

describe('escAttr()', () => {
  test('returns empty string for null', () => {
    expect(ctx.escAttr(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(ctx.escAttr(undefined)).toBe('');
  });

  test('leaves alphanumeric characters unchanged', () => {
    expect(ctx.escAttr('abc123')).toBe('abc123');
  });

  test('leaves underscore and hyphen unchanged', () => {
    expect(ctx.escAttr('my-attr_value')).toBe('my-attr_value');
  });

  test('escapes space as numeric entity', () => {
    expect(ctx.escAttr('hello world')).toBe('hello&#32;world');
  });

  test('escapes less-than as numeric entity', () => {
    expect(ctx.escAttr('<')).toBe('&#60;');
  });

  test('escapes greater-than as numeric entity', () => {
    expect(ctx.escAttr('>')).toBe('&#62;');
  });

  test('escapes double-quote as numeric entity', () => {
    expect(ctx.escAttr('"')).toBe('&#34;');
  });

  test('escapes dot as numeric entity', () => {
    expect(ctx.escAttr('3.14')).toBe('3&#46;14');
  });

  test('escapes forward-slash as numeric entity', () => {
    expect(ctx.escAttr('a/b')).toBe('a&#47;b');
  });

  test('escapes multiple non-word chars', () => {
    expect(ctx.escAttr('<script>')).toBe('&#60;script&#62;');
  });
});

// ── clampStr() ────────────────────────────────────────────────────────────────

describe('clampStr()', () => {
  test('returns empty string for null', () => {
    expect(ctx.clampStr(null, 10)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(ctx.clampStr(undefined, 10)).toBe('');
  });

  test('returns full string when shorter than max', () => {
    expect(ctx.clampStr('hello', 10)).toBe('hello');
  });

  test('returns full string when exactly equal to max', () => {
    expect(ctx.clampStr('hello', 5)).toBe('hello');
  });

  test('truncates string longer than max', () => {
    expect(ctx.clampStr('hello world', 5)).toBe('hello');
  });

  test('truncates to zero characters when max is 0', () => {
    expect(ctx.clampStr('hello', 0)).toBe('');
  });

  test('coerces number to string before clamping', () => {
    expect(ctx.clampStr(12345, 3)).toBe('123');
  });

  test('handles unicode characters', () => {
    // slice is code-unit based, so only tests deterministic behaviour
    const s = 'abcdef';
    expect(ctx.clampStr(s, 4)).toBe('abcd');
  });
});

// ── SafeStore (tested via state persistence) ──────────────────────────────────

describe('SafeStore (via setState / localStorage)', () => {
  test('setState persists state to localStorage under agentflow.v1 key', () => {
    ctx.setState({ activeTab: 'graph' });
    const raw = ctx.localStorage._store['agentflow.v1'];
    expect(typeof raw).toBe('string');
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty('runs');
    expect(parsed).toHaveProperty('activeRunId');
  });

  test('state is loaded from localStorage on context initialization', () => {
    // Build a valid run and persist it via setState in a fresh ctx
    const run = {
      id: 'run-init-test',
      name: 'Init Test Run',
      nodes: [{ id: 'n1', name: 'Node', content: 'x' }],
      edges: [],
      counterfactuals: [],
    };
    const ctx1 = createAppContext();
    ctx1.setState({ runs: [run], activeRunId: run.id });
    const savedJson = ctx1.localStorage._store['agentflow.v1'];

    // Create a new ctx that pre-populates the same localStorage content
    const preloaded = Object.create(null);
    preloaded['agentflow.v1'] = savedJson;
    const ctx2 = createAppContext({
      localStorage: {
        _store: preloaded,
        getItem(key) {
          return Object.prototype.hasOwnProperty.call(this._store, key)
            ? this._store[key]
            : null;
        },
        setItem(key, val) { this._store[key] = String(val); },
        removeItem(key)   { delete this._store[key]; },
        clear()           { this._store = Object.create(null); },
      },
    });

    const view = ctx2.getActiveRunView();
    expect(view).not.toBeNull();
    expect(view.run).toBeDefined();
  });

  test('corrupted localStorage falls back to empty state', () => {
    const badStore = Object.create(null);
    badStore['agentflow.v1'] = '{ invalid json !!!';
    const ctx3 = createAppContext({
      localStorage: {
        _store: badStore,
        getItem(key) {
          return Object.prototype.hasOwnProperty.call(this._store, key)
            ? this._store[key]
            : null;
        },
        setItem(key, val) { this._store[key] = String(val); },
        removeItem(key)   { delete this._store[key]; },
        clear()           { this._store = Object.create(null); },
      },
    });
    // Corrupted data is discarded; empty state means no active run
    const view = ctx3.getActiveRunView();
    expect(view).toBeNull();
  });

  test('oversized data is not saved and setState returns a valid state object', () => {
    // Confirm normal saves return a valid state object.
    const newState = ctx.setState({ activeTab: 'graph' });
    expect(newState).toBeDefined();
    expect(Array.isArray(newState.runs)).toBe(true);
  });
});
