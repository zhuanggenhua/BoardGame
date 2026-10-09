import type { DiceBoxDieSkin, DiceBoxStyleProfile } from "../../lib/dice-box-threejs/engine";
import type { DicePhysicsProjectedLayout } from "../../lib/dice-physics/types";

export const BETRAYAL_HOUSE_DICE_STYLE_PROFILE = {
  id: "betrayal-house-dice",
  surface: "transparent-virtual",
  colorset: "white",
  texture: "",
  material: "plastic",
  soundMaterial: "plastic",
  colorSpotlight: 0xf4df9a,
  shadows: true,
  gravityMultiplier: 400,
  lightIntensity: 1.08,
  baseScale: 64,
  cameraZoom: 0.9,
  strength: 0.1,
  iterationLimit: 900,
  projectedLayoutMargin: 18,
  projectedLayoutMinGap: 12,
  optimizeSettledFaceReadability: true,
  customColorset: {
    name: "betrayal-house-aged-bone",
    foreground: "#2b2418",
    ["background"]: ["#fff0bd", "#ead18a", "#d2a95a", "#fff6d4"],
    outline: "#fff1c2",
    texture: "none",
    material: "plastic",
  },
} satisfies DiceBoxStyleProfile;

export const BETRAYAL_HOUSE_DICE_FACE_SYSTEM =
  "betrayal-house-0-0-1-1-2-2-face-skin";

const BETRAYAL_HOUSE_RULE_VALUE_TO_D6_FACE: Record<0 | 1 | 2, number> = {
  0: 1,
  1: 3,
  2: 5,
};

export const BETRAYAL_HOUSE_D6_FACE_TO_RULE_VALUE: Record<number, 0 | 1 | 2> = {
  1: 0,
  2: 0,
  3: 1,
  4: 1,
  5: 2,
  6: 2,
};

export const BETRAYAL_REROLL_HIGHLIGHT_CANDIDATE_COLOR = 0x00e7ff;
export const BETRAYAL_REROLL_HIGHLIGHT_SELECTED_COLOR = 0xff2dfb;
export const BETRAYAL_REROLL_HIGHLIGHT_RENDERER =
  "threejs-backside-shader-shell";
export const BETRAYAL_REROLL_TARGET_OUTLINE_RENDERER =
  "svg-projected-rounded-die-face";
export const BETRAYAL_REROLL_VISUAL_CONTRACT =
  "projected-rounded-face-outline-plus-threejs-shell-plus-transparent-hitbox";
export const BETRAYAL_REROLL_HIGHLIGHT_CANDIDATE_SCALE = 1.045;
export const BETRAYAL_REROLL_HIGHLIGHT_SELECTED_SCALE = 1.065;
export const BETRAYAL_REROLL_HIGHLIGHT_CANDIDATE_OPACITY = 0.72;
export const BETRAYAL_REROLL_HIGHLIGHT_SELECTED_OPACITY = 0.84;
export const BETRAYAL_REROLL_TARGET_OUTLINE_SCALE = 1;
export const BETRAYAL_REROLL_TARGET_OUTLINE_GAP = 0;
export const BETRAYAL_REROLL_TARGET_HIT_PADDING = 0;
export const BETRAYAL_REROLL_TARGET_OUTLINE_EXPAND_PX = 1.75;
export const BETRAYAL_REROLL_TARGET_CANDIDATE_STROKE_WIDTH = 2.25;
export const BETRAYAL_REROLL_TARGET_SELECTED_STROKE_WIDTH = 3.25;
export const BETRAYAL_REROLL_TARGET_CORNER_RADIUS = 7;
export const BETRAYAL_REROLL_TARGET_CENTER_SOURCE =
  "projected-visible-face-center";

const BETRAYAL_HOUSE_DICE_FACE_CANVAS_SIZE = 1024;
const betrayalHouseDieFaceCanvasCache: Partial<
  Record<0 | 1 | 2, HTMLCanvasElement>
> = {};
let betrayalHouseDieEdgeCanvasCache: HTMLCanvasElement | null = null;

