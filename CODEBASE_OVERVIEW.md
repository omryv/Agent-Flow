# AgentFlow — Codebase Overview, Test Documentation & Verification Report

> Generated 2026-04-25. All 239 tests verified passing (`npm test`).

---

## 1. What Is This Repository?

**AgentFlow** is a zero-dependency, zero-build-step, browser-based read-only counterfactual inspector for LLM agent execution traces. It imports traces from LangSmith, LangFuse, or W&B Weave, renders them as interactive directed acyclic graphs (DAGs), and lets users inspect how node overrides in counterfactual scenarios change downstream metrics and the final answer.

---

## 2. Key Technologies

| Layer | Technology |
|---|---|
| Language | Vanilla JavaScript (ES5-compatible `'use strict'` globals; no ES modules, no TypeScript) |
| Rendering | DOM string-builder pattern — full HTML string rebuilt on every state change, injected into `#app` |
| Persistence | `localStorage` (key `agentflow.v1`, max 4 MB, JSON-serialised state) |
| Layout | Kahn's BFS topological sort for DAG layer assignment |
| Testing | **Jest 29** running in `node` test environment; `vm.runInContext` sandbox to load browser globals |
| Deployment | **Vercel** (static, no build step); `vercel.json` sets CSP/cache/rewrite headers |
| Security | Strict Content-Security-Policy in `<meta>`, HTML-entity escaping on all user content, `SAFE_ID_RE` allow-list for IDs |

---

## 3. Repository File Structure

```
Agent-Flow/
├── index.html               # Single HTML entry point; loads all JS via <script> tags
├── css/
│   └── styles.css           # Full application stylesheet (dark theme, CSS variables)
├── js/
│   ├── constants.js         # ICONS (SVG), ROLES, STATUSES, SAFE_ID_RE regex
│   ├── utils.js             # esc(), escAttr(), clampStr(), SafeStore, ErrorBoundary
│   ├── data.js              # validateRunSchema()
│   ├── state.js             # Global state atom, setState(), getActiveRunView(),
│   │                        #   _normalizeState(), _materializeCounterfactualRun(),
│   │                        #   _cloneNode/Edge/Run/NodePositions()
│   ├── layout.js            # layoutNodes() — Kahn's BFS DAG layout
│   ├── adapters.js          # importFromThirdParty(), fromLangSmith/LangFuse/Weave(),
│   │                        #   detectFormat(), inferRole(), inferStatus(),
│   │                        #   safeId(), msDiff(), truncate()
│   ├── render.js            # HTML string builders for every UI region
│   ├── events.js            # DOM event handlers (import, export, node/run/tab/cf navigation)
│   └── main.js              # Boot: installs ErrorBoundary, calls render()
├── tests/
│   ├── helpers/
│   │   └── loadContext.js       # vm sandbox factory — mocks browser globals for Node tests
│   ├── adapters.test.js         # 103 tests: adapter helpers + all 3 import formats
│   ├── data-validation.test.js  # 35 tests: validateRunSchema()
│   ├── layout.test.js           # 14 tests: layoutNodes()
│   ├── state.test.js            # 53 tests: state management & counterfactual materialisation
│   └── utils.test.js            # 34 tests: esc(), escAttr(), clampStr(), SafeStore
├── package.json             # Jest 29 dev dependency; test script
├── vercel.json              # Security headers, asset caching, SPA rewrites
└── README.md                # Project overview and roadmap
```

### Script Load Order (mirrors `<script>` tags in `index.html`)

```
constants → utils → data → state → layout → adapters → render → events → main
```

Each file depends only on symbols exported by files loaded before it.

---

## 4. Architecture Summary

### 4.1 State Machine

A single mutable `state` object lives in `state.js`. Every user action calls `setState(patch)`:

1. Merge patch with current state.
2. Pass through `_normalizeState()` — validates runs, sanitises fields, falls back to sample data if invalid.
3. Persist to `localStorage` via `SafeStore`.
4. Call `render()` (full DOM rebuild).

### 4.2 Counterfactual System

A *run* can carry a `counterfactuals[]` array. Each counterfactual specifies `nodeOverrides` — a map of `nodeId → partial node` — plus optional replacement `metrics` and `finalAnswer`. `_materializeCounterfactualRun()` merges overrides onto the base run's nodes to produce a *view* run. The original run is never mutated.

