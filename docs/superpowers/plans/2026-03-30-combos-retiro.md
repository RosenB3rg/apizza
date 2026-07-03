# Combos + Retiro en Local — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar sección de combos con opciones seleccionables al menú y modo de retiro en local al checkout.

**Architecture:** Vanilla JS/HTML/CSS sin frameworks. Datos en localStorage vía `data.js`. Tres capas: `data.js` (persistencia), `app.js` (cliente), `admin.js` (panel admin). No hay build step — editar archivos y recargar el browser.

**Tech Stack:** HTML5, CSS3, JavaScript ES6+, localStorage, Python http.server (preview local en puerto 3131)

---

## Mapa de archivos

| Archivo | Qué cambia |
|---------|-----------|
| `data.js` | Nueva colección `combos[]`, CRUD de combos, `pickupAddress` en config, `DATA_VERSION` 3→4 |
| `app.js` | Render sección combos, modal de combo con checkboxes, toggle delivery/retiro en checkout, WhatsApp message actualizado |
| `admin.js` | Nueva pestaña "Combos", lista + form CRUD, campo `pickupAddress` en Config |
| `style-v2.css` | Estilos: sección combos, cards de combo, toggle delivery/retiro, modal opciones, time picker |
| `index.html` | Sin cambios estructurales (el modal de combo reutiliza `#item-modal-overlay`) |

---

## Task 1: Data model — combos + pickupAddress

**Files:**
- Modify: `data.js`

- [ ] **Paso 1: Bumper DATA_VERSION a 4**

En `data.js`, línea 5, cambiar:
```js
const DATA_VERSION = 3;
```
por:
```js
const DATA_VERSION = 4;
```

- [ ] **Paso 2: Agregar `combos[]` y `pickupAddress` a DEFAULT_DATA**

Después del cierre del array `extras` (línea 129) y antes de `adminPassword`, agregar `combos: []`. También agregar `pickupAddress` dentro de `openHours`. El bloque final de `DEFAULT_DATA` debe quedar así:

```js
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
  openHours: {
    enabled: false,
    from: '18:00',
    to: '23:30',
    closedMsg: 'Estamos cerrados. ¡Volvemos pronto!',
    pickupAddress: ''
  }
};
```

- [ ] **Paso 3: Agregar funciones CRUD de combos**

Después de `deleteExtra()` (línea ~222) y antes de `// ── Orders`, agregar:

```js
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
```

- [ ] **Paso 4: Verificar en browser**

Abrir `http://localhost:3131` → F12 → Consola → ejecutar:
```js
getData().combos       // debe retornar []
getData().openHours.pickupAddress  // debe retornar ''
```
Si retorna `undefined` en alguno, significa que hay datos viejos en localStorage. Ejecutar `localStorage.clear()` y recargar.

---

## Task 2: CSS — Combos + Toggle delivery/retiro

**Files:**
- Modify: `style-v2.css`

- [ ] **Paso 1: Agregar estilos de la sección combos**

Al final de `style-v2.css`, antes del último `*/` o al final del archivo, agregar:

```css
/* ── COMBOS SECTION ──────────────────────────────────────────── */
.combos-section {
  padding: 1.5rem 1.25rem 0.5rem;
  max-width: 900px;
  margin: 0 auto;
}

.combos-section-title {
  font-family: 'Alfa Slab One', serif;
  font-size: 1.1rem;
  color: var(--orange);
  letter-spacing: 0.08em;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.combos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
}

.combo-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.1rem 1.2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  transition: border-color 0.2s;
}
.combo-card:hover { border-color: var(--orange); }

.combo-card-info {
  flex: 1;
}

.combo-card-desc {
  font-size: 0.9rem;
  color: var(--cream);
  font-weight: 500;
  line-height: 1.35;
  margin-bottom: 0.3rem;
}

.combo-card-price {
  font-family: 'Oswald', sans-serif;
  font-size: 1.05rem;
  color: var(--orange);
  font-weight: 600;
}

.combo-card-btn {
  background: var(--orange);
  color: #1a0a00;
  border: none;
  border-radius: 8px;
  padding: 0.55rem 1rem;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.combo-card-btn:hover { background: #e8914a; }
.combo-card-btn:disabled {
  background: var(--border);
  color: var(--gray);
  cursor: not-allowed;
}

/* ── COMBO MODAL OPTIONS ─────────────────────────────────────── */
.combo-option-group {
  margin-bottom: 1rem;
}

.combo-option-group-label {
  font-size: 0.78rem;
  color: var(--gray);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.combo-option-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0;
  cursor: pointer;
  font-size: 0.88rem;
  color: var(--cream);
}
.combo-option-item input[type="checkbox"] {
  accent-color: var(--orange);
  width: 16px;
  height: 16px;
  cursor: pointer;
}

/* ── ORDER TYPE TOGGLE ───────────────────────────────────────── */
.order-type-toggle {
  display: flex;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.order-type-btn {
  flex: 1;
  background: transparent;
  border: none;
  padding: 0.65rem 0.5rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--gray);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.order-type-btn.active {
  background: var(--red);
  color: #fff;
  font-weight: 700;
}

.pickup-info {
  background: rgba(244,162,97,0.08);
  border: 1px solid rgba(244,162,97,0.25);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  font-size: 0.84rem;
  color: var(--cream);
  line-height: 1.5;
}
.pickup-info strong { color: var(--orange); }

.pickup-time-select {
  width: 100%;
}
```

- [ ] **Paso 2: Verificar que los estilos existan**

Recargar `http://localhost:3131`, abrir DevTools → Elements, buscar la clase `.combos-section` en el inspector de estilos. Debe aparecer definida.

---

## Task 3: Sección combos en el menú + modal (app.js)

**Files:**
- Modify: `app.js`

- [ ] **Paso 1: Agregar función `renderCombosSection()`**

En `app.js`, después de la función `renderMenu()` (buscar `function renderMenu`), agregar:

```js
// ── Combos ────────────────────────────────────────────────────
function renderCombosSection() {
  const combos = getCombos().filter(c => c.available);
  const container = document.getElementById('menu-container');
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

  // Insertar antes del menú regular
  container.insertAdjacentElement('beforebegin', section);
}
```

- [ ] **Paso 2: Agregar `openComboModal()` y `addComboToCart()`**

Después de `renderCombosSection()`, agregar:

```js
let currentCombo = null;

function openComboModal(comboId) {
  if (!isStoreOpen()) {
    const data = getData();
    showCerradoModal(data.openHours?.closedMsg || 'Volvemos pronto 🍕');
    return;
  }
  const combos = getCombos();
  currentCombo = combos.find(c => c.id === comboId);
  if (!currentCombo) return;

  const groupsHtml = (currentCombo.optionGroups || []).map((g, gi) => `
    <div class="combo-option-group">
      <div class="combo-option-group-label">${g.label}</div>
      ${g.options.map((opt, oi) => `
        <label class="combo-option-item">
          <input type="checkbox" name="combo-group-${gi}" value="${opt}" id="copt-${gi}-${oi}">
          ${opt}
        </label>
      `).join('')}
    </div>
  `).join('');

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

function addComboToCart() {
  if (!currentCombo) return;

  // Recopilar opciones seleccionadas
  const selectedOptions = [];
  (currentCombo.optionGroups || []).forEach((g, gi) => {
    const checked = document.querySelectorAll(`input[name="combo-group-${gi}"]:checked`);
    checked.forEach(cb => selectedOptions.push(cb.value));
  });

  cart.push({
    cartId: Date.now() + Math.random(),
    type: 'combo',
    comboId: currentCombo.id,
    internalName: currentCombo.internalName,
    name: currentCombo.description,           // para compatibilidad con updateCartUI
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
}
```

- [ ] **Paso 3: Llamar `renderCombosSection()` desde `renderMenu()`**

Buscar la función `renderMenu()` en `app.js`. Al **final** de esa función (antes del `}`), agregar la llamada:

```js
  renderCombosSection();
```

- [ ] **Paso 4: Actualizar `updateCartUI()` para mostrar combos correctamente**

En `updateCartUI()`, buscar donde se construye el HTML de cada item del carrito. Encontrar la línea que genera los modificadores (`mods`). Agregar soporte para combo:

Buscar el bloque:
```js
const mods = [];
if (item.removedIngredients?.length) mods.push('sin ' + item.removedIngredients.join(', '));
if (item.addedExtras?.length) mods.push(item.addedExtras.map(e => e.name).join(', '));
if (item.note) mods.push('📝 ' + item.note);
```

