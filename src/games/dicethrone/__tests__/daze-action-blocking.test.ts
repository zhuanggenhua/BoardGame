/**
 * Daze / Stun 语义回归测试
 *
 * - Daze：当前攻击链路内应禁止打牌。
 * - legacy Stun：兼容旧录入，沿用同一禁止行动语义。
 */

import { describe, it, expect } from 'vitest';
import type { DiceThroneCommand, DiceThroneCore } from '../domain/types';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { createInitializedState, fixedRandom } from './test-utils';
import { validateCommand } from '../domain/commandValidation';

function createCore(): DiceThroneCore {
    return createInitializedState(['0', '1'], fixedRandom).core;
}

describe('Daze / Stun 语义', () => {
    it('daze 状态会阻止当前回合玩家打牌', () => {
        const core = createCore();
        core.players['0'].statusEffects[STATUS_IDS.DAZE] = 1;

        const firstCard = core.players['0'].hand[0];
        expect(firstCard).toBeDefined();

        const result = validateCommand(
            core,
            {
                type: 'PLAY_CARD',
                playerId: '0',
                payload: { cardId: firstCard.id },
            } as DiceThroneCommand,
            'main1'
        );

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.error).toBe('player_is_dazed');
        }
    });

    it('daze 状态不阻止使用净化', () => {
        const core = createCore();
        core.players['0'].statusEffects[STATUS_IDS.DAZE] = 1;
        core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] = 1;
        core.players['0'].tokens[TOKEN_IDS.PURIFY] = 1;
        core.players['0'].resources[RESOURCE_IDS.CP] = 2;

        const result = validateCommand(
            core,
            {
                type: 'USE_PURIFY',
                playerId: '0',
                payload: { statusId: STATUS_IDS.KNOCKDOWN },
            } as DiceThroneCommand,
            'main1'
        );

        expect(result.valid).toBe(true);
        if (!result.valid) {
            expect(result.error).not.toBe('player_is_dazed');
        }
    });

    it('stun 状态会阻止当前回合玩家打牌', () => {
        const core = createCore();
        core.players['0'].statusEffects[STATUS_IDS.STUN] = 1;

        const firstCard = core.players['0'].hand[0];
        expect(firstCard).toBeDefined();

        const result = validateCommand(
            core,
            {
                type: 'PLAY_CARD',
                playerId: '0',
                payload: { cardId: firstCard.id },
            } as DiceThroneCommand,
            'main1'
        );

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.error).toBe('player_is_stunned');
        }
    });
});
