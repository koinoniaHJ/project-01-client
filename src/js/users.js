// ********** 사용자 관리 화면의 목록 조회, 등록, 수정, 상태 변경 및 비밀번호 초기화 처리 **********

import { api, getApiErrorMessage } from './api.js';
import { hasRole, logout, requireAuth } from './auth.js';

// 사용자 목록에서 한 페이지에 표시할 개수
const PAGE_SIZE = 20;

// 현재 조회된 사용자 목록과 페이지 정보를 저장한다.
let users = [];
let pageMeta = null;

// 현재 사용자 정보 Form의 상태를 저장한다.
// create: 신규 등록 / edit: 기존 사용자 수정
let formMode = null;

// 현재 선택한 사용자의 전체 응답 정보를 저장한다.
// userId와 version도 함께 보관하여 수정 요청에 사용한다.
let selectedUser = null;

// Mobile에서 사용자 정보 하단 Panel이 열려 있는지 저장한다.
let mobileDetailOpen = false;

// ========== 상단 사용자 정보 ==========
const currentUserName = document.querySelector('#currentUserName');
const logoutButton = document.querySelector('#logoutButton');
const userPageError = document.querySelector('#userPageError');
const dashboardMenuButton = document.querySelector('#dashboardMenuButton');
const usersMenuButton = document.querySelector('#usersMenuButton');
const customersMenuButton = document.querySelector('#customersMenuButton');

// ========== 사용자 목록 Filter ==========
const roleFilter = document.querySelector('#roleFilter');
const statusFilter = document.querySelector('#statusFilter');
const filterResetButton = document.querySelector('#filterResetButton');
const newUserButton = document.querySelector('#newUserButton');

// ========== 사용자 목록 ==========
const userCount = document.querySelector('#userCount');
const userTableBody = document.querySelector('#userTableBody');
const userMobileList = document.querySelector('#userMobileList');
const pagination = document.querySelector('#pagination');

// ========== 사용자 정보 Form ==========
const userDetailSection = document.querySelector('#userDetailSection');
const userDetailModeText = document.querySelector('#userDetailModeText');
const detailCloseButton = document.querySelector('#detailCloseButton');
const userDetailEmpty = document.querySelector('#userDetailEmpty');
const userDetailForm = document.querySelector('#userDetailForm');
const userUsername = document.querySelector('#userUsername');
const userName = document.querySelector('#userName');
const userRole = document.querySelector('#userRole');
const userStatus = document.querySelector('#userStatus');
const createStatusHelp = document.querySelector('#createStatusHelp');
const createPasswordField = document.querySelector('#createPasswordField');
const createPassword = document.querySelector('#createPassword');
const userFormError = document.querySelector('#userFormError');
const passwordResetButton = document.querySelector('#passwordResetButton');
const statusChangeButton = document.querySelector('#statusChangeButton');
const userSaveButton = document.querySelector('#userSaveButton');

// ========== 비밀번호 초기화 Modal ==========
const passwordModalBackdrop = document.querySelector('#passwordModalBackdrop');
const passwordResetForm = document.querySelector('#passwordResetForm');
const passwordModalCloseButton = document.querySelector('#passwordModalCloseButton');
const passwordTargetUser = document.querySelector('#passwordTargetUser');
const newPassword = document.querySelector('#newPassword');
const newPasswordConfirm = document.querySelector('#newPasswordConfirm');
const passwordResetError = document.querySelector('#passwordResetError');
const passwordCancelButton = document.querySelector('#passwordCancelButton');
const passwordConfirmButton = document.querySelector('#passwordConfirmButton');

// 사용자 관리 화면 진입 시 Session과 ADMIN 역할을 확인하고 사용자 목록을 조회한다.
async function initialize() {

    syncDetailVisibility();
    clearPageError();

    try {

        const currentUser = await requireAuth();

        if (!currentUser) {
            return;
        }

        // 사용자 관리 화면은 ADMIN 전용이므로 다른 역할은 공통 업무 화면으로 이동한다.
        if (!hasRole('ADMIN')) {
            window.location.replace('./index.html');
            return;
        }

        currentUserName.textContent = currentUser.userName;

        await loadUsers(0);

        // PC / Tablet에서는 조회된 첫 사용자를 기본 선택한다.
        if (!isMobile() && users.length > 0) {
            enterEditMode(users[0], false);
        } else if (users.length === 0) {
            showDetailEmpty();
        }

        syncDetailVisibility();

    } catch (error) {
        handlePageError(error, '사용자 관리 화면을 불러오지 못했습니다.');
    }
}

