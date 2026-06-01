# Smash Up 新 UI / 实施中派系 E2E 截图验收（2026-06-02）

## 范围

- 目标 1：复现并收口“大杀四方里新增的牌库底交互 / 新 UI 交互卡住”相关链路。
- 目标 2：把当前实施中派系，或新派系里带新 UI 的真实交互，统一做端到端截图验收。
- 本轮覆盖：
  - `e2e/smashup/smashup-alien-terraform.e2e.ts`
  - `e2e/smashup/smashup-longzu-audit.e2e.ts`
  - `e2e/smashup/smashup-huluwawa-pr.e2e.ts`

## 结论

- `smashup-alien-terraform.e2e.ts`：`37 / 37 passed`
- `smashup-longzu-audit.e2e.ts`：`15 / 15 passed`
- `smashup-huluwawa-pr.e2e.ts`：`3 / 3 passed`
- 当前本轮范围内，已验收的新 UI / 实施中派系交互：`55` 条 E2E 用例，均有截图证据。

## 复现与修复摘要

### 1. 新交互“卡住”链路

- 端到端复现后，真正暴露出来的并不只是单一业务 handler 问题，还包括：
  - 旧 E2E 还在等过时的旧 prompt / 旧 phase；
  - 若场景夹具缺少真实 `scoreBases` frame 或 `deferred finalize` 上下文，新 UI 交互不会被挂出来，表面上像“卡住”；
  - 若旧用例还按旧的 DOM 点击路径走，新的 reaction / titan rail UI 会被误判成未响应。
- 已按真实运行链路修正 E2E 场景与等待口径，相关收口体现在 [smashup-alien-terraform.e2e.ts](/D:/gongzuo/webgame/BoardGame/e2e/smashup/smashup-alien-terraform.e2e.ts)。

### 2. 葫芦娃泰坦预览空白

- `葫芦娃` 详情页截图首次复现出“泰坦预览空白框”。
- 根因不是交互逻辑本身，而是 `葫芦小金刚` 预览图链路不稳定，导致新详情 UI 无法稳定渲染泰坦卡面。
- 已在 [SmashUpCardRenderer.tsx](/D:/gongzuo/webgame/BoardGame/src/games/smashup/ui/SmashUpCardRenderer.tsx) 为 `葫芦小金刚（huluwawa_little_king_kong）` 增加内联 SVG fallback 预览，彻底绕开外部静态图命中不稳定的问题；同时补齐本地资源文件与 manifest 元数据：
  - [assets-manifest.json](/D:/gongzuo/webgame/BoardGame/public/assets/i18n/assets-manifest.json)
  - `public/assets/i18n/zh-CN/smashup/taitan/huluwawa_titan.png`
  - `public/assets/i18n/zh-CN/smashup/taitan/compressed/huluwawa_titan.webp`

## 验证命令

```powershell
$env:PW_USE_DEV_SERVERS='true'
$env:PW_ALLOW_DEV_SERVER_TESTS='true'
$env:PW_START_SERVERS='false'
$env:PW_PORT='11773'
$env:PW_GAME_SERVER_PORT='25600'
$env:GAME_SERVER_PORT='25600'
$env:PW_API_SERVER_PORT='26600'
$env:API_SERVER_PORT='26600'
$env:PW_HAS_EXPLICIT_TARGET='true'
npx playwright test e2e/smashup/smashup-alien-terraform.e2e.ts
npx playwright test e2e/smashup/smashup-huluwawa-pr.e2e.ts
```

longzu 当前重跑命令：

```powershell
BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-longzu-audit.e2e.ts
```

实际结果：`15 passed (3.5m)`

## 截图证据

### alien / terraform / titan rail 新 UI

- 目录：`test-results/evidence-screenshots/smashup/smashup-alien-terraform.e2e/`
- 重点截图对象包括：
  - `奶油泡芙美人`：先弃手牌，再额外打出弃牌堆标准战术，并将其放到牌库底
  - `三号空间站`：查看任一牌库顶并将其放到牌库底
  - `海怪克拉肯`：计分后打到替换基地 / 移随从到其他基地
  - `移动城堡`、`漫游山岭巨人`、`Major Ursa`、`时间盒子`、`彩虹鸟`、`哥佐拉`、`企鹅帝皇` 等泰坦新 UI 入口

### longzu 三派系实施中交互

- 目录：`test-results/evidence-screenshots/smashup/smashup-longzu-audit.e2e/`
- 本轮特别相关的“牌库底”/新 UI 截图包括：
  - `超级英雄：水晶堡垒在这里打出随从后可把弃牌堆随从放到牌库底`
  - `龙：烧毁它从真实手牌行动选择基地弃牌堆替换基地并保留原基地随从`
  - `极客：无限循环重放禁卡表时先完成被重放行动交互，再出现回手提示`

### 葫芦娃 PR 交互

- 目录：`test-results/evidence-screenshots/smashup-huluwawa-pr/`
- 关键截图：
  - `02-zh-faction-detail-preview.png`
    - 已看到 `葫芦小金刚` 泰坦预览，不再是空白框
  - `03-in-game-huluwawa-resources.png`
    - 对局内手牌 / 场上仆从 / 泰坦资源同时渲染
  - `05-erwa-reorder-prompt.png`
    - 二娃真实“顶 / 底重排”交互
  - `08-lotus-resolved-once.png`
    - 七彩莲蓬真实额外打出入口，且同回合只触发一次

## 相关文件

- [smashup-alien-terraform.e2e.ts](/D:/gongzuo/webgame/BoardGame/e2e/smashup/smashup-alien-terraform.e2e.ts)
- [smashup-huluwawa-pr.e2e.ts](/D:/gongzuo/webgame/BoardGame/e2e/smashup/smashup-huluwawa-pr.e2e.ts)
- [SmashUpCardRenderer.tsx](/D:/gongzuo/webgame/BoardGame/src/games/smashup/ui/SmashUpCardRenderer.tsx)
- [smashup-longzu-deep-audit-2026-06-01.md](/D:/gongzuo/webgame/BoardGame/evidence/smashup/smashup-longzu-deep-audit-2026-06-01.md)
- [smashup-longzu-implementation-handoff-2026-06-01.md](/D:/gongzuo/webgame/BoardGame/evidence/smashup/smashup-longzu-implementation-handoff-2026-06-01.md)
