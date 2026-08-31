// ********** 주문 관리 화면의 목록·상세·작성·접수·취소·가용재고와 역할별 UI를 담당 **********

import { api, getApiErrorMessage } from './api.js';
import { hasRole } from './auth.js';
import { initializeCommonLayout } from './common-layout.js';


// ========== 역할·기준정보·화면 상태 ==========

let canManageOrder = false;
let canViewAmount = false;
let customers = [];
let activeCustomers = [];
let activeItems = [];
let activeWarehouseIds = new Set();
let orders = [];
let orderPageMeta = null;
let selectedOrder = null;
let orderFormMode = 'empty';
let orderItemRows = [];
let orderFormDirty = false;
let mobileDetailOpen = false;
let pendingAction = null;

// 품목별 LOT 조회 결과를 창고별로 합산하여 동일 품목을 다시 그릴 때 중복 요청을 줄인다.
const availabilityCache = new Map();


// ========== 목록·검색 Element ==========

const orderPageError = document.querySelector('#orderPageError');
const customerFilter = document.querySelector('#customerFilter');
const statusFilter = document.querySelector('#statusFilter');
const startDateFilter = document.querySelector('#startDateFilter');
const endDateFilter = document.querySelector('#endDateFilter');
const searchButton = document.querySelector('#searchButton');
const resetFilterButton = document.querySelector('#resetFilterButton');
const newOrderButton = document.querySelector('#newOrderButton');
const orderCount = document.querySelector('#orderCount');
const orderTableBody = document.querySelector('#orderTableBody');
const orderMobileList = document.querySelector('#orderMobileList');
const orderPagination = document.querySelector('#orderPagination');


// ========== 상세·입력 Element ==========

const orderDetailSection = document.querySelector('#orderDetailSection');
const orderDetailTitle = document.querySelector('#orderDetailTitle');
const orderDetailMode = document.querySelector('#orderDetailMode');
const closeDetailButton = document.querySelector('#closeDetailButton');
const orderDetailEmpty = document.querySelector('#orderDetailEmpty');
const orderDetailForm = document.querySelector('#orderDetailForm');
const orderStatusBadge = document.querySelector('#orderStatusBadge');
const tradeStatusBadge = document.querySelector('#tradeStatusBadge');
const orderIdValue = document.querySelector('#orderIdValue');
const shipmentValue = document.querySelector('#shipmentValue');
const totalAmountValue = document.querySelector('#totalAmountValue');
const createdAtValue = document.querySelector('#createdAtValue');
const registeredAtValue = document.querySelector('#registeredAtValue');
const updatedAtValue = document.querySelector('#updatedAtValue');
const orderChannel = document.querySelector('#orderChannel');
const orderCustomer = document.querySelector('#orderCustomer');
const deliveryPostalCode = document.querySelector('#deliveryPostalCode');
const deliveryAddress = document.querySelector('#deliveryAddress');
const deliveryAddressDetail = document.querySelector('#deliveryAddressDetail');
const recipientName = document.querySelector('#recipientName');
const recipientPhone = document.querySelector('#recipientPhone');
const orderMemo = document.querySelector('#orderMemo');
const addOrderItemButton = document.querySelector('#addOrderItemButton');
const orderItemTableBody = document.querySelector('#orderItemTableBody');
const createdActionValue = document.querySelector('#createdActionValue');
const registeredActionValue = document.querySelector('#registeredActionValue');
const canceledActionValue = document.querySelector('#canceledActionValue');
const cancelReasonValue = document.querySelector('#cancelReasonValue');
const orderFormNotice = document.querySelector('#orderFormNotice');
const orderFormError = document.querySelector('#orderFormError');
const deleteOrderButton = document.querySelector('#deleteOrderButton');
const cancelOrderButton = document.querySelector('#cancelOrderButton');
const registerOrderButton = document.querySelector('#registerOrderButton');
const saveOrderButton = document.querySelector('#saveOrderButton');


// ========== 주문 처리 Modal Element ==========

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
const cancelModalBackdrop = document.querySelector('#cancelModalBackdrop');
const cancelModalForm = document.querySelector('#cancelModalForm');
const cancelModalTarget = document.querySelector('#cancelModalTarget');
const cancelReason = document.querySelector('#cancelReason');
const cancelReasonLength = document.querySelector('#cancelReasonLength');
const cancelModalError = document.querySelector('#cancelModalError');
const closeCancelModalButton = document.querySelector('#closeCancelModalButton');
const cancelCancelModalButton = document.querySelector('#cancelCancelModalButton');
const confirmCancelButton = document.querySelector('#confirmCancelButton');


// ========== 화면 초기화·역할 제어 ==========

// 공통 Layout과 역할별 화면을 초기화한 뒤 거래처·품목 기준정보와 첫 주문 페이지를 조회한다.
async function initialize() {
    try {
        const currentUser = await initializeCommonLayout({ pageTitle: '주문 관리', activeMenu: 'orders', onError: showPageError });
        if (!currentUser) return;

        applyRoleAccess();
        await Promise.all([loadCustomerOptions(), loadActiveItemOptions(), loadActiveWarehouses()]);
        await loadOrders(0);
        await applyDefaultOrderDetailState();
    } catch (error) {
        handlePageError(error, '주문 관리 화면을 초기화하지 못했습니다.');
    }
}

// ADMIN·OFFICE에는 주문 변경 기능과 금액을 제공하고 WAREHOUSE에는 조회 가능한 운영정보만 표시한다.
function applyRoleAccess() {
    canManageOrder = hasRole('ADMIN', 'OFFICE');
    canViewAmount = hasRole('ADMIN', 'OFFICE');
    newOrderButton.hidden = !canManageOrder;

    document.querySelectorAll('[data-office-information="amount"]').forEach(element => {
        element.hidden = !canViewAmount;
    });
}


// ========== 거래처·품목 기준정보 조회 ==========

// 검색에는 전체 거래처를 사용하고 신규·수정 Form에는 ACTIVE 거래처만 표시한다.
async function loadCustomerOptions() {
    customers = await loadAllPages('/customers');
    activeCustomers = customers.filter(customer => customer.status === 'ACTIVE');
    renderCustomerFilterOptions();
    renderOrderCustomerOptions();
}

