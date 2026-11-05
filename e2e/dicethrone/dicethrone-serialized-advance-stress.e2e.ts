import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    waitForTestHarness,
} from '../helpers/common';
import {
    setupDTOnlineMatch,
} from '../helpers/dicethrone';
import { getMatchState } from '../helpers/state-injection';

type PhaseSnapshot = {
    phase: string | null;
    activePlayerId: string | null;
    turnNumber: number | null;
    stateID?: number | null;
    lastCommandFailureReason?: string | null;
    commandQueueLength?: number | null;
};

type UndoSnapshot = {
    snapshotCount: number;
    pendingRequesterId: string | null;
};

type SyncToastProbe = {
    seen: boolean;
    texts: string[];
};

async function readPhaseSnapshot(page: Page): Promise<PhaseSnapshot> {
    await waitForTestHarness(page, 15000);
    return page.evaluate(() => {
        const state = (window as Window).__BG_TEST_HARNESS__?.state.get() as any;
        return {
            phase: state?.sys?.phase ?? state?.core?.phase ?? null,
            activePlayerId: state?.core?.activePlayerId ?? null,
            turnNumber: typeof state?.core?.turnNumber === 'number'
                ? state.core.turnNumber
                : null,
        };
    });
}


async function readServerPhaseSnapshot(matchId: string, page: Page): Promise<PhaseSnapshot> {
    const state = await getMatchState(matchId, page) as any;
    const root = state?.G ?? state;
    return {
        phase: root?.sys?.phase ?? root?.core?.phase ?? null,
        activePlayerId: root?.core?.activePlayerId ?? null,
        turnNumber: typeof root?.core?.turnNumber === 'number'
            ? root.core.turnNumber
            : null,
        stateID: typeof state?._stateID === 'number' ? state._stateID : null,
        lastCommandFailureReason: typeof state?.lastCommandFailureReason === 'string'
            ? state.lastCommandFailureReason
            : null,
        commandQueueLength: Array.isArray(state?.commandQueue) ? state.commandQueue.length : null,
    };
}

async function readUndoSnapshot(page: Page): Promise<UndoSnapshot> {
    await waitForTestHarness(page, 15000);
    return page.evaluate(() => {
        const state = (window as Window).__BG_TEST_HARNESS__?.state.get() as any;
        const undo = state?.sys?.undo;
        const snapshotCount = typeof undo?.snapshotCount === 'number'
            ? undo.snapshotCount
            : Array.isArray(undo?.snapshots)
                ? undo.snapshots.length
                : 0;
        return {
            snapshotCount,
            pendingRequesterId: undo?.pendingRequest?.requesterId != null
                ? String(undo.pendingRequest.requesterId)
                : null,
        };
    });
}

async function installSyncToastProbe(page: Page): Promise<void> {
    await page.evaluate(() => {
        type ProbeState = {
            seen: boolean;
            texts: string[];
            observer?: MutationObserver;
        };
        const targetTexts = [
            '正在同步上一步操作，请稍等。',
            '正在同步上一步操作，下一步已排队。',
        ];
        const win = window as Window & {
            __DT_SYNC_TOAST_PROBE__?: ProbeState;
        };
        win.__DT_SYNC_TOAST_PROBE__?.observer?.disconnect();
        const probe: ProbeState = { seen: false, texts: [] };
        const scan = () => {
            const bodyText = document.body?.innerText ?? '';
            for (const text of targetTexts) {
                if (bodyText.includes(text) && !probe.texts.includes(text)) {
                    probe.seen = true;
                    probe.texts.push(text);
                }
            }
        };
        probe.observer = new MutationObserver(scan);
        probe.observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
        });
        scan();
        win.__DT_SYNC_TOAST_PROBE__ = probe;
    });
}

async function readSyncToastProbe(page: Page): Promise<SyncToastProbe> {
    return page.evaluate(() => {
        const probe = (window as Window & {
            __DT_SYNC_TOAST_PROBE__?: {
                seen?: boolean;
                texts?: string[];
            };
        }).__DT_SYNC_TOAST_PROBE__;
        return {
            seen: probe?.seen === true,
            texts: Array.isArray(probe?.texts) ? probe.texts : [],
        };
    });
}

