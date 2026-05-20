// Minimum belief revision: smallest edits to flip a query's truth value.
// Mirrors logic_engine/revision.py including Pareto frontier filtering.

class Revision {
  constructor(opts) {
    this.editsRemoved = opts.editsRemoved;
    this.editsAdded = opts.editsAdded;
    this.entailmentsLost = opts.entailmentsLost;
    this.entailmentsGained = opts.entailmentsGained;
    this.targetQuery = opts.targetQuery;
    this.targetTruth = opts.targetTruth;
    Object.freeze(this);
  }

  get cost() {
    return this.editsRemoved.size + this.editsAdded.size;
  }

  get collateral() {
    const totalChanged = this.entailmentsLost.size + this.entailmentsGained.size;
    return Math.max(0, totalChanged - 1);
  }
}

function universe(facts, query) {
  const nodes = new Set();
  for (const fact of facts.values()) {
    nodes.add(fact.source);
    nodes.add(fact.target);
  }
  nodes.add(query.source);
  nodes.add(query.target);
  return nodes;
}

function* combinations(array, size) {
  const n = array.length;
  if (size > n || size < 0) return;
  const indices = Array.from({ length: size }, function(_, i) { return i; });
  while (true) {
    yield indices.map(function(i) { return array[i]; });
    let i = size - 1;
    while (i >= 0 && indices[i] === i + n - size) i--;
    if (i < 0) return;
    indices[i]++;
    for (let j = i + 1; j < size; j++) indices[j] = indices[j - 1] + 1;
  }
}

function reviseToFalsify(facts, query, maxEdits) {
  if (maxEdits === undefined) maxEdits = 4;
  const u = universe(facts, query);
  const original = computeClosure(facts, u);
  const targetKey = query.source + '>' + query.target;
  if (!original.has(targetKey)) return [];

  const relevantMap = edgesOnPaths(facts, query.source, query.target);
  const relevant = Array.from(relevantMap.values());
  const revisions = [];
  let foundAtSize = null;

  for (let size = 1; size <= maxEdits; size++) {
    if (foundAtSize !== null && size > foundAtSize + 1) break;
    for (const editSet of combinations(relevant, size)) {
      const removed = new Map();
      for (const fact of editSet) removed.set(fact.key, fact);
      const newFacts = factSetDifference(facts, removed);
      const newClosure = computeClosure(newFacts, u);
      if (!newClosure.has(targetKey)) {
        const lost = setDifference(original, newClosure);
        revisions.push(
          new Revision({
            editsRemoved: removed,
            editsAdded: new Map(),
            entailmentsLost: lost,
            entailmentsGained: new Set(),
            targetQuery: query,
            targetTruth: false,
          })
        );
        if (foundAtSize === null) foundAtSize = size;
      }
    }
  }

  return paretoFilter(sortRevisions(revisions));
}

function reviseToSatisfy(facts, query, candidateNodes, maxEdits) {
  if (candidateNodes === undefined) candidateNodes = null;
  if (maxEdits === undefined) maxEdits = 3;
  const u = universe(facts, query);
  const original = computeClosure(facts, u);
  const targetKey = query.source + '>' + query.target;
  if (original.has(targetKey)) return [];

  const candidates = [];
  const nodes = candidateNodes === null ? Array.from(u) : Array.from(candidateNodes);
  for (const s of nodes) {
    for (const t of nodes) {
      if (s === t) continue;
      const candidate = new Fact(s, t);
      if (!facts.has(candidate.key)) candidates.push(candidate);
    }
  }

  const revisions = [];
  let foundAtSize = null;

  for (let size = 1; size <= maxEdits; size++) {
    if (foundAtSize !== null && size > foundAtSize + 1) break;
    for (const editSet of combinations(candidates, size)) {
      const added = new Map();
      for (const fact of editSet) added.set(fact.key, fact);
      const newFacts = factSetUnion(facts, added);
      const newClosure = computeClosure(newFacts, u);
      if (newClosure.has(targetKey)) {
        const gained = setDifference(newClosure, original);
        revisions.push(
          new Revision({
            editsRemoved: new Map(),
            editsAdded: added,
            entailmentsLost: new Set(),
            entailmentsGained: gained,
            targetQuery: query,
            targetTruth: true,
          })
        );
        if (foundAtSize === null) foundAtSize = size;
      }
    }
  }

  return paretoFilter(sortRevisions(revisions));
}

function sortRevisions(revisions) {
  return revisions.slice().sort(function(a, b) {
    if (a.cost !== b.cost) return a.cost - b.cost;
    return a.collateral - b.collateral;
  });
}

function paretoFilter(revisions) {
  const keep = [];
  for (const r of revisions) {
    let dominated = false;
    for (const other of revisions) {
      if (other === r) continue;
      if (
        other.cost <= r.cost &&
        other.collateral <= r.collateral &&
        (other.cost !== r.cost || other.collateral !== r.collateral)
      ) {
        dominated = true;
        break;
      }
    }
    if (!dominated) keep.push(r);
  }
  return keep;
}

// ── Logic Engine bootstrap ────────────────────────────────────────────────────
//
// Expose the primitives that counterfactual.js reads via window.LogicEngine.
// This block executes after graph.js, facts.js, and explain.js have already
// registered their globals, so all referenced names are guaranteed to exist.

if (typeof window !== 'undefined') {
  window.LogicEngine = {
    // Facts / queries
    Fact:             Fact,
    Query:            Query,
    parseFacts:       parseFacts,
    factSetUnion:     factSetUnion,
    factSetDifference: factSetDifference,
    factSetEquals:    factSetEquals,

    // Graph
    buildAdjacency:   buildAdjacency,
    reachableFrom:    reachableFrom,
    isReachable:      isReachable,
    findPath:         findPath,
    computeClosure:   computeClosure,
    edgesOnPaths:     edgesOnPaths,
    setDifference:    setDifference,

    // Revision
    Revision:         Revision,
    reviseToFalsify:  reviseToFalsify,
    reviseToSatisfy:  reviseToSatisfy,

    // Explain
    explainRevision:  explainRevision,
    explainAll:       explainAll,
  };
}