// 신규·수정 주문에서 선택할 수 있는 ACTIVE 품목을 전체 페이지 조회한다.
async function loadActiveItemOptions() {
    activeItems = await loadAllPages('/items?status=ACTIVE');
}

// 주문 품목의 가용재고에는 이후 출고 창고로 선택할 수 있는 ACTIVE 창고만 포함한다.
async function loadActiveWarehouses() {
    const activeWarehouses = await loadAllPages('/warehouses?status=ACTIVE');
    activeWarehouseIds = new Set(activeWarehouses.map(warehouse => Number(warehouse.warehouseId)));
}

// 기준정보 API의 모든 페이지를 순서대로 조회하여 Select에서 사용할 하나의 배열로 합친다.
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

function renderCustomerFilterOptions() {
    const selectedValue = customerFilter.value;
    customerFilter.innerHTML = '<option value="">전체</option>';
    customers.forEach(customer => customerFilter.append(createCustomerOption(customer)));
    customerFilter.value = selectedValue;
}

function renderOrderCustomerOptions(selectedCustomerId = null) {
    orderCustomer.innerHTML = '<option value="">거래처 선택</option>';
    activeCustomers.forEach(customer => orderCustomer.append(createCustomerOption(customer)));
    if (selectedCustomerId !== null) {
        ensureSelectedCustomerOption(selectedCustomerId);
        orderCustomer.value = String(selectedCustomerId);
    }
}

function createCustomerOption(customer) {
    const option = document.createElement('option');
    option.value = String(customer.customerId);
    option.textContent = `${customer.customerCode} · ${customer.customerName}`;
    return option;
}

// 기존 주문의 거래처가 INACTIVE로 바뀌어도 상세 조회 Select에는 스냅샷 정보를 유지한다.
function ensureSelectedCustomerOption(customerId) {
    const exists = Array.from(orderCustomer.options).some(option => option.value === String(customerId));
    if (exists || !selectedOrder) return;

    const option = document.createElement('option');
    option.value = String(customerId);
    option.textContent = `${selectedOrder.customerCode} · ${selectedOrder.customerName}`;
    orderCustomer.append(option);
}


// ========== 주문 목록 조회·검색·Pagination ==========

function createOrderListPath(page) {
    const parameters = new URLSearchParams({ page: String(page) });
    if (customerFilter.value) parameters.set('customerId', customerFilter.value);
    if (statusFilter.value) parameters.set('status', statusFilter.value);
    if (startDateFilter.value) parameters.set('startDate', startDateFilter.value);
    if (endDateFilter.value) parameters.set('endDate', endDateFilter.value);
    return `/sales-orders?${parameters.toString()}`;
}

async function loadOrders(page) {
    setOrderListLoading(true);
    try {
        const response = await api.get(createOrderListPath(page));
        orders = response.data ?? [];
        orderPageMeta = response.meta;
        orderCount.textContent = `총 ${orderPageMeta?.totalElements ?? 0}건`;
        renderOrderTable();
        renderOrderMobileList();
        renderPagination(orderPagination, orderPageMeta, loadOrders);
        renderSelectedOrderHighlight();
    } finally {
        setOrderListLoading(false);
    }
}

function renderOrderTable() {
    orderTableBody.innerHTML = '';
    if (orders.length === 0) {
        orderTableBody.innerHTML = `<tr><td colspan="${canViewAmount ? 7 : 6}" class="order-empty-cell">조회된 주문이 없습니다.</td></tr>`;
        return;
    }

    orders.forEach(order => {
        const row = document.createElement('tr');
        row.dataset.orderId = String(order.salesOrderId);
        row.tabIndex = 0;
        row.innerHTML = `
            <td>${escapeHtml(formatOrderNumber(order.salesOrderId))}</td>
            <td title="${escapeHtml(`${order.customerCode} · ${order.customerName}`)}">${escapeHtml(`${order.customerCode} · ${order.customerName}`)}</td>
            <td>${escapeHtml(getOrderChannelLabel(order.channel))}</td>
            <td>${escapeHtml(formatDateTime(order.createdAt))}</td>
            <td>${createOrderStatusBadge(order.status)}</td>
            <td>${createTradeStatusBadge(order.customerTradeStatus)}</td>
            ${canViewAmount ? `<td>${escapeHtml(formatCurrency(order.totalAmount))}</td>` : ''}`;
        row.addEventListener('click', () => selectOrder(order.salesOrderId));
        row.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectOrder(order.salesOrderId);
            }
        });
        orderTableBody.append(row);
    });
}

function renderOrderMobileList() {
    orderMobileList.innerHTML = '';
    if (orders.length === 0) {
        orderMobileList.innerHTML = '<p class="order-mobile-empty">조회된 주문이 없습니다.</p>';
        return;
    }

    orders.forEach(order => {
        const card = document.createElement('article');
        card.className = 'order-mobile-card';
        card.dataset.orderId = String(order.salesOrderId);
        card.innerHTML = `
            <div class="order-mobile-card-header"><strong class="order-mobile-card-title">${escapeHtml(formatOrderNumber(order.salesOrderId))}</strong>${createOrderStatusBadge(order.status)}</div>
            <div class="order-mobile-fields">
                ${createMobileField('거래처', `${order.customerCode} · ${order.customerName}`)}
                ${createMobileField('주문 경로', getOrderChannelLabel(order.channel))}
                ${createMobileField('주문일', formatDateTime(order.createdAt))}
                ${createMobileField('거래 상태', getTradeStatusLabel(order.customerTradeStatus))}
                ${canViewAmount ? createMobileField('주문 총액', formatCurrency(order.totalAmount)) : ''}
            </div>`;
        card.addEventListener('click', () => selectOrder(order.salesOrderId));
        orderMobileList.append(card);
    });
}

function createMobileField(label, value) {
    return `<div class="order-mobile-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? '-')}</strong></div>`;
}

function validateFilters() {
    if (startDateFilter.value && endDateFilter.value && startDateFilter.value > endDateFilter.value) {
        throw new Error('등록 시작일은 종료일보다 늦을 수 없습니다.');
    }
}

async function applyFilters() {
    try {
        clearPageError();
        validateFilters();
        selectedOrder = null;
        await loadOrders(0);
        await applyDefaultOrderDetailState();
    } catch (error) {
        handlePageError(error, '주문 검색 조건을 적용하지 못했습니다.');
    }
}

