// ********** 발주 관리 화면의 목록·상세·작성·상태 처리·이메일 이력과 역할별 UI를 담당 **********

import { api, getApiErrorMessage } from './api.js';
import { hasRole } from './auth.js';
import { initializeCommonLayout } from './common-layout.js';


// 기준정보 Select에서 한 번에 요청할 최대 데이터 수
const REFERENCE_PAGE_SIZE = 2000;


// 현재 로그인 사용자의 발주 처리 권한
let canManagePurchaseOrder = false;
let canApprovePurchaseOrder = false;
let canViewOfficeInformation = false;


// 검색 조건과 등록 Form에서 사용하는 공급업체 기준정보
let suppliers = [];
let activeSuppliers = [];
let availableSupplierItems = [];


// 현재 조회된 발주 목록과 선택 상세정보
let purchaseOrders = [];
let purchaseOrderPageMeta = null;
let selectedPurchaseOrder = null;
let purchaseOrderFormMode = 'empty';
let purchaseOrderItemRows = [];


// 선택 발주의 이메일 전송 이력과 현재 페이지 정보
let emailHistory = [];
let emailHistoryPageMeta = null;


// Mobile 상세 Panel과 공통 처리 Modal 상태
let mobileDetailOpen = false;
let pendingAction = null;


// ========== 공통 화면 Element ==========

const purchaseOrderPageError = document.querySelector('#purchaseOrderPageError');
const statusFilter = document.querySelector('#statusFilter');
const emailStatusFilter = document.querySelector('#emailStatusFilter');
const supplierFilter = document.querySelector('#supplierFilter');
const startDateFilter = document.querySelector('#startDateFilter');
const endDateFilter = document.querySelector('#endDateFilter');
const searchButton = document.querySelector('#searchButton');
const resetFilterButton = document.querySelector('#resetFilterButton');
const newPurchaseOrderButton = document.querySelector('#newPurchaseOrderButton');
const purchaseOrderCount = document.querySelector('#purchaseOrderCount');
const purchaseOrderTableBody = document.querySelector('#purchaseOrderTableBody');
const purchaseOrderMobileList = document.querySelector('#purchaseOrderMobileList');
const purchaseOrderPagination = document.querySelector('#purchaseOrderPagination');


// ========== 발주 상세·입력 Element ==========

const purchaseOrderDetailSection = document.querySelector('#purchaseOrderDetailSection');
const purchaseOrderDetailTitle = document.querySelector('#purchaseOrderDetailTitle');
const purchaseOrderDetailMode = document.querySelector('#purchaseOrderDetailMode');
const closeDetailButton = document.querySelector('#closeDetailButton');
const purchaseOrderDetailEmpty = document.querySelector('#purchaseOrderDetailEmpty');
const purchaseOrderDetailForm = document.querySelector('#purchaseOrderDetailForm');
const purchaseOrderStatusBadge = document.querySelector('#purchaseOrderStatusBadge');
const purchaseOrderEmailBadge = document.querySelector('#purchaseOrderEmailBadge');
const purchaseOrderIdValue = document.querySelector('#purchaseOrderIdValue');
const totalOrderedQuantityValue = document.querySelector('#totalOrderedQuantityValue');
const totalReceivedQuantityValue = document.querySelector('#totalReceivedQuantityValue');
const totalRemainingQuantityValue = document.querySelector('#totalRemainingQuantityValue');
const totalAmountValue = document.querySelector('#totalAmountValue');
const supplierEmailValue = document.querySelector('#supplierEmailValue');
const purchaseOrderUpdatedAtValue = document.querySelector('#purchaseOrderUpdatedAtValue');
const purchaseOrderSupplier = document.querySelector('#purchaseOrderSupplier');
const purchaseOrderMemo = document.querySelector('#purchaseOrderMemo');
const addPurchaseOrderItemButton = document.querySelector('#addPurchaseOrderItemButton');
const purchaseOrderItemTableBody = document.querySelector('#purchaseOrderItemTableBody');
const purchaseOrderFormNotice = document.querySelector('#purchaseOrderFormNotice');
const purchaseOrderFormError = document.querySelector('#purchaseOrderFormError');


// ========== 발주 처리 이력·이메일 이력 Element ==========

const createdActionValue = document.querySelector('#createdActionValue');
const submittedActionValue = document.querySelector('#submittedActionValue');
const approvedActionValue = document.querySelector('#approvedActionValue');
const orderedActionValue = document.querySelector('#orderedActionValue');
const supplierCancelConfirmedActionValue = document.querySelector('#supplierCancelConfirmedActionValue');
const canceledActionValue = document.querySelector('#canceledActionValue');
const cancelReasonValue = document.querySelector('#cancelReasonValue');
const closedActionValue = document.querySelector('#closedActionValue');
const closeReasonValue = document.querySelector('#closeReasonValue');
const emailHistoryCount = document.querySelector('#emailHistoryCount');
const emailHistoryTableBody = document.querySelector('#emailHistoryTableBody');
const emailHistoryMobileList = document.querySelector('#emailHistoryMobileList');
const emailHistoryPagination = document.querySelector('#emailHistoryPagination');


// ========== 발주 상세 처리 Button ==========

const deletePurchaseOrderButton = document.querySelector('#deletePurchaseOrderButton');
const cancelPurchaseOrderButton = document.querySelector('#cancelPurchaseOrderButton');
const resendEmailButton = document.querySelector('#resendEmailButton');
const submitPurchaseOrderButton = document.querySelector('#submitPurchaseOrderButton');
const approvePurchaseOrderButton = document.querySelector('#approvePurchaseOrderButton');
const orderPurchaseOrderButton = document.querySelector('#orderPurchaseOrderButton');
const savePurchaseOrderButton = document.querySelector('#savePurchaseOrderButton');


// ========== 공통 발주 처리 확인 Modal Element ==========

const actionModalBackdrop = document.querySelector('#actionModalBackdrop');
const actionModalForm = document.querySelector('#actionModalForm');
const actionModalTitle = document.querySelector('#actionModalTitle');
const actionModalTarget = document.querySelector('#actionModalTarget');
const actionModalCurrentValue = document.querySelector('#actionModalCurrentValue');
const actionModalNextValue = document.querySelector('#actionModalNextValue');
const actionModalDescription = document.querySelector('#actionModalDescription');
const actionModalError = document.querySelector('#actionModalError');
const closeActionModalButton = document.querySelector('#closeActionModalButton');
const cancelActionModalButton = document.querySelector('#cancelActionModalButton');
const confirmActionButton = document.querySelector('#confirmActionButton');


// ========== 발주 취소 Modal Element ==========

const cancelModalBackdrop = document.querySelector('#cancelModalBackdrop');
const cancelModalForm = document.querySelector('#cancelModalForm');
const cancelModalTarget = document.querySelector('#cancelModalTarget');
const cancelModalCurrentValue = document.querySelector('#cancelModalCurrentValue');
const cancelReason = document.querySelector('#cancelReason');
const cancelReasonLength = document.querySelector('#cancelReasonLength');
const supplierCancelConfirmedField = document.querySelector('#supplierCancelConfirmedField');
const supplierCancelConfirmed = document.querySelector('#supplierCancelConfirmed');
const cancelModalGuide = document.querySelector('#cancelModalGuide');
const cancelModalError = document.querySelector('#cancelModalError');
const closeCancelModalButton = document.querySelector('#closeCancelModalButton');
const cancelCancelModalButton = document.querySelector('#cancelCancelModalButton');
const confirmCancelButton = document.querySelector('#confirmCancelButton');


// ========== 화면 초기화 ==========

// 공통 Layout과 역할별 화면을 초기화한 뒤 기준정보와 발주 목록을 조회한다.
async function initialize() {

    try {
        const currentUser = await initializeCommonLayout({
            pageTitle: '발주 관리',
            activeMenu: 'purchaseOrders',
            onError: showPageError
        });

        if (!currentUser) {
            return;
        }

        applyRoleAccess();
        await loadSupplierOptions();
        await loadPurchaseOrders(0);
        await applyDefaultPurchaseOrderDetailState();

    } catch (error) {
        handlePageError(error, '발주 관리 화면을 초기화하지 못했습니다.');
    }
}


// 로그인 역할에 따라 작성·승인·금액·이메일 정보 표시 범위를 적용한다.
function applyRoleAccess() {

    canManagePurchaseOrder = hasRole('ADMIN', 'OFFICE');
    canApprovePurchaseOrder = hasRole('ADMIN');
    canViewOfficeInformation = hasRole('ADMIN', 'OFFICE');

    newPurchaseOrderButton.hidden = !canManagePurchaseOrder;

    document.querySelectorAll('[data-office-information]').forEach(element => {
        element.hidden = !canViewOfficeInformation;
    });
}


// ========== 공급업체·품목 기준정보 ==========

