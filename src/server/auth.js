const express = require('express');
const crypto = require('crypto');
const { dbAsync } = require('./database');

const router = express.Router();

// Función de hash simple y segura (PBKDF2)
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

// Registro de usuario
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username y password son requeridos' });
    }

    // Comprobar si ya existe
    const existing = await dbAsync.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    // Si es el primer usuario, darle rol de admin
    const countRow = await dbAsync.get('SELECT COUNT(*) as count FROM users');
    const isFirstUser = countRow.count === 0;
    const role = isFirstUser || username.toLowerCase() === 'admin' ? 'admin' : 'player';

    const { hash, salt } = hashPassword(password);
    const userId = 'usr_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
    
    await dbAsync.run(
      'INSERT INTO users (id, username, hash, salt, role) VALUES (?, ?, ?, ?, ?)',
      [userId, username, hash, salt, role]
    );

    res.status(201).json({ success: true, message: 'Usuario registrado', userId, role });
  } catch (err) {
    console.error('Error in register:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Login de usuario
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await dbAsync.get('SELECT id, username, hash, salt, role FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const { hash } = hashPassword(password, user.salt);
    if (hash !== user.hash) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 días

    await dbAsync.run(
      'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
      [token, user.id, expiresAt]
    );

    res.json({ success: true, token, username: user.username, userId: user.id, role: user.role });
  } catch (err) {
    console.error('Error in login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Middleware de autenticación
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato "Bearer TOKEN"

    if (!token) return res.status(401).json({ error: 'Token requerido' });

    const session = await dbAsync.get('SELECT user_id, expires_at FROM sessions WHERE token = ?', [token]);
    if (!session) return res.status(403).json({ error: 'Token inválido' });

    if (new Date(session.expires_at) < new Date()) {
      await dbAsync.run('DELETE FROM sessions WHERE token = ?', [token]);
      return res.status(403).json({ error: 'Token expirado' });
    }

    const user = await dbAsync.get('SELECT id, username, role FROM users WHERE id = ?', [session.user_id]);
    if (!user) return res.status(403).json({ error: 'Usuario no encontrado' });

    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Error de autenticación' });
  }
}

// Obtener usuario actual
router.get('/me', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader.split(' ')[1];
    
    await dbAsync.run('DELETE FROM sessions WHERE token = ?', [token]);
    res.json({ success: true, message: 'Logout exitoso' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cerrar sesión' });
  }
});

// Middleware de autenticación opcional
async function optionalAuthenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return next();

    const session = await dbAsync.get('SELECT user_id, expires_at FROM sessions WHERE token = ?', [token]);
    if (!session || new Date(session.expires_at) < new Date()) return next();

    const user = await dbAsync.get('SELECT id, username, role FROM users WHERE id = ?', [session.user_id]);
    if (user) req.user = { id: user.id, username: user.username, role: user.role };
    
    next();
  } catch (err) {
    next();
  }
}

module.exports = { authRouter: router, authenticateToken, optionalAuthenticateToken };
