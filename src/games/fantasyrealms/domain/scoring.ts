import type { GameOverResult, PlayerId } from '../../../engine/types';
import { OFFICIAL_FANTASY_REALMS_CARDS } from '../data/cards';
import type { FantasyRealmsScoreLine, FantasyRealmsSuit, TableCard } from '../foundation';

type EffectiveCard = {
    instanceId: string;
    sourceId: string;
    sourceCard: TableCard;
    effectiveName: string;
    effectiveSuit: FantasyRealmsSuit;
    baseScore: number;
    toneClass: string;
    bonusRuleId?: string;
    penaltyRuleId?: string;
};

type EvaluationCandidate = {
    totalScore: number;
    activeBaseScore: number;
    totalBonus: number;
    totalPenalty: number;
    tiebreakBaseScore: number;
    extraCardId?: string;
};

export type FantasyRealmsScoreEvaluation = EvaluationCandidate & {
    scoreBreakdown: FantasyRealmsScoreLine[];
};

const CARD_BY_ID = new Map(OFFICIAL_FANTASY_REALMS_CARDS.map((card) => [card.id, card]));

const SHAPESHIFTER_ALLOWED_SUITS = new Set<FantasyRealmsSuit>(['神器', '领袖', '法师', '武器', '巨兽']);
const MIRAGE_ALLOWED_SUITS = new Set<FantasyRealmsSuit>(['军队', '土地', '天象', '洪流', '烈焰']);
const NECROMANCER_ALLOWED_SUITS = new Set<FantasyRealmsSuit>(['军队', '领袖', '法师', '巨兽']);
const GEM_OF_ORDER_BONUS_BY_RUN: Record<number, number> = {
    3: 10,
    4: 30,
    5: 60,
    6: 100,
    7: 150,
};

const WILDFIRE_ALLOWED_SUITS = new Set<FantasyRealmsSuit>(['烈焰', '天象', '法师', '武器', '神器']);
const WILDFIRE_ALLOWED_NAMES = new Set(['Great Flood', 'Island', 'Mountain', 'Unicorn', 'Dragon']);

const SCORE_CACHE = new Map<string, FantasyRealmsScoreEvaluation>();

function getCardById(cardId: string): TableCard {
    const card = CARD_BY_ID.get(cardId);
    if (!card) {
        throw new Error(`Unknown Fantasy Realms card: ${cardId}`);
    }
    return { ...card };
}

function buildCacheKey(hand: readonly TableCard[], discardPile: readonly TableCard[]): string {
    const handKey = [...hand].map((card) => card.id).sort().join(',');
    const discardKey = [...discardPile].map((card) => card.id).sort().join(',');
    return `${handKey}::${discardKey}`;
}

function buildBaseEffectiveCard(card: TableCard, instanceId = card.id): EffectiveCard {
    return {
        instanceId,
        sourceId: card.id,
        sourceCard: { ...card },
        effectiveName: card.name,
        effectiveSuit: card.suit,
        baseScore: card.score,
        toneClass: card.toneClass,
        bonusRuleId: card.id,
        penaltyRuleId: hasPenaltySection(card.id) ? card.id : undefined,
    };
}

function hasPenaltySection(cardId: string): boolean {
    return new Set([
        'army-dwarvish-infantry',
        'army-light-cavalry',
        'army-celestial-knights',
        'beast-dragon',
        'beast-basilisk',
        'flood-swamp',
        'flood-great-flood',
        'leader-empress',
        'weapon-warship',
        'weapon-war-dirigible',
        'weather-rainstorm',
        'weather-smoke',
        'weather-blizzard',
        'wizard-warlock-lord',
    ]).has(cardId);
}

function isShapeshifter(cardId: string): boolean {
    return cardId === 'wild-shapeshifter';
}

function isMirage(cardId: string): boolean {
    return cardId === 'wild-mirage';
}

function isDoppelganger(cardId: string): boolean {
    return cardId === 'wild-doppelganger';
}

function isBookOfChanges(cardId: string): boolean {
    return cardId === 'artifact-book-of-changes';
}

function isIsland(cardId: string): boolean {
    return cardId === 'flood-island';
}

function hasSourceCard(cards: readonly EffectiveCard[], sourceId: string): boolean {
    return cards.some((card) => card.sourceId === sourceId);
}

