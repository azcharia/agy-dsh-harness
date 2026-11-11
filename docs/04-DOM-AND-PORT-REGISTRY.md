# 04 - DOM Selectors, CSS Variables & Port Registry

*Status Terakhir: Baseline Antigravity 2.0 (Design System: Onyx) - Diperbarui 2026-11-09*

## 1. Lokasi `DevToolsActivePort` (Windows)
- **Primary Path:** `%APPDATA%\Antigravity\DevToolsActivePort`
  - Validasi Lokal: `C:\Users\user\AppData\Roaming\Antigravity\DevToolsActivePort` (Aktif)
- **Fallback Path 1:** `%LOCALAPPDATA%\Antigravity\DevToolsActivePort`
- **Fallback Path 2:** `%APPDATA%\Antigravity IDE\DevToolsActivePort`
- **Fallback Path 3:** `%USERPROFILE%\.gemini\antigravity\DevToolsActivePort`
- **Format File:**
  - Baris 1: `<PORT>` (Contoh: `13982`)
  - Baris 2: `<WEBSOCKET_BROWSER_PATH>` (Contoh: `/devtools/browser/c29c67c2-f8bc-4f3c-84e4-fc159ac3a4c1`)
- **CDP Discovery & Target Filtering Protocol:**
  - Endpoint HTTP: `http://127.0.0.1:<PORT>/json/list`
  - Target Types Valid: `['page', 'webview', 'app', 'iframe']`
  - Target Filter: `(t.type === 'page' || t.type === 'app' || t.type === 'webview') && t.webSocketDebuggerUrl && !t.url.startsWith('devtools://')`
  - Browser-Level WebSocket Fallback: `ws://127.0.0.1:<PORT><WEBSOCKET_BROWSER_PATH>` -> kirim `Target.getTargets` lalu `Target.attachToTarget({ targetId, flatten: true })`.

---

## 2. Selector Inti Sistem Desain Onyx
- **Root Theme Attribute:**
  - Dark Mode: `body.theme-dark[data-agy-theme][data-newux-theme="onyx"]` & `html:has(body.theme-dark)`
  - Light Mode: `body.theme-light[data-agy-theme][data-newux-theme="onyx"]` & `html:has(body.theme-light)`
- **Variabel Surface Utama:**
  - `--background`: Warna latar canvas / conversation panel utama
  - `--content`: Warna canvas content
  - `--shell`: Warna frame chrome terluar
  - `--sidebar`: Warna latar panel sidebar
  - `--sidebar-secondary`: Warna surface sekunder pada sidebar
  - `--sidebar-muted`: Surface muted pada sidebar
  - `--card`: Surface kartu elevated (bubbles, dialog, popover)
  - `--card-border`: Border kartu elevated
  - `--border`: Garis pembatas komponen
  - `--onyx-frame`: Surface frame luar composer
  - `--onyx-well`: Recessed sunken background
  - `--onyx-raised`: Surface komponen terangkat
  - `--onyx-selected`: State terpilih
  - `--onyx-key`: Aksen surface kunci
- **Variabel Tipografi & Aksen:**
  - `--foreground`: Warna teks utama
  - `--secondary-foreground`: Warna teks sekunder
  - `--muted`: Latar elemen non-aktif
  - `--muted-foreground`: Warna teks muted/keterangan
  - `--placeholder`: Warna placeholder teks
  - `--primary`: Warna aksen brand (Bauhaus Yellow di Dark Mode / Bauhaus Red di Light Mode)
  - `--primary-foreground`: Warna teks di atas `--primary`
  - `--cta`: Warna tombol Call-to-Action utama
  - `--cta-foreground`: Warna teks CTA
  - `--focus-ring-color`: Ring outline saat keyboard focus
  - `--nux-focus-ring`: Ring fokus onboarding/guidance
