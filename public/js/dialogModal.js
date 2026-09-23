/**
 * dialogModal.js - Sistema Universal de Diálogos Modales Emergentes (D&D 2024 Theme)
 * Sustituye prompt(), confirm() y alert() nativos del navegador por diálogos emergentes con el estilo dark fantasy de la aplicación.
 */

function getDialogContainer() {
  let container = document.getElementById('dialog-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'dialog-container';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Diálogo interactivo para solicitar entradas (sustituto estilizado de prompt)
 */
export function showPrompt({
  title = 'Fijar Cantidad',
  message = '',
  messageHtml = '',
  defaultValue = '',
  icon = '✏️',
  iconHtml = '',
  inputType = 'text',
  unit = '',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  min,
  max,
  step,
  placeholder = ''
} = {}) {
  return new Promise((resolve) => {
    const container = getDialogContainer();

    const formattedMessage = messageHtml || (message ? `<p class="dnd-dialog-message">${message.replace(/\n/g, '<br>')}</p>` : '');
    const isNumber = inputType === 'number';

    const overlay = document.createElement('div');
    overlay.className = 'dnd-dialog-overlay';
    overlay.innerHTML = `
      <div class="dnd-dialog-card dnd-prompt-card" role="dialog" aria-modal="true">
        <div class="dnd-dialog-header">
          <div class="dnd-dialog-title-group">
            <span class="dnd-dialog-icon">${iconHtml || icon}</span>
            <h3 class="dnd-dialog-title">${title}</h3>
          </div>
          <button type="button" class="dnd-dialog-close-btn" title="Cerrar">&times;</button>
        </div>

        <form class="dnd-dialog-form" onsubmit="event.preventDefault();">
          <div class="dnd-dialog-body">
            ${formattedMessage}

            <div class="dnd-dialog-input-wrapper">
              <input 
                type="${inputType}" 
                class="dnd-dialog-input" 
                id="dnd-dialog-input-field" 
                value="${defaultValue !== undefined && defaultValue !== null ? defaultValue : ''}"
                placeholder="${placeholder}"
                ${min !== undefined ? `min="${min}"` : ''}
                ${max !== undefined ? `max="${max}"` : ''}
                ${step !== undefined ? `step="${step}"` : ''}
                autocomplete="off"
              />
              ${unit ? `<span class="dnd-dialog-input-unit">${unit}</span>` : ''}
            </div>

            ${isNumber ? `
              <div class="dnd-dialog-steppers">
                <button type="button" class="btn-dialog-step" data-delta="-10">−10</button>
                <button type="button" class="btn-dialog-step" data-delta="-1">−1</button>
                <button type="button" class="btn-dialog-step" data-delta="1">+1</button>
                <button type="button" class="btn-dialog-step" data-delta="10">+10</button>
              </div>
            ` : ''}
          </div>

          <div class="dnd-dialog-footer">
            <button type="button" class="btn btn-secondary dnd-dialog-btn-cancel">${cancelText}</button>
            <button type="submit" class="btn btn-primary dnd-dialog-btn-confirm">${confirmText}</button>
          </div>
        </form>
      </div>
    `;

    container.appendChild(overlay);

    const inputField = overlay.querySelector('#dnd-dialog-input-field');
    const confirmBtn = overlay.querySelector('.dnd-dialog-btn-confirm');
    const cancelBtn = overlay.querySelector('.dnd-dialog-btn-cancel');
    const closeBtn = overlay.querySelector('.dnd-dialog-close-btn');

    // Botones de incremento/decremento rápido para números
    overlay.querySelectorAll('.btn-dialog-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const delta = parseInt(btn.dataset.delta, 10) || 0;
        let val = parseInt(inputField.value, 10);
        if (isNaN(val)) val = 0;
        val += delta;
        if (min !== undefined && val < min) val = min;
        if (max !== undefined && val > max) val = max;
        inputField.value = val;
        inputField.focus();
      });
    });

    function cleanup(result) {
      overlay.classList.add('dnd-dialog-closing');
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(result);
      }, 140);
    }

    function handleConfirm() {
      cleanup(inputField.value);
    }

    function handleCancel() {
      cleanup(null);
    }

    confirmBtn.addEventListener('click', handleConfirm);
    if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
    if (closeBtn) closeBtn.addEventListener('click', handleCancel);

    // Cerrar al pulsar sobre el fondo oscuro
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) handleCancel();
    });

    // Control de teclado
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    });

    // Foco automático e iluminación del texto
    setTimeout(() => {
      if (inputField) {
        inputField.focus();
        inputField.select();
      }
    }, 50);
  });
}

