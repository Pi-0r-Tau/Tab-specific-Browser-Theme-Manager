'use strict';

const activeTabs = new Map();

// Ratelimiting utility
const StorageManager = {
    queue: [],
    processing: false,
    lastWrite: 0,
    THROTTLE_MS: 2000, // Minimum time between writes
    MAX_BATCH_SIZE: 5, // Maximum number of operations to batch
    writeTimeout: null,

    async write(key, value) {
        return new Promise((resolve, reject) => {
            this.queue.push({ key, value, resolve, reject });
            this.scheduleProcessing();
        });
    },

    scheduleProcessing() {
        if (this.writeTimeout) {
            clearTimeout(this.writeTimeout);
        }

        this.writeTimeout = setTimeout(() => {
            this.processQueue();
        }, Math.max(0, this.THROTTLE_MS - (Date.now() - this.lastWrite)));
    },

    async processQueue() {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;
        const batch = {};
        const operations = this.queue.splice(0, this.MAX_BATCH_SIZE);

        operations.forEach(op => {
            batch[op.key] = op.value;
        });

        try {
            await chrome.storage.sync.set(batch);
            this.lastWrite = Date.now();
            operations.forEach(op => op.resolve());
        } catch (error) {
            operations.forEach(op => op.reject(error));
        } finally {
            this.processing = false;
            if (this.queue.length > 0) {
                this.scheduleProcessing();
            }
        }
    },

    // Clear the queue and cancel pending operations
    clearQueue() {
        this.queue.forEach(op => op.reject(new Error('Queue cleared')));
        this.queue = [];
        if (this.writeTimeout) {
            clearTimeout(this.writeTimeout);
            this.writeTimeout = null;
        }
    }
};

chrome.runtime.onInstalled.addListener(() => {
    // Initialize with default settings
    chrome.storage.sync.set({
        colorScheme: 'default',
        brightnessLevel: 100
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'setColorScheme') {
        const { tabId, colorScheme } = request;
        activeTabs.set(tabId, {
            ...activeTabs.get(tabId),
            colorScheme
        });
        StorageManager.write('colorScheme', colorScheme)
            .then(() => sendResponse({ status: 'success' }))
            .catch(error => sendResponse({ status: 'error', error }));
        return true;
    } else if (request.action === 'getColorScheme') {
        const settings = activeTabs.get(sender.tab.id) || { colorScheme: 'default' };
        sendResponse({ colorScheme: settings.colorScheme });
    } else if (request.action === 'setBrightness') {
        const { tabId, brightnessLevel } = request;
        activeTabs.set(tabId, {
            ...activeTabs.get(tabId),
            brightnessLevel
        });
        StorageManager.write('brightnessLevel', brightnessLevel)
            .then(() => sendResponse({ status: 'success' }))
            .catch(error => sendResponse({ status: 'error', error }));
        return true;
    } else if (request.action === 'getSettings') {
        const settings = activeTabs.get(sender.tab.id) || {
            colorScheme: 'default',
            brightnessLevel: 100
        };
        sendResponse(settings);
    } else if (request.action === 'navigationOccurred') {
        handleNavigation(request, sender.tab.id).then(response => {
            sendResponse(response);
        });

    }
    return true; // Keep message channel open for async response
});

// Update to handleNavigation function to better handle locked settings
async function handleNavigation(request, tabId) {
    try {
        const domain = request.domain;
        if (!domain) return { success: false };

        const data = await chrome.storage.sync.get([
            'lockSettings',
            'currentScheme',
            'globalSettings',
            'protectionSettings',
            `domain_${domain}` // Get domain-specific settings
        ]);

        let settings;

        // Priority order:
        // 1. Locked settings
        // 2. Domain-specific settings
        // 3. Global settings
        // 4. Default settings
        if (data.lockSettings && data.currentScheme) {
            settings = data.currentScheme;
        } else {
            settings = data[`domain_${domain}`] || data.globalSettings || {
                colorScheme: 'default',
                brightnessLevel: 100,
                textSize: 100
            };
        }

        // Merge protection settings if they exist
        if (data.protectionSettings) {
            settings = {
                ...settings,
                protectionEnabled: data.protectionSettings.protectionEnabled,
                transitionSpeed: data.protectionSettings.transitionSpeed,
                overlayDuration: data.protectionSettings.overlayDuration
            };
        }

        // Store settings for this domain if they don't already exist
        if (!data[`domain_${domain}`] && !data.lockSettings) {
            await StorageManager.write(`domain_${domain}`, settings);
        }

        return { success: true, settings };
    } catch (error) {
        console.error('Navigation handling error:', error);
        return { success: false, error: error.message };
    }
}

function getDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (error) {
        return null;
    }
}

chrome.tabs.onCreated.addListener(async (tab) => {
    // Wait for tab to be ready
    const checkTab = async () => {
        const currentTab = await chrome.tabs.get(tab.id);

        // Skip if tab doesn't exist or is a browser page
        if (!currentTab?.url ||
            currentTab.url.startsWith('chrome://') ||
            currentTab.url.startsWith('edge://')) {
            return;
        }

        const domain = getDomain(currentTab.url);
        if (!domain) return;

        try {
            const data = await chrome.storage.sync.get([
                'lockSettings',
                'currentScheme',
                'globalSettings'
            ]);

            let settings = null;

            // Priority: locked settings > domain settings > global settings
            if (data.lockSettings && data.currentScheme) {
                settings = data.currentScheme;
                // Store locked settings for this domain
                await StorageManager.write(`domain_${domain}`, settings);
            } else {
                const domainData = await chrome.storage.sync.get(`domain_${domain}`);
                settings = domainData[`domain_${domain}`] || data.globalSettings;
            }

            if (settings) {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['src/content.js']
                });

                chrome.tabs.sendMessage(tab.id, {
                    action: 'updateColorScheme',
                    settings: settings
                });
            }
        } catch (error) {
            console.error('Error applying settings to new tab:', error);
        }
    };

    // Check until tab is ready
    const checkInterval = setInterval(async () => {
        const currentTab = await chrome.tabs.get(tab.id).catch(() => null);
        if (currentTab?.url && !currentTab.url.startsWith('about:blank')) {
            clearInterval(checkInterval);
            checkTab();
        }
    }, 100);

    // Clear interval after 10 seconds to prevent endless checking
    setTimeout(() => clearInterval(checkInterval), 10000);
});

// Update to tabs.onUpdated listener to handle same-domain navigation
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tab.url) {
        const domain = getDomain(tab.url);
        if (!domain) return;

        try {
            const response = await handleNavigation({ domain }, tabId);
            if (response.success && response.settings) {
                // Small delay to ensure content script is ready
                setTimeout(async () => {
                    try {
                        await chrome.tabs.sendMessage(tabId, {
                            action: 'updateColorScheme',
                            settings: response.settings
                        });
                    } catch (error) {
                        // If content script isn't ready, inject it and try again
                        await chrome.scripting.executeScript({
                            target: { tabId },
                            files: ['src/content.js']
                        });
                        setTimeout(() => {
                            chrome.tabs.sendMessage(tabId, {
                                action: 'updateColorScheme',
                                settings: response.settings
                            });
                        }, 100);
                    }
                }, 50);
            }
        } catch (error) {
            console.error('Error handling tab update:', error);
        }
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    activeTabs.delete(tabId);
});
