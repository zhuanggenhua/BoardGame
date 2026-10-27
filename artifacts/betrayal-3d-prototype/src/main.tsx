import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Crosshair, Eye, Footprints, Maximize, Minus, Plus, Settings2, X, ArrowRight, Layers3 } from 'lucide-react';
import { createScene, rooms, type SceneApi } from './scene';
import './style.css';

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<SceneApi | null>(null);
  const [selected, setSelected] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(false);
  const [top, setTop] = useState(false);
  const [wall, setWall] = useState(true);
  const [atmosphere, setAtmosphere] = useState(true);
  const [exposure, setExposure] = useState(1.5);
  const [round, setRound] = useState(1);
  const [position, setPosition] = useState(0);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState('');
  useEffect(() => {
    let disposed = false;
    createScene(host.current!, setSelected).then(scene => {
      if (disposed) { scene.dispose(); return; }
      api.current = scene;
      setReady(true);
    }).catch(reason => { if (!disposed) setError(String(reason)); });
    return () => { disposed = true; api.current?.dispose(); };
  }, []);
  const room = rooms[selected];
  return <main className={top ? 'top-mode' : undefined}>
    <div className="world" ref={host} />
    <header>
      <div className="brand"><span className="edition">BETRAYAL AT HOUSE ON THE HILL</span><h1>山屋惊魂</h1><span className="prototype">3D 场景实验</span></div>
      <div className="chapter"><span className="status-dot"/>探索阶段<span className="divider"/>第 {round} 回合</div>
      <button className="icon" title="画面设置" aria-label="画面设置" onClick={() => setSettings(!settings)}><Settings2 size={19}/></button>
    </header>
    <aside className="location"><span className="eyebrow">HOUSE / 01</span><h2>一楼</h2><p>{rooms.length} 个已发现房间</p><div className="floor-mark"><Layers3 size={16}/><span>探索中的宅邸</span></div></aside>
    <nav className="camera-tools" aria-label="镜头工具">
      <button className="icon" title="放大" aria-label="放大" onClick={() => api.current?.zoom(0.84)}><Plus size={20}/></button>
      <button className="icon" title="缩小" aria-label="缩小" onClick={() => api.current?.zoom(1.18)}><Minus size={20}/></button>
      <span/>
      <button className={`icon ${top ? 'active' : ''}`} title="正俯视" aria-label="正俯视" aria-pressed={top} onClick={() => { setTop(!top); api.current?.top(!top); }}><Eye size={20}/></button>
      <button className="icon" title="镜头归位" aria-label="镜头归位" onClick={() => { api.current?.reset(); setTop(false); }}><Crosshair size={20}/></button>
      <button className="icon" title="全屏" aria-label="全屏" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen(); }}><Maximize size={18}/></button>
    </nav>
    {settings && <section className="settings">
      <div className="settings-title"><h2>画面</h2><button className="icon" title="关闭" aria-label="关闭画面设置" onClick={() => setSettings(false)}><X size={17}/></button></div>
      <label>亮度 <input aria-label="亮度" type="range" min="0.7" max="2.5" step="0.1" value={exposure} onChange={event => { const value = Number(event.target.value); setExposure(value); api.current?.exposure(value); }}/></label>
      <label>立体墙体 <input type="checkbox" checked={wall} onChange={event => { setWall(event.target.checked); api.current?.walls(event.target.checked); }}/></label>
      <label>氛围后处理 <input type="checkbox" checked={atmosphere} onChange={event => { setAtmosphere(event.target.checked); api.current?.atmosphere(event.target.checked); }}/></label>
    </section>}
    {!ready && <div className="loading" role="status">{error || '正在进入山屋…'}</div>}
    <footer>
      <section className="explorer">
        <div className="seal">A</div>
        <div><span className="eyebrow">当前探索者</span><h2>安妮塔·赫南德兹</h2><p><span className="status-dot"/>{rooms[position].name}</p></div>
        <dl><div><dt>速度</dt><dd>4</dd></div><div><dt>力量</dt><dd>3</dd></div><div><dt>神志</dt><dd>4</dd></div><div><dt>知识</dt><dd>3</dd></div></dl>
      </section>
      <section className="room-detail">
        <img src={`/betrayal-3d/room-${room.tile}.webp`} alt={room.name}/>
        <div><span className="eyebrow">{room.type}</span><h2>{room.name}</h2><p>{room.detail}</p></div>
        <p className="route-hint"><Footprints size={13}/>琥珀脚印显示合法路线；墙、家具和怪物会挡路。</p>
        <button className="move" disabled={!ready || moving || position === selected} onClick={async () => { const destination = selected; setMoving(true); setMoveError(''); const arrived = await api.current!.move(); if (arrived) setPosition(destination); else setMoveError('没有可通行的路线'); setMoving(false); }}><Footprints size={17}/><span>{moving ? '移动中' : position === selected ? '位于此处' : '移动至此'}</span></button>
        {moveError && <span role="status">{moveError}</span>}
      </section>
      <button className="end-turn" disabled={!ready} onClick={() => setRound(value => value + 1)}><span>结束回合</span><ArrowRight size={20}/></button>
    </footer>
    <div className="room-strip" aria-label="房间选择">{rooms.map((item, index) => <button key={item.tile} className={selected === index ? 'selected' : ''} onClick={() => api.current?.select(index)}>{item.name}</button>)}</div>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App/>);
