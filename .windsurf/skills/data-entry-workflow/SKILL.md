---
name: data-entry-workflow
description: "用于本项目里基于图片、规则书、Wiki、PDF、截图做业务数据录入、核对、裁图、资源索引登记、文案同步时。先执行零猜测数据录入门禁，再按 gameId 进入对应 workflow；适用于 Dice Throne 角色录入、Smash Up 派系 intake / implementation 交接，以及其他游戏的数据真相源锁定与核对契约建立。"
---

# 数据录入工作流

## 何时使用

- 用户要求“录入数据”“根据图片补卡牌/技能/Token”“核对图片和代码”“整理真相源”“补 atlas 索引”“根据规则书/PDF/Wiki 更新文案或静态数据”时使用。
- 这不是实现 skill；它先收紧数据录入纪律，再把任务路由到对应游戏的 workflow。

## 先读

- 通用门禁：`docs/ai-rules/data-entry.md`
- 涉及图片资源路径、manifest、R2/CDN 时：`docs/ai-rules/asset-pipeline.md`
- 录入后要进入机制实现时：`docs/ai-rules/engine-systems.md`
- 不确定还要看什么时：`docs/ai-rules/doc-index.md`

## 强制门禁

1. 先确认 `gameId`、本轮 scope、对应 `git worktree`，禁止在错工作区里看素材和下结论。
2. 先锁定主真相源和对照源，并把“谁负责什么字段”写清楚。
3. 先裁图到单对象可读粒度，再开始正式录入。
4. 先写 Markdown 核对契约，再改运行时代码。
5. 任意名称、数字、限定词、索引看不清时必须停下，禁止猜。
6. 涉及规则、文案、资源映射时，先同步文档，再进入实现。
7. 发现资源 404、白卡面、CardPreview 异常时，必须按最终请求 URL 排查 `compressed/`、manifest 和 R2，不得只看本地原图。
8. 录入完成后，只要动到了运行时资源，就默认由 AI 主动完成上传和远端回查；如果没传成，最终必须明确告知用户哪些资源还没上传以及当前影响。

## 资源基操清单（强制，不再省略）

只要本轮新增/替换了图片资源，必须按这个最小链路执行并回报结果：

1. `npm run compress:images -- <目标目录>`
2. `npm run assets:upload`
3. 对本轮新增资源 URL 做 `HEAD` 回查，要求 `200`
4. 最终汇报必须写清：
   - 本地压缩产物路径
   - 远端 URL
   - 上传结果（上传/跳过数量）
   - `HEAD` 状态码

不得以“本地看得到图”替代上传与远端验证。

## Spec 驱动拆解模板（跨游戏通用，强制）

> 这是通用拆解能力，不需要用户每个游戏都重新教怎么拆。

当任务不只是“录入”，还包含实现/重构/验证时，默认按以下层级拆任务并逐层收口：

1. **S0 - 合同层（Contract）**
   - 锁定真相源、命名裁定、atlas/索引、范围边界、未决项
   - 产出可复查合同文档（未完成不得进入 S1）
2. **S1 - 配置复用层（Config-first）**
   - 先接入可通过配置直接完成的一批（ids、静态数据、metadata、locale、可直接复用 handler）
   - 目标是先压缩不确定性，不在此阶段发明新机制
3. **S2 - 机制扩展层（Mechanism）**
   - 处理共享抽象缺口：新增/重构 shared helper、domain 机制、交互链路
   - 默认面向后续扩展，禁止临时代码；发现可复用缺口可直接扩展重构
4. **S3 - UI 与 E2E 层（UX & E2E）**
   - 补真实入口交互、可视反馈、关键端到端链路
   - 同步 evidence 与截图核验
5. **S4 - 统一收口层（Closeout）**
   - 回归测试、资源上传与远端验证、审计结论、剩余风险

### 拆解纪律（强制）

- **单派系/单模块内也要拆成 S1/S2/S3 子批次**，不能“一把梭”。
- 任何阶段若仍有未实现项，必须显式留在待办，不得误报“已完成”。
- 若实现中发现共享缺口，默认直接走 S2 做可复用重构；不要把问题拖到“以后再说”。
- 只有当当前层的验收标准达标后，才能进入下一层。

## Workflow 路由

### Smash Up

- **仅 intake / 仅录入资源**
  - 适用：用户只要求核图、切 atlas、录静态数据、补 locale、补 faction metadata、上传资源
  - 读 `docs/games/smashup/workflows/smashup-faction-intake.md`
- **intake + 派系玩法实施**
  - 适用：用户明确要求“把新派系做进游戏”“继续实现玩法”“从图片一路做到正式可玩”
  - 先读 `docs/games/smashup/workflows/smashup-faction-intake.md`
  - intake 收口后继续读 `docs/games/smashup/workflows/smashup-faction-implementation.md`
- **禁止误路由**
  - Smash Up 新派系任务不是“新增游戏”，默认**不要**改走 `.windsurf/skills/create-new-game/SKILL.md`
  - 除非用户真的要新增一个全新的 `gameId`，否则应以 Smash Up 专用 workflow 为准
- 额外硬规则：
  涉及 Wiki 核对时，必须按仓库根 `AGENTS.md` 使用项目爬虫，不能凭记忆。
  - 若 intake 文档已经明确“不包含 gameplay ability handler”，则不得把“资源接入完成”误报成“派系完成”
  - intake 阶段的输出必须形成 handoff 包，再交给 implementation 阶段；不能把两阶段混成一团不留痕

### Dice Throne

- 单角色 / 新英雄的图片、骰面、Token、卡牌、裁图、资源上传、规则文档录入：
  读 `docs/games/dicethrone/workflows/dicethrone-hero-intake.md`

### 其他游戏

- 若还没有专用 workflow：
  以 `docs/ai-rules/data-entry.md` 为主流程，再补读该游戏自己的 `src/games/<gameId>/rule/` 文档。
- 不得把某个游戏的字段结构、抓取站点或索引习惯提升成全局默认。

## 交付要求

- 至少产出：真相源表、切图表、核对合同表、对照表、冲突待裁定表。
- 最终汇报必须明确：
  - 主真相源是什么
  - 对照源是什么
  - 哪些字段已确认
  - 哪些字段仍待裁定
  - 改动是否已经同步到文档、资源、代码
  - 资源是否已经上传到 R2 / CDN；若没有，具体缺口是什么
