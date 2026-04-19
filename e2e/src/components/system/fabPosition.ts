export type FabPosition = { left: number; top: number };
export type FabPercentPosition = { leftPercent: number; topPercent: number };

export const serializeFabPositionPercent = (
    target: FabPosition,
    viewportWidth: number,
    viewportHeight: number,
): FabPercentPosition => ({
    leftPercent: viewportWidth > 0 ? target.left / viewportWidth : 0,
    topPercent: viewportHeight > 0 ? target.top / viewportHeight : 0,
});

export const resolveFabStoredPosition = ({
    savedPosition,
    legacyOffset,
    viewportWidth,
    viewportHeight,
    basePosition,
    normalizePosition,
    clampPosition,
    resolvedButtonSize,
}: {
    savedPosition: string | null;
    legacyOffset: string | null;
    viewportWidth: number;
    viewportHeight: number;
    basePosition: FabPosition;
    normalizePosition: (target: FabPosition) => FabPosition;
    clampPosition: (
        target: FabPosition,
        options?: { allowOverflow?: boolean; resolvedButtonSize?: number },
    ) => FabPosition;
    resolvedButtonSize: number;
}) => {
    const clampRestoredPosition = (target: FabPosition) => clampPosition(normalizePosition(target), {
        allowOverflow: false,
        resolvedButtonSize,
    });

    if (savedPosition) {
        const parsed = JSON.parse(savedPosition);
        const isPercentFormat = parsed && typeof parsed === 'object' && 'leftPercent' in parsed && 'topPercent' in parsed;
        const rawPosition = isPercentFormat
            ? {
                left: Number(parsed.leftPercent) * viewportWidth,
                top: Number(parsed.topPercent) * viewportHeight,
            }
            : parsed;
        const position = clampRestoredPosition(rawPosition);
        return {
            position,
            percent: serializeFabPositionPercent(position, viewportWidth, viewportHeight),
            shouldPersist: !isPercentFormat || position.left !== rawPosition.left || position.top !== rawPosition.top,
            clearLegacyOffset: false,
        };
    }

    if (legacyOffset) {
        const parsed = JSON.parse(legacyOffset);
        const rawPosition = {
            left: basePosition.left + (Number(parsed?.x) || 0),
            top: basePosition.top + (Number(parsed?.y) || 0),
        };
        const position = clampRestoredPosition(rawPosition);
        return {
            position,
            percent: serializeFabPositionPercent(position, viewportWidth, viewportHeight),
            shouldPersist: true,
            clearLegacyOffset: true,
        };
    }

    const position = clampRestoredPosition(basePosition);
    return {
        position,
        percent: serializeFabPositionPercent(position, viewportWidth, viewportHeight),
        shouldPersist: false,
        clearLegacyOffset: false,
    };
};
