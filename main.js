const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow () {
  const win = new BrowserWindow({
    width: 1300,
    height: 850,
    title: "WaveFlow Music Visualizer",
    webPreferences: {
      webSecurity: false, // Bypasses X-Frame-Options & CSP so Spotify/YouTube load perfectly in iframes
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Strip X-Frame-Options and Content-Security-Policy globally in Electron requests
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders;
    
    // Remove headers case-insensitively
    Object.keys(responseHeaders).forEach(header => {
      const lowerHeader = header.toLowerCase();
      if (lowerHeader === 'x-frame-options' || lowerHeader === 'content-security-policy') {
        delete responseHeaders[header];
      }
    });

    callback({
      cancel: false,
      responseHeaders: responseHeaders
    });
  });

  win.loadFile('index.html');
  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();

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
