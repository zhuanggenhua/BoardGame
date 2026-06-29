import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import {
    countSemanticControlledRuntimeActions,
    countSemanticMatchedMinionCandidates,
} from '../domain/effectSemantics';
import { makeBase, makeMinion, makeState } from './helpers';

function makeIncorporealProtectedMatchingMinion(uid: string, controller: '0' | '1') {
    return makeMinion(uid, 'robot_microbot_fixer', controller, 2, {
        attachedActions: [{ uid: `${uid}-inc`, defId: 'ghost_incorporeal', ownerId: controller, metadata: {} }],
    });
}

describe('SmashUp semantic runtime queries', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        resetAbilityInit();
        initAllAbilities();
    });

    afterEach(() => {
        clearOngoingEffectRegistry();
        resetAbilityInit();
    });

    it('material 查询仍会计入受保护的同类随从', () => {
        const protectedMinion = makeIncorporealProtectedMatchingMinion('prot-1', '1');
        const otherMinion = makeMinion('other-1', 'robot_microbot_fixer', '0', 2);
        const state = makeState({
            bases: [makeBase('test_base', [protectedMinion, otherMinion])],
        });

        const count = countSemanticMatchedMinionCandidates(
            state,
            state.bases[0].minions.map((minion) => ({ minion, baseIndex: 0 })),
            'robot_microbot_fixer',
            { semanticRole: 'material' },
        );

        expect(count).toBe(2);
    });

    it('target 查询会在共享语义层拦截受保护的同类随从', () => {
        const protectedMinion = makeIncorporealProtectedMatchingMinion('prot-1', '1');
        const otherMinion = makeMinion('other-1', 'robot_microbot_fixer', '0', 2);
        const state = makeState({
            bases: [makeBase('test_base', [protectedMinion, otherMinion]), makeBase('other_base')],
        });

        const count = countSemanticMatchedMinionCandidates(
            state,
            state.bases[0].minions.map((minion) => ({ minion, baseIndex: 0 })),
            'robot_microbot_fixer',
            {
                semanticRole: 'target',
                sourcePlayerId: '0',
                sourceDefId: 'alien_abduction',
                sourceKind: 'action',
                effectType: 'move',
                respectActionProtection: true,
                mode: 'apply',
            },
        );

        expect(count).toBe(1);
    });

    it('共享 action controller 查询按控制者统计基地 ongoing 与附着行动', () => {
        const host = makeMinion('host-1', 'test_minion', '1', 3, {
            attachedActions: [{
                uid: 'attached-1',
                defId: 'test_action',
                ownerId: '1',
                metadata: { sourceControllerId: '0' },
            }],
        });
        const state = makeState({
            bases: [makeBase({
                defId: 'test_base',
                minions: [host],
                ongoingActions: [{
                    uid: 'ongoing-1',
                    defId: 'test_action',
                    ownerId: '1',
                    metadata: { sourceControllerId: '0' },
                }],
            })],
        });

        const count = countSemanticControlledRuntimeActions(state.bases[0], '0');

        expect(count).toBe(2);
    });

    it('共享 minion 查询可按精确来源 defId 区分 base 与 pod 提供者', () => {
        const baseFixer = makeMinion('fixer-base', 'robot_microbot_fixer', '0', 1);
        const podFixer = makeMinion('fixer-pod', 'robot_microbot_fixer_pod', '0', 1);
        const state = makeState({
            bases: [makeBase('test_base', [baseFixer, podFixer])],
        });

        const allFixers = countSemanticMatchedMinionCandidates(
            state,
            state.bases[0].minions.map((minion) => ({ minion, baseIndex: 0 })),
            'robot_microbot_fixer',
            { semanticRole: 'material' },
        );
        const podOnlyFixers = countSemanticMatchedMinionCandidates(
            state,
            state.bases[0].minions.map((minion) => ({ minion, baseIndex: 0 })),
            'robot_microbot_fixer',
            { exactDefId: 'robot_microbot_fixer_pod', semanticRole: 'material' },
        );

        expect(allFixers).toBe(2);
        expect(podOnlyFixers).toBe(1);
    });
});
