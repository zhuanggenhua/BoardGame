import { GAME_CHANGELOG_API_URL } from '../config/server';
import type { GameChangelogItem } from '../components/lobby/gameDetailsContent';

export async function getGameChangelogs(gameId: string, signal?: AbortSignal): Promise<GameChangelogItem[]> {
    const response = await fetch(`${GAME_CHANGELOG_API_URL}/${encodeURIComponent(gameId)}`, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json() as { changelogs?: GameChangelogItem[] };
    return Array.isArray(body.changelogs) ? body.changelogs : [];
}
