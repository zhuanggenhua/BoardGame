import { parseGameConfigPackageText, type ParseGameConfigPackageTextOptions } from './adapter';
import {
    GameConfigPackageError,
    materializeGameConfigPackage,
    type MaterializeGameConfigPackageOptions,
} from './materialize';
import type { GameConfigMaterializedPackage } from './types';

export interface LoadGameConfigPackageTextOptions
    extends ParseGameConfigPackageTextOptions,
    MaterializeGameConfigPackageOptions {
}

export function loadGameConfigPackageFromText(
    text: string,
    options: LoadGameConfigPackageTextOptions = {},
): GameConfigMaterializedPackage {
    const result = parseGameConfigPackageText(text, options);
    if (!result.ok || !result.package) {
        throw new GameConfigPackageError('game config package parse or validation failed', result.issues);
    }
    return materializeGameConfigPackage(result.package, {
        ...options,
        skipValidation: true,
    });
}
