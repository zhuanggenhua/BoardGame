/**
 * DiceThrone 领域内核
 */

import type { DomainCore, GameOverResult, PlayerId, RandomFn } from '../../../engine/types';
import { registerDiceDefinition } from './diceRegistry';
import { resourceSystem } from './resourceSystem';
import type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent, HeroState, CharacterId, TurnPhase, InteractionDescriptor } from './types';
import { RESOURCE_IDS } from './resources';
import { validateCommand } from './commandValidation';
import { execute } from './execute';
import { reduce } from './reducer';
import { playerView } from './view';
import { registerDiceThroneConditions } from '../conditions';
import { ALL_TOKEN_DEFINITIONS } from './characters';
import { monkDiceDefinition } from '../heroes/monk/diceConfig';
import { monkResourceDefinitions } from '../heroes/monk/resourceConfig';
import { barbarianDiceDefinition } from '../heroes/barbarian/diceConfig';
import { barbarianResourceDefinitions } from '../heroes/barbarian/resourceConfig';
import { pyromancerDiceDefinition } from '../heroes/pyromancer/diceConfig';
import { pyromancerResourceDefinitions } from '../heroes/pyromancer/resourceConfig';
import { moonElfDiceDefinition } from '../heroes/moon_elf/diceConfig';
import { moonElfResourceDefinitions } from '../heroes/moon_elf/resourceConfig';
import { shadowThiefDiceDefinition } from '../heroes/shadow_thief/diceConfig';
import { SHADOW_THIEF_RESOURCES as shadowThiefResourceDefinitions } from '../heroes/shadow_thief/resourceConfig';
import { paladinDiceDefinition } from '../heroes/paladin/diceConfig';
import { paladinResourceDefinitions } from '../heroes/paladin/resourceConfig';

// 注册 DiceThrone 游戏特定条件（骰子组合、顺子等）
registerDiceThroneConditions();

// 注册 角色 骰子与资源定义
registerDiceDefinition(monkDiceDefinition);
registerDiceDefinition(barbarianDiceDefinition);
registerDiceDefinition(pyromancerDiceDefinition);
registerDiceDefinition(moonElfDiceDefinition);
registerDiceDefinition(shadowThiefDiceDefinition);
registerDiceDefinition(paladinDiceDefinition);
monkResourceDefinitions.forEach(def => resourceSystem.registerDefinition(def));
barbarianResourceDefinitions.forEach(def => resourceSystem.registerDefinition(def));
pyromancerResourceDefinitions.forEach(def => resourceSystem.registerDefinition(def));
moonElfResourceDefinitions.forEach(def => resourceSystem.registerDefinition(def));
shadowThiefResourceDefinitions.forEach(def => resourceSystem.registerDefinition(def));
paladinResourceDefinitions.forEach(def => resourceSystem.registerDefinition(def));

// ============================================================================
// 领域内核定义
// ============================================================================

export const DiceThroneDomain: DomainCore<DiceThroneCore, DiceThroneCommand, DiceThroneEvent> = {
    gameId: 'dicethrone',

    setup: (playerIds: PlayerId[], _random: RandomFn): DiceThroneCore => {
        const players: Record<PlayerId, HeroState> = {};
        const selectedCharacters: Record<PlayerId, CharacterId> = {};

        for (const pid of playerIds) {
            // 初始占位，等待选角后再按需初始化具体资源/技能/牌库
            players[pid] = {
                id: `player-${pid}`,
                characterId: 'unselected',
                resources: {},
                hand: [],
                deck: [],
                discard: [],
                statusEffects: {},
                tokens: {},
                tokenStackLimits: {},
                damageShields: [],
                abilities: [],
                abilityLevels: {},
                upgradeCardByAbilityId: {},
            };
            selectedCharacters[pid] = 'unselected';
        }

        const readyPlayers: Record<PlayerId, boolean> = {};
        for (const pid of playerIds) {
            readyPlayers[pid] = false;
        }

        return {
            players,
            selectedCharacters,
            readyPlayers,
            hostPlayerId: playerIds[0],
            hostStarted: false,
            dice: [], // 选角后再创建
            rollCount: 0,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: false,
            activePlayerId: playerIds[0],
            startingPlayerId: playerIds[0],
            turnNumber: 1,
            pendingAttack: null,
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            lastEffectSourceByPlayerId: {},
        };
    },

    validate: (state, command) => {
        const phase = (state.sys?.phase ?? 'setup') as TurnPhase;
        const interaction = state.sys?.interaction?.current;

        // dt:card-interaction：data 直接是 PendingInteraction（状态选择类）
        // multistep-choice：骰子类交互，从 meta 构造兼容的 InteractionDescriptor
        let pendingInteraction: InteractionDescriptor | undefined;
        if (interaction?.kind === 'dt:card-interaction') {
            pendingInteraction = interaction.data as InteractionDescriptor;
        } else if (interaction?.kind === 'multistep-choice') {
            const meta = (interaction.data as any)?.meta;
            if (meta?.dtType === 'modifyDie' || meta?.dtType === 'selectDie') {
                // 构造最小兼容结构，validateCommand 只用 playerId 做权限检查
                pendingInteraction = {
                    id: interaction.id,
                    playerId: interaction.playerId,
                    sourceCardId: (interaction.data as any)?.sourceId ?? '',
                    type: meta.dtType === 'selectDie' ? 'selectDie' : 'modifyDie',
                    titleKey: '',
                } as InteractionDescriptor;
            }
        }

        return validateCommand(state.core, command, phase, pendingInteraction);
    },
    execute: (state, command, random) => execute(state, command, random),
    reduce,
    playerView,

    isGameOver: (state: DiceThroneCore): GameOverResult | undefined => {
        // 在 setup 阶段不进行胜负判定，避免血量未初始化导致误判
        if (!state.hostStarted) return undefined;

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

// 导出常量
export { STATUS_IDS, TOKEN_IDS, DICE_FACE_IDS } from './ids';
export { RESOURCE_IDS } from './resources';
