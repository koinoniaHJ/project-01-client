// Spring Boot REST API의 공통 기본 주소
const API_BASE_URL = 'http://localhost:8080/api/v1';

/*
 * 모든 API 요청에서 공통으로 사용하는 함수
 *
 * path: /customers, /orders 등 API 경로
 * options: HTTP method, headers, body 등 fetch()에 전달할 추가 설정
 */
async function request(path, options = {}) {

    // API_BASE_URL과 전달받은 path를 결합하여 HTTP 요청을 보낸다.
    const response = await fetch(`${API_BASE_URL}${path}`, {

        // 호출하는 메서드에서 전달한 method, body 등의 설정을 적용한다.
        ...options,

        // JSESSIONID 등의 쿠키를 요청에 포함하여 세션 인증 상태를 유지한다.
        credentials: 'include',

        headers: {
            // 요청 Body를 JSON 형식으로 전송한다.
            'Content-Type': 'application/json',

            // 호출하는 쪽에서 별도로 전달한 Header가 있으면 함께 적용한다.
            ...options.headers
        }
    });

    // Spring Boot에서 받은 JSON 응답을 JavaScript 객체로 변환한다.
    const body = await response.json();

    /*
     * response.ok:
     * HTTP 상태 코드가 200~299 범위이면 true
     *
     * 2xx가 아닌 경우 Spring Boot의 ErrorResponse를
     * 화면에서 처리할 수 있도록 오류로 전달한다.
     */
    if (!response.ok) {
        throw body;
    }

    // 성공한 경우 Spring Boot의 ApiResponse를 호출한 화면에 반환한다.
    return body;
}

/*
 * 화면에서 HTTP Method별 API를 간단하게 호출할 수 있도록
 * 공통 메서드를 하나의 api 객체로 묶어 외부에 제공한다.
 */
export const api = {

    // GET 요청
    get(path) {
        return request(path, {
            method: 'GET'
        });
    },

    /*
     * POST 요청
     * path: 요청할 API 경로
     * data: 서버의 Request Body로 전달할 JavaScript 객체
     */
    post(path, data) {
        return request(path, {
            method: 'POST',

            // JavaScript 객체를 서버에 전달할 JSON 문자열로 변환한다.
            body: JSON.stringify(data)
        });
    },

    // PUT 요청
    put(path, data) {
        return request(path, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    // PATCH 요청
    patch(path, data) {
        return request(path, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    },

    // DELETE 요청
    delete(path) {
        return request(path, {
            method: 'DELETE'
        });
    }
};