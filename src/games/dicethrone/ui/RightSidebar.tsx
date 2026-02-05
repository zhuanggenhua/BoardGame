import type { RefObject } from 'react';
import type { AbilityCard, Die, TurnPhase } from '../types';
import { DiceActions, DiceTray, type DiceInteractionConfig } from './DiceTray';
import { DiscardPile } from './DiscardPile';
import { GameButton } from './components/GameButton';

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
    diceInteractionConfig,
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
    /** 点击弃牌堆放大按钮时触发，传入最近的卡片列表 */
    onInspectRecentCards?: (cards: AbilityCard[]) => void;
    canUndoDiscard: boolean;
    onUndoDiscard: () => void;
    discardHighlighted: boolean;
    sellButtonVisible: boolean;
    /** 骰子交互模式配置 */
    diceInteractionConfig?: DiceInteractionConfig;
}) => {
    return (
        <div className="absolute right-[1.5vw] top-0 bottom-[1.5vw] w-[15vw] flex flex-col items-center pointer-events-auto z-[60]">
            <div className="flex-grow" />
            <div className="w-full flex flex-col items-center gap-[0.75vw]">
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
                    interactionConfig={diceInteractionConfig}
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
                    interactionConfig={diceInteractionConfig}
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
