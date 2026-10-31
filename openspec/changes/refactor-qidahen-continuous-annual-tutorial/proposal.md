# Change: 重构七大恨连续年度交互教程

## Why
旧教程以分散演示、预设局面和重复提示承接机制，没有让玩家从正常开局完成核心回合、战斗与季节结算。用户已明确授权彻底重构，并要求包含年中、新年、来源先于目标的进攻、真实掷骰和完整验证后提供查看器。

## What Changes
- 将正式教程收为一局连续课程，先复演合法正常对局，再安排当前决策所需的提示；仅在初始状态固定合法牌序及骰序。
- 统一正式落点与年度选择的结算职责，维护、耗损、纪年费用与人物选择消费实际实体和正式权限，退休旧自动年度结算链。
- 进攻依来源、具体部队、目标依次选择；地图使用真实地区边界，合法候选保持可见，手牌复用共享放大镜。
- 编排炮骑步真实物理投掷、停稳结果与战后选择；提示避让地区、兵牌、控制标记和当前正式操作。
- 跑完整桌面、手机横屏及进度生命周期，逐图和录像私审，再通过项目证据校验与查看器交付。

## Impact
- Affected specs: tutorial-engine（增加七大恨课程的产品要求，不改通用教程规范正文）。
- Affected code: src/games/qidahen/annualTutorial.ts、tutorial.ts、tutorialSetup.ts、game.ts、domain/index.ts、domain/turnResolution*、seasonTasks.ts、chronology*、wheelDispatchDraft.ts、ui/QidahenTurnChoicePanel.tsx、ui/useQidahenTurnInput.ts、ui/QidahenBattleRoll*、ui/useQidahenBattlePresentation.ts、ui/battleDiceAppearance.ts、ui/QidahenHandScrollControls.tsx、ui/handInteractionView.ts、ui/MapViewportControls.tsx、ui/mapRegionFocus.ts、src/engine/systems/TutorialSystem.ts、src/lib/dice-box-threejs/engine.ts、scripts/infra/e2e-port-config.js，以及对应语言包、行为测试与真实入口 E2E。
- 正式规则及来源争议仍以作者总账及规则来源记录为准；本文件不复制规则正文。
- 用户已在当前会话授权检查、提交、推送与部署；发布状态以 Git、CI 和生产回查为准。
