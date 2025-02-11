'use strict';

// Check if color scheme manager is already initialized to prevent duplicate initialization
if (window.colorSchemeInitialized) {
    console.log('Color scheme manager already initialized');
} else {
    window.colorSchemeInitialized = true;

// Utility object for security-related functions
const SecurityUtils = {
    // Validates and sanitizes user settings to prevent malicious inputs
    sanitizeSettings(settings) {
        return {
            colorScheme: ['default', 'greyscale', 'sepia', 'highContrast', 'darkMode', 'custom']
                .includes(settings.colorScheme) ? settings.colorScheme : 'default',
            brightnessLevel: Math.max(50, Math.min(150, parseInt(settings.brightnessLevel) || 100)),
            textSize: Math.max(50, Math.min(200, parseInt(settings.textSize) || 100)),
            textColor: /^#[0-9A-F]{6}$/i.test(settings.textColor) ? settings.textColor : '',
            backgroundColor: /^#[0-9A-F]{6}$/i.test(settings.backgroundColor) ?
                settings.backgroundColor : '',
            transitionSpeed: parseFloat(settings.transitionSpeed) || 0.3,
            overlayDuration: parseFloat(settings.overlayDuration) || 0.3,
            protectionEnabled: !!settings.protectionEnabled
        };
    },

    // Sanitizing string inputs
    sanitizeString(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // Validates hostname format to ensure it matches expected pattern
    validateHostname(hostname) {
        return /^[a-zA-Z0-9-_.]+$/.test(hostname) ? hostname : 'invalid';
    }
};

// Main manager for handling color scheme functionality
const ColorSchemeManager = {
    // Default settings when no user preferences are set
    defaultSettings: {
        colorScheme: 'default',
        brightnessLevel: 100,
        textSize: 100,
        textColor: '',
        backgroundColor: '',
        transitionSpeed: 300, // Default 300ms transition
        overlayDuration: 300
    },

    // Predefined color schemes for quick application
    predefinedSchemes: {
        darkMode: {
            colorScheme: 'darkMode',
            textColor: '#FFFFFF',
            backgroundColor: '#1E1E1E'
            // Removed brightnessLevel and textSize to use user settings
        },
        custom: {
            colorScheme: 'custom',
            brightnessLevel: 100,
            textSize: 100,
            textColor: '#000000',
            backgroundColor: '#FFFFFF'
        }
    },

    // Initialize the color scheme manager
    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeManager());
        } else {
            this.initializeManager();
        }
    },

    // Sets up all necessary listeners and initial state
    initializeManager() {
        this.loadAndApplySettings();
        this.listenForMessages();
        this.setupNavigationListener();
        this.setupMutationObserver();
    },

    // Monitors navigation events to reapply settings on page changes
    setupNavigationListener() {
        // Update navigation event listeners
        ['popstate', 'pushState', 'replaceState'].forEach(eventType => {
            window.addEventListener(eventType, () => {
                const domain = window.location.hostname;
                // Send navigation event to background script
                chrome.runtime.sendMessage({
                    action: 'navigationOccurred',
                    domain: domain,
                    url: window.location.href
                }, (response) => {
                    if (response?.settings) {
                        this.applySettings(response.settings);
                    }
                });
            });
        });

        // Monitor history API changes
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function() {
            originalPushState.apply(this, arguments);
            window.dispatchEvent(new Event('pushState'));
        };

        history.replaceState = function() {
            originalReplaceState.apply(this, arguments);
            window.dispatchEvent(new Event('replaceState'));
        };
    },

    // Watches for DOM changes that might indicate page navigation
    setupMutationObserver() {
        let lastUrl = window.location.href;
        const observer = new MutationObserver(() => {
            if (lastUrl !== window.location.href) {
                lastUrl = window.location.href;
                this.loadAndApplySettings();
            }
        });

        observer.observe(document, {
            subtree: true,
            childList: true
        });
    },

    // Retrieves and applies stored settings from both session and chrome storage
    loadAndApplySettings() {
        try {
            const hostname = SecurityUtils.validateHostname(window.location.hostname);
            if (hostname === 'invalid') {
                throw new Error('Invalid hostname detected');
            }

            // Check sessionStorage first for better performance
            const storedSettings = sessionStorage.getItem(`colorScheme_${hostname}`);
            if (storedSettings) {
                try {
                    const parsedSettings = JSON.parse(storedSettings);
                    const sanitizedSettings = SecurityUtils.sanitizeSettings(parsedSettings);
                    this.applySettings(sanitizedSettings);
                } catch (parseError) {
                    console.error('Invalid stored settings:', parseError);
                    sessionStorage.removeItem(`colorScheme_${hostname}`);
                }
            }

            // Check chrome.storage.sync for updated settings
            chrome.storage.sync.get([
                `domain_${hostname}`,
                'globalSettings'
            ], (data) => {
                if (chrome.runtime.lastError) {
                    console.error('Storage error:', chrome.runtime.lastError);
                    return;
                }

                let settings = data[`domain_${hostname}`] ||
                              data.globalSettings ||
                              this.defaultSettings;

                settings = SecurityUtils.sanitizeSettings(settings);

                this.applySettings(settings);

                try {
                    sessionStorage.setItem(`colorScheme_${hostname}`, JSON.stringify(settings));
                } catch (storageError) {
                    console.error('Session storage error:', storageError);
                }
            });
        } catch (error) {
            this.handleError(error);
        }
    },

    // Applies color scheme settings to the webpage with smooth transitions
    applySettings(settings) {
        try {
            if (!document.documentElement || !document.body) return false;

            // Always get latest protection settings from storage first
            chrome.storage.sync.get(['protectionSettings'], (data) => {
                const protectionSettings = data.protectionSettings || {};
                const sanitizedSettings = SecurityUtils.sanitizeSettings({
                    ...settings,
                    protectionEnabled: protectionSettings.protectionEnabled ?? settings.protectionEnabled,
                    transitionSpeed: protectionSettings.transitionSpeed ?? settings.transitionSpeed,
                    overlayDuration: protectionSettings.overlayDuration ?? settings.overlayDuration
                });

                // Set transition time based on protection state
                const transitionTime = sanitizedSettings.protectionEnabled ?
                    `${sanitizedSettings.transitionSpeed}s` : '0.3s';

                // Apply transitions
                const transitions = `
                    filter ${transitionTime} ease,
                    font-size ${transitionTime} ease,
                    background-color ${transitionTime} ease,
                    color ${transitionTime} ease
                `;

                document.documentElement.style.transition = transitions;
                document.body.style.transition = `
                    background-color ${transitionTime} ease,
                    color ${transitionTime} ease
                `;

                // Only create overlay if protection is explicitly enabled
                if (sanitizedSettings.protectionEnabled === true) {
                    const overlayDuration = `${sanitizedSettings.overlayDuration}s`;
                    this.createProtectionOverlay(transitionTime, overlayDuration, sanitizedSettings);
                }

                // Colour scheme application
                requestAnimationFrame(() => {
                    let filterString = '';
                    switch (sanitizedSettings.colorScheme) {
                        case 'greyscale':
                            filterString = 'grayscale(1) ';
                            break;
                        case 'sepia':
                            filterString = 'sepia(1) ';
                            break;
                        case 'highContrast':
                            filterString = 'contrast(1.5) ';
                            break;
                        case 'darkMode':
                            document.body.style.backgroundColor = '#1E1E1E';
                            document.body.style.color = '#FFFFFF';
                            break;
                        case 'custom':
                            if (sanitizedSettings.backgroundColor) {
                                document.body.style.backgroundColor = sanitizedSettings.backgroundColor;
                            }
                            if (sanitizedSettings.textColor) {
                                document.body.style.color = sanitizedSettings.textColor;
                            }
                            break;
                        default:
                            document.body.style.backgroundColor = '';
                            document.body.style.color = '';
                            break;
                    }

                    // Apply brightness
                    if (sanitizedSettings.brightnessLevel !== 100) {
                        filterString += `brightness(${sanitizedSettings.brightnessLevel / 100})`;
                    }

                    document.documentElement.style.filter = filterString;
                    document.documentElement.style.fontSize = `${sanitizedSettings.textSize}%`;
                });

                return true;
            });
        } catch (error) {
            this.handleError(error);
            return false;
        }
    },

    createProtectionOverlay(transitionTime, overlayDuration, settings) {
        // Remove any existing overlay first
        const existingOverlay = document.getElementById('color-scheme-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        // Create new overlay only if protection is enabled
        if (settings.protectionEnabled) {
            const overlay = document.createElement('div');
            overlay.id = 'color-scheme-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: ${settings.colorScheme === 'darkMode' ? '#1E1E1E' : '#FFFFFF'};
                opacity: 0;
                pointer-events: none;
                z-index: 2147483647;
                transition: opacity ${transitionTime} ease;
            `;
            document.body.appendChild(overlay);

            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                setTimeout(() => {
                    overlay.style.opacity = '0';
                    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
                }, parseFloat(overlayDuration) * 1000);
            });
        }
    },

    resetSettings() {
        try {
            const hostname = window.location.hostname;
            const transitionTime = '0.3s';

            // Create overlay for reset transition
            const overlay = document.createElement('div');
            overlay.id = 'color-scheme-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: #FFFFFF;
                opacity: 0;
                pointer-events: none;
                z-index: 2147483647;
                transition: opacity ${transitionTime} ease;
            `;
            document.body.appendChild(overlay);

            // Fade in overlay
            requestAnimationFrame(() => {
                overlay.style.opacity = '1';

                setTimeout(() => {
                    document.documentElement.style.transition = '';
                    document.body.style.transition = '';
                    document.documentElement.style.filter = '';
                    document.documentElement.style.fontSize = '';
                    document.body.style.color = '';
                    document.body.style.backgroundColor = '';

                    // Fade out overlay
                    setTimeout(() => {
                        overlay.style.opacity = '0';
                        setTimeout(() => overlay.remove(), 300);
                    }, 50);
                }, 50);
            });

            sessionStorage.removeItem(`colorScheme_${hostname}`);
            chrome.storage.sync.remove(`domain_${hostname}`);
            return true;
        } catch (error) {
            console.error('Error resetting settings:', error);
            return false;
        }
    },

    // Handles and logs errors, falling back to default settings if needed
    handleError(error, context = '') {
    console.error(`ColorSchemeManager Error ${context}:`, error);

    if (chrome.runtime?.id) {
        chrome.runtime.sendMessage({
            action: 'logError',
            error: {
                message: error.message,
                context: context,
                timestamp: new Date().toISOString(),
                url: SecurityUtils.sanitizeString(window.location.href)
            }
        });
    }

    if (context === 'applySettings') {
        this.applySettings(this.defaultSettings);
    }
},

    // Listens for messages from the background script
    listenForMessages() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            try {
                if (!sender.id || sender.id !== chrome.runtime.id) {
                    throw new Error('Invalid message source');
                }

                const hostname = SecurityUtils.validateHostname(window.location.hostname);
                if (hostname === 'invalid') {
                    throw new Error('Invalid hostname');
                }

                // Add immediate response to prevent connection loss
                const respond = (response) => {
                    try {
                        sendResponse(response);
                    } catch (error) {
                        console.error('Response error:', error);
                    }
                };

                switch (message.action) {
                    case 'updateColorScheme':
                        if (!message.settings) {
                            respond({ success: false, error: 'Missing settings in message' });
                            return true;
                        }

                        const sanitizedSettings = SecurityUtils.sanitizeSettings(message.settings);

                        // Apply settings and handle response immediately
                        Promise.resolve(this.applySettings(sanitizedSettings))
                            .then(result => {
                                if (result) {
                                    chrome.storage.sync.set({
                                        [`domain_${hostname}`]: sanitizedSettings
                                    }, () => {
                                        respond({ success: true });
                                    });
                                } else {
                                    respond({ success: false, error: 'Failed to apply settings' });
                                }
                            })
                            .catch(error => {
                                respond({ success: false, error: error.message });
                            });
                        break;

                    case 'resetSettings':
                        const resetSuccess = this.resetSettings();
                        sendResponse({ success: resetSuccess });
                        break;

                    case 'updateProtectionSettings':
                        // Store settings and apply immediately
                        chrome.storage.sync.set({ protectionSettings: message.settings }, () => {
                            const success = this.applySettings({
                                ...this.defaultSettings,
                                ...message.settings
                            });
                            sendResponse({ success });
                        });
                        break;

                    default:
                        sendResponse({ success: false, error: 'Unknown action' });
                }
            } catch (error) {
                this.handleError(error, 'messageHandler');
                sendResponse({ success: false, error: error.message });
                return true;
            }
            return true; // Keep channel open for async response
        });
    },
};

// Initialize the color scheme manager when the DOM is ready
if (document.documentElement && document.body) {
    ColorSchemeManager.init();
} else {
    window.addEventListener('load', () => ColorSchemeManager.init());
}}