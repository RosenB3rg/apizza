// ============================================================
//  APIZZA · admin.js  –  Panel de administración
// ============================================================

let adminTab    = 'dashboard';
let editingItemId  = null;
let editingExtraId = null;
let deliCart    = [];

// ── Notificación sonora + listener Firebase ────────────────────
let soundPollInterval    = null;
let lastKnownOrderCount  = null;
let _ordersUnsubscribe   = null;

function startAdminSoundWatch() {
  // Intentar Firebase primero
  if (typeof firebase !== 'undefined' && initFirebase()) {
    setupFirebaseOrdersListener();
    return;
  }
  // Fallback: polling localStorage cada 5s
  lastKnownOrderCount = getOrders().length;
  soundPollInterval = setInterval(() => {
    const current = getOrders().length;
    if (lastKnownOrderCount !== null && current > lastKnownOrderCount) {
      playNewOrderSound();
      if (adminTab === 'orders') renderTabContent();
    }
    lastKnownOrderCount = current;
  }, 5000);
}

function stopAdminSoundWatch() {
  if (soundPollInterval)  { clearInterval(soundPollInterval); soundPollInterval = null; }
  if (_ordersUnsubscribe) { _ordersUnsubscribe(); _ordersUnsubscribe = null; }
}

function setupFirebaseOrdersListener() {
  if (_ordersUnsubscribe) _ordersUnsubscribe();
  const prevCount = (window._ordersCache || []).length;

  _ordersUnsubscribe = _db.collection('orders')
    .orderBy('timestamp', 'desc')
    .onSnapshot(snapshot => {
      window._ordersCache = snapshot.docs.map(doc => ({ ...doc.data(), _docId: doc.id }));
      const newCount = window._ordersCache.length;

      if (prevCount > 0 && newCount > prevCount) {
        playNewOrderSound();
      }

      const adminOpen = document.getElementById('admin-overlay')?.classList.contains('active');
      if (adminOpen && (adminTab === 'orders' || adminTab === 'dashboard')) {
        renderTabContent();
      }
    }, err => console.error('Firestore listener:', err));
}

function playNewOrderSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[880,0],[1100,0.18],[880,0.36]].forEach(([freq, when]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      gain.gain.setValueAtTime(0.28, ctx.currentTime + when);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + 0.18);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + 0.2);
    });
  } catch(e) {}
}

// ── Dashboard state ────────────────────────────────────────────
let dashView   = 'overview'; // 'overview' | 'day' | 'month'
let dashDayStr = null;       // 'YYYY-MM-DD'
let dashMonth  = null;       // { year, month } lazy-init

// ── Panel principal ───────────────────────────────────────────
function renderAdminPanel() {
  document.getElementById('admin-panel').innerHTML = `
    <div class="admin-head">
      <span class="admin-head-title">Admin · Apizza</span>
      <button class="close-btn" onclick="closeAdminPanel()">✕</button>
    </div>
    <div class="admin-tabs" id="admin-tabs">
      ${[
        ['dashboard','Dashboard'],
        ['items',    'Menú'],
        ['extras',   'Extras'],
        ['combos',   'Combos'],
        ['deli',     'Pedido DELI'],
        ['orders',   'Comandas'],
        ['settings', 'Config'],
      ].map(([key, label]) =>
        `<button class="admin-tab ${adminTab === key ? 'active' : ''}"
          onclick="switchTab('${key}')">${label}</button>`
      ).join('')}
    </div>
    <div class="admin-content" id="admin-content"></div>`;

  renderTabContent();
}

function switchTab(tab) {
  adminTab = tab;
  if (tab !== 'dashboard') dashView = 'overview'; // reset drill-down al salir
  const panel = document.getElementById('admin-panel');
  if (panel) panel.style.maxWidth = tab === 'dashboard' ? '1100px' : '';
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === tabLabel(tab));
  });
  renderTabContent();
}

function tabLabel(key) {
  return { dashboard: 'Dashboard', items: 'Menú', extras: 'Extras', combos: 'Combos', deli: 'Pedido DELI', orders: 'Comandas', settings: 'Config' }[key];
}

function renderTabContent() {
  const el = document.getElementById('admin-content');
  if (!el) return;
  switch (adminTab) {
    case 'dashboard': el.innerHTML = renderDashboardTab();                        break;
    case 'items':     el.innerHTML = renderItemsTab();    bindItemsEvents();      break;
    case 'extras':    el.innerHTML = renderExtrasTab();   bindExtrasEvents();     break;
    case 'combos':    el.innerHTML = renderCombosTab();                           break;
    case 'deli':      el.innerHTML = renderDeliTab();     bindDeliEvents();       break;
    case 'orders':    el.innerHTML = renderOrdersTab();                           break;
    case 'settings':  el.innerHTML = renderSettingsTab(); bindSettingsEvents();   break;
  }
}

// ══════════════════════════════════════════════════════════════
//  TAB: DASHBOARD
// ══════════════════════════════════════════════════════════════

// ── Helpers compartidos ────────────────────────────────────────
function toDateStr(d) {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function sumOrders(arr) { return arr.reduce((s, o) => s + (o.total || 0), 0); }

function buildItemRank(orders) {
  const map = {};
  orders.forEach(o => (o.items || []).forEach(i => {
    const qty = i.qty ?? i.quantity ?? 1;
    if (!map[i.name]) map[i.name] = { qty: 0, total: 0 };
    map[i.name].qty   += qty;
    map[i.name].total += (i.price || 0) * qty;
  }));
  return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
}

function buildPayMap(orders) {
  const map = {};
  orders.forEach(o => {
    const p = o.payment || o.customer?.payment || 'Sin dato';
    if (!map[p]) map[p] = { count: 0, total: 0 };
    map[p].count++;
    map[p].total += o.total || 0;
  });
  return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
}

const PAY_COLORS = { Efectivo: '#4cbb7a', Transferencia: '#64b4ff', 'Mercado Pago': '#f4a261', 'Sin dato': '#555' };

function itemRankHTML(rank, total) {
  if (!rank.length) return '<div style="color:var(--gray);font-size:0.82rem;margin-top:0.75rem">Sin datos aún</div>';
  return `<div style="margin-top:0.85rem;display:flex;flex-direction:column;gap:0.6rem">
    ${rank.map(([name, v], idx) => {
      const pct = Math.round(v.total / (total || 1) * 100);
      const medal = ['🥇','🥈','🥉'][idx] || '';
      return `<div>
        <div style="display:flex;justify-content:space-between;margin-bottom:0.22rem">
          <span style="font-size:0.83rem;color:var(--cream)">${medal} ${name}</span>
          <span style="font-size:0.75rem;color:var(--gray)">${v.qty}u · ${formatPrice(v.total)} · <strong style="color:var(--orange)">${pct}%</strong></span>
        </div>
        <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--red),var(--orange));border-radius:3px"></div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function payBreakdownHTML(entries, refTotal) {
  if (!entries.length) return '<span style="color:var(--gray);font-size:0.82rem">Sin datos aún</span>';
  return entries.map(([p, v]) => {
    const pct = Math.round(v.total / (refTotal || 1) * 100);
    const color = PAY_COLORS[p] || '#888';
    return `<div>
      <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:0.2rem">
        <span style="color:var(--cream)">${p}</span>
        <span style="color:var(--gray)">${pct}% · ${v.count}p · ${formatPrice(v.total)}</span>
      </div>
      <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:3px"></div>
      </div>
    </div>`;
  }).join('');
}

