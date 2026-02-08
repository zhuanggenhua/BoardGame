/**
 * 特效预览工具
 *
 * 独立页面，可在 /dev/fx 访问。
 * 左侧分类导航（按特效类型分组） + 右侧网格展示该分类下所有特效。
 * 每个特效卡片带性能计数器（FPS / 帧时间 / 粒子数）。
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  FlyingEffectsLayer,
  useFlyingEffects,
  type FlyingEffectData,
} from '../../components/common/animations/FlyingEffect';
import { FloatingTextLayer, useFloatingText } from '../../components/common/animations/FloatingText';
import { ShakeContainer, useShake } from '../../components/common/animations/ShakeContainer';
import { HitStopContainer, useHitStop, HIT_STOP_PRESETS } from '../../components/common/animations/HitStopContainer';
import { SlashEffect, useSlashEffect, SLASH_PRESETS } from '../../components/common/animations/SlashEffect';
import { BurstParticles, BURST_PRESETS } from '../../components/common/animations/BurstParticles';
import { VictoryParticles } from '../../components/common/animations/VictoryParticles';
import { ImpactContainer } from '../../components/common/animations/ImpactContainer';
import { ShockwaveProjectile } from '../../components/common/animations/ShockwaveProjectile';
import { PulseGlow } from '../../components/common/animations/PulseGlow';
import { SummonEffect } from '../../components/common/animations/SummonEffect';
import { ConeBlast } from '../../components/common/animations/ConeBlast';
import { DamageFlash } from '../../components/common/animations/DamageFlash';

// ============================================================================
// 预设 key → 中文标签映射
// ============================================================================

const SLASH_LABELS: Record<string, string> = {
  light: '轻击', normal: '普通', heavy: '重击', critical: '暴击', ice: '冰霜', holy: '神圣',
};
const BURST_LABELS: Record<string, string> = {
  explosion: '爆炸', explosionStrong: '强力爆炸', summonGlow: '召唤光',
  summonGlowStrong: '强力召唤', smoke: '烟尘', sparks: '火花', magicDust: '魔法尘',
};

// ============================================================================
// 性能计数器 Hook
// ============================================================================

interface PerfStats {
  fps: number;
  frameTime: number; // ms
  particles: number; // 存活粒子数
  isRunning: boolean;
}

/** 轻量级每卡片性能计数器 */
function usePerfCounter(): { stats: PerfStats; startMeasure: () => () => void; setParticles: (n: number) => void } {
  const [stats, setStats] = useState<PerfStats>({ fps: 0, frameTime: 0, particles: 0, isRunning: false });
  const rafRef = useRef(0);

  const startMeasure = useCallback(() => {
    const frameTimes: number[] = [];
    let lastTime = performance.now();
    let running = true;

    setStats(s => ({ ...s, isRunning: true }));

    const tick = () => {
      if (!running) return;
      const now = performance.now();
      frameTimes.push(now - lastTime);
      lastTime = now;

      if (frameTimes.length >= 10) {
        const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        setStats(s => ({ ...s, fps: Math.round(1000 / avg), frameTime: +avg.toFixed(1), isRunning: true }));
        frameTimes.length = 0;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      setStats(s => ({ ...s, isRunning: false }));
    };
  }, []);

  const setParticles = useCallback((n: number) => {
    setStats(s => ({ ...s, particles: n }));
  }, []);

  return { stats, startMeasure, setParticles };
}

// ============================================================================
// 通用 UI 小组件
// ============================================================================

const TriggerButton: React.FC<{
  label: string;
  onClick: () => void;
  color?: string;
}> = ({ label, onClick, color = 'bg-indigo-600 hover:bg-indigo-500' }) => (
  <button
    onClick={onClick}
    className={`px-2.5 py-1 rounded text-[11px] font-bold text-white transition-[background-color] ${color}`}
  >
    {label}
  </button>
);

/** 性能指标显示条 */
const PerfBar: React.FC<{ stats: PerfStats }> = ({ stats }) => {
  const fpsColor = !stats.isRunning ? 'text-slate-500' : stats.fps >= 55 ? 'text-emerald-400' : stats.fps >= 40 ? 'text-yellow-400' : 'text-red-400';
  return (
    <div className="flex gap-2 text-[10px] font-mono items-center">
      <span className={fpsColor}>{stats.fps || '--'} FPS</span>
      <span className="text-slate-500">{stats.frameTime || '--'}ms</span>
      {stats.particles > 0 && <span className="text-blue-400">{stats.particles}p</span>}
      {stats.isRunning && <span className="text-emerald-500 animate-pulse text-[8px]">●</span>}
    </div>
  );
};

/** 特效卡片容器 */
const EffectCard: React.FC<{
  title: string;
  icon: string;
  desc?: string;
  children: React.ReactNode;
  buttons: React.ReactNode;
  stats?: PerfStats;
}> = ({ title, icon, desc, children, buttons, stats }) => (
  <div className="bg-slate-800/40 rounded-lg border border-slate-700/60 p-3 flex flex-col overflow-hidden">
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-bold text-slate-200">{title}</span>
      </div>
      {stats && <PerfBar stats={stats} />}
    </div>
    {desc && <p className="text-[10px] text-slate-500 mb-2">{desc}</p>}
    <div className="relative bg-slate-900/50 rounded border border-slate-700/40 mb-2 flex-1 min-h-[160px]" style={{ overflow: 'visible' }}>
      {children}
    </div>
    <div className="flex flex-wrap gap-1.5">{buttons}</div>
  </div>
);

// ============================================================================
// 各特效预览区块（紧凑版）
// ============================================================================

/** 飞行特效 */
const FlyingCard: React.FC = () => {
  const { effects, pushEffect, removeEffect } = useFlyingEffects();
  const containerRef = useRef<HTMLDivElement>(null);
  const { stats, startMeasure } = usePerfCounter();

  const fire = useCallback((type: FlyingEffectData['type'], intensity: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const content = type === 'damage' ? `-${intensity}` : type === 'heal' ? `+${intensity}` : '✨';
    pushEffect({
      type, content, intensity,
      startPos: { x: rect.left + rect.width * 0.15, y: rect.top + rect.height * 0.5 },
      endPos: { x: rect.left + rect.width * 0.85, y: rect.top + rect.height * 0.5 },
    });
    const stop = startMeasure();
    setTimeout(stop, 1200);
  }, [pushEffect, startMeasure]);

  return (
    <EffectCard title="飞行特效" icon="🚀" desc="恒定速度 800px/s，粒子尾迹" stats={stats}
      buttons={<>
        <TriggerButton label="伤害 x1" onClick={() => fire('damage', 1)} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label="伤害 x5" onClick={() => fire('damage', 5)} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label="伤害 x10" onClick={() => fire('damage', 10)} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label="治疗 x3" onClick={() => fire('heal', 3)} color="bg-emerald-700 hover:bg-emerald-600" />
        <TriggerButton label="增益" onClick={() => fire('buff', 1)} color="bg-amber-700 hover:bg-amber-600" />
      </>}
    >
      <div ref={containerRef} className="absolute inset-0 flex items-center justify-between px-6">
        <div className="w-8 h-8 rounded-full bg-indigo-500/30 border border-indigo-400/50 flex items-center justify-center text-[10px] text-indigo-300">起</div>
        <div className="w-8 h-8 rounded-full bg-red-500/30 border border-red-400/50 flex items-center justify-center text-[10px] text-red-300">终</div>
      </div>
      <FlyingEffectsLayer effects={effects} onEffectComplete={removeEffect} />
    </EffectCard>
  );
};

/** 飘字 */
const FloatingTextCard: React.FC = () => {
  const { texts, pushText, removeText } = useFloatingText();
  const containerRef = useRef<HTMLDivElement>(null);
  const { stats, startMeasure } = usePerfCounter();

  const trigger = useCallback((type: 'damage' | 'heal', value: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    pushText({ type, content: type === 'damage' ? `-${value}` : `+${value}`, position: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, intensity: value });
    const stop = startMeasure();
    setTimeout(stop, 900);
  }, [pushText, startMeasure]);

  return (
    <EffectCard title="飘字" icon="💬" desc="弹出 → 弹性缩回 → 上浮淡出" stats={stats}
      buttons={<>
        <TriggerButton label="-1" onClick={() => trigger('damage', 1)} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label="-5" onClick={() => trigger('damage', 5)} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label="-10" onClick={() => trigger('damage', 10)} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label="+3" onClick={() => trigger('heal', 3)} color="bg-emerald-700 hover:bg-emerald-600" />
        <TriggerButton label="+8" onClick={() => trigger('heal', 8)} color="bg-emerald-700 hover:bg-emerald-600" />
      </>}
    >
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] text-slate-600">飘字区域</span>
      </div>
      <FloatingTextLayer texts={texts} onComplete={removeText} />
    </EffectCard>
  );
};

