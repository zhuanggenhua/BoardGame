# SmashUp 弃牌堆入口目标族合同

## 适用范围

- `Board.tsx` 弃牌堆横条
- `DeckDiscardZone` / `PromptOverlay` 的弃牌堆可打出态
- `discardPlayProvider / discardActionPlayProvider / discardSpecialProvider`

## 目标族定义

### 1. 弃牌堆 -> 基地

- 交互载体：先选弃牌堆卡，再点基地。
- 适用对象：
  - 从弃牌堆额外打出仆从到基地。
  - 从弃牌堆发动且真实目标就是基地的 special。
- UI 提示必须是“点击基地……”族。

### 2. 弃牌堆 -> 随从

- 交互载体：先选弃牌堆卡，再点随从。
- 适用对象：
  - 从弃牌堆额外打出附着到随从的持续行动。
- 必须走 `discardActionPlayProvider`。
- 不得复用 `discardSpecialProvider`，也不得提示“点击基地……”。

### 3. 弃牌堆 -> special

- 仅当这张牌在弃牌堆中的真实入口语义是“激活 special”，且首个真实目标族仍是基地时，才允许走 `discardSpecialProvider`。
- 如果 printed effect 最终是“把这张持续行动打到某个随从身上”，即使牌面带 `special`，也仍属于“弃牌堆 -> 随从”，不得伪装成 base special。
- 如果 discard special 只是借“点一个基地”当跳板，真正效果还要再选随从/其他对象，这不算合法的 base-first 目标族；不得作为新实现模板。

## 单一真相源

- provider 暴露的目标族，必须同时决定：
  - 弃牌堆卡牌是否高亮；
  - 选中后的提示文案；
  - 棋盘高亮对象；
  - 命令校验入口。
- 禁止出现“UI 说点基地，领域实际要求点随从”或反过来的双重真相。

## 当前代表实例

- `赛博守护者`：弃牌堆 -> 随从。
- `紫金宝葫芦（七娃在场时）`：弃牌堆 -> 随从。
- `Eh`：弃牌堆 -> 随从。
- `七彩莲蓬`：不是弃牌堆交互，属于手牌 prompt。

## 当前审计备注

- `归来者`：当前是合法的弃牌堆 -> 基地 special，因为真实效果就是“把自己埋葬到所点基地”。
