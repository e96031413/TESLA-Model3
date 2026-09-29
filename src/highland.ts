import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ackermannAngles } from './physics';
import type { DoorId, SimulationState, Subsystem, Telemetry } from './types';

// Artist-created Highland exterior. The engineering components remain illustrative.
// See /models/highland/CREDITS.md for source, license and adaptation details.
export async function loadHighlandModel() {
  const loaded = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/highland/highland.glb`);
  loaded.scene.updateMatrixWorld(true);
  const root = new THREE.Group(); root.name = 'Tesla Model 3 Highland — licensed artist model';
  const parts = new Map<string, THREE.Object3D[]>();
  const assemblies: { group: THREE.Group; system: Subsystem; offset: THREE.Vector3 }[] = [];
  const hinges: { object: THREE.Group; key: DoorId; axis: 'y' | 'z'; angle: number }[] = [];
  const wheels: { steer: THREE.Group; spin: THREE.Group; front: boolean; side: number }[] = [];
  const targets = new Map<string, THREE.Group>();
  const selectionColor = new THREE.Color('#16c9dc');
  const steeringAxis = new THREE.Vector3(.875, -.484, 0).normalize();
  const aeroCold = new THREE.Color('#18598f'), aeroMid = new THREE.Color('#21c6d2'), aeroHot = new THREE.Color('#ff985b');
  const surfaces: { material: THREE.MeshStandardMaterial; id: string; opacity: number; emissive: THREE.Color; intensity: number; paint: boolean; system: Subsystem }[] = [];
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const offsets: Record<string, number[]> = {
    'body-shell': [0, .36, 0], hood: [.2, .65, 0], glazing: [0, .7, 0],
    headlights: [.42, .22, 0], taillights: [-.42, .22, 0],
    'seat-front': [0, .61, 0], 'seat-rear': [-.15, .61, 0], touchscreen: [.07, .73, 0],
    dashboard: [.1, .50, 0], 'steering-wheel': [.03, .55, -.08],
  };
  function targetFor(id: string) {
    if (targets.has(id)) return targets.get(id)!;
    const group = new THREE.Group(); group.name = id;
    const system: Subsystem = id.startsWith('wheel-') ? 'chassis' : ['seat-front', 'seat-rear', 'touchscreen', 'dashboard', 'steering-wheel'].includes(id) ? 'interior' : 'exterior';
    group.userData = { partId: id, system, source: 'licensed-highland-artist-model' };
    root.add(group); parts.set(id, [group]);
    let target = group;
    const side = id.endsWith('l') ? -1 : 1;
    let offset = offsets[id] ?? [0, 0, 0];
    if (id.startsWith('door-')) {
      const rear = id[5] === 'r';
      target = new THREE.Group(); target.position.set(rear ? -.270 : .91, .70, side * .89); group.add(target);
      const key: DoorId = rear ? (side > 0 ? 'rearLeft' : 'rearRight') : (side > 0 ? 'frontLeft' : 'frontRight');
      hinges.push({ object: target, key, axis: 'y', angle: side * 1.02 });
      offset = [rear ? -.12 : .1, .2, side * .88];
    } else if (id === 'hood') {
      target = new THREE.Group(); target.position.set(1.055, .897, 0); group.add(target);
      hinges.push({ object: target, key: 'frunk', axis: 'z', angle: .88 });
    } else if (id === 'steering-wheel') {
      target = new THREE.Group(); target.position.set(.3633, .8624, -.375); group.add(target);
    } else if (id.startsWith('wheel-')) {
      const front = id[6] === 'f', steer = new THREE.Group(), spin = new THREE.Group();
      steer.position.set(front ? 1.437 : -1.437, .345, side * .807); steer.add(spin); group.add(steer); target = spin;
      wheels.push({ steer, spin, front, side }); offset = [0, -.07, side * .57];
    }
    assemblies.push({ group, system, offset: new THREE.Vector3(...offset as [number, number, number]) });
    targets.set(id, target); return target;
  }
  const meshes: THREE.Mesh[] = [];
  loaded.scene.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
  for (const original of meshes) {
    const id = original.userData.partId as string;
    if (!id) throw new Error(`Highland mesh lacks part identity: ${original.name}`);
    const sourceMaterial = original.userData.sourceMaterial as number;
    const target = targetFor(id), group = parts.get(id)![0];
    const geometry = original.geometry.clone(); geometry.applyMatrix4(original.matrixWorld);
    if (sourceMaterial === 9) {
      // Illustrative, position-based pressure palette; this is not CFD output.
      const positions = geometry.getAttribute('position'), colors = new Float32Array(positions.count * 3), color = new THREE.Color();
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i);
        const pressure = THREE.MathUtils.clamp(.19 + .81 * Math.exp(-(((x - 2.32) / .62) ** 2)) - .16 * Math.max(0, y - .9) + .1 * Math.exp(-(((x + 2.1) / .45) ** 2)), 0, 1);
        if (pressure < .5) color.copy(aeroCold).lerp(aeroMid, pressure * 2); else color.copy(aeroMid).lerp(aeroHot, (pressure - .5) * 2);
        color.toArray(colors, i * 3);
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    // Bake the closed pose before adding the hinge, preserving every source vertex.
    root.updateMatrixWorld(true);
    geometry.applyMatrix4(target.matrixWorld.clone().invert()); geometries.add(geometry);
    const source = original.material as THREE.MeshStandardMaterial;
    const isPaint = sourceMaterial === 9;
    const material = isPaint
      ? new THREE.MeshPhysicalMaterial({ color: '#e4e8ef', metalness: .54, roughness: .24, clearcoat: 1, clearcoatRoughness: .15, side: THREE.DoubleSide })
      : source.clone();
    material.envMapIntensity = 1.05;
    material.forceSinglePass = true;
    if ([5, 7, 8].includes(sourceMaterial)) { material.color.set('#233942'); material.roughness = .11; material.metalness = .25; material.transparent = true; material.opacity = sourceMaterial === 8 ? .60 : .50; material.depthWrite = false; }
    if (sourceMaterial === 16) { material.roughness = .82; material.metalness = .02; }
    if (sourceMaterial === 12 || sourceMaterial === 10) { material.metalness = .78; material.roughness = .29; }
    if (sourceMaterial === 11) material.roughness = .43;
    if (id === 'headlights' && [10, 15].includes(sourceMaterial)) { material.emissive.set('#d8eaff'); material.emissiveIntensity = .8; }
    if (sourceMaterial === 13) { material.emissive.set('#d91e2d'); material.emissiveIntensity = .55; }
    if (sourceMaterial === 0 || sourceMaterial === 1) material.emissiveIntensity = .45;
    materials.add(material);
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) { value.anisotropy = 8; textures.add(value); }
    surfaces.push({ material, id, opacity: material.opacity, emissive: material.emissive.clone(), intensity: material.emissiveIntensity, paint: isPaint, system: group.userData.system });
    const mesh = new THREE.Mesh(geometry, material); mesh.name = original.name; mesh.userData = { partId: id, system: group.userData.system };
    mesh.castShadow = true; mesh.receiveShadow = true; target.add(mesh);
  }
  // Source buffers were cloned before transforms; free originals after construction.
  meshes.forEach(mesh => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); });
  let rotation = 0, resetNonce = -1, explosion = 0;
  function update(state: SimulationState, telemetry: Telemetry, time: number, dt: number) {
    const step = Math.min(Math.max(dt, 0), .06), smooth = 1 - Math.exp(-step * 8);
    if (resetNonce !== state.resetNonce) { rotation = 0; resetNonce = state.resetNonce; }
    explosion = THREE.MathUtils.lerp(explosion, state.mode === 'exploded' ? state.explosion * 2.1 : 0, smooth);
    for (const { group, system, offset } of assemblies) { group.visible = state.isolated ? state.isolated === group.name : state.visible[system]; group.position.copy(offset).multiplyScalar(explosion); }
    const ghost = ['xray', 'thermal', 'energy'].includes(state.mode);
    for (const entry of surfaces) {
      const { material, id, paint, system } = entry;
      if (paint) {
        const aero = state.mode === 'aero'; material.color.set(aero ? '#ffffff' : state.paint);
        if (material.vertexColors !== aero) { material.vertexColors = aero; material.needsUpdate = true; }
      }
      const factor = ghost && system === 'exterior' ? (state.mode === 'xray' ? state.opacity : .13) : 1;
      const opacity = entry.opacity * factor, transparent = opacity < .999;
      if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
      material.opacity = opacity; material.depthWrite = !transparent;
      material.emissive.copy(id === state.selected ? selectionColor : entry.emissive);
      material.emissiveIntensity = id === state.selected ? .3 : entry.intensity;
    }
    for (const hinge of hinges) hinge.object.rotation[hinge.axis] = THREE.MathUtils.lerp(hinge.object.rotation[hinge.axis], state.doors[hinge.key] ? hinge.angle : 0, smooth);
    if (state.running) rotation += telemetry.speed / 3.6 / .345 * step;
    const angles = ackermannAngles(state.steering);
    targets.get('steering-wheel')?.quaternion.setFromAxisAngle(steeringAxis, -THREE.MathUtils.degToRad(state.steering) * 4);
    for (const wheel of wheels) {
      wheel.spin.rotation.z = -rotation;
      wheel.steer.rotation.y = wheel.front ? (wheel.side < 0 ? angles.left : angles.right) : 0;
      wheel.steer.position.y = .345 + Math.sin(time * 7 + (wheel.front ? 0 : 2.5) + wheel.side * .4) * state.road / 100 * .045;
    }
  }
  function dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); root.removeFromParent(); }
  return { root, parts, update, dispose, replacedPartIds: [...parts.keys(), 'trunk', 'charge-port'], unsupportedActuators: ['trunk', 'charge'] as const };
}
