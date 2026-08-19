# Summoner Wars 本地反馈：AI 断线后没有恢复连接

- 时间：2026-08-19 20:30:00 +08:00
- 口径：本地数据库反馈，不回写线上。
- 反馈内容：`ai断线了没有恢复连接`
- 本地反馈记录：`6a859abd0bdd9b46777fe4b1`
- 入口：`/play/summonerwars/match/SlGHS6Alnof?playerID=0`
- 诊断包：`temp/feedback-closeout/2026-08-19-local-ai-reconnect/6a859abd0bdd9b46777fe4b1.json`

## 原始症状与命中证据

- 原始症状保持为：AI 断线后没有恢复连接。
- 反馈快照里 `core.seatControllers` 显示 0 号位是真人、1 号位是 `local-ai`。
- 反馈快照里没有活动交互或响应窗口：`sys.interaction.isBlocked=false`，队列为空，`sys.responseWindow.current` 为空。因此这次不是 hidden interaction、response-window 或 legal action 卡死。

## 根因层级

- 现实故障现象：房主刷新或重进在线 AI 房后，AI 对手没有恢复为可自动执行的 AI 座位，页面表现为 AI 没恢复连接。
- 直接触发条件：页面恢复在线 AI 座位状态时，`useOnlineAiSeatStateLoader` 调用 `loadOnlineAiSeatState` 固定传空 `storedAiSeatCredentials`，也没有启用缺失凭据补领。
- 根本机制：底层 `loadOnlineAiSeatState` 已经支持“读取已有 AI 座位凭据”和“缺失时补领”，但页面 hook 没把 `match_ai_creds_<matchId>` 读出来，也没通过房主身份调用 `claim-seat` 补回 AI 座位凭据；因此断线/刷新后 AI 座位定义可见，但执行用的座位凭据无法恢复。

## 修复

- `src/pages/useOnlineAiSeatStateLoader.ts` 现在会读取 `match_ai_creds_<matchId>` 并返回 `onlineAiSeatCredentials`。
- 房主以 0 号座位身份重进时，缺失的 AI 座位凭据会通过 `matchApi.claimSeat` 补领；guest 房间优先使用房间 owner 的 `guestId`，避免拿当前账号 token 去补领 guest 房 AI 座位。
- 补领结果只写入 `match_ai_creds_<matchId>`，不覆盖真人主座位凭据 `match_creds_<matchId>`。
- 非房主视角只恢复 AI 座位定义，不主动补领 AI 座位凭据。

## AI-only / Human Guard

- AI-only 门禁：只有 `matchStatusIsHost === true` 且 `statusPlayerID === '0'` 时才会补领缺失 AI 座位凭据。
- 真人保护：补领只保存到 AI 座位凭据存储，不调用会覆盖真人主座位凭据的旧 `claimSeat` helper。
- 这次没有新增 AI 命令、自动 pass、强制结束或响应窗口兜底，因此不改变真人交互权限。

## 可见动作清单

- 可见动作：刷新/重连后 AI 对手应继续被识别为 AI 座位，房主能看到 AI 自动执行/强制结束 AI 阶段能力。
- 静默动作：读取本地 AI 凭据、向服务端补领缺失 AI 座位凭据、保存 `match_ai_creds_<matchId>`。
- 本次不修改 AI 动作延迟，也不改变任一游戏规则动作。

## 验证

- `npx eslint src/pages/useOnlineAiSeatStateLoader.ts src/pages/__tests__/useOnlineAiSeatStateLoader.test.tsx`：通过。
- `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/useOnlineAiSeatStateLoader.test.tsx --configLoader native`：1 个测试文件、3 个测试通过。
- `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/useOnlineAiSeatStateLoader.test.tsx src/pages/__tests__/matchSeatValidation.test.ts --configLoader native -t "onlineAiSeats|useOnlineAiSeatStateLoader"`：2 个测试文件通过，21 个相关测试通过。
- `npm run typecheck`：通过。

## 非本次阻塞记录

- 未加过滤运行 `src/pages/__tests__/matchSeatValidation.test.ts` 时，有一条 DiceThrone 奖励骰测试失败：`奖励骰缺少掷骰者角色：playerId=1`。
- 这条失败来自 DiceThrone 奖励骰测试数据缺角色，不在 Summoner Wars 本地 AI 座位重连链路；本次收口使用上述聚焦测试覆盖 AI 座位恢复行为。
