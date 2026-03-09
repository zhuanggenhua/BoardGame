/**
 * Cardia E2E 测试辅助函数
 */

import type { Page, BrowserContext } from '@playwright/test';
import { expect } from '@playwright/test';
import {
    initContext,
    getGameServerBaseURL,
    ensureGameServerAvailable,
    seedMatchCredentials,
    waitForTestHarness,
} from './common';

// Re-export commonly used functions
// export { waitForTestHarness } from './common'; // Unused, commented out

export const GAME_NAME = 'cardia';

// ============================================================================
// 双人对局设置
// ============================================================================

export interface CardiaMatchSetup {
    player1Context: BrowserContext;
    player2Context: BrowserContext;
    player1Page: Page;
    player2Page: Page;
    matchId: string;
}

export interface SetupOnlineMatchOptions {
    player1Deck?: string;
    player2Deck?: string;
}

/**
 * 设置 Cardia 在线对局
 */
export const setupOnlineMatch = async (
    page: Page,
    _options: SetupOnlineMatchOptions = {}
): Promise<CardiaMatchSetup> => {
    const browser = page.context().browser();
    if (!browser) throw new Error('Browser not available');
    
    // 从 page 的 context 获取 baseURL，如果没有则使用默认值
    // 优先使用 context 的 baseURL，否则使用环境变量或默认值
    const baseURL = page.context()._options?.baseURL || process.env.VITE_FRONTEND_URL || 'http://localhost:5173';
    
    // 创建 player1 context
    const player1Context = await browser.newContext({ baseURL });
    await initContext(player1Context, { storageKey: '__cardia_storage_reset', skipTutorial: false });
    const player1Page = await player1Context.newPage();
    
    await player1Page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});
    
    if (!(await ensureGameServerAvailable(player1Page))) {
        throw new Error('Game server not available');
    }
    
    // 创建房间
    const player1GuestId = `e2e_player1_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const matchId = await createCardiaRoomViaAPI(player1Page, player1GuestId);
    if (!matchId) throw new Error('Failed to create room');
    
    // Player1 加入房间
    const player1Credentials = await joinCardiaMatchViaAPI(
        player1Page,
        matchId,
        '0',
        `Player1-${Date.now()}`,
        player1GuestId
    );
    if (!player1Credentials) throw new Error('Failed to join as player1');
    
    await seedCardiaMatchCredentials(player1Context, matchId, '0', player1Credentials);
    await player1Page.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    
    // 创建 player2 context
    const player2Context = await browser.newContext({ baseURL });
    await initContext(player2Context, { storageKey: '__cardia_storage_reset', skipTutorial: false });
    const player2Page = await player2Context.newPage();
    
    await player2Page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await player2Page.waitForTimeout(500);
    
    // Player2 加入房间
    const player2GuestId = `e2e_player2_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const player2Credentials = await joinCardiaMatchViaAPI(
        player2Page,
        matchId,
        '1',
        `Player2-${Date.now()}`,
        player2GuestId
    );
    if (!player2Credentials) throw new Error('Failed to join as player2');
    
    await seedCardiaMatchCredentials(player2Context, matchId, '1', player2Credentials);
    await player2Page.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });
    
    // 等待游戏加载
    await waitForGameBoard(player1Page);
    await waitForGameBoard(player2Page);
    
    return { player1Context, player2Context, player1Page, player2Page, matchId };
};

/**
 * 创建 Cardia 房间
 */
async function createCardiaRoomViaAPI(page: Page, guestId: string): Promise<string | null> {
    const baseURL = getGameServerBaseURL();
    const response = await page.request.post(`${baseURL}/games/${GAME_NAME}/create`, {
        data: {
            numPlayers: 2,
            setupData: { guestId },
            unlisted: false,
        },
    });
    
    if (!response.ok()) return null;
    const data = await response.json();
    return data.matchID;
}

/**
 * 加入 Cardia 对局
 */
async function joinCardiaMatchViaAPI(
    page: Page,
    matchId: string,
    playerID: string,
    playerName: string,
    guestId: string
): Promise<string | null> {
    const baseURL = getGameServerBaseURL();
    const response = await page.request.post(`${baseURL}/games/${GAME_NAME}/${matchId}/join`, {
        data: {
            playerID,
            playerName,
            data: { guestId },
        },
    });
    
    if (!response.ok()) return null;
    const data = await response.json();
    return data.playerCredentials;
}

/**
 * 存储 Cardia 对局凭证
 */
