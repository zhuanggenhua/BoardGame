# 斗地主制作流程验证

## 1. 用户输入（自然语言描述）

```
制作斗地主游戏：
- 3人游戏，一人地主，两人农民
- 54张牌（含大小王）
- 阶段：发牌 → 抢地主 → 出牌 → 结算
- 牌型：单张、对子、三带一、顺子、连对、飞机、炸弹、火箭
- 地主先出，逆时针轮流
- 先出完牌的一方获胜
```

## 2. AI 应该生成的内容

### 2.1 数据模型 (Schema)

```typescript
// 卡牌定义
interface Card {
  id: string;
  suit: 'spade' | 'heart' | 'diamond' | 'club' | 'joker';
  rank: number; // 3-15 (3最小, 2=14, 小王=15, 大王=16)
  display: string; // "♠3", "♥A", "🃏小王"
}

// 玩家定义
interface Player {
  id: string;
  hand: Card[];
  role: 'landlord' | 'farmer' | null;
  bid: number; // 叫分 0-3
}

// 牌型
type CardPattern = 
  | { type: 'single'; cards: Card[] }
  | { type: 'pair'; cards: Card[] }
  | { type: 'triple'; cards: Card[] }
  | { type: 'tripleWithOne'; cards: Card[] }
  | { type: 'tripleWithPair'; cards: Card[] }
  | { type: 'straight'; cards: Card[]; length: number }
  | { type: 'doubleStraight'; cards: Card[]; length: number }
  | { type: 'plane'; cards: Card[] }
  | { type: 'bomb'; cards: Card[] }
  | { type: 'rocket'; cards: Card[] };
```

### 2.2 游戏逻辑 (Boardgame.io Game)

```typescript
const DouDiZhu = {
  name: 'doudizhu',
  
  setup: () => ({
    deck: createDeck(), // 54张牌
    landlordCards: [], // 3张底牌
    currentPlay: null, // 当前桌面牌
    lastPlayer: null, // 上一个出牌的玩家
    passCount: 0, // 连续pass次数
    winner: null,
  }),
  
  phases: {
    // 发牌阶段
    deal: {
      start: true,
      onBegin: (G, ctx) => {
        // 洗牌
        G.deck = ctx.random.Shuffle(G.deck);
        // 发17张给每人
        for (let i = 0; i < 3; i++) {
          G.players[i].hand = G.deck.slice(i * 17, (i + 1) * 17);
        }
        // 3张底牌
        G.landlordCards = G.deck.slice(51, 54);
      },
      endIf: () => true,
      next: 'bid',
    },
    
    // 抢地主阶段
    bid: {
      turn: { moveLimit: 1 },
      moves: {
        bid: (G, ctx, score) => {
          G.players[ctx.currentPlayer].bid = score;
          if (score === 3) {
            // 叫3分直接成为地主
            return { next: 'play' };
          }
        },
        pass: (G, ctx) => {
          G.players[ctx.currentPlayer].bid = 0;
        },
      },
      endIf: (G, ctx) => {
        // 所有人都叫过或有人叫3分
        const bids = G.players.map(p => p.bid);
        return bids.every(b => b !== null) || bids.includes(3);
      },
      onEnd: (G, ctx) => {
        // 确定地主
        const maxBid = Math.max(...G.players.map(p => p.bid || 0));
        const landlordIdx = G.players.findIndex(p => p.bid === maxBid);
        G.players[landlordIdx].role = 'landlord';
        G.players[landlordIdx].hand.push(...G.landlordCards);
        // 其他人是农民
        G.players.forEach((p, i) => {
          if (i !== landlordIdx) p.role = 'farmer';
        });
      },
      next: 'play',
    },
    
    // 出牌阶段
    play: {
      turn: {
        order: TurnOrder.CUSTOM_FROM('landlordIdx'),
      },
      moves: {
        playCards: (G, ctx, cards) => {
          const pattern = detectPattern(cards);
          if (!isValidPlay(pattern, G.currentPlay)) {
            return INVALID_MOVE;
          }
          // 出牌
          removeCards(G.players[ctx.currentPlayer].hand, cards);
          G.currentPlay = { pattern, player: ctx.currentPlayer };
          G.lastPlayer = ctx.currentPlayer;
          G.passCount = 0;
          
          // 检查是否出完
          if (G.players[ctx.currentPlayer].hand.length === 0) {
            G.winner = G.players[ctx.currentPlayer].role;
          }
        },
        pass: (G, ctx) => {
          G.passCount++;
          // 其他两人都pass，清空桌面
          if (G.passCount >= 2) {
            G.currentPlay = null;
            G.passCount = 0;
          }
        },
      },
    },
  },
  
  endIf: (G) => {
    if (G.winner) {
      return { winner: G.winner };
    }
  },
};
```

### 2.3 UI 布局

```
┌─────────────────────────────────────────────────────────┐
│                    对手2 (农民/地主)                     │
│                    [■■■■■■■■■■■] 剩余牌数               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  对手1           ┌─────────────────────┐    对手2       │
│  (农民)          │                     │    (农民)       │
│  剩余:12         │     出  牌  区      │    剩余:15      │
│                  │   [♠3][♠4][♠5]     │                │
│                  └─────────────────────┘                │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                      我的手牌                            │
│  [♠3][♠4][♥5][♥6][♦7][♣8][♣9][♠10][♥J][♦Q][♣K][♠A][♥2] │
│                                                         │
│              [出牌]  [不出]  [提示]                      │
└─────────────────────────────────────────────────────────┘
```

## 3. 端到端用户流程（更新版）

### 步骤1：规则填写（规则面板）
- 输入全局规则需求：发牌、胜负条件、牌型比较等。
- “按牌型且比上一家大”归属规则层（DomainCore）校验，不放到组件钩子里。

### 步骤2：Schema 与数据（数据面板）
- 创建卡牌 Schema（通用字段，不做游戏特化）。
- 点击「AI 批量生成」输入数据需求（54 张牌含大小王）。
- 需求文本应写入 requirements.entries（位置建议：`数据库 AI 生成/<Schema>`）。

### 步骤3：我的手牌区（hand-zone）
- 布局需求：顺序排开。
- 选中效果需求：抬高。
- 排序需求：按斗地主规则排序（含大小王）。
- 动作钩子需求：出牌/不出/叫分按钮逻辑（只触发命令，不做规则校验）。

### 步骤4：其他玩家手牌区
- 复制手牌区配置。
- 开启背面渲染（仅展示，不显示牌面）。

### 步骤5：出牌区（play-zone）
- 禁用动作钩子，仅做布局/展示。

### 步骤6：玩家信息组件
- 添加若干玩家信息组件（显示玩家名）。
- 玩家人数 = 玩家信息组件数量 + 1（自己可无玩家信息组件）。

### 步骤7：复制提示词 → 外部 AI → 粘贴导入
- 规则面板、手牌区钩子、动作钩子均提供「复制提示词」。
- 外部 AI 生成后粘贴导入（不提供手动编辑）。

### 步骤8：预览/运行一致
- 预览与运行使用同一执行链路，避免“预览限制发挥”。

## 4. 关键认知纠正

### ❌ 错误理解
- 手动配置"打出时造成伤害"这种钩子
- 让用户在 UI 中拼凑效果

### ✅ 正确理解
- 用户用**自然语言**描述游戏规则
- AI 生成**完整的游戏代码**
- 用户只需要**审核和微调**

### 核心价值
**让不懂编程的人也能通过自然语言描述来创建桌游**
