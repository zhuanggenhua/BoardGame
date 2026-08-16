import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import {
    clearEvidenceScreenshotsForTest,
    getEvidenceScreenshotPath,
    withJpegEvidenceScreenshotOptions,
} from '../framework/evidenceScreenshots';

const MOBILE_LANDSCAPE_VIEWPORT = { width: 852, height: 393 };
const MINION_UIDS = [
    'scroll-minion-01',
    'scroll-minion-02',
    'scroll-minion-03',
    'scroll-minion-04',
    'scroll-minion-05',
    'scroll-minion-06',
    'scroll-minion-07',
    'scroll-minion-08',
];
const MINION_DEF_IDS = [
    'pirate_king',
    'pirate_buccaneer',
    'pirate_saucy_wench',
    'pirate_first_mate',
    'zombie_lord',
    'zombie_grave_digger',
    'zombie_tenacious_z',
    'zombie_walker',
];

type StackMetrics = {
    attr: string | null;
    modeAttr: string | null;
    className: string;
    clientHeight: number;
    scrollHeight: number;
    scrollTop: number;
    maxHeight: string;
    overflowY: string;
    secondMarginTop: string | null;
    visibleMinionUids: string[];
};

async function readStackMetrics(page: Page): Promise<StackMetrics> {
    return page.locator('[data-testid="su-base-stack-0-0"]').evaluate((element) => {
        const stack = element as HTMLElement;
        const stackRect = stack.getBoundingClientRect();
        const minions = Array.from(stack.querySelectorAll<HTMLElement>('[data-minion-uid]'));
        const visibleMinionUids = minions
            .filter((minion) => {
                const rect = minion.getBoundingClientRect();
                return rect.bottom > stackRect.top + 1 && rect.top < stackRect.bottom - 1;
            })
            .map((minion) => minion.dataset.minionUid ?? '');

            return {
                attr: stack.getAttribute('data-minion-select-list'),
                modeAttr: stack.getAttribute('data-minion-select-mode'),
                className: stack.className,
                clientHeight: stack.clientHeight,
                scrollHeight: stack.scrollHeight,
            scrollTop: stack.scrollTop,
            maxHeight: stack.style.maxHeight,
            overflowY: window.getComputedStyle(stack).overflowY,
            secondMarginTop: minions[1]?.style.marginTop ?? null,
            visibleMinionUids,
        };
    });
}

async function captureBaseArea(page: Page, testInfo: TestInfo, name: string, filename: string): Promise<string> {
    const path = getEvidenceScreenshotPath(testInfo, name, {
        filename,
        requireChineseName: true,
    });
    await mkdir(dirname(path), { recursive: true });

    const clip = await page.evaluate(() => {
        const base = document.querySelector<HTMLElement>('[data-testid="base-zone-0"]');
        const stack = document.querySelector<HTMLElement>('[data-testid="su-base-stack-0-0"]');
        if (!base || !stack) {
            throw new Error('缺少基地或随从队列，无法截图');
        }

        const baseRect = base.getBoundingClientRect();
        const stackRect = stack.getBoundingClientRect();
        const left = Math.max(0, Math.min(baseRect.left, stackRect.left) - 56);
        const top = Math.max(0, Math.min(baseRect.top, stackRect.top) - 44);
        const right = Math.min(window.innerWidth, Math.max(baseRect.right, stackRect.right) + 56);
        const bottom = Math.min(window.innerHeight, Math.max(baseRect.bottom, stackRect.bottom) + 44);

        return {
            x: Math.floor(left + window.scrollX),
            y: Math.floor(top + window.scrollY),
            width: Math.max(1, Math.ceil(right - left)),
            height: Math.max(1, Math.ceil(bottom - top)),
        };
    });

    await page.screenshot(withJpegEvidenceScreenshotOptions({ path, clip }));
    return path;
}

