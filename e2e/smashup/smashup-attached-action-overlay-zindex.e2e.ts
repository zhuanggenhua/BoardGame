import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { hideSmashUpDebugPanelForEvidence } from '../helpers/smashup';

const FOUR_PLAYER_TEST_QUERY = {
    numPlayers: 4,
    skipInitialization: true,
} as const;

function buildAttachedActionOverlayScene() {
    return {
        gameId: 'smashup',
        currentPlayer: '0',
        phase: 'playCards',
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    {
                        uid: 'host-minion',
                        defId: 'alien_invader',
                        owner: '1',
                        controller: '1',
                        powerCounters: 2,
                        attachedActions: [
                            { uid: 'host-attached-action', defId: 'trickster_hideout', ownerId: '1' },
                        ],
                    },
                    {
                        uid: 'covering-minion',
                        defId: 'pirate_first_mate',
                        owner: '2',
                        controller: '2',
                    },
                ],
            },
            { defId: 'base_the_jungle', minions: [] },
            { defId: 'base_tar_pits', minions: [] },
            { defId: 'base_the_factory', minions: [] },
            { defId: 'base_temple_of_goju', minions: [] },
        ],
        extra: {
            core: {
                turnOrder: ['0', '1', '2', '3'],
                currentPlayerIndex: 0,
                turnNumber: 7,
                nextUid: 1000,
                players: {
                    '0': {
                        id: '0',
                        vp: 5,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['robots', 'wizards'],
                    },
                    '1': {
                        id: '1',
                        vp: 7,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 1,
                        minionLimit: 1,
                        actionsPlayed: 1,
                        actionLimit: 1,
                        factions: ['aliens', 'tricksters'],
                    },
                    '2': {
                        id: '2',
                        vp: 4,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 1,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['pirates', 'dinosaurs'],
                    },
                    '3': {
                        id: '3',
                        vp: 3,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['ninjas', 'ghosts'],
                    },
                },
            },
        },
    };
}

async function moveMouseToLocatorCenter(page: Page, locator: Locator) {
    const box = await locator.boundingBox();
    if (!box) {
        throw new Error('无法获取目标元素坐标');
    }

    await page.mouse.move(box.x + 2, box.y + 2);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
}

async function injectOngoingSelectionPrompt(page: Page): Promise<void> {
    await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        if (!harness?.state?.patch) {
            throw new Error('TestHarness patch API 不可用');
        }

        harness.state.patch({
            sys: {
                phase: 'playCards',
                interaction: {
                    queue: [],
                    current: {
                        id: 'attached-overlay-zindex-evidence',
                        kind: 'simple-choice',
                        playerId: '0',
                        data: {
                            title: '选择持续行动卡',
                            sourceId: 'attached-overlay-zindex-evidence',
                            targetType: 'ongoing',
                            options: [
                                {
                                    id: 'select-host-attached-action',
                                    label: '选择藏身处',
                                    value: { cardUid: 'host-attached-action' },
                                },
                            ],
                        },
                    },
                },
            },
        });
    });
}

test.describe('大杀四方附加行动卡层级取证', () => {
    test('附加行动卡 hover 后应压在相邻其他玩家随从上层', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);

        await page.setViewportSize({ width: 1600, height: 1000 });
        await game.openTestGame('smashup', FOUR_PLAYER_TEST_QUERY, 45000);
        await game.setupScene(buildAttachedActionOverlayScene());
        await hideSmashUpDebugPanelForEvidence(page);

        const base = page.locator('[data-base-index="0"]');
        const hostMinion = page.locator('[data-minion-uid="host-minion"]');
        const targetMinion = page.locator('[data-minion-uid="covering-minion"]');
        const attachedCard = page.locator('[data-attached-action-uid="host-attached-action"]');

        await expect(base).toBeVisible({ timeout: 15000 });
        await expect(hostMinion).toBeVisible({ timeout: 15000 });
        await expect(targetMinion).toBeVisible({ timeout: 15000 });

        await injectOngoingSelectionPrompt(page);
        await expect.poll(
            async () => hostMinion.getAttribute('data-attached-actions-visible'),
            { timeout: 5000 },
        ).toBe('true');
        await expect.poll(
            async () => hostMinion.getAttribute('data-attached-overlay-visible'),
            { timeout: 5000 },
        ).toBe('true');
        await moveMouseToLocatorCenter(page, attachedCard);
        await page.waitForTimeout(250);
        await expect.poll(
            async () => hostMinion.getAttribute('data-attached-overlay-visible'),
            { timeout: 5000 },
        ).toBe('true');

        const overlapProbe = await page.evaluate(() => {
            const attached = document.querySelector('[data-attached-action-uid="host-attached-action"]') as HTMLElement | null;
            const target = document.querySelector('[data-minion-uid="covering-minion"]') as HTMLElement | null;
            if (!attached || !target) {
                return { error: 'missing-elements' };
            }

            const attachedRect = attached.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const left = Math.max(attachedRect.left, targetRect.left);
            const top = Math.max(attachedRect.top, targetRect.top);
            const right = Math.min(attachedRect.right, targetRect.right);
            const bottom = Math.min(attachedRect.bottom, targetRect.bottom);

            if (right <= left || bottom <= top) {
                return {
                    attachedRect,
                    targetRect,
                    overlap: null,
                    topAttachedUid: null,
                    topMinionUid: null,
                };
            }

            const sampleX = left + (right - left) / 2;
            const sampleY = top + (bottom - top) / 2;
            const topElement = document.elementFromPoint(sampleX, sampleY) as HTMLElement | null;

            return {
                attachedRect: {
                    left: attachedRect.left,
                    top: attachedRect.top,
                    right: attachedRect.right,
                    bottom: attachedRect.bottom,
                    width: attachedRect.width,
                    height: attachedRect.height,
                },
                targetRect: {
                    left: targetRect.left,
                    top: targetRect.top,
                    right: targetRect.right,
                    bottom: targetRect.bottom,
                    width: targetRect.width,
                    height: targetRect.height,
                },
                overlap: {
                    left,
                    top,
                    right,
                    bottom,
                    width: right - left,
                    height: bottom - top,
                    sampleX,
                    sampleY,
                },
                topAttachedUid: topElement?.closest('[data-attached-action-uid]')?.getAttribute('data-attached-action-uid') ?? null,
                topMinionUid: topElement?.closest('[data-minion-uid]')?.getAttribute('data-minion-uid') ?? null,
            };
        });

        console.log('[smashup-attached-overlay-probe]', JSON.stringify(overlapProbe));

        expect(overlapProbe).not.toHaveProperty('error');
        expect(overlapProbe.overlap, '附加行动卡需要与其他玩家随从产生真实重叠').not.toBeNull();
        expect(
            overlapProbe.topAttachedUid,
            `重叠采样点最上层应是附加行动卡，实际采样=${JSON.stringify(overlapProbe)}`,
        ).toBe('host-attached-action');

        await game.screenshot('attached-action-overlay-zindex-full-page', testInfo);

        const baseScreenshotPath = getEvidenceScreenshotPath(testInfo, 'attached-action-overlay-zindex-base', {
            filename: 'attached-action-overlay-zindex-base.png',
        });
        await mkdir(dirname(baseScreenshotPath), { recursive: true });
        await base.screenshot({ path: baseScreenshotPath });
    });
});
