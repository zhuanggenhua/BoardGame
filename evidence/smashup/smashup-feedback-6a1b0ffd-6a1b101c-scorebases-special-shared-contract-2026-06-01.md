# SmashUp 反馈 `6a1b0ffd5620a1b85df669ef` / `6a1b101c5620a1b85df669f1` 共享收口

## 范围

- 生产 open 反馈：
  - `6a1b0ffd5620a1b85df669ef`：`特殊能力为什么用不了？`
  - `6a1b101c5620a1b85df669f1`：`所有的特殊能力，计分时候为啥开不了`
- 游戏：`smashup`
- 结论口径：
  - 这不是单卡问题。
  - 根因落在 `scoreBases -> ACTIVATE_SPECIAL` 的共享合同消费链，必须按 validator + reaction + AI 三层一起修。

## 生产真源

2026-06-01 复核生产库：

```powershell
Get-Content -Raw temp/query-nightly-feedback-20260512.js | ssh admin@8.148.71.102 "docker exec -i boardgame-mongodb mongosh boardgame --quiet"
```

结果：

- `count: 2`
- 当前 `open/in_progress` 用户反馈只剩上面两条，且都指向 SmashUp 计分窗口 special

说明：

- 本文档只证明“当前 open 列表 + 本地修复与验证”。
- 未经授权，未回写 Mongo 状态。

## 根因

### 直接根因

旧实现把 “计分阶段手动 special 当前到底允许哪个基地” 拆成了多套近似语义：

1. `commands.validate(ACTIVATE_SPECIAL)` 一套
2. `reactionSession.buildReactionOptions()` 一套
3. `ai.hasPendingScoreBasesSpecialActivation()` / `buildSpecialActions()` 一套

其中 `afterScoring` 的真实合同应是：

- **只允许当前正在结算的基地**
- **不要求它此刻仍在 `getScoringEligibleBaseIndices()` 里**

但旧的 reaction / AI 仍直接读 `eligibleBaseIndices`，所以会出现两类假绿：

1. 命令层已经合法，live reaction 里却没有 `activate_special`
2. validator 已放行，但 AI / auto-advance 仍把它判断成“没有动作可做”，提前给 `advance-phase`

### 审计为什么没查出来

之前审计只打到了 validator 层，没有把这条共享合同的全部消费者当成同一条 L4 链路去核：

- 没有证明 `buildReactionOptions()` 和 validator 读的是同一份真相
- 没有证明 AI `canAdvancePhase()` / `buildSpecialActions()` 与 validator 同步
- 因此属于通用漏审，不是单条反馈偶发

本轮把这个问题固化为通用维度 `D55 共享合同多消费者一致性`。

## 修复

### 代码

- [src/games/smashup/domain/commands.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/domain/commands.ts)
  - 新增 `getManualSpecialScoringBaseIndices(state)`
  - `scoreBases` 下统一返回：
    - `afterScoring`：`[currentScoringBase]`
    - 其他计分窗口：`getScoringEligibleBaseIndices(state.core)`
- [src/games/smashup/domain/reactionSession.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/domain/reactionSession.ts)
  - `buildPlayableCardOptions()` 改为复用 `getManualSpecialScoringBaseIndices(state)`
- [src/games/smashup/ai.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/ai.ts)
  - `hasPendingScoreBasesSpecialActivation()` 改为复用同一 helper
  - `buildSpecialActions()` 的 `scoringBase` 标记改为复用同一 helper

### 审计规范

- [.spec/knowledge/standards/testing-audit.md](/D:/gongzuo/webgame/BoardGame/.spec/knowledge/standards/testing-audit.md)
  - 新增 `D55 共享合同多消费者一致性`

## 回归

### 新增/命中的关键回归

- [src/games/smashup/__tests__/commandsValidation.test.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/commandsValidation.test.ts)
  - `afterScoring 响应窗口仍应放行当前结算基地上的计分后 special，即使该基地已不在达标列表`
  - `afterScoring 响应窗口中的计分后 special 不能改指向其他基地`
- [src/games/smashup/__tests__/scoreBases-auto-continue.test.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/scoreBases-auto-continue.test.ts)
  - `afterScoring 当前结算基地即使已不在 eligible 列表，live reaction 仍应暴露其 special`
  - `afterScoring live session 丢失镜像 responseWindow 后，AI 仍不应误暴露 advance-phase`
- [src/games/smashup/__tests__/afterscoring-response-window-execution.test.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/afterscoring-response-window-execution.test.ts)
  - `afterScoring 响应窗口中的重返深海不能指向其他达标基地`

