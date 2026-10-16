/**
 * DiceThrone 真实教程操作回放：主线、独立机制与合法分支。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { DiceThroneTutorial } from '../../src/games/dicethrone/tutorial';
import type { TutorialManifest } from '../../src/engine/types';
import { DiceThroneDamagePractice, DiceThroneDiscardPractice, DiceThroneResponsePractice, DiceThroneUltimatePractice, DiceThroneUpgradePractice, DiceThroneStraightPractice, DiceThroneKnockdownPractice } from '../../src/games/dicethrone/tutorialPractices';
import { test, expect } from '../framework';
import { join } from 'node:path';

import { setChineseLocale } from '../helpers/common';
import { disableFabMenu, waitForTutorialBoardReady } from '../helpers/dicethrone';
import { expectRightTrayBonusDiceConfirmation } from './bonus-dice-flow';



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
    const x = box.x + box.width / 2;
    const y = box.y + box.height * yRatio;
    if ((page.viewportSize()?.width ?? 1440) < 1000) {
        const cdp = await page.context().newCDPSession(page);
        try {
            await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } finally { await cdp.detach(); }
    } else await page.mouse.click(x, y);
};

const readHighlightMetrics = async (page: Parameters<typeof test>[0]['page'], targetId: string) => page.evaluate((resolvedTargetId) => {
    const tutorialTargets = document.querySelectorAll<HTMLElement>(`[data-tutorial-id="${resolvedTargetId}"]`);
    // 与正式浮层保持相同优先级；手牌的测试根节点和可见焦点不是同一个对象。
    const candidates = Array.from(tutorialTargets.length > 0 ? tutorialTargets
        : document.querySelectorAll<HTMLElement>(`[data-testid="${resolvedTargetId}"]`));
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

const clickAbilitySlot = async (
    page: Parameters<typeof test>[0]['page'],
    slotId: string,
) => {
    const slot = page.locator(`[data-ability-slot="${slotId}"]`).first();
    await expect(slot).toBeVisible({ timeout: 10000 });
    await slot.click();
};

/** 从真实教程入口逐步操作；每张提示卡取当前画面，禁止用 dispatch 代替玩家点击。 */
const playTutorial = async (page: Parameters<typeof test>[0]['page'], testInfo: Parameters<typeof test>[1], useChi: boolean, manifest: TutorialManifest = DiceThroneTutorial, alternate = false) => {
    page.setDefaultTimeout(10000);
    page.on('console', message => {
        if (/\[LocalGame\] 命令执行失败|\[TutorialContext\] AI/.test(message.text())) console.log('tutorial-browser-warning', message.text());
    });
    await setChineseLocale(page);
    await page.goto('/play/dicethrone/tutorial/' + manifest.id);
    await waitForTutorialBoardReady(page, 60000);
    await disableFabMenu(page);
    const records: Array<{ step: string; action: string; screenshot: string }> = [];
    const dir = join(process.cwd(), 'test-results', 'evidence-screenshots', 'dicethrone', 'tutorial-rebuild-20261016-r19', testInfo.title.replace(/[<>:"/\\|?*]/g, '-'));
    mkdirSync(dir, { recursive: true });
    const seen = new Set<string>();
    for (let i = 0; i < manifest.steps.length + 10; i++) {
        const overlay = page.locator('[data-tutorial-step]').first();
        await expect(overlay).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => page.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.() ?? null;
            const runtimeStepId = state?.sys?.tutorial?.step?.id ?? null;
            const visibleStepId = document.querySelector('[data-tutorial-step]')?.getAttribute('data-tutorial-step') ?? null;
            return runtimeStepId && runtimeStepId === visibleStepId ? runtimeStepId : null;
        }), { timeout: 10000 }).not.toBeNull();
        const live = await readTutorialState(page);
        const id = live?.sys?.tutorial?.step?.id ?? (await overlay.getAttribute('data-tutorial-step'))!;
        expect(seen.has(id), '同一步不能卡住: ' + id).toBe(false);
        seen.add(id);
        const step = manifest.steps.find(step => step.id === id)!;
        expect(step, id).toBeDefined();
        console.log('tutorial-live-step', JSON.stringify({ id, phase: live?.sys?.phase, active: live?.core?.activePlayerId, turn: live?.core?.turnNumber, rollCount: live?.core?.rollCount, confirmed: live?.core?.rollConfirmed, attack: live?.core?.pendingAttack?.sourceAbilityId, aiCount: live?.sys?.tutorial?.step?.aiActions?.length }));
        if (step.aiActions?.length) {
            await expect.poll(async () => {
                const state = await readTutorialState(page);
                return state?.sys?.tutorial?.step?.aiActions?.length ?? 0;
            }, { timeout: 45000 }).toBe(0);
        }
        await expect(overlay).toHaveAttribute('data-tutorial-step', id);
        if (step.highlightTarget) {
            const highlight = page.locator(`[data-tutorial-id="${step.highlightTarget}"], [data-testid="${step.highlightTarget}"]`).first();
            await expect(highlight).toBeVisible();
            await expect.poll(async () => {
                const metrics = await readHighlightMetrics(page, step.highlightTarget!);
                return metrics ? Math.max(metrics.deltaLeft, metrics.deltaTop, metrics.deltaWidth, metrics.deltaHeight) : Infinity;
            }, { timeout: 10000, message: id + ': 等待目标动画与高亮同步' }).toBeLessThanOrEqual(2);
            const metrics = await readHighlightMetrics(page, step.highlightTarget);
            for (const value of [metrics!.deltaLeft, metrics!.deltaTop, metrics!.deltaWidth, metrics!.deltaHeight]) {
                expect(value, id + ': 高亮必须贴合目标').toBeLessThanOrEqual(2);
            }
        }
        if (id === 'enlightenment-confirm') {
            await expectRightTrayBonusDiceConfirmation(page, () => readTutorialState(page));
            await expect(page.getByTestId('bonus-die-overlay')).toHaveCount(0);
        }
        await page.mouse.move(2,2);
        await expect(page.locator('[data-testid="dice-2d"]:not([data-roll-animation="settled"])')).toHaveCount(0, { timeout: 10000 });
        await page.evaluate(async () => {
            const animations = Array.from(document.querySelectorAll('[data-testid="dice-2d-cube"]'))
                .flatMap(element => element.getAnimations())
                .filter(animation => animation.effect?.getTiming().iterations !== Infinity);
            await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)));
        });
        await expect(page.locator('[data-fx-active-count]')).not.toHaveCount(0);
        await expect(page.locator('[data-fx-active-count]:not([data-fx-active-count="0"])')).toHaveCount(0, { timeout: 15000 });
        if (id === 'limit-result') {
            const state = await readTutorialState(page);
            expect(state.core.players['0'].resources.cp).toBe(15);
            expect(state.core.players['0'].hand).toHaveLength(6);
        }
        await page.waitForTimeout(350);
        const copyClipping = await page.getByTestId('tutorial-overlay-content').evaluate(element => {
            const range = document.createRange();
            range.selectNodeContents(element);
            const text = range.getBoundingClientRect();
            const visible = element.getBoundingClientRect();
            return Math.max(visible.top - text.top, text.bottom - visible.bottom, visible.left - text.left, text.right - visible.right, 0);
        });
        expect(copyClipping, id + ': 教学文字必须完整位于可见边界内').toBeLessThanOrEqual(1);
        const filename = String(i + 1).padStart(2,'0') + '-' + id + '.png';
        await page.screenshot({ path: join(dir, filename), fullPage: false });
        records.push({ step: id, action: step.infoStep || step.aiActions ? '阅读当前规则或公开结果' : '操作正式入口', screenshot: filename });
        if (id === manifest.steps.at(-1)?.id) {
            const state = await readTutorialState(page);
            if (manifest.id === DiceThroneTutorial.id) {
                expect(seen.has('defense-roll')).toBe(true);
                expect(seen.has('token-response-use')).toBe(true);
                expect(state.core.players['0'].abilityLevels.meditation).toBe(2);
                expect(state.core.players['0'].statusEffects.knockdown ?? 0).toBe(0);
            }
            if (manifest.id === DiceThroneUltimatePractice.id) {
                expect(state.core.players['1'].resources.hp).toBe(0);
                expect(state.sys.gameover).toBeDefined();
            }
            if (manifest.id === DiceThroneDamagePractice.id) {
                expect(state.core.players['1'].resources.hp).toBe(50);
                expect(state.core.players['1'].tokens.evasive).toBe(0);
            }
            writeFileSync(join(dir,'chain.json'), JSON.stringify({ gameId: 'dicethrone', evidenceCategory: 'tutorial', sourceRun: process.env.TUTORIAL_EVIDENCE_RUN ?? 'tutorial-rebuild-20261016-r19', useChi, records },null,2));
            await page.getByTestId('tutorial-next-button').click();
            await expect(page.locator('[data-tutorial-step]')).toHaveCount(0);
            return;
        }
        if (step.infoStep || step.aiActions?.length) {
            await clickNextOverlayStep(page);
            continue;
        }
        switch (id) {
            case 'tip-inspect': await page.getByTestId('tip-board-magnify-button').click(); break;
            case 'tip-inspect-close': case 'hand-inspect-close':
                await page.getByTestId('board-magnify-overlay-close').click();
                await expect(page.getByTestId('board-magnify-overlay')).toHaveCount(0);
                break;
            case 'hand-inspect': {
                const before = await readTutorialState(page);
                if ((page.viewportSize()?.width ?? 1440) < 1000) {
                    const card = page.locator('[data-card-id="card-deep-thought"]').first();
                    const box = (await card.boundingBox())!;
                    const cdp = await page.context().newCDPSession(page);
                    try {
                        await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
                        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height * 0.82 }] });
                        await page.waitForTimeout(550);
                        await expect(page.getByTestId('board-magnify-overlay')).toBeVisible();
                        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                    } finally { await cdp.detach(); }
                } else await clickHandCardVisibleArea(page, 'card-deep-thought');
                await expect(page.getByTestId('board-magnify-overlay')).toBeVisible();
                const after = await readTutorialState(page);
                expect(after.core.players['0'].hand).toEqual(before.core.players['0'].hand);
                expect(after.core.players['0'].resources.cp).toBe(before.core.players['0'].resources.cp);
                break;
            }
            case 'upgrade-two': await clickHandCardVisibleArea(page, 'card-meditation-2'); break;
            case 'upgrade-three': await clickHandCardVisibleArea(page, 'card-meditation-3'); break;
            case 'straight-advance': case 'straight-resolve': case 'knockdown-enter':
                await page.locator('[data-tutorial-id="advance-phase-button"]').click(); break;
            case 'straight-roll': case 'no-ability-roll': await page.locator('[data-tutorial-id="dice-roll-button"]').click(); break;
            case 'straight-confirm': case 'no-ability-confirm': await page.locator('[data-tutorial-id="dice-confirm-button"]').click(); break;
            case 'no-ability-pass': await page.locator('[data-tutorial-id="advance-phase-button"]').click(); break;
            case 'no-ability-confirm-pass': await page.locator('[data-tutorial-id="skip-ability-confirm"]').click(); break;
            case 'straight-select': await clickAbilitySlot(page, alternate ? 'combo' : 'calm'); break;
            case 'knockdown-choice':
                if (alternate) await page.locator('[data-tutorial-id="advance-phase-button"]').click();
                else await page.getByTestId('dt-player-0-status-knockdown').click();
                break;
            case 'knockdown-pay': await page.locator('[data-tutorial-id="knockdown-pay-button"]').click(); break;
            case 'defense-start': await page.locator('[data-tutorial-id="defense-start-button"]').click(); break;
            case 'sell-card-intro': await dragHandCardToDiscard(page,'card-deep-thought'); break;
            case 'undo-sell': await page.getByTestId('discard-pile').click(); break;
            case 'advance': case 'resolve-attack': case 'end-turn': case 'discard-finish': case 'defense-resolve':
            case 'limit-end': case 'ultimate-advance': case 'ultimate-resolve': case 'damage-advance': case 'damage-resolve':
                await page.locator('[data-tutorial-id="advance-phase-button"]').click(); break;
            case 'dice-roll': case 'dice-reroll': case 'defense-roll':
            case 'ultimate-roll': case 'damage-roll':
                await expect(page.locator('[data-tutorial-id="dice-roll-button"]'), JSON.stringify({ id, phase: live?.sys?.phase, active: live?.core?.activePlayerId, rollCount: live?.core?.rollCount })).toBeEnabled({ timeout: 10000 });
                await page.locator('[data-tutorial-id="dice-roll-button"]').click(); break;
            case 'dice-lock':
                await page.getByTestId('die-button-0').click(); break;
            case 'play-six': await clickHandCardVisibleArea(page,'card-play-six'); break;
            case 'play-six-modify':
                await page.getByTestId('die-button-0').click();
                await finishPlaySixDiceModifyIfNeeded(page); break;
            case 'dice-confirm': case 'defense-confirm': case 'enlightenment-confirm':
            case 'ultimate-confirm': case 'damage-confirm':
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
            case 'evasive-use':
                await page.getByTestId('dt-player-0-token-evasive-hit-target').click();
                break;
            case 'evasive-confirm':
                await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
                break;
            case 'purify-use':
                await page.getByTestId('dt-player-0-token-purify-hit-target').click();
                await expect(page.getByRole('heading', { name: /使用净化|Purify/i }).first()).toBeVisible();
                await page.getByRole('button', { name: /^确认$|^Confirm$/i }).last().click(); break;
            case 'meditation-2': await clickHandCardVisibleArea(page,'card-meditation-2'); break;
            case 'instant-play': await clickHandCardVisibleArea(page,'card-boss-generous'); break;
            case 'interference-play': await clickHandCardVisibleArea(page,'card-give-hand'); break;
            case 'interference-target':
                await page.getByTestId('die-button-0').click();
                break;
            case 'interference-confirm':
                await expect(page.getByTestId('dice-interaction-confirm-button')).toBeVisible();
                await page.getByTestId('dice-interaction-confirm-button').click();
                break;
            case 'interference-pass': await page.getByTestId('dicethrone-response-pass-button').click(); break;
            case 'limit-discard': await clickHandCardVisibleArea(page, live.core.players['0'].hand[Math.floor(live.core.players['0'].hand.length / 2)].id); break;
            case 'ultimate-select': await clickAbilitySlot(page,'ultimate'); break;
            case 'damage-select': await clickAbilitySlot(page,'lightning'); break;
            case 'boost-use': await page.getByTestId('dt-player-0-token-taiji-hit-target').click(); break;
            case 'boost-pass': await page.getByTestId('dicethrone-response-pass-button').click(); break;
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
    for (const manifest of [DiceThroneResponsePractice, DiceThroneDiscardPractice, DiceThroneUltimatePractice, DiceThroneDamagePractice]) {
        test('独立机制练习：' + manifest.id, async ({ page }, testInfo) => {
            await page.setViewportSize({ width: 1440, height: 900 });
            await playTutorial(page,testInfo,true,manifest);
        });
    }
    for (const manifest of [DiceThroneUpgradePractice, DiceThroneStraightPractice, DiceThroneKnockdownPractice]) {
        test('进阶机制练习：' + manifest.id, async ({ page }, testInfo) => {
            await page.setViewportSize({ width: 1440, height: 900 });
            await playTutorial(page, testInfo, true, manifest);
        });
    }
    for (const manifest of [DiceThroneStraightPractice, DiceThroneKnockdownPractice]) {
        test('进阶非推荐分支：' + manifest.id, async ({ page }, testInfo) => {
            await page.setViewportSize({ width: 1440, height: 900 });
            await playTutorial(page, testInfo, true, manifest, true);
        });
    }
});
