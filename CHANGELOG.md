# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

## [Unreleased]

### Changed
- Preserve graph scroll position and keyboard focus across state-driven re-renders
- Active tab (`graph` / `counterfactuals`) is now preserved when switching between runs
- Run list items use `role="option"` with `aria-selected`; tab bar items use `aria-selected`; graph nodes use `aria-pressed` to expose selection state to assistive technologies
- `escAttr()` is now used consistently for all HTML attribute value contexts in `render.js` (previously `esc()` was used in some attribute positions; IDs are unchanged since they satisfy `SAFE_ID_RE`)

### Fixed
- Logic Engine no longer suggests an empty "If 0 steps had failed" counterfactual: cutting a virtual `terminal > __answer__` edge now marks the terminal step as failed, and suggestions with no affected nodes are dropped

### Planned
- Command palette for advanced navigation
- Node search and filtering
- Live streaming trace support
- Additional export formats
