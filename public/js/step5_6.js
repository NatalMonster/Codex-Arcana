import { state } from './state.js';
import { getSpellDetail, getSkillDetail, getFeatDetail, getMasteryDetail, getSpellLevelLabel } from './infoHelper.js';
import * as Rules from '/src/engine/rulesEngine.js';

export function renderStep5(c) {
  const classDef = state.catalogs.classes.find(cl => cl.id === state.draft.classId);
  const bgDef = state.catalogs.backgrounds.find(b => b.id === state.draft.backgroundId);
  const allSkills = state.catalogs.rules.skills;
  const weapons = state.catalogs.equipment.weapons;
  const fightingStyles = state.catalogs.feats.filter(f => f.category === 'Estilo de combate');
  const originFeats = state.catalogs.feats.filter(f => f.category === 'Origen');
  const pb = Rules.calculateProficiencyBonus(state.draft.level);

  if (!classDef) {
    c.innerHTML = `<div class="alert-box alert-error">Selecciona primero una clase en el Paso 1.</div>`;
    return;
  }

  const eligibleSkills = classDef.skillPool === 'all'
    ? allSkills
    : allSkills.filter(s => classDef.skillPool.includes(s.id));

  // Datos para los bonus de humano si aplican
  const selectedHumanSkill = state.draft.humanBonusSkill ? allSkills.find(s => s.id === state.draft.humanBonusSkill) : null;
  const selectedHumanFeat = state.draft.humanBonusOriginFeat ? originFeats.find(f => f.id === state.draft.humanBonusOriginFeat) : null;

  c.innerHTML = `
    <div class="step-header">
      <h2 class="step-title">Paso 5: Competencias y Opciones de Clase</h2>
      <p class="step-desc">Personaliza las competencias y rasgos de nivel 1 que te otorga tu clase y especie. Haz clic en <strong>ℹ️ Info</strong> para desplegar los detalles de cualquier opción.</p>
    </div>

    <!-- HABILIDADES DE CLASE -->
    <div class="form-group">
      <label class="form-label">
        Competencias en Habilidades de Clase (Elige exactamente ${classDef.skillCount}):
      </label>
      <p class="form-help" style="margin-bottom: 0.75rem;">Las habilidades marcadas en gris ya las obtuviste por tu trasfondo y no se pueden duplicar.</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem;">
        ${eligibleSkills.map(s => {
          const isFromBg = bgDef && bgDef.skills.includes(s.id);
          const isChecked = state.draft.classSkills.includes(s.id);
          const drawerId = `drawer-skill-${s.id}`;
          return `
            <div class="expandable-option ${isChecked ? 'selected' : ''}" style="opacity: ${isFromBg ? 0.45 : 1};">
              <div class="option-row">
                <label class="option-label" style="cursor: ${isFromBg ? 'not-allowed' : 'pointer'};">
                  <input type="checkbox" value="${s.id}" ${isChecked ? 'checked' : ''} ${isFromBg ? 'disabled' : ''} onchange="window.app.toggleClassSkill('${s.id}', this.checked)">
                  <span>
                    <strong>${s.name}</strong>
                    <small style="color: var(--text-muted); text-transform: uppercase;">(${s.ability ? s.ability.substring(0,3) : ''})</small>
                    ${isFromBg ? '<em style="font-size: 0.75rem; color: var(--gold); display: block;">(Ya otorgada por Trasfondo)</em>' : ''}
                  </span>
                </label>
                <button type="button" class="btn-info" data-target="${drawerId}" onclick="event.stopPropagation(); window.app.toggleOptionDetail('${drawerId}')" title="Ver qué hace esta habilidad">ℹ️ Info</button>
              </div>
              <div id="${drawerId}" class="option-drawer hidden">
                <div class="drawer-header">
                  <span class="drawer-title">${s.name}</span>
                  <span class="drawer-type">Característica: ${(s.ability || '').toUpperCase()}</span>
                </div>
                <div class="drawer-desc">${s.desc || 'Prueba de característica para llevar a cabo actividades relacionadas con esta disciplina.'}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- HUMANO: RASGO VERSÁTIL -->
    ${state.draft.speciesId === 'humano' ? `
      <div style="margin-top: 2rem; padding: 1.25rem; background-color: var(--bg-input); border-radius: 8px; border: 1px solid var(--border-color);">
        <h4 style="color: var(--gold); margin-bottom: 0.5rem;">Rasgos Adicionales de Humano (Habilidoso y Versátil)</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label class="form-label">1 Habilidad Adicional a Elección:</label>
            <select class="select-box" onchange="window.app.updateDraftField('humanBonusSkill', this.value)">
              <option value="">-- Selecciona 1 habilidad --</option>
              ${allSkills.map(s => `
                <option value="${s.id}" ${state.draft.humanBonusSkill === s.id ? 'selected' : ''}>${s.name} (${s.ability.toUpperCase()})</option>
              `).join('')}
            </select>
            ${selectedHumanSkill ? `
              <div class="option-drawer" style="margin-top: 0.5rem;">
                <div class="drawer-header">
                  <span class="drawer-title">${selectedHumanSkill.name}</span>
                  <span class="drawer-type">${selectedHumanSkill.ability.toUpperCase()}</span>
                </div>
                <div class="drawer-desc">${selectedHumanSkill.desc}</div>
              </div>
            ` : ''}
          </div>
          <div>
            <label class="form-label">1 Dote de Origen Adicional (Versátil):</label>
            <select class="select-box" onchange="window.app.updateDraftField('humanBonusOriginFeat', this.value)">
              <option value="">-- Selecciona 1 dote de origen --</option>
              ${originFeats.map(f => `
                <option value="${f.id}" ${state.draft.humanBonusOriginFeat === f.id ? 'selected' : ''}>${f.name}</option>
              `).join('')}
            </select>
            ${selectedHumanFeat ? `
              <div class="option-drawer" style="margin-top: 0.5rem;">
                <div class="drawer-header">
                  <span class="drawer-title">${selectedHumanFeat.name}</span>
                  <span class="drawer-type">Dote de Origen</span>
                </div>
                <div class="drawer-desc">${selectedHumanFeat.desc}</div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    ` : ''}

    <!-- MAESTRÍA CON ARMAS -->
    ${classDef.weaponMasteryCount > 0 ? `
      <div class="form-group" style="margin-top: 2rem;">
        <label class="form-label">
          Maestría con Armas (Elige exactamente ${classDef.weaponMasteryCount} armas):
        </label>
        <p class="form-help" style="margin-bottom: 0.75rem;">Haz clic en <strong>ℹ️ Info</strong> para conocer las propiedades y el efecto de combate de cada propiedad de maestría.</p>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem;">
          ${weapons.filter(w => {
            if (classDef.weaponProficiencies.includes('marciales')) return true;
            if (classDef.weaponProficiencies.includes('sencillas') && w.type === 'sencilla') return true;
            return false;
          }).map(w => {
            const isChecked = state.draft.weaponMasteries.includes(w.id);
            const drawerId = `drawer-w-${w.id}`;
            const masteryInfo = getMasteryDetail(w.mastery, state.catalogs.rules);
            return `
              <div class="expandable-option ${isChecked ? 'selected' : ''}">
                <div class="option-row">
                  <label class="option-label">
                    <input type="checkbox" value="${w.id}" ${isChecked ? 'checked' : ''} onchange="window.app.toggleWeaponMastery('${w.id}', this.checked)">
                    <span>
                      <strong>${w.name}</strong>
                      <span style="color: var(--gold); font-size: 0.8rem; margin-left: 0.25rem;">[${w.mastery.toUpperCase()}]</span>
                    </span>
                  </label>
                  <button type="button" class="btn-info" data-target="${drawerId}" onclick="event.stopPropagation(); window.app.toggleOptionDetail('${drawerId}')" title="Ver propiedades y efecto de maestría">ℹ️ Info</button>
                </div>
                <div id="${drawerId}" class="option-drawer hidden">
                  <div class="drawer-header">
                    <span class="drawer-title">${w.name}</span>
                    <span class="drawer-type">${w.type === 'marcial' ? 'Arma Marcial' : 'Arma Sencilla'}</span>
                  </div>
                  <div class="drawer-pills">
                    <span class="drawer-pill">💥 Daño: ${w.damage}</span>
                    ${w.properties.map(p => `<span class="drawer-pill">${p}</span>`).join('')}
                    <span class="drawer-pill" style="color: #93c5fd;">⚖️ ${w.weight}</span>
                  </div>
                  <div class="drawer-desc">
                    <strong style="color: var(--gold);">Efecto de Maestría (${masteryInfo ? masteryInfo.name : w.mastery}):</strong>
                    ${masteryInfo ? masteryInfo.desc : 'Permite desatar la propiedad especial del arma al impactar en combate.'}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}

    <!-- OPCIÓN DE GUERRERO: ESTILO DE COMBATE -->
    ${classDef.id === 'guerrero' ? `
      <div class="form-group" style="margin-top: 2rem;">
        <label class="form-label">Estilo de Combate (Dote de nivel 1):</label>
        <div class="cards-grid">
          ${fightingStyles.map(fs => `
            <div class="selection-card ${state.draft.fightingStyle === fs.id ? 'selected' : ''}" onclick="window.app.updateDraftField('fightingStyle', '${fs.id}')">
              <div class="card-title" style="font-size: 1.05rem;">${fs.name}</div>
              <div class="card-body" style="margin-top: 0.4rem;">${fs.desc}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- OPCIÓN DE CLÉRIGO: ORDEN SAGRADA -->
    ${classDef.id === 'clerigo' ? `
      <div class="form-group" style="margin-top: 2rem;">
        <label class="form-label">Orden Sagrada (Rasgo de nivel 1):</label>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="selection-card ${state.draft.holyOrder === 'protector' ? 'selected' : ''}" onclick="window.app.updateDraftField('holyOrder', 'protector')">
            <div class="card-title" style="font-size: 1.1rem;">Protector</div>
            <div class="card-body" style="margin-top: 0.4rem;">Entrenamiento de combate: Obtienes entrenamiento con armaduras pesadas y competencia con todas las armas marciales.</div>
          </div>
          <div class="selection-card ${state.draft.holyOrder === 'taumaturgo' ? 'selected' : ''}" onclick="window.app.updateDraftField('holyOrder', 'taumaturgo')">
            <div class="card-title" style="font-size: 1.1rem;">Taumaturgo</div>
            <div class="card-body" style="margin-top: 0.4rem;">Erudición mística: Aprendes 1 truco adicional de clérigo y sumas tu modificador de Sabiduría a pruebas de Conocimiento arcano o Religión.</div>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- OPCIÓN DE DRUIDA: ORDEN PRIMIGENIA -->
    ${classDef.id === 'druida' ? `
      <div class="form-group" style="margin-top: 2rem;">
        <label class="form-label">Orden Primigenia (Rasgo de nivel 1):</label>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="selection-card ${state.draft.primalOrder === 'magisterio' ? 'selected' : ''}" onclick="window.app.updateDraftField('primalOrder', 'magisterio')">
            <div class="card-title" style="font-size: 1.1rem;">Magisterio</div>
            <div class="card-body" style="margin-top: 0.4rem;">Afinidad arcana: Aprendes 1 truco extra de druida y sumas tu modificador de Sabiduría a pruebas de Naturaleza o Trato con animales.</div>
          </div>
          <div class="selection-card ${state.draft.primalOrder === 'guardian' ? 'selected' : ''}" onclick="window.app.updateDraftField('primalOrder', 'guardian')">
            <div class="card-title" style="font-size: 1.1rem;">Guardián</div>
            <div class="card-body" style="margin-top: 0.4rem;">Defensa de la floresta: Obtienes entrenamiento con armaduras medias y competencia con armas marciales.</div>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- OPCIÓN DE BRUJO: INVOCACIÓN SOBRENATURAL -->
    ${classDef.id === 'brujo' ? `
      <div class="form-group" style="margin-top: 2rem;">
        <label class="form-label">Invocación Sobrenatural (Nivel 1):</label>
        <div class="cards-grid">
          <div class="selection-card ${state.draft.eldritchInvocation === 'pacto_grimorio' ? 'selected' : ''}" onclick="window.app.updateDraftField('eldritchInvocation', 'pacto_grimorio')">
            <div class="card-title" style="font-size: 1rem;">Pacto del grimorio</div>
            <div class="card-body" style="margin-top: 0.4rem;">Tu patrón te obsequia un Libro de las sombras. Aprendes 3 trucos adicionales y 2 conjuros rituales de nivel 1 de cualquier clase a tu elección.</div>
          </div>
          <div class="selection-card ${state.draft.eldritchInvocation === 'pacto_espada' ? 'selected' : ''}" onclick="window.app.updateDraftField('eldritchInvocation', 'pacto_espada')">
            <div class="card-title" style="font-size: 1rem;">Pacto de la espada</div>
            <div class="card-body" style="margin-top: 0.4rem;">Invocas un arma de pacto en tu mano vacía. Obtienes competencia con ella y puedes usar tu Carisma para las tiradas de ataque y daño en vez de Fuerza o Destreza.</div>
          </div>
          <div class="selection-card ${state.draft.eldritchInvocation === 'pacto_cadena' ? 'selected' : ''}" onclick="window.app.updateDraftField('eldritchInvocation', 'pacto_cadena')">
            <div class="card-title" style="font-size: 1rem;">Pacto de la cadena</div>
            <div class="card-body" style="margin-top: 0.4rem;">Aprendes el conjuro Encontrar familiar y puedes lanzarlo como ritual sin coste. Puedes invocar formas especiales mejoradas: diablillo, pseudodragón, quasit o duende.</div>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- OPCIÓN DE PÍCARO: EXPERIENCIA -->
    ${classDef.id === 'picaro' ? `
      <div class="form-group" style="margin-top: 2rem;">
        <label class="form-label">Experiencia / Pericia (Elige 2 habilidades o herramientas competentes):</label>
        <p class="form-help" style="margin-bottom: 0.75rem;">Tu bonificador por competencia (+${pb}) se duplica a <strong>+${pb * 2}</strong> en las dos seleccionadas.</p>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem;">
          ${[...state.draft.classSkills, ...(bgDef ? bgDef.skills : []), 'herramientas_ladron'].map(item => {
            const isChecked = state.draft.expertise.includes(item);
            const drawerId = `drawer-exp-${item}`;
            const skillObj = getSkillDetail(item, state.catalogs.rules);
            const itemName = item === 'herramientas_ladron' ? 'Herramientas de ladrón' : (skillObj ? skillObj.name : item);
            return `
              <div class="expandable-option ${isChecked ? 'selected' : ''}">
                <div class="option-row">
                  <label class="option-label">
                    <input type="checkbox" value="${item}" ${isChecked ? 'checked' : ''} onchange="window.app.toggleExpertise('${item}', this.checked)">
                    <span><strong>${itemName}</strong></span>
                  </label>
                  <button type="button" class="btn-info" data-target="${drawerId}" onclick="event.stopPropagation(); window.app.toggleOptionDetail('${drawerId}')" title="Ver detalles de pericia">ℹ️ Info</button>
                </div>
                <div id="${drawerId}" class="option-drawer hidden">
                  <div class="drawer-header">
                    <span class="drawer-title">${itemName}</span>
                    <span class="drawer-type">Bono duplicado (+${pb * 2})</span>
                  </div>
                  <div class="drawer-desc">
                    ${skillObj ? skillObj.desc : 'Herramientas indispensables para abrir cerraduras y desarmar trampas de aventurero.'}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}

    <div class="step-footer">
      <button class="btn btn-secondary" onclick="window.app.goToStep(4)">&larr; Anterior</button>
      <button class="btn btn-primary" onclick="window.app.goToStep(6)">Siguiente: Conjuros &rarr;</button>
    </div>
  `;
}

export function renderStep6(c) {
  const classDef = state.catalogs.classes.find(cl => cl.id === state.draft.classId);
  const spellsData = state.catalogs.spells[state.draft.classId];
  const spellsDatabase = state.catalogs.spellsDatabase;

  if (!classDef || !classDef.spellcasting || !spellsData) {
    c.innerHTML = `
      <div class="step-header">
        <h2 class="step-title">Paso 6: Conjuros</h2>
        <p class="step-desc">Gestión de magia y conjuros preparados.</p>
      </div>
      <div class="alert-box alert-warning">
        La clase <strong>${classDef ? classDef.name : 'seleccionada'}</strong> no dispone del rasgo de Lanzamiento de conjuros a Nivel 1.
        Puedes continuar directamente al siguiente paso.
      </div>
      <div class="step-footer">
        <button class="btn btn-secondary" onclick="window.app.goToStep(5)">&larr; Anterior</button>
        <button class="btn btn-primary" onclick="window.app.goToStep(7)">Siguiente: Equipo &rarr;</button>
      </div>
    `;
    return;
  }

  let requiredCantrips = classDef.spellcasting.cantripsKnown || 0;
  if (classDef.id === 'clerigo' && state.draft.holyOrder === 'taumaturgo') requiredCantrips += 1;
  if (classDef.id === 'druida' && state.draft.primalOrder === 'magisterio') requiredCantrips += 1;

  c.innerHTML = `
    <div class="step-header">
      <h2 class="step-title">Paso 6: Conjuros de ${classDef.name}</h2>
      <p class="step-desc">Aptitud mágica: <strong>${classDef.spellcasting.ability.toUpperCase()}</strong>. Espacios de nivel 1: <strong>${classDef.spellcasting.spellSlots['1']}</strong>. Haz clic en <strong>ℹ️ Info</strong> para desplegar la descripción completa, alcance, tiempo y componentes de cada conjuro.</p>
    </div>

    ${requiredCantrips > 0 ? `
      <div class="form-group">
        <label class="form-label">Trucos Conocidos (Elige exactamente ${requiredCantrips}):</label>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 0.75rem;">
          ${spellsData.cantrips.map((sp, idx) => {
            const isChecked = state.draft.cantrips.includes(sp);
            const spDetail = getSpellDetail(sp, spellsDatabase);
            const drawerId = `drawer-cantrip-${idx}`;
            return `
              <div class="expandable-option ${isChecked ? 'selected' : ''}">
                <div class="option-row">
                  <label class="option-label">
                    <input type="checkbox" value="${sp}" ${isChecked ? 'checked' : ''} onchange="window.app.toggleSpell('cantrips', '${sp}', this.checked)">
                    <span style="display: inline-flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                      <strong>${sp}</strong>
                      <span class="spell-level-badge badge-cantrip">Truco</span>
                    </span>
                  </label>
                  <button type="button" class="btn-info" data-target="${drawerId}" onclick="event.stopPropagation(); window.app.toggleOptionDetail('${drawerId}')" title="Desplegar detalles del truco">ℹ️ Info</button>
                </div>
                <div id="${drawerId}" class="option-drawer hidden">
                  ${spDetail ? `
                    <div class="drawer-header">
                      <span class="drawer-title">${spDetail.name}</span>
                      <span class="drawer-type">${spDetail.typeLine}</span>
                    </div>
                    <div class="drawer-pills">
                      <span class="drawer-pill pill-cantrip">✨ Truco</span>
                      <span class="drawer-pill">⏱️ ${spDetail.castingTime}</span>
                      <span class="drawer-pill">📏 ${spDetail.range}</span>
                      <span class="drawer-pill">🧩 ${spDetail.components}</span>
                      <span class="drawer-pill">⏳ ${spDetail.duration}</span>
                    </div>
                    <div class="drawer-desc">${spDetail.desc || 'Descripción oficial no disponible.'}</div>
                  ` : `
                    <div class="drawer-pills">
                      <span class="drawer-pill pill-cantrip">✨ Truco</span>
                    </div>
                    <div class="drawer-desc">Truco oficial de ${classDef.name}.</div>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}

    ${classDef.id === 'mago' ? `
      <div class="form-group" style="margin-top: 2rem;">
        <label class="form-label">Libro de Conjuros del Mago (Elige exactamente 6 conjuros de nivel 1):</label>
        <p class="form-help" style="margin-bottom: 0.75rem;">Los 6 conjuros inscritos en tu grimorio inicial como estudiante de la magia.</p>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 0.75rem;">
          ${spellsData.level1.map((sp, idx) => {
            const isChecked = state.draft.spellbook.includes(sp);
            const spDetail = getSpellDetail(sp, spellsDatabase);
            const lvlLabel = getSpellLevelLabel(sp, spDetail, 'Nivel 1');
            const drawerId = `drawer-spellbook-${idx}`;
            return `
              <div class="expandable-option ${isChecked ? 'selected' : ''}">
                <div class="option-row">
                  <label class="option-label">
                    <input type="checkbox" value="${sp}" ${isChecked ? 'checked' : ''} onchange="window.app.toggleSpell('spellbook', '${sp}', this.checked)">
                    <span style="display: inline-flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                      <strong>${sp}</strong>
                      <span class="spell-level-badge badge-level-1">${lvlLabel}</span>
                    </span>
                  </label>
                  <button type="button" class="btn-info" data-target="${drawerId}" onclick="event.stopPropagation(); window.app.toggleOptionDetail('${drawerId}')" title="Desplegar detalles del conjuro">ℹ️ Info</button>
                </div>
                <div id="${drawerId}" class="option-drawer hidden">
                  ${spDetail ? `
                    <div class="drawer-header">
                      <span class="drawer-title">${spDetail.name}</span>
                      <span class="drawer-type">${spDetail.typeLine}</span>
                    </div>
                    <div class="drawer-pills">
                      <span class="drawer-pill pill-level-1">🔮 ${lvlLabel}</span>
                      <span class="drawer-pill">⏱️ ${spDetail.castingTime}</span>
                      <span class="drawer-pill">📏 ${spDetail.range}</span>
                      <span class="drawer-pill">🧩 ${spDetail.components}</span>
                      <span class="drawer-pill">⏳ ${spDetail.duration}</span>
                    </div>
                    <div class="drawer-desc">${spDetail.desc || 'Descripción oficial no disponible.'}</div>
                  ` : `
                    <div class="drawer-pills">
                      <span class="drawer-pill pill-level-1">🔮 ${lvlLabel}</span>
                    </div>
                    <div class="drawer-desc">Conjuro de nivel 1 de mago.</div>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="form-group" style="margin-top: 2rem;">
        <label class="form-label">Conjuros Preparados del Mago (Elige exactamente 4 de los seleccionados en tu Libro):</label>
        <p class="form-help" style="margin-bottom: 0.75rem;">Solo puedes preparar conjuros que hayas seleccionado previamente en tu Libro de conjuros.</p>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 0.75rem;">
          ${state.draft.spellbook.map((sp, idx) => {
            const isChecked = state.draft.preparedSpells.includes(sp);
            const spDetail = getSpellDetail(sp, spellsDatabase);
            const lvlLabel = getSpellLevelLabel(sp, spDetail, 'Nivel 1');
            const drawerId = `drawer-prep-${idx}`;
            return `
              <div class="expandable-option ${isChecked ? 'selected' : ''}">
                <div class="option-row">
                  <label class="option-label">
                    <input type="checkbox" value="${sp}" ${isChecked ? 'checked' : ''} onchange="window.app.toggleSpell('preparedSpells', '${sp}', this.checked)">
                    <span style="display: inline-flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                      <strong>${sp}</strong>
                      <span class="spell-level-badge badge-level-1">${lvlLabel}</span>
                    </span>
                  </label>
                  <button type="button" class="btn-info" data-target="${drawerId}" onclick="event.stopPropagation(); window.app.toggleOptionDetail('${drawerId}')" title="Desplegar detalles del conjuro">ℹ️ Info</button>
                </div>
                <div id="${drawerId}" class="option-drawer hidden">
                  ${spDetail ? `
                    <div class="drawer-header">
                      <span class="drawer-title">${spDetail.name}</span>
                      <span class="drawer-type">${spDetail.typeLine}</span>
                    </div>
                    <div class="drawer-pills">
                      <span class="drawer-pill pill-level-1">🔮 ${lvlLabel}</span>
                      <span class="drawer-pill">⏱️ ${spDetail.castingTime}</span>
                      <span class="drawer-pill">📏 ${spDetail.range}</span>
                      <span class="drawer-pill">🧩 ${spDetail.components}</span>
                      <span class="drawer-pill">⏳ ${spDetail.duration}</span>
                    </div>
                    <div class="drawer-desc">${spDetail.desc || 'Descripción oficial no disponible.'}</div>
                  ` : `
                    <div class="drawer-pills">
                      <span class="drawer-pill pill-level-1">🔮 ${lvlLabel}</span>
                    </div>
                    <div class="drawer-desc">Conjuro preparado de nivel 1.</div>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : `
      <div class="form-group" style="margin-top: 2rem;">
        <label class="form-label">Conjuros Preparados de Nivel 1 (Elige exactamente ${classDef.spellcasting.preparedSpellsCount}):</label>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 0.75rem;">
          ${spellsData.level1.map((sp, idx) => {
            const isChecked = state.draft.preparedSpells.includes(sp);
            const spDetail = getSpellDetail(sp, spellsDatabase);
            const lvlLabel = getSpellLevelLabel(sp, spDetail, 'Nivel 1');
            const drawerId = `drawer-prep-l1-${idx}`;
            return `
              <div class="expandable-option ${isChecked ? 'selected' : ''}">
                <div class="option-row">
                  <label class="option-label">
                    <input type="checkbox" value="${sp}" ${isChecked ? 'checked' : ''} onchange="window.app.toggleSpell('preparedSpells', '${sp}', this.checked)">
                    <span style="display: inline-flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                      <strong>${sp}</strong>
                      <span class="spell-level-badge badge-level-1">${lvlLabel}</span>
                    </span>
                  </label>
                  <button type="button" class="btn-info" data-target="${drawerId}" onclick="event.stopPropagation(); window.app.toggleOptionDetail('${drawerId}')" title="Desplegar detalles del conjuro">ℹ️ Info</button>
                </div>
                <div id="${drawerId}" class="option-drawer hidden">
                  ${spDetail ? `
                    <div class="drawer-header">
                      <span class="drawer-title">${spDetail.name}</span>
                      <span class="drawer-type">${spDetail.typeLine}</span>
                    </div>
                    <div class="drawer-pills">
                      <span class="drawer-pill pill-level-1">🔮 ${lvlLabel}</span>
                      <span class="drawer-pill">⏱️ ${spDetail.castingTime}</span>
                      <span class="drawer-pill">📏 ${spDetail.range}</span>
                      <span class="drawer-pill">🧩 ${spDetail.components}</span>
                      <span class="drawer-pill">⏳ ${spDetail.duration}</span>
                    </div>
                    <div class="drawer-desc">${spDetail.desc || 'Descripción oficial no disponible.'}</div>
                  ` : `
                    <div class="drawer-pills">
                      <span class="drawer-pill pill-level-1">🔮 ${lvlLabel}</span>
                    </div>
                    <div class="drawer-desc">Conjuro oficial de ${classDef.name}.</div>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `}

    <div class="step-footer">
      <button class="btn btn-secondary" onclick="window.app.goToStep(5)">&larr; Anterior</button>
      <button class="btn btn-primary" onclick="window.app.goToStep(7)">Siguiente: Equipo &rarr;</button>
    </div>
  `;
}
