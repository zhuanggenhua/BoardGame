export interface StartupCleanupTask {
    reason: string;
    run: () => Promise<number>;
    errorMessage: string;
}

export interface StartupCleanupHooks {
    onDirty: (reason: string) => Promise<void> | void;
    onError: (message: string, error: unknown) => void;
}

export async function runStartupCleanupTasks(
    tasks: readonly StartupCleanupTask[],
    hooks: StartupCleanupHooks,
): Promise<void> {
    for (const task of tasks) {
        try {
            const cleanedCount = await task.run();
            if (cleanedCount > 0) {
                await hooks.onDirty(task.reason);
            }
        } catch (error) {
            hooks.onError(task.errorMessage, error);
        }
    }
}
