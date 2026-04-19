# Summoner Wars 基础流程 E2E 证据（2026-04-12）

## 范围

- 在线基础流程：召唤、移动、建造、攻击、弃牌
- 移动横屏基础流程：召唤、移动、建造、攻击、弃牌

## 运行命令

```bash
node scripts/infra/run-e2e-single.mjs ci e2e/summonerwars/summonerwars.e2e.ts "在线对局流程：召唤、移动、建造、攻击与弃牌"
node scripts/infra/run-e2e-single.mjs ci e2e/summonerwars/summonerwars.e2e.ts "移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌"
```

结果：两条用例均通过。

---

## 截图核对

### 1. 在线流程：攻击阶段

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线对局流程：召唤、移动、建造、攻击与弃牌\online-flow-after-attack.png`
- 我实际看到：
  - 棋盘中央出现近战攻击骰子动画，说明攻击步骤已真正触发，不是只选中了攻击者。
  - 顶部红色提示仍是“用最多3个单位进行攻击”，右下结束阶段按钮仍可见，说明流程还停留在攻击阶段收口前。
  - 场上己方与敌方单位都仍在真实棋盘位置，没有出现布局错位或 HUD 挡住主棋盘。
- 验收判断：**达标**。这张图证明在线基础流程中的“攻击”真实发生。

### 2. 在线流程：弃牌阶段收口

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线对局流程：召唤、移动、建造、攻击与弃牌\online-flow-after-discard.png`
- 我实际看到：
  - 顶部提示切到“弃牌获取魔力”，说明流程已从攻击推进到魔力/弃牌阶段。
  - 左下玩家魔力从 4 变为 5，说明弃牌换魔力已经写入结果，而不是只点了手牌。
  - 手牌区有一张牌处于半透明消失态，符合弃牌刚完成后的视觉收口。
- 验收判断：**达标**。这张图证明在线基础流程已经从攻击继续推进到弃牌完成。

### 3. 移动横屏流程：起始布局

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\40-mobile-basic-flow-start.png`
- 我实际看到：
  - 主棋盘完整落在横屏可视区内，没有左右溢出或底部被裁。
  - 右侧阶段栏、结束阶段按钮、弃牌轮盘都在视口内，可直接触达。
  - 手牌沿底部横向排开，虽然有重叠，但主要卡面仍可见，可继续操作。
- 验收判断：**达标**。这张图证明移动横屏基础布局能承载后续流程，不再是之前那种比例失衡导致的不可操作状态。

### 4. 移动横屏流程：攻击阶段

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\40-mobile-basic-flow-after-attack.png`
- 我实际看到：
  - 顶部提示为“用最多3个单位进行攻击”，中间出现攻击特效，说明移动横屏下攻击动作已触发。
  - 右侧阶段栏底部显示“攻击 2”，说明攻击次数已经消耗 1 次，权威状态已变化。
  - 棋盘、手牌、右侧阶段栏仍在同一缩放体系里，没有出现攻击后整体挤偏或局部放大失衡。
- 验收判断：**达标**。这张图证明移动横屏下攻击链路真实走通，而且攻击结果已经反映到 UI。

### 5. 移动横屏流程：弃牌阶段收口

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\41-mobile-basic-flow-after-magic.png`
- 我实际看到：
  - 顶部提示切到“弃牌获取魔力”，说明移动横屏流程已推进到魔力阶段。
  - 右侧弃牌轮盘中央显示 `1`，表示已选中 1 张弃牌；左侧魔力值为 5，和流程推进一致。
  - 手牌数量减少后仍然留在底部可视区内，没有被右侧栏或弃牌轮盘遮死。
- 验收判断：**达标**。这张图证明移动横屏基础流程已经完成到弃牌收口，而不是只停在攻击前。

---

## 结论

- **在线基础流程已通过**：召唤 → 移动 → 建造 → 攻击 → 弃牌 全链路打通。
- **移动横屏基础流程已通过**：同样完成召唤 → 移动 → 建造 → 攻击 → 弃牌，并且截图显示主棋盘/右侧阶段栏/底部手牌保持可操作。
- 因此，本轮“召唤师战争基础流程”可以按 **在线 + 移动横屏** 两条 E2E 证据收口。
