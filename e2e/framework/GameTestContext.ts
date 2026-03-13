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

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { getCardDef as getSmashUpCardDef, getBaseDef } from '../../src/games/smashup/data/cards';
import { CHARACTER_DATA_MAP, initHeroState } from '../../src/games/dicethrone/domain/characters';
import type { AbilityCard, SelectableCharacterId } from '../../src/games/dicethrone/types';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath, sanitizeEvidencePathSegment } from './evidenceScreenshots';

type SceneQueryValue = string | number | boolean | null | undefined;

type SmashUpCardType = 'minion' | 'action';

interface SmashUpCardSceneConfig {
    uid?: string;
    defId: string;
    type?: SmashUpCardType;
    owner?: string;
}

interface SmashUpAttachedActionSceneConfig {
    uid?: string;
    defId: string;
    ownerId?: string;
    talentUsed?: boolean;
    metadata?: Record<string, unknown>;
}

interface SmashUpMinionSceneConfig {
    uid?: string;
    defId: string;
    baseIndex: number;
    owner?: string;
    controller?: string;
    basePower?: number;
    power?: number;
    powerCounters?: number;
    powerModifier?: number;
    tempPowerModifier?: number;
    attachedActions?: Array<string | SmashUpAttachedActionSceneConfig>;
    talentUsed?: boolean;
    playedThisTurn?: boolean;
}

interface SmashUpBaseSceneConfig {
    defId?: string;
    breakpoint?: number;
    power?: number;
    minions?: SmashUpMinionSceneConfig[];
    ongoingActions?: Array<string | SmashUpAttachedActionSceneConfig>;
}

interface SmashUpResponseWindowSceneConfig {
    windowType: string;
    id?: string;
    sourceId?: string;
    responderQueue?: string[];
    currentResponderIndex?: number;
    passedPlayers?: string[];
    pendingInteractionId?: string;
    actionTakenThisRound?: boolean;
    consecutivePassRounds?: number;
}

/**
 * 玩家场景配置（SmashUp）
 */
interface PlayerSceneConfig {
    /** 手牌 */
    hand?: Array<string | SmashUpCardSceneConfig>;
    /** 牌库 */
    deck?: Array<string | SmashUpCardSceneConfig>;
    /** 弃牌堆 */
    discard?: Array<string | SmashUpCardSceneConfig>;
    /** 场上随从 */
    field?: SmashUpMinionSceneConfig[];
    /** 阵营 */
    factions?: [string, string] | string[];
    minionsPlayed?: number;
    minionLimit?: number;
    actionsPlayed?: number;
    actionLimit?: number;
    vp?: number;
}

/**
 * 玩家场景配置（DiceThrone）
 */
interface DiceThronePlayerConfig {
    /** 手牌（卡牌 id 数组或完整卡牌对象） */
    hand?: Array<string | AbilityCard>;
    /** 牌库（卡牌 id 数组或完整卡牌对象） */
    deck?: Array<string | AbilityCard>;
    /** 弃牌堆（卡牌 id 数组或完整卡牌对象） */
    discard?: Array<string | AbilityCard>;
    /** 资源（如 { CP: 3, HP: 50 }） */
    resources?: Record<string, number>;
    /** Token（如 { shield: 2 }） */
    tokens?: Record<string, number>;
}

/**
 * 场景配置（通用）
 */
interface SceneConfig {
    /** 游戏 ID */
    gameId: string;
    /** 玩家 0 配置 */
    player0?: PlayerSceneConfig | DiceThronePlayerConfig;
    /** 玩家 1 配置 */
    player1?: PlayerSceneConfig | DiceThronePlayerConfig;
    /** 当前回合玩家 */
    currentPlayer?: string;
    /** 回合阶段 */
    phase?: string;
    /** 顶层 sys 补丁 */
    sys?: Record<string, any>;
    /** SmashUp 基地配置 */
    bases?: SmashUpBaseSceneConfig[];
    /** SmashUp 响应窗口配置 */
    responseWindow?: SmashUpResponseWindowSceneConfig | null;
    /** 随机数队列 */
    randomQueue?: number[];
    /** 额外的状态字段（游戏特定） */
    extra?: Record<string, any>;
    /** 预构建玩家状态（框架内部使用） */
    prebuiltPlayers?: Partial<Record<'0' | '1', Record<string, any>>>;
}

/**
 * 游戏测试上下文
 * 
 * 提供统一的测试 API，封装所有测试操作。
 */
const FALLBACK_SMASHUP_ACTION_KEYWORDS = [
    'portal', 'time_loop', 'full_steam', 'cannon', 'broadside',
    'disintegrate', 'augmentation', 'upgrade', 'power_up',
    'terraform', 'crop_circles', 'abduction', 'probe',
    'shamble', 'not_dead_yet', 'grave_digger',
    'king', 'swashbuckling',
    'ninjutsu', 'disguise', 'smoke_bomb',
];

