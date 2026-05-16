import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry, triggerBaseAbility, triggerExtendedBaseAbility } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import { SU_EVENTS } from '../../domain/types';
import { makeBase, makeState } from '../helpers';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('alien_jammed_signal 基地能力压制', () => {
    it('压制常规基地触发（onActionPlayed）', () => {
        const normalState = makeState({
            bases: [makeBase({ defId: 'base_the_workshop' })],
        });
        const normalResult = triggerBaseAbility('base_the_workshop', 'onActionPlayed', {
            state: normalState,
            baseIndex: 0,
            baseDefId: 'base_the_workshop',
            playerId: '0',
            now: 0,
        });
        expect(normalResult.events.some(e => e.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(true);

        const suppressedState = makeState({
            bases: [makeBase({
                defId: 'base_the_workshop',
                ongoingActions: [{ uid: 'jam-1', defId: 'alien_jammed_signal', ownerId: '1' }],
            })],
        });
        const suppressedResult = triggerBaseAbility('base_the_workshop', 'onActionPlayed', {
            state: suppressedState,
            baseIndex: 0,
            baseDefId: 'base_the_workshop',
            playerId: '0',
            now: 0,
        });
        expect(suppressedResult.events).toEqual([]);
    });

    it('压制扩展基地触发（onMinionDestroyed）', () => {
        const normalState = makeState({
            bases: [makeBase({ defId: 'base_cave_of_shinies' })],
        });
        const normalResult = triggerExtendedBaseAbility('base_cave_of_shinies', 'onMinionDestroyed', {
            state: normalState,
            baseIndex: 0,
            baseDefId: 'base_cave_of_shinies',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'test_minion',
            now: 0,
        });
        expect(normalResult.events.some(e => e.type === SU_EVENTS.VP_AWARDED)).toBe(true);

        const suppressedState = makeState({
            bases: [makeBase({
                defId: 'base_cave_of_shinies',
                ongoingActions: [{ uid: 'jam-1', defId: 'alien_jammed_signal', ownerId: '1' }],
            })],
        });
        const suppressedResult = triggerExtendedBaseAbility('base_cave_of_shinies', 'onMinionDestroyed', {
            state: suppressedState,
            baseIndex: 0,
            baseDefId: 'base_cave_of_shinies',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'test_minion',
            now: 0,
        });
        expect(suppressedResult.events).toEqual([]);
    });
});
