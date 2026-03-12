# Meco Konfigurator 2026

A modern, high-performance 3D kitchen configurator built with Electron, Three.js, and JSCAD.

![Version](https://img.shields.io/badge/version-2026.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🚀 Overview

Meco Konfigurator is a streamlined desktop application designed for precise kitchen planning and 3D visualization. It combines a powerful CAD engine with a sleek, glassmorphic user interface to provide an immersive design experience.

## ✨ Key Features

- **Interactive 3D Viewer**: Real-time rendering of kitchen modules using Three.js.
- **Parametric Modeling**: Dynamic module generation via JSCAD based on user inputs (width, height, depth, drawer count, etc.).
- **Smart Overlays**: 
    - **Wall Grid Overlay**: A collapsible, pinnable interface for precise module placement.
    - **Floating Toolbar**: Context-aware controls for navigation and viewing.
    - **Real-time Pricing**: Dynamic cost estimation as you build.
- **Automated Components**: 
    - **Smart Countertops**: Automatically span and adjust to the total width of base cabinets.
    - **Kickboards (Cokla)**: Synchronized with the kitchen layout for a perfect fit.
- **Modern Aesthetics**: Premium glassmorphic UI with full **Light and Dark mode** support.
- **Enterprise Ready**: Seamlessly integrated window management and desktop performance via Electron.

## 🛠 Tech Stack

- **Core**: [Electron](https://www.electronjs.org/)
- **3D Engine**: [Three.js](https://threejs.org/)
- **Modeling**: [@jscad/modeling](https://github.com/jscad/OpenJSCAD.org)
- **UI**: Vanilla HTML5, CSS3 (Modern Flex/Grid), and Modern JavaScript ES6+

## 📥 Installation

Ensure you have [Node.js](https://nodejs.org/) installed on your system.

```bash
# Clone the repository
git clone https://github.com/sanid/konfigurator.git

# Navigate to the project directory
cd konfigurator

# Install dependencies
npm install
```

## 💻 Usage

To start the configurator in development mode:

```bash
npm run dev
```

## 📸 Screenshots

*(Add screenshots here)*

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---
Developed with ❤️ for the future of kitchen design.
