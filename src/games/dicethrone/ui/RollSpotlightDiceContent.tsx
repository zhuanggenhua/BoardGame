/**
 * Roll spotlight dice content
 *
 * Pure content component (no backdrop, no confirm button).
 * Used by compare-roll style showcases only; bonus/temporary dice
 * confirmation is owned by the right-side 2D dice tray.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { DieFace } from '../types';
import { Dice2D } from './Dice2D';
import { resolveBonusDieText } from './bonusDieTranslation';
import { useResultRevealAnimation } from '../../../hooks/ui/useResultRevealAnimation';

interface RollSpotlightDiceContentProps {
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
    /** 首次挂载时是否播放滚动动画 */
    animateOnMount?: boolean;
    /** 表现事件身份；变化时即使结果值相同也重新播放揭示动画 */
    presentationKey?: string | number;
    /** 骰子资源所属角色（用于图集选择） */
    characterId?: string;
    /** 是否为紧凑模式（多骰场景，文字变小） */
    compact?: boolean;
    /** 是否隐藏效果文案（多骰紧凑排版避免撑爆宽度） */
    hideEffectText?: boolean;
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

export const RollSpotlightDiceContent: React.FC<RollSpotlightDiceContentProps> = ({
    value,
    face: propFace,
    effectKey,
    effectParams,
    locale,
    size = '8vw',
    rollingDurationMs = 800,
    animateOnMount = true,
    presentationKey,
    characterId = 'monk',
    compact = false,
    hideEffectText = false,
}) => {

    const { t, i18n } = useTranslation('game-dicethrone');
    const face = propFace || 'fist';
    const { isRevealing: isRolling } = useResultRevealAnimation({
        value,
        presentationKey,
        durationMs: rollingDurationMs,
        animateOnMount,
    });

    // 获取翻译后的效果文本
    const effectText = React.useMemo(() => {
        if (!effectKey) return null;
        return resolveBonusDieText(effectKey, { t, i18n }, effectParams, face);
    }, [t, i18n, effectKey, effectParams, face]);
    const shouldRenderEffectText = !hideEffectText && Boolean(effectText);
    const definitionId = characterId ? `${characterId}-dice` : undefined;

    return (
        <div
            className="flex flex-col items-center gap-[1.5vw]"
            data-testid="roll-spotlight-dice-content"
            data-presentation-key={presentationKey ?? ''}
            data-animate-on-mount={animateOnMount ? 'true' : 'false'}
            data-is-rolling={isRolling ? 'true' : 'false'}
        >
            <div className="relative">
                <Dice2D
                    value={value}
                    isRolling={isRolling}
                    size={size}
                    locale={locale}
                    characterId={characterId}
                    definitionId={definitionId}
                />
            </div>

            <AnimatePresence>
                {!isRolling && shouldRenderEffectText && effectText && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`text-white font-black italic tracking-wider whitespace-nowrap bg-black/60 px-[1.5vw] py-[0.4vw] rounded-full border border-white/20 shadow-lg ${
                            compact ? 'text-[1.2vw]' : 'text-[1.8vw]'
                        }`}
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

export default RollSpotlightDiceContent;
