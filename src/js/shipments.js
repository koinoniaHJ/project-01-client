// ********** 출고 관리 화면의 목록·상세·LOT 포장·예약·완료·납품서와 역할별 UI를 담당 **********

import { api, getApiErrorMessage } from './api.js';
import { hasRole } from './auth.js';
import { initializeCommonLayout } from './common-layout.js';


// ========== 역할·기준정보·화면 상태 ==========

let canManagePacking = false;
let canCompleteShipment = false;
let canViewAmount = false;
let customers = [];
let activeWarehouses = [];
let shipments = [];
let shipmentPageMeta = null;
let selectedShipment = null;
let packingItems = [];
let availableLots = [];
let packingWarehouseId = null;
let packingDirty = false;
let mobileDetailOpen = false;
let pendingAction = null;


// ========== 목록·검색 Element ==========

const shipmentPageError = document.querySelector('#shipmentPageError');
const customerFilter = document.querySelector('#customerFilter');
const statusFilter = document.querySelector('#statusFilter');
const startDateFilter = document.querySelector('#startDateFilter');
const endDateFilter = document.querySelector('#endDateFilter');
const searchButton = document.querySelector('#searchButton');
const resetFilterButton = document.querySelector('#resetFilterButton');
const shipmentCount = document.querySelector('#shipmentCount');
const shipmentTableBody = document.querySelector('#shipmentTableBody');
const shipmentMobileList = document.querySelector('#shipmentMobileList');
const shipmentPagination = document.querySelector('#shipmentPagination');


// ========== 상세·포장·납품서 Element ==========

const shipmentDetailSection = document.querySelector('#shipmentDetailSection');
const closeDetailButton = document.querySelector('#closeDetailButton');
const shipmentDetailEmpty = document.querySelector('#shipmentDetailEmpty');
const shipmentDetailContent = document.querySelector('#shipmentDetailContent');
const shipmentStatusBadge = document.querySelector('#shipmentStatusBadge');
const tradeStatusBadge = document.querySelector('#tradeStatusBadge');
const shipmentIdValue = document.querySelector('#shipmentIdValue');
const salesOrderIdValue = document.querySelector('#salesOrderIdValue');
const customerValue = document.querySelector('#customerValue');
const warehouseValue = document.querySelector('#warehouseValue');
const packingSequenceValue = document.querySelector('#packingSequenceValue');
const totalAmountValue = document.querySelector('#totalAmountValue');
const registeredAtValue = document.querySelector('#registeredAtValue');
const packedAtValue = document.querySelector('#packedAtValue');
const completedAtValue = document.querySelector('#completedAtValue');
const channelValue = document.querySelector('#channelValue');
const recipientValue = document.querySelector('#recipientValue');
const recipientPhoneValue = document.querySelector('#recipientPhoneValue');
const deliveryAddressValue = document.querySelector('#deliveryAddressValue');
const memoValue = document.querySelector('#memoValue');
const shipmentWarehouse = document.querySelector('#shipmentWarehouse');
const lotLoadingMessage = document.querySelector('#lotLoadingMessage');
const shipmentPackingItems = document.querySelector('#shipmentPackingItems');
const deliveryNoteCount = document.querySelector('#deliveryNoteCount');
const deliveryNoteTableBody = document.querySelector('#deliveryNoteTableBody');
const shipmentFormNotice = document.querySelector('#shipmentFormNotice');
const shipmentFormError = document.querySelector('#shipmentFormError');
const unpackButton = document.querySelector('#unpackButton');
const savePackingButton = document.querySelector('#savePackingButton');
const packButton = document.querySelector('#packButton');
const completeShipmentButton = document.querySelector('#completeShipmentButton');


// ========== 처리 확인 Modal Element ==========

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
const unpackModalBackdrop = document.querySelector('#unpackModalBackdrop');
const unpackModalForm = document.querySelector('#unpackModalForm');
const unpackModalTarget = document.querySelector('#unpackModalTarget');
const unpackReason = document.querySelector('#unpackReason');
const unpackReasonLength = document.querySelector('#unpackReasonLength');
const unpackModalError = document.querySelector('#unpackModalError');
const closeUnpackModalButton = document.querySelector('#closeUnpackModalButton');
const cancelUnpackModalButton = document.querySelector('#cancelUnpackModalButton');
const confirmUnpackButton = document.querySelector('#confirmUnpackButton');


// ========== 화면 초기화·역할 제어 ==========

// 공통 Layout과 역할별 기능 범위를 적용한 뒤 기준정보와 첫 출고 페이지를 조회한다.
async function initialize() {
    try {
        const currentUser = await initializeCommonLayout({ pageTitle: '출고 관리', activeMenu: 'shipments', onError: showPageError });
        if (!currentUser) return;

        applyRoleAccess();
        await Promise.all([loadCustomerOptions(), loadActiveWarehouseOptions()]);
        await loadShipments(0);
        await applyDefaultShipmentDetailState();
    } catch (error) {
        handlePageError(error, '출고 관리 화면을 초기화하지 못했습니다.');
    }
}

// ADMIN·WAREHOUSE는 포장을 처리하고 실제 출고 완료는 ADMIN만 처리하며 WAREHOUSE에는 판매 금액을 숨긴다.
function applyRoleAccess() {
    canManagePacking = hasRole('ADMIN', 'WAREHOUSE');
    canCompleteShipment = hasRole('ADMIN');
    canViewAmount = hasRole('ADMIN', 'OFFICE');

    document.querySelectorAll('[data-office-information="amount"]').forEach(element => {
        element.hidden = !canViewAmount;
    });
}


// ========== 거래처·창고 기준정보 조회 ==========

async function loadCustomerOptions() {
    customers = await loadAllPages('/customers');
    customerFilter.innerHTML = '<option value="">전체</option>';
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = String(customer.customerId);
        option.textContent = `${customer.customerCode} · ${customer.customerName}`;
        customerFilter.append(option);
    });
}

