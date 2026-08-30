// ********** 입고 관리 화면의 목록·상세·등록·창고 변경·검수·완료·취소와 역할별 UI를 담당 **********

import { api, getApiErrorMessage } from './api.js';
import { hasRole } from './auth.js';
import { initializeCommonLayout } from './common-layout.js';


// 기준정보 선택 항목을 조회할 때 Server의 고정 페이지를 마지막 페이지까지 순회한다.
const MAX_REFERENCE_PAGES = 1000;


// 현재 로그인 사용자의 입고 등록·검수·완료·취소 처리 권한
let canManageReceipt = false;


// 신규 등록과 창고 변경에 사용하는 발주·창고 기준정보
let availablePurchaseOrders = [];
let activeWarehouses = [];


// 현재 조회된 입고 목록·페이지와 선택 상세정보
let receipts = [];
let receiptPageMeta = null;
let selectedReceipt = null;
let receiptItemRows = [];
let inspectionDirty = false;


// Mobile 상세 Panel과 Modal의 중복 요청 방지 상태
let mobileDetailOpen = false;
let actionLoading = false;


// ========== 목록·검색 Element ==========

const receiptPageError = document.querySelector('#receiptPageError');
const purchaseOrderFilter = document.querySelector('#purchaseOrderFilter');
const statusFilter = document.querySelector('#statusFilter');
const startDateFilter = document.querySelector('#startDateFilter');
const endDateFilter = document.querySelector('#endDateFilter');
const searchButton = document.querySelector('#searchButton');
const resetFilterButton = document.querySelector('#resetFilterButton');
const newReceiptButton = document.querySelector('#newReceiptButton');
const receiptCount = document.querySelector('#receiptCount');
const receiptTable = document.querySelector('.receipt-table');
const receiptTableBody = document.querySelector('#receiptTableBody');
const receiptMobileList = document.querySelector('#receiptMobileList');
const receiptPagination = document.querySelector('#receiptPagination');


// ========== 상세·검수 Element ==========

const receiptDetailSection = document.querySelector('#receiptDetailSection');
const receiptDetailMode = document.querySelector('#receiptDetailMode');
const closeDetailButton = document.querySelector('#closeDetailButton');
const receiptDetailEmpty = document.querySelector('#receiptDetailEmpty');
const receiptDetailForm = document.querySelector('#receiptDetailForm');
const receiptStatusBadge = document.querySelector('#receiptStatusBadge');
const receiptIdValue = document.querySelector('#receiptIdValue');
const purchaseOrderIdValue = document.querySelector('#purchaseOrderIdValue');
const purchaseOrderStatusValue = document.querySelector('#purchaseOrderStatusValue');
const supplierValue = document.querySelector('#supplierValue');
const createdAtValue = document.querySelector('#createdAtValue');
const inspectionStartedAtValue = document.querySelector('#inspectionStartedAtValue');
const completedAtValue = document.querySelector('#completedAtValue');
const purchaseVoucherIdValue = document.querySelector('#purchaseVoucherIdValue');
const receiptWarehouse = document.querySelector('#receiptWarehouse');
const saveWarehouseButton = document.querySelector('#saveWarehouseButton');
const receiptItemList = document.querySelector('#receiptItemList');
const createdActionValue = document.querySelector('#createdActionValue');
const inspectionStartedActionValue = document.querySelector('#inspectionStartedActionValue');
const completedActionValue = document.querySelector('#completedActionValue');
const canceledActionValue = document.querySelector('#canceledActionValue');
const cancelReasonValue = document.querySelector('#cancelReasonValue');
const remainderActionValue = document.querySelector('#remainderActionValue');
const remainderReasonValue = document.querySelector('#remainderReasonValue');
const receiptFormNotice = document.querySelector('#receiptFormNotice');
const receiptFormError = document.querySelector('#receiptFormError');
const cancelReceiptButton = document.querySelector('#cancelReceiptButton');
const startInspectionButton = document.querySelector('#startInspectionButton');
const saveInspectionButton = document.querySelector('#saveInspectionButton');
const completeReceiptButton = document.querySelector('#completeReceiptButton');


// ========== 신규 입고 Modal Element ==========

const createModalBackdrop = document.querySelector('#createModalBackdrop');
const createModalForm = document.querySelector('#createModalForm');
const createPurchaseOrder = document.querySelector('#createPurchaseOrder');
const createWarehouse = document.querySelector('#createWarehouse');
const createModalError = document.querySelector('#createModalError');
const closeCreateModalButton = document.querySelector('#closeCreateModalButton');
const cancelCreateModalButton = document.querySelector('#cancelCreateModalButton');
const confirmCreateButton = document.querySelector('#confirmCreateButton');


// ========== 검수 시작 확인 Modal Element ==========

const actionModalBackdrop = document.querySelector('#actionModalBackdrop');
const actionModalForm = document.querySelector('#actionModalForm');
const actionModalTarget = document.querySelector('#actionModalTarget');
const actionModalCurrentValue = document.querySelector('#actionModalCurrentValue');
const actionModalNextValue = document.querySelector('#actionModalNextValue');
const actionModalDescription = document.querySelector('#actionModalDescription');
const actionModalError = document.querySelector('#actionModalError');
const closeActionModalButton = document.querySelector('#closeActionModalButton');
const cancelActionModalButton = document.querySelector('#cancelActionModalButton');
const confirmActionButton = document.querySelector('#confirmActionButton');


// ========== 입고 완료 Modal Element ==========

const completeModalBackdrop = document.querySelector('#completeModalBackdrop');
const completeModalForm = document.querySelector('#completeModalForm');
const completeModalTarget = document.querySelector('#completeModalTarget');
const completeActualQuantity = document.querySelector('#completeActualQuantity');
const completeNormalQuantity = document.querySelector('#completeNormalQuantity');
const completeRejectedQuantity = document.querySelector('#completeRejectedQuantity');
const completeRemainingQuantity = document.querySelector('#completeRemainingQuantity');
const remainderActionFieldset = document.querySelector('#remainderActionFieldset');
const closeRemainderOption = document.querySelector('#closeRemainderOption');
const cancelPurchaseOrderOption = document.querySelector('#cancelPurchaseOrderOption');
const remainderReasonField = document.querySelector('#remainderReasonField');
const remainderReasonLabel = document.querySelector('#remainderReasonLabel');
const remainderReason = document.querySelector('#remainderReason');
const remainderReasonLength = document.querySelector('#remainderReasonLength');
const supplierCancelConfirmedField = document.querySelector('#supplierCancelConfirmedField');
const supplierCancelConfirmed = document.querySelector('#supplierCancelConfirmed');
const completeModalGuide = document.querySelector('#completeModalGuide');
const completeModalError = document.querySelector('#completeModalError');
const closeCompleteModalButton = document.querySelector('#closeCompleteModalButton');
const cancelCompleteModalButton = document.querySelector('#cancelCompleteModalButton');
const confirmCompleteButton = document.querySelector('#confirmCompleteButton');


// ========== 입고 취소 Modal Element ==========

const cancelModalBackdrop = document.querySelector('#cancelModalBackdrop');
const cancelModalForm = document.querySelector('#cancelModalForm');
const cancelModalTarget = document.querySelector('#cancelModalTarget');
const cancelModalCurrentValue = document.querySelector('#cancelModalCurrentValue');
const cancelReason = document.querySelector('#cancelReason');
const cancelReasonLength = document.querySelector('#cancelReasonLength');
const cancelModalError = document.querySelector('#cancelModalError');
const closeCancelModalButton = document.querySelector('#closeCancelModalButton');
const cancelCancelModalButton = document.querySelector('#cancelCancelModalButton');
const confirmCancelButton = document.querySelector('#confirmCancelButton');


// ========== 화면 초기화 ==========

// 공통 Layout과 역할별 기능 범위를 초기화한 뒤 창고 기준정보와 입고 목록을 조회한다.
async function initialize() {

    try {
        const currentUser = await initializeCommonLayout({
            pageTitle: '입고 관리',
            activeMenu: 'receipts',
            onError: showPageError
        });

        if (!currentUser) return;

        applyRoleAccess();
        await loadActiveWarehouses();
        await loadReceipts(0);
        await applyDefaultReceiptDetailState();

    } catch (error) {
        handlePageError(error, '입고 관리 화면을 초기화하지 못했습니다.');
    }
}


// ADMIN·WAREHOUSE는 입고를 처리하고 OFFICE는 목록과 상세정보만 조회하도록 적용한다.
function applyRoleAccess() {
    canManageReceipt = hasRole('ADMIN', 'WAREHOUSE');
    newReceiptButton.hidden = !canManageReceipt;
}


