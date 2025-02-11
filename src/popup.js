'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const DEFAULT_SETTINGS = {
        colorScheme: 'default',
        brightnessLevel: 100,
        textSize: 100,
        textColor: '#000000',
        backgroundColor: '#FFFFFF',
        lockSettings: false,
        transitionSpeed: 0.3,
        overlayDuration: 0.3,
        protectionEnabled: false,  // Ensure protection is off by default
    };

    const controls = {
        // General controls
        colorScheme: document.getElementById('color-scheme'),
        brightness: document.getElementById('brightness-level'),
        brightnessValue: document.getElementById('brightness-value'),
        textSize: document.getElementById('text-size'),
        textSizeValue: document.getElementById('text-size-value'),
        textColor: document.getElementById('text-color'),
        backgroundColor: document.getElementById('background-color'),
        applyButton: document.getElementById('apply-settings'),
        resetButton: document.getElementById('reset-settings'),
        customControls: document.getElementById('custom-controls'),
        lockSettings: document.getElementById('lock-settings'),
        transitionSpeed: document.getElementById('transition-speed'),
        transitionSpeedValue: document.getElementById('transition-speed-value'),
        overlayDuration: document.getElementById('overlay-duration'),
        overlayDurationValue: document.getElementById('overlay-duration-value'),

        // Tab-specific controls
        tabContainer: document.getElementById('tabs-container'),
        tabName: document.getElementById('tab-name'),
        tabColorScheme: document.getElementById('tab-color-scheme'),
        tabBrightness: document.getElementById('tab-brightness'),
        tabBrightnessValue: document.getElementById('tab-brightness-value'),
        tabTextSize: document.getElementById('tab-text-size'),
        tabTextSizeValue: document.getElementById('tab-text-size-value'),
        tabTextColor: document.getElementById('tab-text-color'),
        tabBackgroundColor: document.getElementById('tab-background-color'),
        tabCustomControls: document.getElementById('tab-custom-controls'),
        saveTabButton: document.getElementById('save-tab-settings'),
        resetTabButton: document.getElementById('reset-tab-settings'),

        status: document.getElementById('status')
    };

    function sanitizeSettings(settings) {
        return {
            colorScheme: ['default', 'greyscale', 'sepia', 'highContrast', 'darkMode', 'custom']
                .includes(settings.colorScheme) ? settings.colorScheme : 'default',
            brightnessLevel: Math.max(50, Math.min(150, parseInt(settings.brightnessLevel, 10) || 100)),
            textSize: Math.max(80, Math.min(200, parseInt(settings.textSize, 10) || 100)),
            textColor: /^#[0-9A-F]{6}$/i.test(settings.textColor) ? settings.textColor : DEFAULT_SETTINGS.textColor,
            backgroundColor: /^#[0-9A-F]{6}$/i.test(settings.backgroundColor) ?
                settings.backgroundColor : DEFAULT_SETTINGS.backgroundColor,
            transitionSpeed: Math.max(0, Math.min(2000, parseInt(settings.transitionSpeed, 10) || 300)),
            overlayDuration: Math.max(0, Math.min(2000, parseInt(settings.overlayDuration, 10) || 300)),
        };
    }

    function showStatus(message, isError = false) {
        controls.status.textContent = message;
        controls.status.className = `status ${isError ? 'error' : 'success'}`;
        controls.status.setAttribute('role', 'alert');
        setTimeout(() => {
            controls.status.textContent = '';
            controls.status.className = 'status';
        }, 3000);
    }

    function updateCustomControlsVisibility(colorScheme, controlsElement) {
        // First check if controlsElement exists
        if (!controlsElement) return;

        // Handle custom controls visibility
        if (colorScheme === 'custom') {
            controlsElement.classList.remove('hidden');
        } else {
            controlsElement.classList.add('hidden');
        }

        // Get the container ID prefix based on which set of controls to update
        const isTabControls = controlsElement.id === 'tab-custom-controls';
        const prefix = isTabControls ? 'tab-' : '';

        // FIX: Get the brightness and text size controls more reliably
        const brightnessControl = document.getElementById(`${prefix}brightness-level`)?.closest('.control');
        const textSizeControl = document.getElementById(`${prefix}text-size`)?.closest('.control');

        // Only show/hide if the elements exist
        if (brightnessControl) {
            brightnessControl.classList.remove('hidden');
        }
        if (textSizeControl) {
            textSizeControl.classList.remove('hidden');
        }
    }

    async function loadTabs() {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        controls.tabContainer.innerHTML = '';

        for (const tab of tabs) {
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
                continue;
            }

            // Get domain settings
            let domain;
            try {
                domain = new URL(tab.url).hostname;
                if (!/^[a-zA-Z0-9.-]+$/.test(domain)) {
                    throw new Error('Invalid domain');
                }
            } catch (error) {
                console.error('Invalid URL:', error);
                continue;
            }

            const tabElement = document.createElement('div');
            tabElement.className = 'tab-item';
            tabElement.textContent = tab.title || 'Unnamed Tab';
            tabElement.dataset.tabId = tab.id;
            tabElement.dataset.domain = domain;
            tabElement.addEventListener('click', () => selectTab(tab));
            controls.tabContainer.appendChild(tabElement);
        }
    }

    // Add new function to handle tab selection
    async function selectTab(tab) {
        document.querySelectorAll('.tab-item').forEach(item =>
            item.classList.remove('active'));
        const selectedElement = document.querySelector(`[data-tab-id="${tab.id}"]`);
        if (selectedElement) {
            selectedElement.classList.add('active');
        }

        controls.tabName.value = tab.title || 'Unnamed Tab';

        // Get domain settings
        const domain = new URL(tab.url).hostname;
        const data = await chrome.storage.sync.get([
            `domain_${domain}`,
            'lockSettings',
            'globalSettings',
            'protectionSettings'
        ]);

        let settings;
        if (data.lockSettings && data.globalSettings) {
            settings = data.globalSettings;
        } else {
            settings = data[`domain_${domain}`] || data.globalSettings || DEFAULT_SETTINGS;
        }

        // Apply protection settings if they exist
        if (data.protectionSettings) {
            settings = {
                ...settings,
                protectionEnabled: data.protectionSettings.protectionEnabled,
                transitionSpeed: data.protectionSettings.transitionSpeed
            };
        }

        // Update UI
        updateControlsWithSettings(settings);
    }

    async function applySettings() {
        try {
            const settings = getFormattedSettings();
            const tabs = await chrome.tabs.query({ currentWindow: true });
            const validTabs = tabs.filter(tab =>
                tab.url &&
                !tab.url.startsWith('chrome://') &&
                !tab.url.startsWith('edge://')
            );

            // If no valid tabs found
            if (validTabs.length === 0) {
                showStatus('No valid tabs to apply settings to', true);
                return;
            }

            const toggleControl = document.querySelector('.toggle-control');
            const lockSettings = toggleControl?.dataset.active === 'true';
            await chrome.storage.sync.set({ lockSettings });

            let successCount = 0;
            let failCount = 0;

            // Apply to each valid tab
            for (const tab of validTabs) {
                try {
                    await injectContentScript(tab.id);
                    await updateTabSettings(tab.id, settings);
                    successCount++;

                    // Store domain settings
                    const domain = new URL(tab.url).hostname;
                    await chrome.storage.sync.set({
                        [`domain_${domain}`]: settings
                    });
                } catch (error) {
                    console.error(`Error applying settings to tab ${tab.id}:`, error);
                    failCount++;
                }
            }

            // Update global settings if lock is enabled
            if (lockSettings) {
                await chrome.storage.sync.set({ globalSettings: settings });
            }

            // Show status message
            if (failCount === 0) {
                showStatus(`Settings applied to ${successCount} tabs successfully`);
            } else {
                showStatus(`Applied to ${successCount} tabs, failed on ${failCount}`, true);
            }
        } catch (error) {
            console.error('Error:', error);
            showStatus(error.message, true);
        }
    }

    async function applySettingsToAllTabs(settings) {
        // Only query tabs in the current window, matching the Tab Settings list behavior
        const tabs = await chrome.tabs.query({ currentWindow: true });
        let successCount = 0;
        let failCount = 0;
        let skippedCount = 0;

        for (const tab of tabs) {
            // Skip internal pages, matching the loadTabs() filter
            if (tab.url.startsWith('edge://') || tab.url.startsWith('chrome://')) {
                skippedCount++;
                continue;
            }

            try {
                await injectContentScript(tab.id);
                await updateTabSettings(tab.id, settings);
                successCount++;
            } catch (error) {
                console.error(`Error applying settings to tab ${tab.id}:`, error);
                failCount++;
            }
        }

        // Store as global settings for new tabs
        if (successCount > 0) {
            chrome.storage.sync.set({ globalSettings: settings });
        }

        if (failCount === 0) {
            const skippedMessage = skippedCount > 0 ? ` (${skippedCount} internal pages skipped)` : '';
            showStatus(`Applied to ${successCount} tabs successfully${skippedMessage}`);
        } else {
            showStatus(`Applied to ${successCount} tabs, failed on ${failCount} (${skippedCount} skipped)`, true);
        }
    }

    function getFormattedSettings() {
        try {
            const safeGetValue = (element, defaultValue) =>
                element?.value ? element.value : defaultValue;

            const currentColorScheme = safeGetValue(controls.colorScheme, DEFAULT_SETTINGS.colorScheme);
            const currentBrightness = safeGetValue(controls.brightness, DEFAULT_SETTINGS.brightnessLevel);
            const currentTextSize = safeGetValue(controls.textSize, DEFAULT_SETTINGS.textSize);
            const currentTextColor = currentColorScheme === 'custom' ?
                safeGetValue(controls.textColor, DEFAULT_SETTINGS.textColor) : '';
            const currentBgColor = currentColorScheme === 'custom' ?
                safeGetValue(controls.backgroundColor, DEFAULT_SETTINGS.backgroundColor) : '';

            return sanitizeSettings({
                colorScheme: currentColorScheme,
                brightnessLevel: parseInt(currentBrightness),
                textSize: parseInt(currentTextSize),
                textColor: currentTextColor,
                backgroundColor: currentBgColor,
                protectionEnabled: document.querySelector('#accessibility .toggle-control')
                    ?.dataset.active === 'true',
                transitionSpeed: parseFloat(safeGetValue(controls.transitionSpeed, DEFAULT_SETTINGS.transitionSpeed))
            });
        } catch (error) {
            console.error('Error getting formatted settings:', error);
            return DEFAULT_SETTINGS;
        }
    }

    async function getActiveTab() {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]?.id) {
            throw new Error('No active tab found');
        }
        return tabs[0];
    }

    async function injectContentScript(tabId) {
        return chrome.scripting.executeScript({
            target: { tabId },
            files: ['src/content.js']
        }).catch((error) => {
            console.error(`Error injecting content script into tab ${tabId}:`, error);
        });
    }

    async function updateTabSettings(tabId, settings) {
        try {
            // Ensure valid settings before attempting to apply
            if (!settings || typeof settings !== 'object') {
                throw new Error('Invalid settings object');
            }

            // Add retry mechanism for content script injection
            let retries = 3;
            while (retries > 0) {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId },
                        files: ['src/content.js']
                    });
                    break;
                } catch (error) {
                    retries--;
                    if (retries === 0) {
                        console.error('Failed to inject content script:', error);
                    }
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            // Add validation before sending message
            const validatedSettings = {
                colorScheme: settings.colorScheme || 'default',
                brightnessLevel: Math.min(Math.max(parseInt(settings.brightnessLevel) || 100, 50), 150),
                textSize: Math.min(Math.max(parseInt(settings.textSize) || 100, 80), 200),
                textColor: /^#[0-9A-F]{6}$/i.test(settings.textColor) ? settings.textColor : '',
                backgroundColor: /^#[0-9A-F]{6}$/i.test(settings.backgroundColor) ? settings.backgroundColor : '',
                protectionEnabled: !!settings.protectionEnabled,
                transitionSpeed: parseFloat(settings.transitionSpeed) || 0.3
            };

            // Add timeout to message sending
            const response = await Promise.race([
                new Promise((resolve, reject) => {
                    chrome.tabs.sendMessage(tabId, {
                        action: 'updateColorScheme',
                        settings: validatedSettings
                    }, response => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else if (!response?.success) {
                            reject(new Error(response?.error || 'Unknown error'));
                        } else {
                            resolve(response);
                        }
                    });
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Message timeout')), 5000))
            ]);

            if (response.success) {
                await chrome.storage.sync.set({
                    [`tab_${tabId}`]: validatedSettings
                });
                showStatus('Settings applied successfully');
                syncGeneralToTabSettings();
                return response;
            } else {
                throw new Error(response.error || 'Failed to apply settings');
            }
        } catch (error) {
            console.error('Update settings error:', error);
            showStatus(`Failed to apply settings: ${error.message}`, true);
            throw error;
        }
    }

    async function sendMessageWithRetry(tabId, message, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await new Promise((resolve, reject) => {
                    chrome.tabs.sendMessage(tabId, message, response => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else if (!response) {
                            reject(new Error('No response from content script'));
                        } else {
                            resolve(response);
                        }
                    });
                });
            } catch (error) {
                if (attempt === maxRetries) throw error;
                await new Promise(resolve => setTimeout(resolve, 100 * attempt));
            }
        }
    }

    function syncGeneralToTabSettings() {
        const activeTabElement = document.querySelector('.tab-item.active');
        if (!activeTabElement) return;

        controls.tabColorScheme.value = controls.colorScheme.value;
        controls.tabBrightness.value = controls.brightness.value;
        controls.tabBrightnessValue.textContent = controls.brightnessValue.textContent;
        controls.tabTextSize.value = controls.textSize.value;
        controls.tabTextSizeValue.textContent = controls.textSizeValue.textContent;
        controls.tabTextColor.value = controls.textColor.value;
        controls.tabBackgroundColor.value = controls.backgroundColor.value;

        updateCustomControlsVisibility(controls.tabColorScheme.value, controls.tabCustomControls);
    }

    // Event Listeners
    controls.colorScheme.addEventListener('change', (e) => {
        updateCustomControlsVisibility(e.target.value, controls.customControls);
    });

    controls.tabColorScheme.addEventListener('change', (e) => {
        updateCustomControlsVisibility(e.target.value, controls.tabCustomControls);
    });

    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;

            document.querySelectorAll('.tab-button').forEach(btn =>
                btn.classList.remove('active'));
            button.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(content =>
                content.classList.add('hidden'));
            const contentElement = document.getElementById(tabId);
            if (contentElement) {
                contentElement.classList.remove('hidden');
                if (tabId === 'tab-specific') {
                    loadTabs();
                }
            }
        });
    });

    // Add save tab settings handler
    controls.saveTabButton?.addEventListener('click', async () => {
        const activeTabElement = document.querySelector('.tab-item.active');
        if (!activeTabElement) {
            showStatus('No tab selected', true);
            return;
        }

        const tabId = parseInt(activeTabElement.dataset.tabId);
        const settings = sanitizeSettings({
            colorScheme: controls.tabColorScheme.value,
            brightnessLevel: parseInt(controls.tabBrightness.value, 10),
            textSize: parseInt(controls.tabTextSize.value, 10),
            textColor: controls.tabColorScheme.value === 'custom' ? controls.tabTextColor.value : '',
            backgroundColor: controls.tabColorScheme.value === 'custom' ? controls.tabBackgroundColor.value : ''
        });

        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['src/content.js']
            }).catch(() => {});

            chrome.tabs.sendMessage(tabId, {
                action: 'updateColorScheme',
                settings: settings
            }, (response) => {
                if (chrome.runtime.lastError) {
                    showStatus('Cannot modify this tab', true);
                    return;
                }

                if (response?.success) {
                    chrome.storage.sync.set({
                        [`tab_${tabId}`]: settings
                    }, () => {
                        showStatus('Tab settings saved successfully');
                    });
                } else {
                    showStatus('Failed to apply tab settings', true);
                }
            });
        } catch (error) {
            console.error('Error:', error);
            showStatus('Failed to apply tab settings', true);
        }
    });

    // Reset tab settings handler
    controls.resetTabButton?.addEventListener('click', async () => {
        try {
            // Get all tabs in current window
            const tabs = await chrome.tabs.query({ currentWindow: true });
            let successCount = 0;
            let failCount = 0;

            // Clear all tab-specific settings from storage
            chrome.storage.sync.get(null, async (data) => {
                const tabKeys = Object.keys(data).filter(key => key.startsWith('tab_'));
                chrome.storage.sync.remove(tabKeys, async () => {
                    // Reset each tab
                    for (const tab of tabs) {
                        if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
                            continue;
                        }

                        try {
                            // Inject content script if needed
                            await chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                files: ['src/content.js']
                            }).catch(() => {});

                            // Send reset message
                            await new Promise(resolve => {
                                chrome.tabs.sendMessage(tab.id, {
                                    action: 'resetSettings'
                                }, (response) => {
                                    if (chrome.runtime.lastError) {
                                        failCount++;
                                    } else if (response?.success) {
                                        successCount++;
                                    } else {
                                        failCount++;
                                    }
                                    resolve();
                                });
                            });
                        } catch (error) {
                            console.error(`Error resetting tab ${tab.id}:`, error);
                            failCount++;
                        }
                    }

                    // Show final status
                    if (failCount === 0) {
                        showStatus(`All ${successCount} tabs reset successfully`);
                    } else {
                        showStatus(`Reset: ${successCount} succeeded, ${failCount} failed`, true);
                    }

                    // Refresh the tab list
                    loadTabs();
                });
            });
        } catch (error) {
            console.error('Error during mass reset:', error);
            showStatus('Failed to reset tabs', true);
        }
    });

    // Reset buttons for color pickers
    document.querySelectorAll('.reset-color').forEach(button => {
        button.addEventListener('click', () => {
            const inputId = button.dataset.for;
            const input = document.getElementById(inputId);
            if (input) {
                input.value = inputId.includes('text') ?
                    DEFAULT_SETTINGS.textColor : DEFAULT_SETTINGS.backgroundColor;
            }
        });
    });

    // Range input updates
    ['brightness', 'textSize', 'tabBrightness', 'tabTextSize', 'transitionSpeed', 'overlayDuration'].forEach(controlName => {
        const input = controls[controlName];
        const display = controls[`${controlName}Value`];
        if (input && display) {
            input.addEventListener('input', () => {
                const value = input.value;
                if (controlName === 'transitionSpeed' || controlName === 'overlayDuration') {
                    display.textContent = `${(value / 1000).toFixed(1)}s`;
                } else {
                    display.textContent = `${value}%`;
                }
            });
        }
    });

    // Update range input handlers to work directly with seconds
    ['transitionSpeed', 'overlayDuration'].forEach(controlName => {
        const input = controls[controlName];
        const display = controls[`${controlName}Value`];
        if (input && display) {
            input.addEventListener('input', () => {
                // Display value in seconds with one decimal place
                display.textContent = `${parseFloat(input.value).toFixed(1)}s`;
            });
        }
    });

    // Action buttons
    controls.applyButton.addEventListener('click', applySettings);
    controls.resetButton.addEventListener('click', () => {
        chrome.storage.sync.clear(() => {
            Object.assign(controls, DEFAULT_SETTINGS);
            window.location.reload();
        });
    });

    // Replace checkbox event listener with toggle control click handler
    document.querySelector('.toggle-control')?.addEventListener('click', async (e) => {
        const toggleControl = e.currentTarget;
        const isActive = toggleControl.dataset.active === 'true';
        toggleControl.dataset.active = (!isActive).toString();

        // Get current settings to store as locked settings
        const currentSettings = {
            colorScheme: controls.colorScheme?.value || DEFAULT_SETTINGS.colorScheme,
            brightnessLevel: parseInt(controls.brightness?.value || DEFAULT_SETTINGS.brightnessLevel),
            textSize: parseInt(controls.textSize?.value || DEFAULT_SETTINGS.textSize),
            textColor: controls.textColor?.value || DEFAULT_SETTINGS.textColor,
            backgroundColor: controls.backgroundColor?.value || DEFAULT_SETTINGS.backgroundColor
        };

        // Store lock state and current settings
        await chrome.storage.sync.set({
            lockSettings: !isActive,
            currentScheme: currentSettings  // Store current settings as the locked scheme
        });

        if (!isActive) {
            // Apply to all tabs when locking
            await applySettingsToAllTabs(currentSettings);
        }
    });

    document.querySelector('#accessibility .toggle-control')?.addEventListener('click', (e) => {
        const toggleControl = e.currentTarget;
        const isActive = toggleControl.dataset.active === 'false';  // Reversed logic here
        toggleControl.dataset.active = isActive.toString();

        const protectionControls = document.getElementById('protection-settings');
        if (protectionControls) {
            protectionControls.classList.toggle('disabled', !isActive);
        }

        chrome.storage.sync.set({ protectionEnabled: isActive });  // Reversed logic here
    });

    // Update the protection settings save handler with better null checks
    document.getElementById('save-protection')?.addEventListener('click', async () => {
        try {
            const protectionToggle = document.querySelector('#accessibility .toggle-control');
            if (!protectionToggle) {
                throw new Error('Protection toggle control not found');
            }

            const protectionEnabled = protectionToggle.dataset.active === 'true';
            const transitionSpeed = controls.transitionSpeed?.value ?
                parseFloat(controls.transitionSpeed.value) :
                DEFAULT_SETTINGS.transitionSpeed;

            const settings = {
                protectionEnabled,
                transitionSpeed
            };

            // Save settings first
            await chrome.storage.sync.set({
                protectionSettings: settings,
                globalProtectionEnabled: protectionEnabled
            });

            // Apply to all tabs
            const tabs = await chrome.tabs.query({ currentWindow: true });
            let successCount = 0;

            for (const tab of tabs) {
                if (!tab.id || tab.url?.startsWith('chrome://') || tab.url?.startsWith('edge://')) {
                    continue;
                }

                try {
                    await injectContentScript(tab.id);
                    await sendMessageWithRetry(tab.id, {
                        action: 'updateColorScheme',
                        settings: {
                            ...settings,
                            colorScheme: controls.colorScheme?.value || DEFAULT_SETTINGS.colorScheme,
                            brightnessLevel: controls.brightness?.value ?
                                parseInt(controls.brightness.value) :
                                DEFAULT_SETTINGS.brightnessLevel,
                            textSize: controls.textSize?.value ?
                                parseInt(controls.textSize.value) :
                                DEFAULT_SETTINGS.textSize
                        }
                    });
                    successCount++;
                } catch (error) {
                    console.error(`Error applying protection to tab ${tab.id}:`, error);
                }
            }

            showStatus(`Protection settings saved and applied to ${successCount} tabs`);
        } catch (error) {
            console.error('Error saving protection settings:', error);
            showStatus(error.message || 'Failed to save protection settings', true);
        }
    });

    // Update range input handlers to only include transition speed
    ['transitionSpeed'].forEach(controlName => {
        const input = controls[controlName];
        const display = controls[`${controlName}Value`];
        if (input && display) {
            input.addEventListener('input', () => {
                display.textContent = `${input.value}s`;
            });
        }
    });

    // Add protection settings save handler
    document.getElementById('save-protection')?.addEventListener('click', async () => {
        try {
            // Force load tabs if container is empty
            if (!document.querySelector('#tabs-container .tab-item')) {
                await new Promise(resolve => {
                    loadTabs();
                    // Give time for tabs to load
                    setTimeout(resolve, 100);
                });
            }

            const tabElements = Array.from(document.querySelectorAll('#tabs-container .tab-item'));
            if (!tabElements.length) {
                showStatus('Please go to Tab Settings first and ensure tabs are loaded', true);
                return;
            }

            const protectionEnabled = document.querySelector('#accessibility .toggle-control')?.dataset.active === 'true';
            const settings = {
                protectionEnabled,
                transitionSpeed: parseFloat(controls.transitionSpeed.value),
                overlayDuration: parseFloat(controls.overlayDuration.value)
            };

            // Save settings first
            await chrome.storage.sync.set({
                protectionSettings: settings,
                globalProtectionEnabled: protectionEnabled
            });

            // Apply to each tab
            let successCount = 0;
            for (const tabElement of tabElements) {
                const tabId = parseInt(tabElement.dataset.tabId);
                if (!tabId) continue;

                try {
                    await injectContentScript(tabId);
                    await new Promise((resolve, reject) => {
                        chrome.tabs.sendMessage(tabId, {
                            action: 'updateProtectionSettings',
                            settings
                        }, response => {
                            if (chrome.runtime.lastError) {
                                reject(chrome.runtime.lastError);
                            } else if (response?.success) {
                                successCount++;
                                resolve();
                            } else {
                                reject(new Error('Failed to apply settings to tab'));
                            }
                        });
                    });
                } catch (error) {
                    console.error(`Error applying protection to tab ${tabId}:`, error);
                }
            }

            showStatus(`Protection settings saved and applied to ${successCount} tabs`);
        } catch (error) {
            console.error('Error saving protection settings:', error);
            showStatus('Failed to save protection settings', true);
        }
    });

    // Update range input handlers for seconds display
    ['transitionSpeed', 'overlayDuration'].forEach(controlName => {
        const input = controls[controlName];
        const display = controls[`${controlName}Value`];
        if (input && display) {
            input.addEventListener('input', () => {
                display.textContent = `${input.value}s`;
            });
        }
    });

    // Initialize - FIX: syntax and null checks
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
        try {
            const sanitizedSettings = sanitizeSettings(settings);

            // Safely update controls with null checks
            if (controls.colorScheme) controls.colorScheme.value = sanitizedSettings.colorScheme;
            if (controls.brightness) {
                controls.brightness.value = sanitizedSettings.brightnessLevel;
                if (controls.brightnessValue) {
                    controls.brightnessValue.textContent = `${sanitizedSettings.brightnessLevel}%`;
                }
            }
            if (controls.textSize) {
                controls.textSize.value = sanitizedSettings.textSize;
                if (controls.textSizeValue) {
                    controls.textSizeValue.textContent = `${sanitizedSettings.textSize}%`;
                }
            }
            if (controls.textColor) controls.textColor.value = sanitizedSettings.textColor;
            if (controls.backgroundColor) controls.backgroundColor.value = sanitizedSettings.backgroundColor;
            if (controls.transitionSpeed) {
                controls.transitionSpeed.value = settings.transitionSpeed || DEFAULT_SETTINGS.transitionSpeed;
                if (controls.transitionSpeedValue) {
                    controls.transitionSpeedValue.textContent = `${settings.transitionSpeed || DEFAULT_SETTINGS.transitionSpeed}s`;
                }
            }

            updateCustomControlsVisibility(sanitizedSettings.colorScheme, controls.customControls);

            // Update to protection toggle state
            const protectionToggle = document.querySelector('#accessibility .toggle-control');
            const protectionControls = document.getElementById('protection-settings');
            if (protectionToggle && protectionControls) {
                protectionToggle.dataset.active = (!!settings.protectionEnabled).toString();
                protectionControls.classList.toggle('disabled', !settings.protectionEnabled);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            showStatus('Error loading settings', true);
        }
    });

    // Update to initialization to set initial toggle state
    chrome.storage.sync.get(['lockSettings'], (data) => {
        const toggleControl = document.querySelector('.toggle-control');
        if (toggleControl) {
            toggleControl.dataset.active = (!!data.lockSettings).toString();
        }
    });

    // Initialize protection toggle state with reversed logic
    chrome.storage.sync.get({ protectionSettings: DEFAULT_SETTINGS }, (data) => {
        const protectionToggle = document.querySelector('#accessibility .toggle-control');
        const protectionControls = document.getElementById('protection-settings');

        if (protectionToggle && protectionControls) {
            protectionToggle.dataset.active = (!data.protectionSettings.protectionEnabled).toString();  
            protectionControls.classList.toggle('disabled', data.protectionSettings.protectionEnabled);  

            // Set initial values
            if (controls.transitionSpeed) {
                controls.transitionSpeed.value = data.protectionSettings.transitionSpeed;
                controls.transitionSpeedValue.textContent = `${data.protectionSettings.transitionSpeed}s`;
            }
            if (controls.overlayDuration) {
                controls.overlayDuration.value = data.protectionSettings.overlayDuration;
                controls.overlayDurationValue.textContent = `${data.protectionSettings.overlayDuration}s`;
            }
        }
    });

    // Update to initialization to properly restore protection state
    chrome.storage.sync.get(['protectionSettings', 'globalProtectionEnabled'], (data) => {
        const protectionToggle = document.querySelector('#accessibility .toggle-control');
        const protectionControls = document.getElementById('protection-settings');

        if (protectionToggle && protectionControls) {
            // Use the global flag to determine the toggle state
            const isEnabled = data.globalProtectionEnabled ?? false;
            protectionToggle.dataset.active = isEnabled.toString();
            protectionControls.classList.toggle('disabled', !isEnabled);

            // Set initial values if protection settings exist
            if (data.protectionSettings) {
                if (controls.transitionSpeed) {
                    controls.transitionSpeed.value = data.protectionSettings.transitionSpeed;
                    controls.transitionSpeedValue.textContent = `${data.protectionSettings.transitionSpeed}s`;
                }
                if (controls.overlayDuration) {
                    controls.overlayDuration.value = data.protectionSettings.overlayDuration;
                    controls.overlayDurationValue.textContent = `${data.protectionSettings.overlayDuration}s`;
                }
            }
        }
    });

    // Update the protection toggle event listener
    document.querySelector('#accessibility .toggle-control')?.addEventListener('click', async (e) => {
        const toggleControl = e.currentTarget;
        const isActive = toggleControl.dataset.active === 'false';
        toggleControl.dataset.active = isActive.toString();

        const protectionControls = document.getElementById('protection-settings');
        if (protectionControls) {
            protectionControls.classList.toggle('disabled', !isActive);
        }

        // Save both the protection state and global flag
        await chrome.storage.sync.set({
            protectionEnabled: isActive,
            globalProtectionEnabled: isActive
        });
    });

    // Update protection toggle event listener
    const protectionToggle = document.getElementById('protection-toggle');
    protectionToggle?.addEventListener('click', async () => {
        const isActive = protectionToggle.dataset.active !== 'true';
        protectionToggle.dataset.active = isActive.toString();

        const protectionControls = document.getElementById('protection-settings');
        if (protectionControls) {
            protectionControls.classList.toggle('disabled', !isActive);
        }

        // Save settings
        await chrome.storage.sync.set({
            protectionEnabled: isActive,
            globalProtectionEnabled: isActive
        });
    });

    // Update the protection settings save handler to use the storage API first
    document.getElementById('save-protection')?.addEventListener('click', async () => {
        try {
            const protectionToggle = document.querySelector('#accessibility .toggle-control');
            if (!protectionToggle) {
                throw new Error('Protection toggle control not found');
            }

            const protectionEnabled = protectionToggle.dataset.active === 'true';
            const transitionSpeed = controls.transitionSpeed?.value ?
                parseFloat(controls.transitionSpeed.value) :
                DEFAULT_SETTINGS.transitionSpeed;

            // Store settings first
            const settings = { protectionEnabled, transitionSpeed };
            await chrome.storage.sync.set({
                protectionSettings: settings,
                globalProtectionEnabled: protectionEnabled
            });

            // Apply to current tab first
            const currentTab = await getActiveTab();
            if (currentTab) {
                await updateTabSettings(currentTab.id, {
                    ...getFormattedSettings(),
                    protectionEnabled,
                    transitionSpeed
                });
            }

            // Apply to all other tabs if lock settings is enabled
            const lockControl = document.querySelector('.toggle-control');
            if (lockControl?.dataset.active === 'true') {
                await applySettingsToAllTabs({
                    ...getFormattedSettings(),
                    protectionEnabled,
                    transitionSpeed
                });
            }

            showStatus('Protection settings saved successfully');
        } catch (error) {
            console.error('Error saving protection settings:', error);
            showStatus('Failed to save protection settings', true);
        }
    });

    chrome.tabs.onCreated.addListener(async (tab) => {
        chrome.storage.sync.get(['lockSettings', 'globalSettings'], async (data) => {
            if (data.lockSettings && data.globalSettings) {
                try {
                    await injectContentScript(tab.id);
                    await updateTabSettings(tab.id, data.globalSettings);
                } catch (error) {
                    console.error('Error applying locked settings to new tab:', error);
                }
            }
        });
    });

    function updateControlsWithSettings(settings) {
        if (!settings) return;

        if (controls.colorScheme) controls.colorScheme.value = settings.colorScheme;
        if (controls.brightness) {
            controls.brightness.value = settings.brightnessLevel;
            controls.brightnessValue.textContent = `${settings.brightnessLevel}%`;
        }
        if (controls.textSize) {
            controls.textSize.value = settings.textSize;
            controls.textSizeValue.textContent = `${settings.textSize}%`;
        }
        if (controls.transitionSpeed) {
            controls.transitionSpeed.value = settings.transitionSpeed;
            controls.transitionSpeedValue.textContent = `${settings.transitionSpeed}s`;
        }

        // Update protection toggle
        const protectionToggle = document.querySelector('#accessibility .toggle-control');
        if (protectionToggle) {
            protectionToggle.dataset.active = (!!settings.protectionEnabled).toString();
        }

        updateCustomControlsVisibility(settings.colorScheme, controls.customControls);
    }
});