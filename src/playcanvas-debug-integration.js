// PlayCanvas Debug Integration
// Add this script to your PlayCanvas game to enable debug overlay communication

class PlayCanvasDebugInterface {
    constructor(app) {
        this.app = app;
        this.isConnected = false;
        this.selectedEntity = null;
        this.isPaused = false;
        this.originalTimeScale = 1;
        
        // Listen for messages from debug overlay
        window.addEventListener('message', this.handleDebugMessage.bind(this));
        
        // Send periodic updates
        this.performanceTimer = setInterval(() => {
            this.sendPerformanceData();
        }, 1000);
    }

    handleDebugMessage(event) {
        // Only handle messages from our debug overlay
        if (event.origin !== window.location.origin && event.origin !== 'http://localhost:3000') {
            return;
        }

        const message = event.data;
        
        switch (message.type) {
            case 'debug-connect':
                this.handleConnection(message.data);
                break;
            case 'debug-control':
                this.handleControl(message.action);
                break;
            case 'debug-select-entity':
                this.selectEntity(message.guid);
                break;
            case 'debug-request-hierarchy':
                this.sendHierarchy();
                break;
            case 'debug-component-enable':
                this.enableComponent(message.entityGuid, message.componentType, message.enabled);
                break;
            case 'debug-component-update':
                this.updateComponentProperty(message.entityGuid, message.componentType, message.property, message.value);
                break;
        }
    }

    handleConnection(data) {
        this.isConnected = true;
        
        // Send connection confirmation
        this.sendToDebugOverlay({
            type: 'debug-connected',
            data: { connected: true }
        });
        
        // Send initial hierarchy
        if (data.requestHierarchy) {
            this.sendHierarchy();
        }
        
        // Start performance monitoring
        if (data.requestPerformance) {
            this.sendPerformanceData();
        }
        
        console.log('Debug overlay connected');
    }

    handleControl(action) {
        switch (action) {
            case 'pause':
                this.pauseGame();
                break;
            case 'resume':
            case 'play':
                this.resumeGame();
                break;
            case 'restart':
                this.restartGame();
                break;
        }
    }

    pauseGame() {
        if (!this.isPaused) {
            this.originalTimeScale = this.app.timeScale;
            this.app.timeScale = 0;
            this.isPaused = true;
            this.sendConsoleMessage('info', 'Game paused by debug overlay');
        }
    }

    resumeGame() {
        if (this.isPaused) {
            this.app.timeScale = this.originalTimeScale;
            this.isPaused = false;
            this.sendConsoleMessage('info', 'Game resumed by debug overlay');
        }
    }

    restartGame() {
        // Implement restart logic based on your game's structure
        this.sendConsoleMessage('info', 'Game restart requested (implement restart logic)');
        // You might want to:
        // - Reset player position
        // - Reset game state
        // - Reload the scene
        // - etc.
    }

    selectEntity(guid) {
        // Find entity by GUID
        const entity = this.findEntityByGuid(this.app.root, guid);
        if (entity) {
            this.selectedEntity = entity;
            // Optionally highlight the entity in the game
            this.highlightEntity(entity);
            this.sendConsoleMessage('info', `Selected entity: ${entity.name}`);
        }
    }

    findEntityByGuid(entity, guid) {
        if (entity.getGuid && entity.getGuid() === guid) {
            return entity;
        }
        
        for (let i = 0; i < entity.children.length; i++) {
            const found = this.findEntityByGuid(entity.children[i], guid);
            if (found) return found;
        }
        
        return null;
    }

    highlightEntity(entity) {
        // Optionally add visual highlighting for selected entity
        // You could add a colored outline, wireframe, or other visual indicator
    }

    enableComponent(entityGuid, componentType, enabled) {
        const entity = this.findEntityByGuid(this.app.root, entityGuid);
        if (entity) {
            const component = entity[componentType];
            if (component && typeof component.enabled !== 'undefined') {
                component.enabled = enabled;
                this.sendConsoleMessage('info', `${componentType} component ${enabled ? 'enabled' : 'disabled'} on ${entity.name}`);
                
                // Send updated hierarchy
                this.sendHierarchy();
            }
        }
    }

    updateComponentProperty(entityGuid, componentType, property, value) {
        const entity = this.findEntityByGuid(this.app.root, entityGuid);
        if (entity) {
            const component = entity[componentType];
            if (component && component[property] !== undefined) {
                component[property] = value;
                this.sendConsoleMessage('info', `Updated ${entity.name}.${componentType}.${property} = ${value}`);
            }
        }
    }

    sendHierarchy() {
        const hierarchy = this.buildHierarchy(this.app.root);
        this.sendToDebugOverlay({
            type: 'hierarchy',
            data: hierarchy
        });
    }

