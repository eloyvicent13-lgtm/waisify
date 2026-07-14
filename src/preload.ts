import { contextBridge, ipcRenderer } from 'electron';

// Expose safe, selected methods to the renderer process
contextBridge.exposeInMainWorld('waisifyAPI', {
  // Window management
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  toggleMiniPlayer: (enabled: boolean) => ipcRenderer.send('window-mini-player', enabled),

  // Listen for media key events forwarded from the main process
  onGlobalMediaCommand: (callback: (command: 'play-pause' | 'next' | 'prev') => void) => {
    const subscription = (_event: any, command: 'play-pause' | 'next' | 'prev') => callback(command);
    ipcRenderer.on('global-media-command', subscription);
    return () => {
      ipcRenderer.removeListener('global-media-command', subscription);
    };
  }
});
