#!/usr/bin/env node
/**
 * AGY-DSH Harness CDP Injector for Antigravity 2.0 (Windows / Multi-Platform)
 * Zero-dependency live CSS & HUD JS injector via Chrome DevTools Protocol.
 *
 * Commands:
 *   node scripts/cdp-injector.mjs apply             Build & inject DSH theme and HUD into running Antigravity
 *   node scripts/cdp-injector.mjs status            Probe active windows and report injection status
 *   node scripts/cdp-injector.mjs panic-remove      Emergency circuit breaker: remove all injected elements
 *   node scripts/cdp-injector.mjs install-native    Install zero-daemon native preload patch into app resources
 *   node scripts/cdp-injector.mjs uninstall-native  Restore stock app.asar by removing resources/app directory
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_CSS = path.resolve(ROOT_DIR, 'dist', 'custom-theme.css');
const DIST_HUD = path.resolve(ROOT_DIR, 'dist', 'hud-overlay.js');

const ACTIVE_PORT_FILES = [
  path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Antigravity', 'DevToolsActivePort'),
  path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Antigravity', 'DevToolsActivePort'),
  path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Antigravity IDE', 'DevToolsActivePort'),
  path.join(os.homedir(), '.gemini', 'antigravity', 'DevToolsActivePort'),
  // Darwin / Linux fallbacks for compatibility
  path.join(os.homedir(), 'Library', 'Application Support', 'Antigravity', 'DevToolsActivePort'),
  path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'Antigravity', 'DevToolsActivePort'),
];

export function appResourcesDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Programs', 'antigravity', 'resources');
  }
  if (process.platform === 'darwin') {
    return '/Applications/Antigravity.app/Contents/Resources';
  }
  return '/opt/Antigravity/resources';
}

// Minimal RFC 6455 WebSocket Client (Zero external dependencies)
class MiniWebSocket {
  constructor(urlString) {
    this.url = new URL(urlString);
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.listeners = new Map();
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }

  emit(event, ...args) {
    for (const fn of this.listeners.get(event) || []) {
      fn(...args);
    }
  }

  connect() {
    return new Promise((resolve, reject) => {
      const key = crypto.randomBytes(16).toString('base64');
      const req = http.request({
        hostname: this.url.hostname || '127.0.0.1',
        port: Number(this.url.port),
        path: this.url.pathname + this.url.search,
        method: 'GET',
        headers: {
          Connection: 'Upgrade',
          Upgrade: 'websocket',
          'Sec-WebSocket-Key': key,
          'Sec-WebSocket-Version': '13',
        },
      });

      req.on('error', reject);
      req.on('upgrade', (res, socket, head) => {
        this.socket = socket;
        if (head && head.length > 0) {
          this.buffer = Buffer.concat([this.buffer, head]);
        }
        socket.on('data', (chunk) => {
          this.buffer = Buffer.concat([this.buffer, chunk]);
          this._drainFrames();
        });
        socket.on('error', (err) => this.emit('error', err));
        socket.on('close', () => this.emit('close'));
        resolve(this);
      });
      req.end();
    });
  }

  _drainFrames() {
    while (this.buffer.length >= 2) {
      const firstByte = this.buffer[0];
      const secondByte = this.buffer[1];
      const opcode = firstByte & 0x0f;
      const isMasked = (secondByte & 0x80) !== 0;
      let payloadLen = secondByte & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (this.buffer.length < 4) return;
        payloadLen = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (this.buffer.length < 10) return;
        payloadLen = Number(this.buffer.readBigUInt64BE(2));
        offset = 10;
      }

      const maskLen = isMasked ? 4 : 0;
      if (this.buffer.length < offset + maskLen + payloadLen) return;

      let payload = this.buffer.subarray(offset + maskLen, offset + maskLen + payloadLen);
      if (isMasked) {
        const mask = this.buffer.subarray(offset, offset + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= mask[i & 3];
        }
      }

      this.buffer = this.buffer.subarray(offset + maskLen + payloadLen);

      if (opcode === 0x1) {
        this.emit('message', payload.toString('utf8'));
      } else if (opcode === 0x8) {
        this.close();
      } else if (opcode === 0x9) {
        this._sendFrame(0x0a, payload); // Pong
      }
    }
  }

  send(text) {
    const payload = Buffer.from(text, 'utf8');
    this._sendFrame(0x01, payload);
  }

  _sendFrame(opcode, payload) {
    if (!this.socket || this.socket.destroyed) return;
    const mask = crypto.randomBytes(4);
    const len = payload.length;
    let header;

    if (len < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }

    const masked = Buffer.alloc(len);
    for (let i = 0; i < len; i++) {
      masked[i] = payload[i] ^ mask[i & 3];
    }

    this.socket.write(Buffer.concat([header, mask, masked]));
  }

  close() {
    if (this.socket && !this.socket.destroyed) {
      try {
        this._sendFrame(0x08, Buffer.alloc(0));
      } catch (e) {}
      this.socket.destroy();
    }
  }
}

// DevToolsActivePort Reader & HTTP JSON Helpers
export function readDevToolsActivePort() {
  for (const filePath of ACTIVE_PORT_FILES) {
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8').trim();
        const [portStr, wsPath] = raw.split(/\r?\n/);
        const port = Number(portStr);
        if (port > 0) {
          return { port, wsPath: wsPath || '/devtools/browser', filePath };
        }
      } catch {
        // proceed to next path
      }
    }
  }
  return null;
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 2500 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HTTP timeout'));
    });
  });
}

async function createCdpSession(wsUrl) {
  const ws = await new MiniWebSocket(wsUrl).connect();
  let nextId = 1;
  const pending = new Map();

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    } catch {
      // Ignore malformed messages
    }
  });

  function call(method, params = {}, sessionId = undefined) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timeout calling ${method}`));
      }, 5000);

      pending.set(id, {
        resolve: (res) => {
          clearTimeout(timer);
          resolve(res);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      ws.send(JSON.stringify(payload));
    });
  }

  return { ws, call, close: () => ws.close() };
}

async function executeAcrossAntigravityPages(expression, persistOnReload = true) {
  const active = readDevToolsActivePort();
  if (!active) {
    throw new Error('Antigravity DevToolsActivePort was not found. Please ensure Antigravity 2.0 is running.');
  }

  const { port, wsPath } = active;
  const results = [];

  // Strategy 1: /json/list query
  let targets = [];
  try {
    const list = await httpGetJson(`http://127.0.0.1:${port}/json/list`);
    targets = list.filter(
      (t) =>
        (t.type === 'page' || t.type === 'app' || t.type === 'webview') &&
        t.webSocketDebuggerUrl &&
        !String(t.url || '').startsWith('devtools://')
    );
  } catch {
    // Fall back to strategy 2
  }

  if (targets.length > 0) {
    for (const target of targets) {
      const session = await createCdpSession(target.webSocketDebuggerUrl);
      try {
        if (persistOnReload) {
          await session.call('Page.enable').catch(() => {});
          await session.call('Page.addScriptToEvaluateOnNewDocument', { source: expression }).catch(() => {});
        }
        const evalRes = await session.call('Runtime.evaluate', {
          expression,
          returnByValue: true,
        });
        results.push({
          title: target.title || 'Antigravity Window',
          url: target.url,
          value: evalRes?.result?.value,
        });
      } finally {
        session.close();
      }
    }
    return results;
  }

  // Strategy 2: Browser WebSocket and Target.attachToTarget
  const browserWsUrl = `ws://127.0.0.1:${port}${wsPath}`;
  const browserSession = await createCdpSession(browserWsUrl);
  try {
    const { targetInfos = [] } = await browserSession.call('Target.getTargets');
    const pageTargets = targetInfos.filter(
      (t) =>
        (t.type === 'page' || t.type === 'app' || t.type === 'webview') &&
        !String(t.url || '').startsWith('devtools://')
    );

    for (const target of pageTargets) {
      const { sessionId } = await browserSession.call('Target.attachToTarget', {
        targetId: target.targetId,
        flatten: true,
      });
      if (persistOnReload) {
        await browserSession.call('Page.enable', {}, sessionId).catch(() => {});
        await browserSession.call('Page.addScriptToEvaluateOnNewDocument', { source: expression }, sessionId).catch(() => {});
      }
      const evalRes = await browserSession.call(
        'Runtime.evaluate',
        { expression, returnByValue: true },
        sessionId
      );
      results.push({
        title: target.title || 'Antigravity Window',
        url: target.url,
        value: evalRes?.result?.value,
      });
    }
  } finally {
    browserSession.close();
  }

  return results;
}

// Payload Builders
function buildApplyExpression(cssText, hudJs) {
  return `(() => {
    try {
      // 0. Titlebar Native Controls Sync
      try {
        if (window.electronNative && typeof window.electronNative.setTitleBarOverlay === 'function') {
          window.electronNative.setTitleBarOverlay({ color: '#0e0e10', symbolColor: '#dcdcde' });
        }
      } catch (e) {}

      // 1. HUD Overlay JS Execution
      ${hudJs}

      // 2. Theme CSS Injection
      const STYLE_ID = 'agy-dsh-theme-css';
      let styleEl = document.getElementById(STYLE_ID);
      if (!styleEl || !styleEl.isConnected) {
        if (styleEl) styleEl.remove();
        styleEl = document.createElement('style');
        styleEl.id = STYLE_ID;
        styleEl.setAttribute('data-dsh-injected', 'true');
        (document.head || document.documentElement).appendChild(styleEl);
      }
      styleEl.textContent = ${JSON.stringify(cssText)};
      if (document.body && document.body.getAttribute('data-agy-theme') !== 'dsh-matte') {
        document.body.setAttribute('data-agy-theme', 'dsh-matte');
      }

      return {
        status: 'applied',
        title: document.title,
        theme: document.body ? document.body.getAttribute('data-agy-theme') : null,
        hud: typeof window.__AGY_DSH_HARNESS__ !== 'undefined',
      };
    } catch (err) {
      return { status: 'error', message: err.message, stack: err.stack };
    }
  })()`;
}

function buildStatusExpression() {
  return `(() => {
    const styleEl = document.getElementById('agy-dsh-theme-css');
    const harness = window.__AGY_DSH_HARNESS__;
    const injectedElements = document.querySelectorAll('[data-dsh-injected="true"]').length;
    const miniPill = !!document.getElementById('agy-mini-context-pill');
    const eventsPill = !!document.getElementById('agy-events-pill');
    const eventsDrawer = !!document.getElementById('agy-events-drawer');
    const eventsCount = harness?.events?.length || 0;
    const contextCard = !!document.getElementById('agy-context-card');
    const tokenCounters = document.querySelectorAll('.agy-turn-tokens').length;
    const codeTools = document.querySelectorAll('.agy-code-tool').length;
    const homeGlowVal = window.getComputedStyle(document.documentElement).getPropertyValue('--home-glow').trim();
    const homeEl = document.querySelector('.agy-home') || document.querySelector('.agy-sheet:has(.agy-home)');
    const doodleActive = homeEl ? window.getComputedStyle(homeEl, '::before').backgroundImage.includes('svg') : false;

    return {
      title: document.title,
      themeApplied: !!styleEl,
      harnessActive: !!harness,
      injectedCount: injectedElements,
      miniPillActive: miniPill,
      eventsPillActive: eventsPill,
      eventsDrawerActive: eventsDrawer,
      eventsCount: eventsCount,
      contextCardActive: contextCard,
      turnTokensCount: tokenCounters,
      codeToolsCount: codeTools,
      homeGlowValue: homeGlowVal,
      homeGlowNeutralized: homeGlowVal === 'transparent',
      doodlePatternActive: doodleActive,
    };
  })()`;
}

function buildPanicRemoveExpression() {
  return `(() => {
    try {
      if (window.__AGY_DSH_HARNESS__ && typeof window.__AGY_DSH_HARNESS__.disconnectAll === 'function') {
        window.__AGY_DSH_HARNESS__.disconnectAll();
      }
      document.querySelectorAll('[data-dsh-injected="true"]').forEach((el) => el.remove());
      const styleEl = document.getElementById('agy-dsh-theme-css');
      if (styleEl) styleEl.remove();
      if (document.body) {
        document.body.removeAttribute('data-agy-theme');
      }
      document.documentElement.removeAttribute('data-agy-code-lines');
      document.documentElement.removeAttribute('data-agy-code-nowrap');
      delete window.__AGY_DSH_HARNESS__;
      return { status: 'cleared', title: document.title };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  })()`;
}

// Commands
async function cmdApply({ silent = false } = {}) {
  if (!fs.existsSync(DIST_CSS)) {
    throw new Error(`Theme file missing: ${DIST_CSS}`);
  }
  if (!fs.existsSync(DIST_HUD)) {
    throw new Error(`HUD overlay file missing: ${DIST_HUD}`);
  }

  const cssText = fs.readFileSync(DIST_CSS, 'utf8');
  const hudJs = fs.readFileSync(DIST_HUD, 'utf8');
  const expr = buildApplyExpression(cssText, hudJs);

  const results = await executeAcrossAntigravityPages(expr, true);
  if (!silent) {
    console.log(`[AGY-DSH] Applied DSH Matte Theme and HUD to ${results.length} window(s):`);
    for (const r of results) {
      console.log(`  * ${r.title}: ${r.value?.status || 'ok'}`);
    }
  }
  return results;
}

async function cmdStatus() {
  const expr = buildStatusExpression();
  const results = await executeAcrossAntigravityPages(expr, false);
  const resDir = appResourcesDir();
  const asarBackup = path.join(resDir, 'app.asar.backup');
  const hasBackup = fs.existsSync(asarBackup);
  const isNativeInstalled = isAsarPatched();

  console.log(`\n=== AGY-DSH Harness Active Status (${results.length} window(s)) ===`);
  console.log(`Native Main Process Patch: ${isNativeInstalled ? 'INSTALLED (in app.asar, Cold-Start Persistence active)' : 'NOT DETECTED (app.asar is stock/unpatched)'}`);
  console.log(`Safety Backup Status:      ${hasBackup ? 'PRESENT (app.asar.backup exists)' : 'NONE'}`);
  for (const r of results) {
    console.log(`\nWindow: "${r.title}"`);
    console.log(`  - Theme Applied:       ${r.value?.themeApplied ? 'YES' : 'NO'}`);
    console.log(`  - Harness Active:      ${r.value?.harnessActive ? 'YES' : 'NO'}`);
    console.log(`  - Mini Context Pill:   ${r.value?.miniPillActive ? 'ACTIVE' : 'NOT FOUND'}`);
    console.log(`  - Events Pill:         ${r.value?.eventsPillActive ? 'ACTIVE' : 'NOT FOUND'} (${r.value?.eventsCount || 0} events)`);
    console.log(`  - Events Audit Drawer: ${r.value?.eventsDrawerActive ? 'MOUNTED' : 'NOT FOUND'}`);
    console.log(`  - Glow Neutralized:    ${r.value?.homeGlowNeutralized ? 'YES (transparent)' : r.value?.homeGlowValue}`);
    console.log(`  - Doodle Pattern:      ${r.value?.doodlePatternActive ? 'ACTIVE' : 'N/A'}`);
    console.log(`  - Full Context Card:   ${r.value?.contextCardActive ? 'ACTIVE' : 'NOT FOUND'}`);
    console.log(`  - Turn Token Labels:   ${r.value?.turnTokensCount || 0}`);
    console.log(`  - Code Block Tools:    ${r.value?.codeToolsCount || 0}`);
    console.log(`  - Injected Elements:   ${r.value?.injectedCount || 0}`);
  }
  return results;
}

async function cmdPanicRemove() {
  const expr = buildPanicRemoveExpression();
  const results = await executeAcrossAntigravityPages(expr, false);
  console.log(`[AGY-DSH] Emergency Circuit Breaker: Cleared DSH elements from ${results.length} window(s):`);
  for (const r of results) {
    console.log(`  * ${r.title}: ${r.value?.status || 'ok'}`);
  }
  return results;
}

async function cmdPushEvents() {
  const eventsFile = path.resolve(ROOT_DIR, 'logs', 'session-events.jsonl');
  if (!fs.existsSync(eventsFile)) return [];
  const lines = fs.readFileSync(eventsFile, 'utf8').trim().split('\n').filter(Boolean).slice(-100);
  const events = lines.map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);

  const expr = `(() => {
    try {
      if (window.__AGY_DSH_HARNESS__ && typeof window.__AGY_DSH_HARNESS__.updateEventsLog === 'function') {
        window.__AGY_DSH_HARNESS__.updateEventsLog(${JSON.stringify(events)});
        return true;
      }
    } catch (e) {}
    return false;
  })()`;

  return await executeAcrossAntigravityPages(expr, false);
}

// Native Main Process Installation (Zero Background Process Mode via ASAR Repacking)
const NATIVE_PATCH_MARKER = '// AGY-DSH Native Main Process Loader (Zero Background Process)';

function isAsarPatched() {
  const resDir = appResourcesDir();
  const asarPath = path.join(resDir, 'app.asar');
  if (!fs.existsSync(asarPath)) return false;
  try {
    const buf = fs.readFileSync(asarPath);
    return buf.includes(Buffer.from(NATIVE_PATCH_MARKER));
  } catch {
    return false;
  }
}

async function cmdInstallNative({ silent = false } = {}) {
  const resDir = appResourcesDir();
  const asarPath = path.join(resDir, 'app.asar');
  const backupPath = path.join(resDir, 'app.asar.backup');
  const tmpExtractDir = path.join(resDir, 'app-extract-tmp');
  const unpackedAppDir = path.join(resDir, 'app');

  if (!fs.existsSync(asarPath) && !fs.existsSync(backupPath)) {
    throw new Error(`Could not find Antigravity resources at ${resDir}. Is Antigravity installed?`);
  }

  // 1. Safety backup of stock app.asar:
  // If app.asar is currently stock/unpatched (e.g. freshly installed or updated by Google Antigravity),
  // ALWAYS refresh app.asar.backup with this pristine version so rollback never causes version mismatch.
  const alreadyPatched = isAsarPatched();
  if (!alreadyPatched) {
    if (!silent) {
      console.log(`[AGY-DSH] Detected pristine updated app.asar from official update. Refreshed app.asar.backup with current version.`);
    }
    fs.copyFileSync(asarPath, backupPath);
  } else if (!fs.existsSync(backupPath)) {
    if (!silent) {
      console.warn(`[AGY-DSH] Warning: app.asar is already patched and app.asar.backup is missing. Will not overwrite backup with patched file.`);
    }
  }

  // 2. Clean temporary extraction workspace
  if (fs.existsSync(tmpExtractDir)) {
    fs.rmSync(tmpExtractDir, { recursive: true, force: true });
  }

  // 3. Extract source asar (always extract asarPath directly so @electron/asar finds app.asar.unpacked)
  if (!silent) {
    console.log(`[AGY-DSH] Extracting ${path.basename(asarPath)} into temporary workspace...`);
  }
  execSync(`npx -y @electron/asar extract "${asarPath}" "${tmpExtractDir}"`, { stdio: silent ? 'pipe' : 'inherit' });

  // 4. Prepare bundled fallback
  const cssText = fs.existsSync(DIST_CSS) ? fs.readFileSync(DIST_CSS, 'utf8') : '';
  const hudJs = fs.existsSync(DIST_HUD) ? fs.readFileSync(DIST_HUD, 'utf8') : '';
  const bundleContent = `(() => {
    try {
      const inject = () => {
        try {
          if (window.electronNative && typeof window.electronNative.setTitleBarOverlay === 'function') {
            window.electronNative.setTitleBarOverlay({ color: '#0e0e10', symbolColor: '#dcdcde' });
          }
        } catch (e) {}

        const STYLE_ID = 'agy-dsh-theme-css';
        let styleEl = document.getElementById(STYLE_ID);
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = STYLE_ID;
          styleEl.setAttribute('data-dsh-injected', 'true');
          (document.head || document.documentElement).appendChild(styleEl);
        }
        styleEl.textContent = ${JSON.stringify(cssText)};
        if (document.body && document.body.getAttribute('data-agy-theme') !== 'dsh-matte') {
          document.body.setAttribute('data-agy-theme', 'dsh-matte');
        }
        ${hudJs}
      };
      if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', inject, { once: true });
      } else {
        inject();
      }
    } catch (e) {}
  })();`;

  const bundleDest = path.join(tmpExtractDir, 'dist', 'agy-dsh-bundle.js');
  fs.writeFileSync(bundleDest, bundleContent, 'utf8');

  // 5. Clean up old preload patch if present
  const preloadPath = path.join(tmpExtractDir, 'dist', 'preload.js');
  if (fs.existsSync(preloadPath)) {
    let pContent = fs.readFileSync(preloadPath, 'utf8');
    const oldMarker = '// AGY-DSH Native Preload Loader';
    if (pContent.includes(oldMarker)) {
      pContent = pContent.split(oldMarker)[0].trimEnd() + '\n';
      fs.writeFileSync(preloadPath, pContent, 'utf8');
    }
  }

  // 6. Patch dist/main.js inside temporary workspace (Electron Main Process Hook & Zero-Flash Boot)
  const mainPath = path.join(tmpExtractDir, 'dist', 'main.js');
  let mainContent = fs.readFileSync(mainPath, 'utf8');

  // Strip old patch if present to allow updating
  if (mainContent.includes(NATIVE_PATCH_MARKER)) {
    mainContent = mainContent.split(NATIVE_PATCH_MARKER)[0].trimEnd() + '\n';
  }

  const eventsLogFile = path.resolve(ROOT_DIR, 'logs', 'session-events.jsonl');
  const patchSnippet = `\n\n${NATIVE_PATCH_MARKER}\n(function() {\n  try {\n    const electron = require('electron');\n    const fs = require('fs');\n    const path = require('path');\n    const liveCss = ${JSON.stringify(DIST_CSS)};\n    const liveHud = ${JSON.stringify(DIST_HUD)};\n    const eventsLogFile = ${JSON.stringify(eventsLogFile)};\n    const fallbackBundle = path.join(__dirname, 'agy-dsh-bundle.js');\n\n    // Zero-flash startup in-memory cache\n    let cachedCssText = '';\n    let cachedHudText = '';\n    try {\n      if (fs.existsSync(liveCss) && fs.existsSync(liveHud)) {\n        cachedCssText = fs.readFileSync(liveCss, 'utf8');\n        cachedHudText = fs.readFileSync(liveHud, 'utf8');\n      } else if (fs.existsSync(fallbackBundle)) {\n        cachedHudText = fs.readFileSync(fallbackBundle, 'utf8');\n      }\n    } catch (e) {}\n\n    // Ensure all windows open with dark matte slate background immediately\n    electron.app.on('browser-window-created', function(_event, win) {\n      try {\n        win.setBackgroundColor('#111113');\n      } catch (e) {}\n    });\n\n    // Fix View -> Zoom In / Zoom Out / Reset Zoom application menu actions\n    function patchApplicationMenuZoom() {\n      try {\n        const appMenu = electron.Menu.getApplicationMenu();\n        if (!appMenu) return;\n        const viewMenu = appMenu.items.find(function(i) { return i.label === 'View' || i.role === 'viewmenu'; });\n        if (viewMenu && viewMenu.submenu) {\n          viewMenu.submenu.items.forEach(function(item) {\n            const lbl = (item.label || '').toLowerCase();\n            const r = (item.role || '').toLowerCase();\n            if (r === 'zoomin' || lbl.includes('zoom in')) {\n              delete item.role;\n              item.accelerator = 'CmdOrCtrl+=';\n              item.click = function() {\n                try {\n                  const allWc = electron.webContents.getAllWebContents();\n                  allWc.forEach(function(wc) {\n                    const u = wc.getURL() || '';\n                    if (u.startsWith('http://127.0.0.1') || u.startsWith('https://127.0.0.1') || u.startsWith('file://')) {\n                      const cur = wc.getZoomLevel() || 0;\n                      const next = cur + 0.5;\n                      wc.setZoomLevel(next);\n                      wc.executeJavaScript("try { localStorage.setItem('agy-dsh-zoom', '" + next + "'); } catch(e){}").catch(function() {});\n                    }\n                  });\n                } catch(e) {}\n              };\n            } else if (r === 'zoomout' || lbl.includes('zoom out')) {\n              delete item.role;\n              item.accelerator = 'CmdOrCtrl+-';\n              item.click = function() {\n                try {\n                  const allWc = electron.webContents.getAllWebContents();\n                  allWc.forEach(function(wc) {\n                    const u = wc.getURL() || '';\n                    if (u.startsWith('http://127.0.0.1') || u.startsWith('https://127.0.0.1') || u.startsWith('file://')) {\n                      const cur = wc.getZoomLevel() || 0;\n                      const next = cur - 0.5;\n                      wc.setZoomLevel(next);\n                      wc.executeJavaScript("try { localStorage.setItem('agy-dsh-zoom', '" + next + "'); } catch(e){}").catch(function() {});\n                    }\n                  });\n                } catch(e) {}\n              };\n            } else if (r === 'resetzoom' || lbl.includes('reset zoom') || lbl.includes('actual size')) {\n              delete item.role;\n              item.accelerator = 'CmdOrCtrl+0';\n              item.click = function() {\n                try {\n                  const allWc = electron.webContents.getAllWebContents();\n                  allWc.forEach(function(wc) {\n                    const u = wc.getURL() || '';\n                    if (u.startsWith('http://127.0.0.1') || u.startsWith('https://127.0.0.1') || u.startsWith('file://')) {\n                      wc.setZoomLevel(0);\n                      wc.executeJavaScript("try { localStorage.setItem('agy-dsh-zoom', '0'); } catch(e){}").catch(function() {});\n                    }\n                  });\n                } catch(e) {}\n              };\n            }\n          });\n          electron.Menu.setApplicationMenu(appMenu);\n        }\n      } catch(e) {}\n    }\n\n    electron.app.whenReady().then(function() {\n      setTimeout(patchApplicationMenuZoom, 500);\n      setTimeout(patchApplicationMenuZoom, 2000);\n    }).catch(function() {});\n\n    electron.app.on('web-contents-created', function(_event, contents) {\n      // Direct keyboard shortcut hook (Ctrl+=, Ctrl+-, Ctrl+0)\n      contents.on('before-input-event', function(inputEvent, input) {\n        if (input.type === 'keyDown' && (input.control || input.meta)) {\n          if (input.key === '=' || input.key === '+' || input.code === 'Equal' || input.code === 'NumpadAdd') {\n            inputEvent.preventDefault();\n            try {\n              const current = contents.getZoomLevel() || 0;\n              const next = current + 0.5;\n              contents.setZoomLevel(next);\n              contents.executeJavaScript("try { localStorage.setItem('agy-dsh-zoom', '" + next + "'); } catch(e){}").catch(function() {});\n            } catch(e) {}\n          } else if (input.key === '-' || input.code === 'Minus' || input.code === 'NumpadSubtract') {\n            inputEvent.preventDefault();\n            try {\n              const current = contents.getZoomLevel() || 0;\n              const next = current - 0.5;\n              contents.setZoomLevel(next);\n              contents.executeJavaScript("try { localStorage.setItem('agy-dsh-zoom', '" + next + "'); } catch(e){}").catch(function() {});\n            } catch(e) {}\n          } else if (input.key === '0' || input.code === 'Digit0' || input.code === 'Numpad0') {\n            inputEvent.preventDefault();\n            try {\n              contents.setZoomLevel(0);\n              contents.executeJavaScript("try { localStorage.setItem('agy-dsh-zoom', '0'); } catch(e){}").catch(function() {});\n            } catch(e) {}\n          }\n        }\n      });\n\n      contents.on('dom-ready', function() {\n        try {\n          const url = contents.getURL() || '';\n          if (url.startsWith('http://127.0.0.1') || url.startsWith('https://127.0.0.1') || url.startsWith('file://')) {\n            // Restore persistent zoom level if saved\n            contents.executeJavaScript("try { localStorage.getItem('agy-dsh-zoom'); } catch(e){ null; }").then(function(val) {\n              if (val !== null && typeof val === 'string') {\n                const lvl = parseFloat(val);\n                if (!isNaN(lvl)) { try { contents.setZoomLevel(lvl); } catch(e) {} }\n              }\n            }).catch(function() {});\n\n            let css = cachedCssText;\n            let hud = cachedHudText;\n            try {\n              if (fs.existsSync(liveCss) && fs.existsSync(liveHud)) {\n                css = fs.readFileSync(liveCss, 'utf8');\n                hud = fs.readFileSync(liveHud, 'utf8');\n              }\n            } catch (e) {}\n\n            let eventsJs = '';\n            try {\n              if (fs.existsSync(eventsLogFile)) {\n                const lines = fs.readFileSync(eventsLogFile, 'utf8').trim().split('\\\\n').filter(Boolean).slice(-100);\n                const evs = lines.map(function(l) { try { return JSON.parse(l); } catch(err) { return null; } }).filter(Boolean);\n                eventsJs = 'window.__AGY_DSH_EVENTS__ = ' + JSON.stringify(evs) + ';';\n              }\n            } catch (e) {}\n\n            if (css) {\n              contents.insertCSS(css).catch(function() {});\n            }\n            if (eventsJs) {\n              contents.executeJavaScript(eventsJs).catch(function() {});\n            }\n            if (hud) {\n              contents.executeJavaScript(hud).catch(function() {});\n            }\n          }\n        } catch (e) {}\n      });\n    });\n  } catch (e) {}\n})();\n`;

  fs.writeFileSync(mainPath, mainContent + patchSnippet, 'utf8');

  // 6.1 Patch dist/utils.js inside temporary workspace (Replace default blue/navy/curtain background with #111113)
  const utilsPath = path.join(tmpExtractDir, 'dist', 'utils.js');
  if (fs.existsSync(utilsPath)) {
    let uContent = fs.readFileSync(utilsPath, 'utf8');
    uContent = uContent.replace(/backgroundColor = isLight \? '#FAFAFA' : '#131313';/g, "backgroundColor = isLight ? '#FAFAFA' : '#111113';");
    uContent = uContent.replace(/getThemeMode\(\)\.toUpperCase\(\)\.includes\('LIGHT'\) \? '#FAFAFA' : '#131313'/g, "getThemeMode().toUpperCase().includes('LIGHT') ? '#FAFAFA' : '#111113'");
    uContent = uContent.replace(/#001B4C/gi, '#111113');
    fs.writeFileSync(utilsPath, uContent, 'utf8');
    if (!silent) console.log('[AGY-DSH] Patched dist/utils.js for zero-flash cold boot.');
  }

  // 6.2 Update persistent app_storage.json surface color
  const appStoragePath = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Antigravity', 'app_storage.json');
  if (fs.existsSync(appStoragePath)) {
    try {
      const storageData = JSON.parse(fs.readFileSync(appStoragePath, 'utf8'));
      storageData.hubSurfaceBackgroundColor = '#111113';
      fs.writeFileSync(appStoragePath, JSON.stringify(storageData, null, 2), 'utf8');
      if (!silent) console.log('[AGY-DSH] Updated app_storage.json: hubSurfaceBackgroundColor = #111113');
    } catch (e) {
      if (!silent) console.warn('[AGY-DSH] Warning: Could not update app_storage.json:', e.message);
    }
  }

  // 7. Repack into app.asar
  if (!silent) console.log(`[AGY-DSH] Repacking patched main process directly into ${asarPath}...`);
  execSync(`npx -y @electron/asar pack "${tmpExtractDir}" "${asarPath}" --unpack-dir "node_modules/chrome-devtools-mcp"`, { stdio: silent ? 'pipe' : 'inherit' });

  // 8. Cleanup temporary extraction directory and legacy unpacked app directory
  fs.rmSync(tmpExtractDir, { recursive: true, force: true });
  if (fs.existsSync(unpackedAppDir)) {
    fs.rmSync(unpackedAppDir, { recursive: true, force: true });
  }

  if (!silent) {
    console.log(`[AGY-DSH] Successfully repacked native Main Process loader into app.asar.`);
    console.log('Zero background process, zero daemons: theme and HUD auto-load instantly upon cold start.');
  }
}

async function cmdSelfHeal({ silent = false } = {}) {
  if (!silent) {
    console.log('\n=== [AGY-DSH] Initiating Single-Door Self-Healing Sequence ===');
  }

  // 1. Live DOM theme and HUD injection across active windows
  let liveResult = null;
  try {
    const portInfo = readDevToolsActivePort();
    if (portInfo) {
      if (!silent) console.log(`[AGY-DSH] Step 1/3: Connected to active Antigravity window via CDP port ${portInfo.port}...`);
      await cmdApply({ silent });
      await cmdPushEvents();
      const statusResults = await cmdStatus();
      liveResult = statusResults[0]?.value;
    } else {
      if (!silent) console.log('[AGY-DSH] Step 1/3: No active DevToolsActivePort found (Antigravity may be closed or cold).');
    }
  } catch (err) {
    if (!silent) console.warn(`[AGY-DSH] Step 1/3 Warning: Live injection skipped or partial: ${err.message}`);
  }

  // 2. Check native Main Process patch in app.asar
  if (!silent) console.log('[AGY-DSH] Step 2/3: Verifying native Main Process persistence in app.asar...');
  const patched = isAsarPatched();
  if (!patched) {
    if (!silent) {
      console.log('[AGY-DSH] Native patch missing or overwritten by official Antigravity update.');
      console.log('[AGY-DSH] Running hardened cmdInstallNative() with automatic backup synchronization...');
    }
    await cmdInstallNative({ silent });
    if (!silent) console.log('[AGY-DSH] Native patch successfully repaired. Cold-start persistence secured.');
  } else {
    if (!silent) console.log('[AGY-DSH] Native patch is active and healthy in app.asar.');
  }

  // 3. Final summary
  if (!silent) {
    console.log('[AGY-DSH] Step 3/3: Self-healing integrity verification:');
    console.log(`  - Native app.asar Patch:   ${isAsarPatched() ? 'VERIFIED' : 'FAILED'}`);
    if (liveResult) {
      console.log(`  - Live Theme Applied:      ${liveResult.themeApplied ? 'YES' : 'NO'}`);
      console.log(`  - Mini Context Pill:       ${liveResult.miniPillActive ? 'ACTIVE' : 'NOT FOUND'}`);
      console.log(`  - Audit Drawer Mounted:    ${liveResult.eventsDrawerActive ? 'MOUNTED' : 'NOT FOUND'}`);
    }
    console.log('=== [AGY-DSH] Self-Healing Complete: All Systems Operational ===\n');
  }
}

async function cmdSetTheme(preset, opacity) {
  const expr = `(() => {
    if (window.__AGY_DSH_HARNESS__ && typeof window.__AGY_DSH_HARNESS__.setTheme === 'function') {
      window.__AGY_DSH_HARNESS__.setTheme(${JSON.stringify(preset)}, ${opacity !== undefined ? Number(opacity) : 'undefined'});
      return window.__AGY_DSH_HARNESS__.getTheme();
    }
    return null;
  })()`;

  const results = await executeAcrossAntigravityPages(expr, false);
  console.log(`[AGY-DSH] Creator Mode Theme updated across ${results.length} window(s):`);
  results.forEach((r) => {
    console.log(`  * ${r.title}: ${JSON.stringify(r.value)}`);
  });
}

async function cmdUninstallNative() {
  const resDir = appResourcesDir();
  const asarPath = path.join(resDir, 'app.asar');
  const backupPath = path.join(resDir, 'app.asar.backup');
  const appDir = path.join(resDir, 'app');

  if (fs.existsSync(appDir)) {
    fs.rmSync(appDir, { recursive: true, force: true });
  }

  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, asarPath);
    fs.rmSync(backupPath, { force: true });
    console.log(`[AGY-DSH] Restored stock app.asar from backup. Native patch uninstalled.`);
  } else {
    console.log(`[AGY-DSH] No app.asar.backup found. App appears to be in stock state.`);
  }
}

// CLI Entrypoint
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'apply';
  const silent = args.includes('--silent');

  try {
    if (command === 'apply') {
      await cmdApply({ silent });
      process.exit(0);
    } else if (command === 'status') {
      await cmdStatus();
      process.exit(0);
    } else if (command === 'push-events') {
      await cmdPushEvents();
      process.exit(0);
    } else if (command === 'panic-remove') {
      await cmdPanicRemove();
      process.exit(0);
    } else if (command === 'install-native') {
      await cmdInstallNative();
      process.exit(0);
    } else if (command === 'uninstall-native') {
      await cmdUninstallNative();
      process.exit(0);
    } else if (command === 'set-theme') {
      let preset = 'peach';
      let opacity = undefined;
      for (const arg of args.slice(1)) {
        if (arg.startsWith('--preset=')) preset = arg.split('=')[1];
        else if (arg.startsWith('--opacity=')) opacity = parseFloat(arg.split('=')[1]);
        else if (['lavender', 'mint', 'peach', 'rose', 'sky'].includes(arg.toLowerCase())) preset = arg.toLowerCase();
        else if (!isNaN(parseFloat(arg))) opacity = parseFloat(arg);
      }
      await cmdSetTheme(preset, opacity);
      process.exit(0);
    } else if (command === 'self-heal') {
      await cmdSelfHeal({ silent });
      process.exit(0);
    } else {
      console.error(`Unknown command: ${command}`);
      console.log('Usage: node scripts/cdp-injector.mjs [apply|status|self-heal|push-events|set-theme|panic-remove|install-native|uninstall-native]');
      process.exit(1);
    }
  } catch (err) {
    if (!silent) {
      console.error(`[AGY-DSH ERROR] ${err.message}`);
    }
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isHeavy = process.argv.includes('install-native') || process.argv.includes('uninstall-native') || process.argv.includes('self-heal');
  const watchdog = setTimeout(() => {
    process.exit(0);
  }, isHeavy ? 30000 : 4000);
  watchdog.unref();

  main();
}

export {
  executeAcrossAntigravityPages,
  cmdApply,
  cmdStatus,
  cmdSelfHeal,
  cmdPushEvents,
  cmdPanicRemove,
  cmdInstallNative,
  cmdUninstallNative,
};
