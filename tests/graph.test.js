'use strict';

const {
  Fact,
  parseFacts,
  buildAdjacency,
  reachableFrom,
  isReachable,
  findPath,
  computeClosure,
  edgesOnPaths,
  setDifference,
} = require('./helpers/engine');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFacts(...strings) {
  return parseFacts(strings);
}

// ── buildAdjacency ────────────────────────────────────────────────────────────

describe('buildAdjacency', () => {
  test('returns a Map', () => {
    const facts = makeFacts('a > b');
    expect(buildAdjacency(facts)).toBeInstanceOf(Map);
  });

  test('source maps to a Set containing target', () => {
    const facts = makeFacts('a > b');
    const adj = buildAdjacency(facts);
    expect(adj.get('a').has('b')).toBe(true);
  });

  test('target node is present as a key with empty set when no outgoing edges', () => {
    const facts = makeFacts('a > b');
    const adj = buildAdjacency(facts);
    expect(adj.has('b')).toBe(true);
    expect(adj.get('b').size).toBe(0);
  });

  test('multiple edges from same source are all in the set', () => {
    const facts = makeFacts('a > b', 'a > c');
    const adj = buildAdjacency(facts);
    expect(adj.get('a').has('b')).toBe(true);
    expect(adj.get('a').has('c')).toBe(true);
  });

  test('empty facts returns empty map', () => {
    expect(buildAdjacency(new Map()).size).toBe(0);
  });
});

// ── reachableFrom ─────────────────────────────────────────────────────────────

describe('reachableFrom', () => {
  test('returns empty set when start has no outgoing edges', () => {
    const facts = makeFacts('a > b');
    const adj = buildAdjacency(facts);
    expect(reachableFrom(adj, 'b').size).toBe(0);
  });

  test('returns direct neighbour', () => {
    const facts = makeFacts('a > b');
    const adj = buildAdjacency(facts);
    expect(reachableFrom(adj, 'a').has('b')).toBe(true);
  });

  test('traverses transitively', () => {
    const facts = makeFacts('a > b', 'b > c', 'c > d');
    const adj = buildAdjacency(facts);
    const reached = reachableFrom(adj, 'a');
    expect(reached.has('b')).toBe(true);
    expect(reached.has('c')).toBe(true);
    expect(reached.has('d')).toBe(true);
  });

  test('does not include start node itself', () => {
    const facts = makeFacts('a > b');
    const adj = buildAdjacency(facts);
    expect(reachableFrom(adj, 'a').has('a')).toBe(false);
  });

  test('handles a cycle without infinite loop', () => {
    const facts = makeFacts('a > b', 'b > a');
    const adj = buildAdjacency(facts);
    const reached = reachableFrom(adj, 'a');
    expect(reached.has('b')).toBe(true);
    // terminates — jest timeout would catch an infinite loop
  });

  test('returns empty set for unknown start node', () => {
    const facts = makeFacts('a > b');
    const adj = buildAdjacency(facts);
    expect(reachableFrom(adj, 'z').size).toBe(0);
  });
});

// ── isReachable ───────────────────────────────────────────────────────────────

describe('isReachable', () => {
  test('returns true for direct edge', () => {
    expect(isReachable(makeFacts('a > b'), 'a', 'b')).toBe(true);
  });

  test('returns true for transitive path', () => {
    expect(isReachable(makeFacts('a > b', 'b > c'), 'a', 'c')).toBe(true);
  });

  test('returns false when no path exists', () => {
    expect(isReachable(makeFacts('a > b'), 'b', 'a')).toBe(false);
  });

  test('returns true when source equals target', () => {
    expect(isReachable(makeFacts('a > b'), 'a', 'a')).toBe(true);
  });

  test('returns false for disconnected graph', () => {
    expect(isReachable(makeFacts('a > b', 'c > d'), 'a', 'd')).toBe(false);
  });
});

// ── findPath ──────────────────────────────────────────────────────────────────

describe('findPath', () => {
  test('returns [source] when source equals target', () => {
    expect(findPath(makeFacts('a > b'), 'a', 'a')).toEqual(['a']);
  });

  test('returns two-node path for direct edge', () => {
    expect(findPath(makeFacts('a > b'), 'a', 'b')).toEqual(['a', 'b']);
  });

  test('returns multi-node path for transitive chain', () => {
    const facts = makeFacts('a > b', 'b > c', 'c > d');
    const path = findPath(facts, 'a', 'd');
    expect(path[0]).toBe('a');
    expect(path[path.length - 1]).toBe('d');
    expect(path.length).toBeGreaterThan(2);
  });

  test('returns null when no path exists', () => {
    expect(findPath(makeFacts('a > b'), 'b', 'a')).toBeNull();
  });

  test('path nodes are all valid node ids', () => {
    const facts = makeFacts('a > b', 'b > c');
    const path = findPath(facts, 'a', 'c');
    expect(path).toEqual(['a', 'b', 'c']);
  });
});

