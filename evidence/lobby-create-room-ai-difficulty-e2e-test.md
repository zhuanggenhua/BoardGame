# 创建房间 AI 难度接入 E2E 证据

## 目标

验证大厅创建房间弹窗已经接入本地 AI 难度选择，并确认：

- AI 开关区块收敛为紧凑单行入口
- 仅在开启 AI 后显示难度切换
- 默认难度为“普通”
- 难度与 AI 占位都以单行 toggle 形式展示

## 执行命令

```bash
npm run test -- src/components/lobby/__tests__/CreateRoomModal.test.tsx
npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "大杀四方创建房间弹窗可直接配置 AI 人数和模组，并为游客保存偏好"
```

结果：

- Vitest 通过：`5 passed`
- Playwright 通过：`1 passed`

## 显式截图

### 1. 默认普通难度

截图路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\lobby.e2e\大杀四方创建房间弹窗可直接配置-AI-人数和模组，并为游客保存偏好\lobby-smashup-create-room-ai-config-default-normal.png`

读图结论：

- “加入 AI” 行已经压成单行，左侧只有标题，右侧是“已开启”状态胶囊，没有再出现额外说明文案块。
- AI 开启后，下面直接出现一排难度 toggle，`普通` 按钮为绿色激活态，`简单 / 困难 / 专家` 保持未激活态，说明默认值确实落在“普通”。
- 这一行难度按钮与上方开关之间距离较紧，没有展开成大段说明区，整体视觉比旧版更短更紧凑。

### 2. 切到困难并配置 3 号位

截图路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\lobby.e2e\大杀四方创建房间弹窗可直接配置-AI-人数和模组，并为游客保存偏好\lobby-smashup-create-room-ai-config-hard-and-seats.png`

读图结论：

- `困难` 按钮切换后变为绿色激活态，且整排难度按钮仍维持在同一行，没有被挤成多行说明布局。
- “AI 占位”一行里，`1 号位（房主）` 维持灰色禁用态，`2 号位` 为绿色激活态，`3 号位` 仍可见并与其他项同排展示，符合单行 toggle 诉求。
- 难度行和座位行都放在同一个紧凑区块里，底部确认按钮区没有被额外说明文本继续顶高，弹窗主视觉明显比旧版更短。

## 代码入口

- UI 实现：`src/components/lobby/CreateRoomModal.tsx`
- 单测：`src/components/lobby/__tests__/CreateRoomModal.test.tsx`
- E2E：`e2e/lobby.e2e.ts`

## 结论

当前创建房间弹窗已经把本地 AI 难度真正接到建房配置链路：

- 默认开启 AI 时会提交 `difficulty: normal`
- 切换难度后，会同步写入所有本地 AI 座位
- 大厅游客偏好与房间 `setupData.seatControllers` 都能保存对应难度
