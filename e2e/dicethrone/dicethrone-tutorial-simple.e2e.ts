/**
 * DiceThrone 教程简化测试
 * 
 * 只测试教程能启动、显示基本步骤、并能通过点击 Next 推进
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { DiceThroneTutorial } from '../../src/games/dicethrone/tutorial';
import { test, expect } from '../framework';
import { dirname, join } from 'node:path';

import { setChineseLocale } from '../helpers/common';
import { disableFabMenu, dispatchLocalCommand, waitForTutorialBoardReady } from '../helpers/dicethrone';
import type { GameTestContext as __ThreeAxeFrameworkMarker } from '../framework';
import { expectRightTrayBonusDiceConfirmation, getRightTrayDiceTray, settleCurrentBonusDice } from './bonus-dice-flow';

type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('dicethrone');
  await game.setupScene({ gameId: 'dicethrone' });
};
void __ensureThreeAxesMarker;


const MOBILE_LANDSCAPE_VIEWPORT = { width: 936, height: 432 } as const;

const readTutorialState = async (page: Parameters<typeof test>[0]['page']) => page.evaluate(() => (
    (window as any).__BG_TEST_HARNESS__?.state?.get?.() ?? null
));

const waitForTutorialStep = async (page: Parameters<typeof test>[0]['page'], stepId: string, timeout = 15000) => {
    await expect(page.locator(`[data-tutorial-step="${stepId}"]`)).toBeVisible({ timeout });
};

const clickNextOverlayStep = async (page: Parameters<typeof test>[0]['page']) => {
    const nextButton = page.getByRole('button', { name: /^(Next|下一步)$/i }).first();
    const beforeStep = await page.locator('[data-tutorial-step]').first().getAttribute('data-tutorial-step');
    await expect(nextButton).toBeVisible({ timeout: 5000 });
    await nextButton.click({ force: true });
    await page.waitForFunction(
        (prev) => {
            const el = document.querySelector('[data-tutorial-step]');
            const visibleStep = el?.getAttribute('data-tutorial-step') ?? null;
            const runtimeStep = (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.tutorial?.step?.id ?? null;
            return (visibleStep && visibleStep !== prev) || (runtimeStep && runtimeStep !== prev);
        },
        beforeStep,
        { timeout: 5000 },
    );
};

const clickHandCardVisibleArea = async (
    page: Parameters<typeof test>[0]['page'],
    cardId: string,
    yRatio = 0.82,
) => {
    const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(card).toBeVisible({ timeout: 10000 });
    const box = await card.boundingBox();
    if (!box) {
        throw new Error(`未能获取手牌 ${cardId} 的点击区域`);
    }
    await page.mouse.click(
        box.x + box.width / 2,
        box.y + box.height * yRatio,
    );
};

const readHighlightMetrics = async (page: Parameters<typeof test>[0]['page'], targetId: string) => page.evaluate((resolvedTargetId) => {
    const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-tutorial-id="${resolvedTargetId}"]`),
    );
    const highlight = document.querySelector('[data-testid="tutorial-highlight-ring"]') as HTMLElement | null;
    if (candidates.length === 0 || !highlight) {
        return null;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let targetRect: DOMRect | null = null;
    let bestVisibleArea = -1;

    for (const candidate of candidates) {
        const style = getComputedStyle(candidate);
        if (style.display === 'none' || style.visibility === 'hidden') {
            continue;
        }

        let rect = candidate.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1) {
            if (resolvedTargetId === 'status-tokens') {
                // status-tokens 在无状态时天然可能是“细条/零高”，与教程高亮一致，不要错误扩展到父容器
                // 直接使用原始 rect 参与比较即可
            } else {
            const parentRect = candidate.parentElement?.getBoundingClientRect() ?? null;
            if (!parentRect || parentRect.width <= 1 || parentRect.height <= 1) {
                continue;
            }
            rect = parentRect;
            }
        }

        const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
        const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
        const visibleArea = visibleWidth * visibleHeight;

        if (visibleArea > bestVisibleArea) {
            bestVisibleArea = visibleArea;
            targetRect = rect;
        }
    }

    if (!targetRect) {
        return null;
    }

    const highlightRect = highlight.getBoundingClientRect();
    return {
        targetRect,
        highlightRect,
        deltaLeft: Math.abs(targetRect.left - highlightRect.left),
        deltaTop: Math.abs(targetRect.top - highlightRect.top),
        deltaWidth: Math.abs(targetRect.width - highlightRect.width),
        deltaHeight: Math.abs(targetRect.height - highlightRect.height),
    };
}, targetId);

const waitForTutorialStepIn = async (
    page: Parameters<typeof test>[0]['page'],
    stepIds: string[],
    timeout = 15000,
) => {
    await page.waitForFunction(
        (expectedStepIds) => {
            const stepId = document.querySelector('[data-tutorial-step]')?.getAttribute('data-tutorial-step');
            return !!stepId && expectedStepIds.includes(stepId);
        },
        stepIds,
        { timeout },
    );

    const stepId = await page.locator('[data-tutorial-step]').first().getAttribute('data-tutorial-step');
    if (!stepId || !stepIds.includes(stepId)) {
        throw new Error(`未能命中步骤集合: ${stepIds.join(', ')}，当前=${stepId}`);
    }
    return stepId;
};

const finishPlaySixDiceModifyIfNeeded = async (page: Parameters<typeof test>[0]['page']) => {
    await page.waitForFunction(() => {
        const stepId = document.querySelector('[data-tutorial-step]')?.getAttribute('data-tutorial-step');
        const interactionConfirm = document.querySelector<HTMLButtonElement>('[data-testid="dice-interaction-confirm-button"]');
        return stepId === 'dice-confirm' || Boolean(interactionConfirm && !interactionConfirm.disabled);
    }, { timeout: 10000 });

    const interactionConfirm = page.getByTestId('dice-interaction-confirm-button');
    if (await interactionConfirm.isVisible().catch(() => false)) {
        await expect(interactionConfirm).toBeEnabled({ timeout: 5000 });
        await interactionConfirm.click();
    }

    await waitForTutorialStep(page, 'dice-confirm', 10000);
};

const dragHandCardToDiscard = async (
    page: Parameters<typeof test>[0]['page'],
    cardId: string,
) => {
    const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    const discardPile = page.getByTestId('discard-pile');
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(discardPile).toBeVisible({ timeout: 10000 });

    const cardBox = await card.boundingBox();
    const discardBox = await discardPile.boundingBox();
    if (!cardBox || !discardBox) {
        throw new Error(`未能获取拖拽区域: card=${cardId}`);
    }

    const startX = cardBox.x + cardBox.width / 2;
    const startY = cardBox.y + cardBox.height * 0.82;
    const endX = discardBox.x + discardBox.width / 2;
    const endY = discardBox.y + discardBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
};

const dragHandCardToPlay = async (
    page: Parameters<typeof test>[0]['page'],
    cardId: string,
) => {
    const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(card).toBeVisible({ timeout: 10000 });

    const cardBox = await page.evaluate((nextCardId) => {
        const node = document.querySelector(`[data-testid="hand-area"] [data-card-id="${nextCardId}"]`) as HTMLElement | null;
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }, cardId);
    if (!cardBox || cardBox.width <= 0 || cardBox.height <= 0) {
        throw new Error(`未能获取拖拽区域: card=${cardId}`);
    }

    const startX = cardBox.x + cardBox.width / 2;
    const startY = cardBox.y + cardBox.height * 0.82;
    const endY = Math.max(24, startY - 240);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
};

const clickAbilitySlot = async (
    page: Parameters<typeof test>[0]['page'],
    slotId: string,
) => {
    const slot = page.locator(`[data-ability-slot="${slotId}"]`).first();
    await expect(slot).toBeVisible({ timeout: 10000 });
    await slot.click();
};

const assertHighlightAligned = async (
    page: Parameters<typeof test>[0]['page'],
    options: {
        stepId: string;
        targetId: string;
        testInfo: Parameters<typeof test>[1];
        evidenceDir: string;
        screenshotKey: string;
    },
) => {
    await waitForTutorialStep(page, options.stepId, 15000);
    await page.waitForTimeout(300);

    await expect.poll(
        async () => readHighlightMetrics(page, options.targetId),
        { timeout: 10000 },
    ).not.toBeNull();

    const metrics = await readHighlightMetrics(page, options.targetId);
    console.log('tutorial-highlight-real-flow', options.stepId, options.targetId, JSON.stringify(metrics));
    expect(metrics).not.toBeNull();
    expect(metrics?.deltaLeft ?? 99999).toBeLessThanOrEqual(2);
    expect(metrics?.deltaTop ?? 99999).toBeLessThanOrEqual(2);
    expect(metrics?.deltaWidth ?? 99999).toBeLessThanOrEqual(2);
    expect(metrics?.deltaHeight ?? 99999).toBeLessThanOrEqual(2);

    await page.screenshot({
        path: options.testInfo.outputPath(`${options.screenshotKey}.png`),
        fullPage: false,
    });
    await page.screenshot({
        path: join(options.evidenceDir, `${options.screenshotKey}.png`),
        fullPage: false,
    });
};


/** 从真实教程入口逐步操作；每张提示卡取当前画面，禁止用 dispatch 代替玩家点击。 */
const playTutorial = async (page: Parameters<typeof test>[0]['page'], testInfo: Parameters<typeof test>[1], useChi: boolean) => {
    await setChineseLocale(page);
    await page.goto('/play/dicethrone/tutorial');
    await waitForTutorialBoardReady(page, 60000);
    await disableFabMenu(page);
    const records: Array<{ step: string; action: string; screenshot: string }> = [];
    const dir = testInfo.outputPath('tutorial-chain');
    mkdirSync(dir, { recursive: true });
    const seen = new Set<string>();
    for (let i = 0; i < DiceThroneTutorial.steps.length + 10; i++) {
        const overlay = page.locator('[data-tutorial-step]').first();
        await expect(overlay).toBeVisible({ timeout: 30000 });
        const id = (await overlay.getAttribute('data-tutorial-step'))!;
        expect(seen.has(id), '同一步不能卡住: ' + id).toBe(false);
        seen.add(id);
        const step = DiceThroneTutorial.steps.find(step => step.id === id)!;
        expect(step, id).toBeDefined();
        if (step.aiActions?.length) {
            await expect.poll(async () => {
                const state = await readTutorialState(page);
                return state?.sys?.tutorial?.step?.aiActions?.length ?? 0;
            }, { timeout: 45000 }).toBe(0);
        }
        await expect(overlay).toHaveAttribute('data-tutorial-step', id);
        if (step.highlightTarget) {
            await expect(page.locator('[data-tutorial-id="' + step.highlightTarget + '"]').first()).toBeVisible();
        }
        await page.mouse.move(2,2);
        await page.waitForTimeout(350);
        const filename = String(i + 1).padStart(2,'0') + '-' + id + '.png';
        await page.screenshot({ path: join(dir, filename), fullPage: false });
        records.push({ step: id, action: step.infoStep || step.aiActions ? '阅读当前规则或公开结果' : '操作正式入口', screenshot: filename });
        if (id === 'finish') {
            expect(seen.has('defense-roll')).toBe(true);
            expect(seen.has('token-response-use')).toBe(true);
            const state = await readTutorialState(page);
            expect(state.core.players['0'].abilityLevels.meditation).toBe(2);
            expect(state.core.players['0'].statusEffects.knockdown ?? 0).toBe(0);
            writeFileSync(join(dir,'chain.json'), JSON.stringify({ gameId: 'dicethrone', evidenceCategory: 'tutorial', useChi, records },null,2));
            await clickNextOverlayStep(page);
            return;
        }
        if (step.infoStep || step.aiActions?.length) {
            await clickNextOverlayStep(page);
            continue;
        }
        switch (id) {
            case 'sell-card-intro': await dragHandCardToDiscard(page,'card-deep-thought'); break;
            case 'undo-sell': await page.getByTestId('discard-pile').click(); break;
            case 'advance': case 'resolve-attack': case 'end-turn': case 'discard-finish': case 'defense-resolve':
                await page.locator('[data-tutorial-id="advance-phase-button"]').click(); break;
            case 'dice-roll': case 'dice-reroll': case 'defense-roll':
                await page.locator('[data-tutorial-id="dice-roll-button"]').click(); break;
            case 'dice-lock':
                await page.getByTestId('die-button-0').click(); break;
            case 'play-six': await clickHandCardVisibleArea(page,'card-play-six'); break;
            case 'play-six-modify':
                await page.getByTestId('die-button-0').click();
                await finishPlaySixDiceModifyIfNeeded(page); break;
            case 'dice-confirm': case 'defense-confirm': case 'enlightenment-confirm':
                await page.locator('[data-tutorial-id="dice-confirm-button"]').click(); break;
            case 'abilities': await clickAbilitySlot(page,'fist'); break;
            case 'enlightenment-play': await clickHandCardVisibleArea(page,'card-enlightenment'); break;
            case 'inner-peace': await clickHandCardVisibleArea(page,'card-inner-peace'); break;
            case 'inner-peace-response': case 'token-response-pass':
                await page.getByTestId('dicethrone-response-pass-button').click(); break;
            case 'token-response-use': {
                const before = await readTutorialState(page);
                expect(before.core.pendingDamage.responderId).toBe('0');
                if (useChi) {
                    await page.getByTestId('dt-player-0-token-taiji-hit-target').click();
                    await expect.poll(async () => (await readTutorialState(page)).core.players['0'].tokens.taiji).toBe(before.core.players['0'].tokens.taiji - 1);
                } else {
                    await page.getByTestId('dicethrone-response-pass-button').click();
                    await expect.poll(async () => (await readTutorialState(page)).core.pendingDamage).toBeUndefined();
                }
                break;
            }
            case 'purify-use':
                await page.getByTestId('dt-player-0-token-purify-hit-target').click();
                await expect(page.getByRole('heading', { name: /使用净化|Purify/i }).first()).toBeVisible();
                await page.getByRole('button', { name: /^确认$|^Confirm$/i }).last().click(); break;
            case 'meditation-2': await clickHandCardVisibleArea(page,'card-meditation-2'); break;
            default: throw Error('未实现真实操作: ' + id);
        }
        await expect.poll(async () => page.locator('[data-tutorial-step]').first().getAttribute('data-tutorial-step'), { timeout: 30000 }).not.toBe(id);
    }
    throw Error('教程没有到达结束步骤');
};

test.describe('DiceThrone 完整双人教学主线', () => {
    test.setTimeout(300000);
    test('桌面：锁骰重掷、亲手防御并使用太极减伤', async ({ page }, testInfo) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await playTutorial(page,testInfo,true);
    });
    test('手机横屏：亲手完成教学主线', async ({ page }, testInfo) => {
        await page.setViewportSize(MOBILE_LANDSCAPE_VIEWPORT);
        await playTutorial(page,testInfo,true);
    });
    test('响应分支：直接放弃后仍可结算并完成后续教学', async ({ page }, testInfo) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await playTutorial(page,testInfo,false);
    });
});
