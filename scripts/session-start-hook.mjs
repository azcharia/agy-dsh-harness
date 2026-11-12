#!/usr/bin/env node
/**
 * Antigravity 2.0 SessionStart Hook for AGY-DSH Harness
 * Drains hook payload from stdin, triggers silent injection, and returns `{}` on stdout.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(__dirname, 'cdp-injector.mjs');

async function main() {
  try {
    for await (const _chunk of process.stdin) {
      // consume stdin so parent hook runner does not encounter EPIPE
    }
  } catch {
    // ignore stdin errors
  }

  try {
    // Run self-heal in silent mode in background so live window is refreshed
    // and missing native patches (e.g. after official Antigravity update) are repaired
    const child = spawn(process.execPath, [cliPath, 'self-heal', '--silent'], {
      cwd: path.resolve(__dirname, '..'),
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
  } catch {
    // ignore spawn errors so session start is never blocked
  }

  process.stdout.write('{}\n');
}

const watchdog = setTimeout(() => {
  process.exit(0);
}, 2500);
watchdog.unref();

main();