### 4.3 Adapter Layer

`importFromThirdParty(obj)` auto-detects the format (`detectFormat`) and delegates to the appropriate adapter. Each adapter walks the trace tree/list, infers node roles from operation names (`inferRole`), marks failed nodes (`inferStatus`), sums token usage, and returns a native `Run` object that passes `validateRunSchema`.

### 4.4 DAG Layout

`layoutNodes(nodes, edges)` runs Kahn's BFS: nodes with in-degree 0 form layer 0, then decremented, repeat. Each layer is spaced 280 px horizontally; nodes within a layer are centred vertically in a 600 px canvas. Cyclic nodes that the BFS never visits are appended as single-node fallback layers.

### 4.5 Security Controls

| Control | Where |
|---|---|
| HTML-entity escaping (`esc`, `escAttr`) | All user-supplied content before DOM insertion |
| `SAFE_ID_RE` allow-list `/^[A-Za-z0-9_-]{1,80}$/` | All IDs in imported runs/nodes/edges/CFs |
| Content-Security-Policy (`default-src 'self'`) | `<meta>` in `index.html`; also set by `vercel.json` |
| `SafeStore` 4 MB cap | Prevents `localStorage` quota abuse |
| `validateRunSchema` length caps (name ≤ 200, content ≤ 10 000, nodes ≤ 500, edges ≤ 2 000) | Imported and pasted data |

---

## 5. Test Suites — Detailed Breakdown

Tests run via `npm test` (Jest 29, `testEnvironment: node`). All source files except DOM-dependent ones (`render.js`, `events.js`, `main.js`) are loaded into a `vm.createContext` sandbox that mocks `localStorage`, `document`, `window`, `location`, `URL`, and `CSS`.

**Overall result: 239 tests — 239 passed, 0 failed, 0 skipped.**

---

### 5.1 `tests/utils.test.js` — 34 tests

Tests pure utility functions in `js/utils.js`.

#### `esc()` — 16 tests

HTML-escaping function used before inserting any user data into DOM strings.

| Test | What It Checks | How Verified | Final Output |
|---|---|---|---|
| returns empty string for null | `null` input produces `''` | `expect(ctx.esc(null)).toBe('')` | `''` |
| returns empty string for undefined | `undefined` input produces `''` | `expect(ctx.esc(undefined)).toBe('')` | `''` |
| returns empty string for empty string | `''` input produces `''` | `expect(ctx.esc('')).toBe('')` | `''` |
| escapes ampersand | `'a&b'` → `'a&amp;b'` | strict string equality | `'a&amp;b'` |
| escapes less-than | `'<div>'` → `'&lt;div&gt;'` | strict string equality | `'&lt;div&gt;'` |
| escapes greater-than | `'3>2'` → `'3&gt;2'` | strict string equality | `'3&gt;2'` |
| escapes double-quote | `'"hello"'` → `'&quot;hello&quot;'` | strict string equality | `'&quot;hello&quot;'` |
| escapes single-quote | `"it's"` → `'it&#39;s'` | strict string equality | `'it&#39;s'` |
| escapes forward-slash | `'a/b'` → `'a&#x2F;b'` | strict string equality | `'a&#x2F;b'` |
| escapes backtick | `` '`code`' `` → `'&#96;code&#96;'` | strict string equality | `'&#96;code&#96;'` |
| escapes equals sign | `'x=1'` → `'x&#61;1'` | strict string equality | `'x&#61;1'` |
| escapes multiple special chars | `'<a href="x=1">it\'s</a>'` — full XSS payload | strict string equality | fully escaped entity string |
| leaves plain text unchanged | `'hello world 123'` passes through | strict string equality | `'hello world 123'` |
| coerces numbers to strings | `42` → `'42'` | strict string equality | `'42'` |
| coerces boolean to string | `true` → `'true'` | strict string equality | `'true'` |
| escapes all occurrences | `'a<b<c'` escapes both `<` | strict string equality | `'a&lt;b&lt;c'` |

#### `escAttr()` — 11 tests

