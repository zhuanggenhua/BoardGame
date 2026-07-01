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
import { resolveBonusDieText } from './bonusDieTranslation';
import { useResultRevealAnimation } from '../../../hooks/ui/useResultRevealAnimation';
import {
    buildSpriteBackgroundImage,
    DICE_BG_SIZE,
    getBonusFaceLabel,
    getDiceSpriteAssetPath,
    getDiceSpritePosition,
} from './assets';

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

export const BonusDieSpotlightContent: React.FC<BonusDieSpotlightContentProps> = ({
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
    const spriteAssetPath = React.useMemo(
        () => getDiceSpriteAssetPath(definitionId, characterId),
        [characterId, definitionId],
    );
    const spriteBackgroundImage = React.useMemo(
        () => buildSpriteBackgroundImage(spriteAssetPath, locale),
        [locale, spriteAssetPath],
    );
    const spritePosition = React.useMemo(() => getDiceSpritePosition(value), [value]);
    const faceLabel = React.useMemo(
        () => getBonusFaceLabel(value, t as (key: string, options?: Record<string, string | number>) => string, { face, definitionId }),
        [definitionId, face, t, value],
    );
    const resolvedSize = size.startsWith('clamp(') || size.startsWith('min(') || size.startsWith('max(')
        ? size
        : `clamp(72px, ${size}, 176px)`;

    return (
        <div
            className="flex flex-col items-center gap-[1.5vw]"
            data-testid="bonus-die-spotlight-content"
            data-presentation-key={presentationKey ?? ''}
            data-animate-on-mount={animateOnMount ? 'true' : 'false'}
            data-is-rolling={isRolling ? 'true' : 'false'}
        >
            <div className="relative">
                <motion.div
                    data-testid="bonus-die-spotlight-face"
                    initial={animateOnMount ? { rotate: -8, scale: 0.88 } : false}
                    animate={isRolling
                        ? {
                            rotate: [0, 12, -10, 8, -6, 0],
                            scale: [1, 0.96, 1.02, 0.98, 1],
                            y: [0, -8, 4, -3, 0],
                        }
                        : {
                            rotate: 0,
                            scale: 1,
                            y: 0,
                        }}
                    transition={isRolling
                        ? {
                            duration: Math.max(rollingDurationMs / 1000, 0.55),
                            ease: 'easeInOut',
                            times: [0, 0.18, 0.38, 0.62, 0.82, 1],
                        }
                        : {
                            duration: 0.24,
                            ease: 'easeOut',
                        }}
                    className="relative overflow-hidden rounded-[1.2vw] border border-white/25 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.3),_rgba(255,255,255,0.06)_45%,_rgba(10,14,24,0.92)_100%)] shadow-[0_1.2vw_2.4vw_rgba(0,0,0,0.42)]"
                    style={{
                        width: resolvedSize,
                        height: resolvedSize,
                    }}
                >
                    <div
                        className="absolute inset-[7%] rounded-[1vw] border border-white/12 bg-white"
                        style={{
                            backgroundImage: spriteBackgroundImage,
                            backgroundSize: DICE_BG_SIZE,
                            backgroundPosition: `${spritePosition.xPos}% ${spritePosition.yPos}%`,
                            backgroundRepeat: 'no-repeat',
                        }}
                    />
                    <div className="pointer-events-none absolute inset-x-[12%] top-[10%] h-[18%] rounded-full bg-white/40 blur-[0.35vw]" />
                    <div className="pointer-events-none absolute inset-[5%] rounded-[1.05vw] shadow-[inset_0_-0.4vw_0.8vw_rgba(15,23,42,0.22)]" />
                    <span className="sr-only">{faceLabel}</span>
                </motion.div>
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


export default BonusDieSpotlightContent;
