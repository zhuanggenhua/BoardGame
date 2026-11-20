import { randomUUID } from 'node:crypto';
import { expect, type BrowserContext, type Page } from '@playwright/test';
import { GameTransportClient } from '../../src/engine/transport/client';
import type { MatchState } from '../../src/engine/types';
import type { FateDominationCore } from '../../src/games/fate-domination/domain';
import { getGameServerBaseURL, joinMatchViaAPI, seedMatchCredentials } from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';

export type FateState = MatchState<FateDominationCore>;

/** 正式联网房间只在入场前设定代表态，入场后的操作和读数走真实页面、游戏服。 */
export async function openFateRepresentativeBoard(page: Page, context: BrowserContext, prepare: (state: FateState) => void) {
    const gameId = 'fate-domination';
    const server = getGameServerBaseURL();
    const guestId = `fate-e2e-${randomUUID()}`;
    const response = await page.request.post(`${server}/games/${gameId}/create`, {
        data: { numPlayers: 3, setupData: { guestId, ownerKey: `guest:${guestId}`, ownerType: 'guest' } },
    });
    expect(response.ok()).toBe(true);
    const created = await response.json();
    const matchId = created.matchID as string;
    const credentials = created.ownerCredentials ?? await joinMatchViaAPI(page, gameId, matchId, '0', '测试员', guestId);
    const peers = new Map<string, string>();
    for (const playerID of ['1', '2']) {
        peers.set(playerID, await joinMatchViaAPI(page, gameId, matchId, playerID, `对手 ${playerID}`, `${guestId}-${playerID}`));
    }
    const access = { playerId: '0', credentials };
    const read = async () => await getMatchState(matchId, undefined, access) as FateState;
    const initial = await read();
    prepare(initial);
    // 通用注入校验要求顺位字段，Fate 的正式顺位由 core 持有。
    Object.assign(initial.sys, { turnOrder: [...initial.core.turnOrder], currentPlayerIndex: initial.core.currentTurnIndex });
    await injectMatchState(matchId, initial, undefined, access);
    await seedMatchCredentials(context, gameId, matchId, '0', credentials);
    await page.goto(`/play/${gameId}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('fate-domination-board')).toBeVisible({ timeout: 45000 });
    return { read, connectPeer: (playerID: string) => {
        const client = new GameTransportClient({ server, matchID: matchId, playerID, credentials: peers.get(playerID)! });
        client.connect();
        return client;
    } };
}
