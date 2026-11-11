import type { FantasyRealmsSuit, TableCard } from '../foundation';
import { createRuntimeDeck } from '../foundation';
import type { FantasyRealmsCore } from './types';
import type { FantasyRealmsScoreSelections } from './scoring';

export type SettlementStep = 'leprechaun' | 'genie' | 'necromancer' | 'doppelganger' | 'mirage' | 'shapeshifter' | 'book' | 'island' | 'angel' | 'fountain' | 'done';
const STEPS: SettlementStep[] = ['leprechaun', 'genie', 'necromancer', 'doppelganger', 'mirage', 'shapeshifter', 'book', 'island', 'angel', 'fountain', 'done'];
const SUITS: FantasyRealmsSuit[] = ['军队', '神器', '巨兽', '烈焰', '洪流', '土地', '领袖', '武器', '天象', '野牌', '法师', '建筑', '局外人', '不死族'];
export interface SettlementChoice { cardId?: string; suit?: FantasyRealmsSuit; skip?: boolean }
export interface SettlementState {
    step: SettlementStep;
    playerIndex: number;
    overflowPlayerId: string | null;
    usedDrawSources: Record<string, string[]>;
    selections: Record<string, FantasyRealmsScoreSelections>;
}
export interface SettlementOption { choice: SettlementChoice; label: string; card?: TableCard }

export function emptySelections(): FantasyRealmsScoreSelections {
    return { shapeshifterTargetId: null, mirageTargetId: null, doppelgangerTargetId: null, bookTargetId: null, bookSuit: null, islandTargetId: null, angelTargetId: null, fountainTargetId: null };
}
function actor(core: FantasyRealmsCore): string {
    return core.settlement!.overflowPlayerId ?? core.playerIds[core.settlement!.playerIndex]!;
}
function isSuit(card: TableCard, suits: readonly FantasyRealmsSuit[]): boolean { return suits.includes(card.suit); }
function has(hand: readonly TableCard[], ...ids: string[]): boolean { return hand.some((c) => ids.includes(c.id)); }
function option(card: TableCard): SettlementOption { return { card, choice: { cardId: card.id }, label: card.displayNameZh || card.name }; }
function skip(): SettlementOption { return { choice: { skip: true }, label: '不使用' }; }
function resolvedSuit(core: FantasyRealmsCore, playerId: string, card: TableCard): FantasyRealmsSuit {
    const picks = core.settlement!.selections[playerId]!;
    const catalog = createRuntimeDeck(core.setupConfig);
    const targetId = card.id.startsWith('wild-shapeshifter') ? picks.shapeshifterTargetId : card.id.startsWith('wild-mirage') ? picks.mirageTargetId : null;
    const target = catalog.find((candidate) => candidate.id === targetId);
    const other = card.id === 'wild-doppelganger' ? core.players[playerId]!.hand.find((entry) => entry.id === picks.doppelgangerTargetId) : null;
    const copied = other ? resolvedSuit(core, playerId, other) : undefined;
    return picks.bookTargetId === card.id && picks.bookSuit ? picks.bookSuit : copied ?? target?.suit ?? card.suit;
}

