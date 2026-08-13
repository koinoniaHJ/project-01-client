import { api } from './api.js';
// api.js에서 export한 api 객체를 가져와 현재 파일에서 사용한다.

const testApiButton = document.querySelector('#testApiButton');
const result = document.querySelector('#result');

// API 테스트 버튼 클릭 이벤트 등록
testApiButton.addEventListener('click', async () => {
    try {
        // 공통 api.get()을 통해 GET /api/v1/test/success 요청
        const body = await api.get('/test/success');

        // 성공 응답 객체를 보기 쉬운 JSON 문자열로 변환하여 화면에 출력
        result.textContent = JSON.stringify(body, null, 2);
    } catch (error) {
        // API 호출 실패 시 전달받은 오류 응답을 화면에 출력
        result.textContent = JSON.stringify(error, null, 2);
    }
});