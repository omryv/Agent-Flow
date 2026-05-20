'use strict';

const engine = require('./helpers/engine');
const {
  Fact,
  Query,
  Revision,
  parseFacts,
  reviseToFalsify,
  explainRevision,
  explainAll,
} = engine;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFacts(...strings) {
  return parseFacts(strings);
}

/**
 * Build a Revision with explicit control over every field.
 *
 * removed: array of [source, target] pairs
 * added:   array of [source, target] pairs
 * lost:    Set of canonical entailment strings e.g. 'a>b'
 * gained:  Set of canonical entailment strings
 * query:   Query instance
 * truth:   boolean (targetTruth)
 */
function makeRevision({ query, removed = [], added = [], lost = new Set(), gained = new Set(), truth = false }) {
  const editsRemoved = new Map();
  removed.forEach(function(pair) {
    const f = new Fact(pair[0], pair[1]);
    editsRemoved.set(f.key, f);
  });
  const editsAdded = new Map();
  added.forEach(function(pair) {
    const f = new Fact(pair[0], pair[1]);
    editsAdded.set(f.key, f);
  });
  return new Revision({
    editsRemoved,
    editsAdded,
    entailmentsLost:    lost,
    entailmentsGained:  gained,
    targetQuery:        query,
    targetTruth:        truth,
  });
}

// ── explainRevision — return type ─────────────────────────────────────────────

describe('explainRevision return type', () => {
  test('returns a string', () => {
    const q = new Query('a', 'b');
    const r = makeRevision({ query: q, removed: [['a', 'b']], lost: new Set(['a>b']) });
    expect(typeof explainRevision(r)).toBe('string');
  });

  test('returned string is non-empty', () => {
    const q = new Query('a', 'b');
    const r = makeRevision({ query: q, removed: [['a', 'b']], lost: new Set(['a>b']) });
    expect(explainRevision(r).length).toBeGreaterThan(0);
  });
});

// ── explainRevision — header line ─────────────────────────────────────────────

describe('explainRevision header line', () => {
  test('contains verb "falsify" when targetTruth is false', () => {
    const q = new Query('src', 'tgt');
    const r = makeRevision({ query: q, removed: [['src', 'tgt']], lost: new Set(['src>tgt']), truth: false });
    expect(explainRevision(r)).toContain('falsify');
  });

  test('contains verb "satisfy" when targetTruth is true', () => {
    const q = new Query('src', 'tgt');
    const r = makeRevision({ query: q, added: [['src', 'tgt']], gained: new Set(['src>tgt']), truth: true });
    expect(explainRevision(r)).toContain('satisfy');
  });

  test('header contains query toString: "src > tgt"', () => {
    const q = new Query('src', 'tgt');
    const r = makeRevision({ query: q, removed: [['src', 'tgt']], lost: new Set(['src>tgt']) });
    expect(explainRevision(r)).toContain('src > tgt');
  });

  test('header contains cost value', () => {
    const q = new Query('a', 'b');
    // removed two facts: cost=2
    const r = makeRevision({ query: q, removed: [['a', 'b'], ['b', 'c']], lost: new Set(['a>b', 'a>c']) });
    expect(explainRevision(r)).toContain('cost=2');
  });

  test('header is the first line of output', () => {
    const q = new Query('a', 'b');
    const r = makeRevision({ query: q, removed: [['a', 'b']], lost: new Set(['a>b']) });
    const firstLine = explainRevision(r).split('\n')[0];
    expect(firstLine).toContain('falsify');
    expect(firstLine).toContain('a > b');
  });
});

// ── explainRevision — Remove section ─────────────────────────────────────────

