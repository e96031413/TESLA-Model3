import * as THREE from 'three';
import type { DoorId, SimulationState, Subsystem, Telemetry } from './types';
import { ackermannAngles } from './physics';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Dimensionally representative, procedural teaching model; not manufacturer CAD.
export function createVehicle() {
  const root = new THREE.Group();
  root.name = 'Model 3 · Highland / procedural engineering model';
  const parts = new Map<string, THREE.Object3D[]>();
  const assemblies: { group: THREE.Group; system: Subsystem; base: THREE.Vector3; offset: THREE.Vector3 }[] = [];
  const hinges: { object: THREE.Group; door: DoorId; axis: 'x' | 'y' | 'z'; angle: number }[] = [];
  const wheels: { steer: THREE.Group; spin: THREE.Group; front: boolean; side: number }[] = [];
  const rotors: { object: THREE.Group; ratio: number }[] = [];
  const suspensionMotion: { front: boolean; side: number; spring: THREE.Group; brake: THREE.Group; links: { mesh: THREE.Mesh; fixed: THREE.Vector3; moving: THREE.Vector3 }[] }[] = [];
  const struts: { mesh: THREE.Mesh; sleeve: THREE.Mesh; pivot: THREE.Group; fixed: THREE.Vector3; moving: THREE.Vector3 }[] = [];
  const axisY = new THREE.Vector3(0, 1, 0), vectorA = new THREE.Vector3(), vectorB = new THREE.Vector3(), vectorC = new THREE.Vector3();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const paintMaterials: THREE.MeshPhysicalMaterial[] = [];
  const translucent: { material: THREE.MeshStandardMaterial; opacity: number; transparent: boolean; depthWrite: boolean }[] = [];
  const selectionMaterials = new Map<string, { material: THREE.MeshStandardMaterial; color: THREE.Color; intensity: number }[]>();
  const mat = (color: THREE.ColorRepresentation, metalness = 0, roughness = 0.5) => {
    const m = new THREE.MeshStandardMaterial({ color, metalness, roughness, side: THREE.DoubleSide }); materials.add(m); return m;
  };
  const paint = new THREE.MeshPhysicalMaterial({ color: '#e4e8ef', metalness: 0.52, roughness: 0.23, clearcoat: 1, clearcoatRoughness: 0.13, side: THREE.DoubleSide });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#122b35', metalness: 0.18, roughness: 0.09, clearcoat: 1, transparent: true, opacity: 0.78, side: THREE.DoubleSide });
  const black = mat('#11161a', 0.15, 0.38);
  const rubber = mat('#101317', 0.05, 0.8);
  const satin = mat('#323d48', 0.8, 0.28);
  const alloy = mat('#9aa7b3', 0.86, 0.24);
  const steel = mat('#64788a', 0.8, 0.32);
  const paleSteel = mat('#aec0ca', 0.8, 0.36);
  const batteryMat = mat('#1b5865', 0.65, 0.36);
  const cellMat = mat('#6dcac6', 0.5, 0.32);
  const orange = mat('#ff701f', 0.15, 0.35);
  const blue = mat('#2993c0', 0.5, 0.3);
  const cream = mat('#c6c8c7', 0.02, 0.64);
  const softBlack = mat('#20272c', 0.02, 0.8);
  const light = new THREE.MeshStandardMaterial({ color: '#dceeff', emissive: '#afdcff', emissiveIntensity: 2.7, roughness: 0.2 });
  const redLight = new THREE.MeshStandardMaterial({ color: '#ad0d24', emissive: '#ff152e', emissiveIntensity: 1.35, roughness: 0.2 });
  const screen = new THREE.MeshStandardMaterial({ color: '#091c29', emissive: '#164a64', emissiveIntensity: 0.6, roughness: 0.18 });
  [paint, glass, light, redLight, screen].forEach(m => materials.add(m));

  function assembly(id: string, system: Subsystem, offset: [number, number, number] = [0, 0, 0]) {
    const group = new THREE.Group(); group.name = id; group.userData = { partId: id, system };
    root.add(group); parts.set(id, [group]);
    assemblies.push({ group, system, base: group.position.clone(), offset: new THREE.Vector3(...offset) });
    return group;
  }
  function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number] = [0, 0, 0]) {
    geometries.add(geometry); const object = new THREE.Mesh(geometry, material);
    object.position.set(...position); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  function box(parent: THREE.Object3D, size: [number, number, number], pos: [number, number, number], material: THREE.Material, radius = 0) {
    if (!radius) return mesh(parent, new THREE.BoxGeometry(...size), material, pos);
    // Rounded extrusion keeps seat, castings, and electronics corners physically soft.
    const [w, h, d] = size; const r = Math.min(radius, w / 2, h / 2); const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const geo = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.005, d - r / 2), bevelEnabled: true, bevelThickness: r / 4, bevelSize: r / 4, bevelSegments: 2, steps: 1, curveSegments: 5 });
    geo.translate(0, 0, -d / 2 + r / 4); return mesh(parent, geo, material, pos);
  }
  function tube(parent: THREE.Object3D, points: number[][], radius: number, material: THREE.Material, smooth = true) {
    const p = points.map(v => new THREE.Vector3(v[0], v[1], v[2]));
    const curve = smooth ? new THREE.CatmullRomCurve3(p) : new THREE.CurvePath<THREE.Vector3>();
    if (!smooth) for (let i = 1; i < p.length; i++) (curve as THREE.CurvePath<THREE.Vector3>).add(new THREE.LineCurve3(p[i - 1], p[i]));
    return mesh(parent, new THREE.TubeGeometry(curve, Math.max(8, points.length * 5), radius, 6, false), material);
  }
  function cylinder(parent: THREE.Object3D, r: number, length: number, pos: [number, number, number], material: THREE.Material, axis: 'x' | 'y' | 'z' = 'y', segments = 24) {
    const obj = mesh(parent, new THREE.CylinderGeometry(r, r, length, segments), material, pos);
    if (axis === 'z') obj.rotation.x = Math.PI / 2; if (axis === 'x') obj.rotation.z = Math.PI / 2; return obj;
  }
  function link(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material) {
    const object = cylinder(parent, radius, 1, [0, 0, 0], material, 'y', 10); positionLink(object, a, b); return object;
  }
  function positionLink(object: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
    object.position.copy(a).add(b).multiplyScalar(.5);
    vectorC.copy(b).sub(a); object.scale.y = vectorC.length(); object.quaternion.setFromUnitVectors(axisY, vectorC.normalize());
  }
  function gear(parent: THREE.Object3D, radius: number, depth: number, pos: [number, number, number], material: THREE.Material) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 96; i++) { const angle = i / 96 * Math.PI * 2, r = radius * (i % 4 < 2 ? 1 : .89); const x = Math.cos(angle) * r, y = Math.sin(angle) * r; if (!i) shape.moveTo(x, y); else shape.lineTo(x, y); }
    shape.closePath(); const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 }); geometry.translate(0, 0, -depth / 2); return mesh(parent, geometry, material, pos);
  }
  function surface(parent: THREE.Object3D, fn: (u: number, v: number) => number[], nu: number, nv: number, material: THREE.Material) {
    const positions: number[] = [], indices: number[] = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) positions.push(...fn(i / nu, j / nv));
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; indices.push(a, b, a + 1, b, b + 1, a + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setIndex(indices); geo.computeVertexNormals(); return mesh(parent, geo, material);
  }
  function polygon(parent: THREE.Object3D, points: number[][], material: THREE.Material) {
    const positions = points.flat(); const indices = [];
    for (let i = 1; i < points.length - 1; i++) indices.push(0, i, i + 1);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setIndex(indices); geo.computeVertexNormals(); return mesh(parent, geo, material);
  }
  const widthAt = (x: number) => 0.92 - 0.15 * Math.pow(Math.abs(x) / 2.4, 4);
  const beltAt = (x: number) => 0.91 - 0.20 * Math.pow(Math.abs(x) / 2.4, 3);
  const archAt = (x: number) => {
    const d = Math.min(Math.abs(x - 1.4375), Math.abs(x + 1.4375));
    return d < 0.405 ? 0.342 + Math.sqrt(0.405 ** 2 - d ** 2) : 0.265;
  };
  const sideZ = (x: number, y: number) => widthAt(x) - 0.055 * Math.pow((y - 0.67) / 0.48, 2);
  const shell = assembly('body-shell', 'exterior', [0, 0.36, 0]);
  for (const side of [-1, 1]) {
    // Fender surfaces stop at circular wheel apertures, rather than covering the tires.
    for (const [a, b] of [[1.015, 2.35], [-2.35, -1.19]]) {
      surface(shell, (u, v) => { const x = a + (b - a) * u, y = THREE.MathUtils.lerp(archAt(x), beltAt(x), v); return [x, y, side * sideZ(x, y)]; }, 64, 10, paint);
    }
    tube(shell, [[-1.04, .275, side * .873], [0, .24, side * .88], [1.02, .275, side * .875]], .031, black);
    for (const axle of [-1.4375, 1.4375]) {
      const points = Array.from({ length: 29 }, (_, i) => { const a = Math.PI * i / 28; const x = axle + Math.cos(a) * .405; return [x, .342 + Math.sin(a) * .405, side * (widthAt(x) - .006)]; });
      tube(shell, points, .011, paint);
      tube(shell, points.map(p => [p[0], p[1] - .014, p[2] - side * .018]), .022, black);
    }
  }
  // Narrow sculpted front and rear bumper skins wrap continuously around the body.
  for (const end of [-1, 1]) {
    surface(shell, (u, v) => { const z = (u * 2 - 1) * .792, edge = Math.pow(Math.abs(z) / .792, 4); const y = .265 + v * ((end > 0 ? .468 : .543) - edge * .045); const bulge = Math.sin(v * Math.PI) * .022; return [end * (2.352 - edge * .013 + bulge - .026 * v ** 4), y, z]; }, 40, 12, paint);
    surface(shell, (u, v) => { const z = (u * 2 - 1) * .80; return [end * (2.30 - Math.pow(z / .8, 4) * .08), .24 + v * .07, z]; }, 24, 2, black);
  }
  // Front lower cooling intake and deep black aero insert.
  box(shell, [.027, .091, 1.18], [2.373, .333, 0], black, .015);
  for (const side of [-1, 1]) tube(shell, [[2.355, .4, side * .63], [2.34, .36, side * .73], [2.29, .29, side * .76]], .017, black);
  const hood = assembly('hood', 'exterior', [.2, .65, 0]);
  const hoodPivot = new THREE.Group(); hoodPivot.position.set(.91, .91, 0); hood.add(hoodPivot);
  surface(hoodPivot, (u, v) => { const x = .93 + u * 1.385, z = (v * 2 - 1) * widthAt(x) * .976; const y = .952 - .222 * u ** 1.45 - .05 * Math.pow(Math.abs(v * 2 - 1), 2); return [x - .91, y - .91, z]; }, 34, 24, paint);
  hinges.push({ object: hoodPivot, door: 'frunk', axis: 'z', angle: .88 });
  for (const side of [-1, 1]) tube(hoodPivot, [[.17, .025, side * .58], [.58, -.03, side * .61], [1.21, -.176, side * .65]], .0035, paint);
  for (const side of [-1, 1]) {
    // Narrow shoulders join the removable hood to the fenders without sealing the wheel arches.
    surface(shell, (u, v) => { const x = .93 + u * 1.385; const outerY = beltAt(x), innerY = .952 - .222 * u ** 1.45 - .05; return [x, THREE.MathUtils.lerp(innerY, outerY, v), side * THREE.MathUtils.lerp(widthAt(x) * .976, sideZ(x, outerY), v)]; }, 32, 3, paint);
  }
  const trunk = assembly('trunk', 'exterior', [-.25, .55, 0]);
  const trunkPivot = new THREE.Group(); trunkPivot.position.set(-1.63, .9, 0); trunk.add(trunkPivot);
  surface(trunkPivot, (u, v) => { const x = -1.64 - u * .69, z = (v * 2 - 1) * widthAt(x) * .976; return [x + 1.63, .92 - .112 * u - .045 * (v * 2 - 1) ** 2 - .9, z]; }, 22, 22, paint);
  hinges.push({ object: trunkPivot, door: 'trunk', axis: 'z', angle: -.95 });
  tube(trunkPivot, [[-.674, -.09, -.72], [-.706, -.06, 0], [-.674, -.09, .72]], .014, paint);
  for (const side of [-1, 1]) {
    surface(shell, (u, v) => { const x = -1.64 - u * .69; const outerY = beltAt(x), innerY = .92 - .112 * u - .045; return [x, THREE.MathUtils.lerp(innerY, outerY, v), side * THREE.MathUtils.lerp(widthAt(x) * .976, sideZ(x, outerY), v)]; }, 20, 3, paint);
    for (const [parent, pivot, a, b] of [
      [hood, hoodPivot, new THREE.Vector3(1.09, .77, side * .69), new THREE.Vector3(.59, -.045, side * .65)],
      [trunk, trunkPivot, new THREE.Vector3(-1.75, .71, side * .62), new THREE.Vector3(-.47, -.048, side * .60)],
    ] as const) {
      const moving = b.clone().add(pivot.position); const shaft = link(parent, a, moving, .009, alloy); const sleeve = link(parent, a, moving.clone().lerp(a, .48), .017, black);
      struts.push({ mesh: shaft, sleeve, pivot, fixed: a, moving: b });
    }
  }

  const glazing = assembly('glazing', 'exterior', [0, .7, 0]);
  // Large gently crowned windshield, panoramic roof and rear window.
  surface(glazing, (u, v) => { const x = 1.045 - .55 * u, t = v * 2 - 1; return [x + .045 * (1 - t * t), .964 + .408 * u + .02 * (1 - t * t), t * (.826 - .151 * u)]; }, 20, 24, glass);
  surface(glazing, (u, v) => { const x = .495 - 1.49 * u, t = v * 2 - 1; return [x, 1.379 + .052 * Math.sin(Math.PI * u) + .027 * (1 - t * t), t * (.675 + .01 * Math.sin(Math.PI * u))]; }, 30, 24, glass);
  surface(glazing, (u, v) => { const x = -.995 - .68 * u, t = v * 2 - 1; return [x - .035 * (1 - t * t), 1.385 - .453 * u + .018 * (1 - t * t), t * (.672 + .15 * u)]; }, 20, 24, glass);
  for (const side of [-1, 1]) {
    tube(shell, [[1.045, .95, side * .84], [.79, 1.2, side * .756], [.49, 1.394, side * .684], [-.30, 1.458, side * .694], [-.99, 1.394, side * .686], [-1.41, 1.112, side * .785], [-1.69, .93, side * .83]], .029, paint);
    tube(shell, [[1.031, .932, side * .842], [.49, 1.368, side * .694], [-.27, 1.428, side * .704], [-.99, 1.366, side * .697], [-1.66, .921, side * .844]], .012, black);
    polygon(glazing, [[-1.205, 1.18, side * .772], [-1.18, .934, side * .9], [-1.59, .933, side * .845]], glass);
  }
  const doorDefs: { id: string; key: DoorId; side: number; rear: boolean }[] = [
    { id: 'door-fl', key: 'frontLeft', side: -1, rear: false }, { id: 'door-fr', key: 'frontRight', side: 1, rear: false },
    { id: 'door-rl', key: 'rearLeft', side: -1, rear: true }, { id: 'door-rr', key: 'rearRight', side: 1, rear: true },
  ];
  for (const { id, key, side, rear } of doorDefs) {
    const door = assembly(id, 'exterior', [rear ? -.12 : .1, .2, side * .88]);
    const pivot = new THREE.Group(); const front = rear ? -.18 : 1.003; const back = rear ? -1.177 : -.158;
    pivot.position.set(front, .7, side * .88); door.add(pivot);
    for (const y of [-.18, .13]) { cylinder(pivot, .015, .070, [0, y, -side * .025], steel, 'y', 12); box(pivot, [.044, .035, .057], [-.022, y, -side * .047], steel, .006); }
    const local = (x: number, y: number, z: number) => [x - front, y - .7, z - side * .88];
    surface(pivot, (u, v) => { const x = back + (front - back) * u; const y = THREE.MathUtils.lerp(Math.max(.28, archAt(x) - .005), beltAt(x) - .013, v); return local(x, y, side * (sideZ(x, y) + .004 * Math.sin(u * Math.PI))); }, 28, 12, paint);
    const win = rear ? [[-.197, .928], [-.197, 1.419], [-.92, 1.368], [-1.172, 1.194], [-1.165, .925]] : [[-.14, .931], [-.14, 1.421], [.469, 1.363], [.97, .957]];
    const windowPoints = win.map(([x, y]) => local(x, y, side * (.915 - (y - .92) * .43)));
    polygon(pivot, windowPoints, glass);
    tube(pivot, [local(back, beltAt(back), side * sideZ(back, beltAt(back))), local((back + front) / 2, .925, side * .918), local(front, beltAt(front), side * sideZ(front, beltAt(front)))], .010, black);
    const edge: number[][] = [];
    for (let i = 0; i <= 10; i++) { const x = back + (front - back) * i / 10; const y = Math.max(.278, archAt(x) - .006); edge.push(local(x, y, side * sideZ(x, y))); }
    tube(pivot, edge, .004, black);
    for (const x of [back, front]) tube(pivot, [local(x, Math.max(.28, archAt(x)), side * sideZ(x, Math.max(.28, archAt(x)))), local(x, .7, side * sideZ(x, .7)), local(x, beltAt(x), side * sideZ(x, beltAt(x)))], .004, black);
    box(pivot, [.205, .026, .012], local(back + .2, .833, side * .913) as [number, number, number], satin, .012);
    box(pivot, [front - back - .08, .22, .056], local((front + back) / 2, .73, side * .825) as [number, number, number], softBlack, .06);
    box(pivot, [.53, .051, .07], local((front + back) / 2, .684, side * .778) as [number, number, number], cream, .018);
    if (!rear) {
      tube(pivot, [local(.83, .974, side * .864), local(.82, .992, side * 1.00)], .025, black);
      const mirror = mesh(pivot, new THREE.SphereGeometry(1, 20, 12), paint, local(.80, 1.015, side * 1.025) as [number, number, number]); mirror.scale.set(.145, .055, .101);
      const reflection = mesh(pivot, new THREE.SphereGeometry(1, 16, 8), alloy, local(.685, 1.016, side * 1.027) as [number, number, number]); reflection.scale.set(.008, .037, .080);
    }
    hinges.push({ object: pivot, door: key, axis: 'y', angle: side * 1.02 });
  }
  const headlights = assembly('headlights', 'exterior', [.42, .22, 0]);
  const tails = assembly('taillights', 'exterior', [-.42, .22, 0]);
  for (const side of [-1, 1]) {
    const path = [[2.325, .725, side * .405], [2.293, .735, side * .56], [2.204, .752, side * .738], [2.033, .779, side * .845]];
    tube(headlights, path, .034, black); tube(headlights, path.map(p => [p[0] + .008, p[1] + .008, p[2]]), .0095, light);
    for (let i = 0; i < 3; i++) box(headlights, [.018, .022, .052], [2.3 - .012 * i, .704, side * (.48 + i * .073)], alloy, .008);
    const rearPath = [[-2.366, .77, side * .32], [-2.355, .777, side * .56], [-2.29, .792, side * .737], [-2.086, .818, side * .845]];
    tube(tails, rearPath, .029, black); tube(tails, rearPath.map(p => [p[0] - .007, p[1], p[2]]), .012, redLight);
    tube(tails, [[-2.299, .785, side * .723], [-2.291, .704, side * .737], [-2.232, .685, side * .787]], .013, redLight);
    box(tails, [.012, .017, .17], [-2.354, .355, side * .57], redLight, .006);
  }
  // Subtle front T emblem, formed as geometry instead of a raster logo.
  tube(hoodPivot, [[1.226, -.141, -.053], [1.232, -.133, 0], [1.226, -.141, .053]], .005, alloy);
  tube(hoodPivot, [[1.222, -.139, 0], [1.164, -.121, 0]], .006, alloy);
  const charge = assembly('charge-port', 'exterior', [-.32, .15, -.7]);
  const chargePivot = new THREE.Group(); chargePivot.position.set(-2.05, .79, -.865); charge.add(chargePivot);
  box(chargePivot, [.145, .082, .016], [-.07, -.018, 0], black, .025);
  cylinder(charge, .026, .018, [-2.12, .775, -.847], black, 'z', 12);
  hinges.push({ object: chargePivot, door: 'charge', axis: 'x', angle: 1.35 });

  const frame = assembly('frame', 'body', [0, .1, 0]);
  box(frame, [2.85, .073, 1.52], [0, .327, 0], steel);
  for (const side of [-1, 1]) {
    box(frame, [3.12, .105, .095], [0, .32, side * .78], paleSteel, .03);
    tube(frame, [[1.83, .44, side * .48], [1.1, .37, side * .56], [.75, .35, side * .75], [-.92, .35, side * .75], [-1.6, .48, side * .47], [-2, .48, side * .5]], .059, steel, false);
  }
  for (const x of [-1.03, -.25, .6, 1.05]) box(frame, [.072, .07, 1.5], [x, .37, 0], paleSteel);
  const bPillars = assembly('b-pillars', 'body', [0, .35, 0]);
  for (const side of [-1, 1]) tube(bPillars, [[-.18, .37, side * .80], [-.175, .92, side * .865], [-.16, 1.423, side * .695]], .037, black, false);
  for (const [id, x] of [['crash-front', 2.02], ['crash-rear', -2.04]] as const) {
    const crash = assembly(id, 'body', [Math.sign(x) * .65, .08, 0]);
    box(crash, [.12, .115, 1.47], [x, .46, 0], alloy, .028);
    for (const s of [-1, 1]) { box(crash, [.43, .1, .12], [x - Math.sign(x) * .23, .46, s * .48], steel); for (let i = 0; i < 5; i++) box(crash, [.015, .115, .133], [x - Math.sign(x) * (.10 + .06 * i), .46, s * .48], paleSteel); }
  }
  const pack = assembly('battery-pack', 'powertrain', [0, -.30, 0]);
  box(pack, [2.63, .12, 1.36], [-.06, .22, 0], batteryMat, .055);
  box(pack, [2.65, .018, 1.38], [-.06, .153, 0], satin, .02);
  for (const side of [-1, 1]) for (let i = 0; i < 13; i++) cylinder(pack, .013, .012, [-1.28 + i * .2, .288, side * .663], alloy, 'y', 8);
  const cells = assembly('battery-cells', 'powertrain', [0, .43, 0]);
  const cellGeo = new THREE.CylinderGeometry(.012, .012, .062, 8); geometries.add(cellGeo);
  const cellInstances = new THREE.InstancedMesh(cellGeo, cellMat, 1080); const cellMatrix = new THREE.Matrix4();
  let ci = 0;
  for (let module = 0; module < 4; module++) for (let row = 0; row < 27; row++) for (let col = 0; col < 10; col++) {
    cellMatrix.makeTranslation(-1.205 + row * .087, .243, -.57 + module * .31 + col * .027);
    cellInstances.setMatrixAt(ci++, cellMatrix);
  }
  const cellLOD=new THREE.LOD();cellLOD.name='battery-cell-lod';
  const nearCells=new THREE.Group(),farCells=new THREE.Group();nearCells.add(cellInstances);
  for(let i=0;i<4;i++)box(farCells,[2.49,.062,.28],[-.074,.243,-.448+i*.31],cellMat);
  cellLOD.addLevel(nearCells,0);cellLOD.addLevel(farCells,5.5,.1);cells.add(cellLOD);
  for (let i = 0; i < 4; i++) box(cells, [2.49, .012, .28], [-.074, .285, -.448 + i * .31], batteryMat);
  const cooling = assembly('battery-cooling', 'powertrain', [0, .22, 0]);
  for (const side of [-1, 1]) tube(cooling, [[1.25, .299, side * .59], [.5, .299, side * .59], [-.4, .299, side * .59], [-1.33, .299, side * .59]], .011, blue);
  const bms = assembly('bms', 'powertrain', [-.18, .7, 0]); box(bms, [.3, .054, .25], [-1.15, .35, .38], blue, .025);
  const pdu = assembly('pdu', 'powertrain', [.18, .7, 0]); box(pdu, [.32, .12, .31], [.91, .39, 0], alloy, .025);
  for (const side of [-1, 1]) box(pdu, [.085, .066, .046], [.98, .44, side * .18], orange, .015);
  for (const [id, x, scale] of [['motor-front', 1.35, .83], ['motor-rear', -1.39, 1]] as const) {
    const motor = assembly(id, 'powertrain', [Math.sign(x) * .40, .30, 0]);
    const housing = mesh(motor, new THREE.CylinderGeometry(.15 * scale, .15 * scale, .44, 32, 1, true, Math.PI * .20, Math.PI * 1.45), alloy, [x, .43, 0]); housing.rotation.x = Math.PI / 2;
    const rotor = new THREE.Group(); rotor.position.set(x, .43, 0); motor.add(rotor);
    cylinder(rotor, .098 * scale, .385, [0, 0, 0], orange, 'z', 24);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; box(rotor, [.017, .017, .36], [Math.cos(a) * .10 * scale, Math.sin(a) * .10 * scale, 0], alloy, .004); }
    gear(rotor, .108 * scale, .018, [0, 0, .222], paleSteel); rotors.push({ object: rotor, ratio: 1 });
    for (const s of [-1, 1]) { cylinder(motor, .124 * scale, .052, [x, .43, s * .244], satin, 'z'); cylinder(motor, .043, .26, [x, .40, s * .40], steel, 'z'); }
    for (let i = 0; i < 6; i++) { const fin = mesh(motor, new THREE.CylinderGeometry(.153 * scale, .153 * scale, .009, 24, 1, true, Math.PI * .20, Math.PI * 1.45), steel, [x, .43, -.17 + i * .065]); fin.rotation.x = Math.PI / 2; }
    const output = new THREE.Group(); output.position.set(x, .40, 0); motor.add(output); gear(output, .082, .022, [0, 0, -.29], alloy);
    for (const s of [-1, 1]) { cylinder(output, .031, .34, [0, 0, s * .49], satin, 'z'); box(output, [.012, .06, .24], [0, 0, s * .50], paleSteel); }
    rotors.push({ object: output, ratio: 1 / 9 });
    box(motor, [.29, .092, .32], [x - .035, .58, 0], paleSteel, .02);
  }
  const inverter = assembly('inverter', 'powertrain', [-.32, .62, 0]); box(inverter, [.39, .102, .40], [-1.45, .639, 0], alloy, .024);
  for (let i = 0; i < 8; i++) box(inverter, [.33, .012, .017], [-1.45, .696, -.15 + i * .043], satin);
  const octovalve = assembly('octovalve', 'powertrain', [.55, .50, -.10]);
  box(octovalve, [.18, .17, .19], [1.52, .67, -.37], black, .04);
  for (let i = 0; i < 4; i++) tube(octovalve, [[1.52, .66, -.34 + i * .025], [1.65 + i * .035, .62, -.30], [1.78 + i * .035, .51, -.19]], .015, blue);
  const radiator = assembly('radiator', 'powertrain', [.73, .19, 0]);
  box(radiator, [.054, .24, 1.12], [1.92, .51, 0], satin, .025);
  for (let i = 0; i < 19; i++) box(radiator, [.061, .21, .011], [1.92, .51, -.51 + i * .057], alloy);

  const frontSusp = assembly('suspension-front', 'chassis', [.35, -.08, 0]);
  const rearSusp = assembly('suspension-rear', 'chassis', [-.35, -.08, 0]);
  const brakes = assembly('brakes', 'chassis', [0, -.1, 0]);
  for (const x of [-1.4375, 1.4375]) for (const side of [-1, 1]) {
    const susp = x > 0 ? frontSusp : rearSusp;
    const links: { mesh: THREE.Mesh; fixed: THREE.Vector3; moving: THREE.Vector3 }[] = [];
    for (const [dx, fy, fz, my, mz, radius] of [[-.26, .34, .44, .335, .8, .027], [.26, .34, .44, .335, .8, .027], [-.18, .57, .45, .53, .74, .02], [.17, .58, .45, .53, .74, .02], [-.04, .73, .64, .33, .71, .023]]) {
      const fixed = new THREE.Vector3(x + dx, fy, side * fz), moving = new THREE.Vector3(x, my, side * mz); links.push({ mesh: link(susp, fixed, moving, radius, steel), fixed, moving });
    }
    const spring = new THREE.Group(); spring.position.set(x, .41, side * .69); susp.add(spring);
    const coil = Array.from({ length: 91 }, (_, i) => { const t = i / 90; return [-.04 * t + Math.cos(t * Math.PI * 12) * .052, t * .27, side * (-.05 * t) + Math.sin(t * Math.PI * 12) * .052]; });
    tube(spring, coil, .009, black);
    const brake = new THREE.Group(); brake.position.set(x, .343, side * .826); brakes.add(brake);
    const disc = cylinder(brake, .205, .022, [0, 0, -side * .028], alloy, 'z', 48);
    disc.userData.partId = 'brakes';
    cylinder(brake, .095, .032, [0, 0, -side * .016], satin, 'z');
    box(brake, [.09, .20, .074], [.148, .007, -side * .028], satin, .027);
    suspensionMotion.push({ front: x > 0, side, spring, brake, links });
    const id = `wheel-${x > 0 ? 'f' : 'r'}${side < 0 ? 'l' : 'r'}`;
    const wheel = assembly(id, 'chassis', [0, -.07, side * .57]);
    const steer = new THREE.Group(); steer.position.set(x, .343, side * .826); wheel.add(steer);
    const spin = new THREE.Group(); steer.add(spin);
    mesh(spin, new THREE.TorusGeometry(.263, .079, 14, 64), rubber).scale.z = 1.28;
    // Sidewall rings and restrained machined turbine aero wheel.
    for (const depth of [-.091, .091]) mesh(spin, new THREE.TorusGeometry(.258, .007, 5, 48), rubber, [0, 0, depth]);
    cylinder(spin, .254, .15, [0, 0, 0], satin, 'z', 48);
    const face = side * .093;
    mesh(spin, new THREE.TorusGeometry(.237, .010, 6, 48), alloy, [0, 0, face]);
    cylinder(spin, .086, .032, [0, 0, face], satin, 'z');
    for (let i = 0; i < 10; i++) {
      const spoke = new THREE.Group(); spoke.rotation.z = i * Math.PI * .2; spin.add(spoke);
      polygon(spoke, [[.060, -.030, face], [.22, -.034, face], [.228, .02, face], [.10, .05, face]], i % 2 ? satin : alloy);
      tube(spoke, [[.092, -.028, face + side * .003], [.216, -.029, face + side * .003]], .004, alloy, false);
    }
    cylinder(spin, .043, .039, [0, 0, face], black, 'z', 20);
    tube(spin, [[-.015, .013, face + side * .023], [0, .017, face + side * .023], [.015, .013, face + side * .023]], .003, alloy);
    tube(spin, [[0, .014, face + side * .023], [0, -.014, face + side * .023]], .003, alloy, false);
    wheels.push({ steer, spin, front: x > 0, side });
  }
  const rack = assembly('steering-rack', 'chassis', [.46, .05, 0]);
  cylinder(rack, .036, 1.37, [1.18, .38, 0], alloy, 'z');
  tube(rack, [[1.18, .38, -.45], [.86, .64, -.44], [.47, .92, -.44]], .022, steel, false);

  const dashboard = assembly('dashboard', 'interior', [.1, .50, 0]);
  box(dashboard, [.32, .14, 1.43], [.82, .835, 0], softBlack, .035);
  box(dashboard, [.075, .032, 1.38], [.64, .879, 0], cream, .012);
  tube(dashboard, [[.661, .905, -.69], [.639, .914, 0], [.661, .905, .69]], .004, light);
  const console = box(dashboard, [.90, .25, .24], [.1, .51, 0], softBlack, .05); console.rotation.z = -.05;
  box(dashboard, [.34, .02, .22], [.31, .65, 0], satin, .015);
  for (const x of [.03, -.12]) cylinder(dashboard, .052, .018, [x, .65, 0], black, 'y', 20);
  const display = assembly('touchscreen', 'interior', [.07, .73, 0]);
  const screenMount = new THREE.Group(); screenMount.position.set(.62, .91, 0); screenMount.rotation.z = -.10; display.add(screenMount);
  box(screenMount, [.025, .227, .37], [0, 0, 0], black, .009);
  box(screenMount, [.002, .207, .347], [-.015, 0, 0], screen, .004);
  // Deliberately simplified screen interface, visible in the cockpit preset.
  box(screenMount, [.004, .135, .004], [-.018, .012, -.02], alloy);
  for (let i = 0; i < 4; i++) box(screenMount, [.005, .005, .070 - .009 * i], [-.019, .062 - i * .024, .084], paleSteel);
  for (let i = 0; i < 5; i++) box(screenMount, [.005, .009, .012], [-.019, -.083, -.135 + i * .067], blue, .002);
  tube(screenMount, [[-.018, -.035, -.16], [-.018, -.012, -.085], [-.018, .057, -.11]], .003, blue, false);
  const steeringWheel = assembly('steering-wheel', 'interior', [.03, .55, -.08]);
  const wheelMount = new THREE.Group(); wheelMount.position.set(.40, .89, -.445); wheelMount.rotation.y = Math.PI / 2; wheelMount.rotation.x = .20; steeringWheel.add(wheelMount);
  mesh(wheelMount, new THREE.TorusGeometry(.143, .018, 9, 40), black);
  box(wheelMount, [.105, .078, .043], [0, -.006, 0], softBlack, .025);
  for (const s of [-1, 1]) tube(wheelMount, [[0, -.035, 0], [s * .088, -.038, 0], [s * .126, .04, 0]], .014, satin);
  tube(wheelMount, [[0, -.045, 0], [0, -.125, 0]], .016, black, false);
  const frontSeats = assembly('seat-front', 'interior', [0, .61, 0]);
  for (const side of [-1, 1]) {
    const z = side * .43;
    box(frontSeats, [.52, .13, .46], [-.16, .47, z], cream, .065);
    const back = box(frontSeats, [.13, .52, .455], [-.41, .75, z], cream, .075); back.rotation.z = -.16;
    box(frontSeats, [.105, .20, .25], [-.454, 1.095, z], cream, .055);
    for (const s of [-1, 1]) { box(frontSeats, [.43, .055, .055], [-.17, .545, z + s * .19], cream, .025); const bolster = box(frontSeats, [.07, .36, .060], [-.32, .75, z + s * .19], cream, .029); bolster.rotation.z = -.16; }
    tube(frontSeats, [[-.44, 1.0, z - side * .20], [-.34, .77, z + side * .18], [-.17, .51, z + side * .18]], .012, black);
    box(frontSeats, [.045, .07, .035], [-.31, .55, z - side * .25], black, .012);
  }
  const rearSeat = assembly('seat-rear', 'interior', [-.15, .61, 0]);
  box(rearSeat, [.45, .13, 1.32], [-.93, .49, 0], cream, .055);
  const rearBack = box(rearSeat, [.13, .42, 1.31], [-1.19, .74, 0], cream, .05); rearBack.rotation.z = -.24;
  for (const z of [-.44, 0, .44]) box(rearSeat, [.115, .17, .25], [-1.245, .997, z], cream, .04);
  const airbags = assembly('airbags', 'body', [.15, .55, .20]);
  box(airbags, [.09, .045, .18], [.80, .852, -.43], paleSteel, .018);
  for (const side of [-1, 1]) tube(airbags, [[.42, 1.37, side * .66], [-.3, 1.415, side * .67], [-.95, 1.35, side * .65]], .014, cream);
  const fsd = assembly('fsd-computer', 'adas', [.25, .48, -.18]);
  box(fsd, [.20, .045, .20], [.78, .64, -.54], satin, .016);
  for (let i = 0; i < 7; i++) box(fsd, [.17, .012, .008], [.78, .671, -.613 + .024 * i], alloy);
  const cameras = assembly('cameras', 'adas', [0, .24, 0]);
  box(cameras, [.15, .052, .19], [.52, 1.305, 0], black, .02);
  for (const z of [-.055, 0, .055]) cylinder(cameras, .014, .008, [.596, 1.31, z], blue, 'x', 16);
  for (const side of [-1, 1]) {
    cylinder(cameras, .014, .012, [-.16, 1.08, side * .839], black, 'z', 14);
    cylinder(cameras, .011, .006, [1.09, .76, side * .915], blue, 'z', 14);
  }
  cylinder(cameras, .012, .01, [-2.373, .638, 0], blue, 'x', 16);
  const hv = assembly('hv-harness', 'powertrain', [0, .35, .08]);
  tube(hv, [[-1.48, .67, .19], [-1.13, .36, .36], [.45, .34, .37], [.9, .42, .2], [1.38, .59, .2]], .018, orange, false);
  tube(hv, [[.9, .42, -.16], [1.27, .50, -.28], [1.52, .67, -.25]], .016, orange, false);
  tube(hv, [[-1.45, .6, -.20], [-1.83, .64, -.40], [-2.12, .765, -.8]], .015, orange);
  const lv = assembly('lv-harness', 'body', [0, .40, -.15]);
  tube(lv, [[1.75, .67, -.55], [.77, .67, -.58], [.52, 1.30, 0]], .009, paleSteel, false);
  tube(lv, [[.78, .67, -.58], [.25, .42, -.71], [-.85, .42, -.71], [-1.55, .68, -.48], [-2.2, .68, 0]], .010, paleSteel);

  // Batch static geometry within each assembly and animation boundary. Meshes whose
  // transforms are driven each frame remain separate; selection still resolves to
  // the containing catalog assembly. Transparent glazing keeps its own sort order.
  root.updateMatrixWorld(true);
  const movingObjects = new Set<THREE.Object3D>([
    cellLOD,nearCells,farCells,
    ...hinges.map(h => h.object), ...rotors.map(r => r.object), wheelMount,
    ...wheels.flatMap(w => [w.steer, w.spin]),
    ...suspensionMotion.flatMap(s => [s.spring, s.brake, ...s.links.map(l => l.mesh)]),
    ...struts.flatMap(s => [s.mesh, s.sleeve]),
  ]);
  function batchStatic(scope: THREE.Object3D) {
    const batches = new Map<THREE.Material, THREE.Mesh[]>();
    const inverse = scope.matrixWorld.clone().invert();
    function collect(object: THREE.Object3D) {
      for (const child of [...object.children]) {
        if (movingObjects.has(child)) { if (!(child instanceof THREE.Mesh)) batchStatic(child); continue; }
        if (child instanceof THREE.Mesh && !(child instanceof THREE.InstancedMesh) && !Array.isArray(child.material) && !child.material.transparent) {
          const batch = batches.get(child.material) ?? []; batch.push(child); batches.set(child.material, batch);
        }
        collect(child);
      }
    }
    collect(scope);
    for (const [material, batch] of batches) {
      if (batch.length < 2) continue;
      const transformed = batch.map(object => {
        const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
        for (const key of Object.keys(geometry.attributes)) if (key !== 'position' && key !== 'normal') geometry.deleteAttribute(key);
        geometry.clearGroups(); geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
        return geometry;
      });
      const geometry = mergeGeometries(transformed, false); transformed.forEach(g => g.dispose());
      if (!geometry) continue;
      batch.forEach(object => object.removeFromParent());
      const combined = mesh(scope, geometry, material); combined.name = `${scope.name || 'assembly'} · static batch`;
    }
  }
  assemblies.forEach(({ group }) => batchStatic(group));
  root.updateMatrixWorld(true);
  // Each registered assembly receives its own materials so highlighting never leaks.
  const aeroCold = new THREE.Color('#18598f'), aeroMid = new THREE.Color('#21c6d2'), aeroHot = new THREE.Color('#ff985b');
  for (const item of assemblies) {
    const id = item.group.name; const clones = new Map<THREE.Material, THREE.Material>();
    const highlighted: { material: THREE.MeshStandardMaterial; color: THREE.Color; intensity: number }[] = [];
    item.group.traverse(object => {
      object.userData.partId = id; object.userData.system = item.system;
      if (!(object instanceof THREE.Mesh)) return;
      const source = Array.isArray(object.material) ? object.material : [object.material];
      const mapped = source.map(m => {
        if (clones.has(m)) return clones.get(m)!;
        const clone = m.clone(); clone.forceSinglePass = true; clones.set(m, clone); materials.add(clone);
        if (clone instanceof THREE.MeshStandardMaterial) {
          highlighted.push({ material: clone, color: clone.emissive.clone(), intensity: clone.emissiveIntensity });
          if (m === paint) paintMaterials.push(clone as THREE.MeshPhysicalMaterial);
          if (item.system === 'exterior') translucent.push({ material: clone, opacity: clone.opacity, transparent: clone.transparent, depthWrite: clone.depthWrite });
        }
        return clone;
      });
      object.material = Array.isArray(object.material) ? mapped : mapped[0];
      if (source.includes(paint)) {
        const position = object.geometry.getAttribute('position'), colors = new Float32Array(position.count * 3);
        const color = new THREE.Color();
        for (let i = 0; i < position.count; i++) {
          vectorA.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
          const frontal = THREE.MathUtils.smoothstep(vectorA.x, .45, 2.4) * (1 - .34 * Math.abs(vectorA.z));
          color.copy(aeroCold).lerp(aeroMid, Math.min(1, frontal * 1.9));
          color.lerp(aeroHot, THREE.MathUtils.smoothstep(frontal, .72, 1)); color.toArray(colors, i * 3);
        }
        object.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      }
    });
    selectionMaterials.set(id, highlighted);
  }
  let lastPaint = '', lastSelected: string | null = null, lastMode = '';
  let rotation = 0, motorRotation = 0, resetNonce = -1;
  const currentExplosion = { value: 0 };
  function update(state: SimulationState, telemetry: Telemetry, time: number, dt: number) {
    const step = Math.min(.05, Math.max(0, dt));
    if (resetNonce !== state.resetNonce) { rotation = 0; motorRotation = 0; resetNonce = state.resetNonce; }
    const smooth = 1 - Math.exp(-step * 8);
    const explodeTarget = state.mode === 'exploded' ? state.explosion * 2.1 : 0;
    currentExplosion.value = THREE.MathUtils.lerp(currentExplosion.value, explodeTarget, smooth);
    for (const { group, system, base, offset } of assemblies) {
      group.visible = state.isolated ? state.isolated === group.name : state.visible[system];
      group.position.copy(base).addScaledVector(offset, currentExplosion.value);
    }
    if (lastPaint !== state.paint || lastMode !== state.mode) {
      paintMaterials.forEach(m => { m.color.set(state.mode === 'aero' ? '#ffffff' : state.paint); const vertexColors = state.mode === 'aero'; if (m.vertexColors !== vertexColors) { m.vertexColors = vertexColors; m.needsUpdate = true; } });
      lastPaint = state.paint;
    }
    const xray = ['xray', 'thermal', 'energy'].includes(state.mode);
    for (const { material, opacity, transparent, depthWrite } of translucent) {
      const target = xray ? opacity * (state.mode === 'xray' ? state.opacity : .13) : opacity;
      material.opacity = THREE.MathUtils.lerp(material.opacity, target, smooth);
      material.transparent = xray || transparent || material.opacity < .995;
      material.depthWrite = xray ? false : depthWrite;
      if (lastMode !== state.mode) material.needsUpdate = true;
    }
    lastMode = state.mode;
    if (lastSelected !== state.selected) {
      for (const [id, entries] of selectionMaterials) for (const { material, color, intensity } of entries) {
        material.emissive.copy(color); material.emissiveIntensity = intensity;
        if (id === state.selected) { material.emissive.set('#16c9dc'); material.emissiveIntensity = .30; }
      }
      lastSelected = state.selected;
    }
    for (const { object, door, axis, angle } of hinges) object.rotation[axis] = THREE.MathUtils.lerp(object.rotation[axis], state.doors[door] ? angle : 0, smooth);
    for (const strut of struts) {
      vectorA.copy(strut.moving).applyEuler(strut.pivot.rotation).add(strut.pivot.position);
      positionLink(strut.mesh, strut.fixed, vectorA);
      vectorB.copy(strut.fixed).lerp(vectorA, .52); positionLink(strut.sleeve, strut.fixed, vectorB);
    }
    if (state.running) rotation += (telemetry.speed / 3.6 / .343) * step;
    if (state.running) motorRotation += telemetry.rpm / 60 * Math.PI * 2 * step;
    for (const rotor of rotors) rotor.object.rotation.z = -motorRotation * rotor.ratio;
    const steeringRadians = THREE.MathUtils.degToRad(state.steering);
    const wheelAngles = ackermannAngles(state.steering);
    for (const wheel of wheels) {
      wheel.spin.rotation.z = -rotation;
      wheel.steer.rotation.y = wheel.front ? (wheel.side < 0 ? wheelAngles.left : wheelAngles.right) : 0;
      wheel.steer.position.y = .343 + Math.sin(time * 7 + (wheel.front ? 0 : 2.5) + wheel.side * .4) * (state.road / 100) * .045;
    }
    for (const suspension of suspensionMotion) {
      const bump = Math.sin(time * 7 + (suspension.front ? 0 : 2.5) + suspension.side * .4) * (state.road / 100) * .045;
      suspension.spring.position.y = .41 + bump; suspension.spring.scale.y = (.27 - bump) / .27;
      suspension.brake.position.y = .343 + bump; suspension.brake.rotation.y = suspension.front ? (suspension.side < 0 ? wheelAngles.left : wheelAngles.right) : 0;
      for (const arm of suspension.links) { vectorA.copy(arm.moving); vectorA.y += bump; positionLink(arm.mesh, arm.fixed, vectorA); }
    }
    wheelMount.rotation.z = -steeringRadians * 4;
  }
  function dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); }
  return { root, parts, update, dispose };
}
