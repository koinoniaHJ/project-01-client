// ********** 창고 관리 화면의 인증, 역할별 UI, 목록·상세·상태 변경 처리를 담당 **********

import { api, getApiErrorMessage } from './api.js';
import { hasRole } from './auth.js';
import { initializeCommonLayout } from './common-layout.js';


// 창고 목록의 한 페이지 표시 개수
const WAREHOUSE_PAGE_SIZE = 20;


// 현재 로그인 사용자의 역할별 창고 처리 가능 여부
let canEditWarehouse = false;
let canChangeWarehouseStatus = false;


// 현재 조회된 창고 목록과 서버의 페이지 정보
let warehouses = [];
let warehousePageMeta = null;


// 현재 선택한 창고의 상세정보와 Form 상태
// create: 신규 등록 / edit: 기존 창고 조회·수정
let selectedWarehouse = null;
let warehouseFormMode = null;


// 사용 상태 변경 Modal의 대상 창고와 변경 요청 정보
let statusModalWarehouseId = null;
let statusModalNextValue = null;
let statusModalVersion = null;


// Mobile에서 창고 상세 하단 Panel이 열려 있는지 저장
let mobileDetailOpen = false;


// ========== 창고 관리 화면 공통 오류 ==========
const warehousePageError = document.querySelector('#warehousePageError');


// ========== 창고 목록 검색 조건 ==========
const keywordFilter = document.querySelector('#keywordFilter');
const statusFilter = document.querySelector('#statusFilter');
const searchButton = document.querySelector('#searchButton');
const resetFilterButton = document.querySelector('#resetFilterButton');


// ========== 창고 목록 ==========
const warehouseCount = document.querySelector('#warehouseCount');
const warehouseTableBody = document.querySelector('#warehouseTableBody');
const warehouseMobileList = document.querySelector('#warehouseMobileList');
const warehousePagination = document.querySelector('#warehousePagination');


// ========== 창고 상세·등록·수정 ==========
const newWarehouseButton = document.querySelector('#newWarehouseButton');
const warehouseDetailSection = document.querySelector('#warehouseDetailSection');
const warehouseDetailTitle = document.querySelector('#warehouseDetailTitle');
const warehouseDetailMode = document.querySelector('#warehouseDetailMode');
const warehouseDetailForm = document.querySelector('#warehouseDetailForm');
const warehouseDetailEmpty = document.querySelector('#warehouseDetailEmpty');
const closeDetailButton = document.querySelector('#closeDetailButton');
const warehouseCodeValue = document.querySelector('#warehouseCodeValue');
const warehouseStatusBadge = document.querySelector('#warehouseStatusBadge');
const warehouseName = document.querySelector('#warehouseName');
const warehousePostalCode = document.querySelector('#warehousePostalCode');
const warehouseAddress = document.querySelector('#warehouseAddress');
const warehouseAddressDetail = document.querySelector('#warehouseAddressDetail');
const warehouseMemo = document.querySelector('#warehouseMemo');
const warehouseFormError = document.querySelector('#warehouseFormError');
const warehouseStatusButton = document.querySelector('#warehouseStatusButton');
const warehouseSaveButton = document.querySelector('#warehouseSaveButton');


// ========== 창고 사용 상태 변경 Modal ==========
const statusModalBackdrop = document.querySelector('#statusModalBackdrop');
const statusChangeForm = document.querySelector('#statusChangeForm');
const closeStatusModalButton = document.querySelector('#closeStatusModalButton');
const statusTargetWarehouse = document.querySelector('#statusTargetWarehouse');
const currentStatusValue = document.querySelector('#currentStatusValue');
const nextStatusValue = document.querySelector('#nextStatusValue');
const statusModalError = document.querySelector('#statusModalError');
const cancelStatusButton = document.querySelector('#cancelStatusButton');
const confirmStatusButton = document.querySelector('#confirmStatusButton');


// ========== 창고 관리 화면 초기화 ==========

