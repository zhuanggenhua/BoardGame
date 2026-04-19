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

describe('状态操作类卡牌 - 有效性门控', () => {
    const CARD_ID = 'card-transfer-status';

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
