# 03 - Risk Mitigation & Agent Self-Healing Protocol

Dokumen ini adalah SOP wajib bagi Agen Antigravity ketika pengguna melaporkan bahwa tema tidak muncul, Context Meter hilang, atau injeksi gagal setelah update aplikasi Antigravity.

---

## SKENARIO A: Kegagalan Koneksi `DevToolsActivePort` (Port Recovery Protocol)

### Gejala:
Script `cdp-injector.mjs` gagal terhubung ke WebSocket, file `DevToolsActivePort` tidak ditemukan, atau koneksi ditolak (`ECONNREFUSED`).

### Langkah Self-Healing untuk Agen:
1. **Pindai Lokasi Path Windows:**
   Periksa keberadaan file `DevToolsActivePort` secara berurutan di lokasi berikut:
   - `%APPDATA%\Antigravity\DevToolsActivePort`
   - `%LOCALAPPDATA%\Antigravity\DevToolsActivePort`
   - `%APPDATA%\Antigravity IDE\DevToolsActivePort`
   - `%USERPROFILE%\.gemini\antigravity\DevToolsActivePort`
2. **Validasi Proses & Port Aktif:**
   Jika file ditemukan tetapi port mati (stale file), jalankan perintah PowerShell ringan untuk mencari port debugging Chromium yang sedang *listening* milik proses `Antigravity.exe`:
   `Get-NetTCPConnection -State Listen | Where-Object { (Get-Process -Id $_.OwningProcess).ProcessName -match "Antigravity" }`
3. **Verifikasi Endpoint CDP:**
   Lakukan HTTP GET ke `http://127.0.0.1:<PORT>/json/version` dan `http://127.0.0.1:<PORT>/json/list`.
4. **Auto-Patch:**
   Perbarui daftar `ACTIVE_PORT_FILES` di `scripts/cdp-injector.mjs` dan catat perubahan tersebut di `04-DOM-AND-PORT-REGISTRY.md`.

---

## SKENARIO B: Perubahan Struktur DOM / Sistem Desain Onyx (DOM Investigation Protocol)

### Gejala:
Koneksi CDP berhasil, tetapi warna tema tidak berubah, atau *Visual Context Meter* / *Token Counter* tidak tampil di layar setelah Antigravity update.

### Langkah Self-Healing untuk Agen:
1. **Jangan Menebak Selector!**
2. **Jalankan Skrip Diagnostik DOM via CDP:**
   Kirim perintah evaluasi satu kali (`Runtime.evaluate`) melalui WebSocket CDP untuk mengambil *snapshot* struktur teratas DOM saat ini:
   - Ambil seluruh atribut pada `document.documentElement` dan `document.body` (cek apakah `data-agy-theme` atau `data-newux-theme="onyx"` berubah nama).
   - Ambil daftar seluruh *CSS Custom Properties* (`--*`) yang terdefinisi pada `:root` dan `body` menggunakan `getComputedStyle(document.body)`.
   - Ambil pohon hierarki class/atribut (`tagName`, `className`, `id`, `data-*`) hingga kedalaman 4 level untuk menemukan kontainer Sidebar, Chat Area, dan Overview Panel yang baru.
3. **Bandingkan dengan Registry:**
   Bandingkan hasil *snapshot* baru dengan catatan terakhir di `04-DOM-AND-PORT-REGISTRY.md`.
4. **Auto-Heal & Re-inject:**
   Perbarui variabel CSS di `custom-theme.css` dan target selector mount di `hud-overlay.js`, perbarui `04-DOM-AND-PORT-REGISTRY.md`, lalu jalankan `node scripts/cdp-injector.mjs apply`.

---

## SKENARIO C: Crash / Freeze UI Akibat Injeksi (Emergency Circuit Breaker)

### Gejala:
UI Antigravity menjadi lambat atau membeku setelah injeksi JS.

### Langkah Mitigasi:
1. Semua elemen DOM yang disuntikkan WAJIB memiliki atribut `data-dsh-injected="true"`.
2. Semua `MutationObserver` WAJIB disimpan di dalam namespace global `window.__AGY_DSH_HARNESS__`.
3. Perintah darurat `node scripts/cdp-injector.mjs panic-remove` harus langsung mengeksekusi:
   - `window.__AGY_DSH_HARNESS__?.disconnectAll()`
   - Menghapus semua elemen `[data-dsh-injected="true"]` dari DOM tanpa perlu me-restart Antigravity.

---

## SKENARIO D: Hilangnya Injeksi Saat Restart Aplikasi (Persistence Recovery Protocol)

### Gejala:
Tema Matte dan HUD berfungsi normal saat sesi aktif, tetapi kembali ke default saat aplikasi Antigravity di-restart.