/** 震动 + 钝帧 */
const ShakeHitStopCard: React.FC = () => {
  const { isShaking, triggerShake } = useShake(500);
  const { isActive: hitLight, triggerHitStop: triggerLight } = useHitStop(80);
  const { isActive: hitHeavy, triggerHitStop: triggerHeavy } = useHitStop(80);
  const { isActive: hitCrit, triggerHitStop: triggerCrit } = useHitStop(80);

  return (
    <EffectCard title="震动 + 钝帧" icon="💥" desc="帧冻结 + scale 微弹 + 亮度脉冲"
      buttons={<>
        <TriggerButton label="震动" onClick={triggerShake} />
        <TriggerButton label="钝帧·轻" onClick={() => triggerLight(HIT_STOP_PRESETS.light)} color="bg-rose-700 hover:bg-rose-600" />
        <TriggerButton label="钝帧·重" onClick={() => triggerHeavy(HIT_STOP_PRESETS.heavy)} color="bg-rose-700 hover:bg-rose-600" />
        <TriggerButton label="钝帧·暴击" onClick={() => triggerCrit(HIT_STOP_PRESETS.critical)} color="bg-rose-700 hover:bg-rose-600" />
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center gap-3 p-3">
        <ShakeContainer isShaking={isShaking} className="w-24 h-16 bg-slate-700 rounded flex items-center justify-center border border-slate-600">
          <span className="text-[10px] text-slate-300">震动</span>
        </ShakeContainer>
        <div className="flex flex-col gap-1">
          <HitStopContainer isActive={hitLight} {...HIT_STOP_PRESETS.light} className="w-20 h-4 bg-red-900/50 rounded flex items-center justify-center border border-red-700/50">
            <span className="text-[9px] text-red-300">轻</span>
          </HitStopContainer>
          <HitStopContainer isActive={hitHeavy} {...HIT_STOP_PRESETS.heavy} className="w-20 h-4 bg-red-900/50 rounded flex items-center justify-center border border-red-700/50">
            <span className="text-[9px] text-red-300">重</span>
          </HitStopContainer>
          <HitStopContainer isActive={hitCrit} {...HIT_STOP_PRESETS.critical} className="w-20 h-4 bg-red-900/50 rounded flex items-center justify-center border border-red-700/50">
            <span className="text-[9px] text-red-300">暴击</span>
          </HitStopContainer>
        </div>
      </div>
    </EffectCard>
  );
};

/** 斜切特效 */
const SlashCard: React.FC = () => {
  const { isActive, triggerSlash } = useSlashEffect();
  const [currentPreset, setCurrentPreset] = useState('normal');
  const { stats, startMeasure } = usePerfCounter();

  const fire = useCallback((name: string) => {
    setCurrentPreset(name);
    triggerSlash(SLASH_PRESETS[name as keyof typeof SLASH_PRESETS]);
    const stop = startMeasure();
    setTimeout(stop, 600);
  }, [triggerSlash, startMeasure]);

  return (
    <EffectCard title="斜切" icon="⚔️" desc="Canvas 弧形刀光 + 火花" stats={stats}
      buttons={<>
        {Object.keys(SLASH_PRESETS).map(name => (
          <TriggerButton key={name} label={SLASH_LABELS[name] ?? name} onClick={() => fire(name)} color="bg-orange-700 hover:bg-orange-600" />
        ))}
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] text-slate-600">受击区域</span>
      </div>
      <SlashEffect isActive={isActive} {...(SLASH_PRESETS[currentPreset as keyof typeof SLASH_PRESETS] ?? SLASH_PRESETS.normal)} />
    </EffectCard>
  );
};

/** 爆发粒子 */
const BurstCard: React.FC = () => {
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const timerRef = useRef<number>(0);
  const { stats, startMeasure } = usePerfCounter();

  const trigger = useCallback((preset: string) => {
    setActivePreset(null);
    window.clearTimeout(timerRef.current);
    requestAnimationFrame(() => setActivePreset(preset));
    timerRef.current = window.setTimeout(() => setActivePreset(null), 2000);
    const stop = startMeasure();
    setTimeout(stop, 1500);
  }, [startMeasure]);

  return (
    <EffectCard title="爆发粒子" icon="✨" desc="Canvas 2D 粒子引擎" stats={stats}
      buttons={<>
        {Object.keys(BURST_PRESETS).map(name => (
          <TriggerButton key={name} label={BURST_LABELS[name] ?? name} onClick={() => trigger(name)} color="bg-purple-700 hover:bg-purple-600" />
        ))}
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] text-slate-600">爆发区域</span>
      </div>
      {activePreset && (
        <BurstParticles
          active preset={activePreset as keyof typeof BURST_PRESETS}
          color={
            activePreset.includes('summon') ? ['#a78bfa', '#c084fc', '#e9d5ff'] :
            activePreset === 'sparks' ? ['#fbbf24', '#f59e0b', '#fef3c7', '#fff'] :
            activePreset === 'magicDust' ? ['#34d399', '#6ee7b7', '#a7f3d0', '#fff'] :
            undefined
          }
          onComplete={() => setActivePreset(null)}
        />
      )}
    </EffectCard>
  );
};

/** 胜利彩带 */
const VictoryCard: React.FC = () => {
  const [active, setActive] = useState(false);
  const timerRef = useRef<number>(0);
  const { stats, startMeasure } = usePerfCounter();

  const trigger = useCallback(() => {
    setActive(false);
    window.clearTimeout(timerRef.current);
    requestAnimationFrame(() => setActive(true));
    timerRef.current = window.setTimeout(() => setActive(false), 3500);
    const stop = startMeasure();
    setTimeout(stop, 3500);
  }, [startMeasure]);

  return (
    <EffectCard title="胜利彩带" icon="🎉" desc="底部喷射彩色粒子" stats={stats}
      buttons={<TriggerButton label="触发" onClick={trigger} color="bg-yellow-600 hover:bg-yellow-500" />}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] text-slate-600">🎉</span>
      </div>
      <VictoryParticles active={active} />
    </EffectCard>
  );
};

