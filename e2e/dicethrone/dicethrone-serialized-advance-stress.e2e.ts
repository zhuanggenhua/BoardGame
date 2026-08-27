import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    waitForTestHarness,
} from '../helpers/common';
import {
    setupDTOnlineMatch,
} from '../helpers/dicethrone';

type PhaseSnapshot = {
    phase: string | null;
    activePlayerId: string | null;
    turnNumber: number | null;
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

            await expect.poll(async () => (await readPhaseSnapshot(hostPage)).phase, {
                timeout: 20000,
                message: '等待排队的下一步在权威状态确认后发出',
            }).toBe('main2');

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
});
