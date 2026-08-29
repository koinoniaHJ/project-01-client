// ********** 공급업체 관리 화면의 인증, 역할별 UI 및 공통 화면 처리를 담당 **********

import { api, getApiErrorMessage } from './api.js';
import { hasRole } from './auth.js';
import { initializeCommonLayout } from './common-layout.js';


// 공급업체 목록의 한 페이지 표시 개수
const SUPPLIER_PAGE_SIZE = 20;


// 현재 로그인 사용자의 역할별 공급업체 처리 가능 여부
let canEditSupplier = false;
let canChangeSupplierStatus = false;
let canViewSupplierMemo = false;


// 현재 조회된 공급업체 목록과 서버의 페이지 정보
let suppliers = [];
let supplierPageMeta = null;


// 현재 선택한 공급업체의 상세정보와 Form 상태
// create: 신규 등록 / edit: 기존 공급업체 조회·수정
let selectedSupplier = null;
let supplierFormMode = null;


// 사용 상태 변경 Modal의 대상 공급업체와 변경 요청 정보
let statusModalSupplierId = null;
let statusModalNextValue = null;
let statusModalVersion = null;


// Mobile에서 공급업체 상세 하단 Panel이 열려 있는지 저장
let mobileDetailOpen = false;


// ========== 공급업체 관리 화면 공통 오류 ==========
const supplierPageError = document.querySelector('#supplierPageError');


// ========== 공급업체 목록 검색 조건 ==========
const keywordFilter = document.querySelector('#keywordFilter');
const statusFilter = document.querySelector('#statusFilter');
const searchButton = document.querySelector('#searchButton');
const resetFilterButton = document.querySelector('#resetFilterButton');


// ========== 공급업체 목록 ==========
const supplierCount = document.querySelector('#supplierCount');
const supplierTableBody = document.querySelector('#supplierTableBody');
const supplierMobileList = document.querySelector('#supplierMobileList');
const supplierPagination = document.querySelector('#supplierPagination');


// ========== 역할별 표시를 제어할 공급업체 화면 요소 ==========
const newSupplierButton = document.querySelector('#newSupplierButton');
const supplierDetailSection = document.querySelector('#supplierDetailSection');
const supplierDetailTitle = document.querySelector('#supplierDetailTitle');
const supplierDetailMode = document.querySelector('#supplierDetailMode');
const supplierDetailForm = document.querySelector('#supplierDetailForm');
const supplierDetailEmpty = document.querySelector('#supplierDetailEmpty');
const closeDetailButton = document.querySelector('#closeDetailButton');
const supplierCodeValue = document.querySelector('#supplierCodeValue');
const supplierStatusBadge = document.querySelector('#supplierStatusBadge');
const supplierName = document.querySelector('#supplierName');
const supplierPhone = document.querySelector('#supplierPhone');
const supplierEmail = document.querySelector('#supplierEmail');
const supplierPostalCode = document.querySelector('#supplierPostalCode');
const supplierAddress = document.querySelector('#supplierAddress');
const supplierAddressDetail = document.querySelector('#supplierAddressDetail');
const supplierMemoSection = document.querySelector('#supplierMemoSection');
const supplierMemo = document.querySelector('#supplierMemo');
const supplierFormError = document.querySelector('#supplierFormError');
const supplierStatusButton = document.querySelector('#supplierStatusButton');
const supplierSaveButton = document.querySelector('#supplierSaveButton');


// ========== 공급업체 사용 상태 변경 Modal ==========
const statusModalBackdrop = document.querySelector('#statusModalBackdrop');
const statusChangeForm = document.querySelector('#statusChangeForm');
const closeStatusModalButton = document.querySelector('#closeStatusModalButton');
const statusTargetSupplier = document.querySelector('#statusTargetSupplier');
const currentStatusValue = document.querySelector('#currentStatusValue');
const nextStatusValue = document.querySelector('#nextStatusValue');
const statusModalError = document.querySelector('#statusModalError');
const cancelStatusButton = document.querySelector('#cancelStatusButton');
const confirmStatusButton = document.querySelector('#confirmStatusButton');


// ========== 공급업체 관리 화면 초기화 ==========

