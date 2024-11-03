const { app, BrowserWindow,ipcMain,desktopCapturer  } = require('electron');
const path = require('path');

let win1, win2, win3,serverLogWin;

ipcMain.handle('get-sources', async (event) => {
  try {
    const inputSources = await desktopCapturer.getSources({
      types: ['window', 'screen']
    });
    return inputSources;
  } catch (error) {
    console.error('Error fetching screen sources:', error);
    throw error;
  }
});


app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});


function createWindow1() {
  win1 = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Nếu cần preload
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,  // Bật enableRemoteModule
      webSecurity: false         // Tắt bảo mật web để tránh CORS (cân nhắc bảo mật)
    }
  });
  win1.loadURL('https://localhost:8080'); // Load the first web app URL
}

function createWindow2() {
  win2 = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Nếu cần preload
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,  // Bật enableRemoteModule
      webSecurity: false
    }
  });
  win2.loadURL('https://localhost:8080'); // Load the second web app URL
}

function createWindow3() {
  win3 = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Nếu cần preload
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,  // Bật enableRemoteModule
      webSecurity: false
    }
  });
  win3.loadURL('https://localhost:8080'); // Load the second web app URL
}

function createServerLogWindow() {
  serverLogWin = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  // Tải giao diện HTML của server log
  serverLogWin.loadFile('public/server_ui.html');
}
app.whenReady().then(() => {
  createWindow1();
  createWindow2();
  createWindow3();
  createServerLogWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow1();
      createWindow2();
      createWindow3();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
