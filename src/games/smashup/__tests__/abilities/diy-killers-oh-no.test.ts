import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { buildSmashUpAiLegalActions } from '../../ai';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { SU_COMMANDS } from '../../domain/types';
import { makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState } from '../helpers';
import { runCommand } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('哦 不！！！特殊响应', () => {
    it('AI 在真实移动与摧毁链中打出特殊行动，回合结束后清除力量', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [
                    makeCard('chacha', 'diy_killers_cha_cha_cha_ha_ha_ha', 'action', '0'),
                    makeCard('oh-no', 'diy_killers_oh_no', 'action', '0'),
                ] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [makeMinion('jason', 'diy_killers_jason', '0', 5), makeMinion('boost', 'pirate_first_mate', '0', 2)]),
                makeBase('base_b', [makeMinion('victim', 'ninja_acolyte', '1', 2)]),
            ],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'chacha' } });
        expect(played.success, played.error).toBe(true);
        const select = (current: typeof state, predicate: (value: any) => boolean) => {
            const actions = buildSmashUpAiLegalActions({ playerId: '0', state: current });
            expect(actions.every(action => action.kind === 'interaction-choice')).toBe(true);
            const action = actions.find(candidate => predicate(candidate.metadata?.optionValue));
            expect(action, JSON.stringify({ current: current.sys.interaction?.current, actions })).toBeDefined();
            const result = runCommand(current, { ...action!.commands[0], playerId: '0' } as any);
            expect(result.success, result.error).toBe(true);
            return result.finalState;
        };
        const minion = select(played.finalState, value => value?.minionUid === 'jason');
        const moved = select(minion, value => value?.baseIndex === 1);
        const followed = select(moved, value => value?.skip === true);
        const reacted = select(followed, value => value?.triggerId?.includes('diy_killers_jason'));
        const destroyed = select(reacted, value => value?.minionUid === 'victim');
        expect(destroyed.core.triggerQueue?.some(trigger => trigger.sourceDefId === 'diy_killers_oh_no' && trigger.sourceCardUid === 'oh-no')).toBe(true);
        const special = select(destroyed, value => value?.triggerId?.includes('diy_killers_oh_no'));
        const boosted = select(special, value => value?.minionUid === 'boost');
        expect(boosted.core.players['1'].discard.some(card => card.uid === 'victim')).toBe(true);
        expect(boosted.core.players['0'].discard.some(card => card.uid === 'oh-no')).toBe(true);
        expect(boosted.core.bases[0].minions.find(minion => minion.uid === 'boost')?.tempPowerModifier).toBe(3);
        expect(boosted.sys.interaction?.current).toBeUndefined();
        const advanced = runCommand(boosted, { type: 'ADVANCE_PHASE', playerId: '0' } as any);
        expect(advanced.success, advanced.error).toBe(true);
        expect(advanced.finalState.core.bases[0].minions.find(minion => minion.uid === 'boost')?.tempPowerModifier ?? 0).toBe(0);
    });
});
