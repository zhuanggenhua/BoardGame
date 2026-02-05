# 设计系统 (Design System)

## 架构

```
design-system/
├── README.md                    # 本文件
├── game-ui/
│   └── MASTER.md               # 游戏 UI 交互规范（通用原则）
├── styles/                      # 可复用的视觉风格
│   ├── arcade-3d.md            # 街机立体风
│   ├── tactical-clean.md       # 战术简洁风
│   └── classic-parchment.md    # 经典羊皮纸风
└── games/                       # 游戏专属配置
    ├── dicethrone.md           # 王权骰铸 → arcade-3d + 专属覆盖
    └── summonerwars.md         # 召唤师战争 → tactical-clean + 专属覆盖
```

## 使用方式

### 1. 所有游戏必须遵守

`game-ui/MASTER.md` - 交互原则（反馈、状态、动画时长等）

### 2. 选择视觉风格

| 风格 | 文件 | 适用场景 |
|------|------|----------|
| 街机立体 | `styles/arcade-3d.md` | 休闲、派对、骰子类 |
| 战术简洁 | `styles/tactical-clean.md` | 策略、卡牌对战、棋类 |
| 经典羊皮纸 | `styles/classic-parchment.md` | 复古、桌游模拟 |

### 3. 游戏专属配置

每个游戏在 `games/` 目录有专属配置，定义：
- 引用哪个基础风格
- 玩家颜色
- 专属组件样式
- 覆盖规则

| 游戏 | 配置文件 | 基础风格 |
|------|----------|----------|
| 王权骰铸 | `games/dicethrone.md` | arcade-3d |
| 召唤师战争 | `games/summonerwars.md` | tactical-clean |

新增游戏时，在 `games/` 目录创建对应配置文件。

## 风格选择指南

| 游戏类型 | 推荐风格 | 理由 |
|----------|----------|------|
| 骰子/派对 | arcade-3d | 活泼有趣，物理感强 |
| 策略/TCG | tactical-clean | 信息清晰，不抢戏 |
| 经典桌游 | classic-parchment | 复古温暖，实体感 |
| 儿童向 | arcade-3d | 大胆颜色，明确反馈 |
| 军事模拟 | tactical-clean | 专业冷静 |

## 新增风格

如需新风格，在 `styles/` 目录创建新文件，包含：

1. 风格定位与适用场景
2. 颜色系统
3. 组件样式（按钮、面板、卡牌等）
4. 动画配置
5. 禁用状态
6. 设计原则（推荐/避免）