// ========== 기준정보 조회 ==========

// 창고가 비활성화되기 전에 생성된 입고도 표시할 수 있도록 ACTIVE 창고 목록을 기본 기준정보로 조회한다.
async function loadActiveWarehouses() {
    activeWarehouses = await loadAllPages('/warehouses?status=ACTIVE');
    renderWarehouseOptions();
}


// 신규 입고 Modal에 표시할 ORDERED 발주 중 아직 입고할 잔여 수량이 있는 발주만 조회한다.
async function loadAvailablePurchaseOrders() {
    const orderedPurchaseOrders = await loadAllPages('/purchase-orders?status=ORDERED');

    availablePurchaseOrders = orderedPurchaseOrders.filter(purchaseOrder =>
        toNumber(purchaseOrder.totalRemainingQuantity) > 0
    );

    renderCreatePurchaseOrderOptions();
}


// Server가 페이지당 건수를 고정한 기준정보 API를 마지막 페이지까지 안전하게 조회한다.
async function loadAllPages(basePath) {
    const loaded = [];
    let page = 0;
    let totalPages = 1;

    do {
        const separator = basePath.includes('?') ? '&' : '?';
        const response = await api.get(`${basePath}${separator}page=${page}`);

        loaded.push(...(response.data ?? []));
        totalPages = response.meta?.totalPages ?? 1;
        page += 1;
    } while (page < totalPages && page < MAX_REFERENCE_PAGES);

    return loaded;
}


// 신규 등록과 상세 창고 변경 Select에 ACTIVE 창고를 같은 순서로 표시한다.
function renderWarehouseOptions() {
    createWarehouse.innerHTML = '<option value="">창고 선택</option>';
    receiptWarehouse.innerHTML = '<option value="">창고 선택</option>';

    activeWarehouses.forEach(warehouse => {
        createWarehouse.append(createOption(warehouse.warehouseId, `${warehouse.warehouseCode} · ${warehouse.warehouseName}`));
        receiptWarehouse.append(createOption(warehouse.warehouseId, `${warehouse.warehouseCode} · ${warehouse.warehouseName}`));
    });
}


// 현재 상세의 창고가 비활성화되어 ACTIVE 목록에서 제외되었어도 저장된 값을 계속 표시한다.
function ensureSelectedWarehouseOption() {
    if (!selectedReceipt) return;

    const exists = Array.from(receiptWarehouse.options)
        .some(option => option.value === String(selectedReceipt.warehouseId));

    if (!exists) {
        receiptWarehouse.append(createOption(
            selectedReceipt.warehouseId,
            `${selectedReceipt.warehouseCode} · ${selectedReceipt.warehouseName} (사용 중지)`
        ));
    }
}


// 신규 입고 대상 발주를 공급업체와 잔여 수량을 함께 확인할 수 있도록 표시한다.
function renderCreatePurchaseOrderOptions() {
    createPurchaseOrder.innerHTML = '<option value="">발주 선택</option>';

    availablePurchaseOrders.forEach(purchaseOrder => {
        const label = `${formatPurchaseOrderNumber(purchaseOrder.purchaseOrderId)} · ${purchaseOrder.supplierName} · 잔여 ${formatQuantity(purchaseOrder.totalRemainingQuantity)}`;
        createPurchaseOrder.append(createOption(purchaseOrder.purchaseOrderId, label));
    });
}


// Select에 사용할 Option을 안전한 textContent 방식으로 생성한다.
function createOption(value, label) {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = label;
    return option;
}


// ========== 입고 목록 조회 ==========

// 화면 검색 조건을 실제 입고 목록 API의 Query Parameter로 변환한다.
function createReceiptListPath(page) {
    const parameters = new URLSearchParams({ page: String(page) });

    if (purchaseOrderFilter.value.trim()) parameters.set('purchaseOrderId', purchaseOrderFilter.value.trim());
    if (statusFilter.value) parameters.set('status', statusFilter.value);
    if (startDateFilter.value) parameters.set('startDate', startDateFilter.value);
    if (endDateFilter.value) parameters.set('endDate', endDateFilter.value);

    return `/receipts?${parameters.toString()}`;
}


// 지정 페이지의 입고 목록을 조회하고 PC·Mobile 목록과 페이지 정보를 함께 갱신한다.
async function loadReceipts(page) {
    setReceiptListLoading(true);

    try {
        const response = await api.get(createReceiptListPath(page));

        receipts = response.data ?? [];
        receiptPageMeta = response.meta ?? null;

        renderReceiptCount();
        renderReceiptTable();
        renderReceiptMobileList();
        renderReceiptPagination();
        renderSelectedReceipt();

    } finally {
        setReceiptListLoading(false);
    }
}


// 검색 결과 전체 입고 건수를 한 줄로 표시한다.
function renderReceiptCount() {
    receiptCount.textContent = `총 ${receiptPageMeta?.totalElements ?? 0}건`;
}


// PC·Tablet 입고 목록을 Table로 출력한다.
function renderReceiptTable() {
    receiptTableBody.innerHTML = '';

    if (receipts.length === 0) {
        receiptTableBody.innerHTML = '<tr><td colspan="8" class="receipt-empty-cell">조회된 입고가 없습니다.</td></tr>';
        return;
    }

    receipts.forEach(receipt => {
        const row = document.createElement('tr');

        row.dataset.receiptId = String(receipt.receiptId);
        row.innerHTML = `
            <td><span class="receipt-number">${escapeHtml(formatReceiptNumber(receipt.receiptId))}</span></td>
            <td>${escapeHtml(formatPurchaseOrderNumber(receipt.purchaseOrderId))}</td>
            <td><span class="receipt-supplier-name">${escapeHtml(receipt.supplierName)}</span><span class="receipt-supplier-code">${escapeHtml(receipt.supplierCode)}</span></td>
            <td><span class="receipt-warehouse-name">${escapeHtml(receipt.warehouseName)}</span><span class="receipt-warehouse-code">${escapeHtml(receipt.warehouseCode)}</span></td>
            <td>${createReceiptStatusBadge(receipt.status)}</td>
            <td>${formatDateTime(receipt.createdAt)}</td>
            <td>${formatDateTime(receipt.inspectionStartedAt)}</td>
            <td>${formatDateTime(receipt.completedAt)}</td>
        `;

        row.addEventListener('click', () => selectReceipt(receipt.receiptId));
        receiptTableBody.append(row);
    });
}


// Mobile 입고 목록을 핵심 상태와 공급업체·창고가 보이는 Card로 출력한다.
function renderReceiptMobileList() {
    receiptMobileList.innerHTML = '';

    if (receipts.length === 0) {
        receiptMobileList.innerHTML = '<p class="receipt-mobile-empty">조회된 입고가 없습니다.</p>';
        return;
    }

    receipts.forEach(receipt => {
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'receipt-mobile-item';
        button.dataset.receiptId = String(receipt.receiptId);
        button.innerHTML = `
            <span class="receipt-mobile-top"><strong class="receipt-mobile-number">${escapeHtml(formatReceiptNumber(receipt.receiptId))}</strong>${createReceiptStatusBadge(receipt.status)}</span>
            <span class="receipt-mobile-supplier">${escapeHtml(receipt.supplierName)} · ${escapeHtml(receipt.supplierCode)}</span>
            <span class="receipt-mobile-row"><span class="receipt-mobile-label">발주</span><strong class="receipt-mobile-value">${escapeHtml(formatPurchaseOrderNumber(receipt.purchaseOrderId))}</strong></span>
            <span class="receipt-mobile-row"><span class="receipt-mobile-label">입고 창고</span><strong class="receipt-mobile-value">${escapeHtml(receipt.warehouseCode)} · ${escapeHtml(receipt.warehouseName)}</strong></span>
            <span class="receipt-mobile-bottom"><span class="receipt-mobile-label">등록 일시</span><span class="receipt-mobile-date">${formatDateTime(receipt.createdAt)}</span></span>
        `;

        button.addEventListener('click', () => selectReceipt(receipt.receiptId));
        receiptMobileList.append(button);
    });
}


// Server 페이지 정보로 입고 목록의 이전·번호·다음 버튼을 출력한다.
function renderReceiptPagination() {
    renderPagination(receiptPagination, receiptPageMeta, async page => {
        clearPageError();

        try {
            await loadReceipts(page);
            await applyDefaultReceiptDetailState();
        } catch (error) {
            handlePageError(error, '입고 목록을 불러오지 못했습니다.');
        }
    });
}


