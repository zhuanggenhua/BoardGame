import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { getBaseDefIdsForFactions, getFactionCards } from '../data/cards';
import { ACTION_HEROES_CARDS } from '../data/factions/excellent_movies_teens';
import { ACTION_HEROES_POD_CARDS } from '../data/factions/action_heroes_pod';
import { getRegisteredAbilityKeys } from '../domain/abilityRegistry';
import { getSmashUpAtlasImageById, SMASHUP_ATLAS_DEFINITIONS } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import { getSmashUpVariantSurfaceRelation, type SmashUpVariantSurface } from '../domain/variantBindings';
import { smashUpCriticalImageResolver } from '../criticalImageResolver';
import { FACTION_METADATA } from '../ui/factionMeta';

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

function physicalCardCount(cards: Array<{ count: number }>): number {
    return cards.reduce((total, card) => total + card.count, 0);
}

describe('动作英雄 POD 接入', () => {
    it('注册为 17 个唯一对象、20 张物理牌的独立牌组', () => {
        expect(ACTION_HEROES_POD_CARDS).toHaveLength(17);
        expect(physicalCardCount(ACTION_HEROES_POD_CARDS)).toBe(20);
        expect(ACTION_HEROES_POD_CARDS.filter(card => card.type === 'action').reduce((sum, card) => sum + card.count, 0)).toBe(14);
        expect(ACTION_HEROES_POD_CARDS.filter(card => card.type === 'minion').reduce((sum, card) => sum + card.count, 0)).toBe(6);
        expect(ACTION_HEROES_POD_CARDS.filter(card => card.type === 'minion').every(card => card.power === 5)).toBe(true);
        expect(getFactionCards(SMASHUP_FACTION_IDS.ACTION_HEROES_POD)).toHaveLength(17);
    });

    it('逐卡静态玩法合同与基础版一致，仅替换 POD 身份和图集', () => {
        for (const podCard of ACTION_HEROES_POD_CARDS) {
            const classicId = podCard.id.replace(/_pod$/, '');
            const classicCard = ACTION_HEROES_CARDS.find(card => card.id === classicId);
            expect(classicCard, `${podCard.id} 必须有基础版对应对象`).toBeDefined();

            const { id: _podId, faction: _podFaction, previewRef: _podPreview, ...podContract } = podCard;
            const { id: _classicId, faction: _classicFaction, previewRef: _classicPreview, ...classicContract } = classicCard!;
            expect(podContract, `${podCard.id} 的静态玩法字段必须与 ${classicId} 一致`).toEqual(classicContract);
        }
    });

    it('严格使用用户 4x5 图集的行优先槽位', () => {
        const slots = Object.fromEntries(
            ACTION_HEROES_POD_CARDS.map(card => [
                card.id,
                card.previewRef?.type === 'atlas' ? card.previewRef.index : -1,
            ]),
        );

        expect(slots).toEqual({
            action_heroes_all_out_of_bubblegum_pod: 0,
            action_heroes_get_to_the_choppa_pod: 2,
            action_heroes_slo_mo_attack_pod: 3,
            action_heroes_final_stand_pod: 4,
            action_heroes_hostage_rescue_pod: 5,
            action_heroes_walk_away_slowly_pod: 7,
            action_heroes_lone_wolf_pod: 8,
            action_heroes_friends_through_eternity_pod: 10,
            action_heroes_pushing_the_limit_pod: 11,
            action_heroes_the_right_person_pod: 12,
            action_heroes_collateral_damage_pod: 13,
            action_heroes_gracie_brones_pod: 14,
            action_heroes_commandbro_pod: 15,
            action_heroes_kickboxbro_pod: 16,
            action_heroes_robobro_pod: 17,
            action_heroes_warbro_pod: 18,
            action_heroes_rumbro_pod: 19,
        });

        expect(new Set(ACTION_HEROES_POD_CARDS.map(card => (
            card.previewRef?.type === 'atlas' ? card.previewRef.atlasId : null
        )))).toEqual(new Set([SMASHUP_ATLAS_IDS.ACTION_HEROES_POD_CARDS]));
    });

    it('注册 4x5 图集并由关键图片解析器预加载', () => {
        const atlas = SMASHUP_ATLAS_DEFINITIONS.find(def => def.id === SMASHUP_ATLAS_IDS.ACTION_HEROES_POD_CARDS);
        expect(atlas).toEqual({
            id: SMASHUP_ATLAS_IDS.ACTION_HEROES_POD_CARDS,
            kind: 'card',
            image: 'smashup/cards/action_heroes_pod',
            grid: { rows: 4, cols: 5 },
        });
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.ACTION_HEROES_POD_CARDS)).toBe('smashup/cards/action_heroes_pod');

        const resolved = smashUpCriticalImageResolver({
            sys: { phase: 'playCards' },
            core: {
                players: {
                    '0': { factions: [SMASHUP_FACTION_IDS.ACTION_HEROES_POD, SMASHUP_FACTION_IDS.TEENS] },
                },
            },
        }, undefined, '0');
        expect(resolved.critical).toContain('smashup/cards/action_heroes_pod');
        expect(resolved.critical).toContain('smashup/base/excellent_movies_teens_bases');
    });

    it('使用独立 POD 基地身份并显式共享玩法表面', () => {
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.ACTION_HEROES_POD]).sort()).toEqual([
            'base_building_rooftop_pod',
            'base_jungle_camp_pod',
        ]);

        for (const surface of sharedSurfaces) {
            expect(getSmashUpVariantSurfaceRelation(
                surface,
                'action_heroes_kickboxbro',
                SMASHUP_FACTION_IDS.ACTION_HEROES_POD,
            )).toBe('shared');
        }
        expect(getSmashUpVariantSurfaceRelation(
            'basePool',
            'action_heroes',
            SMASHUP_FACTION_IDS.ACTION_HEROES_POD,
        )).toBe('separate');
    });

    it('运行时生成代表性的 POD 能力别名', () => {
        if (abilityInitError) throw abilityInitError;
        const abilityKeys = getRegisteredAbilityKeys();
        expect(abilityKeys.has('action_heroes_all_out_of_bubblegum_pod::onPlay')).toBe(true);
        expect(abilityKeys.has('action_heroes_kickboxbro_pod::talent')).toBe(true);
        expect(abilityKeys.has('action_heroes_kickboxbro_pod::special')).toBe(true);
        expect(abilityKeys.has('action_heroes_walk_away_slowly_pod::special')).toBe(true);
    });

    it('基础版仅中文显示，POD 版面向全部语言', () => {
        const byId = new Map(FACTION_METADATA.map(meta => [meta.id, meta]));
        expect(byId.get(SMASHUP_FACTION_IDS.ACTION_HEROES)?.locales).toEqual(['zh-CN']);
        expect(byId.get(SMASHUP_FACTION_IDS.ACTION_HEROES_POD)?.locales).toBeUndefined();
    });
});
