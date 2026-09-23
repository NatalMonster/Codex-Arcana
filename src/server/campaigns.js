const express = require('express');
const crypto = require('crypto');
const { dbAsync } = require('./database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Helper para generar código de 6 letras
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 1. Crear Campaña (Solo DM)
router.post('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo el Dungeon Master puede crear campañas' });
    }

    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre de la campaña es requerido' });

    const id = 'camp_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
    let inviteCode = generateInviteCode();
    
    // Ensure unique invite code (simple retry loop)
    let isUnique = false;
    for(let i = 0; i < 5; i++) {
      const existing = await dbAsync.get('SELECT id FROM campaigns WHERE invite_code = ?', [inviteCode]);
      if (!existing) { isUnique = true; break; }
      inviteCode = generateInviteCode();
    }

    if (!isUnique) return res.status(500).json({ error: 'Error generando código único' });

    await dbAsync.run(
      'INSERT INTO campaigns (id, name, dm_id, invite_code) VALUES (?, ?, ?, ?)',
      [id, name, req.user.id, inviteCode]
    );

    res.status(201).json({ success: true, campaign: { id, name, inviteCode } });
  } catch (err) {
    console.error('Error creating campaign', err);
    res.status(500).json({ error: 'Error al crear la campaña' });
  }
});

// 2. Unirse a una campaña con código (Jugadores)
router.post('/join', authenticateToken, async (req, res) => {
  try {
    let { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Código de invitación requerido' });
    
    code = code.trim().toUpperCase();

    const campaign = await dbAsync.get('SELECT id, name FROM campaigns WHERE invite_code = ?', [code]);
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada o código inválido' });

    // Check if already joined
    const joined = await dbAsync.get('SELECT * FROM campaign_players WHERE campaign_id = ? AND user_id = ?', [campaign.id, req.user.id]);
    if (joined) return res.status(400).json({ error: 'Ya estás en esta campaña' });

    await dbAsync.run(
      'INSERT INTO campaign_players (campaign_id, user_id) VALUES (?, ?)',
      [campaign.id, req.user.id]
    );

    res.json({ success: true, message: `Te has unido a ${campaign.name}`, campaign });
  } catch (err) {
    console.error('Error joining campaign', err);
    res.status(500).json({ error: 'Error al unirse' });
  }
});

// 3. Obtener campañas del usuario actual (DM o Jugador)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let campaigns = [];
    if (req.user.role === 'admin') {
      campaigns = await dbAsync.all('SELECT id, name, invite_code FROM campaigns WHERE dm_id = ?', [req.user.id]);
    } else {
      campaigns = await dbAsync.all(`
        SELECT c.id, c.name, c.invite_code 
        FROM campaigns c
        JOIN campaign_players cp ON c.id = cp.campaign_id
        WHERE cp.user_id = ?
      `, [req.user.id]);
    }
    res.json({ success: true, campaigns });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener campañas' });
  }
});

// 4. Asignar un personaje a la campaña (Jugador)
router.post('/:campaignId/character', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.body;
    const { campaignId } = req.params;

    // Verificar que el jugador está en la campaña
    const joined = await dbAsync.get('SELECT * FROM campaign_players WHERE campaign_id = ? AND user_id = ?', [campaignId, req.user.id]);
    if (!joined) return res.status(403).json({ error: 'No perteneces a esta campaña' });

    // Verificar que el personaje le pertenece
    const char = await dbAsync.get('SELECT id FROM characters WHERE id = ? AND user_id = ?', [characterId, req.user.id]);
    if (!char) return res.status(403).json({ error: 'Personaje no encontrado o no te pertenece' });

    await dbAsync.run(
      'UPDATE campaign_players SET character_id = ? WHERE campaign_id = ? AND user_id = ?',
      [characterId, campaignId, req.user.id]
    );

    res.json({ success: true, message: 'Personaje asignado a la mesa' });
  } catch (err) {
    res.status(500).json({ error: 'Error al asignar personaje' });
  }
});

// 5. Obtener personajes activos en la campaña (Para el DM y Jugadores)
router.get('/:campaignId/players', authenticateToken, async (req, res) => {
  try {
    const players = await dbAsync.all(`
      SELECT u.username, c.name as character_name, c.data as character_data
      FROM campaign_players cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN characters c ON cp.character_id = c.id
      WHERE cp.campaign_id = ?
    `, [req.params.campaignId]);
    
    // Parse JSON data
    const results = players.map(p => ({
      username: p.username,
      character: p.character_data ? JSON.parse(p.character_data) : null
    }));

    res.json({ success: true, players: results });
  } catch(err) {
    res.status(500).json({ error: 'Error al obtener jugadores' });
  }
});

module.exports = { campaignsRouter: router };
