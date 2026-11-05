declare module '@3d-dice/dice-box-threejs' {
    export interface DiceBoxConfig {
        framerate?: number;
        assetPath?: string;
        sounds?: boolean;
        volume?: number;
        color_spotlight?: number;
        shadows?: boolean;
        theme_surface?: string;
        sound_dieMaterial?: string;
        theme_colorset?: string;
        theme_texture?: string;
        theme_material?: 'none' | 'metal' | 'wood' | 'glass' | 'plastic' | string;
        theme_customColorset?: {
            name: string;
            foreground?: string;
            background?: string | string[];
            edge?: string | string[];
            outline?: string;
            texture?: string;
            material?: string;
        } | null;
        gravity_multiplier?: number;
        light_intensity?: number;
        baseScale?: number;
        strength?: number;
        iterationLimit?: number;
        onRollComplete?: (results: unknown) => void;
        onRerollComplete?: (results: unknown) => void;
    }

    type DiceValueRecord = {
        value?: number;
        reason?: string;
    };

    export interface DiceBoxMaterialInstance {
        map?: {
            image?: CanvasImageSource & {
                width?: number;
                height?: number;
                naturalWidth?: number;
                naturalHeight?: number;
            };
            needsUpdate?: boolean;
            flipY?: boolean;
            generateMipmaps?: boolean;
            colorSpace?: string;
            minFilter?: unknown;
            magFilter?: unknown;
            clone?: () => NonNullable<DiceBoxMaterialInstance['map']>;
            dispose?: () => void;
        } | null;
        bumpMap?: { dispose?: () => void } | null;
        normalMap?: { dispose?: () => void } | null;
        roughnessMap?: { dispose?: () => void } | null;
        metalnessMap?: { dispose?: () => void } | null;
        emissiveMap?: { dispose?: () => void } | null;
        alphaMap?: { dispose?: () => void } | null;
        color?: { set: (value: number | string) => void };
        emissive?: { set: (value: number | string) => void };
        emissiveIntensity?: number;
        roughness?: number;
        metalness?: number;
        envMapIntensity?: number;
        opacity?: number;
        transparent?: boolean;
        alphaTest?: number;
        depthTest?: boolean;
        depthWrite?: boolean;
        visible?: boolean;
        needsUpdate?: boolean;
        clone?: () => DiceBoxMaterialInstance;
        dispose?: () => void;
    }

    export interface DiceBoxPreset {
        labels: Array<string | HTMLImageElement | HTMLCanvasElement>;
        values?: number[];
    }

    export interface DiceBoxFactory {
        baseScale?: number;
        materials_cache?: Record<string, unknown>;
        get(type: string): DiceBoxPreset | undefined;
        createMaterials?: (preset: DiceBoxPreset, baseScale: number, margin: number) => DiceBoxMaterialInstance[];
    }

    export interface DiceBoxDie {
        id?: number;
        shape: string;
        notation: { type: string };
        geometry: import('three').BufferGeometry;
        material:
            | DiceBoxMaterialInstance
            | (DiceBoxMaterialInstance & import('three').Material)
            | DiceBoxMaterialInstance[]
            | (DiceBoxMaterialInstance & import('three').Material)[];
        matrixWorld: import('three').Matrix4;
        position: import('three').Vector3;
        rotation: import('three').Euler;
        quaternion: import('three').Quaternion;
        scale: import('three').Vector3;
        result: DiceValueRecord[];
        body?: {
            velocity?: {
                x?: number;
                y?: number;
                z?: number;
                set?: (x: number, y: number, z: number) => void;
            };
            angularVelocity?: {
                x?: number;
                y?: number;
                z?: number;
                set?: (x: number, y: number, z: number) => void;
            };
            position?: {
                x?: number;
                y?: number;
                z?: number;
                set?: (x: number, y: number, z: number) => void;
            };
            quaternion?: {
                x?: number;
                y?: number;
                z?: number;
                w?: number;
                set?: (x: number, y: number, z: number, w: number) => unknown;
                copy?: (value: { x?: number; y?: number; z?: number; w?: number }) => unknown;
            };
            wakeUp?: () => void;
        };
        getLastValue: () => DiceValueRecord;
        storeRolledValue: (reason?: string) => void;
        updateMatrixWorld: (force?: boolean) => void;
        clone: (recursive?: boolean) => DiceBoxDie;
    }

    export interface DiceBoxSceneLike {
        children?: Array<{
            type?: string;
            name?: string;
            isMesh?: boolean;
            geometry?: {
                boundingBox?: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
                computeBoundingBox?: () => void;
            };
            position?: { x?: number; y?: number; z?: number };
            scale?: { x?: number; y?: number; z?: number };
            visible?: boolean;
            material?: unknown;
        }>;
        traverse?: (visitor: (object: unknown) => void) => void;
        updateMatrixWorld?: (force?: boolean) => void;
    }

    export type DiceBoxCameraLike = import('three').PerspectiveCamera;

    export interface DiceBoxRendererLike {
        domElement: HTMLCanvasElement;
        render: (scene: unknown, camera: unknown) => void;
        setClearColor?: (color: number | string, alpha?: number) => void;
        setClearAlpha?: (alpha: number) => void;
        clear?: () => void;
        getClearAlpha?: () => number;
        getContext?: () => WebGLRenderingContext | WebGL2RenderingContext | null;
        getContextAttributes?: () => WebGLContextAttributes | null;
        getRenderTarget?: () => unknown;
        info?: unknown;
        outputColorSpace?: unknown;
        physicallyCorrectLights?: boolean;
        toneMapping?: unknown;
        dispose?: () => void;
        forceContextLoss?: () => void;
    }

    export default class DiceBox {
        constructor(selector: string, config?: DiceBoxConfig);
        initialized: boolean;
        rolling: boolean;
        diceList: DiceBoxDie[];
        camera: DiceBoxCameraLike;
        scene: DiceBoxSceneLike;
        renderer: DiceBoxRendererLike;
        DiceFactory?: DiceBoxFactory;
        initialize(): Promise<void>;
        roll(notation: string): Promise<unknown>;
        reroll(indices: number[]): Promise<unknown>;
        remove(indices: number[]): Promise<unknown>;
        clearDice(): void;
        setDimensions(dimensions?: { x: number; y: number }): void;
        updateConfig(config?: DiceBoxConfig): Promise<void>;
        swapDiceFace(die: DiceBoxDie, value: number): void;
    }
}