// 화면 진입 시 Session을 확인하고 현재 사용자 역할에 맞는 UI를 적용한다.
async function initialize() {

    clearPageError();
    syncDetailVisibility();

    try {

        // 공통 Sidebar·Header를 생성하고 현재 로그인 Session의 사용자 정보를 조회한다.
        const currentUser = await initializeCommonLayout({
            pageTitle: '공급업체 관리',
            activeMenu: 'suppliers',
            onError: showPageError
        });

        // 공통 Layout에서 로그인 화면으로 이동한 경우 이후 초기화를 중단한다.
        if (!currentUser) {
            return;
        }

        // 공급업체 데이터를 연결하기 전에 역할별 표시와 수정 범위를 먼저 확정한다.
        applyRoleAccess();

        // 역할별 UI 적용 후 공급업체 목록 첫 페이지를 조회한다.
        await loadSuppliers(0);

        // PC와 Tablet에서는 첫 공급업체를 기본 선택하고 Mobile은 목록만 표시한다.
        await applyDefaultSupplierDetailState();

    } catch (error) {
        handlePageError(error, '공급업체 목록을 불러오지 못했습니다.');
    }
}


// ========== 역할별 화면 제어 ==========

// 현재 로그인 사용자의 역할을 기준으로 공급업체 처리 버튼과 메모 표시 범위를 적용한다.
function applyRoleAccess() {

    canEditSupplier = hasRole('ADMIN', 'OFFICE');
    canChangeSupplierStatus = hasRole('ADMIN');
    canViewSupplierMemo = !hasRole('WAREHOUSE');

    // 공급업체 등록과 기본정보 수정은 ADMIN과 OFFICE만 가능하다.
    newSupplierButton.hidden = !canEditSupplier;
    supplierSaveButton.hidden = !canEditSupplier;

    // 공급업체 사용 상태 변경은 ADMIN만 가능하다.
    supplierStatusButton.hidden = !canChangeSupplierStatus;

    // WAREHOUSE에는 공급업체 내부 관리용 메모를 표시하지 않는다.
    supplierMemoSection.hidden = !canViewSupplierMemo;

    // WAREHOUSE는 공급업체 상세정보를 조회만 할 수 있도록 입력 요소를 비활성화한다.
    setSupplierFormReadOnly(!canEditSupplier);
}


// 공급업체 Form의 사용자 입력 요소를 조회 전용 또는 수정 가능 상태로 전환한다.
function setSupplierFormReadOnly(readOnly) {

    const editableFields = supplierDetailForm.querySelectorAll('input, textarea');

    editableFields.forEach(field => {
        field.disabled = readOnly;
    });
}


// ========== 공급업체 목록 조회 ==========

// 현재 검색 조건과 페이지 번호를 이용하여 공급업체 목록 API 경로를 만든다.
function createSupplierListPath(page) {

    const params = new URLSearchParams();
    const keyword = keywordFilter.value.trim();
    const status = statusFilter.value;

    // 입력된 검색 조건만 Query Parameter에 포함한다.
    if (keyword) {
        params.set('keyword', keyword);
    }

    if (status) {
        params.set('status', status);
    }

    // itemId는 ITEM·SUPPLIER_ITEM 구현 후 취급 품목 필터와 함께 추가한다.
    params.set('page', String(page));
    params.set('size', String(SUPPLIER_PAGE_SIZE));
    params.set('sort', 'supplierId,desc');

    return `/suppliers?${params.toString()}`;
}


// 지정한 페이지의 공급업체 목록을 조회하고 PC와 Mobile 화면을 갱신한다.
async function loadSuppliers(page) {

    setSupplierListLoading(true);

    try {

        const response = await api.get(createSupplierListPath(page));

        suppliers = response.data ?? [];
        supplierPageMeta = response.meta ?? null;

        renderSupplierCount();
        renderSupplierTable();
        renderSupplierMobileList();
        renderSupplierPagination();

    } finally {
        setSupplierListLoading(false);
    }
}


// 서버의 페이지 응답을 기준으로 공급업체 전체 건수를 표시한다.
function renderSupplierCount() {

    const totalElements = supplierPageMeta?.totalElements ?? suppliers.length;

    supplierCount.textContent = `전체 ${totalElements.toLocaleString('ko-KR')}건`;
}


