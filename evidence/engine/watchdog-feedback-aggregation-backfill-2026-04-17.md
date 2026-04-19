# Online AI Watchdog 历史聚合回写（2026-04-17）

## 目标
- 在“新自动反馈按 aggregationKey 聚合”已经落地后，继续清理历史数据库中的 watchdog 重复记录。
- 让后台列表更接近“问题簇”而不是“原始 incident 流”。

## 这轮实际做了什么
1. 保留每个非 `test-game` watchdog 根因簇的 1 条主记录（canonical）。
2. 给主记录补齐：
   - `aggregationKey`
   - `occurrenceCount`
   - `firstOccurredAt`
   - `lastOccurredAt`
   - `latestIncidentKey`
3. 将同簇的历史重复记录改为 `closed`，并在 `resolutionNotes` 中写明已并入的 canonical 记录。
4. 同步更新 `temp/feedback-closeout/status-board.json` 中已存在的对应条目状态与备注。

## 聚合结果
### 1. DiceThrone `force-end-turn-success active-turn:follow-up-advance`
- canonical：`69d9ff8d7bee880f344af23f`
- 合并次数：`4`
- 关闭重复：
  - `69d9ff737bee880f344af239`
  - `69d9ff7b7bee880f344af23b`
  - `69d9ff847bee880f344af23d`

### 2. DiceThrone `force-end-turn-success response-loop:recover-interaction`
- canonical：`69db2e348f5a99adb0e6849e`
- 合并次数：`9`
- 关闭重复：
  - `69da35388e4709c93b43ce27`
  - `69da35498e4709c93b43ce29`
  - `69da3651ba7f60a35b4b82a1`
  - `69da3662ba7f60a35b4b82a3`
  - `69da3789be46411345c0ca6d`
  - `69da379bbe46411345c0ca6f`
  - `69db190b169436988e4c3723`
  - `69db2db132e3244ed2533335`

### 3. Smash Up / Summoner Wars 单条记录
- `69d8391967274dd3f5abf5ac`（Smash Up）保留为 `resolved`，补齐聚合元数据，`occurrenceCount=1`
- `69da8401fde1c16ac1e7ebb8`（Summoner Wars）保留为 `resolved`，补齐聚合元数据，`occurrenceCount=1`

## 核验结果
- watchdog 总量：`35`
- 其中非 `test-game` open / in_progress：`0`
- 非 `test-game` 聚合后的状态分布：
  - `resolved`: `4`
  - `closed`: `11`
- 仍为 `open` 的 `20` 条全部属于 `test-game` 测试夹具数据，未按生产反馈口径处理。

## 说明
- 这轮是**历史数据回写**，不是再改 transport 逻辑。
- 当前代码层已经会让新写入的 `online-ai-watchdog` 自动反馈直接按 aggregationKey 聚合，不会继续刷出同根因多条新记录。
