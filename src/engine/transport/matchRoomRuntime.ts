import {
    drainAuthoritativeCommandQueue,
    enqueueAuthoritativeBatch,
    enqueueAuthoritativeCommand,
    flushAuthoritativeCommandQueue,
    runAuthoritativeCommandQueueExclusive,
    type AuthoritativeCommandQueueMatch,
    type DrainAuthoritativeCommandQueueHandlers,
    type QueuedAuthoritativeBatch,
    type QueuedAuthoritativeCommand,
} from './authoritativeCommandQueue';

export type MatchRoomRuntimeMatch<Options = unknown> = AuthoritativeCommandQueueMatch<Options>;

export type MatchRoomRuntimeCommandArgs<Match, Options> = {
    playerID: string;
    commandType: string;
    payload: unknown;
    queuedOptions?: Options;
    directOptions?: Options;
    executeCommand: (
        match: Match,
        playerID: string,
        commandType: string,
        payload: unknown,
        options?: Options,
    ) => Promise<boolean>;
    onSucceeded?: (match: Match) => Promise<void>;
};

export type MatchRoomRuntimeBatchArgs<Match> = {
    queuedBatch: Omit<QueuedAuthoritativeBatch, 'resolve'>;
    onQueued?: (queueLength: number) => void;
    executeBatch: (match: Match) => Promise<boolean>;
    onSucceeded?: (match: Match) => Promise<void>;
};

export type MatchRoomRuntimeBatchResult = {
    queued: boolean;
    succeeded: boolean;
};

/**
 * 单房间运行时的第一层接口：接管执行锁、权威命令队列和命令调度。
 * 它不复制 ActiveMatch 状态，避免形成第二套房间真相。
 */
export class MatchRoomRuntime<Match extends MatchRoomRuntimeMatch<Options>, Options = unknown> {
    constructor(
        private readonly match: Match,
        private readonly queueHandlers: DrainAuthoritativeCommandQueueHandlers<Match, Options>,
    ) {}

    isExecuting(): boolean {
        return this.match.executing;
    }

    isUnloaded(): boolean {
        return this.match.unloaded;
    }

    queueLength(): number {
        return this.match.commandQueue.length;
    }

    tryBeginExecution(): boolean {
        if (this.match.unloaded || this.match.executing) {
            return false;
        }
        this.match.executing = true;
        return true;
    }

    finishExecution(): void {
        this.match.executing = false;
    }

    enqueueCommand(command: Omit<QueuedAuthoritativeCommand<Options>, 'resolve'>): Promise<boolean> {
        return enqueueAuthoritativeCommand(this.match, command);
    }

    enqueueBatch(batch: Omit<QueuedAuthoritativeBatch, 'resolve'>): Promise<boolean> {
        return enqueueAuthoritativeBatch(this.match, batch);
    }

    async runExclusive<Result>(execute: () => Promise<Result>): Promise<Result> {
        return runAuthoritativeCommandQueueExclusive(this.match, {
            execute,
            drain: () => this.drainCommandQueue(),
        });
    }

    async executeCommand(args: MatchRoomRuntimeCommandArgs<Match, Options>): Promise<boolean> {
        if (this.isExecuting()) {
            return this.enqueueCommand({
                commandType: args.commandType,
                payload: args.payload,
                playerID: args.playerID,
                stateIDAtEnqueue: this.match.stateID,
                options: args.queuedOptions,
            });
        }

        const success = await this.runExclusive(() => args.executeCommand(
            this.match,
            args.playerID,
            args.commandType,
            args.payload,
            args.directOptions,
        ));
        if (success) {
            await args.onSucceeded?.(this.match);
        }
        return success;
    }

    async executeBatchTask(args: MatchRoomRuntimeBatchArgs<Match>): Promise<MatchRoomRuntimeBatchResult> {
        if (this.isExecuting()) {
            args.onQueued?.(this.queueLength());
            const succeeded = await this.enqueueBatch(args.queuedBatch);
            return { queued: true, succeeded };
        }

        const succeeded = await this.runExclusive(() => args.executeBatch(this.match));
        if (succeeded) {
            await args.onSucceeded?.(this.match);
        }
        return { queued: false, succeeded };
    }

    async drainCommandQueue(): Promise<void> {
        await drainAuthoritativeCommandQueue(this.match, this.queueHandlers);
    }

    async drainCommandQueueIfLoaded(): Promise<void> {
        if (!this.match.unloaded) {
            await this.drainCommandQueue();
        }
    }

    markUnloaded(): void {
        this.match.unloaded = true;
        flushAuthoritativeCommandQueue(this.match);
    }
}
