import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, interceptEvent, isMinionProtected } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry, getEffectivePower } from '../../domain/ongoingModifiers';
import { SU_EVENTS } from '../../domain/types';
import { makeBase, makeMinion, makeState } from '../helpers';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('dino_upgrade 力量修正', () => {
    it('附着 upgrade 的随从不提供消灭保护（仅 +2 力量）', () => {
        const minion = makeMinion('m1', 'test_minion', '0', 3, {
            attachedActions: [{ uid: 'up-1', defId: 'dino_upgrade', ownerId: '0' }],
        });
        const state = makeState({ bases: [makeBase({ minions: [minion] })] });

        expect(isMinionProtected(state, minion, 0, '1', 'destroy')).toBe(false);
    });

    it('附着 upgrade 的随从 +2 力量', () => {
        const minion = makeMinion('m1', 'test_minion', '0', 3, {
            attachedActions: [{ uid: 'up-1', defId: 'dino_upgrade', ownerId: '0' }],
        });
        const state = makeState({ bases: [makeBase({ minions: [minion] })] });

        expect(getEffectivePower(state, minion, 0)).toBe(5);
    });
});

describe('dino_tooth_and_claw 保护', () => {
    it('附着此卡的随从不被其他玩家消灭（通过拦截器）', () => {
        const minion = makeMinion('m1', 'test_minion', '0', 3, {
            attachedActions: [{ uid: 'tc-1', defId: 'dino_tooth_and_claw', ownerId: '0' }],
        });
        const state = makeState({ bases: [makeBase({ minions: [minion] })] });
        const destroyEvent = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'm1',
                minionDefId: 'test_minion',
                fromBaseIndex: 0,
                ownerId: '1',
                reason: 'test',
            },
            timestamp: 0,
        };

        const result = interceptEvent(state, destroyEvent);

        expect(result).toBeDefined();
        expect(Array.isArray(result) ? result : [result]).toEqual(
            expect.arrayContaining([expect.objectContaining({ type: SU_EVENTS.ONGOING_DETACHED })]),
        );
        expect(isMinionProtected(state, minion, 0, '1', 'affect')).toBe(true);
        expect(isMinionProtected(state, minion, 0, '0', 'affect')).toBe(false);
    });
});
