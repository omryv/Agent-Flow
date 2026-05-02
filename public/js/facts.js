// Core data types for facts and queries.
// Mirrors logic_engine/facts.py byte-for-byte in behavior.

export class Fact {
  constructor(source, target) {
    if (typeof source !== "string" || typeof target !== "string") {
      throw new TypeError("Fact source and target must be strings");
    }
    this.source = source;
    this.target = target;
    Object.freeze(this);
  }

  toString() {
    return `${this.source} > ${this.target}`;
  }

  // Canonical key for use in Sets and Maps.
  get key() {
    return `${this.source}>${this.target}`;
  }

  static parse(text) {
    if (typeof text !== "string") {
      throw new TypeError(`Invalid fact format (not a string): ${text}`);
    }
    if (!text.includes(">")) {
      throw new Error(`Invalid fact format (missing '>'): ${JSON.stringify(text)}`);
    }
    const parts = text.split(">");
    if (parts.length !== 2) {
      throw new Error(
        `Invalid fact format (expected exactly one '>'): ${JSON.stringify(text)}`,
      );
    }
    const left = parts[0].trim();
    const right = parts[1].trim();
    if (!left || !right) {
      throw new Error(`Fact contains empty node name: ${JSON.stringify(text)}`);
    }
    return new Fact(left, right);
  }
}

export class Query {
  constructor(source, target) {
    if (typeof source !== "string" || typeof target !== "string") {
      throw new TypeError("Query source and target must be strings");
    }
    this.source = source;
    this.target = target;
    Object.freeze(this);
  }

  toString() {
    return `${this.source} > ${this.target}`;
  }

  get key() {
    return `${this.source}>${this.target}`;
  }

  static parse(text) {
    if (typeof text !== "string") {
      throw new TypeError(`Invalid query format (not a string): ${text}`);
    }
    if (!text.includes(">")) {
      throw new Error(`Invalid query format (missing '>'): ${JSON.stringify(text)}`);
    }
    const parts = text.split(">");
    if (parts.length !== 2) {
      throw new Error(
        `Invalid query format (expected exactly one '>'): ${JSON.stringify(text)}`,
      );
    }
    const left = parts[0].trim();
    const right = parts[1].trim();
    if (!left || !right) {
      throw new Error(`Query contains empty node name: ${JSON.stringify(text)}`);
    }
    return new Query(left, right);
  }
}

// Parse a list of strings or Fact instances into a FactSet.
// Returns a Map keyed by canonical fact key, mirroring frozenset semantics.
export function parseFacts(items) {
  const out = new Map();
  for (const item of items) {
    if (item instanceof Fact) {
      out.set(item.key, item);
    } else {
      const fact = Fact.parse(item);
      out.set(fact.key, fact);
    }
  }
  return out;
}

// Helpers that give Map-of-Fact the set semantics Python uses.
export function factSetUnion(a, b) {
  const out = new Map(a);
  for (const [k, v] of b) out.set(k, v);
  return out;
}

export function factSetDifference(a, b) {
  const out = new Map();
  for (const [k, v] of a) {
    if (!b.has(k)) out.set(k, v);
  }
  return out;
}

export function factSetEquals(a, b) {
  if (a.size !== b.size) return false;
  for (const k of a.keys()) {
    if (!b.has(k)) return false;
  }
  return true;
}
