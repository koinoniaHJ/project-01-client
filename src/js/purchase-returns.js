// ********** 매입 반품 관리 화면의 목록·원본 LOT·상세·등록·수정·완료·취소와 역할별 UI를 담당 **********

import { api, getApiErrorMessage } from './api.js';
import { hasRole } from './auth.js';
import { initializeCommonLayout } from './common-layout.js';


// ========== 화면 상태 ==========

const MAX_REFERENCE_PAGES = 100;
let canEditPurchaseReturn = false;
let canProcessPurchaseReturn = false;
let warehouseUser = false;
let purchaseReturns = [];
let purchaseReturnPageMeta = null;
let selectedPurchaseReturn = null;
let sourceItems = [];
let detailMode = 'empty';
let mobileDetailOpen = false;
let actionLoading = false;
let formDirty = false;


// ========== 목록·상세 Element ==========

const purchaseReturnCard = document.querySelector('.purchase-return-card');
const purchaseReturnPageError = document.querySelector('#purchaseReturnPageError');
const receiptIdFilter = document.querySelector('#receiptIdFilter');
const statusFilter = document.querySelector('#statusFilter');
const searchButton = document.querySelector('#searchButton');
const resetFilterButton = document.querySelector('#resetFilterButton');
const newPurchaseReturnButton = document.querySelector('#newPurchaseReturnButton');
const purchaseReturnCount = document.querySelector('#purchaseReturnCount');
const purchaseReturnTableBody = document.querySelector('#purchaseReturnTableBody');
const purchaseReturnMobileList = document.querySelector('#purchaseReturnMobileList');
const purchaseReturnPagination = document.querySelector('#purchaseReturnPagination');
const purchaseReturnDetailSection = document.querySelector('#purchaseReturnDetailSection');
const purchaseReturnDetailMode = document.querySelector('#purchaseReturnDetailMode');
const closeDetailButton = document.querySelector('#closeDetailButton');
const purchaseReturnDetailEmpty = document.querySelector('#purchaseReturnDetailEmpty');
const purchaseReturnDetailForm = document.querySelector('#purchaseReturnDetailForm');
const purchaseReturnStatusBadge = document.querySelector('#purchaseReturnStatusBadge');
const purchaseReturnIdValue = document.querySelector('#purchaseReturnIdValue');
const receiptIdValue = document.querySelector('#receiptIdValue');
const purchaseOrderIdValue = document.querySelector('#purchaseOrderIdValue');
const supplierValue = document.querySelector('#supplierValue');
const warehouseValue = document.querySelector('#warehouseValue');
const totalAmountValue = document.querySelector('#totalAmountValue');
const createdActionValue = document.querySelector('#createdActionValue');
const completedActionValue = document.querySelector('#completedActionValue');
const canceledActionValue = document.querySelector('#canceledActionValue');
const voucherIdValue = document.querySelector('#voucherIdValue');
const purchaseReturnItemTableBody = document.querySelector('#purchaseReturnItemTableBody');
const purchaseReturnItemMobileList = document.querySelector('#purchaseReturnItemMobileList');
const purchaseReturnReason = document.querySelector('#purchaseReturnReason');
const reasonLength = document.querySelector('#reasonLength');
const cancelReasonDisplay = document.querySelector('#cancelReasonDisplay');
const cancelReasonValue = document.querySelector('#cancelReasonValue');
const purchaseReturnFormNotice = document.querySelector('#purchaseReturnFormNotice');
const purchaseReturnFormError = document.querySelector('#purchaseReturnFormError');
const cancelPurchaseReturnButton = document.querySelector('#cancelPurchaseReturnButton');
const completePurchaseReturnButton = document.querySelector('#completePurchaseReturnButton');
const savePurchaseReturnButton = document.querySelector('#savePurchaseReturnButton');


// ========== 신규 등록 Modal Element ==========

const createModalBackdrop = document.querySelector('#createModalBackdrop');
const createModalForm = document.querySelector('#createModalForm');
const createReceiptId = document.querySelector('#createReceiptId');
const createModalError = document.querySelector('#createModalError');
const closeCreateModalButton = document.querySelector('#closeCreateModalButton');
const cancelCreateModalButton = document.querySelector('#cancelCreateModalButton');
const confirmCreateModalButton = document.querySelector('#confirmCreateModalButton');


// ========== 완료·취소 Modal Element ==========

const completeModalBackdrop = document.querySelector('#completeModalBackdrop');
const completeModalForm = document.querySelector('#completeModalForm');
const completeModalTarget = document.querySelector('#completeModalTarget');
const completeModalError = document.querySelector('#completeModalError');
const closeCompleteModalButton = document.querySelector('#closeCompleteModalButton');
const cancelCompleteModalButton = document.querySelector('#cancelCompleteModalButton');
const confirmCompleteButton = document.querySelector('#confirmCompleteButton');
const cancelModalBackdrop = document.querySelector('#cancelModalBackdrop');
const cancelModalForm = document.querySelector('#cancelModalForm');
const cancelModalTarget = document.querySelector('#cancelModalTarget');
const cancelReason = document.querySelector('#cancelReason');
const cancelReasonLength = document.querySelector('#cancelReasonLength');
const cancelModalError = document.querySelector('#cancelModalError');
const closeCancelModalButton = document.querySelector('#closeCancelModalButton');
const cancelCancelModalButton = document.querySelector('#cancelCancelModalButton');
const confirmCancelButton = document.querySelector('#confirmCancelButton');


// ========== 화면 초기화 ==========

// 공통 Layout과 역할별 접근 범위를 적용한 뒤 매입 반품 목록과 기본 상세정보를 조회한다.
async function initialize() {
    try {
        const currentUser = await initializeCommonLayout({
            pageTitle: '매입 반품 관리',
            activeMenu: 'purchaseReturns',
            onError: showPageError
        });

        if (!currentUser) return;

        applyRoleAccess();
        await loadPurchaseReturns(0);
        await applyDefaultDetailState();
    } catch (error) {
        handlePageError(error, '매입 반품 관리 화면을 초기화하지 못했습니다.');
    }
}


// ADMIN은 전체 기능, OFFICE는 등록·수정, WAREHOUSE는 완료·취소만 수행하도록 화면 범위를 적용한다.
function applyRoleAccess() {
    canEditPurchaseReturn = hasRole('ADMIN', 'OFFICE');
    canProcessPurchaseReturn = hasRole('ADMIN', 'WAREHOUSE');
    warehouseUser = hasRole('WAREHOUSE');
    newPurchaseReturnButton.hidden = !canEditPurchaseReturn;
    document.body.classList.toggle('is-warehouse', warehouseUser);
}


