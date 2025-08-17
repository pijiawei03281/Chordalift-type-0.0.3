// electron-main.cjs — CommonJS 主行程
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const log = require('electron-log');

const isDev = !app.isPackaged;
let mainWindow;

// 使用者資料與日誌
const userDir = app.getPath('userData');
const logDir = path.join(userDir, 'logs');
const cfgPath = path.join(userDir, 'config.json');

fse.ensureDirSync(logDir);
log.transports.file.resolvePathFn = () => path.join(logDir, 'chordalift.log');
log.transports.file.maxSize = 1024 * 1024; // 1MB

function readCfg() {
  try { return JSON.parse(fs.readFileSync(cfgPath, 'utf-8')); }
  catch { return { eulaAccepted: false, logLevel: 'warn', audioTestDb: -6 }; }
}
function writeCfg(patch) {
  const cur = readCfg();
  const next = { ...cur, ...patch };
  fse.ensureDirSync(path.dirname(cfgPath));
  fs.writeFileSync(cfgPath, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

// ==== Key/Scale 狀態（預設） ====
let scaleState = { key: 'C', scale: 'Major', enabled: true };
{
  const cfg = readCfg();
  if (cfg && cfg.scaleState) scaleState = { ...scaleState, ...cfg.scaleState };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100, height: 720, show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // 先載 Control Hub（app.html），沒有才退到官網首頁（index.html）
  const appHtml  = path.join(__dirname, 'public', 'app.html');
  const siteHtml = path.join(__dirname, 'public', 'index.html');

  if (fs.existsSync(appHtml)) {
    mainWindow.loadFile(appHtml);
  } else if (fs.existsSync(siteHtml)) {
    mainWindow.loadFile(siteHtml);
  } else {
    mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<h1>Chordalift</h1><p>No UI found.</p>'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ===== IPC：設定、日誌、系統資訊 =====
ipcMain.handle('cfg:get', () => readCfg());
ipcMain.handle('cfg:set', (_e, patch) => writeCfg(patch));
ipcMain.handle('cfg:path', () => cfgPath);

ipcMain.on('log:info', (_e, m) => log.info(m));
ipcMain.on('log:warn', (_e, m) => log.warn(m));
ipcMain.on('log:error', (_e, m) => log.error(m));
ipcMain.handle('log:openDir', () => shell.openPath(logDir));

ipcMain.handle('os:version', () => process.getSystemVersion?.() || process.version);
ipcMain.handle('os:platform', () => process.platform);
ipcMain.handle('os:appVersion', () => app.getVersion());

// ===== Maintenance：清除快取 / 日誌 =====
ipcMain.handle('maint:clear', async (_e, opts = {}) => {
  const o = { cache: true, logs: false, ...opts };
  const removed = [];

  if (o.logs) {
    try {
      fse.ensureDirSync(logDir);
      const files = fs.existsSync(logDir) ? fs.readdirSync(logDir) : [];
      for (const f of files) if (/\.log/i.test(f)) {
        try { fs.writeFileSync(path.join(logDir, f), ''); } catch {}
      }
      removed.push('logs');
    } catch (e) { log.warn('maint:clear logs error', e); }
  }

  if (o.cache) {
    const ud = userDir;
    const targets = [
      'Cache', 'GPUCache', 'Code Cache', 'blob_storage',
      path.join('Service Worker', 'CacheStorage'),
      'IndexedDB', 'Local Storage'
    ];
    for (const rel of targets) {
      try { await fse.remove(path.join(ud, rel)); } catch {}
    }
    removed.push('cache');
  }
  return { ok: true, removed };
});
ipcMain.handle('maint:openUserData', () => shell.openPath(userDir));

// ===== Key / Scale 一鍵套用 IPC =====
ipcMain.handle('scale:get', () => scaleState);
ipcMain.handle('scale:set', (_e, patch) => {
  scaleState = { ...scaleState, ...patch };
  writeCfg({ ...readCfg(), scaleState }); // 持久化
  // 廣播給所有視窗（顯示成功 Toast / 立即生效）
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('scale:applied', scaleState);
  }
  return { ok: true, scaleState };
});

// 保險：把未捕捉錯誤寫到檔案，不讓它悄悄掛掉
process.on('uncaughtException', (err) => {
  try { log.error('uncaughtException:', err); } catch {}
});
