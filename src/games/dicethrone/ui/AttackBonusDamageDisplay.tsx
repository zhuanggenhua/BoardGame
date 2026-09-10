/**
 * AttackBonusDamageDisplay 组件
 *
 * 在攻击阶段显示当前攻击或待发起攻击的伤害加成
 * 位置：骰子区域正上方，与 ActiveModifierBadge 同排显示
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords } from 'lucide-react';
import { buildBoardShellInlineUnitValue } from '../../../shared/runtimeLayoutUnits';

const dtUnit = buildBoardShellInlineUnitValue;

interface AttackBonusDamageDisplayProps {
    bonusDamage: number;
}

export const AttackBonusDamageDisplay: React.FC<AttackBonusDamageDisplayProps> = ({ bonusDamage }) => {
    const { t } = useTranslation('game-dicethrone');

    if (bonusDamage <= 0) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.9 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="pointer-events-auto"
                data-testid="attack-modifier-bonus-badge"
            >
                <div
                    className="flex items-center justify-center rounded-full bg-gradient-to-r from-red-900/90 to-orange-900/90 border border-red-500/50 backdrop-blur-sm"
                    style={{
                        height: dtUnit(1.65),
                        gap: dtUnit(0.4),
                        paddingInline: dtUnit(0.8),
                        boxShadow: `0 0 ${dtUnit(1)} rgba(239,68,68,0.4)`,
                    }}
                >
                    <Swords className="text-red-400" style={{ width: dtUnit(0.9), height: dtUnit(0.9) }} />
                    <span className="text-red-200 font-bold tracking-wide whitespace-nowrap leading-none" style={{ fontSize: dtUnit(0.72) }}>
                        {t('attackBonus.label', { damage: bonusDamage })}
                    </span>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