async function resetFilters() {
    customerFilter.value = '';
    statusFilter.value = '';
    startDateFilter.value = '';
    endDateFilter.value = '';
    await applyFilters();
}


// ========== 주문 상세 조회·초기 상태 ==========

async function selectOrder(salesOrderId, openMobilePanel = true) {
    setOrderDetailLoading(true);
    clearOrderFormMessages();
    try {
        const response = await api.get(`/sales-orders/${salesOrderId}`);
        selectedOrder = response.data;
        orderFormMode = 'detail';
        orderFormDirty = false;
        orderItemRows = (selectedOrder.items ?? []).map(item => ({ ...item, availability: null, availabilityLoading: true }));
        mobileDetailOpen = openMobilePanel && isMobile();
        renderOrderDetail();
        renderSelectedOrderHighlight();
        syncDetailVisibility();
        await refreshAllItemAvailability();
    } catch (error) {
        handlePageError(error, '주문 상세정보를 조회하지 못했습니다.');
    } finally {
        setOrderDetailLoading(false);
    }
}

async function applyDefaultOrderDetailState() {
    if (!isMobile() && orders.length > 0) {
        await selectOrder(orders[0].salesOrderId, false);
        return;
    }
    showOrderDetailEmpty();
}

function renderOrderDetail() {
    if (!selectedOrder && orderFormMode !== 'create') {
        showOrderDetailEmpty();
        return;
    }

    orderDetailEmpty.hidden = true;
    orderDetailForm.hidden = false;
    const createMode = orderFormMode === 'create';

    orderDetailTitle.textContent = createMode ? '신규 주문' : '주문 정보';
    orderDetailMode.textContent = createMode ? '거래처와 배송정보 및 주문 품목을 입력해 주세요.' : '주문 배송정보와 품목 및 연결 출고를 확인할 수 있습니다.';
    orderIdValue.textContent = createMode ? '등록 시 자동 생성' : formatOrderNumber(selectedOrder.salesOrderId);
    shipmentValue.innerHTML = createMode ? '주문 접수 후 생성' : createShipmentSummary(selectedOrder.shipment);
    createdAtValue.textContent = createMode ? '-' : formatDateTime(selectedOrder.createdAt);
    registeredAtValue.textContent = createMode ? '-' : formatDateTime(selectedOrder.registeredAt);
    updatedAtValue.textContent = createMode ? '-' : formatDateTime(selectedOrder.updatedAt);

    setOrderStatusBadge(createMode ? 'DRAFT' : selectedOrder.status);
    setTradeStatusBadge(createMode ? null : selectedOrder.customerTradeStatus);
    renderOrderCustomerOptions(createMode ? null : selectedOrder.customerId);
    orderChannel.value = createMode ? 'PHONE' : selectedOrder.channel;
    orderCustomer.value = createMode ? '' : String(selectedOrder.customerId);
    deliveryPostalCode.value = createMode ? '' : selectedOrder.deliveryPostalCode ?? '';
    deliveryAddress.value = createMode ? '' : selectedOrder.deliveryAddress ?? '';
    deliveryAddressDetail.value = createMode ? '' : selectedOrder.deliveryAddressDetail ?? '';
    recipientName.value = createMode ? '' : selectedOrder.recipientName ?? '';
    recipientPhone.value = createMode ? '' : selectedOrder.recipientPhone ?? '';
    orderMemo.value = createMode ? '' : selectedOrder.memo ?? '';
    renderOrderItems();
    renderOrderTotals();
    renderActionHistory();
    applyOrderDetailAccess();
}

function showOrderDetailEmpty() {
    selectedOrder = null;
    orderFormMode = 'empty';
    orderItemRows = [];
    orderFormDirty = false;
    orderDetailTitle.textContent = '주문 정보';
    orderDetailMode.textContent = '선택한 주문의 배송정보와 품목 및 연결 출고를 확인할 수 있습니다.';
    orderDetailEmpty.hidden = false;
    orderDetailForm.hidden = true;
    mobileDetailOpen = false;
    renderSelectedOrderHighlight();
    syncDetailVisibility();
}

function renderSelectedOrderHighlight() {
    const selectedId = selectedOrder?.salesOrderId;
    document.querySelectorAll('[data-order-id]').forEach(element => {
        element.classList.toggle('is-selected', Number(element.dataset.orderId) === Number(selectedId));
    });
}


// ========== 신규 주문·거래처 기본 배송정보 ==========

function enterOrderCreateMode() {
    if (!canManageOrder) return;
    selectedOrder = null;
    orderFormMode = 'create';
    orderFormDirty = true;
    orderItemRows = [createEmptyItemRow()];
    availabilityCache.clear();
    mobileDetailOpen = isMobile();
    clearOrderFormMessages();
    renderOrderDetail();
    renderSelectedOrderHighlight();
    syncDetailVisibility();
}

function createEmptyItemRow() {
    return { salesOrderItemId: null, itemId: null, itemCode: null, itemName: null, unit: null, orderQuantity: '', unitPrice: '', lineAmount: 0, availability: null, availabilityLoading: false };
}

// 거래처를 변경하면 거래처 상세 API의 기본 배송지·수령인 정보를 신규 주문 입력값으로 적용한다.
async function applyCustomerDefaults() {
    const customerId = Number(orderCustomer.value);
    if (!customerId || !isEditableDraft()) return;

    markOrderFormDirty();

    try {
        const response = await api.get(`/customers/${customerId}`);
        const customer = response.data;
        deliveryPostalCode.value = customer.deliveryPostalCode ?? '';
        deliveryAddress.value = customer.deliveryAddress ?? '';
        deliveryAddressDetail.value = customer.deliveryAddressDetail ?? '';
        recipientName.value = customer.recipientName ?? '';
        recipientPhone.value = customer.recipientPhone ?? '';
        setTradeStatusBadge(customer.tradeStatus);
        if (customer.tradeStatus === 'HOLD') showOrderFormNotice('거래 중지 거래처는 작성 중 주문 저장은 가능하지만 주문 접수는 할 수 없습니다.');
        else clearOrderFormMessages();
        applyOrderDetailAccess();
    } catch (error) {
        showOrderFormError(getApiErrorMessage(error));
    }
}


