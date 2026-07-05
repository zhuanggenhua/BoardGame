import type DiceBoxModule from '@3d-dice/dice-box-threejs';
import { CanvasTexture, SRGBColorSpace } from 'three';
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
    strength?: number;
    iterationLimit?: number;
    arrangeSettledDice?: boolean;
}

export interface DiceBoxDieSkin {
    id: string;
    faceCanvases: Record<number, HTMLCanvasElement>;
    edgeCanvas?: HTMLCanvasElement;
    faceImages?: Record<number, HTMLImageElement>;
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

export class DiceBoxThreeEngine {
    private readonly box: InstanceType<typeof DiceBoxModule>;
    private readonly container: HTMLElement;
    private readonly styleProfile: DiceBoxStyleProfile;
    private dieSkins: Array<DiceBoxDieSkin | null> = [];
    private activePresetSkinId: string | null = null;

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
        box.renderer.domElement.style.width = '100%';
        box.renderer.domElement.style.height = '100%';
        box.renderer.domElement.style.display = 'block';
        box.renderer.domElement.style.pointerEvents = 'none';
        box.renderer.domElement.dataset.dicePhysicsSource = 'dice-box-threejs';
        if (config?.canvasTestId) {
            box.renderer.domElement.dataset.testid = config.canvasTestId;
        }
        if ((config?.rendererMode ?? 'debug-visible') === 'physics-only') {
            box.renderer.domElement.style.opacity = '0';
            box.renderer.domElement.style.visibility = 'hidden';
            box.renderer.domElement.setAttribute('aria-hidden', 'true');
        }
        return new DiceBoxThreeEngine(box, container, styleProfile);
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
        const canvas = this.box.renderer?.domElement;
        if (canvas?.parentElement === this.container) {
            this.container.removeChild(canvas);
        }
    }

    resize(): void {
        this.box.setDimensions({
            x: this.container.clientWidth,
            y: this.container.clientHeight,
        });
    }

    async rollToValues(values: number[]): Promise<void> {
        if (values.length === 0) {
            this.clear();
            return;
        }
        this.applyPrimarySkinToDicePreset();
        await this.box.roll(createNotation(values));
        this.applyCurrentSkins();
    }

    async rerollToValues(indices: number[], values: number[]): Promise<void> {
        if (indices.length === 0) return;
        await this.box.reroll(indices);
        this.applyValues(values, indices, true);
        this.applyCurrentSkins();
    }

    async removeDice(indices: number[]): Promise<void> {
        if (indices.length === 0) return;
        await this.box.remove(indices);
    }

    syncValues(values: number[]): void {
        this.applyValues(values, undefined, true);
    }

    previewValues(values: number[], indices?: number[]): void {
        this.applyValues(values, indices, false);
    }