    buildHierarchy(entity) {
        const children = [];
        for (let i = 0; i < entity.children.length; i++) {
            children.push(this.buildHierarchy(entity.children[i]));
        }

        const components = [];
        
        // Common PlayCanvas components
        const componentTypes = ['model', 'camera', 'light', 'script', 'rigidbody', 'collision', 'sound', 'animation'];
        
        componentTypes.forEach(type => {
            if (entity[type]) {
                const componentData = {
                    type: type,
                    enabled: entity[type].enabled !== undefined ? entity[type].enabled : true,
                    data: this.extractComponentData(entity[type], type)
                };
                components.push(componentData);
            }
        });

        return {
            name: entity.name,
            enabled: entity.enabled,
            guid: entity.getGuid ? entity.getGuid() : entity.name,
            children: children,
            components: components,
            tags: entity.tags ? entity.tags.list() : [],
            position: entity.getPosition ? {
                x: Math.round(entity.getPosition().x * 100) / 100,
                y: Math.round(entity.getPosition().y * 100) / 100,
                z: Math.round(entity.getPosition().z * 100) / 100
            } : undefined,
            rotation: entity.getEulerAngles ? {
                x: Math.round(entity.getEulerAngles().x * 100) / 100,
                y: Math.round(entity.getEulerAngles().y * 100) / 100,
                z: Math.round(entity.getEulerAngles().z * 100) / 100
            } : undefined,
            scale: entity.getLocalScale ? {
                x: Math.round(entity.getLocalScale().x * 100) / 100,
                y: Math.round(entity.getLocalScale().y * 100) / 100,
                z: Math.round(entity.getLocalScale().z * 100) / 100
            } : undefined
        };
    }

    extractComponentData(component, type) {
        const data = {};
        
        try {
            switch (type) {
                case 'model':
                    data.asset = component.asset || null;
                    data.castShadows = component.castShadows;
                    data.receiveShadows = component.receiveShadows;
                    break;
                case 'camera':
                    data.fov = component.fov;
                    data.nearClip = component.nearClip;
                    data.farClip = component.farClip;
                    data.clearColor = component.clearColor ? [
                        component.clearColor.r,
                        component.clearColor.g,
                        component.clearColor.b,
                        component.clearColor.a
                    ] : null;
                    break;
                case 'light':
                    data.type = component.type;
                    data.color = component.color ? [component.color.r, component.color.g, component.color.b] : null;
                    data.intensity = component.intensity;
                    data.castShadows = component.castShadows;
                    break;
                case 'rigidbody':
                    data.type = component.type;
                    data.mass = component.mass;
                    data.restitution = component.restitution;
                    data.friction = component.friction;
                    break;
                case 'collision':
                    data.type = component.type;
                    if (component.halfExtents) {
                        data.halfExtents = [
                            component.halfExtents.x,
                            component.halfExtents.y,
                            component.halfExtents.z
                        ];
                    }
                    data.radius = component.radius;
                    data.height = component.height;
                    break;
                case 'script':
                    data.scripts = {};
                    if (component.scripts) {
                        component.scripts.forEach((script, name) => {
                            data.scripts[name] = {
                                enabled: script.enabled,
                                attributes: script.attributes || {}
                            };
                        });
                    }
                    break;
                default:
                    // Generic component data extraction
                    for (const prop in component) {
                        if (typeof component[prop] !== 'function' && prop !== 'entity' && prop !== 'system') {
                            data[prop] = component[prop];
                        }
                    }
            }
        } catch (error) {
            data.error = `Failed to extract ${type} component data: ${error.message}`;
        }
        
        return data;
    }

    sendPerformanceData() {
        if (!this.isConnected) return;
        
        const stats = this.app.stats;
        const performanceData = {
            fps: Math.round(1000 / this.app.stats.frame.dt),
            frameTime: this.app.stats.frame.dt,
            drawCalls: stats.drawCalls,
            triangles: stats.triangles,
            memory: {
                used: stats.memory ? stats.memory.used : 0,
                total: stats.memory ? stats.memory.total : 0
            }
        };
        
        this.sendToDebugOverlay({
            type: 'performance',
            data: performanceData
        });
    }

    sendConsoleMessage(type, message, source = 'PlayCanvas') {
        this.sendToDebugOverlay({
            type: 'console',
            data: {
                type: type,
                message: message,
                timestamp: new Date(),
                source: source
            }
        });
    }

    sendToDebugOverlay(message) {
        // Send to parent window (for iframe setup)
        if (window.parent !== window) {
            window.parent.postMessage(message, '*');
        }
        
        // Also send to opener (for popup setup)
        if (window.opener) {
            window.opener.postMessage(message, '*');
        }
    }

    destroy() {
        if (this.performanceTimer) {
            clearInterval(this.performanceTimer);
        }
        window.removeEventListener('message', this.handleDebugMessage);
    }
}

// Auto-initialize if PlayCanvas app is available
if (typeof pc !== 'undefined' && window.pc && window.pc.Application) {
    // Wait for app initialization
    document.addEventListener('DOMContentLoaded', () => {
        // Look for the PlayCanvas app instance
        // Adjust this based on how your app is exposed globally
        if (window.app || window.game || window.pcApp) {
            const appInstance = window.app || window.game || window.pcApp;
            window.debugInterface = new PlayCanvasDebugInterface(appInstance);
            console.log('PlayCanvas Debug Interface initialized');
        } else {
            console.warn('PlayCanvas app instance not found. Initialize debug interface manually with: new PlayCanvasDebugInterface(yourAppInstance)');
        }
    });
} else {
    console.warn('PlayCanvas not detected. Make sure this script is loaded after PlayCanvas.');
}

// Export for manual initialization
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlayCanvasDebugInterface;
} else {
    window.PlayCanvasDebugInterface = PlayCanvasDebugInterface;
} 