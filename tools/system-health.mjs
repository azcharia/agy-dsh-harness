/**
 * Dynamic Tool: System Health Inspector
 * Cordis Hot-Swappable MCP Dynamic Tool
 * Inspects Antigravity.exe memory usage and CDP debugging port connection status.
 */

import { execSync } from 'node:child_process';
import http from 'node:http';
import { readDevToolsActivePort } from '../scripts/cdp-injector.mjs';

export const metadata = {
  name: 'system_health',
  description: 'Inspects Antigravity.exe process count, total RAM working set (MB), and CDP debugging port connection status.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

function getCdpVersion(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, { timeout: 1500 }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve({ ok: true, info: JSON.parse(data) });
        } catch {
          resolve({ ok: true, raw: data });
        }
      });
    });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Connection timed out' });
    });
  });
}

export async function execute(_params = {}) {
  const timestamp = new Date().toISOString();
  let processCount = 0;
  let totalMemoryMb = 0;

  try {
    const raw = execSync('tasklist /FI "IMAGENAME eq Antigravity.exe" /FO CSV /NH', { encoding: 'utf8', timeout: 3000 });
    const lines = raw.trim().split(/\r?\n/).filter(Boolean);
    let totalKb = 0;

    for (const line of lines) {
      if (!line.includes('Antigravity.exe')) continue;
      processCount++;
      const match = line.match(/"([^"]+)\s*K"/);
      if (match) {
        const kb = parseInt(match[1].replace(/,/g, ''), 10);
        if (!isNaN(kb)) totalKb += kb;
      }
    }

    totalMemoryMb = Math.round((totalKb / 1024) * 10) / 10;
  } catch (err) {
    // Graceful fallback
  }

  const activePortInfo = readDevToolsActivePort();
  let cdpStatus = { connected: false, port: null, browser: null };

  if (activePortInfo?.port) {
    const cdpCheck = await getCdpVersion(activePortInfo.port);
    cdpStatus = {
      connected: cdpCheck.ok,
      port: activePortInfo.port,
      path: activePortInfo.path,
      browser: cdpCheck.ok ? (cdpCheck.info?.Browser || 'Chromium') : null,
      error: cdpCheck.ok ? null : cdpCheck.error,
    };
  }

  return {
    timestamp,
    antigravity: {
      processCount,
      totalWorkingSetMb: totalMemoryMb,
      status: processCount > 0 ? 'RUNNING' : 'NOT_FOUND',
    },
    cdp: cdpStatus,
    healthy: processCount > 0 && cdpStatus.connected,
  };
}
