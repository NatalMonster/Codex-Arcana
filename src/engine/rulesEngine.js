/**
 * Motor de Reglas D&D 2024
 * Funciones puras para cálculos de reglas y valores derivados.
 */

export function calculateModifier(score) {
  return Math.floor((Number(score) - 10) / 2);
}

export function calculateProficiencyBonus(level = 1) {
  const lvl = Math.max(1, Math.min(20, Number(level) || 1));
  return Math.floor((lvl - 1) / 4) + 2;
}

export function calculateFinalAbilities(baseScores = {}, backgroundBonuses = {}) {
  const abilities = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'sabiduria', 'carisma'];
  const result = {};

  for (const ab of abilities) {
    const rawBase = baseScores[ab];
    const base = (rawBase !== undefined && rawBase !== null && !isNaN(rawBase)) ? Number(rawBase) : 0;
    const bonus = Number(backgroundBonuses[ab]) || 0;
    const isAssigned = base > 0;
    const finalScore = isAssigned ? Math.min(20, base + bonus) : 0;
    result[ab] = {
      base,
      bonus,
      score: finalScore,
      mod: isAssigned ? calculateModifier(finalScore) : 0,
      isAssigned
    };
  }

  return result;
}

export function calculateHitPoints({
  classDef,
  conMod = 0,
  level = 1,
  speciesDef = null,
  featIds = []
}) {
  if (!classDef) return 10;
  const lvl = Math.max(1, Number(level) || 1);
  const baseHpLvl1 = classDef.hitDie + conMod;

  let hp = Math.max(1, baseHpLvl1);

  if (lvl > 1) {
    const perLevel = Math.max(1, Math.floor(classDef.hitDie / 2) + 1 + conMod);
    hp += perLevel * (lvl - 1);
  }

  // Firmeza enana (+1 PG por nivel)
  if (speciesDef && speciesDef.id === 'enano') {
    hp += 1 * lvl;
  }

  // Dote Duro (+2 PG por nivel)
  if (featIds && featIds.includes('duro')) {
    hp += 2 * lvl;
  }

  return Math.max(1, hp);
}

export function calculateInitiative(dexMod = 0, featIds = [], pb = 2) {
  let init = dexMod;
  if (featIds && featIds.includes('alerta')) {
    init += pb;
  }
  return init;
}

export const STANDARD_ARMORS_TABLE = [
  { id: 'acolchada', name: 'Armadura acolchada', baseAc: 11, category: 'ligera', addsDex: true, maxDex: null, stealthDisadvantage: true },
  { id: 'cuero', name: 'Armadura de cuero', baseAc: 11, category: 'ligera', addsDex: true, maxDex: null, stealthDisadvantage: false },
  { id: 'cuero_tachonado', name: 'Armadura de cuero tachonado', baseAc: 12, category: 'ligera', addsDex: true, maxDex: null, stealthDisadvantage: false },
  { id: 'pieles', name: 'Armadura de pieles', baseAc: 12, category: 'media', addsDex: true, maxDex: 2, stealthDisadvantage: false },
  { id: 'camisa_malla', name: 'Camisa de malla', baseAc: 13, category: 'media', addsDex: true, maxDex: 2, stealthDisadvantage: false },
  { id: 'cota_escamas', name: 'Cota de escamas', baseAc: 14, category: 'media', addsDex: true, maxDex: 2, stealthDisadvantage: true },
  { id: 'coraza', name: 'Coraza', baseAc: 14, category: 'media', addsDex: true, maxDex: 2, stealthDisadvantage: false },
  { id: 'media_armadura', name: 'Media armadura', baseAc: 15, category: 'media', addsDex: true, maxDex: 2, stealthDisadvantage: true },
  { id: 'cota_guarnecida', name: 'Cota guarnecida', baseAc: 14, category: 'pesada', addsDex: false, maxDex: 0, stealthDisadvantage: true },
  { id: 'cota_malla', name: 'Cota de malla', baseAc: 16, category: 'pesada', addsDex: false, maxDex: 0, strengthReq: 13, stealthDisadvantage: true },
  { id: 'bandas', name: 'Armadura de bandas', baseAc: 17, category: 'pesada', addsDex: false, maxDex: 0, strengthReq: 15, stealthDisadvantage: true },
  { id: 'placas', name: 'Armadura de placas', baseAc: 18, category: 'pesada', addsDex: false, maxDex: 0, strengthReq: 15, stealthDisadvantage: true }
];