- **Komponen Interaktif Utama:**
  - Button Base: `.agy-button`, `.agy-button-xs`, `.agy-button-sm`, `.agy-button-md`, `.agy-button-lg`
  - Send Button: `.agy-send-button`, `button.proceed-button`
  - Composer Container: `.surface-composer` (frame) dan `.surface-composer-card` (inner card)
  - Composer Actions: `[data-testid="voice-live-pill"]`, `[data-testid="input-cancel-button"]`
  - Markdown Scope: `[data-markdown-root]` (bold, italic, code, headings, links)
  - Chat Bubble & Cards: `.agy-user-bubble`, `.agy-card`, `.artifact-card`, `.agy-takeover-card`, `.agy-tip-card`
  - Conversation View: `[data-testid="conversation-view"]`

---

## 3. Mount Points untuk Injeksi UI (`hud-overlay.js`)

### 3.1 Overview Panel / Visual Context Meter Mount
- **Target Container Selector:** `[data-testid="overview-panel"] > .overflow-y-auto`
- **Metode Mount:** `container.prepend(hostEl)`
- **Injected Host Element:** `<div id="agy-context-card">` menggunakan Shadow DOM (`attachShadow({ mode: 'open' })`)
- **Mekanisme Ekstraksi State (React Fiber Traversal):**
  - Anchor DOM Viewport: `document.querySelector('[data-testid="autoscroll-viewport"]')`
  - Akses Fiber: `el[Object.keys(el).find(k => k.startsWith('__reactFiber$'))]`
  - Traversal: Naik ke atas (`f = f.return`) hingga 40 level mencari `memoizedProps.trajectorySlice`.
  - Pembacaan Token Respon Terakhir:
    - Iterasi mundur pada `slice.stepsInSlice`: ambil `step.metadata.modelUsage`.
    - Rumus Token Terpakai: `used = num(u.inputTokens) + num(u.cacheReadTokens) + num(u.cacheWriteTokens)`.
  - Pembacaan Context Window Model:
    - Model Name: `slice?.generatorMetadatasInSlice?.at(-1)?.plannerConfig?.modelName` atau teks dari `[data-testid="model-selector-trigger"]`.
    - Batas Window:
      - Regex `/^gemini/i` -> 1,048,576 tokens
      - Regex `/^claude/i` -> 200,000 tokens
      - Regex `/gpt-oss/i` -> 131,072 tokens
  - Pembacaan Rincian Komponen Kustomisasi (Token Base):
    - Traversal dari `#root` (`__reactContainer$...`) melalui stack DFS hingga 30,000 node untuk menemukan `memoizedProps.value.getTokenBase`.
    - Panggil `agentService.getTokenBase({ workspaceUris: slice?.metadata?.workspaceUris })`.
    - Kelompokkan token: System prompt (1), Tools (2), Rules (3), MCP tools (4), Skills (5), Subagents (6), Messages (7), Workflows (8), Plugins (9), Flows (10).
  - Akumulasi Total Token Sesi:
    - Akumulasi `inputTokens + cacheWriteTokens` (in), `outputTokens` (out), dan `cacheReadTokens` (cache) per step index unik.
    - Persistensi multi-sesi via cookie `agy-usage` (format: `id:in.out.cache.from.last|...` base36).

### 3.2 Chat Turn Footer (Token Counter Mount)
- **Target Viewport Container:** `[data-testid="autoscroll-viewport"]`
- **Mekanisme Observasi:** Pasif `MutationObserver` terikat khusus pada viewport dengan konfigurasi `{ childList: true, subtree: true }`.
- **Target Toolbar Selector:** `[data-testid="cascade-system-message-toolbar"]`
- **Mount Point Spesifik:** `toolbar.querySelector(':scope > div > div.ml-auto')` (berdampingan dengan timestamp dan tombol thumbs/copy).
- **Injected Element:** `<span class="agy-turn-tokens text-xs text-muted-foreground px-1 whitespace-nowrap tabular-nums">`
- **Mekanisme Ekstraksi Token:**
  - Ambil fiber toolbar: `fiberOf(toolbar)`, traverse ke atas hingga 8 level mencari `memoizedProps` yang memiliki properti `Array.isArray(p?.steps) && 'showThumbsUpDown' in p`.
  - Iterasi setiap step pada `steps`:
    - `input += num(u.inputTokens) + num(u.cacheWriteTokens)`
    - `output += num(u.outputTokens)`
    - `cache += num(u.cacheReadTokens)`
  - Format Tampilan: `${fmt(input)} in · ${fmt(output)} out · ${fmt(cache)} cache` (bagian cache diabaikan jika 0).

