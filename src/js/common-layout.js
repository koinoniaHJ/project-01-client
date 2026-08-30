// ********** 모든 ERP 업무 화면의 Sidebar와 Header를 한 곳에서 생성하고 공통 동작을 연결 **********
// 화면별 HTML에는 공통 Layout이 들어갈 빈 영역만 두고, 실제 메뉴 구조와 Header는 이 파일에서 생성한다.
// 새로운 업무 화면이 추가되더라도 개별 화면의 Sidebar와 Header를 복사하지 않고 메뉴 설정만 확장한다.

import { getApiErrorMessage } from './api.js';
import { hasRole, logout, requireAuth } from './auth.js';


// ========== 공통 Layout Element ID ==========
// 각 업무 화면 HTML은 아래 ID를 가진 Sidebar와 Header 영역을 하나씩 제공해야 한다.
const COMMON_SIDEBAR_ID = 'commonSidebar';
const COMMON_HEADER_ID = 'commonHeader';


// ========== ERP 공통 메뉴 설정 ==========
// key는 현재 화면의 활성 메뉴를 구분하고, path는 실제 구현된 화면의 이동 경로로 사용한다.
// path가 null인 메뉴는 화면 구조만 표시하며 해당 업무 화면이 구현될 때 경로를 연결한다.
// adminOnly이 true인 사용자 관리 메뉴는 로그인 사용자가 ADMIN일 때만 표시한다.
const MENU_GROUPS = [
    {
        title: null,
        items: [
            { key: 'dashboard', label: '대시보드', elementId: 'dashboardMenuButton', path: './index.html' }
        ]
    },
    {
        title: '기준정보',
        items: [
            { key: 'users', label: '사용자 관리', elementId: 'usersMenuButton', path: './users.html', adminOnly: true },
            { key: 'customers', label: '거래처 관리', elementId: 'customersMenuButton', path: './customers.html' },
            { key: 'suppliers', label: '공급업체 관리', elementId: 'suppliersMenuButton', path: './suppliers.html' },
            { key: 'items', label: '품목 관리', elementId: 'itemsMenuButton', path: './items.html' },
            { key: 'warehouses', label: '창고 관리', elementId: 'warehousesMenuButton', path: './warehouses.html' },
            { key: 'safetyStock', label: '안전재고 관리', elementId: 'safetyStocksMenuButton', path: './safety-stocks.html' }
        ]
    },
    {
        title: '구매',
        items: [
            { key: 'purchaseOrders', label: '발주 목록', elementId: null, path: null },
            { key: 'receipts', label: '입고 목록', elementId: null, path: null },
            { key: 'purchaseReturns', label: '매입 반품', elementId: null, path: null }
        ]
    },
    {
        title: '판매',
        items: [
            { key: 'orders', label: '주문 목록', elementId: null, path: null },
            { key: 'shipments', label: '출고 목록', elementId: null, path: null },
            { key: 'customerReturns', label: '거래처 반품', elementId: null, path: null }
        ]
    },
    {
        title: '재고',
        items: [
            { key: 'inventory', label: '재고 현황', elementId: null, path: null },
            { key: 'stockMovements', label: '재고 변동 이력', elementId: null, path: null },
            { key: 'stocktakes', label: '재고 실사', elementId: null, path: null },
            { key: 'stockAdjustments', label: '재고 조정', elementId: null, path: null }
        ]
    },
    {
        title: '정산',
        items: [
            { key: 'vouchers', label: '전표 조회', elementId: null, path: null },
            { key: 'payments', label: '입금', elementId: null, path: null },
            { key: 'salesSettlement', label: '매출 정산', elementId: null, path: null },
            { key: 'purchaseStatus', label: '매입 현황', elementId: null, path: null }
        ]
    }
];


// ========== 외부 공개 초기화 메서드 ==========

/**
 * 현재 업무 화면의 공통 Sidebar와 Header를 생성하고 로그인 Session을 확인한다.
 *
 * @param {Object} options 공통 Layout 생성에 필요한 화면별 설정
 * @param {string} options.pageTitle Header에 표시할 업무 화면 제목
 * @param {string} options.activeMenu Sidebar에서 활성 상태로 표시할 메뉴 key
 * @param {(message: string) => void} [options.onError] 로그아웃 오류를 화면에 표시할 선택 Callback
 * @returns {Promise<Object|null>} 현재 로그인 사용자 정보 또는 로그인 화면으로 이동한 경우 null
 */
export async function initializeCommonLayout({ pageTitle, activeMenu, onError } = {}) {

    // 잘못된 화면 설정으로 불완전한 공통 Layout이 표시되지 않도록 필수값을 먼저 확인한다.
    validateLayoutOptions(pageTitle, activeMenu);

    const sidebar = getRequiredElement(COMMON_SIDEBAR_ID);
    const header = getRequiredElement(COMMON_HEADER_ID);

    // 인증 요청 전에 공통 화면 구조를 먼저 생성하여 화면별 HTML 중복을 제거한다.
    renderSidebar(sidebar, activeMenu);
    const headerElements = renderHeader(header, pageTitle);

    // 현재 Session의 사용자를 조회하며, 만료된 Session은 requireAuth()에서 로그인 화면으로 이동한다.
    const currentUser = await requireAuth();

    if (!currentUser) {
        return null;
    }

    // 인증된 사용자명을 Header에 표시하고 역할별 공통 메뉴 범위를 적용한다.
    headerElements.currentUserName.textContent = currentUser.userName;
    applyCommonRoleAccess(sidebar);

    // 로그아웃은 모든 업무 화면에서 동일하게 처리하고 오류만 화면별 Callback으로 전달한다.
    connectLogoutEvent(headerElements.logoutButton, onError);

    return currentUser;
}


