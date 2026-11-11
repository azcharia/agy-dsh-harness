#!/usr/bin/env node
/**
 * DSH-Core MCP Server (Cordis Hot-Swap Architecture)
 * Single zero-dependency Model Context Protocol (MCP) server over stdio.
 * Provides built-in meta-tools and dynamic hot-swappable tools from ./tools/*.mjs.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const TOOLS_DIR = path.resolve(ROOT_DIR, 'tools');
const SCRIPTS_DIR = path.resolve(ROOT_DIR, 'scripts');

function ensureToolsDir() {
  if (!fs.existsSync(TOOLS_DIR)) {
    fs.mkdirSync(TOOLS_DIR, { recursive: true });
  }
}

// In-memory registry of dynamic tools: name -> { filePath, metadata, execute }
const dynamicTools = new Map();

async function loadDynamicTool(filePath) {
  try {
    const fileUrl = pathToFileURL(filePath).href;
    const cacheBuster = `?t=${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const mod = await import(fileUrl + cacheBuster);

    if (mod.metadata && typeof mod.metadata.name === 'string') {
      const toolRecord = {
        name: mod.metadata.name,
        filePath,
        fileName: path.basename(filePath),
        description: mod.metadata.description || '',
        inputSchema: mod.metadata.inputSchema || { type: 'object', properties: {} },
        execute: mod.execute || (async () => ({ message: 'No execute function defined' })),
        loadedAt: new Date().toISOString(),
      };
      dynamicTools.set(mod.metadata.name, toolRecord);
      return toolRecord;
    }
  } catch (err) {
    return { error: err.message, filePath };
  }
  return null;
}

async function refreshAllDynamicTools() {
  ensureToolsDir();
  const files = fs.readdirSync(TOOLS_DIR).filter((f) => f.endsWith('.mjs') || f.endsWith('.js'));
  const loaded = [];

  for (const file of files) {
    const fullPath = path.resolve(TOOLS_DIR, file);
    const res = await loadDynamicTool(fullPath);
    if (res && !res.error) loaded.push(res);
  }
  return loaded;
}

const BUILTIN_META_TOOLS = [
  {
    name: 'dsh_list_tools',
    description: 'List all dynamic hot-swappable tools currently available in ./tools/*.mjs.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'dsh_create_or_update_tool',
    description: 'Create or update a dynamic .mjs tool file in ./tools/ and hot-swap it immediately into memory without restarting Antigravity.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The filename or identifier for the tool (e.g. "git-summary" or "git-summary.mjs")',
        },
        code: {
          type: 'string',
          description: 'The complete ESM JavaScript code for the tool, exporting metadata and an execute() function.',
        },
      },
      required: ['name', 'code'],
    },
  },
  {
    name: 'dsh_apply_live_ui',
    description: 'Trigger cdp-injector apply to update the custom theme and HUD overlay across all running Antigravity windows immediately.',
    inputSchema: {
      type: 'object',
      properties: {
        silent: {
          type: 'boolean',
          description: 'Whether to suppress output logs.',
        },
      },
    },
  },
];

async function handleToolsList() {
  await refreshAllDynamicTools();
  const tools = [...BUILTIN_META_TOOLS];

  for (const [, dyn] of dynamicTools) {
    tools.push({
      name: dyn.name,
      description: dyn.description,
      inputSchema: dyn.inputSchema,
    });
  }

  return { tools };
}

async function handleToolsCall(name, args = {}) {
  // 1. Built-in: List dynamic tools
  if (name === 'dsh_list_tools') {
    await refreshAllDynamicTools();
    const list = Array.from(dynamicTools.values()).map((t) => ({
      name: t.name,
      fileName: t.fileName,
      description: t.description,
      loadedAt: t.loadedAt,
    }));
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ dynamicToolsCount: list.length, tools: list }, null, 2),
        },
      ],
    };
  }

  // 2. Built-in: Create or update dynamic tool (Hot-Swap)
  if (name === 'dsh_create_or_update_tool') {
    ensureToolsDir();
    const rawName = String(args.name || '').trim();
    if (!rawName) throw new Error('Tool name is required.');
    const fileName = rawName.endsWith('.mjs') || rawName.endsWith('.js') ? rawName : `${rawName}.mjs`;
    const targetPath = path.resolve(TOOLS_DIR, fileName);
    const code = String(args.code || '');

    fs.writeFileSync(targetPath, code, 'utf8');

    // Hot-swap with cache busting
    const loaded = await loadDynamicTool(targetPath);
    if (!loaded || loaded.error) {
      throw new Error(`Failed to hot-swap tool ${fileName}: ${loaded?.error || 'No metadata exported'}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: 'HOT_SWAP_SUCCESS',
            tool: loaded.name,
            fileName: loaded.fileName,
            description: loaded.description,
            loadedAt: loaded.loadedAt,
          }, null, 2),
        },
      ],
    };
  }

  // 3. Built-in: Apply live UI via CDP
  if (name === 'dsh_apply_live_ui') {
    const cdpScript = path.resolve(SCRIPTS_DIR, 'cdp-injector.mjs');
    try {
      const output = execSync(`node "${cdpScript}" apply`, { encoding: 'utf8', timeout: 8000 });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ status: 'LIVE_UI_APPLIED', output: output.trim() }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to apply live UI: ${err.message}` }],
      };
    }
  }

  // 4. Dynamic tools from ./tools/
  if (dynamicTools.has(name)) {
    const dyn = dynamicTools.get(name);
    try {
      const result = await dyn.execute(args);
      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error executing tool '${name}': ${err.message}` }],
      };
    }
  }

  throw new Error(`Tool not found: ${name}`);
}

function sendResponse(id, result, error = null) {
  const msg = { jsonrpc: '2.0', id };
  if (error) {
    msg.error = {
      code: error.code || -32603,
      message: error.message || String(error),
    };
  } else {
    msg.result = result;
  }
  process.stdout.write(JSON.stringify(msg) + '\n');
}

async function processMessage(line) {
  const trimmed = line.trim();
  if (!trimmed) return;

  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }

  const { id, method, params } = msg;

  // Notifications (no id)
  if (id === undefined || id === null) {
    if (method === 'notifications/initialized') {
      // client initialized, ready
    }
    return;
  }

  try {
    if (method === 'initialize') {
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'dsh-core',
          version: '1.0.0',
        },
      });
    } else if (method === 'ping') {
      sendResponse(id, {});
    } else if (method === 'tools/list') {
      const res = await handleToolsList();
      sendResponse(id, res);
    } else if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      const res = await handleToolsCall(toolName, toolArgs);
      sendResponse(id, res);
    } else {
      sendResponse(id, null, { code: -32601, message: `Method not found: ${method}` });
    }
  } catch (err) {
    sendResponse(id, null, { code: -32603, message: err.message });
  }
}

let messageQueue = Promise.resolve();

function main() {
  // Pre-load dynamic tools
  refreshAllDynamicTools().catch(() => {});

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', (line) => {
    messageQueue = messageQueue.then(() => processMessage(line)).catch(() => {});
  });
}

main();
