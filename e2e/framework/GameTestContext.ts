/**
 * E2E 测试框架 - 游戏测试上下文
 * 
 * 提供统一的测试 API，封装状态注入、游戏动作、断言等功能。
 * 
 * 核心理念：
 * 1. 声明式场景构建 - 用配置描述测试场景
 * 2. 零样板代码 - 测试文件只写业务逻辑
 * 3. 类型安全 - TypeScript 全程提示
 * 4. 可组合 - 场景构建器 + 动作 + 断言
 */

import type { Page } from '@playwright/test';

/**
 * 卡牌定义（简化版）
 */
interface CardDef {
    uid: string;
    defId: string;
    type: 'minion' | 'action';
}

/**
 * 玩家场景配置
 */
interface PlayerSceneConfig {
    /** 手牌（defId 数组） */
    hand?: string[];
    /** 牌库（defId 数组） */
    deck?: string[];
    /** 弃牌堆（defId 数组） */
    discard?: string[];
    /** 场上随从（defId 数组） */
    field?: string[];
}

/**
 * 场景配置
 */
interface SceneConfig {
    /** 游戏 ID */
    gameId: string;
    /** 玩家 0 配置 */
    player0?: PlayerSceneConfig;
    /** 玩家 1 配置 */
    player1?: PlayerSceneConfig;
    /** 当前回合玩家 */
    currentPlayer?: string;
    /** 回合阶段 */
    phase?: string;
    /** 随机数队列 */
    randomQueue?: number[];
}

/**
 * 游戏测试上下文
 * 
 * 提供统一的测试 API，封装所有测试操作。
 */
export class GameTestContext {
    constructor(private page: Page) {}

    /**
     * 等待测试工具就绪
     */
    private async waitForTestHarness(timeout = 10000): Promise<void> {
        await this.page.waitForFunction(
            () => !!(window as any).__BG_TEST_HARNESS__,
            { timeout }
        );
    }

    /**
     * 快速场景构建
     * 
     * 跳过所有前置步骤，直接构造目标场景。
     * 
     * @param config 场景配置
     * 
     * @example
     * ```typescript
     * await game.setupScene({
     *   gameId: 'smashup',
     *   player0: {
     *     hand: ['wizard_portal'],
     *     discard: ['alien_invader', 'wizard_apprentice']
     *   },
     *   currentPlayer: '0',
     *   phase: 'playCards'
     * });
     * ```
     */
    async setupScene(config: SceneConfig): Promise<void> {
        await this.waitForTestHarness();

        await this.page.evaluate((cfg) => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            if (!harness) throw new Error('TestHarness not available');

            // 1. 设置随机数队列（如果提供）
            if (cfg.randomQueue) {
                harness.random.setQueue(cfg.randomQueue);
            }

            // 2. 获取当前状态
            const state = harness.state.get();
            if (!state) throw new Error('State not available');

            // 3. 生成卡牌 UID（使用时间戳 + 索引确保唯一性）
            const now = Date.now();
            const generateUid = (defId: string, index: number) => `${defId}_${now}_${index}`;

            // 4. 推断卡牌类型（基于 defId 命名规则）
            const inferCardType = (defId: string): 'minion' | 'action' => {
                // SmashUp 命名规则：
                // - 行动卡通常包含动词或抽象名词（portal, time_loop, full_steam, etc.）
                // - 随从卡通常是具体的生物/角色名词（invader, shinobi, overlord, etc.）
                // 
                // 启发式规则（按优先级）：
                // 1. 显式 action_ 前缀 → action
                // 2. 包含常见行动卡关键词 → action
                // 3. 默认 → minion
                
                if (defId.startsWith('action_')) return 'action';
                
                // 常见行动卡关键词（不完整，但覆盖测试常用卡牌）
                const actionKeywords = [
                    'portal', 'time_loop', 'full_steam', 'cannon', 'broadside',
                    'disintegrate', 'augmentation', 'upgrade', 'power_up',
                    'terraform', 'crop_circles', 'abduction', 'probe',
                    'shamble', 'not_dead_yet', 'grave_digger',
                    'king', 'swashbuckling',  // 移除 'first_mate'（海盗大副是随从）
                    'ninjutsu', 'disguise', 'smoke_bomb',
                ];
                
                for (const keyword of actionKeywords) {
                    if (defId.includes(keyword)) return 'action';
                }
                
                return 'minion';
            };

            // 5. 构造玩家状态
            const buildPlayerState = (playerConfig: any, playerId: string, offset: number) => {
                const hand = (playerConfig?.hand || []).map((defId: string, i: number) => ({
                    uid: generateUid(defId, offset + i),
                    defId,
                    type: inferCardType(defId),
                }));

                const deck = (playerConfig?.deck || []).map((defId: string, i: number) => ({
                    uid: generateUid(defId, offset + 1000 + i),
                    defId,
                    type: inferCardType(defId),
                }));

                const discard = (playerConfig?.discard || []).map((defId: string, i: number) => ({
                    uid: generateUid(defId, offset + 2000 + i),
                    defId,
                    type: inferCardType(defId),
                }));

                return { hand, deck, discard };
            };

            // 6. 构造状态补丁
            const patch: any = {
                core: {
                    players: {},
                },
            };

            // 7. 应用玩家配置
            if (cfg.player0) {
                const player0State = buildPlayerState(cfg.player0, '0', 0);
                // 确保玩家状态包含所有必要的字段（使用游戏默认值）
                patch.core.players['0'] = {
                    ...player0State,
                    // 如果 setupScene 没有覆盖这些字段，保持原有值
                    // 通过不设置这些字段，让 patch 保留原有值
                };
            }
            if (cfg.player1) {
                const player1State = buildPlayerState(cfg.player1, '1', 10000);
                patch.core.players['1'] = {
                    ...player1State,
                };
            }

            // 8. 设置当前玩家和阶段
            // 注意：SmashUp 使用 currentPlayerIndex（数字索引）而非 currentPlayer（字符串 ID）
            if (cfg.currentPlayer !== undefined) {
                const playerIndex = parseInt(cfg.currentPlayer, 10);
                patch.core.currentPlayerIndex = playerIndex;
            }
            // 注意：phase 在 sys 中，不在 core 中
            if (cfg.phase !== undefined) {
                if (!patch.sys) patch.sys = {};
                patch.sys.phase = cfg.phase;
            }

            // 9. 应用状态补丁（使用深度合并，不覆盖未指定的字段）
            harness.state.patch(patch);
        }, config);

