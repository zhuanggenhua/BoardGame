/**
 * DiceThrone 调试工具配置
 * 定义游戏专属的作弊指令 UI
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveCardDisplayName } from '../../components/game/framework/debug/cardNameResolver';
import { HEROES_DATA } from './heroes';

/* eslint-disable @typescript-eslint/no-explicit-any */
const REVERSED_COMMON_ATLAS_HEROES = new Set(['gunslinger', 'samurai']);

type DeckSectionId = 'unknown' | 'common' | 'hero';

interface MatchingDeckCard {
    card: any;
    deckIndexInDeck: number;
}

interface CharacterCardEntry {
    card: any;
    atlasIndex: number | null;
    deckIndexes: number[];
    handCount: number;
    discardCount: number;
}

interface CharacterCardGroup {
    key: 'common' | 'hero';
    titleKey: string;
    descriptionKey: string;
    entries: CharacterCardEntry[];
}

const getCardSourceAtlasIndex = (card: any) => (
    typeof card?.sourceAtlasIndex === 'number'
        ? card.sourceAtlasIndex
        : card?.previewRef?.type === 'atlas'
            ? card.previewRef.index
            : null
);

const getDeckSectionId = (characterId: string | null | undefined, atlasIndex: number | null): DeckSectionId => {
    if (atlasIndex == null) return 'unknown';

    if (REVERSED_COMMON_ATLAS_HEROES.has(characterId ?? '')) {
        return atlasIndex <= 17 ? 'common' : 'hero';
    }

    return atlasIndex >= 15 ? 'common' : 'hero';
};

interface DiceThroneDebugConfigProps {
    G: unknown;
    dispatch: (type: string, payload?: unknown) => void;
    playerNames?: Record<string, string>;
}

const getCurrentDiceValues = (gameState: any): string[] => {
    const phase = gameState?.sys?.phase;
    const currentRollContext = gameState?.core?.currentRollContext;
    const isMainRollPhase = phase === 'offensiveRoll' || phase === 'targetingRoll' || phase === 'defensiveRoll';
    const isReplayOnlyContext = currentRollContext?.status === 'settled'
        && currentRollContext?.display?.replayOnly === true;
    const dice = isMainRollPhase && isReplayOnlyContext
        ? gameState?.core?.dice ?? []
        : currentRollContext?.dice ?? gameState?.core?.dice ?? [];
    return dice.length > 0
        ? dice.map((die: { value: number }) => String(die.value))
        : ['1', '1', '1', '1', '1'];
};

