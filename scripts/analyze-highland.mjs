import fs from 'node:fs';
fs.mkdirSync('.tmp', { recursive: true });
const buf=fs.readFileSync('public/models/highland/source.glb');let off=12,j,bin;while(off<buf.length){let len=buf.readUInt32LE(off),type=buf.readUInt32LE(off+4);const b=buf.subarray(off+8,off+8+len);if(type===0x4e4f534a)j=JSON.parse(b);else bin=b;off+=8+len;}
console.log(JSON.stringify({asset:j.asset,nodes:j.nodes,materials:j.materials.map((m,i)=>({i,...m}))},null,2));
const comps=[];
for(let mi=0;mi<j.meshes.length;mi++)for(const p of j.meshes[mi].primitives){function acc(id){const a=j.accessors[id],v=j.bufferViews[a.bufferView],w={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],sz={5126:4,5125:4,5123:2}[a.componentType],get={5126:'readFloatLE',5125:'readUInt32LE',5123:'readUInt16LE'}[a.componentType];const ar=[];for(let i=0;i<a.count;i++)for(let k=0;k<w;k++)ar.push(bin[get]((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||sz*w)+k*sz));return ar;}
const xyz=acc(p.attributes.POSITION),ind=acc(p.indices),n=xyz.length/3,pa=Array.from({length:n},(_,i)=>i),weld=new Map();const root=i=>{while(pa[i]!==i){pa[i]=pa[pa[i]];i=pa[i];}return i;};const join=(a,b)=>pa[root(a)]=root(b);
for(let i=0;i<n;i++){let key=xyz.slice(i*3,i*3+3).map(v=>Math.round(v*1e5)).join(',');if(weld.has(key))join(i,weld.get(key));else weld.set(key,i);}for(let i=0;i<ind.length;i+=3){join(ind[i],ind[i+1]);join(ind[i],ind[i+2]);}
const groups=new Map();for(let i=0;i<ind.length;i+=3){let r=root(ind[i]);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(...ind.slice(i,i+3));}
let ci=0;for(const ids of groups.values()){let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const id of ids)for(let k=0;k<3;k++){min[k]=Math.min(min[k],xyz[id*3+k]);max[k]=Math.max(max[k],xyz[id*3+k]);}comps.push({mi,ci:ci++,mat:p.material,tri:ids.length/3,min,max});}
}
fs.writeFileSync('.tmp/highland-components.json',JSON.stringify(comps,null,2));console.log('COMPONENTS',comps.length);console.log(comps.filter(c=>c.tri>100).map(c=>JSON.stringify(c)).join('\n'));
