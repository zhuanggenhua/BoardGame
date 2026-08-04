/**
 * DiceThrone 领域内核
 */

import type { DomainCore, GameOverResult, MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { registerDiceDefinition } from './diceRegistry';
import { resourceSystem } from './resourceSystem';
import type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent, HeroState, CharacterId, TurnPhase, InteractionDescriptor, DtResponseWindowType, SeatControllerKind, PendingDefenderChoice } from './types';
import { INITIAL_HEALTH } from './types';
import { RESOURCE_IDS } from './resources';
import { validateCommand } from './commandValidation';
import { execute } from './execute';
import { reduce } from './reducer';
import { playerView } from './view';
import { buildTeamIdByPlayerIdFromSeatingOrder, getActiveDice, getPendingBonusSettlementDice, getTeamId, isTeamMode } from './rules';
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
import { gunslingerDiceDefinition } from '../heroes/gunslinger/diceConfig';
import { samuraiDiceDefinition } from '../heroes/samurai/diceConfig';
import { treantDiceDefinition } from '../heroes/treant/diceConfig';
import { ninjaDiceDefinition } from '../heroes/ninja/diceConfig';
import { zhanshujiaDiceDefinition } from '../heroes/zhanshujia/diceConfig';
import { cursedPirateDiceDefinition } from '../heroes/cursed_pirate/diceConfig';
import { artificerDiceDefinition } from '../heroes/artificer/diceConfig';
import { tianshiDiceDefinition } from '../heroes/tianshi/diceConfig';

// 注册 DiceThrone 游戏特定条件（骰子组合、顺子等）
registerDiceThroneConditions();

