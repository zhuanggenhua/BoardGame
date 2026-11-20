import type { FgoBattleEffect } from '../fgo-runtime/fgoCharacterRuntime';

export const FATE_BATTLE_FX_TIMING = {
  slash: { contact: 0.06, duration: 0.42 },
  thrust: { contact: 0.07, duration: 0.31 },
  'hit-spark': { contact: 0, duration: 0.39 },
};

type Point = readonly [number, number];
type Arc = readonly [Point, Point, Point, Point];
const SLASH_ARC: Arc = [[-0.88, -0.29], [0.32, -0.65], [0.38, 0.29], [-0.83, 0.40]];
const SLASH_ECHO: Arc = [[-0.68, -0.32], [0.39, -0.57], [0.35, 0.22], [-0.53, 0.36]];
const clamp = (value: number) => Math.max(0, Math.min(1, value));

// 双边沿三次曲线展开，刀光两端保留尖角。
function ribbon(ctx: CanvasRenderingContext2D, arc: Arc, start: number, end: number, thickness: number) {
  if (end <= start) return;
  const [a, b, c, d] = arc;
  const steps = 32;
  const back: Point[] = [];
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const t = start + (end - start) * u;
    const s = 1 - t;
    const x = s ** 3 * a[0] + 3 * s * s * t * b[0] + 3 * s * t * t * c[0] + t ** 3 * d[0];
    const y = s ** 3 * a[1] + 3 * s * s * t * b[1] + 3 * s * t * t * c[1] + t ** 3 * d[1];
    const dx = s * s * (b[0] - a[0]) + 2 * s * t * (c[0] - b[0]) + t * t * (d[0] - c[0]);
    const dy = s * s * (b[1] - a[1]) + 2 * s * t * (c[1] - b[1]) + t * t * (d[1] - c[1]);
    const weight = thickness * Math.sin(Math.PI * u) ** 0.70 * (0.45 + 0.55 * u);
    const normal = weight / Math.hypot(dx, dy);
    if (i === 0) ctx.moveTo(x - dy * normal, y + dx * normal);
    else ctx.lineTo(x - dy * normal, y + dx * normal);
    back.push([x + dy * normal, y - dx * normal]);
  }
  for (const [x, y] of back.reverse()) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
}

function slash(ctx: CanvasRenderingContext2D, time: number) {
  const head = 1 - (1 - clamp(time / 0.115)) ** 2;
  const tail = 0.48 * clamp((time - 0.075) / 0.33);
  const alpha = clamp(time / 0.018) * (1 - clamp((time - 0.09) / 0.31)) ** 1.4;
  if (head <= tail || alpha <= 0) return;
  const edge = ctx.createLinearGradient(-0.85, -0.29, 0.18, 0.13);
  edge.addColorStop(0, '#1d56c922');
  edge.addColorStop(0.48, '#2859d7');
  edge.addColorStop(1, '#64d8ff');
  ctx.globalAlpha = alpha * 0.68;
  ctx.fillStyle = edge;
  ribbon(ctx, SLASH_ARC, tail, head, 0.072);

  const blade = ctx.createLinearGradient(-0.73, -0.26, 0.13, 0.18);
  blade.addColorStop(0, '#64b8ff00');
  blade.addColorStop(0.43, '#67dcff');
  blade.addColorStop(0.77, '#eefcff');
  blade.addColorStop(1, '#ffffff');
  ctx.globalAlpha = alpha * 0.95;
  ctx.fillStyle = blade;
  ribbon(ctx, SLASH_ARC, tail, head, 0.052);

  ctx.globalAlpha = alpha * 0.80;
  ctx.fillStyle = '#b7efff';
  ribbon(ctx, SLASH_ECHO, Math.min(head, tail + 0.13), head, 0.011);
}

