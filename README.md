# AgentFlow
[![Live](https://img.shields.io/badge/live-trace.observer-5f7ef5)](https://trace.observer)
[![Security Headers: A+](https://img.shields.io/badge/Security%20Headers-A%2B-brightgreen?style=flat)](https://securityheaders.com/?q=trace.observer&followRedirects=on)
[![Mozilla Observatory](https://img.shields.io/mozilla-observatory/grade/trace.observer?publish&label=Mozilla%20Observatory)](https://developer.mozilla.org/en-US/observatory/analyze?host=trace.observer)
[![Tests](https://github.com/Visigence/Agent-Flow/actions/workflows/test.yml/badge.svg)](https://github.com/Visigence/Agent-Flow/actions/workflows/test.yml)
[![License](https://img.shields.io/github/license/Visigence/Agent-Flow)](LICENSE)
[![Release](https://img.shields.io/github/v/tag/Visigence/Agent-Flow?label=release)](https://github.com/Visigence/Agent-Flow/releases/tag/AFV1.0)

> **A read-only counterfactual inspector for LLM agent execution traces.**

AgentFlow imports traces from LangSmith, LangFuse, W&B Weave, or native `.agentflow.json` files and renders agent execution as an interactive directed acyclic graph. Toggle between the original run and embedded counterfactual scenarios to see exactly which nodes changed, how metrics shifted, and what the final answer would have been.


<p align="center">
  <a href="#preview">Preview</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#security">Security</a> •
  <a href="#release-status">Release Status</a> •
  <a href="./LICENSE">License</a>
</p>

---

## Preview

<table>
  <tr>
    <td align="center" width="50%">
      <img src="./docs/8.png" alt="AgentFlow trace graph view" width="80%"><br>
      <sub><b>Trace Graph View</b><br>Interactive DAG of agent execution</sub>
    </td>
    <td align="center" width="50%">
      <img src="./docs/10.png" alt="AgentFlow metrics and final answer preview" width="80%"><br>
      <sub><b>Metrics & Final Answer</b><br>Counterfactual diff and outcome comparison</sub>
    </td>
  </tr>
</table>

---

## Architecture

Modules follow a strict dependency hierarchy. Each file may only reference names introduced by files above it in the chain. **No circular dependencies.**

```text
constants.js
    └─▶ utils.js
            └─▶ data.js
                    └─▶ state.js
                            └─▶ layout.js
                                    └─▶ adapters.js
                                            └─▶ render.js
                                                    └─▶ events.js
                                                            └─▶ main.js
```

---

## Security

Validated against static bundle scanning, header configuration, and transport-layer integrity benchmarks.

<table>
  <tr>
    <td align="center" width="50%">
      <img src="./docs/1.png" alt="SecurityHeaders A+" width="100%"><br>
      <sub><b>SecurityHeaders: A+</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="./docs/2.png" alt="Platform scan" width="100%"><br>
      <sub><b>Platform Scan Overview</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="./docs/3.png" alt="Infrastructure validation" width="100%"><br>
      <sub><b>Infrastructure Validation</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="./docs/6.png" alt="Bundle secret scan" width="100%"><br>
      <sub><b>Bundle Secret Scan: Clean</b></sub>
    </td>
  </tr>
</table>

---

## Release Status

> All known release blockers resolved. Application has passed static deployment validation, security-header validation, canonical redirect checks, TLS verification, and bundle secret scanning.

### Asset & Configuration Integrity

| Check | Status |
|---|---|
| `assets/favicon.png` present and referenced via `<link rel="icon">` | ✅ |
| CSP `<meta>` directive matches deployed HTTP header | ✅ |
| Internal project/source files return `404` | ✅ |

### Transport & Canonicalization

| Check | Status |
|---|---|
| SecurityHeaders grade for `https://www.trace.observer/` | **A+** |
| Apex redirects to `https://www.trace.observer/` | ✅ |
| Path preservation on redirect (e.g. `/js/main.js`) | ✅ |
| Final canonical responses return `200` | ✅ |
| TLS certificate valid for apex and `www` hostnames | ✅ |

### Bundle Secret Scan

Static scan found no API keys, secrets, passwords, bearer tokens, or authorization credentials. Only non-sensitive matches surfaced (e.g. `token_usage`).

### Required Security Headers

<table>
  <tr>
    <td>

- `Content-Security-Policy`
- `Permissions-Policy`
- `Referrer-Policy`
- `Strict-Transport-Security`
- `X-Content-Type-Options`

    </td>
    <td>

- `X-Frame-Options`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`
- `Cross-Origin-Embedder-Policy`

    </td>
  </tr>
</table>

### Test Suite

```bash
npm test
# ✓ 260 tests passing
```

---

<p align="center">
  <sub>
    Copyright © 2026 <b>Omry Damari — Visigence</b>. All rights reserved.<br>
    Proprietary and confidential. See <a href="./LICENSE">LICENSE</a> for terms.<br>
    Security disclosures: <a href="./SECURITY.md">SECURITY.md</a>
  </sub>
</p>