// ========== 주문 품목·창고별 가용재고 ==========

function isEditableDraft() {
    return canManageOrder && (orderFormMode === 'create' || selectedOrder?.status === 'DRAFT');
}

function renderOrderItems() {
    const editable = isEditableDraft();
    document.querySelectorAll('.order-item-manage-column').forEach(element => element.hidden = !editable);
    orderItemTableBody.innerHTML = '';

    if (orderItemRows.length === 0) {
        const visibleColumns = 5 + (canViewAmount ? 2 : 0) + (editable ? 1 : 0);
        orderItemTableBody.innerHTML = `<tr><td colspan="${visibleColumns}" class="order-item-empty-cell">주문 품목을 추가해 주세요.</td></tr>`;
        return;
    }

    orderItemRows.forEach((item, index) => orderItemTableBody.append(createOrderItemRow(item, index, editable)));
}

function createOrderItemRow(itemRow, index, editable) {
    const row = document.createElement('tr');
    const itemCell = document.createElement('td');
    const quantityCell = document.createElement('td');
    const priceCell = document.createElement('td');
    const amountCell = document.createElement('td');
    const availabilityCell = document.createElement('td');

    row.append(createTextCell(index + 1));
    if (editable) {
        const select = document.createElement('select');
        renderItemSelectOptions(select, itemRow.itemId);
        select.addEventListener('change', () => handleItemSelection(index, select.value));
        itemCell.append(select);
    } else {
        itemCell.textContent = `${itemRow.itemCode ?? '-'} · ${itemRow.itemName ?? '-'}`;
        itemCell.title = itemCell.textContent;
    }
    row.append(itemCell, createTextCell(getUnitLabel(itemRow.unit)));

    if (editable) {
        const quantityInput = createNumberInput(itemRow.orderQuantity, '0.001', '0.001');
        quantityInput.addEventListener('input', () => updateItemNumber(index, 'orderQuantity', quantityInput.value, row));
        quantityCell.append(quantityInput);
    } else quantityCell.textContent = formatQuantity(itemRow.orderQuantity);
    row.append(quantityCell);

    if (canViewAmount) {
        priceCell.dataset.officeInformation = 'amount';
        amountCell.dataset.officeInformation = 'amount';
        if (editable) {
            const priceInput = createNumberInput(itemRow.unitPrice, '0.01', '0');
            priceInput.addEventListener('input', () => updateItemNumber(index, 'unitPrice', priceInput.value, row));
            priceCell.append(priceInput);
        } else priceCell.textContent = formatCurrency(itemRow.unitPrice);
        amountCell.className = 'order-item-line-amount';
        amountCell.textContent = formatCurrency(calculateLineAmount(itemRow));
        row.append(priceCell, amountCell);
    }

    availabilityCell.className = 'order-item-availability';
    availabilityCell.innerHTML = createAvailabilityHtml(itemRow);
    row.append(availabilityCell);

    if (editable) {
        const manageCell = document.createElement('td');
        manageCell.className = 'order-item-manage-column';
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'order-item-remove';
        removeButton.textContent = '×';
        removeButton.setAttribute('aria-label', `${index + 1}번째 주문 품목 삭제`);
        removeButton.addEventListener('click', () => removeOrderItem(index));
        manageCell.append(removeButton);
        row.append(manageCell);
    }

    return row;
}

function createTextCell(value) {
    const cell = document.createElement('td');
    cell.textContent = value ?? '-';
    return cell;
}

function createNumberInput(value, step, min) {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = min;
    input.step = step;
    input.value = value ?? '';
    return input;
}

function renderItemSelectOptions(select, selectedItemId) {
    select.innerHTML = '<option value="">품목 선택</option>';
    activeItems.forEach(item => {
        const option = document.createElement('option');
        option.value = String(item.itemId);
        option.textContent = `${item.itemCode} · ${item.itemName}`;
        select.append(option);
    });
    if (selectedItemId) {
        ensureSelectedItemOption(select, selectedItemId);
        select.value = String(selectedItemId);
    }
}

function ensureSelectedItemOption(select, selectedItemId) {
    if (Array.from(select.options).some(option => option.value === String(selectedItemId))) return;
    const item = orderItemRows.find(row => Number(row.itemId) === Number(selectedItemId));
    if (!item) return;
    const option = document.createElement('option');
    option.value = String(selectedItemId);
    option.textContent = `${item.itemCode} · ${item.itemName}`;
    select.append(option);
}

function addOrderItem() {
    if (!isEditableDraft()) return;
    markOrderFormDirty();
    orderItemRows.push(createEmptyItemRow());
    renderOrderItems();
}

function removeOrderItem(index) {
    markOrderFormDirty();
    orderItemRows.splice(index, 1);
    renderOrderItems();
    renderOrderTotals();
}

async function handleItemSelection(index, itemIdValue) {
    const itemId = Number(itemIdValue);
    if (itemId && orderItemRows.some((row, rowIndex) => rowIndex !== index && Number(row.itemId) === itemId)) {
        showOrderFormError('같은 품목을 주문에 중복 등록할 수 없습니다.');
        renderOrderItems();
        return;
    }

    clearOrderFormMessages();
    markOrderFormDirty();
    const item = activeItems.find(candidate => candidate.itemId === itemId);
    orderItemRows[index] = item ? {
        ...orderItemRows[index], itemId: item.itemId, itemCode: item.itemCode, itemName: item.itemName,
        unit: item.unit, unitPrice: item.defaultSalesPrice ?? 0, availability: null, availabilityLoading: true
    } : createEmptyItemRow();
    renderOrderItems();
    renderOrderTotals();

    if (!item) return;
    if (item.unit === 'OTHER') await loadOtherUnitName(index, item.itemId);
    await loadItemAvailability(index, item.itemId, true);
}

// ItemListResponse에 없는 OTHER 단위명은 선택 시 상세 API로 한 번 보완한다.
async function loadOtherUnitName(index, itemId) {
    try {
        const response = await api.get(`/items/${itemId}`);
        if (Number(orderItemRows[index]?.itemId) === Number(itemId)) {
            orderItemRows[index].unit = response.data?.otherUnitName || 'OTHER';
            renderOrderItems();
        }
    } catch {
        // 기타 단위명 보완 실패가 주문 입력 전체를 막지 않도록 Enum 표시를 유지한다.
    }
}

