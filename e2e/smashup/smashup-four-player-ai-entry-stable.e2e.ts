import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    ensureGameServerAvailable,
    getGameServerBaseURL,
    initContext,
    seedMatchCredentials,
    waitForMatchAvailable,
    waitForFrontendAssets,
    waitForHomeGameList,
    waitForTestHarness,
} from '../helpers/common';

const GAME_NAME = 'smashup';

async function ensureLobbyReady(page: Page): Promise<void> {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForFrontendAssets(page, 45_000);
    await waitForHomeGameList(page, 45_000);
    await expect(page.getByRole('heading', { name: '大杀四方' })).toBeVisible({ timeout: 15_000 });
}

async function openSmashupCreateRoomModal(page: Page): Promise<void> {
    await page.getByRole('heading', { name: '大杀四方' }).click();
    await expect(page).toHaveURL(/game=smashup/);
    const detailsModal = page.locator('[data-testid="game-details-modal-root"]:visible').last();
    await expect(detailsModal).toBeVisible({ timeout: 15_000 });
    const openCreateRoomButton = detailsModal.getByTestId('game-details-open-create-room');
    await expect(openCreateRoomButton).toBeVisible({ timeout: 10_000 });
    await openCreateRoomButton.click();
    await expect(page.getByTestId('create-room-modal').last()).toBeVisible({ timeout: 10_000 });
}

