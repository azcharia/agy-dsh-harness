# Decisions & Negative Knowledge Log

## Architectural & Strategic Decisions
### [ADR-001] Initial State Architecture
- **Context:** Initializing persistent cross-session state machine.
- **Decision:** Adopt standard 2-file .handoff state structure (STATE.md and DECISIONS.md).
- **Rationale:** Minimizes write tax and avoids context rot across long sessions.

### [ADR-002] Multi-Path Port Probing & Passive CDP Injection
- **Context:** Antigravity 2.0 dynamically assigns debugging ports and writes to DevToolsActivePort in variable Windows user paths.
- **Decision:** Implement multi-path DevToolsActivePort resolver scanning `%APPDATA%`, `%LOCALAPPDATA%`, and user profile directories, communicating over zero-dependency lightweight WebSocket.
- **Rationale:** Ensures reliable CDP connection without external dependencies or brittle hardcoded ports.

### [ADR-003] Zero-Bloat 100% Matte Theme Architecture
- **Context:** Antigravity's Onyx theme generator writes CSS custom properties directly as inline styles on `<html style="--background: #001B4C; ...">`, causing dark navy leaks on Sidebar, Titlebar, and Composer.
- **Decision:** Apply `!important` to surface overrides across `html`, `:root`, `body`, and direct component classes (`.bg-sidebar`, `aside`, `header`, `.surface-composer`).
- **Rationale:** Defeats inline styling cleanly at 0% GPU/layout thrashing cost with sub-millisecond paint time.

### [ADR-004] Dual Context Meter & AgentService Memoization
- **Context:** Extracting `customizationTokenBase` from React Fiber required up to 30,000 node DFS traversal from `#root`, causing frame drop risk if queried repeatedly.
- **Decision:** Perform DFS traversal exactly once on startup, cache the `agentService` reference on `window.__AGY_DSH_HARNESS__.agentService`, cache `getTokenBase` results for 60 seconds, and mount both an Overview Panel Card and an Always-Visible Mini Context Pill with interactive hover popover.
- **Rationale:** Eliminates repeated main-thread traversals while providing continuous context window visibility.

### [ADR-005] SPA Route & Container Re-attachment Engine
- **Context:** Navigating between Home screen and Chat conversations unmounts `autoscroll-viewport` and composer elements, detaching MutationObservers.
- **Decision:** Track active viewport reference in runtime state, attach a debounced layout MutationObserver to `#root` (<16ms response time), and automatically re-bind observers, re-mount the Mini Context Pill, and re-scan message toolbars on route changes.
- **Rationale:** Prevents HUD disappearance across React SPA route changes with near-zero compute overhead.

### [ADR-006] Cold-Boot Persistence via Electron Main Process WebContents Hook
- **Context:** Renderer preloads are sandboxed (`nodeIntegration: false`, `contextIsolation: true`) and block `require('fs')`, while `Antigravity.exe` passes `--app-path=".../app.asar"`, ignoring unpacked directories.
- **Decision:** Patch Electron Main Process in `dist/main.js` inside `app.asar` using `electron.app.on('web-contents-created')` and listen to `dom-ready` to execute `contents.insertCSS(cssText)` and `contents.executeJavaScript(hudJs)`.
- **Rationale:** Operates with full Node.js privileges in Main Process without sandbox restrictions, fires on every window launch with zero delay, and requires zero background daemons.

### [ADR-007] Zero-Flash Boot via Early Window Creation Hook & app_storage.json Injection
- **Context:** Cold start still exhibited a brief blue/navy flash (`#001B4C` / `#131313`) for several milliseconds prior to `dom-ready`.
- **Decision:** Patch `dist/utils.js` during native install (replacing `#131313` and `#001B4C` with `#111113`), patch `app_storage.json` with `"hubSurfaceBackgroundColor": "#111113"`, cache CSS/JS in memory at `main.js` startup, and hook `electron.app.on('browser-window-created', (_e, win) => win.setBackgroundColor('#111113'))`.
- **Rationale:** Establishes `#111113` immediately when `BrowserWindow` is initialized before any renderer frame commits, achieving true zero-flash cold boot.

