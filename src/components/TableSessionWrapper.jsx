import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CharacterSheetWrapper from './CharacterSheetWrapper.jsx';
import { apiFetch } from '../js/app.js';
import { state } from '../js/state.js';
import { buildInitialInventory, renderCharacterSheetView } from '../js/characterSheetView.js';

export default function TableSessionWrapper({ campaignId, myCharacterId, tick }) {
  const [players, setPlayers] = useState([]);
  const [viewingPlayer, setViewingPlayer] = useState(null); // Full character object
  const dmSheetRef = useRef(null);
  
  useEffect(() => {
    const fetchPlayers = async () => {
      if (!campaignId) return;
      try {
        const res = await apiFetch(`/api/campaigns/${campaignId}/players`);
        const data = await res.json();
        setPlayers(data.players || []);
      } catch(e) {
        console.error(e);
      }
    };
    fetchPlayers();
    
    const handleUpdate = (e) => { 
      console.log('React caught character_hp_updated', e.detail);
      fetchPlayers(); 
    };
    
    window.addEventListener('supabase_character_hp_updated', handleUpdate);
    
    return () => {
      window.removeEventListener('supabase_character_hp_updated', handleUpdate);
    }
  }, [campaignId, tick]);

  useEffect(() => {
    if (viewingPlayer && dmSheetRef.current) {
      renderCharacterSheetView(dmSheetRef.current, viewingPlayer.id, viewingPlayer);
    }
  }, [viewingPlayer, players, tick]);
  
  const otherPlayers = players.filter(p => p.character && p.character.id !== myCharacterId);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Top Bar for other players (Players Only) */}
      {myCharacterId && (
        <div style={{ display: 'flex', overflowX: 'auto', gap: '1rem', padding: '1rem', background: 'var(--bg-card)', borderBottom: '2px solid var(--gold)', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => { window.campaignUI.viewCampaign(campaignId); }}
            style={{ whiteSpace: 'nowrap' }}
          >
            &larr; Volver
          </button>

          {otherPlayers.map(p => {
          const maxHp = p.character.calculatedStats?.maxHp || '?';
          const hp = p.character.currentHp !== undefined ? p.character.currentHp : maxHp;
          return (
            <div key={p.username} style={{ minWidth: '220px', background: 'var(--bg-main)', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ color: 'var(--gold-light)', margin: 0, fontSize: '1.1rem' }}>{p.character.name}</h4>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.username}</div>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.character.className} (Niv. {p.character.level})</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                <div style={{ color: 'var(--crimson)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                  HP: {hp} / {maxHp}
                </div>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} 
                  onClick={() => {
                    let inv = p.character.inventory;
                    if (!inv || !Array.isArray(inv)) {
                      inv = buildInitialInventory(p.character, state.catalogs);
                    }
                    const gold = p.character.gold || 0;
                    const silver = p.character.silver || 0;
                    const copper = p.character.copper || 0;
                    
                    let html = `<div style="margin-bottom: 1rem; color: var(--gold); font-weight: bold; font-size: 1.1rem; text-align: center;">
                      💰 ${gold} po | ${silver} pp | ${copper} pc
                    </div>`;

                    if (inv.length === 0) {
                      html += `<p style="color:var(--text-muted); text-align:center;">El inventario está vacío.</p>`;
                    } else {
                      html += `<ul style="list-style: none; padding: 0; margin: 0; max-height: 50vh; overflow-y: auto;">`;
                      inv.forEach(item => {
                        const equippedBadge = item.equipped ? `<span style="background:var(--gold); color:#000; font-size:0.65rem; padding:0.1rem 0.3rem; border-radius:4px; margin-left:0.5rem;">Equipado</span>` : '';
                        const itemQty = item.quantity || 1;
                        const qtyStr = itemQty > 1 ? `<span style="color:var(--gold); font-size:0.9rem; margin-left: 0.4rem;">(x${itemQty})</span>` : '';
                        
                        let shortDesc = item.type || item.category || '';
                        if (item.damage) {
                          shortDesc += ` (${item.damage})`;
                        }
                        if (!shortDesc) shortDesc = 'Objeto';
                        
                        html += `
                          <li style="margin-bottom: 0.5rem; background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 4px; padding: 0.5rem;">
                            <details>
                              <summary style="cursor: pointer; color: var(--gold-light); font-weight: bold; user-select: none; list-style: none; display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center;">
                                  ${item.name} ${qtyStr} ${equippedBadge}
                                </div>
                                <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal; text-align:right; margin-left:1rem;">${shortDesc} ▼</span>
                              </summary>
                              <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-main); border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
                                ${item.type ? `<div><strong>Tipo:</strong> ${item.type}</div>` : ''}
                                ${item.damage ? `<div><strong>Daño:</strong> ${item.damage}</div>` : ''}
                                ${item.property ? `<div><strong>Propiedades:</strong> ${item.property}</div>` : ''}
                                ${item.desc ? `<div>${item.desc.replace(/\\n/g, '<br>')}</div>` : ''}
                                ${!item.type && !item.damage && !item.property && !item.desc ? '<div style="color:var(--text-muted)">Sin descripción adicional.</div>' : ''}
                              </div>
                            </details>
                          </li>
                        `;
                      });
                      html += `</ul>`;
                    }

                    window.app.showAlert({ 
                      title: `🎒 Inventario de ${p.character.name}`, 
                      messageHtml: html 
                    });
                  }}
                >
                  Inventario
                </button>
              </div>
            </div>
          );
        })}
        {otherPlayers.length === 0 && (
           <div style={{ color: 'var(--text-muted)', marginLeft: '1rem' }}>No hay otros héroes en la mesa aún.</div>
        )}
      </div>
      )}
      
      {/* Main Character Sheet */}
      {myCharacterId ? (
        <div style={{ marginTop: '0rem' }}>
          <CharacterSheetWrapper characterId={myCharacterId} tick={tick} />
        </div>
      ) : (
        <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <h2 style={{ color: 'var(--gold)', margin: 0 }}>
              👑 Panel del Dungeon Master
            </h2>
            <button 
              className="btn btn-secondary" 
              onClick={() => { window.campaignUI.viewCampaign(campaignId); }}
            >
              &larr; Volver
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {otherPlayers.map(p => {
              const c = p.character;
              const stats = c.calculatedStats || {};
              const maxHp = stats.maxHp || '?';
              const hp = c.currentHp !== undefined ? c.currentHp : maxHp;
              const ac = stats.ac || '?';
              const pp = stats.passivePerception || '?';
              
              const abs = stats.abilities || {};
              const getScoreAndMod = (val) => {
                const score = (typeof val === 'object' && val !== null) ? (val.score || 10) : (val || 10);
                const m = Math.floor((score - 10) / 2);
                const modStr = m >= 0 ? `+${m}` : m;
                return { score, modStr };
              };

              return (
                <div key={p.username} style={{ background: 'var(--bg-main)', border: '1px solid var(--gold)', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                  {/* Header */}
                  <div style={{ background: 'var(--bg-card)', padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, color: 'var(--gold-light)', fontSize: '1.3rem' }}>{c.name}</h3>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{c.className} Niv. {c.level} | {c.speciesName}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Jugador</div>
                      <div style={{ fontWeight: 'bold' }}>{p.username}</div>
                    </div>
                  </div>
                  
                  {/* Stats Grid */}
                  <div style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Vida</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: hp <= maxHp / 2 ? 'var(--crimson)' : 'var(--text-main)' }}>
                          {hp} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ {maxHp}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Armadura</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#60a5fa' }}>🛡️ {ac}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Percepción P.</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#a78bfa' }}>👁️ {pp}</div>
                      </div>
                    </div>

                    {/* Attributes */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px', textAlign: 'center', marginBottom: '1rem' }}>
                      {[
                        { label: 'FUE', data: getScoreAndMod(abs.fuerza) },
                        { label: 'DES', data: getScoreAndMod(abs.destreza) },
                        { label: 'CON', data: getScoreAndMod(abs.constitucion) },
                        { label: 'INT', data: getScoreAndMod(abs.inteligencia) },
                        { label: 'SAB', data: getScoreAndMod(abs.sabiduria) },
                        { label: 'CAR', data: getScoreAndMod(abs.carisma) }
                      ].map(attr => (
                        <div key={attr.label} style={{ background: 'var(--bg-main)', padding: '0.3rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>{attr.label}</div>
                          <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--gold-light)' }}>
                            {attr.data.score} <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 'normal' }}>({attr.data.modStr})</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => setViewingPlayer(c)}
                      >
                        📄 Ver Hoja
                      </button>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          let inv = c.inventory;
                          if (!inv || !Array.isArray(inv)) {
                            inv = buildInitialInventory(c, state.catalogs);
                          }
                          const gold = c.gold || 0;
                          const silver = c.silver || 0;
                          const copper = c.copper || 0;
                          
                          let html = `<div style="margin-bottom: 1rem; color: var(--gold); font-weight: bold; font-size: 1.1rem; text-align: center;">
                            💰 ${gold} po | ${silver} pp | ${copper} pc
                          </div>`;

                          if (inv.length === 0) {
                            html += `<p style="color:var(--text-muted); text-align:center;">El inventario está vacío.</p>`;
                          } else {
                            html += `<ul style="list-style: none; padding: 0; margin: 0; max-height: 50vh; overflow-y: auto;">`;
                            inv.forEach(item => {
                              const equippedBadge = item.equipped ? `<span style="background:var(--gold); color:#000; font-size:0.65rem; padding:0.1rem 0.3rem; border-radius:4px; margin-left:0.5rem;">Equipado</span>` : '';
                              const itemQty = item.quantity || 1;
                              const qtyStr = itemQty > 1 ? `<span style="color:var(--gold); font-size:0.9rem; margin-left: 0.4rem;">(x${itemQty})</span>` : '';
                              
                              let shortDesc = item.type || item.category || '';
                              if (item.damage) shortDesc += ` (${item.damage})`;
                              if (!shortDesc) shortDesc = 'Objeto';
                              
                              html += `
                                <li style="margin-bottom: 0.5rem; background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 4px; padding: 0.5rem;">
                                  <details>
                                    <summary style="cursor: pointer; color: var(--gold-light); font-weight: bold; user-select: none; list-style: none; display: flex; align-items: center; justify-content: space-between;">
                                      <div style="display: flex; align-items: center;">
                                        ${item.name} ${qtyStr} ${equippedBadge}
                                      </div>
                                      <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal; text-align:right; margin-left:1rem;">${shortDesc} ▼</span>
                                    </summary>
                                    <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-main); border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
                                      ${item.type ? `<div><strong>Tipo:</strong> ${item.type}</div>` : ''}
                                      ${item.damage ? `<div><strong>Daño:</strong> ${item.damage}</div>` : ''}
                                      ${item.property ? `<div><strong>Propiedades:</strong> ${item.property}</div>` : ''}
                                      ${item.desc ? `<div style="margin-top:0.3rem; font-style:italic;">${item.desc}</div>` : ''}
                                    </div>
                                  </details>
                                </li>
                              `;
                            });
                            html += `</ul>`;
                          }
                          window.app.showAlert({ title: `🎒 Inventario de ${c.name}`, messageHtml: html });
                        }}
                      >
                        Ver Inventario
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {otherPlayers.length === 0 && (
               <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                 <p>No hay héroes en la mesa aún. Cuando los jugadores asignen personajes, aparecerán aquí.</p>
               </div>
            )}
          </div>
        </div>
      )}
      
      {/* DM Full Sheet Modal */}
      <AnimatePresence>
        {viewingPlayer && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
              background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', flexDirection: 'column',
              padding: '2rem', overflowY: 'auto'
            }}
          >
            <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', background: 'var(--bg-main)', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', padding: '1rem', position: 'relative', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: 'var(--gold)' }}>
                  Hoja de {viewingPlayer.name} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(Modo Lectura - Dungeon Master)</span>
                </h3>
                <button className="btn btn-secondary" onClick={() => setViewingPlayer(null)}>
                  Cerrar
                </button>
              </div>
              <div ref={dmSheetRef} style={{ width: '100%' }} className="dm-readonly-sheet" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`
        /* Bloquear inputs y selects */
        .dm-readonly-sheet input,
        .dm-readonly-sheet select,
        .dm-readonly-sheet textarea {
          pointer-events: none !important;
        }
        
        /* Bloquear botones de sumar/restar vida */
        .dm-readonly-sheet .btn-dmg,
        .dm-readonly-sheet .btn-heal,
        .dm-readonly-sheet .mhp-btn,
        .dm-readonly-sheet .death-save-box input {
          pointer-events: none !important;
          opacity: 0.5;
        }

        /* Ocultar barra superior de acciones (Descansos, Exportar) */
        .dm-readonly-sheet .sheet-quick-actions {
          display: none !important;
        }
        /* Ocultar los botones de descanso en móvil */
        .dm-readonly-sheet .mrest-btn {
          display: none !important;
        }

        /* Ocultar botones de "Tirar Salvación/Habilidad" explícitos */
        .dm-readonly-sheet .btn-roll-save,
        .dm-readonly-sheet .btn-roll-mini {
          display: none !important;
        }

        /* Convertir los botones de ataque y daño en texto plano sin poder hacer clic */
        .dm-readonly-sheet .beyond-btn-hit,
        .dm-readonly-sheet .beyond-btn-dmg,
        .dm-readonly-sheet .save-row,
        .dm-readonly-sheet .skill-row {
          pointer-events: none !important;
        }

        .dm-readonly-sheet .beyond-btn-hit,
        .dm-readonly-sheet .beyond-btn-dmg {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          color: var(--text-main) !important;
          padding: 0 !important;
        }

        /* Ocultar el botón de LANZAR hechizos (el primero es lanzar, el segundo es info) */
        .dm-readonly-sheet .spell-item-header button.btn-primary {
          display: none !important;
        }
        
        /* Ocultar el widget de dados flotante si está dentro del contenedor (por si acaso) */
        .dm-readonly-sheet #dice-widget {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
