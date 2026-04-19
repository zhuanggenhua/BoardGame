import React from 'react';
import { useTranslation } from 'react-i18next';
import type {
    UISceneCompiledArtifact,
    UISceneCompiledGridNode,
    UISceneCompiledNode,
    UISceneRect,
    UISceneCompiledSkin,
    UISceneCompiledStackNode,
    UISceneTextStyleSkinCompiled,
} from '../types';
import { resolveCompiledAssetUrl } from './assets';
import { SkinSurface } from './SkinSurface';

type LayoutMode = 'absolute' | 'horizontal' | 'vertical' | 'grid';

export interface CompiledSceneRendererProps {
    scene: UISceneCompiledArtifact;
    activeState?: string;
    className?: string;
    slots?: Record<string, React.ReactNode>;
    actionHandlers?: Record<string, () => void>;
    rectOverrides?: Record<string, UISceneRect>;
    children?: React.ReactNode;
}

function toPercent(value: number, total: number) {
    return `${(value / total) * 100}%`;
}

function isNodeVisible(node: UISceneCompiledNode, activeState?: string) {
    if (!node.visible) {
        return false;
    }

    if (!node.visibleIn?.length) {
        return true;
    }

    if (!activeState) {
        return false;
    }

    return node.visibleIn.includes(activeState);
}

function resolveFlexAlign(value?: string): React.CSSProperties['alignItems'] {
    if (value === 'start') {
        return 'flex-start';
    }
    if (value === 'end') {
        return 'flex-end';
    }
    if (value === 'center' || value === 'stretch' || value === 'space-between') {
        return value as React.CSSProperties['alignItems'];
    }
    return undefined;
}

function resolveFlexJustify(value?: string): React.CSSProperties['justifyContent'] {
    if (value === 'start') {
        return 'flex-start';
    }
    if (value === 'end') {
        return 'flex-end';
    }
    if (value === 'center' || value === 'stretch' || value === 'space-between') {
        return value as React.CSSProperties['justifyContent'];
    }
    return undefined;
}

function resolveSelfAlign(value?: string): React.CSSProperties['alignSelf'] {
    if (value === 'start') {
        return 'start';
    }
    if (value === 'end') {
        return 'end';
    }
    if (value === 'center' || value === 'stretch' || value === 'auto') {
        return value as React.CSSProperties['alignSelf'];
    }
    return undefined;
}

function resolveNodeRect(node: UISceneCompiledNode, rectOverrides: Record<string, UISceneRect>): UISceneRect | undefined {
    return rectOverrides[node.id] ?? node.rect;
}

function resolveRectStyle(
    scene: UISceneCompiledArtifact,
    node: UISceneCompiledNode,
    parentMode: LayoutMode,
    rectOverrides: Record<string, UISceneRect>,
): React.CSSProperties {
    const rect = resolveNodeRect(node, rectOverrides);

    if (rect) {
        return {
            position: 'absolute',
            left: toPercent(rect.x, scene.artboard.width),
            top: toPercent(rect.y, scene.artboard.height),
            width: toPercent(rect.width, scene.artboard.width),
            height: toPercent(rect.height, scene.artboard.height),
        };
    }

    if (parentMode === 'horizontal' || parentMode === 'vertical' || parentMode === 'grid') {
        return {
            position: 'relative',
            minWidth: 0,
            minHeight: 0,
            width: node.layout?.width,
            height: node.layout?.height,
            flexGrow: node.layout?.grow,
            flexShrink: node.layout?.shrink,
            alignSelf: resolveSelfAlign(node.layout?.alignSelf),
            justifySelf: resolveSelfAlign(node.layout?.justifySelf),
        };
    }

    return {
        position: 'relative',
        width: '100%',
        height: '100%',
    };
}

