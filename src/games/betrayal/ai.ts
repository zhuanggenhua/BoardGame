import {
    createAiLegalActionId,
    type AiDecisionContext,
    type AiLegalAction,
    type GameAiRuntime,
    type LocalAiPolicy,
} from '../../engine/ai';
import type { Command, MatchState, PlayerId } from '../../engine/types';
import { BETRAYAL_COMMANDS } from './commands';
import {
    BETRAYAL_EXPLORER_CATALOG,
    type BetrayalScenarioId,
    type BetrayalTraitKey,
    type BetrayalUseEffectSeed as UseEffectProfile,
} from './scenarioConfig';

interface BetrayalAiExplorer {
    playerId: string;
    displayName: string;
    roomId: string;
    traits: Record<BetrayalTraitKey, number>;
}

interface BetrayalAiRoom {
    id: string;
    name: string;
    floor: 'ground' | 'upper' | 'basement';
    x: number;
    y: number;
    connectedRoomIds: string[];
    state: 'discovered' | 'unexplored';
    discoveryReward: 'event' | 'item' | 'omen' | null;
}

interface BetrayalAiCore {
    phase: 'characterSelect' | 'preHaunt' | 'haunt' | 'endgame';
    scenarioId: BetrayalScenarioId;
    playerIds: string[];
    selectedExplorerByPlayerId: Record<string, string>;
    readyPlayerIds: string[];
    currentPlayer: string;
    currentExplorer: BetrayalAiExplorer;
    otherExplorers: BetrayalAiExplorer[];
    rooms: BetrayalAiRoom[];
    pendingEventChoice: {
        playerId: string;
        sourceTitle: string;
        effect: UseEffectProfile;
    } | null;
    scenarioRuntime: {
        traitorPlayerId: string | null;
        deadExplorerPlayerIds: string[];
        jackSpiritReleased: boolean;
        jackSpiritRoomId: string | null;
        exorcismCircleRoomIds: string[];
        knowledgeOfJackPlayerIds: string[];
    };
    endgameResult: unknown | null;
}

type BetrayalState = MatchState<BetrayalAiCore>;
interface EventChoicePayload {
    accept?: boolean;
    trait?: BetrayalTraitKey;
    traits?: BetrayalTraitKey[];
    targetRoomId?: string;
}

type BetrayalAiValidator = (
    state: MatchState<unknown>,
    command: Command,
) => { valid: boolean };

const ACTION_KINDS = {
    SELECT_EXPLORER: 'select-explorer',
    CONFIRM_EXPLORER: 'confirm-explorer',
    START_SCENARIO: 'start-scenario',
    RESOLVE_EVENT_CHOICE: 'resolve-event-choice',
    MOVE_TO_ROOM: 'move-to-room',
    EXPLORE_ROOM: 'explore-room',
    HERO_ATTACK_TRAITOR: 'hero-attack-traitor',
    TRAITOR_ATTACK_HERO: 'traitor-attack-hero',
    LEARN_ABOUT_JACK: 'learn-about-jack',
    STUDY_EXORCISM: 'study-exorcism',
    EXORCISE_JACK: 'exorcise-jack',
    END_TURN: 'end-turn',
} as const;

function createValidatedAction(args: {
    validate: BetrayalAiValidator;
    state: BetrayalState;
    playerId: PlayerId;
    type: string;
    payload: unknown;
    kind: string;
    label: string;
    idParts?: Array<string | number | undefined | null>;
    metadata?: Record<string, unknown>;
}): AiLegalAction | null {
    const command = {
        type: args.type,
        playerId: args.playerId,
        payload: args.payload,
        timestamp: 0,
    };
    if (!args.validate(args.state as MatchState<unknown>, command).valid) {
        return null;
    }
    return {
        actionId: createAiLegalActionId(args.kind, ...(args.idParts ?? [])),
        kind: args.kind,
        label: args.label,
        commands: [{
            type: args.type,
            payload: args.payload,
        }],
        metadata: args.metadata,
    };
}

