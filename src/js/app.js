import { state } from './state.js';
import { authUI } from './authUI.js';
import './campaignUI.js';
import { supabase } from '../../src/lib/supabaseClient.js';

export async function apiFetch(url, options = {}) {
  const method = options.method || 'GET';
  let body = null;
  if (options.body && typeof options.body === 'string') {
    body = JSON.parse(options.body);
  }

  // --- INTERCEPTOR DE API A SUPABASE ---
  // Reemplazamos el backend Express por consultas directas a Supabase (BaaS)

  // 1. Catálogos estáticos (Reemplazan Express res.json(archivos))
  if (url === '/api/data') {
    const [species, classes, subclasses, backgrounds, feats, spells, equipment, rules] = await Promise.all([
      fetch('/data/species.json').then(r=>r.json()).catch(()=>([])),
      fetch('/data/classes.json').then(r=>r.json()).catch(()=>([])),
      fetch('/data/subclasses.json').then(r=>r.json()).catch(()=>([])),
      fetch('/data/backgrounds.json').then(r=>r.json()).catch(()=>([])),
      fetch('/data/feats.json').then(r=>r.json()).catch(()=>([])),
      fetch('/data/spells.json').then(r=>r.json()).catch(()=>([])),
      fetch('/data/equipment.json').then(r=>r.json()).catch(()=>([])),
      fetch('/data/rules.json').then(r=>r.json()).catch(()=>({}))
    ]);
    return { ok: true, json: async () => ({ species, classes, subclasses, backgrounds, feats, spells, equipment, rules }) };
  }
  if (url === '/api/dm-data') {
    const monsters = await fetch('/data/monsters.json').then(r=>r.json()).catch(()=>([]));
    return { ok: true, json: async () => ({ monsters }) };
  }
  if (url === '/api/dm-session') {
    return { ok: true, json: async () => ({ activeMonsters: [] }) };
  }

  // 2. Personajes
  if (url === '/api/characters') {
    if (method === 'GET') {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return { ok: true, json: async () => [] };
      const { data, error } = await supabase.from('characters').select('*').eq('user_id', authData.user.id);
      if (error) return { ok: false, json: async () => ({ success: false, error: error.message }) };
      return { ok: true, json: async () => data.map(d => typeof d.data === 'string' ? JSON.parse(d.data) : d.data) };
    }
    if (method === 'POST') {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return { ok: false, json: async () => ({ success: false, error: 'No autorizado' }) };
      
      const newChar = { ...body };
      if (!newChar.id) newChar.id = 'char_' + Date.now().toString(36);
      
      const { error } = await supabase.from('characters').insert({
        id: newChar.id, 
        user_id: authData.user.id, 
        name: newChar.name || 'Sin Nombre', 
        data: newChar
      });
      return { ok: !error, json: async () => ({ success: !error, character: newChar }) };
    }
  }

  const charMatch = url.match(/^\/api\/characters\/([^\/]+)$/);
  if (charMatch) {
    const charId = charMatch[1];
    if (method === 'PUT') {
      const { data: origData } = await supabase.from('characters').select('*').eq('id', charId).single();
      if (origData) {
        const oldJson = typeof origData.data === 'string' ? JSON.parse(origData.data) : origData.data;
        const updatedChar = { ...oldJson, ...body };
        const { error } = await supabase.from('characters').update({
          name: updatedChar.name || 'Sin Nombre',
          data: updatedChar,
          updated_at: new Date().toISOString()
        }).eq('id', charId);
        
        // --- Fase 4: Supabase Realtime Broadcast ---
        if (!error && window.campaignChannel) {
          window.campaignChannel.send({
            type: 'broadcast',
            event: 'character_hp_updated',
            payload: { campaignId: window.activeCampaignId, characterId: charId }
          }).catch(console.error);
        }
        
        return { ok: !error, json: async () => ({ success: !error }) };
      }
      return { ok: false, json: async () => ({ success: false }) };
    }
    if (method === 'DELETE') {
      const { error } = await supabase.from('characters').delete().eq('id', charId);
      return { ok: !error, json: async () => ({ success: !error }) };
    }
  }

  const dupMatch = url.match(/^\/api\/characters\/([^\/]+)\/duplicate$/);
  if (dupMatch && method === 'POST') {
    const origId = dupMatch[1];
    const { data: orig } = await supabase.from('characters').select('*').eq('id', origId).single();
    if (orig) {
      const newId = 'char_' + Date.now().toString(36);
      const { data: authData } = await supabase.auth.getUser();
      
      const clone = typeof orig.data === 'string' ? JSON.parse(orig.data) : orig.data;
      clone.id = newId;
      clone.name = `${clone.name} (Copia)`;
      
      const { error } = await supabase.from('characters').insert({
        id: newId, 
        user_id: authData.user?.id, 
        name: clone.name, 
        data: clone
      });
      return { ok: !error, json: async () => ({ success: !error, character: clone }) };
    }
    return { ok: false, json: async () => ({ success: false }) };
  }

  // 2. Campañas
  if (url === '/api/campaigns') {
    if (method === 'GET') {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return { ok: true, json: async () => ({ success: true, campaigns: [] }) };
      
      // Obtener campañas donde soy DM
      const { data: dmCamps } = await supabase.from('campaigns').select('*, users!campaigns_dm_id_fkey(username)').eq('dm_id', authData.user.id);
      
      // Obtener campañas donde soy jugador
      const { data: playerCampsData } = await supabase.from('campaign_players').select('campaign_id').eq('user_id', authData.user.id);
      let playerCamps = [];
      if (playerCampsData && playerCampsData.length > 0) {
        const campIds = playerCampsData.map(c => c.campaign_id);
        const { data } = await supabase.from('campaigns').select('*, users!campaigns_dm_id_fkey(username)').in('id', campIds);
        playerCamps = data || [];
      }
      
      const allCampsMap = new Map();
      (dmCamps || []).forEach(c => allCampsMap.set(c.id, {
        id: c.id, name: c.name, invite_code: c.invite_code, is_dm: 1, dm_name: c.users?.username || 'DM'
      }));
      (playerCamps || []).forEach(c => {
        if (!allCampsMap.has(c.id)) {
          allCampsMap.set(c.id, {
            id: c.id, name: c.name, invite_code: c.invite_code, is_dm: 0, dm_name: c.users?.username || 'DM'
          });
        }
      });
      
      return { ok: true, json: async () => ({ success: true, campaigns: Array.from(allCampsMap.values()) }) };
    }
    if (method === 'POST') {
      const id = 'camp_' + Date.now().toString(36);
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: authData } = await supabase.auth.getUser();
      const { error } = await supabase.from('campaigns').insert({
        id, name: body.name, dm_id: authData.user.id, invite_code: inviteCode
      });
      if (error) return { ok: false, json: async () => ({ success: false, error: error.message }) };
      return { ok: true, json: async () => ({ success: true, campaign: { id, name: body.name, inviteCode } }) };
    }
  }

  if (url === '/api/campaigns/join' && method === 'POST') {
    const invite = body.code || body.inviteCode;
    const { data: camp } = await supabase.from('campaigns').select('id').eq('invite_code', invite).single();
    if (camp) {
      const { data: authData } = await supabase.auth.getUser();
      const { error } = await supabase.from('campaign_players').insert({
        campaign_id: camp.id, user_id: authData.user.id
      });
      if (!error || error.code === '23505') { // 23505 = already exists
         return { ok: true, json: async () => ({ success: true }) };
      }
    }
    return { ok: false, json: async () => ({ success: false, error: 'Código inválido' }) };
  }

  const campPlayersMatch = url.match(/^\/api\/campaigns\/([^\/]+)\/players$/);

  // Borrar campaña (Solo DM)
  const deleteCampMatch = url.match(/^\/api\/campaigns\/([^\/]+)$/);
  if (deleteCampMatch && method === 'DELETE') {
    const campaignId = deleteCampMatch[1];
    const { data: authData } = await supabase.auth.getUser();
    
    const { data: camp } = await supabase.from('campaigns').select('dm_id').eq('id', campaignId).single();
    if (camp && camp.dm_id === authData.user.id) {
      const { error: err1 } = await supabase.from('campaign_players').delete().eq('campaign_id', campaignId);
      const { error: err2 } = await supabase.from('campaigns').delete().eq('id', campaignId);
      if (err1 || err2) return { ok: false, json: async () => ({ success: false, error: err1 || err2 }) };
    }
    return { ok: true, json: async () => ({ success: true }) };
  }

  // Abandonar campaña (Jugador)
  const leaveCampMatch = url.match(/^\/api\/campaigns\/([^\/]+)\/leave$/);
  if (leaveCampMatch && method === 'DELETE') {
    const campaignId = leaveCampMatch[1];
    const { data: authData } = await supabase.auth.getUser();
    
    const { error } = await supabase.from('campaign_players').delete().eq('campaign_id', campaignId).eq('user_id', authData.user.id);
    if (error) return { ok: false, json: async () => ({ success: false, error }) };
    return { ok: true, json: async () => ({ success: true }) };
  }
  if (campPlayersMatch && method === 'GET') {
    const campId = campPlayersMatch[1];
    const { data } = await supabase.from('campaign_players')
      .select('user_id, character_id, users(username), characters(name, data)')
      .eq('campaign_id', campId);
    
    const players = (data || []).map(p => ({
      userId: p.user_id,
      username: p.users?.username || 'Desconocido',
      characterId: p.character_id,
      characterName: p.characters?.name || null,
      character: p.characters?.data ? (typeof p.characters.data === 'string' ? JSON.parse(p.characters.data) : p.characters.data) : null
    }));
    return { ok: true, json: async () => ({ success: true, players }) };
  }

  const campCharMatch = url.match(/^\/api\/campaigns\/([^\/]+)\/character$/);
  if (campCharMatch && method === 'POST') {
    const campId = campCharMatch[1];
    const { data: authData } = await supabase.auth.getUser();
    const { error } = await supabase.from('campaign_players').update({
      character_id: body.characterId
    }).match({ campaign_id: campId, user_id: authData.user.id });
    return { ok: !error, json: async () => ({ success: !error }) };
  }

  // --- FIN DEL INTERCEPTOR ---

  // Peticiones locales (DM Data, manuales, etc)
  const headers = options.headers || {};
  if (authUI.token) headers['Authorization'] = `Bearer ${authUI.token}`;
  if (body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  
  return fetch(url, { cache: 'no-store', ...options, headers });
}
import DOMPurify from 'dompurify';
import { renderApp, renderSavedCharactersModal } from './renderers.js';
import * as Rules from '/src/engine/rulesEngine.js';
import { validateCharacter } from '/src/engine/validator.js';
import { diceEngine } from './diceEngine.js';
import { exportCharacterToPDF } from './pdfExport.js';
import { filterMonsters, filterMonstersCR, showMonsterSheet, addMonsterToSession, removeMonsterFromSession, renderPreparationView, showMonsterAbility, duplicateMonsterInSession, showMonsterLoot } from './dmView.js';
import { setActiveTab, setSpellSubTab, setSpellLevelFilter, setSpellSearchFilter, renderCoinSvg } from './characterSheetView.js';
import { getAllCatalogItems, getSpellDetail } from './infoHelper.js';
import { showPrompt, showConfirm, showAlert } from './dialogModal.js';

