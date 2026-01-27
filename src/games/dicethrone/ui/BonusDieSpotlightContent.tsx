/**
 * Bonus die spotlight content
 *
 * Pure content component (no backdrop, no confirm button).
 * Handles rolling -> settle animation timing.
 */

import React from 'react';
import type { DieFace } from '../types';
import { Dice3D } from './Dice3D';

interface BonusDieSpotlightContentProps {
    value: number;
    face?: DieFace;
    locale?: string;
    /** Dice size (css value), default 8vw */
    size?: string;
    /** Rolling duration in ms, default 800 */
    rollingDurationMs?: number;
}

/** Die face glow colors */
const FACE_GLOW_COLORS: Record<DieFace, string> = {
    fist: 'rgba(248,113,113,0.5)',
    palm: 'rgba(96,165,250,0.5)',
    taiji: 'rgba(192,132,252,0.5)',
    lotus: 'rgba(52,211,153,0.5)',
};

export const BonusDieSpotlightContent: React.FC<BonusDieSpotlightContentProps> = ({
    value,
    face: propFace,
    locale,
    size = '8vw',
    rollingDurationMs = 800,
}) => {
    const [isRolling, setIsRolling] = React.useState(true);
    const face = propFace || 'fist';

    React.useEffect(() => {
        setIsRolling(true);
        const stopRolling = setTimeout(() => {
            setIsRolling(false);
        }, rollingDurationMs);
        return () => clearTimeout(stopRolling);
    }, [value, rollingDurationMs]);

    return (
        <div className="relative">
            <Dice3D
                value={value}
                isRolling={isRolling}
                size={size}
                locale={locale}
                variant="spotlight"
            />
            {!isRolling && (
                <div
                    className="absolute inset-[-0.8vw] rounded-[1.2vw] animate-pulse pointer-events-none"
                    style={{ boxShadow: `0 0 2vw 0.8vw ${FACE_GLOW_COLORS[face]}` }}
                />
            )}
        </div>
    );
};

export default BonusDieSpotlightContent;