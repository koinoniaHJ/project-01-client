// ********** 거래처 관리 화면의 인증, 역할별 UI, 목록·상세·상태 변경 처리를 담당 **********

import { api, getApiErrorMessage } from './api.js';
import { hasRole, logout, requireAuth } from './auth.js';


// 거래처 목록과 거래 상태 변경 이력의 한 페이지 표시 개수
const CUSTOMER_PAGE_SIZE = 20;
const TRADE_HISTORY_PAGE_SIZE = 20;


// 현재 로그인 사용자와 역할별 처리 가능 여부
let currentUser = null;
let canEditCustomer = false;
let canChangeCustomerStatus = false;
let canViewSensitiveCustomerInfo = false;


// 현재 조회된 거래처 목록과 페이지 정보
let customers = [];
let customerPageMeta = null;


// 현재 선택한 거래처의 상세정보와 Form 상태
// create: 신규 등록 / edit: 기존 거래처 조회·수정
let selectedCustomer = null;
let customerFormMode = null;


// 현재 조회된 거래 상태 변경 이력과 페이지 정보
let tradeStatusHistories = [];
let tradeHistoryPageMeta = null;


// status: 사용 상태 변경 / tradeStatus: 거래 상태 변경
let statusModalMode = null;
let statusModalCustomerId = null;
let statusModalNextValue = null;
let statusModalVersion = null;


// Mobile에서 거래처 상세 하단 Panel이 열려 있는지 저장
let mobileDetailOpen = false;


// ========== 상단 사용자 정보 ==========
const currentUserName = document.querySelector('#currentUserName');
const logoutButton = document.querySelector('#logoutButton');
const customerPageError = document.querySelector('#customerPageError');
const dashboardMenuButton = document.querySelector('#dashboardMenuButton');
const usersMenuButton = document.querySelector('#usersMenuButton');
const customersMenuButton = document.querySelector('#customersMenuButton');


// ========== 거래처 목록 검색 조건 ==========
const keywordFilter = document.querySelector('#keywordFilter');
const statusFilter = document.querySelector('#statusFilter');
const tradeStatusFilter = document.querySelector('#tradeStatusFilter');
const searchButton = document.querySelector('#searchButton');
const filterResetButton = document.querySelector('#filterResetButton');
const newCustomerButton = document.querySelector('#newCustomerButton');


// ========== 거래처 목록 ==========
const customerCount = document.querySelector('#customerCount');
const customerTableBody = document.querySelector('#customerTableBody');
const customerMobileList = document.querySelector('#customerMobileList');
const customerPagination = document.querySelector('#customerPagination');
const receivableColumns = document.querySelectorAll('.receivable-column');
const customerEmptyCell = document.querySelector('.customer-empty-row td');


// ========== 거래처 상세 영역 ==========
const customerDetailSection = document.querySelector('#customerDetailSection');
const customerDetailTitle = document.querySelector('#customerDetailTitle');
const customerDetailModeText = document.querySelector('#customerDetailModeText');
const detailCloseButton = document.querySelector('#detailCloseButton');
const customerDetailEmpty = document.querySelector('#customerDetailEmpty');
const customerDetailForm = document.querySelector('#customerDetailForm');


// ========== 거래처 상태 요약 ==========
const customerCode = document.querySelector('#customerCode');
const customerStatusBadge = document.querySelector('#customerStatusBadge');
const customerTradeStatusBadge = document.querySelector('#customerTradeStatusBadge');
const totalReceivableField = document.querySelector('#totalReceivableField');
const totalReceivableAmount = document.querySelector('#totalReceivableAmount');


// ========== 거래처 기본정보 ==========
const customerName = document.querySelector('#customerName');
const customerPhone = document.querySelector('#customerPhone');
const customerEmail = document.querySelector('#customerEmail');


// ========== 거래처 사업장 주소 ==========
const customerPostalCode = document.querySelector('#customerPostalCode');
const customerAddress = document.querySelector('#customerAddress');
const customerAddressDetail = document.querySelector('#customerAddressDetail');


// ========== 거래처 기본 배송정보 ==========
const deliveryPostalCode = document.querySelector('#deliveryPostalCode');
const deliveryAddress = document.querySelector('#deliveryAddress');
const deliveryAddressDetail = document.querySelector('#deliveryAddressDetail');
const recipientName = document.querySelector('#recipientName');
const recipientPhone = document.querySelector('#recipientPhone');


// ========== 거래처 메모와 처리 버튼 ==========
const customerMemoSection = document.querySelector('#customerMemoSection');
const customerMemo = document.querySelector('#customerMemo');
const customerFormError = document.querySelector('#customerFormError');
const customerStatusButton = document.querySelector('#customerStatusButton');
const customerTradeStatusButton = document.querySelector('#customerTradeStatusButton');
const customerSaveButton = document.querySelector('#customerSaveButton');


// ========== 거래 상태 변경 이력 ==========
const tradeStatusHistorySection = document.querySelector('#tradeStatusHistorySection');
const tradeHistoryCount = document.querySelector('#tradeHistoryCount');
const tradeHistoryTableBody = document.querySelector('#tradeHistoryTableBody');
const tradeHistoryMobileList = document.querySelector('#tradeHistoryMobileList');
const tradeHistoryPagination = document.querySelector('#tradeHistoryPagination');


// ========== 공통 상태 변경 Modal ==========
const statusModalBackdrop = document.querySelector('#statusModalBackdrop');
const statusChangeForm = document.querySelector('#statusChangeForm');
const statusModalTitle = document.querySelector('#statusModalTitle');
const statusModalCloseButton = document.querySelector('#statusModalCloseButton');
const statusTargetCustomer = document.querySelector('#statusTargetCustomer');
const currentStatusText = document.querySelector('#currentStatusText');
const nextStatusText = document.querySelector('#nextStatusText');
const statusReasonField = document.querySelector('#statusReasonField');
const statusChangeReason = document.querySelector('#statusChangeReason');
const statusReasonLength = document.querySelector('#statusReasonLength');
const statusModalError = document.querySelector('#statusModalError');
const statusModalCancelButton = document.querySelector('#statusModalCancelButton');
const statusModalConfirmButton = document.querySelector('#statusModalConfirmButton');


// ========== 거래처 관리 화면 초기화 ==========

