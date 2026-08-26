import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry, resolveSpecial } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { getDiscardSpecialOptions } from '../../domain/discardSpecialAbilities';
import { clearOngoingEffectRegistry, collectTriggers, fireTriggers } from '../../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { reduce } from '../../domain/reduce';
import { validate } from '../../domain/commands';
import { startSmashUpReactionSession } from '../../domain/reactionSession';
import {
    makeMinion,
    makeCard,
    makePlayer,
    makeState,
    makeMatchState,
    getReactionPrompt,
    getReactionPromptOptionBySourceDefId,
    getSimpleChoicePrompt,
    getPromptOption,
    getPromptOptions,
    respondToPrompt,
    respondToPromptOptions,
} from '../helpers';
import { runCommand, defaultTestRandom } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('Skeletons abilities', () => {
    it('skeletons_returned_one 可把自己埋葬到当前基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('returned-one', 'skeletons_returned_one', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'returned-one', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(played.finalState, 'skeletons_returned_one');

        const selfOption = getPromptOption(prompt, entry => entry.value?.cardUid === 'returned-one', 'returned one self bury');
        expect(selfOption?.value?.buriedFrom).toBe('play');

        const resolved = respondToPrompt(
            played.finalState,
            selfOption.id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'returned-one')).toBe(false);
        expect((resolved.finalState.core.bases[0].buriedCards ?? []).some(card => card.uid === 'returned-one')).toBe(true);
    });

    it('skeletons_returned_one 自埋 borrowed 随从时应保留真实 trueOwnerId', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('returned-one', 'skeletons_returned_one', 'minion', '1')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'returned-one', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(played.finalState, 'skeletons_returned_one');
        const selfOption = getPromptOption(prompt, entry => entry.value?.cardUid === 'returned-one', 'borrowed returned one self bury');

        const resolved = respondToPrompt(
            played.finalState,
            selfOption.id,
            '0',
            defaultTestRandom,
        );

        const buriedCard = resolved.finalState.core.bases[0].buriedCards?.find(card => card.uid === 'returned-one');
        expect(buriedCard).toBeDefined();
        expect(buriedCard?.controllerId).toBe('0');
        expect(buriedCard?.trueOwnerId).toBe('1');
    });

    it('skeletons_returned_one 被挖掘后可再挖同基地另一张埋葬牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [] }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('returned-one', 'skeletons_returned_one', '0', 2, { powerModifier: 0, metadata: { playedFrom: 'buried' } }),
                ],
                ongoingActions: [],
                buriedCards: [
                    { uid: 'buried-a', defId: 'robot_microbot_alpha', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' },
                ],
            }],
        });

        const triggered = fireTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'returned-one',
            triggerMinionDefId: 'skeletons_returned_one',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 3100,
        });
        const prompt = getSimpleChoicePrompt(triggered.matchState ?? makeMatchState(core), 'skeletons_returned_one_uncover');
        const option = getPromptOption(prompt, entry => entry.value?.cardUid === 'buried-a', 'option');

        const resolved = respondToPrompt(
            triggered.matchState ?? makeMatchState(core),
            option.id,
            '0',
            defaultTestRandom,
        );
        expect(resolved.events.some(event => event.type === SU_EVENTS.BURIED_CARD_UNCOVERED)).toBe(true);
        expect((resolved.finalState.core.bases[0].buriedCards ?? []).some(card => card.uid === 'buried-a')).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'buried-a')).toBe(true);
    });

    it('skeletons_returned_one 被挖掘后若同基地没有其他己方埋葬牌，不应进入反应队列', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [] }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('returned-one', 'skeletons_returned_one', '0', 2, { powerModifier: 0, metadata: { playedFrom: 'buried' } }),
                ],
                ongoingActions: [],
                buriedCards: [],
            }],
        });

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'returned-one',
            triggerMinionDefId: 'skeletons_returned_one',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 3200,
        });

        expect(queued).toBeUndefined();
    });

    it('skeletons_place_em_down 从弃牌堆埋葬最多三张且先选基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('place-1', 'skeletons_place_em_down', 'action', '0')],
                    discard: [
                        makeCard('discard-a', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('discard-b', 'robot_microbot_beta', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'place-1' } },
            defaultTestRandom,
        );
        const basePrompt = getSimpleChoicePrompt(played.finalState, 'skeletons_place_em_down_base');
        const baseOption = getPromptOption(basePrompt, entry => entry.value?.baseIndex === 1, 'baseOption');

        const afterBase = respondToPrompt(
            played.finalState,
            baseOption.id,
            '0',
            defaultTestRandom,
        );
        const cardsPrompt = getSimpleChoicePrompt(afterBase.finalState, 'skeletons_place_em_down_cards');
        const cardA = getPromptOption(cardsPrompt, entry => entry.value?.cardUid === 'discard-a', 'discard-a');
        const cardB = getPromptOption(cardsPrompt, entry => entry.value?.cardUid === 'discard-b', 'cardB');
        expect(cardB).toBeDefined();

        const resolved = respondToPromptOptions(
            afterBase.finalState,
            [cardA.id, cardB.id],
            '0',
            defaultTestRandom,
        );

        const buried = resolved.finalState.core.bases[1].buriedCards ?? [];
        expect(buried.some(card => card.uid === 'discard-a')).toBe(true);
        expect(buried.some(card => card.uid === 'discard-b')).toBe(true);
    });

    it('skeletons_place_em_down 埋葬 borrowed 弃牌堆随从时应保留真实 trueOwnerId', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('place-1', 'skeletons_place_em_down', 'action', '0')],
                    discard: [
                        makeCard('discard-a', 'robot_microbot_alpha', 'minion', '1'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'place-1' } },
            defaultTestRandom,
        );
        const basePrompt = getSimpleChoicePrompt(played.finalState, 'skeletons_place_em_down_base');
        const baseOption = getPromptOption(basePrompt, entry => entry.value?.baseIndex === 1, 'baseOption');

        const afterBase = respondToPrompt(
            played.finalState,
            baseOption.id,
            '0',
            defaultTestRandom,
        );
        const cardsPrompt = getSimpleChoicePrompt(afterBase.finalState, 'skeletons_place_em_down_cards');
        const borrowedOption = getPromptOption(cardsPrompt, entry => entry.value?.cardUid === 'discard-a', 'borrowed discard-a');

        const resolved = respondToPromptOptions(
            afterBase.finalState,
            [borrowedOption.id],
            '0',
            defaultTestRandom,
        );

        const buriedCard = resolved.finalState.core.bases[1].buriedCards?.find(card => card.uid === 'discard-a');
        expect(buriedCard).toBeDefined();
        expect(buriedCard?.controllerId).toBe('0');
        expect(buriedCard?.trueOwnerId).toBe('1');
    });

    it('skeletons_dig_em_up 可选择基地后挖掘最多三张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('dig-1', 'skeletons_dig_em_up', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
                buriedCards: [
                    { uid: 'buried-a', defId: 'robot_microbot_alpha', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' },
                    { uid: 'buried-b', defId: 'robot_microbot_beta', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' },
                ],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'dig-1' } },
            defaultTestRandom,
        );
        const basePrompt = getSimpleChoicePrompt(played.finalState, 'skeletons_dig_em_up_base');

        const afterBase = respondToPrompt(
            played.finalState,
            getPromptOptions(basePrompt)[0].id,
            '0',
            defaultTestRandom,
        );
        const cardsPrompt = getSimpleChoicePrompt(afterBase.finalState, 'skeletons_dig_em_up_cards');
        const option = getPromptOption(cardsPrompt, entry => entry.value?.cardUid === 'buried-a', 'option');

        const resolved = respondToPromptOptions(
            afterBase.finalState,
            [option.id],
            '0',
            defaultTestRandom,
        );

        expect(resolved.events.some(event => event.type === SU_EVENTS.BURIED_CARD_UNCOVERED)).toBe(true);
        expect((resolved.finalState.core.bases[0].buriedCards ?? []).some(card => card.uid === 'buried-a')).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'buried-a')).toBe(true);
    });

    it('skeletons_burst_forth special 可在指定基地挖掘埋葬牌', () => {
        const executor = resolveSpecial('skeletons_burst_forth');
        expect(executor).toBeDefined();

        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
                buriedCards: [
                    { uid: 'buried-a', defId: 'robot_microbot_alpha', trueOwnerId: '0', controllerId: '0', buriedFrom: 'discard' },
                ],
            }],
        });

        const executed = executor!({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'burst-1',
            defId: 'skeletons_burst_forth',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 3900,
        });
        getSimpleChoicePrompt(executed.matchState ?? makeMatchState(core), 'skeletons_burst_forth');
    });

    it('skeletons_burst_forth 在多基地计分前只能响应当前计分基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('burst-1', 'skeletons_burst_forth', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [],
                    buriedCards: [
                        { uid: 'buried-a', defId: 'robot_microbot_alpha', trueOwnerId: '0', controllerId: '0', buriedFrom: 'discard' },
                    ],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                    buriedCards: [],
                },
            ],
            scoringEligibleBaseIndices: [0, 1],
        });
        const scoringState = makeMatchState(core);
        const reactionState = startSmashUpReactionSession(
            { ...scoringState, sys: { ...scoringState.sys, phase: 'scoreBases' } },
            {
                frameId: 'score-before:0:skeletons-burst-forth',
                frameKind: 'score-before',
                phase: 'optional',
                activePlayerId: '0',
                currentPlayerId: '0',
                consecutivePasses: 0,
                sourceBaseIndex: 0,
                responseWindowType: 'meFirst',
            },
        );

        const wrongBaseValidation = validate(reactionState, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { handCardUid: 'burst-1', baseIndex: 1 },
        } as any);
        expect(wrongBaseValidation.valid).toBe(false);

        const used = runCommand(
            reactionState,
            {
                type: SU_COMMANDS.ACTIVATE_SPECIAL,
                playerId: '0',
                payload: { handCardUid: 'burst-1', baseIndex: 0 },
            } as any,
            defaultTestRandom,
        );
        expect(used.success).toBe(true);
        const prompt = getSimpleChoicePrompt(used.finalState, 'skeletons_burst_forth');
        expect(getPromptOptions(prompt).some((entry: any) => entry.value?.cardUid === 'buried-a' && entry.value?.baseIndex === 0)).toBe(true);
        expect(getPromptOptions(prompt).some((entry: any) => entry.value?.baseIndex === 1)).toBe(false);
    });

    it('skeletons_graveyard 天赋挖掘后若是随从会进入可选 +1 指示物交互', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [{ uid: 'graveyard-1', defId: 'skeletons_graveyard', ownerId: '0', talentUsed: false }],
                buriedCards: [
                    { uid: 'buried-a', defId: 'robot_microbot_alpha', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' },
                ],
            }],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { ongoingCardUid: 'graveyard-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(used.finalState, 'skeletons_graveyard');
        const option = getPromptOption(prompt, entry => entry.value?.cardUid === 'buried-a', 'option');

        const resolved = respondToPrompt(
            used.finalState,
            option.id,
            '0',
            defaultTestRandom,
        );
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'buried-a')).toBe(true);
        const counterPrompt = getSimpleChoicePrompt(resolved.finalState, 'skeletons_graveyard_counter');

        const applied = respondToPrompt(
            resolved.finalState,
            getPromptOptions(counterPrompt)[0].id,
            '0',
            defaultTestRandom,
        );
        expect(applied.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);
    });

    it('skeletons_graveyard 挖出轮回者后，不能把刚翻出的自己立即重新埋葬', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [{ uid: 'graveyard-1', defId: 'skeletons_graveyard', ownerId: '0', talentUsed: false }],
                buriedCards: [
                    { uid: 'returned-one', defId: 'skeletons_returned_one', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' },
                    { uid: 'other-buried', defId: 'robot_microbot_alpha', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' },
                ],
            }],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { ongoingCardUid: 'graveyard-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const graveyardPrompt = getSimpleChoicePrompt(used.finalState, 'skeletons_graveyard');
        const returnedOneOption = getPromptOption(graveyardPrompt, entry => entry.value?.cardUid === 'returned-one', 'returned one');

        const afterUncover = respondToPrompt(
            used.finalState,
            returnedOneOption.id,
            '0',
            defaultTestRandom,
        );
        const counterPrompt = getSimpleChoicePrompt(afterUncover.finalState, 'skeletons_graveyard_counter');
        const afterCounter = respondToPrompt(
            afterUncover.finalState,
            getPromptOptions(counterPrompt)[0].id,
            '0',
            defaultTestRandom,
        );
        const returnedOneSelfBuryPrompt = getSimpleChoicePrompt(afterCounter.finalState, 'skeletons_returned_one');
        const selfBuryOption = getPromptOption(returnedOneSelfBuryPrompt, entry => entry.value?.cardUid === 'returned-one', 'returned one self bury');

        const afterRejectedRebury = respondToPrompt(
            afterCounter.finalState,
            selfBuryOption.id,
            '0',
            defaultTestRandom,
        );

        expect(afterRejectedRebury.finalState.core.bases[0].minions.some(minion => minion.uid === 'returned-one')).toBe(true);
        expect(afterRejectedRebury.finalState.core.bases[0].buriedCards?.some(card => card.uid === 'returned-one') ?? false).toBe(false);

        const reactionPrompt = getReactionPrompt(afterRejectedRebury.finalState);
        const returnedOneReaction = getReactionPromptOptionBySourceDefId(afterRejectedRebury.finalState, reactionPrompt, 'skeletons_returned_one');
        const afterReaction = respondToPrompt(
            afterRejectedRebury.finalState,
            returnedOneReaction.id,
            '0',
            defaultTestRandom,
        );
        const returnedOnePrompt = getSimpleChoicePrompt(afterReaction.finalState, 'skeletons_returned_one_uncover');

        expect(getPromptOptions(returnedOnePrompt).some(option => option.value?.cardUid === 'returned-one')).toBe(false);
        expect(getPromptOptions(returnedOnePrompt).some(option => option.value?.cardUid === 'other-buried')).toBe(true);
    });

    it('skeletons_graveyard 挖出随从时应能叠加墓碑的 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [
                    { uid: 'graveyard-1', defId: 'skeletons_graveyard', ownerId: '0', talentUsed: false },
                    { uid: 'gravestones-1', defId: 'skeletons_gravestones', ownerId: '0' },
                ],
                buriedCards: [
                    { uid: 'buried-a', defId: 'robot_microbot_alpha', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' },
                ],
            }],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { ongoingCardUid: 'graveyard-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const graveyardPrompt = getSimpleChoicePrompt(used.finalState, 'skeletons_graveyard');
        const buriedOption = getPromptOption(graveyardPrompt, entry => entry.value?.cardUid === 'buried-a', 'buried minion');

        const afterUncover = respondToPrompt(
            used.finalState,
            buriedOption.id,
            '0',
            defaultTestRandom,
        );
        const graveyardCounter = getSimpleChoicePrompt(afterUncover.finalState, 'skeletons_graveyard_counter');
        const afterGraveyardCounter = respondToPrompt(
            afterUncover.finalState,
            getPromptOptions(graveyardCounter)[0].id,
            '0',
            defaultTestRandom,
        );
        const reactionPrompt = getReactionPrompt(afterGraveyardCounter.finalState);
        const gravestonesReaction = getReactionPromptOptionBySourceDefId(afterGraveyardCounter.finalState, reactionPrompt, 'skeletons_gravestones');
        const afterReaction = respondToPrompt(
            afterGraveyardCounter.finalState,
            gravestonesReaction.id,
            '0',
            defaultTestRandom,
        );
        const gravestonesCounter = getSimpleChoicePrompt(afterReaction.finalState, 'skeletons_gravestones_counter');
        const resolved = respondToPrompt(
            afterReaction.finalState,
            getPromptOptions(gravestonesCounter)[0].id,
            '0',
            defaultTestRandom,
        );

        const minion = resolved.finalState.core.bases[0].minions.find(entry => entry.uid === 'buried-a');
        expect(minion?.powerCounters).toBe(2);
    });

    it('skeletons_lord_of_bones 天赋可选择从手牌埋葬', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hand-a', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('lob-1', 'skeletons_lord_of_bones', '0', 5, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'lob-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const modePrompt = getSimpleChoicePrompt(used.finalState, 'skeletons_lord_of_bones_bury');
        const option = getPromptOption(modePrompt, entry => entry.value?.cardUid === 'hand-a', 'option');

        const resolved = respondToPrompt(
            used.finalState,
            option.id,
            '0',
            defaultTestRandom,
        );
        expect((resolved.finalState.core.bases[0].buriedCards ?? []).some(card => card.uid === 'hand-a')).toBe(true);
    });

    it('skeletons_lord_of_bones 天赋可挖掘这里任意埋葬牌而不只限自己', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('lob-1', 'skeletons_lord_of_bones', '0', 5, { powerModifier: 0 })],
                ongoingActions: [],
                buriedCards: [
                    { uid: 'enemy-buried', defId: 'robot_microbot_alpha', trueOwnerId: '1', controllerId: '1', buriedFrom: 'hand' },
                ],
            }],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'lob-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(used.finalState, 'skeletons_lord_of_bones_uncover');
        const option = getPromptOption(prompt, entry => entry.value?.cardUid === 'enemy-buried', 'option');

        const resolved = respondToPrompt(
            used.finalState,
            option.id,
            '0',
            defaultTestRandom,
        );
        expect(resolved.events.some(event => event.type === SU_EVENTS.BURIED_CARD_UNCOVERED && (event as any).payload?.cardUid === 'enemy-buried')).toBe(true);
        expect((resolved.finalState.core.bases[0].buriedCards ?? []).some(card => card.uid === 'enemy-buried')).toBe(false);
    });

    it('skeletons_grave_goods 只有手牌时应直接进入埋葬分支而不是报无目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('grave-goods-1', 'skeletons_grave_goods', 'action', '0'),
                        makeCard('hand-a', 'robot_microbot_alpha', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'grave-goods-1' } },
            defaultTestRandom,
        );

        getSimpleChoicePrompt(played.finalState, 'skeletons_grave_goods_base');
        expect(played.events.some(event => event.type === SU_EVENTS.ABILITY_FEEDBACK && (event as any).payload?.feedbackKey === 'feedback.no_valid_targets')).toBe(false);
    });

    it('skeletons_grave_goods 首次埋葬后若只剩埋葬牌应直接进入挖掘分支', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('grave-goods-1', 'skeletons_grave_goods', 'action', '0'),
                        makeCard('hand-a', 'robot_microbot_alpha', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'grave-goods-1' } },
            defaultTestRandom,
        );

        const basePrompt = getSimpleChoicePrompt(played.finalState, 'skeletons_grave_goods_base');
        const baseOption = getPromptOption(basePrompt, entry => entry.value?.baseIndex === 0, 'baseOption');

        const afterBase = respondToPrompt(
            played.finalState,
            baseOption.id,
            '0',
            defaultTestRandom,
        );
        const buryPrompt = getSimpleChoicePrompt(afterBase.finalState, 'skeletons_grave_goods_bury');
        const buryOption = getPromptOption(buryPrompt, entry => entry.value?.cardUid === 'hand-a', 'buryOption');

        const afterBury = respondToPrompt(
            afterBase.finalState,
            buryOption.id,
            '0',
            defaultTestRandom,
        );
        expect((afterBury.finalState.core.bases[0].buriedCards ?? []).some((card: any) => card.uid === 'hand-a')).toBe(true);
        getSimpleChoicePrompt(afterBury.finalState, 'skeletons_grave_goods_uncover');
    });

    it('skeletons_grave_goods 首次埋葬后若只剩一张手牌不能额外埋葬另一张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('grave-goods-1', 'skeletons_grave_goods', 'action', '0'),
                        makeCard('bury-first', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('last-hand', 'robot_microbot_beta', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
                buriedCards: [
                    { uid: 'buried-a', defId: 'robot_microbot_alpha', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' },
                ],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'grave-goods-1' } },
            defaultTestRandom,
        );
        const basePrompt = getSimpleChoicePrompt(played.finalState, 'skeletons_grave_goods_base');
        const baseOption = getPromptOption(basePrompt, entry => entry.value?.baseIndex === 0, 'baseOption');

        const afterBase = respondToPrompt(
            played.finalState,
            baseOption.id,
            '0',
            defaultTestRandom,
        );
        const buryPrompt = getSimpleChoicePrompt(afterBase.finalState, 'skeletons_grave_goods_bury');
        const buryOption = getPromptOption(buryPrompt, entry => entry.value?.cardUid === 'bury-first', 'buryOption');

        const afterBury = respondToPrompt(
            afterBase.finalState,
            buryOption.id,
            '0',
            defaultTestRandom,
        );
        const nextPrompt = getSimpleChoicePrompt(afterBury.finalState, 'skeletons_grave_goods_uncover');
        expect(getPromptOptions(nextPrompt).some((entry: any) => entry.value?.mode === 'extra_bury')).toBe(false);
    });

    it('skeletons_grave_goods 首次埋葬后可在额外埋葬与挖掘之间二选一', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('grave-goods-1', 'skeletons_grave_goods', 'action', '0'),
                        makeCard('bury-first', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('discard-cost', 'robot_microbot_beta', 'minion', '0'),
                        makeCard('bury-extra', 'robot_microbot_beta', 'minion', '0'),
                        makeCard('buffer-hand', 'robot_microbot_beta', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
                buriedCards: [
                    { uid: 'buried-a', defId: 'robot_microbot_alpha', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' },
                ],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'grave-goods-1' } },
            defaultTestRandom,
        );
        const basePrompt = getSimpleChoicePrompt(played.finalState, 'skeletons_grave_goods_base');
        const baseOption = getPromptOption(basePrompt, entry => entry.value?.baseIndex === 0, 'baseOption');

        const afterBase = respondToPrompt(
            played.finalState,
            baseOption.id,
            '0',
            defaultTestRandom,
        );
        const buryPrompt = getSimpleChoicePrompt(afterBase.finalState, 'skeletons_grave_goods_bury');
        const buryOption = getPromptOption(buryPrompt, entry => entry.value?.cardUid === 'bury-first', 'buryOption');

        const afterFirstBury = respondToPrompt(
            afterBase.finalState,
            buryOption.id,
            '0',
            defaultTestRandom,
        );
        const modePrompt = getSimpleChoicePrompt(afterFirstBury.finalState, 'skeletons_grave_goods_mode');
        const uncoverOption = getPromptOption(modePrompt, entry => entry.value?.mode === 'uncover', 'uncoverOption');

        const afterMode = respondToPrompt(
            afterFirstBury.finalState,
            uncoverOption.id,
            '0',
            defaultTestRandom,
        );
        const uncoverPrompt = getSimpleChoicePrompt(afterMode.finalState, 'skeletons_grave_goods_uncover');
        const option = getPromptOption(uncoverPrompt, entry => entry.value?.cardUid === 'buried-a', 'option');

        const resolved = respondToPrompt(
            afterMode.finalState,
            option.id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'buried-a')).toBe(true);
        const counterPrompt = getSimpleChoicePrompt(resolved.finalState, 'skeletons_grave_goods_counter');

        const applied = respondToPrompt(
            resolved.finalState,
            getPromptOptions(counterPrompt)[0].id,
            '0',
            defaultTestRandom,
        );
        expect(applied.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED && (event as any).payload?.amount === 2)).toBe(true);
    });

    it('skeletons_grave_goods 额外埋葬时可选择不同基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('grave-goods-1', 'skeletons_grave_goods', 'action', '0'),
                        makeCard('bury-first', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('discard-cost', 'robot_microbot_beta', 'minion', '0'),
                        makeCard('bury-extra', 'robot_microbot_beta', 'minion', '0'),
                        makeCard('buffer-hand', 'robot_microbot_beta', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [], buriedCards: [] },
                { defId: 'base_b', minions: [], ongoingActions: [], buriedCards: [] },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'grave-goods-1' } },
            defaultTestRandom,
        );
        const basePrompt = getSimpleChoicePrompt(played.finalState, 'skeletons_grave_goods_base');
        const baseA = getPromptOption(basePrompt, entry => entry.value?.baseIndex === 0, 'baseA');

        const afterBase = respondToPrompt(
            played.finalState,
            baseA.id,
            '0',
            defaultTestRandom,
        );
        const firstBuryPrompt = getSimpleChoicePrompt(afterBase.finalState, 'skeletons_grave_goods_bury');
        const firstBury = getPromptOption(firstBuryPrompt, entry => entry.value?.cardUid === 'bury-first', 'firstBury');

        const afterFirstBury = respondToPrompt(
            afterBase.finalState,
            firstBury.id,
            '0',
            defaultTestRandom,
        );
        const modePrompt = getSimpleChoicePrompt(afterFirstBury.finalState, 'skeletons_grave_goods_mode');
        const extraBuryOption = getPromptOption(modePrompt, entry => entry.value?.mode === 'extra_bury', 'extraBuryOption');

        const afterMode = respondToPrompt(
            afterFirstBury.finalState,
            extraBuryOption.id,
            '0',
            defaultTestRandom,
        );
        const discardPrompt = getSimpleChoicePrompt(afterMode.finalState, 'skeletons_grave_goods_discard');
        const discardCard = getPromptOption(discardPrompt, entry => entry.value?.cardUid === 'discard-cost', 'discardCard');

        const afterDiscard = respondToPrompt(
            afterMode.finalState,
            discardCard.id,
            '0',
            defaultTestRandom,
        );
        const bonusPrompt = getSimpleChoicePrompt(afterDiscard.finalState, 'skeletons_grave_goods_bonus');
        const bonusCard = getPromptOption(bonusPrompt, entry => entry.value?.cardUid === 'bury-extra', 'bonusCard');
        expect(getPromptOptions(bonusPrompt).some((entry: any) => entry.value?.cardUid === 'discard-cost')).toBe(false);

        const afterBonusCard = respondToPrompt(
            afterDiscard.finalState,
            bonusCard.id,
            '0',
            defaultTestRandom,
        );
        const bonusBasePrompt = getSimpleChoicePrompt(afterBonusCard.finalState, 'skeletons_grave_goods_bonus_base');
        const baseB = getPromptOption(bonusBasePrompt, entry => entry.value?.baseIndex === 1, 'baseB');

        const resolved = respondToPrompt(
            afterBonusCard.finalState,
            baseB.id,
            '0',
            defaultTestRandom,
        );

        expect((resolved.finalState.core.bases[0].buriedCards ?? []).some(card => card.uid === 'bury-first')).toBe(true);
        expect((resolved.finalState.core.bases[1].buriedCards ?? []).some(card => card.uid === 'bury-extra')).toBe(true);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'discard-cost')).toBe(true);
        expect((resolved.finalState.core.bases[0].buriedCards ?? []).some(card => card.uid === 'discard-cost')).toBe(false);
        expect((resolved.finalState.core.bases[1].buriedCards ?? []).some(card => card.uid === 'discard-cost')).toBe(false);
    });

    it('skeletons_spooky_scary 从弃牌堆埋葬低力量随从并抽 1 张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('spooky-1', 'skeletons_spooky_scary', 'action', '0')],
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                    discard: [makeCard('discard-low', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'spooky-1' } },
            defaultTestRandom,
        );
        const basePrompt = getSimpleChoicePrompt(played.finalState, 'skeletons_spooky_scary_base');

        const afterBase = respondToPrompt(
            played.finalState,
            getPromptOptions(basePrompt)[1].id,
            '0',
            defaultTestRandom,
        );
        const cardPrompt = getSimpleChoicePrompt(afterBase.finalState, 'skeletons_spooky_scary_card');
        const option = getPromptOption(cardPrompt, entry => entry.value?.cardUid === 'discard-low', 'option');

        const resolved = respondToPrompt(
            afterBase.finalState,
            option.id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect((resolved.finalState.core.bases[1].buriedCards ?? []).some(card => card.uid === 'discard-low')).toBe(true);
    });

    it('skeletons_hearse_fleet 可把埋葬牌移动到目标基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hearse-1', 'skeletons_hearse_fleet', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [],
                    buriedCards: [
                        { uid: 'buried-a', defId: 'robot_microbot_alpha', trueOwnerId: '1', controllerId: '1', buriedFrom: 'hand' },
                    ],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                    buriedCards: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'hearse-1' } },
            defaultTestRandom,
        );
        const basePrompt = getSimpleChoicePrompt(played.finalState, 'skeletons_hearse_fleet_base');
        const sourceOption = getPromptOption(basePrompt, entry => entry.value?.baseIndex === 0, 'sourceOption');

        const afterBase = respondToPrompt(
            played.finalState,
            sourceOption.id,
            '0',
            defaultTestRandom,
        );
        const targetPrompt = getSimpleChoicePrompt(afterBase.finalState, 'skeletons_hearse_fleet_target');
        const targetOption = getPromptOption(targetPrompt, entry => entry.value?.baseIndex === 1, 'targetOption');

        const afterTarget = respondToPrompt(
            afterBase.finalState,
            targetOption.id,
            '0',
            defaultTestRandom,
        );
        const cardsPrompt = getSimpleChoicePrompt(afterTarget.finalState, 'skeletons_hearse_fleet_cards');
        const option = getPromptOption(cardsPrompt, entry => entry.value?.cardUid === 'buried-a', 'option');

        const resolved = respondToPromptOptions(
            afterTarget.finalState,
            [option.id],
            '0',
            defaultTestRandom,
        );

        expect((resolved.finalState.core.bases[0].buriedCards ?? []).some(card => card.uid === 'buried-a')).toBe(false);
        expect((resolved.finalState.core.bases[1].buriedCards ?? []).some(card => card.uid === 'buried-a')).toBe(true);
    });

    it('skeletons_revenant 你的回合中可从弃牌堆埋葬且每回合一次', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 7,
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('revenant-1', 'skeletons_revenant', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const options = getDiscardSpecialOptions(core, '0');
        expect(options).toHaveLength(1);
        expect(options[0]?.card.uid).toBe('revenant-1');
        expect(options[0]?.sourceId).toBe('skeletons_revenant');

        const resolved = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.ACTIVATE_SPECIAL, playerId: '0', payload: { discardCardUid: 'revenant-1', baseIndex: 1 } } as any,
            defaultTestRandom,
        );
        expect((resolved.finalState.core.bases[1].buriedCards ?? []).some(card => card.uid === 'revenant-1')).toBe(true);
        expect(resolved.finalState.core.players['0'].usedDiscardPlayAbilities).toContain('skeletons_revenant');
        expect(getDiscardSpecialOptions(resolved.finalState.core, '0')).toHaveLength(0);

        const secondTryValidation = validate(resolved.finalState, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { discardCardUid: 'revenant-1', baseIndex: 0 },
        } as any);
        expect(secondTryValidation.valid).toBe(false);

        const opponentTurnCore = {
            ...core,
            currentPlayerIndex: 1,
        };
        expect(getDiscardSpecialOptions(opponentTurnCore, '0')).toHaveLength(0);
    });

    it('skeletons_gravestones 计分后可把自己埋葬到另一个基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{ uid: 'gravestones-1', defId: 'skeletons_gravestones', ownerId: '0' }],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const triggered = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 0, vp: 0 }],
            sourceCardUid: 'gravestones-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 3901,
        });
        const prompt = getSimpleChoicePrompt(triggered.matchState ?? makeMatchState(core), 'skeletons_gravestones_after_scoring');
        expect(prompt.targetType).toBe('field-source-target');
        expect(getPromptOptions(prompt).some((entry: any) => entry.value?.skip)).toBe(false);
        const baseOption = getPromptOption(prompt, entry => entry.value?.baseIndex === 1, 'baseOption');
        expect(baseOption.value).toMatchObject({
            fieldInteractionType: 'source-target',
            fieldSourceType: 'ongoing',
            fieldTargetType: 'base',
            sourceUid: 'gravestones-1',
            cardUid: 'gravestones-1',
            ongoingUid: 'gravestones-1',
            sourceBaseIndex: 0,
            targetBaseIndex: 1,
            baseIndex: 1,
        });

        const resolved = respondToPrompt(
            triggered.matchState ?? makeMatchState(core),
            baseOption.id,
            '0',
            defaultTestRandom,
        );

        expect((resolved.finalState.core.bases[1].buriedCards ?? []).some(card => card.uid === 'gravestones-1')).toBe(true);
    });

    it('borrowed skeletons_gravestones 应按控制者而不是真实 owner 在计分后把自己埋到另一基地，并保留 true owner', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{
                        uid: 'gravestones-1',
                        defId: 'skeletons_gravestones',
                        ownerId: '1',
                        metadata: { sourceControllerId: '0' },
                    } as any],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const triggered = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 0, vp: 0 }],
            sourceCardUid: 'gravestones-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 3903,
        });
        const prompt = getSimpleChoicePrompt(triggered.matchState ?? makeMatchState(core), 'skeletons_gravestones_after_scoring');
        const baseOption = getPromptOption(prompt, entry => entry.value?.baseIndex === 1, 'baseOption');

        const resolved = respondToPrompt(
            triggered.matchState ?? makeMatchState(core),
            baseOption.id,
            '0',
            defaultTestRandom,
        );

        const buriedCard = resolved.finalState.core.bases[1].buriedCards?.find(card => card.uid === 'gravestones-1');
        expect(buriedCard).toBeDefined();
        expect(buriedCard?.controllerId).toBe('0');
        expect(buriedCard?.trueOwnerId).toBe('1');
    });

    it('skeletons_gravestones 在对手计分后仍应把 queued afterScoring 选择权交给来源控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{ uid: 'gravestones-1', defId: 'skeletons_gravestones', ownerId: '1' }],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 1 }],
            random: defaultTestRandom,
            now: 3902,
        });

        expect(queued).toBeDefined();
        const gravestonesTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'gravestones-1');
        expect(gravestonesTrigger).toBeDefined();
        expect(gravestonesTrigger.ownerPlayerId).toBe('1');

        const queuedState = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers }),
            defaultTestRandom,
            3902,
        );
        expect(queuedState).toBeDefined();
        expect(getReactionPrompt(queuedState!.state)?.playerId).toBe('1');
    });

    it('skeletons_gravetender 每回合仅首次埋葬/挖掘触发抽牌', () => {
        const core = makeState({
            turnNumber: 3,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('gravetender-1', 'skeletons_gravetender', '0', 4, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const first = fireTriggers(core, 'onCardBuried', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            buriedCardUid: 'buried-a',
            buriedCardDefId: 'robot_microbot_guard',
            buriedCardControllerId: '0',
            buriedFrom: 'hand',
            random: defaultTestRandom,
            now: 5000,
        });
        expect(first.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);

        const afterFirst = first.events.reduce((state, event) => reduce(state, event), core);
        const second = fireTriggers(afterFirst, 'onCardBuried', {
            state: afterFirst,
            matchState: makeMatchState(afterFirst),
            playerId: '0',
            baseIndex: 0,
            buriedCardUid: 'buried-b',
            buriedCardDefId: 'robot_microbot_fixer',
            buriedCardControllerId: '0',
            buriedFrom: 'hand',
            random: defaultTestRandom,
            now: 5001,
        });
        expect(second.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
    });
});
