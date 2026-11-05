/**
 * DiceThrone 真实教程操作回放：主线、独立机制与合法分支。
 */

import { writeFileSync } from 'node:fs';
import { DiceThroneTutorial } from '../../src/games/dicethrone/tutorial';
import type { TutorialManifest } from '../../src/engine/types';
import { DiceThroneDiscardPractice } from '../../src/games/dicethrone/tutorialPractices';
import { test, expect } from '../framework';
import { createEvidenceScreenshotRun, promoteEvidenceScreenshotRun } from '../framework/evidenceScreenshots';
import { join } from 'node:path';

import { setChineseLocale } from '../helpers/common';
import { disableFabMenu, waitForTutorialBoardReady } from '../helpers/dicethrone';
const MOBILE_LANDSCAPE_VIEWPORT = { width: 936, height: 432 } as const;

type CaptureMode = 'desktop-full' | 'mobile-key' | false;
type TutorialRunOptions = {
    useTaiji: boolean;
    manifest?: TutorialManifest;
    captureMode?: CaptureMode;
    exerciseAbilityRecovery?: boolean;
};

const DESKTOP_SCREENSHOTS: Record<string, { title: string; action: string; description: string; transition: string }> = {
    intro: { title: '开局目标与资源', action: '查看胜利目标与起始资源', description: '胜利目标、先手首回合和起始战斗点数同时可见。', transition: '教程从正式开局进入，先确认胜利目标、首回合收入例外和起始资源。' },
    'double-play': { title: '加倍卡面读法', action: '检查并打出加倍', description: '加倍卡的费用、红色时机标记和抽牌效果与当前手牌同时可见。', transition: '确认胜利目标后，先读第一张要实际使用的卡牌。' },
    'one-throw-play': { title: '发现费用不足', action: '检查并打出一掷千金', description: '冲拳升级费用不足，免费筹费牌及蓝色时机标记可见。', transition: '加倍抽到冲拳升级牌后，当前战斗点数不足，转而选择筹费牌。' },
    'one-throw-confirm': { title: '确认筹费结果', action: '确认一掷千金的骰面', description: '掷出一点后获得一点战斗点数，确认即可支付升级费用。', transition: '打出免费筹费牌并掷出一点，确认后战斗点数足够升级。' },
    'upgrade-card': { title: '支付费用升级', action: '支付费用升级冲拳', description: '升级牌的费用和永久提升效果与原有冲拳技能同屏可见。', transition: '确认筹费结果后，支付两点战斗点数并覆盖原有技能。' },
    'dice-play': { title: '进攻掷骰规则', action: '开始投掷五颗骰子', description: '进攻骰盘与最多两次重掷的提示同时可见。', transition: '完成技能升级并进入进攻阶段，开始说明骰数与重掷次数。' },
    'dice-reroll': { title: '四拳保留与重掷', action: '保留四拳并重掷一颗', description: '四颗拳骰已出现，提示只重掷剩下的一颗。', transition: '首次投掷出现四拳后，按提示保留四颗并重掷最后一颗。' },
    abilities: { title: '选择骰面对应能力', action: '选择冲拳能力', description: '四颗拳骰与亮起的冲拳能力同屏，提示造成八点普通伤害。', transition: '确认重掷结果后，选择当前骰面满足的冲拳能力。' },
    'resolve-attack': { title: '普通攻击进入防御', action: '继续结算对手防御', description: '普通攻击允许防御，伤害尚未立即扣除。', transition: '冲拳发动普通攻击后，进入对手防御结算。' },
    'sell-card-intro': { title: '主要阶段主动卖牌', action: '出售掌击换取战斗点数', description: '主要阶段可以主动出售手牌，掌击与战斗点数区域清楚可见。', transition: '对手完成防御后回到主要阶段，出售掌击为后续响应留出费用。' },
    'response-control': { title: '切换手动响应', action: '开启手动响应', description: '手动响应已启用，之后可由玩家决定出牌或略过。', transition: '主动出售后，先切换响应方式，之后才能亲自决定是否响应。' },
    'end-turn': { title: '弃牌阶段手牌上限', action: '查看上限并结束回合', description: '离开弃牌阶段最多保留六张手牌，当前手牌未超限。', transition: '主要阶段结束后进入弃牌阶段，区分超限强制出售与主动卖牌。' },
    'opponent-roll': { title: '等待对手确认骰面', action: '等待对手完成进攻掷骰', description: '对手的进攻骰已确认，下一步出现可干扰的响应时机。', transition: '结束回合后由对手进攻；确认骰面后才进入干扰机会。' },
    'interference-play': { title: '抬一手的时机与效果', action: '在对手掷骰时打出抬一手', description: '响应提示亮起，抬一手卡及其重掷效果同时可见。', transition: '对手确认骰面后，使用一枚战斗点数干扰其骰面。' },
    'interference-target': { title: '确认重掷目标', action: '选择并确认一颗对手骰', description: '一颗对手骰已选中，确认按钮等待点击。', transition: '打出抬一手后，选择一颗对手骰并确认重掷。' },
    'defense-start': { title: '开始防御', action: '使用僧侣的冥想', description: '对手发动攻击后进入防御，冥想能力和防御入口可见。', transition: '重掷改变对手骰面并完成攻击后，现在轮到自己防御。' },
    'defense-roll': { title: '冥想防御掷骰', action: '投掷并确认四颗防御骰', description: '冥想需要四颗防御骰，提示说明通常只有一次掷骰机会。', transition: '选择冥想后，掷四颗防御骰并确认结果。' },
    'defense-resolve': { title: '获得四个太极', action: '确认防御效果', description: '四个太极标记与待结算伤害同时可见。', transition: '确认四颗太极骰后，防御效果产生四个太极标记。' },
    'opponent-token-response': { title: '响应顺序', action: '等待攻击方完成响应', description: '扣除伤害前由攻击方先响应，之后才轮到防守方。', transition: '防御效果确认后，先等待攻击方决定是否响应。' },
    'token-response': { title: '使用太极减伤', action: '使用一个太极并结束响应', description: '使用一个太极减少一点待受伤害，其余标记仍保留。', transition: '攻击方完成响应后，防守方每个太极可减少一点伤害。' },
    'income-result': { title: '收入阶段', action: '查看收入与抽牌结果', description: '新回合收入增加一点战斗点数并抽到一张牌。', transition: '对手回合与伤害结算结束，进入自己的收入阶段。' },
};

