import { state } from './state.js';
import { showAlert } from './dialogModal.js';
import { supabase } from '../../src/lib/supabaseClient.js';

export const authUI = {
  init() {
    this.checkSession();
  },

  async checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      this.renderLoggedOut();
      return;
    }

    try {
      const { user } = session;
      const username = user.user_metadata?.username || user.email.split('@')[0];
      
      // SICRONIZACIÓN: Asegurar que el usuario exista en public.users para las Foreign Keys
      const { data: exist } = await supabase.from('users').select('id').eq('id', user.id).single();
      if (!exist) {
        await supabase.from('users').insert({
          id: user.id,
          username: username,
          hash: 'supabase_auth',
          salt: 'supabase_auth',
          role: 'player'
        });
      }

      state.currentUser = { id: user.id, username, role: 'player' }; // Hardcoding role for now
      this.renderLoggedIn(state.currentUser);
    } catch (e) {
      console.error('Auth error', e);
      this.renderLoggedOut();
    }
  },

  async login(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (data.session) {
        // Obtenemos el username guardado en los metadatos durante el registro
        const username = data.user.user_metadata?.username || email.split('@')[0];
        state.currentUser = { id: data.user.id, username: username, role: 'player' };
        
        this.renderLoggedIn(state.currentUser);
        showAlert({ title: 'Bienvenido', message: `Has entrado a la taberna.`, icon: '🍻', type: 'success' });
        if (window.app && window.app.reloadUserData) window.app.reloadUserData();
        if (window.app && window.app.openWelcomeScreen) window.app.openWelcomeScreen();
      } else {
        showAlert({ title: 'Error', message: error?.message || 'Credenciales inválidas.', type: 'danger' });
      }
    } catch(e) {
      showAlert({ title: 'Error', message: 'No se pudo conectar', type: 'danger' });
    }
  },

  async register(email, username, password) {
    try {
      if (password.length < 6) {
        return showAlert({ title: 'Error', message: 'La contraseña debe tener al menos 6 caracteres.', type: 'danger' });
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username: username }
        }
      });
      
      if (data.user && !error) {
        // Si tienen Confirm Email activado, data.session será null
        if (!data.session) {
          showAlert({ title: '¡Casi listo!', message: 'Te hemos enviado un correo de confirmación. Revisa tu bandeja de entrada o spam para activar tu cuenta.', icon: '✉️', type: 'info' });
        } else {
          showAlert({ title: 'Registrado', message: 'Has forjado tu cuenta. Ya puedes entrar.', icon: '🛡️', type: 'success' });
        }
        this.showLoginModal();
      } else {
        showAlert({ title: 'Error', message: error?.message || 'Error al registrar', type: 'danger' });
      }
    } catch(e) {
      showAlert({ title: 'Error', message: 'No se pudo conectar', type: 'danger' });
    }
  },

  async logout(showMsg = true) {
    await supabase.auth.signOut();
    
    sessionStorage.removeItem('lastActiveView');
    sessionStorage.removeItem('lastActiveCharId');
    sessionStorage.removeItem('lastActiveCampaignId');
    state.currentUser = null;
    this.renderLoggedOut();
    
    if(showMsg) showAlert({ title: 'Desconectado', message: 'Has dejado la mesa.', icon: '👋' });
    if (window.app && window.app.reloadUserData) window.app.reloadUserData();
  },

  renderLoggedOut() {
    const container = document.getElementById('auth-container');
    if (container) {
      container.innerHTML = `
        <button class="btn btn-secondary" onclick="window.authUI.showLoginModal()">Entrar a la Taberna</button>
      `;
    }
    
    document.getElementById('creator-stepper-container').style.display = 'none';
    document.getElementById('main-layout').style.display = 'none';
    const dmBtn = document.getElementById('btn-nav-dm');
    if (dmBtn) dmBtn.style.display = 'none';
    const campBtn = document.getElementById('btn-nav-campaigns');
    if (campBtn) campBtn.style.display = 'none';
    const creatorBtn = document.getElementById('btn-nav-creator');
    if (creatorBtn) creatorBtn.style.display = 'none';
    const charactersBtn = document.getElementById('btn-nav-characters');
    if (charactersBtn) charactersBtn.style.display = 'none';

    this.showLoginModal();
  },

  renderLoggedIn(user) {
    const container = document.getElementById('auth-container');
    if (!container) return;
    
    container.innerHTML = `
      <div class="user-profile-widget" style="display: flex; align-items: center; gap: 1rem;">
        <div style="font-weight: bold; color: var(--gold);">${user.username}</div>
        <button class="btn btn-secondary btn-sm" onclick="window.authUI.logout()">Salir</button>
      </div>
    `;

    document.getElementById('main-layout').style.display = 'flex';
  },

  showLoginModal(isRegister = false) {
    const html = `
      <div class="auth-modal" style="margin: 0 auto; display: flex; flex-direction: column; gap: 0.8rem;">
        <h2 class="auth-title">${isRegister ? 'Unirse a la Campaña' : 'Identificarse'}</h2>
        
        <input type="email" id="auth-email" class="auth-input" placeholder="Correo electrónico" autocomplete="email"/>
        
        ${isRegister ? `<input type="text" id="auth-username" class="auth-input" placeholder="Nombre de tu aventurero (Usuario)" autocomplete="off"/>` : ''}
        
        <input type="password" id="auth-password" class="auth-input" placeholder="Contraseña (mín 6 caracteres)" autocomplete="current-password"/>
        
        <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
          <button class="btn btn-primary" style="flex:1" onclick="window.authUI.${isRegister ? 'submitRegister' : 'submitLogin'}()">${isRegister ? 'Registrar' : 'Entrar'}</button>
          <button class="btn btn-secondary" onclick="window.authUI.closeModal()">Cancelar</button>
        </div>
        
        <div style="margin-top: 1rem; font-size: 0.9em; color: var(--text-muted);">
          ${isRegister 
            ? '¿Ya tienes una hoja de personaje? <a href="#" style="color:var(--gold)" onclick="window.authUI.showLoginModal(false); return false;">Inicia sesión</a>' 
            : '¿Eres un aventurero nuevo? <a href="#" style="color:var(--gold)" onclick="window.authUI.showLoginModal(true); return false;">Regístrate</a>'
          }
        </div>
      </div>
    `;
    
    const container = document.getElementById('modal-container');
    container.innerHTML = `
      <div class="modal-overlay" style="display:flex; align-items:center; justify-content:center; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); z-index: 1000;">
        ${html}
      </div>
    `;
  },

  closeModal() {
    document.getElementById('modal-container').innerHTML = '';
  },

  submitLogin() {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-password').value;
    if (email && pass) {
      this.closeModal();
      this.login(email, pass);
    }
  },

  submitRegister() {
    const email = document.getElementById('auth-email').value;
    const user = document.getElementById('auth-username').value;
    const pass = document.getElementById('auth-password').value;
    if (email && user && pass) {
      this.closeModal();
      this.register(email, user, pass);
    }
  }
};

window.authUI = authUI;