// 화면 진입 시 Session을 확인하고 현재 사용자 역할에 맞는 UI를 적용한다.
async function initialize() {

    clearPageError();
    syncDetailVisibility();

    try {

        currentUser = await requireAuth();

        // requireAuth()에서 로그인 화면으로 이동한 경우 이후 초기화를 중단한다.
        if (!currentUser) {
            return;
        }

        currentUserName.textContent = currentUser.userName;

        // 목록과 상세정보를 그리기 전에 역할별 민감정보 표시 범위를 먼저 확정한다.
        applyRoleAccess();

        // 역할별 UI를 적용한 뒤 거래처 목록 첫 페이지를 조회한다.
        await loadCustomers(0);

        // PC와 Tablet에서는 첫 거래처를 기본 선택하고 Mobile은 목록만 표시한다.
        await applyDefaultCustomerDetailState();

    } catch (error) {
        handlePageError(error, '거래처 목록을 불러오지 못했습니다.');
    }
}


// ========== 역할별 화면 제어 ==========

// 현재 로그인 사용자의 역할을 기준으로 처리 버튼과 민감정보 표시 범위를 적용한다.
function applyRoleAccess() {

    canEditCustomer = hasRole('ADMIN', 'OFFICE');
    canChangeCustomerStatus = hasRole('ADMIN');
    canViewSensitiveCustomerInfo = !hasRole('WAREHOUSE');

    // 사용자 관리는 ADMIN 전용 화면이므로 다른 역할에는 메뉴를 표시하지 않는다.
    usersMenuButton.hidden = !hasRole('ADMIN');

    // 거래처 등록과 기본정보 수정은 ADMIN과 OFFICE만 가능하다.
    newCustomerButton.hidden = !canEditCustomer;
    customerSaveButton.hidden = !canEditCustomer;

    // 사용 상태와 거래 상태 변경은 ADMIN만 가능하다.
    customerStatusButton.hidden = !canChangeCustomerStatus;
    customerTradeStatusButton.hidden = !canChangeCustomerStatus;

    // WAREHOUSE에는 목록과 상세의 총미수금을 표시하지 않는다.
    receivableColumns.forEach(element => {
        element.hidden = !canViewSensitiveCustomerInfo;
    });

    totalReceivableField.hidden = !canViewSensitiveCustomerInfo;

    // WAREHOUSE에는 거래처 메모를 표시하지 않는다.
    customerMemoSection.hidden = !canViewSensitiveCustomerInfo;

    // 빈 목록 안내 행도 실제 표시 열 개수와 일치시킨다.
    if (customerEmptyCell) {
        customerEmptyCell.colSpan = canViewSensitiveCustomerInfo ? 6 : 5;
    }

    // WAREHOUSE는 상세정보를 조회만 할 수 있도록 입력 요소를 비활성화한다.
    setCustomerFormReadOnly(!canEditCustomer);
}


// 거래처 Form의 사용자 입력 요소를 조회 전용 또는 수정 가능 상태로 전환한다.
function setCustomerFormReadOnly(readOnly) {

    const editableFields = customerDetailForm.querySelectorAll('input:not(#customerCode), textarea');

    editableFields.forEach(field => {
        field.disabled = readOnly;
    });
}

// ========== 거래처 목록 조회 ==========

// 현재 검색 조건과 페이지 번호를 이용하여 거래처 목록 API 경로를 만든다.
function createCustomerListPath(page) {

    const params = new URLSearchParams();

    const keyword = keywordFilter.value.trim();
    const status = statusFilter.value;
    const tradeStatus = tradeStatusFilter.value;

    // 입력된 검색 조건만 Query Parameter에 포함한다.
    if (keyword) {
        params.set('keyword', keyword);
    }

    if (status) {
        params.set('status', status);
    }

    if (tradeStatus) {
        params.set('tradeStatus', tradeStatus);
    }

    params.set('page', String(page));
    params.set('size', String(CUSTOMER_PAGE_SIZE));
    params.set('sort', 'customerId,desc');

    return `/customers?${params.toString()}`;
}


// 지정한 페이지의 거래처 목록을 조회하고 PC와 Mobile 화면을 갱신한다.
async function loadCustomers(page) {

    setCustomerListLoading(true);

    try {

        const response = await api.get(createCustomerListPath(page));

        customers = response.data ?? [];
        customerPageMeta = response.meta ?? null;

        renderCustomerCount();
        renderCustomerTable();
        renderCustomerMobileList();
        renderCustomerPagination();

    } finally {
        setCustomerListLoading(false);
    }
}


// 서버의 페이지 응답을 기준으로 거래처 전체 건수를 표시한다.
function renderCustomerCount() {

    const totalElements = customerPageMeta?.totalElements ?? customers.length;

    customerCount.textContent = `전체 ${totalElements.toLocaleString('ko-KR')}건`;
}


// PC와 Tablet에서 사용할 거래처 Table을 출력한다.
function renderCustomerTable() {

    customerTableBody.innerHTML = '';

    if (customers.length === 0) {

        const row = document.createElement('tr');
        const cell = document.createElement('td');

        row.className = 'customer-empty-row';
        cell.colSpan = canViewSensitiveCustomerInfo ? 6 : 5;
        cell.textContent = '조회된 거래처가 없습니다.';

        row.append(cell);
        customerTableBody.append(row);

        return;
    }

    customers.forEach(customer => {

        const row = document.createElement('tr');

        // 다음 상세 조회 단계에서 사용할 거래처 식별자를 행에 저장한다.
        row.dataset.customerId = String(customer.customerId);

        row.innerHTML = `
            <td>${escapeHtml(customer.customerCode)}</td>
            <td>${escapeHtml(customer.customerName)}</td>
            <td>${escapeHtml(customer.phone || '-')}</td>
            <td>${createMasterStatusBadge(customer.status)}</td>
            <td>${createTradeStatusBadge(customer.tradeStatus)}</td>
            ${createReceivableTableCell(customer.totalReceivableAmount)}
        `;

        // 거래처 행을 선택하면 최신 상세정보를 별도 API로 조회한다.
        row.addEventListener('click', async () => {
            await selectCustomer(customer.customerId);
        });

        customerTableBody.append(row);
    });
}


// 로그인 사용자 역할에 맞는 총미수금 Table Cell을 만든다.
function createReceivableTableCell(amount) {

    if (!canViewSensitiveCustomerInfo) {
        return '<td class="receivable-column" hidden></td>';
    }

    return `<td class="receivable-column">${formatCurrency(amount)}</td>`;
}