// 발주 검색과 등록에 사용할 전체 공급업체를 마지막 페이지까지 조회한다.
async function loadSupplierOptions() {

    const loadedSuppliers = [];
    let page = 0;
    let totalPages = 1;

    do {
        const response = await api.get(`/suppliers?page=${page}&size=${REFERENCE_PAGE_SIZE}`);

        loadedSuppliers.push(...(response.data ?? []));
        totalPages = response.meta?.totalPages ?? 1;
        page += 1;
    } while (page < totalPages);

    suppliers = loadedSuppliers;
    activeSuppliers = suppliers.filter(supplier => supplier.status === 'ACTIVE');

    renderSupplierFilterOptions();
    renderPurchaseOrderSupplierOptions();
}


// 검색 조건에는 사용 상태와 관계없이 저장된 전체 공급업체를 표시한다.
function renderSupplierFilterOptions() {

    const selectedValue = supplierFilter.value;

    supplierFilter.innerHTML = '<option value="">전체</option>';

    suppliers.forEach(supplier => {
        const option = document.createElement('option');

        option.value = String(supplier.supplierId);
        option.textContent = `${supplier.supplierCode} · ${supplier.supplierName}`;

        supplierFilter.append(option);
    });

    supplierFilter.value = selectedValue;
}


// 신규·수정 Form에는 ACTIVE 공급업체만 선택할 수 있도록 표시한다.
function renderPurchaseOrderSupplierOptions(selectedSupplierId = null) {

    purchaseOrderSupplier.innerHTML = '<option value="">공급업체 선택</option>';

    activeSuppliers.forEach(supplier => {
        const option = document.createElement('option');

        option.value = String(supplier.supplierId);
        option.textContent = `${supplier.supplierCode} · ${supplier.supplierName}`;

        purchaseOrderSupplier.append(option);
    });

    if (selectedSupplierId !== null) {
        ensureSupplierOption(selectedSupplierId);
        purchaseOrderSupplier.value = String(selectedSupplierId);
    }
}


// 기존 발주 공급업체가 현재 기준정보 목록에서 제외되어도 상세 표시를 유지한다.
function ensureSupplierOption(supplierId) {

    const optionExists = Array.from(purchaseOrderSupplier.options)
        .some(option => option.value === String(supplierId));

    if (optionExists || !selectedPurchaseOrder) {
        return;
    }

    const option = document.createElement('option');

    option.value = String(supplierId);
    option.textContent = `${selectedPurchaseOrder.supplierCode} · ${selectedPurchaseOrder.supplierName}`;

    purchaseOrderSupplier.append(option);
}


// 선택 공급업체가 취급하는 ACTIVE 품목을 마지막 페이지까지 조회한다.
async function loadAvailableSupplierItems(supplierId) {

    availableSupplierItems = [];

    if (!supplierId) {
        return;
    }

    let page = 0;
    let totalPages = 1;

    do {
        const response = await api.get(`/items?status=ACTIVE&supplierId=${supplierId}&page=${page}&size=${REFERENCE_PAGE_SIZE}`);

        availableSupplierItems.push(...(response.data ?? []));
        totalPages = response.meta?.totalPages ?? 1;
        page += 1;
    } while (page < totalPages);
}


// ========== 발주 목록 조회 ==========

// 현재 검색 조건을 발주 목록 API 요청 경로로 변환한다.
function createPurchaseOrderListPath(page) {

    const parameters = new URLSearchParams({ page: String(page) });

    if (statusFilter.value) parameters.set('status', statusFilter.value);
    if (emailStatusFilter.value) parameters.set('emailStatus', emailStatusFilter.value);
    if (supplierFilter.value) parameters.set('supplierId', supplierFilter.value);
    if (startDateFilter.value) parameters.set('startDate', startDateFilter.value);
    if (endDateFilter.value) parameters.set('endDate', endDateFilter.value);

    return `/purchase-orders?${parameters.toString()}`;
}


// 지정한 페이지의 발주 목록을 조회하고 PC·Mobile 목록과 페이지 정보를 갱신한다.
async function loadPurchaseOrders(page) {

    setPurchaseOrderListLoading(true);

    try {
        const response = await api.get(createPurchaseOrderListPath(page));

        purchaseOrders = response.data ?? [];
        purchaseOrderPageMeta = response.meta;

        renderPurchaseOrderCount();
        renderPurchaseOrderTable();
        renderPurchaseOrderMobileList();
        renderPurchaseOrderPagination();
        renderSelectedPurchaseOrder();

    } finally {
        setPurchaseOrderListLoading(false);
    }
}


// 검색 결과 전체 발주 건수를 표시한다.
function renderPurchaseOrderCount() {
    purchaseOrderCount.textContent = `총 ${purchaseOrderPageMeta?.totalElements ?? 0}건`;
}


// PC·Tablet 발주 목록을 Table로 출력한다.
function renderPurchaseOrderTable() {

    purchaseOrderTableBody.innerHTML = '';

    if (purchaseOrders.length === 0) {
        purchaseOrderTableBody.innerHTML = `<tr><td colspan="${getPurchaseOrderColumnCount()}" class="purchase-order-empty-cell">조회된 발주가 없습니다.</td></tr>`;
        return;
    }

    purchaseOrders.forEach(purchaseOrder => {
        const row = document.createElement('tr');

        row.dataset.purchaseOrderId = String(purchaseOrder.purchaseOrderId);
        row.innerHTML = `
            <td><span class="purchase-order-number">${escapeHtml(formatPurchaseOrderNumber(purchaseOrder.purchaseOrderId))}</span></td>
            <td><span class="purchase-order-supplier-name">${escapeHtml(purchaseOrder.supplierName)}</span><span class="purchase-order-supplier-code">${escapeHtml(purchaseOrder.supplierCode)}</span></td>
            <td>${createPurchaseOrderStatusBadge(purchaseOrder.status)}</td>
            ${canViewOfficeInformation ? `<td>${createEmailStatusBadge(purchaseOrder.emailStatus)}</td>` : ''}
            <td class="purchase-order-quantity">${formatQuantity(purchaseOrder.totalOrderedQuantity)}</td>
            <td class="purchase-order-quantity">${formatQuantity(purchaseOrder.totalReceivedQuantity)}</td>
            <td class="purchase-order-quantity">${formatQuantity(purchaseOrder.totalRemainingQuantity)}</td>
            ${canViewOfficeInformation ? `<td class="purchase-order-amount">${formatCurrency(purchaseOrder.totalAmount)}</td>` : ''}
            <td>${formatDateTime(purchaseOrder.createdAt)}</td>
        `;

        row.addEventListener('click', () => selectPurchaseOrder(purchaseOrder.purchaseOrderId));
        purchaseOrderTableBody.append(row);
    });
}


// Mobile 발주 목록을 Card 형태로 출력한다.
function renderPurchaseOrderMobileList() {

    purchaseOrderMobileList.innerHTML = '';

    if (purchaseOrders.length === 0) {
        purchaseOrderMobileList.innerHTML = '<p class="purchase-order-mobile-empty">조회된 발주가 없습니다.</p>';
        return;
    }

    purchaseOrders.forEach(purchaseOrder => {
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'purchase-order-mobile-item';
        button.dataset.purchaseOrderId = String(purchaseOrder.purchaseOrderId);
        button.innerHTML = `
            <span class="purchase-order-mobile-top"><strong class="purchase-order-mobile-number">${escapeHtml(formatPurchaseOrderNumber(purchaseOrder.purchaseOrderId))}</strong>${createPurchaseOrderStatusBadge(purchaseOrder.status)}</span>
            <span class="purchase-order-mobile-supplier">${escapeHtml(purchaseOrder.supplierName)} · ${escapeHtml(purchaseOrder.supplierCode)}</span>
            <span class="purchase-order-mobile-summary"><span class="purchase-order-mobile-label">발주/입고/잔여</span><strong class="purchase-order-mobile-value">${formatQuantity(purchaseOrder.totalOrderedQuantity)} / ${formatQuantity(purchaseOrder.totalReceivedQuantity)} / ${formatQuantity(purchaseOrder.totalRemainingQuantity)}</strong></span>
            ${canViewOfficeInformation ? `<span class="purchase-order-mobile-summary"><span class="purchase-order-mobile-label">발주 총액</span><strong class="purchase-order-mobile-value">${formatCurrency(purchaseOrder.totalAmount)}</strong></span>` : ''}
            <span class="purchase-order-mobile-bottom"><span>${canViewOfficeInformation ? createEmailStatusBadge(purchaseOrder.emailStatus) : ''}</span><span class="purchase-order-mobile-date">${formatDateTime(purchaseOrder.createdAt)}</span></span>
        `;

        button.addEventListener('click', () => selectPurchaseOrder(purchaseOrder.purchaseOrderId));
        purchaseOrderMobileList.append(button);
    });
}


// 역할에 따라 실제 표시되는 발주 목록 열 개수를 반환한다.
function getPurchaseOrderColumnCount() {
    return canViewOfficeInformation ? 9 : 7;
}


// ========== 발주 목록 검색·페이지네이션 ==========

