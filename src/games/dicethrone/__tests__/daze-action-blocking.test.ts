/**
 * Daze / Stun 语义回归测试
 *
 * - Daze：当前攻击链路内应禁止打牌。
 * - legacy Stun：兼容旧录入，沿用同一禁止行动语义。
 */

import { describe, it, expect } from 'vitest';
import type { DiceThroneCommand, DiceThroneCore, InteractionDescriptor } from '../domain/types';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { createInitializedState, fixedRandom } from './test-utils';
import { validateCommand } from '../domain/commandValidation';
import { getUsableTokensForTiming } from '../domain/tokenResponse';

function createCore(): DiceThroneCore {
    return createInitializedState(['0', '1'], fixedRandom).core;
}

function createDazedDefenderTokenResponseCore(): DiceThroneCore {
    const core = createCore();
    core.activePlayerId = '0';
    core.players['1'].tokens[TOKEN_IDS.TAIJI] = 3;
    core.players['1'].statusEffects[STATUS_IDS.DAZE] = 1;
    core.pendingAttack = {
        attackerId: '0',
        defenderId: '1',
        isDefendable: true,
        sourceAbilityId: 'violent-assault',
    } as any;
    core.pendingDamage = {
        id: 'feedback-dazed-taiji-response',
        sourcePlayerId: '0',
        targetPlayerId: '1',
        originalDamage: 2,
        currentDamage: 2,
        sourceAbilityId: 'violent-assault',
        damageScope: 'attack',
        responseType: 'beforeDamageReceived',
        responderId: '1',
        isFullyEvaded: false,
    };
    return core;
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

    it('规则回归：daze 状态不阻止受伤响应者使用太极减伤', () => {
        const core = createDazedDefenderTokenResponseCore();

        const result = validateCommand(
            core,
            {
                type: 'USE_TOKEN',
                playerId: '1',
                payload: {
                    tokenId: TOKEN_IDS.TAIJI,
                    amount: 1,
                    pendingDamageId: 'feedback-dazed-taiji-response',
                },
            } as DiceThroneCommand,
            'main2'
        );

        expect(result.valid).toBe(true);
    });

    it('规则回归：daze 状态下仍应向受伤响应者暴露太极可用动作', () => {
        const core = createDazedDefenderTokenResponseCore();

        expect(
            getUsableTokensForTiming(core, '1', 'beforeDamageReceived')
                .some(token => token.id === TOKEN_IDS.TAIJI)
        ).toBe(true);
    });

    it('反馈回归：daze 状态不阻止受伤响应者跳过 Token 响应', () => {
        const core = createDazedDefenderTokenResponseCore();

        const result = validateCommand(
            core,
            {
                type: 'SKIP_TOKEN_RESPONSE',
                playerId: '1',
                payload: {
                    pendingDamageId: 'feedback-dazed-taiji-response',
                },
            } as DiceThroneCommand,
            'main2'
        );

        expect(result.valid).toBe(true);
    });

    it('眩晕不能被对手的移除状态卡移除', () => {
        const core = createCore();
        core.players['1'].statusEffects[STATUS_IDS.DAZE] = 1;

        const interaction: InteractionDescriptor = {
            id: 'remove-daze-from-opponent',
            playerId: '0',
            sourceCardId: 'card-bye-bye',
            type: 'selectStatus',
            titleKey: 'interaction.selectStatusToRemove',
            selectCount: 1,
            selected: [],
            targetPlayerIds: ['1'],
        };

        const result = validateCommand(
            core,
            {
                type: 'REMOVE_STATUS',
                playerId: '0',
                payload: { targetPlayerId: '1', statusId: STATUS_IDS.DAZE },
            } as DiceThroneCommand,
            'main1',
            interaction,
        );

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.error).toBe('invalid_status');
        }
    });
});
