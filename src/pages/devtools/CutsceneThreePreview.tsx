import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoaderCircle, Pause, Play, RotateCcw, RotateCw, Undo2, Redo2 } from 'lucide-react';
import {
  type CutsceneRuntimeHandle,
  type CutsceneRuntimeStatus,
} from './cutscene/cutsceneDemoRuntime';
import { createFgoSceneRuntime } from './cutscene/fgoSceneRuntime';
import { createFgoCharacterRuntime, type FgoCharacterRuntimeHandle } from './cutscene/fgoCharacterRuntime';
import { FGO_CHARACTER_ASSETS, type FgoCharacterCatalog, type FgoCharacterEntry } from './cutscene/fgoCharacterData';
import FgoCharacterDrawer from './cutscene/FgoCharacterDrawer';
import { fgoAnimationMeaning, fgoAnimationName, fgoCharacterName, fgoNobleClipCount, isFgoNobleAnimation } from './cutscene/fgoCharacterLabels';

const SPEED_OPTIONS = [0.25, 0.5, 1] as const;
const defaultAnimation = (entry: FgoCharacterEntry) => ['wait02', 'wait'].find(name => entry.animations.some(clip => clip.name === name))
  ?? entry.animations[0].name;

const initialStatus: CutsceneRuntimeStatus = {
  time: 0,
  duration: 18.5,
  phase: 'loading',
  firedEvents: [],
  isPlaying: false,
};

