// ********** 품목 관리 화면의 인증, 역할별 UI 및 공통 화면 처리를 담당 **********

import { api, getApiErrorMessage } from './api.js';
import { hasRole } from './auth.js';
import { initializeCommonLayout } from './common-layout.js';


// 품목 목록의 한 페이지 표시 개수
const ITEM_PAGE_SIZE = 20;

// 품목 Filter와 취급 공급업체 검색 Select에 한 번에 표시할 최대 공급업체 개수
const SUPPLIER_FILTER_PAGE_SIZE = 2000;


// 현재 로그인 사용자의 역할별 품목 처리 가능 여부
let canEditItem = false;
let canChangeItemStatus = false;
let canManageItemSuppliers = false;
let canViewItemPrice = false;


// 현재 조회된 품목 목록과 서버의 페이지 정보
let items = [];
let itemPageMeta = null;


// 취급 공급업체 검색 결과 중 현재 품목에 새로 등록할 수 있는 공급업체 목록
let supplierSearchResults = [];


// 현재 선택한 품목의 상세정보와 Form 상태
// create: 신규 등록 / edit: 기존 품목 조회·수정
let selectedItem = null;
let itemFormMode = null;


// 사용 상태 변경 Modal의 대상 품목과 변경 요청 정보
let statusModalItemId = null;
let statusModalNextValue = null;
let statusModalVersion = null;


// 취급 공급업체 관계 해제 Modal의 대상 품목과 공급업체 식별자
let removeModalItemId = null;
let removeModalSupplierId = null;


// Mobile에서 품목 상세 하단 Panel이 열려 있는지 저장
let mobileDetailOpen = false;


// ========== 품목 관리 화면 공통 오류 ==========
const itemPageError = document.querySelector('#itemPageError');


// ========== 품목 목록 검색 조건 ==========
const keywordFilter = document.querySelector('#keywordFilter');
const statusFilter = document.querySelector('#statusFilter');
const supplierFilter = document.querySelector('#supplierFilter');
const searchButton = document.querySelector('#searchButton');
const resetFilterButton = document.querySelector('#resetFilterButton');


// ========== 품목 목록 ==========
const itemCount = document.querySelector('#itemCount');
const itemTableBody = document.querySelector('#itemTableBody');
const itemMobileList = document.querySelector('#itemMobileList');
const itemPagination = document.querySelector('#itemPagination');


// ========== 역할별 표시를 제어할 품목 화면 요소 ==========
const newItemButton = document.querySelector('#newItemButton');
const itemDetailSection = document.querySelector('#itemDetailSection');
const itemDetailForm = document.querySelector('#itemDetailForm');
const closeDetailButton = document.querySelector('#closeDetailButton');
const itemPriceColumns = document.querySelectorAll('.item-price-column');
const itemPriceField = document.querySelector('#itemPriceField');
const itemSupplierControls = document.querySelector('#itemSupplierControls');
const itemSupplierManageColumns = document.querySelectorAll('.item-supplier-manage-column');
const itemSupplierTableBody = document.querySelector('#itemSupplierTableBody');
const itemSupplierMobileList = document.querySelector('#itemSupplierMobileList');
const itemSupplierCount = document.querySelector('#itemSupplierCount');
const itemSupplierGuide = document.querySelector('#itemSupplierGuide');
const supplierKeyword = document.querySelector('#supplierKeyword');
const searchSupplierButton = document.querySelector('#searchSupplierButton');
const supplierSelect = document.querySelector('#supplierSelect');
const addSupplierButton = document.querySelector('#addSupplierButton');
const itemSupplierError = document.querySelector('#itemSupplierError');
const itemDetailTitle = document.querySelector('#itemDetailTitle');
const itemDetailMode = document.querySelector('#itemDetailMode');
const itemDetailEmpty = document.querySelector('#itemDetailEmpty');
const itemCodeValue = document.querySelector('#itemCodeValue');
const itemStatusBadge = document.querySelector('#itemStatusBadge');
const itemName = document.querySelector('#itemName');
const itemUnit = document.querySelector('#itemUnit');
const otherUnitNameField = document.querySelector('#otherUnitNameField');
const otherUnitName = document.querySelector('#otherUnitName');
const defaultSalesPrice = document.querySelector('#defaultSalesPrice');
const itemMemo = document.querySelector('#itemMemo');
const itemFormError = document.querySelector('#itemFormError');
const itemStatusButton = document.querySelector('#itemStatusButton');
const itemSaveButton = document.querySelector('#itemSaveButton');


// ========== 품목 사용 상태 변경 Modal ==========
const statusModalBackdrop = document.querySelector('#statusModalBackdrop');
const statusChangeForm = document.querySelector('#statusChangeForm');
const closeStatusModalButton = document.querySelector('#closeStatusModalButton');
const statusTargetItem = document.querySelector('#statusTargetItem');
const currentStatusValue = document.querySelector('#currentStatusValue');
const nextStatusValue = document.querySelector('#nextStatusValue');
const statusModalError = document.querySelector('#statusModalError');
const cancelStatusButton = document.querySelector('#cancelStatusButton');
const confirmStatusButton = document.querySelector('#confirmStatusButton');


// ========== 취급 공급업체 관계 해제 Modal ==========
const supplierRemoveModalBackdrop = document.querySelector('#supplierRemoveModalBackdrop');
const supplierRemoveForm = document.querySelector('#supplierRemoveForm');
const closeSupplierRemoveModalButton = document.querySelector('#closeSupplierRemoveModalButton');
const removeTargetItem = document.querySelector('#removeTargetItem');
const removeTargetSupplier = document.querySelector('#removeTargetSupplier');
const supplierRemoveModalError = document.querySelector('#supplierRemoveModalError');
const cancelSupplierRemoveButton = document.querySelector('#cancelSupplierRemoveButton');
const confirmSupplierRemoveButton = document.querySelector('#confirmSupplierRemoveButton');


// ========== 품목 관리 화면 초기화 ==========

