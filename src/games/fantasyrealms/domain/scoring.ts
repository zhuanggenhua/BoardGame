import type { GameOverResult, PlayerId } from '../../../engine/types';
import { ALL_FANTASY_REALMS_CARDS, OFFICIAL_FANTASY_REALMS_CARDS } from '../data/cards';
import {
    createRuntimeDeck,
    getFantasyRealmsCardDisplayName,
    type FantasyRealmsScoreCardDelta,
    type FantasyRealmsScoreLine,
    type FantasyRealmsSuit,
    type TableCard,
} from '../foundation';
import type { FantasyRealmsRuntimeSetupConfig } from '../roomSetup';

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
    cardDeltas: FantasyRealmsScoreCardDelta[];
};

type ScoringSetup = {
    cursedHoardSuitsEnabled: boolean;
    playerCount: number;
};

export type FantasyRealmsScoreEvaluation = EvaluationCandidate & {
    scoreBreakdown: FantasyRealmsScoreLine[];
};

export type FantasyRealmsScoreOptions = {
    setupConfig?: Pick<FantasyRealmsRuntimeSetupConfig, 'cursedHoardSuitsEnabled'> | null;
    playerCount?: number;
};

const CARD_BY_ID = new Map<string, TableCard>(ALL_FANTASY_REALMS_CARDS.map((card) => [card.id, card]));
const BASE_RUNTIME_SUITS: FantasyRealmsSuit[] = ['军队', '神器', '巨兽', '烈焰', '洪流', '土地', '领袖', '武器', '天象', '野牌', '法师'];
const CURSED_HOARD_RUNTIME_SUITS: FantasyRealmsSuit[] = [...BASE_RUNTIME_SUITS, '建筑', '局外人', '不死族'];
const SHAPESHIFTER_ALLOWED_BASE_SUITS = new Set<FantasyRealmsSuit>(['神器', '领袖', '法师', '武器', '巨兽']);
const SHAPESHIFTER_ALLOWED_CURSED_SUITS = new Set<FantasyRealmsSuit>(['神器', '领袖', '法师', '武器', '巨兽', '不死族']);
const MIRAGE_ALLOWED_BASE_SUITS = new Set<FantasyRealmsSuit>(['军队', '土地', '天象', '洪流', '烈焰']);
const MIRAGE_ALLOWED_CURSED_SUITS = new Set<FantasyRealmsSuit>(['军队', '建筑', '土地', '天象', '洪流', '烈焰']);
const BASE_NECROMANCER_ALLOWED_SUITS = new Set<FantasyRealmsSuit>(['军队', '领袖', '法师', '巨兽']);
const CURSED_NECROMANCER_ALLOWED_SUITS = new Set<FantasyRealmsSuit>(['军队', '领袖', '法师', '巨兽', '不死族']);
const WILDFIRE_ALLOWED_SUITS = new Set<FantasyRealmsSuit>(['烈焰', '天象', '法师', '武器', '神器', '野牌']);
const WILDFIRE_ALLOWED_NAMES = new Set(['Great Flood', 'Island', 'Mountain', 'Unicorn', 'Dragon']);
const CURSED_HOARD_INDICATOR_IDS = new Set<string>([
    'land-garden',
    'building-bell-tower-ch',
    'flood-fountain-of-life-ch',
    'flood-great-flood-ch',
    'army-rangers-ch',
    'wizard-necromancer-ch',
    'artifact-world-tree-ch',
    'wild-shapeshifter-ch',
    'wild-mirage-ch',
]);
const CURSED_HOARD_NEW_SUITS = new Set<FantasyRealmsSuit>(['建筑', '局外人', '不死族']);
const GEM_OF_ORDER_BONUS_BY_RUN: Record<number, number> = {
    3: 10,
    4: 30,
    5: 60,
    6: 100,
    7: 150,
};
const SCORE_CACHE = new Map<string, FantasyRealmsScoreEvaluation>();

function buildRuntimeCatalog(setup: ScoringSetup): readonly TableCard[] {
    return setup.cursedHoardSuitsEnabled
        ? createRuntimeDeck({ cursedHoardSuitsEnabled: true })
        : OFFICIAL_FANTASY_REALMS_CARDS;
}

