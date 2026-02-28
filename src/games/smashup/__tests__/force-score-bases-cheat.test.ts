/**
 * 测试调试功能：强制有随从的基地立即结算
 */

import { describe, it, expect } from 'vitest';
import { smashUpCheatModifier } from '../cheatModifier';
import type { SmashUpCore, BaseInPlay, MinionOnBase } from '../domain/types';

function makeMinion(uid: string, defId: string, owner: string, power: number): MinionOnBase {
    return {
        uid,
        defId,
        owner,
        power,
        tempPowerModifiers: {},
    };
}

function makeBase(defId: string, minions: MinionOnBase[]): BaseInPlay {
    return {
        defId,
        minions,
        ongoingActions: [],
    };
}

function makeCore(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: {
            '0': {
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                inPlay: [],
            },
            '1': {
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                inPlay: [],
            },
        },
        bases: [
            makeBase('base_the_jungle', []), // breakpoint=12，无随从
            makeBase('base_tar_pits', [     // breakpoint=16，有随从
                makeMinion('m1', 'test_minion', '0', 5),
            ]),
            makeBase('base_ninja_dojo', [   // breakpoint=18，有随从
                makeMinion('m2', 'test_minion', '0', 10),
                makeMinion('m3', 'test_minion', '1', 9),
            ]),
        ],
        baseDeck: [],
        currentPlayer: '0',
        turnNumber: 1,
        phase: 'play',
        minionsPlayedThisTurn: {},
        actionsPlayedThisTurn: {},
        minionsMovedToBaseThisTurn: {},
        tempBreakpointModifiers: {},
        scoringEligibleBaseIndices: [],
        ...overrides,
    } as SmashUpCore;
}

describe('forceScoreBasesWithMinions', () => {
    it('将有随从的基地分上限设为 0', () => {
        const core = makeCore();
        
        // 执行强制结算
        const result = smashUpCheatModifier.forceScoreBasesWithMinions!(core);
        
        // 验证：基地 0（无随从）不应有修正
        expect(result.tempBreakpointModifiers['0']).toBeUndefined();
        
        // 验证：基地 1（breakpoint=16，有随从）应有 -16 修正
        expect(result.tempBreakpointModifiers['1']).toBe(-16);
        
        // 验证：基地 2（breakpoint=18，有随从）应有 -18 修正
        expect(result.tempBreakpointModifiers['2']).toBe(-18);
    });

    it('不影响其他状态', () => {
        const core = makeCore();
        const result = smashUpCheatModifier.forceScoreBasesWithMinions!(core);
        
        // 验证其他状态不变
        expect(result.players).toEqual(core.players);
        expect(result.bases).toEqual(core.bases);
        expect(result.baseDeck).toEqual(core.baseDeck);
        expect(result.currentPlayer).toBe(core.currentPlayer);
    });

    it('覆盖已有的 tempBreakpointModifiers', () => {
        const core = makeCore({
            tempBreakpointModifiers: { '0': -5 }, // 已有修正
        });
        
        const result = smashUpCheatModifier.forceScoreBasesWithMinions!(core);
        
        // 验证：基地 0（无随从）的旧修正被保留
        expect(result.tempBreakpointModifiers['0']).toBe(-5);
        
        // 验证：基地 1 和 2 的新修正被添加
        expect(result.tempBreakpointModifiers['1']).toBe(-16);
        expect(result.tempBreakpointModifiers['2']).toBe(-18);
    });

    it('空基地列表时不报错', () => {
        const core = makeCore({ bases: [] });
        
        const result = smashUpCheatModifier.forceScoreBasesWithMinions!(core);
        
        expect(result.tempBreakpointModifiers).toEqual({});
    });
});
