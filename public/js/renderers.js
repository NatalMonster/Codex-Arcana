import React from 'react';
import { createRoot } from 'react-dom/client';
import { state } from './state.js';
import * as Rules from '/src/engine/rulesEngine.js';
import { validateCharacter } from '/src/engine/validator.js';
import { renderStep1, renderStep2 } from './step1_2.js';
import { renderStep3, renderStep4 } from './step3_4.js';
import { renderStep5, renderStep6 } from './step5_6.js';
import { renderStep7, renderStep8 } from './step7_8.js';
import Dashboard from '/src/components/Dashboard.jsx';
import CharacterSheetWrapper from '/src/components/CharacterSheetWrapper.jsx';
import CreatorStepWrapper from '/src/components/CreatorStepWrapper.jsx';
import { renderCharacterSheetView } from './characterSheetView.js';

let reactRoot = null;

let renderTick = 0;

export function renderApp(options = {}) {
  renderTick++;

  updateSavedCount();

  const stepperContainer = document.getElementById('creator-stepper-container');
  const sidebar = document.getElementById('summary-sidebar');
  const stepContent = document.getElementById('step-content');
  const mainLayout = document.getElementById('main-layout');

  const dmBtn = document.getElementById('btn-nav-dm');
  const creatorBtn = document.getElementById('btn-nav-creator');
  const charactersBtn = document.getElementById('btn-nav-characters');
  const campBtn = document.getElementById('btn-nav-campaigns');

  if (state.activeView === 'welcome') {
    if (dmBtn) { dmBtn.style.display = 'none'; dmBtn.classList.remove('nav-btn-active'); }
    if (creatorBtn) { creatorBtn.style.display = 'none'; creatorBtn.classList.remove('nav-btn-active'); }
    if (charactersBtn) { charactersBtn.style.display = 'none'; charactersBtn.classList.remove('nav-btn-active'); }
    if (campBtn) { campBtn.style.display = 'inline-block'; campBtn.classList.remove('nav-btn-active'); }
  } else if (state.activeView === 'dm_module' || state.activeView === 'dm_monsters' || state.activeView === 'dm_preparation') {
    if (dmBtn) { dmBtn.style.display = 'none'; dmBtn.classList.add('nav-btn-active'); }
    if (creatorBtn) { creatorBtn.style.display = 'inline-block'; creatorBtn.classList.remove('nav-btn-active'); }
    if (charactersBtn) { charactersBtn.style.display = 'inline-block'; charactersBtn.classList.remove('nav-btn-active'); }
    if (campBtn) { campBtn.style.display = 'inline-block'; campBtn.classList.remove('nav-btn-active'); }
  } else {
    // Modo Jugador (Forja / Lista / Hoja)
    if (dmBtn) { dmBtn.style.display = 'inline-block'; dmBtn.classList.remove('nav-btn-active'); }
    if (creatorBtn) { creatorBtn.style.display = 'none'; creatorBtn.classList.remove('nav-btn-active'); }
    if (charactersBtn) { 
      charactersBtn.style.display = 'none'; 
      // If we are in player mode, we hide this button from header anyway (as requested by user). 
      // So no active state is visible.
    }
    if (campBtn) { campBtn.style.display = 'inline-block'; campBtn.classList.remove('nav-btn-active'); }
  }

  // Unmount React root si la vista NO está en nuestra lista de vistas migradas a React
  const isReactView = ['characters_list', 'sheet', 'creator'].includes(state.activeView || 'creator');
  if (!isReactView && reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
    if (stepContent) stepContent.innerHTML = '';
  }

  if (state.activeView === 'welcome') {
    if (stepperContainer) stepperContainer.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';
    if (mainLayout) mainLayout.classList.add('full-width-view');
    if (stepContent) {
      if (reactRoot) {
        reactRoot.unmount();
        reactRoot = null;
      }
      const user = state.currentUser || {};
      const isAdmin = user.role === 'admin';
      
      stepContent.innerHTML = `
        <div class="mode-selection-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; padding: 2rem;">
          <h1 style="color: var(--gold); margin-bottom: 2rem; font-size: 2.5rem; text-align: center;">¿Qué camino deseas tomar?</h1>
          <div style="display: flex; gap: 2rem; width: 100%; max-width: 800px; flex-wrap: wrap; justify-content: center;">
            <div class="mode-card" onclick="window.app.openCharactersList()" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" style="cursor:pointer; border: 2px solid var(--primary-color); border-radius: 8px; padding: 2.5rem; text-align: center; background: rgba(0,0,0,0.5); flex: 1; min-width: 250px; transition: transform 0.2s;">
              <h2 style="color: var(--primary-color); font-size: 2rem; margin-bottom: 1rem;">✨ Forja de Personajes</h2>
              <p style="color: var(--text-muted);">Crea, edita y gestiona tus héroes. Accede a tu lista de personajes.</p>
            </div>
            <div class="mode-card" onclick="window.app.openDMModule()" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" style="cursor:pointer; border: 2px solid var(--danger-color); border-radius: 8px; padding: 2.5rem; text-align: center; background: rgba(0,0,0,0.5); flex: 1; min-width: 250px; transition: transform 0.2s;">
              <h2 style="color: var(--danger-color); font-size: 2rem; margin-bottom: 1rem;">🐉 Dungeon Master</h2>
              <p style="color: var(--text-muted);">Gestiona campañas, jugadores, combates y la base de datos de monstruos.</p>
            </div>
          </div>
        </div>
      `;
    }
    return;
  }


  if (state.activeView === 'characters_list') {
    if (stepperContainer) stepperContainer.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';
    if (mainLayout) mainLayout.classList.add('full-width-view');
    if (stepContent) {
      if (!reactRoot) {
        reactRoot = createRoot(stepContent);
      }
      reactRoot.render(
        React.createElement(Dashboard, {
          characters: state.savedCharacters || [],
          classList: state.catalogs.classes || [],
          app: window.app
        })
      );
    }
    return;
  }

  if (state.activeView === 'sheet') {
    if (stepperContainer) stepperContainer.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';
    if (mainLayout) mainLayout.classList.add('full-width-view');
    if (stepContent) {
      if (!reactRoot) {
        reactRoot = createRoot(stepContent);
      }
      reactRoot.render(
        React.createElement(CharacterSheetWrapper, {
          characterId: state.activeCharacterId,
          tick: renderTick
        })
      );
    }
    return;
  }

  if (state.activeView === 'dm_module' || state.activeView === 'dm_monsters' || state.activeView === 'dm_preparation') {
    if (stepperContainer) stepperContainer.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';
    if (mainLayout) mainLayout.classList.add('full-width-view');
    if (stepContent) {
      if (reactRoot) {
        reactRoot.unmount();
        reactRoot = null;
      }
      import('./dmView.js').then(module => {
        if (state.activeView === 'dm_monsters') {
          module.renderMonstersCatalog(stepContent);
        } else if (state.activeView === 'dm_preparation') {
          module.renderPreparationView(stepContent, 'partida');
        } else {
          module.renderDMModule(stepContent);
        }
      });
    }
    return;
  }

  // Modo 'creator'
  if (stepperContainer) stepperContainer.style.display = 'block';
  if (sidebar) sidebar.style.display = 'flex';
  if (mainLayout) mainLayout.classList.remove('full-width-view');

  const shouldRenderStep = options.renderStep !== false;
  renderStepper();
  if (shouldRenderStep && stepContent) {
    if (!reactRoot) {
      reactRoot = createRoot(stepContent);
    }
    reactRoot.render(
      React.createElement(CreatorStepWrapper, {
        tick: renderTick
      })
    );
  }
  renderSummarySidebar();
}