async function loadActiveWarehouseOptions() {
    activeWarehouses = await loadAllPages('/warehouses?status=ACTIVE');
    renderWarehouseOptions();
}

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
    } while (page < totalPages);

    return loaded;
}

function renderWarehouseOptions() {
    shipmentWarehouse.innerHTML = '<option value="">창고 선택</option>';
    activeWarehouses.forEach(warehouse => {
        const option = document.createElement('option');
        option.value = String(warehouse.warehouseId);
        option.textContent = `${warehouse.warehouseCode} · ${warehouse.warehouseName}`;
        shipmentWarehouse.append(option);
    });
    ensureSelectedWarehouseOption();
    shipmentWarehouse.value = packingWarehouseId === null ? '' : String(packingWarehouseId);
}

// 출고 후 창고가 INACTIVE가 되어도 완료·취소 이력에는 기존 창고 표시를 유지한다.
function ensureSelectedWarehouseOption() {
    if (!selectedShipment?.warehouseId) return;
    const exists = Array.from(shipmentWarehouse.options)
        .some(option => option.value === String(selectedShipment.warehouseId));
    if (exists) return;

    const option = document.createElement('option');
    option.value = String(selectedShipment.warehouseId);
    option.textContent = `${selectedShipment.warehouseCode} · ${selectedShipment.warehouseName}`;
    shipmentWarehouse.append(option);
}


// ========== 출고 목록 조회·검색·Pagination ==========

function createShipmentListPath(page) {
    const parameters = new URLSearchParams({ page: String(page) });
    if (customerFilter.value) parameters.set('customerId', customerFilter.value);
    if (statusFilter.value) parameters.set('status', statusFilter.value);
    if (startDateFilter.value) parameters.set('startDate', startDateFilter.value);
    if (endDateFilter.value) parameters.set('endDate', endDateFilter.value);
    return `/shipments?${parameters.toString()}`;
}

async function loadShipments(page) {
    setShipmentListLoading(true);
    try {
        const response = await api.get(createShipmentListPath(page));
        shipments = response.data ?? [];
        shipmentPageMeta = response.meta;
        shipmentCount.textContent = `총 ${shipmentPageMeta?.totalElements ?? 0}건`;
        renderShipmentTable();
        renderShipmentMobileList();
        renderPagination(shipmentPagination, shipmentPageMeta, loadShipments);
        renderSelectedShipment();
    } finally {
        setShipmentListLoading(false);
    }
}

function renderShipmentTable() {
    shipmentTableBody.innerHTML = '';
    if (shipments.length === 0) {
        shipmentTableBody.innerHTML = '<tr><td colspan="8" class="shipment-empty-cell">조회된 출고가 없습니다.</td></tr>';
        return;
    }

    shipments.forEach(shipment => {
        const row = document.createElement('tr');
        row.dataset.shipmentId = String(shipment.shipmentId);
        row.tabIndex = 0;
        row.innerHTML = `
            <td>${escapeHtml(formatShipmentNumber(shipment.shipmentId))}</td>
            <td>${escapeHtml(formatSalesOrderNumber(shipment.salesOrderId))}</td>
            <td title="${escapeHtml(`${shipment.customerCode} · ${shipment.customerName}`)}">${escapeHtml(`${shipment.customerCode} · ${shipment.customerName}`)}</td>
            <td>${escapeHtml(formatDateTime(shipment.registeredAt))}</td>
            <td>${createShipmentStatusBadge(shipment.status)}</td>
            <td>${escapeHtml(createWarehouseLabel(shipment))}</td>
            <td>${createTradeStatusBadge(shipment.customerTradeStatus)}</td>
            <td>${escapeHtml(formatLatestAction(shipment))}</td>`;
        row.addEventListener('click', () => selectShipment(shipment.shipmentId));
        row.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectShipment(shipment.shipmentId);
            }
        });
        shipmentTableBody.append(row);
    });
}

function renderShipmentMobileList() {
    shipmentMobileList.innerHTML = '';
    if (shipments.length === 0) {
        shipmentMobileList.innerHTML = '<p class="shipment-mobile-empty">조회된 출고가 없습니다.</p>';
        return;
    }

    shipments.forEach(shipment => {
        const card = document.createElement('article');
        card.className = 'shipment-mobile-card';
        card.dataset.shipmentId = String(shipment.shipmentId);
        card.tabIndex = 0;
        card.innerHTML = `
            <div class="shipment-mobile-card-header"><strong class="shipment-mobile-card-title">${escapeHtml(formatShipmentNumber(shipment.shipmentId))}</strong>${createShipmentStatusBadge(shipment.status)}</div>
            <div class="shipment-mobile-fields">
                ${createMobileField('주문', formatSalesOrderNumber(shipment.salesOrderId))}
                ${createMobileField('거래처', `${shipment.customerCode} · ${shipment.customerName}`)}
                ${createMobileField('창고', createWarehouseLabel(shipment))}
                ${createMobileField('주문 접수', formatDateTime(shipment.registeredAt))}
                ${createMobileField('거래 상태', getTradeStatusLabel(shipment.customerTradeStatus))}
                ${createMobileField('최근 처리', formatLatestAction(shipment))}
            </div>`;
        card.addEventListener('click', () => selectShipment(shipment.shipmentId));
        card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectShipment(shipment.shipmentId);
            }
        });
        shipmentMobileList.append(card);
    });
}

function createMobileField(label, value) {
    return `<div class="shipment-mobile-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? '-')}</strong></div>`;
}

function validateFilters() {
    if (startDateFilter.value && endDateFilter.value && startDateFilter.value > endDateFilter.value) {
        throw new Error('접수 시작일은 종료일보다 늦을 수 없습니다.');
    }
}

async function applyFilters() {
    try {
        clearPageError();
        validateFilters();
        selectedShipment = null;
        await loadShipments(0);
        await applyDefaultShipmentDetailState();
    } catch (error) {
        handlePageError(error, '출고 검색 조건을 적용하지 못했습니다.');
    }
}