// ========== 매입 반품 목록 조회 ==========

// 현재 원본 입고·상태·페이지 조건을 매입 반품 목록 API Query Parameter로 변환한다.
function createPurchaseReturnListPath(page) {
    const parameters = new URLSearchParams({ page: String(page) });
    const receiptId = receiptIdFilter.value.trim();

    if (receiptId) parameters.set('receiptId', receiptId);
    if (statusFilter.value) parameters.set('status', statusFilter.value);

    return `/purchase-returns?${parameters.toString()}`;
}


// 지정 페이지의 목록을 조회하고 PC Table·Mobile Card·페이지 정보를 함께 갱신한다.
async function loadPurchaseReturns(page) {
    setListLoading(true);

    try {
        const response = await api.get(createPurchaseReturnListPath(page));

        purchaseReturns = response.data ?? [];
        purchaseReturnPageMeta = response.meta ?? null;
        renderPurchaseReturnCount();
        renderPurchaseReturnTable();
        renderPurchaseReturnMobileList();
        renderPurchaseReturnPagination();
        renderSelectedPurchaseReturn();
    } finally {
        setListLoading(false);
    }
}


// 검색 결과 전체 건수를 줄바꿈 없이 한 줄로 표시한다.
function renderPurchaseReturnCount() {
    purchaseReturnCount.textContent = `총 ${purchaseReturnPageMeta?.totalElements ?? 0}건`;
}


// PC·Tablet 목록을 반품·원본 입고·공급업체·창고·상태·금액·처리 일시 Table로 출력한다.
function renderPurchaseReturnTable() {
    purchaseReturnTableBody.innerHTML = '';

    if (purchaseReturns.length === 0) {
        purchaseReturnTableBody.innerHTML = '<tr><td colspan="8" class="purchase-return-empty-cell">조회된 매입 반품이 없습니다.</td></tr>';
        return;
    }

    purchaseReturns.forEach(purchaseReturn => {
        const row = document.createElement('tr');

        row.dataset.purchaseReturnId = String(purchaseReturn.purchaseReturnId);
        row.innerHTML = `
            <td>${escapeHtml(formatPurchaseReturnNumber(purchaseReturn.purchaseReturnId))}</td>
            <td>${escapeHtml(formatReceiptNumber(purchaseReturn.receiptId))}</td>
            <td>${escapeHtml(purchaseReturn.supplierName)}<br><small>${escapeHtml(purchaseReturn.supplierCode)}</small></td>
            <td>${escapeHtml(purchaseReturn.warehouseName)}<br><small>${escapeHtml(purchaseReturn.warehouseCode)}</small></td>
            <td>${createPurchaseReturnStatusBadge(purchaseReturn.status)}</td>
            <td class="amount-column">${formatCurrency(purchaseReturn.totalAmount)}</td>
            <td>${formatDateTime(purchaseReturn.createdAt)}</td>
            <td>${formatDateTime(purchaseReturn.completedAt)}</td>
        `;
        row.addEventListener('click', () => selectPurchaseReturn(purchaseReturn.purchaseReturnId));
        purchaseReturnTableBody.append(row);
    });
}


// Mobile 목록을 상태·공급업체·원본 입고·창고·총액이 보이는 Card로 출력한다.
function renderPurchaseReturnMobileList() {
    purchaseReturnMobileList.innerHTML = '';

    if (purchaseReturns.length === 0) {
        purchaseReturnMobileList.innerHTML = '<p class="purchase-return-mobile-empty">조회된 매입 반품이 없습니다.</p>';
        return;
    }

    purchaseReturns.forEach(purchaseReturn => {
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'purchase-return-mobile-item';
        button.dataset.purchaseReturnId = String(purchaseReturn.purchaseReturnId);
        button.innerHTML = `
            <span class="purchase-return-mobile-head"><strong class="purchase-return-mobile-title">${escapeHtml(formatPurchaseReturnNumber(purchaseReturn.purchaseReturnId))}</strong>${createPurchaseReturnStatusBadge(purchaseReturn.status)}</span>
            <span class="purchase-return-mobile-grid">
                ${createMobileListField('원본 입고', formatReceiptNumber(purchaseReturn.receiptId))}
                ${createMobileListField('공급업체', `${purchaseReturn.supplierCode} · ${purchaseReturn.supplierName}`)}
                ${createMobileListField('창고', `${purchaseReturn.warehouseCode} · ${purchaseReturn.warehouseName}`)}
                ${warehouseUser ? '' : createMobileListField('반품 총액', formatCurrency(purchaseReturn.totalAmount))}
                ${createMobileListField('등록 일시', formatDateTime(purchaseReturn.createdAt))}
            </span>
        `;
        button.addEventListener('click', () => selectPurchaseReturn(purchaseReturn.purchaseReturnId));
        purchaseReturnMobileList.append(button);
    });
}


// Mobile 목록의 이름과 값을 동일한 구조로 생성한다.
function createMobileListField(label, value) {
    return `<span class="purchase-return-mobile-row"><span class="purchase-return-mobile-label">${escapeHtml(label)}</span><strong class="purchase-return-mobile-value">${escapeHtml(value)}</strong></span>`;
}


// Server 페이지 정보로 이전·페이지 번호·다음 Button을 생성한다.
function renderPurchaseReturnPagination() {
    renderPagination(purchaseReturnPagination, purchaseReturnPageMeta, async page => {
        clearPageError();

        try {
            await loadPurchaseReturns(page);
            await applyDefaultDetailState();
        } catch (error) {
            handlePageError(error, '매입 반품 목록을 불러오지 못했습니다.');
        }
    });
}


// 원본 입고 번호가 1 이상의 정수인지 확인한다.
function validateFilters() {
    const receiptId = receiptIdFilter.value.trim();

    if (receiptId && (!Number.isInteger(Number(receiptId)) || Number(receiptId) <= 0)) {
        showPageError('원본 입고 번호는 1 이상의 정수로 입력해 주세요.');
        receiptIdFilter.focus();
        return false;
    }
    return true;
}


// 현재 검색 조건을 적용하여 첫 페이지부터 다시 조회한다.
async function applyFilters() {
    clearPageError();
    if (!validateFilters()) return;

    try {
        await loadPurchaseReturns(0);
        await applyDefaultDetailState();
    } catch (error) {
        handlePageError(error, '매입 반품 목록을 불러오지 못했습니다.');
    }
}


