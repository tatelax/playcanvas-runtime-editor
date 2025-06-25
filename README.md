# PlayCanvas Runtime Editor

*Real-time debugging, inspection, and performance monitoring for PlayCanvas games*

![PlayCanvas Runtime Editor](https://img.shields.io/badge/PlayCanvas-Runtime%20Editor-ff6600?style=for-the-badge)

## What is this?

The PlayCanvas Runtime Editor is designed for **game developers** who need:

- **Real-time Scene Inspection**: View and navigate your game's entity hierarchy as it runs
- **Live Entity Debugging**: Inspect transform data, components, and properties in real-time
- **Performance Monitoring**: Track FPS, entity counts, and system performance
- **Console Integration**: All game console output routed to a clean, filterable interface
- **Visual Debugging**: Monitor your game while having full access to debugging tools

Think of it as **Unity's Inspector** meets **Chrome DevTools** for PlayCanvas games.

## Key Features

### 🌳 **Scene Hierarchy**
- **Real-time entity tree** with expand/collapse navigation
- **Search and filter** entities by name
- **Visual indicators** for enabled/disabled entities
- **Tag display** for easy entity identification
- **Click to select** entities for detailed inspection

### 🔍 **Entity Inspector** 
- **Unity-style interface** familiar to game developers
- **Transform controls** showing Position, Rotation, Scale with individual X/Y/Z values
- **Component listing** with expandable property views
- **Entity metadata** including GUID, tags, and layer information
- **Read-only inspection** to prevent accidental modifications during runtime

### 🎮 **Game View**
- **Embedded game window** with multiple aspect ratio presets
- **Aspect ratio simulation** for different devices (mobile, tablet, desktop)
- **Responsive scaling** while maintaining proper game proportions
- **Seamless integration** with the debugging interface

### 📟 **Console**
- **All game console output** automatically routed to the editor
- **Message filtering** by type (log, warn, error, info)
- **Search functionality** to find specific log messages
- **Timestamp tracking** for debugging timing issues
- **Source identification** showing where messages originated

### ⚡ **Performance Monitoring**
- **Real-time FPS counter** 
- **Entity count tracking**
- **Performance diagnostics** panel
- **System resource monitoring**

## Quick Start

### 1. **Clone and Install**
```bash
git clone <repository-url>
cd playcanvas-runtime-editor
npm install
```

### 2. **Set Up Your PlayCanvas Game**
Add the integration script to your PlayCanvas game's HTML file:

```html
<!-- Add this script tag to your game's index.html -->
<script src="playcanvas-debug-integration.js"></script>
```

### 3. **Start the Runtime Editor**
```bash
npm start
```
The editor will open at `http://localhost:3000`

### 4. **Launch Your Game**
Start your PlayCanvas game at `http://localhost:5173` (or your preferred port)

The editor will automatically detect and connect to your game!

## How It Works

The runtime editor uses a **client-server architecture** with iframe-based communication:

```
┌─────────────────────┐    ┌─────────────────────┐
│   Runtime Editor    │    │   PlayCanvas Game   │
│   (React App)       │◄──►│   (iframe)          │
│                     │    │                     │
│ • Scene Hierarchy   │    │ • Game Logic        │
│ • Entity Inspector  │    │ • Rendering         │
│ • Console Output    │    │ • Debug Integration │
└─────────────────────┘    └─────────────────────┘
```

1. **Initialization Sync**: The runtime editor signals when it's ready before PlayCanvas initializes
2. **Message Passing**: Game state and console output are sent via `postMessage`
3. **Real-time Updates**: Entity hierarchy and performance data update automatically
4. **Bidirectional Control**: Editor can pause/resume game and request specific data

## Technical Implementation

### **Console Routing**
- Intercepts all `console.log`, `console.warn`, `console.error` calls
- Buffers messages when editor isn't connected yet
- Maintains dual output (browser console + editor console)
- Preserves original console functionality

### **Entity Data Extraction**
- Traverses PlayCanvas entity hierarchy recursively
- Extracts transform data (position, rotation, scale)
- Catalogs all components and their properties
- Tracks entity states (enabled/disabled, tags)

### **Performance Monitoring**
- Hooks into PlayCanvas application lifecycle
- Tracks frame rates and render statistics
- Monitors entity creation/destruction
- Reports system resource usage

### **Communication Protocol**
- Uses `postMessage` API for secure iframe communication
- Implements message buffering for reliability
- Handles connection state management
- Provides error handling and reconnection logic

## UI Design Philosophy

The runtime editor follows **Unity Editor conventions** to provide a familiar experience:

- **Dark theme** with professional color scheme
- **Resizable panels** with persistent layout preferences
- **Hierarchical navigation** with expand/collapse controls
- **Property inspector** with grouped sections
- **Consistent iconography** and visual language
- **Responsive design** that adapts to different screen sizes

## Development Workflow

1. **Open Runtime Editor** in one browser tab/window
2. **Launch your PlayCanvas game** in the embedded iframe
3. **Inspect entities** by clicking in the hierarchy
4. **Monitor console output** for debugging information
5. **Track performance** using the built-in metrics
6. **Iterate rapidly** with real-time feedback

## Browser Compatibility

- ✅ **Chrome/Chromium** (Recommended)
- ✅ **Firefox**
- ✅ **Safari**
- ✅ **Edge**

## Contributing

We welcome contributions! Please see our contributing guidelines for more information.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Built for PlayCanvas developers, by PlayCanvas developers** 🚀
