import { expect, type Page } from '@playwright/test';
import { getMatchState } from '../helpers/state-injection';
import type { FateState } from './onlineRepresentativeBoard';

/** 使用玩家大厅创建三人在线房间，另外两席由服务端 AI 操作。 */
export async function createFateLobbyMatch(page: Page) {
    await page.getByTestId('game-details-open-create-room').first().click();
    const lobby = page.getByTestId('create-room-modal').last();
    await lobby.getByRole('button', { name: '3人', exact: true }).click();
    await lobby.getByRole('button', { name: /^加入 AI/ }).click();
    await lobby.getByTestId('create-room-confirm-button').click();
    await page.waitForURL(/\/play\/fate-domination\/match\/[^/?]+\?playerID=0/);
    await expect(page.getByTestId('fate-domination-board')).toBeVisible({ timeout: 45_000 });
    const matchId = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)!);
    return { matchId, read: async () => await getMatchState(matchId, page) as FateState };
}
