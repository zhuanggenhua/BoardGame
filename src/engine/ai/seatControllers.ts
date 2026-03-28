import type { AiSeatController, AiSupportProfile } from './types';

const DEFAULT_REMOTE_PROVIDER_ID = 'astrbot';

function sanitizeOptionalId(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

export function getDefaultSeatController(
    playerIndex: number,
    numPlayers: number,
    aiSupport?: AiSupportProfile,
): AiSeatController {
    if (playerIndex === 1 && numPlayers > 1 && aiSupport?.localAi) {
        return { type: 'local-ai' };
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
        return {
            type: 'local-ai',
            ...(sanitizeOptionalId(controller.policyId) ? { policyId: sanitizeOptionalId(controller.policyId) } : {}),
            ...(sanitizeOptionalId(controller.fallbackPolicyId)
                ? { fallbackPolicyId: sanitizeOptionalId(controller.fallbackPolicyId) }
                : {}),
        };
    }

    if (!aiSupport?.remoteAi) {
        return { type: 'human' };
    }

    const providerId = sanitizeOptionalId(controller.providerId) ?? DEFAULT_REMOTE_PROVIDER_ID;
    const fallbackPolicyId = sanitizeOptionalId(controller.fallbackPolicyId);

    return {
        type: 'remote-ai',
        providerId,
        ...(fallbackPolicyId ? { fallbackPolicyId } : {}),
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
        const fallback = getDefaultSeatController(index, args.numPlayers, args.aiSupport);
        controllers[playerId] = args.searchParams.has(`seat${index}`)
            ? explicit
            : fallback;
    }

    return controllers;
}

export function buildLocalMatchSearchParams(args: {
    numPlayers: number;
    playerOptions?: number[];
    aiSupport?: AiSupportProfile;
    seatControllers: Record<string, AiSeatController>;
}): URLSearchParams {
    const search = new URLSearchParams();
    const defaultPlayers = resolveLocalMatchPlayerCount(null, args.playerOptions);

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
    }

    return search;
}
