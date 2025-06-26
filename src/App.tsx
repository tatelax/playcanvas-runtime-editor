import React, { useState, useEffect, useRef } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { Play, Pause, Settings, Search, ChevronRight, ChevronDown, ChevronLeft, ChevronUp, RotateCcw, TreePine, Monitor, Search as SearchIcon, Terminal, X, ExternalLink, Maximize, Github, Wifi, WifiOff, Trash2 } from 'lucide-react';
import { debugBridge, PCEntityData, PCComponentData } from './PlayCanvasDebugBridge';
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

// Storage keys
const ASPECT_RATIO_KEY = 'playcanvas-debug-aspect-ratio';
const GAME_URL_KEY = 'playcanvas-debug-game-url';

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
      id: 1,
      type: 'info',
      message: 'PlayCanvas Runtime Editor starting...',
      timestamp: new Date()
    }
  ]);
  const [hierarchyFilter, setHierarchyFilter] = useState('');
  const [hierarchySearchVisible, setHierarchySearchVisible] = useState(false);
  const [consoleFilter, setConsoleFilter] = useState('');
  const [logTypeFilters, setLogTypeFilters] = useState({
    log: true,
    info: true,
    warn: true,
    error: true
  });
  const [logLevel, setLogLevel] = useState<LogLevel>(() => {
    try {
      const saved = localStorage.getItem('playcanvas-debug-logger-level') as LogLevel;
      if (saved && ['none', 'error', 'warn', 'info', 'debug'].includes(saved)) {
        return saved;
      }
    } catch (error) {
      // Ignore errors loading from localStorage
    }
    return logger.getLevel();
  });

  const [hierarchyCollapsed, setHierarchyCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('free');
  const [isGameFullscreen, setIsGameFullscreen] = useState(false);

  const [gameName, setGameName] = useState('PlayCanvas Game');
  const [gameUrl, setGameUrl] = useState('http://localhost:5173/');
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [tempGameUrl, setTempGameUrl] = useState('http://localhost:5173/');
  const [isConnecting, setIsConnecting] = useState(false);
  const gameFrameRef = useRef<HTMLIFrameElement>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  
  // Counter for generating unique console message IDs
  const consoleMessageIdCounter = useRef(1);

  // Helper function to find entity by GUID in hierarchy
  const findEntityInHierarchy = (entities: PCEntityData[], guid: string): PCEntityData | null => {
    for (const entity of entities) {
      if (entity.guid === guid) {
        return entity;
      }
      if (entity.children && entity.children.length > 0) {
        const found = findEntityInHierarchy(entity.children, guid);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  // Load saved settings from localStorage
  useEffect(() => {
    try {
      // Load aspect ratio
      const savedAspectRatio = localStorage.getItem(ASPECT_RATIO_KEY);
      if (savedAspectRatio) {
        setAspectRatio(savedAspectRatio);
        logger.debug('Loaded aspect ratio:', savedAspectRatio);
      }

      // Load game URL
      const savedGameUrl = localStorage.getItem(GAME_URL_KEY);
      if (savedGameUrl) {
        setGameUrl(savedGameUrl);
        setTempGameUrl(savedGameUrl);
        logger.debug('Loaded game URL:', savedGameUrl);
        // Don't auto-connect here, will be handled by a separate useEffect
      } else {
        // No saved URL, show connection modal
        setShowConnectionModal(true);
      }

      // Load logger level
      const savedLogLevel = localStorage.getItem('playcanvas-debug-logger-level') as LogLevel;
      if (savedLogLevel && ['none', 'error', 'warn', 'info', 'debug'].includes(savedLogLevel)) {
        logger.setLevel(savedLogLevel);
        setLogLevel(savedLogLevel);
        logger.debug('Loaded logger level:', savedLogLevel);
        // Send to game as well
        setTimeout(() => debugBridge.setGameLogLevel(savedLogLevel), 100);
      } else {
        // Set initial log level to game
        setTimeout(() => debugBridge.setGameLogLevel(logLevel), 100);
      }
    } catch (error) {
      logger.warn('Failed to load saved settings:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Handle connection modal
  const handleConnect = () => {
    connectToGame(tempGameUrl);
  };

  const handleShowConnectionModal = () => {
    setTempGameUrl(gameUrl);
    setShowConnectionModal(true);
  };

  // Handle log level changes
  const handleLogLevelChange = (newLevel: LogLevel) => {
    setLogLevel(newLevel);
    logger.setLevel(newLevel);
    // Send log level to game
    debugBridge.setGameLogLevel(newLevel);
    // Persist to localStorage
    try {
      localStorage.setItem('playcanvas-debug-logger-level', newLevel);
    } catch (error) {
      logger.warn('Failed to save logger level:', error);
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
    
    // Reset log level
    setLogLevel('info');
    logger.setLevel('info');
    
    // Clear localStorage
    try {
      localStorage.removeItem(ASPECT_RATIO_KEY);
      localStorage.removeItem(GAME_URL_KEY);
      localStorage.removeItem('playcanvas-debug-logger-level');
    } catch (error) {
      logger.warn('Failed to clear localStorage:', error);
    }
    
    addConsoleMessage('info', 'All settings reset to defaults');
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
      console.log('📥 Received hierarchy update from game');
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
        
        // Update selected entity if it exists in the new hierarchy
        if (selectedEntity) {
          const updatedSelectedEntity = findEntityInHierarchy(newHierarchy, selectedEntity.guid);
          if (updatedSelectedEntity) {
            console.log('🔄 Updating selected entity:', {
              oldEnabled: selectedEntity.enabled,
              newEnabled: updatedSelectedEntity.enabled,
              entityName: updatedSelectedEntity.name,
              guid: selectedEntity.guid
            });
            // Force re-render by using functional update
            setSelectedEntity(prev => {
              if (prev && prev.guid === updatedSelectedEntity.guid) {
                return updatedSelectedEntity;
              }
              return prev;
            });
          } else {
            console.warn('❌ Selected entity not found in updated hierarchy:', selectedEntity.guid);
          }
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove isConnected dependency to prevent infinite loop

  const addConsoleMessage = (type: ConsoleMessage['type'], message: string, source?: string) => {
    const newMessage: ConsoleMessage = {
      id: ++consoleMessageIdCounter.current,
      type,
      message,
      timestamp: new Date(),
      source
    };
    setConsoleMessages(prev => [...prev, newMessage]);
  };

  // Connect to game URL
  const connectToGame = (url: string) => {
    if (!url.trim()) {
      addConsoleMessage('error', 'Please enter a valid URL');
      return;
    }

    setIsConnecting(true);
    setGameUrl(url);
    
    // Save URL to localStorage
    try {
      localStorage.setItem(GAME_URL_KEY, url);
      logger.debug('Saved game URL:', url);
    } catch (error) {
      logger.warn('Failed to save game URL:', error);
    }

    // Update iframe src
    if (gameFrameRef.current) {
      gameFrameRef.current.src = url;
    }

    addConsoleMessage('info', `Connecting to ${url}...`);
    setShowConnectionModal(false);
    
    // Reset connection state after timeout
    setTimeout(() => {
      setIsConnecting(false);
    }, 3000);
  };

  // Auto-scroll console to bottom
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleMessages]);

  // Debug selectedEntity changes
  useEffect(() => {
    if (selectedEntity) {
      console.log('✅ Selected entity state changed:', {
        name: selectedEntity.name,
        enabled: selectedEntity.enabled,
        guid: selectedEntity.guid
      });
    }
  }, [selectedEntity]);

  // Set up iframe reference when component mounts
  useEffect(() => {
    if (gameFrameRef.current) {
      debugBridge.setGameFrame(gameFrameRef.current);
    }
  }, []);

  // Auto-connect to saved URL after component is fully loaded
  useEffect(() => {
    const savedGameUrl = localStorage.getItem(GAME_URL_KEY);
    if (savedGameUrl && gameUrl === savedGameUrl && gameFrameRef.current) {
      // Auto-connect after a short delay to ensure iframe is ready
      setTimeout(() => {
        connectToGame(savedGameUrl);
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameUrl]); // Trigger when gameUrl changes

  // Signal readiness is now handled by the debug bridge when iframe loads

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
      const currentSrc = gameFrameRef.current.src;
      gameFrameRef.current.src = currentSrc; // Force reload
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
          <div className="connection-status" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isConnecting ? (
              <div className="connection-indicator connecting" title="Connecting..." style={{ color: '#ffa500', display: 'flex', alignItems: 'center' }}>
                <WifiOff size={16} />
              </div>
            ) : isConnected ? (
              <div className="connection-indicator connected" title="Connected" style={{ color: '#4caf50', display: 'flex', alignItems: 'center' }}>
                <Wifi size={16} />
              </div>
            ) : (
              <div className="connection-indicator disconnected" title="Disconnected" style={{ color: '#f44336', display: 'flex', alignItems: 'center' }}>
                <WifiOff size={16} />
              </div>
            )}
            <div className="status-text" style={{ color: '#ccc' }}>
              <span className="connection-text" style={{ fontSize: '12px' }}>
                {isConnecting ? 'Connecting...' : isConnected ? `Connected to ${gameName} [${gameUrl}]` : 'Disconnected'}
              </span>
              <span className="version-text" style={{ fontSize: '12px', opacity: 0.7 }}>v{packageJson.version}</span>
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
            onClick={() => window.open('https://github.com/tatelax/playcanvas-runtime-editor', '_blank')}
          >
            <Github size={16} />
          </button>

          <button 
            className="control-btn" 
            title="Connection Settings"
            onClick={handleShowConnectionModal}
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
                      {hierarchyCollapsed && (
                        <button
                          className="control-btn"
                          onClick={() => setHierarchyCollapsed(!hierarchyCollapsed)}
                          title={hierarchyCollapsed ? 'Expand Hierarchy' : 'Collapse Hierarchy'}
                          style={{ width: 24, height: 24 }}
                        >
                          {hierarchyCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
                        </button>
                      )}
                      <TreePine size={16} style={{ color: '#ff6600' }} />
                      {!hierarchyCollapsed && <h3>Hierarchy</h3>}
                    </div>
                    {!hierarchyCollapsed && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          className="control-btn"
                          onClick={() => {
                            setHierarchySearchVisible(!hierarchySearchVisible);
                            if (hierarchySearchVisible) {
                              setHierarchyFilter(''); // Clear filter when hiding search
                            }
                          }}
                          title="Toggle Search"
                          style={{ width: 24, height: 24 }}
                        >
                          <Search size={12} />
                        </button>
                        <button
                          className="control-btn"
                          onClick={() => setHierarchyCollapsed(!hierarchyCollapsed)}
                          title={hierarchyCollapsed ? 'Expand Hierarchy' : 'Collapse Hierarchy'}
                          style={{ width: 24, height: 24 }}
                        >
                          {hierarchyCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
                        </button>
                      </div>
                    )}
                  </div>
                  {!hierarchyCollapsed && hierarchySearchVisible && (
                    <div className="hierarchy-search-bar">
                      <div className="search-box">
                        <Search size={14} />
                        <input
                          type="text"
                          placeholder="Filter entities..."
                          value={hierarchyFilter}
                          onChange={(e) => setHierarchyFilter(e.target.value)}
                          autoFocus
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
                    </div>
                  )}
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
                        onClick={() => window.open(gameUrl, '_blank')}
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
                        src={gameUrl}
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
                      <EntityInspector 
                      key={selectedEntity ? `${selectedEntity.guid}-${selectedEntity.enabled}-${JSON.stringify(selectedEntity.position)}` : 'no-entity'} 
                      entity={selectedEntity} 
                      isConnected={isConnected} 
                    />
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
                        className="control-btn"
                        onClick={() => setConsoleMessages([])}
                        title="Clear Console"
                        style={{ width: 24, height: 24 }}
                      >
                        <Trash2 size={12} />
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



      {/* Settings Modal */}
      {showConnectionModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(44, 62, 65, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="panel" style={{
            backgroundColor: '#364447',
            border: '1px solid #4a5d61',
            borderRadius: '6px',
            minWidth: '520px',
            maxWidth: '640px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '40vh'
          }}>
            <div className="panel-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid #4a5d61',
              backgroundColor: '#2a3539'
            }}>
              <h3 style={{ 
                margin: 0, 
                color: '#b8c5c7', 
                fontSize: '13px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Connection & Settings
              </h3>
              <button
                onClick={() => setShowConnectionModal(false)}
                className="control-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8d9ea1',
                  cursor: 'pointer',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="panel-content" style={{
              padding: '12px 16px',
              overflowY: 'auto'
            }}>
              <div className="property-group" style={{ marginBottom: '16px' }}>
                <h5 style={{ 
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#8d9ea1',
                  margin: '0 0 8px 0', 
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Game Connection
                </h5>
                <div className="property-row">
                  <label className="property-label" style={{ 
                    color: '#b8c5c7',
                    fontSize: '13px',
                    fontWeight: '500',
                    marginBottom: '6px',
                    display: 'block'
                  }}>
                    Game URL:
                  </label>
                  <input
                    type="text"
                    value={tempGameUrl}
                    onChange={(e) => setTempGameUrl(e.target.value)}
                    placeholder="http://localhost:5173/"
                    className="url-input"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: '#2a3539',
                      border: '1px solid #4a5d61',
                      borderRadius: '3px',
                      color: '#b8c5c7',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s ease'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleConnect();
                      }
                    }}
                  />
                </div>
              </div>

              <div className="property-group" style={{ marginBottom: '16px' }}>
                <h5 style={{ 
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#8d9ea1',
                  margin: '0 0 8px 0', 
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Runtime Editor Settings
                </h5>
                <div className="property-row">
                  <label className="property-label" style={{ 
                    color: '#b8c5c7',
                    fontSize: '13px',
                    fontWeight: '500',
                    marginBottom: '6px',
                    display: 'block'
                  }}>
                    Log Level:
                  </label>
                  <CustomDropdown
                    value={logLevel}
                    options={[
                      { value: 'none', label: 'None' },
                      { value: 'error', label: 'Error' },
                      { value: 'warn', label: 'Warn' },
                      { value: 'info', label: 'Info' },
                      { value: 'debug', label: 'Debug' }
                    ]}
                    onChange={(value) => handleLogLevelChange(value as LogLevel)}
                  />
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  color: '#8d9ea1', 
                  marginTop: '6px', 
                  lineHeight: '1.4',
                  fontStyle: 'italic'
                }}>
                  Controls console message visibility in the runtime editor only
                </div>
              </div>

              <div className="property-group" style={{ 
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: '#2a3539',
                borderRadius: '3px',
                border: '1px solid #4a5d61'
              }}>
                <h5 style={{ 
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#ff6600',
                  margin: '0 0 8px 0', 
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Troubleshooting
                </h5>
                <ul style={{ 
                  margin: '0', 
                  paddingLeft: '16px', 
                  color: '#8d9ea1', 
                  fontSize: '11px', 
                  lineHeight: '1.5'
                }}>
                  <li>Make sure your PlayCanvas game is running on the specified URL</li>
                  <li>Default development server runs on <code style={{ 
                    backgroundColor: '#364447', 
                    padding: '2px 4px', 
                    borderRadius: '2px',
                    color: '#b8c5c7'
                  }}>http://localhost:5173/</code></li>
                  <li>If using a different port, update the URL accordingly</li>
                  <li>Ensure the game includes the debug integration script</li>
                  <li>Check browser console for connection errors</li>
                  <li>CORS issues may prevent connection to different domains</li>
                </ul>
              </div>

              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                paddingTop: '8px',
                borderTop: '1px solid #4a5d61'
              }}>
                <button
                  onClick={resetAllSettings}
                  className="control-btn"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#d32f2f',
                    border: '1px solid #b71c1c',
                    borderRadius: '3px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    width: 'auto',
                    height: 'auto'
                  }}
                >
                  Reset All Settings
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setShowConnectionModal(false)}
                    className="control-btn"
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'transparent',
                      border: '1px solid #4a5d61',
                      borderRadius: '3px',
                      color: '#8d9ea1',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '500',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      width: 'auto',
                      height: 'auto'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConnect}
                    disabled={!tempGameUrl.trim()}
                    className="control-btn"
                    style={{
                      padding: '8px 16px',
                      backgroundColor: tempGameUrl.trim() ? '#ff6600' : '#4a5d61',
                      border: tempGameUrl.trim() ? '1px solid #e55a00' : '1px solid #4a5d61',
                      borderRadius: '3px',
                      color: '#fff',
                      cursor: tempGameUrl.trim() ? 'pointer' : 'not-allowed',
                      fontSize: '12px',
                      fontWeight: '500',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      width: 'auto',
                      height: 'auto'
                    }}
                  >
                    SAVE
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
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
      <div style={{ paddingLeft: level * 20, color: '#f44336', fontSize: 12 }}>
        Error: Invalid entity data
      </div>
    );
  }

  // Remove duplicates based on GUID to prevent React key errors
  const uniqueEntities = entities.filter((entity, index, self) => 
    index === self.findIndex(e => e.guid === entity.guid)
  );

  if (uniqueEntities.length !== entities.length) {
    logger.warn(`Removed ${entities.length - uniqueEntities.length} duplicate entities from hierarchy`);
  }

  return (
    <div>
      {uniqueEntities.map((entity, index) => (
        <HierarchyNode
          key={`${entity.guid}_${index}`}
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

  // Get entity icon based on components or name
  const getEntityIcon = () => {
    if (entity.components.some(c => c.type === 'camera')) return '📷';
    if (entity.components.some(c => c.type === 'light')) return '💡';
    if (entity.components.some(c => c.type === 'model')) return '📦';
    if (entity.components.some(c => c.type === 'collision')) return '🔲';
    if (entity.name.toLowerCase().includes('ui')) return '🖼️';
    return '📁'; // Default folder icon
  };

  return (
    <div className="hierarchy-node">
      <div
        className={`node-header ${isSelected ? 'selected' : ''} ${!entity.enabled ? 'disabled' : ''}`}
        style={{ paddingLeft: `${8 + level * 20}px` }}
        onClick={() => onSelectEntity(entity)}
      >
        <div className="node-indent">
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
          {!hasChildren && <div style={{ width: 16 }} />}
        </div>
        <span className="entity-icon">{getEntityIcon()}</span>
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
  isConnected: boolean;
}

function EntityInspector({ entity, isConnected }: EntityInspectorProps) {
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

  const renderTransformField = (label: string, vec: { x: number; y: number; z: number } | undefined) => {
    const handleTransformChange = (newVec: { x: number; y: number; z: number }) => {
      if (!entity || !isConnected) return;
      
      const transformType = label.toLowerCase() as ('position' | 'rotation' | 'scale');
      debugBridge.updateEntityTransform(entity.guid, transformType, newVec);
    };

    return (
      <PropertyRenderer
        label={label}
        value={vec || { x: 0, y: 0, z: 0 }}
        onChange={isConnected ? handleTransformChange : undefined}
        readOnly={!isConnected}
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
                  onChange={(e) => {
                    console.log('🔘 Checkbox clicked:', {
                      entityName: entity.name,
                      newState: e.target.checked,
                      currentState: entity.enabled
                    });
                    if (isConnected) {
                      debugBridge.toggleEntityEnabled(entity.guid, e.target.checked);
                    }
                  }}
                  disabled={!isConnected}
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
              <ComponentInspector key={index} component={component} entity={entity} isConnected={isConnected} />
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
  entity: PCEntityData;
  isConnected: boolean;
}

function ComponentInspector({ component, entity, isConnected }: ComponentInspectorProps) {
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
            onChange={(e) => {
              if (isConnected) {
                debugBridge.enableComponent(entity.guid, component.type, e.target.checked);
              }
            }}
            disabled={!isConnected}
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
              onChange={isConnected ? (newValue) => {
                debugBridge.updateComponentProperty(entity.guid, component.type, key, newValue);
              } : undefined}
              readOnly={!isConnected}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
