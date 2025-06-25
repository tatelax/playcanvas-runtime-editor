import React, { useState, useEffect } from 'react';
import { debugBridge } from './PlayCanvasDebugBridge';
import { logger, LogLevel } from './Logger';

interface DiagnosticInfo {
  iframeLoaded: boolean;
  bridgeConnected: boolean;
  gameAppExists: boolean;
  debugInterfaceExists: boolean;
  lastMessage: string;
  messageCount: number;
}

interface DiagnosticPanelProps {
  onClose: () => void;
  gameFrameRef?: React.RefObject<HTMLIFrameElement | null>;
  onSettingsReset?: () => void;
}

export function DiagnosticPanel({ onClose, gameFrameRef, onSettingsReset }: DiagnosticPanelProps) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo>({
    iframeLoaded: false,
    bridgeConnected: false,
    gameAppExists: false,
    debugInterfaceExists: false,
    lastMessage: 'None',
    messageCount: 0
  });
  
  const [logLevel, setLogLevel] = useState<LogLevel>(() => {
    // Load saved logger level from localStorage
    try {
      const saved = localStorage.getItem('playcanvas-debug-logger-level') as LogLevel;
      if (saved && ['none', 'error', 'warn', 'info', 'debug'].includes(saved)) {
        logger.setLevel(saved);
        // Send to game as well
        setTimeout(() => debugBridge.setGameLogLevel(saved), 100);
        return saved;
      }
    } catch (error) {
      // Ignore errors loading from localStorage
    }
    const currentLevel = logger.getLevel();
    // Send current level to game
    setTimeout(() => debugBridge.setGameLogLevel(currentLevel), 100);
    return currentLevel;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      // Check iframe - use more reliable detection methods
      const iframe = gameFrameRef?.current || document.querySelector('iframe') as HTMLIFrameElement;
      let iframeLoaded = false;
      
      if (iframe) {
        // Check if iframe exists and has a src attribute
        iframeLoaded = !!(iframe.src && iframe.src.length > 0);
        
        // If we have a valid src, consider it loaded since cross-origin restrictions
        // often prevent us from checking contentDocument.readyState
        if (iframeLoaded) {
          // Try to check readyState if possible, but don't fail if we can't
          try {
            if (iframe.contentDocument) {
              // Only update if we can actually check the ready state
              const readyState = iframe.contentDocument.readyState;
              if (readyState) {
                iframeLoaded = readyState === 'complete';
              }
            }
          } catch (error) {
            // Cross-origin restrictions - keep the iframe as loaded since src exists
            // This is likely the working case for localhost:5173
          }
        }
      }
      
      // Check bridge connection
      const bridgeConnected = debugBridge.getConnectionStatus();
      
      let gameAppExists = false;
      let debugInterfaceExists = false;
      
      try {
        // Try to access the iframe's window
        if (iframe?.contentWindow) {
          gameAppExists = !!(iframe.contentWindow as any).app;
          debugInterfaceExists = !!(iframe.contentWindow as any).debugInterface;
        }
      } catch (error) {
        // Cross-origin restrictions prevent access
      }

      setDiagnostics({
        iframeLoaded,
        bridgeConnected,
        gameAppExists,
        debugInterfaceExists,
        lastMessage: 'Checking...',
        messageCount: 0
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const testConnection = () => {
    const iframe = gameFrameRef?.current || document.querySelector('iframe') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'debug-test',
        data: { test: true, timestamp: Date.now() }
      }, '*');
      logger.debug('Test message sent to iframe');
    }
  };

  const reloadIframe = () => {
    const iframe = gameFrameRef?.current || document.querySelector('iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src; // Force reload
    }
  };

  const resetSettings = () => {
    // List of localStorage keys used by the runtime editor
    const settingsKeys = [
      'playcanvas-debug-panel-layout',
      'playcanvas-debug-aspect-ratio',
      'playcanvas-debug-logger-level'
    ];

    // Clear all settings
    settingsKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
        logger.debug(`Cleared setting: ${key}`);
      } catch (error) {
        logger.warn(`Failed to clear setting ${key}:`, error);
      }
    });

    // Reset logger level to default
    logger.setLevel('none');
    setLogLevel('none');

    // Call the parent reset callback if provided
    if (onSettingsReset) {
      onSettingsReset();
    }

    logger.info('All runtime editor settings have been reset');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 50,
      right: 20,
      width: 350,
      background: '#2d2d2d',
      border: '1px solid #404040',
      borderRadius: 8,
      padding: 16,
      color: '#e0e0e0',
      fontSize: 12,
      zIndex: 1000
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 16,
        borderBottom: '1px solid #404040',
        paddingBottom: 8
      }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Debug Diagnostics</h3>
        <button 
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#e0e0e0',
            cursor: 'pointer',
            fontSize: 16
          }}
        >
          ×
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#b0b0b0' }}>Connection Status</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, fontSize: 11 }}>
          <span>Iframe Loaded:</span>
          <span style={{ color: diagnostics.iframeLoaded ? '#4caf50' : '#f44336' }}>
            {diagnostics.iframeLoaded ? '✓' : '✗'}
          </span>
          
          <span>Bridge Connected:</span>
          <span style={{ color: diagnostics.bridgeConnected ? '#4caf50' : '#f44336' }}>
            {diagnostics.bridgeConnected ? '✓' : '✗'}
          </span>
          
          <span>Game App Exists:</span>
          <span style={{ color: diagnostics.gameAppExists ? '#4caf50' : '#888' }}>
            {diagnostics.gameAppExists ? '✓' : '?'}
          </span>
          
          <span>Debug Interface:</span>
          <span style={{ color: diagnostics.debugInterfaceExists ? '#4caf50' : '#888' }}>
            {diagnostics.debugInterfaceExists ? '✓' : '?'}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#b0b0b0' }}>Runtime Editor Logging</h4>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 10, color: '#ccc', marginBottom: 4 }}>
            Log Level:
          </label>
          <select
            value={logLevel}
            onChange={(e) => {
              const newLevel = e.target.value as LogLevel;
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
            }}
            style={{
              background: '#404040',
              border: '1px solid #555',
              borderRadius: 4,
              color: '#e0e0e0',
              fontSize: 10,
              padding: '4px 8px',
              width: '100%'
            }}
          >
            <option value="none">None</option>
            <option value="error">Error</option>
            <option value="warn">Warn</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#b0b0b0' }}>Quick Actions</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={testConnection}
            style={{
              background: '#404040',
              border: '1px solid #555',
              borderRadius: 4,
              color: '#e0e0e0',
              cursor: 'pointer',
              fontSize: 10,
              padding: '4px 8px'
            }}
          >
            Test Connection
          </button>
          <button
            onClick={reloadIframe}
            style={{
              background: '#404040',
              border: '1px solid #555',
              borderRadius: 4,
              color: '#e0e0e0',
              cursor: 'pointer',
              fontSize: 10,
              padding: '4px 8px'
            }}
          >
            Reload Game
          </button>
          <button
            onClick={resetSettings}
            style={{
              background: '#d32f2f',
              border: '1px solid #b71c1c',
              borderRadius: 4,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 10,
              padding: '4px 8px'
            }}
          >
            Reset Settings
          </button>
        </div>
      </div>

      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#b0b0b0' }}>Troubleshooting</h4>
        <div style={{ fontSize: 10, lineHeight: 1.4, color: '#ccc' }}>
          {!diagnostics.iframeLoaded && (
            <div style={{ color: '#ff9800', marginBottom: 4 }}>
              • Game iframe not loaded - check game URL
            </div>
          )}
          {diagnostics.iframeLoaded && !diagnostics.bridgeConnected && (
            <div style={{ color: '#ff9800', marginBottom: 4 }}>
              • Bridge not connected - check debug integration script
            </div>
          )}
          {diagnostics.iframeLoaded && diagnostics.bridgeConnected && (
            <div style={{ color: '#4caf50', marginBottom: 4 }}>
              • All systems connected! ✓
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 9, color: '#888' }}>
            Set logging level above to see detailed logs in browser console
          </div>
        </div>
      </div>
    </div>
  );
} 