/** 打击感组合 */
const ImpactCard: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [damage, setDamage] = useState(5);
  const timerRef = useRef<number>(0);
  const { stats, startMeasure } = usePerfCounter();

  const trigger = useCallback((dmg: number) => {
    setDamage(dmg);
    setIsActive(false);
    window.clearTimeout(timerRef.current);
    requestAnimationFrame(() => setIsActive(true));
    timerRef.current = window.setTimeout(() => setIsActive(false), 100);
    const stop = startMeasure();
    setTimeout(stop, 800);
  }, [startMeasure]);

  return (
    <EffectCard title="打击感组合" icon="🔨" desc="震动 + 斜切 + 钝帧" stats={stats}
      buttons={<>
        <TriggerButton label="轻击 (2)" onClick={() => trigger(2)} color="bg-rose-700 hover:bg-rose-600" />
        <TriggerButton label="普通 (5)" onClick={() => trigger(5)} color="bg-rose-700 hover:bg-rose-600" />
        <TriggerButton label="重击 (8)" onClick={() => trigger(8)} color="bg-rose-700 hover:bg-rose-600" />
        <TriggerButton label="暴击 (12)" onClick={() => trigger(12)} color="bg-rose-700 hover:bg-rose-600" />
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <ImpactContainer
          isActive={isActive} damage={damage}
          effects={{ shake: true, slash: true, hitStop: true }}
          className="w-36 h-20 bg-slate-700 rounded flex items-center justify-center border border-slate-600"
          style={{ overflow: 'visible' }}
        >
          <span className="text-[10px] text-slate-300">受击目标（伤害={damage}）</span>
        </ImpactContainer>
      </div>
    </EffectCard>
  );
};

