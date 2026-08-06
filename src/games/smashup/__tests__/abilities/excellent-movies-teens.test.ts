import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { fireTriggers, hasRegisteredTrigger, isMinionProtected } from '../../domain/ongoingEffects';
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

const makeAbilityContext = (
    core: ReturnType<typeof makeState>,
    defId: string,
    cardUid: string,
    baseIndex = 0,
    overrides: Record<string, unknown> = {},
) => ({
    state: core,
    matchState: makeMatchState(core),
    playerId: '0',
    cardUid,
    defId,
    baseIndex,
    random: FIXED_RANDOM,
    now: 10,
    ...overrides,
}) as any;

describe('动作英雄、返时者、异形变体、青少年、怨灵捕手结构注册覆盖', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('所有已实现能力入口均已注册', () => {
        const registrations = [
            ['action_heroes_all_out_of_bubblegum', 'onPlay'],
            ['action_heroes_collateral_damage', 'onPlay'],
            ['action_heroes_final_stand', 'special'],
            ['action_heroes_friends_through_eternity', 'onPlay'],
            ['action_heroes_get_to_the_choppa', 'onPlay'],
            ['action_heroes_hostage_rescue', 'onPlay'],
            ['action_heroes_kickboxbro', 'special'],
            ['action_heroes_kickboxbro', 'talent'],
            ['action_heroes_pushing_the_limit', 'onPlay'],
            ['action_heroes_slo_mo_attack', 'talent'],
            ['action_heroes_the_right_person', 'onPlay'],
            ['action_heroes_walk_away_slowly', 'special'],
            ['action_heroes_warbro', 'talent'],
            ['backtimers_99_mph', 'onPlay'],
            ['backtimers_alex_p_mcglide', 'onPlay'],
            ['backtimers_alex_p_mcglide', 'talent'],
            ['backtimers_back_from_the_future', 'onPlay'],
            ['backtimers_disrupt_the_space_time_continuum', 'onPlay'],
            ['backtimers_future_almanac', 'onPlay'],
            ['backtimers_future_almanac', 'special'],
            ['backtimers_help_from_the_past', 'onPlay'],
            ['backtimers_help_from_the_past', 'special'],
            ['backtimers_letter_from_another_time', 'onPlay'],
            ['backtimers_letter_from_another_time', 'special'],
            ['backtimers_lifelong_bully', 'onPlay'],
            ['backtimers_lightning_strike', 'onPlay'],
            ['backtimers_lightning_strike', 'special'],
            ['backtimers_sidelined_girlfriend', 'onPlay'],
            ['backtimers_sidelined_girlfriend', 'special'],
            ['backtimers_will_have_to_do', 'onPlay'],
            ['extramorphs_alien_life_form', 'onPlay'],
            ['extramorphs_alien_life_form', 'talent'],
            ['extramorphs_chestbreaker', 'talent'],
            ['extramorphs_close_encounters', 'onPlay'],
            ['extramorphs_distress_call', 'onPlay'],
            ['extramorphs_egg_field', 'onPlay'],
            ['extramorphs_egg_field', 'talent'],
            ['extramorphs_extradrone', 'onPlay'],
            ['extramorphs_five_by_five', 'onPlay'],
            ['extramorphs_game_over_dude', 'onPlay'],
            ['extramorphs_head_grabber', 'talent'],
            ['extramorphs_hive_queen', 'onPlay'],
            ['extramorphs_hive_queen', 'talent'],
            ['extramorphs_nuke_it_from_orbit', 'talent'],
            ['extramorphs_time_to_go', 'onPlay'],
            ['teens_abe_frohman', 'talent'],
            ['teens_brain', 'onPlay'],
            ['teens_brunch_bunch', 'onPlay'],
            ['teens_explosion_at_school', 'onPlay'],
            ['teens_jock', 'onPlay'],
            ['teens_new_kid', 'onPlay'],
            ['teens_prep', 'onPlay'],
            ['teens_principals_office', 'onPlay'],
            ['teens_rebel', 'onPlay'],
            ['teens_slacker', 'onPlay'],
            ['teens_strange_science', 'onPlay'],
            ['wraithrustlers_ancient_sumerian_god', 'onDestroy'],
            ['wraithrustlers_ancient_sumerian_god', 'onPlay'],
            ['wraithrustlers_ancient_sumerian_god', 'talent'],
            ['wraithrustlers_demon_dogs', 'onDestroy'],
            ['wraithrustlers_demon_dogs', 'onPlay'],
            ['wraithrustlers_ectoplasm_one', 'talent'],
            ['wraithrustlers_ellen', 'talent'],
            ['wraithrustlers_funkman', 'special'],
            ['wraithrustlers_librarian_haunt', 'onDestroy'],
            ['wraithrustlers_resurgence', 'onPlay'],
            ['wraithrustlers_resurgence', 'special'],
            ['wraithrustlers_roy', 'onPlay'],
            ['wraithrustlers_slimy', 'onDestroy'],
            ['wraithrustlers_the_tools_and_the_talent', 'onPlay'],
            ['wraithrustlers_unlicensed_nuclear_accelerator', 'talent'],
            ['wraithrustlers_watson', 'onPlay'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }
    });

    it('所有已实现持续触发与基地触发入口均已注册', () => {
        const triggers = [
            ['action_heroes_commandbro', 'onTurnEnd'],
            ['action_heroes_gracie_brones', 'onTurnStart'],
            ['action_heroes_kickboxbro', 'onTurnEnd'],
            ['action_heroes_robobro', 'onMinionMoved'],
            ['action_heroes_robobro', 'onMinionPlayed'],
            ['backtimers_zany_prof', 'onTurnStart'],
            ['base_ancient_crashed_ship', 'onMinionPlayed'],
            ['base_montridge_high', 'onMinionPlayed'],
            ['base_rooftop_portal', 'onCardDestroyed'],
            ['teens_booty_trap', 'onMinionMoved'],
            ['teens_booty_trap', 'onMinionPlayed'],
            ['wraithrustlers_ancient_sumerian_god', 'onCardDestroyed'],
            ['wraithrustlers_demon_dogs', 'onCardDestroyed'],
            ['wraithrustlers_ellen', 'onCardDestroyed'],
            ['wraithrustlers_funkman', 'onCardDestroyed'],
            ['wraithrustlers_librarian_haunt', 'onCardDestroyed'],
            ['wraithrustlers_slimy', 'onCardDestroyed'],
        ] as const;

        for (const [defId, event] of triggers) {
            expect(hasRegisteredTrigger(defId, event), `${defId}::${event}`).toBe(true);
        }
    });
});

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

    it('一生恶霸优先给已有停滞牌增加指示物；没有停滞牌时把牌库顶置入停滞', () => {
        const existingStasis = {
            ...makeCard('stasis-card', 'backtimers_future_almanac', 'action', '0'),
            storedByPlayerId: '0',
            counters: 1,
            reason: 'backtimers_stasis',
        };
        const withStored = makeState({
            players: {
                '0': makePlayer('0', { storedCards: [existingStasis] as any }),
                '1': makePlayer('1'),
            },
        });

        const increment = invokeRegisteredAbilityContract('backtimers_lifelong_bully', 'onPlay',
            makeAbilityContext(withStored, 'backtimers_lifelong_bully', 'bully'));
        const incremented = applyEvents(withStored, increment.events);

        expect(incremented.players['0'].storedCards?.find(card => card.uid === 'stasis-card')?.counters).toBe(2);

        const withoutStored = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top-card', 'backtimers_will_have_to_do', 'action', '0'),
                        makeCard('tail-card', 'backtimers_future_almanac', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const storeTop = invokeRegisteredAbilityContract('backtimers_lifelong_bully', 'onPlay',
            makeAbilityContext(withoutStored, 'backtimers_lifelong_bully', 'bully'));
        const stored = applyEvents(withoutStored, storeTop.events);

        expect(storeTop.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.DECK_INSPECTED,
            payload: expect.objectContaining({ count: 2 }),
        }));
        expect(stored.players['0'].deck.map(card => card.uid)).toEqual(['tail-card']);
        expect(stored.players['0'].storedCards).toEqual([
            expect.objectContaining({
                uid: 'top-card',
                counters: 2,
                reason: 'backtimers_stasis',
                storedUnderDefId: 'backtimers_lifelong_bully',
            }),
        ]);
    });

    it('从未来回来检查牌库顶 3 张，并把牌库顶牌置入停滞', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('future-card', 'backtimers_lightning_strike', 'action', '0'),
                        makeCard('second-card', 'backtimers_future_almanac', 'action', '0'),
                        makeCard('third-card', 'backtimers_will_have_to_do', 'action', '0'),
                        makeCard('fourth-card', 'backtimers_lifelong_bully', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('backtimers_back_from_the_future', 'onPlay',
            makeAbilityContext(core, 'backtimers_back_from_the_future', 'back-from-future'));
        const after = applyEvents(core, result.events);

        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.DECK_INSPECTED,
            payload: expect.objectContaining({ count: 3 }),
        }));
        expect(after.players['0'].deck.map(card => card.uid)).toEqual(['second-card', 'third-card', 'fourth-card']);
        expect(after.players['0'].storedCards).toEqual([
            expect.objectContaining({
                uid: 'future-card',
                counters: 2,
                reason: 'backtimers_stasis',
                storedUnderDefId: 'backtimers_back_from_the_future',
            }),
        ]);
    });

    it('闪电打击从停滞区打出时按停滞指示物降低目标基地临界点', () => {
        const storedCard = {
            ...makeCard('lightning', 'backtimers_lightning_strike', 'action', '0'),
            storedByPlayerId: '0',
            counters: 4,
            reason: 'backtimers_stasis',
        };
        const core = makeState({
            players: {
                '0': makePlayer('0', { storedCards: [storedCard] as any }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_jungle')],
        });
        const baseline = getEffectiveBreakpoint(core, 0);

        const result = invokeRegisteredAbilityContract('backtimers_lightning_strike', 'onPlay', {
            ...makeAbilityContext(core, 'backtimers_lightning_strike', 'lightning', 0),
            fromStored: true,
            targetBaseIndex: 0,
        });
        const after = applyEvents(core, result.events);

        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: expect.objectContaining({ delta: -4, baseIndex: 0 }),
        }));
        expect(getEffectiveBreakpoint(after, 0)).toBe(baseline - 4);
    });

    it('扰乱时空连续体把最多两张其他手牌置入停滞，并按数量放置指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('disrupt', 'backtimers_disrupt_the_space_time_continuum', 'action', '0'),
                        makeCard('target-a', 'backtimers_will_have_to_do', 'action', '0'),
                        makeCard('target-b', 'backtimers_lifelong_bully', 'minion', '0'),
                        makeCard('left-in-hand', 'backtimers_future_almanac', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('backtimers_disrupt_the_space_time_continuum', 'onPlay',
            makeAbilityContext(core, 'backtimers_disrupt_the_space_time_continuum', 'disrupt'));
        const after = applyEvents(core, result.events);

        expect(after.players['0'].hand.map(card => card.uid)).toEqual(['disrupt', 'left-in-hand']);
        expect(after.players['0'].storedCards).toEqual([
            expect.objectContaining({ uid: 'target-a', counters: 2, reason: 'backtimers_stasis' }),
            expect.objectContaining({ uid: 'target-b', counters: 2, reason: 'backtimers_stasis' }),
        ]);
    });
});