// 등록 시작일이 종료일보다 늦거나 발주 번호가 올바르지 않은 검색 요청을 차단한다.
function validateReceiptFilters() {
    const purchaseOrderId = purchaseOrderFilter.value.trim();

    if (purchaseOrderId && (!Number.isInteger(Number(purchaseOrderId)) || Number(purchaseOrderId) <= 0)) {
        showPageError('발주 번호는 1 이상의 정수로 입력해 주세요.');
        purchaseOrderFilter.focus();
        return false;
    }

    if (startDateFilter.value && endDateFilter.value && startDateFilter.value > endDateFilter.value) {
        showPageError('등록 시작일은 등록 종료일보다 늦을 수 없습니다.');
        startDateFilter.focus();
        return false;
    }

    return true;
}


// 현재 검색 조건으로 입고 목록 첫 페이지를 다시 조회한다.
async function applyReceiptFilters() {
    clearPageError();
    if (!validateReceiptFilters()) return;

    try {
        await loadReceipts(0);
        await applyDefaultReceiptDetailState();
    } catch (error) {
        handlePageError(error, '입고 목록을 불러오지 못했습니다.');
    }
}


// 모든 검색 조건을 비우고 입고 목록 첫 페이지를 조회한다.
async function resetReceiptFilters() {
    purchaseOrderFilter.value = '';
    statusFilter.value = '';
    startDateFilter.value = '';
    endDateFilter.value = '';
    await applyReceiptFilters();
}


// ========== 입고 상세 조회 ==========

// 선택 입고의 최신 상세정보를 조회하여 검수 품목과 화면 상태를 갱신한다.
async function selectReceipt(receiptId) {
    clearPageError();
    clearReceiptFormMessages();
    setReceiptDetailLoading(true);

    try {
        const response = await api.get(`/receipts/${receiptId}`);
        selectedReceipt = response.data;
        receiptItemRows = createReceiptItemRows(selectedReceipt.items ?? []);
        inspectionDirty = false;
        mobileDetailOpen = isMobile();

        renderReceiptDetail();
        renderSelectedReceipt();
        syncDetailVisibility();

    } catch (error) {
        handlePageError(error, '입고 상세정보를 불러오지 못했습니다.');
    } finally {
        setReceiptDetailLoading(false);
    }
}


// PC·Tablet에서는 첫 입고를 기본 선택하고 Mobile에서는 목록을 먼저 유지한다.
async function applyDefaultReceiptDetailState() {
    if (!isMobile() && receipts.length > 0) {
        await selectReceipt(receipts[0].receiptId);
        return;
    }

    clearReceiptDetail();
}


// 상세 DTO의 품목·LOT를 화면 입력 상태로 복사하여 Server 응답 객체를 직접 변경하지 않는다.
function createReceiptItemRows(items) {
    return items.map(item => ({
        ...item,
        actualQuantity: normalizeQuantityValue(item.actualQuantity),
        normalQuantity: normalizeQuantityValue(item.normalQuantity),
        rejectedQuantity: normalizeQuantityValue(item.rejectedQuantity),
        note: item.note ?? '',
        lots: (item.lots ?? []).map((lot, lotIndex) => ({
            ...lot,
            clientKey: `${item.receiptItemId}-${lot.receiptLotId ?? lotIndex}-${Date.now()}`,
            supplierLotNumber: lot.supplierLotNumber ?? '',
            expiryDate: lot.expiryDate ?? '',
            normalQuantity: normalizeQuantityValue(lot.normalQuantity)
        }))
    }));
}


// 선택한 입고의 요약·창고·검수 품목·처리 이력과 현재 가능한 버튼을 출력한다.
function renderReceiptDetail() {
    if (!selectedReceipt) {
        clearReceiptDetail();
        return;
    }

    receiptDetailEmpty.hidden = true;
    receiptDetailForm.hidden = false;
    receiptDetailMode.textContent = '발주 품목의 실제·정상·불합격 수량과 정상 LOT를 확인하거나 처리할 수 있습니다.';

    setReceiptStatusBadge(selectedReceipt.status);
    receiptIdValue.textContent = formatReceiptNumber(selectedReceipt.receiptId);
    purchaseOrderIdValue.textContent = formatPurchaseOrderNumber(selectedReceipt.purchaseOrderId);
    purchaseOrderStatusValue.textContent = getPurchaseOrderStatusLabel(selectedReceipt.purchaseOrderStatus);
    supplierValue.textContent = `${selectedReceipt.supplierCode} · ${selectedReceipt.supplierName}`;
    createdAtValue.textContent = formatDateTime(selectedReceipt.created?.processedAt);
    inspectionStartedAtValue.textContent = formatDateTime(selectedReceipt.inspectionStarted?.processedAt);
    completedAtValue.textContent = formatDateTime(selectedReceipt.completed?.processedAt);
    purchaseVoucherIdValue.textContent = selectedReceipt.purchaseVoucherId ? `VCH-${selectedReceipt.purchaseVoucherId}` : '-';

    ensureSelectedWarehouseOption();
    receiptWarehouse.value = String(selectedReceipt.warehouseId);

    renderReceiptItems();
    renderReceiptActionHistory();
    applyReceiptActionAccess();
}


// 선택 입고가 없는 상태로 상세 영역과 입력 상태를 초기화한다.
function clearReceiptDetail() {
    selectedReceipt = null;
    receiptItemRows = [];
    inspectionDirty = false;
    mobileDetailOpen = false;
    receiptDetailEmpty.hidden = false;
    receiptDetailForm.hidden = true;
    receiptDetailMode.textContent = '입고를 선택하면 검수 정보와 처리 상태를 확인할 수 있습니다.';
    clearReceiptFormMessages();
    renderSelectedReceipt();
    syncDetailVisibility();
}


// PC Table과 Mobile Card에서 현재 선택한 입고를 같은 강조 상태로 표시한다.
function renderSelectedReceipt() {
    document.querySelectorAll('[data-receipt-id]').forEach(element => {
        element.classList.toggle(
            'is-selected',
            selectedReceipt !== null && Number(element.dataset.receiptId) === selectedReceipt.receiptId
        );
    });
}


// 상세 DTO의 처리자와 처리 일시를 한 줄로 표시한다.
function renderReceiptActionHistory() {
    createdActionValue.textContent = formatAction(selectedReceipt.created);
    inspectionStartedActionValue.textContent = formatAction(selectedReceipt.inspectionStarted);
    completedActionValue.textContent = formatAction(selectedReceipt.completed);
    canceledActionValue.textContent = formatAction(selectedReceipt.canceled);
    cancelReasonValue.textContent = selectedReceipt.cancelReason || '-';
    remainderActionValue.textContent = getRemainderActionLabel(selectedReceipt.remainderAction);
    remainderReasonValue.textContent = selectedReceipt.remainderReason || '-';
}


// 역할과 PENDING·INSPECTING 상태에 따라 창고와 검수 처리 Button의 표시 범위를 적용한다.
function applyReceiptActionAccess() {
    const pending = selectedReceipt?.status === 'PENDING';
    const inspecting = selectedReceipt?.status === 'INSPECTING';

    receiptWarehouse.disabled = !canManageReceipt || !pending;
    saveWarehouseButton.hidden = !canManageReceipt || !pending;
    startInspectionButton.hidden = !canManageReceipt || !pending;
    saveInspectionButton.hidden = !canManageReceipt || !inspecting;
    completeReceiptButton.hidden = !canManageReceipt || !inspecting;
    cancelReceiptButton.hidden = !canManageReceipt || !(pending || inspecting);
}


// ========== 품목 검수·LOT 화면 ==========