// ── Router del dashboard ───────────────────────────────────────
function renderDashboardTab() {
  if (!dashMonth) {
    const n = new Date();
    dashMonth = { year: n.getFullYear(), month: n.getMonth() };
  }
  const panel = document.getElementById('admin-panel');
  if (panel) panel.style.maxWidth = '1100px';
  switch (dashView) {
    case 'day':   return renderDayDetail();
    case 'month': return renderMonthDetail();
    default:      return renderDashboardOverview();
  }
}

// ── Navigation ─────────────────────────────────────────────────
function drillDay(dateStr) { dashView = 'day';   dashDayStr = dateStr; renderTabContent(); }
function drillMonth()      { dashView = 'month';                        renderTabContent(); }
function backToDash()      { dashView = 'overview';                     renderTabContent(); }
function changeMonth(d)    {
  dashMonth.month += d;
  if (dashMonth.month > 11) { dashMonth.month = 0;  dashMonth.year++; }
  if (dashMonth.month < 0)  { dashMonth.month = 11; dashMonth.year--; }
  renderTabContent();
}

// ── KPI card ───────────────────────────────────────────────────
function kpiCard(title, value, sub, color) {
  return `<div class="dash-card" style="border-top:3px solid ${color}">
    <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gray);margin-bottom:0.35rem">${title}</div>
    <div style="font-family:var(--font-h);font-size:1.3rem;font-weight:600;color:var(--cream);line-height:1.1">${value}</div>
    <div style="font-size:0.7rem;color:var(--gray);margin-top:0.25rem">${sub}</div>
  </div>`;
}

