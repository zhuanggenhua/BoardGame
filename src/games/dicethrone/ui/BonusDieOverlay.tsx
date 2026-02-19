/**
 * 额外骰子特写组件
 *
 * 无遮罩、无虚化背景，用于显示额外投掷的骰子结果。
 * 支持重掷交互模式（雷霆一击 II / 风暴突袭）。
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import type { DieFace, BonusDieInfo } from '../domain/types';
import SpotlightContainer from './SpotlightContainer';
import BonusDieSpotlightContent from './BonusDieSpotlightContent';
import { GameButton } from './components/GameButton';
import { UI_Z_INDEX } from '../../../core';

interface BonusDieOverlayProps {
    /** 单颗骰子值 (1-6)，用于普通特写模式 */
    value?: number;
    /** 骰面符号 */
    face?: DieFace;
    /** 效果描述 key */
    effectKey?: string;
    /** 效果描述参数 */
    effectParams?: Record<string, string | number>;
    /** 是否显示 */
    isVisible: boolean;
    /** 关闭回调 */
    onClose: () => void;
    /** 语言 */
    locale?: string;
    /** 自动关闭延迟（毫秒），默认 3000 */
    autoCloseDelay?: number;
    
    // ===== 重掷交互模式 =====
    /** 奖励骰列表（多颗重掷模式） */
    bonusDice?: BonusDieInfo[];
    /** 是否可以重掷（有足够 Token） */
    canReroll?: boolean;
    /** 重掷回调 */
    onReroll?: (dieIndex: number) => void;
    /** 跳过重掷回调 */
    onSkipReroll?: () => void;
    /** 显示总和 */
    showTotal?: boolean;
    /** 重掷消耗数量 */
    rerollCostAmount?: number;
    /** 重掷消耗 Token ID（用于显示名称） */
    rerollCostTokenId?: string;
    /** 仅展示模式（无重掷，仅显示骰子结果） */
    displayOnly?: boolean;
    /** 骰子所属角色（用于图集选择） */
    characterId?: string;
}

export const BonusDieOverlay: React.FC<BonusDieOverlayProps> = ({
    value,
    face,
    effectKey,
    effectParams,
    isVisible,
    onClose,
    locale,
    autoCloseDelay = 3000,
    bonusDice,
    canReroll,
    onReroll,
    onSkipReroll,
    showTotal = false,
    rerollCostAmount,
    rerollCostTokenId,
    displayOnly,
    characterId,
}) => {
    const { t } = useTranslation('game-dicethrone');
    const isRerollMode = Boolean(bonusDice && bonusDice.length > 0 && (onReroll || displayOnly));
    const costAmount = rerollCostAmount ?? 1;
    const tokenName = rerollCostTokenId ? t(`tokens.${rerollCostTokenId}.name`) : t('tokens.taiji.name');

    if (!isVisible) return null;

    // 重掷交互模式：显示多颗骰子
    if (isRerollMode && bonusDice) {
        const total = bonusDice.reduce((sum, d) => sum + d.value, 0);
        // displayOnly 模式：允许自动关闭和点击背景关闭（防御方/观察者视角）
        const isInteractive = !displayOnly;

        return (
            <SpotlightContainer
                id="bonus-dice-reroll"
                isVisible={isVisible}
                onClose={onClose}
                disableAutoClose={isInteractive}
                disableBackdropClose={isInteractive}
                autoCloseDelay={displayOnly ? 5000 : 3000}
                zIndex={UI_Z_INDEX.overlayRaised + 100}
            >
                <div className="flex flex-col items-center gap-[1.5vw]">
                    {/* 提示文字 - DiceThrone 风格 */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-black/60 border border-amber-400/30 rounded-xl px-[2.5vw] py-[0.8vw] shadow-lg"
                    >
                        <span className="text-white text-[1.4vw] font-bold tracking-wide">
                            {displayOnly
                                ? t('bonusDie.diceResult')
                                : canReroll
                                    ? t('bonusDie.selectToReroll', { cost: costAmount, token: tokenName })
                                    : t('bonusDie.noTokenToReroll', { token: tokenName })}
                        </span>
                    </motion.div>

                    {/* 骰子列表 */}
                    <div className="flex gap-[2vw]">
                        {bonusDice.map((die) => (
                            <motion.div
                                key={die.index}
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: die.index * 0.15 }}
                                className={`relative ${
                                    canReroll
                                        ? 'cursor-pointer hover:scale-110 transition-transform'
                                        : ''
                                }`}
                                onClick={() => canReroll && onReroll?.(die.index)}
                            >
                                <BonusDieSpotlightContent
                                    value={die.value}
                                    face={die.face}
                                    effectKey={die.effectKey}
                                    locale={locale}
                                    size="7vw"
                                    rollingDurationMs={600 + die.index * 100}
                                    characterId={characterId}
                                />
                                {canReroll && (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                        <div className="bg-amber-600/80 rounded-full p-[0.5vw] border border-amber-300/50 shadow-[0_0_12px_rgba(245,158,11,0.4)]">
                                            <svg className="w-[2vw] h-[2vw] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>

                    {/* 总和显示 */}
                    {showTotal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="text-white text-[2vw] font-black tracking-wider"
                            style={{ textShadow: '0 0 0.8vw rgba(245,158,11,0.5)' }}
                        >
                            {t('bonusDie.total')}: {total}
                            {total >= 12 && (
                                <span className="ml-[1vw] text-red-400">
                                    ({t('bonusDie.knockdownTrigger')})
                                </span>
                            )}
                        </motion.div>
                    )}

                    {/* 操作按钮 - 使用 GameButton 保持风格一致 */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                    >
                        <GameButton
                            onClick={displayOnly ? (onSkipReroll ?? onClose) : onSkipReroll}
                            variant={canReroll ? 'primary' : 'secondary'}
                            size="md"
                            className="!text-[1.1vw] !px-[2.5vw] !py-[0.8vw]"
                        >
                            {displayOnly
                                ? t('bonusDie.continue')
                                : canReroll ? t('bonusDie.confirmDamage') : t('bonusDie.continue')}
                        </GameButton>
                    </motion.div>
                </div>
            </SpotlightContainer>
        );
    }

    // 普通单颗骰子特写模式
    if (value === undefined) return null;

    return (
        <SpotlightContainer
            id={`bonus-die-${value}`}
            isVisible={isVisible}
            onClose={onClose}
            autoCloseDelay={autoCloseDelay}
            zIndex={UI_Z_INDEX.overlayRaised + 100}
        >
            <BonusDieSpotlightContent
                value={value}
                face={face}
                effectKey={effectKey}
                effectParams={effectParams}
                locale={locale}
                size="8vw"
                characterId={characterId}
            />
        </SpotlightContainer>
    );
};


export default BonusDieOverlay;
