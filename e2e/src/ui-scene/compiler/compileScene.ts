import {
    type UISceneAssetEntrySource,
    type UISceneAuthoringDocument,
    type UISceneCompileIssue,
    type UISceneCompiledArtifact,
    type UISceneCompiledNode,
    type UISceneCompiledSkin,
    type UISceneInsets,
    type UISceneNodeSource,
    type UISceneRect,
    type UISceneResolvedAsset,
    type UISceneTextStyleSkinCompiled,
    type UISceneSourceBundle,
} from '../types';
import { UISceneCompileError, parseAssetRegistryYaml, parseSceneYaml, parseSkinYaml } from './parseYaml';

const ZERO_INSETS: UISceneInsets = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
};

function issue(file: string, path: string, code: string, message: string, suggestion?: string): UISceneCompileIssue {
    return {
        file,
        path,
        code,
        message,
        suggestion,
    };
}

function normalizeAssetPath(path: string): string {
    return path.replace(/^\/+/, '');
}

function resolveInlineAsset(
    file: string,
    path: string,
    inlineAsset: { assetRef?: string; path?: string; remoteUrl?: string } | undefined,
    assetRegistry: Record<string, UISceneAssetEntrySource>,
): UISceneResolvedAsset | undefined {
    if (!inlineAsset) {
        return undefined;
    }

    if (inlineAsset.assetRef) {
        const asset = assetRegistry[inlineAsset.assetRef];
        if (!asset) {
            throw new UISceneCompileError('资源引用不存在', [
                issue(file, path, 'UNKNOWN_ASSET_REF', `assetRef "${inlineAsset.assetRef}" 不存在`, '使用 asset-registry.yaml 中已定义的资源标识'),
            ]);
        }

        return {
            assetRef: inlineAsset.assetRef,
            type: asset.type,
            sourceMode: asset.remoteUrl ? 'remote' : 'managed',
            path: asset.path ? normalizeAssetPath(asset.path) : undefined,
            remoteUrl: asset.remoteUrl,
            preload: asset.preload,
            upload: asset.upload ?? (asset.remoteUrl ? 'remote-only' : 'managed'),
        };
    }

    if (inlineAsset.path) {
        return {
            type: 'image',
            sourceMode: 'managed',
            path: normalizeAssetPath(inlineAsset.path),
            upload: 'managed',
        };
    }

    if (inlineAsset.remoteUrl) {
        return {
            type: 'image',
            sourceMode: 'remote',
            remoteUrl: inlineAsset.remoteUrl,
            upload: 'remote-only',
        };
    }

    return undefined;
}

function compileSkinCollection(
    bundle: UISceneSourceBundle,
    assetDependencies: Set<string>,
): Record<string, UISceneCompiledSkin> {
    const compiled: Record<string, UISceneCompiledSkin> = {};
    const assetRegistry = bundle.assetRegistry.assets;

    Object.entries(bundle.skinCollection.skins).forEach(([skinId, skin]) => {
        if (skin.kind === 'nineSlice') {
            const asset = resolveInlineAsset(bundle.skinFile, `skins.${skinId}.assetRef`, { assetRef: skin.assetRef }, assetRegistry);
            if (!asset) {
                throw new UISceneCompileError('nineSlice 资源缺失', [
                    issue(bundle.skinFile, `skins.${skinId}.assetRef`, 'SKIN_ASSET_REQUIRED', `皮肤 "${skinId}" 缺少有效资源`, '为该 nineSlice 配置 assetRef'),
                ]);
            }
            assetDependencies.add(skin.assetRef);
            compiled[skinId] = {
                kind: 'nineSlice',
                asset,
                image: skin.image,
                slice: skin.slice,
                contentPadding: skin.contentPadding ?? ZERO_INSETS,
                scaleMode: skin.scaleMode ?? 'stretch',
            };
            return;
        }

        if (skin.kind === 'backgroundImage') {
            const asset = resolveInlineAsset(bundle.skinFile, `skins.${skinId}.assetRef`, { assetRef: skin.assetRef }, assetRegistry);
            if (!asset) {
                throw new UISceneCompileError('backgroundImage 资源缺失', [
                    issue(bundle.skinFile, `skins.${skinId}.assetRef`, 'SKIN_ASSET_REQUIRED', `皮肤 "${skinId}" 缺少有效资源`, '为该 backgroundImage 配置 assetRef'),
                ]);
            }
            assetDependencies.add(skin.assetRef);
            compiled[skinId] = {
                kind: 'backgroundImage',
                asset,
                contentMode: skin.contentMode ?? 'cover',
            };
            return;
        }

        if (skin.kind === 'icon') {
            const asset = resolveInlineAsset(bundle.skinFile, `skins.${skinId}.assetRef`, { assetRef: skin.assetRef }, assetRegistry);
            if (!asset) {
                throw new UISceneCompileError('icon 资源缺失', [
                    issue(bundle.skinFile, `skins.${skinId}.assetRef`, 'SKIN_ASSET_REQUIRED', `皮肤 "${skinId}" 缺少有效资源`, '为该 icon 配置 assetRef'),
                ]);
            }
            assetDependencies.add(skin.assetRef);
            compiled[skinId] = {
                kind: 'icon',
                asset,
                width: skin.width,
                height: skin.height,
            };
            return;
        }

        compiled[skinId] = {
            kind: 'textStyle',
            fontToken: skin.fontToken,
            fontFamily: skin.fontFamily,
            fontSize: skin.fontSize,
            lineHeight: skin.lineHeight,
            color: skin.color,
            fontWeight: skin.fontWeight,
            letterSpacing: skin.letterSpacing,
            textAlign: skin.textAlign,
        };
    });

    return compiled;
}

