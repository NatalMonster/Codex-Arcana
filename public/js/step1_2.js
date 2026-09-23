import { state } from './state.js';
import { getFeatDetail } from './infoHelper.js';

export function renderStep1(c) {
  const classes = state.catalogs.classes;
  const isLvl3Plus = state.draft.level >= 3;
  const selectedClass = classes.find(cl => cl.id === state.draft.classId);
  const subclasses = state.catalogs.subclasses.filter(s => s.classId === state.draft.classId);

  c.innerHTML = `
    <div class="step-header">
      <h2 class="step-title">Paso 1: Elegir una Clase</h2>
      <p class="step-desc">La vocación principal de tu personaje. Determina dados de golpe, salvaciones y rasgos iniciales según el Capítulo 2 y 3 del manual.</p>
    </div>

    <div class="cards-grid">
      ${classes.map(cl => `
        <div class="selection-card ${state.draft.classId === cl.id ? 'selected' : ''}" onclick="window.app.selectClass('${cl.id}')">
          <div class="card-header">
            <span class="card-title">${cl.name}</span>
            <span class="card-badge">d${cl.hitDie}</span>
          </div>
          <div class="card-body">
            <p><strong>Caract. Principal:</strong> ${cl.primaryAbilities.join(', ').toUpperCase()}</p>
            <p><strong>Salvaciones:</strong> ${cl.savingThrows.map(s => s.substring(0,3).toUpperCase()).join(', ')}</p>
            <p><strong>Armaduras:</strong> ${cl.armorProficiencies.length ? cl.armorProficiencies.join(', ') : 'Ninguna'}</p>
            <p><strong>Armas:</strong> ${cl.weaponProficiencies.join(', ')}</p>
          </div>
          <div class="card-traits">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <strong>Rasgos nv 1:</strong>
              <button type="button" class="btn-info" data-target="drawer-cl-${cl.id}" onclick="event.stopPropagation(); window.app.toggleOptionDetail('drawer-cl-${cl.id}')" title="Ver rasgos iniciales">ℹ️ Rasgos</button>
            </div>
            <span>${cl.level1Features.map(f => f.name).join(', ')}</span>
            <div id="drawer-cl-${cl.id}" class="option-drawer hidden" style="margin-top: 0.5rem;" onclick="event.stopPropagation();">
              ${cl.level1Features.map(f => `
                <div style="margin-bottom: 0.4rem;">
                  <strong style="color: var(--gold);">${f.name}:</strong>
                  <span style="font-size: 0.8rem; color: #cbd5e1;"> ${f.desc}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    ${selectedClass ? `
      <div style="margin-top: 2rem; padding: 1.5rem; background-color: var(--bg-input); border-radius: 8px; border: 1px solid var(--border-color);">
        <h3 style="color: var(--gold); margin-bottom: 0.5rem;">Subclase (${selectedClass.name})</h3>
        ${!isLvl3Plus ? `
          <div class="alert-box alert-warning">
            <strong>Regla D&D 2024:</strong> Las subclases de todas las clases se desbloquean en el <strong>Nivel 3</strong>. Como tu personaje es de nivel ${state.draft.level}, este paso se completará cuando subas de nivel.
          </div>
        ` : `
          <p class="form-help" style="margin-bottom: 1rem;">Como tu nivel es ${state.draft.level} (&ge; 3), debes seleccionar tu subclase oficial:</p>
          <div class="cards-grid">
            ${subclasses.map(sub => `
              <div class="selection-card ${state.draft.subclassId === sub.id ? 'selected' : ''}" onclick="window.app.updateDraftField('subclassId', '${sub.id}')">
                <div class="card-header">
                  <span class="card-title" style="font-size: 1rem;">${sub.name}</span>
                  <span class="card-badge">Nv ${sub.unlockLevel}</span>
                </div>
                ${sub.role ? `<div style="font-size: 0.76rem; color: #60a5fa; font-weight: 600; margin-bottom: 0.35rem;">🎯 ${sub.role}</div>` : ''}
                <div class="card-body" style="font-size: 0.85rem; line-height: 1.4;">${sub.desc}</div>
                ${(sub.features || []).length > 0 ? `
                  <div style="margin-top: 0.6rem; border-top: 1px solid var(--border-color); padding-top: 0.4rem; font-size: 0.78rem;">
                    <strong style="color: var(--gold);">Rasgos principales:</strong>
                    ${sub.features.slice(0, 2).map(f => `<div style="margin-top: 0.2rem;"><span style="color: #4ade80;">Nv ${f.level} ${f.name}:</span> ${f.desc.slice(0, 85)}...</div>`).join('')}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </div>
    ` : ''}

    <div class="step-footer">
      <div></div>
      <button class="btn btn-primary" onclick="window.app.goToStep(2)">Siguiente: Origen &rarr;</button>
    </div>
  `;
}

export function renderStep2(c) {
  const speciesList = state.catalogs.species;
  const backgrounds = state.catalogs.backgrounds;
  const selectedSpecies = speciesList.find(s => s.id === state.draft.speciesId);
  const stdLangs = state.catalogs.languages.standard;

  c.innerHTML = `
    <div class="step-header">
      <h2 class="step-title">Paso 2: Definir el Origen</h2>
      <p class="step-desc">El trasfondo, la especie y los idiomas definen quién eras antes de comenzar tus aventuras. Haz clic en <strong>ℹ️ Info</strong> para desplegar detalles.</p>
    </div>

    <div class="form-group">
      <h3 style="color: var(--gold); margin-bottom: 0.75rem;">1. Especie</h3>
      <div class="cards-grid">
        ${speciesList.map(sp => {
          const isSelected = state.draft.speciesId === sp.id;
          const drawerId = `drawer-sp-${sp.id}`;
          return `
            <div class="selection-card ${isSelected ? 'selected' : ''}" onclick="window.app.selectSpecies('${sp.id}')">
              <div class="card-header">
                <span class="card-title">${sp.name}</span>
                <span class="card-badge">${sp.speed} m</span>
              </div>
              <div class="card-body">
                <p><strong>Visión:</strong> ${sp.darkvision ? sp.darkvision + ' m' : 'Normal'}</p>
                <p><strong>Tamaño:</strong> ${sp.sizeOptions.join(' o ')}</p>
                <div class="card-traits">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>Rasgos:</strong>
                    <button type="button" class="btn-info" data-target="${drawerId}" onclick="event.stopPropagation(); window.app.toggleOptionDetail('${drawerId}')" title="Ver rasgos completos de la especie">ℹ️ Rasgos</button>
                  </div>
                  <span>${sp.traits.map(t => t.name).join(', ')}</span>
                  <div id="${drawerId}" class="option-drawer hidden" style="margin-top: 0.5rem;" onclick="event.stopPropagation();">
                    ${sp.traits.map(t => `
                      <div style="margin-bottom: 0.4rem;">
                        <strong style="color: var(--gold);">${t.name}:</strong>
                        <span style="font-size: 0.8rem; color: #cbd5e1;"> ${t.desc}</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      ${selectedSpecies ? `
        <div style="margin-top: 1rem; padding: 1rem; background-color: var(--bg-input); border-radius: 8px; border: 1px solid var(--border-color);">
          ${selectedSpecies.sizeOptions.length > 1 ? `
            <div style="margin-bottom: 1rem;">
              <label class="form-label">Elige el tamaño de tu ${selectedSpecies.name}:</label>
              <select class="select-box" style="max-width: 200px;" onchange="window.app.updateDraftField('size', this.value)">
                ${selectedSpecies.sizeOptions.map(sz => `
                  <option value="${sz}" ${state.draft.size === sz ? 'selected' : ''}>${sz}</option>
                `).join('')}
              </select>
            </div>
          ` : ''}

          ${selectedSpecies.hasLineages ? `
            <div>
              <label class="form-label">${selectedSpecies.lineageTitle || 'Linaje de la Especie'} *</label>
              <select class="select-box" onchange="window.app.updateDraftField('speciesLineageId', this.value)">
                <option value="">-- Selecciona linaje / ancestro --</option>
                ${selectedSpecies.lineages.map(lin => `
                  <option value="${lin.id}" ${state.draft.speciesLineageId === lin.id ? 'selected' : ''}>${lin.name} ${lin.damageType ? '(' + lin.damageType + ')' : ''}</option>
                `).join('')}
              </select>
            </div>
          ` : ''}
        </div>
      ` : ''}
    </div>

    <div class="form-group" style="margin-top: 2rem;">
      <h3 style="color: var(--gold); margin-bottom: 0.75rem;">2. Trasfondo</h3>
      <div class="cards-grid">
        ${backgrounds.map(bg => {
          const isSelected = state.draft.backgroundId === bg.id;
          const feat = getFeatDetail(bg.originFeatId, state.catalogs.feats);
          const drawerId = `drawer-bg-${bg.id}`;
          return `
            <div class="selection-card ${isSelected ? 'selected' : ''}" onclick="window.app.selectBackground('${bg.id}')">
              <div class="card-header">
                <span class="card-title">${bg.name}</span>
              </div>
              <div class="card-body">
                <p><strong>Aumentos:</strong> ${bg.abilities.map(a => a.substring(0,3).toUpperCase()).join(', ')}</p>
                <p><strong>Habilidades:</strong> ${bg.skills.join(', ')}</p>
                <p><strong>Herramienta:</strong> ${bg.toolName}</p>
                <div class="card-traits" style="margin-top: 0.5rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span><strong>Dote de Origen:</strong> ${feat ? feat.name : bg.originFeatId}</span>
                    <button type="button" class="btn-info" data-target="${drawerId}" onclick="event.stopPropagation(); window.app.toggleOptionDetail('${drawerId}')" title="Ver qué hace la dote de origen">ℹ️ Dote</button>
                  </div>
                  <div id="${drawerId}" class="option-drawer hidden" style="margin-top: 0.5rem;" onclick="event.stopPropagation();">
                    <strong style="color: var(--gold);">${feat ? feat.name : 'Dote'}:</strong>
                    <div style="margin-top: 0.25rem; font-size: 0.8rem; color: #cbd5e1;">${feat ? feat.desc : 'Dote oficial otorgada por este trasfondo.'}</div>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <div class="form-group" style="margin-top: 2rem;">
      <h3 style="color: var(--gold); margin-bottom: 0.5rem;">3. Idiomas</h3>
      <p class="form-help" style="margin-bottom: 1rem;">Todos los aventureros saben <strong>Común</strong> y 2 idiomas estándar adicionales a su elección.</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.5rem;">
        ${stdLangs.map(l => {
          const isCommon = l.id === 'comun';
          const isChecked = state.draft.languages.includes(l.id);
          return `
            <label style="display: flex; align-items: center; gap: 0.5rem; background-color: var(--bg-input); padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); cursor: ${isCommon ? 'default' : 'pointer'};">
              <input type="checkbox" value="${l.id}" ${isChecked ? 'checked' : ''} ${isCommon ? 'disabled' : ''} onchange="window.app.toggleLanguage('${l.id}', this.checked)">
              <span>${l.name} ${isCommon ? '(Fijo)' : ''}</span>
            </label>
          `;
        }).join('')}
      </div>
    </div>

    <div class="step-footer">
      <button class="btn btn-secondary" onclick="window.app.goToStep(1)">&larr; Anterior: Clase</button>
      <button class="btn btn-primary" onclick="window.app.goToStep(3)">Siguiente: Concepto &rarr;</button>
    </div>
  `;
}
