# 两日合并/修复高风险改动扫描（2026-04-11）

## 1. 审计范围
- **时间窗口**：2026-04-10 00:00 ～ 2026-04-11 23:59
- **目标**：扫描两日内 `merge` / `fix` / 收口类提交，整理高风险改动点与潜在回归清单，供 leader 后续统一回归与发布门禁参考。
- **重点提交**：
  - SmashUp：`b77dc8f9`、`873732a6`、`933279b8`、`cdfae5fd`、`e25f9af7`
  - 在线 AI / 传输：`0a83cbf4`、`12c79655`
  - 移动端 / 兼容：`342a22c3`、`66e306c1`、`6247641d`
  - 平台/工作台：`54bb2d5f`

## 2. 证据来源
- `git log --since='2026-04-09 00:00:00' --until='2026-04-11 23:59:59'`
- `git show --stat/--unified` 针对重点提交抽样
- 合并裁决文档：
  - `evidence/merge-conflict-main-merge-2026-04-11.md`
  - `evidence/merge-conflict-pr63-2026-04-11.md`
  - `evidence/merge-conflict-pr66-2026-04-11.md`
  - `evidence/merge-conflict-pr67-2026-04-11.md`
- 相关专项审计：
  - `evidence/smashup/smashup-response-window-actions-audit-2026-04-11.md`
  - `evidence/dicethrone/dicethrone-ai-stall-audit-2026-04-10.md`

## 3. 风险总览（按优先级）

### P0：SmashUp 计分 / extra-play / affect / Titan 主链连续重构
**命中提交**：`b77dc8f9`、`873732a6`、`933279b8`、`cdfae5fd`

#### 风险点 A：afterScoring 延迟链与多基地计分串联
- **证据**：`b77dc8f9` 直接改 `src/games/smashup/domain/baseAbilities.ts`；`merge-conflict-main-merge-2026-04-11.md` 说明 `getDeferredPostScoringEvents` / `appendDeferredPostScoringEventsIfLast` 再次裁决。
- **为何高风险**：
  - 同一条“计分前/计分中/计分后”链路在两天内被多次修补，且跨 `baseAbilities.ts`、`domain/index.ts`、`titans.ts`。
  - 这里一旦状态传递遗漏，会表现为：第二个基地不继续结算、延迟事件重复补发、Prompt 悬挂、Titan clash 时序错乱。
- **最可能回归**：
  1. 多基地连续爆破时，第二基地 `afterScoring` 不触发。
  2. 带 deferred post-scoring 的牌在最后一个交互后重复结算。
  3. Titan / POD 版能力在计分链中读取了旧 interactionData。

#### 风险点 B：额外出牌时机从“额度”改成“额度 + immediate prompt”双轨
- **证据**：`873732a6` 新增 `src/games/smashup/domain/extraPlay.ts`（463 行），`domain/index.ts` 接入 `queueImmediateExtraPlayInteractions()`；`merge-conflict-pr66-2026-04-11.md` 明确区分 `banked vs immediate`。
- **为何高风险**：
  - 旧逻辑只改 limit；新逻辑要求在 `postProcessSystemEvents` 里挂 prompt。
  - 如果后续入口仍走旧 `grantExtraAction/grantExtraMinion`，就会出现额度滞留或不弹 prompt。
- **最可能回归**：
  1. `startTurn` / `special` 获得的 extra 错误保留到 `playCards`。
  2. immediate prompt 只在主路径生效，旁路路径（外部行动、基地能力、Titan、融合牌）漏挂。
  3. UI 提示仍按旧“可稍后使用”口径，和规则文案不一致。

#### 风险点 C：affect 语义与保护拦截从散逻辑改为 record 聚合
- **证据**：`933279b8` 新增 `src/games/smashup/domain/affect.ts`（377 行），`domain/reducer.ts` 用 `buildAffectRecords()` + `onMinionAffected` 聚合；`merge-conflict-pr67-2026-04-11.md` 明确修了 wildlife preserve 误拦截枪手决斗。
- **为何高风险**：
  - 这是 destroy / move / return / shuffle / control-change 等多类事件的统一抽象层。
  - 保护判断现在依赖“来源是不是 action/fusion”，错误分类会导致保护过拦或漏拦。
- **最可能回归**：
  1. `action` 保护误挡非行动来源（基地/随从能力）。
  2. `affect` 保护未覆盖 deck / attached_action / titan 等新 targetKind。
  3. `onMinionAffected` 二次触发或漏触发，造成额外能力重复结算。