Attribute-value escaper that converts any non-`\w-` character to a numeric HTML entity.

| Test | What It Checks | How Verified | Final Output |
|---|---|---|---|
| returns empty string for null | `null` → `''` | `toBe('')` | `''` |
| returns empty string for undefined | `undefined` → `''` | `toBe('')` | `''` |
| leaves alphanumeric unchanged | `'abc123'` passes through | `toBe('abc123')` | `'abc123'` |
| leaves underscore and hyphen unchanged | `'my-attr_value'` passes through | exact equality | `'my-attr_value'` |
| escapes space as numeric entity | `'hello world'` → `'hello&#32;world'` | exact equality | `'hello&#32;world'` |
| escapes less-than | `'<'` → `'&#60;'` | exact equality | `'&#60;'` |
| escapes greater-than | `'>'` → `'&#62;'` | exact equality | `'&#62;'` |
| escapes double-quote | `'"'` → `'&#34;'` | exact equality | `'&#34;'` |
| escapes dot | `'3.14'` → `'3&#46;14'` | exact equality | `'3&#46;14'` |
| escapes forward-slash | `'a/b'` → `'a&#47;b'` | exact equality | `'a&#47;b'` |
| escapes multiple non-word chars | `'<script>'` → `'&#60;script&#62;'` | exact equality | `'&#60;script&#62;'` |

#### `clampStr()` — 8 tests

String-length enforcer used before storing user-supplied names/labels.

| Test | What It Checks | How Verified | Final Output |
|---|---|---|---|
| returns empty string for null | null → `''` | `toBe('')` | `''` |
| returns empty string for undefined | undefined → `''` | `toBe('')` | `''` |
| returns full string when shorter than max | `'hello'` with max 10 | `toBe('hello')` | `'hello'` |
| returns full string when exactly equal to max | `'hello'` with max 5 | `toBe('hello')` | `'hello'` |
| truncates string longer than max | `'hello world'` with max 5 | `toBe('hello')` | `'hello'` |
| truncates to zero characters when max is 0 | any string, max 0 | `toBe('')` | `''` |
| coerces number to string before clamping | `12345` with max 3 | `toBe('123')` | `'123'` |
| handles unicode characters | `'abcdef'` with max 4 | `toBe('abcd')` | `'abcd'` |

#### `SafeStore` (via `setState` / `localStorage`) — 4 tests

Exercises the `SafeStore` IIFE (load/save/clear against mocked `localStorage`).

| Test | What It Checks | How Verified | Final Output |
|---|---|---|---|
| setState persists to localStorage under `agentflow.v1` | state saved as JSON string | `JSON.parse` round-trip, checks `.runs` and `.activeRunId` | parsed object with `runs` array |
| state loaded from localStorage on init | pre-seeded localStorage is read on context creation | creates second context with same store; checks `getActiveRunView()` returns non-null | view object with a run |
| corrupted localStorage falls back to empty state | invalid JSON (`{ invalid json !!!`) does not crash | `getActiveRunView()` returns `null` (no runs) | `null` |
| oversized data is not saved | normal save returns valid state object | `setState` return value is an object with a `runs` array | normalised state object |

---

### 5.2 `tests/data-validation.test.js` — 35 tests

Tests the full `validateRunSchema()` validator in `js/data.js`.

#### `validateRunSchema()` — happy path, 5 tests

| Test | What It Checks | How Verified | Final Output |
|---|---|---|---|
| accepts minimal valid run | only `id`, `name`, `nodes[]`, `edges[]` | `toBeNull()` | `null` |
| accepts run with full optional node fields | `role`, `status`, `durationMs` | `toBeNull()` | `null` |
| accepts run with valid counterfactuals | CF with `id`, `name`, `nodeOverrides` | `toBeNull()` | `null` |
| accepts empty nodes and edges arrays | empty arrays pass | `toBeNull()` | `null` |
| accepts valid edge | edge with valid `from`/`to` | `toBeNull()` | `null` |

#### `validateRunSchema()` — root-level errors, 13 tests

Each test passes an invalid root-level object and expects a specific error string.

