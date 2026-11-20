import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/play/condition.js';

const C = globalThis.HeroCondition;

test('injuries persist and ordinary supplies do not heal instantly', () => {
  const state = C.create({ fieldCare: 1 });
  C.recordInjury(state, 25);
  assert.ok(state.bleeding > 0);
  const loss = C.update(state, 5, { moving: true });
  assert.ok(loss > 0);
  const injury = state.injury;
  C.eatAndDrink(state);
  assert.equal(state.injury, injury);
  assert.ok(state.nutrition > 70);
  assert.ok(state.hydration > 70);
});

test('field care stops continued loss, consumes a supply, and does not cure injury', () => {
  const state = C.create({ fieldCare: 1 });
  C.recordInjury(state, 22);
  const injury = state.injury;
  assert.equal(C.useFieldCare(state).ok, true);
  assert.equal(state.bleeding, 0);
  assert.equal(state.injury, injury);
  assert.equal(state.fieldCare, 0);
  assert.equal(C.useFieldCare(state).ok, false);
  assert.equal(C.update(state, 3), 0);
});

test('rest between chapters is partial, requires stabilization, and cannot exceed maximum health', () => {
  const s = C.create();
  C.recordInjury(s, 40);
  assert.equal(C.restBetweenChapters(s, 37, 100, 5), 37);
  C.useFieldCare(s);
  const health = C.restBetweenChapters(s, 37, 100, 5);
  assert.ok(health > 37 && health < 50);
  assert.ok(s.injury > 0);
  assert.ok(C.restBetweenChapters(s, 99, 100, 12) <= 100);
});

test('condition affects mobility without creating negative or boosted movement', () => {
  const s = C.create();
  const original = C.mobilityFactor(s);
  C.recordInjury(s, 40);
  assert.ok(C.mobilityFactor(s) < original);
  s.fatigue = 100;
  s.injury = 100;
  assert.ok(C.mobilityFactor(s) >= 0.7);
});
