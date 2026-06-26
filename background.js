// Manifest V3 Service Worker for WaveFlow Extension

chrome.action.onClicked.addListener(async (tab) => {
    // Only capture normal web pages (http/https)
    if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
        console.warn("Cannot capture audio from this page context.");
        return;
    }

    try {
        // Obtain the audio stream ID for the active tab
        chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message);
                return;
            }

            // Get favicon url
            const iconUrl = tab.favIconUrl || '';

            // Open index.html in a new tab, passing the streamId and iconUrl
            const visualizerUrl = chrome.runtime.getURL(`index.html?streamId=${streamId}&iconUrl=${encodeURIComponent(iconUrl)}`);
            chrome.tabs.create({ url: visualizerUrl });
        });
    } catch (err) {
        console.error("Failed to capture tab audio:", err);
    }
});

// Register session rules to strip frame headers for all iframes loaded inside the extension
function registerFrameRules() {
    const RULE_ID = 8888;
    chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [RULE_ID],
        addRules: [{
            id: RULE_ID,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                responseHeaders: [
                    { header: 'X-Frame-Options', operation: 'remove' },
                    { header: 'Content-Security-Policy', operation: 'remove' }
                ]
            },
            condition: {
                resourceTypes: ['sub_frame']
            }
        }]
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("Failed to update declarativeNetRequest session rules:", chrome.runtime.lastError.message);
        } else {
            console.log("Successfully registered frame bypass rules.");
        }
    });
}

// Register rules on install, startup, and service worker load
chrome.runtime.onInstalled.addListener(registerFrameRules);
chrome.runtime.onStartup.addListener(registerFrameRules);
registerFrameRules(); // Also invoke immediately when worker loads

// Listener for messages from index.html/app.js to capture the visualizer's own tab audio
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureCurrentTab' && sender.tab) {
        chrome.tabCapture.getMediaStreamId({ targetTabId: sender.tab.id }, (streamId) => {
            if (chrome.runtime.lastError) {
                console.error("Failed to capture tab audio via message:", chrome.runtime.lastError.message);
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ streamId: streamId });
            }
        });
        return true; // Keep message channel open for async response
    }
});