function ensureZone(
    bundle: UISceneSourceBundle,
    zoneRef: string,
    path: string,
): UISceneRect {
    const zone = bundle.sceneDocument.scene.artboard.zones?.[zoneRef];
    if (!zone) {
        throw new UISceneCompileError('命名区域不存在', [
            issue(bundle.sceneFile, path, 'UNKNOWN_ZONE_REF', `zoneRef "${zoneRef}" 不存在`, '使用 artboard.zones 中已定义的区域名'),
        ]);
    }

    return zone;
}

function ensureSkinExists(
    bundle: UISceneSourceBundle,
    compiledSkins: Record<string, UISceneCompiledSkin>,
    skinId: string | undefined,
    path: string,
    field: 'skin' | 'style',
) {
    if (!skinId) {
        return;
    }

    if (!compiledSkins[skinId]) {
        throw new UISceneCompileError('皮肤引用不存在', [
            issue(bundle.sceneFile, path, 'UNKNOWN_SKIN_REF', `${field} "${skinId}" 不存在`, '使用 skin.yaml 中已定义的皮肤标识'),
        ]);
    }
}

function compileNode(
    bundle: UISceneSourceBundle,
    compiledSkins: Record<string, UISceneCompiledSkin>,
    assetDependencies: Set<string>,
    node: UISceneNodeSource,
    path: string,
): UISceneCompiledNode {
    if (node.zoneRef && node.rect) {
        throw new UISceneCompileError('节点定位冲突', [
            issue(bundle.sceneFile, path, 'CONFLICTING_LAYOUT_SOURCE', `节点 "${node.id}" 不能同时声明 zoneRef 和 rect`, '保留 zoneRef 或 rect 其中一种'),
        ]);
    }

    ensureSkinExists(bundle, compiledSkins, node.skin, `${path}.skin`, 'skin');
    ensureSkinExists(bundle, compiledSkins, node.style, `${path}.style`, 'style');

    const rect = node.zoneRef
        ? ensureZone(bundle, node.zoneRef, `${path}.zoneRef`)
        : node.rect;

    const baseNode = {
        id: node.id,
        type: node.type,
        visible: node.visible ?? true,
        visibleIn: node.visibleIn,
        zoneRef: node.zoneRef,
        rect,
        layout: node.layout,
        skinId: node.skin,
        styleId: node.style,
        children: (node.children ?? []).map((child, index) => compileNode(
            bundle,
            compiledSkins,
            assetDependencies,
            child,
            `${path}.children[${index}]`,
        )),
    } as const;

    switch (node.type) {
        case 'panel':
            return {
                ...baseNode,
                type: 'panel',
            };
        case 'stack':
            return {
                ...baseNode,
                type: 'stack',
                direction: node.direction,
                gap: node.gap ?? 0,
                align: node.align,
                justify: node.justify,
                padding: node.padding ?? ZERO_INSETS,
                clipContent: node.clipContent ?? false,
            };
        case 'grid':
            return {
                ...baseNode,
                type: 'grid',
                columns: node.columns,
                rows: node.rows,
                gap: node.gap ?? 0,
                align: node.align,
                justify: node.justify,
                padding: node.padding ?? ZERO_INSETS,
                clipContent: node.clipContent ?? false,
            };
        case 'text':
            return {
                ...baseNode,
                type: 'text',
                text: node.text,
                textKey: node.textKey,
            };
        case 'button':
            return {
                ...baseNode,
                type: 'button',
                text: node.text,
                textKey: node.textKey,
                icon: node.icon,
                actionId: node.actionId,
            };
        case 'image': {
            const asset = resolveInlineAsset(
                bundle.sceneFile,
                path,
                { assetRef: node.assetRef, path: node.path, remoteUrl: node.remoteUrl },
                bundle.assetRegistry.assets,
            );
            if (node.assetRef) {
                assetDependencies.add(node.assetRef);
            }
            return {
                ...baseNode,
                type: 'image',
                asset,
                contentMode: node.contentMode ?? 'contain',
                alt: node.alt,
            };
        }
        case 'slot':
            return {
                ...baseNode,
                type: 'slot',
                slotId: node.slotId,
                fallbackText: node.fallbackText,
            };
        default: {
            const exhaustiveCheck: never = node;
            return exhaustiveCheck;
        }
    }
}