async function resetFilters() {
    customerFilter.value = '';
    statusFilter.value = '';
    startDateFilter.value = '';
    endDateFilter.value = '';
    await applyFilters();
}


// ========== 출고 상세 조회·출력 ==========

async function selectShipment(shipmentId, openMobilePanel = true) {
    setShipmentDetailLoading(true);
    clearShipmentMessages();
    try {
        const response = await api.get(`/shipments/${shipmentId}`);
        applyDetailResponse(response.data);
        mobileDetailOpen = openMobilePanel && isMobile();
        renderShipmentDetail();
        renderSelectedShipment();
        syncDetailVisibility();

        if (selectedShipment.status === 'PENDING' && packingWarehouseId !== null) {
            await loadAvailableLots();
        }
    } catch (error) {
        handlePageError(error, '출고 상세정보를 조회하지 못했습니다.');
    } finally {
        setShipmentDetailLoading(false);
    }
}

function applyDetailResponse(detail) {
    selectedShipment = detail;
    packingWarehouseId = detail.warehouseId ?? null;
    availableLots = [];
    packingDirty = false;
    packingItems = (detail.items ?? []).map(item => ({
        ...item,
        allocations: (item.lots ?? []).map(lot => ({ ...lot, packedQuantity: formatQuantityInput(lot.packedQuantity) }))
    }));
}

async function applyDefaultShipmentDetailState() {
    if (!isMobile() && shipments.length > 0) {
        await selectShipment(shipments[0].shipmentId, false);
        return;
    }
    clearShipmentDetail();
}

function renderShipmentDetail() {
    if (!selectedShipment) {
        clearShipmentDetail();
        return;
    }

    shipmentDetailEmpty.hidden = true;
    shipmentDetailContent.hidden = false;
    setShipmentStatusBadge(selectedShipment.status);
    setTradeStatusBadge(selectedShipment.customerTradeStatus);
    shipmentIdValue.textContent = formatShipmentNumber(selectedShipment.shipmentId);
    salesOrderIdValue.textContent = formatSalesOrderNumber(selectedShipment.salesOrderId);
    customerValue.textContent = `${selectedShipment.customerCode} · ${selectedShipment.customerName}`;
    warehouseValue.textContent = createWarehouseLabel(selectedShipment);
    packingSequenceValue.textContent = `${selectedShipment.packingSequence ?? 0}회`;
    totalAmountValue.textContent = formatCurrency(selectedShipment.totalAmount);
    registeredAtValue.textContent = formatDateTime(findListRegisteredAt(selectedShipment.shipmentId));
    packedAtValue.textContent = formatDateTime(selectedShipment.packed?.processedAt);
    completedAtValue.textContent = formatDateTime(selectedShipment.completed?.processedAt);
    channelValue.textContent = getOrderChannelLabel(selectedShipment.channel);
    recipientValue.textContent = selectedShipment.recipientName || '-';
    recipientPhoneValue.textContent = selectedShipment.recipientPhone || '-';
    deliveryAddressValue.textContent = joinAddress(selectedShipment.deliveryPostalCode,
        selectedShipment.deliveryAddress, selectedShipment.deliveryAddressDetail);
    memoValue.textContent = selectedShipment.memo || '-';

    renderWarehouseOptions();
    renderPackingItems();
    renderDeliveryNotes();
    applyShipmentActionAccess();
}

function clearShipmentDetail() {
    selectedShipment = null;
    packingItems = [];
    availableLots = [];
    packingWarehouseId = null;
    packingDirty = false;
    shipmentDetailEmpty.hidden = false;
    shipmentDetailContent.hidden = true;
    renderSelectedShipment();
}

function renderSelectedShipment() {
    document.querySelectorAll('[data-shipment-id]').forEach(element => {
        element.classList.toggle('is-selected', Number(element.dataset.shipmentId) === selectedShipment?.shipmentId);
    });
}


// ========== 출고 가능 LOT 조회·포장안 편집 ==========

async function loadAvailableLots() {
    if (!selectedShipment || packingWarehouseId === null || selectedShipment.status !== 'PENDING') return;

    lotLoadingMessage.hidden = false;
    shipmentWarehouse.disabled = true;
    try {
        const response = await api.get(`/shipments/${selectedShipment.shipmentId}/available-lots?warehouseId=${packingWarehouseId}`);
        availableLots = response.data ?? [];
        mergeLatestAvailableLotInformation();
        renderPackingItems();
    } catch (error) {
        showShipmentFormError(getApiErrorMessage(error) || '출고 가능한 LOT를 조회하지 못했습니다.');
    } finally {
        lotLoadingMessage.hidden = true;
        applyShipmentActionAccess();
    }
}

// 저장된 포장안과 최신 가용 LOT가 같으면 화면의 재고 수량·상태를 최신 조회값으로 교체한다.
function mergeLatestAvailableLotInformation() {
    const latestById = new Map(availableLots.map(lot => [Number(lot.inventoryLotId), lot]));
    packingItems.forEach(item => {
        item.allocations.forEach(allocation => {
            const latest = latestById.get(Number(allocation.inventoryLotId));
            if (latest) Object.assign(allocation, latest, { packedQuantity: allocation.packedQuantity });
        });
    });
}

async function handleWarehouseChange() {
    const nextWarehouseId = shipmentWarehouse.value ? Number(shipmentWarehouse.value) : null;
    if (nextWarehouseId === packingWarehouseId) return;

    const hasAllocations = packingItems.some(item => item.allocations.length > 0);
    if (hasAllocations) {
        const confirmed = await confirmChange('출고 창고를 변경하면 현재 LOT 배정이 초기화됩니다. 변경하시겠습니까?');
        if (!confirmed) {
            shipmentWarehouse.value = packingWarehouseId === null ? '' : String(packingWarehouseId);
            return;
        }
    }

    packingWarehouseId = nextWarehouseId;
    availableLots = [];
    packingDirty = true;
    packingItems.forEach(item => { item.allocations = []; });
    clearShipmentMessages();
    renderPackingItems();
    warehouseValue.textContent = nextWarehouseId === null ? '미선택' : getWarehouseOptionLabel(nextWarehouseId);
    if (nextWarehouseId !== null) await loadAvailableLots();
}