// 현재 Filter와 페이지 번호를 이용하여 사용자 목록 조회 경로를 만든다.
function buildUserListPath(page) {

    const params = new URLSearchParams();

    if (roleFilter.value) {
        params.set('role', roleFilter.value);
    }

    if (statusFilter.value) {
        params.set('status', statusFilter.value);
    }

    params.set('page', String(page));
    params.set('size', String(PAGE_SIZE));
    params.set('sort', 'userId,desc');

    return `/users?${params.toString()}`;
}

// 사용자 목록을 서버에서 조회한다.
async function loadUsers(page = 0) {

    const response = await api.get(buildUserListPath(page));

    users = response.data ?? [];
    pageMeta = response.meta ?? null;

    userCount.textContent = `전체 ${pageMeta?.totalElements ?? users.length}건`;

    renderUserList();
    renderPagination();
}

// 사용자 목록 Table과 Mobile Card를 현재 조회 결과로 다시 만든다.
function renderUserList() {

    userTableBody.innerHTML = '';
    userMobileList.innerHTML = '';

    if (users.length === 0) {
        userTableBody.innerHTML = '<tr><td colspan="5">조회된 사용자가 없습니다.</td></tr>';
        userMobileList.innerHTML = '<p class="section-description">조회된 사용자가 없습니다.</p>';
        return;
    }

    users.forEach(user => {
        userTableBody.append(createUserTableRow(user));
        userMobileList.append(createUserMobileItem(user));
    });
}

// PC / Tablet 사용자 Table의 한 행을 만든다.
function createUserTableRow(user) {

    const row = document.createElement('tr');

    row.dataset.userId = String(user.userId);
    row.classList.toggle('is-selected', selectedUser?.userId === user.userId);

    row.innerHTML = `
        <td>${escapeHtml(user.username)}</td>
        <td>${escapeHtml(user.userName)}</td>
        <td><span class="role-badge">${escapeHtml(user.role)}</span></td>
        <td>${createStatusBadge(user.status)}</td>
        <td>${formatLastLoginAt(user.lastLoginAt)}</td>
    `;

    row.addEventListener('click', () => enterEditMode(user));

    return row;
}

// Mobile 사용자 목록의 한 Card를 만든다.
function createUserMobileItem(user) {

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'user-mobile-item';
    button.classList.toggle('is-selected', selectedUser?.userId === user.userId);

    button.innerHTML = `
        <span class="user-mobile-top">
            <span class="user-mobile-name">${escapeHtml(user.username)}</span>
            ${createStatusBadge(user.status)}
        </span>
        <span class="user-mobile-bottom">
            <span class="user-mobile-sub">${escapeHtml(user.userName)}</span>
            <span class="role-badge">${escapeHtml(user.role)}</span>
        </span>
        <span class="user-mobile-sub">최종 로그인 ${formatLastLoginAt(user.lastLoginAt)}</span>
    `;

    button.addEventListener('click', () => enterEditMode(user));

    return button;
}

// 서버의 페이지 정보를 이용하여 Pagination 버튼을 만든다.
function renderPagination() {

    pagination.innerHTML = '';

    if (!pageMeta || pageMeta.totalPages <= 1) {
        return;
    }

    const currentPage = pageMeta.page;
    const totalPages = pageMeta.totalPages;
    const firstVisiblePage = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
    const lastVisiblePage = Math.min(totalPages, firstVisiblePage + 5);

    pagination.append(createPageButton('‹', currentPage - 1, currentPage === 0));

    for (let page = firstVisiblePage; page < lastVisiblePage; page += 1) {

        const button = createPageButton(String(page + 1), page, false);

        if (page === currentPage) {
            button.classList.add('is-active');
        }

        pagination.append(button);
    }

    pagination.append(createPageButton('›', currentPage + 1, currentPage >= totalPages - 1));
}

// Pagination에서 사용할 페이지 이동 버튼을 만든다.
function createPageButton(label, page, disabled) {

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'page-button';
    button.textContent = label;
    button.disabled = disabled;

    button.addEventListener('click', async () => {

        try {
            await moveToPage(page);
        } catch (error) {
            handlePageError(error, '사용자 목록을 불러오지 못했습니다.');
        }
    });

    return button;
}

