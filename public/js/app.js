// ==========================================================================
// LA FONDA DEL CAPORAL - Client Application Controller
// Salón Grande & Salón Pequeño, 5 Perfiles de Usuario, Fases y Productos Agotados
// ==========================================================================

(function() {
  'use strict';

  // State
  let tables = [];
  let menu = { desayuno: [], almuerzo: [] };
  let users = [];
  let currentUser = null;
  let currentPhase = 'almuerzo'; // 'desayuno' | 'almuerzo'
  let phaseMode = 'auto';
  let outOfStock = []; // array of item IDs that are sold out

  // Active Navigation State
  let activeSalon = 'grande'; // 'grande' | 'pequeño'
  let activeTableId = null;
  let activeCategory = 'ALL';
  let searchQuery = '';
  let outOfStockSearchQuery = '';

  // Checkout State
  let checkoutTipPercent = 0;
  let checkoutPaymentMethod = 'Efectivo';
  let currentReceiptTableId = null;

  const socket = io();

  // DOM Elements
  const bodyEl = document.body;
  const headerTableTitle = document.getElementById('headerTableTitle');
  const btnHeaderBack = document.getElementById('btnHeaderBack');
  const btnPhaseToggle = document.getElementById('btnPhaseToggle');
  const phaseIcon = document.getElementById('phaseIcon');
  const phaseLabel = document.getElementById('phaseLabel');
  const phaseNextLabel = document.getElementById('phaseNextLabel');

  const btnUserProfile = document.getElementById('btnUserProfile');
  const userAvatar = document.getElementById('userAvatar');
  const userNameHeader = document.getElementById('userNameHeader');

  const btnOpenSales = document.getElementById('btnOpenSales');

  // Salon Tabs
  const tabSalonGrande = document.getElementById('tabSalonGrande');
  const tabSalonPequeno = document.getElementById('tabSalonPequeno');
  const countSalonGrande = document.getElementById('countSalonGrande');
  const countSalonPequeno = document.getElementById('countSalonPequeno');
  const activeSalonTitle = document.getElementById('activeSalonTitle');
  const activeSalonSub = document.getElementById('activeSalonSub');

  // Views
  const viewTables = document.getElementById('viewTables');
  const viewOrderDetail = document.getElementById('viewOrderDetail');
  const tablesGrid = document.getElementById('tablesGrid');
  const countFreeTables = document.getElementById('countFreeTables');
  const countBusyTables = document.getElementById('countBusyTables');

  // Order Detail
  const orderViewTableName = document.getElementById('orderViewTableName');
  const orderViewSalonBadge = document.getElementById('orderViewSalonBadge');
  const orderViewMesero = document.getElementById('orderViewMesero');
  const orderViewTotal = document.getElementById('orderViewTotal');
  const orderItemsCount = document.getElementById('orderItemsCount');
  const orderItemsList = document.getElementById('orderItemsList');
  const btnCheckoutTable = document.getElementById('btnCheckoutTable');

  // Menu Catalog
  const catalogPhaseBadge = document.getElementById('catalogPhaseBadge');
  const menuSearchInput = document.getElementById('menuSearchInput');
  const btnClearMenuSearch = document.getElementById('btnClearMenuSearch');
  const menuCategoriesScroll = document.getElementById('menuCategoriesScroll');
  const menuItemsGrid = document.getElementById('menuItemsGrid');

  // Out of Stock Elements
  const btnOpenOutOfStockPanel = document.getElementById('btnOpenOutOfStockPanel');
  const badgeOutOfStockCount = document.getElementById('badgeOutOfStockCount');
  const outOfStockModal = document.getElementById('outOfStockModal');
  const btnCloseOutOfStockModal = document.getElementById('btnCloseOutOfStockModal');
  const outOfStockSearchInput = document.getElementById('outOfStockSearchInput');
  const outOfStockListContainer = document.getElementById('outOfStockListContainer');

  // Modals
  const checkoutModal = document.getElementById('checkoutModal');
  const userProfileModal = document.getElementById('userProfileModal');
  const salesModal = document.getElementById('salesModal');
  const resetAllConfirmModal = document.getElementById('resetAllConfirmModal');

  // Checkout Receipt Elements
  const receiptTableNum = document.getElementById('receiptTableNum');
  const receiptSalon = document.getElementById('receiptSalon');
  const receiptWaiter = document.getElementById('receiptWaiter');
  const receiptItemsTbody = document.getElementById('receiptItemsTbody');
  const receiptSubtotal = document.getElementById('receiptSubtotal');
  const receiptTipAmount = document.getElementById('receiptTipAmount');
  const receiptGrandTotal = document.getElementById('receiptGrandTotal');
  const inputReceivedCash = document.getElementById('inputReceivedCash');
  const displayCashChange = document.getElementById('displayCashChange');
  const btnShareReceiptWA = document.getElementById('btnShareReceiptWA');
  const btnConfirmPayAndFree = document.getElementById('btnConfirmPayAndFree');
  const btnCloseReceipt = document.getElementById('btnCloseReceipt');

  // Audio & Haptic Feedback
  let audioCtx = null;
  function playBeep(freq = 580) {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch (e) {}
  }

  function playBuzz() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.18);
    } catch (e) {}
  }

  function vibrate(ms = 35) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  function formatCOP(num) {
    return '$' + Number(num || 0).toLocaleString('es-CO');
  }

  // ==========================================================================
  // Socket.IO Events
  // ==========================================================================

  socket.on('init-state', (data) => {
    tables = data.tables || [];
    menu = data.menu || { desayuno: [], almuerzo: [] };
    users = data.users || [];
    currentPhase = data.currentPhase || 'almuerzo';
    outOfStock = data.outOfStock || [];

    setupCurrentUser();
    applyPhaseTheme(currentPhase);
    updateOutOfStockCountBadge();
    renderTablesView();
    if (activeTableId) {
      renderActiveTableOrder();
    }
  });

  socket.on('phase-changed', (data) => {
    currentPhase = data.currentPhase;
    applyPhaseTheme(currentPhase);
    renderMenuCatalog();
    showToast(`🍽️ Menú cambiado a: ${currentPhase.toUpperCase()}`);
  });

  socket.on('table-updated', (updatedTable) => {
    const idx = tables.findIndex(t => t.id === updatedTable.id);
    if (idx !== -1) {
      tables[idx] = updatedTable;
    }
    renderTablesView();
    if (activeTableId === updatedTable.id) {
      renderActiveTableOrder();
    }
  });

  socket.on('out-of-stock-changed', (data) => {
    outOfStock = data.outOfStock || [];
    updateOutOfStockCountBadge();
    renderMenuCatalog();
    if (outOfStockModal.classList.contains('open')) {
      renderOutOfStockModalList();
    }
    const statusText = data.isOut ? 'se ACABÓ 🚫' : 'está DISPONIBLE ✅';
    const extraMsg = (data.linkedAffected && data.linkedAffected.length > 0) ? ' (y sus porciones/variedades vinculadas)' : '';
    showToast(`📢 ${escapeHtml(data.itemName)}${extraMsg} ${statusText}`);
  });

  socket.on('bill-closed', (data) => {
    showToast(`🧾 Cuenta cerrada en ${data.sale.tableName}: ${formatCOP(data.sale.total)}`);
    playBeep(700);
  });

  socket.on('all-tables-reset', (data) => {
    if (data.tables) {
      tables = data.tables;
      renderTablesView();
      if (activeTableId) {
        activeTableId = null;
        viewOrderDetail.style.display = 'none';
        viewTables.style.display = 'block';
        btnHeaderBack.style.display = 'none';
        headerTableTitle.textContent = 'Comandas en vivo';
      }
      if (salesModal && salesModal.classList.contains('open')) {
        openSalesModal();
      }
    }
    if (Array.isArray(data.outOfStock)) {
      outOfStock = data.outOfStock;
      updateOutOfStockCountBadge();
      renderMenuCatalog();
      if (outOfStockModal && outOfStockModal.classList.contains('open')) {
        renderOutOfStockModalList();
      }
    }
    showToast(`🔄 Cuentas, mesas y disponibilidad de productos restablecidos por ${escapeHtml(data.resetBy || 'Camilo')}`);
    playBeep(650);
  });

  // ==========================================================================
  // User Profile Setup (5 Meseros / Usuarios) & Permisos de Administrador
  // ==========================================================================

  function isCamiloUser() {
    return currentUser && currentUser.name && currentUser.name.trim().toLowerCase().includes('camilo');
  }

  function updateCamiloResetButton() {
    const btnReset = document.getElementById('btnResetAllTables');
    const containerFooter = document.getElementById('camiloResetContainer');
    const show = isCamiloUser();
    if (btnReset) {
      btnReset.style.display = show ? 'inline-flex' : 'none';
    }
    if (containerFooter) {
      containerFooter.style.display = show ? 'flex' : 'none';
    }
  }

  function setupCurrentUser() {
    const savedId = localStorage.getItem('caporal_user_id');
    currentUser = users.find(u => u.id === savedId) || users[0] || {
      id: 'u1', name: 'Camilo', role: 'mesero', icon: '', color: '#f59e0b'
    };
    if (userAvatar) {
      const initial = (currentUser.name || 'C').charAt(0).toUpperCase();
      userAvatar.textContent = initial;
      userAvatar.style.backgroundColor = currentUser.color || '#f59e0b';
    }
    if (userNameHeader) {
      userNameHeader.textContent = currentUser.name;
    }
    updateCamiloResetButton();
  }

  function renderUsersModalList() {
    const list = document.getElementById('usersSelectionList');
    list.innerHTML = users.map(u => {
      const initial = (u.name || 'U').charAt(0).toUpperCase();
      const color = u.color || '#f59e0b';
      const isActive = currentUser && currentUser.id === u.id;
      return `
        <div class="user-choice-card ${isActive ? 'active' : ''}" data-id="${u.id}">
          <div class="user-choice-left">
            <span class="user-avatar-badge" style="background-color: ${color}; color: #ffffff; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 50%; font-size: 1rem;">
              ${initial}
            </span>
            <div>
              <div class="user-choice-name">${escapeHtml(u.name)}</div>
            </div>
          </div>
          ${isActive ? '<span class="text-gold font-bold">✓ En uso</span>' : ''}
        </div>
      `;
    }).join('');

    list.querySelectorAll('.user-choice-card').forEach(card => {
      card.addEventListener('click', () => {
        vibrate(25);
        const id = card.getAttribute('data-id');
        const selected = users.find(u => u.id === id);
        if (selected) {
          currentUser = selected;
          localStorage.setItem('caporal_user_id', selected.id);
          setupCurrentUser();
          userProfileModal.classList.remove('open');
          showToast(`👤 Perfil cambiado a: ${escapeHtml(currentUser.name)}`);
        }
      });
    });
  }

  btnUserProfile.addEventListener('click', () => {
    renderUsersModalList();
    userProfileModal.classList.add('open');
  });
  document.getElementById('btnCloseUserModal').addEventListener('click', () => {
    userProfileModal.classList.remove('open');
  });

  // ==========================================================================
  // Phase System (Desayuno vs Almuerzo)
  // ==========================================================================

  function applyPhaseTheme(phase) {
    activeCategory = 'ALL';
    searchQuery = '';
    if (menuSearchInput) menuSearchInput.value = '';
    if (btnClearMenuSearch) btnClearMenuSearch.style.display = 'none';

    if (phase === 'desayuno') {
      bodyEl.className = 'phase-desayuno';
      phaseIcon.textContent = '☕';
      phaseLabel.textContent = 'Desayuno';
      if (phaseNextLabel) phaseNextLabel.textContent = 'Almuerzo 🥩';
      catalogPhaseBadge.textContent = 'Carta de Desayuno';
    } else {
      bodyEl.className = 'phase-almuerzo';
      phaseIcon.textContent = '🥩';
      phaseLabel.textContent = 'Almuerzo';
      if (phaseNextLabel) phaseNextLabel.textContent = 'Desayuno ☀️';
      catalogPhaseBadge.textContent = 'Carta de Almuerzo';
    }
  }

  // 1 Solo Clic para alternar fase de menú (Desayuno <-> Almuerzo)
  btnPhaseToggle.addEventListener('click', () => {
    vibrate(30);
    playBeep(650);
    const target = (currentPhase === 'desayuno') ? 'almuerzo' : 'desayuno';
    switchPhase(target);
  });

  function switchPhase(phase) {
    fetch('/api/phase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase })
    }).catch(err => console.error(err));
  }

  // ==========================================================================
  // SALON SELECTOR (Salón Grande vs Salón Pequeño)
  // ==========================================================================

  tabSalonGrande.addEventListener('click', () => {
    vibrate(20);
    activeSalon = 'grande';
    tabSalonGrande.classList.add('active');
    tabSalonPequeno.classList.remove('active');
    if (activeSalonTitle) activeSalonTitle.textContent = 'Mesas de Salón Grande';
    if (activeSalonSub) activeSalonSub.textContent = 'Mesas 1 a 96 (Ordenadas de menor a mayor)';
    renderTablesView();
  });

  tabSalonPequeno.addEventListener('click', () => {
    vibrate(20);
    activeSalon = 'pequeño';
    tabSalonPequeno.classList.add('active');
    tabSalonGrande.classList.remove('active');
    if (activeSalonTitle) activeSalonTitle.textContent = 'Mesas de Salón Pequeño';
    if (activeSalonSub) activeSalonSub.textContent = 'Mesas 6 a 60 (Ordenadas de menor a mayor)';
    renderTablesView();
  });

  // ==========================================================================
  // VIEW 1: RENDER TABLES (Sorted numerically menor a mayor)
  // ==========================================================================

  function renderTablesView() {
    // Count totals for each salon
    const grandeTables = tables.filter(t => t.salon === 'grande');
    const pequenoTables = tables.filter(t => t.salon === 'pequeño');

    const busyGrande = grandeTables.filter(t => t.status === 'busy' && t.order && t.order.length > 0).length;
    const busyPequeno = pequenoTables.filter(t => t.status === 'busy' && t.order && t.order.length > 0).length;

    countSalonGrande.textContent = `${grandeTables.length} Mesas ${busyGrande > 0 ? `(${busyGrande} ocupadas)` : ''}`;
    countSalonPequeno.textContent = `${pequenoTables.length} Mesas ${busyPequeno > 0 ? `(${busyPequeno} ocupadas)` : ''}`;

    // Filter by active salon & sort from lowest to highest numerical ID
    const currentSalonTables = (activeSalon === 'grande' ? grandeTables : pequenoTables)
      .slice()
      .sort((a, b) => a.id - b.id);

    const freeCount = currentSalonTables.filter(t => t.status === 'free').length;
    const busyCount = currentSalonTables.length - freeCount;

    if (countFreeTables) countFreeTables.textContent = `${freeCount} Libres`;
    if (countBusyTables) countBusyTables.textContent = `${busyCount} Ocupadas`;

    tablesGrid.innerHTML = currentSalonTables.map(t => {
      const isBusy = t.status === 'busy' && t.order && t.order.length > 0;
      const totalAmount = t.total || 0;
      const itemCount = t.order ? t.order.reduce((s, it) => s + it.qty, 0) : 0;
      const waiter = t.mesero ? escapeHtml(t.mesero) : 'Sin asignar';

      return `
        <article class="table-card ${isBusy ? 'busy' : 'free'}" data-id="${t.id}">
          <div class="table-card-top">
            <div class="table-name-badge">
              <span class="table-number">${escapeHtml(t.name)}</span>
              <span class="status-pill ${isBusy ? 'busy' : 'free'}">
                ${isBusy ? '● Ocupada' : '○ Libre'}
              </span>
            </div>
            ${isBusy ? `<span class="table-waiter-info">${waiter}</span>` : ''}
          </div>

          ${isBusy ? `
            <div class="table-total-row">
              <div>
                <span class="table-total-label">Total (${itemCount} productos):</span>
              </div>
              <strong class="table-total-val text-gold">${formatCOP(totalAmount)}</strong>
            </div>
          ` : `
            <div class="table-empty-hint">Mesa disponible para nuevos comensales</div>
          `}

          <div class="table-actions-row">
            <button class="btn-open-table btn-tap-open-table" data-id="${t.id}">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14"></path>
              </svg>
              ${isBusy ? 'Ver / Agregar Platos' : 'Abrir Mesa y Pedir'}
            </button>
            ${isBusy ? `
              <button class="btn-quick-bill btn-tap-bill" data-id="${t.id}">
                🧾 Sacar Cuenta
              </button>
            ` : ''}
          </div>
        </article>
      `;
    }).join('');

    // Bind table events
    tablesGrid.querySelectorAll('.table-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.getAttribute('data-id'), 10);
        openTableOrder(id);
      });
    });

    tablesGrid.querySelectorAll('.btn-tap-bill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.getAttribute('data-id'), 10);
        openCheckoutReceipt(id);
      });
    });
  }

  // ==========================================================================
  // VIEW 2: ACTIVE TABLE ORDER DETAIL & CATALOG
  // ==========================================================================

  function openTableOrder(tableId) {
    vibrate(30);
    playBeep(600);
    activeTableId = tableId;
    activeCategory = 'ALL';
    searchQuery = '';
    if (menuSearchInput) menuSearchInput.value = '';
    if (btnClearMenuSearch) btnClearMenuSearch.style.display = 'none';

    viewTables.style.display = 'none';
    viewOrderDetail.style.display = 'block';
    btnHeaderBack.style.display = 'flex';

    renderActiveTableOrder();
    renderMenuCatalog();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  btnHeaderBack.addEventListener('click', () => {
    vibrate(20);
    activeTableId = null;
    viewOrderDetail.style.display = 'none';
    viewTables.style.display = 'block';
    btnHeaderBack.style.display = 'none';
    headerTableTitle.textContent = 'Comandas en vivo';
    renderTablesView();
  });

  function renderActiveTableOrder() {
    const table = tables.find(t => t.id === activeTableId);
    if (!table) return;

    headerTableTitle.textContent = `${table.name} (${table.salon === 'grande' ? 'S. Grande' : 'S. Pequeño'})`;
    orderViewTableName.textContent = table.name;
    orderViewSalonBadge.textContent = table.salon === 'grande' ? '🏛️ Salón Grande' : '🏡 Salón Pequeño';
    orderViewMesero.textContent = currentUser ? currentUser.name : 'Mesero';
    orderViewTotal.textContent = formatCOP(table.total || 0);

    const items = table.order || [];
    const totalQty = items.reduce((s, it) => s + it.qty, 0);
    orderItemsCount.textContent = `${totalQty} productos`;

    if (items.length === 0) {
      orderItemsList.innerHTML = `
        <div class="text-center text-muted p-3">
          🍽️ Esta mesa no tiene productos todavía.<br>
          <span class="text-xs">Selecciona platos o bebidas de la carta abajo para comenzar.</span>
        </div>
      `;
    } else {
      orderItemsList.innerHTML = items.map(item => `
        <div class="order-item-row" data-id="${item.id}">
          <div class="order-item-info">
            <div class="order-item-name">${escapeHtml(item.name)}</div>
            <div class="order-item-unit-price">${formatCOP(item.price)} c/u</div>
          </div>

          <div class="qty-control-box">
            <button class="qty-btn minus btn-order-minus" data-id="${item.id}">−</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn plus btn-order-plus" data-id="${item.id}">+</button>
          </div>

          <div class="order-item-subtotal">
            ${formatCOP(item.price * item.qty)}
          </div>
        </div>
      `).join('');

      orderItemsList.querySelectorAll('.btn-order-plus').forEach(btn => {
        btn.addEventListener('click', () => {
          vibrate(20);
          playBeep(650);
          const itemId = btn.getAttribute('data-id');
          updateItemQty(itemId, 1);
        });
      });

      orderItemsList.querySelectorAll('.btn-order-minus').forEach(btn => {
        btn.addEventListener('click', () => {
          vibrate(20);
          playBeep(450);
          const itemId = btn.getAttribute('data-id');
          updateItemQty(itemId, -1);
        });
      });
    }
  }

  function updateItemQty(itemId, delta) {
    if (!activeTableId) return;

    fetch(`/api/tables/${activeTableId}/item-qty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, delta })
    }).catch(err => console.error(err));
  }

  // ==========================================================================
  // MENU CATALOG (With Out-of-Stock handling)
  // ==========================================================================

  function renderMenuCatalog() {
    const activeMenuCategoryList = menu[currentPhase] || [];
    const allCount = activeMenuCategoryList.reduce((acc, cat) => acc + cat.items.length, 0);

    let pillsHTML = `<button class="cat-tab ${activeCategory === 'ALL' ? 'active' : ''}" data-cat-idx="-1">Todos (${allCount})</button>`;
    activeMenuCategoryList.forEach((cat, idx) => {
      const isSelected = (activeCategory === cat.category);
      pillsHTML += `
        <button class="cat-tab ${isSelected ? 'active' : ''}" data-cat-idx="${idx}">
          ${escapeHtml(cat.category)} (${cat.items.length})
        </button>
      `;
    });
    menuCategoriesScroll.innerHTML = pillsHTML;

    menuCategoriesScroll.querySelectorAll('.cat-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        vibrate(15);
        const idx = parseInt(btn.getAttribute('data-cat-idx'), 10);
        if (idx === -1 || isNaN(idx) || !activeMenuCategoryList[idx]) {
          activeCategory = 'ALL';
        } else {
          activeCategory = activeMenuCategoryList[idx].category;
        }
        renderMenuCatalog();
      });
    });

    let filteredItems = [];
    activeMenuCategoryList.forEach(cat => {
      if (activeCategory === 'ALL' || activeCategory === cat.category) {
        cat.items.forEach(item => {
          if (searchQuery) {
            const q = searchQuery.toLowerCase().trim();
            if (!item.name.toLowerCase().includes(q) && !(item.desc || '').toLowerCase().includes(q)) {
              return;
            }
          }
          filteredItems.push({ ...item, category: cat.category });
        });
      }
    });

    if (filteredItems.length === 0) {
      menuItemsGrid.innerHTML = `
        <div class="empty-catalog-box">
          <span class="empty-catalog-icon">🍽️</span>
          <p class="empty-catalog-text">No hay platos disponibles en esta categoría.</p>
        </div>
      `;
      return;
    }

    menuItemsGrid.innerHTML = filteredItems.map(item => {
      const isSoldOut = outOfStock.includes(item.id);
      return `
        <div class="product-add-card ${isSoldOut ? 'out-of-stock' : ''}" data-id="${item.id}" data-soldout="${isSoldOut}">
          <div class="product-add-info">
            <div class="product-add-title">${escapeHtml(item.name)}</div>
            ${item.desc ? `<div class="product-add-desc">${escapeHtml(item.desc)}</div>` : ''}
            <div class="product-add-price">${formatCOP(item.price)}</div>
          </div>
          <button class="btn-add-item btn-tap-add-catalog" data-id="${item.id}" data-name="${escapeHtml(item.name)}" data-price="${item.price}" data-soldout="${isSoldOut}">
            ${isSoldOut ? '🚫 Agotado' : '+ Agregar'}
          </button>
        </div>
      `;
    }).join('');

    menuItemsGrid.querySelectorAll('.product-add-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const isSoldOut = card.getAttribute('data-soldout') === 'true';
        const id = card.getAttribute('data-id');
        const titleEl = card.querySelector('.product-add-title');
        const name = titleEl ? titleEl.textContent : 'Este producto';

        if (isSoldOut) {
          // Trigger alert if sold out
          playBuzz();
          vibrate(70);
          showToast(`⚠️ ¡SE ACABÓ! "${escapeHtml(name)}" está agotado y no se puede pedir.`);
          return;
        }

        // If clicked on card body and not already on the button, add it
        if (!e.target.closest('.btn-add-item')) {
          const btn = card.querySelector('.btn-tap-add-catalog');
          if (btn) btn.click();
        }
      });
    });

    menuItemsGrid.querySelectorAll('.btn-tap-add-catalog').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isSoldOut = btn.getAttribute('data-soldout') === 'true';
        const name = btn.getAttribute('data-name');

        if (isSoldOut) {
          playBuzz();
          vibrate(70);
          showToast(`⚠️ ¡SE ACABÓ! "${escapeHtml(name)}" está agotado y no se puede pedir.`);
          return;
        }

        vibrate(30);
        playBeep(620);
        const item = {
          id: btn.getAttribute('data-id'),
          name: name,
          price: Number(btn.getAttribute('data-price'))
        };
        addItemToActiveTable(item);
      });
    });
  }

  function addItemToActiveTable(item) {
    if (!activeTableId) return;

    // Check once again if sold out
    if (outOfStock.includes(item.id)) {
      playBuzz();
      vibrate(70);
      showToast(`⚠️ ¡SE ACABÓ! "${escapeHtml(item.name)}" está agotado.`);
      return;
    }

    fetch(`/api/tables/${activeTableId}/item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: 1,
        userName: currentUser ? currentUser.name : 'Mesero'
      })
    })
    .then(r => r.json())
    .then(data => {
      showToast(`+1 ${escapeHtml(item.name)} agregado a Mesa ${activeTableId}`);
    })
    .catch(err => console.error(err));
  }

  // Search filter
  menuSearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    btnClearMenuSearch.style.display = searchQuery ? 'flex' : 'none';
    renderMenuCatalog();
  });

  btnClearMenuSearch.addEventListener('click', () => {
    menuSearchInput.value = '';
    searchQuery = '';
    btnClearMenuSearch.style.display = 'none';
    renderMenuCatalog();
  });

  // ==========================================================================
  // OUT OF STOCK MANAGEMENT (Bottom Panel)
  // ==========================================================================

  function updateOutOfStockCountBadge() {
    badgeOutOfStockCount.textContent = outOfStock.length;
  }

  btnOpenOutOfStockPanel.addEventListener('click', () => {
    vibrate(20);
    renderOutOfStockModalList();
    outOfStockModal.classList.add('open');
  });

  btnCloseOutOfStockModal.addEventListener('click', () => {
    outOfStockModal.classList.remove('open');
  });

  outOfStockSearchInput.addEventListener('input', (e) => {
    outOfStockSearchQuery = e.target.value.trim().toLowerCase();
    renderOutOfStockModalList();
  });

  function renderOutOfStockModalList() {
    // Gather all products across current phase (or all phases)
    const allCategories = (menu[currentPhase] || []);
    let allProducts = [];
    allCategories.forEach(cat => {
      cat.items.forEach(it => {
        allProducts.push({ ...it, category: cat.category });
      });
    });

    if (outOfStockSearchQuery) {
      allProducts = allProducts.filter(p => 
        p.name.toLowerCase().includes(outOfStockSearchQuery) || 
        p.category.toLowerCase().includes(outOfStockSearchQuery)
      );
    }

    if (allProducts.length === 0) {
      outOfStockListContainer.innerHTML = '<div class="text-center text-muted p-3">No hay productos que coincidan.</div>';
      return;
    }

    outOfStockListContainer.innerHTML = allProducts.map(p => {
      const isOut = outOfStock.includes(p.id);
      return `
        <div class="out-toggle-item ${isOut ? 'is-out' : ''}" data-id="${p.id}">
          <div class="out-toggle-info">
            <div class="out-toggle-name">${escapeHtml(p.name)}</div>
            <div class="out-toggle-cat">${escapeHtml(p.category)} • ${formatCOP(p.price)}</div>
          </div>
          <button class="btn-toggle-stock ${isOut ? 'sold-out' : 'available'}" data-id="${p.id}" data-name="${escapeHtml(p.name)}">
            ${isOut ? '🚫 AGOTADO' : '🟢 Disponible'}
          </button>
        </div>
      `;
    }).join('');

    outOfStockListContainer.querySelectorAll('.btn-toggle-stock').forEach(btn => {
      btn.addEventListener('click', () => {
        vibrate(25);
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        toggleOutOfStock(id, name);
      });
    });
  }

  function toggleOutOfStock(itemId, itemName) {
    fetch('/api/out-of-stock/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, itemName })
    })
    .then(r => r.json())
    .then(data => {
      outOfStock = data.outOfStock;
      updateOutOfStockCountBadge();
      renderOutOfStockModalList();
      renderMenuCatalog();
    })
    .catch(err => console.error(err));
  }

  // ==========================================================================
  // SACAR LA CUENTA / CHECKOUT RECEIPT MODAL
  // ==========================================================================

  btnCheckoutTable.addEventListener('click', () => {
    if (activeTableId) {
      openCheckoutReceipt(activeTableId);
    }
  });

  function openCheckoutReceipt(tableId) {
    vibrate(35);
    playBeep(520);
    currentReceiptTableId = tableId;

    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    receiptTableNum.textContent = table.name;
    receiptSalon.textContent = table.salon === 'grande' ? 'Salón Grande' : 'Salón Pequeño';
    receiptWaiter.textContent = table.mesero || (currentUser ? currentUser.name : 'Mesero');

    checkoutTipPercent = 0;
    inputReceivedCash.value = '';
    displayCashChange.textContent = '$0';

    updateReceiptCalculations();
    checkoutModal.classList.add('open');
  }

  function updateReceiptCalculations() {
    const table = tables.find(t => t.id === currentReceiptTableId);
    if (!table) return;

    const items = table.order || [];
    receiptItemsTbody.innerHTML = items.map(it => `
      <tr>
        <td class="text-left font-bold">${it.qty}</td>
        <td class="text-left">${escapeHtml(it.name)}</td>
        <td class="text-right">${formatCOP(it.price * it.qty)}</td>
      </tr>
    `).join('');

    const grandTotal = items.reduce((s, it) => s + (it.price * it.qty), 0);
    receiptGrandTotal.textContent = formatCOP(grandTotal);

    const received = Number(inputReceivedCash.value) || 0;
    if (received >= grandTotal && grandTotal > 0) {
      displayCashChange.textContent = formatCOP(received - grandTotal);
    } else {
      displayCashChange.textContent = '$0';
    }
  }

  // Close X on Receipt
  const btnReceiptCloseX = document.getElementById('btnReceiptCloseX');
  if (btnReceiptCloseX) {
    btnReceiptCloseX.addEventListener('click', () => {
      checkoutModal.classList.remove('open');
    });
  }

  document.querySelectorAll('.pay-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      vibrate(20);
      document.querySelectorAll('.pay-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      checkoutPaymentMethod = btn.getAttribute('data-method');
    });
  });

  inputReceivedCash.addEventListener('input', () => {
    updateReceiptCalculations();
  });

  // WhatsApp Ticket
  btnShareReceiptWA.addEventListener('click', () => {
    const table = tables.find(t => t.id === currentReceiptTableId);
    if (!table) return;

    const items = table.order || [];
    const grandTotal = items.reduce((s, it) => s + (it.price * it.qty), 0);
    const salonName = table.salon === 'grande' ? 'Salón Grande' : 'Salón Pequeño';

    let text = `🥩 *LA FONDA DEL CAPORAL*\n`;
    text += `📍 *${table.name.toUpperCase()}* (${salonName})\n`;
    text += `📅 *Fecha:* ${new Date().toLocaleString('es-CO')}\n`;
    text += `👤 *Atendió:* ${table.mesero || currentUser.name}\n`;
    text += `--------------------------------\n`;

    items.forEach(it => {
      text += `${it.qty}x ${it.name} - ${formatCOP(it.price * it.qty)}\n`;
    });

    text += `--------------------------------\n`;
    text += `💰 *TOTAL DE LA CUENTA:* ${formatCOP(grandTotal)}\n`;
    text += `💳 *Método de Pago:* ${checkoutPaymentMethod}\n`;
    text += `\n_¡Muchas gracias por su visita a La Fonda del Caporal!_`;

    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  });

  // Confirm Pay and Free Table
  btnConfirmPayAndFree.addEventListener('click', () => {
    const table = tables.find(t => t.id === currentReceiptTableId);
    if (!table) return;

    const items = table.order || [];
    const grandTotal = items.reduce((s, it) => s + (it.price * it.qty), 0);

    if (confirm(`¿Confirmar cobro de ${formatCOP(grandTotal)} y liberar ${table.name}?`)) {
      fetch(`/api/tables/${currentReceiptTableId}/close-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: checkoutPaymentMethod,
          closedBy: currentUser ? currentUser.name : 'Mesero'
        })
      })
      .then(r => r.json())
      .then(data => {
        checkoutModal.classList.remove('open');
        showToast(`✅ ${table.name} pagada y liberada con éxito`);
        playBeep(750);

        if (activeTableId === currentReceiptTableId) {
          btnHeaderBack.click();
        }
      })
      .catch(err => console.error(err));
    }
  });

  btnCloseReceipt.addEventListener('click', () => {
    checkoutModal.classList.remove('open');
  });

  // ==========================================================================
  // SALES & CASH REGISTER HISTORY
  // ==========================================================================

  btnOpenSales.addEventListener('click', () => {
    openSalesModal();
  });

  function openSalesModal() {
    salesModal.classList.add('open');
    document.getElementById('salesDateHeader').textContent = new Date().toLocaleDateString('es-CO', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    fetch('/api/sales')
      .then(r => r.json())
      .then(salesList => {
        const totalSales = salesList.reduce((acc, s) => acc + s.total, 0);

        document.getElementById('statSalesTotal').textContent = formatCOP(totalSales);
        document.getElementById('statSalesCount').textContent = salesList.length;

        const listContainer = document.getElementById('salesHistoryList');
        if (salesList.length === 0) {
          listContainer.innerHTML = '<div class="text-center text-muted p-3">No hay cuentas cerradas todavía hoy.</div>';
          return;
        }

        listContainer.innerHTML = salesList.map(s => `
          <div class="sale-record-card">
            <div class="sale-record-top">
              <strong>${escapeHtml(s.tableName)}</strong>
              <span class="text-gold font-bold">${formatCOP(s.total)}</span>
            </div>
            <div class="text-xs text-muted">
              ${new Date(s.closedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} • 
              Pago: ${escapeHtml(s.paymentMethod)} • Atendió: ${escapeHtml(s.mesero || 'Mesero')}
            </div>
            <div class="text-xs text-slate mt-1">
              ${s.order.map(it => `${it.qty}x ${it.name}`).join(', ')}
            </div>
          </div>
        `).join('');
      })
      .catch(err => console.error(err));
  }

  document.getElementById('btnCloseSalesModal').addEventListener('click', () => {
    salesModal.classList.remove('open');
  });

  // ==========================================================================
  // CONFIRMACIÓN REINICIAR TODAS LAS CUENTAS (EXCLUSIVO PARA CAMILO)
  // ==========================================================================

  const btnResetAllTables = document.getElementById('btnResetAllTables');
  const btnResetAllTablesFooter = document.getElementById('btnResetAllTablesFooter');
  const btnCloseResetConfirmModal = document.getElementById('btnCloseResetConfirmModal');
  const btnCancelResetAll = document.getElementById('btnCancelResetAll');
  const btnConfirmResetAll = document.getElementById('btnConfirmResetAll');

  function openResetConfirmModal() {
    if (!isCamiloUser()) {
      showToast('⚠️ Solo el usuario Camilo puede reiniciar las cuentas.');
      return;
    }
    vibrate(30);
    if (resetAllConfirmModal) resetAllConfirmModal.classList.add('open');
  }

  function closeResetConfirmModal() {
    if (resetAllConfirmModal) resetAllConfirmModal.classList.remove('open');
  }

  if (btnResetAllTables) {
    btnResetAllTables.addEventListener('click', openResetConfirmModal);
  }
  if (btnResetAllTablesFooter) {
    btnResetAllTablesFooter.addEventListener('click', openResetConfirmModal);
  }
  if (btnCloseResetConfirmModal) {
    btnCloseResetConfirmModal.addEventListener('click', closeResetConfirmModal);
  }
  if (btnCancelResetAll) {
    btnCancelResetAll.addEventListener('click', closeResetConfirmModal);
  }

  if (btnConfirmResetAll) {
    btnConfirmResetAll.addEventListener('click', () => {
      if (!isCamiloUser()) {
        showToast('⚠️ Acción no autorizada.');
        closeResetConfirmModal();
        return;
      }

      btnConfirmResetAll.disabled = true;
      btnConfirmResetAll.textContent = 'Reiniciando...';

      fetch('/api/tables/reset-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: currentUser ? currentUser.name : 'Camilo' })
      })
      .then(res => res.json())
      .then(data => {
        closeResetConfirmModal();
        btnConfirmResetAll.disabled = false;
        btnConfirmResetAll.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          Sí, Reiniciar Todo
        `;
        if (data.tables) {
          tables = data.tables;
          renderTablesView();
          if (activeTableId) {
            activeTableId = null;
            viewOrderDetail.style.display = 'none';
            viewTables.style.display = 'block';
            btnHeaderBack.style.display = 'none';
            headerTableTitle.textContent = 'Comandas en vivo';
          }
        }
        if (Array.isArray(data.outOfStock)) {
          outOfStock = data.outOfStock;
          updateOutOfStockCountBadge();
          renderMenuCatalog();
          if (outOfStockModal && outOfStockModal.classList.contains('open')) {
            renderOutOfStockModalList();
          }
        }
        if (salesModal && salesModal.classList.contains('open')) {
          openSalesModal();
        }
        showToast('🔄 Mesas, ventas del día y disponibilidad de productos restablecidos.');
        playBeep(650);
      })
      .catch(err => {
        console.error(err);
        btnConfirmResetAll.disabled = false;
        btnConfirmResetAll.textContent = 'Sí, Reiniciar Todo';
        showToast('❌ Error al reiniciar el sistema.');
      });
    });
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  function showToast(message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
