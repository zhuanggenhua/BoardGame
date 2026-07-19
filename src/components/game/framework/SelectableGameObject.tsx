import React from 'react';

export interface SelectableGameObjectProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    selected?: boolean;
    available?: boolean;
}

export const SelectableGameObject = React.forwardRef<HTMLButtonElement, SelectableGameObjectProps>(({
    selected = false,
    available = false,
    disabled = false,
    className = '',
    children,
    ...buttonProps
}, ref) => (
    <button
        ref={ref}
        type="button"
        disabled={disabled}
        aria-pressed={selected}
        data-game-object-selected={selected ? 'true' : undefined}
        data-game-object-available={available && !disabled ? 'true' : undefined}
        className={`relative overflow-visible outline-none transition-[transform,filter,box-shadow] duration-200 focus-visible:ring-4 focus-visible:ring-white/90 disabled:cursor-not-allowed disabled:opacity-50 ${selected
            ? 'ring-4 ring-green-400 shadow-[0_0_20px_rgba(74,222,128,0.5)]'
            : available && !disabled
                ? 'ring-2 ring-green-500/35 shadow-[0_0_12px_rgba(34,197,94,0.22)] hover:ring-green-300/90 hover:shadow-[0_0_18px_rgba(74,222,128,0.38)]'
                : ''} ${className}`}
        {...buttonProps}
    >
        {children}
    </button>
));

SelectableGameObject.displayName = 'SelectableGameObject';
