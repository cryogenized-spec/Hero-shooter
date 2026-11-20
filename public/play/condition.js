// Fictional gameplay values. This is not a medical-treatment guide.
// Pure, dependency-free state helpers used by the Canvas game and Node tests.
(function (root) {
  'use strict';
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function create({ fieldCare = 1 } = {}) {
    return {
      bleeding: 0,
      injury: 0,
      fatigue: 0,
      nutrition: 70,
      hydration: 70,
      fieldCare: Math.max(0, Math.floor(fieldCare)),
      stabilized: true
    };
  }

  function recordInjury(state, unabsorbedDamage) {
    const damage = Math.max(0, Number(unabsorbedDamage) || 0);
    if (damage < 7) return state;
    state.injury = clamp(state.injury + damage * 0.4, 0, 100);
    if (damage >= 17) {
      state.bleeding = clamp(state.bleeding + damage * 0.0032, 0, 0.35);
      state.stabilized = false;
    }
    return state;
  }

  function update(state, seconds, { moving = false } = {}) {
    const dt = clamp(Number(seconds) || 0, 0, 1);
    state.fatigue = clamp(state.fatigue + (moving ? 0.018 : 0.003) * dt, 0, 100);
    // Health decreases gradually only while bleeding is active. No automatic healing.
    return state.bleeding * dt;
  }

  function useFieldCare(state) {
    if (state.bleeding <= 0) return { ok: false, reason: 'NO ACTIVE BLEEDING' };
    if (state.fieldCare < 1) return { ok: false, reason: 'NO FIELD-CARE SUPPLIES' };
    state.fieldCare -= 1;
    state.bleeding = 0;
    state.stabilized = true;
    return { ok: true, reason: 'BLEEDING STABILIZED — INJURY REMAINS' };
  }

  function eatAndDrink(state) {
    state.nutrition = clamp(state.nutrition + 18, 0, 100);
    state.hydration = clamp(state.hydration + 22, 0, 100);
    return state;
  }

  function mobilityFactor(state) {
    return clamp(1 - state.injury * 0.002 - state.fatigue * 0.001, 0.7, 1);
  }

  // For a future chapter-transition screen. Not invoked when entering a stage.
  function restBetweenChapters(state, hp, maxHp, hours = 5) {
    const h = clamp(Number(hours) || 0, 0, 12);
    state.fatigue = clamp(state.fatigue - h * 5, 0, 100);
    state.injury = clamp(state.injury - h * 0.8, 0, 100);
    if (state.bleeding > 0) return hp;
    const resources = Math.min(state.nutrition, state.hydration) / 100;
    // Deliberately modest partial recovery, not a reset to full health.
    return clamp(hp + Math.min(9, h * 1.15) * resources, 0, maxHp);
  }

  root.HeroCondition = Object.freeze({
    create, recordInjury, update, useFieldCare,
    eatAndDrink, mobilityFactor, restBetweenChapters
  });
})(globalThis);
