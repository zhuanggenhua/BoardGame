# 自动反馈与绳缚卡死跟进收口（2026-06-10）

## 范围

- 生产真源：
  - `ssh admin@8.148.71.102`
  - `docker exec -i boardgame-mongodb mongosh --quiet boardgame`
- 本轮只处理证据已经锁定、但线上状态仍未同步的这一小批：
  - 人类反馈 `6a26a66b52a24b6de8402763`
  - 同根 DiceThrone watchdog 3 条
  - HomeEntry 首页崩溃自动反馈 2 条
  - SummonerWars `t is not defined` 自动反馈 3 条

## 回写前生产真相

- `reporterType=user AND status in [open, in_progress]`：`1`
- `reporterType=system AND status in [open, in_progress]`：`232`
- 本轮命中的系统反馈分三簇：
  - DiceThrone `online-ai-watchdog / blocker_persisted`：3 条
  - client `react-error-boundary / HomeEntry`：2 条
  - SummonerWars `board-render-error / t is not defined`：3 条

## 1. DiceThrone 绳缚 + 0CP 卡死

### 反馈

- 人类反馈：`6a26a66b52a24b6de8402763`
  - 原文：`有绳缚对手没有cp时卡死`
- 系统反馈：
  - `6a26c1c952a24b6de84029f4`
  - `6a26a75b52a24b6de8402778`
  - `6a26a4a952a24b6de840274f`
  - 原文统一为：`[system][online-ai-watchdog] force-end-turn-failed active-turn-legal-only:follow-up-advance:blocker_persisted`

### 根因

- 不是领域层仍允许继续重投。
- 真正问题是本地 AI 在 `offensiveRoll + bind>0 + rollCount>0 + cp<1` 时，仍把锁骰微操作当成高分动作，导致一直刷 `toggle-die-lock`，不走收口。

### 修复与验证

- 证据沿用：
  - `evidence/dicethrone/dicethrone-zhanshujia-bind-zero-cp-ai-loop-fix-2026-06-10.md`
- 本轮复核命令：
  - `pnpm vitest run src/engine/ai/__tests__/localRunner.attemptKey.test.ts src/games/dicethrone/__tests__/basic-commands-coverage.test.ts -t "本地 AI 在紧缚且 0CP 无法继续重投时，不应继续锁骰循环" --configLoader native`
- 结果：
  - `1 passed`
  - `localRunner` 相关文件已加载，目标用例保持通过

### 收口结论

- 这 1 条人类反馈和 3 条 watchdog 属于同一根因。
- 当前树已有：
  - 根因定位
  - 代码修复
  - 定向回归
- 因此应统一按 `resolved` 收口；不再因为“尚未部署”继续挂在 `open/in_progress`。

## 2. 首页 HomeEntry 崩溃自动反馈

### 反馈

- `6a259188ab42857a582671b2`
  - `[auto][react.error_boundary] Cannot read properties of undefined (reading 'HomeEntry')`
- `6a2406c3db108bca6c5fa5a2`
  - `[auto][react.error_boundary] Minified React error #185 ...`

### 根因与证据

- 证据沿用：
  - `evidence/feedback-closeout/feedback-closeout-2026-06-10-client-dicethrone-summonerwars-smashup.md`
- 当前树已：
  - 把首页入口改回同步 `HomeEntry`
  - 补 `default export`
  - 用 `App.localRoute` / `App.entrySource` 守卫回归

### 收口结论

- 这 2 条是同一条首页装配链崩溃的自动反馈残留。
- 当前树缺口已不存在，应按 `resolved` 回写。

## 3. SummonerWars `t is not defined`

### 反馈

- `6a28ee210729eb97ecd47231`
- `6a26ba9e52a24b6de8402980`
- `6a26a6fe52a24b6de8402772`
- 原文统一为：`[auto][board-render-error] t is not defined`

### 根因与证据

- 证据沿用：
  - `evidence/feedback-closeout/feedback-closeout-2026-06-10-client-dicethrone-summonerwars-smashup.md`
