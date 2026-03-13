/**
 * 大杀四方 - 阶段切换与行动卡特写回归
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from './framework';
import { getEvidenceScreenshotPath } from './framework/evidenceScreenshots';
import { waitForSmashUpUI } from './helpers/smashup';
import { setupSmashUpMatchSkipSetup } from './helpers/smashup-skip-setup';
import { getMatchState, injectMatchState } from './helpers/state-injection';

async function saveEvidenceScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
    const path = getEvidenceScreenshotPath(testInfo, name);
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: true });
}

async function applyOnlineMatchState(
    matchId: string,
    page: Page,
    updater: (state: any) => any,
): Promise<void> {
    const currentState = await getMatchState(matchId, page);
    const nextState = updater(currentState);
    await injectMatchState(matchId, nextState, page);
    await page.waitForTimeout(800);
}

async function waitForTurnTracker(page: Page, side: 'YOU' | 'OPP'): Promise<void> {
    await expect(
        page.locator('[data-tutorial-id="su-turn-tracker"]').filter({ hasText: new RegExp(side, 'i') }),
    ).toBeVisible({ timeout: 8000 });
}

async function getPlayerActionUid(page: Page, playerId: '0' | '1', defId: string): Promise<string | null> {
    return page.evaluate(({ currentPlayerId, targetDefId }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        const hand = state?.core?.players?.[currentPlayerId]?.hand ?? [];
        return hand.find((card: any) => card.defId === targetDefId)?.uid ?? null;
    }, { currentPlayerId: playerId, targetDefId: defId });
}

const makeSmashUpCard = (uid: string, defId: string, type: 'action' | 'minion', owner: '0' | '1') => ({
    uid,
    defId,
    type,
    owner,
});

function buildActionSpotlightState(baseState: any, currentPlayerIndex: 0 | 1) {
    const nextState = JSON.parse(JSON.stringify(baseState));

    nextState.core.currentPlayerIndex = currentPlayerIndex;
    nextState.core.phase = 'playCards';
    nextState.core.factionSelection = undefined;
    nextState.core.players['0'] = {
        ...nextState.core.players['0'],
        hand: [makeSmashUpCard('p0-action-1', 'wizard_mystic_studies', 'action', '0')],
        deck: [
            makeSmashUpCard('p0-deck-1', 'wizard_neophyte', 'minion', '0'),
            makeSmashUpCard('p0-deck-2', 'wizard_apprentice', 'minion', '0'),
        ],
        discard: [],
        actionsPlayed: 0,
        actionLimit: 1,
        minionsPlayed: 0,
        minionLimit: 1,
        minionsPlayedPerBase: {},
        sameNameMinionDefId: null,
        factions: ['wizards', 'steampunks'],
    };
    nextState.core.players['1'] = {
        ...nextState.core.players['1'],
        hand: [makeSmashUpCard('p1-action-1', 'wizard_mystic_studies', 'action', '1')],
        deck: [
            makeSmashUpCard('p1-deck-1', 'wizard_chronomage', 'minion', '1'),
            makeSmashUpCard('p1-deck-2', 'wizard_archmage', 'minion', '1'),
        ],
        discard: [],
        actionsPlayed: 0,
        actionLimit: 1,
        minionsPlayed: 0,
        minionLimit: 1,
        minionsPlayedPerBase: {},
        sameNameMinionDefId: null,
        factions: ['wizards', 'steampunks'],
    };

    nextState.sys = {
        ...nextState.sys,
        turnOrder: Array.isArray(nextState.core.turnOrder) ? [...nextState.core.turnOrder] : nextState.sys.turnOrder,
        currentPlayerIndex,
        phase: 'playCards',
        interaction: nextState.sys.interaction
            ? { ...nextState.sys.interaction, current: undefined, queue: [], isBlocked: false }
            : nextState.sys.interaction,
        responseWindow: nextState.sys.responseWindow
            ? { ...nextState.sys.responseWindow, current: undefined }
            : nextState.sys.responseWindow,
        eventStream: nextState.sys.eventStream
            ? { ...nextState.sys.eventStream, entries: [], nextId: 1 }
            : nextState.sys.eventStream,
    };

    return nextState;
}

test('简单阶段转换 - 点击结束回合', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);

    await page.goto('/play/smashup');
    await page.waitForFunction(
        () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
        { timeout: 15000 },
    );

    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: [{ uid: 'card-1', defId: 'wizard_portal', type: 'action' }],
        },
        player1: {},
        bases: [{ breakpoint: 25, power: 0 }],
        currentPlayer: '0',
        phase: 'playCards',
    });

    await page.waitForTimeout(2000);
    await game.screenshot('01-initial-state', testInfo);

    const initialPhase = await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        return harness.state.get().sys.phase;
    });
    console.log('[TEST] 初始阶段:', initialPhase);

    await game.advancePhase();

    await game.screenshot('02-after-finish-turn', testInfo);

    await expect.poll(async () => {
        const state = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.get();
        });
        return {
            phase: state.sys.phase,
            currentPlayerIndex: state.core.currentPlayerIndex,
        };
    }, { timeout: 10000 }).toEqual({
        phase: 'playCards',
        currentPlayerIndex: 1,
    });
});

test('在线模式对手打出行动卡时应显示特写', async ({ browser }, testInfo) => {
    test.setTimeout(120000);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const firstSetup = await setupSmashUpMatchSkipSetup(browser, baseURL);
    if (!firstSetup) {
        test.skip(true, 'SmashUp 联机房间创建失败');
        return;
    }

    try {
        const { hostPage, guestPage } = firstSetup;
        await applyOnlineMatchState(firstSetup.matchId, hostPage, (state) => buildActionSpotlightState(state, 0));
        await waitForSmashUpUI(hostPage);
        await waitForSmashUpUI(guestPage);
        await waitForTurnTracker(hostPage, 'YOU');
        await waitForTurnTracker(guestPage, 'OPP');

        const guestSpotlightCard = guestPage.getByTestId('smashup-action-spotlight-card');
        const guestSpotlightQueue = guestPage.getByTestId('card-spotlight-queue');
        const hostSpotlightQueue = hostPage.getByTestId('card-spotlight-queue');

        const hostActionUid = await getPlayerActionUid(hostPage, '0', 'wizard_mystic_studies');
        expect(hostActionUid).toBeTruthy();
        await hostPage.locator(`[data-card-uid="${hostActionUid}"]`).click();
        await expect(guestSpotlightCard).toBeVisible({ timeout: 8000 });
        await expect(guestSpotlightCard).toHaveAttribute('data-card-def-id', 'wizard_mystic_studies');
        await expect(hostSpotlightQueue).toHaveCount(0);
        await saveEvidenceScreenshot(guestPage, testInfo, 'action-spotlight-online-p0');

        await guestSpotlightQueue.click({ force: true });
        await expect(guestSpotlightCard).toBeHidden({ timeout: 5000 });
    } finally {
        await firstSetup.guestContext.close();
        await firstSetup.hostContext.close();
    }

    const secondSetup = await setupSmashUpMatchSkipSetup(browser, baseURL);
    if (!secondSetup) {
        test.skip(true, 'SmashUp 联机房间创建失败（P1 场景）');
        return;
    }

    try {
        const { hostPage, guestPage } = secondSetup;
        await applyOnlineMatchState(secondSetup.matchId, hostPage, (state) => buildActionSpotlightState(state, 1));
        await waitForSmashUpUI(hostPage);
        await waitForSmashUpUI(guestPage);
        await waitForTurnTracker(hostPage, 'OPP');
        await waitForTurnTracker(guestPage, 'YOU');

        const hostSpotlightCard = hostPage.getByTestId('smashup-action-spotlight-card');
        const hostSpotlightQueue = hostPage.getByTestId('card-spotlight-queue');
        const guestSpotlightQueue = guestPage.getByTestId('card-spotlight-queue');

        const guestActionUid = await getPlayerActionUid(guestPage, '1', 'wizard_mystic_studies');
        expect(guestActionUid).toBeTruthy();
        await guestPage.locator(`[data-card-uid="${guestActionUid}"]`).click();
        await expect(hostSpotlightCard).toBeVisible({ timeout: 8000 });
        await expect(hostSpotlightCard).toHaveAttribute('data-card-def-id', 'wizard_mystic_studies');
        await expect(guestSpotlightQueue).toHaveCount(0);
        await saveEvidenceScreenshot(hostPage, testInfo, 'action-spotlight-online-p1');

        await hostSpotlightQueue.click({ force: true });
        await expect(hostSpotlightCard).toBeHidden({ timeout: 5000 });
    } finally {
        await secondSetup.guestContext.close();
        await secondSetup.hostContext.close();
    }
});