async function seedCardiaMatchCredentials(
    context: BrowserContext,
    matchId: string,
    playerID: string,
    credentials: string
) {
    await seedMatchCredentials(context, GAME_NAME, matchId, playerID, credentials);
}

/**
 * 等待游戏棋盘加载
 */
async function waitForGameBoard(page: Page, timeout = 30000) {
    await expect(page.locator('[data-testid="cardia-battlefield"]')).toBeVisible({ timeout });
}

// ============================================================================
// 调试面板操作（Debug Panel API）
// ============================================================================

/** 确保调试面板打开 */
export const ensureDebugPanelOpen = async (page: Page) => {
    const panel = page.getByTestId('debug-panel');
    if (await panel.isVisible().catch(() => false)) return;
    await page.getByTestId('debug-toggle').click();
    await expect(panel).toBeVisible({ timeout: 5000 });
};

/** 确保调试面板关闭 */
export const ensureDebugPanelClosed = async (page: Page) => {
    const panel = page.getByTestId('debug-panel');
    if (await panel.isHidden().catch(() => false)) return;
    await page.getByTestId('debug-toggle').click();
    await expect(panel).toBeHidden({ timeout: 5000 });
};

/** 切换到调试面板的状态 Tab */
export const ensureDebugStateTab = async (page: Page) => {
    await ensureDebugPanelOpen(page);
    const stateTab = page.getByTestId('debug-tab-state');
    if (await stateTab.isVisible().catch(() => false)) {
        await stateTab.click();
    }
};

/** 读取当前 core 状态 */
export const readCoreState = async (page: Page): Promise<Record<string, unknown>> => {
    await ensureDebugStateTab(page);
    const raw = await page.getByTestId('debug-state-json').innerText();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return (parsed?.core ?? (parsed as Record<string, unknown>)?.G?.core ?? parsed) as Record<string, unknown>;
};

/**
 * 读取实时状态（直接从 window.__BG_STATE__）
 * 
 * 与 readCoreState 的区别：
 * - readCoreState: 从调试面板读取，可能有延迟
 * - readLiveState: 直接从 React 状态读取，实时更新
 * 
 * 使用场景：
 * - 验证游戏结束状态（sys.gameover）
 * - 验证实时状态变化
 * - 需要完整的 MatchState（包括 core 和 sys）
 * 
 * @returns 完整的 MatchState，包括 core 和 sys
 */
export const readLiveState = async (page: Page): Promise<Record<string, unknown>> => {
    const state = await page.evaluate(() => {
        const state = (window as any).__BG_STATE__;
        return state ? JSON.parse(JSON.stringify(state)) : null;
    });
    
    if (!state) {
        throw new Error('window.__BG_STATE__ is not available');
    }
    
    return state;
};

/**
 * 直接注入 core 状态（使用调试面板）
 */
export const applyCoreStateDirect = async (page: Page, coreState: unknown) => {
    await ensureDebugStateTab(page);
    const toggleBtn = page.getByTestId('debug-state-toggle-input');
    await toggleBtn.click();
    const input = page.getByTestId('debug-state-input');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill(JSON.stringify(coreState));
    await page.getByTestId('debug-state-apply').click();
    await expect(input).toBeHidden({ timeout: 5000 }).catch(() => {});
};

// ============================================================================
// 高级辅助函数（基于 Debug Panel API）
// ============================================================================

/**
 * 注入手牌到指定玩家
 * @param page - 页面对象
 * @param playerId - 玩家 ID ('0' 或 '1')
 * @param cards - 卡牌数组，每个元素包含 defId
 */
export const injectHandCards = async (
    page: Page,
    playerId: string,
    cards: Array<{ defId: string }>
) => {
    const state = await readCoreState(page);
    const player = state.players[playerId];
    
    // 从 cardRegistry 获取卡牌定义并生成完整的卡牌实例
    const newCards = await page.evaluate(({ cardsData, pid }) => {
        // 访问游戏的 cardRegistry
        const cardRegistry = (window as unknown as { __BG_CARD_REGISTRY__?: Map<string, Record<string, unknown>> }).__BG_CARD_REGISTRY__;
        if (!cardRegistry) {
            throw new Error('Card registry not found');
        }
        
        return cardsData.map((card: { defId: string }, index: number) => {
            const cardDef = cardRegistry.get(card.defId);
            if (!cardDef) {
                throw new Error(`Card definition not found: ${card.defId}`);
            }
            
            return {
                uid: `injected_${pid}_${Date.now()}_${index}`,
                defId: card.defId,
                ownerId: pid,
                baseInfluence: cardDef.influence,
                faction: cardDef.faction,
                abilityIds: cardDef.abilityIds || [],
                difficulty: cardDef.difficulty,
                modifiers: [],
                tags: [],
                signets: 0,
                ongoingMarkers: [],
                imageIndex: cardDef.imageIndex,
                imagePath: cardDef.imagePath,
                encounterIndex: -1,
            };
        });
    }, { cardsData: cards, pid: playerId });
    
    player.hand = newCards; // 替换而不是追加
    
    await applyCoreStateDirect(page, state);
};

