import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { getFactionCards, getBaseDefIdsForFactions, getFactionTitans } from '../data/cards';
import smashUpEnglishMap from '../data/englishAtlasMap.json';
import { ITTY_CRITTERS_CARDS } from '../data/factions/itty_critters';
import { ITTY_CRITTERS_POD_CARDS } from '../data/factions/itty_critters_pod';
import { TIME_TRAVELERS_CARDS } from '../data/factions/time_travelers';
import { TIME_TRAVELERS_POD_CARDS } from '../data/factions/time_travelers_pod';
import { getRegisteredAbilityKeys } from '../domain/abilityRegistry';
import { getSmashUpAtlasImageById } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import { SU_COMMANDS } from '../domain/types';
import { getSmashUpVariantSurfaceRelation, type SmashUpVariantSurface } from '../domain/variantBindings';
import { smashUpCriticalImageResolver } from '../criticalImageResolver';
import { FACTION_METADATA } from '../ui/factionMeta';
import {
    getOptionalSimpleChoicePrompt,
    getPromptOption,
    getPromptOptions,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    resolveInteractionChain,
} from './helpers';
import { runCommand } from './testRunner';

const sharedSurfaces: SmashUpVariantSurface[] = [
    'ability',
    'interaction',
    'ongoing',
    'baseAbility',
    'powerModifier',
];

let abilityInitError: Error | null = null;

beforeAll(() => {
    try {
        resetAbilityInit();
        initAllAbilities();
    } catch (error) {
        abilityInitError = error instanceof Error ? error : new Error(String(error));
    }
});

function requireAbilityRuntime(): void {
    if (abilityInitError) throw abilityInitError;
}

function physicalCardCount(cards: Array<{ count: number }>): number {
    return cards.reduce((total, card) => total + card.count, 0);
}

function makePlayingState() {
    return {
        sys: { phase: 'playCards' },
        core: {
            players: {
                '0': {
                    factions: [
                        SMASHUP_FACTION_IDS.ITTY_CRITTERS_POD,
                        SMASHUP_FACTION_IDS.TIME_TRAVELERS_POD,
                    ],
                },
            },
        },
    };
}

