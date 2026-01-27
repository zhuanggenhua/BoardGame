---
description: 前端框架封装说明（避免重复造轮子）
---

# 前端框架封装说明

> 目标：明确前端已有的「框架级封装」与复用入口，避免重复造轮子。

## 1. 架构总览（实际目录）

```
src/
├── assets/                  # 全局静态资源
│   └── react.svg            # Vite 默认占位资源
├── core/                    # 框架核心（与具体游戏无关）
│   ├── ui/                  # 框架级 UI hooks/types
│   │   ├── hooks.ts         # UI hooks
│   │   ├── index.ts         # UI 导出
│   │   └── types.ts         # UI 类型
│   ├── types.ts             # GameImplementation 等框架级类型
│   ├── AssetLoader.ts       # 资源路径/预加载统一入口
│   └── index.ts             # 框架核心导出
├── engine/                  # 引擎管线与系统
│   ├── systems/
│   │   ├── CheatSystem.ts           # 调试/作弊辅助
│   │   ├── FlowSystem.ts            # 回合/阶段流程
│   │   ├── LogSystem.ts             # 日志/事件记录
│   │   ├── PromptSystem.ts          # 交互提示
│   │   ├── RematchSystem.ts         # 重赛流程
│   │   ├── ResponseWindowSystem.ts  # 响应窗口
│   │   ├── UndoSystem.ts            # 撤销
│   │   ├── __tests__/               # 系统测试
│   │   └── types.ts                 # 系统类型
│   ├── testing/
│   │   └── index.ts          # 测试工具导出
│   ├── adapter.ts            # 引擎适配层
│   ├── index.ts              # 引擎导出
│   ├── notifications.ts      # 事件/通知
│   ├── pipeline.ts           # 执行管线
│   └── types.ts              # 引擎类型
├── systems/                 # 通用游戏系统（跨游戏复用）
│   ├── AbilitySystem/
│   │   ├── conditions.ts     # 条件注册表
│   │   ├── index.ts          # 导出
│   │   ├── manager.ts        # 运行时管理
│   │   └── types.ts          # 类型
│   ├── CardSystem/
│   │   ├── CardSystem.ts     # 卡牌系统
│   │   ├── index.ts          # 导出
│   │   └── types.ts          # 类型
│   ├── DiceSystem/
│   │   ├── DiceSystem.ts     # 骰子系统
│   │   ├── index.ts          # 导出
│   │   └── types.ts          # 类型
│   ├── ResourceSystem/
│   │   ├── ResourceSystem.ts # 资源系统
│   │   ├── index.ts          # 导出
│   │   └── types.ts          # 类型
│   ├── TokenSystem/
│   │   ├── TokenSystem.ts    # Token 系统
│   │   ├── index.ts          # 导出
│   │   └── types.ts          # 类型
│   ├── StatusEffectSystem.ts # 状态效果系统
│   └── index.ts              # 系统聚合导出
├── games/                   # 具体游戏实现
│   ├── assetslicer/                 # 工具型模块
│   ├── dicethrone/                  # DiceThrone 实现
│   ├── tictactoe/                   # 井字棋实现
│   ├── manifest.client.tsx          # 客户端清单入口
│   ├── manifest.client.generated.tsx# 客户端清单（生成）
│   ├── manifest.client.types.ts     # 客户端清单类型
│   ├── manifest.generated.ts        # 通用清单（生成）
│   ├── manifest.server.ts           # 服务端清单入口
│   ├── manifest.server.generated.ts # 服务端清单（生成）
│   ├── manifest.server.types.ts     # 服务端清单类型
│   ├── manifest.ts                  # 游戏元数据清单
│   ├── manifest.types.ts            # 清单类型
│   └── registry.ts                  # 实现注册与一致性校验
├── components/              # 通用 UI 组件
│   ├── auth/                 # 认证相关 UI
│   ├── common/               # 通用组件
│   ├── game/                 # 对局相关 UI
│   ├── layout/               # 布局组件
│   ├── lobby/                # 大厅 UI
│   ├── social/               # 社交 UI
│   ├── system/               # 系统级 UI
│   ├── tutorial/             # 教学 UI
│   └── GameDebugPanel.tsx    # 调试面板
├── contexts/                # 全局 Context
│   ├── AudioContext.tsx      # 音频上下文
│   ├── AuthContext.tsx       # 认证上下文
│   ├── DebugContext.tsx      # 调试上下文
│   ├── GameModeContext.tsx   # 游戏模式上下文
│   ├── ModalStackContext.tsx # 模态栈上下文
│   ├── RematchContext.tsx    # 重赛上下文
│   ├── SocialContext.tsx     # 社交上下文
│   ├── ToastContext.tsx      # 提示上下文
│   └── TutorialContext.tsx   # 教学上下文
├── hooks/                   # 通用 hooks
│   ├── match/                # 对局 hooks
│   ├── routing/              # 路由 hooks
│   └── ui/                   # UI hooks
├── lib/                     # 通用工具（i18n、音频等）
│   ├── audio/                # 音频工具
│   └── i18n/                 # 国际化
├── pages/                   # 页面路由
│   ├── devtools/             # 开发工具页
│   ├── Home.tsx              # 首页
│   ├── LocalMatchRoom.tsx    # 本地对局页
│   └── MatchRoom.tsx         # 在线对局页
├── services/                # 运行时服务（lobbySocket / matchSocket）
│   ├── lobbySocket.ts        # 大厅 socket
│   ├── matchSocket.ts        # 对局 socket
│   └── socialSocket.ts       # 社交 socket
├── server/                  # Node 侧服务代码（前端打包不包含）
│   ├── db.ts                 # DB 连接
│   ├── email.ts              # 邮件封装
│   ├── i18n.ts               # 服务端 i18n
│   ├── models/
│   │   └── MatchRecord.ts    # 对局归档
│   └── storage/
│       └── MongoStorage.ts   # Mongo 存储
├── types/                   # 全局类型
│   └── social.ts             # 社交类型
├── config/                  # 前端配置
│   ├── games.config.tsx      # 游戏配置
│   └── server.ts             # 服务端配置
├── App.tsx                   # 应用入口
├── index.css                 # 全局样式
├── main.tsx                  # 应用启动
└── vite-env.d.ts             # Vite 类型声明
```

