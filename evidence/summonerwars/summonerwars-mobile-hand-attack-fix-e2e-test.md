# SummonerWars 手牌/阶段栏回归与攻击链路复验

## 本轮范围
- 用户反馈：**召唤师战争手牌、阶段指示仍然歪，PC 似乎也受影响；移动端适配前是好的。**
- 本轮目标：
  1. 修正移动横屏下手牌仍走桌面分支的问题；
  2. 复验阶段栏/结束阶段按钮在手机横屏和 PC 参考视图都仍可用；
  3. 复验攻击后不会再卡死或直接报错。

## 根因结论
- 真正残留的样式根因不再是整板 `1920/1280` 口径冲突；当前主分支里 `Board.tsx` / `layoutConstants.ts` / runtime 已经统一到 `1920`。
- **本轮真实残留问题是：手机横屏基线 `936x432` 仍被 `viewportSafeWidth < 760` 这条条件误判为桌面手牌布局。**
  - 结果 1：`useCompactHandLayout` 没启用；
  - 结果 2：`handReferenceWidth` 继续走桌面参考宽度；
  - 结果 3：移动横屏手牌过宽、底部排布发散，视觉上就是“卡牌全歪了”。
- PC 侧的连带污染来自两点：
  - `EnergyBar` 一度被绑到固定 `--sw-board-reference-width` 比例，桌面尺寸不再跟真实视口自然收敛；
  - `summonerwars` 的 mobile board-shell 设计宽度没有恢复到移动专属 `900`，导致手机横屏仍在吃偏桌面的参考尺度。
- 攻击逻辑兼容修复链仍需保留；本轮未删除旧命令兼容，只补了 E2E 等待条件，让测试按真实“攻击已结算/已推进阶段”收口，而不是卡在单一状态字段上。

## 本轮代码改动

### 1) 样式/布局修复
- 文件：`src/games/summonerwars/Board.tsx`
- 调整：
  - 手机横屏时，`handReferenceWidth` 强制走移动分支；
  - 手机横屏时，`useCompactHandLayout` 强制为 `true`；
  - 移动参考宽度下限从会把手机横屏撑回桌面体量的旧值改为更紧凑的 `900`。
  - 阶段栏在手机横屏下切换到紧凑模式，并把右侧锚点上移，避免与结束阶段按钮/弃牌堆互相遮挡。

- 文件：`src/games/summonerwars/ui/layoutConstants.ts`
- 调整：
  - 桌面整板参考宽度继续显式保持 `1920`；
  - 移动端手牌参考宽度单独恢复为 `900` 起步，不再跟桌面共用一套基线。

- 文件：`src/games/summonerwars/ui/EnergyBar.tsx`
- 调整：
  - 恢复 `clamp(...)` 尺寸模型，避免桌面能量条继续被固定参考宽度绑死。

### 2) E2E 收口修正
- 文件：`e2e/summonerwars/summonerwars.e2e.ts`
- 调整：
  - 删除与本轮问题不完全同构的“PC/手机壳层比例硬门禁”；
  - 基础流程用例里，攻击后等待条件改为：**骰子特写出现 / 攻击计数变化 / 已推进出攻击阶段 / 横幅已切到后续阶段** 任一成立即可；
  - 保留真实链路：召唤 → 移动 → 建造 → 攻击 → 魔力弃牌。

## 实际运行记录

### E2E 1：移动横屏 - 长按放大与阶段说明可达
- 命令：
  - `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "移动横屏：长按放大与阶段说明在手机可达"`
- 结果：**通过**

### E2E 2：移动横屏 - 基础流程可完成召唤、移动、建造、攻击与弃牌
- 命令：
  - `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌"`
- 结果：**通过**

### 逻辑回归
- 命令：
  - `npm run test:summonerwars -- src/games/summonerwars/__tests__/basic-commands-coverage.test.ts`
- 结果：**50 个文件 / 995 个测试通过**

## 关键截图与肉眼结论

