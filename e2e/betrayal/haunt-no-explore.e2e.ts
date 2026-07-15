import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import { BETRAYAL_COMMANDS } from '../../src/games/betrayal/game';
import {
    createFirstScenarioHauntRuntimeCore,
    dispatchHarnessCommand,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-haunt阶段禁探索';
const HAUNT_BOARD_SCREENSHOT = `${EVIDENCE_DIR}/01-haunt阶段-牌桌无探索入口.jpg`;
const COMMAND_REJECTED_SCREENSHOT = `${EVIDENCE_DIR}/02-haunt阶段-探索命令被拒绝.jpg`;

type BetrayalRejectedCommand = {
    gameId?: string;
    error?: string;
    commandType?: string;
} | null;

test.describe('山屋惊魂 haunt 阶段探索门禁', () => {
    test('haunt 阶段真实页面不暴露探索入口并拒绝探索命令', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-haunt-no-explore');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createFirstScenarioHauntRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|Haunt/i);

        const hauntSnapshot = await page.evaluate(() => {
            const state = (window as typeof window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                phase?: string;
                                rooms?: Array<{ id: string; state: string }>;
                            };
                        };
                    };
                };
            }).__BG_TEST_HARNESS__?.state?.get?.();
            return {
                phase: state?.core?.phase ?? null,
                unexploredRoomIds: state?.core?.rooms
                    ?.filter((room) => room.state === 'unexplored')
                    .map((room) => room.id) ?? [],
            };
        });
        expect(hauntSnapshot.phase, '测试起点必须是真实 haunt 阶段').toBe('haunt');
        expect(hauntSnapshot.unexploredRoomIds.length, 'haunt 阶段仍有未探索房间时也不得继续探索').toBeGreaterThan(0);
        await expect(page.getByTestId('betrayal-action-explore'), 'haunt 阶段底部动作条不得暴露“探索”按钮').toHaveCount(0);
        await expect(page.locator('[data-testid^="betrayal-room-explore-target-"]'), 'haunt 阶段不得在地图上生成探索目标高亮').toHaveCount(0);
        await saveScreenshot(page, HAUNT_BOARD_SCREENSHOT);

        await page.evaluate(() => {
            (window as typeof window & {
                __BG_LAST_COMMAND_REJECTED__?: BetrayalRejectedCommand;
            }).__BG_LAST_COMMAND_REJECTED__ = null;
        });
        await dispatchHarnessCommand(page, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {});
        await expect.poll(async () => page.evaluate(() => (
            (window as typeof window & {
                __BG_LAST_COMMAND_REJECTED__?: BetrayalRejectedCommand;
            }).__BG_LAST_COMMAND_REJECTED__ ?? null
        )), {
            message: 'haunt 阶段直接派发探索命令必须被领域层拒绝',
        }).toMatchObject({
            gameId: 'betrayal',
            commandType: BETRAYAL_COMMANDS.EXPLORE_ROOM,
            error: 'haunt 阶段不能继续探索新房间。',
        });
        await expect(page.getByText('haunt 阶段不能继续探索新房间。')).toBeVisible();
        await saveScreenshot(page, COMMAND_REJECTED_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-haunt-no-explore', diagnostics }]);
    });
});
