import { state } from './state.js';
import { apiFetch } from './app.js';
import { showAlert } from './dialogModal.js';
import { supabase } from '../../src/lib/supabaseClient.js';

export const campaignUI = {
  campaigns: [],

  async fetchCampaigns() {
    try {
      const res = await apiFetch('/api/campaigns');
      const data = await res.json();
      if (data.success) {
        this.campaigns = data.campaigns;
      }
    } catch (e) {
      console.error(e);
    }
  },

  async openCampaignsList(skipSetView = false) {
    if (!state.currentUser) return showAlert({ title: 'Atención', message: 'Debes iniciar sesión' });
    
    if (!skipSetView) {
      state.setView('campaigns');
      return;
    }
    
    await this.fetchCampaigns();
    
    // Ocultar vistas React
    const reactContainer = document.getElementById('step-content');
    if (reactContainer) reactContainer.innerHTML = '';
    
    document.getElementById('creator-stepper-container').style.display = 'none';
    document.getElementById('main-layout').classList.add('full-width-view');
    
    let html = `
      <div style="max-width: 800px; width: 95%; margin: 1rem auto; padding: 1rem; background: var(--bg-card); border: 2px solid var(--gold); border-radius: 8px; box-sizing: border-box;">
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1rem; gap: 1rem;">
          <h2 style="color: var(--gold); margin: 0;">⛺ Mis Campañas</h2>
          <button class="btn btn-secondary" onclick="window.app.openWelcomeScreen()">Volver</button>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 1.5rem; margin-bottom: 2rem;">
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            <input type="text" id="new-campaign-name" class="input-text" placeholder="Nueva campaña..." style="flex: 1 1 200px; min-width: 150px;">
            <button class="btn btn-primary" style="flex: 1 1 120px;" onclick="window.campaignUI.createCampaign()">+ Crear Mesa</button>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            <input type="text" id="join-campaign-code" class="input-text" placeholder="Código 6 letras..." style="flex: 1 1 200px; min-width: 150px; text-transform: uppercase;">
            <button class="btn btn-secondary" style="flex: 1 1 120px;" onclick="window.campaignUI.joinCampaign()">Unirse</button>
          </div>
        </div>

        <div>
          ${this.campaigns.length === 0 ? '<p style="color:var(--text-muted)">No estás en ninguna campaña activa.</p>' : ''}
          ${this.campaigns.map(c => `
            <div style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; align-items: center; padding: 1rem; background: var(--bg-main); border: 1px solid var(--border-color); margin-bottom: 1rem; border-radius: 8px;">

              <div>
                <h3 style="margin-bottom: 0.5rem; color: var(--gold-light);">${c.name}</h3>
                <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.3rem;">DM: <strong style="color:white;">${c.dm_name || 'Desconocido'}</strong></div>
                <div style="color: var(--text-muted); font-size: 0.85rem;">Código de Invitación: <strong style="color:white; letter-spacing: 2px;">${c.invite_code}</strong></div>
              </div>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <button class="btn btn-secondary" onclick="window.campaignUI.viewCampaign('${c.id}')">Entrar a la Sala</button>
                ${(c.is_dm === 1 || c.dm_id === state.currentUser?.id) 
                  ? `<button class="btn btn-danger" style="background-color: #dc2626; color: white; padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer;" onclick="window.campaignUI.deleteCampaign('${c.id}')">Eliminar</button>` 
                  : `<button class="btn btn-danger" style="background-color: #dc2626; color: white; padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer;" onclick="window.campaignUI.leaveCampaign('${c.id}')">Abandonar</button>`
                }
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    reactContainer.innerHTML = html;
  },

  async createCampaign() {
    const name = document.getElementById('new-campaign-name').value;
    if(!name) return showAlert({ title: 'Error', message: 'Escribe un nombre', type: 'danger' });
    
    const res = await apiFetch('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if(data.success) {
      showAlert({ title: 'Mesa Creada', message: 'Comparte el código ' + data.campaign.inviteCode, type: 'success' });
      this.openCampaignsList();
    }
  },

  async joinCampaign() {
    const code = document.getElementById('join-campaign-code').value;
    if(!code) return;
    
    const res = await apiFetch('/api/campaigns/join', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if(data.success) {
      showAlert({ title: 'Unido', message: data.message, type: 'success' });
      this.openCampaignsList();
    } else {
      showAlert({ title: 'Error', message: data.error, type: 'danger' });
    }
  },

  async viewCampaign(campaignId, skipSetView = false) {
    if (!skipSetView) {
      state.activeCampaignId = campaignId;
      state.setView('campaign_lobby');
      return;
    }
    
    const res = await apiFetch(`/api/campaigns/${campaignId}/players`);
    const data = await res.json();
    
    if (!this.campaigns || this.campaigns.length === 0) {
      await this.fetchCampaigns();
    }
    
    const c = this.campaigns.find(x => x.id === campaignId);
    if (!c) return;
    const isAdmin = c.is_dm === 1;
    
      // Supabase Channels logic (Reemplaza Socket.io)
      
      window.activeCampaignId = campaignId;
      if (window.campaignChannel && this.activeCampaign !== campaignId) {
        supabase.removeChannel(window.campaignChannel);
        window.campaignChannel = null;
      }
      
      if (!window.campaignChannel) {
        window.campaignChannel = supabase.channel(`campaign-${campaignId}`);
        
        window.campaignChannel.on('broadcast', { event: 'character_hp_updated' }, (payload) => {
          console.log("HP updated via WS:", payload.payload);
          if (this.activeCampaign === payload.payload.campaignId && state.activeView === 'campaign_lobby') {
            this.viewCampaign(payload.payload.campaignId, true);
          }
          // Also trigger a generic window event for React components like TableSessionWrapper
          window.dispatchEvent(new CustomEvent('supabase_character_hp_updated', { detail: payload.payload }));
        });
        
        window.campaignChannel.on('broadcast', { event: 'dice_rolled' }, (payload) => {
          const d = payload.payload;
          showAlert({ title: d.username + ' tiró dados', message: d.description + ': ' + d.rollResult, icon: '🎲' });
        });
        
        window.campaignChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Joined campaign channel:', campaignId);
          }
        });
      }
      
      this.activeCampaign = campaignId;

    const myPlayer = data.players.find(p => p.username === state.currentUser.username);
    const hasCharacter = myPlayer && myPlayer.character;

    let html = `
      <div style="max-width: 1000px; width: 95%; margin: 1rem auto; padding: 1rem; background: var(--bg-card); border: 2px solid var(--gold); border-radius: 8px; box-sizing: border-box;">
        <div style="display:flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; align-items:center; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 2rem;">
          <div>
            <h2 style="color: var(--gold); margin: 0;">Mesa: ${c.name}</h2>
            <div style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.2rem;">Dungeon Master: <strong style="color: white;">${c.dm_name || 'Desconocido'}</strong></div>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            <button class="btn btn-primary" onclick="window.campaignUI.enterTable('${campaignId}', ${isAdmin}, ${!!hasCharacter})">
              ${isAdmin ? 'Pantalla del Master' : 'Ver Mesa'}
            </button>
            <button class="btn btn-secondary" onclick="window.campaignUI.openCampaignsList()">Volver</button>
          </div>
        </div>
        
        <h3>Lobby de Espera</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; margin-top: 1rem;">
          ${data.players.map(p => `
            <div style="background: var(--bg-input); padding: 1.5rem; border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
              ${p.character ? `
                <h3 style="color: var(--gold-light); margin-bottom: 0.5rem;">${p.character.name}</h3>
                <div style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem;">Jugador: ${p.username}</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.95rem;">
                  <div><span style="color: #94a3b8">Clase:</span> ${p.character.className || 'Desconocida'}</div>
                  <div><span style="color: #94a3b8">Nivel:</span> ${p.character.level || 1}</div>
                  <div><span style="color: #94a3b8">Raza:</span> ${p.character.speciesName || 'Desconocida'}</div>
                  <div><span style="color: #94a3b8">HP:</span> ${p.character.currentHp !== undefined ? p.character.currentHp : (p.character.calculatedStats?.maxHp || '?')}/${p.character.calculatedStats?.maxHp || '?'}</div>
                </div>
              ` : `
                <div style="font-weight:bold; color:var(--text-main); margin-bottom:0.5rem;">Jugador: ${p.username}</div>
                <div style="color:var(--text-muted)">Aún no ha asignado un personaje</div>
              `}
            </div>
          `).join('')}
        </div>
        
        ${!isAdmin ? `
          <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
            <h4>Asignar Personaje a esta Mesa</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
              <select id="assign-character-select" class="select-box" style="flex: 1 1 200px; min-width: 150px;">
                ${state.savedCharacters.map(char => `<option value="${char.id}">${char.name}</option>`).join('')}
              </select>
              <button class="btn btn-primary" style="flex: 1 1 120px;" onclick="window.campaignUI.assignCharacter('${campaignId}')">Asignar</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    document.getElementById('step-content').innerHTML = html;
  },

  async deleteCampaign(campaignId) {
    const { showConfirm, showAlert } = await import('./dialogModal.js');
    showConfirm({
      title: 'Eliminar Campaña',
      message: '¿Estás seguro de que quieres eliminar esta campaña y borrarla para todos los jugadores? Esta acción no se puede deshacer.',
      onConfirm: async () => {
        const res = await apiFetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
        if (res.ok) {
          showAlert({ title: 'Mesa Eliminada', message: 'La campaña ha sido borrada.', type: 'success' });
          this.openCampaignsList(true);
        }
      }
    });
  },

  async leaveCampaign(campaignId) {
    const { showConfirm, showAlert } = await import('./dialogModal.js');
    showConfirm({
      title: 'Abandonar Campaña',
      message: '¿Estás seguro de que quieres abandonar esta campaña? Tu personaje se retirará de la mesa.',
      onConfirm: async () => {
        const res = await apiFetch(`/api/campaigns/${campaignId}/leave`, { method: 'DELETE' });
        if (res.ok) {
          showAlert({ title: 'Campaña Abandonada', message: 'Has salido de la mesa exitosamente.', type: 'success' });
          this.openCampaignsList(true);
        }
      }
    });
  },

  async assignCharacter(campaignId) {
    const characterId = document.getElementById('assign-character-select').value;
    if(!characterId) return;
    
    const res = await apiFetch(`/api/campaigns/${campaignId}/character`, {
      method: 'POST',
      body: JSON.stringify({ characterId })
    });
    const data = await res.json();
    if(data.success) {
      showAlert({ title: 'Excelente', message: 'Personaje asignado', type: 'success' });
      this.viewCampaign(campaignId);
    }
  },

  async enterTable(campaignId, isAdmin, hasCharacter) {
    if (!isAdmin && !hasCharacter) {
      return showAlert({ 
        title: 'Acceso Denegado', 
        message: 'Debes asignar un personaje primero antes de poder ver la mesa.', 
        type: 'danger' 
      });
    }

    const res = await apiFetch(`/api/campaigns/${campaignId}/players`);
    const data = await res.json();
    const myPlayer = data.players.find(p => p.username === state.currentUser.username);
    
    state.activeCampaignId = campaignId;
    if (myPlayer && myPlayer.character) {
      state.activeCharacterId = myPlayer.character.id;
    } else {
      state.activeCharacterId = null; // DM or no character
    }
    
    // Switch to the new table session view
    state.setView('table_session', state.activeCharacterId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

window.campaignUI = campaignUI;
