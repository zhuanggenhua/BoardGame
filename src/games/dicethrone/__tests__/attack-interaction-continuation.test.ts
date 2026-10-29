import { describe, expect, it } from 'vitest';
import { executePipeline } from '../../../engine/pipeline';
import { DiceThroneDomain } from '../domain';
import { reduce } from '../domain/reducer';
import { RESOURCE_IDS } from '../domain/resources';
import { STATUS_IDS } from '../domain/ids';
import type { DiceThroneCommand, DiceThroneEvent } from '../domain/types';
import { createHeroMatchup, fixedRandom, getCardById, getCardInteractionPrompt, testSystems } from './test-utils';

const command = (type: string, playerId: string, payload: Record<string, unknown> = {}): DiceThroneCommand => ({
    type, playerId, payload, timestamp: 100,
} as DiceThroneCommand);

describe('攻击前置效果的交互续接', () => {
    it('对手没有手牌时无需创建弃牌交互，后续凋零和防御正常进行', () => {
        const state = createHeroMatchup('cursed_pirate', 'barbarian')(['0', '1'], fixedRandom);
        state.core = reduce(state.core, {
            type: 'PLAYER_BOARD_FACE_CHANGED', payload: { playerId: '0', face: 'cursed', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST', timestamp: 90,
        } as DiceThroneEvent);
        state.sys.phase = 'offensiveRoll';
        state.core.rollCount = 1;
        state.core.rollConfirmed = true;
        state.core.players['1'].hand = [];
        state.core.pendingAttack = {
            attackerId: '0', defenderId: '1', sourceAbilityId: 'deep-sea-dive', isDefendable: true, damage: 8,
        };
        const result = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems }, state,
            command('ADVANCE_PHASE', '0'), fixedRandom, ['0', '1'],
        );
        expect(result.success).toBe(true);
        expect(result.state.core.players['1'].statusEffects[STATUS_IDS.WITHER]).toBe(1);
        expect(result.state.sys.phase).toBe('defensiveRoll');
        expect(result.state.sys.resolution?.frames ?? []).toHaveLength(0);
    });
    it('深海潜行弃牌前不能施加凋零，弃牌后继续效果并进入防御', () => {
        const state = createHeroMatchup('cursed_pirate', 'barbarian')(['0', '1'], fixedRandom);
        state.core = reduce(state.core, {
            type: 'PLAYER_BOARD_FACE_CHANGED', payload: { playerId: '0', face: 'cursed', sourceAbilityId: 'test-setup' },
            sourceCommandType: 'TEST', timestamp: 90,
        } as DiceThroneEvent);
        state.sys.phase = 'offensiveRoll';
        state.core.rollCount = 1;
        state.core.rollConfirmed = true;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['1'].hand = [getCardById('card-zhanshujia-strategic-defense')];
        state.core.pendingAttack = {
            attackerId: '0', defenderId: '1', sourceAbilityId: 'deep-sea-dive', isDefendable: true, damage: 8,
        };
        const advanced = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems }, state,
            command('ADVANCE_PHASE', '0'), fixedRandom, ['0', '1'],
        );
        expect(advanced.success).toBe(true);
        expect(getCardInteractionPrompt(advanced.state, 'deep-sea-dive').type).toBe('selectHandCard');
        expect(advanced.state.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(4);
        expect(advanced.state.core.players['1'].statusEffects[STATUS_IDS.WITHER] ?? 0).toBe(0);
        expect(advanced.state.sys.phase).toBe('offensiveRoll');
        const cancelled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems }, advanced.state,
            command('SYS_INTERACTION_CANCEL', '1'), fixedRandom, ['0', '1'],
        );
        expect(cancelled.success).toBe(false);
        expect(cancelled.state.sys.interaction.current?.id).toBe(advanced.state.sys.interaction.current?.id);
        const forced = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems }, advanced.state,
            command('SYS_FORCE_UNLOCK', '1'), fixedRandom, ['0', '1'],
        );
        expect(forced.success).toBe(false);
        expect(forced.state.sys.interaction.current?.id).toBe(advanced.state.sys.interaction.current?.id);
        const reloaded = JSON.parse(JSON.stringify(advanced.state)) as typeof advanced.state;
        const discarded = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems }, reloaded,
            command('RESOLVE_INTERACTION', '1', { selectedCardIds: ['card-zhanshujia-strategic-defense'] }), fixedRandom, ['0', '1'],
        );
        expect(discarded.success).toBe(true);
        expect(discarded.state.core.players['1'].hand).toHaveLength(0);
        expect(discarded.state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(6);
        expect(discarded.state.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(4);
        expect(discarded.state.core.players['1'].statusEffects[STATUS_IDS.WITHER]).toBe(1);
        expect(discarded.state.sys.phase).toBe('defensiveRoll');
    });
});
