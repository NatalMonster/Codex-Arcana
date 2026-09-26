/**
 * Helper para búsqueda de detalles descriptivos y menús desplegables
 * de Habilidades, Dotes, Conjuros y Maestrías.
 */

export function getSpellDetail(spellName, database) {
  if (!database || !spellName) return null;
  if (database[spellName]) return database[spellName];

  const norm = spellName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  for (const key in database) {
    const keyNorm = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (norm === keyNorm) return database[key];
  }

  const aliases = {
    'shillelagh': 'Shillelagh',
    'garrote magico': 'Shillelagh',
    'artificio druidico': 'Saber Druídico',
    'enredo': 'Enmarañar',
    'comprension idiomatica': 'Entender Idiomas',
    'duelo obligado': 'Duelo Forzado',
    'onda atronadora': 'Ola Atronadora',
    'retirada expedita': 'Retirada Expeditiva',
    'expedicion expedita': 'Retirada Expeditiva',
    'familiar': 'Encontrar Familiar',
    'misil magico': 'Proyectil Mágico',
    'porrazo de hielo': 'Cuchillo de Hielo',
    'color rociado': 'Rociada de Color',
    'rayo de dolor': 'Rayo Nauseabundo',
    'rayo de enfermedad': 'Rayo Nauseabundo',
    'rayo de hechiceria': 'Rayo de Hechicería',
    'rayo de hechicheria': 'Rayo de Hechicería',
    'proyectil de bruja': 'Rayo de Hechicería',
    'escudo': 'Escudo',
    'escudo de la fe': 'Escudo de Fe',
    'rociada venenosa': 'Rociada Venenosa',
    'proteccion contra el mal y el bien': 'Protección Contra el Bien y el Mal',
    'guia magica': 'Guía',
    'escritura ilusoria': 'Escritura Ilusoria',
    'ola de tierra': 'Ola de Tierra',
    'disparo de espinas': 'Disparo de Espinas',
    'castigo atronador': 'Castigo Atronador',
    // Subclases D&D 2024 aliases
    'celeridad': 'Acelerar',
    'reflejos': 'Imagen Múltiple',
    'faro de esperanza': 'Señal de Esperanza',
    'ceguera/sordera': 'Sordera/ceguera',
    'restauracion mayor': 'Restablecimiento Mayor',
    'restauracion menor': 'Restablecimiento Menor',
    'proteccion contra la muerte': 'Guarda Contra la Muerte',
    'guardianes espirituales': 'Espíritus Guardianes',
    'manto de cruzado': 'Manto del Cruzado',
    'ladrido': 'Piel Robliza',
    'truco de cuerda': 'Truco de la Cuerda',
    'auxilio divino': 'Auxilio Divino',
    'comunion': 'Comunión',
    'comunion con la naturaleza': 'Comunión con la Naturaleza',
    'hablar con los animales': 'Hablar con los Animales',
    'alzar a los muertos': 'Revivir a los Muertos',
    'parecer enganoso': 'Apariencia',
    'apestar': 'Nube Apestosa',
    'imprecacion': 'Imponer Maldición',
    'susurros disonantes': 'Susurros Discordantes',
    'corona de locura': 'Corona de la Locura',
    'modificar memoria': 'Alterar los Recuerdos',
    'llamar al rayo': 'Llamar Al Relámpago',
    'crecimiento de espinas': 'Crecimiento Espinoso',
    'nube de niebla': 'Nube de Oscurecimiento',
    'miedo': 'Terror Abyecto',
    'engano': 'Engañar',
    'mejora de caracteristica': 'Potenciar Característica',
    'invisibilidad mayor': 'Invisibilidad Mejorada',
    'telequinesis': 'Telequinesis',
    'intermitencia': 'Intermitencia'
  };

  const alias = aliases[norm];
  if (alias && database[alias]) return database[alias];

  for (const key in database) {
    const keyNorm = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (keyNorm.includes(norm) || norm.includes(keyNorm)) return database[key];
  }

  return null;
}

export function getSpellLevelLabel(spellName, spDetail, fallback = '') {
  if (spDetail) {
    if (spDetail.isCantrip) return 'Truco';
    if (spDetail.typeLine) {
      const tl = spDetail.typeLine.toLowerCase();
      if (tl.includes('truco')) return 'Truco';
      const m = tl.match(/nivel\s+(\d+)/i) || tl.match(/(\d+)\s*º?\s*nivel/i);
      if (m) return `Nivel ${m[1]}`;
    }
  }
  return fallback || '';
}

export function getSkillDetail(skillId, rules) {
  if (!rules || !rules.skills) return null;
  return rules.skills.find(s => s.id === skillId) || null;
}

export function getFeatDetail(featId, feats) {
  if (!feats) return null;
  return feats.find(f => f.id === featId) || null;
}

export function getMasteryDetail(masteryName, rules) {
  if (!rules || !rules.masteryProperties || !masteryName) return null;
  const norm = masteryName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  return rules.masteryProperties.find(m => m.id === norm || m.name.toLowerCase() === norm) || null;
}

