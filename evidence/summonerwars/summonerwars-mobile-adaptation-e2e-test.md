# 召唤师战争移动端适配 E2E 证据

## 本轮追加：平板点按单位或建筑查看血量（2026-07-11）

- 原始症状：召唤师战争桌面端通过悬浮查看单位和建筑血量；iPad / 平板没有悬浮能力，玩家应能直接点按棋盘对象查看血量。
- 规则核对：攻击阶段宣告的目标必须是单位或建筑卡牌；空格只用于召唤、移动、建造、推拉终点等位置选择，不能作为攻击目标。
- 交互边界：复用共享 App 触控模式 `useArmedActivation`。无悬浮设备第一次点按单位/建筑只聚焦并显示生命值，第二次点按同一对象才执行原有的选择、攻击或目标操作；不新增平板专用页面或规则分支。
- 桌面边界：桌面端仍通过悬浮显示生命值；普通点击不会让生命值常驻。
- 能力判断：除 `(pointer: coarse), (hover: none)` 外，棋盘对象还会读取真实输入事件的 `pointerType`；即使设备把媒体查询报告成桌面能力，触摸/触控笔第一次点按仍按 App 触控逻辑处理。

### 执行命令

```bash
npx vitest run src/games/summonerwars/__tests__/validate.test.ts src/hooks/ui/__tests__/useCoarsePointer.test.ts
node scripts/infra/run-e2e-command.mjs ci e2e/summonerwars/summonerwars.e2e.ts --grep "平板无悬浮能力时点按单位和建筑查看血量"
```

### 结果

- Vitest：52 条通过，其中包含“空格不能作为攻击目标”的规则回归断言。
- Playwright：1 条通过。
- 验证终端：`1180x820` 平板横屏，视口宽度高于 `1023px` 手机布局断点。
- 模拟能力：`pointer: coarse = false`、`hover: none = false`、`maxTouchPoints > 0`，用于覆盖“媒体查询像桌面，但真实输入是触摸”的移动端误报环境。
- 平板结果：首次点按己方单位显示生命值但不选中；第二次点按同一单位才执行选择；改点建筑后显示建筑生命值；点空格后关闭建筑生命值。
- 桌面结果：悬浮单位时生命值显示；单击立即执行原有选择，不进入平板的首次点按聚焦状态。

### 截图 1：点按单位显示血量

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\平板无悬浮能力时点按单位和建筑查看血量\20-平板点按单位-显示血量.jpg`
- 我实际看到：棋盘中央被点按的单位卡面显示 `3/3` 生命值徽章；棋盘、手牌和右侧阶段区位置不变。
- 判定：无悬浮平板可通过点按单位本体查看血量，提示没有遮挡主操作区。

### 截图 2：点按建筑显示血量

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\平板无悬浮能力时点按单位和建筑查看血量\21-平板点按建筑-显示血量.jpg`
- 我实际看到：被点按的蓝色建筑卡面显示 `10/10` 生命值徽章；此前单位的血量徽章已关闭。
- 判定：单位和建筑共享同一套点按查看逻辑，同时只保留当前对象的血量提示。

## 本轮范围与结论（2026-04-14）

- 本轮只验收 **PC 基线 + 手机横屏**，目标是修复召唤师战争移动端横屏下的手牌/HUD/阶段说明布局回归。
- 结论：基础流程与长按/阶段说明两条 E2E 均通过；从最新截图看，移动端主态已不再出现“手牌压住右侧 controls、阶段说明藏到手牌后面、棋盘缩在角上”的问题。
- 仍存在的非本轮布局问题：阶段说明文案缺 key，截图里仍显示 `phaseDesc.*` 文本。

## 一、执行记录

### 命令

```bash
npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌"
npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "移动横屏：长按放大与阶段说明在手机可达"
```

### 结果

- 基础流程：通过
- 长按放大与阶段说明：通过

## 二、主状态对照

