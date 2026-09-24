import { state } from './state.js';
import { showAlert } from './dialogModal.js';

export const authUI = {
  init() {
    this.token = localStorage.getItem('dnd_token');
    this.checkSession();
  },

  async checkSession() {
    if (!this.token) {
      this.renderLoggedOut();
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await res.json();
      
      if (data.success) {
        state.currentUser = data.user;
        this.renderLoggedIn(data.user);
      } else {
        this.logout(false);
      }
    } catch (e) {
      console.error('Auth error', e);
      this.renderLoggedOut();
    }
  },

  async login(username, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (data.success) {
        this.token = data.token;
        localStorage.setItem('dnd_token', this.token);
        state.currentUser = { id: data.userId, username: data.username, role: data.role };
        this.renderLoggedIn(state.currentUser);
        showAlert({ title: 'Bienvenido', message: `Has entrado a la taberna, ${username}.`, icon: '🍻', type: 'success' });
        if (window.app && window.app.reloadUserData) window.app.reloadUserData();
      } else {
        showAlert({ title: 'Error', message: data.error || 'Credenciales inválidas', type: 'danger' });
      }
    } catch(e) {
      showAlert({ title: 'Error', message: 'No se pudo conectar', type: 'danger' });
    }
  },

  async register(username, password) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (data.success) {
        showAlert({ title: 'Registrado', message: 'Personaje creado. Ahora inicia sesión.', icon: '📜', type: 'success' });
        this.showLoginModal();
      } else {
        showAlert({ title: 'Error', message: data.error || 'Error al registrar', type: 'danger' });
      }
    } catch(e) {
      showAlert({ title: 'Error', message: 'No se pudo conectar', type: 'danger' });
    }
  },

  logout(showMsg = true) {
    this.token = null;
    localStorage.removeItem('dnd_token');
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
    
    // Ocultar UI principal hasta que inicie sesión
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

    // Forzar login
    this.showLoginModal();
  },

  renderLoggedIn(user) {
    const container = document.getElementById('auth-container');
    if (!container) return;
    
    const roleClass = user.role === 'admin' ? 'role-admin' : 'role-player';
    const roleName = user.role === 'admin' ? 'Dungeon Master' : 'Jugador';

    container.innerHTML = `
      <div class="user-profile-widget" style="display: flex; align-items: center; gap: 1rem;">
        <div style="font-weight: bold; color: var(--gold);">${user.username}</div>
        <button class="btn btn-secondary btn-sm" onclick="window.authUI.logout()">Salir</button>
      </div>
    `;

    // Mostrar UI Principal
    document.getElementById('main-layout').style.display = 'flex';

    if (window.app && window.app.openWelcomeScreen) {
      window.app.openWelcomeScreen();
    }
  },

  showLoginModal(isRegister = false) {
    const html = `
      <div class="auth-modal" style="margin: 0 auto;">
        <h2 class="auth-title">${isRegister ? 'Unirse a la Campaña' : 'Identificarse'}</h2>
        <input type="text" id="auth-username" class="auth-input" placeholder="Nombre de usuario" autocomplete="off"/>
        <input type="password" id="auth-password" class="auth-input" placeholder="Contraseña" autocomplete="off"/>
        
        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
          <button class="btn btn-primary" style="flex:1" onclick="window.authUI.${isRegister ? 'submitRegister' : 'submitLogin'}()">${isRegister ? 'Registrar' : 'Entrar'}</button>
          <button class="btn btn-secondary" onclick="window.authUI.closeModal()">Cancelar</button>
        </div>
        
        <div style="margin-top: 1.5rem; font-size: 0.9em; color: var(--text-muted);">
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
    const user = document.getElementById('auth-username').value;
    const pass = document.getElementById('auth-password').value;
    if (user && pass) {
      this.closeModal();
      this.login(user, pass);
    }
  },

  submitRegister() {
    const user = document.getElementById('auth-username').value;
    const pass = document.getElementById('auth-password').value;
    if (user && pass) {
      this.closeModal();
      this.register(user, pass);
    }
  }
};

window.authUI = authUI;