describe('异形变体代表性牌库玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('核心主动能力入口已注册', () => {
        const registrations = [
            ['extramorphs_alien_life_form', 'onPlay'],
            ['extramorphs_alien_life_form', 'talent'],
            ['extramorphs_chestbreaker', 'talent'],
            ['extramorphs_egg_field', 'onPlay'],
            ['extramorphs_egg_field', 'talent'],
            ['extramorphs_extradrone', 'onPlay'],
            ['extramorphs_head_grabber', 'talent'],
            ['extramorphs_nuke_it_from_orbit', 'talent'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }
    });

    it('异形生命体从牌库打出时不消耗普通随从额度，摧毁弱随从并获得 2 个力量指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    minionsPlayed: 1,
                    minionLimit: 1,
                    deck: [makeCard('alien-life', 'extramorphs_alien_life_form', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_jungle', [
                makeMinion('weak-enemy', 'pirate_first_mate', '1', 2),
            ])],
        });

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'alien-life', baseIndex: 0, fromDeck: true },
        } as any, FIXED_RANDOM);

        expect(played.success).toBe(true);
        expect(played.finalState.core.players['0'].minionsPlayed).toBe(1);
        expect(played.finalState.core.players['0'].deck).toEqual([]);
        expect(played.finalState.core.players['1'].discard.map(card => card.uid)).toEqual(['weak-enemy']);
        expect(played.finalState.core.bases[0].minions).toEqual([
            expect.objectContaining({
                uid: 'alien-life',
                defId: 'extramorphs_alien_life_form',
                powerCounters: 2,
                metadata: expect.objectContaining({ playedFrom: 'deck' }),
            }),
        ]);
    });

    it('额外工蜂从牌库打出时获得指示物，并把自己和弱敌人移到另一基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('drone', 'extramorphs_extradrone', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_jungle', [makeMinion('weak-enemy', 'pirate_first_mate', '1', 2)]),
                makeBase('base_tar_pits'),
            ],
        });

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'drone', baseIndex: 0, fromDeck: true },
        } as any, FIXED_RANDOM);

        expect(played.success).toBe(true);
        expect(played.finalState.core.bases[0].minions).toEqual([]);
        expect(played.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['weak-enemy', 'drone']);
        expect(played.finalState.core.bases[1].minions.find(minion => minion.uid === 'drone')?.powerCounters).toBe(1);
    });

    it('蛋田天赋锁定牌库 2 力随从为额外随从，并可真实从牌库打出', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    minionsPlayed: 1,
                    minionLimit: 1,
                    deck: [
                        makeCard('alien-life', 'extramorphs_alien_life_form', 'minion', '0'),
                        makeCard('chestbreaker', 'extramorphs_chestbreaker', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_the_jungle',
                ongoingActions: [{ uid: 'egg-field', defId: 'extramorphs_egg_field', ownerId: '0' }],
            })],
        });

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'egg-field', baseIndex: 0 },
        } as any, FIXED_RANDOM);
        expect(talent.success).toBe(true);

        const prompt = getSimpleChoicePrompt(talent.finalState, 'smashup_immediate_extra_minion');
        expect(getPromptOption(prompt, option =>
            option.value?.cardUid === 'chestbreaker' && option.value?.source === 'deck',
            '牌库里的抱胸怪额外随从选项',
        )).toBeTruthy();

        const chooseCard = respondToPromptOption(talent.finalState, option =>
            option.value?.cardUid === 'chestbreaker' && option.value?.source === 'deck',
            '牌库里的抱胸怪额外随从选项',
            '0',
            FIXED_RANDOM,
        );
        expect(chooseCard.success).toBe(true);

        const played = respondToPromptOption(chooseCard.finalState, option =>
            option.value?.baseIndex === 0,
            '牌库里的抱胸怪目标基地选项',
            '0',
            FIXED_RANDOM,
        );

        expect(played.success).toBe(true);
        expect(played.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['alien-life']);
        expect(played.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('chestbreaker');
        expect(played.finalState.core.bases[0].minions.find(minion => minion.uid === 'chestbreaker')?.metadata)
            .toEqual(expect.objectContaining({ playedFrom: 'deck' }));
    });

    it('抱脸虫天赋摧毁宿主，并授予牌库 4 力随从额外打出额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('chestbreaker', 'extramorphs_chestbreaker', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_jungle', [
                makeMinion('host', 'pirate_first_mate', '1', 2, {
                    attachedActions: [{ uid: 'head-grabber', defId: 'extramorphs_head_grabber', ownerId: '0' }],
                }),
            ])],
        });

        const result = invokeRegisteredAbilityContract('extramorphs_head_grabber', 'talent',
            makeAbilityContext(core, 'extramorphs_head_grabber', 'head-grabber'));
        const after = applyEvents(core, result.events);

        expect(after.bases[0].minions).toEqual([]);
        expect(after.players['1'].discard.map(card => card.uid)).toEqual(['host']);
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                limitType: 'minion',
                playTiming: 'immediate',
                specificCardUid: 'chestbreaker',
                powerMax: 4,
                restrictToBase: 0,
            }),
        }));
    });

    it('异形皇后从牌库找回蛋田；天赋让蛋田所在基地的敌方随从 -1', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('tail-card', 'extramorphs_game_over_dude', 'action', '0'),
                        makeCard('egg-field', 'extramorphs_egg_field', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_the_jungle',
                minions: [
                    makeMinion('queen', 'extramorphs_hive_queen', '0', 5),
                    makeMinion('enemy', 'pirate_first_mate', '1', 2),
                ],
                ongoingActions: [{ uid: 'ongoing-egg', defId: 'extramorphs_egg_field', ownerId: '0' }],
            })],
        });

        const onPlay = invokeRegisteredAbilityContract('extramorphs_hive_queen', 'onPlay',
            makeAbilityContext(core, 'extramorphs_hive_queen', 'queen'));
        const afterOnPlay = applyEvents(core, onPlay.events);

        expect(afterOnPlay.players['0'].hand.map(card => card.uid)).toContain('egg-field');
        expect(afterOnPlay.players['0'].deck.map(card => card.uid)).toEqual(['tail-card']);

        const talent = invokeRegisteredAbilityContract('extramorphs_hive_queen', 'talent',
            makeAbilityContext(core, 'extramorphs_hive_queen', 'queen'));
        const afterTalent = applyEvents(core, talent.events);
        const enemy = afterTalent.bases[0].minions.find(minion => minion.uid === 'enemy')!;

        expect(getEffectivePower(afterTalent, enemy, 0)).toBe(1);
    });

    it('求救信号移动指定己方随从到另一个基地', () => {
        const core = makeState({
            bases: [
                makeBase('base_the_jungle', [
                    makeMinion('target', 'extramorphs_chestbreaker', '0', 4),
                    makeMinion('queen', 'extramorphs_hive_queen', '0', 5),
                ]),
                makeBase('base_tar_pits'),
            ],
        });

        const result = invokeRegisteredAbilityContract('extramorphs_distress_call', 'onPlay', {
            ...makeAbilityContext(core, 'extramorphs_distress_call', 'distress', 0),
            targetMinionUid: 'target',
        });
        const after = applyEvents(core, result.events);

        expect(after.bases[0].minions.map(minion => minion.uid)).toEqual(['queen']);
        expect(after.bases[1].minions.map(minion => minion.uid)).toEqual(['target']);
    });

    it('游戏结束了伙计授予牌库 4 力随从的即时额外打出额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('alien-life', 'extramorphs_alien_life_form', 'minion', '0'),
                        makeCard('chestbreaker', 'extramorphs_chestbreaker', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_jungle')],
        });

        const result = invokeRegisteredAbilityContract('extramorphs_game_over_dude', 'onPlay',
            makeAbilityContext(core, 'extramorphs_game_over_dude', 'game-over'));

        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                limitType: 'minion',
                playTiming: 'immediate',
                specificCardUid: 'alien-life',
                powerMax: 4,
                restrictToBase: 0,
            }),
        }));
    });
});

