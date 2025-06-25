import React, { useState, useEffect, useRef } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { Play, Pause, Settings, Search, ChevronRight, ChevronDown, ChevronLeft, ChevronUp, RotateCcw, Minus, Plus, TreePine, Monitor, Search as SearchIcon, Terminal, X, ExternalLink, Maximize, Github } from 'lucide-react';
import { debugBridge, PCEntityData, PCComponentData, PerformanceData } from './PlayCanvasDebugBridge';
import { DiagnosticPanel } from './DiagnosticPanel';
import { logger, LogLevel } from './Logger';
import { PropertyRenderer } from './PropertyInspectors';
import packageJson from '../package.json';
import './App.css';

interface ConsoleMessage {
  id: number;
  type: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: Date;
  source?: string;
}

// Aspect ratio storage key
const ASPECT_RATIO_KEY = 'playcanvas-debug-aspect-ratio';

// Custom Dropdown Component
interface DropdownOption {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function CustomDropdown({ value, options, onChange, placeholder = 'Select...', disabled = false, className = '' }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const selectedOption = options.find(option => option.value === value);
  const displayText = selectedOption?.label || placeholder;

  return (
    <div className={`custom-dropdown ${className}`}>
      <button
        className="custom-dropdown-button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        disabled={disabled}
      >
        {displayText}
        <ChevronDown size={12} style={{ marginLeft: 'auto' }} />
      </button>
      {isOpen && !disabled && (
        <div className="dropdown-options">
          {options.map(option => (
            <button
              key={option.value}
              className={`dropdown-option ${value === option.value ? 'selected' : ''}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<PCEntityData | null>(null);
  const [entityHierarchy, setEntityHierarchy] = useState<PCEntityData[]>([]);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([
    {
      id: Date.now(),
      type: 'info',
      message: 'PlayCanvas Runtime Editor starting...',
      timestamp: new Date()
    }
  ]);
  const [hierarchyFilter, setHierarchyFilter] = useState('');
  const [consoleFilter, setConsoleFilter] = useState('');
  const [logTypeFilters, setLogTypeFilters] = useState({
    log: true,
    info: true,
    warn: true,
    error: true
  });
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const [hierarchyCollapsed, setHierarchyCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('free');
  const [isGameFullscreen, setIsGameFullscreen] = useState(false);

  const [gameName, setGameName] = useState('PlayCanvas Game');
  const gameFrameRef = useRef<HTMLIFrameElement>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Load saved aspect ratio and logger level from localStorage
  useEffect(() => {
    try {
      // Load aspect ratio
      const savedAspectRatio = localStorage.getItem(ASPECT_RATIO_KEY);
      if (savedAspectRatio) {
        setAspectRatio(savedAspectRatio);
        logger.debug('Loaded aspect ratio:', savedAspectRatio);
      }

      // Load logger level
      const savedLogLevel = localStorage.getItem('playcanvas-debug-logger-level') as LogLevel;
      if (savedLogLevel && ['none', 'error', 'warn', 'info', 'debug'].includes(savedLogLevel)) {
        logger.setLevel(savedLogLevel);
        logger.debug('Loaded logger level:', savedLogLevel);
      }
    } catch (error) {
      logger.warn('Failed to load saved settings:', error);
    }
  }, []);

  // Save aspect ratio to localStorage
  const saveAspectRatio = (ratio: string) => {
    try {
      localStorage.setItem(ASPECT_RATIO_KEY, ratio);
      setAspectRatio(ratio);
      logger.debug('Saved aspect ratio:', ratio);
    } catch (error) {
      logger.warn('Failed to save aspect ratio:', error);
    }
  };

  // Reset all settings to defaults
  const resetAllSettings = () => {
    // Reset aspect ratio
    setAspectRatio('free');
    
    // Reset collapsed states
    setHierarchyCollapsed(false);
    setInspectorCollapsed(false);
    setConsoleCollapsed(false);
    
    // Clear localStorage
    try {
      localStorage.removeItem(ASPECT_RATIO_KEY);
    } catch (error) {
      logger.warn('Failed to clear localStorage:', error);
    }
    
    logger.info('All settings reset to defaults');
  };



  // Initialize connection to PlayCanvas game
  useEffect(() => {
    // Set up debug bridge when iframe is available
    if (gameFrameRef.current) {
      debugBridge.setGameFrame(gameFrameRef.current);
    }

    // Set up debug bridge event handlers
    debugBridge.onConnected((connected) => {
      setIsConnected(connected);
      if (connected) {
        addConsoleMessage('info', 'PlayCanvas Runtime Editor connected');
        debugBridge.requestHierarchy();
        
        // Send current log level to game
        const currentLogLevel = logger.getLevel();
        debugBridge.setGameLogLevel(currentLogLevel);
        
        // Try to get game name from iframe if not provided by debug integration
        setTimeout(() => {
          if (gameName === 'PlayCanvas Game' && gameFrameRef.current) {
            try {
              const iframeDocument = gameFrameRef.current.contentDocument;
              if (iframeDocument && iframeDocument.title) {
                const detectedName = iframeDocument.title;
                setGameName(detectedName);
                document.title = `[Runtime Editor] ${detectedName}`;
                logger.info(`Detected game name from iframe: ${detectedName}`);
              }
            } catch (error) {
              // Cross-origin restrictions prevent access - this is expected for different origins
              logger.debug('Could not access iframe document for game name (likely cross-origin)');
            }
          }
        }, 2000); // Wait 2 seconds to allow game to load
      }
    });

    debugBridge.onHierarchyUpdate((hierarchy: any) => {
      logger.debug('Received hierarchy data:', hierarchy);
      
      let newHierarchy: PCEntityData[] = [];
      
      if (Array.isArray(hierarchy)) {
        // Already an array of entities
        newHierarchy = hierarchy;
      } else if (hierarchy && typeof hierarchy === 'object' && hierarchy.name) {
        // Single root entity object - wrap it in an array
        logger.debug('Converting single entity to array');
        newHierarchy = [hierarchy];
      } else {
        logger.warn('Received invalid hierarchy data:', hierarchy);
        newHierarchy = [];
      }
      
      // Simple comparison to avoid unnecessary re-renders
      const currentString = JSON.stringify(entityHierarchy);
      const newString = JSON.stringify(newHierarchy);
      
      if (currentString !== newString) {
        setEntityHierarchy(newHierarchy);
        logger.debug('Hierarchy updated with new data');
      }
    });

    debugBridge.onConsoleMessage((message) => {
      addConsoleMessage(message.type, message.message, message.source);
    });

    debugBridge.onGameInfo((info) => {
      setGameName(info.name);
      // Update document title dynamically
      document.title = `[Runtime Editor] ${info.name}`;
      logger.info(`Connected to game: ${info.name}`);
    });

    return () => {
      // Cleanup if needed
    };
  }, []); // Remove isConnected dependency to prevent infinite loop

  const addConsoleMessage = (type: ConsoleMessage['type'], message: string, source?: string) => {
    const newMessage: ConsoleMessage = {
      id: Date.now(),
      type,
      message,
      timestamp: new Date(),
      source
    };
    setConsoleMessages(prev => [...prev, newMessage]);
  };

  // Auto-scroll console to bottom
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleMessages]);

  // Set up iframe reference when component mounts
  useEffect(() => {
    if (gameFrameRef.current) {
      debugBridge.setGameFrame(gameFrameRef.current);
      
      // Signal to the game that runtime editor is ready after a short delay
      setTimeout(() => {
        debugBridge.signalDebugOverlayReady();
      }, 1000);
    }
  }, []);

  const handlePlayPause = () => {
    if (!isConnected) {
      addConsoleMessage('warn', 'Cannot control game - not connected to PlayCanvas');
      return;
    }

    setIsPaused(!isPaused);
    if (isPaused) {
      debugBridge.resumeGame();
      addConsoleMessage('info', 'Game resumed');
    } else {
      debugBridge.pauseGame();
      addConsoleMessage('info', 'Game paused');
    }
  };

  const handleReload = () => {
    if (gameFrameRef.current) {
      gameFrameRef.current.src = gameFrameRef.current.src; // Force reload
      addConsoleMessage('info', 'Game reloaded');
      logger.info('Game iframe reloaded');
    } else {
      addConsoleMessage('warn', 'Cannot reload - game iframe not found');
    }
  };

  const handleFullscreen = async () => {
    if (!gameFrameRef.current) {
      addConsoleMessage('warn', 'Cannot enter fullscreen - game iframe not found');
      return;
    }

    try {
      if (!isGameFullscreen) {
        // Enter fullscreen
        if (gameFrameRef.current.requestFullscreen) {
          await gameFrameRef.current.requestFullscreen();
        } else if ((gameFrameRef.current as any).webkitRequestFullscreen) {
          await (gameFrameRef.current as any).webkitRequestFullscreen();
        } else if ((gameFrameRef.current as any).mozRequestFullScreen) {
          await (gameFrameRef.current as any).mozRequestFullScreen();
        } else if ((gameFrameRef.current as any).msRequestFullscreen) {
          await (gameFrameRef.current as any).msRequestFullscreen();
        }
        setIsGameFullscreen(true);
        addConsoleMessage('info', 'Game entered fullscreen mode');
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
        setIsGameFullscreen(false);
        addConsoleMessage('info', 'Game exited fullscreen mode');
      }
    } catch (error) {
      addConsoleMessage('error', `Fullscreen error: ${error}`);
      logger.error('Fullscreen error:', error);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!(document.fullscreenElement || 
                             (document as any).webkitFullscreenElement || 
                             (document as any).mozFullScreenElement || 
                             (document as any).msFullscreenElement);
      setIsGameFullscreen(isFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Aspect ratio options
  const aspectRatios = [
    { value: 'free', label: 'Free Aspect', ratio: null },
    
    // Standard ratios
    { value: '16:9', label: '16:9 (Landscape)', ratio: 16/9 },
    { value: '9:16', label: '9:16 (Portrait)', ratio: 9/16 },
    { value: '4:3', label: '4:3 (Landscape)', ratio: 4/3 },
    { value: '3:4', label: '3:4 (Portrait)', ratio: 3/4 },
    { value: '21:9', label: '21:9 (Ultrawide)', ratio: 21/9 },
    { value: '9:21', label: '9:21 (Portrait Ultrawide)', ratio: 9/21 },
    
    // iPhone
    { value: 'iphone13-l', label: 'iPhone 13 (19.5:9 Landscape)', ratio: 19.5/9 },
    { value: 'iphone13-p', label: 'iPhone 13 (9:19.5 Portrait)', ratio: 9/19.5 },
    { value: 'iphone13mini-l', label: 'iPhone 13 Mini (19.5:9 Landscape)', ratio: 19.5/9 },
    { value: 'iphone13mini-p', label: 'iPhone 13 Mini (9:19.5 Portrait)', ratio: 9/19.5 },
    { value: 'iphone14pro-l', label: 'iPhone 14 Pro (19.5:9 Landscape)', ratio: 19.5/9 },
    { value: 'iphone14pro-p', label: 'iPhone 14 Pro (9:19.5 Portrait)', ratio: 9/19.5 },
    { value: 'iphonese-l', label: 'iPhone SE (16:9 Landscape)', ratio: 16/9 },
    { value: 'iphonese-p', label: 'iPhone SE (9:16 Portrait)', ratio: 9/16 },
    
    // Android
    { value: 'pixel6-l', label: 'Pixel 6 (20:9 Landscape)', ratio: 20/9 },
    { value: 'pixel6-p', label: 'Pixel 6 (9:20 Portrait)', ratio: 9/20 },
    { value: 'pixel7-l', label: 'Pixel 7 (20:9 Landscape)', ratio: 20/9 },
    { value: 'pixel7-p', label: 'Pixel 7 (9:20 Portrait)', ratio: 9/20 },
    { value: 'galaxys22-l', label: 'Galaxy S22 (19.3:9 Landscape)', ratio: 19.3/9 },
    { value: 'galaxys22-p', label: 'Galaxy S22 (9:19.3 Portrait)', ratio: 9/19.3 },
    { value: 'galaxys23-l', label: 'Galaxy S23 (19.3:9 Landscape)', ratio: 19.3/9 },
    { value: 'galaxys23-p', label: 'Galaxy S23 (9:19.3 Portrait)', ratio: 9/19.3 },
    
    // Tablets
    { value: 'ipad-l', label: 'iPad (4:3 Landscape)', ratio: 4/3 },
    { value: 'ipad-p', label: 'iPad (3:4 Portrait)', ratio: 3/4 },
    { value: 'ipadpro11-l', label: 'iPad Pro 11" (4.3:3 Landscape)', ratio: 4.3/3 },
    { value: 'ipadpro11-p', label: 'iPad Pro 11" (3:4.3 Portrait)', ratio: 3/4.3 },
    { value: 'ipadpro129-l', label: 'iPad Pro 12.9" (4:3 Landscape)', ratio: 4/3 },
    { value: 'ipadpro129-p', label: 'iPad Pro 12.9" (3:4 Portrait)', ratio: 3/4 },
    
    // Gaming handhelds
    { value: 'steamdeck', label: 'Steam Deck (16:10 Landscape)', ratio: 16/10 },
    { value: 'switchlite', label: 'Nintendo Switch Lite (16:9 Landscape)', ratio: 16/9 }
  ];

  // Calculate aspect ratio styles
  const getAspectRatioStyle = () => {
    const selectedRatio = aspectRatios.find(r => r.value === aspectRatio);
    if (!selectedRatio || !selectedRatio.ratio) {
      return { width: '100%', height: '100%' };
    }

    const ratio = selectedRatio.ratio;
    return {
      width: ratio > 1 ? '100%' : `${ratio * 100}%`,
      height: ratio <= 1 ? '100%' : `${(1 / ratio) * 100}%`,
      maxWidth: '100%',
      maxHeight: '100%',
      margin: 'auto',
      backgroundColor: '#000'
    };
  };



  const filterHierarchy = (entities: PCEntityData[], filter: string): PCEntityData[] => {
    // Defensive check to ensure entities is an array
    if (!Array.isArray(entities)) {
      logger.warn('filterHierarchy received non-array entities:', entities);
      return [];
    }
    
    if (!filter) return entities;
    
    return entities.filter(entity => {
      const matchesName = entity.name.toLowerCase().includes(filter.toLowerCase());
      const hasMatchingChildren = entity.children && entity.children.length > 0 && filterHierarchy(entity.children, filter).length > 0;
      return matchesName || hasMatchingChildren;
    }).map(entity => ({
      ...entity,
      children: filterHierarchy(entity.children || [], filter)
    }));
  };

  const filteredHierarchy = filterHierarchy(entityHierarchy, hierarchyFilter);
  
  // Debug logging
  useEffect(() => {
    logger.debug('Entity hierarchy updated:', entityHierarchy);
    logger.debug('Filtered hierarchy:', filteredHierarchy);
  }, [entityHierarchy, filteredHierarchy]);

  // Debug diagnostics state
  useEffect(() => {
    logger.debug('Diagnostics panel state changed:', showDiagnostics);
  }, [showDiagnostics]);

  const filteredConsoleMessages = consoleMessages.filter(msg => {
    // Apply text filter
    if (consoleFilter && !msg.message.toLowerCase().includes(consoleFilter.toLowerCase())) {
      return false;
    }
    
    // Apply individual type filters
    if (!logTypeFilters[msg.type]) {
      return false;
    }
    
    return true;
  });

  return (
    <div className="runtime-editor">
      {/* Top Controls Bar */}
      <div className="controls-bar">
        <div className="controls-left">
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <div className="status-dot"></div>
            <div className="status-text">
              <span className="connection-text">
                {isConnected ? 'Connected to PlayCanvas' : 'Connecting...'}
              </span>
              <span className="version-text">v{packageJson.version}</span>
            </div>
          </div>
        </div>
        
        <div className="controls-center">
          <button
            className={`control-btn ${isPaused ? 'paused' : 'playing'}`}
            onClick={handlePlayPause}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button
            className="control-btn"
            onClick={handleReload}
            title="Reload Game"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="controls-right">
          <button 
            className="control-btn" 
            title="GitHub Repository"
            onClick={() => window.open('https://github.com', '_blank')}
          >
            <Github size={16} />
          </button>
          <button 
            className="control-btn" 
            title="Diagnostics"
            onClick={() => {
              logger.debug('Diagnostics button clicked, current state:', showDiagnostics);
              setShowDiagnostics(!showDiagnostics);
            }}
            style={{ 
              backgroundColor: showDiagnostics ? '#2196f3' : undefined,
              borderColor: showDiagnostics ? '#1976d2' : undefined
            }}
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Main Layout with Vertical Panels */}
      <div className="main-content" style={{ height: 'calc(100vh - 48px)' }}>
        <PanelGroup direction="vertical" key={`vertical-${consoleCollapsed}`}>
          {/* Top Panel - Main Content Area */}
          <Panel defaultSize={75} minSize={50}>
            <PanelGroup direction="horizontal" key={`horizontal-${hierarchyCollapsed}-${inspectorCollapsed}`}>
              {/* Left Panel - Hierarchy */}
                              <Panel defaultSize={hierarchyCollapsed ? 3 : 17.5} minSize={hierarchyCollapsed ? 3 : 10} maxSize={hierarchyCollapsed ? 3 : undefined}>
                <div className={`panel hierarchy-panel ${hierarchyCollapsed ? 'collapsed-horizontal' : ''}`}>
                  <div className="panel-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <TreePine size={16} style={{ color: '#ff6600' }} />
                      {!hierarchyCollapsed && <h3>Scene Hierarchy</h3>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {!hierarchyCollapsed && (
                        <div className="search-box">
                          <Search size={14} />
                          <input
                            type="text"
                            placeholder="Filter entities..."
                            value={hierarchyFilter}
                            onChange={(e) => setHierarchyFilter(e.target.value)}
                          />
                          {hierarchyFilter && (
                            <button
                              className="search-clear-btn"
                              onClick={() => setHierarchyFilter('')}
                              title="Clear filter"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      )}
                      <button
                        className="control-btn"
                        onClick={() => setHierarchyCollapsed(!hierarchyCollapsed)}
                        title={hierarchyCollapsed ? 'Expand Hierarchy' : 'Collapse Hierarchy'}
                        style={{ width: 24, height: 24 }}
                      >
                        {hierarchyCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
                      </button>
                    </div>
                  </div>
                  {!hierarchyCollapsed && (
                    <div className="panel-content">
                      <HierarchyTree
                        entities={filteredHierarchy}
                        selectedEntity={selectedEntity}
                        onSelectEntity={(entity) => {
                          setSelectedEntity(entity);
                          if (isConnected) {
                            debugBridge.selectEntity(entity.guid);
                          }
                        }}
                        nodeIndex={{ current: 0 }}
                      />
                    </div>
                  )}
                </div>
              </Panel>

              <PanelResizeHandle className="resize-handle" />

              {/* Center Panel - Game View */}
              <Panel defaultSize={65} minSize={30}>
                <div className="panel game-panel">
                  <div className="panel-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Monitor size={16} style={{ color: '#ff6600' }} />
                      <h3>Game</h3>
                    </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Monitor size={16} style={{ color: '#b0b0b0' }} />
                      <CustomDropdown
                        value={aspectRatio}
                        options={aspectRatios}
                        onChange={saveAspectRatio}
                        placeholder="Free Aspect"
                      />
                      <button
                        className="control-btn"
                        onClick={() => window.open('http://localhost:5174', '_blank')}
                        title="Open Game in New Tab"
                        style={{ width: 24, height: 24 }}
                      >
                        <ExternalLink size={12} />
                      </button>
                      <button
                        className="control-btn"
                        onClick={handleFullscreen}
                        title={isGameFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                        style={{ width: 24, height: 24 }}
                      >
                        <Maximize size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="panel-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a' }}>
                    <div style={getAspectRatioStyle()}>
                      <iframe
                        ref={gameFrameRef}
                        src="http://localhost:5173"
                        title="PlayCanvas Game"
                        className="game-frame"
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>
                  </div>
                </div>
              </Panel>

              <PanelResizeHandle className="resize-handle" />

              {/* Right Panel - Inspector */}
                              <Panel defaultSize={inspectorCollapsed ? 3 : 17.5} minSize={inspectorCollapsed ? 3 : 10} maxSize={inspectorCollapsed ? 3 : undefined}>
                <div className={`panel inspector-panel ${inspectorCollapsed ? 'collapsed-horizontal' : ''}`}>
                  <div className="panel-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        className="control-btn"
                        onClick={() => setInspectorCollapsed(!inspectorCollapsed)}
                        title={inspectorCollapsed ? 'Expand Inspector' : 'Collapse Inspector'}
                        style={{ width: 24, height: 24 }}
                      >
                        {inspectorCollapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
                      </button>
                      <SearchIcon size={16} style={{ color: '#ff6600' }} />
                      {!inspectorCollapsed && <h3>Inspector</h3>}
                    </div>
                  </div>
                  {!inspectorCollapsed && (
                    <div className="panel-content">
                      <EntityInspector entity={selectedEntity} />
                    </div>
                  )}
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="resize-handle" />

          {/* Bottom Panel - Console */}
          <Panel defaultSize={consoleCollapsed ? 3 : 22.5} minSize={consoleCollapsed ? 3 : 10} maxSize={consoleCollapsed ? 3 : 50}>
            <div className={`panel console-panel ${consoleCollapsed ? 'collapsed-vertical' : ''}`}>
              <div className="panel-header">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Terminal size={16} style={{ color: '#ff6600' }} />
                    {!consoleCollapsed && <h3>Console</h3>}
                  </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {!consoleCollapsed && (
                    <div className="console-controls">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={logTypeFilters.log}
                          onChange={(e) => setLogTypeFilters(prev => ({ ...prev, log: e.target.checked }))}
                        />
                        Log
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={logTypeFilters.info}
                          onChange={(e) => setLogTypeFilters(prev => ({ ...prev, info: e.target.checked }))}
                        />
                        Info
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={logTypeFilters.warn}
                          onChange={(e) => setLogTypeFilters(prev => ({ ...prev, warn: e.target.checked }))}
                        />
                        Warn
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={logTypeFilters.error}
                          onChange={(e) => setLogTypeFilters(prev => ({ ...prev, error: e.target.checked }))}
                        />
                        Error
                      </label>
                      <div className="search-box">
                        <Search size={14} />
                        <input
                          type="text"
                          placeholder="Filter messages..."
                          value={consoleFilter}
                          onChange={(e) => setConsoleFilter(e.target.value)}
                        />
                        {consoleFilter && (
                          <button
                            className="search-clear-btn"
                            onClick={() => setConsoleFilter('')}
                            title="Clear filter"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <button
                        className="clear-btn"
                        onClick={() => setConsoleMessages([])}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                  <button
                    className="control-btn"
                    onClick={() => setConsoleCollapsed(!consoleCollapsed)}
                    title={consoleCollapsed ? 'Expand Console' : 'Collapse Console'}
                    style={{ width: 24, height: 24 }}
                  >
                    {consoleCollapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
              </div>
              {!consoleCollapsed && (
                <div className="panel-content console-content">
                  {filteredConsoleMessages.map(msg => (
                    <div key={msg.id} className={`console-message ${msg.type}`}>
                      <span className="timestamp">
                        {msg.timestamp.toLocaleTimeString()}
                      </span>
                      <span className="message">{msg.message}</span>
                      {msg.source && <span className="source">({msg.source})</span>}
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </div>
              )}
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* Diagnostic Panel */}
      {showDiagnostics && (
        <DiagnosticPanel 
          onClose={() => setShowDiagnostics(false)} 
          gameFrameRef={gameFrameRef}
          onSettingsReset={resetAllSettings}
        />
      )}
      

    </div>
  );
}

// Hierarchy Tree Component
interface HierarchyTreeProps {
  entities: PCEntityData[];
  selectedEntity: PCEntityData | null;
  onSelectEntity: (entity: PCEntityData) => void;
  level?: number;
  nodeIndex?: { current: number };
}

function HierarchyTree({ entities, selectedEntity, onSelectEntity, level = 0, nodeIndex }: HierarchyTreeProps) {
  // Defensive check to ensure entities is an array
  if (!Array.isArray(entities)) {
    logger.warn('HierarchyTree received non-array entities:', entities);
    return (
      <div style={{ paddingLeft: level * 16, color: '#f44336', fontSize: 12 }}>
        Error: Invalid entity data
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: level * 16 }}>
      {entities.map(entity => (
        <HierarchyNode
          key={entity.guid}
          entity={entity}
          selectedEntity={selectedEntity}
          onSelectEntity={onSelectEntity}
          level={level}
          nodeIndex={nodeIndex}
        />
      ))}
    </div>
  );
}

// Hierarchy Node Component
interface HierarchyNodeProps {
  entity: PCEntityData;
  selectedEntity: PCEntityData | null;
  onSelectEntity: (entity: PCEntityData) => void;
  level: number;
  nodeIndex?: { current: number };
}

function HierarchyNode({ entity, selectedEntity, onSelectEntity, level, nodeIndex }: HierarchyNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = entity.children && Array.isArray(entity.children) && entity.children.length > 0;
  const isSelected = selectedEntity?.guid === entity.guid;
  
  // Get current node index and increment for zebra striping
  const currentNodeIndex = nodeIndex ? nodeIndex.current++ : 0;
  const isEvenRow = currentNodeIndex % 2 === 0;

  return (
    <div className="hierarchy-node">
      <div
        className={`node-header ${isSelected ? 'selected' : ''} ${!entity.enabled ? 'disabled' : ''} ${isEvenRow ? 'zebra-even' : 'zebra-odd'}`}
        onClick={() => onSelectEntity(entity)}
      >
        {hasChildren && (
          <div
            className="expand-button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </div>
        )}
        {!hasChildren && <div style={{ width: 16, marginRight: 4 }} />}
        <span className="entity-name">{entity.name}</span>
        {entity.tags.length > 0 && (
          <div className="entity-tags">
            {entity.tags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
      {hasChildren && isExpanded && (
        <HierarchyTree
          entities={entity.children || []}
          selectedEntity={selectedEntity}
          onSelectEntity={onSelectEntity}
          level={level + 1}
          nodeIndex={nodeIndex}
        />
      )}
    </div>
  );
}

// Entity Inspector Component
interface EntityInspectorProps {
  entity: PCEntityData | null;
}

function EntityInspector({ entity }: EntityInspectorProps) {
  const [metadataExpanded, setMetadataExpanded] = useState(true);
  const [transformExpanded, setTransformExpanded] = useState(true);
  const [componentsExpanded, setComponentsExpanded] = useState(true);

  if (!entity) {
    return (
      <div className="inspector-empty">
        <p>Select an entity to view its properties</p>
      </div>
    );
  }

  const formatVector = (vec: { x: number; y: number; z: number } | undefined) => {
    if (!vec) return 'Not set';
    return `(${vec.x.toFixed(2)}, ${vec.y.toFixed(2)}, ${vec.z.toFixed(2)})`;
  };

  const renderTransformField = (label: string, vec: { x: number; y: number; z: number } | undefined) => {
    return (
      <PropertyRenderer
        label={label}
        value={vec || { x: 0, y: 0, z: 0 }}
        readOnly={true}
      />
    );
  };

  return (
    <div className="inspector-content">
      {/* Entity Metadata - Unity style */}
      <div className="entity-header-section">
        <div className="transform-header" onClick={() => setMetadataExpanded(!metadataExpanded)} style={{ cursor: 'pointer' }}>
          <h5 style={{ margin: '0', fontSize: 12, color: '#b0b0b0', display: 'flex', alignItems: 'center', gap: 6 }}>
            {metadataExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Metadata
          </h5>
        </div>
        {metadataExpanded && (
          <div style={{ padding: '12px' }}>
            <div className="entity-name-row">
              <input
                type="text"
                className="entity-name-input"
                value={entity.name}
                readOnly
                title="Entity Name"
              />
              <div className="entity-enabled-checkbox">
                <input
                  type="checkbox"
                  id={`enabled-${entity.guid}`}
                  checked={entity.enabled}
                  readOnly
                  title="Enabled"
                />
                <label htmlFor={`enabled-${entity.guid}`} className="checkbox-label-inline"></label>
              </div>
            </div>
            
            {/* Static/Tag/Layer row - Unity style */}
            <div className="entity-meta-row">
              <div className="entity-meta-group">
                <span className="meta-label">Static</span>
                <input type="checkbox" className="meta-checkbox" readOnly />
              </div>
              <div className="entity-meta-group">
                <span className="meta-label">Tag</span>
                <CustomDropdown
                  value={entity.tags.length > 0 ? entity.tags[0] : 'untagged'}
                  options={[
                    { value: 'untagged', label: 'Untagged' },
                    { value: 'player', label: 'Player' },
                    { value: 'enemy', label: 'Enemy' },
                    { value: 'environment', label: 'Environment' }
                  ]}
                  onChange={() => {}} // Read-only for now
                  disabled={true}
                  className="meta-dropdown"
                />
              </div>
              <div className="entity-meta-group">
                <span className="meta-label">Layer</span>
                <CustomDropdown
                  value="default"
                  options={[
                    { value: 'default', label: 'Default' },
                    { value: 'ui', label: 'UI' },
                    { value: 'world', label: 'World' },
                    { value: 'effects', label: 'Effects' }
                  ]}
                  onChange={() => {}} // Read-only for now
                  disabled={true}
                  className="meta-dropdown"
                />
              </div>
            </div>

            {/* Additional tags if multiple */}
            {entity.tags.length > 1 && (
              <div className="additional-tags">
                <span className="tags-label">Additional Tags:</span>
                <div className="tags-list">
                  {entity.tags.slice(1).map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* GUID info */}
            <div className="entity-guid-row">
              <span className="guid-label">GUID:</span>
              <span className="guid-value">{entity.guid}</span>
            </div>
          </div>
        )}
      </div>

      {/* Transform section - Unity style */}
      <div className="transform-section">
        <div className="transform-header" onClick={() => setTransformExpanded(!transformExpanded)} style={{ cursor: 'pointer' }}>
          <h5 style={{ margin: '0', fontSize: 12, color: '#b0b0b0', display: 'flex', alignItems: 'center', gap: 6 }}>
            {transformExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Transform
          </h5>
        </div>
        {transformExpanded && (
          <div className="transform-content" style={{ padding: '8px' }}>
            {renderTransformField('Position', entity.position)}
            {renderTransformField('Rotation', entity.rotation)}
            {renderTransformField('Scale', entity.scale)}
          </div>
        )}
      </div>

      <div className="components-section">
        <div className="transform-header" onClick={() => setComponentsExpanded(!componentsExpanded)} style={{ cursor: 'pointer' }}>
          <h5 style={{ margin: '0', fontSize: 12, color: '#b0b0b0', display: 'flex', alignItems: 'center', gap: 6 }}>
            {componentsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Components ({entity.components.length})
          </h5>
        </div>
        {componentsExpanded && (
          <div style={{ padding: '8px' }}>
            {entity.components.map((component, index) => (
              <ComponentInspector key={index} component={component} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Component Inspector
interface ComponentInspectorProps {
  component: PCComponentData;
}

function ComponentInspector({ component }: ComponentInspectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Define enum options for specific component types and properties
  const getEnumOptions = (componentType: string, propertyName: string) => {
    if (componentType === 'light' && propertyName === 'type') {
      return [
        { value: 'directional', label: 'Directional' },
        { value: 'point', label: 'Point' },
        { value: 'spot', label: 'Spot' }
      ];
    }
    if (componentType === 'rigidbody' && propertyName === 'type') {
      return [
        { value: 'static', label: 'Static' },
        { value: 'dynamic', label: 'Dynamic' },
        { value: 'kinematic', label: 'Kinematic' }
      ];
    }
    if (componentType === 'collision' && propertyName === 'type') {
      return [
        { value: 'box', label: 'Box' },
        { value: 'sphere', label: 'Sphere' },
        { value: 'capsule', label: 'Capsule' },
        { value: 'cylinder', label: 'Cylinder' },
        { value: 'mesh', label: 'Mesh' }
      ];
    }
    return undefined;
  };

  return (
    <div className="component-inspector">
      <div
        className="component-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="expand-button">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        <span className="component-name">{component.type}</span>
        <label
          className="component-enabled"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={component.enabled}
            readOnly
          />
        </label>
      </div>
      {isExpanded && (
        <div className="component-properties">
          {Object.entries(component.data).map(([key, value]) => (
            <PropertyRenderer
              key={key}
              label={key}
              value={value}
              enumOptions={getEnumOptions(component.type, key)}
              readOnly={true} // Currently read-only, can be made editable later
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
