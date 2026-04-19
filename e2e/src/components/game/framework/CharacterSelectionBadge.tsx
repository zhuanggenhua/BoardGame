import React from 'react';
import clsx from 'clsx';
import type { CharacterBadgeDef } from '../../../core/ui/CharacterSelection.types';

type InlineUnit = (value: number) => string;

export interface CharacterSelectionBadgeProps {
    badge: CharacterBadgeDef;
    label: string;
    inlineUnit: InlineUnit;
    testId: string;
    mode?: 'pill' | 'overlay';
}

const getStandardToneClassName = (badge: CharacterBadgeDef, mode: 'pill' | 'overlay') => {
    const shapeClassName = mode === 'overlay'
        ? 'border-y-[2px] px-4 py-1'
        : 'rounded-full px-3 py-1';

    switch (badge.tone) {
        case 'info':
            return `${shapeClassName} border border-sky-300/55 bg-sky-500/85 text-white`;
        case 'success':
            return `${shapeClassName} border border-emerald-300/55 bg-emerald-500/85 text-white`;
        case 'danger':
            return `${shapeClassName} border border-rose-300/55 bg-rose-500/85 text-white`;
        case 'neutral':
            return `${shapeClassName} border border-slate-200/45 bg-slate-500/80 text-white`;
        default:
            return `${shapeClassName} border border-slate-950 bg-[#f4ecd0] text-slate-950`;
    }
};

export const CharacterSelectionBadge: React.FC<CharacterSelectionBadgeProps> = ({
    badge,
    label,
    inlineUnit,
    testId,
    mode = 'pill',
}) => {
    if (badge.tone !== 'warning') {
        return (
            <span
                data-testid={testId}
                className={clsx(
                    'inline-flex items-center justify-center font-black uppercase shadow-lg backdrop-blur-sm',
                    getStandardToneClassName(badge, mode),
                )}
                style={{
                    fontSize: inlineUnit(mode === 'overlay' ? 0.52 : 0.38),
                    lineHeight: 1.1,
                    letterSpacing: inlineUnit(mode === 'overlay' ? 0.025 : 0.01),
                }}
            >
                {label}
            </span>
        );
    }

    const isOverlay = mode === 'overlay';

    if (!isOverlay) {
        return (
            <span
                data-testid={testId}
                className="relative inline-flex items-center justify-center overflow-hidden rounded-full border-2 border-black font-black uppercase text-black"
                style={{
                    minWidth: inlineUnit(4.95),
                    minHeight: inlineUnit(0.98),
                    paddingLeft: inlineUnit(0.7),
                    paddingRight: inlineUnit(0.7),
                    paddingTop: inlineUnit(0.11),
                    paddingBottom: inlineUnit(0.11),
                    backgroundColor: '#facc15',
                }}
            >
                <span
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{
                        backgroundImage:
                            'repeating-linear-gradient(135deg, rgba(10,10,10,0.92) 0 9px, rgba(10,10,10,0.92) 9px 13px, rgba(250,204,21,0) 13px 24px)',
                    }}
                />
                <span
                    className="relative z-10 text-center font-black uppercase"
                    style={{
                        fontSize: inlineUnit(0.41),
                        lineHeight: 1,
                        letterSpacing: inlineUnit(0.018),
                    }}
                >
                    {label}
                </span>
            </span>
        );
    }

    return (
        <span
            data-testid={testId}
            className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2"
            style={{
                width: '188%',
                transform: 'rotate(-14deg)',
            }}
        >
            <span
                className="relative block overflow-hidden border-y-[3px] border-black"
                style={{
                    width: '100%',
                    minHeight: inlineUnit(1.74),
                    backgroundColor: '#facc15',
                }}
            >
                <span
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{
                        backgroundImage:
                            'repeating-linear-gradient(135deg, #111111 0 18px, #111111 18px 28px, #facc15 28px 48px)',
                    }}
                />
                <span
                    className="absolute inset-0 flex items-center justify-center text-center font-black uppercase"
                    style={{
                        paddingLeft: inlineUnit(0.9),
                        paddingRight: inlineUnit(0.9),
                        fontSize: inlineUnit(0.56),
                        lineHeight: 1,
                        letterSpacing: inlineUnit(0.03),
                        color: 'transparent',
                        backgroundImage:
                            'repeating-linear-gradient(135deg, #facc15 0 18px, #facc15 18px 28px, #111111 28px 48px)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}
                >
                    {label}
                </span>
            </span>
        </span>
    );
};
