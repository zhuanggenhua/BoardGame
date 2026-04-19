/**
 * 大杀四方 - 弃牌堆出牌交互 E2E 测试
 *
 * 验证弃牌堆面板统一交互流程：
 * 1. 打开弃牌堆 → 显示所有卡牌，可打出的卡牌金色描边高亮
 * 2. 点击可打出卡牌 → 选中状态
 * 3. 选中后基地高亮 → 点击基地部署
 */

import { test, expect, type Page } from '@playwright/test';
import {
    initContext,
    dismissViteOverlay,
} from '../helpers/common';

// ============================================================================
// 工具函数
// ============================================================================

const ensureDebugPanelOpen = async (page: Page) => {
    const panel = page.getByTestId('debug-panel');
    if (await panel.isVisible().catch(() => false)) return;
    const toggle = page.getByTestId('debug-toggle');
    await expect(toggle).toBeVisible({ timeout: 5000 });
    await toggle.click();
    await expect(panel).toBeVisible({ timeout: 5000 });
};

const closeDebugPanel = async (page: Page) => {
    const panel = page.getByTestId('debug-panel');
    if (await panel.isVisible().catch(() => false)) {
        await page.getByTestId('debug-toggle').click();
        await expect(panel).toBeHidden({ timeout: 5000 });
    }
};

/** 读取完整 G 状态 */
const readFullState = async (page: Page) => {
    await ensureDebugPanelOpen(page);
    const stateTab = page.getByTestId('debug-tab-state');
    if (await stateTab.isVisible().catch(() => false)) await stateTab.click();
    const raw = await page.getByTestId('debug-state-json').innerText();
    return JSON.parse(raw);
};

/** 通过调试面板注入 core 状态 */
const applyCoreStateDirect = async (page: Page, coreState: unknown) => {
    await ensureDebugPanelOpen(page);
    const stateTab = page.getByTestId('debug-tab-state');
    if (await stateTab.isVisible().catch(() => false)) await stateTab.click();

    const toggleBtn = page.getByTestId('debug-state-toggle-input');
    const input = page.getByTestId('debug-state-input');
    if (!await input.isVisible().catch(() => false)) {
        await expect(toggleBtn).toBeVisible({ timeout: 3000 });
        await toggleBtn.click();
    }
    await expect(input).toBeVisible({ timeout: 3000 });

    await input.fill(JSON.stringify(coreState));
    const applyBtn = page.getByTestId('debug-state-apply');
    await expect(applyBtn).toBeEnabled({ timeout: 2000 });
    await applyBtn.click();
    await page.waitForTimeout(500);
};

const gotoLocalSmashUp = async (page: Page) => {
    await page.goto('/play/smashup/local', { waitUntil: 'domcontentloaded' });
    await dismissViteOverlay(page);
    await page.waitForFunction(
        () => {
            if (document.querySelector('[data-testid="su-hand-area"]')) return true;
            if (document.querySelector('[data-testid="debug-toggle"]')) return true;
            if (document.querySelector('h1')?.textContent?.match(/Draft Your Factions|选择你的派系/)) return true;
            return false;
        },
        { timeout: 30000 },
    );
};

/** 蛇形选秀完成派系选择，保持 P0 仍能选到 Zombies（index 5）。 */
const completeFactionSelectionLocal = async (page: Page) => {
    const factionHeading = page.locator('h1').filter({ hasText: /Draft Your Factions|选择你的派系/i });
    if (!await factionHeading.isVisible().catch(() => false)) return;
    const factionCards = page.locator('.grid > div');
    const confirmBtn = page.getByRole('button', { name: /Confirm Selection|确认选择/i });
    // 蛇形选秀：P0 先拿 Zombies，P1 再拿 Pirates + Ninjas，最后 P0 拿 Dinosaurs。
    const pickOrder = [5, 0, 1, 2];
    for (const idx of pickOrder) {
        await factionCards.nth(idx).click();
        await expect(confirmBtn).toBeVisible({ timeout: 5000 });
        await confirmBtn.click();
        await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1000);
};

const waitForHandArea = async (page: Page, timeout = 30000) => {
    const handArea = page.getByTestId('su-hand-area');
    await expect(handArea).toBeVisible({ timeout });
};

// ============================================================================
// 测试用例
// ============================================================================

