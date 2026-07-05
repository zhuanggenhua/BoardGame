# Change: 接入纸牌帮 The Gang 基础版

## Why
当前项目需要新增 `the-gang` 游戏。用户已提供本地素材目录、规则 PDF 与 DOM 参考入口，本轮需要在独立工作树中建立可追溯的新游戏接入流程，避免与 `main` 现有未提交改动混线。

## What Changes
- 新增 `the-gang` 游戏主范围，首期聚焦基础版 3-6 人合作德州扑克排序玩法。
- 建立规则与素材 intake 合同：规则 PDF 转 Markdown，图片素材先登记为候选资源，DOM 参考目前为空。
- 建立游戏目录骨架、manifest、本地/联机可注册的最小领域内核与 Board 页面。
- 首期实现基础回合循环：发底牌、翻公共牌、按轮选择筹码、摊牌排序判定、3 次成功或 3 次失败结束游戏。
- 明确跳过扩展：7-10 人扩展、挑战/专家卡、Joker、工具牌、Dealer 变体、其它扑克变体暂不纳入本 change。

## Impact
- Affected specs: `the-gang`
- Affected code: `src/games/the-gang/**`, `public/locales/*/game-the-gang.json`, `public/assets/i18n/zh-CN/the-gang/**`, generated game manifests
- Affected docs: `docs/games/the-gang/**`, `openspec/changes/add-the-gang-foundation/**`

## Execution Site
- Worktree: `D:\gongzuo\webgame\BoardGame\.worktrees\the-gang`
- Branch: `feat/the-gang`
- Game ID: `the-gang`

## Source Inputs
- 规则 PDF: `D:\gongzuo\webgame\gameasset\纸牌帮 The Gang\Mods\PDF\*`
- 图片素材: `D:\gongzuo\webgame\gameasset\纸牌帮 The Gang\Mods\Images\*`
- DOM 参考: `D:\gongzuo\webgame\gameasset\纸牌帮 The Gang\dom.txt`，当前文件为空，不能作为布局真相源
