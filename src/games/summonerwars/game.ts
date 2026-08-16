/**
 * 召唤师战争游戏定义（新引擎架构）
 * 
 * 使用领域内核 + 引擎适配器 + FlowSystem
 */

import {
    createActionLogSystem,
    createCheatSystem,
    createEventStreamSystem,
    createFlowSystem,
    createInteractionSystem,
    createSimpleChoiceSystem,
    createMultistepChoiceSystem,
    createRematchSystem,
    createResponseWindowSystem,
    createTutorialSystem,
    createUndoSystem,
    CharacterSelectionSystem,
    type CheatResourceModifier,
} from '../../engine';
import { createGameEngine, type AdapterConfig } from '../../engine/adapter';
import type { EngineSystem } from '../../engine/systems/types';
import type { MatchState } from '../../engine/types';
import { SummonerWarsDomain, SW_COMMANDS } from './domain';
import type { Card, FactionId, GamePhase, PlayerId, SummonerWarsCore } from './domain/types';
import { summonerWarsFlowHooks } from './domain/flowHooks';
import { createSummonerWarsInteractionSystem } from './domain/systems';
import { registerCardPreviewGetter } from '../../components/game/registry/cardPreviewRegistry';
import { registerCriticalImageResolver } from '../../core';
import { getSummonerWarsCardPreviewRef } from './ui/cardPreviewHelper';
import { ACTION_ALLOWLIST, UNDO_ALLOWLIST, formatSummonerWarsActionEntry } from './actionLog';
import { summonerWarsCriticalImageResolver } from './criticalImageResolver';
import { registerGameAiRuntime } from '../../engine/ai';
import { summonerWarsAiRuntime } from './ai';
import { buildCardRegistry, getCardPoolByFaction } from './config/cardRegistry';
import { getBaseCardId } from './domain/ids';

// Summoner Wars 作弊系统配置
const normalizePlayerId = (playerId: string): PlayerId | null => {
    if (playerId === '0' || playerId === '1') return playerId;
    return null;
};

const summonerWarsCardRegistry = buildCardRegistry();

const normalizeStableCardId = (cardId: string) => getBaseCardId(cardId);

const cloneCheatCard = <T extends Card>(card: T, nextId: string): T => ({
    ...card,
    id: nextId,
});

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const collectAllCardIds = (core: SummonerWarsCore): Set<string> => {
    const allIds = new Set<string>();

    (['0', '1'] as const).forEach((playerId) => {
        const player = core.players[playerId];
        if (!player) return;
        player.hand.forEach((card) => allIds.add(card.id));
        player.deck.forEach((card) => allIds.add(card.id));
        player.discard.forEach((card) => allIds.add(card.id));
        player.activeEvents.forEach((card) => allIds.add(card.id));
    });

    core.board.forEach((row) => {
        row.forEach((cell) => {
            if (cell.unit) {
                allIds.add(cell.unit.cardId);
                cell.unit.attachedCards?.forEach((card) => allIds.add(card.id));
                cell.unit.attachedUnits?.forEach((attachedUnit) => allIds.add(attachedUnit.cardId));
            }
            if (cell.structure) {
                allIds.add(cell.structure.cardId);
            }
        });
    });

    return allIds;
};

const allocateInjectedCardId = (
    core: SummonerWarsCore,
    playerId: PlayerId,
    stableCardId: string,
) => {
    const allIds = collectAllCardIds(core);
    const matcher = new RegExp(`^${escapeRegExp(stableCardId)}-${playerId}-(\\d+)$`);
    let nextIndex = 0;

    allIds.forEach((id) => {
        const matched = id.match(matcher);
        if (!matched) return;
        const index = Number(matched[1]);
        if (Number.isFinite(index) && index >= nextIndex) {
            nextIndex = index + 1;
        }
    });

    let candidate = `${stableCardId}-${playerId}-${nextIndex}`;
    while (allIds.has(candidate)) {
        nextIndex += 1;
        candidate = `${stableCardId}-${playerId}-${nextIndex}`;
    }
    return candidate;
};

