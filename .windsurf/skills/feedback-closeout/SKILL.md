---
name: feedback-closeout
description: 用于 BoardGame 项目中批量处理线上真实反馈、开放反馈接口收口、重复反馈排重、真假 bug 分诊、并行修复与状态回写。用户提到“处理反馈”“收口反馈”“拉未关闭反馈”“批量 triage 反馈”“根据反馈修 bug”“关闭误报/重复反馈”“多 agent 并行处理反馈”时使用。默认只处理线上真实反馈；本地开发库、本地导出快照、临时 JSON、网页壳接口返回的 HTML 只能作为诊断材料，不能默认当成正式回写目标。
---

# 反馈收口

## 概览

这个 skill 负责把“看反馈”收敛成一条固定流水线：先从开放接口抓取未收口反馈，再排重、分类、挑出可并行的非冲突候选，最后由多个子 agent 分别判断真假 bug、修复代码并回写状态。

优先使用本 skill 自带脚本，不要手工拼 URL、手工拷贝 JSON、手工维护重复组。

## “处理反馈”的含义（强制）

当用户说“处理反馈/收口反馈/修复反馈”时，**默认必须同时覆盖下面这些动作**，不能只做其中一部分就对外宣称“已处理”：

1. **拉取最新线上真实反馈**（或明确获得用户许可改用生产库直连），并同步到 `status-board.json`。
2. **排重与代表项归并**，只对代表项进行分诊与处理。
3. **分诊与结论**：判定是真 bug / 误报 / 建议 / 已修复待回写 / 证据不足等。
4. **若是真 bug：修复 + 验证 + 证据**（测试、截图或日志证据），不得只改状态。
5. **状态回写**：本地状态板 + 远端正式状态同步更新。
6. **更新记录/文档**：补充证据或说明本轮使用的真实写入口。

**注意**：仅回写状态 ≠ 修复完成；仅本地验证但未回写 ≠ 已收口。对外汇报时必须清楚说明本轮到底完成了哪些步骤。

## 本地状态板（强制）

- 当前批次反馈默认使用 `temp/feedback-closeout/status-board.json` 作为本地状态板。
- 该 JSON 是当前批次反馈进度的单一真实来源：一旦某条反馈确认进入 `in_progress`、`resolved`、`closed` 或 `blocked`，必须立刻更新状态板，禁止等整批结束再统一回填。
- `resolved` 至少要附 1 条 `evidence` 和 1 条 `verification`；`closed` 至少要写清 `notes` 或补充证据。
- 推荐顺序：
  1. 先用 `sync-feedback-status-board.mjs` 从最新 `summary.json` 初始化/刷新状态板
  2. 每拿到一个新结论，立刻用 `update-local-feedback-board.mjs` 更新该条本地状态
  3. 再执行远端正式状态回写
  4. 最后跑 `scripts/verify/verify-feedback-status.mjs` 做一次本地校验

初始化/刷新状态板：

```bash
node .windsurf/skills/feedback-closeout/scripts/sync-feedback-status-board.mjs temp/feedback-closeout/<timestamp>/summary.json
```

更新单条本地状态：

```bash
node .windsurf/skills/feedback-closeout/scripts/update-local-feedback-board.mjs --id <feedbackId> --status resolved --owner codex --evidence evidence/<file>.md --verification "<验证命令>" --screenshot <绝对路径截图>
```

校验状态板：

```bash
node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json
```

## 默认目标

- 默认目标必须是线上真实反馈。
- 本地开发 API、本地 Mongo、本地导出目录、`feedbacks.repaired.json`、`temp/*.json`、网页域名上返回的 SPA HTML，都只能用于辅助诊断、证据整理和人审，不得默认视为“已经改到真实反馈状态”。
- 只要要执行 `in_progress / resolved / closed` 这类正式状态回写，必须先确认当前连接的就是线上真实反馈源。
- 如果当前拿到的是本地开发库、测试库、历史导出快照，必须明确标成“本地/离线视图”，禁止对外宣称“已回写”。

### 回写前强制核对

