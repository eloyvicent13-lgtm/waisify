import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import path from 'path';

// Disable Site Isolation to allow iframe access with webSecurity: false
app.commandLine.appendSwitch('disable-site-isolation-trials');

let mainWindow: BrowserWindow | null = null;

// Determine if we are in development mode
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    frame: false, // frameless window
    backgroundColor: '#070709',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Window Management IPC Handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.on('window-mini-player', (_event, enabled) => {
  if (mainWindow) {
    if (enabled) {
      mainWindow.setMinimumSize(360, 130);
      mainWindow.setSize(360, 130);
      mainWindow.setAlwaysOnTop(true);
      mainWindow.setResizable(false);
    } else {
      mainWindow.setResizable(true);
      mainWindow.setMinimumSize(940, 600);
      mainWindow.setSize(1200, 800);
      mainWindow.setAlwaysOnTop(false);
      mainWindow.center();
    }
  }
});

// Register Global Media Shortcuts
function registerGlobalMediaShortcuts() {
  // Media Play/Pause
  globalShortcut.register('MediaPlayPause', () => {
    if (mainWindow) {
      mainWindow.webContents.send('global-media-command', 'play-pause');
    }
  });

  // Media Next
  globalShortcut.register('MediaNextTrack', () => {
    if (mainWindow) {
      mainWindow.webContents.send('global-media-command', 'next');
    }
  });

  // Media Previous
  globalShortcut.register('MediaPreviousTrack', () => {
    if (mainWindow) {
      mainWindow.webContents.send('global-media-command', 'prev');
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  registerGlobalMediaShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Unregister all shortcuts when application exits
  globalShortcut.unregisterAll();
});
