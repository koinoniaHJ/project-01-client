// ********** 메인 화면의 사용자 정보 표시와 로그아웃 처리 **********

import { getApiErrorMessage } from './api.js';
import { hasRole, requireAuth, logout } from './auth.js';


const currentUserName = document.querySelector('#currentUserName');
const currentUserRole = document.querySelector('#currentUserRole');
const logoutButton = document.querySelector('#logoutButton');
const pageError = document.querySelector('#pageError');
const usersMenuButton = document.querySelector('#usersMenuButton');
const customersMenuButton = document.querySelector('#customersMenuButton');
const suppliersMenuButton = document.querySelector('#suppliersMenuButton');
const itemsMenuButton = document.querySelector('#itemsMenuButton');
const warehousesMenuButton = document.querySelector('#warehousesMenuButton');

async function initialize() {

    try {

        const user = await requireAuth();

        if (!user) {
            return; // initialize() 종료
        }

        currentUserName.textContent = user.userName;

        currentUserRole.textContent = user.role;

        // 사용자 관리 진입 메뉴는 ADMIN 역할에만 표시한다.
        usersMenuButton.hidden = !hasRole('ADMIN');

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

// 현재 구현된 기준정보 업무 화면 이동
usersMenuButton.addEventListener('click', () => window.location.href = './users.html');
customersMenuButton.addEventListener('click', () => window.location.href = './customers.html');
suppliersMenuButton.addEventListener('click', () => window.location.href = './suppliers.html');
itemsMenuButton.addEventListener('click', () => window.location.href = './items.html');
warehousesMenuButton.addEventListener('click', () => window.location.href = './warehouses.html');

initialize();
