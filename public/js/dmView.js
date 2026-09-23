import { state } from './state.js';

export function renderDMModule(container) {
  const monsters = state.dmCatalogs.monsters || [];
  
  // Extraer valores únicos para los filtros
  const crs = [...new Set(monsters.map(m => m.basicInfo.cr))].sort((a, b) => {
    const parseCR = (val) => val.includes('/') ? eval(val) : parseFloat(val);
    return parseCR(a) - parseCR(b);
  });
  const types = [...new Set(monsters.map(m => m.basicInfo.type))].sort();

  let html = `
    <div class="characters-list-header">
      <h2>Dungeon Master: Catálogo de Monstruos</h2>
      <p style="color: var(--text-muted);">Manual de Monstruos (D&D 2024)</p>
    </div>

    <div class="search-filters-bar" style="margin-bottom: 2rem; display: flex; gap: 1rem; flex-wrap: wrap;">
      <input type="text" class="search-input" id="dm-search" placeholder="Buscar monstruo..." style="flex: 1; min-width: 200px;" oninput="window.app.filterMonsters(this.value)" />
      
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

export function showMonsterSheet(id) {
  const m = state.dmCatalogs.monsters.find(x => x.id === id);
  if (!m) return;
  
  const speeds = renderSpeeds(m.movement);
  const senses = renderSenses(m.senses);
  
  let html = `
    <div style="padding: 1.5rem; background-color: var(--panel-bg); border-radius: 8px; text-align: left; max-height: 75vh; overflow-y: auto; color: var(--text-color);">
      <h2 style="color: var(--danger-color); margin: 0 0 0.25rem 0; font-size: 1.8rem;">${m.name}</h2>
      <p style="font-style: italic; color: var(--text-muted); margin-top: 0; font-size: 0.95rem;">
        ${m.basicInfo.size} ${m.basicInfo.type}, ${m.basicInfo.alignment}
      </p>
      
      <hr style="border: 0; border-top: 2px solid var(--danger-color); margin: 1rem 0;" />
      
      <p style="margin: 0.3rem 0;"><strong>Clase de Armadura:</strong> ${m.defenses.ac.value} ${m.defenses.ac.desc ? `(${m.defenses.ac.desc})` : ''}</p>
      <p style="margin: 0.3rem 0;"><strong>Puntos de Golpe:</strong> ${m.defenses.hp.average} (${m.defenses.hp.formula})</p>
      <p style="margin: 0.3rem 0;"><strong>Velocidad:</strong> ${speeds}</p>
      
      <hr style="border: 0; border-top: 2px solid var(--danger-color); margin: 1rem 0;" />
      
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
      
      <hr style="border: 0; border-top: 2px solid var(--danger-color); margin: 1rem 0;" />
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
      
      <hr style="border: 0; border-top: 2px solid var(--danger-color); margin: 1rem 0;" />
  `;
      
  if (m.traits && m.traits.length > 0) {
    html += `<div style="margin-top: 1rem;">`;
    html += m.traits.map(t => `<p style="margin: 0.5rem 0; line-height: 1.4;"><strong><em>${t.name}.</em></strong> ${t.desc}</p>`).join('');
    html += `</div>`;
  }

  if (m.actions && m.actions.length > 0) {
    html += `<h3 style="border-bottom: 1px solid var(--border-color); color: var(--danger-color); margin: 1.5rem 0 0.5rem 0; padding-bottom: 0.2rem;">Acciones</h3>`;
    html += m.actions.map(a => {
      let desc = a.desc || '';
      if (!desc && a.hit !== undefined) {
        let dmgString = a.damage && a.damage.length > 0 ? a.damage.map(d => `${d.average} (${d.formula}) de daño ${d.type.toLowerCase()}`).join(' más ') : '';
        desc = `<em>${a.type}</em>: ${a.hit >= 0 ? '+'+a.hit : a.hit} para impactar, alcance ${a.reach}. <em>Impacto:</em> ${dmgString}.`;
      }
      return `<p style="margin: 0.5rem 0; line-height: 1.4;"><strong><em>${a.name}.</em></strong> ${desc}</p>`;
    }).join('');
  }

  if (m.bonusActions && m.bonusActions.length > 0) {
    html += `<h3 style="border-bottom: 1px solid var(--border-color); color: var(--danger-color); margin: 1.5rem 0 0.5rem 0; padding-bottom: 0.2rem;">Acciones Adicionales</h3>`;
    html += m.bonusActions.map(a => `<p style="margin: 0.5rem 0; line-height: 1.4;"><strong><em>${a.name}.</em></strong> ${a.desc}</p>`).join('');
  }

  if (m.reactions && m.reactions.length > 0) {
    html += `<h3 style="border-bottom: 1px solid var(--border-color); color: var(--danger-color); margin: 1.5rem 0 0.5rem 0; padding-bottom: 0.2rem;">Reacciones</h3>`;
    html += m.reactions.map(a => `<p style="margin: 0.5rem 0; line-height: 1.4;"><strong><em>${a.name}.</em></strong> ${a.desc}</p>`).join('');
  }

  if (m.legendaryActions && m.legendaryActions.length > 0) {
    html += `<h3 style="border-bottom: 1px solid var(--border-color); color: var(--danger-color); margin: 1.5rem 0 0.5rem 0; padding-bottom: 0.2rem;">Acciones Legendarias</h3>`;
    html += `<p style="margin: 0.5rem 0; line-height: 1.4; font-size: 0.9em; color: var(--text-muted);">El monstruo puede realizar 3 acciones legendarias, eligiendo de las opciones de abajo. Solo puede usar una opción a la vez y únicamente al final del turno de otra criatura. Recupera las acciones gastadas al inicio de su turno.</p>`;
    html += m.legendaryActions.map(a => {
      let costText = a.cost && a.cost > 1 ? ` (Cuesta ${a.cost} Acciones)` : '';
      return `<p style="margin: 0.5rem 0; line-height: 1.4;"><strong><em>${a.name}${costText}.</em></strong> ${a.desc}</p>`;
    }).join('');
  }

  html += `</div>`;

  window.app.showAlert({
    title: `Ficha de Monstruo`,
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
