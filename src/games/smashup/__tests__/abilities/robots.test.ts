import { beforeAll, describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import type { SmashUpCore, SmashUpEvent } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    getOptionalSimpleChoicePrompt,
    getPromptHandlerData,
    getPromptMultiMin,
    getPromptOption,
    getPromptOptions,
    getPromptOptionsGenerator,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOptions,
    respondToPrompt,
} from '../helpers';
import { runCommand } from '../testRunner';
import { buildSmashUpAiLegalActions } from '../../ai';

const defaultRandom: RandomFn = {
    shuffle: <T>(arr: T[]) => [...arr],
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
};

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

function execPlayMinion(state: SmashUpCore, playerId: string, cardUid: string, baseIndex: number) {
    const result = runCommand(
        makeMatchState(state),
        {
            type: SU_COMMANDS.PLAY_MINION,
            playerId,
            payload: { cardUid, baseIndex },
        } as any,
        defaultRandom,
    );
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number) {
    const result = runCommand(
        makeMatchState(state),
        {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: { cardUid, targetBaseIndex },
        } as any,
        defaultRandom,
    );
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

describe('机器人派系能力', () => {
    it('robot_zapbot: 打出后直接获得额外随从额度（力量≤2限制）', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('m1', 'robot_zapbot', 'minion', '0'),
                        makeCard('m2', 'robot_microbot_guard', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const { events } = execPlayMinion(state, '0', 'm1', 0);
        const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents).toHaveLength(1);
        expect((limitEvents[0] as any).payload.powerMax).toBe(2);
        expect((limitEvents[0] as any).payload.playTiming).toBe('banked');
    });

    it('robot_zapbot: 无论手牌是否有力量≤2随从都给额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'robot_zapbot', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const { events } = execPlayMinion(state, '0', 'm1', 0);
        const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents).toHaveLength(1);
    });

    it('robot_zapbot: 非 playCards 阶段获得的额外随从必须立即处理', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const matchState = makeMatchState(state);
        matchState.sys.phase = 'startTurn';
        const result = invokeRegisteredAbilityContract('robot_zapbot', 'onPlay', {
            state,
            matchState,
            playerId: '0',
            cardUid: 'm1',
            defId: 'robot_zapbot',
            baseIndex: 0,
            random: defaultRandom,
            now: 1000,
        });

        const limitEvents = result.events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents).toHaveLength(1);
        expect((limitEvents[0] as any).payload.powerMax).toBe(2);
        expect((limitEvents[0] as any).payload.playTiming).toBe('immediate');
    });

    it('robot_tech_center: 单个基地时创建 Prompt', () => {
        const deckCards = Array.from({ length: 5 }, (_, i) => makeCard(`d${i}`, 'test_card', 'minion', '0'));
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'robot_tech_center', 'action', '0')],
                    deck: deckCards,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [
                    makeMinion('m0', 'test', '0', 1),
                    makeMinion('m1', 'test', '0', 1),
                    makeMinion('m2', 'test', '0', 1),
                ],
                ongoingActions: [],
            })],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'robot_tech_center');
    });

    it('robot_tech_center: 选择基地后按己方随从数抽牌', () => {
        const deckCards = Array.from({ length: 5 }, (_, i) => makeCard(`d${i}`, 'test_card', 'minion', '0'));
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'robot_tech_center', 'action', '0')],
                    deck: deckCards,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [
                    makeMinion('m0', 'test', '0', 1),
                    makeMinion('m1', 'test', '0', 1),
                    makeMinion('m2', 'test', '0', 1),
                ],
                ongoingActions: [],
            })],
        });

        const played = execPlayAction(state, '0', 'a1');
        const prompt = getSimpleChoicePrompt(played.matchState, 'robot_tech_center');
        const baseOption = getPromptOptions(prompt).find((option) => option.id !== 'cancel');
        expect(baseOption).toBeDefined();

        const result = respondToPrompt(played.matchState, baseOption!.id, '0', defaultRandom);
        expect(result.success, result.error).toBe(true);
        expect(result.events.some((event) => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(result.finalState.core.players['0'].hand).toHaveLength(3);
        expect(result.finalState.core.players['0'].deck).toHaveLength(2);
    });

    it('robot_microbot_fixer + base_the_homeworld: 3战力随从应消耗普通额度，保留≤2额度', () => {
        const initialState = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('m1', 'robot_microbot_fixer', 'minion', '0'),
                        makeCard('m2', 'alien_invader', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'base_the_homeworld', minions: [], ongoingActions: [] }),
                makeBase({ defId: 'base_rhodes_plaza', minions: [], ongoingActions: [] }),
            ],
        });

        const firstPlay = runCommand(
            makeMatchState(initialState),
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'm1', baseIndex: 0 },
            } as any,
            defaultRandom,
        );
        expect(firstPlay.success).toBe(true);
        expect(firstPlay.finalState.core.players['0'].minionLimit).toBe(3);
        expect(firstPlay.finalState.core.players['0'].extraMinionPowerCaps).toEqual([2]);
        expect(firstPlay.finalState.core.players['0'].extraMinionPowerMax).toBe(2);

        const secondPlay = runCommand(
            firstPlay.finalState,
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'm2', baseIndex: 1 },
            } as any,
            defaultRandom,
        );
        expect(secondPlay.success).toBe(true);
        expect(secondPlay.finalState.core.players['0'].minionsPlayed).toBe(2);
        expect(secondPlay.finalState.core.players['0'].minionLimit).toBe(3);
        expect(secondPlay.finalState.core.players['0'].extraMinionPowerCaps).toEqual([2]);
        expect(secondPlay.finalState.core.players['0'].extraMinionPowerMax).toBe(2);
    });

    it('robot_microbot_reclaimer: 弃牌堆有微型机时创建多选交互', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0')],
                    discard: [
                        makeCard('mb1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('mb2', 'robot_microbot_alpha', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayMinion(state, '0', 'r1', 0);
        getSimpleChoicePrompt(matchState, 'robot_microbot_reclaimer');
    });

    it('robot_microbot_reclaimer: min=0 时不注入显式 skip，而是允许空选择完成', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0')],
                    discard: [makeCard('mb1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayMinion(state, '0', 'r1', 0);
        const prompt = getSimpleChoicePrompt(matchState, 'robot_microbot_reclaimer');
        expect(getPromptMultiMin(prompt)).toBe(0);
        expect(getPromptOptions(prompt).some(option => option.id === 'skip')).toBe(false);
        expect(typeof getPromptOptionsGenerator(prompt)).toBe('function');
    });

    it('robot_microbot_reclaimer: 空选择跳过时弃牌堆保持不变', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0')],
                    discard: [makeCard('mb1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const played = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'r1', baseIndex: 0 },
            } as any,
            defaultRandom,
        );
        expect(played.success).toBe(true);

        getSimpleChoicePrompt(played.finalState, 'robot_microbot_reclaimer');
        const result = respondToPromptOptions(played.finalState, [], '0', defaultRandom);
        expect(result.success, result.error).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(false);
        expect(result.finalState.core.players['0'].discard.some(card => card.uid === 'mb1')).toBe(true);
    });

    it('robot_microbot_reclaimer: 选择微型机后洗回牌库', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0')],
                    deck: [makeCard('dk1', 'robot_zapbot', 'minion', '0')],
                    discard: [
                        makeCard('mb1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('mb2', 'robot_microbot_alpha', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const played = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'r1', baseIndex: 0 },
            } as any,
            defaultRandom,
        );
        expect(played.success).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'robot_microbot_reclaimer');
        const selected = getPromptOption(
            prompt,
            option => option.value?.cardUid === 'mb1',
            'robot microbot reclaimer mb1 option',
        );
        const result = respondToPromptOptions(played.finalState, [selected.id], '0', defaultRandom);
        expect(result.success, result.error).toBe(true);

        const reorderEvents = result.events.filter(event => event.type === SU_EVENTS.DECK_REORDERED);
        expect(reorderEvents).toHaveLength(1);
        const deckUids = (reorderEvents[0] as any).payload.deckUids;
        expect(deckUids).toContain('mb1');
        expect(deckUids).toContain('dk1');
        expect(deckUids).not.toContain('mb2');
    });

    it('robot_microbot_reclaimer: 弃牌堆刷新后，AI 不应保留过期微型机或 skip+卡牌混合动作', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0')],
                    discard: [
                        makeCard('mb1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('mb2', 'robot_microbot_alpha', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const played = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'r1', baseIndex: 0 },
            } as any,
            defaultRandom,
        );
        expect(played.success).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'robot_microbot_reclaimer');
        const optionsGenerator = getPromptOptionsGenerator(prompt);
        expect(typeof optionsGenerator).toBe('function');

        const refreshedState = {
            ...played.finalState,
            core: {
                ...played.finalState.core,
                players: {
                    ...played.finalState.core.players,
                    '0': {
                        ...played.finalState.core.players['0'],
                        discard: played.finalState.core.players['0'].discard.filter(card => card.uid !== 'mb1'),
                    },
                },
            },
        } as any;

        const refreshedOptions = optionsGenerator!(refreshedState, getPromptHandlerData(prompt));
        expect(refreshedOptions.some(option => option.value?.cardUid === 'mb1')).toBe(false);
        expect(refreshedOptions.some(option => option.value?.cardUid === 'mb2')).toBe(true);
        expect(refreshedOptions.some(option => option.id === 'skip')).toBe(false);

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: refreshedState,
        });
        expect(legalActions).toHaveLength(2);
        expect(legalActions.some(action => String(action.label).includes('mb1'))).toBe(false);
        expect(legalActions.some(action => Array.isArray(action.metadata?.optionValue)
            && action.metadata.optionValue.some((entry: any) => entry?.cardUid === 'mb1'))).toBe(false);
        expect(legalActions.some(action => action.kind === 'interaction-choice'
            && Array.isArray(action.metadata?.optionIds)
            && action.metadata.optionIds.length === 0)).toBe(true);
    });

    it('robot_microbot_reclaimer: 弃牌堆无微型机时不创建交互', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0')],
                    discard: [makeCard('a1', 'robot_zapbot', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayMinion(state, '0', 'r1', 0);
        expect(getOptionalSimpleChoicePrompt(matchState, 'robot_microbot_reclaimer')).toBeUndefined();
    });

    it('robot_microbot_fixer: 第一个随从打出时获得额外随从额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('f1', 'robot_microbot_fixer', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayMinion(state, '0', 'f1', 0);
        expect(matchState.core.players['0'].minionLimit).toBe(2);
    });

    it('robot_microbot_fixer: 非第一个随从打出时不获得额外额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('f1', 'robot_microbot_fixer', 'minion', '0')],
                    minionsPlayed: 1,
                    minionLimit: 2,
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayMinion(state, '0', 'f1', 0);
        expect(matchState.core.players['0'].minionLimit).toBe(2);
    });

    it('robot_microbot_reclaimer: 第一个随从打出时获得额外随从额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayMinion(state, '0', 'r1', 0);
        expect(matchState.core.players['0'].minionLimit).toBe(2);
    });

    it('robot_microbot_reclaimer: 非第一个随从打出时不获得额外额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0')],
                    minionsPlayed: 1,
                    minionLimit: 2,
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayMinion(state, '0', 'r1', 0);
        expect(matchState.core.players['0'].minionLimit).toBe(2);
    });

    it('robot_microbot_reclaimer: 先解洗牌交互后，仍可把额外随从打到荣誉之地', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0'),
                        makeCard('p1', 'pirate_first_mate', 'minion', '0'),
                    ],
                    discard: [makeCard('mb1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'base_the_field_of_honor', minions: [], ongoingActions: [] })],
        });

        const firstPlay = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'r1', baseIndex: 0 },
            } as any,
            defaultRandom,
        );
        expect(firstPlay.success).toBe(true);
        expect(firstPlay.finalState.core.players['0'].minionLimit).toBe(2);

        const prompt = getSimpleChoicePrompt(firstPlay.finalState, 'robot_microbot_reclaimer');
        const selected = getPromptOption(
            prompt,
            option => option.value?.cardUid === 'mb1',
            'robot microbot reclaimer mb1 option',
        );

        const afterRespond = respondToPromptOptions(firstPlay.finalState, [selected.id], '0', defaultRandom);
        expect(afterRespond.success).toBe(true);
        expect(afterRespond.finalState.core.players['0'].minionLimit).toBe(2);
        expect(afterRespond.finalState.core.players['0'].minionsPlayed).toBe(1);

        const secondPlay = runCommand(
            afterRespond.finalState,
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'p1', baseIndex: 0 },
            } as any,
            defaultRandom,
        );
        expect(secondPlay.success).toBe(true);
        expect(secondPlay.finalState.core.players['0'].minionsPlayed).toBe(2);
        expect(secondPlay.finalState.core.bases[0].minions.some(minion => minion.uid === 'p1')).toBe(true);
    });
});
