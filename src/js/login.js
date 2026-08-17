// ********** 로그인 화면의 입력 검증, 로그인 요청 및 UI 상태 처리 **********

import { api, getApiErrorMessage} from './api.js';


const loginForm = document.querySelector('#loginForm');
const usernameInput = document.querySelector('#username');
const passwordInput = document.querySelector('#password');
const passwordToggle = document.querySelector('#passwordToggle');
const loginButton = document.querySelector('#loginButton');
const loginError = document.querySelector('#loginError');


function showError(message) {

    const messageElement = loginError.querySelector('span');

    messageElement.textContent = message;

    loginError.hidden = false;
}


function clearError() {

    loginError.hidden = true;

    const messageElement = loginError.querySelector('span');

    messageElement.textContent = '';

    usernameInput.closest('.form-input-shell')?.classList.remove('is-error');

    passwordInput.closest('.form-input-shell')?.classList.remove('is-error');
}


function showInputError(input, message) {

    input.closest('.form-input-shell')?.classList.add('is-error');

    showError(message);

    input.focus();
}


// 서버 요청 전에 클라이언트에서 바로 확인할 수 있는 필수 입력값을 먼저 검사한다.
function validateLogin() {

    clearError();

    if (usernameInput.value.trim() === '') {

        showInputError(usernameInput,'로그인 아이디를 입력해주세요.');

        return false;
    }

    if (passwordInput.value.trim() === '') {

        showInputError(passwordInput,'비밀번호를 입력해주세요.');

        return false;
    }

    return true;
}


async function handleLogin(event) {

    event.preventDefault();

    if (!validateLogin()) {
        return;
    }

    loginButton.disabled = true;

    try {

        await api.post('/auth/login',
            {
                username: usernameInput.value,
                password: passwordInput.value
            }
        );

        // 로그인 성공 시 서버에서 로그인 전 CSRF 토큰을 제거하므로 클라이언트에 저장한 토큰도 제거한다.
        api.clearCsrfToken();

        window.location.replace('./index.html');

    } catch (error) {

        showError(getApiErrorMessage(error, '로그인 중 오류가 발생했습니다.'));

        loginButton.disabled = false;
    }
}


function togglePassword() {

    const showPassword = passwordInput.type === 'password';

    passwordInput.type = showPassword ? 'text' : 'password';

    passwordToggle.setAttribute('aria-label', showPassword ? '비밀번호 숨기기' : '비밀번호 표시');
}


loginForm.addEventListener('submit', handleLogin);

passwordToggle.addEventListener('click', togglePassword);

usernameInput.addEventListener('input', clearError);

passwordInput.addEventListener('input', clearError);