/** 冲击波投射物 */
const ShockwaveCard: React.FC = () => {
  const [active, setActive] = useState(false);
  const [intensity, setIntensity] = useState<'normal' | 'strong'>('normal');
  const { stats, startMeasure } = usePerfCounter();

  const trigger = useCallback((int: 'normal' | 'strong') => {
    setIntensity(int);
    setActive(false);
    requestAnimationFrame(() => setActive(true));
    const stop = startMeasure();
    setTimeout(stop, 1000);
  }, [startMeasure]);

  return (
    <EffectCard title="冲击波" icon="🌊" desc="气浪投射物，普通/强力" stats={stats}
      buttons={<>
        <TriggerButton label="普通" onClick={() => trigger('normal')} color="bg-cyan-700 hover:bg-cyan-600" />
        <TriggerButton label="强力" onClick={() => trigger('strong')} color="bg-cyan-700 hover:bg-cyan-600" />
      </>}
    >
      <div className="absolute left-[20%] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-cyan-500/30 border border-cyan-400/50 flex items-center justify-center text-[9px] text-cyan-300">起</div>
      <div className="absolute left-[80%] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-red-500/30 border border-red-400/50 flex items-center justify-center text-[9px] text-red-300">终</div>
      {active && (
        <ShockwaveProjectile start={{ xPct: 20, yPct: 50 }} end={{ xPct: 80, yPct: 50 }} intensity={intensity} onComplete={() => setActive(false)} />
      )}
    </EffectCard>
  );
};

