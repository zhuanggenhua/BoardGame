import { describe, expect, it } from 'vitest';

import { getCustomActionMeta } from '../domain/effects';
import { STATUS_IDS } from '../domain/ids';
import {
    CURSED_PIRATE_ABILITIES,
    CURSED_PIRATE_HUMAN_ABILITIES,
} from '../heroes/cursed_pirate/abilities';
import { CURSED_PIRATE_CARDS } from '../heroes/cursed_pirate/cards';
import { ZHANSHUJIA_ABILITIES } from '../heroes/zhanshujia/abilities';
import { ZHANSHUJIA_CARDS } from '../heroes/zhanshujia/cards';

type EffectOwner = {
    id: string;
    effects?: Array<{
        action?: unknown;
    }>;
    variants?: Array<{
        id: string;
        effects?: Array<{
            action?: unknown;
        }>;
    }>;
};

const asActionRecord = (owner: EffectOwner) =>
    (owner.effects ?? []).map((effect) => (effect.action ?? {}) as Record<string, unknown>);

const expectExactPartition = (groups: Record<string, string[]>, expected: string[], scope: string) => {
    const owners = new Map<string, string>();

    for (const [groupName, ids] of Object.entries(groups)) {
        for (const id of ids) {
            const previous = owners.get(id);
            expect(
                previous,
                `${scope} 中的 ${id} 被重复归到 ${previous ?? '未知'} 和 ${groupName}`,
            ).toBeUndefined();
            owners.set(id, groupName);
        }
    }

    expect([...owners.keys()].sort(), `${scope} 分组后仍有遗漏或漂移`).toEqual([...expected].sort());
};

const getHeroSpecificCards = <T extends { id: string; sourceAtlasIndex?: number }>(cards: T[]) => (
    cards
        .filter((card) => card.sourceAtlasIndex !== undefined)
        .map((card) => card.id)
);

const findCard = (cardId: string) => {
    const card = CURSED_PIRATE_CARDS.find((entry) => entry.id === cardId)
        ?? ZHANSHUJIA_CARDS.find((entry) => entry.id === cardId);
    expect(card, `未找到卡牌 ${cardId}`).toBeDefined();
    return card!;
};

const getOwnerEffects = (owner: EffectOwner) => [
    ...(owner.effects ?? []),
    ...((owner.variants ?? []).flatMap((variant) => variant.effects ?? [])),
];

const getDirectGrantedStatusIds = (owner: EffectOwner): string[] => {
    const statusIds: string[] = [];

    for (const effect of getOwnerEffects(owner)) {
        const action = (effect.action ?? {}) as Record<string, unknown>;
        if (action.type === 'grantStatus') {
            statusIds.push(String(action.statusId));
            continue;
        }

        if (action.type !== 'rollDie') continue;
        const conditionalEffects = (action.conditionalEffects ?? []) as Array<Record<string, unknown>>;
        for (const conditionalEffect of conditionalEffects) {
            const grantStatus = conditionalEffect.grantStatus as Record<string, unknown> | undefined;
            if (grantStatus?.statusId) {
                statusIds.push(String(grantStatus.statusId));
            }
        }
    }

    return [...new Set(statusIds)];
};

const getStatusWriterIds = (owners: EffectOwner[], statusId: string): string[] =>
    owners
        .filter((owner) => getDirectGrantedStatusIds(owner).includes(statusId))
        .map((owner) => owner.id)
        .sort();

const getCustomActionIds = (owner: EffectOwner): string[] =>
    getOwnerEffects(owner)
        .map((effect) => ((effect.action ?? {}) as Record<string, unknown>).customActionId)
        .filter((customActionId): customActionId is string => typeof customActionId === 'string');

