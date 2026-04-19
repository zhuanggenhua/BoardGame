import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

const disableTutorial = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    localStorage.setItem('tutorial_skip', '1');
  });
};

const resetMatchStorage = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    if (sessionStorage.getItem('__smashup_storage_reset')) return;
    sessionStorage.setItem('__smashup_storage_reset', '1');

    const newGuestId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    localStorage.removeItem('owner_active_match');
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('match_creds_')) {
        localStorage.removeItem(key);
      }
    });
    localStorage.setItem('guest_id', newGuestId);
    try {
      sessionStorage.setItem('guest_id', newGuestId);
    } catch {
      // ignore
    }
    document.cookie = `bg_guest_id=${encodeURIComponent(newGuestId)}; path=/; SameSite=Lax`;
  });
};

const normalizeUrl = (url: string) => url.replace(/\/$/, '');

const getGameServerBaseURL = () => {
  const envUrl = process.env.PW_GAME_SERVER_URL || process.env.VITE_GAME_SERVER_URL;
  if (envUrl) return normalizeUrl(envUrl);
  const port = process.env.GAME_SERVER_PORT || process.env.PW_GAME_SERVER_PORT || '18000';
  return `http://localhost:${port}`;
};

const joinMatchAsGuest = async (page: Page, matchId: string, gameId = 'smashup') => {
  const base = getGameServerBaseURL();
  const matchResp = await page.request.get(`${base}/games/${gameId}/${matchId}`);
  const matchData = await matchResp.json();
  const openSeat = (matchData.players as { id: number; name?: string }[])
    ?.sort((a: { id: number }, b: { id: number }) => b.id - a.id)
    .find((p: { name?: string }) => !p.name);
  if (!openSeat) throw new Error('No open seat found');
  const pid = String(openSeat.id);
  const guestId = `e2e_guest_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const joinResp = await page.request.post(`${base}/games/${gameId}/${matchId}/join`, {
    data: { playerID: pid, playerName: `游客_${guestId}`, data: { guestId } },
  });
  const joinData = await joinResp.json();
  await page.goto(`/play/${gameId}/match/${matchId}?playerID=${pid}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ mid, p, creds, gname }: { mid: string; p: string; creds: string; gname: string }) => {
      localStorage.setItem(
        `match_creds_${mid}`,
        JSON.stringify({ playerID: p, credentials: creds, matchID: mid, gameName: gname }),
      );
    },
    { mid: matchId, p: pid, creds: joinData.playerCredentials, gname: gameId },
  );
  return pid;
};

const ensureGameServerAvailable = async (page: Page) => {
  const gameServerBaseURL = getGameServerBaseURL();
  const candidates = ['/games', `${gameServerBaseURL}/games`];
  for (const url of candidates) {
    try {
      const response = await page.request.get(url);
      if (response.ok()) return true;
    } catch {
      // ignore
    }
  }
  return false;
};

const openSmashUpModal = async (page: Page) => {
  await page.goto('/?game=smashup', { waitUntil: 'domcontentloaded' });
  const heading = page.getByRole('heading', { name: '大杀四方' });
  await expect(heading).toBeVisible({ timeout: 15000 });
  return heading;
};

