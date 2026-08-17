// ********** 웹과 Electron 환경의 공통 API 요청, CSRF 및 오류 처리 **********

// 일반 웹에서 사용할 Spring Boot REST API의 공통 기본 경로
const API_BASE_URL = '/api/v1';

// 현재 세션에서 사용할 CSRF 토큰을 저장
let csrfToken = null;

// ========== API 오류 정보 저장 객체 ==========
// HTTP 상태 코드와 서버 응답 내용을 함께 저장하는 사용자 정의 오류 클래스이다.
export class ApiError extends Error {

    // HTTP 상태 코드와 응답 본문을 전달받아 오류 객체를 만든다.
    constructor(status, body) {

        // 서버 응답에서 오류 메시지를 찾아 기본 Error 클래스에 전달한다.
        super(
            // 표준 오류 응답 안의 메시지를 가장 먼저 사용한다.
            body?.error?.message
            // 표준 오류 메시지가 없으면 응답의 message를 사용한다.
            ?? body?.message
            // 서버 메시지가 모두 없으면 기본 오류 메시지를 사용한다.
            ?? 'API 요청 처리 중 오류가 발생했습니다.'
        );

        // 오류의 이름을 ApiError로 지정한다.
        this.name = 'ApiError';

        // HTTP 상태 코드를 오류 객체에 저장한다.
        this.status = status;

        // 서버가 보낸 응답 본문을 오류 객체에 저장한다.
        this.body = body;
    }
}

// ========== 화면에 표시할 API 오류 메시지 추출 함수 ==========
// 다양한 오류 객체에서 화면에 표시할 메시지를 찾아 반환한다.
export function getApiErrorMessage(error) {

    // 서버의 표준 오류 응답 안에 있는 메시지를 가장 먼저 찾는다.
    return error?.body?.error?.message
        // 표준 오류 메시지가 없으면 응답 본문의 message를 찾는다.
        ?? error?.body?.message
        // 서버 메시지가 없으면 JavaScript Error의 message를 찾는다.
        ?? error?.message
        // 어떤 메시지도 없으면 기본 오류 메시지를 반환한다.
        ?? '요청 처리 중 오류가 발생했습니다.';
}

// ========== 화면에서 사용하는 HTTP Method별 API 객체 ==========
// 화면에서 API 요청을 시작할 때 사용하는 공개 객체이다.
// 일반 웹: api 메서드 → request() → send() → browserRequest()
// Electron: api 메서드 → request() → send() → preload.js → main.js
export const api = {

    // ========== 데이터 조회용 GET 요청 함수 ==========
    // 전달받은 경로로 GET 요청을 보낸다.
    get(path) {
        // 공통 요청 함수에 경로와 GET 설정을 전달한다.
        return request(
            // 요청할 API 경로를 전달한다.
            path,
            {
                // HTTP Method를 GET으로 지정한다.
                method: 'GET'
            }
        );
    },

    // ========== 데이터 생성용 POST 요청 함수 ==========
    // 전달받은 경로와 데이터를 사용하여 POST 요청을 보낸다.
    post(path, data) {
        // 공통 요청 함수에 경로와 POST 설정을 전달한다.
        return request(
            // 요청할 API 경로를 전달한다.
            path,
            {
                // HTTP Method를 POST로 지정한다.
                method: 'POST',

                // JavaScript 객체를 서버에 보낼 JSON 문자열로 변환한다.
                body: JSON.stringify(data)
            }
        );
    },

    // ========== 데이터 전체 수정용 PUT 요청 함수 ==========
    // 전달받은 경로와 데이터를 사용하여 PUT 요청을 보낸다.
    put(path, data) {
        // 공통 요청 함수에 경로와 PUT 설정을 전달한다.
        return request(
            // 요청할 API 경로를 전달한다.
            path,
            {
                // HTTP Method를 PUT으로 지정한다.
                method: 'PUT',
                // JavaScript 객체를 서버에 보낼 JSON 문자열로 변환한다.
                body: JSON.stringify(data)
            }
        );
    },

    // ========== 데이터 일부 수정용 PATCH 요청 함수 ==========
    // 전달받은 경로와 데이터를 사용하여 PATCH 요청을 보낸다.
    patch(path, data) {
        // 공통 요청 함수에 경로와 PATCH 설정을 전달한다.
        return request(
            // 요청할 API 경로를 전달한다.
            path,
            {
                // HTTP Method를 PATCH로 지정한다.
                method: 'PATCH',
                // JavaScript 객체를 서버에 보낼 JSON 문자열로 변환한다.
                body: JSON.stringify(data)
            }
        );
    },

    // ========== 데이터 삭제용 DELETE 요청 함수 ==========
    // 전달받은 경로로 DELETE 요청을 보낸다.
    delete(path) {
        // 공통 요청 함수에 경로와 DELETE 설정을 전달한다.
        return request(
            // 요청할 API 경로를 전달한다.
            path,
            {
                // HTTP Method를 DELETE로 지정한다.
                method: 'DELETE'
            }
        );
    },

    // ========== 외부용 CSRF 토큰 재발급 함수 ==========
    // 외부에서도 CSRF 토큰을 새로 발급받을 수 있도록 함수를 공개한다.
    refreshCsrfToken,

    // ========== 저장된 CSRF 토큰 제거 함수 ==========
    // 현재 저장된 CSRF 토큰을 제거한다.
    clearCsrfToken() {
        // 다음 변경 요청에서 토큰을 다시 발급받도록 null로 초기화한다.
        csrfToken = null;
    }
};

