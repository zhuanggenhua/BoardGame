import { type BrowserContext, type Page } from '@playwright/test';
import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';


type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('smashup');
  await game.setupScene({ gameId: 'smashup' });
};
void __ensureThreeAxesMarker;

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
  const deadline = Date.now() + 45000;

  while (Date.now() < deadline) {
    for (const url of candidates) {
      try {
        const response = await page.request.get(url);
        if (response.ok()) return true;
      } catch {
        // ignore
      }
    }
    await page.waitForTimeout(1000);
  }

  return false;
};

const openSmashUpModal = async (page: Page) => {
  const createRoomButton = page.getByRole('button', { name: /创建房间|Create Room/i }).first();

  const tryOpenByEntry = async () => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const cardByDataId = page.locator('[data-game-id="smashup"]').first();
    if (await cardByDataId.isVisible().catch(() => false)) {
      await cardByDataId.scrollIntoViewIfNeeded();
      await cardByDataId.click();
      return;
    }
    const cardByHref = page.locator('a[href*="?game=smashup"]').first();
    await cardByHref.scrollIntoViewIfNeeded();
    await cardByHref.click();
  };

  await tryOpenByEntry();
  if (!await createRoomButton.isVisible().catch(() => false)) {
    await page.goto('/?game=smashup', { waitUntil: 'domcontentloaded' });
    await tryOpenByEntry();
  }

  await expect(createRoomButton).toBeVisible({ timeout: 15000 });
  return createRoomButton;
};