// 화면 진입 시 Session을 확인하고 현재 사용자 역할에 맞는 UI와 첫 목록을 적용한다.
async function initialize() {

    clearPageError();
    syncDetailVisibility();

    try {

        // 공통 Sidebar·Header를 생성하고 현재 로그인 Session의 사용자 정보를 조회한다.
        const currentUser = await initializeCommonLayout({
            pageTitle: '창고 관리',
            activeMenu: 'warehouses',
            onError: showPageError
        });

        // 공통 Layout에서 로그인 화면으로 이동한 경우 이후 초기화를 중단한다.
        if (!currentUser) {
            return;
        }

        applyRoleAccess();
        await loadWarehouses(0);
        await applyDefaultWarehouseDetailState();

    } catch (error) {
        handlePageError(error, '창고 목록을 불러오지 못했습니다.');
    }
}


// ========== 역할별 화면 제어 ==========

// 현재 로그인 사용자의 역할을 기준으로 창고 등록·수정·상태 변경 범위를 적용한다.
function applyRoleAccess() {

    canEditWarehouse = hasRole('ADMIN', 'OFFICE');
    canChangeWarehouseStatus = hasRole('ADMIN');

    // 창고 등록과 기본정보 수정은 ADMIN과 OFFICE만 가능하다.
    newWarehouseButton.hidden = !canEditWarehouse;
    warehouseSaveButton.hidden = !canEditWarehouse;

    // 창고 사용 상태 변경은 ADMIN만 가능하다.
    warehouseStatusButton.hidden = !canChangeWarehouseStatus;

    // WAREHOUSE는 창고의 모든 상세정보를 조회할 수 있지만 수정할 수 없다.
    setWarehouseFormReadOnly(!canEditWarehouse);
}


// 창고 Form의 업무 입력 요소를 조회 전용 또는 수정 가능 상태로 전환한다.
function setWarehouseFormReadOnly(readOnly) {

    const editableFields = warehouseDetailForm.querySelectorAll('input[name], textarea[name]');

    editableFields.forEach(field => {
        field.disabled = readOnly;
    });
}


// ========== 창고 목록 조회 ==========

// 화면의 검색 조건과 페이지 정보를 창고 목록 API 요청 경로로 변환한다.
function createWarehouseListPath(page) {

    const params = new URLSearchParams();
    const keyword = keywordFilter.value.trim();
    const status = statusFilter.value;

    if (keyword) {
        params.set('keyword', keyword);
    }

    if (status) {
        params.set('status', status);
    }

    params.set('page', String(page));
    params.set('size', String(WAREHOUSE_PAGE_SIZE));

    return `/warehouses?${params.toString()}`;
}


// 지정한 페이지의 창고 목록을 조회하고 PC와 Mobile 화면을 갱신한다.
async function loadWarehouses(page) {

    setWarehouseListLoading(true);

    try {
        const response = await api.get(createWarehouseListPath(page));

        warehouses = response.data ?? [];
        warehousePageMeta = response.meta ?? null;

        renderWarehouseCount();
        renderWarehouseTable();
        renderWarehouseMobileList();
        renderWarehousePagination();

    } finally {
        setWarehouseListLoading(false);
    }
}


// 서버의 페이지 응답을 기준으로 창고 전체 건수를 표시한다.
function renderWarehouseCount() {

    const totalElements = warehousePageMeta?.totalElements ?? warehouses.length;

    warehouseCount.textContent = `총 ${totalElements.toLocaleString('ko-KR')}건`;
}


// PC와 Tablet에서 사용할 창고 Table을 출력한다.
function renderWarehouseTable() {

    warehouseTableBody.innerHTML = '';

    if (warehouses.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');

        cell.className = 'warehouse-empty-cell';
        cell.colSpan = 4;
        cell.textContent = '조회된 창고가 없습니다.';

        row.append(cell);
        warehouseTableBody.append(row);

        return;
    }

    warehouses.forEach(warehouse => {
        const row = document.createElement('tr');

        row.dataset.warehouseId = String(warehouse.warehouseId);
        row.innerHTML = `
            <td>${escapeHtml(warehouse.warehouseCode)}</td>
            <td>${escapeHtml(warehouse.warehouseName)}</td>
            <td title="${escapeHtml(warehouse.address ?? '')}">${escapeHtml(warehouse.address ?? '-')}</td>
            <td>${createMasterStatusBadge(warehouse.status)}</td>
        `;

        row.addEventListener('click', async () => {
            await selectWarehouse(warehouse.warehouseId);
        });

        warehouseTableBody.append(row);
    });
}


