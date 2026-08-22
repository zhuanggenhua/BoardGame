import { execSync } from 'node:child_process';
import logger from '../../../server/logger.js';
import { resolveRuntimeBuildInfo } from '../../lib/feedback/runtimeBuildInfo';
import type { CommandFailureFeedbackPayload } from './commandFailureFeedbackPayload';

export const DEFAULT_ONLINE_AI_RECOVERY_FEEDBACK_COOLDOWN_MS = 60_000;
export const DEFAULT_COMMAND_FAILURE_FEEDBACK_COOLDOWN_MS = 60_000;

export type OnlineAiRecoveryFeedbackPayload = {
    matchId: string;
    gameId: string;
    playerId: string;
    incidentKind:
        | 'force-end-turn-success'
        | 'force-end-turn-failed'
        | 'repeated-recovery-force-unblocked'
        | 'repeated-recovery-suppressed'
        | 'unsatisfiable-interaction-auto-skipped'
        | 'observed-recovery'
        | 'legal-action-recovered'
        | 'circuit-breaker-tripped';
    severity: 'medium' | 'high';
    status?: 'open' | 'resolved';
    resolvedMethod?: string;
    reason: string;
    trackerKey: string;
    progressMarker: string;
    stateSnapshot: string;
    actionLog?: string;
};

export type OnlineAiFeedbackConfig = {
    endpoint: string | null;
    token: string | null;
    disabledReason?: 'missing-endpoint' | 'missing-token';
};

export type InternalSystemFeedbackPost = (body: Record<string, unknown>) => Promise<void>;
export type OnlineAiFeedbackReporter = (payload: OnlineAiRecoveryFeedbackPayload) => Promise<void>;
export type CommandFailureFeedbackReporter = (payload: CommandFailureFeedbackPayload) => Promise<void>;

const INTERNAL_FEEDBACK_PATH = '/internal/feedback/system';
let cachedServerGitCommitSha: string | null | undefined;

function resolveServerGitCommitSha(): string | undefined {
    if (cachedServerGitCommitSha !== undefined) {
        return cachedServerGitCommitSha || undefined;
    }

    try {
        const commitSha = execSync('git rev-parse --short=12 HEAD', {
            cwd: process.cwd(),
            stdio: ['ignore', 'pipe', 'ignore'],
        }).toString('utf-8').trim();
        cachedServerGitCommitSha = commitSha || null;
    } catch {
        cachedServerGitCommitSha = null;
    }

    return cachedServerGitCommitSha || undefined;
}

function resolveServerFeedbackBuildInfo() {
    const buildInfo = resolveRuntimeBuildInfo(process.env);
    if (buildInfo.appCommitSha) {
        return buildInfo;
    }

    return {
        ...buildInfo,
        appCommitSha: resolveServerGitCommitSha(),
    };
}

export const buildOnlineAiRecoveryResolvedMethod = (
    payload: Pick<OnlineAiRecoveryFeedbackPayload, 'incidentKind'>,
): string => {
    if (payload.incidentKind === 'legal-action-recovered') {
        return '系统已自动找到可执行操作并继续推进该 AI 座位，对局没有停在该步骤。';
    }
    if (payload.incidentKind === 'force-end-turn-success') {
        return '系统已自动推进停滞的 AI 座位，让对局继续进行。';
    }
    if (payload.incidentKind === 'observed-recovery') {
        return '系统观察到原本停住的 AI 座位已经继续推进，并记录了这次恢复现场。';
    }
    return '系统已自动恢复这次在线 AI 步骤，对局已继续运行。';
};

export const normalizeInternalFeedbackEndpoint = (candidate: string): string | null => {
    const trimmed = candidate.trim().replace(/\/$/, '');
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return null;
    }
    if (trimmed.includes('/internal/feedback/system')) {
        return trimmed;
    }
    if (trimmed.endsWith('/feedback')) {
        return `${trimmed.replace(/\/feedback$/, '')}${INTERNAL_FEEDBACK_PATH}`;
    }
    return `${trimmed}${INTERNAL_FEEDBACK_PATH}`;
};

export const resolveOnlineAiFeedbackEndpoint = (): string | null => {
    const rawCandidates = [
        process.env.FEEDBACK_INTERNAL_API_URL,
        process.env.FEEDBACK_API_URL,
        process.env.VITE_FEEDBACK_API_URL,
        process.env.VITE_BACKEND_URL ? `${process.env.VITE_BACKEND_URL.replace(/\/$/, '')}/feedback` : null,
        process.env.BACKEND_URL ? `${process.env.BACKEND_URL.replace(/\/$/, '')}/feedback` : null,
        process.env.API_SERVER_PORT ? `http://127.0.0.1:${process.env.API_SERVER_PORT}/feedback` : null,
        'http://127.0.0.1:18001/feedback',
    ];
    for (const candidate of rawCandidates) {
        if (!candidate) continue;
        const normalized = normalizeInternalFeedbackEndpoint(candidate);
        if (normalized) return normalized;
    }
    return null;
};