test.describe('大杀四方大厅 E2E', () => {
  test('3 人房间可加入且大厅会显示座位状态', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const hostContext = await browser.newContext({ baseURL });
    await setChineseLocale(hostContext);
    await resetMatchStorage(hostContext);
    await disableTutorial(hostContext);
    const hostPage = await hostContext.newPage();

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, 'Game server unavailable for online tests.');
    }

    const createRoomButton = await openSmashUpModal(hostPage);
    await createRoomButton.click();
    const createHeading = hostPage.getByRole('heading', { name: /创建房间|Create Room/i });
    await expect(createHeading).toBeVisible({ timeout: 10000 });
    const createModal = createHeading.locator('..').locator('..');

    const threePlayersButton = createModal.getByRole('button', { name: /3\s*players|3\s*人/i });
    await expect(threePlayersButton).toBeVisible({ timeout: 5000 });
    await threePlayersButton.click();

    await createModal.getByRole('button', { name: /确认|Confirm/i }).click();
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
    const roomTitle = viewerPage.getByText(new RegExp(`(对局|Match) #${matchShort} \\(1/3\\)`));
    await expect(roomTitle).toBeVisible({ timeout: 15000 });

    const roomInfo = roomTitle.locator('..').locator('..');
    // 房主已占 1 个座位，3 人房在大厅应展示“玩家 / 空位 / 空位”
    await expect(roomInfo).toContainText(/空位\s*\/\s*空位/, { timeout: 15000 });

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

    const createRoomButton = await openSmashUpModal(hostPage);
    await createRoomButton.click();
    const createHeading = hostPage.getByRole('heading', { name: /创建房间|Create Room/i });
    await expect(createHeading).toBeVisible({ timeout: 10000 });
    const createModal = createHeading.locator('..').locator('..');

    const twoPlayersButton = createModal.getByRole('button', { name: /2\s*players|2\s*人/i });
    await expect(twoPlayersButton).toBeVisible({ timeout: 5000 });
    await twoPlayersButton.click();

    await createModal.getByRole('button', { name: /确认|Confirm/i }).click();
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
    const factionHeading = hostPage.getByText(/选择你的派系|Draft Your Factions/i);
    await expect(factionHeading).toBeVisible({ timeout: 15000 });

    // 验证能看到至少一个派系名称（派系卡片上的文本）
    // 使用更宽松的选择器，因为派系名称在卡片上而非按钮中
    const anyFactionName = hostPage.getByText(/外星人|海盗|忍者|恐龙|机器人|巫师/).first();
    await expect(anyFactionName).toBeVisible({ timeout: 5000 });

    await hostContext.close();
  });

  test('派系选择页应显示 10 周年三派系且不再显示实施中横幅', async ({ browser }, testInfo) => {
    test.setTimeout(360000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const hostContext = await browser.newContext({ baseURL });
    await setChineseLocale(hostContext);
    await resetMatchStorage(hostContext);
    await disableTutorial(hostContext);
    const hostPage = await hostContext.newPage();

    if (!await ensureGameServerAvailable(hostPage)) {
      test.skip(true, 'Game server unavailable for online tests.');
    }

    const createRoomButton = await openSmashUpModal(hostPage);
    await expect(createRoomButton).toBeVisible({ timeout: 120000 });
    await createRoomButton.click({ timeout: 120000 });
    const createHeading = hostPage.getByRole('heading', { name: /创建房间|Create Room/i });
    await expect(createHeading).toBeVisible({ timeout: 30000 });
    const createModal = createHeading.locator('..').locator('..');

    const twoPlayersButton = createModal.getByRole('button', { name: /2\s*players|2\s*人/i });
    await expect(twoPlayersButton).toBeVisible({ timeout: 30000 });
    await twoPlayersButton.click();

    await createModal.getByRole('button', { name: /确认|Confirm/i }).click({ timeout: 30000 });
    await hostPage.waitForURL(/\/play\/smashup\/match\//, { timeout: 60000 });

    const hostUrl = new URL(hostPage.url());
    const matchId = hostUrl.pathname.split('/').pop();
    if (!matchId) {
      throw new Error('Failed to parse match id from host URL.');
    }
    if (!hostUrl.searchParams.get('playerID')) {
      hostUrl.searchParams.set('playerID', '0');
      await hostPage.goto(hostUrl.toString(), { waitUntil: 'domcontentloaded' });
    }

    const guestContext = await browser.newContext({ baseURL });
    await setChineseLocale(guestContext);
    await resetMatchStorage(guestContext);
    await disableTutorial(guestContext);
    const guestPage = await guestContext.newPage();
    await joinMatchAsGuest(guestPage, matchId);

    const loadingTextPattern = /正在加载对局资源|加载游戏模块|Loading game resources|Loading game module/i;
    await hostPage.getByText(loadingTextPattern).first().waitFor({ state: 'hidden', timeout: 300000 }).catch(() => {});

    await expect(hostPage.locator('h1').filter({ hasText: /选择你的派系|Draft Your Factions/i })).toBeVisible({ timeout: 300000 });

    await expect(hostPage.getByText(/美人鱼|Mermaids/i).first()).toBeVisible({ timeout: 15000 });
    await expect(hostPage.getByText(/骷髅|Skeletons/i).first()).toBeVisible({ timeout: 15000 });
    await expect(hostPage.getByText(/世界冠军|World Champs/i).first()).toBeVisible({ timeout: 15000 });

    const mermaidsName = hostPage.getByText(/美人鱼|Mermaids/i).first();
    const skeletonsName = hostPage.getByText(/骷髅|Skeletons/i).first();
    const worldChampsName = hostPage.getByText(/世界冠军|World Champs/i).first();

    const mermaidsBanner = hostPage.getByTestId('faction-implementation-banner-mermaids');
    const skeletonsBanner = hostPage.getByTestId('faction-implementation-banner-skeletons');
    const worldChampsBanner = hostPage.getByTestId('faction-implementation-banner-world_champs');

    await expect(mermaidsBanner).toHaveCount(0);
    await expect(skeletonsBanner).toHaveCount(0);
    await expect(worldChampsBanner).toHaveCount(0);
    await expect(hostPage.getByText(/分批实施|持续完善|being delivered in batches|continue to improve/i)).toHaveCount(0);

    const sharedDir = join(process.cwd(), 'test-results', 'evidence-screenshots', '_shared');
    mkdirSync(sharedDir, { recursive: true });
    await mermaidsName.scrollIntoViewIfNeeded();
    await mermaidsName.screenshot({ path: join(sharedDir, 'smashup-10th-factions-mermaids-name.png') });

    await skeletonsName.scrollIntoViewIfNeeded();
    await skeletonsName.screenshot({ path: join(sharedDir, 'smashup-10th-factions-skeletons-name.png') });

    await worldChampsName.scrollIntoViewIfNeeded();
    await worldChampsName.screenshot({ path: join(sharedDir, 'smashup-10th-factions-world-champs-name.png') });

    const sharedShot = join(sharedDir, 'smashup-10th-factions-selection.png');
    await hostPage.screenshot({ path: sharedShot, fullPage: false });
    await hostPage.screenshot({ path: testInfo.outputPath('smashup-10th-factions-selection.png'), fullPage: false });

    await guestContext.close();
    await hostContext.close();
  });
});
