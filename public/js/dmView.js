import { state } from './state.js';

export function renderDMModule(container) {
  let html = `
    <div class="characters-list-header">
      <h2 class="view-main-title">🐉 Panel del Dungeon Master</h2>
      <p class="view-subtitle">Gestiona campañas, sesiones, jugadores y monstruos.</p>
    </div>
    
    <div style="display: flex; gap: 2rem; flex-wrap: wrap; margin-top: 2rem;">
      <!-- Preparación Card -->
      <div class="mode-card" onclick="window.app.openPreparationView()" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" style="cursor:pointer; border: 1px solid var(--border-active); border-radius: 12px; padding: 2.5rem; text-align: center; background: var(--bg-card); flex: 1; min-width: 250px; transition: transform 0.2s;">
        <h2 style="color: var(--gold); font-size: 2rem; margin-bottom: 1rem; font-family: var(--font-serif);">⚔️ Preparación</h2>
        <p style="color: var(--text-muted);">Gestiona los monstruos y NPCs que participarán en la partida actual.</p>
      </div>

      <!-- Monstruos Card -->
      <div class="mode-card" onclick="window.app.openMonstersCatalog()" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" style="cursor:pointer; border: 1px solid var(--border-color); border-radius: 12px; padding: 2.5rem; text-align: center; background: var(--bg-card); flex: 1; min-width: 250px; transition: transform 0.2s;">
        <h2 style="color: var(--gold); font-size: 2rem; margin-bottom: 1rem; font-family: var(--font-serif);">💀 Monstruos</h2>
        <p style="color: var(--text-muted);">Catálogo de criaturas y estadísticas.</p>
      </div>

      <!-- Espacio para futuras cartas (Campañas) -->
      <div class="mode-card" style="opacity: 0.5; cursor:not-allowed; border: 1px dashed var(--border-color); border-radius: 12px; padding: 2.5rem; text-align: center; background: var(--bg-card); flex: 1; min-width: 250px;">
        <h2 style="color: var(--text-muted); font-size: 2rem; margin-bottom: 1rem; font-family: var(--font-serif);">⛺ Campañas</h2>
        <p style="color: var(--text-muted);">Gestor de aventuras y notas de campaña. (Próximamente)</p>
      </div>
    </div>
  `;
  container.innerHTML = html;
}

export function renderMonstersCatalog(container) {
  const monsters = state.dmCatalogs.monsters || [];
  
  // Extraer valores únicos para los filtros
  const crs = [...new Set(monsters.map(m => m.basicInfo.cr))].sort((a, b) => {
    const parseCR = (val) => val.includes('/') ? eval(val) : parseFloat(val);
    return parseCR(a) - parseCR(b);
  });
  const types = [...new Set(monsters.map(m => m.basicInfo.type))].sort();

  let html = `
    <div class="characters-list-header">
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <div>
          <h2 class="view-main-title">💀 Catálogo de Monstruos</h2>
          <p class="view-subtitle">Manual de Monstruos (D&D 2024)</p>
        </div>
        <button class="btn btn-secondary" onclick="window.app.openDMModule()">Volver al Panel</button>
      </div>
    </div>

    <div class="filters-toolbar" style="margin-bottom: 2rem; display: flex; gap: 1rem; flex-wrap: wrap;">
      <div class="search-box-wrapper" style="flex: 1; min-width: 200px;">
        <span class="search-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></span>
        <input type="text" class="input-text search-input" id="dm-search" placeholder="Buscar monstruo..." oninput="window.app.filterMonsters(this.value)" />
      </div>
      
      <select class="filter-select" id="dm-filter-cr" onchange="window.app.filterMonstersCR(this.value)">
        <option value="all">Todas las Dificultades</option>
        ${crs.map(cr => `<option value="${cr}">Desafío ${cr}</option>`).join('')}
      </select>
      
      <select class="filter-select" id="dm-filter-type" onchange="window.app.filterMonsters()">
        <option value="all">Todos los Tipos</option>
        ${types.map(t => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
      </select>
    </div>

    <div class="characters-grid" id="dm-monsters-grid">
      ${renderMonstersList(monsters)}
    </div>
  `;
  container.innerHTML = html;
}