// ── computeClosure ────────────────────────────────────────────────────────────

describe('computeClosure', () => {
  test('returns a Set', () => {
    expect(computeClosure(makeFacts('a > b'))).toBeInstanceOf(Set);
  });

  test('reflexive entailment: every node entails itself', () => {
    const closure = computeClosure(makeFacts('a > b'));
    expect(closure.has('a>a')).toBe(true);
    expect(closure.has('b>b')).toBe(true);
  });

  test('direct edge produces entailment', () => {
    const closure = computeClosure(makeFacts('a > b'));
    expect(closure.has('a>b')).toBe(true);
  });

  test('transitive closure is computed', () => {
    const closure = computeClosure(makeFacts('a > b', 'b > c'));
    expect(closure.has('a>c')).toBe(true);
  });

  test('reverse direction is not entailed', () => {
    const closure = computeClosure(makeFacts('a > b'));
    expect(closure.has('b>a')).toBe(false);
  });

  test('universe parameter adds extra nodes as reflexive', () => {
    const facts = makeFacts('a > b');
    const u = new Set(['a', 'b', 'z']);
    const closure = computeClosure(facts, u);
    expect(closure.has('z>z')).toBe(true);
  });

  test('universe node not connected to others', () => {
    const facts = makeFacts('a > b');
    const u = new Set(['a', 'b', 'z']);
    const closure = computeClosure(facts, u);
    expect(closure.has('z>a')).toBe(false);
    expect(closure.has('a>z')).toBe(false);
  });
});

// ── edgesOnPaths ──────────────────────────────────────────────────────────────

describe('edgesOnPaths', () => {
  test('returns a Map', () => {
    expect(edgesOnPaths(makeFacts('a > b'), 'a', 'b')).toBeInstanceOf(Map);
  });

  test('includes the direct edge on a single-edge path', () => {
    const result = edgesOnPaths(makeFacts('a > b'), 'a', 'b');
    expect(result.has('a>b')).toBe(true);
  });

  test('includes all edges on a linear chain', () => {
    const facts = makeFacts('a > b', 'b > c', 'c > d');
    const result = edgesOnPaths(facts, 'a', 'd');
    expect(result.has('a>b')).toBe(true);
    expect(result.has('b>c')).toBe(true);
    expect(result.has('c>d')).toBe(true);
  });

  test('excludes edges not on any path to target', () => {
    // a->b->c->d, and also a->e (e leads nowhere toward d)
    const facts = makeFacts('a > b', 'b > c', 'c > d', 'a > e');
    const result = edgesOnPaths(facts, 'a', 'd');
    expect(result.has('a>e')).toBe(false);
  });

  test('returns empty map when source cannot reach target', () => {
    const facts = makeFacts('a > b', 'c > d');
    expect(edgesOnPaths(facts, 'a', 'd').size).toBe(0);
  });

  test('includes edges from both branches of a diamond', () => {
    // a -> b -> d
    // a -> c -> d
    const facts = makeFacts('a > b', 'a > c', 'b > d', 'c > d');
    const result = edgesOnPaths(facts, 'a', 'd');
    expect(result.has('a>b')).toBe(true);
    expect(result.has('a>c')).toBe(true);
    expect(result.has('b>d')).toBe(true);
    expect(result.has('c>d')).toBe(true);
  });
});

// ── setDifference ─────────────────────────────────────────────────────────────

describe('setDifference', () => {
  test('removes elements present in b', () => {
    const a = new Set(['x', 'y', 'z']);
    const b = new Set(['y']);
    const result = setDifference(a, b);
    expect(result.has('y')).toBe(false);
    expect(result.has('x')).toBe(true);
    expect(result.has('z')).toBe(true);
  });

  test('returns full copy of a when b is empty', () => {
    const a = new Set(['x', 'y']);
    const result = setDifference(a, new Set());
    expect(result.size).toBe(2);
  });

  test('returns empty set when a is subset of b', () => {
    const a = new Set(['x']);
    const b = new Set(['x', 'y']);
    expect(setDifference(a, b).size).toBe(0);
  });

  test('does not mutate a', () => {
    const a = new Set(['x', 'y']);
    const b = new Set(['x']);
    setDifference(a, b);
    expect(a.size).toBe(2);
  });

  test('returns a new Set instance', () => {
    const a = new Set(['x']);
    const b = new Set();
    expect(setDifference(a, b)).not.toBe(a);
  });
});