// ========== 공통 API 요청 설정 및 결과 처리 함수 ==========
// api 객체에서 받은 요청에 Header와 CSRF 토큰 등을 추가한다.
// path에는 '/customers' 같은 API 경로가 들어온다.
// options에는 HTTP Method, Header, Body 등의 설정이 들어온다.
async function request(path, options = {}) {

    // 전달받은 HTTP Method를 대문자로 변환하고 없으면 GET을 사용한다.
    const method = (
        // options에 method가 없으면 GET을 기본값으로 선택한다.
        options.method ?? 'GET'
    ).toUpperCase();

    // 호출한 쪽에서 전달한 Header를 새로운 객체에 복사한다.
    const headers = {
        // options.headers가 없어도 빈 Header 객체가 만들어진다.
        ...options.headers
    };

    // 요청에 Body가 포함되어 있는지 확인한다.
    if (options.body !== undefined) {
        // Body가 JSON 문자열임을 서버에 알리는 Header를 추가한다.
        headers['Content-Type'] = 'application/json';
    }

    // 서버 데이터를 변경하는 HTTP Method인지 확인한다.
    if (
        // POST 요청인지 확인한다.
        method === 'POST'
        // PUT 요청인지 확인한다.
        || method === 'PUT'
        // PATCH 요청인지 확인한다.
        || method === 'PATCH'
        // DELETE 요청인지 확인한다.
        || method === 'DELETE'
    ) {

        // 저장된 CSRF 토큰이 없는지 확인한다.
        if (!csrfToken) {
            // 서버에서 CSRF 토큰을 먼저 발급받는다.
            await refreshCsrfToken();
        }

        // Spring Security가 확인할 수 있도록 CSRF 토큰을 Header에 넣는다.
        headers['X-CSRF-TOKEN'] = csrfToken;
    }

    // 완성된 요청 정보를 Electron IPC 또는 fetch() 방식으로 전달한다.
    const result = await send(
        // 호출할 API 경로를 전달한다.
        path,
        {
            // 호출한 쪽에서 전달한 기존 요청 설정을 복사한다.
            ...options,
            // 대문자로 정리한 HTTP Method를 덮어쓴다.
            method,
            // Content-Type과 CSRF 토큰이 반영된 Header를 덮어쓴다.
            headers
        }
    );

    // HTTP 상태 코드가 2xx가 아닌지 확인한다.
    if (!result.ok) {
        // 화면에서 실패를 처리할 수 있도록 ApiError를 발생시킨다.
        throw new ApiError(
            // 실패한 HTTP 상태 코드를 전달한다.
            result.status,
            // 서버가 반환한 오류 응답 본문을 전달한다.
            result.body
        );
    }

    // 요청이 성공하면 서버의 응답 본문만 호출한 쪽에 반환한다.
    return result.body;
}

