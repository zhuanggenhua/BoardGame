/**
 * SmashUp E2E 测试状态构造器
 * 
 * 提供通用的状态注入工具，用于快速构造测试场景。
 * 
 * 核心原则：
 * 1. 跳过所有前置步骤，直接构造目标场景
 * 2. 精确控制随机性，确保测试结果可预测
 * 3. 通用化工具函数，所有测试都能复用
 */

import type { Page } from '@playwright/test';

/**
 * 等待测试工具就绪
 */
export async function waitForTestHarness(page: Page, timeout = 10000): Promise<void> {
    await page.waitForFunction(
        () => !!(window as any).__BG_TEST_HARNESS__,
        { timeout }
    );
}

/**
 * 卡牌定义（简化版，只包含测试需要的字段）
 */
interface CardDef {
    uid: string;
    defId: string;
    type: 'minion' | 'action';
}

/**
 * 场景构造选项
 */
interface SceneOptions {
    /** 玩家 ID */
    playerId: string;
    /** 手牌（defId 数组） */
    hand?: string[];
    /** 牌库（defId 数组） */
    deck?: string[];
    /** 弃牌堆（defId 数组） */
    discard?: string[];
    /** 当前回合玩家 */
    currentPlayer?: string;
    /** 回合阶段 */
    phase?: string;
    /** 随机数队列 */
    randomQueue?: number[];
}

/**
 * 构造基础场景：玩家手牌中有指定卡牌
 * 
 * @param page Playwright Page 对象
 * @param options 场景选项
 * 
 * @example
 * ```typescript
 * await buildScene(page, {
 *   playerId: 'p1',
 *   hand: ['wizard_portal', 'wizard_familiar'],
 *   deck: ['wizard_archmage', 'wizard_chronomage', 'wizard_enchantress', 'action_time_loop', 'action_disintegrate'],
 *   currentPlayer: 'p1',
 *   phase: 'play',
 *   randomQueue: [0.5, 0.5, 0.5] // 控制随机数
 * });
 * ```
 */
export async function buildScene(page: Page, options: SceneOptions): Promise<void> {
    await waitForTestHarness(page);

    await page.evaluate((opts) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        if (!harness) throw new Error('TestHarness not available');

        // 1. 设置随机数队列（如果提供）
        if (opts.randomQueue) {
            harness.random.setQueue(opts.randomQueue);
        }

        // 2. 获取当前状态
        const state = harness.state.get();
        if (!state) throw new Error('State not available');

        // 3. 生成卡牌 UID（使用时间戳 + 索引确保唯一性）
        const now = Date.now();
        const generateUid = (defId: string, index: number) => `${defId}_${now}_${index}`;

        // 4. 推断卡牌类型（基于 defId 前缀）
        const inferCardType = (defId: string): 'minion' | 'action' => {
            if (defId.startsWith('action_')) return 'action';
            // SmashUp 的随从通常以派系名开头（如 wizard_archmage）
            return 'minion';
        };

        // 5. 构造手牌
        const hand = (opts.hand || []).map((defId, i) => ({
            uid: generateUid(defId, i),
            defId,
            type: inferCardType(defId),
        }));

        // 6. 构造牌库
        const deck = (opts.deck || []).map((defId, i) => ({
            uid: generateUid(defId, i + 1000),
            defId,
            type: inferCardType(defId),
        }));

        // 7. 构造弃牌堆
        const discard = (opts.discard || []).map((defId, i) => ({
            uid: generateUid(defId, i + 2000),
            defId,
            type: inferCardType(defId),
        }));

        // 8. 更新玩家状态
        const playerPatch: any = {};
        playerPatch[opts.playerId] = {
            hand,
            deck,
            discard,
        };

        // 9. 应用状态补丁
        const patch: any = {
            core: {
                players: playerPatch,
            },
        };

        // 10. 设置当前玩家和阶段（如果提供）
        if (opts.currentPlayer !== undefined) {
            patch.core.currentPlayer = opts.currentPlayer;
        }
        if (opts.phase !== undefined) {
            patch.core.phase = opts.phase;
        }

        harness.state.patch(patch);
    }, options);

    // 等待 React 重新渲染
    await page.waitForTimeout(500);
}

/**
 * 打出指定卡牌
 * 
 * @param page Playwright Page 对象
 * @param cardDefId 卡牌 defId（如 'wizard_portal'）
 * @param options 额外选项
 * 
 * @example
 * ```typescript
 * await playCard(page, 'wizard_portal', { targetBaseIndex: 0 });
 * ```
 */