#### 风险点 D：POD / Titan 批量实现一次性大体积合并
- **证据**：`cdfae5fd` 单次改 `src/games/smashup/abilities/titans.ts` 2857 行、`data/titans.ts` 38 行；合并裁决说明清理了重复实现、参数误传与残留代码块。
- **为何高风险**：
  - 大文件、高冲突、合并后再人工去重，最容易残留“只在某张 Titan / POD 牌上出错”的长尾问题。
  - 这里还叠加了前述 afterScoring 与 extra-play 语义变更。
- **最可能回归**：
  1. 某些 Titan 仍保留旧 helper / 旧参数签名。
  2. 仅 POD 别名版本出错，普通版通过。
  3. 交互分支被合并残留覆盖，出现 unreachable / 死分支。

### P1：在线 AI 看门狗与交互取消链路再改
**命中提交**：`0a83cbf4`、`12c79655`

#### 风险点 E：server watchdog 从 simple-choice 扩展到 card interaction / forced cancel
- **证据**：`0a83cbf4` 改 `src/engine/transport/server.ts` + `InteractionSystem.ts` + `server.test.ts`；`12c79655` 改 `src/pages/onlineAiForceSkip.ts`、`MatchRoom.tsx`、`matchLoadTrace.ts`。
- **为何高风险**：
  - 服务器端和前端“强制恢复”同时变更，涉及交互取消、恢复串行推进、trace 上报。
  - 这类修复很容易从“解决卡死”变成“误取消正常交互”。
- **最可能回归**：
  1. 正常可操作交互被误判为 `empty-options` 自动取消。
  2. 前端与服务端都尝试恢复，导致重复推进或错位日志。
  3. trace 记录成功，但实际 seat view / phase 没推进，形成“伪恢复”。

### P1：质量门禁脚本在 pre-push 模式做了逻辑级重构
**命中提交**：`e25f9af7`

#### 风险点 F：changed-quality-gate 的 diff 基线、重命名、warning-delta 口径全部改变
- **证据**：`scripts/infra/run-changed-quality-gate.mjs` 单次 +237/-9；新增 `parseDiffNameStatus()`、`resolvePrePushLintContext()`、`ESLint warning delta`、`previousHead` 逻辑。
- **为何高风险**：
  - 这是发布门禁本身，出错不会体现在业务，而会体现在“该拦没拦”或“误拦所有 push”。
  - 改动覆盖 Windows 命令切片、重命名文件、pre-push 多提交范围判定。
- **最可能回归**：
  1. rename/copy 文件未被正确纳入 lint/typecheck。
  2. 多提交 pre-push 只看 `HEAD^`，漏掉更早未推送改动。
  3. warning delta 只统计当前文件，遗漏 baseline warning 对比异常。

### P1：移动端 viewport / FAB / socket fallback 兼容策略连动调整
**命中提交**：`342a22c3`、`66e306c1`、`6247641d`

#### 风险点 G：legacy viewport fallback 改成按 board-shell 计算缩放变量
- **证据**：`342a22c3` 在 `useRuntimeViewport.ts` 新增 `layoutEngineCapabilities`、`--mobile-board-shell-*` 一整套 CSS vars；`GamePageRescueGate.tsx` 同步恢复救援检测。
- **为何高风险**：
  - 会影响所有移动端棋盘壳层，不止单页。
  - 变量写入条件增加后，最容易出现“某些 profile 不写变量，布局直接炸掉”。
- **最可能回归**：
  1. 非 `board-shell` 页面 safe-area 正常，但游戏页缩放错乱。
  2. 旧内核 Android 上 rescue gate 误报 / 漏报。
  3. `visualViewport` resize 监听触发频率变化导致抖动。

#### 风险点 H：FAB 存储格式兼容 + 展开定位规则重写
- **证据**：`66e306c1` 修改 `fabLayout.ts` / `fabPosition.ts`，从“展开偏移”改为“重算锚点 top 并清理 legacy percent”。
- **为何高风险**：
  - 同时兼容旧存储格式和新百分比格式，容易出现老用户位置漂移。
  - 展开布局逻辑从 offset 改成 clamp，很容易在窄屏/刘海屏边界出错。
- **最可能回归**：
  1. 已保存位置的老用户首次升级后 FAB 跳位。
  2. 顶部展开/底部展开判断反转，按钮被遮挡。
  3. 测试只覆盖 preview，不覆盖真实 safe area。

