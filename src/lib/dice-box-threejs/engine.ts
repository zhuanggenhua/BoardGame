import type DiceBoxModule from '@3d-dice/dice-box-threejs';
import { LinearFilter, LinearMipmapLinearFilter, Quaternion, SRGBColorSpace, Vector3 } from 'three';
import type { DiceBoxConfig, DiceBoxDie, DiceBoxMaterialInstance } from '@3d-dice/dice-box-threejs';

import type {
    DicePhysicsMotionSnapshot,
    DicePhysicsProjectedLayout,
    DicePhysicsRendererMode,
    DicePhysicsState,
} from '../dice-physics/types';

export type DiceBoxProjectedLayout = DicePhysicsProjectedLayout;
export type DiceBoxMotionSnapshot = DicePhysicsMotionSnapshot;

export type DiceBoxMaterial = NonNullable<DiceBoxConfig['theme_material']>;
export type DiceBoxCustomColorset = NonNullable<DiceBoxConfig['theme_customColorset']>;

export interface DiceBoxStyleProfile {
    id: string;
    surface?: string;
    colorset?: string;
    customColorset?: DiceBoxCustomColorset | null;
    texture?: string;
    material?: DiceBoxMaterial;
    soundMaterial?: string;
    colorSpotlight?: number;
    shadows?: boolean;
    gravityMultiplier?: number;
    lightIntensity?: number;
    baseScale?: number;
    cameraZoom?: number;
    initialThrowSpread?: number;
    settledSpreadAnimationMs?: number;
    fitWorldToCameraView?: boolean;
    worldCenterOffsetX?: number;
    worldCenterOffsetY?: number;
    strength?: number;
    iterationLimit?: number;
    arrangeSettledDice?: boolean;
    worldWidthScale?: number;
    worldHeightScale?: number;
    recoverOutOfBounds?: boolean;
    settledLayoutScale?: number;
    settledLayout?: Array<{ x: number; y: number; yaw: number }>;
    compactSettledDice?: boolean;
}

export interface DiceBoxDieSkin {
    id: string;
    faceCanvases: Record<number, HTMLCanvasElement>;
    topFaceCanvas?: HTMLCanvasElement;
    edgeCanvas?: HTMLCanvasElement;
    faceImages?: Record<number, HTMLImageElement | HTMLCanvasElement>;
    faceLabels?: Record<number, string>;
    preferPresetMaterials?: boolean;
}

export interface DiceBoxEngineConfig {
    styleProfile?: DiceBoxStyleProfile;
    rendererMode?: DicePhysicsRendererMode;
    canvasTestId?: string;
    /**
     * @deprecated Use styleProfile.customColorset. Kept temporarily so callers can
     * be migrated without coupling game UI to third-party option names.
     */
    themeCustomColorset?: DiceBoxConfig['theme_customColorset'];
}

type DiceBoxThrowVector = {
    pos?: DiceBoxVectorLike;
    velocity?: DiceBoxVectorLike;
};

type DiceBoxInternalNotationVector = {
    vectors?: DiceBoxThrowVector[];
    result?: number[];
};

type DiceBoxInternalRuntime = InstanceType<typeof DiceBoxModule> & {
    iteration?: number;
    notationVectors?: DiceBoxInternalNotationVector | null;
    startClickThrow?: (notation: string) => DiceBoxInternalNotationVector | null;
    spawnDice?: (vector: DiceBoxThrowVector, die?: DiceBoxDie) => void;
    simulateThrow?: () => void;
    steps?: number;
};

type DiceBoxVectorLike = {
    x: number;
    y: number;
    z: number;
    set?: (x: number, y: number, z: number) => void;
};

type DiceBoxQuaternionLike = {
    x: number;
    y: number;
    z: number;
    w: number;
    copy?: (quaternion: DiceBoxQuaternionLike) => void;
    set?: (x: number, y: number, z: number, w: number) => void;
};

type DiceBoxBodyLike = {
    position?: DiceBoxVectorLike;
    quaternion?: DiceBoxQuaternionLike;
    velocity?: DiceBoxVectorLike;
    angularVelocity?: DiceBoxVectorLike;
    type?: number;
    mass?: number;
    updateMassProperties?: () => void;
    wakeUp?: () => void;
    sleep?: () => void;
    aabbNeedsUpdate?: boolean;
};

type DiceBoxDieWithBody = DiceBoxDie & {
    body?: DiceBoxBodyLike;
};

type DiceBoxDieTransformSnapshot = {
    position: { x: number; y: number; z: number };
    quaternion: { x: number; y: number; z: number; w: number };
    bodyType?: number;
    bodyMass?: number;
};

type DiceBoxWorldBounds = {
    width: number;
    height: number;
};

const DEFAULT_DICE_BOX_STYLE_PROFILE: DiceBoxStyleProfile = {
    id: 'default-green-felt',
    surface: 'green-felt',
    colorset: 'white',
    texture: '',
    material: 'plastic',
    soundMaterial: 'plastic',
    colorSpotlight: 0xefdfd5,
    shadows: true,
    gravityMultiplier: 400,
    lightIntensity: 0.7,
    baseScale: 90,
    strength: 0.92,
    iterationLimit: 1000,
    settledLayoutScale: 1,
    compactSettledDice: false,
};

let nextContainerId = 0;
let diceBoxModulePromise: Promise<typeof DiceBoxModule> | null = null;

async function loadDiceBoxModule(): Promise<typeof DiceBoxModule> {
    if (!diceBoxModulePromise) {
        diceBoxModulePromise = import('@3d-dice/dice-box-threejs').then((module) => module.default);
    }
    return diceBoxModulePromise;
}

function createNotation(values: number[]): string {
    if (values.length === 0) return '0d6';
    return `${values.length}d6@${values.join(',')}`;
}