/**
 * 设置游戏阶段
 * @param page - 页面对象
 * @param phase - 阶段名称 ('play' | 'ability' | 'end')
 */
export const setPhase = async (page: Page, phase: string) => {
    const state = await readCoreState(page);
    state.phase = phase;
    await applyCoreStateDirect(page, state);
};

/**
 * 打出指定索引的手牌
 * @param page - 页面对象
 * @param index - 手牌索引（从 0 开始）
 */
export const playCard = async (page: Page, index: number) => {
    const cardSelector = `[data-testid="cardia-hand-area"] [data-testid^="card-"]`;
    const cards = page.locator(cardSelector);
    const card = cards.nth(index);
    await card.waitFor({ state: 'visible', timeout: 5000 });
    await card.click();
};

/**
 * 等待游戏进入指定阶段
 * @param page - 页面对象
 * @param phase - 阶段名称 ('play' | 'ability' | 'end')
 * @param timeout - 超时时间（毫秒）
 */
export const waitForPhase = async (page: Page, phase: string, timeout = 10000) => {
    const phaseMap: Record<string, string> = {
        play: 'Play Card',
        ability: 'Ability',
        end: 'End',
    };
    
    const phaseText = phaseMap[phase] || phase;
    const indicator = page.locator('[data-testid="cardia-phase-indicator"]');
    await expect(indicator).toContainText(phaseText, { timeout });
};

// ============================================================================
// 通用测试场景设置（新API）
// ============================================================================

/**
 * Cardia 测试场景配置
 */
export interface CardiaTestScenario {
    /** 玩家1配置 */
    player1: PlayerScenario;
    
    /** 玩家2配置 */
    player2: PlayerScenario;
    
    /** 游戏阶段（默认 'play'） */
    phase?: 'play' | 'ability' | 'end';
    
    /** 修正标记（可选） */
    modifierTokens?: ModifierToken[];
    
    /** 持续能力（可选） */
    ongoingAbilities?: OngoingAbility[];
    
    /** 揭示顺序（可选，用于测试占卜师等能力） */
    revealFirstNextEncounter?: string;
    
    /** 当前遭遇（可选，用于测试遭遇相关能力） */
    currentEncounter?: {
        player1Influence: number;
        player2Influence: number;
        winnerId?: string;
    };
}

/**
 * 玩家场景配置
 */
export interface PlayerScenario {
    /** 手牌（defId数组，简化版） */
    hand: string[];
    
    /** 牌库（可选，defId数组，用于控制抽牌） */
    deck?: string[];
    
    /** 已打出的牌（可选，用于测试多回合场景） */
    playedCards?: PlayedCardScenario[];
    
    /** 弃牌堆（可选） */
    discard?: string[];
}

/**
 * 已打出的牌配置
 */
export interface PlayedCardScenario {
    /** 卡牌定义ID */
    defId: string;
    
    /** 印戒数量（可选，默认0） */
    signets?: number;
    
    /** 持续标记（可选） */
    ongoingMarkers?: string[];
    
    /** 修正标记（可选，会自动添加到 modifierTokens） */
    modifiers?: Array<{ value: number; source: string }>;
    
    /** 遭遇序号（可选，默认-1）- 用于测试依赖遭遇历史的能力 */
    encounterIndex?: number;
}

/**
 * 修正标记
 */
export interface ModifierToken {
    /** 目标卡牌UID */
    cardId: string;
    
    /** 修正值 */
    value: number;
    
    /** 来源（能力ID或其他） */
    source: string;
}

/**
 * 持续能力
 */
export interface OngoingAbility {
    /** 能力ID */
    abilityId: string;
    
    /** 目标卡牌UID */
    cardId: string;
    
    /** 能力数据（可选） */
    data?: Record<string, unknown>;
}

