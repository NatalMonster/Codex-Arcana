const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const { authRouter, authenticateToken, optionalAuthenticateToken } = require('./auth');
const { campaignsRouter } = require('./campaigns');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = 3000;

const DATA_DIR = path.join(__dirname, '../../data');
const ENGINE_DIR = path.join(__dirname, '../engine');
const PUBLIC_DIR = path.join(__dirname, '../../public');

// Middlewares de seguridad y parseo
app.use(helmet({
  contentSecurityPolicy: false, 
}));
app.use(cors()); 
app.use(express.json({ limit: '1mb' })); 

// Montar rutas
app.use('/api/auth', authRouter);
app.use('/api/campaigns', campaignsRouter);

// --- Socket.io Setup ---
io.on('connection', (socket) => {
  console.log('Un aventurero se ha conectado al VTT:', socket.id);

  // Unirse a la sala de una campaña
  socket.on('join_campaign', (campaignId) => {
    socket.join(campaignId);
    console.log(`Socket ${socket.id} se unió a la campaña ${campaignId}`);
  });

  // Escuchar actualización de vida y retransmitir a la sala
  socket.on('character_hp_update', (data) => {
    // data = { campaignId, characterId, hp }
    socket.to(data.campaignId).emit('character_hp_updated', data);
  });
  
  // Escuchar cuando alguien lanza dados
  socket.on('roll_dice', (data) => {
    // data = { campaignId, username, rollResult, description }
    socket.to(data.campaignId).emit('dice_rolled', data);
  });

  socket.on('disconnect', () => {
    console.log('Un aventurero se desconectó:', socket.id);
  });
});


function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    return null;
  }
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// API de Catálogo
app.get('/api/data', (req, res) => {
  const catalog = {
    rules: loadJson(path.join(DATA_DIR, 'rules.json')),
    classes: loadJson(path.join(DATA_DIR, 'classes.json')),
    subclasses: loadJson(path.join(DATA_DIR, 'subclasses.json')),
    species: loadJson(path.join(DATA_DIR, 'species.json')),
    backgrounds: loadJson(path.join(DATA_DIR, 'backgrounds.json')),
    feats: loadJson(path.join(DATA_DIR, 'feats.json')),
    spells: loadJson(path.join(DATA_DIR, 'spells.json')),
    spellsDatabase: loadJson(path.join(DATA_DIR, 'spells_database.json')),
    equipment: loadJson(path.join(DATA_DIR, 'equipment.json')),
    languages: loadJson(path.join(DATA_DIR, 'languages.json'))
  };
  res.json(catalog);
});

// API de Catálogo Dungeon Master
app.get('/api/dm-data', (req, res) => {
  const dmCatalog = {
    monsters: loadJson(path.join(DATA_DIR, 'monsters.json')) || []
  };
  res.json(dmCatalog);
});

const { dbAsync } = require('./database');

app.get('/api/dm-session', async (req, res) => {
  try {
    const row = await dbAsync.get('SELECT value FROM key_value_store WHERE key = ?', ['dm_session']);
    if (row) {
      res.json(JSON.parse(row.value));
    } else {
      res.json({ activeMonsters: [] });
    }
  } catch (err) {
    res.json({ activeMonsters: [] });
  }
});

app.put('/api/dm-session', async (req, res) => {
  try {
    const value = JSON.stringify(req.body);
    await dbAsync.run(
      'INSERT INTO key_value_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ['dm_session', value]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Error guardando sesión del DM' });
  }
});

// API de Personajes
app.get('/api/characters', optionalAuthenticateToken, async (req, res) => {
  try {
    const rows = await dbAsync.all('SELECT * FROM characters');
    const allChars = rows.map(r => {
      const char = JSON.parse(r.data);
      char.userId = r.user_id; // Add back userId for the frontend
      return char;
    });
    // Opcional: filtrar si se desea que un jugador solo vea los suyos
    res.json(allChars);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener personajes' });
  }
});

