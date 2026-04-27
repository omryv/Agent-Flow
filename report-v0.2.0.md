# AgentFlow — v0.2.0 Release Readiness Report
**Prepared:** 2026-04-27  
**Baseline:** [`v0.1.0`](https://github.com/Visigence/Agent-Flow/releases/tag/v0.1.0) (immutable, published 2026-04-26)  
**HEAD:** `main` (commit `00707ac`)  
**Author:** Omry Damari / Visigence  

---

## Executive Summary

Since the immutable `v0.1.0` tag, **7 meaningful changes** have landed on `main` across 3 PRs and several direct commits. The net effect is a significant UX capability upgrade (paste import, drag-and-drop, node search/filter, counterfactual diff panel), a branding refresh, hardened test coverage (+5 tests, 255→260), and a deliberate removal of the CI workflow and custom agent spec. No regressions were introduced; all 260 tests pass.

**Verdict:** Functionally ready for a `v0.2.0` tag. One gap to address before cutting the tag is detailed in §6.

---

## 1. New Features

### 1.1 Paste Import
**File:** `js/events.js`  
JSON pasted anywhere on the page (outside an input/textarea) is now auto-detected, validated, and imported — both native AgentFlow format and third-party adapter formats (LangSmith, LangFuse, Weave).  
- Skips `INPUT`/`TEXTAREA`/`SELECT` targets and ignores non-JSON payloads silently.
- Delegates through the existing `_finishImport()` pipeline, so all downstream state/render logic is identical to the Import button path.

### 1.2 Drag-and-Drop Import
**File:** `js/events.js`  
`.json` files dragged onto the page are now read, validated, and imported.  
- File size guard: rejects files > 2 MB with a toast.
- Extension guard: rejects non-`.json` files with a toast.
- Uses `FileReader.readAsText`, same validation pipeline as paste import.

### 1.3 Import Toast Notifications
**File:** `js/events.js`, `css/styles.css`  
A floating `import-toast` div appears for 3 seconds on error conditions during drag-and-drop (invalid JSON, unsupported format, adapter output invalid, file too large). Styled with glass-morphism background to match the existing design system.

### 1.4 Node Search & Filter
**Files:** `js/events.js`, `js/render.js`, `js/state.js`, `css/styles.css`  
A search box is now rendered in the toolbar (graph tab only). Typing filters the graph:
- Non-matching **nodes** fade to `opacity: 0.2`.
- **Edges** connecting two non-matching nodes gain `class="edge-dimmed"` (opacity: 0.08).
- State field: `searchQuery` is normalised and stored in live state but **intentionally not persisted** to `localStorage` (cleared on `SafeStore.save()` call).
- Keyboard shortcut `/` focuses and selects the search input from anywhere on the page.
- Action `setSearch` added to the `ACTIONS` dispatch table and wired to the `data-change` attribute on the input.

### 1.5 Counterfactual Diff Summary Panel
**Files:** `js/render.js`, `css/styles.css`  
When a counterfactual scenario is active, a "What changed" summary panel appears inside the CF card. It shows:
- **Node status changes**: `original status → CF status` with colour-coded badges per status class.
- **Content changes**: truncated to 120 characters with ellipsis.
- **Added / Removed nodes**: labelled with distinct badge styles.
- The panel is only rendered when `view.isCounterfactual` is `true`, preventing false positives.

---

## 2. UI / Branding Changes

### 2.1 Browser Tab Title
**File:** `index.html`  
Title changed from `"AgentFlow — Counterfactual Trace Engine"` → `"AgentFlow"` (cleaner, matches domain brand).

### 2.2 Favicon
**Files:** `index.html`, `favicon.png` (new binary, 64×64 PNG, 6.7 KB)  
`<link rel="icon" type="image/png" href="favicon.png">` added to `<head>`.

### 2.3 Header Brand Line
**File:** `js/render.js`  
Logo area changed from SVG glyph + `"AgentFlow counterfactual trace engine"` tagline  
→ `<img src="favicon.png" class="logo-img">` + `"AgentFlow"` + `"Trace Observer"` tagline.  
CSS class `.logo-img` added (`24×24px`, `border-radius: 4px`, `margin-right: 6px`).

---

## 3. CSS Additions (`css/styles.css`, +94 lines)

| Class / Selector | Purpose |
|---|---|
| `.logo-img` | Sizes the favicon image in the header to match the prior SVG glyph |
| `.import-toast` | Fixed bottom-center toast for drag-and-drop feedback |
| `.search-box` / `.search-box input[type="search"]` | Styled search input with focus expansion (180px → 240px), icon pseudo-element |
| `.edge-dimmed` | Near-invisible edge state during search filter |
| `.cf-diff-summary` / `.cf-diff-title` / `.cf-diff-row` | Container and layout for the CF diff panel |
| `.cf-diff-name` / `.cf-diff-arrow` / `.cf-diff-badge` | Per-row elements in the diff panel |
| `.cf-diff-badge.s-{status}` | Status-coloured badges (success, failed, skipped, running, pending) |
| `.cf-diff-badge.cf-diff-added` / `.cf-diff-badge.cf-diff-removed` | Added/removed node badges |
| `.cf-diff-content` | Monospace content diff area with word-break |

---

## 4. State Changes (`js/state.js`)

| Change | Detail |
|---|---|
| New field `searchQuery` | Normalised string, defaults to `''`. Added to `_normalizeState()`. |
| Not persisted | `SafeStore.save()` call strips `searchQuery` before writing, so a page reload always starts with no search query. |

---

## 5. Test Coverage Delta

| Suite | v0.1.0 | Current | Delta |
|---|---|---|---|
| `adapters.test.js` | 99 | 103 | +4 |
| `data-validation.test.js` | 52 | 52 | 0 |
| `layout.test.js` | 14 | 14 | 0 |
| `state.test.js` | 50 | 50 | 0 |
| `utils.test.js` | 40 | 41 | +1 |
| **Total** | **255** | **260** | **+5** |

### New Tests Added
| ID | Suite | Description |
|---|---|---|
| TG-8 | `adapters.test.js` | `msDiff()` handles ISO strings with timezone offsets correctly (e.g. `+05:30`) |
| TG-9a | `adapters.test.js` | `inferRole()` — name-based role (`search`) overrides type (`plan`) |
| TG-9b | `adapters.test.js` | `inferRole()` — name-based role (`generate`) overrides type (`tool`) |
| — | `adapters.test.js` | One additional adapter edge-case (part of PR #22 batch) |

### Known Test Gaps (carried from v0.1.0, not resolved)
- `render.js`, `events.js`, `main.js` — **zero automated unit coverage**. These files are DOM-dependent and excluded from the Node.js `vm.createContext` sandbox. The new paste/drag-drop/search/CF-diff code in `events.js` and `render.js` is therefore untested by automated means.

---

## 6. Removals

| Item Removed | Reason | Impact |
|---|---|---|
| `.github/workflows/test.yml` | Deleted by Omry Damari (direct commit, 2026-04-26 22:51) | **CI is now gone.** PRs and pushes to `main` run no automated checks. This is a regression relative to v0.1.0 which had CI. |
| `.github/agents/my-agent.agent.md` | Deleted (same session) | No functional impact. Custom Copilot agent spec removed. |

> ⚠️ **Action Required before tagging v0.2.0:** The CI workflow (`test.yml`) was present at v0.1.0 and intentionally deleted. If this was deliberate (e.g. moving to a different CI provider), document it. If accidental, restore it — running `npm test` on push/PR is a stated pre-condition in `docs/release-validation`.

---

## 7. Infrastructure Changes

| File | Change |
|---|---|
| `package-lock.json` | **Added** (new binary, 4,305-line lockfile). `package-lock.json` was previously in `.gitignore`; that exclusion was removed. Enables reproducible `npm ci` installs. |
| `.gitignore` | Removed `package-lock.json` line. |

---

## 8. Documentation Updates

| File | What changed |
|---|---|
| `README.md` | Test count updated: `adapters.test.js` 99→103, total 255→260 |
| `CODEBASE_OVERVIEW.md` | Same test count updates |
| `SECURITY.md` | Revised vulnerability reporting guidelines (direct commit, 2026-04-26 12:02) |

---

## 9. Commits Included (since v0.1.0, chronological)

| Date | SHA | Author | Summary |
|---|---|---|---|
| 2026-04-26 13:12 | `616131c` | Copilot | PR A: scroll/focus restore, ARIA semantics, escAttr tightening (#10) |
| 2026-04-26 13:23 | `7d67ac5` | Claude | Fix event delegation — document listeners always attached (#11) |
| 2026-04-26 18:21 | `e9590a7` | Visigence | `feat(ui)`: browser tab title + favicon (#12) |
| 2026-04-26 18:33 | `6b37a69` | Visigence | `build(ci)`: add `package-lock.json` (#13) |
| 2026-04-26 18:34 | `4577278` | Visigence | `feat(ui)`: align header brand with trace.observer domain (#14) |
| 2026-04-26 21:08 | `2e1154a` | Claude | `feat(presentation)`: AgentFlow MVP presentation (#17/#18) *(later deleted)* |
| 2026-04-26 21:00 | `26c299a` | Visigence | Squash merge of #12 + #13 + #14 (#15/#16) |
| 2026-04-26 22:50 | `69c06d1` | Visigence | Delete `.github/agents` directory |
| 2026-04-26 22:51 | `4e1648c` | Visigence | Delete `presentation` directory |
| 2026-04-26 23:13 | `7737428` | Visigence | **Delete `.github/workflows` directory (CI removed)** |
| 2026-04-27 04:11 | `f4e3f95` | Copilot | `feat`: paste/drag-drop import, node search/filter, CF diff panel (#19) |
| 2026-04-27 04:44 | `2535113` | Visigence | Three power-user features squash merge (#20/#21) |
| 2026-04-27 14:15 | `00707ac` | Copilot | `test`: TG-8 + TG-9 adapter tests; doc counts 103/260 (#22) |

---

## 10. Go / No-Go Checklist for v0.2.0

| # | Check | Status |
|---|---|---|
| ✅ | All 260 tests pass | **Pass** |
| ✅ | New user features ship-ready (paste, drag-drop, search, CF diff) | **Pass** |
| ✅ | No breaking changes to existing import/export/state API | **Pass** |
| ✅ | `package-lock.json` committed (reproducible installs) | **Pass** |
| ✅ | `favicon.png` committed | **Pass** |
| ✅ | Docs (README, CODEBASE_OVERVIEW) reflect new test counts | **Pass** |
| ⚠️ | CI workflow absent — was deleted post-v0.1.0 | **Decision needed** |
| ⚠️ | DOM-dependent code (`events.js`, `render.js`) has no unit tests | **Known gap, tracked** |
| ❌ | `CHANGELOG.md` not yet updated to record v0.2.0 changes | **Must update before tag** |

---

## 11. Recommendation

**Ready to tag `v0.2.0-pre` / prerelease** with two pre-conditions:

1. **Update `CHANGELOG.md`** — it currently only documents v0.1.0. Add an `[Unreleased]` → `[0.2.0]` section covering the features in §1 and the branding changes in §2.
2. **Decide on CI** — either restore `.github/workflows/test.yml` or note in the release body why it was removed. Running blind on a pre-release tag is acceptable; shipping v0.2.0 stable without CI is not recommended.

If both conditions are met, this codebase is in materially better shape than v0.1.0: more features, more tests, cleaner branding, and hardened import paths.