// 검색 기간의 시작일이 종료일보다 늦지 않은지 확인한다.
function validatePurchaseOrderFilters() {

    if (startDateFilter.value && endDateFilter.value && startDateFilter.value > endDateFilter.value) {
        showPageError('등록 시작일은 등록 종료일보다 늦을 수 없습니다.');
        startDateFilter.focus();
        return false;
    }

    return true;
}


// 현재 검색 조건으로 발주 목록 첫 페이지를 조회한다.
async function applyPurchaseOrderFilters() {

    clearPageError();

    if (!validatePurchaseOrderFilters()) {
        return;
    }

    try {
        await loadPurchaseOrders(0);
        await applyDefaultPurchaseOrderDetailState();
    } catch (error) {
        handlePageError(error, '발주 목록을 불러오지 못했습니다.');
    }
}


// 모든 검색 조건을 초기화하고 발주 목록 첫 페이지를 다시 조회한다.
async function resetPurchaseOrderFilters() {

    statusFilter.value = '';
    emailStatusFilter.value = '';
    supplierFilter.value = '';
    startDateFilter.value = '';
    endDateFilter.value = '';

    await applyPurchaseOrderFilters();
}


// 서버 페이지 정보로 발주 목록 페이지 이동 버튼을 출력한다.
function renderPurchaseOrderPagination() {
    renderPagination(purchaseOrderPagination, purchaseOrderPageMeta, async page => {
        clearPageError();

        try {
            await loadPurchaseOrders(page);
            await applyDefaultPurchaseOrderDetailState();
        } catch (error) {
            handlePageError(error, '발주 목록을 불러오지 못했습니다.');
        }
    });
}


// ========== 발주 상세 조회 ==========

// 선택한 발주 상세정보와 이메일 전송 이력을 조회하여 상세 영역을 연다.
async function selectPurchaseOrder(purchaseOrderId, openMobilePanel = true) {

    clearPageError();
    clearPurchaseOrderFormMessages();
    setPurchaseOrderDetailLoading(true);

    try {
        const response = await api.get(`/purchase-orders/${purchaseOrderId}`);

        selectedPurchaseOrder = response.data;
        purchaseOrderFormMode = 'detail';
        mobileDetailOpen = openMobilePanel;

        if (isEditableDraft()) {
            await loadAvailableSupplierItems(selectedPurchaseOrder.supplierId);
        } else {
            availableSupplierItems = [];
        }

        renderPurchaseOrderDetail();

        if (canViewOfficeInformation) {
            await loadEmailHistory(0);
        } else {
            clearEmailHistory();
        }

        renderSelectedPurchaseOrder();
        syncDetailVisibility();

    } catch (error) {
        handlePageError(error, '발주 상세정보를 불러오지 못했습니다.');
    } finally {
        setPurchaseOrderDetailLoading(false);
    }
}


// 화면 크기에 맞춰 목록의 첫 발주를 선택하거나 상세 영역을 초기화한다.
async function applyDefaultPurchaseOrderDetailState() {

    if (!isMobile() && purchaseOrders.length > 0) {
        await selectPurchaseOrder(purchaseOrders[0].purchaseOrderId, false);
        return;
    }

    showPurchaseOrderDetailEmpty();
}


// 선택한 발주를 상세 Form과 처리 이력에 출력한다.
function renderPurchaseOrderDetail() {

    if (!selectedPurchaseOrder) {
        showPurchaseOrderDetailEmpty();
        return;
    }

    purchaseOrderDetailTitle.textContent = '발주 정보';
    purchaseOrderDetailMode.textContent = isEditableDraft()
        ? '작성 중 발주의 공급업체·품목·메모를 수정할 수 있습니다.'
        : '발주 품목과 처리 이력 및 현재 진행 상태를 확인할 수 있습니다.';
    purchaseOrderDetailEmpty.hidden = true;
    purchaseOrderDetailForm.hidden = false;

    purchaseOrderIdValue.textContent = formatPurchaseOrderNumber(selectedPurchaseOrder.purchaseOrderId);
    setPurchaseOrderStatusBadge(purchaseOrderStatusBadge, selectedPurchaseOrder.status);
    setEmailStatusBadge(purchaseOrderEmailBadge, selectedPurchaseOrder.emailStatus);

    renderPurchaseOrderSupplierOptions(selectedPurchaseOrder.supplierId);
    purchaseOrderMemo.value = selectedPurchaseOrder.memo ?? '';
    supplierEmailValue.textContent = selectedPurchaseOrder.supplierEmail ?? '-';
    purchaseOrderUpdatedAtValue.textContent = formatDateTime(selectedPurchaseOrder.updatedAt);

    purchaseOrderItemRows = (selectedPurchaseOrder.items ?? []).map(item => ({ ...item }));

    renderPurchaseOrderItems();
    renderPurchaseOrderTotals();
    renderPurchaseOrderActionHistory();
    applyPurchaseOrderDetailAccess();
}


// 선택되지 않은 발주 상세 영역을 기본 안내 상태로 초기화한다.
function showPurchaseOrderDetailEmpty() {

    selectedPurchaseOrder = null;
    purchaseOrderFormMode = 'empty';
    purchaseOrderItemRows = [];
    mobileDetailOpen = false;

    purchaseOrderDetailTitle.textContent = '발주 정보';
    purchaseOrderDetailMode.textContent = '선택한 발주의 품목과 처리 이력을 확인할 수 있습니다.';
    purchaseOrderDetailForm.hidden = true;
    purchaseOrderDetailEmpty.hidden = false;

    clearPurchaseOrderFormMessages();
    clearEmailHistory();
    renderSelectedPurchaseOrder();
    syncDetailVisibility();
}


// 현재 상세정보가 ADMIN·OFFICE가 수정할 수 있는 DRAFT인지 확인한다.
function isEditableDraft() {
    return canManagePurchaseOrder && selectedPurchaseOrder?.status === 'DRAFT';
}


// 역할과 발주 상태에 따라 입력 필드와 처리 버튼 표시 범위를 적용한다.
function applyPurchaseOrderDetailAccess() {

    const editable = purchaseOrderFormMode === 'create' || isEditableDraft();
    const existing = purchaseOrderFormMode === 'detail' && selectedPurchaseOrder !== null;
    const status = selectedPurchaseOrder?.status;

    purchaseOrderSupplier.disabled = !editable;
    purchaseOrderMemo.disabled = !editable;
    addPurchaseOrderItemButton.hidden = !editable;
    savePurchaseOrderButton.hidden = !editable;
    savePurchaseOrderButton.textContent = purchaseOrderFormMode === 'create' ? '발주 등록' : '변경 저장';

    deletePurchaseOrderButton.hidden = !(existing && canManagePurchaseOrder && status === 'DRAFT');
    submitPurchaseOrderButton.hidden = !(existing && canManagePurchaseOrder && status === 'DRAFT');
    approvePurchaseOrderButton.hidden = !(existing && canApprovePurchaseOrder && status === 'SUBMITTED');
    orderPurchaseOrderButton.hidden = !(existing && canManagePurchaseOrder && status === 'APPROVED');
    resendEmailButton.hidden = !(existing && canManagePurchaseOrder && status === 'ORDERED'
        && selectedPurchaseOrder.emailStatus === 'FAILED');
    cancelPurchaseOrderButton.hidden = !(existing && canManagePurchaseOrder
        && ['SUBMITTED', 'APPROVED', 'ORDERED'].includes(status));

    document.querySelectorAll('.purchase-order-item-manage-column').forEach(element => {
        element.hidden = !editable;
    });
}


// 발주 목록의 선택 상태를 PC 행과 Mobile Card에 동일하게 표시한다.
function renderSelectedPurchaseOrder() {

    const selectedId = selectedPurchaseOrder?.purchaseOrderId;

    document.querySelectorAll('[data-purchase-order-id]').forEach(element => {
        element.classList.toggle('is-selected', Number(element.dataset.purchaseOrderId) === selectedId);
    });
}


// ========== 발주 품목 입력·출력 ==========

// 현재 발주 품목을 입력 가능 여부와 역할별 금액 범위에 맞춰 Table로 출력한다.
function renderPurchaseOrderItems() {

    purchaseOrderItemTableBody.innerHTML = '';

    if (purchaseOrderItemRows.length === 0) {
        purchaseOrderItemTableBody.innerHTML = `<tr><td colspan="${getPurchaseOrderItemColumnCount()}" class="purchase-order-item-empty-cell">발주 품목을 추가해 주세요.</td></tr>`;
        return;
    }

    const editable = purchaseOrderFormMode === 'create' || isEditableDraft();

    purchaseOrderItemRows.forEach((itemRow, index) => {
        purchaseOrderItemTableBody.append(createPurchaseOrderItemRow(itemRow, index, editable));
    });
}