export function getSettlementOptions(core: FantasyRealmsCore): SettlementOption[] {
    const state = core.settlement;
    if (!state || state.step === 'done') return [];
    const playerId = actor(core);
    const hand = core.players[playerId]?.hand ?? [];
    if (state.overflowPlayerId) return hand.filter((card) => !state.usedDrawSources[playerId]?.includes(card.id)).map(option);
    const catalog = createRuntimeDeck(core.setupConfig);
    switch (state.step) {
        case 'genie': return has(hand, 'outsider-genie') && core.drawPile.length ? core.drawPile.map(option) : [];
        case 'necromancer': {
            if (!has(hand, 'wizard-necromancer', 'wizard-necromancer-ch')) return [];
            const suits: FantasyRealmsSuit[] = ['军队', '领袖', '法师', '巨兽', '不死族'];
            const cards = core.discardPile.filter((card) => isSuit(card, suits));
            return cards.length ? [skip(), ...cards.map(option)] : [];
        }
        case 'doppelganger': return has(hand, 'wild-doppelganger') ? [skip(), ...hand.filter((card) => card.id !== 'wild-doppelganger').map(option)] : [];
        case 'mirage': {
            if (!has(hand, 'wild-mirage', 'wild-mirage-ch')) return [];
            const suits: FantasyRealmsSuit[] = ['军队', '土地', '天象', '洪流', '烈焰', '建筑'];
            return [skip(), ...catalog.filter((card) => isSuit(card, suits)).map(option)];
        }
        case 'shapeshifter': {
            if (!has(hand, 'wild-shapeshifter', 'wild-shapeshifter-ch')) return [];
            const suits: FantasyRealmsSuit[] = ['神器', '领袖', '法师', '武器', '巨兽', '不死族'];
            return [skip(), ...catalog.filter((card) => isSuit(card, suits)).map(option)];
        }
        case 'book': {
            if (!has(hand, 'artifact-book-of-changes')) return [];
            const legalSuits = new Set(catalog.map((card) => card.suit));
            const suits = SUITS.filter((suit) => legalSuits.has(suit));
            return [skip(), ...hand.filter((card) => card.id !== 'artifact-book-of-changes').flatMap((card) => suits.filter((suit) => suit !== resolvedSuit(core, playerId, card)).map((suit) => ({ card, choice: { cardId: card.id, suit }, label: `${card.displayNameZh} → ${suit}` })))];
        }
        case 'island': {
            if (!has(hand, 'flood-island')) return [];
            return hand.filter((card) => ['洪流', '烈焰'].includes(resolvedSuit(core, playerId, card))).map(option);
        }
        case 'angel': return has(hand, 'outsider-angel') ? hand.map(option) : [];
        case 'fountain': {
            const source = hand.find((card) => ['flood-fountain-of-life', 'flood-fountain-of-life-ch'].includes(card.id));
            if (!source) return [];
            const suits = ['武器', '洪流', '烈焰', '土地', '天象', '建筑'];
            return hand.filter((card) => suits.includes(resolvedSuit(core, playerId, card))).map(option);
        }
        default: return [];
    }
}
function advancePosition(core: FantasyRealmsCore): void {
    const state = core.settlement!;
    state.playerIndex += 1;
    if (state.playerIndex >= core.playerIds.length) {
        state.playerIndex = 0;
        state.step = STEPS[STEPS.indexOf(state.step) + 1] ?? 'done';
    }
}
function addToHand(core: FantasyRealmsCore, playerId: string, card: TableCard, sourceId: string): void {
    core.players[playerId]!.hand.push({ ...card });
    core.settlement!.usedDrawSources[playerId]!.push(sourceId);
    if (core.players[playerId]!.hand.length > 9) core.settlement!.overflowPlayerId = playerId;
}
function advanceAutomatic(core: FantasyRealmsCore): void {
    const state = core.settlement!;
    while (state.step !== 'done') {
        const playerId = actor(core);
        core.currentPlayer = playerId;
        if (state.overflowPlayerId) return;
        if (state.step === 'leprechaun') {
            const hand = core.players[playerId]!.hand;
            if (has(hand, 'outsider-leprechaun') && core.drawPile.length) addToHand(core, playerId, core.drawPile.shift()!, 'outsider-leprechaun');
            advancePosition(core);
            if (state.overflowPlayerId) { core.currentPlayer = playerId; return; }
            continue;
        }
        if (getSettlementOptions(core).length) return;
        advancePosition(core);
    }
}
function cloneCore(core: FantasyRealmsCore): FantasyRealmsCore {
    return { ...core, drawPile: [...core.drawPile], discardPile: [...core.discardPile], players: Object.fromEntries(Object.entries(core.players).map(([id, player]) => [id, { ...player, hand: [...player.hand] }])), settlement: core.settlement ? { ...core.settlement, selections: Object.fromEntries(Object.entries(core.settlement.selections).map(([id, picks]) => [id, { ...picks }])), usedDrawSources: Object.fromEntries(Object.entries(core.settlement.usedDrawSources).map(([id, ids]) => [id, [...ids]])) } : undefined };
}
export function beginSettlement(core: FantasyRealmsCore): FantasyRealmsCore {
    const next = cloneCore(core);
    next.settlement = { step: 'leprechaun', playerIndex: 0, overflowPlayerId: null, selections: Object.fromEntries(core.playerIds.map((id) => [id, emptySelections()])), usedDrawSources: Object.fromEntries(core.playerIds.map((id) => [id, []])) };
    advanceAutomatic(next);
    return next;
}
export function applySettlementChoice(core: FantasyRealmsCore, choice: SettlementChoice): FantasyRealmsCore {
    const next = cloneCore(core);
    const state = next.settlement!;
    const playerId = actor(next);
    const hand = next.players[playerId]!.hand;
    if (state.overflowPlayerId) {
        const index = hand.findIndex((card) => card.id === choice.cardId);
        const [card] = hand.splice(index, 1);
        const occupied = new Set(next.discardPile.map((entry, i) => entry.discardSlot ?? i));
        let slot = 0; while (occupied.has(slot)) slot += 1;
        next.discardPile.push({ ...card!, discardSlot: slot });
        state.overflowPlayerId = null;
    } else {
        const picks = state.selections[playerId]!;
        const id = choice.skip ? null : choice.cardId ?? null;
        switch (state.step) {
            case 'genie': if (id) { const index = next.drawPile.findIndex((card) => card.id === id); const [card] = next.drawPile.splice(index, 1); addToHand(next, playerId, card!, 'outsider-genie'); } break;
            case 'necromancer': if (id) { const index = next.discardPile.findIndex((card) => card.id === id); const [card] = next.discardPile.splice(index, 1); addToHand(next, playerId, card!, hand.find((c) => c.id.startsWith('wizard-necromancer'))!.id); } break;
            case 'doppelganger': picks.doppelgangerTargetId = id; break;
            case 'mirage': picks.mirageTargetId = id; break;
            case 'shapeshifter': picks.shapeshifterTargetId = id; break;
            case 'book': picks.bookTargetId = id; picks.bookSuit = choice.suit ?? null; break;
            case 'island': picks.islandTargetId = id; break;
            case 'angel': picks.angelTargetId = id; break;
            case 'fountain': picks.fountainTargetId = id; break;
        }
        advancePosition(next);
    }
    advanceAutomatic(next);
    return next;
}
export function matchesSettlementOption(left: SettlementChoice, right: SettlementChoice): boolean {
    return (left.skip === true) === (right.skip === true) && (left.cardId ?? null) === (right.cardId ?? null) && (left.suit ?? null) === (right.suit ?? null);
}
