import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import {
  createCutsceneDemoRuntime,
  type CutsceneRuntimeHandle,
  type CutsceneRuntimeStatus,
} from './cutscene/cutsceneDemoRuntime';

const SPEED_OPTIONS = [0.5, 1, 1.5] as const;
const DEFAULT_SPEED = 1;

const PHASE_LABELS: Record<string, string> = {
  loading: '加载中',
  'target lock': '镜头锁定',
  'cut-in': '角色特写',
  charge: '蓄力',
  release: '宝具释放',
  duel: '近身斩击',
  beam: '光束命中',
  'final ray': '终段光柱',
  impact: '命中爆发',
  settle: '收束',
  ready: '结束',
};

const initialStatus: CutsceneRuntimeStatus = {
  time: 0,
  duration: 18.5,
  phase: 'loading',
  firedEvents: [],
  isPlaying: false,
};

const CutscenePreview = () => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<CutsceneRuntimeHandle | null>(null);
  const [status, setStatus] = useState<CutsceneRuntimeStatus>(initialStatus);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    let cancelled = false;
    void createCutsceneDemoRuntime(stage, {
      autoplay: true,
      speed: DEFAULT_SPEED,
      shouldAttach: () => !cancelled,
      onStatus: (nextStatus) => {
        if (!cancelled) setStatus(nextStatus);
      },
    }).then((runtime) => {
      if (cancelled) {
        runtime.destroy();
        return;
      }
      runtimeRef.current = runtime;
    }).catch((error) => {
      console.error('[CutscenePreview] Failed to initialize Pixi runtime', error);
    });

    return () => {
      cancelled = true;
      runtimeRef.current?.destroy();
      runtimeRef.current = null;
    };
  }, []);

  const progress = Math.min(100, Math.max(0, (status.time / status.duration) * 100));

  const updateSpeed = (nextSpeed: number) => {
    setSpeed(nextSpeed);
    runtimeRef.current?.setSpeed(nextSpeed);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-slate-100">
      <div
        ref={stageRef}
        data-testid="cutscene-preview-stage"
        className="absolute inset-0"
      />
      <div className="pointer-events-none fixed left-0 right-0 top-0 z-10 h-20 bg-gradient-to-b from-black/45 to-transparent" />
      <div className="fixed left-4 top-4 z-20 flex items-center gap-3">
        <a
          href="/"
          className="rounded border border-white/10 bg-black/45 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-200/60 hover:text-white"
        >
          返回
        </a>
        <span className="rounded border border-white/10 bg-black/45 px-3 py-2 text-xs font-semibold tabular-nums text-cyan-100">
          {PHASE_LABELS[status.phase] ?? status.phase} {status.time.toFixed(2)}s
        </span>
      </div>
      <div className="fixed bottom-4 left-1/2 z-20 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 rounded border border-white/10 bg-black/55 p-2 backdrop-blur">
        <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-cyan-300 transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <section className="flex gap-2">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded border border-white/10 bg-white/[0.06] text-white transition hover:border-cyan-300/60 hover:bg-cyan-300/10"
              aria-label={status.isPlaying ? '暂停演出' : '播放演出'}
              onClick={() => {
                if (status.isPlaying) {
                  runtimeRef.current?.pause();
                } else {
                  runtimeRef.current?.play();
                }
              }}
            >
              {status.isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded border border-white/10 bg-white/[0.06] text-white transition hover:border-rose-300/60 hover:bg-rose-300/10"
              aria-label="重播演出"
              onClick={() => runtimeRef.current?.replay()}
            >
              <RotateCcw size={18} />
            </button>
            <div className="flex min-w-0 flex-1 rounded border border-white/10 bg-white/[0.04] p-1">
              {SPEED_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={[
                    'min-w-0 flex-1 rounded px-2 py-2 text-sm font-bold tabular-nums transition',
                    speed === option
                      ? 'bg-cyan-300 text-slate-950'
                      : 'text-slate-300 hover:bg-white/[0.06]',
                  ].join(' ')}
                  onClick={() => updateSpeed(option)}
                >
                  {option}x
                </button>
              ))}
            </div>
        </section>
      </div>
    </main>
  );
};

export default CutscenePreview;
