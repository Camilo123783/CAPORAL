const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const TABLES_FILE = path.join(DATA_DIR, 'tables.json');
const MENU_FILE = path.join(DATA_DIR, 'menu.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SALES_FILE = path.join(DATA_DIR, 'sales.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const OUT_OF_STOCK_FILE = path.join(DATA_DIR, 'outOfStock.json');
const LINKED_ITEMS_FILE = path.join(DATA_DIR, 'linkedItems.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helpers for File IO
function readJSON(file, fallback = []) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (err) {
    console.error(`Error leyendo ${file}:`, err);
  }
  return fallback;
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error guardando ${file}:`, err);
  }
}

// In-Memory State
let tables = readJSON(TABLES_FILE, []);
let menu = readJSON(MENU_FILE, { desayuno: [], almuerzo: [] });
let users = readJSON(USERS_FILE, []);
let sales = readJSON(SALES_FILE, []);
let products = readJSON(PRODUCTS_FILE, []);
let outOfStock = readJSON(OUT_OF_STOCK_FILE, []);
let linkedItems = readJSON(LINKED_ITEMS_FILE, {});

// Phase System: Auto (9am-12pm Desayuno, 12pm-17pm Almuerzo) vs Manual Override
let phaseMode = 'auto'; // 'auto' | 'manual'
let manualPhase = 'almuerzo'; // 'desayuno' | 'almuerzo'

function calculatePhase() {
  if (phaseMode === 'manual') {
    return manualPhase;
  }
  const now = new Date();
  const hour = now.getHours();
  // 9:00 AM to 11:59 AM -> Desayuno
  if (hour >= 9 && hour < 12) {
    return 'desayuno';
  }
  // 12:00 PM to 4:59 PM (17:00) -> Almuerzo
  if (hour >= 12 && hour < 17) {
    return 'almuerzo';
  }
  // If outside standard window, default to closest
  return hour < 9 ? 'desayuno' : 'almuerzo';
}

function getTableTotal(order) {
  const total = order.reduce((sum, item) => sum + (item.price * item.qty), 0);
  return { subtotal: total, total };
}

function getNetworkIp() {
  const interfaces = os.networkInterfaces();
  let fallbackIp = null;

  for (const name of Object.keys(interfaces)) {
    const isVirtual = /virtual|vbox|vmware|docker|loopback|pseudo/i.test(name);
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('192.168.56.')) continue;
        if (/wi-fi|wlan|wireless/i.test(name)) {
          return iface.address;
        }
        if (!isVirtual && !fallbackIp) {
          fallbackIp = iface.address;
        }
      }
    }
  }
  return fallbackIp || 'localhost';
}

// ==========================================================================
// REST APIs
// ==========================================================================

// Global state for initial load
app.get('/api/state', (req, res) => {
  const currentPhase = calculatePhase();
  const tablesWithTotals = tables.map(t => ({
    ...t,
    ...getTableTotal(t.order, t.tipPercent)
  }));

  res.json({
    appName: 'LA FONDA DEL CAPORAL',
    tables: tablesWithTotals,
    menu,
    users,
    currentPhase,
    phaseMode,
    manualPhase,
    outOfStock,
    activeTime: new Date().toLocaleTimeString('es-CO')
  });
});

// Out of stock endpoints
app.get('/api/out-of-stock', (req, res) => {
  res.json(outOfStock);
});

app.post('/api/out-of-stock/toggle', (req, res) => {
  const { itemId, itemName } = req.body;
  if (!itemId) return res.status(400).json({ error: 'itemId requerido' });

  const idx = outOfStock.indexOf(itemId);
  let isOut = false;
  const itemsToUpdate = [itemId];

  if (linkedItems && linkedItems[itemId]) {
    linkedItems[itemId].forEach(linkedId => {
      if (!itemsToUpdate.includes(linkedId)) {
        itemsToUpdate.push(linkedId);
      }
    });
  }

  if (idx !== -1) {
    // Unmark all linked
    itemsToUpdate.forEach(id => {
      const p = outOfStock.indexOf(id);
      if (p !== -1) outOfStock.splice(p, 1);
    });
    isOut = false;
  } else {
    // Mark all linked as out
    itemsToUpdate.forEach(id => {
      if (!outOfStock.includes(id)) outOfStock.push(id);
    });
    isOut = true;
  }
  writeJSON(OUT_OF_STOCK_FILE, outOfStock);

  io.emit('out-of-stock-changed', {
    outOfStock,
    itemId,
    itemName: itemName || 'Producto',
    linkedAffected: itemsToUpdate.filter(id => id !== itemId),
    isOut
  });

  res.json({ success: true, outOfStock, isOut, itemsToUpdate });
});

app.get('/api/info', async (req, res) => {
  const ip = getNetworkIp();
  const networkUrl = `http://${ip}:${PORT}`;
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(networkUrl, {
      margin: 2,
      width: 280,
      color: { dark: '#0f172a', light: '#ffffff' }
    });
  } catch (err) {}

  res.json({
    appName: 'LA FONDA DEL CAPORAL',
    ip,
    port: PORT,
    networkUrl,
    qrDataUrl
  });
});

