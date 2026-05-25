import { useEffect } from 'react';

export type MissingMatchConfirmationSignal = 'transport_not_found' | null;

export type ResolveMissingMatchConfirmationArgs = {
    isTutorialRoute: boolean;
    matchId?: string | null;
    shouldAutoJoin: boolean;
    isAutoJoining: boolean;
    autoJoinGraceActive: boolean;
    onlineTransportError?: string | null;
    matchStatusErrorKind?: 'not_found' | 'transient_unreachable' | null;
};

export function resolveMissingMatchConfirmationSignal(
    args: ResolveMissingMatchConfirmationArgs
): MissingMatchConfirmationSignal {
    if (args.isTutorialRoute || !args.matchId) return null;
    if (args.shouldAutoJoin || args.isAutoJoining || args.autoJoinGraceActive) return null;
    if (args.onlineTransportError === 'match_not_found' && args.matchStatusErrorKind === 'not_found') {
        return 'transport_not_found';
    }
    return null;
}

export function useMissingMatchConfirmation(args: ResolveMissingMatchConfirmationArgs & {
    gameId?: string | null;
    onConfirmedMissingMatch: (signal: Exclude<MissingMatchConfirmationSignal, null>) => void;
}): MissingMatchConfirmationSignal {
    const signal = resolveMissingMatchConfirmationSignal(args);
    const { gameId, matchId, onConfirmedMissingMatch } = args;

    useEffect(() => {
        if (!signal || !gameId || !matchId) return;
        onConfirmedMissingMatch(signal);
    }, [gameId, matchId, onConfirmedMissingMatch, signal]);

    return signal;
}