function uniquePayloads(payloads: EventChoicePayload[]): EventChoicePayload[] {
    const seen = new Set<string>();
    return payloads.filter((payload) => {
        const key = JSON.stringify(payload);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function buildTraitSelections(
    allowedTraits: BetrayalTraitKey[],
    count: number,
): BetrayalTraitKey[][] {
    if (count <= 0) return [[]];
    const selections: BetrayalTraitKey[][] = [];
    const visit = (current: BetrayalTraitKey[]) => {
        if (current.length === count) {
            selections.push(current);
            return;
        }
        for (const trait of allowedTraits) {
            visit([...current, trait]);
        }
    };
    visit([]);
    return selections;
}

function expandEffectPayloads(
    core: BetrayalCore,
    effect: UseEffectProfile,
    seeds: EventChoicePayload[],
): EventChoicePayload[] {
    switch (effect.mode) {
        case 'chosenTrait':
        case 'healChosenTrait':
            if (effect.chosenTrait) return seeds;
            return seeds.flatMap((payload) => (
                effect.allowedTraits.map((trait) => ({ ...payload, trait }))
            ));
        case 'generalDamageChoice':
            if (effect.selectedTraits) return seeds;
            return seeds.flatMap((payload) => (
                buildTraitSelections(effect.allowedTraits, effect.amount)
                    .map((traits) => ({ ...payload, traits }))
            ));
        case 'placeExplorerInDiscoveredRoomByFloor':
        case 'placeExplorerInAdjacentRoom':
        case 'placeSecretPassageToken': {
            const discoveredRoomIds = core.rooms
                .filter((room) => room.state === 'discovered')
                .map((room) => room.id);
            return seeds.flatMap((payload) => (
                discoveredRoomIds.map((targetRoomId) => ({ ...payload, targetRoomId }))
            ));
        }
        case 'compound':
            return effect.effects.reduce(
                (payloads, nestedEffect) => expandEffectPayloads(core, nestedEffect, payloads),
                seeds,
            );
        case 'chooseTraitRoll':
            return seeds.flatMap((payload) => effect.allowedTraits.flatMap((trait) => {
                const traitPayload = { ...payload, trait };
                return uniquePayloads([
                    traitPayload,
                    ...effect.branches.flatMap((branch) => (
                        expandEffectPayloads(core, branch.effect, [traitPayload])
                    )),
                ]);
            }));
        case 'allTraitChecks':
            return expandEffectPayloads(core, effect.allPassEffect, seeds);
        case 'optionalEventRoll': {
            const accepted = seeds.flatMap((payload) => {
                const acceptedPayload = { ...payload, accept: true };
                return uniquePayloads([
                    acceptedPayload,
                    ...effect.roll.branches.flatMap((branch) => (
                        expandEffectPayloads(core, branch.effect, [acceptedPayload])
                    )),
                ]);
            });
            const declined = seeds.map((payload) => ({ ...payload, accept: false }));
            return [...accepted, ...declined];
        }
        case 'optionalHauntRoll': {
            const accepted = seeds.map((payload) => ({ ...payload, accept: true }));
            const declined = seeds.flatMap((payload) => (
                expandEffectPayloads(core, effect.skippedOrStartedEffect, [{
                    ...payload,
                    accept: false,
                }])
            ));
            return [...accepted, ...declined];
        }
        default:
            return seeds;
    }
}

function buildEventChoiceActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const pending = state.core.pendingEventChoice;
    if (!pending || pending.playerId !== playerId) return [];

    return uniquePayloads(expandEffectPayloads(state.core, pending.effect, [{}]))
        .map((payload, index) => createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            payload,
            kind: ACTION_KINDS.RESOLVE_EVENT_CHOICE,
            label: payload.accept === false
                ? `放弃：${pending.sourceTitle}`
                : `处理：${pending.sourceTitle}`,
            idParts: [index, payload.accept === false ? 'decline' : 'accept', payload.trait, payload.targetRoomId],
            metadata: {
                eventMode: pending.effect.mode,
                accept: payload.accept,
                trait: payload.trait,
                traits: payload.traits,
                targetRoomId: payload.targetRoomId,
                visibleStepDelayPolicy: 'hidden',
            },
        }))
        .filter((action): action is AiLegalAction => Boolean(action));
}

function buildCharacterSelectActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const core = state.core;
    const selectedExplorerId = core.selectedExplorerByPlayerId[playerId];
    const isReady = core.readyPlayerIds.includes(playerId);

    if (!selectedExplorerId) {
        const taken = new Set(Object.values(core.selectedExplorerByPlayerId));
        return BETRAYAL_EXPLORER_CATALOG
            .filter((explorer) => !taken.has(explorer.explorerId))
            .map((explorer) => createValidatedAction({
                validate,
                state,
                playerId,
                type: BETRAYAL_COMMANDS.SELECT_EXPLORER,
                payload: { explorerId: explorer.explorerId },
                kind: ACTION_KINDS.SELECT_EXPLORER,
                label: `选择${explorer.displayName}`,
                idParts: [explorer.explorerId],
                metadata: {
                    explorerId: explorer.explorerId,
                    visibleStepDelayPolicy: 'visible',
                },
            }))
            .filter((action): action is AiLegalAction => Boolean(action));
    }

    if (!isReady) {
        const action = createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.CONFIRM_EXPLORER,
            payload: {},
            kind: ACTION_KINDS.CONFIRM_EXPLORER,
            label: '确认探索者',
            metadata: { visibleStepDelayPolicy: 'hidden' },
        });
        return action ? [action] : [];
    }

    if (core.readyPlayerIds.length === core.playerIds.length) {
        const action = createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.START_SCENARIO,
            payload: { scenarioId: core.scenarioId },
            kind: ACTION_KINDS.START_SCENARIO,
            label: '开始剧本',
            metadata: { visibleStepDelayPolicy: 'hidden' },
        });
        return action ? [action] : [];
    }

    return [];
}

function getAllExplorers(core: BetrayalAiCore): BetrayalAiExplorer[] {
    return [core.currentExplorer, ...core.otherExplorers];
}

function findExplorer(core: BetrayalAiCore, playerId: PlayerId): BetrayalAiExplorer | null {
    return getAllExplorers(core).find((explorer) => explorer.playerId === playerId) ?? null;
}

function buildTurnActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const core = state.core;
    if (core.currentPlayer !== playerId || core.phase === 'endgame') return [];

    const actions: AiLegalAction[] = [];
    const add = (action: AiLegalAction | null) => {
        if (action) actions.push(action);
    };

    for (const room of core.rooms) {
        if (room.state !== 'discovered') continue;
        add(createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.MOVE_TO_ROOM,
            payload: { roomId: room.id },
            kind: ACTION_KINDS.MOVE_TO_ROOM,
            label: `移动到${room.name}`,
            idParts: [room.id],
            metadata: {
                roomId: room.id,
                visibleStepDelayPolicy: 'visible',
            },
        }));
    }

    if (core.phase === 'preHaunt') {
        add(createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.EXPLORE_ROOM,
            payload: {},
            kind: ACTION_KINDS.EXPLORE_ROOM,
            label: '探索未知房间',
            metadata: { visibleStepDelayPolicy: 'visible' },
        }));
    } else if (core.phase === 'haunt') {
        const isTraitor = core.scenarioRuntime.traitorPlayerId === playerId;
        const isDead = core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId);
        if (isTraitor) {
            for (const hero of getAllExplorers(core)) {
                if (
                    hero.playerId === playerId
                    || core.scenarioRuntime.deadExplorerPlayerIds.includes(hero.playerId)
                ) {
                    continue;
                }
                add(createValidatedAction({
                    validate,
                    state,
                    playerId,
                    type: BETRAYAL_COMMANDS.HAUNT_ATTACK,
                    payload: { target: 'hero', targetPlayerId: hero.playerId },
                    kind: ACTION_KINDS.TRAITOR_ATTACK_HERO,
                    label: `攻击${hero.displayName}`,
                    idParts: [hero.playerId],
                    metadata: {
                        targetPlayerId: hero.playerId,
                        visibleStepDelayPolicy: 'visible',
                    },
                }));
            }
        } else if (!isDead) {
            add(createValidatedAction({
                validate,
                state,
                playerId,
                type: BETRAYAL_COMMANDS.EXORCISE_JACK,
                payload: {},
                kind: ACTION_KINDS.EXORCISE_JACK,
                label: '驱魔',
                metadata: { visibleStepDelayPolicy: 'visible' },
            }));
            add(createValidatedAction({
                validate,
                state,
                playerId,
                type: BETRAYAL_COMMANDS.LEARN_ABOUT_JACK,
                payload: {},
                kind: ACTION_KINDS.LEARN_ABOUT_JACK,
                label: '调查杰克',
                metadata: { visibleStepDelayPolicy: 'visible' },
            }));
            add(createValidatedAction({
                validate,
                state,
                playerId,
                type: BETRAYAL_COMMANDS.STUDY_EXORCISM,
                payload: {},
                kind: ACTION_KINDS.STUDY_EXORCISM,
                label: '研究驱魔法阵',
                metadata: { visibleStepDelayPolicy: 'visible' },
            }));
            const traitorPlayerId = core.scenarioRuntime.traitorPlayerId;
            const traitorIsDead = Boolean(
                traitorPlayerId
                && core.scenarioRuntime.deadExplorerPlayerIds.includes(traitorPlayerId),
            );
            if (!traitorIsDead) {
                add(createValidatedAction({
                    validate,
                    state,
                    playerId,
                    type: BETRAYAL_COMMANDS.HAUNT_ATTACK,
                    payload: { target: 'traitor' },
                    kind: ACTION_KINDS.HERO_ATTACK_TRAITOR,
                    label: '攻击叛徒',
                    metadata: { visibleStepDelayPolicy: 'visible' },
                }));
            }
        }
    }

    add(createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.END_TURN,
        payload: {},
        kind: ACTION_KINDS.END_TURN,
        label: '结束回合',
        metadata: { visibleStepDelayPolicy: 'hidden' },
    }));

    return actions;
}

function buildBetrayalAiLegalActions(
    validate: BetrayalAiValidator,
    args: {
    playerId: PlayerId;
    state: MatchState<unknown>;
    },
): AiLegalAction[] {
    const state = args.state as BetrayalState;
    if (state.sys?.gameover || state.core.endgameResult || state.core.phase === 'endgame') {
        return [];
    }

    if (state.core.phase === 'characterSelect') {
        return buildCharacterSelectActions(validate, state, args.playerId);
    }

    const eventChoiceActions = buildEventChoiceActions(validate, state, args.playerId);
    if (eventChoiceActions.length > 0) {
        return eventChoiceActions;
    }

    return buildTurnActions(validate, state, args.playerId);
}

function roomDistance(core: BetrayalAiCore, fromRoomId: string, targetRoomId: string): number {
    if (fromRoomId === targetRoomId) return 0;
    const roomsById = new Map(core.rooms.map((room) => [room.id, room]));
    const queue: Array<{ roomId: string; distance: number }> = [{ roomId: fromRoomId, distance: 0 }];
    const visited = new Set([fromRoomId]);

    while (queue.length > 0) {
        const current = queue.shift()!;
        const room = roomsById.get(current.roomId);
        if (!room) continue;
        for (const connectedRoomId of room.connectedRoomIds) {
            if (visited.has(connectedRoomId)) continue;
            if (connectedRoomId === targetRoomId) return current.distance + 1;
            visited.add(connectedRoomId);
            queue.push({ roomId: connectedRoomId, distance: current.distance + 1 });
        }
    }

    const from = roomsById.get(fromRoomId);
    const target = roomsById.get(targetRoomId);
    if (!from || !target) return 99;
    const floorPenalty = from.floor === target.floor ? 0 : 6;
    return Math.abs(from.x - target.x) + Math.abs(from.y - target.y) + floorPenalty;
}

