import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Aperture, ArrowDownToLine, ArrowLeft, ArrowRight, Box, Check, ChevronDown,
  ChevronRight, CircleHelp, CirclePause, CirclePlay, Compass, Copy, DoorOpen, Eye,
  EyeOff, Fan, Focus, Gauge, GitBranch, Info, Layers3, Maximize2, Menu, Minus,
  MousePointer2, Move3D, Palette, PanelLeftClose, PanelRightClose, RotateCcw,
  Search, Settings2, ShieldCheck, SlidersHorizontal, Snowflake, Sparkles, Thermometer,
  Wind, X, Zap,
} from 'lucide-react';
import VehicleScene from './VehicleScene';
import { PARTS, SYSTEMS } from './catalog';
import {
  INITIAL_STATE, INITIAL_TELEMETRY,
  type DoorId, type Mode, type Part, type SimulationState, type Subsystem, type Telemetry,
  type ViewPreset,
} from './types';
import './styles.css';

const MODES: { id: Mode; label: string; english: string; icon: typeof Box }[] = [
  { id: 'showroom', label: '外觀', english: 'STUDIO', icon: Sparkles },
  { id: 'xray', label: '透視', english: 'X-RAY', icon: Layers3 },
  { id: 'exploded', label: '分解', english: 'EXPLODE', icon: Move3D },
  { id: 'aero', label: '氣流', english: 'AIRFLOW', icon: Wind },
  { id: 'thermal', label: '熱場', english: 'THERMAL', icon: Thermometer },
  { id: 'energy', label: '能量', english: 'ENERGY', icon: Zap },
];
const VIEWS: { id: ViewPreset; label: string }[] = [
  { id: 'perspective', label: '透視' }, { id: 'front', label: '車頭' },
  { id: 'side', label: '側面' }, { id: 'top', label: '俯視' },
  { id: 'cockpit', label: '座艙' }, { id: 'battery', label: '電池' },
  { id: 'chassis', label: '底盤' },
];
const DOORS: { id: DoorId; label: string }[] = [
  { id: 'frontLeft', label: '左前門' }, { id: 'frontRight', label: '右前門' },
  { id: 'rearLeft', label: '左後門' }, { id: 'rearRight', label: '右後門' },
  { id: 'frunk', label: '前行李廂' }, { id: 'trunk', label: '後行李廂' },
  { id: 'charge', label: '充電蓋' },
];
const PAINTS = [
  { color: '#e4e8ef', name: '珍珠白' }, { color: '#222a35', name: '曜石黑' },
  { color: '#a8b2c0', name: '冷光銀' }, { color: '#9f2638', name: '深焰紅' },
  { color: '#244574', name: '深海藍' },
];

type SidePanel = 'scene' | 'appearance' | 'dynamics';
type Drawer = 'left' | 'right' | null;
type Modal = 'help' | 'sources' | null;

const formatNumber = (value: number) => Number.isFinite(value) ? Math.round(value).toLocaleString() : '—';

function RangeControl({ label, value, min, max, step = 1, unit = '', onChange, accent }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (value: number) => void; accent?: string;
}) {
  const percent = ((value - min) / (max - min)) * 100;
  return <label className="range-field">
    <span className="range-caption"><span>{label}</span><strong>{Math.round(value * (step < 1 ? 100 : 1)) / (step < 1 ? 100 : 1)}{unit}</strong></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))}
      style={{ '--range-progress': `${percent}%`, '--range-accent': accent || '#345df6' } as React.CSSProperties} />
  </label>;
}