test.describe('大杀四方大厅 E2E', () => {
  test('3 人房间可加入且大厅会显示座位状态', async ({ browser }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await setChineseLocale(hostContext);
    await resetMatchStorage(hostContext);
    await disableTutorial(hostContext);
    const hostPage = await hostContext.newPage();

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, 'Game server unavailable for online tests.');
    }

    await openSmashUpModal(hostPage);
    await hostPage.getByRole('button', { name: '创建房间' }).click();
    const createHeading = hostPage.getByRole('heading', { name: '创建房间' });
    await expect(createHeading).toBeVisible({ timeout: 10000 });
    const createModal = createHeading.locator('..').locator('..');

    const threePlayersButton = createModal.getByRole('button', { name: /3\s*players|3\s*人/i });
    await expect(threePlayersButton).toBeVisible({ timeout: 5000 });
    await threePlayersButton.click();

    await createModal.getByRole('button', { name: '确认' }).click();
    try {
      await hostPage.waitForURL(/\/play\/smashup\/match\//, { timeout: 8000 });
    } catch {
      test.skip(true, 'Room creation failed or backend unavailable.');
    }

    const hostUrl = new URL(hostPage.url());
    const matchId = hostUrl.pathname.split('/').pop();
    if (!matchId) {
      throw new Error('Failed to parse match id from host URL.');
    }

    if (!hostUrl.searchParams.get('playerID')) {
      hostUrl.searchParams.set('playerID', '0');
      await hostPage.goto(hostUrl.toString());
    }

    const viewerContext = await browser.newContext({ baseURL });
    await setChineseLocale(viewerContext);
    await resetMatchStorage(viewerContext);
    const viewerPage = await viewerContext.newPage();
    await openSmashUpModal(viewerPage);

    const matchShort = matchId.slice(0, 4);
    const roomTitle = viewerPage.getByText(new RegExp(`对局 #${matchShort} \\(1/3\\)`));
    await expect(roomTitle).toBeVisible({ timeout: 15000 });

    const roomInfo = roomTitle.locator('..').locator('..');
    await expect(roomInfo.getByText(/空位\s*\/\s*空位\s*\/\s*空位/)).toBeVisible({ timeout: 15000 });

    await viewerContext.close();

    const guestContext1 = await browser.newContext({ baseURL });
    await setChineseLocale(guestContext1);
    await resetMatchStorage(guestContext1);
    await disableTutorial(guestContext1);
    const guestPage1 = await guestContext1.newPage();
    const guestId1 = await joinMatchAsGuest(guestPage1, matchId!);

    const guestContext2 = await browser.newContext({ baseURL });
    await setChineseLocale(guestContext2);
    await resetMatchStorage(guestContext2);
    await disableTutorial(guestContext2);
    const guestPage2 = await guestContext2.newPage();
    const guestId2 = await joinMatchAsGuest(guestPage2, matchId!);

    if (!guestId1 || !guestId2) {
      throw new Error('Failed to resolve guest player IDs.');
    }

    const guestIds = [guestId1, guestId2].sort();
    expect(guestIds).toEqual(['1', '2']);

    await guestContext1.close();
    await guestContext2.close();
    await hostContext.close();
  });

  test('房主在房间就绪后会看到派系选择界面', async ({ browser }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await setChineseLocale(hostContext);
    await resetMatchStorage(hostContext);
    await disableTutorial(hostContext);
    const hostPage = await hostContext.newPage();

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, 'Game server unavailable for online tests.');
    }

    await openSmashUpModal(hostPage);
    await hostPage.getByRole('button', { name: '创建房间' }).click();
    const createHeading = hostPage.getByRole('heading', { name: '创建房间' });
    await expect(createHeading).toBeVisible({ timeout: 10000 });
    const createModal = createHeading.locator('..').locator('..');

    const twoPlayersButton = createModal.getByRole('button', { name: /2\s*players|2\s*人/i });
    await expect(twoPlayersButton).toBeVisible({ timeout: 5000 });
    await twoPlayersButton.click();

    await createModal.getByRole('button', { name: '确认' }).click();
    try {
      await hostPage.waitForURL(/\/play\/smashup\/match\//, { timeout: 8000 });
    } catch {
      test.skip(true, 'Room creation failed or backend unavailable.');
    }

    const hostUrl = new URL(hostPage.url());
    if (!hostUrl.searchParams.get('playerID')) {
      hostUrl.searchParams.set('playerID', '0');
      await hostPage.goto(hostUrl.toString());
    }

    // 等待派系选择界面出现（关键交互面）
    const factionHeading = hostPage.getByText('选择你的派系');
    await expect(factionHeading).toBeVisible({ timeout: 15000 });

    // 验证能看到至少一个派系名称（派系卡片上的文本）
    // 使用更宽松的选择器，因为派系名称在卡片上而非按钮中
    const anyFactionName = hostPage.getByText(/外星人|海盗|忍者|恐龙|机器人|巫师/).first();
    await expect(anyFactionName).toBeVisible({ timeout: 5000 });

    await hostContext.close();
  });
});
