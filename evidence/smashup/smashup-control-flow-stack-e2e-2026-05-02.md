# SmashUp 控制流栈化 E2E 证据（2026-05-02）

## 范围
- `e2e/smashup/smashup-afterscoring-simple-complete.e2e.ts`
- `e2e/smashup/smashup-complex-multi-base-scoring.e2e.ts`
- `e2e/smashup/smashup-multi-base-scoring-complete.e2e.ts`

目标：
- 验证 `afterScoring` 已从旧 mirror / modal 假设切到 resolution frame 主链；
- 验证复杂多基地链路在 `smashup_reaction_choose -> 具体触发` 新口径下仍能收口；
- 验证“第二次排序后最后一个基地自动结算一次”的 frame 驱动语义；
- 清理根目录重复旧 E2E，仅保留 `e2e/smashup/` 里的 canonical 文件。

## 实际执行
```powershell
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_WORKERS='1'
$env:PW_HAS_EXPLICIT_TARGET='true'
node ..\..\node_modules\playwright\cli.js test `
  e2e/smashup/smashup-complex-multi-base-scoring.e2e.ts `
  e2e/smashup/smashup-afterscoring-simple-complete.e2e.ts `
  e2e/smashup/smashup-multi-base-scoring-complete.e2e.ts
```

结果：`4 passed`

## 关键截图与肉眼结论

### 1. afterScoring 简单场景已进入统一反应入口
截图：
- `D:\gongzuo\webgame\BoardGame\.worktrees\game-control-flow-core\test-results\evidence-screenshots\smashup\smashup-afterscoring-simple-complete.e2e\点击-FINISH-后应进入-afterScoring-响应窗口\smashup-afterscoring-simple-complete.png`

观察：
- 截图中央能直接看到“选择一个反应动作”弹层，按钮是“我们乃最强 -> 基地 1 / 让过”，说明这条链路现在允许直接落到 `smashup_reaction_choose`，不再强依赖旧 `me-first-overlay`。
- 左上角阶段仍显示“回合 1 / 你自己 / 基地方案”，右上角记分板为 `你 2 / P1 0`，与当前基地已进入计分后窗口一致。
- 该图满足本轮验收标准：真实 UI 已出现 afterScoring 响应入口，且用户可见对象就是反应按钮本体，不是仅有遮罩或容器。

### 2. 复杂 afterScoring 链路中，反应入口打开且 PASS 后能收口
截图：
- `D:\gongzuo\webgame\BoardGame\.worktrees\game-control-flow-core\test-results\evidence-screenshots\smashup\smashup-complex-multi-base-scoring.e2e\基地计分后-afterScoring-响应窗口正常打开\04-after-scoring-open.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\game-control-flow-core\test-results\evidence-screenshots\smashup\smashup-complex-multi-base-scoring.e2e\基地计分后-afterScoring-响应窗口正常打开\05-p0-passed-after-scoring.png`

观察：
- `04-after-scoring-open.png` 中间直接出现“选择一个反应动作”，可见“我们乃最强 -> 基地 1 / 让过”两个按钮；这证明复杂链路也能落到统一反应入口，而不是旧 overlay 专属分支。
- 同图左侧基地仍显示 `13/12`，说明是在真实计分后窗口中观察到的，不是链路外的假场景。
- `05-p0-passed-after-scoring.png` 中左上角已回到“出牌阶段”，右上角比分为 `P0 2 / 你 0`，中央反应弹层已消失，说明 PASS 后窗口确实收口并恢复主流程。
- 这两张图构成了“打开 -> PASS -> 收口”成功路径证据链，达到本轮验收标准。

### 3. 多基地排序第二次选择后，最后一个基地只自动结算一次
截图：
- `D:\gongzuo\webgame\BoardGame\.worktrees\game-control-flow-core\test-results\evidence-screenshots\smashup\smashup-multi-base-scoring-complete.e2e\第二次排序选择后，最后一个基地应自动结算且只结算一次\multi-base-auto-finish-final.png`

观察：
- 三个基地都已替换成新基地，画面中不再出现 `base_the_jungle / base_dread_lookout / base_tsars_palace` 的旧基地本体，说明旧锁定基地已全部完成结算与替换。
- 右上角比分清楚显示 `P0 9 / 你 7`，与单测中的权威结果一致，证明最后一个基地没有丢结算，也没有重复加分。
- 当前没有任何交互弹层残留，左上角已经回到“出牌阶段”，说明 resolution frame 链在第二次排序后完成了最后一个基地的自动收口。

## 结论
- SmashUp 的 `afterScoring` / 多基地计分 E2E 已切到新的 frame 主链口径并通过。
- 根目录重复旧测试：
  - `e2e/smashup-afterscoring-simple-complete.e2e.ts`
  - `e2e/smashup-multi-base-scoring-complete.e2e.ts`
  已删除，避免继续保留与 `e2e/smashup/` canonical 文件不一致的遗留副本。

## 残余风险
- 4 人复杂链路运行时浏览器控制台仍有 1 条 `Received NaN for the '%s' attribute` 噪声日志；本轮未造成断言失败，也未在截图中形成可见 UI 异常，但后续可单独清理该控制台噪声。
