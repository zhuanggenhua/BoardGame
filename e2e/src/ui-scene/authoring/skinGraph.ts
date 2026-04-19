import type {
    UISceneAssetEntrySource,
    UISceneAssetRegistrySource,
    UISceneNineSliceSkinSource,
    UISceneSkinCollectionSource,
    UISceneSkinSource,
} from '../types';

export function updateSkinCollection(
    skinCollection: UISceneSkinCollectionSource,
    skinId: string,
    updater: (skin: UISceneSkinSource | undefined) => UISceneSkinSource,
): UISceneSkinCollectionSource {
    return {
        skins: {
            ...skinCollection.skins,
            [skinId]: updater(skinCollection.skins[skinId]),
        },
    };
}

export function updateNineSliceSkin(
    skinCollection: UISceneSkinCollectionSource,
    skinId: string,
    updater: (skin: UISceneNineSliceSkinSource) => UISceneNineSliceSkinSource,
): UISceneSkinCollectionSource {
    return updateSkinCollection(skinCollection, skinId, (skin) => {
        if (!skin || skin.kind !== 'nineSlice') {
            throw new Error(`nineSlice 皮肤不存在: ${skinId}`);
        }

        return updater(skin);
    });
}

export function upsertSceneAsset(
    assetRegistry: UISceneAssetRegistrySource,
    assetRef: string,
    entry: UISceneAssetEntrySource,
): UISceneAssetRegistrySource {
    return {
        assets: {
            ...assetRegistry.assets,
            [assetRef]: entry,
        },
    };
}