// 입고 품목을 수량 입력과 품목별 다중 LOT Card로 출력한다.
function renderReceiptItems() {
    receiptItemList.innerHTML = '';

    if (receiptItemRows.length === 0) {
        receiptItemList.innerHTML = '<p class="receipt-item-empty">입고 품목이 없습니다.</p>';
        return;
    }

    const editable = canManageReceipt && selectedReceipt.status === 'INSPECTING';

    receiptItemRows.forEach((item, itemIndex) => {
        const article = document.createElement('article');

        article.className = 'receipt-item-card';
        article.dataset.itemIndex = String(itemIndex);
        article.innerHTML = `
            <div class="receipt-item-header">
                <div class="receipt-item-title"><span>${item.lineNo}번</span><strong>${escapeHtml(item.itemCode)} · ${escapeHtml(item.itemName)}</strong></div>
                <span class="receipt-item-unit">${escapeHtml(getItemUnitLabel(item.unit, item.otherUnitName))}</span>
            </div>
            <div class="receipt-quantity-grid">
                ${createQuantityValueField('발주 수량', item.orderedQuantity)}
                ${createQuantityValueField('누적 정상 입고', item.cumulativeReceivedQuantity)}
                ${createQuantityValueField('입고 전 잔여', item.remainingQuantity)}
                ${createQuantityInputField(itemIndex, 'actualQuantity', '실제 수량', item.actualQuantity, editable)}
                ${createQuantityInputField(itemIndex, 'normalQuantity', '정상 수량', item.normalQuantity, editable)}
                ${createQuantityInputField(itemIndex, 'rejectedQuantity', '불합격 수량', item.rejectedQuantity, editable)}
            </div>
            <label class="receipt-item-note"><span>검수 메모</span><textarea class="receipt-item-input" data-item-index="${itemIndex}" data-item-field="note" maxlength="1000" ${editable ? '' : 'disabled'}>${escapeHtml(item.note)}</textarea></label>
            <section class="receipt-lot-section">
                <div class="receipt-lot-header"><h4>정상 입고 LOT</h4><button type="button" class="button button-secondary receipt-lot-add" data-add-lot="${itemIndex}" ${editable ? '' : 'hidden'}>LOT 추가</button></div>
                <div class="receipt-lot-list">${createLotRowsHtml(item, itemIndex, editable)}</div>
            </section>
        `;

        receiptItemList.append(article);
    });
}


// 발주·누적·잔여처럼 수정할 수 없는 수량을 공통 형태로 생성한다.
function createQuantityValueField(label, value) {
    return `<div class="receipt-quantity-field"><span>${label}</span><strong class="receipt-quantity-value">${formatQuantity(value)}</strong></div>`;
}


// 실제·정상·불합격 수량 입력을 동일한 정밀도와 최소값으로 생성한다.
function createQuantityInputField(itemIndex, field, label, value, editable) {
    return `
        <label class="receipt-quantity-field">
            <span>${label}</span>
            <input type="number" class="receipt-item-input" data-item-index="${itemIndex}" data-item-field="${field}" min="0" step="0.001" value="${escapeHtml(value)}" ${editable ? '' : 'disabled'}>
        </label>
    `;
}


// 품목 정상 수량을 구성하는 공급업체 LOT·사용기한·수량과 완료 후 내부 LOT를 출력한다.
function createLotRowsHtml(item, itemIndex, editable) {
    if (item.lots.length === 0) {
        return '<p class="receipt-lot-empty">등록된 정상 입고 LOT가 없습니다.</p>';
    }

    return item.lots.map((lot, lotIndex) => `
        <div class="receipt-lot-row">
            <label class="receipt-lot-field"><span>공급업체 LOT</span><input type="text" class="receipt-lot-input" data-item-index="${itemIndex}" data-lot-index="${lotIndex}" data-lot-field="supplierLotNumber" maxlength="100" value="${escapeHtml(lot.supplierLotNumber)}" ${editable ? '' : 'disabled'}></label>
            <label class="receipt-lot-field"><span>사용기한 *</span><input type="date" class="receipt-lot-input" data-item-index="${itemIndex}" data-lot-index="${lotIndex}" data-lot-field="expiryDate" value="${escapeHtml(lot.expiryDate)}" ${editable ? '' : 'disabled'}></label>
            <label class="receipt-lot-field"><span>정상 수량 *</span><input type="number" class="receipt-lot-input" data-item-index="${itemIndex}" data-lot-index="${lotIndex}" data-lot-field="normalQuantity" min="0.001" step="0.001" value="${escapeHtml(lot.normalQuantity)}" ${editable ? '' : 'disabled'}></label>
            <div class="receipt-lot-field"><span>적용 LOT</span><strong class="receipt-lot-internal-value">${escapeHtml(lot.lotNumber || '-')}</strong></div>
            <button type="button" class="receipt-lot-remove" data-remove-lot-item="${itemIndex}" data-remove-lot-index="${lotIndex}" aria-label="LOT 삭제" ${editable ? '' : 'hidden'}>×</button>
        </div>
    `).join('');
}


// 품목 입력 변경을 화면 상태에 즉시 반영하고 저장 전 변경 여부를 기록한다.
function handleReceiptItemInput(event) {
    const target = event.target;
    const itemIndex = Number(target.dataset.itemIndex);

    if (!Number.isInteger(itemIndex) || !receiptItemRows[itemIndex]) return;

    if (target.dataset.itemField) {
        receiptItemRows[itemIndex][target.dataset.itemField] = target.value;
        markInspectionDirty();
        return;
    }

    const lotIndex = Number(target.dataset.lotIndex);

    if (target.dataset.lotField && Number.isInteger(lotIndex) && receiptItemRows[itemIndex].lots[lotIndex]) {
        receiptItemRows[itemIndex].lots[lotIndex][target.dataset.lotField] = target.value;
        markInspectionDirty();
    }
}


// LOT 추가·삭제 Button을 Event Delegation으로 처리한다.
function handleReceiptItemClick(event) {
    const addButton = event.target.closest('[data-add-lot]');
    const removeButton = event.target.closest('[data-remove-lot-item]');

    if (addButton) {
        addReceiptLot(Number(addButton.dataset.addLot));
        return;
    }

    if (removeButton) {
        removeReceiptLot(Number(removeButton.dataset.removeLotItem), Number(removeButton.dataset.removeLotIndex));
    }
}


// 선택 품목에 빈 LOT 입력 행을 추가한다.
function addReceiptLot(itemIndex) {
    const item = receiptItemRows[itemIndex];
    if (!item) return;

    item.lots.push({
        clientKey: `${item.receiptItemId}-new-${Date.now()}-${item.lots.length}`,
        supplierLotNumber: '',
        expiryDate: '',
        normalQuantity: '',
        lotNumber: null,
        inventoryLotId: null
    });

    markInspectionDirty();
    renderReceiptItems();
}


// 선택 품목에서 아직 완료되지 않은 LOT 입력 행을 제거한다.
function removeReceiptLot(itemIndex, lotIndex) {
    const item = receiptItemRows[itemIndex];
    if (!item?.lots[lotIndex]) return;

    item.lots.splice(lotIndex, 1);
    markInspectionDirty();
    renderReceiptItems();
}


// 검수 입력이 Server 상세정보와 달라졌음을 표시하여 완료 전 저장을 요구한다.
function markInspectionDirty() {
    inspectionDirty = true;
    showReceiptFormNotice('검수 결과가 변경되었습니다. 입고 완료 전에 검수 저장을 먼저 진행해 주세요.');
}


// ========== 신규 입고 등록 ==========

// 최신 ORDERED 발주를 조회한 뒤 신규 입고 등록 Modal을 연다.
async function openCreateModal() {
    clearPageError();
    clearElementError(createModalError);
    createPurchaseOrder.value = '';
    createWarehouse.value = '';
    setCreateModalLoading(true);
    createModalBackdrop.hidden = false;

    try {
        await loadAvailablePurchaseOrders();

        if (availablePurchaseOrders.length === 0) {
            showElementError(createModalError, '입고할 잔여 수량이 있는 발주 확정 건이 없습니다.');
        }

        createPurchaseOrder.focus();
    } catch (error) {
        showElementError(createModalError, getApiErrorMessage(error));
    } finally {
        setCreateModalLoading(false);
    }
}


// 신규 입고 Modal을 닫고 입력값과 오류를 초기화한다.
function closeCreateModal() {
    if (actionLoading) return;
    createModalBackdrop.hidden = true;
    createModalForm.reset();
    clearElementError(createModalError);
}


// 선택 발주와 창고로 PENDING 입고를 등록하고 새 입고가 위치한 첫 페이지를 조회한다.
async function handleCreateReceipt(event) {
    event.preventDefault();
    clearElementError(createModalError);

    if (!createPurchaseOrder.value) {
        showElementError(createModalError, '입고 대상 발주를 선택해 주세요.');
        createPurchaseOrder.focus();
        return;
    }

    if (!createWarehouse.value) {
        showElementError(createModalError, '입고 창고를 선택해 주세요.');
        createWarehouse.focus();
        return;
    }

    setCreateModalLoading(true);

    try {
        const response = await api.post('/receipts', {
            purchaseOrderId: Number(createPurchaseOrder.value),
            warehouseId: Number(createWarehouse.value)
        });

        const createdReceiptId = response.data.receiptId;

        createModalBackdrop.hidden = true;
        resetReceiptFilterValues();
        await loadReceipts(0);
        await selectReceipt(createdReceiptId);
        showReceiptFormNotice('신규 입고를 등록했습니다. 검수를 시작하기 전 입고 창고를 확인해 주세요.');

    } catch (error) {
        showElementError(createModalError, getApiErrorMessage(error));
    } finally {
        setCreateModalLoading(false);
    }
}