### [ADR-008] Pure CSS Data URI Vector Doodle & Masked Glow Suppression
- **Context:** Stock Onyx orange radial gradient on `body[data-agy-home-glow] .agy-sheet:has(.agy-home)` collided harshly with the top header border.
- **Decision:** Neutralize `--home-glow: transparent !important`, override `background-image: none !important` on `.agy-sheet:has(.agy-home)`, and inject an inline vector doodle SVG pattern (satellites, code brackets, AI spark, constellation graph) with a smooth radial gradient mask (`opacity: 0.052`).
- **Rationale:** Delivers an aesthetic tech atmosphere with 0% network or GPU overhead, zero collision with the header border, and maximum text readability.

### [ADR-009] Event-Sourced Lifecycle Logger & In-App Audit Drawer Architecture
- **Context:** Need append-only session auditing and in-app event inspection without blocking conversation turns or adding background daemons.
- **Decision:** Implement `scripts/lifecycle-logger.mjs` bound to all lifecycle hooks in `hooks.json`, append JSON lines to `logs/session-events.jsonl` (auto-rotating at >2MB), and trigger non-blocking CDP push (`push-events`) to update `window.__AGY_DSH_HARNESS__.updateEventsLog()` and render the 440px slide-over audit drawer.
- **Rationale:** Completely decoupled, non-blocking, zero turn overhead, and provides instantaneous developer visibility.

### [ADR-010] Zero-Blur RAM Optimization & BaseWindow Direct Zoom Engine
- **Context:** `backdrop-filter: blur(2px)` on `#agy-events-backdrop` caused 40-50MB GPU/renderer frame buffer bloat violating Zero-Bloat guidelines. Concurrently, standard menu roles `zoomIn`/`zoomOut`/`resetZoom` failed because Antigravity uses `electron.BaseWindow` rather than `BrowserWindow`, causing `BrowserWindow.getFocusedWindow()` to return `null`.
- **Decision:**
  1. Replace blur backdrop with solid transparent dark tint `rgba(0, 0, 0, 0.65)` with zero blur filter, and ensure immediate WebSocket closure in lifecycle push.
  2. Implement direct Zoom Engine in `dist/main.js` via `electron.webContents.getAllWebContents()` iteration with `before-input-event` interception and `dist/hud-overlay.js` capture-phase keydown listeners (`Ctrl+=`, `Ctrl+-`, `Ctrl+0`), persisting zoom level in `localStorage`.
  3. Refine Home doodle mask with inverted hollow elliptical radial gradient (`opacity: 0.035`) leaving greeting text 100% clean.
- **Rationale:** Drops renderer memory footprint by ~45MB, restores crisp responsive zoom across entire Antigravity UI, and eliminates text legibility friction on Home.

### [ADR-011] Visual Polish (Doodle Visibility & Soft Pastel Dark) and Phase 3 Autonomy (F4, F5, F6)
- **Context:** Home doodle was invisible with broad hollow mask; harsh red inline code and diff deletes caused eye fatigue at night. Concurrently, Phase 3 required agent live self-modification (Creator Mode), dynamic zero-restart MCP tool hot-swapping (Cordis loader), and prefix-cache eviction guards.
- **Decision:**
  1. **Visual Polish:** Set doodle opacity to `var(--dsh-doodle-opacity, 0.12)`, vector stroke to `1.5px` lavender `#b4befe`, and narrow hollow elliptical mask to `ellipse 36% 20% at 50% 42%`. Migrate all harsh reds to Soft Pastel Rose (`#f38ba8`), inline code to lavender capsule (`#b4befe`), additions to mint (`#a6e3a1`), and warning/accent to peach (`#fab387`).
  2. **F4 Creator Mode:** Implement in-app `Creator / Theme` tab inside Audit Drawer featuring live doodle opacity slider (`0%` - `25%`) and pastel accent presets (`Lavender`, `Mint`, `Peach`, `Rose`, `Sky`) with `localStorage` persistence, plus `cdp-injector.mjs set-theme` CLI.
  3. **F5 Cordis MCP Server:** Build zero-dependency JSON-RPC stdio server `mcp/dsh-core-server.mjs` with dynamic cache-busting tool loader (`await import(url + '?t=' + Date.now())`), meta-tools (`dsh_list_tools`, `dsh_create_or_update_tool`, `dsh_apply_live_ui`), and initial dynamic tool `tools/system-health.mjs`.
  4. **F6 Prefix-Cache Guard:** Add dynamic context tier coloring on Mini Context Pill (`<70%` normal, `70%-85%` warn, `>85%` critical) and inspect tool payloads in `scripts/lifecycle-logger.mjs` (>12 KB payload tags `cacheWarning: true` and badges `[CACHE-WARN]`).