/**
 * 设置 Cardia 测试场景（一次性配置完整状态）
 * 
 * @param browser - Playwright Browser 实例
 * @param scenario - 测试场景配置
 * @returns 测试setup对象
 * 
 * @example
 * // 基础场景：只配置手牌
 * const setup = await setupCardiaTestScenario(browser, {
 *     player1: { hand: ['deck_i_card_01'] },
 *     player2: { hand: ['deck_i_card_03'] },
 * });
 * 
 * @example
 * // 完整场景：配置手牌、牌库、已打出的牌
 * const setup = await setupCardiaTestScenario(browser, {
 *     player1: {
 *         hand: ['deck_i_card_01', 'deck_i_card_02'],
 *         deck: ['deck_i_card_03', 'deck_i_card_04'],
 *         playedCards: [
 *             { defId: 'deck_i_card_05', seals: 1 }
 *         ],
 *     },
 *     player2: {
 *         hand: ['deck_i_card_06'],
 *         deck: ['deck_i_card_07'],
 *     },
 *     phase: 'ability',
 * });
 */
export const setupCardiaTestScenario = async (
    browser: NonNullable<BrowserContext['browser']>,
    scenario: CardiaTestScenario
): Promise<CardiaMatchSetup> => {
    // 1. 创建基础对局
    const baseURL = process.env.VITE_FRONTEND_URL || 'http://localhost:5173';
    const tempContext = await browser.newContext({ baseURL });
    const tempPage = await tempContext.newPage();
    
    try {
        const setup = await setupOnlineMatch(tempPage);
        await tempPage.close();
        
        // 2. 构建完整状态
        const currentState = await readCoreState(setup.player1Page);
        const newState = await buildStateFromScenario(
            setup.player1Page,
            currentState,
            scenario
        );
        
        // 3. 注入状态到两个玩家页面
        await applyCoreStateDirect(setup.player1Page, newState);
        await applyCoreStateDirect(setup.player2Page, newState);
        
        // 4. 如果场景指定了阶段，需要同步设置 sys.phase
        if (scenario.phase) {
            await setup.player1Page.evaluate((phase) => {
                const state = (window as any).__BG_STATE__;
                if (state && state.sys) {
                    state.sys.phase = phase;
                }
            }, scenario.phase);
            await setup.player2Page.evaluate((phase) => {
                const state = (window as any).__BG_STATE__;
                if (state && state.sys) {
                    state.sys.phase = phase;
                }
            }, scenario.phase);
        }
        
        // 5. 等待UI更新
        await setup.player1Page.waitForTimeout(500);
        await setup.player2Page.waitForTimeout(500);
        
        return setup;
    } catch (error) {
        await tempPage.close();
        await tempContext.close();
        throw error;
    }
};

/**
 * 根据场景配置构建完整的游戏状态
 */