// 하나의 발주 품목 입력 행을 생성하고 변경 이벤트를 연결한다.
function createPurchaseOrderItemRow(itemRow, index, editable) {

    const row = document.createElement('tr');
    const lineCell = document.createElement('td');
    const itemCell = document.createElement('td');
    const unitCell = document.createElement('td');
    const quantityCell = document.createElement('td');
    const priceCell = document.createElement('td');
    const amountCell = document.createElement('td');
    const receiptCell = document.createElement('td');
    const manageCell = document.createElement('td');
    const itemSelect = document.createElement('select');
    const quantityInput = document.createElement('input');
    const priceInput = document.createElement('input');

    lineCell.textContent = String(index + 1);
    itemSelect.setAttribute('aria-label', `${index + 1}번 발주 품목`);
    itemSelect.disabled = !editable;
    renderPurchaseOrderItemSelectOptions(itemSelect, itemRow);
    itemCell.append(itemSelect);

    unitCell.textContent = getItemUnitLabel(itemRow.unit, itemRow.otherUnitName);

    quantityInput.type = 'number';
    quantityInput.min = '0.001';
    quantityInput.step = '0.001';
    quantityInput.inputMode = 'decimal';
    quantityInput.value = itemRow.orderedQuantity ?? '';
    quantityInput.disabled = !editable;
    quantityInput.setAttribute('aria-label', `${index + 1}번 발주 수량`);
    quantityCell.append(quantityInput);

    priceInput.type = 'number';
    priceInput.min = '0';
    priceInput.step = '0.01';
    priceInput.inputMode = 'decimal';
    priceInput.value = itemRow.unitPrice ?? '';
    priceInput.disabled = !editable;
    priceInput.setAttribute('aria-label', `${index + 1}번 발주 단가`);
    priceCell.dataset.officeInformation = 'amount';
    priceCell.hidden = !canViewOfficeInformation;
    priceCell.append(priceInput);

    amountCell.className = 'purchase-order-item-line-amount';
    amountCell.dataset.officeInformation = 'amount';
    amountCell.hidden = !canViewOfficeInformation;
    amountCell.textContent = formatCurrency(calculateLineAmount(itemRow));

    receiptCell.className = 'purchase-order-item-receipt-value';
    receiptCell.textContent = `${formatQuantity(itemRow.receivedQuantity ?? 0)} / ${formatQuantity(getRemainingQuantity(itemRow))}`;

    manageCell.className = 'purchase-order-item-manage-column';
    manageCell.hidden = !editable;

    if (editable) {
        const removeButton = document.createElement('button');

        removeButton.type = 'button';
        removeButton.className = 'purchase-order-item-remove';
        removeButton.textContent = '×';
        removeButton.setAttribute('aria-label', `${index + 1}번 발주 품목 삭제`);
        removeButton.addEventListener('click', () => removePurchaseOrderItem(index));
        manageCell.append(removeButton);

        itemSelect.addEventListener('change', () => handlePurchaseOrderItemSelection(index, itemSelect.value));
        quantityInput.addEventListener('input', () => updatePurchaseOrderItemValue(index, 'orderedQuantity', quantityInput.value));
        priceInput.addEventListener('input', () => updatePurchaseOrderItemValue(index, 'unitPrice', priceInput.value));
    }

    row.append(lineCell, itemCell, unitCell, quantityCell);
    if (canViewOfficeInformation) row.append(priceCell, amountCell);
    row.append(receiptCell, manageCell);

    return row;
}


// 품목 선택 Select에 공급업체 취급 품목과 기존 상세 품목을 표시한다.
function renderPurchaseOrderItemSelectOptions(select, itemRow) {

    const emptyOption = document.createElement('option');

    emptyOption.value = '';
    emptyOption.textContent = '품목 선택';
    select.append(emptyOption);

    const itemOptions = [...availableSupplierItems];
    const currentExists = itemOptions.some(item => item.itemId === itemRow.itemId);

    if (itemRow.itemId && !currentExists) {
        itemOptions.push(itemRow);
    }

    itemOptions.forEach(item => {
        const option = document.createElement('option');

        option.value = String(item.itemId);
        option.textContent = `${item.itemCode} · ${item.itemName}`;
        select.append(option);
    });

    select.value = itemRow.itemId ? String(itemRow.itemId) : '';
}


// 빈 발주 품목 행을 하나 추가한다.
function addPurchaseOrderItem() {

    if (!(purchaseOrderFormMode === 'create' || isEditableDraft())) {
        return;
    }

    if (!purchaseOrderSupplier.value) {
        showPurchaseOrderFormError('공급업체를 먼저 선택해 주세요.');
        purchaseOrderSupplier.focus();
        return;
    }

    clearPurchaseOrderFormMessages();
    purchaseOrderItemRows.push({
        itemId: null,
        itemCode: '',
        itemName: '',
        unit: null,
        otherUnitName: null,
        orderedQuantity: '',
        unitPrice: '',
        receivedQuantity: 0,
        remainingQuantity: 0
    });
    renderPurchaseOrderItems();
    applyPurchaseOrderDetailAccess();
}


// 지정한 순번의 발주 품목 입력 행을 제거한다.
function removePurchaseOrderItem(index) {

    purchaseOrderItemRows.splice(index, 1);
    renderPurchaseOrderItems();
    renderPurchaseOrderTotals();
    applyPurchaseOrderDetailAccess();
}


// 품목 선택값을 행 상태에 반영하고 단위와 계산값을 다시 출력한다.
function handlePurchaseOrderItemSelection(index, itemIdValue) {

    const selectedItem = availableSupplierItems.find(item => item.itemId === Number(itemIdValue));
    const itemRow = purchaseOrderItemRows[index];

    itemRow.itemId = selectedItem?.itemId ?? null;
    itemRow.itemCode = selectedItem?.itemCode ?? '';
    itemRow.itemName = selectedItem?.itemName ?? '';
    itemRow.unit = selectedItem?.unit ?? null;
    itemRow.otherUnitName = selectedItem?.otherUnitName ?? null;

    renderPurchaseOrderItems();
    applyPurchaseOrderDetailAccess();
}


// 발주 수량 또는 단가 입력값을 행 상태에 저장하고 합계 금액을 다시 계산한다.
function updatePurchaseOrderItemValue(index, field, value) {

    purchaseOrderItemRows[index][field] = value;
    renderPurchaseOrderTotals();

    const row = purchaseOrderItemTableBody.children[index];
    const amountCell = row?.querySelector('.purchase-order-item-line-amount');

    if (amountCell) {
        amountCell.textContent = formatCurrency(calculateLineAmount(purchaseOrderItemRows[index]));
    }
}


// 현재 발주 품목 입력값으로 발주·입고·잔여 수량과 총액을 계산해 표시한다.
function renderPurchaseOrderTotals() {

    const totalOrdered = purchaseOrderItemRows.reduce((sum, item) => sum + toNumber(item.orderedQuantity), 0);
    const totalReceived = purchaseOrderItemRows.reduce((sum, item) => sum + toNumber(item.receivedQuantity), 0);
    const totalRemaining = purchaseOrderItemRows.reduce((sum, item) => sum + getRemainingQuantity(item), 0);
    const totalAmount = purchaseOrderItemRows.reduce((sum, item) => sum + calculateLineAmount(item), 0);

    totalOrderedQuantityValue.textContent = formatQuantity(totalOrdered);
    totalReceivedQuantityValue.textContent = formatQuantity(totalReceived);
    totalRemainingQuantityValue.textContent = formatQuantity(totalRemaining);
    totalAmountValue.textContent = formatCurrency(totalAmount);
}


// 품목의 발주 수량과 단가를 곱하여 품목 금액을 계산한다.
function calculateLineAmount(item) {
    return toNumber(item.orderedQuantity) * toNumber(item.unitPrice);
}


// 응답의 잔여 수량을 우선 사용하고 입력 중에는 발주 수량에서 입고 수량을 차감한다.
function getRemainingQuantity(item) {

    if (item.remainingQuantity !== undefined && item.remainingQuantity !== null
        && purchaseOrderFormMode !== 'create' && !isEditableDraft()) {
        return toNumber(item.remainingQuantity);
    }

    return Math.max(toNumber(item.orderedQuantity) - toNumber(item.receivedQuantity), 0);
}


// 역할에 따라 발주 품목 Table에서 실제 표시되는 열 개수를 반환한다.
function getPurchaseOrderItemColumnCount() {
    return canViewOfficeInformation ? 8 : 6;
}


// ========== 발주 신규 등록·수정 ==========

