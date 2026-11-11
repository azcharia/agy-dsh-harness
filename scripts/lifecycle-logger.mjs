#!/usr/bin/env node
/**
 * AGY-DSH Harness Lifecycle Event Logger
 * Event-sourced append-only logger for Antigravity 2.0 lifecycle hooks.
 * Logs events to logs/session-events.jsonl with auto-rotation (>2MB)
 * and non-blockingly pushes recent events to the in-app audit drawer via CDP.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const LOGS_DIR = path.resolve(ROOT_DIR, 'logs');
const EVENTS_FILE = path.resolve(LOGS_DIR, 'session-events.jsonl');
const MAX_LOG_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_DISPATCH_EVENTS = 100;

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function rotateLogsIfNeeded() {
  try {
    if (fs.existsSync(EVENTS_FILE)) {
      const stat = fs.statSync(EVENTS_FILE);
      if (stat.size >= MAX_LOG_SIZE_BYTES) {
        const rotatedFile = path.resolve(LOGS_DIR, 'session-events.1.jsonl');
        if (fs.existsSync(rotatedFile)) {
          fs.unlinkSync(rotatedFile);
        }
        fs.renameSync(EVENTS_FILE, rotatedFile);
      }
    }
  } catch {
    // Rotation failure should not stop logging
  }
}

export function readRecentEvents(limit = MAX_DISPATCH_EVENTS) {
  try {
    if (!fs.existsSync(EVENTS_FILE)) return [];
    const content = fs.readFileSync(EVENTS_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const recent = lines.slice(-limit);
    return recent.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

async function readStdin() {
  const chunks = [];
  try {
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function extractEventDetails(eventType, payload) {
  const timestamp = new Date().toISOString();
  let event = eventType || payload.event || payload.type || payload.hookName || 'Unknown';
  let toolName = payload.toolName || payload.tool || payload.name || payload.call?.name || '';
  let sessionId = payload.sessionId || payload.conversationId || payload.session_id || '';
  let summary = '';

  if (toolName) {
    summary = `Tool: ${toolName}`;
    if (payload.parameters || payload.args || payload.input) {
      const p = payload.parameters || payload.args || payload.input;
      const keys = Object.keys(p);
      if (keys.length > 0) {
        const preview = keys.map((k) => `${k}: ${String(p[k]).slice(0, 30)}`).join(', ');
        summary += ` (${preview.slice(0, 80)})`;
      }
    }
  } else if (event === 'SessionStart') {
    summary = 'New agent turn/session initialized';
  } else if (event === 'PreInvocation') {
    summary = 'Starting model inference invocation';
  } else if (event === 'PostInvocation') {
    summary = 'Completed model inference invocation';
  } else if (event === 'Stop') {
    summary = 'Agent turn stopped';
  } else {
    summary = payload.summary || payload.message || `Lifecycle event: ${event}`;
  }

  let cacheWarning = false;
  let payloadStr = '';
  try {
    payloadStr = JSON.stringify(payload);
  } catch {}

  // Prefix-Cache Guard: Detect Large Tool Output (>12 KB) or low cache hit
  const outputStr = typeof payload.output === 'string' ? payload.output : (typeof payload.result === 'string' ? payload.result : payloadStr);
  const outputSizeBytes = Buffer.byteLength(outputStr || '', 'utf8');

  if (outputSizeBytes > 12 * 1024) {
    cacheWarning = true;
    const sizeKb = (outputSizeBytes / 1024).toFixed(1);
    summary = `[CACHE-WARN] Large tool output (${sizeKb} KB) may evict prefix cache · ${summary}`;
  } else if (payload.cacheHitRate !== undefined && typeof payload.cacheHitRate === 'number' && payload.cacheHitRate < 35 && payload.totalTokens > 5000) {
    cacheWarning = true;
    summary = `[CACHE-WARN] Prefix-cache drop detected (${payload.cacheHitRate}% hit rate) · ${summary}`;
  }

  return {
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp,
    event,
    sessionId,
    toolName,
    summary,
    cacheWarning,
    payload,
  };
}

function appendEvent(record) {
  ensureLogsDir();
  rotateLogsIfNeeded();
  fs.appendFileSync(EVENTS_FILE, JSON.stringify(record) + '\n', 'utf8');
}

function dispatchToCdpNonBlocking(event) {
  try {
    const cdpScript = path.resolve(__dirname, 'cdp-injector.mjs');

    // On SessionStart, also trigger a silent background apply
    if (event === 'SessionStart') {
      const applyChild = spawn(process.execPath, [cdpScript, 'apply', '--silent'], {
        cwd: ROOT_DIR,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      applyChild.unref();
    }

    // Non-blocking trigger of push-events
    const pushChild = spawn(process.execPath, [cdpScript, 'push-events'], {
      cwd: ROOT_DIR,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    pushChild.unref();
  } catch {
    // Non-blocking push failure is silent
  }
}

async function main() {
  const cliEventArg = process.argv[2] || '';
  const payload = await readStdin();
  const record = extractEventDetails(cliEventArg, payload);

  try {
    appendEvent(record);
    dispatchToCdpNonBlocking(record.event);
  } catch (err) {
    // Logging errors must never crash the hook runner
  }

  // Antigravity hook runner expects a JSON response on stdout
  process.stdout.write('{}\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const watchdog = setTimeout(() => {
    process.exit(0);
  }, 2500);
  watchdog.unref();

  main().catch(() => process.stdout.write('{}\n'));
}