/** 脉冲发光 */
const PulseGlowCard: React.FC = () => {
  const [isGlowing, setIsGlowing] = useState(false);
  const [loop, setLoop] = useState(false);
  const [effect, setEffect] = useState<'glow' | 'ripple'>('glow');

  const triggerOnce = useCallback(() => {
    setLoop(false);
    setIsGlowing(false);
    requestAnimationFrame(() => setIsGlowing(true));
    setTimeout(() => setIsGlowing(false), 1200);
  }, []);

  return (
    <EffectCard title="脉冲发光" icon="⚡" desc="发光/涟漪，单次或循环"
      buttons={<>
        <TriggerButton label="发光" onClick={() => { setEffect('glow'); triggerOnce(); }} color="bg-amber-700 hover:bg-amber-600" />
        <TriggerButton label="发光·循环" onClick={() => { setEffect('glow'); setLoop(true); setIsGlowing(true); }} color="bg-amber-700 hover:bg-amber-600" />
        <TriggerButton label="涟漪" onClick={() => { setEffect('ripple'); triggerOnce(); }} color="bg-teal-700 hover:bg-teal-600" />
        <TriggerButton label="停止" onClick={() => { setIsGlowing(false); setLoop(false); }} color="bg-slate-600 hover:bg-slate-500" />
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <PulseGlow isGlowing={isGlowing} glowColor="rgba(251, 191, 36, 0.6)" loop={loop} effect={effect}
          className="w-16 h-16 rounded-xl bg-amber-900/40 border border-amber-600/50 flex items-center justify-center"
        >
          <span className="text-xl">⚡</span>
        </PulseGlow>
      </div>
    </EffectCard>
  );
};

/** 召唤特效 */
const SummonCard: React.FC = () => {
  const [active, setActive] = useState(false);
  const [isStrong, setIsStrong] = useState(false);
  const { stats, startMeasure } = usePerfCounter();

  const trigger = useCallback((strong: boolean) => {
    setIsStrong(strong);
    setActive(false);
    requestAnimationFrame(() => setActive(true));
    const stop = startMeasure();
    setTimeout(stop, 2000);
  }, [startMeasure]);

  return (
    <EffectCard title="召唤特效" icon="🔮" desc="光柱 + 冲击波环 + 地裂 + 粒子" stats={stats}
      buttons={<>
        <TriggerButton label="普通（蓝）" onClick={() => trigger(false)} color="bg-blue-700 hover:bg-blue-600" />
        <TriggerButton label="强力（金）" onClick={() => trigger(true)} color="bg-yellow-600 hover:bg-yellow-500" />
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'radial-gradient(circle, #1e293b 0%, #0f172a 100%)' }}>
        <div className="relative w-24 h-24" style={{ overflow: 'visible' }}>
          {active && (
            <SummonEffect active intensity={isStrong ? 'strong' : 'normal'} color={isStrong ? 'gold' : 'blue'} onComplete={() => setActive(false)} />
          )}
        </div>
      </div>
    </EffectCard>
  );
};

