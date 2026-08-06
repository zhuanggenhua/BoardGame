import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { fireTriggers, hasRegisteredTrigger } from '../../domain/ongoingEffects';
import { getEffectivePower } from '../../domain/ongoingModifiers';
import { SU_EVENTS } from '../../domain/types';
import {
    applyEvents,
    getPromptOptions,
    getPromptsBySourceId,
    invokeRegisteredInteractionHandlerContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
    triggerBaseAbilityWithMS,
} from '../helpers';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

function baseCtx(core: ReturnType<typeof makeState>, baseDefId: string, overrides: Record<string, unknown> = {}) {
    return {
        state: core,
        matchState: makeMatchState(core),
        baseIndex: 0,
        baseDefId,
        playerId: '0',
        random: FIXED_RANDOM,
        now: 10,
        ...overrides,
    } as any;
}

function businessEvents(events: readonly { type: string }[]) {
    return events.filter(event => event.type !== 'SYS_INTERACTION_RESOLVED');
}

describe('Excellent Movies, Dudes! / Teens 基地能力', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('八个基地的触发与交互入口已注册', () => {
        const registrations = [
            ['base_building_rooftop', 'onTurnStart'],
            ['base_building_rooftop', 'whenScoring'],
            ['base_jungle_camp', 'afterScoring'],
            ['base_alternate_present', 'onMinionPlayed'],
            ['base_time_traveling_car', 'afterScoring'],
            ['base_brood_hive', 'beforeScoring'],
            ['base_wraithrustlers_hq', 'afterScoring'],
            ['base_wraithrustlers_hq', 'onTurnStart'],
        ] as const;

        for (const [baseDefId, timing] of registrations) {
            const core = makeState({ bases: [makeBase(baseDefId)] });
            const result = triggerBaseAbilityWithMS(baseDefId, timing, baseCtx(core, baseDefId));
            expect(result, baseDefId + '::' + timing).toBeDefined();
        }
        expect(hasRegisteredTrigger('base_ancient_crashed_ship', 'onMinionPlayed')).toBe(true);
        expect(hasRegisteredTrigger('base_rooftop_portal', 'onCardDestroyed')).toBe(true);
        for (const sourceId of [
            'base_building_rooftop',
            'base_jungle_camp',
            'base_alternate_present',
            'base_time_traveling_car',
            'base_brood_hive',
            'base_wraithrustlers_hq',
        ]) {
            const state = makeMatchState(makeState());
            expect(() => invokeRegisteredInteractionHandlerContract(sourceId, state, '0', { skip: true }, {}, 10, FIXED_RANDOM)).not.toThrow();
        }
    });

    it('林中小屋让有 2 个以上己方佣兵的每个己方佣兵 +2', () => {
        const core = makeState({
            bases: [makeBase('base_cabin_in_the_woods', [
                makeMinion('teen-1', 'teens_brain', '0', 3),
                makeMinion('teen-2', 'teens_jock', '0', 3),
                makeMinion('enemy', 'pirate_first_mate', '1', 2),
            ])],
        });

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(5);
        expect(getEffectivePower(core, core.bases[0].minions[1], 0)).toBe(5);
        expect(getEffectivePower(core, core.bases[0].minions[2], 0)).toBe(2);
    });

    it('蒙特里奇高中在打出 3 力佣兵后给不同名称己方 3 力佣兵 +1', () => {
        const core = makeState({
            bases: [makeBase('base_montridge_high', [
                makeMinion('brain', 'teens_brain', '0', 3),
                makeMinion('played', 'teens_jock', '0', 3),
            ])],
        });

        const result = fireTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'played',
            triggerMinionDefId: 'teens_jock',
            triggerMinionPower: 3,
            random: FIXED_RANDOM,
            now: 10,
        });
        const after = applyEvents(core, result.events);

        expect(after.bases[0].minions.find(minion => minion.uid === 'brain')?.powerCounters).toBe(1);
        expect(after.bases[0].minions.find(minion => minion.uid === 'played')?.powerCounters ?? 0).toBe(0);
    });

    it('古代坠毁飞船只在佣兵从非手牌来源打出时放置 +1 指示物', () => {
        const fromDeckCore = makeState({
            bases: [makeBase('base_ancient_crashed_ship', [
                makeMinion('alien', 'extramorphs_chestbreaker', '0', 4, { metadata: { playedFrom: 'deck' } }),
            ])],
        });
        const fromDeck = fireTriggers(fromDeckCore, 'onMinionPlayed', {
            state: fromDeckCore,
            matchState: makeMatchState(fromDeckCore),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'alien',
            triggerMinionDefId: 'extramorphs_chestbreaker',
            triggerMinion: fromDeckCore.bases[0].minions[0],
            random: FIXED_RANDOM,
            now: 10,
        });
        const afterDeck = applyEvents(fromDeckCore, fromDeck.events);

        const fromHandCore = makeState({
            bases: [makeBase('base_ancient_crashed_ship', [
                makeMinion('alien', 'extramorphs_chestbreaker', '0', 4, { metadata: { playedFrom: 'hand' } }),
            ])],
        });
        const fromHand = fireTriggers(fromHandCore, 'onMinionPlayed', {
            state: fromHandCore,
            matchState: makeMatchState(fromHandCore),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'alien',
            triggerMinionDefId: 'extramorphs_chestbreaker',
            triggerMinion: fromHandCore.bases[0].minions[0],
            random: FIXED_RANDOM,
            now: 10,
        });

        expect(afterDeck.bases[0].minions[0].powerCounters).toBe(1);
        expect(fromHand.events).toHaveLength(0);
    });

    it('屋顶传送门在同基地行动被摧毁时每玩家每回合抽 1 张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('drawn', 'wraithrustlers_slimy', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_rooftop_portal',
                minions: [],
                ongoingActions: [{ uid: 'ghost-action', defId: 'wraithrustlers_slimy', ownerId: '0' }],
            })],
            turnNumber: 7,
        });

        const result = fireTriggers(core, 'onCardDestroyed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerCardUid: 'ghost-action',
            triggerCardDefId: 'wraithrustlers_slimy',
            triggerCardOwnerId: '0',
            triggerCardKind: 'ongoing',
            destroyerId: '0',
            random: FIXED_RANDOM,
            now: 10,
        });
        const after = applyEvents(core, result.events);
        const repeated = fireTriggers(after, 'onCardDestroyed', {
            state: after,
            matchState: makeMatchState(after),
            playerId: '0',
            baseIndex: 0,
            triggerCardUid: 'other-action',
            triggerCardDefId: 'wraithrustlers_librarian_haunt',
            triggerCardOwnerId: '0',
            triggerCardKind: 'ongoing',
            destroyerId: '0',
            random: FIXED_RANDOM,
            now: 11,
        });

        expect(after.players['0'].hand.map(card => card.uid)).toEqual(['drawn']);
        expect(after.bases[0].metadata?.rooftopPortalUsedTurnByPlayer).toMatchObject({ '0': 7 });
        expect(repeated.events).toHaveLength(0);
    });

    it('楼顶可选择降低临界点，跳过则不产生事件；计分时恰好 1 个佣兵的玩家得 1VP', () => {
        const core = makeState({
            bases: [makeBase('base_building_rooftop', [
                makeMinion('hero', 'action_heroes_commandbro', '0', 5),
                makeMinion('enemy', 'pirate_first_mate', '1', 2),
            ])],
        });
        const prompt = triggerBaseAbilityWithMS('base_building_rooftop', 'onTurnStart', baseCtx(core, 'base_building_rooftop'));
        const applyResult = respondToPromptOption(prompt.matchState!, option => option.id === 'apply', 'apply option', '0', FIXED_RANDOM);
        const skipResult = respondToPromptOption(prompt.matchState!, option => option.value?.skip === true, 'skip option', '0', FIXED_RANDOM);
        const scoring = triggerBaseAbilityWithMS('base_building_rooftop', 'whenScoring', baseCtx(core, 'base_building_rooftop'));

        expect(businessEvents(applyResult.events)).toEqual([expect.objectContaining({
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: expect.objectContaining({ baseIndex: 0, delta: -5 }),
        })]);
        expect(businessEvents(skipResult.events)).toHaveLength(0);
        expect(scoring.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.VP_AWARDED, payload: expect.objectContaining({ playerId: '0', amount: 1 }) }),
            expect.objectContaining({ type: SU_EVENTS.VP_AWARDED, payload: expect.objectContaining({ playerId: '1', amount: 1 }) }),
        ]));
    });

    it('丛林营地冠军可收回佣兵，跳过不改变状态', () => {
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [makeBase('base_jungle_camp', [makeMinion('hero', 'action_heroes_commandbro', '0', 5)])],
        });
        const result = triggerBaseAbilityWithMS('base_jungle_camp', 'afterScoring', baseCtx(core, 'base_jungle_camp', {
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
        }));
        const chosen = respondToPromptOption(result.matchState!, option => option.value?.minionUid === 'hero', 'return hero', '0', FIXED_RANDOM);
        const skipped = respondToPromptOption(result.matchState!, option => option.value?.skip === true, 'skip option', '0', FIXED_RANDOM);
        const after = applyEvents(core, chosen.events as any);

        expect(after.bases[0].minions.map(minion => minion.uid)).toEqual([]);
        expect(after.players['0'].hand.map(card => card.uid)).toEqual(['hero']);
        expect(businessEvents(skipped.events)).toHaveLength(0);
    });

    it('另类现在可把手牌置入停滞，跳过不改变状态', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('stored', 'backtimers_blast_from_the_past', 'action', '0')],
                    minionsPlayedPerBase: { 0: 1 },
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_alternate_present', [makeMinion('timebro', 'backtimers_time_raider', '0', 3)])],
        });
        const result = triggerBaseAbilityWithMS('base_alternate_present', 'onMinionPlayed', baseCtx(core, 'base_alternate_present', {
            minionUid: 'timebro',
            minionDefId: 'backtimers_time_raider',
        }));
        const chosen = respondToPromptOption(result.matchState!, option => option.value?.cardUid === 'stored', 'store hand card', '0', FIXED_RANDOM);
        const skipped = respondToPromptOption(result.matchState!, option => option.value?.skip === true, 'skip option', '0', FIXED_RANDOM);
        const after = applyEvents(core, chosen.events as any);

        expect(after.players['0'].hand).toEqual([]);
        expect(after.players['0'].storedCards?.[0]).toMatchObject({
            uid: 'stored',
            defId: 'backtimers_blast_from_the_past',
            storedUnderDefId: 'base_alternate_present',
            counters: 2,
        });
        expect(businessEvents(skipped.events)).toHaveLength(0);
    });

    it('时间旅行汽车可将冠军的场上佣兵、基地行动或附着行动置入停滞', () => {
        const base = makeBase({
            defId: 'base_time_traveling_car',
            minions: [
                makeMinion('timebro', 'backtimers_time_raider', '0', 3, {
                    attachedActions: [{ uid: 'attached', defId: 'wraithrustlers_ectoplasm_one', ownerId: '0' }],
                }),
            ],
            ongoingActions: [{ uid: 'ongoing', defId: 'wraithrustlers_slimy', ownerId: '0' }],
        });
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [base],
        });
        const result = triggerBaseAbilityWithMS('base_time_traveling_car', 'afterScoring', baseCtx(core, 'base_time_traveling_car', {
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
        }));
        const options = getPromptOptions(getPromptsBySourceId(result.matchState!, 'base_time_traveling_car')[0]);
        expect(options.some(option => option.value?.cardUid === 'timebro' && option.value?.sourceCardKind === 'minion')).toBe(true);
        expect(options.some(option => option.value?.cardUid === 'ongoing' && option.value?.sourceCardKind === 'baseOngoingAction')).toBe(true);
        expect(options.some(option => option.value?.cardUid === 'attached' && option.value?.sourceCardKind === 'attachedAction')).toBe(true);

        const chosen = respondToPromptOption(result.matchState!, option => option.value?.cardUid === 'attached', 'store attached action', '0', FIXED_RANDOM);
        const after = applyEvents(core, chosen.events as any);
        expect(after.bases[0].minions[0].attachedActions).toEqual([]);
        expect(after.players['0'].storedCards?.[0]).toMatchObject({
            uid: 'attached',
            storedUnderDefId: 'base_time_traveling_car',
            counters: 2,
        });
    });

    it('育巢按顺序给有佣兵且牌库顶是佣兵的玩家可选额外打出顶牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('top-0', 'extramorphs_chestbreaker', '0')] }),
                '1': makePlayer('1', { deck: [makeCard('top-1', 'teens_brain', '1')] }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_brood_hive', [
                makeMinion('m0', 'extramorphs_extradrone', '0', 3),
                makeMinion('m1', 'teens_jock', '1', 3),
            ])],
        });
        const result = triggerBaseAbilityWithMS('base_brood_hive', 'beforeScoring', baseCtx(core, 'base_brood_hive'));

        expect(getPromptsBySourceId(result.matchState!, 'base_brood_hive')).toHaveLength(2);
        const chosen = respondToPromptOption(result.matchState!, option => option.value?.cardUid === 'top-1', 'player 1 top minion', '1', FIXED_RANDOM);
        expect(businessEvents(chosen.events)).toEqual([expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                playerId: '1',
                limitType: 'minion',
                specificCardUid: 'top-1',
                restrictToBase: 0,
                playTiming: 'immediate',
            }),
        })]);
    });

    it('怨灵捕手总部在计分后记录冠军，下回合可选择额外佣兵/行动或跳过并消耗 pending', () => {
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [makeBase('base_wraithrustlers_hq')],
        });
        const scoring = triggerBaseAbilityWithMS('base_wraithrustlers_hq', 'afterScoring', baseCtx(core, 'base_wraithrustlers_hq', {
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
        }));
        const afterScoring = applyEvents(core, scoring.events);
        expect(afterScoring.wraithrustlersHqPendingBonus?.['0']).toBe(true);

        const turnStart = triggerBaseAbilityWithMS('base_wraithrustlers_hq', 'onTurnStart', baseCtx(afterScoring, 'base_wraithrustlers_hq'));
        const minionChoice = respondToPromptOption(turnStart.matchState!, option => option.value?.choice === 'minion', 'extra minion', '0', FIXED_RANDOM);
        const actionChoice = respondToPromptOption(turnStart.matchState!, option => option.value?.choice === 'action', 'extra action', '0', FIXED_RANDOM);
        const skipChoice = respondToPromptOption(turnStart.matchState!, option => option.value?.skip === true, 'skip option', '0', FIXED_RANDOM);

        expect(minionChoice.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.WRAITHRUSTLERS_HQ_BONUS_UPDATED, payload: expect.objectContaining({ playerId: '0', pending: false }) }),
            expect.objectContaining({ type: SU_EVENTS.LIMIT_MODIFIED, payload: expect.objectContaining({ limitType: 'minion', playTiming: 'banked' }) }),
        ]));
        expect(actionChoice.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.LIMIT_MODIFIED, payload: expect.objectContaining({ limitType: 'action', playTiming: 'banked' }) }),
        ]));
        expect(businessEvents(skipChoice.events)).toEqual([
            expect.objectContaining({ type: SU_EVENTS.WRAITHRUSTLERS_HQ_BONUS_UPDATED, payload: expect.objectContaining({ pending: false }) }),
        ]);
    });
});
