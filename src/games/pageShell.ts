import type { GameManifestEntry } from './manifest.types';

type GamePageShellConfig = Pick<GameManifestEntry, 'pageShell'>;

export function shouldKeepBoardMountedOnPlayerViewChange(
    entry?: GamePageShellConfig | null,
): boolean {
    return entry?.pageShell?.keepBoardMountedOnPlayerViewChange === true;
}
