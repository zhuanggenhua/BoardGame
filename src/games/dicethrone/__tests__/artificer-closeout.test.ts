import { describe, expect, it } from 'vitest';

import '../domain';
import { getCustomActionMeta } from '../domain/effects';
import { TOKEN_IDS } from '../domain/ids';
import { ARTIFICER_ABILITIES, TINKER_2, WRENCH_STRIKE_2, EUREKA_2, OVERCLOCK_2, SHOCK_BOT_3 } from '../heroes/artificer/abilities';
import { ARTIFICER_CARDS } from '../heroes/artificer/cards';
import { ARTIFICER_PASSIVE_ABILITIES, ARTIFICER_TOKENS } from '../heroes/artificer/tokens';

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

const expectExactPartition = (groups: Record<string, string[]>, expected: string[], scope: string) => {
    const owners = new Map<string, string>();

    for (const [groupName, ids] of Object.entries(groups)) {
        for (const id of ids) {
            const previous = owners.get(id);
            expect(previous, `${scope} 中的 ${id} 被重复归到 ${previous ?? '未知'} 和 ${groupName}`).toBeUndefined();
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

const asActionRecord = (owner: EffectOwner) =>
    (owner.effects ?? []).map((effect) => (effect.action ?? {}) as Record<string, unknown>);

const getOwnerEffects = (owner: EffectOwner) => [
    ...(owner.effects ?? []),
    ...((owner.variants ?? []).flatMap((variant) => variant.effects ?? [])),
];

const getCustomActionIds = (owner: EffectOwner): string[] =>
    [...new Set(
        getOwnerEffects(owner)
            .map((effect) => ((effect.action ?? {}) as Record<string, unknown>).customActionId)
            .filter((customActionId): customActionId is string => typeof customActionId === 'string'),
    )];

const findCard = (cardId: string) => {
    const card = ARTIFICER_CARDS.find((entry) => entry.id === cardId);
    expect(card, `未找到工匠卡牌 ${cardId}`).toBeDefined();
    return card!;
};

describe('DiceThrone 工匠 closeout gate', () => {
    it('工匠玩家板与专属手牌对象已全部纳入最终审计分组，没有 residual', () => {
        const abilityGroups = {
            offensiveAndUtilityCore: [
                'wrench-strike',
                'schematics',
                'eureka',
                'activate-bots',
                'overclock',
                'shock-bot',
                'maximum-power',
            ],
            passiveCore: ['collect-parts'],
            defenseCore: ['tinker'],
        };
        expectExactPartition(
            abilityGroups,
            ARTIFICER_ABILITIES.map((ability) => ability.id),
            '工匠玩家板能力',
        );

        const cardGroups = {
            bonusDieFamilies: [
                'card-artificer-masterpiece',
                'card-artificer-overdrive',
                'card-artificer-perfectly-calibrated',
            ],
            directStatusAndResponseFamilies: [
                'card-artificer-mechanical-strike',
                'card-artificer-voltage',
                'card-artificer-nano-attack',
                'upgrade-artificer-shock-bot-2',
            ],
            upgradeReplaceShells: [
                'upgrade-artificer-tinker-2',
                'upgrade-artificer-overclock-2',
                'upgrade-artificer-shock-bot-3',
                'upgrade-artificer-activate-bots-2',
                'upgrade-artificer-eureka-2',
                'upgrade-artificer-schematics-2',
                'upgrade-artificer-wrench-strike-2',
                'upgrade-artificer-collect-parts-2',
            ],
        };
        expectExactPartition(
            cardGroups,
            getHeroSpecificCards(ARTIFICER_CARDS),
            '工匠专属手牌',
        );

        for (const cardId of cardGroups.bonusDieFamilies) {
            const actions = asActionRecord(findCard(cardId));
            const hasInlineRoll = actions.some((action) => action.type === 'rollDie');
            const customActionId = actions.find((action) => action.type === 'custom')?.customActionId as string | undefined;
            const customCategories = customActionId ? getCustomActionMeta(customActionId)?.categories ?? [] : [];
            expect(
                hasInlineRoll || customCategories.includes('dice'),
                `${cardId} 应继续落在奖励骰家族`,
            ).toBe(true);
        }

        for (const cardId of cardGroups.upgradeReplaceShells) {
            expect(asActionRecord(findCard(cardId)).map((action) => action.type)).toEqual(['replaceAbility']);
        }

        expect(getCustomActionIds(findCard('upgrade-artificer-shock-bot-2'))).toEqual(['artificer-arc-shield']);
    });

    it('工匠状态、机器人与工坊动作已全部进入完成态对象集', () => {
        const tokenGroups = {
            synthAndNanobomb: ['synth', 'nanobomb'],
            robotCompanions: ['nanobot', 'shock_bot', 'heal_bot'],
        };
        expectExactPartition(
            tokenGroups,
            ARTIFICER_TOKENS.map((token) => token.id),
            '工匠状态与机器人',
        );

        expect(ARTIFICER_PASSIVE_ABILITIES.map((passive) => passive.id)).toEqual(['artificer-workshop']);
        expect(ARTIFICER_PASSIVE_ABILITIES[0]?.actions.map((action) => action.customActionId)).toEqual([
            'artificer-nanobot-detonate',
            'artificer-nanobot-detonate',
            'artificer-synth-inflict-nanobomb',
            'artificer-build-nanobot',
            'artificer-build-shock-bot',
            'artificer-build-heal-bot',
            'artificer-upgrade-nanobot',
            'artificer-upgrade-shock-bot',
            'artificer-upgrade-heal-bot',
        ]);
    });

    it('工匠关键 custom action seam 与 metadata 保持固定', () => {
        expect({
            'wrench-strike': getCustomActionIds(ARTIFICER_ABILITIES.find((ability) => ability.id === 'wrench-strike')!),
            'wrench-strike-2': getCustomActionIds(WRENCH_STRIKE_2),
            'eureka-2': getCustomActionIds(EUREKA_2),
            overclock: getCustomActionIds(ARTIFICER_ABILITIES.find((ability) => ability.id === 'overclock')!),
            'overclock-2': getCustomActionIds(OVERCLOCK_2),
            'shock-bot-3': getCustomActionIds(SHOCK_BOT_3),
            tinker: getCustomActionIds(ARTIFICER_ABILITIES.find((ability) => ability.id === 'tinker')!),
            'tinker-2': getCustomActionIds(TINKER_2),
            'card-artificer-perfectly-calibrated': getCustomActionIds(findCard('card-artificer-perfectly-calibrated')),
        }).toEqual({
            'wrench-strike': ['artificer-wrench-strike-branch'],
            'wrench-strike-2': ['artificer-wrench-strike-branch'],
            'eureka-2': ['artificer-build-from-scratch-choice'],
            overclock: ['artificer-activate-bots'],
            'overclock-2': ['artificer-activate-bots'],
            'shock-bot-3': ['artificer-activate-bots', 'artificer-mechanical-army'],
            tinker: ['artificer-tinker-defense'],
            'tinker-2': ['artificer-tinker-2-defense'],
            'card-artificer-perfectly-calibrated': ['artificer-perfectly-calibrated-roll'],
        });

        expect({
            'artificer-activate-bots': getCustomActionMeta('artificer-activate-bots')?.categories,
            'artificer-nanobot-detonate': getCustomActionMeta('artificer-nanobot-detonate')?.categories,
            'artificer-synth-inflict-nanobomb': getCustomActionMeta('artificer-synth-inflict-nanobomb')?.categories,
            'artificer-arc-shield': getCustomActionMeta('artificer-arc-shield')?.categories,
            'artificer-wrench-strike-branch': getCustomActionMeta('artificer-wrench-strike-branch')?.categories,
            'artificer-mechanical-army': getCustomActionMeta('artificer-mechanical-army')?.categories,
            'artificer-tinker-defense': getCustomActionMeta('artificer-tinker-defense')?.categories,
            'artificer-tinker-2-defense': getCustomActionMeta('artificer-tinker-2-defense')?.categories,
            'artificer-build-from-scratch-choice': getCustomActionMeta('artificer-build-from-scratch-choice')?.categories,
            'artificer-heal-bot-use': getCustomActionMeta('artificer-heal-bot-use')?.categories,
            'artificer-perfectly-calibrated-roll': getCustomActionMeta('artificer-perfectly-calibrated-roll')?.categories,
            'artificer-build-nanobot': getCustomActionMeta('artificer-build-nanobot')?.categories,
            'artificer-upgrade-heal-bot': getCustomActionMeta('artificer-upgrade-heal-bot')?.categories,
        }).toEqual({
            'artificer-activate-bots': ['choice', 'damage', 'defense', 'dice', 'status', 'token'],
            'artificer-nanobot-detonate': ['damage', 'status', 'token'],
            'artificer-synth-inflict-nanobomb': ['status', 'token'],
            'artificer-arc-shield': ['defense', 'token'],
            'artificer-wrench-strike-branch': ['dice', 'damage', 'token'],
            'artificer-mechanical-army': ['damage'],
            'artificer-tinker-defense': ['defense', 'status', 'token'],
            'artificer-tinker-2-defense': ['damage', 'defense', 'status', 'token'],
            'artificer-build-from-scratch-choice': ['choice', 'token'],
            'artificer-heal-bot-use': ['dice', 'defense', 'token'],
            'artificer-perfectly-calibrated-roll': ['dice', 'token'],
            'artificer-build-nanobot': ['token'],
            'artificer-upgrade-heal-bot': ['token'],
        });
    });

    it('工匠工坊被动动作的资源门禁保持固定', () => {
        const workshop = ARTIFICER_PASSIVE_ABILITIES[0]!;

        expect(workshop.actions[0]).toMatchObject({
            customActionId: 'artificer-nanobot-detonate',
            timing: 'ownUpkeepPhase',
            tokenCosts: [
                { tokenId: TOKEN_IDS.NANOBOT, amount: 1 },
                { tokenId: TOKEN_IDS.SYNTH, amount: 2 },
            ],
        });
        expect(workshop.actions[1]).toMatchObject({
            customActionId: 'artificer-nanobot-detonate',
            timing: 'ownUpkeepPhase',
            tokenCosts: [
                { tokenId: TOKEN_IDS.NANOBOT, amount: 1 },
                { tokenId: TOKEN_IDS.SYNTH, amount: 1 },
            ],
        });
        expect(workshop.actions[2]).toMatchObject({
            customActionId: 'artificer-synth-inflict-nanobomb',
            timing: 'anytime',
            tokenCost: { tokenId: TOKEN_IDS.SYNTH, amount: 4 },
        });
    });
});