function buildEffectiveCards(
    hand: readonly TableCard[],
    shapeshifterTargetId?: string,
    mirageTargetId?: string,
): EffectiveCard[] {
    return hand.map((card) => {
        if (isShapeshifter(card.id) && shapeshifterTargetId) {
            const target = getCardById(shapeshifterTargetId);
            return {
                ...buildBaseEffectiveCard(card),
                effectiveName: target.name,
                effectiveSuit: target.suit,
                baseScore: 0,
                bonusRuleId: undefined,
                penaltyRuleId: undefined,
            };
        }

        if (isMirage(card.id) && mirageTargetId) {
            const target = getCardById(mirageTargetId);
            return {
                ...buildBaseEffectiveCard(card),
                effectiveName: target.name,
                effectiveSuit: target.suit,
                baseScore: 0,
                bonusRuleId: undefined,
                penaltyRuleId: undefined,
            };
        }

        return buildBaseEffectiveCard(card);
    });
}

function applyDoppelganger(
    cards: readonly EffectiveCard[],
    targetInstanceId?: string,
): EffectiveCard[] {
    if (!targetInstanceId) return cards.map((card) => ({ ...card }));

    const target = cards.find((card) => card.instanceId === targetInstanceId);
    if (!target) return cards.map((card) => ({ ...card }));

    return cards.map((card) => {
        if (!isDoppelganger(card.sourceId)) {
            return { ...card };
        }

        return {
            ...card,
            effectiveName: target.effectiveName,
            effectiveSuit: target.effectiveSuit,
            baseScore: target.baseScore,
            bonusRuleId: undefined,
            penaltyRuleId: target.penaltyRuleId,
        };
    });
}

function applyBookOfChanges(
    cards: readonly EffectiveCard[],
    bookTargetInstanceId?: string,
    bookSuit?: FantasyRealmsSuit,
): EffectiveCard[] {
    if (!bookTargetInstanceId || !bookSuit) {
        return cards.map((card) => ({ ...card }));
    }

    return cards.map((card) => card.instanceId === bookTargetInstanceId
        ? { ...card, effectiveSuit: bookSuit }
        : { ...card });
}

function getShapeshifterChoices(hand: readonly TableCard[]): Array<string | undefined> {
    if (!hand.some((card) => isShapeshifter(card.id))) return [undefined];
    const ids = OFFICIAL_FANTASY_REALMS_CARDS
        .filter((card) => SHAPESHIFTER_ALLOWED_SUITS.has(card.suit))
        .map((card) => card.id);
    return [undefined, ...ids];
}

function getMirageChoices(hand: readonly TableCard[]): Array<string | undefined> {
    if (!hand.some((card) => isMirage(card.id))) return [undefined];
    const ids = OFFICIAL_FANTASY_REALMS_CARDS
        .filter((card) => MIRAGE_ALLOWED_SUITS.has(card.suit))
        .map((card) => card.id);
    return [undefined, ...ids];
}

function getDoppelgangerChoices(cards: readonly EffectiveCard[]): Array<string | undefined> {
    if (!cards.some((card) => isDoppelganger(card.sourceId))) return [undefined];
    const ids = cards
        .filter((card) => !isDoppelganger(card.sourceId))
        .map((card) => card.instanceId);
    return [undefined, ...ids];
}

function getBookOfChangesChoices(cards: readonly EffectiveCard[]): Array<{ targetInstanceId?: string; suit?: FantasyRealmsSuit }> {
    if (!hasSourceCard(cards, 'artifact-book-of-changes')) return [{ targetInstanceId: undefined, suit: undefined }];

    const suits: FantasyRealmsSuit[] = ['军队', '神器', '巨兽', '烈焰', '洪流', '土地', '领袖', '武器', '天象', '野牌', '法师'];
    const choices: Array<{ targetInstanceId?: string; suit?: FantasyRealmsSuit }> = [{ targetInstanceId: undefined, suit: undefined }];

    cards.forEach((card) => {
        if (isBookOfChanges(card.sourceId)) return;
        suits.forEach((suit) => {
            if (card.effectiveSuit !== suit) {
                choices.push({ targetInstanceId: card.instanceId, suit });
            }
        });
    });

    return choices;
}

