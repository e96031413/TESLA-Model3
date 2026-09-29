import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createVehicle } from './vehicle';
import { loadHighlandModel } from './highland';
import { stepPhysics } from './physics';
import { PARTS } from './catalog';
import { INITIAL_TELEMETRY } from './types';
import type { SceneProps, Mode, ViewPreset } from './types';

type Flow = { group: THREE.Group; curves: THREE.CatmullRomCurve3[]; points: THREE.Points; positions: Float32Array; speed: number };
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function makeFlow(paths: number[][][], color: string, speed: number): Flow {
  const group = new THREE.Group();
  const curves = paths.map(path => new THREE.CatmullRomCurve3(path.map(p => v(p[0], p[1], p[2]))));
  const lines: THREE.Vector3[] = [];
  curves.forEach(curve => { const ps = curve.getPoints(80); for (let j = 0; j < ps.length - 1; j++) lines.push(ps[j], ps[j + 1]); });
  const traces=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .52, depthWrite: false, depthTest: false }));traces.renderOrder=12;group.add(traces);
  const positions = new Float32Array(curves.length * 12 * 3);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d')!; const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(.3, 'rgba(255,255,255,.95)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 32, 32);
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size: .075, map: new THREE.CanvasTexture(canvas), transparent: true, opacity: 1, depthWrite: false, depthTest: false }));points.renderOrder=13;
  group.add(points); group.visible = false;
  return { group, curves, points, positions, speed };
}

function buildFlows() {
  const aero: number[][][] = [];
  for (let row = 0; row < 5; row++) for (let column = 0; column < 5; column++) {
    const z = (column - 2) * .66, height = .25 + row * .46;
    const over = Math.abs(z) < 1.03 ? Math.max(0, 1.7 - height) : .06;
    aero.push([[3.9, height, z], [2.7, height + over * .16, z], [1.5, height + over * .55, z * 1.12], [.25, height + over, z * 1.12], [-1, height + over * .86, z * 1.15], [-2.5, height + over * .25, z * 1.08], [-4, height, z]]);
  }
  const cold = [ [[1.7,.67,-.52],[1,.45,-.7],[-1.3,.28,-.65],[-1.3,.28,-.25],[1.2,.28,-.25],[1.2,.28,.15],[-1.3,.28,.15],[-1.3,.28,.55],[1.5,.5,.6],[1.7,.67,-.52]], [[1.7,.67,-.52],[1.2,.75,-.4],[.8,.8,0],[1.2,.75,.4],[1.7,.67,-.52]] ];
  const hot = [ [[1.7,.69,.42],[1,.36,.73],[-1.5,.4,.65],[-1.65,.6,0],[-1.5,.4,-.6],[1.5,.55,-.65],[2,.75,0],[1.7,.69,.42]], [[1.7,.69,.42],[1.4,.57,.4],[1.45,.5,-.42],[1.7,.69,.42]] ];
  const energy = [ [[0,.34,0],[.9,.35,.1],[1.5,.57,.15],[1.5,.52,0]], [[0,.34,0],[-.8,.35,.05],[-1.55,.57,.12],[-1.55,.52,0]] ];
  return { aero: makeFlow(aero, '#3198de', .13), cold: makeFlow(cold, '#149bee', .18), hot: makeFlow(hot, '#fb6248', .18), energy: makeFlow(energy, '#4a77ff', .55) };
}

function textSprite(text: string) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d')!; ctx.font = '500 35px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#77849b'; ctx.fillText(text, 256, 48);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }));
  sprite.scale.set(1.25, .234, 1); return sprite;
}

function buildDimensions() {
  const group = new THREE.Group(); const points: THREE.Vector3[] = [];
  const line = (a: number[], b: number[]) => points.push(v(...a as [number, number, number]), v(...b as [number, number, number]));
  line([-2.36,.02,-1.5],[2.36,.02,-1.5]);
  for (const x of [-2.36, 2.36]) { line([x,.02,-1.65],[x,.02,-1.1]); line([x-.06,.02,-1.44],[x+.06,.02,-1.56]); }
  line([-2.85,.02,-.925],[-2.85,.02,.925]);
  for (const z of [-.925,.925]) line([-3,.02,z],[-2.5,.02,z]);
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#a0acc2' })));
  const length = textSprite('4,720 mm'); length.position.set(0,.12,-1.67); group.add(length);
  const width = textSprite('1,850 mm'); width.position.set(-2.96,.12,0); group.add(width); group.visible = false;
  return group;
}

