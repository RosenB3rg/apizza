// ============================================================
//  APIZZA · app.js  –  Lógica cliente
// ============================================================

// ── Estado ───────────────────────────────────────────────────
let cart = [];
let currentItem = null;
let currentQty = 1;
let tempRemoved = [];
let tempExtras = [];
let activeCategory = 'all';
let adminClickCount = 0;
let adminClickTimer = null;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderCategories();
  renderMenu();
  bindEvents();
  updateCartUI();
  checkLogoSetting();
});

// ── Horarios de atención ──────────────────────────────────────
function isStoreOpen() {
  const data = getData();
  const h = data.openHours;
  if (!h || !h.enabled) return true;
  const now = new Date();
  const [fH, fM] = (h.from || '00:00').split(':').map(Number);
  const [tH, tM] = (h.to   || '23:59').split(':').map(Number);
  const cur  = now.getHours() * 60 + now.getMinutes();
  return cur >= (fH * 60 + fM) && cur <= (tH * 60 + tM);
}

// ── Último pedido (repetir) ────────────────────────────────────
function getLastOrder() {
  try { return JSON.parse(localStorage.getItem('apizza_last_order') || 'null'); }
  catch { return null; }
}
function saveLastOrder(items) {
  localStorage.setItem('apizza_last_order', JSON.stringify(items));
}
function repeatLastOrder() {
  const last = getLastOrder();
  if (!last || !last.length) return;
  cart = last.map(i => ({ ...i, cartId: Date.now() + Math.random() }));
  updateCartUI();
}

function checkLogoSetting() {
  const img = document.getElementById('logo-img');
  const txt = document.getElementById('logo-text');
  if (!img) return; // logo removido del header
  const data = getData();
  const src = data.logoUrl || '';
  img.onload  = () => { img.classList.remove('hidden'); if (txt) txt.classList.add('hidden'); };
  img.onerror = () => { img.classList.add('hidden');    if (txt) txt.classList.remove('hidden'); };
  img.src = src;
}

// ── Categorías ────────────────────────────────────────────────
function renderCategories() {
  const data = getData();
  const nav = document.getElementById('categories-nav');
  const cats = ['all', ...data.categories];
  nav.innerHTML = cats.map(cat => `
    <button class="cat-btn ${cat === activeCategory ? 'active' : ''}" data-cat="${cat}">
      ${cat === 'all' ? 'Todo' : cat}
    </button>
  `).join('');

  nav.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      renderCategories();
      renderMenu();
    });
  });
}