describe('explainRevision Remove section', () => {
  test('contains "Remove:" when editsRemoved is non-empty', () => {
    const q = new Query('a', 'b');
    const r = makeRevision({ query: q, removed: [['a', 'b']], lost: new Set(['a>b']) });
    expect(explainRevision(r)).toContain('Remove:');
  });

  test('does not contain "Remove:" when editsRemoved is empty', () => {
    const q = new Query('a', 'b');
    const r = makeRevision({ query: q, added: [['a', 'b']], gained: new Set(['a>b']), truth: true });
    expect(explainRevision(r)).not.toContain('Remove:');
  });

  test('removed fact appears in output as "source > target"', () => {
    const q = new Query('a', 'b');
    const r = makeRevision({ query: q, removed: [['a', 'b']], lost: new Set(['a>b']) });
    expect(explainRevision(r)).toContain('a > b');
  });

  test('removed facts are sorted alphabetically by toString', () => {
    const q = new Query('a', 'z');
    // z>a comes after a>z alphabetically for sorting, but a>m should come before z>a
    const r = makeRevision({
      query: q,
      removed: [['z', 'a'], ['a', 'm'], ['m', 'z']],
      lost: new Set(['a>z']),
    });
    const output = explainRevision(r);
    const aIdx = output.indexOf('a > m');
    const mIdx = output.indexOf('m > z');
    const zIdx = output.indexOf('z > a');
    expect(aIdx).toBeLessThan(mIdx);
    expect(mIdx).toBeLessThan(zIdx);
  });

  test('each removed fact is prefixed with the minus symbol (−)', () => {
    const q = new Query('a', 'b');
    const r = makeRevision({ query: q, removed: [['a', 'b']], lost: new Set(['a>b']) });
    // U+2212 MINUS SIGN
    expect(explainRevision(r)).toContain('\u2212');
  });
});

// ── explainRevision — Add section ─────────────────────────────────────────────

describe('explainRevision Add section', () => {
  test('contains "Add:" when editsAdded is non-empty', () => {
    const q = new Query('a', 'b');
    const r = makeRevision({ query: q, added: [['a', 'b']], gained: new Set(['a>b']), truth: true });
    expect(explainRevision(r)).toContain('Add:');
  });

  test('does not contain "Add:" when editsAdded is empty', () => {
    const q = new Query('a', 'b');
    const r = makeRevision({ query: q, removed: [['a', 'b']], lost: new Set(['a>b']) });
    expect(explainRevision(r)).not.toContain('Add:');
  });

  test('added fact appears in output as "source > target"', () => {
    const q = new Query('a', 'c');
    const r = makeRevision({ query: q, added: [['a', 'c']], gained: new Set(['a>c']), truth: true });
    expect(explainRevision(r)).toContain('a > c');
  });

  test('added facts are sorted alphabetically by toString', () => {
    const q = new Query('a', 'z');
    const r = makeRevision({
      query: q,
      added: [['z', 'a'], ['a', 'm'], ['m', 'z']],
      gained: new Set(['a>z']),
      truth: true,
    });
    const output = explainRevision(r);
    const aIdx = output.indexOf('a > m');
    const mIdx = output.indexOf('m > z');
    const zIdx = output.indexOf('z > a');
    expect(aIdx).toBeLessThan(mIdx);
    expect(mIdx).toBeLessThan(zIdx);
  });

  test('each added fact is prefixed with "+"', () => {
    const q = new Query('a', 'b');
    const r = makeRevision({ query: q, added: [['a', 'b']], gained: new Set(['a>b']), truth: true });
    expect(explainRevision(r)).toContain('+ ');
  });
});

// ── explainRevision — no Remove or Add ───────────────────────────────────────

describe('explainRevision with no edits', () => {
  test('neither "Remove:" nor "Add:" appears when both maps are empty', () => {
    const q = new Query('a', 'b');
    const r = makeRevision({ query: q, lost: new Set(['a>b']) });
    const output = explainRevision(r);
    expect(output).not.toContain('Remove:');
    expect(output).not.toContain('Add:');
  });
});

// ── explainRevision — Collateral line ─────────────────────────────────────────