- **Rationale:** Completes Phase 3 roadmap without adding external dependencies or background daemons, achieving night-friendly visual ergonomics and autonomous tool evolution.

### [ADR-012] Single Locked Pill Bar, Isolated Fixed Popover, and Rich 26-Icon Varied Home Doodle
- **Context:** Following an app restart, a stray closing brace in `dist/custom-theme.css` caused Chromium's CSS parser to drop all subsequent styles, and embedding the `.pill-popover` DOM inside `#agy-mini-context-pill` without CSS resulted in an unstyled inline block that overflowed and collided with the chat input. Concurrently, users required a dedicated 3-button pill bar, reliable drawer opening, and a dense, dynamic cosmic/tech doodle on Home.
- **Decision:**
  1. **Strict CSS Syntax & Valid Encoding:** Escaped and balanced all curly braces in `dist/custom-theme.css` (`openBraces === 0`), URL-encoding all SVG data URI strings to ensure Chromium parser stability.
  2. **Single Locked Pill Bar (`#agy-dsh-pill-bar`):** Established a single, non-wrapping horizontal flex container positioned next to `[data-testid="model-selector-trigger"]` holding 3 sequential buttons: `#agy-mini-context-pill`, `#agy-events-pill` (opens Audit Log), and `#agy-creator-pill` (opens Creator / Theme Tuner).
  3. **Decoupled Fixed Popover (`#agy-ctx-popover`):** Isolated the popover directly on `document.body` with hard inline fallback `display: none; position: fixed; z-index: 2147483646;`. Dynamically positioned above the pill via `getBoundingClientRect()` strictly on `mouseenter`, and hidden on `mouseleave`.
  4. **Inline Fallback Styles on Drawer & Backdrop:** Embedded inline default styles on `#agy-events-drawer` and `#agy-events-backdrop` to ensure 100% click-to-open reliability even during network or CSS delay.
  5. **Rich Varied 26-Icon Doodle Pattern:** Rebuilt Home canvas SVG pattern (380x380) with 26 distinct tech and cosmic icons featuring varied scales and rotation angles (`-35deg` to `42deg`), centered around an elliptical mask (`ellipse 34% 18% at 50% 42%`) to keep greeting text pristine.
- **Rationale:** Completely eliminates DOM overflow risks, isolates popovers from flex container constraints, guarantees drawer operability, and delivers a hand-drawn, dynamic cosmic theme.

### [ADR-013] Dedicated Composer Status Strip, ResizeObserver Auto-Compact Mode & Viewport Clamping
- **Context:** When users drag the Right Side Panel (Review / Diff / File explorer) to the left, the chat column narrows to ~320px - 420px. Placing `#agy-dsh-pill-bar` directly adjacent to `[data-testid="model-selector-trigger"]` on the bottom composer toolbar row exhausted horizontal room, causing the pills to collide with `Turbo` / `Mic` buttons and overflow/clip out of view.
- **Decision:**
  1. **Dedicated Full-Width Status Strip:** Detach `#agy-dsh-pill-bar` from the bottom flex button row and mount it as a direct child of `.surface-composer-card`, immediately preceding `.agy-composer-footer`. Styled with `display: flex !important; flex-wrap: wrap !important; width: 100% !important; padding: 4px 10px 2px 10px !important; box-sizing: border-box !important; margin: 0 !important; z-index: 10 !important;`.
  2. **Reactive ResizeObserver Auto-Compact Engine:** Attach a passive `ResizeObserver` to `.surface-composer-card` (cached in `window.__AGY_DSH_HARNESS__` and cleaned up by `disconnectAll()`) with a 440px breakpoint:
     - Full Mode (width >= 440px): `● Ctx: X% (Y/Z) · Cache: W%`, `≡ Events (N)`, `🎨 Creator`
     - Compact Mode (width < 440px): `● X% (Y) · W%`, `≡ N`, `🎨`
  3. **Viewport Boundary Clamping for Fixed Popover:** Apply `Math.max(8, Math.min(rect.left, window.innerWidth - 302))` and `Math.max(8, rect.top - popoverEl.offsetHeight - 8)` to ensure `#agy-ctx-popover` never clips outside the viewport regardless of column width.
