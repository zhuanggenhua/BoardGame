import { FLOW_COMMANDS } from '../../engine/systems/FlowSystem';
import { INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';
import type { Command, MatchState, PlayerId } from '../../engine/types';
import {
    buildAiLegalActionsFromInteractionDecision,
    createAiActionOutcomeNoBenefitScorer,
    createAiLegalActionId,
    createLookaheadLocalAiPolicy,
    type AiDecisionDescriptor,
    type AiLegalAction,
    type GameAiRuntime,
    type LocalAiActionScorer,
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
import { resolveMageWarsMageEquipmentArmor } from './domain/damageRules';
import {
    getMageWarsObjectAttackProfiles,
    isMageWarsAttackSpell,
    isMageWarsConjurationSpell,
    isMageWarsCreatureSpell,
    isMageWarsHealingSpell,
    getMageWarsZoneDistance,
    resolveMageWarsObjectEffectiveArmor,
    resolveMageWarsSpellRawCostTotal,
} from './domain/spellRules';
import { buildMageWarsSpellCastOpportunity } from './domain/spellCastRuntime';
import {
    areAdjacentZones,
    getOpponentId,
} from './domain/utils';
import {
    isMageWarsConfiguredSpellcastingSource,
    isMageWarsSpellcastingObject,
} from './domain/spellCasting';
import {
    getMageWarsObjectValue,
    getMageWarsSpellPlanningValue,
    getMageWarsTargetValue,
} from './ai/evaluation';
import {
    projectMageWarsActionDelta,
    projectMageWarsActionOutcome,
} from './ai/search';

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
        if (typeof option.id !== 'string') continue;
        const optionLabel = typeof option.label === 'string' ? option.label : option.id;
        appendIfValid(actions, state, playerId, createAction({
            kind: 'interaction-choice',
            label: optionLabel,
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
        }
    }

    return actions;
}

function buildSpellPlanCandidates(state: MageWarsState, playerId: PlayerId): number[][] {
    const player = state.core.players[playerId];
    if (!player) return [[]];

    const spellCardIds = getMageWarsPlayerSpellbookCardIds(player);
    const current = spellCardIds.slice(0, MAGE_WARS_MAX_PREPARED_SPELLS);
    const strategic = [...spellCardIds]
        .sort((left, right) => (
            getMageWarsSpellPlanningValue(right, state.core, playerId)
            - getMageWarsSpellPlanningValue(left, state.core, playerId)
            || left - right
        ))
        .slice(0, MAGE_WARS_MAX_PREPARED_SPELLS);
    const lowCost = [...spellCardIds]
        .sort((left, right) => (
            (getMageWarsSpellCardFromConfig(left)?.manaCost ?? 99)
            - (getMageWarsSpellCardFromConfig(right)?.manaCost ?? 99)
            || left - right
        ))
        .slice(0, MAGE_WARS_MAX_PREPARED_SPELLS);

    const candidates = [current, strategic, lowCost, []];
    const seen = new Set<string>();
    return candidates.filter((candidate) => {
        const key = JSON.stringify(candidate);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function buildPlanSpellsActions(state: MageWarsState, playerId: PlayerId): AiLegalAction[] {
    if ((state.core.phaseReadyPlayerIds ?? []).includes(playerId)) {
        return [];
    }
    const player = state.core.players[playerId];
    if (!player) return [];
    const actions: AiLegalAction[] = [];
    for (const selected of buildSpellPlanCandidates(state, playerId)) {
        const planningValueTotal = selected.reduce(
            (total, spellCardId) => total + getMageWarsSpellPlanningValue(spellCardId, state.core, playerId),
            0,
        );
        appendIfValid(actions, state, playerId, createAction({
            kind: 'plan-spells',
            label: selected.length > 0 ? `准备 ${selected.length} 张法术` : '确认不准备法术',
            commandType: MAGE_WARS_COMMANDS.PLAN_SPELLS,
            payload: { spellCardIds: selected },
            keyParts: selected.length > 0 ? selected : ['none'],
            metadata: {
                spellCardIds: selected,
                planningValueTotal,
            },
        }));
    }
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
    const spell = getMageWarsSpellCardFromConfig(spellCardId);
    if (!spell) return;
    const spellMetadata = {
        spellCardId,
        spellName: spell.name,
        spellType: spell.spellType,
        spellManaCost: spell.manaCost ?? resolveMageWarsSpellRawCostTotal(spell) ?? 0,
        isAttackSpell: isMageWarsAttackSpell(spell),
        isCreatureSpell: isMageWarsCreatureSpell(spell),
        isConjurationSpell: isMageWarsConjurationSpell(spell),
        isHealingSpell: isMageWarsHealingSpell(spell),
        isSummonSpell: isMageWarsCreatureSpell(spell) || isMageWarsConjurationSpell(spell),
        ...(casterObject ? { casterObjectId: casterObject.id } : {}),
    };

    if (!casterObject) {
        const opportunity = buildMageWarsSpellCastOpportunity({
            state,
            playerId,
            spellCardId,
        });
        for (const candidate of opportunity?.choice?.candidates ?? []) {
            if (candidate.disabled || candidate.stale || candidate.commands?.length !== 1) continue;
            const command = candidate.commands[0];
            if (!command || typeof command.payload !== 'object' || command.payload === null) continue;
            const payload = command.payload as Record<string, unknown>;
            const targetObjectId = typeof payload.targetObjectId === 'string'
                ? payload.targetObjectId
                : undefined;
            const targetPlayerId = typeof payload.targetPlayerId === 'string'
                ? payload.targetPlayerId
                : undefined;
            const targetZoneId = typeof payload.targetZoneId === 'string'
                ? payload.targetZoneId
                : undefined;
            appendIfValid(actions, state, playerId, createAction({
                kind: 'cast-spell',
                label: `施放 ${spell.name}${candidate.label ? `：${candidate.label}` : ''}`,
                commandType: MAGE_WARS_COMMANDS.CAST_SPELL,
                payload,
                keyParts: [spellCardId, candidate.id],
                metadata: {
                    ...spellMetadata,
                    ...(candidate.metadata ?? {}),
                    ...(targetObjectId ? {
                        targetObjectId,
                        targetValue: getMageWarsTargetValue(state.core, targetObjectId),
                    } : {}),
                    ...(targetPlayerId ? {
                        targetPlayerId,
                        targetValue: getMageWarsTargetValue(state.core, undefined, targetPlayerId),
                    } : {}),
                    ...(targetZoneId ? { targetZoneId } : {}),
                },
            }));
        }
        return;
    }

    const seenPayloads = new Set<string>();
    for (const payload of buildCastPayloads(state, playerId, spellCardId, casterObject)) {
        const key = JSON.stringify(payload);
        if (seenPayloads.has(key)) continue;
        seenPayloads.add(key);
        const targetObjectId = typeof payload.targetObjectId === 'string' ? payload.targetObjectId : undefined;
        const targetPlayerId = typeof payload.targetPlayerId === 'string' ? payload.targetPlayerId : undefined;
        appendIfValid(actions, state, playerId, createAction({
            kind: casterObject ? 'cast-object-spell' : 'cast-spell',
            label: `${casterObject.name} 施放 ${spell.name}`,
            commandType: MAGE_WARS_COMMANDS.CAST_SPELL,
            payload,
            keyParts: [casterObject?.id, spellCardId, key],
            metadata: {
                ...spellMetadata,
                ...(targetObjectId ? {
                    targetObjectId,
                    targetValue: getMageWarsTargetValue(state.core, targetObjectId),
                } : {}),
                ...(targetPlayerId ? {
                    targetPlayerId,
                    targetValue: getMageWarsTargetValue(state.core, undefined, targetPlayerId),
                } : {}),
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
        const targetValue = getMageWarsTargetValue(state.core, undefined, opponentId);
        const targetLife = Math.max(0, opponent.life - opponent.damage);
        const targetArmor = resolveMageWarsMageEquipmentArmor(state.core, opponentId);
        const expectedDamage = Math.max(0, player.baseMeleeDice * 2 - targetArmor);
        appendIfValid(actions, state, playerId, createAction({
            kind: 'attack',
            label: '法师基础攻击',
            commandType: MAGE_WARS_COMMANDS.DECLARE_ATTACK,
            payload: { targetPlayerId: opponentId },
            keyParts: [opponentId],
            metadata: {
                targetPlayerId: opponentId,
                targetValue,
                targetLife,
                targetArmor,
                expectedDamage,
                lethalLikely: expectedDamage >= targetLife,
            },
        }));
    }

    const enemyObjects = Object.values(state.core.objects)
        .filter((object) => object.ownerId !== playerId)
        .sort((left, right) => left.id.localeCompare(right.id));
    for (const object of Object.values(state.core.objects)
        .filter((candidate) => candidate.ownerId === playerId && candidate.kind === 'creature')
        .sort((left, right) => left.id.localeCompare(right.id))) {
        const targets: Array<{ targetPlayerId: string } | { targetObjectId: string }> = [
            { targetPlayerId: opponentId },
            ...enemyObjects.map((target) => ({ targetObjectId: target.id })),
        ];
        for (const attackProfile of getMageWarsObjectAttackProfiles(object)) {
            for (const target of targets) {
                const targetObjectId = 'targetObjectId' in target ? target.targetObjectId : undefined;
                const targetPlayerId = 'targetPlayerId' in target ? target.targetPlayerId : undefined;
                const targetObject = targetObjectId
                    ? state.core.objects[targetObjectId]
                    : undefined;
                const targetValue = getMageWarsTargetValue(
                    state.core,
                    targetObjectId,
                    targetPlayerId,
                );
                const targetLife = targetObject
                    ? Math.max(0, targetObject.life - targetObject.damage)
                    : targetPlayerId
                        ? Math.max(
                            0,
                            state.core.players[targetPlayerId]?.life
                                - state.core.players[targetPlayerId]?.damage,
                        )
                        : 0;
                const targetArmor = targetObject
                    ? resolveMageWarsObjectEffectiveArmor(state.core, targetObject)
                    : 0;
                const expectedDamage = Math.max(
                    0,
                    attackProfile.diceCount * 2 * Math.max(1, attackProfile.strikeCount)
                        - targetArmor
                        + attackProfile.pierce,
                );
                appendIfValid(actions, state, playerId, createAction({
                    kind: 'object-attack',
                    label: `${object.name} 使用 ${attackProfile.attackName ?? attackProfile.id} 攻击`,
                    commandType: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
                    payload: {
                        attackerObjectId: object.id,
                        attackProfileId: attackProfile.id,
                        ...target,
                    },
                    keyParts: [object.id, attackProfile.id, targetPlayerId ?? targetObjectId],
                    metadata: {
                        attackerObjectId: object.id,
                        attackProfileId: attackProfile.id,
                        attackerValue: getMageWarsObjectValue(state.core, object),
                        targetValue,
                        expectedDamage,
                        targetArmor,
                        lethalLikely: expectedDamage >= targetLife,
                        targetLife,
                        ...target,
                    },
                }));
            }
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
    const opponentId = getOpponentId(state.core, playerId);
    const opponent = state.core.players[opponentId];
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
            metadata: {
                toZoneId: zone.id,
                distanceToEnemyMageAfter: opponent
                    ? getMageWarsZoneDistance(state.core, zone.id, opponent.mageZoneId) ?? 99
                    : 99,
                distanceToEnemyMageBefore: opponent
                    ? getMageWarsZoneDistance(state.core, player.mageZoneId, opponent.mageZoneId) ?? 99
                    : 99,
            },
        }));
    }
    appendIfValid(actions, state, playerId, createAction({
        kind: 'guard',
        label: '法师守卫',
        commandType: MAGE_WARS_COMMANDS.GUARD,
        payload: {},
        keyParts: ['mage'],
        metadata: {
            actor: 'mage',
            remainingLife: Math.max(0, player.life - player.damage),
        },
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
                metadata: {
                    objectId: object.id,
                    toZoneId: zone.id,
                    distanceToEnemyMageAfter: opponent
                        ? getMageWarsZoneDistance(state.core, zone.id, opponent.mageZoneId) ?? 99
                        : 99,
                    distanceToEnemyMageBefore: opponent
                        ? getMageWarsZoneDistance(state.core, object.zoneId, opponent.mageZoneId) ?? 99
                        : 99,
                },
            }));
        }
        appendIfValid(actions, state, playerId, createAction({
            kind: 'guard-object',
            label: `${object.name} 守卫`,
            commandType: MAGE_WARS_COMMANDS.GUARD,
            payload: { objectId: object.id },
            keyParts: [object.id],
            metadata: {
                objectId: object.id,
                objectValue: getMageWarsObjectValue(state.core, object),
            },
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

const mageWarsActionKindScorer: LocalAiActionScorer = {
    id: 'action-kind',
    score(_context, action) {
        switch (action.kind) {
            case 'interaction-choice':
            case 'interaction-confirm':
            case 'interaction-skip':
                return 1000;
            case 'object-attack':
            case 'attack':
                return 52;
            case 'cast-spell':
            case 'cast-object-spell':
                return 46;
            case 'plan-object-spell':
                return 20;
            case 'plan-spells':
                return 16;
            case 'move-object':
            case 'move-mage':
                return 22;
            case 'guard-object':
            case 'guard':
                return 18;
            case 'advance-phase':
                return -20;
            default:
                return 0;
        }
    },
};

const mageWarsTargetValueScorer: LocalAiActionScorer = {
    id: 'target-value',
    score(_context, action) {
        const targetValue = typeof action.metadata?.targetValue === 'number'
            ? action.metadata.targetValue
            : 0;
        const lethalBonus = action.metadata?.lethalLikely === true ? 90 : 0;
        const expectedDamage = typeof action.metadata?.expectedDamage === 'number'
            ? action.metadata.expectedDamage
            : 0;
        const targetLife = typeof action.metadata?.targetLife === 'number'
            ? action.metadata.targetLife
            : 0;
        const damageCoverage = expectedDamage > 0
            ? Math.min(1, expectedDamage / Math.max(1, targetLife))
            : 0;
        if (action.kind === 'object-attack' || action.kind === 'attack') {
            return {
                score: targetValue * 0.22 * damageCoverage + expectedDamage * 4 + lethalBonus,
                reason: action.metadata?.lethalLikely === true
                    ? '本次攻击有机会直接击杀关键目标'
                    : expectedDamage > 0
                        ? '优先攻击价值更高、能产生实际伤害的目标'
                        : '目标护甲过高，本次攻击几乎不能造成伤害',
            };
        }
        if (action.kind === 'cast-spell' || action.kind === 'cast-object-spell') {
            if (action.metadata?.isAttackSpell !== true) return null;
            return {
                score: targetValue * 0.16 + lethalBonus,
                reason: lethalBonus > 0 ? '攻击法术有明确击杀窗口' : '攻击法术有明确敌方目标',
            };
        }
        return null;
    },
};

const mageWarsSpellIntentScorer: LocalAiActionScorer = {
    id: 'spell-intent',
    score(context, action) {
        const state = context.visibleState as MageWarsState;
        const player = state.core.players[context.playerId];
        if (!player) return null;

        if (action.kind === 'plan-object-spell') {
            const spellCardId = typeof action.metadata?.spellCardId === 'number'
                ? action.metadata.spellCardId
                : null;
            if (spellCardId === null) return null;
            return {
                score: getMageWarsSpellPlanningValue(spellCardId, state.core, context.playerId) * 0.7,
                reason: '优先让施法来源准备本回合更能兑现的法术',
            };
        }

        if (action.kind !== 'cast-spell' && action.kind !== 'cast-object-spell') return null;
        let score = 0;
        const reasons: string[] = [];
        if (action.metadata?.isSummonSpell === true) {
            score += 44;
            reasons.push('召唤能增加场面实体');
        }
        if (action.metadata?.isHealingSpell === true) {
            const damageRatio = player.life > 0 ? player.damage / player.life : 0;
            score += damageRatio > 0.3 ? 72 : 18;
            reasons.push(damageRatio > 0.3 ? '法师已受伤，治疗能降低失败风险' : '保留治疗作为可兑现的生命资源');
        }
        if (action.metadata?.isConjurationSpell === true) {
            score += 26;
            reasons.push('持续区域或场面效果有长期价值');
        }
        if (action.metadata?.targetPlayerId === context.playerId && action.metadata?.isHealingSpell === true) {
            score += 28;
        }
        if (action.metadata?.targetOwnerId && action.metadata.targetOwnerId !== context.playerId) {
            score += 18;
        }
        return score === 0 ? null : { score, reason: reasons.join('，') };
    },
};

const mageWarsSafetyScorer: LocalAiActionScorer = {
    id: 'mage-safety',
    score(context, action) {
        const state = context.visibleState as MageWarsState;
        const player = state.core.players[context.playerId];
        if (!player) return null;
        const remainingLife = Math.max(0, player.life - player.damage);
        const dangerRatio = player.life > 0 ? remainingLife / player.life : 0;
        if (dangerRatio > 0.38) return null;

        if (action.kind === 'guard') {
            return {
                score: 82,
                reason: '法师生命过低，先守卫降低被击杀风险',
            };
        }
        if (
            (action.kind === 'cast-spell' || action.kind === 'cast-object-spell')
            && action.metadata?.isHealingSpell === true
        ) {
            return {
                score: 110,
                reason: '法师生命过低，优先兑现治疗',
            };
        }
        if (action.kind === 'object-attack' || action.kind === 'attack') {
            const targetValue = action.metadata?.targetValue;
            const expectedDamage = action.metadata?.expectedDamage;
            return typeof targetValue === 'number'
                && targetValue >= 300
                && typeof expectedDamage === 'number'
                && expectedDamage > 0
                ? { score: 72, reason: '高压下优先处理能直接威胁法师的目标' }
                : null;
        }
        if (action.kind === 'move-mage' || action.kind === 'move-object') {
            const before = typeof action.metadata?.distanceToEnemyMageBefore === 'number'
                ? action.metadata.distanceToEnemyMageBefore
                : 0;
            const after = typeof action.metadata?.distanceToEnemyMageAfter === 'number'
                ? action.metadata.distanceToEnemyMageAfter
                : before;
            return after > before
                ? { score: (after - before) * 18, reason: '法师承压时优先拉开与敌方法师的距离' }
                : null;
        }
        return null;
    },
};

const mageWarsPositionScorer: LocalAiActionScorer = {
    id: 'position',
    score(_context, action) {
        if (action.kind !== 'move-mage' && action.kind !== 'move-object') return null;
        const before = typeof action.metadata?.distanceToEnemyMageBefore === 'number'
            ? action.metadata.distanceToEnemyMageBefore
            : 0;
        const after = typeof action.metadata?.distanceToEnemyMageAfter === 'number'
            ? action.metadata.distanceToEnemyMageAfter
            : before;
        const delta = before - after;
        return delta === 0
            ? { score: -12, reason: '移动没有改善接敌距离' }
            : {
                score: delta * 18,
                reason: delta > 0 ? '移动后更接近敌方法师，增加后续攻击机会' : '移动后远离敌方法师，暂时降低前压价值',
            };
    },
};

const mageWarsResourceScorer: LocalAiActionScorer = {
    id: 'resource',
    score(context, action) {
        const state = context.visibleState as MageWarsState;
        const player = state.core.players[context.playerId];
        if (!player || (action.kind !== 'cast-spell' && action.kind !== 'cast-object-spell')) return null;
        const cost = typeof action.metadata?.spellManaCost === 'number'
            ? action.metadata.spellManaCost
            : 0;
        const remainingMana = player.mana - cost;
        return {
            score: remainingMana < 0 ? -120 : -cost * 1.4,
            reason: remainingMana < 0 ? '施法会耗尽不可用的法力资源' : `施法成本 ${cost} 点法力`,
        };
    },
};

const mageWarsPlanningScorer: LocalAiActionScorer = {
    id: 'planning-value',
    score(_context, action) {
        if (action.kind !== 'plan-spells') return null;
        const value = typeof action.metadata?.planningValueTotal === 'number'
            ? action.metadata.planningValueTotal
            : 0;
        return {
            score: value * 1.6,
            reason: value > 0 ? '准备能覆盖召唤、攻击和保命的法术组合' : '不准备法术只作为最后退路',
        };
    },
};

const mageWarsPhaseTempoScorer: LocalAiActionScorer = {
    id: 'phase-tempo',
    score(context, action) {
        if (action.kind !== 'advance-phase') return null;
        const hasOtherPlayableAction = context.legalActions.some((candidate) => (
            candidate.actionId !== action.actionId
            && !candidate.kind.startsWith('interaction-')
            && candidate.kind !== 'advance-phase'
        ));
        return {
            score: hasOtherPlayableAction ? -100 : 45,
            reason: hasOtherPlayableAction
                ? '本阶段还有可以兑现的动作，不应直接推进'
                : '本阶段没有更好的主动动作，可以推进流程',
        };
    },
};

const mageWarsNoBenefitScorer = createAiActionOutcomeNoBenefitScorer({
    id: 'no-benefit-action',
    actionKinds: ['cast-spell', 'cast-object-spell', 'attack', 'object-attack'],
    projectOutcome: projectMageWarsActionOutcome,
    noBenefitScore: -100,
    treatNonPositiveUtilityAsNoBenefit: true,
    getReason: () => '动作预演没有改善局面，避免为了消耗行动而强行执行',
});

const baselineLocalPolicy = createLookaheadLocalAiPolicy({
    id: 'baseline',
    scorers: [
        mageWarsActionKindScorer,
        mageWarsTargetValueScorer,
        mageWarsSpellIntentScorer,
        mageWarsSafetyScorer,
        mageWarsPositionScorer,
        mageWarsResourceScorer,
        mageWarsPlanningScorer,
        mageWarsPhaseTempoScorer,
        mageWarsNoBenefitScorer,
    ],
    maxReasonCount: 3,
    relativeUtility: {
        enabled: true,
        weight: 10,
        minimumUtility: 0.05,
    },
    candidateLoop: {
        enabled: true,
        maxIterations: 2,
        batchSize: 6,
        stopOnUtility: 0.9,
    },
    projectAction({ context, action, difficulty, remainingBudgetMs }) {
        return projectMageWarsActionDelta({
            context,
            action,
            difficulty,
            remainingBudgetMs,
            buildLegalActions: buildMageWarsAiLegalActions,
        });
    },
});

export const mageWarsAiRuntime: GameAiRuntime = {
    gameId: 'mage-wars',
    buildLegalActions: buildMageWarsAiLegalActions,
    defaultMinimumActionDelayMs: 900,
    projectActionOutcome: projectMageWarsActionOutcome,
    localPolicies: {
        baseline: baselineLocalPolicy,
    },
    defaultLocalPolicyId: 'baseline',
};
