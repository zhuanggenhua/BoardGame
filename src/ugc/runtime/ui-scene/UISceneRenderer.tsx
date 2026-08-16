import React from 'react';
import { resolveLayoutRect } from '../../utils/layout';
import { defaultUIScenePrefabRegistry, type UIScenePrefabRegistry } from './prefabs';
import {
    isNodeVisible,
    resolveArtboardRegion,
    scaleArtboardRect,
    scaleLayoutTransform,
    type UISceneDefinition,
    type UISceneNodeEvent,
    type UISceneRect,
} from './types';

function useElementSize<T extends HTMLElement>() {
    const ref = React.useRef<T | null>(null);
    const [size, setSize] = React.useState({ width: 0, height: 0 });

    React.useEffect(() => {
        const element = ref.current;
        if (!element) {
            return;
        }

        const observer = new ResizeObserver((entries) => {
            const nextEntry = entries[0];
            if (!nextEntry) {
                return;
            }

            setSize({
                width: nextEntry.contentRect.width,
                height: nextEntry.contentRect.height,
            });
        });

        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return { ref, size };
}

export interface UISceneRendererProps {
    scene: UISceneDefinition;
    activeState?: string;
    sceneContext?: Record<string, unknown>;
    registry?: UIScenePrefabRegistry;
    className?: string;
    testId?: string;
    onNodeEvent?: (event: UISceneNodeEvent) => void;
    debugRegions?: boolean;
    children?: React.ReactNode;
    contentRegions?: Record<string, React.ReactNode>;
    presentationOverride?: Partial<NonNullable<UISceneDefinition['presentation']>>;
}

const DEBUG_REGION_STYLES = {
    safeZones: 'border-amber-300/55 bg-amber-300/10',
    slots: 'border-emerald-300/55 bg-emerald-300/10',
    hitAreas: 'border-cyan-300/55 bg-cyan-300/10',
    guides: 'border-fuchsia-300/45 bg-fuchsia-300/8',
} as const;

type ScaledContentRegion = {
    regionId: string;
    content: React.ReactNode;
    rect: UISceneRect;
};

export const UISceneRenderer = ({
    scene,
    activeState,
    sceneContext,
    registry = defaultUIScenePrefabRegistry,
    className,
    testId,
    onNodeEvent,
    debugRegions = false,
    children,
    contentRegions,
    presentationOverride,
}: UISceneRendererProps) => {
    const { artboard } = scene;
    const { ref, size } = useElementSize<HTMLDivElement>();

    const scale = React.useMemo(() => {
        if (!size.width || !size.height) {
            return 0;
        }

        return Math.min(size.width / artboard.baseWidth, size.height / artboard.baseHeight);
    }, [artboard.baseHeight, artboard.baseWidth, size.height, size.width]);

    const stageSize = React.useMemo(
        () => ({
            width: artboard.baseWidth * scale,
            height: artboard.baseHeight * scale,
        }),
        [artboard.baseHeight, artboard.baseWidth, scale],
    );

    const visibleNodes = React.useMemo(() => {
        if (!scale) {
            return [];
        }

        return scene.nodes
            .filter((node) => isNodeVisible(node, activeState))
            .map((node) => {
                const regionRect = resolveArtboardRegion(artboard, node.regionId);
                const clipRect = resolveArtboardRegion(artboard, node.clipRegionId);
                const resolvedRect = node.transform
                    ? resolveLayoutRect(scaleLayoutTransform(node.transform, scale), stageSize)
                    : regionRect
                        ? { ...scaleArtboardRect(regionRect, scale) }
                        : null;

                return {
                    node,
                    prefab: registry.get(node.prefabId),
                    rect: resolvedRect,
                    regionRect: regionRect ? scaleArtboardRect(regionRect, scale) : null,
                    clipRect: clipRect ? scaleArtboardRect(clipRect, scale) : null,
                };
            })
            .sort((left, right) => (left.node.zIndex ?? 0) - (right.node.zIndex ?? 0));
    }, [activeState, artboard, registry, scale, scene.nodes, stageSize]);

    const scaledContentRegions = React.useMemo(() => {
        if (!scale || !contentRegions) {
            return [];
        }

        return Object.entries(contentRegions)
            .map(([regionId, content]): ScaledContentRegion | null => {
                const region = resolveArtboardRegion(artboard, regionId);
                if (!region || content == null) {
                    return null;
                }

                return {
                    regionId,
                    content,
                    rect: scaleArtboardRect(region, scale),
                };
            })
            .filter((entry): entry is ScaledContentRegion => entry !== null);
    }, [artboard, contentRegions, scale]);

    const emit = React.useCallback(
        (nodeId: string, prefabId: string, eventId: string, payload?: unknown) => {
            onNodeEvent?.({
                sceneId: scene.id,
                nodeId,
                prefabId,
                eventId,
                payload,
            });
        },
        [onNodeEvent, scene.id],
    );

    const presentationScale = presentationOverride?.scaleMultiplier ?? scene.presentation?.scaleMultiplier ?? 1;
    const presentationOffsetXPx = ((presentationOverride?.offsetXPct ?? scene.presentation?.offsetXPct ?? 0) / 100) * stageSize.width;
    const presentationOffsetYPx = ((presentationOverride?.offsetYPct ?? scene.presentation?.offsetYPct ?? 0) / 100) * stageSize.height;
    const presentationTransform = `translate(-50%, -50%) scale(${presentationScale})`;
    return (
        <div
            ref={ref}
            data-testid={testId}
            className={`relative h-full w-full overflow-visible ${className ?? ''}`}
            style={{ aspectRatio: `${artboard.baseWidth} / ${artboard.baseHeight}` }}
        >
            {scale ? (
                <div
                    className="absolute left-1/2 top-1/2 overflow-visible"
                    style={{
                        width: stageSize.width,
                        height: stageSize.height,
                        left: `calc(50% + ${presentationOffsetXPx}px)`,
                        top: `calc(50% + ${presentationOffsetYPx}px)`,
                        transform: presentationTransform,
                        transformOrigin: 'center center',
                    }}
                >
                    {visibleNodes.map(({ clipRect, node, prefab, rect, regionRect }) => {
                        if (!prefab) {
                            return null;
                        }

                        return (
                            <React.Fragment key={node.id}>
                                {prefab.render({
                                    scene,
                                    artboard,
                                    node,
                                    rect,
                                    regionRect,
                                    clipRect,
                                    activeState,
                                    sceneContext,
                                    emit: (eventId, payload) => emit(node.id, node.prefabId, eventId, payload),
                                })}
                            </React.Fragment>
                        );
                    })}

                    {debugRegions
                        ? ([
                            ['safeZones', artboard.safeZones ?? {}],
                            ['slots', artboard.slots ?? {}],
                            ['hitAreas', artboard.hitAreas ?? {}],
                            ['guides', artboard.guides ?? {}],
                        ] as const).flatMap(([groupName, regions]) =>
                            Object.entries(regions).map(([regionId, region]) => {
                                const scaledRegion = scaleArtboardRect(region, scale);
                                return (
                                    <div
                                        key={`${groupName}:${regionId}`}
                                        className={`pointer-events-none absolute border ${DEBUG_REGION_STYLES[groupName]}`}
                                        style={{
                                            left: scaledRegion.x,
                                            top: scaledRegion.y,
                                            width: scaledRegion.width,
                                            height: scaledRegion.height,
                                        }}
                                    />
                                );
                            }),
                        )
                        : null}
                    {children}
                </div>
            ) : null}
            {scale ? (
                <div
                    className="pointer-events-none absolute left-1/2 top-1/2"
                    style={{
                        width: stageSize.width,
                        height: stageSize.height,
                        left: `calc(50% + ${presentationOffsetXPx}px)`,
                        top: `calc(50% + ${presentationOffsetYPx}px)`,
                        transform: presentationTransform,
                        transformOrigin: 'center center',
                    }}
                >
                    {scaledContentRegions.map(({ regionId, content, rect }) => (
                        <div
                            key={`content:${regionId}`}
                            data-scene-region={regionId}
                            className="absolute overflow-hidden pointer-events-none @container"
                            style={{
                                left: rect.x,
                                top: rect.y,
                                width: rect.width,
                                height: rect.height,
                                containerType: 'size',
                                zIndex: 40,
                            }}
                        >
                            {content}
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
};
