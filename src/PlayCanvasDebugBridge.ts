// PlayCanvas Debug Bridge
// This module handles communication between the runtime editor and the PlayCanvas game

import { logger } from './Logger';

export interface PCEntityData {
  name: string;
  enabled: boolean;
  guid: string;
  children: PCEntityData[];
  components: PCComponentData[];
  tags: string[];
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
}

export interface PCComponentData {
  type: string;
  enabled: boolean;
  data: any;
}

export interface DebugMessage {
  type: 'hierarchy' | 'entity-selected' | 'console' | 'performance' | 'control' | 'debug-connected' | 'debug-overlay-ready' | 'debug-connect';
  data: any;
}

export interface PerformanceData {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  memory: {
    used: number;
    total: number;
  };
}

export class PlayCanvasDebugBridge {
  private gameFrame: HTMLIFrameElement | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private isConnected = false;

  constructor() {
    // Listen for messages from the PlayCanvas game
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  setGameFrame(frame: HTMLIFrameElement) {
    this.gameFrame = frame;
    
    // Wait for frame to load then establish connection
    frame.onload = () => {
      // First signal that the runtime editor is ready
      setTimeout(() => {
        this.signalDebugOverlayReady();
      }, 500);
      
      // Wait longer for the PlayCanvas app and debug integration to initialize
      setTimeout(() => {
        this.establishConnection();
        // Try again after another delay in case the first attempt was too early
        setTimeout(() => {
          if (!this.isConnected) {
            this.establishConnection();
          }
        }, 2000);
      }, 2000);
    };
  }

  // Signal to the game that the runtime editor is ready
  signalDebugOverlayReady() {
    this.sendToGame({
      type: 'debug-overlay-ready',
      data: {
        timestamp: new Date().toISOString()
      }
    });
  }

  private establishConnection() {
    this.sendToGame({
      type: 'debug-connect',
      data: {
        requestHierarchy: true,
        requestPerformance: true
      }
    });
  }

  private handleMessage(event: MessageEvent) {
    // Only handle messages from our game frame
    if (this.gameFrame && event.source === this.gameFrame.contentWindow) {
      try {
        const message: DebugMessage = event.data;
        
        if (message.type === 'debug-connected') {
          this.isConnected = true;
          this.notifyHandler('connected', true);
          
          // Handle game info if provided
          if (message.data.gameName) {
            this.notifyHandler('gameInfo', {
              name: message.data.gameName,
              url: message.data.gameUrl
            });
          }
        }
        
        // Route message to appropriate handler
        const handler = this.messageHandlers.get(message.type);
        if (handler) {
          handler(message.data);
        }
      } catch (error) {
        logger.error('Error handling message from PlayCanvas:', error);
      }
    }
  }

  private sendToGame(message: any) {
    if (this.gameFrame?.contentWindow) {
      this.gameFrame.contentWindow.postMessage(message, '*');
    }
  }

  private notifyHandler(type: string, data: any) {
    const handler = this.messageHandlers.get(type);
    if (handler) {
      handler(data);
    }
  }

  // Public API methods
  onConnected(callback: (connected: boolean) => void) {
    this.messageHandlers.set('connected', callback);
  }

  onHierarchyUpdate(callback: (hierarchy: PCEntityData[]) => void) {
    this.messageHandlers.set('hierarchy', callback);
  }

  onPerformanceUpdate(callback: (perf: PerformanceData) => void) {
    this.messageHandlers.set('performance', callback);
  }

  onConsoleMessage(callback: (message: any) => void) {
    this.messageHandlers.set('console', callback);
  }

  onGameInfo(callback: (info: { name: string; url: string }) => void) {
    this.messageHandlers.set('gameInfo', callback);
  }

  // Control methods
  pauseGame() {
    this.sendToGame({
      type: 'debug-control',
      action: 'pause'
    });
  }

  resumeGame() {
    this.sendToGame({
      type: 'debug-control',
      action: 'resume'
    });
  }

  restartGame() {
    this.sendToGame({
      type: 'debug-control',
      action: 'restart'
    });
  }

  selectEntity(guid: string) {
    this.sendToGame({
      type: 'debug-select-entity',
      guid: guid
    });
  }

  requestHierarchy() {
    this.sendToGame({
      type: 'debug-request-hierarchy'
    });
  }

  enableComponent(entityGuid: string, componentType: string, enabled: boolean) {
    this.sendToGame({
      type: 'debug-component-enable',
      entityGuid,
      componentType,
      enabled
    });
  }

  updateComponentProperty(entityGuid: string, componentType: string, property: string, value: any) {
    this.sendToGame({
      type: 'debug-component-update',
      entityGuid,
      componentType,
      property,
      value
    });
  }

  setGameLogLevel(logLevel: string) {
    this.sendToGame({
      type: 'debug-set-log-level',
      logLevel
    });
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }


}

// Singleton instance
export const debugBridge = new PlayCanvasDebugBridge(); 