// 注册 角色 骰子与资源定义
registerDiceDefinition(monkDiceDefinition);
registerDiceDefinition(barbarianDiceDefinition);
registerDiceDefinition(pyromancerDiceDefinition);
registerDiceDefinition(moonElfDiceDefinition);
registerDiceDefinition(shadowThiefDiceDefinition);
registerDiceDefinition(paladinDiceDefinition);
registerDiceDefinition(gunslingerDiceDefinition);
registerDiceDefinition(samuraiDiceDefinition);
registerDiceDefinition(treantDiceDefinition);
registerDiceDefinition(ninjaDiceDefinition);
registerDiceDefinition(zhanshujiaDiceDefinition);
registerDiceDefinition(cursedPirateDiceDefinition);
registerDiceDefinition(artificerDiceDefinition);
registerDiceDefinition(tianshiDiceDefinition);
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

    setup: (playerIds: PlayerId[], _random: RandomFn, setupData?: unknown): DiceThroneCore => {
        const players: Record<PlayerId, HeroState> = {};
        const selectedCharacters: Record<PlayerId, CharacterId> = {};
        const rawSetupData = (setupData && typeof setupData === 'object') ? setupData as Record<string, unknown> : undefined;
        const seatingOrderInput = rawSetupData?.seatingOrder;
        const resolvedSeatingOrder = Array.isArray(seatingOrderInput)
            ? seatingOrderInput.filter((pid): pid is PlayerId => typeof pid === 'string' && playerIds.includes(pid))
            : [];
        const seatingOrder = resolvedSeatingOrder.length === playerIds.length ? resolvedSeatingOrder : [...playerIds];

        const rawSeatControllers = rawSetupData?.seatControllers;
        const seatControllers = (() => {
            if (!rawSeatControllers || typeof rawSeatControllers !== 'object') {
                return undefined;
            }

            const normalized: Record<PlayerId, SeatControllerKind> = {};
            let hasEntry = false;
            for (const pid of playerIds) {
                const controller = (rawSeatControllers as Record<string, unknown>)[pid];
                if (controller && typeof controller === 'object' && 'type' in controller) {
                    const type = (controller as { type?: unknown }).type;
                    if (type === 'human' || type === 'local-ai' || type === 'remote-ai') {
                        normalized[pid] = controller as SeatControllerKind;
                        hasEntry = true;
                        continue;
                    }
                    if (type === 'ai') {
                        normalized[pid] = { type: 'local-ai' } as SeatControllerKind;
                        hasEntry = true;
                        continue;
                    }
                }
                if (controller === 'ai') {
                    normalized[pid] = { type: 'local-ai' } as SeatControllerKind;
                    hasEntry = true;
                    continue;
                }
                if (controller === 'human') {
                    normalized[pid] = { type: 'human' } as SeatControllerKind;
                    hasEntry = true;
                }
            }
            return hasEntry ? normalized : undefined;
        })();

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

        const isTeamSetup = playerIds.length === 4;
        const teamIdByPlayerId = isTeamSetup
            ? buildTeamIdByPlayerIdFromSeatingOrder(seatingOrder)
            : undefined;

        return {
            players,
            selectedCharacters,
            readyPlayers,
            hostPlayerId: playerIds[0],
            hostStarted: false,
            seatingOrder: isTeamSetup ? seatingOrder : undefined,
            teamIdByPlayerId,
            teamHealth: isTeamSetup ? { A: INITIAL_HEALTH, B: INITIAL_HEALTH } : undefined,
            seatControllers,
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
            attackResolvedSequence: 0,
            afterAttackResponseWindowSequence: 0,
        };
    },

    normalizeRuntimeState: normalizeLegacyDiceThroneMatchState,

    validate: (state, command) => {
        const normalizedCore = normalizeLegacyDiceThroneMatchState(state).core;
        const phase = (state.sys?.phase ?? 'setup') as TurnPhase;
        const interaction = state.sys?.interaction?.current;
        const currentResponseWindow = state.sys?.responseWindow?.current;
        const responseWindowType = currentResponseWindow?.windowType as DtResponseWindowType | undefined;

        // dt:card-interaction：data 直接是 PendingInteraction（状态选择类）
        // multistep-choice：骰子类交互，从 meta 构造兼容的 InteractionDescriptor
        let pendingInteraction: InteractionDescriptor | undefined;
        let pendingDefenderChoice: PendingDefenderChoice | undefined;
        if (interaction?.kind === 'dt:card-interaction') {
            pendingInteraction = interaction.data as InteractionDescriptor;
        } else if (interaction?.kind === 'dt:defender-choice') {
            pendingDefenderChoice = interaction.data as PendingDefenderChoice;
        } else if (interaction?.kind === 'multistep-choice') {
            const data = (interaction.data as Record<string, unknown> | undefined) ?? {};
            const meta = data.meta as Record<string, unknown> | undefined;
            if (meta?.dtType === 'modifyDie' || meta?.dtType === 'selectDie') {
                const rawAllowedDieIds = Array.isArray(data.allowedDieIds)
                    ? data.allowedDieIds
                    : Array.isArray(meta?.allowedDieIds)
                        ? meta?.allowedDieIds
                        : [];
                const allowedDieIds = rawAllowedDieIds.length > 0
                    ? Array.from(new Set(rawAllowedDieIds.filter((dieId): dieId is number => typeof dieId === 'number')))
                    : getActiveDice(normalizedCore).map(die => die.id);
                const completedDieIds = Array.isArray(data.completedDieIds)
                    ? data.completedDieIds.filter((dieId): dieId is number => typeof dieId === 'number')
                    : [];
                pendingInteraction = {
                    id: interaction.id,
                    playerId: interaction.playerId,
                    sourceCardId: typeof data.sourceId === 'string' ? data.sourceId : '',
                    type: meta.dtType === 'selectDie' ? 'selectDie' : 'modifyDie',
                    titleKey: '',
                    selectCount: typeof meta.selectCount === 'number' ? meta.selectCount : 1,
                    selected: completedDieIds.map(String),
                    dieModifyConfig: meta.dieModifyConfig as InteractionDescriptor['dieModifyConfig'] | undefined,
                    diceOwnerId: typeof meta.diceOwnerId === 'string' ? meta.diceOwnerId : undefined,
                    targetOpponentDice: meta.targetOpponentDice === true,
                    skipAbilityReselection: meta.skipAbilityReselection === true,
                    allowedDieIds,
                    completedDieIds,
                } as InteractionDescriptor;
            }
        }

        return validateCommand(
            normalizedCore,
            command,
            phase,
            pendingInteraction,
            pendingDefenderChoice,
            responseWindowType,
            currentResponseWindow,
        );
    },
    execute: (state, command, random) => execute(
        normalizeLegacyDiceThroneMatchState(state),
        command,
        random,
    ),
    reduce,
    playerView: (state, viewingPlayerId) => playerView(normalizeLegacyDiceThroneCoreState(state), viewingPlayerId),

    isGameOver: (state: DiceThroneCore): GameOverResult | undefined => {
        // 在 setup 阶段不进行胜负判定，避免血量未初始化导致误判
        if (!state.hostStarted) return undefined;

        if (isTeamMode(state)) {
            const resolveTeamHealth = (teamId: 'A' | 'B') => {
                if (state.teamHealth?.[teamId] !== undefined) {
                    return state.teamHealth[teamId]!;
                }
                for (const [playerId, player] of Object.entries(state.players)) {
                    if (getTeamId(state, playerId) === teamId) {
                        return player.resources[RESOURCE_IDS.HP] ?? 0;
                    }
                }
                return 0;
            };
            const teamA = resolveTeamHealth('A');
            const teamB = resolveTeamHealth('B');

            if (teamA <= 0 && teamB <= 0) {
                return { draw: true };
            }
            if (teamA <= 0 || teamB <= 0) {
                const winningTeam = teamA <= 0 ? 'B' : 'A';
                const winners = Object.keys(state.players).filter(
                    (playerId) => getTeamId(state, playerId) === winningTeam,
                );
                return winners.length > 0 ? { winner: winners[0], winners } : { draw: true };
            }
            return undefined;
        }

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

function normalizeLegacyDiceThroneMatchState(state: MatchState<DiceThroneCore>): MatchState<DiceThroneCore> {
    const normalizedCore = normalizeLegacyDiceThroneCoreState(state.core);
    if (normalizedCore === state.core) {
        return state;
    }
    return {
        ...state,
        core: normalizedCore,
    };
}

function normalizeLegacyDiceThroneCoreState(core: DiceThroneCore): DiceThroneCore {
    const settlement = core.pendingBonusDiceSettlement;
    if (!settlement || Array.isArray(settlement.dice)) {
        return core;
    }

    return {
        ...core,
        pendingBonusDiceSettlement: {
            ...settlement,
            dice: getPendingBonusSettlementDice(settlement),
        },
    };
}

// 导出类型
export type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent } from './types';
export * from './rules';

// 导出常量
export { STATUS_IDS, TOKEN_IDS, DICE_FACE_IDS, ARTIFICER_DICE_FACE_IDS, TIANSHI_DICE_FACE_IDS, DICETHRONE_COMMANDS } from './ids';
export { RESOURCE_IDS } from './resources';