export const resolveOnlineAiFeedbackConfig = (): OnlineAiFeedbackConfig => {
    const endpoint = resolveOnlineAiFeedbackEndpoint();
    if (!endpoint) {
        return { endpoint: null, token: null, disabledReason: 'missing-endpoint' };
    }
    const token = process.env.INTERNAL_FEEDBACK_TOKEN;
    const hasExplicitEndpoint = Boolean(process.env.FEEDBACK_INTERNAL_API_URL || process.env.FEEDBACK_API_URL);
    if (!token) {
        const message = '[GameTransport] INTERNAL_FEEDBACK_TOKEN 未配置，已禁用在线 AI 自动反馈';
        if (process.env.NODE_ENV === 'production' || hasExplicitEndpoint) {
            throw new Error(message);
        }
        logger.error(message, { endpoint });
        return { endpoint: null, token: null, disabledReason: 'missing-token' };
    }
    return { endpoint, token };
};

export const postInternalSystemFeedback = async (
    body: Record<string, unknown>,
    config: OnlineAiFeedbackConfig = resolveOnlineAiFeedbackConfig(),
): Promise<void> => {
    const { endpoint, token } = config;
    if (!endpoint || !token) {
        return;
    }
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Internal-Feedback-Token': token,
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(`feedback_http_${response.status}`);
    }
};

export const buildOnlineAiRecoveryFeedbackRequestBody = (
    payload: OnlineAiRecoveryFeedbackPayload,
): Record<string, unknown> => {
    const buildInfo = resolveServerFeedbackBuildInfo();
    return {
        content: `[system][online-ai-watchdog] ${payload.incidentKind} ${payload.reason}`,
        type: 'bug',
        severity: payload.severity,
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.status === 'resolved'
            ? { resolvedMethod: payload.resolvedMethod || buildOnlineAiRecoveryResolvedMethod(payload) }
            : {}),
        source: 'online-ai-watchdog',
        autoReportKind: payload.incidentKind,
        incidentKey: payload.trackerKey,
        gameName: payload.gameId,
        contactInfo: 'system:online-ai-watchdog',
        actionLog: payload.actionLog,
        stateSnapshot: payload.stateSnapshot,
        clientContext: {
            route: 'server-watchdog',
            mode: 'online',
            matchId: payload.matchId,
            playerId: payload.playerId,
            gameId: payload.gameId,
            timezone: 'server',
            ...buildInfo,
        },
        errorContext: {
            source: 'online-ai-watchdog',
            message: payload.reason,
            name: payload.incidentKind,
        },
    };
};

export const buildCommandFailureFeedbackRequestBody = (
    payload: CommandFailureFeedbackPayload,
): Record<string, unknown> => {
    const buildInfo = resolveServerFeedbackBuildInfo();
    const isOnlineAiRecovery = payload.feedbackSource === 'online-ai-watchdog';
    return {
        content: `[system][${payload.feedbackSource}] ${payload.commandType} ${payload.reason}`,
        type: 'bug',
        severity: payload.severity,
        source: payload.feedbackSource,
        autoReportKind: isOnlineAiRecovery ? 'online-ai-command-failed' : payload.incidentKind,
        incidentKey: payload.incidentKey,
        gameName: payload.gameId,
        contactInfo: `system:${payload.feedbackSource}`,
        actionLog: payload.actionLog,
        stateSnapshot: payload.stateSnapshot,
        clientContext: {
            route: isOnlineAiRecovery ? 'server-watchdog-command' : 'server-command',
            mode: 'online',
            matchId: payload.matchId,
            playerId: payload.playerId,
            gameId: payload.gameId,
            timezone: 'server',
            ...buildInfo,
        },
        errorContext: {
            source: payload.feedbackSource,
            message: payload.reason,
            name: payload.commandType,
        },
    };
};

export const defaultOnlineAiFeedbackReporter = async (
    payload: OnlineAiRecoveryFeedbackPayload,
    postFeedback: InternalSystemFeedbackPost = postInternalSystemFeedback,
): Promise<void> => {
    await postFeedback(buildOnlineAiRecoveryFeedbackRequestBody(payload));
};

export const defaultCommandFailureFeedbackReporter = async (
    payload: CommandFailureFeedbackPayload,
    postFeedback: InternalSystemFeedbackPost = postInternalSystemFeedback,
): Promise<void> => {
    await postFeedback(buildCommandFailureFeedbackRequestBody(payload));
};

