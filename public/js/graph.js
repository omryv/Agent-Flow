
// Graph operations: reachability, path finding, entailment closure.
// Mirrors logic_engine/graph.py.

export function buildAdjacency(facts) {
  const adj = new Map();
  for (const fact of facts.values()) {
    if (!adj.has(fact.source)) adj.set(fact.source, new Set());
    if (!adj.has(fact.target)) adj.set(fact.target, new Set());
    adj.get(fact.source).add(fact.target);
  }
  return adj;
}

export function reachableFrom(adj, start) {
  const visited = new Set();
  const stack = [start];
  while (stack.length > 0) {
    const curr = stack.pop();
    const neighbors = adj.get(curr);
    if (!neighbors) continue;
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        stack.push(n);
      }
    }
  }
  return visited;
}

export function isReachable(facts, source, target) {
  if (source === target) return true;
  const adj = buildAdjacency(facts);
  return reachableFrom(adj, source).has(target);
}

export function findPath(facts, source, target) {
  if (source === target) return [source];
  const adj = buildAdjacency(facts);
  const parent = new Map();
  parent.set(source, null);
  const stack = [source];
  while (stack.length > 0) {
    const curr = stack.pop();
    if (curr === target) {
      const path = [];
      let node = curr;
      while (node !== null) {
        path.push(node);
        node = parent.get(node);
      }
      return path.reverse();
    }
    const neighbors = adj.get(curr);
    if (!neighbors) continue;
    for (const n of neighbors) {
      if (!parent.has(n)) {
        parent.set(n, curr);
        stack.push(n);
      }
    }
  }
  return null;
}

// Returns a Set of canonical entailment keys, "source>target".
export function computeClosure(facts, universe = null) {
  const adj = buildAdjacency(facts);
  const nodes = new Set(adj.keys());
  if (universe !== null) {
    for (const node of universe) nodes.add(node);
  }
  const entailments = new Set();
  for (const start of nodes) {
    entailments.add(`${start}>${start}`);
    for (const reached of reachableFrom(adj, start)) {
      entailments.add(`${start}>${reached}`);
    }
  }
  return entailments;
}

export function edgesOnPaths(facts, source, target) {
  const adj = buildAdjacency(facts);
  const radj = new Map();
  for (const fact of facts.values()) {
    if (!radj.has(fact.source)) radj.set(fact.source, new Set());
    if (!radj.has(fact.target)) radj.set(fact.target, new Set());
    radj.get(fact.target).add(fact.source);
  }
  const fwd = reachableFrom(adj, source);
  fwd.add(source);
  const bwd = reachableFrom(radj, target);
  bwd.add(target);
  const onPath = new Set();
  for (const node of fwd) {
    if (bwd.has(node)) onPath.add(node);
  }
  const result = new Map();
  for (const [key, fact] of facts) {
    if (onPath.has(fact.source) && onPath.has(fact.target)) {
      result.set(key, fact);
    }
  }
  return result;
}

export function setDifference(a, b) {
  const out = new Set();
  for (const v of a) {
    if (!b.has(v)) out.add(v);
  }
  return out;
}