        // 等待 React 重新渲染（必要的等待，确保状态已应用）
        await this.page.waitForTimeout(500);
    }

    /**
     * 打出指定卡牌
     * 
     * @param cardDefId 卡牌 defId（如 'wizard_portal'）
     * @param options 额外选项
     * 
     * @example
     * ```typescript
     * await game.playCard('wizard_portal');
     * await game.playCard('wizard_archmage', { targetBaseIndex: 0 });
     * ```
     */
    async playCard(
        cardDefId: string,
        options?: {
            targetBaseIndex?: number;
            targetMinionUid?: string;
        }
    ): Promise<void> {
        // 1. 找到手牌中的卡牌
        const cardUid = await this.page.evaluate((defId) => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            // SmashUp 使用 currentPlayerIndex（数字索引）
            const currentPlayerIndex = state.core.currentPlayerIndex;
            const currentPlayerId = state.core.turnOrder[currentPlayerIndex];
            const player = state.core.players[currentPlayerId];
            const card = player.hand.find((c: any) => c.defId === defId);
            return card?.uid;
        }, cardDefId);

        if (!cardUid) {
            throw new Error(`Card ${cardDefId} not found in hand`);
        }

        // 2. 点击卡牌
        await this.page.click(`[data-card-uid="${cardUid}"]`);
        await this.page.waitForTimeout(300);

        // 3. 如果需要选择目标基地，点击基地
        if (options?.targetBaseIndex !== undefined) {
            await this.page.click(`[data-base-index="${options.targetBaseIndex}"]`);
            await this.page.waitForTimeout(300);
        }

        // 4. 如果需要选择目标随从，点击随从
        if (options?.targetMinionUid) {
            await this.page.click(`[data-minion-uid="${options.targetMinionUid}"]`);
            await this.page.waitForTimeout(300);
        }
    }

    /**
     * 等待交互出现
     * 
     * @param sourceId 交互来源 ID（如 'wizard_portal_pick'）
     * @param timeout 超时时间（毫秒）
     * 
     * @example
     * ```typescript
     * await game.waitForInteraction('wizard_portal_pick');
     * ```
     */
    async waitForInteraction(sourceId: string, timeout = 5000): Promise<void> {
        await this.page.waitForFunction(
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
     * @returns 选项数组
     * 
     * @example
     * ```typescript
     * const options = await game.getInteractionOptions();
     * console.log('可选项:', options.map(o => o.label));
     * ```
     */
    async getInteractionOptions(): Promise<any[]> {
        return await this.page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            const current = state.sys?.interaction?.current;
            return current?.data?.options || [];
        });
    }

    /**
     * 选择交互选项
     * 
     * @param optionId 选项 ID（如 'minion-0'）
     * 
     * @example
     * ```typescript
     * await game.selectOption('minion-0');
     * ```
     */
    async selectOption(optionId: string): Promise<void> {
        await this.page.click(`[data-option-id="${optionId}"]`);
        await this.page.waitForTimeout(300);
    }

    /**
     * 确认交互（点击"确认"按钮）
     * 
     * @example
     * ```typescript
     * await game.confirm();
     * ```
     */
    async confirm(): Promise<void> {
        await this.page.click('button:has-text("确认")');
        await this.page.waitForTimeout(300);
    }

    /**
     * 跳过交互（点击"跳过"按钮）
     * 
     * @example
     * ```typescript
     * await game.skip();
     * ```
     */
    async skip(): Promise<void> {
        await this.page.click('button:has-text("跳过")');
        await this.page.waitForTimeout(300);
    }

    /**
     * 推进阶段
     * 
     * @example
     * ```typescript
     * await game.advancePhase();
     * ```
     */
    async advancePhase(): Promise<void> {
        await this.page.click('[data-action="advance-phase"]');
        await this.page.waitForTimeout(300);
    }

    /**
     * 读取当前游戏状态
     * 
     * @returns 游戏状态对象
     * 
     * @example
     * ```typescript
     * const state = await game.getState();
     * console.log('当前玩家:', state.core.currentPlayer);
     * ```
     */
    async getState(): Promise<any> {
        return await this.page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.get();
        });
    }

    /**
     * 断言：手牌中有指定卡牌
     * 
     * @param cardDefId 卡牌 defId
     * 
     * @example
     * ```typescript
     * await game.expectCardInHand('alien_invader');
     * ```
     */
    async expectCardInHand(cardDefId: string): Promise<void> {
        const state = await this.getState();
        // SmashUp 使用 currentPlayerIndex（数字索引）
        const currentPlayerIndex = state.core.currentPlayerIndex;
        const currentPlayerId = state.core.turnOrder[currentPlayerIndex];
        const player = state.core.players[currentPlayerId];
        const hasCard = player.hand.some((c: any) => c.defId === cardDefId);
        
        if (!hasCard) {
            throw new Error(`Expected card ${cardDefId} in hand, but not found`);
        }
    }

    /**
     * 断言：弃牌堆中有指定卡牌
     * 
     * @param cardDefId 卡牌 defId
     * 
     * @example
     * ```typescript
     * await game.expectCardInDiscard('wizard_portal');
     * ```
     */
    async expectCardInDiscard(cardDefId: string): Promise<void> {
        const state = await this.getState();
        // SmashUp 使用 currentPlayerIndex（数字索引）
        const currentPlayerIndex = state.core.currentPlayerIndex;
        const currentPlayerId = state.core.turnOrder[currentPlayerIndex];
        const player = state.core.players[currentPlayerId];
        const hasCard = player.discard.some((c: any) => c.defId === cardDefId);
        
        if (!hasCard) {
            throw new Error(`Expected card ${cardDefId} in discard, but not found`);
        }
    }

    /**
     * 断言：当前阶段
     * 
     * @param phase 阶段名称
     * 
     * @example
     * ```typescript
     * await game.expectPhase('playCards');
     * ```
     */
    async expectPhase(phase: string): Promise<void> {
        const state = await this.getState();
        // phase 在 sys 中，不在 core 中
        const currentPhase = state.sys.phase;
        
        if (currentPhase !== phase) {
            throw new Error(`Expected phase ${phase}, but got ${currentPhase}`);
        }
    }

    /**
     * 截图并保存（用于调试）
     * 
     * @param name 截图名称
     * @param testInfo Playwright TestInfo 对象
     * 
     * @example
     * ```typescript
     * await game.screenshot('portal-interaction', testInfo);
     * ```
     */
    async screenshot(name: string, testInfo: any): Promise<void> {
        const path = testInfo.outputPath(`${name}.png`);
        await this.page.screenshot({ path, fullPage: true });
    }
}