### Akar Masalah:
1. Plugin lokal belum di-junction ke direktori konfigurasi global Antigravity (`%USERPROFILE%\.gemini\config\plugins\agy-dsh-harness`), sehingga `hooks.json` tidak dimuat saat startup.
2. Perintah hook menggunakan relative path yang gagal ketika dipanggil dari direktori kerja lain.
3. Hook `SessionStart` hanya terpicu saat sesi chat dibuat, bukan saat pertama kali window aplikasi terbuka.

### Solusi Permanen 2 Lapis (Zero-Bloat & Zero-Daemon):
1. **Lapisan 1 (Plugin Junction & Comprehensive Lifecycle Hooks):**
   - Buat Directory Junction Windows:
     `cmd /c mklink /J "%USERPROFILE%\.gemini\config\plugins\agy-dsh-harness" "D:\WORK\agy dsh harness"`
   - Konfigurasikan `hooks.json` menggunakan absolute path dan daftarkan seluruh lifecycle event (`SessionStart`, `PreInvocation`, `PostInvocation`, `PreToolUse`, `PostToolUse`, `Stop`):
     `node "D:/WORK/agy dsh harness/scripts/session-start-hook.mjs"`
2. **Lapisan 2 (Native Electron Main Process Hook di `dist/main.js`):**
   - Investigasi forensik membuktikan bahwa preload script renderer berjalan di bawah pembatasan sandbox (`contextIsolation: true`, `nodeIntegration: false`), sehingga pemanggilan `require('fs')` di dalam `preload.js` selalu gagal melempar error `Cannot find module 'fs'`.
   - Solusi definitif adalah memindahkan bootstrap loader ke level Main Process di `dist/main.js` di dalam `app.asar`. Main Process adalah runtime Node.js murni dengan hak akses penuh ke modul `fs`, `path`, dan API resmi Electron.
   - Menggunakan hook `electron.app.on('web-contents-created')` dan event `dom-ready`, Main Process secara otomatis menyuntikkan stylesheet via `contents.insertCSS()` dan HUD overlay via `contents.executeJavaScript()` seketika pada setiap window yang terbuka, dengan nol proses background (zero daemon).
   - Jalankan `node scripts/cdp-injector.mjs install-native` untuk mengemas ulang patch ini ke `app.asar`.
   - Untuk membatalkan instalasi native dan memulihkan stock `app.asar`, jalankan `node scripts/cdp-injector.mjs uninstall-native`.

---

## SKENARIO E: Unmounting Komponen SPA Saat Navigasi Home / Ganti Chat (SPA Route Re-attachment)

### Gejala:
Token counter `in · out · cache` atau Mini Context Pill hilang setelah pengguna beralih ke layar Home atau berganti sesi chat.

### Akar Masalah:
Antigravity adalah React SPA. Saat navigasi berlangsung, kontainer `[data-testid="autoscroll-viewport"]` dan composer dihancurkan lalu dibuat ulang oleh React runtime, mematikan MutationObserver yang terikat pada elemen lama.

### Solusi Self-Healing (SPA Route Engine):
1. HUD Overlay memantau referensi `activeViewport` pada level runtime.
2. Pasang MutationObserver ringan pada `#root` yang mendeteksi perubahan rute dalam waktu <16ms.
3. Saat kontainer viewport baru terpasang di DOM:
   - Lepaskan observer lama secara bersih.
   - Pasang observer baru pada viewport yang baru dibuat.
   - Lakukan pemindaian seketika terhadap seluruh toolbar pesan sistem (`[data-testid="cascade-system-message-toolbar"]`) dan blok kode.
   - Pasang kembali Mini Context Pill pada kontainer composer jika terlepas.

---

## SKENARIO F: Split-View / Side-Panel Collision & Horizontal Overflow (Responsive Composer Dock & Auto-Compact HUD)

### Gejala:
Ketika pengguna membuka Right Side Panel (review, diff, atau files) dan menariknya ke arah kiri (lebar kolom chat menyempit menjadi ~320px : 420px):
- Baris toolbar bawah Composer (`.agy-composer-footer`) kehabisan ruang horizontal.
- `#agy-dsh-pill-bar` menabrak tombol Model Selector, Turbo, Mic, atau terpotong keluar batas kanan (`overflow: hidden`).

### Akar Masalah:
Sebelumnya `#agy-dsh-pill-bar` disisipkan ke dalam flex baris yang sama dengan tombol trigger `[data-testid="model-selector-trigger"]`. Pada viewport sempit, total lebar seluruh tombol toolbar bawah melebihi kapasitas kolom obrolan.

