# Change: 幻想国度新游戏基础接入与实体牌桌方案

## Why
- `fantasyrealms` 已经进入“新游戏具体设计与拆任务”阶段，不能再只停留在通用新游戏 workflow。
- 当前仓库里虽然已有 `fantasyrealms` 的探索性 Board 与证据文件，但缺少正式的 OpenSpec proposal / design / tasks / spec，导致范围、阶段、验收口径和后续实现边界都不够清晰。
- 用户已经明确收敛了视觉与布局方向：`fantasyrealms` 要走单一的奇幻实体牌桌风格，不要再回到“标题 + 已连接 + 大计分板”的通用模板。
- 当前歧义已经从“有没有实现”转成“什么才算 foundation 完成”：如果真实页面还留着阻塞主路径的 UI bug，就不能把它叫完成；如果只是后续非阻塞 polish，则不应继续反向否定主 change 的完成状态。
- 本 change 的目标是按当前真实需求把 foundation 阶段正式冻结下来，而不是再用“最小提案”模糊流程。

## What Changes
- 新增 `fantasyrealms-foundation` capability，定义 `fantasyrealms` 的新游戏基础接入范围、桌面布局不变量、响应式口径与交付证据。
- 把 `fantasyrealms` 的首期工作分成三块明确管理：
  - 新游戏基础资料与来源裁定
  - 单一“实体牌桌”Board 方向
  - 后续接入 manifest / game / domain 前的边界与验收
- 正式要求 `fantasyrealms` Board 以牌桌对象为主，不把游戏标题、连接态、阶段条或大面积计分纸放到主视口。
- 正式要求 foundation UI 跟随当前已落地玩法语义：
  - 公共区展示当前正式公共桌面对象（例如公开弃牌堆），而不是继续沿用旧静态稿里的“固定 7 张公共牌”语义
  - 当当前玩法以 7 张手牌为核心时，手牌区必须保持 7 张完整可读
- 正式要求“实施完成”的定义以真实页面端到端验收为准；如果主路径仍存在阻塞级 UI bug，则该 change 不得宣称完成。
- 把当前探索性实现纳入正式 change 管理：设计文档、Board 原型与 evidence 必须与 spec 对齐，而不是继续作为无规范约束的散落产物。

## Impact
- Affected specs: 新增 `fantasyrealms-foundation`
- Affected code:
  - `src/games/fantasyrealms/**`
  - `design-system/games/fantasyrealms.md`
  - `evidence/fantasyrealms/**`
  - `public/assets/i18n/zh-CN/fantasyrealms/**`（若本 change 继续补正式资源）
  - 与 `fantasyrealms` 相关的后续 manifest / game / domain 接入文件

## Current State And Proposal Gate
- 当前状态：`fantasyrealms` 的 foundation / card catalog / scoring / gameplay / runtime-entry 都已经进入正式 OpenSpec change 管理；foundation 这条 change 现在负责的是**视觉与布局基础层**，不是再独占后续 gameplay 或本地入口的完成口径。
- 当前仓库已经存在探索性前端产物：
  - `src/games/fantasyrealms/Board.tsx`
  - `design-system/games/fantasyrealms.md`
  - `evidence/fantasyrealms/**`
- 当前仓库的 runtime 产物与本地入口已由后续 change 接手：
  - `add-fantasyrealms-two-player-core-loop`
  - `add-fantasyrealms-standard-multiplayer-flow`
  - `add-fantasyrealms-official-scoring-engine`
  - `enable-fantasyrealms-local-entry`
- 因此，foundation 这条 change 的完成判定必须聚焦于：
  - 单一实体牌桌方向是否成立
  - 当前真实玩法语义下的信息层级是否成立
  - 真实页面端到端是否还留有阻塞级 UI bug
- 非阻塞的后续 polish 可以继续做，但不得继续与“foundation 已否完成”混成同一口径。