// PC와 Tablet에서 사용할 공급업체 Table을 출력한다.
function renderSupplierTable() {

    supplierTableBody.innerHTML = '';

    if (suppliers.length === 0) {

        const row = document.createElement('tr');
        const cell = document.createElement('td');

        cell.className = 'supplier-empty-cell';
        cell.colSpan = 5;
        cell.textContent = '조회된 공급업체가 없습니다.';

        row.append(cell);
        supplierTableBody.append(row);

        return;
    }

    suppliers.forEach(supplier => {

        const row = document.createElement('tr');

        // 다음 상세 조회 단계에서 사용할 공급업체 식별자를 행에 저장한다.
        row.dataset.supplierId = String(supplier.supplierId);
        row.innerHTML = `
            <td>${escapeHtml(supplier.supplierCode)}</td>
            <td>${escapeHtml(supplier.supplierName)}</td>
            <td>${escapeHtml(supplier.phone || '-')}</td>
            <td>${escapeHtml(supplier.email || '-')}</td>
            <td>${createMasterStatusBadge(supplier.status)}</td>
        `;

        // 공급업체 행을 선택하면 최신 상세정보를 별도 API로 조회한다.
        row.addEventListener('click', async () => {
            await selectSupplier(supplier.supplierId);
        });

        supplierTableBody.append(row);
    });
}


// Mobile에서 사용할 공급업체 Card 목록을 출력한다.
function renderSupplierMobileList() {

    supplierMobileList.innerHTML = '';

    if (suppliers.length === 0) {

        const emptyMessage = document.createElement('p');

        emptyMessage.className = 'supplier-mobile-empty';
        emptyMessage.textContent = '조회된 공급업체가 없습니다.';

        supplierMobileList.append(emptyMessage);

        return;
    }

    suppliers.forEach(supplier => {

        const item = document.createElement('button');

        item.type = 'button';
        item.className = 'supplier-mobile-item';
        item.dataset.supplierId = String(supplier.supplierId);
        item.setAttribute('aria-label', `${supplier.supplierName} 공급업체 상세 조회`);
        item.innerHTML = `
            <div class="supplier-mobile-top">
                <span class="supplier-mobile-name">${escapeHtml(supplier.supplierName)}</span>
                <span class="supplier-mobile-code">${escapeHtml(supplier.supplierCode)}</span>
            </div>
            <div class="supplier-mobile-middle">
                <span class="supplier-mobile-phone">${escapeHtml(supplier.phone || '-')}</span>
                ${createMasterStatusBadge(supplier.status)}
            </div>
            <div class="supplier-mobile-bottom">
                <span class="supplier-mobile-email">${escapeHtml(supplier.email || '-')}</span>
            </div>
        `;

        // Mobile Card 선택 시 상세정보를 조회하고 하단 Panel을 연다.
        item.addEventListener('click', async () => {
            await selectSupplier(supplier.supplierId);
        });

        supplierMobileList.append(item);
    });
}


// ========== 공급업체 상세 조회 ==========

// 공급업체 식별자로 최신 상세정보를 조회하여 상세 Form에 표시한다.
async function selectSupplier(supplierId, openMobilePanel = true) {

    clearPageError();
    clearSupplierFormError();
    setSupplierDetailLoading(true);

    try {

        const response = await api.get(`/suppliers/${supplierId}`);

        selectedSupplier = response.data;
        supplierFormMode = 'edit';

        // Mobile Card를 직접 선택한 경우 상세 하단 Panel을 연다.
        if (openMobilePanel) {
            mobileDetailOpen = true;
        }

        renderSupplierDetail();
        renderSelectedSupplier();
        syncDetailVisibility();

    } catch (error) {
        handlePageError(error, '공급업체 상세정보를 불러오지 못했습니다.');

    } finally {
        setSupplierDetailLoading(false);
    }
}


