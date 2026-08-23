import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { getEffectivePower, getOngoingPowerModifierDetails } from '../../domain/ongoingModifiers';
import { isMinionProtected } from '../../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { processReturnToHandTriggers } from '../../domain/reducer';
import { collectBaseAbilityTriggers } from '../../domain/baseAbilityQueue';
import { fireTriggers } from '../../domain/ongoingEffects';
import { startSmashUpReactionSession } from '../../domain/reactionSession';
import { createScoringBaseRef, createScoringSession, setScoringSession } from '../../domain/scoringSession';
import { SU_EVENTS } from '../../domain/types';
import { getAllCardDefs } from '../../data/cards';
import { CEASE_AND_DESIST_CARDS, CEASE_AND_DESIST_BASES } from '../../data/factions/cease_and_desist';
import { TITAN_CARD_DEFS } from '../../data/titans';
import {
    applyEvents,
    expectRegisteredAbilityContract,
    findInteractionOption,
    getPromptHandlerData,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
    respondToPromptOptions,
    triggerBaseAbilityWithMS,
} from '../helpers';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

function attachAfterScoringSession(core: ReturnType<typeof makeState>, baseIndex: number) {
    let state = makeMatchState(core);
    const baseRef = createScoringBaseRef(core, baseIndex);
    if (!baseRef) {
        throw new Error('无法构造 Port Me Up afterScoring 测试用计分基地');
    }
    state = setScoringSession(state, {
        ...createScoringSession(core, [baseIndex]),
        lockedBaseRefs: [baseRef],
        currentBaseRef: baseRef,
        currentStep: 'awaiting-response-window',
    });
    return startSmashUpReactionSession(state, {
        frameId: `score-after:${baseIndex}:port-me-up-test`,
        frameKind: 'score-after',
        phase: 'optional',
        activePlayerId: '0',
        currentPlayerId: '0',
        consecutivePasses: 0,
        responseWindowType: 'afterScoring',
    });
}

const CEASE_AND_DESIST_OBJECT_TEST_MATRIX = [
    { id: 'astroknights_block_the_probe', tag: 'onPlay' },
    { id: 'astroknights_hidden_base', tag: 'ongoing' },
    { id: 'astroknights_recycle_the_trash', tag: 'onPlay' },
    { id: 'astroknights_yield_to_rage', tag: 'onPlay' },
    { id: 'astroknights_laser_sword', tag: 'ongoing' },
    { id: 'astroknights_prepare_for_battle', tag: 'onPlay' },
    { id: 'astroknights_use_the_fours', tag: 'onPlay' },
    { id: 'astroknights_its_a_trap', tag: 'special' },
    { id: 'astroknights_annoying_alien', tag: 'talent' },
    { id: 'astroknights_pupoks', tag: 'talent' },
    { id: 'astroknights_alien_guru', tag: 'onActionPlayed' },
    { id: 'astroknights_walking_carpet', tag: 'special' },
    { id: 'astroknights_scoundrel', tag: 'talent' },
    { id: 'astroknights_ghost_knight', tag: 'ongoing' },
    { id: 'astroknights_mannersbot', tag: 'talent' },
    { id: 'astroknights_space_prince', tag: 'talent' },
    { id: 'astroknights_space_knight', tag: 'talent' },
    { id: 'astroknights_astro_robot', tag: 'onPlay' },
    { id: 'ignobles_repaying_debts', tag: 'onPlay' },
    { id: 'ignobles_fate_of_the_favorites', tag: 'onPlay' },
    { id: 'ignobles_red_birthday_party', tag: 'onPlay' },
    { id: 'ignobles_hostage_exchange', tag: 'onPlay' },
    { id: 'ignobles_inevitable_betrayal', tag: 'special' },
    { id: 'ignobles_activate_the_spy', tag: 'onPlay' },
    { id: 'ignobles_out_of_sight', tag: 'onPlay' },
    { id: 'ignobles_banner_call', tag: 'onPlay' },
    { id: 'ignobles_sneaky_squire', tag: 'onPlay' },
    { id: 'ignobles_betrothed', tag: 'onPlay' },
    { id: 'ignobles_foot_of_the_king', tag: 'onTurnEnd' },
    { id: 'ignobles_aunt_of_drakes', tag: 'talent' },
    { id: 'star_roamers_weird_new_worlds', tag: 'onPlay' },
    { id: 'star_roamers_whiplash_maneuver', tag: 'ongoing' },
    { id: 'star_roamers_protector_fields', tag: 'ongoing' },
    { id: 'star_roamers_teleport_overflow', tag: 'onPlay' },
    { id: 'star_roamers_teleport_error', tag: 'onPlay' },
    { id: 'star_roamers_hyperspeed_10', tag: 'onPlay' },
    { id: 'star_roamers_port_me_up', tag: 'onPlay' },
    { id: 'star_roamers_mass_teleport', tag: 'onPlay' },
    { id: 'star_roamers_ships_engineer', tag: 'onCardReturnedToHand' },
    { id: 'star_roamers_medical_officer', tag: 'onCardReturnedToHand' },
    { id: 'star_roamers_science_officer', tag: 'talent' },
    { id: 'star_roamers_ensign', tag: 'ongoing' },
    { id: 'star_roamers_ships_captain', tag: 'onPlay' },
    { id: 'changerbots_matrix_of_bossiness', tag: 'ongoing' },
    { id: 'changerbots_change_into_a_gun', tag: 'onPlay' },
    { id: 'changerbots_passengers', tag: 'talent' },
    { id: 'changerbots_the_touch', tag: 'talent' },
    { id: 'changerbots_flighterizer', tag: 'talent' },
    { id: 'changerbots_change_up_and_roll_on', tag: 'special' },
    { id: 'changerbots_cesium_armor', tag: 'ongoing' },
    { id: 'changerbots_form_mergacon', tag: 'onPlay' },
    { id: 'changerbots_leader_two', tag: 'talent' },
    { id: 'changerbots_solarshout', tag: 'talent' },
    { id: 'changerbots_huffie', tag: 'talent' },
    { id: 'changerbots_bruiser', tag: 'talent' },
] as const;

const CEASE_AND_DESIST_TITAN_TEST_MATRIX = [
    'changerbots_mergacon',
    'ignobles_the_hill_that_strolls',
] as const;

