import type { ReactNode } from 'react';
import type { LayoutTransform, ResolvedLayoutRect } from '../../utils/layout';

export interface UISceneRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface UISceneArtboardRegion extends UISceneRect {
    label?: string;
}

export interface UISceneArtboardDefinition {
    id: string;
    baseWidth: number;
    baseHeight: number;
    backgroundImage?: string;
    safeZones?: Record<string, UISceneArtboardRegion>;
    slots?: Record<string, UISceneArtboardRegion>;
    hitAreas?: Record<string, UISceneArtboardRegion>;
    guides?: Record<string, UISceneArtboardRegion>;
}

export interface UIScenePresentationDefinition {
    scaleMultiplier?: number;
    offsetXPct?: number;
    offsetYPct?: number;
}

export type UISceneState = string;
export type UISceneNodeProps = Record<string, unknown>;

export interface UISceneNodeDefinition<TProps extends UISceneNodeProps = UISceneNodeProps> {
    id: string;
    prefabId: string;
    props: TProps;
    transform?: LayoutTransform;
    regionId?: string;
    clipRegionId?: string;
    zIndex?: number;
    visibleInStates?: UISceneState[];
    testId?: string;
}

export interface UISceneDefinition {
    id: string;
    artboard: UISceneArtboardDefinition;
    presentation?: UIScenePresentationDefinition;
    nodes: UISceneNodeDefinition[];
}

export interface UISceneNodeEvent {
    sceneId: string;
    nodeId: string;
    prefabId: string;
    eventId: string;
    payload?: unknown;
}

export interface UIScenePrefabRenderContext<TProps extends UISceneNodeProps = UISceneNodeProps> {
    scene: UISceneDefinition;
    artboard: UISceneArtboardDefinition;
    node: UISceneNodeDefinition<TProps>;
    rect: ResolvedLayoutRect | null;
    regionRect: UISceneRect | null;
    clipRect: UISceneRect | null;
    activeState?: UISceneState;
    sceneContext?: Record<string, unknown>;
    emit: (eventId: string, payload?: unknown) => void;
}

export interface UIScenePrefabDefinition<TProps extends UISceneNodeProps = UISceneNodeProps> {
    prefabId: string;
    version: string;
    displayName: string;
    render: (context: UIScenePrefabRenderContext<TProps>) => ReactNode;
}

export function resolveArtboardRegion(
    artboard: UISceneArtboardDefinition,
    regionId?: string,
): UISceneArtboardRegion | null {
    if (!regionId) {
        return null;
    }

    return artboard.slots?.[regionId]
        ?? artboard.hitAreas?.[regionId]
        ?? artboard.safeZones?.[regionId]
        ?? artboard.guides?.[regionId]
        ?? null;
}

export function scaleArtboardRect(rect: UISceneRect, scale: number): UISceneRect {
    return {
        x: rect.x * scale,
        y: rect.y * scale,
        width: rect.width * scale,
        height: rect.height * scale,
    };
}

export function scaleLayoutTransform(transform: LayoutTransform, scale: number): LayoutTransform {
    return {
        ...transform,
        offset: {
            x: transform.offset.x * scale,
            y: transform.offset.y * scale,
        },
        width: transform.width * scale,
        height: transform.height * scale,
    };
}

export function isNodeVisible(node: UISceneNodeDefinition, activeState?: UISceneState): boolean {
    if (!node.visibleInStates?.length) {
        return true;
    }

    if (!activeState) {
        return false;
    }

    return node.visibleInStates.includes(activeState);
}
