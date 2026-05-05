# Smash Up 反馈 69f5469a 本地验收收口说明（2026-05-04）

## 反馈原文

- `着魔没效果，目标随从没有附加行动卡`

线上反馈对应：

- feedbackId：`69f5469a9ec13b96d710ae26`
- gameId：`smashup`
- route：`/play/smashup/match/GJGL3v6jO_z?playerID=0`
- appVersion：`production`

## 线上现场能确认到什么

- 当前终态不是卡死态：
  - `sys.phase = playCards`
  - `sys.flowHalted = false`
  - `sys.interaction.queue = []`
- 同一份线上 action log 已经直接记录到《着魔》真实附着成功：
  - `[08:31:10] 测试员: 战术卡施放： 着魔`
  - `[08:31:10] 测试员: 附加持续战术： 着魔  →  c24`
  - `[08:31:45] 测试员: 附加持续战术： 着魔  →  c6`
  - `[08:32:19] 测试员: 附加持续战术： 着魔  →  c24`
  - `[08:32:42] 测试员: 附加持续战术： 着魔  →  c24`
- 当前保存下来的终态里：
  - `world_champs_bewitched (c11)` 已在 `players['0'].discard`
  - 当时被附着过的 `skeletons_returned_one (c24)` 也已经进入弃牌堆
  - 所以**当前这一拍**看不到宿主身上仍挂着《着魔》，是因为链路已经继续往后走完，不是因为“一开始就没附着上”

这说明用户反馈里“目标随从没有附加行动卡”的描述，和当前保存下来的 action log 直接矛盾：日志明确记录了多次《着魔》附着到目标随从。

## 权威文案对照

仓库当前权威 locale 文案：

- `public/locales/zh-CN/game-smashup.json`
  - `打出到一个仆从身上。持续：这个仆从获得+2力量。如果这个仆从离开游戏，转移这张行动到另一个仆从身上。`
- `public/locales/en/game-smashup.json`
  - `Play on a minion. Ongoing: This minion has +2 power. If this minion leaves play, transfer this action to another minion.`

## 本轮本地复核

- 本轮重新跑通聚焦领域回归：
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
    - `world_champs_bewitched 离场转移交互可把持续行动从弃牌堆重新附着`
- 仓库现有浏览器级证据已完整覆盖《着魔》真实链路：
  - `evidence/smashup/smashup-world-champs-bewitched-eh-e2e-2026-04-28.md`
- 该证据文档里的关键截图已经明确证明：
  - 《着魔》先真实附着到宿主
  - 宿主离场后真实弹出转移 prompt
  - 转移后《着魔》会真实挂到新宿主身上，且继续提供 `+2`

## 结论

- 这条反馈对应的现场里，《着魔》并不是“没效果”。
- 线上 action log 已经直接证明它真实附着过目标随从；仓库现有 E2E 也证明了“附着 -> 宿主离场 -> 转移附着”的完整链路。
- 当前终态里看不到附着卡本体，是因为现场已经继续推进到宿主与《着魔》都离场后的更后拍，不等于前面没有附着成功。

## 收口口径

- 当前任务口径下，`resolved` 表示“本地已经确认并完成本地验收”，不代表已上传/已上线。
- 本条无需额外改代码，按“现网现场符合当前规则语义，但状态尚未回写”处理，可直接转 `resolved`。