// 신규 발주 입력 상태로 전환하고 ACTIVE 공급업체와 빈 품목 행을 표시한다.
function enterPurchaseOrderCreateMode() {

    if (!canManagePurchaseOrder) {
        return;
    }

    selectedPurchaseOrder = null;
    purchaseOrderFormMode = 'create';
    purchaseOrderItemRows = [];
    availableSupplierItems = [];
    mobileDetailOpen = true;

    clearPurchaseOrderFormMessages();
    clearEmailHistory();
    renderPurchaseOrderSupplierOptions();

    purchaseOrderDetailTitle.textContent = '신규 발주';
    purchaseOrderDetailMode.textContent = '공급업체와 취급 품목의 수량·단가를 입력해 작성 중 발주를 등록합니다.';
    purchaseOrderDetailEmpty.hidden = true;
    purchaseOrderDetailForm.hidden = false;
    purchaseOrderIdValue.textContent = '등록 시 자동 생성';
    purchaseOrderSupplier.value = '';
    purchaseOrderMemo.value = '';
    supplierEmailValue.textContent = '-';
    purchaseOrderUpdatedAtValue.textContent = '-';

    setPurchaseOrderStatusBadge(purchaseOrderStatusBadge, 'DRAFT');
    setEmailStatusBadge(purchaseOrderEmailBadge, null);
    clearPurchaseOrderActionHistory();
    renderPurchaseOrderItems();
    renderPurchaseOrderTotals();
    applyPurchaseOrderDetailAccess();
    renderSelectedPurchaseOrder();
    syncDetailVisibility();

    purchaseOrderSupplier.focus();
}


// Form 모드에 따라 신규 발주 등록 또는 DRAFT 발주 수정을 실행한다.
async function handlePurchaseOrderSubmit(event) {

    event.preventDefault();

    if (!validatePurchaseOrderForm()) {
        return;
    }

    if (purchaseOrderFormMode === 'create') {
        await createPurchaseOrder();
        return;
    }

    if (isEditableDraft()) {
        await updatePurchaseOrder();
    }
}


// 공급업체·품목 중복·수량·단가·메모를 Server DTO 범위에 맞게 검증한다.
function validatePurchaseOrderForm() {

    clearPurchaseOrderFormMessages();

    if (!purchaseOrderSupplier.value) {
        showPurchaseOrderFormError('공급업체를 선택해 주세요.');
        purchaseOrderSupplier.focus();
        return false;
    }

    if (purchaseOrderItemRows.length === 0) {
        showPurchaseOrderFormError('발주 품목을 한 건 이상 추가해 주세요.');
        return false;
    }

    const itemIds = purchaseOrderItemRows.map(item => Number(item.itemId));

    if (itemIds.some(itemId => !Number.isInteger(itemId) || itemId < 1)) {
        showPurchaseOrderFormError('모든 발주 품목을 선택해 주세요.');
        return false;
    }

    if (new Set(itemIds).size !== itemIds.length) {
        showPurchaseOrderFormError('같은 품목을 발주에 중복으로 등록할 수 없습니다.');
        return false;
    }

    for (let index = 0; index < purchaseOrderItemRows.length; index += 1) {
        const item = purchaseOrderItemRows[index];

        if (!isValidDecimal(item.orderedQuantity, 16, 3, false)) {
            showPurchaseOrderFormError(`${index + 1}번 품목의 발주 수량은 0보다 크고 소수점 셋째 자리 이하여야 합니다.`);
            return false;
        }

        if (!isValidDecimal(item.unitPrice, 17, 2, true)) {
            showPurchaseOrderFormError(`${index + 1}번 품목의 발주 단가는 0 이상이고 소수점 둘째 자리 이하여야 합니다.`);
            return false;
        }
    }

    if (purchaseOrderMemo.value.length > 2000) {
        showPurchaseOrderFormError('발주 메모는 2000자 이하여야 합니다.');
        purchaseOrderMemo.focus();
        return false;
    }

    return true;
}


// 입력값으로 발주 등록 요청 데이터를 생성한다.
function createPurchaseOrderRequestBody() {

    return {
        supplierId: Number(purchaseOrderSupplier.value),
        items: purchaseOrderItemRows.map(item => ({
            itemId: Number(item.itemId),
            orderedQuantity: Number(item.orderedQuantity),
            unitPrice: Number(item.unitPrice)
        })),
        memo: normalizeOptionalValue(purchaseOrderMemo.value)
    };
}


// 신규 DRAFT 발주를 등록하고 목록 첫 페이지에서 생성된 발주를 선택한다.
async function createPurchaseOrder() {

    setPurchaseOrderFormLoading(true);

    try {
        const response = await api.post('/purchase-orders', createPurchaseOrderRequestBody());
        const createdPurchaseOrder = response.data;

        resetPurchaseOrderFilterValues();
        await loadPurchaseOrders(0);
        await selectPurchaseOrder(createdPurchaseOrder.purchaseOrderId);
        showPurchaseOrderFormNotice('신규 발주를 작성 중 상태로 등록했습니다.');

    } catch (error) {
        if (!handleUnauthorized(error)) showPurchaseOrderFormError(getApiErrorMessage(error));
    } finally {
        setPurchaseOrderFormLoading(false);
    }
}


// 선택한 DRAFT 발주의 수정 요청 데이터에 최신 version을 추가한다.
function createPurchaseOrderUpdateRequestBody() {

    return {
        ...createPurchaseOrderRequestBody(),
        version: selectedPurchaseOrder.version
    };
}


// DRAFT 발주를 수정하고 현재 목록과 상세정보를 최신 데이터로 갱신한다.
async function updatePurchaseOrder() {

    const purchaseOrderId = selectedPurchaseOrder.purchaseOrderId;
    const detailWasOpen = mobileDetailOpen;

    setPurchaseOrderFormLoading(true);

    try {
        const response = await api.patch(`/purchase-orders/${purchaseOrderId}`, createPurchaseOrderUpdateRequestBody());

        await reloadCurrentPurchaseOrderPageAndSelect(response.data.purchaseOrderId, detailWasOpen);
        showPurchaseOrderFormNotice('발주 정보를 수정했습니다.');

    } catch (error) {
        if (handleUnauthorized(error)) return;
        if (isPurchaseOrderVersionConflict(error)) {
            await handlePurchaseOrderVersionConflict(error, purchaseOrderId, detailWasOpen);
            return;
        }
        showPurchaseOrderFormError(getApiErrorMessage(error));
    } finally {
        setPurchaseOrderFormLoading(false);
    }
}


// ========== 발주 상태 처리 공통 Modal ==========

// 삭제·승인 요청·승인·확정·재전송 처리 정보를 공통 확인 Modal에 표시한다.
function openActionModal(action) {

    if (!selectedPurchaseOrder || !getActionConfiguration(action)) {
        return;
    }

    const configuration = getActionConfiguration(action);

    pendingAction = action;
    actionModalTitle.textContent = configuration.title;
    actionModalTarget.textContent = `${formatPurchaseOrderNumber(selectedPurchaseOrder.purchaseOrderId)} · ${selectedPurchaseOrder.supplierName}`;
    actionModalCurrentValue.textContent = getPurchaseOrderStatusLabel(selectedPurchaseOrder.status);
    actionModalNextValue.textContent = configuration.nextLabel;
    actionModalDescription.textContent = configuration.description;
    confirmActionButton.textContent = configuration.confirmLabel;
    confirmActionButton.classList.toggle('button-danger', action === 'delete');
    confirmActionButton.classList.toggle('button-primary', action !== 'delete');

    clearActionModalError();
    actionModalBackdrop.hidden = false;
    confirmActionButton.focus();
}


// 처리 종류별 Modal 문구와 Server 요청 결과 상태를 반환한다.
function getActionConfiguration(action) {

    const configurations = {
        delete: {
            title: '작성 중 발주 삭제', nextLabel: '발주 삭제', confirmLabel: '삭제',
            description: '작성 중 발주와 등록된 발주 품목을 삭제합니다. 삭제한 내용은 복구할 수 없습니다.'
        },
        submit: {
            title: '발주 승인 요청', nextLabel: '승인 대기', confirmLabel: '승인 요청',
            description: '현재 공급업체와 취급 품목을 다시 검증한 후 ADMIN 승인 대기 상태로 변경합니다.'
        },
        approve: {
            title: '발주 승인', nextLabel: '승인 완료', confirmLabel: '승인',
            description: '승인 대기 발주를 승인 완료 상태로 변경합니다.'
        },
        order: {
            title: '발주 확정', nextLabel: '발주 확정', confirmLabel: '확정 및 전송',
            description: '발주를 먼저 확정한 후 발주서 PDF를 공급업체 이메일로 자동 전송합니다.'
        },
        resend: {
            title: '발주서 이메일 재전송', nextLabel: '이메일 재전송', confirmLabel: '재전송',
            description: '최신 발주서 PDF를 생성하여 공급업체 이메일로 다시 전송합니다.'
        }
    };

    return configurations[action] ?? null;
}


// 공통 발주 처리 Modal을 닫고 처리 대상을 초기화한다.
function closeActionModal() {

    actionModalBackdrop.hidden = true;
    pendingAction = null;
    clearActionModalError();
}