export function normalizeEquipmentString(str = '') {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function isShieldItem(item) {
  if (!item) return false;
  const id = normalizeEquipmentString(item.id || item.catalogId || '');
  const name = normalizeEquipmentString(item.name || '');
  const type = normalizeEquipmentString(item.type || item.category || '');
  return id === 'escudo' || name.includes('escudo') || type === 'escudo' || (typeof item.acBonus === 'number' && item.acBonus > 0);
}

export function matchArmorDefinition(item, armorsList = STANDARD_ARMORS_TABLE) {
  if (!item || isShieldItem(item)) return null;
  const rawId = normalizeEquipmentString(item.catalogId || item.id || '');
  const rawName = normalizeEquipmentString(item.name || '');

  let found = armorsList.find(a => normalizeEquipmentString(a.id) === rawId);
  if (found) return found;

  found = armorsList.find(a => normalizeEquipmentString(a.name) === rawName);
  if (found) return found;

  if (rawName.includes('cuerotachonado')) return armorsList.find(a => a.id === 'cuero_tachonado') || null;
  if (rawName.includes('cuero')) return armorsList.find(a => a.id === 'cuero') || null;
  if (rawName.includes('cotamalla') || rawName.includes('cotademalla')) return armorsList.find(a => a.id === 'cota_malla') || null;
  if (rawName.includes('escamas')) return armorsList.find(a => a.id === 'cota_escamas') || null;
  if (rawName.includes('placas')) return armorsList.find(a => a.id === 'placas') || null;
  if (rawName.includes('bandas')) return armorsList.find(a => a.id === 'bandas') || null;
  if (rawName.includes('coraza')) return armorsList.find(a => a.id === 'coraza') || null;
  if (rawName.includes('mediaarmadura')) return armorsList.find(a => a.id === 'media_armadura') || null;
  if (rawName.includes('camisamalla') || rawName.includes('camisademalla')) return armorsList.find(a => a.id === 'camisa_malla') || null;
  if (rawName.includes('acolchada')) return armorsList.find(a => a.id === 'acolchada') || null;
  if (rawName.includes('pieles')) return armorsList.find(a => a.id === 'pieles') || null;
  if (rawName.includes('guarnecida')) return armorsList.find(a => a.id === 'cota_guarnecida') || null;

  if (item.type === 'armadura' || item.category === 'armadura') {
    return {
      id: item.id || 'custom_armor',
      name: item.name || 'Armadura personalizada',
      baseAc: item.baseAc || 11,
      category: item.category === 'pesada' || item.category === 'media' ? item.category : 'ligera',
      addsDex: item.addsDex !== undefined ? item.addsDex : true,
      maxDex: item.maxDex !== undefined ? item.maxDex : null,
      stealthDisadvantage: Boolean(item.stealthDisadvantage),
      strengthReq: item.strengthReq || null
    };
  }

  return null;
}

export function getArmorClassBreakdown({
  inventory = [],
  classDef = null,
  abilities = {},
  fightingStyle = null,
  catalogs = null,
  armorItem = null,
  hasShield = false,
  dexMod: directDex = null,
  conMod: directCon = null,
  wisMod: directWis = null
} = {}) {
  const dexMod = directDex !== null ? directDex : (abilities?.destreza?.mod || 0);
  const conMod = directCon !== null ? directCon : (abilities?.constitucion?.mod || 0);
  const wisMod = directWis !== null ? directWis : (abilities?.sabiduria?.mod || 0);
  const strScore = abilities?.fuerza?.score || 10;
  const classId = (classDef?.id || classDef || '').toLowerCase();

  const armorsList = catalogs?.equipment?.armors || STANDARD_ARMORS_TABLE;

  let equippedArmorItem = armorItem;
  let equippedShieldItem = null;
  let shieldActive = Boolean(hasShield);

  if (Array.isArray(inventory) && inventory.length > 0) {
    const equippedList = inventory.filter(i => i && i.equipped);
    for (const item of equippedList) {
      if (isShieldItem(item)) {
        if (!equippedShieldItem) {
          equippedShieldItem = item;
          shieldActive = true;
        }
      } else {
        const matched = matchArmorDefinition(item, armorsList);
        if (matched && !equippedArmorItem) {
          equippedArmorItem = { ...matched, instanceName: item.name, inventoryId: item.id };
        }
      }
    }
  }

  const isWearingArmor = Boolean(equippedArmorItem);
  let baseAc = 10;
  let armorName = 'Sin armadura';
  let armorTypeLabel = 'Sin armadura';
  let armorCategory = 'sin_armadura';
  let dexApplied = 0;
  let dexNote = '';
  let stealthDisadvantage = false;
  let strengthReq = null;

  if (isWearingArmor) {
    armorName = equippedArmorItem.instanceName || equippedArmorItem.name || 'Armadura';
    baseAc = equippedArmorItem.baseAc || 11;
    stealthDisadvantage = Boolean(equippedArmorItem.stealthDisadvantage);
    strengthReq = equippedArmorItem.strengthReq || null;

    if (equippedArmorItem.category === 'pesada' || equippedArmorItem.addsDex === false || equippedArmorItem.maxDex === 0) {
      armorCategory = 'pesada';
      armorTypeLabel = 'Armadura Pesada';
      dexApplied = 0;
      dexNote = 'No aplica DES (Pesada)';
    } else if (equippedArmorItem.category === 'media' || equippedArmorItem.maxDex === 2) {
      armorCategory = 'media';
      armorTypeLabel = 'Armadura Media';
      dexApplied = Math.min(2, dexMod);
      dexNote = 'Máx +2 por armadura media';
    } else {
      armorCategory = 'ligera';
      armorTypeLabel = 'Armadura Ligera';
      dexApplied = dexMod;
      dexNote = 'Mod. DES completo';
    }
  } else {
    baseAc = 10;
    dexApplied = dexMod;
    dexNote = 'Mod. DES base (10 + DES)';
  }

  let shieldBonus = 0;
  let shieldName = null;
  if (shieldActive) {
    shieldBonus = equippedShieldItem?.acBonus || 2;
    shieldName = equippedShieldItem?.name || 'Escudo';
  }

  const activePassives = [];
  const inactivePassives = [];

  // Bárbaro: Defensa sin armadura (10 + DES + CON, escudo permitido)
  if (classId === 'barbaro') {
    if (!isWearingArmor) {
      activePassives.push({
        id: 'defensa_sin_armadura_barbaro',
        name: 'Defensa sin armadura (Bárbaro)',
        bonus: conMod,
        desc: `Suma tu modificador de Constitución (+${conMod}) a la CA`
      });
    } else {
      inactivePassives.push({
        id: 'defensa_sin_armadura_barbaro',
        name: 'Defensa sin armadura (Bárbaro)',
        reason: 'Inactiva mientras lleves armadura puesta'
      });
    }
  }

  // Monje: Defensa sin armadura (10 + DES + SAB, ni armadura ni escudo)
  if (classId === 'monje') {
    if (!isWearingArmor && !shieldActive) {
      activePassives.push({
        id: 'defensa_sin_armadura_monje',
        name: 'Defensa sin armadura (Monje)',
        bonus: wisMod,
        desc: `Suma tu modificador de Sabiduría (+${wisMod}) a la CA`
      });
    } else {
      inactivePassives.push({
        id: 'defensa_sin_armadura_monje',
        name: 'Defensa sin armadura (Monje)',
        reason: shieldActive ? 'Inactiva al empuñar un escudo' : 'Inactiva mientras lleves armadura puesta'
      });
    }
  }

  // Estilo de combate: Defensa (+1 a la CA mientras lleves puesta armadura)
  const normStyle = normalizeEquipmentString(fightingStyle || '');
  if (normStyle.includes('defensa')) {
    if (isWearingArmor) {
      activePassives.push({
        id: 'estilo_defensa',
        name: 'Estilo de combate: Defensa',
        bonus: 1,
        desc: '+1 a la CA mientras lleves puesta una armadura'
      });
    } else {
      inactivePassives.push({
        id: 'estilo_defensa',
        name: 'Estilo de combate: Defensa',
        reason: 'Inactiva: requiere llevar puesta armadura'
      });
    }
  }

  let totalAc = baseAc + dexApplied + shieldBonus;
  for (const passive of activePassives) {
    totalAc += passive.bonus;
  }

  const meetsStrength = !strengthReq || (strScore >= strengthReq);

  return {
    totalAc,
    baseAc,
    armorName,
    armorCategory,
    armorTypeLabel,
    dexApplied,
    dexMod,
    dexNote,
    dexContribution: dexApplied,
    passives: [
      ...activePassives.map(p => ({ ...p, active: true })),
      ...inactivePassives.map(p => ({ ...p, active: false }))
    ],
    isWearingArmor,
    shieldActive,
    shieldBonus,
    shieldName,
    activePassives,
    inactivePassives,
    stealthDisadvantage,
    strengthReq,
    meetsStrength,
    strScore,
    equippedArmorItem,
    equippedShieldItem
  };
}

export function calculateArmorClass({
  armorItem = null,
  hasShield = false,
  classDef = null,
  dexMod = 0,
  conMod = 0,
  wisMod = 0,
  fightingStyle = null,
  inventory = [],
  abilities = null,
  catalogs = null
} = {}) {
  const abs = abilities || {
    destreza: { mod: dexMod },
    constitucion: { mod: conMod },
    sabiduria: { mod: wisMod }
  };
  return getArmorClassBreakdown({
    inventory,
    classDef,
    abilities: abs,
    fightingStyle,
    catalogs,
    armorItem,
    hasShield,
    dexMod,
    conMod,
    wisMod
  }).totalAc;
}

export function calculatePassivePerception(wisMod = 0, isProficient = false, hasExpertise = false, pb = 2) {
  let bonus = 0;
  if (isProficient) bonus += pb;
  if (hasExpertise) bonus += pb;
  return 10 + wisMod + bonus;
}

export function calculateSpellcastingStats(classDef, abilities, pb = 2, customAbility = null, subclassId = null) {
  let abKey = customAbility || (classDef?.spellcasting ? classDef.spellcasting.ability : null);
  if (!abKey && subclassId) {
    const normSub = subclassId.toLowerCase();
    if (['caballero_arcano', 'embaucador_arcano'].includes(normSub)) {
      abKey = 'inteligencia';
    } else if (['sombra', 'elementos'].includes(normSub)) {
      abKey = 'sabiduria';
    }
  }
  if (!abKey || !abilities || !abilities[abKey]) return null;

  const abMod = abilities[abKey].mod;
  return {
    ability: abKey,
    mod: abMod,
    saveDc: 8 + pb + abMod,
    attackBonus: pb + abMod
  };
}

export const LEVEL_XP_THRESHOLDS = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000
};