在第一次读或写状态前，必须先核对下面四件事：

1. 当前目标是线上真实反馈，而不是本地开发库。
2. 当前接口返回的是反馈 JSON，而不是前端 SPA fallback HTML。
3. 当前样本数量或目标反馈 ID 与用户给的导出/列表能对上。
4. 如果发现 HTTP 接口并不指向真实线上数据，才允许切换到用户已批准的其他真实写入口，例如生产机上的 Mongo 直连脚本。

如果上面任一项不能确认，就先停在分诊和证据阶段，不要写状态。

## 先读

- 仓库根 `AGENTS.md`
- `docs/ai-rules/testing-audit.md`
- `docs/testing-best-practices.md`
- 本 skill 的 [feedback-open-api.md](references/feedback-open-api.md)

## 工作流

### 1. 拉取并排重

先确认 `--base-url` 真的是线上真实反馈接口，再运行：

```bash
node .windsurf/skills/feedback-closeout/scripts/triage-open-feedback.mjs --base-url <真实反馈接口基址> --slots 4
```

如果要把挑出的并行候选立即认领成 `in_progress`：

```bash
node .windsurf/skills/feedback-closeout/scripts/triage-open-feedback.mjs --base-url <真实反馈接口基址> --slots 4 --mark-in-progress
```

禁止把 `http://127.0.0.1:*` 当成默认正式目标，除非用户明确说这次就是要处理本地测试反馈。

脚本会：

- 默认抓取 `open,in_progress`
- 按内容与错误签名做重复组归并
- 产出 `temp/feedback-closeout/<timestamp>/summary.json`
- 把反馈中的内嵌截图落到本地 `images/` 临时目录
- 为每个代表项生成一份 Markdown 诊断包
- 选出一组 `parallelCandidates`，用于后续并行分派
- 可选把 `parallelCandidates` 立即改成 `in_progress`

拉取完成后，立即把本批 `summary.json` 同步到本地状态板，不要跳过这一步：

```bash
node .windsurf/skills/feedback-closeout/scripts/sync-feedback-status-board.mjs temp/feedback-closeout/<timestamp>/summary.json
```

### 2. 先分类，再决定真假 bug

按 `summary.json` 中的代表项处理，不要把重复项当独立问题并行开工。

分类规则：

- `bug_candidate`
  - 进入真实排查流程。
- `non_bug`
  - 优先检查是否只是建议、体验意见、已知行为、或重复上报。
- `needs_review`
  - 证据不足，先人工阅读诊断包再决定。

判断真假 bug 时，必须先检查：

1. 用户描述和现有实现是否真的冲突。
2. 反馈是否只是重复、误用、环境噪音、历史已修复问题。
3. 若是 bug，最小可复现链路和可疑模块是什么。

只要结论已确认，就先更新本地状态板，再继续处理下一条反馈。

### 2.5 批量修复前先检查“最近是否已经顺手修过”

很多开放反馈会落在“代码其实已经修了，但状态还没回写”的阶段；批量开工前必须先做一次最近更新核对，避免重复修同一个问题。

强制检查顺序：

1. **先看本地状态板**
   - `temp/feedback-closeout/status-board.json`
   - 若某条已经是 `resolved/closed`，禁止再次当成待修 bug 派单
2. **再看最近证据与最近改动**
   - 优先搜索 `evidence/` 中最近 1~3 天新增/更新的反馈文档
   - 再按反馈关键词、卡牌名、错误文案、游戏模块 grep 最近改过的源码/测试
3. **最后才决定是否真的进入“修复”**
   - 若代码与证据已经覆盖用户描述，只差状态没回写：应走“补验证/补证据/回写状态”流程，而不是重新改实现
   - 若只能确认“可能已修”，但缺少证据：先补最小验证，再决定 `resolved` 还是继续 `in_progress`

推荐核对项：

- 最近新增的 `evidence/*.md`
- 最近修改的目标模块、测试、E2E 文件
- 当前反馈关键词是否已出现在最近提交说明、审计文档、状态板 notes 中
- 是否存在“同根因已修”的其他反馈条目，可直接复用证据或沿同一修复链收口

