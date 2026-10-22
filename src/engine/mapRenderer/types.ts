export interface MapViewportState {
    zoom: number;
    panX: number;
    panY: number;
}

export interface MapScenePoint {
    x: number;
    y: number;
}

export interface MapSceneRegion {
    id: string;
    polygon: readonly MapScenePoint[];
}

export interface MapSceneToken {
    id: string;
    x: number;
    y: number;
    size: number;
    regionId?: string;
    textureUrl?: string;
    label?: string;
}

/** A visible map object; geometry is supplied by the game's read model, never DOM measurements. */
export interface MapSceneSprite {
    id: string;
    textureUrls: readonly string[];
    x: number;
    y: number;
    width: number;
    height: number;
    /** Atlas rectangle in normalized source coordinates, so compressed atlases keep their crop. */
    frame?: { x: number; y: number; width: number; height: number };
    rotation?: number;
    alpha?: number;
    /** Normalized silhouette and optional printed-token backing. */
    clipPolygon?: readonly MapScenePoint[];
    border?: { color: number; width: number };
    imageFit?: "contain" | "cover";
    imageScale?: number;
    motion?: {
        id: string;
        from: MapScenePoint;
        kind: 'hop' | 'fade' | 'reveal';
        durationMs: number;
        landingDurationMs?: number;
        arcHeight?: number;
        startScale?: number;
    };
}

/** Rendered motion progress; consumers must not write authoritative game state. */
export type MapSceneSpriteMotionFrameCallback = (spriteId: string, motionId: string, progress: number) => void;

export type MapSceneSpriteMotionPhase = 'landing' | 'settled';

export type MapSceneSpriteMotionPhaseCallback = (
    spriteId: string,
    motionId: string,
    phase: MapSceneSpriteMotionPhase,
) => void;

export type MapInteractionIntent =
    | { type: 'select-region'; regionId: string }
    | { type: 'hover-region'; regionId: string | null }
    | { type: 'select-token'; tokenId: string; regionId?: string };

export type MapSceneResourceStatus =
    | { status: 'loading'; resourceUrl: string }
    | { status: 'ready'; resourceUrl: string }
    | { status: 'error'; resourceUrl: string; error: unknown };

export type MapSceneRegionHitTest = (point: MapScenePoint) => string | null;
