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
import { getMatchState } from '../helpers/state-injection';

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

async function selectSmashUpFactionById(page: Page, factionId: string) {
    await expect(page.getByTestId(`faction-option-${factionId}`)).toBeVisible({ timeout: 10_000 });
    await page.getByTestId(`faction-option-${factionId}`).click();

    const confirmButton = page.getByTestId('faction-confirm-button');
    await confirmButton.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(confirmButton).toBeEnabled({ timeout: 15_000 });
    const clickPoint = await confirmButton.evaluate((button) => {
        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hitTarget = document.elementFromPoint(x, y);
        const ownsHitTarget = hitTarget === button || button.contains(hitTarget);
        return { x, y, ownsHitTarget };
    });
    expect(clickPoint.ownsHitTarget, `派系 ${factionId} 的确认按钮中心点应可真实点击`).toBe(true);
    await page.mouse.click(clickPoint.x, clickPoint.y);
}

async function readSmashUpFactionDraftSummary(page: Page, matchId: string) {
    const state = await getMatchState(matchId, page);
    return {
        phase: state.sys?.phase ?? null,
        currentPlayerIndex: state.core?.currentPlayerIndex ?? null,
        host: state.core?.factionSelection?.playerSelections?.['0']?.length ?? 0,
        ai1: state.core?.factionSelection?.playerSelections?.['1']?.length ?? 0,
        ai2: state.core?.factionSelection?.playerSelections?.['2']?.length ?? 0,
        ai3: state.core?.factionSelection?.playerSelections?.['3']?.length ?? 0,
        hostFactions: state.core?.players?.['0']?.factions?.filter(Boolean).length ?? 0,
        ai1Factions: state.core?.players?.['1']?.factions?.filter(Boolean).length ?? 0,
        ai2Factions: state.core?.players?.['2']?.factions?.filter(Boolean).length ?? 0,
        ai3Factions: state.core?.players?.['3']?.factions?.filter(Boolean).length ?? 0,
        hostDeck: state.core?.players?.['0']?.deck?.length ?? 0,
        ai1Deck: state.core?.players?.['1']?.deck?.length ?? 0,
        ai2Deck: state.core?.players?.['2']?.deck?.length ?? 0,
        ai3Deck: state.core?.players?.['3']?.deck?.length ?? 0,
    };
}