| Test | Input | Expected Error | Final Output |
|---|---|---|---|
| rejects null | `null` | `'Root must be an object.'` | error string |
| rejects a string | `'hello'` | `'Root must be an object.'` | error string |
| rejects an array | `[]` | matches `/invalid "id"/` | error string |
| rejects missing id | no `id` field | matches `/invalid "id"/` | error string |
| rejects id with space | `'run 1'` | matches `/invalid "id"/` | error string |
| rejects id > 80 chars | 81-char string | matches `/invalid "id"/` | error string |
| rejects non-string id | `123` | matches `/invalid "id"/` | error string |
| rejects missing name | no `name` field | matches `/"name"/` | error string |
| rejects empty name | `''` | matches `/"name"/` | error string |
| rejects name > 200 chars | 201-char string | matches `/"name"/` | error string |
| rejects nodes not array | `nodes: {}` | matches `/"nodes"/` | error string |
| rejects edges not array | `edges: null` | matches `/"edges"/` | error string |
| rejects > 500 nodes | 501-element array | matches `/Too many nodes/` | error string |
| rejects > 2000 edges | 2001-element array | matches `/Too many edges/` | error string |

#### `validateRunSchema()` — node-level errors, 14 tests

| Test | Node Override | Expected Error |
|---|---|---|
| missing id | `id: undefined` | `'Node 0: invalid "id"'` |
| id with special chars | `id: 'bad id!'` | `'Node 0: invalid "id"'` |
| missing name | `name: ''` | `'Node 0: invalid "name"'` |
| name > 200 chars | 201-char name | `'Node 0: invalid "name"'` |
| content not string | `content: 42` | `'Node 0: "content" must be a string'` |
| content > 10000 chars | 10001-char string | `'Node 0: content too long'` |
| unknown role | `role: 'wizard'` | `'Node 0: invalid role'` |
| no role (optional) | role omitted | `null` (pass) |
| unknown status | `status: 'unknown'` | `'Node 0: invalid status'` |
| no status (optional) | status omitted | `null` (pass) |
| negative durationMs | `durationMs: -1` | `'Node 0: invalid durationMs'` |
| non-numeric durationMs | `durationMs: 'fast'` | `'Node 0: invalid durationMs'` |
| durationMs of 0 | `durationMs: 0` | `null` (pass) |

#### `validateRunSchema()` — edge-level errors, 3 tests

| Test | Edge Override | Expected Error |
|---|---|---|
| invalid `from` id | `from: 'bad id'` | `'Edge 0: invalid "from"'` |
| invalid `to` id | `to: 'bad!to'` | `'Edge 0: invalid "to"'` |
| non-string `from` | `from: 123` | `'Edge 0: invalid "from"'` |

#### `validateRunSchema()` — counterfactual errors, 5 tests

| Test | Input | Expected Error |
|---|---|---|
| counterfactuals not array | `counterfactuals: {}` | `'"counterfactuals" must be an array'` |
| CF with invalid id | `id: 'bad id!'` | `'CF 0: invalid "id"'` |
| CF with missing name | `name: ''` | `'CF 0: invalid "name"'` |
| CF with missing nodeOverrides | `nodeOverrides: null` | `'CF 0: invalid "nodeOverrides"'` |
| CF with nodeOverrides not object | `nodeOverrides: 'bad'` | `'CF 0: invalid "nodeOverrides"'` |

---

### 5.3 `tests/layout.test.js` — 14 tests

Tests `layoutNodes(nodes, edges)` in `js/layout.js`.

**Verification method:** Each test constructs a small graph, calls `layoutNodes`, and asserts `{x, y}` values using the known layout formula:
- `x = 40 + layerIndex × 280`
- `y = max(40, (600 − totalLayerHeight) / 2) + nodeIndexInLayer × 170`

