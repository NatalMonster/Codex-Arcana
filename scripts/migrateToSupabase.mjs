import sqlite3 from 'sqlite3';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../src/storage/dnd_database.sqlite');
const db = new sqlite3.Database(DB_PATH);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Wrapper para promesas
const dbAll = (sql) => {
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function migrate() {
  console.log('--- Iniciando Migracion de SQLite a Supabase ---');

  try {
    // 1. Usuarios
    const users = await dbAll('SELECT * FROM users');
    console.log(`Migrando ${users.length} usuarios...`);
    for (let u of users) {
      const { error } = await supabase.from('users').upsert(u);
      if (error) console.error('Error migrando usuario:', u.username, error.message);
    }

    // 2. Sesiones
    const sessions = await dbAll('SELECT * FROM sessions');
    console.log(`Migrando ${sessions.length} sesiones...`);
    for (let s of sessions) {
      const { error } = await supabase.from('sessions').upsert(s);
      if (error) console.error('Error migrando sesion:', error.message);
    }

    // 3. Personajes
    const characters = await dbAll('SELECT * FROM characters');
    console.log(`Migrando ${characters.length} personajes...`);
    for (let c of characters) {
      // Parsear el string JSON a objeto para que Supabase lo guarde correctamente como JSONB
      let parsedData = {};
      try {
        parsedData = JSON.parse(c.data);
      } catch (e) {
        console.error('Error parseando JSON del personaje', c.id);
        parsedData = { raw: c.data };
      }
      
      const supaChar = {
        id: c.id,
        user_id: c.user_id,
        name: c.name,
        data: parsedData,
        created_at: c.created_at,
        updated_at: c.updated_at
      };
      const { error } = await supabase.from('characters').upsert(supaChar);
      if (error) console.error('Error migrando personaje:', c.name, error.message);
    }

    // 4. Campañas
    const campaigns = await dbAll('SELECT * FROM campaigns');
    console.log(`Migrando ${campaigns.length} campañas...`);
    for (let camp of campaigns) {
      const { error } = await supabase.from('campaigns').upsert(camp);
      if (error) console.error('Error migrando campaña:', camp.name, error.message);
    }

    // 5. Jugadores de Campaña
    const campaignPlayers = await dbAll('SELECT * FROM campaign_players');
    console.log(`Migrando ${campaignPlayers.length} relaciones de jugadores de campaña...`);
    for (let cp of campaignPlayers) {
      const { error } = await supabase.from('campaign_players').upsert(cp);
      if (error) console.error('Error migrando relacion jugador-campaña:', error.message);
    }

    console.log('--- Migracion Finalizada Exitosamente ---');
  } catch (err) {
    console.error('Error crítico durante la migración:', err);
  } finally {
    db.close();
  }
}

migrate();