## 2. 框架级能力（已封装）

- **资源管理**：`src/core/AssetLoader.ts`
  - `assetsPath` / `getOptimizedImageUrls` / `buildOptimizedImageSet`
  - 资源注册表 API（可选）：`registerGameAssets` / `preloadGameAssets`
- **引擎管线与系统**：`src/engine/`（Flow/Prompt/Undo/ResponseWindow/Rematch 等）
- **撤销系统**：`src/engine/systems/UndoSystem.ts`（通过 `createDefaultSystems` 启用）
- **通用游戏系统**：`src/systems/`（StatusEffect/Ability/Resource/Token/Dice/Card 等，含条件注册表）
- **动画组件库**：`src/components/common/animations/`
  - `FlyingEffect` / `ShakeContainer` / `PulseGlow` / `variants`
- **国际化**：`src/lib/i18n/`
- **音频管理**：`src/lib/audio/AudioManager.ts`

### 系统清单（全部）

- **Engine Systems（`src/engine/systems/`）**
  - `CheatSystem.ts`（调试/作弊）
  - `FlowSystem.ts`（流程调度）
  - `LogSystem.ts`（日志记录）
  - `PromptSystem.ts`（交互提示）
  - `RematchSystem.ts`（重赛管理）
  - `ResponseWindowSystem.ts`（响应窗口）
  - `UndoSystem.ts`（撤销）
- **Game Systems（`src/systems/`）**
  - `AbilitySystem/`（能力与条件）
  - `CardSystem/`（卡牌）
  - `DiceSystem/`（骰子）
  - `ResourceSystem/`（资源）
  - `StatusEffectSystem.ts`（状态效果）
  - `TokenSystem/`（Token）

## 3. 游戏接入规范（避免重复造轮子）

1) **manifest 先行**：在 `src/games/manifest.ts` 定义游戏元数据。
2) **注册实现**：在 `src/games/registry.ts` 注册 `game` 与 `board`。
3) **游戏模块结构**：
   - `src/games/<gameId>/game.ts`：Boardgame.io Game 定义
   - `src/games/<gameId>/Board.tsx`：UI
   - `src/games/<gameId>/types.ts`：状态/类型
   - 如有英雄模块：`src/games/<gameId>/<hero>/`
4) **通用系统优先**：状态/技能优先使用 `StatusEffectSystem` / `AbilitySystem`。

## 4. DiceThrone 领域扩展（数据驱动注册表）

> 目标：新增英雄/卡牌/Token 时避免硬编码，统一通过注册表扩展。

- **自定义动作处理器**：`src/games/dicethrone/domain/effects.ts`
  - 注册：`registerCustomActionHandler(actionId, handler, meta)`
- **选择结果处理器**：`src/games/dicethrone/domain/reducer.ts`
  - 注册：`registerChoiceEffectHandler(customId, handler)`
- **Token 效果处理器**：`src/games/dicethrone/domain/tokenResponse.ts`
  - 注册：`registerEffectProcessor(effectType, processor)`
- **Token 定义驱动 UI**：`DiceThroneCore.tokenDefinitions` → `TokenResponseModal` / `LeftSidebar`

> 新增效果请优先添加定义与注册处理器，避免在 reducer/UI 内硬编码 ID。

## 5. 路由与运行入口

- `src/App.tsx`：路由入口
- `src/pages/MatchRoom.tsx`：在线对局
- `src/pages/LocalMatchRoom.tsx`：本地对局
- `src/services/lobbySocket.ts`：大厅订阅

## 6. 何时扩展“框架”层

> 解耦要求：框架不再默认注册任何游戏特定条件（如骰子组合/顺子/阶段）。这些条件需在游戏层通过 `conditionRegistry.register()` 显式注册，以避免耦合。

- **跨游戏复用** → 放 `core/` 或 `systems/`
- **仅游戏内使用** → 放 `games/<gameId>/`
- **通用 UI 组件** → 放 `components/`
- **工具型能力** → 放 `lib/`

> ⚠️ three / @react-three/fiber / drei 已安装但当前未接入代码；如需 3D 骰子，请先明确需求与性能目标。

