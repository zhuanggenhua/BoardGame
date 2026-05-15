import { describe, expect, it } from 'vitest';
import type { DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { reduce } from '../domain/reducer';
import { RESOURCE_IDS } from '../domain/resources';
import { TOKEN_IDS } from '../domain/ids';
import { resolveAttack } from '../domain/attack';
import { createHeroMatchup, createQueuedRandom } from './test-utils';

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore =>
    events.reduce((current, event) => reduce(current, event), core);

describe('DiceThrone Treant 能力与卡牌合同', () => {
    it('Rooted 防御应在攻击结算中掷 3 骰并按骰面反击、养成、获得生命源泉', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
        state.core.players['1'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['1'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: undefined,
            defenseAbilityId: 'rooted',
            isDefendable: true,
            damage: 0,
        };

        const events = resolveAttack(state.core, createQueuedRandom([1, 4, 6]), undefined, 100);
        const next = applyEvents(state.core, events);

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(3);
        expect(events.some(event => event.type === 'ATTACK_DEFENSE_RESOLVED')).toBe(true);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(29);
        expect(next.players['1'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(1);
        expect(next.players['1'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(1);
    });

    it('Rooted 防御在不可防御攻击中不得执行', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
        state.core.players['1'].tokens[TOKEN_IDS.TREANT_SEEDLING] = 0;
        state.core.players['1'].tokens[TOKEN_IDS.LIFE_SAP] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: undefined,
            defenseAbilityId: 'rooted',
            isDefendable: false,
            damage: 0,
        };

        const events = resolveAttack(state.core, createQueuedRandom([1, 4, 6]), undefined, 100);
        const next = applyEvents(state.core, events);

        expect(events.some(event => event.type === 'BONUS_DIE_ROLLED')).toBe(false);
        expect(events.some(event => event.type === 'ATTACK_DEFENSE_RESOLVED')).toBe(false);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(30);
        expect(next.players['1'].tokens[TOKEN_IDS.TREANT_SEEDLING]).toBe(0);
        expect(next.players['1'].tokens[TOKEN_IDS.LIFE_SAP]).toBe(0);
    });
});