禁止：

- 不看最近更新就机械重修整批反馈
- 明明已有修复证据，却再次让多个子 agent 改同一批文件
- 看到“像是修过”就直接改 `resolved`，但不补验证与证据

### 3. 只并行不冲突的代表项

并行前必须满足：

- 每个子 agent 只接一个代表项。
- 只挑 `parallelCandidates`，或你自己确认 `conflictKey` 不冲突。
- 多个子 agent 不能同时写同一批关键文件。
- 同一重复组只允许一个 agent 处理代表项。

使用子 agent 时必须显式固定模型配置：

- `model: gpt-5.4`
- `reasoning_effort: high`

给 worker 的任务必须包含：

- 反馈 ID
- 诊断包路径
- 该 worker 负责的文件或模块边界
- 明确要求先判断“是不是真 bug”
- 如果不是 bug，禁止改代码，直接回传结论
- 如果是 bug，修复后必须跑匹配验证，再回写状态

### 4. 状态回写规则

只在拿到明确结论后改状态：

- 误报、建议、重复、已失效
  - 改 `closed`
- 确认为 bug，且代码与验证已完成
  - 改 `resolved`
- 预计要持续处理较久，且已经明确接手
  - 可先改 `in_progress`

本地状态板和远端正式状态必须一起维护：

1. 先更新 `temp/feedback-closeout/status-board.json`
2. 再回写远端正式状态
3. 如果远端回写失败，必须立刻在本地状态板补 `notes` 说明阻塞原因，必要时改成 `blocked`

使用：

```bash
node .windsurf/skills/feedback-closeout/scripts/update-feedback-status.mjs <feedbackId> <status> --base-url <真实反馈接口基址>
```

收口代表项并顺带关闭重复项：

```bash
node .windsurf/skills/feedback-closeout/scripts/finalize-feedback-group.mjs temp/feedback-closeout/<timestamp>/summary.json <feedbackId> resolved --base-url <真实反馈接口基址>
```

补充规则：

- 如果开放反馈接口实际上指向本地开发库或空库，禁止因为“脚本能通”就把本地结果当成线上已回写。
- 如果线上 HTTP 接口不可用，但用户已经允许使用生产机直连数据库作为真实写入口，可以改走生产机脚本；此时必须在交付里明确写明“本轮不是通过 HTTP 接口，而是通过生产机真实数据源回写”。
- 未经用户明确允许，不要擅自使用生产 SSH、生产数据库直连或其他越过业务接口的写路径。
- 不得只改远端状态、不改本地状态板；也不得只改本地状态板就口头宣称“已收口”。

### 5. 交付口径

最终汇报必须明确：

- 这次处理的是不是线上真实反馈
- 实际回写走的是 HTTP 真实接口，还是其他经确认的真实写入口
- 总共抓到了多少条未收口反馈
- 归并成多少个代表项
- 哪些被判定为重复并关闭
- 哪些不是 bug 并关闭
- 哪些是真 bug，改了什么，验证了什么，状态已改为 `resolved`
- 哪些还未处理，以及为什么不能并行

### 6. 提交规范（新增）

- **同一批次反馈默认合并为一个提交**，除非用户明确要求拆分提交。
- 禁止把“单条小修复”拆成多个琐碎提交。
- 若同批包含多个反馈修复与对应测试，**优先一个提交**统一落盘。

## 资源

### scripts/

- `triage-open-feedback.mjs`
  - 拉取开放反馈、排重、分类、生成诊断包与并行候选。
- `update-feedback-status.mjs`
  - 用开放接口回写状态。
- `finalize-feedback-group.mjs`
  - 按 `summary.json` 收口代表项，并默认关闭同组重复项。
- `sync-feedback-status-board.mjs`
  - 从 `summary.json` 初始化/刷新本地状态板，并保留已写入的本地证据/备注。
- `update-local-feedback-board.mjs`
  - 即时更新单条反馈的本地状态、证据、验证命令和截图路径。

### references/

- `feedback-open-api.md`
  - 开放接口与状态语义。