// 신규 입고가 항상 최신 등록 순서의 첫 페이지에 표시되도록 목록 조건만 초기화한다.
function resetReceiptFilterValues() {
    purchaseOrderFilter.value = '';
    statusFilter.value = '';
    startDateFilter.value = '';
    endDateFilter.value = '';
}


// ========== 창고 변경·검수 시작·검수 저장 ==========

// PENDING 입고의 최신 version과 선택 창고를 전달하여 입고 창고를 변경한다.
async function updateReceiptWarehouse() {
    clearReceiptFormMessages();

    if (!selectedReceipt || selectedReceipt.status !== 'PENDING') return;

    if (!receiptWarehouse.value) {
        showReceiptFormError('입고 창고를 선택해 주세요.');
        receiptWarehouse.focus();
        return;
    }

    if (Number(receiptWarehouse.value) === selectedReceipt.warehouseId) {
        showReceiptFormNotice('현재 입고 창고와 동일합니다.');
        return;
    }

    setReceiptDetailLoading(true);

    try {
        const response = await api.patch(`/receipts/${selectedReceipt.receiptId}`, {
            warehouseId: Number(receiptWarehouse.value),
            version: selectedReceipt.version
        });

        applyDetailResponse(response.data);
        await refreshCurrentReceiptList();
        showReceiptFormNotice('입고 창고를 변경했습니다.');

    } catch (error) {
        await handleReceiptActionError(error, '입고 창고를 변경하지 못했습니다.');
    } finally {
        setReceiptDetailLoading(false);
    }
}


// PENDING 입고를 INSPECTING으로 변경할 내용을 공통 상태 비교 Modal에 표시한다.
function openStartInspectionModal() {
    if (!selectedReceipt || selectedReceipt.status !== 'PENDING') return;

    clearElementError(actionModalError);
    actionModalTarget.textContent = formatReceiptNumber(selectedReceipt.receiptId);
    actionModalCurrentValue.textContent = getReceiptStatusLabel(selectedReceipt.status);
    actionModalNextValue.textContent = getReceiptStatusLabel('INSPECTING');
    actionModalDescription.textContent = '검수를 시작하면 입고 창고를 변경할 수 없으며 품목별 실제·정상·불합격 수량과 LOT를 입력할 수 있습니다.';
    confirmActionButton.textContent = '검수 시작';
    actionModalBackdrop.hidden = false;
    confirmActionButton.focus();
}


// 검수 시작 확인 Modal을 닫는다.
function closeActionModal() {
    if (actionLoading) return;
    actionModalBackdrop.hidden = true;
    clearElementError(actionModalError);
}


// 최신 version으로 검수 시작 API를 호출하고 상세·목록을 갱신한다.
async function startInspection(event) {
    event.preventDefault();
    if (!selectedReceipt) return;

    clearElementError(actionModalError);
    setActionModalLoading(true);

    try {
        const response = await api.post(`/receipts/${selectedReceipt.receiptId}/start-inspection`, {
            version: selectedReceipt.version
        });

        actionModalBackdrop.hidden = true;
        applyDetailResponse(response.data);
        await refreshCurrentReceiptList();
        showReceiptFormNotice('입고 검수를 시작했습니다. 품목별 검수 결과와 정상 LOT를 입력해 주세요.');

    } catch (error) {
        if (isVersionConflict(error)) {
            actionModalBackdrop.hidden = true;
            await reloadSelectedReceiptAfterConflict('다른 사용자가 입고 정보를 먼저 변경했습니다. 최신 정보를 다시 불러왔습니다.');
        } else {
            showElementError(actionModalError, getApiErrorMessage(error));
        }
    } finally {
        setActionModalLoading(false);
    }
}


// 품목 수량 관계·잔여 수량·LOT 합계와 사용기한을 저장 전에 검증한다.
function validateInspectionRows() {
    for (const item of receiptItemRows) {
        const actual = toNumber(item.actualQuantity);
        const normal = toNumber(item.normalQuantity);
        const rejected = toNumber(item.rejectedQuantity);
        const remaining = toNumber(item.remainingQuantity);
        const itemLabel = `${item.itemCode} ${item.itemName}`;

        if (!isValidQuantity(item.actualQuantity) || !isValidQuantity(item.normalQuantity) || !isValidQuantity(item.rejectedQuantity)) {
            return `${itemLabel}의 수량은 0 이상이고 소수점 셋째 자리까지 입력해 주세요.`;
        }

        if (!approximatelyEqual(actual, normal + rejected)) {
            return `${itemLabel}의 실제 수량은 정상 수량과 불합격 수량의 합과 같아야 합니다.`;
        }

        if (actual > remaining) {
            return `${itemLabel}의 실제 수량은 입고 전 잔여 수량을 초과할 수 없습니다.`;
        }

        if ((item.note ?? '').length > 1000) {
            return `${itemLabel}의 검수 메모는 1000자 이하로 입력해 주세요.`;
        }

        if (normal > 0 && item.lots.length === 0) {
            return `${itemLabel}의 정상 수량을 구성하는 LOT를 한 개 이상 등록해 주세요.`;
        }

        let lotTotal = 0;

        for (const lot of item.lots) {
            if (!lot.expiryDate) return `${itemLabel} LOT의 사용기한을 입력해 주세요.`;
            if (!isPositiveQuantity(lot.normalQuantity)) return `${itemLabel} LOT의 정상 수량은 0보다 크게 입력해 주세요.`;
            if ((lot.supplierLotNumber ?? '').length > 100) return `${itemLabel}의 공급업체 LOT 번호는 100자 이하로 입력해 주세요.`;
            lotTotal += toNumber(lot.normalQuantity);
        }

        if (!approximatelyEqual(normal, lotTotal)) {
            return `${itemLabel}의 정상 수량은 LOT별 정상 수량 합계와 같아야 합니다.`;
        }
    }

    return null;
}


// 현재 검수 입력값을 Server 요청 DTO 구조로 변환한다.
function createInspectionRequestBody() {
    return {
        items: receiptItemRows.map(item => ({
            receiptItemId: item.receiptItemId,
            actualQuantity: normalizeQuantityRequest(item.actualQuantity),
            normalQuantity: normalizeQuantityRequest(item.normalQuantity),
            rejectedQuantity: normalizeQuantityRequest(item.rejectedQuantity),
            note: normalizeOptionalValue(item.note),
            lots: item.lots.map(lot => ({
                supplierLotNumber: normalizeOptionalValue(lot.supplierLotNumber),
                expiryDate: lot.expiryDate,
                normalQuantity: normalizeQuantityRequest(lot.normalQuantity)
            }))
        })),
        version: selectedReceipt.version
    };
}


// INSPECTING 입고의 품목 검수 결과를 전체 교체 저장한다.
async function saveInspection() {
    clearReceiptFormMessages();
    if (!selectedReceipt || selectedReceipt.status !== 'INSPECTING') return;

    const validationMessage = validateInspectionRows();

    if (validationMessage) {
        showReceiptFormError(validationMessage);
        return;
    }

    setReceiptDetailLoading(true);

    try {
        const response = await api.put(`/receipts/${selectedReceipt.receiptId}/inspection`, createInspectionRequestBody());

        applyDetailResponse(response.data);
        showReceiptFormNotice('입고 검수 결과를 저장했습니다. 저장된 결과를 확인한 뒤 입고 완료를 진행해 주세요.');

    } catch (error) {
        await handleReceiptActionError(error, '입고 검수 결과를 저장하지 못했습니다.');
    } finally {
        setReceiptDetailLoading(false);
    }
}


// 상세 변경 API의 최신 응답을 현재 화면 상태에 반영한다.
function applyDetailResponse(detail) {
    selectedReceipt = detail;
    receiptItemRows = createReceiptItemRows(detail.items ?? []);
    inspectionDirty = false;
    renderReceiptDetail();
    renderSelectedReceipt();
}


// ========== 입고 완료 ==========