### Solusi Permanen (ADR-013):
1. **Dedicated Composer Status Strip:**
   - `#agy-dsh-pill-bar` dipindahkan menjadi baris horizontal mandiri (`width: 100%`) di dalam `.surface-composer-card`, tepat di atas `.agy-composer-footer`.
   - Menggunakan flex-wrap aman: `display: flex; flex-wrap: wrap; align-items: center; gap: 6px; width: 100%; padding: 4px 10px 2px 10px; box-sizing: border-box;`.
   - Dengan pemisahan ini, pill tidak akan pernah menabrak toolbar bawah tombol tindakan.
2. **ResizeObserver Auto-Compact Mode:**
   - Dipasang ResizeObserver pasif pada kontainer composer dengan ambang batas `440px`.
   - Lebar `>= 440px`: Full Mode (`● Ctx: 7.1% (74.8k/1M) · Cache: 97%`, `≡ Events (N)`, `🎨 Creator`).
   - Lebar `< 440px`: Compact Mode (`● 7.1% (74.8k) · 97%`, `≡ N`, `🎨`).
   - Referensi disimpan di `harness.composerResizeObserver` dan dibersihkan bersih via `disconnectAll()`.
3. **Viewport-Boundary Clamping Popover:**
   - Koordinat `#agy-ctx-popover` dihitung dengan boundary clamping:
     `left = Math.max(8, Math.min(rect.left, window.innerWidth - 302))`
     `top = Math.max(8, rect.top - popHeight - 8)`
   - Popover dijamin 100% utuh di dalam viewport meskipun kolom chat ditarik ekstrem.

---

## SKENARIO G: Official App Update Recovery, Document-Level Click Delegation & Responsive Turn Token Counter (Fase 3.8)

### Gejala:
1. Aplikasi Antigravity diperbarui oleh installer resmi (Official Update), menimpa `resources/app.asar` sehingga tema kembali ke biru navy Onyx bawaan dan layar Home menampilkan teks salam baru ("Hello, Azcha.").
2. Tombol `≡ Events` dan `🎨 Creator` tidak membuka drawer saat diklik karena event click ditelan oleh synthetic event listener React pada `.surface-composer-card`.
3. Teks token turn counter (`.agy-turn-tokens`) terpotong sisi kirinya saat panel kanan digeser mentok ke kiri karena properti `white-space: nowrap`.

### Solusi Self-Healing (ADR-014):
1. **Auto-Recovery Pasca-Update:**
   - Jalankan `node scripts/cdp-injector.mjs apply` untuk menyuntikkan ulang CSS dan HUD script secara live via CDP.
   - Jalankan `node scripts/cdp-injector.mjs install-native` untuk membuat cadangan baru `app.asar.backup` dan mengemas ulang Main Process hook serta Zero-Flash bootstrap langsung ke dalam `app.asar` biner baru.
2. **Document-Level Capture-Phase Click Delegation:**
   - Pasang capture-phase listener di level `document` (`document.addEventListener('click', handler, true)`).
   - Simpan referensi di `window.__AGY_DSH_HARNESS__.docClickHandler` dan bersihkan pada `disconnectAll()`.
   - Ketika `e.target.closest('#agy-events-pill')` atau `e.target.closest('#agy-creator-pill')` terdeteksi, pastikan `#agy-events-drawer` dan `#agy-events-backdrop` terpasang di `document.body` (auto-mount saat itu juga), lalu buka tab yang bersangkutan.
   - Pastikan tombol pill memiliki `pointer-events: auto !important; cursor: pointer !important; position: relative; z-index: 50;`.
3. **Responsive Auto-Compact Turn Token Counter:**
   - Pada `.agy-turn-tokens`, simpan teks format penuh di `data-full-text` dan format ringkas di `data-compact-text` (contoh: `674k↓ 91k↑ ⚡97%`).
   - Hubungkan pembaruan token counter ke fungsi `applyHUDDensity(isCompact)` dengan ambang batas responsive `480px`.
   - Saat mode compact aktif (`< 480px`), terapkan `white-space: normal !important; overflow-wrap: anywhere !important; max-width: 100% !important; font-size: 10px !important;` sehingga teks tidak pernah terpotong keluar dari batas layar.

---

## SKENARIO H: Drawer Not Sliding In Due to Inline Specificity & Doodle Occlusion (Fase 3.8b)

### Gejala:
1. Event click pada `#agy-events-pill` dan `#agy-creator-pill` berhasil tereksekusi dan menambahkan class `.open`, tetapi secara fisik `#agy-events-drawer` tetap berada di luar layar (`x >= window.innerWidth`) karena inline style `transform: translateX(100%)` yang diberikan saat elemen dibuat mengalahkan selektor class CSS.
2. 26-Icon Cosmic Doodle pada layar Home ("Good to see you, Azcha.") hanya tampak mengintip ~15px di celah paling atas karena tertutup oleh background solid (`#111113`) dari elemen pembungkus anak (`<div>`) di dalam `.agy-sheet:has(.agy-home)`.

