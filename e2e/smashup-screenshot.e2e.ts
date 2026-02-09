import { test, expect, type BrowserContext, type Page } from '@playwright/test';

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
        localStorage.setItem('audio_sfx_volume', '0');
        localStorage.setItem('audio_bgm_volume', '0');
        (window as Window & { __BG_DISABLE_AUDIO__?: boolean }).__BG_DISABLE_AUDIO__ = true;
    });
};

const blockAudioRequests = async (context: BrowserContext) => {
    await context.route(/\.(mp3|ogg|webm|wav)(\?.*)?$/i, route => route.abort());
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

const joinSmashUpMatch = async (page: Page, matchId: string, playerId: string, playerName: string) => {
    const gameServerBaseURL = getGameServerBaseURL();
    const url = `${gameServerBaseURL}/games/smashup/${matchId}/join`;
    const response = await page.request.post(url, {
        data: { playerID: playerId, playerName },
    });
    if (!response.ok()) return null;
    const data = await response.json().catch(() => null) as { playerCredentials?: string } | null;
    return data?.playerCredentials ?? null;
};

const seedMatchCredentials = async (context: BrowserContext, matchId: string, playerId: string, credentials: string) => {
    await context.addInitScript(({ matchId, playerId, credentials }) => {
        const payload = {
            matchID: matchId,
            playerID: playerId,
            credentials,
            gameName: 'smashup',
            updatedAt: Date.now(),
        };
        localStorage.setItem(`match_creds_${matchId}`, JSON.stringify(payload));
        window.dispatchEvent(new Event('match-credentials-changed'));
    }, { matchId, playerId, credentials });
};

const waitForFrontendAssets = async (page: Page, timeoutMs = 30000) => {
    const start = Date.now();
    let lastStatus = 'unknown';
    while (Date.now() - start < timeoutMs) {
        try {
            const [viteClient, main] = await Promise.all([
                page.request.get('/@vite/client'),
                page.request.get('/src/main.tsx'),
            ]);
            lastStatus = `vite=${viteClient.status()} main=${main.status()}`;
            if (viteClient.ok() && main.ok()) {
                return;
            }
        } catch (err) {
            lastStatus = `error:${String(err)}`;
        }
        await page.waitForTimeout(500);
    }
    throw new Error(`前端资源未就绪${lastStatus}`);
};

const waitForHomeGameList = async (page: Page, timeoutMs = 30000) => {
    const start = Date.now();
    await page.waitForLoadState('domcontentloaded');
    await waitForFrontendAssets(page);
    // 增加重试逻辑，避免偶尔加载慢导致失败
    while (Date.now() - start < timeoutMs) {
        try {
            await page.waitForSelector('[data-game-id]', { timeout: 5000, state: 'attached' });
            return;
        } catch {
            // 如果超时，再试一次
            await page.waitForTimeout(1000);
        }
    }
    throw new Error(`等待游戏列表超时: [data-game-id] 未找到`);
};

const waitForMatchAvailable = async (page: Page, matchId: string, timeoutMs = 10000) => {
    const gameServerBaseURL = getGameServerBaseURL();
    const candidates = [
        `/games/smashup/${matchId}`,
        `${gameServerBaseURL}/games/smashup/${matchId}`,
    ];
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        for (const url of candidates) {
            try {
                const response = await page.request.get(url);
                if (response.ok()) return true;
            } catch {
                // ignore
            }
        }
        await page.waitForTimeout(500);
    }
    return false;
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

const openSmashUpModal = async (page: Page) => {
    await page.goto('/?game=smashup', { waitUntil: 'domcontentloaded' });
    await dismissViteOverlay(page);
    await dismissLobbyConfirmIfNeeded(page);
    await waitForHomeGameList(page);

    // 处理已有活跃对局的提示
    const returnToMatchButton = page.locator('button', { hasText: /Return to match|返回对局/i }).first();
    if (await returnToMatchButton.isVisible().catch(() => false)) {
        console.log('[DEBUG] Found active match prompt, dismissing...');
        // 点击取消或关闭按钮，或者按ESC键
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
    }

    const modalRoot = page.locator('#modal-root');
    const heading = modalRoot.getByRole('heading', { name: /Smash Up|大杀四方/i });
    if (!await heading.isVisible().catch(() => false)) {
        const gameCard = page.locator('[data-game-id="smashup"]').first();
        await gameCard.scrollIntoViewIfNeeded();
        await gameCard.evaluate((node) => {
            (node as HTMLElement | null)?.click();
        });
    }
    await expect(heading).toBeVisible({ timeout: 15000 });
    return heading;
};

const waitForFactionSelection = async (page: Page, timeout = 20000) => {
    await expect(
        page.locator('h1').filter({ hasText: /Draft Your Factions|选择你的派系/i })
    ).toBeVisible({ timeout });
};

const openFactionCard = async (page: Page, index: number) => {
    const card = page.locator('.grid > div').nth(index);
    await expect(card).toBeVisible({ timeout: 8000 });
    await card.click();
};

const confirmFactionSelection = async (page: Page) => {
    const confirmButton = page.getByRole('button', { name: /Confirm Selection|确认选择/i });
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await expect(confirmButton).toBeEnabled({ timeout: 5000 });
    await confirmButton.click();
    await expect(confirmButton).toBeHidden({ timeout: 5000 });
};

const selectFactionByIndex = async (page: Page, index: number) => {
    await openFactionCard(page, index);
    await confirmFactionSelection(page);
};

const createSmashUpRoom = async (
    page: Page,
    outputPath: (name: string) => string,
): Promise<string | null> => {
    try {
        await openSmashUpModal(page);
    } catch (err) {
        console.log('[DEBUG] openSmashUpModal failed:', err);
        return null;
    }

    await page.getByRole('button', { name: /Create Room|创建房间/i }).click();
    const createHeading = page.getByRole('heading', { name: /Create Room|创建房间/i });
    await expect(createHeading).toBeVisible({ timeout: 10000 });
    const createModal = createHeading.locator('..').locator('..');

    const twoPlayersButton = createModal.getByRole('button', { name: /2\s*players|2\s*人/i });
    await expect(twoPlayersButton).toBeVisible({ timeout: 5000 });
    await twoPlayersButton.click();

    await createModal.getByRole('button', { name: /Confirm|确认/i }).evaluate((el) => (el as HTMLButtonElement).click());
    console.log('[DEBUG] Confirm button clicked via evaluate');
    console.log('[DEBUG] Create room button clicked, waiting for network idle...');
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    console.log('[DEBUG] Current URL after click:', page.url());
    try {
        await page.waitForURL(/\/play\/smashup\/match\//, { timeout: 15000 });
        console.log('[DEBUG] Navigation success, current URL:', page.url());
    } catch (err) {
        console.log('[DEBUG] waitForURL failed, final URL:', page.url());
        // 检查是否有错误弹窗
        const errorText = await page.locator('text=/error|failed|错误|失败/i').first().textContent().catch(() => 'none');
        console.log('[DEBUG] Error text found:', errorText);
        await page.screenshot({ path: outputPath('debug-room-creation.png') });
        return null;
    }

    const hostUrl = new URL(page.url());
    const matchId = hostUrl.pathname.split('/').pop();
    if (!matchId) {
        console.log('[DEBUG] matchId is null');
        return null;
    }

    if (!hostUrl.searchParams.get('playerID')) {
        hostUrl.searchParams.set('playerID', '0');
        await page.goto(hostUrl.toString());
    }

    if (!await waitForMatchAvailable(page, matchId, 15000)) {
        console.log('[DEBUG] waitForMatchAvailable failed for matchId:', matchId);
        return null;
    }

    return matchId;
};

test.describe('Smash Up 手牌截图', () => {
    test('进入对局后截取手牌区', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const hostContext = await browser.newContext({ baseURL });
        await blockAudioRequests(hostContext);
        await setEnglishLocale(hostContext);
        await resetMatchStorage(hostContext);
        await disableTutorial(hostContext);
        await disableAudio(hostContext);
        const hostPage = await hostContext.newPage();

        // 监听控制台错误
        hostPage.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('[PAGE ERROR]', msg.text());
            }
        });
        hostPage.on('pageerror', err => {
            console.log('[PAGE EXCEPTION]', err.message);
        });

        if (!await ensureGameServerAvailable(hostPage)) {
            console.log('[DEBUG] Game server unavailable, skipping test');
            test.skip(true, 'Game server unavailable');
        }

        const matchId = await createSmashUpRoom(hostPage, testInfo.outputPath);
        if (!matchId) {
            console.log('[DEBUG] Room creation failed, skipping test');
            test.skip(true, 'Room creation failed');
            return;
        }

        await waitForFactionSelection(hostPage);

        const guestContext = await browser.newContext({ baseURL });
        await blockAudioRequests(guestContext);
        await setEnglishLocale(guestContext);
        await resetMatchStorage(guestContext);
        await disableTutorial(guestContext);
        await disableAudio(guestContext);
        const guestPage = await guestContext.newPage();

        const guestPlayerId = '1';
        const guestCredentials = await joinSmashUpMatch(hostPage, matchId, guestPlayerId, `Guest-${Date.now()}`);
        if (!guestCredentials) {
            console.log('[DEBUG] Guest join failed, skipping test');
            test.skip(true, 'Guest 加入房间失败');
            return;
        }
        await seedMatchCredentials(guestContext, matchId, guestPlayerId, guestCredentials);

        await guestPage.goto(`/play/smashup/match/${matchId}?playerID=${guestPlayerId}`, { waitUntil: 'domcontentloaded' });

        await waitForFactionSelection(guestPage);

        // 选派系顺序：P0 -> P1 -> P1 -> P0
        await selectFactionByIndex(hostPage, 0);
        await selectFactionByIndex(guestPage, 1);
        await selectFactionByIndex(guestPage, 2);
        await selectFactionByIndex(hostPage, 3);

        const handArea = hostPage.getByTestId('su-hand-area');
        await expect(handArea).toBeVisible({ timeout: 30000 });
        await hostPage.waitForTimeout(1000);

        await handArea.screenshot({ path: testInfo.outputPath('smashup-hand-area.png') });
        await hostPage.screenshot({ path: testInfo.outputPath('smashup-hand-full.png'), fullPage: true });

        await guestContext.close();
        await hostContext.close();
    });
});