// 저장된 검수 결과를 확인하고 잔여 수량에 맞는 완료 선택지를 Modal에 표시한다.
function openCompleteModal() {
    clearReceiptFormMessages();

    if (!selectedReceipt || selectedReceipt.status !== 'INSPECTING') return;

    if (inspectionDirty) {
        showReceiptFormError('변경한 검수 결과를 먼저 저장한 후 입고 완료를 진행해 주세요.');
        return;
    }

    const validationMessage = validateInspectionRows();

    if (validationMessage) {
        showReceiptFormError(validationMessage);
        return;
    }

    const summary = calculateCompletionSummary();

    if (summary.actual === 0) {
        showReceiptFormError('실제 입고 수량이 0이면 입고 완료가 아니라 입고 취소를 진행해 주세요.');
        return;
    }

    completeModalForm.reset();
    clearElementError(completeModalError);
    completeModalTarget.textContent = formatReceiptNumber(selectedReceipt.receiptId);
    completeActualQuantity.textContent = formatQuantity(summary.actual);
    completeNormalQuantity.textContent = formatQuantity(summary.normal);
    completeRejectedQuantity.textContent = formatQuantity(summary.rejected);
    completeRemainingQuantity.textContent = formatQuantity(summary.remaining);
    configureCompletionOptions(summary);
    updateCompletionOptionGuide();
    completeModalBackdrop.hidden = false;
    confirmCompleteButton.focus();
}


// 현재 검수 수량과 기존 누적 정상 입고를 합산하여 완료 후 잔여 수량을 계산한다.
function calculateCompletionSummary() {
    const actual = sumBy(receiptItemRows, item => toNumber(item.actualQuantity));
    const normal = sumBy(receiptItemRows, item => toNumber(item.normalQuantity));
    const rejected = sumBy(receiptItemRows, item => toNumber(item.rejectedQuantity));
    const ordered = sumBy(receiptItemRows, item => toNumber(item.orderedQuantity));
    const cumulative = sumBy(receiptItemRows, item => toNumber(item.cumulativeReceivedQuantity));
    const remaining = Math.max(ordered - cumulative - normal, 0);

    return { actual, normal, rejected, ordered, cumulative, remaining, cumulativeAfter: cumulative + normal };
}


// 전량 입고·부분 입고·전량 불합격에 따라 허용되는 잔여 처리 선택지만 표시한다.
function configureCompletionOptions(summary) {
    const fullyReceived = approximatelyEqual(summary.remaining, 0);
    const allRejectedWithoutPreviousReceipt = summary.cumulativeAfter === 0 && summary.normal === 0 && summary.rejected === summary.actual;

    remainderActionFieldset.hidden = fullyReceived;
    remainderReasonField.hidden = fullyReceived;
    closeRemainderOption.hidden = allRejectedWithoutPreviousReceipt;
    cancelPurchaseOrderOption.hidden = !allRejectedWithoutPreviousReceipt;
    supplierCancelConfirmedField.hidden = true;

    if (fullyReceived) {
        completeModalGuide.textContent = '발주 수량이 모두 정상 입고되어 발주 상태가 전량 입고 완료로 변경됩니다.';
        return;
    }

    const additionalOption = completeModalForm.querySelector('input[value="ADDITIONAL_RECEIPT"]');
    additionalOption.checked = true;

    completeModalGuide.textContent = allRejectedWithoutPreviousReceipt
        ? '정상 입고가 전혀 없는 전량 불합격 건입니다. 추가 입고를 기다리거나 공급업체 확인 후 발주를 취소할 수 있습니다.'
        : '정상 입고 후 남은 수량을 추가로 입고할지, 더 이상 받지 않고 발주를 종료할지 선택해 주세요.';
}


// 완료 Modal 선택에 따라 사유 항목과 공급업체 취소 확인 항목을 전환한다.
function updateCompletionOptionGuide() {
    const selectedAction = getSelectedRemainderAction();
    const cancelingPurchaseOrder = selectedAction === 'CANCEL_PURCHASE_ORDER';

    supplierCancelConfirmedField.hidden = !cancelingPurchaseOrder;
    remainderReasonLabel.textContent = cancelingPurchaseOrder ? '발주 취소 사유 *' : '잔여 처리 사유 *';

    if (remainderActionFieldset.hidden) return;

    if (cancelingPurchaseOrder) {
        completeModalGuide.textContent = '발주서 이메일 전송 성공 건은 실제로 공급업체 취소 확인을 마친 뒤 확인 항목을 선택해야 합니다.';
    } else if (selectedAction === 'CLOSE_REMAINDER') {
        completeModalGuide.textContent = '현재 정상 입고 수량만 반영하고 남은 발주 수량은 더 이상 입고하지 않도록 발주를 종료합니다.';
    } else {
        completeModalGuide.textContent = '현재 정상 수량을 입고 처리하고 남은 발주 수량은 이후 신규 입고 건으로 계속 받을 수 있습니다.';
    }
}


// 입고 완료 Modal을 닫고 임시 선택값을 제거한다.
function closeCompleteModal() {
    if (actionLoading) return;
    completeModalBackdrop.hidden = true;
    completeModalForm.reset();
    clearElementError(completeModalError);
}


// 잔여 처리 방식과 발주 취소 선택을 실제 완료 API 요청 형식으로 변환한다.
function createCompleteRequestBody() {
    const selectedAction = getSelectedRemainderAction();
    const cancelingPurchaseOrder = selectedAction === 'CANCEL_PURCHASE_ORDER';
    const fullyReceived = remainderActionFieldset.hidden;

    return {
        remainderAction: fullyReceived || cancelingPurchaseOrder ? null : selectedAction,
        remainderReason: fullyReceived || cancelingPurchaseOrder ? null : normalizeOptionalValue(remainderReason.value),
        cancelPurchaseOrder: cancelingPurchaseOrder,
        cancelReason: cancelingPurchaseOrder ? normalizeOptionalValue(remainderReason.value) : null,
        supplierCancelConfirmed: cancelingPurchaseOrder ? supplierCancelConfirmed.checked : false,
        version: selectedReceipt.version
    };
}


// 저장된 검수 결과를 재고·변동 이력·발주 누적 수량·매입 전표와 함께 완료 처리한다.
async function completeReceipt(event) {
    event.preventDefault();
    clearElementError(completeModalError);

    const fullyReceived = remainderActionFieldset.hidden;
    const selectedAction = getSelectedRemainderAction();

    if (!fullyReceived && !selectedAction) {
        showElementError(completeModalError, '잔여 수량 처리 방식을 선택해 주세요.');
        return;
    }

    if (!fullyReceived && !remainderReason.value.trim()) {
        showElementError(completeModalError, selectedAction === 'CANCEL_PURCHASE_ORDER' ? '발주 취소 사유를 입력해 주세요.' : '잔여 수량 처리 사유를 입력해 주세요.');
        remainderReason.focus();
        return;
    }

    setCompleteModalLoading(true);

    try {
        const completedReceiptId = selectedReceipt.receiptId;
        await api.post(`/receipts/${completedReceiptId}/complete`, createCompleteRequestBody());

        completeModalBackdrop.hidden = true;
        await refreshCurrentReceiptList();
        await selectReceipt(completedReceiptId);
        showReceiptFormNotice('입고 완료 처리를 반영했습니다. 정상 수량이 있는 품목은 재고·변동 이력과 매입 전표에 함께 반영됩니다.');

    } catch (error) {
        if (isVersionConflict(error)) {
            completeModalBackdrop.hidden = true;
            await reloadSelectedReceiptAfterConflict('다른 사용자가 입고 정보를 먼저 변경했습니다. 최신 정보를 다시 불러왔습니다.');
        } else {
            showElementError(completeModalError, getApiErrorMessage(error));
        }
    } finally {
        setCompleteModalLoading(false);
    }
}


// 완료 Modal에서 선택한 잔여 처리 Radio 값을 반환한다.
function getSelectedRemainderAction() {
    return completeModalForm.querySelector('input[name="remainderAction"]:checked')?.value ?? null;
}


// ========== 입고 취소 ==========

// PENDING·INSPECTING 입고의 현재 상태와 취소 사유 입력 Modal을 연다.
function openCancelModal() {
    if (!selectedReceipt || !['PENDING', 'INSPECTING'].includes(selectedReceipt.status)) return;

    cancelModalForm.reset();
    clearElementError(cancelModalError);
    cancelReasonLength.textContent = '0';
    cancelModalTarget.textContent = formatReceiptNumber(selectedReceipt.receiptId);
    cancelModalCurrentValue.textContent = getReceiptStatusLabel(selectedReceipt.status);
    cancelModalBackdrop.hidden = false;
    cancelReason.focus();
}


// 입고 취소 Modal을 닫고 입력한 사유를 초기화한다.
function closeCancelModal() {
    if (actionLoading) return;
    cancelModalBackdrop.hidden = true;
    cancelModalForm.reset();
    clearElementError(cancelModalError);
}