// 공통 처리 Modal에서 선택한 발주 작업을 Server API로 실행한다.
async function handleActionModalSubmit(event) {

    event.preventDefault();

    if (!pendingAction || !selectedPurchaseOrder) {
        return;
    }

    const action = pendingAction;
    const purchaseOrderId = selectedPurchaseOrder.purchaseOrderId;
    const version = selectedPurchaseOrder.version;
    const detailWasOpen = mobileDetailOpen;

    setActionModalLoading(true);

    try {
        let response = null;

        if (action === 'delete') {
            await api.delete(`/purchase-orders/${purchaseOrderId}`, { version });
        } else if (action === 'submit') {
            response = await api.post(`/purchase-orders/${purchaseOrderId}/submit`, { version });
        } else if (action === 'approve') {
            response = await api.post(`/purchase-orders/${purchaseOrderId}/approve`, { version });
        } else if (action === 'order') {
            response = await api.post(`/purchase-orders/${purchaseOrderId}/order`, { version });
        } else if (action === 'resend') {
            response = await api.post(`/purchase-orders/${purchaseOrderId}/email/resend`, { version });
        }

        closeActionModal();

        if (action === 'delete') {
            await reloadAfterPurchaseOrderDelete();
            return;
        }

        await reloadCurrentPurchaseOrderPageAndSelect(purchaseOrderId, detailWasOpen);

        if (action === 'order' && response?.warnings?.includes('MAIL_SEND_FAILED')) {
            showPurchaseOrderFormError('발주는 확정되었지만 발주서 이메일 전송에 실패했습니다. 이메일 전송 이력을 확인한 후 재전송해 주세요.');
            return;
        }

        showPurchaseOrderFormNotice(getActionSuccessMessage(action));

    } catch (error) {
        if (handleUnauthorized(error)) return;

        if (isPurchaseOrderVersionConflict(error)) {
            closeActionModal();
            await handlePurchaseOrderVersionConflict(error, purchaseOrderId, detailWasOpen);
            return;
        }

        // 재전송 실패도 Server에 FAILED 이력이 저장되므로 최신 상세와 이력을 다시 조회한다.
        if (action === 'resend' && error?.status === 502) {
            await reloadCurrentPurchaseOrderPageAndSelect(purchaseOrderId, detailWasOpen);
        }

        showActionModalError(getApiErrorMessage(error));
    } finally {
        setActionModalLoading(false);
    }
}


// 처리 종류에 맞는 완료 안내 문구를 반환한다.
function getActionSuccessMessage(action) {

    return {
        submit: '발주 승인을 요청했습니다.',
        approve: '발주를 승인했습니다.',
        order: '발주를 확정하고 발주서 이메일 전송을 처리했습니다.',
        resend: '발주서 이메일을 재전송했습니다.'
    }[action] ?? '발주 처리를 완료했습니다.';
}


// ========== 발주 취소 Modal ==========

// 취소 가능 상태의 발주를 대상으로 취소 사유 입력 Modal을 연다.
function openCancelModal() {

    if (!canManagePurchaseOrder || !selectedPurchaseOrder
        || !['SUBMITTED', 'APPROVED', 'ORDERED'].includes(selectedPurchaseOrder.status)) {
        return;
    }

    const supplierConfirmationRequired = selectedPurchaseOrder.status === 'ORDERED'
        && selectedPurchaseOrder.emailStatus === 'SENT';

    cancelModalTarget.textContent = `${formatPurchaseOrderNumber(selectedPurchaseOrder.purchaseOrderId)} · ${selectedPurchaseOrder.supplierName}`;
    cancelModalCurrentValue.textContent = getPurchaseOrderStatusLabel(selectedPurchaseOrder.status);
    cancelReason.value = '';
    cancelReasonLength.textContent = '0';
    supplierCancelConfirmed.checked = false;
    supplierCancelConfirmedField.hidden = !supplierConfirmationRequired;
    cancelModalGuide.textContent = supplierConfirmationRequired
        ? '이미 발주서 이메일이 전송되었습니다. 공급업체에 취소를 확인한 경우에만 발주를 취소할 수 있습니다.'
        : 'Server가 현재 발주 상태와 입고 진행 여부를 확인한 후 취소합니다.';

    clearCancelModalError();
    cancelModalBackdrop.hidden = false;
    cancelReason.focus();
}


// 발주 취소 Modal을 닫고 입력값을 초기화한다.
function closeCancelModal() {

    cancelModalBackdrop.hidden = true;
    cancelReason.value = '';
    supplierCancelConfirmed.checked = false;
    clearCancelModalError();
}


// 취소 사유와 공급업체 확인 여부를 검증하여 발주 취소 API를 호출한다.
async function handleCancelModalSubmit(event) {

    event.preventDefault();

    if (!selectedPurchaseOrder) {
        return;
    }

    const reason = cancelReason.value.trim();
    const supplierConfirmationRequired = selectedPurchaseOrder.status === 'ORDERED'
        && selectedPurchaseOrder.emailStatus === 'SENT';

    clearCancelModalError();

    if (!reason) {
        showCancelModalError('발주 취소 사유를 입력해 주세요.');
        cancelReason.focus();
        return;
    }

    if (supplierConfirmationRequired && !supplierCancelConfirmed.checked) {
        showCancelModalError('공급업체에 발주 취소를 확인한 후 체크해 주세요.');
        supplierCancelConfirmed.focus();
        return;
    }

    const purchaseOrderId = selectedPurchaseOrder.purchaseOrderId;
    const detailWasOpen = mobileDetailOpen;

    setCancelModalLoading(true);

    try {
        await api.post(`/purchase-orders/${purchaseOrderId}/cancel`, {
            reason,
            supplierCancelConfirmed: supplierCancelConfirmed.checked,
            version: selectedPurchaseOrder.version
        });

        closeCancelModal();
        await reloadCurrentPurchaseOrderPageAndSelect(purchaseOrderId, detailWasOpen);
        showPurchaseOrderFormNotice('발주를 취소했습니다.');

    } catch (error) {
        if (handleUnauthorized(error)) return;
        if (isPurchaseOrderVersionConflict(error)) {
            closeCancelModal();
            await handlePurchaseOrderVersionConflict(error, purchaseOrderId, detailWasOpen);
            return;
        }
        showCancelModalError(getApiErrorMessage(error));
    } finally {
        setCancelModalLoading(false);
    }
}


// 취소 사유 입력 글자 수를 표시한다.
function updateCancelReasonLength() {
    cancelReasonLength.textContent = String(cancelReason.value.length);
}


// ========== 이메일 전송 이력 ==========

// 선택 발주의 이메일 전송 이력을 최근 시도 순서로 페이지 조회한다.
async function loadEmailHistory(page) {

    if (!canViewOfficeInformation || !selectedPurchaseOrder) {
        clearEmailHistory();
        return;
    }

    const response = await api.get(`/purchase-orders/${selectedPurchaseOrder.purchaseOrderId}/email-history?page=${page}`);

    emailHistory = response.data ?? [];
    emailHistoryPageMeta = response.meta;

    renderEmailHistoryCount();
    renderEmailHistoryTable();
    renderEmailHistoryMobileList();
    renderEmailHistoryPagination();
}


// 이메일 전송 이력 전체 건수를 표시한다.
function renderEmailHistoryCount() {
    emailHistoryCount.textContent = `총 ${emailHistoryPageMeta?.totalElements ?? 0}건`;
}


