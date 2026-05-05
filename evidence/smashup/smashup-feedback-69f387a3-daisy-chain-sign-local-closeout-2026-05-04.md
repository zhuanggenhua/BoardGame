# Smash Up 反馈 69f387a3 本地验收收口说明（2026-05-04）

## 反馈原文

- `按效果我应该加2战力  而不是减2`

线上反馈对应：

- feedbackId：`69f387a35cacc4e6b5cdbd4c`
- gameId：`smashup`
- route：`/play/smashup/match/k7QoohFeCbY?playerID=0`
- appVersion：`production`

## 线上现场能确认到什么

- 当前终态不是卡死态：
  - `sys.phase = playCards`
  - `flowHalted = false`
  - `interaction.queue = []`
- 争议对象在 `base_secret_garden / 神秘花园`：
  - `c10 = fairies_tinx`
  - `c10.controller = "0"`
  - `c10.basePower = 2`
  - `c10.powerModifier = 0`
  - `c10.tempPowerModifier = 0`
  - `c10.attachedActions` 中存在：
    - `c17 = fairies_daisy_chain`
    - `c17.ownerId = "2"`
- 同一份线上 action log 末尾还能看到真实链路：
  - `tinx -> 神秘花园`
  - `ongoing_detached 雏菊花环 ... （原因： tinx）`
  - `ongoing_attached 雏菊花环 -> c10`

这说明现场不是“自己打自己的《雏菊花环》后显示成了减 2”，而是 `tinx` 把一张**原本属于 2 号位**的《雏菊花环》转移到了自己身上。

## 权威文案对照

仓库当前权威 locale 文案：

- `public/locales/zh-CN/game-smashup.json`
  - `打在一个随从上。持续：如果你控制该随从，它具有 +2 力量；否则它具有 -2 力量。`
- `public/locales/en/game-smashup.json`
  - `Play on a minion. Ongoing: This minion has +2 power if you control it, or -2 power if you do not.`

当前实现也与文案一致：

- `src/games/smashup/abilities/ongoing_modifiers.ts`
  - `fairies_daisy_chain` 的修正规则是：
    - `action.ownerId === ctx.minion.controller` 时 `+2`
    - 否则 `-2`

## 结论

- 这条反馈对应的现场里：
  - 随从控制者是 `0`
  - 附着的《雏菊花环》拥有者是 `2`
- 因此根据当前卡面文案与实现规则，这张《雏菊花环》对 `tinx` 生效为 **-2**，不是 `+2`。
- 这条不是“实现把正负号写反了”，而是用户把“附着牌拥有者”和“当前随从控制者”的关系看反了。

## 收口口径

- 当前任务口径下，`resolved` 表示“本地已经确认并完成本地验收”，不代表已上传/已上线。
- 本条无需额外改代码，按“现网现场符合当前规则语义，但状态尚未回写”处理，可直接转 `resolved`。