function getNecromancerExtraChoices(hand: readonly TableCard[], discardPile: readonly TableCard[]): Array<TableCard | undefined> {
    if (!hand.some((card) => card.id === 'wizard-necromancer')) return [undefined];

    const candidates = discardPile
        .filter((card) => NECROMANCER_ALLOWED_SUITS.has(card.suit))
        .map((card) => ({ ...card }));

    return [undefined, ...candidates];
}

function getIslandTargetChoices(cards: readonly EffectiveCard[]): Array<string | undefined> {
    if (!hasSourceCard(cards, 'flood-island')) return [undefined];

    const ids = cards
        .filter((card) => card.effectiveSuit === '洪流' || card.effectiveSuit === '烈焰')
        .map((card) => card.instanceId);

    return [undefined, ...ids];
}

function isPenaltyCleared(card: EffectiveCard, allCards: readonly EffectiveCard[], islandTargetId?: string): boolean {
    if (hasSourceCard(allCards, 'artifact-protection-rune')) return true;
    if (hasSourceCard(allCards, 'land-underground-caverns') && card.effectiveSuit === '天象') return true;
    if (hasSourceCard(allCards, 'land-mountain') && card.effectiveSuit === '洪流') return true;
    if (hasSourceCard(allCards, 'wizard-beastmaster') && card.effectiveSuit === '巨兽') return true;
    if (islandTargetId && card.instanceId === islandTargetId) return true;
    return false;
}

function isArmyWordCleared(card: EffectiveCard, allCards: readonly EffectiveCard[]): boolean {
    if (hasSourceCard(allCards, 'army-rangers')) return true;
    if (hasSourceCard(allCards, 'weapon-warship') && card.effectiveSuit === '洪流') return true;
    return false;
}

function hasActiveSuit(activeCards: readonly EffectiveCard[], suit: FantasyRealmsSuit): boolean {
    return activeCards.some((card) => card.effectiveSuit === suit);
}

function hasActiveName(activeCards: readonly EffectiveCard[], name: string): boolean {
    return activeCards.some((card) => card.effectiveName === name);
}

function countActiveSuit(activeCards: readonly EffectiveCard[], suit: FantasyRealmsSuit): number {
    return activeCards.filter((card) => card.effectiveSuit === suit).length;
}

function countActiveName(activeCards: readonly EffectiveCard[], name: string): number {
    return activeCards.filter((card) => card.effectiveName === name).length;
}

function isSelfBlanked(card: EffectiveCard, activeCards: readonly EffectiveCard[], allCards: readonly EffectiveCard[], islandTargetId?: string): boolean {
    if (isPenaltyCleared(card, allCards, islandTargetId)) return false;

    switch (card.penaltyRuleId) {
        case 'beast-dragon':
            return !hasActiveSuit(activeCards, '法师');
        case 'weather-smoke':
            return !hasActiveSuit(activeCards, '烈焰');
        case 'weapon-warship':
            return !hasActiveSuit(activeCards, '洪流');
        case 'weapon-war-dirigible':
            return !hasActiveSuit(activeCards, '军队') || hasActiveSuit(activeCards, '天象');
        default:
            return false;
    }
}

function isWildfireBlanked(card: EffectiveCard, activeWildfireSources: readonly EffectiveCard[]): boolean {
    if (activeWildfireSources.length === 0) return false;
    return !WILDFIRE_ALLOWED_SUITS.has(card.effectiveSuit) && !WILDFIRE_ALLOWED_NAMES.has(card.effectiveName);
}

function hasAttackEffect(card: EffectiveCard, allCards: readonly EffectiveCard[], islandTargetId?: string): boolean {
    if (card.sourceId === 'flame-wildfire') return true;
    if (isPenaltyCleared(card, allCards, islandTargetId)) return false;
    return card.penaltyRuleId === 'beast-basilisk'
        || card.penaltyRuleId === 'flood-great-flood'
        || card.penaltyRuleId === 'weather-rainstorm'
        || card.penaltyRuleId === 'weather-blizzard';
}

