const fs = require('fs');
const path = require('path');

/**
 * Base de datos ágil en formato JSON.
 * Mantiene los datos en memoria para accesos ultrarrápidos y los persiste en disco.
 */
class AgileDB {
  constructor(filename, defaultData = []) {
    this.filepath = path.resolve(__dirname, '../storage', filename);
    this.defaultData = defaultData;
    this.data = this.load();
  }

  load() {
    if (fs.existsSync(this.filepath)) {
      try {
        const fileContent = fs.readFileSync(this.filepath, 'utf-8');
        return JSON.parse(fileContent);
      } catch (err) {
        console.error(`Error leyendo ${this.filepath}:`, err);
        return this.defaultData;
      }
    }
    // Si no existe, lo crea con la data por defecto
    this.save(this.defaultData);
    return this.defaultData;
  }

  save(dataToSave = this.data) {
    // Se puede implementar un "debounce" aquí si hay muchas escrituras concurrentes
    fs.writeFileSync(this.filepath, JSON.stringify(dataToSave, null, 2), 'utf-8');
  }

  // ---- Métodos estilo NoSQL ----

  // Obtener todo
  getAll() {
    return this.data;
  }

  // Buscar varios (ej: db.find({ class: "Mago" }))
  find(query) {
    if (Array.isArray(this.data)) {
      return this.data.filter(item => {
        for (let key in query) {
          if (item[key] !== query[key]) return false;
        }
        return true;
      });
    }
    return null;
  }

  // Buscar uno por ID o query
  findOne(query) {
    if (typeof query === 'string') {
      query = { id: query };
    }
    const results = this.find(query);
    return results && results.length > 0 ? results[0] : null;
  }

  // Insertar
  insert(item) {
    if (!item.id) {
      item.id = 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
    }
    item.createdAt = new Date().toISOString();
    item.updatedAt = item.createdAt;
    
    if (Array.isArray(this.data)) {
      this.data.push(item);
    } else {
      this.data = item; // Para objetos únicos como dm_session
    }
    
    this.save();
    return item;
  }

  // Actualizar por ID (solo funciona si la data es un Array)
  update(id, updates) {
    if (!Array.isArray(this.data)) return null;
    
    const idx = this.data.findIndex(item => item.id === id);
    if (idx === -1) return null;
    
    this.data[idx] = { 
      ...this.data[idx], 
      ...updates, 
      updatedAt: new Date().toISOString() 
    };
    
    this.save();
    return this.data[idx];
  }

  // Sobrescribir (útil para objetos únicos en lugar de Arrays)
  set(data) {
    this.data = data;
    this.save();
    return this.data;
  }

  // Eliminar por ID
  delete(id) {
    if (!Array.isArray(this.data)) return false;
    
    const initialLength = this.data.length;
    this.data = this.data.filter(item => item.id !== id);
    
    if (this.data.length !== initialLength) {
      this.save();
      return true;
    }
    return false;
  }
}

module.exports = AgileDB;
