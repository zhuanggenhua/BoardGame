# 《璀璨宝石》AI 对手完整技术方案（改进版）

> 基于原方案评审，针对量纲统一、路线系统简化、lookahead 精简、贵族连续权重、丢弃逻辑补全、难度噪声模型重设计等问题进行全面改进。

---

## 目录

1. [核心设计原则](#1-核心设计原则)
2. [游戏状态模型](#2-游戏状态模型)
3. [合法行动生成与剪枝](#3-合法行动生成与剪枝)
4. [评分系统（归一化量纲）](#4-评分系统归一化量纲)
5. [目标卡机制](#5-目标卡机制)
6. [行为连贯性：隐式路线系统](#6-行为连贯性隐式路线系统)
7. [游戏阶段判定](#7-游戏阶段判定)
8. [经济控制策略](#8-经济控制策略)
9. [丢弃宝石逻辑（补全）](#9-丢弃宝石逻辑补全)
10. [对手威胁判断](#10-对手威胁判断)
11. [轻量 Lookahead（精简版）](#11-轻量-lookahead精简版)
12. [难度系统重设计](#12-难度系统重设计)
13. [多人局策略调整](#13-多人局策略调整)
14. [可解释性日志](#14-可解释性日志)
15. [测试与调参框架](#15-测试与调参框架)
16. [推荐开发顺序](#16-推荐开发顺序)
17. [完整难度配置参数表](#17-完整难度配置参数表)

---

## 1. 核心设计原则

在进入具体实现之前，先明确几条贯穿全文的设计原则。

**原则 1：统一量纲，再谈权重。**
所有评分维度的输出必须归一化到 `[0, 100]` 区间，权重系数才有可比性。否则一个"红利价值 = 15"和"直接得分 = 3"无法直接相加，调参时会完全失去直觉。

**原则 2：行为连贯性通过"历史惯性"实现，而非显式路线状态。**
不维护一个"当前路线"变量，而是让 AI 的历史行为通过动量系数隐性影响下一步的权重。实现成本低，行为更自然，同时避免了"路线锁死导致应变迟钝"的问题。

**原则 3：低难度的失误要有规律，而不是纯随机。**
简单/普通难度的 AI 不是随机犯错，而是系统性地忽略某些信息维度。这样玩家可以识别出 AI 的弱点并加以利用，游戏体验更好。

**原则 4：Lookahead 只解决"能不能买到已知目标"的问题。**
不对未知牌堆做完整状态预测，避免在不完全信息上做伪精确计算。

**原则 5：贵族意识从第一回合就存在，只是权重极低。**
用连续权重函数替代硬阈值，距离越近权重越高。

---

## 2. 游戏状态模型

AI 决策所需的完整状态快照。

```typescript
// 颜色枚举（5种宝石 + 黄金）
type GemColor = "white" | "blue" | "green" | "red" | "black";
type AllColor = GemColor | "gold";

// 宝石数量映射
type GemMap = Record<GemColor, number>;

// 发展卡
interface DevelopmentCard {
  id: string;
  tier: 1 | 2 | 3;
  points: number;
  bonus: GemColor; // 该卡提供的红利颜色
  cost: GemMap; // 购买费用
}

// 贵族
interface Noble {
  id: string;
  points: number; // 固定为 3
  requirement: GemMap; // 需要的红利数量（按颜色）
}

// 单个玩家状态
interface PlayerState {
  id: string;
  isAI: boolean;
  score: number;
  gems: GemMap;
  gold: number;
  bonuses: GemMap; // 已购买卡的红利汇总
  reservedCards: DevelopmentCard[];
  ownedNobles: Noble[];
}

// 场面状态
interface BoardState {
  visibleCards: {
    tier1: (DevelopmentCard | null)[]; // 4 张，null 表示该位置已售出且牌堆空
    tier2: (DevelopmentCard | null)[];
    tier3: (DevelopmentCard | null)[];
  };
  deckSizes: { tier1: number; tier2: number; tier3: number };
  bankGems: GemMap;
  bankGold: number;
  nobles: Noble[];
  playerCount: number;
}

// AI 决策时的完整视图
interface GameView {
  self: PlayerState;
  opponents: PlayerState[];
  board: BoardState;
  roundNumber: number;
}
```

---

## 3. 合法行动生成与剪枝

### 3.1 行动类型定义

```typescript
type Action =
  | { type: "TAKE_THREE"; gems: [GemColor, GemColor, GemColor] }
  | { type: "TAKE_TWO"; gem: GemColor }
  | { type: "RESERVE"; card: DevelopmentCard }
  | { type: "BUY"; card: DevelopmentCard; isFromHand: boolean }
  | { type: "PASS" }; // 极端情况：无法执行任何有意义的行动
```

### 3.2 合法性规则

```typescript
function isLegal(action: Action, view: GameView): boolean {
  const { self, board } = view;
  const totalGems = sumGems(self.gems) + self.gold;

  switch (action.type) {
    case "TAKE_THREE":
      // 三色各不相同，每色银行至少有 1 个
      return (
        action.gems.every((c) => board.bankGems[c] >= 1) &&
        new Set(action.gems).size === 3
      );

    case "TAKE_TWO":
      // 该颜色银行至少 4 个
      return board.bankGems[action.gem] >= 4;

    case "RESERVE":
      // 手牌不超过 3 张
      return self.reservedCards.length < 3;

    case "BUY":
      // 宝石 + 黄金 + 红利 >= 成本
      return canAfford(action.card, self);
  }
}

function canAfford(card: DevelopmentCard, player: PlayerState): boolean {
  let goldNeeded = 0;
  for (const color of GEM_COLORS) {
    const have = player.gems[color] + player.bonuses[color];
    const need = card.cost[color];
    if (have < need) goldNeeded += need - have;
  }
  return goldNeeded <= player.gold;
}
```

### 3.3 行动剪枝策略

生成合法行动后，对行动空间过大的类型做剪枝。

```typescript
function generateCandidates(
  view: GameView,
  config: DifficultyConfig,
): Action[] {
  const allActions: Action[] = [];

  // BUY：全部保留，数量有限（最多 4+4+4+3=15 张）
  allActions.push(...generateBuyActions(view));

  // TAKE_TWO：只生成银行 >=4 的颜色，无需剪枝（最多 5 个）
  allActions.push(...generateTakeTwoActions(view));

  // TAKE_THREE：按"对目标卡的帮助度"排序后取 top-K
  const takeThreeActions = generateTakeThreeActions(view);
  const scored = takeThreeActions.map((a) => ({
    action: a,
    helpScore: calcTakeThreeHelpScore(a, view),
  }));
  scored.sort((a, b) => b.helpScore - a.helpScore);
  allActions.push(
    ...scored.slice(0, config.takeThreeTopK).map((s) => s.action),
  );

  // RESERVE：排除明显无价值的保留（0分 Tier1、AI 完全不需要的颜色）
  const reserveActions = generateReserveActions(view, config);
  allActions.push(...reserveActions);

  return allActions;
}
```

**`calcTakeThreeHelpScore`** 的计算逻辑：

```typescript
function calcTakeThreeHelpScore(
  action: { type: "TAKE_THREE"; gems: [GemColor, GemColor, GemColor] },
  view: GameView,
): number {
  // 拿完之后，所有目标卡的"缺口减少量"之和
  const targets = getTargetCards(view);
  let totalReduction = 0;
  for (const card of targets) {
    for (const gem of action.gems) {
      const shortage = Math.max(
        0,
        card.cost[gem] -
          view.self.gems[gem] -
          view.self.bonuses[gem] -
          view.self.gold,
      );
      if (shortage > 0) totalReduction += 1;
    }
  }
  return totalReduction;
}
```

---

## 4. 评分系统（归一化量纲）

**所有子评分函数输出范围统一为 `[0, 100]`**，权重系数才具有可比性。最终总分理论上限约 600~800 分（各维度满分之和），用于加权随机时会再归一化。

### 4.1 评分维度总览

| 维度       | 函数           | 输出范围 | 说明                           |
| ---------- | -------------- | -------- | ------------------------------ |
| 直接得分   | `scorePoints`  | 0~100    | 买卡立即获得的分数             |
| 红利价值   | `scoreBonus`   | 0~100    | 红利对后续购买的降费价值       |
| 贵族进度   | `scoreNoble`   | 0~100    | 连续权重，距离越近越高         |
| 目标卡距离 | `scoreTarget`  | 0~100    | 行动后距离目标卡的接近程度     |
| 黄金价值   | `scoreGold`    | 0~100    | 保留卡获得黄金的价值（含衰减） |
| 对手阻止   | `scoreBlock`   | 0~100    | 抢走/封堵对手关键资源          |
| 终局加速   | `scoreEndgame` | 0~100    | 接近终局时直接得分的额外奖励   |
| 浪费惩罚   | `penaltyWaste` | 0~(-100) | 超过 10 个宝石或拿无用颜色     |

### 4.2 各维度实现

#### 直接得分

```typescript
function scorePoints(action: Action, view: GameView): number {
  if (action.type !== "BUY") return 0;
  // 归一化：Tier3 最高分约为 5，映射到 100
  return Math.min(100, (action.card.points / 5) * 100);
}
```

#### 红利价值

红利价值 = 该颜色在场上所有可见卡中的需求密度（越多卡需要该颜色，红利越值钱）。

```typescript
function scoreBonus(action: Action, view: GameView): number {
  if (action.type !== "BUY") return 0;
  const color = action.card.bonus;
  // 统计场上所有可见卡对该颜色的总需求量
  const allVisible = getAllVisibleCards(view.board);
  const totalDemand = allVisible.reduce((sum, c) => sum + c.cost[color], 0);
  // 当前 AI 已有多少该颜色红利（已有越多，边际价值越低）
  const existing = view.self.bonuses[color];
  const marginalValue = totalDemand * Math.max(0, 1 - existing * 0.15);
  // 归一化：经验上 totalDemand 最高约 30
  return Math.min(100, (marginalValue / 30) * 100);
}
```

#### 贵族进度（连续权重，替代硬阈值）

```typescript
function scoreNoble(action: Action, view: GameView): number {
  if (action.type !== "BUY") return 0;

  const card = action.card;
  let maxNobleScore = 0;

  for (const noble of view.board.nobles) {
    // 跳过已被其他玩家获得的贵族
    if (isNobleOwned(noble, view)) continue;

    // 购买该卡后，距离该贵族还差几张红利卡
    const gapAfter = calcNobleGap(noble, view.self.bonuses, card.bonus);

    // 连续权重函数：gap=0 → 100分，gap=1 → 70分，gap=2 → 40分，gap=3 → 20分，gap>=4 → 5分
    const nobleScore = nobleGapToScore(gapAfter);
    maxNobleScore = Math.max(maxNobleScore, nobleScore);
  }

  return maxNobleScore;
}

function nobleGapToScore(gap: number): number {
  // 指数衰减曲线：gap 越大，分越低，但永不为 0
  if (gap === 0) return 100;
  return Math.max(5, 100 * Math.pow(0.55, gap));
}

function calcNobleGap(
  noble: Noble,
  currentBonuses: GemMap,
  addedColor: GemColor,
): number {
  const projected = { ...currentBonuses };
  projected[addedColor] = (projected[addedColor] || 0) + 1;
  let gap = 0;
  for (const color of GEM_COLORS) {
    gap += Math.max(
      0,
      (noble.requirement[color] || 0) - (projected[color] || 0),
    );
  }
  return gap;
}
```

#### 目标卡距离

```typescript
function scoreTarget(action: Action, view: GameView): number {
  const targets = getTargetCards(view); // 见第 5 节
  if (targets.length === 0) return 0;

  let bestImprovement = 0;

  for (const target of targets) {
    // 行动执行前，距离该目标卡还差多少宝石
    const gapBefore = calcGemGap(target, view.self);

    // 模拟行动后的状态
    const simSelf = simulateAction(action, view.self);
    const gapAfter = calcGemGap(target, simSelf);

    // 改善量（gap 减少的绝对值）
    const improvement = gapBefore - gapAfter;
    bestImprovement = Math.max(bestImprovement, improvement);
  }

  // 归一化：最大 gap 约为 10（最贵的 Tier3 卡）
  return Math.min(100, (bestImprovement / 10) * 100);
}

function calcGemGap(card: DevelopmentCard, player: PlayerState): number {
  let gap = 0;
  for (const color of GEM_COLORS) {
    const have = player.gems[color] + player.bonuses[color];
    gap += Math.max(0, card.cost[color] - have);
  }
  return Math.max(0, gap - player.gold);
}
```

#### 黄金价值（含衰减）

```typescript
function scoreGold(action: Action, view: GameView): number {
  if (action.type !== "RESERVE") return 0;
  if (view.board.bankGold <= 0) return 0;

  // 已有黄金越多，边际价值越低
  const existing = view.self.gold;
  const decayFactor = Math.max(0, 1 - existing * 0.22); // 0金→1.0，2金→0.56，4金→0.12
  return 60 * decayFactor; // 基础黄金价值 60 分
}
```

#### 对手阻止

```typescript
function scoreBlock(
  action: Action,
  view: GameView,
  config: DifficultyConfig,
): number {
  if (config.opponentThreatWeight === 0) return 0;

  const threat = getMostDangerousOpponent(view, config); // 见第 10 节
  if (!threat) return 0;

  let blockScore = 0;

  if (action.type === "BUY" || action.type === "RESERVE") {
    const card = action.card;
    // 对手是否在下 1~2 回合内能买到这张卡
    const opponentGap = calcGemGap(card, threat);
    if (opponentGap <= 1) blockScore = 100;
    else if (opponentGap <= 3) blockScore = 50;
  }

  if (action.type === "TAKE_THREE" || action.type === "TAKE_TWO") {
    // 拿走对手缺的颜色（较弱的阻止）
    const neededByOpponent = calcOpponentNeededColors(threat, view.board);
    const takenColors =
      action.type === "TAKE_THREE" ? action.gems : [action.gem];
    const overlap = takenColors.filter((c) =>
      neededByOpponent.includes(c),
    ).length;
    blockScore = overlap * 15; // 每个重叠颜色 15 分
  }

  return Math.min(100, blockScore);
}
```

#### 终局加速

```typescript
function scoreEndgame(
  action: Action,
  view: GameView,
  config: DifficultyConfig,
): number {
  if (action.type !== "BUY") return 0;

  const maxScore = Math.max(
    view.self.score,
    ...view.opponents.map((o) => o.score),
  );
  if (maxScore < config.endgameThreshold) return 0;

  // 自己距离 15 分还差多少
  const selfGap = 15 - view.self.score;
  if (selfGap <= 0) return 0;

  // 买这张卡后还差多少
  const newSelfGap = Math.max(0, selfGap - action.card.points);
  const urgency = (selfGap - newSelfGap) / selfGap; // 0~1

  return urgency * 100;
}
```

#### 浪费惩罚

```typescript
function penaltyWaste(action: Action, view: GameView): number {
  let penalty = 0;

  if (action.type === "TAKE_THREE" || action.type === "TAKE_TWO") {
    const takenColors =
      action.type === "TAKE_THREE" ? action.gems : [action.gem, action.gem];
    const totalAfter =
      sumGems(view.self.gems) + view.self.gold + takenColors.length;

    // 超过 10 个宝石需要丢弃
    if (totalAfter > 10) {
      const overflow = totalAfter - 10;
      penalty += overflow * 20; // 每多 1 个扣 20 分
    }

    // 拿的颜色对所有目标卡都无帮助
    const targets = getTargetCards(view);
    const uselessColors = takenColors.filter((c) =>
      targets.every((t) => calcColorHelpForCard(c, t, view.self) === 0),
    );
    penalty += uselessColors.length * 15;
  }

  return Math.min(100, penalty); // 惩罚上限 100，返回正数，调用处取负
}
```

### 4.3 总评分公式

```typescript
function scoreAction(
  action: Action,
  view: GameView,
  config: DifficultyConfig,
  phase: GamePhase,
  momentum: MomentumState, // 见第 6 节
): number {
  const phaseWeights = getPhaseWeights(phase); // 见第 7 节
  const momentumMult = getMomentumMultiplier(action, momentum); // 见第 6 节

  const raw =
    scorePoints(action, view) * phaseWeights.points * config.pointsMultiplier +
    scoreBonus(action, view) *
      phaseWeights.bonus *
      config.bonusMultiplier *
      momentumMult.bonus +
    scoreNoble(action, view) * config.nobleMultiplier +
    scoreTarget(action, view) * momentumMult.target +
    scoreGold(action, view) +
    scoreBlock(action, view, config) +
    scoreEndgame(action, view, config) -
    penaltyWaste(action, view);

  return raw;
}
```

---

## 5. 目标卡机制

AI 每回合动态计算当前"值得追求"的目标卡集合。

### 5.1 目标卡价值评估

```typescript
function evalTargetValue(
  card: DevelopmentCard,
  view: GameView,
  config: DifficultyConfig,
): number {
  // 1. 卡牌分数价值（归一化）
  const pointScore = (card.points / 5) * 100;

  // 2. 红利颜色价值（该颜色在场上的需求密度）
  const allVisible = getAllVisibleCards(view.board);
  const demand = allVisible.reduce((s, c) => s + c.cost[card.bonus], 0);
  const bonusScore = Math.min(100, (demand / 25) * 100);

  // 3. 贵族相关价值（该颜色对最近贵族的贡献）
  const nobleScore = calcBonusNobleValue(card.bonus, view);

  // 4. 购买距离（还差几个宝石，gap 越小越好）
  const gap = calcGemGap(card, view.self);
  const distancePenalty = gap * 12; // 每差 1 个宝石扣 12 分

  // 5. 等级加成（高等级卡在后期有额外加分）
  const tierBonus = (card.tier - 1) * 10;

  return (
    pointScore * 0.35 +
    bonusScore * 0.25 +
    nobleScore * 0.2 -
    distancePenalty +
    tierBonus
  );
}
```

### 5.2 目标卡来源

```typescript
function getTargetCards(
  view: GameView,
  config: DifficultyConfig,
): DevelopmentCard[] {
  const candidates: DevelopmentCard[] = [
    // 场上可见卡
    ...getAllVisibleCards(view.board),
    // 已保留手牌（最高优先级）
    ...view.self.reservedCards,
  ];

  const scored = candidates.map((card) => ({
    card,
    value: evalTargetValue(card, view, config),
  }));

  scored.sort((a, b) => b.value - a.value);
  return scored.slice(0, config.targetCardCount).map((s) => s.card);
}
```

---

## 6. 行为连贯性：隐式路线系统

**不维护显式路线变量**，而是用"动量状态"记录 AI 近期行为，让其隐性影响评分。

### 6.1 动量状态定义

```typescript
interface MomentumState {
  recentBonusColors: GemColor[]; // 最近 N 回合购买的红利颜色（环形缓冲）
  recentTakenColors: GemColor[]; // 最近 N 回合拿取的宝石颜色
  consecutiveReserves: number; // 连续保留卡的次数（用于抑制过度保留）
  windowSize: number; // 历史窗口大小（不同难度不同）
}
```

### 6.2 动量对评分的影响

```typescript
function getMomentumMultiplier(
  action: Action,
  momentum: MomentumState,
): { bonus: number; target: number } {
  let bonusMult = 1.0;
  let targetMult = 1.0;

  if (action.type === "BUY") {
    const color = action.card.bonus;
    // 近期已买过该颜色红利？同向强化
    const recentCount = momentum.recentBonusColors.filter(
      (c) => c === color,
    ).length;
    bonusMult = 1.0 + recentCount * 0.15; // 每次 +15%，上限由 windowSize 控制
  }

  if (action.type === "TAKE_THREE" || action.type === "TAKE_TWO") {
    const takenColors =
      action.type === "TAKE_THREE" ? action.gems : [action.gem];
    // 近期已拿过这些颜色？连贯性加分
    const overlap = takenColors.filter((c) =>
      momentum.recentTakenColors.includes(c),
    ).length;
    targetMult = 1.0 + overlap * 0.1;
  }

  return { bonus: bonusMult, target: targetMult };
}
```

### 6.3 动量更新

```typescript
function updateMomentum(
  action: Action,
  momentum: MomentumState,
): MomentumState {
  const next = { ...momentum };

  if (action.type === "BUY") {
    next.recentBonusColors = [
      action.card.bonus,
      ...momentum.recentBonusColors,
    ].slice(0, momentum.windowSize);
    next.consecutiveReserves = 0;
  }

  if (action.type === "TAKE_THREE") {
    next.recentTakenColors = [
      ...action.gems,
      ...momentum.recentTakenColors,
    ].slice(0, momentum.windowSize * 2);
    next.consecutiveReserves = 0;
  }

  if (action.type === "RESERVE") {
    next.consecutiveReserves += 1;
  } else {
    next.consecutiveReserves = 0;
  }

  return next;
}
```

### 6.4 连续保留惩罚

防止 AI 在手牌已满时还不断保留。

```typescript
// 在 scoreAction 中加入：
if (action.type === "RESERVE") {
  const reservePenalty = Math.min(80, momentum.consecutiveReserves * 25);
  totalScore -= reservePenalty;
}
```

---

## 7. 游戏阶段判定

### 7.1 阶段定义

```typescript
type GamePhase = "opening" | "development" | "endgame";

function getGamePhase(view: GameView): GamePhase {
  const maxScore = Math.max(
    view.self.score,
    ...view.opponents.map((o) => o.score),
  );
  if (maxScore >= 11) return "endgame";
  if (maxScore >= 5) return "development";
  return "opening";
}
```

### 7.2 阶段权重

```typescript
interface PhaseWeights {
  points: number; // 直接得分乘数
  bonus: number; // 红利价值乘数
}

const PHASE_WEIGHTS: Record<GamePhase, PhaseWeights> = {
  opening: { points: 0.5, bonus: 1.5 },
  development: { points: 1.0, bonus: 1.0 },
  endgame: { points: 2.0, bonus: 0.3 },
};

function getPhaseWeights(phase: GamePhase): PhaseWeights {
  return PHASE_WEIGHTS[phase];
}
```

---

## 8. 经济控制策略

### 8.1 宝石稀缺度计算

```typescript
function calcGemScarcity(color: GemColor, view: GameView): number {
  // [0, 1]，值越大越稀缺
  const bankCount = view.board.bankGems[color];
  const maxBank = getMaxBankSize(view.board.playerCount); // 2人→4，3人→5，4人→7
  return 1 - bankCount / maxBank;
}
```

### 8.2 拿宝石时的稀缺度奖励

```typescript
// 在 scoreTarget 之外，额外加入稀缺度奖励
function scoreScarcity(action: Action, view: GameView): number {
  if (action.type !== "TAKE_THREE" && action.type !== "TAKE_TWO") return 0;

  const colors = action.type === "TAKE_THREE" ? action.gems : [action.gem];
  const avgScarcity =
    colors.reduce((s, c) => s + calcGemScarcity(c, view), 0) / colors.length;

  return avgScarcity * 30; // 最高 30 分额外加成
}
```

### 8.3 黄金价值衰减（修正版）

```typescript
// 已在 scoreGold 中实现：decayFactor = max(0, 1 - existing * 0.22)
// 0金→1.0，1金→0.78，2金→0.56，3金→0.34，4金→0.12
```

---

## 9. 丢弃宝石逻辑（补全）

原方案缺失此模块。当行动结束后宝石超过 10 个，AI 需要决定丢弃哪些颜色。

### 9.1 丢弃优先级

```typescript
function chooseGemsToDiscard(
  gemsAfterAction: GemMap,
  goldAfterAction: number,
  view: GameView,
): GemColor[] {
  const total = sumGems(gemsAfterAction) + goldAfterAction;
  const overflow = total - 10;
  if (overflow <= 0) return [];

  const targets = getTargetCards(view);

  // 计算每种颜色的"保留价值"（值越低，越优先丢弃）
  const retentionValues: { color: GemColor; value: number }[] = GEM_COLORS.map(
    (color) => {
      // 1. 对目标卡的帮助程度（最重要）
      const helpValue =
        targets.reduce((sum, card) => {
          const shortage = Math.max(
            0,
            card.cost[color] - view.self.bonuses[color],
          );
          return sum + Math.min(gemsAfterAction[color], shortage);
        }, 0) * 30;

      // 2. 颜色在银行中是否充裕（充裕则丢弃损失小）
      const scarcityPenalty = calcGemScarcity(color, view) * 20;

      // 3. 已持有数量（持有越多，每个的边际价值越低）
      const quantityPenalty = gemsAfterAction[color] * 5;

      return { color, value: helpValue + scarcityPenalty - quantityPenalty };
    },
  );

  // 按保留价值升序排序，丢弃最前面的
  retentionValues.sort((a, b) => a.value - b.value);

  const toDiscard: GemColor[] = [];
  let remaining = overflow;

  for (const { color } of retentionValues) {
    if (remaining <= 0) break;
    const canDiscard = Math.min(remaining, gemsAfterAction[color]);
    if (canDiscard > 0) {
      toDiscard.push(...Array(canDiscard).fill(color));
      remaining -= canDiscard;
    }
  }

  return toDiscard;
}
```

### 9.2 将丢弃决策整合到行动评分

拿宝石时，如果预期会触发丢弃，浪费惩罚中已体现（见 4.2 节 `penaltyWaste`）。但对于具体丢弃哪个颜色，在行动执行阶段调用 `chooseGemsToDiscard` 完成。

---

## 10. 对手威胁判断

仅在困难/专家难度生效（`config.opponentThreatWeight > 0`）。

### 10.1 威胁分计算

```typescript
interface ThreatInfo {
  opponent: PlayerState;
  threatScore: number; // [0, 100]
  immediateCards: DevelopmentCard[]; // 对手下 1~2 回合内可买的卡
  nearNobles: Noble[]; // 对手差 <=2 张就能触发的贵族
}

function assessThreat(opponent: PlayerState, view: GameView): ThreatInfo {
  let threatScore = 0;

  // 维度 1：分数接近 15
  const scoreGap = 15 - opponent.score;
  threatScore += Math.max(0, 8 - scoreGap) * 8; // 差 0 → +64，差 8 → 0

  // 维度 2：下回合能买高分卡
  const immediateCards = getAllVisibleCards(view.board).filter((card) => {
    const gap = calcGemGap(card, opponent);
    return gap <= 2 && card.points >= 2;
  });
  threatScore += Math.min(30, immediateCards.length * 10);

  // 维度 3：距离贵族的远近
  const nearNobles = view.board.nobles.filter((noble) => {
    if (isNobleOwned(noble, view)) return false;
    const gap = calcNobleGap(noble, opponent.bonuses, null);
    return gap <= 2;
  });
  threatScore += Math.min(20, nearNobles.length * 10);

  return {
    opponent,
    threatScore: Math.min(100, threatScore),
    immediateCards,
    nearNobles,
  };
}
```

### 10.2 找出最危险的对手

```typescript
function getMostDangerousOpponent(
  view: GameView,
  config: DifficultyConfig,
): PlayerState | null {
  if (view.opponents.length === 0) return null;

  const threats = view.opponents.map((o) => assessThreat(o, view));
  threats.sort((a, b) => b.threatScore - a.threatScore);

  const top = threats[0];
  // 只在威胁分超过阈值时才触发阻止逻辑
  if (top.threatScore < 20) return null;
  return top.opponent;
}
```

### 10.3 多人局中的威胁选择

```typescript
// 3~4 人局：只针对单一最危险对手，避免同时阻止多人导致自己节奏崩溃
// getMostDangerousOpponent 已经只返回 1 个，此逻辑已内置
```

---

## 11. 轻量 Lookahead（精简版）

**核心原则：lookahead 只判断"能否在下 N 回合内买到某张已知目标卡"，不做完整状态评分。**

### 11.1 困难难度：1 步 Lookahead

```typescript
function lookahead1(action: Action, view: GameView): number {
  if (!["BUY", "TAKE_THREE", "TAKE_TWO"].includes(action.type)) return 0;

  // 模拟执行该行动后的自身状态
  const simSelf = simulateAction(action, view.self);

  // 下回合能买到的目标卡
  const targets = getTargetCards(view);
  const buyableNext = targets.filter((card) => {
    const simPlayer = { ...simSelf };
    return canAfford(card, simPlayer);
  });

  if (buyableNext.length === 0) return 0;

  // 最高价值可买卡
  const bestCard = buyableNext.reduce((best, card) =>
    evalTargetValue(card, view) > evalTargetValue(best, view) ? card : best,
  );

  return evalTargetValue(bestCard, view) * 0.35; // 折扣系数 0.35
}
```

### 11.2 专家难度：2 步 Lookahead

```typescript
function lookahead2(action: Action, view: GameView): number {
  if (!["BUY", "TAKE_THREE", "TAKE_TWO"].includes(action.type)) return 0;

  const simSelf1 = simulateAction(action, view.self);
  const simView1 = { ...view, self: simSelf1 };

  // 生成下回合的合法行动（简化版，只生成购买和拿宝石）
  const nextActions = generateCandidatesFast(simView1); // 不含保留卡
  if (nextActions.length === 0) return 0;

  // 对每个下回合行动，评估其 1 步 lookahead 值
  const bestNext = Math.max(...nextActions.map((a) => lookahead1(a, simView1)));

  return bestNext * 0.2; // 2步折扣系数 0.20
}
```

### 11.3 性能约束

```typescript
const LOOKAHEAD_CONFIG = {
  maxNextActions: 30, // 每个候选行动最多模拟 30 个下回合行动
  decisionBudgetMs: 200, // 总决策预算 200ms
  timeoutFallback: true, // 超时自动降级为无 lookahead 评分
};
```

### 11.4 simulateAction 实现

```typescript
function simulateAction(action: Action, player: PlayerState): PlayerState {
  const sim = deepClone(player);

  switch (action.type) {
    case "TAKE_THREE":
      for (const color of action.gems) sim.gems[color]++;
      break;
    case "TAKE_TWO":
      sim.gems[action.gem] += 2;
      break;
    case "BUY": {
      const card = action.card;
      // 扣除宝石（先扣普通宝石，不足用黄金补）
      let goldUsed = 0;
      for (const color of GEM_COLORS) {
        const need = Math.max(0, card.cost[color] - sim.bonuses[color]);
        const pay = Math.min(sim.gems[color], need);
        sim.gems[color] -= pay;
        goldUsed += need - pay;
      }
      sim.gold -= goldUsed;
      sim.bonuses[card.bonus]++;
      sim.score += card.points;
      break;
    }
    case "RESERVE":
      sim.reservedCards = [...sim.reservedCards, action.card];
      if (sim.gold < 5) sim.gold++; // 保留拿黄金（如果有）
      break;
  }

  return sim;
}
```

---

## 12. 难度系统重设计

### 12.1 难度差异化原则

| 难度 | 差异化手段                            | 核心特征                   |
| ---- | ------------------------------------- | -------------------------- |
| 简单 | 关闭贵族、对手感知维度；高随机性      | 系统性盲目，玩家能找到规律 |
| 普通 | 完整评分，无对手感知；中等随机性      | 理性但不干扰对手           |
| 困难 | 开启对手感知；1步 lookahead；低随机性 | 会阻止明显威胁             |
| 专家 | 全开；2步 lookahead；极低随机性       | 近乎最优策略               |

**关键改变**：低难度 AI 的"失误"是维度缺失造成的，而不是随机噪声造成的。这让低难度 AI 的行为有规律可循，而不是随机发呆。

### 12.2 统一的加权随机决策器

用 Softmax 加权随机替代"top-N 硬截断 + 加权随机"，统一噪声来源。

```typescript
function selectAction(
  candidates: Action[],
  scores: number[],
  config: DifficultyConfig,
): Action {
  if (candidates.length === 0) throw new Error("No candidates");
  if (candidates.length === 1) return candidates[0];

  // Softmax 温度控制：temperature 越高越随机，越低越确定性
  const temperature = config.temperature; // 简单→3.0，普通→1.2，困难→0.4，专家→0.1

  const maxScore = Math.max(...scores);
  const weights = scores.map((s) => Math.exp((s - maxScore) / temperature));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let rand = Math.random() * totalWeight;
  for (let i = 0; i < candidates.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}
```

**为什么用 Softmax 替代 top-N？**

- top-N 截断会让第 N+1 名行动的概率突然变 0，造成非自然的跳变
- Softmax 温度模型的概率分布是连续的，高分行动始终更可能被选，但低分行动也有非零概率
- 只需调整一个 `temperature` 参数，比同时调 `randomness + shortlistSize` 更直观

---

## 13. 多人局策略调整

### 13.1 宝石经济规模

```typescript
function getMaxBankSize(playerCount: number): number {
  // 2人→4，3人→5，4人→7（官方规则）
  return [0, 0, 4, 5, 7][playerCount];
}
```

### 13.2 贵族竞争强度

```typescript
// 贵族数量 = 玩家数 + 1
// 人越多，贵族越多，单个贵族的竞争压力越低
// nobleMultiplier 在多人局中适当降低

function adjustConfigForPlayerCount(
  config: DifficultyConfig,
  playerCount: number,
): DifficultyConfig {
  const adjusted = { ...config };
  if (playerCount >= 3) {
    adjusted.nobleMultiplier *= 0.85; // 竞争压力略降
    adjusted.opponentThreatWeight *= 0.6; // 只盯最危险那个
  }
  if (playerCount === 4) {
    adjusted.nobleMultiplier *= 0.75;
    adjusted.opponentThreatWeight *= 0.4;
  }
  return adjusted;
}
```

### 13.3 终局加速的多人局风险

```typescript
// 在 scoreEndgame 中加入多人局安全检查：
// 只有自己是当前分数最高玩家时，才触发终局加速
// 否则加速结束可能让别人渔翁得利

function scoreEndgame(
  action: Action,
  view: GameView,
  config: DifficultyConfig,
): number {
  // ...（基础逻辑同上）

  // 多人局安全检查（3人以上）
  if (view.board.playerCount >= 3) {
    const selfIsLeading = view.opponents.every(
      (o) => o.score <= view.self.score,
    );
    if (!selfIsLeading) return 0; // 不领先时不加速
  }

  return urgency * 100;
}
```

---

## 14. 可解释性日志

### 14.1 单回合决策日志

```typescript
interface TurnLog {
  round: number;
  playerId: string;
  phase: GamePhase;
  topCandidates: Array<{
    action: Action;
    breakdown: ScoreBreakdown;
    totalScore: number;
    selected: boolean;
  }>;
  chosenAction: Action;
  chosenReason: string; // 最高分维度说明
  momentumSnapshot: MomentumState;
  discardedGems?: GemColor[]; // 如有丢弃
}

interface ScoreBreakdown {
  points: number;
  bonus: number;
  noble: number;
  target: number;
  gold: number;
  block: number;
  endgame: number;
  waste: number; // 负数
  scarcity: number;
  lookahead: number;
  momentumMult: number;
  phaseWeights: PhaseWeights;
  total: number;
}
```

### 14.2 日志输出格式（调试模式）

```
[Round 7 | AI | Development Phase]
Momentum: bonus[red,red,blue] taken[red,red,blue,green,red]

Candidates:
  ① BUY Tier2 Red(3pts)     pts:60 bon:72 nob:40 tgt:0  gld:0  blk:0  end:0  wst:0  → 172  ← SELECTED
  ② TAKE_THREE (red,blue,green) pts:0  bon:0  nob:0  tgt:85 gld:0  blk:15 end:0  wst:-15 → 85
  ③ RESERVE Tier3 White(4pts)  pts:0  bon:0  nob:0  tgt:0  gld:48 blk:50 end:0  wst:0  → 98

Chosen: BUY Tier2 Red | Reason: Direct points + bonus value, noble gap reduced to 1
```

---

## 15. 测试与调参框架

### 15.1 自动对局指标

```typescript
interface MatchStats {
  // 基础
  winner: string;
  rounds: number;
  finalScores: Record<string, number>;

  // 效率
  avgDecisionTimeMs: number;
  p95DecisionTimeMs: number;
  lookaheadTimeoutCount: number;

  // 策略
  cardsBoughtByTier: Record<string, Record<1 | 2 | 3, number>>;
  noblesAcquired: Record<string, number>;
  reserveCount: Record<string, number>;
  forcedDiscardCount: Record<string, number>; // 被迫丢宝石次数

  // 动量（替代原路线统计）
  dominantBonusColor: Record<string, GemColor>; // 购买最多的红利颜色
  momentumShiftCount: Record<string, number>; // 主导颜色切换次数
}
```

### 15.2 难度强度目标

| 对局         | 目标胜率                     |
| ------------ | ---------------------------- |
| 简单 vs 普通 | 简单 ≤35%                    |
| 普通 vs 困难 | 普通 ≤35%                    |
| 困难 vs 专家 | 困难 40%~45%（不要差距过大） |
| 专家 vs 专家 | ~50%                         |

### 15.3 行为断言（回归测试）

```typescript
const BEHAVIOR_ASSERTIONS = [
  // 简单难度
  {
    difficulty: "easy",
    check: "consecutiveReserves <= 2",
    desc: "简单不连续保留超过 2 次",
  },
  {
    difficulty: "easy",
    check: "nobleScore usage < 20%",
    desc: "简单几乎不追贵族",
  },

  // 普通难度
  {
    difficulty: "normal",
    check: "late-game tier1 0pt buys < 20%",
    desc: "普通后期不买 0 分 Tier1",
  },
  {
    difficulty: "normal",
    check: "nobleAcquired >= 0.5 avg",
    desc: "普通平均每局拿半个贵族",
  },

  // 困难难度
  {
    difficulty: "hard",
    check: "blockAction when opponent >= 11pts",
    desc: "困难在对手 11 分时有阻止行为",
  },
  {
    difficulty: "hard",
    check: "endgame rounds < normal avg * 0.9",
    desc: "困难终局比普通快 10%",
  },

  // 专家难度
  {
    difficulty: "expert",
    check: "leading player accelerates endgame",
    desc: "专家领先时主动加速结束",
  },
  {
    difficulty: "expert",
    check: "avg rounds < hard avg",
    desc: "专家比困难更快结束",
  },
];
```

### 15.4 边界情况测试列表

```typescript
const EDGE_CASES = [
  "银行某种颜色耗尽",
  "所有可见卡都买不起（只能拿宝石或保留）",
  "手牌已满（3 张保留）",
  "宝石超过 10 个触发丢弃",
  "黄金数量为 0",
  "贵族已全部被领取",
  "牌堆某等级已空",
  "多人局 3 人",
  "多人局 4 人",
  "对手在第 4 回合就接近 15 分（极端情况）",
  "AI 自己即将赢但选择阻止对手",
];
```

---

## 16. 推荐开发顺序

### 第一阶段：基础可运行（~2天）

```
1. 实现 GameView 状态模型
2. 实现合法行动生成（含规则校验）
3. 实现 simulateAction
4. 实现最简单的 scoreAction（只含 scorePoints + scoreTarget）
5. AI 能完成整局，不出错
```

### 第二阶段：理性行为（~3天）

```
1. 实现归一化评分维度（bonus, noble, gold, waste）
2. 实现 evalTargetValue + getTargetCards
3. 实现游戏阶段判定 + 阶段权重
4. 实现 chooseGemsToDiscard（丢弃逻辑）
5. 实现 Softmax 决策器
6. AI 行为合理，不会出现明显愚蠢操作
```

### 第三阶段：难度区分（~2天）

```
1. 接入 DifficultyConfig 参数表
2. 简单难度：关闭 noble + block 维度
3. 普通难度：完整评分，temperature=1.2
4. 困难难度：开启 block + lookahead1 + 对手威胁
5. 专家难度：开启 lookahead2 + 动量窗口扩大
6. 跑自动对局，验证胜率目标
```

### 第四阶段：动量系统（~1天）

```
1. 实现 MomentumState + updateMomentum
2. 实现 getMomentumMultiplier
3. 实现连续保留惩罚
4. 验证行为连贯性（动量统计指标）
```

### 第五阶段：多人局 + 调参（~2天）

```
1. 实现 adjustConfigForPlayerCount
2. 多人局边界测试
3. 对局统计工具接入行为断言
4. 调整 temperature 和各维度权重
5. 完成边界情况测试列表
```

---

## 17. 完整难度配置参数表

```typescript
interface DifficultyConfig {
  // 评分维度权重（作用于归一化后的 [0,100] 分值）
  pointsMultiplier: number; // 直接得分权重
  bonusMultiplier: number; // 红利价值权重
  nobleMultiplier: number; // 贵族进度权重（0=不考虑贵族）
  blockWeight: number; // 对手阻止权重（0=不考虑对手）
  endgameBonus: number; // 终局加速额外权重

  // 游戏阶段（权重在 PHASE_WEIGHTS 常量中定义，不需要每个难度单独配置）

  // 终局触发
  endgameThreshold: number; // 触发终局加速的最高分阈值

  // 决策特性
  targetCardCount: number; // 目标卡考虑数量
  takeThreeTopK: number; // TAKE_THREE 剪枝后保留数量
  lookaheadDepth: 0 | 1 | 2;
  temperature: number; // Softmax 温度（越高越随机）
  momentumWindow: number; // 动量历史窗口大小（0=无动量）

  // 对手感知
  opponentThreatWeight: number; // 对手威胁权重（0=不考虑对手）
}

const DIFFICULTY_CONFIGS: Record<string, DifficultyConfig> = {
  easy: {
    pointsMultiplier: 1.0,
    bonusMultiplier: 0.5,
    nobleMultiplier: 0.0, // 完全不追贵族
    blockWeight: 0.0, // 完全不看对手
    endgameBonus: 0.0,
    endgameThreshold: 15,
    targetCardCount: 3,
    takeThreeTopK: 8,
    lookaheadDepth: 0,
    temperature: 3.0, // 高随机性
    momentumWindow: 0, // 无动量（行为不连贯）
    opponentThreatWeight: 0.0,
  },

  normal: {
    pointsMultiplier: 1.0,
    bonusMultiplier: 1.0,
    nobleMultiplier: 0.6,
    blockWeight: 0.0, // 不主动干扰
    endgameBonus: 0.5,
    endgameThreshold: 12,
    targetCardCount: 6,
    takeThreeTopK: 10,
    lookaheadDepth: 0,
    temperature: 1.2,
    momentumWindow: 3,
    opponentThreatWeight: 0.0,
  },

  hard: {
    pointsMultiplier: 1.2,
    bonusMultiplier: 1.2,
    nobleMultiplier: 1.0,
    blockWeight: 0.5,
    endgameBonus: 1.0,
    endgameThreshold: 11,
    targetCardCount: 10,
    takeThreeTopK: 12,
    lookaheadDepth: 1,
    temperature: 0.4,
    momentumWindow: 5,
    opponentThreatWeight: 0.5,
  },

  expert: {
    pointsMultiplier: 1.3,
    bonusMultiplier: 1.5,
    nobleMultiplier: 1.2,
    blockWeight: 1.0,
    endgameBonus: 1.5,
    endgameThreshold: 10,
    targetCardCount: 15,
    takeThreeTopK: 15,
    lookaheadDepth: 2,
    temperature: 0.1, // 近乎确定性选择
    momentumWindow: 8,
    opponentThreatWeight: 1.0,
  },
};
```

---

## 附录：关键改动对照表

| 原方案问题                                 | 改进方案                                                  |
| ------------------------------------------ | --------------------------------------------------------- |
| 评分维度量纲不统一                         | 全部归一化到 `[0, 100]`，权重系数具有可比性               |
| 路线系统实现成本高、易锁死                 | 改为隐式动量系统，历史行为自然影响后续权重                |
| 贵族权重硬阈值 <=3 张                      | 改为连续衰减函数 `100 × 0.55^gap`，从第一回合就有微弱影响 |
| 丢弃宝石逻辑缺失                           | 完整实现 `chooseGemsToDiscard`，按保留价值排序丢弃        |
| 两套随机机制（top-N + randomness）互相干扰 | 统一为 Softmax 温度模型，只需调一个 `temperature` 参数    |
| Lookahead 对未知牌堆做完整状态预测         | 精简为"能否在下 N 回合买到已知目标卡"，避免伪精确         |
| 多人局对手威胁同时反制多个                 | 只针对 `getMostDangerousOpponent` 返回的单一对手          |
| 终局加速在多人局中无条件触发               | 只在自己领先时才触发，避免为他人作嫁衣                    |
| 低难度失误纯靠随机性                       | 低难度通过关闭维度（noble=0，block=0）实现系统性盲目      |