// ── Menú ──────────────────────────────────────────────────────
function renderMenu() {
  const data = getData();
  const container = document.getElementById('menu-container');
  const catsToRender = activeCategory === 'all' ? data.categories : [activeCategory];

  // Banner de cerrado
  let closedBanner = '';
  if (!isStoreOpen()) {
    const msg = data.openHours?.closedMsg || 'Estamos cerrados. ¡Volvemos pronto!';
    closedBanner = `<div class="closed-banner">🕒 ${msg}</div>`;
  }

  container.innerHTML = closedBanner + catsToRender.map(cat => {
    const catItems = data.items.filter(i => i.category === cat);
    if (!catItems.length) return '';
    return `
      <div class="menu-section">
        <h2 class="section-title">${cat}</h2>
        <div class="menu-grid">
          ${catItems.map(renderItemCard).join('')}
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.menu-item[data-id]').forEach(card => {
    card.addEventListener('click', () => openItemModal(card.dataset.id));
  });

  renderCombosSection();
}

// ── Combos ────────────────────────────────────────────────────
function renderCombosSection() {
  const combos = getCombos().filter(c => c.available);
  const existing = document.getElementById('combos-section');
  if (existing) existing.remove();
  if (!combos.length) return;

  const section = document.createElement('div');
  section.className = 'combos-section';
  section.id = 'combos-section';
  section.innerHTML = `
    <div class="combos-section-title">🔥 COMBOS</div>
    <div class="combos-grid">
      ${combos.map(c => `
        <div class="combo-card">
          <div class="combo-card-info">
            <div class="combo-card-desc">${c.description}</div>
            <div class="combo-card-price">${formatPrice(c.price)}</div>
          </div>
          <button class="combo-card-btn" onclick="openComboModal('${c.id}')">
            Agregar
          </button>
        </div>
      `).join('')}
    </div>`;

  const menuContainer = document.getElementById('menu-container');
  menuContainer.insertAdjacentElement('beforebegin', section);
}

let currentCombo = null;
let comboGroupQtys = {}; // { gi: { oi: qty } }

function formatComboOptions(opts) {
  if (!opts || !opts.length) return '';
  const counts = {};
  opts.forEach(o => { counts[o] = (counts[o] || 0) + 1; });
  return Object.entries(counts).map(([name, qty]) => qty > 1 ? `${name} x${qty}` : name).join(', ');
}

function openComboModal(comboId) {
  if (!isStoreOpen()) {
    const data = getData();
    showCerradoModal(data.openHours?.closedMsg || 'Volvemos pronto 🍕');
    return;
  }
  const combos = getCombos();
  currentCombo = combos.find(c => c.id === comboId);
  if (!currentCombo) return;

  comboGroupQtys = {};

  const groupsHtml = (currentCombo.optionGroups || []).map((g, gi) => {
    const groupQty = g.qty || 2;
    comboGroupQtys[gi] = {};
    g.options.forEach((_, oi) => { comboGroupQtys[gi][oi] = 0; });
    return `
    <div class="combo-option-group">
      <div class="combo-option-group-label">${g.label} <span style="opacity:0.55;font-weight:400">(elegí ${groupQty})</span></div>
      ${g.options.map((opt, oi) => `
        <div class="combo-option-item" id="cgroup-${gi}-row-${oi}" style="justify-content:space-between">
          <span>${opt}</span>
          <div style="display:flex;align-items:center;gap:0.5rem">
            <button type="button" class="modal-qty-btn" onclick="changeComboQty(${gi},${oi},-1)" id="cminus-${gi}-${oi}" disabled>−</button>
            <span class="modal-qty-value" id="cqty-${gi}-${oi}">0</span>
            <button type="button" class="modal-qty-btn" onclick="changeComboQty(${gi},${oi},1)" id="cplus-${gi}-${oi}">+</button>
          </div>
        </div>
      `).join('')}
    </div>`;
  }).join('');

  const modal = document.getElementById('item-modal');
  modal.innerHTML = `
    <div class="modal-header">
      <div>
        <div class="modal-title">${currentCombo.description}</div>
        <div class="modal-price">${formatPrice(currentCombo.price)}</div>
      </div>
      <button class="close-btn" onclick="closeItemModal()">✕</button>
    </div>
    ${groupsHtml ? `<div style="margin:1rem 0">${groupsHtml}</div>` : ''}
    <button class="btn-primary" style="width:100%;margin-top:0.5rem" onclick="addComboToCart()">
      Agregar al pedido — ${formatPrice(currentCombo.price)}
    </button>`;

  document.getElementById('item-modal-overlay').classList.add('active');
}

function changeComboQty(gi, oi, delta) {
  const groupQty = currentCombo.optionGroups[gi].qty || 2;
  const current = comboGroupQtys[gi][oi] || 0;
  const groupTotal = Object.values(comboGroupQtys[gi]).reduce((s, v) => s + v, 0);

  if (delta < 0 && current === 0) return;
  if (delta > 0 && groupTotal >= groupQty) return;

  comboGroupQtys[gi][oi] = current + delta;
  document.getElementById(`cqty-${gi}-${oi}`).textContent = comboGroupQtys[gi][oi];

  // update button states
  const newTotal = Object.values(comboGroupQtys[gi]).reduce((s, v) => s + v, 0);
  currentCombo.optionGroups[gi].options.forEach((_, oIdx) => {
    const minusBtn = document.getElementById(`cminus-${gi}-${oIdx}`);
    const plusBtn  = document.getElementById(`cplus-${gi}-${oIdx}`);
    if (minusBtn) minusBtn.disabled = (comboGroupQtys[gi][oIdx] || 0) === 0;
    if (plusBtn)  plusBtn.disabled  = newTotal >= groupQty;
  });
}

function addComboToCart() {
  if (!currentCombo) return;

  const selectedOptions = [];
  (currentCombo.optionGroups || []).forEach((g, gi) => {
    g.options.forEach((opt, oi) => {
      const qty = comboGroupQtys[gi]?.[oi] || 0;
      for (let i = 0; i < qty; i++) selectedOptions.push(opt);
    });
  });

  cart.push({
    cartId: Date.now() + Math.random(),
    type: 'combo',
    comboId: currentCombo.id,
    internalName: currentCombo.internalName,
    name: currentCombo.description,
    category: 'combo',
    basePrice: currentCombo.price,
    price: currentCombo.price,
    quantity: 1,
    selectedOptions,
    addedExtras: [],
    note: ''
  });

  closeItemModal();
  updateCartUI();
  openCart();
}

function renderItemCard(item) {
  const unavailable = !item.available || item.stock === 0;
  let stockBadge = '';
  if (unavailable) {
    stockBadge = `<span class="item-stock-badge sold-out">AGOTADO</span>`;
  } else if (item.stock !== null && item.stock <= 5 && item.stock > 0) {
    stockBadge = `<span class="item-stock-badge">Últimas ${item.stock}</span>`;
  }

  const imgHtml = item.image
    ? `<div class="item-img-wrap">
         <img class="item-img" src="${item.image}" alt="${item.name}" loading="lazy">
         ${unavailable ? '<div class="item-img-overlay"></div>' : ''}
       </div>`
    : `<div class="item-img-wrap item-img-placeholder">
         <span>coming soon</span>
       </div>`;

  return `
    <div class="menu-item ${unavailable ? 'unavailable' : ''}" data-id="${item.id}">
      ${imgHtml}
      <div class="item-body">
        <div class="item-name">${item.name}</div>
        <div class="item-description">${item.description}</div>
        <div class="item-footer">
          <div>
            <span class="item-price">${formatPrice(item.price)}</span>
            ${stockBadge}
          </div>
          ${unavailable
            ? `<span class="sold-out-pill">AGOTADO</span>`
            : `<button class="add-btn" onclick="event.stopPropagation(); openItemModal('${item.id}')">+</button>`}
        </div>
      </div>
    </div>`;
}

// ── Modal de item ─────────────────────────────────────────────
function openItemModal(itemId) {
  const data = getData();
  currentItem = data.items.find(i => i.id === itemId);
  if (!currentItem || !currentItem.available || currentItem.stock === 0) return;

  if (!isStoreOpen()) {
    const msg = data.openHours?.closedMsg || 'Volvemos pronto 🍕';
    showCerradoModal(msg);
    return;
  }

  currentQty = 1;
  tempExtras = [];

  const isBeverage = currentItem.category.toLowerCase().includes('bebida');
  const hasExtras = !isBeverage && data.extras && data.extras.length > 0;
  const hasVariants = currentItem.variants && currentItem.variants.length > 0;

  const variantsHtml = hasVariants ? `
    <div class="ing-section">
      <span class="ing-label">Elegí tu opción</span>
      <div class="variant-pills">
        ${currentItem.variants.map((v, i) => `
          <label class="variant-pill">
            <input type="radio" name="item-variant" value="${v}" ${i === 0 ? 'checked' : ''}>
            <span>${v}</span>
          </label>`).join('')}
      </div>
    </div>` : '';

  document.getElementById('item-modal').innerHTML = `
    <div class="modal-header">
      <div>
        <div class="modal-title">${currentItem.name}</div>
        <div class="modal-desc">${currentItem.description}</div>
      </div>
      <button class="close-btn" onclick="closeItemModal()">✕</button>
    </div>

    ${variantsHtml}

    ${hasExtras ? `
      <div class="ing-section">
        <span class="ing-label">Agregar extras</span>
        ${data.extras.map(ext => `
          <label class="ing-row">
            <input type="checkbox"
              data-ext-id="${ext.id}"
              data-ext-name="${encodeURIComponent(ext.name)}"
              data-ext-price="${ext.price}"
              onchange="toggleExtra(this)">
            <label style="flex:1">${ext.name}</label>
            <span class="ing-price">${ext.price === 0 ? 'GRATIS' : '+ ' + formatPrice(ext.price)}</span>
          </label>`).join('')}
      </div>` : ''}

    ${isBeverage ? '' : `
    <div class="form-group" style="margin-bottom:1rem">
      <label class="ing-label">Notas especiales (opcional)</label>
      <input type="text" class="form-input" id="item-note"
        placeholder="Ej: bien cocida, sin sal…" style="font-size:0.85rem">
    </div>`}

    <div class="modal-qty">
      <span class="modal-qty-label">Cantidad</span>
      <div class="modal-qty-controls">
        <button class="modal-qty-btn" onclick="changeModalQty(-1)">−</button>
        <span class="modal-qty-value" id="modal-qty-val">1</span>
        <button class="modal-qty-btn" onclick="changeModalQty(1)">+</button>
      </div>
    </div>

    <button class="btn-primary" onclick="addToCart()">
      Agregar — <span id="modal-total">${formatPrice(currentItem.price)}</span>
    </button>`;

  document.getElementById('item-modal-overlay').classList.add('active');
}

function closeItemModal() {
  document.getElementById('item-modal-overlay').classList.remove('active');
  currentItem = null;
}

function toggleExtra(checkbox) {
  const ext = {
    id: checkbox.dataset.extId,
    name: decodeURIComponent(checkbox.dataset.extName),
    price: parseInt(checkbox.dataset.extPrice)
  };
  if (checkbox.checked) {
    tempExtras.push(ext);
  } else {
    tempExtras = tempExtras.filter(e => e.id !== ext.id);
  }
  updateModalTotal();
}

function changeModalQty(delta) {
  currentQty = Math.max(1, currentQty + delta);
  document.getElementById('modal-qty-val').textContent = currentQty;
  updateModalTotal();
}

function updateModalTotal() {
  const extrasSum = tempExtras.reduce((s, e) => s + e.price, 0);
  const el = document.getElementById('modal-total');
  if (el) el.textContent = formatPrice((currentItem.price + extrasSum) * currentQty);
}

// ── Carrito ───────────────────────────────────────────────────
function addToCart() {
  if (!currentItem) return;
  const extrasSum = tempExtras.reduce((s, e) => s + e.price, 0);
  const note = document.getElementById('item-note')?.value.trim() || '';
  const variant = document.querySelector('input[name="item-variant"]:checked')?.value || '';
  const displayName = variant ? `${currentItem.name} — ${variant}` : currentItem.name;
  cart.push({
    cartId: Date.now() + Math.random(),
    id: currentItem.id,
    name: displayName,
    category: currentItem.category,
    basePrice: currentItem.price,
    price: currentItem.price + extrasSum,
    quantity: currentQty,
    removedIngredients: [...tempRemoved],
    addedExtras: [...tempExtras],
    note
  });
  closeItemModal();
  updateCartUI();
  openCart();
}

function openCart() {
  document.getElementById('cart-drawer').classList.add('open');
  document.getElementById('cart-overlay').classList.add('active');
  initCartForm();
}

function initCartForm() {
  const data = getData();
  const slots = generateTimeSlots(data.openHours?.from || '18:00', data.openHours?.to || '23:30');
  const select = document.getElementById('order-pickup-time');
  if (select) {
    const current = select.value;
    select.innerHTML = '<option value="">Elegí el horario…</option>' +
      slots.map(s => `<option value="${s}"${s === current ? ' selected' : ''}>${s}hs</option>`).join('');
  }
  const addrEl = document.getElementById('cart-pickup-addr-info');
  if (addrEl) {
    const addr = data.openHours?.pickupAddress || '';
    addrEl.style.display = addr ? 'block' : 'none';
    addrEl.innerHTML = addr ? `📍 Retirá en <strong>${addr}</strong>` : '';
  }
  const saved = getSavedCustomer();
  const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  set('order-name', saved.name);
  set('order-phone', saved.phone);
  set('order-street', saved.street);
  set('order-extra', saved.extra);
  set('order-payment', saved.payment);
  if (saved.name || saved.phone) {
    const saveEl = document.getElementById('order-save');
    if (saveEl) saveEl.checked = true;
  }
  initMapsAutocomplete();
}

function setCartOrderType(type) {
  orderType = type;
  document.querySelectorAll('.cart-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  const titleEl = document.getElementById('cart-header-title');
  if (titleEl) titleEl.textContent = type === 'pickup' ? 'Pedido para retirar' : 'Pedido para delivery';
  const deliveryEl = document.getElementById('cart-delivery-fields');
  const pickupEl   = document.getElementById('cart-pickup-fields');
  if (deliveryEl) deliveryEl.style.display = type === 'delivery' ? 'block' : 'none';
  if (pickupEl)   pickupEl.style.display   = type === 'pickup'   ? 'block' : 'none';
}

function closeCart() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('cart-overlay').classList.remove('active');
}

function changeCartQty(cartId, delta) {
  const idx = cart.findIndex(i => String(i.cartId) === String(cartId));
  if (idx === -1) return;
  cart[idx].quantity = Math.max(1, cart[idx].quantity + delta);
  updateCartUI();
}

function removeFromCart(cartId) {
  cart = cart.filter(i => String(i.cartId) !== String(cartId));
  updateCartUI();
}

function updateCartUI() {
  const cartForm = document.getElementById('cart-form');
  const checkoutBtn = document.getElementById('checkout-btn');
  if (cartForm) cartForm.style.display = cart.length ? 'block' : 'none';
  if (checkoutBtn) checkoutBtn.style.display = cart.length ? 'block' : 'none';

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const countEl = document.getElementById('cart-count');
  countEl.textContent = totalItems;
  countEl.classList.toggle('hidden', totalItems === 0);

  document.getElementById('cart-total-amount').textContent = formatPrice(totalPrice);

  const cartItemsEl = document.getElementById('cart-items');
  if (!cart.length) {
    const lastOrder = getLastOrder();
    cartItemsEl.innerHTML = '<div class="cart-empty">Tu carrito está vacío</div>' +
      (lastOrder && lastOrder.length
        ? `<button class="btn-secondary" style="margin-top:1rem;width:100%;font-size:0.82rem" onclick="repeatLastOrder()">🔄 Repetir último pedido</button>`
        : '');
    return;
  }

  cartItemsEl.innerHTML = cart.map(item => {
    const mods = [];
    if (item.type === 'combo' && item.selectedOptions?.length) {
      mods.push(formatComboOptions(item.selectedOptions));
    } else {
      if (item.removedIngredients?.length) mods.push('sin ' + item.removedIngredients.join(', '));
      if (item.addedExtras?.length) mods.push(item.addedExtras.map(e => e.name).join(', '));
      if (item.note) mods.push('📝 ' + item.note);
    }
    return `
      <div class="cart-item">
        <div class="cart-item-top">
          <span class="cart-item-name">${item.name}</span>
          <span class="cart-item-price">${formatPrice(item.price * item.quantity)}</span>
        </div>
        ${mods.length ? `<div class="cart-item-mods">${mods.join(' · ')}</div>` : ''}
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="changeCartQty('${item.cartId}', -1)">−</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn" onclick="changeCartQty('${item.cartId}', 1)">+</button>
          <button class="remove-item-btn" onclick="removeFromCart('${item.cartId}')">Eliminar</button>
        </div>
      </div>`;
  }).join('');
}

// ── Checkout ──────────────────────────────────────────────────
const PAYMENT_OPTIONS = [
  { value: 'Efectivo',      label: '💵 Efectivo' },
  { value: 'Transferencia', label: '🏦 Transferencia' },
  { value: 'Mercado Pago',  label: '📱 Mercado Pago' },
];

// ── Retiro en local ───────────────────────────────────────────
function generateTimeSlots(from, to) {
  const slots = [];
  const [fH, fM] = from.split(':').map(Number);
  const [tH, tM] = to.split(':').map(Number);
  let cur = fH * 60 + fM;
  const end = tH * 60 + tM - 30;
  while (cur <= end) {
    const h = String(Math.floor(cur / 60)).padStart(2, '0');
    const m = String(cur % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
    cur += 30;
  }
  return slots;
}

let orderType = 'delivery'; // 'delivery' | 'pickup'

function setOrderType(type) {
  orderType = type;
  document.querySelectorAll('.order-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  const deliveryFields = document.getElementById('delivery-fields');
  const pickupFields   = document.getElementById('pickup-fields');
  if (!deliveryFields || !pickupFields) return;
  if (type === 'pickup') {
    deliveryFields.style.display = 'none';
    pickupFields.style.display   = 'block';
  } else {
    deliveryFields.style.display = 'block';
    pickupFields.style.display   = 'none';
  }
}

function openCheckout() {
  if (!cart.length) return;
  orderType = 'delivery';
  const totalPrice = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  // Resumen de items
  const lines = cart.map(item => {
    const extras = item.addedExtras.length ? ' + ' + item.addedExtras.map(e => e.name).join(', ') : '';
    return `${item.quantity}x ${item.name}${extras} — ${formatPrice(item.price * item.quantity)}`;
  });
  document.getElementById('checkout-summary').innerHTML =
    lines.join('<br>') +
    `<br><strong style="color:var(--cream);margin-top:0.4rem;display:block">Total: ${formatPrice(totalPrice)}</strong>`;

  // Pre-fill datos guardados
  const saved = getSavedCustomer();
  if (saved.name)    document.getElementById('order-name').value    = saved.name;
  if (saved.phone)   document.getElementById('order-phone').value   = saved.phone;
  if (saved.street)  document.getElementById('order-street').value  = saved.street;
  if (saved.extra)   document.getElementById('order-extra').value   = saved.extra;
  if (saved.payment) document.getElementById('order-payment').value = saved.payment;
  if (saved.name || saved.phone) {
    document.getElementById('order-save').checked = true;
  }

  closeCart();
  document.getElementById('checkout-modal-overlay').classList.add('active');

  // Google Maps autocomplete (si hay API key configurada)
  initMapsAutocomplete();

  // Toggle delivery/retiro
  const data = getData();
  const slots = generateTimeSlots(data.openHours?.from || '18:00', data.openHours?.to || '23:30');
  const slotsHtml = slots.map(s => `<option value="${s}">${s}hs</option>`).join('');
  const pickupAddr = data.openHours?.pickupAddress || '';

  let toggleEl = document.getElementById('order-type-toggle-wrap');
  if (!toggleEl) {
    toggleEl = document.createElement('div');
    toggleEl.id = 'order-type-toggle-wrap';
    const form = document.getElementById('checkout-form');
    const streetInput = document.getElementById('order-street');
    const extraInput  = document.getElementById('order-extra');

    toggleEl.innerHTML = `
      <div class="order-type-toggle">
        <button type="button" class="order-type-btn active" data-type="delivery" onclick="setOrderType('delivery')">🛵 Delivery</button>
        <button type="button" class="order-type-btn" data-type="pickup" onclick="setOrderType('pickup')">🏠 Retiro en local</button>
      </div>
      <div id="pickup-fields" style="display:none">
        ${pickupAddr ? `<div class="pickup-info">📍 Retirá en <strong>${pickupAddr}</strong></div>` : ''}
        <select class="form-input pickup-time-select" id="order-pickup-time">
          <option value="">Elegí el horario de retiro…</option>
          ${slotsHtml}
        </select>
      </div>
      <div id="delivery-fields"></div>`;

    form.insertBefore(toggleEl, form.firstChild);

    const deliveryDiv = document.getElementById('delivery-fields');
    deliveryDiv.appendChild(streetInput);
    deliveryDiv.appendChild(extraInput);
  }
  setOrderType('delivery');
}

function closeCheckout() {
  document.getElementById('checkout-modal-overlay').classList.remove('active');
}

// ── Google Maps Autocomplete ──────────────────────────────────
let mapsLoaded = false;
function initMapsAutocomplete() {
  const data = getData();
  if (!data.googleMapsApiKey) return;
  if (mapsLoaded) {
    attachAutocomplete();
    return;
  }
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${data.googleMapsApiKey}&libraries=places&callback=onMapsLoaded`;
  script.async = true;
  document.head.appendChild(script);
}

window.onMapsLoaded = function() {
  mapsLoaded = true;
  attachAutocomplete();
};

function attachAutocomplete() {
  const input = document.getElementById('order-street');
  if (!input || typeof google === 'undefined') return;
  const ac = new google.maps.places.Autocomplete(input, {
    componentRestrictions: { country: 'ar' },
    fields: ['name', 'formatted_address'],
    types: ['geocode']
  });
  ac.addListener('place_changed', () => {
    const p = ac.getPlace();
    // Usar solo el nombre de la calle, sin número ni ciudad
    const street = p.name || (p.formatted_address || '').split(',')[0];
    input.value = street;
    document.getElementById('order-number')?.focus();
  });
}

// ── Datos del cliente (localStorage) ─────────────────────────
function getSavedCustomer() {
  try { return JSON.parse(localStorage.getItem('apizza_customer') || '{}'); }
  catch { return {}; }
}

function saveCustomerData(name, phone, street, extra, payment) {
  localStorage.setItem('apizza_customer', JSON.stringify({ name, phone, street, extra, payment }));
}

// ── Envío a Google Sheets ─────────────────────────────────────
function sendToSheets(orderData) {
  const data = getData();
  if (!data.sheetsWebhookUrl) return;
  fetch(data.sheetsWebhookUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  }).catch(() => {}); // silencioso si falla
}

// ── Submit pedido ─────────────────────────────────────────────
function submitOrder() {
  const name    = document.getElementById('order-name').value.trim();
  const phone   = document.getElementById('order-phone').value.trim();
  const street  = document.getElementById('order-street').value.trim();
  const extra   = document.getElementById('order-extra').value.trim();
  const isPickup = orderType === 'pickup';
  const pickupTime = isPickup ? (document.getElementById('order-pickup-time')?.value || '') : '';
  const payment = document.getElementById('order-payment').value;
  const wantsToSave = document.getElementById('order-save').checked;

  if (!name || !phone || !payment) {
    uiToast('Por favor completá todos los campos', 'error');
    return;
  }
  if (!isPickup && !street) {
    uiToast('Por favor ingresá la dirección de entrega', 'error');
    return;
  }
  if (isPickup && !pickupTime) {
    uiToast('Por favor elegí el horario de retiro', 'error');
    return;
  }

  const dataConfig = getData();
  const address = isPickup
    ? `Retiro en local — ${dataConfig.openHours?.pickupAddress || ''}`
    : `${street}${extra ? ', ' + extra : ''}`;
  if (wantsToSave) saveCustomerData(name, phone, street, extra, payment);

  const data = getData();
  const totalPrice = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const paymentEmoji = PAYMENT_OPTIONS.find(p => p.value === payment)?.label || payment;

  // Emoji por categoría
  function itemEmoji(cat) {
    if (!cat) return '🍕';
    const c = cat.toLowerCase();
    if (c.includes('bebida')) return '🥤';
    if (c.includes('postre') || c.includes('dulce')) return '🍰';
    return '🍕';
  }

  // Líneas del pedido para WhatsApp
  const orderLines = cart.map(item => {
    if (item.type === 'combo') {
      const opts = item.selectedOptions?.length ? ` [${formatComboOptions(item.selectedOptions)}]` : '';
      const precio = `$${Number(item.price * item.quantity).toLocaleString('es-AR')}`;
      return `🔥 *${item.quantity}x ${item.name}*${opts} — ${precio}`;
    }
    const emoji  = itemEmoji(item.category);
    const extras = (item.addedExtras && item.addedExtras.length) ? '\n      ➕ ' + item.addedExtras.map(e => e.name).join(', ') : '';
    const note   = item.note ? '\n      📝 ' + item.note : '';
    const precio = `$${Number(item.price * item.quantity).toLocaleString('es-AR')}`;
    return `${emoji} *${item.quantity}x ${item.name}* — ${precio}${extras}${note}`;
  }).join('\n');

  const tipoEntrega = isPickup ? '🏠 *APIZZA · RETIRO EN LOCAL*' : '🍕 *APIZZA · PEDIDO DELIVERY* 🛵';
  const entregaLine = isPickup ? `⏰ *Retiro a las:* ${pickupTime}hs\n` : '';

  const msg =
    `${tipoEntrega}\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `👤 *${name}*\n\n` +
    `*PEDIDO:*\n${orderLines}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `💰 *TOTAL: $${Number(totalPrice).toLocaleString('es-AR')}*\n` +
    `${paymentEmoji}\n\n` +
    `${entregaLine}` +
    `📍 *Dirección:* ${address}\n` +
    `📞 *Tel:* ${phone}`;

  const waUrl = `https://wa.me/${data.whatsappNumber}?text=${encodeURIComponent(msg)}`;

  // Enviar a Sheets (async, no bloquea)
  sendToSheets({
    timestamp: new Date().toISOString(),
    nombre: name, telefono: phone, direccion: address, pago: payment,
    items: cart.map(i => ({
      producto: i.name,
      extras: i.addedExtras.map(e => e.name).join(', '),
      cantidad: i.quantity,
      precio: i.price * i.quantity
    })),
    total: totalPrice
  });

  // Guardar en comandas
  saveOrder({
    type: 'WEB',
    items: cart.map(i => ({ ...i })),
    total: totalPrice,
    customer: { name, phone, address, payment }
  });

  saveLastOrder(cart.map(i => ({ ...i })));
  cart = [];
  updateCartUI();
  closeCart();
  showThankYou(waUrl);
}

// ── Thank You modal ───────────────────────────────────────────
function showThankYou(waUrl) {
  const overlay = document.getElementById('thankyou-overlay');
  overlay.classList.add('active');

  // Recrear el modal para resetear la animación
  const modal = document.getElementById('thankyou-modal');
  modal.style.animation = 'none';
  modal.offsetHeight; // reflow
  modal.style.animation = '';

  document.getElementById('ty-wa-btn').onclick = () => {
    overlay.classList.remove('active');
    window.open(waUrl, '_blank');
  };

  // Auto-redirige a los 4s si no toca el botón
  setTimeout(() => {
    if (overlay.classList.contains('active')) {
      overlay.classList.remove('active');
      window.open(waUrl, '_blank');
    }
  }, 4000);
}

// ── Cerrado modal ─────────────────────────────────────────────
function showCerradoModal(msg) {
  const overlay = document.getElementById('cerrado-overlay');
  document.getElementById('cerrado-msg').textContent = msg;
  const modal = document.getElementById('cerrado-modal');
  modal.style.animation = 'none';
  modal.offsetHeight; // reflow
  modal.style.animation = '';
  overlay.classList.add('active');
}
function closeCerradoModal() {
  document.getElementById('cerrado-overlay').classList.remove('active');
}

// ── Eventos globales ──────────────────────────────────────────
function bindEvents() {
  document.getElementById('cart-btn').addEventListener('click', openCart);
  document.getElementById('cart-overlay').addEventListener('click', closeCart);
  document.getElementById('close-cart').addEventListener('click', closeCart);

  document.getElementById('item-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('item-modal-overlay')) closeItemModal();
  });
  const cerradoEl = document.getElementById('cerrado-overlay');
  if (cerradoEl) cerradoEl.addEventListener('click', e => {
    if (e.target === cerradoEl) closeCerradoModal();
  });
  document.getElementById('admin-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('admin-overlay') ||
        e.target.classList.contains('admin-overlay-inner')) closeAdminPanel();
  });

  // Admin trigger: 5 clicks rápidos en el footer
  document.getElementById('admin-trigger').addEventListener('click', () => {
    adminClickCount++;
    if (adminClickTimer) clearTimeout(adminClickTimer);
    adminClickTimer = setTimeout(() => { adminClickCount = 0; }, 1500);
    if (adminClickCount >= 5) {
      adminClickCount = 0;
      promptAdminLogin();
    }
  });

  // También por URL: ?admin=1
  if (new URLSearchParams(window.location.search).get('admin') === '1') {
    promptAdminLogin();
  }
}

// ── Admin access ──────────────────────────────────────────────
let isAdminLoggedIn = false;

async function promptAdminLogin() {
  if (isAdminLoggedIn) { openAdminPanel(); return; }
  const pwd = await uiPrompt('Ingresá la contraseña para acceder al panel', {
    title: 'Acceso admin',
    type: 'password',
    okText: 'Entrar'
  });
  if (!pwd) return;
  const data = getData();
  if (pwd === data.adminPassword) {
    isAdminLoggedIn = true;
    openAdminPanel();
  } else {
    uiToast('Contraseña incorrecta', 'error');
  }
}

function openAdminPanel() {
  document.getElementById('admin-overlay').classList.add('active');
  renderAdminPanel();
  if (typeof startAdminSoundWatch === 'function') startAdminSoundWatch();
}

function closeAdminPanel() {
  document.getElementById('admin-overlay').classList.remove('active');
  if (typeof stopAdminSoundWatch === 'function') stopAdminSoundWatch();
}