#### 风险点 I：开发/测试 socket fallback 顺序从 polling-first 改回 websocket-first
- **证据**：`6247641d` 仅改 2 行，但直接影响 `SOCKET_IO_TRANSPORTS_DEV_FALLBACK`。
- **为何高风险**：
  - 表面小改，实际影响所有 dev/test/Android 壳连接首选策略。
  - 这类变更容易让“本地噪声减少”和“真机更稳定”出现取舍反转。
- **最可能回归**：
  1. 旧 WebView / 代理环境重新出现 websocket 首次握手失败。
  2. 测试环境偶发从秒连变成长时间重试。
  3. 兼容模式开关与环境默认值组合出错。

### P2：AI Repo Workbench / 布局服务等平台能力并入主线
**命中提交**：`54bb2d5f`、`1aa4a856`

#### 风险点 J：大型平台功能并入，但与当前主任务域（游戏逻辑）共享基础设施
- **证据**：`54bb2d5f` 同时引入 API 模块、前端 runtime、LangGraph 编排、E2E、文档与资源；`1aa4a856` 补布局服务 UI 场景保存。
- **为何高风险**：
  - 改动量大，但主线近期同时在修游戏逻辑与移动端，跨域耦合高。
  - 更容易出现“不是本功能出错，但共享配置/路由/依赖被带坏”的问题。
- **最可能回归**：
  1. `apps/api` 新模块影响现有服务启动/依赖解析。
  2. E2E/fixtures 被工作台场景改写后，普通大厅/匹配测试不稳定。
  3. 布局服务保存字段扩容后，旧数据读写兼容性出问题。

## 4. 建议回归清单（执行优先级）

### A. SmashUp 高优先级回归
1. **多基地计分串联**
   - 用例：连续两个基地同轮爆破；含 `afterScoring`、`beforeScoring`、Titan / POD 混合。
   - 关注：第二基地是否继续、延迟事件是否只补发一次。
2. **Immediate extra-play**
   - 用例：`startTurn` 获得 extra、`special/beforeScoring` 获得 extra、`playCards` 内普通 extra。
   - 关注：额度是否立即消费/放弃、是否错误滞留。
3. **affect / protection**
   - 用例：action destroy、non-action destroy、move、return、shuffle、ongoing/attached action 受影响。
   - 关注：`action` 与 `affect` 保护是否区分正确。
4. **Titan / POD 批量能力**
   - 用例：PR63 文档列出的 POD 重点卡 + 至少 1 个普通 Titan。
   - 关注：普通版 / POD 版行为一致，不出现只某个 alias 坏掉。

### B. 在线 AI / 传输回归
1. **无解交互自动取消**
   - simple-choice、`dt:card-interaction`、responseWindow 锁定场景各跑 1 条。
2. **正常交互不误取消**
   - 有可选目标的同类场景对照验证。
3. **前后端恢复串行一致性**
   - 检查 `matchLoadTrace`、服务端 watchdog 日志、实际 phase 推进是否一致。

### C. 移动端 / 兼容回归
1. **board-shell 横屏游戏页**：SmashUp / SummonerWars 各 1 条。
2. **FAB 老存储升级**：带旧 `leftPercent/topPercent` 和 legacy offset 两种存档。
3. **socket 连接**：本地浏览器、Android 壳、兼容模式开/关四象限。

### D. 门禁 / 平台回归
1. **quality gate**：
   - 单提交、连续多提交、rename 文件、仅 warning 增量四类样本。
2. **AI Repo Workbench / layout service**：
   - API 启动、基础读写、与普通大厅/布局流程共存验证。

## 5. 建议阻塞项（如果 leader 要进一步收口）
- 在发布前，至少补一轮 **SmashUp 重点链路回归**：计分串联 / immediate extra-play / affect protection / Titan-POD。
- 对 `run-changed-quality-gate.mjs` 做一次 **门禁自测**，否则存在“假绿灯”风险。
- 移动端若要跟本轮一起发，必须补 **board-shell + FAB + socket** 联动回归；否则建议分批。

## 6. 当前结论
- 这两天的风险中心明显集中在 **SmashUp 主流程重构**、**在线 AI 恢复链路**、**移动端兼容层**、**质量门禁自身重构** 四组。
- 其中 **SmashUp 计分 / extra-play / affect / Titan** 是唯一同时具备“高冲突 + 大体积 + 多次连修 + 规则时序敏感”的区域，应视为本轮最高优先级回归面。