function resolveSmashUpCardType(defId: string, explicitType?: SmashUpCardType): SmashUpCardType {
    if (explicitType) return explicitType;

    const def = getSmashUpCardDef(defId);
    if (def?.type === 'action' || def?.type === 'minion') {
        return def.type;
    }

    if (defId.startsWith('action_')) return 'action';
    if (FALLBACK_SMASHUP_ACTION_KEYWORDS.some((keyword) => defId.includes(keyword))) {
        return 'action';
    }
    return 'minion';
}

const DICE_THRONE_DEFAULT_CHARACTERS: Record<'0' | '1', SelectableCharacterId> = {
    '0': 'monk',
    '1': 'barbarian',
};

const DICE_THRONE_PREPARE_RANDOM = {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0.5,
    d: (_faces: number) => 1,
    range: (min: number, _max: number) => min,
};

function getDiceThroneCardCatalog(characterId: SelectableCharacterId): Map<string, AbilityCard> {
    const characterData = CHARACTER_DATA_MAP[characterId];
    const deck = characterData.getStartingDeck(DICE_THRONE_PREPARE_RANDOM);
    return new Map(deck.map((card) => [card.id, card]));
}

function createFallbackDiceThroneCard(cardId: string): AbilityCard {
    return {
        id: cardId,
        name: cardId,
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardId,
    };
}

function normalizeDiceThroneCardEntry(
    entry: string | AbilityCard,
    cardCatalog: Map<string, AbilityCard>,
): AbilityCard {
    if (typeof entry !== 'string') {
        return {
            ...createFallbackDiceThroneCard(entry.id),
            ...entry,
        };
    }

    const card = cardCatalog.get(entry);
    if (card) {
        return { ...card };
    }

    return createFallbackDiceThroneCard(entry);
}

function normalizeDiceThronePlayerConfig(
    playerConfig: DiceThronePlayerConfig | undefined,
    playerId: '0' | '1',
    selectedCharacters?: Record<string, SelectableCharacterId>,
): DiceThronePlayerConfig | undefined {
    if (!playerConfig) return playerConfig;

    const characterId = selectedCharacters?.[playerId] ?? DICE_THRONE_DEFAULT_CHARACTERS[playerId];
    const cardCatalog = getDiceThroneCardCatalog(characterId);

    return {
        ...playerConfig,
        hand: playerConfig.hand?.map((entry) => normalizeDiceThroneCardEntry(entry, cardCatalog)),
        deck: playerConfig.deck?.map((entry) => normalizeDiceThroneCardEntry(entry, cardCatalog)),
        discard: playerConfig.discard?.map((entry) => normalizeDiceThroneCardEntry(entry, cardCatalog)),
    };
}

function normalizeSmashUpCardEntry(entry: string | SmashUpCardSceneConfig): SmashUpCardSceneConfig {
    const card = typeof entry === 'string' ? { defId: entry } : { ...entry };
    return {
        ...card,
        type: resolveSmashUpCardType(card.defId, card.type),
    };
}

export class GameTestContext {
    constructor(private page: Page) {}
    private clearedEvidenceTests = new Set<string>();

    private isRetryableNavigationError(error: unknown): boolean {
        if (!(error instanceof Error)) {
            return false;
        }

        return error.message.includes('ERR_ABORTED')
            || error.message.includes('frame was detached');
    }

