import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createVehicle } from '../src/vehicle';
import { PARTS } from '../src/catalog';
import { INITIAL_STATE, INITIAL_TELEMETRY } from '../src/types';
import type { DoorId, SimulationState } from '../src/types';

function advance(vehicle: ReturnType<typeof createVehicle>, state: SimulationState) {
  for (let i = 0; i < 100; i++) vehicle.update(state, INITIAL_TELEMETRY, i / 60, 1 / 60);
  vehicle.root.updateMatrixWorld(true);
}
const bounds = (objects: THREE.Object3D[]) => { const box = new THREE.Box3(); objects.forEach(o => box.expandByObject(o)); return box; };

test('every engineering catalog record resolves to a finite, correctly categorized model assembly', () => {
  const vehicle = createVehicle();
  assert.equal(vehicle.parts.size, PARTS.length);
  advance(vehicle, INITIAL_STATE);
  for (const part of PARTS) {
    const objects = vehicle.parts.get(part.id);
    assert.ok(objects?.length, `Missing ${part.id}`);
    assert.equal(objects[0].userData.system, part.system, `Wrong subsystem for ${part.id}`);
    const box = bounds(objects);
    assert.ok(!box.isEmpty(), `${part.id} has no geometry`);
    assert.ok([...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite));
    assert.ok(part.specs.length >= 2);
  }
  const size = bounds([vehicle.root]).getSize(new THREE.Vector3());
  assert.ok(size.x > 4.5 && size.x < 5, 'Meter scale vehicle length');
  assert.ok(size.y > 1.3 && size.y < 1.6, 'Meter scale vehicle height');
  vehicle.dispose();
});

test('all four doors open outward and hood/trunk rise independently', () => {
  const vehicle = createVehicle(); advance(vehicle, INITIAL_STATE);
  const before = new Map([...vehicle.parts].map(([id, objects]) => [id, bounds(objects)]));
  const keys: [string, DoorId][] = [['door-fl','frontLeft'],['door-fr','frontRight'],['door-rl','rearLeft'],['door-rr','rearRight']];
  for (const [id, door] of keys) {
    advance(vehicle, {...INITIAL_STATE, doors: {...INITIAL_STATE.doors, [door]:true}});
    const after = bounds(vehicle.parts.get(id)!);
    assert.ok(after.getSize(new THREE.Vector3()).z > before.get(id)!.getSize(new THREE.Vector3()).z + .25, `${id} must swing open`);
    for (const [other] of keys.filter(([other])=>other!==id)) assert.ok(bounds(vehicle.parts.get(other)!).getCenter(new THREE.Vector3()).distanceTo(before.get(other)!.getCenter(new THREE.Vector3())) < .002, `${other} must stay closed`);
  }
  advance(vehicle, {...INITIAL_STATE, doors:{...INITIAL_STATE.doors,frunk:true,trunk:true}});
  assert.ok(bounds(vehicle.parts.get('hood')!).max.y > before.get('hood')!.max.y+.3);
  assert.ok(bounds(vehicle.parts.get('trunk')!).max.y > before.get('trunk')!.max.y+.2);
  vehicle.dispose();
});

test('isolating a hidden subsystem part displays exactly that assembly and restores visibility', () => {
  const vehicle=createVehicle();
  const hidden={...INITIAL_STATE,visible:{...INITIAL_STATE.visible,powertrain:false}};
  advance(vehicle,{...hidden,isolated:'octovalve'});
  assert.deepEqual([...vehicle.parts].filter(([,objects])=>objects.some(o=>o.visible)).map(([id])=>id),['octovalve']);
  advance(vehicle,hidden);
  assert.equal(vehicle.parts.get('octovalve')![0].visible,false);
  assert.equal(vehicle.parts.get('body-shell')![0].visible,true);
  vehicle.dispose();
});

test('pausing at a fixed simulation time preserves suspension pose', () => {
  const vehicle=createVehicle();const state={...INITIAL_STATE,running:true,road:100};
  vehicle.update(state,INITIAL_TELEMETRY,1,1/60);
  const wheel=vehicle.parts.get('wheel-fl')![0].children[0];
  const before=wheel.position.clone();
  vehicle.update({...state,running:false},INITIAL_TELEMETRY,1,1/60);
  assert.ok(before.distanceTo(wheel.position)<1e-10);
  vehicle.dispose();
});

test('battery cell LOD switches detailed instances to module blocks with distance', () => {
  const vehicle=createVehicle();const lod=vehicle.root.getObjectByName('battery-cell-lod') as THREE.LOD;
  assert.ok(lod?.isLOD);vehicle.root.updateMatrixWorld(true);
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,1,2);camera.updateMatrixWorld();lod.update(camera);
  assert.equal(lod.getCurrentLevel(),0);
  camera.position.set(0,2,16);camera.updateMatrixWorld();lod.update(camera);
  assert.equal(lod.getCurrentLevel(),1);
  vehicle.dispose();
});

test('left-side controls use negative Z and positive steering turns both front wheels left', () => {
  const vehicle=createVehicle();advance(vehicle,{...INITIAL_STATE,steering:20});
  for(const id of ['door-fl','door-rl','wheel-fl','wheel-rl','steering-wheel','charge-port']){
    assert.ok(bounds(vehicle.parts.get(id)!).getCenter(new THREE.Vector3()).z<0,`${id} is on the driver left side`);
  }
  const left=vehicle.parts.get('wheel-fl')![0].children[0],right=vehicle.parts.get('wheel-fr')![0].children[0];
  assert.ok(left.rotation.y>right.rotation.y&&right.rotation.y>0);
  vehicle.dispose();
});
