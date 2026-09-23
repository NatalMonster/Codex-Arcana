import { state } from './state.js';
import * as Rules from '/src/engine/rulesEngine.js';
import { validateCharacter } from '/src/engine/validator.js';

export function renderStep7(c) {
  const classDef = state.catalogs.classes.find(cl => cl.id === state.draft.classId);
  const bgDef = state.catalogs.backgrounds.find(b => b.id === state.draft.backgroundId);
  const trinkets = state.catalogs.equipment.trinkets;

  c.innerHTML = `
    <div class="step-header">
      <h2 class="step-title">Paso 7: Equipo Inicial</h2>
      <p class="step-desc">Escoge los paquetes de equipo inicial garantizados por tu clase y trasfondo.</p>
    </div>

    <div class="form-group">
      <h3 style="color: var(--gold); margin-bottom: 0.75rem;">1. Equipo de Clase (${classDef ? classDef.name : ''})</h3>
      ${classDef ? `
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${Object.entries(classDef.equipmentOptions).map(([key, opt]) => `
            <div class="selection-card ${state.draft.classEquipmentChoice === key ? 'selected' : ''}" onclick="window.app.updateDraftField('classEquipmentChoice', '${key}')">
              <div class="card-title" style="font-size: 1.05rem;">Opción (${key})</div>
              <div class="card-body">${opt.desc}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <div class="form-group" style="margin-top: 2rem;">
      <h3 style="color: var(--gold); margin-bottom: 0.75rem;">2. Equipo de Trasfondo (${bgDef ? bgDef.name : ''})</h3>
      ${bgDef ? `
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${Object.entries(bgDef.equipmentOptions).map(([key, opt]) => `
            <div class="selection-card ${state.draft.backgroundEquipmentChoice === key ? 'selected' : ''}" onclick="window.app.updateDraftField('backgroundEquipmentChoice', '${key}')">
              <div class="card-title" style="font-size: 1.05rem;">Opción (${key})</div>
              <div class="card-body">${opt.desc}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <div class="form-group" style="margin-top: 2rem;">
      <h3 style="color: var(--gold); margin-bottom: 0.5rem;">3. Bagatela Opcional (Gratuita de la Tabla de Bagatelas)</h3>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <select class="select-box" onchange="window.app.updateDraftField('trinket', this.value)">
          <option value="">-- Selecciona o tira una bagatela --</option>
          ${trinkets.map(tr => `
            <option value="${tr}" ${state.draft.trinket === tr ? 'selected' : ''}>${tr}</option>
          `).join('')}
        </select>
        <button class="btn btn-secondary" onclick="window.app.rollRandomTrinket()">🎲 Al azar</button>
      </div>
    </div>

    <div class="step-footer">
      <button class="btn btn-secondary" onclick="window.app.goToStep(6)">&larr; Anterior</button>
      <button class="btn btn-primary" onclick="window.app.goToStep(8)">Siguiente: Revisión &rarr;</button>
    </div>
  `;
}

export function renderStep8(c) {
  const validation = validateCharacter(state.draft, state.catalogs);
  const classDef = state.catalogs.classes.find(cl => cl.id === state.draft.classId);
  const speciesDef = state.catalogs.species.find(s => s.id === state.draft.speciesId);
  const bgDef = state.catalogs.backgrounds.find(b => b.id === state.draft.backgroundId);
  const abs = Rules.calculateFinalAbilities(state.draft.baseAbilityScores, state.draft.backgroundAbilityBonus);
  const pb = Rules.calculateProficiencyBonus(state.draft.level);
  const conMod = abs.constitucion.mod;
  const dexMod = abs.destreza.mod;
  const wisMod = abs.sabiduria.mod;

  const featIds = [];
  if (bgDef) featIds.push(bgDef.originFeatId);
  if (state.draft.humanBonusOriginFeat) featIds.push(state.draft.humanBonusOriginFeat);

  const maxHp = Rules.calculateHitPoints({ classDef, conMod, level: state.draft.level, speciesDef, featIds });
  const init = Rules.calculateInitiative(dexMod, featIds, pb);
  const ac = Rules.calculateArmorClass({ classDef, dexMod, conMod, wisMod, fightingStyle: state.draft.fightingStyle });

  const isPerceptionProf = (bgDef && bgDef.skills.includes('percepcion')) ||
    state.draft.classSkills.includes('percepcion') ||
    (speciesDef && speciesDef.fixedSkills && speciesDef.fixedSkills.includes('percepcion')) ||
    state.draft.humanBonusSkill === 'percepcion';
  const hasPerceptionExp = state.draft.expertise && state.draft.expertise.includes('percepcion');
  const passivePerc = Rules.calculatePassivePerception(wisMod, isPerceptionProf, hasPerceptionExp, pb);

  const spellStats = Rules.calculateSpellcastingStats(classDef, abs, pb);

  c.innerHTML = `
    <div class="step-header">
      <h2 class="step-title">Paso 8: Revisión Integral y Validación</h2>
      <p class="step-desc">Verifica que todos los datos y reglas obligatorias sean válidos antes de guardar tu personaje.</p>
    </div>

    <div style="margin-bottom: 2rem;">
      ${validation.valid ? `
        <div class="alert-box alert-success">
          <strong>✔ ¡Personaje completamente válido!</strong> Cumple con todas las reglas y restricciones del Manual del Jugador 2024. Puedes guardarlo.
        </div>
      ` : `
        <div class="alert-box alert-error">
          <h4 style="margin-bottom: 0.5rem;">⚠ El personaje no puede crearse todavía. Corrige los siguientes elementos:</h4>
          <ul style="margin-left: 1.5rem;">
            ${validation.errors.map(err => `
              <li style="margin-bottom: 0.25rem;">
                <a href="#" onclick="window.app.goToStep(${err.step}); return false;" style="color: #fca5a5; text-decoration: underline;">
                  [Paso ${err.step}] ${err.message}
                </a>
              </li>
            `).join('')}
          </ul>
        </div>
      `}
    </div>

    <div style="background-color: var(--bg-input); border: 2px solid var(--gold); border-radius: 10px; padding: 1.5rem;">
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
        <div>
          <h2 style="color: var(--gold); font-size: 1.75rem;">${state.draft.name || 'Sin Nombre'}</h2>
          <p style="color: var(--text-muted); font-size: 0.95rem;">
            ${speciesDef ? speciesDef.name : '?'} • ${classDef ? classDef.name : '?'} Nivel ${state.draft.level} • ${bgDef ? bgDef.name : '?'} • ${state.draft.alignment}
          </p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 1.25rem; font-weight: bold; color: var(--green);">+${pb} Bonificador Competencia</div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">Tamaño: ${state.draft.size || (speciesDef ? speciesDef.defaultSize : 'Mediano')}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; text-align: center;">
        <div style="background: #1e293b; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-color);">
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Clase de Armadura</span>
          <div style="font-size: 1.75rem; font-weight: bold; color: var(--gold);">${ac}</div>
        </div>
        <div style="background: #1e293b; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-color);">
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Puntos de Golpe</span>
          <div style="font-size: 1.75rem; font-weight: bold; color: var(--crimson);">${maxHp}</div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">1d${classDef ? classDef.hitDie : 8}</span>
        </div>
        <div style="background: #1e293b; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-color);">
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Iniciativa</span>
          <div style="font-size: 1.75rem; font-weight: bold; color: var(--blue);">${init >= 0 ? '+' : ''}${init}</div>
        </div>
        <div style="background: #1e293b; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-color);">
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Percepción Pasiva</span>
          <div style="font-size: 1.75rem; font-weight: bold; color: var(--purple);">${passivePerc}</div>
        </div>
      </div>

      <div class="stats-grid" style="margin-bottom: 1.5rem;">
        ${Object.entries(abs).map(([key, data]) => `
          <div class="stat-box">
            <span class="stat-name">${key.substring(0, 3)}</span>
            <span class="stat-mod">${data.base > 0 ? (data.mod >= 0 ? '+' : '') + data.mod : '--'}</span>
            <span class="stat-score">${data.base > 0 ? data.score : '--'}</span>
          </div>
        `).join('')}
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; font-size: 0.9rem;">
        <div>
          <h4 style="color: var(--gold); border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem; margin-bottom: 0.5rem;">Competencias</h4>
          <p><strong>Habilidades:</strong> ${[...state.draft.classSkills, ...(bgDef ? bgDef.skills : [])].join(', ') || 'Ninguna'}</p>
          <p><strong>Salvaciones:</strong> ${classDef ? classDef.savingThrows.map(s => s.toUpperCase()).join(', ') : ''}</p>
          <p><strong>Idiomas:</strong> ${state.draft.languages.join(', ')}</p>
          <p><strong>Herramientas:</strong> ${bgDef ? bgDef.toolName : ''}</p>
        </div>
        <div>
          <h4 style="color: var(--gold); border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem; margin-bottom: 0.5rem;">Rasgos y Magia</h4>
          ${spellStats ? `
            <p><strong>Aptitud mágica:</strong> ${spellStats.ability.toUpperCase()}</p>
            <p><strong>CD Salvación de conjuros:</strong> ${spellStats.saveDc}</p>
            <p><strong>Bono de Ataque mágico:</strong> +${spellStats.attackBonus}</p>
            <p><strong>Trucos (Nivel 0):</strong> ${state.draft.cantrips.map(c => `${c} [Truco]`).join(', ') || 'Ninguno'}</p>
            <p><strong>Conjuros preparados (Nivel 1):</strong> ${state.draft.preparedSpells.map(s => `${s} [Nv 1]`).join(', ') || 'Ninguno'}</p>
            ${state.draft.spellbook && state.draft.spellbook.length > 0 ? `
              <p><strong>Libro de conjuros (Nivel 1):</strong> ${state.draft.spellbook.map(s => `${s} [Nv 1]`).join(', ')}</p>
            ` : ''}
          ` : `
            <p><em>Esta clase no lanza conjuros a nivel 1.</em></p>
          `}
          <p><strong>Maestrías con armas:</strong> ${state.draft.weaponMasteries.join(', ') || 'Ninguna'}</p>
        </div>
      </div>
    </div>

    <div class="step-footer" style="justify-content: flex-end; gap: 1rem;">
      <button class="btn btn-secondary" onclick="window.app.goToStep(7)">&larr; Volver al Equipo</button>
      <button class="btn btn-success" ${!validation.valid ? 'disabled' : ''} onclick="window.app.finalizeCharacter()">
        ✨ [CREAR Y GUARDAR PERSONAJE]
      </button>
    </div>
  `;
}