describe('青少年代表性力量 3 协同玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('核心主动与触发入口已注册', () => {
        const registrations = [
            ['teens_brain', 'onPlay'],
            ['teens_jock', 'onPlay'],
            ['teens_prep', 'onPlay'],
            ['teens_rebel', 'onPlay'],
            ['teens_slacker', 'onPlay'],
            ['teens_new_kid', 'onPlay'],
            ['teens_principals_office', 'onPlay'],
            ['teens_strange_science', 'onPlay'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }
        expect(hasRegisteredTrigger('teens_brain', 'onMinionPlayed')).toBe(true);
        expect(hasRegisteredTrigger('teens_booty_trap', 'onMinionMoved')).toBe(true);
    });

    it('脑子看到己方打出 3 力随从会抽 1 张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('drawn', 'teens_babysitter', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_jungle', [
                makeMinion('brain', 'teens_brain', '0', 3),
            ])],
        });

        const result = fireTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'played-jock',
            triggerMinionDefId: 'teens_jock',
            triggerMinionPower: 3,
            random: FIXED_RANDOM,
            now: 10,
        });
        const after = applyEvents(core, result.events);

        expect(after.players['0'].hand.map(card => card.uid)).toEqual(['drawn']);
    });

    it('运动员和预科生同基地时，运动员打出获得 2 个力量指示物', () => {
        const core = makeState({
            bases: [makeBase('base_the_jungle', [
                makeMinion('prep', 'teens_prep', '0', 3),
            ])],
        });

        const result = invokeRegisteredAbilityContract('teens_jock', 'onPlay',
            makeAbilityContext(core, 'teens_jock', 'jock', 0));
        const after = applyEvents({
            ...core,
            bases: [makeBase('base_the_jungle', [
                makeMinion('prep', 'teens_prep', '0', 3),
                makeMinion('jock', 'teens_jock', '0', 3),
            ])],
        }, result.events);

        expect(after.bases[0].minions.find(minion => minion.uid === 'jock')?.powerCounters).toBe(2);
    });

    it('保姆保护同基地所有己方随从免受其他玩家影响、消灭和移动', () => {
        const core = makeState({
            bases: [makeBase('base_the_jungle', [
                makeMinion('host', 'teens_jock', '0', 3, {
                    attachedActions: [{ uid: 'babysitter', defId: 'teens_babysitter', ownerId: '0' }],
                }),
                makeMinion('protected', 'teens_brain', '0', 3),
            ])],
        });
        const target = core.bases[0].minions.find(minion => minion.uid === 'protected')!;

        expect(isMinionProtected(core, target, 0, '1', 'affect')).toBe(true);
        expect(isMinionProtected(core, target, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(core, target, 0, '1', 'move')).toBe(true);
        expect(isMinionProtected(core, target, 0, '0', 'destroy')).toBe(false);
    });

    it('新来的孩子把牌库 3 力随从置顶并授予限定额外随从额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('action-card', 'teens_babysitter', 'action', '0'),
                        makeCard('prep-card', 'teens_prep', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('teens_new_kid', 'onPlay',
            makeAbilityContext(core, 'teens_new_kid', 'new-kid'));
        const after = applyEvents(core, result.events);

        expect(after.players['0'].deck.map(card => card.uid)).toEqual(['prep-card', 'action-card']);
        expect(after.players['0'].minionLimit).toBe(2);
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                limitType: 'minion',
                specificCardUid: 'prep-card',
                powerMax: 3,
            }),
        }));
    });

    it('校长办公室返回己方 3 力随从，并允许从牌库额外打出另一张 3 力随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('prep-card', 'teens_prep', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_jungle', [
                makeMinion('brain', 'teens_brain', '0', 3),
            ])],
        });

        const result = invokeRegisteredAbilityContract('teens_principals_office', 'onPlay',
            makeAbilityContext(core, 'teens_principals_office', 'office', 0));
        const after = applyEvents(core, result.events);

        expect(after.bases[0].minions).toEqual([]);
        expect(after.players['0'].hand.map(card => card.uid)).toEqual(['brain']);
        expect(after.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
        expect(after.players['0'].deck.map(card => card.uid)).toEqual(['prep-card']);
    });

    it('早午餐帮按同基地不同 3 力己方随从数量依次移动、抽牌、授予额外随从、加临时力量并回底弃牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('drawn-card', 'teens_babysitter', 'action', '0'),
                        makeCard('deck-power3', 'teens_brain', 'minion', '0'),
                    ],
                    discard: [makeCard('discard-card', 'teens_explosion_at_school', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_jungle', [
                    makeMinion('brain', 'teens_brain', '0', 3),
                    makeMinion('jock', 'teens_jock', '0', 3),
                    makeMinion('prep', 'teens_prep', '0', 3),
                    makeMinion('rebel', 'teens_rebel', '0', 3),
                    makeMinion('slacker', 'teens_slacker', '0', 3),
                ]),
                makeBase('base_tar_pits'),
            ],
        });

        const result = invokeRegisteredAbilityContract('teens_brunch_bunch', 'onPlay',
            makeAbilityContext(core, 'teens_brunch_bunch', 'brunch', 0));
        const after = applyEvents(core, result.events);

        expect(after.bases[0].minions.map(minion => minion.uid)).toEqual(['jock', 'prep', 'rebel', 'slacker']);
        expect(after.bases[1].minions.map(minion => minion.uid)).toEqual(['brain']);
        expect(after.players['0'].hand.map(card => card.uid)).toContain('drawn-card');
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                limitType: 'minion',
                playTiming: 'banked',
                specificCardUid: 'deck-power3',
                powerMax: 3,
                restrictToBase: 0,
            }),
        }));
        expect(getEffectivePower(after, after.bases[0].minions.find(minion => minion.uid === 'jock')!, 0)).toBe(5);
        expect(after.players['0'].deck.map(card => card.uid)).toContain('discard-card');
    });

    it('学校爆炸把弃牌堆中不同名称的 3 力随从回到底部，并抽 1 张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('drawn-card', 'teens_babysitter', 'action', '0')],
                    discard: [
                        makeCard('jock-a', 'teens_jock', 'minion', '0'),
                        makeCard('jock-b', 'teens_jock', 'minion', '0'),
                        makeCard('brain-a', 'teens_brain', 'minion', '0'),
                        makeCard('non-power3', 'action_heroes_commandbro', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('teens_explosion_at_school', 'onPlay',
            makeAbilityContext(core, 'teens_explosion_at_school', 'explosion'));
        const after = applyEvents(core, result.events);

        expect(after.players['0'].hand.map(card => card.uid)).toEqual(['drawn-card']);
        expect(after.players['0'].deck.map(card => card.uid)).toEqual(['jock-a', 'brain-a']);
        expect(after.players['0'].discard.map(card => card.uid)).toEqual(['jock-b', 'non-power3']);
    });
});