Reemplazar con:
```js
const mods = [];
if (item.type === 'combo' && item.selectedOptions?.length) {
  mods.push(item.selectedOptions.join(', '));
} else {
  if (item.removedIngredients?.length) mods.push('sin ' + item.removedIngredients.join(', '));
  if (item.addedExtras?.length) mods.push(item.addedExtras.map(e => e.name).join(', '));
  if (item.note) mods.push('📝 ' + item.note);
}
```

- [ ] **Paso 5: Actualizar mensaje WhatsApp para combos**

En `submitOrder()`, buscar la función `itemEmoji(cat)` y la construcción de `orderLines`. Reemplazar el `map` de `orderLines`:

```js
  const orderLines = cart.map(item => {
    if (item.type === 'combo') {
      const opts = item.selectedOptions?.length ? ` [${item.selectedOptions.join(', ')}]` : '';
      const precio = `$${Number(item.price * item.quantity).toLocaleString('es-AR')}`;
      return `🔥 *${item.quantity}x ${item.name}*${opts} — ${precio}`;
    }
    const emoji  = itemEmoji(item.category);
    const extras = (item.addedExtras && item.addedExtras.length) ? '\n      ➕ ' + item.addedExtras.map(e => e.name).join(', ') : '';
    const note   = item.note ? '\n      📝 ' + item.note : '';
    const precio = `$${Number(item.price * item.quantity).toLocaleString('es-AR')}`;
    return `${emoji} *${item.quantity}x ${item.name}* — ${precio}${extras}${note}`;
  }).join('\n');
```

- [ ] **Paso 6: Verificar en browser**

1. Ir a admin → Combos (aún no existe, se hace en Task 5) — por ahora crear un combo directo via consola:
```js
addCombo({
  internalName: 'Combo Test',
  description: 'Pizza grande + 2 gaseosas',
  price: 28000,
  optionGroups: [
    { label: 'Gaseosa 1', options: ['Coca-Cola', 'Sprite', 'Fanta'] },
    { label: 'Gaseosa 2', options: ['Coca-Cola', 'Sprite', 'Fanta'] }
  ]
});
location.reload();
```
2. Verificar que aparece la sección `🔥 COMBOS` arriba del menú
3. Hacer click en "Agregar" → debe abrir el modal con checkboxes
4. Tildar opciones → "Agregar al pedido"
5. Abrir carrito → debe aparecer el combo con las opciones seleccionadas

---

## Task 4: Toggle Delivery / Retiro en local (app.js + index.html)

**Files:**
- Modify: `app.js`
- Modify: `index.html`

- [ ] **Paso 1: Agregar helper para generar slots de horario**

En `app.js`, antes de `openCheckout()`, agregar:

```js
function generateTimeSlots(from, to) {
  const slots = [];
  const [fH, fM] = from.split(':').map(Number);
  const [tH, tM] = to.split(':').map(Number);
  let cur = fH * 60 + fM;
  const end = tH * 60 + tM - 30; // último slot 30 min antes del cierre
  while (cur <= end) {
    const h = String(Math.floor(cur / 60)).padStart(2, '0');
    const m = String(cur % 60).padStart(2, '0');
    slots.push(`${h}:${h === '00' && m === '00' ? '00' : m}`);
    cur += 30;
  }
  return slots;
}
```

Corrección — el slot debe formatear bien los minutos:
```js
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
```

- [ ] **Paso 2: Agregar variable de estado y funciones de toggle**

Después de `generateTimeSlots()`, agregar:

```js
let orderType = 'delivery'; // 'delivery' | 'pickup'

function setOrderType(type) {
  orderType = type;
  document.querySelectorAll('.order-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  const data = getData();
  const deliveryFields = document.getElementById('delivery-fields');
  const pickupFields   = document.getElementById('pickup-fields');
  if (type === 'pickup') {
    deliveryFields.style.display = 'none';
    pickupFields.style.display   = 'block';
  } else {
    deliveryFields.style.display = 'block';
    pickupFields.style.display   = 'none';
  }
}
```

- [ ] **Paso 3: Actualizar `openCheckout()` para incluir el toggle**

