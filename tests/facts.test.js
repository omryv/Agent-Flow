'use strict';

const {
  Fact,
  Query,
  parseFacts,
  factSetUnion,
  factSetDifference,
  factSetEquals,
} = require('./helpers/engine');

// ── Fact construction ─────────────────────────────────────────────────────────

describe('Fact construction', () => {
  test('constructs with valid string source and target', () => {
    const f = new Fact('a', 'b');
    expect(f.source).toBe('a');
    expect(f.target).toBe('b');
  });

  test('key is source>target', () => {
    const f = new Fact('x', 'y');
    expect(f.key).toBe('x>y');
  });

  test('toString returns "source > target"', () => {
    const f = new Fact('x', 'y');
    expect(f.toString()).toBe('x > y');
  });

  test('is frozen after construction', () => {
    const f = new Fact('a', 'b');
    expect(Object.isFrozen(f)).toBe(true);
  });

  test('throws TypeError when source is not a string', () => {
    expect(() => new Fact(1, 'b')).toThrow(TypeError);
  });

  test('throws TypeError when target is not a string', () => {
    expect(() => new Fact('a', null)).toThrow(TypeError);
  });
});

// ── Fact.parse ────────────────────────────────────────────────────────────────

describe('Fact.parse', () => {
  test('parses well-formed "a > b"', () => {
    const f = Fact.parse('a > b');
    expect(f.source).toBe('a');
    expect(f.target).toBe('b');
  });

  test('parses without spaces "a>b"', () => {
    const f = Fact.parse('a>b');
    expect(f.source).toBe('a');
    expect(f.target).toBe('b');
  });

  test('trims whitespace from names', () => {
    const f = Fact.parse('  foo  >  bar  ');
    expect(f.source).toBe('foo');
    expect(f.target).toBe('bar');
  });

  test('throws when input is not a string', () => {
    expect(() => Fact.parse(42)).toThrow(TypeError);
  });

  test('throws when ">" is absent', () => {
    expect(() => Fact.parse('ab')).toThrow(Error);
  });

  test('throws when more than one ">" is present', () => {
    expect(() => Fact.parse('a>b>c')).toThrow(Error);
  });

  test('throws when source is empty after trim', () => {
    expect(() => Fact.parse(' > b')).toThrow(Error);
  });

  test('throws when target is empty after trim', () => {
    expect(() => Fact.parse('a > ')).toThrow(Error);
  });

  test('returns a Fact instance', () => {
    expect(Fact.parse('a > b')).toBeInstanceOf(Fact);
  });
});

// ── Query construction ────────────────────────────────────────────────────────

describe('Query construction', () => {
  test('constructs with valid strings', () => {
    const q = new Query('src', 'tgt');
    expect(q.source).toBe('src');
    expect(q.target).toBe('tgt');
  });

  test('key is source>target', () => {
    const q = new Query('src', 'tgt');
    expect(q.key).toBe('src>tgt');
  });

  test('toString returns "source > target"', () => {
    const q = new Query('src', 'tgt');
    expect(q.toString()).toBe('src > tgt');
  });

  test('is frozen after construction', () => {
    const q = new Query('a', 'b');
    expect(Object.isFrozen(q)).toBe(true);
  });

  test('throws TypeError when source is not a string', () => {
    expect(() => new Query(null, 'b')).toThrow(TypeError);
  });

  test('throws TypeError when target is not a string', () => {
    expect(() => new Query('a', undefined)).toThrow(TypeError);
  });
});

// ── Query.parse ───────────────────────────────────────────────────────────────

describe('Query.parse', () => {
  test('parses well-formed string', () => {
    const q = Query.parse('src > tgt');
    expect(q.source).toBe('src');
    expect(q.target).toBe('tgt');
  });

  test('returns a Query instance', () => {
    expect(Query.parse('a > b')).toBeInstanceOf(Query);
  });

  test('throws when input is not a string', () => {
    expect(() => Query.parse({})).toThrow(TypeError);
  });

  test('throws when ">" is absent', () => {
    expect(() => Query.parse('ab')).toThrow(Error);
  });

  test('throws when more than one ">" present', () => {
    expect(() => Query.parse('a>b>c')).toThrow(Error);
  });
});