// 지정한 페이지를 조회한 뒤 화면 크기에 맞는 기본 상세 상태를 적용한다.
async function moveToPage(page) {

    clearPageError();

    selectedUser = null;
    formMode = null;
    mobileDetailOpen = false;

    await loadUsers(page);

    applyDefaultDetailState();
}

// 목록이 새로 조회된 뒤 PC / Tablet과 Mobile에 맞는 상세 상태를 적용한다.
function applyDefaultDetailState() {

    if (!isMobile() && users.length > 0) {
        enterEditMode(users[0], false);
        return;
    }

    showDetailEmpty();
    syncDetailVisibility();
}

// + 신규 등록 버튼을 눌렀을 때 같은 사용자 정보 Form을 등록 상태로 전환한다.
function enterCreateMode() {

    formMode = 'create';
    selectedUser = null;
    mobileDetailOpen = true;

    userDetailEmpty.hidden = true;
    userDetailForm.hidden = false;

    userDetailModeText.textContent = '신규 사용자 등록';

    userUsername.value = '';
    userUsername.readOnly = false;

    userName.value = '';
    userRole.value = '';

    // 신규 사용자는 서버에서 ACTIVE로 생성되므로 화면에서도 사용중으로 고정한다.
    userStatus.value = 'ACTIVE';
    userStatus.disabled = true;

    createStatusHelp.hidden = false;
    createPasswordField.hidden = false;
    createPassword.value = '';

    passwordResetButton.hidden = true;
    statusChangeButton.hidden = true;

    userSaveButton.textContent = '사용자 등록';

    clearFormError();
    renderUserList();
    syncDetailVisibility();

    userUsername.focus();
}

// 사용자 목록을 선택했을 때 같은 사용자 정보 Form을 수정 상태로 전환한다.
function enterEditMode(user, openMobilePanel = true) {

    formMode = 'edit';
    selectedUser = user;

    if (openMobilePanel) {
        mobileDetailOpen = true;
    }

    userDetailEmpty.hidden = true;
    userDetailForm.hidden = false;

    userDetailModeText.textContent = '선택한 사용자 정보를 수정할 수 있습니다.';

    // 로그인 아이디는 등록 후 수정하지 않으므로 readonly로 표시한다.
    userUsername.value = user.username;
    userUsername.readOnly = true;

    userName.value = user.userName;
    userRole.value = user.role;

    userStatus.value = user.status;
    userStatus.disabled = false;

    createStatusHelp.hidden = true;
    createPasswordField.hidden = true;
    createPassword.value = '';

    passwordResetButton.hidden = false;
    statusChangeButton.hidden = false;

    userSaveButton.textContent = '저장';

    clearFormError();
    renderUserList();
    syncDetailVisibility();
}

// 선택된 사용자가 없을 때 사용자 정보 영역의 안내 문구를 표시한다.
function showDetailEmpty() {

    formMode = null;
    selectedUser = null;

    userDetailModeText.textContent = '';
    userDetailForm.hidden = true;
    userDetailEmpty.hidden = false;

    renderUserList();
}

// 사용자 정보 Form의 submit을 등록 또는 수정 모드에 맞게 처리한다.
async function handleUserSubmit(event) {

    event.preventDefault();

    clearFormError();

    if (formMode === 'create') {
        await createUser();
        return;
    }

    if (formMode === 'edit') {
        await updateUser();
    }
}

// 신규 사용자 등록 입력값을 확인한다.
function validateCreateUser() {

    if (userUsername.value.trim() === '') {
        showFormError('로그인 아이디를 입력해주세요.');
        userUsername.focus();
        return false;
    }

    if (userName.value.trim() === '') {
        showFormError('사용자명을 입력해주세요.');
        userName.focus();
        return false;
    }

    if (!userRole.value) {
        showFormError('역할을 선택해주세요.');
        userRole.focus();
        return false;
    }

    if (createPassword.value.trim() === '') {
        showFormError('비밀번호를 입력해주세요.');
        createPassword.focus();
        return false;
    }

    return true;
}

// 기존 사용자 수정 입력값을 확인한다.
function validateUpdateUser() {

    if (userName.value.trim() === '') {
        showFormError('사용자명을 입력해주세요.');
        userName.focus();
        return false;
    }

    if (!userRole.value) {
        showFormError('역할을 선택해주세요.');
        userRole.focus();
        return false;
    }

    return true;
}