### 1）PC 参考图
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：长按放大与阶段说明在手机可达\00-pc-reference-board.png`
- 我实际看到：PC 上棋盘占据中央主体，右侧阶段区与底部手牌围绕棋盘展开，右下弃牌堆独立存在，不与底部手牌重叠。
- 判定：可作为本轮移动端对照基线。

### 2）手机横屏主态
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：长按放大与阶段说明在手机可达\10-phone-landscape-board.png`
- 我实际看到：棋盘仍在中心，左下资源条、右上阶段列表、右中结束阶段按钮和右下弃牌堆还在同一套画面关系里；底部手牌已收窄，右边界停在右侧 HUD 之前。
- 判定：手机横屏主态已经摆脱“手牌压右侧 controls”的回归，和 PC 的主次关系基本一致。

## 三、关键交互证据

### 1）长按放大
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：长按放大与阶段说明在手机可达\11-phone-hand-magnify-open.png`
- 我实际看到：放大卡牌覆盖棋盘中央但没有把右侧 HUD 挤出屏幕；关闭按钮仍可见。
- 判定：长按放大链路可达，且不会把主操作区打散。

### 2）阶段说明面板
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：长按放大与阶段说明在手机可达\12-phone-phase-detail-open.png`
- 我实际看到：说明面板现在贴着右侧 HUD 显示，可直接看到，不再被底部手牌盖住；它没有再像旧版本那样往左伸进棋盘中央。截图里说明文本仍是 `phaseDesc.build.0 / phaseDesc.build.1`，说明布局已修好，但翻译 key 还缺。
- 判定：本轮布局验收通过；文案缺失不影响“面板可见性”结论，但不能说文案已完整。

### 3）Action Log 面板
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：长按放大与阶段说明在手机可达\13-phone-action-log-open.png`
- 我实际看到：action log 展开后会占用右侧 HUD 所在黑边区，并临时覆盖阶段列表/结束阶段按钮的一部分；但棋盘主体与底部手牌仍可见，面板本身没有出屏。
- 判定：这张图只能证明“action log 面板在手机横屏可打开且不出屏”，**不能**用来证明“展开 action log 后右侧主控件仍同时可操作”。

## 四、基础流程截图

### 1）起始主态
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\40-mobile-basic-flow-start.png`
- 我实际看到：底部 6 张手牌整体位于中央偏下，未再压到“结束阶段/弃牌堆”；右侧阶段列表完整显示在按钮上方。
- 判定：基础主态达标。

### 2）攻击后
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\40-mobile-basic-flow-after-attack.png`
- 我实际看到：攻击流程中，棋盘仍居中；底部手牌虽然偏左，但没有挤进右侧按钮列。
- 判定：基础流程中段达标。

### 3）魔力阶段后
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\41-mobile-basic-flow-after-magic.png`
- 我实际看到：右侧按钮列、弃牌堆和底部手牌维持稳定分区，没有出现新的遮挡；棋盘仍是主视觉中心。
- 判定：基础流程收口达标。

## 五、本轮实现层改动（仅 Summoner Wars）

- `src/games/summonerwars/Board.tsx`
  - 恢复移动横屏专用手牌宽度比 `--sw-hand-card-width-ratio: 0.145`。
  - 调整移动端阶段区 wrapper 的层级和位置，避免说明面板落到手牌后面。
  - 收紧移动端阶段区尺寸，不影响 PC。
- `src/games/summonerwars/ui/PhaseTracker.tsx`
  - 压缩 compact 模式高度与字级。
  - 让移动端阶段说明面板在右侧 HUD 内稳定显示。

## 六、真实读图结论

- 有效截图：`00-pc-reference-board.png`、`10-phone-landscape-board.png`、`11-phone-hand-magnify-open.png`、`12-phone-phase-detail-open.png`、`40-mobile-basic-flow-start.png`、`40-mobile-basic-flow-after-attack.png`、`41-mobile-basic-flow-after-magic.png`
- 有条件有效截图：`13-phone-action-log-open.png`（只证明 overlay 可达，不证明底层主控件不被覆盖）
- 本轮不再使用旧结论“阶段说明在右侧阶段条左边弹出”；当前实现与截图都显示它是在右侧 HUD 内可见。
