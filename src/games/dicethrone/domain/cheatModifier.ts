/**
 * DiceThrone 作弊系统配置
 * 从 game.ts 提取
 */

import type { CheatResourceModifier } from '../../../engine';
import { HEROES_DATA } from '../heroes';
import type { AbilityCard, DiceThroneCore, DiceThroneEvent, Die } from './types';
import { createCharacterDice } from './characters';
import { getDieFaceByDefinition, getRollerId } from './rules';
import { reduce } from './reducer';
import { isSettledReplayOnlyRollContext, resolveCurrentRollContext } from './rollContext';
import { RESOURCE_IDS } from './resources';

export const DICETHRONE_CHEAT_COMMANDS = {
    DEAL_DAMAGE: 'SYS_CHEAT_DEAL_DAMAGE',
} as const;

const getCardSourceAtlasIndex = (card: { sourceAtlasIndex?: number; previewRef?: { type: string; index?: number } }) => (
    typeof card.sourceAtlasIndex === 'number'
        ? card.sourceAtlasIndex
        : card.previewRef?.type === 'atlas'
            ? card.previewRef.index
            : undefined
);

const cloneAbilityCard = (card: AbilityCard): AbilityCard => ({ ...card });

const applyDiceValues = (dice: Die[], values: number[]): Die[] => (
    dice.map((die, index) => {
        const value = values[index] ?? die.value;
        const face = getDieFaceByDefinition(die.definitionId, value) ?? die.symbol ?? null;
        return {
            ...die,
            value,
            symbol: face,
            symbols: face ? [face] : [],
        };
    })
);

const createCheatDiceForRoller = (core: DiceThroneCore, phase?: string): Die[] => {
    const rollerId = getRollerId(core, phase as Parameters<typeof getRollerId>[1]);
    const characterId = core.players[rollerId]?.characterId;
    if (!characterId || characterId === 'unselected') return [];
    return createCharacterDice(characterId);
};

const getCheatDieModifyTarget = (
    kind: NonNullable<DiceThroneCore['currentRollContext']>['kind'],
): Extract<
    Extract<DiceThroneEvent, { type: 'DIE_MODIFIED' }>['payload']['target'],
    'activeDie' | 'pendingBonusDie' | 'evasionDie'
> => {
    if (kind === 'bonus') return 'pendingBonusDie';
    if (kind === 'evasion') return 'evasionDie';
    return 'activeDie';
};

const getHeroCardPool = (characterId: string | null | undefined): AbilityCard[] => {
    if (!characterId) return [];
    return HEROES_DATA[characterId]?.cards ?? [];
};

const appendCardToHand = (
    core: DiceThroneCore,
    playerId: string,
    card: AbilityCard,
): DiceThroneCore => {
    const player = core.players[playerId];
    if (!player) return core;

    return {
        ...core,
        players: {
            ...core.players,
            [playerId]: {
                ...player,
                hand: [...player.hand, cloneAbilityCard(card)],
            },
        },
    };
};

