/**
 * Bonus die spotlight content
 *
 * Pure content component (no backdrop, no confirm button).
 * Handles rolling -> settle animation timing.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { DieFace } from '../types';
import { Dice3D } from './Dice3D';

interface BonusDieSpotlightContentProps {
    value: number;
    face?: DieFace;

    /** 效果描述 key */
    effectKey?: string;
    /** 效果描述参数 */
    effectParams?: Record<string, string | number>;
    locale?: string;
    /** Dice size (css value), default 8vw */
    size?: string;
    /** Rolling duration in ms, default 800 */
    rollingDurationMs?: number;
    /** 骰子资源所属角色（用于图集选择） */
    characterId?: string;
}

/** Die face glow colors */
const FACE_GLOW_COLORS: Record<DieFace, string> = {
    fist: 'rgba(248,113,113,0.5)',
    palm: 'rgba(96,165,250,0.5)',
    taiji: 'rgba(192,132,252,0.5)',
    lotus: 'rgba(52,211,153,0.5)',
    sword: 'rgba(148,163,184,0.5)',
    helm: 'rgba(251,191,36,0.5)',
    heart: 'rgba(244,63,94,0.5)',
    pray: 'rgba(250,204,21,0.5)',
    strength: 'rgba(245,158,11,0.5)',
    fire: 'rgba(239,68,68,0.5)',
    fiery_soul: 'rgba(244,114,182,0.5)',
    magma: 'rgba(249,115,22,0.5)',
    meteor: 'rgba(251,146,60,0.5)',
    bow: 'rgba(56,189,248,0.5)',
    foot: 'rgba(59,130,246,0.5)',
    moon: 'rgba(129,140,248,0.5)',
    dagger: 'rgba(100,116,139,0.5)',
    bag: 'rgba(250,204,21,0.5)',
    card: 'rgba(16,185,129,0.5)',
    shadow: 'rgba(139,92,246,0.5)',
};

export const BonusDieSpotlightContent: React.FC<BonusDieSpotlightContentProps> = ({
    value,
    face: propFace,
    effectKey,
    effectParams,
    locale,
    size = '8vw',
    rollingDurationMs = 800,
    characterId = 'monk',
}) => {

    const { t } = useTranslation('game-dicethrone');
    const [isRolling, setIsRolling] = React.useState(true);
    const face = propFace || 'fist';

    React.useEffect(() => {
        setIsRolling(true);
        const stopRolling = setTimeout(() => {
            setIsRolling(false);
        }, rollingDurationMs);
        return () => clearTimeout(stopRolling);
    }, [value, rollingDurationMs]);

    // 获取翻译后的效果文本
    const effectText = React.useMemo(() => {
        if (!effectKey) return null;
        return t(effectKey, effectParams);
    }, [t, effectKey, effectParams]);

    return (
        <div className="flex flex-col items-center gap-[1.5vw]">
            <div className="relative">
                <Dice3D
                    value={value}
                    isRolling={isRolling}
                    size={size}
                    locale={locale}
                    variant="spotlight"
                    characterId={characterId}
                />
                {!isRolling && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute inset-[-0.8vw] rounded-[1.2vw] animate-pulse pointer-events-none"
                        style={{ boxShadow: `0 0 2.5vw 1vw ${FACE_GLOW_COLORS[face]}` }}
                    />
                )}
            </div>

            <AnimatePresence>
                {!isRolling && effectText && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-white text-[1.8vw] font-black italic tracking-wider whitespace-nowrap bg-black/60 px-[1.5vw] py-[0.4vw] rounded-full border border-white/20 shadow-lg"
                        style={{
                            textShadow: `0 0 1vw ${FACE_GLOW_COLORS[face]}`,
                        }}
                    >
                        {effectText}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};


export default BonusDieSpotlightContent;