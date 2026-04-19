# 反馈收口：69d0d5bfccdbf2785a55af79

## 范围

- 反馈 ID：`69d0d5bfccdbf2785a55af79`
- 游戏：`summonerwars`
- 路由：`/play/summonerwars/match/fqbcmOEq2zR?playerID=0`
- 用户反馈：`召唤师战争开房间自动进ai`
- 本文档仅覆盖这 1 条线上真实反馈的分诊、根因核对、验证结果与状态回写。

## 计划上下文

- 根目录 `task_plan.md` 当前仍服务其他任务，不混写本轮反馈收口。
- 本轮按 `feedback-closeout` skill 独立留档到 `evidence/` 与 `temp/`。

## 诊断结论

- 这条反馈不是“用户误看到了 AI 正常出牌”，而是线上房间在未显式配置在线 AI 座位时，被错误套用了本地默认 AI。
- 反馈原始 `stateSnapshot` 已直接给出异常现象：
  - `playerId=1` 已自动选中 `paladin`
  - `readyPlayers.1 = true`
  - 房主 `playerId=0` 仍在手动选阵营，`hostStarted = false`
- 这说明房主在线开的人类房间里，2 号位被错误接管并自动执行了 AI 选角/准备链。

## 根因

- 旧实现中，`src/pages/onlineAiSeats.ts` 会把在线房间的 `matchInfo.setupData` 送进 `normalizeLocalMatchPreferences(...)`。
- 对于双人游戏，只要 `setupData.seatControllers` 为空，这个本地偏好归一化流程就会给 `seat1` 套上默认 `local-ai`。
- `src/pages/MatchRoom.tsx` 随后会在房主进入房间时补领 AI 座位凭据，于是本来的人类在线房间被错误转成“房主 + AI”。
- 对应修复已经在提交 `148bcdcf` 中落地：
  - `src/pages/onlineAiSeats.ts`
    - 不再走 `normalizeLocalMatchPreferences(...)`
    - 只信任 `setupData.seatControllers` 中显式存在的在线 AI 定义
    - 未配置时一律回落为 `human`
  - `src/pages/__tests__/matchSeatValidation.test.ts`
    - 新增 `未显式配置在线 AI 座位时，不得套用本地默认 AI`

## 验证

执行命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native
node scripts/infra/vitest-cli-safe.mjs run src/components/lobby/__tests__/CreateRoomModal.test.tsx --configLoader native
```

结果：

- `src/pages/__tests__/matchSeatValidation.test.ts`
  - `33 passed`
  - 其中包含直接锁定本次根因的用例：`未显式配置在线 AI 座位时，不得套用本地默认 AI`
- `src/components/lobby/__tests__/CreateRoomModal.test.tsx`
  - `5 passed`
  - 继续证明“创建房间 AI 默认关闭”，不是当前入口默认把 AI 打开

关键人工判定：

- 这条反馈对应的真实根因已经被当前仓库代码修复，不需要再补新的业务代码。
- 当前验证同时覆盖了：
  - 在线房间 AI 座位识别链
  - 创建房间默认 AI 开关语义
- 足以支撑把该反馈改为 `resolved`。

## 状态回写

- 真实回写目标：
  - `ssh admin@8.148.71.102`
  - `docker exec -i boardgame-mongodb mongosh boardgame --quiet`
  - 直接更新生产 `feedbacks` 集合
- 实际回写结果：
  - `before.status = in_progress`
  - `after.status = resolved`
  - `updatedAt = 2026-04-04T23:28:08.581Z`
- 回写后复查：
  - 当前线上 `open/in_progress` 总数：`0`

## 未覆盖风险

- 本轮没有补浏览器级在线 E2E；判定依据主要是反馈原始状态快照、已提交修复代码与现有回归测试。
- 如果后续再出现“在线开房后自动进入 AI”，应优先检查：
  - `setupData.seatControllers` 是否被入口错误写入
  - `loadOnlineAiSeatState(...)` 是否又回退到本地偏好默认逻辑
