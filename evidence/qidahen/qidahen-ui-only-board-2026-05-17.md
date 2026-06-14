# 七大恨 UI-only Board 验收证据（2026-05-17）

## 范围

- 前端实现范围：`src/games/qidahen/Board.tsx`
- 规范范围：`design-system/games/qidahen.md`、`.windsurf/skills/boardgame-ui-imagegen/SKILL.md`
- 当前验收目标：只显示用户草图指定 UI，非 UI 区域为空白；轮盘为独立 HUD；轮盘内容来自规则与参数/参考卡，不猜标签；轮盘说明只作为悬浮 tip；轮盘移动分支不常驻成旁边按钮列；纪年主态只常驻今年/下一年两张卡；左下抽牌、底中手牌、右下弃牌贴底固定可见；行动按钮本身承担执行语义，不显示弃置数量、支付进度、花费圆章或同义独立执行按钮；行动按钮按内容宽度收紧，不留固定容器空条。

## 截图

- 桌面 1920x1080：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-board-desktop-current.png`
  - 我实际看到：中央为空白，没有主地图、背景图、地图纹理或区域 tooltip。
  - 我实际看到：左上轮盘已经改成规则短标签盘面，8 个扇区显示行动组合标签；但本文早期截图结论仍沿用过旧的单字标签口径，2026-05-18 已按地图素材修正为 `开垦/军屯`、`征兵/训练`、`外交/雇佣`、`进攻/调度` 的行动组合口径。
  - 我实际看到：纪年区只有今年/下一年两张纪年卡，未再常驻纪年牌堆；这符合“可查看不等于主态常驻牌堆”的新裁决。
  - 我实际看到：底部左下抽牌、底中 6 张手牌、右下弃牌都贴近底边；手牌后面没有半透明罩子、厚托盘或扇形旋转。
  - 我实际看到：右侧行动区只有四个动作按钮，按钮正文只显示动作名；按钮已经从固定宽度横条改成按动作名收紧的短纸签，右侧没有一整段无意义空白；没有弃置数量、支付进度、花费圆章或独立 `执行` 按钮。
  - 我实际看到：玩家悬浮窗、行动按钮和 tip 仍统一为切角纸签、旧铜压边、朱砂状态条和轻压印阴影；比上一版“浅色网页卡片”更接近七大恨实体素材语法。
  - 结论：达到本轮桌面 UI-only 布局验收；轮盘本体已改为独立前端 HUD 组件，仍固定在 HUD 层，不会随未来地图移动错位。轮盘内容已经回到规则/参数图口径，不再是八卦猜测或数字程序盘。

- 手机横屏 936x432：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-board-mobile-landscape-current.png`
  - 我实际看到：画面没有缩在左上角，轮盘、玩家悬浮窗、朝鲜区、纪年区、操作区、抽牌、手牌、弃牌都在可视区内。
  - 我实际看到：横屏下轮盘仍能看出规则短标签；右侧按钮宽度明显收紧，没有大片空白按钮条。
  - 我实际看到：左下抽牌与右下弃牌贴近底边，底部没有再被无效空隙垫高；手牌直排贴底，未被改成窄布局或双列手机稿。
  - 我实际看到：HUD 与主内容仍在同一套缩放坐标系，没有只占左上角一块。
  - 结论：达到本轮移动横屏布局锚点验收；卡牌文字细读仍以桌面视角为主。

