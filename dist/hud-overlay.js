/**
 * AGY-DSH Harness HUD Overlay (v1.1)
 * Context Meter, Mini Context Pill with Hover Popover, Turn Token Counter & Code Block Tools
 * Strict Zero-Bloat, Self-Healing and SPA Route Re-attachment Implementation
 */

(() => {
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Global Namespace & Emergency Circuit Breaker
  // ─────────────────────────────────────────────────────────────────────────────
  if (window.__AGY_DSH_HARNESS__ && typeof window.__AGY_DSH_HARNESS__.disconnectAll === 'function') {
    window.__AGY_DSH_HARNESS__.disconnectAll();
  }

  const harness = {
    version: '1.3.0',
    observers: [],
    intervals: [],
    agentService: null,
    cachedBase: null,
    cachedBaseAt: 0,
    activeViewport: null,
    composerResizeObserver: null,
    checkComposerWidth() {
      if (typeof checkComposerWidth === 'function') checkComposerWidth();
    },
    setCompactMode(compact) {
      if (typeof setCompactMode === 'function') setCompactMode(compact);
    },
    events: window.__AGY_DSH_EVENTS__ || [],
    updateEventsLog(newEvents) {
      if (Array.isArray(newEvents)) {
        this.events = newEvents;
        window.__AGY_DSH_EVENTS__ = newEvents;
        if (typeof updateEventsPill === 'function') updateEventsPill();
        if (typeof renderEventsDrawer === 'function') renderEventsDrawer();
      }
    },
    toggleEventsDrawer(force) {
      if (typeof setDrawerVisibility === 'function') {
        const next = typeof force === 'boolean' ? force : !isDrawerOpen;
        setDrawerVisibility(next);
      }
    },
    openDrawer(tab) {
      if (typeof openDrawerTab === 'function') {
        openDrawerTab(tab || 'events');
      }
    },
    closeDrawer() {
      if (typeof setDrawerVisibility === 'function') {
        setDrawerVisibility(false);
      }
    },
    setTheme(presetKey, opacityVal) {
      if (typeof applyCreatorPreferences === 'function') {
        applyCreatorPreferences(presetKey, opacityVal);
      }
    },
    getTheme() {
      if (typeof getCreatorPreferences === 'function') {
        return getCreatorPreferences();
      }
      return { preset: 'peach', accent: '#fab387', opacity: 0.12 };
    },
    disconnectAll() {
      for (const obs of this.observers) {
        try { obs.disconnect(); } catch {}
      }
      this.observers = [];
      if (composerResizeObserver) {
        try { composerResizeObserver.disconnect(); } catch {}
        composerResizeObserver = null;
      }
      observedComposerTarget = null;
      this.composerResizeObserver = null;
      if (typeof checkComposerWidth === 'function') {
        try { window.removeEventListener('resize', checkComposerWidth); } catch {}
      }
      if (this.docClickHandler) {
        try {
          document.removeEventListener('click', this.docClickHandler, true);
          document.removeEventListener('mousedown', this.docClickHandler, true);
        } catch {}
        this.docClickHandler = null;
      }
      for (const t of this.intervals) {
        try { clearInterval(t); } catch {}
      }
      this.intervals = [];
      if (ctxPopoverEl) {
        try { ctxPopoverEl.remove(); } catch {}
        ctxPopoverEl = null;
      }
      document.querySelectorAll('#agy-dsh-pill-bar').forEach((b) => {
        try { b.remove(); } catch {}
      });
      document.querySelectorAll('#agy-mini-context-pill, #agy-events-pill, #agy-creator-pill').forEach((el) => {
        try { el.remove(); } catch {}
      });
      pillBarEl = null;
      miniPillEl = null;
      eventsPillEl = null;
      creatorPillEl = null;
      document.querySelectorAll('[data-dsh-injected="true"]').forEach((el) => {
        try {
          if (el.id !== 'agy-dsh-theme-css') el.remove();
        } catch {}
      });
      document.querySelectorAll('.agy-code').forEach((el) => el.classList.remove('agy-code'));
      document.documentElement.removeAttribute('data-agy-code-lines');
      document.documentElement.removeAttribute('data-agy-code-nowrap');
      this.activeViewport = null;
      console.log('[AGY-DSH] Circuit breaker executed: All observers and injected elements disconnected.');
    },
  };
  window.__AGY_DSH_HARNESS__ = harness;

  // 1.1 Native Windows Titlebar Control Synchronization
  try {
    if (window.electronNative && typeof window.electronNative.setTitleBarOverlay === 'function') {
      window.electronNative.setTitleBarOverlay({ color: '#0e0e10', symbolColor: '#dcdcde' });
    }
  } catch {}

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Constants & Helpers
  // ─────────────────────────────────────────────────────────────────────────────
  const WINDOWS = [
    [/^gemini/i, 1048576],
    [/^claude/i, 200000],
    [/gpt-oss/i, 131072],
  ];
  const EFFECTIVE_COMPACT_LIMIT = 250000; // 250k empirical compaction trigger
  const GROUP_NAMES = {
    1: 'System prompt', 2: 'Tools', 3: 'Rules', 4: 'MCP tools',
    5: 'Skills', 6: 'Subagents', 7: 'Messages', 8: 'Workflows',
    9: 'Plugins', 10: 'Flows',
  };
  const BASE_TTL_MS = 60000; // Judge's Mandate #1: 60s cache
  const CHEVRON_SVG = '<svg viewBox="0 -960 960 960" aria-hidden="true" style="width:14px;height:14px;fill:currentColor;flex:none;"><path d="M517.85-480l-184-184L376-706.15L602.15-480L376-253.85L333.85-296l184-184Z"/></svg>';

  const num = (v) => Number(v ?? 0) || 0;
  const fmt = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(n));
  const pct = (n, d) => {
    if (!d) return '0%';
    const p = (n / d) * 100;
    return p > 0 && p < 0.1 ? '<0.1%' : `${p.toFixed(p < 10 ? 1 : 0)}%`;
  };
  const escapeHtml = (str) =>
    String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const fiberOf = (el) => el && el[Object.keys(el).find((k) => k.startsWith('__reactFiber$'))];

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. React Fiber Traversal & State Readers
  // ─────────────────────────────────────────────────────────────────────────────
  function readSlice() {
    let f = fiberOf(document.querySelector('[data-testid="autoscroll-viewport"]'));
    for (let i = 0; f && i < 40; i++, f = f.return) {
      if (f.memoizedProps?.trajectorySlice) return f.memoizedProps.trajectorySlice;
    }
    return null;
  }

  function readUsage(slice) {
    const steps = slice?.stepsInSlice ?? [];
    for (let i = steps.length - 1; i >= 0; i--) {
      const u = steps[i]?.metadata?.modelUsage;
      if (u) {
        const inputTokens = num(u.inputTokens);
        const cacheReadTokens = num(u.cacheReadTokens);
        const cacheWriteTokens = num(u.cacheWriteTokens);
        const outputTokens = num(u.outputTokens);
        const used = inputTokens + cacheReadTokens + cacheWriteTokens;
        const totalPrompt = inputTokens + cacheReadTokens + cacheWriteTokens;
        const cacheHitRate = totalPrompt > 0 ? (cacheReadTokens / totalPrompt) * 100 : 0;
        return { used, inputTokens, cacheReadTokens, cacheWriteTokens, outputTokens, cacheHitRate };
      }
    }
    return null;
  }

  function readModelName(slice) {
    return slice?.generatorMetadatasInSlice?.at(-1)?.plannerConfig?.modelName
      || document.querySelector('[data-testid="model-selector-trigger"]')?.textContent?.trim()
      || 'Standard Model';
  }

  function readWindowSize(slice) {
    const name = readModelName(slice);
    return WINDOWS.find(([re]) => re.test(name.trim()))?.[1] ?? 1048576;
  }

  // Judge's Mandate #1: One-time DFS Search for agentService
  function getAgentService() {
    if (harness.agentService) return harness.agentService;

    const root = document.getElementById('root');
    const key = root && Object.keys(root).find((k) => k.startsWith('__reactContainer$'));
    const stack = [root?.[key]?.stateNode?.current ?? root?.[key]];
    const seen = new Set();
    let inspected = 0;

    while (stack.length && inspected++ < 30000) {
      const f = stack.pop();
      if (!f || seen.has(f)) continue;
      seen.add(f);

      const v = f.memoizedProps?.value;
      if (v && typeof v.getTokenBase === 'function') {
        harness.agentService = v;
        return v;
      }
      if (f.sibling) stack.push(f.sibling);
      if (f.child) stack.push(f.child);
    }
    return null;
  }

  let baseLoading = false;
  function refreshBase(slice, callback) {
    if (baseLoading) return;
    if (harness.cachedBase && Date.now() - harness.cachedBaseAt < BASE_TTL_MS) {
      if (callback) callback(harness.cachedBase);
      return;
    }

    const svc = getAgentService();
    if (!svc) return;

    baseLoading = true;
    const uris = slice?.metadata?.workspaceUris;
    svc.getTokenBase(Array.isArray(uris) ? { workspaceUris: uris } : {})
      .then((r) => {
        harness.cachedBase = (r.customizationTokenBase?.groups ?? [])
          .map((g) => ({
            type: g.type,
            name: GROUP_NAMES[g.type] || g.name,
            tokens: num(g.numTokens),
            children: (g.children ?? []).map((c) => ({ name: c.name, tokens: num(c.numTokens) })).sort((a, b) => b.tokens - a.tokens),
          }))
          .filter((g) => g.tokens > 0)
          .sort((a, b) => b.tokens - a.tokens);
        harness.cachedBaseAt = Date.now();
        if (callback) callback(harness.cachedBase);
      })
      .catch(() => {})
      .finally(() => { baseLoading = false; });
  }

  // Multi-session token persistence
  const TOTALS_COOKIE = 'agy-usage';
  function readTotals() {
    try {
      const raw = (document.cookie.match(/(?:^|;\s*)agy-usage=([^;]*)/) || [])[1];
      if (!raw) return [];
      return decodeURIComponent(raw).split('|').map((entry) => {
        const [id, nums = ''] = entry.split(':');
        const [input, output, cache, from, last] = nums.split('.').map((n) => parseInt(n, 36));
        return { id, input, output, cache, from, last };
      }).filter((r) => r.id && [r.input, r.output, r.cache, r.from, r.last].every(Number.isFinite));
    } catch {
      return [];
    }
  }

  function writeTotals(list) {
    try {
      const val = list.map((r) => `${r.id}:${[r.input, r.output, r.cache, r.from, r.last].map((n) => n.toString(36)).join('.')}`).join('|');
      document.cookie = `${TOTALS_COOKIE}=${encodeURIComponent(val)}; Max-Age=31536000; Path=/; SameSite=Strict; Secure`;
    } catch {}
  }

  let totalsList = readTotals();
  function countTotal(slice) {
    const id = slice?.conversationId;
    if (!id) return null;
    const start = num(slice.stepsSlice?.startIndex);
    const length = num(slice.totalStepsLength);
    let rec = totalsList.find((r) => r.id === id);
    let changed = false;

    if (!rec) {
      rec = { id, input: 0, output: 0, cache: 0, from: start, last: start - 1 };
      changed = true;
    }
    if (length && rec.last >= length) {
      rec.last = length - 1;
      changed = true;
    }

    (slice.stepsInSlice ?? []).forEach((s, i) => {
      const u = s?.metadata?.modelUsage;
      if (!u || start + i <= rec.last) return;
      rec.input += num(u.inputTokens) + num(u.cacheWriteTokens);
      rec.output += num(u.outputTokens);
      rec.cache += num(u.cacheReadTokens);
      rec.last = start + i;
      changed = true;
    });

    if (changed) {
      totalsList = [rec, ...totalsList.filter((r) => r !== rec)].slice(0, 20);
      writeTotals(totalsList);
    }
    return rec;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Single Locked Pill Bar (#agy-dsh-pill-bar) & Isolated Popover (F1, F2, F4)
  // ─────────────────────────────────────────────────────────────────────────────
  let pillBarEl = null;
  let miniPillEl = null;
  let eventsPillEl = null;
  let creatorPillEl = null;
  let ctxPopoverEl = null;
  let composerResizeObserver = null;
  let observedComposerTarget = null;
  let isCompactHUD = false;

  let lastUsageState = {
    hasData: false,
    ctxPercent: '0',
    used: 0,
    windowSize: 1048576,
    effectiveLimit: EFFECTIVE_COMPACT_LIMIT,
    cachePercent: '0',
    level: 'normal',
  };

  let eventsDrawerEl = null;
  let eventsBackdropEl = null;
  let isDrawerOpen = false;
  let activeFilter = 'All'; // 'All' | 'Tools' | 'Session'
  let searchQuery = '';
  let activeDrawerTab = 'events'; // 'events' | 'creator'

  const THEME_STORAGE_KEY_ACCENT = 'agy-dsh-accent-preset';
  const THEME_STORAGE_KEY_OPACITY = 'agy-dsh-doodle-opacity';

  const PRESETS = {
    lavender: { name: 'Lavender', color: '#b4befe' },
    mint: { name: 'Mint', color: '#a6e3a1' },
    peach: { name: 'Peach', color: '#fab387' },
    rose: { name: 'Rose', color: '#f38ba8' },
    sky: { name: 'Sky', color: '#89b4fa' },
  };

  function applyCreatorPreferences(presetKey, opacityVal) {
    const key = (presetKey || 'peach').toLowerCase();
    const preset = PRESETS[key] || PRESETS.peach;
    const opacity = typeof opacityVal === 'number' ? opacityVal : 0.12;

    document.documentElement.style.setProperty('--dsh-accent', preset.color);
    document.documentElement.style.setProperty('--dsh-doodle-opacity', String(opacity));

    try {
      localStorage.setItem(THEME_STORAGE_KEY_ACCENT, key);
      localStorage.setItem(THEME_STORAGE_KEY_OPACITY, String(opacity));
    } catch {}

    if (eventsDrawerEl) {
      const slider = eventsDrawerEl.querySelector('#agy-doodle-opacity-slider');
      const valLabel = eventsDrawerEl.querySelector('#agy-doodle-opacity-val');
      const nameLabel = eventsDrawerEl.querySelector('#agy-accent-name-val');
      if (slider) slider.value = Math.round(opacity * 100);
      if (valLabel) valLabel.textContent = `${Math.round(opacity * 100)}%`;
      if (nameLabel) nameLabel.textContent = preset.name;

      const presetBtns = eventsDrawerEl.querySelectorAll('.agy-preset-btn');
      presetBtns.forEach((btn) => {
        if (btn.getAttribute('data-preset') === key) btn.classList.add('active');
        else btn.classList.remove('active');
      });
    }
  }

  function getCreatorPreferences() {
    let presetKey = 'peach';
    let opacity = 0.12;
    try {
      presetKey = localStorage.getItem(THEME_STORAGE_KEY_ACCENT) || 'peach';
      const opStr = localStorage.getItem(THEME_STORAGE_KEY_OPACITY);
      if (opStr !== null) {
        const parsed = parseFloat(opStr);
        if (!isNaN(parsed)) opacity = parsed;
      }
    } catch {}
    const preset = PRESETS[presetKey.toLowerCase()] || PRESETS.peach;
    return { preset: presetKey, name: preset.name, color: preset.color, opacity };
  }

  function initCreatorPreferences() {
    try {
      const prefs = getCreatorPreferences();
      applyCreatorPreferences(prefs.preset, prefs.opacity);
    } catch {}
  }

  function mountCtxPopover() {
    if (ctxPopoverEl && ctxPopoverEl.isConnected) return ctxPopoverEl;
    if (!ctxPopoverEl) {
      ctxPopoverEl = document.createElement('div');
      ctxPopoverEl.id = 'agy-ctx-popover';
      ctxPopoverEl.setAttribute('data-dsh-injected', 'true');
      ctxPopoverEl.style.cssText = 'position:fixed;z-index:2147483646;display:none;pointer-events:none;background:#18181b;border:1px solid #2e2e36;border-radius:10px;padding:12px 14px;width:300px;box-shadow:0 12px 32px rgba(0,0,0,0.75);font-family:system-ui,sans-serif;font-size:11px;line-height:1.45;color:#dcdcde;';
      ctxPopoverEl.innerHTML = `
        <div class="pop-title" style="font-weight:600;color:#f2f2f3;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.08);">Context & Token Breakdown</div>
        <div class="pop-row" style="display:flex;justify-content:space-between;padding:2px 0;color:#86868c;"><span>Model</span><span class="pop-val pop-model" style="font-family:monospace;color:#dcdcde;">--</span></div>
        <div class="pop-row" style="display:flex;justify-content:space-between;padding:2px 0;color:#86868c;"><span>Compaction Budget</span><span class="pop-val pop-compact-budget" style="font-family:monospace;color:#a6e3a1;font-weight:600;">--</span></div>
        <div class="pop-row" style="display:flex;justify-content:space-between;padding:2px 0;color:#86868c;"><span>Model Raw Limit</span><span class="pop-val pop-win" style="font-family:monospace;color:#dcdcde;">--</span></div>
        <div class="pop-divider" style="height:1px;background:rgba(255,255,255,0.06);margin:5px 0;"></div>
        <div class="pop-row" style="display:flex;justify-content:space-between;padding:2px 0;color:#86868c;"><span>Turn Input</span><span class="pop-val pop-in" style="font-family:monospace;color:#dcdcde;">--</span></div>
        <div class="pop-row" style="display:flex;justify-content:space-between;padding:2px 0;color:#86868c;"><span>Turn Output</span><span class="pop-val pop-out" style="font-family:monospace;color:#dcdcde;">--</span></div>
        <div class="pop-row" style="display:flex;justify-content:space-between;padding:2px 0;color:#86868c;"><span>Cache Read</span><span class="pop-val pop-cache-r" style="font-family:monospace;color:#dcdcde;">--</span></div>
        <div class="pop-row" style="display:flex;justify-content:space-between;padding:2px 0;color:#86868c;"><span>Cache Write</span><span class="pop-val pop-cache-w" style="font-family:monospace;color:#dcdcde;">--</span></div>
        <div class="pop-row" style="display:flex;justify-content:space-between;padding:2px 0;color:#86868c;"><span>Cache Hit Rate</span><span class="pop-val highlight pop-hit" style="font-family:monospace;color:#a6e3a1;font-weight:600;">--</span></div>
        <div class="pop-divider" style="height:1px;background:rgba(255,255,255,0.06);margin:5px 0;"></div>
        <div class="pop-row" style="display:flex;justify-content:space-between;padding:2px 0;color:#86868c;"><span>Base Context</span><span class="pop-val pop-base" style="font-family:monospace;color:#dcdcde;">--</span></div>
        <div class="pop-row" style="display:flex;justify-content:space-between;padding:2px 0;color:#86868c;"><span>Session Total</span><span class="pop-val pop-total" style="font-family:monospace;color:#dcdcde;">--</span></div>
      `;
    }
    if (!ctxPopoverEl.isConnected) {
      document.body.appendChild(ctxPopoverEl);
    }
    return ctxPopoverEl;
  }

  function applyHUDDensity() {
    if (pillBarEl) {
      const compactAttr = isCompactHUD ? 'true' : 'false';
      if (pillBarEl.getAttribute('data-compact') !== compactAttr) {
        pillBarEl.setAttribute('data-compact', compactAttr);
      }

      // 1. Mini Context Pill
      if (miniPillEl) {
        const pillText = miniPillEl.querySelector('.pill-text');
        if (pillText) {
          let nextText = '';
          if (!lastUsageState.hasData) {
            nextText = isCompactHUD ? '-- · --' : 'Ctx: -- · Cache: --';
          } else {
            const critWarn = lastUsageState.level === 'critical' ? ' ⚠️' : '';
            if (isCompactHUD) {
              nextText = `${lastUsageState.ctxPercent}% (${fmt(lastUsageState.used)})${critWarn} · ${lastUsageState.cachePercent}%`;
            } else {
              nextText = `Ctx: ${lastUsageState.ctxPercent}% (${fmt(lastUsageState.used)}/250k)${critWarn} · Cache: ${lastUsageState.cachePercent}%`;
            }
          }
          if (pillText.textContent !== nextText) {
            pillText.textContent = nextText;
          }
        }
      }

      // 2. Events Pill
      if (eventsPillEl) {
        const count = harness.events?.length ?? 0;
        const nextHtml = isCompactHUD
          ? `<span>≡</span> <span class="events-count">${count}</span>`
          : `<span>≡ Events</span> <span class="events-count">(${count})</span>`;
        if (eventsPillEl.innerHTML !== nextHtml) {
          eventsPillEl.innerHTML = nextHtml;
        }
      }

      // 3. Creator Pill
      if (creatorPillEl) {
        const nextHtml = isCompactHUD ? '<span>🎨</span>' : '<span>🎨 Creator</span>';
        if (creatorPillEl.innerHTML !== nextHtml) {
          creatorPillEl.innerHTML = nextHtml;
        }
      }
    }

    // 4. Responsive Turn Token Counters (.agy-turn-tokens)
    document.querySelectorAll('.agy-turn-tokens').forEach((el) => {
      if (isCompactHUD) {
        const compactHtml = el.getAttribute('data-compact-text');
        if (compactHtml && el.innerHTML !== compactHtml) {
          el.innerHTML = compactHtml;
        }
        if (el.getAttribute('data-compact') !== 'true') {
          el.setAttribute('data-compact', 'true');
        }
      } else {
        const fullHtml = el.getAttribute('data-full-text');
        if (fullHtml && el.innerHTML !== fullHtml) {
          el.innerHTML = fullHtml;
        }
        if (el.hasAttribute('data-compact')) {
          el.removeAttribute('data-compact');
        }
      }
    });
  }

  function checkComposerWidth() {
    let width = 0;
    if (pillBarEl) {
      const container = pillBarEl.parentElement;
      width = container ? container.getBoundingClientRect().width : pillBarEl.getBoundingClientRect().width;
    }
    if (width <= 0) {
      const viewport = document.querySelector('[data-testid="autoscroll-viewport"]') || document.querySelector('.surface-composer-card');
      if (viewport) width = viewport.getBoundingClientRect().width;
    }
    if (width > 0) {
      const compact = width < 480;
      if (compact !== isCompactHUD) {
        isCompactHUD = compact;
        applyHUDDensity();
      }
    }
  }

  function setCompactMode(compact) {
    isCompactHUD = Boolean(compact);
    applyHUDDensity();
  }

  function setupComposerResizeObserver(target) {
    if (!target || typeof ResizeObserver === 'undefined') return;
    if (observedComposerTarget === target && composerResizeObserver) return;

    if (composerResizeObserver && observedComposerTarget) {
      try { composerResizeObserver.unobserve(observedComposerTarget); } catch {}
    }

    if (!composerResizeObserver) {
      composerResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width = entry.contentRect.width;
          if (width > 0) {
            const compact = width < 480;
            if (compact !== isCompactHUD) {
              isCompactHUD = compact;
              applyHUDDensity();
            }
          }
        }
      });
      harness.observers.push(composerResizeObserver);
      harness.composerResizeObserver = composerResizeObserver;
      window.addEventListener('resize', checkComposerWidth, { passive: true });
    }
    composerResizeObserver.observe(target);
    observedComposerTarget = target;

    checkComposerWidth();
  }

  function mountPillBar() {
    const trigger = document.querySelector('[data-testid="model-selector-trigger"]');
    if (!trigger) return false;

    // Prune any existing or duplicate pill bars from previous instances
    if (!pillBarEl || !pillBarEl.isConnected) {
      document.querySelectorAll('#agy-dsh-pill-bar').forEach((b) => b.remove());
      document.querySelectorAll('#agy-mini-context-pill, #agy-events-pill, #agy-creator-pill').forEach((el) => el.remove());
      pillBarEl = null;
      miniPillEl = null;
      eventsPillEl = null;
      creatorPillEl = null;
    } else {
      document.querySelectorAll('#agy-dsh-pill-bar').forEach((b) => {
        if (b !== pillBarEl) b.remove();
      });
      document.querySelectorAll('#agy-mini-context-pill, #agy-events-pill, #agy-creator-pill').forEach((el) => {
        if (!pillBarEl.contains(el)) el.remove();
      });
    }

    if (!pillBarEl) {
      pillBarEl = document.createElement('div');
      pillBarEl.id = 'agy-dsh-pill-bar';
      pillBarEl.setAttribute('data-dsh-injected', 'true');
      pillBarEl.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:6px;width:100%;padding:4px 10px 2px 10px;box-sizing:border-box;margin:0;z-index:50;position:relative;pointer-events:auto;';

      // 1. Ctx Pill
      miniPillEl = document.createElement('div');
      miniPillEl.id = 'agy-mini-context-pill';
      miniPillEl.className = 'agy-pill-btn';
      miniPillEl.setAttribute('data-dsh-injected', 'true');
      miniPillEl.style.cssText = 'display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:9999px;font-size:11px;font-family:monospace;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);color:#86868c;cursor:pointer;user-select:none;white-space:nowrap;flex-shrink:0;transition:all 150ms ease;';
      miniPillEl.innerHTML = `<span class="pill-dot" style="width:6px;height:6px;border-radius:50%;background:#a6e3a1;flex-shrink:0;"></span><span class="pill-text">Ctx: -- · Cache: --</span>`;

      miniPillEl.addEventListener('mouseenter', () => {
        const pop = mountCtxPopover();
        if (!pop) return;
        pop.style.display = 'block';
        const rect = miniPillEl.getBoundingClientRect();
        const popHeight = pop.offsetHeight || 220;
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - 302));
        const top = Math.max(8, rect.top - popHeight - 8);
        pop.style.left = `${left}px`;
        pop.style.top = `${top}px`;
        pop.style.bottom = 'auto';
      });
      miniPillEl.addEventListener('mouseleave', () => {
        if (ctxPopoverEl) ctxPopoverEl.style.display = 'none';
      });

      // 2. Events Pill
      eventsPillEl = document.createElement('div');
      eventsPillEl.id = 'agy-events-pill';
      eventsPillEl.className = 'agy-pill-btn';
      eventsPillEl.setAttribute('data-dsh-injected', 'true');
      eventsPillEl.style.cssText = 'display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:9999px;font-size:11px;font-family:monospace;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);color:#86868c;cursor:pointer;user-select:none;white-space:nowrap;flex-shrink:0;transition:all 150ms ease;pointer-events:auto;position:relative;z-index:50;';
      eventsPillEl.innerHTML = `<span>≡ Events</span> <span class="events-count">(0)</span>`;
      const triggerEventsAction = (e) => {
        e.preventDefault();
        e.stopPropagation();
        mountEventsDrawer();
        openDrawerTab('events');
      };
      eventsPillEl.addEventListener('click', triggerEventsAction);
      eventsPillEl.addEventListener('mousedown', triggerEventsAction);

      // 3. Creator Pill
      creatorPillEl = document.createElement('div');
      creatorPillEl.id = 'agy-creator-pill';
      creatorPillEl.className = 'agy-pill-btn';
      creatorPillEl.setAttribute('data-dsh-injected', 'true');
      creatorPillEl.style.cssText = 'display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:9999px;font-size:11px;font-family:monospace;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);color:#86868c;cursor:pointer;user-select:none;white-space:nowrap;flex-shrink:0;transition:all 150ms ease;pointer-events:auto;position:relative;z-index:50;';
      creatorPillEl.innerHTML = `<span>🎨 Creator</span>`;
      const triggerCreatorAction = (e) => {
        e.preventDefault();
        e.stopPropagation();
        mountEventsDrawer();
        openDrawerTab('creator');
      };
      creatorPillEl.addEventListener('click', triggerCreatorAction);
      creatorPillEl.addEventListener('mousedown', triggerCreatorAction);

      pillBarEl.appendChild(miniPillEl);
      pillBarEl.appendChild(eventsPillEl);
      pillBarEl.appendChild(creatorPillEl);
    } else {
      if (pillBarEl.children.length === 0) {
        if (miniPillEl) pillBarEl.appendChild(miniPillEl);
        if (eventsPillEl) pillBarEl.appendChild(eventsPillEl);
        if (creatorPillEl) pillBarEl.appendChild(creatorPillEl);
      }
    }

    const footer = document.querySelector('.agy-composer-footer') || (trigger ? trigger.closest('.agy-composer-footer') || trigger.closest('.flex.w-full.items-center') : null);
    const container = footer ? footer.parentElement : trigger.parentElement;
    const refNode = footer || trigger;

    if (container && refNode) {
      const needsMove = pillBarEl.parentElement !== container || pillBarEl.nextElementSibling !== refNode;
      if (needsMove) {
        container.insertBefore(pillBarEl, refNode);
        setupComposerResizeObserver(container);
        applyHUDDensity();
      }
      return true;
    }
    return false;
  }

  function updateMiniPill(usage, windowSize, modelName, convTotal, groups) {
    if (!mountPillBar() || !miniPillEl) return;
    mountCtxPopover();

    const used = usage?.used ?? 0;
    const effRatio = EFFECTIVE_COMPACT_LIMIT > 0 ? used / EFFECTIVE_COMPACT_LIMIT : 0;
    const ctxPercent = (effRatio * 100).toFixed(effRatio < 0.1 ? 1 : 0);
    const rawRatio = windowSize > 0 ? used / windowSize : 0;
    const cachePercent = (usage?.cacheHitRate ?? 0).toFixed(0);

    let level = 'normal';
    if (effRatio >= 0.85) level = 'critical';
    else if (effRatio >= 0.70) level = 'warn';

    if (miniPillEl.getAttribute('data-level') !== level) {
      miniPillEl.setAttribute('data-level', level);
    }

    lastUsageState = {
      hasData: Boolean(usage),
      ctxPercent,
      used,
      windowSize: windowSize || 1048576,
      effectiveLimit: EFFECTIVE_COMPACT_LIMIT,
      cachePercent,
      level,
    };

    applyHUDDensity();

    if (ctxPopoverEl) {
      const setIfChanged = (sel, val, color) => {
        const el = ctxPopoverEl.querySelector(sel);
        if (!el) return;
        if (el.textContent !== val) el.textContent = val;
        if (color && el.style.color !== color) el.style.color = color;
      };

      setIfChanged('.pop-model', modelName || 'Standard');
      setIfChanged(
        '.pop-compact-budget',
        `${fmt(used)} / 250k (${ctxPercent}%)`,
        level === 'critical' ? '#f38ba8' : level === 'warn' ? '#fab387' : '#a6e3a1'
      );
      setIfChanged('.pop-win', `${fmt(used)} / ${fmt(windowSize)} (${(rawRatio * 100).toFixed(1)}%)`);
      setIfChanged('.pop-in', usage ? fmt(usage.inputTokens) : '0');
      setIfChanged('.pop-out', usage ? fmt(usage.outputTokens) : '0');
      setIfChanged('.pop-cache-r', usage ? fmt(usage.cacheReadTokens) : '0');
      setIfChanged('.pop-cache-w', usage ? fmt(usage.cacheWriteTokens) : '0');
      setIfChanged('.pop-hit', `${cachePercent}%`);

      if (groups && groups.length > 0) {
        const baseSummary = groups.slice(0, 3).map((g) => `${g.name.split(' ')[0]}: ${fmt(g.tokens)}`).join(' · ');
        setIfChanged('.pop-base', baseSummary);
      } else {
        setIfChanged('.pop-base', 'None');
      }

      if (convTotal && (convTotal.input || convTotal.output)) {
        setIfChanged('.pop-total', `${fmt(convTotal.input)} in · ${fmt(convTotal.output)} out · ${fmt(convTotal.cache)} cache`);
      } else {
        setIfChanged('.pop-total', '0 in · 0 out');
      }
    }
  }

  let lastEventsCount = -1;
  function updateEventsPill() {
    if (!mountPillBar() || !eventsPillEl) return;
    const count = harness.events?.length ?? 0;
    if (count === lastEventsCount) return;
    lastEventsCount = count;
    if (count > 0) {
      eventsPillEl.classList.add('has-events');
    } else {
      eventsPillEl.classList.remove('has-events');
    }
    applyHUDDensity();
  }

  function setDrawerVisibility(open) {
    mountEventsDrawer();
    isDrawerOpen = Boolean(open);
    if (!eventsDrawerEl || !eventsBackdropEl) return;
    if (isDrawerOpen) {
      eventsBackdropEl.style.cssText = 'position:fixed !important; inset:0 !important; background:rgba(0,0,0,0.65) !important; z-index:2147483645 !important; display:block !important; opacity:1 !important; pointer-events:auto !important;';
      eventsDrawerEl.style.cssText = 'position:fixed !important; top:0 !important; right:0 !important; bottom:0 !important; width:420px !important; max-width:92vw !important; background:#141417 !important; border-left:1px solid #2e2e36 !important; z-index:2147483646 !important; display:flex !important; flex-direction:column !important; transform:translateX(0) !important; visibility:visible !important; opacity:1 !important; pointer-events:auto !important; box-shadow:-12px 0 32px rgba(0,0,0,0.75) !important;';
      eventsDrawerEl.classList.add('open');
      eventsBackdropEl.classList.add('open');
    } else {
      eventsDrawerEl.classList.remove('open');
      eventsBackdropEl.classList.remove('open');
      eventsBackdropEl.style.cssText = 'position:fixed !important; inset:0 !important; display:none !important; opacity:0 !important; pointer-events:none !important; z-index:2147483645 !important;';
      eventsDrawerEl.style.cssText = 'position:fixed !important; top:0 !important; right:0 !important; bottom:0 !important; width:420px !important; max-width:92vw !important; background:#141417 !important; border-left:1px solid #2e2e36 !important; z-index:2147483646 !important; display:none !important; transform:translateX(105%) !important; visibility:hidden !important; opacity:0 !important; pointer-events:none !important;';
    }
  }

  function openDrawerTab(tabName) {
    setDrawerVisibility(true);
    switchDrawerTab(tabName);
  }

  function switchDrawerTab(tabName) {
    if (!eventsDrawerEl) return;
    activeDrawerTab = tabName === 'creator' ? 'creator' : 'events';
    const tabEventsBtn = eventsDrawerEl.querySelector('#agy-tab-events-btn');
    const tabCreatorBtn = eventsDrawerEl.querySelector('#agy-tab-creator-btn');
    const eventsView = eventsDrawerEl.querySelector('#agy-drawer-events-view');
    const creatorView = eventsDrawerEl.querySelector('#agy-drawer-creator-view');
    const titleEl = eventsDrawerEl.querySelector('#agy-drawer-main-title');
    const badgeEl = eventsDrawerEl.querySelector('#agy-drawer-total-badge');
    const exportBtn = eventsDrawerEl.querySelector('#agy-export-jsonl-btn');

    if (activeDrawerTab === 'events') {
      tabEventsBtn?.classList.add('active');
      tabCreatorBtn?.classList.remove('active');
      if (eventsView) eventsView.style.display = 'block';
      if (creatorView) creatorView.style.display = 'none';
      if (titleEl) titleEl.textContent = 'Session Audit Log';
      if (badgeEl) badgeEl.style.display = 'inline-block';
      if (exportBtn) exportBtn.style.display = 'inline-block';
      renderEventsDrawer();
    } else {
      tabCreatorBtn?.classList.add('active');
      tabEventsBtn?.classList.remove('active');
      if (eventsView) eventsView.style.display = 'none';
      if (creatorView) creatorView.style.display = 'flex';
      if (titleEl) titleEl.textContent = 'Creator / Theme Tuner';
      if (badgeEl) badgeEl.style.display = 'none';
      if (exportBtn) exportBtn.style.display = 'none';
      const prefs = getCreatorPreferences();
      applyCreatorPreferences(prefs.preset, prefs.opacity);
    }
  }

  function mountEventsDrawer() {
    if (eventsDrawerEl && eventsDrawerEl.isConnected && eventsBackdropEl && eventsBackdropEl.isConnected) return true;

    if (!eventsBackdropEl) {
      eventsBackdropEl = document.createElement('div');
      eventsBackdropEl.id = 'agy-events-backdrop';
      eventsBackdropEl.setAttribute('data-dsh-injected', 'true');
      eventsBackdropEl.style.cssText = 'position:fixed !important; inset:0 !important; display:none !important; opacity:0 !important; pointer-events:none !important; z-index:2147483645 !important;';
      const onBackdropClose = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDrawerVisibility(false);
      };
      eventsBackdropEl.addEventListener('click', onBackdropClose);
      eventsBackdropEl.addEventListener('mousedown', onBackdropClose);
    }
    if (!eventsBackdropEl.isConnected && document.body) {
      document.body.appendChild(eventsBackdropEl);
    }

    if (!eventsDrawerEl) {
      eventsDrawerEl = document.createElement('div');
      eventsDrawerEl.id = 'agy-events-drawer';
      eventsDrawerEl.setAttribute('data-dsh-injected', 'true');
      eventsDrawerEl.style.cssText = 'position:fixed !important; top:0 !important; right:0 !important; bottom:0 !important; width:420px !important; max-width:92vw !important; background:#141417 !important; border-left:1px solid #2e2e36 !important; z-index:2147483646 !important; display:none !important; transform:translateX(105%) !important; visibility:hidden !important; opacity:0 !important; pointer-events:none !important;';
      eventsDrawerEl.innerHTML = `
        <div class="agy-drawer-header">
          <div class="agy-drawer-title-group">
            <h3 class="agy-drawer-title" id="agy-drawer-main-title">Session Audit Log</h3>
            <span class="agy-drawer-badge" id="agy-drawer-total-badge">0 events</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button class="agy-filter-btn" id="agy-export-jsonl-btn" title="Export JSONL">Export</button>
            <button class="agy-drawer-close" id="agy-drawer-close-btn" title="Close Drawer">✕</button>
          </div>
        </div>
        <div class="agy-drawer-tabs">
          <button class="agy-tab-btn active" id="agy-tab-events-btn">Audit Log</button>
          <button class="agy-tab-btn" id="agy-tab-creator-btn">🎨 Creator / Theme</button>
        </div>

        <div id="agy-drawer-events-view">
          <div class="agy-drawer-controls">
            <input type="text" class="agy-drawer-search" id="agy-drawer-search-input" placeholder="Search events, tools, summary..." />
            <div class="agy-drawer-filters">
              <button class="agy-filter-btn active" data-filter="All">All</button>
              <button class="agy-filter-btn" data-filter="Tools">Tools</button>
              <button class="agy-filter-btn" data-filter="Session">Session</button>
            </div>
          </div>
          <div class="agy-drawer-list" id="agy-drawer-event-list">
            <div style="padding:24px;text-align:center;color:#71717a;font-size:12px;">No lifecycle events recorded yet.</div>
          </div>
        </div>

        <div class="agy-creator-panel" id="agy-drawer-creator-view" style="display:none;">
          <div class="agy-creator-section">
            <div class="agy-creator-label">
              <span>Home Doodle Opacity</span>
              <span class="val" id="agy-doodle-opacity-val">12%</span>
            </div>
            <input type="range" class="agy-creator-slider" id="agy-doodle-opacity-slider" min="0" max="25" step="1" value="12" />
            <span style="font-size:10px;color:#71717a;">Fine-tune vector doodle visibility on Home canvas in real time (0% - 25%).</span>
          </div>

          <div class="agy-creator-section">
            <div class="agy-creator-label">
              <span>Pastel Accent Palette</span>
              <span class="val" id="agy-accent-name-val">Peach</span>
            </div>
            <div class="agy-presets-grid" id="agy-presets-grid">
              <button class="agy-preset-btn" data-preset="lavender" data-color="#b4befe" data-name="Lavender">
                <span class="agy-preset-swatch" style="background:#b4befe;"></span>
                <span>Lavender</span>
              </button>
              <button class="agy-preset-btn" data-preset="mint" data-color="#a6e3a1" data-name="Mint">
                <span class="agy-preset-swatch" style="background:#a6e3a1;"></span>
                <span>Mint</span>
              </button>
              <button class="agy-preset-btn active" data-preset="peach" data-color="#fab387" data-name="Peach">
                <span class="agy-preset-swatch" style="background:#fab387;"></span>
                <span>Peach</span>
              </button>
              <button class="agy-preset-btn" data-preset="rose" data-color="#f38ba8" data-name="Rose">
                <span class="agy-preset-swatch" style="background:#f38ba8;"></span>
                <span>Rose</span>
              </button>
              <button class="agy-preset-btn" data-preset="sky" data-color="#89b4fa" data-name="Sky">
                <span class="agy-preset-swatch" style="background:#89b4fa;"></span>
                <span>Sky</span>
              </button>
            </div>
            <span style="font-size:10px;color:#71717a;">Applies instant soft pastel accents to buttons, badges, and focus rings.</span>
          </div>

          <div class="agy-creator-section">
            <div class="agy-creator-label">
              <span>Quick Actions</span>
            </div>
            <div style="display:flex;gap:6px;margin-top:4px;">
              <button class="agy-filter-btn" id="agy-reset-theme-btn" style="flex:1;padding:6px 0;text-align:center;">Reset to Defaults</button>
            </div>
          </div>
        </div>
      `;

      const closeDrawerHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDrawerVisibility(false);
      };
      eventsDrawerEl.querySelector('#agy-drawer-close-btn')?.addEventListener('click', closeDrawerHandler);
      eventsDrawerEl.querySelector('#agy-drawer-close-btn')?.addEventListener('mousedown', closeDrawerHandler);

      const tabEventsBtn = eventsDrawerEl.querySelector('#agy-tab-events-btn');
      const tabCreatorBtn = eventsDrawerEl.querySelector('#agy-tab-creator-btn');

      tabEventsBtn?.addEventListener('click', () => switchDrawerTab('events'));
      tabCreatorBtn?.addEventListener('click', () => switchDrawerTab('creator'));

      const slider = eventsDrawerEl.querySelector('#agy-doodle-opacity-slider');
      slider?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10) / 100;
        const currentPrefs = getCreatorPreferences();
        applyCreatorPreferences(currentPrefs.preset, val);
      });

      const presetBtns = eventsDrawerEl.querySelectorAll('.agy-preset-btn');
      presetBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const presetKey = btn.getAttribute('data-preset');
          const currentPrefs = getCreatorPreferences();
          applyCreatorPreferences(presetKey, currentPrefs.opacity);
        });
      });

      eventsDrawerEl.querySelector('#agy-reset-theme-btn')?.addEventListener('click', () => {
        applyCreatorPreferences('peach', 0.12);
      });

      const searchInput = eventsDrawerEl.querySelector('#agy-drawer-search-input');
      searchInput?.addEventListener('input', (e) => {
        searchQuery = (e.target.value || '').toLowerCase();
        renderEventsDrawer();
      });

      const filterBtns = eventsDrawerEl.querySelectorAll('.agy-filter-btn[data-filter]');
      filterBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          filterBtns.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          activeFilter = btn.getAttribute('data-filter') || 'All';
          renderEventsDrawer();
        });
      });

      eventsDrawerEl.querySelector('#agy-export-jsonl-btn')?.addEventListener('click', () => {
        try {
          const events = harness.events || [];
          const text = events.map((e) => JSON.stringify(e)).join('\n');
          const blob = new Blob([text], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `session-events-${Date.now()}.jsonl`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (err) {
          console.error('[AGY-DSH] Export failed:', err);
        }
      });

      document.body.appendChild(eventsDrawerEl);
    }
    if (!eventsDrawerEl.isConnected && document.body) {
      document.body.appendChild(eventsDrawerEl);
    }
    return true;
  }

  function setupDocumentEventDelegation() {
    if (harness.docClickHandler) {
      try {
        document.removeEventListener('click', harness.docClickHandler, true);
        document.removeEventListener('mousedown', harness.docClickHandler, true);
      } catch {}
    }
    harness.docClickHandler = (e) => {
      const eventsTarget = e.target.closest('#agy-events-pill');
      if (eventsTarget) {
        e.preventDefault();
        e.stopPropagation();
        mountEventsDrawer();
        openDrawerTab('events');
        return;
      }
      const creatorTarget = e.target.closest('#agy-creator-pill');
      if (creatorTarget) {
        e.preventDefault();
        e.stopPropagation();
        mountEventsDrawer();
        openDrawerTab('creator');
        return;
      }
      const backdropTarget = e.target.closest('#agy-events-backdrop');
      const closeTarget = e.target.closest('#agy-drawer-close-btn, .agy-drawer-close, [data-drawer-close]');
      if (backdropTarget || closeTarget) {
        e.preventDefault();
        e.stopPropagation();
        setDrawerVisibility(false);
      }
    };
    document.addEventListener('click', harness.docClickHandler, true);
    document.addEventListener('mousedown', harness.docClickHandler, true);
  }

  function renderEventsDrawer() {
    if (!eventsDrawerEl) return;
    const listEl = eventsDrawerEl.querySelector('#agy-drawer-event-list');
    const badgeEl = eventsDrawerEl.querySelector('#agy-drawer-total-badge');
    if (!listEl) return;

    const events = harness.events || [];
    if (badgeEl) badgeEl.textContent = `${events.length} event${events.length === 1 ? '' : 's'}`;

    let filtered = events.slice().reverse(); // newest first
    if (activeFilter === 'Tools') {
      filtered = filtered.filter((e) => (e.event && e.event.includes('Tool')) || Boolean(e.toolName));
    } else if (activeFilter === 'Session') {
      filtered = filtered.filter((e) => (!e.event || !e.event.includes('Tool')) && !e.toolName);
    }

    if (searchQuery) {
      filtered = filtered.filter((e) => {
        const text = `${e.event || ''} ${e.toolName || ''} ${e.summary || ''} ${JSON.stringify(e.payload || '')}`.toLowerCase();
        return text.includes(searchQuery);
      });
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `<div style="padding:28px 14px;text-align:center;color:#71717a;font-size:12px;">No matching lifecycle events found.</div>`;
      return;
    }

    listEl.innerHTML = '';
    filtered.forEach((ev) => {
      const card = document.createElement('div');
      card.className = 'agy-event-card';
      const timeStr = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : '--:--:--';
      const isCacheWarn = ev.cacheWarning || (ev.summary && ev.summary.includes('[CACHE-WARN]'));

      card.innerHTML = `
        <div class="agy-event-meta">
          <div style="display:flex;align-items:center;gap:4px;">
            <span class="agy-event-type-badge" data-type="${escapeHtml(ev.event || 'Event')}">${escapeHtml(ev.event || 'Event')}</span>
            ${isCacheWarn ? `<span class="agy-event-cache-warn-badge">⚠️ CACHE-WARN</span>` : ''}
          </div>
          <span class="agy-event-time">${escapeHtml(timeStr)}</span>
        </div>
        <div class="agy-event-summary">
          ${ev.toolName ? `<span class="agy-event-tool-tag">${escapeHtml(ev.toolName)}</span> ` : ''}${escapeHtml(ev.summary || '')}
        </div>
        <div class="agy-event-details" style="display:none;">${escapeHtml(JSON.stringify(ev.payload || ev, null, 2))}</div>
      `;

      card.addEventListener('click', () => {
        const det = card.querySelector('.agy-event-details');
        if (det) {
          det.style.display = det.style.display === 'none' ? 'block' : 'none';
        }
      });

      listEl.appendChild(card);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Visual Context Meter (Overview Panel Full Card)
  // ─────────────────────────────────────────────────────────────────────────────
  let cardHostEl = null;
  let shadow = null;
  let cardState = null;
  let isCardOpen = true;

  function mountContextCard() {
    const list = document.querySelector('[data-testid="overview-panel"] > .overflow-y-auto');
    if (!list) return false;
    if (cardHostEl?.parentElement === list) return true;

    if (!cardHostEl) {
      cardHostEl = document.createElement('div');
      cardHostEl.id = 'agy-context-card';
      cardHostEl.setAttribute('data-dsh-injected', 'true');
      shadow = cardHostEl.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <style>
          :host { display: block; padding: 4px 6px; font-family: var(--font-sans, system-ui, sans-serif); color: var(--foreground, #dcdcde); }
          *, *::before, *::after { box-sizing: border-box; }
          button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: start; }
          .head { display: flex; align-items: center; gap: 6px; width: 100%; height: 26px; padding: 0 6px; border-radius: 6px; font-size: 12px; font-weight: 500; transition: background 150ms ease; }
          .head:hover { background: rgba(255, 255, 255, 0.05); }
          .title { color: var(--foreground, #dcdcde); opacity: 0.75; }
          .chip { padding: 1px 6px; border-radius: 9999px; background: rgba(255, 255, 255, 0.08); font-size: 10px; font-family: var(--font-mono, monospace); line-height: 14px; margin-left: auto; }
          .chevron { margin-left: 4px; transition: transform 180ms ease; rotate: 90deg; }
          .head[aria-expanded="false"] .chevron { rotate: 0deg; }
          .summary { padding: 3px 6px 5px; font-size: 11px; color: var(--muted-foreground, #86868c); font-variant-numeric: tabular-nums; }
          .bar { display: flex; gap: 1px; height: 5px; margin: 0 6px 6px; border-radius: 3px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
          .seg { flex: var(--v, 1) 1 0; min-width: 2px; background: var(--c, #e5a84b); transition: flex-grow 300ms ease; }
          .seg.free { background: transparent; }
          .legend { list-style: none; margin: 0; padding: 0; font-size: 11px; }
          .row { display: grid; grid-template-columns: 8px 1fr auto 40px; align-items: center; gap: 6px; padding: 3px 6px; border-radius: 4px; font-variant-numeric: tabular-nums; color: var(--muted-foreground, #86868c); }
          .row:hover { background: rgba(255, 255, 255, 0.04); color: var(--foreground, #dcdcde); }
          .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c); }
          .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .n, .p { text-align: end; font-family: var(--font-mono, monospace); }
          .total { padding: 4px 6px 2px; font-size: 11px; color: var(--muted-foreground, #86868c); border-top: 1px solid rgba(255, 255, 255, 0.06); margin-top: 4px; }
          .body[hidden] { display: none; }
        </style>
        <section aria-label="Context Window">
          <button class="head" aria-expanded="true">
            <span class="title">Context Window</span>
            <span class="chip">0%</span>
            <span class="chevron">${CHEVRON_SVG}</span>
          </button>
          <div class="summary">Calculating context usage...</div>
          <div class="bar" role="meter" aria-label="Context used"></div>
          <div class="body">
            <ul class="legend"></ul>
            <div class="total" hidden></div>
          </div>
        </section>`;
      cardState = {
        head: shadow.querySelector('.head'),
        chip: shadow.querySelector('.chip'),
        summary: shadow.querySelector('.summary'),
        bar: shadow.querySelector('.bar'),
        body: shadow.querySelector('.body'),
        legend: shadow.querySelector('.legend'),
        total: shadow.querySelector('.total'),
      };
      cardState.head.addEventListener('click', () => {
        isCardOpen = !isCardOpen;
        cardState.head.setAttribute('aria-expanded', String(isCardOpen));
        cardState.body.hidden = !isCardOpen;
      });
    }

    list.prepend(cardHostEl);
    return true;
  }

  let lastCardStateKey = '';
  function renderContextCard(usage, windowSize, convTotal, groups) {
    if (!mountContextCard() || !cardState) return;

    const used = usage?.used ?? 0;
    const cardKey = `${used}:${windowSize}:${convTotal?.input || 0}:${convTotal?.output || 0}:${(groups || []).length}`;
    if (cardKey === lastCardStateKey) return;
    lastCardStateKey = cardKey;

    const share = EFFECTIVE_COMPACT_LIMIT > 0 ? used / EFFECTIVE_COMPACT_LIMIT : 0;
    const free = Math.max(0, EFFECTIVE_COMPACT_LIMIT - used);
    const custom = (groups ?? []).reduce((s, g) => s + g.tokens, 0);

    cardState.chip.textContent = pct(used, EFFECTIVE_COMPACT_LIMIT);
    cardState.summary.textContent = used > 0
      ? `${fmt(used)} of 250k compaction limit (${(share * 100).toFixed(1)}%)`
      : 'No model response yet';

    // Segments breakdown
    const parts = [
      { id: 'conversation', name: 'Conversation & system', tokens: Math.max(0, used - custom), color: '#dcdcde' },
      ...(groups ?? []).map((g) => ({
        id: `g${g.type}`,
        name: g.name,
        tokens: g.tokens,
        color: g.type === 3 ? '#7aa2f7' : g.type === 4 ? '#73daca' : g.type === 5 ? '#e5a84b' : '#86868c',
      })),
      { id: 'free', name: 'Free space', tokens: free, color: 'transparent' },
    ];

    cardState.bar.innerHTML = parts
      .map((p) => `<span class="seg${p.id === 'free' ? ' free' : ''}" style="--v:${Math.max(p.tokens / EFFECTIVE_COMPACT_LIMIT, 0.003)};--c:${p.color}"></span>`)
      .join('');

    cardState.legend.innerHTML = parts
      .filter((p) => p.id !== 'free' && p.tokens > 0)
      .map((p) => `
        <li class="row">
          <span class="dot" style="--c:${p.color}"></span>
          <span class="name">${p.name}</span>
          <span class="n">${fmt(p.tokens)}</span>
          <span class="p">${pct(p.tokens, windowSize)}</span>
        </li>
      `).join('');

    if (convTotal && (convTotal.input || convTotal.output)) {
      cardState.total.hidden = false;
      cardState.total.textContent = `Session: ${fmt(convTotal.input)} in · ${fmt(convTotal.output)} out · ${fmt(convTotal.cache)} cache`;
    } else {
      cardState.total.hidden = true;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Turn Token Counter (In Chat Toolbar)
  // ─────────────────────────────────────────────────────────────────────────────
  const TOOLBAR_SELECTOR = '[data-testid="cascade-system-message-toolbar"]';

  function labelToolbar(toolbar) {
    if (!toolbar) return;
    const group = toolbar.querySelector(':scope > div > div.ml-auto');
    if (!group) return;

    let f = fiberOf(toolbar);
    let steps = null;
    for (let i = 0; f && i < 8; i++, f = f.return) {
      if (Array.isArray(f.memoizedProps?.steps) && 'showThumbsUpDown' in f.memoizedProps) {
        steps = f.memoizedProps.steps;
        break;
      }
    }
    if (!steps) return;

    let inTok = 0, outTok = 0, cacheTok = 0;
    for (const s of steps) {
      const u = s?.metadata?.modelUsage;
      if (!u) continue;
      inTok += num(u.inputTokens) + num(u.cacheWriteTokens);
      outTok += num(u.outputTokens);
      cacheTok += num(u.cacheReadTokens);
    }
    if (!inTok && !outTok) return;

    const totalPrompt = inTok + cacheTok;
    const hitRate = totalPrompt > 0 ? ((cacheTok / totalPrompt) * 100).toFixed(0) : '0';

    let el = group.querySelector(':scope > .agy-turn-tokens');
    if (!el) {
      el = document.createElement('span');
      el.className = 'agy-turn-tokens';
      el.setAttribute('data-dsh-injected', 'true');
      group.prepend(el);
    }

    const fullText = cacheTok > 0
      ? `${fmt(inTok)} in · ${fmt(outTok)} out · ${fmt(cacheTok)} cache <span class="hit-rate">(${hitRate}% hit)</span>`
      : `${fmt(inTok)} in · ${fmt(outTok)} out`;

    const compactText = cacheTok > 0
      ? `${fmt(inTok)}↓ ${fmt(outTok)}↑ <span class="hit-rate">⚡${hitRate}%</span>`
      : `${fmt(inTok)}↓ ${fmt(outTok)}↑`;

    if (el.getAttribute('data-full-text') !== fullText) el.setAttribute('data-full-text', fullText);
    if (el.getAttribute('data-compact-text') !== compactText) el.setAttribute('data-compact-text', compactText);

    if (isCompactHUD) {
      if (el.getAttribute('data-compact') !== 'true') el.setAttribute('data-compact', 'true');
      if (el.innerHTML !== compactText) el.innerHTML = compactText;
    } else {
      if (el.hasAttribute('data-compact')) el.removeAttribute('data-compact');
      if (el.innerHTML !== fullText) el.innerHTML = fullText;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Code Block Tools (Line Numbers & Wrap Lines)
  // ─────────────────────────────────────────────────────────────────────────────
  const COPY_SELECTOR = 'button[aria-label="Copy code"], button[aria-label="Copied"]';
  const COOKIE_CODE = 'agy-code';

  const readCodePref = () => {
    try {
      const flags = ((document.cookie.match(/(?:^|;\s*)agy-code=([^;]*)/) || [])[1] || '').split('.');
      return { nowrap: flags.includes('nowrap'), lines: flags.includes('lines') };
    } catch {
      return { nowrap: false, lines: false };
    }
  };

  let codePref = readCodePref();

  function applyCodePref() {
    const root = document.documentElement;
    root.toggleAttribute('data-agy-code-nowrap', codePref.nowrap);
    root.toggleAttribute('data-agy-code-lines', codePref.lines);
    document.querySelectorAll('.agy-code-tool[data-tool="wrap"]').forEach((b) => {
      b.setAttribute('aria-pressed', String(codePref.nowrap));
    });
    document.querySelectorAll('.agy-code-tool[data-tool="lines"]').forEach((b) => {
      b.setAttribute('aria-pressed', String(codePref.lines));
    });
  }

  function toggleCodePref(key) {
    if (key === 'wrap') codePref.nowrap = !codePref.nowrap;
    else codePref.lines = !codePref.lines;
    const val = [codePref.nowrap && 'nowrap', codePref.lines && 'lines'].filter(Boolean).join('.');
    try {
      document.cookie = `${COOKIE_CODE}=${val}; Max-Age=31536000; Path=/; SameSite=Strict; Secure`;
    } catch {}
    applyCodePref();
  }

  function decorateCodeBlock(copyBtn) {
    const group = copyBtn.parentElement;
    const header = group?.parentElement;
    const block = header?.parentElement;
    if (!block || !header?.nextElementSibling || group.querySelector('.agy-code-tool')) return;

    block.classList.add('agy-code');

    // Wrap Button
    const wrapBtn = document.createElement('button');
    wrapBtn.type = 'button';
    wrapBtn.className = 'agy-code-tool';
    wrapBtn.dataset.tool = 'wrap';
    wrapBtn.title = 'Toggle Line Wrap';
    wrapBtn.setAttribute('data-dsh-injected', 'true');
    wrapBtn.setAttribute('aria-pressed', String(codePref.nowrap));
    wrapBtn.innerHTML = '<svg viewBox="0 -960 960 960" fill="currentColor" style="width:14px;height:14px;"><path d="M570 -192 432 -330 570 -468 621 -417 569 -366H672Q702 -366 723 -387Q744 -408 744 -438Q744 -468 723 -489Q702 -510 672 -510H192V-582H672Q732 -582 774 -540Q816 -498 816 -438Q816 -378 774 -336Q732 -294 672 -294H570L621 -243ZM192 -294V-366H384V-294ZM192 -726V-798H768V-726Z"/></svg>';
    wrapBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCodePref('wrap');
    });

    // Lines Button
    const linesBtn = document.createElement('button');
    linesBtn.type = 'button';
    linesBtn.className = 'agy-code-tool';
    linesBtn.dataset.tool = 'lines';
    linesBtn.title = 'Toggle Line Numbers';
    linesBtn.setAttribute('data-dsh-injected', 'true');
    linesBtn.setAttribute('aria-pressed', String(codePref.lines));
    linesBtn.innerHTML = '<svg viewBox="0 -960 960 960" fill="currentColor" style="width:14px;height:14px;"><path d="M144 -144V-192H240V-216H192V-264H240V-288H144V-336H264Q274 -336 281 -329Q288 -322 288 -312V-264Q288 -254 281 -247Q274 -240 264 -240Q274 -240 281 -233Q288 -226 288 -216V-168Q288 -158 281 -151Q274 -144 264 -144ZM144 -384V-480Q144 -490 151 -497Q158 -504 168 -504H240V-528H144V-576H264Q274 -576 281 -569Q288 -562 288 -552V-480Q288 -470 281 -463Q274 -456 264 -456H192V-432H288V-384ZM192 -624V-768H144V-816H240V-624ZM360 -240V-312H816V-240ZM360 -444V-516H816V-444ZM360 -648V-720H816V-648Z"/></svg>';
    linesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCodePref('lines');
    });

    group.insertBefore(wrapBtn, copyBtn);
    group.insertBefore(linesBtn, copyBtn);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. SPA Route & Container Re-attachment Engine (Bug 3)
  // ─────────────────────────────────────────────────────────────────────────────
  let vpObserver = null;

  function reattachViewportObserver() {
    const currentVp = document.querySelector('[data-testid="autoscroll-viewport"]');
    if (currentVp === harness.activeViewport && currentVp !== null) {
      return;
    }

    // Viewport element changed (user switched conversation or returned from Home)
    if (vpObserver) {
      try { vpObserver.disconnect(); } catch {}
      vpObserver = null;
    }

    harness.activeViewport = currentVp;

    if (currentVp) {
      vpObserver = new MutationObserver((mutations) => {
        try {
          for (const m of mutations) {
            if (m.target?.closest?.('[data-dsh-injected="true"]') || m.target?.id?.startsWith('agy-')) continue;
            for (const n of m.addedNodes) {
              if (n.nodeType !== 1) continue;
              if (n.matches?.(TOOLBAR_SELECTOR)) labelToolbar(n);
              else n.querySelectorAll?.(TOOLBAR_SELECTOR).forEach(labelToolbar);

              if (n.matches?.(COPY_SELECTOR)) decorateCodeBlock(n);
              else n.querySelectorAll?.(COPY_SELECTOR).forEach(decorateCodeBlock);
            }
          }
        } catch {}
      });

      vpObserver.observe(currentVp, { childList: true, subtree: true });
      harness.observers.push(vpObserver);

      // Immediate scan of newly mounted viewport contents
      currentVp.querySelectorAll(TOOLBAR_SELECTOR).forEach(labelToolbar);
      currentVp.querySelectorAll(COPY_SELECTOR).forEach(decorateCodeBlock);
    }
  }

  // Lightweight layout observer on #root to detect SPA page changes (<16ms)
  function setupRootLayoutObserver() {
    const rootEl = document.getElementById('root') || document.body;
    if (!rootEl) return;

    let scheduled = false;
    const rootObserver = new MutationObserver((mutations) => {
      let hasExternalChange = false;
      for (const m of mutations) {
        if (m.target?.closest?.('[data-dsh-injected="true"]') || m.target?.id?.startsWith('agy-')) continue;
        hasExternalChange = true;
        break;
      }
      if (!hasExternalChange) return;

      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        reattachViewportObserver();
        mountPillBar();
      });
    });

    rootObserver.observe(rootEl, { childList: true, subtree: true });
    harness.observers.push(rootObserver);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. Main Loop Tick with Strict Equality, Throttling & Idle Fingerprinting
  // ─────────────────────────────────────────────────────────────────────────────
  let lastTickTimestamp = 0;
  let lastStateFingerprint = '';
  const TICK_COOLDOWN_MS = 500;

  function tick(force = false) {
    const now = Date.now();
    if (!force && (now - lastTickTimestamp) < TICK_COOLDOWN_MS) {
      return;
    }
    lastTickTimestamp = now;

    // Metric instrumentation for closed-loop verification
    harness.tickCount = (harness.tickCount || 0) + 1;

    try {
      reattachViewportObserver();
      checkComposerWidth();

      const slice = readSlice();
      const usage = readUsage(slice);
      const modelName = readModelName(slice);
      const windowSize = readWindowSize(slice);
      const convTotal = countTotal(slice);
      const eventsCount = harness.events?.length ?? 0;

      // Fingerprint to avoid any DOM operations if data has not changed
      const currentFingerprint = `${slice?.messages?.length || 0}:${usage?.used || 0}:${usage?.inputTokens || 0}:${usage?.outputTokens || 0}:${usage?.cacheHitRate || 0}:${modelName || ''}:${windowSize || 0}:${convTotal?.input || 0}:${convTotal?.output || 0}:${eventsCount}:${isCompactHUD ? 1 : 0}`;

      if (!force && currentFingerprint === lastStateFingerprint) {
        return;
      }
      lastStateFingerprint = currentFingerprint;

      updateMiniPill(usage, windowSize, modelName, convTotal, harness.cachedBase);
      updateEventsPill();

      refreshBase(slice, (groups) => {
        renderContextCard(usage, windowSize, convTotal, groups);
        updateMiniPill(usage, windowSize, modelName, convTotal, groups);
        updateEventsPill();
      });
      if (harness.cachedBase) {
        renderContextCard(usage, windowSize, convTotal, harness.cachedBase);
      }
    } catch (err) {
      // safe degradation: do not throw into host app
    }
  }

  // 10. Zoom Shortcut Engine (Ctrl+=, Ctrl+-, Ctrl+0)
  function setupZoomShortcuts() {
    const keyHandler = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') {
          e.preventDefault();
          if (window.electronNative && typeof window.electronNative.zoomIn === 'function') {
            window.electronNative.zoomIn();
          }
        } else if (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          if (window.electronNative && typeof window.electronNative.zoomOut === 'function') {
            window.electronNative.zoomOut();
          }
        } else if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
          e.preventDefault();
          if (window.electronNative && typeof window.electronNative.resetZoom === 'function') {
            window.electronNative.resetZoom();
          }
        }
      }
    };
    window.addEventListener('keydown', keyHandler, { capture: true });
  }

  // Initialize
  try { localStorage.removeItem('agy_dsh_compaction_tracker'); } catch {}
  applyCodePref();
  initCreatorPreferences();
  mountPillBar();
  mountEventsDrawer();
  setupDocumentEventDelegation();
  updateEventsPill();
  setupZoomShortcuts();
  reattachViewportObserver();
  setupRootLayoutObserver();

  // Tick immediately then periodically at 5000ms idle interval
  tick(true);
  const timer = setInterval(() => tick(false), 5000);
  harness.intervals.push(timer);

  console.log('[AGY-DSH] HUD Overlay v1.2 initialized: Context Pill, Events Drawer & Subtle Cosmic Theme Active.');
})();
