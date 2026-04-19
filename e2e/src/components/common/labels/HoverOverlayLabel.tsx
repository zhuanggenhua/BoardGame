import React from 'react';

export interface HoverOverlayLabelProps {
    text: string;
    hoverTextClass?: string;
    hoverBorderClass?: string;
}

export function HoverOverlayLabel({
    text,
    hoverTextClass,
    hoverBorderClass,
}: HoverOverlayLabelProps): React.ReactElement {
    return (
        <>
            <span className="relative z-10">{text}</span>
            {hoverTextClass && (
                <span
                    aria-hidden
                    className={`absolute inset-0 flex items-center justify-center ${hoverTextClass} opacity-0 transition-opacity duration-200 group-hover:opacity-100`}
                >
                    {text}
                </span>
            )}
            {hoverBorderClass && (
                <span
                    aria-hidden
                    className={`pointer-events-none absolute inset-0 rounded-full border ${hoverBorderClass} opacity-0 transition-opacity duration-200 group-hover:opacity-100`}
                />
            )}
        </>
    );
}
