// ============================================================
//  APIZZA · ui-dialogs.js — styled replacements for native
//  alert / confirm / prompt (toasts + modal dialogs)
// ============================================================

// ── Toast notifications ───────────────────────────────────────
function uiToast(message, type = 'info', duration = 3200) {
  let container = document.getElementById('ui-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'ui-toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `ui-toast ui-toast--${type}`;

  const icon = document.createElement('span');
  icon.className = 'ui-toast-icon';
  icon.textContent = icons[type] || icons.info;

  const text = document.createElement('span');
  text.className = 'ui-toast-text';
  text.textContent = message; // textContent: safe against XSS

  toast.append(icon, text);
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 600); // fallback if transitionend never fires
  }, duration);
}

// ── Modal dialog core ─────────────────────────────────────────
// buildDialog returns a promise resolved with the dialog result.
function buildDialog({ title, message, input = null, okText = 'Aceptar', cancelText = null, danger = false }) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'ui-dialog-overlay';

    const box = document.createElement('div');
    box.className = 'ui-dialog';

    if (title) {
      const h = document.createElement('div');
      h.className = 'ui-dialog-title';
      h.textContent = title;
      box.appendChild(h);
    }

    if (message) {
      const p = document.createElement('div');
      p.className = 'ui-dialog-msg';
      p.textContent = message;
      box.appendChild(p);
    }

    let inputEl = null;
    if (input) {
      inputEl = document.createElement('input');
      inputEl.className = 'ui-dialog-input';
      inputEl.type = input.type || 'text';
      inputEl.placeholder = input.placeholder || '';
      inputEl.autocomplete = 'off';
      box.appendChild(inputEl);
    }

    const actions = document.createElement('div');
    actions.className = 'ui-dialog-actions';

    let cancelBtn = null;
    if (cancelText) {
      cancelBtn = document.createElement('button');
      cancelBtn.className = 'ui-dialog-btn ui-dialog-btn--ghost';
      cancelBtn.textContent = cancelText;
      actions.appendChild(cancelBtn);
    }

    const okBtn = document.createElement('button');
    okBtn.className = 'ui-dialog-btn' + (danger ? ' ui-dialog-btn--danger' : '');
    okBtn.textContent = okText;
    actions.appendChild(okBtn);

    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function close(result) {
      document.removeEventListener('keydown', onKey);
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 220);
      resolve(result);
    }

    function confirmValue() {
      close(inputEl ? inputEl.value : true);
    }

    function onKey(e) {
      if (e.key === 'Escape') close(inputEl ? null : false);
      if (e.key === 'Enter') confirmValue();
    }

    okBtn.addEventListener('click', confirmValue);
    if (cancelBtn) cancelBtn.addEventListener('click', () => close(inputEl ? null : false));
    overlay.addEventListener('click', e => {
      if (e.target === overlay) close(inputEl ? null : false);
    });
    document.addEventListener('keydown', onKey);

    requestAnimationFrame(() => {
      overlay.classList.add('visible');
      (inputEl || okBtn).focus();
    });
  });
}

// ── Public API ────────────────────────────────────────────────
function uiAlert(message, { title = 'Aviso', okText = 'Entendido' } = {}) {
  return buildDialog({ title, message, okText });
}

function uiConfirm(message, { title = 'Confirmar', okText = 'Sí, continuar', cancelText = 'Cancelar', danger = false } = {}) {
  return buildDialog({ title, message, okText, cancelText, danger });
}

function uiPrompt(message, { title = '', type = 'text', placeholder = '', okText = 'Aceptar', cancelText = 'Cancelar' } = {}) {
  return buildDialog({ title, message, input: { type, placeholder }, okText, cancelText });
}