export function getXpProgress(currentXp = 0, currentLevel = 1) {
  const lvl = Math.max(1, Math.min(20, Number(currentLevel) || 1));
  const xp = Math.max(0, Number(currentXp) || 0);
  const currentLevelXp = LEVEL_XP_THRESHOLDS[lvl] ?? 0;
  const nextLevel = lvl < 20 ? lvl + 1 : null;
  const nextLevelXp = nextLevel ? LEVEL_XP_THRESHOLDS[nextLevel] : null;

  const canLevelUp = nextLevel !== null && xp >= nextLevelXp;
  const xpNeeded = nextLevelXp !== null ? Math.max(0, nextLevelXp - xp) : 0;

  let percent = 100;
  if (nextLevelXp !== null) {
    const range = nextLevelXp - currentLevelXp;
    const gainedInRange = xp - currentLevelXp;
    percent = Math.min(100, Math.max(0, Math.round((gainedInRange / range) * 100)));
  }

  return {
    currentXp: xp,
    currentLevel: lvl,
    currentLevelXp,
    nextLevel,
    nextLevelXp,
    xpNeeded,
    canLevelUp,
    percent
  };
}

export const FULL_CASTER_SLOTS_TABLE = {
  1: { slots: { '1': 2 }, maxLevel: 1, prep: 4 },
  2: { slots: { '1': 3 }, maxLevel: 1, prep: 5 },
  3: { slots: { '1': 4, '2': 2 }, maxLevel: 2, prep: 6 },
  4: { slots: { '1': 4, '2': 3 }, maxLevel: 2, prep: 7 },
  5: { slots: { '1': 4, '2': 3, '3': 2 }, maxLevel: 3, prep: 9 },
  6: { slots: { '1': 4, '2': 3, '3': 3 }, maxLevel: 3, prep: 10 },
  7: { slots: { '1': 4, '2': 3, '3': 3, '4': 1 }, maxLevel: 4, prep: 11 },
  8: { slots: { '1': 4, '2': 3, '3': 3, '4': 2 }, maxLevel: 4, prep: 12 },
  9: { slots: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 1 }, maxLevel: 5, prep: 14 },
  10: { slots: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2 }, maxLevel: 5, prep: 15 },
  11: { slots: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1 }, maxLevel: 6, prep: 16 },
  12: { slots: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1 }, maxLevel: 6, prep: 16 },
  13: { slots: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1 }, maxLevel: 7, prep: 17 },
  14: { slots: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1 }, maxLevel: 7, prep: 17 },
  15: { slots: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1 }, maxLevel: 8, prep: 18 },
  16: { slots: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1 }, maxLevel: 8, prep: 18 },
  17: { slots: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1, '9': 1 }, maxLevel: 9, prep: 19 },
  18: { slots: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 1, '7': 1, '8': 1, '9': 1 }, maxLevel: 9, prep: 20 },
  19: { slots: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 2, '7': 1, '8': 1, '9': 1 }, maxLevel: 9, prep: 22 },
  20: { slots: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 2, '7': 2, '8': 1, '9': 1 }, maxLevel: 9, prep: 22 }
};

