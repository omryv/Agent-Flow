
# AgentFlow

AgentFlow is a client-side agent trace visualizer and counterfactual reasoning tool. Import execution traces from LangSmith, LangFuse, or W&B Weave, inspect node-level behavior through a directed graph UI, and explore "what if" scenarios powered by a built-in Logic Engine.

## Architecture

```
utils.js
  └─▶ constants.js
        └─▶ data.js
              └─▶ adapters.js
                    └─▶ layout.js
                          └─▶ state.js
                                └─▶ graph.js
                                      └─▶ facts.js
                                            └─▶ explain.js
                                                  └─▶ revision.js
                                                        └─▶ counterfactual.js
                                                              └─▶ render.js
                                                                    └─▶ events.js
                                                                          └─▶ main.js
```

All scripts load as classic `<script>` tags in dependency order. No bundler, no framework, no build step. `function` declarations hoist to the global scope; `class` and `const` declarations are accessible through the sequential evaluation chain.

### Core Modules

| File | Responsibility |
|---|---|
| `utils.js` | HTML escaping (`esc`, `escAttr`), `SafeStore` (localStorage with 4 MB cap), `ErrorBoundary` |
| `constants.js` | Role/status definitions, SVG icons, `SAFE_ID_RE` |
| `data.js` | `validateRunSchema` — structural validation for runs, nodes, edges, counterfactuals |
| `adapters.js` | Import adapters for LangSmith, LangFuse, W&B Weave; role/status inference |
| `layout.js` | `layoutNodes` — Kahn's algorithm topological sort producing layered x/y positions |
| `state.js` | Immutable state management, deep cloning, counterfactual materialization |
| `render.js` | Full HTML string builder for every UI component; `innerHTML` swap per render cycle |
| `events.js` | Delegated click/change/keydown handling, import/export, keyboard shortcuts |
| `main.js` | Three-line bootstrap: `ErrorBoundary.install()`, `installDelegation()`, `render()` |

### Logic Engine

| File | Responsibility |
|---|---|
| `graph.js` | Adjacency construction, BFS reachability, path finding, transitive closure, edge filtering |
| `facts.js` | `Fact` and `Query` classes, `parseFacts`, set operations on fact maps |
| `explain.js` | Human-readable revision explanations with collateral reporting |
| `revision.js` | Minimum belief revision: `reviseToFalsify`, `reviseToSatisfy`, Pareto frontier filtering. Registers `window.LogicEngine` |
| `counterfactual.js` | Bridge between Logic Engine and AgentFlow state. Converts traces to fact sets, computes Pareto-optimal counterfactual suggestions, materializes them into the native schema. Registers `window.AgentFlowCounterfactual` |

## Import Formats

AgentFlow accepts `.agentflow.json` natively and auto-detects three third-party formats:

- **LangSmith** — root object has `run_type`; walks `child_runs` recursively
- **LangFuse** — root object has `observations` array; sorted by `startTime`
- **W&B Weave** — root object (or first array element) has `op_name`; supports nested `children` and flat `parent_id` layouts

Import via the UI button, `Cmd+I` / `Ctrl+I`, paste JSON, or drag-and-drop. Max 2 MB.

## Counterfactual Reasoning

The Logic Engine converts an agent trace into a directed graph of entailment facts, then computes minimum-cost revisions that would disconnect the source from the final answer. Each revision is a set of edges whose removal breaks reachability — translated into node-level status overrides (failed) in AgentFlow's counterfactual schema.

Suggestions are Pareto-optimal on cost (number of edits) and collateral (unintended entailment changes). The "Compute counterfactuals" button generates up to 6 scenarios across all nodes; selecting a node in the detail panel shows up to 4 targeted suggestions.

## Security

All security headers are configured in `vercel.json`:

- `Content-Security-Policy`: `default-src 'none'`; `script-src 'self'`; `style-src 'self' 'unsafe-inline'` (required for data-driven inline positioning); `img-src 'self' data:`
- `Strict-Transport-Security`: HSTS with 2-year max-age, preload
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`
- `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`
- `Permissions-Policy`: all features denied

All user-controlled strings pass through `esc()` (8-char entity encoding) and `escAttr()` (numeric entity encoding) before reaching `innerHTML`. No `eval`, `Function()`, or `document.write`.

## Development

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Test

```bash
npm test
```

524 tests across 10 suites covering data validation, adapters, layout, state management, graph operations, fact parsing, belief revision, explanation generation, and counterfactual integration.

### Test Infrastructure

| File | Purpose |
|---|---|
| `tests/helpers/loadContext.js` | Concatenates all 11 source files into a single vm sandbox with mocked browser globals. Used by app-layer tests. |
| `tests/helpers/engine.js` | Concatenates the 4 Logic Engine files into a vm sandbox with shared built-ins. Used by engine-layer tests. |

### Deploy

```bash
# Vercel (production)
vercel --prod

# Local preview
npx serve public
```

### File Structure

```
public/
  index.html
  css/styles.css
  js/
    utils.js
    constants.js
    data.js
    adapters.js
    layout.js
    state.js
    graph.js
    facts.js
    explain.js
    revision.js
    counterfactual.js
    render.js
    events.js
    main.js
tests/
  helpers/
    loadContext.js
    engine.js
  adapters.test.js
  counterfactual.test.js
  data-validation.test.js
  explain.test.js
  facts.test.js
  graph.test.js
  layout.test.js
  revision.test.js
  state.test.js
  utils.test.js
vercel.json
```

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `/` | Focus search |
| `G` | Switch to Graph tab |
| `C` | Switch to Counterfactuals tab |
| `↑` / `↓` | Cycle runs |
| `←` / `→` | Cycle nodes |
| `Cmd+I` | Import |
| `Cmd+E` | Export |
| `Esc` | Close modal / deselect node |

## License

Copyright © 2026 Omry Damari - "Visigence Studio"
