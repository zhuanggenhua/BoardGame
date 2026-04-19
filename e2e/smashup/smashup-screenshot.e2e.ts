/**
 * Smash Up 手牌截图 E2E 测试
 */

import { test, expect } from '@playwright/test';
import { initContext, ensureGameServerAvailable } from '../helpers/common';
import {
    joinMatchViaAPI,
    seedMatchCredentials,
    createMatchViaAPI,
    waitForFactionSelection,
    selectFactionByIndex,
} from './smashup-helpers';

test.describe('Smash Up 手牌截图', () => {
    test('进入对局后截取手牌区', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        // Host
        const hostContext = await browser.newContext({ baseURL });
        await initContext(hostContext, { storageKey: '__smashup_storage_reset' });
        const hostPage = await hostContext.newPage();

        hostPage.on('console', (msg) => {
            if (msg.type() === 'error') console.log('[PAGE ERROR]', msg.text());
        });
        hostPage.on('pageerror', (err) => console.log('[PAGE EXCEPTION]', err.message));

        if (!(await ensureGameServerAvailable(hostPage))) {
            test.skip(true, 'Game server unavailable');
        }

        await hostPage.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});

        const hostGuestId = `e2e_host_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const matchId = await createMatchViaAPI(hostPage, hostGuestId);
        if (!matchId) { test.skip(true, 'Room creation failed'); return; }

        const hostCredentials = await joinMatchViaAPI(hostPage, matchId, '0', `Host-${Date.now()}`, hostGuestId);
        if (!hostCredentials) { test.skip(true, 'Host 加入失败'); return; }
        await seedMatchCredentials(hostContext, matchId, '0', hostCredentials);
        await hostPage.goto(`/play/smashup/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
        await waitForFactionSelection(hostPage);

        // Guest
        const guestContext = await browser.newContext({ baseURL });
        await initContext(guestContext, { storageKey: '__smashup_storage_reset' });
        const guestPage = await guestContext.newPage();

        const guestGuestId = `e2e_guest_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const guestCredentials = await joinMatchViaAPI(hostPage, matchId, '1', `Guest-${Date.now()}`, guestGuestId);
        if (!guestCredentials) { test.skip(true, 'Guest 加入失败'); return; }
        await seedMatchCredentials(guestContext, matchId, '1', guestCredentials);
        await guestPage.goto(`/play/smashup/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });
        await waitForFactionSelection(guestPage);

        // 蛇形选秀，保持原本派系归属：P0 = 0 + 3，P1 = 1 + 2
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