app.post('/api/characters', optionalAuthenticateToken, async (req, res) => {
  try {
    const newChar = req.body;
    let userId = req.user ? req.user.id : null;
    
    // Check if character already exists
    if (newChar.id) {
      const existing = await dbAsync.get('SELECT * FROM characters WHERE id = ?', [newChar.id]);
      if (existing) {
        if (existing.user_id && req.user && existing.user_id !== req.user.id) {
          return res.status(403).json({ error: 'No tienes permiso para editar este personaje' });
        }
        await dbAsync.run(
          'UPDATE characters SET name = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newChar.name || 'Sin Nombre', JSON.stringify(newChar), newChar.id]
        );
        return res.status(201).json({ success: true, character: newChar });
      }
    } else {
      newChar.id = 'char_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
    }

    if (req.user) {
      newChar.userId = userId;
    }

    await dbAsync.run(
      'INSERT INTO characters (id, user_id, name, data) VALUES (?, ?, ?, ?)',
      [newChar.id, userId, newChar.name || 'Sin Nombre', JSON.stringify(newChar)]
    );
    res.status(201).json({ success: true, character: newChar });
  } catch (e) {
    res.status(400).json({ error: 'Error procesando solicitud: ' + e.message });
  }
});

app.post('/api/characters/:id/duplicate', optionalAuthenticateToken, async (req, res) => {
  try {
    const origRow = await dbAsync.get('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!origRow) {
      return res.status(404).json({ error: 'Personaje no encontrado' });
    }
    
    const clone = JSON.parse(origRow.data);
    clone.id = 'char_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
    clone.name = `${clone.name} (Copia)`;
    
    let userId = req.user ? req.user.id : null;
    if (userId) clone.userId = userId;
    else delete clone.userId;
    
    await dbAsync.run(
      'INSERT INTO characters (id, user_id, name, data) VALUES (?, ?, ?, ?)',
      [clone.id, userId, clone.name, JSON.stringify(clone)]
    );

    res.status(201).json({ success: true, character: clone });
  } catch (e) {
    res.status(500).json({ error: 'Error duplicando' });
  }
});

app.put('/api/characters/:id', optionalAuthenticateToken, async (req, res) => {
  try {
    const existing = await dbAsync.get('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Personaje no encontrado' });
    }
    
    if (existing.user_id && (!req.user || existing.user_id !== req.user.id)) {
      return res.status(403).json({ error: 'No tienes permiso para editar este personaje' });
    }

    // Merge existing data with updates
    const oldData = JSON.parse(existing.data);
    const updatedChar = { ...oldData, ...req.body };

    await dbAsync.run(
      'UPDATE characters SET name = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [updatedChar.name || 'Sin Nombre', JSON.stringify(updatedChar), req.params.id]
    );
    
    res.json({ success: true, character: updatedChar });
  } catch (e) {
    res.status(400).json({ error: 'Error procesando solicitud: ' + e.message });
  }
});

app.delete('/api/characters/:id', optionalAuthenticateToken, async (req, res) => {
  try {
    const existing = await dbAsync.get('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Personaje no encontrado' });
    }

    if (existing.user_id && (!req.user || existing.user_id !== req.user.id)) {
      return res.status(403).json({ error: 'No tienes permiso para borrar este personaje' });
    }

    await dbAsync.run('DELETE FROM characters WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error borrando personaje' });
  }
});

// ==========================================
// UNIFICACIÓN VITE + EXPRESS (UN SOLO PUERTO)
// ==========================================
(async () => {
  const isProd = process.env.NODE_ENV === 'production';
  
  if (!isProd) {
    // Modo Desarrollo: Vite maneja el frontend con Hot Reload en el mismo puerto 3000
    const vite = await import('vite');
    const viteServer = await vite.createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    
    // Dejar que Vite maneje todo lo que no sea /api/
    app.use(viteServer.middlewares);
  } else {
    // Modo Producción: Express sirve los archivos estáticos
    app.use('/src/engine', express.static(ENGINE_DIR));
    app.use('/data', express.static(DATA_DIR));
    app.use('/', express.static(path.join(__dirname, '../../'))); // Porque index.html está en root
    
    app.use((req, res) => {
      res.sendFile(path.join(__dirname, '../../index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Servidor Unificado D&D 2024 corriendo en un solo puerto`);
    console.log(`📡 VTT y Socket.io Activos`);
    console.log(`👉 Abre tu navegador en: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
})();
