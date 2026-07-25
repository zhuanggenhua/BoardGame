import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { fireTriggers, isMinionProtected } from '../../domain/ongoingEffects';
import { getEffectiveBreakpoint, getEffectivePower } from '../../domain/ongoingModifiers';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    applyEvents,
    expectRegisteredAbilityContract,
    getPromptOption,
    getPromptOptions,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
} from '../helpers';
import { runCommand } from '../testRunner';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

describe('动作英雄代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('核心主动能力入口已注册', () => {
        const registrations = [
            ['action_heroes_all_out_of_bubblegum', 'onPlay'],
            ['action_heroes_collateral_damage', 'onPlay'],
            ['action_heroes_final_stand', 'special'],
            ['action_heroes_friends_through_eternity', 'onPlay'],
            ['action_heroes_get_to_the_choppa', 'onPlay'],
            ['action_heroes_hostage_rescue', 'onPlay'],
            ['action_heroes_kickboxbro', 'talent'],
            ['action_heroes_kickboxbro', 'special'],
            ['action_heroes_pushing_the_limit', 'onPlay'],
            ['action_heroes_slo_mo_attack', 'talent'],
            ['action_heroes_the_right_person', 'onPlay'],
            ['action_heroes_walk_away_slowly', 'special'],
            ['action_heroes_warbro', 'talent'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }
    });

    it('孤狼给附着随从 +4；同基地有第二个己方随从时改为 +2', () => {
        const soloCore = makeState({
            bases: [makeBase('base_the_jungle', [
                makeMinion('hero', 'action_heroes_commandbro', '0', 5, {
                    attachedActions: [{ uid: 'lone-wolf', defId: 'action_heroes_lone_wolf', ownerId: '0' }],
                }),
            ])],
        });
        const crowdedCore = makeState({
            bases: [makeBase('base_the_jungle', [
                makeMinion('hero', 'action_heroes_commandbro', '0', 5, {
                    attachedActions: [{ uid: 'lone-wolf', defId: 'action_heroes_lone_wolf', ownerId: '0' }],
                }),
                makeMinion('ally', 'pirate_first_mate', '0', 2),
            ])],
        });

        expect(getEffectivePower(soloCore, soloCore.bases[0].minions[0], 0)).toBe(9);
        expect(getEffectivePower(crowdedCore, crowdedCore.bases[0].minions[0], 0)).toBe(7);
    });

    it('隆布罗只在控制者自己回合、且该基地仅有其一个己方随从时降低临界点', () => {
        const activeSolo = makeState({
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_jungle', [
                makeMinion('rumbro', 'action_heroes_rumbro', '0', 5),
            ])],
        });
        const notOwnerTurn = makeState({
            currentPlayerIndex: 1,
            bases: [makeBase('base_the_jungle', [
                makeMinion('rumbro', 'action_heroes_rumbro', '0', 5),
            ])],
        });
        const withAlly = makeState({
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_jungle', [
                makeMinion('rumbro', 'action_heroes_rumbro', '0', 5),
                makeMinion('ally', 'pirate_first_mate', '0', 2),
            ])],
        });
        const baseline = getEffectiveBreakpoint(makeState({
            bases: [makeBase('base_the_jungle')],
        }), 0);

        expect(getEffectiveBreakpoint(activeSolo, 0)).toBe(baseline - 4);
        expect(getEffectiveBreakpoint(notOwnerTurn, 0)).toBe(baseline);
        expect(getEffectiveBreakpoint(withAlly, 0)).toBe(baseline);
    });

    it('口香糖全力以赴给目标己方随从 +2，并在其是唯一己方随从时授予额外行动', () => {
        const core = makeState({
            bases: [makeBase('base_the_jungle', [
                makeMinion('hero', 'action_heroes_commandbro', '0', 5),
                makeMinion('enemy', 'pirate_first_mate', '1', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('action_heroes_all_out_of_bubblegum', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'bubblegum',
            defId: 'action_heroes_all_out_of_bubblegum',
            baseIndex: 0,
            targetMinionUid: 'hero',
            random: FIXED_RANDOM,
            now: 10,
        });
        const after = applyEvents(core, result.events);

        expect(after.bases[0].minions.find(minion => minion.uid === 'hero')?.tempPowerModifier).toBe(2);
        expect(after.players['0'].actionLimit).toBe(2);
    });

    it('人质救援创建牌库随从选择，响应后把选中的随从置于牌库顶', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('action-card', 'action_heroes_collateral_damage', 'action', '0'),
                        makeCard('target-minion', 'action_heroes_warbro', 'minion', '0'),
                        makeCard('other-minion', 'action_heroes_commandbro', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('action_heroes_hostage_rescue', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'rescue',
            defId: 'action_heroes_hostage_rescue',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        expect(result.events).toContainEqual(expect.objectContaining({ type: SU_EVENTS.DECK_INSPECTED }));
        const prompt = getSimpleChoicePrompt(result.matchState!, 'action_heroes_hostage_rescue');
        expect(getPromptOptions(prompt).map((option: any) => option.value?.cardUid)).toEqual(['target-minion', 'other-minion']);

        const resolved = respondToPromptOption(
            result.matchState!,
            (option: any) => option.value?.cardUid === 'other-minion',
            'other minion option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'other-minion',
            'action-card',
            'target-minion',
        ]);
    });

    it('逼近极限逐基地创建选择：可给唯一己方随从 +2 指示物，也可改为抽 1 张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('drawn-action', 'action_heroes_collateral_damage', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_jungle', [
                    makeMinion('solo-a', 'action_heroes_commandbro', '0', 5),
                    makeMinion('enemy-a', 'pirate_first_mate', '1', 2),
                ]),
                makeBase('base_tar_pits', [
                    makeMinion('solo-b', 'action_heroes_warbro', '0', 5),
                ]),
                makeBase('base_ninja_dojo', [
                    makeMinion('crowded-a', 'pirate_first_mate', '0', 2),
                    makeMinion('crowded-b', 'pirate_first_mate', '0', 2),
                ]),
            ],
        });

        const result = invokeRegisteredAbilityContract('action_heroes_pushing_the_limit', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'pushing',
            defId: 'action_heroes_pushing_the_limit',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const firstPrompt = getSimpleChoicePrompt(result.matchState!, 'action_heroes_pushing_the_limit');
        const firstResolved = respondToPromptOption(
            result.matchState!,
            (option: any) => option.value?.mode === 'counters' && option.value?.minionUid === 'solo-a',
            'solo-a counter option',
            '0',
            FIXED_RANDOM,
        );
        const soloA = firstResolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'solo-a');

        expect(getPromptOptions(firstPrompt).map((option: any) => option.value?.mode)).toEqual(['counters', 'draw']);
        expect(soloA?.powerCounters).toBe(2);

        const secondPrompt = getSimpleChoicePrompt(firstResolved.finalState, 'action_heroes_pushing_the_limit');
        const secondResolved = respondToPromptOption(
            firstResolved.finalState,
            (option: any) => option.value?.mode === 'draw' && option.value?.minionUid === 'solo-b',
            'solo-b draw option',
            '0',
            FIXED_RANDOM,
        );

        expect(getPromptOptions(secondPrompt).map((option: any) => option.value?.minionUid)).toEqual(['solo-b', 'solo-b']);
        expect(secondResolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['drawn-action']);
        expect(secondResolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'solo-b')?.powerCounters).toBeUndefined();
    });

    it('战争兄弟天赋在多个合格基地时创建选择，并只降低被选基地临界点', () => {
        const core = makeState({
            bases: [
                makeBase('base_the_jungle', [makeMinion('warbro', 'action_heroes_warbro', '0', 5)]),
                makeBase('base_tar_pits', [makeMinion('ally-1', 'pirate_first_mate', '0', 2)]),
                makeBase('base_ninja_dojo', [makeMinion('ally-2', 'pirate_first_mate', '0', 2)]),
            ],
        });

        const used = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'warbro', baseIndex: 0 },
        } as any, FIXED_RANDOM);

        expect(used.success).toBe(true);
        const prompt = getSimpleChoicePrompt(used.finalState, 'action_heroes_warbro');
        const target = getPromptOption(prompt, (option: any) => option.value?.baseIndex === 2, 'base 2 option');
        const resolved = respondToPromptOption(used.finalState, option => option.id === target.id, 'selected base 2', '0', FIXED_RANDOM);

        expect(getEffectiveBreakpoint(resolved.finalState.core, 1)).toBe(16);
        expect(getEffectiveBreakpoint(resolved.finalState.core, 2)).toBe(15);
    });

    it('慢动作攻击只保护己方随从免受其他玩家行动影响，不阻止非行动来源或自己的行动', () => {
        const core = makeState({
            bases: [makeBase({
                defId: 'base_the_jungle',
                minions: [makeMinion('hero', 'action_heroes_commandbro', '0', 5)],
                ongoingActions: [{ uid: 'slo-mo', defId: 'action_heroes_slo_mo_attack', ownerId: '0' }],
            })],
        });
        const target = core.bases[0].minions[0];

        expect(isMinionProtected(core, target, 0, '1', 'affect', { sourceKind: 'action' })).toBe(true);
        expect(isMinionProtected(core, target, 0, '1', 'affect', { sourceKind: 'nonAction' })).toBe(false);
        expect(isMinionProtected(core, target, 0, '0', 'affect', { sourceKind: 'action' })).toBe(false);
    });

    it('指挥兄弟在回合结束且自己是该基地唯一己方随从时抽 1 张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('drawn', 'action_heroes_hostage_rescue', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_jungle', [
                makeMinion('commandbro', 'action_heroes_commandbro', '0', 5),
                makeMinion('enemy', 'pirate_first_mate', '1', 2),
            ])],
        });

        const result = fireTriggers(core, 'onTurnEnd', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const after = applyEvents(core, result.events);

        expect(after.players['0'].hand.map(card => card.uid)).toEqual(['drawn']);
    });

    it('踢拳兄弟回合结束可把一张手牌储存在自己下方', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('stored-action', 'action_heroes_collateral_damage', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_jungle', [
                makeMinion('kickboxbro', 'action_heroes_kickboxbro', '0', 5),
            ])],
        });

        const result = fireTriggers(core, 'onTurnEnd', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'action_heroes_kickboxbro_store');
        const resolved = respondToPromptOption(
            result.matchState!,
            (option: any) => option.value?.cardUid === 'stored-action',
            'stored hand action option',
            '0',
            FIXED_RANDOM,
        );

        expect(getPromptOptions(prompt).map((option: any) => option.id)).toEqual(['skip', 'store-0']);
        expect(resolved.finalState.core.players['0'].hand).toEqual([]);
        expect(resolved.finalState.core.players['0'].storedCards).toEqual([
            expect.objectContaining({
                uid: 'stored-action',
                defId: 'action_heroes_collateral_damage',
                storedUnderUid: 'kickboxbro',
                storedUnderDefId: 'action_heroes_kickboxbro',
                reason: 'action_heroes_kickboxbro',
            }),
        ]);
    });

    it('踢拳兄弟天赋选择已储存行动后授予限定额外行动，并可从暂存区真实打出', () => {
        const storedAction = {
            ...makeCard('stored-action', 'action_heroes_collateral_damage', 'action', '0'),
            storedByPlayerId: '0',
            storedUnderUid: 'kickboxbro',
            storedUnderDefId: 'action_heroes_kickboxbro',
            reason: 'action_heroes_kickboxbro',
        };
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    actionsPlayed: 1,
                    actionLimit: 1,
                    storedCards: [storedAction],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_jungle', [
                makeMinion('kickboxbro', 'action_heroes_kickboxbro', '0', 5),
            ])],
        });

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'kickboxbro', baseIndex: 0 },
        } as any, FIXED_RANDOM);
        expect(talent.success).toBe(true);

        const prompt = getSimpleChoicePrompt(talent.finalState, 'action_heroes_kickboxbro_play_stored');
        const chosen = respondToPromptOption(
            talent.finalState,
            (option: any) => option.value?.cardUid === 'stored-action',
            'stored action option',
            '0',
            FIXED_RANDOM,
        );
        const limitEvent = chosen.events.find(event => event.type === SU_EVENTS.LIMIT_MODIFIED) as any;

        expect(getPromptOptions(prompt).map((option: any) => option.id)).toEqual(['skip', 'stored-action-0']);
        expect(limitEvent?.payload).toEqual(expect.objectContaining({
            limitType: 'action',
            restrictToCardUid: 'stored-action',
            restrictToCardDefId: 'action_heroes_collateral_damage',
        }));
        expect(chosen.finalState.core.players['0'].actionLimit).toBe(2);

        const played = runCommand(chosen.finalState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'stored-action', fromStored: true, targetBaseIndex: 0 },
        } as any, FIXED_RANDOM);

        expect(played.success).toBe(true);
        expect(played.finalState.core.players['0'].storedCards).toBeUndefined();
        expect(played.finalState.core.players['0'].discard.map(card => card.uid)).toContain('stored-action');
    });

    it('永恒挚友弃一张手牌后授予两个额外行动额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('discard-me', 'action_heroes_collateral_damage', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('action_heroes_friends_through_eternity', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'friends',
            defId: 'action_heroes_friends_through_eternity',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'action_heroes_friends_through_eternity');
        expect(getPromptOptions(prompt).map((option: any) => option.value?.cardUid)).toEqual(['discard-me']);

        const resolved = respondToPromptOption(
            result.matchState!,
            (option: any) => option.value?.cardUid === 'discard-me',
            'discard selected hand card',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.players['0'].hand).toEqual([]);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['discard-me']);
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(3);
    });

    it('快上直升机移动唯一己方随从到其他基地，并因此授予额外行动', () => {
        const core = makeState({
            bases: [
                makeBase('base_the_jungle', [
                    makeMinion('hero', 'action_heroes_commandbro', '0', 5),
                    makeMinion('enemy', 'pirate_first_mate', '1', 2),
                ]),
                makeBase('base_tar_pits'),
            ],
        });

        const result = invokeRegisteredAbilityContract('action_heroes_get_to_the_choppa', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'choppa',
            defId: 'action_heroes_get_to_the_choppa',
            baseIndex: 0,
            targetMinionUid: 'hero',
            random: FIXED_RANDOM,
            now: 10,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'action_heroes_get_to_the_choppa');
        const resolved = respondToPromptOption(
            result.matchState!,
            (option: any) => option.value?.baseIndex === 1,
            'destination base',
            '0',
            FIXED_RANDOM,
        );

        expect(getPromptOptions(prompt).map((option: any) => option.value?.baseIndex)).toEqual([1]);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['enemy']);
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['hero']);
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
    });

    it('最后一搏在计分前摧毁其他每名玩家一个印刷力量 3 或更低的随从', () => {
        const core = makeState({
            bases: [makeBase('base_the_jungle', [
                makeMinion('hero', 'action_heroes_commandbro', '0', 5),
                makeMinion('weak-enemy', 'pirate_first_mate', '1', 2),
                makeMinion('strong-enemy', 'action_heroes_commandbro', '1', 5),
            ])],
        });

        const result = invokeRegisteredAbilityContract('action_heroes_final_stand', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'final-stand',
            defId: 'action_heroes_final_stand',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const after = applyEvents(core, result.events);

        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({ minionUid: 'weak-enemy' }),
        }));
        expect(after.bases[0].minions.map(minion => minion.uid)).toEqual(['hero', 'strong-enemy']);
    });

    it('慢慢走开在计分后选择己方随从返回拥有者手牌', () => {
        const core = makeState({
            bases: [makeBase('base_the_jungle', [
                makeMinion('hero', 'action_heroes_commandbro', '0', 5),
            ])],
        });

        const result = invokeRegisteredAbilityContract('action_heroes_walk_away_slowly', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'walk-away',
            defId: 'action_heroes_walk_away_slowly',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            (option: any) => option.value?.minionUid === 'hero',
            'hero return option',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.bases[0].minions).toEqual([]);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['hero']);
    });

    it('格蕾西在己方回合开始且自己是唯一己方随从时加指示物并获得等量临时力量', () => {
        const core = makeState({
            bases: [makeBase('base_the_jungle', [
                makeMinion('gracie', 'action_heroes_gracie_brones', '0', 5, { powerCounters: 1 }),
                makeMinion('enemy', 'pirate_first_mate', '1', 2),
            ])],
        });

        const result = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const after = applyEvents(core, result.events);
        const gracie = after.bases[0].minions.find(minion => minion.uid === 'gracie')!;

        expect(gracie.powerCounters).toBe(2);
        expect(gracie.tempPowerModifier).toBe(2);
    });

    it('机器兄弟在其他玩家打出或移动随从到这里后获得 +1 指示物', () => {
        const core = makeState({
            bases: [makeBase('base_the_jungle', [
                makeMinion('robobro', 'action_heroes_robobro', '0', 5),
            ])],
        });

        const result = fireTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const after = applyEvents(core, result.events);
        const sameController = fireTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });

        expect(after.bases[0].minions.find(minion => minion.uid === 'robobro')?.powerCounters).toBe(1);
        expect(sameController.events).toHaveLength(0);
    });
});