- 行动流 1920x1080：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-action-flow-current.png`
  - 我实际看到：点击 `征召军队` 后没有出现 `执行` 按钮、支付面板或手牌支付角标；大明手牌从 `5/15` 变为 `4/15`，弃牌从 `7` 变为 `8`。
  - 我实际看到：行动按钮仍是短纸签，点击后只用朱砂侧条反馈已触发动作，没有把弃置数量、支付进度或规则解释塞回按钮正文。
  - 结论：达到“按钮点击即执行，不重复解释和确认”的本轮验收。

## 风格确认

风格名称：**明末纸本军议 UI**。

参考来源与裁决：

- 项目 UI/UX：采用 `design-system/styles/classic-parchment.md` 的纸本、暖色、实体桌游反馈方向；拒绝整屏羊皮纸大背景和过度装饰。
- 真实素材：采用卡背/卡面、纪年卡/朝鲜牌、marker、轮盘的低饱和印刷质感；真实卡面保留素材自身色彩，前端新增 UI 外壳统一使用纸色、旧铜、朱砂、墨色。
- `ui-ux-pro-max`：通用推荐里出现的蓝绿 SaaS、Retro-Futurism、CRT、Bento 大圆角方向与七大恨素材冲突，未采纳；仅保留可读性、触控反馈、状态清晰这类通用 UX 原则。

核心 token：

- `paper #f6ecd8`、`paperLight #fff8e9`、`paperDeep #e8d6b5`、`ink #2f2419`、`mutedInk #6f5840`。
- `bronze #8d673c`、`bronzeSoft #c9aa78`、`cinnabar #b83b27`、`oldGold #b79a65`。
- `shadow rgba(67,43,21,0.16)`、`shadowSoft rgba(67,43,21,0.10)`。

组件族对照：

- 我实际看到：玩家悬浮窗、行动按钮、tip 都使用切角纸签、旧铜边、轻压印阴影；当前/选中态统一使用朱砂侧条或朱砂边。
- 我实际看到：牌堆标签、数量圆章与按钮共用纸色、旧铜/朱砂边框；手牌主态不再显示 `可付/已选` 角标。
- 我实际看到：该历史小节曾错误记录“卦线”和“朱砂当前位置点”；2026-05-18 已判定这属于无来源伪装饰，不再作为验收依据。正确口径是灰褐盘面、黑色外圈、分区墨线、行动组合短标签、中心“行动轮盘”和扇区高亮。
- 我实际看到：空白非 UI 区域保持白底，没有为了风格一致额外铺地图底、羊皮纸大背景、装饰角或模糊纹理。

结论：本轮达到“按钮去冗余 + 轮盘内容回规则”验收。上一版仍有凭空设计成分，本轮已删除行动按钮里的支付/弃置数字和同义执行入口，收紧按钮宽度，并把轮盘内容从八卦/数字/模糊裁图改为规则与参数/参考卡可证明的短标签。

## 验证

### 2026-05-18 轮盘八卦伪装饰修正

- 旧结论失效：本文前文和历史小节中凡是把轮盘描述成“卦线 / 八卦线索 / 独立标签加卦线”的表述，均为错误中间态，不再作为验收依据。
- 参考源：`public/assets/i18n/zh-CN/qidahen/board/main-board.png` 左上行动轮盘裁图、`temp/qidahen-wheel-source-crop.png`、`src/games/qidahen/rule/七大恨规则.md` 的“轮盘行动”章节。
- 我实际看到：地图素材左上轮盘是行动轮盘，不是八卦盘；它包含黑色外圈、8 个行动扇区、分区线、行动文字、中心“行动轮盘”和年中/新年标注，没有卦线、占卜符号或额外图腾。
- 修正要求：正式 UI 必须继续保持可交互前端实现，但不得再用 `trigram` 数据、`WheelTrigram` 组件或任何无来源装饰线填充扇区；当前位置用扇区边框/底色表达，选中目标用该扇区自身外扩放大和朱砂高亮表达。
- 规范同步：`design-system/games/qidahen.md` 已把轮盘门禁改为“行动轮盘”，并明确禁止八卦、卦线、假 OCR、装饰线和无来源图腾。

### 2026-05-18 行动轮盘素材标注补齐

- 修改范围：`src/games/qidahen/Board.tsx`、`e2e/qidahen-basic-flow.e2e.ts`、`src/games/qidahen/__tests__/Board.test.ts`。
- 参考源：`temp/qidahen-main-board-wheel-highres-x3.png` 高清裁图、`src/games/qidahen/rule/七大恨规则.md` 的年中/新年结算段落。
- 我实际看到：高清地图轮盘顶部有 `新年 >>>`，底部有 `年中`；这两个是行动轮盘结算节点标注，不是装饰。
- 我实际看到：当前实现已补回 `新年 >>>` 与 `年中`，仍保持 8 个行动扇区、透明命中区、当前位置扇区高亮和目标扇区外扩放大；没有恢复卦线、圆点、图腾或贴图本体。
- 验证通过：
  - `npx eslint src/games/qidahen/Board.tsx src/games/qidahen/__tests__/Board.test.ts e2e/qidahen-basic-flow.e2e.ts`
  - `npx vitest run src/games/qidahen/__tests__/Board.test.ts --pool threads --no-file-parallelism --maxWorkers 1`（90 passed）
  - `npm run test:e2e:ci:file -- e2e/qidahen-basic-flow.e2e.ts`（3 passed）