### 3.3 Code Block Header Mount (Code Tools: Line Numbers & Wrap)
- **Target Anchor:** `button[aria-label="Copy code"], button[aria-label="Copied"]`
- **Struktur Hierarki DOM:**
  - `group = copy.parentElement`
  - `header = group.parentElement`
  - `block = header.parentElement` (diberikan class `.agy-code`)
- **Mount Point Spesifik:** `group.insertBefore(button, copy)`
- **Injected Elements:**
  - Tombol Wrap Lines: `<button class="agy-code-tool" data-tool="wrap">`
  - Tombol Line Numbers: `<button class="agy-code-tool" data-tool="lines">`
- **Efek Styling CSS:**
  - Wrap Toggle: Mengubah atribut `:root[data-agy-code-nowrap]`, mengontrol `white-space: pre` dan `word-break: normal`.
  - Line Numbers Toggle: Mengubah atribut `:root[data-agy-code-lines]`, mengaktifkan CSS counter `counter-reset: agy-line` pada `.agy-code` dan `counter-increment: agy-line` pada `.code-line::before`.
  - Persistensi Preferensi: Disimpan di cookie `agy-code` (`nowrap.lines`).

### 3.4 Target Mount Tambahan (UI Shell & Status)
- **Titlebar Theme Menu Trigger:**
  - Selector Anchor: `[data-testid="title-menu-bar-item"]` (item menu terakhir di titlebar untuk meletakkan tombol Theme popover).
- **Agent Loading Indicator:**
  - Selector Target: `[data-testid="agent-loading"]` (prepends custom loading indicator).
- **Background Tasks Progress:**
  - Row Target: `[data-testid="background-task-row"]` (cek status berjalan via `[data-testid="status-task-running"]`).
  - Status Text Target: `[data-testid="idle-status-text"]` (cek status berjalan via `.animate-shimmer-text`).
- **TanStack Virtual List Optimization:**
  - Row Selector: `[data-index]` pada sidebar dan diff viewer (di-guard atau dicache via `HTMLElement.prototype.offsetHeight` untuk mencegah forced layout reflow freeze).

---

## 4. Mekanisme & Path Persistence (Auto-Load Tanpa Background Daemon)
- **Global Plugin Directory Junction:**
  - Link: `%USERPROFILE%\.gemini\config\plugins\agy-dsh-harness` -> `D:\WORK\agy dsh harness`
  - Memastikan Antigravity mengenali plugin ini secara otomatis di seluruh workspace.
- **Hook Lifecycle Configuration:**
  - File: `D:\WORK\agy dsh harness\hooks.json`
  - Perintah: `node "D:/WORK/agy dsh harness/scripts/session-start-hook.mjs"`
  - Event triggers: `SessionStart`, `PreInvocation`
- **Native Electron Preload Patch (Boot-Time Auto-Load):**
  - Path Resources Antigravity: `%LOCALAPPDATA%\Programs\antigravity\resources`
  - Unpacked Application: `resources\app`
  - Target Patch File: `resources\app\dist\preload.js`
  - Skrip Loader: Mengeksekusi `electron.webFrame.executeJavaScript` saat inisialisasi window tanpa background daemon.
  - Perintah Manajemen:
    - Instalasi: `node scripts/cdp-injector.mjs install-native`
    - Penghapusan: `node scripts/cdp-injector.mjs uninstall-native`

