import type { Command, MatchState, PlayerId } from '../../engine/types';
import { createAiLegalActionId, createActionKindScorer, createScoredLocalAiPolicy } from '../../engine/ai';
import type { AiDecisionContext, AiLegalAction, GameAiRuntime, LocalAiActionScorer } from '../../engine/ai';
import type { InteractionDescriptor as EngineInteractionDescriptor, PromptMultiConfig } from '../../engine/systems/InteractionSystem';
import { SummonerWarsDomain } from './domain';
import { abilityRegistry } from './domain/abilities';
import { getActivatableAbilities, canActivateAbility } from './domain/abilityHelpers';
import {
    BOARD_COLS,
    getPlayerUnits,
    getSummoner,
    getUnitAt,
    getStructureAt,
    getValidAttackTargetsEnhanced,
    getValidBuildPositions,
    getValidMoveTargetsEnhanced,
    getValidSummonPositions,
    manhattanDistance,
} from './domain/helpers';
import { SW_COMMANDS } from './domain/types';
import type {
    Card,
    CellCoord,
    FactionId,
    GamePhase,
    SummonerWarsCore,
    UnitCard,
} from './domain/types';

type SummonerWarsState = MatchState<SummonerWarsCore>;
type SetupPhase = 'setup';
type SummonerWarsTurnPhase = SetupPhase | GamePhase;

type SummonerWarsInteractionOption = {
    id?: string;
    label?: string;
    value?: unknown;
    disabled?: boolean;
};

const FACTION_PRIORITY: FactionId[] = [
    'necromancer',
    'paladin',
    'frost',
    'goblin',
    'barbaric',
    'trickster',
];

const createCommand = (playerId: PlayerId, type: string, payload: unknown = {}): Command => ({
    type,
    playerId,
    payload,
    timestamp: 0,
});

const isInteractionCommand = (type: string): boolean => type.startsWith('SYS_INTERACTION_');

const isCommandValid = (
    state: SummonerWarsState,
    playerId: PlayerId,
    type: string,
    payload: unknown = {},
): boolean => {
    if (isInteractionCommand(type)) return true;
    const result = SummonerWarsDomain.validate(state, createCommand(playerId, type, payload) as never);
    return result.valid;
};

const appendAction = (
    actions: AiLegalAction[],
    state: SummonerWarsState,
    playerId: PlayerId,
    action: AiLegalAction,
): void => {
    if (action.commands.length === 0) return;
    const isValid = action.commands.every((command) => isCommandValid(state, playerId, command.type, command.payload));
    if (!isValid) return;
    actions.push(action);
};

const buildSimpleChoicePayload = (
    optionIds: string[],
    multi: PromptMultiConfig | undefined,
    optionValue?: unknown,
): Record<string, unknown> => {
    if (optionIds.length <= 1 && !multi) {
        return optionValue === undefined
            ? { optionId: optionIds[0] }
            : { optionId: optionIds[0], mergedValue: optionValue };
    }
    if (optionIds.length <= 1 && (multi?.min ?? 0) <= 1) {
        return optionValue === undefined
            ? { optionId: optionIds[0] }
            : { optionId: optionIds[0], mergedValue: optionValue };
    }
    return { optionIds };
};

const getEnemyPlayerId = (playerId: PlayerId): PlayerId => (playerId === '0' ? '1' : '0');

const getCurrentPhase = (state: SummonerWarsState): SummonerWarsTurnPhase => {
    if (!state.core.hostStarted) {
        return 'setup';
    }
    return state.core.phase;
};

const getFactionPriority = (factionId: FactionId): number => {
    const index = FACTION_PRIORITY.indexOf(factionId);
    return index >= 0 ? index : FACTION_PRIORITY.length + 10;
};

const getCardKeepValue = (card: Card): number => {
    if (card.cardType === 'unit') {
        return card.strength * 18 + card.life * 8 + card.cost * 6;
    }
    if (card.cardType === 'structure') {
        return 40 + card.life * 6 + card.cost * 5 + (card.isGate ? 10 : 0);
    }
    return 18 + card.cost * 6 + (card.isActive ? 8 : 0) + (card.playPhase === 'any' ? 4 : 0);
};

