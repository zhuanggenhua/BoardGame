# 项目结构速览（新游戏相关）

## 关键入口
- `src/games/<gameId>/`：每个游戏的独立目录
- `src/games/<gameId>/manifest.ts`：游戏清单条目（id 必须与目录名一致）
- `src/games/<gameId>/game.ts`：使用 createGameEngine 创建游戏引擎配置
- `src/games/<gameId>/Board.tsx`：渲染与交互 UI
- `src/games/<gameId>/tutorial.ts`：教程配置
- `src/games/<gameId>/audio.config.ts`：游戏音频配置
- `src/games/<gameId>/thumbnail.tsx`：缩略图组件
- `src/games/<gameId>/domain/`：领域内核（types/ids/commands/execute/reducer/flowHooks）
- `src/games/<gameId>/ui/`：游戏 UI 子模块（Board.tsx 拆分）
- `src/games/<gameId>/config/` 或 `data/`：静态数据配置
- `src/games/<gameId>/rule/`：规则文档
- `src/games/<gameId>/__tests__/`：测试文件

## 引擎与系统
- `src/engine/adapter.ts`：`createGameEngine`（引擎入口工厂，自动合并系统命令）
- `src/engine/systems/`：引擎系统（Flow/Undo/Interaction/Log/Rematch/Tutorial/ResponseWindow/EventStream/ActionLog/Cheat）
- `src/engine/systems/index.ts`：`createBaseSystems` 入口
- `src/engine/primitives/`：引擎原语（expression/condition/target/effects/zones/dice/resources/grid）

## 资源与本地化
- `public/assets/i18n/<locale>/<gameId>/`：运行时图片原图与 `compressed/` 产物
- `public/assets/atlas-configs/<gameId>/`：图集配置（与语言无关）
- `public/locales/zh-CN/game-<gameId>.json`：中文文案
- `public/locales/en/game-<gameId>.json`：英文文案

## 清单生成
- `scripts/game/generate_game_manifests.js`：扫描 `src/games/*/manifest.ts` 自动生成清单
- `src/games/manifest*.generated.ts(x)`：自动生成，禁止手改
- `npm run generate:manifests`：生成命令

## 同类实现查找方式
- 最小骨架：查 `manifest.ts`、`game.ts`、`Board.tsx` 同时存在且规则最少的游戏目录，用于理解基础接入形状。
- 网格 / 地图 / 桌面区位：用 `rg` 查 `BoardGrid`、`MapContainer`、`grid`、`cell`、`region`、`position` 等职责名，只复用坐标、命中区、缩放和实体定位边界。
- 多人 / 阵营 / 角色选择：用 `rg` 查 `FactionSelection`、`CharacterSelection`、`setup`、`playerConfig` 等入口，只复用选择阶段和席位绑定模式。
- 牌堆 / 手牌 / 持续效果：用 `rg` 查 `HandArea`、`deck`、`discard`、`effect`、`modifier` 等职责名，只复用数据流和显示拆分，不复制具体规则对象。

## 框架复用层
- `src/core/ui/`：UI 类型契约层
- `src/components/game/framework/`：骨架组件层（跨游戏复用）
- `src/components/common/animations/`：通用动效组件
