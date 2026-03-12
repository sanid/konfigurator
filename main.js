const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Hot Reload logic
if (process.env.NODE_ENV !== 'production') {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, 'node_modules', '.bin', 'electron')
    });
  } catch (err) { }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1700,
    height: 980,
    minWidth: 1300,
    minHeight: 700,
    titleBarStyle: 'hidden',
    /* titleBarOverlay: {
      color: '#0a0a14',
      symbolColor: '#8888aa',
      height: 36
    }, */
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    backgroundColor: '#0a0a14',
    show: false,
    frame: false
  });

  win.loadFile('index.html');

  win.webContents.openDevTools({ mode: 'detach' });
  win.once('ready-to-show', () => { win.show(); });

  // Window controls via IPC
  ipcMain.on('win-minimize', () => win.minimize());
  ipcMain.on('win-maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize());
  ipcMain.on('win-close', () => win.close());
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('save-file', async (event, { filename, ext, extName, content, encoding }) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    defaultPath: filename,
    filters: [{ name: extName, extensions: [ext] }]
  });
  if (canceled || !filePath) return { success: false };
  const data = encoding === 'base64' ? Buffer.from(content, 'base64') : content;
  fs.writeFileSync(filePath, data);
  if (ext === 'pdf') shell.openPath(filePath);
  return { success: true, filePath };
});

ipcMain.handle('open-file', async (event, { extName, ext }) => {
  const { filePaths, canceled } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: extName, extensions: [ext] }]
  });
  if (canceled || !filePaths.length) return { success: false };
  const content = fs.readFileSync(filePaths[0], 'utf-8');
  return { success: true, content, filePath: filePaths[0] };
});
