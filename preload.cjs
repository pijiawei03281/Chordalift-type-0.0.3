// preload.cjs
const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('chordalift', {
  config: {
    get: () => ipcRenderer.invoke('cfg:get'),
    set: (patch) => ipcRenderer.invoke('cfg:set', patch),
    path: () => ipcRenderer.invoke('cfg:path')
  },
  log: {
    info: (m) => ipcRenderer.send('log:info', m),
    warn: (m) => ipcRenderer.send('log:warn', m),
    error: (m) => ipcRenderer.send('log:error', m),
    openDir: () => ipcRenderer.invoke('log:openDir')
  },
  maintenance: {
    clear: (opts) => ipcRenderer.invoke('maint:clear', opts),
    openUserData: () => ipcRenderer.invoke('maint:openUserData'),
    factoryReset: () => ipcRenderer.invoke('maint:factoryReset')
  },
  os: {
    version: () => ipcRenderer.invoke('os:version'),
    platform: () => ipcRenderer.invoke('os:platform'),
    appVersion: () => ipcRenderer.invoke('os:appVersion')
  },
  shell: {
    openExternal: (url) => shell.openExternal(url)
  },
  // --- Scale / Layers ---
  scale: {
    getAll: () => ipcRenderer.invoke('scale:getAll'),
    setLayer: (layer, patch) => ipcRenderer.invoke('scale:setLayer', { layer, patch }),
    setRules: (rules) => ipcRenderer.invoke('scale:setRules', rules),
    putLayerTuning: (layer, tuning) => ipcRenderer.invoke('scale:putLayerTuning', { layer, tuning }),
    onApplied: (cb) => {
      const h = (_e, payload) => cb?.(payload);
      ipcRenderer.on('scale:applied', h); return () => ipcRenderer.removeListener('scale:applied', h);
    },
    onRulesUpdated: (cb) => {
      const h = (_e, rules) => cb?.(rules);
      ipcRenderer.on('rules:updated', h); return () => ipcRenderer.removeListener('rules:updated', h);
    },
    onTuningUpdated: (cb) => {
      const h = (_e, payload) => cb?.(payload);
      ipcRenderer.on('tuning:updated', h); return () => ipcRenderer.removeListener('tuning:updated', h);
    }
  },
  out: {
    setLayer: (layer, mode, pbRange) => ipcRenderer.invoke('out:setLayer', { layer, mode, pbRange }),
    onUpdated: (cb) => {
      const h = (_e, payload) => cb?.(payload);
      ipcRenderer.on('out:updated', h); return () => ipcRenderer.removeListener('out:updated', h);
    }
  },
  state: {
    onReset: (cb) => {
      const h = (_e, s) => cb?.(s);
      ipcRenderer.on('state:reset', h); return () => ipcRenderer.removeListener('state:reset', h);
    }
  }
});