describe('explainRevision Collateral line', () => {
  test('output contains "Collateral:"', () => {
    const q = new Query('a', 'b');
    const r = makeRevision({ query: q, removed: [['a', 'b']], lost: new Set(['a>b']) });
    expect(explainRevision(r)).toContain('Collateral:');
  });

  test('Collateral: 0 when entailmentsLost contains only targetKey', () => {
    // Only a>b in lost; targetKey = a>b → sideEffects = [] → "Collateral: 0"
    const q = new Query('a', 'b');
    const r = makeRevision({ query: q, removed: [['a', 'b']], lost: new Set(['a>b']) });
    expect(explainRevision(r)).toContain('Collateral: 0');
  });

  test('Collateral: 0 when entailmentsGained contains only targetKey (satisfy)', () => {
    const q = new Query('a', 'b');
    const r = makeRevision({ query: q, added: [['a', 'b']], gained: new Set(['a>b']), truth: true });
    expect(explainRevision(r)).toContain('Collateral: 0');
  });

  test('Collateral: 2 when entailmentsLost has targetKey plus two others', () => {
    // lost = {a>c, a>b, x>y}, targetKey = a>c → sideEffects = ['a>b','x>y'] → length=2
    const q = new Query('a', 'c');
    const r = makeRevision({
      query: q,
      removed: [['a', 'c']],
      lost: new Set(['a>c', 'a>b', 'x>y']),
    });
    expect(explainRevision(r)).toContain('Collateral: 2');
  });

  test('Collateral: 1 when entailmentsGained has targetKey plus one other (satisfy)', () => {
    // gained = {a>c, a>b}, targetKey = a>c → sideEffects = ['a>b'] → length=1
    const q = new Query('a', 'c');
    const r = makeRevision({
      query: q,
      added: [['a', 'c']],
      gained: new Set(['a>c', 'a>b']),
      truth: true,
    });
    expect(explainRevision(r)).toContain('Collateral: 1');
  });

  test('targetKey is excluded from sideEffects even when present in entailmentsLost', () => {
    const q = new Query('a', 'b');
    // lost = {a>b, c>d}, targetKey = a>b → sideEffects = ['c>d']
    const r = makeRevision({
      query: q,
      removed: [['a', 'b']],
      lost: new Set(['a>b', 'c>d']),
    });
    const output = explainRevision(r);
    expect(output).toContain('Collateral: 1');
    expect(output).toContain('c > d');
  });
});

// ── explainRevision — side effect listing ────────────────────────────────────

describe('explainRevision side effect listing', () => {
  test('side effects are listed with middle-dot prefix (·)', () => {
    const q = new Query('a', 'c');
    const r = makeRevision({
      query: q,
      removed: [['a', 'b']],
      lost: new Set(['a>c', 'a>b']),
    });
    // U+00B7 MIDDLE DOT
    expect(explainRevision(r)).toContain('\u00b7');
  });

  test('side effects are listed in sorted order', () => {
    const q = new Query('a', 'z');
    // lost has targetKey + three others; after sort: a>b, m>n, x>y
    const r = makeRevision({
      query: q,
      removed: [['a', 'b']],
      lost: new Set(['a>z', 'x>y', 'a>b', 'm>n']),
    });
    const output = explainRevision(r);
    const aIdx = output.indexOf('a > b');
    const mIdx = output.indexOf('m > n');
    const xIdx = output.indexOf('x > y');
    expect(aIdx).toBeLessThan(mIdx);
    expect(mIdx).toBeLessThan(xIdx);
  });

  test('label "Other entailments lost" appears when falsify has side effects', () => {
    const q = new Query('a', 'c');
    const r = makeRevision({
      query: q,
      removed: [['a', 'b']],
      lost: new Set(['a>c', 'a>b']),
    });
    expect(explainRevision(r)).toContain('Other entailments lost');
  });

  test('label "New entailments introduced" appears when satisfy has side effects', () => {
    const q = new Query('a', 'c');
    const r = makeRevision({
      query: q,
      added: [['a', 'b']],
      gained: new Set(['a>c', 'a>b']),
      truth: true,
    });
    expect(explainRevision(r)).toContain('New entailments introduced');
  });

  test('no label line when Collateral is 0', () => {
    const q = new Query('a', 'b');
    const r = makeRevision({ query: q, removed: [['a', 'b']], lost: new Set(['a>b']) });
    expect(explainRevision(r)).not.toContain('Other entailments lost');
    expect(explainRevision(r)).not.toContain('New entailments introduced');
  });
});

// ── explainRevision — maxCollateralShown truncation ──────────────────────────