// ========== CSRF 토큰 발급 및 저장 함수 ==========
// 현재 세션에서 사용할 CSRF 토큰을 서버에서 새로 발급받는다.
async function refreshCsrfToken() {

    // CSRF 토큰 발급 API를 호출한다.
    const result = await send(
        // CSRF 토큰 발급 API 경로
        '/auth/csrf',
        {
            // 토큰 조회 요청이므로 GET 방식을 사용
            method: 'GET'
        }
    );

    // HTTP 상태 코드가 2xx가 아니면 요청 실패로 처리한다.
    if (!result.ok) {
        // 상태 코드와 응답 본문을 담은 ApiError를 발생시킨다.
        throw new ApiError(
            // 실패한 HTTP 상태 코드를 전달한다.
            result.status,
            // 서버가 반환한 오류 응답 본문을 전달한다.
            result.body
        );
    }

    // 응답 본문에서 CSRF 토큰을 꺼내 저장한다.
    csrfToken = result.body?.data?.token ?? null;

    // 응답에 CSRF 토큰이 없었는지 확인한다.
    if (!csrfToken) {
        // 토큰을 확인할 수 없다는 오류를 발생시킨다.
        throw new Error(
            'CSRF 토큰을 확인할 수 없습니다.'
        );
    }

    // 새로 발급받아 저장한 CSRF 토큰을 반환한다.
    return csrfToken;
}

// ========== 실행 환경에 맞는 API 요청 방식 선택 함수 ==========
// Electron이면 preload.js로 전달하고 일반 웹이면 browserRequest()를 호출한다.
async function send(path, options) {

    // preload.js가 노출한 API 요청 함수가 있는지 확인한다.
    if (window.erpApi?.request) {
        // Electron에서는 IPC를 통해 Main Process에 API 요청을 전달한다.
        return window.erpApi.request(
            // 요청할 API 경로를 전달한다.
            path,
            // HTTP Method, Header, Body 등의 요청 설정을 전달한다.
            options
        );
    }

    // 일반 웹 브라우저에서는 fetch()를 사용하는 함수로 요청한다.
    return browserRequest(
        // 요청할 API 경로를 전달한다.
        path,
        // HTTP Method, Header, Body 등의 요청 설정을 전달한다.
        options
    );
}

// ========== 일반 웹 브라우저의 HTTP 요청 처리 함수 ==========
// 일반 웹 브라우저에서 fetch()로 Spring Boot API를 호출한다.
async function browserRequest(path, options) {

    // 기본 API 경로와 전달받은 세부 경로로 HTTP 요청을 보낸다.
    const response = await fetch(
        // 최종 요청 URL을 만든다.
        `${API_BASE_URL}${path}`,
        {
            // HTTP Method, Header, Body 등의 요청 설정을 복사한다.
            ...options,

            // JSESSIONID 같은 쿠키를 요청에 포함하여 세션을 유지한다.
            credentials: 'include'
        }
    );

    // 서버의 응답 본문을 문자열로 읽는다.
    const text = await response.text();

    // 응답 본문의 기본값을 null로 지정한다.
    let body = null;

    // 응답 본문이 비어 있지 않은 경우에만 내용을 변환한다.
    if (text) {
        try {
            // JSON 문자열이면 JavaScript 객체로 변환한다.
            body = JSON.parse(text);
        } catch {
            // JSON 형식이 아니면 원래 문자열을 그대로 사용한다.
            body = text;
        }
    }

    // HTTP 상태와 변환한 응답 본문을 하나의 객체로 반환한다.
    return {
        // HTTP 상태 코드가 200~299이면 true가 된다.
        ok: response.ok,

        // 서버가 반환한 HTTP 상태 코드이다.
        status: response.status,

        // 서버가 반환한 응답 본문이다.
        body
    };
}
