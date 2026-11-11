# AGY-DSH Harness for Google Antigravity 2.0

> High-performance, zero-bloat matte theme engine, real-time Context/Token HUD overlay, cosmic vector doodle canvas, and live audit harness for Google Antigravity 2.0.

---

## Overview

**AGY-DSH Harness** is an agentic engineering framework built specifically for Google Antigravity 2.0. It delivers complete surface visual ergonomics, real-time context window metering, responsive UI docking, and native cold-boot persistence without background daemon processes.

---

## Key Features

### 1. Zero-Bloat Matte Dark Theme
- **100% Surface Coverage**: Overrides stock Onyx navy blue styling (`#001B4C`) across Titlebar, Sidebar, Chat Viewport, Composer, and Dialogs with a unified `#111113` matte dark surface.
- **Ambient Glow Neutralization**: Suppresses harsh orange and blue header radial glows while preserving sharp contrast and typography readability.
- **Sub-Millisecond Paint Time**: Pure CSS injection via Chrome DevTools Protocol (CDP) with zero GPU thrashing and zero layout flicker.

### 2. Single-Layer Multi-Color Pastel Cosmic Doodle
- **Home Canvas Vector Art**: Features an inline SVG doodle composed of 26 distinct technical and astronomical icons (planets, rockets, AI chips, code brackets, constellation graphs, and star fields).
- **Catppuccin Mocha Soft Pastels**: Distinct soft pastel colors mapped per icon group (Lavender, Peach, Mint, Sky, Mauve, and Soft Yellow).
- **Hollow Elliptical Mask**: Clean radial cut-out around the Antigravity logo and greeting text (`ellipse 240px 95px at 50% 42%`), ensuring zero visual collision with greeting text or composer cards.

### 3. Real-Time Context & Token HUD
- **Mini Context Pill**: Always-visible pill docked above the composer footer.
- **250k Compaction Ceiling**: Calibrated to Antigravity's empirical auto-compaction trigger (`EFFECTIVE_COMPACT_LIMIT = 250000`) with three-tier color indicators:
  - `< 70%` (`< 175k tokens`): Soft Mint (`#a6e3a1`)
  - `70% - 85%` (`175k - 212.5k tokens`): Soft Peach (`#fab387`)
  - `>= 85%` (`>= 212.5k tokens`): Soft Rose (`#f38ba8`) with alert warning
- **Responsive Auto-Compact Mode**: Automatically compresses to compact mode when split-view or side-panels narrow the composer card width below 440px.
- **Interactive Hover Popover**: Displays detailed context breakdown on hover, including Model Name, Compaction Budget, Raw Model Limit, Turn Input/Output, Cache Read/Write, Cache Hit Rate, and Base Customization Tokens.

### 4. Turn Token Metrics & Code Block Tools
- **Message Toolbar Integration**: Injects live token consumption stats (`in · out · cache (hit rate)`) directly into model response toolbars.
- **Code Block Enhancements**: Adds line wrapping and line numbering toggles directly into code blocks with cookie-persisted user preferences.

### 5. In-App Slide-Over Events Drawer & Creator Theme Tuner
- **Live Event Audit Log**: Slide-over drawer (`≡ Events`) tracking session lifecycle events, tool usage, and prompt invocations in real time.
- **Creator Palette Tuner**: Live theme tuner (`🎨 Creator`) allowing instant switching between soft pastel accents (Lavender, Mint, Peach, Rose, Sky) and real-time doodle opacity adjustment (0% to 25%).

### 6. Zero-Flash Cold-Boot Native Persistence
- **Electron Main Process Loader**: Patches `dist/main.js` inside `resources/app.asar` to hook `web-contents-created` and `dom-ready`.
- **Zero-Flash Startup**: Updates `hubSurfaceBackgroundColor = #111113` in `app_storage.json` and patches window initialization in `dist/utils.js` to eliminate cold-start white or blue flashes.
- **Zero Background Daemons**: Runs entirely within existing Electron processes with 0 background Node.js processes.

### 7. Zero-Idle Compute Architecture
- **Strict DOM Equality Guards**: Prevents self-triggering MutationObserver loops by checking property equality before any DOM write.
- **Observer Filtering**: Automatically filters out harness-injected elements (`[data-dsh-injected="true"]`).
- **Throttled & Fingerprinted Tick**: Limits updates to a 500ms cooldown threshold and computes state fingerprints, ensuring 0% CPU and 0% GPU consumption during idle states.

---

## Project Structure

```
agy-dsh-harness/
├── .handoff/
│   ├── STATE.md                 # Persistent session machine and progress tracking
│   └── DECISIONS.md             # Architecture decisions (ADR-001 to ADR-018) & failure logs
├── dist/
│   ├── custom-theme.css         # Matte theme rules, multi-color doodle, and drawer styles
│   └── hud-overlay.js           # Client runtime overlay, context meter, and event drawer
├── docs/
│   ├── 01-ARCHITECTURE-SPEC.md  # Comprehensive technical specification
│   ├── 02-FEATURE-MAP-ROADMAP.md# Feature roadmap and milestones
│   ├── 03-RISK-AND-SELF-HEALING.md # Failure recovery protocols and diagnostic SOPs
│   └── 04-DOM-AND-PORT-REGISTRY.md # DOM selectors, ports, and performance invariants
├── logs/
│   └── .gitkeep                 # Directory anchor for runtime event logs
├── mcp/
│   └── dsh-core-server.mjs      # Zero-dependency inspection utility
├── scripts/
│   ├── cdp-injector.mjs         # Multi-platform CDP injection and native ASAR packager
│   ├── lifecycle-logger.mjs     # Non-blocking lifecycle event logger with watchdog
│   └── session-start-hook.mjs   # SessionStart hook runner with watchdog
├── tools/
│   └── system-health.mjs        # Diagnostics and environment validation tool
├── hooks.json                   # Antigravity plugin lifecycle hooks configuration
├── plugin.json                  # Antigravity extension manifest
└── SKILL.md                     # Agent skill definition and operating doctrine
```

---

## CLI Usage

### Live CDP Injection (Active Windows)
```bash
# Inject or update theme and HUD overlay in all running Antigravity windows
node scripts/cdp-injector.mjs apply

# Inspect injection status, DOM markers, and active windows
node scripts/cdp-injector.mjs status

# Emergency circuit breaker: remove all injected elements from running windows
node scripts/cdp-injector.mjs panic-remove
```

### Native ASAR Installation (Permanent Cold-Start Persistence)
```bash
# Repack native Main Process hook into resources/app.asar
node scripts/cdp-injector.mjs install-native

# Restore original stock app.asar from automatic backup
node scripts/cdp-injector.mjs uninstall-native
```

### Live Theme Tuning via CLI
```bash
# Change pastel accent palette (lavender, mint, peach, rose, sky)
node scripts/cdp-injector.mjs set-theme --preset=mint

# Adjust Home canvas doodle opacity (0.00 to 0.25)
node scripts/cdp-injector.mjs set-theme --opacity=0.15
```

---

## License

MIT License. Designed and maintained for Google Antigravity 2.0.
