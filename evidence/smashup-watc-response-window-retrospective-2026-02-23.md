# SmashUp WATC / Me First 调试复盘（2026-02-23）

## 1. 现象

本轮排查中，出现了两个高频感知问题：

1. 打出 `giant_ant_we_are_the_champions`（我们乃最强）后，未立即出现选择交互。
2. 误以为“响应窗口未关闭导致计分不开始”，从而将多个现象归因到同一个点。

## 2. 关键结论

### 2.1 规则/实现顺序（必须先统一认知）

SmashUp 在 `scoreBases` 阶段的真实顺序是：

1. 进入 `scoreBases`。
2. 打开 Me First 响应窗口（可打 special）。
3. 全员 pass 后关闭响应窗口。
4. 执行基地计分。
5. 触发 `afterScoring`（WATC / vampire_buffet 在这里生效）。

结论：**WATC 打出当下只会 ARMED，不会立即弹出其“计分后”交互。**

### 2.2 本次链路验证点（有效）

- `PLAY_ACTION` 已正确命中 special executor。
- executor 已正确产出 `su:special_after_scoring_armed`。
- reduce 已正确接收 ARMED 事件并写入 `pendingAfterScoringSpecials`。

因此“打出后无提示”在多数场景下并非 executor 失效，而是对“计分后触发”的时机预期错误。

## 3. 调试方法经验

### 3.1 先建“事件闭环”，再看 UI

优先按以下闭环确认：

1. Command 是否执行（execute）。
2. Event 是否产生（events）。
3. Event 是否被 reduce（state 变更）。
4. Trigger 是否触发（afterScoring/onXxx）。
5. Interaction 是否入队（queue）。
6. PlayerView 是否可见（过滤条件）。

不要先从“界面没弹窗”直接推断“后端没执行”。

### 3.2 日志命名要分层

本次实践中有效的分层：

- `DIAG_PLAY`: 命令层（executor 命中与输出）
- `DIAG_REDUCE`: 归约层（事件是否落状态）
- `DIAG_RW_*`: 响应窗口轮转层
- `DIAG_SCORE`: 计分触发层
- `DIAG_WATC` / `DIAG_BUFFET`: 具体能力层

分层后，能快速定位“断链点”在命令、归约、触发还是 UI。

### 3.3 调试日志是临时资产

- 允许为定位问题短期加密集日志。
- 问题确认后必须一次性清理，避免污染长期控制台与性能。

## 4. 已执行的清理

已移除本次临时 `DIAG_*` 调试输出，避免残留：

- `src/games/smashup/domain/reducer.ts`
- `src/games/smashup/domain/reduce.ts`
- `src/games/smashup/domain/index.ts`
- `src/games/smashup/abilities/vampires.ts`
- `src/games/smashup/abilities/giant_ants.ts`
- `src/engine/systems/ResponseWindowSystem.ts`
- `src/engine/pipeline.ts`

## 5. 后续建议（针对类似“计分后 special”）

1. 新增/修改 `special_after_scoring` 牌时，必须配套一个“ARMED -> afterScoring -> CONSUMED”链路测试。
2. 对“打出即生效”与“计分后生效”在描述文本和实现注释中显式标注，减少认知偏差。
3. 复现时先清控制台并保证热更新状态干净，避免旧日志干扰判断。
