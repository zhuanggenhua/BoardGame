---
description: 前端框架封装说明（避免重复造轮子）
---

# 前端框架封装说明

> 目标：明确前端已有的「框架级封装」与复用入口，避免重复造轮子。

## 1. 架构总览（实际目录）

```
src/
├── core/                    # 框架核心（与具体游戏无关）
│   ├── types.ts             # GameImplementation 等框架级类型
│   ├── AssetLoader.ts       # 资源路径/预加载统一入口
│   └── index.ts             # 框架核心导出
├── systems/                 # 通用游戏系统
│   ├── StatusEffectSystem.ts
│   ├── AbilitySystem.ts
│   └── index.ts
├── games/                   # 具体游戏实现
│   ├── manifest.ts          # 游戏清单（权威数据）
│   ├── registry.ts          # 实现注册与清单一致性校验
│   └── <gameId>/            # 单个游戏实现
├── components/              # 通用 UI 组件
├── contexts/                # 全局 Context
├── lib/                     # 通用工具（i18n、音频等）
├── pages/                   # 页面路由
└── config/                  # 前端配置
```

## 2. 框架级能力（已封装）

- **资源管理**：`src/core/AssetLoader.ts`
  - `assetsPath` / `getOptimizedImageUrls` / `buildOptimizedImageSet`
  - 资源注册表 API（可选）：`registerGameAssets` / `preloadGameAssets`
- **撤销系统**：`src/engine/systems/UndoSystem.ts`（通过 `createDefaultSystems` 启用）
- **通用游戏系统**：`src/systems/StatusEffectSystem.ts`、`AbilitySystem.ts`
- **动画组件库**：`src/components/common/animations/`
  - `FlyingEffect` / `ShakeContainer` / `PulseGlow` / `variants`
- **国际化**：`src/lib/i18n/`
- **音频管理**：`src/lib/audio/AudioManager.ts`

## 3. 游戏接入规范（避免重复造轮子）

1) **manifest 先行**：在 `src/games/manifest.ts` 定义游戏元数据。
2) **注册实现**：在 `src/games/registry.ts` 注册 `game` 与 `board`。
3) **游戏模块结构**：
   - `src/games/<gameId>/game.ts`：Boardgame.io Game 定义
   - `src/games/<gameId>/Board.tsx`：UI
   - `src/games/<gameId>/types.ts`：状态/类型
   - 如有英雄模块：`src/games/<gameId>/<hero>/`
4) **通用系统优先**：状态/技能优先使用 `StatusEffectSystem` / `AbilitySystem`。

## 4. 路由与运行入口

- `src/App.tsx`：路由入口
- `src/pages/MatchRoom.tsx`：在线对局
- `src/pages/LocalMatchRoom.tsx`：本地对局
- `src/services/lobbySocket.ts`：大厅订阅

## 5. 何时扩展“框架”层

- **跨游戏复用** → 放 `core/` 或 `systems/`
- **仅游戏内使用** → 放 `games/<gameId>/`
- **通用 UI 组件** → 放 `components/`
- **工具型能力** → 放 `lib/`

> ⚠️ three / @react-three/fiber / drei 已安装但当前未接入代码；如需 3D 骰子，请先明确需求与性能目标。