### 3.4 Dedicated Composer Status Strip (#agy-dsh-pill-bar) & Auto-Compact HUD (ADR-013)
- **Target Container Selector:** `.surface-composer-card` (kontainer kartu composer obrolan).
- **Metode Mount:** `composerCard.insertBefore(pillBarEl, composerFooter)` (diletakkan tepat di atas `.agy-composer-footer`, terpisah total dari baris toolbar model selector dan tombol aksi).
- **Injected Host Element:** `<div id="agy-dsh-pill-bar" data-dsh-injected="true">`
- **Styling Kontainer:** `display: flex; flex-wrap: wrap; align-items: center; gap: 6px; width: 100%; padding: 4px 10px 2px 10px; box-sizing: border-box; z-index: 10;`
- **Struktur 3 Pill Terkunci:**
  1. Mini Context Pill: `<div id="agy-mini-context-pill" class="agy-pill-btn">`
     - Status Dot: `<span class="pill-dot"></span>`
     - Teks Full Mode (Lebar >= 440px): `Ctx: XX% (Xk/Yk) · Cache: XX%`
     - Teks Compact Mode (Lebar < 440px): `XX% (Xk) · XX%`
  2. Events Pill: `<div id="agy-events-pill" class="agy-pill-btn">`
     - Full Mode: `≡ Events (N)`
     - Compact Mode: `≡ N`
  3. Creator Pill: `<div id="agy-creator-pill" class="agy-pill-btn">`
     - Full Mode: `🎨 Creator`
     - Compact Mode: `🎨`