const MOBILE_SCREENSHOT_STEPS = new Set(['double-play']);

const DESKTOP_SCREENSHOT_STEPS = new Set([
    'intro', 'double-play', 'one-throw-play', 'one-throw-confirm', 'upgrade-card',
    'dice-play', 'dice-reroll', 'abilities', 'resolve-attack', 'sell-card-intro',
    'response-control', 'end-turn', 'opponent-roll', 'interference-play', 'interference-target',
    'defense-start', 'defense-roll', 'defense-resolve', 'opponent-token-response', 'token-response', 'income-result',
]);

const readTutorialState = async (page: Parameters<typeof test>[0]['page']) => page.evaluate(() => {
    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
    if (!state) return null;
    // 只跨浏览器传输实际断言的数据，撤回快照和教程检查点留在页面内。
    return {
        core: state.core,
        sys: {
            phase: state.sys.phase,
            responseWindow: state.sys.responseWindow,
            tutorial: { active: state.sys.tutorial.active, stepIndex: state.sys.tutorial.stepIndex, step: state.sys.tutorial.step },
        },
    };
});

const clickNextOverlayStep = async (page: Parameters<typeof test>[0]['page']) => {
    const nextButton = page.getByRole('button', { name: /^(Next|下一步)$/i }).first();
    const beforeStep = await page.locator('[data-tutorial-step]').first().getAttribute('data-tutorial-step');
    await expect(nextButton).toBeVisible({ timeout: 5000 });
    await nextButton.click();
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
    const point = await card.evaluate((target, preferredY) => {
        const rect = target.getBoundingClientRect();
        const xRatios = [0.5, 0.3, 0.7, 0.15, 0.85];
        const yRatios = [...new Set([preferredY, 0.94, 0.72, 0.58, 0.4, 0.22])];
        for (const yPart of yRatios) {
            for (const xPart of xRatios) {
                const x = rect.left + rect.width * xPart;
                const y = rect.top + rect.height * yPart;
                const hit = document.elementFromPoint(x, y);
                if (hit?.closest('[data-card-id]') === target) return { x, y };
            }
        }
        return null;
    }, yRatio);
    if (!point) throw new Error(`手牌 ${cardId} 当前没有可真实点击的露出区域`);
    const { x, y } = point;
    await page.mouse.click(x, y);
};

