import type { Server as IOServer, Socket as IOSocket } from 'socket.io';
import type { MatchState } from '../types';
import {
    parseDispatchPayloadMeta,
    resolveDispatchActorPlayerId,
} from './dispatchActorResolution';
import {
    injectTutorialInteractionId,
} from './tutorialAiCommand';
import {
    normalizeOnlineAiAttemptKey,
    normalizeOnlineAiClientTransportDiagnostics,
} from './onlineAiClientTransportDiagnostics';
import type {
    BatchDispatchMeta,
    CommandDispatchMeta,
    ManualForceEndAiPhaseResult,
    ManualSetupSelectionRequest,
    OnlineAiClientTransportDiagnostics,
} from './protocol';
import { isManualSetupSelectionRequest } from './onlineAiManualRecoveryCoordinator';

export type GameSocketRouteSocketInfo = {
    matchID: string;
    playerID: string | null;
    credentials?: string;
};

export type GameSocketRouteMatch = {
    state: MatchState<unknown>;
};

export type GameSocketRouteCommandOptions = {
    expectedStateID?: number;
    onlineAiAttemptKey?: string | null;
    clientTransport?: OnlineAiClientTransportDiagnostics | null;
};

export type GameSocketRouteHooks<TMatch extends GameSocketRouteMatch> = {
    getSocketInfo: (socketId: string) => GameSocketRouteSocketInfo | undefined;
    getMatch: (matchID: string) => TMatch | undefined;
    validateCommandAuth: (
        matchID: string,
        playerID: string,
        credentials?: string,
    ) => Promise<boolean>;
    resolveOnlineAiSeatControllerType: (match: TMatch, playerID: string) => 'human' | string;
    handleSync: (
        socket: IOSocket,
        matchID: string,
        playerID: string | null,
        credentials?: string,
    ) => Promise<void>;
    handleCommand: (
        matchID: string,
        playerID: string,
        commandType: string,
        payload: unknown,
        options?: GameSocketRouteCommandOptions,
    ) => Promise<boolean>;
    handleBatch: (
        socket: IOSocket,
        matchID: string,
        playerID: string,
        batchId: string,
        commands: Array<{ type: string; payload: unknown }>,
        meta?: BatchDispatchMeta,
    ) => Promise<void>;
    handleManualSetupSelection: (
        match: TMatch,
        requesterPlayerId: string,
        request: ManualSetupSelectionRequest,
    ) => Promise<boolean>;
    handleManualForceEndAiPhase: (
        match: TMatch,
        requesterPlayerId: string,
    ) => Promise<ManualForceEndAiPhaseResult>;
    handleDisconnect: (socket: IOSocket) => void;
};

export type GameSocketRouteConfig<TMatch extends GameSocketRouteMatch> = {
    namespace: ReturnType<IOServer['of']>;
    hooks: GameSocketRouteHooks<TMatch>;
};

export function registerGameSocketRoutes<TMatch extends GameSocketRouteMatch>(
    config: GameSocketRouteConfig<TMatch>,
): void {
    const { namespace, hooks } = config;

    namespace.on('connection', (socket: IOSocket) => {
        socket.on('sync', async (
            matchID: string,
            playerID: string | null,
            credentials?: string,
        ) => {
            if (!matchID) return;
            await hooks.handleSync(socket, matchID, playerID, credentials);
        });

        socket.on('command', async (
            matchID: string,
            commandType: string,
            payload: unknown,
            credentials?: string,
            commandMeta?: CommandDispatchMeta,
        ) => {
            await handleCommandRoute({ socket, matchID, commandType, payload, credentials, commandMeta, hooks });
        });

        socket.on('batch', async (
            matchID: string,
            batchId: string,
            commands: Array<{ type: string; payload: unknown }>,
            credentials?: string,
            meta?: BatchDispatchMeta,
        ) => {
            await handleBatchRoute({ socket, matchID, batchId, commands, credentials, meta, hooks });
        });

        socket.on('manual-setup-selection', async (
            matchID: string,
            request: ManualSetupSelectionRequest,
            credentials?: string,
            acknowledge?: (result: { accepted: boolean; reason?: 'unauthorized' | 'rejected' }) => void,
        ) => {
            await handleManualSetupSelectionRoute({ socket, matchID, request, credentials, acknowledge, hooks });
        });

        socket.on('manual-force-end-ai-phase', async (
            matchID: string,
            credentials?: string,
            acknowledge?: (result: ManualForceEndAiPhaseResult) => void,
        ) => {
            await handleManualForceEndAiPhaseRoute({ socket, matchID, credentials, acknowledge, hooks });
        });

        socket.on('ui:event', (
            matchID: string,
            eventType: string,
            payload: unknown,
        ) => {
            if (!matchID || typeof eventType !== 'string' || eventType.length === 0 || eventType.length > 120) return;
            const info = hooks.getSocketInfo(socket.id);
            if (!info || info.matchID !== matchID || !info.playerID) return;
            socket.to(`game:${matchID}`).emit('ui:event', matchID, {
                type: eventType,
                playerId: info.playerID,
                payload,
                sentAt: Date.now(),
            });
        });

        socket.on('disconnect', () => {
            hooks.handleDisconnect(socket);
        });
    });
}