function readDieValue(die: DiceBoxDie | undefined): number | null {
    const value = die?.getLastValue?.().value;
    return typeof value === 'number' ? value : null;
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

const SETTLED_DICE_LAYOUT: Array<{ x: number; y: number; yaw: number }> = [
    { x: -1.24, y: -0.86, yaw: -0.18 },
    { x: -0.44, y: -0.18, yaw: 0.08 },
    { x: 0.18, y: -0.68, yaw: -0.04 },
    { x: 1.08, y: -0.22, yaw: 0.16 },
    { x: 0.84, y: -1.04, yaw: -0.12 },
];
const SETTLED_SPREAD_SLOTS_BY_COUNT: Record<number, Array<{ x: number; y: number }>> = {
    2: [
        { x: -0.34, y: 0 },
        { x: 0.34, y: 0 },
    ],
    3: [
        { x: -0.48, y: -0.28 },
        { x: 0.48, y: -0.22 },
        { x: 0, y: 0.42 },
    ],
    4: [
        { x: -0.4, y: -0.4 },
        { x: 0.4, y: -0.36 },
        { x: -0.34, y: 0.4 },
        { x: 0.34, y: 0.44 },
    ],
    5: [
        { x: -0.86, y: -0.38 },
        { x: 0, y: -0.48 },
        { x: 0.86, y: -0.34 },
        { x: -0.62, y: 0.46 },
        { x: 0.62, y: 0.5 },
    ],
};
const SETTLED_SCREEN_SLOTS_BY_COUNT: Record<number, Array<{ x: number; y: number; yaw: number }>> = {
    2: [
        { x: 0.36, y: 0.54, yaw: -0.08 },
        { x: 0.64, y: 0.5, yaw: 0.08 },
    ],
    3: [
        { x: 0.26, y: 0.62, yaw: -0.1 },
        { x: 0.5, y: 0.32, yaw: 0.04 },
        { x: 0.74, y: 0.6, yaw: 0.12 },
    ],
    4: [
        { x: 0.24, y: 0.64, yaw: -0.12 },
        { x: 0.44, y: 0.34, yaw: 0.06 },
        { x: 0.62, y: 0.66, yaw: -0.04 },
        { x: 0.8, y: 0.36, yaw: 0.12 },
    ],
    5: [
        { x: 0.2, y: 0.62, yaw: -0.12 },
        { x: 0.36, y: 0.58, yaw: 0.06 },
        { x: 0.5, y: 0.38, yaw: -0.04 },
        { x: 0.66, y: 0.16, yaw: 0.12 },
        { x: 0.78, y: 0.3, yaw: -0.08 },
    ],
};
const WORLD_UP = new Vector3(0, 0, 1);
export class DiceBoxThreeEngine {
    private readonly box: InstanceType<typeof DiceBoxModule>;
    private readonly container: HTMLElement;
    private readonly styleProfile: DiceBoxStyleProfile;
    private dieSkins: Array<DiceBoxDieSkin | null> = [];
    private activePresetSkinId: string | null = null;
    private worldBounds: DiceBoxWorldBounds = { width: 0, height: 0 };

    private constructor(box: InstanceType<typeof DiceBoxModule>, container: HTMLElement, styleProfile: DiceBoxStyleProfile) {
        this.box = box;
        this.container = container;
        this.styleProfile = styleProfile;
    }

    static async create(container: HTMLElement, config?: DiceBoxEngineConfig): Promise<DiceBoxThreeEngine> {
        const DiceBox = await loadDiceBoxModule();
        const styleProfile = config?.styleProfile ?? DEFAULT_DICE_BOX_STYLE_PROFILE;
        if (!container.id) {
            nextContainerId += 1;
            container.id = `dice-box-threejs-${nextContainerId}`;
        }
        const box = new DiceBox(`#${container.id}`, {
            sounds: false,
            color_spotlight: styleProfile.colorSpotlight ?? DEFAULT_DICE_BOX_STYLE_PROFILE.colorSpotlight,
            shadows: styleProfile.shadows ?? DEFAULT_DICE_BOX_STYLE_PROFILE.shadows,
            theme_surface: styleProfile.surface ?? DEFAULT_DICE_BOX_STYLE_PROFILE.surface,
            sound_dieMaterial: styleProfile.soundMaterial ?? styleProfile.material ?? DEFAULT_DICE_BOX_STYLE_PROFILE.soundMaterial,
            theme_colorset: styleProfile.colorset ?? DEFAULT_DICE_BOX_STYLE_PROFILE.colorset,
            theme_material: styleProfile.material ?? DEFAULT_DICE_BOX_STYLE_PROFILE.material,
            theme_texture: styleProfile.texture ?? DEFAULT_DICE_BOX_STYLE_PROFILE.texture,
            theme_customColorset: config?.themeCustomColorset ?? styleProfile.customColorset ?? null,
            // `reroll()` 会直接给被选骰子一个固定的大竖直速度。
            // 这里如果把重力压到远低于库默认值，骰子会长时间漂出可视区，
            // 看起来就像“重投后没落回桌面”。
            gravity_multiplier: styleProfile.gravityMultiplier ?? DEFAULT_DICE_BOX_STYLE_PROFILE.gravityMultiplier,
            light_intensity: styleProfile.lightIntensity ?? DEFAULT_DICE_BOX_STYLE_PROFILE.lightIntensity,
            baseScale: styleProfile.baseScale ?? DEFAULT_DICE_BOX_STYLE_PROFILE.baseScale,
            strength: styleProfile.strength ?? DEFAULT_DICE_BOX_STYLE_PROFILE.strength,
            iterationLimit: styleProfile.iterationLimit ?? DEFAULT_DICE_BOX_STYLE_PROFILE.iterationLimit,
        });
        await box.initialize();
        const engine = new DiceBoxThreeEngine(box, container, styleProfile);
        engine.applyCameraProfile();
        box.renderer.setClearColor?.(0x000000, 0);
        box.renderer.setClearAlpha?.(0);
        box.renderer.domElement.style.width = '100%';
        box.renderer.domElement.style.height = '100%';
        box.renderer.domElement.style.display = 'block';
        box.renderer.domElement.style.pointerEvents = 'none';
        box.renderer.domElement.style.background = 'transparent';
        box.renderer.domElement.dataset.dicePhysicsSource = 'dice-box-threejs';
        if (config?.canvasTestId) {
            box.renderer.domElement.dataset.testid = config.canvasTestId;
        }
        if ((config?.rendererMode ?? 'debug-visible') === 'physics-only') {
            box.renderer.domElement.style.opacity = '0';
            box.renderer.domElement.style.visibility = 'hidden';
            box.renderer.domElement.setAttribute('aria-hidden', 'true');
        }
        return engine;
    }

    hasDice(count: number): boolean {
        return this.box.diceList.length === count && count > 0;
    }

    setCanvasDiagnostics({
        settled,
        skinsReady,
    }: {
        settled: boolean;
        skinsReady?: boolean;
    }): void {
        const canvas = this.box.renderer?.domElement;
        if (!canvas) return;

        canvas.dataset.diceSettled = settled ? 'true' : 'false';
        canvas.dataset.diceVisualSettled = settled ? 'true' : 'false';
        canvas.dataset.diceMaxLift = settled ? '0' : '1';
        canvas.dataset.diceMaxTravel = settled ? '0' : '1';
        if (typeof skinsReady === 'boolean') {
            canvas.dataset.skinsReady = skinsReady ? 'true' : 'false';
        }
    }

    clear(): void {
        this.box.clearDice();
    }

    destroy(): void {
        this.box.clearDice();
        this.disposeSceneResources();
        this.box.renderer?.dispose?.();
        this.box.renderer?.forceContextLoss?.();
        const canvas = this.box.renderer?.domElement;
        if (canvas?.parentElement === this.container) {
            this.container.removeChild(canvas);
        }
    }

    resize(): void {
        const worldWidthScale = this.styleProfile.worldWidthScale ?? 1;
        const worldHeightScale = this.styleProfile.worldHeightScale ?? 1;
        this.applyCameraProfile();
        const fitToCameraView = this.styleProfile.fitWorldToCameraView === true;
        const visibleHalfExtents = fitToCameraView
            ? this.getVisibleWorldHalfExtentsAtZ(this.styleProfile.baseScale ?? DEFAULT_DICE_BOX_STYLE_PROFILE.baseScale ?? 90)
            : null;
            const worldWidth = fitToCameraView && visibleHalfExtents
            ? visibleHalfExtents.x * 2 * worldWidthScale
            : this.container.clientWidth * worldWidthScale;
        const worldHeight = fitToCameraView && visibleHalfExtents
            ? visibleHalfExtents.y * 2 * worldHeightScale
            : this.container.clientHeight * worldHeightScale;
        this.worldBounds = { width: worldWidth, height: worldHeight };
        this.box.setDimensions({
            x: worldWidth,
            y: worldHeight,
        });

        const canvas = this.box.renderer?.domElement;
        if (canvas) {
            canvas.dataset.worldWidthScale = String(worldWidthScale);
            canvas.dataset.worldHeightScale = String(worldHeightScale);
            canvas.dataset.physicsWorldWidth = String(Math.round(worldWidth));
            canvas.dataset.physicsWorldHeight = String(Math.round(worldHeight));
            canvas.dataset.cameraZoom = String(this.styleProfile.cameraZoom ?? 1);
            canvas.dataset.fitWorldToCameraView = fitToCameraView ? 'true' : 'false';
            canvas.dataset.worldCenterOffsetX = String(this.styleProfile.worldCenterOffsetX ?? 0);
            canvas.dataset.worldCenterOffsetY = String(this.styleProfile.worldCenterOffsetY ?? 0);
        }
    }

    private applyCameraProfile(): void {
        const cameraZoom = this.styleProfile.cameraZoom ?? 1;
        const camera = this.box.camera as {
            zoom?: number;
            updateProjectionMatrix?: () => void;
        } | undefined;
        if (!camera || !Number.isFinite(cameraZoom) || cameraZoom <= 0) return;

        camera.zoom = cameraZoom;
        camera.updateProjectionMatrix?.();
        this.box.renderer?.render?.(this.box.scene, this.box.camera);
    }

    private getVisibleWorldHalfExtentsAtZ(worldZ: number): { x: number; y: number } {
        const camera = this.box.camera as {
            fov?: number;
            aspect?: number;
            zoom?: number;
            position?: { z?: number };
        } | undefined;
        const fov = camera?.fov ?? 20;
        const aspect = camera?.aspect ?? (
            this.container.clientHeight > 0
                ? this.container.clientWidth / this.container.clientHeight
                : 1
        );
        const zoom = Math.max(camera?.zoom ?? 1, 0.01);
        const cameraZ = camera?.position?.z ?? 0;
        const distance = Math.max(1, Math.abs(cameraZ - worldZ));
        const halfHeight = distance * Math.tan((fov * Math.PI) / 360) / zoom;
        return {
            x: halfHeight * aspect,
            y: halfHeight,
        };
    }

    private async withInitialThrowSpread<T>(run: () => Promise<T>): Promise<T> {
        const spread = this.styleProfile.initialThrowSpread;
        const runtime = this.box as DiceBoxInternalRuntime;
        const originalStartClickThrow = runtime.startClickThrow;
        if (!Number.isFinite(spread) || !spread || spread <= 0 || !originalStartClickThrow) {
            return await run();
        }

        runtime.startClickThrow = (notation: string) => {
            const notationVectors = originalStartClickThrow.call(runtime, notation);
            this.applyInitialThrowSpread(notationVectors, spread);
            return notationVectors;
        };

        try {
            return await run();
        } finally {
            runtime.startClickThrow = originalStartClickThrow;
        }
    }

    private applyInitialThrowSpread(
        notationVectors: DiceBoxInternalNotationVector | null,
        rawSpread: number,
    ): void {
        const vectors = notationVectors?.vectors;
        if (!vectors || vectors.length < 2) return;

        const spread = clampNumber(rawSpread, 0, 0.96);
        const centerOffsetX = this.styleProfile.worldCenterOffsetX ?? 0;
        const centerOffsetY = this.styleProfile.worldCenterOffsetY ?? 0;
        const firstVelocity = vectors.find((vector) => vector.velocity)?.velocity;
        if (!firstVelocity) return;

        const horizontalFlight = Math.abs(firstVelocity.x) >= Math.abs(firstVelocity.y);
        const laneDimension = horizontalFlight ? this.worldBounds.height : this.worldBounds.width;
        // dice-box 的墙体坐标约为 ±0.93 * dimension，不是 ±dimension / 2。
        // 使用完整维度分配通道，确保五颗骰子的首帧中心距大于骰体尺寸。
        const laneExtent = Math.max(1, laneDimension * spread);
        const baseScale = this.styleProfile.baseScale ?? DEFAULT_DICE_BOX_STYLE_PROFILE.baseScale ?? 90;
        const middle = (vectors.length - 1) / 2;

        vectors.forEach((vector, index) => {
            if (!vector.pos || !vector.velocity) return;

            const lane = middle === 0 ? 0 : (index - middle) / middle;
            const row = index % 2 === 0 ? -1 : 1;
            const forwardStagger = vectors.length > 1
                ? ((index - middle) / vectors.length) * baseScale * 0.92
                : 0;
            const speed = Math.hypot(vector.velocity.x, vector.velocity.y);
            const lateralVelocity = lane * speed * 0.24;
            const forwardVelocityNudge = row * speed * 0.055;

            if (horizontalFlight) {
                vector.pos.x += centerOffsetX + forwardStagger;
                vector.pos.y = centerOffsetY + (lane * laneExtent);
                vector.velocity.x += forwardVelocityNudge;
                vector.velocity.y = lateralVelocity;
            } else {
                vector.pos.x = centerOffsetX + (lane * laneExtent);
                vector.pos.y += centerOffsetY + forwardStagger;
                vector.velocity.x = lateralVelocity;
                vector.velocity.y += forwardVelocityNudge;
            }

            vector.pos.z += (index % 2) * baseScale * 0.5;
        });
    }

    private needsSettledSpreadAnimation(options: { excludedIndices?: number[] } = {}): boolean {
        const excludedIndices = new Set(options.excludedIndices ?? []);
        const layouts = this.box.diceList
            .map((_, index) => (excludedIndices.has(index) ? null : this.getProjectedLayout(index, index)))
            .filter((layout): layout is DiceBoxProjectedLayout => Boolean(layout));
        const activeDiceCount = this.box.diceList.length - excludedIndices.size;
        if (layouts.length !== activeDiceCount || layouts.length < 2) return false;
        const canvas = this.box.renderer?.domElement;
        const hasProjectedOutOfBounds = Boolean(canvas && layouts.some((layout) => {
            const halfWidth = (layout.visualWidth ?? layout.width) / 2;
            const halfHeight = (layout.visualHeight ?? layout.height) / 2;
            return layout.x - halfWidth < 4
                || layout.x + halfWidth > canvas.clientWidth - 4
                || layout.y - halfHeight < 4
                || layout.y + halfHeight > canvas.clientHeight - 4;
        }));
        if (hasProjectedOutOfBounds) return true;
        if (canvas) {
            const projectedTop = Math.min(...layouts.map((layout) => (
                layout.y - ((layout.visualHeight ?? layout.height) / 2)
            )));
            const projectedBottom = Math.max(...layouts.map((layout) => (
                layout.y + ((layout.visualHeight ?? layout.height) / 2)
            )));
            if (projectedBottom - projectedTop > canvas.clientHeight * 0.86) {
                return true;
            }
        }

        const minDimensions = layouts.map((layout) => Math.min(
            layout.visualWidth ?? layout.width,
            layout.visualHeight ?? layout.height,
        ));
        const averageMinDimension = minDimensions.reduce((sum, value) => sum + value, 0) / minDimensions.length;
        const centerXs = layouts.map((layout) => layout.x);
        const centerYs = layouts.map((layout) => layout.y);
        const horizontalCenterSpan = Math.max(...centerXs) - Math.min(...centerXs);
        const verticalCenterSpan = Math.max(...centerYs) - Math.min(...centerYs);
        const normalizedVerticalSpan = averageMinDimension > 0
            ? verticalCenterSpan / averageMinDimension
            : 0;
        const normalizedCenterSpan = averageMinDimension > 0
            ? Math.hypot(horizontalCenterSpan, verticalCenterSpan) / averageMinDimension
            : 0;
        let minNormalizedCenterDistance = Number.POSITIVE_INFINITY;
        let maxOverlapRatio = 0;

        for (let leftIndex = 0; leftIndex < layouts.length; leftIndex += 1) {
            const left = layouts[leftIndex];
            const leftWidth = left.visualWidth ?? left.width;
            const leftHeight = left.visualHeight ?? left.height;
            for (let rightIndex = leftIndex + 1; rightIndex < layouts.length; rightIndex += 1) {
                const right = layouts[rightIndex];
                const rightWidth = right.visualWidth ?? right.width;
                const rightHeight = right.visualHeight ?? right.height;
                const centerDistance = Math.hypot(left.x - right.x, left.y - right.y);
                const pairAverageMinDimension = (
                    Math.min(leftWidth, leftHeight)
                    + Math.min(rightWidth, rightHeight)
                ) / 2;
                minNormalizedCenterDistance = Math.min(
                    minNormalizedCenterDistance,
                    pairAverageMinDimension > 0 ? centerDistance / pairAverageMinDimension : 0,
                );

                const overlapWidth = Math.max(
                    0,
                    Math.min(left.x + (leftWidth / 2), right.x + (rightWidth / 2))
                    - Math.max(left.x - (leftWidth / 2), right.x - (rightWidth / 2)),
                );
                const overlapHeight = Math.max(
                    0,
                    Math.min(left.y + (leftHeight / 2), right.y + (rightHeight / 2))
                    - Math.max(left.y - (leftHeight / 2), right.y - (rightHeight / 2)),
                );
                const smallerArea = Math.min(leftWidth * leftHeight, rightWidth * rightHeight);
                maxOverlapRatio = Math.max(
                    maxOverlapRatio,
                    smallerArea > 0 ? (overlapWidth * overlapHeight) / smallerArea : 0,
                );
            }
        }

        return minNormalizedCenterDistance < 0.72
            || maxOverlapRatio > 0.5
            || normalizedVerticalSpan < 1.25
            || normalizedCenterSpan < 2.3;
    }

    async animateSettledSpreadIfNeeded(options: { excludedIndices?: number[] } = {}): Promise<void> {
        const durationMs = this.styleProfile.settledSpreadAnimationMs ?? 0;
        const diceCount = this.box.diceList.length;
        const excludedIndices = new Set(options.excludedIndices ?? []);
        if (durationMs <= 0 || diceCount < 2 || diceCount > 5 || !this.needsSettledSpreadAnimation({ excludedIndices: [...excludedIndices] })) {
            return;
        }

        const activeDiceCount = diceCount - excludedIndices.size;
        const slots = SETTLED_SPREAD_SLOTS_BY_COUNT[activeDiceCount] ?? [];
        const screenSlots = this.styleProfile.fitWorldToCameraView === true
            ? SETTLED_SCREEN_SLOTS_BY_COUNT[activeDiceCount] ?? []
            : [];
        const entries = this.box.diceList
            .map((die, index) => {
                if (excludedIndices.has(index)) return null;
                const dieWithBody = die as DiceBoxDieWithBody;
                const position = dieWithBody.body?.position ?? dieWithBody.position;
                return {
                    die: dieWithBody,
                    index,
                    start: { x: position.x, y: position.y, z: position.z },
                };
            })
            .filter((entry): entry is {
                die: DiceBoxDieWithBody;
                index: number;
                start: { x: number; y: number; z: number };
            } => Boolean(entry));
        const assignments = entries.map((entry, sortedIndex) => ({
            ...entry,
            yaw: screenSlots[sortedIndex]?.yaw,
            target: (() => {
                const slot = slots[sortedIndex];
                const screenSlot = screenSlots[sortedIndex];
                const baseScale = this.styleProfile.baseScale ?? DEFAULT_DICE_BOX_STYLE_PROFILE.baseScale ?? 90;
                if (screenSlot) {
                    const targetZ = baseScale * 0.78;
                    const target = this.getWorldPointAtScreenFraction(screenSlot.x, screenSlot.y, targetZ);
                    if (
                        Number.isFinite(target.x)
                        && Number.isFinite(target.y)
                        && Number.isFinite(target.z)
                        && Math.abs(target.x) < baseScale * 12
                        && Math.abs(target.y) < baseScale * 12
                    ) {
                        return target;
                    }
                }
                if (!slot) return entry.start;
                const visibleHalfExtents = this.getVisibleWorldHalfExtentsAtZ(entry.start.z);
                const centerOffsetX = this.styleProfile.worldCenterOffsetX ?? 0;
                const centerOffsetY = this.styleProfile.worldCenterOffsetY ?? 0;
                // dice-box 的物理墙在 ±display.containerWidth/Height * 0.93，
                // 这里不能再按一半宽高夹目标，否则移动端五颗骰子会被压成一团。
                const safeHalfWidth = Math.max(baseScale * 0.82, this.worldBounds.width * 0.78);
                const safeHalfHeight = Math.max(baseScale * 0.82, this.worldBounds.height * 0.68);
                return {
                    x: clampNumber(slot.x * visibleHalfExtents.x + centerOffsetX, centerOffsetX - safeHalfWidth, centerOffsetX + safeHalfWidth),
                    y: clampNumber(slot.y * visibleHalfExtents.y + centerOffsetY, centerOffsetY - safeHalfHeight, centerOffsetY + safeHalfHeight),
                    z: entry.start.z,
                };
            })(),
        }));
        const startAt = performance.now();

        await new Promise<void>((resolve) => {
            const step = (now: number) => {
                const progress = clampNumber((now - startAt) / durationMs, 0, 1);
                const eased = 1 - ((1 - progress) ** 3);

                assignments.forEach(({ die, start, target, yaw }) => {
                    const position = {
                        x: start.x + ((target.x - start.x) * eased),
                        y: start.y + ((target.y - start.y) * eased),
                        z: start.z + ((target.z - start.z) * eased),
                    };
                    this.setVector(die.position, position);
                    this.setVector(die.body?.position, position);
                    if (typeof yaw === 'number') {
                        const settledQuaternion = new Quaternion()
                            .setFromAxisAngle(WORLD_UP, yaw)
                            .normalize();
                        this.setQuaternion(die.quaternion as DiceBoxQuaternionLike | undefined, settledQuaternion);
                        this.setQuaternion(die.body?.quaternion, settledQuaternion);
                    }
                    this.setVector(die.body?.velocity, { x: 0, y: 0, z: 0 });
                    this.setVector(die.body?.angularVelocity, { x: 0, y: 0, z: 0 });
                    if (die.body) {
                        die.body.aabbNeedsUpdate = true;
                    }
                    die.updateMatrixWorld?.(true);
                });
                this.box.renderer.render(this.box.scene, this.box.camera);

                if (progress < 1) {
                    window.requestAnimationFrame(step);
                    return;
                }

                assignments.forEach(({ die }) => die.body?.sleep?.());
                resolve();
            };
            window.requestAnimationFrame(step);
        });
    }

    async rollToValues(values: number[]): Promise<void> {
        if (values.length === 0) {
            this.clear();
            return;
        }
        this.applyPrimarySkinToDicePreset();
        await this.withInitialThrowSpread(() => this.box.roll(createNotation(values)));
        this.applyValues(values, undefined, true);
        this.applyCurrentSkins();
        await this.animateSettledSpreadIfNeeded();
    }

    async restoreValues(values: number[]): Promise<void> {
        if (values.length === 0) {
            this.clear();
            return;
        }
        if (!this.hasDice(values.length)) {
            this.restoreDiceWithoutVisibleThrow(values);
            return;
        }
        this.syncValues(values);
    }

    async rerollToValues(indices: number[], values: number[], lockedIndices: number[] = []): Promise<void> {
        if (indices.length === 0) return;
        const lockedSnapshots = this.captureDieTransforms(lockedIndices);
        this.freezeDice(lockedSnapshots);
        try {
            await this.box.reroll(indices);
            this.restoreDieTransforms(lockedSnapshots, true);
            this.applyValues(values, indices, true);
            this.applyCurrentSkins();
            await this.animateSettledSpreadIfNeeded({ excludedIndices: lockedIndices });
        } finally {
            this.restoreDieTransforms(lockedSnapshots, false);
        }
    }

    async removeDice(indices: number[]): Promise<void> {
        if (indices.length === 0) return;
        await this.box.remove(indices);
    }

    syncValues(values: number[]): void {
        this.applyValues(values, undefined, true);
        this.applyCurrentSkins();
    }

    syncSettledValues(values: number[]): void {
        this.applyValues(values, undefined, true);
        this.applyCurrentSkins();
    }

    previewValues(values: number[], indices?: number[]): void {
        this.applyValues(values, indices, false);
    }

    settleDiceIntoSafeSpread(): boolean {
        if (this.styleProfile.fitWorldToCameraView !== true || this.box.diceList.length < 2) return false;

        const screenSlots = this.box.diceList.length === 5
            ? [
                { x: 0.18, y: 0.62, yaw: -0.1 },
                { x: 0.34, y: 0.20, yaw: 0.04 },
                { x: 0.56, y: 0.48, yaw: -0.02 },
                { x: 0.68, y: 0.20, yaw: 0.08 },
                { x: 0.38, y: 0.68, yaw: -0.06 },
            ]
            : null;
        if (!screenSlots) return false;

        const baseScale = this.styleProfile.baseScale ?? DEFAULT_DICE_BOX_STYLE_PROFILE.baseScale ?? 90;
        const sortedEntries = this.box.diceList
            .map((die, index) => {
                const dieWithBody = die as DiceBoxDieWithBody;
                const position = dieWithBody.body?.position ?? dieWithBody.position;
                return {
                    die: dieWithBody,
                    index,
                    position,
                };
            })
            .filter((entry): entry is {
                die: DiceBoxDieWithBody;
                index: number;
                position: DiceBoxVectorLike;
            } => Boolean(entry.position))
            .sort((left, right) => left.position.x - right.position.x || left.position.y - right.position.y);
        if (sortedEntries.length !== this.box.diceList.length) return false;

        sortedEntries.forEach((entry, sortedIndex) => {
            const slot = screenSlots[sortedIndex] ?? { x: 0.5, y: 0.5, yaw: 0 };
            const z = baseScale * 1.56;
            const target = this.getWorldPointAtScreenFraction(slot.x, slot.y, z);
            const settledQuaternion = new Quaternion()
                .setFromAxisAngle(WORLD_UP, slot.yaw)
                .normalize();
            this.setVector(entry.die.position, target);
            this.setVector(entry.die.body?.position, target);
            this.setVector(entry.die.body?.velocity, { x: 0, y: 0, z: 0 });
            this.setVector(entry.die.body?.angularVelocity, { x: 0, y: 0, z: 0 });
            this.setQuaternion(entry.die.quaternion as DiceBoxQuaternionLike | undefined, settledQuaternion);
            this.setQuaternion(entry.die.body?.quaternion, settledQuaternion);
            if (entry.die.body) {
                entry.die.body.aabbNeedsUpdate = true;
                entry.die.body.sleep?.();
            }
            entry.die.updateMatrixWorld?.(true);
        });

        this.box.renderer.render(this.box.scene, this.box.camera);
        return true;
    }

    private getWorldPointAtScreenFraction(xFraction: number, yFraction: number, worldZ: number): { x: number; y: number; z: number } {
        const camera = this.box.camera as {
            position?: Vector3;
        };
        const canvas = this.box.renderer?.domElement;
        if (!camera?.position || !canvas) {
            return { x: 0, y: 0, z: worldZ };
        }

        const ndcX = (clampNumber(xFraction, 0, 1) * 2) - 1;
        const ndcY = 1 - (clampNumber(yFraction, 0, 1) * 2);
        const point = new Vector3(ndcX, ndcY, 0.5).unproject(this.box.camera);
        const direction = point.sub(camera.position).normalize();
        const distanceToPlane = Math.abs(direction.z) > 0.0001
            ? (worldZ - camera.position.z) / direction.z
            : 0;
        const worldPoint = camera.position.clone().add(direction.multiplyScalar(distanceToPlane));
        return { x: worldPoint.x, y: worldPoint.y, z: worldZ };
    }

    recoverOutOfBoundsDice(options: { strictProjectedBounds?: boolean; enforceSafeBounds?: boolean } = {}): boolean {
        if (this.styleProfile.recoverOutOfBounds === false || this.box.diceList.length === 0) return false;

        const baseScale = this.styleProfile.baseScale ?? DEFAULT_DICE_BOX_STYLE_PROFILE.baseScale ?? 90;
        const useNearestBoundsRecovery = this.styleProfile.fitWorldToCameraView === true;
        const useStrictCameraBounds = useNearestBoundsRecovery && options.strictProjectedBounds === true;
        const halfWidth = useNearestBoundsRecovery
            ? Math.max(this.worldBounds.width / 2, baseScale * 0.95)
            : Math.max(this.worldBounds.width / 2, baseScale * 2.2);
        const halfHeight = useNearestBoundsRecovery
            ? Math.max(this.worldBounds.height / 2, baseScale * 0.95)
            : Math.max(this.worldBounds.height / 2, baseScale * 2.2);
        const maxX = useStrictCameraBounds
            ? Math.max(baseScale * 1.15, halfWidth + baseScale * 0.45)
            : Math.max(baseScale * 4.6, halfWidth + baseScale * 3.4);
        const maxY = useStrictCameraBounds
            ? Math.max(baseScale * 1.15, halfHeight + baseScale * 0.45)
            : Math.max(baseScale * 4.2, halfHeight + baseScale * 3.2);
        const maxZ = baseScale * 12;
        const minZ = -baseScale * 2.4;
        const centerOffsetX = this.styleProfile.worldCenterOffsetX ?? 0;
        const centerOffsetY = this.styleProfile.worldCenterOffsetY ?? 0;
        const safeHalfWidth = useNearestBoundsRecovery
            ? Math.max(baseScale * 0.78, halfWidth - (baseScale * 0.95))
            : 0;
        const safeHalfHeight = useNearestBoundsRecovery
            ? Math.max(baseScale * 0.78, halfHeight - (baseScale * 0.95))
            : 0;
        const enforceSafeBounds = useNearestBoundsRecovery
            && options.enforceSafeBounds === true;
        let didRecover = false;

        this.box.diceList.forEach((die, index) => {
            const dieWithBody = die as DiceBoxDieWithBody;
            const position = dieWithBody.body?.position ?? dieWithBody.position;
            if (!position) return;

            const layout = this.getProjectedLayout(index, index);
            const canvas = this.box.renderer?.domElement;
            const visualHalfWidth = (layout?.visualWidth ?? layout?.width ?? 0) / 2;
            const visualHalfHeight = (layout?.visualHeight ?? layout?.height ?? 0) / 2;
            const isFullyInsideProjectedStage = Boolean(layout && canvas
                && layout.x - visualHalfWidth >= -4
                && layout.x + visualHalfWidth <= canvas.clientWidth + 4
                && layout.y - visualHalfHeight >= -4
                && layout.y + visualHalfHeight <= canvas.clientHeight + 4);
            const isProjectedOutside = Boolean(layout && canvas && (
                options.strictProjectedBounds
                    ? layout.x - visualHalfWidth < -4
                        || layout.x + visualHalfWidth > canvas.clientWidth + 4
                        || layout.y - visualHalfHeight < -4
                        || layout.y + visualHalfHeight > canvas.clientHeight + 4
                    : layout.maxX < -canvas.clientWidth * 0.45
                        || layout.minX > canvas.clientWidth * 1.45
                        || layout.maxY < -canvas.clientHeight * 0.45
                        || layout.minY > canvas.clientHeight * 1.45
            ));
            const isOutsideSafeX = enforceSafeBounds
                && (position.x < centerOffsetX - safeHalfWidth || position.x > centerOffsetX + safeHalfWidth);
            const isOutsideSafeY = enforceSafeBounds
                && (position.y < centerOffsetY - safeHalfHeight || position.y > centerOffsetY + safeHalfHeight);
            const isOutsideSafeBounds = isOutsideSafeX || isOutsideSafeY;
            if (options.strictProjectedBounds && isFullyInsideProjectedStage && !isOutsideSafeBounds) {
                return;
            }
            const isOutOfBounds = isProjectedOutside
                || isOutsideSafeBounds
                || Math.abs(position.x) > maxX
                || Math.abs(position.y) > maxY
                || position.z > maxZ
                || position.z < minZ;
            if (!isOutOfBounds) return;

            const useCameraSafeSpread = (this.styleProfile.settledSpreadAnimationMs ?? 0) > 0;
            const target = useNearestBoundsRecovery
                ? (() => {
                    return {
                        x: clampNumber(position.x, centerOffsetX - safeHalfWidth, centerOffsetX + safeHalfWidth),
                        y: clampNumber(position.y, centerOffsetY - safeHalfHeight, centerOffsetY + safeHalfHeight),
                        z: position.z > maxZ || position.z < minZ
                            ? clampNumber(position.z, baseScale * 0.58, maxZ * 0.35)
                            : position.z,
                    };
                })()
                : useCameraSafeSpread
                ? (() => {
                    const slots = SETTLED_SPREAD_SLOTS_BY_COUNT[this.box.diceList.length] ?? [];
                    const slot = slots[index] ?? { x: 0, y: 0 };
                    const visibleHalfExtents = this.getVisibleWorldHalfExtentsAtZ(position.z);
                    return {
                        x: slot.x * visibleHalfExtents.x,
                        y: slot.y * visibleHalfExtents.y,
                        z: position.z,
                    };
                })()
                : (() => {
                    const settledLayout = this.styleProfile.settledLayout ?? SETTLED_DICE_LAYOUT;
                    const slot = settledLayout[index % settledLayout.length] ?? { x: 0, y: 0, yaw: 0 };
                    const settledLayoutScale = this.styleProfile.settledLayoutScale
                        ?? DEFAULT_DICE_BOX_STYLE_PROFILE.settledLayoutScale
                        ?? 1;
                    return {
                        x: clampNumber(slot.x * baseScale * 0.72 * settledLayoutScale, -maxX * 0.68, maxX * 0.68),
                        y: clampNumber(slot.y * baseScale * 0.62 * settledLayoutScale, -maxY * 0.68, maxY * 0.68),
                        z: Math.max(baseScale * 0.72, baseScale * 0.5),
                    };
                })();
            this.setVector(dieWithBody.position, target);
            this.setVector(dieWithBody.body?.position, target);
            if (useNearestBoundsRecovery && !options.strictProjectedBounds && isOutsideSafeBounds) {
                const velocity = dieWithBody.body?.velocity;
                const nextVelocity = {
                    x: velocity?.x ?? 0,
                    y: velocity?.y ?? 0,
                    z: velocity?.z ?? 0,
                };
                if (isOutsideSafeX && ((position.x < centerOffsetX - safeHalfWidth && nextVelocity.x < 0)
                    || (position.x > centerOffsetX + safeHalfWidth && nextVelocity.x > 0))) {
                    nextVelocity.x *= -0.58;
                }
                if (isOutsideSafeY && ((position.y < centerOffsetY - safeHalfHeight && nextVelocity.y < 0)
                    || (position.y > centerOffsetY + safeHalfHeight && nextVelocity.y > 0))) {
                    nextVelocity.y *= -0.58;
                }
                this.setVector(dieWithBody.body?.angularVelocity, {
                    x: dieWithBody.body?.angularVelocity?.x ?? 0,
                    y: dieWithBody.body?.angularVelocity?.y ?? 0,
                    z: dieWithBody.body?.angularVelocity?.z ?? 0,
                });
                this.setVector(dieWithBody.body?.velocity, nextVelocity);
            } else {
                this.setVector(dieWithBody.body?.velocity, { x: 0, y: 0, z: 0 });
                this.setVector(dieWithBody.body?.angularVelocity, { x: 0, y: 0, z: 0 });
            }
            if (options.strictProjectedBounds) {
                dieWithBody.body?.sleep?.();
            } else {
                dieWithBody.body?.wakeUp?.();
            }
            dieWithBody.updateMatrixWorld?.(true);
            didRecover = true;
        });

        if (didRecover) {
            this.box.renderer.render(this.box.scene, this.box.camera);
        }
        return didRecover;
    }

    separateOverlappingDice(options: { settleAfter?: boolean } = {}): boolean {
        if (this.styleProfile.fitWorldToCameraView !== true || this.box.diceList.length < 2) return false;

        const baseScale = this.styleProfile.baseScale ?? DEFAULT_DICE_BOX_STYLE_PROFILE.baseScale ?? 90;
        const minScreenDistance = Math.max(options.settleAfter ? 30 : 24, baseScale * (options.settleAfter ? 0.92 : 0.84));
        const maxWorldNudge = baseScale * (options.settleAfter ? 0.46 : 0.22);
        const passCount = options.settleAfter ? 6 : 1;
        let didSeparate = false;

        for (let pass = 0; pass < passCount; pass += 1) {
            const layouts = this.box.diceList
                .map((_, index) => this.getProjectedLayout(index, index))
                .filter((layout): layout is DiceBoxProjectedLayout => Boolean(layout));
            if (layouts.length !== this.box.diceList.length) return didSeparate;

            let didSeparateThisPass = false;
            for (let leftIndex = 0; leftIndex < layouts.length; leftIndex += 1) {
                for (let rightIndex = leftIndex + 1; rightIndex < layouts.length; rightIndex += 1) {
                    const left = layouts[leftIndex];
                    const right = layouts[rightIndex];
                    const dx = right.x - left.x;
                    const dy = right.y - left.y;
                    const distance = Math.hypot(dx, dy);
                    const leftMin = Math.min(left.visualWidth ?? left.width, left.visualHeight ?? left.height);
                    const rightMin = Math.min(right.visualWidth ?? right.width, right.visualHeight ?? right.height);
                    const targetDistance = Math.max(minScreenDistance, ((leftMin + rightMin) / 2) * 0.86);
                    if (distance >= targetDistance) continue;

                    const leftDie = this.box.diceList[leftIndex] as DiceBoxDieWithBody;
                    const rightDie = this.box.diceList[rightIndex] as DiceBoxDieWithBody;
                    const leftPosition = leftDie.body?.position ?? leftDie.position;
                    const rightPosition = rightDie.body?.position ?? rightDie.position;
                    if (!leftPosition || !rightPosition) continue;

                    const safeDistance = distance > 0.001 ? distance : 1;
                    const correctionRatio = clampNumber((targetDistance - distance) / targetDistance, 0.18, 1);
                    const pushScale = maxWorldNudge * correctionRatio;
                    const pushX = clampNumber((-dx / safeDistance) * pushScale, -maxWorldNudge, maxWorldNudge);
                    const pushY = clampNumber((dy / safeDistance) * pushScale, -maxWorldNudge, maxWorldNudge);
                    const leftTarget = {
                        x: leftPosition.x + pushX,
                        y: leftPosition.y + pushY,
                        z: leftPosition.z,
                    };
                    const rightTarget = {
                        x: rightPosition.x - pushX,
                        y: rightPosition.y - pushY,
                        z: rightPosition.z,
                    };

                    this.setVector(leftDie.position, leftTarget);
                    this.setVector(leftDie.body?.position, leftTarget);
                    this.setVector(rightDie.position, rightTarget);
                    this.setVector(rightDie.body?.position, rightTarget);
                    this.setVector(
                        leftDie.body?.velocity,
                        options.settleAfter ? { x: 0, y: 0, z: 0 } : { x: pushX * 0.18, y: pushY * 0.18, z: 0 },
                    );
                    this.setVector(
                        rightDie.body?.velocity,
                        options.settleAfter ? { x: 0, y: 0, z: 0 } : { x: -pushX * 0.18, y: -pushY * 0.18, z: 0 },
                    );
                    if (options.settleAfter) {
                        this.setVector(leftDie.body?.angularVelocity, { x: 0, y: 0, z: 0 });
                        this.setVector(rightDie.body?.angularVelocity, { x: 0, y: 0, z: 0 });
                    }
                    if (leftDie.body) leftDie.body.aabbNeedsUpdate = true;
                    if (rightDie.body) rightDie.body.aabbNeedsUpdate = true;
                    if (options.settleAfter) {
                        leftDie.body?.sleep?.();
                        rightDie.body?.sleep?.();
                    } else {
                        leftDie.body?.wakeUp?.();
                        rightDie.body?.wakeUp?.();
                    }
                    leftDie.updateMatrixWorld?.(true);
                    rightDie.updateMatrixWorld?.(true);
                    didSeparate = true;
                    didSeparateThisPass = true;
                }
            }
            if (!didSeparateThisPass) break;
        }

        if (didSeparate) {
            this.box.renderer.render(this.box.scene, this.box.camera);
        }
        return didSeparate;
    }

    freezeSettledDice(): void {
        let didFreeze = false;
        this.box.diceList.forEach((die) => {
            const dieWithBody = die as DiceBoxDieWithBody;
            if (!dieWithBody.body) return;
            this.setVector(dieWithBody.body.velocity, { x: 0, y: 0, z: 0 });
            this.setVector(dieWithBody.body.angularVelocity, { x: 0, y: 0, z: 0 });
            dieWithBody.body.aabbNeedsUpdate = true;
            dieWithBody.body.sleep?.();
            dieWithBody.updateMatrixWorld?.(true);
            didFreeze = true;
        });
        if (didFreeze) {
            this.box.renderer.render(this.box.scene, this.box.camera);
        }
    }

    ensureValues(values: number[]): void {
        if (values.length === 0) {
            this.clear();
            return;
        }
        const hasExistingDice = this.hasDice(values.length);
        if (!hasExistingDice) {
            void this.restoreValues(values);
            return;
        }
        this.syncValues(values);
    }

    setDieSkins(skins: Array<DiceBoxDieSkin | null>): void {
        this.dieSkins = skins;
        const didUpdatePreset = this.applyPrimarySkinToDicePreset();
        if (didUpdatePreset) {
            this.rebuildExistingDicePresetMaterials();
        }
        this.applyCurrentSkins();
    }

    getValues(): Array<number | null> {
        return this.box.diceList.map((die) => readDieValue(die));
    }

    getMotionSnapshot(index: number): DiceBoxMotionSnapshot | null {
        const die = this.box.diceList[index];
        if (!die) return null;
        return {
            x: die.position.x,
            y: die.position.y,
            z: die.position.z,
            rotateX: die.rotation.x,
            rotateY: die.rotation.y,
            rotateZ: die.rotation.z,
        };
    }

    getPhysicsState(index: number, id: number, settled: boolean): DicePhysicsState | null {
        const layout = this.getProjectedLayout(index, id);
        const motion = this.getMotionSnapshot(index);
        if (!layout || !motion) return null;
        return {
            id,
            layout,
            motion,
            settled,
            value: readDieValue(this.box.diceList[index]),
        };
    }

    getProjectedLayout(index: number, id: number): DiceBoxProjectedLayout | null {
        const die = this.box.diceList[index];
        const canvas = this.box.renderer?.domElement;
        const camera = this.box.camera;
        if (!die || !canvas || !camera) return null;

        die.updateMatrixWorld?.(true);
        const geometry = die.geometry;
        if (!geometry.boundingBox) {
            geometry.computeBoundingBox?.();
        }
        const bounds = geometry.boundingBox;
        if (!bounds) return null;

        const { min, max } = bounds;
        const corners = [
            [min.x, min.y, min.z],
            [min.x, min.y, max.z],
            [min.x, max.y, min.z],
            [min.x, max.y, max.z],
            [max.x, min.y, min.z],
            [max.x, min.y, max.z],
            [max.x, max.y, min.z],
            [max.x, max.y, max.z],
        ];

        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;

        for (const [x, y, z] of corners) {
            const point = min.clone();
            point.set(x, y, z);
            point.applyMatrix4(die.matrixWorld);
            const projected = point.project(camera) as { x: number; y: number; z: number };
            const screenX = ((projected.x + 1) / 2) * canvas.clientWidth;
            const screenY = ((1 - projected.y) / 2) * canvas.clientHeight;
            minX = Math.min(minX, screenX);
            maxX = Math.max(maxX, screenX);
            minY = Math.min(minY, screenY);
            maxY = Math.max(maxY, screenY);
        }

        if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
            return null;
        }

        const visualWidth = Math.max(1, maxX - minX);
        const visualHeight = Math.max(1, maxY - minY);
        const width = Math.max(40, visualWidth);
        const height = Math.max(40, visualHeight);
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const layoutYaw = SETTLED_DICE_LAYOUT[index]?.yaw;

        return {
            id,
            x: centerX,
            y: centerY,
            width,
            height,
            visualWidth,
            visualHeight,
            minX: centerX - halfWidth,
            maxX: centerX + halfWidth,
            minY: centerY - halfHeight,
            maxY: centerY + halfHeight,
            rotateX: die.rotation.x,
            rotateY: die.rotation.y,
            rotateZ: layoutYaw ?? die.rotation.z,
        };
    }

    private applyValues(values: number[], indices?: number[], commit = false): void {
        const targetIndices = indices ?? values.map((_, index) => index);
        let didChange = false;

        for (const index of targetIndices) {
            const die = this.box.diceList[index];
            const targetValue = values[index];
            if (!die || typeof targetValue !== 'number') continue;
            const currentValue = readDieValue(die);
            if (currentValue === targetValue) continue;
            this.box.swapDiceFace(die, targetValue);
            if (commit) {
                die.storeRolledValue('forced');
            }
            didChange = true;
        }

        if (didChange) {
            this.box.renderer.render(this.box.scene, this.box.camera);
        }
    }

    private captureDieTransforms(indices: number[]): Map<number, DiceBoxDieTransformSnapshot> {
        const snapshots = new Map<number, DiceBoxDieTransformSnapshot>();
        for (const index of indices) {
            const die = this.box.diceList[index] as DiceBoxDieWithBody | undefined;
            if (!die) continue;
            const quaternion = die.quaternion as DiceBoxQuaternionLike | undefined;
            snapshots.set(index, {
                position: {
                    x: die.position.x,
                    y: die.position.y,
                    z: die.position.z,
                },
                quaternion: {
                    x: quaternion?.x ?? 0,
                    y: quaternion?.y ?? 0,
                    z: quaternion?.z ?? 0,
                    w: quaternion?.w ?? 1,
                },
                bodyType: die.body?.type,
                bodyMass: die.body?.mass,
            });
        }
        return snapshots;
    }

    private freezeDice(snapshots: Map<number, DiceBoxDieTransformSnapshot>): void {
        snapshots.forEach((snapshot, index) => {
            const die = this.box.diceList[index] as DiceBoxDieWithBody | undefined;
            if (!die?.body) return;
            this.applyDieTransform(die, snapshot);
            die.body.type = 2;
            die.body.mass = 0;
            die.body.updateMassProperties?.();
            die.body.sleep?.();
        });
    }

    private restoreDieTransforms(snapshots: Map<number, DiceBoxDieTransformSnapshot>, keepFrozen: boolean): void {
        snapshots.forEach((snapshot, index) => {
            const die = this.box.diceList[index] as DiceBoxDieWithBody | undefined;
            if (!die) return;
            this.applyDieTransform(die, snapshot);
            if (die.body && !keepFrozen) {
                if (typeof snapshot.bodyType === 'number') {
                    die.body.type = snapshot.bodyType;
                }
                if (typeof snapshot.bodyMass === 'number') {
                    die.body.mass = snapshot.bodyMass;
                }
                die.body.updateMassProperties?.();
                die.body.wakeUp?.();
            }
        });
        if (snapshots.size > 0) {
            this.box.renderer.render(this.box.scene, this.box.camera);
        }
    }

    private applyDieTransform(die: DiceBoxDieWithBody, snapshot: DiceBoxDieTransformSnapshot): void {
        die.position.set?.(snapshot.position.x, snapshot.position.y, snapshot.position.z);
        die.position.x = snapshot.position.x;
        die.position.y = snapshot.position.y;
        die.position.z = snapshot.position.z;

        const dieQuaternion = die.quaternion as DiceBoxQuaternionLike | undefined;
        this.setQuaternion(dieQuaternion, snapshot.quaternion);

        if (die.body) {
            this.setVector(die.body.position, snapshot.position);
            this.setQuaternion(die.body.quaternion, snapshot.quaternion);
            this.setVector(die.body.velocity, { x: 0, y: 0, z: 0 });
            this.setVector(die.body.angularVelocity, { x: 0, y: 0, z: 0 });
        }
        die.updateMatrixWorld?.(true);
    }

    private setVector(vector: DiceBoxVectorLike | undefined, value: { x: number; y: number; z: number }): void {
        if (!vector) return;
        vector.set?.(value.x, value.y, value.z);
        vector.x = value.x;
        vector.y = value.y;
        vector.z = value.z;
    }

    private setQuaternion(
        quaternion: DiceBoxQuaternionLike | undefined,
        value: { x: number; y: number; z: number; w: number },
    ): void {
        if (!quaternion) return;
        quaternion.set?.(value.x, value.y, value.z, value.w);
        quaternion.x = value.x;
        quaternion.y = value.y;
        quaternion.z = value.z;
        quaternion.w = value.w;
    }

    private disposeSceneResources(): void {
        const scene = this.box.scene;
        if (!scene?.traverse) return;

        scene.traverse((object: unknown) => {
            const candidate = object as {
                geometry?: { dispose?: () => void };
                material?: unknown;
            };
            candidate.geometry?.dispose?.();

            const materials = Array.isArray(candidate.material)
                ? candidate.material
                : [candidate.material];
            for (const material of materials) {
                const disposable = material as {
                    dispose?: () => void;
                    map?: { dispose?: () => void };
                    normalMap?: { dispose?: () => void };
                    roughnessMap?: { dispose?: () => void };
                    metalnessMap?: { dispose?: () => void };
                    emissiveMap?: { dispose?: () => void };
                    bumpMap?: { dispose?: () => void };
                    alphaMap?: { dispose?: () => void };
                } | undefined;
                disposable?.map?.dispose?.();
                disposable?.normalMap?.dispose?.();
                disposable?.roughnessMap?.dispose?.();
                disposable?.metalnessMap?.dispose?.();
                disposable?.emissiveMap?.dispose?.();
                disposable?.bumpMap?.dispose?.();
                disposable?.alphaMap?.dispose?.();
                disposable?.dispose?.();
            }
        });
    }

    private restoreDiceWithoutVisibleThrow(values: number[]): void {
        const box = this.box as DiceBoxInternalRuntime;
        const notationVectors = box.startClickThrow?.(createNotation(values));
        const vectors = notationVectors?.vectors;
        if (!notationVectors || !Array.isArray(vectors) || vectors.length === 0 || !box.spawnDice || !box.simulateThrow) {
            void this.rollToValues(values);
            return;
        }

        this.applyPrimarySkinToDicePreset();
        box.notationVectors = notationVectors;
        this.clear();
        for (const vector of vectors) {
            box.spawnDice(vector);
        }
        box.simulateThrow();
        box.iteration = 0;
        box.steps = 0;
        vectors.forEach((vector, index) => {
            const die = this.box.diceList[index];
            if (die) {
                box.spawnDice?.(vector, die);
            }
        });
        this.applyValues(values, undefined, true);
        // 从 2D 切换到 3D 时只做一次无动画的静态散落，避免新建骰子重叠；
        // 真实投掷和重投不会经过这里，因此不会产生结束后二次瞬移。
        this.applyCurrentSkins({ arrange: true });
    }

    private applyPrimarySkinToDicePreset(): boolean {
        const primarySkin = this.dieSkins.find(Boolean);
        const faceLabels = primarySkin?.faceLabels;
        if (!primarySkin || this.activePresetSkinId === primarySkin.id) return false;

        const preset = this.box.DiceFactory?.get('d6');
        if (!preset) return false;

        if (faceLabels) {
            preset.labels = [
                '',
                '',
                faceLabels[1] ?? '',
                faceLabels[2] ?? '',
                faceLabels[3] ?? '',
                faceLabels[4] ?? '',
                faceLabels[5] ?? '',
                faceLabels[6] ?? '',
            ];
        }
        if (this.box.DiceFactory?.materials_cache) {
            this.box.DiceFactory.materials_cache = {};
        }
        this.activePresetSkinId = primarySkin.id;
        return true;
    }

    private rebuildExistingDicePresetMaterials(): void {
        const preset = this.box.DiceFactory?.get?.('d6');
        const createMaterials = this.box.DiceFactory?.createMaterials?.bind(this.box.DiceFactory);
        const baseScale = this.styleProfile.baseScale ?? DEFAULT_DICE_BOX_STYLE_PROFILE.baseScale ?? 90;
        if (!preset || !createMaterials || this.box.diceList.length === 0) return;

        this.box.diceList.forEach((die) => {
            if (die.notation?.type !== 'd6') return;
            const materials = createMaterials(preset, baseScale / 2, 1);
            if (!materials.length) return;
            die.material = materials;
            materials.forEach((material) => this.normalizeFaceMaterial(material));
        });
    }

    private applyCurrentSkins(options: { arrange?: boolean } = {}): void {
        let didChange = false;

        this.box.diceList.forEach((die, dieIndex) => {
            const skin = this.dieSkins[dieIndex] ?? this.dieSkins.find(Boolean);
            if (!skin) return;
            if (this.applySkinToDie(die, skin)) {
                didChange = true;
            }
        });

        if (options.arrange === true && this.arrangeSettledDice()) {
            didChange = true;
        }

        if (didChange) {
            this.box.renderer.render(this.box.scene, this.box.camera);
        }
    }

    private arrangeSettledDice(): boolean {
        if (this.box.diceList.length === 0) return false;

        const dice = this.box.diceList;
        const baseScale = this.styleProfile.baseScale ?? DEFAULT_DICE_BOX_STYLE_PROFILE.baseScale ?? 90;
        const settledLayoutScale = this.styleProfile.settledLayoutScale ?? DEFAULT_DICE_BOX_STYLE_PROFILE.settledLayoutScale ?? 1;
        const settledLayout = this.styleProfile.settledLayout ?? SETTLED_DICE_LAYOUT;
        const layoutScale = Math.max(baseScale, 82) * settledLayoutScale;
        const maxColumns = 5;
        const cappedDice = dice.slice(0, maxColumns);
        const columns = Math.min(cappedDice.length, maxColumns);
        const rows = Math.ceil(cappedDice.length / columns);
        const spacingX = layoutScale * 1.86;
        const spacingY = layoutScale * 1.68;
        const z = baseScale * 0.56;
        dice.forEach((die, index) => {
            const layout = settledLayout[index];
            const row = Math.floor(index / columns);
            const col = index % columns;
            const rowCount = row === rows - 1 ? cappedDice.length - row * columns : columns;
            const x = layout ? layout.x * spacingX : (col - (rowCount - 1) / 2) * spacingX;
            const y = layout ? layout.y * spacingY : (row - (rows - 1) / 2) * spacingY;
            die.position.set?.(x, y, z);
            die.position.x = x;
            die.position.y = y;
            die.position.z = z;
            die.body?.position?.set?.(x, y, z);
            if (die.body?.position) {
                die.body.position.x = x;
                die.body.position.y = y;
                die.body.position.z = z;
            }
            die.body?.velocity?.set?.(0, 0, 0);
            die.body?.angularVelocity?.set?.(0, 0, 0);
            const settledQuaternion = this.getSettledQuaternionForDie(die, layout);
            die.quaternion?.copy?.(settledQuaternion);
            die.body?.quaternion?.copy?.(settledQuaternion);
            if (!die.quaternion?.copy) {
                die.quaternion?.set?.(
                    settledQuaternion.x,
                    settledQuaternion.y,
                    settledQuaternion.z,
                    settledQuaternion.w,
                );
            }
            if (!die.body?.quaternion?.copy) {
                die.body?.quaternion?.set?.(
                    settledQuaternion.x,
                    settledQuaternion.y,
                    settledQuaternion.z,
                    settledQuaternion.w,
                );
            }
            if (die.body?.quaternion && die.quaternion?.copy) {
                die.quaternion.copy(die.body.quaternion);
            }
            die.updateMatrixWorld?.(true);
        });

        return true;
    }

    private getFaceValueForMaterialIndex(materialIndex: number): number | null {
        const preset = this.box.DiceFactory?.get?.('d6');
        const values = preset?.values ?? [1, 2, 3, 4, 5, 6];
        const valueIndex = materialIndex - 2;
        const value = values[valueIndex];
        return typeof value === 'number' ? value : null;
    }

    private getMaterialIndexForFaceValue(faceValue: number): number | null {
        const preset = this.box.DiceFactory?.get?.('d6');
        const values = preset?.values ?? [1, 2, 3, 4, 5, 6];
        const valueIndex = values.indexOf(faceValue);
        return valueIndex >= 0 ? valueIndex + 2 : null;
    }

    private getSettledQuaternionForDie(
        die: DiceBoxDie,
        layout?: { yaw: number },
    ): Quaternion {
        const targetValue = readDieValue(die);
        if (!targetValue) return new Quaternion();

        const yaw = layout?.yaw ?? 0;
        const faceNormal = this.getFaceNormalForValue(die, targetValue);
        const faceUp = faceNormal
            ? new Quaternion().setFromUnitVectors(faceNormal, WORLD_UP)
            : new Quaternion();
        const pose = new Quaternion().setFromAxisAngle(WORLD_UP, yaw);
        return new Quaternion()
            .multiplyQuaternions(pose, faceUp)
            .normalize();
    }

    private getFaceNormalForValue(die: DiceBoxDie, faceValue: number): Vector3 | null {
        const materialIndex = this.getMaterialIndexForFaceValue(faceValue);
        if (!materialIndex) return null;

        const groupIndex = die.geometry.groups?.findIndex((group) => group.materialIndex === materialIndex) ?? -1;
        if (groupIndex < 0) return null;

        return this.getGroupAverageNormal(die.geometry, groupIndex);
    }

    private getGroupAverageNormal(geometry: DiceBoxDie['geometry'], groupIndex: number): Vector3 | null {
        const group = geometry.groups?.[groupIndex];
        const normalArray = geometry.getAttribute?.('normal')?.array;
        if (!group || !normalArray) return null;

        const indexArray = geometry.index?.array;
        const vertexCount = Math.floor(normalArray.length / 3);
        const startVertex = typeof group.start === 'number'
            ? Math.max(0, Math.floor(group.start))
            : groupIndex * 3;
        const count = typeof group.count === 'number'
            ? Math.max(1, Math.floor(group.count))
            : 3;
        const normal = new Vector3(0, 0, 0);
        const addVertexNormal = (vertex: number) => {
            if (vertex < 0 || vertex >= vertexCount) return;
            const offset = vertex * 3;
            normal.add(new Vector3(
                Number(normalArray[offset] ?? 0),
                Number(normalArray[offset + 1] ?? 0),
                Number(normalArray[offset + 2] ?? 0),
            ));
        };

        if (indexArray) {
            const endIndex = Math.min(indexArray.length, startVertex + count);
            for (let indexOffset = startVertex; indexOffset < endIndex; indexOffset += 1) {
                addVertexNormal(Number(indexArray[indexOffset] ?? -1));
            }
        } else {
            const endVertex = Math.min(vertexCount, startVertex + count);
            for (let vertex = startVertex; vertex < endVertex; vertex += 1) {
                addVertexNormal(vertex);
            }
        }

        if (normal.lengthSq() === 0) return null;
        return normal.normalize();
    }

    private applySkinToDie(die: DiceBoxDie, skin: DiceBoxDieSkin): boolean {
        let materials = Array.isArray(die.material) ? die.material : [die.material];
        let didChange = false;

        if (skin.preferPresetMaterials) {
            for (const material of materials) {
                this.normalizeFaceMaterial(material);
            }
            return false;
        }

        this.ensureIndependentMaterials(die);
        materials = Array.isArray(die.material) ? die.material : [die.material];

        const edgeCanvas = skin.edgeCanvas;
        const faceMaterialIndexes = materials
            .map((_, materialIndex) => materialIndex)
            .filter((materialIndex) => materialIndex > 1);
        for (const materialIndex of faceMaterialIndexes) {
            const material = materials[materialIndex];
            const faceValue = this.getFaceValueForMaterialIndex(materialIndex);
            const canvas = skin.faceCanvases[faceValue] ?? edgeCanvas;
            if (!material || !canvas) continue;

            if (this.updateExistingMaterialMap(material, canvas)) {
                didChange = true;
            }
        }

        if (edgeCanvas) {
            for (const [materialIndex, material] of materials.entries()) {
                if (materialIndex > 1) continue;
                if (this.updateExistingMaterialMap(material, edgeCanvas)) {
                    didChange = true;
                }
            }
        }

        for (const material of materials) {
            this.normalizeFaceMaterial(material);
        }
        return didChange;
    }

    private ensureIndependentMaterials(die: DiceBoxDie): void {
        const materials = Array.isArray(die.material) ? die.material : [die.material];
        die.material = materials.map((material) => {
            const clone = material.clone?.() ?? material;
            if (material.map?.clone) {
                clone.map = material.map.clone();
            }
            return clone;
        });
    }

    private updateExistingMaterialMap(material: DiceBoxMaterialInstance | undefined, canvas: HTMLCanvasElement): boolean {
        if (!material) return false;
        if (!material.map) return false;
        material.map.image = canvas;
        material.map.flipY = false;
        material.map.generateMipmaps = true;
        material.map.minFilter = LinearMipmapLinearFilter;
        material.map.magFilter = LinearFilter;
        material.map.colorSpace = SRGBColorSpace;
        material.map.needsUpdate = true;
        this.normalizeFaceMaterial(material);
        return true;
    }

    private normalizeFaceMaterial(material?: DiceBoxMaterialInstance): void {
        if (!material) return;
        material.color?.set?.(0xffffff);
        material.emissive?.set?.(0x000000);
        material.emissiveIntensity = 0;
        material.roughness = 0.52;
        material.metalness = 0.04;
        material.envMapIntensity = 0.35;
        material.bumpMap = null;
        material.opacity = 1;
        material.transparent = true;
        material.alphaTest = 0;
        material.depthTest = false;
        material.depthWrite = false;
        material.needsUpdate = true;
    }

}