declare module '@3d-dice/dice-box-threejs/node_modules/three/build/three.module.js' {
    export type ColorRepresentation = number | string;

    export const BackSide: number;
    export const LinearFilter: number;
    export const LinearMipmapLinearFilter: number;
    export const SRGBColorSpace: string;

    export class Color {
        constructor(value?: ColorRepresentation);
        set(value: ColorRepresentation): this;
    }

    export class Vector3 {
        constructor(x?: number, y?: number, z?: number);
        x: number;
        y: number;
        z: number;
        add(value: Vector3): this;
        sub(value: Vector3): this;
        lengthSq(): number;
        normalize(): this;
        project(camera: unknown): this;
        unproject(camera: unknown): this;
    }

    export class ShaderMaterial {
        constructor(parameters?: {
            name?: string;
            uniforms?: Record<string, { value: unknown }>;
            vertexShader?: string;
            fragmentShader?: string;
            side?: number;
            transparent?: boolean;
            depthTest?: boolean;
            depthWrite?: boolean;
            toneMapped?: boolean;
        });
        name: string;
        type: string;
        uniforms: Record<string, { value: unknown }>;
        opacity: number;
        transparent: boolean;
        side: number;
        depthTest: boolean;
        depthWrite: boolean;
        toneMapped: boolean;
        needsUpdate: boolean;
        dispose(): void;
    }
}