const longPressHandCard = async (
    page: Parameters<typeof test>[0]['page'],
    cardId: string,
) => {
    const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(card).toBeVisible({ timeout: 10000 });
    const box = await card.boundingBox();
    if (!box) throw new Error(`未能获取长按区域: ${cardId}`);
    const x = box.x + box.width / 2;
    const y = box.y + box.height * 0.82;
    if ((page.viewportSize()?.width ?? 1440) < 1000) {
        const cdp = await page.context().newCDPSession(page);
        try {
            await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
            await page.waitForTimeout(600);
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } finally { await cdp.detach(); }
    } else {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.waitForTimeout(600);
        await page.mouse.up();
    }
    await expect(page.getByTestId('board-magnify-overlay')).toBeVisible();
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

    if ((page.viewportSize()?.width ?? 1440) < 1000) {
        const cdp = await page.context().newCDPSession(page);
        try {
            await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: startY }] });
            for (let i = 1; i <= 5; i++) {
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX + (endX - startX) * i / 5, y: startY + (endY - startY) * i / 5 }] });
            }
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } finally { await cdp.detach(); }
    } else {
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(endX, endY, { steps: 1 });
        await page.mouse.up();
    }
    await page.mouse.move(2, 2);
    await expect(page.getByTestId('board-magnify-overlay')).toHaveCount(0);
};

const clickAbilitySlot = async (
    page: Parameters<typeof test>[0]['page'],
    slotId: string,
) => {
    const slot = page.locator(`[data-ability-slot="${slotId}"]`).first();
    await expect(slot).toBeVisible({ timeout: 10000 });
    await slot.click();
};

