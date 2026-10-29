# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Every click inside the app was dispatched twice, because `installDelegation()` listened on both `#app` and `document`. Toggle actions cancelled themselves: clicking a node did not open it, clicking a counterfactual card did not activate it, and **Compute counterfactuals** ran twice. Delegation now listens on `document` only
- The import dialog and the error panel no longer use inline `style` attributes, which the production CSP (`style-src 'self'`) blocked; their styles now live in `styles.css`

### Added
- `tests/events.test.js`: replays clicks and changes the way a browser bubbles them and asserts each action fires exactly once
- **Try an example** on the empty screen: loads a built-in customer support agent run (`public/js/example.js`) with two "What if" scenarios and a three-step guide; `tests/example.test.js` validates it
- "by Visigence" link in the header

### Planned
- Command palette for advanced navigation
- Live streaming trace support
- Additional export formats

## [3.0.0] - 2026-10-29

### Added
- CI (`.github/workflows/ci.yml`) on every push to `main` and every pull request: verifies every SRI hash in `public/index.html` and runs the full test suite on Node 18, 20 and 22. Actions are pinned to full commit SHAs, the token is read-only, and no credentials, secrets or caches are used
- `.github/scripts/verify-sri.js`: dependency-free check that every script and stylesheet in `public/index.html` carries a `sha384` integrity attribute matching its file
- Subresource Integrity (`sha384`) on all 14 scripts and the stylesheet

### Changed
- **Breaking (development):** `package.json` and `package-lock.json` are removed. The deployed site has no dependencies and no build step; tests run with `npx --yes jest@30.5.2 --config '{}'`
- `public/` is the only deployed directory (`outputDirectory` in `vercel.json`); the duplicate root `index.html` is removed
- CSP `style-src` no longer allows `'unsafe-inline'`: data-driven positions and colours are applied through CSSOM (`applyDynamicStyles`) instead of inline `style` attributes
- Logic Engine revisions are computed once per trace topology and reused for every node, re-render and "Compute counterfactuals" pass, instead of once per node (40-step trace in Chromium: ~3.7 s → ~0.14 s). Suggestions are unchanged
- Source file headers now carry `SPDX-License-Identifier: Apache-2.0`, matching `LICENSE`; the conflicting "Proprietary / All rights reserved" notices are removed
- README rewritten from a full scan of the code, with verified architecture, data model, security model, test inventory and known issues

### Fixed
- Logic Engine no longer suggests an empty "If 0 steps had failed" counterfactual: cutting a virtual `terminal > __answer__` edge now marks the terminal step as failed, and suggestions with no affected nodes are dropped

## Shipped by V2.0.0 (not individually recorded)

### Changed
- Preserve graph scroll position and keyboard focus across state-driven re-renders
- Active tab (`graph` / `counterfactuals`) is now preserved when switching between runs
- Run list items use `role="option"` with `aria-selected`; tab bar items use `aria-selected`; graph nodes use `aria-pressed` to expose selection state to assistive technologies
- `escAttr()` is now used consistently for all HTML attribute value contexts in `render.js` (previously `esc()` was used in some attribute positions; IDs are unchanged since they satisfy `SAFE_ID_RE`)

## [0.1.0] - 2026-04-26

### Added
- Initial release of AgentFlow counterfactual trace engine
- Native `.agentflow.json` schema with full validation
- Import adapters for LangSmith, LangFuse, and W&B Weave trace formats
- Interactive DAG visualization with Kahn's BFS layout algorithm
- Counterfactual scenario viewing with node override support
- Metrics tracking (totalMs, tokens, nodes, successful, failed)
- Export functionality for re-importing traces
- Keyboard shortcuts for navigation and actions
- Example trace files in `examples/` directory
- Comprehensive test suite with 255 tests across 5 suites
- Security controls: CSP, HTML entity escaping, ID validation, schema caps
- SafeStore with 4 MB localStorage quota enforcement
- Error boundary for graceful error handling
- Dark theme UI with glass morphism design

### Fixed
- Update copyright holder in LICENSE file (6be450a)
- Revise agent name and description with core principles (d4e2d1c)

### Security
- Content Security Policy enforced via meta tag and HTTP headers
- HTML entity escaping for all user-controlled content
- ID validation with SAFE_ID_RE pattern
- Schema length caps on names, content, nodes, and edges
- Import file size cap at 2 MB
- No eval or dynamic code execution
- Referential integrity validation for edges