const registerDebugCardDefinition = (cardsByBaseId: Map<string, Card>, card: Card | undefined) => {
    if (!card) return;

    const stableCardId = normalizeStableCardId(card.id);
    if (card.cardType === 'unit' && card.unitClass === 'summoner') return;

    if (cardsByBaseId.has(stableCardId)) return;

    const canonicalCard = summonerWarsCardRegistry.get(stableCardId);
    cardsByBaseId.set(
        stableCardId,
        canonicalCard
            ? { ...canonicalCard }
            : { ...card, id: stableCardId },
    );
};

const getConfiguredDebugCardPool = (core: SummonerWarsCore, playerId: PlayerId): Card[] => {
    const cardsByBaseId = new Map<string, Card>();
    const selectedFaction = core.selectedFactions[playerId];
    const customDeckData = core.customDeckData?.[playerId];
    const player = core.players[playerId];

    if (!player) return [];

    if (!player) return [];

    if (customDeckData?.cards?.length) {
        customDeckData.cards.forEach((entry) => {
            registerDebugCardDefinition(cardsByBaseId, summonerWarsCardRegistry.get(entry.cardId));
        });
    } else if (selectedFaction && selectedFaction !== 'unselected') {
        getCardPoolByFaction(selectedFaction as FactionId).forEach((card) => {
            registerDebugCardDefinition(cardsByBaseId, card);
        });
    }

    player.deck.forEach((card) => registerDebugCardDefinition(cardsByBaseId, card));
    player.hand.forEach((card) => registerDebugCardDefinition(cardsByBaseId, card));
    player.discard.forEach((card) => registerDebugCardDefinition(cardsByBaseId, card));
    player.activeEvents.forEach((card) => registerDebugCardDefinition(cardsByBaseId, card));
    core.board.forEach((row) => {
        row.forEach((cell) => {
            if (cell.unit?.owner === playerId) {
                registerDebugCardDefinition(cardsByBaseId, cell.unit.card);
                cell.unit.attachedCards?.forEach((card) => registerDebugCardDefinition(cardsByBaseId, card));
                cell.unit.attachedUnits?.forEach((attachedUnit) => registerDebugCardDefinition(cardsByBaseId, attachedUnit.card));
            }
            if (cell.structure?.owner === playerId) {
                registerDebugCardDefinition(cardsByBaseId, cell.structure.card);
            }
        });
    });
    core.board.forEach((row) => {
        row.forEach((cell) => {
            if (cell.unit?.owner === playerId) {
                registerDebugCardDefinition(cardsByBaseId, cell.unit.card);
                cell.unit.attachedCards?.forEach((card) => registerDebugCardDefinition(cardsByBaseId, card));
                cell.unit.attachedUnits?.forEach((attachedUnit) => registerDebugCardDefinition(cardsByBaseId, attachedUnit.card));
            }
            if (cell.structure?.owner === playerId) {
                registerDebugCardDefinition(cardsByBaseId, cell.structure.card);
            }
        });
    });

    return Array.from(cardsByBaseId.entries()).map(([stableCardId, card]) => ({
        ...card,
        id: stableCardId,
    }));
};

const getUniqueDeckMatchesByAtlas = (
    deck: SummonerWarsCore['players']['0']['deck'],
    atlasIndex: number,
) => {
    const matchedCards = deck
        .map((card, deckIndex) => ({ card, deckIndex }))
        .filter(({ card }) => card.spriteIndex === atlasIndex);

    if (matchedCards.length === 0) return [];

    const distinctStableKeys = new Set(
        matchedCards.map(({ card }) => `${card.spriteAtlas ?? 'cards'}:${normalizeStableCardId(card.id)}`),
    );

    return distinctStableKeys.size === 1 ? matchedCards : [];
};