const presets: Record<ViewPreset, { pos: number[]; target: number[] }> = {
  perspective: { pos: [6.1, 3.2, -6.2], target: [0,.64,0] },
  front: { pos: [8, 1.8, 0], target: [0,.68,0] },
  side: { pos: [0, 1.6, -8.8], target: [0,.68,0] },
  top: { pos: [.001, 9.8, 0], target: [0,0,0] },
  cockpit: { pos: [-.24, 1.12, -.44], target: [1.7,.78,-.05] },
  battery: { pos: [3, 2.6, -3.4], target: [0,.26,0] },
  chassis: { pos: [4, .65, -3.5], target: [.6,.35,0] },
};

export default function VehicleScene(props: SceneProps) {
  const mount = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  const [error, setError] = useState('');
  const [assetStatus, setAssetStatus] = useState<'loading'|'ready'|'fallback'>('loading');
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  useEffect(() => {
    const host = mount.current!; let disposed = false; let frame = 0;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }); }
    catch { setError('此瀏覽器無法建立 WebGL 2 場景。請開啟硬體加速，或使用支援 WebGL 2 的瀏覽器。'); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65)); renderer.setClearColor('#f3f5f8');
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
    renderer.domElement.setAttribute('aria-label', 'Model 3 互動 3D 場景：拖曳旋轉，滾輪縮放，點擊選取零件'); renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none'; renderer.domElement.tabIndex = 0;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#f3f5f8'); scene.fog = new THREE.Fog('#f3f5f8', 14, 36);
    const camera = new THREE.PerspectiveCamera(33, 1, .025, 80); camera.zoom = 1.32;
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .07; controls.minDistance = .3; controls.maxDistance = 18; controls.maxPolarAngle = Math.PI * .49; controls.autoRotateSpeed = .65; controls.enablePan = true;
    const p = presets.perspective; camera.position.set(...p.pos as [number, number, number]); controls.target.set(...p.target as [number, number, number]); controls.update();
    const room = new RoomEnvironment(); const pmrem = new THREE.PMREMGenerator(renderer); const environment = pmrem.fromScene(room, .04); scene.environment = environment.texture; scene.environmentIntensity = 1.05; room.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight('#f2f6ff', '#a8acb7', 2.2));
    const key = new THREE.DirectionalLight('#ffffff', 3.3); key.position.set(3,7,-4); key.castShadow = true; key.shadow.mapSize.set(2048,2048); key.shadow.camera.left=-5; key.shadow.camera.right=5; key.shadow.camera.top=5; key.shadow.camera.bottom=-5; key.shadow.normalBias=.025; key.shadow.bias=-.0003; key.shadow.radius=3; scene.add(key);
    const fill = new THREE.DirectionalLight('#c9d9ff', 1.8); fill.position.set(-4,2,4); scene.add(fill);
    const rim = new THREE.DirectionalLight('#ffffff', 2); rim.position.set(-3,5,-3); scene.add(rim);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200,200), new THREE.MeshStandardMaterial({ color:'#f3f5f8', roughness: 1, metalness: 0 })); ground.rotation.x=-Math.PI/2; ground.position.y=-.065; ground.receiveShadow=true; scene.add(ground);
    const grid = new THREE.GridHelper(16,32,'#cdd5e0','#dce2ea'); grid.position.y=-.055; (grid.material as THREE.Material).transparent=true; (grid.material as THREE.Material).opacity=.34; scene.add(grid);
    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width=shadowCanvas.height=128; const sctx=shadowCanvas.getContext('2d')!; const grad=sctx.createRadialGradient(64,64,5,64,64,64); grad.addColorStop(0,'rgba(24,34,56,.35)');grad.addColorStop(.6,'rgba(24,34,56,.15)');grad.addColorStop(1,'rgba(24,34,56,0)');sctx.fillStyle=grad;sctx.fillRect(0,0,128,128);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6,3.4),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false})); shadow.rotation.x=-Math.PI/2;shadow.position.y=-.05;scene.add(shadow);
    const vehicle = createVehicle(); scene.add(vehicle.root);
    const originalParts=new Map(vehicle.parts);
    let highland:Awaited<ReturnType<typeof loadHighlandModel>>|null=null;
    loadHighlandModel().then(model=>{
      if(disposed){model.dispose();return;}
      highland=model;vehicle.root.add(model.root);
      for(const [id,objects] of model.parts)vehicle.parts.set(id,objects);
      setAssetStatus('ready');host.dataset.asset='highland';
    }).catch(error=>{if(!disposed){setAssetStatus('fallback');console.error('Highland model load failed',error);}});
    const flows = buildFlows(); Object.values(flows).forEach(f=>scene.add(f.group)); const dimensions=buildDimensions();scene.add(dimensions);
    const outline = new THREE.Box3Helper(new THREE.Box3(),new THREE.Color('#426cff')); outline.visible=false; (outline.material as THREE.Material).depthTest=false; outline.renderOrder=10;scene.add(outline);
    let hoverId: string|null=null, selectedId: string|null=null;
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(); let downX=0,downY=0,isDown=false,draggingSteering=false,initialSteering=0;
    const pick = (e: PointerEvent) => {
      const rect=renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
      for (const hit of raycaster.intersectObject(vehicle.root,true)) {
        let obj:THREE.Object3D|null=hit.object, visible=true, id:string|null=null;
        while(obj) { if (!obj.visible) visible=false; if (!id && typeof obj.userData.partId==='string') id=obj.userData.partId; obj=obj.parent; }
        if(visible&&id) return {id,x:e.clientX-rect.left,y:e.clientY-rect.top};
      } return null;
    };
    const onDown=(e:PointerEvent)=>{downX=e.clientX;downY=e.clientY;isDown=true;setHover(null);if(pick(e)?.id==='steering-wheel'&&latest.current.onSteering){draggingSteering=true;initialSteering=latest.current.state.steering;controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);latest.current.onSelect('steering-wheel');}};
    const onMove=(e:PointerEvent)=>{if(draggingSteering){latest.current.onSteering?.(THREE.MathUtils.clamp(initialSteering-(e.clientX-downX)*.22,-35,35));return;}if(isDown)return;const hit=pick(e);hoverId=hit?.id??null;renderer.domElement.style.cursor=hit?.id==='steering-wheel'?'ew-resize':hit?'pointer':'grab';setHover(hit);};
    const onUp=(e:PointerEvent)=>{isDown=false;if(draggingSteering){draggingSteering=false;controls.enabled=true;if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);return;}if(Math.hypot(e.clientX-downX,e.clientY-downY)<5){const hit=pick(e);latest.current.onSelect(hit?.id??null);}};
    const onLeave=()=>{hoverId=null;if(!draggingSteering)isDown=false;setHover(null);};
    const onCancel=()=>{draggingSteering=false;isDown=false;controls.enabled=true;};
    renderer.domElement.addEventListener('pointerdown',onDown,{capture:true});renderer.domElement.addEventListener('pointermove',onMove);renderer.domElement.addEventListener('pointerup',onUp);renderer.domElement.addEventListener('pointercancel',onCancel);renderer.domElement.addEventListener('pointerleave',onLeave);
    const onContextLost=(e:Event)=>{e.preventDefault();setError('3D 繪圖連線已中斷，請重新整理頁面以恢復場景。');};renderer.domElement.addEventListener('webglcontextlost',onContextLost);
    const resize = () => {const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;const fov=latest.current.state.view==='cockpit'?65:33;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(fov)/2)*Math.max(1,1.3/camera.aspect)));camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(host);resize();
    let last=performance.now(),elapsed=0,simulationTime=0,lastReport=last,frames=0,telemetry={...INITIAL_TELEMETRY},viewNonce=-1,resetNonce=latest.current.state.resetNonce,lastMode:Mode='showroom';
    let cameraMoving=false,lastIsolated:string|null=null;const targetPosition=new THREE.Vector3(),targetLook=new THREE.Vector3();
    const stopTransition=()=>{cameraMoving=false;};controls.addEventListener('start',stopTransition);
    let firstFrame=true;
    const animate = (now:number) => {
      if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;
      if(document.hidden)return;
      const {state}=latest.current;elapsed+=dt;
      if(resetNonce!==state.resetNonce){resetNonce=state.resetNonce;telemetry={...INITIAL_TELEMETRY};elapsed=0;simulationTime=0;latest.current.onTelemetry(telemetry);}
      if(state.running)simulationTime+=dt;
      telemetry=stepPhysics(telemetry,state,dt);vehicle.update(state,telemetry,simulationTime,dt);
      if(highland){
        highland.update(state,telemetry,simulationTime,dt);
        if((state.mode==='showroom'||state.mode==='aero')&&state.visible.exterior&&!state.isolated){
          originalParts.forEach(objects=>objects.forEach(object=>{object.visible=false;}));
        }
        for(const id of highland.replacedPartIds){
          const schematic=(id==='trunk'&&(state.doors.trunk||state.selected===id||state.isolated===id))||(id==='charge-port'&&(state.doors.charge||state.selected===id||state.isolated===id));
          originalParts.get(id)?.forEach(object=>{object.visible=Boolean(schematic)&&(state.isolated?state.isolated===id:state.visible.exterior);});
        }
      }
      if(viewNonce!==state.viewNonce||(lastMode!==state.mode&&(state.mode==='exploded'||lastMode==='exploded'))){
        viewNonce=state.viewNonce;const view=presets[state.view];targetPosition.set(...view.pos as [number,number,number]);targetLook.set(...view.target as [number,number,number]);camera.zoom=state.view==='cockpit'?1:state.mode==='exploded'?1.12:1.32;resize();
        if(state.mode==='exploded'&&state.view!=='cockpit'){targetPosition.multiplyScalar(1.32);targetLook.y=.7;}
        cameraMoving=true;
      }
      lastMode=state.mode;
      if(lastIsolated!==state.isolated){
        lastIsolated=state.isolated;
        if(state.isolated){const bounds=new THREE.Box3();vehicle.root.updateMatrixWorld(true);vehicle.parts.get(state.isolated)?.forEach(object=>bounds.expandByObject(object));if(!bounds.isEmpty()){bounds.getCenter(targetLook);const size=bounds.getSize(new THREE.Vector3()).length();const direction=camera.position.clone().sub(controls.target).normalize();targetPosition.copy(targetLook).addScaledVector(direction,Math.max(.38,size*1.7));cameraMoving=true;}}
        else{const view=presets[state.view];targetPosition.set(...view.pos as [number,number,number]);targetLook.set(...view.target as [number,number,number]);cameraMoving=true;}
      }
      if(cameraMoving){const ease=1-Math.exp(-dt*5);camera.position.lerp(targetPosition,ease);controls.target.lerp(targetLook,ease);if(camera.position.distanceTo(targetPosition)<.005)cameraMoving=false;}
      controls.autoRotate=state.autoRotate&&!cameraMoving;controls.minDistance=(state.view==='cockpit'||state.isolated!==null) ? .12 : 2.2;controls.update();
      dimensions.visible=state.dimensions;grid.visible=state.mode!=='showroom';
      const floorHeight=state.mode==='exploded'?-.7:-.065;ground.position.y=THREE.MathUtils.lerp(ground.position.y,floorHeight,1-Math.exp(-dt*7));grid.position.y=ground.position.y+.01;shadow.position.y=ground.position.y+.015;
      flows.aero.group.visible=state.mode==='aero';flows.cold.group.visible=flows.hot.group.visible=state.mode==='thermal';flows.energy.group.visible=state.mode==='energy';
      for(const [kind,flow] of Object.entries(flows))if(flow.group.visible){
        const direction=(kind==='energy'&&telemetry.power<0)||(state.mode==='thermal'&&state.thermalMode==='heating')?-1:1;
        const flowTime=kind==='energy'?simulationTime:elapsed;
        flow.curves.forEach((curve,i)=>{for(let j=0;j<12;j++){const t=((j/12+flowTime*flow.speed*direction)%1+1)%1;const point=curve.getPointAt(t);const index=(i*12+j)*3;flow.positions[index]=point.x;flow.positions[index+1]=point.y;flow.positions[index+2]=point.z;}});flow.points.geometry.attributes.position.needsUpdate=true;
        if(kind==='energy'){(flow.points.material as THREE.PointsMaterial).color.set(telemetry.power<0?'#24c9a0':'#4a77ff');flow.group.visible=Math.abs(telemetry.power)>.1;}
      }
      const focus=hoverId||state.selected;
      if(focus){const objects=vehicle.parts.get(focus);const box=outline.box;box.makeEmpty();objects?.forEach(o=>{if(o.visible)box.expandByObject(o);});outline.visible=!box.isEmpty();if(outline.visible)box.expandByScalar(.012);}else outline.visible=false;
      selectedId=state.selected;
      renderer.render(scene,camera);frames++;
      if(firstFrame){firstFrame=false;host.dataset.ready='true';latest.current.onReady?.();}
      if(now-lastReport>600){const fps=frames*1000/(now-lastReport);telemetry={...telemetry,fps,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,partCount:vehicle.parts.size};latest.current.onTelemetry(telemetry);frames=0;lastReport=now;
        const ratio=renderer.getPixelRatio();if(fps<38&&ratio>1){renderer.setPixelRatio(Math.max(1,ratio-.2));resize();}
      }
    };
    frame=requestAnimationFrame(animate);
    return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.removeEventListener('start',stopTransition);controls.dispose();renderer.domElement.removeEventListener('pointerdown',onDown,{capture:true});renderer.domElement.removeEventListener('pointermove',onMove);renderer.domElement.removeEventListener('pointerup',onUp);renderer.domElement.removeEventListener('pointercancel',onCancel);renderer.domElement.removeEventListener('pointerleave',onLeave);renderer.domElement.removeEventListener('webglcontextlost',onContextLost);highland?.dispose();vehicle.dispose();environment.dispose();const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.Points||o instanceof THREE.Sprite){if(o.geometry)geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{materials.add(m);Object.values(m).forEach(value=>{if(value instanceof THREE.Texture)textures.add(value);});});}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();delete host.dataset.ready;delete host.dataset.asset;};
  }, []);
  const part=hover?PARTS.find(p=>p.id===hover.id):null;
  return <div className="three-scene" ref={mount} style={{position:'absolute',inset:0,overflow:'hidden'}}>
    {assetStatus!=='ready'&&<div className="asset-status" role="status">{assetStatus==='loading'?'載入 Highland 精細車身…':'精細車身載入失敗，目前顯示結構示意模型'}</div>}
    {error&&<div role="alert" style={{position:'absolute',inset:0,display:'grid',placeContent:'center',padding:40,textAlign:'center',zIndex:20,background:'#f3f5f8',color:'#26344a'}}>{error}</div>}
    {part&&hover&&!props.state.selected&&<div className="part-hover-card" style={{position:'absolute',left:Math.min(hover.x+16,(mount.current?.clientWidth??600)-232),top:Math.max(8,hover.y-76),pointerEvents:'none',zIndex:8,background:'rgba(255,255,255,.96)',border:'1px solid #e1e6ee',boxShadow:'0 6px 28px #14254a15',borderRadius:10,padding:'12px 15px',minWidth:200,color:'#1c2a42'}}><span style={{display:'block',fontSize:9,letterSpacing:1.2,color:'#637697',marginBottom:5}}>{part.code} · {part.english}</span><strong style={{fontSize:13}}>{part.name}</strong><span style={{fontSize:10,color:'#8a97ab',display:'block',marginTop:6}}>點擊查看工程資訊 ↗</span></div>}
  </div>;
}
