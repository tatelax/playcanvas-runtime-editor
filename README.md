# PlayCanvas Runtime Editor

[![GitHub package.json version](https://img.shields.io/github/package-json/v/tatelax/playcanvas-runtime-editor)](https://github.com/tatelax/playcanvas-runtime-editor/packages)

A clean, modern React-based runtime editor for PlayCanvas games. This tool provides real-time debugging and inspection capabilities for PlayCanvas applications during development.

![Screenshot](img/screenshot.png)

## Features

### 🎮 Game Integration
- **Live Connection**: Seamlessly connects to PlayCanvas games via iframe
- **Real-time Updates**: Hierarchy and property updates via polling
- **Cross-origin Support**: Works with games hosted on different domains

### 🌲 Entity Hierarchy
- **Tree View**: Navigate your scene hierarchy with expandable nodes
- **Search & Filter**: Quickly find entities by name or tags
- **Visual Indicators**: See enabled/disabled states and entity tags
- **Selection Sync**: Click to select entities and view their properties

### 🔍 Property Inspector
- **Entity Details**: View name, enabled state, GUID, and tags
- **Transform Data**: Inspect position, rotation, and scale values
- **Component Properties**: Explore all component data with type-aware rendering
- **Unity-style UI**: Familiar interface for game developers

### 🎛️ Game Controls
- **Play/Pause**: Control game execution
- **Reload**: Refresh the game iframe
- **Fullscreen**: Enter fullscreen mode for testing
- **Aspect Ratios**: Test different screen ratios (16:9, 4:3, 1:1, free)

### 📊 Console
- **Real-time Logs**: View game console messages as they happen
- **Message Filtering**: Filter by log type (error, warn, info, log)
- **Search**: Find specific messages quickly
- **Auto-scroll**: Automatically scroll to latest messages

## Installation

### From npm (Recommended)

```bash
npm install -g @tatelax/playcanvas-runtime-editor
```

### From GitHub Packages

```bash
# Configure npm to use GitHub Packages for @tatelax scope
npm config set @tatelax:registry https://npm.pkg.github.com

# Install the package
npm install -g @tatelax/playcanvas-runtime-editor
```

### Running the Editor

After installation:
```bash
playcanvas-runtime-editor
```

### From Source

1. **Clone Repository**
   ```bash
   git clone https://github.com/yourusername/playcanvas-runtime-editor.git
   cd playcanvas-runtime-editor
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Development Server**
   ```bash
   npm start
   ```

## Quick Start

1. **Install the Runtime Editor** (see Installation above)

2. **Add Debug Integration to Your Game**
   
   Copy `src/playcanvas-debug-integration.js` from this repository to your PlayCanvas game root and include it:
   
   ```html
   <script src="playcanvas-debug-integration.js"></script>
   ```

3. **Start Your PlayCanvas Game**
   ```bash
   npm run dev  # or however you start your game
   ```

4. **Start the Runtime Editor**
   ```bash
   playcanvas-runtime-editor  # if installed globally
   # OR
   npm start  # if running from source
   ```

5. **Connect to Your Game**
   - Open the runtime editor (typically at `http://localhost:3000`)
   - Enter your game URL (typically `http://localhost:5173/`)
   - Click "SAVE" to connect

The runtime editor will automatically establish communication with your game and provide real-time debugging capabilities.

## Usage

Once connected, you can:

- **Navigate the scene hierarchy** in the left panel
- **Select entities** to view their properties in the right panel
- **Control game execution** with play/pause buttons
- **View console logs** in the bottom panel
- **Test different aspect ratios** using the dropdown in the game panel
- **Enter fullscreen mode** for immersive testing

## Game Integration

The runtime editor communicates with your PlayCanvas game through a debug integration script. This script:

- Establishes a communication bridge between the game and editor
- Sends entity hierarchy updates
- Forwards console messages
- Handles game control commands (play/pause)

The integration is lightweight and only active during development.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.