const getCenterScore = (position: CellCoord): number => {
    const centerCol = Math.floor((BOARD_COLS - 1) / 2);
    return Math.max(0, 4 - Math.abs(position.col - centerCol));
};

const cloneCoreWithMovedUnit = (
    core: SummonerWarsCore,
    from: CellCoord,
    to: CellCoord,
): SummonerWarsCore | null => {
    const unit = core.board[from.row]?.[from.col]?.unit;
    if (!unit) return null;
    const board = core.board.map((row) => row.map((cell) => ({ ...cell })));
    board[from.row][from.col].unit = undefined;
    board[to.row][to.col].unit = {
        ...unit,
        position: to,
    };
    return {
        ...core,
        board,
    };
};

const buildInteractionActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiLegalAction[] | null => {
    const current = state.sys.interaction?.current as EngineInteractionDescriptor | undefined;
    if (!current || current.playerId !== playerId) return null;

    if (current.kind === 'simple-choice') {
        const data = current.data as {
            options?: SummonerWarsInteractionOption[];
            multi?: PromptMultiConfig;
        };
        const availableOptions = (data.options ?? []).filter((option): option is Required<Pick<SummonerWarsInteractionOption, 'id'>> & SummonerWarsInteractionOption => {
            return typeof option.id === 'string' && option.disabled !== true;
        });
        const minCount = Math.max(1, data.multi?.min ?? 1);

        return availableOptions.map((option, index) => ({
            actionId: createAiLegalActionId('interaction', current.id, option.id),
            kind: 'interaction-choice',
            label: option.label ?? `交互选择 ${index + 1}`,
            commands: [{
                type: 'SYS_INTERACTION_RESPOND',
                payload: buildSimpleChoicePayload(
                    minCount > 1 ? availableOptions.slice(0, minCount).map((item) => item.id) : [option.id],
                    data.multi,
                    option.value,
                ),
            }],
            metadata: {
                interactionId: current.id,
                optionId: option.id,
                optionValue: option.value,
            },
        }));
    }

    if (current.kind === 'multistep-choice') {
        return [
            {
                actionId: createAiLegalActionId('interaction', current.id, 'confirm'),
                kind: 'interaction-confirm',
                label: '确认交互',
                commands: [{
                    type: 'SYS_INTERACTION_CONFIRM',
                    payload: { interactionId: current.id },
                }],
                metadata: { interactionId: current.id },
            },
            {
                actionId: createAiLegalActionId('interaction', current.id, 'cancel'),
                kind: 'interaction-cancel',
                label: '取消交互',
                commands: [{
                    type: 'SYS_INTERACTION_CANCEL',
                    payload: { interactionId: current.id },
                }],
                metadata: { interactionId: current.id },
            },
        ];
    }

    return null;
};

const buildSetupActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const selectedFaction = state.core.selectedFactions[playerId];
    const isHost = playerId === state.core.hostPlayerId;
    const isReady = state.core.readyPlayers[playerId];

    if (!selectedFaction || selectedFaction === 'unselected') {
        for (const factionId of FACTION_PRIORITY) {
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('setup', 'select-faction', factionId),
                kind: 'setup-select-faction',
                label: `选择阵营 ${factionId}`,
                commands: [{
                    type: SW_COMMANDS.SELECT_FACTION,
                    payload: { factionId },
                }],
                metadata: {
                    factionId,
                    priority: getFactionPriority(factionId),
                },
            });
        }
        return actions;
    }

    if (!isHost && !isReady) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('setup', 'player-ready'),
            kind: 'setup-ready',
            label: '准备完成',
            commands: [{
                type: SW_COMMANDS.PLAYER_READY,
                payload: {},
            }],
        });
    }

    if (isHost) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('setup', 'host-start'),
            kind: 'setup-host-start',
            label: '开始游戏',
            commands: [{
                type: SW_COMMANDS.HOST_START_GAME,
                payload: {},
            }],
        });
    }

    return actions;
};

const buildActivatedAbilityActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
    phase: GamePhase,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const units = getPlayerUnits(state.core, playerId);

    for (const unit of units) {
        const abilityIds = getActivatableAbilities(unit, phase, state.core);
        for (const abilityId of abilityIds) {
            const abilityDef = abilityRegistry.get(abilityId);
            if (!abilityDef) continue;
            if (abilityDef.trigger !== 'activated') continue;
            if (abilityDef.requiresTargetSelection) continue;
            if (!canActivateAbility(state.core, unit, abilityId, playerId)) continue;

            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('activate-ability', unit.instanceId, abilityId),
                kind: 'activate-ability',
                label: `发动技能 ${abilityDef.name}`,
                commands: [{
                    type: SW_COMMANDS.ACTIVATE_ABILITY,
                    payload: {
                        abilityId,
                        sourceUnitId: unit.instanceId,
                    },
                }],
                metadata: {
                    abilityId,
                    sourceUnitId: unit.instanceId,
                    sourcePosition: unit.position,
                },
            });
        }
    }

    return actions;
};

const buildSummonActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const player = state.core.players[playerId];
    const summonPositions = getValidSummonPositions(state.core, playerId);
    const enemySummoner = getSummoner(state.core, getEnemyPlayerId(playerId));

    for (const card of player.hand) {
        if (card.cardType !== 'unit') continue;
        for (const position of summonPositions) {
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('summon-unit', card.id, position.row, position.col),
                kind: 'summon-unit',
                label: `召唤 ${card.name}`,
                commands: [{
                    type: SW_COMMANDS.SUMMON_UNIT,
                    payload: {
                        cardId: card.id,
                        position,
                    },
                }],
                metadata: {
                    cardId: card.id,
                    cardName: card.name,
                    cost: card.cost,
                    strength: card.strength,
                    life: card.life,
                    position,
                    centerScore: getCenterScore(position),
                    distanceToEnemySummoner: enemySummoner ? manhattanDistance(position, enemySummoner.position) : 99,
                },
            });
        }
    }

    return actions;
};

const buildMoveActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const enemySummoner = getSummoner(state.core, getEnemyPlayerId(playerId));

    for (const unit of getPlayerUnits(state.core, playerId)) {
        const targets = getValidMoveTargetsEnhanced(state.core, unit.position);
        for (const to of targets) {
            const movedCore = cloneCoreWithMovedUnit(state.core, unit.position, to);
            const attackTargetsAfterMove = movedCore ? getValidAttackTargetsEnhanced(movedCore, to).length : 0;
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('move-unit', unit.instanceId, to.row, to.col),
                kind: 'move-unit',
                label: `移动 ${unit.card.name}`,
                commands: [{
                    type: SW_COMMANDS.MOVE_UNIT,
                    payload: {
                        from: unit.position,
                        to,
                    },
                }],
                metadata: {
                    sourceUnitId: unit.instanceId,
                    from: unit.position,
                    to,
                    attackTargetsAfterMove,
                    distanceToEnemySummonerBefore: enemySummoner ? manhattanDistance(unit.position, enemySummoner.position) : 99,
                    distanceToEnemySummonerAfter: enemySummoner ? manhattanDistance(to, enemySummoner.position) : 99,
                    centerScore: getCenterScore(to),
                    attackType: unit.card.attackType,
                },
            });
        }
    }

    return actions;
};

const buildStructureActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const player = state.core.players[playerId];
    const buildPositions = getValidBuildPositions(state.core, playerId);

    for (const card of player.hand) {
        if (card.cardType !== 'structure') continue;
        for (const position of buildPositions) {
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('build-structure', card.id, position.row, position.col),
                kind: 'build-structure',
                label: `建造 ${card.name}`,
                commands: [{
                    type: SW_COMMANDS.BUILD_STRUCTURE,
                    payload: {
                        cardId: card.id,
                        position,
                    },
                }],
                metadata: {
                    cardId: card.id,
                    cost: card.cost,
                    life: card.life,
                    position,
                    centerScore: getCenterScore(position),
                },
            });
        }
    }

    return actions;
};

const buildAttackActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];

    for (const unit of getPlayerUnits(state.core, playerId)) {
        const targets = getValidAttackTargetsEnhanced(state.core, unit.position);
        for (const target of targets) {
            const targetUnit = getUnitAt(state.core, target);
            const targetStructure = getStructureAt(state.core, target);
            const targetLifeRemaining = targetUnit
                ? targetUnit.card.life - targetUnit.damage
                : targetStructure
                    ? targetStructure.card.life - targetStructure.damage
                    : 0;
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('declare-attack', unit.instanceId, target.row, target.col),
                kind: 'declare-attack',
                label: `攻击 ${targetUnit?.card.name ?? targetStructure?.card.name ?? '目标'}`,
                commands: [{
                    type: SW_COMMANDS.DECLARE_ATTACK,
                    payload: {
                        attacker: unit.position,
                        target,
                    },
                }],
                metadata: {
                    sourceUnitId: unit.instanceId,
                    attacker: unit.position,
                    target,
                    attackerStrength: unit.card.strength,
                    attackType: unit.card.attackType,
                    targetType: targetUnit
                        ? targetUnit.card.unitClass
                        : targetStructure
                            ? 'structure'
                            : 'unknown',
                    targetLifeRemaining,
                    lethalLikely: unit.card.strength >= targetLifeRemaining,
                    targetOwner: targetUnit?.owner ?? targetStructure?.owner,
                },
            });
        }
    }

    return actions;
};

const buildMagicActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const player = state.core.players[playerId];

    for (const card of player.hand) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('discard-for-magic', card.id),
            kind: 'discard-for-magic',
            label: `弃置 ${card.name} 换魔力`,
            commands: [{
                type: SW_COMMANDS.DISCARD_FOR_MAGIC,
                payload: { cardIds: [card.id] },
            }],
            metadata: {
                cardId: card.id,
                cardType: card.cardType,
                keepValue: getCardKeepValue(card),
            },
        });
    }

    return actions;
};

const buildEndPhaseAction = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiLegalAction => ({
    actionId: createAiLegalActionId('advance-phase', getCurrentPhase(state), playerId),
    kind: 'advance-phase',
    label: '结束当前阶段',
    commands: [{
        type: SW_COMMANDS.END_PHASE,
        payload: {},
    }],
    metadata: {
        phase: getCurrentPhase(state),
    },
});

export function buildSummonerWarsAiLegalActions(args: {
    playerId: PlayerId;
    state: MatchState<unknown>;
}): AiLegalAction[] {
    const state = args.state as SummonerWarsState;
    const playerId = args.playerId;
    const interactionActions = buildInteractionActions(state, playerId);
    if (interactionActions && interactionActions.length > 0) {
        return interactionActions;
    }

    const phase = getCurrentPhase(state);
    if (phase === 'setup') {
        return buildSetupActions(state, playerId);
    }

    if (state.core.currentPlayer !== playerId) {
        return [];
    }

    switch (phase) {
        case 'summon':
            return [
                ...buildActivatedAbilityActions(state, playerId, phase),
                ...buildSummonActions(state, playerId),
                buildEndPhaseAction(state, playerId),
            ];
        case 'move':
            return [
                ...buildActivatedAbilityActions(state, playerId, phase),
                ...buildMoveActions(state, playerId),
                buildEndPhaseAction(state, playerId),
            ];
        case 'build':
            return [
                ...buildActivatedAbilityActions(state, playerId, phase),
                ...buildStructureActions(state, playerId),
                buildEndPhaseAction(state, playerId),
            ];
        case 'attack':
            return [
                ...buildActivatedAbilityActions(state, playerId, phase),
                ...buildAttackActions(state, playerId),
                buildEndPhaseAction(state, playerId),
            ];
        case 'magic':
            return [
                ...buildMagicActions(state, playerId),
                buildEndPhaseAction(state, playerId),
            ];
        case 'draw':
        default:
            return [buildEndPhaseAction(state, playerId)];
    }
}

