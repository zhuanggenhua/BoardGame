# Summoner Wars 手牌/阶段区对齐 - E2E 证据

- 用例 1：移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌
- 用例 2：移动横屏：长按放大与阶段说明在手机可达
- 用例 3：在线对局流程：召唤、移动、建造、攻击与弃牌（PC 视口 + 布局断言）
- 最近复跑时间：2026-04-17（移动横屏基础流程 + 可打出手牌高亮验证；PC 在线对局布局 + 可打出手牌高亮验证）

## 执行命令

```bash
npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌"
npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "移动横屏：长按放大与阶段说明在手机可达"
npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "在线对局流程：召唤、移动、建造、攻击与弃牌"
```

结果：三条用例均通过。

其中移动横屏用例会额外验证：
- 页面无横向滚动（`root/body scrollWidth <= innerWidth`）
- 右侧 controls（结束阶段按钮/弃牌堆）**可点击且能接收 pointer events**（通过 `elementsFromPoint` 证明没有被手牌遮挡）

## 关键截图与肉眼结论

### 0）PC 基线主态
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：长按放大与阶段说明在手机可达\00-pc-reference-board.png`
- 我实际看到：PC 视口下棋盘仍居中，右侧阶段列表和底部手牌沿用桌面基线，没有被本轮移动端 HUD rail 改窄，也没有缩在左上角。
- 判定：达到“PC 不被手机横屏修复牵连”的验收标准。

### 0.1）PC 在线对局 - 起始布局（更贴近用户真实路径）
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线对局流程：召唤、移动、建造、攻击与弃牌\50-pc-online-layout-start.png`
- 我实际看到：棋盘主区在画面中心；底部手牌居中且未侵入右侧 controls；右侧阶段条位于 controls 上方，不与“结束阶段/弃牌堆”重叠。
- 判定：PC 在线对局下布局稳定，可作为“PC 也修住了”的证据。

### 0.2）PC 在线对局 - 召唤阶段可打出手牌高亮
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线对局流程：召唤、移动、建造、攻击与弃牌\50-pc-online-playable-hand-highlight.png`
- 我实际看到：可打出的手牌边缘有明显青绿色 ring 和发光，不再只是很弱的一圈细边，肉眼能直接分辨“哪些牌现在可用”。
- 判定：达到“召唤阶段可选手牌高亮恢复可见”的验收标准。

### 1）基础流程起始主态
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\40-mobile-basic-flow-start.png`
- 我实际看到：底部手牌以整屏 `50%` 为锚点居中（不再用“右侧安全走廊”导致整体左偏）；棋盘主区保持在画面中心；右侧阶段列表在上、结束阶段按钮/弃牌堆在下，形成上下分层，没有互相遮挡；手牌也没有把右下 controls 区域压到不可用（与下方 `assertMobileLandscapeControlsReachable` 的可点击校验一致）。
- 判定：达到本轮“移动端整屏居中 + 手牌不再把 controls 挡死 + 阶段区与按钮分层”的验收标准。

