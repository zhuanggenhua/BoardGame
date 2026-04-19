# 创建房间中文链路 E2E 证据

## 测试范围

- 用例：`Smash Up 创建房间弹窗可直接配置 AI 人数和模组，并为游客保存偏好`
- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/_shared/lobby.e2e.ts "Smash Up 创建房间弹窗可直接配置 AI 人数和模组，并为游客保存偏好"`
- 结果：通过

## 截图证据

### 1. 创建房间弹窗

路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\lobby.e2e\Smash-Up-创建房间弹窗可直接配置-AI-人数和模组，并为游客保存偏好\lobby-smashup-create-room-ai-config-modal.png`

肉眼观察：

- 弹窗主标题显示为“创建房间”，不是 `Create Room`。
- AI 配置区域显示为“加入 AI”“AI 占位”“1 号位（房主）”“2 号位”“3 号位”，没有英文座位文案。
- 底部操作按钮显示为“取消”“确认”，没有 `Confirm`。

### 2. 进入派系选择页

路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\lobby.e2e\Smash-Up-创建房间弹窗可直接配置-AI-人数和模组，并为游客保存偏好\lobby-smashup-create-room-ai-config-result.png`

肉眼观察：

- 页面标题显示为“选择你的派系”，不是 `Draft Your Factions`。
- 顶部说明文案为中文“组合两个派系来构建你的终极牌组。利用不同的能力组合来大杀四方。”
- 牌面名称以中文为主，例如“海盗王”“忍者大师”“雷克斯王”“最高指挥官”，说明进入对局后的主要首屏也已落到中文链路。