describe('返时者代表性停滞玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('99 英里选择一张手牌置入停滞并放置 2 个停滞指示物，同时抽 1 张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('target-card', 'backtimers_sidelined_girlfriend', 'minion', '0')],
                    deck: [makeCard('drawn-card', 'backtimers_will_have_to_do', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('backtimers_99_mph', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'mph',
            defId: 'backtimers_99_mph',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        expect(result.events).toContainEqual(expect.objectContaining({ type: SU_EVENTS.CARDS_DRAWN }));

        const afterDraw = applyEvents(core, result.events);
        const prompted = { ...result.matchState!, core: afterDraw };
        const prompt = getSimpleChoicePrompt(prompted, 'backtimers_99_mph');
        const resolved = respondToPromptOption(
            prompted,
            (option: any) => option.value?.cardUid === 'target-card',
            'stasis target card',
            '0',
            FIXED_RANDOM,
        );

        expect(getPromptOptions(prompt).map((option: any) => option.value?.cardUid)).toEqual(['target-card']);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['drawn-card']);
        expect(resolved.finalState.core.players['0'].storedCards).toEqual([
            expect.objectContaining({
                uid: 'target-card',
                defId: 'backtimers_sidelined_girlfriend',
                counters: 2,
                reason: 'backtimers_stasis',
                storedUnderDefId: 'backtimers_99_mph',
            }),
        ]);
    });

    it('疯狂博士在回合开始可移除一张停滞牌的停滞指示物，并记录本回合最后指示物移除', () => {
        const storedCard = {
            ...makeCard('stasis-card', 'backtimers_future_almanac', 'action', '0'),
            storedByPlayerId: '0',
            counters: 1,
            reason: 'backtimers_stasis',
        };
        const core = makeState({
            turnNumber: 7,
            players: {
                '0': makePlayer('0', { storedCards: [storedCard] as any }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_jungle', [
                makeMinion('zany', 'backtimers_zany_prof', '0', 4),
            ])],
        });

        const result = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'backtimers_zany_prof_stasis');
        const resolved = respondToPromptOption(
            result.matchState!,
            (option: any) => option.value?.mode === 'remove' && option.value?.cardUid === 'stasis-card',
            'remove stasis counter',
            '0',
            FIXED_RANDOM,
        );
        const stored = resolved.finalState.core.players['0'].storedCards?.find(card => card.uid === 'stasis-card');

        expect(getPromptOptions(prompt).some((option: any) => option.value?.mode === 'add')).toBe(true);
        expect(stored?.counters).toBe(0);
        expect(stored?.lastStasisCounterRemovedTurn).toBe(7);
    });

    it('亚历克斯仅在本回合移除过最后一个停滞指示物后，天赋可给己方随从 +1 指示物', () => {
        const storedCard = {
            ...makeCard('stasis-card', 'backtimers_future_almanac', 'action', '0'),
            storedByPlayerId: '0',
            counters: 0,
            lastStasisCounterRemovedTurn: 3,
            reason: 'backtimers_stasis',
        };
        const core = makeState({
            turnNumber: 3,
            players: {
                '0': makePlayer('0', { storedCards: [storedCard] as any }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_jungle', [
                makeMinion('alex', 'backtimers_alex_p_mcglide', '0', 5),
                makeMinion('target', 'backtimers_zany_prof', '0', 4),
            ])],
        });

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'alex', baseIndex: 0 },
        } as any, FIXED_RANDOM);
        expect(talent.success).toBe(true);

        const prompt = getSimpleChoicePrompt(talent.finalState, 'backtimers_alex_p_mcglide_counter');
        const resolved = respondToPromptOption(
            talent.finalState,
            (option: any) => option.value?.minionUid === 'target',
            'target minion counter option',
            '0',
            FIXED_RANDOM,
        );

        expect(getPromptOptions(prompt).map((option: any) => option.id)).toContain('skip');
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'target')?.powerCounters).toBe(1);
    });

    it('被冷落的女友从停滞区作为额外随从打出，并在自己身上放置 +1 指示物', () => {
        const storedCard = {
            ...makeCard('sidelined', 'backtimers_sidelined_girlfriend', 'minion', '0'),
            storedByPlayerId: '0',
            counters: 0,
            reason: 'backtimers_stasis',
        };
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    minionsPlayed: 1,
                    minionLimit: 1,
                    storedCards: [storedCard] as any,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_jungle')],
        });

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'sidelined', baseIndex: 0, fromStored: true },
        } as any, FIXED_RANDOM);

        expect(played.success).toBe(true);
        expect(played.finalState.core.players['0'].storedCards).toBeUndefined();
        expect(played.finalState.core.bases[0].minions).toEqual([
            expect.objectContaining({
                uid: 'sidelined',
                defId: 'backtimers_sidelined_girlfriend',
                powerCounters: 1,
                metadata: expect.objectContaining({ playedFrom: 'stored' }),
            }),
        ]);
    });
});
