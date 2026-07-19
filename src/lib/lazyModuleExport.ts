export const STALE_LAZY_MODULE_MARKER = '[stale-lazy-module]';

export function requireLazyModuleExport<
    TModule extends object,
    TKey extends keyof TModule,
>(
    module: TModule | null | undefined,
    exportName: TKey,
    moduleId: string,
): NonNullable<TModule[TKey]> {
    const value = module?.[exportName];
    if (value === undefined || value === null) {
        throw new Error(`${STALE_LAZY_MODULE_MARKER} ${moduleId} missing export ${String(exportName)}`);
    }
    return value as NonNullable<TModule[TKey]>;
}
