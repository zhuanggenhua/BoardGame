import { useEffect, useRef } from 'react';
import { subscribeFxFrame } from '../../../engine/fx/frameClock';
import type { FgoBattleEffect } from '../fgo-runtime/fgoCharacterRuntime';
import { FATE_BATTLE_FX_TIMING, paintFateBattleFx } from './fateBattleFxPaint';

export function FateBattleFx({ effect }: { effect: FgoBattleEffect }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preset = effect.kind === 'impact' ? 'hit-spark' : effect.shape;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const { contact, duration } = FATE_BATTLE_FX_TIMING[preset];
    let elapsed = effect.kind === 'strike' ? contact - effect.untilImpact : 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      pixelRatio = Math.min(window.devicePixelRatio, 2);
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const unsubscribe = subscribeFxFrame(({ deltaSec }) => {
      elapsed += deltaSec;
      if (elapsed < 0 || width <= 0 || height <= 0) return;
      context.clearRect(0, 0, width, height);
      if (elapsed >= duration) {
        unsubscribe();
        observer.disconnect();
        return;
      }
      paintFateBattleFx(context, effect, elapsed, width, height);
    });
    return () => {
      unsubscribe();
      observer.disconnect();
    };
  }, [effect, preset]);

  return <canvas
    ref={canvasRef}
    className={effect.kind === 'impact' ? 'fd-fgo-impact' : 'fd-fgo-strike'}
    data-fgo-fx={preset}
  />;
}
