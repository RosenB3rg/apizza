// ============================================================
//  APIZZA · data.js  –  Datos y acceso a localStorage
// ============================================================

const DATA_VERSION = 6;

const IMG = {
  cheese:    'images/cheese.jpeg',
  pepperoni: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&h=400&fit=crop&auto=format&q=85',
  marinara:  'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&h=400&fit=crop&auto=format&q=85',
  fugazza:   'images/fugazza.jpeg',
  water:     'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=600&h=400&fit=crop&auto=format&q=85',
  soda:      'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=600&h=400&fit=crop&auto=format&q=85',
  beer:      'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&h=400&fit=crop&auto=format&q=85',
};

const DEFAULT_DATA = {
  _version: DATA_VERSION,
  categories: ['Pizzas grandes (50CM)', 'Slices (Porciones)', 'Bebidas'],
  items: [
    // ── Pizzas grandes (50CM) ─────────────────────────────────
    {
      id: 'g-001',
      name: 'Cheese',
      category: 'Pizzas grandes (50CM)',
      description: 'Masa fermentada por 36hs, mozzarella, tomate italiano',
      price: 23000,
      image: IMG.cheese,
      baseIngredients: ['Masa fermentada 36hs', 'Mozzarella', 'Tomate italiano'],
      available: true,
      stock: null
    },
    {
      id: 'g-002',
      name: 'Pepperoni',
      category: 'Pizzas grandes (50CM)',
      description: 'Masa fermentada por 36hs, mozzarella, tomate italiano, pepperoni',
      price: 26000,
      image: IMG.pepperoni,
      baseIngredients: ['Masa fermentada 36hs', 'Mozzarella', 'Tomate italiano', 'Pepperoni'],
      available: true,
      stock: null
    },
    {
      id: 'g-003',
      name: 'Marinara',
      category: 'Pizzas grandes (50CM)',
      description: 'Masa fermentada por 36hs, tomate italiano, ajo (sin mozzarella)',
      price: 20000,
      image: IMG.marinara,
      baseIngredients: ['Masa fermentada 36hs', 'Tomate italiano', 'Ajo'],
      available: true,
      stock: null
    },
    {
      id: 'g-004',
      name: 'Fugazza con queso',
      category: 'Pizzas grandes (50CM)',
      description: 'Masa fermentada por 36hs, mozzarella, cebolla blanca, cebolla morada, chimichurri pizzero',
      price: 23000,
      image: IMG.fugazza,
      baseIngredients: ['Masa fermentada 36hs', 'Mozzarella', 'Cebolla blanca', 'Cebolla morada', 'Chimichurri pizzero'],
      available: true,
      stock: null
    },
    // ── Slices (Porciones) ────────────────────────────────────
    {
      id: 's-001',
      name: 'Cheese',
      category: 'Slices (Porciones)',
      description: 'Masa fermentada por 36hs, mozzarella, tomate italiano',
      price: 5000,
      image: IMG.cheese,
      baseIngredients: ['Masa fermentada 36hs', 'Mozzarella', 'Tomate italiano'],
      available: true,
      stock: null
    },
    {
      id: 's-002',
      name: 'Pepperoni',
      category: 'Slices (Porciones)',
      description: 'Masa fermentada por 36hs, mozzarella, tomate italiano, pepperoni',
      price: 6500,
      image: IMG.pepperoni,
      baseIngredients: ['Masa fermentada 36hs', 'Mozzarella', 'Tomate italiano', 'Pepperoni'],
      available: true,
      stock: null
    },
    // ── Bebidas ───────────────────────────────────────────────
    {
      id: 'b-001',
      name: 'Agua Mineral 500ml',
      category: 'Bebidas',
      description: 'Agua mineral sin gas',
      price: 800,
      image: IMG.water,
      baseIngredients: [],
      available: true,
      stock: null
    },
    {
      id: 'b-002',
      name: 'Gaseosa 500ml',
      category: 'Bebidas',
      description: 'Lata fría a elección',
      price: 1200,
      image: IMG.soda,
      variants: ['Coca-Cola', 'Coca-Cola Zero'],
      baseIngredients: [],
      available: true,
      stock: null
    },
    {
      id: 'b-003',
      name: 'Cerveza 473ml',
      category: 'Bebidas',
      description: 'Lata fría',
      price: 2000,
      image: IMG.beer,
      baseIngredients: [],
      available: true,
      stock: null
    }
  ],
  extras: [
    { id: 'ext-1', name: 'Pesto', price: 1000 },
    { id: 'ext-2', name: 'Cebolla', price: 500 },
    { id: 'ext-3', name: 'Chimichurri Pizzero', price: 0 }
  ],
  combos: [],
  adminPassword: 'apizza2024',
  whatsappNumber: '5491123934273',
  googleMapsApiKey: '',
  sheetsWebhookUrl: '',
  firebaseConfig: null,
  openHours: {
    enabled: false,
    from: '18:00',
    to: '23:30',
    closedMsg: 'Estamos cerrados. ¡Volvemos pronto!',
    pickupAddress: ''
  }
};

// ── Core storage ──────────────────────────────────────────────

function getData() {
  try {
    const stored = localStorage.getItem('apizza_data');
    if (!stored) {
      const fresh = JSON.parse(JSON.stringify(DEFAULT_DATA));
      localStorage.setItem('apizza_data', JSON.stringify(fresh));
      return applyAppConfig(fresh);
    }
    const parsed = JSON.parse(stored);
    // Reset si la versión de datos cambió
    if ((parsed._version || 1) < DATA_VERSION) {
      const fresh = JSON.parse(JSON.stringify(DEFAULT_DATA));
      localStorage.setItem('apizza_data', JSON.stringify(fresh));
      return applyAppConfig(fresh);
    }
    return applyAppConfig(parsed);
  } catch (e) {
    return applyAppConfig(JSON.parse(JSON.stringify(DEFAULT_DATA)));
  }
}

