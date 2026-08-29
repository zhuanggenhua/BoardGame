import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { getBaseDefIdsForFactions, getFactionCards, getFactionTitans, getMinionDef } from '../data/cards';
import { getRegisteredAbilityKeys } from '../domain/abilityRegistry';
import { canControllerPlayTitan } from '../domain/abilityHelpers';
import { getSmashUpAtlasImageById } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import {
    getModifiedBaseVp,
    interceptEvent,
    isBaseAbilitySuppressed,
    isMinionProtected,
} from '../domain/ongoingEffects';
import { getEffectiveBreakpoint, getEffectivePower } from '../domain/ongoingModifiers';
import { reduce } from '../domain/reduce';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { getSmashUpVariantSurfaceRelation } from '../domain/variantBindings';
import {
    applyEvents,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    getPromptOptions,
    getSimpleChoicePrompt,
    respondToPromptOption,
} from './helpers';
import { runCommand } from './testRunner';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe('龙族、超级英雄、魔法少女与超级战队 POD 接入', () => {
    it('四套牌均注册为 20 张物理牌并使用独立图集', () => {
        const cases = [
            [SMASHUP_FACTION_IDS.DRAGONS_POD, SMASHUP_ATLAS_IDS.DRAGONS_POD, 'smashup/cards/dragons_pod'],
            [SMASHUP_FACTION_IDS.SUPERHEROES_POD, SMASHUP_ATLAS_IDS.SUPERHEROES_POD, 'smashup/cards/superheroes_pod'],
            [SMASHUP_FACTION_IDS.MAGICAL_GIRLS_POD, SMASHUP_ATLAS_IDS.MAGICAL_GIRLS_POD, 'smashup/cards/magical_girls_pod'],
            [SMASHUP_FACTION_IDS.MEGA_TROOPERS_POD, SMASHUP_ATLAS_IDS.MEGA_TROOPERS_POD, 'smashup/cards/mega_troopers_pod'],
        ] as const;
        for (const [factionId, atlasId, image] of cases) {
            const cards = getFactionCards(factionId);
            expect(cards.reduce((total, card) => total + card.count, 0)).toBe(20);
            expect(new Set(cards.map(card => card.previewRef?.type === 'atlas' ? card.previewRef.atlasId : null))).toEqual(new Set([atlasId]));
            expect(getSmashUpAtlasImageById(atlasId)).toBe(image);
        }
    });

    it('POD 基地池与泰坦 fallback 使用正确身份', () => {
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.DRAGONS_POD]).sort()).toEqual(['base_dragons_lair_pod', 'base_wyrms_desolation_pod']);
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.SUPERHEROES_POD]).sort()).toEqual(['base_converted_cave_pod', 'base_crystal_fortress_pod']);
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.MAGICAL_GIRLS_POD]).sort()).toEqual(['base_akihabara_high_pod', 'base_q_point_pod']);
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.MEGA_TROOPERS_POD]).sort()).toEqual(['base_juice_bar_pod', 'base_moon_dumpster_pod']);
        expect(getFactionTitans(SMASHUP_FACTION_IDS.SUPERHEROES_POD).map(card => card.id)).toEqual(['superheroes_the_everything_glove']);
        expect(getFactionTitans(SMASHUP_FACTION_IDS.MAGICAL_GIRLS_POD).map(card => card.id)).toEqual(['magical_girls_walking_castle']);
        expect(getFactionTitans(SMASHUP_FACTION_IDS.MEGA_TROOPERS_POD).map(card => card.id)).toEqual(['mega_troopers_megabot']);
    });

    it('三套同构派系共享玩法，超级战队差异 family 使用独立注册', () => {
        expect(getSmashUpVariantSurfaceRelation('ability', 'dragons_wyvern', SMASHUP_FACTION_IDS.DRAGONS_POD)).toBe('shared');
        expect(getSmashUpVariantSurfaceRelation('ability', 'superheroes_captain_amazing', SMASHUP_FACTION_IDS.SUPERHEROES_POD)).toBe('shared');
        expect(getSmashUpVariantSurfaceRelation('ability', 'magical_girls_lunar_captain', SMASHUP_FACTION_IDS.MAGICAL_GIRLS_POD)).toBe('shared');
        expect(getSmashUpVariantSurfaceRelation('ability', 'mega_troopers_plan_for_more', SMASHUP_FACTION_IDS.MEGA_TROOPERS_POD)).toBe('separate');
        expect(getSmashUpVariantSurfaceRelation('ongoing', 'mega_troopers_omega_protocol', SMASHUP_FACTION_IDS.MEGA_TROOPERS_POD)).toBe('podOnly');

        const keys = getRegisteredAbilityKeys();
        expect(keys.has('mega_troopers_form_megabot_pod::onPlay')).toBe(true);
        expect(keys.has('mega_troopers_plan_for_more_pod::onPlay')).toBe(true);
        expect(keys.has('mega_troopers_beta_6_pod::special')).toBe(true);
        expect(keys.has('mega_troopers_red_trooper_pod::talent')).toBe(true);
    });

    it('绿骑士走计分前手牌打出合同，红骑士将泰坦上限提高到两个', () => {
        expect(getMinionDef('mega_troopers_green_trooper_pod')?.beforeScoringPlayable).toBe(true);
        const core = {
            players: { '0': {}, '1': {} },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_juice_bar_pod', [
                    makeMinion('red', 'mega_troopers_red_trooper_pod', '0', 5),
                ]),
            ],
            titans: [
                {
                    uid: 'titan-a',
                    defId: 'mega_troopers_megabot',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0 },
                },
                {
                    uid: 'titan-b',
                    defId: 'superheroes_the_everything_glove',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' },
                },
            ],
        } as any;
        expect(canControllerPlayTitan(core, '0', 'titan-b')).toBe(true);
    });

    it('飞龙 POD 共享天赋降低本回合爆分线，并在下一回合开始时清理', () => {
        const core = makeState({
            bases: [makeBase('base_ninja_dojo', [
                makeMinion('wyvern-pod', 'dragons_wyvern_pod', '0', 4),
            ])],
        });
        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'wyvern-pod', baseIndex: 0 },
            timestamp: 200,
        });

        expect(result.success).toBe(true);
        expect(result.finalState.core.tempBreakpointModifiers?.[0]).toBe(-3);
        expect(getEffectiveBreakpoint(result.finalState.core, 0)).toBe(15);

        const cleaned = applyEvents(result.finalState.core, [{
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '1', turnNumber: 2 },
            timestamp: 201,
        }]);
        expect(cleaned.tempBreakpointModifiers).toBeUndefined();
        expect(getEffectiveBreakpoint(cleaned, 0)).toBe(18);
    });

    it('龙族 POD 的巨龙、废墟与夷为平地均命中共享计分和基地压制合同', () => {
        const core = makeState({
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('wyrm-pod', 'dragons_great_wyrm_pod', '0', 5),
                    makeMinion('enemy', 'alien_invader', '1', 5),
                ]),
                makeBase({
                    defId: 'base_pirate_cove',
                    ongoingActions: [
                        { uid: 'ruins-pod', defId: 'dragons_ruins_pod', ownerId: '0' },
                        { uid: 'raze-pod', defId: 'dragons_raze_pod', ownerId: '0' },
                    ],
                }),
            ],
        });

        expect(getModifiedBaseVp(core, 0, '1', 4)).toBe(3);
        expect(getModifiedBaseVp(core, 0, '0', 4)).toBe(4);
        expect(getModifiedBaseVp(core, 1, '1', 3)).toBe(2);
        expect(getModifiedBaseVp(core, 1, '0', 3)).toBe(3);
        expect(isBaseAbilitySuppressed(core, 1)).toBe(true);
    });

    it('正义伙伴 POD 共享行动只增强己方力量 5+ 随从，并在下一回合开始时清理', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('justice-pod', 'superheroes_justice_friends_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('captain-pod', 'superheroes_captain_amazing_pod', '0', 5),
                    makeMinion('small', 'pirate_first_mate', '0', 4),
                    makeMinion('enemy', 'alien_invader', '1', 5),
                ]),
                makeBase('base_pirate_cove', [
                    makeMinion('burst-pod', 'superheroes_the_burst_pod', '0', 5),
                ]),
            ],
        });
        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'justice-pod' },
            timestamp: 202,
        });

        expect(result.success).toBe(true);
        expect(getEffectivePower(result.finalState.core, result.finalState.core.bases[0].minions[0], 0)).toBe(7);
        expect(getEffectivePower(result.finalState.core, result.finalState.core.bases[0].minions[1], 0)).toBe(4);
        expect(getEffectivePower(result.finalState.core, result.finalState.core.bases[0].minions[2], 0)).toBe(5);
        expect(getEffectivePower(result.finalState.core, result.finalState.core.bases[1].minions[0], 1)).toBe(7);

        const cleaned = applyEvents(result.finalState.core, [{
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '1', turnNumber: 2 },
            timestamp: 203,
        }]);
        expect(getEffectivePower(cleaned, cleaned.bases[0].minions[0], 0)).toBe(5);
        expect(getEffectivePower(cleaned, cleaned.bases[1].minions[0], 1)).toBe(5);
    });

    it('超级英雄 POD 的随从、附着行动、基地持续与 POD 基地均提供正确保护', () => {
        const awesomeAlly = makeMinion('awesome-ally', 'pirate_first_mate', '0', 3);
        const expandedTarget = makeMinion('expanded-target', 'pirate_first_mate', '0', 3, {
            attachedActions: [{
                uid: 'expanded-pod',
                defId: 'superheroes_expanded_power_pod',
                ownerId: '0',
            }],
        });
        const secretTarget = makeMinion('secret-target', 'pirate_first_mate', '0', 3);
        const caveTarget = makeMinion('cave-target', 'pirate_first_mate', '0', 2);
        const suppressedAlly = makeMinion('suppressed-ally', 'pirate_first_mate', '0', 3);
        const core = makeState({
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('awesome-pod', 'superheroes_awesome_guy_pod', '0', 5),
                    awesomeAlly,
                ]),
                makeBase('base_pirate_cove', [expandedTarget]),
                makeBase({
                    defId: 'base_akihabara_high',
                    minions: [secretTarget],
                    ongoingActions: [{
                        uid: 'secret-pod',
                        defId: 'superheroes_secret_base_pod',
                        ownerId: '0',
                    }],
                }),
                makeBase('base_converted_cave_pod', [caveTarget]),
                makeBase('base_q_point', [
                    makeMinion('suppressed-awesome-pod', 'superheroes_awesome_guy_pod', '0', 5, {
                        attachedActions: [{
                            uid: 'weakness-pod',
                            defId: 'superheroes_my_only_weakness_pod',
                            ownerId: '1',
                        }],
                    }),
                    suppressedAlly,
                ]),
            ],
        });

        expect(isMinionProtected(core, awesomeAlly, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(core, expandedTarget, 1, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(core, secretTarget, 2, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(core, caveTarget, 3, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(core, suppressedAlly, 4, '1', 'destroy')).toBe(false);
    });

    it('魔法杖 POD 共享附着增益，并在宿主离场时改放牌库顶', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_akihabara_high_pod', [
                makeMinion('maid-pod', 'magical_girls_power_maid_pod', '0', 3, {
                    attachedActions: [{
                        uid: 'staff-pod',
                        defId: 'magical_girls_magical_staff_pod',
                        ownerId: '0',
                    }],
                }),
            ])],
        });

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(4);

        const detached = {
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: 'staff-pod',
                defId: 'magical_girls_magical_staff_pod',
                ownerId: '0',
                reason: 'minion_destroy',
            },
            timestamp: 204,
        } as any;
        const intercepted = interceptEvent(core, detached);
        expect(intercepted).toMatchObject({ type: SU_EVENTS.CARD_TO_DECK_TOP });
        const resolved = reduce(core, intercepted as any);
        expect(resolved.players['0'].deck[0]?.uid).toBe('staff-pod');
        expect(resolved.players['0'].discard.some(card => card.uid === 'staff-pod')).toBe(false);
    });

    it('花哨装男孩 POD 保护同基地其他己方随从，但不保护自己', () => {
        const fancy = makeMinion('fancy-pod', 'magical_girls_fancy_suit_lad_pod', '0', 3);
        const ally = makeMinion('ally', 'magical_girls_power_maid_pod', '0', 3);
        const core = makeState({
            bases: [makeBase('base_akihabara_high_pod', [fancy, ally])],
        });

        expect(isMinionProtected(core, ally, 0, '1', 'affect')).toBe(true);
        expect(isMinionProtected(core, fancy, 0, '1', 'affect')).toBe(false);
    });

    it('白魔猫与黑魔猫 POD 只搜索同版本女仆与月之队长', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    minionLimit: 2,
                    hand: [
                        makeCard('white-pod', 'magical_girls_white_magicat_pod', 'minion', '0'),
                        makeCard('black-pod', 'magical_girls_black_magicat_pod', 'minion', '0'),
                    ],
                    deck: [
                        makeCard('maid-base', 'magical_girls_power_maid', 'minion', '0'),
                        makeCard('maid-pod', 'magical_girls_power_maid_pod', 'minion', '0'),
                    ],
                    discard: [
                        makeCard('captain-base', 'magical_girls_lunar_captain', 'minion', '0'),
                        makeCard('captain-pod', 'magical_girls_lunar_captain_pod', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_akihabara_high_pod')],
        });

        const white = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'white-pod', baseIndex: 0 },
            timestamp: 205,
        });
        expect(white.success).toBe(true);
        const whitePrompt = getSimpleChoicePrompt(white.finalState, 'magical_girls_white_magicat_pod');
        expect(getPromptOptions(whitePrompt).map(option => option.value?.cardUid)).toContain('maid-pod');
        expect(getPromptOptions(whitePrompt).map(option => option.value?.cardUid)).not.toContain('maid-base');
        const whiteResolved = respondToPromptOption(
            white.finalState,
            option => option.value?.cardUid === 'maid-pod',
            '白魔猫 POD 搜索女仆 POD',
            '0',
        );
        expect(whiteResolved.success).toBe(true);
        expect(whiteResolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('maid-pod');
        expect(whiteResolved.finalState.core.players['0'].deck.map(card => card.uid)).toContain('maid-base');

        const black = runCommand(whiteResolved.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'black-pod', baseIndex: 0 },
            timestamp: 206,
        });
        expect(black.success).toBe(true);
        const blackPrompt = getSimpleChoicePrompt(black.finalState, 'magical_girls_black_magicat_pod');
        expect(getPromptOptions(blackPrompt).map(option => option.value?.cardUid)).toContain('captain-pod');
        expect(getPromptOptions(blackPrompt).map(option => option.value?.cardUid)).not.toContain('captain-base');
        const blackResolved = respondToPromptOption(
            black.finalState,
            option => option.value?.cardUid === 'captain-pod',
            '黑魔猫 POD 搜索月之队长 POD',
            '0',
        );
        expect(blackResolved.success).toBe(true);
        expect(blackResolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('captain-pod');
        expect(blackResolved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('captain-base');
    });

    it('女仆 POD 的移动交互绑定触发它的真实卡 UID，不会串到基础版女仆', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('maid-base', 'magical_girls_power_maid', '0', 3),
                    makeMinion('target', 'itty_critters_flooffairy', '1', 1),
                ]),
                makeBase('base_pirate_cove', [
                    makeMinion('other-target', 'dragons_hatchling', '1', 1),
                ]),
                makeBase('base_akihabara_high_pod', [
                    makeMinion('maid-pod', 'magical_girls_power_maid_pod', '0', 3),
                ]),
            ],
        });

        const used = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'maid-pod', baseIndex: 2 },
            timestamp: 207,
        });
        expect(used.success).toBe(true);

        const moved = respondToPromptOption(
            used.finalState,
            option => option.value?.minionUid === 'target',
            '女仆 POD 移动目标',
            '0',
        );
        expect(moved.success).toBe(true);
        const destinationPrompt = getSimpleChoicePrompt(moved.finalState, 'magical_girls_power_maid_destination');
        expect(getPromptOptions(destinationPrompt).map(option => option.value?.baseIndex)).toContain(2);
        const destinationChosen = respondToPromptOption(
            moved.finalState,
            option => option.value?.baseIndex === 2,
            '女仆 POD 移动目的基地',
            '0',
        );
        expect(destinationChosen.success).toBe(true);
        expect(destinationChosen.finalState.core.bases[2].minions.map(minion => minion.uid)).toContain('target');
        expect(destinationChosen.finalState.core.bases[1].minions.map(minion => minion.uid)).not.toContain('target');
    });
});