function resolveObjectiveRoomIds(core: BetrayalAiCore, playerId: PlayerId): string[] {
    if (core.phase === 'preHaunt') {
        return core.rooms
            .filter((room) => room.state === 'discovered')
            .filter((room) => room.connectedRoomIds.some((connectedRoomId) => (
                core.rooms.some((candidate) => candidate.id === connectedRoomId && candidate.state === 'unexplored')
            )))
            .map((room) => room.id);
    }

    const isTraitor = core.scenarioRuntime.traitorPlayerId === playerId;
    if (isTraitor) {
        return getAllExplorers(core)
            .filter((explorer) => explorer.playerId !== playerId)
            .filter((explorer) => !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId))
            .map((explorer) => explorer.roomId);
    }

    if (
        core.scenarioRuntime.jackSpiritReleased
        && core.scenarioRuntime.jackSpiritRoomId
        && core.scenarioRuntime.exorcismCircleRoomIds.length >= 2
    ) {
        return [core.scenarioRuntime.jackSpiritRoomId];
    }
    if (!core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(playerId)) {
        const library = core.rooms.find((room) => room.id === 'upper-west' || room.name === '图书馆');
        if (library) return [library.id];
    }
    if (core.scenarioRuntime.exorcismCircleRoomIds.length < 2) {
        const eventRooms = core.rooms
            .filter((room) => room.state === 'discovered' && room.discoveryReward === 'event')
            .filter((room) => !core.scenarioRuntime.exorcismCircleRoomIds.includes(room.id))
            .map((room) => room.id);
        if (eventRooms.length > 0) return eventRooms;
    }
    const traitor = core.scenarioRuntime.traitorPlayerId
        ? findExplorer(core, core.scenarioRuntime.traitorPlayerId)
        : null;
    return traitor ? [traitor.roomId] : [];
}

function scoreMoveAction(
    core: BetrayalAiCore,
    playerId: PlayerId,
    action: AiLegalAction,
): number {
    const roomId = typeof action.metadata?.roomId === 'string' ? action.metadata.roomId : null;
    if (!roomId) return 0;
    const objectiveRoomIds = resolveObjectiveRoomIds(core, playerId);
    if (objectiveRoomIds.length === 0) return -1000;
    const nearestDistance = Math.min(...objectiveRoomIds.map((targetRoomId) => (
        roomDistance(core, roomId, targetRoomId)
    )));
    const actor = findExplorer(core, playerId);
    const controlledRoomId = (
        core.scenarioRuntime.traitorPlayerId === playerId
        && core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId)
        && core.scenarioRuntime.jackSpiritReleased
        && core.scenarioRuntime.jackSpiritRoomId
    )
        ? core.scenarioRuntime.jackSpiritRoomId
        : actor?.roomId;
    const currentNearestDistance = controlledRoomId
        ? Math.min(...objectiveRoomIds.map((targetRoomId) => (
            roomDistance(core, controlledRoomId, targetRoomId)
        )))
        : 99;
    if (nearestDistance >= currentNearestDistance) {
        return -1000;
    }
    const room = core.rooms.find((candidate) => candidate.id === roomId);
    const unexploredDoorBonus = core.phase === 'preHaunt'
        ? room?.connectedRoomIds.filter((connectedRoomId) => (
            core.rooms.some((candidate) => candidate.id === connectedRoomId && candidate.state === 'unexplored')
        )).length ?? 0
        : 0;
    return Math.max(0, 120 - nearestDistance * 15) + unexploredDoorBonus * 20;
}