export function getClassSpells(classId, maxLevel = 9, database = {}) {
  if (!classId || !database) return [];

  const normClass = classId.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const results = [];
  const seen = new Set();

  for (const key in database) {
    const sp = database[key];
    if (!sp || !sp.name || !sp.typeLine) continue;

    const typeLower = sp.typeLine.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const classMatch = typeLower.match(/\(([^)]+)\)/);
    if (!classMatch) continue;

    const classNames = classMatch[1].split(',').map(s => s.trim());
    const matchesClass = classNames.some(c => c.includes(normClass));
    if (!matchesClass) continue;

    const isCantrip = sp.isCantrip || typeLower.includes('truco');
    const lvlMatch = typeLower.match(/nivel\s+(\d+)/);
    const level = isCantrip ? 0 : (lvlMatch ? parseInt(lvlMatch[1], 10) : 1);

    if (level <= maxLevel) {
      if (!seen.has(sp.name)) {
        seen.add(sp.name);
        results.push({
          ...sp,
          level,
          isCantrip,
          levelLabel: isCantrip ? 'Truco' : `Nivel ${level}`
        });
      }
    }
  }

  return results.sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    return a.name.localeCompare(b.name, 'es');
  });
}

/**
 * Obtiene todos los objetos disponibles en el catálogo oficial de D&D 2024
 * (Armas, Armaduras, Equipo de Aventuras, Herramientas, Paquetes, Monturas).
 */
export function getAllCatalogItems(equipment) {
  if (!equipment) return [];
  const items = [];

  // 1. Armas
  (equipment.weapons || []).forEach(w => {
    items.push({
      id: w.id || 'weapon_' + w.name,
      name: w.name,
      category: 'arma',
      categoryLabel: `Arma ${w.type || 'marcial'}`,
      type: 'arma',
      weight: w.weight || '1 kg',
      weightLb: w.weightLb !== undefined ? w.weightLb : 2,
      cost: w.cost || '—',
      damage: w.damage,
      range: w.range,
      mastery: w.mastery,
      properties: Array.isArray(w.properties) ? w.properties.join(', ') : (w.properties || ''),
      desc: w.desc || `Daño: ${w.damage} | Alcance: ${w.range} | Maestría: ${(w.mastery || '').toUpperCase()} | Propiedades: ${Array.isArray(w.properties) ? w.properties.join(', ') : ''}`
    });
  });

  // 2. Armaduras y Escudos
  (equipment.armors || []).forEach(a => {
    const isShield = a.id === 'escudo' || (a.name || '').toLowerCase().includes('escudo');
    items.push({
      id: a.id || 'armor_' + a.name,
      name: a.name,
      category: 'armadura',
      categoryLabel: isShield ? 'Escudo' : `Armadura ${a.category || 'ligera'}`,
      type: 'armadura',
      weight: a.weight || '5 kg',
      weightLb: a.weightLb !== undefined ? a.weightLb : 10,
      cost: a.cost || '—',
      ac: a.baseAc,
      desc: a.desc || `CA: ${a.baseAc} ${a.addsDex ? '+ Mod Des' : ''}. Sigilo: ${a.stealthDisadvantage ? 'Desventaja' : 'Normal'}. Fuerza requerida: ${a.strengthRequirement || 'Ninguna'}`
    });
  });

  // 3. Equipo de Aventuras y Suministros
  (equipment.adventuringGear || []).forEach(g => {
    const isPotion = (g.categoryLabel || '').toLowerCase().includes('poción') || (g.name || '').toLowerCase().includes('poción') || (g.name || '').toLowerCase().includes('ácido') || (g.name || '').toLowerCase().includes('antitoxina') || (g.name || '').toLowerCase().includes('veneno') || (g.name || '').toLowerCase().includes('fuego de alquimista');
    items.push({
      id: g.id,
      name: g.name,
      category: isPotion ? 'suministro' : 'equipo',
      categoryLabel: g.categoryLabel || (isPotion ? 'Poción / Consumible' : 'Equipo de Aventuras'),
      type: isPotion ? 'suministro' : 'equipo',
      weight: g.weight || '0,5 kg',
      weightLb: g.weightLb !== undefined ? g.weightLb : 1,
      cost: g.cost || '1 po',
      desc: g.desc || '',
      properties: g.properties || ''
    });
  });

  // 4. Herramientas e Instrumentos
  (equipment.tools || []).forEach(t => {
    items.push({
      id: t.id,
      name: t.name,
      category: 'herramienta',
      categoryLabel: t.categoryLabel || 'Herramienta',
      type: 'herramienta',
      weight: t.weight || '1 kg',
      weightLb: t.weightLb !== undefined ? t.weightLb : 2,
      cost: t.cost || '10 po',
      desc: t.desc || '',
      properties: t.properties || ''
    });
  });

  // 5. Paquetes de Equipo
  (equipment.packs || []).forEach(p => {
    items.push({
      id: p.id,
      name: p.name,
      category: 'paquete',
      categoryLabel: 'Paquete de Equipo',
      type: 'equipo',
      weight: p.weight || '15 kg',
      weightLb: p.weightLb !== undefined ? p.weightLb : 30,
      cost: p.cost || '10 po',
      desc: p.desc || '',
      properties: p.properties || ''
    });
  });

  // 6. Monturas y Vehículos
  (equipment.mounts || []).forEach(m => {
    items.push({
      id: m.id,
      name: m.name,
      category: 'montura',
      categoryLabel: m.categoryLabel || 'Montura / Vehículo',
      type: 'equipo',
      weight: m.weight || '—',
      weightLb: m.weightLb !== undefined ? m.weightLb : 0,
      cost: m.cost || '10 po',
      desc: m.desc || '',
      properties: m.properties || ''
    });
  });

  return items;
}