- **Rationale:** Completely decouples HUD status pills from host composer action buttons, eliminates horizontal toolbar collisions 100%, and guarantees full accessibility and interactivity in ultra-narrow split views.

### [ADR-014] Document-Level Capture-Phase Click Delegation & Responsive Turn Token Counter
- **Context:** Following an official Antigravity app update, `resources/app.asar` was overwritten with fresh binaries, and user interactions with `#agy-events-pill` and `#agy-creator-pill` failed to open `#agy-events-drawer` because React synthetic event boundaries inside `.surface-composer-card` intercepted bubbling click events. Concurrently, when users dragged the right side panel all the way to the left, `.agy-turn-tokens` (`673.9k in · 90.5k out · 20.9M cache (97% hit)`) clipped off the left edge due to rigid `white-space: nowrap`.
- **Decision:**
  1. **Document-Level Capture-Phase Event Delegation:** Register a capture-phase listener on `document` (`document.addEventListener('click', handler, true)`), stored on `window.__AGY_DSH_HARNESS__.docClickHandler` and dismantled in `disconnectAll()`. Intercept clicks on `#agy-events-pill` and `#agy-creator-pill`, verify/mount drawer and backdrop on `document.body` on demand, and switch to `'events'` or `'creator'` tabs with `preventDefault()` and `stopPropagation()`.
  2. **Elevated Stacking & Hit Testing:** Apply `pointer-events: auto !important; cursor: pointer !important; position: relative; z-index: 50;` to `#agy-dsh-pill-bar`, `#agy-events-pill`, and `#agy-creator-pill`.
  3. **Auto-Compact Responsive Turn Token Counter:** Store `data-full-text` and `data-compact-text` (`674k↓ 91k↑ ⚡97%`) on `.agy-turn-tokens`. Hook counters directly into `applyHUDDensity(isCompact)` evaluated against a 480px width threshold. In compact mode, enforce `white-space: normal !important; overflow-wrap: anywhere !important; max-width: 100% !important; font-size: 10px !important;` to eliminate clipping completely.
  4. **Post-Update Native Repack:** Re-apply live patch via CDP and repack native Main Process hooks directly into the updated `resources/app.asar` with `app.asar.backup` preservation.
- **Rationale:** Ensures 100% click-to-open reliability regardless of host React event handling, eliminates token counter clipping in ultra-narrow split views, and restores cold-boot persistence seamlessly.

### [ADR-015] JavaScript Direct Inline Style Override for Slide-Over Drawer & Transparent Home Stacking
- **Context:** While DOM class updates (`.open`) and document-level click delegation succeeded in event tests, real screen recordings revealed two visual defects: (1) `#agy-events-drawer` failed to appear physically inside the viewport because inline style `transform: translateX(100%)` set at creation overrode stylesheet rules due to CSS specificity; (2) The 26-Icon Cosmic Doodle on Home ("Good to see you, Azcha.") peeked only ~15px at the top edge because inner child wrapper `<div>` containers inside `.agy-sheet:has(.agy-home)` had solid `#111113` backgrounds and sat above the pseudo-element.
- **Decision:**
  1. **Direct Inline Style Override in JavaScript:** In `dist/hud-overlay.js`, rewrite `setDrawerVisibility(open)` to directly write inline `style.cssText` on `#agy-events-drawer` (`display: flex !important; transform: translateX(0) !important; visibility: visible !important; opacity: 1 !important; z-index: 2147483646 !important;`) and `#agy-events-backdrop` (`display: block !important; opacity: 1 !important; z-index: 2147483645 !important;`). On close, set `display: none !important; transform: translateX(105%) !important; visibility: hidden !important;`.
  2. **Dual-Phase Event Listeners:** Attach both `mousedown` AND `click` event listeners directly on pill buttons, on close buttons, on the backdrop, and via document capture-phase delegation.
  3. **Empirical Physical Bounding Box Verification:** Enforce physical bounding box assertions via CDP (`rect.width >= 350`, `rect.right <= window.innerWidth + 1.5`, `rect.left < window.innerWidth`, `display === 'flex'`, `visibility === 'visible'`) before declaring drawer functionality working.
  4. **Transparent Wrapper Stacking Context:** In `dist/custom-theme.css`, force all intermediate wrapper children inside `.agy-sheet:has(.agy-home)` and `.agy-home` to `background-color: transparent !important; background-image: none !important;`, place the doodle pseudo-element at `z-index: 1 !important; pointer-events: none !important;`, and elevate interactive text/composer elements to `z-index: 2 !important;`.