async function handleCommandRoute<TMatch extends GameSocketRouteMatch>(args: {
    socket: IOSocket;
    matchID: string;
    commandType: string;
    payload: unknown;
    credentials?: string;
    commandMeta?: CommandDispatchMeta;
    hooks: GameSocketRouteHooks<TMatch>;
}): Promise<void> {
    const { socket, matchID, commandType, payload, credentials, commandMeta, hooks } = args;
    if (!matchID || !commandType) return;
    const info = hooks.getSocketInfo(socket.id);
    if (!info || info.matchID !== matchID || !info.playerID) return;
    const authorized = await hooks.validateCommandAuth(matchID, info.playerID, info.credentials ?? credentials);
    if (!authorized) {
        socket.emit('error', matchID, 'unauthorized');
        return;
    }

    const meta = parseDispatchPayloadMeta(payload);
    const match = hooks.getMatch(matchID);
    if (meta.legacyManualAiSeatId) {
        socket.emit('error', matchID, 'online_ai_server_authority');
        return;
    }
    if (match && hooks.resolveOnlineAiSeatControllerType(match, info.playerID) !== 'human') {
        socket.emit('error', matchID, 'online_ai_server_authority');
        return;
    }
    const isTutorialActive = Boolean((match?.state?.sys as { tutorial?: { active?: boolean } } | undefined)
        ?.tutorial?.active);
    const resolvedPlayerId = resolveDispatchActorPlayerId({
        meta,
        allowInternalOverride: false,
        allowTutorialOverride: isTutorialActive,
        fallbackPlayerId: info.playerID,
    });
    const tutorialInjectedPayload = match
        ? injectTutorialInteractionId({
            state: match.state,
            commandType,
            payload: meta.normalizedPayload,
            tutorialPlayerId: meta.tutorialOverrideId ?? resolvedPlayerId,
            isTutorialAiCommand: meta.isTutorialAiCommand,
        })
        : meta.normalizedPayload;
    const commandOptions = buildCommandRouteOptions(commandMeta);
    if (commandOptions) {
        await hooks.handleCommand(
            matchID,
            resolvedPlayerId,
            commandType,
            tutorialInjectedPayload,
            commandOptions,
        );
        return;
    }
    await hooks.handleCommand(matchID, resolvedPlayerId, commandType, tutorialInjectedPayload);
}

async function handleBatchRoute<TMatch extends GameSocketRouteMatch>(args: {
    socket: IOSocket;
    matchID: string;
    batchId: string;
    commands: Array<{ type: string; payload: unknown }>;
    credentials?: string;
    meta?: BatchDispatchMeta;
    hooks: GameSocketRouteHooks<TMatch>;
}): Promise<void> {
    const { socket, matchID, batchId, commands, credentials, meta, hooks } = args;
    if (!matchID || !batchId || !Array.isArray(commands)) return;
    const info = hooks.getSocketInfo(socket.id);
    if (!info || info.matchID !== matchID || !info.playerID) return;
    const authorized = await hooks.validateCommandAuth(matchID, info.playerID, info.credentials ?? credentials);
    if (!authorized) {
        socket.emit('batch:rejected', matchID, batchId, 'unauthorized');
        return;
    }
    const match = hooks.getMatch(matchID);
    if (match && hooks.resolveOnlineAiSeatControllerType(match, info.playerID) !== 'human') {
        socket.emit('batch:rejected', matchID, batchId, 'online_ai_server_authority');
        return;
    }
    await hooks.handleBatch(socket, matchID, info.playerID, batchId, commands, meta);
}

