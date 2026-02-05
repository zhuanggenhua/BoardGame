# 召唤师战争 (Summoner Wars) UI 设计规范

> **游戏类型**：战棋卡牌游戏（类似游戏王电子游戏 + 战棋）
> **核心特点**：实体卡牌、点击交互、网格战场
> **UI 状态**：布局已完成，聚焦交互逻辑与动画反馈
> **游戏模式**：仅支持在线对战（`allowLocalMode: false`），无本地同屏模式

---

## 核心概念

### 实体卡牌系统
- **物理卡牌**：手牌和棋盘上的单位是**同一张物理卡牌**（不是杀戮尖塔那种"打出后消失"的卡牌）
- **精灵图集**：所有卡牌图像存储在精灵图集中，通过 `frameIndex` 切割显示
- **统一渲染**：手牌区和棋盘区使用**同一套 `CardSprite` / `LegacyCardSprite` 组件**

### 交互模式（类游戏王）
- **点击选中**：点击手牌选中 → 点击目标位置放置（**不是拖拽**）
- **两步操作**：选中 → 确认
- **取消选中**：再次点击已选中的卡牌，或点击空白区域

---

## 当前 UI 布局（已完成）

布局已在 `Board.tsx` 中实现，包含：
- 地图层：`MapContainer` + 网格 + 单位精灵图
- 左下：玩家名 + 魔力条 + 抽牌堆
- 右上：对手名 + 魔力条
- 右侧：阶段追踪器 `PhaseTracker`
- 右下：结束阶段按钮 + 弃牌堆
- 底部中央：提示横幅 `ActionBanner`
- 底部：手牌区 `HandArea`

**注意**：布局不需要改动，后续工作聚焦于交互逻辑和动画。

---

## 待实现：手牌交互重构

### 当前问题
`HandArea.tsx` 使用了拖拽交互（`drag={true}`），需要改为点击选中模式。

### 目标交互流程

#### 召唤阶段
```
1. 点击手牌中的单位卡 → 卡牌上移 + 金色边框高亮
2. 棋盘显示可召唤位置（城门相邻空格）→ 绿色高亮
3. 点击目标格子 → 执行召唤命令
4. 播放召唤动画（卡牌飞向目标格子）
5. 扣除魔力 → 魔力条动画
```

#### 魔力阶段（弃牌换魔力）
```
1. 点击手牌选中要弃置的卡牌（可多选）
2. 选中的卡牌上移高亮
3. 点击"确认弃牌"按钮
4. 播放弃牌动画 → 魔力+N
```

### 手牌状态样式
| 状态 | 样式 |
|------|------|
| 默认 | 正常显示 |
| 悬停 | 上移 + 轻微放大 |
| 选中 | 上移 20px + 金色边框 + 发光 |
| 费用不足 | opacity: 0.5 |
| 不可打出 | 灰度处理 |

---

## 待实现：棋盘交互

### 格子高亮状态
| 状态 | 颜色 | 触发条件 |
|------|------|----------|
| 可召唤 | 绿色半透明 | 选中手牌单位时，城门相邻空格 |
| 选中单位 | 金色边框 | 点击己方单位 |
| 可移动 | 蓝色半透明 | 选中单位后，1-2格内空格 |
| 可攻击 | 红色半透明 | 选中单位后，攻击范围内敌方 |

### 单位状态显示
| 状态 | 显示方式 |
|------|----------|
| 伤害 | 红色数字叠加在卡牌右上角 |
| 增益 | 蓝色标记叠加在卡牌左上角 |
| 已行动 | 半透明 + 轻微灰度 |

---

## 动画规范

### 卡牌动画
| 动画 | 时长 | 缓动 | 说明 |
|------|------|------|------|
| 选中上移 | 200ms | ease-out | 手牌选中时上移 |
| 召唤飞行 | 400ms | ease-in-out | 从手牌飞向棋盘 |
| 移动滑动 | 300ms | ease-out | 单位在棋盘移动 |
| 攻击抖动 | 150ms | ease-in-out | 攻击时单位抖动 |
| 受伤闪烁 | 200ms | linear | 受伤时红色闪烁 |
| 死亡淡出 | 500ms | ease-out | 单位被摧毁 |
| 弃牌飞行 | 300ms | ease-in | 飞向弃牌堆 |

### 特效动画
| 特效 | 说明 |
|------|------|
| 伤害飘字 | 红色数字从目标上方飘出 |
| 魔力变化 | 魔力条闪烁 + 数字变化 |
| 回合开始 | 屏幕中央显示"你的回合" |
| 阶段切换 | 阶段指示器高亮切换 |

---

## 数据需求（等待用户提供）

### 精灵图集配置
需要每张卡牌在精灵图集中的 `frameIndex`，格式示例：
```typescript
interface CardSpriteMapping {
  cardId: string;      // 卡牌唯一ID
  atlasId: string;     // 精灵图集ID（如 'sw:necromancer'）
  frameIndex: number;  // 在图集中的帧索引
}
```

### 卡牌属性数据
已有基础结构（`necromancer.ts`），需要补充完整数据：
- 所有派系的召唤师、冠军、普通单位
- 事件卡、建筑卡
- 每张卡对应的精灵图 frameIndex

---

## 实现任务清单