| Test | What It Checks | Final Output |
|---|---|---|
| empty node list | returns `{}` | `{}` |
| single node, layer 0 | `x = 40`, `y = 240` (centred in 600 px) | `{ A: { x: 40, y: 240 } }` |
| two disconnected nodes in layer 0 | both `x = 40`; different `y` values | `A.x === B.x`, `A.y !== B.y` |
| linear chain A→B | A in layer 0 (`x=40`), B in layer 1 (`x=320`) | sequential x values |
| linear chain A→B→C | 3 successive layers | `x` values 40, 320, 600 |
| fan-out A→B and A→C | A in layer 0; B and C share layer 1 | `B.x === C.x`, `B.y !== C.y` |
| fan-in A→C and B→C | A and B in layer 0; C in layer 1 | `A.x === B.x`, `C.x > A.x` |
| all nodes receive a position | 4-node linear chain | 4 entries in result |
| all x coordinates non-negative | fan-out graph | `x >= 0` for all |
| all y coordinates non-negative | fan-out graph | `y >= 0` for all |
| cycle A→B, B→A (fallback) | BFS stalls; both get positions via post-pass | `A.x !== B.x` (different layers) |
| sink node rightmost | A→B→C; C has largest x | `C.x > B.x > A.x` |
| diamond graph A→B, A→C, B→D, C→D | D is beyond B/C | `D.x > B.x` |
| multi-node run layout | 6-node DAG can be laid out | all nodes have numeric `x, y` |

---

### 5.4 `tests/state.test.js` — 53 tests

Tests all state management logic in `js/state.js`.

#### `_normalizeState` / initial state — 8 tests

| Test | What It Checks | Final Output |
|---|---|---|
| initial state has no runs with empty localStorage | `getActiveRunView()` is null | `null` |
| initial state `activeRunId` is null | no runs → null | `null` |
| initial state `activeTab` is `'graph'` | default tab | `'graph'` |
| invalid `activeRunId` with no runs corrected to null | unknown run ID, no runs | `null` |
| `activeTab` normalised | only `'graph'` or `'counterfactuals'` are valid | unknown tab → `'graph'` |
| invalid `activeCounterfactual` set to null | unknown CF ID | `null` |
| invalid `selectedNodeId` set to null | unknown node ID | `null` |
| `nodePositions` defaults to object | always an object | `{}` (or populated) |

#### `_normalizeState` — runs validation — 3 tests

| Test | What It Checks | Final Output |
|---|---|---|
| valid runs preserved | run passing schema stays | same run |
| invalid runs filtered; empty array when none survive | schema-failing run dropped | `[]` |
| runs are deep-cloned | mutating original does not affect stored state | stored run unaffected |

#### `setState()` — 6 tests

| Test | What It Checks | Final Output |
|---|---|---|
| returns normalised state object | return value is an object | state object |
| persists state to localStorage | `agentflow.v1` key contains JSON with `activeTab` | serialised JSON |
| merges patch into existing state | subsequent setState preserves earlier fields | merged state |
| handles null patch | no throw | state object |
| handles undefined patch | no throw | state object |
| setting runs with valid run updates list | new run ID present | updated runs array |

#### `getActiveRunView()` — 4 tests

| Test | What It Checks | Final Output |
|---|---|---|
| returns view object for active run | `run`, `originalRun`, `isCounterfactual`, `overriddenNodeIds` present | view object |
| `overriddenNodeIds` empty for base run | no overrides on base run | `Set.size === 0` |
| `isCounterfactual` false when CF is null | base mode | `false` |
| returns null when there are no runs | after clearing all runs | `null` |

#### `_buildRunView()` — counterfactual view — 8 tests

| Test | What It Checks | Final Output |
|---|---|---|
| non-existent CF ID falls back to base run | invalid CF → no CF view | `isCounterfactual: false` |
| valid CF ID produces counterfactual view | `cf-1` CF is active | `isCounterfactual: true` |
| `overriddenNodeIds` includes overridden node | `n2` was overridden | `has('n2') === true` |
| non-overridden nodes not in overriddenNodeIds | `n1` unchanged | `has('n1') === false` |
| `originalRun` is the base run | original `n2.status === 'success'` | `'success'` |
| CF run has overridden node status | `n2.status === 'failed'` in CF view | `'failed'` |
| CF run uses CF metrics | `totalMs === 50` | `50` |
| CF run `finalAnswer` overrides base | `'No answer.'` | `'No answer.'` |

#### `_materializeCounterfactualRun()` — 9 tests