/** 锥形气浪 */
const ConeBlastCard: React.FC = () => {
  const [active, setActive] = useState(false);
  const [intensity, setIntensity] = useState<'normal' | 'strong'>('normal');
  const { stats, startMeasure } = usePerfCounter();

  const trigger = useCallback((int: 'normal' | 'strong') => {
    setIntensity(int);
    setActive(false);
    requestAnimationFrame(() => setActive(true));
    const stop = startMeasure();
    setTimeout(stop, 1000);
  }, [startMeasure]);

  return (
    <EffectCard title="锥形气浪" icon="💨" desc="光球投射 + 粒子尾迹 + 命中爆发" stats={stats}
      buttons={<>
        <TriggerButton label="普通" onClick={() => trigger('normal')} color="bg-cyan-700 hover:bg-cyan-600" />
        <TriggerButton label="强力" onClick={() => trigger('strong')} color="bg-cyan-700 hover:bg-cyan-600" />
      </>}
    >
      <div className="absolute left-[15%] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-cyan-500/30 border border-cyan-400/50 flex items-center justify-center text-[9px] text-cyan-300">源</div>
      <div className="absolute left-[85%] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-red-500/30 border border-red-400/50 flex items-center justify-center text-[9px] text-red-300">目</div>
      {active && (
        <ConeBlast start={{ xPct: 15, yPct: 50 }} end={{ xPct: 85, yPct: 50 }} intensity={intensity} onComplete={() => setActive(false)} />
      )}
    </EffectCard>
  );
};

