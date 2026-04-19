import type { GamePackageInstallHandle, ResolvedGamePackageManifest, StoredGamePackageState } from './types';
import { mergeGamePackageState } from './types';

interface MockInstallRunnerOptions {
    failureMessage: string;
    onStateChange: (state: StoredGamePackageState) => void;
}

interface MockInstallStep {
    delayMs: number;
    patch: Partial<StoredGamePackageState>;
}

const buildBaseState = (manifest: ResolvedGamePackageManifest): StoredGamePackageState => ({
    gameId: manifest.gameId,
    runtimeChannel: manifest.runtimeChannel,
    status: 'not-installed',
    modulePackId: manifest.modulePackId,
    assetPackId: manifest.assetPackId,
    modulePackBytes: manifest.modulePackBytes,
    assetPackBytes: manifest.assetPackBytes,
    updatedAt: Date.now(),
});

const waitFor = (delayMs: number) =>
    new Promise<void>((resolve) => {
        window.setTimeout(resolve, delayMs);
    });

export const runMockGamePackageInstall = (
    manifest: ResolvedGamePackageManifest,
    options: MockInstallRunnerOptions,
): GamePackageInstallHandle => {
    let cancelled = false;
    let currentState = buildBaseState(manifest);

    const steps: MockInstallStep[] = [
        {
            delayMs: 0,
            patch: {
                status: 'queued',
                progressMode: 'indeterminate',
                progressPercent: undefined,
                errorMessage: undefined,
            },
        },
        {
            delayMs: 220,
            patch: {
                status: 'manifest',
                progressMode: 'indeterminate',
                progressPercent: undefined,
            },
        },
        {
            delayMs: 300,
            patch: {
                status: 'downloading',
                progressMode: 'determinate',
                progressPercent: 28,
            },
        },
        {
            delayMs: 320,
            patch: {
                status: 'downloading',
                progressMode: 'determinate',
                progressPercent: 73,
            },
        },
        {
            delayMs: 260,
            patch: {
                status: 'verifying',
                progressMode: 'indeterminate',
                progressPercent: 100,
            },
        },
        {
            delayMs: 300,
            patch: {
                status: 'installed',
                progressMode: undefined,
                progressPercent: undefined,
                errorMessage: undefined,
                installedVersion: manifest.assetPackVersion ?? manifest.modulePackVersion ?? 'mock-installed',
            },
        },
    ];

    const finished = (async () => {
        for (const step of steps) {
            await waitFor(step.delayMs);
            if (cancelled) {
                return currentState;
            }

            currentState = mergeGamePackageState(currentState, step.patch);
            options.onStateChange(currentState);
        }

        return currentState;
    })();

    return {
        cancel: () => {
            cancelled = true;
        },
        finished,
    };
};
