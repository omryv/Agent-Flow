// Minimum belief revision: smallest edits to flip a query's truth value.
// Mirrors logic_engine/revision.py including Pareto frontier filtering.

import { Fact, factSetUnion, factSetDifference } from "./facts.js";
import { computeClosure, edgesOnPaths, setDifference } from "./graph.js";

export class Revision {
  constructor({
    editsRemoved,
    editsAdded,
    entailmentsLost,
    entailmentsGained,
    targetQuery,
    targetTruth,
  }) {
    this.editsRemoved = editsRemoved;
    this.editsAdded = editsAdded;
    this.entailmentsLost = entailmentsLost;
    this.entailmentsGained = entailmentsGained;
    this.targetQuery = targetQuery;
    this.targetTruth = targetTruth;
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
  const indices = Array.from({ length: size }, (_, i) => i);
  while (true) {
    yield indices.map((i) => array[i]);
    let i = size - 1;
    while (i >= 0 && indices[i] === i + n - size) i--;
    if (i < 0) return;
    indices[i]++;
    for (let j = i + 1; j < size; j++) indices[j] = indices[j - 1] + 1;
  }
}

export function reviseToFalsify(facts, query, maxEdits = 4) {
  const u = universe(facts, query);
  const original = computeClosure(facts, u);
  const targetKey = `${query.source}>${query.target}`;
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
          }),
        );
        if (foundAtSize === null) foundAtSize = size;
      }
    }
  }

  return paretoFilter(sortRevisions(revisions));
}

export function reviseToSatisfy(
  facts,
  query,
  candidateNodes = null,
  maxEdits = 3,
) {
  const u = universe(facts, query);
  const original = computeClosure(facts, u);
  const targetKey = `${query.source}>${query.target}`;
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
          }),
        );
        if (foundAtSize === null) foundAtSize = size;
      }
    }
  }

  return paretoFilter(sortRevisions(revisions));
}

function sortRevisions(revisions) {
  return [...revisions].sort((a, b) => {
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
