const { app, BrowserWindow } = require('electron/main');
const path = require('node:path');

function createWindow() {
    const mainWindow = new BrowserWindow({ // BrowserWindow: Electron에서 데스크톱 창을 생성하는 객체
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // preload: Renderer가 실행되기 전에 실행할 preload.js 파일 지정

            // Renderer에서 fs, path, process 등 Node.js 기능을 직접 사용하지 않도록 한다.
            nodeIntegration: false,

            // preload와 일반 웹 화면(Renderer)의 JavaScript 실행 영역을 분리한다.
            contextIsolation: true,

            // Renderer의 OS 접근 범위를 추가로 제한한다.
            sandbox: true
        }
    });

    mainWindow.loadFile( // loadFile(): Electron 창에 표시할 HTML 파일을 불러온다.
        path.join(__dirname, '../src/pages/index.html')
    );
}

app.whenReady().then(() => { // app.whenReady(): Electron 초기화가 완료된 후 창을 생성한다.
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => { // window-all-closed: 모든 창이 닫혔을 때 macOS를 제외한 환경에서는 애플리케이션을 종료한다.
    if (process.platform !== 'darwin') {
        app.quit();
    }
});