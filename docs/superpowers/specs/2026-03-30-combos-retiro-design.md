# Apizza — Combos + Retiro en Local: Diseño

**Fecha:** 2026-03-30
**Estado:** Aprobado por el usuario

---

## Resumen

Dos features nuevas para la app de pedidos de Apizza:

1. **Combos** — sección especial en el menú con items compuestos (descripción libre + precio fijo + opciones seleccionables por el cliente)
2. **Retiro en local** — alternativa al delivery en el checkout, con selector de hora y dirección del local

Ambas features se implementan sobre la arquitectura existente (HTML/CSS/JS + localStorage), sin romper el flujo actual.

---

## 1. Modelo de datos

### 1.1 Combos (`data.js`)

Nueva colección `combos[]` separada de `items[]`:

```js
{
  id: 'combo_001',
  internalName: 'Combo Familiar',          // visible solo en admin/comanda
  description: 'Pizza grande + 2 gaseosas', // visible para el cliente
  price: 28000,
  optionGroups: [                            // grupos de checkboxes
    {
      label: 'Gaseosa 1',
      options: ['Coca-Cola', 'Sprite', 'Fanta']
    },
    {
      label: 'Gaseosa 2',
      options: ['Coca-Cola', 'Sprite', 'Fanta']
    }
  ],
  available: true
}
```

Los grupos de opciones permiten múltiples selecciones (checkboxes, no radio). Las opciones seleccionadas se guardan en la comanda para analytics.

### 1.2 Config — Retiro en local (`data.js`)

Se suma a `openHours` existente:

```js
openHours: {
  from: '19:00',
  to: '23:30',
  pickupAddress: 'Av. Corrientes 1234, CABA',  // NUEVO
  closedMsg: '...'
}
```

### 1.3 Órdenes — Combo en comanda

Un combo guardado en una comanda:

```js
{
  type: 'combo',
  comboId: 'combo_001',
  internalName: 'Combo Familiar',
  description: 'Pizza grande + 2 gaseosas',
  selectedOptions: ['Coca-Cola', 'Sprite'],   // labels exactos
  price: 28000,
  quantity: 1
}
```

Esto permite analytics de opciones más pedidas por combo.

---

## 2. Flujo del cliente

### 2.1 Sección Combos en el menú

- Aparece **arriba de todas las categorías** como sección destacada con header `🔥 COMBOS`
- Cada combo muestra: descripción pública + precio + botón "Agregar"
- Al tocar "Agregar" → modal con checkboxes agrupados por `optionGroups`
- El cliente tilda las opciones que quiere dentro de cada grupo
- Al confirmar → se agrega al carrito como una línea

### 2.2 Mensaje WhatsApp — Combos

Una sola línea por combo:
```
🔥 *1x Pizza grande + 2 gaseosas* [Coca-Cola, Sprite] — $28.000
```

### 2.3 Toggle Delivery / Retiro en el checkout

Toggle arriba del formulario de checkout:
```
[ 🛵 Delivery ]  [ 🏠 Retiro en local ]
```

**Cuando se selecciona Delivery** (default): flujo actual sin cambios.

**Cuando se selecciona Retiro en local:**
- Se oculta el campo de dirección
- Aparece un selector de hora (slots de 30 min entre apertura y cierre, ej: 19:00, 19:30... 23:00)
- Aparece la dirección del local: *"Retirá en [pickupAddress]"*
- El mensaje WhatsApp cambia el encabezado a `🏠 *APIZZA · RETIRO EN LOCAL*` e incluye la hora elegida

---

## 3. Panel Admin

### 3.1 Nueva pestaña "Combos"

Ubicación: entre **Extras** y **Pedido DELI** en la barra de tabs.

**Vista lista:**
- Muestra nombre interno, descripción pública, precio, estado (disponible/no)
- Botones editar y eliminar por combo
- Botón "Nuevo combo" arriba a la derecha

**Formulario crear/editar:**
- Campo: Nombre interno
- Campo: Descripción pública
- Campo: Precio
- Grupos de opciones: el admin agrega grupos con nombre + opciones separadas por coma
  - Ej: Grupo "Gaseosa 1" → opciones "Coca-Cola, Sprite, Fanta"
  - Botón para agregar más grupos, botón para eliminar cada grupo
- Toggle: Disponible / No disponible

### 3.2 Config — campo nuevo

En la pestaña Config, se agrega el campo **"Dirección del local"** (`pickupAddress`).

### 3.3 Comandas — visualización de combos

En la tabla de comandas, los combos se muestran así:
```
1x Pizza grande + 2 gaseosas [Coca-Cola, Sprite] — $28.000
```
El nombre interno aparece solo en la vista de detalle/impresión.

### 3.4 Dashboard

Los combos aparecen en el ranking de ítems más vendidos como cualquier otro producto (usando `description` como nombre).

---

## 4. Alcance excluido (YAGNI)

- **Firebase**: planificado para el siguiente ciclo, después de implementar este
- **Combos con fecha de vencimiento**: fuera de alcance por ahora
- **Precio dinámico por opción**: las opciones no tienen precio adicional, el precio es fijo del combo
- **Combos en pedidos DELI**: se implementa igual que en WEB (mismo modal de selección)

---

## 5. Archivos afectados

| Archivo | Cambios |
|---------|---------|
| `data.js` | Nueva colección `combos[]`, funciones CRUD para combos, campo `pickupAddress` en config |
| `app.js` | Sección combos en menú, modal de combo con checkboxes, toggle delivery/retiro, mensaje WhatsApp actualizado |
| `admin.js` | Nueva pestaña Combos con lista + formulario, campo pickupAddress en Config |
| `index.html` | Modal de combo (si se necesita estructura separada del modal de ítem) |
| `style-v2.css` | Estilos para sección combos, toggle delivery/retiro, modal de opciones |