describe('explainRevision maxCollateralShown', () => {
  // lost = {a>z (targetKey), a>b, c>d, e>f} → sideEffects = ['a>b','c>d','e>f'] (3 items)
  function makeThreeSideEffects() {
    const q = new Query('a', 'z');
    return makeRevision({
      query: q,
      removed: [['a', 'b']],
      lost: new Set(['a>z', 'a>b', 'c>d', 'e>f']),
    });
  }

  test('shows all items when count <= maxCollateralShown (default 10)', () => {
    const r = makeThreeSideEffects();
    const output = explainRevision(r);
    expect(output).toContain('a > b');
    expect(output).toContain('c > d');
    expect(output).toContain('e > f');
    expect(output).not.toContain('and');
  });

  test('truncates when count > maxCollateralShown', () => {
    const r = makeThreeSideEffects();
    // maxCollateralShown=2: shows a>b and c>d, truncates e>f
    const output = explainRevision(r, 2);
    expect(output).toContain('a > b');
    expect(output).toContain('c > d');
    expect(output).not.toContain('e > f');
    expect(output).toContain('and 1 more');
  });

  test('truncation message shows correct remaining count', () => {
    // 5 side effects, maxCollateralShown=2 → "and 3 more"
    const q = new Query('a', 'z');
    const r = makeRevision({
      query: q,
      removed: [['a', 'b']],
      lost: new Set(['a>z', 'a>b', 'c>d', 'e>f', 'g>h', 'i>j']),
    });
    expect(explainRevision(r, 2)).toContain('and 3 more');
  });

  test('maxCollateralShown=0 shows no items and "and N more"', () => {
    const r = makeThreeSideEffects();
    const output = explainRevision(r, 0);
    expect(output).not.toContain('\u00b7 a > b');
    expect(output).toContain('and 3 more');
  });

  test('default maxCollateralShown is 10: 10 items shown without truncation', () => {
    const q = new Query('a', 'z');
    // Build exactly 10 side effects + targetKey = 11 entries in lost
    const lostSet = new Set(['a>z']);
    for (let i = 0; i < 10; i++) lostSet.add('node' + i + '>end');
    const r = makeRevision({ query: q, removed: [['a', 'b']], lost: lostSet });
    const output = explainRevision(r);
    expect(output).not.toContain('more');
    for (let i = 0; i < 10; i++) {
      expect(output).toContain('node' + i + ' > end');
    }
  });

  test('default maxCollateralShown is 10: 11th item causes truncation', () => {
    const q = new Query('a', 'z');
    const lostSet = new Set(['a>z']);
    for (let i = 0; i < 11; i++) lostSet.add('node' + i + '>end');
    const r = makeRevision({ query: q, removed: [['a', 'b']], lost: lostSet });
    const output = explainRevision(r);
    expect(output).toContain('and 1 more');
  });
});

// ── explainRevision — integration with reviseToFalsify ───────────────────────

describe('explainRevision integration with real revisions', () => {
  // Single edge: a->b, query a->b.
  // Expected: cost=1, collateral=0, one removed fact a>b.
  test('single-edge falsify: output contains cost=1, collateral=0, and removed fact', () => {
    const facts = makeFacts('a > b');
    const query = new Query('a', 'b');
    const revisions = reviseToFalsify(facts, query, 2);
    expect(revisions).toHaveLength(1);
    const output = explainRevision(revisions[0]);
    expect(output).toContain('cost=1');
    expect(output).toContain('Collateral: 0');
    expect(output).toContain('a > b');
    expect(output).toContain('Remove:');
  });

  // Chain: a->b->c, query a->c.
  // Two revisions each at cost=1, collateral=1.
  // One removes a>b (side effect: a>b lost), one removes b>c (side effect: b>c lost).
  test('chain falsify: each revision output reflects its specific removed edge', () => {
    const facts = makeFacts('a > b', 'b > c');
    const query = new Query('a', 'c');
    const revisions = reviseToFalsify(facts, query, 2);
    expect(revisions).toHaveLength(2);
    const outputs = revisions.map(r => explainRevision(r));
    // Both should show cost=1 and Collateral: 1
    outputs.forEach(function(output) {
      expect(output).toContain('cost=1');
      expect(output).toContain('Collateral: 1');
      expect(output).toContain('Remove:');
    });
    // The two outputs should differ (different edges removed)
    expect(outputs[0]).not.toBe(outputs[1]);
  });

  test('chain falsify: combined outputs cover both edges a>b and b>c', () => {
    const facts = makeFacts('a > b', 'b > c');
    const query = new Query('a', 'c');
    const revisions = reviseToFalsify(facts, query, 2);
    const combined = revisions.map(r => explainRevision(r)).join('\n');
    expect(combined).toContain('a > b');
    expect(combined).toContain('b > c');
  });
});

