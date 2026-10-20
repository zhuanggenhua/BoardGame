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
import { expectRightTrayBonusDiceConfirmation } from './bonus-dice-flow';



const MOBILE_LANDSCAPE_VIEWPORT = { width: 936, height: 432 } as const;

const SCREENSHOT_TITLES: Record<string, string> = {
    intro: '胜负目标', stats: '体力与战斗点数', phases: '先手首回合', 'hand-inspect': '长按读牌入口',
    'main-actions-rule': '主要阶段行动', 'sell-card-intro': '出售筹备费用',
    'enlightenment-play': '蓝框牌准备标记', 'enlightenment-confirm': '确认奖励骰', 'status-tokens': '状态标记读法',
    advance: '进入进攻掷骰', 'dice-roll': '首次掷骰', 'dice-lock': '锁住保留骰', 'dice-reroll': '重掷其余骰',
    'dice-confirm': '确认进攻骰', 'ability-rule': '能力启动条件', abilities: '选择合法能力', 'attack-rule': '攻击与伤害类型',
    'resolve-attack': '发动攻击', 'opponent-defense': '对手防御骰结果',
    'opponent-defense-response-rule': '攻击方响应时机', 'opponent-defense-response-pass': '放弃牌响应',
    'opponent-defense-resolve': '防御结算与攻击修正', 'attack-token-pass': '保留太极结束攻击',
    'main2-return': '返回主要阶段', 'double-play': '即时牌抽牌', 'draw-result': '保留升级与响应预算',
    'discard-rule': '回合末手牌限制', 'end-turn': '结束自己的回合', 'response-control': '切换手动响应',
    'ai-turn': '对手出牌并确认攻击骰', 'interference-play': '掷骰牌介入', 'interference-target': '选择改骰目标',
    'interference-confirm': '确认重掷目标骰', 'interference-result': '改骰后的能力集合', 'response-finish': '对手按新结果选能力',
    'defense-start': '进入自己的防御', 'defense-rule': '防御骰的计数读法', 'defense-roll': '亲手掷防御骰',
    'defense-confirm': '确认防御骰', 'defense-resolve': '结算清修与叠加上限', 'token-response-rule': '伤害前减伤时机',
    'token-response-use': '使用太极或放弃', 'evasive-rule': '闪避规则', 'evasive-use': '消耗闪避',
    'evasive-confirm': '确认闪避骰', 'token-response-pass': '结束伤害响应', 'opponent-end-turn': '对手交接回合',
    'income-result': '收入后费用足够升级', 'knockdown-explain': '击倒的处理选择', 'purify-rule': '净化的用途',
    'purify-use': '净化保留进攻与费用', 'purify-result': '击倒已移除', 'upgrade-rule': '升级费用与限制',
    'meditation-2': '打出清修升级', 'upgrade-result': '升级留在技能槽', finish: '教学完成',
    'limit-start': '超限手牌出售决策', 'limit-result': '出售后到达资源上限', 'limit-end': '弃牌完成交接',
    'limit-opponent': '对手回合结束', 'reshuffle-result': '空牌库重洗并抽牌', 'limit-finish': '下次回合末处理超限',
};

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