// 신규 사용자를 등록한다.
async function createUser() {

    if (!validateCreateUser()) {
        return;
    }

    const username = userUsername.value.trim();
    const password = createPassword.value;
    const name = userName.value.trim();
    const role = userRole.value;

    setDetailButtonsDisabled(true);

    try {

        const response = await api.post('/users', { username, password, userName: name, role });
        const createdUser = response.data;

        // 등록된 사용자가 첫 페이지에 표시되도록 Filter를 초기화하고 목록을 다시 조회한다.
        roleFilter.value = '';
        statusFilter.value = '';

        selectedUser = createdUser;

        await loadUsers(0);

        const loadedUser = users.find(user => user.userId === createdUser.userId) ?? createdUser;

        enterEditMode(loadedUser);

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        showFormError(getApiErrorMessage(error));

    } finally {
        setDetailButtonsDisabled(false);
    }
}

// 선택한 사용자의 사용자명과 역할을 수정한다.
async function updateUser() {

    if (!selectedUser || !validateUpdateUser()) {
        return;
    }

    const userId = selectedUser.userId;
    const name = userName.value.trim();
    const role = userRole.value;
    const version = selectedUser.version;

    setDetailButtonsDisabled(true);

    try {

        const response = await api.patch(`/users/${userId}`, { userName: name, role, version });
        const updatedUser = response.data;

        await reloadCurrentPageAndSelect(updatedUser);

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        await handleFormMutationError(error);

    } finally {
        setDetailButtonsDisabled(false);
    }
}

// 사용 상태 Select의 값과 현재 저장된 상태가 다른지 확인한 뒤 상태 변경 API를 호출한다.
async function changeUserStatus() {

    if (!selectedUser) {
        return;
    }

    const status = userStatus.value;

    clearFormError();

    if (status === selectedUser.status) {
        showFormError('변경할 사용 상태를 선택해주세요.');
        return;
    }

    const statusLabel = status === 'ACTIVE' ? '사용중' : '사용중지';
    const message = `${selectedUser.userName} 사용자의 상태를 '${statusLabel}'(으)로 변경하시겠습니까?`;

    const confirmed = window.erpApi?.confirm ? await window.erpApi.confirm(message) : window.confirm(message);

    if (!confirmed) {
        userStatus.value = selectedUser.status;
        return;
    }

    const userId = selectedUser.userId;
    const version = selectedUser.version;

    setDetailButtonsDisabled(true);

    try {

        const response = await api.post(`/users/${userId}/status`, { status, version });
        const updatedUser = response.data;

        await reloadCurrentPageAndSelect(updatedUser);

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        // 상태 변경에 실패하면 화면 Select도 서버에서 알고 있던 기존 상태로 되돌린다.
        userStatus.value = selectedUser.status;

        await handleFormMutationError(error);

    } finally {
        setDetailButtonsDisabled(false);
    }
}

// 비밀번호 초기화 Modal을 연다.
function openPasswordModal() {

    if (!selectedUser) {
        return;
    }

    passwordTargetUser.textContent = `대상 사용자: ${selectedUser.userName} (${selectedUser.username})`;

    newPassword.value = '';
    newPasswordConfirm.value = '';

    clearPasswordResetError();

    passwordModalBackdrop.hidden = false;

    newPassword.focus();
}

// 비밀번호 초기화 Modal을 닫는다.
function closePasswordModal() {

    passwordModalBackdrop.hidden = true;

    newPassword.value = '';
    newPasswordConfirm.value = '';

    clearPasswordResetError();
}

// 새 비밀번호와 확인값을 검사한다.
function validatePasswordReset() {

    clearPasswordResetError();

    if (newPassword.value.trim() === '') {
        showPasswordResetError('새 비밀번호를 입력해주세요.');
        newPassword.focus();
        return false;
    }

    if (newPasswordConfirm.value.trim() === '') {
        showPasswordResetError('새 비밀번호 확인을 입력해주세요.');
        newPasswordConfirm.focus();
        return false;
    }

    if (newPassword.value !== newPasswordConfirm.value) {
        showPasswordResetError('새 비밀번호가 일치하지 않습니다.');
        newPasswordConfirm.focus();
        return false;
    }

    return true;
}