function App() {
  const [state, setState] = useState<SimulationState>(() => ({ ...INITIAL_STATE, visible: { ...INITIAL_STATE.visible }, doors: { ...INITIAL_STATE.doors } }));
  const [telemetry, setTelemetry] = useState<Telemetry>(INITIAL_TELEMETRY);
  const [ready, setReady] = useState(false);
  const [sidePanel, setSidePanel] = useState<SidePanel>('scene');
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<Subsystem, boolean>>({ exterior: true, body: false, powertrain: false, chassis: false, interior: false, adas: false });
  const [toast, setToast] = useState('');
  const lastTelemetry = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const selectedPart = useMemo(() => PARTS.find(part => part.id === state.selected) || null, [state.selected]);
  const filteredParts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? PARTS.filter(part => `${part.name} ${part.english} ${part.code} ${part.id}`.toLocaleLowerCase().includes(query)) : PARTS;
  }, [search]);
  const sceneCount = telemetry.partCount > 0 ? telemetry.partCount : PARTS.length;

  const patchState = useCallback((patch: Partial<SimulationState>) => setState(previous => ({ ...previous, ...patch })), []);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  }, []);
  const onTelemetry = useCallback((data: Telemetry) => {
    const now = performance.now();
    if (now - lastTelemetry.current > 180) { setTelemetry(data); lastTelemetry.current = now; }
  }, []);
  const reset = useCallback(() => {
    setState(previous => ({ ...INITIAL_STATE, visible: { ...INITIAL_STATE.visible }, doors: { ...INITIAL_STATE.doors }, viewNonce: previous.viewNonce + 1, resetNonce: previous.resetNonce + 1 }));
    setSearch(''); setSidePanel('scene'); setDrawer(null);
    notify('已還原初始狀態');
  }, [notify]);
  const selectMode = useCallback((mode: Mode) => patchState({ mode }), [patchState]);
  const selectView = (view: ViewPreset) => setState(previous => ({ ...previous, view, viewNonce: previous.viewNonce + 1, mode: view === 'battery' || view === 'chassis' ? 'xray' : previous.mode }));
  const toggleDoor = (id: DoorId) => setState(previous => ({ ...previous, mode: (id==='trunk'||id==='charge')&&!previous.doors[id]?'xray':previous.mode, doors: { ...previous.doors, [id]: !previous.doors[id] } }));
  const toggleVisible = (id: Subsystem) => setState(previous => ({ ...previous, visible: { ...previous.visible, [id]: !previous.visible[id] } }));

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === 'Escape') { setModal(null); setDrawer(null); patchState({ selected: null, isolated: null }); return; }
      if (target?.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
      if (modal) return;
      if (event.key === '1') selectMode('showroom');
      if (event.key === '2') selectMode('xray');
      if (event.key === '3') selectMode('exploded');
      if (event.code === 'Space') { event.preventDefault(); setState(previous => ({ ...previous, running: !previous.running })); }
      if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.metaKey) reset();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modal, patchState, reset, selectMode]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    if (!modal) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => modalRef.current?.querySelector<HTMLButtonElement>('.modal-close')?.focus());
    return () => { cancelAnimationFrame(frame); previousFocus.current?.focus(); };
  }, [modal]);

  const trapModalFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(modalRef.current?.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || []);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const screenshot = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('.vehicle-scene canvas, .viewport-stage canvas');
    if (!canvas) { notify('場景尚未準備完成'); return; }
    try {
      const anchor = document.createElement('a');
      anchor.download = `model-3-studio-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      anchor.href = canvas.toDataURL('image/png');
      anchor.click();
      notify('畫面已儲存');
    } catch { notify('此瀏覽器無法擷取場景'); }
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), state, telemetry }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'model-3-studio-state.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('目前狀態已匯出');
  };

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-lockup"><div className="brand-mark"><span>T</span></div><div className="brand-type"><strong>MODEL 3</strong><span>ENGINEERING STUDIO</span></div></div>
      <div className="topbar-breadcrumb"><span>工作台</span><ChevronRight size={13} /><strong>互動結構總覽</strong></div>
      <div className="topbar-actions">
        <span className="header-live"><i /> {ready ? 'SCENE LIVE' : 'INITIALIZING'}</span>
        <button className="top-icon" title="資料來源與限制" aria-label="資料來源與限制" onClick={() => setModal('sources')}><ShieldCheck size={18} /></button>
        <button className="top-icon" title="操作說明" aria-label="操作說明" onClick={() => setModal('help')}><CircleHelp size={18} /></button>
        <span className="top-divider" />
        <button className="export-button" onClick={exportData}><ArrowDownToLine size={16} /><span>匯出狀態</span></button>
      </div>
    </header>

    <div className="main-grid">
      <nav className="icon-rail" aria-label="工作台導覽">
        <div className="rail-group">
          <button className={sidePanel === 'scene' ? 'rail-button active' : 'rail-button'} title="場景總覽" aria-label="場景總覽" onClick={() => { setSidePanel('scene'); setDrawer('left'); }}><Layers3 size={21} /></button>
          <button className={sidePanel === 'appearance' ? 'rail-button active' : 'rail-button'} title="外觀與視角" aria-label="外觀與視角" onClick={() => { setSidePanel('appearance'); setDrawer('left'); }}><Palette size={21} /></button>
          <button className={sidePanel === 'dynamics' ? 'rail-button active' : 'rail-button'} title="動態模擬" aria-label="動態模擬" onClick={() => { setSidePanel('dynamics'); setDrawer('left'); }}><Activity size={21} /></button>
          <div className="rail-separator" />
          <button className="rail-button mobile-inspector-trigger" title="零件檢視" aria-label="零件檢視" onClick={() => setDrawer('right')}><SlidersHorizontal size={20} /></button>
        </div>
        <div className="rail-group rail-bottom"><button className="rail-button" title="使用說明" aria-label="使用說明" onClick={() => setModal('help')}><Info size={20} /></button></div>
      </nav>

      {drawer && <button className="drawer-backdrop" aria-label="關閉面板" onClick={() => setDrawer(null)} />}
      <aside className={`left-panel ${drawer === 'left' ? 'drawer-open' : ''}`}>
        <div className="panel-title-row"><div><span className="overline">SCENE EXPLORER</span><h2>{sidePanel === 'scene' ? '整車結構' : sidePanel === 'appearance' ? '外觀與視角' : '動態模擬'}</h2></div><button className="panel-close" aria-label="關閉左側面板" onClick={() => setDrawer(null)}><X size={18} /></button></div>
        <div className="left-content">
          {sidePanel === 'scene' && <>
            <div className="scene-count"><span>模型架構</span><strong>{sceneCount} <small>PARTS</small></strong></div>
            <label className="search-field"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜尋零件或代碼" aria-label="搜尋零件或代碼" />{search && <button aria-label="清除搜尋" onClick={() => setSearch('')}><X size={14} /></button>}</label>
            <div className="section-caption"><span>SUBSYSTEMS</span><span>06</span></div>
            <div className="tree-list">
              {SYSTEMS.map(system => {
                const parts = filteredParts.filter(part => part.system === system.id);
                if (search && parts.length === 0) return null;
                const isOpen = !!expanded[system.id] || !!search;
                return <div className="tree-system" key={system.id}>
                  <div className="system-row">
                    <button className="system-expand" aria-label={`${isOpen ? '收合' : '展開'}${system.name}`} aria-expanded={isOpen} onClick={() => setExpanded(previous => ({ ...previous, [system.id]: !previous[system.id] }))}>{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
                    <span className="system-dot" style={{ background: system.color }} />
                    <button className="system-label" onClick={() => setExpanded(previous => ({ ...previous, [system.id]: !previous[system.id] }))}><strong>{system.name}</strong><small>{system.english}</small></button>
                    <span className="part-count">{parts.length}</span>
                    <button className="visibility-button" title={`${state.visible[system.id] ? '隱藏' : '顯示'}${system.name}`} aria-label={`${state.visible[system.id] ? '隱藏' : '顯示'}${system.name}`} aria-pressed={state.visible[system.id]} onClick={() => toggleVisible(system.id)}>{state.visible[system.id] ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                  </div>
                  {isOpen && <div className="tree-parts">{parts.map(part => <button key={part.id} className={`tree-part ${state.selected === part.id ? 'selected' : ''}`} onClick={() => { patchState({ selected: part.id, mode: part.system !== 'exterior' && !part.id.startsWith('wheel-') ? 'xray' : state.mode }); setDrawer('right'); }}><span className="tree-line" /><span className="tree-part-name">{part.name}</span><small>{part.code}</small></button>)}</div>}
                </div>;
              })}
              {search && filteredParts.length === 0 && <div className="empty-search">找不到符合「{search}」的零件</div>}
            </div>
          </>}
          {sidePanel === 'appearance' && <>
            <div className="section-caption"><span>BODY PAINT</span><span>01 / 03</span></div>
            <p className="panel-subtext">車身塗裝</p>
            <div className="paint-swatches">{PAINTS.map(paint => <button key={paint.color} title={paint.name} aria-label={paint.name} aria-pressed={state.paint === paint.color} className={`paint-swatch ${state.paint === paint.color ? 'active' : ''}`} onClick={() => patchState({ paint: paint.color })} style={{ '--swatch': paint.color } as React.CSSProperties}>{state.paint === paint.color && <Check size={15} />}</button>)}</div>
            <div className="selected-paint">{PAINTS.find(paint => paint.color === state.paint)?.name || '自訂色'} <span>{state.paint.toUpperCase()}</span></div>
            <div className="panel-rule" />
            <div className="section-caption"><span>VISUAL SETTINGS</span><span>02 / 03</span></div>
            <RangeControl label="外殼透明度" value={state.opacity} min={0} max={1} step={0.01} unit="" onChange={opacity => patchState({ opacity })} />
            <RangeControl label="分解間距" value={state.explosion} min={0} max={1} step={0.01} onChange={explosion => patchState({ explosion })} />
            <div className="panel-rule" />
            <div className="section-caption"><span>CAMERA</span><span>03 / 03</span></div>
            <div className="view-grid">{VIEWS.map(view => <button key={view.id} className={state.view === view.id ? 'selected' : ''} onClick={() => selectView(view.id)}>{view.label}</button>)}</div>
            <button className={`switch-row ${state.dimensions ? 'is-on' : ''}`} onClick={() => patchState({ dimensions: !state.dimensions })}><span><Maximize2 size={16} />尺寸標註</span><i /></button>
            <button className={`switch-row ${state.autoRotate ? 'is-on' : ''}`} onClick={() => patchState({ autoRotate: !state.autoRotate })}><span><RotateCcw size={16} />自動旋轉</span><i /></button>
          </>}
          {sidePanel === 'dynamics' && <>
            <div className="section-caption"><span>DRIVE SYSTEM</span><span>01 / 02</span></div>
            <div className="drive-lead"><span className="drive-glyph"><Gauge size={23} /></span><div><strong>{state.running ? '模擬進行中' : '模擬已暫停'}</strong><small>{state.running ? 'LIVE DYNAMICS' : 'READY TO SIMULATE'}</small></div></div>
            <button className={`drive-start ${state.running ? 'running' : ''}`} onClick={() => patchState({ running: !state.running })}>{state.running ? <CirclePause size={17} /> : <CirclePlay size={17} />}{state.running ? '暫停動態模擬' : '啟動動態模擬'}</button>
            <RangeControl label="油門" value={state.throttle} min={0} max={100} unit="%" onChange={throttle => patchState({ throttle })} />
            <RangeControl label="煞車" value={state.brake} min={0} max={100} unit="%" onChange={brake => patchState({ brake })} />
            <RangeControl label="轉向" value={state.steering} min={-35} max={35} unit="°" onChange={steering => patchState({ steering })} />
            <RangeControl label="路面顛簸" value={state.road} min={0} max={100} unit="%" onChange={road => patchState({ road })} />
            <div className="panel-rule" />
            <div className="section-caption"><span>THERMAL LOOP</span><span>02 / 02</span></div>
            <div className="segment-control"><button className={state.thermalMode === 'cooling' ? 'active' : ''} onClick={() => patchState({ thermalMode: 'cooling' })}><Snowflake size={15} />冷卻</button><button className={state.thermalMode === 'heating' ? 'active' : ''} onClick={() => patchState({ thermalMode: 'heating' })}><Fan size={15} />加熱</button></div>
          </>}
        </div>
        <div className="left-bottom"><div className="legend-live"><span /> INTERACTIVE MODEL</div><button onClick={() => setModal('sources')}>模型說明 <ArrowRight size={14} /></button></div>
      </aside>

      <main className="workspace">
        <section className={`viewport-stage ${state.view==='cockpit'?'cockpit-view':''}`} aria-label="Model 3 互動三維場景">
          <div className="viewport-scene"><VehicleScene state={state} onSelect={selected => patchState({ selected })} onSteering={steering => patchState({ steering })} onTelemetry={onTelemetry} onReady={() => setReady(true)} /></div>
          <div className="viewport-top">
            <div className="viewport-heading"><span className="eyebrow"><i /> ENGINEERING STUDIO <span className="eyebrow-rule" /> 01 / MODEL 3</span><h1>MODEL <em>3</em></h1><div className="model-details"><span>2024+ HIGHLAND</span><b /> <span>AWD ENGINEERING STUDY</span></div></div>
            <div className="viewport-stats"><span><i className="stat-dot" /> {ready ? 'LIVE RENDER' : 'LOADING'}</span><strong>{formatNumber(telemetry.fps)} <small>FPS</small></strong><span className="stat-rule" /><span>WEBGL</span></div>
          </div>
          <div className="viewport-paints"><span>PAINT / {PAINTS.find(paint => paint.color === state.paint)?.name || '自訂色'}</span><div>{PAINTS.map(paint => <button key={paint.color} title={paint.name} aria-label={`切換${paint.name}車色`} aria-pressed={state.paint === paint.color} className={state.paint === paint.color ? 'active' : ''} style={{ '--swatch': paint.color } as React.CSSProperties} onClick={() => patchState({ paint: paint.color })} />)}</div></div>
          <div className="view-compass"><Compass size={18} /><span>{VIEWS.find(view => view.id === state.view)?.label}視角</span></div>
          <div className="viewport-actions"><button title="重設視角" aria-label="重設視角" onClick={() => selectView('perspective')}><Focus size={17} /></button><button title="擷取畫面" aria-label="擷取畫面" onClick={screenshot}><Aperture size={17} /></button><button title="尺寸標註" aria-label="尺寸標註" className={state.dimensions ? 'active' : ''} onClick={() => patchState({ dimensions: !state.dimensions })}><Maximize2 size={17} /></button></div>
          {state.mode === 'aero' && <div className="field-legend"><strong>AERODYNAMIC STUDY</strong><span>氣流與相對壓力示意 · 非 CFD</span><i className="pressure-scale"/><div className="legend-range"><span>低壓</span><span>高壓</span></div></div>}
          {state.mode === 'thermal' && <div className="field-legend"><strong>THERMAL CIRCUIT</strong><span>流路示意 · {state.thermalMode === 'cooling' ? '電池冷卻' : '座艙加熱'}</span><div className="legend-range"><span><b className="cold-dot"/>冷側迴路</span><span><b className="hot-dot"/>熱側迴路</span></div></div>}
          {state.mode === 'energy' && <div className="field-legend"><strong>{telemetry.power < -.1 ? 'REGENERATIVE BRAKING' : telemetry.power > .1 ? 'TRACTION ENERGY' : 'ENERGY STANDBY'}</strong><span>{telemetry.power < -.1 ? '馬達 → 電池 · 動能回充' : telemetry.power > .1 ? '電池 → 逆變器 → 馬達' : '啟動模擬並調整油門，觀察能量流'}</span><span className="energy-readout">{Math.abs(telemetry.power).toFixed(1)} <small>kW · 示意</small></span></div>}
          <div className="mode-dock" role="group" aria-label="顯示模式">{MODES.map(mode => <button key={mode.id} className={state.mode === mode.id ? 'active' : ''} onClick={() => selectMode(mode.id)} aria-pressed={state.mode === mode.id} title={`${mode.label} · ${mode.english}`}><mode.icon size={18} strokeWidth={1.8} /><span>{mode.label}</span></button>)}</div>
          <div className="viewport-caption">互動工程示意 · 非原廠 CAD / CAE</div>
        </section>

        <section className="drive-console" aria-label="車輛模擬控制台">
          <div className="console-topline"><span>LIVE VEHICLE DYNAMICS</span><span>SIMULATION / 001</span></div>
          <div className="console-content">
            <div className="console-run"><button aria-label={state.running ? '暫停模擬' : '啟動模擬'} onClick={() => patchState({ running: !state.running })}>{state.running ? <CirclePause size={23} fill="currentColor" strokeWidth={1.4} /> : <CirclePlay size={23} fill="currentColor" strokeWidth={1.4} />}</button><div><strong>{state.running ? '運行中' : '準備就緒'}</strong><span>{state.running ? 'RUNNING' : 'PAUSED'}</span></div></div>
            <div className="console-metrics"><div><strong>{formatNumber(telemetry.speed)}</strong><span>km/h <small>SPEED</small></span></div><div><strong>{formatNumber(telemetry.rpm)}</strong><span>rpm <small>MOTOR</small></span></div><div><strong>{formatNumber(telemetry.power)}</strong><span>kW <small>POWER</small></span></div></div>
            <div className="console-adjust"><div className="console-adjust-title"><span>DRIVE INPUT</span><button onClick={() => { setSidePanel('dynamics'); setDrawer('left'); }}>詳細設定 <ArrowRight size={13} /></button></div><div className="console-sliders"><RangeControl label="油門" value={state.throttle} min={0} max={100} unit="%" onChange={throttle => patchState({ throttle })} /><RangeControl label="煞車" value={state.brake} min={0} max={100} unit="%" onChange={brake => patchState({ brake })} /></div></div>
          </div>
          <div className="console-foot"><span><span className="foot-dot" /> BATTERY {formatNumber(telemetry.battery)}%</span><span>TEMP {formatNumber(telemetry.temperature)}°C</span><span>DRAW CALLS {formatNumber(telemetry.drawCalls)}</span><span>TRIS {formatNumber(telemetry.triangles)}</span></div>
        </section>
      </main>

      <aside className={`right-panel ${drawer === 'right' ? 'drawer-open' : ''}`}>
        <div className="panel-title-row inspector-title"><div><span className="overline">PROPERTY INSPECTOR</span><h2>屬性檢視</h2></div><button className="panel-close" aria-label="關閉右側面板" onClick={() => setDrawer(null)}><X size={18} /></button></div>
        <div className="inspector-content">
          {selectedPart ? <>
            <div className="selected-card"><div className="selected-card-header"><span className="selected-icon"><Box size={20} /></span><span className="selected-code">{selectedPart.code}</span></div><h3>{selectedPart.name}</h3><p className="part-english">{selectedPart.english}</p><div className="part-system"><span className="system-dot" style={{ background: SYSTEMS.find(item => item.id === selectedPart.system)?.color }} />{SYSTEMS.find(item => item.id === selectedPart.system)?.name}</div></div>
            <div className="inspector-buttons"><button className={state.isolated === selectedPart.id ? 'active' : ''} onClick={() => patchState({ isolated: state.isolated === selectedPart.id ? null : selectedPart.id })}><Focus size={15} />{state.isolated === selectedPart.id ? '取消獨立' : '獨立顯示'}</button><button onClick={() => patchState({ selected: null, isolated: null })}><X size={15} />取消選取</button></div>
            <div className="inspector-section"><span className="section-caption">COMPONENT PROFILE</span><p>{selectedPart.description}</p></div>
            <div className="inspector-section"><span className="section-caption">SPECIFICATIONS</span><dl><div><dt>材質</dt><dd>{selectedPart.material}</dd></div>{selectedPart.specs.map(spec => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl></div>
            <div className="provenance"><ShieldCheck size={16} /><span>{selectedPart.provenance === 'official' ? '規格來源：官方公開資料' : '結構與細節：示意建模'}</span></div>
          </> : <>
            <div className="empty-inspector"><div className="empty-inspector-icon"><MousePointer2 size={25} /></div><span>SELECT A COMPONENT</span><h3>探索每個結構細節</h3><p>點選模型或從左側場景樹選取零件，檢視結構說明與規格。</p></div>
            <div className="inspector-section quick-actions"><span className="section-caption">QUICK CONTROLS</span><button onClick={() => patchState({ autoRotate: !state.autoRotate })}><RotateCcw size={16} />自動旋轉 <span className={state.autoRotate ? 'quick-on' : ''}>{state.autoRotate ? 'ON' : 'OFF'}</span></button><button onClick={() => patchState({ dimensions: !state.dimensions })}><Maximize2 size={16} />尺寸標註 <span className={state.dimensions ? 'quick-on' : ''}>{state.dimensions ? 'ON' : 'OFF'}</span></button></div>
          </>}
          <div className="inspector-section access-panel"><span className="section-caption">ACCESS PANELS</span><p>四門與前艙採精細網格開合；後艙與充電蓋切換透視機構示意。</p><div className="door-grid">{DOORS.map(door => <button key={door.id} className={state.doors[door.id] ? 'opened' : ''} aria-pressed={state.doors[door.id]} onClick={() => toggleDoor(door.id)}><DoorOpen size={16} /><span>{door.label}</span><small>{state.doors[door.id] ? '開' : '關'}</small></button>)}</div></div>
          <div className="inspector-section camera-panel"><span className="section-caption">CAMERA PRESETS</span><div className="view-grid">{VIEWS.map(view => <button key={view.id} className={state.view === view.id ? 'selected' : ''} onClick={() => selectView(view.id)}>{view.label}</button>)}</div></div>
        </div>
        <div className="inspector-footer"><button onClick={reset}><RotateCcw size={15} />還原全部設定</button><span>MODEL 3 / STUDIO</span></div>
      </aside>
    </div>

    {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}><div className="modal-card" ref={modalRef} onKeyDown={trapModalFocus} role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" aria-label="關閉視窗" onClick={() => setModal(null)}><X size={19} /></button>{modal === 'help' ? <><span className="overline">STUDIO GUIDE</span><h2 id="modal-title">操作指南</h2><p>拖曳旋轉、滾輪縮放，點選模型或場景樹零件以檢視詳細資料。右側可開關車門與艙蓋，左側提供外觀與動態控制。</p><div className="shortcut-list"><div><kbd>1</kbd><span>外觀模式</span></div><div><kbd>2</kbd><span>透視模式</span></div><div><kbd>3</kbd><span>分解模式</span></div><div><kbd>Space</kbd><span>播放 / 暫停</span></div><div><kbd>R</kbd><span>還原設定</span></div><div><kbd>Esc</kbd><span>取消選取 / 獨立顯示</span></div></div></> : <><span className="overline">MODEL PROVENANCE</span><h2 id="modal-title">資料來源與限制</h2><p>此模型用於互動式結構探索。外型、組件配置與動態效果是工程示意，並非 Tesla 原廠 CAD、CAE 或維修資料；模擬讀數也不應用於設計、診斷或安全判斷。</p><div className="source-note"><ShieldCheck size={20} /><div><strong>公開資料參考</strong><span>零件規格標示以各項來源欄位為準。車輛使用資訊請參閱官方手冊。</span></div></div><a className="source-link" href="https://www.tesla.com/ownersmanual/model3/en_eu/GUID-56562137-FC31-4110-A13C-9A9FC6657BF0.html" target="_blank" rel="noopener noreferrer">Tesla Model 3 車主手冊 <ArrowRight size={15} /></a></>}<div className="asset-credit"><span>HIGHLAND MODEL CREDIT</span><p>3D 外觀：<a href="https://sketchfab.com/RBLXSupercars" target="_blank" rel="noopener noreferrer">RBLXSupercars</a> · 分享：brandonleong28 · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>。已調整比例、材質與互動分組；內部工程結構為示意。</p><a href={`${import.meta.env.BASE_URL}models/highland/CREDITS.md`} target="_blank" rel="noopener noreferrer">完整來源與修改紀錄 ↗</a><a href="https://www.tesla.com/zh_tw/model3" target="_blank" rel="noopener noreferrer">Tesla 台灣官網外觀參考 ↗</a></div></div></div>}
  </div>;
}

export default App;