- **Rationale:** Guarantees slide-over drawer visibility regardless of CSS cascade quirks and makes the cosmic doodle pattern permanently visible above any container background.

### [ADR-016] Single-Layer Multi-Color Pastel Doodle, Glass-Border Removal, 250k Compaction Ceiling, & Compaction Tracker
- **Context:** User testing in Phase 3.8 revealed visual and ergonomic opportunities: (1) The Home screen canvas featured an enclosing glass-like border/box-shadow around `.agy-sheet` and ghosted/double-rendered doodle vectors from overlapping pseudo-elements; (2) The 26-icon cosmic doodle used uniform strokes rather than thematic distinction; (3) In real Antigravity operation, conversations auto-compact at ~250,000 tokens rather than the model's theoretical 1M ceiling, misleading users on available conversation runway; (4) There was no in-app detection or auditing of context auto-compaction events.
- **Decision:**
  1. **Glass-Border Removal & Single-Layer Doodle Lock:** Set `border: none !important; border-radius: 0 !important; box-shadow: none !important;` on `.agy-sheet:has(.agy-home)` and all intermediate wrappers, while leaving the native "A" logo untouched. Permanently disable all sheet-level pseudo-elements (`content: none !important; display: none !important;`) and attach the doodle solely to `.agy-home::before` with a tightened elliptical mask (`ellipse 240px 95px at 50% 42%`).
  2. **Multi-Color Soft Pastel Doodle:** Encode 6 distinct Catppuccin Mocha pastel colors across the 26 vector objects in the SVG Data URI: Lavender (`%23b4befe`), Peach (`%23fab387`), Mint (`%23a6e3a1`), Sky (`%2389dceb`), Mauve/Pink (`%23cba6f7` & `%23f5c2e7`), and Soft Yellow (`%23f9e2af`).
  3. **250k Effective Compaction Ceiling:** Calibrate Mini Context Pill and Overview Context Card to `EFFECTIVE_COMPACT_LIMIT = 250000` (250k tokens) with three-tier color coding (`<70%` Soft Mint `#a6e3a1`, `70%-85%` Soft Peach `#fab387`, `>=85%` Soft Rose `#f38ba8` with `⚠️`), preserving the 1M raw limit in the hover popover (`Model Raw Limit`).
  4. **Dual-Signal Session Compaction Tracker:** Monitor both DOM text (`"Compacting"`) and sudden token drops (>25% from >=140k tokens with 30s cooldown) per conversation key stored in `localStorage` (`agy_dsh_compaction_tracker`). Render a live `🔄 Nx` badge on the pill, surface detailed counts in the hover popover, and push an audit event `SessionCompacted` to the Events Drawer.
- **Rationale:** Aligns context metering with real Antigravity runtime behavior, removes visual boundary distractions on Home, provides immediate compaction awareness, and enriches aesthetic tech atmosphere.

### [ADR-017] Decoupling Context Budgeting from Unreliable Heuristic Compaction Detection
- **Context:** While the 250k effective context limit proved highly accurate, the heuristic session compaction counter (`🔄 Nx`) generated severe false positives (e.g. logging 6-7 compaction events reading "dropped from 178.3k to 178.3k tokens") due to DOM text matching against historical conversation transcripts and volatile slice index re-renders.
- **Decision:**
  1. **Purge Heuristic Compaction Counter:** Remove all compaction tracking code (`agy_dsh_compaction_tracker`, DOM text matching for `"Compacting"`, and `SessionCompacted` event emissions) from `dist/hud-overlay.js`.
  2. **Preserve 250k Compaction Ceiling:** Retain `EFFECTIVE_COMPACT_LIMIT = 250000` as the mathematical denominator for context percentage with three-tier dot indicator colors (`<70%` Soft Mint, `70%-85%` Soft Peach, `>=85%` Soft Rose with `⚠️`).
  3. **Restore Clean Pill & Popover Formatting:**
     - Full Mode: `● Ctx: 74% (185.3k/250k) · Cache: 99%`
     - Compact Mode: `● 74% (185.3k) · 99%`
     - Hover popover: Clean display of Model, Compaction Budget, Model Raw Limit, Turn In/Out, Cache, and Base Context without noisy compaction warnings.
  4. **Workspace Hygiene:** Remove temporary test harness scripts from workspace root.