function sourceAttacksTarget(
    source: EffectiveCard,
    target: EffectiveCard,
    allCards: readonly EffectiveCard[],
    islandTargetId?: string,
): boolean {
    if (source.sourceId === 'flame-wildfire') {
        return !WILDFIRE_ALLOWED_SUITS.has(target.effectiveSuit) && !WILDFIRE_ALLOWED_NAMES.has(target.effectiveName);
    }

    switch (source.penaltyRuleId) {
        case 'beast-basilisk':
            return target.effectiveSuit === '军队'
                || target.effectiveSuit === '领袖'
                || target.effectiveSuit === '巨兽';
        case 'flood-great-flood':
            if (target.effectiveSuit === '土地' && target.effectiveName !== 'Mountain') return true;
            if (target.effectiveSuit === '烈焰' && target.effectiveName !== 'Lightning') return true;
            if (target.effectiveSuit === '军队' && !isArmyWordCleared(source, allCards)) return true;
            return false;
        case 'weather-rainstorm':
            return target.effectiveSuit === '烈焰' && target.effectiveName !== 'Lightning';
        case 'weather-blizzard':
            return target.effectiveSuit === '洪流';
        default:
            return false;
    }
}

function resolveAcceptedAttackSources(cards: readonly EffectiveCard[], islandTargetId?: string): EffectiveCard[] {
    const attackSources = cards.filter((card) => hasAttackEffect(card, cards, islandTargetId));
    const accepted = new Set<string>();
    const rejected = new Set<string>();

    while (true) {
        const newlyAccepted = attackSources.filter((card) => {
            if (accepted.has(card.instanceId) || rejected.has(card.instanceId)) return false;
            const attackers = attackSources.filter((attacker) => (
                attacker.instanceId !== card.instanceId
                && sourceAttacksTarget(attacker, card, cards, islandTargetId)
            ));
            return attackers.every((attacker) => rejected.has(attacker.instanceId));
        });

        if (newlyAccepted.length === 0) {
            break;
        }

        newlyAccepted.forEach((card) => {
            accepted.add(card.instanceId);
            attackSources.forEach((target) => {
                if (target.instanceId !== card.instanceId && sourceAttacksTarget(card, target, cards, islandTargetId)) {
                    rejected.add(target.instanceId);
                }
            });
        });
    }

    return attackSources.filter((card) => accepted.has(card.instanceId));
}

function getActiveCards(cards: readonly EffectiveCard[], islandTargetId?: string): EffectiveCard[] {
    const acceptedAttackSources = resolveAcceptedAttackSources(cards, islandTargetId);
    const wildfireSources = acceptedAttackSources.filter((card) => card.sourceId === 'flame-wildfire');
    const attackedIds = new Set<string>();

    acceptedAttackSources.forEach((source) => {
        cards.forEach((target) => {
            if (source.instanceId !== target.instanceId && sourceAttacksTarget(source, target, cards, islandTargetId)) {
                attackedIds.add(target.instanceId);
            }
        });
    });

    let activeCards = cards.filter((card) => (
        !attackedIds.has(card.instanceId)
        && (
            acceptedAttackSources.some((source) => source.instanceId === card.instanceId)
            || !hasAttackEffect(card, cards, islandTargetId)
        )
    ));

    while (true) {
        const nextActiveCards = activeCards.filter((card) => (
            !isWildfireBlanked(card, wildfireSources)
            && !isSelfBlanked(card, activeCards, cards, islandTargetId)
        ));

        if (nextActiveCards.length === activeCards.length) {
            return nextActiveCards;
        }

        activeCards = nextActiveCards;
    }
}

function computeLongestRun(baseScores: readonly number[]): number {
    const sorted = [...new Set(baseScores)].sort((a, b) => a - b);
    let longest = 1;
    let current = 1;

    for (let index = 1; index < sorted.length; index += 1) {
        if (sorted[index] === sorted[index - 1] + 1) {
            current += 1;
            longest = Math.max(longest, current);
        } else {
            current = 1;
        }
    }

    return longest;
}

function computeCollectorBonus(activeCards: readonly EffectiveCard[]): number {
    const suitToNames = new Map<FantasyRealmsSuit, Set<string>>();

    activeCards.forEach((card) => {
        const names = suitToNames.get(card.effectiveSuit) ?? new Set<string>();
        names.add(card.effectiveName);
        suitToNames.set(card.effectiveSuit, names);
    });

    const maxCount = Math.max(0, ...[...suitToNames.values()].map((names) => names.size));
    if (maxCount >= 5) return 100;
    if (maxCount >= 4) return 40;
    if (maxCount >= 3) return 10;
    return 0;
}

