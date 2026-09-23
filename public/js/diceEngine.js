/**
 * Motor de Tirada de Dados e Historial de Partida (D&D 2024)
 */

export const diceEngine = {
  history: [],

  roll(count, faces, modifier = 0, label = 'Tirada', details = '') {
    const rolls = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * faces) + 1);
    }

    const diceTotal = rolls.reduce((acc, v) => acc + v, 0);
    const total = diceTotal + modifier;

    let isCritSuccess = false;
    let isCritFail = false;
    if (faces === 20 && count === 1) {
      if (rolls[0] === 20) isCritSuccess = true;
      if (rolls[0] === 1) isCritFail = true;
    }

    const entry = {
      id: 'roll_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      label,
      details,
      diceCount: count,
      diceFaces: faces,
      rolls,
      modifier,
      diceTotal,
      total,
      isCritSuccess,
      isCritFail
    };

    this.history.unshift(entry);
    if (this.history.length > 50) this.history.pop();

    // Notificación visual flotante rápida
    this.showFloatingRollNotification(entry);

    // Notificar a listeners si los hay
    window.dispatchEvent(new CustomEvent('dnd-dice-rolled', { detail: entry }));

    return entry;
  },

  rollD20(modifier = 0, label = 'Prueba d20', details = '') {
    return this.roll(1, 20, modifier, label, details);
  },

  rollDamage(diceCount, diceFaces, modifier = 0, label = 'Tirada de Daño', damageType = '') {
    const detailText = damageType ? `Tipo: ${damageType}` : '';
    return this.roll(diceCount, diceFaces, modifier, label, detailText);
  },

  clearHistory() {
    this.history = [];
    window.dispatchEvent(new CustomEvent('dnd-dice-cleared'));
  },

  showFloatingRollNotification(entry) {
    let container = document.getElementById('dice-notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'dice-notification-container';
      container.className = 'dice-notification-container';
      document.body.appendChild(container);
    }

    const card = document.createElement('div');
    card.className = `dice-popup ${entry.isCritSuccess ? 'crit-success' : ''} ${entry.isCritFail ? 'crit-fail' : ''}`;

    let formula = `${entry.diceCount}d${entry.diceFaces}`;
    if (entry.modifier > 0) formula += ` + ${entry.modifier}`;
    else if (entry.modifier < 0) formula += ` - ${Math.abs(entry.modifier)}`;

    const rollsStr = entry.rolls.length > 1 ? `(${entry.rolls.join(' + ')})` : `[${entry.rolls[0]}]`;

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: bold; font-size: 0.85rem; color: var(--gold); text-transform: uppercase;">🎲 ${entry.label}</span>
        <span style="font-size: 0.7rem; color: var(--text-muted);">${entry.timestamp}</span>
      </div>
      ${entry.details ? `<div style="font-size: 0.75rem; color: #94a3b8; margin: 0.15rem 0;">${entry.details}</div>` : ''}
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 0.35rem;">
        <span style="font-size: 0.8rem; color: var(--text-muted);">${formula}: ${rollsStr}</span>
        <span style="font-size: 1.4rem; font-weight: 850; color: ${entry.isCritSuccess ? '#4ade80' : entry.isCritFail ? '#f87171' : 'var(--gold)'};">
          ${entry.total}
        </span>
      </div>
      ${entry.isCritSuccess ? '<div style="font-size: 0.72rem; color: #4ade80; font-weight: bold;">⭐ ¡Impacto Crítico Natural 20!</div>' : ''}
      ${entry.isCritFail ? '<div style="font-size: 0.72rem; color: #f87171; font-weight: bold;">💀 ¡Pifia Natural 1!</div>' : ''}
    `;

    container.appendChild(card);

    setTimeout(() => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(-10px)';
      card.style.transition = 'all 0.3s ease';
      setTimeout(() => card.remove(), 300);
    }, 4500);
  }
};