// 화면 진입 시 Session을 확인하고 현재 사용자 역할에 맞는 UI를 적용한다.
async function initialize() {

    clearPageError();
    syncDetailVisibility();

    try {

        // 공통 Sidebar·Header를 생성하고 현재 로그인 Session의 사용자 정보를 조회한다.
        const currentUser = await initializeCommonLayout({
            pageTitle: '품목 관리',
            activeMenu: 'items',
            onError: showPageError
        });

        // 공통 Layout에서 로그인 화면으로 이동한 경우 이후 초기화를 중단한다.
        if (!currentUser) {
            return;
        }

        // 품목 데이터를 연결하기 전에 역할별 표시와 수정 범위를 먼저 확정한다.
        applyRoleAccess();

        // 취급 공급업체 필터에 표시할 공급업체 목록을 공급업체 코드 오름차순으로 조회한다.
        await loadSupplierFilterOptions();

        // 역할별 UI 적용 후 품목 목록 첫 페이지를 조회한다.
        await loadItems(0);

        // PC와 Tablet에서는 첫 품목을 기본 선택하고 Mobile은 목록만 표시한다.
        await applyDefaultItemDetailState();

    } catch (error) {
        handlePageError(error, '품목 목록을 불러오지 못했습니다.');
    }
}


// ========== 취급 공급업체 필터 조회 ==========

// 품목 검색 조건에서 사용할 공급업체 목록을 조회하여 Select Option을 구성한다.
async function loadSupplierFilterOptions() {

    supplierFilter.disabled = true;

    try {
        const response = await api.get(`/suppliers?page=0&size=${SUPPLIER_FILTER_PAGE_SIZE}&sort=supplierCode,asc`);

        renderSupplierFilterOptions(response.data ?? []);
        supplierFilter.disabled = false;

    } catch (error) {

        // Session 만료는 화면 초기화의 공통 인증 오류 처리로 전달한다.
        if (error?.status === 401) {
            throw error;
        }

        supplierFilter.replaceChildren(new Option('공급업체 목록 조회 실패', ''));
        showPageError(error ? getApiErrorMessage(error) : '취급 공급업체 목록을 불러오지 못했습니다.');
    }
}


// 조회한 공급업체를 코드·명칭·사용 상태가 함께 표시되는 Select Option으로 출력한다.
function renderSupplierFilterOptions(suppliers) {

    const options = [new Option('전체', '')];

    suppliers.forEach(supplier => {
        const statusSuffix = supplier.status === 'INACTIVE' ? ' (사용중지)' : '';
        const label = `${supplier.supplierCode} - ${supplier.supplierName}${statusSuffix}`;

        options.push(new Option(label, String(supplier.supplierId)));
    });

    supplierFilter.replaceChildren(...options);
}


// ========== 역할별 화면 제어 ==========

// 현재 로그인 사용자의 역할을 기준으로 품목 정보와 처리 버튼의 표시 범위를 적용한다.
function applyRoleAccess() {

    canEditItem = hasRole('ADMIN', 'OFFICE');
    canChangeItemStatus = hasRole('ADMIN');
    canManageItemSuppliers = hasRole('ADMIN', 'OFFICE');
    canViewItemPrice = !hasRole('WAREHOUSE');

    // 품목 등록과 기본정보 수정은 ADMIN과 OFFICE만 가능하다.
    newItemButton.hidden = !canEditItem;
    itemSaveButton.hidden = !canEditItem;

    // 품목 사용 상태 변경은 ADMIN만 가능하다.
    itemStatusButton.hidden = !canChangeItemStatus;

    // 취급 공급업체 등록·해제는 ADMIN과 OFFICE만 가능하고 WAREHOUSE에는 관리 열도 표시하지 않는다.
    itemSupplierControls.hidden = !canManageItemSuppliers;
    itemSupplierManageColumns.forEach(column => {
        column.hidden = !canManageItemSuppliers;
    });

    // WAREHOUSE에는 기본 판매가격 목록 열과 상세 입력 영역을 표시하지 않는다.
    itemPriceColumns.forEach(column => {
        column.hidden = !canViewItemPrice;
    });
    itemPriceField.hidden = !canViewItemPrice;

    // WAREHOUSE는 품목 상세정보를 조회만 할 수 있도록 업무 입력 필드를 비활성화한다.
    setItemFormReadOnly(!canEditItem);
    updateInitialTableColumnSpans();
}


// 품목 Form의 업무 입력 요소를 조회 전용 또는 수정 가능 상태로 전환한다.
function setItemFormReadOnly(readOnly) {

    // name 속성이 있는 품목 입력 필드만 제어하고 취급 공급업체 검색 영역은 별도 기능에서 관리한다.
    const editableFields = itemDetailForm.querySelectorAll('input[name], select[name], textarea[name]');

    editableFields.forEach(field => {
        field.disabled = readOnly;
    });
}


// 역할별로 숨겨지는 가격·관계 관리 열에 맞춰 초기 빈 행의 colspan을 조정한다.
function updateInitialTableColumnSpans() {

    const itemEmptyCell = document.querySelector('.item-empty-cell');
    const supplierEmptyCell = itemSupplierTableBody.querySelector('.item-supplier-empty-cell');

    if (itemEmptyCell) {
        itemEmptyCell.colSpan = canViewItemPrice ? 5 : 4;
    }

    if (supplierEmptyCell) {
        supplierEmptyCell.colSpan = canManageItemSuppliers ? 4 : 3;
    }
}


// ========== 품목 목록 조회 ==========

// 현재 검색 조건과 페이지 번호를 이용하여 품목 목록 API 경로를 만든다.
function createItemListPath(page) {

    const params = new URLSearchParams();
    const keyword = keywordFilter.value.trim();
    const status = statusFilter.value;
    const supplierId = supplierFilter.value;

    // 입력된 검색 조건만 Query Parameter에 포함한다.
    if (keyword) {
        params.set('keyword', keyword);
    }

    if (status) {
        params.set('status', status);
    }

    if (supplierId) {
        params.set('supplierId', supplierId);
    }

    params.set('page', String(page));
    params.set('size', String(ITEM_PAGE_SIZE));
    params.set('sort', 'itemCode,asc');

    return `/items?${params.toString()}`;
}


// 지정한 페이지의 품목 목록을 조회하고 PC와 Mobile 화면을 갱신한다.
async function loadItems(page) {

    setItemListLoading(true);

    try {
        const response = await api.get(createItemListPath(page));

        items = response.data ?? [];
        itemPageMeta = response.meta ?? null;

        renderItemCount();
        renderItemTable();
        renderItemMobileList();
        renderItemPagination();

    } finally {
        setItemListLoading(false);
    }
}


// 서버의 페이지 응답을 기준으로 품목 전체 건수를 표시한다.
function renderItemCount() {

    const totalElements = itemPageMeta?.totalElements ?? items.length;

    itemCount.textContent = `전체 ${totalElements.toLocaleString('ko-KR')}건`;
}


