import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { isAbilityRuntimeContinuationEvent, resumeAbilityRuntimeContinuationEvent } from '../domain/abilityRuntime';
import { getMinionPower } from '../domain/abilityHelpers';
import { getRegisteredAbilityKeys } from '../domain/abilityRegistry';
import { getSmashUpAtlasImageById } from '../domain/atlasCatalog';
import { getBaseDefIdsForFactions, getFactionCards } from '../data/cards';
import { ANANSI_TALES_CARDS } from '../data/factions/anansi_tales';
import { ANANSI_TALES_POD_CARDS } from '../data/factions/anansi_tales_pod';
import { RUSSIAN_FAIRY_TALES_CARDS } from '../data/factions/russian_fairy_tales';
import { RUSSIAN_FAIRY_TALES_POD_CARDS } from '../data/factions/russian_fairy_tales_pod';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import type { SmashUpVariantSurface } from '../domain/variantBindings';
import { getSmashUpVariantSurfaceRelation } from '../domain/variantBindings';
import { smashUpCriticalImageResolver } from '../criticalImageResolver';
import { FACTION_METADATA } from '../ui/factionMeta';
import enLocale from '../../../../public/locales/en/game-smashup.json';
import zhLocale from '../../../../public/locales/zh-CN/game-smashup.json';
import {
    applyEvents,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
} from './helpers';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

function resumeFirstRuntimeContinuation(
    core: ReturnType<typeof makeState>,
    events: unknown[],
) {
    const domainEvents = events.filter(event => !isAbilityRuntimeContinuationEvent(event as any));
    const continuation = events.find(event => isAbilityRuntimeContinuationEvent(event as any));
    if (!continuation) throw new Error('Expected Smash Up ability runtime continuation event.');
    const resumed = resumeAbilityRuntimeContinuationEvent(
        makeMatchState(applyEvents(core, domainEvents as any)),
        continuation as any,
        FIXED_RANDOM,
    );
    if (!resumed) throw new Error('Expected Smash Up ability runtime continuation to resume.');
    return resumed.state;
}