async function buildStateFromScenario(
    page: Page,
    baseState: Record<string, unknown>,
    scenario: CardiaTestScenario
): Promise<Record<string, unknown>> {
    const state = JSON.parse(JSON.stringify(baseState)) as Record<string, unknown>; // 深拷贝
    
    // 1. 配置玩家1
    const player1State = await buildPlayerState(
        page,
        ((baseState.players as Record<string, unknown>)['0'] as Record<string, unknown>) || {},
        scenario.player1,
        '0'
    );
    (state.players as Record<string, unknown>)['0'] = player1State;
    
    // 2. 配置玩家2
    const player2State = await buildPlayerState(
        page,
        ((baseState.players as Record<string, unknown>)['1'] as Record<string, unknown>) || {},
        scenario.player2,
        '1'
    );
    (state.players as Record<string, unknown>)['1'] = player2State;
    
    // 3. 设置阶段
    if (scenario.phase) {
        state.phase = scenario.phase;
    }
    
    // 4. 设置修正标记（自动解析 cardId 引用）
    if (scenario.modifierTokens) {
        const resolvedModifierTokens = scenario.modifierTokens.map(token => {
            // 如果 cardId 为空字符串，尝试从 playedCards 中查找第一张匹配的卡牌
            if (token.cardId === '') {
                // 优先从 P1 的 playedCards 查找
                const p1Cards = player1State.playedCards as Array<Record<string, unknown>>;
                if (p1Cards && p1Cards.length > 0) {
                    return { ...token, cardId: p1Cards[0].uid as string };
                }
                // 如果 P1 没有卡牌，从 P2 查找
                const p2Cards = player2State.playedCards as Array<Record<string, unknown>>;
                if (p2Cards && p2Cards.length > 0) {
                    return { ...token, cardId: p2Cards[0].uid as string };
                }
            }
            return token;
        });
        state.modifierTokens = resolvedModifierTokens;
    }
    
    // 5. 设置持续能力（state 本身就是 core，不需要 .core）
    if (scenario.ongoingAbilities) {
        state.ongoingAbilities = scenario.ongoingAbilities;
    } else {
        // 自动从 playedCards 的 ongoingMarkers 生成 ongoingAbilities
        const ongoingAbilities: Array<Record<string, unknown>> = [];
        
        // 处理 P1 的 playedCards
        if (scenario.player1.playedCards) {
            for (const playedCard of scenario.player1.playedCards) {
                if (playedCard.ongoingMarkers && playedCard.ongoingMarkers.length > 0) {
                    const cardInstance = (player1State.playedCards as Array<Record<string, unknown>>).find(
                        (c: Record<string, unknown>) => c.defId === playedCard.defId
                    );
                    if (cardInstance) {
                        for (const abilityId of playedCard.ongoingMarkers) {
                            ongoingAbilities.push({
                                abilityId,
                                cardId: cardInstance.uid as string,
                                playerId: '0',
                                effectType: 'ongoing', // 默认类型
                                timestamp: Date.now(),
                                encounterIndex: playedCard.encounterIndex,
                            });
                        }
                    }
                }
            }
        }
        
        // 处理 P2 的 playedCards
        if (scenario.player2.playedCards) {
            for (const playedCard of scenario.player2.playedCards) {
                if (playedCard.ongoingMarkers && playedCard.ongoingMarkers.length > 0) {
                    const cardInstance = (player2State.playedCards as Array<Record<string, unknown>>).find(
                        (c: Record<string, unknown>) => c.defId === playedCard.defId
                    );
                    if (cardInstance) {
                        for (const abilityId of playedCard.ongoingMarkers) {
                            ongoingAbilities.push({
                                abilityId,
                                cardId: cardInstance.uid as string,
                                playerId: '1',
                                effectType: 'ongoing', // 默认类型
                                timestamp: Date.now(),
                                encounterIndex: playedCard.encounterIndex,
                            });
                        }
                    }
                }
            }
        }
        
        if (ongoingAbilities.length > 0) {
            state.ongoingAbilities = ongoingAbilities;
        }
    }
    
    // 6. 设置揭示顺序
    if (scenario.revealFirstNextEncounter !== undefined) {
        state.revealFirstNextEncounter = scenario.revealFirstNextEncounter;
    }
    
    // 7. 设置当前遭遇
    if (scenario.currentEncounter) {
        // 从 playedCards 中查找对应的卡牌实例
        const p1Cards = player1State.playedCards as Array<Record<string, unknown>>;
        const p2Cards = player2State.playedCards as Array<Record<string, unknown>>;
        
        const player1Card = p1Cards && p1Cards.length > 0 ? p1Cards[0] : null;
        const player2Card = p2Cards && p2Cards.length > 0 ? p2Cards[0] : null;
        
        if (player1Card && player2Card) {
            const winnerId = scenario.currentEncounter.winnerId;
            const loserId = winnerId === '0' ? '1' : winnerId === '1' ? '0' : undefined;
            
            state.currentEncounter = {
                player1Card,
                player2Card,
                player1Influence: scenario.currentEncounter.player1Influence,
                player2Influence: scenario.currentEncounter.player2Influence,
                winnerId,
                loserId,
            };
        }
    }
    
    // 8. 自动计算 turnNumber（基于已打出牌的最大 encounterIndex）
    const allPlayedCards = [
        ...(player1State.playedCards as Array<Record<string, unknown>>),
        ...(player2State.playedCards as Array<Record<string, unknown>>),
    ];
    const maxEncounterIndex = allPlayedCards.reduce((max, card) => {
        const encounterIndex = card.encounterIndex as number;
        return encounterIndex > max ? encounterIndex : max;
    }, -1);
    
    // turnNumber 应该是下一个遭遇的序号（maxEncounterIndex + 1）
    // 但如果没有已打出的牌，turnNumber 应该是 0
    state.turnNumber = maxEncounterIndex >= 0 ? maxEncounterIndex + 1 : 0;
    
    return state;
}

/**
 * 构建玩家状态
 */
