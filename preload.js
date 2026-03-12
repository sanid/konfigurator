const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.send('win-minimize'),
    maximize: () => ipcRenderer.send('win-maximize'),
    close: () => ipcRenderer.send('win-close'),
    saveFile: (args) => ipcRenderer.invoke('save-file', args),
    openFile: (args) => ipcRenderer.invoke('open-file', args)
});
