import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { renderCharacterSheetView } from '../js/characterSheetView.js';

export default function CharacterSheetWrapper({ characterId, tick }) {
  const containerRef = useRef(null);

  useEffect(() => {
    // Renderizado delegando a Vanilla JS. Se ejecuta cada vez que 'tick' cambia,
    // que es cuando window.app.renderApp() es llamado.
    if (containerRef.current) {
      renderCharacterSheetView(containerRef.current, characterId);
    }
  }, [characterId, tick]);

  // Al desmontar, limpiamos
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -15 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      ref={containerRef}
      className="react-sheet-wrapper"
    />
  );
}
