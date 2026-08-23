---
description: 前端框架封装说明（避免重复造轮子）
---

# 前端框架封装说明

本文只记录稳定框架入口和复用边界，不维护完整目录树快照。需要精确文件位置时用 `rg --files src`。

## 相关入口

- [棋盘布局系统与坐标系说明](./board-layout.md)
- [项目地图](../project-map.md)
- [国际化资源架构](../i18n-asset-architecture.md)

## 主要模块

| 模块 | 职责 |
| --- | --- |
| `src/core/` | 与具体游戏无关的框架类型、UI hooks 和资源路径工具 |
| `src/engine/` | 规则引擎、系统管线、共享原语和测试工具 |
| `src/games/` | 具体游戏领域模型、UI、AI、manifest 和注册表 |
| `src/components/` | 跨游戏 UI、框架组件、布局、大厅、社交、教程和系统组件 |
| `src/contexts/` | Auth、Audio、Debug、GameMode、ModalStack、Rematch、Social、Toast、Tutorial 等运行时上下文 |
| `src/hooks/` | 通用 match / routing / UI hooks |
| `src/lib/` | i18n、音频和其它通用工具 |
| `src/pages/` | 页面路由入口 |
| `src/services/` | lobby / match / social socket 和 API 客户端 |
| `apps/api/`、`server/` | 服务端 API、存储和外部接口 |

## 框架级能力

| 能力 | 入口 |
| --- | --- |
| 资源路径与预加载 | `src/core/AssetLoader.ts` |
| 引擎系统 | `src/engine/systems/` |
| 引擎原语 | `src/engine/primitives/` |
| 撤回 | `src/engine/systems/UndoSystem.ts` |
| 动画组件 | `src/components/common/animations/` |
| 国际化 | `src/lib/i18n/` |
| 音频 | `src/lib/audio/AudioManager.ts` |
| 实体引用链校验 | `src/engine/testing/referenceValidator.ts` |

新增功能先查这些入口；确认没有合适职责归属后，才新增框架层能力。

## 游戏接入

1. 在 `src/games/manifest.ts` 定义游戏元数据。
2. 在 `src/games/registry.ts` 注册 `game` 与 `board`。
3. 游戏模块默认拆到：
   - `src/games/<gameId>/game.ts`
   - `src/games/<gameId>/Board.tsx`
   - `src/games/<gameId>/types.ts`
   - `src/games/<gameId>/domain/`
   - `src/games/<gameId>/ui/`
   - `src/games/<gameId>/__tests__/`
4. 状态、技能、资源、目标、区域、表达式和响应窗口优先复用 `engine/primitives/` 与 `engine/systems/`。
5. 具体游戏的处理器名称、payload 字段和历史迁移细节放到该游戏目录、文档或 evidence，不写进框架层。

## 实施中横幅

`statusTag: 'under_construction'` 表示游戏、角色、派系或候选对象仍处于实施中。用户可见入口必须复用 `src/components/game/framework/ImplementationStatusRibbon.tsx`。

约束：

- 页面只决定横幅挂在哪个缩略图 / 卡面容器上。
- 不新建第二套实施中样式，不用普通 chip、meta tag、角落小字或说明正文替代。
- 同一对象已有横幅时，不在分类标签区、meta tag 区或说明首行重复写“实施中”。
- 测试断言共享横幅或稳定 test id，不能只断言页面有“实施中”文案。
- 未经用户当轮明确允许，不移除已对用户展示的 `under_construction` 状态。
- 完成证据只能作为申请摘牌依据，不能自动摘牌。

## 路由与运行入口

| 对象 | 入口 |
| --- | --- |
| 应用路由 | `src/App.tsx` |
| 在线对局页 | `src/pages/MatchRoom.tsx` |
| 大厅订阅 | `src/services/lobbySocket.ts` |
| 对局 socket | `src/services/matchSocket.ts` |

## 游客身份

游客 ID 通过 localStorage、sessionStorage 和 cookie 多重持久化。刷新页面应复用原游客 ID；浏览器禁用 / 清空存储或域名切换可能生成新游客 ID。

房主身份通过 `ownerKey = guest:<guestId>` 绑定。排查“刷新后不是房主”时，先检查 `guest_id`（localStorage）与 `bg_guest_id`（cookie）是否变化，并确认访问域名一致。

## 何时扩展框架层

| 情况 | 落点 |
| --- | --- |
| 跨游戏复用 | `src/core/`、`src/engine/primitives/`、`src/engine/systems/` 或 `src/components/game/framework/` |
| 仅单游戏使用 | `src/games/<gameId>/` |
| 通用 UI 组件 | `src/components/` |
| 工具型能力 | `src/lib/` |

框架不默认注册游戏特定条件、阶段或组合规则；这些应由游戏层通过自己的 registry 显式注册。

`three`、`@react-three/fiber` 和 `drei` 已安装但当前未接入主代码。需要 3D 能力时，先明确目标入口、性能预算和验收方式。