async function expectSmashUpFactionDraftSummary(
    page: Page,
    matchId: string,
    expected: Partial<Awaited<ReturnType<typeof readSmashUpFactionDraftSummary>>>,
    message: string,
) {
    await expect.poll(async () => {
        const summary = await readSmashUpFactionDraftSummary(page, matchId);
        return Object.fromEntries(
            Object.keys(expected).map((key) => [
                key,
                summary[key as keyof typeof summary],
            ]),
        );
    }, {
        timeout: 15_000,
        message,
    }).toEqual(expected);
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

    test('大厅 UI 创建 4 人 3 AI 房间后，自动选派系不应只给 AI 选到一个派系就进局', async ({ browser, baseURL }) => {
        test.setTimeout(120_000);

        const context = await browser.newContext({ baseURL });
        await initContext(context, {
            storageKey: '__smashup_four_player_ai_faction_completion_ui_path',
            skipImageGate: true,
        });

        const page = await context.newPage();
        const diagnostics = attachPageDiagnostics(page);

        test.skip(!(await ensureGameServerAvailable(page)), '游戏服务器不可用');
        await ensureLobbyReady(page);

        await openSmashupCreateRoomModal(page);
        const createRoomModal = page.getByTestId('create-room-modal').last();

        await page.getByRole('button', { name: '4人' }).click();
        await page.getByRole('button', { name: '加入 AI' }).click();
        await expect(page.getByText('已开启')).toBeVisible();
        await page.getByRole('button', { name: '3 号位' }).click();
        await page.getByRole('button', { name: '4 号位' }).click();

        await createRoomModal.getByTestId('create-room-confirm-button').click();
        await expect(page).toHaveURL(/\/play\/smashup\/match\/[^?]+\?playerID=0/, { timeout: 15_000 });

        const matchId = page.url().match(/\/play\/smashup\/match\/([^?]+)/)?.[1];
        expect(matchId).toBeTruthy();
        if (!matchId) {
            throw new Error('未能从 URL 提取 matchId');
        }

        await waitForTestHarness(page, 20_000);
        await expect(page.getByText('选择你的派系')).toBeVisible({ timeout: 15_000 });

        await selectSmashUpFactionById(page, 'aliens');

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
            const state = await getMatchState(matchId, page);
            return {
                phase: state.sys?.phase ?? null,
                currentPlayerIndex: state.core?.currentPlayerIndex ?? null,
                host: state.core?.factionSelection?.playerSelections?.['0']?.length ?? 0,
                ai1: state.core?.factionSelection?.playerSelections?.['1']?.length ?? 0,
                ai2: state.core?.factionSelection?.playerSelections?.['2']?.length ?? 0,
                ai3: state.core?.factionSelection?.playerSelections?.['3']?.length ?? 0,
            };
        }, {
            timeout: 30_000,
            message: '等待 UI 建房路径下 3 个 AI 在房主首选后完成两次选派系并把选秀权交还房主',
        }).toEqual({
            phase: 'factionSelect',
            currentPlayerIndex: 0,
            host: 1,
            ai1: 2,
            ai2: 2,
            ai3: 2,
        });

        const evidenceDir = join(
            process.cwd(),
            'test-results',
            'evidence-screenshots',
            '_shared',
            'smashup-four-player-ai-faction-completion-ui-path',
        );
        mkdirSync(evidenceDir, { recursive: true });
        await page.screenshot({
            path: join(evidenceDir, 'smashup-four-player-ai-before-host-final-pick.png'),
            fullPage: false,
            timeout: 5_000,
        });

        await selectSmashUpFactionById(page, 'pirates');

        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return {
                phase: state.sys?.phase ?? null,
                factionSelection: state.core?.factionSelection ?? null,
                hostFactions: state.core?.players?.['0']?.factions?.filter(Boolean).length ?? 0,
                ai1Factions: state.core?.players?.['1']?.factions?.filter(Boolean).length ?? 0,
                ai2Factions: state.core?.players?.['2']?.factions?.filter(Boolean).length ?? 0,
                ai3Factions: state.core?.players?.['3']?.factions?.filter(Boolean).length ?? 0,
                hostDeck: state.core?.players?.['0']?.deck?.length ?? 0,
                ai1Deck: state.core?.players?.['1']?.deck?.length ?? 0,
                ai2Deck: state.core?.players?.['2']?.deck?.length ?? 0,
                ai3Deck: state.core?.players?.['3']?.deck?.length ?? 0,
            };
        }, {
            timeout: 30_000,
            message: '等待 UI 建房路径下四人自动选派系完成并进入 playCards',
        }).toEqual({
            phase: 'playCards',
            factionSelection: null,
            hostFactions: 2,
            ai1Factions: 2,
            ai2Factions: 2,
            ai3Factions: 2,
            hostDeck: 35,
            ai1Deck: 35,
            ai2Deck: 35,
            ai3Deck: 35,
        });

        assertNoFatalFrontendErrors([{ label: 'ui-host-faction-completion', diagnostics }]);

        await page.screenshot({
            path: join(evidenceDir, 'smashup-four-player-ai-faction-completion-ui-path.png'),
            fullPage: false,
            timeout: 5_000,
        });

        await context.close();
    });

    test('大厅 UI 创建 4 人 3 AI 并手动给 AI 选派系应走完整个蛇形选秀', async ({ browser, baseURL }) => {
        test.setTimeout(180_000);

        const context = await browser.newContext({ baseURL });
        await initContext(context, {
            storageKey: '__smashup_four_player_manual_ai_faction_ui_path',
        });

        const page = await context.newPage();
        const diagnostics = attachPageDiagnostics(page);

        test.skip(!(await ensureGameServerAvailable(page)), '游戏服务器不可用');
        await ensureLobbyReady(page);

        await openSmashupCreateRoomModal(page);
        const createRoomModal = page.getByTestId('create-room-modal').last();

        await page.getByRole('button', { name: '4人' }).click();
        await page.getByRole('button', { name: '加入 AI' }).click();
        await expect(page.getByText('已开启')).toBeVisible();
        await page.getByRole('button', { name: '3 号位' }).click();
        await page.getByRole('button', { name: '4 号位' }).click();
        await page.getByTestId('create-room-ai-manual-faction-checkbox').check();
        await expect(page.getByTestId('create-room-ai-manual-faction-checkbox')).toBeChecked();

        await createRoomModal.getByTestId('create-room-confirm-button').click();
        await expect(page).toHaveURL(/\/play\/smashup\/match\/[^?]+\?playerID=0/, { timeout: 30_000 });

        const matchId = page.url().match(/\/play\/smashup\/match\/([^?]+)/)?.[1];
        expect(matchId).toBeTruthy();
        if (!matchId) {
            throw new Error('未能从 URL 提取 matchId');
        }

        await waitForTestHarness(page, 30_000);
        await expect(page.getByText('选择你的派系')).toBeVisible({ timeout: 45_000 });
        await expect.poll(async () => page.evaluate((targetMatchId) => {
            const raw = localStorage.getItem(`match_ai_creds_${targetMatchId}`);
            if (!raw) return [];
            try {
                return Object.keys(JSON.parse(raw)).sort();
            } catch {
                return ['parse-error'];
            }
        }, matchId), {
            timeout: 20_000,
            message: '手动选派系房间的 AI 座位凭据应补齐到 1/2/3 号位',
        }).toEqual(['1', '2', '3']);

        const evidenceDir = join(
            process.cwd(),
            'test-results',
            'evidence-screenshots',
            '_shared',
            'smashup-manual-ai-faction-ui-path',
        );
        mkdirSync(evidenceDir, { recursive: true });

        const draftSequence = [
            ['aliens', { phase: 'factionSelect', currentPlayerIndex: 1, host: 1, ai1: 0, ai2: 0, ai3: 0 }],
            ['ninjas', { phase: 'factionSelect', currentPlayerIndex: 2, host: 1, ai1: 1, ai2: 0, ai3: 0 }],
            ['robots', { phase: 'factionSelect', currentPlayerIndex: 3, host: 1, ai1: 1, ai2: 1, ai3: 0 }],
            ['wizards', { phase: 'factionSelect', currentPlayerIndex: 3, host: 1, ai1: 1, ai2: 1, ai3: 1 }],
            ['tricksters', { phase: 'factionSelect', currentPlayerIndex: 2, host: 1, ai1: 1, ai2: 1, ai3: 2 }],
            ['zombies', { phase: 'factionSelect', currentPlayerIndex: 1, host: 1, ai1: 1, ai2: 2, ai3: 2 }],
            ['dinosaurs', { phase: 'factionSelect', currentPlayerIndex: 0, host: 1, ai1: 2, ai2: 2, ai3: 2 }],
        ] as const;

        for (const [index, [factionId, expected]] of draftSequence.entries()) {
            await selectSmashUpFactionById(page, factionId);
            await expectSmashUpFactionDraftSummary(
                page,
                matchId,
                expected,
                `第 ${index + 1} 次手动选派系后权威状态应推进`,
            );
            if (factionId === 'robots') {
                await page.screenshot({
                    path: join(evidenceDir, 'smashup-manual-ai-after-third-pick.png'),
                    fullPage: false,
                    timeout: 5_000,
                });
            }
        }

        await selectSmashUpFactionById(page, 'pirates');
        await expectSmashUpFactionDraftSummary(page, matchId, {
            phase: 'playCards',
            hostFactions: 2,
            ai1Factions: 2,
            ai2Factions: 2,
            ai3Factions: 2,
            hostDeck: 35,
            ai1Deck: 35,
            ai2Deck: 35,
            ai3Deck: 35,
        }, '8 次手动选派系后应进入 playCards，四个玩家都应有完整派系和牌库');

        assertNoFatalFrontendErrors([{ label: 'manual-ai-faction-ui-path', diagnostics }]);

        await page.screenshot({
            path: join(evidenceDir, 'smashup-manual-ai-faction-ui-path-final.png'),
            fullPage: false,
            timeout: 5_000,
        });

        await context.close();
    });
});
