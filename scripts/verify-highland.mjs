import fs from 'node:fs';
import assert from 'node:assert/strict';

function load(path) {
  const file = fs.readFileSync(path); let offset = 12, json, binary;
  assert.equal(file.readUInt32LE(0), 0x46546c67);
  assert.equal(file.readUInt32LE(8), file.length);
  while (offset < file.length) {
    const length = file.readUInt32LE(offset), type = file.readUInt32LE(offset + 4);
    const data = file.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(data); else binary = data;
    offset += 8 + length;
  }
  return { json, binary };
}
function faces(asset, accessorId) {
  const accessor = asset.json.accessors[accessorId], view = asset.json.bufferViews[accessor.bufferView];
  const method = accessor.componentType === 5125 ? 'readUInt32LE' : 'readUInt16LE';
  const bytes = accessor.componentType === 5125 ? 4 : 2;
  const result = [];
  for (let i = 0; i < accessor.count; i += 3) {
    result.push([0, 1, 2].map(k => asset.binary[method]((view.byteOffset || 0) + (accessor.byteOffset || 0) + (i + k) * bytes)).join(','));
  }
  return result;
}
const source = load('public/models/highland/source.glb'), adapted = load('public/models/highland/highland.glb');
assert.ok(adapted.binary.subarray(0, source.binary.length).equals(source.binary), 'Original vertex/normal/UV/texture bytes must remain unchanged');
for (const key of ['author', 'source', 'license', 'title']) assert.equal(adapted.json.asset.extras[key], source.json.asset.extras[key]);
const expected = source.json.meshes.map(mesh => faces(source, mesh.primitives[0].indices).sort());
const actual = expected.map(() => []);
for (const mesh of adapted.json.meshes) {
  const sourceMesh = Number(mesh.name.split('-').at(-1));
  assert.deepEqual(mesh.primitives[0].attributes, source.json.meshes[sourceMesh].primitives[0].attributes);
  actual[sourceMesh].push(...faces(adapted, mesh.primitives[0].indices));
}
expected.forEach((triangles, index) => assert.deepEqual(actual[index].sort(), triangles, `Exact oriented face preservation for source mesh ${index}`));
const ids = new Set(adapted.json.nodes.map(node => node.extras?.partId).filter(Boolean));
for (const id of ['door-fl', 'door-fr', 'door-rl', 'door-rr', 'hood', 'wheel-fl', 'wheel-fr', 'wheel-rl', 'wheel-rr']) assert.ok(ids.has(id));
console.log(`PASS: ${expected.flat().length} exact oriented triangles preserved across ${expected.length} source meshes; original buffers and attribution unchanged; ${ids.size} mapped part IDs.`);
