/**
 * Validador de Personajes D&D 2024
 * Valida todas las restricciones y reglas obligatorias del manual.
 */

export function validateCharacter(char, catalogs) {
  const errors = [];
  const warnings = [];

  // 1. Identidad básica (Paso 3: Concepto)
  if (!char.name || !char.name.trim()) {
    errors.push({ step: 3, field: 'name', message: 'El nombre del personaje es obligatorio.' });
  }

  const level = Number(char.level) || 1;
  if (level < 1 || level > 20) {
    errors.push({ step: 3, field: 'level', message: 'El nivel debe estar comprendido entre 1 y 20.' });
  }

  if (!char.alignment) {
    errors.push({ step: 3, field: 'alignment', message: 'Debes seleccionar un alineamiento.' });
  }

  // 2. Clase y Subclase (Paso 1: Clase)
  if (!char.classId) {
    errors.push({ step: 1, field: 'classId', message: 'Debes seleccionar una clase.' });
  } else {
    const classDef = catalogs.classes.find(c => c.id === char.classId);
    if (!classDef) {
      errors.push({ step: 1, field: 'classId', message: 'La clase seleccionada no es válida según el manual.' });
    } else {
      // Regla de subclase en D&D 2024: Se desbloquea en nivel 3
      if (level < 3 && char.subclassId) {
        errors.push({ step: 1, field: 'subclassId', message: 'Las subclases se desbloquean en el nivel 3. En nivel ' + level + ' no debe elegirse subclase.' });
      } else if (level >= 3 && !char.subclassId) {
        errors.push({ step: 1, field: 'subclassId', message: 'A partir de nivel 3 es obligatorio seleccionar una subclase.' });
      } else if (level >= 3 && char.subclassId) {
        const subDef = catalogs.subclasses.find(s => s.id === char.subclassId);
        if (!subDef || subDef.classId !== char.classId) {
          errors.push({ step: 1, field: 'subclassId', message: 'La subclase no corresponde a la clase seleccionada.' });
        }
      }
    }
  }

  // 3. Especie (Paso 2: Origen)
  if (!char.speciesId) {
    errors.push({ step: 2, field: 'speciesId', message: 'Debes seleccionar una especie.' });
  } else {
    const speciesDef = catalogs.species.find(s => s.id === char.speciesId);
    if (!speciesDef) {
      errors.push({ step: 2, field: 'speciesId', message: 'La especie seleccionada no es válida.' });
    } else {
      if (speciesDef.hasLineages && !char.speciesLineageId) {
        errors.push({ step: 2, field: 'speciesLineageId', message: 'Debes seleccionar una opción de ' + (speciesDef.lineageTitle || 'linaje') + '.' });
      }
      if (speciesDef.sizeOptions.length > 1 && !char.size) {
        errors.push({ step: 2, field: 'size', message: 'Debes elegir el tamaño de tu personaje (Mediano o Pequeño).' });
      }
    }
  }

  // 4. Trasfondo (Paso 2: Origen)
  if (!char.backgroundId) {
    errors.push({ step: 2, field: 'backgroundId', message: 'Debes seleccionar un trasfondo.' });
  } else {
    const bgDef = catalogs.backgrounds.find(b => b.id === char.backgroundId);
    if (!bgDef) {
      errors.push({ step: 2, field: 'backgroundId', message: 'El trasfondo seleccionado no es válido.' });
    }
  }

  // 5. Idiomas (Paso 2: Origen)
  const langs = char.languages || [];
  if (!langs.includes('comun')) {
    errors.push({ step: 2, field: 'languages', message: 'El personaje debe saber el idioma Común de forma obligatoria.' });
  }
  const nonCommonLangs = langs.filter(l => l !== 'comun');
  const requiredExtraLangs = (char.classId === 'picaro' ? 3 : 2); // Pícaro obtiene 1 adicional por jerga
  if (nonCommonLangs.length < requiredExtraLangs) {
    errors.push({ step: 2, field: 'languages', message: 'Debes seleccionar al menos ' + requiredExtraLangs + ' idiomas adicionales de la lista estándar.' });
  }

  // 6. Puntuaciones de Característica Base y Ajustes de Trasfondo
  const abilities = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'sabiduria', 'carisma'];
  const baseScores = char.baseAbilityScores || {};

  if (char.abilityGenerationMethod === 'standard_array') {
    const values = abilities.map(a => Number(baseScores[a]) || 0);
    const unassigned = values.filter(v => v === 0);
    if (unassigned.length > 0) {
      errors.push({ step: 4, field: 'baseAbilityScores', message: `Debes asignar un valor del Conjunto Estándar (15, 14, 13, 12, 10, 8) a las ${unassigned.length} característica(s) pendientes.` });
    } else {
      const sortedValues = [...values].sort((a, b) => b - a);
      const expected = [15, 14, 13, 12, 10, 8];
      const isMatch = sortedValues.every((val, idx) => val === expected[idx]);
      if (!isMatch) {
        errors.push({ step: 4, field: 'baseAbilityScores', message: 'Cada valor del Conjunto Estándar (15, 14, 13, 12, 10, 8) debe utilizarse exactamente una vez sin repetir.' });
      }
    }
  } else if (char.abilityGenerationMethod === 'point_buy') {
    const costs = (catalogs.rules && catalogs.rules.pointBuyCosts) || { '8': 0, '9': 1, '10': 2, '11': 3, '12': 4, '13': 5, '14': 7, '15': 9 };
    let spent = 0;
    let outOfBounds = false;
    for (const a of abilities) {
      const s = Number(baseScores[a]) || 8;
      if (s < 8 || s > 15) outOfBounds = true;
      spent += (costs[s.toString()] || 0);
    }
    if (outOfBounds) {
      errors.push({ step: 4, field: 'baseAbilityScores', message: 'En Compra por puntos, todas las características base deben estar entre 8 y 15.' });
    }
    if (spent !== 27) {
      errors.push({ step: 4, field: 'baseAbilityScores', message: `Debes gastar exactamente 27 puntos en Compra por puntos (actualmente has gastado ${spent}).` });
    }
  } else if (char.abilityGenerationMethod === 'roll') {
    for (const a of abilities) {
      const s = Number(baseScores[a]) || 0;
      if (s < 3 || s > 18) {
        errors.push({ step: 4, field: 'baseAbilityScores', message: 'Todas las características deben tener una puntuación entre 3 y 18.' });
        break;
      }
    }
  }

  const bgDef = catalogs.backgrounds.find(b => b.id === char.backgroundId);
  if (bgDef && char.backgroundAbilityBonus) {
    const eligible = bgDef.abilities;
    const bonusKeys = Object.keys(char.backgroundAbilityBonus).filter(k => (char.backgroundAbilityBonus[k] || 0) > 0);
    
    // Verificar que solo se aumenten características elegibles
    for (const k of bonusKeys) {
      if (!eligible.includes(k)) {
        errors.push({ step: 4, field: 'backgroundAbilityBonus', message: 'La bonificación a ' + k + ' no está permitida por el trasfondo ' + bgDef.name + '.' });
      }
    }

    const totalBonus = Object.values(char.backgroundAbilityBonus).reduce((acc, v) => acc + (Number(v) || 0), 0);
    if (totalBonus !== 3) {
      errors.push({ step: 4, field: 'backgroundAbilityBonus', message: 'Los bonificadores de trasfondo deben sumar exactamente +3 (+2 a una y +1 a otra, o +1 a tres diferentes).' });
    } else {
      // Validar si es +2 y +1 (2 características) o +1, +1, +1 (3 características)
      const values = bonusKeys.map(k => char.backgroundAbilityBonus[k]);
      const isTwoAndOne = values.length === 2 && values.includes(2) && values.includes(1);
      const isOneOneOne = values.length === 3 && values.every(v => v === 1);
      if (!isTwoAndOne && !isOneOneOne) {
        errors.push({ step: 4, field: 'backgroundAbilityBonus', message: 'Distribución inválida de bonos de trasfondo. Debe ser (+2, +1) o (+1, +1, +1).' });
      }
    }
  } else if (bgDef) {
    errors.push({ step: 4, field: 'backgroundAbilityBonus', message: 'Debes asignar los +3 puntos de bonificación del trasfondo.' });
  }

  // 7. Habilidades de Clase
  const classDef = catalogs.classes.find(c => c.id === char.classId);
  if (classDef) {
    const classSkills = char.classSkills || [];
    if (classSkills.length !== classDef.skillCount) {
      errors.push({ step: 5, field: 'classSkills', message: 'Debes seleccionar exactamente ' + classDef.skillCount + ' habilidades para la clase ' + classDef.name + '.' });
    }

    // Verificar que pertenezcan a la lista permitida
    if (classDef.skillPool !== 'all') {
      for (const s of classSkills) {
        if (!classDef.skillPool.includes(s)) {
          errors.push({ step: 5, field: 'classSkills', message: 'La habilidad ' + s + ' no está en la lista permitida para ' + classDef.name + '.' });
        }
      }
    }

    // Verificar que no repitan las del trasfondo
    if (bgDef) {
      for (const s of classSkills) {
        if (bgDef.skills.includes(s)) {
          errors.push({ step: 5, field: 'classSkills', message: 'La habilidad ' + s + ' ya la proporciona tu trasfondo y no debe repetirse.' });
        }
      }
    }

    // Humano: habilidad extra
    if (char.speciesId === 'humano') {
      if (!char.humanBonusSkill) {
        errors.push({ step: 5, field: 'humanBonusSkill', message: 'Como humano, debes elegir 1 habilidad adicional.' });
      }
      if (!char.humanBonusOriginFeat) {
        errors.push({ step: 5, field: 'humanBonusOriginFeat', message: 'Como humano (rasgo Versátil), debes elegir 1 dote de origen adicional.' });
      }
    }

    // Opciones específicas de nivel 1
    if (classDef.weaponMasteryCount > 0) {
      const masteries = char.weaponMasteries || [];
      if (masteries.length !== classDef.weaponMasteryCount) {
        errors.push({ step: 5, field: 'weaponMasteries', message: 'Debes seleccionar exactamente ' + classDef.weaponMasteryCount + ' armas para Maestría con armas.' });
      }
    }

    if (classDef.id === 'guerrero' && !char.fightingStyle) {
      errors.push({ step: 5, field: 'fightingStyle', message: 'Debes seleccionar un Estilo de combate para el Guerrero.' });
    }

    if (classDef.id === 'clerigo' && !char.holyOrder) {
      errors.push({ step: 5, field: 'holyOrder', message: 'Debes elegir tu Orden sagrada (Protector o Taumaturgo).' });
    }

    if (classDef.id === 'druida' && !char.primalOrder) {
      errors.push({ step: 5, field: 'primalOrder', message: 'Debes elegir tu Orden primigenia (Magisterio o Guardián).' });
    }

    if (classDef.id === 'brujo' && !char.eldritchInvocation) {
      errors.push({ step: 5, field: 'eldritchInvocation', message: 'Debes seleccionar tu Invocación sobrenatural de nivel 1.' });
    }

    if (classDef.id === 'picaro') {
      const exp = char.expertise || [];
      if (exp.length !== 2) {
        errors.push({ step: 5, field: 'expertise', message: 'Debes seleccionar 2 habilidades o herramientas para Experiencia.' });
      }
    }

    // 8. Conjuros
    if (classDef.spellcasting) {
      const cantrips = char.cantrips || [];
      let requiredCantrips = classDef.spellcasting.cantripsKnown || 0;
      if (classDef.id === 'clerigo' && char.holyOrder === 'taumaturgo') requiredCantrips += 1;
      if (classDef.id === 'druida' && char.primalOrder === 'magisterio') requiredCantrips += 1;

      if (cantrips.length !== requiredCantrips) {
        errors.push({ step: 6, field: 'cantrips', message: 'Debes seleccionar exactamente ' + requiredCantrips + ' trucos.' });
      }

      if (classDef.id === 'mago') {
        const spellbook = char.spellbook || [];
        if (spellbook.length !== 6) {
          errors.push({ step: 6, field: 'spellbook', message: 'Debes seleccionar 6 conjuros de nivel 1 para el Libro de conjuros del mago.' });
        }
        const prepared = char.preparedSpells || [];
        if (prepared.length !== 4) {
          errors.push({ step: 6, field: 'preparedSpells', message: 'Debes seleccionar 4 conjuros preparados de tu Libro de conjuros.' });
        }
      } else if (classDef.spellcasting.preparedSpellsCount > 0) {
        const prepared = char.preparedSpells || [];
        const req = classDef.spellcasting.preparedSpellsCount;
        if (prepared.length !== req) {
          errors.push({ step: 6, field: 'preparedSpells', message: 'Debes seleccionar exactamente ' + req + ' conjuros preparados de nivel 1.' });
        }
      }
    }
  }

  // 9. Equipo
  if (!char.classEquipmentChoice) {
    errors.push({ step: 7, field: 'classEquipmentChoice', message: 'Debes elegir una opción de equipo de clase (A, B o C).' });
  }
  if (!char.backgroundEquipmentChoice) {
    errors.push({ step: 7, field: 'backgroundEquipmentChoice', message: 'Debes elegir una opción de equipo de trasfondo (A o B).' });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