// 검색 조건을 모두 비우고 첫 페이지를 조회한다.
async function resetFilters() {
    receiptIdFilter.value = '';
    statusFilter.value = '';
    await applyFilters();
}


// ========== 상세 조회·출력 ==========

// 선택한 매입 반품의 최신 상세정보를 조회하고 REGISTERED 수정에 필요한 원본 LOT를 병합한다.
async function selectPurchaseReturn(purchaseReturnId) {
    clearPageError();
    clearFormMessages();
    setDetailLoading(true);

    try {
        const response = await api.get(`/purchase-returns/${purchaseReturnId}`);

        selectedPurchaseReturn = response.data;
        detailMode = 'detail';
        sourceItems = selectedPurchaseReturn.status === 'REGISTERED' && canEditPurchaseReturn
            ? await loadMergedSourceItems(selectedPurchaseReturn)
            : createDetailOnlyItems(selectedPurchaseReturn.items ?? []);
        mobileDetailOpen = isMobile();
        renderPurchaseReturnDetail();
        renderSelectedPurchaseReturn();
        syncDetailVisibility();
    } catch (error) {
        handlePageError(error, '매입 반품 상세정보를 불러오지 못했습니다.');
    } finally {
        setDetailLoading(false);
    }
}


// REGISTERED 상세의 기존 반품 수량을 원본 입고 LOT 전체에 합쳐 품목 추가·제외가 가능하게 만든다.
async function loadMergedSourceItems(purchaseReturn) {
    const sourceResponse = await api.get(`/purchase-returns/source/${purchaseReturn.receiptId}`);
    const selectedByReceiptLotId = new Map((purchaseReturn.items ?? [])
        .map(item => [Number(item.receiptLotId), item]));

    return (sourceResponse.data?.items ?? []).map(item => ({
        ...item,
        purchaseReturnItemId: selectedByReceiptLotId.get(Number(item.receiptLotId))?.purchaseReturnItemId ?? null,
        returnQuantity: String(selectedByReceiptLotId.get(Number(item.receiptLotId))?.returnQuantity ?? '')
    }));
}


// 완료·취소 상세 품목을 읽기 전용 화면 상태로 복사한다.
function createDetailOnlyItems(items) {
    return items.map(item => ({ ...item, returnQuantity: String(item.returnQuantity ?? '') }));
}


// PC·Tablet은 첫 목록을 기본 선택하고 Mobile은 목록 화면을 먼저 유지한다.
async function applyDefaultDetailState() {
    if (!isMobile() && purchaseReturns.length > 0) {
        await selectPurchaseReturn(purchaseReturns[0].purchaseReturnId);
        return;
    }
    clearPurchaseReturnDetail();
}


// 선택 상세 또는 신규 등록 상태의 요약·품목·사유·처리 버튼을 출력한다.
function renderPurchaseReturnDetail() {
    const purchaseReturn = selectedPurchaseReturn;
    const createMode = detailMode === 'create';
    const registered = createMode || purchaseReturn?.status === 'REGISTERED';
    const editable = registered && canEditPurchaseReturn;

    purchaseReturnDetailEmpty.hidden = true;
    purchaseReturnDetailForm.hidden = false;
    purchaseReturnDetailMode.textContent = createMode
        ? '완료 입고 LOT별 반품 수량과 반품 사유를 입력해 주세요.'
        : '원본 입고와 LOT별 반품 수량 및 처리 상태를 확인할 수 있습니다.';

    setPurchaseReturnStatusBadge(createMode ? 'REGISTERED' : purchaseReturn.status);
    purchaseReturnIdValue.textContent = createMode ? '신규' : formatPurchaseReturnNumber(purchaseReturn.purchaseReturnId);
    receiptIdValue.textContent = formatReceiptNumber(purchaseReturn.receiptId);
    purchaseOrderIdValue.textContent = formatPurchaseOrderNumber(purchaseReturn.purchaseOrderId);
    supplierValue.textContent = `${purchaseReturn.supplierCode} · ${purchaseReturn.supplierName}`;
    warehouseValue.textContent = `${purchaseReturn.warehouseCode} · ${purchaseReturn.warehouseName}`;
    createdActionValue.textContent = createMode ? '-' : formatAction(purchaseReturn.created);
    completedActionValue.textContent = createMode ? '-' : formatAction(purchaseReturn.completed);
    canceledActionValue.textContent = createMode ? '-' : formatAction(purchaseReturn.canceled);
    voucherIdValue.textContent = createMode || purchaseReturn.purchaseReturnVoucherId == null
        ? '-' : `VCH-${String(purchaseReturn.purchaseReturnVoucherId).padStart(8, '0')}`;
    purchaseReturnReason.value = createMode ? '' : purchaseReturn.reason ?? '';
    purchaseReturnReason.disabled = !editable;
    reasonLength.textContent = String(purchaseReturnReason.value.length);
    cancelReasonDisplay.hidden = createMode || purchaseReturn.status !== 'CANCELED';
    cancelReasonValue.textContent = purchaseReturn?.cancelReason ?? '-';

    renderPurchaseReturnItems(editable);
    updateCalculatedAmounts();
    formDirty = false;

    savePurchaseReturnButton.hidden = !editable;
    savePurchaseReturnButton.textContent = createMode ? '반품 등록' : '수정 저장';
    completePurchaseReturnButton.hidden = createMode || !canProcessPurchaseReturn || purchaseReturn.status !== 'REGISTERED';
    cancelPurchaseReturnButton.hidden = createMode || !canProcessPurchaseReturn || purchaseReturn.status !== 'REGISTERED';
}


// 선택 상세가 없는 초기 상태로 Form과 선택 강조를 정리한다.
function clearPurchaseReturnDetail() {
    selectedPurchaseReturn = null;
    sourceItems = [];
    detailMode = 'empty';
    formDirty = false;
    purchaseReturnDetailMode.textContent = '매입 반품을 선택하거나 신규 반품을 눌러주세요.';
    purchaseReturnDetailEmpty.hidden = false;
    purchaseReturnDetailForm.hidden = true;
    renderSelectedPurchaseReturn();
    mobileDetailOpen = false;
    syncDetailVisibility();
}