export const HALF_CASTER_SLOTS_TABLE = {
  1: { slots: { '1': 2 }, maxLevel: 1, prep: 2 },
  2: { slots: { '1': 2 }, maxLevel: 1, prep: 3 },
  3: { slots: { '1': 3 }, maxLevel: 1, prep: 4 },
  4: { slots: { '1': 3 }, maxLevel: 1, prep: 5 },
  5: { slots: { '1': 4, '2': 2 }, maxLevel: 2, prep: 6 },
  6: { slots: { '1': 4, '2': 2 }, maxLevel: 2, prep: 6 },
  7: { slots: { '1': 4, '2': 3 }, maxLevel: 2, prep: 7 },
  8: { slots: { '1': 4, '2': 3 }, maxLevel: 2, prep: 7 },
  9: { slots: { '1': 4, '2': 3, '3': 2 }, maxLevel: 3, prep: 9 },
  10: { slots: { '1': 4, '2': 3, '3': 2 }, maxLevel: 3, prep: 9 },
  11: { slots: { '1': 4, '2': 3, '3': 3 }, maxLevel: 3, prep: 10 },
  12: { slots: { '1': 4, '2': 3, '3': 3 }, maxLevel: 3, prep: 10 },
  13: { slots: { '1': 4, '2': 3, '3': 3, '4': 1 }, maxLevel: 4, prep: 11 },
  14: { slots: { '1': 4, '2': 3, '3': 3, '4': 1 }, maxLevel: 4, prep: 11 },
  15: { slots: { '1': 4, '2': 3, '3': 3, '4': 2 }, maxLevel: 4, prep: 12 },
  16: { slots: { '1': 4, '2': 3, '3': 3, '4': 2 }, maxLevel: 4, prep: 12 },
  17: { slots: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 1 }, maxLevel: 5, prep: 14 },
  18: { slots: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 1 }, maxLevel: 5, prep: 14 },
  19: { slots: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2 }, maxLevel: 5, prep: 15 },
  20: { slots: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2 }, maxLevel: 5, prep: 15 }
};