// ── OVERVIEW ───────────────────────────────────────────────────
function renderDashboardOverview() {
  const orders = getOrders();
  const now    = new Date();
  const todayStr = toDateStr(now);

  const startOf = unit => {
    const d = new Date(now);
    if (unit === 'week')  { d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); }
    if (unit === 'month') { d.setDate(1); d.setHours(0,0,0,0); }
    return d;
  };

  const todayOrders = orders.filter(o => toDateStr(o.timestamp) === todayStr);
  const weekOrders  = orders.filter(o => new Date(o.timestamp) >= startOf('week'));
  const monthOrders = orders.filter(o => new Date(o.timestamp) >= startOf('month'));
  const allTotal    = sumOrders(orders);
  const avgOrder    = orders.length ? allTotal / orders.length : 0;

  // Last 14 days
  const last14 = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const dayOs = orders.filter(o => { const t = new Date(o.timestamp); return t >= d && t < next; });
    last14.push({
      dateStr: toDateStr(d),
      label: d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }),
      total: sumOrders(dayOs), count: dayOs.length, isToday: i === 0
    });
  }
  const maxBar = Math.max(...last14.map(d => d.total), 1);

  const itemRank = buildItemRank(orders);
  const totalItemRev = itemRank.reduce((s,[,v]) => s + v.total, 0) || 1;
  const payEntries   = buildPayMap(orders);
  const monthName    = new Date(dashMonth.year, dashMonth.month, 1)
    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return `<div style="display:flex;flex-direction:column;gap:1.1rem">

    <!-- Toolbar -->
    <div style="display:flex;justify-content:flex-end">
      <button class="btn-secondary" style="font-size:0.75rem;padding:0.3rem 0.8rem" onclick="exportCSV()">⬇ Exportar CSV</button>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.65rem">
      ${kpiCard('Hoy', formatPrice(sumOrders(todayOrders)), `${todayOrders.length} pedido${todayOrders.length!==1?'s':''}`, '#e63946')}
      ${kpiCard('Esta semana', formatPrice(sumOrders(weekOrders)), `${weekOrders.length} pedidos`, '#f4a261')}
      ${kpiCard('Este mes', formatPrice(sumOrders(monthOrders)), `${monthOrders.length} pedidos`, '#64b4ff')}
      ${kpiCard('Acumulado', formatPrice(allTotal), `${orders.length} pedidos`, '#4cbb7a')}
      ${kpiCard('Ticket prom.', formatPrice(Math.round(avgOrder)), 'por pedido', '#a78bfa')}
    </div>

    <!-- Hoy + Pagos -->
    <div style="display:grid;grid-template-columns:180px 1fr;gap:0.65rem">
      <div class="dash-card" style="display:flex;flex-direction:column;gap:0.75rem">
        <div class="dash-card-title">Hoy · Canal</div>
        <div style="display:flex;gap:1.5rem">
          <div style="text-align:center">
            <div style="font-family:var(--font-h);font-size:2rem;color:#64b4ff">${todayOrders.filter(o=>o.type==='WEB').length}</div>
            <div style="font-size:0.7rem;color:var(--gray)">WEB</div>
          </div>
          <div style="text-align:center">
            <div style="font-family:var(--font-h);font-size:2rem;color:var(--orange)">${todayOrders.filter(o=>o.type==='DELI').length}</div>
            <div style="font-size:0.7rem;color:var(--gray)">DELI</div>
          </div>
        </div>
        ${todayOrders.length ? `<button class="btn-add" style="width:100%;font-size:0.75rem" onclick="drillDay('${todayStr}')">Ver detalle →</button>` : ''}
      </div>
      <div class="dash-card">
        <div class="dash-card-title">Métodos de pago (global)</div>
        <div style="margin-top:0.65rem;display:flex;flex-direction:column;gap:0.45rem">
          ${payBreakdownHTML(payEntries, allTotal)}
        </div>
      </div>
    </div>

    <!-- Gráfico 14 días (clickable) -->
    <div class="dash-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.85rem">
        <div class="dash-card-title">Ventas · Últimos 14 días</div>
        <span style="font-size:0.68rem;color:var(--gray)">click en una barra para ver el detalle del día</span>
      </div>
      ${last14.every(d => d.total === 0)
        ? '<div style="color:var(--gray);font-size:0.82rem;text-align:center;padding:1.5rem 0">Sin ventas registradas aún</div>'
        : `<div style="display:flex;align-items:flex-end;gap:4px;height:110px">
          ${last14.map(d => {
            const h = d.total ? Math.max(5, Math.round(d.total / maxBar * 105)) : 0;
            const bg = d.isToday ? 'var(--red)' : d.count ? 'rgba(230,57,70,0.45)' : 'var(--border)';
            const bgH = d.isToday ? '#ff4455' : 'rgba(230,57,70,0.75)';
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:${d.count?'pointer':'default'}"
              ${d.count ? `onclick="drillDay('${d.dateStr}')"` : ''}
              title="${d.label}${d.count ? ': '+formatPrice(d.total)+' ('+d.count+' pedidos)' : ''}">
              <div style="font-size:0.55rem;color:var(--gray);height:11px;line-height:11px">${d.total?(d.total/1000).toFixed(0)+'k':''}</div>
              <div style="width:100%;flex:1;display:flex;align-items:flex-end">
                <div style="width:100%;height:${h}px;background:${bg};border-radius:3px 3px 0 0;min-height:${d.total?2:0}px;transition:background 0.15s"
                  onmouseenter="if(${d.count})this.style.background='${bgH}'"
                  onmouseleave="this.style.background='${bg}'"></div>
              </div>
              <div style="font-size:0.57rem;color:${d.isToday?'var(--cream)':'var(--gray)'};white-space:nowrap;overflow:hidden;max-width:100%;text-align:center">${d.label}</div>
            </div>`;
          }).join('')}
        </div>`
      }
    </div>

    <!-- Artículos + Nav mes -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:0.65rem">
      <div class="dash-card">
        <div class="dash-card-title">Artículos más vendidos (global)</div>
        ${itemRankHTML(itemRank, totalItemRev)}
      </div>
      <div class="dash-card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.85rem;text-align:center">
        <div class="dash-card-title">Ver por mes</div>
        <div style="display:flex;align-items:center;gap:0.65rem;width:100%">
          <button class="btn-icon" onclick="changeMonth(-1)" style="flex-shrink:0">‹</button>
          <span style="font-size:0.85rem;color:var(--cream);font-weight:500;text-transform:capitalize;flex:1">${monthName}</span>
          <button class="btn-icon" onclick="changeMonth(1)" style="flex-shrink:0">›</button>
        </div>
        <button class="btn-add" style="width:100%" onclick="drillMonth()">Ver detalle →</button>
      </div>
    </div>
  </div>`;
}

// ── DAY DETAIL ─────────────────────────────────────────────────
function renderDayDetail() {
  const orders = getOrders();
  const d    = new Date(dashDayStr + 'T00:00:00');
  const next = new Date(d); next.setDate(next.getDate() + 1);
  const dayOs = orders.filter(o => { const t = new Date(o.timestamp); return t >= d && t < next; });
  const total = sumOrders(dayOs);
  const avg   = dayOs.length ? total / dayOs.length : 0;
  const dayLabel = d.toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  const itemRank = buildItemRank(dayOs);
  const totalItemRev = itemRank.reduce((s,[,v]) => s+v.total,0)||1;

  return `<div style="display:flex;flex-direction:column;gap:1rem">
    <div style="display:flex;align-items:center;gap:1rem">
      <button class="btn-secondary" onclick="backToDash()" style="padding:0.38rem 0.75rem;font-size:0.8rem">← Volver</button>
      <div>
        <div style="font-family:var(--font-h);font-size:1.05rem;text-transform:capitalize">${dayLabel}</div>
        <div style="font-size:0.73rem;color:var(--gray)">${dayOs.length} pedido${dayOs.length!==1?'s':''}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.65rem">
      ${kpiCard('Total del día', formatPrice(total), '&nbsp;', '#e63946')}
      ${kpiCard('Ticket prom.', formatPrice(Math.round(avg)), '&nbsp;', '#a78bfa')}
      ${kpiCard('WEB', dayOs.filter(o=>o.type==='WEB').length, 'pedidos desde la web', '#64b4ff')}
      ${kpiCard('DELI', dayOs.filter(o=>o.type==='DELI').length, 'cargados admin', '#f4a261')}
    </div>

    ${!dayOs.length
      ? '<div style="color:var(--gray);text-align:center;padding:2rem">Sin pedidos este día</div>'
      : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
        <div class="dash-card">
          <div class="dash-card-title">Artículos del día</div>
          ${itemRankHTML(itemRank, totalItemRev)}
        </div>
        <div class="dash-card" style="max-height:380px;overflow-y:auto">
          <div class="dash-card-title" style="margin-bottom:0.75rem">Pedidos</div>
          ${dayOs.map(o => {
            const badge = o.type==='DELI'
              ? `<span style="font-size:0.63rem;background:rgba(244,162,97,.15);color:var(--orange);padding:0.1rem 0.35rem;border-radius:3px">DELI</span>`
              : `<span style="font-size:0.63rem;background:rgba(100,180,255,.1);color:#64b4ff;padding:0.1rem 0.35rem;border-radius:3px">WEB</span>`;
            const t = new Date(o.timestamp);
            return `<div style="padding:0.6rem;background:var(--bg);border-radius:8px;border:1px solid var(--border);margin-bottom:0.5rem">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem">
                <div style="display:flex;align-items:center;gap:0.45rem">
                  ${badge}
                  <span style="font-size:0.82rem;font-weight:500;color:var(--cream)">${o.name||o.customer?.name||'—'}</span>
                </div>
                <span style="font-family:var(--font-h);font-size:0.9rem">${formatPrice(o.total)}</span>
              </div>
              <div style="font-size:0.74rem;color:var(--gray)">${o.items.map(i=>`${i.qty??i.quantity??1}x ${i.name}`).join(', ')}${(o.payment||o.customer?.payment)?' · '+(o.payment||o.customer?.payment):''}</div>
              <div style="font-size:0.67rem;color:var(--gray-dim);margin-top:0.15rem">${t.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`
    }
  </div>`;
}

// ── MONTH DETAIL ───────────────────────────────────────────────
function renderMonthDetail() {
  const orders = getOrders();
  const { year, month } = dashMonth;
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month+1, 0, 23, 59, 59, 999);
  const monthOs    = orders.filter(o => { const t=new Date(o.timestamp); return t>=monthStart&&t<=monthEnd; });
  const total      = sumOrders(monthOs);
  const avg        = monthOs.length ? total/monthOs.length : 0;
  const monthLabel = monthStart.toLocaleDateString('es-AR', { month:'long', year:'numeric' });

  // Daily data
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const dayData = Array.from({ length: daysInMonth }, (_, idx) => {
    const day  = idx + 1;
    const d    = new Date(year, month, day);
    const next = new Date(year, month, day+1);
    const dayOs = monthOs.filter(o => { const t=new Date(o.timestamp); return t>=d&&t<next; });
    return { day, dateStr: toDateStr(d), total: sumOrders(dayOs), count: dayOs.length };
  });
  const maxBar = Math.max(...dayData.map(d=>d.total), 1);
  const bestDay    = dayData.reduce((b,d) => d.total>b.total?d:b, dayData[0]);
  const activeDays = dayData.filter(d=>d.count>0).length;
  const todayStr   = toDateStr(new Date());

  const itemRank = buildItemRank(monthOs);
  const totalItemRev = itemRank.reduce((s,[,v])=>s+v.total,0)||1;
  const payEntries   = buildPayMap(monthOs);

  return `<div style="display:flex;flex-direction:column;gap:1rem">
    <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
      <button class="btn-secondary" onclick="backToDash()" style="padding:0.38rem 0.75rem;font-size:0.8rem">← Volver</button>
      <button class="btn-icon" onclick="changeMonth(-1)">‹</button>
      <span style="font-family:var(--font-h);font-size:1.05rem;text-transform:capitalize;flex:1">${monthLabel}</span>
      <button class="btn-icon" onclick="changeMonth(1)">›</button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.65rem">
      ${kpiCard('Total del mes', formatPrice(total), `${monthOs.length} pedidos`, '#e63946')}
      ${kpiCard('Ticket prom.', formatPrice(Math.round(avg)), 'por pedido', '#a78bfa')}
      ${kpiCard('Días activos', `${activeDays} / ${daysInMonth}`, 'con al menos 1 pedido', '#64b4ff')}
      ${kpiCard('Mejor día', bestDay.count ? 'Día '+bestDay.day : '—', bestDay.count ? formatPrice(bestDay.total) : 'Sin datos', '#4cbb7a')}
    </div>

    <!-- Bar chart del mes -->
    <div class="dash-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.85rem">
        <div class="dash-card-title">Ventas por día · ${monthLabel}</div>
        <span style="font-size:0.68rem;color:var(--gray)">click para ver detalle del día</span>
      </div>
      <div style="display:flex;align-items:flex-end;gap:3px;height:100px">
        ${dayData.map(d => {
          const h  = d.total ? Math.max(3, Math.round(d.total/maxBar*95)) : 0;
          const isTd = d.dateStr === todayStr;
          const bg = isTd ? 'var(--red)' : d.count ? 'rgba(230,57,70,0.45)' : 'var(--border)';
          const bgH = isTd ? '#ff4455' : 'rgba(230,57,70,0.75)';
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:${d.count?'pointer':'default'}"
            ${d.count?`onclick="drillDay('${d.dateStr}')" title="Día ${d.day}: ${formatPrice(d.total)} (${d.count} pedidos)"`:''}>
            <div style="width:100%;flex:1;display:flex;align-items:flex-end">
              <div style="width:100%;height:${h}px;background:${bg};border-radius:2px 2px 0 0;min-height:${d.total?2:0}px"
                onmouseenter="if(${d.count})this.style.background='${bgH}'"
                onmouseleave="this.style.background='${bg}'"></div>
            </div>
            <div style="font-size:0.54rem;color:${isTd?'var(--cream)':d.count?'var(--gray)':'var(--border)'}">${d.day}</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Artículos + pagos -->
    <div style="display:grid;grid-template-columns:3fr 2fr;gap:0.75rem">
      <div class="dash-card">
        <div class="dash-card-title">Artículos del mes</div>
        ${itemRankHTML(itemRank, totalItemRev)}
      </div>
      <div class="dash-card">
        <div class="dash-card-title">Métodos de pago</div>
        <div style="margin-top:0.65rem;display:flex;flex-direction:column;gap:0.45rem">
          ${payBreakdownHTML(payEntries, total)}
        </div>
        ${payEntries.length ? `<div style="margin-top:0.85rem;padding-top:0.75rem;border-top:1px solid var(--border)">
          ${payEntries.map(([p,v])=>`
            <div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:0.25rem 0;border-bottom:1px solid var(--border)">
              <span style="color:var(--gray)">${p}</span>
              <span style="color:var(--cream)">${formatPrice(v.total)}</span>
            </div>`).join('')}
        </div>` : ''}
      </div>
    </div>

    <!-- Tabla de pedidos del mes -->
    ${monthOs.length ? `
    <div class="dash-card">
      <div class="dash-card-title" style="margin-bottom:0.75rem">Todos los pedidos del mes (${monthOs.length})</div>
      <div style="max-height:300px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;font-size:0.79rem">
          <thead>
            <tr style="border-bottom:1px solid var(--border);color:var(--gray);position:sticky;top:0;background:var(--bg-elevated)">
              <th style="padding:0.4rem 0.5rem;text-align:left;font-weight:500">Fecha</th>
              <th style="padding:0.4rem 0.5rem;text-align:left;font-weight:500">Cliente</th>
              <th style="padding:0.4rem 0.5rem;text-align:left;font-weight:500">Items</th>
              <th style="padding:0.4rem 0.5rem;text-align:left;font-weight:500">Pago</th>
              <th style="padding:0.4rem 0.5rem;text-align:right;font-weight:500">Total</th>
            </tr>
          </thead>
          <tbody>
            ${monthOs.map(o => {
              const t = new Date(o.timestamp);
              const badge = o.type==='DELI'
                ? `<span style="font-size:0.6rem;background:rgba(244,162,97,.15);color:var(--orange);padding:0.08rem 0.3rem;border-radius:3px;margin-right:0.35rem">DELI</span>`
                : `<span style="font-size:0.6rem;background:rgba(100,180,255,.1);color:#64b4ff;padding:0.08rem 0.3rem;border-radius:3px;margin-right:0.35rem">WEB</span>`;
              return `<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="drillDay('${toDateStr(t)}')">
                <td style="padding:0.42rem 0.5rem;color:var(--gray)">${badge}${t.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'})} ${t.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</td>
                <td style="padding:0.42rem 0.5rem;color:var(--cream)">${o.name||o.customer?.name||'—'}</td>
                <td style="padding:0.42rem 0.5rem;color:var(--gray)">${o.items.map(i=>(i.qty??i.quantity??1)+'x '+i.name).join(', ')}</td>
                <td style="padding:0.42rem 0.5rem;color:var(--gray)">${o.payment||o.customer?.payment||'—'}</td>
                <td style="padding:0.42rem 0.5rem;text-align:right;font-family:var(--font-h)">${formatPrice(o.total)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}
  </div>`;
}

// ══════════════════════════════════════════════════════════════
//  TAB: ÍTEMS
// ══════════════════════════════════════════════════════════════
function renderItemsTab() {
  const data = getData();
  return `
    <div class="admin-section-header">
      <span class="admin-section-title">Artículos del menú</span>
      <button class="btn-add" id="btn-new-item">+ Nuevo</button>
    </div>
    <div id="item-form-container"></div>
    <div id="items-list">
      ${data.items.map(item => `
        <div class="admin-item-row">
          <div class="admin-item-info">
            <div class="admin-item-name">${item.name}</div>
            <div class="admin-item-cat">${item.category}</div>
          </div>
          <label class="toggle" title="${item.available ? 'Disponible' : 'No disponible'}">
            <input type="checkbox" ${item.available ? 'checked' : ''}
              onchange="toggleAvail('${item.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
          ${item.stock !== null ? `
            <input type="number" class="form-input"
              style="width:68px;padding:0.28rem 0.5rem;font-size:0.82rem;text-align:center"
              value="${item.stock}" min="0" title="Stock"
              onchange="setStock('${item.id}', this.value)">
          ` : `<span style="font-size:0.78rem;color:var(--gray-dim);min-width:20px;text-align:center">∞</span>`}
          <div class="admin-item-price">${formatPrice(item.price)}</div>
          <button class="btn-icon" onclick="startEditItem('${item.id}')" title="Editar">✎</button>
          <button class="btn-icon danger" onclick="confirmDelete('${item.id}')" title="Eliminar">✕</button>
        </div>`).join('')}
    </div>`;
}

function bindItemsEvents() {
  document.getElementById('btn-new-item').addEventListener('click', () => showItemForm(null));
}

function showItemForm(itemId) {
  editingItemId = itemId;
  const data = getData();
  const item = itemId ? data.items.find(i => i.id === itemId) : null;

  document.getElementById('item-form-container').innerHTML = `
    <div class="item-form">
      <div class="item-form-title">${item ? 'Editar artículo' : 'Nuevo artículo'}</div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Nombre</label>
          <input class="form-input" id="fi-name" value="${item ? esc(item.name) : ''}" placeholder="Nombre">
        </div>
        <div class="form-group">
          <label class="form-label">Categoría</label>
          <select class="form-input" id="fi-cat">
            ${data.categories.map(c => `<option ${item && item.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Precio ($)</label>
          <input class="form-input" id="fi-price" type="number" value="${item ? item.price : ''}" placeholder="0">
        </div>
        <div class="form-group">
          <label class="form-label">Stock (vacío = ilimitado)</label>
          <input class="form-input" id="fi-stock" type="number"
            value="${item && item.stock !== null ? item.stock : ''}" placeholder="∞">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Descripción</label>
        <input class="form-input" id="fi-desc" value="${item ? esc(item.description) : ''}" placeholder="Descripción">
      </div>
      <div class="form-group">
        <label class="form-label">Ingredientes base (separados por coma)</label>
        <input class="form-input" id="fi-ings"
          value="${item && item.baseIngredients ? item.baseIngredients.join(', ') : ''}"
          placeholder="Salsa de tomate, Mozzarella, ...">
      </div>
      <div class="form-actions">
        <button class="btn-primary" onclick="saveItemForm()">${item ? 'Guardar cambios' : 'Crear artículo'}</button>
        <button class="btn-secondary" onclick="cancelItemForm()">Cancelar</button>
      </div>
    </div>`;

  document.getElementById('item-form-container').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function saveItemForm() {
  const name  = document.getElementById('fi-name').value.trim();
  const cat   = document.getElementById('fi-cat').value;
  const price = parseInt(document.getElementById('fi-price').value);
  const stock = document.getElementById('fi-stock').value.trim();
  const desc  = document.getElementById('fi-desc').value.trim();
  const ings  = document.getElementById('fi-ings').value.trim();

  if (!name || !price) { alert('Nombre y precio son obligatorios'); return; }

  const payload = {
    name, category: cat, price,
    stock: stock !== '' ? parseInt(stock) : null,
    description: desc,
    baseIngredients: ings ? ings.split(',').map(s => s.trim()).filter(Boolean) : []
  };

  if (editingItemId) {
    updateItem(editingItemId, payload);
  } else {
    addItem(payload);
  }

  cancelItemForm();
  renderMenu();
  renderCategories();
  renderTabContent();
}

function cancelItemForm() {
  document.getElementById('item-form-container').innerHTML = '';
  editingItemId = null;
}

function startEditItem(id) {
  showItemForm(id);
}

function confirmDelete(id) {
  const data = getData();
  const item = data.items.find(i => i.id === id);
  if (!item) return;
  if (confirm(`¿Eliminar "${item.name}"?`)) {
    deleteItem(id);
    renderMenu();
    renderTabContent();
  }
}

function toggleAvail(id, available) {
  updateItem(id, { available });
  renderMenu();
}

function setStock(id, val) {
  const stock = val === '' ? null : parseInt(val);
  updateItem(id, { stock });
  renderMenu();
}

// ══════════════════════════════════════════════════════════════
//  TAB: EXTRAS
// ══════════════════════════════════════════════════════════════
function renderExtrasTab() {
  const data = getData();
  return `
    <div class="admin-section-header">
      <span class="admin-section-title">Ingredientes extra</span>
      <button class="btn-add" id="btn-new-extra">+ Nuevo</button>
    </div>
    <div id="extra-form-container"></div>
    <div id="extras-list">
      ${data.extras.map(ext => `
        <div class="admin-item-row">
          <div class="admin-item-info" style="flex:1">
            <div class="admin-item-name">${ext.name}</div>
          </div>
          <div class="admin-item-price">${formatPrice(ext.price)}</div>
          <button class="btn-icon" onclick="startEditExtra('${ext.id}')">✎</button>
          <button class="btn-icon danger" onclick="confirmDeleteExtra('${ext.id}')">✕</button>
        </div>`).join('')}
    </div>`;
}

function bindExtrasEvents() {
  document.getElementById('btn-new-extra').addEventListener('click', () => showExtraForm(null));
}

function showExtraForm(extId) {
  editingExtraId = extId;
  const data = getData();
  const ext = extId ? data.extras.find(e => e.id === extId) : null;

  document.getElementById('extra-form-container').innerHTML = `
    <div class="item-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Nombre</label>
          <input class="form-input" id="ef-name" value="${ext ? esc(ext.name) : ''}" placeholder="Nombre del extra">
        </div>
        <div class="form-group">
          <label class="form-label">Precio ($)</label>
          <input class="form-input" id="ef-price" type="number" value="${ext ? ext.price : ''}" placeholder="0">
        </div>
      </div>
      <div class="form-actions">
        <button class="btn-primary" onclick="saveExtraForm()">${ext ? 'Guardar' : 'Agregar'}</button>
        <button class="btn-secondary" onclick="cancelExtraForm()">Cancelar</button>
      </div>
    </div>`;
}

function saveExtraForm() {
  const name  = document.getElementById('ef-name').value.trim();
  const price = parseInt(document.getElementById('ef-price').value);
  if (!name || !price) { alert('Nombre y precio son obligatorios'); return; }

  if (editingExtraId) {
    updateExtra(editingExtraId, { name, price });
  } else {
    addExtra({ name, price });
  }
  cancelExtraForm();
  renderTabContent();
}

function cancelExtraForm() {
  document.getElementById('extra-form-container').innerHTML = '';
  editingExtraId = null;
}

function startEditExtra(id) { showExtraForm(id); }

function confirmDeleteExtra(id) {
  const data = getData();
  const ext = data.extras.find(e => e.id === id);
  if (!ext) return;
  if (confirm(`¿Eliminar extra "${ext.name}"?`)) {
    deleteExtra(id);
    renderTabContent();
  }
}

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
  const groups = c.optionGroups || [{ label: '', options: [], qty: 2 }];
  const groupsHtml = groups.map((g, i) => comboGroupRowHtml(i, g.label, g.options.join(', '), g.qty || 2)).join('');
  return `
    <div class="admin-section-title" style="margin-bottom:1rem">
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

function comboGroupRowHtml(idx, label, optionsStr, qty) {
  return `
    <div class="admin-item-row" id="combo-group-${idx}" style="margin-bottom:0.5rem;align-items:flex-start">
      <div style="flex:1;display:flex;gap:0.5rem;flex-wrap:wrap">
        <input class="form-input" style="flex:1;min-width:120px" placeholder="Nombre (ej: Gaseosas)"
          id="cg-label-${idx}" value="${label || ''}">
        <input class="form-input" style="flex:2;min-width:180px" placeholder="Opciones separadas por coma"
          id="cg-options-${idx}" value="${optionsStr || ''}">
        <input class="form-input" style="width:70px;flex:none" type="number" min="1" max="10" placeholder="Cant." title="Cantidad a elegir"
          id="cg-qty-${idx}" value="${qty || 2}">
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
    const qtyEl   = document.getElementById(`cg-qty-${idx}`);
    const qty     = qtyEl ? (parseInt(qtyEl.value) || 2) : 2;
    if (label) groups.push({ label, options, qty });
  });
  return groups;
}

function saveComboForm() {
  const id           = document.getElementById('cf-id').value;
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

// ══════════════════════════════════════════════════════════════
//  TAB: PEDIDO DELI
// ══════════════════════════════════════════════════════════════
function renderDeliTab() {
  const data = getData();
  const total = deliCart.reduce((s, i) => s + i.price * i.quantity, 0);

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">

      <!-- Selector de ítems -->
      <div>
        <div class="admin-section-title" style="margin-bottom:0.75rem">Agregar ítems</div>
        <div style="max-height:320px;overflow-y:auto;padding-right:0.25rem">
          ${data.items
            .filter(i => i.available && i.stock !== 0)
            .map(item => `
              <div class="admin-item-row" style="padding:0.5rem 0">
                <div class="admin-item-info" style="flex:1">
                  <div class="admin-item-name" style="font-size:0.88rem">${item.name}</div>
                  <div style="font-size:0.73rem;color:var(--gray)">${formatPrice(item.price)}</div>
                </div>
                <button class="add-btn" style="width:29px;height:29px;font-size:1rem"
                  onclick="addDeliItem('${item.id}')">+</button>
              </div>`).join('')}
        </div>
      </div>

      <!-- Carrito + formulario -->
      <div>
        <div class="admin-section-title" style="margin-bottom:0.75rem">Comanda</div>

        <!-- Cart -->
        <div id="deli-cart-items" style="min-height:60px;margin-bottom:0.75rem">
          ${renderDeliCartItems(total)}
        </div>

        <!-- Datos cliente -->
        <div class="form-group">
          <label class="form-label">Nombre del cliente</label>
          <input class="form-input" id="deli-name" placeholder="Nombre">
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input class="form-input" id="deli-phone" placeholder="Teléfono">
        </div>
        <div class="form-group">
          <label class="form-label">Dirección</label>
          <input class="form-input" id="deli-address" placeholder="Dirección">
        </div>
        <div class="form-group">
          <label class="form-label">Pago</label>
          <select class="form-input" id="deli-payment">
            <option value="Efectivo">Efectivo</option>
            <option value="Transferencia">Transferencia</option>
            <option value="Mercado Pago">Mercado Pago</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Notas</label>
          <input class="form-input" id="deli-notes" placeholder="Observaciones…">
        </div>
        <button class="btn-primary" onclick="submitDeliOrder()">Guardar comanda</button>
      </div>
    </div>`;
}

function renderDeliCartItems(total) {
  if (!deliCart.length) return '<div style="color:var(--gray);font-size:0.83rem">Sin ítems aún</div>';
  const total2 = total ?? deliCart.reduce((s, i) => s + i.price * i.quantity, 0);
  return deliCart.map(item => `
    <div style="display:flex;align-items:center;gap:0.4rem;padding:0.38rem 0;border-bottom:1px solid var(--border)">
      <span style="flex:1;font-size:0.85rem">${item.name}</span>
      <button class="qty-btn" style="width:22px;height:22px;font-size:0.8rem"
        onclick="changeDeliQty('${item.cartId}', -1)">−</button>
      <span style="font-size:0.85rem;min-width:16px;text-align:center">${item.quantity}</span>
      <button class="qty-btn" style="width:22px;height:22px;font-size:0.8rem"
        onclick="changeDeliQty('${item.cartId}', 1)">+</button>
      <span style="font-size:0.82rem;color:var(--cream);white-space:nowrap">${formatPrice(item.price * item.quantity)}</span>
      <button class="btn-icon" style="width:22px;height:22px;color:var(--red)"
        onclick="removeDeliItem('${item.cartId}')">✕</button>
    </div>`).join('') +
    `<div style="font-family:var(--font-h);font-size:0.98rem;margin-top:0.4rem">Total: ${formatPrice(total2)}</div>`;
}

function bindDeliEvents() {}

function addDeliItem(itemId) {
  const data = getData();
  const item = data.items.find(i => i.id === itemId);
  if (!item) return;
  const existing = deliCart.find(i => i.id === itemId);
  if (existing) {
    existing.quantity++;
  } else {
    deliCart.push({ cartId: Date.now() + Math.random(), id: item.id, name: item.name, price: item.price, quantity: 1 });
  }
  refreshDeliCart();
}

function changeDeliQty(cartId, delta) {
  const idx = deliCart.findIndex(i => String(i.cartId) === String(cartId));
  if (idx === -1) return;
  deliCart[idx].quantity = Math.max(1, deliCart[idx].quantity + delta);
  refreshDeliCart();
}

function removeDeliItem(cartId) {
  deliCart = deliCart.filter(i => String(i.cartId) !== String(cartId));
  refreshDeliCart();
}

function refreshDeliCart() {
  const el = document.getElementById('deli-cart-items');
  if (el) el.innerHTML = renderDeliCartItems();
}

function submitDeliOrder() {
  if (!deliCart.length) { alert('Agregá al menos un ítem'); return; }
  const name    = document.getElementById('deli-name').value.trim();
  const phone   = document.getElementById('deli-phone').value.trim();
  const address = document.getElementById('deli-address').value.trim();
  const payment = document.getElementById('deli-payment').value;
  const notes   = document.getElementById('deli-notes').value.trim();

  if (!name) { alert('El nombre del cliente es obligatorio'); return; }

  saveOrder({
    type: 'DELI',
    items: deliCart.map(i => ({ ...i })),
    total: deliCart.reduce((s, i) => s + i.price * i.quantity, 0),
    customer: { name, phone, address, payment, notes }
  });

  deliCart = [];
  alert('✓ Comanda guardada correctamente');
  switchTab('orders');
}

// ══════════════════════════════════════════════════════════════
//  TAB: COMANDAS
// ══════════════════════════════════════════════════════════════
function renderOrdersTab() {
  const orders = getOrders();
  if (!orders.length) {
    return '<div style="color:var(--gray);text-align:center;padding:2.5rem 0;font-size:0.88rem">Sin comandas registradas</div>';
  }
  return `
    <div class="admin-section-title" style="margin-bottom:1rem">Todas las comandas</div>
    <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
      <thead>
        <tr style="border-bottom:2px solid var(--border);color:var(--gray);text-align:left">
          <th style="padding:0.5rem 0.6rem">ID</th>
          <th style="padding:0.5rem 0.6rem">Nombre</th>
          <th style="padding:0.5rem 0.6rem">Teléfono</th>
          <th style="padding:0.5rem 0.6rem">Dirección</th>
          <th style="padding:0.5rem 0.6rem">Pedido</th>
          <th style="padding:0.5rem 0.6rem;text-align:right">Total</th>
          <th style="padding:0.5rem 0.6rem"></th>
        </tr>
      </thead>
      <tbody>
        ${orders.map(o => {
          const desc = o.items.map(i => {
            const extras = i.addedExtras && i.addedExtras.length ? ' +' + i.addedExtras.map(e => e.name).join(',') : '';
            return `${i.quantity}x ${i.name}${extras}`;
          }).join(' · ');
          const typeBadge = o.type === 'DELI'
            ? `<span style="font-size:0.68rem;background:rgba(244,162,97,.15);color:var(--orange);padding:0.1rem 0.4rem;border-radius:4px">DELI</span>`
            : `<span style="font-size:0.68rem;background:rgba(100,180,255,.1);color:#64b4ff;padding:0.1rem 0.4rem;border-radius:4px">WEB</span>`;
          return `
            <tr style="border-bottom:1px solid var(--border);${o.status === 'done' ? 'opacity:0.45' : ''}">
              <td style="padding:0.6rem 0.6rem;white-space:nowrap">
                ${o.id}<br>${typeBadge}
                <div style="font-size:0.68rem;color:var(--gray);margin-top:0.2rem">${formatDate(o.timestamp)}</div>
              </td>
              <td style="padding:0.6rem 0.6rem;font-weight:500;color:var(--cream)">${o.customer?.name || '—'}</td>
              <td style="padding:0.6rem 0.6rem;color:var(--gray)">${o.customer?.phone || '—'}</td>
              <td style="padding:0.6rem 0.6rem;color:var(--gray);max-width:130px">${o.customer?.address || '—'}</td>
              <td style="padding:0.6rem 0.6rem;color:var(--gray);max-width:160px">${desc}</td>
              <td style="padding:0.6rem 0.6rem;text-align:right;white-space:nowrap;font-family:var(--font-h)">${formatPrice(o.total)}</td>
              <td style="padding:0.6rem 0.4rem">
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap">
                  ${o.status !== 'done' ? `
                    <button class="btn-icon" title="Marcar entregado"
                      style="color:#4cbb7a;border-color:#4cbb7a22"
                      onclick="markDone('${o.id}')">✓</button>` : ''}
                  ${o.customer?.phone ? `
                    <a href="https://wa.me/${(o.customer.phone+'').replace(/\D/g,'')}"
                      target="_blank" class="btn-icon" title="WhatsApp"
                      style="text-decoration:none;font-size:0.9rem">💬</a>` : ''}
                  <button class="btn-icon" title="Imprimir comanda"
                    onclick="printComanda('${o.id}')">🖨</button>
                </div>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function markDone(id) {
  updateOrderStatus(id, 'done');
  renderTabContent();
}

// ══════════════════════════════════════════════════════════════
//  TAB: CONFIG
// ══════════════════════════════════════════════════════════════
function renderSettingsTab() {
  const data = getData();
  return `
    <div class="admin-section-title" style="margin-bottom:1rem">Configuración general</div>

    <div class="form-group">
      <label class="form-label">Número de WhatsApp (con código de país)</label>
      <input class="form-input" id="s-wa" value="${data.whatsappNumber}" placeholder="5491112345678">
    </div>

    <div class="form-group">
      <label class="form-label">URL del logo (dejá vacío para usar texto)</label>
      <input class="form-input" id="s-logo" value="${data.logoUrl || ''}" placeholder="https://...">
    </div>

    <div class="form-group">
      <label class="form-label">Categorías (separadas por coma)</label>
      <input class="form-input" id="s-cats" value="${data.categories.join(', ')}">
    </div>

    <div class="form-group">
      <label class="form-label">Nueva contraseña admin (vacío = sin cambio)</label>
      <input class="form-input" id="s-pwd" type="password" placeholder="Nueva contraseña">
    </div>

    <div style="margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid var(--border)">
      <div class="admin-section-title" style="margin-bottom:0.75rem">Horario de atención</div>
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:0.6rem;cursor:pointer">
          <input type="checkbox" id="s-hours-enabled" ${data.openHours?.enabled ? 'checked' : ''}>
          <span class="form-label" style="margin:0">Activar control de horario</span>
        </label>
        <span style="font-size:0.7rem;color:var(--gray);margin-top:0.25rem">Si está activo, no se pueden hacer pedidos fuera del horario</span>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Abre</label>
          <input class="form-input" id="s-hours-from" type="time" value="${data.openHours?.from || '18:00'}">
        </div>
        <div class="form-group">
          <label class="form-label">Cierra</label>
          <input class="form-input" id="s-hours-to" type="time" value="${data.openHours?.to || '23:30'}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Mensaje cuando está cerrado</label>
        <input class="form-input" id="s-hours-msg"
          value="${esc(data.openHours?.closedMsg || 'Estamos cerrados. ¡Volvemos pronto!')}"
          placeholder="Estamos cerrados…">
      </div>
      <div class="form-group">
        <label class="form-label">Dirección del local (para retiro)</label>
        <input class="form-input" id="s-pickup-addr"
          value="${data.openHours?.pickupAddress || ''}"
          placeholder="Ej: Av. Corrientes 1234, CABA">
      </div>
    </div>

    <div style="margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid var(--border)">
      <div class="admin-section-title" style="margin-bottom:0.75rem">Integraciones</div>

      <div class="form-group">
        <label class="form-label">Google Maps API Key (para autocomplete de dirección)</label>
        <input class="form-input" id="s-maps" value="${data.googleMapsApiKey || ''}" placeholder="AIza...">
        <span style="font-size:0.7rem;color:var(--gray)">Obtené tu key en console.cloud.google.com &rarr; APIs &rarr; Maps JavaScript API + Places</span>
      </div>

      <div class="form-group">
        <label class="form-label">Google Sheets Webhook URL (para guardar pedidos)</label>
        <input class="form-input" id="s-sheets" value="${data.sheetsWebhookUrl || ''}" placeholder="https://script.google.com/macros/s/...">
        <span style="font-size:0.7rem;color:var(--gray)">Creá un Google Apps Script con doPost() y deployá como web app</span>
      </div>

      <div class="form-group">
        <label class="form-label">🔥 Firebase Config (para pedidos en tiempo real)</label>
        <textarea class="form-input" id="s-firebase" rows="6" placeholder='{"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}'
          style="font-family:monospace;font-size:0.75rem;resize:vertical">${data.firebaseConfig ? JSON.stringify(data.firebaseConfig, null, 2) : ''}</textarea>
        <span style="font-size:0.7rem;color:var(--gray)">Pegá el objeto firebaseConfig desde Consola Firebase → Configuración del proyecto → Tus apps</span>
      </div>
    </div>

    <button class="btn-primary" style="margin-top:0.25rem" onclick="saveSettings()">
      Guardar configuración
    </button>

    <div style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid var(--border)">
      <div class="admin-section-title" style="margin-bottom:0.75rem;color:var(--red)">Zona peligrosa</div>
      <button class="btn-secondary" style="border-color:#e6394644;color:var(--red)"
        onclick="resetAllData()">Restaurar datos de fábrica</button>
    </div>`;
}

function bindSettingsEvents() {}

function saveSettings() {
  const data   = getData();
  const wa     = document.getElementById('s-wa').value.trim();
  const logo   = document.getElementById('s-logo').value.trim();
  const cats   = document.getElementById('s-cats').value.trim();
  const pwd    = document.getElementById('s-pwd').value.trim();
  const maps     = document.getElementById('s-maps').value.trim();
  const sheets   = document.getElementById('s-sheets').value.trim();
  const fbRaw    = document.getElementById('s-firebase')?.value.trim();

  if (wa)     data.whatsappNumber  = wa;
  data.logoUrl          = logo;
  if (cats)   data.categories      = cats.split(',').map(s => s.trim()).filter(Boolean);
  if (pwd)    data.adminPassword   = pwd;
  data.googleMapsApiKey = maps;
  data.sheetsWebhookUrl = sheets;
  if (fbRaw) {
    try { data.firebaseConfig = JSON.parse(fbRaw); }
    catch (e) { alert('Firebase Config inválido — revisá que sea un JSON válido'); return; }
  }

  // Horarios
  data.openHours = {
    enabled:   document.getElementById('s-hours-enabled')?.checked || false,
    from:      document.getElementById('s-hours-from')?.value || '18:00',
    to:        document.getElementById('s-hours-to')?.value   || '23:30',
    closedMsg: document.getElementById('s-hours-msg')?.value.trim() || 'Estamos cerrados. ¡Volvemos pronto!'
  };
  data.openHours.pickupAddress = document.getElementById('s-pickup-addr')?.value.trim() || '';

  saveData(data);

  // Actualizar logo en vivo
  const imgEl = document.getElementById('logo-img');
  const txtEl = document.getElementById('logo-text');
  if (logo) {
    imgEl.src = logo;
    imgEl.classList.remove('hidden');
    txtEl.classList.add('hidden');
  } else {
    imgEl.classList.add('hidden');
    txtEl.classList.remove('hidden');
  }

  renderMenu();
  renderCategories();
  alert('✓ Configuración guardada');
}

function resetAllData() {
  if (confirm('¿Restaurar todos los datos de fábrica? Esto borrará los cambios que hayas hecho.')) {
    localStorage.removeItem('apizza_data');
    localStorage.removeItem('apizza_orders');
    alert('Datos restaurados. La página se va a recargar.');
    location.reload();
  }
}

// ── Export CSV ────────────────────────────────────────────────
function exportCSV() {
  const orders = getOrders();
  if (!orders.length) { alert('No hay pedidos para exportar'); return; }
  const rows = [['ID','Fecha','Tipo','Cliente','Teléfono','Dirección','Items','Pago','Total']];
  orders.forEach(o => {
    rows.push([
      o.id,
      new Date(o.timestamp).toLocaleString('es-AR'),
      o.type || '',
      o.name || o.customer?.name || '',
      o.phone || o.customer?.phone || '',
      o.address || o.customer?.address || '',
      o.items.map(i => `${i.qty??i.quantity??1}x ${i.name}`).join(' | '),
      o.payment || o.customer?.payment || '',
      o.total
    ]);
  });
  const csv  = rows.map(r => r.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url, download: `apizza-${new Date().toISOString().slice(0,10)}.csv`
  });
  a.click(); URL.revokeObjectURL(url);
}

// ── Imprimir comanda ──────────────────────────────────────────
function printComanda(orderId) {
  const o = getOrders().find(x => x.id === orderId);
  if (!o) return;
  const name    = o.name    || o.customer?.name    || '—';
  const phone   = o.phone   || o.customer?.phone   || '';
  const address = o.address || o.customer?.address || '';
  const payment = o.payment || o.customer?.payment || '';
  const notes   = o.notes   || o.customer?.notes   || '';
  const itemsHtml = o.items.map(i => {
    const qty    = i.qty ?? i.quantity ?? 1;
    const extras = i.addedExtras?.length ? ' +' + i.addedExtras.map(e => e.name).join(',') : '';
    const note   = i.note ? ` (${i.note})` : '';
    return `<tr><td>${qty}× ${i.name}${extras}${note}</td><td style="text-align:right">$${Number(i.price*qty).toLocaleString('es-AR')}</td></tr>`;
  }).join('');
  const t = new Date(o.timestamp);

  const win = window.open('', '_blank', 'width=380,height=620');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comanda ${o.id}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;font-size:12px;padding:16px;max-width:280px;margin:0 auto}
h1{font-size:20px;text-align:center;letter-spacing:3px;margin-bottom:2px}
.sub{text-align:center;font-size:10px;color:#777;margin-bottom:10px}
hr{border:none;border-top:1px dashed #000;margin:8px 0}
table{width:100%;border-collapse:collapse}
td{padding:3px 2px;vertical-align:top;font-size:12px}
.total-row td{font-weight:bold;font-size:15px;padding-top:8px;border-top:2px solid #000}
.meta{font-size:11px;margin:3px 0;line-height:1.5}
@media print{@page{margin:4mm}button{display:none}}
</style></head>
<body>
<h1>APIZZA</h1>
<div class="sub">${t.toLocaleDateString('es-AR')} ${t.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</div>
<hr>
<div class="meta"><strong>${o.id}</strong> &nbsp;·&nbsp; ${o.type||''}</div>
<div class="meta">👤 ${name}</div>
${phone?`<div class="meta">📞 ${phone}</div>`:''}
${address?`<div class="meta">📍 ${address}</div>`:''}
${payment?`<div class="meta">💳 ${payment}</div>`:''}
${notes?`<div class="meta">📝 ${notes}</div>`:''}
<hr>
<table>
${itemsHtml}
<tr class="total-row"><td>TOTAL</td><td style="text-align:right">$${Number(o.total).toLocaleString('es-AR')}</td></tr>
</table>
<hr>
<div style="text-align:center;font-size:10px;margin-top:10px">¡Gracias por tu pedido! 🍕</div>
<script>window.onload=()=>{setTimeout(()=>window.print(),300)}<\/script>
</body></html>`);
  win.document.close();
}

// ── Util ──────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
