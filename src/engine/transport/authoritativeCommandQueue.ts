export type QueuedAuthoritativeCommand<Options = unknown> = {
    commandType: string;
    payload: unknown;
    playerID: string;
    /** Authoritative state id observed when the command entered the queue. */
    stateIDAtEnqueue: number;
    options?: Options;
    resolve: (success: boolean) => void;
};

export type QueuedAuthoritativeBatch = {
    _batch: true;
    execute: () => Promise<boolean>;
    resolve: (success: boolean) => void;
};

export type AuthoritativeCommandQueueItem<Options = unknown> =
    | QueuedAuthoritativeCommand<Options>
    | QueuedAuthoritativeBatch;

export type AuthoritativeCommandQueueMatch<Options = unknown> = {
    matchID: string;
    stateID: number;
    executing: boolean;
    unloaded: boolean;
    commandQueue: Array<AuthoritativeCommandQueueItem<Options>>;
};

export type DrainAuthoritativeCommandQueueHandlers<Match extends AuthoritativeCommandQueueMatch<Options>, Options> = {
    executeQueuedCommand: (match: Match, command: QueuedAuthoritativeCommand<Options>) => Promise<boolean>;
    rejectStaleQueuedCommand: (match: Match, command: QueuedAuthoritativeCommand<Options>) => Promise<void>;
    onQueuedExecutionError: (
        match: Match,
        item: AuthoritativeCommandQueueItem<Options>,
        error: unknown,
    ) => void;
};

export function enqueueAuthoritativeCommand<Options>(
    match: AuthoritativeCommandQueueMatch<Options>,
    command: Omit<QueuedAuthoritativeCommand<Options>, 'resolve'>,
): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        match.commandQueue.push({
            ...command,
            resolve,
        });
    });
}

export function enqueueAuthoritativeBatch<Options>(
    match: AuthoritativeCommandQueueMatch<Options>,
    batch: Omit<QueuedAuthoritativeBatch, 'resolve'>,
): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        match.commandQueue.push({
            ...batch,
            resolve,
        });
    });
}

export async function runAuthoritativeCommandQueueExclusive<Match extends AuthoritativeCommandQueueMatch<Options>, Options, Result>(
    match: Match,
    args: {
        execute: () => Promise<Result>;
        drain: () => Promise<void>;
    },
): Promise<Result> {
    match.executing = true;
    try {
        const result = await args.execute();
        await args.drain();
        return result;
    } finally {
        match.executing = false;
    }
}

export async function drainAuthoritativeCommandQueue<Match extends AuthoritativeCommandQueueMatch<Options>, Options>(
    match: Match,
    handlers: DrainAuthoritativeCommandQueueHandlers<Match, Options>,
): Promise<void> {
    while (match.commandQueue.length > 0) {
        if (match.unloaded) {
            flushAuthoritativeCommandQueue(match);
            return;
        }

        const next = match.commandQueue.shift()!;
        try {
            if ('_batch' in next) {
                const success = await next.execute();
                next.resolve(success);
                continue;
            }

            if (next.stateIDAtEnqueue !== match.stateID) {
                await handlers.rejectStaleQueuedCommand(match, next);
                next.resolve(false);
                continue;
            }

            const success = await handlers.executeQueuedCommand(match, next);
            next.resolve(success);
        } catch (error) {
            handlers.onQueuedExecutionError(match, next, error);
            next.resolve(false);
        }
    }
}

export function flushAuthoritativeCommandQueue<Options>(
    match: AuthoritativeCommandQueueMatch<Options>,
): void {
    while (match.commandQueue.length > 0) {
        match.commandQueue.shift()?.resolve(false);
    }
}