function computeBonus(card: EffectiveCard, activeCards: readonly EffectiveCard[]): number {
    switch (card.bonusRuleId) {
        case 'army-rangers':
            return 10 * countActiveSuit(activeCards, '土地');
        case 'army-elven-archers':
            return countActiveSuit(activeCards, '天象') === 0 ? 5 : 0;
        case 'artifact-world-tree': {
            const suits = new Set(activeCards.map((entry) => entry.effectiveSuit));
            return suits.size === activeCards.length ? 50 : 0;
        }
        case 'artifact-shield-of-keth':
            return hasActiveSuit(activeCards, '领袖') && hasActiveName(activeCards, 'Sword of Keth')
                ? 40
                : hasActiveSuit(activeCards, '领袖') ? 15 : 0;
        case 'artifact-gem-of-order': {
            const longestRun = computeLongestRun(activeCards.map((entry) => entry.baseScore));
            return GEM_OF_ORDER_BONUS_BY_RUN[Math.min(longestRun, 7)] ?? 0;
        }
        case 'beast-warhorse':
            return hasActiveSuit(activeCards, '领袖') || hasActiveSuit(activeCards, '法师') ? 14 : 0;
        case 'beast-unicorn':
            if (hasActiveName(activeCards, 'Princess')) return 30;
            return ['Empress', 'Queen', 'Elemental Enchantress'].some((name) => hasActiveName(activeCards, name)) ? 15 : 0;
        case 'beast-hydra':
            return hasActiveName(activeCards, 'Swamp') ? 28 : 0;
        case 'flame-candle':
            return hasActiveName(activeCards, 'Book of Changes')
                && hasActiveName(activeCards, 'Bell Tower')
                && hasActiveSuit(activeCards, '法师')
                ? 100
                : 0;
        case 'flame-fire-elemental':
            return 15 * Math.max(0, countActiveSuit(activeCards, '烈焰') - 1);
        case 'flame-forge':
            return 9 * (countActiveSuit(activeCards, '武器') + countActiveSuit(activeCards, '神器'));
        case 'flame-lightning':
            return hasActiveName(activeCards, 'Rainstorm') ? 30 : 0;
        case 'flood-fountain-of-life': {
            const eligible = activeCards
                .filter((entry) => ['武器', '洪流', '烈焰', '土地', '天象'].includes(entry.effectiveSuit))
                .map((entry) => entry.baseScore);
            return eligible.length > 0 ? Math.max(...eligible) : 0;
        }
        case 'flood-water-elemental':
            return 15 * Math.max(0, countActiveSuit(activeCards, '洪流') - 1);
        case 'land-earth-elemental':
            return 15 * Math.max(0, countActiveSuit(activeCards, '土地') - 1);
        case 'land-underground-caverns':
            return hasActiveName(activeCards, 'Dwarvish Infantry') || hasActiveName(activeCards, 'Dragon') ? 25 : 0;
        case 'land-forest':
            return 12 * (countActiveSuit(activeCards, '巨兽') + countActiveName(activeCards, 'Elven Archers'));
        case 'land-bell-tower':
            return hasActiveSuit(activeCards, '法师') ? 15 : 0;
        case 'land-mountain':
            return hasActiveName(activeCards, 'Smoke') && hasActiveName(activeCards, 'Wildfire') ? 50 : 0;
        case 'leader-princess':
            return 8 * (
                countActiveSuit(activeCards, '军队')
                + countActiveSuit(activeCards, '法师')
                + Math.max(0, countActiveSuit(activeCards, '领袖') - 1)
            );
        case 'leader-warlord':
            return activeCards
                .filter((entry) => entry.effectiveSuit === '军队')
                .reduce((sum, entry) => sum + entry.baseScore, 0);
        case 'leader-queen':
            return (hasActiveName(activeCards, 'King') ? 20 : 5) * countActiveSuit(activeCards, '军队');
        case 'leader-king':
            return (hasActiveName(activeCards, 'Queen') ? 20 : 5) * countActiveSuit(activeCards, '军队');
        case 'leader-empress':
            return 10 * countActiveSuit(activeCards, '军队');
        case 'weapon-magic-wand':
            return hasActiveSuit(activeCards, '法师') ? 25 : 0;
        case 'weapon-elven-longbow':
            return ['Elven Archers', 'Warlord', 'Beastmaster'].some((name) => hasActiveName(activeCards, name)) ? 30 : 0;
        case 'weapon-sword-of-keth':
            return hasActiveSuit(activeCards, '领袖') && hasActiveName(activeCards, 'Shield of Keth')
                ? 40
                : hasActiveSuit(activeCards, '领袖') ? 10 : 0;
        case 'weather-air-elemental':
            return 15 * Math.max(0, countActiveSuit(activeCards, '天象') - 1);
        case 'weather-rainstorm':
            return 10 * countActiveSuit(activeCards, '洪流');
        case 'weather-whirlwind':
            return hasActiveName(activeCards, 'Rainstorm')
                && (hasActiveName(activeCards, 'Blizzard') || hasActiveName(activeCards, 'Great Flood'))
                ? 40
                : 0;
        case 'wizard-elemental-enchantress':
            return 5 * (
                countActiveSuit(activeCards, '土地')
                + countActiveSuit(activeCards, '天象')
                + countActiveSuit(activeCards, '洪流')
                + countActiveSuit(activeCards, '烈焰')
            );
        case 'wizard-collector':
            return computeCollectorBonus(activeCards);
        case 'wizard-beastmaster':
            return 9 * countActiveSuit(activeCards, '巨兽');
        default:
            return 0;
    }
}

