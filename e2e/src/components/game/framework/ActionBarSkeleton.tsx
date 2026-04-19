/**
 * 操作栏骨架组件
 *
 * 纯逻辑组件，无默认样式。通过 renderAction 函数渲染按钮。
 */

import { memo, type CSSProperties } from 'react';
import type { ActionBarSkeletonProps } from './types';

const resolveJustifyContent = (align?: ActionBarSkeletonProps['align']): CSSProperties['justifyContent'] => {
    if (align === 'start') return 'flex-start';
    if (align === 'end') return 'flex-end';
    if (align === 'space-between') return 'space-between';
    return 'center';
};

export const ActionBarSkeleton = memo(function ActionBarSkeleton({
    actions,
    layout = 'row',
    align = 'center',
    gap = 8,
    className,
    renderAction,
    onAction,
}: ActionBarSkeletonProps) {
    type ActionItem = ActionBarSkeletonProps['actions'][number];

    const handleClick = (action: ActionItem) => {
        onAction?.(action);
    };

    const render = renderAction
        ?? ((action: ActionItem, onClick: () => void) => (
            <button type="button" onClick={onClick}>
                {action.label}
            </button>
        ));

    const style: CSSProperties = {
        display: 'flex',
        flexDirection: layout === 'column' ? 'column' : 'row',
        justifyContent: resolveJustifyContent(align),
        alignItems: 'center',
        gap,
    };

    return (
        <div
            className={className}
            style={style}
            data-component="action-bar"
            data-layout={layout}
        >
            {actions.map((action, index) => {
                const onClick = () => handleClick(action);
                return (
                    <div key={action.id} data-action-id={action.id} data-index={index}>
                        {render(action, onClick, index)}
                    </div>
                );
            })}
        </div>
    );
});

export default ActionBarSkeleton;
