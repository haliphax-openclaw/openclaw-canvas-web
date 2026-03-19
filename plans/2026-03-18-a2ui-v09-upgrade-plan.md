# A2UI v0.9 Upgrade — Implementation Plan

**Spec:** [a2ui-v09-upgrade-spec.md](a2ui-v09-upgrade-spec.md)
**Date:** 2026-03-18
**Status:** Phase 1 complete

---

## Phase 1 — v0.9 with backward-compat shim ✅

### ~~Step 1: Server-side normalization layer~~ ✅

### ~~Step 2: Refactor gateway command handler~~ ✅

### ~~Step 3: Update A2UIManager storage format~~ ✅

### ~~Step 4: Update SPA replay~~ ✅

### ~~Step 5: Update SPA WebSocket handlers~~ ✅

### ~~Step 6: Update A2UINode component resolution~~ ✅

### ~~Step 7: Update Vuex store~~ ✅

### ~~Step 8: Property renames in client components~~ ✅

### ~~Step 9: Apply theme from createSurface~~ ✅

### ~~Step 10: Update tests~~ ✅

### ~~Step 11: Update skill docs~~ ✅

### ~~Step 12: Update project docs~~ ✅

---

## Phase 2 — Remove backward-compat shim

*Timeline: Indefinite. May align with OpenClaw's internal canvas server upgrade plans.*

1. Remove command name aliasing from `processA2UICommand()` — v0.8 names become errors
2. Remove wrapped component shape detection from `normalizeComponent()` — only v0.9 flat accepted
3. Remove `usageHint` → `variant` normalization — only `variant` accepted
4. Update tests to remove backward-compat test cases
5. Log errors (not warnings) for any remaining v0.8 payloads

---

## Future improvements (separate efforts)

### Streaming A2UI ingestion with ValidationFailed

Issue: https://github.com/haliphax-openclaw/openclaw-canvas-web/issues/5
Spec: [a2ui-v09-upgrade-spec.md §5.4](a2ui-v09-upgrade-spec.md)

### formatString interpolation engine

Issue: https://github.com/haliphax-openclaw/openclaw-canvas-web/issues/8
Spec: [a2ui-v09-upgrade-spec.md §5.5](a2ui-v09-upgrade-spec.md)

### Theme support

Issue: https://github.com/haliphax-openclaw/openclaw-canvas-web/issues/6
Plan: [theme-support-plan.md](2026-03-19-theme-support-plan.md)

### Catalog support

Issue: https://github.com/haliphax-openclaw/openclaw-canvas-web/issues/7
Plan: [catalog-support-plan.md](2026-03-19-catalog-support-plan.md)
Depends on: Theme support (#6)
