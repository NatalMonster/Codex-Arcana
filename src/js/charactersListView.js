/**
 * Vista "Mis Personajes": Listado, Búsqueda, Filtrado y Gestión de Héroes
 */

import { state } from './state.js';

let searchQuery = '';
let filterClass = 'all';
let filterLevel = 'all';
let sortBy = 'recent';

export function renderCharactersListView(container) {
  if (!container) return;

  const characters = state.savedCharacters || [];

  // Filtrado
  let filtered = characters.filter(c => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = c.name.toLowerCase().includes(q);
      const matchClass = (c.className || '').toLowerCase().includes(q);
      const matchSpecies = (c.speciesName || '').toLowerCase().includes(q);
      if (!matchName && !matchClass && !matchSpecies) return false;
    }

    if (filterClass !== 'all' && c.classId !== filterClass) return false;
    if (filterLevel !== 'all' && Number(c.level) !== Number(filterLevel)) return false;

    return true;
  });

  // Ordenamiento
  filtered.sort((a, b) => {
    if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
    if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
    if (sortBy === 'level_desc') return b.level - a.level;
    if (sortBy === 'level_asc') return a.level - b.level;
    // 'recent' por defecto
    const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  const classList = state.catalogs.classes || [];

  container.innerHTML = `
    <div class="characters-view-header">
      <div class="view-title-group">
        <h2 class="view-main-title">🛡️ Mis Personajes</h2>
        <p class="view-subtitle">Selecciona un héroe para abrir su hoja de juego interactiva, o forja uno nuevo.</p>
      </div>
      <button class="btn btn-primary btn-create-hero" onclick="window.app.startNewCharacter()">
        ✨ + Forjar Nuevo Personaje
      </button>
    </div>

    <!-- BARRA DE BÚSQUEDA Y FILTROS -->
    <div class="filters-toolbar">
      <div class="search-box-wrapper">
        <span class="search-icon">🔍</span>
        <input 
          type="text" 
          class="input-text search-input" 
          placeholder="Buscar por nombre, clase o especie..." 
          value="${searchQuery}" 
          oninput="window.app.onSearchInput(this.value)"
        >
      </div>

      <div class="filters-group">
        <div class="filter-item">
          <label class="filter-label">Clase:</label>
          <select class="select-box filter-select" onchange="window.app.onFilterClass(this.value)">
            <option value="all" ${filterClass === 'all' ? 'selected' : ''}>Todas las clases</option>
            ${classList.map(cl => `
              <option value="${cl.id}" ${filterClass === cl.id ? 'selected' : ''}>${cl.name}</option>
            `).join('')}
          </select>
        </div>

        <div class="filter-item">
          <label class="filter-label">Nivel:</label>
          <select class="select-box filter-select" onchange="window.app.onFilterLevel(this.value)">
            <option value="all" ${filterLevel === 'all' ? 'selected' : ''}>Todos los niveles</option>
            <option value="1" ${filterLevel === '1' ? 'selected' : ''}>Nivel 1</option>
            <option value="2" ${filterLevel === '2' ? 'selected' : ''}>Nivel 2</option>
            <option value="3" ${filterLevel === '3' ? 'selected' : ''}>Nivel 3</option>
          </select>
        </div>

        <div class="filter-item">
          <label class="filter-label">Ordenar:</label>
          <select class="select-box filter-select" onchange="window.app.onSortBy(this.value)">
            <option value="recent" ${sortBy === 'recent' ? 'selected' : ''}>Más recientes</option>
            <option value="name_asc" ${sortBy === 'name_asc' ? 'selected' : ''}>Nombre (A - Z)</option>
            <option value="name_desc" ${sortBy === 'name_desc' ? 'selected' : ''}>Nombre (Z - A)</option>
            <option value="level_desc" ${sortBy === 'level_desc' ? 'selected' : ''}>Mayor nivel</option>
            <option value="level_asc" ${sortBy === 'level_asc' ? 'selected' : ''}>Menor nivel</option>
          </select>
        </div>
      </div>
    </div>

    <!-- CONTADOR DE RESULTADOS -->
    <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
      Mostrando <strong>${filtered.length}</strong> de <strong>${characters.length}</strong> personaje(s) guardado(s).
    </div>

    <!-- REJILLA DE TARJETAS DE PERSONAJE -->
    ${filtered.length === 0 ? `
      <div class="empty-characters-box">
        <div style="font-size: 3rem; margin-bottom: 1rem;">📜</div>
        <h3 style="color: var(--gold); font-size: 1.3rem; margin-bottom: 0.5rem;">
          ${characters.length === 0 ? 'Aún no tienes ningún personaje forjado' : 'Ningún personaje coincide con tu búsqueda'}
        </h3>
        <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto 1.5rem auto;">
          ${characters.length === 0 
            ? 'Utiliza el asistente oficial de D&D 2024 para crear a tu primer héroe con reglas completas, conjuros y equipo.' 
            : 'Prueba a cambiar los filtros o el texto de búsqueda para encontrar a tu personaje.'}
        </p>
        <button class="btn btn-primary" onclick="window.app.startNewCharacter()">
          ✨ Crear Mi Primer Personaje
        </button>
      </div>
    ` : `
      <div class="characters-grid">
        ${filtered.map(char => {
          const stats = char.calculatedStats || {};
          const currentHp = typeof char.currentHp === 'number' ? char.currentHp : (stats.maxHp || 10);
          const maxHp = stats.maxHp || 10;
          const ac = stats.ac || 10;
          const init = stats.initiative || 0;
          const pb = stats.proficiencyBonus || 2;
          const updatedDate = new Date(char.updatedAt || char.createdAt || Date.now()).toLocaleDateString();

          return `
            <div class="character-card">
              <div class="character-card-header">
                <div class="character-card-avatar">
                  ${getClassIcon(char.classId)}
                </div>
                <div class="character-card-identity">
                  <h3 class="character-card-name">${window.app.escapeHTML(char.name || 'Sin Nombre')}</h3>
                  <div class="character-card-meta">
                    <span class="badge-tag">${window.app.escapeHTML(char.speciesName || 'Especie ?')}</span>
                    <span class="badge-tag class-tag">${window.app.escapeHTML(char.className || 'Clase ?')} Nv ${char.level}</span>
                    ${char.subclassId ? `<span class="badge-tag subclass-tag">${char.subclassId}</span>` : ''}
                  </div>
                </div>
              </div>

              <div class="character-card-details">
                <div><strong>Trasfondo:</strong> ${char.backgroundName || 'Ninguno'}</div>
                <div><strong>Alineamiento:</strong> ${char.alignment || 'Neutral'}</div>
                <div><strong>Última sesión:</strong> ${updatedDate}</div>
              </div>

              <!-- CHIPS DE COMBATE -->
              <div class="character-card-stats">
                <div class="stat-chip ac-chip">
                  <span class="chip-label">CA</span>
                  <span class="chip-value">${ac}</span>
                </div>
                <div class="stat-chip hp-chip">
                  <span class="chip-label">PG</span>
                  <span class="chip-value">${currentHp}/${maxHp}</span>
                </div>
                <div class="stat-chip init-chip">
                  <span class="chip-label">INIT</span>
                  <span class="chip-value">${init >= 0 ? '+' : ''}${init}</span>
                </div>
                <div class="stat-chip pb-chip">
                  <span class="chip-label">PB</span>
                  <span class="chip-value">+${pb}</span>
                </div>
              </div>

              <!-- ACCIONES DE TARJETA -->
              <div class="character-card-actions">
                <button class="btn btn-primary btn-play-card" onclick="window.app.openCharacterSheet('${char.id}')">
                  ⚔️ Jugar / Abrir Hoja
                </button>
                <div class="card-secondary-actions">
                  <button class="btn btn-secondary btn-icon" title="Editar en Creador" onclick="window.app.editCharacterInCreator('${char.id}')">
                    ✏️
                  </button>
                  <button class="btn btn-secondary btn-icon" title="Duplicar Personaje" onclick="window.app.duplicateCharacter('${char.id}')">
                    📋
                  </button>
                  <button class="btn btn-secondary btn-icon" title="Exportar a PDF" onclick="window.app.exportCharacterPDF('${char.id}')">
                    📄
                  </button>
                  <button class="btn btn-secondary btn-icon btn-danger" title="Eliminar Personaje" onclick="window.app.deleteCharacter('${char.id}')">
                    🗑
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;
}

export function setSearchQuery(q) {
  searchQuery = q;
}

export function setFilterClass(c) {
  filterClass = c;
}

export function setFilterLevel(l) {
  filterLevel = l;
}

export function setSortBy(s) {
  sortBy = s;
}

function getClassIcon(classId) {
  const icons = {
    barbaro: '🪓',
    bardo: '🪕',
    clerigo: '✨',
    druida: '🌿',
    guerrero: '⚔️',
    hechicero: '⚡',
    mago: '📖',
    monje: '🥋',
    paladin: '🛡️',
    picaro: '🗡️',
    explorador: '🏹',
    brujo: '👁️'
  };
  return icons[classId] || '👤';
}