function scoreEventChoice(core: BetrayalAiCore, action: AiLegalAction): number {
    let score = 0;
    if (action.metadata?.eventMode === 'optionalHauntRoll') {
        score += action.metadata.accept === false ? 30 : 0;
    } else if (action.metadata?.accept === true) {
        score += 10;
    }
    if (typeof action.metadata?.trait === 'string') {
        score += core.currentExplorer.traits[action.metadata.trait as BetrayalTraitKey] ?? 0;
    }
    if (Array.isArray(action.metadata?.traits)) {
        score += (action.metadata.traits as BetrayalTraitKey[])
            .reduce((total, trait) => total + core.currentExplorer.traits[trait], 0);
    }
    return score;
}

function scoreAction(context: AiDecisionContext, action: AiLegalAction): number {
    const state = context.visibleState as BetrayalState;
    const core = state.core;
    switch (action.kind) {
        case ACTION_KINDS.SELECT_EXPLORER:
            return 1000;
        case ACTION_KINDS.CONFIRM_EXPLORER:
            return 1100;
        case ACTION_KINDS.START_SCENARIO:
            return 1200;
        case ACTION_KINDS.RESOLVE_EVENT_CHOICE:
            return 1150 + scoreEventChoice(core, action);
        case ACTION_KINDS.EXORCISE_JACK:
            return 1200;
        case ACTION_KINDS.TRAITOR_ATTACK_HERO:
            return 1100;
        case ACTION_KINDS.STUDY_EXORCISM:
            return 1050;
        case ACTION_KINDS.LEARN_ABOUT_JACK:
            return 1000;
        case ACTION_KINDS.HERO_ATTACK_TRAITOR:
            return 900;
        case ACTION_KINDS.EXPLORE_ROOM:
            return 800;
        case ACTION_KINDS.MOVE_TO_ROOM:
            return 500 + scoreMoveAction(core, context.playerId, action);
        case ACTION_KINDS.END_TURN:
            return 0;
        default:
            return -100;
    }
}

const baselineLocalPolicy: LocalAiPolicy = {
    id: 'baseline',
    decide(context) {
        const ranked = context.legalActions
            .map((action) => ({ action, score: scoreAction(context, action) }))
            .sort((left, right) => (
                right.score - left.score
                || left.action.actionId.localeCompare(right.action.actionId)
            ));
        const best = ranked[0];
        return best
            ? {
                actionId: best.action.actionId,
                confidence: 0.75,
                reasoningSummary: `按当前阵营目标选择：${best.action.label}`,
            }
            : null;
    },
};

export function createBetrayalAiRuntime(args: {
    validate: BetrayalAiValidator;
}): GameAiRuntime {
    return {
        gameId: 'betrayal',
        buildLegalActions: (buildArgs) => buildBetrayalAiLegalActions(args.validate, buildArgs),
        defaultMinimumActionDelayMs: 700,
        localVisibleStepDelayConfig: {
            mode: 'whitelist',
            actionKinds: [
                ACTION_KINDS.SELECT_EXPLORER,
                ACTION_KINDS.MOVE_TO_ROOM,
                ACTION_KINDS.EXPLORE_ROOM,
                ACTION_KINDS.HERO_ATTACK_TRAITOR,
                ACTION_KINDS.TRAITOR_ATTACK_HERO,
                ACTION_KINDS.LEARN_ABOUT_JACK,
                ACTION_KINDS.STUDY_EXORCISM,
                ACTION_KINDS.EXORCISE_JACK,
            ],
        },
        localPolicies: {
            baseline: baselineLocalPolicy,
        },
        defaultLocalPolicyId: 'baseline',
    };
}

export { ACTION_KINDS as BETRAYAL_AI_ACTION_KINDS };