// PC Table 행과 Mobile Card에서 현재 선택한 반품을 같은 상태로 강조한다.
function renderSelectedPurchaseReturn() {
    const selectedId = selectedPurchaseReturn?.purchaseReturnId;

    document.querySelectorAll('[data-purchase-return-id]').forEach(element => {
        element.classList.toggle('is-selected', Number(element.dataset.purchaseReturnId) === Number(selectedId));
    });
}


// 원본 또는 상세 LOT 품목을 PC Table과 Mobile Card에 동시에 출력한다.
function renderPurchaseReturnItems(editable) {
    purchaseReturnItemTableBody.innerHTML = '';
    purchaseReturnItemMobileList.innerHTML = '';

    if (sourceItems.length === 0) {
        purchaseReturnItemTableBody.innerHTML = '<tr><td colspan="10" class="purchase-return-item-empty">반품 가능한 원본 LOT가 없습니다.</td></tr>';
        purchaseReturnItemMobileList.innerHTML = '<p class="purchase-return-mobile-empty">반품 가능한 원본 LOT가 없습니다.</p>';
        return;
    }

    sourceItems.forEach((item, index) => {
        purchaseReturnItemTableBody.append(createPurchaseReturnItemRow(item, index, editable));
        purchaseReturnItemMobileList.append(createPurchaseReturnItemMobileCard(item, index, editable));
    });
}


// LOT 한 건을 수량·단가·금액까지 확인할 수 있는 PC Table 행으로 생성한다.
function createPurchaseReturnItemRow(item, index, editable) {
    const row = document.createElement('tr');

    row.innerHTML = `
        <td><span class="purchase-return-item-main"><strong>${escapeHtml(item.itemName)}</strong><span>${escapeHtml(item.itemCode)} · ${escapeHtml(getItemUnitLabel(item.unit, item.otherUnitName))}</span></span></td>
        <td>${escapeHtml(item.lotNumber)}<br><small>${escapeHtml(item.supplierLotNumber || '-')}</small></td>
        <td>${formatDate(item.expiryDate)}</td>
        <td>${formatQuantity(item.receivedQuantity)}</td>
        <td>${formatQuantity(item.completedReturnQuantity)}</td>
        <td>${formatQuantity(item.availableQuantity)}</td>
        <td>${formatQuantity(item.returnableQuantity)}</td>
        <td>${createQuantityInput(item, index, editable)}</td>
        <td class="amount-column">${formatCurrency(item.unitPrice)}</td>
        <td class="amount-column" data-line-amount="${index}">${formatCurrency(calculateLineAmount(item))}</td>
    `;
    return row;
}


// LOT 한 건을 Mobile에서 읽고 입력할 수 있는 Card로 생성한다.
function createPurchaseReturnItemMobileCard(item, index, editable) {
    const card = document.createElement('article');

    card.className = 'purchase-return-item-mobile-card';
    card.innerHTML = `
        <div class="purchase-return-item-mobile-head"><strong>${escapeHtml(item.itemName)}</strong><span>${escapeHtml(item.itemCode)} · ${escapeHtml(getItemUnitLabel(item.unit, item.otherUnitName))}</span></div>
        <div class="purchase-return-item-mobile-grid">
            ${createMobileItemField('원본 LOT', `${item.lotNumber}${item.supplierLotNumber ? ` · ${item.supplierLotNumber}` : ''}`)}
            ${createMobileItemField('사용기한', formatDate(item.expiryDate))}
            ${createMobileItemField('정상 입고', formatQuantity(item.receivedQuantity))}
            ${createMobileItemField('완료 반품', formatQuantity(item.completedReturnQuantity))}
            ${createMobileItemField('가용재고', formatQuantity(item.availableQuantity))}
            ${createMobileItemField('반품 가능', formatQuantity(item.returnableQuantity))}
            ${warehouseUser ? '' : createMobileItemField('매입 단가', formatCurrency(item.unitPrice))}
            ${warehouseUser ? '' : `<div class="purchase-return-item-mobile-field"><span>금액</span><strong data-line-amount="${index}">${formatCurrency(calculateLineAmount(item))}</strong></div>`}
        </div>
        <label class="purchase-return-form-field"><span>반품 수량</span>${createQuantityInput(item, index, editable)}</label>
    `;
    return card;
}


