# Meco Konfigurator 2026

A modern, high-performance 3D kitchen cabinet configurator built with **Tauri 2**, **Three.js**, and **JSCAD**.

![Version](https://img.shields.io/badge/version-2026.1.1-blue)
![Tauri](https://img.shields.io/badge/tauri-2-orange)
![License](https://img.shields.io/badge/license-MIT-green)

## Overview

Meco Konfigurator is a desktop application for precise kitchen planning, 3D visualization, and manufacturing output. It combines a parametric CAD engine with a glassmorphic UI to deliver an immersive design experience — all in a **~5MB installer** instead of the typical 150MB+ Electron bundle.

## Features

### Design
- **Interactive 3D Viewer** — Real-time PBR rendering with Three.js, drag-to-move modules, rotate with R key
- **Parametric Modeling** — 30+ cabinet types generated via JSCAD with adjustable dimensions
- **Multi-Plan Tabs** — Design multiple kitchen variants in parallel
- **Custom Module Presets** — Save frequently used configurations for reuse
- **Photorealistic Mode** — Toggle PBR environment lighting for client-grade renders

### Manufacturing
- **Cutting Lists** — Automatic panel computation with material aggregation
- **MPR/CNC Export** — HOMAG-compatible MPR files with golden-file tested output
- **Optimik CSV** — Direct export for sheet nesting software
- **Hardware BOM** — Automatic bill of materials (hinges, slides, handles, legs) with EUR pricing

### Business
- **Client-Facing PDF** — 3-page offer with 3D render, material samples, and price breakdown
- **Cost Breakdown** — Decomposed by material type, edge banding, hardware, labor %, and margin %
- **Project Thumbnails** — Embedded preview images in `.meco` project files
- **Per-Module Material Override** — Mix front finishes per cabinet

### UX
- **Glassmorphic UI** — Dark/light theme with backdrop-filter effects
- **First-Run Tour** — Guided walkthrough for new users
- **Keyboard Navigation** — Arrow keys in plan list, Esc to close modals, focus-visible styles
- **Smart Countertops** — Auto-span and resize to match base cabinets
- **Direction Arrow** — Visual indicator of cabinet facing in 3D

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Shell | [Tauri 2](https://v2.tauri.app/) (Rust) — ~5MB binary |
| 3D Engine | [Three.js](https://threejs.org/) — WebGL with PBR + shadows |
| CAD Engine | [@jscad/modeling](https://github.com/jscad/OpenJSCAD.org) — CSG via Web Worker |
| PDF | [jsPDF](https://github.com/parallax/jsPDF) + autoTable |
| Build | [Vite](https://vitejs.dev/) — ES module bundling with worker support |
| Frontend | Vanilla HTML/CSS/JS (ES modules) |
| Tests | [Vitest](https://vitest.dev/) — 132 tests across 8 files |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (for Tauri backend)
- macOS or Windows

### Install

```bash
git clone https://github.com/sanid/konfigurator.git
cd konfigurator
npm install
```

### Development

```bash
# Vite dev server (browser only, no native dialogs)
npm run dev

# Full Tauri dev mode with native window + file dialogs
npm run tauri:dev
```

### Build

```bash
# Frontend only (for testing)
npm run build

# Production app (.app / .dmg on macOS, .exe on Windows)
npm run tauri:build
```

Output locations:
- macOS: `src-tauri/target/release/bundle/dmg/`
- Windows: `src-tauri/target/release/bundle/nsis/`

### Cross-Platform Builds

Push a tag to trigger GitHub Actions CI:

```bash
git tag v2026.x.x
git push origin v2026.x.x
```

This produces a GitHub Release with Windows `.exe` (NSIS), macOS Intel `.dmg`, and macOS Apple Silicon `.dmg`.

### Tests

```bash
npm test           # Run all 132 tests
npm run test:watch # Watch mode
```

## Project Structure

```
├── index.html              # App entry point (Vite serves this)
├── vite.config.js          # Vite build configuration
├── public/                 # Static assets (JSCAD bundle)
├── src/
│   ├── app.js              # Main orchestrator (~1800 lines)
│   ├── viewer.js           # Three.js scene, drag, PBR, highlights
│   ├── plan-manager.js     # Plan CRUD, rebuild, material merge
│   ├── kitchen-builder.js  # JSCAD → Three.js geometry builder
│   ├── cutting-list.js     # Panel computation per module type
│   ├── exports.js          # MPR, PDF, CSV generation
│   ├── hardware.js         # Hardware BOM rules and pricing
│   ├── price-utils.js      # Cost breakdown, kant calc
│   ├── presets.js          # Predefined kitchen layouts
│   ├── project-storage.js  # .meco file I/O, auto-save
│   ├── material-picker.js  # Per-module material override
│   ├── plan-tabs.js        # Multi-plan tab system
│   ├── custom-modules.js   # Saved module presets
│   ├── i18n.js             # Bosnian/English localization
│   ├── tauri-bridge.js     # Tauri invoke() wrapper
│   ├── styles.css          # Full dark/light theme CSS
│   └── jscad.worker.js     # Web Worker for CSG operations
├── src-tauri/
│   ├── Cargo.toml          # Rust dependencies
│   ├── tauri.conf.json     # Window config, permissions
│   └── src/
│       ├── main.rs         # Rust entry point
│       └── lib.rs          # IPC commands (save/open/batch)
├── tests/                  # 132 Vitest tests + 6 MPR fixtures
└── .github/workflows/      # CI for Windows/macOS builds
```

## License

MIT
