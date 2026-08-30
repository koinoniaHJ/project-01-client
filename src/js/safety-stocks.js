// ********** 안전재고 관리 화면의 인증, 역할별 UI, 목록 조회와 안전재고 등록·변경 처리를 담당 **********

import { api, getApiErrorMessage } from './api.js';
import { hasRole } from './auth.js';
import { initializeCommonLayout } from './common-layout.js';


// 안전재고 목록 API가 서버에서 고정하여 사용하는 한 페이지 표시 개수
const SAFETY_STOCK_PAGE_SIZE = 20;


// 현재 로그인 사용자가 안전재고를 등록·변경할 수 있는지 저장
let canEditSafetyStock = false;


// 검색 조건 Select에 표시할 사용 중인 창고와 품목 목록
let activeWarehouses = [];
let activeItems = [];


// 현재 조회된 안전재고 목록과 서버의 페이지 정보
let safetyStocks = [];
let safetyStockPageMeta = null;


// 현재 선택한 창고·품목 조합과 Mobile 상세 Panel 표시 상태
let selectedSafetyStock = null;
let mobileDetailOpen = false;


// ========== 안전재고 관리 화면 공통 오류 ==========
const safetyStockPageError = document.querySelector('#safetyStockPageError');


// ========== 안전재고 목록 검색 조건 ==========
const warehouseFilter = document.querySelector('#warehouseFilter');
const itemFilter = document.querySelector('#itemFilter');
const belowSafetyStockFilter = document.querySelector('#belowSafetyStockFilter');
const searchButton = document.querySelector('#searchButton');
const resetFilterButton = document.querySelector('#resetFilterButton');


// ========== 안전재고 목록 ==========
const safetyStockCount = document.querySelector('#safetyStockCount');
const safetyStockTableBody = document.querySelector('#safetyStockTableBody');
const safetyStockMobileList = document.querySelector('#safetyStockMobileList');
const safetyStockPagination = document.querySelector('#safetyStockPagination');


// ========== 안전재고 상세·등록·변경 ==========
const safetyStockDetailSection = document.querySelector('#safetyStockDetailSection');
const safetyStockDetailMode = document.querySelector('#safetyStockDetailMode');
const safetyStockDetailForm = document.querySelector('#safetyStockDetailForm');
const safetyStockDetailEmpty = document.querySelector('#safetyStockDetailEmpty');
const closeDetailButton = document.querySelector('#closeDetailButton');
const warehouseCodeValue = document.querySelector('#warehouseCodeValue');
const warehouseNameValue = document.querySelector('#warehouseNameValue');
const itemCodeValue = document.querySelector('#itemCodeValue');
const itemNameValue = document.querySelector('#itemNameValue');
const itemUnitValue = document.querySelector('#itemUnitValue');
const availableStockValue = document.querySelector('#availableStockValue');
const shortageValue = document.querySelector('#shortageValue');
const detailSafetyStatusBadge = document.querySelector('#detailSafetyStatusBadge');
const safetyStockQuantity = document.querySelector('#safetyStockQuantity');
const safetyStockFormError = document.querySelector('#safetyStockFormError');
const safetyStockSaveButton = document.querySelector('#safetyStockSaveButton');


// ========== 안전재고 관리 화면 초기화 ==========

// 화면 진입 시 Session과 역할을 확인하고 필터 기준정보와 안전재고 첫 목록을 적용한다.
async function initialize() {

    clearPageError();
    syncDetailVisibility();

    try {

        const currentUser = await initializeCommonLayout({
            pageTitle: '안전재고 관리',
            activeMenu: 'safetyStock',
            onError: showPageError
        });

        if (!currentUser) {
            return;
        }

        applyRoleAccess();
        await loadFilterOptions();
        await loadSafetyStocks(0);
        applyDefaultSafetyStockDetailState();

    } catch (error) {
        handlePageError(error, '안전재고 목록을 불러오지 못했습니다.');
    }
}


// ========== 역할별 화면 제어 ==========

// ADMIN만 안전재고 수량을 등록·변경하고 OFFICE·WAREHOUSE는 전체 정보를 조회만 하도록 적용한다.
function applyRoleAccess() {

    canEditSafetyStock = hasRole('ADMIN');

    safetyStockQuantity.disabled = !canEditSafetyStock;
    safetyStockSaveButton.hidden = !canEditSafetyStock;
}