describe('怨灵捕手代表性 Wraith 行动玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('核心主动、摧毁和触发入口已注册', () => {
        const registrations = [
            ['wraithrustlers_roy', 'onPlay'],
            ['wraithrustlers_ellen', 'talent'],
            ['wraithrustlers_unlicensed_nuclear_accelerator', 'talent'],
            ['wraithrustlers_resurgence', 'onPlay'],
            ['wraithrustlers_resurgence', 'special'],
            ['wraithrustlers_funkman', 'special'],
            ['wraithrustlers_ancient_sumerian_god', 'talent'],
            ['wraithrustlers_ancient_sumerian_god', 'onDestroy'],
            ['wraithrustlers_demon_dogs', 'onPlay'],
            ['wraithrustlers_demon_dogs', 'onDestroy'],
            ['wraithrustlers_ectoplasm_one', 'talent'],
            ['wraithrustlers_librarian_haunt', 'onDestroy'],
            ['wraithrustlers_slimy', 'onDestroy'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }
        expect(hasRegisteredTrigger('wraithrustlers_librarian_haunt', 'onCardDestroyed')).toBe(true);
        expect(hasRegisteredTrigger('wraithrustlers_funkman', 'onCardDestroyed')).toBe(true);
    });

    it('罗伊打出时把另一个基地的己方持续行动转移到所在基地', () => {
        const core = makeState({
            bases: [
                makeBase('base_the_jungle', [makeMinion('roy', 'wraithrustlers_roy', '0', 3)]),
                makeBase({
                    defId: 'base_tar_pits',
                    ongoingActions: [{ uid: 'haunt', defId: 'wraithrustlers_librarian_haunt', ownerId: '0' }],
                }),
            ],
        });

        const result = invokeRegisteredAbilityContract('wraithrustlers_roy', 'onPlay',
            makeAbilityContext(core, 'wraithrustlers_roy', 'roy'));
        const after = applyEvents(core, result.events);

        expect(after.bases[0].ongoingActions.map(action => action.uid)).toEqual(['haunt']);
        expect(after.bases[1].ongoingActions).toEqual([]);
    });

    it('未授权核加速器提供 +2；天赋摧毁己方行动后给宿主 +1 指示物', () => {
        const core = makeState({
            bases: [makeBase({
                defId: 'base_the_jungle',
                minions: [makeMinion('host', 'wraithrustlers_roy', '0', 3, {
                    attachedActions: [{ uid: 'accelerator', defId: 'wraithrustlers_unlicensed_nuclear_accelerator', ownerId: '0' }],
                })],
                ongoingActions: [{ uid: 'resurgence', defId: 'wraithrustlers_resurgence', ownerId: '0' }],
            })],
        });

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(5);

        const result = invokeRegisteredAbilityContract('wraithrustlers_unlicensed_nuclear_accelerator', 'talent',
            makeAbilityContext(core, 'wraithrustlers_unlicensed_nuclear_accelerator', 'accelerator', 0));
        const after = applyEvents(core, result.events);
        const host = after.bases[0].minions[0];

        expect(after.bases[0].ongoingActions).toEqual([]);
        expect(host.powerCounters).toBe(1);
        expect(getEffectivePower(after, host, 0)).toBe(6);
    });

    it('恶魔狗存放手牌弱随从；被摧毁后释放为限定额外随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('stored-minion', 'teens_brain', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_jungle', [
                makeMinion('dogs', 'wraithrustlers_demon_dogs', '0', 0),
            ])],
        });

        const onPlay = invokeRegisteredAbilityContract('wraithrustlers_demon_dogs', 'onPlay',
            makeAbilityContext(core, 'wraithrustlers_demon_dogs', 'dogs'));
        const storedState = applyEvents(core, onPlay.events);

        expect(storedState.players['0'].hand).toEqual([]);
        expect(storedState.players['0'].storedCards).toEqual([
            expect.objectContaining({
                uid: 'stored-minion',
                storedUnderUid: 'dogs',
                storedUnderDefId: 'wraithrustlers_demon_dogs',
            }),
        ]);

        const onDestroy = invokeRegisteredAbilityContract('wraithrustlers_demon_dogs', 'onDestroy',
            makeAbilityContext(storedState, 'wraithrustlers_demon_dogs', 'dogs'));
        const releasedState = applyEvents(storedState, onDestroy.events);

        expect(releasedState.players['0'].storedCards).toEqual([
            expect.objectContaining({
                uid: 'stored-minion',
                storedUnderUid: 'dogs',
                storedUnderDefId: 'wraithrustlers_demon_dogs',
            }),
        ]);
        expect(releasedState.players['0'].minionLimit).toBe(1);
        expect(onDestroy.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                limitType: 'minion',
                playTiming: 'immediate',
                specificCardUid: 'stored-minion',
                restrictToBase: 0,
            }),
        }));
    });

    it('图书馆怨灵被摧毁会抽 3 张并标记 Wraith 被毁，罗伊因此获得 +2', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'wraithrustlers_resurgence', 'action', '0'),
                        makeCard('draw-2', 'wraithrustlers_slimy', 'action', '0'),
                        makeCard('draw-3', 'wraithrustlers_demon_dogs', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_jungle', [
                makeMinion('roy', 'wraithrustlers_roy', '0', 3),
            ])],
        });

        const result = invokeRegisteredAbilityContract('wraithrustlers_librarian_haunt', 'onDestroy',
            makeAbilityContext(core, 'wraithrustlers_librarian_haunt', 'haunt'));
        const after = applyEvents(core, result.events);

        expect(after.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2', 'draw-3']);
        expect(getEffectivePower(after, after.bases[0].minions[0], 0)).toBe(5);
        expect(after.bases[0].metadata?.wraithrustlersDestroyedWraithAction).toEqual(expect.objectContaining({
            __any: 1,
            '0': 1,
        }));
    });

    it('灵质一号天赋转移自身、移动己方随从，并摧毁目标基地行动', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_jungle',
                    minions: [makeMinion('ally', 'wraithrustlers_roy', '0', 3)],
                    ongoingActions: [{ uid: 'ecto', defId: 'wraithrustlers_ectoplasm_one', ownerId: '0' }],
                }),
                makeBase({
                    defId: 'base_tar_pits',
                    ongoingActions: [{ uid: 'target-action', defId: 'wraithrustlers_librarian_haunt', ownerId: '1' }],
                }),
            ],
        });

        const result = invokeRegisteredAbilityContract('wraithrustlers_ectoplasm_one', 'talent',
            makeAbilityContext(core, 'wraithrustlers_ectoplasm_one', 'ecto', 0, {
                targetBaseIndex: 1,
                targetMinionUid: 'ally',
            }));
        const after = applyEvents(core, result.events);

        expect(after.bases[0].minions).toEqual([]);
        expect(after.bases[0].ongoingActions).toEqual([]);
        expect(after.bases[1].minions.map(minion => minion.uid)).toEqual(['ally']);
        expect(after.bases[1].ongoingActions.map(action => action.uid)).toEqual(['ecto']);
        expect(after.players['1'].discard.map(card => card.uid)).toEqual(['target-action']);
    });

    it('古代苏美尔神天赋暂存基地行动；被摧毁后释放为逐基地限定额外行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('slimy', 'wraithrustlers_slimy', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_jungle'), makeBase('base_tar_pits')],
        });

        const talent = invokeRegisteredAbilityContract('wraithrustlers_ancient_sumerian_god', 'talent',
            makeAbilityContext(core, 'wraithrustlers_ancient_sumerian_god', 'god'));
        const storedState = applyEvents(core, talent.events);

        expect(storedState.players['0'].discard).toEqual([]);
        expect(storedState.players['0'].storedCards).toEqual([
            expect.objectContaining({
                uid: 'slimy',
                storedUnderUid: 'god',
                storedUnderDefId: 'wraithrustlers_ancient_sumerian_god',
            }),
        ]);

        const onDestroy = invokeRegisteredAbilityContract('wraithrustlers_ancient_sumerian_god', 'onDestroy',
            makeAbilityContext(storedState, 'wraithrustlers_ancient_sumerian_god', 'god'));
        const releasedState = applyEvents(storedState, onDestroy.events);

        expect(releasedState.players['0'].storedCards).toBeUndefined();
        expect(onDestroy.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.STORED_CARD_RELEASED,
            payload: expect.objectContaining({ cardUid: 'slimy' }),
        }));
        expect(onDestroy.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                limitType: 'action',
                restrictToCardUid: 'slimy',
                restrictToCardDefId: 'wraithrustlers_slimy',
                restrictToBase: 0,
            }),
        }));
    });

    it('放克曼看到同基地行动被摧毁时，己方随从本回合 +1', () => {
        const core = makeState({
            bases: [makeBase('base_the_jungle', [
                makeMinion('funkman', 'wraithrustlers_funkman', '0', 5),
                makeMinion('ally', 'wraithrustlers_roy', '0', 3),
                makeMinion('enemy', 'pirate_first_mate', '1', 2),
            ])],
        });

        const result = fireTriggers(core, 'onCardDestroyed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerCardUid: 'destroyed-action',
            triggerCardDefId: 'wraithrustlers_librarian_haunt',
            triggerCardOwnerId: '0',
            triggerCardKind: 'ongoing',
            random: FIXED_RANDOM,
            now: 10,
        });
        const after = applyEvents(core, result.events);

        expect(after.bases[0].minions.find(minion => minion.uid === 'funkman')?.tempPowerModifier).toBe(1);
        expect(after.bases[0].minions.find(minion => minion.uid === 'ally')?.tempPowerModifier).toBe(1);
        expect(after.bases[0].minions.find(minion => minion.uid === 'enemy')?.tempPowerModifier).toBeUndefined();
    });

    it('沃森没有可摧毁行动时，把牌库中的 Wraith 置顶并抽到手牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('tail-card', 'teens_babysitter', 'action', '0'),
                        makeCard('wraith-card', 'wraithrustlers_librarian_haunt', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('wraithrustlers_watson', 'onPlay',
            makeAbilityContext(core, 'wraithrustlers_watson', 'watson'));
        const after = applyEvents(core, result.events);

        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.DECK_INSPECTED,
            payload: expect.objectContaining({ count: 2 }),
        }));
        expect(after.players['0'].hand.map(card => card.uid)).toEqual(['wraith-card']);
        expect(after.players['0'].deck.map(card => card.uid)).toEqual(['tail-card']);
    });

    it('工具与人才检查牌库并把牌库底牌移到牌库顶', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top-card', 'teens_babysitter', 'action', '0'),
                        makeCard('middle-card', 'wraithrustlers_resurgence', 'action', '0'),
                        makeCard('bottom-card', 'wraithrustlers_librarian_haunt', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('wraithrustlers_the_tools_and_the_talent', 'onPlay',
            makeAbilityContext(core, 'wraithrustlers_the_tools_and_the_talent', 'tools'));
        const after = applyEvents(core, result.events);

        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.DECK_INSPECTED,
            payload: expect.objectContaining({ count: 3 }),
        }));
        expect(after.players['0'].deck.map(card => card.uid)).toEqual(['bottom-card', 'top-card', 'middle-card']);
    });
});
