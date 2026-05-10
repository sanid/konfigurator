# Meco Konfigurator — Native Rewrite Analysis

## Current Stack at a Glance

| Metric | Value |
|--------|-------|
| **Total JS** | ~7,865 lines across 25 modules |
| **HTML** | 525 lines (single `index.html`) |
| **CSS** | ~1,200 lines (`styles.css`) |
| **3D Engine** | Three.js (PBR materials, shadows, orbit controls) |
| **CAD Engine** | JSCAD modeling (CSG operations, web worker) |
| **Exports** | MPR/HOMAG CNC files, PDF (jsPDF), cutting lists |
| **Shell** | Electron 30 (frameless window, IPC for file dialogs) |
| **Target OS** | Windows (primary), macOS |

Your Electron usage is actually **very thin** — only 3 IPC channels:
1. `save-file` — native save dialog + write
2. `open-file` — native open dialog + read
3. `save-files-to-folder` — folder picker + batch write

The real app is a self-contained web app that happens to run in Electron for file system access and window chrome.

---

## Option 1: **Tauri** (Rust shell, keep your JS/Three.js frontend) ⭐ RECOMMENDED

### What is Tauri?
A Rust-based alternative to Electron. Your frontend stays as HTML/CSS/JS — but instead of shipping a 150MB Chromium, Tauri uses the OS webview (WebKit on macOS, WebView2 on Windows). The backend is Rust.

### What changes?
| Component | Before (Electron) | After (Tauri) |
|-----------|-------------------|---------------|
| Shell | Electron (~150MB) | Tauri (~3-5MB) |
| Webview | Bundled Chromium | OS native (WebView2/WebKit) |
| `main.js` | Node.js process | Rust `src-tauri/main.rs` |
| `preload.js` | Electron bridge | Tauri `invoke()` API |
| File dialogs | `dialog.showSaveDialog` | `tauri::api::dialog` |
| Window controls | `BrowserWindow` API | Tauri window config |
| **All your JS code** | **Unchanged** | **Unchanged** |
| Three.js / JSCAD | Unchanged | Unchanged |
| Web Workers | Unchanged | Unchanged |

### Migration effort

```
┌─────────────────────────────────────────────────────┐
│  EFFORT: ~2-3 days                                  │
│                                                     │
│  ✅ Keep ALL 7,865 lines of JS                      │
│  ✅ Keep ALL CSS                                    │
│  ✅ Keep Three.js + JSCAD                           │
│  ✅ Keep Web Workers                                │
│                                                     │
│  📝 Rewrite: main.js → ~80 lines of Rust           │
│  📝 Rewrite: preload.js → ~15 lines of JS          │
│  📝 Add: tauri.conf.json (window config)            │
│  📝 Add: Cargo.toml (Rust deps)                     │
│  📝 Optional: Vite build step for frontend          │
└─────────────────────────────────────────────────────┘
```

### Performance gains

| Metric | Electron | Tauri | Improvement |
|--------|----------|-------|-------------|
| Binary size | ~150-200MB | ~3-8MB | **20-50x smaller** |
| RAM at idle | ~180-250MB | ~40-80MB | **3-5x less** |
| Startup time | 2-4s | 0.3-0.8s | **3-5x faster** |
| 3D rendering | Same (WebGL) | Same (WebGL) | — |
| JSCAD operations | Same (JS) | Same (JS) | — |
| File I/O | Node.js | Rust (native) | Marginally faster |

> [!IMPORTANT]
> Three.js and JSCAD will run at **identical speed** — they're still JS in a webview. The gains are in shell overhead, memory, binary size, and startup.

### Risks
- **WebView2 on older Windows**: Requires Windows 10 1803+ (99%+ of installs). Windows 7/8 users would need a fallback.
- **Minor rendering differences**: WebKit (macOS) vs Chromium can have subtle CSS/WebGL differences. Your glassmorphic `backdrop-filter` effects should work fine, but worth testing.
- **Worker paths**: The `importScripts('../node_modules/...')` pattern in your JSCAD worker needs a Vite/bundler step to work correctly with Tauri's asset pipeline.