function renderPackingItems() {
    shipmentPackingItems.innerHTML = '';
    if (packingItems.length === 0) {
        shipmentPackingItems.innerHTML = '<p class="shipment-lot-guide">출고할 주문 품목이 없습니다.</p>';
        return;
    }

    const editable = isPackingEditable();
    packingItems.forEach((item, itemIndex) => {
        const card = document.createElement('article');
        card.className = 'shipment-item-card';
        const packedQuantity = sumQuantities(item.allocations.map(allocation => allocation.packedQuantity));
        const shortage = Math.max(0, toNumber(item.orderQuantity) - packedQuantity);
        card.innerHTML = `
            <div class="shipment-item-header">
                <div class="shipment-item-title">
                    <strong>${escapeHtml(`${item.itemCode} · ${item.itemName}`)}</strong>
                    <span>${escapeHtml(item.unit)} / 주문 ${escapeHtml(formatQuantity(item.orderQuantity))}</span>
                    <span class="shipment-item-totals${shortage > 0 ? ' is-short' : ''}">포장 ${escapeHtml(formatQuantity(packedQuantity))} · 차이 ${escapeHtml(formatQuantity(shortage))}</span>
                </div>
                <button type="button" class="button button-secondary shipment-add-lot" data-add-lot="${itemIndex}"${editable ? '' : ' hidden'}>LOT 추가</button>
            </div>
            <div class="shipment-allocation-table-wrap">
                <table class="shipment-allocation-table">
                    <colgroup><col style="width:20%"><col style="width:10%"><col style="width:9%"><col style="width:10%"><col style="width:10%"><col style="width:10%"><col style="width:11%"><col style="width:10%"><col style="width:7%"><col style="width:3%"></colgroup>
                    <thead><tr><th>LOT</th><th>사용기한</th><th>상태</th><th>현재재고</th><th>예약재고</th><th>가용재고</th><th>실사·조정 제한</th><th>포장 수량</th><th>예약</th><th>관리</th></tr></thead>
                    <tbody>${createAllocationRowsHtml(item, itemIndex, editable)}</tbody>
                </table>
            </div>`;
        shipmentPackingItems.append(card);
    });

    connectPackingItemEvents();
}

function createAllocationRowsHtml(item, itemIndex, editable) {
    if (item.allocations.length === 0) {
        return '<tr><td colspan="10" class="shipment-allocation-empty">배정된 LOT가 없습니다.</td></tr>';
    }

    return item.allocations.map((allocation, allocationIndex) => `
        <tr class="shipment-allocation-row">
            <td><select data-lot-select="${itemIndex}:${allocationIndex}"${editable ? '' : ' disabled'}>${createLotOptions(item, allocation)}</select></td>
            <td>${escapeHtml(formatDate(allocation.expiryDate))}</td>
            <td>${createLotStatusBadge(allocation.status)}</td>
            <td>${escapeHtml(formatQuantity(allocation.currentQuantity))}</td>
            <td>${escapeHtml(formatQuantity(allocation.reservedQuantity))}</td>
            <td>${escapeHtml(formatQuantity(allocation.availableQuantity))}</td>
            <td>${allocation.inventoryWorkRestricted ? '<span class="shipment-restriction-badge">제한</span>' : '없음'}</td>
            <td><input type="number" min="0.001" step="0.001" data-packed-quantity="${itemIndex}:${allocationIndex}" value="${escapeHtml(allocation.packedQuantity)}"${editable ? '' : ' disabled'}></td>
            <td>${allocation.reserved ? '예약됨' : '미예약'}</td>
            <td><button type="button" class="shipment-remove-lot" data-remove-lot="${itemIndex}:${allocationIndex}" aria-label="LOT 배정 삭제"${editable ? '' : ' hidden'}>×</button></td>
        </tr>`).join('');
}

function createLotOptions(item, selectedAllocation) {
    const candidates = getAvailableLotsForItem(item.salesOrderItemId);
    const selectedId = Number(selectedAllocation.inventoryLotId);
    const selectedExists = candidates.some(lot => Number(lot.inventoryLotId) === selectedId);
    const options = [];

    if (!selectedExists && selectedId) {
        options.push(`<option value="${selectedId}" selected>${escapeHtml(`${selectedAllocation.lotNumber} · 현재 선택 LOT`)}</option>`);
    }
    candidates.forEach(lot => {
        const selected = Number(lot.inventoryLotId) === selectedId ? ' selected' : '';
        options.push(`<option value="${lot.inventoryLotId}"${selected}>${escapeHtml(`${lot.lotNumber} · ${formatDate(lot.expiryDate)} · 가용 ${formatQuantity(lot.availableQuantity)}`)}</option>`);
    });
    return options.join('');
}

function getAvailableLotsForItem(salesOrderItemId) {
    return availableLots.filter(lot => Number(lot.salesOrderItemId) === Number(salesOrderItemId));
}

function connectPackingItemEvents() {
    shipmentPackingItems.querySelectorAll('[data-add-lot]').forEach(button => {
        button.addEventListener('click', () => addLotAllocation(Number(button.dataset.addLot)));
    });
    shipmentPackingItems.querySelectorAll('[data-remove-lot]').forEach(button => {
        button.addEventListener('click', () => removeLotAllocation(button.dataset.removeLot));
    });
    shipmentPackingItems.querySelectorAll('[data-lot-select]').forEach(select => {
        select.addEventListener('change', () => changeLotAllocation(select.dataset.lotSelect, select.value));
    });
    shipmentPackingItems.querySelectorAll('[data-packed-quantity]').forEach(input => {
        input.addEventListener('input', () => changePackedQuantity(input.dataset.packedQuantity, input.value));
    });
}

