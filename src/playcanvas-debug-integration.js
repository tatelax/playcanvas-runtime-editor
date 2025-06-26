// PlayCanvas Debug Integration
// Add this script to your PlayCanvas game to enable runtime editor communication

class PlayCanvasDebugInterface {
    constructor(app) {
        try {
            this.app = app;
            this.isConnected = false;
            this.selectedEntity = null;
            this.isPaused = false;
            this.originalTimeScale = 1;
            this.lastHierarchyHash = null;
            this.originalConsole = {};
            this.messageBuffer = []; // Buffer messages when runtime editor isn't connected
            this.maxBufferSize = 100; // Limit buffer size to prevent memory issues
            
            // Debouncing properties
            this.hierarchyUpdateDebounceTimer = null;
            this.hierarchyUpdateDelay = 100; // 100ms debounce delay
            this.entityEventListeners = new Map(); // Track event listeners for cleanup
            
            // Debug logging properties
            this.debugLogLevel = 'none'; // Default to no debug logging
            
            // Scene event listeners setup flag
            this.sceneEventListenersSetup = false;
            
            // Validate app object
            if (!app) {
                throw new Error('PlayCanvas app object is required');
            }
            
            // Intercept all console methods to route to runtime editor
            this.interceptConsole();
            
            // Listen for messages from runtime editor
            window.addEventListener('message', this.handleDebugMessage.bind(this));
            
            // Send periodic updates (reduced frequency since we have events)
            this.performanceTimer = setInterval(() => {
                this.sendPerformanceData();
            }, 1000);
            
            // Monitor hierarchy changes with longer interval as backup
            this.hierarchyTimer = setInterval(() => {
                this.scheduleHierarchyUpdate('polling');
            }, 2000); // Reduced to 2 seconds since events handle most updates
            
            // Listen for immediate hierarchy changes
            this.setupHierarchyEventListeners();
        } catch (error) {
            console.error('Debug interface initialization failed:', error);
            // Don't throw the error - allow the game to continue running
        }
    }

    interceptConsole() {
        // Store original console methods
        this.originalConsole = {
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            info: console.info.bind(console),
            debug: console.debug.bind(console)
        };

        // Override console methods to route to runtime editor
        console.log = (...args) => {
            this.originalConsole.log(...args);
            this.sendConsoleMessage('log', args.join(' '), 'Console');
        };

        console.warn = (...args) => {
            this.originalConsole.warn(...args);
            this.sendConsoleMessage('warn', args.join(' '), 'Console');
        };

        console.error = (...args) => {
            this.originalConsole.error(...args);
            this.sendConsoleMessage('error', args.join(' '), 'Console');
        };

        console.info = (...args) => {
            this.originalConsole.info(...args);
            this.sendConsoleMessage('info', args.join(' '), 'Console');
        };

        console.debug = (...args) => {
            this.originalConsole.debug(...args);
            this.sendConsoleMessage('log', args.join(' '), 'Console');
        };
    }