async function clickAdvanceThenRequestUndoThroughHud(page: Page): Promise<{
    stage: string;
    advanceFound: boolean;
    undoFound: boolean;
    requestFound: boolean;
    initialAdvanceDisabled: boolean | null;
    bodyExcerpt: string;
}> {
    return page.evaluate(async () => {
        const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
        const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
        const isVisible = (element: Element | null): element is HTMLElement => {
            if (!(element instanceof HTMLElement)) return false;
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0
                && rect.height > 0
                && style.visibility !== 'hidden'
                && style.display !== 'none'
                && style.opacity !== '0';
        };
        const waitFor = async <T,>(resolveValue: () => T | null, timeoutMs: number): Promise<T | null> => {
            const deadline = Date.now() + timeoutMs;
            while (Date.now() < deadline) {
                const value = resolveValue();
                if (value) return value;
                await sleep(50);
            }
            return null;
        };
        const visibleButtonByFabId = (id: string) => (
            Array.from(document.querySelectorAll(`button[data-fab-id="${id}"]`))
                .find(isVisible) ?? null
        ) as HTMLButtonElement | null;
        const bodyExcerpt = () => (document.body?.innerText ?? '').slice(0, 1200);

        const advanceButton = document.querySelector('[data-tutorial-id="advance-phase-button"]') as HTMLButtonElement | null;
        if (!advanceButton) {
            return {
                stage: 'advance-missing',
                advanceFound: false,
                undoFound: false,
                requestFound: false,
                initialAdvanceDisabled: null,
                bodyExcerpt: bodyExcerpt(),
            };
        }

        const initialAdvanceDisabled = advanceButton.disabled;
        advanceButton.click();
        await nextFrame();

        const fabMenu = document.querySelector('[data-testid="fab-menu"]');
        const visibleFabButton = Array.from(fabMenu?.querySelectorAll('button[data-fab-id]') ?? [])
            .find(isVisible) as HTMLButtonElement | undefined;
        visibleFabButton?.click();
        await nextFrame();

        const undoButton = await waitFor(() => visibleButtonByFabId('undo-request'), 3000);
        if (!undoButton) {
            return {
                stage: 'undo-missing',
                advanceFound: true,
                undoFound: false,
                requestFound: false,
                initialAdvanceDisabled,
                bodyExcerpt: bodyExcerpt(),
            };
        }

        undoButton.click();
        await nextFrame();

        const requestButton = await waitFor(() => (
            Array.from(document.querySelectorAll('button')).find((button) => (
                isVisible(button)
                && /申请撤回|请求撤回|Request Undo/i.test(button.textContent ?? '')
            )) as HTMLButtonElement | undefined ?? null
        ), 3000);

        if (!requestButton) {
            return {
                stage: 'request-missing',
                advanceFound: true,
                undoFound: true,
                requestFound: false,
                initialAdvanceDisabled,
                bodyExcerpt: bodyExcerpt(),
            };
        }

        requestButton.click();
        return {
            stage: 'request-clicked',
            advanceFound: true,
            undoFound: true,
            requestFound: true,
            initialAdvanceDisabled,
            bodyExcerpt: bodyExcerpt(),
        };
    });
}

