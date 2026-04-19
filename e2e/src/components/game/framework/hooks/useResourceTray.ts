/**
 * useResourceTray - 资源托盘交互逻辑 Hook
 *
 * 封装骰子、棋子、token 等资源的点击和选择逻辑。
 */

import { useState, useCallback } from 'react';
import { useInteractionGuard } from '../InteractionGuard';
import type { UseResourceTrayReturn } from '../../../../core/ui/hooks';

export interface UseResourceTrayConfig<TItem> {
    /** 资源项列表 */
    items: TItem[];
    /** 获取资源项 ID 的函数 */
    getItemId: (item: TItem, index: number) => string | number;
    /** 是否允许多选 */
    multiSelect?: boolean;
    /** 是否可交互 */
    canInteract?: boolean;
    /** 点击回调 */
    onItemClick?: (itemId: string | number) => void;
    /** 切换回调（如锁定/解锁） */
    onItemToggle?: (itemId: string | number) => void;
}

/**
 * 资源托盘交互逻辑
 *
 * @example
 * ```tsx
 * const {
 *   items,
 *   selectedItemId,
 *   handleItemClick,
 *   handleItemToggle,
 * } = useResourceTray({
 *   items: dice,
 *   getItemId: (die) => die.id,
 *   onItemClick: (id) => console.log('clicked', id),
 *   onItemToggle: (id) => toggleLock(id),
 * });
 * ```
 */
export function useResourceTray<TItem>(
    config: UseResourceTrayConfig<TItem>
): UseResourceTrayReturn<TItem> {
    const { items, multiSelect = false, canInteract = true, onItemClick, onItemToggle } = config;
    const [selectedItemId, setSelectedItemId] = useState<string | number | null>(null);
    const guard = useInteractionGuard();

    const handleItemClick = useCallback(
        (itemId: string | number) => {
            if (!canInteract) {
                guard.notifyDenied('resource-tray-click-disabled', { key: 'resource-tray-click-disabled' });
                return;
            }
            // 更新选中状态
            if (multiSelect) {
                // 多选模式下切换选中
                setSelectedItemId(prev => (prev === itemId ? null : itemId));
            } else {
                // 单选模式
                setSelectedItemId(itemId);
            }

            // 调用外部回调
            onItemClick?.(itemId);
        },
        [canInteract, guard, multiSelect, onItemClick]
    );

    const handleItemToggle = useCallback(
        (itemId: string | number) => {
            if (!canInteract) {
                guard.notifyDenied('resource-tray-toggle-disabled', { key: 'resource-tray-toggle-disabled' });
                return;
            }
            onItemToggle?.(itemId);
        },
        [canInteract, guard, onItemToggle]
    );

    return {
        items,
        selectedItemId,
        handleItemClick,
        handleItemToggle,
    };
}

export default useResourceTray;