// ========== 공통 Layout 설정 검증 ==========

// 화면 제목과 활성 메뉴가 공통 Layout 설정에 존재하는지 확인한다.
function validateLayoutOptions(pageTitle, activeMenu) {

    if (typeof pageTitle !== 'string' || pageTitle.trim() === '') {
        throw new Error('공통 Layout의 화면 제목을 확인할 수 없습니다.');
    }

    const menuExists = MENU_GROUPS.some(group => group.items.some(item => item.key === activeMenu));

    if (!menuExists) {
        throw new Error(`공통 Layout에 등록되지 않은 활성 메뉴입니다: ${activeMenu ?? '-'}`);
    }
}


// 공통 Layout을 삽입할 HTML Element가 없으면 화면 구조 오류를 즉시 알린다.
function getRequiredElement(elementId) {

    const element = document.querySelector(`#${elementId}`);

    if (!element) {
        throw new Error(`공통 Layout 영역을 찾을 수 없습니다: #${elementId}`);
    }

    return element;
}


// ========== 공통 Sidebar 생성 ==========

// ERP 제목과 전체 업무 메뉴 그룹을 Sidebar 영역에 생성한다.
function renderSidebar(sidebar, activeMenu) {

    // 화면을 다시 초기화해도 기존 공통 메뉴가 중복되지 않도록 현재 내용을 먼저 비운다.
    sidebar.innerHTML = '';
    sidebar.classList.add('erp-sidebar');

    const brand = document.createElement('div');
    const navigation = document.createElement('nav');

    brand.className = 'sidebar-brand';
    brand.textContent = 'ERP';

    navigation.className = 'sidebar-nav';
    navigation.setAttribute('aria-label', 'ERP 메뉴');

    MENU_GROUPS.forEach(group => {
        navigation.append(createMenuGroup(group, activeMenu));
    });

    sidebar.append(brand, navigation);
}


// 하나의 메뉴 구분 제목과 해당 구분에 속한 메뉴 버튼을 생성한다.
function createMenuGroup(group, activeMenu) {

    const groupElement = document.createElement('div');

    groupElement.className = 'sidebar-group';

    // 대시보드처럼 별도 구분 제목이 없는 그룹에는 제목 Element를 생성하지 않는다.
    if (group.title) {
        const title = document.createElement('p');

        title.className = 'sidebar-group-title';
        title.textContent = group.title;

        groupElement.append(title);
    }

    group.items.forEach(item => {
        groupElement.append(createMenuButton(item, activeMenu));
    });

    return groupElement;
}


// 메뉴 설정을 실제 Sidebar 버튼으로 변환하고 활성 상태와 화면 이동을 연결한다.
function createMenuButton(item, activeMenu) {

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'sidebar-link';
    button.textContent = item.label;
    button.dataset.menuKey = item.key;

    if (item.elementId) {
        button.id = item.elementId;
    }

    // 현재 화면과 같은 메뉴에는 공통 활성 스타일과 접근성 정보를 함께 적용한다.
    if (item.key === activeMenu) {
        button.classList.add('is-active');
        button.setAttribute('aria-current', 'page');
    }

    // 아직 구현되지 않은 메뉴는 화면에만 표시하고 임의의 이동 경로를 만들지 않는다.
    if (item.path) {
        button.addEventListener('click', () => {
            window.location.href = item.path;
        });
    }

    if (item.adminOnly) {
        button.dataset.adminOnly = 'true';

        // 인증과 역할 확인이 끝나기 전에는 ADMIN 전용 메뉴가 순간적으로 보이지 않도록 먼저 숨긴다.
        button.hidden = true;
    }

    return button;
}


// 현재 로그인 사용자의 역할에 따라 공통 Sidebar의 접근 가능 메뉴를 표시한다.
function applyCommonRoleAccess(sidebar) {

    sidebar.querySelectorAll('[data-admin-only="true"]').forEach(menuButton => {
        menuButton.hidden = !hasRole('ADMIN');
    });
}


// ========== 공통 Header 생성 ==========

// 화면 제목, 로그인 사용자명과 로그아웃 버튼을 Header 영역에 생성한다.
function renderHeader(header, pageTitle) {

    // 화면을 다시 초기화해도 기존 Header Element가 중복되지 않도록 현재 내용을 먼저 비운다.
    header.innerHTML = '';
    header.classList.add('erp-header');

    const leftArea = document.createElement('div');
    const rightArea = document.createElement('div');
    const title = document.createElement('h1');
    const currentUserName = document.createElement('span');
    const logoutButton = document.createElement('button');

    leftArea.className = 'erp-header-left';
    rightArea.className = 'erp-header-right';

    title.className = 'erp-page-title';
    title.textContent = pageTitle;

    currentUserName.id = 'currentUserName';
    currentUserName.className = 'current-user';
    currentUserName.textContent = '사용자';

    logoutButton.id = 'logoutButton';
    logoutButton.className = 'logout-button';
    logoutButton.type = 'button';
    logoutButton.textContent = '로그아웃';

    leftArea.append(title);
    rightArea.append(currentUserName, logoutButton);
    header.append(leftArea, rightArea);

    return { currentUserName, logoutButton };
}


// ========== 공통 로그아웃 ==========

// Header 로그아웃 버튼에 Session 종료와 공통 오류 처리를 연결한다.
function connectLogoutEvent(logoutButton, onError) {

    logoutButton.addEventListener('click', async () => {

        logoutButton.disabled = true;

        try {
            await logout();

        } catch (error) {

            // 로그아웃 실패 시 각 업무 화면이 전달한 오류 표시 함수를 우선 사용한다.
            if (typeof onError === 'function') {
                onError(getApiErrorMessage(error));
            }

            logoutButton.disabled = false;
        }
    });
}
