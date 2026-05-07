# SmashUp 反馈 `69faac614590ce09779a7d8f` 宗教圆环点击吞没修复 E2E 证据

- 日期：2026-05-07
- 反馈 ID：`69faac614590ce09779a7d8f`
- 游戏：`smashup`
- 反馈原文：`宗教圆环发不了效果`
- 本轮范围：定位并修复基地 ongoing 卡《宗教圆环》在 PC 端被透明放大镜包裹层吞掉点击，导致玩家难以真正触发 `USE_TALENT`
- 关联实现：
  - `src/games/smashup/ui/BaseZone.tsx`
  - `e2e/src/games/smashup/ui/BaseZone.tsx`
  - `e2e/smashup/smashup-base-minion-selection.e2e.ts`

## 根因

- `BaseZone` 给基地 ongoing 卡放大镜按钮包了一层 `absolute inset-0 z-60` 容器。
- 这层容器在桌面端默认覆盖整张 ongoing 卡，但没有 `pointer-events-none`，所以会拦截对卡面本体的点击。
- 《宗教圆环》属于基地 ongoing 天赋，玩家点击卡面本体本应触发 `USE_TALENT`；透明层拦截后，体感就是“发不了效果”。

## 修复

- 桌面端把基地 ongoing 放大镜包裹层改为 `pointer-events-none`。
- 仍保留放大镜按钮自身在 hover 时 `pointer-events-auto`，所以：
  - 点击卡面本体重新落到天赋触发链；
  - 点击右上角放大镜仍可正常开预览。

## 验证命令

```powershell
npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈复现：宗教圆环发动后，应允许把手牌中的同名本地人打到该基地"
```

结果：通过

## 关键截图与肉眼结论

### 1. 触发后宗教圆环进入已用态

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：宗教圆环发动后，应允许把手牌中的同名本地人打到该基地\smashup-sacred-circle-used.png`
- 我实际看到：
  - 巫师学院上方的《宗教圆环》卡面已经出现“已用”徽记，说明点击卡面后 `USE_TALENT` 真正落进了状态，而不是继续被透明层吞掉。
  - 手牌里仍能看到《本地人》和 `Zapbot`，说明此时还处在“发动天赋后等待继续打牌”的正确中间态。
- 是否达到验收标准：达到。这张图证明最核心的“点宗教圆环无反应”已经被修掉。

### 2. 选中手牌《本地人》后进入可继续打出的引导态

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：宗教圆环发动后，应允许把手牌中的同名本地人打到该基地\smashup-sacred-circle-highlight.png`
- 我实际看到：
  - 手牌《本地人》被绿色描边选中，说明玩家点击手牌后前端已把它识别为当前待打出的随从。
  - 棋盘没有弹出额外 PromptOverlay，仍是直接点基地的链路，符合这份 E2E 文件的验收主题。
- 是否达到验收标准：达到。这张图证明“宗教圆环发动后，手牌同名随从可进入正常选择态”。

### 3. 最终《本地人》成功打到巫师学院

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：宗教圆环发动后，应允许把手牌中的同名本地人打到该基地\smashup-sacred-circle-resolved.png`
- 我实际看到：
  - 巫师学院下方现在有 4 张《本地人》，总战力从 `9` 变成 `12`，右上还有 `+2` 浮字，说明新增随从确实成功进场。
  - 手牌只剩 `Zapbot`，原本手里的《本地人》已经不在手牌里，说明它不是“视觉上选中了但没真正打出去”。
- 是否达到验收标准：达到。这张图证明整条链路已完整收口到“同名随从成功落场”。

## 结论

- 本轮已在本地定位并修复真实根因：`宗教圆环` 不是规则无法发动，而是 UI 透明层吞掉了对 ongoing 卡面的点击。
- 修复后，E2E 已证明：
  1. 点击《宗教圆环》会真正进入已用态；
  2. 点击手牌《本地人》后可继续进入打牌选择；
  3. 最终《本地人》能成功打到巫师学院。
- 当前仍是**本地修复 + 本地 E2E 证据已完成**；本轮尚未执行远端反馈状态回写。