export function renderPreparationView(container, activeTab = 'partida') {
  const isPartida = activeTab === 'partida';
  let html = `
    <div class="characters-list-header">
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <div>
          <h2 class="view-main-title">⚔️ Preparación de Partida</h2>
          <p class="view-subtitle">Añade monstruos y prepárate para el encuentro.</p>
        </div>
        <button class="btn btn-secondary" onclick="window.app.openDMModule()">Volver al Panel</button>
      </div>
    </div>

    <div style="display: flex; gap: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 2rem;">
      <button class="btn ${isPartida ? 'btn-primary' : 'btn-secondary'}" onclick="window.app.renderPreparation('partida')">En Partida</button>
      <button class="btn ${!isPartida ? 'btn-primary' : 'btn-secondary'}" onclick="window.app.renderPreparation('monstruos')">Catálogo de Monstruos</button>
    </div>
  `;

  if (isPartida) {
    const activeMonsters = state.dmSession.activeMonsters || [];
    if (activeMonsters.length === 0) {
      html += `<div class="empty-state-text">No hay monstruos en la partida actual.<br>Ve a la pestaña de "Catálogo de Monstruos" para añadirlos.</div>`;
    } else {
      html += `<div class="characters-grid">`;
      html += activeMonsters.map(m => `
        <div class="character-card" style="grid-column: 1 / -1; display: flex; flex-direction: column;">
          <div class="char-card-body" style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
              <div>
                <h3 class="char-card-name" style="margin-bottom: 0.2rem; font-size: 1.5rem; color: var(--gold);">${m.name}</h3>
                <p style="font-style: italic; color: var(--text-muted); margin: 0; font-size: 0.9rem;">
                  ${m.basicInfo.size} ${m.basicInfo.type}, ${m.basicInfo.alignment}
                </p>
              </div>
              <div style="text-align: right;">
                <p class="char-card-info" style="margin-bottom: 0.2rem; font-size: 1.1rem;"><strong>Iniciativa:</strong> ${formatMod(m.stats.dex)}</p>
                <button class="btn btn-secondary btn-sm" style="margin-top: 0.5rem; color: var(--crimson-dark); border-color: var(--crimson-dark);" onclick="window.app.removeMonsterFromSession('${m.sessionId}')">❌ Quitar del Encuentro</button>
              </div>
            </div>
            
            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 1rem 0;" />
            
            ${getMiniMonsterStatBlockHtml(m)}
          </div>
        </div>
      `).join('');
      html += `</div>`;
    }
  } else {
    // Render the catalog but inside the tabs
    html += `
      <div id="prep-catalog-container"></div>
    `;
  }

  container.innerHTML = html;

  if (!isPartida) {
    const catalogContainer = document.getElementById('prep-catalog-container');
    if (catalogContainer) {
      // Re-use logic but stripped down without the header
      const monsters = state.dmCatalogs.monsters || [];
      const crs = [...new Set(monsters.map(m => m.basicInfo.cr))].sort((a, b) => {
        const parseCR = (val) => val.includes('/') ? eval(val) : parseFloat(val);
        return parseCR(a) - parseCR(b);
      });
      const types = [...new Set(monsters.map(m => m.basicInfo.type))].sort();

      catalogContainer.innerHTML = `
        <div class="filters-toolbar" style="margin-bottom: 2rem; display: flex; gap: 1rem; flex-wrap: wrap;">
          <div class="search-box-wrapper" style="flex: 1; min-width: 200px;">
            <span class="search-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></span>
            <input type="text" class="input-text search-input" id="dm-search" placeholder="Buscar monstruo..." oninput="window.app.filterMonsters(this.value)" />
          </div>
          <select class="filter-select" id="dm-filter-cr" onchange="window.app.filterMonstersCR(this.value)">
            <option value="all">Todas las Dificultades</option>
            ${crs.map(cr => `<option value="${cr}">Desafío ${cr}</option>`).join('')}
          </select>
          <select class="filter-select" id="dm-filter-type" onchange="window.app.filterMonsters()">
            <option value="all">Todos los Tipos</option>
            ${types.map(t => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="characters-grid" id="dm-monsters-grid">
          ${renderMonstersList(monsters)}
        </div>
      `;
    }
  }
}