export const diceThroneCheatModifier: CheatResourceModifier<DiceThroneCore> = {
    getResource: (core, playerId, resourceId) => {
        return core.players[playerId]?.resources[resourceId];
    },
    setResource: (core, playerId, resourceId, value) => {
        const player = core.players[playerId];
        if (!player) return core;
        return {
            ...core,
            players: {
                ...core.players,
                [playerId]: {
                    ...player,
                    resources: {
                        ...player.resources,
                        [resourceId]: value,
                    },
                },
            },
        };
    },
    setStatus: (core, playerId, statusId, amount) => {
        const player = core.players[playerId];
        if (!player) return core;
        return {
            ...core,
            players: {
                ...core.players,
                [playerId]: {
                    ...player,
                    statusEffects: {
                        ...player.statusEffects,
                        [statusId]: amount,
                    },
                },
            },
        };
    },
    setPhase: (core, _phase) => {
        // 阶段现由 sys.phase 管理，core 不再存储 turnPhase
        return core;
    },
    setDice: (core, values, options) => {
        const currentRollContext = resolveCurrentRollContext(core, options?.phase as Parameters<typeof resolveCurrentRollContext>[1]);
        if (currentRollContext?.dice.length) {
            const target = getCheatDieModifyTarget(currentRollContext.kind);
            const shouldPrimeMainRoll = target === 'activeDie';
            const primedCore = shouldPrimeMainRoll
                ? {
                    ...core,
                    rollCount: core.rollCount || 1,
                    rollConfirmed: false,
                }
                : core;

            return currentRollContext.dice.reduce<DiceThroneCore>((state, die, index) => {
                const newValue = values[index] ?? die.value;
                if (newValue === die.value) return state;
                return reduce(state, {
                    type: 'DIE_MODIFIED',
                    payload: {
                        dieId: die.id,
                        oldValue: die.value,
                        newValue,
                        playerId: currentRollContext.ownerPlayerId,
                        ownerId: die.ownerId ?? currentRollContext.ownerPlayerId,
                        target,
                    },
                    sourceCommandType: 'SYS_CHEAT_SET_DICE',
                    timestamp: 0,
                } as DiceThroneEvent);
            }, primedCore);
        }

        if (
            isSettledReplayOnlyRollContext(core.currentRollContext)
            && core.currentRollContext.dice.length > 0
        ) {
            return {
                ...core,
                currentRollContext: {
                    ...core.currentRollContext,
                    dice: applyDiceValues(core.currentRollContext.dice, values),
                },
            };
        }

        const dice = core.dice.length > 0
            ? core.dice
            : createCheatDiceForRoller(core, options?.phase);
        if (dice.length === 0) return core;

        return {
            ...core,
            dice: applyDiceValues(dice, values),
            rollCount: core.rollCount || 1,
            rollConfirmed: false,
        };
    },
    setToken: (core, playerId, tokenId, amount) => {
        const player = core.players[playerId];
        if (!player) return core;
        return {
            ...core,
            players: {
                ...core.players,
                [playerId]: {
                    ...player,
                    tokens: {
                        ...player.tokens,
                        [tokenId]: amount,
                    },
                },
            },
        };
    },
    dealCardByIndex: (core, playerId, deckIndex) => {
        const player = core.players[playerId];
        if (!player || deckIndex < 0 || deckIndex >= player.deck.length) return core;

        // 从牌库指定位置取出卡牌
        const newDeck = [...player.deck];
        const [card] = newDeck.splice(deckIndex, 1);

        return {
            ...core,
            players: {
                ...core.players,
                [playerId]: {
                    ...player,
                    deck: newDeck,
                    hand: [...player.hand, card],
                },
            },
        };
    },
    dealCardByAtlasIndex: (core, playerId, atlasIndex) => {
        const player = core.players[playerId];
        if (!player) return core;

        const matchedDeckEntries = player.deck
            .map((card, deckIndex) => ({ card, deckIndex }))
            .filter(({ card }) => getCardSourceAtlasIndex(card) === atlasIndex);
        if (matchedDeckEntries.length > 1) return core;
        if (matchedDeckEntries.length === 1) {
            const newDeck = [...player.deck];
            const [{ deckIndex }] = matchedDeckEntries;
            const [card] = newDeck.splice(deckIndex, 1);

            return {
                ...core,
                players: {
                    ...core.players,
                    [playerId]: {
                        ...player,
                        deck: newDeck,
                        hand: [...player.hand, card],
                    },
                },
            };
        }

        // 调试模式允许从角色完整卡池直接补牌，不受“当前剩余牌库”限制。
        const matchedPoolCards = getHeroCardPool(player.characterId)
            .filter((card) => getCardSourceAtlasIndex(card) === atlasIndex);
        if (matchedPoolCards.length !== 1) return core;

        return appendCardToHand(core, playerId, matchedPoolCards[0]);
    },
    addCardToHandByCardId: (core, playerId, cardId) => {
        const player = core.players[playerId];
        if (!player) return core;

        const card = getHeroCardPool(player.characterId).find((entry) => entry.id === cardId);
        if (!card) return core;

        return appendCardToHand(core, playerId, card);
    },
    customCommands: {
        [DICETHRONE_CHEAT_COMMANDS.DEAL_DAMAGE]: ({ state, command }) => {
            const payload = command.payload as {
                targetId?: string;
                amount?: number;
                sourceAbilityId?: string;
                sourcePlayerId?: string;
                damageScope?: 'attack' | 'direct';
                bypassShields?: boolean;
            };
            const targetId = payload.targetId;
            const amount = payload.amount;

            if (!targetId || !state.core.players[targetId]) {
                return { halt: true, error: 'cheat_damage_target_not_found' };
            }
            if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
                return { halt: true, error: 'cheat_damage_invalid_amount' };
            }

            const targetHp = state.core.players[targetId]?.resources[RESOURCE_IDS.HP] ?? 0;
            const damageEvent: DiceThroneEvent = {
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId,
                    amount,
                    actualDamage: Math.min(amount, targetHp),
                    ...(payload.sourceAbilityId ? { sourceAbilityId: payload.sourceAbilityId } : {}),
                    sourcePlayerId: payload.sourcePlayerId ?? command.playerId,
                    damageScope: payload.damageScope ?? 'direct',
                    ...(payload.bypassShields ? { bypassShields: true } : {}),
                },
                sourceCommandType: command.type,
                timestamp: command.timestamp ?? Date.now(),
            };

            return {
                halt: true,
                events: [damageEvent],
            };
        },
    },
};