test.describe('SmashUp 四人 AI 进房稳定性', () => {
    test('1 真人 + 3 AI 房间进入后不应自动退出并反复重进', async ({ browser, baseURL }) => {
        test.setTimeout(90_000);

        const context = await browser.newContext({ baseURL });
        await initContext(context, {
            storageKey: '__smashup_four_player_ai_entry_stable',
            skipImageGate: true,
        });

        const page = await context.newPage();
        const diagnostics = attachPageDiagnostics(page);

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        test.skip(!(await ensureGameServerAvailable(page)), '游戏服务器不可用');

        const guestId = `su_four_ai_entry_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const ownerKey = `guest:${guestId}`;

        await context.addInitScript((id) => {
            localStorage.setItem('guest_id', id);
            sessionStorage.setItem('guest_id', id);
            document.cookie = `bg_guest_id=${encodeURIComponent(id)}; path=/; SameSite=Lax`;
        }, guestId);

        const createResponse = await page.request.post(`${getGameServerBaseURL()}/games/${GAME_NAME}/create`, {
            data: {
                numPlayers: 4,
                setupData: {
                    guestId,
                    ownerKey,
                    ownerType: 'guest',
                    enableAi: true,
                    seatControllers: {
                        '1': { type: 'local-ai', minimumActionDelayMs: 0 },
                        '2': { type: 'local-ai', minimumActionDelayMs: 0 },
                        '3': { type: 'local-ai', minimumActionDelayMs: 0 },
                    },
                },
            },
        });
        expect(createResponse.ok()).toBeTruthy();

        const createData = (await createResponse.json().catch(() => null)) as { matchID?: string } | null;
        const matchId = createData?.matchID;
        expect(matchId).toBeTruthy();
        if (!matchId) {
            throw new Error('未能从建房响应中拿到 matchId');
        }

        const claimResponse = await page.request.post(`${getGameServerBaseURL()}/games/${GAME_NAME}/${matchId}/claim-seat`, {
            data: {
                playerID: '0',
                playerName: '四人房房主',
                guestId,
            },
        });
        expect(claimResponse.ok()).toBeTruthy();

        const claimData = (await claimResponse.json().catch(() => null)) as { playerCredentials?: string } | null;
        const hostCredentials = claimData?.playerCredentials;
        expect(hostCredentials).toBeTruthy();
        if (!hostCredentials) {
            throw new Error('未能为房主拿到对局凭据');
        }

        await seedMatchCredentials(context, GAME_NAME, matchId, '0', hostCredentials);
        await context.addInitScript(({ targetMatchId, targetOwnerKey }) => {
            localStorage.setItem('owner_active_match', JSON.stringify({
                matchID: targetMatchId,
                gameName: 'smashup',
                ownerKey: targetOwnerKey,
                ownerType: 'guest',
                updatedAt: Date.now(),
            }));
            window.dispatchEvent(new Event('owner-active-match-changed'));
        }, { targetMatchId: matchId, targetOwnerKey: ownerKey });

        expect(await waitForMatchAvailable(page, GAME_NAME, matchId, 20_000)).toBe(true);

        const navigationHistory: string[] = [];
        page.on('framenavigated', (frame) => {
            if (frame === page.mainFrame()) {
                navigationHistory.push(frame.url());
            }
        });

        await page.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
        await waitForTestHarness(page, 20_000);
        await page.waitForTimeout(12_000);

        await expect(page).toHaveURL(new RegExp(`/play/${GAME_NAME}/match/${matchId}\\?playerID=0`));
        await expect.poll(async () => page.evaluate((targetMatchId) => {
            const raw = localStorage.getItem(`match_creds_${targetMatchId}`);
            if (!raw) return null;
            try {
                return JSON.parse(raw).playerID ?? null;
            } catch {
                return 'parse-error';
            }
        }, matchId), {
            timeout: 5_000,
            message: '房主本地凭据不应在进房后被清掉',
        }).toBe('0');

        await expect.poll(async () => page.evaluate((targetMatchId) => {
            const raw = localStorage.getItem(`match_ai_creds_${targetMatchId}`);
            if (!raw) return [];
            try {
                return Object.keys(JSON.parse(raw)).sort();
            } catch {
                return ['parse-error'];
            }
        }, matchId), {
            timeout: 15_000,
            message: 'AI 座位凭据应能补齐到 1/2/3 号位',
        }).toEqual(['1', '2', '3']);

        const unexpectedNavigations = navigationHistory.filter((url) => !url.includes(`/play/${GAME_NAME}/match/${matchId}`));
        expect(unexpectedNavigations, `出现了异常主框架跳转: ${unexpectedNavigations.join(' | ')}`).toEqual([]);

        assertNoFatalFrontendErrors([{ label: 'host', diagnostics }]);

        const evidenceDir = join(
            process.cwd(),
            'test-results',
            'evidence-screenshots',
            '_shared',
            'smashup-four-player-ai-entry-stable',
        );
        mkdirSync(evidenceDir, { recursive: true });
        await page.screenshot({
            path: join(evidenceDir, 'smashup-four-player-ai-entry-stable.png'),
            fullPage: false,
            timeout: 5_000,
        });

        await context.close();
    });

    test('大厅 UI 创建 4 人 3 AI 房间后不应自动退出并反复重进', async ({ browser, baseURL }) => {
        test.setTimeout(120_000);

        const context = await browser.newContext({ baseURL });
        await initContext(context, {
            storageKey: '__smashup_four_player_ai_entry_ui_loop',
            skipImageGate: true,
        });

        const page = await context.newPage();
        const diagnostics = attachPageDiagnostics(page);

        test.skip(!(await ensureGameServerAvailable(page)), '游戏服务器不可用');
        await ensureLobbyReady(page);

        const navigationHistory: string[] = [];
        page.on('framenavigated', (frame) => {
            if (frame === page.mainFrame()) {
                navigationHistory.push(frame.url());
            }
        });

        await openSmashupCreateRoomModal(page);
        const createRoomModal = page.getByTestId('create-room-modal').last();

        await page.getByRole('button', { name: '4人' }).click();
        await page.getByRole('button', { name: '加入 AI' }).click();
        await expect(page.getByText('已开启')).toBeVisible();

        await page.getByRole('button', { name: '3 号位' }).click();
        await page.getByRole('button', { name: '4 号位' }).click();
        await expect(page.getByRole('button', { name: '1 号位（房主）' })).toBeDisabled();
        await expect(page.getByRole('button', { name: '2 号位' })).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByRole('button', { name: '3 号位' })).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByRole('button', { name: '4 号位' })).toHaveAttribute('aria-pressed', 'true');

        navigationHistory.length = 0;
        await createRoomModal.getByTestId('create-room-confirm-button').click();
        await expect(page).toHaveURL(/\/play\/smashup\/match\/[^?]+\?playerID=0/, { timeout: 15_000 });

        const matchId = page.url().match(/\/play\/smashup\/match\/([^?]+)/)?.[1];
        expect(matchId).toBeTruthy();
        if (!matchId) {
            throw new Error('未能从 URL 提取 matchId');
        }

        await waitForTestHarness(page, 20_000);
        await page.waitForTimeout(12_000);

        await expect(page).toHaveURL(new RegExp(`/play/${GAME_NAME}/match/${matchId}\\?playerID=0`));
        await expect.poll(async () => page.evaluate((targetMatchId) => {
            const raw = localStorage.getItem(`match_creds_${targetMatchId}`);
            if (!raw) return null;
            try {
                return JSON.parse(raw).playerID ?? null;
            } catch {
                return 'parse-error';
            }
        }, matchId), {
            timeout: 5_000,
            message: '房主本地凭据不应在 UI 进房后被清掉',
        }).toBe('0');

        const unexpectedNavigations = navigationHistory.filter((url) => !url.includes(`/play/${GAME_NAME}/match/${matchId}`));
        expect(unexpectedNavigations, `出现了异常主框架跳转: ${unexpectedNavigations.join(' | ')}`).toEqual([]);

        await expect.poll(async () => page.evaluate((targetMatchId) => {
            const raw = localStorage.getItem(`match_ai_creds_${targetMatchId}`);
            if (!raw) return [];
            try {
                return Object.keys(JSON.parse(raw)).sort();
            } catch {
                return ['parse-error'];
            }
        }, matchId), {
            timeout: 15_000,
            message: 'AI 座位凭据应能补齐到 1/2/3 号位',
        }).toEqual(['1', '2', '3']);

        await expect.poll(async () => {
            const response = await page.request.get(`${getGameServerBaseURL()}/games/${GAME_NAME}/${matchId}`);
            if (!response.ok()) return `http-${response.status()}`;
            const data = await response.json().catch(() => null) as { status?: string } | null;
            return data?.status ?? null;
        }, {
            timeout: 10_000,
            message: '所有真人/AI 座位 claim-seat 后房间应进入 playing，不能一直停在 waiting',
        }).toBe('playing');

        assertNoFatalFrontendErrors([{ label: 'ui-host', diagnostics }]);

        const evidenceDir = join(
            process.cwd(),
            'test-results',
            'evidence-screenshots',
            '_shared',
            'smashup-four-player-ai-entry-ui-loop',
        );
        mkdirSync(evidenceDir, { recursive: true });
        await page.screenshot({
            path: join(evidenceDir, 'smashup-four-player-ai-entry-ui-loop.png'),
            fullPage: false,
            timeout: 5_000,
        });

        await context.close();
    });
});
