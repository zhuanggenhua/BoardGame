# AI 手动选派系创建房间 E2E 证据

日期：2026-05-18

## 范围

- 大厅创建房间弹窗的 AI 配置区。
- “玩家选择 AI 派系”复选框默认未勾选、可勾选。
- 创建房间提交到服务端的 AI 座位配置包含 `manualFactionSelection: true`。
- 游客偏好仍按现有策略剥离 AI 座位，只保存人数和 setup 选择，避免下次默认带 AI。

## 执行命令

```bash
npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "大杀四方创建房间弹窗可直接配置 AI 人数和模组，并为游客保存偏好"
```

结果：通过，1 passed。

## 截图

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\lobby.e2e\大杀四方创建房间弹窗可直接配置-AI-人数和模组，并为游客保存偏好\lobby-smashup-create-room-ai-config-manual-faction.png`

肉眼观察：

- 创建房间弹窗处于真实大厅链路中，AI 配置区已展开，`加入 AI` 显示已开启。
- `玩家选择 AI 派系` 复选框本体可见，并且已出现绿色勾选态。
- 该行只保留短标签，没有额外解释性 hint，与周边按钮、座位切换、确认创建按钮无重叠。

## 断言覆盖

- 勾选前 `create-room-ai-manual-faction-checkbox` 为未勾选。
- 勾选后该 checkbox 为已勾选。
- 服务端房间 `setupData.seatControllers.1/2.manualFactionSelection` 均为 `true`。
- 本地游客偏好中的 seat1/seat2 仍为 `human`，不持久化 `manualFactionSelection`，符合当前 `stripAiSeatsFromPreferences` 策略。

## 未覆盖风险

- 本轮 E2E 覆盖创建房间与配置提交，不覆盖完整线上房间内由玩家实际点击 AI 派系牌的长链路；线上桥接行为由类型检查和 `matchSeatValidation.test.ts` 中的 select-faction attempt 释放单测覆盖。
