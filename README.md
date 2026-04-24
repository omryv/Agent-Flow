# AgentFlow

**Counterfactual trace engine for LLM agent executions.**

AgentFlow lets you visualize, inspect, and replay agent runs as interactive directed acyclic graphs. Import traces from LangSmith, LangFuse, or Weights & Biases Weave, then ask "what if this node had failed?" and watch the downstream answer change in real time.

Zero build step. Zero dependencies. One HTML file, ten JavaScript modules, one stylesheet. Ship it with a static file server and nothing else.

---

## The Problem

Modern LLM agent frameworks produce complex, multi-step execution traces - retrieval calls, tool invocations, planning loops, synthesis passes - but the tooling to understand those traces is either locked inside proprietary dashboards or requires heavyweight local infrastructure. Worse, none of them answer the question that actually matters during debugging: *what would have happened differently?*

AgentFlow exists to close that gap.

---

## What It Does

**Graph visualization.** Every agent step renders as a color-coded node - Input, Retrieve, Plan, Tool, Synthesize, Validate, Output connected by dependency edges and laid out automatically via Kahn's topological sort. Drag any node to reposition; the layout persists across sessions.

**Counterfactual reasoning.** Override any node's status or content and immediately see how metrics, downstream nodes, and the final answer change. This turns post-hoc trace inspection into an interactive debugging surface.

**Universal import.** Drop in raw JSON from LangSmith, LangFuse, or W&B Weave. The adapter layer auto-detects the format, infers node roles from operation names, extracts token usage from format-specific locations, and produces a validated native run. Export and re-import in AgentFlow's own `.agentflow.json` format.

**Metrics at a glance.** Total latency, token consumption, node counts, and success/failure breakdowns — all updated live with counterfactual deltas so you can quantify the impact of each hypothetical change.

---

## Architecture

The entire application is a pure static site. No framework, no bundler, no package manager. Ten JavaScript files loaded in dependency order via script tags, each owning a single concern: constants, utilities, data validation, state management, DAG layout, third-party adapters, drag mechanics, DOM rendering, event handling, and boot.

State flows in one direction. A user action triggers a handler, which calls `setState`, which triggers a full DOM rebuild from HTML-string builder functions. No virtual DOM, no diffing acceptable because agent graphs are small (under 500 nodes) and renders complete in under five milliseconds.

Drag is the sole exception. During mouse movement, the drag module mutates DOM positions and SVG edge paths directly for 60fps responsiveness. Only on mouse-up does it commit the final position to state and trigger a single re-render.

---

## Technical Decisions and Why They Matter

**Global functions over ES modules.** This keeps the deploy story at "push static files." No transpilation, no tree-shaking, no source maps to debug. When something breaks, the stack trace points to exactly one file, and fixing it requires no rebuild.

**Format detection over explicit configuration.** The adapter layer identifies LangSmith by the presence of `run_type`, LangFuse by `observations[]`, and Weave by `op_name`. Users drop in a file and it works. No format selection dialogs, no version flags.

**DOM destruction over diffing.** For a tool where the graph rarely exceeds a few hundred nodes, the complexity cost of a diffing algorithm is not justified. Full rebuilds are fast, predictable, and trivially debuggable.

---

## Deployment

Push to GitHub. Point Vercel at the repo with framework preset set to "Other" and every build field left blank. The included `vercel.json` handles security headers, immutable caching for JS and CSS assets, no-cache for the HTML entry point, and SPA rewrites that exclude static paths.

Running locally is equally simple: `python3 -m http.server 8000` or `npx serve .`  no install step.

---

## MVP Roadmap: Next — LangChain Native Integration

The next milestone transforms AgentFlow from a trace viewer into a first-class debugging layer for LangChain applications.

**Phase 1 - LangChain callback handler.** A lightweight Python callback handler that emits `.agentflow.json` traces directly from any LangChain `chain.invoke()` or `agent.run()` call. No intermediate export to LangSmith required. Install with pip, attach the handler, and traces stream to disk or to a local AgentFlow instance over a WebSocket.

**Phase 2 - Live streaming.** Real-time trace rendering as the agent executes. Nodes appear and transition through states  pending, running, succeeded, failed - as the LangChain callback fires events. Counterfactual mode remains available on completed nodes while the run is still in progress.

**Phase 3 - Breakpoint debugging.** Pause a live LangChain agent run at any node, inspect intermediate state, optionally edit the node's output, and resume execution with the modified value. This turns AgentFlow into an interactive debugger, not just a visualizer.

**Phase 4 - Comparative analysis.** Side-by-side rendering of two or more runs of the same chain with structural diff highlighting. Identify which node diverged, why latency changed, or where token usage spiked between prompt iterations.

**Phase 5 - Collaboration and persistence.** Shareable trace URLs, annotation layers for team review, and a thin persistence backend (SQLite or Postgres) for trace history and search. The static-site philosophy remains intact for the viewer; the backend is optional infrastructure for teams that need it.

---

*Built by Omry Damari.*
