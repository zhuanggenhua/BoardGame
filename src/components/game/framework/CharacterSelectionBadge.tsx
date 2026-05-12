import React from 'react';
import clsx from 'clsx';
import type { CharacterBadgeDef } from '../../../core/ui/CharacterSelection.types';

type InlineUnit = (value: number) => string;

export interface CharacterSelectionBadgeProps {
    badge: CharacterBadgeDef;
    label: string;
    inlineUnit: InlineUnit;
    testId: string;
}

const getStandardToneClassName = (badge: CharacterBadgeDef) => {
    switch (badge.tone) {
        case 'info':
            return 'border-y-[2px] px-4 py-1 border-sky-300/55 bg-sky-500/85 text-white';
        case 'success':
            return 'border-y-[2px] px-4 py-1 border-emerald-300/55 bg-emerald-500/85 text-white';
        case 'danger':
            return 'border-y-[2px] px-4 py-1 border-rose-300/55 bg-rose-500/85 text-white';
        case 'neutral':
            return 'border-y-[2px] px-4 py-1 border-slate-200/45 bg-slate-500/80 text-white';
        default:
            return 'border-y-[2px] px-4 py-1 border-slate-950 bg-[#f4ecd0] text-slate-950';
    }
};

export const CharacterSelectionBadge: React.FC<CharacterSelectionBadgeProps> = ({
    badge,
    label,
    inlineUnit,
    testId,
}) => {
    if (badge.tone !== 'warning') {
        return (
            <span
                data-testid={testId}
                className={clsx(
                    'absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 rotate-[-14deg] items-center justify-center font-black uppercase shadow-lg backdrop-blur-sm',
                    getStandardToneClassName(badge),
                )}
                style={{
                    width: '188%',
                    fontSize: inlineUnit(0.52),
                    lineHeight: 1.1,
                    letterSpacing: inlineUnit(0.025),
                }}
            >
                {label}
            </span>
        );
    }

    return (
        <span
            data-testid={testId}
            className="absolute left-1/2 top-1/2 block"
            style={{
                width: '188%',
                transform: 'translate(-50%, -50%) rotate(-14deg)',
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
                    className="absolute bottom-0 top-0 flex items-center justify-center text-center font-black uppercase"
                    style={{
                        left: '50%',
                        width: '54%',
                        transform: 'translateX(-50%)',
                        paddingLeft: inlineUnit(0.9),
                        paddingRight: inlineUnit(0.9),
                        zIndex: 1,
                        fontSize: inlineUnit(0.72),
                        lineHeight: 1,
                        letterSpacing: inlineUnit(0.03),
                        color: '#ffffff',
                        textShadow: '0 1px 3px rgba(0, 0, 0, 0.85)',
                        WebkitTextStroke: '0.7px rgba(0, 0, 0, 0.75)',
                    }}
                >
                    {label}
                </span>
            </span>
        </span>
    );
};
