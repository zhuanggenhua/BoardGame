/**
 * 资源托盘骨架组件
 *
 * 纯逻辑组件，无默认样式。用于骰子、棋子、token 等资源的展示与交互。
 */

import { memo, useCallback } from 'react';
import type { ResourceTraySkeletonProps } from './types';

/**
 * 获取资源项 ID（支持多种类型）
 */
function getItemId<TItem>(item: TItem, index: number): string | number {
    if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        if ('id' in obj) return obj.id as string | number;
        if ('key' in obj) return obj.key as string | number;
    }
    return index;
}

/**
 * 资源托盘骨架
 *
 * @example
 * ```tsx
 * <ResourceTraySkeleton
 *   items={dice}
 *   canInteract={true}
 *   onItemClick={(id) => toggleLock(id)}
 *   renderItem={(die, index) => (
 *     <Die3D value={die.value} isLocked={die.isLocked} />
 *   )}
 *   layout="row"
 * />
 * ```
 */
export const ResourceTraySkeleton = memo(function ResourceTraySkeleton<TItem>({
    items,
    canInteract = true,
    onItemClick,
    onItemToggle,
    renderItem,
    className,
    layout = 'row',
    gridColumns,
}: ResourceTraySkeletonProps<TItem>) {
    const handleClick = useCallback(
        (itemId: string | number) => {
            if (!canInteract) return;
            onItemClick?.(itemId);
        },
        [canInteract, onItemClick]
    );

    const handleToggle = useCallback(
        (itemId: string | number) => {
            if (!canInteract) return;
            onItemToggle?.(itemId);
        },
        [canInteract, onItemToggle]
    );

    // 计算布局样式属性
    const layoutStyles: React.CSSProperties = layout === 'grid' && gridColumns
        ? { gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }
        : {};

    return (
        <div
            className={className}
            data-layout={layout}
            data-can-interact={canInteract}
            style={layoutStyles}
            role="list"
            aria-label="Resource tray"
        >
            {items.map((item, index) => {
                const itemId = getItemId(item, index);
                return (
                    <div
                        key={itemId}
                        role="listitem"
                        data-item-id={itemId}
                        onClick={() => handleClick(itemId)}
                        onDoubleClick={() => handleToggle(itemId)}
                        style={{ cursor: canInteract ? 'pointer' : 'default' }}
                    >
                        {renderItem(item, index)}
                    </div>
                );
            })}
        </div>
    );
}) as <TItem>(props: ResourceTraySkeletonProps<TItem>) => React.ReactElement;

export default ResourceTraySkeleton;