### 验证命令

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/scoreBases-auto-continue.test.ts src/games/smashup/__tests__/commandsValidation.test.ts src/games/smashup/__tests__/afterscoring-response-window-execution.test.ts --configLoader native
npm run typecheck
```

结果：

- 命令通过
- `typecheck` 通过

补充：

- `npx eslint src/games/smashup/ai.ts src/games/smashup/domain/commands.ts src/games/smashup/domain/reactionSession.ts src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`
  - 无 error
  - 仅保留这些文件中既有 `no-explicit-any` warning

## 2026-06-02 线上部署与实况复核

### 推送与镜像

- 已推送 `main`
  - SmashUp 共享修复提交：`c5f583b0`
  - 后续为清 `pre-push i18n` blocker 的最小提交：`4095a7b4`
- GitHub Actions
  - workflow：`Build & Push Docker Images`
  - run：`399`
  - `head_sha`：`4095a7b4c8b90239e8b9bbb292d09bb3f3a72d16`
  - 结论：`success`

### 生产部署

执行：

```powershell
ssh admin@8.148.71.102 "cd /home/admin/BoardGame && bash scripts/deploy/deploy-image.sh update"
```

部署后复核：

```powershell
ssh admin@8.148.71.102 'docker inspect boardgame-web --format ''{{ index .Config.Labels "org.opencontainers.image.revision" }}''; docker inspect boardgame-game-server --format ''{{ index .Config.Labels "org.opencontainers.image.revision" }}''; curl -sS http://127.0.0.1/health; printf ''\n''; curl -I -sS http://127.0.0.1/ | head -n 1'
```

结果：

- `boardgame-web` revision：`4095a7b4c8b90239e8b9bbb292d09bb3f3a72d16`
- `boardgame-game-server` revision：`4095a7b4c8b90239e8b9bbb292d09bb3f3a72d16`
- `GET /health`：`{"status":"ok", ...}`
- 首页探活：`HTTP/1.1 200 OK`

说明：

- 生产当前 revision 已覆盖本次 SmashUp 修复提交 `c5f583b0`。
- 当前证据可以证明“代码已 push + 镜像已构建 + 生产已部署到包含该修复的 revision”，不再停留在“仅本地已修”。

### 生产反馈池复核（回写前）

再次执行：

```powershell
Get-Content -Raw temp/query-nightly-feedback-20260512.js | ssh admin@8.148.71.102 "docker exec -i boardgame-mongodb mongosh boardgame --quiet"
```

结果：

- `count: 2`
- 当前 `open/in_progress` 仍只剩：
  - `6a1b101c5620a1b85df669f1`：`所有的特殊能力，计分时候为啥开不了`
  - `6a1b0ffd5620a1b85df669ef`：`特殊能力为什么用不了？`

说明：

- 这两条反馈当前仍是 **状态未回写**，不是“线上还跑在旧代码”。
- 本文档到这里的真实结论是：
  - **共享代码缺口已修**
  - **修复已 push**
  - **生产已部署到包含修复的 revision**
  - **反馈状态仍未回写**

### 正式状态回写与最终复核

正式回写路径：

- 使用文档中的正式接口：`PATCH /admin/feedback/:id/status`
- 不走 Mongo 直写
- 生产环境通过现有 `admin` 用户与容器内 `JWT_SECRET` 签发 Bearer token 后调用接口

回写目标：

- `6a1b101c5620a1b85df669f1`
- `6a1b0ffd5620a1b85df669ef`

回写结果：

- 正式接口返回 `200`
- 返回体中的反馈 `status` 已更新为 `resolved`

最终再次执行：

```powershell
Get-Content -Raw temp/query-nightly-feedback-20260512.js | ssh admin@8.148.71.102 "docker exec -i boardgame-mongodb mongosh boardgame --quiet"
```

结果：

- `count: 0`
- `docs: []`

说明：

- 当前生产库中，用户反馈视角的 `open/in_progress` 已清零
- 这两条 SmashUp 反馈已经通过正式 admin API 完成状态回写

## 结论

- 当前生产 open 的 2 条 SmashUp 反馈，已经在本地按共享根因修到同一条底层合同：
  - validator 合法性
  - live reaction 候选暴露
  - AI / auto-advance 阶段门禁
- 本轮可以声明：
  - **这 2 条反馈的共享代码缺口，本地已修**
  - **“为什么审计没查出来”这一点，已补成通用审计维度 D55**
  - **修复已 push、已部署、已通过正式接口回写状态**
  - **当前生产用户反馈池 `open/in_progress` 为 0**

## 当前边界

- 本文档**仍不能**声明：
  - SmashUp 所有 afterScoring / scoreBases shared contract 已经全面审完
- 当前仍需单独声明的事实：
  - 这里只证明了当前 open 反馈指向的 `scoreBases -> ACTIVATE_SPECIAL` 共享合同
  - 其他 `responseWindow / reactionSession / AI gate` 兄弟链路，仍应继续按 D55 口径扩审，而不能借本条反馈外推“100 游戏全部收口”