    private async gotoWithRetry(url: string, timeout: number): Promise<void> {
        const maxAttempts = 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout });
                return;
            } catch (error) {
                if (!this.isRetryableNavigationError(error) || attempt === maxAttempts) {
                    throw error;
                }

                // 开发服务器热更新会短暂重建 frame，允许导航层做有限重试。
                await this.page.waitForTimeout(800);
            }
        }
    }

    private async dismissRevealOverlayIfPresent(): Promise<void> {
        const dismissHint = this.page.getByText(/Click anywhere to close/i);
        const isVisible = await dismissHint.isVisible({ timeout: 200 }).catch(() => false);
        if (!isVisible) return;

        await dismissHint.click({ force: true });
        await this.page.waitForTimeout(200);
    }

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
     * 打开启用 TestHarness 的测试游戏页，并等待状态注入能力就绪。
     *
     * 新框架：直接导航到 `/play/<gameId>`，自动启用 TestHarness。
     * 使用 `setupScene()` 注入测试场景，无需 URL 参数。
     * 
     * @param gameId 游戏 ID
     * @param query 已废弃，保留仅为向后兼容
     * @param timeout 超时时间（毫秒）
     */
    async openTestGame(
        gameId: string,
        query: Record<string, SceneQueryValue> = {},
        timeout = 15000,
    ): Promise<void> {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value === undefined || value === null) continue;
            params.set(key, String(value));
        }

        const search = params.toString();
        const url = `/play/${gameId}${search ? `?${search}` : ''}`;

        await this.gotoWithRetry(url, timeout);
        await this.waitForTestHarness(timeout);
        await this.page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout },
        );
    }

    /**
     * 快速场景构建
     * 
     * 跳过所有前置步骤，直接构造目标场景。
     * 支持 SmashUp 和 DiceThrone。
     * 
     * @param config 场景配置
     * 
     * @example SmashUp
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
     * 
     * @example DiceThrone
     * ```typescript
     * await game.setupScene({
     *   gameId: 'dicethrone',
     *   player0: {
     *     hand: ['volley'],
     *     resources: { CP: 3, HP: 50 }
     *   },
     *   currentPlayer: '0',
     *   phase: 'offense_roll',
     *   extra: {
     *     rollCount: 1,
     *     rollConfirmed: true,
     *     dice: [1, 2, 3, 4, 5],
     *     pendingAttack: {
     *       attackerId: '0',
     *       targetId: '1',
     *       baseDamage: 5,
     *       bonusDamage: 0,
     *       totalDamage: 5,
     *       unblockable: false
     *     }
     *   }
     * });
     * ```
     */
    async setupScene(config: SceneConfig): Promise<void> {
        await this.waitForTestHarness();
        
        // 方案3：Node.js 环境预处理 - 自动填充 basePower 和 breakpoint
        let preparedConfig: SceneConfig = config;
        
        if (config.gameId === 'smashup') {
            // 1. 自动填充随从的 basePower（从卡牌定义读取）
            const autoFillMinionPower = (minion: SmashUpMinionSceneConfig): SmashUpMinionSceneConfig => {
                if (minion.basePower !== undefined) return minion; // 已有值，不覆盖
                
                const cardDef = getSmashUpCardDef(minion.defId);
                if (cardDef?.type === 'minion' && typeof cardDef.power === 'number') {
                    return { ...minion, basePower: cardDef.power };
                }
                
                return minion; // 找不到定义，保持原样
            };
            
            // 2. 自动填充基地的 breakpoint（从基地定义读取）
            const autoFillBaseBreakpoint = (base: SmashUpBaseSceneConfig): SmashUpBaseSceneConfig => {
                if (base.breakpoint !== undefined) return base; // 已有值，不覆盖
                if (!base.defId) return base; // 没有 defId，无法查询
                
                const baseDef = getBaseDef(base.defId);
                if (baseDef && typeof baseDef.breakpoint === 'number') {
                    return { ...base, breakpoint: baseDef.breakpoint };
                }
                
                return base; // 找不到定义，保持原样
            };

            const processBaseConfig = (baseConfig?: SmashUpBaseSceneConfig): SmashUpBaseSceneConfig | undefined => {
                if (!baseConfig) return baseConfig;

                return autoFillBaseBreakpoint({
                    ...baseConfig,
                    minions: baseConfig.minions?.map(autoFillMinionPower),
                });
            };
            
            // 3. 处理玩家配置
            const processPlayerConfig = (playerConfig?: PlayerSceneConfig | DiceThronePlayerConfig): PlayerSceneConfig | DiceThronePlayerConfig | undefined => {
                if (!playerConfig) return playerConfig;
                
                const config = playerConfig as PlayerSceneConfig;
                return {
                    ...config,
                    hand: config.hand?.map(normalizeSmashUpCardEntry),
                    deck: config.deck?.map(normalizeSmashUpCardEntry),
                    discard: config.discard?.map(normalizeSmashUpCardEntry),
                    field: config.field?.map(autoFillMinionPower),
                };
            };
            
            preparedConfig = {
                ...config,
                player0: processPlayerConfig(config.player0),
                player1: processPlayerConfig(config.player1),
                bases: config.bases?.map(processBaseConfig),
            };
        } else if (config.gameId === 'dicethrone') {
            const selectedCharacters = config.extra?.selectedCharacters as Record<string, SelectableCharacterId> | undefined;
            const buildPrebuiltPlayer = (
                playerId: '0' | '1',
                playerConfig?: DiceThronePlayerConfig,
            ) => {
                const characterId = selectedCharacters?.[playerId] ?? DICE_THRONE_DEFAULT_CHARACTERS[playerId];
                const baseState = initHeroState(playerId, characterId, DICE_THRONE_PREPARE_RANDOM);
                const normalizedConfig = normalizeDiceThronePlayerConfig(playerConfig, playerId, selectedCharacters);

                return {
                    ...baseState,
                    characterId,
                    ...(normalizedConfig ?? {}),
                    hand: normalizedConfig?.hand ?? baseState.hand,
                    deck: normalizedConfig?.deck ?? baseState.deck,
                    discard: normalizedConfig?.discard ?? baseState.discard,
                    resources: {
                        ...baseState.resources,
                        ...(normalizedConfig?.resources ?? {}),
                    },
                    tokens: {
                        ...baseState.tokens,
                        ...(normalizedConfig?.tokens ?? {}),
                    },
                };
            };

            preparedConfig = {
                ...config,
                player0: normalizeDiceThronePlayerConfig(config.player0 as DiceThronePlayerConfig | undefined, '0', selectedCharacters),
                player1: normalizeDiceThronePlayerConfig(config.player1 as DiceThronePlayerConfig | undefined, '1', selectedCharacters),
                prebuiltPlayers: {
                    '0': buildPrebuiltPlayer('0', config.player0 as DiceThronePlayerConfig | undefined),
                    '1': buildPrebuiltPlayer('1', config.player1 as DiceThronePlayerConfig | undefined),
                },
            };
        } else {
            preparedConfig = config;
        }

        await this.page.evaluate(async (cfg) => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            if (!harness) throw new Error('TestHarness not available');

            // 1. 设置随机数队列（如果提供）
            if (cfg.randomQueue) {
                harness.random.setQueue(cfg.randomQueue);
            }

            // 2. 获取当前状态
            const state = harness.state.get();
            if (!state) throw new Error('State not available');

            // 3. 根据游戏类型选择不同的构建策略
            if (cfg.gameId === 'dicethrone') {
                // DiceThrone 特定逻辑
                const buildDiceThronePlayerState = (playerConfig: any, playerId: string) => {
                    const prebuiltPlayer = cfg.prebuiltPlayers?.[playerId];
                    if (prebuiltPlayer) {
                        return { ...prebuiltPlayer };
                    }

                    const cloneCard = (entry: any) => {
                        if (typeof entry === 'string') {
                            return {
                                id: entry,
                                name: entry,
                                type: 'action',
                                cpCost: 0,
                                timing: 'main',
                                description: entry,
                            };
                        }

                        return { ...entry };
                    };

                    const partialState: any = {};

                    if (playerConfig?.hand !== undefined) {
                        partialState.hand = playerConfig.hand.map((entry: any) => cloneCard(entry));
                    }
                    if (playerConfig?.deck !== undefined) {
                        partialState.deck = playerConfig.deck.map((entry: any) => cloneCard(entry));
                    }
                    if (playerConfig?.discard !== undefined) {
                        partialState.discard = playerConfig.discard.map((entry: any) => cloneCard(entry));
                    }
                    if (playerConfig?.resources !== undefined) {
                        partialState.resources = playerConfig.resources;
                    }
                    if (playerConfig?.tokens !== undefined) {
                        partialState.tokens = playerConfig.tokens;
                    }

                    return partialState;
                };

                const selectedCharacters = cfg.extra?.selectedCharacters ?? state.core.selectedCharacters ?? {};

                // 构造状态补丁
                const patch: any = {
                    ...state,
                    core: {
                        ...state.core,
                        players: {
                            ...state.core.players,
                        },
                    },
                    sys: {
                        ...(state.sys ?? {}),
                    },
                };

                // 应用玩家配置
                if (cfg.player0 || cfg.prebuiltPlayers?.['0']) {
                    const player0State = buildDiceThronePlayerState(cfg.player0, '0');
                    const existingPlayer0 = state.core.players?.['0'] ?? {};
                    patch.core.players['0'] = {
                        ...existingPlayer0,
                        ...player0State,
                        characterId: player0State.characterId ?? selectedCharacters['0'] ?? existingPlayer0.characterId,
                        resources: {
                            ...(existingPlayer0.resources ?? {}),
                            ...(player0State.resources ?? {}),
                        },
                        tokens: {
                            ...(existingPlayer0.tokens ?? {}),
                            ...(player0State.tokens ?? {}),
                        },
                    };
                }
                if (cfg.player1 || cfg.prebuiltPlayers?.['1']) {
                    const player1State = buildDiceThronePlayerState(cfg.player1, '1');
                    const existingPlayer1 = state.core.players?.['1'] ?? {};
                    patch.core.players['1'] = {
                        ...existingPlayer1,
                        ...player1State,
                        characterId: player1State.characterId ?? selectedCharacters['1'] ?? existingPlayer1.characterId,
                        resources: {
                            ...(existingPlayer1.resources ?? {}),
                            ...(player1State.resources ?? {}),
                        },
                        tokens: {
                            ...(existingPlayer1.tokens ?? {}),
                            ...(player1State.tokens ?? {}),
                        },
                    };
                }

                // 设置当前玩家
                if (cfg.currentPlayer !== undefined) {
                    patch.core.activePlayerId = cfg.currentPlayer;
                }

                // 设置阶段（phase 在 sys 中，不在 core 中）
                if (cfg.phase !== undefined) {
                    patch.sys = {
                        ...(patch.sys ?? {}),
                        phase: cfg.phase,
                    };
                }

                if (cfg.sys) {
                    patch.sys = {
                        ...(patch.sys ?? {}),
                        ...cfg.sys,
                    };
                }

                // 应用额外字段（如 rollCount, dice, pendingAttack 等）
                if (cfg.extra) {
                    Object.assign(patch.core, cfg.extra);
                }

                // 应用状态
                await harness.state.set(patch);
            } else {
                const now = Date.now();
                const generateUid = (defId: string, index: number) => `${defId}_${now}_${index}`;

                const inferCardType = (defId: string): SmashUpCardType => {
                    if (defId.startsWith('action_')) return 'action';

                    const actionKeywords = [
                        'portal', 'time_loop', 'full_steam', 'cannon', 'broadside',
                        'disintegrate', 'augmentation', 'upgrade', 'power_up',
                        'terraform', 'crop_circles', 'abduction', 'probe',
                        'shamble', 'not_dead_yet', 'grave_digger',
                        'king', 'swashbuckling',
                        'ninjutsu', 'disguise', 'smoke_bomb',
                    ];

                    for (const keyword of actionKeywords) {
                        if (defId.includes(keyword)) return 'action';
                    }

                    return 'minion';
                };

                const normalizeCard = (entry: string | SmashUpCardSceneConfig) =>
                    typeof entry === 'string' ? { defId: entry } : entry;

                const buildCard = (entry: string | SmashUpCardSceneConfig, ownerId: string, index: number) => {
                    const card = normalizeCard(entry);
                    return {
                        uid: card.uid ?? generateUid(card.defId, index),
                        defId: card.defId,
                        type: card.type ?? inferCardType(card.defId),
                        owner: card.owner ?? ownerId,
                    };
                };

                const buildAttachedAction = (
                    entry: string | SmashUpAttachedActionSceneConfig,
                    ownerId: string,
                    index: number,
                ) => {
                    const action = typeof entry === 'string' ? { defId: entry } : entry;
                    const builtAction: any = {
                        uid: action.uid ?? generateUid(`${action.defId}_attached`, index),
                        defId: action.defId,
                        ownerId: action.ownerId ?? ownerId,
                    };
                    if (action.talentUsed !== undefined) {
                        builtAction.talentUsed = action.talentUsed;
                    }
                    if (action.metadata !== undefined) {
                        builtAction.metadata = action.metadata;
                    }
                    return builtAction;
                };

                const buildMinion = (minion: SmashUpMinionSceneConfig, ownerId: string, index: number) => {
                    const basePower = minion.basePower ?? minion.power ?? 1;
                    const builtMinion: any = {
                        uid: minion.uid ?? generateUid(minion.defId, index),
                        defId: minion.defId,
                        owner: minion.owner ?? ownerId,
                        controller: minion.controller ?? minion.owner ?? ownerId,
                        basePower,
                        powerCounters: minion.powerCounters ?? 0,
                        powerModifier: minion.powerModifier ?? 0,
                        tempPowerModifier: minion.tempPowerModifier ?? 0,
                        talentUsed: minion.talentUsed ?? false,
                        attachedActions: (minion.attachedActions ?? []).map((action, actionIndex) =>
                            buildAttachedAction(action, minion.owner ?? ownerId, index * 100 + actionIndex),
                        ),
                    };
                    if (minion.playedThisTurn !== undefined) {
                        builtMinion.playedThisTurn = minion.playedThisTurn;
                    }
                    return builtMinion;
                };

                const buildPlayerState = (playerConfig: any, playerId: string, offset: number) => {
                    const nextPlayerState: any = {};

                    if (playerConfig?.hand !== undefined) {
                        nextPlayerState.hand = (playerConfig.hand || []).map((entry: string | SmashUpCardSceneConfig, i: number) =>
                            buildCard(entry, playerId, offset + i),
                        );
                    }
                    if (playerConfig?.deck !== undefined) {
                        nextPlayerState.deck = (playerConfig.deck || []).map((entry: string | SmashUpCardSceneConfig, i: number) =>
                            buildCard(entry, playerId, offset + 1000 + i),
                        );
                    }
                    if (playerConfig?.discard !== undefined) {
                        nextPlayerState.discard = (playerConfig.discard || []).map((entry: string | SmashUpCardSceneConfig, i: number) =>
                            buildCard(entry, playerId, offset + 2000 + i),
                        );
                    }
                    if (playerConfig?.factions !== undefined) {
                        nextPlayerState.factions = [...playerConfig.factions];
                    }

                    const numericKeys = ['minionsPlayed', 'minionLimit', 'actionsPlayed', 'actionLimit', 'vp'];
                    for (const key of numericKeys) {
                        if (playerConfig?.[key] !== undefined) {
                            nextPlayerState[key] = playerConfig[key];
                        }
                    }

                    return nextPlayerState;
                };

                const fieldMinionsByBase = new Map<number, any[]>();
                const appendFieldMinions = (playerId: string, field: SmashUpMinionSceneConfig[] | undefined, offset: number) => {
                    for (const [index, minion] of (field ?? []).entries()) {
                        const bucket = fieldMinionsByBase.get(minion.baseIndex) ?? [];
                        bucket.push(buildMinion(minion, playerId, offset + index));
                        fieldMinionsByBase.set(minion.baseIndex, bucket);
                    }
                };

                appendFieldMinions('0', (cfg.player0 as PlayerSceneConfig | undefined)?.field, 3000);
                appendFieldMinions('1', (cfg.player1 as PlayerSceneConfig | undefined)?.field, 4000);

                const baseCount = Math.max(
                    state.core?.bases?.length ?? 0,
                    cfg.bases?.length ?? 0,
                    ...Array.from(fieldMinionsByBase.keys(), key => key + 1),
                );

                const bases = Array.from({ length: baseCount }, (_, baseIndex) => {
                    const currentBase = state.core?.bases?.[baseIndex] ?? {
                        defId: cfg.bases?.[baseIndex]?.defId ?? 'base_the_mothership',
                        minions: [],
                        ongoingActions: [],
                    };
                    const baseConfig = cfg.bases?.[baseIndex];
                    const fieldMinions = fieldMinionsByBase.get(baseIndex) ?? [];

                    const nextBase: any = {
                        ...currentBase,
                        defId: baseConfig?.defId ?? currentBase.defId,
                    };

                    // 复制基地配置的特定字段（breakpoint, power 等），但不覆盖 minions 和 ongoingActions
                    if (baseConfig) {
                        const { minions: _, ongoingActions: __, ...otherFields } = baseConfig;
                        Object.assign(nextBase, otherFields);
                    }

                    if (baseConfig?.minions !== undefined) {
                        nextBase.minions = [
                            ...baseConfig.minions.map((minion, index) => buildMinion(minion, minion.owner ?? '0', 5000 + baseIndex * 100 + index)),
                            ...fieldMinions,
                        ];
                    } else if (fieldMinions.length > 0) {
                        nextBase.minions = fieldMinions;
                    }

                    if (baseConfig?.ongoingActions !== undefined) {
                        nextBase.ongoingActions = baseConfig.ongoingActions.map((action, index) =>
                            buildAttachedAction(action, typeof action === 'string' ? '0' : action.ownerId ?? '0', 6000 + baseIndex * 100 + index),
                        );
                    }

                    return nextBase;
                });

                const patch: any = {
                    core: {
                        ...state.core, // 保留所有现有字段
                        players: {
                            ...state.core.players,
                        },
                        bases,
                        // 只有在 factionSelect 阶段才保留 factionSelection
                        ...(cfg.phase === 'factionSelect' ? {} : { factionSelection: undefined }),
                    },
                };

                if (cfg.player0) {
                    patch.core.players['0'] = {
                        ...state.core.players['0'],
                        ...buildPlayerState(cfg.player0, '0', 0),
                    };
                }
                if (cfg.player1) {
                    patch.core.players['1'] = {
                        ...state.core.players['1'],
                        ...buildPlayerState(cfg.player1, '1', 10000),
                    };
                }

                if (cfg.currentPlayer !== undefined) {
                    const playerIndex = parseInt(cfg.currentPlayer, 10);
                    patch.core.currentPlayerIndex = playerIndex;
                    // 确保 turnOrder 存在（默认双人游戏）
                    if (!patch.core.turnOrder) {
                        patch.core.turnOrder = ['0', '1'];
                    }
                }
                if (cfg.phase !== undefined) {
                    patch.sys = {
                        ...(patch.sys ?? {}),
                        phase: cfg.phase,
                    };

                    // 从派系选择直接注入到其他阶段时，必须清理残留的交互/响应窗口。
                    // 否则 factionSelect 初始态留下的 system state 仍可能阻塞 ADVANCE_PHASE，
                    // 导致 UI 看起来在 playCards，但点击“结束回合”没有任何效果。
                    if (cfg.phase !== 'factionSelect') {
                        patch.sys.interaction = {
                            ...(state.sys?.interaction ?? {}),
                            current: undefined,
                            queue: [],
                        };

                        if (!('responseWindow' in cfg)) {
                            patch.sys.responseWindow = {
                                current: undefined,
                            };
                        }
                    }
                    
                    // SmashUp 特殊处理：scoreBases 阶段需要设置 scoringEligibleBaseIndices
                    if (cfg.phase === 'scoreBases' && cfg.bases) {
                        // 计算达到临界点的基地
                        const eligibleIndices: number[] = [];
                        for (let i = 0; i < patch.core.bases.length; i++) {
                            const base = patch.core.bases[i];
                            const baseConfig = cfg.bases[i];
                            
                            // 计算基地总力量
                            // minion 的总力量 = basePower + powerCounters + powerModifier + tempPowerModifier
                            const totalPower = base.minions.reduce((sum: number, m: any) => {
                                const minionPower = (m.basePower || 0) + 
                                                   (m.powerCounters || 0) + 
                                                   (m.powerModifier || 0) + 
                                                   (m.tempPowerModifier || 0);
                                return sum + minionPower;
                            }, 0);
                            
                            // 从基地配置读取 breakpoint（如果提供），否则尝试从卡牌定义读取
                            let breakpoint = baseConfig?.breakpoint;
                            if (breakpoint === undefined) {
                                const baseDef = (window as any).__BG_CARD_REGISTRY__?.getBaseDef(base.defId);
                                breakpoint = baseDef?.breakpoint || 0;
                            }
                            
                            if (totalPower >= breakpoint) {
                                eligibleIndices.push(i);
                            }
                        }
                        patch.core.scoringEligibleBaseIndices = eligibleIndices;
                    }
                }
                if (cfg.sys) {
                    patch.sys = {
                        ...(patch.sys ?? {}),
                        ...cfg.sys,
                    };
                }
                if ('responseWindow' in cfg) {
                    patch.sys = {
                        ...(patch.sys ?? {}),
                        responseWindow: cfg.responseWindow
                            ? {
                                current: {
                                    id: cfg.responseWindow.id ?? `${cfg.responseWindow.windowType}_${now}`,
                                    windowType: cfg.responseWindow.windowType,
                                    sourceId: cfg.responseWindow.sourceId,
                                    responderQueue: cfg.responseWindow.responderQueue ?? ['0', '1'],
                                    currentResponderIndex: cfg.responseWindow.currentResponderIndex ?? 0,
                                    passedPlayers: cfg.responseWindow.passedPlayers ?? [],
                                    pendingInteractionId: cfg.responseWindow.pendingInteractionId,
                                    actionTakenThisRound: cfg.responseWindow.actionTakenThisRound ?? false,
                                    consecutivePassRounds: cfg.responseWindow.consecutivePassRounds ?? 0,
                                },
                            }
                            : { current: undefined },
                    };
                }
                if (cfg.extra) {
                    if (cfg.extra.core) {
                        // 保留自动计算的 scoringEligibleBaseIndices（如果存在）
                        const preservedScoring = patch.core.scoringEligibleBaseIndices;
                        patch.core = {
                            ...patch.core,
                            ...cfg.extra.core,
                        };
                        // 如果 extra.core 没有显式设置 scoringEligibleBaseIndices，恢复自动计算的值
                        if (preservedScoring !== undefined && cfg.extra.core.scoringEligibleBaseIndices === undefined) {
                            patch.core.scoringEligibleBaseIndices = preservedScoring;
                        }
                    }
                    if (cfg.extra.sys) {
                        patch.sys = {
                            ...(patch.sys ?? {}),
                            ...cfg.extra.sys,
                        };
                    }
                    if (!cfg.extra.core && !cfg.extra.sys) {
                        Object.assign(patch.core, cfg.extra);
                    }
                }

                await harness.state.patch(patch);
            }
        }, preparedConfig);

        // 等待 React 重新渲染
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

        const isCardStillInHand = async () => {
            return await this.page.evaluate((uid) => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                if (!state?.core?.turnOrder || state.core.currentPlayerIndex === undefined) {
                    return false;
                }
                const currentPlayerId = state.core.turnOrder[state.core.currentPlayerIndex];
                const player = state.core.players?.[currentPlayerId];
                return !!player?.hand?.some((card: any) => card.uid === uid);
            }, cardUid);
        };

        // 3. 如果需要选择目标基地，点击基地。
        // 基地选择 UI 进入有一拍延迟；首击如果太早，会导致卡仍停留在手牌中。
        // 这里基于“卡是否还在手牌”做一次轻量重试，减少 E2E 抖动。
        if (options?.targetBaseIndex !== undefined) {
            for (let attempt = 0; attempt < 3; attempt += 1) {
                await this.selectBase(options.targetBaseIndex);
                if (!(await isCardStillInHand())) {
                    break;
                }
                await this.page.waitForTimeout(250);
            }
        }

        // 4. 如果需要选择目标随从，点击随从
        if (options?.targetMinionUid) {
            await this.page.click(`[data-minion-uid="${options.targetMinionUid}"]`);
            await this.page.waitForTimeout(300);
        }
    }

    /**
     * 选择基地（用于基地高亮选择或常规落点选择）。
     */
    async selectBase(baseIndex: number): Promise<void> {
        await this.dismissRevealOverlayIfPresent();
        await this.page.click(`[data-base-index="${baseIndex}"]`);
        await this.page.waitForTimeout(300);
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
        await this.dismissRevealOverlayIfPresent();
        const cardLikeOption = this.page.locator(`[data-option-id="${optionId}"]`).first();
        try {
            await cardLikeOption.waitFor({ state: 'visible', timeout: 2000 });
            await cardLikeOption.click({ force: true });
            await this.page.waitForTimeout(300);
            return;
        } catch {
            // 卡牌选项不可见，继续尝试其他方式
        }

        const optionMeta = await this.page.evaluate((id) => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            const options = state?.sys?.interaction?.current?.data?.options ?? [];
            const option = options.find((entry: any) => entry.id === id);
            return {
                label: typeof option?.label === 'string' ? option.label : null,
                value: option?.value ?? null,
            };
        }, optionId);

        const optionCardUid = optionMeta?.value?.cardUid;
        if (typeof optionCardUid === 'string') {
            const handCardOption = this.page.locator(`[data-card-uid="${optionCardUid}"]`);
            if ((await handCardOption.count()) > 0) {
                await handCardOption.click({ force: true });
                await this.page.waitForTimeout(300);
                return;
            }
        }

        const optionLabel = optionMeta?.label;
        if (!optionLabel) {
            throw new Error(`Interaction option ${optionId} not found`);
        }

        try {
            const buttonOption = this.page.getByRole('button', { name: optionLabel }).first();
            await buttonOption.waitFor({ state: 'visible', timeout: 2000 });
            await buttonOption.click({ force: true });
            await this.page.waitForTimeout(300);
            return;
        } catch {
            // 按钮选项不可见，继续尝试其他方式
        }

        await this.page.evaluate((id) => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            const interaction = state?.sys?.interaction?.current;
            const options = interaction?.data?.options ?? [];
            const option = options.find((entry: any) => entry.id === id);

            if (!interaction || !option) {
                throw new Error(`Interaction option ${id} not found in current interaction`);
            }

            harness.command.dispatch({
                type: 'SYS_INTERACTION_RESPOND',
                playerId: interaction.playerId,
                payload: { optionId: id },
            });
        }, optionId);
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
        await this.dismissRevealOverlayIfPresent();
        await this.page.getByRole('button', { name: /^(确认|Confirm)(?:\s*\(\d+\))?$/i }).click({ force: true });
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
        await this.dismissRevealOverlayIfPresent();
        await this.page.getByRole('button', { name: /^(跳过|Skip)(?:\s*\(\d+\))?$/i }).click({ force: true });
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
        const legacyButton = this.page.locator('[data-action="advance-phase"]');
        if ((await legacyButton.count()) > 0) {
            await legacyButton.click({ force: true });
            await this.page.waitForTimeout(300);
            return;
        }

        await this.page.getByRole('button', { name: /^(结束回合|Finish Turn|End)$/i }).click({ force: true });
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
    async screenshot(name: string, testInfo: TestInfo): Promise<void> {
        const cleanupKey = `${testInfo.file}::${testInfo.title}`;
        if (!this.clearedEvidenceTests.has(cleanupKey)) {
            await clearEvidenceScreenshotsForTest(testInfo);
            this.clearedEvidenceTests.add(cleanupKey);
        }

        const path = getEvidenceScreenshotPath(testInfo, name, {
            filename: `${sanitizeEvidencePathSegment(name) || 'screenshot'}.png`,
        });
        await mkdir(dirname(path), { recursive: true });

        const withFileRetry = async (operation: () => Promise<void>) => {
            let lastError: unknown;
            for (let attempt = 0; attempt < 4; attempt++) {
                try {
                    await operation();
                    return;
                } catch (error) {
                    const code = (error as NodeJS.ErrnoException | undefined)?.code;
                    if (code !== 'EBUSY' && code !== 'EPERM') {
                        throw error;
                    }
                    lastError = error;
                    await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
                }
            }
            throw lastError;
        };

        await withFileRetry(() => this.page.screenshot({ path, fullPage: true }).then(() => undefined));
    }
}