test.describe('SmashUp 弃牌堆出牌交互', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ context }) => {
        await initContext(context, { storageKey: '__smashup_discard_play_reset' });
    });

    test('弃牌堆面板：可打出卡牌高亮 → 选中 → 部署到基地', async ({ page }, testInfo) => {
        await gotoLocalSmashUp(page);
        await completeFactionSelectionLocal(page);
        await waitForHandArea(page);

        // 读取当前状态并注入弃牌堆中的顽强丧尸
        const fullState = await readFullState(page);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const players = core.players as Record<string, Record<string, unknown>>;
        const turnOrder = core.turnOrder as string[];
        const currentPid = turnOrder[(core.currentPlayerIndex as number) ?? 0];
        const player = players[currentPid];

        // 向弃牌堆注入顽强丧尸和一些普通卡（模拟真实弃牌堆）
        const discard = player.discard as { uid: string; defId: string; type: string; owner: string }[];
        const nextUid = (core.nextUid as number) ?? 100;
        discard.push(
            { uid: `card_${nextUid}`, defId: 'zombie_tenacious_z', type: 'minion', owner: currentPid },
            { uid: `card_${nextUid + 1}`, defId: 'zombie_tenacious_z', type: 'minion', owner: currentPid },
            { uid: `card_${nextUid + 2}`, defId: 'zombie_walker', type: 'minion', owner: currentPid },
        );
        core.nextUid = nextUid + 3;
        // 确保未使用过弃牌堆出牌能力
        player.usedDiscardPlayAbilities = [];

        await applyCoreStateDirect(page, core);
        await closeDebugPanel(page);
        await page.waitForTimeout(1000);

        // 验证弃牌堆按钮有闪电标记（hasPlayableFromDiscard）
        const discardToggle = page.locator('[data-discard-toggle]');
        await expect(discardToggle).toBeVisible({ timeout: 5000 });
        await expect(discardToggle.locator('text=⚡')).toBeVisible({ timeout: 5000 });

        // Step 1: 点击弃牌堆打开面板
        await discardToggle.click();
        await page.waitForTimeout(800);

        await page.screenshot({ path: testInfo.outputPath('step1-discard-panel.png'), fullPage: true });

        // 选择模式下（有可打出卡牌），面板没有 data-discard-view-panel 属性
        // 检查 ring-amber 高亮卡牌（选择模式的标志）
        const highlightCount = await page.locator('[class*="ring-amber"]').count();
        console.log(`ring-amber 元素数量: ${highlightCount}`);
        expect(highlightCount).toBeGreaterThan(0);

        // 验证面板中有卡牌
        const panelCards = page.locator('.fixed .flex-shrink-0');
        const cardCount = await panelCards.count();
        console.log(`面板卡牌数量: ${cardCount}`);
        expect(cardCount).toBeGreaterThanOrEqual(3);

        // Step 2: 点击一张高亮的卡牌（顽强丧尸）
        // ring-amber 在卡牌图片容器上，onClick 在其父级 motion.div 上
        // 面板在底部可能被手牌区域部分遮挡，使用 evaluate 直接触发
        const clickResult = await page.evaluate(() => {
            const amberCards = document.querySelectorAll('[class*="ring-amber"]');
            if (amberCards.length === 0) return 'no-amber-cards';
            const card = amberCards[0];
            const clickTarget = card.closest('.flex-shrink-0') || card.parentElement;
            if (clickTarget) {
                (clickTarget as HTMLElement).click();
                return 'clicked';
            }
            return 'no-parent';
        });
        console.log('点击结果:', clickResult);
        await page.waitForTimeout(500);

        await page.screenshot({ path: testInfo.outputPath('step2-card-selected.png'), fullPage: true });

        // 验证选中提示文本出现（"点击基地放置随从"）
        const selectHint = page.getByText(/Click.*base|点击基地/i);
        await expect(selectHint).toBeVisible({ timeout: 3000 });

        // Step 3: 点击一个基地部署
        // 选中弃牌堆卡牌后，可部署的基地会有 ring-amber-400 高亮（isSelectable）
        // onClick 在基地卡片 div 上（w-[14vw]），该 div 有 ring-4 ring-amber-400
        await page.screenshot({ path: testInfo.outputPath('step3-bases-highlighted.png'), fullPage: true });

        // 使用 evaluate 点击有 ring-amber-400 的基地卡片 div（它有 onClick handler）
        const baseClickResult = await page.evaluate(() => {
            // 基地卡片 div 在 isSelectable 时有 ring-amber-400 class
            const selectableBases = document.querySelectorAll('[class*="ring-amber-400"]');
            // 过滤出基地区域的（w-[14vw]），排除弃牌堆面板中的卡牌
            for (const el of selectableBases) {
                if (el.classList.toString().includes('w-[14vw]')) {
                    (el as HTMLElement).click();
                    return 'clicked-base';
                }
            }
            // fallback: 直接找 group/base 下的大 div
            const bases = document.querySelectorAll('.group\\/base');
            if (bases.length > 0) {
                // 基地卡片是 group/base 下的第二个子 div（第一个是 ongoing effects）
                const baseCard = bases[0].querySelector('[class*="w-\\[14vw\\]"]') as HTMLElement;
                if (baseCard) {
                    baseCard.click();
                    return 'clicked-base-fallback';
                }
                // 最终 fallback：点击 group/base 本身
                (bases[0] as HTMLElement).click();
                return 'clicked-group-base';
            }
            return 'no-base-found';
        });
        console.log('基地点击结果:', baseClickResult);
        await page.waitForTimeout(1000);

        await page.screenshot({ path: testInfo.outputPath('step4-after-deploy.png'), fullPage: true });

        // 验证弃牌堆数量减少（通过读取状态，比 UI 更可靠）
        const afterState = await readFullState(page);
        const afterCore = (afterState.core ?? afterState) as Record<string, unknown>;
        const afterPlayers = afterCore.players as Record<string, Record<string, unknown>>;
        const afterDiscard = afterPlayers[currentPid].discard as unknown[];
        console.log('部署后弃牌堆长度:', afterDiscard.length, '(原始:', discard.length, ')');

        // 打出一张后弃牌堆应该少一张
        expect(afterDiscard.length).toBeLessThan(discard.length);

        await closeDebugPanel(page);
        await page.screenshot({ path: testInfo.outputPath('step5-final.png'), fullPage: true });
    });
});
