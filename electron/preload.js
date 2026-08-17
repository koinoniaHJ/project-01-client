// ********** Renderer와 Main Process 사이의 안전한 IPC 연결 제공 **********

// contextBridge: Main Process로 'api:request' IPC 요청을 보내고 처리 결과를 Promise로 반환한다.
    // Promise: 지금 결과는 없지만, 작업이 끝나면 결과나 오류를 알려주겠다는 약속
// ipcRenderer: Renderer 측에서 Main Process로 IPC 요청을 보내기 위한 Electron 모듈
const { contextBridge, ipcRenderer } = require('electron');

// Renderer의 window 객체에 erpApi 객체를 추가하고, 그 erpApi 객체 안에 request() 함수를 노출한다.
// Renderer에서는 window.erpApi 형태로 접근할 수 있다.
contextBridge.exposeInMainWorld('erpApi', {

    // Renderer에서 API 요청을 전달할 때 사용하는 함수
    // path: 요청할 API 경로
    // options: HTTP Method, headers, body 등의 요청 설정이며 전달되지 않으면 빈 객체를 사용한다.
    request(path, options = {}) {

        // Main Process로 'api:request'라는 이름의 IPC 요청을 보내고 처리 결과를 반환받는다.
        return ipcRenderer.invoke(
            'api:request',

            // Main Process에 전달할 데이터
            {
                // 요청할 API 경로
                path,

                // HTTP Method, headers, body 등의 요청 설정
                options
            }
        );
    }
});