// Phase switch API (Auto or Manual)
app.post('/api/phase', (req, res) => {
  const { mode, phase } = req.body;
  if (mode === 'auto' || mode === 'manual') {
    phaseMode = mode;
  }
  if (phase === 'desayuno' || phase === 'almuerzo') {
    manualPhase = phase;
  }
  const currentPhase = calculatePhase();
  io.emit('phase-changed', {
    currentPhase,
    phaseMode,
    manualPhase
  });
  res.json({ success: true, currentPhase, phaseMode, manualPhase });
});

// Add / Update item in Table
app.post('/api/tables/:id/item', (req, res) => {
  const tableId = parseInt(req.params.id, 10);
  const table = tables.find(t => t.id === tableId);
  if (!table) return res.status(404).json({ error: 'Mesa no encontrada' });

  const { id, name, price, qty = 1, notes = '', userName = 'Mesero' } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'Nombre y precio son requeridos' });
  }

  // Find existing item in order
  const existing = table.order.find(it => it.id === id);
  if (existing) {
    existing.qty += qty;
    if (notes) existing.notes = notes;
    existing.updatedBy = userName;
    existing.updatedAt = new Date().toISOString();
  } else {
    table.order.push({
      id: id || 'item-' + Date.now(),
      name,
      price: Number(price),
      qty: Math.max(1, qty),
      notes,
      addedBy: userName,
      addedAt: new Date().toISOString()
    });
  }

  table.status = 'busy';
  if (!table.openedAt) {
    table.openedAt = new Date().toISOString();
  }
  table.mesero = userName;

  writeJSON(TABLES_FILE, tables);

  const totals = getTableTotal(table.order, table.tipPercent);
  const updatedTable = { ...table, ...totals };

  io.emit('table-updated', updatedTable);
  res.json({ success: true, table: updatedTable });
});

// Update item quantity in Table (+1 / -1 / delete)
app.post('/api/tables/:id/item-qty', (req, res) => {
  const tableId = parseInt(req.params.id, 10);
  const table = tables.find(t => t.id === tableId);
  if (!table) return res.status(404).json({ error: 'Mesa no encontrada' });

  const { itemId, delta } = req.body;
  const itemIndex = table.order.findIndex(it => it.id === itemId);
  if (itemIndex === -1) return res.status(404).json({ error: 'Ítem no encontrado en la mesa' });

  table.order[itemIndex].qty += delta;
  if (table.order[itemIndex].qty <= 0) {
    table.order.splice(itemIndex, 1);
  }

  // If table has no items left, it can be marked free
  if (table.order.length === 0) {
    table.status = 'free';
    table.openedAt = null;
    table.mesero = null;
    table.notes = '';
  }

  writeJSON(TABLES_FILE, tables);

  const totals = getTableTotal(table.order, table.tipPercent);
  const updatedTable = { ...table, ...totals };

  io.emit('table-updated', updatedTable);
  res.json({ success: true, table: updatedTable });
});

// Update Tip or Notes for Table
app.put('/api/tables/:id/settings', (req, res) => {
  const tableId = parseInt(req.params.id, 10);
  const table = tables.find(t => t.id === tableId);
  if (!table) return res.status(404).json({ error: 'Mesa no encontrada' });

  const { tipPercent, notes, mesero } = req.body;
  if (tipPercent !== undefined) table.tipPercent = Number(tipPercent);
  if (notes !== undefined) table.notes = notes;
  if (mesero !== undefined) table.mesero = mesero;

  writeJSON(TABLES_FILE, tables);

  const totals = getTableTotal(table.order, table.tipPercent);
  const updatedTable = { ...table, ...totals };

  io.emit('table-updated', updatedTable);
  res.json({ success: true, table: updatedTable });
});

// Close Bill & Free Table
app.post('/api/tables/:id/close-bill', (req, res) => {
  const tableId = parseInt(req.params.id, 10);
  const table = tables.find(t => t.id === tableId);
  if (!table) return res.status(404).json({ error: 'Mesa no encontrada' });

  const { paymentMethod = 'Efectivo', closedBy = 'Caja' } = req.body;
  const total = table.order.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const saleRecord = {
    id: 'sale-' + Date.now(),
    tableId: table.id,
    tableName: table.name,
    salon: table.salon,
    order: JSON.parse(JSON.stringify(table.order)),
    total,
    paymentMethod,
    mesero: table.mesero || closedBy,
    closedBy,
    openedAt: table.openedAt,
    closedAt: new Date().toISOString()
  };

  sales.unshift(saleRecord);
  writeJSON(SALES_FILE, sales);

  // Free table
  table.status = 'free';
  table.order = [];
  table.mesero = null;
  table.openedAt = null;
  table.notes = '';
  table.tipPercent = 0;

  writeJSON(TABLES_FILE, tables);

  const updatedTable = { ...table, subtotal: 0, tip: 0, total: 0 };
  io.emit('table-updated', updatedTable);
  io.emit('bill-closed', { sale: saleRecord, table: updatedTable });

  res.json({ success: true, sale: saleRecord, table: updatedTable });
});

