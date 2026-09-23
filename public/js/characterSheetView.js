/**
 * Hoja de Personaje Interactiva ("Modo Partida" D&D 2024)
 */

import { state } from './state.js';
import { diceEngine } from './diceEngine.js';
import { getSpellDetail, getSpellLevelLabel, getMasteryDetail, getClassSpells } from './infoHelper.js';
import * as Rules from '/src/engine/rulesEngine.js';

let activeTab = 'actions'; // 'stats' | 'actions' | 'skills' | 'spells' | 'inventory' | 'traits' | 'history'
let activeSpellSubTab = 'prepared'; // 'prepared' | 'select'
let spellLevelFilter = 'all'; // 'all' | 0 | 1 | 2 | 3 ...
let spellSearchFilter = '';

function getClassSymbol(classId) {
  const map = {
    barbaro: '🥊',
    bardo: '🎶',
    clerigo: '⛪',
    druida: '🌿',
    guerrero: '⚔️',
    hechicero: '✨',
    mago: '🧙',
    monje: '🥋',
    paladin: '🛡️',
    picaro: '🗡️',
    explorador: '🏹',
    brujo: '👁️'
  };
  return map[(classId || '').toLowerCase()] || '⚔️';
}

export function renderCharacterSheetView(container, characterId) {
  if (!container) return;

  const char = state.savedCharacters.find(c => c.id === characterId);
  if (!char) {
    container.innerHTML = `
      <div class="alert-box alert-error" style="margin: 2rem auto; max-width: 600px;">
        <h3>Personaje no encontrado</h3>
        <p>No se pudo localizar el personaje solicitado en la memoria o base de datos.</p>
        <button class="btn btn-primary" onclick="window.app.openCharactersList()" style="margin-top: 1rem;">
          ← Volver a Mis Personajes
        </button>
      </div>
    `;
    return;
  }

  // Sincronizar activeCharacter en state
  state.activeCharacter = char;

  // Catálogos
  const classDef = state.catalogs.classes.find(c => c.id === char.classId) || {};
  const speciesDef = state.catalogs.species.find(s => s.id === char.speciesId) || {};
  const bgDef = state.catalogs.backgrounds.find(b => b.id === char.backgroundId) || {};
  const allSkills = state.catalogs.rules.skills || [];
  const weaponsCatalog = state.catalogs.equipment.weapons || [];
  const spellsDatabase = state.catalogs.spellsDatabase || {};
  const subclassDef = char.subclassId ? (state.catalogs.subclasses || []).find(s => s.id === char.subclassId) : null;

  // Estadísticas calculadas
  const abs = char.calculatedStats?.abilities || Rules.calculateFinalAbilities(char.baseAbilityScores || {}, char.backgroundAbilityBonus || {});
  const pb = Rules.calculateProficiencyBonus(char.level || 1);
  const dexMod = abs.destreza?.mod || 0;
  const conMod = abs.constitucion?.mod || 0;
  const wisMod = abs.sabiduria?.mod || 0;
  const strMod = abs.fuerza?.mod || 0;
  const intMod = abs.inteligencia?.mod || 0;
  const chaMod = abs.carisma?.mod || 0;

  // Inicializar inventario si no existe aún
  if (!Array.isArray(char.inventory)) {
    char.inventory = buildInitialInventory(char, state.catalogs);
  }

  // Desglose dinámico de Puntos de Armadura (CA) y pasivas activas
  const armorBreakdown = Rules.getArmorClassBreakdown({
    inventory: char.inventory,
    classDef,
    abilities: abs,
    fightingStyle: char.fightingStyle,
    catalogs: state.catalogs
  });
  const ac = armorBreakdown.totalAc;
  if (!char.calculatedStats) char.calculatedStats = {};
  char.calculatedStats.ac = ac;

  // Valores de combate
  const maxHp = char.calculatedStats?.maxHp || 10;
  const currentHp = typeof char.currentHp === 'number' ? char.currentHp : maxHp;
  const tempHp = typeof char.tempHp === 'number' ? char.tempHp : 0;
  const init = char.calculatedStats?.initiative || dexMod;
  const passivePerc = char.calculatedStats?.passivePerception || (10 + wisMod);
  const speed = speciesDef.speed || 9;

  // Inicializar ranuras usadas si no existe
  if (!char.usedSpellSlots) {
    char.usedSpellSlots = { "1": 0 };
  }

  // Inicializar dados de golpe usados si no existe
  if (typeof char.usedHitDice !== 'number') {
    char.usedHitDice = 0;
  }

  const hpPercent = Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)));
  const xpInfo = Rules.getXpProgress(char.xp || 0, char.level || 1);

  container.innerHTML = `
    <!-- ENCABEZADO COMPACTO PARA CELULARES (MINIMALISTA ESTILO D&D BEYOND) -->
    <div class="mobile-combat-header">
      <div class="mobile-top-nav-bar">
        <button class="mobile-back-btn" onclick="window.app.openCharactersList()" title="Volver a Mis Personajes">
          ‹
        </button>
        <div class="mobile-identity-box">
          <div class="mobile-name-row">
            <h2 class="mobile-char-name">${window.app.escapeHTML(char.name || 'Sin Nombre')}</h2>
            <span class="mobile-lvl-badge">Nv. ${char.level || 1}</span>
          </div>
          <div class="mobile-meta">
            <span>${window.app.escapeHTML(char.speciesName || 'Especie ?')}</span>
            <span>${window.app.escapeHTML(char.className || 'Clase ?')}</span>
            <span>${window.app.escapeHTML(char.backgroundName || 'Sin Trasfondo')}</span>
          </div>
        </div>
        <button 
          class="mobile-insp-btn ${char.heroicInspiration ? 'active' : ''}" 
          onclick="window.app.toggleHeroicInspiration('${char.id}')"
          title="${char.heroicInspiration ? 'Inspiración Heroica ACTIVA (Clic para usar)' : 'Activar Inspiración Heroica'}"
        >
          <span class="insp-icon">☀️</span>
          <span class="insp-lbl">INSPIRACIÓN</span>
        </button>
      </div>

      <div class="mobile-vitals-strip">
        <!-- Columna 1: Armadura, Iniciativa y Descansos -->
        <div class="mobile-vital-col mobile-defenses-col">
          <div class="mobile-badges-row">
            <div class="mobile-shield-card" onclick="window.app.switchSheetTab('stats')" title="Clase de Armadura: ${ac} (Ver estadísticas)">
              <span class="mshield-lbl">ARMADURA</span>
              <span class="mshield-val">${ac}</span>
              <span class="mshield-sub">CLASE</span>
            </div>
            <div class="mobile-hex-card" onclick="window.app.rollInitiative(${init})" title="Tirar Iniciativa (${init >= 0 ? '+' : ''}${init})">
              <span class="mhex-lbl">INICIATIVA</span>
              <span class="mhex-val">${init >= 0 ? '+' : ''}${init}</span>
              <span class="mhex-sub">D20</span>
            </div>
          </div>
          <div class="mobile-rest-row">
            <button class="mrest-btn" onclick="window.app.triggerShortRest('${char.id}')" title="Descanso Corto (Gastar dados de golpe)">☕ Corto</button>
            <button class="mrest-btn" onclick="window.app.triggerLongRest('${char.id}')" title="Descanso Largo (Recuperar todo)">⛺ Largo</button>
            <button class="mrest-btn" onclick="window.app.exportCharacterPDF('${char.id}')" title="Exportar Hoja a PDF">📄 PDF</button>
          </div>
        </div>

        <!-- Columna 2: Puntos de Golpe y Experiencia (Con amplio espacio) -->
        <div class="mobile-vital-col mobile-hp-col">
          <div class="mobile-hp-card">
            <div class="mhp-title-line">
              <span class="mhp-title">PUNTOS DE GOLPE</span>
              <div class="mhp-numbers">
                <strong class="mhp-cur">${currentHp}</strong>
                <span class="mhp-slash">/</span>
                <span class="mhp-max">${maxHp}</span>
                ${tempHp > 0 ? `<span class="mhp-temp" title="PG Temporales">+${tempHp}</span>` : ''}
              </div>
            </div>
            <div class="mhp-bar-track">
              <div class="mhp-bar-fill ${currentHp <= maxHp * 0.25 ? 'crit' : currentHp <= maxHp * 0.5 ? 'warn' : 'good'}" style="width: ${hpPercent}%;"></div>
            </div>
            <div class="mhp-controls">
              <button class="mhp-btn" onclick="window.app.adjustCurrentHp('${char.id}', -5)" title="Restar 5 PG">-5</button>
              <button class="mhp-btn" onclick="window.app.adjustCurrentHp('${char.id}', -1)" title="Restar 1 PG">-1</button>
              <button class="mhp-btn mhp-btn-add" onclick="window.app.adjustCurrentHp('${char.id}', 1)" title="Curar 1 PG">+1</button>
              <button class="mhp-btn mhp-btn-add" onclick="window.app.adjustCurrentHp('${char.id}', 5)" title="Curar 5 PG">+5</button>
            </div>
            <div class="mxp-mini-line" onclick="window.app.switchSheetTab('stats')" title="${xpInfo.currentXp.toLocaleString()} XP acumulada • Nivel ${xpInfo.currentLevel}">
              <span class="mxp-label">⭐ ${xpInfo.currentXp.toLocaleString()} XP</span>
              <div class="mxp-track">
                <div class="mxp-fill" style="width: ${xpInfo.percent}%;"></div>
              </div>
              <span class="mxp-pct">${xpInfo.percent}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- BARRA SUPERIOR DE HOJA DE PARTIDA -->
    <div class="sheet-top-bar">
      <button class="btn btn-secondary btn-back-nav" onclick="window.app.openCharactersList()">
        ← Volver a Mis Personajes
      </button>
      <div class="sheet-quick-actions">
        <button class="btn btn-secondary" onclick="window.app.triggerShortRest('${char.id}')" title="Recupera dados de golpe y rasgos de descanso corto">
          ☕ Descanso Corto
        </button>
        <button class="btn btn-secondary" onclick="window.app.triggerLongRest('${char.id}')" title="Restaura todos los PG, ranuras y mitad de dados de golpe">
          ⛺ Descanso Largo
        </button>
        <button class="btn btn-primary" onclick="window.app.exportCharacterPDF('${char.id}')">
          📄 Exportar PDF
        </button>
      </div>
    </div>

    <!-- ENCABEZADO DEL PERSONAJE (SECCIÓN 4) -->
    <header class="character-sheet-header">
      <div class="header-identity-block">
        <h1 class="header-char-name">${char.name || 'Sin Nombre'}</h1>
        <div class="header-meta-tags">
          <span class="sheet-tag">${char.speciesName || 'Especie ?'}</span>
          <span class="sheet-tag class-tag">${char.className || 'Clase ?'} Nv ${char.level}</span>
          <span class="sheet-tag">${window.app.escapeHTML(char.speciesName || 'Especie ?')}</span>
          <span class="sheet-tag class-tag">${window.app.escapeHTML(char.className || 'Clase ?')} Nv ${char.level || 1}</span>
          ${subclassDef ? `
            <span class="sheet-tag subclass-tag clickable" onclick="window.app.switchSheetTab('subclass')" title="Ver detalles de subclase">🛡️ ${window.app.escapeHTML(subclassDef.name)}</span>
          ` : ((char.level || 1) >= 3 ? `
            <span class="sheet-tag pending-subclass-tag clickable" onclick="window.app.switchSheetTab('subclass')" title="Elegir subclase disponible">⚠️ Elegir Subclase</span>
          ` : '')}
          <span class="sheet-tag bg-tag">${window.app.escapeHTML(char.backgroundName || 'Trasfondo ?')}</span>
          <span class="sheet-tag align-tag">${window.app.escapeHTML(char.alignment || 'Neutral')}</span>
        </div>
      </div>

      <!-- BADGES RÁPIDOS DE COMBATE -->
      <div class="header-combat-strip">
        <div class="combat-strip-card clickable" onclick="document.getElementById('vital-card-armor')?.scrollIntoView({ behavior: 'smooth', block: 'center' })" title="Ver desglose de Armadura">
          <span class="strip-label">CA</span>
          <span class="strip-value" style="color: var(--gold);">${ac}</span>
        </div>
        <div class="combat-strip-card clickable" onclick="window.app.rollInitiative(${init})" title="Tirar Iniciativa">
          <span class="strip-label">INICIATIVA 🎲</span>
          <span class="strip-value" style="color: #60a5fa;">${init >= 0 ? '+' : ''}${init}</span>
        </div>
        <div class="combat-strip-card">
          <span class="strip-label">VELOCIDAD</span>
          <span class="strip-value">${speed} m</span>
        </div>
        <div class="combat-strip-card">
          <span class="strip-label">BONO COMPETENCIA</span>
          <span class="strip-value" style="color: #4ade80;">+${pb}</span>
        </div>
        <div class="combat-strip-card">
          <span class="strip-label">PERCEPCIÓN PASIVA</span>
          <span class="strip-value" style="color: #c084fc;">${passivePerc}</span>
        </div>
      </div>
    </header>

    <!-- PANEL PRINCIPAL DE 3 COLUMNAS: ARMADURA, PUNTOS DE GOLPE Y EXPERIENCIA (SIMPLIFICADO) -->
    <div class="vitals-dashboard-grid">
      <!-- 1. COLUMNA: PUNTOS DE ARMADURA (CA) -->
      <div class="vital-card vital-card-armor" id="vital-card-armor">
        <div class="vital-card-header">
          <div class="vital-title-group">
            <span class="vital-icon">🛡️</span>
            <div>
              <h3 class="vital-title">Armadura</h3>
              <span class="vital-subtitle">
                ${armorBreakdown.isWearingArmor ? armorBreakdown.armorName : 'Sin armadura'}
                ${armorBreakdown.shieldActive ? ' • Escudo' : ''}
              </span>
            </div>
          </div>
          <div class="vital-badge-big armor-badge" title="Clase de Armadura total: ${armorBreakdown.totalAc}">
            <span class="vital-badge-sub">CA</span>
            <span class="vital-badge-num">${armorBreakdown.totalAc}</span>
          </div>
        </div>

        <!-- Desglose simplificado y limpio -->
        <div class="armor-mini-breakdown">
          <div class="armor-mini-row">
            <span class="armor-mini-lbl">Base:</span>
            <span class="armor-mini-val">${armorBreakdown.baseAc} <small class="text-muted">(${armorBreakdown.armorTypeLabel})</small></span>
          </div>
          <div class="armor-mini-row">
            <span class="armor-mini-lbl">Destreza:</span>
            <span class="armor-mini-val ${armorBreakdown.dexApplied > 0 ? 'text-green' : (armorBreakdown.dexApplied < 0 ? 'text-red' : '')}">
              ${armorBreakdown.dexApplied >= 0 ? '+' : ''}${armorBreakdown.dexApplied} <small class="text-muted">(${armorBreakdown.dexNote})</small>
            </span>
          </div>
          ${armorBreakdown.shieldActive ? `
            <div class="armor-mini-row">
              <span class="armor-mini-lbl">Escudo:</span>
              <span class="armor-mini-val text-green">+${armorBreakdown.shieldBonus}</span>
            </div>
          ` : ''}
          ${armorBreakdown.activePassives.map(p => `
            <div class="armor-mini-row armor-row-passive">
              <span class="armor-mini-lbl">✨ ${p.name.replace('Defensa sin armadura', 'Def. sin armadura').replace('Estilo de combate: ', '')}:</span>
              <span class="armor-mini-val text-gold">+${p.bonus}</span>
            </div>
          `).join('')}
          ${armorBreakdown.inactivePassives.length > 0 ? `
            <div class="armor-mini-row text-muted" title="${armorBreakdown.inactivePassives[0].reason}">
              <span class="armor-mini-lbl">⚪ ${armorBreakdown.inactivePassives[0].name.split(' ')[0]}:</span>
              <span class="armor-mini-val">Inactiva</span>
            </div>
          ` : ''}
        </div>

        <!-- Alertas compactas de sigilo y fuerza si existen -->
        ${(armorBreakdown.stealthDisadvantage || armorBreakdown.strengthReq) ? `
          <div class="armor-mini-alerts">
            ${armorBreakdown.stealthDisadvantage ? `<span class="armor-chip chip-warn" title="Desventaja en pruebas de Sigilo">⚠️ Desv. Sigilo</span>` : ''}
            ${armorBreakdown.strengthReq ? `<span class="armor-chip ${armorBreakdown.meetsStrength ? 'chip-ok' : 'chip-err'}" title="Fuerza requerida: ${armorBreakdown.strengthReq}">FUE ${armorBreakdown.strengthReq} (${abs.fuerza?.score || 10})</span>` : ''}
          </div>
        ` : ''}

        <!-- Acción rápida para ir al inventario -->
        <div class="vital-card-footer">
          <button class="btn btn-secondary btn-xs btn-block" onclick="window.app.switchSheetTab('inventory')" title="Equipar o cambiar armaduras en el inventario">
            🎒 Gestionar en Inventario
          </button>
        </div>
      </div>

      <!-- 2. COLUMNA: PUNTOS DE GOLPE (PG) -->
      <div class="vital-card vital-card-hp" id="vital-card-hp">
        <div class="vital-card-header">
          <div class="vital-title-group">
            <span class="vital-icon">❤️</span>
            <div>
              <h3 class="vital-title">Puntos de Golpe</h3>
              <span class="vital-subtitle">
                ${currentHp === 0 ? '<span class="text-red">Inconsciente (0 PG)</span>' : `${Math.round((currentHp / maxHp) * 100)}% de salud`}
                ${tempHp > 0 ? ` • <strong class="text-blue">+${tempHp} Temp</strong>` : ''}
              </span>
            </div>
          </div>
          <div class="vital-badge-big hp-badge ${currentHp === 0 ? 'hp-zero' : ''}" title="Puntos de Golpe actuales / máximos">
            <span class="vital-badge-sub">PG</span>
            <span class="vital-badge-num">${currentHp} <small style="font-size: 0.75rem; color: var(--text-muted);">/ ${maxHp}</small></span>
          </div>
        </div>

        <!-- Barra de Salud -->
        <div class="vital-progress-wrapper" title="Salud: ${currentHp} / ${maxHp} PG (${hpPercent}%)">
          <div class="vital-progress-bar">
            <div class="vital-progress-fill hp-fill ${hpPercent < 25 ? 'critical' : (hpPercent < 50 ? 'warning' : '')}" style="width: ${hpPercent}%;"></div>
          </div>
        </div>

        <!-- Controles simplificados de curación y daño -->
        <div class="hp-simple-controls">
          <div class="hp-stepper-row">
            <button class="btn btn-secondary btn-xs btn-dmg" onclick="window.app.adjustCurrentHp('${char.id}', -5)" title="Restar 5 PG">-5</button>
            <button class="btn btn-secondary btn-xs btn-dmg" onclick="window.app.adjustCurrentHp('${char.id}', -1)" title="Restar 1 PG">-1</button>
            
            <div class="hp-input-compact" title="Editar PG actuales directamente">
              <input 
                type="number" 
                class="input-text hp-compact-field" 
                value="${currentHp}" 
                min="0" 
                max="${maxHp + 50}" 
                onchange="window.app.setCurrentHpDirect('${char.id}', parseInt(this.value))"
              >
            </div>

            <button class="btn btn-secondary btn-xs btn-heal" onclick="window.app.adjustCurrentHp('${char.id}', 1)" title="Sumar 1 PG">+1</button>
            <button class="btn btn-secondary btn-xs btn-heal" onclick="window.app.adjustCurrentHp('${char.id}', 5)" title="Sumar 5 PG">+5</button>
          </div>

          <!-- Fila inferior: Temporales y Dados de Golpe -->
          <div class="hp-meta-row">
            <div class="hp-temp-box" title="Puntos de Golpe Temporales">
              <label>Temp:</label>
              <input 
                type="number" 
                class="input-text hp-temp-input" 
                value="${tempHp}" 
                min="0" 
                max="100" 
                onchange="window.app.setTempHpDirect('${char.id}', parseInt(this.value))"
              >
            </div>

            <div class="hp-dice-box" title="Dados de golpe disponibles para descansar">
              <span>🎲 <strong>${(char.level || 1) - char.usedHitDice}/${char.level || 1}</strong> d${classDef.hitDie || 8}</span>
              <button class="btn btn-secondary btn-xs" onclick="window.app.rollHitDie('${char.id}')" title="Gasta 1 dado de golpe para curarte">Gastar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. COLUMNA: EXPERIENCIA (XP) -->
      <div class="vital-card vital-card-xp" id="vital-card-xp">
        <div class="vital-card-header">
          <div class="vital-title-group">
            <span class="vital-icon">⭐</span>
            <div>
              <h3 class="vital-title">Experiencia</h3>
              <span class="vital-subtitle">
                ${xpInfo.nextLevel ? `Faltan <strong>${xpInfo.xpNeeded.toLocaleString()} XP</strong> (Nv ${xpInfo.nextLevel})` : 'Nivel 20 Máximo'}
              </span>
            </div>
          </div>
          <div class="vital-badge-big xp-badge" title="${xpInfo.currentXp.toLocaleString()} XP acumulados">
            <span class="vital-badge-sub">NIVEL</span>
            <span class="vital-badge-num">${xpInfo.currentLevel}</span>
          </div>
        </div>

        <!-- Barra de progreso o botón de Level Up -->
        ${xpInfo.canLevelUp ? `
          <div class="xp-levelup-mini">
            <button class="btn btn-primary btn-sm btn-block pulse-gold" onclick="window.app.promptLevelUp('${char.id}', ${xpInfo.nextLevel})" title="¡Subir a Nivel ${xpInfo.nextLevel}!">
              🎉 ¡Subir a Nivel ${xpInfo.nextLevel}!
            </button>
          </div>
        ` : `
          <div class="vital-progress-wrapper" title="${xpInfo.currentXp.toLocaleString()} / ${xpInfo.nextLevelXp ? xpInfo.nextLevelXp.toLocaleString() : xpInfo.currentXp.toLocaleString()} XP (${xpInfo.percent}%)">
            <div class="vital-progress-bar">
              <div class="vital-progress-fill xp-fill" style="width: ${xpInfo.percent}%;"></div>
            </div>
            <div class="xp-mini-numbers">
              <span>${xpInfo.currentXp.toLocaleString()} XP</span>
              <span>${xpInfo.nextLevelXp ? xpInfo.nextLevelXp.toLocaleString() + ' XP' : 'Máx'}</span>
            </div>
          </div>
        `}

        <!-- Controles simplificados de XP -->
        <div class="xp-simple-controls">
          <div class="xp-input-row">
            <input 
              type="number" 
              id="combat-xp-input-${char.id}" 
              class="input-text xp-quick-input" 
              placeholder="+XP combate" 
              min="1" 
              step="10"
              onkeydown="if(event.key === 'Enter') { const val = parseInt(this.value); if(val > 0) { window.app.addCombatXp('${char.id}', val); this.value=''; } }"
            >
            <button class="btn btn-secondary btn-xs btn-xp-submit" onclick="const input = document.getElementById('combat-xp-input-${char.id}'); const val = parseInt(input?.value); if(val > 0) { window.app.addCombatXp('${char.id}', val); input.value=''; }" title="Sumar XP ganado">
              ➕ Sumar
            </button>
          </div>

          <!-- Chips rápidos más frecuentes y total manual -->
          <div class="xp-chips-row">
            <div class="xp-chips-group">
              <button class="btn btn-secondary btn-xs btn-chip" onclick="window.app.addCombatXp('${char.id}', 50)" title="Sumar 50 XP">+50</button>
              <button class="btn btn-secondary btn-xs btn-chip" onclick="window.app.addCombatXp('${char.id}', 100)" title="Sumar 100 XP">+100</button>
              <button class="btn btn-secondary btn-xs btn-chip" onclick="window.app.addCombatXp('${char.id}', 500)" title="Sumar 500 XP">+500</button>
            </div>
            <div class="xp-manual-compact" title="Ajustar total de XP manualmente">
              <label>Total:</label>
              <input 
                type="number" 
                class="input-text xp-total-input" 
                value="${xpInfo.currentXp}" 
                min="0"
                onchange="window.app.setTotalXpDirect('${char.id}', parseInt(this.value))"
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- BARRA DE NAVEGACIÓN DE PESTAÑAS PRINCIPAL (CENTRADAS A TODO EL ANCHO) -->
    <nav class="sheet-tabs-nav-container">
      <div class="sheet-tabs-nav" role="tablist">
        <button class="sheet-tab-btn sheet-tab-stats ${activeTab === 'stats' ? 'active' : ''}" onclick="window.app.switchSheetTab('stats')">
          <span class="tab-label-full">📊 Estadísticas</span><span class="tab-label-short">📊 Stats</span>
        </button>
        <button class="sheet-tab-btn ${activeTab === 'actions' ? 'active' : ''}" onclick="window.app.switchSheetTab('actions')">
          ⚔️ Acciones
        </button>
        <button class="sheet-tab-btn ${activeTab === 'skills' ? 'active' : ''}" onclick="window.app.switchSheetTab('skills')">
          🎯 Habilidades
        </button>
        ${(classDef.spellcasting || (subclassDef && ((subclassDef.spells && subclassDef.spells.length > 0) || ['caballero_arcano', 'embaucador_arcano'].includes(subclassDef.id)))) ? `
          <button class="sheet-tab-btn ${activeTab === 'spells' ? 'active' : ''}" onclick="window.app.switchSheetTab('spells')">
            🔮 Conjuros
          </button>
        ` : ''}
        ${(char.level || 1) >= 3 ? `
          <button class="sheet-tab-btn sheet-tab-subclass ${activeTab === 'subclass' ? 'active' : ''}" onclick="window.app.switchSheetTab('subclass')">
            🛡️ Subclase ${!char.subclassId ? '<span class="badge-subclass-pending" title="Subclase pendiente de elegir">!</span>' : ''}
          </button>
        ` : ''}
        <button class="sheet-tab-btn ${activeTab === 'inventory' ? 'active' : ''}" onclick="window.app.switchSheetTab('inventory')">
          🎒 Inventario<span class="tab-label-extra"> y Equipo</span>
        </button>
        <button class="sheet-tab-btn ${activeTab === 'traits' ? 'active' : ''}" onclick="window.app.switchSheetTab('traits')">
          📜 Rasgos<span class="tab-label-extra"> y Dotes</span>
        </button>
        <button class="sheet-tab-btn ${activeTab === 'history' ? 'active' : ''}" onclick="window.app.switchSheetTab('history')">
          🎲 Historial<span class="tab-label-extra"> (${diceEngine.history.length})</span>
        </button>
      </div>
    </nav>

    <!-- CUERPO PRINCIPAL DE LA HOJA (LAYOUT DE 2 COLUMNAS) -->
    <div class="sheet-main-grid">
      <!-- COLUMNA IZQUIERDA: CARACTERÍSTICAS Y SALVACIONES (SECCIÓN 5 Y 7) -->
      <aside class="sheet-left-column">
        <!-- 6 CARACTERÍSTICAS PRINCIPALES (SECCIÓN 5) -->
        <div class="sheet-card sheet-abilities-card">
          <h3 class="card-section-title">📊 Características</h3>
          <div class="abilities-stack">
            ${[
              { id: 'fuerza', name: 'Fuerza', short: 'FUE', mod: strMod, score: abs.fuerza?.score || 10 },
              { id: 'destreza', name: 'Destreza', short: 'DES', mod: dexMod, score: abs.destreza?.score || 10 },
              { id: 'constitucion', name: 'Constitución', short: 'CON', mod: conMod, score: abs.constitucion?.score || 10 },
              { id: 'inteligencia', name: 'Inteligencia', short: 'INT', mod: intMod, score: abs.inteligencia?.score || 10 },
              { id: 'sabiduria', name: 'Sabiduría', short: 'SAB', mod: wisMod, score: abs.sabiduria?.score || 10 },
              { id: 'carisma', name: 'Carisma', short: 'CAR', mod: chaMod, score: abs.carisma?.score || 10 }
            ].map(ab => `
              <div class="ability-row-box clickable" onclick="window.app.rollAbilityCheck('${ab.name}', ${ab.mod})" title="Tirar prueba de ${ab.name}">
                <div class="ability-row-left">
                  <span class="ab-short">${ab.short}</span>
                  <span class="ab-name">${ab.name}</span>
                </div>
                <div class="ability-row-center">
                  <span class="ab-score-pill">${ab.score}</span>
                </div>
                <div class="ability-row-right">
                  <span class="ab-mod-box">${ab.mod >= 0 ? '+' : ''}${ab.mod}</span>
                  <span class="btn-roll-mini">🎲</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- TIRADAS DE SALVACIÓN (SECCIÓN 7) -->
        <div class="sheet-card sheet-saves-card">
          <h3 class="card-section-title" title="Tiradas de Salvación">
            <span class="title-full">🛡️ Tiradas de Salvación</span>
            <span class="title-short">🛡️ Salvaciones</span>
          </h3>
          <div class="saves-stack">
            ${[
              { id: 'fuerza', name: 'Fuerza', short: 'FUE', mod: strMod },
              { id: 'destreza', name: 'Destreza', short: 'DES', mod: dexMod },
              { id: 'constitucion', name: 'Constitución', short: 'CON', mod: conMod },
              { id: 'inteligencia', name: 'Inteligencia', short: 'INT', mod: intMod },
              { id: 'sabiduria', name: 'Sabiduría', short: 'SAB', mod: wisMod },
              { id: 'carisma', name: 'Carisma', short: 'CAR', mod: chaMod }
            ].map(s => {
              const isProf = (classDef.savingThrows || []).includes(s.id);
              const saveMod = s.mod + (isProf ? pb : 0);
              return `
                <div class="save-row ${isProf ? 'proficient' : ''} clickable" onclick="window.app.rollSavingThrow('${s.name}', ${saveMod})" title="Tirar salvación de ${s.name} (d20 ${saveMod >= 0 ? '+' : ''}${saveMod})">
                  <span class="prof-indicator ${isProf ? 'active' : ''}">${isProf ? '●' : '○'}</span>
                  <span class="save-name">
                    <span class="save-short">${s.short}</span>
                    <span class="save-full">${s.name}</span>
                  </span>
                  <span class="save-mod">${saveMod >= 0 ? '+' : ''}${saveMod}</span>
                  <button class="btn btn-secondary btn-sm btn-roll-save" onclick="event.stopPropagation(); window.app.rollSavingThrow('${s.name}', ${saveMod})" title="Tirar salvación de ${s.name}">
                    <span class="save-btn-text">TIRAR </span>🎲
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </aside>

      <!-- COLUMNA DERECHA: CONTENIDO DE PESTAÑA ACTIVA (SECCIÓN 16) -->
      <main class="sheet-right-column">
        <!-- CONTENIDO DE PESTAÑA ACTIVA -->
        <div class="sheet-tab-content">
          ${renderTabContent({
            tab: activeTab,
            char,
            classDef,
            subclassDef,
            speciesDef,
            bgDef,
            allSkills,
            weaponsCatalog,
            spellsDatabase,
            abs,
            pb,
            strMod,
            dexMod,
            conMod,
            intMod,
            wisMod,
            chaMod,
            ac,
            speed,
            passivePerc,
            armorBreakdown,
            xpInfo
          })}
        </div>
      </main>
    </div>

    <!-- BOTÓN FLOTANTE DE DADOS (FAB D20) UNIVERSAL (ESCRITORIO Y MÓVIL) -->
    <div class="mobile-fab-dice-wrapper" id="mobile-dice-container">
      <div class="mobile-dice-drawer hidden" id="mobile-dice-drawer" onclick="event.stopPropagation()">
        <div class="dice-drawer-header">
          <div class="dice-drawer-title-group">
            <span class="dice-drawer-title">🎲 Tirar Dados</span>
            <span class="dice-drawer-subtitle">Tiradas individuales</span>
          </div>
          <button type="button" class="btn-dice-drawer-close" onclick="window.app.closeDiceDrawer()" title="Cerrar dados" aria-label="Cerrar">&times;</button>
        </div>
        <div class="dice-drawer-grid">
          <button type="button" class="m-dice-chip" onclick="window.app.rollRawDie(4, this)" title="Tirar d4">
            <span class="m-dice-shape">▲</span> <span class="m-dice-name">d4</span>
          </button>
          <button type="button" class="m-dice-chip" onclick="window.app.rollRawDie(6, this)" title="Tirar d6">
            <span class="m-dice-shape">■</span> <span class="m-dice-name">d6</span>
          </button>
          <button type="button" class="m-dice-chip" onclick="window.app.rollRawDie(8, this)" title="Tirar d8">
            <span class="m-dice-shape">◆</span> <span class="m-dice-name">d8</span>
          </button>
          <button type="button" class="m-dice-chip" onclick="window.app.rollRawDie(10, this)" title="Tirar d10">
            <span class="m-dice-shape">⬟</span> <span class="m-dice-name">d10</span>
          </button>
          <button type="button" class="m-dice-chip" onclick="window.app.rollRawDie(12, this)" title="Tirar d12">
            <span class="m-dice-shape">⬡</span> <span class="m-dice-name">d12</span>
          </button>
          <button type="button" class="m-dice-chip" onclick="window.app.rollRawDie(100, this)" title="Tirar d100 (Porcentual)">
            <span class="m-dice-shape">%</span> <span class="m-dice-name">d100</span>
          </button>
          <button type="button" class="m-dice-chip m-dice-chip-d20" onclick="window.app.rollRawDie(20, this)" title="Tirar d20">
            <span class="m-dice-shape">⭐</span> <span class="m-dice-name">d20</span>
          </button>
        </div>
      </div>
      <button type="button" class="mobile-fab-dice-btn" id="fab-dice-toggle-btn" onclick="window.app.toggleDiceDrawer(event)" title="Tiradas individuales (d4 a d100)" aria-label="Lanzar Dados">
        <span id="fab-dice-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"></polygon>
            <polyline points="2 8.5 12 15.5 22 8.5"></polyline>
            <line x1="12" y1="2" x2="12" y2="15.5"></line>
          </svg>
        </span>
      </button>
    </div>
  `;
}

export function setActiveTab(tab) {
  activeTab = tab;
}

export function setSpellSubTab(subTab) {
  activeSpellSubTab = subTab;
}

export function setSpellLevelFilter(level) {
  spellLevelFilter = level;
}

export function setSpellSearchFilter(query) {
  spellSearchFilter = query || '';
}

// -------------------------------------------------------------
// RENDERIZADOR DE CONTENIDOS DE PESTAÑAS
// -------------------------------------------------------------

function renderTabContent(ctx) {
  switch (ctx.tab) {
    case 'stats':
      return renderStatsTab(ctx);
    case 'actions':
      return renderActionsTab(ctx);
    case 'skills':
      return renderSkillsTab(ctx);
    case 'spells':
      return renderSpellsTab(ctx);
    case 'subclass':
      if ((ctx.char.level || 1) < 3) return renderActionsTab(ctx);
      return renderSubclassTab(ctx);
    case 'inventory':
      return renderInventoryTab(ctx);
    case 'traits':
      return renderTraitsTab(ctx);
    case 'history':
      return renderHistoryTab(ctx);
    default:
      return renderActionsTab(ctx);
  }
}

// PESTAÑA: ESTADÍSTICAS, SALVACIONES Y SENTIDOS (ESTILO D&D BEYOND - FOTO 1)
function renderStatsTab({ char, classDef, subclassDef, speciesDef, abs, pb, strMod, dexMod, conMod, intMod, wisMod, chaMod, ac, speed, passivePerc, armorBreakdown, xpInfo }) {
  const abilities = [
    { id: 'fuerza', name: 'Fuerza', short: 'FUE', mod: strMod, score: abs.fuerza?.score || 10 },
    { id: 'destreza', name: 'Destreza', short: 'DES', mod: dexMod, score: abs.destreza?.score || 10 },
    { id: 'constitucion', name: 'Constitución', short: 'CON', mod: conMod, score: abs.constitucion?.score || 10 },
    { id: 'inteligencia', name: 'Inteligencia', short: 'INT', mod: intMod, score: abs.inteligencia?.score || 10 },
    { id: 'sabiduria', name: 'Sabiduría', short: 'SAB', mod: wisMod, score: abs.sabiduria?.score || 10 },
    { id: 'carisma', name: 'Carisma', short: 'CAR', mod: chaMod, score: abs.carisma?.score || 10 }
  ];

  const saves = [
    { id: 'fuerza', name: 'Fuerza', mod: strMod },
    { id: 'inteligencia', name: 'Inteligencia', mod: intMod },
    { id: 'destreza', name: 'Destreza', mod: dexMod },
    { id: 'sabiduria', name: 'Sabiduría', mod: wisMod },
    { id: 'constitucion', name: 'Constitución', mod: conMod },
    { id: 'carisma', name: 'Carisma', mod: chaMod }
  ];

  return `
    <div class="tab-pane">
      <div class="pane-header">
        <h3 class="pane-title">📊 Características, Salvaciones y Sentidos</h3>
        <p class="pane-desc">Puntuaciones base, modificadores de tirada y competencias oficiales según el Manual del Jugador 2024.</p>
      </div>

      <!-- CUADRÍCULA 3x2 DE CARACTERÍSTICAS (ESTILO D&D BEYOND) -->
      <div class="beyond-abilities-grid">
        ${abilities.map(ab => `
          <div class="beyond-ability-card clickable" onclick="window.app.rollAbilityCheck('${ab.name}', ${ab.mod})" title="Tirar prueba de ${ab.name} (d20 ${ab.mod >= 0 ? '+' : ''}${ab.mod})">
            <span class="beyond-ab-name">${ab.name.toUpperCase()}</span>
            <div class="beyond-ab-mod-box">
              <span class="beyond-ab-mod">${ab.mod >= 0 ? '+' : ''}${ab.mod}</span>
            </div>
            <div class="beyond-ab-score-pill">${ab.score}</div>
          </div>
        `).join('')}
      </div>

      <!-- TIRADAS DE SALVACIÓN (2 COLUMNAS ESTILO D&D BEYOND) -->
      <div class="beyond-section-group" style="margin-top: 1.5rem;">
        <h4 class="beyond-section-title">🛡️ Tiradas de Salvación</h4>
        <div class="beyond-saves-grid">
          ${saves.map(s => {
            const isProf = (classDef?.savingThrows || []).includes(s.id);
            const saveMod = s.mod + (isProf ? pb : 0);
            return `
              <div class="beyond-save-row ${isProf ? 'proficient' : ''} clickable" onclick="window.app.rollSavingThrow('${s.name}', ${saveMod})" title="Tirar salvación de ${s.name}">
                <span class="beyond-save-dot ${isProf ? 'active' : ''}">${isProf ? '●' : '○'}</span>
                <span class="beyond-save-name">${s.name.toUpperCase()}</span>
                <span class="beyond-save-mod">${saveMod >= 0 ? '+' : ''}${saveMod}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- SENTIDOS Y MOVIMIENTO -->
      <div class="beyond-section-group" style="margin-top: 1.5rem;">
        <h4 class="beyond-section-title">👁️ Sentidos y Movimiento</h4>
        <div class="senses-beyond-cards">
          <div class="sense-card">
            <span class="sense-label">PERCEPCIÓN PASIVA</span>
            <span class="sense-val" style="color: #c084fc;">${passivePerc}</span>
          </div>
          <div class="sense-card">
            <span class="sense-label">VELOCIDAD</span>
            <span class="sense-val">${speed} m</span>
          </div>
          <div class="sense-card">
            <span class="sense-label">BONO COMPETENCIA</span>
            <span class="sense-val text-green">+${pb}</span>
          </div>
          <div class="sense-card">
            <span class="sense-label">CLASE DE ARMADURA</span>
            <span class="sense-val text-gold">${ac}</span>
          </div>
        </div>
      </div>

      <!-- DESGLOSE DE PUNTOS DE ARMADURA Y PASIVAS -->
      <div class="beyond-section-group" style="margin-top: 1.5rem;">
        <h4 class="beyond-section-title">🛡️ Protección y Desglose de CA</h4>
        <div class="vital-card vital-card-armor" style="margin: 0;">
          <div class="armor-mini-breakdown">
            <div class="armor-mini-row">
              <span class="armor-mini-lbl">Armadura Base:</span>
              <span class="armor-mini-val">${armorBreakdown?.baseAc ?? 10} <small class="text-muted">(${armorBreakdown?.armorName || 'Sin armadura'} - ${armorBreakdown?.armorTypeLabel || 'Base'})</small></span>
            </div>
            <div class="armor-mini-row">
              <span class="armor-mini-lbl">Aporte de Destreza:</span>
              <span class="armor-mini-val">${(armorBreakdown?.dexApplied ?? armorBreakdown?.dexContribution ?? dexMod) >= 0 ? '+' : ''}${armorBreakdown?.dexApplied ?? armorBreakdown?.dexContribution ?? dexMod} <small class="text-muted">(${armorBreakdown?.dexNote || ''})</small></span>
            </div>
            ${armorBreakdown?.shieldActive ? `
              <div class="armor-mini-row">
                <span class="armor-mini-lbl">Escudo equipado:</span>
                <span class="armor-mini-val text-green">+${armorBreakdown.shieldBonus || 2} CA</span>
              </div>
            ` : ''}
            ${(armorBreakdown?.activePassives || []).map(p => `
              <div class="armor-mini-row">
                <span class="armor-mini-lbl">✨ ${p.name}:</span>
                <span class="armor-mini-val text-gold">+${p.bonus}</span>
              </div>
            `).join('')}
            ${(armorBreakdown?.inactivePassives || []).map(p => `
              <div class="armor-mini-row text-muted" title="${p.reason || ''}">
                <span class="armor-mini-lbl">⚪ ${p.name}:</span>
                <span class="armor-mini-val">Inactivo (${p.reason || 'No aplica'})</span>
              </div>
            `).join('')}
            <div class="armor-mini-row total-row" style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
              <span class="armor-mini-lbl"><strong>Total CA:</strong></span>
              <span class="armor-mini-val text-gold"><strong>${armorBreakdown?.totalAc ?? ac} CA</strong></span>
            </div>
          </div>
          <div style="margin-top: 0.75rem; text-align: center;">
            <button class="btn btn-secondary btn-sm" onclick="window.app.switchSheetTab('inventory')">
              🎒 Gestionar Equipo en Inventario
            </button>
          </div>
        </div>
      </div>

      <!-- EXPERIENCIA DE COMBATE -->
      <div class="beyond-section-group" style="margin-top: 1.5rem;">
        <h4 class="beyond-section-title">⭐ Experiencia y Subida de Nivel</h4>
        <div class="vital-card vital-card-xp" style="margin: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span>Nivel actual: <strong>${char.level || 1}</strong></span>
            <span class="text-gold"><strong>${xpInfo.currentXp.toLocaleString()} XP</strong></span>
          </div>
          ${xpInfo.canLevelUp ? `
            <button class="btn btn-primary btn-block pulse-gold" onclick="window.app.promptLevelUp('${char.id}', ${xpInfo.nextLevel})">
              🎉 ¡Subir a Nivel ${xpInfo.nextLevel}!
            </button>
          ` : `
            <div class="vital-progress-bar" style="margin-bottom: 0.5rem;">
              <div class="vital-progress-fill xp-fill" style="width: ${xpInfo.percent}%;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem;">
              <span>Progreso: ${xpInfo.percent}%</span>
              <span>${xpInfo.nextLevel ? `Siguiente nivel: ${xpInfo.nextLevelXp.toLocaleString()} XP` : 'Nivel 20 Máximo'}</span>
            </div>
          `}
          <div class="xp-simple-controls">
            <div class="xp-input-row">
              <input 
                type="number" 
                id="combat-xp-input-stats-${char.id}" 
                class="input-text xp-quick-input" 
                placeholder="+XP combate" 
                min="1" 
                step="10"
                onkeydown="if(event.key === 'Enter') { const val = parseInt(this.value); if(val > 0) { window.app.addCombatXp('${char.id}', val); this.value=''; } }"
              >
              <button class="btn btn-secondary btn-xs btn-xp-submit" onclick="const input = document.getElementById('combat-xp-input-stats-${char.id}'); const val = parseInt(input?.value); if(val > 0) { window.app.addCombatXp('${char.id}', val); input.value=''; }">
                ➕ Sumar
              </button>
            </div>
            <div class="xp-chips-row">
              <div class="xp-chips-group">
                <button class="btn btn-secondary btn-xs btn-chip" onclick="window.app.addCombatXp('${char.id}', 50)">+50</button>
                <button class="btn btn-secondary btn-xs btn-chip" onclick="window.app.addCombatXp('${char.id}', 100)">+100</button>
                <button class="btn btn-secondary btn-xs btn-chip" onclick="window.app.addCombatXp('${char.id}', 500)">+500</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// PESTAÑA 1: ACCIONES Y ATAQUES (ESTILO D&D BEYOND - FOTO 3)
function renderActionsTab({ char, classDef, weaponsCatalog, abs, pb, strMod, dexMod }) {
  const weapons = getCharacterWeapons(char, weaponsCatalog);
  const extraAttack = (char.level || 1) >= 5 && ['guerrero', 'barbaro', 'paladin', 'explorador', 'monje'].includes(char.classId);
  const attacksCount = extraAttack ? (char.classId === 'guerrero' && (char.level || 1) >= 11 ? 3 : 2) : 1;

  const isMonk = char.classId === 'monje';
  const unarmedMod = isMonk ? Math.max(strMod, dexMod) : strMod;
  const unarmedAtk = unarmedMod + pb;
  const unarmedDmg = isMonk ? (char.level >= 17 ? '1d10' : char.level >= 11 ? '1d8' : char.level >= 5 ? '1d6' : '1d4') : '1';

  return `
    <div class="tab-pane">
      <div class="pane-header actions-pane-header">
        <div>
          <h3 class="pane-title">⚔️ Acciones y Ataques</h3>
          <span class="actions-sub-header">ACCIONES • Ataques por Acción: <strong>${attacksCount}</strong></span>
        </div>
      </div>

      ${weapons.length === 0 ? `
        <div class="beyond-no-weapons-notice">
          <div class="no-weapons-notice-icon">⚔️</div>
          <div class="no-weapons-notice-body">
            <h5 class="no-weapons-notice-title">No tienes armas equipadas</h5>
            <p class="no-weapons-notice-desc">Para realizar ataques con armas en combate, equipa un arma desde tu inventario. Mientras tanto, puedes usar tu Golpe Desarmado a continuación.</p>
          </div>
          <button type="button" class="btn btn-secondary btn-sm no-weapons-notice-btn" onclick="window.app.switchSheetTab('inventory')">
            🎒 Ir al Inventario
          </button>
        </div>
      ` : ''}

      <!-- TABLA ELEGANTE DE ATAQUES (ESTILO D&D BEYOND) -->
      <div class="beyond-actions-table">
        <div class="beyond-actions-header-row">
          <span class="col-act-name">ATAQUE</span>
          <span class="col-act-range">ALCANCE</span>
          <span class="col-act-hit">IMPACTO</span>
          <span class="col-act-dmg">DAÑO</span>
        </div>

        ${weapons.map(w => {
          const isFinesse = (w.properties || []).some(p => p.toLowerCase().includes('sutil'));
          const isRanged = (w.properties || []).some(p => p.toLowerCase().includes('municion') || p.toLowerCase().includes('distancia') || p.toLowerCase().includes('arrojadiza')) || (w.range && w.range.includes('/'));
          const chosenMod = isRanged ? dexMod : (isFinesse ? Math.max(strMod, dexMod) : strMod);
          const isProf = (classDef.weaponProficiencies || []).includes('marciales') ||
            ((classDef.weaponProficiencies || []).includes('sencillas') && w.type === 'sencilla') ||
            (classDef.weaponProficiencies || []).some(p => p.toLowerCase() === w.id || p.toLowerCase() === (w.name || '').toLowerCase());
          
          const atkBonus = chosenMod + (isProf ? pb : 0);
          const hasMastery = (char.weaponMasteries || []).includes(w.id);
          const masteryDetail = hasMastery ? getMasteryDetail(w.mastery, state.catalogs.rules) : null;

          const dmgMatch = (w.damage || '1d4').match(/(\d+)d(\d+)/i) || [null, '1', '4'];
          const diceCount = parseInt(dmgMatch[1]) || 1;
          const diceFaces = parseInt(dmgMatch[2]) || 4;
          const safeName = (w.name || 'Arma').replace(/'/g, "\\'");
          const safeDmgType = (w.damageType || 'Daño').replace(/'/g, "\\'");

          return `
            <div class="beyond-action-item">
              <div class="beyond-act-main">
                <div class="beyond-act-title-line">
                  <strong class="beyond-act-name">${w.name}</strong>
                  ${hasMastery ? `<span class="beyond-mastery-badge" title="${masteryDetail ? masteryDetail.desc : ''}">⭐ ${w.mastery.toUpperCase()}</span>` : ''}
                </div>
                <div class="beyond-act-meta">
                  ${w.type === 'marcial' ? 'Marcial' : 'Sencilla'} • ${w.damageType || 'Daño'}${w.properties?.length ? ' • ' + w.properties.slice(0, 3).join(', ') : ''}
                </div>
              </div>
              <div class="beyond-act-range">
                ${w.range || '1.5 m'}
              </div>
              <div class="beyond-act-hit">
                <button class="beyond-btn-hit" onclick="window.app.rollWeaponAttack('${safeName}', ${atkBonus})" title="Tirar para impactar con ${safeName}">
                  ${atkBonus >= 0 ? '+' : ''}${atkBonus}
                </button>
              </div>
              <div class="beyond-act-dmg">
                <button class="beyond-btn-dmg" onclick="window.app.rollWeaponDamage('${safeName}', ${diceCount}, ${diceFaces}, ${chosenMod}, '${safeDmgType}')" title="Tirar daño con ${safeName}">
                  ${w.damage}${chosenMod >= 0 ? '+' : ''}${chosenMod} 💥
                </button>
              </div>
            </div>
          `;
        }).join('')}

        <!-- GOLPE DESARMADO -->
        <div class="beyond-action-item">
          <div class="beyond-act-main">
            <div class="beyond-act-title-line">
              <strong class="beyond-act-name">Golpe Desarmado</strong>
            </div>
            <div class="beyond-act-meta">
              Ataque sin armas • Contundente
            </div>
          </div>
          <div class="beyond-act-range">
            1.5 m
          </div>
          <div class="beyond-act-hit">
            <button class="beyond-btn-hit" onclick="window.app.rollWeaponAttack('Golpe Desarmado', ${unarmedAtk})" title="Tirar para impactar">
              ${unarmedAtk >= 0 ? '+' : ''}${unarmedAtk}
            </button>
          </div>
          <div class="beyond-act-dmg">
            <button class="beyond-btn-dmg" onclick="window.app.rollWeaponDamage('Golpe Desarmado', 1, 1, unarmedMod, 'Contundente')" title="Tirar daño">
              ${isMonk ? unarmedDmg + '+' + unarmedMod : Math.max(1, 1 + unarmedMod)} 💥
            </button>
          </div>
        </div>
      </div>

      <!-- ACCIONES EN COMBATE (D&D 2024 COMBAT ACTIONS) -->
      <div class="beyond-section-group" style="margin-top: 1.5rem;">
        <h4 class="beyond-section-title">⚡ Acciones en Combate (Manual del Jugador 2024)</h4>
        <div class="combat-actions-chips-grid">
          ${[
            { name: 'Atacar', desc: 'Realiza uno o más ataques según tu clase y armas.' },
            { name: 'Correr', desc: 'Ganas movimiento adicional igual a tu velocidad en este turno.' },
            { name: 'Destrabarse', desc: 'Tu movimiento no provoca ataques de oportunidad este turno.' },
            { name: 'Esquivar', desc: 'Los ataques contra ti tienen desventaja y tus salvaciones de DES tienen ventaja.' },
            { name: 'Agarrar', desc: 'Prueba de Atletismo contra Atletismo o Acrobacias para sujetar a un objetivo.' },
            { name: 'Ayudar', desc: 'Concedes ventaja en una prueba de característica o en el próximo ataque a un aliado.' },
            { name: 'Esconderse', desc: 'Realizas una prueba de Sigilo para volverte invisible/oculto.' },
            { name: 'Empujar', desc: 'Prueba de Atletismo para derribar a un rival o empujarlo 1.5 metros.' },
            { name: 'Magia', desc: 'Lanzas un conjuro con tiempo de lanzamiento de 1 Acción.' },
            { name: 'Preparar', desc: 'Eliges un desencadenante y una acción que ejecutarás con tu Reacción.' },
            { name: 'Buscar', desc: 'Dedicas tu atención a una prueba de Percepción o Investigación.' },
            { name: 'Estudiar', desc: 'Realizas una prueba de Conocimiento (Arcanos, Historia, Naturaleza, Religión).' },
            { name: 'Utilizar', desc: 'Interactúas con un objeto, mecanismo, poción o herramienta.' }
          ].map((act, i) => `
            <div class="combat-act-chip clickable" onclick="const d = document.getElementById('act-desc-${i}'); if (d) d.classList.toggle('hidden');" title="${act.desc}">
              <span class="combat-act-chip-name">${act.name}</span>
              <div id="act-desc-${i}" class="combat-act-chip-desc hidden">${act.desc}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// PESTAÑA 2: HABILIDADES (ESTILO D&D BEYOND - FOTO 4)
function renderSkillsTab({ char, allSkills, abs, pb, subclassDef }) {
  return `
    <div class="tab-pane">
      <div class="pane-header">
        <h3 class="pane-title">🎯 Habilidades (18 Habilidades Oficiales)</h3>
        <p class="pane-desc">Toca cualquier habilidad o su bonificador para realizar la prueba automática de d20 + modificador + competencia.</p>
      </div>

      <!-- TABLA ELEGANTE DE HABILIDADES (ESTILO D&D BEYOND) -->
      <div class="beyond-skills-table">
        <div class="beyond-skills-header-row">
          <span class="col-pin">PIN</span>
          <span class="col-prof">COMP</span>
          <span class="col-attr">ATR</span>
          <span class="col-name">HABILIDAD</span>
          <span class="col-bonus">BONO</span>
        </div>

        ${allSkills.map(skill => {
          const abKey = skill.ability;
          const abMod = abs[abKey]?.mod || 0;
          
          const isProf = (char.classSkills || []).includes(skill.id) ||
            ((state.catalogs.backgrounds.find(b => b.id === char.backgroundId)?.skills || []).includes(skill.id)) ||
            (char.humanBonusSkill === skill.id);
          const hasExp = (char.expertise || []).includes(skill.id);

          let bonus = abMod;
          if (hasExp) bonus += (pb * 2);
          else if (isProf) bonus += pb;

          return `
            <div class="beyond-skill-row ${hasExp ? 'has-exp' : isProf ? 'has-prof' : ''} clickable" onclick="window.app.rollSkillCheck('${skill.name}', ${bonus})" title="Tirar prueba de ${skill.name} (d20 ${bonus >= 0 ? '+' : ''}${bonus})">
              <span class="col-pin beyond-pin-icon" title="Fijar / Habilidad oficial">📌</span>
              <span class="col-prof beyond-skill-dot ${hasExp ? 'exp' : isProf ? 'prof' : ''}" title="${hasExp ? 'Pericia (Doble competencia)' : isProf ? 'Competente' : 'No competente'}">
                ${hasExp ? '★' : isProf ? '●' : '○'}
              </span>
              <span class="col-attr beyond-attr-pill">${skill.ability.substring(0, 3).toUpperCase()}</span>
              <span class="col-name beyond-skill-title">${skill.name}</span>
              <div class="col-bonus">
                <button class="beyond-bonus-pill">
                  ${bonus >= 0 ? '+' : ''}${bonus}
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- HABILIDADES Y PODERES ESPECIALES DE SUBCLASE -->
      ${subclassDef && (subclassDef.features || []).length > 0 ? `
        <div class="subclass-skills-section" style="margin-top: 1.5rem;">
          <div class="pane-header" style="margin-bottom: 1rem;">
            <h4 class="pane-title" style="font-size: 1.15rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span>⚡ Habilidades y Poderes de Subclase:</span>
              <span style="color: #fef08a;">${subclassDef.name}</span>
              <span class="sheet-tag" style="background: rgba(234, 179, 8, 0.2); color: #facc15; font-size: 0.72rem; border: 1px solid rgba(234, 179, 8, 0.4);">Nv ${subclassDef.unlockLevel || 3}+</span>
            </h4>
            <p class="pane-desc">Capacidades tácticas, poderes especiales y bonificadores pasivos concedidos automáticamente por tu especialización activa en D&D 2024.</p>
          </div>

          <div class="subclass-skills-list-grid">
            ${subclassDef.features.map(f => {
              const isUnlocked = f.level <= (char.level || 1);
              return `
                <div class="subclass-skill-card ${isUnlocked ? 'active' : 'locked'}">
                  <div class="subclass-skill-header">
                    <span class="skill-lvl-badge ${isUnlocked ? 'unlocked' : 'locked'}">Nv ${f.level}</span>
                    <strong class="subclass-skill-name">${f.name}</strong>
                    ${isUnlocked ? '<span class="subclass-skill-status active">✓ Desbloqueada</span>' : '<span class="subclass-skill-status locked">🔒 Desbloquea a Nv ' + f.level + '</span>'}
                  </div>
                  <p class="subclass-skill-body">${f.desc}</p>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// HELPER: OBTENER CONJUROS DESBLOQUEADOS POR SUBCLASE
export function getUnlockedSubclassSpells(char, subclassDef, spellsDatabase) {
  if (!subclassDef || !Array.isArray(subclassDef.spells) || subclassDef.spells.length === 0) {
    return [];
  }

  const charLevel = char.level || 1;
  const classId = (char.classId || '').toLowerCase();

  let unlockedCount = subclassDef.spells.length;
  if (['clerigo', 'brujo', 'druida', 'hechicero'].includes(classId)) {
    if (charLevel < 3) unlockedCount = 0;
    else if (charLevel < 5) unlockedCount = Math.min(4, subclassDef.spells.length);
    else if (charLevel < 7) unlockedCount = Math.min(6, subclassDef.spells.length);
    else if (charLevel < 9) unlockedCount = Math.min(8, subclassDef.spells.length);
  } else if (['paladin', 'explorador'].includes(classId)) {
    if (charLevel < 3) unlockedCount = 0;
    else if (charLevel < 5) unlockedCount = Math.min(2, subclassDef.spells.length);
    else if (charLevel < 9) unlockedCount = Math.min(4, subclassDef.spells.length);
    else if (charLevel < 13) unlockedCount = Math.min(6, subclassDef.spells.length);
    else if (charLevel < 17) unlockedCount = Math.min(8, subclassDef.spells.length);
  } else {
    if (charLevel < 3) unlockedCount = 0;
  }

  return subclassDef.spells.slice(0, unlockedCount);
}

// PESTAÑA 3: CONJUROS Y GESTIÓN DE HECHIZOS (SECCIÓN 12)
function renderSpellsTab({ char, classDef, subclassDef, spellsDatabase, abs, pb }) {
  const subclassId = char.subclassId || '';
  const spellProg = Rules.getSpellcastingProgression(char.classId, char.level || 1, subclassId);
  const subclassSpells = getUnlockedSubclassSpells(char, subclassDef, spellsDatabase);
  const isCaster = spellProg.isSpellcaster || (classDef.spellcasting !== null && classDef.spellcasting !== undefined) || subclassSpells.length > 0;

  if (!isCaster) {
    return `
      <div class="tab-pane">
        <div class="alert-box" style="margin: 2rem auto; max-width: 600px; text-align: center;">
          <h3 style="color: var(--gold); margin-bottom: 0.5rem;">Sin Lanzamiento de Conjuros</h3>
          <p style="color: var(--text-muted);">Tu clase (<strong>${classDef.name || 'actual'}</strong>) no posee rasgos de lanzamiento de conjuros.</p>
        </div>
      </div>
    `;
  }

  const spellStats = Rules.calculateSpellcastingStats(classDef, abs, pb, null, subclassId);
  const prepSpells = char.preparedSpells || [];
  let cantrips = [...(char.cantrips || [])];
  if (subclassId === 'embaucador_arcano' && !cantrips.includes('Mano de mago')) {
    cantrips.push('Mano de mago');
  }
  const spellbook = char.spellbook || [];

  const spellSlots = spellProg.spellSlots || classDef.spellcasting?.spellSlots || (subclassSpells.length > 0 ? { "1": 2 } : { "1": 2 });
  const maxSpellLevel = spellProg.maxSpellLevel || (subclassSpells.length > 0 ? 1 : 1);
  const preparedCapacity = spellProg.preparedCount || 4;

  const effectiveClassId = ['caballero_arcano', 'embaucador_arcano'].includes(subclassId) ? 'mago' : char.classId;
  const availableSpells = getClassSpells(effectiveClassId, maxSpellLevel, spellsDatabase);
  const newlyUnlockedLevel = maxSpellLevel > 1 ? maxSpellLevel : null;

  return `
    <div class="tab-pane">
      <div class="pane-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h3 class="pane-title">Lanzamiento de Conjuros: ${classDef.name || ''} ${subclassDef ? `(${subclassDef.name})` : ''}</h3>
          <p class="pane-desc">Aptitud mágica: <strong>${spellStats?.ability?.toUpperCase() || 'INT'}</strong> | Hechizos desbloqueados hasta: <strong>Nivel ${maxSpellLevel}</strong> | Preparados de clase: <strong>${prepSpells.length} / ${preparedCapacity}</strong> ${subclassSpells.length > 0 ? `<span style="color: #fef08a; font-weight: bold;">(+${subclassSpells.length} de Subclase)</span>` : ''}</p>
        </div>
      </div>

      <!-- SUB-PESTAÑAS DE CONJUROS (PREPARADOS VS SELECCIONAR HECHIZOS) -->
      <div class="spells-subtabs-nav">
        <button 
          class="btn-spell-subtab ${activeSpellSubTab === 'prepared' ? 'active' : ''}" 
          onclick="window.app.setSpellSubTab('prepared')"
        >
          🔮 Conjuros Preparados (${prepSpells.length + subclassSpells.length}) y Ranuras
        </button>
        <button 
          class="btn-spell-subtab btn-spell-subtab-select ${activeSpellSubTab === 'select' ? 'active' : ''}" 
          onclick="window.app.setSpellSubTab('select')"
        >
          ✨ Seleccionar Hechizos
          ${newlyUnlockedLevel ? `<span class="badge-new-spell-level">¡Nivel ${newlyUnlockedLevel}!</span>` : ''}
        </button>
      </div>

      ${activeSpellSubTab === 'prepared' ? renderPreparedSpellsView({
        char, classDef, subclassDef, spellStats, spellsDatabase, spellSlots, maxSpellLevel, preparedCapacity, prepSpells, subclassSpells, cantrips, spellbook, newlyUnlockedLevel
      }) : renderSelectSpellsView({
        char, classDef, subclassDef, spellsDatabase, maxSpellLevel, preparedCapacity, prepSpells, subclassSpells, cantrips, availableSpells, newlyUnlockedLevel
      })}
    </div>
  `;
}

function renderPreparedSpellsView({
  char, classDef, subclassDef, spellStats, spellsDatabase, spellSlots, maxSpellLevel, preparedCapacity, prepSpells, subclassSpells = [], cantrips, spellbook, newlyUnlockedLevel
}) {
  const slotLevels = Object.keys(spellSlots).sort((a, b) => Number(a) - Number(b));

  return `
    <!-- ESTADÍSTICAS MÁGICAS Y RANURAS DINÁMICAS POR NIVEL -->
    <div class="spell-stats-strip">
      <div class="spell-stat-card">
        <span class="sstat-label">CD SALVACIÓN</span>
        <span class="sstat-val">${spellStats?.saveDc || 13}</span>
      </div>
      <div class="spell-stat-card">
        <span class="sstat-label">BONO ATAQUE MÁGICO</span>
        <span class="sstat-val">+${spellStats?.attackBonus || 5}</span>
      </div>

      ${slotLevels.map(slotLvl => {
        const maxSlots = spellSlots[slotLvl] || 0;
        const used = char.usedSpellSlots?.[slotLvl] || 0;
        return `
          <div class="spell-stat-card">
            <span class="sstat-label">RANURAS NIVEL ${slotLvl}</span>
            <div class="spell-slots-tracker">
              ${Array.from({ length: maxSlots }).map((_, i) => {
                const isUsed = i < used;
                return `
                  <span 
                    class="slot-bubble ${isUsed ? 'used' : 'available'}" 
                    onclick="window.app.toggleSpellSlot('${char.id}', '${slotLvl}', ${i})" 
                    title="${isUsed ? 'Ranura gastada (Clic para recuperar)' : 'Ranura disponible (Clic para gastar)'}"
                  >
                    ${isUsed ? '✖' : '●'}
                  </span>
                `;
              }).join('')}
            </div>
            <span style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-top: 0.25rem;">
              ${Math.max(0, maxSlots - used)} / ${maxSlots} disponibles
            </span>
          </div>
        `;
      }).join('')}
    </div>

    <!-- BARRA DE ACCESO A SELECCIONAR HECHIZOS -->
    <div class="prepared-spells-toolbar">
      <div class="prepared-counter-info">
        <span>Capacidad de preparación de clase: <strong>${prepSpells.length} / ${preparedCapacity}</strong> conjuros</span>
        ${subclassSpells.length > 0 ? `<span class="badge-subclass-prep-count">+${subclassSpells.length} de Subclase</span>` : ''}
        ${newlyUnlockedLevel ? `<span class="tag-unlocked-level">✨ Nivel ${newlyUnlockedLevel} Desbloqueado</span>` : ''}
      </div>
      <button class="btn btn-secondary btn-sm" onclick="window.app.setSpellSubTab('select')">
        ✨ Cambiar / Seleccionar Hechizos
      </button>
    </div>

    <!-- CONJUROS DE SUBCLASE AUTOMÁTICOS (SIEMPRE PREPARADOS) -->
    ${subclassSpells.length > 0 ? `
      <div class="spells-section-group subclass-spells-group" style="margin-top: 1.5rem;">
        <div class="spells-group-header">
          <h4 class="spell-group-title" style="color: #fef08a; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span>🛡️ Conjuros de Subclase: ${subclassDef?.name || 'Especialización'}</span>
            <span class="badge-always-prepared">✨ Siempre Preparados</span>
          </h4>
          <span class="spell-group-count" style="background: rgba(234, 179, 8, 0.2); color: #fef08a; border: 1px solid rgba(234, 179, 8, 0.4);">${subclassSpells.length} conjuro(s)</span>
        </div>
        <p style="font-size: 0.8rem; color: #94a3b8; margin: 0.25rem 0 0.85rem 0;">
          Otorgados automáticamente por tu subclase activa. No consumen tus ${preparedCapacity} espacios de preparación y puedes lanzarlos consumiendo tus ranuras de conjuro habituales.
        </p>
        <div class="spells-list-grid">
          ${subclassSpells.map((sp, idx) => {
            const detail = getSpellDetail(sp, spellsDatabase);
            let lvl = 1;
            if (detail?.typeLine) {
              const m = detail.typeLine.match(/nivel\s+(\d+)/i);
              if (m) lvl = parseInt(m[1], 10);
            }
            const drawerId = `sheet-sp-subclass-${idx}`;
            return `
              <div class="spell-sheet-item subclass-spell-item">
                <div class="spell-item-header">
                  <div>
                    <strong class="spell-item-name">${sp}</strong>
                    <span class="spell-level-badge badge-level-${lvl}">Nivel ${lvl}</span>
                    <span class="badge-subclass-tag">🛡️ Subclase</span>
                  </div>
                  <div style="display: flex; gap: 0.3rem;">
                      <button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; letter-spacing: 0.05em; border-radius: 4px; box-shadow: 0 0 10px rgba(234, 179, 8, 0.2);" onclick="window.app.castSpell('${char.id}', '${sp}', 'Nivel ${lvl}', ${lvl})">
                        🪄 LANZAR
                      </button>
                      <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-radius: 4px;" onclick="window.app.showSpellInfoModal('${sp}')" title="Ver detalles del conjuro">
                        ℹ️
                      </button>
                    </div>
                  </div>
                </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}

    <!-- TRUCOS (NIVEL 0) -->
    <div class="spells-section-group" style="margin-top: 1.5rem;">
      <div class="spells-group-header">
        <h4 class="spell-group-title">✨ Trucos Conocidos (Nivel 0)</h4>
        <span class="spell-group-count">${cantrips.length} trucos</span>
      </div>
      <div class="spells-list-grid">
        ${cantrips.length === 0 ? '<p style="color: var(--text-muted); font-size: 0.85rem;">Ningún truco aprendido actualmente. Puedes seleccionarlos en "Seleccionar Hechizos".</p>' : ''}
        ${cantrips.map((sp, idx) => {
          const detail = getSpellDetail(sp, spellsDatabase);
          const drawerId = `sheet-sp-cantrip-${idx}`;
          return `
            <div class="spell-sheet-item">
              <div class="spell-item-header">
                <div>
                  <strong class="spell-item-name">${sp}</strong>
                  <span class="spell-level-badge badge-cantrip">Truco</span>
                </div>
                <div style="display: flex; gap: 0.3rem;">
                      <button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; letter-spacing: 0.05em; border-radius: 4px; box-shadow: 0 0 10px rgba(234, 179, 8, 0.2);" onclick="window.app.castSpell('${char.id}', '${sp}', 'Truco', 0)">
                        🪄 LANZAR
                      </button>
                      <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-radius: 4px;" onclick="window.app.showSpellInfoModal('${sp}')" title="Ver detalles del conjuro">
                        ℹ️
                      </button>
                    </div>
                  </div>
                </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- CONJUROS PREPARADOS AGRUPADOS POR NIVEL -->
    ${(() => {
      if (prepSpells.length === 0) {
        return `
          <div class="spells-empty-state" style="margin-top: 1.5rem;">
            <p style="color: var(--text-muted); margin-bottom: 0.75rem;">
              ${subclassSpells.length > 0 ? 'No tienes conjuros de clase preparados adicionales a tus conjuros de subclase.' : 'No tienes ningún conjuro preparado en este momento.'}
            </p>
            <button class="btn btn-primary btn-sm" onclick="window.app.setSpellSubTab('select')">
              ✨ Seleccionar Hechizos de tu clase
            </button>
          </div>
        `;
      }

      // Agrupar por nivel
      const byLvl = {};
      prepSpells.forEach(sp => {
        const detail = getSpellDetail(sp, spellsDatabase);
        let lvl = 1;
        if (detail?.typeLine) {
          const m = detail.typeLine.match(/nivel\s+(\d+)/i);
          if (m) lvl = parseInt(m[1], 10);
        }
        if (!byLvl[lvl]) byLvl[lvl] = [];
        byLvl[lvl].push({ name: sp, detail });
      });

      const levels = Object.keys(byLvl).sort((a, b) => Number(a) - Number(b));

      return levels.map(lvl => `
        <div class="spells-section-group" style="margin-top: 1.5rem;">
          <div class="spells-group-header">
            <h4 class="spell-group-title">🔮 Conjuros Preparados de Nivel ${lvl}</h4>
            <span class="spell-group-count">${byLvl[lvl].length} conjuro(s)</span>
          </div>
          <div class="spells-list-grid">
            ${byLvl[lvl].map((item, idx) => {
              const sp = item.name;
              const detail = item.detail;
              const drawerId = `sheet-sp-prep-l${lvl}-${idx}`;
              return `
                <div class="spell-sheet-item">
                  <div class="spell-item-header">
                    <div>
                      <strong class="spell-item-name">${sp}</strong>
                      <span class="spell-level-badge badge-level-${lvl}">Nivel ${lvl}</span>
                    </div>
                    <div style="display: flex; gap: 0.3rem;">
                      <button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; letter-spacing: 0.05em; border-radius: 4px; box-shadow: 0 0 10px rgba(234, 179, 8, 0.2);" onclick="window.app.castSpell('${char.id}', '${sp}', 'Nivel ${lvl}', ${lvl})">
                        🪄 LANZAR
                      </button>
                      <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-radius: 4px;" onclick="window.app.showSpellInfoModal('${sp}')" title="Ver detalles del conjuro">
                        ℹ️
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `).join('');
    })()}

    ${char.classId === 'mago' && spellbook.length > 0 ? `
      <div class="spells-section-group" style="margin-top: 1.5rem;">
        <h4 class="spell-group-title">📖 Libro de Conjuros del Mago (Grimorio)</h4>
        <p class="form-help" style="margin-bottom: 0.5rem;">Conjuros registrados en tu grimorio disponibles para preparar:</p>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          ${spellbook.map(sp => {
            const isPrepared = prepSpells.includes(sp);
            return `
              <span class="sheet-tag" style="background: ${isPrepared ? 'rgba(34, 197, 94, 0.15)' : '#1e293b'}; color: ${isPrepared ? '#86efac' : '#d8b4fe'}; border-color: ${isPrepared ? 'rgba(34, 197, 94, 0.4)' : 'var(--border-color)'};">
                ${sp} ${isPrepared ? '✓' : ''}
              </span>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

function renderSelectSpellsView({
  char, classDef, subclassDef, spellsDatabase, maxSpellLevel, preparedCapacity, prepSpells, subclassSpells = [], cantrips, availableSpells, newlyUnlockedLevel
}) {
  const availableLevels = Array.from(new Set(availableSpells.map(s => s.level))).sort((a, b) => a - b);

  const query = (spellSearchFilter || '').toLowerCase().trim();
  const filteredSpells = availableSpells.filter(sp => {
    if (spellLevelFilter !== 'all') {
      if (sp.level !== Number(spellLevelFilter)) return false;
    }
    if (query) {
      const matchName = sp.name.toLowerCase().includes(query);
      const matchType = (sp.typeLine || '').toLowerCase().includes(query);
      if (!matchName && !matchType) return false;
    }
    return true;
  });

  return `
    <div class="spell-selector-container">
      <!-- HEADER CON RESUMEN Y CAPACIDAD -->
      <div class="spell-selector-banner">
        <div class="selector-banner-left">
          <h4 class="selector-banner-title">✨ Gestión y Selección de Hechizos</h4>
          <p class="selector-banner-desc">
            Selecciona qué conjuros tendrás preparados para combate. Al subir de nivel, se desbloquean automáticamente los hechizos de nuevo nivel según tu clase.
          </p>
        </div>
        <div class="selector-banner-right">
          <div class="capacity-pill ${prepSpells.length > preparedCapacity ? 'overflow' : ''}">
            <span class="cap-label">Preparados:</span>
            <span class="cap-val">${prepSpells.length} / ${preparedCapacity}</span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.app.setSpellSubTab('prepared')">
            ← Volver a Preparados
          </button>
        </div>
      </div>

      <!-- BANNER DE CONJUROS DE SUBCLASE AUTOMÁTICOS -->
      ${subclassSpells.length > 0 ? `
        <div class="subclass-granted-spells-card">
          <div class="subclass-granted-header">
            <span class="subclass-granted-icon">🛡️</span>
            <div>
              <strong>Conjuros Otorgados por tu Subclase (${subclassDef?.name || 'Subclase'}):</strong>
              <div style="font-size: 0.8rem; color: #cbd5e1;">Estos conjuros están preparados automáticamente en tu repertorio y no consumen tu límite de ${preparedCapacity} conjuros de clase.</div>
            </div>
          </div>
          <div class="subclass-granted-chips">
            ${subclassSpells.map(spName => {
              const spDetail = getSpellDetail(spName, spellsDatabase);
              let lvl = 1;
              if (spDetail?.typeLine) {
                const m = spDetail.typeLine.match(/nivel\s+(\d+)/i);
                if (m) lvl = parseInt(m[1], 10);
              }
              return `
                <span class="granted-spell-pill">
                  <span class="granted-spell-dot">●</span>
                  <strong>${spName}</strong>
                  <span class="granted-spell-lvl">Nv.${lvl}</span>
                </span>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- BANNER DE NUEVO NIVEL DESBLOQUEADO -->
      ${newlyUnlockedLevel ? `
        <div class="level-unlocked-alert">
          <div class="alert-sparkle">⭐</div>
          <div class="alert-content">
            <strong>¡Conjuros de Nivel ${newlyUnlockedLevel} Desbloqueados!</strong>
            <div>Tu personaje es Nivel ${char.level || 1} y tiene acceso a conjuros de <strong>Nivel ${newlyUnlockedLevel}</strong>. Puedes prepararlos aquí abajo para tenerlos disponibles en combate.</div>
          </div>
          <button class="btn btn-outline btn-xs" onclick="window.app.setSpellLevelFilter(${newlyUnlockedLevel})">
            Ver solo Nivel ${newlyUnlockedLevel}
          </button>
        </div>
      ` : ''}

      <!-- TOOLBAR DE FILTROS Y BÚSQUEDA -->
      <div class="spell-filter-toolbar">
        <div class="spell-level-chips">
          <button 
            class="chip-level-filter ${spellLevelFilter === 'all' ? 'active' : ''}" 
            onclick="window.app.setSpellLevelFilter('all')"
          >
            Todos (${availableSpells.length})
          </button>
          ${availableLevels.map(lvl => {
            const count = availableSpells.filter(s => s.level === lvl).length;
            const label = lvl === 0 ? 'Trucos' : `Nivel ${lvl}`;
            const isNew = lvl === newlyUnlockedLevel;
            return `
              <button 
                class="chip-level-filter ${spellLevelFilter === lvl ? 'active' : ''} ${isNew ? 'is-new-level' : ''}" 
                onclick="window.app.setSpellLevelFilter(${lvl})"
              >
                ${label} (${count}) ${isNew ? '⭐' : ''}
              </button>
            `;
          }).join('')}
        </div>

        <div class="spell-search-box">
          <input 
            type="text" 
            class="input-text spell-search-input" 
            placeholder="🔍 Buscar por nombre o escuela..." 
            value="${spellSearchFilter}"
            oninput="window.app.setSpellSearchFilter(this.value)"
          >
          ${spellSearchFilter ? `
            <button class="btn-clear-search" onclick="window.app.setSpellSearchFilter('')" title="Borrar filtro">✕</button>
          ` : ''}
        </div>
      </div>

      <!-- LISTADO DE HECHIZOS PARA SELECCIONAR -->
      <div class="spell-selection-grid">
        ${filteredSpells.length === 0 ? `
          <div class="spells-none-found">
            <p>No se encontraron hechizos con los filtros actuales.</p>
          </div>
        ` : filteredSpells.map((sp, idx) => {
          const isCantrip = sp.isCantrip || sp.level === 0;
          const isSubclassGranted = subclassSpells.includes(sp.name);
          const isSelected = isCantrip ? cantrips.includes(sp.name) : (isSubclassGranted || prepSpells.includes(sp.name));
          const drawerId = `select-sp-detail-${sp.level}-${idx}`;
          const badgeClass = isCantrip ? 'badge-cantrip' : `badge-level-${sp.level}`;

          return `
            <div class="spell-select-card ${isSelected ? 'selected' : ''} ${isSubclassGranted ? 'subclass-granted-item' : ''}">
              <div class="spell-select-card-header">
                <div class="spell-select-info">
                  <span class="spell-select-name">${sp.name}</span>
                  <div class="spell-select-meta">
                    <span class="spell-level-badge ${badgeClass}">${sp.levelLabel}</span>
                    <span class="spell-school-text">${sp.typeLine?.split('(')[0]?.trim() || ''}</span>
                    ${isSubclassGranted ? `<span class="badge-granted-subclass">🛡️ De Subclase</span>` : ''}
                  </div>
                </div>
                <div class="spell-select-actions">
                  <button class="btn btn-secondary btn-xs" onclick="window.app.toggleOptionDetail('${drawerId}')" title="Ver detalles del conjuro">
                    ℹ️
                  </button>
                  ${isSubclassGranted ? `
                    <button 
                      class="btn btn-sm btn-subclass-granted" 
                      disabled 
                      title="Otorgado permanentemente por tu subclase (${subclassDef?.name || ''})"
                    >
                      🛡️ De Subclase
                    </button>
                  ` : `
                    <button 
                      class="btn btn-sm ${isSelected ? 'btn-unprepare' : 'btn-prepare'}" 
                      onclick="window.app.togglePreparedSpell('${char.id}', '${sp.name}', ${isCantrip})"
                      title="${isSelected ? 'Quitar de preparados' : 'Añadir a preparados'}"
                    >
                      ${isSelected ? '✓ Preparado' : '➕ Preparar'}
                    </button>
                  `}
                </div>
              </div>

              <!-- DETALLES RÁPIDOS -->
              <div class="spell-mini-pills">
                <span>⏱️ ${sp.castingTime || '1 acción'}</span>
                <span>📏 ${sp.range || '18 m'}</span>
                <span>🧩 ${sp.components || 'V, S'}</span>
                <span>⏳ ${sp.duration || 'Instantánea'}</span>
              </div>

              <!-- DRAWER CON DESCRIPCIÓN OFICIAL -->
              <div id="${drawerId}" class="option-drawer hidden" style="margin-top: 0.5rem;">
                <div class="drawer-header">
                  <span class="drawer-title">${sp.name}</span>
                  <span class="drawer-type">${sp.typeLine}</span>
                </div>
                <div class="drawer-desc" style="max-height: 200px; overflow-y: auto;">
                  ${sp.desc || 'Sin descripción adicional.'}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// PESTAÑA 4: INVENTARIO Y EQUIPO (SECCIÓN 10 Y 11)
function renderInventoryMobileCards(items, char, isEquippedSection) {
  if (!items || items.length === 0) {
    return `
      <div class="inv-mobile-cards-container">
        <div class="inv-mobile-empty">
          ${isEquippedSection ? '🛡️ Ningún objeto equipado en combate' : '🎒 La mochila está vacía'}
        </div>
      </div>
    `;
  }

  return `
    <div class="inv-mobile-cards-container">
      ${items.map(item => {
        const unitWeight = parseFloat(item.weight) || 0;
        const qty = parseInt(item.quantity, 10) || 1;
        const totalItemWeight = (unitWeight * qty).toFixed(1);
        const isEquipped = Boolean(item.equipped);

        return `
          <div class="inv-mobile-card ${isEquipped ? 'inv-card-equipped' : 'inv-card-backpack'}">
            <div class="inv-card-main-content">
              <div class="inv-card-status-bar">
                <span class="${isEquipped ? 'badge-equipped' : 'badge-backpack'}">
                  ${isEquipped ? '🛡️ Equipado' : '🎒 En mochila'}
                </span>
                <span class="inv-card-weight-pill">
                  ⚖️ ${unitWeight > 0 ? `${totalItemWeight} lb` : '0 lb'}
                  ${qty > 1 && unitWeight > 0 ? `<span class="inv-weight-unit">(${unitWeight} c/u)</span>` : ''}
                </span>
              </div>

              <div class="inv-card-info">
                <div class="inv-card-name-text">${item.name}</div>
                ${item.properties ? `
                  <div class="inv-card-desc-pill">
                    ${item.properties}
                  </div>
                ` : ''}
              </div>
            </div>

            <div class="inv-card-action-bar">
              <div class="inv-card-qty-stepper">
                <span class="inv-qty-label">Cant:</span>
                <div class="inv-qty-controls">
                  <button type="button" class="btn-qty-mobile" onclick="window.app.changeItemQty('${char.id}', '${item.id}', -1)" title="Restar 1" aria-label="Restar">−</button>
                  <span class="inv-qty-number">${qty}</span>
                  <button type="button" class="btn-qty-mobile" onclick="window.app.changeItemQty('${char.id}', '${item.id}', 1)" title="Sumar 1" aria-label="Sumar">+</button>
                </div>
              </div>

              <div class="inv-card-btn-cluster">
                ${isEquipped ? `
                  <button type="button" class="btn-inv-action-mobile btn-inv-unequip" onclick="window.app.toggleItemEquip('${char.id}', '${item.id}')">
                    <span class="btn-inv-icon">🛡️</span> Desequipar
                  </button>
                ` : `
                  <button type="button" class="btn-inv-action-mobile btn-inv-equip" onclick="window.app.toggleItemEquip('${char.id}', '${item.id}')">
                    <span class="btn-inv-icon">⚔️</span> Equipar
                  </button>
                `}
                <button type="button" class="btn-inv-action-mobile btn-inv-delete" onclick="window.app.deleteInventoryItem('${char.id}', '${item.id}')" title="Eliminar objeto" aria-label="Eliminar">
                  🗑
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Generador de iconos SVG vectoriales para monedas auténticas de D&D (Oro, Plata, Cobre)
 * Reemplaza emojis de medallas deportivas por monedas troqueladas con relieve metálico.
 */
export function renderCoinSvg(type = 'gold', size = 18) {
  const configs = {
    gold: {
      gradBase: ['#fff08a', '#eab308', '#854d0e'],
      rim: '#713f12',
      inner: ['#fde047', '#ca8a04'],
      symbolColor: '#fef9c3',
      symbolStroke: '#713f12',
      symbolPath: 'M12 6.5 L15.5 12 L12 17.5 L8.5 12 Z' // Rombo/Diamante facetado de oro
    },
    silver: {
      gradBase: ['#ffffff', '#cbd5e1', '#475569'],
      rim: '#334155',
      inner: ['#f8fafc', '#94a3b8'],
      symbolColor: '#ffffff',
      symbolStroke: '#334155',
      symbolPath: 'M12 6 L13.6 10.4 L18 12 L13.6 13.6 L12 18 L10.4 13.6 L6 12 L10.4 10.4 Z' // Estrella de plata de 4 puntas
    },
    copper: {
      gradBase: ['#ffedd5', '#ea580c', '#7c2d12'],
      rim: '#431407',
      inner: ['#fdba74', '#c2410c'],
      symbolColor: '#ffedd5',
      symbolStroke: '#431407',
      symbolPath: 'M12 7.5 A4.5 4.5 0 1 0 12.01 7.5 M12 10.2 A1.8 1.8 0 1 1 11.99 10.2' // Troquel circular de moneda de cobre
    }
  };

  const c = configs[type] || configs.gold;

  return `<svg class="coin-svg-icon coin-svg-${type}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<defs>` +
      `<linearGradient id="coinGradBase-${type}" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">` +
        `<stop offset="0%" stop-color="${c.gradBase[0]}"/>` +
        `<stop offset="50%" stop-color="${c.gradBase[1]}"/>` +
        `<stop offset="100%" stop-color="${c.gradBase[2]}"/>` +
      `</linearGradient>` +
      `<linearGradient id="coinGradInner-${type}" x1="5" y1="5" x2="19" y2="19" gradientUnits="userSpaceOnUse">` +
        `<stop offset="0%" stop-color="${c.inner[0]}"/>` +
        `<stop offset="100%" stop-color="${c.inner[1]}"/>` +
      `</linearGradient>` +
    `</defs>` +
    `<circle cx="12" cy="12" r="10.5" fill="url(#coinGradBase-${type})" stroke="${c.rim}" stroke-width="1.1"/>` +
    `<circle cx="12" cy="12" r="8.5" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="0.75" stroke-dasharray="1.5 1"/>` +
    `<circle cx="12" cy="12" r="6.8" fill="url(#coinGradInner-${type})" stroke="${c.rim}" stroke-width="0.65" opacity="0.95"/>` +
    `<path d="${c.symbolPath}" fill="${c.symbolColor}" stroke="${c.symbolStroke}" stroke-width="0.7"/>` +
  `</svg>`;
}

if (typeof window !== 'undefined') {
  window.renderCoinSvg = renderCoinSvg;
}

function renderCurrencyPursePanel(char, charGold, charSilver, charCopper) {
  const g = typeof charGold === 'number' && !isNaN(charGold) ? charGold : (char.gold || 0);
  const s = typeof charSilver === 'number' && !isNaN(charSilver) ? charSilver : (char.silver || 0);
  const c = typeof charCopper === 'number' && !isNaN(charCopper) ? charCopper : (char.copper || 0);
  const totalCoins = g + s + c;
  const coinsWeight = (totalCoins / 50).toFixed(1);

  return `
    <div class="inventory-currency-card">
      <div class="currency-card-header">
        <div class="currency-header-info">
          <h4 class="currency-card-title">💰 Bolsa de Monedas</h4>
          <span class="currency-card-subtitle">
            Control manual • Peso total: ~${coinsWeight} lb (${totalCoins} monedas • 50 uds = 1 lb)
          </span>
        </div>
      </div>

      <!-- GRID DE 3 TARJETAS METÁLICAS: ORO, PLATA Y COBRE (MONEDAS REALES) -->
      <div class="currency-badges-grid">
        <!-- ORO (PO) -->
        <div 
          class="currency-badge-card badge-gold" 
          onclick="window.app.promptSetDirectCurrency('${char.id}', 'gold')" 
          title="Clic para fijar cantidad exacta de Oro (PO)"
        >
          <div class="currency-badge-top">
            <span class="currency-badge-icon">${renderCoinSvg('gold', 22)}</span>
            <span class="currency-badge-label">Oro</span>
          </div>
          <div class="currency-badge-value-row">
            <span class="currency-badge-number" id="currency-gold-val-${char.id}">${g}</span>
            <span class="currency-badge-unit">PO</span>
            <span class="currency-badge-edit-hint">✏️</span>
          </div>
        </div>

        <!-- PLATA (PP) -->
        <div 
          class="currency-badge-card badge-silver" 
          onclick="window.app.promptSetDirectCurrency('${char.id}', 'silver')" 
          title="Clic para fijar cantidad exacta de Plata (PP)"
        >
          <div class="currency-badge-top">
            <span class="currency-badge-icon">${renderCoinSvg('silver', 22)}</span>
            <span class="currency-badge-label">Plata</span>
          </div>
          <div class="currency-badge-value-row">
            <span class="currency-badge-number" id="currency-silver-val-${char.id}">${s}</span>
            <span class="currency-badge-unit">PP</span>
            <span class="currency-badge-edit-hint">✏️</span>
          </div>
        </div>

        <!-- COBRE (PC) -->
        <div 
          class="currency-badge-card badge-copper" 
          onclick="window.app.promptSetDirectCurrency('${char.id}', 'copper')" 
          title="Clic para fijar cantidad exacta de Cobre (PC)"
        >
          <div class="currency-badge-top">
            <span class="currency-badge-icon">${renderCoinSvg('copper', 22)}</span>
            <span class="currency-badge-label">Cobre</span>
          </div>
          <div class="currency-badge-value-row">
            <span class="currency-badge-number" id="currency-copper-val-${char.id}">${c}</span>
            <span class="currency-badge-unit">PC</span>
            <span class="currency-badge-edit-hint">✏️</span>
          </div>
        </div>
      </div>

      <!-- BARRA UNIFICADA DE MODIFICACIÓN SIMPLE (SIN BOTONES 1, 5, 10, 50, 100) -->
      <div class="currency-card-body">
        <div class="currency-action-bar">
          <!-- SELECTOR DE MONEDA ACTIVA CON ICONOS DE MONEDA REALES -->
          <div class="coin-selector-pills">
            <button 
              type="button" 
              class="coin-pill-btn active" 
              data-char="${char.id}" 
              data-cointype="gold"
              onclick="window.app.selectCoinType('${char.id}', 'gold')"
              title="Operar con Oro (PO)"
            >
              ${renderCoinSvg('gold', 15)} <span class="coin-pill-text">Oro</span>
            </button>
            <button 
              type="button" 
              class="coin-pill-btn" 
              data-char="${char.id}" 
              data-cointype="silver"
              onclick="window.app.selectCoinType('${char.id}', 'silver')"
              title="Operar con Plata (PP)"
            >
              ${renderCoinSvg('silver', 15)} <span class="coin-pill-text">Plata</span>
            </button>
            <button 
              type="button" 
              class="coin-pill-btn" 
              data-char="${char.id}" 
              data-cointype="copper"
              onclick="window.app.selectCoinType('${char.id}', 'copper')"
              title="Operar con Cobre (PC)"
            >
              ${renderCoinSvg('copper', 15)} <span class="coin-pill-text">Cobre</span>
            </button>
          </div>

          <!-- INPUT DE CANTIDAD -->
          <div class="coin-input-wrapper">
            <span class="coin-input-prefix" id="coin-input-prefix-${char.id}">
              ${renderCoinSvg('gold', 18)}
            </span>
            <input 
              type="number" 
              id="coin-delta-input-${char.id}" 
              class="coin-number-input" 
              value="10" 
              min="1" 
              step="1"
              placeholder="10" 
              inputmode="numeric"
              title="Cantidad a sumar o restar"
            />
          </div>

          <!-- BOTONES SUMAR Y RESTAR -->
          <div class="coin-btn-group">
            <button 
              type="button" 
              class="btn-coin-action btn-coin-add" 
              onclick="window.app.modifyCharacterCurrency('${char.id}', 1)"
              title="Sumar cantidad a la moneda seleccionada"
            >
              <span class="coin-btn-icon">➕</span> Sumar
            </button>
            <button 
              type="button" 
              class="btn-coin-action btn-coin-sub" 
              onclick="window.app.modifyCharacterCurrency('${char.id}', -1)"
              title="Restar cantidad de la moneda seleccionada"
            >
              <span class="coin-btn-icon">➖</span> Restar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderGoldPursePanel(char, charGold) {
  return renderCurrencyPursePanel(char, charGold, char.silver || 0, char.copper || 0);
}

function renderInventoryTab({ char, abs }) {
  const inventory = char.inventory || [];
  // Auto-generar munición si tienen arco/ballesta pero no tienen la munición
  const hasBow = inventory.some(i => typeof i.name === 'string' && i.name.toLowerCase().includes('arco'));
  const hasCrossbow = inventory.some(i => typeof i.name === 'string' && i.name.toLowerCase().includes('ballesta'));
  const hasSling = inventory.some(i => typeof i.name === 'string' && i.name.toLowerCase().includes('honda'));
  
  if (hasBow && !inventory.some(i => typeof i.name === 'string' && i.name.toLowerCase().includes('flecha'))) {
    inventory.push({ id: 'item_auto_arrows_' + Date.now(), name: 'Carcaj con 20 flechas', type: 'municion', quantity: 1, weight: 1, equipped: false });
  }
  if (hasCrossbow && !inventory.some(i => typeof i.name === 'string' && i.name.toLowerCase().includes('virote'))) {
    inventory.push({ id: 'item_auto_bolts_' + Date.now(), name: 'Caja de 20 virotes', type: 'municion', quantity: 1, weight: 1.5, equipped: false });
  }
  if (hasSling && !inventory.some(i => typeof i.name === 'string' && (i.name.toLowerCase().includes('bala') || i.name.toLowerCase().includes('proyectil')))) {
    inventory.push({ id: 'item_auto_sling_' + Date.now(), name: 'Bolsa con 20 balas de honda', type: 'municion', quantity: 1, weight: 1.5, equipped: false });
  }

  const equippedItems = inventory.filter(i => i.equipped);
  const backpackItems = inventory.filter(i => !i.equipped);

  // Inicialización de monedas según hoja de personaje (D&D 2024: clase + trasfondo)
  const startingCurrencies = (typeof Rules !== 'undefined' && Rules.calculateStartingCurrencies)
    ? Rules.calculateStartingCurrencies({ char, catalogs: state.catalogs })
    : { gold: (typeof Rules !== 'undefined' && Rules.calculateStartingGold) ? Rules.calculateStartingGold({ char, catalogs: state.catalogs }) : 0, silver: 0, copper: 0 };

  const charGold = typeof char.gold === 'number' && !isNaN(char.gold)
    ? char.gold
    : startingCurrencies.gold;
  if (typeof char.gold !== 'number' || isNaN(char.gold)) {
    char.gold = charGold;
  }

  const charSilver = typeof char.silver === 'number' && !isNaN(char.silver)
    ? char.silver
    : startingCurrencies.silver;
  if (typeof char.silver !== 'number' || isNaN(char.silver)) {
    char.silver = charSilver;
  }

  const charCopper = typeof char.copper === 'number' && !isNaN(char.copper)
    ? char.copper
    : startingCurrencies.copper;
  if (typeof char.copper !== 'number' || isNaN(char.copper)) {
    char.copper = charCopper;
  }

  // Capacidad de carga: Fuerza x 15 libras (regla estándar D&D 2024)
  const strScore = abs.fuerza?.score || 10;
  const carryCapacity = strScore * 15;
  const totalWeight = inventory.reduce((acc, i) => acc + ((i.weight || 0) * (i.quantity || 1)), 0);
  const isOverencumbered = totalWeight > carryCapacity;
  const weightPercent = Math.min(100, Math.round((totalWeight / (carryCapacity || 1)) * 100));

  return `
    <div class="tab-pane inventory-tab-pane">
      <!-- CUADRÍCULA SUPERIOR: INVENTARIO Y BOLSA DE MONEDAS LADO A LADO -->
      <div class="inventory-top-grid">
        <!-- MENÚ 1: INVENTARIO Y CAPACIDAD DE CARGA -->
        <div class="inventory-card inventory-capacity-card">
          <div class="inv-cap-header">
            <h3 class="inv-cap-title">🎒 Inventario y Equipo</h3>
            <div class="inv-capacity-summary">
              <div class="inv-capacity-text">
                <span>Capacidad: <strong class="${isOverencumbered ? 'text-red' : 'text-gold'}">${totalWeight.toFixed(1)} / ${carryCapacity} lb</strong></span>
                <small class="text-muted">(Fuerza × 15 lb)</small>
              </div>
              <div class="inv-capacity-bar-track" title="Capacidad de carga ocupada: ${weightPercent}%">
                <div class="inv-capacity-bar-fill ${isOverencumbered ? 'bar-over' : ''}" style="width: ${weightPercent}%;"></div>
              </div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm inv-btn-add-item" onclick="window.app.showAddItemModal('${char.id}')">
            ➕ Añadir Objeto
          </button>
        </div>

        <!-- MENÚ 2: PANEL DE CONTROL DE MONEDAS: ORO, PLATA Y COBRE (MANUAL) -->
        ${renderCurrencyPursePanel(char, charGold, charSilver, charCopper)}
      </div>

      <!-- SECCIÓN 11: EQUIPO ACTUALMENTE EQUIPADO -->
      <div class="inventory-section-block">
        <div class="inventory-section-header">
          <h4 class="inventory-section-title">🛡️ Equipado en Combate <span class="inv-count-badge">${equippedItems.length}</span></h4>
        </div>

        <!-- Vista Desktop: Tabla Tradicional -->
        <div class="inventory-table-container inventory-desktop-view">
          <table class="inventory-table">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Nombre del Objeto</th>
                <th>Cantidad</th>
                <th>Peso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${equippedItems.length === 0 ? `
                <tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem 1rem;">No tienes ningún objeto equipado en combate.</td></tr>
              ` : equippedItems.map(item => `
                <tr>
                  <td><span class="badge-equipped">Equipado</span></td>
                  <td><strong>${item.name}</strong> ${item.properties ? `<span style="color: var(--text-muted); font-size: 0.8rem;">(${item.properties})</span>` : ''}</td>
                  <td>
                    <div class="qty-control">
                      <button class="btn-qty" onclick="window.app.changeItemQty('${char.id}', '${item.id}', -1)" title="Restar 1">-</button>
                      <span>${item.quantity}</span>
                      <button class="btn-qty" onclick="window.app.changeItemQty('${char.id}', '${item.id}', 1)" title="Sumar 1">+</button>
                    </div>
                  </td>
                  <td>${item.weight ? `${(item.weight * (item.quantity || 1)).toFixed(1)} lb` : '--'}</td>
                  <td>
                    <div style="display: inline-flex; gap: 0.35rem; align-items: center;">
                      <button class="btn btn-secondary btn-sm" onclick="window.app.toggleItemEquip('${char.id}', '${item.id}')">Desequipar</button>
                      <button class="btn btn-secondary btn-sm btn-danger" onclick="window.app.deleteInventoryItem('${char.id}', '${item.id}')" title="Eliminar">🗑</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Vista Móvil: Tarjetas Ergonómicas -->
        <div class="inventory-mobile-view">
          ${renderInventoryMobileCards(equippedItems, char, true)}
        </div>
      </div>

      <!-- SECCIÓN 10: INVENTARIO EN MOCHILA -->
      <div class="inventory-section-block" style="margin-top: 1.75rem;">
        <div class="inventory-section-header">
          <h4 class="inventory-section-title">🎒 En la Mochila / Bolsa <span class="inv-count-badge">${backpackItems.length}</span></h4>
        </div>

        <!-- Vista Desktop: Tabla Tradicional -->
        <div class="inventory-table-container inventory-desktop-view">
          <table class="inventory-table">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Nombre del Objeto</th>
                <th>Cantidad</th>
                <th>Peso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${backpackItems.length === 0 ? `
                <tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem 1rem;">Mochila vacía.</td></tr>
              ` : backpackItems.map(item => `
                <tr>
                  <td><span class="badge-backpack">En mochila</span></td>
                  <td><strong>${item.name}</strong> ${item.properties ? `<span style="color: var(--text-muted); font-size: 0.8rem;">(${item.properties})</span>` : ''}</td>
                  <td>
                    <div class="qty-control">
                      <button class="btn-qty" onclick="window.app.changeItemQty('${char.id}', '${item.id}', -1)" title="Restar 1">-</button>
                      <span>${item.quantity}</span>
                      <button class="btn-qty" onclick="window.app.changeItemQty('${char.id}', '${item.id}', 1)" title="Sumar 1">+</button>
                    </div>
                  </td>
                  <td>${item.weight ? `${(item.weight * (item.quantity || 1)).toFixed(1)} lb` : '--'}</td>
                  <td>
                    <div style="display: inline-flex; gap: 0.35rem; align-items: center;">
                      <button class="btn btn-secondary btn-sm" onclick="window.app.toggleItemEquip('${char.id}', '${item.id}')">Equipar</button>
                      <button class="btn btn-secondary btn-sm btn-danger" onclick="window.app.deleteInventoryItem('${char.id}', '${item.id}')" title="Eliminar">🗑</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Vista Móvil: Tarjetas Ergonómicas -->
        <div class="inventory-mobile-view">
          ${renderInventoryMobileCards(backpackItems, char, false)}
        </div>
        </div>

      </div>
    `;
  }

// PESTAÑA 5: RASGOS Y DOTES (SECCIÓN 13 Y 14)
function renderTraitsTab({ char, classDef, speciesDef, bgDef }) {
  const originFeats = state.catalogs.feats.filter(f => f.category === 'Origen');
  const bgFeat = originFeats.find(f => f.id === bgDef.originFeatId);
  const humanFeat = char.humanBonusOriginFeat ? originFeats.find(f => f.id === char.humanBonusOriginFeat) : null;
  const fightingStyle = state.catalogs.feats.find(f => f.id === char.fightingStyle);
  const classFeatures = Rules.getClassFeaturesUpToLevel(char.classId, char.level || 1);
  const subclassDef = char.subclassId ? state.catalogs.subclasses?.find(s => s.id === char.subclassId) : null;

  return `
    <div class="tab-pane">
      <div class="pane-header">
        <h3 class="pane-title">Rasgos, Dotes y Capacidades Especiales</h3>
        <p class="pane-desc">Todos los rasgos obtenidos por tu especie, clase (desbloqueados hasta Nivel ${char.level || 1}), trasfondo y dotes oficiales de D&D 2024.</p>
      </div>

      <div class="traits-container">
        <!-- RASGOS DE CLASE DESBLOQUEADOS POR NIVEL -->
        <div class="trait-card">
          <div class="trait-header">
            <span class="trait-title">Rasgos de Clase: ${classDef.name} (Desbloqueados hasta Nivel ${char.level || 1})</span>
            <span class="trait-badge">Clase</span>
          </div>
          <div class="trait-body">
            <p><strong>Dado de Golpe:</strong> 1d${classDef.hitDie}</p>
            <p><strong>Competencias de Armadura:</strong> ${classDef.armorProficiencies?.join(', ') || 'Ninguna'}</p>
            <p><strong>Competencias de Armas:</strong> ${classDef.weaponProficiencies?.join(', ') || 'Ninguna'}</p>
            <p><strong>Tiradas de Salvación:</strong> ${(classDef.savingThrows || []).map(s => s.toUpperCase()).join(', ')}</p>
            ${fightingStyle ? `<p style="margin-top: 0.5rem;"><strong>Estilo de Combate:</strong> ${fightingStyle.name} — ${fightingStyle.desc}</p>` : ''}
            ${char.holyOrder ? `<p style="margin-top: 0.5rem;"><strong>Orden Sagrada:</strong> ${char.holyOrder.toUpperCase()}</p>` : ''}
            ${char.primalOrder ? `<p style="margin-top: 0.5rem;"><strong>Orden Primigenia:</strong> ${char.primalOrder.toUpperCase()}</p>` : ''}
            ${char.eldritchInvocation ? `<p style="margin-top: 0.5rem;"><strong>Invocación Sobrenatural:</strong> ${char.eldritchInvocation}</p>` : ''}

            <!-- LISTADO DE HABILIDADES SEGÚN NIVEL -->
            <div class="unlocked-features-section" style="margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
              <h5 style="color: var(--gold); font-size: 0.95rem; margin-bottom: 0.65rem;">⚡ Habilidades y Rasgos de Clase Desbloqueados:</h5>
              <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                ${classFeatures.map(f => `
                  <div class="feature-item-row">
                    <span class="feature-level-tag">Nv ${f.level}</span>
                    <div class="feature-item-info">
                      <strong class="feature-item-name">${f.name}:</strong>
                      <span class="feature-item-desc">${f.desc}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- SUBCLASE (SI ESTÁ ACTIVA O PENDIENTE A NIVEL 3+) -->
        ${subclassDef ? `
          <div class="trait-card">
            <div class="trait-header">
              <div>
                <span class="trait-title">Subclase: ${subclassDef.name}</span>
                ${subclassDef.role ? `<div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.2rem;">🎯 ${subclassDef.role}</div>` : ''}
              </div>
              <span class="trait-badge" style="background: rgba(234, 179, 8, 0.2); color: #facc15; border-color: rgba(234, 179, 8, 0.4);">Subclase Nv ${subclassDef.unlockLevel}</span>
            </div>
            <div class="trait-body">
              <p>${subclassDef.desc}</p>

              ${(subclassDef.features || []).length > 0 ? `
                <div style="margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                  <h5 style="color: var(--gold); font-size: 0.95rem; margin-bottom: 0.65rem;">⚡ Habilidades Desbloqueadas de ${subclassDef.name}:</h5>
                  <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                    ${subclassDef.features.map(f => {
                      const isUnlocked = f.level <= (char.level || 1);
                      return `
                        <div class="feature-item-row" style="${!isUnlocked ? 'opacity: 0.55;' : ''}">
                          <span class="feature-level-tag" style="${isUnlocked ? 'background: rgba(234, 179, 8, 0.2); color: #facc15; border-color: #eab308;' : ''}">Nv ${f.level}</span>
                          <div class="feature-item-info">
                            <strong class="feature-item-name">${f.name} ${isUnlocked ? '' : '(Nivel ' + f.level + ')'}:</strong>
                            <span class="feature-item-desc">${f.desc}</span>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              ` : ''}

              ${subclassDef.spells && subclassDef.spells.length > 0 ? `
                <div style="margin-top: 0.75rem;">
                  <strong style="color: #60a5fa; font-size: 0.85rem;">✨ Conjuros de Subclase:</strong>
                  <span style="font-size: 0.82rem; color: #cbd5e1;"> ${subclassDef.spells.join(', ')}</span>
                </div>
              ` : ''}

              <button class="btn btn-secondary btn-sm" onclick="window.app.switchSheetTab('subclass')" style="margin-top: 1rem;">
                🛡️ Administrar / Cambiar Subclase
              </button>
            </div>
          </div>
        ` : ((char.level || 1) >= 3 ? `
          <div class="trait-card" style="border: 1px dashed #f59e0b; background: rgba(245, 158, 11, 0.05);">
            <div class="trait-header">
              <span class="trait-title" style="color: #f59e0b;">🛡️ Subclase Disponible (Nivel ${char.level || 3})</span>
              <span class="trait-badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border-color: #f59e0b;">Pendiente</span>
            </div>
            <div class="trait-body">
              <p>Tu personaje ha alcanzado el Nivel ${char.level || 3}, desbloqueando la especialización de clase oficial de D&D 2024.</p>
              <button class="btn btn-primary btn-sm" onclick="window.app.switchSheetTab('subclass')" style="margin-top: 0.5rem;">
                🛡️ Elegir Subclase
              </button>
            </div>
          </div>
        ` : '')}

        <!-- RASGOS DE ESPECIE -->
        <div class="trait-card">
          <div class="trait-header">
            <span class="trait-title">Rasgos de Especie: ${speciesDef.name}</span>
            <span class="trait-badge species-badge">Especie</span>
          </div>
          <div class="trait-body">
            <p><strong>Velocidad:</strong> ${speciesDef.speed} metros</p>
            <p><strong>Tamaño:</strong> ${char.size || speciesDef.defaultSize || 'Mediano'}</p>
            ${(speciesDef.traits || []).map(t => `
              <div style="margin-top: 0.6rem;">
                <strong style="color: var(--gold);">${t.name}:</strong>
                <span>${t.desc}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- DOTES DE ORIGEN -->
        <div class="trait-card">
          <div class="trait-header">
            <span class="trait-title">Dotes de Origen (${char.backgroundName})</span>
            <span class="trait-badge feat-badge">Dote</span>
          </div>
          <div class="trait-body">
            ${bgFeat ? `
              <div>
                <strong style="color: var(--gold); font-size: 1rem;">${bgFeat.name}</strong>
                <p style="margin-top: 0.25rem;">${bgFeat.desc}</p>
              </div>
            ` : '<p>Ninguna dote registrada.</p>'}

            ${humanFeat ? `
              <div style="margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                <strong style="color: var(--gold); font-size: 1rem;">${humanFeat.name} (Bono Versátil de Humano)</strong>
                <p style="margin-top: 0.25rem;">${humanFeat.desc}</p>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- MAESTRÍAS CON ARMAS -->
        ${char.weaponMasteries && char.weaponMasteries.length > 0 ? `
          <div class="trait-card">
            <div class="trait-header">
              <span class="trait-title">Maestrías con Armas Aprendidas</span>
              <span class="trait-badge mastery-badge">Maestría</span>
            </div>
            <div class="trait-body">
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.75rem;">
                ${char.weaponMasteries.map(wId => {
                  const w = state.catalogs.equipment.weapons.find(item => item.id === wId);
                  if (!w) return '';
                  const mInfo = getMasteryDetail(w.mastery, state.catalogs.rules);
                  return `
                    <div style="background: rgba(255,255,255,0.03); padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
                      <div style="font-weight: bold; color: var(--gold);">${w.name} [${w.mastery.toUpperCase()}]</div>
                      <div style="font-size: 0.78rem; color: #cbd5e1; margin-top: 0.2rem;">${mInfo ? mInfo.desc : ''}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// PESTAÑA: SUBCLASE (DISPONIBLE A PARTIR DE NIVEL 3)
function renderSubclassTab({ char, classDef }) {
  const allSubclasses = state.catalogs.subclasses || [];
  const classSubclasses = allSubclasses.filter(s => s.classId === char.classId);
  const currentSubclass = classSubclasses.find(s => s.id === char.subclassId);

  return `
    <div class="tab-pane">
      <div class="pane-header">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h3 class="pane-title">🛡️ Especialización de Clase: Subclases de ${classDef.name || 'tu Clase'}</h3>
            <p class="pane-desc">A partir del Nivel 3 (Regla oficial D&D 2024), cada aventurero adopta una vocación especializada que define su identidad en combate, sus poderes únicos y su rol narrativo.</p>
          </div>
          ${currentSubclass ? `
            <div class="subclass-active-badge-header">
              <span class="subclass-chip-label">Subclase Elegida:</span>
              <strong class="subclass-chip-name">✨ ${currentSubclass.name}</strong>
            </div>
          ` : `
            <div class="subclass-pending-badge-header">
              <span class="subclass-pending-text">⚠️ Selección pendiente</span>
            </div>
          `}
        </div>
      </div>

      ${currentSubclass ? `
        <div class="active-subclass-hero-banner">
          <div class="active-subclass-hero-header">
            <div>
              <span class="active-subclass-tag">Tu Subclase Activa (Nivel ${char.level || 3})</span>
              <h4 class="active-subclass-title">🛡️ ${currentSubclass.name}</h4>
              ${currentSubclass.role ? `<div class="subclass-role-tag" style="margin-top: 0.4rem;"><span>🎯 ${currentSubclass.role}</span></div>` : ''}
            </div>
          </div>
          <p class="active-subclass-desc">${currentSubclass.desc}</p>

          ${(currentSubclass.features || []).length > 0 ? `
            <div class="hero-features-section">
              <h5 class="hero-features-title">⚡ Desglose de Tus Habilidades de Subclase:</h5>
              <div class="hero-features-grid">
                ${currentSubclass.features.map(f => {
                  const isUnlocked = f.level <= (char.level || 1);
                  return `
                    <div class="hero-feature-pill ${isUnlocked ? 'is-unlocked' : 'is-locked'}">
                      <div class="hero-feat-row">
                        <span class="hero-feat-lvl ${isUnlocked ? 'lvl-active' : 'lvl-pending'}">Nv ${f.level}</span>
                        <strong class="hero-feat-name">${f.name}</strong>
                        ${isUnlocked ? '<span class="feat-status-active">✓ Activo</span>' : '<span class="feat-status-locked">🔒 Nv ' + f.level + '</span>'}
                      </div>
                      <p class="hero-feat-text">${f.desc}</p>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          ${currentSubclass.spells && currentSubclass.spells.length > 0 ? `
            <div class="hero-spells-row">
              <strong class="hero-spells-label">✨ Conjuros Otorgados por la Subclase:</strong>
              <div class="subclass-spells-chips">
                ${currentSubclass.spells.map(s => `<span class="subclass-spell-chip">${s}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          <div class="active-subclass-hero-hint">
            <span>💡 Si tu Director de Juego (DM) lo permite, puedes cambiar de subclase seleccionando cualquiera de las otras opciones oficiales abajo.</span>
          </div>
        </div>
      ` : `
        <div class="subclass-alert-banner">
          <div class="subclass-alert-icon">✨</div>
          <div class="subclass-alert-body">
            <strong>¡Especialización de Nivel 3 Desbloqueada!</strong>
            <p>Tu personaje ha alcanzado el Nivel ${char.level || 3}. Consulta el desglose completo de habilidades y poderes de cada una de las 4 opciones oficiales disponibles abajo para elegir la tuya.</p>
          </div>
        </div>
      `}

      <h4 style="color: var(--gold); margin: 1.75rem 0 1rem; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
        <span>Opciones Oficiales de Subclase para ${classDef.name || 'tu Clase'} (D&D 2024):</span>
        <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted);">(4 opciones con desglose de rasgos)</span>
      </h4>

      <div class="subclass-grid">
        ${classSubclasses.length === 0 ? `
          <p style="color: var(--text-muted); font-style: italic;">No se encontraron subclases para esta clase en los catálogos cargados.</p>
        ` : classSubclasses.map(sub => {
          const isSelected = char.subclassId === sub.id;
          return `
            <div class="subclass-card ${isSelected ? 'is-selected' : ''}">
              <div class="subclass-card-header">
                <div class="subclass-card-title-group">
                  <h4 class="subclass-card-name">${sub.name}</h4>
                  <span class="subclass-card-level-badge">Nivel ${sub.unlockLevel || 3}+</span>
                </div>
                ${isSelected ? `
                  <span class="subclass-badge-selected">✓ Activa</span>
                ` : ''}
              </div>

              ${sub.role ? `
                <div class="subclass-role-tag">
                  <span>🎯 ${sub.role}</span>
                </div>
              ` : ''}

              <div class="subclass-card-body">
                <p class="subclass-card-desc">${sub.desc}</p>

                <!-- DESGLOSE DETALLADO DE RASGOS DE LA SUBCLASE -->
                ${(sub.features || []).length > 0 ? `
                  <div class="subclass-breakdown-box">
                    <div class="subclass-breakdown-header">
                      <span class="breakdown-header-title">⚡ Desglose de Habilidades y Rasgos:</span>
                    </div>
                    <div class="subclass-features-stack">
                      ${sub.features.map(f => {
                        const isUnlocked = f.level <= (char.level || 1);
                        return `
                          <div class="subclass-feat-item ${isUnlocked ? 'unlocked' : 'future'}">
                            <div class="subclass-feat-item-header">
                              <span class="feat-lvl-badge ${isUnlocked ? 'lvl-active' : 'lvl-future'}">Nv ${f.level}</span>
                              <strong class="feat-name-text">${f.name}</strong>
                              ${isUnlocked ? '<span class="feat-pill-active">Desbloqueado</span>' : '<span class="feat-pill-future">A Nv ' + f.level + '</span>'}
                            </div>
                            <p class="subclass-feat-item-desc">${f.desc}</p>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                ` : ''}

                <!-- CONJUROS OTORGADOS POR LA SUBCLASE -->
                ${sub.spells && sub.spells.length > 0 ? `
                  <div class="subclass-spells-box">
                    <span class="subclass-spells-heading">✨ Conjuros Otorgados:</span>
                    <div class="subclass-spells-chips">
                      ${sub.spells.map(s => `<span class="subclass-spell-chip">${s}</span>`).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>

              <div class="subclass-card-footer">
                ${isSelected ? `
                  <button class="btn btn-secondary btn-subclass-chosen" disabled>
                    ✓ Subclase Actual
                  </button>
                ` : `
                  <button class="btn btn-primary btn-subclass-select" onclick="window.app.selectCharacterSubclass('${char.id}', '${sub.id}')">
                    🛡️ Elegir ${sub.name}
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// PESTAÑA 6: HISTORIAL DE TIRADAS (SECCIÓN 15)
function renderHistoryTab() {
  const history = diceEngine.history;

  return `
    <div class="tab-pane">
      <div class="pane-header" style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 class="pane-title">Historial de Tiradas de la Sesión</h3>
          <p class="pane-desc">Registro detallado de todas las tiradas de dados realizadas durante la partida.</p>
        </div>
        ${history.length > 0 ? `
          <button class="btn btn-secondary btn-sm" onclick="window.app.clearDiceHistory()">
            🗑 Limpiar Historial
          </button>
        ` : ''}
      </div>

      <!-- DADOS RÁPIDOS PARA TIRAR AL VUELO -->
      <div class="quick-dice-bar">
        <span style="font-weight: bold; font-size: 0.8rem; color: var(--gold);">Tirada Rápida:</span>
        <button class="btn-quick-die" onclick="window.app.rollRawDie(4)">d4</button>
        <button class="btn-quick-die" onclick="window.app.rollRawDie(6)">d6</button>
        <button class="btn-quick-die" onclick="window.app.rollRawDie(8)">d8</button>
        <button class="btn-quick-die" onclick="window.app.rollRawDie(10)">d10</button>
        <button class="btn-quick-die" onclick="window.app.rollRawDie(12)">d12</button>
        <button class="btn-quick-die" onclick="window.app.rollRawDie(20)">d20</button>
        <button class="btn-quick-die" onclick="window.app.rollRawDie(100)">d100</button>
      </div>

      <div class="history-list">
        ${history.length === 0 ? `
          <p style="text-align: center; color: var(--text-muted); padding: 2rem;">Aún no se ha realizado ninguna tirada en esta sesión. ¡Haz clic en cualquier habilidad, ataque o dado!</p>
        ` : history.map(entry => {
          let formula = `${entry.diceCount}d${entry.diceFaces}`;
          if (entry.modifier > 0) formula += ` + ${entry.modifier}`;
          else if (entry.modifier < 0) formula += ` - ${Math.abs(entry.modifier)}`;

          const rollsStr = entry.rolls.length > 1 ? `(${entry.rolls.join(' + ')})` : `[${entry.rolls[0]}]`;

          return `
            <div class="history-card ${entry.isCritSuccess ? 'crit-success' : ''} ${entry.isCritFail ? 'crit-fail' : ''}">
              <div class="history-card-header">
                <span class="history-label">🎲 ${entry.label}</span>
                <span class="history-time">${entry.timestamp}</span>
              </div>
              ${entry.details ? `<div class="history-details">${entry.details}</div>` : ''}
              <div class="history-card-body">
                <span class="history-formula">${formula} = ${rollsStr} ${entry.modifier !== 0 ? (entry.modifier > 0 ? `+ ${entry.modifier}` : `- ${Math.abs(entry.modifier)}`) : ''}</span>
                <span class="history-result ${entry.isCritSuccess ? 'res-crit' : entry.isCritFail ? 'res-fail' : ''}">
                  ${entry.total}
                </span>
              </div>
              ${entry.isCritSuccess ? '<div class="history-badge-crit">⭐ ¡Impacto Crítico Natural 20!</div>' : ''}
              ${entry.isCritFail ? '<div class="history-badge-fail">💀 ¡Pifia Natural 1!</div>' : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// HELPERS DE INVENTARIO Y ARMAS
// -------------------------------------------------------------

function getCharacterWeapons(char, catalog) {
  if (!char || !Array.isArray(char.inventory)) return [];

  const catalogList = Array.isArray(catalog) ? catalog : [];
  const result = [];
  const addedItemIds = new Set();

  // Filtrar estrictamente armas que estén EQUIPADAS en el inventario
  const equippedWeapons = char.inventory.filter(item => {
    if (!item.equipped) return false;
    if (item.type === 'arma') return true;
    const nameLower = (item.name || '').trim().toLowerCase();
    return catalogList.some(w => w.id === item.id || (w.name && w.name.trim().toLowerCase() === nameLower));
  });

  equippedWeapons.forEach(item => {
    if (addedItemIds.has(item.id)) return;
    addedItemIds.add(item.id);

    const nameLower = (item.name || '').trim().toLowerCase();
    const match = catalogList.find(w => w.id === item.id || (w.name && w.name.trim().toLowerCase() === nameLower));

    if (match) {
      const props = item.properties
        ? (Array.isArray(item.properties) ? item.properties : item.properties.split(',').map(s => s.trim()))
        : (match.properties || []);

      let dmgType = match.damageType || '';
      let cleanDmg = match.damage || '1d6';
      if (cleanDmg.includes(' ')) {
        const parts = cleanDmg.split(' ');
        cleanDmg = parts[0];
        if (!dmgType && parts.length > 1) {
          dmgType = parts.slice(1).join(' ');
          dmgType = dmgType.charAt(0).toUpperCase() + dmgType.slice(1);
        }
      }

      result.push({
        ...match,
        id: match.id,
        inventoryItemId: item.id,
        name: item.name || match.name,
        damage: cleanDmg,
        damageType: dmgType || 'Cortante',
        properties: props,
        range: match.range === 'cuerpo_a_cuerpo' ? '1.5 m' : (match.range || '1.5 m'),
        mastery: match.mastery || '',
        type: match.type || 'sencilla'
      });
    } else {
      const props = item.properties
        ? (Array.isArray(item.properties) ? item.properties : item.properties.split(',').map(s => s.trim()))
        : [];

      let cleanDmg = item.damage || '1d6';
      let dmgType = item.damageType || '';
      if (cleanDmg.includes(' ')) {
        const parts = cleanDmg.split(' ');
        cleanDmg = parts[0];
        if (!dmgType && parts.length > 1) {
          dmgType = parts.slice(1).join(' ');
          dmgType = dmgType.charAt(0).toUpperCase() + dmgType.slice(1);
        }
      }

      result.push({
        id: item.id,
        inventoryItemId: item.id,
        name: item.name,
        damage: cleanDmg,
        damageType: dmgType || 'Contundente',
        properties: props,
        range: item.range || '1.5 m',
        mastery: item.mastery || '',
        type: item.subtype || 'sencilla'
      });
    }
  });

  return result;
}

function buildInitialInventory(char, catalogs) {
  const list = [];
  let itemId = 1;

  // 1. Armas de maestría como equipadas
  let hasWeapon = false;
  if (Array.isArray(char.weaponMasteries) && char.weaponMasteries.length > 0) {
    char.weaponMasteries.forEach(wId => {
      const w = catalogs?.equipment?.weapons?.find(item => item.id === wId);
      if (w) {
        hasWeapon = true;
        list.push({
          id: `item_${itemId++}`,
          name: w.name,
          type: 'arma',
          quantity: 1,
          weight: parseFloat(w.weight) || 2,
          equipped: true,
          properties: (w.properties || []).join(', ')
        });
      }
    });
  }

  // 2. Si no tenía armas de maestría, añadir arma inicial equipada según su clase
  if (!hasWeapon && catalogs?.equipment?.weapons) {
    const defaultWeapons = {
      barbaro: ['hacha_a_dos_manos'],
      bardo: ['estoque', 'daga'],
      clerigo: ['maza'],
      druida: ['cimitarra'],
      guerrero: ['espadon'],
      hechicero: ['daga'],
      mago: ['daga'],
      monje: ['lanza'],
      paladin: ['espada_larga'],
      picaro: ['estoque', 'daga'],
      explorador: ['espada_corta'],
      brujo: ['daga']
    };
    const weaponIds = defaultWeapons[char.classId] || ['daga'];
    weaponIds.forEach(wId => {
      const w = catalogs.equipment.weapons.find(item => item.id === wId);
      if (w) {
        list.push({
          id: `item_${itemId++}`,
          name: w.name,
          type: 'arma',
          quantity: 1,
          weight: parseFloat(w.weight) || 2,
          equipped: true,
          properties: (w.properties || []).join(', ')
        });
      }
    });
  }

  // Armadura básica según clase
  const armorMap = {
    barbaro: null,
    bardo: { name: 'Armadura de cuero', weight: 10 },
    clerigo: { name: 'Cota de malla', weight: 55 },
    druida: { name: 'Armadura de cuero', weight: 10 },
    guerrero: { name: 'Cota de malla', weight: 55 },
    hechicero: null,
    mago: null,
    monje: null,
    paladin: { name: 'Cota de malla', weight: 55 },
    picaro: { name: 'Armadura de cuero', weight: 10 },
    explorador: { name: 'Armadura de escamas', weight: 45 },
    brujo: { name: 'Armadura de cuero', weight: 10 }
  };

  const arm = armorMap[char.classId];
  if (arm) {
    list.push({
      id: `item_${itemId++}`,
      name: arm.name,
      type: 'armadura',
      quantity: 1,
      weight: arm.weight,
      equipped: true,
      properties: 'Protección base'
    });
  }

  // Mochila y suministros de aventurero
  list.push({
    id: `item_${itemId++}`,
    name: 'Mochila de aventurero',
    type: 'equipo',
    quantity: 1,
    weight: 5,
    equipped: false,
    properties: 'Capacidad para guardar objetos'
  });

  list.push({
    id: `item_${itemId++}`,
    name: 'Raciones de viaje (días)',
    type: 'suministro',
    quantity: 10,
    weight: 2,
    equipped: false,
    properties: 'Alimento diario'
  });

  list.push({
    id: `item_${itemId++}`,
    name: 'Odre de agua',
    type: 'suministro',
    quantity: 1,
    weight: 5,
    equipped: false,
    properties: 'Lleno de agua potable'
  });

  if (char.trinket) {
    list.push({
      id: `item_${itemId++}`,
      name: `Bagatela: ${char.trinket}`,
      type: 'bagatela',
      quantity: 1,
      weight: 0.1,
      equipped: false,
      properties: 'Objeto misterioso'
    });
  }

  return list;
}
