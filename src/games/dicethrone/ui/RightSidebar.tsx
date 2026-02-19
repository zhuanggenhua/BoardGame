import React, { useMemo } from 'react';
import type { RefObject } from 'react';
import type { AbilityCard, Die, TurnPhase } from '../types';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import type { MultistepChoiceData } from '../../../engine/systems/InteractionSystem';
import { useMultistepInteraction } from '../../../engine/systems/useMultistepInteraction';
import type { DiceModifyResult, DiceModifyStep, DiceSelectResult, DiceSelectStep } from '../domain/systems';
import {
    diceModifyReducer, diceModifyToCommands,
    diceSelectReducer, diceSelectToCommands,
} from '../domain/systems';
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
    setRerollingDiceIds,
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
    setRerollingDiceIds: (ids: number[]) => void;
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
    interaction?: InteractionDescriptor;
    /** dispatch 函数（用于响应交互） */
    dispatch: (type: string, payload?: unknown) => void;
    /** 已激活的攻击修正卡 */
    activeModifiers?: ActiveModifier[];
    /** 被动能力面板 props */
    passiveAbilityProps?: Omit<PassiveAbilityPanelProps, never> | null;
}) => {
    // 骰子多步交互状态（统一管理，替代旧的 4 个 useState + useEffect）
    const isDiceMultistep = interaction?.kind === 'multistep-choice' &&
        ((interaction.data as any)?.meta?.dtType === 'modifyDie' ||
         (interaction.data as any)?.meta?.dtType === 'selectDie');

    // 序列化边界修复：服务端状态经 JSON 传输后，multistep-choice 的函数（localReducer/toCommands）丢失。
    // 根据 meta 中的纯数据重新注入客户端函数，确保 useMultistepInteraction 能正常工作。
    const diceInteraction = useMemo(() => {
        if (!isDiceMultistep || !interaction) return undefined;
        const data = interaction.data as MultistepChoiceData<DiceModifyStep | DiceSelectStep, DiceModifyResult | DiceSelectResult>;
        // 检查函数是否存在（乐观状态中函数完整，服务端状态中函数丢失）
        if (typeof data?.localReducer === 'function' && typeof data?.toCommands === 'function') {
            return interaction as InteractionDescriptor<MultistepChoiceData<DiceModifyStep | DiceSelectStep, DiceModifyResult | DiceSelectResult>>;
        }
        // 函数丢失：根据 meta.dtType 重新注入
        const meta = (data as any)?.meta;
        if (!meta) return undefined;
        let hydratedData: MultistepChoiceData<DiceModifyStep | DiceSelectStep, DiceModifyResult | DiceSelectResult>;
        if (meta.dtType === 'modifyDie') {
            const config = meta.dieModifyConfig;
            hydratedData = {
                ...data,
                initialResult: data.initialResult ?? { modifications: {}, modCount: 0, totalAdjustment: 0 },
                localReducer: (current: any, step: any) => diceModifyReducer(current, step, config),
                toCommands: diceModifyToCommands as any,
            };
        } else {
            hydratedData = {
                ...data,
                initialResult: data.initialResult ?? { selectedDiceIds: [] },
                localReducer: diceSelectReducer as any,
                toCommands: diceSelectToCommands as any,
            };
        }
        return {
            ...interaction,
            data: hydratedData,
        } as InteractionDescriptor<MultistepChoiceData<DiceModifyStep | DiceSelectStep, DiceModifyResult | DiceSelectResult>>;
    }, [isDiceMultistep, interaction]);

    const multistepInteraction = useMultistepInteraction(diceInteraction, dispatch);

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
                    interaction={isDiceMultistep ? interaction : undefined}
                    multistepInteraction={isDiceMultistep ? multistepInteraction : undefined}
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
                    interaction={isDiceMultistep ? interaction : undefined}
                    multistepInteraction={isDiceMultistep ? multistepInteraction : undefined}
                    setRerollingDiceIds={setRerollingDiceIds}
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
