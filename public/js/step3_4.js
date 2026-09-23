import { state } from './state.js';
import * as Rules from '/src/engine/rulesEngine.js';

export function renderStep3(c) {
  const alignments = state.catalogs.rules.alignments;
  c.innerHTML = `
    <div class="step-header">
      <h2 class="step-title">Paso 3: Concepto, Nivel y Alineamiento</h2>
      <p class="step-desc">Define la identidad básica de tu personaje según el Capítulo 2 del manual.</p>
    </div>

    <div class="form-group">
      <label class="form-label" for="char-name">Nombre del Personaje *</label>
      <input type="text" id="char-name" class="input-text" placeholder="Ej. Gareth, Mirabella, Vaelin..." value="${state.draft.name || ''}" oninput="window.app.updateDraftField('name', this.value)">
      <p class="form-help">El nombre de tu avatar en el multiverso de D&D.</p>
    </div>

    <div class="form-group">
      <label class="form-label" for="char-level">Nivel Inicial (Regla oficial: Nivel 1 por defecto)</label>
      <input type="number" id="char-level" class="input-text" style="max-width: 150px;" min="1" max="20" value="${state.draft.level}" onchange="window.app.updateDraftField('level', parseInt(this.value) || 1)">
      <p class="form-help">Si tu DM inicia en nivel superior, las subclases se desbloquean a partir del nivel 3.</p>
    </div>

    <div class="form-group">
      <label class="form-label">Alineamiento Ético y Moral *</label>
      <div class="cards-grid">
        ${alignments.map(a => `
          <div class="selection-card ${state.draft.alignment === a.id ? 'selected' : ''}" onclick="window.app.updateDraftField('alignment', '${a.id}')">
            <div class="card-header">
              <span class="card-title">${a.name} (${a.id})</span>
            </div>
            <div class="card-body">${a.desc}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="form-group" style="margin-top: 2rem;">
      <label class="form-label">Detalles Personales Opcionales</label>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div>
          <label class="form-label" style="font-size: 0.8rem;">Género / Pronombres</label>
          <input type="text" id="char-gender" class="input-text" placeholder="Ej. Masculino, Femenino, No binario..." value="${state.draft.gender || ''}" oninput="window.app.updateDraftField('gender', this.value)">
        </div>
        <div>
          <label class="form-label" style="font-size: 0.8rem;">Aspecto Físico</label>
          <input type="text" id="char-appearance" class="input-text" placeholder="Ej. Ojos dorados, cicatriz, porte atlético..." value="${state.draft.appearance || ''}" oninput="window.app.updateDraftField('appearance', this.value)">
        </div>
      </div>
    </div>

    <div class="step-footer">
      <button class="btn btn-secondary" onclick="window.app.goToStep(2)">&larr; Anterior: Origen</button>
      <button class="btn btn-primary" onclick="window.app.goToStep(4)">Siguiente: Características &rarr;</button>
    </div>
  `;
}

export function renderStep4(c) {
  const bgDef = state.catalogs.backgrounds.find(b => b.id === state.draft.backgroundId);
  const abilities = state.catalogs.rules.abilities;
  const finalAbs = Rules.calculateFinalAbilities(state.draft.baseAbilityScores, state.draft.backgroundAbilityBonus);
  const method = state.draft.abilityGenerationMethod;
  const pointBuyBudget = 27;

  let spentPoints = 0;
  if (method === 'point_buy') {
    const costs = state.catalogs.rules.pointBuyCosts;
    for (const ab of abilities) {
      const score = state.draft.baseAbilityScores[ab.id] || 8;
      spentPoints += (costs[score.toString()] || 0);
    }
  }

  // Seguimiento de valores de Conjunto Estándar
  const standardArrayValues = [15, 14, 13, 12, 10, 8];
  const assignedValues = abilities
    .map(ab => Number(state.draft.baseAbilityScores[ab.id]) || 0)
    .filter(val => val > 0);
  const unassignedValues = standardArrayValues.filter(val => !assignedValues.includes(val));

  c.innerHTML = `
    <div class="step-header">
      <h2 class="step-title">Paso 4: Puntuaciones de Característica</h2>
      <p class="step-desc">Genera y asigna las 6 características de tu personaje y aplica las mejoras de tu trasfondo.</p>
    </div>

    <div class="form-group">
      <label class="form-label">Método de Generación Oficial:</label>
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <input type="radio" name="genMethod" value="standard_array" ${method === 'standard_array' ? 'checked' : ''} onchange="window.app.setGenerationMethod('standard_array')">
          <span>Conjunto Estándar (15, 14, 13, 12, 10, 8)</span>
        </label>
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <input type="radio" name="genMethod" value="point_buy" ${method === 'point_buy' ? 'checked' : ''} onchange="window.app.setGenerationMethod('point_buy')">
          <span>Compra por Puntos (27 puntos)</span>
        </label>
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <input type="radio" name="genMethod" value="roll" ${method === 'roll' ? 'checked' : ''} onchange="window.app.setGenerationMethod('roll')">
          <span>Tirada Aleatoria (4d6 descartar menor)</span>
        </label>
      </div>
    </div>

    ${method === 'standard_array' ? `
      <div class="alert-box ${unassignedValues.length === 0 ? 'alert-success' : 'alert-warning'}">
        <strong>Conjunto Estándar:</strong> ${unassignedValues.length === 0 
          ? '¡Todos los valores [15, 14, 13, 12, 10, 8] han sido asignados correctamente!' 
          : `Valores pendientes por asignar: <strong>${unassignedValues.join(', ')}</strong> (${6 - unassignedValues.length}/6 asignados).`}
      </div>
    ` : ''}

    ${method === 'point_buy' ? `
      <div class="alert-box ${spentPoints === 27 ? 'alert-success' : 'alert-warning'}">
        <strong>Puntos gastados:</strong> ${spentPoints} / ${pointBuyBudget} puntos.
        ${spentPoints !== 27 ? '(Debes gastar exactamente 27 puntos)' : '¡Presupuesto exacto cumplido!'}
      </div>
    ` : ''}

    ${method === 'roll' ? `
      <div style="margin-bottom: 1rem;">
        <button class="btn btn-secondary" onclick="window.app.rollRandomScores()">🎲 Tirar 4d6 para las 6 características</button>
      </div>
    ` : ''}

    <div class="stats-grid" style="margin-top: 1.5rem;">
      ${abilities.map(ab => {
        const data = finalAbs[ab.id];
        const currentBase = Number(state.draft.baseAbilityScores[ab.id]) || 0;
        const bgBonus = state.draft.backgroundAbilityBonus[ab.id] || 0;
        const takenByOthers = new Set(
          abilities
            .filter(other => other.id !== ab.id && (Number(state.draft.baseAbilityScores[other.id]) || 0) > 0)
            .map(other => Number(state.draft.baseAbilityScores[other.id]))
        );

        return `
          <div class="stat-box">
            <span class="stat-name">${ab.name}</span>
            <span class="stat-mod">${currentBase > 0 ? (data.mod >= 0 ? '+' : '') + data.mod : '--'}</span>
            <span class="stat-score">Total: ${currentBase > 0 ? data.score : '--'}</span>
            ${bgBonus ? `<span class="stat-bonus-badge">+${bgBonus} Trasfondo</span>` : ''}

            <div style="margin-top: 0.75rem; width: 100%;">
              ${method === 'point_buy' ? `
                <div style="display: flex; justify-content: center; align-items: center; gap: 0.5rem;">
                  <button class="btn btn-secondary" style="padding: 0.2rem 0.5rem;" onclick="window.app.adjustPointBuy('${ab.id}', -1)">-</button>
                  <span style="font-weight: bold;">${data.base}</span>
                  <button class="btn btn-secondary" style="padding: 0.2rem 0.5rem;" onclick="window.app.adjustPointBuy('${ab.id}', 1)">+</button>
                </div>
              ` : method === 'standard_array' ? `
                <select class="select-box" style="font-size: 0.85rem; padding: 0.35rem;" onchange="window.app.updateBaseScore('${ab.id}', parseInt(this.value))">
                  <option value="0" ${currentBase === 0 ? 'selected' : ''}>-- Seleccionar (0) --</option>
                  ${standardArrayValues.map(v => {
                    const isTaken = takenByOthers.has(v);
                    const isSelected = currentBase === v;
                    return `<option value="${v}" ${isSelected ? 'selected' : ''} ${isTaken ? 'disabled style="color: #64748b;"' : ''}>${v}${isTaken ? ' (Asignado)' : ''}</option>`;
                  }).join('')}
                </select>
              ` : `
                <input type="number" id="base-score-${ab.id}" class="input-text" style="font-size: 0.85rem; padding: 0.3rem; text-align: center;" min="3" max="18" value="${data.base}" onchange="window.app.updateBaseScore('${ab.id}', parseInt(this.value))">
              `}
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div style="margin-top: 2rem; padding: 1.5rem; background-color: var(--bg-input); border-radius: 8px; border: 1px solid var(--border-color);">
      <h3 style="color: var(--gold); margin-bottom: 0.5rem;">Aumentos de Característica por Trasfondo</h3>
      ${bgDef ? `
        <p class="form-help" style="margin-bottom: 1rem;">
          Tu trasfondo (<strong>${bgDef.name}</strong>) te permite aumentar entre:
          <strong>${bgDef.abilities.map(a => a.toUpperCase()).join(', ')}</strong>.
          <br>Distribuye <strong>+2 a una y +1 a otra</strong>, o <strong>+1 a las tres</strong> (máximo final 20).
        </p>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
          ${bgDef.abilities.map(abKey => {
            const currentBonus = state.draft.backgroundAbilityBonus[abKey] || 0;
            return `
              <div>
                <label class="form-label" style="text-transform: capitalize;">${abKey}</label>
                <select class="select-box" onchange="window.app.setBackgroundBonus('${abKey}', parseInt(this.value))">
                  <option value="0" ${currentBonus === 0 ? 'selected' : ''}>+0</option>
                  <option value="1" ${currentBonus === 1 ? 'selected' : ''}>+1</option>
                  <option value="2" ${currentBonus === 2 ? 'selected' : ''}>+2</option>
                </select>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="alert-box alert-warning">Debes seleccionar primero un trasfondo en el Paso 2 (Origen).</div>
      `}
    </div>

    <div class="step-footer">
      <button class="btn btn-secondary" onclick="window.app.goToStep(3)">&larr; Anterior: Concepto</button>
      <button class="btn btn-primary" onclick="window.app.goToStep(5)">Siguiente: Opciones de Clase &rarr;</button>
    </div>
  `;
}