/** 完整逐步操作；只有白名单中的独特视觉节点截图。 */
const playTutorial = async (page: Parameters<typeof test>[0]['page'], testInfo: Parameters<typeof test>[1], options: TutorialRunOptions) => {
    const manifest = options.manifest ?? DiceThroneTutorial;
    const useTaiji = options.useTaiji;
    const captureMode = options.captureMode ?? false;
    const exerciseAbilityRecovery = options.exerciseAbilityRecovery ?? false;
    page.setDefaultTimeout(10000);
    page.on('console', message => {
        if (/\[LocalGame\] 命令执行失败|\[TutorialContext\] AI/.test(message.text())) console.log('tutorial-browser-warning', message.text());
    });
    await setChineseLocale(page);
    await page.addInitScript(() => localStorage.setItem('dicethrone:autoResponse', 'false'));
    await page.goto('/play/dicethrone/tutorial/' + manifest.id);
    await waitForTutorialBoardReady(page, 60000);
    await disableFabMenu(page);
    const evidenceRun = captureMode ? await createEvidenceScreenshotRun(testInfo, { requireChineseName: true }) : undefined;
    const records: Array<{ step: string; action: string; screenshot: string; description: string; transition: string }> = [];
    const dir = evidenceRun?.stagingDir;
    let beforeIncome: { cp: number; handSize: number } | undefined;
    const screenshotPlan = captureMode === 'desktop-full'
        ? Object.fromEntries(Object.entries(DESKTOP_SCREENSHOTS).filter(([stepId]) => DESKTOP_SCREENSHOT_STEPS.has(stepId)))
        : captureMode === 'mobile-key'
            ? Object.fromEntries(Object.entries(DESKTOP_SCREENSHOTS).filter(([stepId]) => MOBILE_SCREENSHOT_STEPS.has(stepId)))
            : {};
    const captureStep = async (stepId: string) => {
        const item = screenshotPlan[stepId];
        if (!evidenceRun || !dir || !item) return;
        const filename = String(records.length + 1).padStart(2, '0') + '-' + item.title + '.png';
        await page.screenshot({ path: join(dir, filename), fullPage: false });
        records.push({ step: stepId, action: item.action, screenshot: filename, description: item.description, transition: item.transition });
    };
    const seen = new Set<string>();
    let previousHand = '';
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
        const currentHand = live.core.players['0'].hand.map((card: { id: string }) => card.id).join('|');
        if (currentHand !== previousHand) {
            await expect(page.locator('[data-tutorial-id="hand-area"] [data-card-id][data-is-flipped="false"]')).toHaveCount(0);
            await page.waitForTimeout(650);
            previousHand = currentHand;
        }
        const id = live?.sys?.tutorial?.step?.id ?? (await overlay.getAttribute('data-tutorial-step'))!;
        expect(seen.has(id), '同一步不能卡住: ' + id).toBe(false);
        seen.add(id);
        const step = manifest.steps.find(step => step.id === id)!;
        expect(step, id).toBeDefined();
        // The attacker response is a visible info step with a delayed AI pass.
        // Capture it before the AI action changes the response owner and invalidates this step.
        if (id === 'opponent-token-response') await captureStep(id);
        if (step.aiActions?.length) {
            await expect.poll(async () => {
                const state = await readTutorialState(page);
                return state?.sys?.tutorial?.step?.aiActions?.length ?? 0;
            }, { timeout: 45000 }).toBe(0);
            if ((await readTutorialState(page)).sys.tutorial.step?.id !== id) continue;
        }
        await expect(overlay).toHaveAttribute('data-tutorial-step', id);
        const visibleTutorialCopy = await overlay.innerText();
        expect(visibleTutorialCopy, `${id}: 教程提示不得显示未解析的翻译键`).not.toMatch(/tutorial\.steps\./);
        if (step.highlightTarget) {
            const highlight = page.locator(`[data-tutorial-id="${step.highlightTarget}"], [data-testid="${step.highlightTarget}"]`).first();
            await expect(highlight).toBeVisible();
            if (step.highlightFrame !== 'none') {
                await expect.poll(async () => {
                    const metrics = await readHighlightMetrics(page, step.highlightTarget!);
                    return metrics ? Math.max(metrics.deltaLeft, metrics.deltaTop, metrics.deltaWidth, metrics.deltaHeight) : Infinity;
                }, { timeout: 10000, message: id + ': 等待目标动画与高亮同步' }).toBeLessThanOrEqual(2);
                const metrics = await readHighlightMetrics(page, step.highlightTarget);
                for (const value of [metrics!.deltaLeft, metrics!.deltaTop, metrics!.deltaWidth, metrics!.deltaHeight]) {
                    expect(value, id + ': 高亮必须贴合目标').toBeLessThanOrEqual(2);
                }
            }
        }
        await page.waitForTimeout(350);
        await expect.poll(async () => page.evaluate(selectors => {
            const prompt = document.querySelector('[data-testid="tutorial-overlay-card"]')?.getBoundingClientRect();
            if (!prompt) return Infinity;
            return Math.max(0, ...selectors.flatMap(selector => Array.from(document.querySelectorAll(selector))).map(element => {
                const bounds = element.getBoundingClientRect();
                return Math.max(0, Math.min(prompt.right, bounds.right) - Math.max(prompt.left, bounds.left))
                    * Math.max(0, Math.min(prompt.bottom, bounds.bottom) - Math.max(prompt.top, bounds.top));
            }));
        }, step.avoidOverlapSelectors ?? []), { message: id + ': 教学提示不能遮住资源、当前阶段、骰盘及牌堆读数', timeout: 10000 }).toBeLessThanOrEqual(1);
        if (['dice-play', 'dice-reroll', 'abilities', 'resolve-attack', 'interference-target', 'defense-roll', 'token-response'].includes(id)) {
            const tooltipBox = await page.getByTestId('tutorial-overlay-card').boundingBox();
            const dieBoxes = await page.locator('[data-testid^="die-button-"]').evaluateAll(elements => elements
                .map(element => {
                    const { x, y, width, height } = element.getBoundingClientRect();
                    return { x, y, width, height };
                }));
            expect(tooltipBox, `${id}: 说明浮层必须可见`).not.toBeNull();
            expect(dieBoxes.length, `${id}: 骰面必须可见`).toBeGreaterThan(0);
            const overlapsDice = Boolean(tooltipBox && dieBoxes.some(die =>
                tooltipBox.x < die.x + die.width
                && tooltipBox.x + tooltipBox.width > die.x
                && tooltipBox.y < die.y + die.height
                && tooltipBox.y + tooltipBox.height > die.y));
            expect(overlapsDice, `${id}: 说明浮层不能遮住实际骰面`).toBe(false);
        }
        if (id === 'abilities') {
            const candidates = await page.locator('[data-ability-slot-scope="main-board"][data-can-click="true"]').evaluateAll(elements => {
                const prompt = document.querySelector('[data-testid="tutorial-overlay-card"]')!.getBoundingClientRect();
                return elements.map(element => {
                    const bounds = element.getBoundingClientRect();
                    return { slot: element.getAttribute('data-ability-slot'), overlap:
                        Math.max(0, Math.min(bounds.right, prompt.right) - Math.max(bounds.left, prompt.left))
                        * Math.max(0, Math.min(bounds.bottom, prompt.bottom) - Math.max(bounds.top, prompt.top)) };
                });
            });
            expect(candidates.map(candidate => candidate.slot)).toContain('fist');
            for (const candidate of candidates) expect(candidate.overlap, `合法候选 ${candidate.slot} 需要完整可读`).toBeLessThanOrEqual(1);
        }
        if (id === 'response-control') {
            const toggle = page.getByTestId('auto-response-toggle');
            await expect(toggle).toHaveAttribute('aria-pressed', 'false');
            await toggle.click();
            await expect(toggle).toHaveAttribute('aria-pressed', 'true');
            await captureStep(id);
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
            expect(state.core.players['0'].hand).toHaveLength(6);
        }
        await page.waitForTimeout(350);
        await expect.poll(async () => page.evaluate(() => {
            const prompt = document.querySelector('[data-testid="tutorial-overlay-card"]')?.getBoundingClientRect();
            const hand = document.querySelector('[data-tutorial-id="hand-area"]')?.getBoundingClientRect();
            if (!prompt || !hand || hand.width === 0 || hand.height === 0) return 0;
            return Math.max(0, Math.min(prompt.right, hand.right) - Math.max(prompt.left, hand.left))
                * Math.max(0, Math.min(prompt.bottom, hand.bottom) - Math.max(prompt.top, hand.top));
        }), { message: id + ': 教程提示不能遮住持续可读的手牌' }).toBeLessThanOrEqual(1);
        const copyClipping = await page.getByTestId('tutorial-overlay-content').evaluate(element => {
            const range = document.createRange();
            range.selectNodeContents(element);
            const text = range.getBoundingClientRect();
            const visible = element.getBoundingClientRect();
            return { clipping: Math.max(visible.top - text.top, text.bottom - visible.bottom, visible.left - text.left, text.right - visible.right, 0), text: text.toJSON(), visible: visible.toJSON(), scrollHeight: element.scrollHeight, clientHeight: element.clientHeight };
        });
        expect(copyClipping.clipping, id + ': 教学文字必须完整位于可见边界内 ' + JSON.stringify(copyClipping)).toBeLessThanOrEqual(1);
        if (!['response-control', 'interference-target', 'opponent-token-response'].includes(id)
            && !(id === 'double-play' && captureMode === 'mobile-key')) {
            await captureStep(id);
        }
        if (id === manifest.steps.at(-1)?.id) {
            const state = await readTutorialState(page);
            if (manifest.id === DiceThroneTutorial.id) {
                expect([...seen]).toEqual(expect.arrayContaining([
                    'one-throw-play', 'one-throw-confirm', 'double-play', 'upgrade-card',
                    'dice-play', 'dice-reroll', 'abilities', 'resolve-attack', 'sell-card-intro',
                    'response-control', 'interference-play', 'interference-target',
                    'defense-roll', 'token-response', 'income-result',
                ]));
                expect(state.core.players['0'].abilityLevels['fist-technique']).toBe(2);
                expect(state.core.players['0'].resources.cp).toBeGreaterThanOrEqual(1);
                expect(state.core.pendingAttack ?? null).toBeNull();
                expect(state.core.pendingDamage ?? null).toBeNull();
                expect(state.sys.responseWindow?.current ?? null).toBeNull();
                expect(state.sys.phase).toBe('main1');
                expect(state.core.activePlayerId).toBe('0');
                expect(beforeIncome).toBeDefined();
                expect(state.core.players['0'].resources.cp).toBe(beforeIncome!.cp + 1);
                expect(state.core.players['0'].hand).toHaveLength(beforeIncome!.handSize + 1);
                expect(state.core.players['0'].discard.map((card: { id: string }) => card.id)).toEqual(expect.arrayContaining([
                    'card-one-throw-fortune', 'card-double', 'card-palm-strike', 'card-give-hand',
                ]));
            }
            await page.getByTestId('tutorial-next-button').click();
            await expect(page.locator('[data-tutorial-step]')).toHaveCount(0);
            await expect(page.getByTestId('tutorial-highlight-ring')).toHaveCount(0);
            if (manifest.id === DiceThroneTutorial.id) {
                const exited = await readTutorialState(page);
                expect(exited.sys.tutorial.active).toBe(false);
                await expect(page.locator('[data-tutorial-id="advance-phase-button"]')).toBeEnabled();
            }
            if (evidenceRun && dir) {
                if (captureMode === 'desktop-full') {
                    expect(records.map(record => record.step)).toEqual(Object.keys(screenshotPlan));
                    const filename = String(records.length + 1).padStart(2, '0') + '-教程结束后继续牌桌.png';
                    await page.screenshot({ path: join(dir, filename), fullPage: false });
                    records.push({
                        step: 'completed',
                        action: '退出教程并继续牌桌',
                        screenshot: filename,
                        description: '提示与高亮退场，牌桌仍可操作。',
                        transition: '完成收入阶段后退出教程，确认提示与高亮已消失且对局仍可操作。',
                    });
                    expect(records.map(record => record.step)).toEqual([...Object.keys(screenshotPlan), 'completed']);
                }
                writeFileSync(join(dir, 'chain.json'), JSON.stringify({
                    gameId: 'dicethrone', evidenceCategory: 'tutorial', manifestId: manifest.id,
                    manifestRevision: manifest.revision, viewport: page.viewportSize(), sourceRun: evidenceRun.runId,
                    useTaiji, captureMode, records,
                }, null, 2));
                const stableDir = await promoteEvidenceScreenshotRun(evidenceRun, {
                    gameId: 'dicethrone', evidenceCategory: 'tutorial',
                    media: records.map((record, index) => ({
                        path: record.screenshot,
                        chainId: `${manifest.id}-${page.viewportSize()!.width}-${useTaiji ? 'taiji' : 'pass'}`,
                        chainStep: index + 1,
                        stage: index === 0 ? '前态' : index === records.length - 1 ? '后态' : '中态',
                        role: 'main-flow' as const,
                        viewport: (page.viewportSize()!.width < 1000 ? 'mobile' : 'desktop') as 'mobile' | 'desktop',
                        transition: record.transition,
                        description: record.description,
                    })),
                });
                console.log('tutorial-evidence-dir', stableDir);
                console.log('tutorial-evidence-count', records.length);
            }
            return;
        }
        if (step.infoStep || (step.aiActions?.length && !step.requireAction)) {
            await clickNextOverlayStep(page);
            continue;
        }
        switch (id) {
            case 'one-throw-play':
                await clickHandCardVisibleArea(page, 'card-one-throw-fortune');
                await expect.poll(async () => (await readTutorialState(page)).core.pendingBonusDiceSettlement).toBeTruthy();
                break;
            case 'one-throw-confirm':
                await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
                await expect.poll(async () => (await readTutorialState(page)).core.players['0'].resources.cp).toBe(2);
                break;
            case 'double-play': {
                const before = await readTutorialState(page);
                if ((page.viewportSize()?.width ?? 1440) < 1000) {
                    await longPressHandCard(page, 'card-double');
                    await expect.poll(async () => page.evaluate(() => {
                        const card = document.querySelector('[data-testid="board-magnify-overlay"] > div')?.getBoundingClientRect();
                        const prompt = document.querySelector('[data-testid="tutorial-overlay-card"]')?.getBoundingClientRect();
                        if (!card || !prompt) return Infinity;
                        return Math.max(0, Math.min(card.right, prompt.right) - Math.max(card.left, prompt.left))
                            * Math.max(0, Math.min(card.bottom, prompt.bottom) - Math.max(card.top, prompt.top));
                    }), { message: '长按读牌时，卡面与提示须同时完整可读', timeout: 10000 }).toBeLessThanOrEqual(1);
                    await expect(page.locator('[data-tutorial-step]').first()).toHaveAttribute('data-tutorial-step', id);
                    const afterInspect = await readTutorialState(page);
                    expect(afterInspect.core.players['0'].hand).toEqual(before.core.players['0'].hand);
                    expect(afterInspect.core.players['0'].resources.cp).toBe(before.core.players['0'].resources.cp);
                    await captureStep(id);
                    await page.getByTestId('board-magnify-overlay-close').click();
                    await expect(page.getByTestId('board-magnify-overlay')).toHaveCount(0);
                }
                await clickHandCardVisibleArea(page, 'card-double');
                await expect.poll(async () => (await readTutorialState(page)).core.players['0'].resources.cp).toBe(1);
                expect((await readTutorialState(page)).core.players['0'].hand.map((card: { id: string }) => card.id))
                    .toEqual(expect.arrayContaining(['card-thrust-punch-2', 'card-inner-peace']));
                break;
            }
            case 'upgrade-card': {
                await clickHandCardVisibleArea(page, 'card-thrust-punch-2');
                await expect.poll(async () => (await readTutorialState(page)).core.players['0'].abilityLevels['fist-technique']).toBe(2);
                expect((await readTutorialState(page)).core.players['0'].resources.cp).toBe(0);
                break;
            }
            case 'advance':
            case 'resolve-attack':
                await page.locator('[data-tutorial-id="advance-phase-button"]').click();
                break;
            case 'dice-play': {
                const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
                await expect(rollButton).toBeEnabled();
                await rollButton.click();
                await expect.poll(async () => (await readTutorialState(page)).core.dice.map((die: { value: number }) => die.value))
                    .toEqual([1, 1, 1, 1, 3]);
                break;
            }
            case 'dice-reroll': {
                const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
                await expect(rollButton).toBeEnabled();
                for (const dieId of [0, 1, 2, 3]) await page.getByTestId('die-button-' + dieId).click();
                await rollButton.click();
                const rerolled = await readTutorialState(page);
                expect(rerolled.core.dice.map((die: { value: number }) => die.value)).toEqual([1, 1, 1, 1, 4]);
                expect(rerolled.core.dice.slice(0, 4).every((die: { isKept: boolean }) => die.isKept)).toBe(true);
                await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
                break;
            }
            case 'abilities': {
                if (exerciseAbilityRecovery) {
                    const before = await readTutorialState(page);
                    await page.locator('[data-tutorial-id="advance-phase-button"]').click();
                    await page.getByRole('button', { name: '确定结束', exact: true }).click();
                    await expect(page.getByRole('button', { name: '确定结束', exact: true })).toHaveCount(0);
                    await expect.poll(async () => (await readTutorialState(page)).sys.tutorial.step.id, {
                        timeout: 15000,
                        message: '合法地跳过能力后应恢复到相同能力选择',
                    }).toBe('abilities');
                    const restored = await readTutorialState(page);
                    expect(restored.sys.phase).toBe('offensiveRoll');
                    expect(restored.core.dice).toEqual(before.core.dice);
                }
                await clickAbilitySlot(page, 'fist');
                break;
            }
            case 'sell-card-intro':
                await dragHandCardToDiscard(page, 'card-palm-strike');
                await expect.poll(async () => (await readTutorialState(page)).core.players['0'].resources.cp).toBe(1);
                break;
            case 'end-turn':
                await page.locator('[data-tutorial-id="advance-phase-button"]').click();
                break;
            case 'interference-play':
                await clickHandCardVisibleArea(page, 'card-give-hand');
                await expect.poll(async () => (await readTutorialState(page)).core.players['0'].resources.cp).toBe(0);
                break;
            case 'interference-target': {
                await page.getByTestId('die-button-0').click();
                await expect(page.getByTestId('dice-interaction-confirm-button')).toBeVisible();
                await expect(page.locator('[data-tutorial-step]').first()).toHaveAttribute('data-tutorial-step', id);
                await captureStep(id);
                await page.getByTestId('dice-interaction-confirm-button').click();
                const rerollEvents = await page.evaluate(() => {
                    const entries = (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.eventStream?.entries ?? [];
                    return entries.map((entry: any) => entry.event).filter((event: any) => (
                        event?.type === 'DIE_REROLLED' && event.payload?.sourceCardId === 'card-give-hand'
                    )).map((event: any) => ({ type: event.type, payload: event.payload }));
                });
                expect(rerollEvents).toContainEqual(expect.objectContaining({
                    type: 'DIE_REROLLED',
                    payload: expect.objectContaining({ dieId: 0, newValue: 6, playerId: '0', sourceCardId: 'card-give-hand' }),
                }));
                if ((page.viewportSize()?.width ?? 1440) >= 1000) await page.mouse.move(10, 10);
                break;
            }
            case 'defense-start':
                await page.locator('[data-tutorial-id="defense-start-button"]').click();
                break;
            case 'defense-roll': {
                const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
                await expect(rollButton).toBeEnabled();
                await rollButton.click();
                await expect.poll(async () => (await readTutorialState(page)).core.dice.filter((die: { isKept: boolean }) => !die.isKept).length)
                    .toBe(4);
                const defenseResult = await readTutorialState(page);
                expect(defenseResult.core.dice.filter((die: { isKept: boolean }) => !die.isKept)
                    .every((die: { symbol: string }) => die.symbol === 'taiji')).toBe(true);
                expect(defenseResult.core.dice.filter((die: { isKept: boolean }) => die.isKept)).toHaveLength(1);
                await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
                break;
            }
            case 'defense-resolve':
                await page.locator('[data-tutorial-id="advance-phase-button"]').click();
                break;
            case 'token-response': {
                const before = await readTutorialState(page);
                expect(before.core.pendingDamage.responderId).toBe('0');
                beforeIncome = {
                    cp: before.core.players['0'].resources.cp,
                    handSize: before.core.players['0'].hand.length,
                };
                if (useTaiji) {
                    await page.getByTestId('dt-player-0-token-taiji-hit-target').click();
                    await expect.poll(async () => (await readTutorialState(page)).core.players['0'].tokens.taiji)
                        .toBe(before.core.players['0'].tokens.taiji - 1);
                }
                await page.getByTestId('dicethrone-response-pass-button').click();
                await expect.poll(async () => (await readTutorialState(page)).core.pendingDamage).toBeUndefined();
                break;
            }
            case 'limit-start':
                await expect(page.locator('[data-tutorial-id="hand-area"] [data-card-id][data-is-flipped="false"]')).toHaveCount(0);
                await page.waitForTimeout(650);
                await clickHandCardVisibleArea(page, live.core.players['0'].hand[Math.floor(live.core.players['0'].hand.length / 2)].id);
                break;
            default:
                throw Error('未实现真实操作: ' + id);
        }
        await expect.poll(async () => page.locator('[data-tutorial-step]').first().getAttribute('data-tutorial-step'), { timeout: 30000 }).not.toBe(id);
    }
    throw Error('教程没有到达结束步骤');
};

test.describe('DiceThrone 完整双人教学主线', () => {
    test.setTimeout(600000);
    test('桌面：完整主线，精选关键节点截图', async ({ page }, testInfo) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await playTutorial(page, testInfo, { useTaiji: true, captureMode: 'desktop-full' });
    });
    test('合法跳过能力后恢复相同骰面', async ({ page }, testInfo) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await playTutorial(page, testInfo, { useTaiji: true, exerciseAbilityRecovery: true });
    });
    test('手机横屏：完整主线，精选关键界面截图', async ({ page }, testInfo) => {
        await page.setViewportSize(MOBILE_LANDSCAPE_VIEWPORT);
        await playTutorial(page, testInfo, { useTaiji: true, captureMode: 'mobile-key' });
    });
    test('合法放弃太极后仍可完成后续对局', async ({ page }, testInfo) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await playTutorial(page, testInfo, { useTaiji: false });
    });
    for (const manifest of [DiceThroneDiscardPractice]) {
        test('独立机制练习：' + manifest.id, async ({ page }, testInfo) => {
            await page.setViewportSize({ width: 1440, height: 900 });
            await playTutorial(page, testInfo, { useTaiji: true, manifest });
        });
    }
});
