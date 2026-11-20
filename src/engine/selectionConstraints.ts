/** 检查一批候选是否在指定的业务字段上各不相同。 */
export function hasDistinctSelectionValues(
    candidates: ReadonlyArray<{ value?: unknown }>,
    keys: readonly string[] | undefined,
): boolean {
    if (!keys?.length || candidates.length < 2) return true;
    return keys.every(key => {
        const seen = new Set<unknown>();
        return candidates.every(candidate => {
            const value = candidate.value;
            if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
            const field = (value as Record<string, unknown>)[key];
            if ((typeof field !== 'string' && typeof field !== 'number') || seen.has(field)) return false;
            seen.add(field);
            return true;
        });
    });
}
