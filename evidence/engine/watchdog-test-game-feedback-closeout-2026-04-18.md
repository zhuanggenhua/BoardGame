# Test Game Watchdog 历史反馈收口（2026-04-18）

## 本轮目的
- 清理数据库里最后一批仍为 `open/in_progress` 的 `test-game` watchdog 测试夹具反馈
- 让反馈库状态与当前修复事实一致，避免“库里还有 open”继续误导排查结论

## 处理前状态
- 查询时间：`2026-04-18T00:00:38.412Z`
- 结果：数据库里剩余 `20` 条 `open`
- 范围：全部都是 `gameId = test-game` 的 `online-ai-watchdog` 历史测试夹具数据
- 其中分成两簇：
  1. `force-end-turn-failed response-loop:follow-up-advance:loop_detected`（12 条）
  2. `force-end-turn-success visible-interaction:follow-up-advance:steps=0`（8 条）

## 收口原则
- 这些记录不是生产用户反馈，而是测试夹具/历史 incident 残留
- 当前 transport/watchdog 修复、自动聚合逻辑与回归测试已覆盖这两类场景
- 因此不再保留为 `open`
- 每个根因簇保留 1 条 canonical 主记录改为 `resolved`
- 同簇其余历史重复记录统一改为 `closed`

## 实际回写结果

### 1) response-loop:follow-up-advance
- canonical：`69db21f6b1a781527e5e5a08`
- 聚合键：`system-feedback:online-ai-watchdog:test-game:force-end-turn:response-loop:follow-up-advance`
- occurrenceCount：`12`
- closed duplicates：
  - `69db211bb1a781527e5e5a06`
  - `69db1d80b1a781527e5e5a04`
  - `69db17d1b1a781527e5e5a02`
  - `69db15e1b1a781527e5e5a00`
  - `69db15afb1a781527e5e59fe`
  - `69db06d6b1a781527e5e59fc`
  - `69da344be2d4cd4ea38ad92d`
  - `69da2d4de2d4cd4ea38ad929`
  - `69da2d1ce2d4cd4ea38ad927`
  - `69da2bece2d4cd4ea38ad925`
  - `69da2bcce2d4cd4ea38ad923`

### 2) visible-interaction:follow-up-advance
- canonical：`69da083239eb5fc165c6f2dd`
- 聚合键：`system-feedback:online-ai-watchdog:test-game:force-end-turn:visible-interaction:follow-up-advance`
- occurrenceCount：`8`
- closed duplicates：
  - `69da05edc6c2b44ff75d0fd9`
  - `69da04cdb504808e82fab4fd`
  - `69da03c26f0c86ba3e84b612`
  - `69da02ec15187668a06f67e0`
  - `69da029a15187668a06f67de`
  - `69d9ef91740da99e442de226`
  - `69d9dcd566d5c4ebdd2e144c`

## 回写后核验
- 查询时间：`2026-04-18T00:15:17.290Z`
- 结果：数据库 `open / in_progress = 0`
- 说明：此时不仅生产口径为 0，数据库全量口径也为 0

## 备注
- 这轮没有继续改业务代码，只做历史反馈状态清理与聚合回写
- 代码层修复与主链收口证据见：
  - `evidence/engine/watchdog-open-feedback-closeout-2026-04-17.md`
  - `evidence/engine/watchdog-feedback-aggregation-backfill-2026-04-17.md`