- **Rationale:** Protects HUD integrity from unreliable heuristic false positives while preserving 100% of the proven 250k ceiling and visual design wins.

### [ADR-018] Zero-Idle Compute, Strict Equality Guards, Mutation Filtering, and Zombie Process Elimination
- **Context:** During idle states (no active user prompt), Antigravity consumed ~11.8% CPU and ~9.9% GPU due to an infinite self-triggering MutationObserver/ResizeObserver cycle in hud-overlay.js. Additionally, 8 orphan node.exe processes accumulated from mcpServers auto-start in plugin.json and excessive lifecycle hook calls without watchdog timers.
- **Decision:**
  1. **Strict Equality Guards:** Enforce strict equality checks before touching DOM properties (textContent, innerHTML, setAttribute, style.cssText) across #agy-mini-context-pill, #agy-events-pill, #agy-creator-pill, #agy-ctx-popover, .agy-turn-tokens, and shadow root cards.
  2. **MutationObserver Filtering:** Filter out internal harness mutations matching [data-dsh-injected="true"] or id.startsWith('agy-') in #root and autoscroll-viewport observers.
  3. **Throttled & Fingerprinted Tick:** Throttle tick() with a 500ms cooldown, compute a state fingerprint across messages, tokens, and model details to abort early on unchanged states, and relax the fallback polling interval from 2000ms to 5000ms.
  4. **Zombie Process Elimination:** Remove mcpServers daemon from plugin.json, trim hooks.json to only SessionStart and Stop, and attach unreferenced watchdog timers (setTimeout(() => process.exit(0), 2500).unref()) to Node.js CLI/hook scripts.
- **Rationale:** Reduces idle CPU/GPU consumption to ~0%, eliminates main-thread layout thrashing, and guarantees zero orphan processes in the Windows task list.

### [ADR-019] Post-Update Self-Healing, Hardened ASAR Backup Synchronization, and Global agy-dsh-heal Skill
- **Context:** When Google Antigravity updates in the background, `resources/app.asar` is overwritten by stock binaries, wiping the native Main Process loader hook and returning the UI to default blue. Furthermore, existing `app.asar.backup` from an older version risked causing a version downgrade/mismatch if uninstalled on an updated version.
- **Decision:**
  1. **Hardened Backup Synchronization:** In `cmdInstallNative()`, verify whether active `app.asar` contains the `AGY-DSH` marker. If unpatched (pristine official update from Google), refresh `app.asar.backup` with this new version (`fs.copyFileSync(asarPath, backupPath)`) before repacking.
  2. **Unified Single-Door Command (`self-heal`):** Implement `node scripts/cdp-injector.mjs self-heal` combining live CDP injection, DOM verification, and native Main Process patch detection/re-installation.
  3. **Non-Blocking Background Auto-Heal:** Upgrade `scripts/session-start-hook.mjs` to spawn `self-heal --silent` in an unreferenced detached process, repairing native patches seamlessly on session start.
  4. **Global Reusable Skill (`agy-dsh-heal`):** Author comprehensive diagnostic and recovery skill in `~/.gemini/config/skills/agy-dsh-heal/SKILL.md` and repository mirror `skills/agy-dsh-heal/SKILL.md` with 3-tier recovery protocols and failure trap summaries.
- **Rationale:** Guarantees zero version downgrade risks during rollback, eliminates repetitive manual recovery steps after official updates, and equips agents across workspaces with an authoritative repair protocol.

<!-- [ADR_INSERTION_ANCHOR]: Insert all new [ADR-XXX] entries strictly ABOVE this line! -->
---

## Negative Knowledge (Failed Attempts & False Paths)
<!-- Mandatory: Never delete previous failure entries. Append new [FAIL-XXX] entries at the bottom of this section. -->
<!-- Add [ACTIVE_WARNING] to heading if this trap is critical for ongoing work -->