export function resolveBetrayalHouseD6Face(pip: number): number {
  if (pip === 0 || pip === 1 || pip === 2) {
    return BETRAYAL_HOUSE_RULE_VALUE_TO_D6_FACE[pip];
  }
  return Math.max(1, Math.min(6, pip));
}

export const normalizeBetrayalHouseRuleValue = (pip: number): 0 | 1 | 2 =>
  pip === 0 || pip === 1 || pip === 2 ? pip : 0;

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function paintBetrayalHouseDieFaceBase(
  ctx: CanvasRenderingContext2D,
  options: { edgeOnly?: boolean } = {},
): void {
  const size = BETRAYAL_HOUSE_DICE_FACE_CANVAS_SIZE;
  const radius = size * 0.14;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  roundedRectPath(ctx, 0, 0, size, size, radius);
  ctx.clip();

  const gradient = ctx.createRadialGradient(
    size * 0.38,
    size * 0.27,
    size * 0.06,
    size * 0.5,
    size * 0.52,
    size * 0.66,
  );
  gradient.addColorStop(0, "#fff8d6");
  gradient.addColorStop(0.48, "#edcf82");
  gradient.addColorStop(1, "#d49a4f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const grain = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.18,
    size * 0.5,
    size * 0.5,
    size * 0.72,
  );
  grain.addColorStop(0, "rgba(255,255,255,0.18)");
  grain.addColorStop(0.58, "rgba(100,62,27,0.04)");
  grain.addColorStop(1, "rgba(64,36,13,0.18)");
  ctx.fillStyle = grain;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  const outerStroke = ctx.createLinearGradient(0, 0, size, size);
  outerStroke.addColorStop(0, "rgba(255,244,203,0.86)");
  outerStroke.addColorStop(0.42, "rgba(132,82,35,0.38)");
  outerStroke.addColorStop(1, "rgba(66,36,14,0.72)");
  ctx.strokeStyle = outerStroke;
  ctx.lineWidth = size * (options.edgeOnly ? 0.052 : 0.038);
  roundedRectPath(
    ctx,
    size * 0.035,
    size * 0.035,
    size * 0.93,
    size * 0.93,
    radius * 0.88,
  );
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = size * 0.012;
  roundedRectPath(
    ctx,
    size * 0.09,
    size * 0.09,
    size * 0.82,
    size * 0.82,
    radius * 0.68,
  );
  ctx.stroke();
}

function createBetrayalHouseDieFaceCanvas(value: 0 | 1 | 2): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = BETRAYAL_HOUSE_DICE_FACE_CANVAS_SIZE;
  canvas.height = BETRAYAL_HOUSE_DICE_FACE_CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  paintBetrayalHouseDieFaceBase(ctx);

  if (value === 0) {
    ctx.font = '900 520px Georgia, "Times New Roman", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 34;
    ctx.strokeStyle = "rgba(255,248,219,0.9)";
    ctx.strokeText("0", 512, 536);
    ctx.fillStyle = "#4d2a10";
    ctx.fillText("0", 512, 536);
  } else {
    const pipPositions: Record<1 | 2, Array<[number, number]>> = {
      1: [[512, 512]],
      2: [
        [356, 356],
        [668, 668],
      ],
    };

    for (const [x, y] of pipPositions[value]) {
      ctx.beginPath();
      ctx.arc(x, y, 132, 0, Math.PI * 2);
      ctx.fillStyle = "#4d2a10";
      ctx.fill();
      ctx.lineWidth = 18;
      ctx.strokeStyle = "rgba(255,248,219,0.78)";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - 36, y - 42, 32, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,248,219,0.36)";
      ctx.fill();
    }
  }

  return canvas;
}

function createBetrayalHouseDieEdgeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = BETRAYAL_HOUSE_DICE_FACE_CANVAS_SIZE;
  canvas.height = BETRAYAL_HOUSE_DICE_FACE_CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  paintBetrayalHouseDieFaceBase(ctx, { edgeOnly: true });
  return canvas;
}

function getBetrayalHouseDieFaceCanvas(value: 0 | 1 | 2): HTMLCanvasElement {
  const cached = betrayalHouseDieFaceCanvasCache[value];
  if (cached) {
    return cached;
  }
  const canvas = createBetrayalHouseDieFaceCanvas(value);
  betrayalHouseDieFaceCanvasCache[value] = canvas;
  return canvas;
}

