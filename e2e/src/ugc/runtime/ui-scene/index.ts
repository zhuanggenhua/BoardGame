export { HomeSceneRenderer, type HomeSceneRendererProps } from './HomeSceneRenderer';
export { UISceneRenderer, type UISceneRendererProps } from './UISceneRenderer';
export {
    createUIScenePrefabRegistry,
    defaultUIScenePrefabRegistry,
    type UIScenePrefabRegistry,
    type UIFrameSequencePrefabProps,
    type UIHotspotPrefabProps,
    type UIImagePrefabProps,
} from './prefabs';
export { HOME_V2_BOOK_SCENE, type HomeV2SceneState } from './scenes/homeV2BookScene';
export type {
    UISceneArtboardDefinition,
    UISceneArtboardRegion,
    UISceneDefinition,
    UISceneNodeDefinition,
    UISceneNodeEvent,
    UIScenePresentationDefinition,
    UIScenePrefabDefinition,
    UIScenePrefabRenderContext,
    UISceneRect,
    UISceneState,
} from './types';
export {
    isNodeVisible,
    resolveArtboardRegion,
    scaleArtboardRect,
    scaleLayoutTransform,
} from './types';