// 최신 version과 취소 사유로 입고를 취소하고 목록·상세정보를 갱신한다.
async function cancelReceipt(event) {
    event.preventDefault();
    clearElementError(cancelModalError);

    if (!cancelReason.value.trim()) {
        showElementError(cancelModalError, '입고 취소 사유를 입력해 주세요.');
        cancelReason.focus();
        return;
    }

    setCancelModalLoading(true);

    try {
        const response = await api.post(`/receipts/${selectedReceipt.receiptId}/cancel`, {
            reason: cancelReason.value.trim(),
            version: selectedReceipt.version
        });

        cancelModalBackdrop.hidden = true;
        applyDetailResponse(response.data);
        await refreshCurrentReceiptList();
        showReceiptFormNotice('입고를 취소했습니다. 발주의 잔여 입고 수량은 유지됩니다.');

    } catch (error) {
        if (isVersionConflict(error)) {
            cancelModalBackdrop.hidden = true;
            await reloadSelectedReceiptAfterConflict('다른 사용자가 입고 정보를 먼저 변경했습니다. 최신 정보를 다시 불러왔습니다.');
        } else {
            showElementError(cancelModalError, getApiErrorMessage(error));
        }
    } finally {
        setCancelModalLoading(false);
    }
}


// ========== 목록·상세 동기화와 충돌 처리 ==========

// 현재 목록 페이지를 다시 조회하되 선택 상세정보는 유지한다.
async function refreshCurrentReceiptList() {
    const currentPage = receiptPageMeta?.page ?? receiptPageMeta?.number ?? 0;
    await loadReceipts(currentPage);
}


// version 충돌 후 Server의 최신 상세와 현재 목록을 다시 조회한다.
async function reloadSelectedReceiptAfterConflict(message) {
    const receiptId = selectedReceipt?.receiptId;
    if (!receiptId) return;

    try {
        await refreshCurrentReceiptList();
        await selectReceipt(receiptId);
        showReceiptFormError(message);
    } catch (reloadError) {
        handlePageError(reloadError, '최신 입고 정보를 다시 불러오지 못했습니다.');
    }
}


// 상세 변경 요청 오류에서 version 충돌은 최신 재조회하고 그 외 오류는 상세에 표시한다.
async function handleReceiptActionError(error, fallbackMessage) {
    if (isVersionConflict(error)) {
        await reloadSelectedReceiptAfterConflict('다른 사용자가 입고 정보를 먼저 변경했습니다. 최신 정보를 다시 불러왔습니다.');
        return;
    }

    showReceiptFormError(getApiErrorMessage(error) || fallbackMessage);
}


// 409 중 version·동시 수정 의미가 있는 응답만 낙관적 잠금 충돌로 판별한다.
function isVersionConflict(error) {
    if (error?.status !== 409) return false;

    const message = getApiErrorMessage(error).toLowerCase();
    return message.includes('version') || message.includes('최신') || message.includes('수정') || message.includes('변경');
}


// ========== 반응형 상세 Panel ==========

// 현재 Viewport가 Mobile 기준인지 확인한다.
function isMobile() {
    return window.matchMedia('(max-width: 375px)').matches;
}


// Mobile에서는 선택된 상세만 전체 Panel로 열고 PC·Tablet에서는 항상 상세 영역을 유지한다.
function syncDetailVisibility() {
    receiptDetailSection.hidden = isMobile() && !mobileDetailOpen;
}


// Mobile 상세 Panel을 닫고 목록으로 돌아간다.
function closeMobileDetailPanel() {
    if (!isMobile()) return;
    mobileDetailOpen = false;
    syncDetailVisibility();
}


// 화면 크기 변경 시 Mobile 상세 Panel과 PC 상세 영역의 표시 상태를 동기화한다.
function handleWindowResize() {
    if (!isMobile()) mobileDetailOpen = false;
    syncDetailVisibility();
}


// ========== 공통 Loading·오류·Modal 상태 ==========

// 입고 목록 조회 중 중복 검색과 행 선택을 막는다.
function setReceiptListLoading(loading) {
    receiptTable.classList.toggle('is-loading', loading);
    receiptMobileList.classList.toggle('is-loading', loading);
    searchButton.disabled = loading;
    resetFilterButton.disabled = loading;
}


// 상세 변경 요청 중 입력과 처리 Button을 일시적으로 비활성화한다.
function setReceiptDetailLoading(loading) {
    receiptDetailForm.classList.toggle('is-loading', loading);
    saveWarehouseButton.disabled = loading;
    startInspectionButton.disabled = loading;
    saveInspectionButton.disabled = loading;
    completeReceiptButton.disabled = loading;
    cancelReceiptButton.disabled = loading;
}


// 신규 등록 Modal의 Select와 Button을 요청 중 비활성화한다.
function setCreateModalLoading(loading) {
    actionLoading = loading;
    createPurchaseOrder.disabled = loading;
    createWarehouse.disabled = loading;
    confirmCreateButton.disabled = loading;
    cancelCreateModalButton.disabled = loading;
    closeCreateModalButton.disabled = loading;
}


// 검수 시작 Modal의 확인·취소 Button을 요청 중 비활성화한다.
function setActionModalLoading(loading) {
    actionLoading = loading;
    confirmActionButton.disabled = loading;
    cancelActionModalButton.disabled = loading;
    closeActionModalButton.disabled = loading;
}


// 완료 Modal의 선택·입력·Button을 요청 중 비활성화한다.
function setCompleteModalLoading(loading) {
    actionLoading = loading;
    completeModalForm.querySelectorAll('input, textarea, button').forEach(element => {
        element.disabled = loading;
    });
}


// 취소 Modal의 사유 입력과 Button을 요청 중 비활성화한다.
function setCancelModalLoading(loading) {
    actionLoading = loading;
    cancelReason.disabled = loading;
    confirmCancelButton.disabled = loading;
    cancelCancelModalButton.disabled = loading;
    closeCancelModalButton.disabled = loading;
}


// 화면 전체 오류를 표시하고 기존 성공 안내 상태를 제거한다.
function showPageError(message) {
    receiptPageError.classList.remove('is-notice');
    receiptPageError.textContent = message;
    receiptPageError.hidden = false;
}


// 화면 전체 오류를 숨긴다.
function clearPageError() {
    receiptPageError.textContent = '';
    receiptPageError.hidden = true;
    receiptPageError.classList.remove('is-notice');
}


// 상세 Form 오류를 표시하고 성공 안내를 숨긴다.
function showReceiptFormError(message) {
    receiptFormNotice.hidden = true;
    receiptFormError.textContent = message;
    receiptFormError.hidden = false;
}


// 상세 Form 성공·상태 안내를 표시하고 오류를 숨긴다.
function showReceiptFormNotice(message) {
    receiptFormError.hidden = true;
    receiptFormNotice.textContent = message;
    receiptFormNotice.hidden = false;
}


// 상세 Form의 기존 오류와 안내를 모두 숨긴다.
function clearReceiptFormMessages() {
    receiptFormError.textContent = '';
    receiptFormError.hidden = true;
    receiptFormNotice.textContent = '';
    receiptFormNotice.hidden = true;
}


// 특정 Modal 안의 오류 문구를 표시한다.
function showElementError(element, message) {
    element.textContent = message;
    element.hidden = false;
}


// 특정 Modal 안의 오류 문구를 숨긴다.
function clearElementError(element) {
    element.textContent = '';
    element.hidden = true;
}


// 인증 만료는 로그인 화면으로 이동하고 나머지 초기화 오류는 화면에 표시한다.
function handlePageError(error, fallbackMessage) {
    if (error?.status === 401) {
        window.location.href = './login.html';
        return;
    }

    showPageError(getApiErrorMessage(error) || fallbackMessage);
}


// 열린 Modal의 바깥 영역을 직접 누른 경우에만 해당 Modal을 닫는다.
function handleBackdropClick(event) {
    if (event.target !== event.currentTarget) return;

    if (event.currentTarget === createModalBackdrop) closeCreateModal();
    if (event.currentTarget === actionModalBackdrop) closeActionModal();
    if (event.currentTarget === completeModalBackdrop) closeCompleteModal();
    if (event.currentTarget === cancelModalBackdrop) closeCancelModal();
}


// Escape 입력 시 현재 열려 있는 Modal을 우선순위에 따라 닫는다.
function handleEscapeKey(event) {
    if (event.key !== 'Escape') return;

    if (!cancelModalBackdrop.hidden) return closeCancelModal();
    if (!completeModalBackdrop.hidden) return closeCompleteModal();
    if (!actionModalBackdrop.hidden) return closeActionModal();
    if (!createModalBackdrop.hidden) closeCreateModal();
}


// ========== 공통 표시·계산 보조 함수 ==========