| Test | What It Checks | Final Output |
|---|---|---|
| merges nodeOverrides into base nodes | `n1.status` becomes `'skipped'` | `'skipped'` |
| non-overridden nodes retain values | `n2.status` stays `'success'` | `'success'` |
| uses CF nodes array when provided | 1-node CF nodes replaces run's 2 nodes | 1 node |
| uses CF edges when provided | reversed edge present | `from: 'n2'` |
| uses run edges when CF has none | original edges preserved | same edge objects |
| CF `finalAnswer` takes priority | `'CF answer'` over `'Original answer'` | `'CF answer'` |
| falls back to run `finalAnswer` when CF has none | `'Original answer'` preserved | `'Original answer'` |
| CF metrics override run metrics | `totalMs: 500`, `failed: 1` | 500, 1 |
| falls back to run metrics when CF has none | `totalMs: 1000` from run | `1000` |

#### Clone helpers — 6 tests

| Test (Suite) | What It Checks | Final Output |
|---|---|---|
| `_cloneNode` returns shallow copy | equal but not same reference | new object with same fields |
| `_cloneEdge` returns shallow copy | equal but not same reference | new object with same fields |
| `_cloneRun` nodes/edges are independent arrays | not same array reference | equal but independent arrays |
| `_cloneRun` counterfactuals array cloned | length preserved, not same reference | length 1 |
| `_cloneRun` missing nodes/edges default to `[]` | partial run object | empty arrays |
| `_cloneNodePositions` returns `{}` for undefined | no input | `{}` |
| `_cloneNodePositions` clones nested positions | `{x:10,y:20}` not same ref | equal but independent |
| `_cloneNodePositions` coerces bad values to 0 | `'bad'` and `null` → 0 | `{x:0,y:0}` |

#### `overriddenNodeIds` edge cases — 2 tests

| Test | What It Checks | Final Output |
|---|---|---|
| node changed only in `durationMs` is detected | `durationMs: 999` vs original `undefined` | `has('n1') === true` |
| node added only in CF is marked overridden | `n3` exists in CF but not base run | `has('n3') === true` |

---

### 5.5 `tests/adapters.test.js` — 103 tests

Tests adapter helpers and all three trace import paths in `js/adapters.js`.

#### `safeId()` — 9 tests

Sanitises raw trace IDs to `SAFE_ID_RE`-compliant strings.

| Test | Input | Expected Output |
|---|---|---|
| preserves alphanumeric | `'abc123'` | `'abc123'` |
| preserves hyphen/underscore | `'my-id_001'` | `'my-id_001'` |
| replaces spaces | `'hello world'` | `'hello_world'` |
| replaces special chars | `'a.b!c@d'` | `'a_b_c_d'` |
| truncates to 80 chars | 100-char string | 80-char string |
| returns `'node'` for empty string | `''` | `'node'` |
| `'!!!'` → `'___'` (not `'node'`) | `'!!!'` | `'___'` |
| handles numeric string | `'42'` | `'42'` |
| handles mixed chars | `'run/id:test'` | `'run_id_test'` |

#### `msDiff()` — 9 tests

Computes ISO timestamp difference in milliseconds.

| Test | Input | Expected Output |
|---|---|---|
| correct ms difference | 1-second apart | `1000` |
| identical timestamps | same timestamp | `0` |
| missing start | `null, '...'` | `undefined` |
| missing end | `'...', null` | `undefined` |
| both missing | `null, null` | `undefined` |
| invalid start | `'not-a-date', '...'` | `undefined` |
| invalid end | `'...', 'not-a-date'` | `undefined` |
| end before start | reversed order | `undefined` |
| large difference (5 years) | 2020→2025 | positive number |

#### `truncate()` — 8 tests

Truncates strings or JSON-stringified objects to a max length, appending `'…'`.

| Test | Input | Expected Output |
|---|---|---|
| null → `''` | `null` | `''` |
| undefined → `''` | `undefined` | `''` |
| string shorter than max | `'hello'`, max 10 | `'hello'` |
| string equal to max | `'hello'`, max 5 | `'hello'` |
| truncates + appends `'…'` | `'hello world'`, max 5 | `'hello…'` |
| uses default max 300 | 301-char string | 301 chars (300 + `'…'`) |
| JSON-stringifies objects | `{key:'value'}` | `'{"key":"value"}'` |
| truncates stringified object | large object, max 10 | 10-char prefix + `'…'` |

