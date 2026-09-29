import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STATE, INITIAL_TELEMETRY } from '../src/types';
import { PHYSICS_ASSUMPTIONS, ackermannAngles, stepPhysics } from '../src/physics';

const running = { ...INITIAL_STATE, running: true };

test('throttle accelerates and draws battery energy', () => {
  const next = stepPhysics(INITIAL_TELEMETRY, { ...running, throttle: 100 }, 0.1);
  assert.ok(next.speed > 0);
  assert.ok(next.rpm > 0);
  assert.ok(next.power > 0);
  assert.ok(next.battery < 82);
});

test('braking stops without reverse speed and motor regen raises SOC', () => {
  const prior = { ...INITIAL_TELEMETRY, speed: 36 };
  const next = stepPhysics(prior, { ...running, brake: 100 }, 0.1);
  assert.ok(next.speed < prior.speed);
  assert.ok(next.power < 0);
  assert.ok(next.battery > prior.battery);
  let stopped = next;
  for (let i = 0; i < 100; i++) stopped = stepPhysics(stopped, { ...running, brake: 100 }, 0.1);
  assert.equal(stopped.speed, 0);
  assert.equal(stopped.rpm, 0);
});

test('pause and invalid time step leave telemetry unchanged', () => {
  assert.deepEqual(stepPhysics(INITIAL_TELEMETRY, INITIAL_STATE, 0.1), INITIAL_TELEMETRY);
  for (const dt of [0, -1, NaN, Infinity]) {
    assert.deepEqual(stepPhysics(INITIAL_TELEMETRY, running, dt), INITIAL_TELEMETRY);
  }
});

test('low-speed stop cannot recover more than available kinetic energy', () => {
  const prior = { ...INITIAL_TELEMETRY, speed: 1 };
  const dt = 0.25;
  const next = stepPhysics(prior, { ...running, brake: 100 }, dt);
  const recoveredJ = (next.battery - prior.battery) / 100 * PHYSICS_ASSUMPTIONS.usableBatteryKWh * 3_600_000;
  const kineticJ = 0.5 * PHYSICS_ASSUMPTIONS.massKg * (prior.speed / 3.6) ** 2;
  assert.equal(next.speed, 0);
  assert.ok(recoveredJ >= 0);
  assert.ok(recoveredJ <= kineticJ * PHYSICS_ASSUMPTIONS.regenEfficiency + 1e-7);
  assert.ok(Math.abs(-next.power * 1000 * dt - recoveredJ) < 1e-7);
});

test('battery bounds and brake priority prevent propulsion', () => {
  const empty = stepPhysics({ ...INITIAL_TELEMETRY, battery: 0 }, { ...running, throttle: 100 }, 0.1);
  assert.equal(empty.speed, 0);
  const braking = stepPhysics({ ...INITIAL_TELEMETRY, speed: 36 }, { ...running, throttle: 100, brake: 100 }, 0.1);
  assert.ok(braking.speed < 36);
  assert.ok(braking.power <= 0);
  const full = stepPhysics({ ...INITIAL_TELEMETRY, speed: 36, battery: 100 }, { ...running, brake: 100 }, 0.1);
  assert.equal(full.battery, 100);
  assert.equal(full.power, 0);
});

test('Ackermann front steering is zero and symmetric by direction', () => {
  assert.deepEqual(ackermannAngles(0), { left: 0, right: 0 });
  const left = ackermannAngles(20);
  const right = ackermannAngles(-20);
  assert.ok(left.left > left.right && left.right > 0);
  assert.ok(right.right < right.left && right.left < 0);
  assert.ok(Math.abs(left.left + right.right) < 1e-12);
  assert.ok(Math.abs(left.right + right.left) < 1e-12);
});