En `openCheckout()`, buscar donde se construye el HTML del form. El form actual en `index.html` tiene los inputs directamente. Vamos a inyectar el toggle + los campos dinámicos en `openCheckout()`.

Buscar la línea donde se hace `document.getElementById('checkout-form')` y se pre-llenan los datos. Antes de pre-llenar, agregar la inicialización del toggle.

Al inicio de `openCheckout()`, después de `if (!cart.length) return;`, agregar:

```js
  orderType = 'delivery'; // reset al abrir
```

Y al final de `openCheckout()`, después de pre-llenar los datos del cliente, agregar:

```js
  // Inicializar toggle y campos de retiro
  const data = getData();
  const slots = generateTimeSlots(data.openHours?.from || '18:00', data.openHours?.to || '23:30');
  const slotsHtml = slots.map(s => `<option value="${s}">${s}hs</option>`).join('');
  const pickupAddr = data.openHours?.pickupAddress || '';

  // Inyectar toggle arriba del formulario
  const form = document.getElementById('checkout-form');
  let toggleEl = document.getElementById('order-type-toggle-wrap');
  if (!toggleEl) {
    toggleEl = document.createElement('div');
    toggleEl.id = 'order-type-toggle-wrap';
    toggleEl.innerHTML = `
      <div class="order-type-toggle">
        <button class="order-type-btn active" data-type="delivery" onclick="setOrderType('delivery')">🛵 Delivery</button>
        <button class="order-type-btn" data-type="pickup" onclick="setOrderType('pickup')">🏠 Retiro en local</button>
      </div>
      <div id="pickup-fields" style="display:none">
        ${pickupAddr ? `<div class="pickup-info">📍 Retirá en <strong>${pickupAddr}</strong></div>` : ''}
        <select class="form-input pickup-time-select" id="order-pickup-time">
          <option value="">Elegí el horario de retiro…</option>
          ${slotsHtml}
        </select>
      </div>
      <div id="delivery-fields"></div>
    `;
    form.insertBefore(toggleEl, form.firstChild);

    // Mover los campos de dirección dentro de delivery-fields
    const streetInput = document.getElementById('order-street');
    const extraInput  = document.getElementById('order-extra');
    const deliveryDiv = document.getElementById('delivery-fields');
    deliveryDiv.appendChild(streetInput);
    deliveryDiv.appendChild(extraInput);
  }
  setOrderType('delivery');
```

- [ ] **Paso 4: Actualizar `submitOrder()` para manejar retiro**

En `submitOrder()`, buscar las líneas que leen los campos del form:

```js
  const street  = document.getElementById('order-street').value.trim();
  const extra   = document.getElementById('order-extra').value.trim();
```

Y la línea:
```js
  const address = `${street}${extra ? ', ' + extra : ''}`;
```

Reemplazar todo ese bloque de lectura de address y la validación por:

```js
  const street  = document.getElementById('order-street').value.trim();
  const extra   = document.getElementById('order-extra').value.trim();
  const isPickup = orderType === 'pickup';
  const pickupTime = isPickup ? document.getElementById('order-pickup-time')?.value : '';

  if (!name || !phone || !payment) {
    alert('Por favor completá todos los campos');
    return;
  }
  if (!isPickup && !street) {
    alert('Por favor ingresá la dirección de entrega');
    return;
  }
  if (isPickup && !pickupTime) {
    alert('Por favor elegí el horario de retiro');
    return;
  }

  const data2 = getData();
  const address = isPickup
    ? `Retiro en local — ${data2.openHours?.pickupAddress || ''}`
    : `${street}${extra ? ', ' + extra : ''}`;
```

⚠️ Nota: el `if (!name || !phone || !street || !payment)` original debe eliminarse y reemplazarse por el bloque de arriba.

- [ ] **Paso 5: Actualizar el mensaje de WhatsApp para retiro**

En `submitOrder()`, buscar la construcción del `msg`. Reemplazar la primera línea del mensaje:

```js
  const tipoEntrega = isPickup ? '🏠 *APIZZA · RETIRO EN LOCAL*' : '🍕 *APIZZA · PEDIDO DELIVERY* 🛵';
  const entregaLine = isPickup
    ? `⏰ *Retiro a las:* ${pickupTime}hs\n`
    : '';

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
```

