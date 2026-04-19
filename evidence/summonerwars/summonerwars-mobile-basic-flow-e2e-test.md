# 召唤师战争移动端基础流程 E2E 证据

- 用例：`SummonerWars › 移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌`
- 执行命令：`npm run test:e2e:ci:file -- summonerwars.e2e.ts "移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌"`
- 执行日期：2026-04-11

## 关键截图与观察

### 1) 手机横屏基础流程开局
- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\40-mobile-basic-flow-start.png`
- 观察：
  - 手牌区在底部居中，5 张手牌可直接看见，未被左右边界截断。
  - 地图主战区居中可见，左下玩家资源区与右侧阶段控制区未遮挡手牌。
  - 结束阶段按钮在视口内可直接点击。
- 结论：达到移动端“可触达手牌 + 关键按钮可见”的验收标准。

### 2) 魔力阶段弃牌后
- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\41-mobile-basic-flow-after-magic.png`
- 观察：
  - 弃牌后剩余手牌仍完整显示在视口内，没有被底部或右侧裁切。
  - 阶段按钮列与弃牌确认入口仍位于屏幕内侧，没有被挤出。
- 结论：弃牌后布局依旧稳定，满足“操作完成后手牌仍可达”的验收标准。
