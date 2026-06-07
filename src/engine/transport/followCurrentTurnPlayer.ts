import { resolveCurrentTurnPlayerId } from '../sessionContext';

export type SeatControllerLike = {
    type?: string;
};

export type LocalPregameControlContext = {
    state: unknown;
    seatControllers: Record<string, SeatControllerLike>;
    localPlayerId?: string | null;
};

export type LocalPregameControlResolver = (args: LocalPregameControlContext) => string | null;

export function resolveFollowCurrentTurnPlayerId(core: unknown): string | null {
    return resolveCurrentTurnPlayerId(core);
}

export function resolveLocalPregameControlledPlayerId(args: {
    state: unknown;
    seatControllers: Record<string, SeatControllerLike>;
    localPlayerId?: string | null;
    resolver?: LocalPregameControlResolver;
}): string | null {
    return args.resolver?.({
        state: args.state,
        seatControllers: args.seatControllers,
        localPlayerId: args.localPlayerId,
    }) ?? null;
}