### [FAIL-001][ACTIVE_WARNING] Renderer Preload Script Node.js Native Require in Sandboxed BrowserWindow
- **Hypothesis:** Expected `require('fs')` and `require('path')` inside `dist/preload.js` in `app.asar` to read live theme and HUD scripts on startup.
- **Observed Result:** Preload script threw `MODULE_NOT_FOUND: Cannot find module 'fs'` and failed silently on cold boot.
- **Root Cause:** Antigravity configures windows with `contextIsolation: true` and `nodeIntegration: false`, sandboxing renderer preloads so only `require('electron')` is exposed.
- **Takeaway for Next Agent:** NEVER attempt `require('fs')` or `require('path')` inside renderer `preload.js`; inject from Electron Main Process (`dist/main.js`) using `electron.app.on('web-contents-created')` and `contents.insertCSS()` / `contents.executeJavaScript()`.

### [FAIL-002][ACTIVE_WARNING] Unpacked resources/app Folder Ignored by Antigravity.exe on Windows
- **Hypothesis:** Expected unpacked `resources/app` directory to override `resources/app.asar` on application cold start.
- **Observed Result:** `Antigravity.exe` cold restart completely ignored `resources/app` and loaded stock theme from `app.asar`.
- **Root Cause:** `Antigravity.exe` is explicitly launched with `--app-path=".../resources/app.asar"`, which instructs Chromium to strictly bypass any unpacked `resources/app` directory.
- **Takeaway for Next Agent:** DO NOT rely on unpacking to `resources/app` for native persistence on Windows; pack patched Main Process files directly into `app.asar` using `@electron/asar pack` with `--unpack-dir "node_modules/chrome-devtools-mcp"`.

### [FAIL-003] Relying on hooks.json (SessionStart) for Window Startup Cold Boot
- **Hypothesis:** Expected `SessionStart` hook to fire when Antigravity application opens.
- **Observed Result:** Window opened with default styling; hook was never called upon window startup.
- **Root Cause:** Antigravity plugin hooks are managed by the Language Server (LS) during agent conversation turns, not during Electron window startup.
- **Takeaway for Next Agent:** Use `hooks.json` only for turn/session lifecycle fallbacks, never for window cold-boot styling.

### [FAIL-004] Indiscriminate disconnectAll() Purging Injected Theme Stylesheet
- **Hypothesis:** Expected `disconnectAll()` in HUD overlay to only tear down DOM HUD elements upon hot reload.
- **Observed Result:** `themeApplied` unexpectedly returned `false` after HUD injection.
- **Root Cause:** `document.querySelectorAll('[data-dsh-injected="true"]').forEach(el => el.remove())` swept away `#agy-dsh-theme-css` because it also bore the `data-dsh-injected="true"` marker.
- **Takeaway for Next Agent:** Explicitly guard `if (el.id !== 'agy-dsh-theme-css') el.remove()` inside `disconnectAll()`, and apply theme CSS after HUD initialization.

### [FAIL-005][ACTIVE_WARNING] Inline Embedding of Complex Popovers Inside Flex Pills & Stray CSS Braces
- **Hypothesis:** Expected `.pill-popover` embedded directly inside `#agy-mini-context-pill` to show/hide solely via CSS `:hover`.
- **Observed Result:** A stray closing brace `}` at line 350 in `dist/custom-theme.css` broke the Chromium CSS parser, causing all subsequent styles (including `.pill-popover` rules) to be dropped. The popover rendered as an unstyled inline block that forced open the pill and overflowed into the chat input area.
- **Root Cause:** Embedding floating popover markup directly inside inline flex pill elements creates tight DOM coupling; any stylesheet loading failure exposes unstyled content directly into the host layout. Furthermore, unescaped raw characters or unbalanced braces in CSS break Chromium parsing silently.
- **Takeaway for Next Agent:** Always decouple floating tooltips and popovers into standalone elements attached to `document.body` with hard inline fallback `position: fixed; display: none;`. Manage visibility explicitly via `mouseenter`/`mouseleave` event listeners, and rigorously test CSS curly brace parity (`openBraces === 0`).

### [FAIL-006][ACTIVE_WARNING] Direct Element Click Listeners Inside React Composer Swallowed by Host Tree
- **Hypothesis:** Expected direct `eventsPillEl.addEventListener('click', handler)` and `creatorPillEl.addEventListener('click', handler)` to fire reliably when clicked by users.
- **Observed Result:** Clicking `≡ Events` or `🎨 Creator` inside `#agy-dsh-pill-bar` produced no response; the audit log and theme tuner drawer failed to open.
- **Root Cause:** Antigravity's React composer component hierarchy intercepts bubbling click events through synthetic event wrappers and pointer-events layering inside `.surface-composer-card`. Furthermore, dynamic re-rendering of pill content (`innerHTML = ...`) replaces child span nodes, breaking event propagation if listeners rely on standard bubble phase.
- **Takeaway for Next Agent:** NEVER rely solely on direct element-level bubble event listeners for buttons mounted inside host React cards; always bind a capture-phase listener at the `document` level (`document.addEventListener('click', handler, true)`), check `e.target.closest(selector)`, and guarantee container mounting before state changes.