export async function playCard(
    page: Page,
    cardDefId: string,
    options?: {
        targetBaseIndex?: number;
        targetMinionUid?: string;
    }
): Promise<void> {
    // 1. 找到手牌中的卡牌
    const cardUid = await page.evaluate((defId) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness.state.get();
        const currentPlayer = state.core.currentPlayer;
        const player = state.core.players[currentPlayer];
        const card = player.hand.find((c: any) => c.defId === defId);
        return card?.uid;
    }, cardDefId);

    if (!cardUid) {
        throw new Error(`Card ${cardDefId} not found in hand`);
    }

    // 2. 点击卡牌
    await page.click(`[data-card-uid="${cardUid}"]`);
    await page.waitForTimeout(300);

    // 3. 如果需要选择目标基地，点击基地
    if (options?.targetBaseIndex !== undefined) {
        await page.click(`[data-base-index="${options.targetBaseIndex}"]`);
        await page.waitForTimeout(300);
    }

    // 4. 如果需要选择目标随从，点击随从
    if (options?.targetMinionUid) {
        await page.click(`[data-minion-uid="${options.targetMinionUid}"]`);
        await page.waitForTimeout(300);
    }
}

/**
 * 等待交互出现
 * 
 * @param page Playwright Page 对象
 * @param sourceId 交互来源 ID（如 'wizard_portal_pick'）
 * @param timeout 超时时间（毫秒）
 * 
 * @example
 * ```typescript
 * await waitForInteraction(page, 'wizard_portal_pick');
 * ```
 */
export async function waitForInteraction(
    page: Page,
    sourceId: string,
    timeout = 5000
): Promise<void> {
    await page.waitForFunction(
        (sid) => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            if (!harness) return false;
            const state = harness.state.get();
            if (!state) return false;
            const current = state.sys?.interaction?.current;
            return current?.data?.sourceId === sid;
        },
        sourceId,
        { timeout }
    );
}

/**
 * 获取当前交互的选项
 * 
 * @param page Playwright Page 对象
 * @returns 选项数组
 * 
 * @example
 * ```typescript
 * const options = await getInteractionOptions(page);
 * console.log('可选项:', options.map(o => o.label));
 * ```
 */
export async function getInteractionOptions(page: Page): Promise<any[]> {
    return await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness.state.get();
        const current = state.sys?.interaction?.current;
        return current?.data?.options || [];
    });
}

/**
 * 选择交互选项
 * 
 * @param page Playwright Page 对象
 * @param optionId 选项 ID（如 'minion-0'）
 * 
 * @example
 * ```typescript
 * await selectInteractionOption(page, 'minion-0');
 * ```
 */
export async function selectInteractionOption(
    page: Page,
    optionId: string
): Promise<void> {
    await page.click(`[data-option-id="${optionId}"]`);
    await page.waitForTimeout(300);
}

/**
 * 确认交互（点击"确认"按钮）
 * 
 * @param page Playwright Page 对象
 * 
 * @example
 * ```typescript
 * await confirmInteraction(page);
 * ```
 */
export async function confirmInteraction(page: Page): Promise<void> {
    await page.click('button:has-text("确认")');
    await page.waitForTimeout(300);
}

/**
 * 跳过交互（点击"跳过"按钮）
 * 
 * @param page Playwright Page 对象
 * 
 * @example
 * ```typescript
 * await skipInteraction(page);
 * ```
 */
export async function skipInteraction(page: Page): Promise<void> {
    await page.click('button:has-text("跳过")');
    await page.waitForTimeout(300);
}

/**
 * 读取当前游戏状态
 * 
 * @param page Playwright Page 对象
 * @returns 游戏状态对象
 * 
 * @example
 * ```typescript
 * const state = await readGameState(page);
 * console.log('当前玩家:', state.core.currentPlayer);
 * console.log('手牌数量:', state.core.players['p1'].hand.length);
 * ```
 */
export async function readGameState(page: Page): Promise<any> {
    return await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        return harness.state.get();
    });
}

/**
 * 截图并保存（用于调试）
 * 
 * @param page Playwright Page 对象
 * @param name 截图名称
 * @param testInfo Playwright TestInfo 对象
 * 
 * @example
 * ```typescript
 * await takeScreenshot(page, 'portal-interaction', testInfo);
 * ```
 */
export async function takeScreenshot(
    page: Page,
    name: string,
    testInfo: any
): Promise<void> {
    const path = testInfo.outputPath(`${name}.png`);
    await page.screenshot({ path, fullPage: true });
}
