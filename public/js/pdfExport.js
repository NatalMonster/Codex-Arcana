/**
 * Módulo de Exportación a PDF de Hoja de Personaje D&D 2024
 * Genera un documento estructurado de alta fidelidad para impresión y guardado como PDF vectorial.
 */

import { state } from './state.js';
import * as Rules from '/src/engine/rulesEngine.js';
import { getMasteryDetail } from './infoHelper.js';
import { showAlert } from './dialogModal.js';

export function exportCharacterToPDF(characterId) {
  const char = state.savedCharacters.find(c => c.id === characterId) || state.activeCharacter;
  if (!char) {
    showAlert({
      title: 'Personaje no Encontrado',
      icon: '⚠️',
      type: 'warning',
      message: 'No se pudo encontrar el personaje para exportar a PDF.'
    });
    return;
  }

  const classDef = state.catalogs.classes.find(c => c.id === char.classId) || {};
  const speciesDef = state.catalogs.species.find(s => s.id === char.speciesId) || {};
  const bgDef = state.catalogs.backgrounds.find(b => b.id === char.backgroundId) || {};
  const allSkills = state.catalogs.rules.skills || [];
  const weaponsCatalog = state.catalogs.equipment.weapons || [];

  const abs = char.calculatedStats?.abilities || Rules.calculateFinalAbilities(char.baseAbilityScores || {}, char.backgroundAbilityBonus || {});
  const pb = Rules.calculateProficiencyBonus(char.level || 1);
  const ac = char.calculatedStats?.ac || 10;
  const maxHp = char.calculatedStats?.maxHp || 10;
  const currentHp = typeof char.currentHp === 'number' ? char.currentHp : maxHp;
  const init = char.calculatedStats?.initiative || 0;
  const speed = speciesDef.speed || 9;
  const passivePerc = char.calculatedStats?.passivePerception || 10;
  const spellStats = char.calculatedStats?.spellcasting;

  const inventory = Array.isArray(char.inventory) ? char.inventory : [];
  const equipped = inventory.filter(i => i.equipped);
  const backpack = inventory.filter(i => !i.equipped);

  // Armas
  const weaponIds = Array.isArray(char.weaponMasteries) && char.weaponMasteries.length > 0
    ? char.weaponMasteries
    : ['daga'];

  const weapons = weaponIds.map(id => weaponsCatalog.find(w => w.id === id)).filter(Boolean);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showAlert({
      title: 'Ventana Bloqueada',
      icon: '⚠️',
      type: 'warning',
      message: 'El navegador bloqueó la ventana emergente para imprimir. Por favor, permite ventanas emergentes para generar el PDF.'
    });
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>${char.name} - Hoja de Personaje D&D 2024</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
          color: #1e293b;
          background: #fff;
          font-size: 9pt;
          line-height: 1.3;
        }
        .page {
          width: 100%;
          page-break-after: always;
        }
        .header-box {
          border: 2px solid #b45309;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fefce8;
        }
        .char-title {
          font-size: 18pt;
          font-weight: 800;
          color: #92400e;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 4px 12px;
          font-size: 8.5pt;
        }
        .meta-item strong {
          color: #78350f;
        }
        .layout-2col {
          display: grid;
          grid-template-columns: 210px 1fr;
          gap: 10px;
        }
        .block-card {
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 6px 8px;
          margin-bottom: 8px;
          background: #fff;
        }
        .block-title {
          font-size: 8.5pt;
          font-weight: 800;
          text-transform: uppercase;
          color: #92400e;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 3px;
          margin-bottom: 5px;
          letter-spacing: 0.5px;
        }
        .abilities-row {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 4px;
          text-align: center;
          margin-bottom: 8px;
        }
        .ab-card {
          border: 1.5px solid #92400e;
          border-radius: 5px;
          padding: 4px 2px;
          background: #fef3c7;
        }
        .ab-name {
          font-size: 7.5pt;
          font-weight: 800;
          color: #78350f;
          text-transform: uppercase;
        }
        .ab-mod {
          font-size: 14pt;
          font-weight: 900;
          color: #b45309;
        }
        .ab-score {
          font-size: 7.5pt;
          color: #475569;
          font-weight: bold;
        }
        .combat-row {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
          text-align: center;
          margin-bottom: 8px;
        }
        .combat-box {
          border: 1.5px solid #64748b;
          border-radius: 5px;
          padding: 6px 2px;
          background: #f8fafc;
        }
        .combat-val {
          font-size: 13pt;
          font-weight: 800;
          color: #0f172a;
        }
        .combat-lbl {
          font-size: 6.5pt;
          text-transform: uppercase;
          font-weight: 700;
          color: #64748b;
        }
        .skill-item, .save-item {
          display: flex;
          justify-content: space-between;
          font-size: 7.5pt;
          padding: 2px 0;
          border-bottom: 1px dotted #e2e8f0;
        }
        .skill-item:last-child, .save-item:last-child {
          border-bottom: none;
        }
        .dot {
          display: inline-block;
          width: 8px;
          text-align: center;
          font-weight: bold;
        }
        table.print-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8pt;
        }
        table.print-table th {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          padding: 4px;
          text-align: left;
          font-weight: 700;
          color: #334155;
        }
        table.print-table td {
          border: 1px solid #cbd5e1;
          padding: 3px 5px;
        }
        .print-btn-bar {
          text-align: center;
          padding: 12px;
          background: #0f172a;
          color: #fff;
          margin-bottom: 12px;
        }
        .btn-print {
          background: #f59e0b;
          color: #000;
          border: none;
          padding: 8px 18px;
          font-size: 11pt;
          font-weight: bold;
          border-radius: 4px;
          cursor: pointer;
        }
        @media print {
          .print-btn-bar {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-btn-bar">
        <button class="btn-print" onclick="window.print()">🖨️ IMPRIMIR / GUARDAR COMO PDF</button>
        <span style="margin-left: 15px; font-size: 9pt; color: #94a3b8;">(Selecciona "Guardar como PDF" en la ventana de impresión)</span>
      </div>

      <!-- PÁGINA 1: COMBATE, ESTADÍSTICAS, HABILIDADES Y ATAQUES -->
      <div class="page">
        <div class="header-box">
          <div>
            <div class="char-title">${char.name || 'Sin Nombre'}</div>
            <div style="font-size: 9pt; color: #78350f; font-weight: bold;">
              ${speciesDef.name || ''} • ${classDef.name || ''} Nivel ${char.level || 1} ${char.subclassId ? `(${char.subclassId})` : ''}
            </div>
          </div>
          <div class="meta-grid">
            <div class="meta-item"><strong>Trasfondo:</strong> ${char.backgroundName || ''}</div>
            <div class="meta-item"><strong>Alineamiento:</strong> ${char.alignment || ''}</div>
            <div class="meta-item"><strong>Tamaño:</strong> ${char.size || 'Mediano'}</div>
            <div class="meta-item"><strong>Bono Competencia:</strong> +${pb}</div>
          </div>
        </div>

        <!-- CARACTERÍSTICAS -->
        <div class="abilities-row">
          ${[
            { name: 'Fuerza', ab: 'FUE', d: abs.fuerza },
            { name: 'Destreza', ab: 'DES', d: abs.destreza },
            { name: 'Constitución', ab: 'CON', d: abs.constitucion },
            { name: 'Inteligencia', ab: 'INT', d: abs.inteligencia },
            { name: 'Sabiduría', ab: 'SAB', d: abs.sabiduria },
            { name: 'Carisma', ab: 'CAR', d: abs.carisma }
          ].map(a => `
            <div class="ab-card">
              <div class="ab-name">${a.ab}</div>
              <div class="ab-mod">${(a.d?.mod || 0) >= 0 ? '+' : ''}${a.d?.mod || 0}</div>
              <div class="ab-score">Valor: ${a.d?.score || 10}</div>
            </div>
          `).join('')}
        </div>

        <!-- COMBATE RESUMIDO -->
        <div class="combat-row">
          <div class="combat-box">
            <div class="combat-val">${ac}</div>
            <div class="combat-lbl">Clase de Armadura</div>
          </div>
          <div class="combat-box">
            <div class="combat-val">${init >= 0 ? '+' : ''}${init}</div>
            <div class="combat-lbl">Iniciativa</div>
          </div>
          <div class="combat-box">
            <div class="combat-val">${speed} m</div>
            <div class="combat-lbl">Velocidad</div>
          </div>
          <div class="combat-box">
            <div class="combat-val">${currentHp} / ${maxHp}</div>
            <div class="combat-lbl">Puntos de Golpe</div>
          </div>
          <div class="combat-box">
            <div class="combat-val">1d${classDef.hitDie || 8}</div>
            <div class="combat-lbl">Dados de Golpe</div>
          </div>
        </div>

        <div class="layout-2col">
          <!-- COLUMNA IZQUIERDA: SALVACIONES Y HABILIDADES -->
          <div>
            <div class="block-card">
              <div class="block-title">Tiradas de Salvación</div>
              ${[
                { id: 'fuerza', name: 'Fuerza', mod: abs.fuerza?.mod || 0 },
                { id: 'destreza', name: 'Destreza', mod: abs.destreza?.mod || 0 },
                { id: 'constitucion', name: 'Constitución', mod: abs.constitucion?.mod || 0 },
                { id: 'inteligencia', name: 'Inteligencia', mod: abs.inteligencia?.mod || 0 },
                { id: 'sabiduria', name: 'Sabiduría', mod: abs.sabiduria?.mod || 0 },
                { id: 'carisma', name: 'Carisma', mod: abs.carisma?.mod || 0 }
              ].map(s => {
                const isProf = (classDef.savingThrows || []).includes(s.id);
                const val = s.mod + (isProf ? pb : 0);
                return `
                  <div class="save-item">
                    <span><span class="dot">${isProf ? '●' : '○'}</span> ${s.name}</span>
                    <strong>${val >= 0 ? '+' : ''}${val}</strong>
                  </div>
                `;
              }).join('')}
            </div>

            <div class="block-card">
              <div class="block-title">Habilidades Oficiales</div>
              ${allSkills.map(sk => {
                const abMod = abs[sk.ability]?.mod || 0;
                const isProf = (char.classSkills || []).includes(sk.id) ||
                  ((bgDef.skills || []).includes(sk.id)) ||
                  (char.humanBonusSkill === sk.id);
                const hasExp = (char.expertise || []).includes(sk.id);
                let bonus = abMod;
                if (hasExp) bonus += (pb * 2);
                else if (isProf) bonus += pb;

                return `
                  <div class="skill-item">
                    <span><span class="dot">${hasExp ? '★' : isProf ? '●' : '○'}</span> ${sk.name} <small style="color: #64748b;">(${sk.ability.substring(0,3)})</small></span>
                    <strong>${bonus >= 0 ? '+' : ''}${bonus}</strong>
                  </div>
                `;
              }).join('')}
              <div style="font-size: 6.5pt; color: #64748b; margin-top: 4px;">● Competente | ★ Pericia (Doble)</div>
            </div>

            <div class="block-card">
              <div class="block-title">Sentidos e Idiomas</div>
              <p><strong>Percepción Pasiva:</strong> ${passivePerc}</p>
              <p style="margin-top: 3px;"><strong>Idiomas:</strong> ${(char.languages || []).join(', ')}</p>
              <p style="margin-top: 3px;"><strong>Herramientas:</strong> ${bgDef.toolName || 'Ninguna'}</p>
            </div>
          </div>

          <!-- COLUMNA DERECHA: ATAQUES, ACCIONES Y RASGOS PRINCIPALES -->
          <div>
            <div class="block-card">
              <div class="block-title">Ataques y Acciones con Armas</div>
              <table class="print-table">
                <thead>
                  <tr>
                    <th>Arma</th>
                    <th>Ataque</th>
                    <th>Daño y Tipo</th>
                    <th>Propiedades / Maestría</th>
                  </tr>
                </thead>
                <tbody>
                  ${weapons.map(w => {
                    const isFinesse = (w.properties || []).some(p => p.toLowerCase().includes('sutil'));
                    const isRanged = w.type === 'marcial' && (w.properties || []).some(p => p.toLowerCase().includes('distancia'));
                    const chosenMod = isRanged ? (abs.destreza?.mod || 0) : (isFinesse ? Math.max(abs.fuerza?.mod || 0, abs.destreza?.mod || 0) : (abs.fuerza?.mod || 0));
                    const atkBonus = chosenMod + pb;
                    const hasMastery = (char.weaponMasteries || []).includes(w.id);

                    return `
                      <tr>
                        <td><strong>${w.name}</strong></td>
                        <td><strong>${atkBonus >= 0 ? '+' : ''}${atkBonus}</strong></td>
                        <td>${w.damage} ${chosenMod >= 0 ? '+' : ''}${chosenMod} ${w.damageType}</td>
                        <td>${w.properties?.join(', ') || ''} ${hasMastery ? `<strong>[${w.mastery.toUpperCase()}]</strong>` : ''}</td>
                      </tr>
                    `;
                  }).join('')}
                  <tr>
                    <td><strong>Golpe Desarmado</strong></td>
                    <td><strong>+${(abs.fuerza?.mod || 0) + pb}</strong></td>
                    <td>${1 + (abs.fuerza?.mod || 0)} contundente</td>
                    <td>Ataque cuerpo a cuerpo básico</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="block-card">
              <div class="block-title">Rasgos de Clase y Linaje</div>
              <p><strong>Competencias:</strong> Armaduras: ${classDef.armorProficiencies?.join(', ') || 'Ninguna'}. Armas: ${classDef.weaponProficiencies?.join(', ') || 'Ninguna'}.</p>
              ${char.fightingStyle ? `<p style="margin-top: 3px;"><strong>Estilo de Combate:</strong> ${char.fightingStyle}</p>` : ''}
              ${char.holyOrder ? `<p style="margin-top: 3px;"><strong>Orden Sagrada:</strong> ${char.holyOrder.toUpperCase()}</p>` : ''}
              ${char.primalOrder ? `<p style="margin-top: 3px;"><strong>Orden Primigenia:</strong> ${char.primalOrder.toUpperCase()}</p>` : ''}
              ${(speciesDef.traits || []).map(t => `<p style="margin-top: 3px;"><strong>${t.name}:</strong> ${t.desc}</p>`).join('')}
            </div>

            <div class="block-card">
              <div class="block-title">Dotes de Origen (D&D 2024)</div>
              <p><strong>${bgDef.originFeatId?.toUpperCase() || 'Dote'}:</strong> Obtenida por trasfondo ${char.backgroundName}.</p>
              ${char.humanBonusOriginFeat ? `<p style="margin-top: 3px;"><strong>${char.humanBonusOriginFeat.toUpperCase()}:</strong> Obtenida por rasgo Versátil humano.</p>` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- PÁGINA 2: MAGIA, CONJUROS, EQUIPO E INVENTARIO -->
      <div class="page" style="margin-top: 20px;">
        <div class="header-box" style="margin-bottom: 10px;">
          <div>
            <div style="font-size: 14pt; font-weight: 800; color: #92400e;">${char.name} — Magia, Equipo e Inventario</div>
            <div style="font-size: 8.5pt; color: #78350f;">Manual del Jugador 2024 (5ª Edición Revisada)</div>
          </div>
          ${spellStats ? `
            <div style="display: flex; gap: 15px; font-size: 8.5pt;">
              <div><strong>Aptitud:</strong> ${spellStats.ability.toUpperCase()}</div>
              <div><strong>CD Salvación:</strong> ${spellStats.saveDc}</div>
              <div><strong>Bono Ataque:</strong> +${spellStats.attackBonus}</div>
              <div><strong>Ranuras Nivel 1:</strong> ${classDef.spellcasting?.spellSlots?.['1'] || 2}</div>
            </div>
          ` : '<div><em>Sin aptitud mágica a nivel 1</em></div>'}
        </div>

        ${classDef.spellcasting ? `
          <div class="block-card">
            <div class="block-title">Conjuros y Trucos Conocidos</div>
            <table class="print-table">
              <thead>
                <tr>
                  <th style="width: 80px;">Nivel</th>
                  <th style="width: 140px;">Nombre</th>
                  <th style="width: 100px;">Tiempo / Alcance</th>
                  <th>Componentes / Duración</th>
                </tr>
              </thead>
              <tbody>
                ${(char.cantrips || []).map(c => `
                  <tr>
                    <td><strong>Truco</strong></td>
                    <td><strong>${c}</strong></td>
                    <td>1 acción • 18 m</td>
                    <td>V, S • Instantáneo</td>
                  </tr>
                `).join('')}
                ${(char.preparedSpells || []).map(s => `
                  <tr>
                    <td><strong>Nivel 1</strong></td>
                    <td><strong>${s}</strong></td>
                    <td>1 acción • Variable</td>
                    <td>V, S • Variable</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <div class="layout-2col" style="margin-top: 10px;">
          <div class="block-card">
            <div class="block-title">Equipo Actualmente Equipado</div>
            <table class="print-table">
              <thead>
                <tr>
                  <th>Objeto</th>
                  <th>Cant.</th>
                  <th>Peso</th>
                </tr>
              </thead>
              <tbody>
                ${equipped.length === 0 ? '<tr><td colspan="3">Ningún objeto equipado</td></tr>' : equipped.map(i => `
                  <tr>
                    <td><strong>${i.name}</strong> ${i.properties ? `<small>(${i.properties})</small>` : ''}</td>
                    <td>${i.quantity}</td>
                    <td>${i.weight ? `${i.weight} lb` : '--'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="block-card">
            <div class="block-title">Mochila e Inventario General</div>
            <table class="print-table">
              <thead>
                <tr>
                  <th>Objeto</th>
                  <th>Cant.</th>
                  <th>Peso</th>
                </tr>
              </thead>
              <tbody>
                ${backpack.length === 0 ? '<tr><td colspan="3">Mochila vacía</td></tr>' : backpack.map(i => `
                  <tr>
                    <td>${i.name}</td>
                    <td>${i.quantity}</td>
                    <td>${i.weight ? `${i.weight} lb` : '--'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="block-card" style="margin-top: 10px;">
          <div class="block-title">Notas del Personaje y Bagatela</div>
          <p><strong>Bagatela:</strong> ${char.trinket || 'Ninguna'}</p>
          <p style="margin-top: 4px;"><strong>Apariencia:</strong> ${char.appearance || 'Sin descripción'}</p>
          <p style="margin-top: 4px;"><strong>Notas de Personalidad:</strong> ${char.personalityNotes || 'Sin notas registradas'}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