export const WARLOCK_SLOTS_TABLE = {
  1: { slots: { '1': 1 }, maxLevel: 1, prep: 2 },
  2: { slots: { '1': 2 }, maxLevel: 1, prep: 3 },
  3: { slots: { '2': 2 }, maxLevel: 2, prep: 4 },
  4: { slots: { '2': 2 }, maxLevel: 2, prep: 5 },
  5: { slots: { '3': 2 }, maxLevel: 3, prep: 6 },
  6: { slots: { '3': 2 }, maxLevel: 3, prep: 7 },
  7: { slots: { '4': 2 }, maxLevel: 4, prep: 8 },
  8: { slots: { '4': 2 }, maxLevel: 4, prep: 9 },
  9: { slots: { '5': 2 }, maxLevel: 5, prep: 10 },
  10: { slots: { '5': 2 }, maxLevel: 5, prep: 10 },
  11: { slots: { '5': 3 }, maxLevel: 5, prep: 11 },
  12: { slots: { '5': 3 }, maxLevel: 5, prep: 11 },
  13: { slots: { '5': 3 }, maxLevel: 5, prep: 12 },
  14: { slots: { '5': 3 }, maxLevel: 5, prep: 12 },
  15: { slots: { '5': 3 }, maxLevel: 5, prep: 13 },
  16: { slots: { '5': 3 }, maxLevel: 5, prep: 13 },
  17: { slots: { '5': 4 }, maxLevel: 5, prep: 14 },
  18: { slots: { '5': 4 }, maxLevel: 5, prep: 14 },
  19: { slots: { '5': 4 }, maxLevel: 5, prep: 15 },
  20: { slots: { '5': 4 }, maxLevel: 5, prep: 15 }
};

export const THIRD_CASTER_SLOTS_TABLE = {
  3: { slots: { '1': 2 }, maxLevel: 1, prep: 3 },
  4: { slots: { '1': 3 }, maxLevel: 1, prep: 4 },
  5: { slots: { '1': 3 }, maxLevel: 1, prep: 4 },
  6: { slots: { '1': 3 }, maxLevel: 1, prep: 4 },
  7: { slots: { '1': 4, '2': 2 }, maxLevel: 2, prep: 5 },
  8: { slots: { '1': 4, '2': 2 }, maxLevel: 2, prep: 6 },
  9: { slots: { '1': 4, '2': 2 }, maxLevel: 2, prep: 6 },
  10: { slots: { '1': 4, '2': 3 }, maxLevel: 2, prep: 7 },
  11: { slots: { '1': 4, '2': 3 }, maxLevel: 2, prep: 8 },
  12: { slots: { '1': 4, '2': 3 }, maxLevel: 2, prep: 8 },
  13: { slots: { '1': 4, '2': 3, '3': 2 }, maxLevel: 3, prep: 9 },
  14: { slots: { '1': 4, '2': 3, '3': 2 }, maxLevel: 3, prep: 10 },
  15: { slots: { '1': 4, '2': 3, '3': 2 }, maxLevel: 3, prep: 10 },
  16: { slots: { '1': 4, '2': 3, '3': 3 }, maxLevel: 3, prep: 11 },
  17: { slots: { '1': 4, '2': 3, '3': 3 }, maxLevel: 3, prep: 11 },
  18: { slots: { '1': 4, '2': 3, '3': 3 }, maxLevel: 3, prep: 11 },
  19: { slots: { '1': 4, '2': 3, '3': 3, '4': 1 }, maxLevel: 4, prep: 12 },
  20: { slots: { '1': 4, '2': 3, '3': 3, '4': 1 }, maxLevel: 4, prep: 13 }
};

