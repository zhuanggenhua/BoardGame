import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { SMASHUP_FACTION_IDS } from '../../domain/ids';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import {
    clearOngoingEffectRegistry,
    fireTriggers,
    isMinionProtected,
    registerPodOngoingAliases,
} from '../../domain/ongoingEffects';
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

function runAction(core: SmashUpCore, command: { type: string; playerId: string; payload: any }) {
    const result = runCommand(makeMatchState(core), command as any, defaultRandom);
    expect(result.success, result.error).toBe(true);
    return result.events as SmashUpEvent[];
}

function playBearNecessitiesAndDestroyMinion(core: SmashUpCore, minionUid: string, playerId = '0') {
    const playResult = runCommand(
        makeMatchState(core),
        {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: { cardUid: 'c1' },
        } as any,
        defaultRandom,
    );
    expect(playResult.success, playResult.error).toBe(true);
    expect(playResult.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);

    const prompt = getSimpleChoicePrompt(playResult.finalState, 'bear_cavalry_bear_necessities');
    const option = getPromptOption(
        prompt,
        entry => entry?.value?.type === 'minion' && entry?.value?.uid === minionUid,
        `bear necessities target option for ${minionUid}`,
    );
    const respondResult = respondToPrompt(playResult.finalState, option.id, playerId, defaultRandom);
    expect(respondResult.success, respondResult.error).toBe(true);
    return [...playResult.events, ...respondResult.events] as SmashUpEvent[];
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

describe('robot_nukebot（核弹机器人 onDestroy）', () => {
    it('被消灭后消灭同基地其他玩家所有随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'bear_cavalry_bear_necessities', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('m0a', 'test_a', '0', 1),
                    makeMinion('m0b', 'test_b', '0', 2),
                    makeMinion('m0c', 'test_c', '0', 3),
                    makeMinion('nukebot', 'robot_nukebot', '1', 5),
                ],
                ongoingActions: [],
            }],
        });

        const events = playBearNecessitiesAndDestroyMinion(core, 'nukebot');

        const nukebotDestroy = events.find(
            e => e.type === SU_EVENTS.MINION_DESTROYED && (e as any).payload.minionUid === 'nukebot'
        );
        expect(nukebotDestroy).toBeDefined();

        const chainDestroys = events.filter(
            e => e.type === SU_EVENTS.MINION_DESTROYED && (e as any).payload.reason === 'robot_nukebot'
        );
        expect(chainDestroys.length).toBe(3);
        expect(chainDestroys.every(event => (event as any).payload.destroyerId === '1')).toBe(true);
    });

    it('同基地只有自己人的随从时不产生额外消灭', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'bear_cavalry_bear_necessities', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('nukebot', 'robot_nukebot', '1', 5),
                ],
                ongoingActions: [],
            }],
        });

        const events = playBearNecessitiesAndDestroyMinion(core, 'nukebot');

        const nukebotDestroy = events.find(
            e => e.type === SU_EVENTS.MINION_DESTROYED && (e as any).payload.minionUid === 'nukebot'
        );
        expect(nukebotDestroy).toBeDefined();

        const chainDestroys = events.filter(
            e => e.type === SU_EVENTS.MINION_DESTROYED && (e as any).payload.reason === 'robot_nukebot'
        );
        expect(chainDestroys.length).toBe(0);
    });

    it('核弹机器人所在基地无其他玩家随从时无额外效果', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'bear_cavalry_bear_necessities', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('nukebot', 'robot_nukebot', '1', 5),
                ],
                ongoingActions: [],
            }],
        });

        const events = playBearNecessitiesAndDestroyMinion(core, 'nukebot');

        const nukebotDestroy = events.find(
            e => e.type === SU_EVENTS.MINION_DESTROYED && (e as any).payload.minionUid === 'nukebot'
        );
        expect(nukebotDestroy).toBeDefined();

        const chainDestroys = events.filter(
            e => e.type === SU_EVENTS.MINION_DESTROYED && (e as any).payload.reason === 'robot_nukebot'
        );
        expect(chainDestroys.length).toBe(0);
    });

    it('核弹机器人链式消灭会被 destroy 保护拦截', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'bear_cavalry_bear_necessities', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('warbot', 'robot_warbot', '0', 5),
                    makeMinion('ally', 'test_a', '0', 1),
                    makeMinion('nukebot', 'robot_nukebot', '1', 6),
                ],
                ongoingActions: [],
            }],
        });

        const events = playBearNecessitiesAndDestroyMinion(core, 'nukebot');

        const destroyedByNukebot = events.filter(
            e => e.type === SU_EVENTS.MINION_DESTROYED && (e as any).payload.reason === 'robot_nukebot'
        );
        const destroyedIds = destroyedByNukebot.map(e => (e as any).payload.minionUid);
        expect(destroyedIds).toContain('ally');
        expect(destroyedIds).not.toContain('warbot');
    });
});