### 2026-05-18 轮盘边框减噪复验

- 修改范围：`src/games/qidahen/Board.tsx` 的 `WheelPanel` 绘制层。
- 我实际看到：桌面截图中轮盘外圈不再由多层亮边和厚 inset 叠加，外框从“多圈边框”收敛为一层主铜边加一层弱内线；“朱砂当前位置点”属于历史中间态，后续已改为扇区高亮。
- 我实际看到：中心区域从多层同心圆压成更少层级，视觉重心没有再被中心圈抢走；“八卦线索”属于错误中间态，后续不得保留。
- 我实际看到：手机横屏截图中轮盘仍位于左上锚点，未缩到左上角一块，也没有被改成窄布局；轮盘文字在当前缩放下仍能识别主要短标签。
- 结论：达到本轮“轮盘 UI 不要这么多圈边框”的视觉优化目标；没有破坏现有轮盘热区、tooltip、行动按钮或移动横屏锚点。
- 验证通过：
  - `npx eslint src/games/qidahen/Board.tsx e2e/qidahen-basic-flow.e2e.ts`
  - `npm run test:e2e:ci:file -- e2e/qidahen-basic-flow.e2e.ts`（3 passed）

### 2026-05-18 轮盘选中态复验

- 修改范围：`src/games/qidahen/Board.tsx` 的 `WheelPanel` 选中态与 `e2e/qidahen-basic-flow.e2e.ts` 的截图时机。
- 我实际看到：桌面稳定截图已在点击 `走 3` 后保存，不再是未选择或只 hover 的状态；截图里顶部后金手牌为 `10/10`，说明 `走 3` 的状态变化已经发生。
- 我实际看到：该历史小节里的“朱砂圆点 / 小圆点”属于错误中间态；后续改为当前位置扇区高亮、目标扇区自身外扩放大。
- 我实际看到：tooltip 同屏显示 `所有对手抽 2，走 3：蒙古、后金各抽 2`，与选中扇区和顶部玩家手牌变化一致。
- 结论：达到“截图必须是选中时，并且选中效果要表达轮盘功能”的验收目标；选中态不再只是装饰描边，而是同时表达当前位置、移动目标和结算含义。
- 验证通过：
  - `npx eslint src/games/qidahen/Board.tsx e2e/qidahen-basic-flow.e2e.ts`
  - `npm run test:e2e:ci:file -- e2e/qidahen-basic-flow.e2e.ts`（3 passed）

### 2026-05-18 素材外圈对照

- 素材参考：`public/assets/i18n/zh-CN/qidahen/board/action-wheel-marker.jpg`
- 我实际看到：素材里的轮盘外圈是浅色厚环，边缘只有很薄的暗线，不是多层深棕边框。
- 我实际看到：当前实现的轮盘外圈已经朝素材方向收敛，轮盘下方不再露出半个圆圈；当前位置标记也已收回轮盘内侧，不再越出外边界。
- 结论：当前外圈结构可以继续微调，但已经不是“多圈边框堆叠”的状态；后续若还要更像素材，应优先继续压外圈厚度和颜色层次，而不是再加装饰圈。

### 2026-05-18 轮盘素材化重构