test.describe('DiceThrone 在线阶段推进连续操作', () => {
    test('快速连点阶段推进只排队一个下一步且不产生陈旧状态拒绝', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupDTOnlineMatch(browser, baseURL, 'monk', 'barbarian');

        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }

        const { hostPage, guestPage, hostContext, guestContext } = setup;
        const hostDiagnostics = attachPageDiagnostics(hostPage);
        const guestDiagnostics = attachPageDiagnostics(guestPage);
        const transportWarnings: string[] = [];
        const collectTransportWarning = (pageLabel: string) => (message: ConsoleMessage) => {
            if (message.type() !== 'warning' && message.type() !== 'error') return;
            const text = message.text();
            if (/stale_state|expectedStateID|command rejected|命令.*拒绝/i.test(text)) {
                transportWarnings.push(`[${pageLabel}] ${text}`);
            }
        };
        hostPage.on('console', collectTransportWarning('host'));
        guestPage.on('console', collectTransportWarning('guest'));

        try {
            await expect.poll(async () => (await readPhaseSnapshot(hostPage)).phase, {
                timeout: 15000,
                message: '等待开局进入玩家 0 的第一主要阶段',
            }).toBe('main1');

            const advanceButton = hostPage.locator('[data-tutorial-id="advance-phase-button"]').first();
            await expect(advanceButton).toBeVisible({ timeout: 10000 });
            await expect(advanceButton).toBeEnabled({ timeout: 10000 });

            const burstResult = await hostPage.evaluate(() => {
                const button = document.querySelector('[data-tutorial-id="advance-phase-button"]') as HTMLButtonElement | null;
                if (!button) {
                    return { found: false, initialDisabled: null };
                }
                const initialDisabled = button.disabled;
                for (let index = 0; index < 20; index += 1) {
                    button.click();
                }
                return { found: true, initialDisabled };
            });

            expect(burstResult).toEqual({ found: true, initialDisabled: false });
            await expect(hostPage.getByText('正在同步上一步操作，下一步已排队。')).toBeVisible({ timeout: 5000 });

            try {
                await expect.poll(async () => (await readPhaseSnapshot(hostPage)).phase, {
                    timeout: 20000,
                    message: '等待排队的下一步在权威状态确认后发出',
                }).toBe('main2');
            } catch (error) {
                const clientSnapshot = await readPhaseSnapshot(hostPage).catch((snapshotError) => ({
                    phase: `read-client-failed:${snapshotError instanceof Error ? snapshotError.message : String(snapshotError)}`,
                    activePlayerId: null,
                    turnNumber: null,
                }));
                const serverSnapshot = await readServerPhaseSnapshot(setup.matchId, hostPage).catch((snapshotError) => ({
                    phase: `read-server-failed:${snapshotError instanceof Error ? snapshotError.message : String(snapshotError)}`,
                    activePlayerId: null,
                    turnNumber: null,
                }));
                throw new Error([
                    error instanceof Error ? error.message : String(error),
                    `client=${JSON.stringify(clientSnapshot)}`,
                    `server=${JSON.stringify(serverSnapshot)}`,
                    `transportWarnings=${JSON.stringify(transportWarnings)}`,
                ].join('\n'));
            }

            await hostPage.waitForTimeout(1500);
            const finalSnapshot = await readPhaseSnapshot(hostPage);
            expect(finalSnapshot).toMatchObject({
                phase: 'main2',
                activePlayerId: '0',
                turnNumber: 1,
            });
            expect(transportWarnings).toEqual([]);
            await assertNoFatalFrontendErrors([
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);
        } finally {
            await guestContext.close();
            await hostContext.close();
        }
    });

    test('阶段推进还在同步时可以通过 HUD 申请撤回且不提示下一步排队', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupDTOnlineMatch(browser, baseURL, 'monk', 'barbarian');

        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }

        const { hostPage, guestPage, hostContext, guestContext } = setup;
        const hostDiagnostics = attachPageDiagnostics(hostPage);
        const guestDiagnostics = attachPageDiagnostics(guestPage);
        const transportWarnings: string[] = [];
        const collectTransportWarning = (pageLabel: string) => (message: ConsoleMessage) => {
            if (message.type() !== 'warning' && message.type() !== 'error') return;
            const text = message.text();
            if (/stale_state|expectedStateID|command rejected|命令.*拒绝/i.test(text)) {
                transportWarnings.push(`[${pageLabel}] ${text}`);
            }
        };
        hostPage.on('console', collectTransportWarning('host'));
        guestPage.on('console', collectTransportWarning('guest'));

        try {
            await expect.poll(async () => (await readPhaseSnapshot(hostPage)).phase, {
                timeout: 15000,
                message: '等待开局进入玩家 0 的第一主要阶段',
            }).toBe('main1');

            const advanceButton = hostPage.locator('[data-tutorial-id="advance-phase-button"]').first();
            await expect(advanceButton).toBeVisible({ timeout: 10000 });
            await expect(advanceButton).toBeEnabled({ timeout: 10000 });
            await installSyncToastProbe(hostPage);

            const requestResult = await clickAdvanceThenRequestUndoThroughHud(hostPage);
            expect(requestResult).toMatchObject({
                stage: 'request-clicked',
                advanceFound: true,
                undoFound: true,
                requestFound: true,
                initialAdvanceDisabled: false,
            });

            await expect.poll(async () => (await readUndoSnapshot(hostPage)).pendingRequesterId, {
                timeout: 20000,
                message: '等待当前玩家的撤回申请写入联机状态',
            }).toBe('0');
            await expect.poll(async () => (await readUndoSnapshot(guestPage)).pendingRequesterId, {
                timeout: 10000,
                message: '等待对手视角收到撤回审批请求',
            }).toBe('0');

            await expect(hostPage.getByText('等待对方批准…').first()).toBeVisible({ timeout: 10000 });
            await hostPage.waitForTimeout(1000);
            expect(await readSyncToastProbe(hostPage)).toEqual({
                seen: false,
                texts: [],
            });
            expect(transportWarnings).toEqual([]);
            await assertNoFatalFrontendErrors([
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);
        } finally {
            await guestContext.close();
            await hostContext.close();
        }
    });
});