// Aplica APP_CONFIG (config.js) sobre los datos — siempre tiene prioridad
function applyAppConfig(data) {
  if (typeof APP_CONFIG === 'undefined') return data;
  const cfg = APP_CONFIG;
  if (cfg.whatsappNumber)  data.whatsappNumber  = cfg.whatsappNumber;
  if (cfg.googleMapsApiKey) data.googleMapsApiKey = cfg.googleMapsApiKey;
  if (cfg.adminPassword)   data.adminPassword   = cfg.adminPassword;
  if (cfg.firebaseConfig)  data.firebaseConfig  = cfg.firebaseConfig;
  if (cfg.openHours)       data.openHours       = { ...data.openHours, ...cfg.openHours };
  return data;
}

function saveData(data) {
  localStorage.setItem('apizza_data', JSON.stringify(data));
}

// ── Items CRUD ────────────────────────────────────────────────

function addItem(item) {
  const data = getData();
  item.id = 'item-' + Date.now();
  item.available = true;
  item.stock = item.stock !== undefined ? item.stock : null;
  item.baseIngredients = item.baseIngredients || [];
  data.items.push(item);
  saveData(data);
  return item;
}

function updateItem(id, updates) {
  const data = getData();
  const idx = data.items.findIndex(i => i.id === id);
  if (idx !== -1) {
    data.items[idx] = { ...data.items[idx], ...updates };
    saveData(data);
    return data.items[idx];
  }
  return null;
}

function deleteItem(id) {
  const data = getData();
  data.items = data.items.filter(i => i.id !== id);
  saveData(data);
}

// ── Extras CRUD ───────────────────────────────────────────────

function addExtra(extra) {
  const data = getData();
  extra.id = 'ext-' + Date.now();
  data.extras.push(extra);
  saveData(data);
  return extra;
}

function updateExtra(id, updates) {
  const data = getData();
  const idx = data.extras.findIndex(e => e.id === id);
  if (idx !== -1) {
    data.extras[idx] = { ...data.extras[idx], ...updates };
    saveData(data);
  }
}

function deleteExtra(id) {
  const data = getData();
  data.extras = data.extras.filter(e => e.id !== id);
  saveData(data);
}

// ── Combos CRUD ───────────────────────────────────────────────

function getCombos() {
  return getData().combos || [];
}

function addCombo(combo) {
  const data = getData();
  combo.id = 'combo-' + Date.now();
  combo.available = true;
  combo.optionGroups = combo.optionGroups || [];
  if (!data.combos) data.combos = [];
  data.combos.push(combo);
  saveData(data);
  return combo;
}

function updateCombo(id, updates) {
  const data = getData();
  if (!data.combos) data.combos = [];
  const idx = data.combos.findIndex(c => c.id === id);
  if (idx !== -1) {
    data.combos[idx] = { ...data.combos[idx], ...updates };
    saveData(data);
    return data.combos[idx];
  }
  return null;
}

function deleteCombo(id) {
  const data = getData();
  data.combos = (data.combos || []).filter(c => c.id !== id);
  saveData(data);
}

// ── Firebase ──────────────────────────────────────────────────

let _db = null;

function initFirebase() {
  if (_db) return true;
  const data = getData();
  const cfg = data.firebaseConfig;
  if (!cfg?.apiKey) return false;
  try {
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    _db = firebase.firestore();
    window._db = _db;
    return true;
  } catch (e) {
    console.warn('Firebase init failed:', e);
    return false;
  }
}

// ── Orders ────────────────────────────────────────────────────

// Cache en memoria para cuando Firebase está activo (llenado por onSnapshot en admin.js)
window._ordersCache = null;

function getOrders() {
  if (window._ordersCache) return window._ordersCache;
  try {
    const stored = localStorage.getItem('apizza_orders');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

function saveOrder(order) {
  const num = (parseInt(localStorage.getItem('apizza_order_counter') || '0')) + 1;
  localStorage.setItem('apizza_order_counter', String(num));
  order.id = '#' + String(num).padStart(3, '0');
  order.timestamp = new Date().toISOString();
  order.status = 'pending';

  if (_db || (typeof firebase !== 'undefined' && initFirebase())) {
    _db.collection('orders').add(order).catch(e => console.error('Firestore saveOrder:', e));
  } else {
    // Fallback localStorage
    const orders = JSON.parse(localStorage.getItem('apizza_orders') || '[]');
    orders.unshift(order);
    localStorage.setItem('apizza_orders', JSON.stringify(orders));
  }
  return order;
}

function updateOrderStatus(id, status) {
  // Actualizar cache inmediatamente para UI responsiva
  if (window._ordersCache) {
    const idx = window._ordersCache.findIndex(o => o.id === id);
    if (idx !== -1) window._ordersCache[idx].status = status;
  }

  if (_db) {
    _db.collection('orders').where('id', '==', id).get()
      .then(snap => snap.forEach(doc => doc.ref.update({ status })))
      .catch(e => console.error('Firestore updateOrderStatus:', e));
  } else {
    const orders = JSON.parse(localStorage.getItem('apizza_orders') || '[]');
    const idx = orders.findIndex(o => o.id === id);
    if (idx !== -1) {
      orders[idx].status = status;
      localStorage.setItem('apizza_orders', JSON.stringify(orders));
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────

function formatPrice(price) {
  return '$' + Number(price).toLocaleString('es-AR');
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}