- **Isolated Fixed Popover (#agy-ctx-popover):**
  - Elemen mengambang terisolasi langsung pada `document.body` dengan fallback inline: `position: fixed; z-index: 2147483646; display: none;`.
  - Viewport-boundary clamping:
    `left = Math.max(8, Math.min(rect.left, window.innerWidth - 302))`
    `top = Math.max(8, rect.top - popHeight - 8)`
- **Auto-Compact Engine (ResizeObserver):**
  - Dipasang pada kontainer `.surface-composer-card` dengan ambang `440px`.
  - Mengubah atribut `data-compact="true"` secara otomatis saat split-view / side panel review ditarik ke kiri.

---

## 4. Variabel CSS Onyx & Windows Titlebar Registry

| CSS Property | Default Onyx (Biru) | AGY-DSH Matte (v1.1) | Komponen Terkait |
|---|---|---|---|
| `--background` | `#001B4C` | `#111113 !important` | Panel obrolan utama & latar belakang |
| `--sidebar` | `#0c2654` | `#0e0e10 !important` | Sidebar navigasi kiri & divider sash |
| `--shell` | `#0c2654` | `#0e0e10 !important` | Frame pembungkus luar window |
| `--onyx-frame` | `#0a224c` | `#18181b !important` | Bingkai composer input obrolan |
| `--card` | `#0e2a5c` | `#1c1c1f !important` | Kartu composer input & menu dropdown |
| `--primary` | `#3b82f6` | `#e5a84b !important` | Aksen warna Golden Amber |
| `setTitleBarOverlay` | Default Windows Frame | `{ color: '#0e0e10', symbolColor: '#dcdcde' }` | Tombol minimize/maximize/close native |

---

## 5. Riwayat Perubahan (Changelog Self-Healing)
- `2026-11-10`: (Fase 3.9b) Decoupling Heuristic Compaction Tracker dan Workspace Cleanup. Menghapus pelacakan heuristik compaction counter (`🔄 Nx`) dari `hud-overlay.js` karena memicu false-positive parah dari pencarian teks chat history dan re-render slice, membersihkan key `agy_dsh_compaction_tracker` dari `localStorage`, memfilter keluar event palsu `SessionCompacted`, menghapus folder `scratch/`, dan mempertahankan batas operasional `EFFECTIVE_COMPACT_LIMIT = 250000` (250k) dengan tiga tier warna dot serta format pill yang bersih (ADR-017, FAIL-008).
- `2026-11-10`: (Fase 3.9) Single-Layer Multi-Color Pastel Doodle, Glass-Border Removal, 250k Effective Compaction Ceiling, dan Session Compaction Tracker. Menghilangkan border dan box-shadow kotak kaca pada `.agy-sheet` layar Home, menonaktifkan pseudo-element sheet untuk mencegah double layer / ghosting doodle, memasang doodle 26 ikon pastel Catppuccin Mocha (Lavender, Peach, Mint, Sky, Mauve/Pink, Soft Yellow) hanya pada `.agy-home::before` dengan elliptical mask 240px 95px di sekitar logo 'A' dan greeting. Mengubah basis pembagi persentase konteks ke 250k effective compaction limit (`EFFECTIVE_COMPACT_LIMIT = 250000`) dengan indikator 3 warna (ADR-016).
- `2026-11-10`: (Fase 3.8b) Slide-Over Drawer Inline Style Direct Override dan Home Screen Transparent Doodle Stacking. Mengatasi inline transform specificity collision pada `#agy-events-drawer` dengan mengubah langsung `style.cssText` inline via JavaScript (`transform: translateX(0) !important; display: flex !important; visibility: visible !important; z-index: 2147483646 !important;`), menambahkan dual listener `mousedown` dan `click`, memverifikasi koordinat bounding box riil (`getBoundingClientRect()`) via CDP, serta menghapus oklusi background solid pada elemen pembungkus anak `.agy-sheet:has(.agy-home)` dengan mengangkat pseudo-element doodle ke `z-index: 1 !important; pointer-events: none !important;` dan teks ke `z-index: 2` (ADR-015, FAIL-007).
- `2026-11-10`: (Fase 3.8) Post-Update Self-Healing, Document-Level Click Delegation, dan Responsive Turn Token Counter. Menangani pembaruan resmi aplikasi Antigravity yang menimpa `app.asar`, menambahkan capture-phase click delegation di level document (`document.addEventListener('click', handler, true)`) untuk menjamin pembukaan drawer audit log dan creator mode, serta mengintegrasikan `.agy-turn-tokens` ke ResizeObserver auto-compact mode (ambang batas 480px) dengan format ringkas `data-compact-text` (`674k↓ 91k↑ ⚡97%`) untuk mencegah clipping teks di narrow split-view (ADR-014, FAIL-006).
- `2026-11-09`: (Fase 3.7) Implementasi Dedicated Composer Status Strip (`#agy-dsh-pill-bar`) tepat di atas `.agy-composer-footer`, memisahkan 3 pill dari toolbar tombol bawah. Penambahan ResizeObserver Auto-Compact Mode (ambang 440px) dan viewport-boundary clamping pada `#agy-ctx-popover` untuk mitigasi collision saat split-view / side-panel ditarik ke kiri (ADR-013).
- `2026-11-09`: (Fase 1.2) Resolusi final Cold-Boot Persistence: mengidentifikasi kegagalan sandbox `require('fs')` di renderer preload dan mengalihkan bootstrap loader ke Electron Main Process (`dist/main.js` di dalam `app.asar`) dengan hook `app.on('web-contents-created')` dan `contents.insertCSS()`.
- `2026-11-09`: (Fase 1.1) Eliminasi 100% sisa warna biru navy Onyx (`#001B4C`), perbaikan angka token compact dan rich hover popover pada Mini Context Pill, penambahan SPA Route Re-attachment Engine, serta pengemasan ulang preload langsung ke dalam `app.asar` untuk cold-boot persistence permanen.
- `2026-11-09`: Penambahan mekanisme Persistence 2 Lapis (Global Plugin Junction + Native Electron Preload Loader di `preload.js`).
- `2026-11-09`: Ekstraksi lengkap DOM Selectors, React Fiber Traversal paths, Token State Reader mechanisms, dan Windows DevToolsActivePort paths dari referensi `materialwebunofficial/antigravity-themes` dan `TRNCL/primary-theme-antigravity`.
- `2026-11-09`: Inisialisasi baseline registry untuk Antigravity 2.0 Onyx.
---

## Phase 3.10 Performance & Process Invariants
- **Idle Tick Budget:** `tickCount <= 1` per 3000ms idle window.
- **DOM Write Invariant:** 0 DOM property writes / 0 attribute changes during idle.
- **MutationObserver Filter:** All nodes matching `[data-dsh-injected="true"]` or `id.startsWith('agy-')` ignored.
- **Plugin MCP Servers:** 0 background daemons declared in `plugin.json`.
- **Active Lifecycle Hooks:** `SessionStart` and `Stop` only.
- **Watchdog Timeout:** 2500ms hard unreferenced exit on hook scripts.
