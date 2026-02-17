import type { RefObject } from 'react';
import type { AbilityCard, Die, TurnPhase, PendingInteraction } from '../types';
import { DiceActions, DiceTray } from './DiceTray';
import { DiscardPile } from './DiscardPile';
import { GameButton } from './components/GameButton';
import { UI_Z_INDEX } from '../../../core';
import { ActiveModifierBadge } from './ActiveModifierBadge';
import type { ActiveModifier } from '../hooks/useActiveModifiers';
import { PassiveAbilityPanel, type PassiveAbilityPanelProps } from './PassiveAbilityPanel';

export const RightSidebar = ({
    dice,
    rollCount,
    rollLimit,
    rollConfirmed,
    currentPhase,
    canInteractDice,
    isRolling,
    setIsRolling,
    rerollingDiceIds,
    locale,
    onToggleLock,
    onRoll,
    onConfirm,
    showAdvancePhaseButton,
    advanceLabel,
    isAdvanceButtonEnabled,
    onAdvance,
    discardPileRef,
    discardCards,
    onInspectRecentCards,
    canUndoDiscard,
    onUndoDiscard,
    discardHighlighted,
    sellButtonVisible,
    interaction,
    dispatch,
    activeModifiers,
    passiveAbilityProps,
}: {
    dice: Die[];
    rollCount: number;
    rollLimit: number;
    rollConfirmed: boolean;
    currentPhase: TurnPhase;
    canInteractDice: boolean;
    isRolling: boolean;
    setIsRolling: (isRolling: boolean) => void;
    rerollingDiceIds?: number[];
    locale?: string;
    onToggleLock: (id: number) => void;
    onRoll: () => void;
    onConfirm: () => void;
    showAdvancePhaseButton: boolean;
    advanceLabel: string;
    isAdvanceButtonEnabled: boolean;
    onAdvance: () => void;
    discardPileRef: RefObject<HTMLDivElement | null>;
    discardCards: AbilityCard[];
    onInspectRecentCards?: (cards: AbilityCard[]) => void;
    canUndoDiscard: boolean;
    onUndoDiscard: () => void;
    discardHighlighted: boolean;
    sellButtonVisible: boolean;
    /** 当前骰子交互（从 sys.interaction.current 读取） */
    interaction?: PendingInteraction;
    /** dispatch 函数（用于响应交互） */
    dispatch: (type: string, payload?: unknown) => void;
    /** 已激活的攻击修正卡 */
    activeModifiers?: ActiveModifier[];
    /** 被动能力面板 props */
    passiveAbilityProps?: Omit<PassiveAbilityPanelProps, never> | null;
}) => {
    return (
        <div
            className="absolute right-[1.5vw] top-0 bottom-[1.5vw] w-[15vw] flex flex-col items-center pointer-events-auto"
            style={{ zIndex: UI_Z_INDEX.hud }}
        >
            <div className="flex-grow" />
            <div className="relative w-full flex flex-col items-center gap-[0.75vw]">
                {/* 攻击修正徽章：absolute 定位，不挤压骰子区域布局 */}
                {activeModifiers && activeModifiers.length > 0 && (
                    <div className="absolute -top-[2.2vw] left-1/2 -translate-x-1/2 z-10">
                        <ActiveModifierBadge modifiers={activeModifiers} />
                    </div>
                )}
                <DiceTray
                    dice={dice}
                    onToggleLock={(id) => {
                        if (!canInteractDice) return;
                        onToggleLock(id);
                    }}
                    currentPhase={currentPhase}
                    canInteract={canInteractDice}
                    isRolling={isRolling}
                    rerollingDiceIds={rerollingDiceIds}
                    locale={locale}
                    interaction={interaction}
                    dispatch={dispatch}
                    isPassiveRerollMode={!!passiveAbilityProps?.rerollSelectingAction}
                />
                <DiceActions
                    rollCount={rollCount}
                    rollLimit={rollLimit}
                    rollConfirmed={rollConfirmed}
                    onRoll={onRoll}
                    onConfirm={onConfirm}
                    currentPhase={currentPhase}
                    canInteract={canInteractDice}
                    isRolling={isRolling}
                    setIsRolling={setIsRolling}
                    interaction={interaction}
                    dispatch={dispatch}
                />
                {/* 下一阶段按钮：始终占位，隐藏时使用 invisible 且禁用 pointer-events */}
                <div className={`w-full flex justify-center ${showAdvancePhaseButton ? '' : 'invisible pointer-events-none'}`}>
                    <GameButton
                        onClick={onAdvance}
                        disabled={!isAdvanceButtonEnabled}
                        variant={isAdvanceButtonEnabled ? "primary" : "secondary"}
                        clickSoundKey={null}
                        className="w-[10.2vw] !text-[0.75vw] !py-[0.7vw]"
                        size="sm"
                        data-tutorial-id="advance-phase-button"
                    >
                        {advanceLabel}
                    </GameButton>
                </div>
                {/* 被动能力面板（如教皇税） */}
                {passiveAbilityProps && passiveAbilityProps.passives.length > 0 && (
                    <PassiveAbilityPanel {...passiveAbilityProps} />
                )}
                <div className="w-[10.2vw] flex justify-center">
                    <DiscardPile
                        ref={discardPileRef}
                        cards={discardCards}
                        locale={locale}
                        onInspectRecent={onInspectRecentCards}
                        canUndo={canUndoDiscard}
                        onUndo={onUndoDiscard}
                        isHighlighted={discardHighlighted}
                        showSellButton={sellButtonVisible}
                    />
                </div>
            </div>
        </div>
    );
};