// Mobile에서 사용할 거래처 Card 목록을 출력한다.
function renderCustomerMobileList() {

    customerMobileList.innerHTML = '';

    if (customers.length === 0) {

        const emptyMessage = document.createElement('p');

        emptyMessage.className = 'customer-mobile-empty';
        emptyMessage.textContent = '조회된 거래처가 없습니다.';

        customerMobileList.append(emptyMessage);

        return;
    }

    customers.forEach(customer => {

        const item = document.createElement('button');

        item.type = 'button';
        item.className = 'customer-mobile-item';
        item.dataset.customerId = String(customer.customerId);
        item.setAttribute('aria-label', `${customer.customerName} 거래처 상세 조회`);

        item.innerHTML = `
            <div class="customer-mobile-top">
                <span class="customer-mobile-name">${escapeHtml(customer.customerName)}</span>
                <span class="customer-mobile-code">${escapeHtml(customer.customerCode)}</span>
            </div>
            <div class="customer-mobile-middle">
                <span class="customer-mobile-phone">${escapeHtml(customer.phone || '-')}</span>
                <span class="customer-mobile-badges">
                    ${createMasterStatusBadge(customer.status)}
                    ${createTradeStatusBadge(customer.tradeStatus)}
                </span>
            </div>
            ${createMobileReceivable(customer.totalReceivableAmount)}
        `;

        // Mobile Card 선택 시 상세정보를 조회하고 하단 Panel을 연다.
        item.addEventListener('click', async () => {
            await selectCustomer(customer.customerId);
        });

        customerMobileList.append(item);
    });
}


// WAREHOUSE가 아닌 사용자에게만 Mobile Card의 총미수금을 표시한다.
function createMobileReceivable(amount) {

    if (!canViewSensitiveCustomerInfo) {
        return '';
    }

    return `
        <div class="customer-mobile-bottom">
            <span class="customer-mobile-receivable">총미수금</span>
            <strong class="customer-mobile-receivable">${formatCurrency(amount)}</strong>
        </div>
    `;
}

// ========== 거래처 상세 조회 ==========

// 거래처 식별자로 최신 상세정보를 조회하여 상세 Form에 표시한다.
async function selectCustomer(customerId, openMobilePanel = true) {

    clearPageError();
    clearCustomerFormError();
    setCustomerDetailLoading(true);

    try {

        const response = await api.get(`/customers/${customerId}`);

        selectedCustomer = response.data;
        customerFormMode = 'edit';

        // 새 거래처의 이력이 조회되는 동안 이전 거래처 이력이 보이지 않도록 초기화한다.
        clearTradeStatusHistory();

        // Mobile Card를 직접 선택한 경우 상세 하단 Panel을 연다.
        if (openMobilePanel) {
            mobileDetailOpen = true;
        }

        renderCustomerDetail();
        renderSelectedCustomer();
        syncDetailVisibility();

        // 상세정보 표시 후 거래 상태 변경 이력 첫 페이지를 별도 API로 조회한다.
        try {
            await loadTradeStatusHistory(customerId, 0);
        } catch (historyError) {
            handlePageError(historyError, '거래 상태 변경 이력을 불러오지 못했습니다.');
        }

    } catch (error) {
        handlePageError(error, '거래처 상세정보를 불러오지 못했습니다.');

    } finally {
        setCustomerDetailLoading(false);
    }
}


// 화면 크기와 조회된 목록에 맞는 기본 상세 상태를 적용한다.
async function applyDefaultCustomerDetailState() {

    selectedCustomer = null;
    customerFormMode = null;
    mobileDetailOpen = false;

    // PC와 Tablet에서는 조회된 첫 거래처를 기본 선택한다.
    if (!isMobile() && customers.length > 0) {
        await selectCustomer(customers[0].customerId, false);
        return;
    }

    showCustomerDetailEmpty();
    syncDetailVisibility();
}


// 선택한 거래처의 전체 상세정보를 Form에 표시한다.
function renderCustomerDetail() {

    if (!selectedCustomer) {
        showCustomerDetailEmpty();
        return;
    }

    customerDetailTitle.textContent = '거래처 정보';
    customerDetailModeText.textContent = '선택한 거래처 정보를 확인하거나 수정할 수 있습니다.';

    customerCode.value = selectedCustomer.customerCode ?? '';
    customerName.value = selectedCustomer.customerName ?? '';
    customerPhone.value = selectedCustomer.phone ?? '';
    customerEmail.value = selectedCustomer.email ?? '';

    customerPostalCode.value = selectedCustomer.postalCode ?? '';
    customerAddress.value = selectedCustomer.address ?? '';
    customerAddressDetail.value = selectedCustomer.addressDetail ?? '';

    deliveryPostalCode.value = selectedCustomer.deliveryPostalCode ?? '';
    deliveryAddress.value = selectedCustomer.deliveryAddress ?? '';
    deliveryAddressDetail.value = selectedCustomer.deliveryAddressDetail ?? '';
    recipientName.value = selectedCustomer.recipientName ?? '';
    recipientPhone.value = selectedCustomer.recipientPhone ?? '';

    // WAREHOUSE 응답에서는 memo가 null이며 화면 영역도 숨긴다.
    customerMemo.value = canViewSensitiveCustomerInfo ? selectedCustomer.memo ?? '' : '';

    setMasterStatusBadge(
        customerStatusBadge,
        selectedCustomer.status
    );

    setTradeStatusBadge(
        customerTradeStatusBadge,
        selectedCustomer.tradeStatus
    );

    // WAREHOUSE 응답에서는 총미수금이 null이며 화면 영역도 숨긴다.
    if (canViewSensitiveCustomerInfo) {
        totalReceivableAmount.textContent = formatCurrency(selectedCustomer.totalReceivableAmount);
    }

    customerDetailEmpty.hidden = true;
    customerDetailForm.hidden = false;

    // 거래 상태 변경 이력이 조회되기 전에는 이전 거래처의 이력을 표시하지 않는다.
    tradeStatusHistorySection.hidden = true;

    setCustomerFormReadOnly(!canEditCustomer);

    customerSaveButton.hidden = !canEditCustomer;
    customerSaveButton.textContent = '저장';
    customerStatusButton.hidden = !canChangeCustomerStatus;
    customerTradeStatusButton.hidden = !canChangeCustomerStatus;
}


// 상세정보에 표시할 사용 상태 Badge를 갱신한다.
function setMasterStatusBadge(element, status) {

    element.className = 'status-badge';

    if (status === 'ACTIVE') {
        element.classList.add('is-active');
        element.textContent = '사용중';
        return;
    }

    if (status === 'INACTIVE') {
        element.classList.add('is-inactive');
        element.textContent = '사용중지';
        return;
    }

    element.textContent = '-';
}