describe('机器人 ongoing 能力', () => {
    beforeEach(() => {
        clearRegistry();
        clearInteractionHandlers();
        clearOngoingEffectRegistry();
        clearPowerModifierRegistry();
        clearBaseAbilityRegistry();
        resetAbilityInit();
        initAllAbilities();
        registerPodOngoingAliases();
    });

    function makeRobotPlayer(id: string, overrides?: Parameters<typeof makePlayer>[1]) {
        return makePlayer(id, {
            deck: [
                makeCard(`${id}-d1`, 'deck_card_1', 'minion', id),
                makeCard(`${id}-d2`, 'deck_card_2', 'action', id),
                makeCard(`${id}-d3`, 'deck_card_3', 'minion', id),
            ],
            factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.NINJAS] as [string, string],
            ...overrides,
        });
    }

    it('双方都有 Archive 时，只触发被消灭微型机所属玩家的 Archive', () => {
        const archive0 = makeMinion('ma-p0', 'robot_microbot_archive', '0', 1);
        const guard0 = makeMinion('mg-p0', 'robot_microbot_guard', '0', 1);
        const base0 = makeBase({ defId: 'base_a', minions: [archive0, guard0] });

        const archive1 = makeMinion('ma-p1', 'robot_microbot_archive', '1', 1, { owner: '1' } as any);
        const base1 = makeBase({ defId: 'base_b', minions: [archive1] });
        const state = makeState({
            bases: [base0, base1],
            players: {
                '0': makeRobotPlayer('0'),
                '1': makeRobotPlayer('1'),
            },
        });

        const { events } = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'mg-p0',
            triggerMinionDefId: 'robot_microbot_guard',
            triggerMinion: guard0,
            random: defaultRandom,
            now: 1000,
        } as any);

        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN) as any[];
        expect(drawEvents).toHaveLength(1);
        expect(drawEvents[0].payload.playerId).toBe('0');
    });

    it('同一玩家有两个 Archive 时，应各自触发一次抽牌', () => {
        const archiveA = makeMinion('ma-double-a', 'robot_microbot_archive', '0', 1);
        const archiveB = makeMinion('ma-double-b', 'robot_microbot_archive', '0', 1);
        const guard = makeMinion('mg-double', 'robot_microbot_guard', '0', 1);
        const base = makeBase({ minions: [archiveA, archiveB, guard] });
        const state = makeState({
            bases: [base],
            players: {
                '0': makeRobotPlayer('0'),
                '1': makeRobotPlayer('1'),
            },
        });

        const { events } = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'mg-double',
            triggerMinionDefId: 'robot_microbot_guard',
            triggerMinion: guard,
            random: defaultRandom,
            now: 1000,
        } as any);

        const drawEvent = events.find(e => e.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent).toBeTruthy();
        expect(drawEvent.payload.playerId).toBe('0');
        expect(drawEvent.payload.count).toBe(2);
        expect(drawEvent.payload.cardUids).toHaveLength(2);
    });

    it('warbot 受 destroy 保护', () => {
        const warbot = makeMinion('wb-1', 'robot_warbot', '0', 5);
        const base = makeBase({ minions: [warbot] });
        const state = makeState({ bases: [base] });

        expect(isMinionProtected(state, warbot, 0, '1', 'destroy')).toBe(true);
    });

    it('POD 版 warbot 也受 destroy 保护', () => {
        const warbot = makeMinion('wb-pod-1', 'robot_warbot_pod', '0', 5);
        const base = makeBase({ minions: [warbot] });
        const state = makeState({ bases: [base] });

        expect(isMinionProtected(state, warbot, 0, '1', 'destroy')).toBe(true);
    });

    it('非 warbot 不受保护', () => {
        const warbot = makeMinion('wb-1', 'robot_warbot', '0', 5);
        const normal = makeMinion('zb-1', 'robot_zapbot', '0', 2);
        const base = makeBase({ minions: [warbot, normal] });
        const state = makeState({ bases: [base] });

        expect(isMinionProtected(state, normal, 0, '1', 'destroy')).toBe(false);
    });

    it('微型机被消灭时 archive 控制者抽牌', () => {
        const archive = makeMinion('ma-1', 'robot_microbot_archive', '0', 1);
        const base = makeBase({ minions: [archive] });
        const state = makeState({
            bases: [base],
            players: {
                '0': makeRobotPlayer('0'),
                '1': makeRobotPlayer('1'),
            },
        });

        const { events } = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'mg-1',
            triggerMinionDefId: 'robot_microbot_guard',
            random: defaultRandom,
            now: 1000,
        } as any);

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
        expect((events[0] as any).payload.playerId).toBe('0');
    });

    it('POD 版档案馆也会对 POD 微型机的消灭触发抽牌', () => {
        const archive = makeMinion('ma-pod-1', 'robot_microbot_archive_pod', '0', 1);
        const base = makeBase({ minions: [archive] });
        const state = makeState({
            bases: [base],
            players: {
                '0': makeRobotPlayer('0'),
                '1': makeRobotPlayer('1'),
            },
        });

        const { events } = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'mg-pod-1',
            triggerMinionDefId: 'robot_microbot_guard_pod',
            random: defaultRandom,
            now: 1000,
        } as any);

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
        expect((events[0] as any).payload.playerId).toBe('0');
    });

    it('非微型机被消灭时不触发', () => {
        const archive = makeMinion('ma-1', 'robot_microbot_archive', '0', 1);
        const base = makeBase({ minions: [archive] });
        const state = makeState({
            bases: [base],
            players: {
                '0': makeRobotPlayer('0'),
                '1': makeRobotPlayer('1'),
            },
        });

        const { events } = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'big-1',
            triggerMinionDefId: 'robot_hoverbot',
            random: defaultRandom,
            now: 1000,
        } as any);

        expect(events).toHaveLength(0);
    });

    it('有 Alpha 时普通随从被视为微型机并触发抽牌', () => {
        const archive = makeMinion('ma-alpha-1', 'robot_microbot_archive', '0', 1);
        const alpha = makeMinion('alpha-1', 'robot_microbot_alpha', '0', 1);
        const normal = makeMinion('nm-1', 'test_normal_minion', '0', 3);
        const base = makeBase({ minions: [archive, alpha, normal] });
        const state = makeState({
            bases: [base],
            players: {
                '0': makeRobotPlayer('0'),
                '1': makeRobotPlayer('1'),
            },
        });

        const { events } = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'nm-1',
            triggerMinionDefId: 'test_normal_minion',
            triggerMinion: normal,
            random: defaultRandom,
            now: 1000,
        } as any);

        const drawEvents = events.filter(
            e => e.type === SU_EVENTS.CARDS_DRAWN && (e as any).payload.playerId === '0'
        );
        expect(drawEvents.length).toBe(1);
    });

    it('Alpha + 普通随从在不同基地时 Archive 仍对己方普通随从触发', () => {
        const archive = makeMinion('ma-alpha-remote', 'robot_microbot_archive', '0', 1);
        const base0 = makeBase({ defId: 'base_a', minions: [archive] });
        const alpha = makeMinion('alpha-remote', 'robot_microbot_alpha', '0', 1);
        const normal = makeMinion('nm-remote', 'test_normal_minion', '0', 3);
        const base1 = makeBase({ defId: 'base_b', minions: [alpha, normal] });
        const state = makeState({
            bases: [base0, base1],
            players: {
                '0': makeRobotPlayer('0'),
                '1': makeRobotPlayer('1'),
            },
        });

        const { events } = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 1,
            triggerMinionUid: 'nm-remote',
            triggerMinionDefId: 'test_normal_minion',
            triggerMinion: normal,
            random: defaultRandom,
            now: 1000,
        } as any);

        const drawEvents = events.filter(
            e => e.type === SU_EVENTS.CARDS_DRAWN && (e as any).payload.playerId === '0'
        );
        expect(drawEvents.length).toBe(1);
    });

    it('对手的微型机（含 Alpha 视为）被消灭时不触发', () => {
        const archive = makeMinion('ma-enemy', 'robot_microbot_archive', '0', 1);
        const base0 = makeBase({ defId: 'base_a', minions: [archive] });

        const alphaEnemy = makeMinion('alpha-enemy', 'robot_microbot_alpha', '1', 1, { owner: '1' } as any);
        const normalEnemy = makeMinion('nm-enemy', 'test_normal_minion', '1', 3, { owner: '1' } as any);
        const base1 = makeBase({ defId: 'base_b', minions: [alphaEnemy, normalEnemy] });

        const state = makeState({
            bases: [base0, base1],
            players: {
                '0': makeRobotPlayer('0'),
                '1': makeRobotPlayer('1', {
                    hand: [],
                }),
            },
        });

        const { events } = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '1',
            baseIndex: 1,
            triggerMinionUid: 'nm-enemy',
            triggerMinionDefId: 'test_normal_minion',
            triggerMinion: normalEnemy,
            random: defaultRandom,
            now: 1000,
        } as any);

        const drawEventsP0 = events.filter(
            e => e.type === SU_EVENTS.CARDS_DRAWN && (e as any).payload.playerId === '0',
        );
        expect(drawEventsP0.length).toBe(0);
    });

    it('对手的微型机被消灭时不触发（你的限定）', () => {
        const archive = makeMinion('ma-1', 'robot_microbot_archive', '0', 1);
        const base = makeBase({ minions: [archive] });
        const state = makeState({
            bases: [base],
            players: {
                '0': makeRobotPlayer('0'),
                '1': makeRobotPlayer('1'),
            },
        });

        const { events } = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'mg-opp',
            triggerMinionDefId: 'robot_microbot_guard',
            random: defaultRandom,
            now: 1000,
        } as any);

        expect(events).toHaveLength(0);
    });

    it('Archive 自身作为微型机被消灭时也会触发抽牌', () => {
        const archive = makeMinion('ma-self', 'robot_microbot_archive', '0', 1);
        const base = makeBase({ minions: [archive] });
        const state = makeState({
            bases: [base],
            players: {
                '0': makeRobotPlayer('0'),
                '1': makeRobotPlayer('1'),
            },
        });

        const { events } = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'ma-self',
            triggerMinionDefId: 'robot_microbot_archive',
            triggerMinion: archive,
            random: defaultRandom,
            now: 1000,
        } as any);

        const drawEvents = events.filter(
            e => e.type === SU_EVENTS.CARDS_DRAWN && (e as any).payload.playerId === '0',
        );
        expect(drawEvents.length).toBe(1);
    });
});