#### `inferRole()` — 26 tests

Keyword-based role classification from operation type and name strings.

| Test | Type / Name | Expected Role |
|---|---|---|
| type `'llm'` | llm / — | `'synthesize'` |
| name contains `'openai'` | — / OpenAI Call | `'synthesize'` |
| name contains `'claude'` | — / Claude Response | `'synthesize'` |
| name contains `'gpt'` | — / GPT-4 step | `'synthesize'` |
| name contains `'generat'` | — / text generation | `'synthesize'` |
| type `'retriever'` | retriever / — | `'retrieve'` |
| name contains `'search'` | — / Web Search | `'retrieve'` |
| name contains `'vector'` | — / Vector Lookup | `'retrieve'` |
| name contains `'fetch'` | — / Fetch Documents | `'retrieve'` |
| name contains `'embed'` | — / Embedding Step | `'retrieve'` |
| type `'tool'` | tool / — | `'tool'` |
| name contains `'api'` | — / API call | `'tool'` |
| name contains `'calculator'` | — / Date Calculator | `'tool'` |
| name contains `'parser'` | — / Number Parser | `'tool'` |
| name contains `'plan'` | — / Reasoning Plan | `'plan'` |
| name contains `'reason'` | — / reason step | `'plan'` |
| name contains `'decompos'` | — / decomposition | `'plan'` |
| name contains `'valid'` | — / Validation Step | `'validate'` |
| name contains `'check'` | — / Fact Check | `'validate'` |
| name contains `'guard'` | — / Guard Rail | `'validate'` |
| name contains `'output'` | — / Final Output | `'output'` |
| name contains `'response'` | — / Response Formatter | `'output'` |
| name contains `'final'` | — / Final Answer | `'output'` |
| name contains `'answer'` | — / answer step | `'output'` |
| unknown type and name | unknown / mystery step | `'plan'` (default) |
| case-insensitive | `'LLM'` / `'VECTOR SEARCH'` | `'synthesize'` / `'retrieve'` |

#### `inferStatus()` — 6 tests

| Test | Input | Expected Output |
|---|---|---|
| falsy `undefined` | `undefined` | `'success'` |
| falsy `null` | `null` | `'success'` |
| empty string | `''` | `'success'` |
| non-empty string error | `'something went wrong'` | `'failed'` |
| Error object | `new Error('boom')` | `'failed'` |
| non-empty object | `{ code: 500 }` | `'failed'` |

#### `detectFormat()` — 9 tests

| Test | Input | Expected Output |
|---|---|---|
| null | `null` | `null` |
| non-object | `'string'`, `42` | `null` |
| LangSmith: `run_type` present | `{ run_type: 'chain' }` | `'langsmith'` |
| LangFuse: `observations[]` present | `{ observations: [] }` | `'langfuse'` |
| Weave: root has `op_name` | `{ op_name: '...' }` | `'weave'` |
| Weave: first array element has `op_name` | `[{ op_name: '...' }]` | `'weave'` |
| empty array | `[]` | `null` |
| unrecognised object | `{ foo: 'bar' }` | `null` |
| LangSmith takes priority | both `run_type` and `observations` | `'langsmith'` |

#### `importFromThirdParty()` — LangSmith — 10 tests

| Test | What It Checks | Final Output |
|---|---|---|
| returns `{ run, format }` | no `error`, `format === 'langsmith'` | `{ run, format: 'langsmith' }` |
| run passes validateRunSchema | schema error is null | `null` |
| run name from trace | `name: 'History QA'` | `run.name === 'History QA'` |
| 1 node for flat trace | no children | `nodes.length === 1, edges.length === 0` |
| node count with `child_runs` | 2 children → 3 nodes, 2 edges | `3, 2` |
| failed node when `error` field present | `run.nodes[0].status === 'failed'` | `'failed'`, `metrics.failed === 1` |
| `durationMs` from timestamps | 1-second gap | `1000` |
| tokens from `extra.usage_metadata` | `total_tokens: 150` | `metrics.tokens === 150` |
| accumulates tokens from children | 80 + 70 tokens | `metrics.tokens === 150` |
| fallback run name | no `name` field | `'LangSmith Import'` |
| role inferred from `run_type` | `run_type: 'llm'` | `node.role === 'synthesize'` |

