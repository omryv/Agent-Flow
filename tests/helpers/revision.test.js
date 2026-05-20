'use strict';

const engine = require('./helpers/engine');
const {
  Fact,
  Query,
  parseFacts,
  factSetDifference,
  factSetUnion,
  isReachable,
  Revision,
  reviseToFalsify,
  reviseToSatisfy,
  paretoFilter,
  sortRevisions,
  combinations,
} = engine;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFacts(...strings) {
  return parseFacts(strings);
}

/**
 * Construct a Revision with controlled Map/Set sizes so cost and collateral
 * getters return predictable values.
 *
 * cost      = removed + added
 * collateral = max(0, lost + gained - 1)
 */
function makeRevision({ removed = 0, added = 0, lost = 0, gained = 0, truth = false } = {}) {
  const editsRemoved = new Map();
  for (let i = 0; i < removed; i++) {
    const f = new Fact('rem' + i, 'rem' + (i + 100));
    editsRemoved.set(f.key, f);
  }
  const editsAdded = new Map();
  for (let i = 0; i < added; i++) {
    const f = new Fact('add' + i, 'add' + (i + 100));
    editsAdded.set(f.key, f);
  }
  const entailmentsLost = new Set();
  for (let i = 0; i < lost; i++) entailmentsLost.add('lost' + i + '>lostX');
  const entailmentsGained = new Set();
  for (let i = 0; i < gained; i++) entailmentsGained.add('gained' + i + '>gainedX');

  return new Revision({
    editsRemoved,
    editsAdded,
    entailmentsLost,
    entailmentsGained,
    targetQuery: new Query('src', 'tgt'),
    targetTruth: truth,
  });
}

// ── Revision class ────────────────────────────────────────────────────────────

describe('Revision', () => {
  test('cost = editsRemoved.size + editsAdded.size (removed only)', () => {
    const r = makeRevision({ removed: 2 });
    expect(r.cost).toBe(2);
  });

  test('cost = editsRemoved.size + editsAdded.size (added only)', () => {
    const r = makeRevision({ added: 3 });
    expect(r.cost).toBe(3);
  });

  test('cost = editsRemoved.size + editsAdded.size (both)', () => {
    const r = makeRevision({ removed: 1, added: 2 });
    expect(r.cost).toBe(3);
  });

  test('cost = 0 when both maps are empty', () => {
    const r = makeRevision();
    expect(r.cost).toBe(0);
  });

  test('collateral = max(0, totalChanged - 1): 0 when totalChanged is 1', () => {
    // lost=1, gained=0 → totalChanged=1 → collateral=0
    const r = makeRevision({ removed: 1, lost: 1 });
    expect(r.collateral).toBe(0);
  });

  test('collateral = max(0, totalChanged - 1): 1 when totalChanged is 2', () => {
    const r = makeRevision({ removed: 1, lost: 2 });
    expect(r.collateral).toBe(1);
  });

  test('collateral = max(0, totalChanged - 1): 0 when totalChanged is 0', () => {
    const r = makeRevision({ removed: 1, lost: 0, gained: 0 });
    expect(r.collateral).toBe(0);
  });

  test('collateral counts both lost and gained', () => {
    // lost=2, gained=1 → totalChanged=3 → collateral=2
    const r = makeRevision({ added: 1, lost: 2, gained: 1, truth: true });
    expect(r.collateral).toBe(2);
  });

  test('is frozen after construction', () => {
    const r = makeRevision({ removed: 1 });
    expect(Object.isFrozen(r)).toBe(true);
  });

  test('stores targetTruth correctly', () => {
    const rFalse = makeRevision({ truth: false });
    const rTrue  = makeRevision({ truth: true });
    expect(rFalse.targetTruth).toBe(false);
    expect(rTrue.targetTruth).toBe(true);
  });
});

// ── combinations generator ────────────────────────────────────────────────────