// Mobile에서 사용할 창고 Card 목록을 출력한다.
function renderWarehouseMobileList() {

    warehouseMobileList.innerHTML = '';

    if (warehouses.length === 0) {
        const emptyMessage = document.createElement('p');

        emptyMessage.className = 'warehouse-mobile-empty';
        emptyMessage.textContent = '조회된 창고가 없습니다.';

        warehouseMobileList.append(emptyMessage);

        return;
    }

    warehouses.forEach(warehouse => {
        const card = document.createElement('button');

        card.type = 'button';
        card.className = 'warehouse-mobile-item';
        card.dataset.warehouseId = String(warehouse.warehouseId);
        card.innerHTML = `
            <div class="warehouse-mobile-top">
                <span class="warehouse-mobile-name">${escapeHtml(warehouse.warehouseName)}</span>
                ${createMasterStatusBadge(warehouse.status)}
            </div>
            <div class="warehouse-mobile-bottom">
                <span class="warehouse-mobile-code">${escapeHtml(warehouse.warehouseCode)}</span>
                <span class="warehouse-mobile-address">${escapeHtml(warehouse.address ?? '-')}</span>
            </div>
        `;

        card.addEventListener('click', async () => {
            await selectWarehouse(warehouse.warehouseId);
        });

        warehouseMobileList.append(card);
    });
}


// 창고 목록 조회 중 중복 검색과 페이지 이동을 막고 로딩 안내를 표시한다.
function setWarehouseListLoading(loading) {

    searchButton.disabled = loading;
    resetFilterButton.disabled = loading;

    if (!loading) {
        return;
    }

    warehouseTableBody.innerHTML = '<tr><td colspan="4" class="warehouse-empty-cell">창고 목록을 불러오는 중입니다.</td></tr>';
    warehouseMobileList.innerHTML = '<p class="warehouse-mobile-empty">창고 목록을 불러오는 중입니다.</p>';
    warehousePagination.innerHTML = '';
}


// 검색 버튼을 누르면 첫 페이지부터 조건을 적용하고 기본 상세 상태를 다시 결정한다.
async function applyWarehouseFilters() {

    clearPageError();

    try {
        await loadWarehouses(0);
        await applyDefaultWarehouseDetailState();

    } catch (error) {
        handlePageError(error, '창고 목록을 불러오지 못했습니다.');
    }
}


// 검색 조건을 초기화하고 창고 목록 첫 페이지를 다시 조회한다.
async function resetWarehouseFilters() {

    keywordFilter.value = '';
    statusFilter.value = '';

    await applyWarehouseFilters();
}


// 검색어 입력창에서 Enter를 누르면 검색 버튼과 동일하게 처리한다.
async function handleKeywordKeydown(event) {

    if (event.key !== 'Enter') {
        return;
    }

    event.preventDefault();

    await applyWarehouseFilters();
}


// MASTER_STATUS 값을 창고 목록용 사용 상태 Badge로 변환한다.
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


// ========== 창고 상세 조회 ==========

// 창고 식별자로 최신 상세정보를 조회하여 상세 Form에 표시한다.
async function selectWarehouse(warehouseId, openMobilePanel = true) {

    clearPageError();
    clearWarehouseFormError();
    setWarehouseDetailLoading(true);

    try {
        const response = await api.get(`/warehouses/${warehouseId}`);

        selectedWarehouse = response.data;
        warehouseFormMode = 'edit';

        if (openMobilePanel) {
            mobileDetailOpen = true;
        }

        renderWarehouseDetail();
        renderSelectedWarehouse();
        syncDetailVisibility();

    } catch (error) {
        handlePageError(error, '창고 상세정보를 불러오지 못했습니다.');

    } finally {
        setWarehouseDetailLoading(false);
    }
}


// 화면 크기와 조회된 목록에 맞는 기본 상세 상태를 적용한다.
async function applyDefaultWarehouseDetailState() {

    selectedWarehouse = null;
    warehouseFormMode = null;
    mobileDetailOpen = false;

    // PC와 Tablet에서는 조회된 첫 창고를 기본 선택한다.
    if (!isMobile() && warehouses.length > 0) {
        await selectWarehouse(warehouses[0].warehouseId, false);
        return;
    }

    showWarehouseDetailEmpty();
    syncDetailVisibility();
}


