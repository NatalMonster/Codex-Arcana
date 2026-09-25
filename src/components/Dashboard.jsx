import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function getClassIcon(classId) {
  const icons = {
    barbaro: '🪓',
    bardo: '🎸',
    clerigo: '⚕️',
    druida: '🌿',
    guerrero: '⚔️',
    hechicero: '✨',
    mago: '📖',
    monje: '🥋',
    paladin: '🛡️',
    picaro: '🗡️',
    explorador: '🏹',
    brujo: '👁️'
  };
  return icons[(classId || '').toLowerCase()] || '🦸';
}

export default function Dashboard({ characters = [], classList = [], app }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  const filteredCharacters = useMemo(() => {
    let filtered = characters.filter(c => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (c.name || '').toLowerCase().includes(q);
        const matchClass = (c.className || '').toLowerCase().includes(q);
        const matchSpecies = (c.speciesName || '').toLowerCase().includes(q);
        if (!matchName && !matchClass && !matchSpecies) return false;
      }
      if (filterClass !== 'all' && c.classId !== filterClass) return false;
      if (filterLevel !== 'all' && Number(c.level) !== Number(filterLevel)) return false;
      return true;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'level_desc') return (b.level || 1) - (a.level || 1);
      if (sortBy === 'level_asc') return (a.level || 1) - (b.level || 1);
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return filtered;
  }, [characters, searchQuery, filterClass, filterLevel, sortBy]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="dashboard-react-container"
    >
      <div className="characters-view-header">
        <div className="view-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <h2 className="view-main-title" style={{ margin: 0 }}>
              <svg width="28" height="32" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginRight: '12px', verticalAlign: 'bottom'}}>
                <path d="M12 0L0 4V12C0 19.3 5.1 26 12 28C18.9 26 24 19.3 24 12V4L12 0Z" fill="#C89B3C"/>
                <path d="M12 2.5L2 5.8V12C2 18 6.3 23.5 12 25.2C17.7 23.5 22 18 22 12V5.8L12 2.5Z" fill="#151B25"/>
                <path d="M12 5V22.5C8 21 5 16.5 5 12V7.5L12 5Z" fill="#C89B3C"/>
              </svg>
              Mis Personajes
            </h2>
            <button className="btn btn-secondary" onClick={() => app.openWelcomeScreen()}>Volver</button>
          </div>
          <p className="view-subtitle" style={{ margin: 0 }}>Gestiona tus héroes forjados o crea uno nuevo para tu próxima aventura.</p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => app.startNewCharacter()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{marginRight: '6px'}}><path d="M12 5v14M5 12h14"/></svg>
          Forjar Nuevo Personaje
        </button>
      </div>

      <div className="filters-toolbar">
        <div className="search-box-wrapper">
          <span className="search-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input 
            type="text" 
            className="input-text search-input" 
            placeholder="Buscar por nombre, clase o especie..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filters-group">
          <div className="filter-item">
            <label className="filter-label">Clase:</label>
            <select className="select-box filter-select" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
              <option value="all">Todas las clases</option>
              {classList.map(cl => (
                <option key={cl.id} value={cl.id}>{cl.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-item">
            <label className="filter-label">Nivel:</label>
            <select className="select-box filter-select" value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
              <option value="all">Todos los niveles</option>
              <option value="1">Nivel 1</option>
              <option value="2">Nivel 2</option>
              <option value="3">Nivel 3</option>
            </select>
          </div>

          <div className="filter-item">
            <label className="filter-label">Ordenar:</label>
            <select className="select-box filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="recent">Más recientes</option>
              <option value="name_asc">Nombre (A - Z)</option>
              <option value="name_desc">Nombre (Z - A)</option>
              <option value="level_desc">Mayor nivel</option>
              <option value="level_asc">Menor nivel</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Mostrando <strong>{filteredCharacters.length}</strong> de <strong>{characters.length}</strong> personaje(s) guardado(s).
      </div>

      {filteredCharacters.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="empty-characters-box"
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏕️</div>
          <h3 style={{ color: 'var(--gold)', fontSize: '1.3rem', marginBottom: '0.5rem' }}>
            {characters.length === 0 ? 'Aún no tienes ningún personaje forjado' : 'Ningún personaje coincide con tu búsqueda'}
          </h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
            {characters.length === 0 
              ? 'Utiliza el asistente oficial de D&D 2024 para crear a tu primer héroe con reglas completas, conjuros y equipo.' 
              : 'Prueba a cambiar los filtros o el texto de búsqueda para encontrar a tu personaje.'}
          </p>
          <button className="btn btn-primary" onClick={() => app.startNewCharacter()}>
            ➕ Crear Mi Primer Personaje
          </button>
        </motion.div>
      ) : (
        <motion.div layout className="characters-grid">
          <AnimatePresence>
            {filteredCharacters.map(char => {
              const stats = char.calculatedStats || {};
              const maxHp = stats.maxHp || 10;
              const currentHp = typeof char.currentHp === 'number' ? char.currentHp : maxHp;
              const ac = stats.ac || 10;
              const init = stats.initiative || 0;
              const pb = stats.proficiencyBonus || 2;
              const updatedDate = new Date(char.updatedAt || char.createdAt || Date.now()).toLocaleDateString();

              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -5, boxShadow: '0 10px 20px rgba(0,0,0,0.4)' }}
                  transition={{ duration: 0.2 }}
                  key={char.id} 
                  className="character-card"
                >
                  <div className="character-card-header">
                    <div className="character-card-avatar">
                      {getClassIcon(char.classId)}
                    </div>
                    <div className="character-card-identity">
                      <h3 className="character-card-name">{char.name || 'Sin Nombre'}</h3>
                      <div className="character-card-meta">
                        <span className="badge-tag">{char.speciesName || 'Especie ?'}</span>
                        <span className="badge-tag class-tag">{char.className || 'Clase ?'} Nv {char.level}</span>
                        {char.subclassId && <span className="badge-tag subclass-tag">{char.subclassId}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="character-card-details">
                    <div><strong>Trasfondo:</strong> {char.backgroundName || 'Ninguno'}</div>
                    <div><strong>Alineamiento:</strong> {char.alignment || 'Neutral'}</div>
                    <div><strong>Última sesión:</strong> {updatedDate}</div>
                  </div>

                  <div className="character-card-stats">
                    <div className="stat-chip ac-chip">
                      <span className="chip-label">CA</span>
                      <span className="chip-value">{ac}</span>
                    </div>
                    <div className="stat-chip hp-chip">
                      <span className="chip-label">PG</span>
                      <span className="chip-value">{currentHp}/{maxHp}</span>
                    </div>
                    <div className="stat-chip init-chip">
                      <span className="chip-label">INIT</span>
                      <span className="chip-value">{init >= 0 ? '+' : ''}{init}</span>
                    </div>
                    <div className="stat-chip pb-chip">
                      <span className="chip-label">PB</span>
                      <span className="chip-value">+{pb}</span>
                    </div>
                  </div>

                  <div className="character-card-actions">
                    <button className="btn btn-primary btn-play-card" onClick={() => app.openCharacterSheet(char.id)}>
                      ⚔️ Jugar / Abrir Hoja
                    </button>
                    <div className="card-secondary-actions">
                      <button className="btn btn-secondary btn-icon" title="Editar en Creador" onClick={() => app.editCharacterInCreator(char.id)}>
                        ✏️
                      </button>
                      <button className="btn btn-secondary btn-icon" title="Duplicar Personaje" onClick={() => app.duplicateCharacter(char.id)}>
                        📋
                      </button>
                      <button className="btn btn-secondary btn-icon" title="Exportar a PDF" onClick={() => app.exportCharacterPDF(char.id)}>
                        📄
                      </button>
                      <button className="btn btn-secondary btn-icon btn-danger" title="Eliminar Personaje" onClick={() => app.deleteCharacter(char.id)}>
                        🗑️
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
}
