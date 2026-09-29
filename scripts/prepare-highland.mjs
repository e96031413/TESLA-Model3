import fs from 'node:fs';
fs.mkdirSync('.tmp', { recursive: true });
const buf=fs.readFileSync('public/models/highland/source.glb');let off=12,j,bin;while(off<buf.length){let len=buf.readUInt32LE(off),type=buf.readUInt32LE(off+4);const b=buf.subarray(off+8,off+8+len);if(type===0x4e4f534a)j=JSON.parse(b);else bin=b;off+=8+len;}
const originalMeshes=j.meshes, buckets=new Map(), comps=[];
function classify(c){
 const {min:lo,max:hi,mat,mi,ci}=c,mid=lo.map((x,i)=>(x+hi[i])/2),side=mid[1]<-9.93044?'r':'l';
 // Original consecutive steering rim, hub, controls and lettering components.
 if(mi===11&&ci>=2&&ci<=19)return 'steering-wheel';
 if((mi===6&&ci===2)||(mi===11&&[191,302].includes(ci))||(mi===12&&[69,75,90,94,97].includes(ci)))return 'dashboard';
 for(const [axle,center] of [['r',-10.4285],['f',.2325]]) if(lo[0]>center-1.31&&hi[0]<center+1.31&&hi[2]<2.60&&(hi[1]<-12.40||lo[1]>-7.45))return `wheel-${axle}${side}`;
 if((mi===9&&ci===0)||(mi===11&&ci===112))return 'hood';
 if(mat===8)return 'glazing';
 if(mat===13)return 'taillights';
 if([7,10,14,15].includes(mat)&&lo[0]>1.1)return 'headlights';
 if(hi[1]<-12.15||lo[1]>-7.71){
  if(lo[0]>-10.12&&hi[0]<-5.80&&hi[0]-lo[0]<4.3&&hi[2]>.9)return `door-r${side}`;
  if(lo[0]>-6.46&&hi[0]<-1.60&&hi[0]-lo[0]<4.7&&hi[2]>.9)return `door-f${side}`;
 }
 if(mat===0||mat===1)return 'touchscreen';
 if(mat===15&&lo[0]>-6.9&&hi[0]<-3.8)return 'seat-front';
 if(mat===15&&lo[0]>-10.2&&hi[0]<-7.1)return 'seat-rear';
 return 'body-shell';
}
for(let mi=0;mi<j.meshes.length;mi++)for(const p of j.meshes[mi].primitives){function acc(id){const a=j.accessors[id],v=j.bufferViews[a.bufferView],w={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],sz={5126:4,5125:4,5123:2}[a.componentType],get={5126:'readFloatLE',5125:'readUInt32LE',5123:'readUInt16LE'}[a.componentType];const ar=[];for(let i=0;i<a.count;i++)for(let k=0;k<w;k++)ar.push(bin[get]((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||sz*w)+k*sz));return ar;}
const xyz=acc(p.attributes.POSITION),ind=acc(p.indices),n=xyz.length/3,pa=Array.from({length:n},(_,i)=>i),weld=new Map();const root=i=>{while(pa[i]!==i){pa[i]=pa[pa[i]];i=pa[i];}return i;};const join=(a,b)=>pa[root(a)]=root(b);
for(let i=0;i<n;i++){let key=xyz.slice(i*3,i*3+3).map(v=>Math.round(v*1e5)).join(',');if(weld.has(key))join(i,weld.get(key));else weld.set(key,i);}for(let i=0;i<ind.length;i+=3){join(ind[i],ind[i+1]);join(ind[i],ind[i+2]);}
const groups=new Map();for(let i=0;i<ind.length;i+=3){let r=root(ind[i]);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(...ind.slice(i,i+3));}
let ci=0;for(const ids of groups.values()){let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const id of ids)for(let k=0;k<3;k++){min[k]=Math.min(min[k],xyz[id*3+k]);max[k]=Math.max(max[k],xyz[id*3+k]);}const c={mi,ci:ci++,mat:p.material,tri:ids.length/3,min,max};const part=classify(c);comps.push({...c,part});const key=`${part}:${mi}`;if(!buckets.has(key))buckets.set(key,{part,mi,p,ids:[]});for(const id of ids)buckets.get(key).ids.push(id);}
}
// Append indices; all original vertex attributes, textures and metadata remain intact.
const chunks=[bin];let byteLength=bin.length;j.meshes=[];j.nodes=[];const children=[];
for(const {part,mi,p,ids} of buckets.values()){
 const data=Buffer.alloc(ids.length*4);ids.forEach((id,i)=>data.writeUInt32LE(id,i*4));
 const view=j.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:data.length,target:34963})-1;
 const accessor=j.accessors.push({bufferView:view,componentType:5125,count:ids.length,type:'SCALAR'})-1;
 chunks.push(data);byteLength+=data.length;
 const mesh=j.meshes.push({name:`${part}-${mi}`,primitives:[{...p,indices:accessor}]})-1;
 children.push(j.nodes.length);j.nodes.push({mesh,name:`${part}-${mi}`,extras:{partId:part,sourceMaterial:p.material}});
}
const scale=4.72/17.51373028755188,rootIndex=j.nodes.length;
j.nodes.push({name:'Highland original artist geometry',children,matrix:[scale,0,0,0,0,0,-scale,0,0,scale,0,0,5.098*scale,0,-9.93044*scale,1]});
j.scenes=[{nodes:[rootIndex]}];j.scene=0;j.buffers=[{byteLength}];
j.asset.extras.adaptation='Topology-preserving component grouping, normalized to 4.72 m body length; no triangles cut or removed.';
const jsonText=JSON.stringify(j),json=Buffer.from(jsonText+' '.repeat((4-Buffer.byteLength(jsonText)%4)%4)),data=Buffer.concat(chunks),out=Buffer.alloc(28+json.length+data.length);
out.writeUInt32LE(0x46546c67);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);out.writeUInt32LE(data.length,20+json.length);out.writeUInt32LE(0x004e4942,24+json.length);data.copy(out,28+json.length);
const sourceTriangles=originalMeshes.flatMap(m=>m.primitives).reduce((s,p)=>s+j.accessors[p.indices].count/3,0),outputTriangles=comps.reduce((s,c)=>s+c.tri,0);
if(sourceTriangles!==outputTriangles)throw Error('Triangle preservation failed');
fs.writeFileSync('public/models/highland/highland.glb',out);
fs.writeFileSync('.tmp/highland-adaptation.json',JSON.stringify({sourceTriangles,outputTriangles,components:comps.length,groups:buckets.size,scale,report:comps},null,2));
console.log({sourceTriangles,outputTriangles,components:comps.length,groups:buckets.size,bytes:out.length});