- [ ] **Paso 6: Verificar en browser**

1. Recargar, agregar algo al carrito, ir al checkout
2. Verificar que aparece el toggle `🛵 Delivery | 🏠 Retiro en local`
3. Clickear "Retiro en local" → debe desaparecer el campo de dirección, aparecer selector de hora y dirección del local
4. Volver a "Delivery" → debe volver el campo de dirección
5. Completar el form en modo Retiro → hacer el pedido → verificar que el link de WhatsApp dice `RETIRO EN LOCAL` y tiene el horario

---

## Task 5: Admin — Pestaña Combos

**Files:**
- Modify: `admin.js`

- [ ] **Paso 1: Agregar 'combos' a la lista de tabs**

En `admin.js`, buscar la función `tabLabel()`:

```js
function tabLabel(key) {
  return { dashboard: 'Dashboard', items: 'Menú', extras: 'Extras', deli: 'Pedido DELI', orders: 'Comandas', settings: 'Config' }[key];
}
```

Reemplazar con:

```js
function tabLabel(key) {
  return { dashboard: 'Dashboard', items: 'Menú', extras: 'Extras', combos: 'Combos', deli: 'Pedido DELI', orders: 'Comandas', settings: 'Config' }[key];
}
```

- [ ] **Paso 2: Agregar 'combos' al array de tabs en `renderAdminPanel()`**

Buscar donde se definen los tabs del panel admin. Debería haber un array como `['dashboard', 'items', 'extras', 'deli', 'orders', 'settings']`. Agregar `'combos'` entre `'extras'` y `'deli'`:

```js
['dashboard', 'items', 'extras', 'combos', 'deli', 'orders', 'settings']
```

- [ ] **Paso 3: Agregar case 'combos' en `renderTabContent()`**

Buscar el switch/if-else de `renderTabContent()` que despacha según `adminTab`. Agregar:

```js
if (adminTab === 'combos') el.innerHTML = renderCombosTab();
```

junto a los otros cases.

- [ ] **Paso 4: Agregar `renderCombosTab()`**

Antes de `renderDeliTab()`, agregar:

```js
// ══════════════════════════════════════════════════════════════
//  TAB: COMBOS
// ══════════════════════════════════════════════════════════════
function renderCombosTab() {
  const combos = getCombos();
  const listHtml = combos.length ? combos.map(c => `
    <div class="admin-item-row" style="flex-wrap:wrap;gap:0.4rem">
      <div style="flex:1;min-width:200px">
        <div style="font-size:0.72rem;color:var(--gray);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.15rem">Interno: ${c.internalName}</div>
        <div style="color:var(--cream);font-weight:500;margin-bottom:0.2rem">${c.description}</div>
        <div style="font-family:var(--font-h);color:var(--orange)">${formatPrice(c.price)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
        <span style="font-size:0.75rem;padding:0.2rem 0.5rem;border-radius:4px;background:${c.available ? 'rgba(76,187,122,0.15)' : 'rgba(255,255,255,0.05)'};color:${c.available ? '#4cbb7a' : 'var(--gray)'}">
          ${c.available ? '● Disponible' : '○ No disponible'}
        </span>
        <button class="btn-icon" onclick="editCombo('${c.id}')">✏️</button>
        <button class="btn-icon" onclick="deleteComboAdmin('${c.id}')" style="color:var(--red)">🗑</button>
      </div>
    </div>
  `).join('') : `<div style="color:var(--gray);padding:1rem 0;font-size:0.88rem">Sin combos creados todavía</div>`;

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem">
      <div class="admin-section-title">Combos</div>
      <button class="btn-secondary" onclick="openComboForm()">+ Nuevo combo</button>
    </div>
    <div id="combos-list">${listHtml}</div>
    <div id="combo-form-wrap" style="display:none;margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--border)">
      ${comboFormHtml()}
    </div>`;
}