- 修改范围：`src/games/qidahen/Board.tsx`、`src/games/qidahen/criticalImageResolver.ts`、`e2e/qidahen-basic-flow.e2e.ts`。
- 我实际看到：轮盘主体曾临时改成 `main-board.png` 左上轮盘裁切作为视觉底图；该贴图方案已在后续小节判定失效，正式方案必须是可交互前端实现。
- 我实际看到：该贴图方案小节中的“来自地图素材”和“当前位置点”均为已废弃中间态；正式方案只以地图素材校准结构，仍使用可交互前端轮盘实现。
- 我实际看到：选中 `走 3` 后，红色目标扇区叠在素材轮盘对应目标格上，顶部后金手牌变为 `10/10`，tooltip 显示 `所有对手抽 2，走 3：蒙古、后金各抽 2`。
- 结论：达到“轮盘 UI 必须对齐地图素材，而不是继续手绘猜”的重构目标。
- 验证通过：
  - `npx eslint src/games/qidahen/Board.tsx src/games/qidahen/criticalImageResolver.ts e2e/qidahen-basic-flow.e2e.ts`
  - `npm run test:e2e:ci:file -- e2e/qidahen-basic-flow.e2e.ts`（3 passed）

### 2026-05-18 轮盘交互组件重构修正

- 上一条“素材化重构”结论失效：直接贴 `main-board.png` 裁切虽然能对齐外观，但不利于独立选中块放大、交互态和后续动画扩展。
- 修改范围：`src/games/qidahen/Board.tsx`、`src/games/qidahen/criticalImageResolver.ts`、`e2e/qidahen-basic-flow.e2e.ts`。
- 我实际看到：轮盘本体已恢复为 SVG 组件实现，未再贴地图轮盘图片；素材只作为外观校准参考。
- 我实际看到：选中的移动目标扇区使用独立 SVG 图层，按中心轻微放大并外扩，红色半透明选中块可以单独调整动画、阴影和命中反馈。
- 我实际看到：该历史小节里的“当前位置点和目标点”属于已废弃中间态；后续要求改为当前扇区高亮与目标扇区外扩放大。
- 结论：达到“要实现，不是贴图；选中那一块能独立放大”的修正目标。
- 验证通过：
  - `npx eslint src/games/qidahen/Board.tsx src/games/qidahen/criticalImageResolver.ts e2e/qidahen-basic-flow.e2e.ts`
  - `npm run test:e2e:ci:file -- e2e/qidahen-basic-flow.e2e.ts`（3 passed）

### 2026-05-18 轮盘实现对齐复验

- 修改范围：`src/games/qidahen/Board.tsx`、`design-system/games/qidahen.md`。
- 规范修正：`design-system/games/qidahen.md` 已新增“对齐必须是实现，不是敷衍贴图”和“每次轮盘 UI 改动必须交付选中态截图”门禁。
- 我实际看到：当前结果仍是 SVG 前端实现，不再贴 `main-board.png` 轮盘裁图；完整地图素材只作为结构参考。
- 我实际看到：外圈从多层同心装饰压回一层黑色主外描边 + 一层弱内线，中心圆也减少了厚重边框，不再像多圈边框堆叠。
- 我实际看到：该历史小节仍写了“独立标签/卦线”和“两个朱砂圆点”，属于错误中间态；2026-05-18 起改为当前位置用扇区高亮、选中目标用同一扇区外扩放大和朱砂高亮，不再画卦线或圆点。
- 我实际看到：tooltip 同屏显示 `所有对手抽 2，走 3：蒙古、后金各抽 2`，顶部后金手牌为 `10/10`，证明截图是选中后的真实交互状态。
- 交付截图：
  - 全屏结果：`C:\Gamedev\Unity\Project\dark-corridor\dark-corridor\.codexbridge\turn-artifacts\1a41365c-597e-4afc-9e70-e4d607d41d4c\qidahen-board-selected-result.png`
  - 轮盘放大：`C:\Gamedev\Unity\Project\dark-corridor\dark-corridor\.codexbridge\turn-artifacts\1a41365c-597e-4afc-9e70-e4d607d41d4c\qidahen-wheel-selected-zoom.png`
- 验证通过：
  - `npx eslint src/games/qidahen/Board.tsx e2e/qidahen-basic-flow.e2e.ts`
  - `npm run test:e2e:ci:file -- e2e/qidahen-basic-flow.e2e.ts`（3 passed）

