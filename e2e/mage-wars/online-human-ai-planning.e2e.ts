import { expect, test } from '@playwright/test';
import { createGuestId, getGameServerBaseURL, initContext, seedMatchCredentials } from '../helpers/common';
import { getMatchState } from '../helpers/state-injection';

/** 真人计划法术，AI 必须独立计划；代表正式联机交接，不声称完整对局。 */
test('法师战争在线真人计划后 AI 自主计划并进入行动阶段', async ({ browser }, testInfo) => {
    test.setTimeout(180000);
    const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL as string | undefined });
    const guestId = createGuestId('mage-wars-human-ai');
    await initContext(context, { storageKey: '__mage_wars_human_ai_planning', skipImageGate: true, locale: 'zh-CN' });
    await context.addInitScript((id) => {
        localStorage.setItem('guest_id', id);
        sessionStorage.setItem('guest_id', id);
    }, guestId);
    const page = await context.newPage();
    const base = getGameServerBaseURL();
    try {
        const created = await page.request.post(`${base}/games/mage-wars/create`, { data: {
            numPlayers: 2,
            setupData: { guestId, ownerKey: `guest:${guestId}`, ownerType: 'guest', enableAi: true,
                seatControllers: { '1': { type: 'local-ai', minimumActionDelayMs: 0 } } },
        } });
        expect(created.ok()).toBe(true);
        const { matchID } = await created.json() as { matchID: string };
        expect(matchID).toBeTruthy();
        const claim = async (playerID: string) => {
            const response = await page.request.post(`${base}/games/mage-wars/${matchID}/claim-seat`, {
                data: { playerID, playerName: playerID === '0' ? '玩家' : 'AI 玩家', guestId },
            });
            expect(response.ok()).toBe(true);
            const result = await response.json() as { playerCredentials: string };
            expect(result.playerCredentials).toBeTruthy();
            return result.playerCredentials;
        };
        const hostCredentials = await claim('0');
        const aiCredentials = await claim('1');
        await seedMatchCredentials(context, 'mage-wars', matchID, '0', hostCredentials);
        await context.addInitScript(({ match, credentials }) => {
            localStorage.setItem(`match_ai_creds_${match}`, JSON.stringify({ '1': credentials }));
        }, { match: matchID, credentials: aiCredentials });
        await page.goto(`/play/mage-wars/match/${matchID}?playerID=0`, { waitUntil: 'domcontentloaded' });
        const board = page.getByTestId('mage-wars-board');
        await expect(board).toBeVisible({ timeout: 90000 });
        const deadline = Date.now() + 45000;
        while (Date.now() < deadline && await board.getAttribute('data-mage-wars-phase') !== 'planning') {
            const end = page.getByTestId('mage-wars-turn-end');
            if (await end.isVisible().catch(() => false) && await end.isEnabled().catch(() => false)) await end.click();
            await page.waitForTimeout(250);
        }
        await expect(board).toHaveAttribute('data-mage-wars-phase', 'planning');
        await page.getByRole('button', { name: '生物', exact: true }).click();
        const creature = page.locator('[data-testid="mage-wars-desktop-spellbook-card"]:visible').first();
        await expect(creature).toBeEnabled();
        await creature.click();
        await page.getByTestId('mage-wars-plan-spells').click();
        const aiPlanned = new Set<string>();
        await expect.poll(async () => {
            const state = await getMatchState(matchID, page);
            for (const entry of state.sys?.eventStream?.entries ?? []) {
                const event = entry.event as { type?: string; payload?: { playerId?: string } };
                if (event.type === 'MW_SPELLS_PLANNED' && event.payload?.playerId) aiPlanned.add(event.payload.playerId);
            }
            return { players: [...aiPlanned].sort(), phase: state.sys?.phase };
        }, { timeout: 60000, message: '真人和 AI 都须实际计划，随后进入行动阶段' })
            .toMatchObject({ players: ['0', '1'] });
        await expect(board).not.toHaveAttribute('data-mage-wars-phase', 'planning', { timeout: 30000 });
    } finally {
        await context.close();
    }
});