// 선택한 사용자의 비밀번호를 초기화한다.
async function handlePasswordReset(event) {

    event.preventDefault();

    if (!selectedUser || !validatePasswordReset()) {
        return;
    }

    const userId = selectedUser.userId;
    const version = selectedUser.version;
    const password = newPassword.value;

    passwordConfirmButton.disabled = true;

    try {

        const response = await api.patch(`/users/${userId}/password`, { newPassword: password, version });
        const updatedUser = response.data;

        // 비밀번호 초기화는 목록 표시값을 바꾸지 않지만 version이 변경되므로 최신 응답으로 교체한다.
        replaceUserInCurrentList(updatedUser);

        selectedUser = updatedUser;

        closePasswordModal();
        enterEditMode(updatedUser);

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        if (error?.status === 409) {

            const message = getApiErrorMessage(error);

            closePasswordModal();

            try {
                await reloadSelectedUser();
                showFormError(message);
            } catch (reloadError) {
                handlePageError(reloadError, '최신 사용자 정보를 다시 조회하지 못했습니다.');
            }

            return;
        }

        showPasswordResetError(getApiErrorMessage(error));

    } finally {
        passwordConfirmButton.disabled = false;
    }
}

// 역할 또는 사용 상태 Filter가 변경되면 첫 페이지부터 다시 조회한다.
async function applyFilters() {

    clearPageError();

    selectedUser = null;
    formMode = null;
    mobileDetailOpen = false;

    try {

        await loadUsers(0);

        applyDefaultDetailState();

    } catch (error) {
        handlePageError(error, '사용자 목록을 불러오지 못했습니다.');
    }
}

// Filter를 모두 초기화하고 첫 페이지를 다시 조회한다.
async function resetFilters() {

    roleFilter.value = '';
    statusFilter.value = '';

    await applyFilters();
}

// 수정 또는 상태 변경 후 현재 페이지를 다시 조회하고 변경된 사용자를 다시 선택한다.
async function reloadCurrentPageAndSelect(updatedUser) {

    const currentPage = pageMeta?.page ?? 0;

    selectedUser = updatedUser;

    await loadUsers(currentPage);

    const refreshedUser = users.find(user => user.userId === updatedUser.userId);

    // 역할 또는 상태 Filter 때문에 변경한 사용자가 현재 목록에서 제외된 경우 기본 상세 상태로 돌아간다.
    if (!refreshedUser) {
        mobileDetailOpen = false;
        applyDefaultDetailState();
        return;
    }

    enterEditMode(refreshedUser);
}

// 409 Conflict 발생 시 현재 선택 사용자의 최신 version을 다시 조회한다.
async function reloadSelectedUser() {

    if (!selectedUser) {
        return;
    }

    const selectedUserId = selectedUser.userId;
    const currentPage = pageMeta?.page ?? 0;

    await loadUsers(currentPage);

    const refreshedUser = users.find(user => user.userId === selectedUserId);

    if (refreshedUser) {
        enterEditMode(refreshedUser);
        return;
    }

    mobileDetailOpen = false;
    applyDefaultDetailState();
}

// 수정 요청에서 발생한 오류를 처리한다.
// version 충돌이면 목록을 다시 조회하여 화면의 version도 최신 값으로 바꾼다.
async function handleFormMutationError(error) {

    const message = getApiErrorMessage(error);

    if (error?.status !== 409) {
        showFormError(message);
        return;
    }

    try {
        await reloadSelectedUser();
        showFormError(message);
    } catch (reloadError) {
        handlePageError(reloadError, '최신 사용자 정보를 다시 조회하지 못했습니다.');
    }
}

// 비밀번호 초기화 성공 응답을 현재 목록의 같은 사용자와 교체한다.
function replaceUserInCurrentList(updatedUser) {

    users = users.map(user => user.userId === updatedUser.userId ? updatedUser : user);

    renderUserList();
}

// 상태 Badge HTML을 만든다.
function createStatusBadge(status) {

    if (status === 'ACTIVE') {
        return '<span class="status-badge is-active">사용중</span>';
    }

    return '<span class="status-badge is-inactive">사용중지</span>';
}

// 최종 로그인 시간을 화면에 표시할 문자열로 변환한다.
function formatLastLoginAt(value) {

    if (!value) {
        return '-';
    }

    return String(value).replace('T', ' ').slice(0, 16);
}