function updateSavedCount() {
  const badge = document.getElementById('saved-count');
  if (badge) {
    badge.textContent = state.savedCharacters.length;
  }
}

function renderStepper() {
  const stepper = document.getElementById('stepper');
  if (!stepper) return;

  const steps = [
    { num: 1, title: 'Clase' },
    { num: 2, title: 'Origen' },
    { num: 3, title: 'Concepto' },
    { num: 4, title: 'Características' },
    { num: 5, title: 'Opciones de Clase' },
    { num: 6, title: 'Conjuros' },
    { num: 7, title: 'Equipo' },
    { num: 8, title: 'Revisión' }
  ];

  const validation = validateCharacter(state.draft, state.catalogs);

  stepper.innerHTML = steps.map(s => {
    const isActive = state.currentStep === s.num;
    const hasErrors = validation.errors.some(e => e.step === s.num);
    const isPast = state.currentStep > s.num;
    let statusClass = '';
    if (isActive) statusClass = 'active';
    else if (isPast && !hasErrors) statusClass = 'completed';

    return `
      <li class="step-item ${statusClass}" onclick="window.app.goToStep(${s.num})">
        <span class="step-number">${s.num}</span>
        <span>${s.title}</span>
      </li>
    `;
  }).join('');
}

function renderCurrentStep() {
  const container = document.getElementById('step-content');
  if (!container) return;

  const activeEl = document.activeElement;
  const activeId = (activeEl && activeEl.id) ? activeEl.id : null;
  let selStart = null;
  let selEnd = null;
  if (activeEl && typeof activeEl.selectionStart === 'number') {
    selStart = activeEl.selectionStart;
    selEnd = activeEl.selectionEnd;
  }

  switch (state.currentStep) {
    case 1: renderStep1(container); break;
    case 2: renderStep2(container); break;
    case 3: renderStep3(container); break;
    case 4: renderStep4(container); break;
    case 5: renderStep5(container); break;
    case 6: renderStep6(container); break;
    case 7: renderStep7(container); break;
    case 8: renderStep8(container); break;
  }

  if (activeId) {
    const restored = document.getElementById(activeId);
    if (restored) {
      restored.focus();
      if (selStart !== null && typeof restored.setSelectionRange === 'function') {
        try {
          restored.setSelectionRange(selStart, selEnd);
        } catch (e) {}
      }
    }
  }
}