describe('combinations', () => {
  function collect(array, size) {
    return Array.from(combinations(array, size));
  }

  test('size=0 yields one empty combination', () => {
    const result = collect(['a', 'b', 'c'], 0);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([]);
  });

  test('size=1 yields each element once', () => {
    const result = collect(['a', 'b', 'c'], 1);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(['a']);
    expect(result[1]).toEqual(['b']);
    expect(result[2]).toEqual(['c']);
  });

  test('size=2 from 3 elements yields 3 pairs', () => {
    const result = collect(['a', 'b', 'c'], 2);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(['a', 'b']);
    expect(result[1]).toEqual(['a', 'c']);
    expect(result[2]).toEqual(['b', 'c']);
  });

  test('size=3 from 3 elements yields 1 combination', () => {
    const result = collect(['a', 'b', 'c'], 3);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(['a', 'b', 'c']);
  });

  test('size > n yields nothing', () => {
    expect(collect(['a', 'b'], 3)).toHaveLength(0);
  });

  test('size < 0 yields nothing', () => {
    expect(collect(['a', 'b', 'c'], -1)).toHaveLength(0);
  });

  test('empty array, size=0 yields one empty combination', () => {
    expect(collect([], 0)).toHaveLength(1);
  });

  test('empty array, size=1 yields nothing', () => {
    expect(collect([], 1)).toHaveLength(0);
  });

  test('C(4,2) = 6', () => {
    expect(collect(['a', 'b', 'c', 'd'], 2)).toHaveLength(6);
  });

  test('C(5,3) = 10', () => {
    const arr = ['a', 'b', 'c', 'd', 'e'];
    expect(collect(arr, 3)).toHaveLength(10);
  });

  test('each combination has exactly size elements', () => {
    const result = collect(['a', 'b', 'c', 'd'], 2);
    result.forEach(combo => expect(combo).toHaveLength(2));
  });

  test('no duplicate elements within a single combination', () => {
    const result = collect(['a', 'b', 'c', 'd'], 3);
    result.forEach(combo => {
      expect(new Set(combo).size).toBe(combo.length);
    });
  });

  test('all combinations are distinct', () => {
    const result = collect(['a', 'b', 'c', 'd'], 2);
    const keys = result.map(c => c.slice().sort().join(','));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ── sortRevisions ─────────────────────────────────────────────────────────────

describe('sortRevisions', () => {
  test('sorts by cost ascending', () => {
    const r1 = makeRevision({ removed: 3, lost: 1 }); // cost=3
    const r2 = makeRevision({ removed: 1, lost: 1 }); // cost=1
    const r3 = makeRevision({ removed: 2, lost: 1 }); // cost=2
    const sorted = sortRevisions([r1, r2, r3]);
    expect(sorted[0].cost).toBe(1);
    expect(sorted[1].cost).toBe(2);
    expect(sorted[2].cost).toBe(3);
  });

  test('ties in cost broken by collateral ascending', () => {
    // cost=1 for both; collateral depends on lost
    const rHigh = makeRevision({ removed: 1, lost: 3 }); // collateral=2
    const rLow  = makeRevision({ removed: 1, lost: 1 }); // collateral=0
    const sorted = sortRevisions([rHigh, rLow]);
    expect(sorted[0].collateral).toBe(0);
    expect(sorted[1].collateral).toBe(2);
  });

  test('does not mutate the input array', () => {
    const r1 = makeRevision({ removed: 2, lost: 1 });
    const r2 = makeRevision({ removed: 1, lost: 1 });
    const input = [r1, r2];
    sortRevisions(input);
    expect(input[0]).toBe(r1);
  });

  test('returns a new array', () => {
    const input = [makeRevision({ removed: 1, lost: 1 })];
    expect(sortRevisions(input)).not.toBe(input);
  });

  test('single-element array returns correctly', () => {
    const r = makeRevision({ removed: 1, lost: 1 });
    expect(sortRevisions([r])).toHaveLength(1);
  });
});

// ── paretoFilter ──────────────────────────────────────────────────────────────

describe('paretoFilter', () => {
  test('returns empty array for empty input', () => {
    expect(paretoFilter([])).toHaveLength(0);
  });

  test('single revision is always kept', () => {
    const r = makeRevision({ removed: 1, lost: 1 });
    expect(paretoFilter([r])).toHaveLength(1);
  });

  test('keeps both when neither dominates the other', () => {
    // r1: cost=1, collateral=2 — r2: cost=2, collateral=0 — neither dominates
    const r1 = makeRevision({ removed: 1, lost: 3 }); // cost=1, coll=2
    const r2 = makeRevision({ removed: 2, lost: 1 }); // cost=2, coll=0
    const result = paretoFilter([r1, r2]);
    expect(result).toHaveLength(2);
    expect(result).toContain(r1);
    expect(result).toContain(r2);
  });

  test('removes a revision dominated in both cost and collateral', () => {
    // r1: cost=1, coll=0 dominates r2: cost=2, coll=1
    const r1 = makeRevision({ removed: 1, lost: 1 }); // cost=1, coll=0
    const r2 = makeRevision({ removed: 2, lost: 2 }); // cost=2, coll=1
    const result = paretoFilter([r1, r2]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(r1);
  });

  test('removes revision dominated by lower cost at same collateral', () => {
    // r1: cost=1, coll=1 dominates r2: cost=2, coll=1
    const r1 = makeRevision({ removed: 1, lost: 2 }); // cost=1, coll=1
    const r2 = makeRevision({ removed: 2, lost: 2 }); // cost=2, coll=1
    const result = paretoFilter([r1, r2]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(r1);
  });

  test('removes revision dominated by lower collateral at same cost', () => {
    // r1: cost=2, coll=0 dominates r2: cost=2, coll=1
    const r1 = makeRevision({ removed: 2, lost: 1 }); // cost=2, coll=0
    const r2 = makeRevision({ removed: 2, lost: 2 }); // cost=2, coll=1
    const result = paretoFilter([r1, r2]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(r1);
  });

  test('does not remove revisions with equal cost and collateral (neither dominates)', () => {
    // equal cost and collateral — condition requires strict inequality in at least one
    const r1 = makeRevision({ removed: 1, lost: 1 }); // cost=1, coll=0
    const r2 = makeRevision({ removed: 1, lost: 1 }); // cost=1, coll=0
    const result = paretoFilter([r1, r2]);
    expect(result).toHaveLength(2);
  });

  test('keeps multiple non-dominated revisions on a Pareto frontier', () => {
    // cost=1,coll=3 | cost=2,coll=2 | cost=3,coll=1 | cost=4,coll=0 — staircase, none dominated
    const r1 = makeRevision({ removed: 1, lost: 4 }); // cost=1, coll=3
    const r2 = makeRevision({ removed: 2, lost: 3 }); // cost=2, coll=2
    const r3 = makeRevision({ removed: 3, lost: 2 }); // cost=3, coll=1
    const r4 = makeRevision({ removed: 4, lost: 1 }); // cost=4, coll=0
    const result = paretoFilter([r1, r2, r3, r4]);
    expect(result).toHaveLength(4);
  });
});

// ── reviseToFalsify ───────────────────────────────────────────────────────────

describe('reviseToFalsify', () => {
  // Single-edge graph: a -> b, query a -> b
  // Only valid cut: remove a>b. lost={a>b}, collateral=0.
  const singleEdgeFacts = makeFacts('a > b');
  const singleEdgeQuery = new Query('a', 'b');

  // Linear chain: a -> b -> c, query a -> c
  // Two cost-1 cuts: remove a>b (lost={a>b,a>c}) or remove b>c (lost={b>c,a>c})
  // Both cost=1, collateral=1. The cost-2 cut {a>b,b>c} is dominated.
  const chainFacts = makeFacts('a > b', 'b > c');
  const chainQuery = new Query('a', 'c');

  // Diamond: a->b->d, a->c->d, query a->d
  // No single-edge cut suffices. Four cost-2 cuts all at collateral=2.
  const diamondFacts = makeFacts('a > b', 'b > d', 'a > c', 'c > d');
  const diamondQuery = new Query('a', 'd');

  test('returns an array', () => {
    expect(Array.isArray(reviseToFalsify(singleEdgeFacts, singleEdgeQuery))).toBe(true);
  });

  test('returns [] when query is already false', () => {
    const facts = makeFacts('a > b');
    const query = new Query('b', 'a'); // no path b -> a
    expect(reviseToFalsify(facts, query)).toHaveLength(0);
  });

  test('returns [] when facts are empty and query is trivially false', () => {
    expect(reviseToFalsify(new Map(), new Query('x', 'y'))).toHaveLength(0);
  });

  test('each element is a Revision instance', () => {
    const result = reviseToFalsify(singleEdgeFacts, singleEdgeQuery);
    result.forEach(r => expect(r).toBeInstanceOf(Revision));
  });

  test('each revision has targetTruth = false', () => {
    const result = reviseToFalsify(chainFacts, chainQuery);
    result.forEach(r => expect(r.targetTruth).toBe(false));
  });

  test('single-edge graph: one revision, cost=1, collateral=0', () => {
    const result = reviseToFalsify(singleEdgeFacts, singleEdgeQuery);
    expect(result).toHaveLength(1);
    expect(result[0].cost).toBe(1);
    expect(result[0].collateral).toBe(0);
  });

  test('single-edge graph: applying editsRemoved falsifies the query', () => {
    const result = reviseToFalsify(singleEdgeFacts, singleEdgeQuery);
    const newFacts = factSetDifference(singleEdgeFacts, result[0].editsRemoved);
    expect(isReachable(newFacts, 'a', 'b')).toBe(false);
  });

  test('linear chain: exactly 2 revisions at cost=1, collateral=1', () => {
    const result = reviseToFalsify(chainFacts, chainQuery, 2);
    expect(result).toHaveLength(2);
    result.forEach(r => {
      expect(r.cost).toBe(1);
      expect(r.collateral).toBe(1);
    });
  });

  test('linear chain: applying editsRemoved from each revision falsifies query', () => {
    const result = reviseToFalsify(chainFacts, chainQuery, 2);
    result.forEach(r => {
      const newFacts = factSetDifference(chainFacts, r.editsRemoved);
      expect(isReachable(newFacts, 'a', 'c')).toBe(false);
    });
  });

  test('linear chain: the two revisions remove different edges', () => {
    const result = reviseToFalsify(chainFacts, chainQuery, 2);
    const key0 = Array.from(result[0].editsRemoved.keys())[0];
    const key1 = Array.from(result[1].editsRemoved.keys())[0];
    expect(key0).not.toBe(key1);
  });

  test('diamond: maxEdits=1 returns [] (no single-edge cut exists)', () => {
    expect(reviseToFalsify(diamondFacts, diamondQuery, 1)).toHaveLength(0);
  });

  test('diamond: maxEdits=2 returns 4 revisions', () => {
    const result = reviseToFalsify(diamondFacts, diamondQuery, 2);
    expect(result).toHaveLength(4);
  });

  test('diamond: all revisions have cost=2', () => {
    const result = reviseToFalsify(diamondFacts, diamondQuery, 2);
    result.forEach(r => expect(r.cost).toBe(2));
  });

  test('diamond: applying each revision falsifies the query', () => {
    const result = reviseToFalsify(diamondFacts, diamondQuery, 2);
    result.forEach(r => {
      const newFacts = factSetDifference(diamondFacts, r.editsRemoved);
      expect(isReachable(newFacts, 'a', 'd')).toBe(false);
    });
  });

  test('result is Pareto-optimal: no revision dominates another', () => {
    const result = reviseToFalsify(chainFacts, chainQuery, 2);
    for (const r of result) {
      for (const other of result) {
        if (other === r) continue;
        const dominates =
          other.cost <= r.cost &&
          other.collateral <= r.collateral &&
          (other.cost !== r.cost || other.collateral !== r.collateral);
        expect(dominates).toBe(false);
      }
    }
  });

  test('result is sorted: cost non-decreasing, ties by collateral non-decreasing', () => {
    const result = reviseToFalsify(chainFacts, chainQuery, 2);
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1];
      const curr = result[i];
      if (prev.cost === curr.cost) {
        expect(prev.collateral).toBeLessThanOrEqual(curr.collateral);
      } else {
        expect(prev.cost).toBeLessThan(curr.cost);
      }
    }
  });

  test('editsRemoved values are Fact instances', () => {
    const result = reviseToFalsify(singleEdgeFacts, singleEdgeQuery);
    for (const r of result) {
      for (const fact of r.editsRemoved.values()) {
        expect(fact).toBeInstanceOf(Fact);
      }
    }
  });

  test('editsAdded is always empty for falsify revisions', () => {
    const result = reviseToFalsify(chainFacts, chainQuery, 2);
    result.forEach(r => expect(r.editsAdded.size).toBe(0));
  });
});

// ── reviseToSatisfy ───────────────────────────────────────────────────────────

describe('reviseToSatisfy', () => {
  // Empty facts, query a -> b.
  // Direct addition a>b: cost=1, collateral=0.
  // b->a addition does not produce a>b.
  // Adding both: cost=2, collateral=1 — dominated by cost-1 solution.
  const emptyFacts = new Map();
  const abQuery    = new Query('a', 'b');

  // Disconnected: a->b and c->d, query a->d.
  // Single-edge additions that work: a>c (then a>c>d), a>d (direct), b>c (a>b>c>d), b>d (a>b>d).
  // a>d: cost=1, collateral=0 (gained={a>d} only, since a already reaches b and c already reaches d).
  // a>d dominates all others (same cost, lowest collateral).
  const disconnFacts = makeFacts('a > b', 'c > d');
  const adQuery      = new Query('a', 'd');

  test('returns an array', () => {
    expect(Array.isArray(reviseToSatisfy(emptyFacts, abQuery))).toBe(true);
  });

  test('returns [] when query is already true', () => {
    const facts = makeFacts('a > b');
    const query = new Query('a', 'b');
    expect(reviseToSatisfy(facts, query)).toHaveLength(0);
  });

  test('returns [] when query is already true via transitivity', () => {
    const facts = makeFacts('a > b', 'b > c');
    const query = new Query('a', 'c');
    expect(reviseToSatisfy(facts, query)).toHaveLength(0);
  });

  test('each element is a Revision instance', () => {
    const result = reviseToSatisfy(emptyFacts, abQuery);
    result.forEach(r => expect(r).toBeInstanceOf(Revision));
  });

  test('each revision has targetTruth = true', () => {
    const result = reviseToSatisfy(emptyFacts, abQuery);
    result.forEach(r => expect(r.targetTruth).toBe(true));
  });

  test('empty facts, query a->b: exactly 1 revision after Pareto', () => {
    const result = reviseToSatisfy(emptyFacts, abQuery, null, 2);
    expect(result).toHaveLength(1);
  });

  test('empty facts, query a->b: revision has cost=1, collateral=0', () => {
    const result = reviseToSatisfy(emptyFacts, abQuery, null, 2);
    expect(result[0].cost).toBe(1);
    expect(result[0].collateral).toBe(0);
  });

  test('empty facts, query a->b: applying editsAdded satisfies the query', () => {
    const result = reviseToSatisfy(emptyFacts, abQuery, null, 2);
    const newFacts = factSetUnion(emptyFacts, result[0].editsAdded);
    expect(isReachable(newFacts, 'a', 'b')).toBe(true);
  });

  test('disconnected graph: applying editsAdded satisfies query for every revision', () => {
    const result = reviseToSatisfy(disconnFacts, adQuery, null, 2);
    result.forEach(r => {
      const newFacts = factSetUnion(disconnFacts, r.editsAdded);
      expect(isReachable(newFacts, 'a', 'd')).toBe(true);
    });
  });

  test('disconnected graph: Pareto-optimal result contains only cost=1 revision', () => {
    // a>d addition has cost=1, collateral=0 — dominates all other cost-1 options
    const result = reviseToSatisfy(disconnFacts, adQuery, null, 2);
    expect(result).toHaveLength(1);
    expect(result[0].cost).toBe(1);
    expect(result[0].collateral).toBe(0);
  });

  test('editsRemoved is always empty for satisfy revisions', () => {
    const result = reviseToSatisfy(emptyFacts, abQuery, null, 2);
    result.forEach(r => expect(r.editsRemoved.size).toBe(0));
  });

  test('result is Pareto-optimal: no revision dominates another', () => {
    const result = reviseToSatisfy(disconnFacts, adQuery, null, 3);
    for (const r of result) {
      for (const other of result) {
        if (other === r) continue;
        const dominates =
          other.cost <= r.cost &&
          other.collateral <= r.collateral &&
          (other.cost !== r.cost || other.collateral !== r.collateral);
        expect(dominates).toBe(false);
      }
    }
  });

  test('candidateNodes restricts which edges may be added', () => {
    // With candidateNodes = {a, b} only edges between a and b are tried.
    // a>b is not in facts (empty), so it will be tried and satisfies the query.
    const result = reviseToSatisfy(emptyFacts, abQuery, new Set(['a', 'b']), 2);
    expect(result.length).toBeGreaterThan(0);
    result.forEach(r => {
      for (const fact of r.editsAdded.values()) {
        expect(['a', 'b'].includes(fact.source)).toBe(true);
        expect(['a', 'b'].includes(fact.target)).toBe(true);
      }
    });
  });
});
