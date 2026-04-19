import { stringify } from 'yaml';
import type { UISceneAssetRegistrySource, UISceneSkinCollectionSource, UISceneSourceDocument } from '../types';

export function serializeAssetRegistryYaml(value: UISceneAssetRegistrySource): string {
    return stringify(value).trimEnd() + '\n';
}

export function serializeSkinYaml(value: UISceneSkinCollectionSource): string {
    return stringify(value).trimEnd() + '\n';
}

export function serializeSceneYaml(value: UISceneSourceDocument): string {
    return stringify(value).trimEnd() + '\n';
}
