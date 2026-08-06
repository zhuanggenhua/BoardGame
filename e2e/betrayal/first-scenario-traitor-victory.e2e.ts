import { expect, test } from '@playwright/test';
import type { BetrayalCore } from '../../src/games/betrayal/game';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createFirstScenarioReadyToTraitorVictoryRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-first-scenario-traitor';
const PRE_ENDGAME_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-第一剧本-叛徒收尾前.png`;
const ENDGAME_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-终局-叛徒得逞.png`;
const HUMAN_TRAITOR_TEST_URL = '/play/betrayal?players=3&playerID=2&seat0=human&seat1=human&seat2=human';

test.describe('山屋惊魂第一剧本叛徒线', () => {
    test('从真实 haunt 运行时进入叛徒终局', async ({ page, context }) => {
        test.setTimeout(180000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-traitor-victory');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(HUMAN_TRAITOR_TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createFirstScenarioReadyToTraitorVictoryRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|作祟中|Haunt/i);
        await expect(page.getByTestId('betrayal-status-chip')).toContainText('神父 梁沃伦');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/轮到神父 梁沃伦|可前往/i);
        await saveScreenshot(page, PRE_ENDGAME_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]);
        const attackHeroAction = page.getByTestId('betrayal-action-use');
        await expect(attackHeroAction, '叛徒收尾必须先显示攻击英雄主动作').toContainText(/攻击英雄|Attack hero/);
        await expect(attackHeroAction, '叛徒收尾点击英雄前必须仍处于普通动作态').not.toHaveAttribute('data-haunt-targeting-status', 'true');
        await attackHeroAction.click();
        const heroMapTarget = page.getByTestId('betrayal-room-occupant-ground-north-1');
        await expect(heroMapTarget, '叛徒收尾攻击主路径必须点击地图上的英雄 token 本体').toBeVisible();
        await expect(heroMapTarget, '英雄 token 必须标记为直选目标').toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-occupant-target-outline-ground-north-1'), '英雄 token 必须有贴合本体的五边形高亮').toHaveAttribute('data-highlight-shape', 'pentagon');
        await heroMapTarget.click();

        const attackCore = await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: { get?: () => { core?: BetrayalCore } };
                };
            }).__BG_TEST_HARNESS__;
            return harness?.state?.get?.().core ?? null;
        });
        if (!attackCore?.pendingDamageAllocation) {
            throw new Error('叛徒攻击英雄后必须进入伤害分配，当前没有可确认的伤害分配状态');
        }
        const pendingDamage = attackCore.pendingDamageAllocation;
        const damageTarget = [attackCore.currentExplorer, ...attackCore.otherExplorers].find(
            (explorer) => explorer.playerId === pendingDamage.playerId,
        );
        if (!damageTarget) {
            throw new Error(`找不到伤害分配目标玩家：${pendingDamage.playerId}`);
        }
        const damageTraitSelection: Array<(typeof pendingDamage.allowedTraits)[number]> = [];
        let remainingDamage = pendingDamage.amount;
        for (const trait of pendingDamage.allowedTraits) {
            const track = damageTarget.traitTracks[trait];
            const floorPosition = pendingDamage.allowSkull
                ? track.skullPosition
                : track.criticalPosition;
            const assignableSteps = Math.max(0, track.position - floorPosition);
            const take = Math.min(remainingDamage, assignableSteps);
            damageTraitSelection.push(...Array.from({ length: take }, () => trait));
            remainingDamage -= take;
        }
        if (remainingDamage !== 0) {
            throw new Error(`伤害分配无法按当前英雄属性轨完成 ${pendingDamage.amount} 点分配`);
        }

        const targetPage = await context.newPage();
        const targetDiagnostics = attachPageDiagnostics(targetPage, 'betrayal-first-scenario-traitor-victory-target');
        try {
            await targetPage.setViewportSize({ width: 1600, height: 900 });
            await targetPage.goto(`/play/betrayal?players=3&playerID=${pendingDamage.playerId}&seat0=human&seat1=human&seat2=human`, { waitUntil: 'domcontentloaded' });
            await waitForBetrayalPageReady(targetPage);
            await injectCore(targetPage, attackCore);
            await expect(targetPage.getByTestId('betrayal-damage-allocation-panel')).toHaveAttribute('data-player-id', pendingDamage.playerId);
            await expect(targetPage.getByTestId('betrayal-damage-allocation-confirm')).toBeDisabled();
            for (const trait of damageTraitSelection) {
                await targetPage.getByTestId(`betrayal-damage-allocation-trait-${trait}`).click();
            }
            await expect(targetPage.getByTestId('betrayal-damage-allocation-confirm')).toBeEnabled();
            await setHarnessRandomQueue(targetPage, [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]);
            await targetPage.getByTestId('betrayal-damage-allocation-confirm').click();

            const endgameScreen = targetPage.getByTestId('betrayal-endgame-screen');
            await expect(endgameScreen).toBeVisible({ timeout: 30000 });
            await expect(endgameScreen.getByTestId('betrayal-endgame-ending-narration')).toHaveAttribute('data-cinematic-narration', 'ending-traitor');
            await expect(endgameScreen.getByTestId('betrayal-endgame-ending-narration')).toContainText('结局朗读');
            await endgameScreen.screenshot({ path: ENDGAME_SCREENSHOT });
        } finally {
            assertNoFatalFrontendErrors([
                { label: 'betrayal-first-scenario-traitor-victory-target', diagnostics: targetDiagnostics },
            ]);
            await targetPage.close();
        }

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-traitor-victory', diagnostics }]);
    });
});