export const summonerWarsCheatModifier: CheatResourceModifier<SummonerWarsCore> = {
    getResource: (core, playerId, resourceId) => {
        if (resourceId !== 'magic') return undefined;
        const normalizedId = normalizePlayerId(playerId);
        if (!normalizedId) return undefined;
        return core.players[normalizedId]?.magic;
    },
    setResource: (core, playerId, resourceId, value) => {
        if (resourceId !== 'magic') return core;
        const normalizedId = normalizePlayerId(playerId);
        if (!normalizedId) return core;
        const player = core.players[normalizedId];
        if (!player) return core;
        return {
            ...core,
            players: {
                ...core.players,
                [normalizedId]: {
                    ...player,
                    magic: value,
                },
            },
        };
    },
    setPhase: (core, phase) => ({
        ...core,
        phase: phase as GamePhase,
    }),
    dealCardByIndex: (core, playerId, deckIndex) => {
        const normalizedId = normalizePlayerId(playerId);
        if (!normalizedId) return core;
        const player = core.players[normalizedId];
        if (!player || deckIndex < 0 || deckIndex >= player.deck.length) return core;
        const newDeck = [...player.deck];
        const [card] = newDeck.splice(deckIndex, 1);
        return {
            ...core,
            players: {
                ...core.players,
                [normalizedId]: {
                    ...player,
                    deck: newDeck,
                    hand: [...player.hand, card],
                },
            },
        };
    },
    dealCardByAtlasIndex: (core, playerId, atlasIndex) => {
        const normalizedId = normalizePlayerId(playerId);
        if (!normalizedId) return core;
        const player = core.players[normalizedId];
        if (!player) return core;
        // atlas 指令保留给旧教程/兼容链路：只在牌库中存在唯一稳定卡面时才移动。
        const matchedCards = getUniqueDeckMatchesByAtlas(player.deck, atlasIndex);
        if (matchedCards.length === 0) return core;

        const newDeck = [...player.deck];
        const [{ deckIndex }] = matchedCards;
        const [card] = newDeck.splice(deckIndex, 1);
        return {
            ...core,
            players: {
                ...core.players,
                [normalizedId]: {
                    ...player,
                    deck: newDeck,
                    hand: [...player.hand, card],
                },
            },
        };
    },
    addCardToHandByCardId: (core, playerId, cardId) => {
        const normalizedId = normalizePlayerId(playerId);
        if (!normalizedId) return core;
        const player = core.players[normalizedId];
        if (!player) return core;

        const stableCardId = normalizeStableCardId(cardId);
        const sourceCard = getConfiguredDebugCardPool(core, normalizedId)
            .find((card) => normalizeStableCardId(card.id) === stableCardId);
        if (!sourceCard) return core;

        const injectedCardId = allocateInjectedCardId(core, normalizedId, stableCardId);
        const injectedCard = cloneCheatCard(sourceCard, injectedCardId);

        return {
            ...core,
            players: {
                ...core.players,
                [normalizedId]: {
                    ...player,
                    hand: [...player.hand, injectedCard],
                },
            },
        };
    },
    dealCardToDiscard: (core, playerId, atlasIndex) => {
        const normalizedId = normalizePlayerId(playerId);
        if (!normalizedId) return core;
        const player = core.players[normalizedId];
        if (!player) return core;
        // atlas 指令保留给旧教程/兼容链路：只在牌库中存在唯一稳定卡面时才移动。
        const matchedCards = getUniqueDeckMatchesByAtlas(player.deck, atlasIndex);
        if (matchedCards.length === 0) return core;

        const newDeck = [...player.deck];
        const [{ deckIndex }] = matchedCards;
        const [card] = newDeck.splice(deckIndex, 1);
        return {
            ...core,
            players: {
                ...core.players,
                [normalizedId]: {
                    ...player,
                    deck: newDeck,
                    discard: [...player.discard, card],
                },
            },
        };
    },
};

// 创建系统集合（包含 FlowSystem）
const systems = [
    new CharacterSelectionSystem({ setupPhaseName: 'setup' }),
    createFlowSystem<SummonerWarsCore>({ hooks: summonerWarsFlowHooks }),
    createEventStreamSystem(),
    createActionLogSystem({
        commandAllowlist: ACTION_ALLOWLIST,
        formatEntry: formatSummonerWarsActionEntry,
    }),
    createUndoSystem({
        maxSnapshots: 3,
        snapshotCommandAllowlist: UNDO_ALLOWLIST,
        // 回合切换时固定创建快照，确保玩家至少能回滚到回合开始
        snapshotOnNewTurn: true,
        turnStartPhase: 'summon',
    }),
    createInteractionSystem(),
    createSimpleChoiceSystem(),
    createSummonerWarsInteractionSystem(),
    createMultistepChoiceSystem(),
    createRematchSystem(),
    createResponseWindowSystem(),
    createTutorialSystem(),
    createCheatSystem<SummonerWarsCore>(summonerWarsCheatModifier),
] as unknown as EngineSystem<SummonerWarsCore>[];