export function renderMonstersList(monstersList) {
  if (monstersList.length === 0) {
    return `<div class="empty-state-text">No se encontraron monstruos.</div>`;
  }

  return monstersList.map(m => `
    <div class="character-card">
      <div class="char-card-body">
        <h3 class="char-card-name" style="margin-bottom: 0.5rem; color: var(--danger-color); font-size: 1.25rem;">${m.name}</h3>
        <p class="char-card-info" style="margin-bottom: 0.2rem;"><strong>Tipo:</strong> ${m.basicInfo.size} ${m.basicInfo.type}</p>
        <p class="char-card-info" style="margin-bottom: 0.2rem;"><strong>Desafío (CR):</strong> ${m.basicInfo.cr} (${m.basicInfo.xp} XP)</p>
        <p class="char-card-info" style="margin-bottom: 0;"><strong>Alineamiento:</strong> ${m.basicInfo.alignment}</p>
      </div>
      <div class="char-card-actions" style="margin-top: 1rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
        <button class="btn btn-secondary btn-sm" onclick="window.app.showMonsterSheet('${m.id}')">📖 Ver Ficha</button>
        <button class="btn btn-primary btn-sm" onclick="window.app.addMonsterToSession('${m.id}')">⚔️ Añadir a Sesión</button>
      </div>
    </div>
  `).join('');
}

// Función interna para aplicar todos los filtros leyendo del DOM
function applyAllFilters() {
  const query = (document.getElementById('dm-search')?.value || '').toLowerCase();
  const cr = document.getElementById('dm-filter-cr')?.value || 'all';
  const type = document.getElementById('dm-filter-type')?.value || 'all';
  
  const filtered = state.dmCatalogs.monsters.filter(m => {
    const matchName = m.name.toLowerCase().includes(query);
    const matchCR = cr === 'all' || m.basicInfo.cr === cr;
    const matchType = type === 'all' || m.basicInfo.type === type;
    return matchName && matchCR && matchType;
  });
  
  const grid = document.getElementById('dm-monsters-grid');
  if (grid) grid.innerHTML = renderMonstersList(filtered);
}

// Mantenemos estas funciones con sus firmas originales para compatibilidad con app.js
export function filterMonsters(query) {
  applyAllFilters();
}

export function filterMonstersCR(cr) {
  applyAllFilters();
}

// Helpers para renderizar campos
function formatMod(score) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function renderSpeeds(movement) {
  return Object.entries(movement)
    .map(([type, speed]) => `${type === 'walk' ? 'Caminar' : type === 'fly' ? 'Volar' : type === 'climb' ? 'Trepar' : type === 'swim' ? 'Nadar' : type} ${speed} pies`)
    .join(', ');
}

