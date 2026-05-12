# 作废：非生产真源反馈复核记录（2026-05-12）

> 本文档作废，不得作为线上反馈收口证据使用。
>
> 复核后确认：本轮最初脚本因本地 `.env` 中 `MONGO_URI` 为注释，实际 fallback 到本机 `mongodb://127.0.0.1:27017/boardgame`，不是生产 Mongo。
> 生产真源为远端 `boardgame-mongodb` 容器内 `boardgame.feedbacks`。生产按 ID 反查 `69fb69d3b02fa297ce69aff7` / `69fb6912b02fa297ce69aff5` 均不存在，按 `伦格|格伦|托尔图加` 反查只找到历史 resolved 反馈 `69a595a4bd494244e5a2a00f`。
>
> 因此下方内容仅保留为误查记录，不能解释为线上反馈已修复、已关闭或已回写。

# 原误查记录：SmashUp 反馈 69fb69d3 / 69fb6912：托尔图加与伦格高原复核（2026-05-12）

## 范围

- `69fb69d3b02fa297ce69aff7`：`托尔图加效果无效，我选择了我的随从但没移动到新基地啊`
- `69fb6912b02fa297ce69aff5`：`明明额度显示格伦平原+2，选中随从后只有平原是灰色的`
- 两条均来自生产反馈表，`gameId=smashup`，`matchId=oRVPFOjtS3f`，`source=feedback-modal`，`status=open`。

## 现场结论

### 69fb69d3 托尔图加

生产反馈 action log 显示该局在托尔图加计分后出现：

- `基地结算：托尔图加`
- `清空托尔图加`
- `基地替换：托尔图加 -> 仪式场所`

反馈快照里没有后续 `移动随从` 日志，因此用户看到的是旧现场中托尔图加 afterScoring 移动未落地或未可见的状态。

当前代码的托尔图加链路已经有真实入口 E2E 覆盖，并且本轮复跑通过：选中随从后会移动到替换基地，交互收口后回到可继续推进的出牌阶段。

### 69fb6912 伦格高原

生产反馈同局中，用户描述的“格伦平原”实际对应 `base_plateau_of_leng`（伦格高原）。

当前规则实现与牌面一致：伦格高原授予的是“限定到该基地、且只能打出同名随从”的额外随从额度，不是任意随从额度。当前 UI 的额度 tooltip 已显示 `+N -> 伦格高原（仅同名：<随从名>）`，当玩家选中非同名随从时，伦格高原被置灰是正确限制，不应放开。

## 验证

### E2E

命令：

```powershell
$env:PW_PORT='6573'; $env:PW_GAME_SERVER_PORT='20310'; $env:PW_API_SERVER_PORT='21310'; $env:PW_WORKERS='1'; node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-complex-multi-base-scoring.e2e.ts --grep "托尔图加 afterScoring 选中随从后会移动到替换基地"
```

结果：`1 passed`

实际查看截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-complex-multi-base-scoring.e2e\托尔图加-afterScoring-选中随从后会移动到替换基地\tortuga-02-interaction-open.png`
  - 我实际看到：中央出现 `托尔图加：选择移动一个其他基地上的随从到替换基地`，棋盘上仍能看到可被移动的随从本体。
  - 是否达标：达到“真实进入托尔图加选随从交互”的验收点。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-complex-multi-base-scoring.e2e\托尔图加-afterScoring-选中随从后会移动到替换基地\tortuga-03-moved-to-replacement-base.png`
  - 我实际看到：左侧替换基地已变为 `绿洲丛林`，被选择的 `盘旋机器人` 已出现在该替换基地下方，右侧阶段回到 `出牌阶段`。
  - 是否达标：达到“选中后移动到替换基地并完成收口”的验收点。

### 领域测试

命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/expansionBaseAbilities.test.ts src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts --configLoader native --maxWorkers 1 -t "base_plateau_of_leng|base_plateau_of_leng 伦格高地"
```

结果：`2 files / 8 tests passed`

覆盖点：

- 伦格高原首次打出随从后授予 `restrictToBase` 的额外随从额度。
- 额度带 `sameNameOnly=true` 与 `sameNameDefId`，验证层按触发时的随从 defId 检查。
- 同名随从可继续打到伦格高原；非同名随从不能借该额度打出。

## 状态处理建议

- `69fb69d3b02fa297ce69aff7`：当前实现与 E2E 已证明问题链路修复，可回写为 `resolved`。
- `69fb6912b02fa297ce69aff5`：当前是规则限制与 UI 提示问题，不应放开为任意随从额度；建议回写为 `closed`，备注为“伦格高原额度为同名限定，当前 UI tooltip 已展示限定条件”。
