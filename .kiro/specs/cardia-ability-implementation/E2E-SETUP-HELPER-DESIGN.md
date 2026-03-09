# Cardia E2E 测试 - 通用Setup Helper设计

> **设计日期**: 2026-03-01  
> **目标**: 创建一个强大的通用测试helper，在setup阶段一次性配置完整的测试场景

---

## 设计目标

### 当前痛点
```typescript
// 当前方式：需要多次调用API
const setup = await setupCardiaOnlineMatch(browser);
await injectHandCards(p1Page, '0', [{ defId: 'deck_i_card_01' }]);
await injectHandCards(p2Page, '1', [{ defId: 'deck_i_card_03' }]);
await setPhase(p1Page, 'play');
await p1Page.waitForTimeout(500);
await p2Page.waitForTimeout(500);
```

### 改进目标
```typescript
// 新方式：一次性配置完整场景
const setup = await setupCardiaTestScenario(browser, {
    player1: {
        hand: ['deck_i_card_01', 'deck_i_card_02'],
        deck: ['deck_i_card_03', 'deck_i_card_04'], // 可选，控制抽牌
        playedCards: [], // 可选，模拟已打出的牌
        discard: [], // 可选，模拟弃牌堆
    },
    player2: {
        hand: ['deck_i_card_03'],
        deck: ['deck_i_card_05', 'deck_i_card_06'],
    },
    phase: 'play', // 可选，默认 'play'
    modifierTokens: [], // 可选，预设修正标记
    ongoingAbilities: [], // 可选，预设持续能力
});

// 直接开始测试
await playCard(setup.player1Page, 0);
```

---

## API 设计

### 核心函数：setupCardiaTestScenario

```typescript
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
 * // 完整场景：配置手牌、牌库、已打出的牌、修正标记
 * const setup = await setupCardiaTestScenario(browser, {
 *     player1: {
 *         hand: ['deck_i_card_01', 'deck_i_card_02'],
 *         deck: ['deck_i_card_03', 'deck_i_card_04'],
 *         playedCards: [
 *             { defId: 'deck_i_card_05', seals: 1 } // 已有1个印戒
 *         ],
 *     },
 *     player2: {
 *         hand: ['deck_i_card_06'],
 *         deck: ['deck_i_card_07'],
 *     },
 *     phase: 'ability',
 *     modifierTokens: [
 *         { cardId: 'xxx', value: 5, source: 'ability_i_surgeon' }
 *     ],
 * });
 */
export async function setupCardiaTestScenario(
    browser: Browser,
    scenario: CardiaTestScenario
): Promise<CardiaMatchSetup>;
```

### 类型定义

```typescript
/**
 * Cardia 测试场景配置
 */
export interface CardiaTestScenario {
    /** 玩家1配置 */
    player1: PlayerScenario;
    
    /** 玩家2配置 */
    player2: PlayerScenario;
    
    /** 游戏阶段（默认 'play'） */
    phase?: 'play' | 'ability' | 'draw';
    
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
    seals?: number;
    
    /** 持续标记（可选） */
    ongoingMarkers?: string[];
    
    /** 修正标记（可选，会自动添加到 modifierTokens） */
    modifiers?: Array<{ value: number; source: string }>;
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
    data?: any;
}
```

---

## 实现方案

### 步骤1：创建基础对局
```typescript
// 1. 使用现有的 setupOnlineMatch 创建基础对局
const baseSetup = await setupOnlineMatch(tempPage);
```

### 步骤2：构建完整状态
```typescript
// 2. 读取当前状态
const currentState = await readCoreState(baseSetup.player1Page);

// 3. 根据 scenario 构建新状态
const newState = buildStateFromScenario(currentState, scenario);
```

### 步骤3：注入状态
```typescript
// 4. 注入新状态到两个玩家页面
await applyCoreStateDirect(baseSetup.player1Page, newState);
await applyCoreStateDirect(baseSetup.player2Page, newState);

// 5. 等待UI更新
await baseSetup.player1Page.waitForTimeout(500);
await baseSetup.player2Page.waitForTimeout(500);
```

### 核心函数：buildStateFromScenario