function updateItemNumber(index, field, value, row) {
    markOrderFormDirty();
    orderItemRows[index][field] = value;
    if (canViewAmount) {
        const amountCell = row.querySelector('.order-item-line-amount');
        if (amountCell) amountCell.textContent = formatCurrency(calculateLineAmount(orderItemRows[index]));
    }
    renderOrderTotals();
}

function calculateLineAmount(item) {
    return toNumber(item.orderQuantity) * toNumber(item.unitPrice);
}

function renderOrderTotals() {
    const total = orderItemRows.reduce((sum, item) => sum + calculateLineAmount(item), 0);
    totalAmountValue.textContent = canViewAmount ? formatCurrency(total) : '-';
}

// 저장·상세 갱신 후 선택된 모든 품목의 최신 가용재고를 다시 조회한다.
async function refreshAllItemAvailability() {
    availabilityCache.clear();
    const itemIds = [...new Set(orderItemRows.map(item => item.itemId).filter(Boolean))];
    await Promise.all(itemIds.map(itemId => loadAvailabilityByItemId(itemId, true)));
    orderItemRows.forEach(item => {
        if (item.itemId) {
            item.availability = availabilityCache.get(Number(item.itemId)) ?? [];
            item.availabilityLoading = false;
        }
    });
    renderOrderItems();
}

async function loadItemAvailability(index, itemId, forceReload = false) {
    await loadAvailabilityByItemId(itemId, forceReload);
    if (Number(orderItemRows[index]?.itemId) === Number(itemId)) {
        orderItemRows[index].availability = availabilityCache.get(Number(itemId)) ?? [];
        orderItemRows[index].availabilityLoading = false;
        renderOrderItems();
    }
}

// API-INV-001의 LOT별 outboundAvailableQuantity를 창고별로 합산한다.
async function loadAvailabilityByItemId(itemId, forceReload = false) {
    const key = Number(itemId);
    if (!forceReload && availabilityCache.has(key)) return availabilityCache.get(key);

    try {
        const response = await api.get(`/inventory/lots?itemId=${key}`);
        const warehouseMap = new Map();
        (response.data ?? []).forEach(lot => {
            const warehouseId = Number(lot.warehouseId);
            if (!activeWarehouseIds.has(warehouseId)) return;
            const current = warehouseMap.get(warehouseId) ?? {
                warehouseId, warehouseCode: lot.warehouseCode, warehouseName: lot.warehouseName, quantity: 0
            };
            current.quantity += toNumber(lot.outboundAvailableQuantity);
            warehouseMap.set(warehouseId, current);
        });
        const availability = [...warehouseMap.values()].sort((a, b) => String(a.warehouseCode).localeCompare(String(b.warehouseCode)));
        availabilityCache.set(key, availability);
        return availability;
    } catch (error) {
        availabilityCache.set(key, [{ error: getApiErrorMessage(error) }]);
        return availabilityCache.get(key);
    }
}

function createAvailabilityHtml(item) {
    if (!item.itemId) return '<div class="order-item-availability-list is-empty">품목을 선택해 주세요.</div>';
    if (item.availabilityLoading) return '<div class="order-item-availability-list">가용재고 조회 중</div>';
    if (!item.availability || item.availability.length === 0) return '<div class="order-item-availability-list is-empty">가용재고 없음</div>';
    if (item.availability[0]?.error) return `<div class="order-item-availability-list is-empty">${escapeHtml(item.availability[0].error)}</div>`;

    const availableWarehouses = item.availability.filter(warehouse => warehouse.quantity > 0);
    if (availableWarehouses.length === 0) return '<div class="order-item-availability-list is-empty">가용재고 없음</div>';
    return `<div class="order-item-availability-list">${availableWarehouses.map(warehouse =>
        `<span title="${escapeHtml(warehouse.warehouseName)}">${escapeHtml(warehouse.warehouseCode)} ${escapeHtml(formatQuantity(warehouse.quantity))}</span>`
    ).join('')}</div>`;
}


// ========== 저장·수정·version 충돌 ==========

async function handleOrderSubmit(event) {
    event.preventDefault();
    if (!isEditableDraft()) return;

    try {
        clearOrderFormMessages();
        validateOrderForm(false);
        setOrderFormLoading(true);
        if (orderFormMode === 'create') await createOrder();
        else await updateOrder();
    } catch (error) {
        if (await handleOrderVersionConflict(error)) return;
        showOrderFormError(getApiErrorMessage(error));
    } finally {
        setOrderFormLoading(false);
    }
}

function validateOrderForm(forRegistration) {
    if (!orderCustomer.value) throw new Error('거래처를 선택해 주세요.');
    if (!orderChannel.value) throw new Error('주문 경로를 선택해 주세요.');
    if (orderItemRows.length === 0) throw new Error('주문 품목을 하나 이상 추가해 주세요.');

    const itemIds = new Set();
    orderItemRows.forEach((item, index) => {
        if (!item.itemId) throw new Error(`${index + 1}번째 주문 품목을 선택해 주세요.`);
        if (itemIds.has(Number(item.itemId))) throw new Error('같은 품목을 주문에 중복 등록할 수 없습니다.');
        itemIds.add(Number(item.itemId));
        if (!isValidDecimal(item.orderQuantity, 16, 3, false)) throw new Error(`${index + 1}번째 주문 수량을 확인해 주세요.`);
        if (!isValidDecimal(item.unitPrice, 17, 2, true)) throw new Error(`${index + 1}번째 판매 단가를 확인해 주세요.`);
    });

    if (forRegistration) {
        if (!deliveryAddress.value.trim()) throw new Error('주문 접수 전에 배송지 주소를 입력해 주세요.');
        if (!recipientName.value.trim()) throw new Error('주문 접수 전에 수령인을 입력해 주세요.');
        if (!recipientPhone.value.trim()) throw new Error('주문 접수 전에 수령인 연락처를 입력해 주세요.');
        const tradeStatus = isEditableDraft() ? getSelectedCustomerTradeStatus() : selectedOrder?.customerTradeStatus;
        const customerStatus = isEditableDraft() ? getSelectedCustomerStatus() : selectedOrder?.customerStatus;
        if (customerStatus !== 'ACTIVE') throw new Error('사용 중인 거래처 주문만 접수할 수 있습니다.');
        if (tradeStatus === 'HOLD') throw new Error('거래 중지 상태의 거래처 주문은 접수할 수 없습니다.');
        if (hasInactiveSelectedItem()) throw new Error('사용 중지되거나 삭제된 품목이 있어 주문을 접수할 수 없습니다.');
    }
}

