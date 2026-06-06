import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities } from '../../abilities';
import { triggerBaseAbility } from '../../domain/baseAbilities';
import type { BaseAbilityContext } from '../../domain/baseAbilities';
import { collectBaseAbilityTriggers } from '../../domain/baseAbilityQueue';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { SU_EVENTS } from '../../domain/types';
import {
    getInteractionsFromResult,
    getPromptOption,
    getPromptPlayerId,
    getPromptSourceId,
    getPromptTargetType,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
    triggerBaseAbilityWithMS,
    withOnlyCurrentPrompt,
} from '../helpers';
import { defaultTestRandom } from '../testRunner';

beforeAll(() => {
    initAllAbilities();
});

function makeCtx(overrides: Partial<BaseAbilityContext>): BaseAbilityContext {
    const state = overrides.state ?? makeState();
    return {
        state,
        matchState: makeMatchState(state),
        baseIndex: 0,
        baseDefId: 'test_base',
        playerId: '0',
        now: 1000,
        ...overrides,
    };
}

describe('base_innsmouth_base: 印斯茅斯 - 弃牌堆卡入牌库底', () => {
    it('弃牌堆有卡时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_innsmouth_base', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase({
                    defId: 'base_innsmouth_base',
                    minions: [{
                        uid: 'm1',
                        defId: 'test_minion',
                        controller: '0',
                        owner: '1',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    } as any],
                })],
                players: {
                    '0': makePlayer('0', {
                        discard: [makeCard('d1', 'test_card', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_innsmouth_base',
            minionUid: 'm1',
        }));

        expect(result.events).toHaveLength(0);
        const interactions = getInteractionsFromResult(result);
        expect(interactions).toHaveLength(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_innsmouth_base_choose_player');
        expect(getPromptTargetType(interactions[0])).toBe('player');
        expect(getPromptPlayerId(interactions[0])).toBe('1');
    });

    it('所有弃牌堆为空时不触发', () => {
        const { events } = triggerBaseAbility('base_innsmouth_base', 'onMinionPlayed', makeCtx({
            state: makeState({ bases: [makeBase('base_innsmouth_base')] }),
            baseDefId: 'base_innsmouth_base',
            minionUid: 'm1',
        }));

        expect(events).toHaveLength(0);
    });

    it('queued reaction 选择印斯茅斯时不会被 effect contract 拦截', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_innsmouth_base',
                    minions: [makeMinion('m1', 'innsmouth_the_locals', '0', 2)],
                }),
            ],
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('d1', 'wizard_scry', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const queued = collectBaseAbilityTriggers({
            core,
            timing: 'onMinionPlayed',
            ownerPlayerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'm1',
            triggerMinionDefId: 'innsmouth_the_locals',
            triggerMinionPower: 2,
            frameId: 'minion-played-frame:m1:0:1000',
            sourceEventId: 'minion-played:m1:0:1000',
            now: 1000,
        }) as any;
        const reaction = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: queued.payload.triggers }),
            defaultTestRandom,
            1001,
        );
        const resolved = respondToPromptOption(
            reaction!.state as any,
            (entry: any) => entry.id.startsWith('trigger:'),
            'Innsmouth reaction trigger option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success).toBe(true);

        expect(resolved.events.some(event => event.type === SU_EVENTS.TRIGGER_CONSUMED)).toBe(true);
        expect(getSimpleChoicePrompt(resolved.finalState as any, 'base_innsmouth_base_choose_player')).toBeDefined();
    });

    it('若所选卡已不在弃牌堆则不再放牌库底', () => {
        const result = triggerBaseAbilityWithMS('base_innsmouth_base', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_innsmouth_base')],
                players: {
                    '0': makePlayer('0', {
                        discard: [makeCard('d1', 'test_card', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_innsmouth_base',
            minionUid: 'm1',
        }));
        const choosePlayer = getInteractionsFromResult(result)[0];
        expect(getPromptSourceId(choosePlayer)).toBe('base_innsmouth_base_choose_player');
        expect(getPromptTargetType(choosePlayer)).toBe('player');

        const step1 = respondToPromptOption(
            result.matchState!,
            (entry: any) => entry.value?.targetPlayerId === '0',
            'Innsmouth choose-player option',
            '0',
            defaultTestRandom,
        );
        expect(step1.success).toBe(true);
        const chooseCard = getSimpleChoicePrompt(step1.finalState as any, 'base_innsmouth_base_choose_card');
        const chooseCardOption = getPromptOption(chooseCard, (entry: any) => entry.value?.cardUid === 'd1');
        expect(getPromptSourceId(chooseCard)).toBe('base_innsmouth_base_choose_card');
        expect(chooseCardOption).toBeDefined();

        const staleCore = makeState({
            bases: [makeBase('base_innsmouth_base')],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('d1', 'test_card', 'minion', '0')],
                    discard: [],
                }),
                '1': makePlayer('1'),
            },
        });

        const staleState = withOnlyCurrentPrompt(makeMatchState(staleCore), chooseCard);
        const resolved = respondToPromptOption(
            staleState,
            (entry: any) => entry.value?.cardUid === 'd1',
            'Innsmouth choose-card stale option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(false);
    });

    it('base_innsmouth_base_choose_card: 选择 borrowed 弃牌时应放回真实 owner 牌库底并保留 sourcePlayerId', () => {
        const result = triggerBaseAbilityWithMS('base_innsmouth_base', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_innsmouth_base')],
                players: {
                    '0': makePlayer('0', {
                        discard: [makeCard('borrowed-discard', 'test_card', 'action', '1')],
                    }),
                    '1': makePlayer('1', {
                        deck: [makeCard('owner-deck-1', 'owner_card', 'minion', '1')],
                    }),
                },
            }),
            baseDefId: 'base_innsmouth_base',
            minionUid: 'm1',
        }));

        const choosePlayer = getInteractionsFromResult(result)[0];
        expect(getPromptSourceId(choosePlayer)).toBe('base_innsmouth_base_choose_player');

        const step1 = respondToPromptOption(
            result.matchState!,
            (entry: any) => entry.value?.targetPlayerId === '0',
            'Innsmouth choose-player borrowed discard option',
            '0',
            defaultTestRandom,
        );
        expect(step1.success).toBe(true);

        const chooseCard = getSimpleChoicePrompt(step1.finalState as any, 'base_innsmouth_base_choose_card');
        const chooseCardOption = getPromptOption(chooseCard, (entry: any) => entry.value?.cardUid === 'borrowed-discard');
        expect(chooseCardOption).toBeDefined();

        const resolved = respondToPromptOption(
            step1.finalState as any,
            (entry: any) => entry.value?.cardUid === 'borrowed-discard',
            'Innsmouth choose-card borrowed discard option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success).toBe(true);

        const cardToDeckBottom = resolved.events.find(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM) as any;
        expect(cardToDeckBottom).toBeDefined();
        expect(cardToDeckBottom.payload).toEqual(expect.objectContaining({
            cardUid: 'borrowed-discard',
            defId: 'test_card',
            ownerId: '1',
            sourcePlayerId: '0',
        }));

        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'borrowed-discard')).toBe(false);
        expect(resolved.finalState.core.players['0'].deck.some(card => card.uid === 'borrowed-discard')).toBe(false);
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['owner-deck-1', 'borrowed-discard']);
    });

    it('borrowed Infiltrate 不应按真实 owner 错误阻止其他玩家的 Innsmouth Base 触发', () => {
        const result = triggerBaseAbilityWithMS('base_innsmouth_base', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase({
                    defId: 'base_innsmouth_base',
                    minions: [{
                        uid: 'p1-minion',
                        defId: 'test_minion',
                        controller: '1',
                        owner: '1',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    } as any],
                    ongoingActions: [{
                        uid: 'borrowed-infiltrate',
                        defId: 'ninja_infiltrate',
                        ownerId: '1',
                        metadata: { sourceControllerId: '0' },
                    } as any],
                })],
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', {
                        discard: [makeCard('p1-discard', 'test_card', 'action', '1')],
                    }),
                },
            }),
            baseDefId: 'base_innsmouth_base',
            minionUid: 'p1-minion',
            playerId: '1',
        }));

        expect(result.events).toHaveLength(0);
        const interactions = getInteractionsFromResult(result);
        expect(interactions).toHaveLength(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_innsmouth_base_choose_player');
        expect(getPromptPlayerId(interactions[0])).toBe('1');
    });
});
