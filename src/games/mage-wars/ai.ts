import { FLOW_COMMANDS } from '../../engine/systems/FlowSystem';
import { INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';
import type { Command, MatchState, PlayerId } from '../../engine/types';
import {
    buildAiLegalActionsFromInteractionDecision,
    createAiLegalActionId,
    type AiDecisionContext,
    type AiLegalAction,
    type GameAiRuntime,
    type LocalAiPolicy,
    type AiDecisionDescriptor,
} from '../../engine/ai';
import { MageWarsDomain, MAGE_WARS_COMMANDS } from './domain';
import type {
    MageWarsArenaObjectState,
    MageWarsCommand,
    MageWarsCore,
    MageWarsPhase,
} from './domain/types';
import { MAGE_WARS_MAX_PREPARED_SPELLS } from './domain/constants';
import { getMageWarsSpellCardFromConfig } from './data/configPackage';
import { getMageWarsPlayerSpellbookCardIds } from './domain/spellbook';
import { resolveMageWarsSpellRawCostTotal } from './domain/spellRules';
import {
    areAdjacentZones,
    getOpponentId,
} from './domain/utils';
import {
    isMageWarsConfiguredSpellcastingSource,
    isMageWarsSpellcastingObject,
} from './domain/spellCasting';

type MageWarsState = MatchState<MageWarsCore>;

type InteractionOption = {
    id?: unknown;
    label?: unknown;
    disabled?: unknown;
};

type SimpleChoiceInteraction = {
    id?: unknown;
    kind?: unknown;
    playerId?: unknown;
    data?: {
        sourceId?: unknown;
        ai?: {
            decisions?: unknown;
        };
        options?: InteractionOption[];
        multi?: {
            min?: unknown;
            max?: unknown;
        };
    };
};

const SEQUENTIAL_PHASES = new Set<MageWarsPhase>([
    'deployment',
    'initiativeQuickcast',
    'creatureAction',
    'finalQuickcast',
]);

const ACTION_PRIORITY: Record<string, number> = {
    'interaction-choice': 0,
    'interaction-confirm': 0,
    'interaction-skip': 0,
    'plan-object-spell': 10,
    'plan-spells': 20,
    'cast-object-spell': 30,
    'cast-spell': 40,
    'object-attack': 50,
    attack: 60,
    'move-object': 70,
    'move-mage': 80,
    'guard-object': 90,
    guard: 100,
    'advance-phase': 200,
};

const asMageWarsState = (state: MatchState<unknown>): MageWarsState => state as MageWarsState;

const createAction = (args: {
    kind: string;
    label: string;
    commandType: string;
    payload: Record<string, unknown> | undefined;
    keyParts: Array<string | number | undefined | null>;
    metadata?: Record<string, unknown>;
}): AiLegalAction => ({
    actionId: createAiLegalActionId(args.kind, ...args.keyParts),
    kind: args.kind,
    label: args.label,
    commands: [{
        type: args.commandType,
        payload: args.payload ?? {},
    }],
    ...(args.metadata ? { metadata: args.metadata } : {}),
});

function isInteractionCommand(type: string): boolean {
    return Object.values(INTERACTION_COMMANDS).includes(
        type as typeof INTERACTION_COMMANDS[keyof typeof INTERACTION_COMMANDS],
    );
}

function getCurrentInteraction(state: MageWarsState): SimpleChoiceInteraction | undefined {
    return state.sys.interaction?.current as SimpleChoiceInteraction | undefined;
}

function validateInteractionCommand(
    state: MageWarsState,
    playerId: PlayerId,
    command: Pick<Command, 'type' | 'payload'>,
): boolean {
    const interaction = getCurrentInteraction(state);
    if (!interaction || interaction.playerId !== playerId) return false;
    if (typeof interaction.id !== 'string' || interaction.id.length === 0) return false;

    const payload = command.payload as {
        interactionId?: unknown;
        optionId?: unknown;
        optionIds?: unknown;
    } | undefined;
    if (payload?.interactionId !== interaction.id) return false;

    if (command.type === INTERACTION_COMMANDS.CANCEL) {
        return true;
    }
    if (command.type === INTERACTION_COMMANDS.CONFIRM) {
        return true;
    }
    if (command.type !== INTERACTION_COMMANDS.RESPOND || interaction.kind !== 'simple-choice') {
        return false;
    }

    const availableOptions = (interaction.data?.options ?? [])
        .filter((option): option is Required<Pick<InteractionOption, 'id'>> & InteractionOption => (
            typeof option?.id === 'string' && option.disabled !== true
        ));
    const optionIds = new Set(availableOptions.map((option) => option.id));
    const selectedOptionIds = Array.isArray(payload.optionIds)
        ? payload.optionIds
        : typeof payload.optionId === 'string'
            ? [payload.optionId]
            : [];
    const selected = selectedOptionIds.filter((optionId): optionId is string => typeof optionId === 'string');

    const minSelections = typeof interaction.data?.multi?.min === 'number'
        ? interaction.data.multi.min
        : 1;
    const maxSelections = typeof interaction.data?.multi?.max === 'number'
        ? interaction.data.multi.max
        : minSelections;

    if (selected.length < minSelections) return false;
    if (selected.length > maxSelections) return false;
    return selected.every((optionId) => optionIds.has(optionId));
}

function canAdvancePhase(state: MageWarsState, playerId: PlayerId): boolean {
    if (state.core.gameResult || state.sys.gameover) return false;
    if (state.sys.interaction?.current || state.sys.responseWindow?.current) return false;
    const phase = state.sys.phase as MageWarsPhase;
    if (!SEQUENTIAL_PHASES.has(phase)) return false;
    if ((state.core.phaseReadyPlayerIds ?? []).includes(playerId)) return false;
    const phaseActorId = state.core.phaseActorId ?? state.core.currentPlayerId;
    return phaseActorId === playerId;
}

function isCommandValid(
    state: MageWarsState,
    playerId: PlayerId,
    command: Pick<Command, 'type' | 'payload'>,
): boolean {
    if (command.type === FLOW_COMMANDS.ADVANCE_PHASE) {
        return canAdvancePhase(state, playerId);
    }
    if (isInteractionCommand(command.type)) {
        return validateInteractionCommand(state, playerId, command);
    }
    return MageWarsDomain.validate(state, {
        type: command.type,
        playerId,
        payload: command.payload ?? {},
        timestamp: 0,
    } as MageWarsCommand).valid;
}

function appendIfValid(
    actions: AiLegalAction[],
    state: MageWarsState,
    playerId: PlayerId,
    action: AiLegalAction,
): void {
    if (
        action.commands.length > 0
        && action.commands.every((command) => isCommandValid(state, playerId, command))
    ) {
        actions.push(action);
    }
}

function buildCurrentInteractionActions(state: MageWarsState, playerId: PlayerId): AiLegalAction[] {
    const interaction = getCurrentInteraction(state);
    if (!interaction || interaction.kind !== 'simple-choice' || interaction.playerId !== playerId) {
        return [];
    }
    const interactionId = typeof interaction.id === 'string' ? interaction.id : '';
    if (!interactionId) return [];

    const actions: AiLegalAction[] = [];
    const semanticDecisions = Array.isArray(interaction.data?.ai?.decisions)
        ? interaction.data.ai.decisions
        : [];
    for (const decision of semanticDecisions) {
        for (const action of buildAiLegalActionsFromInteractionDecision(decision as AiDecisionDescriptor)) {
            appendIfValid(actions, state, playerId, action);
        }
    }
    if (actions.length > 0) {
        return actions;
    }

    const enabledOptions = (interaction.data?.options ?? [])
        .filter((option): option is Required<Pick<InteractionOption, 'id'>> & InteractionOption => (
            typeof option?.id === 'string' && option.disabled !== true
        ));
    const minSelections = typeof interaction.data?.multi?.min === 'number'
        ? Math.max(0, interaction.data.multi.min)
        : 1;
    if (minSelections === 0) {
        appendIfValid(actions, state, playerId, createAction({
            kind: 'interaction-skip',
            label: '不选择任何项',
            commandType: INTERACTION_COMMANDS.RESPOND,
            payload: { interactionId, optionIds: [] },
            keyParts: [interactionId, 'empty'],
            metadata: { interactionId, sourceId: interaction.data?.sourceId },
        }));
        return actions;
    }
    for (const option of enabledOptions) {
        appendIfValid(actions, state, playerId, createAction({
            kind: 'interaction-choice',
            label: typeof option.label === 'string' ? option.label : option.id,
            commandType: INTERACTION_COMMANDS.RESPOND,
            payload: { interactionId, optionId: option.id },
            keyParts: [interactionId, option.id],
            metadata: { interactionId, optionId: option.id, sourceId: interaction.data?.sourceId },
        }));
    }
    return actions;
}

function getDistinctSpellbookCardIds(state: MageWarsState, playerId: PlayerId): number[] {
    const player = state.core.players[playerId];
    if (!player) return [];
    return [...new Set(getMageWarsPlayerSpellbookCardIds(player))];
}

function buildPlanObjectSpellActions(state: MageWarsState, playerId: PlayerId): AiLegalAction[] {
    const actions: AiLegalAction[] = [];
    const spellCardIds = getDistinctSpellbookCardIds(state, playerId);
    const sourceObjects = Object.values(state.core.objects)
        .filter((object) => (
            object.ownerId === playerId
            && object.preparedSpellCardId === undefined
            && isMageWarsSpellcastingObject(object)
            && isMageWarsConfiguredSpellcastingSource(object.spellcastingSource)
        ))
        .sort((left, right) => left.id.localeCompare(right.id));

    for (const object of sourceObjects) {
        for (const spellCardId of spellCardIds) {
            const spellName = getMageWarsSpellCardFromConfig(spellCardId)?.name ?? String(spellCardId);
            const beforeLength = actions.length;
            appendIfValid(actions, state, playerId, createAction({
                kind: 'plan-object-spell',
                label: `${object.name} 准备 ${spellName}`,
                commandType: MAGE_WARS_COMMANDS.PLAN_OBJECT_SPELL,
                payload: { objectId: object.id, spellCardId },
                keyParts: [object.id, spellCardId],
                metadata: {
                    objectId: object.id,
                    spellCardId,
                    sourceId: object.spellcastingSource?.abilityId,
                },
            }));
            if (actions.length > beforeLength) break;
        }
    }

    return actions;
}

function buildPlanSpellsActions(state: MageWarsState, playerId: PlayerId): AiLegalAction[] {
    if ((state.core.phaseReadyPlayerIds ?? []).includes(playerId)) {
        return [];
    }
    const player = state.core.players[playerId];
    if (!player) return [];
    const spellCardIds = getMageWarsPlayerSpellbookCardIds(player)
        .slice(0, MAGE_WARS_MAX_PREPARED_SPELLS);
    const selected = spellCardIds.slice(0, MAGE_WARS_MAX_PREPARED_SPELLS);
    const actions: AiLegalAction[] = [];
    appendIfValid(actions, state, playerId, createAction({
        kind: 'plan-spells',
        label: selected.length > 0 ? `准备 ${selected.length} 张法术` : '确认不准备法术',
        commandType: MAGE_WARS_COMMANDS.PLAN_SPELLS,
        payload: { spellCardIds: selected },
        keyParts: selected.length > 0 ? selected : ['none'],
        metadata: { spellCardIds: selected },
    }));
    return actions;
}

function buildPlanningActions(state: MageWarsState, playerId: PlayerId): AiLegalAction[] {
    if (state.sys.phase !== 'planning') return [];
    return [
        ...buildPlanObjectSpellActions(state, playerId),
        ...buildPlanSpellsActions(state, playerId),
    ];
}

function resolveSpellManaCost(spellCardId: number, availableMana: number): number {
    const spell = getMageWarsSpellCardFromConfig(spellCardId);
    if (!spell) return 0;
    if (typeof spell.manaCost === 'number') return spell.manaCost;
    return Math.min(availableMana, resolveMageWarsSpellRawCostTotal(spell) ?? availableMana);
}

function buildCastPayloads(
    state: MageWarsState,
    playerId: PlayerId,
    spellCardId: number,
    casterObject?: MageWarsArenaObjectState,
): Record<string, unknown>[] {
    const player = state.core.players[playerId];
    if (!player) return [];
    const opponentId = getOpponentId(state.core, playerId);
    const casterMana = casterObject
        ? (casterObject.mana ?? 0) + player.mana
        : player.mana;
    const manaCost = resolveSpellManaCost(spellCardId, casterMana);
    const basePayload = {
        ...(casterObject ? { casterObjectId: casterObject.id } : {}),
        spellCardId,
        manaCost,
    };
    const ownObjects = Object.values(state.core.objects)
        .filter((object) => object.ownerId === playerId)
        .sort((left, right) => left.id.localeCompare(right.id));
    const enemyObjects = Object.values(state.core.objects)
        .filter((object) => object.ownerId !== playerId)
        .sort((left, right) => left.id.localeCompare(right.id));

    return [
        basePayload,
        { ...basePayload, targetZoneId: casterObject?.zoneId ?? player.mageZoneId },
        { ...basePayload, targetPlayerId: opponentId },
        { ...basePayload, targetPlayerId: playerId },
        ...enemyObjects.map((object) => ({ ...basePayload, targetObjectId: object.id })),
        ...ownObjects.map((object) => ({ ...basePayload, targetObjectId: object.id })),
    ];
}

function appendCastActions(
    actions: AiLegalAction[],
    state: MageWarsState,
    playerId: PlayerId,
    spellCardId: number,
    casterObject?: MageWarsArenaObjectState,
): void {
    const seenPayloads = new Set<string>();
    for (const payload of buildCastPayloads(state, playerId, spellCardId, casterObject)) {
        const key = JSON.stringify(payload);
        if (seenPayloads.has(key)) continue;
        seenPayloads.add(key);
        const spellName = getMageWarsSpellCardFromConfig(spellCardId)?.name ?? String(spellCardId);
        appendIfValid(actions, state, playerId, createAction({
            kind: casterObject ? 'cast-object-spell' : 'cast-spell',
            label: casterObject ? `${casterObject.name} 施放 ${spellName}` : `施放 ${spellName}`,
            commandType: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload,
            keyParts: [casterObject?.id, spellCardId, key],
            metadata: {
                spellCardId,
                ...(casterObject ? { casterObjectId: casterObject.id } : {}),
            },
        }));
    }
}

function appendCastableSpellActions(
    actions: AiLegalAction[],
    state: MageWarsState,
    playerId: PlayerId,
): void {
    const player = state.core.players[playerId];
    if (!player) return;

    for (const spellCardId of player.preparedSpellCardIds) {
        appendCastActions(actions, state, playerId, spellCardId);
    }
    for (const object of Object.values(state.core.objects)) {
        if (
            object.ownerId !== playerId
            || object.preparedSpellCardId === undefined
            || object.spellcastingSource?.phase !== state.sys.phase
        ) {
            continue;
        }
        appendCastActions(actions, state, playerId, object.preparedSpellCardId, object);
    }
}

function appendAttackActions(
    actions: AiLegalAction[],
    state: MageWarsState,
    playerId: PlayerId,
): void {
    const player = state.core.players[playerId];
    if (!player) return;
    const opponentId = getOpponentId(state.core, playerId);
    const opponent = state.core.players[opponentId];

    if (opponent?.mageZoneId === player.mageZoneId) {
        appendIfValid(actions, state, playerId, createAction({
            kind: 'attack',
            label: '法师基础攻击',
            commandType: MAGE_WARS_COMMANDS.DECLARE_ATTACK,
            payload: { targetPlayerId: opponentId },
            keyParts: [opponentId],
            metadata: { targetPlayerId: opponentId },
        }));
    }

    const enemyObjects = Object.values(state.core.objects)
        .filter((object) => object.ownerId !== playerId)
        .sort((left, right) => left.id.localeCompare(right.id));
    for (const object of Object.values(state.core.objects)
        .filter((candidate) => candidate.ownerId === playerId && candidate.kind === 'creature')
        .sort((left, right) => left.id.localeCompare(right.id))) {
        const targets = [
            { targetPlayerId: opponentId },
            ...enemyObjects.map((target) => ({ targetObjectId: target.id })),
        ];
        for (const target of targets) {
            appendIfValid(actions, state, playerId, createAction({
                kind: 'object-attack',
                label: `${object.name} 攻击`,
                commandType: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
                payload: {
                    attackerObjectId: object.id,
                    attackProfileId: 'attack-0',
                    ...target,
                },
                keyParts: [object.id, target.targetPlayerId ?? target.targetObjectId],
                metadata: {
                    attackerObjectId: object.id,
                    attackProfileId: 'attack-0',
                    ...target,
                },
            }));
        }
    }
}

function appendMovementAndGuardActions(
    actions: AiLegalAction[],
    state: MageWarsState,
    playerId: PlayerId,
): void {
    const player = state.core.players[playerId];
    if (!player) return;
    const adjacentZones = state.core.arena
        .filter((zone) => areAdjacentZones(state.core, player.mageZoneId, zone.id))
        .sort((left, right) => left.row - right.row || left.col - right.col);

    for (const zone of adjacentZones) {
        appendIfValid(actions, state, playerId, createAction({
            kind: 'move-mage',
            label: `移动法师到 ${zone.id}`,
            commandType: MAGE_WARS_COMMANDS.MOVE_MAGE,
            payload: { toZoneId: zone.id },
            keyParts: [zone.id],
            metadata: { toZoneId: zone.id },
        }));
    }
    appendIfValid(actions, state, playerId, createAction({
        kind: 'guard',
        label: '法师守卫',
        commandType: MAGE_WARS_COMMANDS.GUARD,
        payload: {},
        keyParts: ['mage'],
    }));

    const ownCreatures = Object.values(state.core.objects)
        .filter((object) => object.ownerId === playerId && object.kind === 'creature')
        .sort((left, right) => left.id.localeCompare(right.id));
    for (const object of ownCreatures) {
        const objectAdjacentZones = state.core.arena
            .filter((zone) => areAdjacentZones(state.core, object.zoneId, zone.id))
            .sort((left, right) => left.row - right.row || left.col - right.col);
        for (const zone of objectAdjacentZones) {
            appendIfValid(actions, state, playerId, createAction({
                kind: 'move-object',
                label: `${object.name} 移动到 ${zone.id}`,
                commandType: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
                payload: { objectId: object.id, toZoneId: zone.id },
                keyParts: [object.id, zone.id],
                metadata: { objectId: object.id, toZoneId: zone.id },
            }));
        }
        appendIfValid(actions, state, playerId, createAction({
            kind: 'guard-object',
            label: `${object.name} 守卫`,
            commandType: MAGE_WARS_COMMANDS.GUARD,
            payload: { objectId: object.id },
            keyParts: [object.id],
            metadata: { objectId: object.id },
        }));
    }
}

function buildPhaseActions(state: MageWarsState, playerId: PlayerId): AiLegalAction[] {
    const actions: AiLegalAction[] = [];
    if (!SEQUENTIAL_PHASES.has(state.sys.phase as MageWarsPhase)) {
        return actions;
    }
    const phaseActorId = state.core.phaseActorId ?? state.core.currentPlayerId;
    if (phaseActorId !== playerId) {
        return actions;
    }

    appendCastableSpellActions(actions, state, playerId);
    if (state.sys.phase === 'creatureAction') {
        appendAttackActions(actions, state, playerId);
        appendMovementAndGuardActions(actions, state, playerId);
    }
    appendIfValid(actions, state, playerId, createAction({
        kind: 'advance-phase',
        label: '推进阶段',
        commandType: FLOW_COMMANDS.ADVANCE_PHASE,
        payload: {},
        keyParts: [state.sys.phase, playerId],
    }));
    return actions;
}

export function buildMageWarsAiLegalActions(args: {
    playerId: PlayerId;
    state: MatchState<unknown>;
}): AiLegalAction[] {
    const state = asMageWarsState(args.state);
    if (state.core.gameResult || state.sys.gameover) return [];

    const interactionActions = buildCurrentInteractionActions(state, args.playerId);
    if (interactionActions.length > 0) return interactionActions;
    if (state.sys.interaction?.current || state.sys.responseWindow?.current) return [];

    return [
        ...buildPlanningActions(state, args.playerId),
        ...buildPhaseActions(state, args.playerId),
    ];
}

const baselineLocalPolicy: LocalAiPolicy = {
    id: 'baseline',
    decide(context: AiDecisionContext) {
        const ranked = [...context.legalActions].sort((left, right) => (
            (ACTION_PRIORITY[left.kind] ?? 1000) - (ACTION_PRIORITY[right.kind] ?? 1000)
            || left.actionId.localeCompare(right.actionId)
        ));
        return ranked[0] ? { actionId: ranked[0].actionId } : null;
    },
};

export const mageWarsAiRuntime: GameAiRuntime = {
    gameId: 'mage-wars',
    buildLegalActions: buildMageWarsAiLegalActions,
    defaultMinimumActionDelayMs: 900,
    localPolicies: {
        baseline: baselineLocalPolicy,
    },
    defaultLocalPolicyId: 'baseline',
};