function buildCacheKey(hand: readonly TableCard[], discardPile: readonly TableCard[], setup: ScoringSetup): string {
    const handKey = [...hand].map((card) => card.id).sort().join(',');
    const discardKey = [...discardPile].map((card) => card.id).sort().join(',');
    return `${setup.cursedHoardSuitsEnabled ? 'ch' : 'base'}:${setup.playerCount}:${handKey}::${discardKey}`;
}

function resolveScoringSetup(
    hand: readonly TableCard[],
    discardPile: readonly TableCard[],
    options?: FantasyRealmsScoreOptions,
): ScoringSetup {
    const cursedHoardSuitsEnabled = options?.setupConfig?.cursedHoardSuitsEnabled === true
        || [...hand, ...discardPile].some((card) => CURSED_HOARD_INDICATOR_IDS.has(card.id) || CURSED_HOARD_NEW_SUITS.has(card.suit));
    return {
        cursedHoardSuitsEnabled,
        playerCount: Math.max(2, Math.floor(options?.playerCount ?? 2)),
    };
}

function getCardById(cardId: string): TableCard {
    const card = CARD_BY_ID.get(cardId);
    if (!card) {
        throw new Error(`Unknown Fantasy Realms card: ${cardId}`);
    }
    return { ...card };
}

function hasPenaltySection(cardId: string): boolean {
    return new Set([
        'army-dwarvish-infantry',
        'army-light-cavalry',
        'army-celestial-knights',
        'beast-dragon',
        'beast-basilisk',
        'flame-wildfire',
        'flood-swamp',
        'flood-great-flood',
        'leader-empress',
        'weapon-warship',
        'weapon-war-dirigible',
        'weather-rainstorm',
        'weather-smoke',
        'weather-blizzard',
        'wizard-warlock-lord',
        'building-crypt',
        'land-garden',
        'outsider-demon',
        'flood-great-flood-ch',
    ]).has(cardId);
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

function isShapeshifter(cardId: string): boolean {
    return cardId === 'wild-shapeshifter' || cardId === 'wild-shapeshifter-ch';
}

function isMirage(cardId: string): boolean {
    return cardId === 'wild-mirage' || cardId === 'wild-mirage-ch';
}

function isDoppelganger(cardId: string): boolean {
    return cardId === 'wild-doppelganger';
}

function isBookOfChanges(cardId: string): boolean {
    return cardId === 'artifact-book-of-changes';
}

function isAngel(cardId: string): boolean {
    return cardId === 'outsider-angel';
}

function hasSourceCard(cards: readonly EffectiveCard[], sourceId: string): boolean {
    return cards.some((card) => card.sourceId === sourceId);
}

function buildEffectiveCards(
    hand: readonly TableCard[],
    shapeshifterTargetId: string | undefined,
    mirageTargetId: string | undefined,
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

function applyDoppelganger(cards: readonly EffectiveCard[], targetInstanceId?: string): EffectiveCard[] {
    if (!targetInstanceId) {
        return cards.map((card) => ({ ...card }));
    }

    const target = cards.find((card) => card.instanceId === targetInstanceId);
    if (!target) {
        return cards.map((card) => ({ ...card }));
    }

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

function getShapeshifterChoices(hand: readonly TableCard[], setup: ScoringSetup): Array<string | undefined> {
    const shapeshifter = hand.find((card) => isShapeshifter(card.id));
    if (!shapeshifter) return [undefined];

    const allowedSuits = shapeshifter.id === 'wild-shapeshifter-ch'
        ? SHAPESHIFTER_ALLOWED_CURSED_SUITS
        : SHAPESHIFTER_ALLOWED_BASE_SUITS;

    return [
        undefined,
        ...buildRuntimeCatalog(setup)
            .filter((card) => allowedSuits.has(card.suit))
            .map((card) => card.id),
    ];
}

function getMirageChoices(hand: readonly TableCard[], setup: ScoringSetup): Array<string | undefined> {
    const mirage = hand.find((card) => isMirage(card.id));
    if (!mirage) return [undefined];

    const allowedSuits = mirage.id === 'wild-mirage-ch'
        ? MIRAGE_ALLOWED_CURSED_SUITS
        : MIRAGE_ALLOWED_BASE_SUITS;

    return [
        undefined,
        ...buildRuntimeCatalog(setup)
            .filter((card) => allowedSuits.has(card.suit))
            .map((card) => card.id),
    ];
}

function getDoppelgangerChoices(cards: readonly EffectiveCard[]): Array<string | undefined> {
    if (!cards.some((card) => isDoppelganger(card.sourceId))) return [undefined];
    return [
        undefined,
        ...cards
            .filter((card) => !isDoppelganger(card.sourceId))
            .map((card) => card.instanceId),
    ];
}

function getBookOfChangesChoices(
    cards: readonly EffectiveCard[],
    setup: ScoringSetup,
): Array<{ targetInstanceId?: string; suit?: FantasyRealmsSuit }> {
    if (!hasSourceCard(cards, 'artifact-book-of-changes')) {
        return [{ targetInstanceId: undefined, suit: undefined }];
    }

    const suits = setup.cursedHoardSuitsEnabled ? CURSED_HOARD_RUNTIME_SUITS : BASE_RUNTIME_SUITS;
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

function getNecromancerExtraChoices(
    hand: readonly TableCard[],
    discardPile: readonly TableCard[],
): Array<TableCard | undefined> {
    const allowedSuits = new Set<FantasyRealmsSuit>();
    if (hand.some((card) => card.id === 'wizard-necromancer')) {
        BASE_NECROMANCER_ALLOWED_SUITS.forEach((suit) => allowedSuits.add(suit));
    }
    if (hand.some((card) => card.id === 'wizard-necromancer-ch')) {
        CURSED_NECROMANCER_ALLOWED_SUITS.forEach((suit) => allowedSuits.add(suit));
    }
    if (allowedSuits.size === 0) {
        return [undefined];
    }

    return [
        undefined,
        ...discardPile
            .filter((card) => allowedSuits.has(card.suit))
            .map((card) => ({ ...card })),
    ];
}

function getIslandTargetChoices(cards: readonly EffectiveCard[]): Array<string | undefined> {
    if (!hasSourceCard(cards, 'flood-island')) return [undefined];

    return [
        undefined,
        ...cards
            .filter((card) => card.effectiveSuit === '洪流' || card.effectiveSuit === '烈焰')
            .map((card) => card.instanceId),
    ];
}

function getAngelTargetChoices(cards: readonly EffectiveCard[]): Array<string | undefined> {
    if (!hasSourceCard(cards, 'outsider-angel')) return [undefined];
    return [
        undefined,
        ...cards
            .filter((card) => !isAngel(card.sourceId))
            .map((card) => card.instanceId),
    ];
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
    if (hasSourceCard(allCards, 'army-rangers') || hasSourceCard(allCards, 'army-rangers-ch')) return true;
    if (hasSourceCard(allCards, 'weapon-warship') && card.effectiveSuit === '洪流') return true;
    return false;
}

function hasBlankingImmunity(
    card: EffectiveCard,
    allCards: readonly EffectiveCard[],
    angelTargetId?: string,
): boolean {
    return (card.effectiveSuit === '不死族' && (hasSourceCard(allCards, 'undead-lich') || hasSourceCard(allCards, 'wizard-necromancer-ch')))
        || isAngel(card.sourceId)
        || (angelTargetId != null && angelTargetId === card.instanceId);
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

function isSelfBlanked(
    card: EffectiveCard,
    activeCards: readonly EffectiveCard[],
    allCards: readonly EffectiveCard[],
    islandTargetId?: string,
): boolean {
    if (hasBlankingImmunity(card, allCards)) return false;
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
        case 'land-garden':
            return hasActiveSuit(activeCards, '不死族')
                || hasActiveName(activeCards, 'Necromancer')
                || hasActiveName(activeCards, 'Demon');
        default:
            return false;
    }
}

function hasAttackEffect(card: EffectiveCard, allCards: readonly EffectiveCard[], islandTargetId?: string): boolean {
    if (isPenaltyCleared(card, allCards, islandTargetId)) return false;
    return card.penaltyRuleId === 'beast-basilisk'
        || card.penaltyRuleId === 'building-crypt'
        || card.penaltyRuleId === 'flame-wildfire'
        || card.penaltyRuleId === 'flood-great-flood'
        || card.penaltyRuleId === 'flood-great-flood-ch'
        || card.penaltyRuleId === 'weather-rainstorm'
        || card.penaltyRuleId === 'weather-blizzard';
}

function sourceAttacksTarget(
    source: EffectiveCard,
    target: EffectiveCard,
    allCards: readonly EffectiveCard[],
): boolean {
    switch (source.penaltyRuleId) {
        case 'beast-basilisk':
            return target.effectiveSuit === '军队'
                || target.effectiveSuit === '领袖'
                || (target.effectiveSuit === '巨兽' && target.instanceId !== source.instanceId);
        case 'building-crypt':
            return target.effectiveSuit === '领袖';
        case 'flame-wildfire':
            return !WILDFIRE_ALLOWED_SUITS.has(target.effectiveSuit) && !WILDFIRE_ALLOWED_NAMES.has(target.effectiveName);
        case 'flood-great-flood':
            if (target.effectiveSuit === '土地' && target.effectiveName !== 'Mountain') return true;
            if (target.effectiveSuit === '烈焰' && target.effectiveName !== 'Lightning') return true;
            if (target.effectiveSuit === '军队' && !isArmyWordCleared(source, allCards)) return true;
            return false;
        case 'flood-great-flood-ch':
            if (target.effectiveSuit === '建筑') return true;
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

function resolveDemonBlankedIds(
    cards: readonly EffectiveCard[],
    angelTargetId?: string,
): Set<string> {
    const blankedIds = new Set<string>();
    const demonSources = cards.filter((card) => card.penaltyRuleId === 'outsider-demon' && !isPenaltyCleared(card, cards));

    demonSources.forEach((source) => {
        cards.forEach((target) => {
            if (target.instanceId === source.instanceId) return;
            if (target.effectiveSuit === '局外人') return;
            if (hasBlankingImmunity(target, cards, angelTargetId)) return;
            const suitCount = cards.filter((candidate) => candidate.effectiveSuit === target.effectiveSuit).length;
            if (suitCount === 1) {
                blankedIds.add(target.instanceId);
            }
        });
    });

    return blankedIds;
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
                && sourceAttacksTarget(attacker, card, cards)
            ));
            return attackers.every((attacker) => rejected.has(attacker.instanceId));
        });

        if (newlyAccepted.length === 0) {
            break;
        }

        newlyAccepted.forEach((card) => {
            accepted.add(card.instanceId);
            attackSources.forEach((target) => {
                if (target.instanceId !== card.instanceId && sourceAttacksTarget(card, target, cards)) {
                    rejected.add(target.instanceId);
                }
            });
        });
    }

    return attackSources.filter((card) => accepted.has(card.instanceId));
}

function getActiveCards(
    cards: readonly EffectiveCard[],
    islandTargetId?: string,
    angelTargetId?: string,
): EffectiveCard[] {
    const demonBlankedIds = resolveDemonBlankedIds(cards, angelTargetId);
    const cardsAfterDemon = cards.filter((card) => !demonBlankedIds.has(card.instanceId));
    const acceptedAttackSources = resolveAcceptedAttackSources(cardsAfterDemon, islandTargetId);
    const attackedIds = new Set<string>();

    acceptedAttackSources.forEach((source) => {
        cardsAfterDemon.forEach((target) => {
            if (
                source.instanceId !== target.instanceId
                && sourceAttacksTarget(source, target, cardsAfterDemon)
                && !hasBlankingImmunity(target, cardsAfterDemon, angelTargetId)
            ) {
                attackedIds.add(target.instanceId);
            }
        });
    });

    let activeCards = cardsAfterDemon.filter((card) => (
        !attackedIds.has(card.instanceId)
        && (
            acceptedAttackSources.some((source) => source.instanceId === card.instanceId)
            || !hasAttackEffect(card, cardsAfterDemon, islandTargetId)
        )
    ));

    while (true) {
        const nextActiveCards = activeCards.filter((card) => !isSelfBlanked(card, activeCards, cardsAfterDemon, islandTargetId));
        if (nextActiveCards.length === activeCards.length) {
            return nextActiveCards;
        }
        activeCards = nextActiveCards;
    }
}

function computeGemOfOrderBonus(baseScores: readonly number[]): number {
    const strengths = [...baseScores].sort((left, right) => left - right);
    let bonus = 0;
    let runFound = false;

    do {
        const run: number[] = [];
        for (let index = 0; index < strengths.length; index += 1) {
            const strength = strengths[index];
            if (run.length !== 0 && strength === run[run.length - 1] + 1) {
                run.push(strength);
            } else if (run.length < 3 && !run.includes(strength)) {
                run.splice(0, run.length, strength);
            }
        }

        if (run.length < 3) {
            runFound = false;
        } else {
            runFound = true;
            run.forEach((value) => {
                const matchIndex = strengths.indexOf(value);
                if (matchIndex >= 0) {
                    strengths.splice(matchIndex, 1);
                }
            });
            bonus += GEM_OF_ORDER_BONUS_BY_RUN[Math.min(run.length, 7)] ?? 0;
        }
    } while (runFound);

    return bonus;
}

function computeCollectorBonus(activeCards: readonly EffectiveCard[]): number {
    const suitToNames = new Map<FantasyRealmsSuit, Set<string>>();

    activeCards.forEach((card) => {
        const names = suitToNames.get(card.effectiveSuit) ?? new Set<string>();
        names.add(card.effectiveName);
        suitToNames.set(card.effectiveSuit, names);
    });

    let bonus = 0;
    suitToNames.forEach((names) => {
        if (names.size === 3) bonus += 10;
        else if (names.size === 4) bonus += 40;
        else if (names.size >= 5) bonus += 100;
    });
    return bonus;
}

function computeBonus(
    card: EffectiveCard,
    activeCards: readonly EffectiveCard[],
    allCards: readonly EffectiveCard[],
    discardPile: readonly TableCard[],
    setup: ScoringSetup,
    islandTargetId?: string,
): number {
    switch (card.bonusRuleId) {
        case 'army-rangers':
            return 10 * countActiveSuit(activeCards, '土地');
        case 'army-rangers-ch':
            return 10 * (countActiveSuit(activeCards, '土地') + countActiveSuit(activeCards, '建筑'));
        case 'army-elven-archers':
            return countActiveSuit(activeCards, '天象') === 0 ? 5 : 0;
        case 'artifact-world-tree': {
            const suits = new Set(activeCards.map((entry) => entry.effectiveSuit));
            return suits.size === activeCards.length ? 50 : 0;
        }
        case 'artifact-world-tree-ch': {
            const suits = new Set(activeCards.map((entry) => entry.effectiveSuit));
            return suits.size === activeCards.length ? 70 : 0;
        }
        case 'artifact-shield-of-keth':
            return hasActiveSuit(activeCards, '领袖') && hasActiveName(activeCards, 'Sword of Keth')
                ? 40
                : hasActiveSuit(activeCards, '领袖') ? 15 : 0;
        case 'artifact-gem-of-order':
            return computeGemOfOrderBonus(activeCards.map((entry) => entry.baseScore));
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
        case 'flood-fountain-of-life-ch': {
            const eligible = activeCards
                .filter((entry) => ['建筑', '武器', '洪流', '烈焰', '土地', '天象'].includes(entry.effectiveSuit))
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
        case 'building-bell-tower-ch':
            return hasActiveSuit(activeCards, '法师') || hasActiveSuit(activeCards, '不死族') ? 15 : 0;
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
        case 'building-dungeon': {
            const suitBonus = (suit: FantasyRealmsSuit) => {
                const count = countActiveSuit(activeCards, suit);
                return count > 0 ? 10 + ((count - 1) * 5) : 0;
            };
            return suitBonus('不死族')
                + suitBonus('巨兽')
                + suitBonus('神器')
                + (countActiveName(activeCards, 'Necromancer') * 5)
                + (countActiveName(activeCards, 'Warlock Lord') * 5)
                + (countActiveName(activeCards, 'Demon') * 5);
        }
        case 'building-castle': {
            const otherBuildings = Math.max(0, countActiveSuit(activeCards, '建筑') - 1);
            return (hasActiveSuit(activeCards, '领袖') ? 10 : 0)
                + (hasActiveSuit(activeCards, '军队') ? 10 : 0)
                + (hasActiveSuit(activeCards, '土地') ? 10 : 0)
                + (otherBuildings > 0 ? 10 + ((otherBuildings - 1) * 5) : 0);
        }
        case 'building-crypt':
            return activeCards
                .filter((entry) => entry.effectiveSuit === '不死族')
                .reduce((sum, entry) => sum + entry.baseScore, 0);
        case 'building-chapel': {
            const count = countActiveSuit(activeCards, '领袖')
                + countActiveSuit(activeCards, '法师')
                + countActiveSuit(activeCards, '局外人')
                + countActiveSuit(activeCards, '不死族');
            return count === 2 ? 40 : 0;
        }
        case 'land-garden':
            return 11 * (countActiveSuit(activeCards, '领袖') + countActiveSuit(activeCards, '巨兽'));
        case 'outsider-genie':
            return 10 * Math.max(0, setup.playerCount - 1);
        case 'outsider-judge':
            return activeCards.filter((entry) => entry.penaltyRuleId && !isPenaltyCleared(entry, allCards, islandTargetId)).length * 10;
        case 'undead-dark-queen':
            return 5 * (
                discardPile.filter((entry) => entry.suit === '土地').length
                + discardPile.filter((entry) => entry.suit === '洪流').length
                + discardPile.filter((entry) => entry.suit === '烈焰').length
                + discardPile.filter((entry) => entry.suit === '天象').length
            ) + (discardPile.some((entry) => entry.name === 'Unicorn') ? 5 : 0);
        case 'undead-ghoul':
            return 4 * discardPile.filter((entry) => ['法师', '领袖', '军队', '巨兽', '不死族'].includes(entry.suit)).length;
        case 'undead-specter':
            return 6 * discardPile.filter((entry) => ['法师', '神器', '局外人'].includes(entry.suit)).length;
        case 'undead-lich':
            return (hasActiveName(activeCards, 'Necromancer') ? 10 : 0) + (10 * Math.max(0, countActiveSuit(activeCards, '不死族') - 1));
        case 'undead-death-knight':
            return 7 * discardPile.filter((entry) => entry.suit === '武器' || entry.suit === '军队').length;
        default:
            return 0;
    }
}

function computePenalty(card: EffectiveCard, activeCards: readonly EffectiveCard[], allCards: readonly EffectiveCard[]): number {
    if (!card.penaltyRuleId) return 0;
    const armyComponentEnabled = !isArmyWordCleared(card, allCards);

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

function buildCardDeltas(
    cards: readonly EffectiveCard[],
    activeCards: readonly EffectiveCard[],
    discardPile: readonly TableCard[],
    setup: ScoringSetup,
    originalHandIds: ReadonlySet<string>,
    islandTargetId?: string,
): FantasyRealmsScoreCardDelta[] {
    const activeInstanceIds = new Set(activeCards.map((card) => card.instanceId));

    return cards.map((card) => {
        const isActive = activeInstanceIds.has(card.instanceId);
        const baseScore = isActive ? card.baseScore : 0;
        const bonus = isActive ? computeBonus(card, activeCards, cards, discardPile, setup, islandTargetId) : 0;
        const penalty = isActive && !isPenaltyCleared(card, cards, islandTargetId)
            ? computePenalty(card, activeCards, cards)
            : 0;

        return {
            cardId: card.sourceId,
            label: getFantasyRealmsCardDisplayName(card.sourceCard),
            baseScore,
            bonus,
            penalty,
            totalDelta: baseScore + bonus - penalty,
            isVirtual: !originalHandIds.has(card.instanceId),
        };
    });
}

function evaluateFixedCards(
    cards: readonly EffectiveCard[],
    discardPile: readonly TableCard[],
    setup: ScoringSetup,
    originalHandIds: ReadonlySet<string>,
    islandTargetId?: string,
    angelTargetId?: string,
    extraCardId?: string,
): EvaluationCandidate {
    const activeCards = getActiveCards(cards, islandTargetId, angelTargetId);
    const activeBaseScore = activeCards.reduce((sum, card) => sum + card.baseScore, 0);
    const totalBonus = activeCards.reduce((sum, card) => sum + computeBonus(card, activeCards, cards, discardPile, setup, islandTargetId), 0);
    const totalPenalty = activeCards.reduce((sum, card) => {
        if (isPenaltyCleared(card, cards, islandTargetId)) return sum;
        return sum + computePenalty(card, activeCards, cards);
    }, 0);

    return {
        totalScore: activeBaseScore + totalBonus - totalPenalty,
        activeBaseScore,
        totalBonus,
        totalPenalty,
        tiebreakBaseScore: cards.reduce((sum, card) => sum + card.baseScore, 0),
        extraCardId,
        cardDeltas: buildCardDeltas(cards, activeCards, discardPile, setup, originalHandIds, islandTargetId),
    };
}

function compareCandidates(currentBest: EvaluationCandidate | null, nextCandidate: EvaluationCandidate): EvaluationCandidate {
    if (!currentBest) return nextCandidate;
    if (nextCandidate.totalScore !== currentBest.totalScore) {
        return nextCandidate.totalScore > currentBest.totalScore ? nextCandidate : currentBest;
    }
    if (nextCandidate.tiebreakBaseScore !== currentBest.tiebreakBaseScore) {
        return nextCandidate.tiebreakBaseScore < currentBest.tiebreakBaseScore ? nextCandidate : currentBest;
    }
    if (nextCandidate.activeBaseScore !== currentBest.activeBaseScore) {
        return nextCandidate.activeBaseScore > currentBest.activeBaseScore ? nextCandidate : currentBest;
    }
    return currentBest;
}

function findBestScoreCandidate(
    hand: readonly TableCard[],
    discardPile: readonly TableCard[],
    setup: ScoringSetup,
): EvaluationCandidate {
    let best: EvaluationCandidate | null = null;
    const originalHandIds = new Set(hand.map((card) => card.id));

    for (const necromancerExtra of getNecromancerExtraChoices(hand, discardPile)) {
        const handWithExtra = necromancerExtra ? [...hand, necromancerExtra] : [...hand];

        for (const shapeshifterTargetId of getShapeshifterChoices(handWithExtra, setup)) {
            for (const mirageTargetId of getMirageChoices(handWithExtra, setup)) {
                const baseCards = buildEffectiveCards(handWithExtra, shapeshifterTargetId, mirageTargetId);

                for (const doppelTargetId of getDoppelgangerChoices(baseCards)) {
                    const withDoppel = applyDoppelganger(baseCards, doppelTargetId);

                    for (const bookChoice of getBookOfChangesChoices(withDoppel, setup)) {
                        const withBook = applyBookOfChanges(withDoppel, bookChoice.targetInstanceId, bookChoice.suit);

                        for (const islandTargetId of getIslandTargetChoices(withBook)) {
                            for (const angelTargetId of getAngelTargetChoices(withBook)) {
                                best = compareCandidates(best, evaluateFixedCards(
                                    withBook,
                                    discardPile,
                                    setup,
                                    originalHandIds,
                                    islandTargetId,
                                    angelTargetId,
                                    necromancerExtra?.id,
                                ));
                            }
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
        cardDeltas: [],
    };
}

export function evaluateFantasyRealmsScore(
    hand: readonly TableCard[],
    discardPile: readonly TableCard[],
    options?: FantasyRealmsScoreOptions,
): FantasyRealmsScoreEvaluation {
    const setup = resolveScoringSetup(hand, discardPile, options);
    const cacheKey = buildCacheKey(hand, discardPile, setup);
    const cached = SCORE_CACHE.get(cacheKey);
    if (cached) {
        return {
            ...cached,
            scoreBreakdown: cached.scoreBreakdown.map((line) => ({ ...line })),
            cardDeltas: cached.cardDeltas.map((entry) => ({ ...entry })),
        };
    }

    const best = findBestScoreCandidate(hand, discardPile, setup);
    const evaluation: FantasyRealmsScoreEvaluation = {
        ...best,
        scoreBreakdown: [
            { label: '有效基础分', value: best.activeBaseScore },
            { label: '总加分', value: best.totalBonus },
            { label: '总减分', value: -best.totalPenalty },
        ],
        cardDeltas: best.cardDeltas.map((entry) => ({ ...entry })),
    };

    SCORE_CACHE.set(cacheKey, {
        ...evaluation,
        scoreBreakdown: evaluation.scoreBreakdown.map((line) => ({ ...line })),
        cardDeltas: evaluation.cardDeltas.map((entry) => ({ ...entry })),
    });

    return evaluation;
}

export function resolveFantasyRealmsWinner(
    playerIds: readonly PlayerId[],
    handsByPlayer: Record<PlayerId, readonly TableCard[]>,
    discardPile: readonly TableCard[],
    options?: FantasyRealmsScoreOptions,
): GameOverResult {
    const evaluations = playerIds.map((playerId) => ({
        playerId,
        evaluation: evaluateFantasyRealmsScore(handsByPlayer[playerId] ?? [], discardPile, {
            ...options,
            playerCount: playerIds.length,
        }),
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
