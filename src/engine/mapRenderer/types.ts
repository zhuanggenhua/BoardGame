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

export type MapInteractionIntent =
    | { type: 'select-region'; regionId: string }
    | { type: 'hover-region'; regionId: string | null }
    | { type: 'select-token'; tokenId: string; regionId?: string };

export type MapSceneResourceStatus =
    | { status: 'loading'; resourceUrl: string }
    | { status: 'ready'; resourceUrl: string }
    | { status: 'error'; resourceUrl: string; error: unknown };

export type MapSceneRegionHitTest = (point: MapScenePoint) => string | null;