#### `importFromThirdParty()` — LangFuse — 6 tests

| Test | What It Checks | Final Output |
|---|---|---|
| format `'langfuse'`, schema pass | `format === 'langfuse'`, schema null | `null` |
| virtual root node `role: 'input'` | `nodes[0].role === 'input'` | `'input'` |
| 1 node per observation + root | 2 observations → 3 nodes, 2 edges | `3, 2` |
| `level: ERROR` → failed node | `failedNode.status === 'failed'` | `'failed'` |
| token usage from `usage.totalTokens` | `totalTokens: 120` | `metrics.tokens === 120` |
| run name from trace name | `name: 'My Trace'` | `run.name === 'My Trace'` |

#### `importFromThirdParty()` — Weave (nested) — 7 tests

| Test | What It Checks | Final Output |
|---|---|---|
| format `'weave'`, schema pass | valid run | `null` |
| 1 node for single-call trace | no children | `nodes.length === 1` |
| `display_name` as run name | `display_name: 'Custom Name'` | `run.name === 'Custom Name'` |
| name extracted from `op_name` path | `op_name: 'weave:///op/RetrieveStep:1'` | `run.name === 'RetrieveStep'` |
| node count for nested children | 2 children → 3 nodes, 2 edges | `3, 2` |
| `exception` → failed node | `exception: 'TimeoutError'` | `status === 'failed'`, `metrics.failed === 1` |
| token usage from `output.usage` | `total_tokens: 200` | `metrics.tokens === 200` |

#### `importFromThirdParty()` — Weave (flat/array) — 2 tests

| Test | What It Checks | Final Output |
|---|---|---|
| detects Weave format from flat array | `format === 'weave'`, schema pass | `null` |
| builds edges from `parent_id` relationships | parent→child edges present | at least 1 edge |

#### `importFromThirdParty()` — error cases — 3 tests

| Test | What It Checks | Final Output |
|---|---|---|
| unrecognised JSON format | `result.error` is set | error string |
| null input | `result.error` is set | error string |
| string input | `result.error` is set | error string |
| does not throw for recognised formats | try/catch in adapter | no exception |

---

## 6. Verification Method Summary

| Method | Description |
|---|---|
| **Unit assertions** | `expect(value).toBe(expected)` — strict equality for primitives |
| **Deep equality** | `toEqual()` — recursive structural comparison for objects/arrays |
| **Regex matching** | `toMatch(/pattern/)` — error-message content without exact wording |
| **Null checks** | `toBeNull()` / `not.toBeNull()` — schema validation pass/fail |
| **Type checks** | `typeof value === 'string'` / `toBe('number')` |
| **Length checks** | `toHaveLength(n)` / `toBeGreaterThan(n)` |
| **Reference isolation** | `not.toBe(original)` — confirms deep clone, not alias |
| **Set duck-typing** | `typeof .has === 'function'` — cross-vm-context Set instances |
| **localStorage round-trip** | `JSON.parse(localStorage._store['agentflow.v1'])` |
| **vm sandbox** | `vm.createContext` + `vm.runInContext` — isolates each test; mocks `document`, `window`, `localStorage`, `location` |

---

## 7. Security Findings

| Finding | Severity | Status |
|---|---|---|
| All user-visible strings pass through `esc()` before DOM insertion | — | Mitigated |
| HTML attribute values use `escAttr()` (numeric entity encoding) | — | Mitigated |
| IDs validated against `SAFE_ID_RE` — rejects spaces, slashes, injection chars | — | Mitigated |
| CSP `default-src 'self'` blocks inline scripts and external origins | — | Mitigated |
| `SafeStore` 4 MB cap prevents localStorage DoS | — | Mitigated |
| `validateRunSchema` length caps prevent oversized payloads | — | Mitigated |
| No dynamic `eval`, `Function()`, `innerHTML` with unescaped data, or `document.write` | — | Clean |
| Secrets: no API keys, tokens, or credentials anywhere in source | — | Clean |
| `style-src 'self' 'unsafe-inline'` is the only CSP relaxation; required for inline node colour variables | Low / accepted | Documented |