    setDieSkins(skins: Array<DiceBoxDieSkin | null>): void {
        this.dieSkins = skins;
        this.applyPrimarySkinToDicePreset();
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

        const width = Math.max(40, maxX - minX);
        const height = Math.max(40, maxY - minY);

        return {
            id,
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2,
            width,
            height,
            minX,
            maxX,
            minY,
            maxY,
            rotateX: die.rotation.x,
            rotateY: die.rotation.y,
            rotateZ: die.rotation.z,
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

    private applyPrimarySkinToDicePreset(): void {
        const primarySkin = this.dieSkins.find(Boolean);
        const faceImages = primarySkin?.faceImages;
        const faceLabels = primarySkin?.faceLabels;
        if (!primarySkin || (!faceImages && !faceLabels) || this.activePresetSkinId === primarySkin.id) return;

        const preset = this.box.DiceFactory?.get('d6');
        if (!preset) return;

        preset.labels = faceLabels
            ? [
                '',
                '',
                faceLabels[1] ?? '',
                faceLabels[2] ?? '',
                faceLabels[3] ?? '',
                faceLabels[4] ?? '',
                faceLabels[5] ?? '',
                faceLabels[6] ?? '',
            ]
            : [
                '',
                '',
                faceImages![1],
                faceImages![2],
                faceImages![3],
                faceImages![4],
                faceImages![5],
                faceImages![6],
            ];
        if (this.box.DiceFactory?.materials_cache) {
            this.box.DiceFactory.materials_cache = {};
        }
        this.activePresetSkinId = primarySkin.id;
    }

    private applyCurrentSkins(): void {
        let didChange = false;

        this.box.diceList.forEach((die, dieIndex) => {
            const skin = this.dieSkins[dieIndex] ?? this.dieSkins.find(Boolean);
            if (!skin) return;
            if (this.applySkinToDie(die, skin)) {
                didChange = true;
            }
        });

        if (this.arrangeSettledDice()) {
            didChange = true;
        }

        if (didChange) {
            this.box.renderer.render(this.box.scene, this.box.camera);
        }
    }

    private arrangeSettledDice(): boolean {
        if (!this.styleProfile.arrangeSettledDice || this.box.diceList.length === 0) return false;

        const dice = this.box.diceList;
        const baseScale = this.styleProfile.baseScale ?? DEFAULT_DICE_BOX_STYLE_PROFILE.baseScale ?? 90;
        const maxColumns = 5;
        const columns = Math.min(dice.length, maxColumns);
        const rows = Math.ceil(dice.length / columns);
        const spacingX = baseScale * 1.38;
        const spacingY = baseScale * 1.08;
        const z = baseScale * 0.56;

        dice.forEach((die, index) => {
            const row = Math.floor(index / columns);
            const col = index % columns;
            const rowCount = row === rows - 1 ? dice.length - row * columns : columns;
            const x = (col - (rowCount - 1) / 2) * spacingX;
            const y = (row - (rows - 1) / 2) * spacingY;

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
            die.rotation.z = 0;
            die.updateMatrixWorld?.(true);
        });

        return true;
    }

    private applySkinToDie(die: DiceBoxDie, skin: DiceBoxDieSkin): boolean {
        const materials = Array.isArray(die.material) ? die.material : [die.material];
        let didChange = false;

        const shouldUsePresetMaterials = Boolean(skin.preferPresetMaterials && (skin.faceImages || skin.faceLabels));
        if (shouldUsePresetMaterials && this.rebuildDiePresetMaterials(die)) {
            return true;
        }

        const usedMaterialIndexes = new Set<number>();
        for (const group of die.geometry.groups ?? []) {
            if (group.materialIndex >= 0) {
                usedMaterialIndexes.add(group.materialIndex);
            }
        }

        const edgeCanvas = skin.edgeCanvas;
        if (edgeCanvas) {
            for (const [materialIndex, material] of materials.entries()) {
                if (materialIndex >= 2 && usedMaterialIndexes.has(materialIndex)) continue;
                if (this.applyCanvasToMaterial(material, edgeCanvas)) {
                    didChange = true;
                }
            }
        }

        const visibleMaterialIndexes = usedMaterialIndexes.size > 0
            ? [...usedMaterialIndexes].filter((materialIndex) => materialIndex > 0)
            : materials.map((_, materialIndex) => materialIndex).filter((materialIndex) => materialIndex >= 2);

        if (!shouldUsePresetMaterials) {
            for (const materialIndex of visibleMaterialIndexes) {
                const material = materials[materialIndex];
                const faceValue = materialIndex - 1;
                const canvas = skin.faceCanvases[faceValue] ?? edgeCanvas;
                if (!material || !canvas) continue;

                if (this.applyCanvasToMaterial(material, canvas)) {
                    didChange = true;
                }
            }
        }

        for (const material of materials) {
            this.normalizeFaceMaterial(material);
        }
        return didChange;
    }

    private rebuildDiePresetMaterials(die: DiceBoxDie): boolean {
        const preset = this.box.DiceFactory?.get?.(die.notation?.type ?? 'd6');
        const createMaterials = this.box.DiceFactory?.createMaterials;
        if (!preset || !createMaterials) return false;

        const baseScale = typeof this.box.DiceFactory.baseScale === 'number'
            ? this.box.DiceFactory.baseScale
            : DEFAULT_DICE_BOX_STYLE_PROFILE.baseScale ?? 90;
        die.material = createMaterials.call(this.box.DiceFactory, preset, baseScale / 2, 1);
        const rebuiltMaterials = Array.isArray(die.material) ? die.material : [die.material];
        for (const material of rebuiltMaterials) {
            this.preservePresetFaceMaterial(material);
        }
        return true;
    }

    private applyCanvasToMaterial(material: DiceBoxMaterialInstance | undefined, canvas: HTMLCanvasElement): boolean {
        if (!material) return false;
        material.map ??= new CanvasTexture(canvas);
        material.map.image = canvas;
        material.map.flipY = false;
        material.map.generateMipmaps = false;
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
        material.transparent = false;
        material.alphaTest = 0;
        material.depthTest = true;
        material.depthWrite = true;
        material.needsUpdate = true;
    }

    private preservePresetFaceMaterial(material?: DiceBoxMaterialInstance): void {
        if (!material) return;
        material.color?.set?.(0xffffff);
        material.emissive?.set?.(0x000000);
        material.emissiveIntensity = 0;
        material.opacity = 1;
        material.transparent = true;
        material.alphaTest = 0;
        material.depthTest = true;
        material.depthWrite = true;
        material.needsUpdate = true;
        if (material.map) {
            material.map.flipY = false;
            material.map.generateMipmaps = false;
            material.map.colorSpace = SRGBColorSpace;
            material.map.needsUpdate = true;
        }
    }
}