```typescript
/**
 * 根据场景配置构建完整的游戏状态
 */
function buildStateFromScenario(
    baseState: any,
    scenario: CardiaTestScenario
): any {
    const state = JSON.parse(JSON.stringify(baseState)); // 深拷贝
    
    // 1. 配置玩家1
    state.players['0'] = buildPlayerState(
        state.players['0'],
        scenario.player1,
        '0'
    );
    
    // 2. 配置玩家2
    state.players['1'] = buildPlayerState(
        state.players['1'],
        scenario.player2,
        '1'
    );
    
    // 3. 设置阶段
    if (scenario.phase) {
        state.phase = scenario.phase;
    }
    
    // 4. 设置修正标记
    if (scenario.modifierTokens) {
        state.modifierTokens = scenario.modifierTokens;
    }
    
    // 5. 设置持续能力
    if (scenario.ongoingAbilities) {
        state.ongoingAbilities = scenario.ongoingAbilities;
    }
    
    // 6. 设置揭示顺序
    if (scenario.revealFirstNextEncounter) {
        state.revealFirstNextEncounter = scenario.revealFirstNextEncounter;
    }
    
    // 7. 设置当前遭遇
    if (scenario.currentEncounter) {
        state.currentEncounter = scenario.currentEncounter;
    }
    
    return state;
}

/**
 * 构建玩家状态
 */
function buildPlayerState(
    basePlayer: any,
    playerScenario: PlayerScenario,
    playerId: string
): any {
    const player = JSON.parse(JSON.stringify(basePlayer)); // 深拷贝
    
    // 1. 构建手牌
    player.hand = playerScenario.hand.map((defId, index) => 
        createCardInstance(defId, playerId, index)
    );
    
    // 2. 构建牌库（如果指定）
    if (playerScenario.deck) {
        player.deck = playerScenario.deck.map((defId, index) => 
            createCardInstance(defId, playerId, index + 1000)
        );
    }
    
    // 3. 构建已打出的牌（如果指定）
    if (playerScenario.playedCards) {
        player.playedCards = playerScenario.playedCards.map((card, index) => {
            const instance = createCardInstance(card.defId, playerId, index + 2000);
            instance.seals = card.seals || 0;
            instance.ongoingMarkers = card.ongoingMarkers || [];
            return instance;
        });
    }
    
    // 4. 构建弃牌堆（如果指定）
    if (playerScenario.discard) {
        player.discard = playerScenario.discard.map((defId, index) => 
            createCardInstance(defId, playerId, index + 3000)
        );
    }
    
    return player;
}

/**
 * 创建卡牌实例
 */
function createCardInstance(
    defId: string,
    ownerId: string,
    uniqueIndex: number
): any {
    // 需要在浏览器上下文中执行，访问 cardRegistry
    // 这部分逻辑会在 page.evaluate 中实现
    return {
        uid: `test_${ownerId}_${uniqueIndex}`,
        defId,
        ownerId,
        // 其他字段从 cardRegistry 获取
    };
}
```

---

## 使用示例

### 示例1：基础能力测试（雇佣剑士）
```typescript
test('影响力1 - 雇佣剑士：完整回合流程', async ({ browser }) => {
    const setup = await setupCardiaTestScenario(browser, {
        player1: {
            hand: ['deck_i_card_01', 'deck_i_card_02'], // 雇佣剑士 + 备用牌
            deck: ['deck_i_card_03', 'deck_i_card_04'], // 确保有牌可抽
        },
        player2: {
            hand: ['deck_i_card_03', 'deck_i_card_05'], // 外科医生 + 备用牌
            deck: ['deck_i_card_06', 'deck_i_card_07'],
        },
        phase: 'play', // 从打牌阶段开始
    });
    
    try {
        // 直接开始测试，无需手动注入
        await playCard(setup.player1Page, 0);
        await playCard(setup.player2Page, 0);
        
        // ... 后续测试逻辑
    } finally {
        await setup.player1Context.close();
        await setup.player2Context.close();
    }
});
```

### 示例2：复杂场景测试（调停者 + 已有印戒）
```typescript
test('影响力4 - 调停者：平局时归还印戒', async ({ browser }) => {
    const setup = await setupCardiaTestScenario(browser, {
        player1: {
            hand: ['deck_i_card_04'], // 调停者
            playedCards: [
                { defId: 'deck_i_card_01', seals: 1 }, // 之前的牌，有1个印戒
            ],
        },
        player2: {
            hand: ['deck_i_card_10'], // 傀儡师
            playedCards: [
                { defId: 'deck_i_card_03', seals: 2 }, // 之前的牌，有2个印戒
            ],
        },
        phase: 'play',
    });
    
    try {
        // 测试调停者能力是否正确归还印戒
        await playCard(setup.player1Page, 0);
        await playCard(setup.player2Page, 0);
        
        // 验证印戒归还
        const state = await readCoreState(setup.player1Page);
        const p2NewCard = state.players['1'].playedCards[1]; // 第二张牌
        expect(p2NewCard.seals).toBe(0); // 印戒被归还
    } finally {
        await setup.player1Context.close();
        await setup.player2Context.close();
    }
});
```