/** 从真实教程入口逐步操作；每张提示卡取当前画面，禁止用 dispatch 代替玩家点击。 */
const playTutorial = async (page: Parameters<typeof test>[0]['page'], testInfo: Parameters<typeof test>[1], useChi: boolean, manifest: TutorialManifest = DiceThroneTutorial, abilitySlot = 'combo') => {
    page.setDefaultTimeout(10000);
    page.on('console', message => {
        if (/\[LocalGame\] 命令执行失败|\[TutorialContext\] AI/.test(message.text())) console.log('tutorial-browser-warning', message.text());
    });
    await setChineseLocale(page);
    await page.addInitScript(() => localStorage.setItem('dicethrone:autoResponse', 'false'));
    await page.goto('/play/dicethrone/tutorial/' + manifest.id);
    await waitForTutorialBoardReady(page, 60000);
    await disableFabMenu(page);
    const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const records: Array<{ step: string; action: string; screenshot: string; description: string }> = [];
    const dir = evidenceRun.stagingDir;
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
        console.log('tutorial-live-step', JSON.stringify({ id, phase: live?.sys?.phase, active: live?.core?.activePlayerId, turn: live?.core?.turnNumber, rollCount: live?.core?.rollCount, confirmed: live?.core?.rollConfirmed, attack: live?.core?.pendingAttack?.sourceAbilityId, aiCount: live?.sys?.tutorial?.step?.aiActions?.length }));
        if (id === 'double-play') {
            const stateBytes = await page.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__.state.get();
                const encoder = new TextEncoder();
                return { full: encoder.encode(JSON.stringify(state)).byteLength, core: encoder.encode(JSON.stringify(state.core)).byteLength };
            });
            console.log('tutorial-state-transfer-bytes', JSON.stringify(stateBytes));
        }
        if (step.aiActions?.length) {
            await expect.poll(async () => {
                const state = await readTutorialState(page);
                return state?.sys?.tutorial?.step?.aiActions?.length ?? 0;
            }, { timeout: 45000 }).toBe(0);
        }
        await expect(overlay).toHaveAttribute('data-tutorial-step', id);
        const visibleTutorialCopy = await overlay.innerText();
        expect(visibleTutorialCopy, `${id}: 教程提示不得显示未解析的翻译键`).not.toMatch(/tutorial\.steps\./);
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
        if (id === 'ability-rule' || id === 'abilities' || id === 'attack-rule') {
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
        if (id === 'ability-rule' && manifest.id === DiceThroneTutorial.id) {
            const faces = await page.locator('[data-testid^="die-button-"]').evaluateAll(elements => elements
                .map(element => Number(element.getAttribute('data-display-value'))).sort((left, right) => left - right));
            expect(faces).toEqual([1, 2, 3, 4, 5]);
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
            expect(candidates.map(candidate => candidate.slot).sort()).toEqual(['calm', 'combo']);
            for (const candidate of candidates) expect(candidate.overlap, `合法候选 ${candidate.slot} 需要完整可读`).toBeLessThanOrEqual(1);
        }
        if (id === 'interference-result' && manifest.id === DiceThroneTutorial.id) {
            const faces = await page.locator('[data-testid^="die-button-"]').evaluateAll(elements => elements
                .map(element => Number(element.getAttribute('data-display-value'))).sort((left, right) => left - right));
            expect(faces).toEqual([1, 1, 1, 1, 6]);
            expect(live?.core?.players?.['0']?.resources?.cp).toBe(1);
        }
        if (id === 'response-control') {
            const toggle = page.getByTestId('auto-response-toggle');
            await expect(toggle).toHaveAttribute('aria-pressed', 'false');
            await toggle.click();
            await expect(toggle).toHaveAttribute('aria-pressed', 'true');
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
        const description = '牌桌提示：' + (await page.getByTestId('tutorial-overlay-content').innerText()).replace(/CP/g, '战斗点数').replace(/III/g, '三级').replace(/II/g, '二级').replace(/IV/g, '四级').replace(/V/g, '五级').replace(/[A-Za-z]/g, '').split(/[。！？\n]/)[0] + '。';
        expect(SCREENSHOT_TITLES[id], '每张图都要有玩家可读的节点名称').toBeTruthy();
        const filename = String(i + 1).padStart(2,'0') + '-' + SCREENSHOT_TITLES[id] + '.png';
        await page.screenshot({ path: join(dir, filename), fullPage: false });
        records.push({ step: id, action: id === 'response-control' ? '确认使用手动响应' : step.infoStep || step.aiActions ? '阅读当前规则或公开结果' : '操作正式入口', screenshot: filename, description });
        if (id === manifest.steps.at(-1)?.id) {
            const state = await readTutorialState(page);
            if (manifest.id === DiceThroneTutorial.id) {
                expect(seen.has('defense-roll')).toBe(true);
                expect(seen.has('token-response-use')).toBe(true);
                expect(seen.has('enlightenment-play')).toBe(true);
                expect(seen.has('enlightenment-confirm')).toBe(true);
                expect(seen.has('double-play')).toBe(true);
                expect(seen.has('purify-use')).toBe(true);
                expect(seen.has('interference-play')).toBe(true);
                expect(state.core.players['0'].abilityLevels.meditation).toBe(2);
                expect(state.core.players['0'].statusEffects.knockdown ?? 0).toBe(0);
                expect(state.sys.responseWindow.current).toBeUndefined();
                expect(state.core.players['0'].discard.map((card: { id: string }) => card.id)).toEqual(expect.arrayContaining(['card-enlightenment', 'card-double', 'card-palm-strike', 'card-give-hand']));
            }
            await page.getByTestId('tutorial-next-button').click();
            await expect(page.locator('[data-tutorial-step]')).toHaveCount(0);
            await expect(page.getByTestId('tutorial-highlight-ring')).toHaveCount(0);
            const closingScreenshot = '99-完成后继续牌桌.png';
            await page.screenshot({ path: join(dir, closingScreenshot), fullPage: false });
            records.push({ step: 'completed', action: '结束教学后继续真实对局', screenshot: closingScreenshot, description: '玩家结束教学，提示和高亮退场，完整牌桌继续可操作。' });
            writeFileSync(join(dir,'chain.json'), JSON.stringify({ gameId: 'dicethrone', evidenceCategory: 'tutorial', manifestId: manifest.id, manifestRevision: manifest.revision, viewport: page.viewportSize(), sourceRun: evidenceRun.runId, useChi, records },null,2));
            const stableDir = await promoteEvidenceScreenshotRun(evidenceRun, {
                gameId: 'dicethrone', evidenceCategory: 'tutorial',
                media: records.map((record, index) => ({ path: record.screenshot, chainId: `${manifest.id}-${page.viewportSize()!.width}-${useChi ? 'intervene' : 'pass'}-${abilitySlot}`, chainStep: index + 1, stage: index === 0 ? '前态' : index === records.length - 1 ? '后态' : '中态', description: record.description })),
            });
            console.log('tutorial-evidence-dir', stableDir);
            return;
        }
        if (step.infoStep || step.aiActions?.length) {
            await clickNextOverlayStep(page);
            continue;
        }
        switch (id) {
            case 'hand-inspect': {
                await expect(page.getByTestId('tutorial-overlay-content')).toContainText('左上是 CP 费用，彩框标出出牌时机，正文写效果');
                const before = await readTutorialState(page);
                if ((page.viewportSize()?.width ?? 1440) < 1000) {
                    const card = page.locator('[data-card-id="card-enlightenment"]').first();
                    const box = (await card.boundingBox())!;
                    const cdp = await page.context().newCDPSession(page);
                    try {
                        await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
                        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height * 0.82 }] });
                        await page.waitForTimeout(550);
                        await expect(page.getByTestId('board-magnify-overlay')).toBeVisible();
                        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                    } finally { await cdp.detach(); }
                } else {
                    const box = (await page.locator('[data-card-id="card-enlightenment"]').first().boundingBox())!;
                    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.82);
                    await page.mouse.down();
                    await page.waitForTimeout(550);
                    await page.mouse.up();
                }
                await expect(page.getByTestId('board-magnify-overlay')).toBeVisible();
                await expect.poll(async () => page.evaluate(() => {
                    const card = document.querySelector('[data-testid="board-magnify-overlay"] > div')?.getBoundingClientRect();
                    const prompt = document.querySelector('[data-testid="tutorial-overlay-card"]')?.getBoundingClientRect();
                    if (!card || !prompt) return Infinity;
                    return Math.max(0, Math.min(card.right, prompt.right) - Math.max(card.left, prompt.left))
                        * Math.max(0, Math.min(card.bottom, prompt.bottom) - Math.max(card.top, prompt.top));
                }), { message: '长按读牌时，放大卡面与教学提示必须同时完整可读', timeout: 10000 }).toBeLessThanOrEqual(1);
                await expect(page.locator('[data-tutorial-step]').first()).toHaveAttribute('data-tutorial-step', id);
                const after = await readTutorialState(page);
                expect(after.core.players['0'].hand).toEqual(before.core.players['0'].hand);
                expect(after.core.players['0'].resources.cp).toBe(before.core.players['0'].resources.cp);
                const inspectFilename = String(i + 1).padStart(2, '0') + '-长按读牌.png';
                await page.screenshot({ path: join(dir, inspectFilename), fullPage: false });
                records.push({ step: id, action: '长按打开手牌详情；确认手牌和 CP 未变化', screenshot: inspectFilename, description: '玩家长按顿悟打开完整卡面，费用、彩框和效果正文可供读取。' });
                await page.getByTestId('board-magnify-overlay-close').click();
                await expect(page.getByTestId('board-magnify-overlay')).toHaveCount(0);
                await expect.poll(async () => page.locator('[data-tutorial-step]').first().getAttribute('data-tutorial-step')).toBe('main-actions-rule');
                break;
            }
            case 'defense-start': await page.locator('[data-tutorial-id="defense-start-button"]').click(); break;
            case 'sell-card-intro': {
                const before = await readTutorialState(page);
                await dragHandCardToDiscard(page, 'card-meditation-2');
                await expect.poll(async () => (await readTutorialState(page)).core.players['0'].resources.cp).toBe(2);
                const undoFilename = String(i + 1).padStart(2, '0') + '-撤回出售决策.png';
                await page.screenshot({ path: join(dir, undoFilename), fullPage: false });
                records.push({ step: 'sale-undo', action: '保留清修用于升级，点击弃牌堆撤回出售', screenshot: undoFilename, description: '清修升级牌已出售，战斗点数从一变二；可点弃牌堆撤回以保留升级来源。' });
                await page.getByTestId('discard-pile').click();
                const undoStartedAt = Date.now();
                await expect.poll(async () => (await readTutorialState(page)).sys.tutorial.step.id, {
                    timeout: 15000,
                    message: '等待正式撤回与教程完整检查点同步完成',
                }).toBe('sell-card-intro');
                console.log('tutorial-sale-undo-ms', Date.now() - undoStartedAt);
                const restored = await readTutorialState(page);
                expect(restored.core.players['0'].hand.map((card: { id: string }) => card.id).sort()).toEqual(before.core.players['0'].hand.map((card: { id: string }) => card.id).sort());
                expect(restored.core.players['0'].resources.cp).toBe(before.core.players['0'].resources.cp);
                await dragHandCardToDiscard(page, 'card-palm-strike');
                await expect.poll(async () => (await readTutorialState(page)).core.players['0'].resources.cp).toBe(2);
                expect((await readTutorialState(page)).core.players['0'].hand.map((card: { id: string }) => card.id)).toContain('card-meditation-2');
                break;
            }
            case 'enlightenment-play': {
                await clickHandCardVisibleArea(page, 'card-enlightenment');
                await expect.poll(async () => (await readTutorialState(page)).core.pendingBonusDiceSettlement).toBeTruthy();
                break;
            }
            case 'enlightenment-confirm':
                await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
                await expect.poll(async () => (await readTutorialState(page)).core.players['0'].tokens).toMatchObject({ taiji: 2, evasive: 1, purify: 1 });
                break;
            case 'advance': case 'resolve-attack': case 'end-turn': case 'defense-resolve': case 'limit-end':
                await page.locator('[data-tutorial-id="advance-phase-button"]').click(); break;
            case 'dice-roll': case 'dice-reroll': case 'defense-roll':
                await expect(page.locator('[data-tutorial-id="dice-roll-button"]'), JSON.stringify({ id, phase: live?.sys?.phase, active: live?.core?.activePlayerId, rollCount: live?.core?.rollCount })).toBeEnabled({ timeout: 10000 });
                await page.locator('[data-tutorial-id="dice-roll-button"]').click(); break;
            case 'dice-lock':
                await page.getByTestId('die-button-0').click(); break;
            case 'dice-confirm': case 'defense-confirm':
                await page.locator('[data-tutorial-id="dice-confirm-button"]').click(); break;
            case 'abilities': {
                const before = await readTutorialState(page);
                await page.locator('[data-tutorial-id="advance-phase-button"]').click();
                await page.getByRole('button', { name: '确定结束', exact: true }).click();
                await expect(page.getByRole('button', { name: '确定结束', exact: true })).toHaveCount(0);
                const recoveryStartedAt = Date.now();
                await expect.poll(async () => (await readTutorialState(page)).sys.tutorial.step.id, {
                    timeout: 15000,
                    message: '正式跳过攻击后，等待隐藏恢复动作完成并回到能力选择',
                }).toBe('abilities');
                console.log('tutorial-branch-recovery-ms', Date.now() - recoveryStartedAt);
                const restored = await readTutorialState(page);
                expect(restored.sys.phase).toBe('offensiveRoll');
                expect(restored.core.dice).toEqual(before.core.dice);
                await clickAbilitySlot(page, abilitySlot);
                break;
            }
            case 'double-play': {
                await clickHandCardVisibleArea(page, 'card-double');
                await expect.poll(async () => (await readTutorialState(page)).core.players['0'].resources.cp).toBe(1);
                expect((await readTutorialState(page)).core.players['0'].hand.map((card: { id: string }) => card.id)).toContain('card-meditation-2');
                break;
            }
            case 'attack-token-pass': case 'token-response-pass':
                await page.getByTestId('dicethrone-response-pass-button').click(); break;
            case 'opponent-defense-response-pass':
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
            case 'evasive-use': await page.getByTestId('dt-player-0-token-evasive-hit-target').click(); break;
            case 'evasive-confirm': await page.locator('[data-tutorial-id="dice-confirm-button"]').click(); break;
            case 'purify-use':
                await page.getByTestId('dt-player-0-token-purify-hit-target').click();
                await expect(page.getByRole('heading', { name: /使用净化|Purify/i }).first()).toBeVisible();
                await page.getByRole('button', { name: /^确认$|^Confirm$/i }).last().click(); break;
            case 'meditation-2': await clickHandCardVisibleArea(page,'card-meditation-2'); break;
            case 'interference-play': await clickHandCardVisibleArea(page,'card-give-hand'); break;
            case 'interference-target':
                await page.getByTestId('die-button-0').click();
                break;
            case 'interference-confirm':
                await expect(page.getByTestId('dice-interaction-confirm-button')).toBeVisible();
                await page.getByTestId('dice-interaction-confirm-button').click();
                break;
            case 'limit-start':
                await expect(page.locator('[data-tutorial-id="hand-area"] [data-card-id][data-is-flipped="false"]')).toHaveCount(0);
                await page.waitForTimeout(650);
                await clickHandCardVisibleArea(page, live.core.players['0'].hand[Math.floor(live.core.players['0'].hand.length / 2)].id);
                break;
            default: throw Error('未实现真实操作: ' + id);
        }
        await expect.poll(async () => page.locator('[data-tutorial-step]').first().getAttribute('data-tutorial-step'), { timeout: 30000 }).not.toBe(id);
    }
    throw Error('教程没有到达结束步骤');
};

