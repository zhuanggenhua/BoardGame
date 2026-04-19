# 狮身人面像埋葬牌改为场景内挖掘 - E2E 证据

## 用例

- 测试文件：`e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
- 用例名：`狮身人面像埋葬牌交互应直接在场景内翻正面并高亮可选牌`
- 截图路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\狮身人面像埋葬牌交互应直接在场景内翻正面并高亮可选牌\sphinx-bury-board-select.png`

## 肉眼观察

1. 画面上方只保留一条标题横幅“狮身人面像：选择一张你的埋葬牌，将其回手并把此泰坦放到其所在基地”，没有再出现旧的全屏卡牌选择弹层。
2. 第一座基地“金字塔”下方那张埋葬牌已经直接显示为正面卡图，不再是统一卡背，说明进入交互后可以直接在场景里看正面信息。
3. 画面中央只有一个独立的“跳过”按钮，狮身人面像本体仍在左下方泰坦区待命，说明当前截图记录的就是“场景内选埋葬牌，再决定是否跳过/继续”的新路径。