function createOrderRequestBody() {
    return {
        customerId: Number(orderCustomer.value),
        channel: orderChannel.value,
        deliveryPostalCode: normalizeOptionalValue(deliveryPostalCode.value),
        deliveryAddress: normalizeOptionalValue(deliveryAddress.value),
        deliveryAddressDetail: normalizeOptionalValue(deliveryAddressDetail.value),
        recipientName: normalizeOptionalValue(recipientName.value),
        recipientPhone: normalizeOptionalValue(recipientPhone.value),
        memo: normalizeOptionalValue(orderMemo.value),
        items: orderItemRows.map(item => ({
            itemId: Number(item.itemId),
            orderQuantity: Number(item.orderQuantity),
            unitPrice: Number(item.unitPrice)
        }))
    };
}

async function createOrder() {
    const response = await api.post('/sales-orders', createOrderRequestBody());
    resetFilterValues();
    await loadOrders(0);
    await selectOrder(response.data.salesOrderId, true);
    showOrderFormNotice('주문이 작성 중 상태로 저장되었습니다.');
}

async function updateOrder() {
    const request = { ...createOrderRequestBody(), version: selectedOrder.version };
    const response = await api.patch(`/sales-orders/${selectedOrder.salesOrderId}`, request);
    selectedOrder = response.data;
    orderFormDirty = false;
    orderItemRows = (selectedOrder.items ?? []).map(item => ({ ...item, availability: null, availabilityLoading: true }));
    renderOrderDetail();
    await refreshAllItemAvailability();
    await loadOrders(orderPageMeta?.page ?? orderPageMeta?.number ?? 0);
    showOrderFormNotice('주문 정보가 수정되었습니다.');
}

async function handleOrderVersionConflict(error) {
    if (error?.status !== 409 || !String(getApiErrorMessage(error)).includes('최신 주문')) return false;
    const orderId = selectedOrder?.salesOrderId;
    if (orderId) await reloadCurrentPageAndSelect(orderId, isMobile());
    showOrderFormError('다른 사용자가 먼저 주문을 처리했습니다. 최신 주문 정보를 다시 불러왔습니다.');
    return true;
}


// ========== 삭제·접수 공통 Modal ==========

function openActionModal(action) {
    if (!selectedOrder || !canManageOrder) return;

    try {
        clearOrderFormMessages();
        if (action === 'register') {
            validateOrderForm(true);
            if (orderFormDirty) throw new Error('변경한 주문 정보를 저장한 후 주문을 접수해 주세요.');
        }
    } catch (error) {
        showOrderFormError(getApiErrorMessage(error));
        return;
    }

    const config = getActionConfiguration(action);
    pendingAction = action;
    actionModalTitle.textContent = config.title;
    actionModalTarget.textContent = formatOrderNumber(selectedOrder.salesOrderId);
    actionModalCurrentValue.textContent = getOrderStatusLabel(selectedOrder.status);
    actionModalNextValue.textContent = config.nextLabel;
    actionModalDescription.textContent = config.description;
    confirmActionButton.textContent = config.confirmLabel;
    confirmActionButton.classList.toggle('button-danger', action === 'delete');
    confirmActionButton.classList.toggle('button-primary', action !== 'delete');
    clearElementError(actionModalError);
    actionModalBackdrop.hidden = false;
    confirmActionButton.focus();
}

function getActionConfiguration(action) {
    if (action === 'delete') return {
        title: '작성 중 주문 삭제', nextLabel: '주문 삭제', confirmLabel: '삭제',
        description: '작성 중 주문과 등록된 주문 품목이 삭제됩니다. 삭제한 주문은 복구할 수 없습니다.'
    };
    return {
        title: '주문 접수', nextLabel: '주문 접수', confirmLabel: '접수',
        description: '최신 거래처와 품목 상태를 확인하고 주문 스냅샷과 출고 대기 건을 생성합니다. 이 단계에서는 재고를 예약하지 않습니다.'
    };
}

function closeActionModal() {
    actionModalBackdrop.hidden = true;
    pendingAction = null;
    clearElementError(actionModalError);
}

async function handleActionModalSubmit(event) {
    event.preventDefault();
    if (!pendingAction || !selectedOrder) return;
    const action = pendingAction;
    const orderId = selectedOrder.salesOrderId;

    try {
        setActionModalLoading(true);
        if (action === 'delete') {
            await api.delete(`/sales-orders/${orderId}`, { version: selectedOrder.version });
            closeActionModal();
            await reloadAfterOrderDelete();
            return;
        }

        await api.post(`/sales-orders/${orderId}/register`, { version: selectedOrder.version });
        closeActionModal();
        await reloadCurrentPageAndSelect(orderId, isMobile());
        showOrderFormNotice('주문 접수가 완료되어 출고 대기 건이 생성되었습니다.');
    } catch (error) {
        if (await handleOrderVersionConflict(error)) {
            closeActionModal();
            return;
        }
        showElementError(actionModalError, getApiErrorMessage(error));
    } finally {
        setActionModalLoading(false);
    }
}


// ========== 주문 취소 Modal ==========

function openCancelModal() {
    if (!selectedOrder || !canManageOrder || selectedOrder.status !== 'REGISTERED') return;
    cancelModalTarget.textContent = formatOrderNumber(selectedOrder.salesOrderId);
    cancelReason.value = '';
    updateCancelReasonLength();
    clearElementError(cancelModalError);
    cancelModalBackdrop.hidden = false;
    cancelReason.focus();
}

function closeCancelModal() {
    cancelModalBackdrop.hidden = true;
    cancelReason.value = '';
    clearElementError(cancelModalError);
}