test.describe('DiceThrone 完整双人教学主线', () => {
    test.setTimeout(900000);
    test('桌面：锁骰重掷、选择小顺并亲手防御', async ({ page }, testInfo) => {
        // 全步截图与动画收口可能超过十分钟，各操作仍独立受短等待断言保护。
        test.setTimeout(900000);
        await page.setViewportSize({ width: 1440, height: 900 });
        await playTutorial(page,testInfo,true);
    });
    test('同一主线的大小顺分支：选择大顺', async ({ page }, testInfo) => {
        test.setTimeout(900000);
        await page.setViewportSize({ width: 1440, height: 900 });
        await playTutorial(page,testInfo,true,DiceThroneTutorial,'calm');
    });
    test('手机横屏：亲手完成教学主线', async ({ page }, testInfo) => {
        await page.setViewportSize(MOBILE_LANDSCAPE_VIEWPORT);
        await playTutorial(page,testInfo,true);
    });
    test('响应分支：直接放弃后仍可结算并完成后续教学', async ({ page }, testInfo) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await playTutorial(page,testInfo,false);
    });
    for (const manifest of [DiceThroneDiscardPractice]) {
        test('独立机制练习：' + manifest.id, async ({ page }, testInfo) => {
            await page.setViewportSize({ width: 1440, height: 900 });
            await playTutorial(page,testInfo,true,manifest);
        });
    }
});
