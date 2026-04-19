export type UISceneNodeType = 'panel' | 'stack' | 'grid' | 'text' | 'button' | 'image' | 'slot';
export type UISceneVisibilityState = string;
export type UISceneStackDirection = 'absolute' | 'horizontal' | 'vertical';
export type UISceneSkinKind = 'nineSlice' | 'backgroundImage' | 'icon' | 'textStyle';
export type UISceneAssetType = 'image';
export type UISceneAssetSourceMode = 'managed' | 'remote';
export type UISceneAssetUploadMode = 'managed' | 'local-only' | 'remote-only';
export type UIScenePreloadMode = 'critical' | 'warm';
export type UISceneContentMode = 'contain' | 'cover' | 'fill';
export type UISceneFlowAlign = 'auto' | 'start' | 'center' | 'end' | 'stretch';

export interface UISceneRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface UISceneInsets {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface UISceneFlowLayoutSource {
    width?: number;
    height?: number;
    grow?: number;
    shrink?: number;
    alignSelf?: UISceneFlowAlign;
    justifySelf?: UISceneFlowAlign;
}

export interface UISceneBackgroundSource {
    assetRef?: string;
    path?: string;
    remoteUrl?: string;
}

export interface UISceneArtboardSource {
    width: number;
    height: number;
    background?: UISceneBackgroundSource;
    zones?: Record<string, UISceneRect>;
}

export interface UISceneAssetEntrySource {
    type: UISceneAssetType;
    path?: string;
    remoteUrl?: string;
    preload?: UIScenePreloadMode;
    upload?: UISceneAssetUploadMode;
}

export interface UISceneAssetRegistrySource {
    assets: Record<string, UISceneAssetEntrySource>;
}

export interface UISceneBaseSkinSource {
    kind: UISceneSkinKind;
}

export interface UISceneNineSliceSkinSource extends UISceneBaseSkinSource {
    kind: 'nineSlice';
    assetRef: string;
    image: {
        width: number;
        height: number;
    };
    slice: UISceneInsets;
    contentPadding?: UISceneInsets;
    scaleMode?: 'stretch' | 'repeat';
}

export interface UISceneBackgroundImageSkinSource extends UISceneBaseSkinSource {
    kind: 'backgroundImage';
    assetRef: string;
    contentMode?: UISceneContentMode;
}

export interface UISceneIconSkinSource extends UISceneBaseSkinSource {
    kind: 'icon';
    assetRef: string;
    width?: number;
    height?: number;
}

export interface UISceneTextStyleSkinSource extends UISceneBaseSkinSource {
    kind: 'textStyle';
    fontToken?: string;
    fontFamily?: string;
    fontSize: number;
    lineHeight?: number | string;
    color?: string;
    fontWeight?: string | number;
    letterSpacing?: string | number;
    textAlign?: 'left' | 'center' | 'right';
}

export type UISceneSkinSource =
    | UISceneNineSliceSkinSource
    | UISceneBackgroundImageSkinSource
    | UISceneIconSkinSource
    | UISceneTextStyleSkinSource;

export interface UISceneSkinCollectionSource {
    skins: Record<string, UISceneSkinSource>;
}

export interface UISceneNodeBaseSource {
    id: string;
    type: UISceneNodeType;
    visible?: boolean;
    visibleIn?: UISceneVisibilityState[];
    zoneRef?: string;
    rect?: UISceneRect;
    layout?: UISceneFlowLayoutSource;
    skin?: string;
    style?: string;
    children?: UISceneNodeSource[];
}

export interface UIScenePanelNodeSource extends UISceneNodeBaseSource {
    type: 'panel';
}

export interface UISceneStackNodeSource extends UISceneNodeBaseSource {
    type: 'stack';
    direction: UISceneStackDirection;
    gap?: number;
    align?: string;
    justify?: string;
    padding?: UISceneInsets;
    clipContent?: boolean;
}

export interface UISceneGridNodeSource extends UISceneNodeBaseSource {
    type: 'grid';
    columns?: number;
    rows?: number;
    gap?: number;
    align?: string;
    justify?: string;
    padding?: UISceneInsets;
    clipContent?: boolean;
}

export interface UISceneTextNodeSource extends UISceneNodeBaseSource {
    type: 'text';
    text?: string;
    textKey?: string;
}

export interface UISceneButtonNodeSource extends UISceneNodeBaseSource {
    type: 'button';
    text?: string;
    textKey?: string;
    icon?: string;
    actionId?: string;
}

export interface UISceneImageNodeSource extends UISceneNodeBaseSource {
    type: 'image';
    assetRef?: string;
    path?: string;
    remoteUrl?: string;
    contentMode?: UISceneContentMode;
    alt?: string;
}

export interface UISceneSlotNodeSource extends UISceneNodeBaseSource {
    type: 'slot';
    slotId: string;
    fallbackText?: string;
}

export type UISceneNodeSource =
    | UIScenePanelNodeSource
    | UISceneStackNodeSource
    | UISceneGridNodeSource
    | UISceneTextNodeSource
    | UISceneButtonNodeSource
    | UISceneImageNodeSource
    | UISceneSlotNodeSource;

export interface UISceneSourceDocument {
    scene: {
        id: string;
        artboard: UISceneArtboardSource;
        root: UISceneNodeSource;
    };
}

export interface UISceneResolvedAsset {
    assetRef?: string;
    type: UISceneAssetType;
    sourceMode: UISceneAssetSourceMode;
    path?: string;
    remoteUrl?: string;
    preload?: UIScenePreloadMode;
    upload?: UISceneAssetUploadMode;
}

export interface UISceneNineSliceSkinCompiled {
    kind: 'nineSlice';
    asset: UISceneResolvedAsset;
    image: {
        width: number;
        height: number;
    };
    slice: UISceneInsets;
    contentPadding: UISceneInsets;
    scaleMode: 'stretch' | 'repeat';
}

export interface UISceneBackgroundImageSkinCompiled {
    kind: 'backgroundImage';
    asset: UISceneResolvedAsset;
    contentMode: UISceneContentMode;
}

export interface UISceneIconSkinCompiled {
    kind: 'icon';
    asset: UISceneResolvedAsset;
    width?: number;
    height?: number;
}

export interface UISceneTextStyleSkinCompiled {
    kind: 'textStyle';
    fontToken?: string;
    fontFamily?: string;
    fontSize: number;
    lineHeight?: number | string;
    color?: string;
    fontWeight?: string | number;
    letterSpacing?: string | number;
    textAlign?: 'left' | 'center' | 'right';
}

export type UISceneCompiledSkin =
    | UISceneNineSliceSkinCompiled
    | UISceneBackgroundImageSkinCompiled
    | UISceneIconSkinCompiled
    | UISceneTextStyleSkinCompiled;

export interface UISceneCompiledNodeBase {
    id: string;
    type: UISceneNodeType;
    visible: boolean;
    visibleIn?: UISceneVisibilityState[];
    zoneRef?: string;
    rect?: UISceneRect;
    layout?: UISceneFlowLayoutSource;
    skinId?: string;
    styleId?: string;
    children: UISceneCompiledNode[];
}

export interface UISceneCompiledPanelNode extends UISceneCompiledNodeBase {
    type: 'panel';
}

export interface UISceneCompiledStackNode extends UISceneCompiledNodeBase {
    type: 'stack';
    direction: UISceneStackDirection;
    gap: number;
    align?: string;
    justify?: string;
    padding: UISceneInsets;
    clipContent: boolean;
}

export interface UISceneCompiledGridNode extends UISceneCompiledNodeBase {
    type: 'grid';
    columns?: number;
    rows?: number;
    gap: number;
    align?: string;
    justify?: string;
    padding: UISceneInsets;
    clipContent: boolean;
}

export interface UISceneCompiledTextNode extends UISceneCompiledNodeBase {
    type: 'text';
    text?: string;
    textKey?: string;
}

export interface UISceneCompiledButtonNode extends UISceneCompiledNodeBase {
    type: 'button';
    text?: string;
    textKey?: string;
    icon?: string;
    actionId?: string;
}

export interface UISceneCompiledImageNode extends UISceneCompiledNodeBase {
    type: 'image';
    asset?: UISceneResolvedAsset;
    contentMode: UISceneContentMode;
    alt?: string;
}

export interface UISceneCompiledSlotNode extends UISceneCompiledNodeBase {
    type: 'slot';
    slotId: string;
    fallbackText?: string;
}

export type UISceneCompiledNode =
    | UISceneCompiledPanelNode
    | UISceneCompiledStackNode
    | UISceneCompiledGridNode
    | UISceneCompiledTextNode
    | UISceneCompiledButtonNode
    | UISceneCompiledImageNode
    | UISceneCompiledSlotNode;

export interface UISceneCompiledArtifact {
    id: string;
    artboard: {
        width: number;
        height: number;
        background?: UISceneResolvedAsset;
        zones: Record<string, UISceneRect>;
    };
    skins: Record<string, UISceneCompiledSkin>;
    root: UISceneCompiledNode;
    assetDependencies: string[];
}

export interface UISceneCompileIssue {
    file: string;
    path: string;
    code: string;
    message: string;
    suggestion?: string;
}

export interface UISceneSourceBundle {
    sceneId: string;
    assetRegistryFile: string;
    skinFile: string;
    sceneFile: string;
    assetRegistry: UISceneAssetRegistrySource;
    skinCollection: UISceneSkinCollectionSource;
    sceneDocument: UISceneSourceDocument;
}

export interface UISceneAuthoringDocument extends UISceneSourceBundle {
    compiled: UISceneCompiledArtifact;
    yaml: {
        assetRegistry: string;
        skin: string;
        scene: string;
    };
}

export interface UISceneAuthoringSavePayload {
    sceneId: string;
    assetRegistryYaml: string;
    skinYaml: string;
    sceneYaml: string;
}