// 상세정보에 표시할 거래 상태 Badge를 갱신한다.
function setTradeStatusBadge(element, tradeStatus) {

    element.className = 'trade-status-badge';

    if (tradeStatus === 'NORMAL') {
        element.classList.add('is-normal');
        element.textContent = '정상 거래';
        return;
    }

    if (tradeStatus === 'HOLD') {
        element.classList.add('is-hold');
        element.textContent = '거래 중지';
        return;
    }

    element.textContent = '-';
}


// 목록과 Mobile Card에서 현재 선택된 거래처를 강조 표시한다.
function renderSelectedCustomer() {

    document.querySelectorAll('[data-customer-id]').forEach(element => {

        const customerId = Number(element.dataset.customerId);
        const selectedCustomerId = selectedCustomer?.customerId;

        element.classList.toggle(
            'is-selected',
            customerId === selectedCustomerId
        );
    });
}


// 선택된 거래처가 없을 때 상세정보 안내 화면을 표시한다.
function showCustomerDetailEmpty() {

    selectedCustomer = null;
    customerFormMode = null;

    customerDetailTitle.textContent = '거래처 정보';
    customerDetailModeText.textContent = '';

    customerDetailForm.hidden = true;
    customerDetailEmpty.hidden = false;
    tradeStatusHistorySection.hidden = true;

    renderSelectedCustomer();
}


// 거래처 상세 조회 중 처리 버튼의 중복 실행을 방지한다.
function setCustomerDetailLoading(loading) {

    newCustomerButton.disabled = loading;
    customerSaveButton.disabled = loading;
    customerStatusButton.disabled = loading;
    customerTradeStatusButton.disabled = loading;
}


// 거래처 상세 Form 오류를 표시한다.
function showCustomerFormError(message) {

    customerFormError.textContent = message;
    customerFormError.hidden = false;
}


// 거래처 상세 Form 오류를 지운다.
function clearCustomerFormError() {

    customerFormError.textContent = '';
    customerFormError.hidden = true;
}


// ========== 거래처 신규 등록 ==========

// 신규 등록 버튼을 누르면 상세 Form을 빈 등록 상태로 전환한다.
function enterCustomerCreateMode() {

    if (!canEditCustomer) {
        return;
    }

    clearPageError();
    clearCustomerFormError();
    clearTradeStatusHistory();

    selectedCustomer = null;
    customerFormMode = 'create';
    mobileDetailOpen = true;

    clearCustomerFormFields();

    customerDetailTitle.textContent = '거래처 등록';
    customerDetailModeText.textContent = '신규 거래처의 기본정보와 기본 배송정보를 입력해 주세요.';

    // 신규 거래처는 서버에서 ACTIVE와 NORMAL 상태로 생성된다.
    setMasterStatusBadge(customerStatusBadge, 'ACTIVE');
    setTradeStatusBadge(customerTradeStatusBadge, 'NORMAL');

    if (canViewSensitiveCustomerInfo) {
        totalReceivableAmount.textContent = formatCurrency(0);
    }

    customerDetailEmpty.hidden = true;
    customerDetailForm.hidden = false;
    tradeStatusHistorySection.hidden = true;

    // 등록 전에는 별도 상태 변경을 할 수 없으므로 상태 변경 버튼을 숨긴다.
    customerStatusButton.hidden = true;
    customerTradeStatusButton.hidden = true;

    customerSaveButton.hidden = false;
    customerSaveButton.textContent = '거래처 등록';

    setCustomerFormReadOnly(false);
    renderSelectedCustomer();
    syncDetailVisibility();

    customerName.focus();
}


// 거래처 입력 Form의 모든 사용자 입력값을 신규 등록 기본값으로 초기화한다.
function clearCustomerFormFields() {

    customerCode.value = '';
    customerName.value = '';
    customerPhone.value = '';
    customerEmail.value = '';

    customerPostalCode.value = '';
    customerAddress.value = '';
    customerAddressDetail.value = '';

    deliveryPostalCode.value = '';
    deliveryAddress.value = '';
    deliveryAddressDetail.value = '';
    recipientName.value = '';
    recipientPhone.value = '';
    customerMemo.value = '';
}


// Form의 현재 모드에 따라 신규 등록 또는 기존 거래처 수정 처리를 분기한다.
async function handleCustomerSubmit(event) {

    event.preventDefault();

    if (customerFormMode === 'create') {
        await createCustomer();
        return;
    }

    if (customerFormMode === 'edit') {
        await updateCustomer();
    }
}


// 거래처 등록과 수정 전에 공통 필수 입력값을 확인한다.
function validateCustomerForm() {

    clearCustomerFormError();

    if (customerName.value.trim() === '') {
        showCustomerFormError('거래처명을 입력해 주세요.');
        customerName.focus();
        return false;
    }

    return true;
}


// Form 입력값으로 신규 거래처 등록 요청 객체를 만든다.
function createCustomerRequestBody() {

    return {
        customerName: customerName.value.trim(),
        phone: normalizeOptionalValue(customerPhone.value),
        email: normalizeOptionalValue(customerEmail.value),
        postalCode: normalizeOptionalValue(customerPostalCode.value),
        address: normalizeOptionalValue(customerAddress.value),
        addressDetail: normalizeOptionalValue(customerAddressDetail.value),
        deliveryPostalCode: normalizeOptionalValue(deliveryPostalCode.value),
        deliveryAddress: normalizeOptionalValue(deliveryAddress.value),
        deliveryAddressDetail: normalizeOptionalValue(deliveryAddressDetail.value),
        recipientName: normalizeOptionalValue(recipientName.value),
        recipientPhone: normalizeOptionalValue(recipientPhone.value),
        memo: normalizeOptionalValue(customerMemo.value)
    };
}


// 빈 선택 입력값은 null로, 값이 있으면 앞뒤 공백을 제거한 문자열로 변환한다.
function normalizeOptionalValue(value) {

    const normalizedValue = value.trim();

    return normalizedValue === '' ? null : normalizedValue;
}


// 신규 거래처를 등록하고 생성된 거래처가 표시되도록 목록과 상세정보를 다시 조회한다.
async function createCustomer() {

    if (!canEditCustomer || !validateCustomerForm()) {
        return;
    }

    setCustomerDetailLoading(true);

    try {

        const response = await api.post('/customers', createCustomerRequestBody());
        const createdCustomer = response.data;

        // 신규 거래처가 첫 페이지에 표시되도록 기존 검색 조건을 초기화한다.
        keywordFilter.value = '';
        statusFilter.value = '';
        tradeStatusFilter.value = '';

        await loadCustomers(0);
        await selectCustomer(createdCustomer.customerId);

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        showCustomerFormError(getApiErrorMessage(error));

    } finally {
        setCustomerDetailLoading(false);
    }
}