function computePenalty(card: EffectiveCard, activeCards: readonly EffectiveCard[]): number {
    if (!card.penaltyRuleId) return 0;

    const armyComponentEnabled = !isArmyWordCleared(card, activeCards);

    switch (card.penaltyRuleId) {
        case 'army-dwarvish-infantry':
            return armyComponentEnabled ? 2 * Math.max(0, countActiveSuit(activeCards, '军队') - 1) : 0;
        case 'army-light-cavalry':
            return 2 * countActiveSuit(activeCards, '土地');
        case 'army-celestial-knights':
            return hasActiveSuit(activeCards, '领袖') ? 0 : 8;
        case 'beast-dragon':
            return hasActiveSuit(activeCards, '法师') ? 0 : 40;
        case 'flood-swamp':
            return 3 * (
                (armyComponentEnabled ? countActiveSuit(activeCards, '军队') : 0)
                + countActiveSuit(activeCards, '烈焰')
            );
        case 'leader-empress':
            return 5 * Math.max(0, countActiveSuit(activeCards, '领袖') - 1);
        case 'weather-blizzard':
            return 5 * (
                (armyComponentEnabled ? countActiveSuit(activeCards, '军队') : 0)
                + countActiveSuit(activeCards, '领袖')
                + countActiveSuit(activeCards, '巨兽')
                + countActiveSuit(activeCards, '烈焰')
            );
        case 'wizard-warlock-lord':
            return 10 * (countActiveSuit(activeCards, '领袖') + Math.max(0, countActiveSuit(activeCards, '法师') - 1));
        default:
            return 0;
    }
}

function evaluateFixedCards(cards: readonly EffectiveCard[], islandTargetId?: string, extraCardId?: string): EvaluationCandidate {
    const activeCards = getActiveCards(cards, islandTargetId);
    const activeBaseScore = activeCards.reduce((sum, card) => sum + card.baseScore, 0);

    const totalBonus = activeCards.reduce((sum, card) => sum + computeBonus(card, activeCards), 0);
    const totalPenalty = activeCards.reduce((sum, card) => {
        if (isPenaltyCleared(card, cards, islandTargetId)) return sum;
        return sum + computePenalty(card, activeCards);
    }, 0);

    return {
        totalScore: activeBaseScore + totalBonus - totalPenalty,
        activeBaseScore,
        totalBonus,
        totalPenalty,
        tiebreakBaseScore: cards.reduce((sum, card) => sum + card.baseScore, 0),
        extraCardId,
    };
}