function addLotAllocation(itemIndex) {
    const item = packingItems[itemIndex];
    const usedIds = new Set(packingItems.flatMap(row => row.allocations.map(allocation => Number(allocation.inventoryLotId))));
    const candidate = getAvailableLotsForItem(item.salesOrderItemId)
        .find(lot => !usedIds.has(Number(lot.inventoryLotId)));

    if (!candidate) {
        showShipmentFormError('추가로 선택할 수 있는 출고 가능 LOT가 없습니다.');
        return;
    }

    clearShipmentMessages();
    item.allocations.push({ ...candidate, packedQuantity: '' });
    packingDirty = true;
    renderPackingItems();
}

function removeLotAllocation(position) {
    const [itemIndex, allocationIndex] = parsePosition(position);
    packingItems[itemIndex].allocations.splice(allocationIndex, 1);
    packingDirty = true;
    clearShipmentMessages();
    renderPackingItems();
}

function changeLotAllocation(position, inventoryLotIdValue) {
    const [itemIndex, allocationIndex] = parsePosition(position);
    const item = packingItems[itemIndex];
    const candidate = getAvailableLotsForItem(item.salesOrderItemId)
        .find(lot => Number(lot.inventoryLotId) === Number(inventoryLotIdValue));
    if (!candidate) return;

    const quantity = item.allocations[allocationIndex].packedQuantity;
    item.allocations[allocationIndex] = { ...candidate, packedQuantity: quantity };
    packingDirty = true;
    clearShipmentMessages();
    renderPackingItems();
}

function changePackedQuantity(position, value) {
    const [itemIndex, allocationIndex] = parsePosition(position);
    packingItems[itemIndex].allocations[allocationIndex].packedQuantity = value;
    packingDirty = true;
    clearShipmentMessages();
    updatePackingTotalsOnly();
}

function updatePackingTotalsOnly() {
    shipmentPackingItems.querySelectorAll('.shipment-item-card').forEach((card, index) => {
        const item = packingItems[index];
        const packed = sumQuantities(item.allocations.map(allocation => allocation.packedQuantity));
        const shortage = Math.max(0, toNumber(item.orderQuantity) - packed);
        const totals = card.querySelector('.shipment-item-totals');
        totals.textContent = `포장 ${formatQuantity(packed)} · 차이 ${formatQuantity(shortage)}`;
        totals.classList.toggle('is-short', shortage > 0);
    });
}


// ========== 포장안 저장·version 충돌 ==========

async function savePacking() {
    clearShipmentMessages();
    if (!validatePacking(false)) return;
    setShipmentFormLoading(true);

    try {
        const response = await api.put(`/shipments/${selectedShipment.shipmentId}/packing`, createPackingRequest());
        applyDetailResponse(response.data);
        renderShipmentDetail();
        await loadAvailableLots();
        await loadShipments(getCurrentPage());
        showShipmentFormNotice('출고 창고와 LOT별 포장 수량이 저장되었습니다. 재고는 아직 예약되지 않았습니다.');
    } catch (error) {
        if (!await handleShipmentVersionConflict(error)) {
            showShipmentFormError(getApiErrorMessage(error) || '출고 포장안을 저장하지 못했습니다.');
        }
    } finally {
        setShipmentFormLoading(false);
    }
}

function validatePacking(requireFullQuantity) {
    if (!selectedShipment || selectedShipment.status !== 'PENDING') {
        showShipmentFormError('출고 대기 상태에서만 포장 정보를 변경할 수 있습니다.');
        return false;
    }
    if (packingWarehouseId === null) {
        showShipmentFormError('출고 창고를 선택해 주세요.');
        shipmentWarehouse.focus();
        return false;
    }

    const allocations = packingItems.flatMap(item => item.allocations);
    if (allocations.length === 0) {
        showShipmentFormError('포장할 재고 LOT를 하나 이상 선택해 주세요.');
        return false;
    }

    const inventoryLotIds = new Set();
    for (const item of packingItems) {
        for (const allocation of item.allocations) {
            if (!allocation.inventoryLotId || inventoryLotIds.has(Number(allocation.inventoryLotId))) {
                showShipmentFormError('같은 재고 LOT를 포장안에 중복 입력할 수 없습니다.');
                return false;
            }
            inventoryLotIds.add(Number(allocation.inventoryLotId));
            if (!isValidQuantity(allocation.packedQuantity)) {
                showShipmentFormError('포장 수량은 0보다 크고 소수점 셋째 자리까지 입력해 주세요.');
                return false;
            }
        }

        const packed = sumQuantities(item.allocations.map(allocation => allocation.packedQuantity));
        const comparison = compareQuantity(packed, item.orderQuantity);
        if (comparison > 0) {
            showShipmentFormError(`${item.itemName}의 포장 수량이 주문 수량을 초과합니다.`);
            return false;
        }
        if (requireFullQuantity && comparison !== 0) {
            showShipmentFormError(`${item.itemName}의 포장 수량을 주문 수량과 일치시켜 주세요.`);
            return false;
        }
    }
    return true;
}

function createPackingRequest() {
    return {
        warehouseId: packingWarehouseId,
        version: selectedShipment.version,
        lotAllocations: packingItems.flatMap(item => item.allocations.map(allocation => ({
            salesOrderItemId: item.salesOrderItemId,
            inventoryLotId: Number(allocation.inventoryLotId),
            packedQuantity: Number(allocation.packedQuantity)
        })))
    };
}

async function handleShipmentVersionConflict(error) {
    if (error?.status !== 409 || !String(getApiErrorMessage(error)).includes('최신 출고')) return false;
    const shipmentId = selectedShipment?.shipmentId;
    if (shipmentId) await reloadCurrentPageAndSelect(shipmentId, getApiErrorMessage(error));
    return true;
}


// ========== 포장 완료·실제 출고 완료 확인 Modal ==========