// ========== 거래처 수정 ==========

// 선택한 거래처의 기본정보와 기본 배송정보 수정 요청 객체를 만든다.
function createCustomerUpdateRequestBody() {

    return {
        ...createCustomerRequestBody(),
        version: selectedCustomer.version
    };
}


// 선택한 거래처를 수정하고 목록과 상세정보를 최신 데이터로 다시 조회한다.
async function updateCustomer() {

    if (!canEditCustomer || !selectedCustomer || !validateCustomerForm()) {
        return;
    }

    const customerId = selectedCustomer.customerId;
    const detailWasOpen = mobileDetailOpen;

    setCustomerDetailLoading(true);

    try {

        const response = await api.patch(`/customers/${customerId}`, createCustomerUpdateRequestBody());
        const updatedCustomer = response.data;

        // 수정된 거래처가 현재 검색 조건에 계속 포함되는지 확인한 뒤 다시 선택한다.
        await reloadCurrentCustomerPageAndSelect(updatedCustomer.customerId, detailWasOpen);

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        // 오래된 version이면 최신 목록·상세정보를 다시 조회하여 다음 수정에 사용할 version도 갱신한다.
        if (isCustomerVersionConflict(error)) {
            await handleCustomerVersionConflict(error, customerId, detailWasOpen);
            return;
        }

        showCustomerFormError(getApiErrorMessage(error));

    } finally {
        setCustomerDetailLoading(false);
    }
}


// 현재 거래처 목록 페이지를 다시 조회하고 대상 거래처가 남아 있으면 상세정보를 다시 선택한다.
async function reloadCurrentCustomerPageAndSelect(customerId, openMobilePanel) {

    const currentPage = customerPageMeta?.page ?? 0;

    await loadCustomers(currentPage);

    const customerStillVisible = customers.some(customer => customer.customerId === customerId);

    // 수정된 이름이나 연락처가 검색 조건에서 제외되면 현재 화면 크기의 기본 상세 상태로 돌아간다.
    if (!customerStillVisible) {
        await applyDefaultCustomerDetailState();
        return false;
    }

    await selectCustomer(customerId, openMobilePanel);

    return true;
}


// version 충돌 메시지를 보존하면서 거래처 목록과 상세정보를 최신 상태로 갱신한다.
async function handleCustomerVersionConflict(error, customerId, openMobilePanel) {

    const message = getApiErrorMessage(error);

    try {

        const customerStillVisible = await reloadCurrentCustomerPageAndSelect(customerId, openMobilePanel);

        if (customerStillVisible) {
            showCustomerFormError(message);
            return;
        }

        showPageError(message);

    } catch (reloadError) {
        handlePageError(reloadError, '최신 거래처 정보를 다시 조회하지 못했습니다.');
    }
}


// ========== 거래처 사용 상태 변경 ==========

// 선택한 거래처의 현재 사용 상태를 기준으로 반대 상태 변경 확인 Modal을 연다.
function openCustomerStatusModal() {

    if (!canChangeCustomerStatus || !selectedCustomer || customerFormMode !== 'edit') {
        return;
    }

    const nextStatus = selectedCustomer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    statusModalMode = 'status';
    statusModalCustomerId = selectedCustomer.customerId;
    statusModalNextValue = nextStatus;
    statusModalVersion = selectedCustomer.version;

    statusModalTitle.textContent = '사용 상태 변경';
    statusTargetCustomer.textContent = `대상 거래처: ${selectedCustomer.customerName} (${selectedCustomer.customerCode})`;
    currentStatusText.textContent = getMasterStatusLabel(selectedCustomer.status);
    nextStatusText.textContent = getMasterStatusLabel(nextStatus);

    // 사용 상태 변경에는 사유를 전달하지 않으므로 사유 입력 영역을 숨긴다.
    statusReasonField.hidden = true;
    statusChangeReason.value = '';
    statusReasonLength.textContent = '0 / 1000';

    clearStatusModalError();

    statusModalBackdrop.hidden = false;
    statusModalConfirmButton.focus();
}


// 선택한 거래처의 현재 거래 상태를 기준으로 반대 상태 변경 Modal을 연다.
function openCustomerTradeStatusModal() {

    if (!canChangeCustomerStatus || !selectedCustomer || customerFormMode !== 'edit') {
        return;
    }

    const nextTradeStatus = selectedCustomer.tradeStatus === 'NORMAL' ? 'HOLD' : 'NORMAL';

    statusModalMode = 'tradeStatus';
    statusModalCustomerId = selectedCustomer.customerId;
    statusModalNextValue = nextTradeStatus;
    statusModalVersion = selectedCustomer.version;

    statusModalTitle.textContent = '거래 상태 변경';
    statusTargetCustomer.textContent = `대상 거래처: ${selectedCustomer.customerName} (${selectedCustomer.customerCode})`;
    currentStatusText.textContent = getTradeStatusLabel(selectedCustomer.tradeStatus);
    nextStatusText.textContent = getTradeStatusLabel(nextTradeStatus);

    // 거래 상태 변경 사유는 이력에 보존되므로 필수 입력 영역을 표시한다.
    statusReasonField.hidden = false;
    statusChangeReason.value = '';
    statusReasonLength.textContent = '0 / 1000';

    clearStatusModalError();

    statusModalBackdrop.hidden = false;
    statusChangeReason.focus();
}


// 공통 상태 변경 Modal을 닫고 현재 요청 상태를 초기화한다.
function closeStatusModal() {

    statusModalBackdrop.hidden = true;
    statusModalMode = null;
    statusModalCustomerId = null;
    statusModalNextValue = null;
    statusModalVersion = null;

    statusChangeReason.value = '';
    statusReasonLength.textContent = '0 / 1000';

    clearStatusModalError();
}


// 공통 상태 변경 Modal의 현재 모드에 맞는 상태 변경 요청을 실행한다.
async function handleStatusChangeSubmit(event) {

    event.preventDefault();

    if (statusModalMode === 'status') {
        await changeCustomerStatus();
        return;
    }

    if (statusModalMode === 'tradeStatus') {
        await changeCustomerTradeStatus();
    }
}