function compareCandidates(a: EvaluationCandidate | null, b: EvaluationCandidate): EvaluationCandidate {
    if (!a) return b;
    if (b.totalScore !== a.totalScore) return b.totalScore > a.totalScore ? b : a;
    if (b.tiebreakBaseScore !== a.tiebreakBaseScore) return b.tiebreakBaseScore < a.tiebreakBaseScore ? b : a;
    if (b.activeBaseScore !== a.activeBaseScore) return b.activeBaseScore > a.activeBaseScore ? b : a;
    return a;
}

function findBestScoreCandidate(hand: readonly TableCard[], discardPile: readonly TableCard[]): EvaluationCandidate {
    let best: EvaluationCandidate | null = null;

    for (const necromancerExtra of getNecromancerExtraChoices(hand, discardPile)) {
        const handWithExtra = necromancerExtra ? [...hand, necromancerExtra] : [...hand];

        for (const shapeshifterTargetId of getShapeshifterChoices(handWithExtra)) {
            for (const mirageTargetId of getMirageChoices(handWithExtra)) {
                const baseCards = buildEffectiveCards(handWithExtra, shapeshifterTargetId, mirageTargetId);

                for (const doppelTargetId of getDoppelgangerChoices(baseCards)) {
                    const withDoppel = applyDoppelganger(baseCards, doppelTargetId);

                    for (const bookChoice of getBookOfChangesChoices(withDoppel)) {
                        const withBook = applyBookOfChanges(withDoppel, bookChoice.targetInstanceId, bookChoice.suit);

                        for (const islandTargetId of getIslandTargetChoices(withBook)) {
                            best = compareCandidates(best, evaluateFixedCards(
                                withBook,
                                islandTargetId,
                                necromancerExtra?.id,
                            ));
                        }
                    }
                }
            }
        }
    }

    return best ?? {
        totalScore: 0,
        activeBaseScore: 0,
        totalBonus: 0,
        totalPenalty: 0,
        tiebreakBaseScore: 0,
    };
}

export function evaluateFantasyRealmsScore(
    hand: readonly TableCard[],
    discardPile: readonly TableCard[],
): FantasyRealmsScoreEvaluation {
    const cacheKey = buildCacheKey(hand, discardPile);
    const cached = SCORE_CACHE.get(cacheKey);
    if (cached) {
        return {
            ...cached,
            scoreBreakdown: cached.scoreBreakdown.map((line) => ({ ...line })),
        };
    }

    const best = findBestScoreCandidate(hand, discardPile);
    const evaluation: FantasyRealmsScoreEvaluation = {
        ...best,
        scoreBreakdown: [
            { label: '有效基础分', value: best.activeBaseScore },
            { label: '总加分', value: best.totalBonus },
            { label: '总减分', value: -best.totalPenalty },
        ],
    };

    SCORE_CACHE.set(cacheKey, {
        ...evaluation,
        scoreBreakdown: evaluation.scoreBreakdown.map((line) => ({ ...line })),
    });

    return evaluation;
}

export function resolveFantasyRealmsWinner(
    playerIds: readonly PlayerId[],
    handsByPlayer: Record<PlayerId, readonly TableCard[]>,
    discardPile: readonly TableCard[],
): GameOverResult {
    const evaluations = playerIds.map((playerId) => ({
        playerId,
        evaluation: evaluateFantasyRealmsScore(handsByPlayer[playerId] ?? [], discardPile),
    }));

    const scores = Object.fromEntries(evaluations.map(({ playerId, evaluation }) => [playerId, evaluation.totalScore]));
    const highestScore = Math.max(...evaluations.map(({ evaluation }) => evaluation.totalScore));
    const topScorers = evaluations.filter(({ evaluation }) => evaluation.totalScore === highestScore);

    if (topScorers.length === 1) {
        return { winner: topScorers[0]!.playerId, scores };
    }

    const bestTiebreak = Math.min(...topScorers.map(({ evaluation }) => evaluation.tiebreakBaseScore));
    const tiebreakWinners = topScorers.filter(({ evaluation }) => evaluation.tiebreakBaseScore === bestTiebreak);

    if (tiebreakWinners.length === 1) {
        return { winner: tiebreakWinners[0]!.playerId, scores };
    }

    return {
        draw: true,
        winners: tiebreakWinners.map(({ playerId }) => playerId),
        scores,
    };
}