async function buildPlayerState(
    page: Page,
    basePlayer: Record<string, unknown>,
    playerScenario: PlayerScenario,
    playerId: string
): Promise<Record<string, unknown>> {
    const player = JSON.parse(JSON.stringify(basePlayer)) as Record<string, unknown>; // 深拷贝
    
    // 1. 构建手牌
    player.hand = await createCardInstances(page, playerScenario.hand, playerId, 0);
    
    // 2. 构建牌库（如果指定）
    if (playerScenario.deck) {
        player.deck = await createCardInstances(page, playerScenario.deck, playerId, 1000);
    }
    
    // 3. 构建已打出的牌（如果指定）
    if (playerScenario.playedCards) {
        player.playedCards = await Promise.all(
            playerScenario.playedCards.map(async (card, index) => {
                const instances = await createCardInstances(page, [card.defId], playerId, 2000 + index);
                const instance = instances[0];
                instance.signets = card.signets || 0;
                instance.ongoingMarkers = card.ongoingMarkers || [];
                // 设置遭遇序号（如果指定）
                if (card.encounterIndex !== undefined) {
                    instance.encounterIndex = card.encounterIndex;
                }
                return instance;
            })
        );
    }
    
    // 4. 构建弃牌堆（如果指定）
    if (playerScenario.discard) {
        player.discard = await createCardInstances(page, playerScenario.discard, playerId, 3000);
    }
    
    return player;
}

/**
 * 创建卡牌实例数组（在浏览器上下文中执行，访问 cardRegistry）
 * 
 * UID 格式与游戏代码一致：`{defId}_{timestamp}_{random}`
 * 这样可以确保注入的状态与 UI 渲染的状态一致
 */
async function createCardInstances(
    page: Page,
    defIds: string[],
    ownerId: string,
    startIndex: number
): Promise<Array<Record<string, unknown>>> {
    return await page.evaluate(({ defIds, ownerId, startIndex }) => {
        // 访问游戏的 cardRegistry
        const cardRegistry = (window as unknown as { __BG_CARD_REGISTRY__?: Map<string, unknown> }).__BG_CARD_REGISTRY__;
        if (!cardRegistry) {
            throw new Error('Card registry not found');
        }
        
        return defIds.map((defId: string, index: number) => {
            const cardDef = cardRegistry.get(defId) as Record<string, unknown> | undefined;
            if (!cardDef) {
                throw new Error(`Card definition not found: ${defId}`);
            }
            
            // 生成与游戏代码一致的 UID 格式：{defId}_{timestamp}_{random}
            // 使用固定的时间戳和索引，确保测试可重现
            const timestamp = Date.now() + index; // 每张卡牌的时间戳略有不同
            const random = Math.random().toString(36).substring(2, 11);
            const uid = `${defId}_${timestamp}_${random}`;
            
            return {
                uid,
                defId: defId,
                ownerId: ownerId,
                baseInfluence: cardDef.influence,
                faction: cardDef.faction,
                abilityIds: cardDef.abilityIds || [],
                difficulty: cardDef.difficulty,
                modifiers: [],
                tags: [],
                signets: 0,
                ongoingMarkers: [],
                imageIndex: cardDef.imageIndex,
                imagePath: cardDef.imagePath,
                encounterIndex: -1,
            };
        });
    }, { defIds, ownerId, startIndex });
}

// ============================================================================
// 兼容性别名（向后兼容旧测试文件）
// ============================================================================

/**
 * 设置 Cardia 在线对局（别名，向后兼容）
 * @deprecated 使用 setupOnlineMatch 代替
 */
export const setupCardiaOnlineMatch = async (browser: NonNullable<BrowserContext['browser']>, baseURL?: string) => {
    if (!browser) throw new Error('Browser not available');
    
    // 创建临时页面用于初始化
    const tempContext = await browser.newContext({ baseURL });
    const tempPage = await tempContext.newPage();
    
    try {
        const setup = await setupOnlineMatch(tempPage);
        await tempPage.close();
        
        // 返回兼容格式
        return {
            hostPage: setup.player1Page,
            guestPage: setup.player2Page,
            player1Context: setup.player1Context,
            player2Context: setup.player2Context,
            matchId: setup.matchId,
        };
    } catch (error) {
        await tempPage.close();
        await tempContext.close();
        throw error;
    }
};

/**
 * 清理 Cardia 对局（别名，向后兼容）
 * @deprecated 手动关闭 context 代替
 */
export const cleanupCardiaMatch = async (setup: { player1Context?: BrowserContext; player2Context?: BrowserContext }) => {
    if (setup.player1Context) {
        await setup.player1Context.close();
    }
    if (setup.player2Context) {
        await setup.player2Context.close();
    }
};