// 선택한 거래처의 ACTIVE·INACTIVE 사용 상태를 변경한다.
async function changeCustomerStatus() {

    if (!canChangeCustomerStatus || !statusModalCustomerId || !statusModalNextValue) {
        return;
    }

    const customerId = statusModalCustomerId;
    const nextStatus = statusModalNextValue;
    const version = statusModalVersion;
    const detailWasOpen = mobileDetailOpen;

    setStatusModalLoading(true);

    try {

        await api.post(`/customers/${customerId}/status`, {
            status: nextStatus,
            version
        });

        closeStatusModal();

        // 상태 Filter에서 제외될 수 있으므로 현재 목록 페이지를 다시 조회한다.
        await reloadCurrentCustomerPageAndSelect(customerId, detailWasOpen);

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        // version 충돌일 때만 Modal을 닫고 최신 거래처 정보로 교체한다.
        if (isCustomerVersionConflict(error)) {

            closeStatusModal();
            await handleCustomerVersionConflict(error, customerId, detailWasOpen);

            return;
        }

        // 진행 업무 참조 등 업무 조건 오류는 Modal을 유지한 채 서버 메시지를 표시한다.
        showStatusModalError(getApiErrorMessage(error));

    } finally {
        setStatusModalLoading(false);
    }
}


// 선택한 거래처의 NORMAL·HOLD 거래 상태를 변경하고 변경 이력을 갱신한다.
async function changeCustomerTradeStatus() {

    if (!canChangeCustomerStatus || !statusModalCustomerId || !statusModalNextValue) {
        return;
    }

    const reason = statusChangeReason.value.trim();

    clearStatusModalError();

    if (reason === '') {
        showStatusModalError('거래 상태 변경 사유를 입력해 주세요.');
        statusChangeReason.focus();
        return;
    }

    const customerId = statusModalCustomerId;
    const nextTradeStatus = statusModalNextValue;
    const version = statusModalVersion;
    const detailWasOpen = mobileDetailOpen;

    setStatusModalLoading(true);

    try {

        await api.post(`/customers/${customerId}/trade-status`, {
            tradeStatus: nextTradeStatus,
            reason,
            version
        });

        closeStatusModal();

        // 거래 상태 Filter 반영과 신규 변경 이력 표시를 위해 목록·상세·이력을 다시 조회한다.
        await reloadCurrentCustomerPageAndSelect(customerId, detailWasOpen);

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        // version 충돌이면 Modal을 닫고 최신 상태와 이력으로 교체한다.
        if (isCustomerVersionConflict(error)) {

            closeStatusModal();
            await handleCustomerVersionConflict(error, customerId, detailWasOpen);

            return;
        }

        // 동일 상태 요청이나 입력값 오류는 Modal을 유지하고 서버 메시지를 표시한다.
        showStatusModalError(getApiErrorMessage(error));

    } finally {
        setStatusModalLoading(false);
    }
}


// 사용 상태 Enum을 사용자에게 표시할 한글 상태명으로 변환한다.
function getMasterStatusLabel(status) {

    if (status === 'ACTIVE') {
        return '사용중';
    }

    if (status === 'INACTIVE') {
        return '사용중지';
    }

    return '-';
}


// 거래 상태 Enum을 사용자에게 표시할 한글 상태명으로 변환한다.
function getTradeStatusLabel(tradeStatus) {

    if (tradeStatus === 'NORMAL') {
        return '정상 거래';
    }

    if (tradeStatus === 'HOLD') {
        return '거래 중지';
    }

    return '-';
}


// 거래 상태 변경 사유 입력 길이를 Modal에 실시간으로 표시한다.
function updateStatusReasonLength() {

    statusReasonLength.textContent = `${statusChangeReason.value.length} / 1000`;
}


// 서버의 409 응답이 실제 version 동시성 충돌인지 메시지를 기준으로 구분한다.
function isCustomerVersionConflict(error) {

    if (error?.status !== 409) {
        return false;
    }

    return getApiErrorMessage(error).includes('다른 사용자가 먼저 수정했습니다.');
}


// 상태 변경 Modal 요청 중 중복 실행과 닫기 동작을 막는다.
function setStatusModalLoading(loading) {

    statusModalConfirmButton.disabled = loading;
    statusModalCancelButton.disabled = loading;
    statusModalCloseButton.disabled = loading;
}


// 상태 변경 Modal에 서버 오류 메시지를 표시한다.
function showStatusModalError(message) {

    statusModalError.textContent = message;
    statusModalError.hidden = false;
}


// 상태 변경 Modal의 오류 메시지를 지운다.
function clearStatusModalError() {

    statusModalError.textContent = '';
    statusModalError.hidden = true;
}


// ========== 거래 상태 변경 이력 조회 ==========

// 선택한 거래처의 거래 상태 변경 이력을 서버 고정 정렬 기준으로 페이지 조회한다.
async function loadTradeStatusHistory(customerId, page) {

    setTradeHistoryLoading(true);

    try {

        const params = new URLSearchParams();

        params.set('page', String(page));
        params.set('size', String(TRADE_HISTORY_PAGE_SIZE));

        const response = await api.get(`/customers/${customerId}/trade-status-history?${params.toString()}`);

        // 이력 조회 중 다른 거래처를 선택했다면 이전 요청 결과를 현재 상세에 반영하지 않는다.
        if (selectedCustomer?.customerId !== customerId) {
            return;
        }

        tradeStatusHistories = response.data ?? [];
        tradeHistoryPageMeta = response.meta ?? null;

        renderTradeHistoryCount();
        renderTradeHistoryTable();
        renderTradeHistoryMobileList();
        renderTradeHistoryPagination();

        tradeStatusHistorySection.hidden = false;

    } finally {
        setTradeHistoryLoading(false);
    }
}


// 서버의 페이지 응답을 기준으로 거래 상태 변경 이력 전체 건수를 표시한다.
function renderTradeHistoryCount() {

    const totalElements = tradeHistoryPageMeta?.totalElements ?? tradeStatusHistories.length;

    tradeHistoryCount.textContent = `전체 ${totalElements.toLocaleString('ko-KR')}건`;
}