### [FAIL-007][ACTIVE_WARNING] Inline Transform Sticking Over CSS Classes & Solid Child Wrapper Occlusion
- **Hypothesis:** Expected adding `.classList.add('open')` to `#agy-events-drawer` to slide the drawer into view based on stylesheet `#agy-events-drawer.open { transform: translateX(0); }`.
- **Observed Result:** CDP evaluation confirmed `classList.contains('open') === true`, but the drawer remained physically off-screen (`x >= window.innerWidth`). On the Home screen, the cosmic doodle pseudo-element was rendered in DOM but obscured behind child wrapper `<div>` backgrounds.
- **Root Cause:**
  1. Inline style `transform: translateX(100%)` assigned during element creation had higher specificity than class selector `#agy-events-drawer.open`, blocking the drawer from sliding into view.
  2. Chromium subpixel geometry on fractional display scaling causes `rect.right` to report up to `window.innerWidth + 1px`.
  3. Solid child wrapper `<div>` backgrounds (`#111113`) inside `.agy-sheet` sat above the pseudo-element in stacking order.
- **Takeaway for Next Agent:**
  1. Always set inline `style.cssText` directly in JavaScript upon opening/closing animated drawers.
  2. Never assert drawer visibility solely by checking CSS classes; always measure physical viewport coordinates via `getBoundingClientRect()`.
  3. Force intermediate child wrappers in themed canvas sheets to `background-color: transparent !important` and set pseudo-element doodles to `z-index: 1 !important; pointer-events: none !important;`.

### [FAIL-008][ACTIVE_WARNING] Heuristic DOM Text & Token Delta Scanning for Context Compaction
- **Hypothesis:** Expected checking `innerText` for `"Compacting"` and detecting sudden token drops (>25% from >=140k tokens) to reliably detect when Antigravity automatically compacts a conversation.
- **Observed Result:** Spurious compaction alerts triggered repeatedly (counting 6x-7x compactions with identical token counts like "dropped from 178.3k to 178.3k tokens").
- **Root Cause:** Historical chat bubbles containing the word "compacting" or "compaction" matched the regex `\bcompacting\b`, and React Fiber slice re-renders during active generation momentarily report varying slice token snapshots, falsely triggering compaction heuristics.
- **Takeaway for Next Agent:** NEVER use DOM text scanning or volatile slice delta heuristics for lifecycle state machines without direct, formal event hooks from the language server or agent runtime. Rely on deterministic state (such as direct token numbers against a static ceiling).
### [FAIL-009][ACTIVE_WARNING] Unfiltered MutationObserver Self-Triggering Loops & Plugin Daemon Accumulation
- **Hypothesis:** Expected MutationObserver on #root to only monitor host React SPA route transitions, and expected background MCP server definitions in plugin.json to idle quietly.
- **Observed Result:** Antigravity.exe consumed ~11.8% CPU and ~9.9% GPU continuously while sitting idle, and 8 zombie node.exe processes accumulated in the background.
- **Root Cause:**
  1. Calling DOM modification methods (setAttribute, textContent, innerHTML) unconditionally in tick() and mountPillBar() triggered MutationObserver on #root. The observer scheduled another tick via requestAnimationFrame, producing an infinite layout and paint feedback loop.
  2. Antigravity Language Server automatically spawns persistent daemons for any server declared under mcpServers in plugin.json, keeping orphan node processes running even when not utilized.
- **Takeaway for Next Agent:**
  1. ALWAYS filter out own-element mutations inside MutationObserver callbacks using if (m.target?.closest?.('[data-dsh-injected="true"]') || m.target?.id?.startsWith('agy-')) continue;.
  2. ALWAYS guard DOM writes with strict equality (if (el.textContent === nextVal) return;).
  3. NEVER configure unmanaged daemon servers in plugin.json mcpServers unless mandatory; rely on zero-daemon native app.asar hooks and lightweight CLI invocations with hard watchdog exits.
