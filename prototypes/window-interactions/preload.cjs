const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('probe', {
  getState: () => ipcRenderer.invoke('probe:state'),
  action: value => ipcRenderer.invoke('probe:action', value),
  onState: callback => { const handler = (_, value) => callback(value); ipcRenderer.on('probe:state', handler); return () => ipcRenderer.removeListener('probe:state', handler); },
  onMode: callback => { const handler = (_, value) => callback(value); ipcRenderer.on('probe:mode', handler); return () => ipcRenderer.removeListener('probe:mode', handler); },
});
