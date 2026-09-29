import type { SimulationState, Telemetry } from './types';

// Educational longitudinal model. These are named assumptions, not measured Model 3 data.
export const PHYSICS_ASSUMPTIONS = {
  massKg: 1900,
  wheelRadiusM: 0.335,
  gearRatio: 9,
  usableBatteryKWh: 75,
  propulsionLimitW: 350_000,
  launchForceN: 9_000,
  regenLimitW: 75_000,
  regenForceLimitN: 4_500,
  brakeDecelerationMps2: 8,
  coastRegenDecelerationMps2: 0.7,
  dragCoefficient: 0.28,
  frontalAreaM2: 2.22,
  rollingCoefficient: 0.01,
  drivelineEfficiency: 0.90,
  regenEfficiency: 0.70,
  wheelbaseM: 2.875,
  frontTrackM: 1.584,
} as const;

const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Road-wheel angles in radians. Scene +x is forward, +y is up, -z is left; positive yaw turns left. */
export function ackermannAngles(steeringDegrees: number): { left: number; right: number } {
  const roadWheelDeg = clamp(finite(steeringDegrees, 0), -35, 35);
  if (roadWheelDeg === 0) return { left: 0, right: 0 };
  const sign = Math.sign(roadWheelDeg);
  const radius = PHYSICS_ASSUMPTIONS.wheelbaseM / Math.tan(Math.abs(roadWheelDeg) * Math.PI / 180);
  const inner = Math.atan(PHYSICS_ASSUMPTIONS.wheelbaseM / (radius - PHYSICS_ASSUMPTIONS.frontTrackM / 2));
  const outer = Math.atan(PHYSICS_ASSUMPTIONS.wheelbaseM / (radius + PHYSICS_ASSUMPTIONS.frontTrackM / 2));
  return sign > 0 ? { left: inner, right: outer } : { left: -outer, right: -inner };
}

/** Telemetry speed is km/h, RPM is motor shaft RPM, power is battery kW (negative while charging). */
export function stepPhysics(previous: Telemetry, state: SimulationState, dt: number): Telemetry {
  if (!state.running || !Number.isFinite(dt) || dt <= 0) return { ...previous };
  const seconds = Math.min(dt, 0.25);
  const p = PHYSICS_ASSUMPTIONS;
  const speed = Math.max(0, finite(previous.speed, 0)) / 3.6;
  const battery = clamp(finite(previous.battery, 82), 0, 100);
  const throttle = clamp(finite(state.throttle, 0), 0, 100) / 100;
  const brake = clamp(finite(state.brake, 0), 0, 100) / 100;
  const driveForce = battery > 0 && brake === 0
    ? throttle * Math.min(p.launchForceN, p.propulsionLimitW / Math.max(speed, 1)) : 0;
  const dragForce = 0.5 * 1.225 * p.dragCoefficient * p.frontalAreaM2 * speed * speed;
  const rollingForce = speed > 0 ? p.massKg * 9.81 * p.rollingCoefficient : 0;
  const requestedBrakeForce = brake * p.massKg * p.brakeDecelerationMps2
    + (throttle === 0 && brake === 0 ? p.massKg * p.coastRegenDecelerationMps2 : 0);
  const regenForce = speed > 0 && battery < 100
    ? Math.min(requestedBrakeForce, p.regenForceLimitN, p.regenLimitW / Math.max(speed, 1)) : 0;
  const netForce = driveForce - dragForce - rollingForce - requestedBrakeForce;
  const nextSpeed = Math.max(0, speed + netForce / p.massKg * seconds);
  const averageSpeed = (speed + nextSpeed) / 2;
  const tractionW = driveForce * averageSpeed / p.drivelineEfficiency;
  // A step that reaches zero speed must not recover more than its lost kinetic energy.
  const kineticLossJ = Math.max(0, 0.5 * p.massKg * (speed * speed - nextSpeed * nextSpeed));
  const batteryHeadroomJ = (100 - battery) / 100 * p.usableBatteryKWh * 3_600_000;
  const recoveredJ = Math.min(regenForce * averageSpeed * seconds * p.regenEfficiency,
    kineticLossJ * p.regenEfficiency, batteryHeadroomJ);
  const recoveredW = recoveredJ / seconds;
  const batteryPowerW = tractionW - recoveredW;
  const nextBattery = clamp(battery - batteryPowerW * seconds / 3_600_000 / p.usableBatteryKWh * 100, 0, 100);
  const rpm = nextSpeed / (2 * Math.PI * p.wheelRadiusM) * 60 * p.gearRatio;
  const temperature = clamp(finite(previous.temperature, 24) + Math.abs(batteryPowerW) / 350_000 * seconds * 0.025, -40, 120);
  return {
    ...previous,
    speed: nextSpeed * 3.6,
    rpm,
    power: batteryPowerW / 1000,
    battery: nextBattery,
    temperature,
  };
}
