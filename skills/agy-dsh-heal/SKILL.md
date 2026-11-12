---
name: agy-dsh-heal
description: Diagnose, restore, and verify AGY-DSH Harness (Matte Slate theme, Home doodles, and HUD overlay) when Antigravity reverts to default blue styling after an official application update.
---

# AGY-DSH Self-Healing Protocol

This skill provides an automated, multi-tier diagnostic and self-healing procedure for the **AGY-DSH Harness** in Google Antigravity 2.0.

Use this skill whenever:
1. Google Antigravity completes an official application update and reverts to the default stock blue theme (`#001B4C`).
2. The HUD overlay (`#agy-dsh-pill-bar`, `#agy-mini-context-pill`, `≡ Events`, `🎨 Creator`) disappears or fails to mount.
3. Cold start exhibits a blue/navy flash or fails to auto-load custom styling without manual CLI commands.

---

## The Single-Door Recovery Command

The repository provides a unified, single-door self-healing command that automatically resolves live CDP injection, DOM verification, and native Main Process binary patching:

```powershell
node scripts/cdp-injector.mjs self-heal
```

### What `self-heal` Executes Under the Hood:
1. **Live CDP Injection:** Reads active debugging port from `DevToolsActivePort`, connects via WebSocket, injects `dist/custom-theme.css`, mounts `dist/hud-overlay.js`, and syncs session events.
2. **DOM Integrity Check:** Evaluates whether `themeApplied`, `miniPillActive`, `eventsDrawerActive`, and `doodlePatternActive` are true.
3. **Native ASAR Patch Verification:** Scans `resources/app.asar` for the `AGY-DSH` native loader marker. If missing (due to an official Google Antigravity update):
   - Refreshes `app.asar.backup` with the newly installed stock biner to prevent version mismatch or downgrade traps upon uninstall.
   - Extracts `app.asar`, patches `dist/main.js` and `dist/utils.js`, updates `app_storage.json`, and repacks directly using `@electron/asar`.
   - Restores cold-start zero-flash persistence immediately.

---

## 3-Tier Diagnostic & Recovery Protocol

### Tier 1: Post-Update Binary Overwrite Recovery (Most Common)
- **Symptom:** Antigravity updated in background. The UI shows stock blue background and lacks HUD pills on cold boot.
- **Cause:** Official Antigravity updater replaced `resources/app.asar` with fresh unpatched binaries.
- **Action:**
  1. Run `node scripts/cdp-injector.mjs self-heal`.
  2. Verify output confirms `Native app.asar Patch: VERIFIED` and `Live Theme Applied: YES`.
  3. Run `node scripts/cdp-injector.mjs status` to inspect all active windows.

### Tier 2: DOM & CSS Selector Drift Diagnostics
- **Symptom:** Native patch is verified (`INSTALLED`), but specific HUD components do not render or respond.
- **Cause:** Upstream Antigravity update altered React component hierarchy, CSS class names, or test IDs.
- **Action:**
  1. Inspect active DOM via CDP status:
     ```powershell
     node scripts/cdp-injector.mjs status
     ```
  2. Verify mount targets against `docs/04-DOM-AND-PORT-REGISTRY.md`:
     - Composer status bar: `.surface-composer-card`
     - Viewport container: `[data-testid="autoscroll-viewport"]`
     - Home canvas: `.agy-home` or `.agy-sheet:has(.agy-home)`
     - Model selector trigger: `[data-testid="model-selector-trigger"]`
  3. If selectors changed, update `dist/hud-overlay.js` with fallback selectors and re-run `node scripts/cdp-injector.mjs apply`.

### Tier 3: Emergency Safe Rollback (Panic & Uninstall)
- **Symptom:** Unrecoverable UI error, layout corruption, or debugging requirement.
- **Action:**
  1. Clear live DOM immediately (clears all injected elements and stylesheets without restarting):
     ```powershell
     node scripts/cdp-injector.mjs panic-remove
     ```
  2. Restore original stock binary from safety backup:
     ```powershell
     node scripts/cdp-injector.mjs uninstall-native
     ```
  3. Confirm clean uninstallation:
     ```powershell
     node scripts/cdp-injector.mjs status
     ```

---

## Critical Guardrails & Negative Knowledge

When maintaining or updating self-healing logic, you MUST strictly adhere to the negative knowledge rules established in `.handoff/DECISIONS.md`:

1. **FAIL-001 (Renderer Preload Sandbox):** Never attempt `require('fs')` or `require('path')` inside renderer preloads (`dist/preload.js`). Window preloads are sandboxed (`contextIsolation: true`). Inject from Electron Main Process (`dist/main.js`) via `web-contents-created` and `contents.insertCSS()` / `contents.executeJavaScript()`.
2. **FAIL-002 (Unpacked Directory Bypass):** Never rely on unpacking to `resources/app`. `Antigravity.exe` is explicitly launched with `--app-path=".../resources/app.asar"`. Always pack directly into `app.asar`.
3. **FAIL-003 (SessionStart Timing):** Do not rely on `hooks.json` for initial window startup. Hooks fire during agent conversation turns, not window creation. Window cold boot requires the native Main Process hook.
4. **FAIL-004 (Stylesheet Preservation):** In `disconnectAll()`, guard `if (el.id !== 'agy-dsh-theme-css') el.remove()` to prevent accidental styling drops.
5. **FAIL-005 (Decoupled Popovers):** Never embed complex floating popovers inside inline flex pills. Always attach popovers directly to `document.body` with `position: fixed` and calculate coordinates dynamically.
6. **FAIL-006 (Capture-Phase Click Delegation):** React composer components intercept bubbling click events. Always bind button click listeners at the `document` level in the capture phase (`document.addEventListener('click', handler, true)`).
7. **FAIL-007 (Direct Inline Style Overrides):** Animate slide-over drawers by directly assigning inline `style.cssText` in JavaScript to guarantee override over CSS specificity.
8. **FAIL-008 (Deterministic Context Ceiling):** Never scan DOM text for `"Compacting"` or use token delta heuristics. Always use deterministic math against the static 250k ceiling (`EFFECTIVE_COMPACT_LIMIT = 250000`).
9. **FAIL-009 (Zero Idle Compute):** Filter internal mutations (`data-dsh-injected="true"`) in MutationObservers and use strict equality guards (`if (el.textContent === nextVal) return;`) before touching DOM to ensure ~0% idle CPU and GPU usage.