function renderSenses(senses) {
  let parts = [];
  if (senses.blindsight) parts.push(`Visión ciega ${senses.blindsight} pies`);
  if (senses.darkvision) parts.push(`Visión en la oscuridad ${senses.darkvision} pies`);
  if (senses.tremorsense) parts.push(`Sentido sísmico ${senses.tremorsense} pies`);
  if (senses.truesight) parts.push(`Visión verdadera ${senses.truesight} pies`);
  parts.push(`Percepción Pasiva ${senses.passivePerception}`);
  return parts.join(', ');
}
export function showMonsterAbility(name, descHtml) {
  window.app.showAlert({
    title: name,
    messageHtml: `<div style="font-size: 1rem; line-height: 1.5; color: var(--text-color);">${descHtml}</div>`,
    icon: '✨'
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getMiniMonsterStatBlockHtml(m) {
  const speeds = renderSpeeds(m.movement);
  
  let html = `
    <div class="monster-stat-block-mini" style="text-align: left; color: var(--text-color); font-size: 0.9rem;">
      <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
        <p style="margin: 0;"><strong>CA:</strong> ${m.defenses.ac.value} ${m.defenses.ac.desc ? `(${m.defenses.ac.desc})` : ''}</p>
        <p style="margin: 0;"><strong>PG:</strong> ${m.defenses.hp.average} (${m.defenses.hp.formula})</p>
        <p style="margin: 0;"><strong>Velocidad:</strong> ${speeds}</p>
      </div>
      
      <table style="width: 100%; text-align: center; margin: 0.5rem 0; border-collapse: collapse; font-size: 0.85rem; background: rgba(0,0,0,0.2); border-radius: 6px; overflow: hidden;">
        <tr style="color: var(--text-muted); border-bottom: 1px solid var(--border-color);">
          <th style="padding: 0.3rem;">FUE</th>
          <th style="padding: 0.3rem;">DES</th>
          <th style="padding: 0.3rem;">CON</th>
          <th style="padding: 0.3rem;">INT</th>
          <th style="padding: 0.3rem;">SAB</th>
          <th style="padding: 0.3rem;">CAR</th>
        </tr>
        <tr>
          <td style="padding: 0.3rem;">${m.stats.str} (${formatMod(m.stats.str)})</td>
          <td style="padding: 0.3rem;">${m.stats.dex} (${formatMod(m.stats.dex)})</td>
          <td style="padding: 0.3rem;">${m.stats.con} (${formatMod(m.stats.con)})</td>
          <td style="padding: 0.3rem;">${m.stats.int} (${formatMod(m.stats.int)})</td>
          <td style="padding: 0.3rem;">${m.stats.wis} (${formatMod(m.stats.wis)})</td>
          <td style="padding: 0.3rem;">${m.stats.cha} (${formatMod(m.stats.cha)})</td>
        </tr>
      </table>
  `;

  // Helper para crear botones de habilidades
  const makePill = (name, desc, typeColor) => {
    const escapedDesc = escapeHtml(desc);
    const escapedName = escapeHtml(name);
    return `<button class="btn btn-sm" style="background: transparent; border: 1px solid ${typeColor}; color: ${typeColor}; padding: 0.1rem 0.5rem; margin: 0.2rem; font-size: 0.8rem; border-radius: 12px;" onclick="window.app.showMonsterAbility('${escapedName}', '${escapedDesc}')">${escapedName}</button>`;
  };

  html += `<div style="margin-top: 1rem;">`;

  if (m.traits && m.traits.length > 0) {
    html += `<div style="margin-bottom: 0.5rem;"><strong>Rasgos:</strong> `;
    html += m.traits.map(t => makePill(t.name, t.desc, 'var(--text-main)')).join('');
    html += `</div>`;
  }

  if (m.actions && m.actions.length > 0) {
    html += `<div style="margin-bottom: 0.5rem;"><strong>Acciones:</strong> `;
    html += m.actions.map(a => {
      let desc = a.desc || '';
      if (!desc && a.hit !== undefined) {
        let dmgString = a.damage && a.damage.length > 0 ? a.damage.map(d => `${d.average} (${d.formula}) de daño ${d.type.toLowerCase()}`).join(' más ') : '';
        desc = `<em>${a.type}</em>: ${a.hit >= 0 ? '+'+a.hit : a.hit} para impactar, alcance ${a.reach}. <em>Impacto:</em> ${dmgString}.`;
      }
      return makePill(a.name, desc, 'var(--gold)');
    }).join('');
    html += `</div>`;
  }

  if (m.bonusActions && m.bonusActions.length > 0) {
    html += `<div style="margin-bottom: 0.5rem;"><strong>Bonus:</strong> `;
    html += m.bonusActions.map(a => makePill(a.name, a.desc, '#60a5fa')).join('');
    html += `</div>`;
  }

  if (m.reactions && m.reactions.length > 0) {
    html += `<div style="margin-bottom: 0.5rem;"><strong>Reacciones:</strong> `;
    html += m.reactions.map(a => makePill(a.name, a.desc, 'var(--green)')).join('');
    html += `</div>`;
  }

  if (m.legendaryActions && m.legendaryActions.length > 0) {
    html += `<div style="margin-bottom: 0.5rem;"><strong>Legendarias:</strong> `;
    html += m.legendaryActions.map(a => makePill(a.name, a.desc, 'var(--danger-color)')).join('');
    html += `</div>`;
  }

  html += `</div></div>`;
  return html;
}

export function getMonsterStatBlockHtml(m) {
  const speeds = renderSpeeds(m.movement);
  const senses = renderSenses(m.senses);
  
  let html = `
    <div class="monster-stat-block" style="text-align: left; color: var(--text-color);">
      <p style="margin: 0.3rem 0;"><strong>Clase de Armadura:</strong> ${m.defenses.ac.value} ${m.defenses.ac.desc ? `(${m.defenses.ac.desc})` : ''}</p>
      <p style="margin: 0.3rem 0;"><strong>Puntos de Golpe:</strong> ${m.defenses.hp.average} (${m.defenses.hp.formula})</p>
      <p style="margin: 0.3rem 0;"><strong>Velocidad:</strong> ${speeds}</p>
      
      <table style="width: 100%; text-align: center; margin: 1rem 0; border-collapse: collapse; font-size: 0.95rem;">
        <tr style="color: var(--danger-color);">
          <th style="padding: 0.2rem;">FUE</th>
          <th style="padding: 0.2rem;">DES</th>
          <th style="padding: 0.2rem;">CON</th>
          <th style="padding: 0.2rem;">INT</th>
          <th style="padding: 0.2rem;">SAB</th>
          <th style="padding: 0.2rem;">CAR</th>
        </tr>
        <tr>
          <td style="padding: 0.2rem;">${m.stats.str} (${formatMod(m.stats.str)})</td>
          <td style="padding: 0.2rem;">${m.stats.dex} (${formatMod(m.stats.dex)})</td>
          <td style="padding: 0.2rem;">${m.stats.con} (${formatMod(m.stats.con)})</td>
          <td style="padding: 0.2rem;">${m.stats.int} (${formatMod(m.stats.int)})</td>
          <td style="padding: 0.2rem;">${m.stats.wis} (${formatMod(m.stats.wis)})</td>
          <td style="padding: 0.2rem;">${m.stats.cha} (${formatMod(m.stats.cha)})</td>
        </tr>
      </table>
  `;

  if (m.proficiencies?.saves?.length > 0) {
    html += `<p style="margin: 0.3rem 0;"><strong>Tiradas de Salvación:</strong> ${m.proficiencies.saves.map(s => `${s.name} ${s.mod >= 0 ? '+'+s.mod : s.mod}`).join(', ')}</p>`;
  }
  if (m.proficiencies?.skills?.length > 0) {
    html += `<p style="margin: 0.3rem 0;"><strong>Habilidades:</strong> ${m.proficiencies.skills.map(s => `${s.name} ${s.mod >= 0 ? '+'+s.mod : s.mod}`).join(', ')}</p>`;
  }
  if (m.defenses?.vulnerabilities?.length > 0) {
    html += `<p style="margin: 0.3rem 0;"><strong>Vulnerabilidades al daño:</strong> ${m.defenses.vulnerabilities.join(', ')}</p>`;
  }
  if (m.defenses?.resistances?.length > 0) {
    html += `<p style="margin: 0.3rem 0;"><strong>Resistencias al daño:</strong> ${m.defenses.resistances.join(', ')}</p>`;
  }
  if (m.defenses?.immunities?.length > 0) {
    html += `<p style="margin: 0.3rem 0;"><strong>Inmunidades al daño:</strong> ${m.defenses.immunities.join(', ')}</p>`;
  }
  if (m.defenses?.conditionImmunities?.length > 0) {
    html += `<p style="margin: 0.3rem 0;"><strong>Inmunidades a condición:</strong> ${m.defenses.conditionImmunities.join(', ')}</p>`;
  }

  html += `
      <p style="margin: 0.3rem 0;"><strong>Sentidos:</strong> ${senses}</p>
      <p style="margin: 0.3rem 0;"><strong>Idiomas:</strong> ${m.languages && m.languages.length > 0 ? m.languages.join(', ') : '--'}</p>
      <p style="margin: 0.3rem 0;"><strong>Desafío:</strong> ${m.basicInfo.cr} (${m.basicInfo.xp} PE)</p>
      <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 1rem 0;" />
  `;
      
  if (m.traits && m.traits.length > 0) {
    html += `<div style="margin-top: 1rem;">`;
    html += m.traits.map(t => `<p style="margin: 0.5rem 0; line-height: 1.4; font-size: 0.9rem;"><strong><em>${t.name}.</em></strong> ${t.desc}</p>`).join('');
    html += `</div>`;
  }

  if (m.actions && m.actions.length > 0) {
    html += `<h4 style="border-bottom: 1px solid var(--border-color); color: var(--gold); margin: 1rem 0 0.5rem 0; padding-bottom: 0.2rem; font-family: var(--font-serif);">Acciones</h4>`;
    html += m.actions.map(a => {
      let desc = a.desc || '';
      if (!desc && a.hit !== undefined) {
        let dmgString = a.damage && a.damage.length > 0 ? a.damage.map(d => `${d.average} (${d.formula}) de daño ${d.type.toLowerCase()}`).join(' más ') : '';
        desc = `<em>${a.type}</em>: ${a.hit >= 0 ? '+'+a.hit : a.hit} para impactar, alcance ${a.reach}. <em>Impacto:</em> ${dmgString}.`;
      }
      return `<p style="margin: 0.5rem 0; line-height: 1.4; font-size: 0.9rem;"><strong><em>${a.name}.</em></strong> ${desc}</p>`;
    }).join('');
  }

  if (m.bonusActions && m.bonusActions.length > 0) {
    html += `<h4 style="border-bottom: 1px solid var(--border-color); color: var(--gold); margin: 1rem 0 0.5rem 0; padding-bottom: 0.2rem; font-family: var(--font-serif);">Acciones Adicionales</h4>`;
    html += m.bonusActions.map(a => `<p style="margin: 0.5rem 0; line-height: 1.4; font-size: 0.9rem;"><strong><em>${a.name}.</em></strong> ${a.desc}</p>`).join('');
  }

  if (m.reactions && m.reactions.length > 0) {
    html += `<h4 style="border-bottom: 1px solid var(--border-color); color: var(--gold); margin: 1rem 0 0.5rem 0; padding-bottom: 0.2rem; font-family: var(--font-serif);">Reacciones</h4>`;
    html += m.reactions.map(a => `<p style="margin: 0.5rem 0; line-height: 1.4; font-size: 0.9rem;"><strong><em>${a.name}.</em></strong> ${a.desc}</p>`).join('');
  }

  if (m.legendaryActions && m.legendaryActions.length > 0) {
    html += `<h4 style="border-bottom: 1px solid var(--border-color); color: var(--gold); margin: 1rem 0 0.5rem 0; padding-bottom: 0.2rem; font-family: var(--font-serif);">Acciones Legendarias</h4>`;
    html += `<p style="margin: 0.5rem 0; line-height: 1.4; font-size: 0.8em; color: var(--text-muted);">El monstruo puede realizar 3 acciones legendarias, eligiendo de las opciones de abajo. Solo puede usar una opción a la vez y únicamente al final del turno de otra criatura. Recupera las acciones gastadas al inicio de su turno.</p>`;
    html += m.legendaryActions.map(a => {
      let costText = a.cost && a.cost > 1 ? ` (Cuesta ${a.cost} Acciones)` : '';
      return `<p style="margin: 0.5rem 0; line-height: 1.4; font-size: 0.9rem;"><strong><em>${a.name}${costText}.</em></strong> ${a.desc}</p>`;
    }).join('');
  }

  html += `</div>`;
  return html;
}

export function showMonsterSheet(id) {
  const m = state.dmCatalogs.monsters.find(x => x.id === id);
  if (!m) return;
  
  const statBlockHtml = getMonsterStatBlockHtml(m);
  
  let html = `
    <div style="padding: 1.5rem; background-color: var(--panel-bg); border-radius: 8px; text-align: left; max-height: 75vh; overflow-y: auto;">
      <h2 style="color: var(--danger-color); margin: 0 0 0.25rem 0; font-size: 1.8rem; font-family: var(--font-serif);">${m.name}</h2>
      <p style="font-style: italic; color: var(--text-muted); margin-top: 0; font-size: 0.95rem;">
        ${m.basicInfo.size} ${m.basicInfo.type}, ${m.basicInfo.alignment}
      </p>
      
      <hr style="border: 0; border-top: 2px solid var(--danger-color); margin: 1rem 0;" />
      
      ${statBlockHtml}
    </div>
  `;

  window.app.showAlert({
    title: 'Ficha de Monstruo',
    messageHtml: html,
    icon: '🐉'
  });
}

export function addMonsterToSession(id) {
  const m = state.dmCatalogs.monsters.find(x => x.id === id);
  if (!m) return;
  state.dmSession.activeMonsters.push({...m, sessionId: Date.now().toString()});
  
  window.app.showAlert({
    title: 'Monstruo Añadido',
    message: `${m.name} fue añadido a tu sesión de combate exitosamente.`,
    icon: '✅',
    type: 'success'
  });
}

export function removeMonsterFromSession(sessionId) {
  state.dmSession.activeMonsters = state.dmSession.activeMonsters.filter(x => x.sessionId !== sessionId);
  if (state.activeView === 'dm_preparation') {
    const stepContent = document.getElementById('step-content') || document.querySelector('.main-layout');
    renderPreparationView(stepContent, 'partida');
  }
}
