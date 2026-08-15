export type FabAlignment = { v: 'top' | 'bottom'; h: 'left' | 'right' };
export type FabPosition = { left: number; top: number };
export type FabOffset = { x: number; y: number };
export type ExpandedFabLayout = {
    position: FabPosition;
    alignment: FabAlignment;
    listOffset: FabOffset;
    columnCount: number;
    itemsPerColumn: number;
    columnGap: number;
};

export const resolveExpandedFabLayout = ({
    position,
    alignment,
    satelliteCount,
    buttonSize,
    buttonGap,
    viewportHeight,
    safeAreaTop,
    safeAreaBottom,
    getHorizontalAlignment,
}: {
    position: FabPosition;
    alignment: FabAlignment;
    satelliteCount: number;
    buttonSize: number;
    buttonGap: number;
    viewportHeight: number;
    safeAreaTop: number;
    safeAreaBottom: number;
    getHorizontalAlignment: (target: FabPosition, resolvedButtonSize: number) => FabAlignment['h'];
}): ExpandedFabLayout => {
    const resolvedPosition = {
        left: Number.isFinite(position.left) ? position.left : 0,
        top: Number.isFinite(position.top) ? position.top : 0,
    };
    const resolvedButtonSize = Number.isFinite(buttonSize) && buttonSize > 0 ? buttonSize : 0;
    const resolvedButtonGap = Number.isFinite(buttonGap) ? buttonGap : 0;
    const resolvedSatelliteCount = Math.max(satelliteCount, 0);
    const resolvedViewportHeight = Number.isFinite(viewportHeight) ? viewportHeight : 0;
    const topInset = Number.isFinite(safeAreaTop) ? safeAreaTop : 0;
    const bottomInset = Number.isFinite(safeAreaBottom) ? safeAreaBottom : 0;
    const offset = resolvedButtonSize + resolvedButtonGap;
    const availableHeight = resolvedViewportHeight > 0
        ? Math.max(resolvedButtonSize, resolvedViewportHeight - topInset - bottomInset - offset)
        : 0;
    const maxItemsPerColumn = availableHeight > 0 && offset > 0
        ? Math.max(1, Math.floor(availableHeight / offset))
        : Math.max(1, resolvedSatelliteCount);
    const itemsPerColumn = resolvedSatelliteCount > 0
        ? Math.min(resolvedSatelliteCount, maxItemsPerColumn)
        : 1;
    const columnCount = resolvedSatelliteCount > 0
        ? Math.max(1, Math.ceil(resolvedSatelliteCount / itemsPerColumn))
        : 1;
    const visibleColumnHeight = Math.min(resolvedSatelliteCount, itemsPerColumn) * offset;
    const columnGap = resolvedButtonSize + Math.max(resolvedButtonGap, 8);

    let offsetY = 0;
    if (resolvedViewportHeight > 0 && visibleColumnHeight > 0) {
        if (alignment.v === 'bottom') {
            const listTop = resolvedPosition.top - visibleColumnHeight;
            if (listTop < topInset) {
                offsetY = topInset - listTop;
            }
        } else {
            const listBottom = resolvedPosition.top + visibleColumnHeight + offset + resolvedButtonSize;
            const maxBottom = resolvedViewportHeight - bottomInset;
            if (listBottom > maxBottom) {
                offsetY = maxBottom - listBottom;
            }
        }
    }

    const resolvedAlignment: FabAlignment = {
        v: alignment.v,
        h: getHorizontalAlignment(resolvedPosition, resolvedButtonSize),
    };

    return {
        position: resolvedPosition,
        alignment: resolvedAlignment,
        listOffset: { x: 0, y: offsetY },
        columnCount,
        itemsPerColumn,
        columnGap,
    };
};