// ── parseFacts ────────────────────────────────────────────────────────────────

describe('parseFacts', () => {
  test('returns a Map', () => {
    const m = parseFacts(['a > b', 'b > c']);
    expect(m).toBeInstanceOf(Map);
  });

  test('map is keyed by canonical key', () => {
    const m = parseFacts(['a > b']);
    expect(m.has('a>b')).toBe(true);
  });

  test('accepts Fact instances directly', () => {
    const f = new Fact('x', 'y');
    const m = parseFacts([f]);
    expect(m.get('x>y')).toBe(f);
  });

  test('deduplicates identical facts', () => {
    const m = parseFacts(['a > b', 'a > b']);
    expect(m.size).toBe(1);
  });

  test('handles empty input', () => {
    const m = parseFacts([]);
    expect(m.size).toBe(0);
  });

  test('stores Fact instances as values', () => {
    const m = parseFacts(['a > b']);
    expect(m.get('a>b')).toBeInstanceOf(Fact);
  });
});

// ── factSetUnion ──────────────────────────────────────────────────────────────

describe('factSetUnion', () => {
  test('combines disjoint sets', () => {
    const a = parseFacts(['a > b']);
    const b = parseFacts(['c > d']);
    const result = factSetUnion(a, b);
    expect(result.size).toBe(2);
    expect(result.has('a>b')).toBe(true);
    expect(result.has('c>d')).toBe(true);
  });

  test('b overwrites a on key collision', () => {
    const fa = new Fact('a', 'b');
    const fb = new Fact('a', 'b');
    const a = new Map([['a>b', fa]]);
    const b = new Map([['a>b', fb]]);
    const result = factSetUnion(a, b);
    expect(result.get('a>b')).toBe(fb);
  });

  test('does not mutate a', () => {
    const a = parseFacts(['a > b']);
    const b = parseFacts(['c > d']);
    factSetUnion(a, b);
    expect(a.size).toBe(1);
  });

  test('returns new Map', () => {
    const a = parseFacts(['a > b']);
    const b = parseFacts(['c > d']);
    const result = factSetUnion(a, b);
    expect(result).not.toBe(a);
    expect(result).not.toBe(b);
  });
});

// ── factSetDifference ─────────────────────────────────────────────────────────

describe('factSetDifference', () => {
  test('removes keys present in b from a', () => {
    const a = parseFacts(['a > b', 'b > c']);
    const b = parseFacts(['a > b']);
    const result = factSetDifference(a, b);
    expect(result.has('a>b')).toBe(false);
    expect(result.has('b>c')).toBe(true);
  });

  test('keys in b not present in a are ignored', () => {
    const a = parseFacts(['a > b']);
    const b = parseFacts(['x > y']);
    const result = factSetDifference(a, b);
    expect(result.size).toBe(1);
  });

  test('does not mutate a', () => {
    const a = parseFacts(['a > b', 'b > c']);
    const b = parseFacts(['a > b']);
    factSetDifference(a, b);
    expect(a.size).toBe(2);
  });

  test('returns empty map when a and b are identical', () => {
    const a = parseFacts(['a > b']);
    const b = parseFacts(['a > b']);
    expect(factSetDifference(a, b).size).toBe(0);
  });
});

// ── factSetEquals ─────────────────────────────────────────────────────────────

describe('factSetEquals', () => {
  test('returns true for identical key sets', () => {
    const a = parseFacts(['a > b', 'b > c']);
    const b = parseFacts(['a > b', 'b > c']);
    expect(factSetEquals(a, b)).toBe(true);
  });

  test('returns false when sizes differ', () => {
    const a = parseFacts(['a > b']);
    const b = parseFacts(['a > b', 'b > c']);
    expect(factSetEquals(a, b)).toBe(false);
  });

  test('returns false when keys differ at same size', () => {
    const a = parseFacts(['a > b']);
    const b = parseFacts(['x > y']);
    expect(factSetEquals(a, b)).toBe(false);
  });

  test('returns true for two empty maps', () => {
    expect(factSetEquals(new Map(), new Map())).toBe(true);
  });
});
