import { describe, expect, it } from 'vitest';
import {
    canInteractDiceForCurrentBoard,
    getInteractionDiceForRightSidebar,
    getRailDiceForCurrentBoard,
    shouldShowRailDiceTray,
    shouldUseReplayOnlyRollContextAsActiveSurface,
} from '../diceStagePolicy';
import {
    canInteractHandForCurrentBoard,
    canPlayHandCardsForCurrentBoard,
    canSellHandCardsForCurrentBoard,
} from '../handPlayPolicy';

const baseParams = {
    isSpectator: false,
    isSelfView: true,
    isViewRolling: true,
    isAttackShowcaseVisible: false,
    isDuelDirectDefenseOnly: false,
    isManualSelfResponseWindow: false,
    isDirectDiceActor: false,
    currentResponderId: undefined,
    rootPid: '1',
    diceInteractionPlayerId: undefined,
    canOperateOwnedCompareRoll: false,
    isRollPhase: true,
    rollCount: 1,
    isRolling: false,
    hasPassiveRerollSelection: false,
    hasDiceMultistepInteraction: false,
};

describe('diceStagePolicy', () => {
    it('自己视角且自己在掷骰时应允许操作骰子', () => {
        expect(canInteractDiceForCurrentBoard(baseParams)).toBe(true);
    });

    it('对方投掷阶段我方作为响应者改对方骰子时，也应允许操作骰子', () => {
        expect(canInteractDiceForCurrentBoard({
            ...baseParams,
            isSelfView: false,
            isViewRolling: false,
            currentResponderId: '1',
            diceInteractionPlayerId: '1',
            hasDiceMultistepInteraction: true,
        })).toBe(true);
    });

    it('主阶段处理自己发起的奖励骰改面交互时应允许操作骰子', () => {
        expect(canInteractDiceForCurrentBoard({
            ...baseParams,
            isSelfView: false,
            isViewRolling: false,
            isRollPhase: false,
            diceInteractionPlayerId: '1',
            hasDiceMultistepInteraction: true,
        })).toBe(true);
    });

    it('自己拥有的 Duel/对掷当前骰区应允许在右侧骰盘确认，不依赖中心视图焦点', () => {
        expect(canInteractDiceForCurrentBoard({
            ...baseParams,
            isSelfView: false,
            isViewRolling: false,
            canOperateOwnedCompareRoll: true,
        })).toBe(true);
    });

    it('骰盘始终走右侧 2D 入口', () => {
        expect(shouldShowRailDiceTray({ hasKeptDice: true })).toBe(true);
        expect(shouldShowRailDiceTray({ hasKeptDice: false })).toBe(true);
    });

    it('右侧 2D 骰盘保留全部骰子，包括锁定骰子', () => {
        const dice = [
            { id: 0, value: 1, isKept: false },
            { id: 1, value: 2, isKept: true },
        ];
        expect(getRailDiceForCurrentBoard(dice as any)).toMatchObject(dice);
    });

    it('确认临时骰子后当前骰区为空时，应回到当前玩家常态骰子池而不是空白', () => {
        const normalDicePool = [
            { id: 0, value: 1, isKept: false },
            { id: 1, value: 2, isKept: true },
            { id: 2, value: 3, isKept: false },
            { id: 3, value: 4, isKept: false },
            { id: 4, value: 5, isKept: false },
        ];

        expect(getRailDiceForCurrentBoard([], normalDicePool as any)).toMatchObject([
            { id: 0, value: 1, isKept: false, displayOnly: true },
            { id: 1, value: 2, isKept: false, displayOnly: true },
            { id: 2, value: 3, isKept: false, displayOnly: true },
            { id: 3, value: 4, isKept: false, displayOnly: true },
            { id: 4, value: 5, isKept: false, displayOnly: true },
        ]);
    });

    it('非普通掷骰阶段允许把已确认临时骰作为右侧只读回看', () => {
        const replayDice = [{ id: 0, value: 6, isKept: false, displayOnly: true }];

        expect(shouldUseReplayOnlyRollContextAsActiveSurface({
            replayOnlyRollDice: replayDice as any,
            isCurrentPhaseMainRollPhase: false,
        })).toBe(true);
        expect(getInteractionDiceForRightSidebar({
            currentRollDice: [],
            replayOnlyRollDice: replayDice as any,
            isCurrentPhaseMainRollPhase: false,
        })).toMatchObject(replayDice);
    });

    it('进入进攻/防御等普通掷骰阶段后，旧临时骰回看不得抢占当前骰盘或禁用动作', () => {
        const replayDice = [{ id: 0, value: 6, isKept: false, displayOnly: true }];
        const currentRollDice = [
            { id: 0, value: 1, isKept: false },
            { id: 1, value: 2, isKept: false },
            { id: 2, value: 3, isKept: false },
            { id: 3, value: 4, isKept: false },
            { id: 4, value: 5, isKept: false },
        ];

        expect(shouldUseReplayOnlyRollContextAsActiveSurface({
            replayOnlyRollDice: replayDice as any,
            isCurrentPhaseMainRollPhase: true,
        })).toBe(false);
        expect(getInteractionDiceForRightSidebar({
            currentRollDice: currentRollDice as any,
            replayOnlyRollDice: replayDice as any,
            isCurrentPhaseMainRollPhase: true,
        })).toMatchObject(currentRollDice);
    });
});

describe('handPlayPolicy', () => {
    it('自己的手牌不应因为当前是对方回合或对手视角而禁止拖动打红色即时牌', () => {
        expect(canInteractHandForCurrentBoard({ isSpectator: false })).toBe(true);
    });

    it('观察者不能操作手牌', () => {
        expect(canInteractHandForCurrentBoard({ isSpectator: true })).toBe(false);
    });

    it('防御方在自己的防御掷骰阶段，即使不是当前回合玩家也应允许打改自己骰子的手牌', () => {
        expect(canPlayHandCardsForCurrentBoard({
            isSpectator: false,
            isActivePlayer: false,
            isResponder: false,
            isDirectDiceActor: false,
            currentPhase: 'defensiveRoll',
            rootPid: '1',
            rollerId: '1',
        })).toBe(true);
    });

    it('非当前行动者也能尝试打即时牌，具体合法性由领域规则裁定', () => {
        expect(canPlayHandCardsForCurrentBoard({
            isSpectator: false,
            isActivePlayer: false,
            isResponder: false,
            isDirectDiceActor: false,
            currentPhase: 'defensiveRoll',
            rootPid: '0',
            rollerId: '1',
        })).toBe(true);
        expect(canSellHandCardsForCurrentBoard({ isSpectator: false, isActivePlayer: false })).toBe(false);
    });

    it('仅当前行动者能卖牌，观察者不能卖牌', () => {
        expect(canSellHandCardsForCurrentBoard({ isSpectator: false, isActivePlayer: true })).toBe(true);
        expect(canSellHandCardsForCurrentBoard({ isSpectator: true, isActivePlayer: true })).toBe(false);
    });
});
