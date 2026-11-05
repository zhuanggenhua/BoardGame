import { Euler, MathUtils, Object3D, Quaternion, Vector3 } from 'three';
import type { CompressedAnimationData, CurveData, CurveKeyData, GradientData, ColorData, TransformData, Vec3 } from './fgoSceneData';

export const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const unityEuler = (values: Vec3) => new Quaternion().setFromEuler(new Euler(
  ...values.map(MathUtils.degToRad) as Vec3, 'YXZ',
));
export const setTransform = (node: Object3D, transform: TransformData) => {
  node.position.fromArray(transform.position);
  node.quaternion.fromArray(transform.rotation);
  node.scale.fromArray(transform.scale);
};
export const keyCurve = (keys: Array<CurveKeyData & { stepIn?: boolean; stepOut?: boolean }>, time: number, fallback = 0): number => {
  if (!keys.length) return fallback;
  if (time <= keys[0].time) return keys[0].value;
  for (let i = 1; i < keys.length; i += 1) {
    const a = keys[i - 1]; const b = keys[i];
    if (time > b.time) continue;
    if (time === b.time) return b.value;
    if (a.stepOut || b.stepIn) return a.value;
    if ((a.outSlope !== undefined && !Number.isFinite(a.outSlope))
      || (b.inSlope !== undefined && !Number.isFinite(b.inSlope))) return a.value;
    const span = b.time - a.time;
    if (span <= 0) return b.value;
    const t = (time - a.time) / span;
    return (2 * t ** 3 - 3 * t ** 2 + 1) * a.value
      + (t ** 3 - 2 * t ** 2 + t) * (a.outSlope ?? 0) * span
      + (-2 * t ** 3 + 3 * t ** 2) * b.value
      + (t ** 3 - t ** 2) * (b.inSlope ?? 0) * span;
  }
  return keys[keys.length - 1].value;
};
export const sampleCurve = (curve: CurveData | undefined, time: number, random = 0.5, fallback = 0) => {
  if (!curve) return fallback;
  if (curve.state === 0) return curve.scalar;
  if (curve.state === 1) return keyCurve(curve.keys, time, 1) * curve.scalar;
  if (curve.state === 2) {
    // Unity TwoCurves uses one curveMultiplier for both bounds. minScalar is
    // constantMin and applies only to TwoConstants, even when serialized as zero.
    const lo = keyCurve(curve.minKeys ?? [], time, 1);
    return (lo + (keyCurve(curve.keys, time, 1) - lo) * random) * curve.scalar;
  }
  return curve.minScalar + (curve.scalar - curve.minScalar) * random;
};

const integralKeys = (keys: Parameters<typeof keyCurve>[0], from: number, to: number) => {
  // Splitting at every key makes two-point Gauss quadrature exact for each cubic Hermite segment.
  const cuts = [from, ...keys.map(key => key.time).filter(time => time > from && time < to), to];
  let integral = 0;
  for (let i = 1; i < cuts.length; i += 1) {
    const half = (cuts[i] - cuts[i - 1]) / 2;
    const mid = (cuts[i] + cuts[i - 1]) / 2;
    integral += half * (keyCurve(keys, mid - half / Math.sqrt(3), 1)
      + keyCurve(keys, mid + half / Math.sqrt(3), 1));
  }
  return integral;
};
export const integrateCurve = (curve: CurveData, from: number, to: number, random = 0.5): number => {
  if (to < from) return -integrateCurve(curve, to, from, random);
  if (curve.state === 0 || curve.state === 3) return sampleCurve(curve, 0, random) * (to - from);
  const hi = integralKeys(curve.keys, from, to);
  if (curve.state === 1) return hi * curve.scalar;
  const lo = integralKeys(curve.minKeys ?? [], from, to);
  return (lo + (hi - lo) * random) * curve.scalar;
};
const interpolateColor = (a: ColorData, b: ColorData, t: number): ColorData => ({
  r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t, a: a.a + (b.a - a.a) * t,
});
export const gradient = (data: GradientData, time: number, random = 0.5): ColorData => {
  if (data.state === 0) return { ...data.maxColor };
  if (data.state === 2) return interpolateColor(data.minColor, data.maxColor, random);
  if (data.state === 3) {
    if (!data.minKeys || !data.minAlphaKeys) throw new Error('Source gradient minimum was not exported');
    return interpolateColor(gradient({ ...data, state: 1, keys: data.minKeys, alphaKeys: data.minAlphaKeys,
      mode: data.minMode, maxColor: data.minColor }, time), gradient({ ...data, state: 1 }, time), random);
  }
  if (data.state === 4) return gradient({ ...data, state: 1 }, random);
  let result = { ...(data.keys[0]?.color ?? data.maxColor) };
  for (let i = 1; i < data.keys.length; i += 1) {
    const a = data.keys[i - 1]; const b = data.keys[i];
    const t = clamp((time - a.time) / (b.time - a.time));
    result = interpolateColor(a.color, b.color, data.mode === 1 && t < 1 ? 0 : t);
    if (time <= b.time) break;
  }
  const alphaKeys = data.alphaKeys.map(k => ({ time: k.time, value: k.alpha, inSlope: 0, outSlope: 0 }));
  // Unity gradients interpolate linearly, independently for color and alpha keys.
  if (alphaKeys.length) {
    let alpha = alphaKeys[0].value;
    for (let i = 1; i < alphaKeys.length; i += 1) {
      const a = alphaKeys[i - 1]; const b = alphaKeys[i];
      const t = clamp((time - a.time) / (b.time - a.time));
      alpha = a.value + (b.value - a.value) * (data.mode === 1 && t < 1 ? 0 : t);
      if (time <= b.time) break;
    }
    result.a = alpha;
  }
  return result;
};
export const clipValues = (clip: CompressedAnimationData, time: number, loop = false, authoredFrames = false) => {
  const values = new Array<number>(clip.scalarCount);
  for (const frame of clip.frames) {
    if (frame.time >= -1e20) continue;
    for (const [index, coeffs] of frame.keys) values[index] = coeffs[3];
  }
  for (const [index, value] of clip.constants) values[index] = value;
  let sampleTime = loop ? ((time % clip.duration) + clip.duration) % clip.duration : clamp(time, 0, clip.duration);
  if (authoredFrames) sampleTime = clip.frames.reduce((last, f) => f.time >= 0 && f.time <= sampleTime + 1e-5 ? Math.max(last, f.time) : last, 0);
  const latest = new Map<number, { time: number; coeffs: number[] }>();
  for (const frame of clip.frames) {
    if (frame.time < -1e20 || frame.time > sampleTime) continue;
    for (const [index, coeffs] of frame.keys) latest.set(index, { time: frame.time, coeffs });
  }
  for (const [index, key] of latest) {
    const [a, b, c, d] = key.coeffs; const t = sampleTime - key.time;
    values[index] = ((a * t + b) * t + c) * t + d;
  }
  return values;
};
export const seededRandom = (name: string) => {
  let seed = 2166136261;
  for (const char of name) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
};
export const vector = (value: { x?: number; y?: number; z?: number } | undefined, fallback: Vec3 = [0, 0, 0]) => (
  new Vector3(value?.x ?? fallback[0], value?.y ?? fallback[1], value?.z ?? fallback[2])
);