const actionKindScorer = createActionKindScorer('action-kind', {
    'interaction-choice': 240,
    'interaction-confirm': 180,
    'interaction-cancel': -40,
    'setup-select-faction': 140,
    'setup-ready': 170,
    'setup-host-start': 220,
    'summon-unit': 130,
    'move-unit': 90,
    'build-structure': 55,
    'declare-attack': 210,
    'activate-ability': 110,
    'discard-for-magic': 25,
    'advance-phase': -80,
});

const interactionScorer: LocalAiActionScorer = {
    id: 'interaction-priority',
    score(_context, action) {
        if (action.kind !== 'interaction-choice') return null;
        const optionId = String(action.metadata?.optionId ?? '').toLowerCase();
        if (optionId.includes('confirm') || optionId.includes('accept') || optionId.includes('yes')) {
            return { score: 30, reason: '优先确认当前可执行的交互分支' };
        }
        if (optionId.includes('cancel') || optionId.includes('skip') || optionId.includes('pass')) {
            return { score: -20, reason: '能执行效果时尽量不直接跳过交互' };
        }
        return 5;
    },
};

const setupScorer: LocalAiActionScorer = {
    id: 'setup-priority',
    score(_context, action) {
        if (action.kind === 'setup-select-faction') {
            const priority = typeof action.metadata?.priority === 'number'
                ? action.metadata.priority
                : FACTION_PRIORITY.length + 10;
            return {
                score: 80 - priority * 8,
                reason: `优先选择当前 baseline 更稳的阵营 ${String(action.metadata?.factionId ?? '')}`,
            };
        }
        if (action.kind === 'setup-ready') {
            return { score: 120, reason: '选完阵营后尽快准备完成' };
        }
        if (action.kind === 'setup-host-start') {
            return { score: 200, reason: '双方已就绪时尽快开始对局' };
        }
        return null;
    },
};

const summonScorer: LocalAiActionScorer = {
    id: 'summon-tempo',
    score(_context, action) {
        if (action.kind !== 'summon-unit') return null;
        const cost = typeof action.metadata?.cost === 'number' ? action.metadata.cost : 0;
        const strength = typeof action.metadata?.strength === 'number' ? action.metadata.strength : 0;
        const life = typeof action.metadata?.life === 'number' ? action.metadata.life : 0;
        const centerScore = typeof action.metadata?.centerScore === 'number' ? action.metadata.centerScore : 0;
        const distanceToEnemySummoner = typeof action.metadata?.distanceToEnemySummoner === 'number'
            ? action.metadata.distanceToEnemySummoner
            : 99;
        return {
            score: strength * 22 + life * 6 + cost * 8 + centerScore * 5 - distanceToEnemySummoner,
            reason: `优先召唤更有场面收益的单位 ${String(action.metadata?.cardName ?? '')}`,
        };
    },
};

const moveScorer: LocalAiActionScorer = {
    id: 'move-pressure',
    score(_context, action) {
        if (action.kind !== 'move-unit') return null;
        const before = typeof action.metadata?.distanceToEnemySummonerBefore === 'number'
            ? action.metadata.distanceToEnemySummonerBefore
            : 99;
        const after = typeof action.metadata?.distanceToEnemySummonerAfter === 'number'
            ? action.metadata.distanceToEnemySummonerAfter
            : 99;
        const attackTargetsAfterMove = typeof action.metadata?.attackTargetsAfterMove === 'number'
            ? action.metadata.attackTargetsAfterMove
            : 0;
        const centerScore = typeof action.metadata?.centerScore === 'number' ? action.metadata.centerScore : 0;
        return {
            score: (before - after) * 20 + attackTargetsAfterMove * 45 + centerScore * 4,
            reason: attackTargetsAfterMove > 0
                ? '优先移动到能形成攻击威胁的位置'
                : '优先向敌方召唤师和中线施压',
        };
    },
};

