export const normalizeDeveloperGameIds = (value: string[] | undefined | null) => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(
        value
            .map((item) => typeof item === 'string' ? item.trim().toLowerCase() : '')
            .filter(Boolean),
    ));
};

export const areDeveloperGameIdsEqual = (
    left: string[] | undefined | null,
    right: string[] | undefined | null,
) => {
    const normalizedLeft = normalizeDeveloperGameIds(left);
    const normalizedRight = normalizeDeveloperGameIds(right);

    if (normalizedLeft.length !== normalizedRight.length) {
        return false;
    }

    return normalizedLeft.every((item, index) => item === normalizedRight[index]);
};

export const getDeveloperGameScopeLabel = (developerGameIds: string[] | undefined | null) => {
    const normalized = normalizeDeveloperGameIds(developerGameIds);
    if (normalized.length === 0) {
        return null;
    }
    return `${normalized.length} 个游戏`;
};