### 示例3：修正标记测试（外科医生 + 预设修正）
```typescript
test('影响力3 - 外科医生：修正标记叠加', async ({ browser }) => {
    const p1CardUid = 'test_0_1000';
    
    const setup = await setupCardiaTestScenario(browser, {
        player1: {
            hand: ['deck_i_card_03'], // 外科医生
            playedCards: [
                { 
                    defId: 'deck_i_card_01',
                    modifiers: [{ value: 3, source: 'test' }] // 已有+3修正
                },
            ],
        },
        player2: {
            hand: ['deck_i_card_10'],
        },
        modifierTokens: [
            { cardId: p1CardUid, value: 3, source: 'test' }
        ],
        phase: 'play',
    });
    
    try {
        // 测试外科医生能否在已有修正的基础上继续添加
        // ...
    } finally {
        await setup.player1Context.close();
        await setup.player2Context.close();
    }
});
```

---

## 实现优先级

### P0：核心功能（必须）
- [x] 设计API和类型定义
- [ ] 实现 `setupCardiaTestScenario` 函数
- [ ] 实现 `buildStateFromScenario` 函数
- [ ] 实现 `buildPlayerState` 函数
- [ ] 实现 `createCardInstance` 函数（浏览器上下文）
- [ ] 基础测试验证

**估算时间**: 3小时

### P1：增强功能（推荐）
- [ ] 支持修正标记预设
- [ ] 支持持续能力预设
- [ ] 支持当前遭遇预设
- [ ] 支持揭示顺序预设
- [ ] 添加验证函数（确保配置合法）

**估算时间**: 2小时

### P2：便利功能（可选）
- [ ] 添加预设场景模板（常见测试场景）
- [ ] 添加快照功能（保存/恢复场景）
- [ ] 添加场景可视化（生成场景描述）

**估算时间**: 2小时

---

## 优势分析

### 代码简化
**改进前**:
```typescript
// 需要 8-10 行代码
const setup = await setupCardiaOnlineMatch(browser);
await injectHandCards(p1Page, '0', [{ defId: 'deck_i_card_01' }]);
await injectHandCards(p2Page, '1', [{ defId: 'deck_i_card_03' }]);
await setPhase(p1Page, 'play');
await p1Page.waitForTimeout(500);
await p2Page.waitForTimeout(500);
```

**改进后**:
```typescript
// 只需 1 行代码
const setup = await setupCardiaTestScenario(browser, {
    player1: { hand: ['deck_i_card_01'] },
    player2: { hand: ['deck_i_card_03'] },
});
```

**代码减少**: 约 80%

### 可读性提升
- ✅ 场景配置一目了然
- ✅ 类型安全（TypeScript 自动补全）
- ✅ 减少重复代码
- ✅ 易于维护和修改

### 测试稳定性
- ✅ 一次性注入，减少中间状态
- ✅ 减少 `waitForTimeout` 调用
- ✅ 状态一致性更好

---

## 向后兼容

保留现有的 API，新旧方式可以共存：

```typescript
// 旧方式（仍然可用）
const setup = await setupCardiaOnlineMatch(browser);
await injectHandCards(p1Page, '0', [{ defId: 'deck_i_card_01' }]);

// 新方式（推荐）
const setup = await setupCardiaTestScenario(browser, {
    player1: { hand: ['deck_i_card_01'] },
    player2: { hand: ['deck_i_card_03'] },
});
```

---

## 下一步行动

1. **立即**：实现 P0 核心功能（3小时）
2. **短期**：实现 P1 增强功能（2小时）
3. **中期**：迁移现有测试使用新API（可选）
4. **长期**：实现 P2 便利功能（可选）

---

## 总结

**核心价值**:
- 代码量减少 80%
- 可读性大幅提升
- 测试稳定性更好
- 类型安全

**工作量**:
- P0（核心）: 3小时
- P1（增强）: 2小时
- 总计: 5小时

**推荐方案**: 先实现 P0，验证可行性后再实现 P1