const SHARED_SURFACES: SmashUpVariantSurface[] = [
    'ability',
    'interaction',
    'ongoing',
    'baseAbility',
    'powerModifier',
    'basePool',
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

function physicalCount(cards: Array<{ count: number }>): number {
    return cards.reduce((sum, card) => sum + card.count, 0);
}

function assertStaticParity(
    classicCards: typeof ANANSI_TALES_CARDS,
    podCards: typeof ANANSI_TALES_POD_CARDS,
): void {
    for (const podCard of podCards) {
        const classicId = podCard.id.replace(/_pod$/, '');
        const classicCard = classicCards.find(card => card.id === classicId);
        expect(classicCard, `${podCard.id} 必须有经典版对应对象`).toBeDefined();
        const { id: _podId, faction: _podFaction, previewRef: _podPreview, ...podFields } = podCard;
        const { id: _classicId, faction: _classicFaction, previewRef: _classicPreview, ...classicFields } = classicCard!;
        expect(podFields, `${podCard.id} 的玩法静态字段`).toEqual(classicFields);
    }
}

function makePlayingState() {
    return {
        sys: { phase: 'playCards' },
        core: {
            players: {
                '0': {
                    factions: [
                        SMASHUP_FACTION_IDS.ANANSI_TALES_POD,
                        SMASHUP_FACTION_IDS.RUSSIAN_FAIRY_TALES_POD,
                    ],
                },
            },
        },
    };
}

describe('阿南西传说与俄罗斯童话 POD 接入', () => {
    it('注册为 13/16 个唯一对象且各自恰好 20 张实体牌', () => {
        expect(ANANSI_TALES_POD_CARDS).toHaveLength(13);
        expect(physicalCount(ANANSI_TALES_POD_CARDS)).toBe(20);
        expect(RUSSIAN_FAIRY_TALES_POD_CARDS).toHaveLength(16);
        expect(physicalCount(RUSSIAN_FAIRY_TALES_POD_CARDS)).toBe(20);
        expect(getFactionCards(SMASHUP_FACTION_IDS.ANANSI_TALES_POD)).toHaveLength(13);
        expect(getFactionCards(SMASHUP_FACTION_IDS.RUSSIAN_FAIRY_TALES_POD)).toHaveLength(16);
    });

    it('逐卡玩法静态字段与经典版一致，只改变 POD 身份和图集', () => {
        assertStaticParity(ANANSI_TALES_CARDS, ANANSI_TALES_POD_CARDS);
        assertStaticParity(RUSSIAN_FAIRY_TALES_CARDS, RUSSIAN_FAIRY_TALES_POD_CARDS);
    });

    it('29 个唯一对象使用锁定的 4x5 atlas 槽位', () => {
        const anansiSlots = Object.fromEntries(ANANSI_TALES_POD_CARDS.map(card => [card.id, card.previewRef?.type === 'atlas' ? card.previewRef.index : -1]));
        expect(anansiSlots).toEqual({
            anansi_tales_anansi_the_spider_pod: 19,
            anansi_tales_osebo_the_leopard_pod: 18,
            anansi_tales_onini_the_python_pod: 17,
            anansi_tales_akye_the_turtle_pod: 14,
            anansi_tales_mboro_hornet_pod: 10,
            anansi_tales_the_perfect_gift_pod: 6,
            anansi_tales_pot_of_beans_pod: 4,
            anansi_tales_collecting_stories_pod: 2,
            anansi_tales_ear_of_corn_pod: 1,
            anansi_tales_pot_of_wisdom_pod: 0,
            anansi_tales_trading_stories_pod: 9,
            anansi_tales_let_it_be_full_and_eat_pod: 7,
            anansi_tales_feather_gifts_pod: 8,
        });

        const russianSlots = Object.fromEntries(RUSSIAN_FAIRY_TALES_POD_CARDS.map(card => [card.id, card.previewRef?.type === 'atlas' ? card.previewRef.index : -1]));
        expect(russianSlots).toEqual({
            russian_fairy_tales_the_birch_woman_pod: 17,
            russian_fairy_tales_finist_the_falcon_pod: 18,
            russian_fairy_tales_baba_yaga_pod: 19,
            russian_fairy_tales_the_birch_pod: 11,
            russian_fairy_tales_tsar_eagle_pod: 12,
            russian_fairy_tales_the_gray_wolf_pod: 14,
            russian_fairy_tales_foolish_magician_pod: 15,
            russian_fairy_tales_toad_pod: 10,
            russian_fairy_tales_the_frog_princess_pod: 0,
            russian_fairy_tales_the_water_of_life_pod: 1,
            russian_fairy_tales_fetch_i_know_not_what_pod: 8,
            russian_fairy_tales_go_i_know_not_whither_pod: 7,
            russian_fairy_tales_go_see_my_sister_pod: 6,
            russian_fairy_tales_bewitched_pod: 5,
            russian_fairy_tales_transformation_pod: 3,
            russian_fairy_tales_mass_transformation_pod: 9,
        });

        expect(new Set(ANANSI_TALES_POD_CARDS.map(card => card.previewRef?.type === 'atlas' ? card.previewRef.atlasId : null))).toEqual(
            new Set([SMASHUP_ATLAS_IDS.ANANSI_TALES_POD_CARDS]),
        );
        expect(new Set(RUSSIAN_FAIRY_TALES_POD_CARDS.map(card => card.previewRef?.type === 'atlas' ? card.previewRef.atlasId : null))).toEqual(
            new Set([SMASHUP_ATLAS_IDS.RUSSIAN_FAIRY_TALES_POD_CARDS]),
        );
    });

    it('显式共享全部玩法 surface 与经典基地池', () => {
        for (const surface of SHARED_SURFACES) {
            expect(getSmashUpVariantSurfaceRelation(surface, 'anansi_tales', SMASHUP_FACTION_IDS.ANANSI_TALES_POD)).toBe('shared');
            expect(getSmashUpVariantSurfaceRelation(surface, 'russian_fairy_tales', SMASHUP_FACTION_IDS.RUSSIAN_FAIRY_TALES_POD)).toBe('shared');
        }
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.ANANSI_TALES_POD]).sort()).toEqual([
            'base_anansis_web',
            'base_storytellers_hut',
        ]);
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.RUSSIAN_FAIRY_TALES_POD]).sort()).toEqual([
            'base_giant_turnip',
            'base_transformation_spring',
        ]);
    });

    it('生成 POD 能力 alias，且俄罗斯童话 POD 着魔保持 +2 力量', () => {
        requireAbilityRuntime();
        const keys = getRegisteredAbilityKeys();
        expect(keys.has('anansi_tales_let_it_be_full_and_eat_pod::onPlay')).toBe(true);
        expect(keys.has('anansi_tales_anansi_the_spider_pod::talent')).toBe(true);
        expect(keys.has('russian_fairy_tales_mass_transformation_pod::onPlay')).toBe(true);
        expect(keys.has('russian_fairy_tales_the_frog_princess_pod::talent')).toBe(true);

        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_transformation_spring',
                    minions: [makeMinion('target', 'russian_fairy_tales_tsar_eagle_pod', '0', 2, {
                        attachedActions: [{ uid: 'bewitched', defId: 'russian_fairy_tales_bewitched_pod', ownerId: '0', talentUsed: false }],
                    })],
                }),
            ],
        });
        expect(getMinionPower(core, core.bases[0].minions[0], 0)).toBe(4);
    });

    it('两个 POD 代表牌真实执行共享能力并到达最终权威状态', () => {
        requireAbilityRuntime();
        const anansiCore = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'anansi_tales_pot_of_beans_pod', 'action', '0'),
                        makeCard('draw-2', 'anansi_tales_feather_gifts_pod', 'action', '0'),
                    ],
                    discard: [makeCard('gift', 'anansi_tales_let_it_be_full_and_eat_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const anansiResult = invokeRegisteredAbilityContract('anansi_tales_let_it_be_full_and_eat_pod', 'onPlay', {
            state: anansiCore,
            matchState: makeMatchState(anansiCore),
            playerId: '0',
            cardUid: 'gift',
            defId: 'anansi_tales_let_it_be_full_and_eat_pod',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const anansiPromptState = resumeFirstRuntimeContinuation(anansiCore, anansiResult.events);
        const gifted = respondToPromptOption(
            anansiPromptState,
            option => option.value?.targetPlayerId === '1',
            'POD 礼物目标玩家',
            '0',
            FIXED_RANDOM,
        );
        expect(gifted.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2']);
        expect(gifted.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['gift']);
        expect(gifted.finalState.core.players['1'].hand[0].defId).toBe('anansi_tales_let_it_be_full_and_eat_pod');

        const russianCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('p0-hand', 'russian_fairy_tales_tsar_eagle_pod', 'minion', '0')],
                    deck: [makeCard('p0-deck', 'russian_fairy_tales_the_birch_pod', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('p1-hand-a', 'anansi_tales_akye_the_turtle_pod', 'minion', '1'), makeCard('p1-hand-b', 'anansi_tales_pot_of_beans_pod', 'action', '1')],
                    deck: [makeCard('p1-deck-a', 'anansi_tales_mboro_hornet_pod', 'minion', '1'), makeCard('p1-deck-b', 'anansi_tales_feather_gifts_pod', 'action', '1')],
                }),
            },
        });
        const russianResult = invokeRegisteredAbilityContract('russian_fairy_tales_mass_transformation_pod', 'onPlay', {
            state: russianCore,
            matchState: makeMatchState(russianCore),
            playerId: '0',
            cardUid: 'mass',
            defId: 'russian_fairy_tales_mass_transformation_pod',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 20,
        });
        const transformed = applyEvents(russianCore, russianResult.events);
        expect(transformed.players['0'].hand).toHaveLength(1);
        expect(transformed.players['1'].hand).toHaveLength(2);
        expect(transformed.players['0'].deck).toHaveLength(1);
        expect(transformed.players['1'].deck).toHaveLength(2);
    });

    it('双语 locale、可选 metadata、atlas catalog 与关键图片预加载完整', () => {
        const metadata = new Map(FACTION_METADATA.map(item => [item.id, item]));
        expect(metadata.get(SMASHUP_FACTION_IDS.ANANSI_TALES_POD)?.implementationStatus).toBeUndefined();
        expect(metadata.get(SMASHUP_FACTION_IDS.RUSSIAN_FAIRY_TALES_POD)?.implementationStatus).toBeUndefined();
        expect(metadata.get(SMASHUP_FACTION_IDS.ANANSI_TALES_POD)?.locales).toBeUndefined();
        expect(metadata.get(SMASHUP_FACTION_IDS.RUSSIAN_FAIRY_TALES_POD)?.locales).toBeUndefined();

        for (const locale of [enLocale, zhLocale] as const) {
            expect(locale.factions.anansi_tales_pod.name).toBeTruthy();
            expect(locale.factions.russian_fairy_tales_pod.name).toBeTruthy();
            for (const card of [...ANANSI_TALES_POD_CARDS, ...RUSSIAN_FAIRY_TALES_POD_CARDS]) {
                expect(locale.cards[card.id as keyof typeof locale.cards], `${card.id} locale`).toBeTruthy();
            }
        }

        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.ANANSI_TALES_POD_CARDS)).toBe('smashup/cards/anansi_tales_pod');
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.RUSSIAN_FAIRY_TALES_POD_CARDS)).toBe('smashup/cards/russian_fairy_tales_pod');
        const images = smashUpCriticalImageResolver(makePlayingState(), undefined, '0');
        expect(images.critical).toContain('smashup/cards/anansi_tales_pod');
        expect(images.critical).toContain('smashup/cards/russian_fairy_tales_pod');
    });
});