// PC와 Tablet에서 사용할 품목 Table을 출력한다.
function renderItemTable() {

    itemTableBody.innerHTML = '';

    if (items.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');

        cell.className = 'item-empty-cell';
        cell.colSpan = canViewItemPrice ? 5 : 4;
        cell.textContent = '조회된 품목이 없습니다.';

        row.append(cell);
        itemTableBody.append(row);

        return;
    }

    items.forEach(item => {
        const row = document.createElement('tr');
        const priceCell = canViewItemPrice
            ? `<td class="item-price-column">${escapeHtml(formatCurrency(item.defaultSalesPrice))}</td>`
            : '';

        // 다음 상세 조회 단계에서 사용할 품목 식별자를 행에 저장한다.
        row.dataset.itemId = String(item.itemId);
        row.innerHTML = `
            <td>${escapeHtml(item.itemCode)}</td>
            <td>${escapeHtml(item.itemName)}</td>
            <td>${escapeHtml(getItemUnitLabel(item.unit))}</td>
            ${priceCell}
            <td>${createMasterStatusBadge(item.status)}</td>
        `;

        // 품목 행을 선택하면 최신 상세정보와 취급 공급업체 목록을 별도 API로 조회한다.
        row.addEventListener('click', async () => {
            await selectItem(item.itemId);
        });

        itemTableBody.append(row);
    });
}


// Mobile에서 사용할 품목 Card 목록을 출력한다.
function renderItemMobileList() {

    itemMobileList.innerHTML = '';

    if (items.length === 0) {
        const emptyMessage = document.createElement('p');

        emptyMessage.className = 'item-mobile-empty';
        emptyMessage.textContent = '조회된 품목이 없습니다.';

        itemMobileList.append(emptyMessage);

        return;
    }

    items.forEach(item => {
        const card = document.createElement('button');

        card.type = 'button';
        card.className = 'item-mobile-item';
        card.dataset.itemId = String(item.itemId);
        card.setAttribute('aria-label', `${item.itemName} 품목 상세 조회`);
        card.innerHTML = `
            <div class="item-mobile-top">
                <span class="item-mobile-name">${escapeHtml(item.itemName)}</span>
                <span class="item-mobile-code">${escapeHtml(item.itemCode)}</span>
            </div>
            <div class="item-mobile-middle">
                <span class="item-mobile-unit">${escapeHtml(getItemUnitLabel(item.unit))}</span>
                ${createMasterStatusBadge(item.status)}
            </div>
            ${createMobileItemPrice(item.defaultSalesPrice)}
        `;

        // Mobile Card 선택 시 상세정보를 조회하고 하단 Panel을 연다.
        card.addEventListener('click', async () => {
            await selectItem(item.itemId);
        });

        itemMobileList.append(card);
    });
}


// WAREHOUSE를 제외한 역할의 Mobile 품목 Card에 기본 판매가격을 표시한다.
function createMobileItemPrice(defaultSalesPrice) {

    if (!canViewItemPrice) {
        return '';
    }

    return `
        <div class="item-mobile-bottom">
            <span class="item-mobile-price">기본 판매가격 ${escapeHtml(formatCurrency(defaultSalesPrice))}</span>
        </div>
    `;
}


// ITEM.unit Enum을 화면용 단위명으로 변환한다.
function getItemUnitLabel(unit) {

    const unitLabels = {
        G: 'g',
        KG: 'kg',
        EA: '개',
        PACK: '팩',
        BOX: '박스',
        OTHER: '기타'
    };

    return unitLabels[unit] ?? '-';
}


// ITEM.status 값을 화면용 사용 상태 Badge로 변환한다.
function createMasterStatusBadge(status) {

    if (status === 'ACTIVE') {
        return '<span class="status-badge is-active">사용중</span>';
    }

    if (status === 'INACTIVE') {
        return '<span class="status-badge is-inactive">사용중지</span>';
    }

    return '<span class="status-badge">-</span>';
}


// 기본 판매가격을 원화 표시 형식으로 변환한다.
function formatCurrency(value) {

    if (value === null || value === undefined || value === '') {
        return '-';
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return '-';
    }

    return `${number.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원`;
}


// 서버에서 받은 문자열을 innerHTML에 넣기 전에 HTML 특수문자를 변환한다.
function escapeHtml(value) {

    const element = document.createElement('div');

    element.textContent = value ?? '';

    return element.innerHTML;
}


// ========== 품목 상세 조회 ==========

// 품목 식별자로 최신 상세정보와 취급 공급업체 목록을 조회하여 상세 Form에 표시한다.
async function selectItem(itemId, openMobilePanel = true) {

    clearPageError();
    clearItemFormError();
    setItemDetailLoading(true);

    try {
        const response = await api.get(`/items/${itemId}`);

        selectedItem = response.data;
        itemFormMode = 'edit';

        // Mobile Card를 직접 선택한 경우 상세 하단 Panel을 연다.
        if (openMobilePanel) {
            mobileDetailOpen = true;
        }

        renderItemDetail();
        renderSelectedItem();
        syncDetailVisibility();

    } catch (error) {
        handlePageError(error, '품목 상세정보를 불러오지 못했습니다.');

    } finally {
        setItemDetailLoading(false);
    }
}


// 화면 크기와 조회된 목록에 맞는 기본 상세 상태를 적용한다.
async function applyDefaultItemDetailState() {

    selectedItem = null;
    itemFormMode = null;
    mobileDetailOpen = false;

    // PC와 Tablet에서는 조회된 첫 품목을 기본 선택한다.
    if (!isMobile() && items.length > 0) {
        await selectItem(items[0].itemId, false);
        return;
    }

    showItemDetailEmpty();
    syncDetailVisibility();
}


// 선택한 품목의 전체 상세정보를 Form에 표시한다.
function renderItemDetail() {

    if (!selectedItem) {
        showItemDetailEmpty();
        return;
    }

    itemDetailMode.textContent = '선택한 품목 정보를 확인하거나 수정할 수 있습니다.';
    itemDetailTitle.textContent = '품목 정보';

    itemCodeValue.value = selectedItem.itemCode ?? '';
    itemName.value = selectedItem.itemName ?? '';
    itemUnit.value = selectedItem.unit ?? '';
    itemMemo.value = selectedItem.memo ?? '';

    // OTHER 단위에서만 기타 단위명을 표시하고 나머지 단위에서는 값을 비운다.
    renderOtherUnitNameField(selectedItem.unit, selectedItem.otherUnitName);

    // WAREHOUSE 응답에서는 기본 판매가격이 null이며 화면 입력 영역도 숨긴다.
    defaultSalesPrice.value = canViewItemPrice && selectedItem.defaultSalesPrice !== null
        ? selectedItem.defaultSalesPrice
        : '';

    setMasterStatusBadge(itemStatusBadge, selectedItem.status);
    renderItemSuppliers();

    itemDetailEmpty.hidden = true;
    itemDetailForm.hidden = false;

    setItemFormReadOnly(!canEditItem);

    itemSaveButton.hidden = !canEditItem;
    itemSaveButton.textContent = '저장';
    itemStatusButton.hidden = !canChangeItemStatus;
    itemSupplierControls.hidden = !canManageItemSuppliers;

    // 선택 품목이 바뀌면 이전 공급업체 검색 결과가 다른 품목에 사용되지 않도록 초기화한다.
    resetSupplierManagementControls();
}


