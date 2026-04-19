/**
 * ActiveModifierBadge 组件
 *
 * 当攻击修正卡（timing: 'roll'）被打出后，在骰子区域上方显示一个小徽章，
 * 提示玩家该卡效果将在伤害结算时触发。鼠标悬浮显示每张卡的名称和效果描述。
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';
import { InfoTooltip } from '../../../components/common/overlays/InfoTooltip';
import type { ActiveModifier } from '../hooks/useActiveModifiers';

interface ActiveModifierBadgeProps {
    modifiers: ActiveModifier[];
    bonusDamage?: number;
}

export const ActiveModifierBadge: React.FC<ActiveModifierBadgeProps> = ({ modifiers, bonusDamage = 0 }) => {
    const { t } = useTranslation('game-dicethrone');
    const [isHovered, setIsHovered] = useState(false);

    if (modifiers.length === 0) return null;
    const hasBonusDamage = bonusDamage > 0;
    const badgeLabel = hasBonusDamage ? t('modifierActive.label') : t('modifierActive.shortLabel');
    const badgeValue = hasBonusDamage
        ? `+${bonusDamage}`
        : modifiers.length > 1 ? `×${modifiers.length}` : '';

    const tooltipContent = modifiers.map((mod) => {
        const name = t(mod.nameKey);
        const desc = mod.descriptionKey ? t(mod.descriptionKey) : '';
        return (
            <span key={mod.cardId + mod.timestamp}>
                <span className="text-amber-300 font-semibold">{name}</span>
                {desc && <span className="text-slate-400"> — {desc}</span>}
            </span>
        );
    });

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.9 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="pointer-events-auto relative"
                data-testid="active-modifier-badge"
                data-bonus-damage={bonusDamage}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className="flex h-[1.9vw] items-center justify-center gap-[0.4vw] px-[0.78vw] rounded-full bg-gradient-to-r from-amber-900/90 to-orange-900/90 border border-amber-500/50 shadow-[0_0_1vw_rgba(245,158,11,0.3)] backdrop-blur-sm cursor-default">
                    <Zap className="w-[0.82vw] h-[0.82vw] text-amber-400 fill-amber-400" />
                    <div className="flex items-center gap-[0.28vw] whitespace-nowrap leading-none">
                        <span className="text-amber-100/90 text-[0.62vw] font-semibold tracking-[0.08em] uppercase">
                            {badgeLabel}
                        </span>
                        {badgeValue && (
                            <span className="text-amber-200 text-[0.78vw] font-black tracking-wide">
                                {badgeValue}
                            </span>
                        )}
                    </div>
                </div>
                <InfoTooltip
                    title={t('modifierActive.tooltip')}
                    content={tooltipContent}
                    isVisible={isHovered}
                    position="left"
                />
            </motion.div>
        </AnimatePresence>
    );
};