const CutsceneThreePreview = () => {
  const { t } = useTranslation('lobby');
  const effectStageRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLElement | null>(null);
  const [controlsHeight, setControlsHeight] = useState(176);
  const effectRuntimeRef = useRef<(CutsceneRuntimeHandle & Partial<FgoCharacterRuntimeHandle>) | null>(null);
  const [status, setStatus] = useState<CutsceneRuntimeStatus>(initialStatus);
  const [speed, setSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(1);
  const [error, setError] = useState('');
  const [characters, setCharacters] = useState<FgoCharacterEntry[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState<'motion' | 'noble'>('noble');
  const [animation, setAnimation] = useState('wait02');
  const [evolution, setEvolution] = useState(1);
  const [loop, setLoop] = useState(true);
  const [loading, setLoading] = useState(true);
  const selected = characters.find(character => character.id === selectedId);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return undefined;
    const observer = new ResizeObserver(() => setControlsHeight(Math.ceil(controls.getBoundingClientRect().height)));
    observer.observe(controls);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    void fetch(`${FGO_CHARACTER_ASSETS}catalog.json`, { signal: abort.signal })
      .then(response => {
        if (!response.ok) throw new Error(`${t('devtools.fgoGallery.catalog')}: HTTP ${response.status}`);
        return response.json() as Promise<FgoCharacterCatalog>;
      }).then(catalog => {
        if (abort.signal.aborted) return;
        const localized = catalog.characters.map(entry => ({ ...entry, name: fgoCharacterName(entry) }));
        const query = new URLSearchParams(window.location.search);
        const entry = localized.find(entry => entry.id === query.get('character')) ?? localized[0];
        if (!entry) throw new Error(t('devtools.fgoGallery.noPlayableCharacters'));
        setCharacters(localized); setSelectedId(entry.id);
        setAnimation(defaultAnimation(entry)); setEvolution(entry.evolutions[0]);
        setMode(query.get('mode') === 'motion' || !entry.noblePhantasm ? 'motion' : 'noble');
      }).catch((cause: unknown) => {
        if (!abort.signal.aborted) { setError(cause instanceof Error ? cause.message : String(cause)); setLoading(false); }
      });
    return () => abort.abort();
  }, [t]);

  useEffect(() => {
    const effectHost = effectStageRef.current;
    if (!effectHost || !selected) return undefined;
    let cancelled = false;
    setLoading(true); setError(''); setStatus(initialStatus);
    const options = {
      autoplay: true,
      speed,
      shouldAttach: () => !cancelled,
      onStatus: (next: CutsceneRuntimeStatus) => {
        if (!cancelled) setStatus(next);
      },
    };
    const pending = mode === 'noble'
      ? createFgoSceneRuntime(effectHost, options)
      : createFgoCharacterRuntime(effectHost, selected, { ...options, animation, evolution, loop });
    void pending.then((effectRuntime) => {
      if (!effectRuntime) return;
      if (cancelled) {
        effectRuntime.destroy();
        return;
      }
      effectRuntimeRef.current = effectRuntime;
      effectRuntime.setSpeed(speed);
      effectRuntime.seek(0);
      effectRuntime.play();
      setLoading(false);
    }).catch((cause: unknown) => {
      if (!cancelled) { setError(cause instanceof Error ? cause.message : String(cause)); setLoading(false); }
    });

    return () => {
      cancelled = true;
      effectRuntimeRef.current?.destroy();
      effectRuntimeRef.current = null;
    };
    // Motion, form and speed changes go through the live runtime below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, mode]);

  const selectCharacter = (id: string) => {
    const entry = characters.find(character => character.id === id);
    if (!entry) return;
    setSelectedId(id); setAnimation(defaultAnimation(entry)); setEvolution(entry.evolutions[0]);
    setMode(entry.noblePhantasm ? 'noble' : 'motion');
    const query = new URLSearchParams(window.location.search);
    query.set('character', id); query.delete('mode');
    window.history.replaceState(null, '', `${window.location.pathname}?${query}`);
  };

  const duration = Math.max(0.001, status.duration);
  const progress = Math.min(100, Math.max(0, (status.time / duration) * 100));

  return (
    <main className="relative h-dvh min-h-[320px] overflow-hidden bg-black text-white">
      <FgoCharacterDrawer characters={characters} selectedId={selectedId} onSelect={selectCharacter}
        open={drawerOpen} onOpenChange={setDrawerOpen} />
      <div className="absolute inset-0" data-testid="cutscene-three-stage">
        <div
          ref={effectStageRef}
          className={mode === 'motion' ? 'pointer-events-none absolute inset-x-0 top-20 z-10'
            : 'pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2'}
          style={mode === 'motion' ? { bottom: controlsHeight + 28 } : { width: 'min(100vw, 177.7778vh)', aspectRatio: '16 / 9' }}
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/65 to-transparent" />
      <header className="absolute left-16 right-4 top-4 z-20 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-sm font-semibold sm:text-base">{selected?.name ?? t('devtools.fgoGallery.character')}</h1>
          <p className="mt-1 text-xs text-zinc-400">{selected?.id}{' · '}{mode === 'noble' ? t('devtools.fgoGallery.noblePerformance') : t('devtools.fgoGallery.motion')}</p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded border border-white/20 bg-black/50 px-2 py-2 font-mono text-xs tabular-nums sm:text-sm">
          {t('devtools.fgoGallery.timeline', { time: status.time.toFixed(3), duration: duration.toFixed(3) })}
        </span>
      </header>
      {loading && <div role="status" className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
        <LoaderCircle className="animate-spin text-cyan-200" size={32} aria-label={t('devtools.fgoGallery.loadingCharacter')} />
      </div>}
      {error && <p role="alert" className="absolute left-4 top-20 z-20 max-w-lg border border-red-300/40 bg-black/85 px-3 py-2 text-sm text-red-200">{error}</p>}
      <footer ref={controlsRef} className="absolute bottom-4 left-4 right-4 z-20 mx-auto w-auto max-w-[40rem] rounded border border-white/15 bg-black/85 p-3 backdrop-blur">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {selected?.noblePhantasm && <select aria-label={t('devtools.fgoGallery.playbackContent')} value={mode}
            className="h-9 max-w-full rounded border border-zinc-700 bg-zinc-900 px-2 text-xs"
            onChange={event => setMode(event.currentTarget.value as 'motion' | 'noble')}>
            <option value="noble">{t('devtools.fgoGallery.noblePerformance')}</option><option value="motion">{t('devtools.fgoGallery.motion')}</option>
          </select>}
          {mode === 'motion' && <>
            <select aria-label={t('devtools.fgoGallery.action')} value={animation} disabled={loading}
              className="h-9 min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs"
              onChange={event => { setAnimation(event.currentTarget.value); effectRuntimeRef.current?.setAnimation?.(event.currentTarget.value); }}>
              <optgroup label={t('devtools.fgoGallery.basicCombatActions')}>
                {selected?.animations.filter(clip => !isFgoNobleAnimation(clip.name)).map(clip => <option key={clip.name} value={clip.name} title={fgoAnimationMeaning(clip.name)}>{fgoAnimationName(clip.name)}</option>)}
              </optgroup>
              {selected && fgoNobleClipCount(selected) > 0 && <optgroup label={t('devtools.fgoGallery.nobleActionClips')}>
                {selected.animations.filter(clip => isFgoNobleAnimation(clip.name)).map(clip => <option key={clip.name} value={clip.name} title={fgoAnimationMeaning(clip.name)}>{fgoAnimationName(clip.name)}</option>)}
              </optgroup>}
            </select>
            <select aria-label={t('devtools.fgoGallery.form')} value={evolution} disabled={loading}
              className="h-9 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs"
              onChange={event => { const level = Number(event.currentTarget.value); setEvolution(level); effectRuntimeRef.current?.setEvolution?.(level); }}>
              {selected?.evolutions.map(level => <option key={level} value={level}>{t('devtools.fgoGallery.formLevel', { level })}</option>)}
            </select>
            <label className="flex h-9 items-center gap-1 text-xs text-zinc-300">
              <input type="checkbox" checked={loop} onChange={event => { setLoop(event.currentTarget.checked); effectRuntimeRef.current?.setLoop?.(event.currentTarget.checked); }} />{t('devtools.fgoGallery.loop')}
            </label>
          </>}
        </div>
        {mode === 'motion' && selected && <details aria-label={t('devtools.fgoGallery.actionDescription')} className="mb-3 text-xs leading-5 text-zinc-300">
          <summary className="cursor-pointer text-cyan-200">{t('devtools.fgoGallery.actionAndNobleAssets')}</summary>
          <div className="max-h-[18vh] overflow-y-auto pt-1">
            <p>{fgoAnimationMeaning(animation)}</p>
            <p className="break-all text-zinc-500">{t('devtools.fgoGallery.sourceClip')}: {animation}</p>
            <p>{selected.noblePhantasm ? t('devtools.fgoGallery.fullPerformanceAvailable')
              : fgoNobleClipCount(selected) > 0 ? t('devtools.fgoGallery.nobleClipsOnly', { count: fgoNobleClipCount(selected) })
                : t('devtools.fgoGallery.noNobleAssets')}</p>
          </div>
        </details>}
        <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-cyan-300" style={{ width: `${progress}%` }} />
        </div>
        <input
          aria-label={t('devtools.fgoGallery.time')}
          className="mb-3 block h-5 w-full cursor-pointer accent-cyan-300"
          type="range"
          min={0}
          max={duration}
          step={0.001}
          value={Math.min(status.time, duration)}
          onChange={(event) => {
            const nextTime = Number(event.currentTarget.value);
            effectRuntimeRef.current?.seek(nextTime);
          }}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded border border-white/20 hover:border-cyan-200"
            aria-label={status.isPlaying ? t('devtools.fgoGallery.pause') : t('devtools.fgoGallery.play')}
            onClick={() => {
              if (status.isPlaying) {
                effectRuntimeRef.current?.pause();
              } else {
                effectRuntimeRef.current?.play();
              }
            }}
          >
            {status.isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          {mode === 'motion' && <>
            <button type="button" aria-label={t('devtools.fgoGallery.rotateLeft')} title={t('devtools.fgoGallery.rotateLeft')} className="grid h-10 w-8 shrink-0 place-items-center rounded hover:bg-zinc-800" onClick={() => effectRuntimeRef.current?.rotate?.(-15)}><Undo2 size={16} /></button>
            <button type="button" aria-label={t('devtools.fgoGallery.rotateRight')} title={t('devtools.fgoGallery.rotateRight')} className="grid h-10 w-8 shrink-0 place-items-center rounded hover:bg-zinc-800" onClick={() => effectRuntimeRef.current?.rotate?.(15)}><Redo2 size={16} /></button>
            <button type="button" aria-label={t('devtools.fgoGallery.resetView')} title={t('devtools.fgoGallery.resetView')} className="grid h-10 w-8 shrink-0 place-items-center rounded hover:bg-zinc-800" onClick={() => effectRuntimeRef.current?.resetView?.()}><RotateCw size={16} /></button>
          </>}
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded border border-white/20 hover:border-cyan-200"
            aria-label={t('devtools.fgoGallery.replay')}
            onClick={() => {
              effectRuntimeRef.current?.replay();
              effectRuntimeRef.current?.play();
            }}
          >
            <RotateCcw size={18} />
          </button>
          {SPEED_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`h-10 flex-1 rounded border text-sm tabular-nums ${speed === option ? 'border-cyan-200 bg-cyan-200 text-black' : 'border-white/20 hover:border-cyan-200'}`}
              aria-pressed={speed === option}
              onClick={() => {
                setSpeed(option);
                effectRuntimeRef.current?.setSpeed(option);
              }}
            >
              {option}x
            </button>
          ))}
        </div>
      </footer>
    </main>
  );
};

export default CutsceneThreePreview;