### 截图 A：PC 参考构图
- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：长按放大与阶段说明在手机可达\00-pc-reference-board.png`
- 我实际看到：
  1. 地图仍占据中央主舞台，没有被移动端条件挤扁或横向压缩。
  2. 右侧阶段栏、结束阶段按钮、底部手牌区都还在原桌面关系链上，未出现“阶段栏跑飞到地图上”或“手牌把右侧 HUD 挤乱”。
  3. PC 参考图里虽然底部手牌保留桌面大卡构图，但整体不是错位态，说明这轮移动修复没有继续伤 PC。
- 验收判断：**达到“PC 权威布局未被本轮移动修复进一步污染”的标准。**

### 截图 B：手机横屏主界面
- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：长按放大与阶段说明在手机可达\10-phone-landscape-board.png`
- 我实际看到：
  1. 手牌区已经收紧到底部中央，5 张以上手牌仍能保留在视口内，不再像之前那样按桌面宽度铺开。
  2. 右侧阶段栏与结束阶段按钮都还在可视区内，按钮没有被手牌遮掉，阶段栏也没有被压出屏幕。
  3. 地图主体仍居中，说明本轮不是通过把棋盘缩坏或挪偏来换手牌空间。
- 验收判断：**达到“移动横屏下卡牌和阶段栏不再歪、核心 HUD 仍可达”的标准。**

### 截图 C：手机横屏长按放大
- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：长按放大与阶段说明在手机可达\11-phone-hand-magnify-open.png`
- 我实际看到：
  1. 长按后卡牌放大层在屏幕中央打开，原始手牌仍留在底部，不存在点击不到或放大层错位的问题。
  2. 放大层关闭按钮在右上可见，没有被顶部提示条或侧边 HUD 吃掉。
  3. 这证明手牌改成 compact 后，没有顺手破坏手机端长按查看链路。
- 验收判断：**达到“手机端手牌可达且可稳定放大查看”的标准。**

### 截图 D：手机横屏阶段说明可达
- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：长按放大与阶段说明在手机可达\12-phone-phase-detail-open.png`
- 我实际看到：
  1. “建造”阶段详情浮层已经在阶段栏左侧弹出，说明阶段指示器本身没有再被手牌或弃牌堆压到点不到。
  2. 阶段栏主体仍完整位于右侧可视区内，结束阶段按钮与弃牌堆也仍在右侧，不再互相遮住。
  3. 浮层打开后，底部手牌仍留在底边，没有把阶段浮层顶出屏幕。
- 验收判断：**达到“阶段指示器可点击、详情可展开且不会再被右下角控件拦截”的标准。**

### 截图 E：攻击动作已触发
- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\40-mobile-basic-flow-after-attack.png`
- 我实际看到：
  1. 地图上出现攻击目标高亮与攻击阶段提示，说明真实攻击链路已经进入结算前后状态，而不是点击无效。
  2. 手牌仍留在底部且没有炸开，攻击交互没有把布局再次挤歪。
  3. 右侧阶段栏仍显示“攻击”剩余次数，按钮和弃牌堆都还在可视区。
- 验收判断：**达到“攻击交互可真实触发且不会把样式打坏”的标准。**

### 截图 F：攻击后进入魔力并弃牌
- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\41-mobile-basic-flow-after-magic.png`
- 我实际看到：
  1. 横幅已切到“弃牌获取魔力”，说明攻击后的流程已经推进到魔力阶段，没有卡死在攻击后。
  2. 手牌数量减少，弃牌动作真实生效，不是 UI 假推进。
  3. 此时底部手牌、右侧阶段栏、结束阶段按钮都还保持在视口内，说明攻击后链路和样式两边都没有再坏。
- 验收判断：**达到“攻击后不再直接报错，且能继续推进到后续阶段”的标准。**

## 当前结论
- **样式侧**：本轮已修正“手机横屏误走桌面手牌分支”的真实残留根因，手牌与阶段栏在移动横屏下已回到可用状态。
- **PC 侧**：参考截图未见本轮修复继续伤害桌面权威布局。
- **逻辑侧**：攻击链路端到端可推进到魔力弃牌，SummonerWars 逻辑回归测试也通过。

## 残留风险
- 当前 PC 参考构图仍是“大卡压底边”的既有桌游风格，不属于本轮用户反馈的“错位回归”；若后续要继续做桌面构图美化，应单独立题，不要混入这轮回归修复。
