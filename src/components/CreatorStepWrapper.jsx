import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { renderStep1, renderStep2 } from '../../public/js/step1_2.js';
import { renderStep3, renderStep4 } from '../../public/js/step3_4.js';
import { renderStep5, renderStep6 } from '../../public/js/step5_6.js';
import { renderStep7, renderStep8 } from '../../public/js/step7_8.js';
import { state } from '../../public/js/state.js';

function StepContent({ step, tick }) {
  const stepRef = useRef(null);

  useEffect(() => {
    if (!stepRef.current) return;

    const activeEl = document.activeElement;
    const activeId = (activeEl && activeEl.id) ? activeEl.id : null;
    let selStart = null;
    let selEnd = null;
    if (activeEl && typeof activeEl.selectionStart === 'number') {
      try { selStart = activeEl.selectionStart; selEnd = activeEl.selectionEnd; } catch (e) {}
    }

    switch (step) {
      case 1: renderStep1(stepRef.current); break;
      case 2: renderStep2(stepRef.current); break;
      case 3: renderStep3(stepRef.current); break;
      case 4: renderStep4(stepRef.current); break;
      case 5: renderStep5(stepRef.current); break;
      case 6: renderStep6(stepRef.current); break;
      case 7: renderStep7(stepRef.current); break;
      case 8: renderStep8(stepRef.current); break;
    }

    if (activeId) {
      const el = document.getElementById(activeId);
      if (el) {
        el.focus();
        if (selStart !== null) {
          try { el.selectionStart = selStart; el.selectionEnd = selEnd; } catch (e) {}
        }
      }
    }
  }, [step, tick]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      ref={stepRef}
      className="creator-step-animated-container"
      style={{ width: '100%' }}
    />
  );
}

export default function CreatorStepWrapper({ tick }) {
  const [step, setStep] = useState(state.currentStep);

  // Still use a light listener just to grab the step smoothly if needed, 
  // though we could also just read state.currentStep inside renderApp.
  // Actually, we'll just read state.currentStep whenever tick changes!
  useEffect(() => {
    setStep(state.currentStep);
  }, [tick]);

  return (
    <AnimatePresence mode="wait">
      <StepContent key={step} step={step} tick={tick} />
    </AnimatePresence>
  );
}