### 1.0）移动横屏 - 召唤阶段可打出手牌高亮
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\40-mobile-basic-flow-playable-hand-highlight.png`
- 我实际看到：三张可打出的手牌都带有明显青绿色描边和外发光，压缩到手机手牌大小后也不会“看起来像没高亮”。
- 判定：达到“移动端同样能直接看见可打出手牌”的验收标准。

### 1.1）召唤高亮
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\40-mobile-basic-flow-summon-highlight.png`
- 路径（放大取证）：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\40-mobile-basic-flow-summon-highlight-zoom-context.png`
- 我实际看到：点击手牌进入选中态后，城门旁的可召唤空格出现亮绿色描边和内发光，亮框本体在手牌上方直接可见，不是只靠 DOM 属性或断言推断；高亮格与右侧 HUD、底部手牌之间仍有清晰分区，没有被遮住。
- 判定：达到“选中手牌后，基地可召唤区域必须肉眼可见高亮”的验收标准；E2E 同时校验了目标格 `borderTopWidth = 2px` 且 `backgroundColor != transparent`，不是只拍到过渡起始帧。

### 1.2）移动高亮
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\40-mobile-basic-flow-move-highlight.png`
- 路径（放大取证）：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\40-mobile-basic-flow-move-highlight-zoom-context.png`
- 我实际看到：选中单位后，周围可移动空格出现一圈亮蓝色方框，至少 5 个目标格能直接看见边框和发光；高亮不是缩在棋盘纹理里，而是明显浮在可移动格边界上。
- 判定：达到“选中单位后，可移动区域必须肉眼可见高亮”的验收标准；E2E 同时校验了目标格 `borderTopWidth = 2px` 且 `backgroundColor != transparent`。

### 2）攻击后主态
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\40-mobile-basic-flow-after-attack.png`
- 我实际看到：进入攻击阶段后，棋盘仍在整屏中线附近；右侧阶段列表与 controls 保持分层；手牌仍在底部居中且可操作。截图中“结束阶段”按钮保持可见且未被手牌遮挡。
- 判定：攻击阶段过程没有回归到“手牌把右侧 controls 顶歪/挡住”的旧问题。

### 3）魔力阶段后主态
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\41-mobile-basic-flow-after-magic.png`
- 我实际看到：弃牌堆在右下，结束阶段按钮在其上方，底部手牌缩到更短的宽度后仍贴底居中；棋盘与 HUD 仍属于同一套坐标关系，没有明显偏向一侧。
- 判定：基础流程收口阶段仍满足移动横屏布局要求。

### 4）手机横屏主态（长按/阶段说明用例）
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：长按放大与阶段说明在手机可达\10-phone-landscape-board.png`
- 我实际看到：阶段列表完整落在右上区域，结束阶段按钮在其下方；底部手牌对齐到整屏中心锚，视觉上与棋盘中线一致，不再出现“为了给右侧 HUD 让位而整体左偏”的现象。
- 判定：主态有效，可作为本轮“移动端中心已拉回”的直接证据。

### 5）长按手牌放大
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：长按放大与阶段说明在手机可达\11-phone-hand-magnify-open.png`
- 我实际看到：长按后大卡覆盖棋盘中央，关闭按钮仍在视口内；右侧阶段列表和结束阶段按钮没有被挤出屏幕。
- 判定：移动端长按看大图可正常进入和收口。

### 6）阶段说明面板
- 路径（全图）：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：长按放大与阶段说明在手机可达\12-phone-phase-detail-open.png`
- 路径（面板特写，确保肉眼可见本体）：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：长按放大与阶段说明在手机可达\12-phone-phase-detail-open-clip.png`
- 我实际看到：阶段说明面板在右侧 HUD rail 内可见，且没有被“结束阶段/弃牌堆”遮住；特写截图里能清晰看到标题“建造”，但正文仍显示为 `phaseDesc.build.*` key（文案缺失问题，不是布局问题）。
- 判定：本轮“阶段说明可见且不被遮挡”的布局目标达成；文案缺 key 需另行处理。

## 本轮结论

- 已修住的点：
  - 移动端手牌中心已拉回到旧版的整屏中心锚，不再出现“整体往左偏一点”。
  - 手牌右边界不再压进右侧 controls。
  - 阶段列表与结束阶段按钮重新分层，不再彼此打架。
  - 阶段说明面板可见，且位置回到右侧 HUD 内。
  - 召唤/移动的空格高亮重新恢复为肉眼可见，不再只剩极细边线或只能靠 DOM 属性判断。
  - 攻击后不再触发 `ReferenceError: unitAbilities is not defined`（此前会导致页面渲染失败）。
- 尚未在本轮处理的点：
  - 阶段说明文案缺失，截图里仍出现 `phaseDesc.*` key。