function getBetrayalHouseDieEdgeCanvas(): HTMLCanvasElement {
  if (betrayalHouseDieEdgeCanvasCache) {
    return betrayalHouseDieEdgeCanvasCache;
  }
  betrayalHouseDieEdgeCanvasCache = createBetrayalHouseDieEdgeCanvas();
  return betrayalHouseDieEdgeCanvasCache;
}

export function getBetrayalRerollTargetVisibleSize(
  layout: DicePhysicsProjectedLayout,
) {
  const outlineSize = getBetrayalRerollTargetOutlineSize(layout);
  return {
    width: outlineSize.width,
    height: outlineSize.height,
  };
}

export function getBetrayalRerollTargetOutlineSize(
  layout: DicePhysicsProjectedLayout,
) {
  const outlineGeometry = getBetrayalRerollTargetOutlineGeometry(layout);
  return {
    width: Math.max(
      1,
      outlineGeometry.width * BETRAYAL_REROLL_TARGET_OUTLINE_SCALE +
        BETRAYAL_REROLL_TARGET_OUTLINE_GAP * 2,
    ),
    height: Math.max(
      1,
      outlineGeometry.height * BETRAYAL_REROLL_TARGET_OUTLINE_SCALE +
        BETRAYAL_REROLL_TARGET_OUTLINE_GAP * 2,
    ),
  };
}

export function getBetrayalRerollTargetHitSize(
  layout: DicePhysicsProjectedLayout,
) {
  const outlineSize = getBetrayalRerollTargetOutlineSize(layout);
  return {
    width: outlineSize.width + BETRAYAL_REROLL_TARGET_HIT_PADDING * 2,
    height: outlineSize.height + BETRAYAL_REROLL_TARGET_HIT_PADDING * 2,
  };
}

export function getBetrayalRerollTargetVisualCenter(
  layout: DicePhysicsProjectedLayout,
) {
  const outlineGeometry = getBetrayalRerollTargetOutlineGeometry(layout);
  return {
    x: outlineGeometry.x,
    y: outlineGeometry.y,
  };
}

export function getBetrayalRerollTargetVisualRotation(
  layout: DicePhysicsProjectedLayout,
): number {
  return layout.outlineRotateZ ?? layout.rotateZ;
}

type BetrayalRerollTargetOutlinePoint = {
  x: number;
  y: number;
};

export type BetrayalRerollTargetOutlineGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  absolutePoints: BetrayalRerollTargetOutlinePoint[];
  localPoints: BetrayalRerollTargetOutlinePoint[];
  path: string;
};

function getFallbackOutlinePoints(
  layout: DicePhysicsProjectedLayout,
): BetrayalRerollTargetOutlinePoint[] {
  const centerX = layout.outlineX ?? layout.x;
  const centerY = layout.outlineY ?? layout.y;
  const width = Math.max(1, layout.outlineWidth ?? layout.visualWidth ?? layout.width);
  const height = Math.max(1, layout.outlineHeight ?? layout.visualHeight ?? layout.height);
  const rotateZ = getBetrayalRerollTargetVisualRotation(layout);
  const cos = Math.cos(rotateZ);
  const sin = Math.sin(rotateZ);
  const corners: Array<[number, number]> = [
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [width / 2, height / 2],
    [-width / 2, height / 2],
  ];

  return corners.map(([x, y]) => ({
    x: centerX + x * cos - y * sin,
    y: centerY + x * sin + y * cos,
  }));
}

function expandOutlinePoints(
  points: BetrayalRerollTargetOutlinePoint[],
): BetrayalRerollTargetOutlinePoint[] {
  if (points.length < 3 || BETRAYAL_REROLL_TARGET_OUTLINE_EXPAND_PX <= 0) {
    return points;
  }

  const center = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x / points.length,
      y: sum.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );

  return points.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.001) {
      return point;
    }
    const scale = (distance + BETRAYAL_REROLL_TARGET_OUTLINE_EXPAND_PX) / distance;
    return {
      x: center.x + dx * scale,
      y: center.y + dy * scale,
    };
  });
}