export function getSpellcastingProgression(classId = '', level = 1, subclassId = '') {
  const normId = (classId || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const normSub = (subclassId || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const lvl = Math.max(1, Math.min(20, Number(level) || 1));

  if (['bardo', 'clerigo', 'druida', 'hechicero', 'mago'].includes(normId)) {
    const data = FULL_CASTER_SLOTS_TABLE[lvl] || FULL_CASTER_SLOTS_TABLE[1];
    return {
      isSpellcaster: true,
      spellSlots: { ...data.slots },
      maxSpellLevel: data.maxLevel,
      preparedCount: data.prep
    };
  }

  if (['paladin', 'explorador'].includes(normId)) {
    const data = HALF_CASTER_SLOTS_TABLE[lvl] || HALF_CASTER_SLOTS_TABLE[1];
    return {
      isSpellcaster: true,
      spellSlots: { ...data.slots },
      maxSpellLevel: data.maxLevel,
      preparedCount: data.prep
    };
  }

  if (normId === 'brujo') {
    const data = WARLOCK_SLOTS_TABLE[lvl] || WARLOCK_SLOTS_TABLE[1];
    return {
      isSpellcaster: true,
      spellSlots: { ...data.slots },
      maxSpellLevel: data.maxLevel,
      preparedCount: data.prep
    };
  }

  if (['caballero_arcano', 'embaucador_arcano'].includes(normSub) && lvl >= 3) {
    const data = THIRD_CASTER_SLOTS_TABLE[lvl] || THIRD_CASTER_SLOTS_TABLE[3];
    return {
      isSpellcaster: true,
      spellSlots: { ...data.slots },
      maxSpellLevel: data.maxLevel,
      preparedCount: data.prep
    };
  }

  return {
    isSpellcaster: false,
    spellSlots: {},
    maxSpellLevel: 0,
    preparedCount: 0
  };
}

export const CLASS_FEATURES_BY_LEVEL = {
  barbaro: {
    1: [{ name: 'Furia', desc: 'Entras en furia en combate obteniendo ventaja en pruebas de Fuerza, bonificador al daño y resistencia.' }, { name: 'Defensa sin armadura', desc: 'Tu CA es 10 + Des + Con mientras no lleves armadura.' }, { name: 'Maestría con armas', desc: 'Emplea propiedades de maestría en 2 armas.' }],
    2: [{ name: 'Sentido del peligro', desc: 'Ventaja en tiradas de salvación de Destreza contra efectos que puedas ver.' }, { name: 'Ataque temerario', desc: 'Puedes atacar con ventaja a cambio de que los ataques contra ti tengan ventaja.' }],
    3: [{ name: 'Subclase de Bárbaro', desc: 'Eliges una senda de subclase y obtienes sus rasgos característicos.' }, { name: 'Furia primigenia', desc: 'Añades tu bonificador de Furia a tiradas de daño adicionales.' }],
    4: [{ name: 'Mejora de característica', desc: 'Aumenta una característica en 2 o dos en 1, o elige una dote.' }],
    5: [{ name: 'Ataque adicional', desc: 'Puedes atacar dos veces cuando llevas a cabo la acción de atacar.' }, { name: 'Movimiento rápido', desc: 'Tu velocidad aumenta en 3 m si no lleves armadura pesada.' }]
  },
  bardo: {
    1: [{ name: 'Lanzamiento de conjuros', desc: 'Lanzas conjuros arcanos usando tu Carisma.' }, { name: 'Inspiración bárdica (d6)', desc: 'Otorga dados de inspiración para sumar a pruebas, ataques o salvaciones.' }],
    2: [{ name: 'Aprendiz de mucho', desc: 'Añades la mitad de tu bonificador de competencia a cualquier prueba de característica sin competencia.' }, { name: 'Música de descanso', desc: 'Tus aliados recuperan 1d6 PG adicionales durante un descanso corto.' }],
    3: [{ name: 'Subclase de Bardo', desc: 'Te unes a un colegio bárdico.' }, { name: 'Pericias (Expertise)', desc: 'Duplica tu bonificador de competencia en 2 habilidades.' }, { name: 'Conjuros de Nivel 2', desc: 'Acceso a conjuros y ranuras de nivel 2.' }],
    4: [{ name: 'Mejora de característica', desc: 'Aumenta características o elige una dote.' }],
    5: [{ name: 'Fuente de inspiración', desc: 'Recuperas todos los usos de Inspiración bárdica tras un descanso corto o largo.' }, { name: 'Inspiración bárdica (d8)', desc: 'Tu dado de inspiración aumenta a 1d8.' }, { name: 'Conjuros de Nivel 3', desc: 'Acceso a conjuros y ranuras de nivel 3.' }]
  },
  brujo: {
    1: [{ name: 'Magia del pacto', desc: 'Lanzas conjuros que se recargan en descanso corto usando Carisma.' }, { name: 'Invocaciones sobrenaturales', desc: 'Personaliza tus poderes místicos.' }],
    2: [{ name: 'Invocaciones adicionales', desc: 'Obtienes invocaciones sobrenaturales adicionales.' }],
    3: [{ name: 'Subclase de Brujo', desc: 'Pacto con un patrón sobrenatural.' }, { name: 'Pacto místico', desc: 'Pacto del Filo, del Tomo o de la Cadena.' }, { name: 'Conjuros de Nivel 2', desc: 'Tus ranuras suben a nivel 2.' }],
    4: [{ name: 'Mejora de característica', desc: 'Aumenta características o elige una dote.' }],
    5: [{ name: 'Conjuros de Nivel 3', desc: 'Tus ranuras de pacto suben a nivel 3.' }]
  },
  clerigo: {
    1: [{ name: 'Lanzamiento de conjuros', desc: 'Lanzas conjuros divinos basados en Sabiduría.' }, { name: 'Orden sagrada', desc: 'Eliges Protector, Taumaturgo o Erudito.' }],
    2: [{ name: 'Canalizar divinidad', desc: 'Canalizas poder divino para Expulsar no muertos o Chispa divina.' }],
    3: [{ name: 'Subclase de Clérigo', desc: 'Eliges tu dominio divino.' }, { name: 'Conjuros de Nivel 2', desc: 'Acceso a conjuros y ranuras de nivel 2.' }],
    4: [{ name: 'Mejora de característica', desc: 'Aumenta características o elige una dote.' }],
    5: [{ name: 'Destruir muertos vivientes', desc: 'Los no muertos de bajo VD son destruidos instantáneamente al ser expulsados.' }, { name: 'Conjuros de Nivel 3', desc: 'Acceso a conjuros y ranuras de nivel 3.' }]
  },
  druida: {
    1: [{ name: 'Lanzamiento de conjuros', desc: 'Lanzas conjuros basados en Sabiduría y conexión con la naturaleza.' }, { name: 'Orden primigenia', desc: 'Eliges Mago primigenio o Guardián.' }],
    2: [{ name: 'Forma salvaje', desc: 'Te transformas mágicamente en una bestia.' }, { name: 'Compañero salvaje', desc: 'Invocas un familiar feérico temporal.' }],
    3: [{ name: 'Subclase de Druida', desc: 'Te unes a un círculo druídico.' }, { name: 'Conjuros de Nivel 2', desc: 'Acceso a conjuros y ranuras de nivel 2.' }],
    4: [{ name: 'Mejora de característica', desc: 'Aumenta características o elige una dote.' }],
    5: [{ name: 'Conjuros de Nivel 3', desc: 'Acceso a conjuros y ranuras de nivel 3.' }]
  },
  explorador: {
    1: [{ name: 'Lanzamiento de conjuros', desc: 'Lanzas conjuros basados en Sabiduría.' }, { name: 'Enemigo predilecto', desc: 'Puedes lanzar Marca del cazador sin gastar ranura de conjuro.' }, { name: 'Maestría con armas', desc: 'Usa propiedades de maestría.' }],
    2: [{ name: 'Estilo de combate', desc: 'Eliges un estilo de combate oficial.' }, { name: 'Explorador experto', desc: 'Bonificadores en terrenos y supervivencia.' }],
    3: [{ name: 'Subclase de Explorador', desc: 'Eliges un arquetipo de explorador.' }],
    4: [{ name: 'Mejora de característica', desc: 'Aumenta características o elige una dote.' }],
    5: [{ name: 'Ataque adicional', desc: 'Atacas dos veces con la acción de atacar.' }, { name: 'Conjuros de Nivel 2', desc: 'Acceso a conjuros y ranuras de nivel 2.' }]
  },
  guerrero: {
    1: [{ name: 'Estilo de combate', desc: 'Ganas un estilo marcial especializado.' }, { name: 'Segundo aliento', desc: 'Recuperas 1d10 + nivel de PG como acción adicional.' }, { name: 'Maestría con armas', desc: 'Usa propiedades de maestría en 3 armas.' }],
    2: [{ name: 'Oleada de acción', desc: 'Realizas una acción adicional en tu turno (1 vez por descanso).' }],
    3: [{ name: 'Subclase de Guerrero', desc: 'Eliges tu arquetipo marcial.' }],
    4: [{ name: 'Mejora de característica', desc: 'Aumenta características o elige una dote.' }],
    5: [{ name: 'Ataque adicional', desc: 'Atacas dos veces al realizar la acción de atacar.' }]
  },
  hechicero: {
    1: [{ name: 'Lanzamiento de conjuros', desc: 'Magia innata alimentada por Carisma.' }, { name: 'Furia hechicera', desc: 'Canalizas tu poder innato para potenciar tus conjuros.' }],
    2: [{ name: 'Fuente de magia', desc: 'Puntos de hechicería para crear ranuras o alimentar metamagia.' }],
    3: [{ name: 'Subclase de Hechicero', desc: 'Origen de tu linaje arcano.' }, { name: 'Metamagia', desc: 'Alteras las propiedades de tus conjuros.' }, { name: 'Conjuros de Nivel 2', desc: 'Acceso a conjuros y ranuras de nivel 2.' }],
    4: [{ name: 'Mejora de característica', desc: 'Aumenta características o elige una dote.' }],
    5: [{ name: 'Conjuros de Nivel 3', desc: 'Acceso a conjuros y ranuras de nivel 3.' }]
  },
  mago: {
    1: [{ name: 'Lanzamiento de conjuros', desc: 'Preparas conjuros de tu libro de conjuros con Inteligencia.' }, { name: 'Recuperación arcana', desc: 'Recuperas ranuras de conjuro en descansos cortos.' }, { name: 'Libro de conjuros', desc: 'Grimorio con tus conjuros aprendidos.' }],
    2: [{ name: 'Erudito', desc: 'Pericia en una habilidad de conocimiento (Arcanos, Historia, etc.).' }],
    3: [{ name: 'Subclase de Mago', desc: 'Te especializas en una escuela o tradición arcana.' }, { name: 'Conjuros de Nivel 2', desc: 'Acceso a conjuros y ranuras de nivel 2.' }],
    4: [{ name: 'Mejora de característica', desc: 'Aumenta características o elige una dote.' }],
    5: [{ name: 'Conjuros de Nivel 3', desc: 'Acceso a conjuros y ranuras de nivel 3.' }]
  },
  monje: {
    1: [{ name: 'Defensa sin armadura', desc: 'Tu CA es 10 + Des + Sab sin armadura.' }, { name: 'Artes marciales', desc: 'Golpes desarmados con Destreza y daño incrementado.' }],
    2: [{ name: 'Disciplina de concentración', desc: 'Puntos de Foco para Ráfaga de golpes, Defensa paciente y Paso del viento.' }, { name: 'Movimiento sin armadura', desc: 'Velocidad incrementada en 3 m.' }],
    3: [{ name: 'Subclase de Monje', desc: 'Eliges una tradición monástica.' }, { name: 'Desviar proyectiles', desc: 'Reduces el daño de proyectiles y puedes devolverlos.' }],
    4: [{ name: 'Caída lenta', desc: 'Reduces el daño de caídas.' }, { name: 'Mejora de característica', desc: 'Aumenta características o dote.' }],
    5: [{ name: 'Ataque adicional', desc: 'Dos ataques por acción.' }, { name: 'Golpe aturdidor', desc: 'Gasta foco para aturdir a un enemigo impactado.' }]
  },
  paladin: {
    1: [{ name: 'Lanzamiento de conjuros', desc: 'Magia sagrada vinculada a Carisma.' }, { name: 'Imposición de manos', desc: 'Reserva curativa de PG.' }, { name: 'Sentido divino', desc: 'Detectas celestiales, infernales y muertos vivientes.' }],
    2: [{ name: 'Castigo divino (Divine Smite)', desc: 'Añades daño radiante a tus ataques con armas.' }, { name: 'Estilo de combate', desc: 'Ganas un estilo marcial oficial.' }],
    3: [{ name: 'Subclase de Paladín', desc: 'Haces tu Juramento sagrado.' }, { name: 'Canalizar divinidad', desc: 'Canalizas energía sagrada.' }],
    4: [{ name: 'Mejora de característica', desc: 'Aumenta características o dote.' }],
    5: [{ name: 'Ataque adicional', desc: 'Dos ataques por acción.' }, { name: 'Conjuros de Nivel 2', desc: 'Acceso a conjuros y ranuras de nivel 2.' }]
  },
  picaro: {
    1: [{ name: 'Ataque furtivo', desc: '1d6 de daño extra cuando atacas con ventaja o un aliado está adyacente.' }, { name: 'Pericias (Expertise)', desc: 'Duplica competencia en 2 habilidades.' }, { name: 'Jerga de ladrones', desc: 'Dialecto secreto de ladrones.' }, { name: 'Maestría con armas', desc: 'Usa propiedades de maestría en 2 armas.' }],
    2: [{ name: 'Acción astuta', desc: 'Acción adicional para Correr, Destrabarse o Esconderse.' }],
    3: [{ name: 'Subclase de Pícaro', desc: 'Eliges tu arquetipo de pícaro.' }, { name: 'Golpe astuto', desc: 'Sustituyes dados de ataque furtivo por efectos tácticos (desarmar, derribar, etc.).' }],
    4: [{ name: 'Mejora de característica', desc: 'Aumenta características o dote.' }],
    5: [{ name: 'Esquiva asombrosa', desc: 'Reacción para reducir el daño de un ataque a la mitad.' }]
  }
};

export function getClassFeaturesUpToLevel(classId = '', level = 1) {
  const normId = (classId || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const lvl = Math.max(1, Math.min(20, Number(level) || 1));
  const classTree = CLASS_FEATURES_BY_LEVEL[normId];
  if (!classTree) return [];

  const features = [];
  for (let l = 1; l <= lvl; l++) {
    if (classTree[l]) {
      classTree[l].forEach(f => features.push({ ...f, level: l }));
    }
  }
  return features;
}

/**
 * Calcula el oro inicial de un personaje según las reglas oficiales de D&D 2024
 * sumando las opciones elegidas de clase y trasfondo.
 */
export function calculateStartingGold({ char, catalogs }) {
  if (char && typeof char.gold === 'number' && !isNaN(char.gold)) {
    return char.gold;
  }

  let totalGold = 0;
  const classes = catalogs?.classes || [];
  const backgrounds = catalogs?.backgrounds || [];

  const classDef = classes.find(c => c.id === char?.classId);
  const bgDef = backgrounds.find(b => b.id === char?.backgroundId);

  const classChoice = char?.classEquipmentChoice || 'A';
  if (classDef?.equipmentOptions?.[classChoice]?.gold !== undefined) {
    totalGold += Number(classDef.equipmentOptions[classChoice].gold) || 0;
  }

  const bgChoice = char?.backgroundEquipmentChoice || 'A';
  if (bgDef?.equipmentOptions?.[bgChoice]?.gold !== undefined) {
    totalGold += Number(bgDef.equipmentOptions[bgChoice].gold) || 0;
  }

  if (totalGold === 0 && (!char || typeof char.gold !== 'number')) {
    totalGold = 50; // Oro base estándar de aventura D&D 2024
  }

  return totalGold;
}

/**
 * Calcula las monedas iniciales (Oro, Plata y Cobre) según las reglas oficiales de D&D 2024.
 */
export function calculateStartingCurrencies({ char, catalogs }) {
  const gold = calculateStartingGold({ char, catalogs });
  const silver = typeof char?.silver === 'number' && !isNaN(char.silver) ? char.silver : 0;
  const copper = typeof char?.copper === 'number' && !isNaN(char.copper) ? char.copper : 0;
  return { gold, silver, copper };
}