describe('DiceThrone 战术家 / 咒缚海盗 closeout gate', () => {
    it('战术家玩家板与专属手牌对象已全部纳入最终审计分组，没有 residual', () => {
        const abilityGroups = {
            attackAndUtilityCore: [
                'sabre-thrust',
                'carpet-bombing',
                'war-monger',
                'drum-movement',
                'flanking',
                'expand-battlefield',
                'strategic-shift',
                'high-ground',
            ],
            defenseCore: ['countermeasures'],
        };
        expectExactPartition(
            abilityGroups,
            ZHANSHUJIA_ABILITIES.map((ability) => ability.id),
            '战术家玩家板能力',
        );

        const cardGroups = {
            bonusDieAndResponseFamilies: [
                'card-zhanshujia-gain-the-upper-hand',
                'card-zhanshujia-disengage',
                'card-zhanshujia-war-room',
            ],
            tokenStatusChoiceFamilies: [
                'card-zhanshujia-ambush',
                'card-zhanshujia-tactical-retreat',
                'card-zhanshujia-strategic-defense',
            ],
            upgradeReplaceShells: [
                'upgrade-zhanshujia-countermeasures-3',
                'upgrade-zhanshujia-countermeasures-2',
                'upgrade-zhanshujia-strategic-shift-2',
                'upgrade-zhanshujia-expand-battlefield-2',
                'upgrade-zhanshujia-flanking-2',
                'upgrade-zhanshujia-drum-movement-2',
                'upgrade-zhanshujia-carpet-bombing-2',
                'upgrade-zhanshujia-war-monger-2',
                'upgrade-zhanshujia-sabre-thrust-2',
            ],
        };
        expectExactPartition(
            cardGroups,
            getHeroSpecificCards(ZHANSHUJIA_CARDS),
            '战术家专属手牌',
        );

        for (const cardId of cardGroups.bonusDieAndResponseFamilies) {
            const actions = asActionRecord(findCard(cardId));
            const hasInlineRoll = actions.some((action) => action.type === 'rollDie');
            const customActionId = actions.find((action) => action.type === 'custom')?.customActionId as string | undefined;
            const customCategories = customActionId ? getCustomActionMeta(customActionId)?.categories ?? [] : [];
            expect(
                hasInlineRoll || customCategories.includes('dice'),
                `${cardId} 应继续落在奖励骰/响应家族`,
            ).toBe(true);
        }

        for (const cardId of cardGroups.upgradeReplaceShells) {
            expect(asActionRecord(findCard(cardId)).map((action) => action.type)).toEqual(['replaceAbility']);
        }
    });

    it('咒缚海盗双面 18 个玩家板对象已全部进入 face-by-face completion audit 分组', () => {
        const faceGroups = {
            cursedFace: [
                'soul-stab',
                'marked-for-death',
                'cursed',
                'deep-sea-dive',
                'breath-of-death',
                'soul-command',
                'undead-claw',
                'still-wet-behind-ears',
                'merciless-curse',
            ],
            humanFace: [
                'cutlass-stab',
                'make-your-mark',
                'human-cursed',
                'walk-the-plank',
                'light-the-fuse',
                'verdict-command',
                'astonishing',
                'human-still-wet-behind-ears',
                'merciless-plunder',
            ],
        };
        expectExactPartition(
            faceGroups,
            [
                ...CURSED_PIRATE_ABILITIES.map((ability) => ability.id),
                ...CURSED_PIRATE_HUMAN_ABILITIES.map((ability) => ability.id),
            ],
            '咒缚海盗双面玩家板能力',
        );
    });

    it('咒缚海盗 16 张专属手牌已全部纳入 family closeout 分组，没有未归档对象', () => {
        const cardGroups = {
            bonusDieAndRandomFamilies: [
                'card-cursed-pirate-weigh-anchor',
                'card-cursed-pirate-flay',
                'card-cursed-pirate-bluster',
                'card-cursed-pirate-crows-nest',
                'card-cursed-pirate-hefty',
                'card-cursed-pirate-sip',
            ],
            choiceAndContinuationFamilies: [
                'card-cursed-pirate-curse-card',
                'card-cursed-pirate-batten-down',
                'card-cursed-pirate-ransom',
                'card-cursed-pirate-pirates-life',
                'card-cursed-pirate-go-fish',
            ],
            directDamageStatusResourceFamilies: [
                'card-cursed-pirate-shark-bait',
                'card-cursed-pirate-scurvy',
                'card-cursed-pirate-pillage',
                'card-cursed-pirate-parley',
                'card-cursed-pirate-give-me-some',
            ],
        };
        expectExactPartition(
            cardGroups,
            getHeroSpecificCards(CURSED_PIRATE_CARDS),
            '咒缚海盗专属手牌',
        );

        for (const cardId of cardGroups.bonusDieAndRandomFamilies) {
            const actions = asActionRecord(findCard(cardId));
            const hasInlineRoll = actions.some((action) => action.type === 'rollDie');
            const customActionId = actions.find((action) => action.type === 'custom')?.customActionId as string | undefined;
            const customCategories = customActionId ? getCustomActionMeta(customActionId)?.categories ?? [] : [];
            expect(
                hasInlineRoll || customCategories.includes('dice'),
                `${cardId} 应继续落在奖励骰/随机家族`,
            ).toBe(true);
        }
    });

    it('咒缚海盗状态与双面续结对象已全部进入最终审计桶，不再留未分类 residual', () => {
        const statusAndContinuationGroups = {
            cursedCoinLifecycle: [
                'marked-for-death',
                'make-your-mark',
                'merciless-curse',
                'still-wet-behind-ears',
                'verdict-command',
                'human-still-wet-behind-ears',
                'merciless-plunder',
                'card-cursed-pirate-pirates-life',
            ],
            powderKegLifecycle: [
                'soul-stab',
                'breath-of-death',
                'merciless-curse',
                'cutlass-stab',
                'light-the-fuse',
                'merciless-plunder',
                'card-cursed-pirate-bluster',
                'card-cursed-pirate-flay',
                'card-cursed-pirate-go-fish',
                'card-cursed-pirate-give-me-some',
                'card-cursed-pirate-sip',
            ],
            witherAndParleyLifecycle: [
                'cursed',
                'deep-sea-dive',
                'soul-command',
                'verdict-command',
                'card-cursed-pirate-weigh-anchor',
                'card-cursed-pirate-scurvy',
                'card-cursed-pirate-parley',
            ],
            dualFaceContinuation: [
                'human-cursed',
                'astonishing',
                'human-still-wet-behind-ears',
                'card-cursed-pirate-pirates-life',
            ],
        };

        for (const ids of Object.values(statusAndContinuationGroups)) {
            for (const id of ids) {
                const exists = CURSED_PIRATE_ABILITIES.some((ability) => ability.id === id)
                    || CURSED_PIRATE_HUMAN_ABILITIES.some((ability) => ability.id === id)
                    || CURSED_PIRATE_CARDS.some((card) => card.id === id);
                expect(exists, `${id} 未进入咒缚海盗当前 closeout 对象集`).toBe(true);
            }
        }
    });

    it('咒缚海盗状态家族的 direct writer 集合保持固定，不再只靠 prose 记忆', () => {
        const allOwners: EffectOwner[] = [
            ...CURSED_PIRATE_ABILITIES,
            ...CURSED_PIRATE_HUMAN_ABILITIES,
            ...CURSED_PIRATE_CARDS,
        ];

        expect(getStatusWriterIds(allOwners, STATUS_IDS.CURSED_COIN)).toEqual([
            'make-your-mark',
            'marked-for-death',
            'merciless-curse',
        ]);
        expect(getStatusWriterIds(allOwners, STATUS_IDS.POWDER_KEG)).toEqual([
            'breath-of-death',
            'card-cursed-pirate-bluster',
            'card-cursed-pirate-give-me-some',
            'light-the-fuse',
            'soul-command',
        ]);
        expect(getStatusWriterIds(allOwners, STATUS_IDS.WITHER)).toEqual([
            'breath-of-death',
            'card-cursed-pirate-scurvy',
            'deep-sea-dive',
            'merciless-curse',
            'soul-command',
        ]);
        expect(getStatusWriterIds(allOwners, STATUS_IDS.PARLEY)).toEqual([
            'card-cursed-pirate-parley',
            'card-cursed-pirate-weigh-anchor',
            'merciless-curse',
            'soul-command',
        ]);
    });

    it('咒缚海盗状态/双面续结 custom action seam 与 metadata 保持固定', () => {
        expect({
            'human-cursed': getCustomActionIds(CURSED_PIRATE_HUMAN_ABILITIES.find((ability) => ability.id === 'human-cursed')!),
            'verdict-command': getCustomActionIds(CURSED_PIRATE_HUMAN_ABILITIES.find((ability) => ability.id === 'verdict-command')!),
            astonishing: getCustomActionIds(CURSED_PIRATE_HUMAN_ABILITIES.find((ability) => ability.id === 'astonishing')!),
            'human-still-wet-behind-ears': getCustomActionIds(CURSED_PIRATE_HUMAN_ABILITIES.find((ability) => ability.id === 'human-still-wet-behind-ears')!),
            'merciless-plunder': getCustomActionIds(CURSED_PIRATE_HUMAN_ABILITIES.find((ability) => ability.id === 'merciless-plunder')!),
            'still-wet-behind-ears': getCustomActionIds(CURSED_PIRATE_ABILITIES.find((ability) => ability.id === 'still-wet-behind-ears')!),
            'card-cursed-pirate-pirates-life': getCustomActionIds(findCard('card-cursed-pirate-pirates-life')),
            'card-cursed-pirate-go-fish': getCustomActionIds(findCard('card-cursed-pirate-go-fish')),
            'card-cursed-pirate-sip': getCustomActionIds(findCard('card-cursed-pirate-sip')),
            'card-cursed-pirate-flay': getCustomActionIds(findCard('card-cursed-pirate-flay')),
        }).toEqual({
            'human-cursed': ['cursed-pirate-human-cursed-end-turn'],
            'verdict-command': ['cursed-pirate-human-verdict-command'],
            astonishing: ['cursed-pirate-human-remove-cursed-coins-choice'],
            'human-still-wet-behind-ears': ['cursed-pirate-human-defense'],
            'merciless-plunder': ['cursed-pirate-human-merciless-plunder'],
            'still-wet-behind-ears': ['cursed-pirate-still-wet-behind-ears-defense'],
            'card-cursed-pirate-pirates-life': ['cursed-pirate-pirates-life'],
            'card-cursed-pirate-go-fish': ['cursed-pirate-go-fish-powder-keg-targets'],
            'card-cursed-pirate-sip': ['cursed-pirate-sip-choice'],
            'card-cursed-pirate-flay': ['cursed-pirate-flay-roll'],
        });

        expect({
            'cursed-pirate-human-cursed-end-turn': getCustomActionMeta('cursed-pirate-human-cursed-end-turn')?.categories,
            'cursed-pirate-human-remove-cursed-coins-choice': getCustomActionMeta('cursed-pirate-human-remove-cursed-coins-choice')?.categories,
            'cursed-pirate-human-verdict-command': getCustomActionMeta('cursed-pirate-human-verdict-command')?.categories,
            'cursed-pirate-human-merciless-plunder': getCustomActionMeta('cursed-pirate-human-merciless-plunder')?.categories,
            'cursed-pirate-human-defense': getCustomActionMeta('cursed-pirate-human-defense')?.categories,
            'cursed-pirate-still-wet-behind-ears-defense': getCustomActionMeta('cursed-pirate-still-wet-behind-ears-defense')?.categories,
            'cursed-pirate-go-fish-powder-keg-targets': getCustomActionMeta('cursed-pirate-go-fish-powder-keg-targets')?.categories,
            'cursed-pirate-sip-choice': getCustomActionMeta('cursed-pirate-sip-choice')?.categories,
            'cursed-pirate-flay-roll': getCustomActionMeta('cursed-pirate-flay-roll')?.categories,
            'cursed-pirate-pirates-life': getCustomActionMeta('cursed-pirate-pirates-life')?.categories,
        }).toEqual({
            'cursed-pirate-human-cursed-end-turn': ['status', 'passive'],
            'cursed-pirate-human-remove-cursed-coins-choice': ['choice', 'status'],
            'cursed-pirate-human-verdict-command': ['choice', 'status', 'damage'],
            'cursed-pirate-human-merciless-plunder': ['choice', 'status'],
            'cursed-pirate-human-defense': ['damage', 'defense', 'resource', 'status'],
            'cursed-pirate-still-wet-behind-ears-defense': ['damage', 'defense', 'resource', 'status'],
            'cursed-pirate-go-fish-powder-keg-targets': ['choice', 'status'],
            'cursed-pirate-sip-choice': ['choice', 'status', 'dice'],
            'cursed-pirate-flay-roll': ['dice', 'damage', 'status'],
            'cursed-pirate-pirates-life': ['card', 'status'],
        });
    });
});