// 适配器配置
const adapterConfig: AdapterConfig<SummonerWarsCore> = {
    domain: SummonerWarsDomain,
    systems,
    minPlayers: 2,
    maxPlayers: 2,
    commandTypes: [
        SW_COMMANDS.SELECT_FACTION,
        SW_COMMANDS.SWAP_SEAT,
        SW_COMMANDS.SELECT_CUSTOM_DECK,
        SW_COMMANDS.PLAYER_READY,
        SW_COMMANDS.PLAYER_UNREADY,
        SW_COMMANDS.HOST_START_GAME,
        SW_COMMANDS.SUMMON_UNIT,
        SW_COMMANDS.SELECT_UNIT,
        SW_COMMANDS.MOVE_UNIT,
        SW_COMMANDS.BUILD_STRUCTURE,
        SW_COMMANDS.DECLARE_ATTACK,
        SW_COMMANDS.RESOLVE_PENDING_ATTACK,
        // 旧客户端兼容（no-op）
        SW_COMMANDS.CONFIRM_ATTACK,
        SW_COMMANDS.DISCARD_FOR_MAGIC,
        SW_COMMANDS.END_PHASE,
        SW_COMMANDS.PLAY_EVENT,
        SW_COMMANDS.BLOOD_SUMMON_STEP,
        SW_COMMANDS.ACTIVATE_ABILITY,
    ],
};

const shouldSuppressSummonerWarsOnlineAiActiveTurnCandidate = (args: {
    state: MatchState<unknown>;
    phase: string;
    currentPlayerId: string;
}): boolean => {
    if (args.phase !== 'summon' && args.phase !== 'factionSelect') {
        return false;
    }

    const core = args.state.core as {
        hostStarted?: unknown;
        hostPlayerId?: unknown;
        turnOrder?: unknown;
        selectedFactions?: unknown;
        readyPlayers?: unknown;
    } | undefined;
    if (core?.hostStarted !== false) {
        return false;
    }

    const selectedFactions = core?.selectedFactions && typeof core.selectedFactions === 'object'
        ? core.selectedFactions as Record<string, unknown>
        : {};
    const readyPlayers = core?.readyPlayers && typeof core.readyPlayers === 'object'
        ? core.readyPlayers as Record<string, unknown>
        : {};
    const currentFaction = selectedFactions[args.currentPlayerId];
    const hasSelectedFaction = typeof currentFaction === 'string'
        && currentFaction.length > 0
        && currentFaction !== 'unselected';
    if (!hasSelectedFaction) {
        return false;
    }

    const hostPlayerId = typeof core.hostPlayerId === 'string' ? core.hostPlayerId : null;
    if (!hostPlayerId) {
        return false;
    }

    if (args.currentPlayerId !== hostPlayerId) {
        return readyPlayers[args.currentPlayerId] === true;
    }

    const allPlayerIds = Array.isArray(core.turnOrder)
        ? core.turnOrder.filter((playerId): playerId is string => typeof playerId === 'string')
        : Object.keys(selectedFactions);
    const otherPlayerIds = allPlayerIds.filter((playerId) => playerId !== hostPlayerId);
    if (otherPlayerIds.length === 0) {
        return false;
    }

    return !otherPlayerIds.every((playerId) => {
        const faction = selectedFactions[playerId];
        return typeof faction === 'string'
            && faction.length > 0
            && faction !== 'unselected'
            && readyPlayers[playerId] === true;
    });
};

// 引擎配置
export const engineConfig = {
    ...createGameEngine(adapterConfig),
    onlineAiRecovery: {
        advancePhaseCommandType: SW_COMMANDS.END_PHASE,
        reportObservedRecoveryWithoutForcedCommand: true,
        publicPregameLegalActionPhases: ['factionSelect', 'summon'],
        shouldSuppressActiveTurnCandidate: shouldSuppressSummonerWarsOnlineAiActiveTurnCandidate,
    },
};
registerGameAiRuntime(summonerWarsAiRuntime);

export default engineConfig;

// 注册卡牌预览获取函数
registerCardPreviewGetter('summonerwars', getSummonerWarsCardPreviewRef);

// 注册关键图片解析器（骰子/卡牌/地图等预加载）
registerCriticalImageResolver('summonerwars', summonerWarsCriticalImageResolver);

// 导出类型
export type { SummonerWarsCore as SummonerWarsState } from './domain';
