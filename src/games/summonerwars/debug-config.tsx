/**
 * 召唤师战争 调试工具配置
 * 定义游戏专属的作弊指令 UI
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card, GamePhase, PlayerId, SummonerWarsCore } from './domain/types';
import { PHASE_ORDER } from './domain/types';
import { resolveCardDisplayName } from '../../components/game/framework/debug/cardNameResolver';
import { buildCardRegistry, getCardPoolByFaction } from './config/cardRegistry';
import { getBaseCardId } from './domain/ids';

interface SummonerWarsDebugConfigProps {
    G: { core: SummonerWarsCore };
    dispatch: (type: string, payload?: unknown) => void;
}

interface DebugCardStats {
    deckIndexes: number[];
    handCount: number;
    discardCount: number;
    activeCount: number;
    boardCount: number;
}

interface DebugCardEntry extends DebugCardStats {
    stableCardId: string;
    card: Card;
    atlasIndex: number | null;
    atlasLabel: string;
}

const PHASE_LABEL_KEYS: Record<GamePhase, string> = {
    factionSelect: 'debug.phase_labels.factionSelect',
    summon: 'debug.phase_labels.summon',
    move: 'debug.phase_labels.move',
    build: 'debug.phase_labels.build',
    attack: 'debug.phase_labels.attack',
    magic: 'debug.phase_labels.magic',
    draw: 'debug.phase_labels.draw',
};

const summonerWarsCardRegistry = buildCardRegistry();

const normalizeStableCardId = (cardId: string) => getBaseCardId(cardId);

const CARD_TYPE_ORDER: Record<Card['cardType'], number> = {
    unit: 0,
    event: 1,
    structure: 2,
};

const createEmptyStats = (): DebugCardStats => ({
    deckIndexes: [],
    handCount: 0,
    discardCount: 0,
    activeCount: 0,
    boardCount: 0,
});

const NO_ATLAS_LABEL = '__NO_ATLAS__';

const registerDebugCardDefinition = (cardsByBaseId: Map<string, Card>, card: Card | undefined) => {
    if (!card) return;

    const stableCardId = normalizeStableCardId(card.id);
    if (card.cardType === 'unit' && card.unitClass === 'summoner') return;
    if (cardsByBaseId.has(stableCardId)) return;

    const canonicalCard = summonerWarsCardRegistry.get(stableCardId);
    cardsByBaseId.set(
        stableCardId,
        canonicalCard
            ? { ...canonicalCard, id: stableCardId }
            : { ...card, id: stableCardId },
    );
};

const collectDebugCardEntries = (core: SummonerWarsCore | undefined, playerId: PlayerId): DebugCardEntry[] => {
    if (!core) return [];

    const player = core.players[playerId];
    if (!player) return [];

    const cardsByBaseId = new Map<string, Card>();
    const statsByBaseId = new Map<string, DebugCardStats>();
    const selectedFaction = core.selectedFactions[playerId];
    const customDeckData = core.customDeckData?.[playerId];

    const ensureStats = (stableCardId: string) => {
        const existing = statsByBaseId.get(stableCardId);
        if (existing) return existing;
        const created = createEmptyStats();
        statsByBaseId.set(stableCardId, created);
        return created;
    };

    const recordRuntimeCard = (
        card: Card | undefined,
        area: 'deck' | 'hand' | 'discard' | 'active' | 'board',
        deckIndex?: number,
    ) => {
        if (!card) return;
        registerDebugCardDefinition(cardsByBaseId, card);
        const stableCardId = normalizeStableCardId(card.id);
        const stats = ensureStats(stableCardId);
        if (area === 'deck') {
            if (typeof deckIndex === 'number') {
                stats.deckIndexes.push(deckIndex);
            }
            return;
        }
        if (area === 'hand') {
            stats.handCount += 1;
            return;
        }
        if (area === 'discard') {
            stats.discardCount += 1;
            return;
        }
        if (area === 'active') {
            stats.activeCount += 1;
            return;
        }
        stats.boardCount += 1;
    };

    if (customDeckData?.cards?.length) {
        customDeckData.cards.forEach((entry) => {
            registerDebugCardDefinition(cardsByBaseId, summonerWarsCardRegistry.get(entry.cardId));
        });
    } else if (selectedFaction && selectedFaction !== 'unselected') {
        getCardPoolByFaction(selectedFaction).forEach((card) => {
            registerDebugCardDefinition(cardsByBaseId, card);
        });
    }

    player.deck.forEach((card, deckIndex) => recordRuntimeCard(card, 'deck', deckIndex));
    player.hand.forEach((card) => recordRuntimeCard(card, 'hand'));
    player.discard.forEach((card) => recordRuntimeCard(card, 'discard'));
    player.activeEvents.forEach((card) => recordRuntimeCard(card, 'active'));
    core.board.forEach((row) => {
        row.forEach((cell) => {
            if (cell.unit?.owner === playerId) {
                recordRuntimeCard(cell.unit.card, 'board');
                cell.unit.attachedCards?.forEach((card) => recordRuntimeCard(card, 'board'));
                cell.unit.attachedUnits?.forEach((attachedUnit) => recordRuntimeCard(attachedUnit.card, 'board'));
            }
            if (cell.structure?.owner === playerId) {
                recordRuntimeCard(cell.structure.card, 'board');
            }
        });
    });

    return Array.from(cardsByBaseId.entries())
        .map(([stableCardId, card]) => {
            const stats = statsByBaseId.get(stableCardId) ?? createEmptyStats();
            const atlasIndex = typeof card.spriteIndex === 'number' ? card.spriteIndex : null;
            return {
                stableCardId,
                card: {
                    ...card,
                    id: stableCardId,
                },
                atlasIndex,
                atlasLabel: atlasIndex == null ? NO_ATLAS_LABEL : `${card.spriteAtlas ?? 'cards'}:${atlasIndex}`,
                deckIndexes: [...stats.deckIndexes].sort((left, right) => left - right),
                handCount: stats.handCount,
                discardCount: stats.discardCount,
                activeCount: stats.activeCount,
                boardCount: stats.boardCount,
            };
        })
        .sort((left, right) => {
            if (left.atlasIndex !== right.atlasIndex) {
                if (left.atlasIndex == null) return 1;
                if (right.atlasIndex == null) return -1;
                return left.atlasIndex - right.atlasIndex;
            }
            const cardTypeDiff = CARD_TYPE_ORDER[left.card.cardType] - CARD_TYPE_ORDER[right.card.cardType];
            if (cardTypeDiff !== 0) return cardTypeDiff;
            return resolveCardDisplayName(left.card).localeCompare(resolveCardDisplayName(right.card), 'zh-CN');
        });
};

export const SummonerWarsDebugConfig: React.FC<SummonerWarsDebugConfigProps> = ({ G, dispatch }) => {
    const core = G?.core;
    const { t } = useTranslation('game-summonerwars');

    const [cheatPlayer, setCheatPlayer] = useState<string>('0');
    const [cheatValue, setCheatValue] = useState<string>('5');
    const [targetPhase, setTargetPhase] = useState<GamePhase>('summon');
    const [dealPlayer, setDealPlayer] = useState<PlayerId>('0');
    const [selectedCardId, setSelectedCardId] = useState<string>('');

    const playerDeck = core?.players?.[dealPlayer]?.deck ?? [];
    const playerHand = core?.players?.[dealPlayer]?.hand ?? [];
    const debugCardEntries = useMemo(() => collectDebugCardEntries(core, dealPlayer), [core, dealPlayer]);

    const effectiveSelectedCardId = useMemo(() => {
        if (debugCardEntries.some((entry) => entry.stableCardId === selectedCardId)) {
            return selectedCardId;
        }
        return debugCardEntries[0]?.stableCardId ?? '';
    }, [debugCardEntries, selectedCardId]);

    const selectedEntry = useMemo(
        () => debugCardEntries.find((entry) => entry.stableCardId === effectiveSelectedCardId) ?? null,
        [debugCardEntries, effectiveSelectedCardId],
    );

    const selectedCardCollisionCount = useMemo(() => {
        if (!selectedEntry || selectedEntry.atlasIndex == null) return 0;
        return debugCardEntries.filter((entry) => entry.atlasIndex === selectedEntry.atlasIndex).length;
    }, [debugCardEntries, selectedEntry]);

    const handleDealSelectedCard = () => {
        if (!selectedEntry) return;

        if (selectedEntry.deckIndexes.length > 0) {
            dispatch('SYS_CHEAT_DEAL_CARD_BY_INDEX', {
                playerId: dealPlayer,
                deckIndex: selectedEntry.deckIndexes[0],
            });
            return;
        }

        dispatch('SYS_CHEAT_ADD_CARD_TO_HAND_BY_CARD_ID', {
            playerId: dealPlayer,
            cardId: selectedEntry.stableCardId,
        });
    };

    return (
        <div className="space-y-4">
            {/* 魔力作弊 */}
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-3">{t('debug.magic.section_title')}</h4>
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <select value={cheatPlayer} onChange={(e) => setCheatPlayer(e.target.value)} className="flex-1 px-2 py-1.5 text-xs border border-purple-300 rounded bg-white text-gray-900">
                            <option value="0">{t('debug.magic.player_option', { player: 0, magic: core?.players?.['0']?.magic ?? 0 })}</option>
                            <option value="1">{t('debug.magic.player_option', { player: 1, magic: core?.players?.['1']?.magic ?? 0 })}</option>
                        </select>
                        <input type="number" min="0" max="15" value={cheatValue} onChange={(e) => setCheatValue(e.target.value)} className="w-16 px-2 py-1.5 text-xs border border-purple-300 rounded bg-white text-center text-gray-900" />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => dispatch('SYS_CHEAT_SET_RESOURCE', { playerId: cheatPlayer, resourceId: 'magic', value: Number(cheatValue) })} className="flex-1 px-3 py-1.5 bg-purple-500 text-white rounded text-xs font-bold hover:bg-purple-600">{t('debug.magic.set')}</button>
                        <button onClick={() => dispatch('SYS_CHEAT_ADD_RESOURCE', { playerId: cheatPlayer, resourceId: 'magic', delta: Number(cheatValue) })} className="flex-1 px-3 py-1.5 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600">{t('debug.magic.add')}</button>
                        <button onClick={() => dispatch('SYS_CHEAT_ADD_RESOURCE', { playerId: cheatPlayer, resourceId: 'magic', delta: -Number(cheatValue) })} className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded text-xs font-bold hover:bg-red-600">{t('debug.magic.subtract')}</button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => dispatch('SYS_CHEAT_SET_RESOURCE', { playerId: cheatPlayer, resourceId: 'magic', value: 0 })} className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 rounded text-[10px] font-bold hover:bg-gray-300">{t('debug.magic.clear')}</button>
                        <button onClick={() => dispatch('SYS_CHEAT_SET_RESOURCE', { playerId: cheatPlayer, resourceId: 'magic', value: 15 })} className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 rounded text-[10px] font-bold hover:bg-gray-300">{t('debug.magic.full')}</button>
                    </div>
                </div>
            </div>

            {/* 阶段作弊 */}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3">{t('debug.phase.section_title')}</h4>
                <div className="space-y-2">
                    <div className="text-[9px] text-blue-600 mb-1">
                        {t('debug.phase.current')}
                        <span className="font-bold">{t(PHASE_LABEL_KEYS[core?.phase ?? 'summon'])}</span>
                    </div>
                    <div className="flex gap-2">
                        <select value={targetPhase} onChange={(e) => setTargetPhase(e.target.value as GamePhase)} className="flex-1 px-2 py-1.5 text-xs border border-blue-300 rounded bg-white text-gray-900">
                            {PHASE_ORDER.map((phase) => (<option key={phase} value={phase}>{t(PHASE_LABEL_KEYS[phase])}</option>))}
                        </select>
                        <button onClick={() => dispatch('SYS_CHEAT_SET_PHASE', { phase: targetPhase })} className="px-3 py-1.5 bg-blue-500 text-white rounded text-xs font-bold hover:bg-blue-600">{t('debug.phase.switch')}</button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                        {PHASE_ORDER.map((phase) => (
                            <button key={phase} onClick={() => dispatch('SYS_CHEAT_SET_PHASE', { phase })} className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${core?.phase === phase ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>{t(PHASE_LABEL_KEYS[phase])}</button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 发牌作弊 */}
            <div className="bg-green-50 p-3 rounded-lg border border-green-200" data-testid="sw-debug-deal">
                <h4 className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-3">{t('debug.deal.section_title')}</h4>
                <div className="space-y-2">
                    <div className="text-[9px] text-green-700 bg-green-100 p-2 rounded">
                        {t('debug.deal.description')}
                    </div>
                    <div className="text-[9px] text-green-600">
                        {t('debug.deal.atlas_note')}
                    </div>
                    <div className="flex gap-2">
                        <select value={dealPlayer} onChange={(e) => setDealPlayer(e.target.value as PlayerId)} className="w-24 px-2 py-1.5 text-xs border border-green-300 rounded bg-white text-gray-900">
                            <option value="0">{t('player.short', { id: 0 })}</option>
                            <option value="1">{t('player.short', { id: 1 })}</option>
                        </select>
                        <select value={effectiveSelectedCardId} onChange={(e) => setSelectedCardId(e.target.value)} className="flex-1 px-2 py-1.5 text-xs border border-green-300 rounded bg-white text-gray-900">
                            {debugCardEntries.length === 0 ? (
                                <option value="">{t('debug.deal.empty_pool')}</option>
                            ) : (
                                debugCardEntries.map((entry) => (
                                    <option key={entry.stableCardId} value={entry.stableCardId}>
                                        [{entry.atlasLabel === NO_ATLAS_LABEL ? t('debug.lookup.no_atlas') : entry.atlasLabel}] {resolveCardDisplayName(entry.card)}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>
                    <div className="text-[9px] text-green-600 mb-1">
                        {t('debug.deal.status', {
                            deckCount: playerDeck.length,
                            handCount: playerHand.length,
                        })}
                        {selectedEntry ? (
                            <span className="ml-1 text-green-700">
                                {t('debug.deal.selected_card_status', {
                                    name: resolveCardDisplayName(selectedEntry.card),
                                    deckCount: selectedEntry.deckIndexes.length,
                                    handCount: selectedEntry.handCount,
                                    discardCount: selectedEntry.discardCount,
                                    activeCount: selectedEntry.activeCount,
                                    boardCount: selectedEntry.boardCount,
                                })}
                            </span>
                        ) : (
                            <span className="ml-1 text-red-400">{t('debug.deal.no_pool_for_player')}</span>
                        )}
                    </div>
                    {selectedEntry && selectedCardCollisionCount > 1 ? (
                        <div className="text-[9px] text-amber-700 bg-amber-100 p-2 rounded">
                            {t('debug.deal.collision_warning')}
                        </div>
                    ) : null}
                    <button onClick={handleDealSelectedCard} disabled={!selectedEntry} className="w-full px-3 py-1.5 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed" data-testid="sw-debug-deal-apply">
                        {selectedEntry?.deckIndexes.length ? t('debug.deal.prefer_deal') : t('debug.deal.direct_add')}
                    </button>
                </div>
            </div>

            {/* 卡牌速查表 */}
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3">{t('debug.lookup.section_title')}</h4>
                <div className="text-[9px] text-amber-700 mb-2">
                    {t('debug.lookup.description')}
                </div>
                <div className="max-h-48 overflow-y-auto">
                    <div className="space-y-1">
                        {debugCardEntries.map((entry) => {
                            const isSelected = entry.stableCardId === effectiveSelectedCardId;
                            return (
                                <button
                                    key={entry.stableCardId}
                                    type="button"
                                    className={`w-full flex items-center gap-2 text-[10px] px-1 py-1 rounded text-left transition-colors ${isSelected ? 'bg-amber-200 text-amber-900 font-bold' : 'text-amber-700 hover:bg-amber-100'}`}
                                    onClick={() => setSelectedCardId(entry.stableCardId)}
                                >
                                    <span className="w-14 text-amber-500 font-mono shrink-0">
                                        {entry.atlasLabel === NO_ATLAS_LABEL ? t('debug.lookup.no_atlas') : entry.atlasLabel}
                                    </span>
                                    <span className={`px-1 rounded text-[8px] ${entry.card.cardType === 'unit' ? 'bg-amber-200 text-amber-800' : entry.card.cardType === 'event' ? 'bg-purple-200 text-purple-800' : 'bg-slate-200 text-slate-800'}`}>{t(`debug.card_types.${entry.card.cardType}`)}</span>
                                    <span className="flex-1 truncate">{resolveCardDisplayName(entry.card)}</span>
                                    <span className="text-[8px] text-green-700 shrink-0">{t('debug.lookup.deck_short', { count: entry.deckIndexes.length })}</span>
                                    <span className="text-[8px] text-slate-600 shrink-0">{t('debug.lookup.hand_short', { count: entry.handCount })}</span>
                                    <span className="text-[8px] text-slate-500 shrink-0">{t('debug.lookup.discard_short', { count: entry.discardCount })}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 手牌预览 */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">{t('debug.hand_preview.section_title', { player: dealPlayer })}</h4>
                <div className="max-h-24 overflow-y-auto">
                    {playerHand.length === 0 ? (
                        <div className="text-[10px] text-slate-400 text-center py-2">{t('debug.hand_preview.empty')}</div>
                    ) : (
                        <div className="space-y-1">
                            {playerHand.map((card, idx) => (
                                <div key={`${card.id}-${idx}`} className="flex items-center gap-2 text-[10px] text-slate-700 px-1 py-0.5 rounded">
                                    <span className="w-12 text-slate-400 font-mono">{card.spriteIndex ?? '-'}</span>
                                    <span className={`px-1 rounded text-[8px] ${card.cardType === 'unit' ? 'bg-amber-200 text-amber-800' : card.cardType === 'event' ? 'bg-purple-200 text-purple-800' : 'bg-slate-200 text-slate-800'}`}>{t(`debug.card_types.${card.cardType}`)}</span>
                                    <span className="flex-1 truncate">{resolveCardDisplayName(card)}</span>
                                    {'cost' in card && <span className="text-purple-500">💎{card.cost}</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
