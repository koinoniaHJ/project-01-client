// ********** 메인 화면의 사용자 정보 표시와 로그아웃 처리 **********

import { getApiErrorMessage } from './api.js';
import { requireAuth, logout } from './auth.js';


const currentUserName = document.querySelector('#currentUserName');
const currentUserRole = document.querySelector('#currentUserRole');
const logoutButton = document.querySelector('#logoutButton');
const pageError = document.querySelector('#pageError');

async function initialize() {

    try {

        const user = await requireAuth();

        if (!user) {
            return; // initialize() 종료
        }

        currentUserName.textContent = user.userName;

        currentUserRole.textContent = user.role;

    } catch (error) {

        pageError.textContent =
            getApiErrorMessage(error, '현재 사용자 정보를 불러오지 못했습니다.');

        pageError.hidden = false;
    }
}

logoutButton.addEventListener('click', async () => {

        logoutButton.disabled = true;

        try {

            await logout();

        } catch (error) {

            pageError.textContent = getApiErrorMessage(error, '로그아웃 중 오류가 발생했습니다.');

            pageError.hidden = false;

            logoutButton.disabled = false;
        }
    }
);

initialize();