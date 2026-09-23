const fs = require('fs');
const path = require('path');
const { dbAsync } = require('./database');

async function migrate() {
  const jsonPath = path.join(__dirname, '../storage/characters.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        console.log(`Encontrados ${data.length} personajes en JSON. Migrando a SQLite...`);
        for (const char of data) {
          // check if exists
          const existing = await dbAsync.get('SELECT id FROM characters WHERE id = ?', [char.id]);
          if (!existing) {
            await dbAsync.run(
              'INSERT INTO characters (id, user_id, name, data) VALUES (?, ?, ?, ?)',
              [char.id, char.userId || null, char.name || 'Sin Nombre', JSON.stringify(char)]
            );
          }
        }
        console.log('Migración completada. Renombrando characters.json a characters.json.bak');
        fs.renameSync(jsonPath, jsonPath + '.bak');
      } else {
        console.log('No hay personajes en characters.json para migrar.');
      }
    } catch (e) {
      console.error('Error durante la migración:', e);
    }
  } else {
    console.log('characters.json no existe. No es necesario migrar.');
  }
}

migrate();
