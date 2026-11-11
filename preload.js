"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Preload script — runs in every BrowserWindow before the page loads.
 * Exposes a minimal, secure API via contextBridge so the renderer can
 * communicate with the main-process auto-updater without nodeIntegration.
 */
const electron_1 = require("electron");
const updaterAPI = {
    onStateChanged: (callback) => {
        const handler = (_event, state) => {
            callback(state);
        };
        electron_1.ipcRenderer.on('updater:state-changed', handler);
        // Return unsubscribe function
        return () => {
            electron_1.ipcRenderer.removeListener('updater:state-changed', handler);
        };
    },
    applyUpdate: () => electron_1.ipcRenderer.invoke('updater:apply'),
    quitAndInstall: () => electron_1.ipcRenderer.invoke('updater:quit-and-install'),
    checkForUpdates: () => electron_1.ipcRenderer.invoke('updater:check-for-updates'),
    getState: () => electron_1.ipcRenderer.invoke('updater:get-state'),
};
const dialogAPI = {
    showOpenDialog: () => electron_1.ipcRenderer.invoke('dialog:open-workspace'),
    showOpenMultipleFolderDialog: () => electron_1.ipcRenderer.invoke('dialog:open-workspaces'),
};
const notificationAPI = {
    send: (options) => electron_1.ipcRenderer.invoke('notification:send', options),
    openSystemPreferences: () => electron_1.ipcRenderer.invoke('notification:open-system-preferences'),
    onClicked: (callback) => {
        const handler = (_event, payload) => {
            callback(payload);
        };
        electron_1.ipcRenderer.on('notification:clicked', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('notification:clicked', handler);
        };
    },
};
const storageAPI = {
    getItems: () => electron_1.ipcRenderer.invoke('storage:get-items'),
    updateItems: (changes) => electron_1.ipcRenderer.invoke('storage:update-items', changes),
    onChanged: (callback) => {
        const handler = (_event, changes) => {
            callback(changes);
        };
        electron_1.ipcRenderer.on('storage:changed', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('storage:changed', handler);
        };
    },
};
const logsAPI = {
    getElectronLogs: () => electron_1.ipcRenderer.invoke('logs:electron'),
};
const extensionsAPI = {
    sendAuthorities: (authoritiesMap) => electron_1.ipcRenderer.invoke('extensions:send-authorities', authoritiesMap),
};
const deepLinkAPI = {
    onDeepLink: (callback) => {
        const handler = (_event, url) => {
            callback(url);
        };
        electron_1.ipcRenderer.on('deep-link', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('deep-link', handler);
        };
    },
    getStoredDeepLink: () => electron_1.ipcRenderer.invoke('deep-link:get-stored'),
};
const agentAPI = {
    updateActiveAgentCount: (count) => electron_1.ipcRenderer.invoke('agent:update-active-count', count),
};
function subscribeIpcChannel(channel, callback) {
    const handler = (_event, payload) => {
        callback(payload);
    };
    electron_1.ipcRenderer.on(channel, handler);
    return () => {
        electron_1.ipcRenderer.removeListener(channel, handler);
    };
}
const wcvBrowserAPI = {
    acquire: (req) => electron_1.ipcRenderer.invoke('wcv:acquire', req),
    show: (tabKey, boundsDip) => electron_1.ipcRenderer.invoke('wcv:show', tabKey, boundsDip),
    hide: (tabKey) => electron_1.ipcRenderer.invoke('wcv:hide', tabKey),
    setBounds: (tabKey, boundsDip) => electron_1.ipcRenderer.invoke('wcv:set-bounds', tabKey, boundsDip),
    setThemeColor: (color) => electron_1.ipcRenderer.invoke('wcv:set-theme-color', color),
    setPinned: (tabKey, pinned) => electron_1.ipcRenderer.invoke('wcv:set-pinned', tabKey, pinned),
    setAgentControlling: (tabKey, active) => electron_1.ipcRenderer.invoke('wcv:set-agent-controlling', tabKey, active),
    setOverlayActive: (tabKey, active) => electron_1.ipcRenderer.invoke('wcv:set-overlay-active', tabKey, active),
    setPortalOverlayOpen: (open) => electron_1.ipcRenderer.invoke('wcv:set-portal-overlay-open', open),
    elevate: (tabKey, reason, focusBrowser) => electron_1.ipcRenderer.invoke('wcv:elevate', tabKey, reason, focusBrowser),
    setDragOver: (tabKey, active) => electron_1.ipcRenderer.invoke('wcv:set-drag-over', tabKey, active),
    demote: (tabKey, reason) => electron_1.ipcRenderer.invoke('wcv:demote', tabKey, reason),
    navigate: (tabKey, url) => electron_1.ipcRenderer.invoke('wcv:navigate', tabKey, url),
    control: (tabKey, action) => electron_1.ipcRenderer.invoke('wcv:control', tabKey, action),
    sendMouse: (tabKey, params) => electron_1.ipcRenderer.invoke('wcv:send-mouse', tabKey, params),
    sendKey: (tabKey, params) => electron_1.ipcRenderer.invoke('wcv:send-key', tabKey, params),
    insertText: (tabKey, text) => electron_1.ipcRenderer.invoke('wcv:insert-text', tabKey, text),
    capturePage: (tabKey) => electron_1.ipcRenderer.invoke('wcv:capture-page', tabKey),
    dispose: (tabKey) => electron_1.ipcRenderer.invoke('wcv:dispose', tabKey),
    onGuestEvent: (cb) => subscribeIpcChannel('wcv:guest-event', cb),
    onZOrderChanged: (cb) => subscribeIpcChannel('wcv:z-order-changed', cb),
    onShortcutForwarded: (cb) => subscribeIpcChannel('wcv:shortcut-forwarded', cb),
    onCursorChanged: (cb) => subscribeIpcChannel('wcv:cursor-changed', cb),
};
const electronNativeAPI = {
    getZoomLevel: () => electron_1.webFrame.getZoomFactor(),
    getPathForFile: (file) => electron_1.webUtils.getPathForFile(file),
    setTitleBarOverlay: (options) => electron_1.ipcRenderer.invoke('window:set-title-bar-overlay', options),
    minimize: () => electron_1.ipcRenderer.invoke('window:minimize'),
    maximize: () => electron_1.ipcRenderer.invoke('window:maximize'),
    unmaximize: () => electron_1.ipcRenderer.invoke('window:unmaximize'),
    isMaximized: () => electron_1.ipcRenderer.invoke('window:is-maximized'),
    close: () => electron_1.ipcRenderer.invoke('window:close'),
    toggleDevTools: () => electron_1.ipcRenderer.invoke('window:toggle-devtools'),
    zoomIn: () => {
        void electron_1.ipcRenderer.invoke('window:zoom-in');
    },
    zoomOut: () => {
        void electron_1.ipcRenderer.invoke('window:zoom-out');
    },
    resetZoom: () => {
        void electron_1.ipcRenderer.invoke('window:reset-zoom');
    },
    openExternal: (url) => electron_1.ipcRenderer.invoke('shell:open-external', url),
    revealInFilePicker: (path) => electron_1.ipcRenderer.invoke('shell:reveal-in-file-picker', path),
    getWebviewMemoryUsage: (webContentsIds) => electron_1.ipcRenderer.invoke('webview:get-memory-usage', webContentsIds),
    showContextMenu: (items) => electron_1.ipcRenderer.invoke('window:show-context-menu', items),
    closeContextMenu: () => electron_1.ipcRenderer.invoke('window:close-context-menu'),
    executeJavaScriptInIsolatedWorld: (wcId, worldId, code) => electron_1.ipcRenderer.invoke('webview:execute-js-isolated-world', wcId, worldId, code),
    runScriptInJail: (req) => electron_1.ipcRenderer.invoke('script-jail:run', req),
    abortScriptJail: (jailId) => electron_1.ipcRenderer.invoke('script-jail:abort', jailId),
    subscribeWebviewSecurityState: (webContentsId, callback) => {
        // The push channel and the initial fetch can race; `seq` orders them.
        let latestSeq = 0;
        let subscribed = true;
        const deliver = (state) => {
            if (!subscribed ||
                !state ||
                state.webContentsId !== webContentsId ||
                state.seq <= latestSeq) {
                return;
            }
            latestSeq = state.seq;
            callback(state);
        };
        const handler = (_event, state) => {
            deliver(state);
        };
        electron_1.ipcRenderer.on('webview:security-state-changed', handler);
        void electron_1.ipcRenderer
            .invoke('webview:get-security-state', webContentsId)
            .then(deliver, () => undefined);
        return () => {
            subscribed = false;
            electron_1.ipcRenderer.removeListener('webview:security-state-changed', handler);
        };
    },
    onWebviewOpenNewTab: (callback) => {
        const handler = (_event, url, webContentsId) => {
            callback(url, webContentsId);
        };
        electron_1.ipcRenderer.on('webview:open-new-tab', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('webview:open-new-tab', handler);
        };
    },
    setWebviewDownloadDirectory: (webContentsId, downloadDir) => electron_1.ipcRenderer.invoke('webview:set-download-dir', webContentsId, downloadDir),
    onWebviewFaviconUpdated: (callback) => {
        const handler = (_event, payload) => {
            callback(payload);
        };
        electron_1.ipcRenderer.on('webview:favicon-updated', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('webview:favicon-updated', handler);
        };
    },
    onWebviewDownloadProgress: (callback) => {
        const handler = (_event, payload) => {
            callback(payload);
        };
        electron_1.ipcRenderer.on('webview:download-progress', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('webview:download-progress', handler);
        };
    },
    setWebviewDialogPolicy: (webContentsId, policy) => electron_1.ipcRenderer.invoke('webview:set-dialog-policy', webContentsId, policy),
    handleWebviewDialog: (webContentsId, decision) => electron_1.ipcRenderer.invoke('webview:handle-javascript-dialog', webContentsId, decision),
    onWebviewDialogOpening: (callback) => subscribeIpcChannel('webview:javascript-dialog-opening', callback),
    wcvBrowser: wcvBrowserAPI,
};
electron_1.ipcRenderer.on('agy-script-jail:port', (event, payload) => {
    window.postMessage({
        type: 'agy-script-jail-port',
        jailId: payload?.jailId,
    }, '*', event.ports);
});
const ideAPI = {
    isInstalled: () => electron_1.ipcRenderer.invoke('ide:is-installed'),
};
const wslAPI = {
    getState: () => electron_1.ipcRenderer.invoke('wsl:get-state'),
    connect: (distro) => electron_1.ipcRenderer.invoke('wsl:connect', distro),
};
electron_1.contextBridge.exposeInMainWorld('electronUpdater', updaterAPI);
electron_1.contextBridge.exposeInMainWorld('dialog', dialogAPI);
electron_1.contextBridge.exposeInMainWorld('nativeNotifications', notificationAPI);
electron_1.contextBridge.exposeInMainWorld('nativeStorage', storageAPI);
electron_1.contextBridge.exposeInMainWorld('logs', logsAPI);
electron_1.contextBridge.exposeInMainWorld('extensions', extensionsAPI);
electron_1.contextBridge.exposeInMainWorld('deepLink', deepLinkAPI);
electron_1.contextBridge.exposeInMainWorld('agent', agentAPI);
electron_1.contextBridge.exposeInMainWorld('electronNative', electronNativeAPI);
electron_1.contextBridge.exposeInMainWorld('ide', ideAPI);
electron_1.contextBridge.exposeInMainWorld('wsl', wslAPI);
const HEX6_RE = /^#[0-9a-fA-F]{6}$/;
const HEX3_RE = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/;
const RGB_RE = /^rgba?\(\s*(\d{1,3})\s*(?:,|\s)\s*(\d{1,3})\s*(?:,|\s)\s*(\d{1,3})(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i;
const CSS_VAR_RE = /^var\(\s*(--[^,\s)]+)(?:\s*,\s*(.+))?\)$/;
function parseCssColorToHex6(raw) {
    const s = raw.trim();
    if (!s) {
        return undefined;
    }
    if (HEX6_RE.test(s)) {
        return s.toUpperCase();
    }
    const h3 = HEX3_RE.exec(s);
    if (h3) {
        return `#${h3[1]}${h3[1]}${h3[2]}${h3[2]}${h3[3]}${h3[3]}`.toUpperCase();
    }
    const rgb = RGB_RE.exec(s);
    if (!rgb) {
        return undefined;
    }
    if (rgb[4] !== undefined) {
        const a = rgb[4].endsWith('%')
            ? Number(rgb[4].slice(0, -1)) / 100
            : Number(rgb[4]);
        if (!Number.isFinite(a) || a < 1) {
            return undefined;
        }
    }
    const h2 = (v) => Math.max(0, Math.min(255, Math.round(Number(v))))
        .toString(16)
        .padStart(2, '0');
    return `#${h2(rgb[1])}${h2(rgb[2])}${h2(rgb[3])}`.toUpperCase();
}
// TODO(yushis): Push `wcvBrowser.setThemeColor` directly from toolkit `themeProvider`
// and remove this interim `:root` `--background` MutationObserver bridge.
function installHubSurfaceThemeAutoSync() {
    const g = globalThis;
    if (!g.document ||
        typeof g.getComputedStyle !== 'function' ||
        (g.top && g.self && g.top !== g.self)) {
        return;
    }
    let lastSyncedHex = '';
    let observedRoot = null;
    const syncNow = () => {
        const rootEl = g.document?.documentElement;
        if (!rootEl) {
            return;
        }
        if (observedRoot !== rootEl && typeof g.MutationObserver === 'function') {
            observedRoot = rootEl;
            new g.MutationObserver(syncNow).observe(rootEl, {
                attributes: true,
                attributeFilter: ['style', 'class', 'data-theme'],
            });
        }
        const style = g.getComputedStyle?.(rootEl);
        let cur = style?.getPropertyValue?.('--background')?.trim() ?? '';
        for (let depth = 0; depth < 3 && cur; depth++) {
            const hex = parseCssColorToHex6(cur);
            if (hex) {
                cur = hex;
                break;
            }
            const m = CSS_VAR_RE.exec(cur);
            if (!m) {
                break;
            }
            cur = style?.getPropertyValue?.(m[1])?.trim() || m[2]?.trim() || '';
        }
        const hex = parseCssColorToHex6(cur);
        if (hex && hex !== lastSyncedHex) {
            lastSyncedHex = hex;
            void Promise.resolve(electron_1.ipcRenderer.invoke('wcv:set-theme-color', hex))
                .then((applied) => {
                if (applied === true) {
                    return electron_1.ipcRenderer.invoke('storage:update-items', {
                        hubSurfaceBackgroundColor: hex,
                    });
                }
                return undefined;
            })
                .catch(() => undefined);
        }
    };
    syncNow();
    g.document.addEventListener?.('DOMContentLoaded', syncNow);
    g.addEventListener?.('load', syncNow);
}
installHubSurfaceThemeAutoSync();
