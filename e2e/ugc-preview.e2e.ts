import { test, expect, type BrowserContext, type Page } from '@playwright/test';

const PACKAGE_ID = 'doudizhu-preview';
const GAME_NAME = /斗地主预览/i;

const setEnglishLocale = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'en');
  });
};

const disableTutorial = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    localStorage.setItem('tutorial_skip', '1');
  });
};

const disableAudio = async (context: BrowserContext | Page) => {
  await context.addInitScript(() => {
    localStorage.setItem('audio_muted', 'true');
    localStorage.setItem('audio_master_volume', '0');
    (window as Window & { __BG_DISABLE_AUDIO__?: boolean }).__BG_DISABLE_AUDIO__ = true;
  });
};

const blockAudioRequests = async (context: BrowserContext) => {
  await context.route(/\.(mp3|ogg|webm|wav)(\?.*)?$/i, route => route.abort());
};

const dismissViteOverlay = async (page: Page) => {
  await page.evaluate(() => {
    const overlay = document.querySelector('vite-error-overlay');
    if (overlay) overlay.remove();
  });
};

const dismissLobbyConfirmIfNeeded = async (page: Page) => {
  const confirmButton = page
    .locator('button:has-text("确认")')
    .or(page.locator('button:has-text("Confirm")'));
  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click();
    await page.waitForTimeout(1000);
  }
};

const waitForHomeGameList = async (page: Page) => {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('[data-game-id]', { timeout: 15000, state: 'attached' });
};

const ensureGameServerAvailable = async (page: Page) => {
  const gameServerBaseURL = process.env.PW_GAME_SERVER_URL || process.env.VITE_GAME_SERVER_URL || 'http://localhost:18000';
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

test.describe('UGC 斗地主预览流程', () => {
  test('大厅可见并能进入 UGC 对局（截图）', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;

    const context = await browser.newContext({ baseURL });
    await blockAudioRequests(context);
    await setEnglishLocale(context);
    await disableAudio(context);
    await disableTutorial(context);

    const page = await context.newPage();

    if (!await ensureGameServerAvailable(page)) {
      test.skip(true, 'Game server unavailable');
    }

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissViteOverlay(page);
    await dismissLobbyConfirmIfNeeded(page);
    await waitForHomeGameList(page);

    const ugcCard = page.locator(`[data-game-id="${PACKAGE_ID}"]`).first();
    await expect(ugcCard).toBeVisible({ timeout: 20000 });

    await page.screenshot({ path: testInfo.outputPath('ugc-preview-lobby.png'), fullPage: true });

    await ugcCard.click();
    await expect(page).toHaveURL(/game=doudizhu-preview/);

    const modalRoot = page.locator('#modal-root');
    await expect(modalRoot.getByRole('heading', { name: GAME_NAME })).toBeVisible({ timeout: 15000 });

    const lobbyTab = modalRoot.getByRole('button', { name: /Lobby|在线大厅/i });
    if (await lobbyTab.isVisible().catch(() => false)) {
      await lobbyTab.click();
    }

    const createButton = modalRoot.locator('button:visible', { hasText: /Create Room|创建房间/i }).first();
    await expect(createButton).toBeVisible({ timeout: 20000 });
    await createButton.click();

    await expect(page.getByRole('heading', { name: /Create Room|创建房间/i })).toBeVisible({ timeout: 10000 });
    const confirmButton = page.getByRole('button', { name: /Confirm|确认/i });
    await expect(confirmButton).toBeEnabled({ timeout: 5000 });
    await confirmButton.click();

    await page.waitForURL(/\/play\/doudizhu-preview\/match\//, { timeout: 15000 });

    const iframe = page.locator(`iframe[title="UGC Remote Host ${PACKAGE_ID}"]`);
    await expect(iframe).toBeVisible({ timeout: 20000 });

    const previewCanvas = page
      .frameLocator(`iframe[title="UGC Remote Host ${PACKAGE_ID}"]`)
      .locator('[data-testid="ugc-preview-canvas"]');
    await expect(previewCanvas).toBeVisible({ timeout: 20000 });

    await page.screenshot({ path: testInfo.outputPath('ugc-preview-match.png'), fullPage: true });

    await context.close();
  });
});