- `$env:PYTHONUTF8='1'; python D:\codex-home\skills\.system\skill-creator\scripts\quick_validate.py .windsurf\skills\boardgame-ui-imagegen`（通过）
- `rg -n "七大恨|qidahen|大明|蒙古|后金|朝鲜|赐印|突袭|征召|驱虎|马市|大汗|联姻|action-wheel-marker" .windsurf\skills\boardgame-ui-imagegen\SKILL.md`（无命中，通用 skill 未混入七大恨专属内容）
- `npx eslint src/games/qidahen/Board.tsx src/games/qidahen/domain/commands.ts src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/payment-selection.test.ts e2e/qidahen-basic-flow.e2e.ts`
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx vitest run src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/payment-selection.test.ts --pool threads --no-file-parallelism --maxWorkers 1`（98 passed）
- `npm run test:e2e:ci:file -- e2e/qidahen-basic-flow.e2e.ts`（3 passed；首次因 `6273/20100/21100` 只有 `TIME_WAIT` 残留而失败，未清共享端口，等待释放后重跑通过）

E2E 覆盖：

- 桌面端 UI-only 锚点、无地图、8 扇区轮盘、8 个规则短标签、动作按钮宽度小于 180px、轮盘移动分支无常驻按钮列、轮盘 tip 默认隐藏且 hover 后出现、两张纪年卡、无常驻纪年牌堆、左右下角牌堆、底中手牌贴底。
- 真实 Board 交互：轮盘本体命中区选择；势力行动按钮点击后直接自动支付并结算，弃牌堆和手牌数变化；未使用手牌支付角标、支付面板或独立 `执行` 按钮。
- 手机横屏：舞台不缩左上角，抽牌/手牌/弃牌都在 viewport 内。

## 规范补强

- `.windsurf/skills/boardgame-ui-imagegen/SKILL.md` 增加“规则到 UI 分层裁决”：规则实体、可查看对象、动作入口、状态反馈、提示说明分层处理；明确 `可查看` 不自动等于主界面常驻牌堆，提示默认悬浮，不挤压布局，按钮不得退化。
- `.windsurf/skills/boardgame-ui-imagegen/SKILL.md` 增加“Prompt 拆分门禁”：结构、风格、交互态、复杂对象复刻分步推进，避免一次大 prompt 混进过多目标后失守。
- `.windsurf/skills/boardgame-ui-imagegen/SKILL.md` 增加“风格确认门禁”：风格必须写成名称、参考来源、核心色板、材质语法、组件族语法、状态语法和禁用风格，并用至少 3 类真实素材与同屏组件横向对照验收。
- `.windsurf/skills/boardgame-ui-imagegen/SKILL.md` 增加“同义入口/常驻分支按钮/按钮正文去解释化”门禁：叶子动作按钮不得再配同义执行按钮；对象本体可点击时，短分支不得常驻成旁边按钮列；用户或游戏专属规范明确点击即执行时，按钮正文不得显示代价、支付进度、弃置数量、结果说明或实现命令名。
- `.windsurf/skills/boardgame-ui-imagegen/SKILL.md` 增加“规则内容不得猜测”门禁：轮盘、轨道、参数图、行动按钮、代价和结算标签必须回指规则原文、提示卡/帮助卡或游戏专属规范；任一格没有来源，不得用八卦、数字、占位字或通用装饰替代。
- `.windsurf/skills/boardgame-ui-imagegen/SKILL.md` 增加“规则/参数图证据表”门禁：轮盘、轨道、参数图、行动列表、费用表、结算阶段这类高规则密度 UI 在实现前必须列出 `源文件/图片 -> 原文标签 -> 玩家提示卡短标签 -> UI短标签 -> 是否常驻`；缺来源不能先画占位内容。
- `design-system/games/qidahen.md` 明确当前 UI-only 合同：非 UI 区域空白但点名锚点不得留空，轮盘是独立屏幕 UI，纪年主态只常驻今年/下一年，抽牌/手牌/弃牌贴底，按钮必须保持可点击材质。
- `design-system/games/qidahen.md` 明确七大恨专属风格：明末纸本军议 UI、token、组件族语法、轮盘门禁和失败项，不再让通用 UI 建议覆盖真实素材风格。