// ========== 검색 조건용 창고·품목 조회 ==========

// 안전재고 목록 필터에 사용할 모든 ACTIVE 창고와 품목을 각각 페이지 끝까지 조회한다.
async function loadFilterOptions() {

    setFilterOptionsLoading(true);

    try {
        [activeWarehouses, activeItems] = await Promise.all([
            loadAllActiveWarehouses(),
            loadAllActiveItems()
        ]);

        renderWarehouseFilterOptions();
        renderItemFilterOptions();

    } finally {
        setFilterOptionsLoading(false);
    }
}


// 사용 중인 창고 목록을 페이지별로 조회하여 하나의 검색 조건 목록으로 합친다.
async function loadAllActiveWarehouses() {

    const warehouses = [];
    let page = 0;
    let totalPages = 1;

    while (page < totalPages) {
        const response = await api.get(`/warehouses?status=ACTIVE&page=${page}&size=${SAFETY_STOCK_PAGE_SIZE}`);

        warehouses.push(...(response.data ?? []));
        totalPages = response.meta?.totalPages ?? 1;
        page += 1;
    }

    return warehouses;
}


// 사용 중인 품목 목록을 페이지별로 조회하여 하나의 검색 조건 목록으로 합친다.
async function loadAllActiveItems() {

    const items = [];
    let page = 0;
    let totalPages = 1;

    while (page < totalPages) {
        const response = await api.get(`/items?status=ACTIVE&page=${page}&size=${SAFETY_STOCK_PAGE_SIZE}`);

        items.push(...(response.data ?? []));
        totalPages = response.meta?.totalPages ?? 1;
        page += 1;
    }

    return items;
}


// ACTIVE 창고를 창고 코드·창고명으로 구분할 수 있는 검색 Option으로 출력한다.
function renderWarehouseFilterOptions() {

    warehouseFilter.innerHTML = '<option value="">전체</option>';

    activeWarehouses.forEach(warehouse => {
        const option = document.createElement('option');

        option.value = String(warehouse.warehouseId);
        option.textContent = `${warehouse.warehouseCode} - ${warehouse.warehouseName}`;

        warehouseFilter.append(option);
    });
}


// ACTIVE 품목을 품목 코드·품목명으로 구분할 수 있는 검색 Option으로 출력한다.
function renderItemFilterOptions() {

    itemFilter.innerHTML = '<option value="">전체</option>';

    activeItems.forEach(item => {
        const option = document.createElement('option');

        option.value = String(item.itemId);
        option.textContent = `${item.itemCode} - ${item.itemName}`;

        itemFilter.append(option);
    });
}


// 필터 기준정보 조회 중 검색 조건과 실행 버튼을 비활성화한다.
function setFilterOptionsLoading(loading) {

    warehouseFilter.disabled = loading;
    itemFilter.disabled = loading;
    belowSafetyStockFilter.disabled = loading;
    searchButton.disabled = loading;
    resetFilterButton.disabled = loading;
}


// ========== 안전재고 목록 조회 ==========

// 화면의 창고·품목·미달 여부와 페이지를 안전재고 목록 API 요청 경로로 변환한다.
function createSafetyStockListPath(page) {

    const params = new URLSearchParams();

    if (warehouseFilter.value) {
        params.set('warehouseId', warehouseFilter.value);
    }

    if (itemFilter.value) {
        params.set('itemId', itemFilter.value);
    }

    if (belowSafetyStockFilter.value) {
        params.set('belowSafetyStock', belowSafetyStockFilter.value);
    }

    params.set('page', String(page));

    return `/warehouse-items?${params.toString()}`;
}


// 지정한 페이지의 안전재고 목록을 조회하고 PC와 Mobile 화면을 갱신한다.
async function loadSafetyStocks(page) {

    setSafetyStockListLoading(true);

    try {
        const response = await api.get(createSafetyStockListPath(page));

        safetyStocks = response.data ?? [];
        safetyStockPageMeta = response.meta ?? null;

        renderSafetyStockCount();
        renderSafetyStockTable();
        renderSafetyStockMobileList();
        renderSafetyStockPagination();

    } finally {
        setSafetyStockListLoading(false);
    }
}


