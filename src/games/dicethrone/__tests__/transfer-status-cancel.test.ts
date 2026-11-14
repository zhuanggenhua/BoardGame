/**
 * 状态操作类卡牌门控测试
 * 验证场上无状态效果时禁止打出，有状态效果时可正常打出和取消
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { DiceThroneDomain } from '../domain';
import {
    testSystems, fixedRandom, cmd, assertState,
    createSetupWithHand,
} from './test-utils';
import { STATUS_IDS } from '../domain/ids';
import type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent } from '../domain/types';
import type { DiceThroneExpectation } from './test-utils';
import { createHeroMatchup, getCardById } from './test-utils';
import { executePipeline } from '../../../engine/pipeline';
import { TOKEN_IDS } from '../domain/ids';
import { buildDiceThroneAiLegalActions } from '../ai';

describe('状态操作类卡牌 - 有效性门控', () => {
    const CARD_ID = 'card-transfer-status';

    it('双方守护均满时不能打出转移牌，释放目标容量后可正常转移', () => {
        let state = createHeroMatchup('paladin', 'zhanshujia')(['0', '1'], fixedRandom);
        state.sys.phase = 'main2';
        state.core.activePlayerId = '1';
        state.core.players['1'].hand = [getCardById(CARD_ID)];
        state.core.players['1'].resources.cp = 5;
        state.core.players['0'].tokens = { [TOKEN_IDS.PROTECT]: 1 };
        state.core.players['1'].tokens = { [TOKEN_IDS.PROTECT]: 1 };
        state.core.players['0'].statusEffects = {};
        state.core.players['1'].statusEffects = {};
        const play = () => executePipeline({ domain: DiceThroneDomain, systems: testSystems }, state,
            { type: 'PLAY_CARD', playerId: '1', payload: { cardId: CARD_ID }, timestamp: 100 } as DiceThroneCommand,
            fixedRandom, ['0', '1']);
        const rejected = play();
        expect(rejected.success).toBe(false);
        expect(rejected.error).toBe('noTransferableStatusTarget');
        expect(state.core.players['1'].resources.cp).toBe(5);
        expect(buildDiceThroneAiLegalActions({ state, playerId: '1' })
            .some(action => action.commands.some(command => command.payload?.cardId === CARD_ID))).toBe(false);

        state.core.players['0'].tokens[TOKEN_IDS.PROTECT] = 0;
        const played = play();
        expect(played.success).toBe(true);
        state = played.state;
        const result = executePipeline({ domain: DiceThroneDomain, systems: testSystems }, state,
            { type: 'TRANSFER_STATUS', playerId: '1', payload: { fromPlayerId: '1', toPlayerId: '0', statusId: TOKEN_IDS.PROTECT }, timestamp: 101 } as DiceThroneCommand,
            fixedRandom, ['0', '1']);
        expect(result.success).toBe(true);
        expect(result.state.core.players['0'].tokens[TOKEN_IDS.PROTECT]).toBe(1);
        expect(result.state.core.players['1'].tokens[TOKEN_IDS.PROTECT]).toBe(0);
    });

    const createRunner = (mutate?: (core: DiceThroneCore) => void) => {
        const setup = createSetupWithHand([CARD_ID], {
            cp: 5,
            mutate,
        });
        return new GameTestRunner<DiceThroneCore, DiceThroneCommand, DiceThroneEvent, DiceThroneExpectation>({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random: fixedRandom,
            setup,
            assertFn: assertState,
        });
    };

    it('场上无状态效果时禁止打出乾坤大挪移', () => {
        const runner = createRunner(); // 不加任何状态
        const result = runner.run({
            name: '无状态时打出乾坤大挪移',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // upkeep → income
                cmd('ADVANCE_PHASE', '0'), // income → main1
                cmd('PLAY_CARD', '0', { cardId: CARD_ID }),
            ],
            expect: {
                expectError: { command: 'PLAY_CARD', error: 'noStatusOnBoard' },
                players: {
                    '0': {
                        cp: 5, // CP 未扣除
                        handSize: 1, // 卡牌仍在手牌
                    },
                },
            },
        });

        if (!result.passed) {
            console.error('断言错误:', result.assertionErrors);
            console.error('步骤:', result.steps.map(s => `${s.commandType}: ${s.success ? 'OK' : s.error}`));
        }
        expect(result.passed).toBe(true);
    });

    it('场上有状态效果时可正常打出并取消', () => {
        const runner = createRunner((core) => {
            core.players['1'].statusEffects[STATUS_IDS.POISON] = 2;
        });
        const result = runner.run({
            name: '有状态时打出并取消',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ADVANCE_PHASE', '0'),
                cmd('PLAY_CARD', '0', { cardId: CARD_ID }),
                cmd('SYS_INTERACTION_CANCEL', '0'),
            ],
            expect: {
                pendingInteraction: null,
                players: {
                    '0': {
                        cp: 5, // CP 返还
                        handSize: 1, // 卡牌返还
                        discardSize: 0,
                    },
                },
            },
        });

        if (!result.passed) {
            console.error('断言错误:', result.assertionErrors);
            console.error('步骤:', result.steps.map(s => `${s.commandType}: ${s.success ? 'OK' : s.error}`));
        }
        expect(result.passed).toBe(true);
    });
});