function openActionModal(action) {
    if (!selectedShipment) return;
    clearShipmentMessages();
    if (action === 'pack' && packingDirty) {
        showShipmentFormError('변경한 출고 창고와 LOT별 포장 수량을 먼저 저장해 주세요.');
        return;
    }
    if (action === 'pack' && !validatePacking(true)) return;

    pendingAction = action;
    const packing = action === 'pack';
    actionModalTitle.textContent = packing ? '포장 완료' : '출고 완료';
    actionModalTarget.textContent = formatShipmentNumber(selectedShipment.shipmentId);
    actionModalCurrentValue.textContent = packing ? '출고 대기' : '포장 완료';
    actionModalNextValue.textContent = packing ? '포장 완료' : '출고 완료';
    actionModalDescription.textContent = packing
        ? '저장된 LOT별 포장 수량을 최신 가용재고에서 예약하고 새로운 납품서를 발행합니다.'
        : '실제 상품 인계를 확정하면 현재·예약 재고가 감소하고 매출 전표와 미수금이 함께 반영됩니다.';
    confirmActionButton.textContent = packing ? '포장 완료' : '출고 완료';
    clearElementError(actionModalError);
    actionModalBackdrop.hidden = false;
}

function closeActionModal() {
    if (confirmActionButton.disabled) return;
    pendingAction = null;
    actionModalBackdrop.hidden = true;
    clearElementError(actionModalError);
}

async function handleActionModalSubmit(event) {
    event.preventDefault();
    if (!selectedShipment || !pendingAction) return;
    setActionModalLoading(true);

    try {
        const shipmentId = selectedShipment.shipmentId;
        if (pendingAction === 'pack') {
            await api.post(`/shipments/${shipmentId}/pack`, { version: selectedShipment.version });
            closeActionModalAfterLoading();
            await reloadCurrentPageAndSelect(shipmentId, '포장이 완료되어 재고가 예약되고 납품서가 발행되었습니다.');
        } else {
            const response = await api.post(`/shipments/${shipmentId}/complete`, { version: selectedShipment.version });
            closeActionModalAfterLoading();
            const outstanding = formatCurrency(response.data?.outstandingAmount);
            await reloadCurrentPageAndSelect(shipmentId,
                `출고와 주문이 완료되고 매출 전표가 생성되었습니다. 현재 미수 잔액은 ${outstanding}입니다.`);
        }
    } catch (error) {
        if (await handleShipmentVersionConflict(error)) closeActionModalAfterLoading();
        else showElementError(actionModalError, getApiErrorMessage(error) || '출고 상태를 변경하지 못했습니다.');
    } finally {
        setActionModalLoading(false);
    }
}

function closeActionModalAfterLoading() {
    pendingAction = null;
    actionModalBackdrop.hidden = true;
    clearElementError(actionModalError);
}


// ========== 포장 취소 Modal ==========

function openUnpackModal() {
    if (!selectedShipment || selectedShipment.status !== 'PACKED') return;
    unpackModalTarget.textContent = formatShipmentNumber(selectedShipment.shipmentId);
    unpackReason.value = '';
    updateUnpackReasonLength();
    clearElementError(unpackModalError);
    unpackModalBackdrop.hidden = false;
    unpackReason.focus();
}

function closeUnpackModal() {
    if (confirmUnpackButton.disabled) return;
    unpackModalBackdrop.hidden = true;
    clearElementError(unpackModalError);
}

async function handleUnpackModalSubmit(event) {
    event.preventDefault();
    const reason = unpackReason.value.trim();
    if (!reason) {
        showElementError(unpackModalError, '포장 취소 사유를 입력해 주세요.');
        unpackReason.focus();
        return;
    }

    setUnpackModalLoading(true);
    try {
        const shipmentId = selectedShipment.shipmentId;
        await api.post(`/shipments/${shipmentId}/unpack`, { reason, version: selectedShipment.version });
        closeUnpackModalAfterLoading();
        await reloadCurrentPageAndSelect(shipmentId,
            '포장이 취소되어 재고 예약이 해제되고 현재 납품서가 무효 처리되었습니다.');
    } catch (error) {
        if (await handleShipmentVersionConflict(error)) closeUnpackModalAfterLoading();
        else showElementError(unpackModalError, getApiErrorMessage(error) || '포장을 취소하지 못했습니다.');
    } finally {
        setUnpackModalLoading(false);
    }
}

function closeUnpackModalAfterLoading() {
    unpackModalBackdrop.hidden = true;
    clearElementError(unpackModalError);
}

function updateUnpackReasonLength() {
    unpackReasonLength.textContent = String(unpackReason.value.length);
}


// ========== 납품서 이력·PDF ==========