// 화면 크기와 조회된 목록에 맞는 기본 상세 상태를 적용한다.
async function applyDefaultSupplierDetailState() {

    selectedSupplier = null;
    supplierFormMode = null;
    mobileDetailOpen = false;

    // PC와 Tablet에서는 조회된 첫 공급업체를 기본 선택한다.
    if (!isMobile() && suppliers.length > 0) {
        await selectSupplier(suppliers[0].supplierId, false);
        return;
    }

    showSupplierDetailEmpty();
    syncDetailVisibility();
}


// 선택한 공급업체의 전체 상세정보를 Form에 표시한다.
function renderSupplierDetail() {

    if (!selectedSupplier) {
        showSupplierDetailEmpty();
        return;
    }

    supplierDetailMode.textContent = '선택한 공급업체 정보를 확인하거나 수정할 수 있습니다.';
    supplierDetailTitle.textContent = '공급업체 정보';

    supplierCodeValue.value = selectedSupplier.supplierCode ?? '';
    supplierName.value = selectedSupplier.supplierName ?? '';
    supplierPhone.value = selectedSupplier.phone ?? '';
    supplierEmail.value = selectedSupplier.email ?? '';
    supplierPostalCode.value = selectedSupplier.postalCode ?? '';
    supplierAddress.value = selectedSupplier.address ?? '';
    supplierAddressDetail.value = selectedSupplier.addressDetail ?? '';

    // WAREHOUSE 응답에서는 memo가 null이며 화면 영역도 숨긴다.
    supplierMemo.value = canViewSupplierMemo ? selectedSupplier.memo ?? '' : '';

    setMasterStatusBadge(supplierStatusBadge, selectedSupplier.status);

    supplierDetailEmpty.hidden = true;
    supplierDetailForm.hidden = false;

    setSupplierFormReadOnly(!canEditSupplier);

    supplierSaveButton.hidden = !canEditSupplier;
    supplierSaveButton.textContent = '저장';
    supplierStatusButton.hidden = !canChangeSupplierStatus;
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


// 목록과 Mobile Card에서 현재 선택된 공급업체를 강조 표시한다.
function renderSelectedSupplier() {

    document.querySelectorAll('[data-supplier-id]').forEach(element => {

        const supplierId = Number(element.dataset.supplierId);
        const selectedSupplierId = selectedSupplier?.supplierId;

        element.classList.toggle('is-selected', supplierId === selectedSupplierId);
    });
}


// 선택된 공급업체가 없을 때 상세정보 안내 화면을 표시한다.
function showSupplierDetailEmpty() {

    selectedSupplier = null;
    supplierFormMode = null;

    supplierDetailMode.textContent = '선택한 공급업체 정보를 확인하거나 수정할 수 있습니다.';
    supplierDetailTitle.textContent = '공급업체 정보';
    supplierDetailForm.hidden = true;
    supplierDetailEmpty.hidden = false;

    renderSelectedSupplier();
}


// 공급업체 상세 조회 중 처리 버튼의 중복 실행을 방지한다.
function setSupplierDetailLoading(loading) {

    newSupplierButton.disabled = loading;
    supplierSaveButton.disabled = loading;
    supplierStatusButton.disabled = loading;
}


// 공급업체 상세 Form 오류를 지운다.
function clearSupplierFormError() {

    supplierFormError.textContent = '';
    supplierFormError.hidden = true;
}


// 공급업체 상세 Form 오류를 표시한다.
function showSupplierFormError(message) {

    supplierFormError.textContent = message;
    supplierFormError.hidden = false;
}


// ========== 공급업체 신규 등록 ==========

// 신규 등록 버튼을 누르면 상세 Form을 빈 등록 상태로 전환한다.
function enterSupplierCreateMode() {

    if (!canEditSupplier) {
        return;
    }

    clearPageError();
    clearSupplierFormError();

    selectedSupplier = null;
    supplierFormMode = 'create';
    mobileDetailOpen = true;

    clearSupplierFormFields();

    supplierDetailMode.textContent = '신규 공급업체의 기본정보를 입력해 주세요.';
    supplierDetailTitle.textContent = '공급업체 등록';

    // 신규 공급업체 코드는 Server에서 자동 생성하고 사용 상태는 ACTIVE로 설정한다.
    supplierCodeValue.value = '';
    setMasterStatusBadge(supplierStatusBadge, 'ACTIVE');

    supplierDetailEmpty.hidden = true;
    supplierDetailForm.hidden = false;

    // 등록 전에는 별도 상태 변경을 할 수 없으므로 상태 변경 버튼을 숨긴다.
    supplierStatusButton.hidden = true;
    supplierSaveButton.hidden = false;
    supplierSaveButton.textContent = '공급업체 등록';

    setSupplierFormReadOnly(false);
    renderSelectedSupplier();
    syncDetailVisibility();

    supplierName.focus();
}


// 공급업체 입력 Form의 모든 사용자 입력값을 신규 등록 기본값으로 초기화한다.
function clearSupplierFormFields() {

    supplierName.value = '';
    supplierPhone.value = '';
    supplierEmail.value = '';
    supplierPostalCode.value = '';
    supplierAddress.value = '';
    supplierAddressDetail.value = '';
    supplierMemo.value = '';
}


// Form의 현재 모드에 따라 신규 등록 또는 기존 공급업체 수정 처리를 분기한다.
async function handleSupplierSubmit(event) {

    event.preventDefault();

    if (supplierFormMode === 'create') {
        await createSupplier();
        return;
    }

    if (supplierFormMode === 'edit') {
        await updateSupplier();
    }
}


// 공급업체 등록 전에 Server DTO의 필수 입력값을 확인한다.
function validateSupplierForm() {

    clearSupplierFormError();

    if (supplierName.value.trim() === '') {
        showSupplierFormError('공급업체명을 입력해 주세요.');
        supplierName.focus();
        return false;
    }

    if (supplierEmail.value.trim() === '') {
        showSupplierFormError('발주 이메일을 입력해 주세요.');
        supplierEmail.focus();
        return false;
    }

    if (!supplierEmail.checkValidity()) {
        showSupplierFormError('발주 이메일 형식이 올바르지 않습니다.');
        supplierEmail.focus();
        return false;
    }

    return true;
}


// Form 입력값으로 신규 공급업체 등록 요청 객체를 만든다.
function createSupplierRequestBody() {

    return {
        supplierName: supplierName.value.trim(),
        phone: normalizeOptionalValue(supplierPhone.value),
        email: supplierEmail.value.trim(),
        postalCode: normalizeOptionalValue(supplierPostalCode.value),
        address: normalizeOptionalValue(supplierAddress.value),
        addressDetail: normalizeOptionalValue(supplierAddressDetail.value),
        memo: normalizeOptionalValue(supplierMemo.value)
    };
}


// 빈 선택 입력값은 null로, 값이 있으면 앞뒤 공백을 제거한 문자열로 변환한다.
function normalizeOptionalValue(value) {

    const normalizedValue = value.trim();

    return normalizedValue === '' ? null : normalizedValue;
}


// 신규 공급업체를 등록하고 생성된 공급업체가 표시되도록 목록과 상세정보를 다시 조회한다.
async function createSupplier() {

    if (!canEditSupplier || !validateSupplierForm()) {
        return;
    }

    setSupplierDetailLoading(true);

    try {

        const response = await api.post('/suppliers', createSupplierRequestBody());
        const createdSupplier = response.data;

        // 신규 공급업체가 첫 페이지에 표시되도록 기존 검색 조건을 초기화한다.
        keywordFilter.value = '';
        statusFilter.value = '';

        await loadSuppliers(0);
        await selectSupplier(createdSupplier.supplierId);

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        showSupplierFormError(getApiErrorMessage(error));

    } finally {
        setSupplierDetailLoading(false);
    }
}


// ========== 공급업체 수정 ==========

// 선택한 공급업체의 기본정보와 주소 수정 요청 객체를 만든다.
function createSupplierUpdateRequestBody() {

    return {
        ...createSupplierRequestBody(),
        version: selectedSupplier.version
    };
}


// 선택한 공급업체를 수정하고 목록과 상세정보를 최신 데이터로 다시 조회한다.
async function updateSupplier() {

    if (!canEditSupplier || !selectedSupplier || !validateSupplierForm()) {
        return;
    }

    const supplierId = selectedSupplier.supplierId;
    const detailWasOpen = mobileDetailOpen;

    setSupplierDetailLoading(true);

    try {

        const response = await api.patch(`/suppliers/${supplierId}`, createSupplierUpdateRequestBody());
        const updatedSupplier = response.data;

        // 수정된 공급업체가 현재 검색 조건에 계속 포함되는지 확인한 뒤 다시 선택한다.
        await reloadCurrentSupplierPageAndSelect(updatedSupplier.supplierId, detailWasOpen);

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        // 오래된 version이면 최신 목록·상세정보를 다시 조회하여 다음 수정에 사용할 version도 갱신한다.
        if (isSupplierVersionConflict(error)) {
            await handleSupplierVersionConflict(error, supplierId, detailWasOpen);
            return;
        }

        showSupplierFormError(getApiErrorMessage(error));

    } finally {
        setSupplierDetailLoading(false);
    }
}


// 현재 공급업체 목록 페이지를 다시 조회하고 대상 공급업체가 남아 있으면 상세정보를 다시 선택한다.
async function reloadCurrentSupplierPageAndSelect(supplierId, openMobilePanel) {

    const currentPage = supplierPageMeta?.page ?? 0;

    await loadSuppliers(currentPage);

    const supplierStillVisible = suppliers.some(supplier => supplier.supplierId === supplierId);

    // 수정된 명칭이나 연락처가 검색 조건에서 제외되면 현재 화면 크기의 기본 상세 상태로 돌아간다.
    if (!supplierStillVisible) {
        await applyDefaultSupplierDetailState();
        return false;
    }

    await selectSupplier(supplierId, openMobilePanel);

    return true;
}


// version 충돌 메시지를 보존하면서 공급업체 목록과 상세정보를 최신 상태로 갱신한다.
async function handleSupplierVersionConflict(error, supplierId, openMobilePanel) {

    const message = getApiErrorMessage(error);

    try {

        const supplierStillVisible = await reloadCurrentSupplierPageAndSelect(supplierId, openMobilePanel);

        if (supplierStillVisible) {
            showSupplierFormError(message);
            return;
        }

        showPageError(message);

    } catch (reloadError) {
        handlePageError(reloadError, '최신 공급업체 정보를 다시 조회하지 못했습니다.');
    }
}


// 서버의 409 응답이 실제 version 동시성 충돌인지 메시지를 기준으로 구분한다.
function isSupplierVersionConflict(error) {

    if (error?.status !== 409) {
        return false;
    }

    return getApiErrorMessage(error).includes('다른 사용자가 먼저 수정했습니다.');
}


// ========== 공급업체 사용 상태 변경 ==========

// 선택한 공급업체의 현재 사용 상태를 기준으로 반대 상태 변경 확인 Modal을 연다.
function openSupplierStatusModal() {

    if (!canChangeSupplierStatus || !selectedSupplier || supplierFormMode !== 'edit') {
        return;
    }

    const nextStatus = selectedSupplier.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    statusModalSupplierId = selectedSupplier.supplierId;
    statusModalNextValue = nextStatus;
    statusModalVersion = selectedSupplier.version;

    statusTargetSupplier.textContent = `${selectedSupplier.supplierName} (${selectedSupplier.supplierCode})`;
    currentStatusValue.textContent = getMasterStatusLabel(selectedSupplier.status);
    nextStatusValue.textContent = getMasterStatusLabel(nextStatus);

    clearStatusModalError();

    statusModalBackdrop.hidden = false;
    confirmStatusButton.focus();
}


// 사용 상태 변경 Modal을 닫고 현재 요청 정보를 초기화한다.
function closeStatusModal() {

    statusModalBackdrop.hidden = true;
    statusModalSupplierId = null;
    statusModalNextValue = null;
    statusModalVersion = null;

    clearStatusModalError();
}


// 사용 상태 변경 Form 제출 시 선택한 공급업체의 상태 변경 요청을 실행한다.
async function handleStatusChangeSubmit(event) {

    event.preventDefault();

    await changeSupplierStatus();
}


// 선택한 공급업체의 ACTIVE·INACTIVE 사용 상태를 변경한다.
async function changeSupplierStatus() {

    if (!canChangeSupplierStatus || !statusModalSupplierId || !statusModalNextValue) {
        return;
    }

    const supplierId = statusModalSupplierId;
    const nextStatus = statusModalNextValue;
    const version = statusModalVersion;
    const detailWasOpen = mobileDetailOpen;

    setStatusModalLoading(true);

    try {

        await api.post(`/suppliers/${supplierId}/status`, {
            status: nextStatus,
            version
        });

        closeStatusModal();

        // 사용 상태 Filter에서 제외될 수 있으므로 현재 목록 페이지와 상세정보를 다시 조회한다.
        await reloadCurrentSupplierPageAndSelect(supplierId, detailWasOpen);

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        // version 충돌일 때는 Modal을 닫고 최신 공급업체 정보로 교체한다.
        if (isSupplierVersionConflict(error)) {

            closeStatusModal();
            await handleSupplierVersionConflict(error, supplierId, detailWasOpen);

            return;
        }

        // 진행 업무 참조 등 업무 조건 오류는 Modal을 유지한 채 Server 메시지를 표시한다.
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


// 상태 변경 Modal 요청 중 중복 실행과 닫기 동작을 막는다.
function setStatusModalLoading(loading) {

    confirmStatusButton.disabled = loading;
    cancelStatusButton.disabled = loading;
    closeStatusModalButton.disabled = loading;
}


// 상태 변경 Modal에 Server 오류 메시지를 표시한다.
function showStatusModalError(message) {

    statusModalError.textContent = message;
    statusModalError.hidden = false;
}


// 상태 변경 Modal의 오류 메시지를 지운다.
function clearStatusModalError() {

    statusModalError.textContent = '';
    statusModalError.hidden = true;
}


// SUPPLIER.status 값을 화면용 사용 상태 Badge로 변환한다.
function createMasterStatusBadge(status) {

    if (status === 'ACTIVE') {
        return '<span class="status-badge is-active">사용중</span>';
    }

    if (status === 'INACTIVE') {
        return '<span class="status-badge is-inactive">사용중지</span>';
    }

    return '<span class="status-badge">-</span>';
}


// 서버에서 받은 문자열을 innerHTML에 넣기 전에 HTML 특수문자를 변환한다.
function escapeHtml(value) {

    const element = document.createElement('div');

    element.textContent = value ?? '';

    return element.innerHTML;
}


// ========== 공급업체 목록 Pagination ==========

// 서버의 페이지 정보를 기준으로 공급업체 목록 페이지 버튼을 출력한다.
function renderSupplierPagination() {

    supplierPagination.innerHTML = '';

    if (!supplierPageMeta || supplierPageMeta.totalPages <= 1) {
        return;
    }

    const currentPage = supplierPageMeta.page;
    const totalPages = supplierPageMeta.totalPages;
    const firstVisiblePage = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
    const lastVisiblePage = Math.min(totalPages, firstVisiblePage + 5);

    supplierPagination.append(createSupplierPageButton('‹', currentPage - 1, currentPage === 0));

    for (let page = firstVisiblePage; page < lastVisiblePage; page += 1) {

        const button = createSupplierPageButton(String(page + 1), page, false);

        if (page === currentPage) {
            button.classList.add('is-active');
            button.setAttribute('aria-current', 'page');
        }

        supplierPagination.append(button);
    }

    supplierPagination.append(createSupplierPageButton('›', currentPage + 1, currentPage >= totalPages - 1));
}


// 공급업체 목록의 지정된 페이지로 이동하는 버튼을 만든다.
function createSupplierPageButton(label, page, disabled) {

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'page-button';
    button.textContent = label;
    button.disabled = disabled;

    button.addEventListener('click', async () => {

        clearPageError();

        try {
            await loadSuppliers(page);
            await applyDefaultSupplierDetailState();
        } catch (error) {
            handlePageError(error, '공급업체 목록을 불러오지 못했습니다.');
        }
    });

    return button;
}


// ========== 공급업체 검색 조건 ==========

// 현재 검색 조건으로 공급업체 목록 첫 페이지를 조회한다.
async function applySupplierFilters() {

    clearPageError();

    try {
        await loadSuppliers(0);
        await applyDefaultSupplierDetailState();
    } catch (error) {
        handlePageError(error, '공급업체 목록을 불러오지 못했습니다.');
    }
}


// 검색 조건을 초기화하고 공급업체 목록 첫 페이지를 다시 조회한다.
async function resetSupplierFilters() {

    keywordFilter.value = '';
    statusFilter.value = '';

    await applySupplierFilters();
}


// 검색어 입력창에서 Enter를 누르면 검색 버튼과 동일하게 처리한다.
async function handleKeywordKeydown(event) {

    if (event.key !== 'Enter') {
        return;
    }

    event.preventDefault();

    await applySupplierFilters();
}


// 공급업체 목록 조회 중 검색과 페이지 버튼의 중복 실행을 방지한다.
function setSupplierListLoading(loading) {

    searchButton.disabled = loading;
    resetFilterButton.disabled = loading;

    supplierPagination.querySelectorAll('button').forEach(button => {
        button.disabled = loading;
    });
}


// ========== Mobile 상세 Panel ==========

// 현재 화면이 Mobile Grid 기준인지 확인한다.
function isMobile() {
    return window.matchMedia('(max-width: 375px)').matches;
}


// 화면 크기와 Mobile Panel 상태에 따라 공급업체 상세 영역 표시 여부를 적용한다.
function syncDetailVisibility() {

    if (!isMobile()) {
        supplierDetailSection.hidden = false;
        return;
    }

    supplierDetailSection.hidden = !mobileDetailOpen;
}


// Mobile 공급업체 상세 Panel을 닫는다.
function closeMobileDetailPanel() {

    mobileDetailOpen = false;

    syncDetailVisibility();
}


// ========== 공통 오류 처리 ==========

// 공급업체 관리 화면 전체 오류를 표시한다.
function showPageError(message) {

    supplierPageError.textContent = message;
    supplierPageError.hidden = false;
}


// 공급업체 관리 화면 전체 오류를 지운다.
function clearPageError() {

    supplierPageError.textContent = '';
    supplierPageError.hidden = true;
}


// Session이 만료되어 401이 반환되면 로그인 화면으로 이동한다.
function handleUnauthorized(error) {

    if (error?.status !== 401) {
        return false;
    }

    window.location.replace('./login.html');

    return true;
}


// 공급업체 관리 화면에서 발생한 인증 또는 초기화 오류를 처리한다.
function handlePageError(error, fallbackMessage) {

    if (handleUnauthorized(error)) {
        return;
    }

    showPageError(error ? getApiErrorMessage(error) : fallbackMessage);
}


// ========== Event 연결 ==========

// 공급업체 검색과 검색 조건 초기화
searchButton.addEventListener('click', applySupplierFilters);
resetFilterButton.addEventListener('click', resetSupplierFilters);
keywordFilter.addEventListener('keydown', handleKeywordKeydown);

// 공급업체 신규 등록과 Form 제출
newSupplierButton.addEventListener('click', enterSupplierCreateMode);
supplierDetailForm.addEventListener('submit', handleSupplierSubmit);

// 공급업체 사용 상태 변경 Modal
supplierStatusButton.addEventListener('click', openSupplierStatusModal);
statusChangeForm.addEventListener('submit', handleStatusChangeSubmit);
closeStatusModalButton.addEventListener('click', closeStatusModal);
cancelStatusButton.addEventListener('click', closeStatusModal);

// Modal 바깥 영역을 누르면 상태 변경 요청 중이 아닐 때만 닫는다.
statusModalBackdrop.addEventListener('click', event => {

    if (event.target === statusModalBackdrop && !confirmStatusButton.disabled) {
        closeStatusModal();
    }
});

// Modal이 열린 상태에서 Escape를 누르면 상태 변경 요청 중이 아닐 때만 닫는다.
document.addEventListener('keydown', event => {

    if (event.key === 'Escape' && !statusModalBackdrop.hidden && !confirmStatusButton.disabled) {
        closeStatusModal();
    }
});

// Mobile 공급업체 상세 Panel을 닫는다.
closeDetailButton.addEventListener('click', closeMobileDetailPanel);

// 화면 크기 변경 시 Mobile 상세 Panel 표시 상태를 다시 적용한다.
window.addEventListener('resize', syncDetailVisibility);

// 공급업체 관리 화면 초기화를 시작한다.
initialize();