async function handleCancelModalSubmit(event) {
    event.preventDefault();
    if (!selectedOrder) return;
    const reason = cancelReason.value.trim();
    if (!reason) {
        showElementError(cancelModalError, '주문 취소 사유를 입력해 주세요.');
        return;
    }

    const orderId = selectedOrder.salesOrderId;
    try {
        setCancelModalLoading(true);
        await api.post(`/sales-orders/${orderId}/cancel`, { reason, version: selectedOrder.version });
        closeCancelModal();
        await reloadCurrentPageAndSelect(orderId, isMobile());
        showOrderFormNotice('주문과 연결 출고가 취소되었습니다.');
    } catch (error) {
        if (await handleOrderVersionConflict(error)) {
            closeCancelModal();
            return;
        }
        showElementError(cancelModalError, getApiErrorMessage(error));
    } finally {
        setCancelModalLoading(false);
    }
}

function updateCancelReasonLength() {
    cancelReasonLength.textContent = String(cancelReason.value.length);
}


// ========== 역할·상태별 상세 제어 ==========

function applyOrderDetailAccess() {
    const editable = isEditableDraft();
    const createMode = orderFormMode === 'create';
    const status = createMode ? 'DRAFT' : selectedOrder?.status;
    const shipmentStatus = selectedOrder?.shipment?.status;
    const tradeStatus = editable ? getSelectedCustomerTradeStatus() : selectedOrder?.customerTradeStatus;
    const customerStatus = editable ? getSelectedCustomerStatus() : selectedOrder?.customerStatus;
    const inactiveItemExists = editable && hasInactiveSelectedItem();

    [orderChannel, orderCustomer, deliveryPostalCode, deliveryAddress, deliveryAddressDetail, recipientName, recipientPhone, orderMemo]
        .forEach(element => element.disabled = !editable);
    addOrderItemButton.hidden = !editable;
    saveOrderButton.hidden = !editable;
    saveOrderButton.textContent = createMode ? '주문 저장' : '수정 저장';
    deleteOrderButton.hidden = !canManageOrder || createMode || status !== 'DRAFT';
    registerOrderButton.hidden = !canManageOrder || createMode || status !== 'DRAFT';
    registerOrderButton.disabled = customerStatus !== 'ACTIVE' || tradeStatus === 'HOLD' || inactiveItemExists || orderFormDirty;
    registerOrderButton.title = customerStatus !== 'ACTIVE'
        ? '사용 중지 거래처 주문은 접수할 수 없습니다.'
        : tradeStatus === 'HOLD'
        ? '거래 중지 거래처는 주문을 접수할 수 없습니다.'
        : inactiveItemExists ? '사용 중지되거나 삭제된 품목이 있어 주문을 접수할 수 없습니다.'
        : orderFormDirty ? '변경한 주문 정보를 먼저 저장해 주세요.' : '';
    cancelOrderButton.hidden = !canManageOrder || status !== 'REGISTERED'
        || !['PENDING', 'PACKED'].includes(shipmentStatus);
}

function renderActionHistory() {
    if (orderFormMode === 'create' || !selectedOrder) {
        createdActionValue.textContent = '-';
        registeredActionValue.textContent = '-';
        canceledActionValue.textContent = '-';
        cancelReasonValue.textContent = '-';
        return;
    }
    createdActionValue.textContent = formatAction(selectedOrder.createdByName, selectedOrder.createdAt);
    registeredActionValue.textContent = formatAction(selectedOrder.registeredByName, selectedOrder.registeredAt);
    canceledActionValue.textContent = formatAction(selectedOrder.canceledByName, selectedOrder.canceledAt);
    cancelReasonValue.textContent = selectedOrder.cancelReason || '-';
}


// ========== 재조회·페이지 이동 후 선택 유지 ==========

async function reloadCurrentPageAndSelect(orderId, openMobilePanel) {
    const currentPage = orderPageMeta?.page ?? orderPageMeta?.number ?? 0;
    await loadOrders(currentPage);
    const exists = orders.some(order => Number(order.salesOrderId) === Number(orderId));
    if (exists) await selectOrder(orderId, openMobilePanel);
    else {
        await loadOrders(0);
        if (orders.some(order => Number(order.salesOrderId) === Number(orderId))) await selectOrder(orderId, openMobilePanel);
        else await applyDefaultOrderDetailState();
    }
}

async function reloadAfterOrderDelete() {
    const currentPage = orderPageMeta?.page ?? orderPageMeta?.number ?? 0;
    await loadOrders(currentPage);
    if (orders.length === 0 && currentPage > 0) await loadOrders(currentPage - 1);
    await applyDefaultOrderDetailState();
}

function resetFilterValues() {
    customerFilter.value = '';
    statusFilter.value = '';
    startDateFilter.value = '';
    endDateFilter.value = '';
}

// DRAFT 상세에서 변경한 값이 저장되기 전에 접수되어 화면과 DB 내용이 달라지는 것을 방지한다.
function markOrderFormDirty() {
    if (orderFormMode !== 'detail') return;
    orderFormDirty = true;
    applyOrderDetailAccess();
}


// ========== 상태·값 표시 보조 함수 ==========

function createOrderStatusBadge(status) {
    return `<span class="order-status-badge is-${String(status ?? 'draft').toLowerCase()}">${escapeHtml(getOrderStatusLabel(status))}</span>`;
}

function setOrderStatusBadge(status) {
    orderStatusBadge.className = `order-status-badge is-${String(status ?? 'draft').toLowerCase()}`;
    orderStatusBadge.textContent = getOrderStatusLabel(status);
}

function getOrderStatusLabel(status) {
    return { DRAFT: '작성 중', REGISTERED: '주문 접수', COMPLETED: '주문 완료', CANCELED: '주문 취소' }[status] ?? '-';
}

function createTradeStatusBadge(status) {
    return `<span class="order-trade-badge ${status === 'HOLD' ? 'is-hold' : 'is-normal'}">${escapeHtml(getTradeStatusLabel(status))}</span>`;
}

function setTradeStatusBadge(status) {
    tradeStatusBadge.className = `order-trade-badge ${status === 'HOLD' ? 'is-hold' : 'is-normal'}`;
    tradeStatusBadge.textContent = status ? getTradeStatusLabel(status) : '거래처 선택 전';
}