// PC·Tablet 이메일 전송 이력을 Table로 출력한다.
function renderEmailHistoryTable() {

    emailHistoryTableBody.innerHTML = '';

    if (emailHistory.length === 0) {
        emailHistoryTableBody.innerHTML = '<tr><td colspan="6" class="purchase-order-item-empty-cell">이메일 전송 이력이 없습니다.</td></tr>';
        return;
    }

    emailHistory.forEach(history => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${history.attemptNo}</td>
            <td>${escapeHtml(history.recipientEmail)}</td>
            <td>${createEmailStatusBadge(history.status)}</td>
            <td>${escapeHtml(history.attemptedByName ?? '-')}</td>
            <td>${formatDateTime(history.attemptedAt)}</td>
            <td title="${escapeHtml(history.errorMessage ?? '')}">${escapeHtml(history.errorMessage ?? '-')}</td>
        `;
        emailHistoryTableBody.append(row);
    });
}


// Mobile 이메일 전송 이력을 Card로 출력한다.
function renderEmailHistoryMobileList() {

    emailHistoryMobileList.innerHTML = '';

    if (emailHistory.length === 0) {
        emailHistoryMobileList.innerHTML = '<p class="purchase-order-mobile-empty">이메일 전송 이력이 없습니다.</p>';
        return;
    }

    emailHistory.forEach(history => {
        const item = document.createElement('article');

        item.className = 'purchase-order-email-history-mobile-item';
        item.innerHTML = `
            <div class="purchase-order-email-history-mobile-row"><span>${history.attemptNo}차 시도</span>${createEmailStatusBadge(history.status)}</div>
            <div class="purchase-order-email-history-mobile-row"><span>수신자</span><strong>${escapeHtml(history.recipientEmail)}</strong></div>
            <div class="purchase-order-email-history-mobile-row"><span>처리자</span><strong>${escapeHtml(history.attemptedByName ?? '-')}</strong></div>
            <div class="purchase-order-email-history-mobile-row"><span>시도 일시</span><strong>${formatDateTime(history.attemptedAt)}</strong></div>
            ${history.errorMessage ? `<div class="purchase-order-email-history-mobile-row"><span>실패 원인</span><strong>${escapeHtml(history.errorMessage)}</strong></div>` : ''}
        `;
        emailHistoryMobileList.append(item);
    });
}


// 이메일 이력 페이지 이동 버튼을 출력한다.
function renderEmailHistoryPagination() {
    renderPagination(emailHistoryPagination, emailHistoryPageMeta, async page => {
        try {
            await loadEmailHistory(page);
        } catch (error) {
            handlePageError(error, '이메일 전송 이력을 불러오지 못했습니다.');
        }
    });
}


// 이메일 전송 이력과 페이지 정보를 빈 상태로 초기화한다.
function clearEmailHistory() {

    emailHistory = [];
    emailHistoryPageMeta = null;
    emailHistoryCount.textContent = '총 0건';
    emailHistoryTableBody.innerHTML = '<tr><td colspan="6" class="purchase-order-item-empty-cell">이메일 전송 이력이 없습니다.</td></tr>';
    emailHistoryMobileList.innerHTML = '';
    emailHistoryPagination.innerHTML = '';
}


// ========== 처리 이력 출력 ==========

// 발주 상세 응답의 처리자·처리 일시와 취소·종료 사유를 출력한다.
function renderPurchaseOrderActionHistory() {

    createdActionValue.textContent = formatAction(selectedPurchaseOrder.created);
    submittedActionValue.textContent = formatAction(selectedPurchaseOrder.submitted);
    approvedActionValue.textContent = formatAction(selectedPurchaseOrder.approved);
    orderedActionValue.textContent = formatAction(selectedPurchaseOrder.ordered);
    supplierCancelConfirmedActionValue.textContent = formatAction(selectedPurchaseOrder.supplierCancelConfirmed);
    canceledActionValue.textContent = formatAction(selectedPurchaseOrder.canceled);
    cancelReasonValue.textContent = selectedPurchaseOrder.cancelReason ?? '-';
    closedActionValue.textContent = formatAction(selectedPurchaseOrder.closed);
    closeReasonValue.textContent = selectedPurchaseOrder.closeReason ?? '-';
}


// 신규 등록 Form의 처리 이력을 빈 값으로 초기화한다.
function clearPurchaseOrderActionHistory() {

    [createdActionValue, submittedActionValue, approvedActionValue, orderedActionValue,
        supplierCancelConfirmedActionValue, canceledActionValue, cancelReasonValue,
        closedActionValue, closeReasonValue].forEach(element => {
        element.textContent = '-';
    });
}


// 처리자와 처리 일시를 하나의 화면 문구로 변환한다.
function formatAction(action) {

    if (!action) {
        return '-';
    }

    return `${action.userName ?? '-'} · ${formatDateTime(action.processedAt)}`;
}


// ========== 목록·상세 재조회와 version 충돌 ==========

// 현재 발주 목록 페이지를 다시 조회하고 대상 발주가 남아 있으면 다시 선택한다.
async function reloadCurrentPurchaseOrderPageAndSelect(purchaseOrderId, openMobilePanel) {

    const currentPage = purchaseOrderPageMeta?.page ?? 0;

    await loadPurchaseOrders(currentPage);

    const purchaseOrderStillVisible = purchaseOrders.some(order => order.purchaseOrderId === purchaseOrderId);

    if (!purchaseOrderStillVisible) {
        await applyDefaultPurchaseOrderDetailState();
        return false;
    }

    await selectPurchaseOrder(purchaseOrderId, openMobilePanel);
    return true;
}


// 삭제 후 현재 페이지가 비면 이전 유효 페이지로 이동하고 기본 상세 상태를 적용한다.
async function reloadAfterPurchaseOrderDelete() {

    let currentPage = purchaseOrderPageMeta?.page ?? 0;

    await loadPurchaseOrders(currentPage);

    if (purchaseOrders.length === 0 && currentPage > 0) {
        currentPage -= 1;
        await loadPurchaseOrders(currentPage);
    }

    await applyDefaultPurchaseOrderDetailState();
    showPageNoticeAsErrorFallback('작성 중 발주를 삭제했습니다.');
}


// version 충돌 메시지를 유지하면서 발주 목록과 상세정보를 최신 상태로 갱신한다.
async function handlePurchaseOrderVersionConflict(error, purchaseOrderId, openMobilePanel) {

    const message = getApiErrorMessage(error);

    try {
        const stillVisible = await reloadCurrentPurchaseOrderPageAndSelect(purchaseOrderId, openMobilePanel);

        if (stillVisible) {
            showPurchaseOrderFormError(message);
        } else {
            showPageError(message);
        }
    } catch (reloadError) {
        handlePageError(reloadError, '최신 발주 정보를 다시 조회하지 못했습니다.');
    }
}


// 409 응답 중 실제 version 충돌 메시지인지 확인한다.
function isPurchaseOrderVersionConflict(error) {
    return error?.status === 409 && getApiErrorMessage(error).includes('다른 사용자가 먼저');
}


// ========== 공통 화면 표시 보조 함수 ==========

// 발주 상태 값을 화면용 한글 Badge로 변환한다.
function createPurchaseOrderStatusBadge(status) {

    const statusClass = String(status ?? '').toLowerCase();

    return `<span class="purchase-order-status-badge is-${statusClass || 'draft'}">${escapeHtml(getPurchaseOrderStatusLabel(status))}</span>`;
}


// 기존 Badge Element에 발주 상태명과 상태 Class를 적용한다.
function setPurchaseOrderStatusBadge(element, status) {
    element.className = `purchase-order-status-badge is-${String(status ?? 'DRAFT').toLowerCase()}`;
    element.textContent = getPurchaseOrderStatusLabel(status);
}


// 발주 상태 Enum을 화면용 한글 상태명으로 변환한다.
function getPurchaseOrderStatusLabel(status) {

    return {
        DRAFT: '작성 중', SUBMITTED: '승인 대기', APPROVED: '승인 완료', ORDERED: '발주 확정',
        CANCELED: '발주 취소', RECEIVED: '전량 입고 완료', CLOSED: '발주 종료'
    }[status] ?? '-';
}


// 이메일 상태 값을 화면용 Badge로 변환한다.
function createEmailStatusBadge(status) {

    const statusClass = status ? status.toLowerCase() : 'pending';

    return `<span class="purchase-order-email-badge is-${statusClass}">${escapeHtml(getEmailStatusLabel(status))}</span>`;
}


// 기존 Badge Element에 이메일 상태명과 상태 Class를 적용한다.
function setEmailStatusBadge(element, status) {
    element.className = `purchase-order-email-badge is-${status ? status.toLowerCase() : 'pending'}`;
    element.textContent = getEmailStatusLabel(status);
}


// 이메일 상태 Enum을 화면용 한글 상태명으로 변환한다.
function getEmailStatusLabel(status) {
    return { SENT: '전송 성공', FAILED: '전송 실패' }[status] ?? '미전송';
}


// Server의 발주 식별자를 임의 업무 코드 없이 화면용 번호로 표시한다.
function formatPurchaseOrderNumber(purchaseOrderId) {
    return purchaseOrderId ? String(purchaseOrderId) : '-';
}


// 품목 단위를 화면용 한글 단위명으로 변환한다.
function getItemUnitLabel(unit, otherUnitName) {
    return { G: 'g', KG: 'kg', EA: '개', PACK: '팩', BOX: '박스', OTHER: otherUnitName ?? '기타' }[unit] ?? '-';
}


// 수량을 최대 소수점 셋째 자리까지 표시한다.
function formatQuantity(value) {
    return toNumber(value).toLocaleString('ko-KR', { maximumFractionDigits: 3 });
}


// 금액을 원화 형식으로 표시하고 권한상 null이면 대시를 반환한다.
function formatCurrency(value) {

    if (value === null || value === undefined) {
        return '-';
    }

    return `${toNumber(value).toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}원`;
}


// ISO 날짜·시간을 한국 화면 표시 형식으로 변환한다.
function formatDateTime(value) {

    if (!value) {
        return '-';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value).replace('T', ' ');
    }

    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date);
}


// 문자열 숫자를 계산 가능한 Number로 변환하고 변환할 수 없으면 0을 반환한다.
function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}


// 숫자 문자열의 정수·소수 자릿수와 0 허용 여부를 검증한다.
function isValidDecimal(value, maxIntegerDigits, maxFractionDigits, allowZero) {

    const normalizedValue = String(value ?? '').trim();
    const pattern = new RegExp(`^\\d{1,${maxIntegerDigits}}(?:\\.\\d{1,${maxFractionDigits}})?$`);

    if (!pattern.test(normalizedValue)) {
        return false;
    }

    const number = Number(normalizedValue);
    return Number.isFinite(number) && (allowZero ? number >= 0 : number > 0);
}


// 빈 선택 입력값을 null로 변환하고 값이 있으면 앞뒤 공백을 제거한다.
function normalizeOptionalValue(value) {
    const normalizedValue = value.trim();
    return normalizedValue === '' ? null : normalizedValue;
}


// 서버 문자열을 innerHTML에 넣기 전에 HTML 특수문자를 변환한다.
function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = value ?? '';
    return element.innerHTML;
}


// 공통 페이지 정보를 최대 5개 숫자 버튼과 이전·다음 버튼으로 출력한다.
function renderPagination(container, pageMeta, onMove) {

    container.innerHTML = '';

    if (!pageMeta || pageMeta.totalPages <= 1) {
        return;
    }

    const currentPage = pageMeta.page;
    const totalPages = pageMeta.totalPages;
    const firstVisiblePage = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
    const lastVisiblePage = Math.min(totalPages, firstVisiblePage + 5);

    container.append(createPageButton('‹', currentPage - 1, currentPage === 0, onMove));

    for (let page = firstVisiblePage; page < lastVisiblePage; page += 1) {
        const button = createPageButton(String(page + 1), page, false, onMove);

        if (page === currentPage) {
            button.classList.add('is-active');
            button.setAttribute('aria-current', 'page');
        }

        container.append(button);
    }

    container.append(createPageButton('›', currentPage + 1, currentPage >= totalPages - 1, onMove));
}


// 지정한 페이지로 이동하는 공통 페이지 버튼을 생성한다.
function createPageButton(label, page, disabled, onMove) {

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'purchase-order-page-button';
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener('click', () => onMove(page));

    return button;
}


// ========== Loading·오류·안내 처리 ==========

function setPurchaseOrderListLoading(loading) {
    searchButton.disabled = loading;
    resetFilterButton.disabled = loading;
    purchaseOrderTableBody.closest('table').classList.toggle('is-loading', loading);
    purchaseOrderMobileList.classList.toggle('is-loading', loading);
}


function setPurchaseOrderDetailLoading(loading) {
    newPurchaseOrderButton.disabled = loading;
    setPurchaseOrderFormLoading(loading);
}


function setPurchaseOrderFormLoading(loading) {

    if (!loading) {
        [purchaseOrderSupplier, purchaseOrderMemo, addPurchaseOrderItemButton, savePurchaseOrderButton,
            deletePurchaseOrderButton, cancelPurchaseOrderButton, resendEmailButton, submitPurchaseOrderButton,
            approvePurchaseOrderButton, orderPurchaseOrderButton].forEach(element => {
            element.disabled = false;
        });

        renderPurchaseOrderItems();
        applyPurchaseOrderDetailAccess();
        return;
    }

    [purchaseOrderSupplier, purchaseOrderMemo, addPurchaseOrderItemButton, savePurchaseOrderButton,
        deletePurchaseOrderButton, cancelPurchaseOrderButton, resendEmailButton, submitPurchaseOrderButton,
        approvePurchaseOrderButton, orderPurchaseOrderButton].forEach(element => {
        element.disabled = true;
    });

    purchaseOrderItemTableBody.querySelectorAll('select, input, button').forEach(element => {
        element.disabled = true;
    });
}


function setActionModalLoading(loading) {
    confirmActionButton.disabled = loading;
    cancelActionModalButton.disabled = loading;
    closeActionModalButton.disabled = loading;
}


function setCancelModalLoading(loading) {
    confirmCancelButton.disabled = loading;
    cancelCancelModalButton.disabled = loading;
    closeCancelModalButton.disabled = loading;
    cancelReason.disabled = loading;
    supplierCancelConfirmed.disabled = loading;
}


function showPageError(message) {
    purchaseOrderPageError.classList.remove('is-notice');
    purchaseOrderPageError.textContent = message;
    purchaseOrderPageError.hidden = false;
}


function clearPageError() {
    purchaseOrderPageError.classList.remove('is-notice');
    purchaseOrderPageError.textContent = '';
    purchaseOrderPageError.hidden = true;
}


function showPurchaseOrderFormError(message) {
    purchaseOrderFormError.textContent = message;
    purchaseOrderFormError.hidden = false;
    purchaseOrderFormNotice.hidden = true;
}


function showPurchaseOrderFormNotice(message) {
    purchaseOrderFormNotice.textContent = message;
    purchaseOrderFormNotice.hidden = false;
    purchaseOrderFormError.hidden = true;
}


// 삭제 후 상세 Form이 없을 때 완료 결과를 화면 전체 안내 영역에 표시한다.
function showPageNoticeAsErrorFallback(message) {
    purchaseOrderPageError.classList.add('is-notice');
    purchaseOrderPageError.textContent = message;
    purchaseOrderPageError.hidden = false;
}


function clearPurchaseOrderFormMessages() {
    purchaseOrderFormError.textContent = '';
    purchaseOrderFormError.hidden = true;
    purchaseOrderFormNotice.textContent = '';
    purchaseOrderFormNotice.hidden = true;
}


function showActionModalError(message) {
    actionModalError.textContent = message;
    actionModalError.hidden = false;
}


function clearActionModalError() {
    actionModalError.textContent = '';
    actionModalError.hidden = true;
}


function showCancelModalError(message) {
    cancelModalError.textContent = message;
    cancelModalError.hidden = false;
}


function clearCancelModalError() {
    cancelModalError.textContent = '';
    cancelModalError.hidden = true;
}


function handleUnauthorized(error) {

    if (error?.status !== 401) {
        return false;
    }

    window.location.replace('./login.html');
    return true;
}


function handlePageError(error, fallbackMessage) {

    if (handleUnauthorized(error)) {
        return;
    }

    showPageError(error ? getApiErrorMessage(error) : fallbackMessage);
}


// ========== 화면 상태·Mobile Panel ==========

function resetPurchaseOrderFilterValues() {
    statusFilter.value = '';
    emailStatusFilter.value = '';
    supplierFilter.value = '';
    startDateFilter.value = '';
    endDateFilter.value = '';
}


function isMobile() {
    return window.matchMedia('(max-width: 375px)').matches;
}


function syncDetailVisibility() {

    if (!isMobile()) {
        purchaseOrderDetailSection.hidden = false;
        return;
    }

    purchaseOrderDetailSection.hidden = !mobileDetailOpen;
}


function closeMobileDetailPanel() {
    mobileDetailOpen = false;
    syncDetailVisibility();
}


// ========== Event 연결 ==========

searchButton.addEventListener('click', applyPurchaseOrderFilters);
resetFilterButton.addEventListener('click', resetPurchaseOrderFilters);
newPurchaseOrderButton.addEventListener('click', enterPurchaseOrderCreateMode);
purchaseOrderDetailForm.addEventListener('submit', handlePurchaseOrderSubmit);
addPurchaseOrderItemButton.addEventListener('click', addPurchaseOrderItem);
closeDetailButton.addEventListener('click', closeMobileDetailPanel);

purchaseOrderSupplier.addEventListener('change', async () => {
    clearPurchaseOrderFormMessages();
    purchaseOrderItemRows = [];
    supplierEmailValue.textContent = suppliers.find(supplier => supplier.supplierId === Number(purchaseOrderSupplier.value))?.email ?? '-';

    try {
        await loadAvailableSupplierItems(Number(purchaseOrderSupplier.value));
        renderPurchaseOrderItems();
        renderPurchaseOrderTotals();
        applyPurchaseOrderDetailAccess();
    } catch (error) {
        handlePageError(error, '공급업체의 취급 품목을 불러오지 못했습니다.');
    }
});

deletePurchaseOrderButton.addEventListener('click', () => openActionModal('delete'));
submitPurchaseOrderButton.addEventListener('click', () => openActionModal('submit'));
approvePurchaseOrderButton.addEventListener('click', () => openActionModal('approve'));
orderPurchaseOrderButton.addEventListener('click', () => openActionModal('order'));
resendEmailButton.addEventListener('click', () => openActionModal('resend'));
cancelPurchaseOrderButton.addEventListener('click', openCancelModal);

actionModalForm.addEventListener('submit', handleActionModalSubmit);
closeActionModalButton.addEventListener('click', closeActionModal);
cancelActionModalButton.addEventListener('click', closeActionModal);

cancelModalForm.addEventListener('submit', handleCancelModalSubmit);
closeCancelModalButton.addEventListener('click', closeCancelModal);
cancelCancelModalButton.addEventListener('click', closeCancelModal);
cancelReason.addEventListener('input', updateCancelReasonLength);

actionModalBackdrop.addEventListener('click', event => {
    if (event.target === actionModalBackdrop && !confirmActionButton.disabled) closeActionModal();
});

cancelModalBackdrop.addEventListener('click', event => {
    if (event.target === cancelModalBackdrop && !confirmCancelButton.disabled) closeCancelModal();
});

document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!actionModalBackdrop.hidden && !confirmActionButton.disabled) closeActionModal();
    if (!cancelModalBackdrop.hidden && !confirmCancelButton.disabled) closeCancelModal();
});

window.addEventListener('resize', syncDetailVisibility);


// 발주 관리 화면 초기화를 시작한다.
initialize();