function renderDeliveryNotes() {
    const notes = selectedShipment?.deliveryNotes ?? [];
    deliveryNoteCount.textContent = `총 ${notes.length}건`;
    deliveryNoteTableBody.innerHTML = '';
    if (notes.length === 0) {
        deliveryNoteTableBody.innerHTML = '<tr><td colspan="6" class="shipment-note-empty">발행된 납품서가 없습니다.</td></tr>';
        return;
    }

    notes.forEach(note => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${note.issueSequence}회</td>
            <td>${createDeliveryNoteStatusBadge(note.status)}</td>
            <td>${escapeHtml(formatAction(note.issued))}</td>
            <td>${escapeHtml(formatAction(note.voided))}</td>
            <td title="${escapeHtml(note.voidReason ?? '-')}">${escapeHtml(note.voidReason ?? '-')}</td>
            <td>${note.status === 'ACTIVE' ? `<button type="button" class="button button-secondary shipment-pdf-button" data-note-sequence="${note.issueSequence}">PDF</button>` : '-'}</td>`;
        deliveryNoteTableBody.append(row);
    });

    deliveryNoteTableBody.querySelectorAll('[data-note-sequence]').forEach(button => {
        button.addEventListener('click', () => downloadDeliveryNote(Number(button.dataset.noteSequence), button));
    });
}

async function downloadDeliveryNote(issueSequence, button) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '생성 중';
    clearShipmentMessages();

    try {
        const blob = await api.download(`/shipments/${selectedShipment.shipmentId}/delivery-notes/${issueSequence}/pdf`);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `delivery-note-${selectedShipment.shipmentId}-${issueSequence}.pdf`;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showShipmentFormNotice('현재 유효한 납품서 PDF를 생성했습니다.');
    } catch (error) {
        showShipmentFormError(getApiErrorMessage(error) || '납품서 PDF를 내려받지 못했습니다.');
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}


// ========== 역할·상태별 상세 제어 ==========

function applyShipmentActionAccess() {
    if (!selectedShipment) return;
    const pending = selectedShipment.status === 'PENDING';
    const packed = selectedShipment.status === 'PACKED';
    const editable = pending && canManagePacking;

    shipmentWarehouse.disabled = !editable || !lotLoadingMessage.hidden;
    savePackingButton.hidden = !editable;
    packButton.hidden = !editable;
    unpackButton.hidden = !(packed && canManagePacking);
    completeShipmentButton.hidden = !(packed && canCompleteShipment);
}

function isPackingEditable() {
    return Boolean(selectedShipment && selectedShipment.status === 'PENDING' && canManagePacking);
}


// ========== 목록·상세 동기화 ==========

async function reloadCurrentPageAndSelect(shipmentId, notice) {
    await loadShipments(getCurrentPage());
    const remainsOnPage = shipments.some(shipment => shipment.shipmentId === shipmentId);
    if (remainsOnPage) await selectShipment(shipmentId, isMobile());
    else if (!isMobile() && shipments.length > 0) await selectShipment(shipments[0].shipmentId, false);
    else clearShipmentDetail();
    if (selectedShipment?.shipmentId === shipmentId && notice) showShipmentFormNotice(notice);
}


// ========== 상태·표시·계산 보조 함수 ==========

function createShipmentStatusBadge(status) {
    return `<span class="shipment-status-badge is-${String(status ?? 'pending').toLowerCase()}">${escapeHtml(getShipmentStatusLabel(status))}</span>`;
}

function setShipmentStatusBadge(status) {
    shipmentStatusBadge.className = `shipment-status-badge is-${String(status ?? 'pending').toLowerCase()}`;
    shipmentStatusBadge.textContent = getShipmentStatusLabel(status);
}

function getShipmentStatusLabel(status) {
    return ({ PENDING: '출고 대기', PACKED: '포장 완료', COMPLETED: '출고 완료', CANCELED: '출고 취소' })[status] ?? status ?? '-';
}

function createTradeStatusBadge(status) {
    return `<span class="shipment-trade-badge is-${String(status ?? 'normal').toLowerCase()}">${escapeHtml(getTradeStatusLabel(status))}</span>`;
}

function setTradeStatusBadge(status) {
    tradeStatusBadge.className = `shipment-trade-badge is-${String(status ?? 'normal').toLowerCase()}`;
    tradeStatusBadge.textContent = getTradeStatusLabel(status);
}

function getTradeStatusLabel(status) {
    return status === 'HOLD' ? '거래 중지' : '정상 거래';
}

function createLotStatusBadge(status) {
    if (!status) return '-';
    const label = status === 'AVAILABLE' ? '출고 가능' : '출고 제한';
    return `<span class="shipment-lot-badge is-${status.toLowerCase()}">${label}</span>`;
}

function createDeliveryNoteStatusBadge(status) {
    const label = status === 'ACTIVE' ? '유효' : '무효';
    return `<span class="shipment-note-badge is-${String(status).toLowerCase()}">${label}</span>`;
}

function getOrderChannelLabel(channel) {
    return ({ VISIT: '방문', PHONE: '전화', MESSAGE: '문자·메시지' })[channel] ?? channel ?? '-';
}

function formatShipmentNumber(id) {
    return id ? `SHP-${String(id).padStart(8, '0')}` : '-';
}

function formatSalesOrderNumber(id) {
    return id ? `SO-${String(id).padStart(8, '0')}` : '-';
}

function createWarehouseLabel(value) {
    return value?.warehouseId ? `${value.warehouseCode} · ${value.warehouseName}` : '미선택';
}

function getWarehouseOptionLabel(warehouseId) {
    const warehouse = activeWarehouses.find(item => Number(item.warehouseId) === Number(warehouseId));
    return warehouse ? `${warehouse.warehouseCode} · ${warehouse.warehouseName}` : '선택 창고';
}

function formatLatestAction(shipment) {
    return formatDateTime(shipment.completedAt ?? shipment.packedAt ?? shipment.registeredAt);
}

function findListRegisteredAt(shipmentId) {
    return shipments.find(shipment => shipment.shipmentId === shipmentId)?.registeredAt ?? null;
}

function joinAddress(postalCode, address, detail) {
    const values = [];
    if (postalCode) values.push(`[${postalCode}]`);
    if (address) values.push(address);
    if (detail) values.push(detail);
    return values.join(' ') || '-';
}

function formatCurrency(value) {
    if (value === null || value === undefined) return '-';
    return `${Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원`;
}

function formatQuantity(value) {
    if (value === null || value === undefined || value === '') return '0';
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString('ko-KR', { maximumFractionDigits: 3 }) : '0';
}

function formatQuantityInput(value) {
    if (value === null || value === undefined) return '';
    return String(Number(value));
}

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('ko-KR');
}

function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    });
}

function formatAction(action) {
    if (!action) return '-';
    return `${action.userName ?? '-'} · ${formatDateTime(action.processedAt)}`;
}

function parsePosition(value) {
    return value.split(':').map(Number);
}

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function isValidQuantity(value) {
    const text = String(value ?? '').trim();
    return /^\d{1,16}(\.\d{1,3})?$/.test(text) && Number(text) > 0;
}

function sumQuantities(values) {
    return Math.round(values.reduce((sum, value) => sum + toNumber(value), 0) * 1000) / 1000;
}

function compareQuantity(left, right) {
    const difference = Math.round((toNumber(left) - toNumber(right)) * 1000);
    return difference === 0 ? 0 : difference > 0 ? 1 : -1;
}

function getCurrentPage() {
    return shipmentPageMeta?.page ?? shipmentPageMeta?.number ?? 0;
}

async function confirmChange(message) {
    if (typeof window.erpApi?.confirm === 'function') return window.erpApi.confirm(message);
    return window.confirm(message);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
}


// ========== 공통 Pagination ==========

function renderPagination(container, pageMeta, onMove) {
    container.innerHTML = '';
    if (!pageMeta || pageMeta.totalPages <= 1) return;
    const current = pageMeta.page ?? pageMeta.number ?? 0;
    const totalPages = pageMeta.totalPages;
    container.append(createPageButton('이전', current - 1, current === 0, false, onMove));
    const start = Math.max(0, current - 2);
    const end = Math.min(totalPages - 1, start + 4);
    for (let page = start; page <= end; page += 1) {
        container.append(createPageButton(String(page + 1), page, false, page === current, onMove));
    }
    container.append(createPageButton('다음', current + 1, current >= totalPages - 1, false, onMove));
}

function createPageButton(label, page, disabled, active, onMove) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `shipment-page-button${active ? ' is-active' : ''}`;
    button.textContent = label;
    button.disabled = disabled;
    if (active) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => onMove(page));
    return button;
}


// ========== Loading·오류·안내 ==========

function setShipmentListLoading(loading) {
    searchButton.disabled = loading;
    resetFilterButton.disabled = loading;
    if (loading) {
        shipmentTableBody.innerHTML = '<tr><td colspan="8" class="shipment-empty-cell">출고 목록을 불러오는 중입니다.</td></tr>';
        shipmentMobileList.innerHTML = '<p class="shipment-mobile-empty">출고 목록을 불러오는 중입니다.</p>';
    }
}

function setShipmentDetailLoading(loading) {
    shipmentDetailSection.classList.toggle('is-loading', loading);
}

function setShipmentFormLoading(loading) {
    [shipmentWarehouse, savePackingButton, packButton, unpackButton, completeShipmentButton]
        .forEach(element => { element.disabled = loading; });
    shipmentPackingItems.querySelectorAll('button, input, select').forEach(element => { element.disabled = loading; });
    if (!loading) applyShipmentActionAccess();
}

function setActionModalLoading(loading) {
    confirmActionButton.disabled = loading;
    cancelActionModalButton.disabled = loading;
    closeActionModalButton.disabled = loading;
    confirmActionButton.textContent = loading ? '처리 중' : pendingAction === 'pack' ? '포장 완료' : '출고 완료';
}

function setUnpackModalLoading(loading) {
    confirmUnpackButton.disabled = loading;
    cancelUnpackModalButton.disabled = loading;
    closeUnpackModalButton.disabled = loading;
    unpackReason.disabled = loading;
    confirmUnpackButton.textContent = loading ? '처리 중' : '포장 취소';
}

function showPageError(message) {
    shipmentPageError.textContent = message;
    shipmentPageError.hidden = false;
}

function clearPageError() {
    shipmentPageError.textContent = '';
    shipmentPageError.hidden = true;
}

function showShipmentFormError(message) {
    shipmentFormNotice.hidden = true;
    shipmentFormError.textContent = message;
    shipmentFormError.hidden = false;
}

function showShipmentFormNotice(message) {
    shipmentFormError.hidden = true;
    shipmentFormNotice.textContent = message;
    shipmentFormNotice.hidden = false;
}

function clearShipmentMessages() {
    shipmentFormNotice.textContent = '';
    shipmentFormNotice.hidden = true;
    shipmentFormError.textContent = '';
    shipmentFormError.hidden = true;
}

function showElementError(element, message) {
    element.textContent = message;
    element.hidden = false;
}

function clearElementError(element) {
    element.textContent = '';
    element.hidden = true;
}

function handlePageError(error, fallbackMessage) {
    if (error?.status === 401) {
        window.location.replace('./login.html');
        return;
    }
    showPageError(getApiErrorMessage(error) || fallbackMessage);
}


// ========== Mobile 상세 Panel ==========

function isMobile() {
    return window.matchMedia('(max-width: 375px)').matches;
}

function syncDetailVisibility() {
    if (isMobile()) shipmentDetailSection.hidden = !mobileDetailOpen;
    else shipmentDetailSection.hidden = false;
}

function closeMobileDetailPanel() {
    if (!isMobile()) return;
    mobileDetailOpen = false;
    shipmentDetailSection.hidden = true;
}


// ========== Event 연결 ==========

searchButton.addEventListener('click', applyFilters);
resetFilterButton.addEventListener('click', resetFilters);
closeDetailButton.addEventListener('click', closeMobileDetailPanel);
shipmentWarehouse.addEventListener('change', handleWarehouseChange);
savePackingButton.addEventListener('click', savePacking);
packButton.addEventListener('click', () => openActionModal('pack'));
completeShipmentButton.addEventListener('click', () => openActionModal('complete'));
unpackButton.addEventListener('click', openUnpackModal);
actionModalForm.addEventListener('submit', handleActionModalSubmit);
closeActionModalButton.addEventListener('click', closeActionModal);
cancelActionModalButton.addEventListener('click', closeActionModal);
unpackModalForm.addEventListener('submit', handleUnpackModalSubmit);
closeUnpackModalButton.addEventListener('click', closeUnpackModal);
cancelUnpackModalButton.addEventListener('click', closeUnpackModal);
unpackReason.addEventListener('input', updateUnpackReasonLength);
actionModalBackdrop.addEventListener('click', event => {
    if (event.target === actionModalBackdrop && !confirmActionButton.disabled) closeActionModal();
});
unpackModalBackdrop.addEventListener('click', event => {
    if (event.target === unpackModalBackdrop && !confirmUnpackButton.disabled) closeUnpackModal();
});
document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!actionModalBackdrop.hidden && !confirmActionButton.disabled) closeActionModal();
    if (!unpackModalBackdrop.hidden && !confirmUnpackButton.disabled) closeUnpackModal();
});
window.addEventListener('resize', syncDetailVisibility);


initialize();