// 서버의 페이지 응답을 기준으로 조회 조건에 해당하는 전체 조합 건수를 표시한다.
function renderSafetyStockCount() {

    const totalElements = safetyStockPageMeta?.totalElements ?? safetyStocks.length;

    safetyStockCount.textContent = `총 ${totalElements.toLocaleString('ko-KR')}건`;
}


// PC와 Tablet에서 사용할 안전재고 Table을 출력한다.
function renderSafetyStockTable() {

    safetyStockTableBody.innerHTML = '';

    if (safetyStocks.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');

        cell.className = 'safety-stock-empty-cell';
        cell.colSpan = 6;
        cell.textContent = '조회된 안전재고 조합이 없습니다.';

        row.append(cell);
        safetyStockTableBody.append(row);
        return;
    }

    safetyStocks.forEach(safetyStock => {
        const row = document.createElement('tr');

        row.dataset.warehouseId = String(safetyStock.warehouseId);
        row.dataset.itemId = String(safetyStock.itemId);
        row.innerHTML = `
            <td>
                <span class="safety-stock-cell-title">${escapeHtml(safetyStock.warehouseName)}</span>
                <span class="safety-stock-cell-code">${escapeHtml(safetyStock.warehouseCode)}</span>
            </td>
            <td>
                <span class="safety-stock-cell-title">${escapeHtml(safetyStock.itemName)}</span>
                <span class="safety-stock-cell-code">${escapeHtml(safetyStock.itemCode)}</span>
            </td>
            <td>${escapeHtml(getItemUnitLabel(safetyStock.unit, safetyStock.otherUnitName))}</td>
            <td>${formatQuantity(safetyStock.safetyStockQuantity)}</td>
            <td>${formatQuantity(safetyStock.availableStockQuantity)}</td>
            <td>
                <span class="safety-stock-shortage-cell">
                    <span>${formatQuantity(safetyStock.shortageQuantity)}</span>
                    ${createSafetyStatusBadge(safetyStock.belowSafetyStock)}
                </span>
            </td>
        `;

        row.addEventListener('click', () => {
            selectSafetyStock(safetyStock.warehouseId, safetyStock.itemId);
        });

        safetyStockTableBody.append(row);
    });
}


// Mobile에서 사용할 창고·품목별 안전재고 Card 목록을 출력한다.
function renderSafetyStockMobileList() {

    safetyStockMobileList.innerHTML = '';

    if (safetyStocks.length === 0) {
        const emptyMessage = document.createElement('p');

        emptyMessage.className = 'safety-stock-mobile-empty';
        emptyMessage.textContent = '조회된 안전재고 조합이 없습니다.';

        safetyStockMobileList.append(emptyMessage);
        return;
    }

    safetyStocks.forEach(safetyStock => {
        const card = document.createElement('button');

        card.type = 'button';
        card.className = 'safety-stock-mobile-item';
        card.dataset.warehouseId = String(safetyStock.warehouseId);
        card.dataset.itemId = String(safetyStock.itemId);
        card.innerHTML = `
            <div class="safety-stock-mobile-top">
                <span class="safety-stock-mobile-warehouse">${escapeHtml(safetyStock.warehouseName)}</span>
                ${createSafetyStatusBadge(safetyStock.belowSafetyStock)}
            </div>
            <div class="safety-stock-mobile-target">
                <span class="safety-stock-mobile-item-name">${escapeHtml(safetyStock.itemName)}</span>
                <span class="safety-stock-mobile-code">${escapeHtml(safetyStock.itemCode)}</span>
                <span class="safety-stock-mobile-unit">${escapeHtml(getItemUnitLabel(safetyStock.unit, safetyStock.otherUnitName))}</span>
            </div>
            <div class="safety-stock-mobile-metrics">
                <span class="safety-stock-mobile-metric"><span>안전재고</span><strong>${formatQuantity(safetyStock.safetyStockQuantity)}</strong></span>
                <span class="safety-stock-mobile-metric"><span>가용재고</span><strong>${formatQuantity(safetyStock.availableStockQuantity)}</strong></span>
                <span class="safety-stock-mobile-metric"><span>부족 수량</span><strong>${formatQuantity(safetyStock.shortageQuantity)}</strong></span>
            </div>
        `;

        card.addEventListener('click', () => {
            selectSafetyStock(safetyStock.warehouseId, safetyStock.itemId);
        });

        safetyStockMobileList.append(card);
    });
}


