# 架构索引

本文是 BoardGame 的工程架构入口，只记录稳定分层、关键数据流和源码位置。引擎、传输、交互、日志、UI 和测试细则以 [`.spec/knowledge/README.md`](../.spec/knowledge/README.md) 路由的项目标准为准。

## 项目概览

BoardGame 是多桌游 Web / 移动平台，核心场景包括本地对局、联机对局、教程引导、资源发布和移动端容器分发。

技术栈：React / TypeScript / Vite / Tailwind CSS / i18next / howler / socket.io / Node.js / MongoDB / Vitest / Playwright。

## 分层

```text
src/games/<gameId>/
  -> 游戏 domain、规则数据、Board、素材适配
src/engine/
  -> pipeline、systems、primitives、transport、fx、testing
src/components/game/framework/
  -> 跨游戏 UI 骨架、HUD、壳层、共享交互组件
src/pages/
  -> 路由、对局页、本地页、工具页、管理页
server.ts / apps/api/
  -> 游戏服务、REST API、Socket、持久化和素材服务入口
```

依赖方向保持单向：游戏层消费引擎和共享框架；引擎层不依赖具体游戏 UI；共享层不写具体游戏名、卡牌名或私有流程。

## 核心链路

玩家动作进入系统后的主路径：

```text
UI / transport command
  -> domain.validate
  -> domain.execute
  -> Event[]
  -> domain.reduce
  -> systems.afterEvents
  -> playerView / UI / logs / fx
```

状态分层：

| 层 | 含义 |
| --- | --- |
| `G.core` | 游戏领域事实，供规则、胜负、AI 和命令校验消费 |
| `G.sys` | 跨游戏系统状态，例如 interaction、undo、log、eventStream、responseWindow、gameover |
| EventStream / FX | 视觉、音效和过程表现，不改变正式规则事实 |

## 关键入口

| 领域 | 入口 |
| --- | --- |
| 引擎系统总览 | [`.spec/knowledge/standards/engine-systems.md`](../.spec/knowledge/standards/engine-systems.md) |
| 传输与 Board props | [`.spec/knowledge/standards/engine-transport.md`](../.spec/knowledge/standards/engine-transport.md) |
| 交互与 Choice Request | [`.spec/knowledge/standards/rule-driven-interaction-design.md`](../.spec/knowledge/standards/rule-driven-interaction-design.md) |
| 旧 simple-choice 兼容 | [`.spec/knowledge/standards/engine-simple-choice.md`](../.spec/knowledge/standards/engine-simple-choice.md) |
| 伤害管线 | [`.spec/knowledge/standards/engine-damage-pipeline.md`](../.spec/knowledge/standards/engine-damage-pipeline.md) |
| 行动日志 | [`.spec/knowledge/standards/engine-action-log.md`](../.spec/knowledge/standards/engine-action-log.md) |
| 双端 UI 架构事实 | [`docs/architecture/ui-dual-platform-architecture.md`](architecture/ui-dual-platform-architecture.md) |
| 移动端实现入口 | [`docs/mobile-adaptation.md`](mobile-adaptation.md) |
| 测试运行入口 | [`docs/automated-testing.md`](automated-testing.md) |
| 部署运行入口 | [`docs/deploy.md`](deploy.md) |

## 主要源码

| 对象 | 路径 |
| --- | --- |
| 引擎适配 | [`src/engine/adapter.ts`](../src/engine/adapter.ts) |
| 管线执行 | [`src/engine/pipeline.ts`](../src/engine/pipeline.ts) |
| 系统集合 | [`src/engine/systems/`](../src/engine/systems/) |
| 引擎原语 | [`src/engine/primitives/`](../src/engine/primitives/) |
| 传输层 | [`src/engine/transport/`](../src/engine/transport/) |
| 游戏注册 | [`src/games/`](../src/games/) |
| 游戏 UI 框架 | [`src/components/game/framework/`](../src/components/game/framework/) |
| 页面入口 | [`src/pages/`](../src/pages/) |
| 服务端入口 | [`server.ts`](../server.ts)、[`apps/api/`](../apps/api/) |

## 测试分层

| 层 | 入口 |
| --- | --- |
| 单元 / 规则测试 | `src/**/*.test.ts`、`src/**/*.test.tsx` |
| 审计型测试 | `vitest.config.audit.ts` 和相关 `__tests__` |
| 真实浏览器 E2E | [`e2e/`](../e2e/) |
| 测试命令与端口 | [`docs/automated-testing.md`](automated-testing.md) |

测试分层、黄金链、截图证据和状态注入边界不在本文复写，统一回到 [`.spec` 测试标准](../.spec/knowledge/standards/e2e-verification.md)。

## 历史说明

旧版长文中的具体游戏举例、系统百科、测试细则和规则性条款已拆回 `.spec` 标准或对应专题文档。需要追溯历史内容时查 git 历史、`docs/archive/`、`docs/refactor/` 或对应 `docs/games/<gameId>/`。
