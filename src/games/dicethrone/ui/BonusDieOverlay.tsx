/**
 * 额外骰子特写组件
 *
 * 无遮罩、无虚化背景，用于显示额外投掷的骰子结果。
 * 支持重掷交互模式（雷霆一击 II / 风暴突袭）。
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

import type { DieFace, BonusDieInfo } from '../domain/types';
import SpotlightContainer from './SpotlightContainer';
import BonusDieSpotlightContent from './BonusDieSpotlightContent';
import { GameButton } from './components/GameButton';
import { UI_Z_INDEX } from '../../../core';
import { createScopedLogger } from '../../../lib/logger';
import { resolveBonusDieText } from './bonusDieTranslation';

const bonusDieOverlayLogger = createScopedLogger('DT_BONUS_DIE_OVERLAY');
const BONUS_DIE_CLOSE_CLICK_GUARD_MS = 300;
const DISPLAY_ONLY_AUTO_CLOSE_DELAY_MS = 3000;

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
    /** 强制自动关闭延迟（毫秒），用于教程等场景 */
    forceAutoCloseDelay?: number;
    /** 手动关闭模式（仅点关闭/点击背景，不自动关闭） */
    manualCloseOnly?: boolean;
    
    // ===== 重掷交互模式 =====
    /** 奖励骰列表（多颗重掷模式） */
    bonusDice?: BonusDieInfo[];
    /** 是否可以重掷（有足够 Token） */
    canReroll?: boolean;
    /** 是否因达到最大重掷次数而不可重掷（用于文案区分“没资源” vs “到上限”） */
    rerollLimitReached?: boolean;
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
    /** 多骰汇总文本 key（自己视角多骰卡等场景） */
    summaryEffectKey?: string;
    /** 多骰汇总文本参数 */
    summaryEffectParams?: Record<string, string | number>;
    /** 特写展示事件身份；变化时即使点数不变也要重播滚动动画 */
    presentationKey?: string | number;
    /** 展示语义：choice 表示固定选择结果，不按随机投骰展示 */
    presentationKind?: 'roll' | 'choice';
    /** 最近一次被重掷的奖励骰索引，仅用于限定动画目标 */
    lastRerolledDieIndex?: number;
    /** 最近一次重掷表现事件身份，仅用于区分连续重掷 */
    rerollPresentationKey?: string | number;
    /** 已由 modal stack 承载时，禁止再次 portal */
    usePortal?: boolean;
    /** 展示型奖励骰允许点击后方牌桌，用于打出可修改该奖励骰的卡牌 */
    allowBackgroundInteraction?: boolean;
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
    forceAutoCloseDelay,
    manualCloseOnly,
    bonusDice,
    canReroll,
    rerollLimitReached,
    onReroll,
    onSkipReroll,
    showTotal = false,
    rerollCostAmount,
    rerollCostTokenId,
    displayOnly,
    characterId,
    summaryEffectKey,
    summaryEffectParams,
    presentationKey,
    presentationKind,
    lastRerolledDieIndex,
    rerollPresentationKey,
    usePortal,
    allowBackgroundInteraction,
}) => {
    const { t, i18n } = useTranslation('game-dicethrone');
    // 只要有 bonusDice 就进入多骰模式，不依赖 onReroll 或 displayOnly
    const isRerollMode = Boolean(bonusDice && bonusDice.length > 0);
    const isSingleDieRerollSpotlight = Boolean(bonusDice && bonusDice.length === 1);
    const costAmount = rerollCostAmount ?? 1;
    const tokenName = rerollCostTokenId ? t(`tokens.${rerollCostTokenId}.name`) : t('tokens.taiji.name');
    const summaryEffectText = React.useMemo(() => {
        if (!summaryEffectKey || !summaryEffectParams) {
            return undefined;
        }
        return resolveBonusDieText(summaryEffectKey, { t, i18n }, summaryEffectParams);
    }, [summaryEffectKey, summaryEffectParams, i18n, t]);
    const shouldHidePerDieEffectText = Boolean(summaryEffectText);
    const hasForceAutoClose = typeof forceAutoCloseDelay === 'number' && forceAutoCloseDelay > 0;
    const isManualCloseOnly = manualCloseOnly === true && !hasForceAutoClose;
    const resolvedAutoCloseDelay = hasForceAutoClose
        ? forceAutoCloseDelay
        : (displayOnly ? DISPLAY_ONLY_AUTO_CLOSE_DELAY_MS : autoCloseDelay);
    const handleOverlayClose = React.useCallback(() => {
        bonusDieOverlayLogger.info('ui-close-request', {
            mode: isRerollMode ? 'reroll' : 'single',
            displayOnly: !!displayOnly,
            canReroll: !!canReroll,
            rerollLimitReached: !!rerollLimitReached,
            bonusDiceCount: bonusDice?.length ?? 0,
        });
        onClose();
    }, [bonusDice?.length, canReroll, displayOnly, isRerollMode, onClose, rerollLimitReached]);
    const handleDieClick = React.useCallback((dieIndex: number) => {
        if (!canReroll) {
            bonusDieOverlayLogger.info('reroll-die-click-ignored', {
                dieIndex,
                reason: displayOnly
                    ? 'display-only'
                    : rerollLimitReached
                        ? 'reroll-limit-reached'
                        : 'can-reroll-false',
                bonusDiceCount: bonusDice?.length ?? 0,
            });
            return;
        }
        if (!onReroll) {
            bonusDieOverlayLogger.info('reroll-die-click-ignored', {
                dieIndex,
                reason: 'missing-onReroll-handler',
                bonusDiceCount: bonusDice?.length ?? 0,
            });
            return;
        }

        bonusDieOverlayLogger.info('reroll-die-click', {
            dieIndex,
            bonusDiceCount: bonusDice?.length ?? 0,
        });
        onReroll(dieIndex);
    }, [bonusDice?.length, canReroll, displayOnly, onReroll, rerollLimitReached]);
    const handleConfirmDamage = React.useCallback(() => {
        bonusDieOverlayLogger.info('confirm-damage-click', {
            hasOnSkipReroll: typeof onSkipReroll === 'function',
            fallbackToClose: typeof onSkipReroll !== 'function',
            bonusDiceCount: bonusDice?.length ?? 0,
        });

        if (onSkipReroll) {
            onSkipReroll();
            return;
        }

        handleOverlayClose();
    }, [bonusDice?.length, handleOverlayClose, onSkipReroll]);
    const handleEmergencyDismiss = React.useCallback((event?: React.MouseEvent) => {
        event?.stopPropagation();
        if (
            isRerollMode
            && typeof onSkipReroll === 'function'
            && (!displayOnly || allowBackgroundInteraction)
        ) {
            handleConfirmDamage();
            return;
        }
        handleOverlayClose();
    }, [
        allowBackgroundInteraction,
        displayOnly,
        handleConfirmDamage,
        handleOverlayClose,
        isRerollMode,
        onSkipReroll,
    ]);

    // 调试日志：组件渲染
    React.useEffect(() => {
        bonusDieOverlayLogger.info('props', {
            isVisible,
            value,
            face,
            effectKey,
            characterId,
            isRerollMode,
            bonusDiceCount: bonusDice?.length ?? 0,
        });
    }, [isVisible, value, face, effectKey, characterId, isRerollMode, bonusDice]);

    if (!isVisible) {
        bonusDieOverlayLogger.info('skip', { reason: 'not-visible' });
        return null;
    }

    // 重掷交互模式：显示多颗骰子
    if (isRerollMode && bonusDice) {
        const total = bonusDice.reduce((sum, d) => sum + d.value, 0);
        const multiDieSize = isSingleDieRerollSpotlight
            ? '8vw'
            : bonusDice.length >= 5
                ? '5.2vw'
                : bonusDice.length >= 4
                    ? '5.8vw'
                    : '6.4vw';
        const multiDieGap = isSingleDieRerollSpotlight
            ? '0'
            : bonusDice.length >= 5
                ? '0.8vw'
                : '1.2vw';
        // 可改骰的展示态也必须保留最终结算入口，但不能封锁后方手牌交互。
        const requiresExplicitSettlement = typeof onSkipReroll === 'function'
            && (!displayOnly || allowBackgroundInteraction);
        const canSelectDieToReroll = canReroll === true;
        const shouldDisableAutoClose = isManualCloseOnly || requiresExplicitSettlement;

        bonusDieOverlayLogger.info('render-reroll', {
            total,
            bonusDiceCount: bonusDice.length,
            displayOnly,
            canReroll: !!canReroll,
            showTotal,
            characterId,
            isSingleDieRerollSpotlight,
        });

        return (
            <SpotlightContainer
                id="bonus-dice-reroll"
                isVisible={isVisible}
                onClose={handleOverlayClose}
                disableAutoClose={shouldDisableAutoClose && !hasForceAutoClose}
                disableBackdropClose={requiresExplicitSettlement || allowBackgroundInteraction}
                blockPointerEvents={requiresExplicitSettlement && !allowBackgroundInteraction}
                autoCloseDelay={resolvedAutoCloseDelay}
                zIndex={UI_Z_INDEX.overlayRaised + 100}
                closeOnContentClick={!requiresExplicitSettlement}
                // 奖励骰特写保留短保护窗，避免触发它的同一次点击立刻关闭
                closeClickGuardMs={BONUS_DIE_CLOSE_CLICK_GUARD_MS}
                usePortal={usePortal}
            >
                <div className="relative flex flex-col items-center gap-[1.5vw]" data-testid="bonus-die-overlay">
                    <GameButton
                        type="button"
                        variant="glass"
                        size="sm"
                        icon={<X size={16} />}
                        onClick={handleEmergencyDismiss}
                        aria-label={requiresExplicitSettlement ? t('bonusDie.confirmDamage') : t('bonusDie.closeSpotlight')}
                        className="absolute right-0 top-0 !min-h-0 !rounded-full !px-[0.7vw] !py-[0.7vw] !shadow-[0_0_16px_rgba(0,0,0,0.35)]"
                    />
                    {/* 提示文字 - DiceThrone 风格 */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-black/60 border border-amber-400/30 rounded-xl px-[2.5vw] py-[0.8vw] shadow-lg"
                    >
                        <span className="text-white text-[1.4vw] font-bold tracking-wide">
                            {displayOnly
                                ? t(presentationKind === 'choice' ? 'bonusDie.choiceResult' : 'bonusDie.diceResult')
                                : canReroll
                                    ? t('bonusDie.selectToReroll', { cost: costAmount, token: tokenName })
                                    : rerollLimitReached
                                        ? t('bonusDie.rerollLimitReached')
                                        : t('bonusDie.noTokenToReroll', { token: tokenName })}
                        </span>
                    </motion.div>

                    {/* 骰子列表 */}
                    <div
                        className={`flex justify-center ${isSingleDieRerollSpotlight ? 'items-center' : 'items-start'}`}
                        style={{ gap: multiDieGap }}
                        data-testid={isSingleDieRerollSpotlight ? 'bonus-die-single-reroll-spotlight' : 'bonus-die-multi-reroll-spotlight'}
                    >
                        {bonusDice.map((die) => {
                            const hasTargetedRerollPresentation = rerollPresentationKey !== undefined
                                && lastRerolledDieIndex !== undefined;
                            const shouldAnimateDie = !hasTargetedRerollPresentation || die.index === lastRerolledDieIndex;
                            const diePresentationKey = hasTargetedRerollPresentation
                                ? (shouldAnimateDie ? `${rerollPresentationKey}:${die.index}` : undefined)
                                : (presentationKey !== undefined ? `${presentationKey}:${die.index}` : undefined);
                            const dieContent = (
                                <>
                                    <BonusDieSpotlightContent
                                        value={die.value}
                                        face={die.face}
                                        effectKey={die.effectKey}
                                        effectParams={die.effectParams}
                                        locale={locale}
                                        size={multiDieSize}
                                        rollingDurationMs={600 + die.index * 100}
                                        animateOnMount={shouldAnimateDie && die.presentationKind !== 'choice'}
                                        presentationKey={diePresentationKey}
                                        characterId={characterId}
                                        compact={!isSingleDieRerollSpotlight}
                                        hideEffectText={shouldHidePerDieEffectText || (!isSingleDieRerollSpotlight && bonusDice.length > 1)}
                                    />
                                    {canSelectDieToReroll && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                            <div className="bg-amber-600/80 rounded-full p-[0.5vw] border border-amber-300/50 shadow-[0_0_12px_rgba(245,158,11,0.4)]">
                                                <svg className="w-[2vw] h-[2vw] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                            </div>
                                        </div>
                                    )}
                                </>
                            );

                            const shouldRenderRerollButton = isRerollMode && !displayOnly;
                            if (!shouldRenderRerollButton) {
                                return (
                                    <motion.div
                                        key={die.index}
                                        initial={{ scale: 0.5, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: die.index * 0.15 }}
                                        className="relative bg-transparent border-0 p-0"
                                        data-testid={`bonus-die-reroll-option-${die.index}`}
                                    >
                                        {dieContent}
                                    </motion.div>
                                );
                            }

                            return (
                                <motion.button
                                    key={die.index}
                                    type="button"
                                    disabled={!canSelectDieToReroll}
                                    aria-disabled={!canSelectDieToReroll}
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: die.index * 0.15 }}
                                    className={`relative bg-transparent border-0 p-0 transition-transform ${
                                        canSelectDieToReroll
                                            ? 'cursor-pointer hover:scale-110'
                                            : 'cursor-default'
                                    }`}
                                    data-testid={`bonus-die-reroll-option-${die.index}`}
                                    onClick={canSelectDieToReroll ? () => handleDieClick(die.index) : undefined}
                                >
                                    {dieContent}
                                </motion.button>
                            );
                        })}
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

                    {summaryEffectKey && summaryEffectParams && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="text-white text-[1.4vw] font-black italic tracking-wider whitespace-nowrap bg-black/60 px-[1.5vw] py-[0.4vw] rounded-full border border-white/20 shadow-lg"
                            style={{ textShadow: '0 0 1vw rgba(251, 191, 36, 0.5)' }}
                        >
                            {summaryEffectText ?? summaryEffectKey}
                        </motion.div>
                    )}

                    {/* 操作按钮：只有可重掷时才显示确认入口 */}
                    {requiresExplicitSettlement && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                        >
                            <GameButton
                                onClick={handleConfirmDamage}
                                variant="primary"
                                size="md"
                                className="!text-[1.1vw] !px-[2.5vw] !py-[0.8vw]"
                            >
                                {t('bonusDie.confirmDamage')}
                            </GameButton>
                        </motion.div>
                    )}
                </div>
            </SpotlightContainer>
        );
    }

    // 普通单颗骰子特写模式
    if (value === undefined) {
        bonusDieOverlayLogger.info('skip', { reason: 'value-undefined', isVisible });
        return null;
    }
    bonusDieOverlayLogger.info('render-single', {
        value,
        face,
        effectKey,
        characterId,
    });

    return (
        <SpotlightContainer
            id={`bonus-die-${value}`}
            isVisible={isVisible}
            onClose={handleOverlayClose}
            disableAutoClose={isManualCloseOnly && !hasForceAutoClose}
            autoCloseDelay={resolvedAutoCloseDelay}
            zIndex={UI_Z_INDEX.overlayRaised + 100}
            // 奖励骰特写保留短保护窗，避免触发它的同一次点击立刻关闭
            closeClickGuardMs={BONUS_DIE_CLOSE_CLICK_GUARD_MS}
            usePortal={usePortal}
        >
            <div className="relative" data-testid="bonus-die-overlay">
                <GameButton
                    type="button"
                    variant="glass"
                    size="sm"
                    icon={<X size={16} />}
                    onClick={handleEmergencyDismiss}
                    aria-label={t('bonusDie.closeSpotlight')}
                    className="absolute -right-[1vw] -top-[1vw] !min-h-0 !rounded-full !px-[0.7vw] !py-[0.7vw] !shadow-[0_0_16px_rgba(0,0,0,0.35)]"
                />
                <BonusDieSpotlightContent
                    value={value}
                    face={face}
                    effectKey={effectKey}
                    effectParams={effectParams}
                    locale={locale}
                    size="8vw"
                    animateOnMount={presentationKind !== 'choice'}
                    presentationKey={presentationKey}
                    characterId={characterId}
                />
            </div>
        </SpotlightContainer>
    );
};


export default BonusDieOverlay;