// 안전재고 목록 조회 중 중복 검색과 페이지 이동을 막고 로딩 안내를 표시한다.
function setSafetyStockListLoading(loading) {

    searchButton.disabled = loading;
    resetFilterButton.disabled = loading;
    warehouseFilter.disabled = loading;
    itemFilter.disabled = loading;
    belowSafetyStockFilter.disabled = loading;

    if (!loading) {
        return;
    }

    safetyStockTableBody.innerHTML = '<tr><td colspan="6" class="safety-stock-empty-cell">안전재고 목록을 불러오는 중입니다.</td></tr>';
    safetyStockMobileList.innerHTML = '<p class="safety-stock-mobile-empty">안전재고 목록을 불러오는 중입니다.</p>';
    safetyStockPagination.innerHTML = '';
}


// 검색 버튼을 누르면 첫 페이지부터 조건을 적용하고 기본 상세 상태를 다시 결정한다.
async function applySafetyStockFilters() {

    clearPageError();

    try {
        await loadSafetyStocks(0);
        applyDefaultSafetyStockDetailState();

    } catch (error) {
        handlePageError(error, '안전재고 목록을 불러오지 못했습니다.');
    }
}


// 모든 검색 조건을 초기화하고 안전재고 목록 첫 페이지를 다시 조회한다.
async function resetSafetyStockFilters() {

    warehouseFilter.value = '';
    itemFilter.value = '';
    belowSafetyStockFilter.value = '';

    await applySafetyStockFilters();
}


// ========== 안전재고 상세 선택 ==========

// 현재 목록에서 창고·품목 식별자가 같은 조합을 선택하여 상세 입력 영역에 표시한다.
function selectSafetyStock(warehouseId, itemId, openMobilePanel = true) {

    const safetyStock = safetyStocks.find(item => item.warehouseId === warehouseId && item.itemId === itemId);

    if (!safetyStock) {
        return;
    }

    clearPageError();
    clearSafetyStockFormError();

    selectedSafetyStock = safetyStock;

    if (openMobilePanel) {
        mobileDetailOpen = true;
    }

    renderSafetyStockDetail();
    renderSelectedSafetyStock();
    syncDetailVisibility();
}


// 화면 크기와 현재 목록을 기준으로 처음 표시할 상세 상태를 적용한다.
function applyDefaultSafetyStockDetailState() {

    selectedSafetyStock = null;
    mobileDetailOpen = false;

    if (!isMobile() && safetyStocks.length > 0) {
        selectSafetyStock(safetyStocks[0].warehouseId, safetyStocks[0].itemId, false);
        return;
    }

    showSafetyStockDetailEmpty();
    syncDetailVisibility();
}


// 선택한 창고·품목 조합의 기준정보와 현재 안전재고 계산 결과를 출력한다.
function renderSafetyStockDetail() {

    if (!selectedSafetyStock) {
        showSafetyStockDetailEmpty();
        return;
    }

    const isRegistered = selectedSafetyStock.version !== null && selectedSafetyStock.version !== undefined;

    if (canEditSafetyStock) {
        safetyStockDetailMode.textContent = isRegistered
            ? '등록된 안전재고 수량을 변경할 수 있습니다.'
            : '미등록 조합입니다. 수량을 입력하면 안전재고가 최초 등록됩니다.';
    } else {
        safetyStockDetailMode.textContent = isRegistered
            ? '등록된 안전재고 기준과 현재 재고를 조회할 수 있습니다.'
            : '아직 안전재고가 등록되지 않은 조합입니다.';
    }

    warehouseCodeValue.value = selectedSafetyStock.warehouseCode ?? '';
    warehouseNameValue.value = selectedSafetyStock.warehouseName ?? '';
    itemCodeValue.value = selectedSafetyStock.itemCode ?? '';
    itemNameValue.value = selectedSafetyStock.itemName ?? '';
    itemUnitValue.value = getItemUnitLabel(selectedSafetyStock.unit, selectedSafetyStock.otherUnitName);
    availableStockValue.textContent = formatQuantity(selectedSafetyStock.availableStockQuantity);
    shortageValue.textContent = formatQuantity(selectedSafetyStock.shortageQuantity);
    safetyStockQuantity.value = String(selectedSafetyStock.safetyStockQuantity ?? 0);

    setSafetyStatusBadge(detailSafetyStatusBadge, selectedSafetyStock.belowSafetyStock);

    safetyStockDetailEmpty.hidden = true;
    safetyStockDetailForm.hidden = false;
    safetyStockQuantity.disabled = !canEditSafetyStock;
    safetyStockSaveButton.hidden = !canEditSafetyStock;
    safetyStockSaveButton.textContent = isRegistered ? '안전재고 변경' : '안전재고 등록';
}