function comboFormHtml(combo) {
  const c = combo || {};
  const groups = c.optionGroups || [{ label: '', options: [] }];
  const groupsHtml = groups.map((g, i) => comboGroupRowHtml(i, g.label, g.options.join(', '))).join('');
  return `
    <div class="admin-section-title" style="margin-bottom:1rem" id="combo-form-title">
      ${c.id ? 'Editar combo' : 'Nuevo combo'}
    </div>
    <input type="hidden" id="cf-id" value="${c.id || ''}">
    <div class="form-group">
      <label class="form-label">Nombre interno (solo vos lo ves)</label>
      <input class="form-input" id="cf-internal" value="${c.internalName || ''}" placeholder="Ej: Combo Familiar">
    </div>
    <div class="form-group">
      <label class="form-label">Descripción para el cliente</label>
      <input class="form-input" id="cf-desc" value="${c.description || ''}" placeholder="Ej: Pizza grande + 2 gaseosas">
    </div>
    <div class="form-group">
      <label class="form-label">Precio</label>
      <input class="form-input" type="number" id="cf-price" value="${c.price || ''}" placeholder="28000">
    </div>
    <div class="form-group">
      <label class="form-label">Grupos de opciones</label>
      <div id="cf-groups">${groupsHtml}</div>
      <button class="btn-secondary" style="margin-top:0.5rem;font-size:0.8rem" onclick="addComboGroupRow()">+ Agregar grupo</button>
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:0.6rem;font-size:0.85rem;cursor:pointer">
        <input type="checkbox" id="cf-available" ${c.available !== false ? 'checked' : ''} style="accent-color:var(--red)">
        Disponible
      </label>
    </div>
    <div style="display:flex;gap:0.75rem;margin-top:1rem">
      <button class="btn-primary" onclick="saveComboForm()">Guardar</button>
      <button class="btn-secondary" onclick="cancelComboForm()">Cancelar</button>
    </div>`;
}

function comboGroupRowHtml(idx, label, optionsStr) {
  return `
    <div class="admin-item-row" id="combo-group-${idx}" style="margin-bottom:0.5rem;align-items:flex-start">
      <div style="flex:1;display:flex;gap:0.5rem;flex-wrap:wrap">
        <input class="form-input" style="flex:1;min-width:120px" placeholder="Nombre del grupo (ej: Gaseosa 1)"
          id="cg-label-${idx}" value="${label || ''}">
        <input class="form-input" style="flex:2;min-width:180px" placeholder="Opciones separadas por coma (ej: Coca, Sprite, Fanta)"
          id="cg-options-${idx}" value="${optionsStr || ''}">
      </div>
      <button class="btn-icon" style="color:var(--red);margin-left:0.5rem" onclick="removeComboGroupRow(${idx})">✕</button>
    </div>`;
}

let comboGroupCount = 1;