### Solusi Self-Healing (ADR-015):
1. **JavaScript Direct Inline Style Override pada Drawer:**
   - Di `dist/hud-overlay.js`, ubah `setDrawerVisibility(open)` agar secara langsung menulis `style.cssText` inline pada `#agy-events-drawer` dan `#agy-events-backdrop`:
     - Buka: `drawer.style.cssText = 'position:fixed !important; top:0 !important; right:0 !important; bottom:0 !important; width:420px !important; max-width:92vw !important; background:#141417 !important; border-left:1px solid #2e2e36 !important; z-index:2147483646 !important; display:flex !important; flex-direction:column !important; transform:translateX(0) !important; visibility:visible !important; opacity:1 !important; pointer-events:auto !important; box-shadow:-12px 0 32px rgba(0,0,0,0.75) !important;'`
     - Tutup: `drawer.style.cssText = 'display:none !important; transform:translateX(105%) !important; visibility:hidden !important;'`
2. **Dual-Phase Event Listeners:**
   - Pasang listener `mousedown` dan `click` sekaligus baik pada level elemen maupun pada document-level capture listener.
3. **Verifikasi Bounding Box Fisik via CDP:**
   - Evaluasi koordinat riil: `rect.width >= 350`, `rect.right <= window.innerWidth + 1.5`, `rect.left < window.innerWidth`, `display === 'flex'`, `visibility === 'visible'`.
4. **Transparent Wrapper Stacking Context:**
   - Di `dist/custom-theme.css`, tetapkan seluruh elemen anak di dalam `.agy-sheet:has(.agy-home)` dan `.agy-home` dengan `background-color: transparent !important; background-image: none !important;`.
   - Naikkan pseudo-element doodle `.agy-sheet:has(.agy-home)::before` ke `z-index: 1 !important; pointer-events: none !important;`.
   - Letakkan kontainer teks dan composer pada `z-index: 2 !important; position: relative !important;`.
   - Dengan konfigurasi ini, motif doodle cosmic 100% tampil di sekeliling teks tanpa pernah tertutup background elemen pembungkus anak.

---

## SKENARIO I: Glass-Border Distraction, Double Doodle Ghosting, & 250k Compaction Awareness (Fase 3.9)

### Gejala:
1. Kanvas layar Home memiliki garis pembatas kotak kaca (`border`, `border-radius`, `box-shadow`) yang membatasi area sheet dan kotak composer.
2. Doodle SVG ter-render ganda (ghosting) akibat pemasangan pseudo-element pada `.agy-sheet` dan `.agy-home` secara bersamaan dengan offset berbeda.
3. Meteran konteks berbasis 1M raw window tidak mencerminkan batas nyata auto-compaction Antigravity (~250k token), sehingga pengguna tidak mendapat peringatan dini saat sesi mendekati pemadatan konteks.

### Solusi Self-Healing (ADR-016):
1. **Glass-Border Removal & Single-Layer Doodle Lock:**
   - Di `dist/custom-theme.css`, setel `border: none !important; border-radius: 0 !important; box-shadow: none !important;` pada `.agy-sheet:has(.agy-home)` dan semua pembungkus Home.
   - Nonaktifkan pseudo-element pada `.agy-sheet` (`content: none !important; display: none !important;`).
   - Kunci doodle hanya pada `.agy-home::before` dengan mask terfokus `radial-gradient(ellipse 240px 95px at 50% 42%, transparent 0%, transparent 60%, black 100%)`.
2. **Multi-Color Soft Pastel Vectors:**
   - 26 ikon diberi warna stroke/fill dari 6 palet Catppuccin Mocha Pastel (Lavender, Peach, Mint, Sky, Mauve/Pink, Soft Yellow).
3. **250k Compaction Ceiling & Color Thresholds:**
   - Mini Context Pill dan Overview Context Card menggunakan `EFFECTIVE_COMPACT_LIMIT = 250000` sebagai pembagi persentase utama.
   - Ambang warna: `< 70%` Normal (Soft Mint `#a6e3a1`), `70%-85%` Warning (Soft Peach `#fab387`), `>= 85%` Critical (Soft Rose `#f38ba8` + `⚠️`).
4. **Decoupling Heuristic Compaction Tracker (Fase 3.9b, ADR-017):**
   - Menghapus seluruh pelacakan heuristik berbasis DOM teks `"Compacting"` dan penurunan delta token karena menyebabkan false positive yang parah saat riwayat obrolan memuat kata "compacting" atau saat slice me-render ulang.
   - Tampilan Mini Context Pill dikembalikan ke format bersih dan presisi: `● Ctx: XX% (Xk/250k) · Cache: YY%`.
   - Popover menampilkan ringkasan bersih: Compaction Budget (`Xk/250k`), Model Raw Limit (`Xk/1M`), dan token turn/cache.