export function compileSceneBundle(bundle: UISceneSourceBundle): UISceneCompiledArtifact {
    const assetDependencies = new Set<string>();
    const compiledSkins = compileSkinCollection(bundle, assetDependencies);
    const background = resolveInlineAsset(
        bundle.sceneFile,
        'scene.artboard.background',
        bundle.sceneDocument.scene.artboard.background,
        bundle.assetRegistry.assets,
    );

    if (bundle.sceneDocument.scene.artboard.background?.assetRef) {
        assetDependencies.add(bundle.sceneDocument.scene.artboard.background.assetRef);
    }

    return {
        id: bundle.sceneDocument.scene.id,
        artboard: {
            width: bundle.sceneDocument.scene.artboard.width,
            height: bundle.sceneDocument.scene.artboard.height,
            background,
            zones: bundle.sceneDocument.scene.artboard.zones ?? {},
        },
        skins: compiledSkins,
        root: compileNode(
            bundle,
            compiledSkins,
            assetDependencies,
            bundle.sceneDocument.scene.root,
            'scene.root',
        ),
        assetDependencies: Array.from(assetDependencies),
    };
}

export function createSourceBundle(params: {
    sceneId: string;
    assetRegistryFile: string;
    assetRegistryYaml: string;
    skinFile: string;
    skinYaml: string;
    sceneFile: string;
    sceneYaml: string;
}): UISceneSourceBundle {
    return {
        sceneId: params.sceneId,
        assetRegistryFile: params.assetRegistryFile,
        skinFile: params.skinFile,
        sceneFile: params.sceneFile,
        assetRegistry: parseAssetRegistryYaml(params.assetRegistryYaml, params.assetRegistryFile),
        skinCollection: parseSkinYaml(params.skinYaml, params.skinFile),
        sceneDocument: parseSceneYaml(params.sceneYaml, params.sceneFile),
    };
}

export function createAuthoringDocument(params: {
    sceneId: string;
    assetRegistryFile: string;
    assetRegistryYaml: string;
    skinFile: string;
    skinYaml: string;
    sceneFile: string;
    sceneYaml: string;
}): UISceneAuthoringDocument {
    const bundle = createSourceBundle(params);
    return {
        ...bundle,
        compiled: compileSceneBundle(bundle),
        yaml: {
            assetRegistry: params.assetRegistryYaml,
            skin: params.skinYaml,
            scene: params.sceneYaml,
        },
    };
}

export function assertTextStyleSkin(
    skins: Record<string, UISceneCompiledSkin>,
    styleId?: string,
): UISceneTextStyleSkinCompiled | undefined {
    if (!styleId) {
        return undefined;
    }

    const style = skins[styleId];
    if (!style) {
        return undefined;
    }

    return style.kind === 'textStyle' ? style : undefined;
}
