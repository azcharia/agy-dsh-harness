# 01 - Architecture Specification & Compute Budget (Zero-Bloat)

## 1. Visi Proyek
Membangun **AGY-DSH Harness**, sebuah plugin kustom untuk Google Antigravity 2.0 (Windows) yang mengadopsi fitur terbaik dari *DeepSeek Harness (DSH)*, *TRNCL/primary-theme*, dan *materialwebunofficial/antigravity-themes* tanpa mengorbankan performa aplikasi.

## 2. Prinsip Arsitektur (Strict Rules untuk Agen)
1. **Zero Background Daemon:** DILARANG menggunakan `setInterval` aktif, *file watcher* abadi, atau Windows Background Service (`.vbs`/Startup) yang berjalan terus-menerus di luar sesi.
2. **Fire-and-Forget Injection:** Semua injeksi CSS dan JS dilakukan melalui event `SessionStart` (`hooks.json`) menggunakan WebSocket CDP (`DevToolsActivePort`). Setelah payload terkirim, proses Node.js HARUS langsung `process.exit(0)`.
3. **Passive DOM Observation:** Widget UI (seperti Real-time Context Meter & Token Counter) yang disuntikkan ke dalam Chromium DOM hanya boleh memperbarui diri menggunakan `MutationObserver` yang terikat pada kontainer chat spesifik, bukan `document.body` secara keseluruhan.
4. **GPU-Friendly Styling:** Tema visual wajib menghindari `backdrop-filter: blur()`, *multi-layer box-shadow* berlebih, atau animasi CSS tak berujung yang memicu *layout thrashing* pada Electron.
5. **Single MCP Gateway:** Untuk fitur *Hot-Swappable Tools* (gaya Cordis), hanya boleh ada SATU server MCP lokal yang me-load modul `.mjs` secara dinamis (`await import()`).

## 3. Referensi Lokal (Source of Truth)
Agen dapat merujuk pada dua repositori yang telah di-clone di lokal sebagai referensi implementasi:
- Referensi Plugin & Hook + CDP: `C:\Users\user\.gemini\antigravity\scratch\primary-theme-antigravity`
- Referensi Context Meter & Runtime UI: Lokasi clone `materialwebunofficial/antigravity-themes`