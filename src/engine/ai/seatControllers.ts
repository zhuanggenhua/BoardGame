import { DEFAULT_LOCAL_AI_DIFFICULTY, normalizeAiDifficultyLevel } from './difficulty';
import type { AiSeatController, AiSupportProfile, ManualSetupSeatControllerLike } from './types';
import type { GameManifestEntry } from '../../shared/gameManifest.types';
import {
    getDefaultSetupSelections,
    isMultiSelectField,
    isSelectField,
    normalizeSetupSelections,
    type GameSetupSelections,
} from '../../shared/gameSetupOptions';
import { resolveAllowedPlayerCountsForGame } from '../../shared/roomSetup';

const DEFAULT_REMOTE_PROVIDER_ID = 'astrbot';
export const DEFAULT_AI_MINIMUM_ACTION_DELAY_MS = 1000;
const MAX_AI_MINIMUM_ACTION_DELAY_MS = 5000;
const MANUAL_SETUP_SEARCH_VALUE = '1';
const AI_MINIMUM_ACTION_DELAY_SEARCH_SUFFIX = 'Delay';

function sanitizeOptionalId(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

export function normalizeAiMinimumActionDelayMs(value: number | undefined): number | undefined {
    if (value === undefined) return undefined;
    if (!Number.isFinite(value)) return undefined;
    return Math.max(0, Math.min(Math.round(value), MAX_AI_MINIMUM_ACTION_DELAY_MS));
}

function isManualSetupSelectionSearchValueEnabled(value: string | null): boolean {
    return value === MANUAL_SETUP_SEARCH_VALUE || value === 'true';
}

function isManualSetupSelectionEnabledFromSearchParams(searchParams: URLSearchParams, index: number): boolean {
    return isManualSetupSelectionSearchValueEnabled(searchParams.get(`seat${index}ManualSetup`))
        || isManualSetupSelectionSearchValueEnabled(searchParams.get(`seat${index}ManualFaction`));
}

export function isManualSetupSelectionEnabledForSeat(
    controller: ManualSetupSeatControllerLike | null | undefined,
): boolean {
    return controller?.type !== 'human'
        && (
            controller?.manualSetupSelection === true
            || controller?.manualFactionSelection === true
        );
}

export function withManualSetupSelectionAliases<T extends { type?: unknown }>(
    controller: T,
): T & {
    manualSetupSelection: true;
    manualFactionSelection: true;
} {
    return {
        ...controller,
        manualSetupSelection: true,
        manualFactionSelection: true,
    };
}

export function resolveAiMinimumActionDelayMs(
    controller: AiSeatController,
    defaultMinimumActionDelayMs?: number,
): number {
    if (controller.type === 'human') {
        return 0;
    }

    return normalizeAiMinimumActionDelayMs(controller.minimumActionDelayMs)
        ?? normalizeAiMinimumActionDelayMs(defaultMinimumActionDelayMs)
        ?? DEFAULT_AI_MINIMUM_ACTION_DELAY_MS;
}

export function getAiSeatIds(
    seatControllers?: Record<string, { type?: unknown } | undefined> | null,
): string[] {
    if (!seatControllers) {
        return [];
    }

    return Object.entries(seatControllers)
        .filter(([, controller]) => controller?.type === 'local-ai' || controller?.type === 'remote-ai')
        .map(([playerId]) => playerId);
}

export function getDefaultSeatController(
    playerIndex: number,
    numPlayers: number,
    aiSupport?: AiSupportProfile,
): AiSeatController {
    if (
        playerIndex > 0
        && numPlayers > 1
        && aiSupport?.localAi
        && (aiSupport.defaultLocalAiSeats === 'all-opponents' || playerIndex === 1)
    ) {
        return { type: 'local-ai', difficulty: DEFAULT_LOCAL_AI_DIFFICULTY };
    }
    return { type: 'human' };
}

export function normalizeSeatController(
    controller: AiSeatController,
    aiSupport?: AiSupportProfile,
): AiSeatController {
    if (controller.type === 'human') {
        return { type: 'human' };
    }

    if (controller.type === 'local-ai') {
        if (!aiSupport?.localAi) {
            return { type: 'human' };
        }
        const minimumActionDelayMs = normalizeAiMinimumActionDelayMs(controller.minimumActionDelayMs);
        return {
            type: 'local-ai',
            ...(sanitizeOptionalId(controller.policyId) ? { policyId: sanitizeOptionalId(controller.policyId) } : {}),
            ...(sanitizeOptionalId(controller.fallbackPolicyId)
                ? { fallbackPolicyId: sanitizeOptionalId(controller.fallbackPolicyId) }
                : {}),
            ...(normalizeAiDifficultyLevel(controller.difficulty) ? { difficulty: normalizeAiDifficultyLevel(controller.difficulty) } : {}),
            ...(minimumActionDelayMs !== undefined ? { minimumActionDelayMs } : {}),
            ...(isManualSetupSelectionEnabledForSeat(controller)
                ? withManualSetupSelectionAliases({})
                : {}),
        };
    }

    if (!aiSupport?.remoteAi) {
        return { type: 'human' };
    }

    const providerId = sanitizeOptionalId(controller.providerId) ?? DEFAULT_REMOTE_PROVIDER_ID;
    const fallbackPolicyId = sanitizeOptionalId(controller.fallbackPolicyId);
    const minimumActionDelayMs = normalizeAiMinimumActionDelayMs(controller.minimumActionDelayMs);

    return {
        type: 'remote-ai',
        providerId,
        ...(fallbackPolicyId ? { fallbackPolicyId } : {}),
        ...(minimumActionDelayMs !== undefined ? { minimumActionDelayMs } : {}),
        ...(isManualSetupSelectionEnabledForSeat(controller)
            ? withManualSetupSelectionAliases({})
            : {}),
    };
}

export function parseSeatControllerParam(
    value: string | null,
    aiSupport?: AiSupportProfile,
): AiSeatController {
    if (!value || value === 'human') {
        return { type: 'human' };
    }

    const [controllerType, arg1, arg2] = value.split(':');

    if (controllerType === 'local-ai') {
        return normalizeSeatController(
            {
                type: 'local-ai',
                ...(arg1 ? { policyId: arg1 } : {}),
                ...(arg2 ? { fallbackPolicyId: arg2 } : {}),
            },
            aiSupport,
        );
    }

    if (controllerType === 'remote-ai') {
        return normalizeSeatController(
            {
                type: 'remote-ai',
                providerId: arg1 ?? DEFAULT_REMOTE_PROVIDER_ID,
                ...(arg2 ? { fallbackPolicyId: arg2 } : {}),
            },
            aiSupport,
        );
    }

    return { type: 'human' };
}

export function serializeSeatControllerParam(controller: AiSeatController): string {
    if (controller.type === 'human') {
        return 'human';
    }

    if (controller.type === 'local-ai') {
        const policyId = sanitizeOptionalId(controller.policyId);
        const fallbackPolicyId = sanitizeOptionalId(controller.fallbackPolicyId);
        return ['local-ai', policyId, fallbackPolicyId].filter(Boolean).join(':');
    }

    const providerId = sanitizeOptionalId(controller.providerId) ?? DEFAULT_REMOTE_PROVIDER_ID;
    const fallbackPolicyId = sanitizeOptionalId(controller.fallbackPolicyId);
    return ['remote-ai', providerId, fallbackPolicyId].filter(Boolean).join(':');
}

export function resolveLocalMatchPlayerCount(
    requestedPlayers: string | null,
    playerOptions: number[] | undefined,
): number {
    const allowed = playerOptions?.length ? playerOptions : [2];
    const parsed = Number(requestedPlayers);
    return Number.isInteger(parsed) && allowed.includes(parsed) ? parsed : allowed[0];
}

export function resolveSeatControllersFromSearchParams(args: {
    numPlayers: number;
    searchParams: URLSearchParams;
    aiSupport?: AiSupportProfile;
}): Record<string, AiSeatController> {
    const controllers: Record<string, AiSeatController> = {};

    for (let index = 0; index < args.numPlayers; index += 1) {
        const playerId = String(index);
        const explicit = parseSeatControllerParam(
            args.searchParams.get(`seat${index}`),
            args.aiSupport,
        );
        const explicitDifficulty = normalizeAiDifficultyLevel(
            args.searchParams.get(`seat${index}Difficulty`) ?? undefined,
        );
        const rawMinimumActionDelayMs = args.searchParams.get(`seat${index}${AI_MINIMUM_ACTION_DELAY_SEARCH_SUFFIX}`);
        const explicitMinimumActionDelayMs = normalizeAiMinimumActionDelayMs(
            rawMinimumActionDelayMs === null ? undefined : Number(rawMinimumActionDelayMs),
        );
        const manualSetupSelection = isManualSetupSelectionEnabledFromSearchParams(args.searchParams, index);
        const fallback = getDefaultSeatController(index, args.numPlayers, args.aiSupport);
        const explicitController = args.searchParams.has(`seat${index}`)
            ? (
                explicit.type === 'local-ai' && explicitDifficulty
                    ? normalizeSeatController({ ...explicit, difficulty: explicitDifficulty }, args.aiSupport)
                    : explicit
            )
            : fallback;
        const controller = explicitController.type !== 'human' && explicitMinimumActionDelayMs !== undefined
            ? normalizeSeatController(
                {
                    ...explicitController,
                    minimumActionDelayMs: explicitMinimumActionDelayMs,
                },
                args.aiSupport,
            )
            : explicitController;
        controllers[playerId] = controller.type === 'human' || !manualSetupSelection
            ? controller
            : normalizeSeatController({ ...controller, manualSetupSelection: true }, args.aiSupport);
    }

    return controllers;
}

export function buildLocalMatchSearchParams(args: {
    numPlayers: number;
    playerOptions?: number[];
    aiSupport?: AiSupportProfile;
    seatControllers: Record<string, AiSeatController>;
    gameManifest?: GameManifestEntry;
    setupSelections?: GameSetupSelections;
}): URLSearchParams {
    const search = new URLSearchParams();
    const resolvedPlayerOptions = resolveAllowedPlayerCountsForGame({
        gameManifest: args.gameManifest,
        setupData: args.setupSelections,
        fallbackPlayerOptions: args.playerOptions,
    });
    const defaultPlayers = resolveLocalMatchPlayerCount(null, resolvedPlayerOptions);

    if (args.numPlayers !== defaultPlayers) {
        search.set('players', String(args.numPlayers));
    }

    for (let index = 0; index < args.numPlayers; index += 1) {
        const playerId = String(index);
        const controller = normalizeSeatController(
            args.seatControllers[playerId] ?? getDefaultSeatController(index, args.numPlayers, args.aiSupport),
            args.aiSupport,
        );
        const defaultController = getDefaultSeatController(index, args.numPlayers, args.aiSupport);
        if (serializeSeatControllerParam(controller) !== serializeSeatControllerParam(defaultController)) {
            search.set(`seat${index}`, serializeSeatControllerParam(controller));
        }
        if (
            controller.type === 'local-ai'
            && controller.difficulty
            && (
                defaultController.type !== 'local-ai'
                || defaultController.difficulty !== controller.difficulty
            )
        ) {
            search.set(`seat${index}Difficulty`, controller.difficulty);
        }
        const controllerDelayMs = controller.type === 'human'
            ? undefined
            : normalizeAiMinimumActionDelayMs(controller.minimumActionDelayMs);
        const defaultControllerDelayMs = defaultController.type === 'human'
            ? undefined
            : normalizeAiMinimumActionDelayMs(defaultController.minimumActionDelayMs)
                ?? DEFAULT_AI_MINIMUM_ACTION_DELAY_MS;
        if (
            controller.type !== 'human'
            && controllerDelayMs !== undefined
            && controllerDelayMs !== defaultControllerDelayMs
        ) {
            search.set(`seat${index}${AI_MINIMUM_ACTION_DELAY_SEARCH_SUFFIX}`, String(controllerDelayMs));
        }
        if (isManualSetupSelectionEnabledForSeat(controller)) {
            search.set(`seat${index}ManualSetup`, MANUAL_SETUP_SEARCH_VALUE);
            search.set(`seat${index}ManualFaction`, MANUAL_SETUP_SEARCH_VALUE);
        }
    }

    if (args.gameManifest?.setupOptions) {
        const normalizedSelections = normalizeSetupSelections(args.gameManifest, args.setupSelections as Record<string, unknown> | undefined);
        const defaultSelections = getDefaultSetupSelections(args.gameManifest);

        for (const [fieldKey, field] of Object.entries(args.gameManifest.setupOptions)) {
            const searchKey = `setup.${fieldKey}`;
            const value = normalizedSelections[fieldKey];
            const defaultValue = defaultSelections[fieldKey];

            if (isMultiSelectField(field)) {
                const current = Array.isArray(value) ? value : [];
                const fallback = Array.isArray(defaultValue) ? defaultValue : [];
                if (current.length === fallback.length && current.every((item, index) => item === fallback[index])) {
                    continue;
                }
                search.set(searchKey, current.join(','));
                continue;
            }

            if (!isSelectField(field)) {
                continue;
            }

            const current = typeof value === 'string' ? value : '';
            const fallback = typeof defaultValue === 'string' ? defaultValue : '';
            if (current !== fallback) {
                search.set(searchKey, current);
            }
        }
    }

    return search;
}

export function resolveSetupSelectionsFromSearchParams(args: {
    gameManifest?: Pick<GameManifestEntry, 'setupOptions'>;
    searchParams: URLSearchParams;
}): GameSetupSelections {
    const defaults = getDefaultSetupSelections(args.gameManifest ?? {});
    const fields = args.gameManifest?.setupOptions ?? {};

    if (Object.keys(fields).length === 0) {
        return defaults;
    }

    const parsed: Record<string, unknown> = {};

    for (const [fieldKey, field] of Object.entries(fields)) {
        const rawValue = args.searchParams.get(`setup.${fieldKey}`);
        if (rawValue === null) {
            continue;
        }

        if (isMultiSelectField(field)) {
            parsed[fieldKey] = rawValue.trim() === ''
                ? []
                : rawValue.split(',').map((value) => value.trim()).filter(Boolean);
            continue;
        }

        if (isSelectField(field)) {
            parsed[fieldKey] = rawValue;
        }
    }

    return normalizeSetupSelections(args.gameManifest ?? {}, parsed);
}

export function buildLocalMatchSetupData(setupSelections: GameSetupSelections): Record<string, unknown> {
    if (Object.keys(setupSelections).length === 0) {
        return {};
    }

    return {
        ...Object.fromEntries(
            Object.entries(setupSelections).map(([key, value]) => [
                key,
                Array.isArray(value) ? [...value] : value,
            ]),
        ),
        setupSelections: Object.fromEntries(
            Object.entries(setupSelections).map(([key, value]) => [
                key,
                Array.isArray(value) ? [...value] : value,
            ]),
        ),
    };
}