// Mobile 품목 Card의 이름과 값을 공통 구조로 생성한다.
function createMobileItemField(label, value) {
    return `<div class="purchase-return-item-mobile-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}


// 등록·수정 가능 여부에 맞춰 LOT별 반품 수량 Input을 생성한다.
function createQuantityInput(item, index, editable) {
    const maximum = Number(item.returnableQuantity ?? 0);
    const value = item.returnQuantity ?? '';

    return `<input type="number" class="purchase-return-quantity-input" data-item-index="${index}" min="0" max="${maximum}" step="0.001" value="${escapeHtml(value)}" placeholder="0" ${editable ? '' : 'disabled'}>`;
}


// PC와 Mobile 중 어느 수량 입력이 변경되어도 상태·동일 LOT Input·금액을 함께 갱신한다.
function handleItemQuantityInput(event) {
    const input = event.target.closest('[data-item-index]');
    if (!input) return;

    const index = Number(input.dataset.itemIndex);
    sourceItems[index].returnQuantity = input.value;
    formDirty = true;
    document.querySelectorAll(`[data-item-index="${index}"]`).forEach(otherInput => {
        if (otherInput !== input) otherInput.value = input.value;
    });
    updateCalculatedAmounts();
}


// 입력한 반품 수량으로 LOT별 금액과 총액을 계산하여 화면에 표시한다.
function updateCalculatedAmounts() {
    sourceItems.forEach((item, index) => {
        document.querySelectorAll(`[data-line-amount="${index}"]`).forEach(element => {
            element.textContent = formatCurrency(calculateLineAmount(item));
        });
    });

    const totalAmount = sourceItems.reduce((sum, item) => sum + calculateLineAmount(item), 0);
    totalAmountValue.textContent = formatCurrency(totalAmount);
}


// LOT 반품 수량과 원본 발주 단가를 곱하여 화면 예상 금액을 계산한다.
function calculateLineAmount(item) {
    return toNumber(item.returnQuantity) * toNumber(item.unitPrice);
}


// ========== 신규 매입 반품 등록 ==========

// 완료 입고 기준정보를 조회한 뒤 신규 반품 Modal을 연다.
async function openCreateModal() {
    if (!canEditPurchaseReturn || actionLoading) return;

    clearPageError();
    clearElementError(createModalError);
    createReceiptId.innerHTML = '<option value="">완료 입고를 불러오는 중입니다.</option>';
    createModalBackdrop.hidden = false;
    setCreateModalLoading(true);

    try {
        const completedReceipts = await loadAllPages('/receipts?status=COMPLETED');
        renderCompletedReceiptOptions(completedReceipts);

        if (completedReceipts.length === 0) {
            showElementError(createModalError, '매입 반품의 원본으로 선택할 완료 입고가 없습니다.');
        }
    } catch (error) {
        showElementError(createModalError, getApiErrorMessage(error));
    } finally {
        setCreateModalLoading(false);
    }
}


// 완료 입고를 공급업체·창고와 함께 식별할 수 있는 Select Option으로 출력한다.
function renderCompletedReceiptOptions(receipts) {
    createReceiptId.innerHTML = '<option value="">완료 입고 선택</option>';

    receipts.forEach(receipt => {
        const option = document.createElement('option');

        option.value = String(receipt.receiptId);
        option.textContent = `${formatReceiptNumber(receipt.receiptId)} · ${receipt.supplierName} · ${receipt.warehouseName}`;
        createReceiptId.append(option);
    });
}


// 완료 입고 Select를 닫고 임시 입력 상태를 초기화한다.
function closeCreateModal() {
    if (actionLoading) return;
    createModalBackdrop.hidden = true;
    createModalForm.reset();
    clearElementError(createModalError);
}


// 선택한 완료 입고의 원본 LOT와 가능 수량을 조회하여 신규 등록 상세 화면으로 전환한다.
async function startCreateMode(event) {
    event.preventDefault();
    const receiptId = Number(createReceiptId.value);

    if (!Number.isInteger(receiptId) || receiptId <= 0) {
        showElementError(createModalError, '완료 입고를 선택해 주세요.');
        createReceiptId.focus();
        return;
    }

    setCreateModalLoading(true);

    try {
        const response = await api.get(`/purchase-returns/source/${receiptId}`);
        const source = response.data;

        sourceItems = (source.items ?? []).map(item => ({ ...item, returnQuantity: '' }));
        if (!sourceItems.some(item => toNumber(item.returnableQuantity) > 0)) {
            throw new Error('선택한 입고에는 현재 반품 가능한 LOT 수량이 없습니다.');
        }

        selectedPurchaseReturn = {
            purchaseReturnId: null,
            receiptId: source.receiptId,
            purchaseOrderId: source.purchaseOrderId,
            supplierCode: source.supplierCode,
            supplierName: source.supplierName,
            warehouseCode: source.warehouseCode,
            warehouseName: source.warehouseName,
            status: 'REGISTERED',
            reason: '',
            version: null
        };
        detailMode = 'create';
        mobileDetailOpen = isMobile();
        closeCreateModalAfterLoading();
        clearFormMessages();
        renderPurchaseReturnDetail();
        renderSelectedPurchaseReturn();
        syncDetailVisibility();
        purchaseReturnReason.focus();
    } catch (error) {
        showElementError(createModalError, getApiErrorMessage(error));
    } finally {
        setCreateModalLoading(false);
    }
}


// 요청 완료 상태에서도 신규 등록 Modal만 안전하게 닫는다.
function closeCreateModalAfterLoading() {
    createModalBackdrop.hidden = true;
    createModalForm.reset();
    clearElementError(createModalError);
}


// 등록·수정 공통 입력을 검증하고 Server 요청 품목을 생성한다.
function validatePurchaseReturnForm() {
    const reason = purchaseReturnReason.value.trim();
    const items = [];

    if (!reason) {
        showFormError('매입 반품 사유를 입력해 주세요.');
        purchaseReturnReason.focus();
        return null;
    }

    for (const [index, item] of sourceItems.entries()) {
        const rawQuantity = String(item.returnQuantity ?? '').trim();
        if (!rawQuantity || toNumber(rawQuantity) === 0) continue;

        if (!isPositiveQuantity(rawQuantity)) {
            showFormError(`${item.itemName}의 반품 수량은 0보다 크고 소수점 셋째 자리 이하여야 합니다.`);
            focusQuantityInput(index);
            return null;
        }
        if (toNumber(rawQuantity) > toNumber(item.returnableQuantity) + 0.000001) {
            showFormError(`${item.itemName}의 반품 수량이 반품 가능 수량을 초과합니다.`);
            focusQuantityInput(index);
            return null;
        }

        items.push({ receiptLotId: item.receiptLotId, returnQuantity: normalizeQuantityRequest(rawQuantity) });
    }

    if (items.length === 0) {
        showFormError('반품 수량을 입력한 품목을 하나 이상 선택해 주세요.');
        return null;
    }

    return { reason, items };
}


// 해당 LOT의 현재 Viewport 수량 Input으로 이동한다.
function focusQuantityInput(index) {
    const inputs = [...document.querySelectorAll(`[data-item-index="${index}"]`)];
    const visibleInput = inputs.find(input => input.offsetParent !== null) ?? inputs[0];
    visibleInput?.focus();
}


// 현재 모드에 따라 신규 등록 또는 REGISTERED 수정 API를 호출한다.
async function savePurchaseReturn(event) {
    event.preventDefault();
    if (!canEditPurchaseReturn || actionLoading) return;

    clearFormMessages();
    const formData = validatePurchaseReturnForm();
    if (!formData) return;

    setDetailLoading(true);

    try {
        const response = detailMode === 'create'
            ? await api.post('/purchase-returns', {
                receiptId: selectedPurchaseReturn.receiptId,
                items: formData.items,
                reason: formData.reason
            })
            : await api.patch(`/purchase-returns/${selectedPurchaseReturn.purchaseReturnId}`, {
                items: formData.items,
                reason: formData.reason,
                version: selectedPurchaseReturn.version
            });
        const savedId = response.data.purchaseReturnId;
        const notice = detailMode === 'create' ? '신규 매입 반품을 등록했습니다.' : '매입 반품 정보를 수정했습니다.';

        await reloadListAndSelect(savedId, detailMode === 'create');
        showFormNotice(notice);
    } catch (error) {
        if (isVersionConflict(error) && selectedPurchaseReturn?.purchaseReturnId) {
            await reloadAfterVersionConflict('다른 사용자가 매입 반품을 먼저 변경했습니다. 최신 정보를 다시 불러왔습니다.');
        } else {
            showFormError(getApiErrorMessage(error) || '매입 반품을 저장하지 못했습니다.');
        }
    } finally {
        setDetailLoading(false);
    }
}


// 신규 등록은 최신순 첫 페이지로, 수정은 현재 페이지로 목록과 상세를 다시 조회한다.
async function reloadListAndSelect(purchaseReturnId, resetToFirstPage = false) {
    if (resetToFirstPage) {
        receiptIdFilter.value = '';
        statusFilter.value = '';
    }

    const page = resetToFirstPage ? 0 : getCurrentPage();
    await loadPurchaseReturns(page);

    const existsOnPage = purchaseReturns.some(item => Number(item.purchaseReturnId) === Number(purchaseReturnId));
    if (existsOnPage) {
        await selectPurchaseReturn(purchaseReturnId);
    } else {
        await applyDefaultDetailState();
    }
}


// ========== 매입 반품 완료 ==========

// REGISTERED 매입 반품의 상태 변경과 재고·전표 반영 내용을 Modal에 표시한다.
function openCompleteModal() {
    if (!canProcessPurchaseReturn || selectedPurchaseReturn?.status !== 'REGISTERED' || actionLoading) return;
    if (formDirty) {
        showFormError('변경한 반품 수량이나 사유를 먼저 저장한 후 반품 완료를 진행해 주세요.');
        return;
    }
    clearElementError(completeModalError);
    completeModalTarget.textContent = formatPurchaseReturnNumber(selectedPurchaseReturn.purchaseReturnId);
    completeModalBackdrop.hidden = false;
}


// 완료 Modal을 닫고 오류를 초기화한다.
function closeCompleteModal() {
    if (actionLoading) return;
    completeModalBackdrop.hidden = true;
    clearElementError(completeModalError);
}


// 최신 version으로 반품을 완료하여 재고 감소와 마이너스 매입 전표 생성을 요청한다.
async function completePurchaseReturn(event) {
    event.preventDefault();
    if (!selectedPurchaseReturn || actionLoading) return;

    const purchaseReturnId = selectedPurchaseReturn.purchaseReturnId;
    setCompleteModalLoading(true);

    try {
        await api.post(`/purchase-returns/${purchaseReturnId}/complete`, { version: selectedPurchaseReturn.version });
        closeCompleteModalAfterLoading();
        await reloadListAndSelect(purchaseReturnId);
        showFormNotice('매입 반품을 완료했습니다. LOT 재고·변동 이력·마이너스 매입 전표에 함께 반영되었습니다.');
    } catch (error) {
        if (isVersionConflict(error)) {
            closeCompleteModalAfterLoading();
            await reloadAfterVersionConflict('다른 사용자가 매입 반품을 먼저 처리했습니다. 최신 정보를 다시 불러왔습니다.');
        } else {
            showElementError(completeModalError, getApiErrorMessage(error));
        }
    } finally {
        setCompleteModalLoading(false);
    }
}


// 요청 완료 상태에서도 완료 Modal만 안전하게 닫는다.
function closeCompleteModalAfterLoading() {
    completeModalBackdrop.hidden = true;
    clearElementError(completeModalError);
}


// ========== 매입 반품 취소 ==========

// REGISTERED 매입 반품의 현재·변경 상태와 취소 사유 입력 Modal을 연다.
function openCancelModal() {
    if (!canProcessPurchaseReturn || selectedPurchaseReturn?.status !== 'REGISTERED' || actionLoading) return;
    cancelModalTarget.textContent = formatPurchaseReturnNumber(selectedPurchaseReturn.purchaseReturnId);
    cancelReason.value = '';
    cancelReasonLength.textContent = '0';
    clearElementError(cancelModalError);
    cancelModalBackdrop.hidden = false;
    cancelReason.focus();
}


// 취소 Modal을 닫고 입력한 사유와 오류를 초기화한다.
function closeCancelModal() {
    if (actionLoading) return;
    cancelModalBackdrop.hidden = true;
    cancelModalForm.reset();
    cancelReasonLength.textContent = '0';
    clearElementError(cancelModalError);
}


// 최신 version과 필수 취소 사유로 REGISTERED 매입 반품을 취소한다.
async function cancelPurchaseReturn(event) {
    event.preventDefault();
    if (!selectedPurchaseReturn || actionLoading) return;

    const reason = cancelReason.value.trim();
    if (!reason) {
        showElementError(cancelModalError, '매입 반품 취소 사유를 입력해 주세요.');
        cancelReason.focus();
        return;
    }

    const purchaseReturnId = selectedPurchaseReturn.purchaseReturnId;
    setCancelModalLoading(true);

    try {
        await api.post(`/purchase-returns/${purchaseReturnId}/cancel`, {
            reason,
            version: selectedPurchaseReturn.version
        });
        closeCancelModalAfterLoading();
        await reloadListAndSelect(purchaseReturnId);
        showFormNotice('매입 반품을 취소했습니다. 재고와 전표는 변경되지 않습니다.');
    } catch (error) {
        if (isVersionConflict(error)) {
            closeCancelModalAfterLoading();
            await reloadAfterVersionConflict('다른 사용자가 매입 반품을 먼저 처리했습니다. 최신 정보를 다시 불러왔습니다.');
        } else {
            showElementError(cancelModalError, getApiErrorMessage(error));
        }
    } finally {
        setCancelModalLoading(false);
    }
}


// 요청 완료 상태에서도 취소 Modal만 안전하게 닫는다.
function closeCancelModalAfterLoading() {
    cancelModalBackdrop.hidden = true;
    cancelModalForm.reset();
    cancelReasonLength.textContent = '0';
    clearElementError(cancelModalError);
}


// version 충돌 후 현재 반품의 최신 목록·상세정보를 다시 조회하고 안내한다.
async function reloadAfterVersionConflict(message) {
    const purchaseReturnId = selectedPurchaseReturn?.purchaseReturnId;

    try {
        await reloadListAndSelect(purchaseReturnId);
        showFormError(message);
    } catch (reloadError) {
        handlePageError(reloadError, '최신 매입 반품 정보를 다시 불러오지 못했습니다.');
    }
}


// HTTP 409 응답 중 version·최신 정보·선행 변경 의미가 있는 오류를 동시 수정 충돌로 판별한다.
function isVersionConflict(error) {
    if (error?.status !== 409) return false;
    const message = getApiErrorMessage(error).toLowerCase();
    return message.includes('version') || message.includes('최신') || message.includes('먼저 변경') || message.includes('먼저 처리');
}


// ========== 반응형 상세 Panel ==========

// 현재 화면이 Mobile 상세 Panel 기준인지 확인한다.
function isMobile() {
    return window.matchMedia('(max-width: 600px)').matches;
}


// Mobile에서는 선택·신규 상세만 전체 Panel로 열고 PC·Tablet에서는 상세 영역을 항상 표시한다.
function syncDetailVisibility() {
    purchaseReturnDetailSection.classList.toggle('is-open', isMobile() && mobileDetailOpen);
}


// Mobile 상세 Panel을 닫고 목록 화면으로 돌아간다.
function closeMobileDetailPanel() {
    if (!isMobile()) return;
    mobileDetailOpen = false;
    syncDetailVisibility();
}


// 화면 크기 변경 시 Mobile Panel과 PC 상세 표시 상태를 맞춘다.
function handleWindowResize() {
    if (!isMobile()) mobileDetailOpen = false;
    syncDetailVisibility();
}


// ========== Loading·오류·Modal 공통 처리 ==========

// 목록 조회 중 검색과 목록 선택을 잠시 막는다.
function setListLoading(loading) {
    purchaseReturnCard.classList.toggle('is-loading', loading);
    searchButton.disabled = loading;
    resetFilterButton.disabled = loading;
}


// 상세 요청 중 사유·수량·처리 Button을 비활성화한다.
function setDetailLoading(loading) {
    actionLoading = loading;
    purchaseReturnReason.disabled = loading || !(canEditPurchaseReturn
        && (detailMode === 'create' || selectedPurchaseReturn?.status === 'REGISTERED'));
    purchaseReturnDetailForm.querySelectorAll('.purchase-return-quantity-input').forEach(input => {
        input.disabled = loading || !(canEditPurchaseReturn
            && (detailMode === 'create' || selectedPurchaseReturn?.status === 'REGISTERED'));
    });
    savePurchaseReturnButton.disabled = loading;
    completePurchaseReturnButton.disabled = loading;
    cancelPurchaseReturnButton.disabled = loading;
}


// 신규 등록 Modal의 Select와 Button을 요청 중 비활성화한다.
function setCreateModalLoading(loading) {
    actionLoading = loading;
    createReceiptId.disabled = loading;
    closeCreateModalButton.disabled = loading;
    cancelCreateModalButton.disabled = loading;
    confirmCreateModalButton.disabled = loading;
}


// 완료 Modal의 Button을 요청 중 비활성화한다.
function setCompleteModalLoading(loading) {
    actionLoading = loading;
    closeCompleteModalButton.disabled = loading;
    cancelCompleteModalButton.disabled = loading;
    confirmCompleteButton.disabled = loading;
}


// 취소 Modal의 사유와 Button을 요청 중 비활성화한다.
function setCancelModalLoading(loading) {
    actionLoading = loading;
    cancelReason.disabled = loading;
    closeCancelModalButton.disabled = loading;
    cancelCancelModalButton.disabled = loading;
    confirmCancelButton.disabled = loading;
}


// 화면 전체 오류를 표시한다.
function showPageError(message) {
    purchaseReturnPageError.classList.remove('is-notice');
    purchaseReturnPageError.textContent = message;
    purchaseReturnPageError.hidden = false;
}


// 화면 전체 오류를 숨긴다.
function clearPageError() {
    purchaseReturnPageError.textContent = '';
    purchaseReturnPageError.hidden = true;
    purchaseReturnPageError.classList.remove('is-notice');
}


// 상세 Form 오류를 표시하고 기존 성공 안내를 숨긴다.
function showFormError(message) {
    purchaseReturnFormNotice.hidden = true;
    purchaseReturnFormError.textContent = message;
    purchaseReturnFormError.hidden = false;
}


// 상세 Form 성공·처리 안내를 표시하고 오류를 숨긴다.
function showFormNotice(message) {
    purchaseReturnFormError.hidden = true;
    purchaseReturnFormNotice.textContent = message;
    purchaseReturnFormNotice.hidden = false;
}


// 상세 Form의 오류와 안내 문구를 모두 초기화한다.
function clearFormMessages() {
    purchaseReturnFormError.textContent = '';
    purchaseReturnFormError.hidden = true;
    purchaseReturnFormNotice.textContent = '';
    purchaseReturnFormNotice.hidden = true;
}


// 지정 Modal 안에 API·검증 오류를 표시한다.
function showElementError(element, message) {
    element.textContent = message;
    element.hidden = false;
}


// 지정 Modal의 오류를 숨긴다.
function clearElementError(element) {
    element.textContent = '';
    element.hidden = true;
}


// 인증 만료는 로그인 화면으로 이동하고 나머지 오류는 공통 화면 오류로 표시한다.
function handlePageError(error, fallbackMessage) {
    if (error?.status === 401) {
        window.location.href = './login.html';
        return;
    }
    showPageError(getApiErrorMessage(error) || fallbackMessage);
}


// Modal 바깥 영역을 직접 누른 경우에만 해당 Modal을 닫는다.
function handleBackdropClick(event) {
    if (event.target !== event.currentTarget) return;
    if (event.currentTarget === createModalBackdrop) closeCreateModal();
    if (event.currentTarget === completeModalBackdrop) closeCompleteModal();
    if (event.currentTarget === cancelModalBackdrop) closeCancelModal();
}


// Escape 입력 시 현재 열린 Modal을 우선 닫는다.
function handleEscapeKey(event) {
    if (event.key !== 'Escape') return;
    if (!cancelModalBackdrop.hidden) return closeCancelModal();
    if (!completeModalBackdrop.hidden) return closeCompleteModal();
    if (!createModalBackdrop.hidden) closeCreateModal();
}


// ========== 공통 조회·표시·계산 보조 함수 ==========

// 페이지당 건수가 고정된 기준정보 API를 마지막 페이지까지 조회한다.
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


// 매입 반품 상태를 한글 Badge HTML로 변환한다.
function createPurchaseReturnStatusBadge(status) {
    const className = { REGISTERED: 'is-registered', COMPLETED: 'is-completed', CANCELED: 'is-canceled' }[status]
        ?? 'is-registered';
    return `<span class="purchase-return-status-badge ${className}">${escapeHtml(getPurchaseReturnStatusLabel(status))}</span>`;
}


// 상세 상단 Badge를 현재 매입 반품 상태로 갱신한다.
function setPurchaseReturnStatusBadge(status) {
    purchaseReturnStatusBadge.className = 'purchase-return-status-badge';
    purchaseReturnStatusBadge.classList.add({
        REGISTERED: 'is-registered', COMPLETED: 'is-completed', CANCELED: 'is-canceled'
    }[status] ?? 'is-registered');
    purchaseReturnStatusBadge.textContent = getPurchaseReturnStatusLabel(status);
}


// 매입 반품 상태 Enum을 화면 표시명으로 변환한다.
function getPurchaseReturnStatusLabel(status) {
    return { REGISTERED: '반품 등록', COMPLETED: '반품 완료', CANCELED: '반품 취소' }[status] ?? '-';
}


// 품목 단위 Enum과 OTHER 단위명을 화면 표시 문자열로 변환한다.
function getItemUnitLabel(unit, otherUnitName) {
    if (unit === 'OTHER') return otherUnitName || '기타';
    return { G: 'g', KG: 'kg', EA: '개', PACK: '팩', BOX: '박스' }[unit] ?? unit ?? '-';
}


// 매입 반품 식별자를 화면용 번호로 변환한다.
function formatPurchaseReturnNumber(id) {
    return id == null ? '-' : `PR-${String(id).padStart(8, '0')}`;
}


// 입고 식별자를 화면용 번호로 변환한다.
function formatReceiptNumber(id) {
    return id == null ? '-' : `RCV-${String(id).padStart(8, '0')}`;
}


// 발주 식별자를 화면용 번호로 변환한다.
function formatPurchaseOrderNumber(id) {
    return id == null ? '-' : `PO-${String(id).padStart(8, '0')}`;
}


// 금액을 원 단위 한국어 형식으로 표시하며 비공개 null 값은 대시로 반환한다.
function formatCurrency(value) {
    if (value == null) return '-';
    return `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(Number(value))}원`;
}


// 수량을 최대 소수점 셋째 자리까지 불필요한 0 없이 표시한다.
function formatQuantity(value) {
    const number = Number(value ?? 0);
    if (!Number.isFinite(number)) return '0';
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 3 }).format(number);
}


// LocalDate를 변형하지 않고 화면에 표시한다.
function formatDate(value) {
    return value || '-';
}


// LocalDateTime을 한국어 날짜·시간 형식으로 표시한다.
function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ');

    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date);
}


// 처리자와 처리 일시를 하나의 이력 문구로 표시한다.
function formatAction(action) {
    if (!action) return '-';
    return `${action.userName ?? '-'} · ${formatDateTime(action.processedAt)}`;
}


// 값을 안전한 Number로 변환하고 변환할 수 없으면 0을 반환한다.
function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}


// 반품 수량이 0보다 크고 소수점 셋째 자리 이내인지 확인한다.
function isPositiveQuantity(value) {
    return /^\d+(\.\d{1,3})?$/.test(String(value)) && toNumber(value) > 0;
}


// Server BigDecimal 요청에 사용할 수 있도록 소수점 셋째 자리까지 수량을 정리한다.
function normalizeQuantityRequest(value) {
    return Number(toNumber(value).toFixed(3));
}


// 현재 Server 페이지 번호를 호환 가능한 PageMeta 필드에서 반환한다.
function getCurrentPage() {
    return purchaseReturnPageMeta?.page ?? purchaseReturnPageMeta?.number ?? 0;
}


// 사용자 입력과 Server 문자열을 innerHTML에 넣기 전에 HTML 특수문자를 이스케이프한다.
function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}


// 공통 페이지 정보를 이전·현재 범위·다음 Button으로 출력한다.
function renderPagination(container, pageMeta, onMove) {
    container.innerHTML = '';
    const totalPages = pageMeta?.totalPages ?? 0;
    if (totalPages <= 1) return;

    const currentPage = pageMeta?.page ?? pageMeta?.number ?? 0;
    const startPage = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
    const endPage = Math.min(totalPages - 1, startPage + 4);

    container.append(createPageButton('이전', currentPage - 1, currentPage === 0, false, onMove));
    for (let page = startPage; page <= endPage; page += 1) {
        container.append(createPageButton(String(page + 1), page, false, page === currentPage, onMove));
    }
    container.append(createPageButton('다음', currentPage + 1, currentPage >= totalPages - 1, false, onMove));
}


// 매입 반품 목록 페이지 이동 Button 하나를 생성한다.
function createPageButton(label, page, disabled, active, onMove) {
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'purchase-return-page-button';
    button.textContent = label;
    button.disabled = disabled;
    button.classList.toggle('is-current', active);
    if (active) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => onMove(page));
    return button;
}


// ========== Event 연결 ==========

searchButton.addEventListener('click', applyFilters);
resetFilterButton.addEventListener('click', resetFilters);
receiptIdFilter.addEventListener('keydown', event => { if (event.key === 'Enter') applyFilters(); });
newPurchaseReturnButton.addEventListener('click', openCreateModal);
closeDetailButton.addEventListener('click', closeMobileDetailPanel);
purchaseReturnDetailForm.addEventListener('submit', savePurchaseReturn);
purchaseReturnItemTableBody.addEventListener('input', handleItemQuantityInput);
purchaseReturnItemMobileList.addEventListener('input', handleItemQuantityInput);
purchaseReturnReason.addEventListener('input', () => {
    reasonLength.textContent = String(purchaseReturnReason.value.length);
    formDirty = true;
});
completePurchaseReturnButton.addEventListener('click', openCompleteModal);
cancelPurchaseReturnButton.addEventListener('click', openCancelModal);

createModalForm.addEventListener('submit', startCreateMode);
closeCreateModalButton.addEventListener('click', closeCreateModal);
cancelCreateModalButton.addEventListener('click', closeCreateModal);
completeModalForm.addEventListener('submit', completePurchaseReturn);
closeCompleteModalButton.addEventListener('click', closeCompleteModal);
cancelCompleteModalButton.addEventListener('click', closeCompleteModal);
cancelModalForm.addEventListener('submit', cancelPurchaseReturn);
cancelReason.addEventListener('input', () => { cancelReasonLength.textContent = String(cancelReason.value.length); });
closeCancelModalButton.addEventListener('click', closeCancelModal);
cancelCancelModalButton.addEventListener('click', closeCancelModal);

[createModalBackdrop, completeModalBackdrop, cancelModalBackdrop]
    .forEach(backdrop => backdrop.addEventListener('click', handleBackdropClick));
document.addEventListener('keydown', handleEscapeKey);
window.addEventListener('resize', handleWindowResize);

initialize();
