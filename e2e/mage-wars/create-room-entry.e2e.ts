import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from '../framework';
import {
    clearEvidenceScreenshotsForTest,
    getEvidenceScreenshotPath,
    withJpegEvidenceScreenshotOptions,
} from '../framework/evidenceScreenshots';
import {
    ensureGameServerAvailable,
    getGameServerBaseURL,
    initContext,
    waitForFrontendAssets,
    waitForHomeGameList,
} from '../helpers/common';

type CreateMatchRequestBody = {
    numPlayers?: number;
    setupData?: Record<string, unknown>;
};

type MatchDetailPayload = {
    setupData?: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

async function waitForVisibleImages(page: Page) {
    await page.waitForFunction(() => Array.from(document.images)
        .filter((image) => {
            const rect = image.getBoundingClientRect();
            return rect.width > 10 && rect.height > 10;
        })
        .every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0), undefined, {
        timeout: 5_000,
    }).catch(() => undefined);
}

async function saveEntryScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<string> {
    await waitForVisibleImages(page);
    const path = getEvidenceScreenshotPath(testInfo, name, { requireChineseName: true });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot(withJpegEvidenceScreenshotOptions({
        path,
        fullPage: false,
        animations: 'disabled',
        timeout: 20_000,
    }));
    testInfo.annotations.push({
        type: 'evidence-screenshot',
        description: path,
    });
    return path;
}

test('Mage Wars 大厅创建房间会先选择法师法术书再进入正式牌桌', async ({ context, page }, testInfo) => {
    test.setTimeout(120_000);
    await clearEvidenceScreenshotsForTest(testInfo);
    await page.setViewportSize({ width: 1600, height: 900 });

    await initContext(context, {
        storageKey: 'mage-wars-create-room-entry-e2e',
        skipImageGate: true,
        blockCdnAssets: false,
        locale: 'zh-CN',
    });

    expect(await ensureGameServerAvailable(page)).toBe(true);

    const createBodies: CreateMatchRequestBody[] = [];
    page.on('request', (request) => {
        if (request.method() !== 'POST' || !request.url().includes('/games/mage-wars/create')) {
            return;
        }
        try {
            createBodies.push(request.postDataJSON() as CreateMatchRequestBody);
        } catch {
            createBodies.push({});
        }
    });

    await page.goto('/?game=mage-wars&homeStyle=classic', { waitUntil: 'domcontentloaded' });
    await waitForFrontendAssets(page, 45_000);
    await waitForHomeGameList(page, 45_000);

    const detailsModal = page.locator('[data-testid="game-details-modal-root"]:visible').last();
    await expect(detailsModal).toBeVisible({ timeout: 30_000 });
    await expect(detailsModal.getByTestId('game-details-open-create-room')).toBeVisible({ timeout: 15_000 });
    await saveEntryScreenshot(page, testInfo, '01-大厅详情页显示创建房间入口');

    await detailsModal.getByTestId('game-details-open-create-room').click();
    const createRoomModal = page.getByTestId('create-room-modal').last();
    await expect(createRoomModal).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('setup-option-select-mageWarsSeat0MageId')).toHaveCount(0);
    await expect(page.getByTestId('setup-option-select-mageWarsSeat1MageId')).toHaveCount(0);
    await createRoomModal.getByTestId('create-room-name-input').fill('Mage Wars E2E 建房入局');
    await saveEntryScreenshot(page, testInfo, '02-通用建房弹窗不显示法师选择');

    await createRoomModal.getByTestId('create-room-confirm-button').click();
    await expect(page.getByTestId('create-room-setup-gate-overlay')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('mage-wars-mage-selection-gate')).toBeVisible({ timeout: 30_000 });
    await expect(createRoomModal).toHaveCount(0);
    await saveEntryScreenshot(page, testInfo, '03-确认建房后进入法师法术书选择页');

    await page.getByTestId('mage-wars-mage-selection-standard-spellbook-beastmaster_apprentice').click();
    await expect(page.getByTestId('mage-wars-mage-selection-summary-0'))
        .toHaveAttribute('data-mage-id', 'beastmaster_apprentice');

    await page.getByTestId('mage-wars-mage-selection-seat-1').click();
    await page.getByTestId('mage-wars-mage-selection-standard-spellbook-priestess_apprentice').click();
    await expect(page.getByTestId('mage-wars-mage-selection-summary-1'))
        .toHaveAttribute('data-mage-id', 'priestess_apprentice');
    await saveEntryScreenshot(page, testInfo, '04-选择兽王和女祭司后等待确认');

    const createResponsePromise = page.waitForResponse((response) => (
        response.request().method() === 'POST'
        && response.url().includes('/games/mage-wars/create')
        && response.ok()
    ), { timeout: 45_000 });
    await page.getByTestId('mage-wars-mage-selection-confirm').click();
    const createResponse = await createResponsePromise;
    const createResult = await createResponse.json() as { matchID?: string };
    expect(typeof createResult.matchID).toBe('string');
    const matchID = createResult.matchID as string;

    await expect(page).toHaveURL(/\/play\/mage-wars\/match\/[^/?]+\?playerID=0/, { timeout: 45_000 });
    await expect(page.getByTestId('mage-wars-board')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-testid="mage-wars-zone-mage-entity"][data-player-id="0"]'))
        .toHaveAttribute('data-mage-id', 'beastmaster_apprentice', { timeout: 15_000 });
    await expect(page.locator('[data-testid="mage-wars-zone-mage-entity"][data-player-id="1"]'))
        .toHaveAttribute('data-mage-id', 'priestess_apprentice', { timeout: 15_000 });
    await saveEntryScreenshot(page, testInfo, '05-正式房间进入牌桌并显示所选法师');

    expect(createBodies).toHaveLength(1);
    const postedSetupData = asRecord(createBodies[0]?.setupData);
    expect(postedSetupData.mageWarsSeat0MageId).toBe('beastmaster_apprentice');
    expect(postedSetupData.mageWarsSeat1MageId).toBe('priestess_apprentice');
    expect(postedSetupData.roomName).toBe('Mage Wars E2E 建房入局');
    expect(Array.isArray(postedSetupData.mageWarsSeat0SpellbookEntries)).toBe(true);
    expect(Array.isArray(postedSetupData.mageWarsSeat1SpellbookEntries)).toBe(true);

    const matchResponse = await page.request.get(`${getGameServerBaseURL()}/games/mage-wars/${matchID}`);
    expect(matchResponse.ok()).toBe(true);
    const matchDetail = await matchResponse.json() as MatchDetailPayload;
    const persistedSetupData = asRecord(matchDetail.setupData);
    expect(persistedSetupData.mageWarsSeat0MageId).toBe('beastmaster_apprentice');
    expect(persistedSetupData.mageWarsSeat1MageId).toBe('priestess_apprentice');
    expect(persistedSetupData.roomName).toBe('Mage Wars E2E 建房入局');
});