async function handleManualSetupSelectionRoute<TMatch extends GameSocketRouteMatch>(args: {
    socket: IOSocket;
    matchID: string;
    request: ManualSetupSelectionRequest;
    credentials?: string;
    acknowledge?: (result: { accepted: boolean; reason?: 'unauthorized' | 'rejected' }) => void;
    hooks: GameSocketRouteHooks<TMatch>;
}): Promise<void> {
    const { socket, matchID, request, credentials, acknowledge, hooks } = args;
    if (!matchID || !isManualSetupSelectionRequest(request)) return;
    const info = hooks.getSocketInfo(socket.id);
    if (!info || info.matchID !== matchID || !info.playerID) return;
    const authorized = await hooks.validateCommandAuth(matchID, info.playerID, info.credentials ?? credentials);
    if (!authorized) {
        socket.emit('error', matchID, 'unauthorized');
        acknowledge?.({ accepted: false, reason: 'unauthorized' });
        return;
    }
    const match = hooks.getMatch(matchID);
    if (!match || hooks.resolveOnlineAiSeatControllerType(match, info.playerID) !== 'human') {
        socket.emit('error', matchID, 'unauthorized');
        acknowledge?.({ accepted: false, reason: 'unauthorized' });
        return;
    }
    const accepted = await hooks.handleManualSetupSelection(match, info.playerID, request);
    if (!accepted) {
        socket.emit('error', matchID, 'manual_setup_selection_rejected');
        acknowledge?.({ accepted: false, reason: 'rejected' });
        return;
    }
    acknowledge?.({ accepted: true });
}

async function handleManualForceEndAiPhaseRoute<TMatch extends GameSocketRouteMatch>(args: {
    socket: IOSocket;
    matchID: string;
    credentials?: string;
    acknowledge?: (result: ManualForceEndAiPhaseResult) => void;
    hooks: GameSocketRouteHooks<TMatch>;
}): Promise<void> {
    const { socket, matchID, credentials, acknowledge, hooks } = args;
    if (!matchID) return;
    const info = hooks.getSocketInfo(socket.id);
    if (!info || info.matchID !== matchID || !info.playerID) return;
    const authorized = await hooks.validateCommandAuth(matchID, info.playerID, info.credentials ?? credentials);
    if (!authorized) {
        socket.emit('error', matchID, 'unauthorized');
        acknowledge?.({ accepted: false, reason: 'unauthorized' });
        return;
    }
    const match = hooks.getMatch(matchID);
    if (!match || hooks.resolveOnlineAiSeatControllerType(match, info.playerID) !== 'human') {
        socket.emit('error', matchID, 'unauthorized');
        acknowledge?.({ accepted: false, reason: 'unauthorized' });
        return;
    }

    const result = await hooks.handleManualForceEndAiPhase(match, info.playerID);
    if (!result.accepted && result.reason === 'unauthorized') {
        socket.emit('error', matchID, 'unauthorized');
    }
    acknowledge?.(result);
}

function buildCommandRouteOptions(
    commandMeta: CommandDispatchMeta | undefined,
): GameSocketRouteCommandOptions | undefined {
    const expectedStateID = commandMeta?.expectedStateID;
    if (
        typeof expectedStateID !== 'number'
        && !commandMeta?.onlineAiAttemptKey
        && !commandMeta?.clientTransport
    ) {
        return undefined;
    }
    return {
        ...(typeof expectedStateID === 'number' ? { expectedStateID } : {}),
        onlineAiAttemptKey: normalizeOnlineAiAttemptKey(commandMeta?.onlineAiAttemptKey),
        clientTransport: normalizeOnlineAiClientTransportDiagnostics(commandMeta?.clientTransport),
    };
}
