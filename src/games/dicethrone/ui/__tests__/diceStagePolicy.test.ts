import { describe, expect, it } from 'vitest';
import { canInteractDiceForCurrentBoard, getRailDiceForCurrentBoard, shouldShowRailDiceTray, shouldUseBoardDiceStage } from '../diceStagePolicy';

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
    boardDice3dEnabled: false,
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

    it('对方投掷阶段我方响应改对方骰子时，关闭 3D 开关仍应保持旧右侧骰盘路径', () => {
        expect(shouldUseBoardDiceStage({
            ...baseParams,
            boardDice3dEnabled: false,
            isSelfView: false,
            isViewRolling: false,
            currentResponderId: '1',
            diceInteractionPlayerId: '1',
            hasDiceMultistepInteraction: true,
        })).toBe(false);
    });

    it('普通掷骰阶段只有开启 3D 开关时才应显示棋盘骰台', () => {
        expect(shouldUseBoardDiceStage({
            ...baseParams,
            boardDice3dEnabled: false,
            hasDiceMultistepInteraction: false,
        })).toBe(false);

        expect(shouldUseBoardDiceStage({
            ...baseParams,
            boardDice3dEnabled: true,
            hasDiceMultistepInteraction: false,
        })).toBe(true);
    });

    it('棋盘 3D 开启且已有锁定骰子时，右侧传统骰盘仍应继续显示', () => {
        expect(shouldShowRailDiceTray({
            useBoardDiceStage: true,
            hasKeptDice: true,
        })).toBe(true);
    });

    it('棋盘 3D 开启且没有锁定骰子时，右侧传统骰盘应隐藏', () => {
        expect(shouldShowRailDiceTray({
            useBoardDiceStage: true,
            hasKeptDice: false,
        })).toBe(false);
    });

    it('棋盘 3D 开启时，右侧传统骰盘只应承接已锁定骰子', () => {
        expect(getRailDiceForCurrentBoard([
            { id: 0, value: 1, isKept: false },
            { id: 1, value: 2, isKept: true },
            { id: 2, value: 3, isKept: false },
        ] as any, true)).toMatchObject([
            { id: 1, isKept: true },
        ]);
    });

    it('棋盘 3D 关闭时，右侧传统骰盘应继续显示全部骰子', () => {
        expect(getRailDiceForCurrentBoard([
            { id: 0, value: 1, isKept: false },
            { id: 1, value: 2, isKept: true },
        ] as any, false)).toMatchObject([
            { id: 0, isKept: false },
            { id: 1, isKept: true },
        ]);
    });
});