function renderSummarySidebar() {
  const sidebar = document.getElementById('summary-sidebar');
  if (!sidebar) return;

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

  const hp = Rules.calculateHitPoints({ classDef, conMod, level: state.draft.level, speciesDef, featIds });
  const ac = Rules.calculateArmorClass({ classDef, dexMod, conMod, wisMod, fightingStyle: state.draft.fightingStyle });
  const init = Rules.calculateInitiative(dexMod, featIds, pb);

  const validation = validateCharacter(state.draft, state.catalogs);

  sidebar.innerHTML = `
    <h3 style="color: var(--gold); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Resumen en Vivo</h3>

    <div>
      <div style="font-size: 1.15rem; font-weight: bold;">${state.draft.name || 'Sin Nombre'}</div>
      <div style="font-size: 0.8rem; color: var(--text-muted);">
        ${speciesDef ? speciesDef.name : 'Especie ?'} • ${classDef ? classDef.name : 'Clase ?'} • Nv ${state.draft.level}
      </div>
      <div style="font-size: 0.8rem; color: var(--text-muted);">${bgDef ? bgDef.name : 'Trasfondo ?'} • ${state.draft.alignment}</div>
    </div>

    <!-- BADGES DE COMBATE -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; text-align: center;">
      <div style="background-color: var(--bg-input); padding: 0.4rem; border-radius: 6px; border: 1px solid var(--border-color);">
        <div style="font-size: 0.65rem; color: var(--text-muted);">CA</div>
        <div style="font-size: 1.1rem; font-weight: bold; color: var(--gold);">${ac}</div>
      </div>
      <div style="background-color: var(--bg-input); padding: 0.4rem; border-radius: 6px; border: 1px solid var(--border-color);">
        <div style="font-size: 0.65rem; color: var(--text-muted);">PG</div>
        <div style="font-size: 1.1rem; font-weight: bold; color: var(--crimson);">${hp}</div>
      </div>
      <div style="background-color: var(--bg-input); padding: 0.4rem; border-radius: 6px; border: 1px solid var(--border-color);">
        <div style="font-size: 0.65rem; color: var(--text-muted);">INIT</div>
        <div style="font-size: 1.1rem; font-weight: bold; color: var(--blue);">${init >= 0 ? '+' : ''}${init}</div>
      </div>
    </div>

    <!-- CARACTERÍSTICAS RESUMIDAS -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem; font-size: 0.75rem; text-align: center;">
      ${Object.entries(abs).map(([k, d]) => `
        <div style="background: rgba(255,255,255,0.03); padding: 0.25rem; border-radius: 4px;">
          <span style="color: var(--text-muted); text-transform: uppercase;">${k.substring(0,3)}:</span>
          <strong>${d.base > 0 ? d.score : '--'}</strong> ${d.base > 0 ? `(${d.mod >= 0 ? '+' : ''}${d.mod})` : ''}
        </div>
      `).join('')}
    </div>

    <!-- ESTADO DE VALIDACIÓN -->
    <div style="margin-top: auto; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
      ${validation.valid ? `
        <div style="color: var(--green); font-size: 0.85rem; font-weight: bold;">✔ Personaje Válido</div>
      ` : `
        <div style="color: var(--crimson); font-size: 0.8rem; font-weight: bold;">
          ⚠ Faltan ${validation.errors.length} requisito(s) por completar.
        </div>
      `}
    </div>
  `;
}

export function renderSavedCharactersModal() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target === this) window.app.closeModal()">
      <div class="modal-content">
        <div class="modal-header">
          <h2 style="color: var(--gold);">📜 Personajes Creados y Guardados</h2>
          <button class="btn-close" onclick="window.app.closeModal()">&times;</button>
        </div>
        <div>
          ${state.savedCharacters.length === 0 ? `
            <p style="color: var(--text-muted); text-align: center; padding: 2rem;">Aún no has creado ningún personaje. ¡Usa el asistente para forjar a tu primer héroe!</p>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${state.savedCharacters.map(char => `
                <div style="background-color: var(--bg-input); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <h3 style="color: var(--gold);">${char.name}</h3>
                    <p style="font-size: 0.85rem; color: var(--text-muted);">
                      ${char.speciesName} • ${char.className} Nivel ${char.level} • ${char.backgroundName} • ${char.alignment}
                    </p>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                      CA: ${char.calculatedStats.ac} | PG: ${char.calculatedStats.maxHp} | Guardado: ${new Date(char.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary" onclick="window.app.exportCharacter('${char.id}')">💾 JSON</button>
                    <button class="btn btn-secondary" style="color: var(--crimson);" onclick="window.app.deleteCharacter('${char.id}')">🗑 Eliminar</button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}