export class TransportFeedbackReporter {
    private readonly onlineAiRecoveryFeedbackCooldownMs: number;
    private readonly commandFailureFeedbackCooldownMs: number;
    private readonly onlineAiFeedbackReporter: OnlineAiFeedbackReporter;
    private readonly commandFailureFeedbackReporter: CommandFailureFeedbackReporter;
    private readonly now: () => number;
    private readonly onlineAiRecoveryFeedbackCooldown = new Map<string, number>();
    private readonly commandFailureFeedbackCooldown = new Map<string, number>();

    constructor(options: {
        onlineAiRecoveryFeedbackCooldownMs?: number;
        commandFailureFeedbackCooldownMs?: number;
        onlineAiFeedbackReporter?: OnlineAiFeedbackReporter;
        commandFailureFeedbackReporter?: CommandFailureFeedbackReporter;
        postInternalSystemFeedback?: InternalSystemFeedbackPost;
        now?: () => number;
    } = {}) {
        const postFeedback = options.postInternalSystemFeedback ?? postInternalSystemFeedback;
        this.onlineAiRecoveryFeedbackCooldownMs = options.onlineAiRecoveryFeedbackCooldownMs
            ?? DEFAULT_ONLINE_AI_RECOVERY_FEEDBACK_COOLDOWN_MS;
        this.commandFailureFeedbackCooldownMs = options.commandFailureFeedbackCooldownMs
            ?? DEFAULT_COMMAND_FAILURE_FEEDBACK_COOLDOWN_MS;
        this.onlineAiFeedbackReporter = options.onlineAiFeedbackReporter
            ?? ((payload) => defaultOnlineAiFeedbackReporter(payload, postFeedback));
        this.commandFailureFeedbackReporter = options.commandFailureFeedbackReporter
            ?? ((payload) => defaultCommandFailureFeedbackReporter(payload, postFeedback));
        this.now = options.now ?? Date.now;
    }

    pruneExpiredOnlineAiRecoveryFeedbackCooldowns(now = this.now()): void {
        for (const [key, expiresAt] of this.onlineAiRecoveryFeedbackCooldown.entries()) {
            if (expiresAt <= now) {
                this.onlineAiRecoveryFeedbackCooldown.delete(key);
            }
        }
    }

    async reportOnlineAiRecoveryFeedback(payload: OnlineAiRecoveryFeedbackPayload): Promise<void> {
        const dedupeKey = payload.incidentKind === 'legal-action-recovered'
            ? `${payload.matchId}:${payload.playerId}:${payload.incidentKind}:${payload.trackerKey}:${payload.progressMarker}`
            : `${payload.matchId}:${payload.playerId}:${payload.incidentKind}:${payload.trackerKey}`;
        const now = this.now();
        const cooldownUntil = this.onlineAiRecoveryFeedbackCooldown.get(dedupeKey) ?? 0;
        if (cooldownUntil > now) {
            return;
        }
        this.onlineAiRecoveryFeedbackCooldown.set(dedupeKey, now + this.onlineAiRecoveryFeedbackCooldownMs);

        try {
            await this.onlineAiFeedbackReporter(payload);
            logger.info('[GameTransport] online-ai-watchdog feedback reported', {
                matchID: payload.matchId,
                gameId: payload.gameId,
                playerID: payload.playerId,
                incidentKind: payload.incidentKind,
                reason: payload.reason,
                trackerKey: payload.trackerKey,
            });
        } catch (error) {
            logger.warn('[GameTransport] online-ai-watchdog feedback failed', {
                matchID: payload.matchId,
                gameId: payload.gameId,
                playerID: payload.playerId,
                incidentKind: payload.incidentKind,
                reason: payload.reason,
                trackerKey: payload.trackerKey,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    async reportCommandFailureFeedback(payload: CommandFailureFeedbackPayload): Promise<void> {
        const dedupeKey = `${payload.matchId}:${payload.playerId}:${payload.incidentKind}:${payload.incidentKey}`;
        const now = this.now();
        const cooldownUntil = this.commandFailureFeedbackCooldown.get(dedupeKey) ?? 0;
        if (cooldownUntil > now) {
            return;
        }
        this.commandFailureFeedbackCooldown.set(dedupeKey, now + this.commandFailureFeedbackCooldownMs);

        try {
            await this.commandFailureFeedbackReporter(payload);
            logger.info('[GameTransport] command failure feedback reported', {
                matchID: payload.matchId,
                gameId: payload.gameId,
                playerID: payload.playerId,
                commandType: payload.commandType,
                reason: payload.reason,
                incidentKey: payload.incidentKey,
            });
        } catch (error) {
            logger.warn('[GameTransport] command failure feedback failed', {
                matchID: payload.matchId,
                gameId: payload.gameId,
                playerID: payload.playerId,
                commandType: payload.commandType,
                reason: payload.reason,
                incidentKey: payload.incidentKey,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
