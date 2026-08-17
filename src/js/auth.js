// ********** 로그인 사용자 조회, 권한 확인 및 세션 로그아웃 처리 **********

import { api } from './api.js';

let currentUser = null;


// 현재 로그인 사용자를 조회한다.
export async function loadCurrentUser() {

    const response = await api.get('/auth/me');

    currentUser = response.data;

    return currentUser;
}


// 현재 클라이언트에 저장된 로그인 사용자 정보를 반환한다.
export function getCurrentUser() {
    return currentUser;
}


// 현재 사용자가 전달받은 역할 중 하나인지 확인한다.
export function hasRole(...roles) {

    return currentUser !== null && roles.includes(currentUser.role);
}


// 인증이 필요한 화면에 진입할 때 현재 Session을 확인한다.
export async function requireAuth() {

    try {
        return await loadCurrentUser();

    } catch (error) {

        if (error?.status === 401) {

            currentUser = null;

            window.location.replace('./login.html');

            return null;
        }

        throw error;
    }
}


// 현재 Session을 로그아웃하고 로그인 화면으로 이동한다.
export async function logout() {

    try {
        await api.post('/auth/logout');

    } catch (error) {

        // 이미 Session이 만료된 경우에도 클라이언트는 로그인 화면으로 이동한다.
        if (error?.status !== 401) {
            throw error;
        }
    }

    currentUser = null;

    api.clearCsrfToken();

    window.location.replace('./login.html');
}