// PC와 Tablet에서 사용할 거래 상태 변경 이력 Table을 출력한다.
function renderTradeHistoryTable() {

    tradeHistoryTableBody.innerHTML = '';

    if (tradeStatusHistories.length === 0) {

        const row = document.createElement('tr');
        const cell = document.createElement('td');

        row.className = 'trade-history-empty-row';
        cell.colSpan = 5;
        cell.textContent = '거래 상태 변경 이력이 없습니다.';

        row.append(cell);
        tradeHistoryTableBody.append(row);

        return;
    }

    tradeStatusHistories.forEach(history => {

        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${createTradeStatusBadge(history.previousStatus)}</td>
            <td>${createTradeStatusBadge(history.changedStatus)}</td>
            <td>${escapeHtml(history.reason || '-')}</td>
            <td>${escapeHtml(history.changedByUserName || '-')}</td>
            <td>${formatDateTime(history.changedAt)}</td>
        `;

        tradeHistoryTableBody.append(row);
    });
}


// Mobile에서 사용할 거래 상태 변경 이력 Card 목록을 출력한다.
function renderTradeHistoryMobileList() {

    tradeHistoryMobileList.innerHTML = '';

    if (tradeStatusHistories.length === 0) {

        const emptyMessage = document.createElement('p');

        emptyMessage.className = 'trade-history-mobile-empty';
        emptyMessage.textContent = '거래 상태 변경 이력이 없습니다.';

        tradeHistoryMobileList.append(emptyMessage);

        return;
    }

    tradeStatusHistories.forEach(history => {

        const item = document.createElement('article');

        item.className = 'trade-history-mobile-item';
        item.innerHTML = `
            <div class="trade-history-mobile-status">
                ${createTradeStatusBadge(history.previousStatus)}
                <span aria-hidden="true">→</span>
                ${createTradeStatusBadge(history.changedStatus)}
            </div>
            <p class="trade-history-mobile-reason">${escapeHtml(history.reason || '-')}</p>
            <div class="trade-history-mobile-meta">
                <span>${escapeHtml(history.changedByUserName || '-')}</span>
                <span>${formatDateTime(history.changedAt)}</span>
            </div>
        `;

        tradeHistoryMobileList.append(item);
    });
}


// 서버의 페이지 정보를 기준으로 거래 상태 변경 이력 페이지 버튼을 출력한다.
function renderTradeHistoryPagination() {

    tradeHistoryPagination.innerHTML = '';

    if (!tradeHistoryPageMeta || tradeHistoryPageMeta.totalPages <= 1) {
        return;
    }

    const currentPage = tradeHistoryPageMeta.page;
    const totalPages = tradeHistoryPageMeta.totalPages;
    const firstVisiblePage = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
    const lastVisiblePage = Math.min(totalPages, firstVisiblePage + 5);

    tradeHistoryPagination.append(
        createTradeHistoryPageButton('‹', currentPage - 1, currentPage === 0)
    );

    for (let page = firstVisiblePage; page < lastVisiblePage; page += 1) {

        const button = createTradeHistoryPageButton(String(page + 1), page, false);

        if (page === currentPage) {
            button.classList.add('is-active');
            button.setAttribute('aria-current', 'page');
        }

        tradeHistoryPagination.append(button);
    }

    tradeHistoryPagination.append(
        createTradeHistoryPageButton('›', currentPage + 1, currentPage >= totalPages - 1)
    );
}


// 선택한 거래처의 거래 상태 변경 이력 페이지를 이동하는 버튼을 만든다.
function createTradeHistoryPageButton(label, page, disabled) {

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'page-button';
    button.textContent = label;
    button.disabled = disabled;

    button.addEventListener('click', async () => {

        if (!selectedCustomer) {
            return;
        }

        clearPageError();

        try {
            await loadTradeStatusHistory(selectedCustomer.customerId, page);
        } catch (error) {
            handlePageError(error, '거래 상태 변경 이력을 불러오지 못했습니다.');
        }
    });

    return button;
}


// 거래 상태 변경 이력 조회값을 비우고 이력 영역을 숨긴다.
function clearTradeStatusHistory() {

    tradeStatusHistories = [];
    tradeHistoryPageMeta = null;

    tradeHistoryCount.textContent = '전체 0건';
    tradeHistoryTableBody.innerHTML = '<tr class="trade-history-empty-row"><td colspan="5">거래 상태 변경 이력이 없습니다.</td></tr>';
    tradeHistoryMobileList.innerHTML = '<p class="trade-history-mobile-empty">거래 상태 변경 이력이 없습니다.</p>';
    tradeHistoryPagination.innerHTML = '';
    tradeStatusHistorySection.hidden = true;
}


// 거래 상태 변경 이력 조회 중 페이지 버튼의 중복 실행을 방지한다.
function setTradeHistoryLoading(loading) {

    tradeHistoryPagination.querySelectorAll('button').forEach(button => {
        button.disabled = loading;
    });
}


// 서버의 LocalDateTime 문자열을 화면에 표시할 분 단위 일시로 변환한다.
function formatDateTime(value) {

    if (!value) {
        return '-';
    }

    return escapeHtml(String(value).replace('T', ' ').slice(0, 16));
}

// CUSTOMER.status 값을 화면용 사용 상태 Badge로 변환한다.
function createMasterStatusBadge(status) {

    if (status === 'ACTIVE') {
        return '<span class="status-badge is-active">사용중</span>';
    }

    if (status === 'INACTIVE') {
        return '<span class="status-badge is-inactive">사용중지</span>';
    }

    return '<span class="status-badge">-</span>';
}


// CUSTOMER.trade_status 값을 화면용 거래 상태 Badge로 변환한다.
function createTradeStatusBadge(tradeStatus) {

    if (tradeStatus === 'NORMAL') {
        return '<span class="trade-status-badge is-normal">정상 거래</span>';
    }

    if (tradeStatus === 'HOLD') {
        return '<span class="trade-status-badge is-hold">거래 중지</span>';
    }

    return '<span class="trade-status-badge">-</span>';
}


// 금액을 천 단위 구분 기호와 원 단위가 포함된 문자열로 변환한다.
function formatCurrency(value) {

    if (value === null || value === undefined) {
        return '-';
    }

    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return '-';
    }

    return `${amount.toLocaleString('ko-KR')}원`;
}


// 서버에서 받은 문자열을 innerHTML에 넣기 전에 HTML 특수문자를 변환한다.
function escapeHtml(value) {

    const element = document.createElement('div');

    element.textContent = value ?? '';

    return element.innerHTML;
}


// ========== 거래처 목록 Pagination ==========

// 서버의 페이지 정보를 기준으로 거래처 목록 페이지 버튼을 출력한다.
function renderCustomerPagination() {

    customerPagination.innerHTML = '';

    if (!customerPageMeta || customerPageMeta.totalPages <= 1) {
        return;
    }

    const currentPage = customerPageMeta.page;
    const totalPages = customerPageMeta.totalPages;
    const firstVisiblePage = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
    const lastVisiblePage = Math.min(totalPages, firstVisiblePage + 5);

    customerPagination.append(
        createCustomerPageButton('‹', currentPage - 1, currentPage === 0)
    );

    for (let page = firstVisiblePage; page < lastVisiblePage; page += 1) {

        const button = createCustomerPageButton(String(page + 1), page, false);

        if (page === currentPage) {
            button.classList.add('is-active');
            button.setAttribute('aria-current', 'page');
        }

        customerPagination.append(button);
    }

    customerPagination.append(
        createCustomerPageButton('›', currentPage + 1, currentPage >= totalPages - 1)
    );
}


// 거래처 목록의 지정된 페이지로 이동하는 버튼을 만든다.
function createCustomerPageButton(label, page, disabled) {

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'page-button';
    button.textContent = label;
    button.disabled = disabled;

    button.addEventListener('click', async () => {

        clearPageError();

        try {
            await loadCustomers(page);
            await applyDefaultCustomerDetailState();

        } catch (error) {
            handlePageError(error, '거래처 목록을 불러오지 못했습니다.');
        }
    });

    return button;
}


// ========== 거래처 검색 조건 ==========

// 현재 검색 조건으로 거래처 목록 첫 페이지를 조회한다.
async function applyCustomerFilters() {

    clearPageError();

    try {
        await loadCustomers(0);
        await applyDefaultCustomerDetailState();

    } catch (error) {
        handlePageError(error, '거래처 목록을 불러오지 못했습니다.');
    }
}


// 검색 조건을 모두 초기화하고 거래처 목록 첫 페이지를 다시 조회한다.
async function resetCustomerFilters() {

    keywordFilter.value = '';
    statusFilter.value = '';
    tradeStatusFilter.value = '';

    await applyCustomerFilters();
}


// 검색어 입력창에서 Enter를 누르면 조회 버튼과 동일하게 처리한다.
async function handleKeywordKeydown(event) {

    if (event.key !== 'Enter') {
        return;
    }

    event.preventDefault();

    await applyCustomerFilters();
}


// 거래처 목록 조회 중 검색과 페이지 버튼의 중복 실행을 방지한다.
function setCustomerListLoading(loading) {

    searchButton.disabled = loading;
    filterResetButton.disabled = loading;

    customerPagination.querySelectorAll('button').forEach(button => {
        button.disabled = loading;
    });
}

// ========== Mobile 상세 Panel ==========

// 현재 화면이 Mobile 기준인지 확인한다.
function isMobile() {
    return window.matchMedia('(max-width: 375px)').matches;
}


// 화면 크기와 Mobile Panel 상태에 따라 거래처 상세 영역 표시 여부를 적용한다.
function syncDetailVisibility() {

    if (!isMobile()) {
        customerDetailSection.hidden = false;
        return;
    }

    customerDetailSection.hidden = !mobileDetailOpen;
}


// Mobile 거래처 상세 Panel을 닫는다.
function closeMobileDetailPanel() {

    mobileDetailOpen = false;

    syncDetailVisibility();
}


// ========== 공통 오류 처리 ==========

// 거래처 관리 화면 전체 오류를 표시한다.
function showPageError(message) {

    customerPageError.textContent = message;
    customerPageError.hidden = false;
}


// 거래처 관리 화면 전체 오류를 지운다.
function clearPageError() {

    customerPageError.textContent = '';
    customerPageError.hidden = true;
}

// Session이 만료되어 401이 반환되면 로그인 화면으로 이동한다.
function handleUnauthorized(error) {

    if (error?.status !== 401) {
        return false;
    }

    window.location.replace('./login.html');

    return true;
}


// 거래처 관리 화면에서 발생한 API 오류를 처리한다.
function handlePageError(error, fallbackMessage) {

    if (handleUnauthorized(error)) {
        return;
    }

    showPageError(error ? getApiErrorMessage(error) : fallbackMessage);
}

// ========== 로그아웃 ==========

// 로그아웃 요청 중 중복 클릭을 막고 완료 후 로그인 화면으로 이동한다.
async function handleLogout() {

    logoutButton.disabled = true;

    try {
        await logout();

    } catch (error) {

        showPageError(getApiErrorMessage(error));
        logoutButton.disabled = false;
    }
}


// ========== Event 연결 ==========

// 현재 구현된 공통 업무 화면 이동
dashboardMenuButton.addEventListener('click', () => window.location.href = './index.html');
usersMenuButton.addEventListener('click', () => window.location.href = './users.html');
customersMenuButton.addEventListener('click', () => window.location.href = './customers.html');

// 거래처 신규 등록과 상세 Form 저장
newCustomerButton.addEventListener('click', enterCustomerCreateMode);
customerDetailForm.addEventListener('submit', handleCustomerSubmit);

// 거래처 사용 상태 변경 Modal
customerStatusButton.addEventListener('click', openCustomerStatusModal);
customerTradeStatusButton.addEventListener('click', openCustomerTradeStatusModal);
statusChangeForm.addEventListener('submit', handleStatusChangeSubmit);
statusModalCloseButton.addEventListener('click', closeStatusModal);
statusModalCancelButton.addEventListener('click', closeStatusModal);
statusChangeReason.addEventListener('input', updateStatusReasonLength);

// Modal 바깥 영역을 누르면 처리 중이 아닐 때만 닫는다.
statusModalBackdrop.addEventListener('click', event => {

    if (event.target === statusModalBackdrop && !statusModalConfirmButton.disabled) {
        closeStatusModal();
    }
});

// Modal이 열린 상태에서 Escape를 누르면 처리 중이 아닐 때만 닫는다.
document.addEventListener('keydown', event => {

    if (event.key === 'Escape' && !statusModalBackdrop.hidden && !statusModalConfirmButton.disabled) {
        closeStatusModal();
    }
});

// 거래처 검색과 검색 조건 초기화
searchButton.addEventListener('click', applyCustomerFilters);
filterResetButton.addEventListener('click', resetCustomerFilters);
keywordFilter.addEventListener('keydown', handleKeywordKeydown);

// Mobile 거래처 상세 Panel 닫기
detailCloseButton.addEventListener('click', closeMobileDetailPanel);

// 로그아웃
logoutButton.addEventListener('click', handleLogout);

// 화면 크기 변경 시 Mobile 상세 Panel 표시 상태를 다시 적용
window.addEventListener('resize', syncDetailVisibility);

// 거래처 관리 화면 초기화
initialize();