// 선택한 창고의 전체 상세정보를 Form에 표시한다.
function renderWarehouseDetail() {

    if (!selectedWarehouse) {
        showWarehouseDetailEmpty();
        return;
    }

    warehouseDetailTitle.textContent = '창고 정보';
    warehouseDetailMode.textContent = '선택한 창고 정보를 확인하거나 수정할 수 있습니다.';

    warehouseCodeValue.value = selectedWarehouse.warehouseCode ?? '';
    warehouseName.value = selectedWarehouse.warehouseName ?? '';
    warehousePostalCode.value = selectedWarehouse.postalCode ?? '';
    warehouseAddress.value = selectedWarehouse.address ?? '';
    warehouseAddressDetail.value = selectedWarehouse.addressDetail ?? '';
    warehouseMemo.value = selectedWarehouse.memo ?? '';

    setMasterStatusBadge(warehouseStatusBadge, selectedWarehouse.status);

    warehouseDetailEmpty.hidden = true;
    warehouseDetailForm.hidden = false;

    setWarehouseFormReadOnly(!canEditWarehouse);

    warehouseSaveButton.hidden = !canEditWarehouse;
    warehouseSaveButton.textContent = '저장';
    warehouseStatusButton.hidden = !canChangeWarehouseStatus;
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


// 목록과 Mobile Card에서 현재 선택된 창고를 강조 표시한다.
function renderSelectedWarehouse() {

    document.querySelectorAll('[data-warehouse-id]').forEach(element => {
        const warehouseId = Number(element.dataset.warehouseId);
        const selectedWarehouseId = selectedWarehouse?.warehouseId;

        element.classList.toggle('is-selected', warehouseId === selectedWarehouseId);
    });
}


// 선택된 창고가 없을 때 상세정보 안내 화면을 표시한다.
function showWarehouseDetailEmpty() {

    selectedWarehouse = null;
    warehouseFormMode = null;

    warehouseDetailTitle.textContent = '창고 정보';
    warehouseDetailMode.textContent = '선택한 창고 정보를 확인하거나 수정할 수 있습니다.';
    warehouseDetailForm.hidden = true;
    warehouseDetailEmpty.hidden = false;

    renderSelectedWarehouse();
}


// 창고 상세 조회 중 처리 버튼의 중복 실행을 방지한다.
function setWarehouseDetailLoading(loading) {

    newWarehouseButton.disabled = loading;
    warehouseSaveButton.disabled = loading;
    warehouseStatusButton.disabled = loading;
}


// 창고 상세 Form 오류를 표시한다.
function showWarehouseFormError(message) {

    warehouseFormError.textContent = message;
    warehouseFormError.hidden = false;
}


// 창고 상세 Form 오류를 지운다.
function clearWarehouseFormError() {

    warehouseFormError.textContent = '';
    warehouseFormError.hidden = true;
}


// ========== 창고 신규 등록 ==========

// 신규 등록 버튼을 누르면 상세 Form을 빈 등록 상태로 전환한다.
function enterWarehouseCreateMode() {

    if (!canEditWarehouse) {
        return;
    }

    clearPageError();
    clearWarehouseFormError();

    selectedWarehouse = null;
    warehouseFormMode = 'create';
    mobileDetailOpen = true;

    clearWarehouseFormFields();

    warehouseDetailTitle.textContent = '창고 등록';
    warehouseDetailMode.textContent = '신규 창고의 기본정보와 주소를 입력해 주세요.';

    // 신규 창고 코드는 Server에서 자동 생성하고 사용 상태는 ACTIVE로 설정한다.
    warehouseCodeValue.value = '';
    setMasterStatusBadge(warehouseStatusBadge, 'ACTIVE');

    warehouseDetailEmpty.hidden = true;
    warehouseDetailForm.hidden = false;
    warehouseStatusButton.hidden = true;
    warehouseSaveButton.hidden = false;
    warehouseSaveButton.textContent = '창고 등록';

    setWarehouseFormReadOnly(false);
    renderSelectedWarehouse();
    syncDetailVisibility();

    warehouseName.focus();
}


// 신규 등록 Form의 기존 입력값을 초기화한다.
function clearWarehouseFormFields() {

    warehouseName.value = '';
    warehousePostalCode.value = '';
    warehouseAddress.value = '';
    warehouseAddressDetail.value = '';
    warehouseMemo.value = '';
}


// Form의 현재 모드에 따라 신규 등록 또는 기존 창고 수정 처리를 분기한다.
async function handleWarehouseSubmit(event) {

    event.preventDefault();

    if (!canEditWarehouse || (warehouseFormMode !== 'create' && warehouseFormMode !== 'edit')) {
        return;
    }

    if (warehouseFormMode === 'edit' && !selectedWarehouse) {
        return;
    }

    clearPageError();
    clearWarehouseFormError();

    if (!validateWarehouseForm()) {
        return;
    }

    const warehouseId = selectedWarehouse?.warehouseId;
    const detailWasOpen = mobileDetailOpen;

    setWarehouseFormLoading(true);

    try {

        if (warehouseFormMode === 'create') {
            await createWarehouse();
            return;
        }

        await updateWarehouse(warehouseId, detailWasOpen);

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        if (warehouseFormMode === 'edit' && isWarehouseVersionConflict(error)) {
            await handleWarehouseVersionConflict(error, warehouseId, detailWasOpen);
            return;
        }

        showWarehouseFormError(getApiErrorMessage(error));

    } finally {
        setWarehouseFormLoading(false);
    }
}


// 창고 등록·수정 전에 Server DTO의 필수 창고명을 확인한다.
function validateWarehouseForm() {

    if (warehouseName.value.trim() === '') {
        showWarehouseFormError('창고명을 입력해 주세요.');
        warehouseName.focus();
        return false;
    }

    return true;
}


// 창고 등록 API에 전달할 요청 데이터를 생성한다.
function createWarehouseRequestBody() {

    return {
        warehouseName: warehouseName.value.trim(),
        postalCode: normalizeOptionalValue(warehousePostalCode.value),
        address: normalizeOptionalValue(warehouseAddress.value),
        addressDetail: normalizeOptionalValue(warehouseAddressDetail.value),
        memo: normalizeOptionalValue(warehouseMemo.value)
    };
}


// 선택 입력값의 앞뒤 공백을 제거하고 빈 문자열은 null로 변환한다.
function normalizeOptionalValue(value) {

    const normalizedValue = value.trim();

    return normalizedValue === '' ? null : normalizedValue;
}


// 신규 창고를 등록하고 생성된 창고가 포함된 목록 페이지와 상세정보를 표시한다.
async function createWarehouse() {

    const response = await api.post('/warehouses', createWarehouseRequestBody());
    const createdWarehouse = response.data;

    keywordFilter.value = '';
    statusFilter.value = '';

    // warehouseCode 오름차순에서 신규 코드는 마지막 페이지에 있으므로 해당 페이지를 다시 조회한다.
    await loadWarehouses(0);

    const lastPage = Math.max((warehousePageMeta?.totalPages ?? 1) - 1, 0);

    if (lastPage > 0) {
        await loadWarehouses(lastPage);
    }

    await selectWarehouse(createdWarehouse.warehouseId);
}


// ========== 창고 수정 및 version 충돌 ==========

// 선택한 창고의 수정 요청 데이터에 상세 조회 당시 version을 추가한다.
function createWarehouseUpdateRequestBody() {

    return {
        ...createWarehouseRequestBody(),
        version: selectedWarehouse.version
    };
}


// 선택한 창고를 수정하고 현재 목록과 상세정보를 최신 데이터로 다시 조회한다.
async function updateWarehouse(warehouseId, openMobilePanel) {

    const response = await api.patch(`/warehouses/${warehouseId}`, createWarehouseUpdateRequestBody());
    const updatedWarehouse = response.data;

    await reloadCurrentWarehousePageAndSelect(updatedWarehouse.warehouseId, openMobilePanel);
}


// 현재 창고 목록 페이지를 다시 조회하고 대상 창고가 남아 있으면 상세정보를 다시 선택한다.
async function reloadCurrentWarehousePageAndSelect(warehouseId, openMobilePanel) {

    const currentPage = warehousePageMeta?.page ?? 0;

    await loadWarehouses(currentPage);

    const warehouseStillVisible = warehouses.some(warehouse => warehouse.warehouseId === warehouseId);

    // 수정된 창고명·주소 또는 상태가 검색 조건에서 제외되면 기본 상세 상태로 돌아간다.
    if (!warehouseStillVisible) {
        await applyDefaultWarehouseDetailState();
        return false;
    }

    await selectWarehouse(warehouseId, openMobilePanel);

    return true;
}


// version 충돌 메시지를 보존하면서 창고 목록과 상세정보를 최신 상태로 갱신한다.
async function handleWarehouseVersionConflict(error, warehouseId, openMobilePanel) {

    const message = getApiErrorMessage(error);

    try {
        const warehouseStillVisible = await reloadCurrentWarehousePageAndSelect(warehouseId, openMobilePanel);

        if (warehouseStillVisible) {
            showWarehouseFormError(message);
            return;
        }

        showPageError(message);

    } catch (reloadError) {
        handlePageError(reloadError, '최신 창고 정보를 다시 조회하지 못했습니다.');
    }
}


// 서버의 409 응답이 실제 version 동시성 충돌인지 메시지를 기준으로 구분한다.
function isWarehouseVersionConflict(error) {

    if (error?.status !== 409) {
        return false;
    }

    return getApiErrorMessage(error).includes('다른 사용자가 먼저 수정했습니다.');
}


// 창고 등록·수정 요청 중 Form과 신규 등록 버튼의 중복 실행을 방지한다.
function setWarehouseFormLoading(loading) {

    newWarehouseButton.disabled = loading;
    warehouseSaveButton.disabled = loading;
}


// ========== 창고 사용 상태 변경 ==========

// 선택한 창고의 현재 사용 상태를 기준으로 반대 상태 변경 확인 Modal을 연다.
function openWarehouseStatusModal() {

    if (!canChangeWarehouseStatus || !selectedWarehouse || warehouseFormMode !== 'edit') {
        return;
    }

    const nextStatus = selectedWarehouse.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    statusModalWarehouseId = selectedWarehouse.warehouseId;
    statusModalNextValue = nextStatus;
    statusModalVersion = selectedWarehouse.version;

    statusTargetWarehouse.textContent = `${selectedWarehouse.warehouseName} (${selectedWarehouse.warehouseCode})`;
    currentStatusValue.textContent = getMasterStatusLabel(selectedWarehouse.status);
    nextStatusValue.textContent = getMasterStatusLabel(nextStatus);

    clearStatusModalError();

    statusModalBackdrop.hidden = false;
    confirmStatusButton.focus();
}


// 사용 상태 변경 Modal을 닫고 현재 요청 정보를 초기화한다.
function closeStatusModal() {

    statusModalBackdrop.hidden = true;
    statusModalWarehouseId = null;
    statusModalNextValue = null;
    statusModalVersion = null;

    clearStatusModalError();
}


// 사용 상태 변경 Form 제출 시 선택한 창고의 상태 변경 요청을 실행한다.
async function handleStatusChangeSubmit(event) {

    event.preventDefault();

    await changeWarehouseStatus();
}


// 선택한 창고의 ACTIVE·INACTIVE 사용 상태를 변경한다.
async function changeWarehouseStatus() {

    if (!canChangeWarehouseStatus || !statusModalWarehouseId || !statusModalNextValue) {
        return;
    }

    const warehouseId = statusModalWarehouseId;
    const nextStatus = statusModalNextValue;
    const version = statusModalVersion;
    const detailWasOpen = mobileDetailOpen;

    setStatusModalLoading(true);

    try {

        await api.post(`/warehouses/${warehouseId}/status`, {
            status: nextStatus,
            version
        });

        closeStatusModal();
        await reloadCurrentWarehousePageAndSelect(warehouseId, detailWasOpen);

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        if (isWarehouseVersionConflict(error)) {
            closeStatusModal();
            await handleWarehouseVersionConflict(error, warehouseId, detailWasOpen);
            return;
        }

        // 현재 재고·진행 업무 참조 등 업무 조건 오류는 Modal을 유지한 채 표시한다.
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


// ========== 창고 목록 Pagination ==========

// 서버의 페이지 정보를 기준으로 창고 목록 페이지 버튼을 출력한다.
function renderWarehousePagination() {

    warehousePagination.innerHTML = '';

    if (!warehousePageMeta || warehousePageMeta.totalPages <= 1) {
        return;
    }

    const currentPage = warehousePageMeta.page;
    const totalPages = warehousePageMeta.totalPages;
    const firstVisiblePage = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
    const lastVisiblePage = Math.min(totalPages, firstVisiblePage + 5);

    warehousePagination.append(createWarehousePageButton('‹', currentPage - 1, currentPage === 0));

    for (let page = firstVisiblePage; page < lastVisiblePage; page += 1) {
        const button = createWarehousePageButton(String(page + 1), page, false);

        if (page === currentPage) {
            button.classList.add('is-active');
            button.setAttribute('aria-current', 'page');
        }

        warehousePagination.append(button);
    }

    warehousePagination.append(createWarehousePageButton('›', currentPage + 1, currentPage >= totalPages - 1));
}


// 지정한 페이지로 이동하는 창고 목록 Pagination 버튼을 생성한다.
function createWarehousePageButton(label, page, disabled) {

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'page-button';
    button.textContent = label;
    button.disabled = disabled;

    button.addEventListener('click', async () => {

        clearPageError();

        try {
            await loadWarehouses(page);
            await applyDefaultWarehouseDetailState();

        } catch (error) {
            handlePageError(error, '창고 목록을 불러오지 못했습니다.');
        }
    });

    return button;
}


// ========== Mobile 상세 Panel ==========

// 현재 화면이 Mobile 상세 Panel 기준인지 확인한다.
function isMobile() {

    return window.matchMedia('(max-width: 375px)').matches;
}


// 화면 크기와 Mobile Panel 상태에 따라 창고 상세 영역 표시 여부를 적용한다.
function syncDetailVisibility() {

    if (!isMobile()) {
        warehouseDetailSection.hidden = false;
        return;
    }

    warehouseDetailSection.hidden = !mobileDetailOpen;
}


// Mobile 창고 상세 Panel을 닫는다.
function closeMobileDetailPanel() {

    mobileDetailOpen = false;

    syncDetailVisibility();
}


// ========== 공통 오류 처리 ==========

// 창고 관리 화면 전체 오류를 표시한다.
function showPageError(message) {

    warehousePageError.textContent = message;
    warehousePageError.hidden = false;
}


// 창고 관리 화면 전체 오류를 지운다.
function clearPageError() {

    warehousePageError.textContent = '';
    warehousePageError.hidden = true;
}


// Session이 만료되어 401이 반환되면 로그인 화면으로 이동한다.
function handleUnauthorized(error) {

    if (error?.status !== 401) {
        return false;
    }

    window.location.replace('./login.html');

    return true;
}


// 창고 관리 화면에서 발생한 인증 또는 초기화 오류를 처리한다.
function handlePageError(error, fallbackMessage) {

    if (handleUnauthorized(error)) {
        return;
    }

    showPageError(error ? getApiErrorMessage(error) : fallbackMessage);
}


// ========== Event 연결 ==========

// 창고 검색과 검색 조건 초기화
searchButton.addEventListener('click', applyWarehouseFilters);
resetFilterButton.addEventListener('click', resetWarehouseFilters);
keywordFilter.addEventListener('keydown', handleKeywordKeydown);

// 창고 신규 등록·수정 Form
newWarehouseButton.addEventListener('click', enterWarehouseCreateMode);
warehouseDetailForm.addEventListener('submit', handleWarehouseSubmit);

// 창고 사용 상태 변경 Modal
warehouseStatusButton.addEventListener('click', openWarehouseStatusModal);
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

// Mobile 창고 상세 Panel을 닫는다.
closeDetailButton.addEventListener('click', closeMobileDetailPanel);

// 화면 크기 변경 시 Mobile 상세 Panel 표시 상태를 다시 적용한다.
window.addEventListener('resize', syncDetailVisibility);

// 창고 관리 화면 초기화를 시작한다.
initialize();
