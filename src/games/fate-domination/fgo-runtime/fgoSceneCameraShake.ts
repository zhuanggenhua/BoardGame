import type { EffectTimelineEvent } from './fgoSceneData';
import { seededRandom } from './fgoSceneMath';

const PI = Math.fround(Math.PI);
const HORIZONTAL_PERIOD = Math.fround(1.4);

// APK 2.129.0 ARM64 ProcessEvent 0x3493964, decoded with region XOR 0x14.
export const nativeShakeSample = (frame: number, horizontal: number, vertical: number,
  randomX: number, randomY: number): [number, number] => {
  const phase = Math.fround(Math.fround(frame) * PI);
  const xSign = Math.sin(Math.fround(phase / HORIZONTAL_PERIOD)) < 0 ? -1 : 1;
  const ySign = Math.sin(phase) < 0 ? -1 : 1;
  return [Math.fround(randomX * horizontal) * xSign, Math.fround(randomY * vertical) * ySign];
};

export const cameraShakeOffset = (events: EffectTimelineEvent[], time: number, fps: number): [number, number] => {
  const frame = Math.floor(time * fps + 1e-6);
  const event = events.filter(event => event.type === 'shake' && event.time <= time
    && time < event.time + event.duration && Math.ceil(event.time * fps - 1e-6) <= frame).at(-1);
  if (!event) return [0, 0];
  if (event.isRelative || event.fixedUpdate) throw new Error(`Unsupported source shake context: ${event.sequencePath}`);
  const localFrame = frame - Math.ceil(event.time * fps - 1e-6);
  // Unity uses its global Random.Range stream. A stable replay stream preserves
  // its two independent ranges without claiming the native random sequence.
  const random = seededRandom(`${event.sequencePath}:shake`);
  let x = 0; let y = 0;
  for (let index = 0; index <= localFrame; index += 1) { x = random(); y = random(); }
  return nativeShakeSample(localFrame, event.horizontalShakeSize ?? 0, event.verticalShakeSize ?? 0, x, y);
};