function getTradeStatusLabel(status) {
    return status === 'HOLD' ? '거래 중지' : status === 'NORMAL' ? '정상 거래' : '-';
}

function getSelectedCustomerTradeStatus() {
    const customer = customers.find(candidate => candidate.customerId === Number(orderCustomer.value));
    return customer?.tradeStatus ?? null;
}

function getSelectedCustomerStatus() {
    const customer = customers.find(candidate => candidate.customerId === Number(orderCustomer.value));
    return customer?.status ?? null;
}

function hasInactiveSelectedItem() {
    return orderItemRows.some(row => row.itemId
        && !activeItems.some(item => Number(item.itemId) === Number(row.itemId)));
}

function getOrderChannelLabel(channel) {
    return { VISIT: '방문', PHONE: '전화', MESSAGE: '문자·메시지' }[channel] ?? '-';
}

function createShipmentSummary(shipment) {
    if (!shipment) return '연결 출고 없음';
    const label = { PENDING: '출고 대기', PACKED: '포장 완료', COMPLETED: '출고 완료', CANCELED: '출고 취소' }[shipment.status] ?? shipment.status;
    return `<span class="order-shipment-badge">${escapeHtml(formatShipmentNumber(shipment.shipmentId))} · ${escapeHtml(label)}</span>`;
}

function formatOrderNumber(id) {
    return id ? `SO-${String(id).padStart(8, '0')}` : '-';
}

function formatShipmentNumber(id) {
    return id ? `SHP-${String(id).padStart(8, '0')}` : '-';
}

function getUnitLabel(unit) {
    return ({ G: 'g', KG: 'kg', EA: '개', PACK: '팩', BOX: '박스', OTHER: '기타' })[unit] ?? unit ?? '-';
}

function formatCurrency(value) {
    if (value === null || value === undefined || value === '') return '-';
    return `${Math.round(toNumber(value)).toLocaleString('ko-KR')}원`;
}

function formatQuantity(value) {
    if (value === null || value === undefined || value === '') return '-';
    return toNumber(value).toLocaleString('ko-KR', { maximumFractionDigits: 3 });
}

function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}. ${pad(date.getMonth() + 1)}. ${pad(date.getDate())}. ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatAction(userName, dateTime) {
    if (!dateTime) return '-';
    return `${userName ?? '-'} · ${formatDateTime(dateTime)}`;
}

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function isValidDecimal(value, maxIntegerDigits, maxFractionDigits, allowZero) {
    const text = String(value ?? '').trim();
    if (!/^\d+(\.\d+)?$/.test(text)) return false;
    const [integerPart, fractionPart = ''] = text.split('.');
    const numericValue = Number(text);
    return integerPart.length <= maxIntegerDigits && fractionPart.length <= maxFractionDigits
        && (allowZero ? numericValue >= 0 : numericValue > 0);
}

function normalizeOptionalValue(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}


// ========== 공통 Pagination ==========

function renderPagination(container, pageMeta, onMove) {
    container.innerHTML = '';
    if (!pageMeta || pageMeta.totalPages <= 1) return;

    const current = pageMeta.page ?? pageMeta.number ?? 0;
    const totalPages = pageMeta.totalPages;
    container.append(createPageButton('이전', current - 1, current <= 0, false, onMove));
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
    button.className = `order-page-button${active ? ' is-active' : ''}`;
    button.textContent = label;
    button.disabled = disabled;
    if (active) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => onMove(page));
    return button;
}


// ========== Loading·오류·안내 ==========

function setOrderListLoading(loading) {
    searchButton.disabled = loading;
    resetFilterButton.disabled = loading;
    if (loading) {
        orderTableBody.innerHTML = `<tr><td colspan="${canViewAmount ? 7 : 6}" class="order-empty-cell">주문 목록을 불러오는 중입니다.</td></tr>`;
        orderMobileList.innerHTML = '<p class="order-mobile-empty">주문 목록을 불러오는 중입니다.</p>';
    }
}

function setOrderDetailLoading(loading) {
    orderDetailSection.classList.toggle('is-loading', loading);
}

function setOrderFormLoading(loading) {
    [saveOrderButton, deleteOrderButton, registerOrderButton, cancelOrderButton, addOrderItemButton]
        .forEach(button => button.disabled = loading);
    if (!loading) applyOrderDetailAccess();
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
}

function showPageError(message) {
    orderPageError.textContent = message;
    orderPageError.hidden = false;
}

function clearPageError() {
    orderPageError.textContent = '';
    orderPageError.hidden = true;
}

function showOrderFormError(message) {
    orderFormError.textContent = message;
    orderFormError.hidden = false;
    orderFormNotice.hidden = true;
}

function showOrderFormNotice(message) {
    orderFormNotice.textContent = message;
    orderFormNotice.hidden = false;
    orderFormError.hidden = true;
}

function clearOrderFormMessages() {
    orderFormError.textContent = '';
    orderFormError.hidden = true;
    orderFormNotice.textContent = '';
    orderFormNotice.hidden = true;
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
    if (isMobile()) orderDetailSection.hidden = !mobileDetailOpen;
    else orderDetailSection.hidden = false;
}

function closeMobileDetailPanel() {
    if (!isMobile()) return;
    mobileDetailOpen = false;
    orderDetailSection.hidden = true;
}


// ========== Event 연결 ==========

searchButton.addEventListener('click', applyFilters);
resetFilterButton.addEventListener('click', resetFilters);
newOrderButton.addEventListener('click', enterOrderCreateMode);
closeDetailButton.addEventListener('click', closeMobileDetailPanel);
orderDetailForm.addEventListener('submit', handleOrderSubmit);
orderCustomer.addEventListener('change', applyCustomerDefaults);
orderChannel.addEventListener('change', markOrderFormDirty);
[deliveryPostalCode, deliveryAddress, deliveryAddressDetail, recipientName, recipientPhone, orderMemo]
    .forEach(element => element.addEventListener('input', markOrderFormDirty));
addOrderItemButton.addEventListener('click', addOrderItem);
deleteOrderButton.addEventListener('click', () => openActionModal('delete'));
registerOrderButton.addEventListener('click', () => openActionModal('register'));
cancelOrderButton.addEventListener('click', openCancelModal);
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


initialize();