const attackScorer: LocalAiActionScorer = {
    id: 'attack-value',
    score(_context, action) {
        if (action.kind !== 'declare-attack') return null;
        const targetType = String(action.metadata?.targetType ?? '');
        const attackerStrength = typeof action.metadata?.attackerStrength === 'number'
            ? action.metadata.attackerStrength
            : 0;
        const targetLifeRemaining = typeof action.metadata?.targetLifeRemaining === 'number'
            ? action.metadata.targetLifeRemaining
            : 99;
        const lethalLikely = action.metadata?.lethalLikely === true;

        let score = attackerStrength * 8;
        if (targetType === 'summoner') score += 180;
        if (targetType === 'champion') score += 70;
        if (targetType === 'common') score += 40;
        if (targetType === 'structure') score += 15;
        if (lethalLikely) score += 60;
        score += Math.max(0, 10 - targetLifeRemaining);

        return {
            score,
            reason: targetType === 'summoner'
                ? '优先压制敌方召唤师'
                : lethalLikely
                    ? '优先处理接近击杀的目标'
                    : '优先攻击更有价值的目标',
        };
    },
};

const buildScorer: LocalAiActionScorer = {
    id: 'build-structure',
    score(_context, action) {
        if (action.kind !== 'build-structure') return null;
        const life = typeof action.metadata?.life === 'number' ? action.metadata.life : 0;
        const cost = typeof action.metadata?.cost === 'number' ? action.metadata.cost : 0;
        const centerScore = typeof action.metadata?.centerScore === 'number' ? action.metadata.centerScore : 0;
        return {
            score: 20 + life * 5 + cost * 4 + centerScore * 2,
            reason: '没有更高优先级动作时再考虑铺设建筑',
        };
    },
};

const discardScorer: LocalAiActionScorer = {
    id: 'discard-for-magic',
    score(_context, action) {
        if (action.kind !== 'discard-for-magic') return null;
        const keepValue = typeof action.metadata?.keepValue === 'number' ? action.metadata.keepValue : 999;
        return {
            score: 80 - keepValue,
            reason: '优先把保留价值较低的手牌换成魔力',
        };
    },
};

const abilityScorer: LocalAiActionScorer = {
    id: 'activated-ability',
    score(_context, action) {
        if (action.kind !== 'activate-ability') return null;
        return {
            score: 75,
            reason: `可无目标发动的技能通常有即时收益：${String(action.metadata?.abilityId ?? '')}`,
        };
    },
};

const phaseTempoScorer: LocalAiActionScorer = {
    id: 'phase-tempo',
    score(context, action) {
        if (action.kind !== 'advance-phase') return null;
        const hasOtherPlayableActions = context.legalActions.some((candidate) => {
            return candidate.actionId !== action.actionId
                && candidate.kind !== 'interaction-cancel';
        });
        return {
            score: hasOtherPlayableActions ? -120 : 90,
            reason: hasOtherPlayableActions ? '当前阶段还有更高价值的动作，不应过早结束' : '当前阶段收益已接近耗尽，可以推进流程',
        };
    },
};

const baselineLocalPolicy = createScoredLocalAiPolicy({
    id: 'baseline',
    scorers: [
        actionKindScorer,
        interactionScorer,
        setupScorer,
        summonScorer,
        moveScorer,
        attackScorer,
        buildScorer,
        discardScorer,
        abilityScorer,
        phaseTempoScorer,
    ],
    maxReasonCount: 3,
});

export const summonerWarsAiRuntime: GameAiRuntime = {
    gameId: 'summonerwars',
    buildLegalActions: buildSummonerWarsAiLegalActions,
    localPolicies: {
        baseline: baselineLocalPolicy,
    },
    defaultLocalPolicyId: 'baseline',
};