function openComboForm(combo) {
  comboGroupCount = combo ? combo.optionGroups.length : 1;
  const wrap = document.getElementById('combo-form-wrap');
  wrap.innerHTML = comboFormHtml(combo);
  wrap.style.display = 'block';
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelComboForm() {
  document.getElementById('combo-form-wrap').style.display = 'none';
}

function addComboGroupRow() {
  const container = document.getElementById('cf-groups');
  container.insertAdjacentHTML('beforeend', comboGroupRowHtml(comboGroupCount, '', ''));
  comboGroupCount++;
}

function removeComboGroupRow(idx) {
  const row = document.getElementById(`combo-group-${idx}`);
  if (row) row.remove();
}

function readComboGroups() {
  const groups = [];
  document.querySelectorAll('[id^="combo-group-"]').forEach(row => {
    const idx = row.id.split('-')[2];
    const labelEl   = document.getElementById(`cg-label-${idx}`);
    const optionsEl = document.getElementById(`cg-options-${idx}`);
    if (!labelEl || !optionsEl) return;
    const label   = labelEl.value.trim();
    const options = optionsEl.value.split(',').map(s => s.trim()).filter(Boolean);
    if (label) groups.push({ label, options });
  });
  return groups;
}

function saveComboForm() {
  const id          = document.getElementById('cf-id').value;
  const internalName = document.getElementById('cf-internal').value.trim();
  const description  = document.getElementById('cf-desc').value.trim();
  const price        = Number(document.getElementById('cf-price').value);
  const available    = document.getElementById('cf-available').checked;
  const optionGroups = readComboGroups();

  if (!internalName || !description || !price) {
    alert('Completá nombre interno, descripción y precio');
    return;
  }

  if (id) {
    updateCombo(id, { internalName, description, price, available, optionGroups });
  } else {
    addCombo({ internalName, description, price, available, optionGroups });
  }

  switchTab('combos');
}

function editCombo(id) {
  const combo = getCombos().find(c => c.id === id);
  if (combo) openComboForm(combo);
}

function deleteComboAdmin(id) {
  if (!confirm('¿Eliminar este combo?')) return;
  deleteCombo(id);
  switchTab('combos');
}
```

- [ ] **Paso 5: Verificar en browser**

1. Recargar → abrir admin (5 clicks en footer)
2. Debe aparecer la pestaña "Combos" entre Extras y Pedido DELI
3. Crear un combo: nombre interno "Combo Test", descripción "Pizza grande + 2 gaseosas", precio 28000, grupo "Gaseosa 1" con opciones "Coca-Cola, Sprite, Fanta"
4. Guardar → debe aparecer en la lista
5. Editar → cambiar precio → guardar → debe reflejar el cambio
6. Volver al menú público (cerrar admin) → recargar → debe aparecer la sección 🔥 COMBOS

---

## Task 6: Admin — pickupAddress en Config

**Files:**
- Modify: `admin.js`

- [ ] **Paso 1: Agregar campo `pickupAddress` en `renderSettingsTab()`**

Buscar en `admin.js` la función `renderSettingsTab()`. Buscar el bloque donde está el campo de horarios (`openHours`). Después del campo `closedMsg`, agregar:

```js
    <div class="form-group">
      <label class="form-label">Dirección del local (para retiro)</label>
      <input class="form-input" id="s-pickup-addr"
        value="${data.openHours?.pickupAddress || ''}"
        placeholder="Ej: Av. Corrientes 1234, CABA">
    </div>
```

- [ ] **Paso 2: Leer y guardar `pickupAddress` en `saveSettings()`**

Buscar la función `saveSettings()` en `admin.js`. Buscar donde se guarda `closedMsg` dentro de `openHours`. Agregar:

```js
data.openHours.pickupAddress = document.getElementById('s-pickup-addr')?.value.trim() || '';
```

- [ ] **Paso 3: Verificar en browser**

1. Abrir admin → Config
2. Debe aparecer el campo "Dirección del local (para retiro)"
3. Escribir una dirección → Guardar
4. Recargar → debe persistir el valor
5. Abrir checkout → seleccionar "Retiro en local" → debe aparecer la dirección ingresada

---

## Task 7: Smoke test final

- [ ] **Paso 1: Test flujo completo delivery + combo**

1. Abrir `http://localhost:3131`
2. Crear combo desde admin si no existe
3. En menú: agregar un combo con opciones elegidas
4. Agregar también una pizza normal
5. Abrir carrito → verificar que aparecen ambos items
6. Ir a checkout → modo Delivery → completar datos → "Ir a WhatsApp"
7. Verificar el mensaje: debe tener `🍕 *APIZZA · PEDIDO DELIVERY* 🛵` y el combo como `🔥 *1x Pizza grande + 2 gaseosas* [Coca-Cola, Sprite]`

- [ ] **Paso 2: Test flujo retiro**

1. Ir a checkout → seleccionar "Retiro en local"
2. Verificar que desaparece el campo de dirección
3. Verificar que aparece selector de hora con slots correctos
4. Verificar que aparece la dirección del local (si está configurada)
5. Completar el form → "Ir a WhatsApp"
6. Verificar que el mensaje dice `🏠 *APIZZA · RETIRO EN LOCAL*` con el horario elegido

- [ ] **Paso 3: Test admin combos**

1. Crear, editar y eliminar un combo desde admin
2. Toggle disponible/no disponible → en el menú debe desaparecer si está en "no disponible"
3. Verificar que las opciones del combo aparecen en la comanda cuando se hace un pedido

---

## Notas de implementación

- **DATA_VERSION 3→4**: El cambio de versión borra localStorage. El usuario perderá datos de prueba pero no pedidos reales (los pedidos se guardan en `apizza_orders` separado del data principal).
- **El modal de combo reutiliza `#item-modal-overlay`**: Mismo overlay que los ítems, no hay HTML nuevo.
- **`orderType` es variable global**: Se resetea a `'delivery'` cada vez que se abre el checkout.
- **`comboGroupCount`**: Contador de grupos en el form de admin, se reinicia al abrir el form.
