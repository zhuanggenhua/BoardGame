# The Gang 布局来源合同

## 当前结论

- 本轮不能继续沿用“`dom.txt` 空/不存在，所以改用 TTS 桌面式布局并完成”的旧口径；用户这次给出的可用 BGG 电子版参考是 `D:\gongzuo\webgame\gameasset\纸牌帮 The Gang\dom.html`、`运行时.txt`、`css\03-thegang.css` 与 `settlement\*`。
- TTS/Workshop 素材仍可作为牌面、筹码、牌背、警报、金条、牌槽和参考板的素材来源，但不再是 UI 风格目标。素材来源不等于视觉风格。
- 当前实现目标是：按 BGG 电子版结构抽取区位关系，按项目 UI 规范与 The Gang 游戏主题做可复刻界面；完成状态必须等最新真实页面 E2E、PureRef 打开和 AI 复看全部通过后才能恢复为完成。

## 已锁定 BGG 结构

| 区域 | BGG 证据 | 现实含义 | 当前实现状态 |
| --- | --- | --- | --- |
| 总入口 | `运行时.txt` 的 `#game_play_area` | The Gang 真实对局内容挂在单一游戏区域内 | `Board.tsx` 根节点写入 `data-layout-contract="bgg-electronic"` |
| 顶部玩家板 | `#top_zone` / `.top_zone` / `.plboard` | 玩家板横向排列，显示玩家、历史筹码和当前选择 | `data-bgg-zone="top-zone"` 与 `plboard` 已进入运行时 |
| 中部筹码和公共牌 | `#middle_zone` / `#token_pile` / `#card_river` | 中央先承接本轮筹码选择，再显示公共牌河 | `middle-zone`、`token-pile`、`card-river` 已进入运行时 |
| 底部金库/警报与手牌 | `#bottom_zone` / `#vaults_alarms_zone` / `#hand_groupzone` | 底部承接成功/失败轨道、帮助入口、手牌和当前牌型 | `vaults-alarms-zone` 与 `hand-groupzone` 已进入运行时 |
| 结算/摊牌 | `settlement\settlement-*`、BGG CSS 的 `.reveal_zone.final`、`.safe_opened/.safe_closed` | 结算是 reveal/final 态，不是普通底部文字列表 | 已新增 `reveal-final`、`safe-zone`、`reveal-players` 结构，仍需最新截图验收 |

## 风格裁定

- 结构参考：BGG 电子版的三区结构、筹码池、牌河、底部手牌与 reveal/final 结算关系。
- 素材参考：TTS/Workshop 中已命名落盘的牌、筹码、牌背、警报、金条、牌槽和参考板。
- 视觉风格：项目 `docs/ai-rules/ui-ux.md` 和 The Gang 游戏主题优先，走绿色牌桌、金库/警报、扑克协作推理语法；不得再称为或追求“TTS 桌面式布局”。
- 常驻主 UI 不显示长说明正文；结构说明仅保留为测试/无障碍层面的隐藏合同。
- 底部手牌结构来自 BGG 区位关系，但不能被解释成“所有主按钮都贴屏幕底边”。两副牌的上手/下手按钮必须贴近对应手牌、当前行动摘要或右侧偏下动作槽，并抬离移动端底部安全区；开局前交换牌才是交换入口的发生阶段。

## 当前验收状态

- 旧 2026-07-05 08:24 截图和 PureRef 记录只证明旧 TTS 桌面式版本曾经可跑，不能作为 BGG 电子版重做完成证据。
- 最新 Board 已切到 `data-layout-contract="bgg-electronic"`；2026-07-05 17:05/17:06 已按 1920×1080 基线重跑 The Gang 桌面运行时 E2E 与桌面教程 E2E，打开运行时满元素、运行时摊牌、教程满元素、教程摊牌四张最新截图给用户看，并由 AI 复看 `temp/the-gang-intake/the-gang-1920-desktop-contact.jpg`。手机横屏和最终完成口径仍等待用户桌面验收后继续。
- 在上述最新证据完成前，本文件只证明“重做方向已锁定并正在实施”，不证明 UI 已完成。