const POINT_BUY_COSTS = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9
};

let addItemModalState = {
  charId: null,
  activeTab: 'catalog',
  categoryFilter: 'all',
  searchQuery: '',
  selectedItemId: null,
  quantity: 1,
  equipImmediately: false
};

const app = {
  escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return DOMPurify.sanitize(str, { ALLOWED_TAGS: [] });
  },
  async init() {
    try {
      authUI.init();
      // Mostrar estado de carga
      const content = document.getElementById('step-content');
      if (content) {
        content.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--gold);">Cargando catálogo oficial D&D 2024...</div>';
      }

      // Cargar catálogos y personajes guardados en paralelo
      const [catalogsRes, charactersRes, dmDataRes, dmSessionRes] = await Promise.all([
        apiFetch('/api/data'),
        apiFetch('/api/characters'),
        apiFetch('/api/dm-data'),
        apiFetch('/api/dm-session')
      ]);

      if (!catalogsRes.ok) throw new Error('Error al cargar catálogo de reglas');
      if (!charactersRes.ok) throw new Error('Error al cargar personajes guardados');

      state.catalogs = await catalogsRes.json();
      state.savedCharacters = await charactersRes.json();
      state.dmCatalogs = await dmDataRes.json();
      state.dmSession = await dmSessionRes.json();

      // Suscribir render general
      state.subscribe((currentState, options) => {
        renderApp(options);
      });

      // Sobrescribir window.alert para que cualquier llamada use el diálogo emergente con estilo D&D 2024
      window.alert = (msg) => {
        this.showAlert({ message: String(msg) });
      };

      // Restaurar estado de sessionStorage si existe
      const lastView = sessionStorage.getItem('lastActiveView');
      const lastCharId = sessionStorage.getItem('lastActiveCharId');
      const lastCampaignId = sessionStorage.getItem('lastActiveCampaignId');
      
      if (lastCampaignId) {
        state.activeCampaignId = lastCampaignId;
      }
      
      if (lastView && lastView !== 'welcome') {
        state.setView(lastView, lastCharId); // Esto disparará notify() y renderApp()
      } else {
        // Primer render por defecto
        renderApp();
      }
    } catch (err) {
      console.error('Error inicializando la aplicación:', err);
      const content = document.getElementById('step-content');
      if (content) {
        content.innerHTML = `<div class="alert-box alert-error">Error al iniciar la aplicación: ${err.message}</div>`;
      }
    }
  },

  showPrompt(options) {
    return showPrompt(options);
  },

  showConfirm(options) {
    return showConfirm(options);
  },

  showAlert(options) {
    return showAlert(options);
  },

  goToStep(stepNum) {
    state.setStep(stepNum);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  async reloadUserData() {
    try {
      const charactersRes = await apiFetch('/api/characters');
      if (charactersRes.ok) {
        state.savedCharacters = await charactersRes.json();
      }
      
      const dmSessionRes = await apiFetch('/api/dm-session');
      if (dmSessionRes.ok) {
        state.dmSession = await dmSessionRes.json();
      }
      
      // Force re-render of current view
      state.setView(state.activeView);
    } catch(e) {
      console.error('Error reloading user data', e);
    }
  },

  updateDraftField(field, value) {
    const updates = { [field]: value };
    const textFields = ['name', 'gender', 'appearance', 'personalityNotes'];
    const isTextField = textFields.includes(field);

    if (field === 'level') {
      const lvl = parseInt(value) || 1;
      updates.level = Math.max(1, Math.min(20, lvl));
      if (updates.level < 3) {
        updates.subclassId = null;
      }
    }

    if (isTextField) {
      state.updateDraft(updates, { renderStep: false });
    } else {
      state.updateDraft(updates, { renderStep: true });
    }
  },

  selectClass(classId) {
    const classDef = state.catalogs.classes.find(c => c.id === classId);
    if (!classDef) return;

    state.updateDraft({
      classId,
      subclassId: null,
      classSkills: [],
      weaponMasteries: [],
      fightingStyle: null,
      holyOrder: null,
      primalOrder: null,
      eldritchInvocation: null,
      expertise: [],
      cantrips: [],
      preparedSpells: [],
      spellbook: [],
      classEquipmentChoice: 'A'
    });
  },

  selectSpecies(speciesId) {
    const speciesDef = state.catalogs.species.find(s => s.id === speciesId);
    if (!speciesDef) return;

    const updates = {
      speciesId,
      speciesLineageId: null,
      size: speciesDef.defaultSize || speciesDef.sizeOptions[0] || 'Mediano'
    };

    if (speciesId !== 'humano') {
      updates.humanBonusSkill = null;
      updates.humanBonusOriginFeat = null;
    }

    state.updateDraft(updates);
  },

  selectBackground(backgroundId) {
    const bgDef = state.catalogs.backgrounds.find(b => b.id === backgroundId);
    if (!bgDef) return;

    // Filtrar habilidades de clase que ahora choquen con el trasfondo
    const filteredClassSkills = state.draft.classSkills.filter(s => !bgDef.skills.includes(s));

    state.updateDraft({
      backgroundId,
      backgroundAbilityBonus: {},
      classSkills: filteredClassSkills,
      backgroundEquipmentChoice: 'A'
    });
  },

  toggleLanguage(langId, checked) {
    if (langId === 'comun') return; // Inmutable
    let langs = [...state.draft.languages];
    if (checked) {
      if (!langs.includes(langId)) langs.push(langId);
    } else {
      langs = langs.filter(l => l !== langId);
    }
    state.updateDraft({ languages: langs });
  },

  setGenerationMethod(method) {
    const updates = { abilityGenerationMethod: method };
    if (method === 'standard_array') {
      updates.baseAbilityScores = {
        fuerza: 0,
        destreza: 0,
        constitucion: 0,
        inteligencia: 0,
        sabiduria: 0,
        carisma: 0
      };
    } else if (method === 'point_buy') {
      updates.baseAbilityScores = {
        fuerza: 8,
        destreza: 8,
        constitucion: 8,
        inteligencia: 8,
        sabiduria: 8,
        carisma: 8
      };
    }
    state.updateDraft(updates);
  },

  updateBaseScore(ability, score) {
    const num = Number(score);
    const val = (num === 0) ? 0 : Math.max(3, Math.min(18, num || 0));
    const scores = { ...state.draft.baseAbilityScores, [ability]: val };
    state.updateDraft({ baseAbilityScores: scores });
  },

  adjustPointBuy(ability, delta) {
    const currentScore = state.draft.baseAbilityScores[ability] || 8;
    const targetScore = currentScore + delta;

    if (targetScore < 8 || targetScore > 15) return;

    // Calcular costo actual y nuevo
    let currentTotalPoints = 0;
    const abilities = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'sabiduria', 'carisma'];
    for (const ab of abilities) {
      const s = ab === ability ? targetScore : (state.draft.baseAbilityScores[ab] || 8);
      currentTotalPoints += (POINT_BUY_COSTS[s] || 0);
    }

    if (currentTotalPoints <= 27) {
      const scores = { ...state.draft.baseAbilityScores, [ability]: targetScore };
      state.updateDraft({ baseAbilityScores: scores });
    }
  },

  rollRandomScores() {
    const abilities = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'sabiduria', 'carisma'];
    const newScores = {};

    for (const ab of abilities) {
      // 4d6 descartar el menor
      const rolls = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
      ];
      rolls.sort((a, b) => a - b);
      const total = rolls[1] + rolls[2] + rolls[3];
      newScores[ab] = total;
    }

    state.updateDraft({ baseAbilityScores: newScores });
  },

  setBackgroundBonus(ability, bonus) {
    const bonuses = { ...state.draft.backgroundAbilityBonus, [ability]: Number(bonus) || 0 };
    state.updateDraft({ backgroundAbilityBonus: bonuses });
  },

  toggleClassSkill(skillId, checked) {
    let skills = [...state.draft.classSkills];
    if (checked) {
      if (!skills.includes(skillId)) skills.push(skillId);
    } else {
      skills = skills.filter(s => s !== skillId);
    }
    state.updateDraft({ classSkills: skills });
  },

  toggleWeaponMastery(weaponId, checked) {
    let masteries = [...state.draft.weaponMasteries];
    if (checked) {
      if (!masteries.includes(weaponId)) masteries.push(weaponId);
    } else {
      masteries = masteries.filter(w => w !== weaponId);
    }
    state.updateDraft({ weaponMasteries: masteries });
  },

  toggleExpertise(itemId, checked) {
    let exp = [...state.draft.expertise];
    if (checked) {
      if (!exp.includes(itemId)) exp.push(itemId);
    } else {
      exp = exp.filter(i => i !== itemId);
    }
    state.updateDraft({ expertise: exp });
  },

  toggleSpell(category, spellName, checked) {
    let list = [...(state.draft[category] || [])];
    if (checked) {
      if (!list.includes(spellName)) list.push(spellName);
    } else {
      list = list.filter(s => s !== spellName);
    }

    const updates = { [category]: list };
    // Si quitamos de spellbook, también quitar de preparados
    if (category === 'spellbook' && !checked) {
      updates.preparedSpells = state.draft.preparedSpells.filter(s => s !== spellName);
    }

    state.updateDraft(updates);
  },

  rollRandomTrinket() {
    const trinkets = state.catalogs.equipment.trinkets;
    if (!trinkets || trinkets.length === 0) return;
    const randomIndex = Math.floor(Math.random() * trinkets.length);
    state.updateDraft({ trinket: trinkets[randomIndex] });
  },

  toggleOptionDetail(id) {
    const el = document.getElementById(id);
    if (!el) return;
    
    let title = "Información";
    const btn = document.querySelector(`[data-target="${id}"]`);
    if (btn) {
      const card = btn.closest('.selection-card') || btn.closest('.creator-option-row') || btn.closest('.card-traits') || btn.closest('.inventory-card');
      if (card) {
        const titleEl = card.querySelector('.card-title') || card.querySelector('.trait-title') || card.querySelector('strong');
        if (titleEl) {
          title = titleEl.innerText || titleEl.textContent;
          // Clean up any trailing colons or badges
          title = title.replace(/:\s*$/, '').trim();
        }
      }
    }

    const htmlContent = el.innerHTML;
    
    this.showAlert({
      title: title,
      messageHtml: htmlContent,
      icon: 'ℹ️'
    });
  },

  async showSpellInfoModal(spellName) {
    const detail = getSpellDetail(spellName, state.catalogs.spellsDatabase);
    if (!detail) {
      await this.showAlert({
        title: spellName,
        message: 'No hay detalles disponibles para este hechizo.',
        icon: 'ℹ️'
      });
      return;
    }

    const html = `
      <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 1rem;">
        <span style="color: var(--text-muted); font-size: 0.9rem;">${detail.typeLine}</span>
      </div>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
        <span style="background: rgba(255,255,255,0.05); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">⏱️ ${detail.castingTime}</span>
        <span style="background: rgba(255,255,255,0.05); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">🎯 ${detail.range}</span>
        <span style="background: rgba(255,255,255,0.05); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">🗣️ ${detail.components}</span>
        <span style="background: rgba(255,255,255,0.05); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">⏳ ${detail.duration}</span>
      </div>
      <div style="font-size: 0.95rem; line-height: 1.5; color: var(--text-color);">
        ${detail.desc || detail.description || 'Sin descripción.'}
      </div>
    `;

    await this.showAlert({
      title: detail.name,
      icon: '✨',
      type: 'info',
      messageHtml: html
    });
  },

  async finalizeCharacter() {
    const validation = validateCharacter(state.draft, state.catalogs);
    if (!validation.valid) {
      await this.showAlert({
        title: 'Faltan Pasos por Completar',
        icon: '⚠️',
        type: 'warning',
        messageHtml: `
          <p>No puedes crear el personaje todavía. Por favor revisa los siguientes requisitos:</p>
          <ul class="dialog-benefits-list">
            ${validation.errors.map(e => `<li>⚠️ ${e.message}</li>`).join('')}
          </ul>
        `
      });
      if (validation.errors[0]) {
        this.goToStep(validation.errors[0].step);
      }
      return;
    }

    const classDef = state.catalogs.classes.find(c => c.id === state.draft.classId);
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

    const maxHp = Rules.calculateHitPoints({
      classDef,
      conMod,
      level: state.draft.level,
      speciesDef,
      featIds
    });
    const init = Rules.calculateInitiative(dexMod, featIds, pb);
    const ac = Rules.calculateArmorClass({
      classDef,
      dexMod,
      conMod,
      wisMod,
      fightingStyle: state.draft.fightingStyle
    });

    const isPerceptionProf = (bgDef && bgDef.skills.includes('percepcion')) ||
      state.draft.classSkills.includes('percepcion') ||
      (speciesDef && speciesDef.fixedSkills && speciesDef.fixedSkills.includes('percepcion')) ||
      state.draft.humanBonusSkill === 'percepcion';
    const hasPerceptionExp = state.draft.expertise && state.draft.expertise.includes('percepcion');
    const passivePerc = Rules.calculatePassivePerception(wisMod, isPerceptionProf, hasPerceptionExp, pb);

    const spellStats = Rules.calculateSpellcastingStats(classDef, abs, pb);

    const startingCurrencies = Rules.calculateStartingCurrencies({ char: state.draft, catalogs: state.catalogs });

    const newChar = {
      ...state.draft,
      speciesName: speciesDef ? speciesDef.name : '',
      className: classDef ? classDef.name : '',
      backgroundName: bgDef ? bgDef.name : '',
      gold: startingCurrencies.gold,
      silver: startingCurrencies.silver,
      copper: startingCurrencies.copper,
      calculatedStats: {
        ac,
        maxHp,
        currentHp: maxHp,
        initiative: init,
        passivePerception: passivePerc,
        proficiencyBonus: pb,
        abilities: abs,
        spellcasting: spellStats
      }
    };

    try {
      const response = await apiFetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChar)
      });

      if (!response.ok) {
        throw new Error('Error al guardar el personaje en el servidor.');
      }

      const result = await response.json();
      state.savedCharacters.push(result.character);
      await this.showAlert({
        title: '¡Héroe Forjado!',
        icon: '✨',
        type: 'success',
        message: `¡Felicidades! ${newChar.name} ha sido creado y guardado exitosamente según las reglas oficiales de D&D 2024.`
      });
      this.openCharacterSheet(result.character.id);
    } catch (err) {
      console.error('Error guardando personaje:', err);
      await this.showAlert({
        title: 'Error al Guardar',
        icon: '❌',
        type: 'danger',
        message: 'Hubo un problema al guardar el personaje: ' + err.message
      });
    }
  },

  // -----------------------------------------------------------
  // NAVEGACIÓN PRINCIPAL ENTRE PANTALLAS
  // -----------------------------------------------------------

  openWelcomeScreen() {
    state.setView('welcome');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  openCharactersList() {
    state.setView('characters_list');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  openCharacterSheet(charId) {
    state.setView('sheet', charId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  startNewCharacter() {
    state.resetDraft();
    state.setView('creator');
    this.closeModal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  openDMModule() {
    state.setView('dm_module');
    this.closeModal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  openMonstersCatalog() {
    state.setView('dm_monsters');
    this.closeModal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  openPreparationView() {
    state.setView('dm_preparation');
    this.closeModal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  renderPreparation(tab) {
    const stepContent = document.getElementById('step-content') || document.querySelector('.main-layout');
    renderPreparationView(stepContent, tab);
  },

  removeMonsterFromSession(sessionId) {
    removeMonsterFromSession(sessionId);
  },

  filterMonsters(query) { filterMonsters(query); },
  filterMonstersCR(cr) { filterMonstersCR(cr); },
  showMonsterSheet(id) { showMonsterSheet(id); },
  showMonsterAbility(name, desc) { showMonsterAbility(name, desc); },
  addMonsterToSession(id) { addMonsterToSession(id); },
  duplicateMonsterInSession(sessionId) { duplicateMonsterInSession(sessionId); },
  showMonsterLoot(id) { showMonsterLoot(id); },

  editCharacterInCreator(charId) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    // Cargar datos en el borrador
    state.updateDraft({
      name: char.name || '',
      level: char.level || 1,
      xp: char.xp || 0,
      alignment: char.alignment || 'LB',
      gender: char.gender || '',
      appearance: char.appearance || '',
      personalityNotes: char.personalityNotes || '',
      classId: char.classId || null,
      subclassId: char.subclassId || null,
      speciesId: char.speciesId || null,
      speciesLineageId: char.speciesLineageId || null,
      size: char.size || 'Mediano',
      backgroundId: char.backgroundId || null,
      languages: char.languages || ['comun'],
      abilityGenerationMethod: char.abilityGenerationMethod || 'standard_array',
      baseAbilityScores: char.baseAbilityScores || { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, sabiduria: 10, carisma: 10 },
      backgroundAbilityBonus: char.backgroundAbilityBonus || {},
      classSkills: char.classSkills || [],
      humanBonusSkill: char.humanBonusSkill || null,
      humanBonusOriginFeat: char.humanBonusOriginFeat || null,
      weaponMasteries: char.weaponMasteries || [],
      fightingStyle: char.fightingStyle || null,
      holyOrder: char.holyOrder || null,
      primalOrder: char.primalOrder || null,
      eldritchInvocation: char.eldritchInvocation || null,
      expertise: char.expertise || [],
      cantrips: char.cantrips || [],
      preparedSpells: char.preparedSpells || [],
      spellbook: char.spellbook || [],
      classEquipmentChoice: char.classEquipmentChoice || 'A',
      backgroundEquipmentChoice: char.backgroundEquipmentChoice || 'A',
      trinket: char.trinket || ''
    });

    state.currentStep = 1;
    state.setView('creator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  async duplicateCharacter(charId) {
    try {
      const response = await apiFetch(`/api/characters/${charId}/duplicate`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Error en el servidor al duplicar el personaje');

      const result = await response.json();
      state.savedCharacters.unshift(result.character);
      renderApp();
      await this.showAlert({
        title: 'Personaje Duplicado',
        icon: '📋',
        type: 'success',
        message: `Personaje duplicado con éxito: "${result.character.name}"`
      });
    } catch (err) {
      console.error('Error al duplicar:', err);
      await this.showAlert({
        title: 'Error al Duplicar',
        icon: '❌',
        type: 'danger',
        message: 'No se pudo duplicar el personaje: ' + err.message
      });
    }
  },

  async deleteCharacter(charId) {
    const char = state.savedCharacters.find(c => c.id === charId);
    const charName = char ? char.name : 'este personaje';

    const confirmed = await this.showConfirm({
      title: '🗑️ Eliminar Personaje',
      messageHtml: `<p>¿Estás seguro de que deseas eliminar a <strong>${charName}</strong>?</p><p style="color: #f87171; font-size: 0.85rem; margin-top: 0.5rem;">⚠️ Esta acción es permanente y no se puede deshacer.</p>`,
      icon: '🗑️',
      confirmText: '🗑️ Eliminar Definitivamente',
      cancelText: 'Cancelar',
      isDanger: true
    });

    if (!confirmed) return;

    try {
      const response = await apiFetch(`/api/characters/${charId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Error al eliminar personaje en el servidor.');
      }

      state.savedCharacters = state.savedCharacters.filter(c => c.id !== charId);
      if (state.activeCharacterId === charId) {
        state.setView('characters_list');
      } else {
        renderApp();
      }

      await this.showAlert({
        title: 'Personaje Eliminado',
        icon: '🗑️',
        type: 'info',
        message: `El personaje "${charName}" ha sido eliminado exitosamente.`
      });
    } catch (err) {
      console.error('Error eliminando personaje:', err);
      await this.showAlert({
        title: 'Error al Eliminar',
        icon: '❌',
        type: 'danger',
        message: 'No se pudo eliminar el personaje: ' + err.message
      });
    }
  },

  exportCharacterPDF(charId) {
    exportCharacterToPDF(charId);
  },

  exportCharacter(charId) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(char, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${char.name.toLowerCase().replace(/\s+/g, '_')}_dnd2024.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  openSavedCharactersModal() {
    this.openCharactersList();
  },

  closeModal() {
    const container = document.getElementById('modal-container');
    if (container) container.innerHTML = '';
  },

  // -----------------------------------------------------------
  // BÚSQUEDA Y FILTROS ("MIS PERSONAJES")
  // -----------------------------------------------------------

  onSearchInput(val) {
    setSearchQuery(val);
    renderApp({ renderStep: false });
  },

  onFilterClass(val) {
    setFilterClass(val);
    renderApp({ renderStep: false });
  },

  onFilterLevel(val) {
    setFilterLevel(val);
    renderApp({ renderStep: false });
  },

  onSortBy(val) {
    setSortBy(val);
    renderApp({ renderStep: false });
  },

  // -----------------------------------------------------------
  // PESTAÑAS DE LA HOJA DE PERSONAJE
  // -----------------------------------------------------------

  switchSheetTab(tab) {
    setActiveTab(tab);
    renderApp({ renderStep: false });
  },

  setSpellSubTab(subTab) {
    setSpellSubTab(subTab);
    renderApp({ renderStep: false });
  },

  setSpellLevelFilter(level) {
    setSpellLevelFilter(level);
    renderApp({ renderStep: false });
  },

  setSpellSearchFilter(query) {
    setSpellSearchFilter(query);
    renderApp({ renderStep: false });
  },

  togglePreparedSpell(charId, spellName, isCantrip = false) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (isCantrip) {
      const cantrips = [...(char.cantrips || [])];
      const idx = cantrips.indexOf(spellName);
      if (idx >= 0) {
        cantrips.splice(idx, 1);
      } else {
        cantrips.push(spellName);
      }
      this.saveActiveCharacterUpdates(charId, { cantrips });
    } else {
      const prepared = [...(char.preparedSpells || [])];
      const idx = prepared.indexOf(spellName);
      if (idx >= 0) {
        prepared.splice(idx, 1);
      } else {
        prepared.push(spellName);
      }
      this.saveActiveCharacterUpdates(charId, { preparedSpells: prepared });
    }
  },

  selectCharacterSubclass(charId, subclassId) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (char.subclassId === subclassId) return;

    this.saveActiveCharacterUpdates(charId, { subclassId });
  },

  // -----------------------------------------------------------
  // MOTOR DE TIRADAS (DADOS)
  // -----------------------------------------------------------

  rollInitiative(initMod) {
    diceEngine.rollD20(initMod, 'Iniciativa', 'Orden de turno en combate');
    renderApp({ renderStep: false });
  },

  rollAbilityCheck(abName, mod) {
    diceEngine.rollD20(mod, `Prueba de ${abName}`, 'Característica');
    renderApp({ renderStep: false });
  },

  rollSavingThrow(saveName, mod) {
    diceEngine.rollD20(mod, `Salvación de ${saveName}`, 'Tirada de salvación');
    renderApp({ renderStep: false });
  },

  rollSkillCheck(skillName, bonus) {
    diceEngine.rollD20(bonus, `Habilidad: ${skillName}`, 'Prueba de habilidad');
    renderApp({ renderStep: false });
  },

  rollWeaponAttack(wName, atkBonus) {
    diceEngine.rollD20(atkBonus, `Ataque: ${wName}`, 'Tirada para impactar');
    renderApp({ renderStep: false });
  },

  rollWeaponDamage(wName, count, faces, mod, dmgType) {
    diceEngine.rollDamage(count, faces, mod, `Daño: ${wName}`, dmgType);
    renderApp({ renderStep: false });
  },

  rollRawDie(faces, btnEl) {
    if (btnEl) {
      btnEl.classList.add('dice-rolling-pulse');
      setTimeout(() => btnEl.classList.remove('dice-rolling-pulse'), 350);
    }
    const entry = diceEngine.roll(1, faces, 0, `d${faces}`, 'Tirada individual');

    // Actualizar dinámicamente el contador en la pestaña de Historial
    const historyTabs = document.querySelectorAll('.sheet-tab-btn[onclick*="history"]');
    historyTabs.forEach(btn => {
      btn.innerHTML = `🎲 Historial (${diceEngine.history.length})`;
    });

    // Si la pestaña de Historial está abierta actualmente, insertar la nueva tirada arriba
    const historyList = document.querySelector('.history-list');
    if (historyList) {
      const emptyMsg = historyList.querySelector('p');
      if (emptyMsg && emptyMsg.textContent.includes('Aún no se ha realizado ninguna tirada')) {
        emptyMsg.remove();
      }

      let formula = `${entry.diceCount}d${entry.diceFaces}`;
      if (entry.modifier > 0) formula += ` + ${entry.modifier}`;
      else if (entry.modifier < 0) formula += ` - ${Math.abs(entry.modifier)}`;
      const rollsStr = entry.rolls.length > 1 ? `(${entry.rolls.join(' + ')})` : `[${entry.rolls[0]}]`;

      const cardHtml = `
        <div class="history-card ${entry.isCritSuccess ? 'crit-success' : ''} ${entry.isCritFail ? 'crit-fail' : ''}">
          <div class="history-card-header">
            <span class="history-label">🎲 ${entry.label}</span>
            <span class="history-time">${entry.timestamp}</span>
          </div>
          ${entry.details ? `<div class="history-details">${entry.details}</div>` : ''}
          <div class="history-card-body">
            <span class="history-formula">${formula} = ${rollsStr}</span>
            <span class="history-result ${entry.isCritSuccess ? 'res-crit' : entry.isCritFail ? 'res-fail' : ''}">
              ${entry.total}
            </span>
          </div>
          ${entry.isCritSuccess ? '<div class="history-badge-crit">⭐ ¡Impacto Crítico Natural 20!</div>' : ''}
          ${entry.isCritFail ? '<div class="history-badge-fail">💀 ¡Pifia Natural 1!</div>' : ''}
        </div>
      `;
      historyList.insertAdjacentHTML('afterbegin', cardHtml);
    }
  },

  clearDiceHistory() {
    diceEngine.clearHistory();
    renderApp({ renderStep: false });
  },

  // -----------------------------------------------------------
  // EDICIÓN RÁPIDA EN PARTIDA Y GUARDADO ASÍNCRONO
  // -----------------------------------------------------------

  async saveActiveCharacterUpdates(charId, updates) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    Object.assign(char, updates);
    state.activeCharacter = char;
    renderApp({ renderStep: false });

    try {
      await apiFetch(`/api/characters/${charId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (err) {
      console.error('Error guardando actualización en servidor:', err);
    }
  },

  adjustCurrentHp(charId, delta) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const maxHp = char.calculatedStats?.maxHp || 10;
    const current = typeof char.currentHp === 'number' ? char.currentHp : maxHp;
    const next = Math.max(0, Math.min(maxHp + 50, current + delta));

    this.saveActiveCharacterUpdates(charId, { currentHp: next });
  },

  setCurrentHpDirect(charId, val) {
    const num = isNaN(val) ? 0 : Math.max(0, val);
    this.saveActiveCharacterUpdates(charId, { currentHp: num });
  },

  setTempHpDirect(charId, val) {
    const num = isNaN(val) ? 0 : Math.max(0, val);
    this.saveActiveCharacterUpdates(charId, { tempHp: num });
  },

  toggleHeroicInspiration(charId) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;
    const current = !!char.heroicInspiration;
    this.saveActiveCharacterUpdates(charId, { heroicInspiration: !current });
  },

  toggleDiceDrawer(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const drawer = document.getElementById('mobile-dice-drawer');
    const fabBtn = document.getElementById('fab-dice-toggle-btn') || document.querySelector('.mobile-fab-dice-btn');
    const fabIcon = document.getElementById('fab-dice-icon');
    if (!drawer) return;

    const isHidden = drawer.classList.contains('hidden');
    if (isHidden) {
      drawer.classList.remove('hidden');
      if (fabBtn) fabBtn.classList.add('active');
      if (fabIcon) {
        fabIcon.innerHTML = `
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>`;
      }
    } else {
      this.closeDiceDrawer();
    }
  },

  closeDiceDrawer() {
    const drawer = document.getElementById('mobile-dice-drawer');
    const fabBtn = document.getElementById('fab-dice-toggle-btn') || document.querySelector('.mobile-fab-dice-btn');
    const fabIcon = document.getElementById('fab-dice-icon');
    if (drawer && !drawer.classList.contains('hidden')) {
      drawer.classList.add('hidden');
      if (fabBtn) fabBtn.classList.remove('active');
      if (fabIcon) {
        fabIcon.innerHTML = `
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"></polygon>
            <polyline points="2 8.5 12 15.5 22 8.5"></polyline>
            <line x1="12" y1="2" x2="12" y2="15.5"></line>
          </svg>`;
      }
    }
  },

  addCombatXp(charId, delta) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const currentXp = Math.max(0, Number(char.xp) || 0);
    const amount = parseInt(delta, 10) || 0;
    if (amount === 0) return;

    const newXp = Math.max(0, currentXp + amount);
    this.saveActiveCharacterUpdates(charId, { xp: newXp });

    const progress = Rules.getXpProgress(newXp, char.level || 1);
    if (progress.canLevelUp) {
      console.log(`[XP] ¡${char.name} tiene suficientes puntos para subir a Nivel ${progress.nextLevel}!`);
    }
  },

  setTotalXpDirect(charId, val) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const num = isNaN(val) ? 0 : Math.max(0, parseInt(val, 10));
    this.saveActiveCharacterUpdates(charId, { xp: num });
  },

  async promptLevelUp(charId, targetLevel) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const nextLvl = targetLevel || (char.level || 1) + 1;
    const classDef = state.catalogs.classes.find(c => c.id === char.classId) || {};
    const speciesDef = state.catalogs.species.find(s => s.id === char.speciesId) || {};
    const conMod = char.calculatedStats?.abilities?.constitucion?.mod || 0;
    const newMaxHp = Rules.calculateHitPoints({
      classDef,
      conMod,
      level: nextLvl,
      speciesDef,
      featIds: char.feats || []
    });

    const newPb = Rules.calculateProficiencyBonus(nextLvl);
    const spellProg = Rules.getSpellcastingProgression(char.classId, nextLvl);
    const oldSpellProg = Rules.getSpellcastingProgression(char.classId, char.level || 1);

    const unlockedFeatures = Rules.CLASS_FEATURES_BY_LEVEL[char.classId]?.[nextLvl] || [];
    const featureNames = unlockedFeatures.map(f => f.name).join(', ');
    const newSpellLevelUnlocked = spellProg.isSpellcaster && (spellProg.maxSpellLevel > (oldSpellProg.maxSpellLevel || 1));

    const benefitsHtml = `
      <div class="level-up-dialog-details">
        <p class="dialog-char-name" style="margin-bottom: 0.75rem;">¿Deseas ascender a <strong>${char.name}</strong> al <strong>Nivel ${nextLvl}</strong>?</p>
        <ul class="dialog-benefits-list">
          <li>❤️ <strong>Nuevos Puntos de Golpe:</strong> ${newMaxHp} PG máximos.</li>
          <li>🎯 <strong>Bono de Competencia:</strong> +${newPb}</li>
          ${featureNames ? `<li>✨ <strong>Nuevas Facultades:</strong> ${featureNames}</li>` : ''}
          ${nextLvl >= 3 && !char.subclassId ? `<li>🛡️ <strong>¡DESBLOQUEO DE SUBCLASE!</strong> Podrás elegir tu especialización de clase.</li>` : ''}
          ${newSpellLevelUnlocked ? `<li>🔮 <strong>¡Nuevos Conjuros!</strong> Desbloqueas ranuras y hechizos de Nivel ${spellProg.maxSpellLevel}.</li>` : ''}
        </ul>
      </div>
    `;

    const confirmed = await this.showConfirm({
      title: `⭐ ¡Ascenso a Nivel ${nextLvl}!`,
      messageHtml: benefitsHtml,
      icon: '⭐',
      confirmText: `⭐ ¡Ascender a Nivel ${nextLvl}!`,
      cancelText: 'Cancelar'
    });

    if (!confirmed) {
      return;
    }

    const calculatedStats = {
      ...(char.calculatedStats || {}),
      maxHp: newMaxHp,
      proficiencyBonus: newPb
    };

    this.saveActiveCharacterUpdates(charId, {
      level: nextLvl,
      currentHp: newMaxHp,
      usedSpellSlots: {},
      calculatedStats
    });

    // Si alcanza nivel 3 o superior y aún no tiene subclase, redirigir a la pestaña de Subclase
    if (nextLvl >= 3 && !char.subclassId) {
      this.switchSheetTab('subclass');
    } else if (spellProg.isSpellcaster) {
      // Si es lanzador de conjuros, abrir automáticamente la pestaña de conjuros en la sección "Seleccionar Hechizos"
      this.switchSheetTab('spells');
      this.setSpellSubTab('select');
      if (newSpellLevelUnlocked) {
        this.setSpellLevelFilter(spellProg.maxSpellLevel);
      }
    }

    await this.showAlert({
      title: `🎉 ¡Nivel ${nextLvl} Alcanzado!`,
      icon: '🎉',
      type: 'success',
      messageHtml: `
        <p>¡Felicidades! <strong>${char.name}</strong> ha alcanzado el <strong>Nivel ${nextLvl}</strong>.</p>
        <ul class="dialog-benefits-list">
          ${nextLvl >= 3 && !char.subclassId ? `<li>🛡️ <strong>¡SUBCLASE DISPONIBLE!</strong> Accede a la pestaña "Subclase" para especializar a tu personaje.</li>` : ''}
          ${featureNames ? `<li>⚡ <strong>Nuevas Habilidades:</strong> ${featureNames}</li>` : ''}
          ${newSpellLevelUnlocked ? `<li>✨ <strong>¡Nuevos Hechizos de Nivel ${spellProg.maxSpellLevel}!</strong> Selecciona tus favoritos en la pestaña de conjuros.</li>` : ''}
        </ul>
      `
    });
  },

  async rollHitDie(charId) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const classDef = state.catalogs.classes.find(c => c.id === char.classId) || {};
    const hitDie = classDef.hitDie || 8;
    const conMod = char.calculatedStats?.abilities?.constitucion?.mod || 0;
    const totalHitDice = char.level || 1;
    const used = char.usedHitDice || 0;

    if (used >= totalHitDice) {
      await this.showAlert({
        title: 'Dados de Golpe Agotados',
        icon: '⚠️',
        type: 'warning',
        message: 'Ya has gastado todos tus dados de golpe disponibles para curarte. Necesitas completar un descanso largo para recuperarlos.'
      });
      return;
    }

    const roll = diceEngine.roll(1, hitDie, conMod, 'Dado de Golpe (Curación)', `Recupera PG en descanso`);
    const healAmount = Math.max(1, roll.total);
    const maxHp = char.calculatedStats?.maxHp || 10;
    const current = typeof char.currentHp === 'number' ? char.currentHp : maxHp;
    const newHp = Math.min(maxHp, current + healAmount);

    this.saveActiveCharacterUpdates(charId, {
      currentHp: newHp,
      usedHitDice: used + 1
    });
  },

  toggleSpellSlot(charId, level, slotIndex) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const usedSlots = { ...(char.usedSpellSlots || {}) };
    const currentUsed = usedSlots[level] || 0;

    // Si hace clic en un espacio ya usado, lo recupera; si hace clic en uno disponible, lo gasta
    if (slotIndex < currentUsed) {
      usedSlots[level] = Math.max(0, currentUsed - 1);
    } else {
      usedSlots[level] = currentUsed + 1;
    }

    this.saveActiveCharacterUpdates(charId, { usedSpellSlots: usedSlots });
  },

  async castSpell(charId, spellName, levelLabel, levelNum) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (levelNum > 0) {
      const spellProg = Rules.getSpellcastingProgression(char.classId, char.level || 1);
      const classDef = state.catalogs.classes.find(c => c.id === char.classId) || {};
      const maxSlots = spellProg.spellSlots?.[levelNum.toString()] || classDef.spellcasting?.spellSlots?.[levelNum.toString()] || 0;
      const usedSlots = { ...(char.usedSpellSlots || {}) };
      const currentUsed = usedSlots[levelNum.toString()] || 0;

      if (currentUsed >= maxSlots) {
        await this.showAlert({
          title: 'Ranuras Agotadas',
          icon: '🔮',
          type: 'warning',
          message: `¡No te quedan ranuras de conjuro de ${levelLabel}! Realiza un descanso largo para recuperarlas.`
        });
        return;
      }

      usedSlots[levelNum.toString()] = currentUsed + 1;
      this.saveActiveCharacterUpdates(charId, { usedSpellSlots: usedSlots });
    }

    diceEngine.roll(1, 20, 0, `Lanzar: ${spellName}`, `Conjuro ${levelLabel}`);
    renderApp({ renderStep: false });
  },

  async triggerShortRest(charId) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    await this.showAlert({
      title: '☕ Descanso Corto Completado',
      icon: '☕',
      type: 'info',
      messageHtml: `
        <p><strong>${char.name}</strong> ha completado un <strong>Descanso Corto</strong> (1 hora de calma y recuperación).</p>
        <ul class="dialog-benefits-list">
          <li>🎲 Puedes gastar tus <strong>dados de golpe disponibles</strong> para recuperar puntos de golpe.</li>
          <li>✨ Los rasgos y facultades de descanso corto vuelven a estar listos.</li>
        </ul>
      `
    });
  },

  async triggerLongRest(charId) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const maxHp = char.calculatedStats?.maxHp || 10;
    const totalHitDice = char.level || 1;
    const usedHitDice = char.usedHitDice || 0;
    // Recupera la mitad de sus dados de golpe totales (mínimo 1)
    const recoveredDice = Math.max(1, Math.floor(totalHitDice / 2));
    const newUsedDice = Math.max(0, usedHitDice - recoveredDice);

    this.saveActiveCharacterUpdates(charId, {
      currentHp: maxHp,
      tempHp: 0,
      usedSpellSlots: {},
      usedHitDice: newUsedDice
    });

    await this.showAlert({
      title: '⛺ ¡Descanso Largo Completado!',
      icon: '⛺',
      type: 'success',
      messageHtml: `
        <p><strong>${char.name}</strong> ha completado un <strong>Descanso Largo</strong> (8 horas de sueño reparador).</p>
        <ul class="dialog-benefits-list">
          <li>❤️ <strong>Puntos de Golpe:</strong> Restaurados al máximo (<strong>${maxHp} PG</strong>).</li>
          <li>🔮 <strong>Ranuras de Conjuro:</strong> Todas las ranuras restablecidas.</li>
          <li>🎲 <strong>Dados de Golpe:</strong> Recuperados <strong>${recoveredDice}</strong> dado(s).</li>
          <li>🛡️ Puntos de golpe temporales reiniciados a 0.</li>
        </ul>
      `
    });
  },

  // -----------------------------------------------------------
  // GESTIÓN DE INVENTARIO Y EQUIPO EN PARTIDA
  // -----------------------------------------------------------

  toggleItemEquip(charId, itemId) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char || !Array.isArray(char.inventory)) return;

    const targetItem = char.inventory.find(i => i.id === itemId);
    if (!targetItem) return;

    const willBeEquipped = !targetItem.equipped;
    const isShield = Rules.isShieldItem(targetItem);
    const isBodyArmor = !isShield && (Boolean(Rules.matchArmorDefinition(targetItem, state.catalogs.equipment?.armors)) || targetItem.type === 'armadura');

    const updated = char.inventory.map(item => {
      if (item.id === itemId) {
        return { ...item, equipped: willBeEquipped };
      }
      // Si se equipa una armadura de cuerpo, desequipar cualquier otra armadura de cuerpo
      if (willBeEquipped && isBodyArmor) {
        const otherIsShield = Rules.isShieldItem(item);
        const otherIsBodyArmor = !otherIsShield && (Boolean(Rules.matchArmorDefinition(item, state.catalogs.equipment?.armors)) || item.type === 'armadura');
        if (otherIsBodyArmor) {
          return { ...item, equipped: false };
        }
      }
      // Si se equipa un escudo, desequipar cualquier otro escudo
      if (willBeEquipped && isShield && Rules.isShieldItem(item)) {
        return { ...item, equipped: false };
      }
      return item;
    });

    const classDef = state.catalogs.classes.find(c => c.id === char.classId) || {};
    const abs = char.calculatedStats?.abilities || Rules.calculateFinalAbilities(char.baseAbilityScores || {}, char.backgroundAbilityBonus || {});
    const breakdown = Rules.getArmorClassBreakdown({
      inventory: updated,
      classDef,
      abilities: abs,
      fightingStyle: char.fightingStyle,
      catalogs: state.catalogs
    });

    const currentStats = char.calculatedStats ? { ...char.calculatedStats } : {};
    currentStats.ac = breakdown.totalAc;

    this.saveActiveCharacterUpdates(charId, { 
      inventory: updated,
      calculatedStats: currentStats
    });
  },

  changeItemQty(charId, itemId, delta) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char || !Array.isArray(char.inventory)) return;

    let updated = char.inventory.map(item => {
      if (item.id === itemId) {
        const nextQty = (item.quantity || 1) + delta;
        return { ...item, quantity: nextQty };
      }
      return item;
    });

    // Eliminar si la cantidad llega a 0
    updated = updated.filter(item => item.quantity > 0);

    this.saveActiveCharacterUpdates(charId, { inventory: updated });
  },

  deleteInventoryItem(charId, itemId) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char || !Array.isArray(char.inventory)) return;

    const updated = char.inventory.filter(item => item.id !== itemId);
    const classDef = state.catalogs.classes.find(c => c.id === char.classId) || {};
    const abs = char.calculatedStats?.abilities || Rules.calculateFinalAbilities(char.baseAbilityScores || {}, char.backgroundAbilityBonus || {});
    const breakdown = Rules.getArmorClassBreakdown({
      inventory: updated,
      classDef,
      abilities: abs,
      fightingStyle: char.fightingStyle,
      catalogs: state.catalogs
    });

    const currentStats = char.calculatedStats ? { ...char.calculatedStats } : {};
    currentStats.ac = breakdown.totalAc;

    this.saveActiveCharacterUpdates(charId, { 
      inventory: updated,
      calculatedStats: currentStats
    });
  },

  // -----------------------------------------------------------
  // GESTIÓN DE MONEDAS: ORO, PLATA Y COBRE (CONTROL MANUAL)
  // -----------------------------------------------------------

  modifyCharacterCurrency(charId, multiplier = 1) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    // Detectar moneda seleccionada (por defecto 'gold')
    const activePill = document.querySelector(`.coin-pill-btn.active[data-char="${charId}"]`);
    const coinType = activePill ? activePill.dataset.cointype : (window._selectedCoinType?.[charId] || 'gold');

    const inputEl = document.getElementById(`coin-delta-input-${charId}`);
    const rawVal = inputEl ? inputEl.value : '1';
    const amount = parseInt(rawVal, 10);
    if (isNaN(amount) || amount <= 0) {
      this.showAlert({
        title: 'Cantidad Inválida',
        icon: '⚠️',
        type: 'warning',
        message: 'Introduce una cantidad válida mayor a 0 para modificar las monedas.'
      });
      return;
    }

    const currentVal = typeof char[coinType] === 'number' && !isNaN(char[coinType])
      ? char[coinType]
      : (coinType === 'gold' ? Rules.calculateStartingGold({ char, catalogs: state.catalogs }) : 0);

    const nextVal = Math.max(0, currentVal + (amount * multiplier));
    this.saveActiveCharacterUpdates(charId, { [coinType]: nextVal });
  },

  selectCoinType(charId, coinType) {
    if (!window._selectedCoinType) window._selectedCoinType = {};
    window._selectedCoinType[charId] = coinType;

    const buttons = document.querySelectorAll(`.coin-pill-btn[data-char="${charId}"]`);
    buttons.forEach(btn => {
      if (btn.dataset.cointype === coinType) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const prefixEl = document.getElementById(`coin-input-prefix-${charId}`);
    if (prefixEl) {
      prefixEl.innerHTML = renderCoinSvg(coinType, 18);
    }
  },

  async promptSetDirectCurrency(charId, coinType) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const coinNames = {
      gold: 'Piezas de Oro (PO)',
      silver: 'Piezas de Plata (PP)',
      copper: 'Piezas de Cobre (PC)'
    };
    const coinShort = {
      gold: 'PO',
      silver: 'PP',
      copper: 'PC'
    };

    const currentVal = typeof char[coinType] === 'number' && !isNaN(char[coinType])
      ? char[coinType]
      : (coinType === 'gold' ? Rules.calculateStartingGold({ char, catalogs: state.catalogs }) : 0);

    const coinSvg = typeof renderCoinSvg === 'function' ? renderCoinSvg(coinType, 26) : '🪙';

    const input = await this.showPrompt({
      title: `Fijar ${coinNames[coinType] || 'Monedas'}`,
      messageHtml: `<p>Fijar cantidad exacta de <strong>${coinNames[coinType]}</strong> para <strong>${char.name}</strong>:</p>`,
      defaultValue: currentVal,
      iconHtml: coinSvg,
      inputType: 'number',
      unit: coinShort[coinType] || '',
      confirmText: '💾 Guardar Cantidad',
      cancelText: 'Cancelar',
      min: 0,
      step: 1
    });

    if (input === null || input === undefined) return;
    const parsed = parseInt(String(input).trim(), 10);
    if (isNaN(parsed) || parsed < 0) {
      await this.showAlert({
        title: 'Cantidad Inválida',
        icon: '⚠️',
        type: 'warning',
        message: 'Por favor introduce un número entero válido mayor o igual a 0.'
      });
      return;
    }
    this.saveActiveCharacterUpdates(charId, { [coinType]: parsed });
  },

  // Métodos retrocompatibles
  modifyCharacterGold(charId, multiplier = 1) {
    this.modifyCharacterCurrency(charId, multiplier);
  },
  promptSetDirectGold(charId) {
    this.promptSetDirectCurrency(charId, 'gold');
  },

  showAddItemModal(charId) {
    const allItems = getAllCatalogItems(state.catalogs.equipment);
    const defaultItem = allItems.find(i => i.id === 'pocion_curacion') || allItems[0] || null;

    addItemModalState = {
      charId,
      activeTab: 'catalog',
      categoryFilter: 'all',
      searchQuery: '',
      selectedItemId: defaultItem ? defaultItem.id : null,
      quantity: 1,
      equipImmediately: false
    };

    this.renderAddItemModal();
  },

  renderAddItemModal() {
    const container = document.getElementById('modal-container');
    if (!container) return;

    const char = state.savedCharacters.find(c => c.id === addItemModalState.charId);
    if (!char) return;

    const allItems = getAllCatalogItems(state.catalogs.equipment);
    const filtered = this.getFilteredCatalogItems(allItems);
    let selectedItem = allItems.find(i => i.id === addItemModalState.selectedItemId) || filtered[0] || null;
    if (selectedItem && addItemModalState.selectedItemId !== selectedItem.id) {
      addItemModalState.selectedItemId = selectedItem.id;
    }

    container.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target === this) window.app.closeModal()">
        <div class="modal-content add-item-modal-content">
          <div class="modal-header">
            <div>
              <h3 style="color: var(--gold); margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                <span>➕ Añadir Objeto al Inventario</span>
              </h3>
              <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.25rem;">
                Busca en el catálogo oficial de D&D 2024 o añade un objeto personalizado con valores manuales.
              </p>
            </div>
            <button class="btn-close" onclick="window.app.closeModal()">&times;</button>
          </div>

          <!-- SELECTOR DE MODO: CATÁLOGO VS MANUAL -->
          <div class="item-modal-mode-tabs">
            <button 
              type="button" 
              class="item-mode-tab-btn ${addItemModalState.activeTab === 'catalog' ? 'active' : ''}" 
              onclick="window.app.setAddItemTab('catalog')"
            >
              📖 Catálogo del Manual (${allItems.length} objetos)
            </button>
            <button 
              type="button" 
              class="item-mode-tab-btn ${addItemModalState.activeTab === 'manual' ? 'active' : ''}" 
              onclick="window.app.setAddItemTab('manual')"
            >
              ✏️ Objeto Personalizado (Entrada Manual)
            </button>
          </div>

          ${addItemModalState.activeTab === 'catalog' ? this.renderCatalogModalBody(allItems, filtered, selectedItem) : this.renderManualModalBody()}
        </div>
      </div>
    `;
  },

  getFilteredCatalogItems(allItems) {
    const query = (addItemModalState.searchQuery || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const cat = addItemModalState.categoryFilter;

    return allItems.filter(item => {
      if (cat !== 'all') {
        if (cat === 'arma' && item.category !== 'arma') return false;
        if (cat === 'armadura' && item.category !== 'armadura') return false;
        if (cat === 'equipo' && item.category !== 'equipo') return false;
        if (cat === 'suministro' && item.category !== 'suministro') return false;
        if (cat === 'herramienta' && item.category !== 'herramienta') return false;
        if (cat === 'paquete' && item.category !== 'paquete') return false;
        if (cat === 'montura' && item.category !== 'montura') return false;
      }
      if (query) {
        const nameNorm = item.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const catNorm = (item.categoryLabel || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const descNorm = (item.desc || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return nameNorm.includes(query) || catNorm.includes(query) || descNorm.includes(query);
      }
      return true;
    });
  },

  renderCatalogModalBody(allItems, filtered, selectedItem) {
    const categories = [
      { id: 'all', label: 'Todos', count: allItems.length },
      { id: 'arma', label: '⚔️ Armas', count: allItems.filter(i => i.category === 'arma').length },
      { id: 'armadura', label: '🛡️ Armaduras y Escudos', count: allItems.filter(i => i.category === 'armadura').length },
      { id: 'equipo', label: '🎒 Equipo de Aventuras', count: allItems.filter(i => i.category === 'equipo').length },
      { id: 'suministro', label: '🧪 Pociones y Consumibles', count: allItems.filter(i => i.category === 'suministro').length },
      { id: 'herramienta', label: '🛠️ Herramientas', count: allItems.filter(i => i.category === 'herramienta').length },
      { id: 'paquete', label: '📦 Paquetes', count: allItems.filter(i => i.category === 'paquete').length },
      { id: 'montura', label: '🐎 Monturas', count: allItems.filter(i => i.category === 'montura').length }
    ];

    return `
      <div class="item-search-container">
        <!-- BUSCADOR EN VIVO -->
        <div class="item-search-input-wrapper">
          <input 
            type="text" 
            id="modal-item-search-input" 
            class="input-text item-search-input" 
            placeholder="🔍 Buscar por nombre (ej. poción de curación, cuerda, espada larga, antorcha, cota...)"
            value="${addItemModalState.searchQuery}"
            oninput="window.app.setAddItemSearch(this.value)"
            autofocus
          >
          ${addItemModalState.searchQuery ? `
            <button type="button" class="btn-clear-search" onclick="window.app.setAddItemSearch('')" title="Borrar filtro">✕</button>
          ` : ''}
        </div>

        <!-- FILTROS POR CATEGORÍA -->
        <div class="item-category-chips">
          ${categories.map(c => `
            <button 
              type="button" 
              class="chip-cat-filter ${addItemModalState.categoryFilter === c.id ? 'active' : ''}" 
              onclick="window.app.setAddItemCategory('${c.id}')"
            >
              ${c.label} (${c.count})
            </button>
          `).join('')}
        </div>
      </div>

      <!-- LAYOUT DIVIDIDO: LISTA DE RESULTADOS + DETALLE PREVIEW -->
      <div class="catalog-selection-layout">
        <!-- LISTA CON SCROLL -->
        <div id="catalog-items-scroll-list" class="catalog-items-scroll-list" role="listbox">
          ${this.renderCatalogItemsRows(filtered, selectedItem)}
        </div>

        <!-- PREVIEW DETALLADO DEL OBJETO -->
        <div id="catalog-preview-container" class="catalog-preview-container">
          ${this.renderCatalogItemPreview(selectedItem)}
        </div>
      </div>

      <!-- BARRA INFERIOR DE ACCIONES -->
      <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
        <span id="catalog-count-label" style="font-size: 0.8rem; color: var(--text-muted);">
          ${filtered.length} objetos encontrados en el Manual
        </span>
        <div style="display: flex; gap: 0.75rem;">
          <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">Cancelar</button>
          <button 
            type="button" 
            id="modal-catalog-add-btn" 
            class="btn btn-primary" 
            onclick="window.app.addSelectedCatalogItem('${addItemModalState.charId}')"
            ${!selectedItem ? 'disabled' : ''}
          >
            ➕ Añadir ${selectedItem ? `"${selectedItem.name}"` : 'al Inventario'}
          </button>
        </div>
      </div>
    `;
  },

  renderCatalogItemsRows(filtered, selectedItem) {
    if (filtered.length === 0) {
      return `
        <div class="catalog-no-results">
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.5rem;">No se encontró ningún objeto con ese criterio.</p>
          <button type="button" class="btn btn-secondary btn-xs" onclick="window.app.setAddItemTab('manual')">
            ✏️ ¿Deseas añadirlo manualmente?
          </button>
        </div>
      `;
    }

    return filtered.map(item => {
      const isSel = selectedItem && selectedItem.id === item.id;
      return `
        <div 
          class="catalog-item-row ${isSel ? 'selected' : ''}" 
          onclick="window.app.selectCatalogItem('${item.id}')"
        >
          <div class="catalog-item-info-col">
            <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
              <strong class="catalog-item-name">${item.name}</strong>
              <span class="badge-cat-tag cat-${item.category}">${item.categoryLabel}</span>
            </div>
            <div class="catalog-item-subtext">${item.properties || item.desc || ''}</div>
          </div>
          <div class="catalog-item-meta-col">
            <span class="catalog-meta-weight">⚖️ ${item.weightLb} lb</span>
            <span class="catalog-meta-cost">💰 ${item.cost}</span>
          </div>
        </div>
      `;
    }).join('');
  },

  renderCatalogItemPreview(item) {
    if (!item) {
      return `
        <div class="catalog-preview-empty">
          <p style="color: var(--text-muted); font-size: 0.85rem;">Selecciona un objeto de la lista para consultar sus detalles oficiales.</p>
        </div>
      `;
    }

    return `
      <div class="catalog-preview-card">
        <div class="preview-card-header">
          <div>
            <h4 class="preview-item-title">${item.name}</h4>
            <span class="badge-cat-tag cat-${item.category}">${item.categoryLabel}</span>
          </div>
          <div class="preview-price-tag">
            ${item.cost}
          </div>
        </div>

        <div class="preview-pills-row">
          <span class="preview-pill">⚖️ Peso: <strong>${item.weightLb} lb</strong> (${item.weight})</span>
          ${item.damage ? `<span class="preview-pill">⚔️ Daño: <strong>${item.damage}</strong></span>` : ''}
          ${item.range ? `<span class="preview-pill">📏 Alcance: <strong>${item.range}</strong></span>` : ''}
          ${item.ac ? `<span class="preview-pill">🛡️ CA: <strong>${item.ac}</strong></span>` : ''}
          ${item.mastery ? `<span class="preview-pill">🎯 Maestría: <strong>${item.mastery.toUpperCase()}</strong></span>` : ''}
        </div>

        <div class="preview-item-desc">${item.desc}</div>

        <!-- CONTROLES DE ADICIÓN RÁPIDA -->
        <div class="catalog-add-controls">
          <div class="qty-field-group">
            <label class="form-label" style="font-size: 0.85rem; margin: 0; color: #cbd5e1;">Cantidad:</label>
            <input 
              type="number" 
              id="modal-catalog-qty" 
              class="input-text" 
              style="width: 80px; padding: 0.35rem 0.5rem;" 
              value="${addItemModalState.quantity || 1}" 
              min="1"
              onchange="window.app.setAddItemQty(parseInt(this.value) || 1)"
            >
          </div>

          <label class="equip-checkbox-label">
            <input 
              type="checkbox" 
              id="modal-catalog-equip" 
              ${addItemModalState.equipImmediately ? 'checked' : ''}
              onchange="window.app.setAddItemEquip(this.checked)"
            >
            <span>¿Equipar en combate de inmediato?</span>
          </label>
        </div>
      </div>
    `;
  },

  renderManualModalBody() {
    return `
      <form onsubmit="event.preventDefault(); window.app.addCustomItem('${addItemModalState.charId}');" class="manual-item-form">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">Nombre del Objeto:</label>
          <input 
            type="text" 
            id="modal-manual-name" 
            class="input-text" 
            required 
            placeholder="Ej. Poción de Fuerza de Gigante, Amuleto de obsidiana, 50 Monedas de oro..."
            autofocus
          >
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
          <div>
            <label class="form-label">Cantidad:</label>
            <input type="number" id="modal-manual-qty" class="input-text" value="1" min="1" required>
          </div>
          <div>
            <label class="form-label">Peso unitario (lb):</label>
            <input type="number" step="0.1" id="modal-manual-weight" class="input-text" value="1" min="0">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
          <div>
            <label class="form-label">Tipo de Objeto:</label>
            <select id="modal-manual-type" class="select-box">
              <option value="equipo">Equipo General</option>
              <option value="arma">Arma</option>
              <option value="armadura">Armadura / Escudo</option>
              <option value="suministro">Suministro / Poción / Consumible</option>
              <option value="herramienta">Herramienta / Instrumento</option>
              <option value="tesoro">Monedas / Tesoro / Gema</option>
            </select>
          </div>
          <div>
            <label class="form-label">Coste o Valor (opcional):</label>
            <input type="text" id="modal-manual-cost" class="input-text" placeholder="Ej. 25 po">
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">Propiedades o Notas especiales:</label>
          <input type="text" id="modal-manual-props" class="input-text" placeholder="Ej. Objeto mágico sintonizado, otorga ventaja en sigilo">
        </div>

        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="equip-checkbox-label">
            <input type="checkbox" id="modal-manual-equip">
            <span>¿Equipar en combate de inmediato?</span>
          </label>
        </div>

        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
          <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">➕ Añadir Objeto Manual</button>
        </div>
      </form>
    `;
  },

  setAddItemTab(tab) {
    addItemModalState.activeTab = tab;
    this.renderAddItemModal();
  },

  setAddItemCategory(cat) {
    addItemModalState.categoryFilter = cat;
    this.refreshCatalogModalView();
  },

  setAddItemSearch(query) {
    addItemModalState.searchQuery = query || '';
    this.refreshCatalogModalView(false);
  },

  selectCatalogItem(itemId) {
    addItemModalState.selectedItemId = itemId;
    this.refreshCatalogModalView();
  },

  setAddItemQty(qty) {
    addItemModalState.quantity = Math.max(1, qty);
  },

  setAddItemEquip(val) {
    addItemModalState.equipImmediately = Boolean(val);
  },

  refreshCatalogModalView(updateInput = true) {
    const allItems = getAllCatalogItems(state.catalogs.equipment);
    const filtered = this.getFilteredCatalogItems(allItems);
    let selectedItem = allItems.find(i => i.id === addItemModalState.selectedItemId);
    if (!selectedItem || !filtered.some(i => i.id === selectedItem.id)) {
      selectedItem = filtered[0] || null;
      if (selectedItem) addItemModalState.selectedItemId = selectedItem.id;
    }

    if (updateInput) {
      const inputEl = document.getElementById('modal-item-search-input');
      if (inputEl) inputEl.value = addItemModalState.searchQuery;
    }

    // Actualizar chips activos
    document.querySelectorAll('.chip-cat-filter').forEach(btn => {
      const isAct = btn.getAttribute('onclick')?.includes(`'${addItemModalState.categoryFilter}'`);
      btn.classList.toggle('active', isAct);
    });

    // Actualizar lista scrollable
    const listEl = document.getElementById('catalog-items-scroll-list');
    if (listEl) {
      listEl.innerHTML = this.renderCatalogItemsRows(filtered, selectedItem);
    }

    // Actualizar preview card
    const prevEl = document.getElementById('catalog-preview-container');
    if (prevEl) {
      prevEl.innerHTML = this.renderCatalogItemPreview(selectedItem);
    }

    // Actualizar contador y botón de añadir
    const countEl = document.getElementById('catalog-count-label');
    if (countEl) {
      countEl.innerText = `${filtered.length} objetos encontrados en el Manual`;
    }

    const addBtn = document.getElementById('modal-catalog-add-btn');
    if (addBtn) {
      addBtn.disabled = !selectedItem;
      addBtn.innerHTML = `➕ Añadir ${selectedItem ? `"${selectedItem.name}"` : 'al Inventario'}`;
    }
  },

  addSelectedCatalogItem(charId) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const allItems = getAllCatalogItems(state.catalogs.equipment);
    const item = allItems.find(i => i.id === addItemModalState.selectedItemId);
    if (!item) return;

    const qty = Math.max(1, addItemModalState.quantity || 1);
    const isEquipped = Boolean(addItemModalState.equipImmediately);

    const inv = Array.isArray(char.inventory) ? [...char.inventory] : [];

    // Si es un suministro no equipado, apilar en objeto existente si coincide
    const existing = inv.find(i => i.name.toLowerCase() === item.name.toLowerCase() && i.equipped === isEquipped && !isEquipped);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + qty;
    } else {
      const isShield = Rules.isShieldItem(item);
      const isBodyArmor = !isShield && (Boolean(Rules.matchArmorDefinition(item, state.catalogs.equipment?.armors)) || item.type === 'armadura' || item.category === 'armadura');

      if (isEquipped) {
        if (isBodyArmor) {
          inv.forEach(i => {
            if (i.equipped && !Rules.isShieldItem(i) && (Boolean(Rules.matchArmorDefinition(i, state.catalogs.equipment?.armors)) || i.type === 'armadura')) {
              i.equipped = false;
            }
          });
        } else if (isShield) {
          inv.forEach(i => {
            if (i.equipped && Rules.isShieldItem(i)) {
              i.equipped = false;
            }
          });
        }
      }

      inv.push({
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: item.name,
        quantity: qty,
        weight: item.weightLb !== undefined ? item.weightLb : 1,
        type: item.type || (item.category === 'armadura' ? (isShield ? 'escudo' : 'armadura') : item.category || 'equipo'),
        equipped: isEquipped,
        cost: item.cost,
        properties: item.properties || item.desc || ''
      });
    }

    const classDef = state.catalogs.classes.find(c => c.id === char.classId) || {};
    const abs = char.calculatedStats?.abilities || Rules.calculateFinalAbilities(char.baseAbilityScores || {}, char.backgroundAbilityBonus || {});
    const breakdown = Rules.getArmorClassBreakdown({
      inventory: inv,
      classDef,
      abilities: abs,
      fightingStyle: char.fightingStyle,
      catalogs: state.catalogs
    });
    const currentStats = char.calculatedStats ? { ...char.calculatedStats } : {};
    currentStats.ac = breakdown.totalAc;

    this.closeModal();
    this.saveActiveCharacterUpdates(charId, { inventory: inv, calculatedStats: currentStats });
  },

  addCustomItem(charId) {
    const char = state.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const nameEl = document.getElementById('modal-manual-name');
    const qtyEl = document.getElementById('modal-manual-qty');
    const weightEl = document.getElementById('modal-manual-weight');
    const typeEl = document.getElementById('modal-manual-type');
    const costEl = document.getElementById('modal-manual-cost');
    const propsEl = document.getElementById('modal-manual-props');
    const equipEl = document.getElementById('modal-manual-equip');

    if (!nameEl || !nameEl.value.trim()) return;

    const newItem = {
      id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: nameEl.value.trim(),
      quantity: parseInt(qtyEl?.value) || 1,
      weight: parseFloat(weightEl?.value) || 0,
      type: typeEl?.value || 'equipo',
      equipped: Boolean(equipEl?.checked),
      cost: costEl?.value?.trim() || '—',
      properties: propsEl?.value?.trim() || 'Añadido manualmente'
    };

    const inv = Array.isArray(char.inventory) ? [...char.inventory] : [];

    if (newItem.equipped) {
      const isShield = Rules.isShieldItem(newItem);
      const isBodyArmor = !isShield && (newItem.type === 'armadura' || Boolean(Rules.matchArmorDefinition(newItem, state.catalogs.equipment?.armors)));
      if (isBodyArmor) {
        inv.forEach(i => {
          if (i.equipped && !Rules.isShieldItem(i) && (Boolean(Rules.matchArmorDefinition(i, state.catalogs.equipment?.armors)) || i.type === 'armadura')) {
            i.equipped = false;
          }
        });
      } else if (isShield) {
        inv.forEach(i => {
          if (i.equipped && Rules.isShieldItem(i)) {
            i.equipped = false;
          }
        });
      }
    }

    inv.push(newItem);

    const classDef = state.catalogs.classes.find(c => c.id === char.classId) || {};
    const abs = char.calculatedStats?.abilities || Rules.calculateFinalAbilities(char.baseAbilityScores || {}, char.backgroundAbilityBonus || {});
    const breakdown = Rules.getArmorClassBreakdown({
      inventory: inv,
      classDef,
      abilities: abs,
      fightingStyle: char.fightingStyle,
      catalogs: state.catalogs
    });
    const currentStats = char.calculatedStats ? { ...char.calculatedStats } : {};
    currentStats.ac = breakdown.totalAc;

    this.closeModal();
    this.saveActiveCharacterUpdates(charId, { inventory: inv, calculatedStats: currentStats });
  },

  renderCoinSvg
};

window.app = app;

// Iniciar aplicación al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

// Cerrar el cajón flotante de dados si se toca fuera de él en dispositivos móviles
document.addEventListener('click', (e) => {
  const container = document.getElementById('mobile-dice-container');
  if (container && !container.contains(e.target)) {
    if (window.app && typeof window.app.closeDiceDrawer === 'function') {
      window.app.closeDiceDrawer();
    }
  }
});