// PC Table과 Mobile Card에서 현재 선택된 창고·품목 조합을 강조 표시한다.
function renderSelectedSafetyStock() {

    document.querySelectorAll('[data-warehouse-id][data-item-id]').forEach(element => {
        const warehouseId = Number(element.dataset.warehouseId);
        const itemId = Number(element.dataset.itemId);
        const isSelected = warehouseId === selectedSafetyStock?.warehouseId && itemId === selectedSafetyStock?.itemId;

        element.classList.toggle('is-selected', isSelected);
    });
}


// 선택된 조합이 없을 때 상세정보 안내 영역을 표시한다.
function showSafetyStockDetailEmpty() {

    selectedSafetyStock = null;
    safetyStockDetailMode.textContent = '목록에서 창고·품목 조합을 선택해 주세요.';
    safetyStockDetailForm.hidden = true;
    safetyStockDetailEmpty.hidden = false;

    renderSelectedSafetyStock();
}


// ========== 안전재고 등록·변경과 version 충돌 ==========

// ADMIN의 Form 제출을 검증하고 선택 조합의 안전재고 등록·변경 API를 호출한다.
async function handleSafetyStockSubmit(event) {

    event.preventDefault();

    if (!canEditSafetyStock || !selectedSafetyStock) {
        return;
    }

    clearPageError();
    clearSafetyStockFormError();

    if (!validateSafetyStockForm()) {
        return;
    }

    const warehouseId = selectedSafetyStock.warehouseId;
    const itemId = selectedSafetyStock.itemId;
    const detailWasOpen = mobileDetailOpen;

    setSafetyStockFormLoading(true);

    try {
        await api.put(`/warehouse-items/${warehouseId}/${itemId}`, createSafetyStockRequestBody());
        await reloadCurrentSafetyStockPageAndSelect(warehouseId, itemId, detailWasOpen);

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        if (isSafetyStockVersionConflict(error)) {
            await handleSafetyStockVersionConflict(error, warehouseId, itemId, detailWasOpen);
            return;
        }

        showSafetyStockFormError(getApiErrorMessage(error));

    } finally {
        setSafetyStockFormLoading(false);
    }
}


// 안전재고 수량이 0 이상이고 DB 수량 범위와 소수점 셋째 자리 조건을 충족하는지 검증한다.
function validateSafetyStockForm() {

    const value = safetyStockQuantity.value.trim();

    if (value === '') {
        showSafetyStockFormError('안전재고 수량을 입력해 주세요.');
        safetyStockQuantity.focus();
        return false;
    }

    if (!/^\d+(\.\d{1,3})?$/.test(value)) {
        showSafetyStockFormError('안전재고 수량은 0 이상의 숫자로 소수점 셋째 자리까지 입력해 주세요.');
        safetyStockQuantity.focus();
        return false;
    }

    const [integerPart] = value.split('.');
    const normalizedIntegerPart = integerPart.replace(/^0+(?=\d)/, '');

    if (normalizedIntegerPart.length > 16) {
        showSafetyStockFormError('안전재고 수량의 정수 부분은 최대 16자리까지 입력할 수 있습니다.');
        safetyStockQuantity.focus();
        return false;
    }

    return true;
}


// 미등록 조합은 version을 생략하고 기존 조합은 조회 당시 version을 포함한 요청 데이터를 생성한다.
function createSafetyStockRequestBody() {

    const requestBody = {
        safetyStockQuantity: Number(safetyStockQuantity.value)
    };

    if (selectedSafetyStock.version !== null && selectedSafetyStock.version !== undefined) {
        requestBody.version = selectedSafetyStock.version;
    }

    return requestBody;
}


