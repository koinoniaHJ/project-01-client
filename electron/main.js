// ********** Electron 앱 창 생성, 앱 생명주기 및 백엔드 API 요청 처리 **********

// Electron의 앱, 창, IPC, HTTP 통신 기능을 가져온다.
// ipcMain: Renderer Process가 보낸 IPC 요청을 Main Process에서 받아 처리하는 기능
// net: Main Process에서 Spring Boot 같은 외부 서버로 HTTP 요청을 보내는 Electron의 네트워크 기능
const { app, BrowserWindow, ipcMain, net, dialog } = require('electron/main');

// 파일 경로를 안전하게 조합하는 Node.js path 모듈을 가져온다.
const path = require('node:path');

// 개발 환경에서 사용할 Spring Boot REST API의 기본 주소
const API_BASE_URL = 'http://localhost:8080/api/v1';

// Main Process에서 허용할 HTTP 요청 방식을 지정한다.
// Set: 중복된 값을 허용하지 않고, 각 값을 하나씩만 저장하는 JavaScript의 집합(Set) 자료구조
const ALLOWED_METHODS = new Set([
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE'
]);

// 확인창 IPC 처리 코드
ipcMain.handle('dialog:confirm', async (event, message) => {

    // 요청을 보낸 Renderer가 속한 Electron 창을 찾는다.
    const parentWindow = BrowserWindow.fromWebContents(event.sender);

    // 해당 Electron 창에 연결된 확인창을 띄운다.
    const result = await dialog.showMessageBox(
        parentWindow,
        {
            type: 'question',
            title: '확인',
            message,
            buttons: ['확인', '취소'],
            defaultId: 0,
            cancelId: 1,
            noLink: true
        }
    );

    // 첫 번째 버튼인 '확인'을 눌렀으면 true를 반환한다.
    return result.response === 0;
});

// Renderer가 'api:request' 채널로 보낸 API 요청을 처리한다.
ipcMain.handle('api:request', async (_event, request) => {
    // 전달받은 요청에서 API 경로를 꺼낸다.
    const apiPath = request?.path;

    // 요청 옵션이 없으면 빈 객체를 사용한다.
    const options = request?.options ?? {};

    // HTTP Method가 없으면 GET을 사용하고 대문자로 변환한다.
    const method = (options.method ?? 'GET').toUpperCase();

    // API 경로가 문자열이 아니거나 '/'로 시작하지 않으면 요청을 거부한다.
    if (typeof apiPath !== 'string' || !apiPath.startsWith('/')) {
        // 잘못된 API 경로라는 오류를 Renderer에 전달한다.
        throw new Error('잘못된 API 경로입니다.');
    }

    // 미리 지정한 HTTP Method가 아니면 요청을 거부한다.
    if (!ALLOWED_METHODS.has(method)) {
        // 허용되지 않은 HTTP Method라는 오류를 Renderer에 전달한다.
        throw new Error('허용되지 않은 HTTP Method입니다.');
    }

    // Electron의 net.fetch로 Spring Boot API에 실제 HTTP 요청을 보낸다.
    const response = await net.fetch(
        // 기본 API 주소와 Renderer가 전달한 API 경로를 합친다.
        `${API_BASE_URL}${apiPath}`,
        {
            // 요청에 사용할 HTTP Method를 지정한다.
            method,

            // 전달받은 헤더가 없으면 빈 객체를 사용한다.
            headers: options.headers ?? {},

            // GET 요청에는 body를 넣지 않고, 나머지는 전달받은 body를 넣는다.
            body: method === 'GET'
                ? undefined
                : options.body,

            // 쿠키 같은 인증 정보를 요청에 포함한다.
            credentials: 'include'
        }
    );

    // 서버 응답 내용을 문자열로 읽는다.
    const text = await response.text();

    // 응답 본문의 기본값을 null로 설정한다.
    let body = null;

    // 응답 본문이 비어 있지 않은 경우에만 변환한다.
    if (text) {
        try {
            // JSON 형식의 문자열이면 JavaScript 객체로 변환한다.
            body = JSON.parse(text);
        } catch {
            // JSON 형식이 아니면 원래 문자열을 그대로 사용한다.
            body = text;
        }
    }

    // HTTP 요청 결과를 Renderer에 반환한다.
    return {
        // 요청 성공 여부를 반환한다.
        ok: response.ok,

        // HTTP 상태 코드를 반환한다.
        status: response.status,

        // 변환한 응답 본문을 반환한다.
        body
    };
});

// Electron 애플리케이션 창을 생성하는 함수이다.
function createWindow() {
    // 너비, 높이, 보안 설정을 적용하여 새 창을 만든다.
    const mainWindow = new BrowserWindow({
        // 창의 초기 너비를 1200px로 설정한다.
        width: 1200,

        // 창의 초기 높이를 800px로 설정한다.
        height: 800,

        // Renderer Process에 적용할 설정이다.
        webPreferences: {
            // Renderer보다 먼저 실행할 preload.js의 경로를 지정한다.
            preload: path.join(__dirname, 'preload.js'),

            // Renderer에서 Node.js 기능을 직접 사용하지 못하게 한다.
            nodeIntegration: false,

            // preload와 Renderer의 JavaScript 실행 환경을 분리한다.
            contextIsolation: true,

            // Renderer의 운영체제 접근 권한을 추가로 제한한다.
            sandbox: true
        }
    });

    // 생성한 창에 로그인 HTML 파일을 불러온다.
    mainWindow.loadFile(
        // 현재 폴더를 기준으로 login.html의 경로를 만든다.
        path.join(__dirname, '../src/pages/login.html')
    );
}

// Electron의 초기화가 완료되면 아래 코드를 실행한다.
app.whenReady().then(() => {
    // 첫 번째 애플리케이션 창을 생성한다.
    createWindow();

    // macOS에서 Dock 아이콘을 클릭해 앱이 활성화될 때 실행한다.
    app.on('activate', () => {
        // 열려 있는 창이 하나도 없는지 확인한다.
        if (BrowserWindow.getAllWindows().length === 0) {
            // 열려 있는 창이 없으면 새 창을 생성한다.
            createWindow();
        }
    });
});

// 열려 있던 Electron 창이 모두 닫히면 실행한다.
app.on('window-all-closed', () => {
    // macOS가 아닌 운영체제인지 확인한다.
    if (process.platform !== 'darwin') {
        // Electron 애플리케이션을 완전히 종료한다.
        app.quit();
    }
});
