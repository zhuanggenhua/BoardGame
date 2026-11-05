import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { EffectData } from '../cutscene/fgoSceneData';
import { cameraShakeOffset, nativeShakeSample } from '../cutscene/fgoSceneCameraShake';

const events = (JSON.parse(readFileSync('public/assets/dev/fgo-cutscene/np100100/np100100_effects.json', 'utf8')) as EffectData).timeline;

describe('FGO APK camera shake', () => {
  it('uses the native float32 phases, independent ranges and strict negative-sine signs', () => {
    expect(nativeShakeSample(0, 0.5, 0.25, 0.5, 0.5)).toEqual([0.25, 0.125]);
    expect(nativeShakeSample(1, 0.5, 0.25, 0.5, 0.5)).toEqual([0.25, -0.125]);
    expect(nativeShakeSample(2, 0.5, 0.25, 0.5, 0.5)).toEqual([-0.25, 0.125]);
  });

  it('keeps original event ranges, resets outside events and survives backward seeking', () => {
    const shakes = events.filter(event => event.type === 'shake');
    expect(shakes).toHaveLength(6);
    expect(cameraShakeOffset(events, 0, 30)).toEqual([0, 0]);
    for (const event of shakes) {
      expect(event.isRelative).toBe(false);
      expect(event.fixedUpdate).toBe(false);
      const at = Math.ceil(event.time * 30) / 30 + 1 / 30;
      const before = cameraShakeOffset(events, at, 30);
      cameraShakeOffset(events, 16.5, 30);
      expect(cameraShakeOffset(events, at, 30)).toEqual(before);
      expect(Math.abs(before[0])).toBeLessThanOrEqual(event.horizontalShakeSize!);
      expect(Math.abs(before[1])).toBeLessThanOrEqual(event.verticalShakeSize!);
    }
    expect(cameraShakeOffset(events, 18.5, 30)).toEqual([0, 0]);
  });
});
