# 02 - Feature Map & Implementation Roadmap

## Peta 6 Komponen Utama
| ID | Komponen | Inspirasi | Mekanisme Teknis | Target Overhead |
| :--- | :--- | :--- | :--- | :--- |
| **F1** | **Real-Time Context Meter & Token Counter** | `antigravity-themes` | Injeksi DOM JS (`hud-overlay.js`) via CDP. Menampilkan % Context Window, rincian komponen, dan token `in/out/cache` per respon. | ~0 MB RAM |
| **F2** | **Event-Sourced Session Log** | DeepSeek Harness | Hook script (`lifecycle-logger.mjs`) yang menulis log *append-only* ke `.agy-events.jsonl` setiap akhir turn + tombol viewer di UI. | 0 MB saat idle |
| **F3** | **Zero-Bloat Custom Theme Engine** | `primary-theme` + `Matte` | Override CSS Variables sistem desain Onyx (`[data-agy-theme][data-newux-theme="onyx"]`). | Lebih ringan dari default |
| **F4** | **Creator Mode (Live Self-Mod)** | DeepSeek Harness | Skill & Tool bagi agen untuk memodifikasi `custom-theme.css` / `hud-overlay.js` lalu memanggil `cdp-injector.mjs apply` (<50ms). | On-demand |
| **F5** | **Cordis Hot-Swap Tool Loader** | DeepSeek Harness | 1 MCP Server (`dsh-core-server.mjs`) dengan fitur *dynamic import* dan *cache-busting* untuk memuat tool baru tanpa restart IDE. | 1 Node Process |
| **F6** | **Prefix-Cache Guard & Proactive Trigger** | DeepSeek Harness | Validasi ukuran tool output sebelum masuk konteks & pemicu agen berbasis event (bukan polling). | On-demand |

## Fase Eksekusi (Sequential)
- **Fase 1 (Fondasi & Visibilitas):** Setup `plugin.json`, `hooks.json`, Windows CDP Injector + Integrasi **F1 (Context Meter)** & **F3 (Base Matte/Custom Theme)**.
- **Fase 2 (Auditabilitas):** Implementasi **F2 (Event-Sourced Logger `.jsonl`)** dan UI Log Inspector di dalam Antigravity.
- **Fase 3 (Otonomi & Creator Mode):** Implementasi **F4 (Creator Mode)**, **F5 (Hot-Swap MCP)**, dan **F6 (Prefix-Cache Guard)**.