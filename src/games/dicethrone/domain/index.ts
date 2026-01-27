/**
 * DiceThrone 领域内核
 */

import type { DomainCore, GameOverResult, PlayerId, RandomFn } from '../../../engine/types';
import { diceSystem } from '../../../systems/DiceSystem';
import { resourceSystem } from '../../../systems/ResourceSystem';
import type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent, HeroState, Die, DieFace } from './types';
import { RESOURCE_IDS } from './resources';
import { validateCommand } from './commands';
import { execute } from './execute';
import { reduce } from './reducer';
import { playerView } from './view';
import { registerDiceThroneConditions } from '../conditions';
import { MONK_ABILITIES } from '../monk/abilities';
import { MONK_STATUS_EFFECTS } from '../monk/statusEffects';
import { MONK_TOKENS, MONK_INITIAL_TOKENS } from '../monk/tokens';
import { getMonkStartingDeck } from '../monk/cards';
import { monkDiceDefinition } from '../monk/diceConfig';
import { monkResourceDefinitions } from '../monk/resourceConfig';


// 注册 DiceThrone 游戏特定条件（骰子组合、顺子等）
registerDiceThroneConditions();

// 注册 Monk 骰子定义
diceSystem.registerDefinition(monkDiceDefinition);

// 注册 Monk 资源定义
monkResourceDefinitions.forEach(def => resourceSystem.registerDefinition(def));

// ============================================================================
// 领域内核定义
// ============================================================================

export const DiceThroneDomain: DomainCore<DiceThroneCore, DiceThroneCommand, DiceThroneEvent> = {
    gameId: 'dicethrone',

    setup: (playerIds: PlayerId[], random: RandomFn): DiceThroneCore => {
        const players: Record<PlayerId, HeroState> = {};

        for (const pid of playerIds) {
            const deck = getMonkStartingDeck(random);
            const startingHand = deck.splice(0, 4);

            // 创建初始资源池
            const resources = resourceSystem.createPool([RESOURCE_IDS.CP, RESOURCE_IDS.HP]);

            players[pid] = {
                id: `player-${pid}`,
                characterId: 'monk',
                resources,
                hand: startingHand,
                deck,
                discard: [],
                statusEffects: {
                    stun: 0,
                },
                tokens: { ...MONK_INITIAL_TOKENS },
                tokenStackLimits: Object.fromEntries(MONK_TOKENS.map(t => [t.id, t.stackLimit])),
                damageShields: [],
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
                upgradeCardByAbilityId: {},
            };
        }

        const dice: Die[] = Array.from({ length: 5 }, (_, index) => {
            const die = diceSystem.createDie('monk-dice', { id: index, initialValue: 1 });
            return {
                ...die,
                symbol: die.symbol as DieFace | null,
            };
        });

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
            statusDefinitions: MONK_STATUS_EFFECTS,
            tokenDefinitions: MONK_TOKENS,
            lastEffectSourceByPlayerId: {},
        };
    },

    validate: (state, command) => validateCommand(state.core, command),
    execute: (state, command, random) => execute(state, command, random),
    reduce,
    playerView,

    isGameOver: (state: DiceThroneCore): GameOverResult | undefined => {
        const playerIds = Object.keys(state.players);
        const defeated = playerIds.filter(id => (state.players[id]?.resources[RESOURCE_IDS.HP] ?? 0) <= 0);
        
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
