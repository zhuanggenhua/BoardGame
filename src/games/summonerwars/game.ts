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
    type CheatResourceModifier,
} from '../../engine';
import { createGameEngine } from '../../engine/adapter';
import { SummonerWarsDomain, SW_COMMANDS } from './domain';
import type { GamePhase, PlayerId, SummonerWarsCore } from './domain/types';
import { summonerWarsFlowHooks } from './domain/flowHooks';
import { registerCardPreviewGetter } from '../../components/game/registry/cardPreviewRegistry';
import { registerCriticalImageResolver } from '../../core';
import { getSummonerWarsCardPreviewRef } from './ui/cardPreviewHelper';
import { ACTION_ALLOWLIST, UNDO_ALLOWLIST, formatSummonerWarsActionEntry } from './actionLog';
import { summonerWarsCriticalImageResolver } from './criticalImageResolver';

// Summoner Wars 作弊系统配置
const normalizePlayerId = (playerId: string): PlayerId | null => {
    if (playerId === '0' || playerId === '1') return playerId;
    return null;
};

const summonerWarsCheatModifier: CheatResourceModifier<SummonerWarsCore> = {
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
        // 在牌库中查找匹配精灵图索引的卡牌
        const cardIndex = player.deck.findIndex(c => c.spriteIndex === atlasIndex);
        if (cardIndex === -1) return core;
        const newDeck = [...player.deck];
        const [card] = newDeck.splice(cardIndex, 1);
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
    dealCardToDiscard: (core, playerId, atlasIndex) => {
        const normalizedId = normalizePlayerId(playerId);
        if (!normalizedId) return core;
        const player = core.players[normalizedId];
        if (!player) return core;
        // 在牌库中查找匹配精灵图索引的卡牌，移入弃牌堆
        const cardIndex = player.deck.findIndex(c => c.spriteIndex === atlasIndex);
        if (cardIndex === -1) return core;
        const newDeck = [...player.deck];
        const [card] = newDeck.splice(cardIndex, 1);
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
    createFlowSystem<SummonerWarsCore>({ hooks: summonerWarsFlowHooks }),
    createEventStreamSystem(),
    createActionLogSystem({
        commandAllowlist: ACTION_ALLOWLIST,
        formatEntry: formatSummonerWarsActionEntry,
    }),
    createUndoSystem({
        maxSnapshots: 3,
        snapshotCommandAllowlist: UNDO_ALLOWLIST,
    }),
    createInteractionSystem(),
    createSimpleChoiceSystem(),
    createMultistepChoiceSystem(),
    createRematchSystem(),
    createResponseWindowSystem(),
    createTutorialSystem(),
    createCheatSystem<SummonerWarsCore>(summonerWarsCheatModifier),
];

// 适配器配置
const adapterConfig = {
    domain: SummonerWarsDomain,
    systems,
    minPlayers: 2,
    maxPlayers: 2,
    commandTypes: [
        SW_COMMANDS.SELECT_FACTION,
        SW_COMMANDS.SELECT_CUSTOM_DECK,
        SW_COMMANDS.PLAYER_READY,
        SW_COMMANDS.HOST_START_GAME,
        SW_COMMANDS.SUMMON_UNIT,
        SW_COMMANDS.SELECT_UNIT,
        SW_COMMANDS.MOVE_UNIT,
        SW_COMMANDS.BUILD_STRUCTURE,
        SW_COMMANDS.DECLARE_ATTACK,
        SW_COMMANDS.CONFIRM_ATTACK,
        SW_COMMANDS.DISCARD_FOR_MAGIC,
        SW_COMMANDS.END_PHASE,
        SW_COMMANDS.PLAY_EVENT,
        SW_COMMANDS.BLOOD_SUMMON_STEP,
        SW_COMMANDS.ACTIVATE_ABILITY,
    ],
};

// 引擎配置
export const engineConfig = createGameEngine(adapterConfig);

export default engineConfig;

// 注册卡牌预览获取函数
registerCardPreviewGetter('summonerwars', getSummonerWarsCardPreviewRef);

// 注册关键图片解析器（骰子/卡牌/地图等预加载）
registerCriticalImageResolver('summonerwars', summonerWarsCriticalImageResolver);

// 导出类型
export type { SummonerWarsCore as SummonerWarsState } from './domain';
