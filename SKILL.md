---
name: agy-dsh-harness
description: Development and maintenance protocol for AGY-DSH Harness, an ultra-fast, zero-bloat custom theme, HUD overlay, and runtime harness for Google Antigravity 2.0.
---

# AGY-DSH Harness Skill

This skill governs all development, refactoring, and maintenance tasks within the `agy-dsh-harness` repository.

## Mandatory Pre-Flight Protocol

Before modifying, adding, or deleting any file in this repository, you MUST read all architectural and operational specifications located in `./docs/`:

1. `docs/01-ARCHITECTURE-SPEC.md`
   - Zero-Bloat strict rules: Zero background daemon, fire-and-forget CDP injection, passive DOM observation with targeted MutationObserver, GPU-friendly CSS styling, and single MCP gateway.
2. `docs/02-FEATURE-MAP-ROADMAP.md`
   - Sequential roadmap from Phase 1 (Foundation & Visibility) to Phase 2 (Auditability) and Phase 3 (Autonomy & Creator Mode).
3. `docs/03-RISK-AND-SELF-HEALING.md`
   - Self-healing recovery protocols for DevToolsActivePort connection failure, DOM structure shifts, and emergency panic-remove circuit breaker.
4. `docs/04-DOM-AND-PORT-REGISTRY.md`
   - Source of truth for DevToolsActivePort paths on Windows, Onyx design system tokens, React Fiber traversal paths, and exact DOM mount selectors.

## Key Operational Rules

- **Zero Unrequested Daemons:** Never introduce background daemons, persistent file watchers, or long-running polling timers outside an active turn.
- **Fire-and-Forget CDP Injection:** Any injector script invoked via `hooks.json` or CLI must connect via CDP WebSocket, apply or update styles/scripts, and terminate immediately (`process.exit(0)`).
- **Targeted MutationObserver:** Always attach MutationObservers to specific containers (such as `[data-testid="autoscroll-viewport"]`), never to `document.body` or `document`.
- **Registry Update Discipline:** If an Antigravity UI update changes class names, test IDs, or fiber properties, use the diagnostic protocols in `docs/03-RISK-AND-SELF-HEALING.md` and immediately record the changes in `docs/04-DOM-AND-PORT-REGISTRY.md`.
- **Emergency Circuit Breaker:** All injected DOM elements must include `data-dsh-injected="true"` and register active observers under `window.__AGY_DSH_HARNESS__` so they can be cleaned up on demand via `panic-remove`.
