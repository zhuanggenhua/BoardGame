import type {
    GameConfigPackageFormat,
    GameConfigPackageSource,
    GameConfigValidationOptions,
    GameConfigValidationResult,
} from './types';
import { validateGameConfigPackage } from './validation';

export interface ParseGameConfigPackageTextOptions extends GameConfigValidationOptions {
    format?: GameConfigPackageFormat;
    sourceId?: string;
}

function resolveFormat(format?: GameConfigPackageFormat): GameConfigPackageFormat {
    if (format && format !== 'json') {
        throw new Error(`unsupported game config format "${format}"; official config packages must use strict JSON`);
    }
    return 'json';
}

export function parseGameConfigPackageText(
    text: string,
    options: ParseGameConfigPackageTextOptions = {},
): GameConfigValidationResult {
    const format = resolveFormat(options.format);
    const source: GameConfigPackageSource = {
        format,
        sourceId: options.sourceId,
        loadedAt: new Date().toISOString(),
    };

    try {
        const parsed = JSON.parse(text) as unknown;
        const result = validateGameConfigPackage(parsed, options);
        if (result.package) {
            Object.defineProperty(result.package, '__source', {
                value: source,
                enumerable: false,
                configurable: true,
            });
        }
        return result;
    } catch (error) {
        return {
            ok: false,
            issues: [{
                path: '$',
                code: 'CONFIG_PARSE_ERROR',
                message: error instanceof Error ? error.message : 'failed to parse config package',
                severity: 'error',
            }],
        };
    }
}