function resolveTextStyle(skin?: UISceneCompiledSkin): React.CSSProperties | undefined {
    if (!skin || skin.kind !== 'textStyle') {
        return undefined;
    }

    const textStyle = skin as UISceneTextStyleSkinCompiled;
    return {
        fontFamily: textStyle.fontFamily,
        fontSize: textStyle.fontSize,
        lineHeight: typeof textStyle.lineHeight === 'number' ? `${textStyle.lineHeight}` : textStyle.lineHeight,
        color: textStyle.color,
        fontWeight: textStyle.fontWeight,
        letterSpacing: typeof textStyle.letterSpacing === 'number' ? `${textStyle.letterSpacing}px` : textStyle.letterSpacing,
        textAlign: textStyle.textAlign,
    };
}

function resolveContainerStyle(node: UISceneCompiledStackNode | UISceneCompiledGridNode): React.CSSProperties {
    if (node.type === 'stack') {
        if (node.direction === 'absolute') {
            return {
                position: 'relative',
                width: '100%',
                height: '100%',
            };
        }

        return {
            display: 'flex',
            flexDirection: node.direction === 'horizontal' ? 'row' : 'column',
            gap: node.gap,
            alignItems: resolveFlexAlign(node.align),
            justifyContent: resolveFlexJustify(node.justify),
            position: 'relative',
            width: '100%',
            height: '100%',
            minWidth: 0,
            minHeight: 0,
            paddingTop: node.padding.top,
            paddingRight: node.padding.right,
            paddingBottom: node.padding.bottom,
            paddingLeft: node.padding.left,
            overflow: node.clipContent ? 'hidden' : 'visible',
            boxSizing: 'border-box',
        };
    }

    return {
        display: 'grid',
        gridTemplateColumns: node.columns ? `repeat(${node.columns}, minmax(0, 1fr))` : undefined,
        gridTemplateRows: node.rows ? `repeat(${node.rows}, minmax(0, 1fr))` : undefined,
        gap: node.gap,
        position: 'relative',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        alignItems: resolveSelfAlign(node.align),
        justifyItems: resolveSelfAlign(node.justify),
        alignContent: resolveSelfAlign(node.align),
        justifyContent: resolveFlexJustify(node.justify),
        paddingTop: node.padding.top,
        paddingRight: node.padding.right,
        paddingBottom: node.padding.bottom,
        paddingLeft: node.padding.left,
        overflow: node.clipContent ? 'hidden' : 'visible',
        boxSizing: 'border-box',
    };
}