describe('迷你萌宠与时间旅行者 POD 接入', () => {
    it('各自注册为 20 张物理牌的独立牌组', () => {
        expect(ITTY_CRITTERS_POD_CARDS).toHaveLength(16);
        expect(physicalCardCount(ITTY_CRITTERS_POD_CARDS)).toBe(20);
        expect(TIME_TRAVELERS_POD_CARDS).toHaveLength(12);
        expect(physicalCardCount(TIME_TRAVELERS_POD_CARDS)).toBe(20);

        expect(getFactionCards(SMASHUP_FACTION_IDS.ITTY_CRITTERS_POD)).toHaveLength(16);
        expect(getFactionCards(SMASHUP_FACTION_IDS.TIME_TRAVELERS_POD)).toHaveLength(12);
    });

    it('逐卡静态玩法字段与经典版本完全一致，仅保留独立 POD 身份和图集', () => {
        const comparedFields = [
            'type',
            'name',
            'nameEn',
            'power',
            'count',
            'subtype',
            'ongoingTarget',
            'beforeScoringPlayable',
            'abilityTags',
            'specialLimitGroup',
        ] as const;

        const assertEquivalent = (
            classicCards: typeof ITTY_CRITTERS_CARDS,
            podCards: typeof ITTY_CRITTERS_POD_CARDS,
        ) => {
            for (const podCard of podCards) {
                const classicId = podCard.id.replace(/_pod$/, '');
                const classicCard = classicCards.find(card => card.id === classicId);
                expect(classicCard, `${podCard.id} 必须有经典版对应对象`).toBeDefined();
                for (const field of comparedFields) {
                    expect(
                        podCard[field],
                        `${podCard.id} 的 ${field} 必须与 ${classicId} 一致`,
                    ).toEqual(classicCard?.[field]);
                }
            }
        };

        assertEquivalent(ITTY_CRITTERS_CARDS, ITTY_CRITTERS_POD_CARDS);
        assertEquivalent(TIME_TRAVELERS_CARDS, TIME_TRAVELERS_POD_CARDS);
    });

    it('使用用户卡图对应的 4x5 图集槽位', () => {
        const ittySlots = Object.fromEntries(
            ITTY_CRITTERS_POD_CARDS.map(card => [card.id, card.previewRef?.type === 'atlas' ? card.previewRef.index : -1]),
        );
        expect(ittySlots).toMatchObject({
            itty_critters_i_select_you_pod: 0,
            itty_critters_evolution_pod: 1,
            itty_critters_critter_cube_pod: 3,
            itty_critters_ittypedia_pod: 4,
            itty_critters_recall_critter_pod: 6,
            itty_critters_gotta_get_em_all_pod: 7,
            itty_critters_coach_combat_pod: 8,
            itty_critters_super_effective_pod: 9,
            itty_critters_critter_coach_pod: 16,
            itty_critters_critter_champion_pod: 19,
        });

        const timeSlots = Object.fromEntries(
            TIME_TRAVELERS_POD_CARDS.map(card => [card.id, card.previewRef?.type === 'atlas' ? card.previewRef.index : -1]),
        );
        expect(timeSlots).toMatchObject({
            time_travelers_time_walk_pod: 0,
            time_travelers_do_over_pod: 1,
            time_travelers_time_is_fleeting_pod: 3,
            time_travelers_its_astounding_pod: 4,
            time_travelers_stasis_field_pod: 5,
            time_travelers_into_the_time_slip_pod: 6,
            time_travelers_wormhole_pod: 8,
            time_travelers_1_21_gigawatts_pod: 9,
            time_travelers_jumper_pod: 10,
            time_travelers_time_raider_pod: 14,
            time_travelers_repeater_perfect_pod: 17,
            time_travelers_doctor_when_pod: 19,
        });

        expect(new Set(ITTY_CRITTERS_POD_CARDS.map(card => card.previewRef?.type === 'atlas' ? card.previewRef.atlasId : null))).toEqual(
            new Set([SMASHUP_ATLAS_IDS.ITTY_CRITTERS_POD_CARDS]),
        );
        expect(new Set(TIME_TRAVELERS_POD_CARDS.map(card => card.previewRef?.type === 'atlas' ? card.previewRef.atlasId : null))).toEqual(
            new Set([SMASHUP_ATLAS_IDS.TIME_TRAVELERS_POD_CARDS]),
        );
    });

    it('使用独立 POD 基地身份并复用原基地卡图', () => {
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.ITTY_CRITTERS_POD]).sort()).toEqual([
            'base_critter_combat_club_pod',
            'base_itty_city_pod',
        ]);
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.TIME_TRAVELERS_POD]).sort()).toEqual([
            'base_portal_room_pod',
            'base_the_nexus_pod',
        ]);

        const englishMap = smashUpEnglishMap as Record<string, { atlasId: string; index: number }>;
        expect(englishMap.base_critter_combat_club_pod).toEqual({ atlasId: SMASHUP_ATLAS_IDS.BASE8, index: 4 });
        expect(englishMap.base_itty_city_pod).toEqual({ atlasId: SMASHUP_ATLAS_IDS.BASE8, index: 5 });
        expect(englishMap.base_the_nexus_pod).toEqual({ atlasId: SMASHUP_ATLAS_IDS.BASE9, index: 0 });
        expect(englishMap.base_portal_room_pod).toEqual({ atlasId: SMASHUP_ATLAS_IDS.BASE9, index: 1 });
    });

    it('显式声明共享玩法绑定且基地池保持独立', () => {
        for (const surface of sharedSurfaces) {
            expect(getSmashUpVariantSurfaceRelation(
                surface,
                'itty_critters_i_select_you',
                SMASHUP_FACTION_IDS.ITTY_CRITTERS_POD,
            )).toBe('shared');
            expect(getSmashUpVariantSurfaceRelation(
                surface,
                'time_travelers_time_walk',
                SMASHUP_FACTION_IDS.TIME_TRAVELERS_POD,
            )).toBe('shared');
        }
        expect(getSmashUpVariantSurfaceRelation('basePool', 'itty_critters', SMASHUP_FACTION_IDS.ITTY_CRITTERS_POD)).toBe('separate');
        expect(getSmashUpVariantSurfaceRelation('basePool', 'time_travelers', SMASHUP_FACTION_IDS.TIME_TRAVELERS_POD)).toBe('separate');
    });

    it('运行时生成 POD 能力注册键', () => {
        requireAbilityRuntime();
        const abilityKeys = getRegisteredAbilityKeys();
        expect(abilityKeys.has('itty_critters_i_select_you_pod::onPlay')).toBe(true);
        expect(abilityKeys.has('itty_critters_critter_champion_pod::talent')).toBe(true);
        expect(abilityKeys.has('time_travelers_time_walk_pod::onPlay')).toBe(true);
        expect(abilityKeys.has('time_travelers_time_raider_pod::talent')).toBe(true);
    });

    it('POD 卡实际执行共享能力并完成交互链', () => {
        requireAbilityRuntime();
        const ittyCore = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('select-pod', 'itty_critters_i_select_you_pod', 'action', '0')],
                    deck: [
                        makeCard('small-pod', 'itty_critters_flooffairy_pod', 'minion', '0'),
                        makeCard('big-pod', 'itty_critters_critter_coach_pod', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_itty_city_pod', []),
                makeBase('base_critter_combat_club_pod', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const selected = runCommand(makeMatchState(ittyCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'select-pod' },
        } as any);
        expect(selected.success).toBe(true);

        const ittyResolved = resolveInteractionChain(selected.finalState, (prompt, _state, step) => {
            if (step === 0) {
                expect(getPromptOptions(prompt).some(option => option.value?.cardUid === 'big-pod')).toBe(false);
                const small = getPromptOption(
                    prompt,
                    option => option.value?.cardUid === 'small-pod',
                    '迷你萌宠 POD 小随从',
                );
                return { optionId: small.id };
            }
            if (getPromptOptions(prompt).some(option => option.value?.skip)) {
                const skip = getPromptOption(prompt, option => option.value?.skip, '迷你萌宠 POD 可选能力跳过');
                return { optionId: skip.id };
            }
            const destination = getPromptOption(
                prompt,
                option => option.value?.baseIndex === 1,
                '迷你萌宠 POD 目标基地',
            );
            return { optionId: destination.id };
        });
        expect(ittyResolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'small-pod')).toBe(true);

        const timeCore = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('do-over-pod', 'time_travelers_do_over_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_portal_room_pod', [
                    makeMinion('jumper-pod', 'time_travelers_jumper_pod', '0', 2),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const repeated = runCommand(makeMatchState(timeCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'do-over-pod', targetBaseIndex: 0, targetMinionUid: 'jumper-pod' },
        } as any);
        expect(repeated.success).toBe(true);
        expect(repeated.finalState.core.bases[0].minions.some(minion => minion.uid === 'jumper-pod')).toBe(false);
        expect(repeated.finalState.core.players['0'].hand.map(card => card.uid)).toContain('jumper-pod');
        getSimpleChoicePrompt(repeated.finalState, 'smashup_immediate_extra_minion');

        const timeResolved = resolveInteractionChain(repeated.finalState, (prompt) => {
            const skip = getPromptOption(prompt, option => option.value?.skip, '时间旅行者 POD 跳过重打');
            return { optionId: skip.id };
        });
        expect(getOptionalSimpleChoicePrompt(timeResolved.finalState)).toBeUndefined();
        expect(timeResolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('jumper-pod');
    });

    it('复用彩虹鸟与时间盒子，并预加载两张新卡图', () => {
        expect(getFactionTitans(SMASHUP_FACTION_IDS.ITTY_CRITTERS_POD).map(titan => titan.id)).toEqual([
            'itty_critters_rainboroc',
        ]);
        expect(getFactionTitans(SMASHUP_FACTION_IDS.TIME_TRAVELERS_POD).map(titan => titan.id)).toEqual([
            'time_travelers_time_box',
        ]);

        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.ITTY_CRITTERS_POD_CARDS)).toBe('smashup/cards/itty_critters_pod');
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.TIME_TRAVELERS_POD_CARDS)).toBe('smashup/cards/time_travelers_pod');

        const resolved = smashUpCriticalImageResolver(makePlayingState(), undefined, '0');
        expect(resolved.critical).toContain('smashup/cards/itty_critters_pod');
        expect(resolved.critical).toContain('smashup/cards/time_travelers_pod');
        expect(resolved.critical).toContain('smashup/base/baokemeng');
        expect(resolved.critical).toContain('smashup/base/yuanhou');
    });

    it('经典版本仅中文显示，POD 版本面向全部语言', () => {
        const byId = new Map(FACTION_METADATA.map(meta => [meta.id, meta]));
        expect(byId.get(SMASHUP_FACTION_IDS.ITTY_CRITTERS)?.locales).toEqual(['zh-CN']);
        expect(byId.get(SMASHUP_FACTION_IDS.TIME_TRAVELERS)?.locales).toEqual(['zh-CN']);
        expect(byId.get(SMASHUP_FACTION_IDS.ITTY_CRITTERS_POD)?.locales).toBeUndefined();
        expect(byId.get(SMASHUP_FACTION_IDS.TIME_TRAVELERS_POD)?.locales).toBeUndefined();
    });
});