// 입고 상태 값을 한글 Badge HTML로 변환한다.
function createReceiptStatusBadge(status, elementId = null) {
    const className = {
        PENDING: 'is-pending',
        INSPECTING: 'is-inspecting',
        COMPLETED: 'is-completed',
        CANCELED: 'is-canceled'
    }[status] ?? 'is-pending';
    const idAttribute = elementId ? ` id="${elementId}"` : '';

    return `<span${idAttribute} class="receipt-status-badge ${className}">${escapeHtml(getReceiptStatusLabel(status))}</span>`;
}


// 상세 상단의 기존 Badge Element를 교체하지 않고 현재 입고 상태에 맞게 갱신한다.
function setReceiptStatusBadge(status) {
    receiptStatusBadge.className = 'receipt-status-badge';
    receiptStatusBadge.classList.add({
        PENDING: 'is-pending',
        INSPECTING: 'is-inspecting',
        COMPLETED: 'is-completed',
        CANCELED: 'is-canceled'
    }[status] ?? 'is-pending');
    receiptStatusBadge.textContent = getReceiptStatusLabel(status);
}


// 입고 상태 Enum을 화면 표시명으로 변환한다.
function getReceiptStatusLabel(status) {
    return {
        PENDING: '입고 대기',
        INSPECTING: '검수 중',
        COMPLETED: '입고 완료',
        CANCELED: '입고 취소'
    }[status] ?? '-';
}


// 발주 상태 Enum을 입고 상세에서 확인할 수 있는 한글 표시명으로 변환한다.
function getPurchaseOrderStatusLabel(status) {
    return {
        DRAFT: '작성 중',
        SUBMITTED: '승인 대기',
        APPROVED: '승인 완료',
        ORDERED: '발주 확정',
        CANCELED: '발주 취소',
        RECEIVED: '전량 입고 완료',
        CLOSED: '발주 종료'
    }[status] ?? '-';
}


// 잔여 입고 처리 Enum을 완료 상세에서 확인할 수 있는 표시명으로 변환한다.
function getRemainderActionLabel(action) {
    return {
        ADDITIONAL_RECEIPT: '추가 입고 예정',
        CLOSE_REMAINDER: '잔여 미입고 종료'
    }[action] ?? '-';
}


// 품목 단위 Enum과 OTHER 단위명을 화면 표시 문자열로 변환한다.
function getItemUnitLabel(unit, otherUnitName) {
    if (unit === 'OTHER') return otherUnitName || '기타';

    return {
        G: 'g',
        KG: 'kg',
        EA: '개',
        PACK: '팩',
        BOX: '박스'
    }[unit] ?? unit ?? '-';
}


// 입고 식별자를 화면용 번호로 변환한다.
function formatReceiptNumber(receiptId) {
    return receiptId == null ? '-' : `RCV-${String(receiptId).padStart(8, '0')}`;
}


// 발주 식별자를 화면용 번호로 변환한다.
function formatPurchaseOrderNumber(purchaseOrderId) {
    return purchaseOrderId == null ? '-' : `PO-${String(purchaseOrderId).padStart(8, '0')}`;
}


// 수량을 최대 소수점 셋째 자리까지 불필요한 0 없이 표시한다.
function formatQuantity(value) {
    const number = Number(value ?? 0);
    if (!Number.isFinite(number)) return '0';

    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 3 }).format(number);
}


// LocalDateTime 문자열을 한국어 날짜·시간 형식으로 표시한다.
function formatDateTime(value) {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ');

    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date);
}


// 처리자와 처리 일시를 하나의 이력 문구로 표시한다.
function formatAction(action) {
    if (!action) return '-';
    return `${action.userName ?? '-'} · ${formatDateTime(action.processedAt)}`;
}


// 숫자 입력의 빈 값은 화면에서는 빈 문자열로 유지하고 응답 값은 문자열로 정리한다.
function normalizeQuantityValue(value) {
    return value == null ? '0' : String(value);
}


// Server의 BigDecimal 요청에 전달할 수 있도록 수량을 소수 문자열로 정리한다.
function normalizeQuantityRequest(value) {
    const number = toNumber(value);
    return Number(number.toFixed(3));
}


// 선택 문자열의 앞뒤 공백을 제거하고 비어 있으면 null을 반환한다.
function normalizeOptionalValue(value) {
    const normalized = String(value ?? '').trim();
    return normalized === '' ? null : normalized;
}


// 입력값을 안전한 Number로 변환하고 변환할 수 없으면 0을 반환한다.
function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}


// 0 이상·소수점 셋째 자리까지의 수량 형식인지 확인한다.
function isValidQuantity(value) {
    return /^\d+(\.\d{1,3})?$/.test(String(value)) && toNumber(value) >= 0;
}


// 0보다 큰 LOT 수량이고 소수점 셋째 자리까지인지 확인한다.
function isPositiveQuantity(value) {
    return isValidQuantity(value) && toNumber(value) > 0;
}


// 소수점 수량 계산 오차를 고려하여 두 값을 비교한다.
function approximatelyEqual(left, right) {
    return Math.abs(left - right) < 0.0005;
}


// 배열의 숫자 값을 합산한다.
function sumBy(values, selector) {
    return values.reduce((sum, value) => sum + selector(value), 0);
}


// 사용자 입력과 Server 문자열을 innerHTML에 넣기 전에 HTML 특수문자를 이스케이프한다.
function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}


// 공통 페이지 정보를 이전·현재 범위·다음 Button으로 출력한다.
function renderPagination(container, pageMeta, onMove) {
    container.innerHTML = '';

    const totalPages = pageMeta?.totalPages ?? 0;
    if (totalPages <= 1) return;

    const currentPage = pageMeta?.page ?? pageMeta?.number ?? 0;
    const startPage = Math.max(0, currentPage - 2);
    const endPage = Math.min(totalPages - 1, startPage + 4);

    container.append(createPageButton('이전', currentPage - 1, currentPage === 0, false, onMove));

    for (let page = startPage; page <= endPage; page += 1) {
        container.append(createPageButton(String(page + 1), page, false, page === currentPage, onMove));
    }

    container.append(createPageButton('다음', currentPage + 1, currentPage >= totalPages - 1, false, onMove));
}


// 입고 목록 페이지 이동 Button 하나를 생성한다.
function createPageButton(label, page, disabled, active, onMove) {
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'receipt-page-button';
    button.textContent = label;
    button.disabled = disabled;
    button.classList.toggle('is-active', active);

    if (active) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => onMove(page));

    return button;
}


// ========== Event 연결 ==========

searchButton.addEventListener('click', applyReceiptFilters);
resetFilterButton.addEventListener('click', resetReceiptFilters);
purchaseOrderFilter.addEventListener('keydown', event => {
    if (event.key === 'Enter') applyReceiptFilters();
});

newReceiptButton.addEventListener('click', openCreateModal);
closeDetailButton.addEventListener('click', closeMobileDetailPanel);
saveWarehouseButton.addEventListener('click', updateReceiptWarehouse);
startInspectionButton.addEventListener('click', openStartInspectionModal);
saveInspectionButton.addEventListener('click', saveInspection);
completeReceiptButton.addEventListener('click', openCompleteModal);
cancelReceiptButton.addEventListener('click', openCancelModal);

receiptItemList.addEventListener('input', handleReceiptItemInput);
receiptItemList.addEventListener('click', handleReceiptItemClick);

createModalForm.addEventListener('submit', handleCreateReceipt);
closeCreateModalButton.addEventListener('click', closeCreateModal);
cancelCreateModalButton.addEventListener('click', closeCreateModal);

actionModalForm.addEventListener('submit', startInspection);
closeActionModalButton.addEventListener('click', closeActionModal);
cancelActionModalButton.addEventListener('click', closeActionModal);

completeModalForm.addEventListener('submit', completeReceipt);
completeModalForm.addEventListener('change', event => {
    if (event.target.name === 'remainderAction') updateCompletionOptionGuide();
});
remainderReason.addEventListener('input', () => {
    remainderReasonLength.textContent = String(remainderReason.value.length);
});
closeCompleteModalButton.addEventListener('click', closeCompleteModal);
cancelCompleteModalButton.addEventListener('click', closeCompleteModal);

cancelModalForm.addEventListener('submit', cancelReceipt);
cancelReason.addEventListener('input', () => {
    cancelReasonLength.textContent = String(cancelReason.value.length);
});
closeCancelModalButton.addEventListener('click', closeCancelModal);
cancelCancelModalButton.addEventListener('click', closeCancelModal);

[createModalBackdrop, actionModalBackdrop, completeModalBackdrop, cancelModalBackdrop]
    .forEach(backdrop => backdrop.addEventListener('click', handleBackdropClick));

document.addEventListener('keydown', handleEscapeKey);
window.addEventListener('resize', handleWindowResize);


initialize();