function RenderNode({
    node,
    scene,
    activeState,
    parentMode,
    slots,
    actionHandlers,
    rectOverrides,
}: {
    node: UISceneCompiledNode;
    scene: UISceneCompiledArtifact;
    activeState?: string;
    parentMode: LayoutMode;
    slots: Record<string, React.ReactNode>;
    actionHandlers: Record<string, () => void>;
    rectOverrides: Record<string, UISceneRect>;
}) {
    const { t } = useTranslation(['lobby', 'common']);

    if (!isNodeVisible(node, activeState)) {
        return null;
    }

    const skin = node.skinId ? scene.skins[node.skinId] : undefined;
    const styleSkin = node.styleId ? scene.skins[node.styleId] : undefined;
    const shellStyle = resolveRectStyle(scene, node, parentMode, rectOverrides);
    const textStyle = resolveTextStyle(styleSkin);

    switch (node.type) {
        case 'panel':
            return (
                <div style={shellStyle} data-scene-node={node.id}>
                    <SkinSurface
                        skin={skin}
                        style={{ width: '100%', height: '100%' }}
                    >
                        {node.children.map((child) => (
                            <RenderNode
                                key={child.id}
                                node={child}
                                scene={scene}
                                activeState={activeState}
                                parentMode="absolute"
                                slots={slots}
                                actionHandlers={actionHandlers}
                                rectOverrides={rectOverrides}
                            />
                        ))}
                    </SkinSurface>
                </div>
            );
        case 'stack':
        case 'grid': {
            const layoutMode = node.type === 'stack' ? node.direction : 'grid';
            return (
                <div style={shellStyle} data-scene-node={node.id}>
                    <SkinSurface
                        skin={skin}
                        style={{ width: '100%', height: '100%' }}
                        contentStyle={node.type === 'stack' || node.type === 'grid' ? resolveContainerStyle(node) : undefined}
                    >
                        {node.children.map((child) => (
                            <RenderNode
                                key={child.id}
                                node={child}
                                scene={scene}
                                activeState={activeState}
                                parentMode={layoutMode}
                                slots={slots}
                                actionHandlers={actionHandlers}
                                rectOverrides={rectOverrides}
                            />
                        ))}
                    </SkinSurface>
                </div>
            );
        }
        case 'text':
            return (
                <div
                    style={{
                        ...shellStyle,
                        ...textStyle,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: textStyle?.textAlign === 'center' ? 'center' : undefined,
                        whiteSpace: 'pre-wrap',
                    }}
                    data-scene-node={node.id}
                >
                    {node.textKey ? t(node.textKey, node.textKey) : node.text}
                </div>
            );
        case 'button':
            {
                const buttonLabel = node.textKey
                    ? t(node.textKey, node.textKey)
                    : node.text ?? node.actionId ?? node.id;
            return (
                <button
                    type="button"
                    data-scene-node={node.id}
                    aria-label={buttonLabel}
                    style={{
                        ...shellStyle,
                        ...textStyle,
                        cursor: node.actionId ? 'pointer' : 'default',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                    }}
                    onClick={node.actionId ? actionHandlers[node.actionId] : undefined}
                >
                    {node.textKey ? t(node.textKey, node.textKey) : node.text}
                </button>
            );
            }
        case 'image': {
            const url = resolveCompiledAssetUrl(node.asset);
            return (
                <div style={shellStyle} data-scene-node={node.id}>
                    <img
                        src={url}
                        alt={node.alt ?? ''}
                        className="h-full w-full"
                        style={{ objectFit: node.contentMode }}
                    />
                </div>
            );
        }
        case 'slot':
            return (
                <div
                    style={{
                        ...shellStyle,
                        pointerEvents: 'auto',
                        minWidth: 0,
                        minHeight: 0,
                    }}
                    data-scene-node={node.id}
                    data-scene-slot={node.slotId}
                >
                    {slots[node.slotId] ?? node.fallbackText ?? null}
                </div>
            );
        default: {
            const exhaustiveCheck: never = node;
            return exhaustiveCheck;
        }
    }
}

function NodeTree({
    node,
    scene,
    activeState,
    slots,
    actionHandlers,
    rectOverrides,
}: {
    node: UISceneCompiledNode;
    scene: UISceneCompiledArtifact;
    activeState?: string;
    slots: Record<string, React.ReactNode>;
    actionHandlers: Record<string, () => void>;
    rectOverrides: Record<string, UISceneRect>;
}) {
    if (!isNodeVisible(node, activeState)) {
        return null;
    }

    return (
        <RenderNode
            node={node}
            scene={scene}
            activeState={activeState}
            parentMode="absolute"
            slots={slots}
            actionHandlers={actionHandlers}
            rectOverrides={rectOverrides}
        />
    );
}

export function CompiledSceneRenderer({
    scene,
    activeState,
    className,
    slots = {},
    actionHandlers = {},
    rectOverrides = {},
    children,
}: CompiledSceneRendererProps) {
    const backgroundUrl = resolveCompiledAssetUrl(scene.artboard.background);

    return (
        <div
            className={className}
            style={{
                position: 'absolute',
                inset: 0,
                overflow: 'visible',
                backgroundImage: backgroundUrl ? `url("${backgroundUrl}")` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
            }}
        >
            <NodeTree
                node={scene.root}
                scene={scene}
                activeState={activeState}
                slots={slots}
                actionHandlers={actionHandlers}
                rectOverrides={rectOverrides}
            />
            {children}
        </div>
    );
}