// 현재 안전재고 목록 페이지를 다시 조회하고 대상 조합이 조건에 남아 있으면 다시 선택한다.
async function reloadCurrentSafetyStockPageAndSelect(warehouseId, itemId, openMobilePanel) {

    const currentPage = safetyStockPageMeta?.page ?? 0;

    await loadSafetyStocks(currentPage);

    // 저장 결과로 현재 필터의 전체 페이지가 줄었으면 마지막으로 존재하는 페이지를 다시 표시한다.
    if (safetyStocks.length === 0 && currentPage > 0 && (safetyStockPageMeta?.totalPages ?? 0) <= currentPage) {
        const lastPage = Math.max((safetyStockPageMeta?.totalPages ?? 1) - 1, 0);
        await loadSafetyStocks(lastPage);
    }

    const itemStillVisible = safetyStocks.some(item => item.warehouseId === warehouseId && item.itemId === itemId);

    // 저장 결과로 미달 조건이 바뀌어 현재 필터에서 제외되면 기본 상세 상태로 돌아간다.
    if (!itemStillVisible) {
        applyDefaultSafetyStockDetailState();
        return false;
    }

    selectSafetyStock(warehouseId, itemId, openMobilePanel);
    return true;
}


// version 충돌 메시지를 유지하면서 목록의 안전재고와 계산된 가용재고를 최신 상태로 갱신한다.
async function handleSafetyStockVersionConflict(error, warehouseId, itemId, openMobilePanel) {

    const message = getApiErrorMessage(error);

    try {
        const itemStillVisible = await reloadCurrentSafetyStockPageAndSelect(warehouseId, itemId, openMobilePanel);

        if (itemStillVisible) {
            showSafetyStockFormError(message);
            return;
        }

        showPageError(message);

    } catch (reloadError) {
        handlePageError(reloadError, '최신 안전재고 정보를 다시 조회하지 못했습니다.');
    }
}


// 409 응답 중 최초 등록·기존 변경의 실제 version 충돌만 최신 정보 재조회 대상으로 구분한다.
function isSafetyStockVersionConflict(error) {

    if (error?.status !== 409) {
        return false;
    }

    return getApiErrorMessage(error).includes('다른 사용자가 먼저 안전재고를 등록하거나 변경했습니다.');
}


// 안전재고 저장 중 입력값과 저장 버튼을 비활성화하여 중복 요청을 방지한다.
function setSafetyStockFormLoading(loading) {

    safetyStockQuantity.disabled = loading || !canEditSafetyStock;
    safetyStockSaveButton.disabled = loading;
}


// 안전재고 Form 오류를 표시한다.
function showSafetyStockFormError(message) {

    safetyStockFormError.textContent = message;
    safetyStockFormError.hidden = false;
}


// 안전재고 Form 오류를 지운다.
function clearSafetyStockFormError() {

    safetyStockFormError.textContent = '';
    safetyStockFormError.hidden = true;
}


// ========== 단위·수량·상태 표시 보조 함수 ==========

// ItemUnit과 OTHER 단위명을 화면에 표시할 실제 기준 단위명으로 변환한다.
function getItemUnitLabel(unit, otherUnitName) {

    if (unit === 'OTHER') {
        return otherUnitName?.trim() || '기타';
    }

    const unitLabels = {
        G: 'g',
        KG: 'kg',
        EA: '개',
        PACK: '팩',
        BOX: '박스'
    };

    return unitLabels[unit] ?? '-';
}


// 재고 수량을 천 단위 구분과 최대 소수점 셋째 자리 형식으로 변환한다.
function formatQuantity(value) {

    if (value === null || value === undefined || value === '') {
        return '0';
    }

    return Number(value).toLocaleString('ko-KR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3
    });
}


// 안전재고 미달 여부를 목록에서 사용할 Badge HTML로 변환한다.
function createSafetyStatusBadge(belowSafetyStock) {

    return belowSafetyStock
        ? '<span class="safety-status-badge is-below">미달</span>'
        : '<span class="safety-status-badge is-sufficient">정상</span>';
}


// 상세정보의 안전재고 미달 Badge를 현재 계산 결과에 맞게 갱신한다.
function setSafetyStatusBadge(element, belowSafetyStock) {

    element.className = `safety-status-badge ${belowSafetyStock ? 'is-below' : 'is-sufficient'}`;
    element.textContent = belowSafetyStock ? '미달' : '정상';
}