function thrust(ctx: CanvasRenderingContext2D, time: number, reach: number) {
  const front = -1 + 1.08 * (1 - (1 - clamp(time / 0.075)) ** 3);
  const tail = -1 + 0.86 * clamp((time - 0.055) / 0.20);
  const alpha = clamp(time / 0.018) * (1 - clamp((time - 0.08) / 0.22)) ** 1.6;
  if (front <= tail || alpha <= 0) return;

  const hot = ctx.createLinearGradient(tail, 0, front, 0);
  hot.addColorStop(0, '#a9322000');
  hot.addColorStop(0.38, '#e7693170');
  hot.addColorStop(0.83, '#ffd482');
  hot.addColorStop(1, '#fff3c8');
  const length = front - tail;
  const shoulder = front - Math.min(length * 0.37, 0.16);
  ctx.globalAlpha = alpha * 0.89;
  ctx.fillStyle = hot;
  ctx.beginPath();
  ctx.moveTo(tail, 0.009);
  ctx.quadraticCurveTo(shoulder - length * 0.20, -0.017, shoulder, -0.075);
  ctx.lineTo(front, 0);
  ctx.lineTo(shoulder, 0.067);
  ctx.quadraticCurveTo(shoulder - length * 0.17, 0.015, tail, 0.009);
  ctx.fill();

  const coreStart = Math.max(tail, -reach - 0.10);
  if (coreStart < shoulder) {
    const core = ctx.createLinearGradient(coreStart, 0, front, 0);
    core.addColorStop(0, '#fff1ce44');
    core.addColorStop(0.58, '#fff7dd');
    core.addColorStop(1, '#ffffff');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.moveTo(coreStart, 0);
    ctx.quadraticCurveTo(shoulder - length * 0.16, -0.007, shoulder, -0.033);
    ctx.lineTo(front, 0);
    ctx.lineTo(shoulder, 0.028);
    ctx.quadraticCurveTo(shoulder - length * 0.17, 0.008, coreStart, 0);
    ctx.fill();
  }

  ctx.globalAlpha = alpha * 0.66;
  ctx.fillStyle = hot;
  for (const [y, offset] of [[-0.12, 0.21], [0.11, 0.13], [0.17, 0.42]]) {
    const tip = front - offset * length;
    ctx.beginPath();
    ctx.moveTo(tail, y);
    ctx.quadraticCurveTo(tip - length * 0.16, y - 0.028, tip, y * 0.61);
    ctx.quadraticCurveTo(tip - length * 0.27, y - 0.007, tail, y);
    ctx.fill();
  }
}

const HIT_RAYS = [
  [-2.81, 0.23], [-2.14, 0.14], [-1.28, 0.24], [-0.72, 0.13],
  [-0.23, 0.34], [0.37, 0.16], [0.94, 0.29], [1.78, 0.19], [2.54, 0.13],
] as const;

function impact(ctx: CanvasRenderingContext2D, time: number) {
  const fade = (1 - clamp(time / FATE_BATTLE_FX_TIMING['hit-spark'].duration)) ** 1.6;
  const travel = 1 - (1 - clamp(time / 0.31)) ** 2;
  for (const [angle, reach] of HIT_RAYS) {
    ctx.save();
    ctx.rotate(angle);
    const tip = reach * (0.45 + 0.64 * travel);
    const base = Math.max(0.006, tip - reach * (0.52 - 0.34 * travel));
    const color = ctx.createLinearGradient(base, 0, tip, 0);
    color.addColorStop(0, '#fa963500');
    color.addColorStop(0.58, '#ffbd55');
    color.addColorStop(1, '#fff8dc');
    ctx.globalAlpha = fade * 0.96;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(base, 0.008);
    ctx.lineTo(tip - 0.022, -0.010 * fade);
    ctx.lineTo(tip, -0.003);
    ctx.lineTo(tip - 0.017, 0.008);
    ctx.fill();
    ctx.restore();
  }
  const flash = clamp((time + 0.015) / 0.034) * (1 - clamp((time - 0.056) / 0.124)) ** 1.4;
  if (flash <= 0) return;
  ctx.rotate(-0.24);
  ctx.scale(0.54 + flash * 0.46, 0.54 + flash * 0.46);
  ctx.globalAlpha = flash * 0.82;
  ctx.fillStyle = '#fff7d7';
  ctx.beginPath();
  ctx.moveTo(-0.12, 0);
  ctx.quadraticCurveTo(-0.014, -0.014, 0, -0.108);
  ctx.quadraticCurveTo(0.014, -0.012, 0.17, 0);
  ctx.quadraticCurveTo(0.011, 0.016, 0, 0.083);
  ctx.quadraticCurveTo(-0.011, 0.015, -0.12, 0);
  ctx.fill();
}

export function paintFateBattleFx(ctx: CanvasRenderingContext2D, effect: FgoBattleEffect, time: number, width: number, height: number) {
  ctx.save();
  if (effect.kind === 'impact') {
    ctx.translate(effect.at.x * width / 100, effect.at.y * height / 100);
    ctx.scale(effect.flip ? -height : height, height);
    impact(ctx, time);
  } else {
    const dx = (effect.to.x - effect.from.x) * width / 100;
    const dy = (effect.to.y - effect.from.y) * height / 100;
    // 亮刃覆盖交战区域，体积随地图高度和双方间距变化。
    const span = Math.min(width * 0.66, Math.max(height * 1.54, Math.hypot(dx, dy) * 1.14));
    ctx.translate(effect.at.x * width / 100, effect.at.y * height / 100);
    ctx.scale(dx < 0 ? -span : span, height);
    // 库丘林的直刺以平举枪动画出手，尾迹沿武器水平延伸。
    if (effect.shape === 'thrust') thrust(ctx, time, Math.abs(dx) / span);
    else {
      // 亮刃高于曲线原点，落到躯干时按挥击方向补足可见前缘。
      ctx.translate(0.055, 0.10);
      slash(ctx, time);
    }
  }
  ctx.restore();
}