/** 受伤反馈 */
const DamageFlashCard: React.FC = () => {
  const [active, setActive] = useState(false);
  const [damage, setDamage] = useState(3);
  const [intensity, setIntensity] = useState<'normal' | 'strong'>('normal');
  const { stats, startMeasure } = usePerfCounter();

  const trigger = useCallback((dmg: number, int: 'normal' | 'strong') => {
    setDamage(dmg);
    setIntensity(int);
    setActive(false);
    requestAnimationFrame(() => setActive(true));
    const stop = startMeasure();
    setTimeout(stop, 1000);
  }, [startMeasure]);

  return (
    <EffectCard title="受伤反馈" icon="🩸" desc="震动 + 斜切 + 白闪 + 红脉冲 + 飘字" stats={stats}
      buttons={<>
        <TriggerButton label="轻伤 (1)" onClick={() => trigger(1, 'normal')} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label="中伤 (3)" onClick={() => trigger(3, 'normal')} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label="重伤 (5)" onClick={() => trigger(5, 'strong')} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label="致命 (10)" onClick={() => trigger(10, 'strong')} color="bg-red-700 hover:bg-red-600" />
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-32 h-20 bg-slate-700 rounded border border-slate-600 flex items-center justify-center">
          <span className="text-[10px] text-slate-300">受击目标</span>
          {active && (
            <DamageFlash active damage={damage} intensity={intensity} onComplete={() => setActive(false)} />
          )}
        </div>
      </div>
    </EffectCard>
  );
};

// ============================================================================
// 分类注册表 — 按特效类型分组
// ============================================================================

interface EffectEntry {
  id: string;
  label: string;
  icon: string;
  component: React.FC;
}

interface EffectGroup {
  id: string;
  label: string;
  entries: EffectEntry[];
}

const EFFECT_GROUPS: EffectGroup[] = [
  {
    id: 'particle', label: '🔥 粒子类',
    entries: [
      { id: 'burst', label: '爆发粒子', icon: '✨', component: BurstCard },
      { id: 'victory', label: '胜利彩带', icon: '🎉', component: VictoryCard },
      { id: 'summon', label: '召唤特效', icon: '🔮', component: SummonCard },
    ],
  },
  {
    id: 'impact', label: '⚔️ 打击类',
    entries: [
      { id: 'shake', label: '震动+钝帧', icon: '💥', component: ShakeHitStopCard },
      { id: 'slash', label: '斜切', icon: '⚔️', component: SlashCard },
      { id: 'impactCombo', label: '打击感组合', icon: '🔨', component: ImpactCard },
      { id: 'dmgflash', label: '受伤反馈', icon: '🩸', component: DamageFlashCard },
    ],
  },
  {
    id: 'projectile', label: '💨 投射类',
    entries: [
      { id: 'flying', label: '飞行特效', icon: '🚀', component: FlyingCard },
      { id: 'shockwave', label: '冲击波', icon: '🌊', component: ShockwaveCard },
      { id: 'coneblast', label: '锥形气浪', icon: '💨', component: ConeBlastCard },
    ],
  },
  {
    id: 'ui', label: '✨ UI 类',
    entries: [
      { id: 'floating', label: '飘字', icon: '💬', component: FloatingTextCard },
      { id: 'pulseglow', label: '脉冲发光', icon: '⚡', component: PulseGlowCard },
    ],
  },
];

// ============================================================================
// 主页面
// ============================================================================

const EffectPreview: React.FC = () => {
  const [activeGroupId, setActiveGroupId] = useState(EFFECT_GROUPS[0].id);
  const activeGroup = EFFECT_GROUPS.find(g => g.id === activeGroupId) ?? EFFECT_GROUPS[0];
  const totalCount = EFFECT_GROUPS.reduce((sum, g) => sum + g.entries.length, 0);

  return (
    <div className="h-screen bg-slate-900 text-slate-200 flex overflow-hidden">
      {/* 左侧分类导航 */}
      <nav className="w-44 shrink-0 min-h-0 bg-slate-800/80 border-r border-slate-700 p-3 flex flex-col gap-1 overflow-y-auto">
        <a href="/" className="text-slate-400 hover:text-slate-200 text-xs mb-2 block">← 返回首页</a>
        <h1 className="text-sm font-black text-slate-100 mb-3">特效预览</h1>
        {EFFECT_GROUPS.map(group => (
          <button
            key={group.id}
            onClick={() => setActiveGroupId(group.id)}
            className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-[background-color] ${
              group.id === activeGroupId
                ? 'bg-indigo-600/40 text-indigo-200 border border-indigo-500/50'
                : 'text-slate-400 hover:bg-slate-700/60 hover:text-slate-200 border border-transparent'
            }`}
          >
            {group.label}
            <span className="ml-1 text-[10px] opacity-50">({group.entries.length})</span>
          </button>
        ))}
        <div className="mt-auto text-[10px] text-slate-600 pt-4">
          共 {totalCount} 种特效
        </div>
      </nav>

      {/* 右侧网格预览区 */}
      <main className="flex-1 p-4 overflow-y-auto">
        <h2 className="text-base font-bold text-slate-100 border-b border-slate-700 pb-1 mb-4">
          {activeGroup.label}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {activeGroup.entries.map(entry => {
            const Comp = entry.component;
            return <Comp key={entry.id} />;
          })}
        </div>
      </main>
    </div>
  );
};

export default EffectPreview;