    handleDebugMessage(event) {
        // Only handle messages from our runtime editor
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
            case 'debug-set-log-level':
                this.setDebugLogLevel(message.logLevel);
                break;
            case 'debug-transform-update':
                this.updateEntityTransform(message.entityGuid, message.transformType, message.value);
                break;
            case 'debug-entity-property-update':
                this.updateEntityProperty(message.entityGuid, message.propertyPath, message.value);
                break;
            case 'debug-entity-enable':
                this.toggleEntityEnabled(message.entityGuid, message.enabled);
                break;
        }
    }

    handleConnection(data) {
        this.isConnected = true;
        
        // Get game name from document title or default
        const gameName = document.title || 'PlayCanvas Game';
        
        console.log('✅ Runtime editor connected');
        
        // Send connection confirmation with game info
        this.sendToDebugOverlay({
            type: 'debug-connected',
            data: { 
                connected: true,
                gameName: gameName,
                gameUrl: window.location.href
            }
        });
        
        // Send all buffered console messages
        this.messageBuffer.forEach(message => {
            this.sendToDebugOverlay(message);
        });
        this.messageBuffer = []; // Clear buffer after sending
        
        // Send initial hierarchy
        if (data.requestHierarchy) {
            this.sendHierarchy();
        }
        
        // Start performance monitoring
        if (data.requestPerformance) {
            this.sendPerformanceData();
        }
        
        this.debugLog('info', 'Runtime editor connected to:', gameName);
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
            this.sendConsoleMessage('info', 'Game paused by runtime editor');
        }
    }

    resumeGame() {
        if (this.isPaused) {
            this.app.timeScale = this.originalTimeScale;
            this.isPaused = false;
            this.sendConsoleMessage('info', 'Game resumed by runtime editor');
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

    setDebugLogLevel(logLevel) {
        this.debugLogLevel = logLevel;
        this.debugLog('info', `Debug log level set to: ${logLevel}`);
    }

    shouldDebugLog(level) {
        if (this.debugLogLevel === 'none') return false;
        
        const levels = ['none', 'error', 'warn', 'info', 'debug'];
        const currentIndex = levels.indexOf(this.debugLogLevel);
        const messageIndex = levels.indexOf(level);
        
        return messageIndex <= currentIndex && currentIndex > 0;
    }

    debugLog(level, message, ...args) {
        if (this.shouldDebugLog(level)) {
            const prefix = 'PlayCanvas Debug:';
            switch (level) {
                case 'error':
                    console.error(prefix, message, ...args);
                    break;
                case 'warn':
                    console.warn(prefix, message, ...args);
                    break;
                case 'info':
                    console.info(prefix, message, ...args);
                    break;
                case 'debug':
                    console.log(prefix, message, ...args);
                    break;
            }
        }
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

    updateEntityTransform(entityGuid, transformType, value) {
        const entity = this.findEntityByGuid(this.app.root, entityGuid);
        if (entity) {
            try {
                switch (transformType) {
                    case 'position':
                        entity.setPosition(value.x, value.y, value.z);
                        this.sendConsoleMessage('info', `Updated ${entity.name} position to (${value.x.toFixed(3)}, ${value.y.toFixed(3)}, ${value.z.toFixed(3)})`);
                        break;
                    case 'rotation':
                        entity.setEulerAngles(value.x, value.y, value.z);
                        this.sendConsoleMessage('info', `Updated ${entity.name} rotation to (${value.x.toFixed(3)}, ${value.y.toFixed(3)}, ${value.z.toFixed(3)})`);
                        break;
                    case 'scale':
                        entity.setLocalScale(value.x, value.y, value.z);
                        this.sendConsoleMessage('info', `Updated ${entity.name} scale to (${value.x.toFixed(3)}, ${value.y.toFixed(3)}, ${value.z.toFixed(3)})`);
                        break;
                }
                // Send updated hierarchy to reflect the changes
                this.scheduleHierarchyUpdate('transform-update');
            } catch (error) {
                this.sendConsoleMessage('error', `Failed to update ${entity.name} ${transformType}: ${error.message}`);
            }
        } else {
            this.sendConsoleMessage('warn', `Entity with GUID ${entityGuid} not found for transform update`);
        }
    }

    updateEntityProperty(entityGuid, propertyPath, value) {
        const entity = this.findEntityByGuid(this.app.root, entityGuid);
        if (entity) {
            try {
                // Parse property path (e.g., "name", "enabled", "tags.0")
                const pathParts = propertyPath.split('.');
                let target = entity;
                
                // Navigate to the parent of the final property
                for (let i = 0; i < pathParts.length - 1; i++) {
                    const part = pathParts[i];
                    if (Array.isArray(target)) {
                        target = target[parseInt(part)];
                    } else {
                        target = target[part];
                    }
                    if (!target) {
                        throw new Error(`Property path ${propertyPath} not found`);
                    }
                }
                
                // Set the final property
                const finalProperty = pathParts[pathParts.length - 1];
                if (Array.isArray(target)) {
                    target[parseInt(finalProperty)] = value;
                } else {
                    target[finalProperty] = value;
                }
                
                this.sendConsoleMessage('info', `Updated ${entity.name}.${propertyPath} = ${JSON.stringify(value)}`);
                
                // Send updated hierarchy to reflect the changes
                this.scheduleHierarchyUpdate('property-update');
            } catch (error) {
                this.sendConsoleMessage('error', `Failed to update ${entity.name}.${propertyPath}: ${error.message}`);
            }
        } else {
            this.sendConsoleMessage('warn', `Entity with GUID ${entityGuid} not found for property update`);
        }
    }

    toggleEntityEnabled(entityGuid, enabled) {
        const entity = this.findEntityByGuid(this.app.root, entityGuid);
        if (entity) {
            try {
                entity.enabled = enabled;
                this.sendConsoleMessage('info', `${enabled ? 'Enabled' : 'Disabled'} entity: ${entity.name}`);
                
                // Send updated hierarchy to reflect the changes
                this.scheduleHierarchyUpdate('entity-enable');
            } catch (error) {
                this.sendConsoleMessage('error', `Failed to ${enabled ? 'enable' : 'disable'} ${entity.name}: ${error.message}`);
            }
        } else {
            this.sendConsoleMessage('warn', `Entity with GUID ${entityGuid} not found for enable/disable`);
        }
    }

    sendHierarchy() {
        const hierarchy = this.buildHierarchy(this.app.root);
        this.sendToDebugOverlay({
            type: 'hierarchy',
            data: hierarchy
        });
    }

    // Debounced hierarchy update scheduling
    scheduleHierarchyUpdate(source = 'unknown') {
        if (!this.isConnected) return;
        
        // Clear existing timer to prevent multiple rapid updates
        if (this.hierarchyUpdateDebounceTimer) {
            clearTimeout(this.hierarchyUpdateDebounceTimer);
        }
        
        // Schedule update after debounce delay
        this.hierarchyUpdateDebounceTimer = setTimeout(() => {
            this.checkHierarchyChanges(source);
            this.hierarchyUpdateDebounceTimer = null;
        }, this.hierarchyUpdateDelay);
    }
    
    checkHierarchyChanges(source = 'unknown') {
        if (!this.isConnected) return;
        
        // Create a simple hash of the hierarchy structure to detect changes
        const currentHash = this.getHierarchyHash(this.app.root);
        
        if (this.lastHierarchyHash !== currentHash) {
            this.lastHierarchyHash = currentHash;
            this.debugLog('debug', `Hierarchy updated from ${source}, hash: ${currentHash.substring(0, 20)}...`);
            this.sendHierarchy();
        } else {
            this.debugLog('debug', `No hierarchy changes detected from: ${source}`);
        }
    }
    
    getHierarchyHash(entity) {
        // Create a simple hash based on hierarchy structure and key properties
        let hash = `${entity.name}:${entity.enabled}:${entity.children.length}`;
        
        // Include position/rotation/scale changes for dynamic updates
        if (entity.getPosition) {
            const pos = entity.getPosition();
            hash += `:pos${Math.round(pos.x*10)}${Math.round(pos.y*10)}${Math.round(pos.z*10)}`;
        }
        
        // Include component states
        const componentTypes = ['model', 'camera', 'light', 'script', 'rigidbody', 'collision', 'sound', 'animation'];
        componentTypes.forEach(type => {
            if (entity[type]) {
                hash += `:${type}${entity[type].enabled}`;
            }
        });
        
        // Recursively include children
        for (let i = 0; i < entity.children.length; i++) {
            hash += `|${this.getHierarchyHash(entity.children[i])}`;
        }
        
        return hash;
    }
    
    setupHierarchyEventListeners() {
        try {
            // Clean up any existing event listeners first
            this.cleanupEntityEventListeners();
            
            // Listen for entity creation/destruction events
            if (this.app.root) {
                this.setupEntityEventListeners(this.app.root);
            }
            
            // Only set up scene event listeners if they haven't been set up already
            if (!this.sceneEventListenersSetup) {
                // Listen for scene changes if available (check multiple possible APIs)
                if (this.app.scenes && typeof this.app.scenes.on === 'function') {
                    this.app.scenes.on('load', () => {
                        this.sendConsoleMessage('info', 'Scene loaded');
                        // Clean up old listeners and set up new ones for the new scene
                        setTimeout(() => {
                            this.setupEntityEventListeners(this.app.root);
                            this.scheduleHierarchyUpdate('scene-load');
                        }, 100);
                    });
                    this.sceneEventListenersSetup = true;
                } else if (this.app.scene && typeof this.app.scene.on === 'function') {
                    // Alternative API for scene events
                    this.app.scene.on('load', () => {
                        this.sendConsoleMessage('info', 'Scene loaded');
                        // Clean up old listeners and set up new ones for the new scene
                        setTimeout(() => {
                            this.setupEntityEventListeners(this.app.root);
                            this.scheduleHierarchyUpdate('scene-load');
                        }, 100);
                    });
                    this.sceneEventListenersSetup = true;
                } else {
                    this.debugLog('warn', 'Scene event listeners not available, using polling only');
                }
            }
        } catch (error) {
            console.warn('PlayCanvas Debug: Error setting up hierarchy event listeners:', error);
            // Continue without scene event listeners - polling will still work
        }
    }
    
    // Clean up all tracked event listeners
    cleanupEntityEventListeners() {
        for (const [entity, listeners] of this.entityEventListeners) {
            if (entity && typeof entity.off === 'function') {
                for (const [eventName, callback] of listeners) {
                    try {
                        entity.off(eventName, callback);
                    } catch (error) {
                        // Entity might be destroyed, ignore cleanup errors
                    }
                }
            }
        }
        this.entityEventListeners.clear();
    }
    
    setupEntityEventListeners(entity) {
        try {
            // Listen for child added/removed events on entities
            if (entity && typeof entity.on === 'function') {
                const listeners = new Map();
                
                // Create callback functions that use debounced updates
                const childAddCallback = () => {
                    this.scheduleHierarchyUpdate('child-add');
                };
                const childRemoveCallback = () => {
                    this.scheduleHierarchyUpdate('child-remove');
                };
                const enableCallback = () => {
                    this.scheduleHierarchyUpdate('entity-enable');
                };
                const disableCallback = () => {
                    this.scheduleHierarchyUpdate('entity-disable');
                };
                
                // Set up event listeners
                entity.on('child:add', childAddCallback);
                entity.on('child:remove', childRemoveCallback);
                entity.on('enable', enableCallback);
                entity.on('disable', disableCallback);
                
                // Track listeners for cleanup
                listeners.set('child:add', childAddCallback);
                listeners.set('child:remove', childRemoveCallback);
                listeners.set('enable', enableCallback);
                listeners.set('disable', disableCallback);
                
                this.entityEventListeners.set(entity, listeners);
            }
            
            // Recursively set up listeners for all children
            if (entity && entity.children) {
                for (let i = 0; i < entity.children.length; i++) {
                    this.setupEntityEventListeners(entity.children[i]);
                }
            }
        } catch (error) {
            console.warn('PlayCanvas Debug: Error setting up entity event listeners for', entity?.name || 'unknown entity', error);
            // Continue without event listeners for this entity
        }
    }

    buildHierarchy(entity) {
        const children = [];
        for (let i = 0; i < entity.children.length; i++) {
            const child = entity.children[i];
            
            // Skip system-generated entities (like text mesh children)
            if (this.isSystemGeneratedEntity(child)) {
                continue;
            }
            
            children.push(this.buildHierarchy(child));
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
            guid: entity.getGuid ? entity.getGuid() : (entity._guid || entity.name + '_' + Math.random().toString(36).substr(2, 9)),
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

    isSystemGeneratedEntity(entity) {
        // Check if entity is system-generated (like text mesh children)
        
        // 1. Entities without proper names (empty, "Untitled", or auto-generated)
        if (!entity.name || entity.name === '' || entity.name === 'Untitled') {
            return true;
        }
        
        // 2. Entities that are children of text elements and have mesh components
        // (these are typically the auto-generated text rendering meshes)
        if (entity.parent && entity.parent.element && entity.parent.element.type === 'text' && entity.model) {
            return true;
        }
        
        // 3. Check for internal PlayCanvas naming patterns
        if (entity.name.startsWith('_') || entity.name.includes('__')) {
            return true;
        }
        
        // 4. Entities with only mesh/render components and no user components
        const hasOnlyRenderingComponents = entity.model && !entity.script && !entity.sound && !entity.light && !entity.camera && !entity.collision && !entity.rigidbody;
        const isChildOfUIElement = entity.parent && entity.parent.element;
        
        if (hasOnlyRenderingComponents && isChildOfUIElement) {
            return true;
        }
        
        return false;
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
        const consoleData = {
            type: 'console',
            data: {
                type: type,
                message: message,
                timestamp: new Date(),
                source: source
            }
        };

        if (this.isConnected) {
            this.sendToDebugOverlay(consoleData);
        } else {
            // Buffer the message for when runtime editor connects
            this.messageBuffer.push(consoleData);
            
            // Limit buffer size to prevent memory issues
            if (this.messageBuffer.length > this.maxBufferSize) {
                this.messageBuffer.shift(); // Remove oldest message
            }
        }
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

    restoreConsole() {
        // Restore original console methods
        if (this.originalConsole.log) {
            console.log = this.originalConsole.log;
            console.warn = this.originalConsole.warn;
            console.error = this.originalConsole.error;
            console.info = this.originalConsole.info;
            console.debug = this.originalConsole.debug;
        }
    }

    destroy() {
        try {
            this.isConnected = false;
            
            // Clear timers
            if (this.performanceTimer) {
                clearInterval(this.performanceTimer);
                this.performanceTimer = null;
            }
            
            if (this.hierarchyTimer) {
                clearInterval(this.hierarchyTimer);
                this.hierarchyTimer = null;
            }
            
            // Clear debounce timer
            if (this.hierarchyUpdateDebounceTimer) {
                clearTimeout(this.hierarchyUpdateDebounceTimer);
                this.hierarchyUpdateDebounceTimer = null;
            }
            
            // Clean up all event listeners
            this.cleanupEntityEventListeners();
            
            // Reset scene event listeners flag
            this.sceneEventListenersSetup = false;
            
            // Restore original console
            this.restoreConsole();
            
            // Remove message listener
            window.removeEventListener('message', this.handleDebugMessage);
            

        } catch (error) {
            console.error('Error during debug interface destruction:', error);
        }
    }
}

// Auto-initialize console interception immediately if we're in an iframe
if (window.self !== window.top) {
    // We're in an iframe (likely the runtime editor), set up console interception early
    const earlyDebugInterface = {
        originalConsole: {},
        messageBuffer: [],
        maxBufferSize: 100,
        isConnected: false,
        
        interceptConsole() {
            // Store original console methods
            this.originalConsole = {
                log: console.log.bind(console),
                warn: console.warn.bind(console),
                error: console.error.bind(console),
                info: console.info.bind(console),
                debug: console.debug.bind(console)
            };

            // Override console methods to route to runtime editor
            console.log = (...args) => {
                this.originalConsole.log(...args);
                this.bufferMessage('log', args.join(' '), 'Console');
            };

            console.warn = (...args) => {
                this.originalConsole.warn(...args);
                this.bufferMessage('warn', args.join(' '), 'Console');
            };

            console.error = (...args) => {
                this.originalConsole.error(...args);
                this.bufferMessage('error', args.join(' '), 'Console');
            };

            console.info = (...args) => {
                this.originalConsole.info(...args);
                this.bufferMessage('info', args.join(' '), 'Console');
            };

            console.debug = (...args) => {
                this.originalConsole.debug(...args);
                this.bufferMessage('log', args.join(' '), 'Console');
            };
        },
        
        bufferMessage(type, message, source) {
            this.messageBuffer.push({
                type: 'console',
                data: {
                    type: type,
                    message: message,
                    timestamp: new Date(),
                    source: source
                }
            });
            
            if (this.messageBuffer.length > this.maxBufferSize) {
                this.messageBuffer.shift();
            }
        }
    };
    
    // Intercept console immediately
    earlyDebugInterface.interceptConsole();
    window.earlyDebugInterface = earlyDebugInterface;
}

// Auto-initialize if PlayCanvas app is available
if (typeof pc !== 'undefined' && window.pc && window.pc.Application) {
    // Function to try initializing the debug interface
    function tryInitializeDebugInterface() {
        if (window.app || window.game || window.pcApp) {
            const appInstance = window.app || window.game?.app || window.pcApp;
            if (appInstance) {
                window.debugInterface = new PlayCanvasDebugInterface(appInstance);
                
                // Transfer early buffered messages if they exist
                if (window.earlyDebugInterface && window.earlyDebugInterface.messageBuffer) {
                    window.debugInterface.messageBuffer = [
                        ...window.earlyDebugInterface.messageBuffer,
                        ...window.debugInterface.messageBuffer
                    ];
                    window.earlyDebugInterface = null; // Clean up
                }
                
                return true;
            }
        }
        return false;
    }
    
    // Wait for app initialization
    document.addEventListener('DOMContentLoaded', () => {
        // Try immediate initialization
        if (tryInitializeDebugInterface()) {
            return;
        }
        
        // If not available immediately, set up a watcher
        let attempts = 0;
        const maxAttempts = 50; // 10 seconds max
        const checkInterval = setInterval(() => {
            attempts++;
            
            if (tryInitializeDebugInterface()) {
                clearInterval(checkInterval);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.warn('PlayCanvas app instance not found after waiting. Initialize debug interface manually with: new PlayCanvasDebugInterface(yourAppInstance)');
            }
        }, 200); // Check every 200ms
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