test.describe('大杀四方随从选择队列滚动截图', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({ page }, testInfo) => {
        await page.setViewportSize(MOBILE_LANDSCAPE_VIEWPORT);
        await clearEvidenceScreenshotsForTest(testInfo);
    });

    test('选择随从队列半展开并能滚动显示下方随从', async ({ page, game }, testInfo) => {
        await game.openTestGame('smashup', {
            p0: 'pirates,zombies',
            p1: 'robots,dinosaurs',
            skipFactionSelect: true,
            skipInitialization: false,
            seed: 24680,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                factions: ['pirates', 'zombies'],
                field: MINION_UIDS.map((uid, index) => ({
                    uid,
                    defId: MINION_DEF_IDS[index],
                    baseIndex: 0,
                    owner: '0',
                    controller: '0',
                })),
                hand: [],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['robots', 'dinosaurs'],
                hand: [],
            },
            bases: [
                { defId: 'base_the_jungle' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
            sys: {
                interaction: {
                    current: {
                        id: 'e2e-minion-select-scroll',
                        kind: 'simple-choice',
                        playerId: '0',
                        data: {
                            sourceId: 'e2e_minion_select_scroll',
                            title: '选择一个随从',
                            targetType: 'minion',
                            options: MINION_UIDS.map((uid) => ({
                                id: `target-${uid}`,
                                label: '选择随从',
                                value: { minionUid: uid, baseIndex: 0 },
                            })),
                        },
                    },
                    queue: [],
                },
            },
        });

        const stack = page.locator('[data-testid="su-base-stack-0-0"]');
        await expect(stack).toBeVisible({ timeout: 10000 });
        await expect(stack).toHaveAttribute('data-minion-select-mode', 'true');
        await expect(stack).toHaveAttribute('data-minion-select-list', 'true');

        await stack.evaluate((element) => {
            (element as HTMLElement).scrollTop = 0;
        });
        await page.waitForTimeout(150);

        const beforeMetrics = await readStackMetrics(page);
        expect(beforeMetrics.modeAttr).toBe('true');
        expect(beforeMetrics.attr).toBe('true');
        expect(beforeMetrics.className).toContain('overflow-y-auto');
        expect(beforeMetrics.className).toContain('no-scrollbar');
        expect(beforeMetrics.overflowY).toBe('auto');
        expect(beforeMetrics.scrollHeight).toBeGreaterThan(beforeMetrics.clientHeight + 1);
        expect(beforeMetrics.secondMarginTop ?? '').toContain('-3.5203');
        expect(beforeMetrics.visibleMinionUids).toContain('scroll-minion-01');

        const beforePath = await captureBaseArea(
            page,
            testInfo,
            '选择随从滚动前',
            '01-选择随从-滚动前.jpg',
        );

        await stack.evaluate((element) => {
            const stackElement = element as HTMLElement;
            stackElement.scrollTop = stackElement.scrollHeight;
        });
        await page.waitForTimeout(250);

        const afterMetrics = await readStackMetrics(page);
        expect(afterMetrics.scrollTop).toBeGreaterThan(0);
        expect(Math.abs(afterMetrics.scrollHeight - beforeMetrics.scrollHeight)).toBeLessThanOrEqual(2);
        expect(Math.abs(afterMetrics.clientHeight - beforeMetrics.clientHeight)).toBeLessThanOrEqual(2);
        expect(afterMetrics.visibleMinionUids).toContain('scroll-minion-08');

        const afterPath = await captureBaseArea(
            page,
            testInfo,
            '选择随从滚动后',
            '02-选择随从-滚动后.jpg',
        );

        const evidenceDir = dirname(beforePath);
        await writeFile(
            join(evidenceDir, 'scroll-metrics.json'),
            `${JSON.stringify({
                viewport: MOBILE_LANDSCAPE_VIEWPORT,
                before: beforeMetrics,
                after: afterMetrics,
                screenshots: [beforePath, afterPath],
            }, null, 2)}\n`,
            'utf8',
        );

        console.log('随从选择滚动截图证据:', {
            beforePath,
            afterPath,
            before: beforeMetrics,
            after: afterMetrics,
        });
    });
});
