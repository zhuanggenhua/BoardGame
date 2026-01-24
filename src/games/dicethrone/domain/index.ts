/**
 * DiceThrone 领域内核
 */

import type { DomainCore, GameOverResult, PlayerId } from '../../../engine/types';
import type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent, HeroState, Die } from './types';
import { INITIAL_HEALTH, INITIAL_CP } from './types';
import { validateCommand } from './commands';
import { execute } from './execute';
import { reduce } from './reducer';
import { playerView } from './view';
import { MONK_ABILITIES } from '../monk/abilities';
import { MONK_STATUS_EFFECTS } from '../monk/statusEffects';
import { getMonkStartingDeck } from '../monk/cards';

// ============================================================================
// 领域内核定义
// ============================================================================

export const DiceThroneDomain: DomainCore<DiceThroneCore, DiceThroneCommand, DiceThroneEvent> = {
    gameId: 'dicethrone',

    setup: (playerIds: PlayerId[]): DiceThroneCore => {
        const players: Record<PlayerId, HeroState> = {};

        for (const pid of playerIds) {
            const deck = getMonkStartingDeck();
            const startingHand = deck.splice(0, 3);

            players[pid] = {
                id: `player-${pid}`,
                characterId: 'monk',
                health: INITIAL_HEALTH,
                cp: INITIAL_CP,
                hand: startingHand,
                deck,
                discard: [],
                statusEffects: {
                    evasive: 0,
                    taiji: 0,
                    stun: 0,
                    purify: 0,
                    chi: 0,
                },
                abilities: MONK_ABILITIES,
                abilityLevels: {
                    'fist-technique': 1,
                    'zen-forget': 1,
                    'harmony': 1,
                    'lotus-palm': 1,
                    'taiji-combo': 1,
                    'thunder-strike': 1,
                    'calm-water': 1,
                    'meditation': 1,
                },
            };
        }

        const dice: Die[] = Array.from({ length: 5 }, (_, index) => ({
            id: index,
            value: 1,
            isKept: false,
        }));

        return {
            players,
            dice,
            rollCount: 0,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: false,
            turnPhase: 'upkeep',
            activePlayerId: playerIds[0],
            startingPlayerId: playerIds[0],
            turnNumber: 1,
            pendingAttack: null,
            availableAbilityIds: [],
            statusDefinitions: MONK_STATUS_EFFECTS,
            lastEffectSourceByPlayerId: {},
        };
    },

    validate: validateCommand,
    execute,
    reduce,
    playerView,

    isGameOver: (state: DiceThroneCore): GameOverResult | undefined => {
        const playerIds = Object.keys(state.players);
        const defeated = playerIds.filter(id => state.players[id]?.health <= 0);
        
        if (defeated.length === 0) return undefined;
        
        if (defeated.length === playerIds.length) {
            return { draw: true };
        }
        
        if (defeated.length === 1) {
            const winner = playerIds.find(id => id !== defeated[0]);
            if (winner) return { winner };
        }
        
        return { draw: true };
    },
};

// 导出类型
export type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent } from './types';
export * from './rules';
