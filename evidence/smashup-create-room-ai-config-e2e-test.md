# Smash Up 创建房间 AI 配置 E2E 证据

## 测试命令

```bash
npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "Smash Up 创建房间弹窗可直接配置 AI 人数和模组，并为游客保存偏好"
```

结果：通过

## 截图 1：创建房间弹窗内直接配置 AI

![Smash Up 创建房间 AI 配置弹窗](../test-results/evidence-screenshots/lobby.e2e/Smash-Up-%E5%88%9B%E5%BB%BA%E6%88%BF%E9%97%B4%E5%BC%B9%E7%AA%97%E5%8F%AF%E7%9B%B4%E6%8E%A5%E9%85%8D%E7%BD%AE-AI-%E4%BA%BA%E6%95%B0%E5%92%8C%E6%A8%A1%E7%BB%84%EF%BC%8C%E5%B9%B6%E4%B8%BA%E6%B8%B8%E5%AE%A2%E4%BF%9D%E5%AD%98%E5%81%8F%E5%A5%BD/lobby-smashup-create-room-ai-config-modal.png)

观察结论：

- 弹窗标题是 `Create Room`，AI 配置已经并入创建房间主弹窗，不再需要额外的本地 AI 子弹窗。
- `Add AI` 开关显示为 `Enabled`，说明 AI 不是默认常驻，而是通过创建房间里的显式选项开启。
- `AI Support` 区块和 `Seat 0`、`Seat 1`、`Seat 2` 卡片同时可见，说明“选中加入 AI 后展开系列设置”的交互已经生效。
- `Seat 0` 和 `Seat 2` 当前是 `Human`，`Seat 1` 当前是 `Local AI`，而且策略输入框已经跟着显示出来，座位配置链路是活的。
- 底部 `Cancel` / `Confirm` 按钮和 AI 配置区同时留在同一视口内，说明修复后弹窗不会再因为内容过高把确认按钮挤出屏幕。
- `Expansion Rules` 当前显示为 `Disabled`，说明关闭泰坦模组的选择已经在创建房间弹窗里生效。

## 截图 2：创建房间后进入联机房间

![Smash Up 创建房间 AI 配置结果](../test-results/evidence-screenshots/lobby.e2e/Smash-Up-%E5%88%9B%E5%BB%BA%E6%88%BF%E9%97%B4%E5%BC%B9%E7%AA%97%E5%8F%AF%E7%9B%B4%E6%8E%A5%E9%85%8D%E7%BD%AE-AI-%E4%BA%BA%E6%95%B0%E5%92%8C%E6%A8%A1%E7%BB%84%EF%BC%8C%E5%B9%B6%E4%B8%BA%E6%B8%B8%E5%AE%A2%E4%BF%9D%E5%AD%98%E5%81%8F%E5%A5%BD/lobby-smashup-create-room-ai-config-result.png)

观察结论：

- 页面已经进入 `DRAFT YOUR FACTIONS` 阶段，说明点击创建房间确认后，流程确实跳进了联机房间而不是只停留在大厅。
- 中央顶部有 `IT'S YOUR TURN NOW` 提示，选阵流程正常推进，没有卡在房间初始化或 AI 座位托管阶段。
- 画面中可见多列派系牌位，不是创建房间失败后回退到大厅或白屏的状态。
- 牌面和提示层都正常渲染，没有因为房间 AI 配置和模组设置混入 `setupData` 导致初始化错位。

## 自动断言摘要

- URL 命中 `/play/smashup/match/:matchId`，说明配置完成后进入的是联机房间。
- 通过 `/games/smashup/:matchId` 读取到 `setupData.setupSelections.expansions = []`。
- 通过 `/games/smashup/:matchId` 读取到 `setupData.seatControllers` 共 3 个座位配置。
- 游客 `localStorage` 中 `local_ai_match_preferences:smashup` 已保存 `numPlayers: 3` 和 `setupSelections.expansions: []`。
- 游客 `localStorage` 中 `match_ai_creds_<matchId>` 已写入 AI 座位凭证，且包含 `seat 1`。