---

## Option 2: **Full Rust Native** (egui + wgpu / iced)

### What this means
Rewrite **everything** in Rust. No webview. Native GPU rendering via `wgpu`. UI via `egui` (immediate-mode GUI) or `iced` (Elm-like retained-mode GUI).

### What you'd need to rewrite

| Component | Lines | Rust equivalent | Difficulty |
|-----------|-------|-----------------|-----------|
| Three.js viewer (PBR, shadows, orbit) | 627 | Custom `wgpu` renderer | 🔴 **Very Hard** |
| Kitchen builder (35+ parametric modules) | 2,057 | Port to Rust structs | 🟡 Hard |
| JSCAD CSG operations | 536 + worker | Use `truck` or `opencascade-rs` | 🔴 **Very Hard** |
| Cutting list engine | 414 | Straightforward port | 🟢 Easy |
| MPR/CNC export | 355 | Straightforward port | 🟢 Easy |
| PDF generation | Part of exports | Use `printpdf` crate | 🟡 Medium |
| Plan manager + state | ~500 | `serde` + application state | 🟢 Easy |
| Preset layouts | 288 | Port to Rust | 🟢 Easy |
| Material system (PBR textures) | 206 | `wgpu` material pipeline | 🔴 Hard |
| UI (glassmorphic panels, modals, etc.) | 525 HTML + 1200 CSS | `egui` custom widgets | 🔴 **Very Hard** |
| i18n | 139 | `fluent-rs` | 🟢 Easy |
| **Total** | **~8,400** | **~15,000-25,000 lines Rust** | — |

### Effort estimate

```
┌─────────────────────────────────────────────────────┐
│  EFFORT: 3-6 MONTHS (full-time, experienced Rust)   │
│                                                     │
│  Month 1: wgpu renderer + basic box rendering       │
│  Month 2: Full parametric kitchen builder in Rust    │
│  Month 3: CSG operations + material system          │
│  Month 4: UI (panels, modals, inputs, dialogs)      │
│  Month 5: Export pipeline (MPR, PDF, cutting list)   │
│  Month 6: Polish, testing, packaging                │
└─────────────────────────────────────────────────────┘
```

### Performance gains

| Metric | Electron | Full Rust | Improvement |
|--------|----------|-----------|-------------|
| Binary size | ~150-200MB | ~10-15MB | **10-15x smaller** |
| RAM at idle | ~180-250MB | ~20-40MB | **5-10x less** |
| Startup time | 2-4s | 0.05-0.2s | **10-20x faster** |
| 3D rendering | WebGL (JS) | wgpu (native GPU) | **2-5x faster** |
| CSG operations | JS worker | Rust multithreaded | **5-20x faster** |
| Cutting list calc | JS | Rust | **10-50x faster** |
| File I/O | Node.js | Rust native | **2-3x faster** |

> [!WARNING]
> The performance gains are **real but mostly unnecessary** for your use case. Your cutting list computes in <50ms already. Your 3D scene has 15-30 modules — not 10,000. The bottleneck has never been compute speed; it's UI/UX features.

### Risks
- 🔴 **Massive effort** — 6 months of work to reach current feature parity
- 🔴 **No Three.js equivalent in Rust** — you'd build your own PBR renderer
- 🔴 **egui UI is functional but ugly** — achieving your glassmorphic aesthetic in egui is extremely painful
- 🔴 **CSG in Rust is immature** — `truck` and `opencascade-rs` exist but are nowhere near JSCAD's kitchen-cabinet-level convenience
- 🟡 **Feature velocity drops to near zero** during rewrite — no new features for months

---

## Option 3: **Hybrid** — Tauri now, Rust backend later

The pragmatic middle ground:

### Phase 1: Tauri migration (2-3 days)
- Replace Electron with Tauri
- Keep all JS/Three.js/JSCAD frontend
- Get the 20-50x binary size reduction and 3-5x memory reduction immediately

### Phase 2: Rust backend commands (2-4 weeks, incremental)
Move compute-heavy operations to Rust over time:

```
┌──────────────────────────────────────────────┐
│  JS Frontend (unchanged)                     │
│  ├── Three.js viewer                         │
│  ├── UI (HTML/CSS/JS)                        │
│  └── calls Tauri invoke() for heavy ops      │
│                                              │
│  Rust Backend (new, grows over time)         │
│  ├── cutting_list::compute()                 │
│  ├── mpr::generate()                         │
│  ├── pdf::render()                           │
│  └── csg::build_module() (future)            │
└──────────────────────────────────────────────┘
```

Each Rust command is a `#[tauri::command]` function callable from JS. You migrate one piece at a time without breaking anything.

### Phase 3: Optional native renderer (future)
If you ever outgrow WebGL (1000+ modules, VR preview, etc.), swap the Three.js viewport for a native `wgpu` view embedded in the Tauri window.

---

## Recommendation

```
                    Effort vs. Benefit Matrix
                    
  Benefit    │
  (perf +    │                          ● Full Rust
  quality)   │                         (huge effort,
             │                          diminishing returns)
             │
             │        ● Tauri + Rust backend
             │       (sweet spot)
             │
             │  ● Tauri only
             │ (quick win)
             │
             │
             └──────────────────────────── Effort →
               2 days    2 weeks    6 months
```

> [!TIP]
> **Go with Tauri (Option 1) first.** It's 2-3 days of work for massive wins in binary size, memory, and startup time. Your 3D performance won't change (it's already good), but your users get a 5MB installer instead of a 200MB one, and the app launches instantly.
>
> Later, if specific operations feel slow (cutting list for 100+ modules, PDF generation), move those to Rust `#[tauri::command]` functions incrementally.

### Why NOT full Rust right now?
1. **Your bottleneck is features, not performance** — the status.md shows dozens of UX features waiting to be built
2. **Three.js is unmatched** — no Rust 3D library gives you PBR + shadows + orbit controls + CSS2D labels in <627 lines
3. **JSCAD is irreplaceable** — Rust CSG libraries are years behind for parametric furniture modeling
4. **Your UI is beautiful** — glassmorphic CSS with dark/light mode would take months to recreate in egui
5. **6 months of zero feature velocity** is a business risk

---

## Concrete Action Plan (if you want to start)

### Day 1: Scaffold Tauri

```bash
# Install Tauri CLI
cargo install tauri-cli

# Init Tauri in existing project
cd /Users/sanid/Documents/konfigurator
npm create tauri-app -- --template vanilla

# Or add to existing project
cargo tauri init
```

### Day 1-2: Port the 3 IPC handlers to Rust

```rust
// src-tauri/src/main.rs
#[tauri::command]
fn save_file(filename: String, content: Vec<u8>) -> Result<String, String> {
    // Native file dialog + write — replaces Electron's dialog.showSaveDialog
}

#[tauri::command]  
fn open_file(ext: String) -> Result<FileResult, String> {
    // Native file dialog + read — replaces Electron's dialog.showOpenDialog
}

#[tauri::command]
fn save_files_to_folder(files: Vec<FileData>) -> Result<FolderResult, String> {
    // Native folder picker + batch write
}
```

### Day 2-3: Update frontend bridge

```javascript
// Replace preload.js bridge with Tauri invoke()
// Before (Electron):
window.electronAPI.saveFile(args)

// After (Tauri):
import { invoke } from '@tauri-apps/api/core';
await invoke('save_file', args);
```

### Day 3: Build & test

```bash
cargo tauri build
# → produces a ~5MB .exe / .dmg
```

---

Want me to start the Tauri migration? I can set it up right now.
