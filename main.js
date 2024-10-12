const { app, BrowserWindow } = require('electron');
const path = require('path');

let win1, win2, win3,serverLogWin;;

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // Bỏ qua tất cả các lỗi chứng chỉ, cho phép sử dụng chứng chỉ tự ký
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
  win1.loadURL('https://192.168.88.113:3000'); // Load the first web app URL
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
  win2.loadURL('https://192.168.88.113:3000'); // Load the second web app URL
}

// function createWindow3() {
//   win3 = new BrowserWindow({
//     width: 800,
//     height: 600,
//     webPreferences: {
//       preload: path.join(__dirname, 'preload.js'), // Nếu cần preload
//       nodeIntegration: true,
//       contextIsolation: false,
//       enableRemoteModule: true,  // Bật enableRemoteModule
//       webSecurity: false
//     }
//   });
//   win3.loadURL('http://localhost:3000'); // Load the second web app URL
//   win3.webContents.openDevTools();
// }

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
  // createWindow3();
  createServerLogWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow1();
      createWindow2();
      // createWindow3();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