// ── explainAll ────────────────────────────────────────────────────────────────

describe('explainAll', () => {
  test('returns a string', () => {
    expect(typeof explainAll([])).toBe('string');
  });

  test('empty array returns the "no revision needed" message', () => {
    const result = explainAll([]);
    // U+2014 EM DASH
    expect(result).toContain('No revision needed');
    expect(result).toContain('\u2014');
    expect(result).toContain('query already has the desired truth value');
  });

  test('single revision: output contains "=== Option 1"', () => {
    const q = new Query('a', 'b');
    const r = makeRevision({ query: q, removed: [['a', 'b']], lost: new Set(['a>b']) });
    expect(explainAll([r])).toContain('=== Option 1');
  });

  test('single revision: header contains cost and collateral', () => {
    const q = new Query('a', 'b');
    // cost=1, collateral=0
    const r = makeRevision({ query: q, removed: [['a', 'b']], lost: new Set(['a>b']) });
    const output = explainAll([r]);
    expect(output).toContain('cost=1');
    expect(output).toContain('collateral=0');
  });

  test('two revisions: output contains "=== Option 1" and "=== Option 2"', () => {
    const q = new Query('a', 'c');
    const r1 = makeRevision({ query: q, removed: [['a', 'b']], lost: new Set(['a>c', 'a>b']) });
    const r2 = makeRevision({ query: q, removed: [['b', 'c']], lost: new Set(['a>c', 'b>c']) });
    const output = explainAll([r1, r2]);
    expect(output).toContain('=== Option 1');
    expect(output).toContain('=== Option 2');
  });

  test('options are separated by double newline', () => {
    const q = new Query('a', 'c');
    const r1 = makeRevision({ query: q, removed: [['a', 'b']], lost: new Set(['a>c', 'a>b']) });
    const r2 = makeRevision({ query: q, removed: [['b', 'c']], lost: new Set(['a>c', 'b>c']) });
    const output = explainAll([r1, r2]);
    expect(output).toContain('\n\n');
  });

  test('each option block contains the explainRevision content for that revision', () => {
    const q = new Query('a', 'b');
    const r = makeRevision({ query: q, removed: [['a', 'b']], lost: new Set(['a>b']) });
    const fullOutput = explainAll([r]);
    const singleOutput = explainRevision(r);
    // Every line of the single explain output should appear in the full output
    singleOutput.split('\n').forEach(function(line) {
      expect(fullOutput).toContain(line);
    });
  });

  test('option numbers are 1-based and increment correctly for three revisions', () => {
    const q = new Query('a', 'd');
    const r1 = makeRevision({ query: q, removed: [['a', 'b']], lost: new Set(['a>d', 'a>b']) });
    const r2 = makeRevision({ query: q, removed: [['b', 'c']], lost: new Set(['a>d', 'b>c']) });
    const r3 = makeRevision({ query: q, removed: [['c', 'd']], lost: new Set(['a>d', 'c>d']) });
    const output = explainAll([r1, r2, r3]);
    expect(output).toContain('Option 1');
    expect(output).toContain('Option 2');
    expect(output).toContain('Option 3');
    expect(output).not.toContain('Option 0');
    expect(output).not.toContain('Option 4');
  });

  test('integration: explainAll on real reviseToFalsify results contains all options', () => {
    // Diamond: a->b->d, a->c->d — four cost-2 cuts
    const facts = makeFacts('a > b', 'b > d', 'a > c', 'c > d');
    const query = new Query('a', 'd');
    const revisions = reviseToFalsify(facts, query, 2);
    expect(revisions).toHaveLength(4);
    const output = explainAll(revisions);
    expect(output).toContain('Option 1');
    expect(output).toContain('Option 2');
    expect(output).toContain('Option 3');
    expect(output).toContain('Option 4');
    expect(output).not.toContain('Option 5');
  });

  test('integration: explainAll on empty reviseToFalsify returns no-revision message', () => {
    // Query b->a with only a->b fact: already false, reviseToFalsify returns []
    const facts = makeFacts('a > b');
    const query = new Query('b', 'a');
    const revisions = reviseToFalsify(facts, query, 2);
    expect(revisions).toHaveLength(0);
    expect(explainAll(revisions)).toContain('No revision needed');
  });
});
