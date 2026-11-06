import { describe, expect, it } from 'vitest';
import { executePipeline } from '../../../engine/pipeline';
import { DiceThroneDomain } from '../domain';
import { RESOURCE_IDS } from '../domain/resources';
import { STATUS_IDS } from '../domain/ids';
import type { DiceThroneCommand } from '../domain/types';
import { createHeroMatchup, fixedRandom, getCardById, testSystems } from './test-utils';

const command = (type: string, playerId: string, payload: Record<string, unknown> = {}, timestamp = 100): DiceThroneCommand => ({
    type, playerId, payload, timestamp,
} as DiceThroneCommand);

describe('即时效果序列的通用交互续接', () => {
    it('卡牌交互完成后续接剩余效果，已提交效果不重放', () => {
        const state = createHeroMatchup('cursed_pirate', 'barbarian')(['0', '1'], fixedRandom);
        const card = getCardById('card-what-status');
        card.effects = [
            {
                description: '选择一名玩家并移除其所有状态。',
                action: { type: 'custom', target: 'self', customActionId: 'remove-all-status' },
                timing: 'immediate',
            },
            {
                description: '选择后造成 3 点伤害。',
                action: { type: 'damage', target: 'opponent', value: 3 },
                timing: 'immediate',
            },
        ];
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['0'].hand = [card];
        state.core.players['1'].statusEffects[STATUS_IDS.WITHER] = 1;
        const defenderHp = state.core.players['1'].resources[RESOURCE_IDS.HP];

        const requested = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('PLAY_CARD', '0', { cardId: card.id }),
            fixedRandom,
            ['0', '1'],
        );

        expect(requested.success).toBe(true);
        expect(requested.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(defenderHp);
        expect(requested.state.core.players['1'].statusEffects[STATUS_IDS.WITHER]).toBe(1);
        expect(requested.state.sys.interaction.current?.kind).toBe('dt:card-interaction');
        expect(requested.state.sys.resolution?.frames).toHaveLength(1);

        const reloaded = JSON.parse(JSON.stringify(requested.state)) as typeof requested.state;
        const resolved = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            reloaded,
            command('RESOLVE_INTERACTION', '0', { selectedPlayerIds: ['1'] }, 101),
            fixedRandom,
            ['0', '1'],
        );

        expect(resolved.success).toBe(true);
        expect(resolved.state.core.players['1'].statusEffects[STATUS_IDS.WITHER] ?? 0).toBe(0);
        expect(resolved.state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(defenderHp - 3);
        expect(resolved.state.sys.interaction.current).toBeUndefined();
        expect(resolved.state.sys.resolution?.frames ?? []).toHaveLength(0);
    });
});