// 서버에서 받은 문자열을 innerHTML에 넣기 전에 HTML 특수문자를 변환한다.
function escapeHtml(value) {

    const element = document.createElement('div');

    element.textContent = value ?? '';

    return element.innerHTML;
}


// ========== 안전재고 목록 Pagination ==========

// 서버의 PageMeta를 기준으로 안전재고 목록 페이지 버튼을 출력한다.
function renderSafetyStockPagination() {

    safetyStockPagination.innerHTML = '';

    if (!safetyStockPageMeta || safetyStockPageMeta.totalPages <= 1) {
        return;
    }

    const currentPage = safetyStockPageMeta.page;
    const totalPages = safetyStockPageMeta.totalPages;
    const firstVisiblePage = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
    const lastVisiblePage = Math.min(totalPages, firstVisiblePage + 5);

    safetyStockPagination.append(createSafetyStockPageButton('‹', currentPage - 1, currentPage === 0));

    for (let page = firstVisiblePage; page < lastVisiblePage; page += 1) {
        const button = createSafetyStockPageButton(String(page + 1), page, false);

        if (page === currentPage) {
            button.classList.add('is-active');
            button.setAttribute('aria-current', 'page');
        }

        safetyStockPagination.append(button);
    }

    safetyStockPagination.append(createSafetyStockPageButton('›', currentPage + 1, currentPage >= totalPages - 1));
}


// 지정한 페이지로 이동하는 안전재고 목록 Pagination 버튼을 생성한다.
function createSafetyStockPageButton(label, page, disabled) {

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'page-button';
    button.textContent = label;
    button.disabled = disabled;

    button.addEventListener('click', async () => {

        clearPageError();

        try {
            await loadSafetyStocks(page);
            applyDefaultSafetyStockDetailState();

        } catch (error) {
            handlePageError(error, '안전재고 목록을 불러오지 못했습니다.');
        }
    });

    return button;
}


// ========== Mobile 상세 Panel ==========

// 현재 화면이 Mobile 상세 Panel 기준인지 확인한다.
function isMobile() {

    return window.matchMedia('(max-width: 375px)').matches;
}


// 화면 크기와 Mobile Panel 상태에 따라 안전재고 상세 영역 표시 여부를 적용한다.
function syncDetailVisibility() {

    if (!isMobile()) {
        safetyStockDetailSection.hidden = false;
        return;
    }

    safetyStockDetailSection.hidden = !mobileDetailOpen;
}


// Mobile 안전재고 상세 Panel을 닫는다.
function closeMobileDetailPanel() {

    mobileDetailOpen = false;
    syncDetailVisibility();
}


// ========== 공통 오류 처리 ==========

// 안전재고 관리 화면 전체 오류를 표시한다.
function showPageError(message) {

    safetyStockPageError.textContent = message;
    safetyStockPageError.hidden = false;
}


// 안전재고 관리 화면 전체 오류를 지운다.
function clearPageError() {

    safetyStockPageError.textContent = '';
    safetyStockPageError.hidden = true;
}


// Session이 만료되어 401이 반환되면 로그인 화면으로 이동한다.
function handleUnauthorized(error) {

    if (error?.status !== 401) {
        return false;
    }

    window.location.replace('./login.html');
    return true;
}


// 안전재고 관리 화면에서 발생한 인증 또는 조회 오류를 처리한다.
function handlePageError(error, fallbackMessage) {

    if (handleUnauthorized(error)) {
        return;
    }

    showPageError(error ? getApiErrorMessage(error) : fallbackMessage);
}


// ========== Event 연결 ==========

// 안전재고 검색과 검색 조건 초기화
searchButton.addEventListener('click', applySafetyStockFilters);
resetFilterButton.addEventListener('click', resetSafetyStockFilters);

// 안전재고 등록·변경 Form
safetyStockDetailForm.addEventListener('submit', handleSafetyStockSubmit);

// Mobile 상세 Panel 닫기와 화면 크기 변경 처리
closeDetailButton.addEventListener('click', closeMobileDetailPanel);
window.addEventListener('resize', syncDetailVisibility);

// 안전재고 관리 화면 초기화를 시작한다.
initialize();