// 선택 단위에 따라 기타 단위명 입력 영역과 값을 표시한다.
function renderOtherUnitNameField(unit, value) {

    const otherUnitSelected = unit === 'OTHER';

    otherUnitNameField.hidden = !otherUnitSelected;
    otherUnitName.required = otherUnitSelected;
    otherUnitName.value = otherUnitSelected ? value ?? '' : '';
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


// 선택 품목의 취급 공급업체 목록을 PC Table과 Mobile Card에 출력한다.
function renderItemSuppliers() {

    const suppliers = selectedItem?.suppliers ?? [];

    itemSupplierCount.textContent = `총 ${suppliers.length.toLocaleString('ko-KR')}건`;
    renderItemSupplierTable(suppliers);
    renderItemSupplierMobileList(suppliers);
}


// PC와 Tablet에서 사용할 취급 공급업체 Table을 출력한다.
function renderItemSupplierTable(suppliers) {

    itemSupplierTableBody.innerHTML = '';

    if (suppliers.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');

        cell.className = 'item-supplier-empty-cell';
        cell.colSpan = canManageItemSuppliers ? 4 : 3;
        cell.textContent = '등록된 취급 공급업체가 없습니다.';

        row.append(cell);
        itemSupplierTableBody.append(row);

        return;
    }

    suppliers.forEach(supplier => {
        const row = document.createElement('tr');
        const manageCell = canManageItemSuppliers
            ? '<td class="item-supplier-manage-column"><button type="button" class="item-supplier-remove-button">해제</button></td>'
            : '';

        row.dataset.supplierId = String(supplier.supplierId);
        row.innerHTML = `
            <td>${escapeHtml(supplier.supplierCode)}</td>
            <td>${escapeHtml(supplier.supplierName)}</td>
            <td>${createMasterStatusBadge(supplier.status)}</td>
            ${manageCell}
        `;

        // ADMIN·OFFICE는 현재 품목과 공급업체의 취급 관계 해제 Modal을 열 수 있다.
        row.querySelector('.item-supplier-remove-button')?.addEventListener('click', () => {
            openSupplierRemoveModal(supplier.supplierId);
        });

        itemSupplierTableBody.append(row);
    });
}


// Mobile에서 사용할 취급 공급업체 Card 목록을 출력한다.
function renderItemSupplierMobileList(suppliers) {

    itemSupplierMobileList.innerHTML = '';

    if (suppliers.length === 0) {
        const emptyMessage = document.createElement('p');

        emptyMessage.className = 'item-supplier-mobile-empty';
        emptyMessage.textContent = '등록된 취급 공급업체가 없습니다.';

        itemSupplierMobileList.append(emptyMessage);

        return;
    }

    suppliers.forEach(supplier => {
        const card = document.createElement('article');

        card.className = 'item-supplier-mobile-item';
        card.dataset.supplierId = String(supplier.supplierId);
        card.innerHTML = `
            <div class="item-supplier-mobile-top">
                <span class="item-supplier-mobile-name">${escapeHtml(supplier.supplierName)}</span>
                ${createMasterStatusBadge(supplier.status)}
            </div>
            <div class="item-supplier-mobile-bottom">
                <span class="item-supplier-mobile-code">${escapeHtml(supplier.supplierCode)}</span>
            </div>
        `;

        // Mobile에서도 PC Table과 동일한 권한 범위로 관계 해제 버튼을 제공한다.
        if (canManageItemSuppliers) {
            const removeButton = document.createElement('button');

            removeButton.type = 'button';
            removeButton.className = 'item-supplier-remove-button';
            removeButton.textContent = '해제';
            removeButton.addEventListener('click', () => {
                openSupplierRemoveModal(supplier.supplierId);
            });

            card.querySelector('.item-supplier-mobile-bottom').append(removeButton);
        }

        itemSupplierMobileList.append(card);
    });
}


// ========== 취급 공급업체 검색 및 등록 ==========

// 선택 품목과 역할에 맞춰 취급 공급업체 검색 Control과 이전 검색 결과를 초기화한다.
function resetSupplierManagementControls() {

    const canSearchSupplier = canManageItemSuppliers && itemFormMode === 'edit' && selectedItem !== null;
    const selectGuide = itemFormMode === 'create' ? '품목 저장 후 선택' : '공급업체 검색 후 선택';

    supplierSearchResults = [];
    supplierKeyword.value = '';
    supplierSelect.replaceChildren(new Option(selectGuide, ''));

    supplierKeyword.disabled = !canSearchSupplier;
    searchSupplierButton.disabled = !canSearchSupplier;
    supplierSelect.disabled = true;
    addSupplierButton.disabled = true;

    if (itemFormMode === 'create') {
        itemSupplierGuide.textContent = '품목 등록 시 취급 공급업체를 등록할 수 있습니다.';

    } else if (canSearchSupplier) {
        itemSupplierGuide.textContent = '사용 중인 공급업체를 검색하여 취급 관계를 등록할 수 있습니다.';

    } else {
        itemSupplierGuide.textContent = '현재 품목에 등록된 취급 공급업체를 확인할 수 있습니다.';
    }

    clearItemSupplierError();
}


// 공급업체 코드·명칭 검색어와 ACTIVE 조건을 공급업체 목록 API 요청 경로로 변환한다.
function createSupplierSearchPath() {

    const params = new URLSearchParams();
    const keyword = supplierKeyword.value.trim();

    if (keyword) {
        params.set('keyword', keyword);
    }

    params.set('status', 'ACTIVE');
    params.set('page', '0');
    params.set('size', String(SUPPLIER_FILTER_PAGE_SIZE));
    params.set('sort', 'supplierCode,asc');

    return `/suppliers?${params.toString()}`;
}


// 사용 중인 공급업체를 검색하고 현재 품목에 등록되지 않은 공급업체만 선택 목록에 표시한다.
async function searchAvailableSuppliers() {

    if (!canManageItemSuppliers || !selectedItem || itemFormMode !== 'edit') {
        return;
    }

    const itemId = selectedItem.itemId;

    clearItemSupplierError();
    setSupplierManagementLoading(true);

    try {
        const response = await api.get(createSupplierSearchPath());

        // 검색 중 다른 품목을 선택했다면 이전 품목의 검색 결과를 현재 화면에 표시하지 않는다.
        if (selectedItem?.itemId !== itemId || itemFormMode !== 'edit') {
            return;
        }

        const registeredSupplierIds = new Set(
            (selectedItem.suppliers ?? []).map(supplier => supplier.supplierId)
        );

        supplierSearchResults = (response.data ?? []).filter(
            supplier => !registeredSupplierIds.has(supplier.supplierId)
        );

        renderSupplierSearchOptions();

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        supplierSearchResults = [];
        renderSupplierSearchOptions();
        showItemSupplierError(getApiErrorMessage(error));

    } finally {
        setSupplierManagementLoading(false);
    }
}


// 취급 관계로 새로 등록할 수 있는 공급업체를 Select Option으로 출력한다.
function renderSupplierSearchOptions() {

    const options = [];

    if (supplierSearchResults.length === 0) {
        options.push(new Option('등록 가능한 공급업체가 없습니다.', ''));
        itemSupplierGuide.textContent = '검색 조건에 맞는 미등록 사용 중 공급업체가 없습니다.';

    } else {
        options.push(new Option('공급업체를 선택해 주세요.', ''));

        supplierSearchResults.forEach(supplier => {
            const label = `${supplier.supplierCode} - ${supplier.supplierName}`;

            options.push(new Option(label, String(supplier.supplierId)));
        });

        itemSupplierGuide.textContent = `등록 가능한 공급업체 ${supplierSearchResults.length.toLocaleString('ko-KR')}건을 조회했습니다.`;
    }

    supplierSelect.replaceChildren(...options);
    supplierSelect.disabled = supplierSearchResults.length === 0;
    addSupplierButton.disabled = true;
}


// 공급업체 검색 입력창에서 Enter를 누르면 조회 버튼과 동일하게 검색한다.
async function handleSupplierKeywordKeydown(event) {

    if (event.key !== 'Enter') {
        return;
    }

    event.preventDefault();

    await searchAvailableSuppliers();
}


// 등록 대상 공급업체 선택 여부에 맞춰 관계 등록 버튼을 활성화한다.
function handleSupplierSelectionChange() {

    addSupplierButton.disabled = supplierSelect.value === '';
}


// 선택한 사용 중 공급업체를 현재 품목의 취급 공급업체로 등록한다.
async function addItemSupplier() {

    if (!canManageItemSuppliers || !selectedItem || itemFormMode !== 'edit' || supplierSelect.value === '') {
        return;
    }

    const itemId = selectedItem.itemId;
    const supplierId = Number(supplierSelect.value);
    const detailWasOpen = mobileDetailOpen;

    clearItemSupplierError();
    setSupplierManagementLoading(true);

    try {

        await api.post(`/items/${itemId}/suppliers`, { supplierId });

        // 등록 결과와 취급 공급업체 목록을 Server의 최신 품목 상세정보로 다시 표시한다.
        await selectItem(itemId, detailWasOpen);
        itemSupplierGuide.textContent = '취급 공급업체가 등록되었습니다.';

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        showItemSupplierError(getApiErrorMessage(error));

    } finally {
        setSupplierManagementLoading(false);
    }
}


// 공급업체 검색·등록 요청 중 Control의 중복 실행을 막고 완료 후 현재 상태에 맞게 복원한다.
function setSupplierManagementLoading(loading) {

    const canUseControls = canManageItemSuppliers && itemFormMode === 'edit' && selectedItem !== null;

    supplierKeyword.disabled = loading || !canUseControls;
    searchSupplierButton.disabled = loading || !canUseControls;
    supplierSelect.disabled = loading || !canUseControls || supplierSearchResults.length === 0;
    addSupplierButton.disabled = loading || !canUseControls || supplierSelect.value === '';
}


// 취급 공급업체 검색·등록 오류를 관계 관리 영역에 표시한다.
function showItemSupplierError(message) {

    itemSupplierError.textContent = message;
    itemSupplierError.hidden = false;
}


// 취급 공급업체 관계 관리 영역의 오류 메시지를 지운다.
function clearItemSupplierError() {

    itemSupplierError.textContent = '';
    itemSupplierError.hidden = true;
}


// ========== 취급 공급업체 관계 해제 ==========

// 선택한 취급 공급업체와 현재 품목 정보를 관계 해제 확인 Modal에 표시한다.
function openSupplierRemoveModal(supplierId) {

    if (!canManageItemSuppliers || !selectedItem || itemFormMode !== 'edit') {
        return;
    }

    const supplier = (selectedItem.suppliers ?? []).find(
        currentSupplier => currentSupplier.supplierId === supplierId
    );

    // 상세정보에 없는 공급업체 식별자로는 관계 해제 요청을 시작하지 않는다.
    if (!supplier) {
        showItemSupplierError('해제할 취급 공급업체 정보를 확인할 수 없습니다.');
        return;
    }

    removeModalItemId = selectedItem.itemId;
    removeModalSupplierId = supplier.supplierId;

    removeTargetItem.textContent = `${selectedItem.itemName} (${selectedItem.itemCode})`;
    removeTargetSupplier.textContent = `${supplier.supplierName} (${supplier.supplierCode})`;

    clearSupplierRemoveModalError();

    supplierRemoveModalBackdrop.hidden = false;
    confirmSupplierRemoveButton.focus();
}


// 관계 해제 Modal을 닫고 현재 해제 대상 식별자를 초기화한다.
function closeSupplierRemoveModal() {

    supplierRemoveModalBackdrop.hidden = true;
    removeModalItemId = null;
    removeModalSupplierId = null;

    clearSupplierRemoveModalError();
}


// 관계 해제 Form 제출 시 선택한 품목과 공급업체의 관계 해제 요청을 실행한다.
async function handleSupplierRemoveSubmit(event) {

    event.preventDefault();

    await removeItemSupplier();
}


// 선택한 품목과 공급업체의 SUPPLIER_ITEM 관계만 해제하고 최신 상세정보를 다시 조회한다.
async function removeItemSupplier() {

    if (!canManageItemSuppliers || !removeModalItemId || !removeModalSupplierId) {
        return;
    }

    const itemId = removeModalItemId;
    const supplierId = removeModalSupplierId;
    const detailWasOpen = mobileDetailOpen;

    setSupplierRemoveModalLoading(true);

    try {

        await api.delete(`/items/${itemId}/suppliers/${supplierId}`);

        closeSupplierRemoveModal();

        // 관계 해제 결과와 남은 취급 공급업체 목록을 Server의 최신 상세정보로 다시 표시한다.
        await selectItem(itemId, detailWasOpen);
        itemSupplierGuide.textContent = '취급 공급업체 관계가 해제되었습니다.';

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        // 관계 없음·권한 오류 등 Server 업무 오류는 Modal을 유지한 채 표시한다.
        showSupplierRemoveModalError(getApiErrorMessage(error));

    } finally {
        setSupplierRemoveModalLoading(false);
    }
}


// 관계 해제 요청 중 중복 실행과 Modal 닫기 동작을 막는다.
function setSupplierRemoveModalLoading(loading) {

    confirmSupplierRemoveButton.disabled = loading;
    cancelSupplierRemoveButton.disabled = loading;
    closeSupplierRemoveModalButton.disabled = loading;
}


// 관계 해제 Modal에 Server 오류 메시지를 표시한다.
function showSupplierRemoveModalError(message) {

    supplierRemoveModalError.textContent = message;
    supplierRemoveModalError.hidden = false;
}


// 관계 해제 Modal의 오류 메시지를 지운다.
function clearSupplierRemoveModalError() {

    supplierRemoveModalError.textContent = '';
    supplierRemoveModalError.hidden = true;
}


// 목록과 Mobile Card에서 현재 선택된 품목을 강조 표시한다.
function renderSelectedItem() {

    document.querySelectorAll('[data-item-id]').forEach(element => {
        const itemId = Number(element.dataset.itemId);
        const selectedItemId = selectedItem?.itemId;

        element.classList.toggle('is-selected', itemId === selectedItemId);
    });
}


// 선택된 품목이 없을 때 상세정보 안내 화면을 표시한다.
function showItemDetailEmpty() {

    selectedItem = null;
    itemFormMode = null;

    itemDetailMode.textContent = '선택한 품목 정보를 확인하거나 수정할 수 있습니다.';
    itemDetailTitle.textContent = '품목 정보';
    itemDetailForm.hidden = true;
    itemDetailEmpty.hidden = false;

    renderSelectedItem();
}


// 품목 상세 조회 중 처리 버튼의 중복 실행을 방지한다.
function setItemDetailLoading(loading) {

    newItemButton.disabled = loading;
    itemSaveButton.disabled = loading;
    itemStatusButton.disabled = loading;
}


// 품목 상세 Form 오류를 지운다.
function clearItemFormError() {

    itemFormError.textContent = '';
    itemFormError.hidden = true;
}


// 품목 상세 Form 오류를 표시한다.
function showItemFormError(message) {

    itemFormError.textContent = message;
    itemFormError.hidden = false;
}


// ========== 품목 신규 등록 ==========

// 신규 등록 버튼을 누르면 상세 Form을 빈 등록 상태로 전환한다.
function enterItemCreateMode() {

    if (!canEditItem) {
        return;
    }

    clearPageError();
    clearItemFormError();

    selectedItem = null;
    itemFormMode = 'create';
    mobileDetailOpen = true;

    clearItemFormFields();

    itemDetailMode.textContent = '신규 품목의 기본정보를 입력해 주세요.';
    itemDetailTitle.textContent = '품목 등록';

    // 신규 품목 코드는 Server에서 자동 생성하고 사용 상태는 ACTIVE로 설정한다.
    itemCodeValue.value = '';
    setMasterStatusBadge(itemStatusBadge, 'ACTIVE');

    itemDetailEmpty.hidden = true;
    itemDetailForm.hidden = false;

    // 등록 전에는 상태 변경과 취급 공급업체 관계 관리를 할 수 없다.
    itemStatusButton.hidden = true;
    itemSupplierControls.hidden = true;
    resetSupplierManagementControls();

    itemSaveButton.hidden = false;
    itemSaveButton.textContent = '품목 등록';

    setItemFormReadOnly(false);
    renderItemSuppliers();
    renderSelectedItem();
    syncDetailVisibility();

    itemName.focus();
}


// 신규 등록 Form의 기존 입력값과 기타 단위 표시 상태를 초기화한다.
function clearItemFormFields() {

    itemName.value = '';
    itemUnit.value = '';
    otherUnitName.value = '';
    defaultSalesPrice.value = '';
    itemMemo.value = '';

    renderOtherUnitNameField('', '');
}


// Form의 현재 모드에 따라 신규 등록 또는 기존 품목 수정 처리를 분기한다.
async function handleItemSubmit(event) {

    event.preventDefault();

    if (!canEditItem || (itemFormMode !== 'create' && itemFormMode !== 'edit')) {
        return;
    }

    if (itemFormMode === 'edit' && !selectedItem) {
        return;
    }

    clearPageError();
    clearItemFormError();

    if (!validateItemForm()) {
        return;
    }

    setItemFormLoading(true);

    const itemId = selectedItem?.itemId;
    const detailWasOpen = mobileDetailOpen;

    try {

        if (itemFormMode === 'create') {
            await createItem();
            return;
        }

        await updateItem(itemId, detailWasOpen);

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        // 오래된 version이면 최신 목록·상세정보를 다시 조회하여 다음 수정에 사용할 version도 갱신한다.
        if (itemFormMode === 'edit' && isItemVersionConflict(error)) {
            await handleItemVersionConflict(error, itemId, detailWasOpen);
            return;
        }

        showItemFormError(getApiErrorMessage(error));

    } finally {
        setItemFormLoading(false);
    }
}


// 품목명·단위·기타 단위명·기본 판매가격의 필수값과 형식을 검증한다.
function validateItemForm() {

    if (itemName.value.trim() === '') {
        showItemFormError('품목명을 입력해 주세요.');
        itemName.focus();
        return false;
    }

    if (itemUnit.value === '') {
        showItemFormError('품목 단위를 선택해 주세요.');
        itemUnit.focus();
        return false;
    }

    if (itemUnit.value === 'OTHER' && otherUnitName.value.trim() === '') {
        showItemFormError('OTHER 단위의 기타 단위명을 입력해 주세요.');
        otherUnitName.focus();
        return false;
    }

    const priceValue = defaultSalesPrice.value.trim();
    const price = Number(priceValue);

    if (priceValue === '' || !Number.isFinite(price) || price < 0) {
        showItemFormError('기본 판매가격은 0 이상의 숫자로 입력해 주세요.');
        defaultSalesPrice.focus();
        return false;
    }

    const fractionDigits = priceValue.includes('.') ? priceValue.split('.')[1].length : 0;

    if (fractionDigits > 2) {
        showItemFormError('기본 판매가격은 소수점 둘째 자리까지 입력할 수 있습니다.');
        defaultSalesPrice.focus();
        return false;
    }

    return true;
}


// 품목 등록 API에 전달할 요청 데이터를 생성한다.
function createItemRequestBody() {

    return {
        itemName: itemName.value.trim(),
        unit: itemUnit.value,
        otherUnitName: itemUnit.value === 'OTHER' ? otherUnitName.value.trim() : null,
        defaultSalesPrice: Number(defaultSalesPrice.value),
        memo: normalizeOptionalValue(itemMemo.value)
    };
}


// 선택 입력값의 앞뒤 공백을 제거하고 빈 문자열은 null로 변환한다.
function normalizeOptionalValue(value) {

    const normalizedValue = value.trim();

    return normalizedValue === '' ? null : normalizedValue;
}


// 신규 품목을 등록하고 생성된 품목을 목록과 상세정보에서 다시 선택한다.
async function createItem() {

    const response = await api.post('/items', createItemRequestBody());
    const createdItem = response.data;

    // 신규 품목이 첫 페이지에 표시되도록 기존 검색 조건을 초기화한다.
    keywordFilter.value = '';
    statusFilter.value = '';
    supplierFilter.value = '';

    await loadItems(0);
    await selectItem(createdItem.itemId);
}


// ========== 품목 수정 ==========

// 선택한 품목의 기본정보와 기본 판매가격 수정 요청 데이터를 생성한다.
function createItemUpdateRequestBody() {

    return {
        ...createItemRequestBody(),
        version: selectedItem.version
    };
}


// 선택한 품목을 수정하고 현재 목록과 상세정보를 최신 데이터로 다시 조회한다.
async function updateItem(itemId, openMobilePanel) {

    const response = await api.patch(`/items/${itemId}`, createItemUpdateRequestBody());
    const updatedItem = response.data;

    // 수정된 품목이 현재 검색 조건에 계속 포함되는지 확인한 뒤 다시 선택한다.
    await reloadCurrentItemPageAndSelect(updatedItem.itemId, openMobilePanel);
}


// 현재 품목 목록 페이지를 다시 조회하고 대상 품목이 남아 있으면 상세정보를 다시 선택한다.
async function reloadCurrentItemPageAndSelect(itemId, openMobilePanel) {

    const currentPage = itemPageMeta?.page ?? 0;

    await loadItems(currentPage);

    const itemStillVisible = items.some(item => item.itemId === itemId);

    // 수정된 품목명이 검색 조건에서 제외되면 현재 화면 크기의 기본 상세 상태로 돌아간다.
    if (!itemStillVisible) {
        await applyDefaultItemDetailState();
        return false;
    }

    await selectItem(itemId, openMobilePanel);

    return true;
}


// version 충돌 메시지를 보존하면서 품목 목록과 상세정보를 최신 상태로 갱신한다.
async function handleItemVersionConflict(error, itemId, openMobilePanel) {

    const message = getApiErrorMessage(error);

    try {

        const itemStillVisible = await reloadCurrentItemPageAndSelect(itemId, openMobilePanel);

        if (itemStillVisible) {
            showItemFormError(message);
            return;
        }

        showPageError(message);

    } catch (reloadError) {
        handlePageError(reloadError, '최신 품목 정보를 다시 조회하지 못했습니다.');
    }
}


// 서버의 409 응답이 실제 version 동시성 충돌인지 메시지를 기준으로 구분한다.
function isItemVersionConflict(error) {

    if (error?.status !== 409) {
        return false;
    }

    return getApiErrorMessage(error).includes('다른 사용자가 먼저 수정했습니다.');
}


// ========== 품목 사용 상태 변경 ==========

// 선택한 품목의 현재 사용 상태를 기준으로 반대 상태 변경 확인 Modal을 연다.
function openItemStatusModal() {

    if (!canChangeItemStatus || !selectedItem || itemFormMode !== 'edit') {
        return;
    }

    const nextStatus = selectedItem.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    statusModalItemId = selectedItem.itemId;
    statusModalNextValue = nextStatus;
    statusModalVersion = selectedItem.version;

    statusTargetItem.textContent = `${selectedItem.itemName} (${selectedItem.itemCode})`;
    currentStatusValue.textContent = getMasterStatusLabel(selectedItem.status);
    nextStatusValue.textContent = getMasterStatusLabel(nextStatus);

    clearStatusModalError();

    statusModalBackdrop.hidden = false;
    confirmStatusButton.focus();
}


// 사용 상태 변경 Modal을 닫고 현재 요청 정보를 초기화한다.
function closeStatusModal() {

    statusModalBackdrop.hidden = true;
    statusModalItemId = null;
    statusModalNextValue = null;
    statusModalVersion = null;

    clearStatusModalError();
}


// 사용 상태 변경 Form 제출 시 선택한 품목의 상태 변경 요청을 실행한다.
async function handleStatusChangeSubmit(event) {

    event.preventDefault();

    await changeItemStatus();
}


// 선택한 품목의 ACTIVE·INACTIVE 사용 상태를 변경한다.
async function changeItemStatus() {

    if (!canChangeItemStatus || !statusModalItemId || !statusModalNextValue) {
        return;
    }

    const itemId = statusModalItemId;
    const nextStatus = statusModalNextValue;
    const version = statusModalVersion;
    const detailWasOpen = mobileDetailOpen;

    setStatusModalLoading(true);

    try {

        await api.post(`/items/${itemId}/status`, {
            status: nextStatus,
            version
        });

        closeStatusModal();

        // 사용 상태 Filter에서 제외될 수 있으므로 현재 목록 페이지와 상세정보를 다시 조회한다.
        await reloadCurrentItemPageAndSelect(itemId, detailWasOpen);

    } catch (error) {

        if (handleUnauthorized(error)) {
            return;
        }

        // version 충돌일 때는 Modal을 닫고 최신 품목 정보로 교체한다.
        if (isItemVersionConflict(error)) {

            closeStatusModal();
            await handleItemVersionConflict(error, itemId, detailWasOpen);

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


// 품목 등록·수정 요청 중 Form과 신규 등록 버튼의 중복 실행을 방지한다.
function setItemFormLoading(loading) {

    newItemButton.disabled = loading;
    itemSaveButton.disabled = loading;
}


// 단위 변경 시 OTHER 기타 단위명 입력 영역을 즉시 표시하거나 숨긴다.
function handleItemUnitChange() {

    renderOtherUnitNameField(itemUnit.value, otherUnitName.value);
}


// ========== 품목 목록 Pagination ==========

// 서버의 페이지 정보를 기준으로 품목 목록 페이지 버튼을 출력한다.
function renderItemPagination() {

    itemPagination.innerHTML = '';

    if (!itemPageMeta || itemPageMeta.totalPages <= 1) {
        return;
    }

    const currentPage = itemPageMeta.page;
    const totalPages = itemPageMeta.totalPages;
    const firstVisiblePage = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
    const lastVisiblePage = Math.min(totalPages, firstVisiblePage + 5);

    itemPagination.append(createItemPageButton('‹', currentPage - 1, currentPage === 0));

    for (let page = firstVisiblePage; page < lastVisiblePage; page += 1) {
        const button = createItemPageButton(String(page + 1), page, false);

        if (page === currentPage) {
            button.classList.add('is-active');
            button.setAttribute('aria-current', 'page');
        }

        itemPagination.append(button);
    }

    itemPagination.append(createItemPageButton('›', currentPage + 1, currentPage >= totalPages - 1));
}


// 품목 목록의 지정된 페이지로 이동하는 버튼을 만든다.
function createItemPageButton(label, page, disabled) {

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'page-button';
    button.textContent = label;
    button.disabled = disabled;

    button.addEventListener('click', async () => {
        clearPageError();

        try {
            await loadItems(page);
            await applyDefaultItemDetailState();
        } catch (error) {
            handlePageError(error, '품목 목록을 불러오지 못했습니다.');
        }
    });

    return button;
}


// ========== 품목 검색 조건 ==========

// 현재 검색 조건으로 품목 목록 첫 페이지를 조회한다.
async function applyItemFilters() {

    clearPageError();

    try {
        await loadItems(0);
        await applyDefaultItemDetailState();
    } catch (error) {
        handlePageError(error, '품목 목록을 불러오지 못했습니다.');
    }
}


// 검색 조건을 초기화하고 품목 목록 첫 페이지를 다시 조회한다.
async function resetItemFilters() {

    keywordFilter.value = '';
    statusFilter.value = '';
    supplierFilter.value = '';

    await applyItemFilters();
}


// 검색어 입력창에서 Enter를 누르면 검색 버튼과 동일하게 처리한다.
async function handleKeywordKeydown(event) {

    if (event.key !== 'Enter') {
        return;
    }

    event.preventDefault();

    await applyItemFilters();
}


// 품목 목록 조회 중 검색과 페이지 버튼의 중복 실행을 방지한다.
function setItemListLoading(loading) {

    searchButton.disabled = loading;
    resetFilterButton.disabled = loading;

    itemPagination.querySelectorAll('button').forEach(button => {
        button.disabled = loading;
    });
}


// ========== Mobile 상세 Panel ==========

// 현재 화면이 Mobile Grid 기준인지 확인한다.
function isMobile() {
    return window.matchMedia('(max-width: 375px)').matches;
}


// 화면 크기와 Mobile Panel 상태에 따라 품목 상세 영역 표시 여부를 적용한다.
function syncDetailVisibility() {

    if (!isMobile()) {
        itemDetailSection.hidden = false;
        return;
    }

    itemDetailSection.hidden = !mobileDetailOpen;
}


// Mobile 품목 상세 Panel을 닫는다.
function closeMobileDetailPanel() {

    mobileDetailOpen = false;

    syncDetailVisibility();
}


// ========== 공통 오류 처리 ==========

// 품목 관리 화면 전체 오류를 표시한다.
function showPageError(message) {

    itemPageError.textContent = message;
    itemPageError.hidden = false;
}


// 품목 관리 화면 전체 오류를 지운다.
function clearPageError() {

    itemPageError.textContent = '';
    itemPageError.hidden = true;
}


// Session이 만료되어 401이 반환되면 로그인 화면으로 이동한다.
function handleUnauthorized(error) {

    if (error?.status !== 401) {
        return false;
    }

    window.location.replace('./login.html');

    return true;
}


// 품목 관리 화면에서 발생한 인증 또는 초기화 오류를 처리한다.
function handlePageError(error, fallbackMessage) {

    if (handleUnauthorized(error)) {
        return;
    }

    showPageError(error ? getApiErrorMessage(error) : fallbackMessage);
}


// ========== Event 연결 ==========

// 품목 검색과 검색 조건 초기화
searchButton.addEventListener('click', applyItemFilters);
resetFilterButton.addEventListener('click', resetItemFilters);
keywordFilter.addEventListener('keydown', handleKeywordKeydown);

// 신규 품목 등록과 단위별 입력 영역 변경
newItemButton.addEventListener('click', enterItemCreateMode);
itemDetailForm.addEventListener('submit', handleItemSubmit);
itemUnit.addEventListener('change', handleItemUnitChange);

// 취급 공급업체 검색과 관계 등록
searchSupplierButton.addEventListener('click', searchAvailableSuppliers);
supplierKeyword.addEventListener('keydown', handleSupplierKeywordKeydown);
supplierSelect.addEventListener('change', handleSupplierSelectionChange);
addSupplierButton.addEventListener('click', addItemSupplier);

// 품목 사용 상태 변경 Modal
itemStatusButton.addEventListener('click', openItemStatusModal);
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

// 취급 공급업체 관계 해제 Modal
supplierRemoveForm.addEventListener('submit', handleSupplierRemoveSubmit);
closeSupplierRemoveModalButton.addEventListener('click', closeSupplierRemoveModal);
cancelSupplierRemoveButton.addEventListener('click', closeSupplierRemoveModal);

// Modal 바깥 영역을 누르면 관계 해제 요청 중이 아닐 때만 닫는다.
supplierRemoveModalBackdrop.addEventListener('click', event => {

    if (event.target === supplierRemoveModalBackdrop && !confirmSupplierRemoveButton.disabled) {
        closeSupplierRemoveModal();
    }
});

// 관계 해제 Modal이 열린 상태에서 Escape를 누르면 요청 중이 아닐 때만 닫는다.
document.addEventListener('keydown', event => {

    if (event.key === 'Escape'
        && !supplierRemoveModalBackdrop.hidden
        && !confirmSupplierRemoveButton.disabled) {
        closeSupplierRemoveModal();
    }
});

// Mobile 품목 상세 Panel을 닫는다.
closeDetailButton.addEventListener('click', closeMobileDetailPanel);

// 화면 크기 변경 시 Mobile 상세 Panel 표시 상태를 다시 적용한다.
window.addEventListener('resize', syncDetailVisibility);

// 품목 관리 화면 초기화를 시작한다.
initialize();
