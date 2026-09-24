/**
 * Estado Reactivo del Creador de Personajes
 */

export const state = {
  // Datos estáticos
  catalogs: {
    classes: [],
    subclasses: [],
    species: [],
    backgrounds: [],
    feats: [],
    spells: [],
    equipment: [],
    rules: {}
  },
  
  dmCatalogs: {
    monsters: []
  },

  dmSession: {
    activeMonsters: []
  },

  activeView: 'welcome', // 'welcome' | 'characters_list' | 'sheet' | 'creator' | 'dm_module'
  activeCharacterId: null,
  activeCharacter: null,
  currentStep: 1,
  savedCharacters: [],

  draft: {
    name: '',
    level: 1,
    xp: 0,
    alignment: 'LB',
    gender: '',
    appearance: '',
    personalityNotes: '',
    
    // Clase
    classId: null,
    subclassId: null,
    
    // Origen
    speciesId: null,
    speciesLineageId: null,
    size: null,
    backgroundId: null,
    languages: ['comun'],
    
    // Características
    abilityGenerationMethod: 'standard_array',
    baseAbilityScores: {
      fuerza: 0,
      destreza: 0,
      constitucion: 0,
      inteligencia: 0,
      sabiduria: 0,
      carisma: 0
    },
    backgroundAbilityBonus: {},
    
    // Competencias y Opciones de Clase
    classSkills: [],
    humanBonusSkill: null,
    humanBonusOriginFeat: null,
    weaponMasteries: [],
    fightingStyle: null,
    holyOrder: null,
    primalOrder: null,
    eldritchInvocation: null,
    expertise: [],
    monkTool: null,
    bardoInstruments: [],
    
    // Magia
    cantrips: [],
    preparedSpells: [],
    spellbook: [],
    
    // Equipo
    classEquipmentChoice: 'A',
    backgroundEquipmentChoice: 'A',
    trinket: ''
  },

  listeners: [],

  subscribe(listener) {
    this.listeners.push(listener);
  },

  notify(options = { renderStep: true }) {
    for (const l of this.listeners) {
      l(this, options);
    }
  },

  updateDraft(updates, options = { renderStep: true }) {
    Object.assign(this.draft, updates);
    this.notify(options);
  },

  setStep(step) {
    this.currentStep = Math.max(1, Math.min(8, step));
    this.notify();
  },

  setView(view, charId = null) {
    this.activeView = view;
    this.activeCharacterId = charId;
    if (charId) {
      this.activeCharacter = this.savedCharacters.find(c => c.id === charId) || null;
    } else {
      this.activeCharacter = null;
    }
    
    // Guardar en sessionStorage para que no saque al usuario al dar F5
    sessionStorage.setItem('lastActiveView', view);
    if (charId) sessionStorage.setItem('lastActiveCharId', charId);
    else sessionStorage.removeItem('lastActiveCharId');
    if (this.activeCampaignId) sessionStorage.setItem('lastActiveCampaignId', this.activeCampaignId);
    
    this.notify();
  },

  resetDraft() {
    this.draft = {
      name: '',
      level: 1,
      xp: 0,
      alignment: 'LB',
      gender: '',
      appearance: '',
      personalityNotes: '',
      classId: null,
      subclassId: null,
      speciesId: null,
      speciesLineageId: null,
      size: null,
      backgroundId: null,
      languages: ['comun'],
      abilityGenerationMethod: 'standard_array',
      baseAbilityScores: {
        fuerza: 0,
        destreza: 0,
        constitucion: 0,
        inteligencia: 0,
        sabiduria: 0,
        carisma: 0
      },
      backgroundAbilityBonus: {},
      classSkills: [],
      humanBonusSkill: null,
      humanBonusOriginFeat: null,
      weaponMasteries: [],
      fightingStyle: null,
      holyOrder: null,
      primalOrder: null,
      eldritchInvocation: null,
      expertise: [],
      monkTool: null,
      bardoInstruments: [],
      cantrips: [],
      preparedSpells: [],
      spellbook: [],
      classEquipmentChoice: 'A',
      backgroundEquipmentChoice: 'A',
      trinket: ''
    };
    this.currentStep = 1;
    this.notify();
  }
};