function roundedPolygonPath(
  points: BetrayalRerollTargetOutlinePoint[],
  radius: number,
): string {
  if (points.length === 0) return "";
  if (points.length < 3 || radius <= 0) {
    const [first, ...rest] = points;
    return [
      `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`,
      ...rest.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
      "Z",
    ].join(" ");
  }

  const segments: string[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const previousDistance = Math.hypot(previous.x - current.x, previous.y - current.y);
    const nextDistance = Math.hypot(next.x - current.x, next.y - current.y);
    const cornerRadius = Math.min(radius, previousDistance / 2, nextDistance / 2);
    const start = {
      x: current.x + ((previous.x - current.x) / Math.max(previousDistance, 1)) * cornerRadius,
      y: current.y + ((previous.y - current.y) / Math.max(previousDistance, 1)) * cornerRadius,
    };
    const end = {
      x: current.x + ((next.x - current.x) / Math.max(nextDistance, 1)) * cornerRadius,
      y: current.y + ((next.y - current.y) / Math.max(nextDistance, 1)) * cornerRadius,
    };

    segments.push(
      index === 0
        ? `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`
        : `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    );
    segments.push(
      `Q ${current.x.toFixed(2)} ${current.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    );
  }
  segments.push("Z");
  return segments.join(" ");
}

export function getBetrayalRerollTargetOutlineGeometry(
  layout: DicePhysicsProjectedLayout,
): BetrayalRerollTargetOutlineGeometry {
  const sourcePoints =
    layout.outlinePoints && layout.outlinePoints.length >= 3
      ? layout.outlinePoints
      : getFallbackOutlinePoints(layout);
  const absolutePoints = expandOutlinePoints(sourcePoints);
  const minX = Math.min(...absolutePoints.map((point) => point.x));
  const maxX = Math.max(...absolutePoints.map((point) => point.x));
  const minY = Math.min(...absolutePoints.map((point) => point.y));
  const maxY = Math.max(...absolutePoints.map((point) => point.y));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const localPoints = absolutePoints.map((point) => ({
    x: point.x - minX,
    y: point.y - minY,
  }));

  return {
    x: minX + width / 2,
    y: minY + height / 2,
    width,
    height,
    absolutePoints,
    localPoints,
    path: roundedPolygonPath(localPoints, BETRAYAL_REROLL_TARGET_CORNER_RADIUS),
  };
}

export function createBetrayalHouseDiceSkin(
  value: 0 | 1 | 2,
): DiceBoxDieSkin {
  const ruleFaceCanvases: Record<0 | 1 | 2, HTMLCanvasElement> = {
    0: getBetrayalHouseDieFaceCanvas(0),
    1: getBetrayalHouseDieFaceCanvas(1),
    2: getBetrayalHouseDieFaceCanvas(2),
  };
  const edgeCanvas = getBetrayalHouseDieEdgeCanvas();
  const faceCanvases: Record<number, HTMLCanvasElement> = {
    1: ruleFaceCanvases[BETRAYAL_HOUSE_D6_FACE_TO_RULE_VALUE[1]],
    2: ruleFaceCanvases[BETRAYAL_HOUSE_D6_FACE_TO_RULE_VALUE[2]],
    3: ruleFaceCanvases[BETRAYAL_HOUSE_D6_FACE_TO_RULE_VALUE[3]],
    4: ruleFaceCanvases[BETRAYAL_HOUSE_D6_FACE_TO_RULE_VALUE[4]],
    5: ruleFaceCanvases[BETRAYAL_HOUSE_D6_FACE_TO_RULE_VALUE[5]],
    6: ruleFaceCanvases[BETRAYAL_HOUSE_D6_FACE_TO_RULE_VALUE[6]],
  };

  return {
    id: `${BETRAYAL_HOUSE_DICE_FACE_SYSTEM}-physical-distribution`,
    edgeCanvas,
    faceCanvases,
    topFaceCanvas: ruleFaceCanvases[value],
    readableFaceValue: resolveBetrayalHouseD6Face(value),
  };
}