// Sales History & Stats
app.get('/api/sales', (req, res) => {
  res.json(sales);
});

// Reset all tables and daily sales (Only available for authorized user, e.g. Camilo)
app.post('/api/tables/reset-all', (req, res) => {
  const { userName } = req.body;
  tables.forEach(t => {
    t.status = 'free';
    t.order = [];
    t.mesero = null;
    t.openedAt = null;
    t.notes = '';
    t.tipPercent = 0;
  });
  writeJSON(TABLES_FILE, tables);

  // Reiniciar también las cuentas y caja del día
  sales = [];
  writeJSON(SALES_FILE, sales);

  const tablesWithTotals = tables.map(t => ({
    ...t,
    ...getTableTotal(t.order, t.tipPercent)
  }));

  io.emit('all-tables-reset', {
    tables: tablesWithTotals,
    sales: [],
    resetBy: userName || 'Camilo'
  });

  res.json({ success: true, tables: tablesWithTotals, sales: [] });
});

// Sockets
io.on('connection', (socket) => {
  // Send state on connect
  const currentPhase = calculatePhase();
  const tablesWithTotals = tables.map(t => ({
    ...t,
    ...getTableTotal(t.order, t.tipPercent)
  }));

  socket.emit('init-state', {
    tables: tablesWithTotals,
    menu,
    users,
    currentPhase,
    phaseMode,
    manualPhase,
    outOfStock
  });

  socket.on('switch-phase', (data) => {
    if (data.mode) phaseMode = data.mode;
    if (data.phase) manualPhase = data.phase;
    io.emit('phase-changed', {
      currentPhase: calculatePhase(),
      phaseMode,
      manualPhase
    });
  });

  socket.on('table-add-item', (data) => {
    const table = tables.find(t => t.id === data.tableId);
    if (!table) return;

    const existing = table.order.find(it => it.id === data.item.id);
    if (existing) {
      existing.qty += (data.qty || 1);
      existing.updatedBy = data.userName;
      existing.updatedAt = new Date().toISOString();
    } else {
      table.order.push({
        id: data.item.id,
        name: data.item.name,
        price: data.item.price,
        qty: data.qty || 1,
        notes: data.notes || '',
        addedBy: data.userName,
        addedAt: new Date().toISOString()
      });
    }

    table.status = 'busy';
    if (!table.openedAt) table.openedAt = new Date().toISOString();
    table.mesero = data.userName;

    writeJSON(TABLES_FILE, tables);

    const totals = getTableTotal(table.order, table.tipPercent);
    const updatedTable = { ...table, ...totals };
    io.emit('table-updated', updatedTable);
  });

  socket.on('table-qty-change', (data) => {
    const table = tables.find(t => t.id === data.tableId);
    if (!table) return;

    const idx = table.order.findIndex(it => it.id === data.itemId);
    if (idx !== -1) {
      table.order[idx].qty += data.delta;
      if (table.order[idx].qty <= 0) {
        table.order.splice(idx, 1);
      }
    }

    if (table.order.length === 0) {
      table.status = 'free';
      table.openedAt = null;
      table.mesero = null;
    }

    writeJSON(TABLES_FILE, tables);

    const totals = getTableTotal(table.order, table.tipPercent);
    const updatedTable = { ...table, ...totals };
    io.emit('table-updated', updatedTable);
  });

  socket.on('reset-all-tables', (data) => {
    tables.forEach(t => {
      t.status = 'free';
      t.order = [];
      t.mesero = null;
      t.openedAt = null;
      t.notes = '';
      t.tipPercent = 0;
    });
    writeJSON(TABLES_FILE, tables);

    // Reiniciar también las cuentas y caja del día
    sales = [];
    writeJSON(SALES_FILE, sales);

    const tablesWithTotals = tables.map(t => ({
      ...t,
      ...getTableTotal(t.order, t.tipPercent)
    }));

    io.emit('all-tables-reset', {
      tables: tablesWithTotals,
      sales: [],
      resetBy: (data && data.userName) || 'Camilo'
    });
  });
});

// Periodic Phase Check (Every 1 minute auto updates if needed)
setInterval(() => {
  if (phaseMode === 'auto') {
    const current = calculatePhase();
    io.emit('phase-tick', { currentPhase: current });
  }
}, 60000);

// Start Server
server.listen(PORT, async () => {
  const ip = getNetworkIp();
  const localUrl = `http://localhost:${PORT}`;
  const networkUrl = `http://${ip}:${PORT}`;

  console.log('\n======================================================');
  console.log('       LA FONDA DEL CAPORAL - SISTEMA DE COMANDAS      ');
  console.log('======================================================');
  console.log(`💻 Computadora: ${localUrl}`);
  console.log(`📱 Celular:     ${networkUrl}`);
  console.log(`⏰ Fase actual: ${calculatePhase().toUpperCase()} (${phaseMode})`);
  console.log('------------------------------------------------------');
  try {
    const qr = await QRCode.toString(networkUrl, { type: 'terminal', small: true });
    console.log(qr);
  } catch (e) {}
  console.log('======================================================\n');
});
