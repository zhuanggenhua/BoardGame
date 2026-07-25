import { describe, expect, it } from 'vitest';
import { reduce } from '../domain/reducer';
import { shouldOpenTokenResponse } from '../domain/tokenResponse';
import { TOKEN_IDS } from '../domain/ids';
import { createHeroMatchup, fixedRandom } from './test-utils';

describe('强制结束后的战斗暂存清理', () => {
    it('回合切换应清除旧伤害响应，避免下一次攻击跳过神罚/守护', () => {
        const state = createHeroMatchup('paladin', 'ninja')(['0', '1'], fixedRandom);
        state.core.activePlayerId = '1';
        state.core.turnNumber = 10;
        state.core.players['0'].tokens[TOKEN_IDS.RETRIBUTION] = 1;
        state.core.players['0'].tokens[TOKEN_IDS.PROTECT] = 1;
        state.core.pendingDamage = {
            id: 'stale-slash-damage',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 8,
            currentDamage: 8,
            sourceAbilityId: 'slash-4',
            damageScope: 'attack',
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        };

        expect(shouldOpenTokenResponse(state.core, '1', '0', 4, false, 'attack')).toBeNull();

        const afterTurnChanged = reduce(state.core, {
            type: 'TURN_CHANGED',
            payload: {
                previousPlayerId: '1',
                nextPlayerId: '0',
                turnNumber: 11,
            },
            sourceCommandType: 'ADVANCE_PHASE',
            timestamp: 100,
        });

        expect(afterTurnChanged.pendingDamage).toBeUndefined();
        expect(afterTurnChanged.pendingAttack).toBeNull();

        const nextIncomingAttack = {
            ...afterTurnChanged,
            pendingAttack: {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'slash-4',
                isDefendable: true,
                isUltimate: false,
            },
        };

        expect(shouldOpenTokenResponse(nextIncomingAttack, '1', '0', 4, false, 'attack')).toBe('defenderMitigation');
    });
});