- 当前仓库 `src/games/summonerwars/ui/BoardGrid.tsx` 已显式声明：
  - `const { t, i18n } = useTranslation('game-summonerwars');`

### 收口结论

- 这 3 条不是当前树仍在的活缺口，更像旧包/旧页面缓存命中。
- 当前应统一按 `resolved` 收口。

## 本轮回写目标

### `resolved`

- `6a26a66b52a24b6de8402763`
- `6a26c1c952a24b6de84029f4`
- `6a26a75b52a24b6de8402778`
- `6a26a4a952a24b6de840274f`
- `6a259188ab42857a582671b2`
- `6a2406c3db108bca6c5fa5a2`
- `6a28ee210729eb97ecd47231`
- `6a26ba9e52a24b6de8402980`
- `6a26a6fe52a24b6de8402772`

## 备注

- 本轮没有碰 `smashup / player-command-failure = 222` 这一大簇；它仍需单独分诊，不和这批“证据已锁定”的收口项混写。
- `client-unhandled-rejection / Maximum call stack size exceeded` 当前还未纳入本轮回写目标；它与本批的 `react-error-boundary` 不是同一条证据链。

## 实际生产回写结果（2026-06-10 22:19 +08:00）

- 回写入口：
  - `ssh admin@8.148.71.102`
  - `docker exec -i boardgame-mongodb mongosh --quiet boardgame`
- 回写方式：
  - 同一 `mongosh` 会话内逐条执行 `findOne -> updateOne -> findOne`
  - 正式只写：
    - `status = resolved`
    - `updatedAt = new Date()`

### 逐条结果

- `6a26a66b52a24b6de8402763`
  - `matchedCount = 1`
  - `modifiedCount = 1`
  - 回写后：`status = resolved`
  - 回写后时间：`2026-06-10T14:19:02.871Z`
- `6a26c1c952a24b6de84029f4`
  - `matchedCount = 1`
  - `modifiedCount = 1`
  - 回写后：`status = resolved`
  - 回写后时间：`2026-06-10T14:19:02.911Z`
- `6a26a75b52a24b6de8402778`
  - `matchedCount = 1`
  - `modifiedCount = 1`
  - 回写后：`status = resolved`
  - 回写后时间：`2026-06-10T14:19:02.968Z`
- `6a26a4a952a24b6de840274f`
  - `matchedCount = 1`
  - `modifiedCount = 1`
  - 回写后：`status = resolved`
  - 回写后时间：`2026-06-10T14:19:02.977Z`
- `6a28ee210729eb97ecd47231`
  - `matchedCount = 1`
  - `modifiedCount = 1`
  - 回写后：`status = resolved`
  - 回写后时间：`2026-06-10T14:19:02.985Z`
- `6a26ba9e52a24b6de8402980`
  - `matchedCount = 1`
  - `modifiedCount = 1`
  - 回写后：`status = resolved`
  - 回写后时间：`2026-06-10T14:19:02.993Z`
- `6a26a6fe52a24b6de8402772`
  - `matchedCount = 1`
  - `modifiedCount = 1`
  - 回写后：`status = resolved`
  - 回写后时间：`2026-06-10T14:19:03.003Z`
- `6a259188ab42857a582671b2`
  - `matchedCount = 1`
  - `modifiedCount = 1`
  - 回写后：`status = resolved`
  - 回写后时间：`2026-06-10T14:19:03.010Z`
- `6a2406c3db108bca6c5fa5a2`
  - `matchedCount = 1`
  - `modifiedCount = 1`
  - 回写后：`status = resolved`
  - 回写后时间：`2026-06-10T14:19:03.017Z`

### 回写后余量

- `reporterType=user AND status in [open, in_progress]`：`0`
- `reporterType=system AND status in [open, in_progress]`：`224`
- 结论：
  - 人类反馈未收口已清零
  - 系统反馈还剩 `224`，且当时已经全部收敛到 `smashup`