describe('Cease and Desist 四派系代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('静态牌组合同保持 55 张唯一卡面、80 张实体牌和 8 张基地', () => {
        expect(CEASE_AND_DESIST_CARDS).toHaveLength(55);
        expect(CEASE_AND_DESIST_CARDS.reduce((total, card) => total + card.count, 0)).toBe(80);
        expect(CEASE_AND_DESIST_CARDS.map(card => card.previewRef?.index).sort((a, b) => Number(a) - Number(b))).toEqual(
            Array.from({ length: 55 }, (_, index) => index),
        );
        expect(CEASE_AND_DESIST_CARDS.some(card => card.previewRef?.index === 55)).toBe(false);
        expect(getAllCardDefs().some(card => card.previewRef?.atlasId === CEASE_AND_DESIST_CARDS[0].previewRef?.atlasId
            && card.previewRef?.index === 55)).toBe(false);
        expect(CEASE_AND_DESIST_BASES).toHaveLength(8);
    });

    it('四派系核心能力入口已注册', () => {
        const registrations = [
            ['astroknights_block_the_probe', 'onPlay'],
            ['astroknights_block_the_probe', 'special'],
            ['ignobles_repaying_debts', 'onPlay'],
            ['ignobles_inevitable_betrayal', 'special'],
            ['star_roamers_mass_teleport', 'onPlay'],
            ['star_roamers_port_me_up', 'special'],
            ['changerbots_form_mergacon', 'onPlay'],
            ['changerbots_change_up_and_roll_on', 'special'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }
    });

    it('四派系 55 张卡和 2 个复用泰坦都有对象级能力合同入口', () => {
        const cardIds = new Set(CEASE_AND_DESIST_CARDS.map(card => card.id));
        expect(CEASE_AND_DESIST_OBJECT_TEST_MATRIX.map(entry => entry.id).sort()).toEqual([...cardIds].sort());

        for (const { id, tag } of CEASE_AND_DESIST_OBJECT_TEST_MATRIX) {
            if (['ongoing', 'onTurnEnd', 'onActionPlayed', 'onCardReturnedToHand'].includes(tag)) {
                expect(CEASE_AND_DESIST_CARDS.some(card => card.id === id), `${id} static definition`).toBe(true);
                continue;
            }
            expect(expectRegisteredAbilityContract(id, tag), `${id}::${tag}`).toBeTypeOf('function');
        }

        const titanIds = new Set(TITAN_CARD_DEFS.map(titan => titan.id));
        for (const titanId of CEASE_AND_DESIST_TITAN_TEST_MATRIX) {
            expect(titanIds.has(titanId), `${titanId} titan definition`).toBe(true);
        }
    });

    it('宇宙武士的阻止探解选择任意随从并给 +2 临时力量', () => {
        const core = makeState({
            bases: [makeBase('base_no_moon', [
                makeMinion('ally', 'astroknights_mannersbot', '0', 2),
                makeMinion('enemy', 'ignobles_sneaky_squire', '1', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('astroknights_block_the_probe', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'block',
            defId: 'astroknights_block_the_probe',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const selected = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'enemy',
            'choose enemy for Block the Probe',
            '0',
            FIXED_RANDOM,
        );

        expect(getEffectivePower(selected.finalState.core, selected.finalState.core.bases[0].minions[1], 0)).toBe(4);
    });

    it('宇宙武士的回收垃圾按玩家选择洗回至多两张行动，单候选也不自动结算', () => {
        const singleActionCore = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-single', 'astroknights_mannersbot', 'minion', '0')],
                    discard: [makeCard('only-action', 'astroknights_block_the_probe', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const singleActionResult = invokeRegisteredAbilityContract('astroknights_recycle_the_trash', 'onPlay', {
            state: singleActionCore,
            matchState: makeMatchState(singleActionCore),
            playerId: '0',
            cardUid: 'recycle-single',
            defId: 'astroknights_recycle_the_trash',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 12,
        });

        expect(singleActionResult.events).toEqual([]);
        const singlePrompt = getSimpleChoicePrompt(singleActionResult.matchState!, 'astroknights_recycle_the_trash');
        expect(singlePrompt.options.map(option => option.value?.cardUid)).toEqual(['only-action']);
        expect(getPromptHandlerData(singlePrompt).autoResolveIfSingle).toBe(false);
        expect(getPromptHandlerData(singlePrompt).multi).toEqual({ min: 0, max: 1 });

        const chooseTwoCore = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-keep', 'astroknights_mannersbot', 'minion', '0')],
                    discard: [
                        makeCard('action-a', 'astroknights_block_the_probe', 'action', '0'),
                        makeCard('discard-minion', 'ignobles_sneaky_squire', 'minion', '0'),
                        makeCard('action-b', 'astroknights_use_the_fours', 'action', '0'),
                        makeCard('action-c', 'ignobles_repaying_debts', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const chooseTwoResult = invokeRegisteredAbilityContract('astroknights_recycle_the_trash', 'onPlay', {
            state: chooseTwoCore,
            matchState: makeMatchState(chooseTwoCore),
            playerId: '0',
            cardUid: 'recycle',
            defId: 'astroknights_recycle_the_trash',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 13,
        });

        expect(chooseTwoResult.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(chooseTwoResult.matchState!, 'astroknights_recycle_the_trash');
        expect(prompt.options.map(option => option.value?.cardUid)).toEqual(['action-a', 'action-b', 'action-c']);
        expect(getPromptHandlerData(prompt).genericIntent).toBe('card-pool');
        expect(getPromptHandlerData(prompt).multi).toEqual({ min: 0, max: 2 });
        expect(getPromptHandlerData(prompt).autoResolveIfSingle).toBe(false);

        const selectedOptionIds = prompt.options
            .filter(option => ['action-b', 'action-c'].includes(option.value?.cardUid))
            .map(option => option.id);
        const resolved = respondToPromptOptions(chooseTwoResult.matchState!, selectedOptionIds, '0', FIXED_RANDOM);

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-keep', 'action-b', 'action-c']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['action-a', 'discard-minion']);

        const noInteractionResult = invokeRegisteredAbilityContract('astroknights_recycle_the_trash', 'onPlay', {
            state: chooseTwoCore,
            matchState: undefined,
            playerId: '0',
            cardUid: 'recycle',
            defId: 'astroknights_recycle_the_trash',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 14,
        });
        expect(noInteractionResult.events).toEqual([]);
    });

    it('宇宙武士的恶棍天赋会选择另一己方随从和目标基地', () => {
        const core = makeState({
            bases: [
                makeBase('base_no_moon', [
                    makeMinion('scoundrel', 'astroknights_scoundrel', '0', 4),
                    makeMinion('chosen-ally', 'astroknights_mannersbot', '0', 2),
                    makeMinion('other-ally', 'astroknights_annoying_alien', '0', 2),
                    makeMinion('enemy', 'ignobles_sneaky_squire', '1', 2),
                ]),
                makeBase('base_uss_undertaking'),
                makeBase('base_neutral_space'),
            ],
        });

        const result = invokeRegisteredAbilityContract('astroknights_scoundrel', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'scoundrel',
            defId: 'astroknights_scoundrel',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 15,
        });

        expect(result.events).toEqual([]);
        const minionPrompt = getSimpleChoicePrompt(result.matchState!, 'astroknights_scoundrel_choose_minion');
        expect(findInteractionOption(minionPrompt, option => option.value?.minionUid === 'scoundrel')).toBeUndefined();
        expect(findInteractionOption(minionPrompt, option => option.value?.minionUid === 'chosen-ally')).toBeDefined();
        expect(findInteractionOption(minionPrompt, option => option.value?.minionUid === 'other-ally')).toBeDefined();
        expect(findInteractionOption(minionPrompt, option => option.value?.minionUid === 'enemy')).toBeUndefined();

        const choseMinion = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'chosen-ally',
            'choose Scoundrel companion',
            '0',
            FIXED_RANDOM,
        );
        expect(choseMinion.success).toBe(true);

        const basePrompt = getSimpleChoicePrompt(choseMinion.finalState, 'astroknights_scoundrel_choose_base');
        expect(findInteractionOption(basePrompt, option => option.value?.baseIndex === 0)).toBeUndefined();
        expect(findInteractionOption(basePrompt, option => option.value?.baseIndex === 1)).toBeDefined();
        expect(findInteractionOption(basePrompt, option => option.value?.baseIndex === 2)).toBeDefined();

        const moved = respondToPromptOption(
            choseMinion.finalState,
            option => option.value?.baseIndex === 2,
            'choose Scoundrel destination base',
            '0',
            FIXED_RANDOM,
        );

        expect(moved.success).toBe(true);
        expect(moved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['other-ally', 'enemy']);
        expect(moved.finalState.core.bases[2].minions.map(minion => minion.uid)).toEqual(['scoundrel', 'chosen-ally']);
        expect(
            moved.events
                .filter(event => event.type === SU_EVENTS.MINION_MOVED)
                .map(event => (event as any).payload.minionUid),
        ).toEqual(['scoundrel', 'chosen-ally']);
    });

    it('卑劣封臣的有债必还交出控制权后抽 2 并获得额外随从额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'ignobles_activate_the_spy', 'action', '0'),
                        makeCard('draw-2', 'ignobles_sneaky_squire', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_spikey_chair_room', [
                makeMinion('squire', 'ignobles_sneaky_squire', '0', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('ignobles_repaying_debts', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'debts',
            defId: 'ignobles_repaying_debts',
            baseIndex: 0,
            targetMinionUid: 'squire',
            random: FIXED_RANDOM,
            now: 20,
        });
        const selected = respondToPromptOption(
            result.matchState!,
            option => option.value?.playerId === '1',
            'give control to player 1',
            '0',
            FIXED_RANDOM,
        );

        expect(selected.finalState.core.bases[0].minions[0].controller).toBe('1');
        expect(selected.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2']);
        expect(selected.events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(true);
    });

    it('红色生日聚会选择拥有的随从，不自动消灭第一个拥有随从', () => {
        const core = makeState({
            bases: [
                makeBase('base_spikey_chair_room', [
                    makeMinion('first-owned', 'ignobles_sneaky_squire', '0', 5, { owner: '0' }),
                    makeMinion('first-low', 'star_roamers_ensign', '1', 2, { owner: '1' }),
                ]),
                makeBase('base_uss_undertaking', [
                    makeMinion('chosen-owned', 'astroknights_mannersbot', '0', 3, { owner: '0' }),
                    makeMinion('chosen-low', 'star_roamers_ensign', '1', 2, { owner: '1' }),
                ]),
            ],
        });

        const result = invokeRegisteredAbilityContract('ignobles_red_birthday_party', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'party',
            defId: 'ignobles_red_birthday_party',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 24,
        });

        expect(result.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'ignobles_red_birthday_party');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(findInteractionOption(prompt, option => option.value?.minionUid === 'first-owned')).toBeDefined();
        expect(findInteractionOption(prompt, option => option.value?.minionUid === 'chosen-owned')).toBeDefined();

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'chosen-owned',
            'choose second owned minion for Red Birthday Party',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['first-owned', 'first-low']);
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual([]);
    });

    it('无交互状态下不会替玩家自动选择第一个 Ignobles / Star Roamers 目标', () => {
        const core = makeState({
            bases: [
                makeBase('base_spikey_chair_room', [
                    makeMinion('foot', 'ignobles_foot_of_the_king', '0', 4),
                    makeMinion('owner0-first', 'ignobles_sneaky_squire', '0', 2, { owner: '0' }),
                    makeMinion('owner0-stolen', 'astroknights_mannersbot', '1', 2, { owner: '0' }),
                    makeMinion('owner1-only', 'star_roamers_ensign', '1', 2, { owner: '1' }),
                ]),
                makeBase('base_uss_undertaking', [
                    makeMinion('science', 'star_roamers_science_officer', '0', 4),
                    makeMinion('star-chosen', 'star_roamers_ensign', '0', 2),
                ]),
            ],
        });

        const baseContext = {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'source',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 241,
        };

        expect(invokeRegisteredAbilityContract('ignobles_fate_of_the_favorites', 'onPlay', {
            ...baseContext,
            defId: 'ignobles_fate_of_the_favorites',
        }).events).toEqual([]);
        expect(invokeRegisteredAbilityContract('ignobles_out_of_sight', 'onPlay', {
            ...baseContext,
            defId: 'ignobles_out_of_sight',
        }).events).toEqual([]);
        expect(invokeRegisteredAbilityContract('star_roamers_mass_teleport', 'onPlay', {
            ...baseContext,
            defId: 'star_roamers_mass_teleport',
        }).events).toEqual([]);
        expect(invokeRegisteredAbilityContract('ignobles_red_birthday_party', 'onPlay', {
            ...baseContext,
            defId: 'ignobles_red_birthday_party',
        }).events).toEqual([]);
        expect(invokeRegisteredAbilityContract('changerbots_change_into_a_gun', 'onPlay', {
            ...baseContext,
            defId: 'changerbots_change_into_a_gun',
            targetMinionUid: 'owner0-first',
        }).events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: expect.objectContaining({ minionUid: 'owner0-first', amount: -2 }),
            }),
        ]);
        expect(invokeRegisteredAbilityContract('ignobles_activate_the_spy', 'onPlay', {
            ...baseContext,
            defId: 'ignobles_activate_the_spy',
        }).events).toEqual([]);
        expect(invokeRegisteredAbilityContract('ignobles_inevitable_betrayal', 'special', {
            ...baseContext,
            defId: 'ignobles_inevitable_betrayal',
        }).events).toEqual([]);
        expect(invokeRegisteredAbilityContract('star_roamers_science_officer', 'talent', {
            ...baseContext,
            cardUid: 'science',
            defId: 'star_roamers_science_officer',
            baseIndex: 1,
        }).events).toEqual([]);
        expect(fireTriggers(core, 'onTurnEnd', {
            state: core,
            playerId: '0',
            random: FIXED_RANDOM,
            now: 242,
        }).events).toEqual([]);
    });

    it('科学指挥官天赋选择返回的己方随从，不自动返回第一个候选', () => {
        const core = makeState({
            bases: [
                makeBase('base_uss_undertaking', [
                    makeMinion('science', 'star_roamers_science_officer', '0', 4),
                    makeMinion('first-own', 'star_roamers_ensign', '0', 2),
                ]),
                makeBase('base_spikey_chair_room', [
                    makeMinion('chosen-own', 'astroknights_mannersbot', '0', 2),
                ]),
            ],
        });

        const result = invokeRegisteredAbilityContract('star_roamers_science_officer', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'science',
            defId: 'star_roamers_science_officer',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 25,
        });

        expect(result.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'star_roamers_science_officer');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(findInteractionOption(prompt, option => option.value?.minionUid === 'first-own')).toBeDefined();
        expect(findInteractionOption(prompt, option => option.value?.minionUid === 'chosen-own')).toBeDefined();

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'chosen-own',
            'choose second Science Officer return target',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_RETURNED,
                payload: expect.objectContaining({ minionUid: 'chosen-own', reason: 'star_roamers_science_officer' }),
            }),
            expect.objectContaining({ type: SU_EVENTS.LIMIT_MODIFIED }),
        ]));
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['science', 'first-own']);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('chosen-own');
    });

    it('重组形态选择同基地力量 4 或以下随从消灭，不自动消灭第一个', () => {
        const core = makeState({
            bases: [makeBase('base_uss_undertaking', [
                makeMinion('host', 'changerbots_huffie', '0', 3),
                makeMinion('first-victim', 'star_roamers_ensign', '1', 2),
                makeMinion('chosen-victim', 'astroknights_mannersbot', '1', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('changerbots_change_into_a_gun', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'gun',
            defId: 'changerbots_change_into_a_gun',
            baseIndex: 0,
            targetMinionUid: 'host',
            random: FIXED_RANDOM,
            now: 26,
        });

        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: expect.objectContaining({ minionUid: 'host', amount: -2 }),
        }));
        expect(result.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'changerbots_change_into_a_gun');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(findInteractionOption(prompt, option => option.value?.minionUid === 'first-victim')).toBeDefined();
        expect(findInteractionOption(prompt, option => option.value?.minionUid === 'chosen-victim')).toBeDefined();

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'chosen-victim',
            'choose second Change Into A Gun victim',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({ minionUid: 'chosen-victim', reason: 'changerbots_change_into_a_gun' }),
        }));
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['host', 'first-victim']);
    });

    it('星际旅者的传送超额选择返回的己方随从，不自动返回第一个候选', () => {
        const core = makeState({
            bases: [makeBase('base_uss_undertaking', [
                makeMinion('first-own', 'star_roamers_science_officer', '0', 4),
                makeMinion('chosen-own', 'star_roamers_ensign', '0', 2),
                makeMinion('enemy', 'ignobles_sneaky_squire', '1', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('star_roamers_teleport_overflow', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'overflow',
            defId: 'star_roamers_teleport_overflow',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 27,
        });

        expect(result.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'star_roamers_teleport_overflow');
        expect(getPromptHandlerData(prompt).autoResolveIfSingle).toBe(false);
        expect(findInteractionOption(prompt, option => option.value?.minionUid === 'first-own')).toBeDefined();
        expect(findInteractionOption(prompt, option => option.value?.minionUid === 'chosen-own')).toBeDefined();
        expect(findInteractionOption(prompt, option => option.value?.minionUid === 'enemy')).toBeUndefined();

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'chosen-own',
            'choose second Teleport Overflow return target',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_RETURNED,
                payload: expect.objectContaining({ minionUid: 'chosen-own', reason: 'star_roamers_teleport_overflow' }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({ reason: 'star_roamers_teleport_overflow', limitType: 'minion' }),
            }),
        ]));
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['first-own', 'enemy']);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('chosen-own');
    });

    it('星际旅者的传送我上船在计分后只允许选择计分基地上的己方随从', () => {
        const core = makeState({
            bases: [
                makeBase('base_uss_undertaking', [
                    makeMinion('scoring-first', 'star_roamers_science_officer', '0', 4),
                    makeMinion('scoring-chosen', 'star_roamers_ensign', '0', 2),
                    makeMinion('scoring-enemy', 'ignobles_sneaky_squire', '1', 2),
                ]),
                makeBase('base_spikey_chair_room', [
                    makeMinion('other-base-own', 'astroknights_mannersbot', '0', 2),
                ]),
            ],
        });
        const matchState = attachAfterScoringSession(core, 0);

        const result = invokeRegisteredAbilityContract('star_roamers_port_me_up', 'special', {
            state: core,
            matchState,
            playerId: '0',
            cardUid: 'port',
            defId: 'star_roamers_port_me_up',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 28,
        });

        expect(result.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'star_roamers_port_me_up');
        expect(getPromptHandlerData(prompt).autoResolveIfSingle).toBe(false);
        expect(findInteractionOption(prompt, option => option.value?.minionUid === 'scoring-first')).toBeDefined();
        expect(findInteractionOption(prompt, option => option.value?.minionUid === 'scoring-chosen')).toBeDefined();
        expect(findInteractionOption(prompt, option => option.value?.minionUid === 'scoring-enemy')).toBeUndefined();
        expect(findInteractionOption(prompt, option => option.value?.minionUid === 'other-base-own')).toBeUndefined();

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'scoring-chosen',
            'choose scoring base Port Me Up return target',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_RETURNED,
            payload: expect.objectContaining({ minionUid: 'scoring-chosen', reason: 'star_roamers_port_me_up' }),
        }));
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['scoring-first', 'scoring-enemy']);
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['other-base-own']);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('scoring-chosen');
    });

    it('星际旅者的大规模传送让每名玩家选择自己控制的随从，单候选也不自动结算', () => {
        const core = makeState({
            bases: [makeBase('base_uss_undertaking', [
                makeMinion('player0-first', 'star_roamers_science_officer', '0', 4),
                makeMinion('player0-chosen', 'star_roamers_ensign', '0', 2),
                makeMinion('player1-only', 'ignobles_sneaky_squire', '1', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('star_roamers_mass_teleport', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'mass',
            defId: 'star_roamers_mass_teleport',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 30,
        });

        expect(result.events).toEqual([]);
        const player0Prompt = getSimpleChoicePrompt(result.matchState!, 'star_roamers_mass_teleport');
        expect(player0Prompt.playerId).toBe('0');
        expect(getPromptHandlerData(player0Prompt).autoResolveIfSingle).toBe(false);
        expect(findInteractionOption(player0Prompt, option => option.value?.minionUid === 'player0-first')).toBeDefined();
        expect(findInteractionOption(player0Prompt, option => option.value?.minionUid === 'player0-chosen')).toBeDefined();
        expect(findInteractionOption(player0Prompt, option => option.value?.minionUid === 'player1-only')).toBeUndefined();

        const player0ChoseSecond = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'player0-chosen',
            'choose second player 0 minion for Mass Teleport',
            '0',
            FIXED_RANDOM,
        );
        expect(player0ChoseSecond.success).toBe(true);
        expect(player0ChoseSecond.finalState.core.players['0'].hand.map(card => card.uid)).toContain('player0-chosen');

        const player1Prompt = getSimpleChoicePrompt(player0ChoseSecond.finalState, 'star_roamers_mass_teleport');
        expect(player1Prompt.playerId).toBe('1');
        expect(getPromptHandlerData(player1Prompt).autoResolveIfSingle).toBe(false);
        expect(player1Prompt.options).toHaveLength(1);

        const player1ChoseOnly = respondToPromptOption(
            player0ChoseSecond.finalState,
            option => option.value?.minionUid === 'player1-only',
            'confirm only player 1 minion for Mass Teleport',
            '1',
            FIXED_RANDOM,
        );
        expect(player1ChoseOnly.success).toBe(true);
        expect(player1ChoseOnly.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['player0-first']);
        expect(player1ChoseOnly.finalState.core.players['1'].hand.map(card => card.uid)).toContain('player1-only');
    });

    it('卑劣封臣的宠儿的命运让每位玩家选择自己拥有的随从，单候选也不自动结算', () => {
        const core = makeState({
            bases: [
                makeBase('base_spikey_chair_room', [
                    makeMinion('owner0-a', 'ignobles_sneaky_squire', '0', 2, { owner: '0' }),
                    makeMinion('owner0-b', 'astroknights_mannersbot', '0', 2, { owner: '0' }),
                    makeMinion('owner1-only', 'star_roamers_ensign', '1', 2, { owner: '1' }),
                ]),
            ],
        });

        const result = invokeRegisteredAbilityContract('ignobles_fate_of_the_favorites', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'fate',
            defId: 'ignobles_fate_of_the_favorites',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 31,
        });

        expect(result.events).toEqual([]);
        const player0Prompt = getSimpleChoicePrompt(result.matchState!, 'ignobles_fate_of_the_favorites');
        expect(player0Prompt.playerId).toBe('0');
        expect(findInteractionOption(player0Prompt, option => option.value?.minionUid === 'owner0-a')).toBeDefined();
        expect(findInteractionOption(player0Prompt, option => option.value?.minionUid === 'owner0-b')).toBeDefined();
        expect(findInteractionOption(player0Prompt, option => option.value?.minionUid === 'owner1-only')).toBeUndefined();

        const player0ChoseSecond = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'owner0-b',
            'choose second owned minion for Fate of the Favorites',
            '0',
            FIXED_RANDOM,
        );
        expect(player0ChoseSecond.success).toBe(true);
        expect(player0ChoseSecond.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['owner0-a', 'owner1-only']);

        const player1Prompt = getSimpleChoicePrompt(player0ChoseSecond.finalState, 'ignobles_fate_of_the_favorites');
        expect(player1Prompt.playerId).toBe('1');
        expect(getSimpleChoicePrompt(player0ChoseSecond.finalState, 'ignobles_fate_of_the_favorites').options).toHaveLength(1);
        const player1ChoseOnly = respondToPromptOption(
            player0ChoseSecond.finalState,
            option => option.value?.minionUid === 'owner1-only',
            'confirm only player 1 owned minion for Fate of the Favorites',
            '1',
            FIXED_RANDOM,
        );
        expect(player1ChoseOnly.success).toBe(true);
        expect(player1ChoseOnly.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['owner0-a']);
    });

    it('卑劣封臣的视线之外让每位玩家选择自己拥有的随从回手，单候选也要确认', () => {
        const core = makeState({
            bases: [
                makeBase('base_spikey_chair_room', [
                    makeMinion('return0-a', 'ignobles_sneaky_squire', '0', 2, { owner: '0' }),
                    makeMinion('return0-b', 'astroknights_mannersbot', '0', 2, { owner: '0' }),
                    makeMinion('return1-only', 'star_roamers_ensign', '1', 2, { owner: '1' }),
                ]),
            ],
        });

        const result = invokeRegisteredAbilityContract('ignobles_out_of_sight', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'out',
            defId: 'ignobles_out_of_sight',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 32,
        });

        expect(result.events).toEqual([]);
        const player0Prompt = getSimpleChoicePrompt(result.matchState!, 'ignobles_out_of_sight');
        expect(player0Prompt.playerId).toBe('0');
        expect(findInteractionOption(player0Prompt, option => option.value?.minionUid === 'return0-a')).toBeDefined();
        expect(findInteractionOption(player0Prompt, option => option.value?.minionUid === 'return0-b')).toBeDefined();
        expect(findInteractionOption(player0Prompt, option => option.value?.minionUid === 'return1-only')).toBeUndefined();

        const player0ChoseSecond = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'return0-b',
            'choose second owned minion for Out of Sight',
            '0',
            FIXED_RANDOM,
        );
        expect(player0ChoseSecond.success).toBe(true);
        expect(player0ChoseSecond.finalState.core.players['0'].hand.map(card => card.uid)).toContain('return0-b');

        const player1Prompt = getSimpleChoicePrompt(player0ChoseSecond.finalState, 'ignobles_out_of_sight');
        expect(player1Prompt.playerId).toBe('1');
        expect(player1Prompt.options).toHaveLength(1);
        const player1ChoseOnly = respondToPromptOption(
            player0ChoseSecond.finalState,
            option => option.value?.minionUid === 'return1-only',
            'confirm only player 1 owned minion for Out of Sight',
            '1',
            FIXED_RANDOM,
        );
        expect(player1ChoseOnly.success).toBe(true);
        expect(player1ChoseOnly.finalState.core.players['1'].hand.map(card => card.uid)).toContain('return1-only');
        expect(player1ChoseOnly.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['return0-a']);
    });

    it('星际旅者的奇异新世界从基地牌库增加新基地并给予该基地额外随从额度', () => {
        const core = makeState({
            bases: [makeBase('base_uss_undertaking')],
            baseDeck: ['base_neutral_space'],
        });

        const result = invokeRegisteredAbilityContract('star_roamers_weird_new_worlds', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'worlds',
            defId: 'star_roamers_weird_new_worlds',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 40,
        });
        const after = applyEvents(core, result.events);

        expect(after.bases.map(base => base.defId)).toEqual(['base_uss_undertaking', 'base_neutral_space']);
        expect(after.baseDeck).toEqual([]);
        expect(result.events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(true);
    });

    it('星际旅者的舰长搜索牌库时必须选择随从，不自动抽第一张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top-action', 'astroknights_block_the_probe', 'action', '0'),
                        makeCard('science-1', 'star_roamers_science_officer', 'minion', '0'),
                        makeCard('ensign-1', 'star_roamers_ensign', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_uss_undertaking')],
        });

        const result = invokeRegisteredAbilityContract('star_roamers_ships_captain', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'captain-1',
            defId: 'star_roamers_ships_captain',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 45,
        });

        expect(result.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'star_roamers_ships_captain');
        expect(getPromptHandlerData(prompt).autoResolveIfSingle).toBe(false);
        expect(getPromptHandlerData(prompt).genericIntent).toBe('card-pool');
        expect(prompt.options.map(option => option.value?.cardUid)).toEqual(['science-1', 'ensign-1']);

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'ensign-1',
            'choose second minion for Ship\'s Captain',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ cardUids: ['ensign-1'] }),
        }));
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                playerId: '0',
                limitType: 'minion',
                powerMax: 3,
            }),
        }));
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('ensign-1');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['top-action', 'science-1']);
    });

    it('百变机兵的合体形态给目标基地己方随从各 +1', () => {
        const core = makeState({
            bases: [makeBase('base_changing_room', [
                makeMinion('huffie', 'changerbots_huffie', '0', 3),
                makeMinion('bruiser', 'changerbots_bruiser', '0', 2),
                makeMinion('enemy', 'star_roamers_ensign', '1', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('changerbots_form_mergacon', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'form',
            defId: 'changerbots_form_mergacon',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: FIXED_RANDOM,
            now: 50,
        });
        const after = applyEvents(core, result.events);

        expect(getEffectivePower(after, after.bases[0].minions[0], 0)).toBe(4);
        expect(getEffectivePower(after, after.bases[0].minions[1], 0)).toBe(3);
        expect(getEffectivePower(after, after.bases[0].minions[2], 0)).toBe(2);
    });

    it('宇宙武士的持续牌与被动件能被力量和保护消费点读取', () => {
        const core = makeState({
            bases: [makeBase('base_no_moon', [
                makeMinion('laser-host', 'astroknights_mannersbot', '0', 2, {
                    attachedActions: [{ uid: 'laser', defId: 'astroknights_laser_sword', ownerId: '0' }],
                }),
                makeMinion('ghost-a', 'astroknights_ghost_knight', '0', 0),
                makeMinion('ghost-b', 'astroknights_ghost_knight', '0', 0),
            ])],
        });

        expect(getOngoingPowerModifierDetails(core, core.bases[0].minions[0], 0)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ sourceDefId: 'astroknights_laser_sword', value: 2 }),
                expect.objectContaining({ sourceDefId: 'astroknights_ghost_knight', value: 2 }),
            ]),
        );
        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(6);
        expect(isMinionProtected(core, core.bases[0].minions[0], 0, '1', 'affect', { sourceKind: 'nonAction' })).toBe(true);
        expect(isMinionProtected(core, core.bases[0].minions[0], 0, '1', 'affect', { sourceKind: 'action' })).toBe(false);
        expect(getEffectivePower(core, core.bases[0].minions[1], 0)).toBe(2);
        expect(isMinionProtected(core, core.bases[0].minions[1], 0, '1', 'destroy')).toBe(true);

        const laserOnlyCore = makeState({
            bases: [makeBase('base_no_moon', [
                makeMinion('laser-only-host', 'astroknights_mannersbot', '0', 2, {
                    attachedActions: [{ uid: 'laser-only', defId: 'astroknights_laser_sword', ownerId: '0' }],
                }),
            ])],
        });
        expect(getOngoingPowerModifierDetails(laserOnlyCore, laserOnlyCore.bases[0].minions[0], 0)).toEqual([
            expect.objectContaining({ sourceDefId: 'astroknights_laser_sword', value: 2 }),
        ]);
        expect(getEffectivePower(laserOnlyCore, laserOnlyCore.bases[0].minions[0], 0)).toBe(4);

        const laserPodOnlyCore = makeState({
            bases: [makeBase('base_no_moon', [
                makeMinion('laser-pod-only-host', 'astroknights_mannersbot', '0', 2, {
                    attachedActions: [{ uid: 'laser-pod-only', defId: 'astroknights_laser_sword_pod', ownerId: '0' }],
                }),
            ])],
        });
        expect(getOngoingPowerModifierDetails(laserPodOnlyCore, laserPodOnlyCore.bases[0].minions[0], 0)).toEqual([
            expect.objectContaining({ sourceDefId: 'astroknights_laser_sword', value: 2 }),
        ]);
        expect(getEffectivePower(laserPodOnlyCore, laserPodOnlyCore.bases[0].minions[0], 0)).toBe(4);
    });

    it('星际旅者的防御力场保护同基地己方随从免受其他玩家行动牌影响', () => {
        const core = makeState({
            bases: [makeBase({
                defId: 'base_uss_undertaking',
                ongoingActions: [{ uid: 'fields', defId: 'star_roamers_protector_fields', ownerId: '0' }],
                minions: [
                    makeMinion('protected', 'star_roamers_science_officer', '0', 4),
                    makeMinion('enemy', 'ignobles_sneaky_squire', '1', 2),
                ],
            })],
        });

        expect(isMinionProtected(core, core.bases[0].minions[0], 0, '1', 'action')).toBe(true);
        expect(isMinionProtected(core, core.bases[0].minions[0], 0, '0', 'action')).toBe(false);
        expect(isMinionProtected(core, core.bases[0].minions[1], 0, '0', 'action')).toBe(false);
    });

    it('星际旅者的医疗指挥官在己方随从回手后抽 1 张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-med', 'star_roamers_ensign', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_uss_undertaking', [
                makeMinion('medical', 'star_roamers_medical_officer', '0', 4),
                makeMinion('returned', 'star_roamers_ensign', '0', 2),
            ])],
        });

        const returned = {
            type: SU_EVENTS.MINION_RETURNED,
            payload: {
                minionUid: 'returned',
                minionDefId: 'star_roamers_ensign',
                fromBaseIndex: 0,
                toPlayerId: '0',
                reason: 'test_return',
                sourcePlayerId: '0',
                sourceControllerId: '0',
                sourceDefId: 'test_return',
                sourceBaseIndex: 0,
            },
            timestamp: 60,
        } as any;
        const result = processReturnToHandTriggers([returned], makeMatchState(core), '0', FIXED_RANDOM, 60);

        const queued = result.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        expect(queued).toBeDefined();
        const resolved = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: queued.payload.triggers } as any),
            FIXED_RANDOM,
            60,
        );
        expect(resolved?.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        const after = applyEvents(core, resolved?.events ?? []);
        expect(after.players['0'].hand.map(card => card.uid)).toContain('draw-med');
    });

    it('百变机兵的持续装备修正、保护与乘客移动链都有对象级合同', () => {
        const core = makeState({
            bases: [
                makeBase('base_changing_room', [
                    makeMinion('host', 'changerbots_huffie', '0', 3, {
                        attachedActions: [
                            { uid: 'bossy', defId: 'changerbots_matrix_of_bossiness', ownerId: '0' },
                            { uid: 'armor', defId: 'changerbots_cesium_armor', ownerId: '0' },
                            { uid: 'passengers', defId: 'changerbots_passengers', ownerId: '0' },
                        ],
                    }),
                    makeMinion('rider', 'changerbots_bruiser', '0', 2),
                ]),
                makeBase('base_unicrave', [
                    makeMinion('enemy', 'star_roamers_ensign', '1', 2),
                ]),
            ],
        });

        expect(getOngoingPowerModifierDetails(core, core.bases[0].minions[0], 0)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ sourceDefId: 'changerbots_matrix_of_bossiness', value: 2 }),
                expect.objectContaining({ sourceDefId: 'changerbots_cesium_armor', value: 1 }),
            ]),
        );
        expect(isMinionProtected(core, core.bases[0].minions[0], 0, '1', 'destroy')).toBe(true);

        const movedHost = applyEvents(core, [{
            type: SU_EVENTS.MINION_MOVED,
            payload: {
                minionUid: 'host',
                minionDefId: 'changerbots_huffie',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                reason: 'test_passengers_host_move',
            },
            timestamp: 70,
        } as any]);

        const result = invokeRegisteredAbilityContract('changerbots_passengers', 'talent', {
            state: movedHost,
            matchState: makeMatchState(movedHost),
            playerId: '0',
            cardUid: 'passengers',
            defId: 'changerbots_passengers',
            baseIndex: 1,
            random: FIXED_RANDOM,
            now: 70,
        });
        const selected = respondToPromptOption(
            result.matchState!,
            option => option.value?.baseIndex === 1,
            'move passenger to host base',
            '0',
            FIXED_RANDOM,
        );

        expect(selected.events.some(event =>
            event.type === SU_EVENTS.MINION_MOVED
            && (event as any).payload?.minionUid === 'rider'
            && (event as any).payload?.fromBaseIndex === 0
            && (event as any).payload?.toBaseIndex === 1,
        )).toBe(true);
    });

    it('星际旅者的鞭绳回旋可将其他基地己方随从回手替代为移至本基地', () => {
        const core = makeState({
            bases: [
                makeBase('base_alpha'),
                makeBase('base_neutral_space', [
                    makeMinion('returned', 'star_roamers_ensign', '0', 2),
                ]),
                makeBase({
                    defId: 'base_uss_undertaking',
                    ongoingActions: [{ uid: 'whiplash', defId: 'star_roamers_whiplash_maneuver', ownerId: '0' }],
                    minions: [],
                }),
            ],
        });

        const returned = {
            type: SU_EVENTS.MINION_RETURNED,
            payload: {
                minionUid: 'returned',
                minionDefId: 'star_roamers_ensign',
                fromBaseIndex: 1,
                toPlayerId: '0',
                reason: 'test_return',
                sourcePlayerId: '1',
                sourceControllerId: '1',
                sourceDefId: 'test_return',
                sourceBaseIndex: 1,
            },
            timestamp: 80,
        } as any;
        const result = processReturnToHandTriggers([returned], makeMatchState(core), '0', FIXED_RANDOM, 80);

        expect(result.events.some(event => event.type === SU_EVENTS.MINION_RETURNED)).toBe(false);
        const selected = respondToPromptOption(
            result.matchState!,
            option => option.value?.replace === true,
            'replace return with move',
            '0',
            FIXED_RANDOM,
        );

        expect(selected.events.some(event =>
            event.type === SU_EVENTS.MINION_MOVED
            && (event as any).payload?.minionUid === 'returned'
            && (event as any).payload?.fromBaseIndex === 1
            && (event as any).payload?.toBaseIndex === 2,
        )).toBe(true);
    });

    it('星际旅者的舰船工程师可将另一己方随从回手替代为移至另一基地', () => {
        const core = makeState({
            bases: [
                makeBase('base_uss_undertaking', [
                    makeMinion('engineer', 'star_roamers_ships_engineer', '0', 3),
                    makeMinion('returned', 'star_roamers_ensign', '0', 2),
                ]),
                makeBase('base_neutral_space'),
                makeBase('base_alpha'),
            ],
        });

        const returned = {
            type: SU_EVENTS.MINION_RETURNED,
            payload: {
                minionUid: 'returned',
                minionDefId: 'star_roamers_ensign',
                fromBaseIndex: 0,
                toPlayerId: '0',
                reason: 'test_return',
                sourcePlayerId: '1',
                sourceControllerId: '1',
                sourceDefId: 'test_return',
                sourceBaseIndex: 0,
            },
            timestamp: 90,
        } as any;
        const result = processReturnToHandTriggers([returned], makeMatchState(core), '0', FIXED_RANDOM, 90);

        expect(result.events.some(event => event.type === SU_EVENTS.MINION_RETURNED)).toBe(false);
        const selected = respondToPromptOption(
            result.matchState!,
            option => option.value?.replace === true && option.value?.targetBaseIndex === 2,
            'engineer replace return with move',
            '0',
            FIXED_RANDOM,
        );

        expect(selected.events.some(event =>
            event.type === SU_EVENTS.MINION_MOVED
            && (event as any).payload?.minionUid === 'returned'
            && (event as any).payload?.fromBaseIndex === 0
            && (event as any).payload?.toBaseIndex === 2,
        )).toBe(true);
    });

    it('Cease and Desist 八个基地能力都有对象级消费点', () => {
        const scoringCore = makeState({
            bases: [
                makeBase('base_no_moon', [
                    makeMinion('moon-ally', 'astroknights_mannersbot', '0', 2),
                ]),
                makeBase('base_neutral_space', [
                    makeMinion('neutral-target', 'star_roamers_ensign', '1', 2),
                ]),
                makeBase('base_unicrave', [
                    makeMinion('unicrave-minion', 'changerbots_huffie', '0', 3),
                ]),
            ],
            baseDeck: ['base_uss_undertaking', 'base_changing_room'],
        });
        const noMoonQueued = collectBaseAbilityTriggers({
            core: scoringCore,
            timing: 'beforeScoring',
            ownerPlayerId: '0',
            baseIndex: 0,
            now: 100,
        });
        expect(noMoonQueued?.payload.triggers[0].sourceDefId).toBe('base_no_moon');
        const noMoonResolved = maybeResolveReactionQueue(
            makeMatchState({ ...scoringCore, triggerQueue: noMoonQueued!.payload.triggers } as any),
            FIXED_RANDOM,
            100,
        );
        expect(noMoonResolved?.events.some(event =>
            event.type === SU_EVENTS.BASE_REPLACED
            && (event as any).payload.oldBaseDefId === 'base_neutral_space',
        )).toBe(true);

        const unicraveQueued = collectBaseAbilityTriggers({
            core: scoringCore,
            timing: 'beforeScoring',
            ownerPlayerId: '0',
            baseIndex: 2,
            now: 101,
        });
        const unicraveResolved = maybeResolveReactionQueue(
            makeMatchState({ ...scoringCore, triggerQueue: unicraveQueued!.payload.triggers } as any),
            FIXED_RANDOM,
            101,
        );
        expect(unicraveResolved?.events.some(event =>
            event.type === SU_EVENTS.BASE_REPLACED
            && (event as any).payload.baseIndex === 2
            && (event as any).payload.keepCards === true,
        )).toBe(true);

        const ussCore = makeState({
            bases: [
                makeBase('base_uss_undertaking', [
                    makeMinion('on-ship', 'star_roamers_science_officer', '0', 4),
                ]),
                makeBase('base_neutral_space', [
                    makeMinion('off-ship', 'star_roamers_ensign', '0', 2),
                ]),
                makeBase('base_alpha'),
            ],
        });
        const uss = triggerBaseAbilityWithMS('base_uss_undertaking', 'onTurnStart', {
            state: ussCore,
            matchState: makeMatchState(ussCore),
            baseIndex: 0,
            baseDefId: 'base_uss_undertaking',
            playerId: '0',
            now: 102,
            random: FIXED_RANDOM,
        });
        const ussSelected = respondToPromptOption(
            uss.matchState!,
            option => option.value?.minionUid === 'off-ship',
            'move own minion to USS Undertaking',
            '0',
            FIXED_RANDOM,
        );
        expect(ussSelected.events.some(event =>
            event.type === SU_EVENTS.MINION_MOVED
            && (event as any).payload.minionUid === 'off-ship'
            && (event as any).payload.toBaseIndex === 0,
        )).toBe(true);
        const ussMoveOut = respondToPromptOption(
            uss.matchState!,
            option => option.value?.minionUid === 'on-ship' && option.value?.toBaseIndex === 2,
            'move own minion away from USS Undertaking',
            '0',
            FIXED_RANDOM,
        );
        expect(ussMoveOut.events.some(event =>
            event.type === SU_EVENTS.MINION_MOVED
            && (event as any).payload.minionUid === 'on-ship'
            && (event as any).payload.toBaseIndex === 2,
        )).toBe(true);

        const wintersquashedCore = makeState({
            bases: [makeBase('base_wintersquashed', [
                makeMinion('gift', 'ignobles_sneaky_squire', '0', 2),
            ])],
        });
        const wintersquashed = triggerBaseAbilityWithMS('base_wintersquashed', 'onMinionPlayed', {
            state: wintersquashedCore,
            matchState: makeMatchState(wintersquashedCore),
            baseIndex: 0,
            baseDefId: 'base_wintersquashed',
            playerId: '0',
            minionUid: 'gift',
            minionDefId: 'ignobles_sneaky_squire',
            now: 103,
            random: FIXED_RANDOM,
        });
        const gifted = respondToPromptOption(
            wintersquashed.matchState!,
            option => option.value?.playerId === '1',
            'give Wintersquashed minion away',
            '0',
            FIXED_RANDOM,
        );
        expect(gifted.events.some(event =>
            event.type === SU_EVENTS.MINION_CONTROL_CHANGED
            && (event as any).payload.minionUid === 'gift'
            && (event as any).payload.toControllerId === '1',
        )).toBe(true);

        const changingRoomCore = makeState({
            bases: [makeBase('base_changing_room', [
                makeMinion('talent-user', 'changerbots_huffie', '0', 3),
            ])],
        });
        const changingRoomQueued = collectBaseAbilityTriggers({
            core: changingRoomCore,
            timing: 'onTalentUsed',
            ownerPlayerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'talent-user',
            triggerMinionDefId: 'changerbots_huffie',
            now: 104,
        });
        const changingRoomResolved = maybeResolveReactionQueue(
            makeMatchState({ ...changingRoomCore, triggerQueue: changingRoomQueued!.payload.triggers } as any),
            FIXED_RANDOM,
            104,
        );
        expect(changingRoomResolved?.events.some(event =>
            event.type === SU_EVENTS.TEMP_POWER_ADDED
            && (event as any).payload.minionUid === 'talent-user'
            && (event as any).payload.amount === 1,
        )).toBe(true);

        const hiveCore = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('hive-draw', 'astroknights_mannersbot', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_hive_of_scum_and_villainy', [
                makeMinion('hive-target', 'astroknights_mannersbot', '0', 2),
            ])],
        });
        const hiveQueued = collectBaseAbilityTriggers({
            core: hiveCore,
            timing: 'onActionPlayed',
            ownerPlayerId: '0',
            baseIndex: 0,
            actionTargetBaseIndex: 0,
            actionTargetType: 'minion',
            actionTargetMinionUid: 'hive-target',
            triggerCardUid: 'laser',
            triggerCardDefId: 'astroknights_laser_sword',
            triggerCardOwnerId: '0',
            now: 105,
        });
        const hiveResolved = maybeResolveReactionQueue(
            makeMatchState({ ...hiveCore, triggerQueue: hiveQueued!.payload.triggers } as any),
            FIXED_RANDOM,
            105,
        );
        expect(hiveResolved?.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(hiveResolved?.events.some(event => event.type === SU_EVENTS.BASE_ABILITY_USED)).toBe(true);

        const neutralCore = makeState({
            bases: [makeBase('base_neutral_space', [
                makeMinion('protected-neutral', 'star_roamers_ensign', '0', 2),
                makeMinion('enemy-neutral', 'ignobles_sneaky_squire', '1', 2),
            ])],
        });
        expect(isMinionProtected(
            neutralCore,
            neutralCore.bases[0].minions[0],
            0,
            '1',
            'affect',
            { sourceKind: 'nonAction', sourceBaseIndex: 0 },
        )).toBe(true);
        expect(isMinionProtected(
            neutralCore,
            neutralCore.bases[0].minions[0],
            0,
            '1',
            'affect',
            { sourceKind: 'action', sourceBaseIndex: 0 },
        )).toBe(false);

        const ensignCore = makeState({
            bases: [makeBase('base_uss_undertaking', [
                makeMinion('ensign-a', 'star_roamers_ensign', '0', 2),
                makeMinion('ensign-b', 'star_roamers_ensign', '0', 2),
            ])],
        });
        expect(getEffectivePower(ensignCore, ensignCore.bases[0].minions[0], 0)).toBe(3);
    });
});