### 交互重构
- [ ] `HandArea` 改为点击选中模式（移除 drag）
- [ ] 使用 `CardSprite` 渲染手牌（精灵图）
- [ ] 实现选中状态管理（单选/多选）
- [ ] 棋盘格子高亮联动（选中手牌时显示可召唤位置）

### 动画实现
- [ ] 召唤动画（手牌飞向棋盘）
- [ ] 移动动画（单位滑动）
- [ ] 攻击动画（抖动 + 伤害飘字）
- [ ] 弃牌动画（飞向弃牌堆）

### 数据接入
- [ ] 导入完整精灵图集配置
- [ ] 导入完整卡牌属性数据
- [ ] 建立 cardId → frameIndex 映射

---

## 资源目录结构（多阵营扩展）

### 阵营资源组织
```
public/assets/summonerwars/hero/
├── Necromancer/              # 堕落王国（亡灵法师）
│   ├── hero.png              # 召唤师 + 传送门（2张卡合图）
│   ├── cards.png             # 该阵营所有卡牌精灵图集
│   ├── tip.png               # 阵营提示/说明图
│   └── compressed/           # 压缩后资源（自动生成）
│       ├── hero.avif/webp
│       ├── cards.avif/webp
│       └── tip.avif/webp
├── Phoenix/                  # 凤凰精灵（示例）
│   ├── hero.png
│   ├── cards.png
│   └── compressed/
├── Tundra/                   # 冰原兽人（示例）
│   └── ...
└── ...                       # 更多阵营
```

### 资源命名规范
| 文件 | 说明 |
|------|------|
| `hero.png` | 召唤师卡 + 传送门卡（固定 2 张，横向排列） |
| `cards.png` | 该阵营所有其他卡牌（冠军、普通单位、事件卡）精灵图集 |
| `tip.png` | 阵营介绍/技能提示图（可选） |

### 精灵图集切割规则
- **hero.png**：固定 2 列（召唤师 | 传送门），按 `frameIndex` 0/1 切割
- **cards.png**：按行列网格切割，需配置 `columns` 和 `rows`

---

## 自定义牌组系统（扩展性设计）

### 设计目标
支持玩家在未来自行构建牌组，而非仅使用预设阵营牌组。

### 牌组构建规则
```typescript
interface DeckBuildingRules {
  // 牌组必须包含 1 个召唤师
  summonerCount: 1;
  
  // 传送门数量（通常 3 张）
  portalCount: 3;
  
  // 牌组总卡牌数（不含召唤师和起始传送门）
  deckSize: { min: 30, max: 40 };
  
  // 同名卡牌上限
  sameCardLimit: 3;
  
  // 阵营限制（可选：纯阵营 / 混合阵营）
  factionRestriction: 'pure' | 'mixed';
  
  // 混合阵营时，主阵营卡牌最低比例
  primaryFactionRatio?: 0.6;
}
```

### 数据结构扩展
```typescript
// 卡牌定义（已有）
interface CardDefinition {
  id: string;
  cardType: 'unit' | 'event' | 'structure';
  faction: string;           // 所属阵营
  deckSymbols: string[];     // 牌组符号（用于混合阵营判定）
  // ... 其他属性
}

// 玩家牌组（新增）
interface PlayerDeck {
  id: string;
  name: string;
  ownerId: string;           // 玩家 ID
  summoner: string;          // 召唤师卡 ID
  cards: DeckEntry[];        // 牌组卡牌列表
  createdAt: Date;
  updatedAt: Date;
}

interface DeckEntry {
  cardId: string;            // 卡牌定义 ID
  count: number;             // 数量（1-3）
}

// 阵营定义（新增）
interface FactionDefinition {
  id: string;                // 如 'necromancer', 'phoenix'
  name: string;              // 显示名称
  symbol: string;            // 阵营符号
  assetPath: string;         // 资源路径前缀
  summoners: string[];       // 可用召唤师 ID 列表
  portalCardId: string;      // 传送门卡 ID
}
```

### 资源加载策略
```typescript
// 按需加载阵营资源（避免一次性加载所有阵营）
async function loadFactionAssets(factionId: string): Promise<FactionAssets> {
  const basePath = `summonerwars/hero/${factionId}`;
  return {
    heroAtlas: await loadAtlas(`${basePath}/hero`),      // 召唤师+传送门
    cardsAtlas: await loadAtlas(`${basePath}/cards`),   // 所有卡牌
    tip: await loadImage(`${basePath}/tip`),            // 可选
  };
}

// 对局开始时，仅加载双方阵营资源
async function loadMatchAssets(player1Faction: string, player2Faction: string) {
  const [p1Assets, p2Assets] = await Promise.all([
    loadFactionAssets(player1Faction),
    loadFactionAssets(player2Faction),
  ]);
  return { player1: p1Assets, player2: p2Assets };
}
```

### 牌组编辑器（未来功能）
- 阵营选择 → 召唤师选择 → 卡牌池浏览 → 拖拽/点击添加
- 实时校验牌组合法性
- 保存到用户账户 / 导出为 JSON

---

## 参考

- 游戏王 Master Duel（点击选中交互、牌组构建）
- 炉石传说（动画反馈、牌组编辑器）
- 原版 Summoner Wars 桌游