/**
 * Diálogo para confirmación de acciones críticas (sustituto estilizado de confirm)
 */
export function showConfirm({
  title = 'Confirmar Acción',
  message = '',
  messageHtml = '',
  icon = '⚠️',
  iconHtml = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDanger = false
} = {}) {
  return new Promise((resolve) => {
    const container = getDialogContainer();

    const formattedMessage = messageHtml || (message ? `<p class="dnd-dialog-message">${message.replace(/\n/g, '<br>')}</p>` : '');

    const overlay = document.createElement('div');
    overlay.className = 'dnd-dialog-overlay';
    overlay.innerHTML = `
      <div class="dnd-dialog-card ${isDanger ? 'dialog-danger' : ''}" role="dialog" aria-modal="true">
        <div class="dnd-dialog-header">
          <div class="dnd-dialog-title-group">
            <span class="dnd-dialog-icon">${iconHtml || icon}</span>
            <h3 class="dnd-dialog-title">${title}</h3>
          </div>
          <button type="button" class="dnd-dialog-close-btn" title="Cerrar">&times;</button>
        </div>

        <div class="dnd-dialog-body">
          ${formattedMessage}
        </div>

        <div class="dnd-dialog-footer">
          <button type="button" class="btn btn-secondary dnd-dialog-btn-cancel">${cancelText}</button>
          <button type="button" class="btn ${isDanger ? 'btn-danger' : 'btn-primary'} dnd-dialog-btn-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    container.appendChild(overlay);

    const confirmBtn = overlay.querySelector('.dnd-dialog-btn-confirm');
    const cancelBtn = overlay.querySelector('.dnd-dialog-btn-cancel');
    const closeBtn = overlay.querySelector('.dnd-dialog-close-btn');

    function cleanup(result) {
      overlay.classList.add('dnd-dialog-closing');
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(result);
      }, 140);
    }

    confirmBtn.addEventListener('click', () => cleanup(true));
    if (cancelBtn) cancelBtn.addEventListener('click', () => cleanup(false));
    if (closeBtn) closeBtn.addEventListener('click', () => cleanup(false));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });

    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        cleanup(true);
      }
    });

    setTimeout(() => {
      if (confirmBtn) confirmBtn.focus();
    }, 50);
  });
}

/**
 * Diálogo para notificaciones y alertas estilizadas (sustituto estilizado de alert)
 */
export function showAlert({
  title = 'Aviso',
  message = '',
  messageHtml = '',
  icon = '',
  iconHtml = '',
  confirmText = 'Entendido',
  type = 'info'
} = {}) {
  return new Promise((resolve) => {
    const container = getDialogContainer();

    const typeIcons = {
      info: 'ℹ️',
      success: '✨',
      warning: '⚠️',
      danger: '❌'
    };

    const finalIcon = iconHtml || icon || typeIcons[type] || 'ℹ️';
    const formattedMessage = messageHtml || (message ? `<p class="dnd-dialog-message">${message.replace(/\n/g, '<br>')}</p>` : '');

    const overlay = document.createElement('div');
    overlay.className = 'dnd-dialog-overlay';
    overlay.innerHTML = `
      <div class="dnd-dialog-card dialog-${type}" role="dialog" aria-modal="true">
        <div class="dnd-dialog-header">
          <div class="dnd-dialog-title-group">
            <span class="dnd-dialog-icon">${finalIcon}</span>
            <h3 class="dnd-dialog-title">${title}</h3>
          </div>
          <button type="button" class="dnd-dialog-close-btn" title="Cerrar">&times;</button>
        </div>

        <div class="dnd-dialog-body">
          ${formattedMessage}
        </div>

        <div class="dnd-dialog-footer">
          <button type="button" class="btn btn-primary dnd-dialog-btn-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    container.appendChild(overlay);

    const confirmBtn = overlay.querySelector('.dnd-dialog-btn-confirm');
    const closeBtn = overlay.querySelector('.dnd-dialog-close-btn');

    function cleanup() {
      overlay.classList.add('dnd-dialog-closing');
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve();
      }, 140);
    }

    confirmBtn.addEventListener('click', cleanup);
    if (closeBtn) closeBtn.addEventListener('click', cleanup);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup();
    });

    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        cleanup();
      }
    });

    setTimeout(() => {
      if (confirmBtn) confirmBtn.focus();
    }, 50);
  });
}