export const DiceThroneDebugConfig: React.FC<DiceThroneDebugConfigProps> = ({ G, dispatch, playerNames = {} }) => {
    const { t } = useTranslation('game-dicethrone');
    const seatOptions = useMemo(() => {
        const players = G?.core?.players ?? {};
        return Object.keys(players)
            .sort((left, right) => Number(left) - Number(right))
            .map((playerId) => ({
                playerId,
                label: playerNames[playerId]?.trim() || `P${Number(playerId) + 1}`,
            }));
    }, [G, playerNames]);

    const getCardTypeLabel = (cardType: string | undefined) => t(
        cardType === 'upgrade' ? 'debug.card_type.upgrade' : 'debug.card_type.action',
    );

    // ========== 资源作弊 ==========
    const [cheatPlayer, setCheatPlayer] = useState<string>('0');
    const [cheatResource, setCheatResource] = useState<string>('cp');
    const [cheatValue, setCheatValue] = useState<string>('1');

    // ========== 骰子作弊 ==========
    const currentDiceValues = useMemo(() => getCurrentDiceValues(G), [G]);
    const [diceValues, setDiceValues] = useState<string[]>(currentDiceValues);

    useEffect(() => {
        setDiceValues(currentDiceValues);
    }, [currentDiceValues]);

    // ========== Token 作弊 ==========
    const [tokenPlayer, setTokenPlayer] = useState<string>('0');
    const [tokenType, setTokenType] = useState<string>('lotus');
    const [tokenValue, setTokenValue] = useState<string>('1');

    // ========== 发牌作弊 ==========
    const [dealPlayer, setDealPlayer] = useState<string>('0');
    const [deckIndex, setDeckIndex] = useState<string>('0');

    const playerDeck: any[] = useMemo(() => G?.core?.players?.[dealPlayer]?.deck ?? [], [G, dealPlayer]);
    const playerHand: any[] = useMemo(() => G?.core?.players?.[dealPlayer]?.hand ?? [], [G, dealPlayer]);
    const playerDiscard: any[] = useMemo(() => G?.core?.players?.[dealPlayer]?.discard ?? [], [G, dealPlayer]);
    const playerCharacterId: string | null = useMemo(
        () => G?.core?.players?.[dealPlayer]?.characterId ?? null,
        [G, dealPlayer],
    );
    const dealPlayerLabel = useMemo(
        () => seatOptions.find((seat) => seat.playerId === dealPlayer)?.label ?? `P${Number(dealPlayer) + 1}`,
        [dealPlayer, seatOptions],
    );
    const playerCharacterLabel = useMemo(
        () => playerCharacterId
            ? t(`characters.${playerCharacterId}`, { defaultValue: playerCharacterId })
            : t('debug.deal.no_character'),
        [playerCharacterId, t],
    );
    const usesReversedCommonAtlas = useMemo(
        () => REVERSED_COMMON_ATLAS_HEROES.has(playerCharacterId ?? ''),
        [playerCharacterId],
    );
    const characterCardPool: any[] = useMemo(() => {
        if (!playerCharacterId) return [];
        return HEROES_DATA[playerCharacterId]?.cards ?? [];
    }, [playerCharacterId]);

    const matchingDeckCards: MatchingDeckCard[] = useMemo(() => {
        const targetIndex = Number(deckIndex);
        return playerDeck
            .map((card: any, deckIndexInDeck: number) => ({ card, deckIndexInDeck }))
            .filter(({ card }) => getCardSourceAtlasIndex(card) === targetIndex);
    }, [playerDeck, deckIndex]);

    const matchingHandCards = useMemo(() => {
        const targetIndex = Number(deckIndex);
        return playerHand.filter((card: any) => getCardSourceAtlasIndex(card) === targetIndex);
    }, [playerHand, deckIndex]);

    const matchingDiscardCards = useMemo(() => {
        const targetIndex = Number(deckIndex);
        return playerDiscard.filter((card: any) => getCardSourceAtlasIndex(card) === targetIndex);
    }, [playerDiscard, deckIndex]);

    const characterCardEntries: CharacterCardEntry[] = useMemo(() => {
        const deckIndexMap = new Map<string, number[]>();
        playerDeck.forEach((card: any, deckIndexInDeck: number) => {
            const entries = deckIndexMap.get(card.id) ?? [];
            entries.push(deckIndexInDeck);
            deckIndexMap.set(card.id, entries);
        });

        const handCountMap = new Map<string, number>();
        playerHand.forEach((card: any) => {
            handCountMap.set(card.id, (handCountMap.get(card.id) ?? 0) + 1);
        });

        const discardCountMap = new Map<string, number>();
        playerDiscard.forEach((card: any) => {
            discardCountMap.set(card.id, (discardCountMap.get(card.id) ?? 0) + 1);
        });

        return characterCardPool.map((card: any) => ({
            card,
            atlasIndex: getCardSourceAtlasIndex(card),
            deckIndexes: deckIndexMap.get(card.id) ?? [],
            handCount: handCountMap.get(card.id) ?? 0,
            discardCount: discardCountMap.get(card.id) ?? 0,
        }));
    }, [characterCardPool, playerDeck, playerHand, playerDiscard]);

    const matchingPoolCards = useMemo(() => {
        const targetIndex = Number(deckIndex);
        return characterCardEntries.filter(({ atlasIndex }) => atlasIndex === targetIndex);
    }, [characterCardEntries, deckIndex]);

    const cardInDeck = useMemo(() => matchingDeckCards[0]?.card, [matchingDeckCards]);
    const primaryPoolMatch = useMemo(() => matchingPoolCards[0] ?? null, [matchingPoolCards]);

    const atlasActionState = useMemo(() => {
        if (matchingDeckCards.length === 1) {
            return {
                mode: 'deal-from-deck' as const,
                buttonLabel: t('debug.deal.button_deal_from_deck'),
            };
        }

        if (matchingDeckCards.length > 1) {
            return {
                mode: 'choose-deck-candidate' as const,
                buttonLabel: t('debug.deal.button_choose_deck_candidate'),
            };
        }

        if (matchingPoolCards.length === 1) {
            return {
                mode: 'add-from-pool' as const,
                buttonLabel: t('debug.deal.button_add_from_pool'),
            };
        }

        if (matchingPoolCards.length > 1) {
            return {
                mode: 'choose-pool-candidate' as const,
                buttonLabel: t('debug.deal.button_choose_pool_candidate'),
            };
        }

        return {
            mode: 'missing' as const,
            buttonLabel: t('debug.deal.button_default'),
        };
    }, [matchingDeckCards, matchingPoolCards, t]);

    const sortedCharacterCards = useMemo(() => {
        return [...characterCardEntries]
            .sort((a, b) => {
                const ai = a.atlasIndex ?? 999;
                const bi = b.atlasIndex ?? 999;
                if (ai !== bi) return ai - bi;
                return String(a.card.id).localeCompare(String(b.card.id));
            });
    }, [characterCardEntries]);

    const groupedCharacterCards: CharacterCardGroup[] = useMemo(() => {
        const groups: CharacterCardGroup[] = [];
        const commonEntries = sortedCharacterCards.filter(
            ({ atlasIndex }) => getDeckSectionId(playerCharacterId, atlasIndex) === 'common',
        );
        const heroEntries = sortedCharacterCards.filter(
            ({ atlasIndex }) => getDeckSectionId(playerCharacterId, atlasIndex) === 'hero',
        );

        if (usesReversedCommonAtlas) {
            groups.push(
                {
                    key: 'common',
                    titleKey: 'debug.deck_section.common_0_17_title',
                    descriptionKey: 'debug.deck_section.common_0_17_desc',
                    entries: commonEntries,
                },
                {
                    key: 'hero',
                    titleKey: 'debug.deck_section.hero_18_31_title',
                    descriptionKey: 'debug.deck_section.hero_18_31_desc',
                    entries: heroEntries,
                },
            );
            return groups;
        }

        groups.push(
            {
                key: 'hero',
                titleKey: 'debug.deck_section.hero_title',
                descriptionKey: 'debug.deck_section.hero_desc',
                entries: heroEntries,
            },
            {
                key: 'common',
                titleKey: 'debug.deck_section.common_15_32_title',
                descriptionKey: 'debug.deck_section.common_15_32_desc',
                entries: commonEntries,
            },
        );
        return groups;
    }, [playerCharacterId, sortedCharacterCards, usesReversedCommonAtlas]);

    const handleDealByDeckIndex = (deckIndexInDeck: number, atlasIdx?: number | null) => {
        if (atlasIdx != null) {
            setDeckIndex(String(atlasIdx));
        }
        dispatch('SYS_CHEAT_DEAL_CARD_BY_INDEX', {
            playerId: dealPlayer,
            deckIndex: deckIndexInDeck,
        });
    };

    const handleAddCardByCardId = (cardId: string, atlasIdx?: number | null) => {
        if (atlasIdx != null) {
            setDeckIndex(String(atlasIdx));
        }
        dispatch('SYS_CHEAT_ADD_CARD_TO_HAND_BY_CARD_ID', {
            playerId: dealPlayer,
            cardId,
        });
    };

    const handleDealOrAddCard = (entry: CharacterCardEntry) => {
        if (entry.deckIndexes.length > 0) {
            handleDealByDeckIndex(entry.deckIndexes[0], entry.atlasIndex);
            return;
        }
        handleAddCardByCardId(entry.card.id, entry.atlasIndex);
    };

    const handleDieChange = (index: number, value: string) => {
        const newValues = [...diceValues];
        newValues[index] = value;
        setDiceValues(newValues);
    };

    const handleApplyDice = () => {
        const values = diceValues.map((v) => {
            const num = parseInt(v, 10);
            return Number.isNaN(num) ? 1 : Math.max(1, Math.min(6, num));
        });

        dispatch('SYS_CHEAT_SET_DICE', { diceValues: values, phase: G?.sys?.phase });
    };

    return (
        <div className="space-y-4">
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <h4 className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-3">
                    {t('debug.resource.section_title')}
                </h4>
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <select
                            value={cheatPlayer}
                            onChange={(e) => setCheatPlayer(e.target.value)}
                            className="flex-1 px-2 py-1.5 text-xs border border-yellow-300 rounded bg-white text-gray-900"
                        >
                            {seatOptions.map((seat) => (
                                <option key={`resource-${seat.playerId}`} value={seat.playerId}>{seat.label}</option>
                            ))}
                        </select>
                        <select
                            value={cheatResource}
                            onChange={(e) => setCheatResource(e.target.value)}
                            className="flex-1 px-2 py-1.5 text-xs border border-yellow-300 rounded bg-white text-gray-900"
                        >
                            <option value="cp">CP</option>
                            <option value="hp">HP</option>
                        </select>
                        <input
                            type="number"
                            value={cheatValue}
                            onChange={(e) => setCheatValue(e.target.value)}
                            className="w-16 px-2 py-1.5 text-xs border border-yellow-300 rounded bg-white text-center text-gray-900"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                dispatch('SYS_CHEAT_SET_RESOURCE', {
                                    playerId: cheatPlayer,
                                    resourceId: cheatResource,
                                    value: Number(cheatValue),
                                });
                            }}
                            className="flex-1 px-3 py-1.5 bg-yellow-500 text-white rounded text-xs font-bold hover:bg-yellow-600"
                        >
                            {t('debug.resource.set')}
                        </button>
                        <button
                            onClick={() => {
                                dispatch('SYS_CHEAT_ADD_RESOURCE', {
                                    playerId: cheatPlayer,
                                    resourceId: cheatResource,
                                    delta: Number(cheatValue),
                                });
                            }}
                            className="flex-1 px-3 py-1.5 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600"
                        >
                            {t('debug.resource.add')}
                        </button>
                        <button
                            onClick={() => {
                                dispatch('SYS_CHEAT_ADD_RESOURCE', {
                                    playerId: cheatPlayer,
                                    resourceId: cheatResource,
                                    delta: -Number(cheatValue),
                                });
                            }}
                            className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded text-xs font-bold hover:bg-red-600"
                        >
                            {t('debug.resource.subtract')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200" data-testid="dt-debug-dice">
                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3">
                    {t('debug.dice.section_title')}
                </h4>
                <div className="space-y-2">
                    <div className="grid grid-cols-5 gap-2">
                        {diceValues.map((value, index) => (
                            <div key={index} className="flex flex-col items-center gap-1">
                                <span className="text-[9px] text-gray-500 font-bold">
                                    {t('debug.dice.die_label', { index: index + 1 })}
                                </span>
                                <input
                                    type="number"
                                    min="1"
                                    max="6"
                                    value={value}
                                    onChange={(e) => handleDieChange(index, e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-blue-300 rounded bg-white text-center font-bold text-gray-900"
                                />
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={handleApplyDice}
                        className="w-full px-3 py-2 bg-blue-500 text-white rounded text-xs font-bold hover:bg-blue-600"
                        data-testid="dt-debug-dice-apply"
                    >
                        {t('debug.dice.apply')}
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setDiceValues(['1', '1', '1', '1', '1'])}
                            className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 rounded text-[10px] font-bold hover:bg-gray-300"
                        >
                            {t('debug.dice.all_ones')}
                        </button>
                        <button
                            onClick={() => setDiceValues(['6', '6', '6', '6', '6'])}
                            className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 rounded text-[10px] font-bold hover:bg-gray-300"
                        >
                            {t('debug.dice.all_sixes')}
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setDiceValues(['1', '2', '3', '4', '5']); }}
                            className="flex-1 px-2 py-1 bg-indigo-200 text-indigo-700 rounded text-[10px] font-bold hover:bg-indigo-300"
                        >
                            {t('debug.dice.large_straight_1_5')}
                        </button>
                        <button
                            onClick={() => { setDiceValues(['2', '3', '4', '5', '6']); }}
                            className="flex-1 px-2 py-1 bg-indigo-200 text-indigo-700 rounded text-[10px] font-bold hover:bg-indigo-300"
                        >
                            {t('debug.dice.large_straight_2_6')}
                        </button>
                        <button
                            onClick={() => { setDiceValues(['1', '2', '3', '4', '4']); }}
                            className="flex-1 px-2 py-1 bg-teal-200 text-teal-700 rounded text-[10px] font-bold hover:bg-teal-300"
                        >
                            {t('debug.dice.small_straight_1_4')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-3">
                    {t('debug.token.section_title')}
                </h4>
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <select
                            value={tokenPlayer}
                            onChange={(e) => setTokenPlayer(e.target.value)}
                            className="flex-1 px-2 py-1.5 text-xs border border-purple-300 rounded bg-white text-gray-900"
                        >
                            {seatOptions.map((seat) => (
                                <option key={`token-${seat.playerId}`} value={seat.playerId}>{seat.label}</option>
                            ))}
                        </select>
                        <select
                            value={tokenType}
                            onChange={(e) => setTokenType(e.target.value)}
                            className="flex-1 px-2 py-1.5 text-xs border border-purple-300 rounded bg-white text-gray-900"
                        >
                            <option value="lotus">{t('debug.token.lotus')}</option>
                        </select>
                        <input
                            type="number"
                            min="0"
                            value={tokenValue}
                            onChange={(e) => setTokenValue(e.target.value)}
                            className="w-16 px-2 py-1.5 text-xs border border-purple-300 rounded bg-white text-center text-gray-900"
                        />
                    </div>
                    <button
                        onClick={() => {
                            dispatch('SYS_CHEAT_SET_TOKEN', {
                                playerId: tokenPlayer,
                                tokenId: tokenType,
                                amount: Number(tokenValue),
                            });
                        }}
                        className="w-full px-3 py-1.5 bg-purple-500 text-white rounded text-xs font-bold hover:bg-purple-600"
                    >
                        {t('debug.token.set_amount')}
                    </button>
                </div>
            </div>

            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <h4 className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-3">
                    {t('debug.deal.section_title')}
                </h4>
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <select
                            value={dealPlayer}
                            onChange={(e) => setDealPlayer(e.target.value)}
                            className="flex-1 px-2 py-1.5 text-xs border border-green-300 rounded bg-white text-gray-900"
                        >
                            {seatOptions.map((seat) => (
                                <option key={`deal-${seat.playerId}`} value={seat.playerId}>{seat.label}</option>
                            ))}
                        </select>
                        <input
                            type="number"
                            min="0"
                            max={39}
                            value={deckIndex}
                            onChange={(e) => setDeckIndex(e.target.value)}
                            className="flex-1 px-2 py-1.5 text-xs border border-green-300 rounded bg-white text-center text-gray-900"
                            placeholder={t('debug.deal.index_placeholder')}
                        />
                    </div>
                    <div className={`rounded border px-2 py-1.5 text-[9px] leading-4 ${
                        usesReversedCommonAtlas
                            ? 'border-emerald-200 bg-emerald-100/70 text-emerald-800'
                            : 'border-green-200 bg-white/70 text-green-700'
                    }`}>
                        {usesReversedCommonAtlas
                            ? t('debug.deal.reversed_common_hint', { hero: playerCharacterLabel })
                            : t('debug.deal.legacy_common_hint', { hero: playerCharacterLabel })}
                    </div>
                    <div className="text-[9px] text-green-600 mb-1">
                        {t('debug.deal.deck_remaining', { count: playerDeck.length })}
                        {matchingDeckCards.length === 1 ? (
                            <span className="ml-1 text-green-700">
                                {t('debug.deal.deck_hit', { name: resolveCardDisplayName(cardInDeck, t) })}
                            </span>
                        ) : atlasActionState.mode === 'choose-deck-candidate' ? (
                            <span className="ml-1 text-amber-700">
                                {t('debug.deal.deck_multi_hit', { count: matchingDeckCards.length })}
                            </span>
                        ) : atlasActionState.mode === 'add-from-pool' ? (
                            <span className="ml-1 text-amber-700">
                                {t('debug.deal.pool_single_hit', {
                                    name: resolveCardDisplayName(primaryPoolMatch?.card, t),
                                    handCount: matchingHandCards.length,
                                    discardCount: matchingDiscardCards.length,
                                })}
                            </span>
                        ) : atlasActionState.mode === 'choose-pool-candidate' ? (
                            <span className="ml-1 text-amber-700">
                                {t('debug.deal.pool_multi_hit', { count: matchingPoolCards.length })}
                            </span>
                        ) : (
                            <span className="ml-1 text-red-400">{t('debug.deal.pool_missing')}</span>
                        )}
                    </div>
                    <button
                        onClick={() => {
                            if (atlasActionState.mode === 'deal-from-deck') {
                                handleDealByDeckIndex(matchingDeckCards[0].deckIndexInDeck, Number(deckIndex));
                                return;
                            }

                            if (atlasActionState.mode === 'add-from-pool' && primaryPoolMatch) {
                                handleAddCardByCardId(primaryPoolMatch.card.id, primaryPoolMatch.atlasIndex);
                            }
                        }}
                        disabled={atlasActionState.mode !== 'deal-from-deck' && atlasActionState.mode !== 'add-from-pool'}
                        className="w-full px-3 py-1.5 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        {atlasActionState.buttonLabel}
                    </button>
                    {atlasActionState.mode === 'choose-deck-candidate' && (
                        <div className="space-y-1 rounded border border-amber-200 bg-amber-50 p-2">
                            {matchingDeckCards.map(({ card, deckIndexInDeck }) => (
                                <button
                                    key={`${card.id}-${deckIndexInDeck}`}
                                    type="button"
                                    onClick={() => handleDealByDeckIndex(deckIndexInDeck, Number(deckIndex))}
                                    className="flex w-full items-center gap-2 rounded bg-white px-2 py-1 text-left text-[10px] text-amber-800 hover:bg-amber-100"
                                >
                                    <span className="w-10 text-[9px] text-amber-500">
                                        {t('debug.deal.deck_slot', { index: deckIndexInDeck })}
                                    </span>
                                    <span className={`rounded px-1 text-[8px] ${
                                        card.type === 'upgrade' ? 'bg-amber-200 text-amber-800' : 'bg-purple-200 text-purple-800'
                                    }`}>
                                        {getCardTypeLabel(card.type)}
                                    </span>
                                    <span className="flex-1 truncate">{resolveCardDisplayName(card, t)}</span>
                                    <span className="text-purple-500 text-[9px]">💎{card.cpCost}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {atlasActionState.mode === 'choose-pool-candidate' && (
                        <div className="space-y-1 rounded border border-emerald-200 bg-emerald-50 p-2">
                            {matchingPoolCards.map((entry) => (
                                <button
                                    key={`${entry.card.id}-pool`}
                                    type="button"
                                    onClick={() => handleDealOrAddCard(entry)}
                                    className="flex w-full items-center gap-2 rounded bg-white px-2 py-1 text-left text-[10px] text-emerald-800 hover:bg-emerald-100"
                                >
                                    <span className="w-10 text-[9px] text-emerald-500">
                                        {entry.deckIndexes.length > 0
                                            ? t('debug.deal.deck_slot', { index: entry.deckIndexes[0] })
                                            : t('debug.short.add_to_hand')}
                                    </span>
                                    <span className={`rounded px-1 text-[8px] ${
                                        entry.card.type === 'upgrade' ? 'bg-amber-200 text-amber-800' : 'bg-purple-200 text-purple-800'
                                    }`}>
                                        {getCardTypeLabel(entry.card.type)}
                                    </span>
                                    <span className="flex-1 truncate">{resolveCardDisplayName(entry.card, t)}</span>
                                    <span className="text-[9px] text-slate-500">
                                        {t('debug.short.in_hand_and_discard', {
                                            handCount: entry.handCount,
                                            discardCount: entry.discardCount,
                                        })}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3">
                    {t('debug.card_pool.section_title', { player: dealPlayerLabel })}
                </h4>
                <div className="mb-2 text-[9px] leading-4 text-amber-700">
                    {t('debug.card_pool.description')}
                </div>
                <div className="max-h-40 overflow-y-auto">
                    {sortedCharacterCards.length === 0 ? (
                        <div className="text-[10px] text-amber-400 text-center py-2">
                            {t('debug.card_pool.empty_character')}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {groupedCharacterCards.map((group) => (
                                <div key={group.key} className="space-y-1">
                                    <div className="rounded bg-amber-100 px-2 py-1">
                                        <div className="text-[9px] font-black uppercase tracking-wide text-amber-700">
                                            {t(group.titleKey)}
                                        </div>
                                        <div className="text-[8px] leading-4 text-amber-600">
                                            {t(group.descriptionKey)}
                                        </div>
                                    </div>
                                    {group.entries.length === 0 ? (
                                        <div className="px-2 py-1 text-[9px] text-amber-300">
                                            {t('debug.card_pool.empty_group')}
                                        </div>
                                    ) : group.entries.map((entry, idx) => {
                                        const { card, atlasIndex, deckIndexes, handCount, discardCount } = entry;
                                        const sectionId = getDeckSectionId(playerCharacterId, atlasIndex);
                                        const hasDeckCopy = deckIndexes.length > 0;
                                        return (
                                            <div
                                                key={`${group.key}-${card.id}-${idx}`}
                                                className="flex items-center gap-2 text-[10px] px-1 py-0.5 rounded cursor-pointer text-amber-700 hover:bg-amber-100"
                                                onClick={() => {
                                                    if (atlasIndex != null) {
                                                        handleDealOrAddCard(entry);
                                                    }
                                                }}
                                            >
                                                <span className="w-5 text-amber-500 font-mono">{atlasIndex ?? '-'}</span>
                                                <span className="w-12 text-[8px] text-slate-400">
                                                    {hasDeckCopy
                                                        ? t('debug.card_pool.deck_index_short', { index: deckIndexes[0] })
                                                        : t('debug.short.add_to_hand')}
                                                </span>
                                                <span className="rounded bg-emerald-100 px-1 text-[8px] text-emerald-800">
                                                    {t(`debug.deck_section.${sectionId}`)}
                                                </span>
                                                <span className={`px-1 rounded text-[8px] ${
                                                    card.type === 'upgrade' ? 'bg-amber-200 text-amber-800' : 'bg-purple-200 text-purple-800'
                                                }`}>
                                                    {getCardTypeLabel(card.type)}
                                                </span>
                                                <span className="flex-1 truncate">{resolveCardDisplayName(card, t)}</span>
                                                <span className="text-purple-500 text-[9px]">💎{card.cpCost}</span>
                                                {hasDeckCopy ? (
                                                    <span className="text-green-500 text-[8px]">
                                                        {t('debug.short.in_deck')}
                                                    </span>
                                                ) : handCount > 0 || discardCount > 0 ? (
                                                    <span className="text-emerald-500 text-[8px]">
                                                        {t('debug.short.can_add_with_counts', {
                                                            handCount,
                                                            discardCount,
                                                        })}
                                                    </span>
                                                ) : (
                                                    <span className="text-emerald-500 text-[8px]">
                                                        {t('debug.short.can_add')}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">
                    {t('debug.hand_preview.section_title', { player: dealPlayerLabel })}
                </h4>
                <div className="max-h-24 overflow-y-auto">
                    {playerHand.length === 0 ? (
                        <div className="text-[10px] text-slate-400 text-center py-2">
                            {t('debug.hand_preview.empty')}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {playerHand.map((card: any, idx: number) => (
                                <div
                                    key={`${card.id}-${idx}`}
                                    className="flex items-center gap-2 text-[10px] text-slate-700 px-1 py-0.5 rounded"
                                >
                                    <span className="w-5 text-slate-400 font-mono">
                                        {getCardSourceAtlasIndex(card) ?? '-'}
                                    </span>
                                    <span className={`px-1 rounded text-[8px] ${
                                        card.type === 'upgrade' ? 'bg-amber-200 text-amber-800' : 'bg-purple-200 text-purple-800'
                                    }`}>
                                        {getCardTypeLabel(card.type)}
                                    </span>
                                    <span className="flex-1 truncate">{resolveCardDisplayName(card, t)}</span>
                                    <span className="text-purple-500">💎{card.cpCost}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