// 서버에서 받은 문자열을 innerHTML에 넣기 전에 HTML 특수문자를 변환한다.
function escapeHtml(value) {

    const element = document.createElement('div');

    element.textContent = value ?? '';

    return element.innerHTML;
}

// 사용자 정보 Form의 버튼을 요청 처리 중 비활성화한다.
function setDetailButtonsDisabled(disabled) {

    userSaveButton.disabled = disabled;
    statusChangeButton.disabled = disabled;
    passwordResetButton.disabled = disabled;
}

// 사용자 정보 Form 오류를 표시한다.
function showFormError(message) {

    userFormError.textContent = message;
    userFormError.hidden = false;
}

// 사용자 정보 Form 오류를 지운다.
function clearFormError() {

    userFormError.textContent = '';
    userFormError.hidden = true;
}

// 비밀번호 초기화 오류를 표시한다.
function showPasswordResetError(message) {

    passwordResetError.textContent = message;
    passwordResetError.hidden = false;
}

// 비밀번호 초기화 오류를 지운다.
function clearPasswordResetError() {

    passwordResetError.textContent = '';
    passwordResetError.hidden = true;
}

// 페이지 공통 오류를 표시한다.
function showPageError(message) {

    userPageError.textContent = message;
    userPageError.hidden = false;
}

// 페이지 공통 오류를 지운다.
function clearPageError() {

    userPageError.textContent = '';
    userPageError.hidden = true;
}

// Session이 만료되어 401이 반환된 경우 로그인 화면으로 이동한다.
function handleUnauthorized(error) {

    if (error?.status !== 401) {
        return false;
    }

    window.location.replace('./login.html');

    return true;
}

// 사용자 관리 화면의 공통 오류를 처리한다.
function handlePageError(error, fallbackMessage) {

    if (handleUnauthorized(error)) {
        return;
    }

    showPageError(error ? getApiErrorMessage(error) : fallbackMessage);
}

// 현재 화면이 Mobile 기준인지 확인한다.
function isMobile() {

    return window.matchMedia('(max-width: 375px)').matches;
}

// Mobile에서 사용자 정보 하단 Panel의 표시 상태를 반영한다.
function syncDetailVisibility() {

    if (!isMobile()) {
        userDetailSection.hidden = false;
        return;
    }

    userDetailSection.hidden = !mobileDetailOpen;
}

// Mobile 사용자 정보 하단 Panel을 닫는다.
function closeMobileDetailPanel() {

    mobileDetailOpen = false;

    syncDetailVisibility();
}

// 로그아웃 버튼을 처리한다.
async function handleLogout() {

    logoutButton.disabled = true;

    try {
        await logout();
    } catch (error) {
        logoutButton.disabled = false;
        handlePageError(error, '로그아웃 중 오류가 발생했습니다.');
    }
}

// + 신규 등록
newUserButton.addEventListener('click', enterCreateMode);

// 현재 구현된 공통 업무 화면 이동
dashboardMenuButton.addEventListener('click', () => window.location.href = './index.html');
usersMenuButton.addEventListener('click', () => window.location.href = './users.html');
customersMenuButton.addEventListener('click', () => window.location.href = './customers.html');

// 역할 / 사용 상태 Filter
roleFilter.addEventListener('change', applyFilters);
statusFilter.addEventListener('change', applyFilters);
filterResetButton.addEventListener('click', resetFilters);

// 사용자 등록 / 수정
userDetailForm.addEventListener('submit', handleUserSubmit);

// 상태 변경
statusChangeButton.addEventListener('click', changeUserStatus);

// 비밀번호 초기화 Modal
passwordResetButton.addEventListener('click', openPasswordModal);
passwordResetForm.addEventListener('submit', handlePasswordReset);
passwordModalCloseButton.addEventListener('click', closePasswordModal);
passwordCancelButton.addEventListener('click', closePasswordModal);

passwordModalBackdrop.addEventListener('click', event => {

    if (event.target === passwordModalBackdrop) {
        closePasswordModal();
    }
});

// Mobile 상세 Panel 닫기
detailCloseButton.addEventListener('click', closeMobileDetailPanel);

// 로그아웃
logoutButton.addEventListener('click', handleLogout);

// 화면 크기 변경 시 Mobile 상세 Panel 표시 상태를 다시 적용한다.
window.addEventListener('resize', syncDetailVisibility);

// 사용자 관리 화면 초기화
initialize();
