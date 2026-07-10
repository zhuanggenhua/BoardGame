# 纸牌帮 The Gang 基础版规则合同

## 真相源
- PDF 转写文本：`temp\the-gang-intake\the-gang-rules.md`
- 原始 PDF：`D:\gongzuo\webgame\gameasset\纸牌帮 The Gang\Mods\PDF\httpssteamusercontentaakamaihdnetugc18241853995950962155D223D1019F691AD39ECFAA3486100CC0DF23B06D.PDF`
- 当前合同只覆盖基础版 3-6 人；扩展、挑战、专家、Joker、工具、Dealer 与其它扑克变体均不进入本轮实现。

## 基础版原子规则
| 规则对象 | 合同字段 | 状态 | 证据摘录 |
| --- | --- | --- | --- |
| 玩家数 | 基础版支持 3-6 人 | locked | `THE BASE GAME (for 3-6 players)` |
| 游戏目标 | 3 次抢劫成功获胜，3 次失败失败 | locked | `You win the game if three heists are successful. You lose if you fail three times.` |
| 抢劫结构 | 每次抢劫包含 4 轮 | locked | `Each heist consists of four rounds.` |
| Round 1 | 每名玩家发 2 张底牌 | locked | `deal two cards face down to each player` |
| Round 2 | 翻 3 张公共牌 | locked | `Reveal three community cards` |
| Round 3 | 翻 1 张公共牌 | locked | `draws one card ... face up next to the three other community cards` |
| Round 4 | 再翻 1 张公共牌，然后摊牌 | locked | `After Round 4, proceed to the showdown` |
| 筹码 | 每轮用对应颜色星级筹码表达当前相对牌力 | locked | `communicate your estimation of the strength of your own hand ... relative to the other players` |
| 当前轮抢筹码 | 可拿当前轮任意筹码，包括桌中央的筹码或已经在其他玩家面前的筹码；每人同色最多 1 枚；不得把筹码放到别人面前 | locked | `This can be a chip from the center of the table, or it can be a chip that is already in front of another player.` / `You may never have more than one chip of the same color in front of you.` / `You may never place a chip in front of another player.` |
| 最终判定 | 只有第 4 轮红色筹码参与最终判定 | locked | `The only chips that matter now are the red ones you took in Round 4` |
| 平手 | 真实完全相同牌力时，相关玩家筹码都可视为正确 | locked | `Their chosen chips are counted as correct` |
| 沟通限制 | 不得明示、暗示或展示自己的手牌信息 | locked | `not allowed to freely discuss the cards in your hand` |

## 实现入口约束
- `playerView` 必须隐藏非本人底牌，直到摊牌公开。
- 主 UI 常驻文字只放对象名、数值、短状态和按钮；规则说明放到规则文档/帮助面板。
- 首期用游戏内扑克评估器实现，不改共享引擎。

## 跳过项
- 7-10 人扩展、exit chips、0/7/8 星筹码。
- 挑战卡、专家卡、Joker、工具牌、Dealer 与其它扑克变体。
