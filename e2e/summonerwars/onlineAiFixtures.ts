import type { Browser } from '@playwright/test';
import { createSWRoomViaAPI, initSWContext } from '../helpers/summonerwars';
import { getMatchState } from '../helpers/state-injection';
import { getGameServerBaseURL } from '../helpers/common';
import { io } from 'socket.io-client';
import * as msgpackParser from 'socket.io-msgpack-parser';

/** 创建真实在线人机房，返回真人访问凭据及当前权威状态。 */
export async function createSummonerWarsOnlineAiMatch(browser: Browser, baseURL: string | undefined, storageKey: string) {
  const context = await browser.newContext({ baseURL });
  try {
    await initSWContext(context, storageKey);
    const page = await context.newPage();
    const matchId = await createSWRoomViaAPI(page, { setupData: {
      enableAi: true,
      seatControllers: { '0': { type: 'human' }, '1': { type: 'local-ai', minimumActionDelayMs: 1000 } },
    } });
    if (!matchId) throw new Error('召唤师战争人机房创建失败');
    await page.goto(`/play/summonerwars/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    const access = await page.evaluate((id) => {
      const raw = localStorage.getItem(`match_creds_${id}`);
      const saved = raw ? JSON.parse(raw) as { playerID: string; credentials: string } : null;
      if (!saved?.credentials) throw new Error('缺少真人席位凭据');
      return { playerId: saved.playerID, credentials: saved.credentials };
    }, matchId);
    const live = await getMatchState(matchId, page);
    return { context, page, matchId, access, live };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/** 读取服务端随机种子，供代表态选择可复现的随机游标。 */
export async function readSummonerWarsRandomSeed(matchId: string, credentials: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = io(`${getGameServerBaseURL()}/game`, {
      parser: msgpackParser, transports: ['websocket'], forceNew: true, reconnection: false,
    });
    const timeout = setTimeout(() => { socket.disconnect(); reject(new Error('读取对局随机种子超时')); }, 10000);
    socket.on('connect_error', error => { clearTimeout(timeout); socket.disconnect(); reject(error); });
    socket.on('connect', () => socket.emit('sync', matchId, '0', credentials));
    socket.on('state:sync', (id: string, _state: unknown, _players: unknown, random: { seed?: unknown }) => {
      if (id !== matchId || typeof random?.seed !== 'string') return;
      clearTimeout(timeout);
      socket.disconnect();
      resolve(random.seed);
    });
  });
}
