# Smash Up 泰坦触发反馈收口（2026-04-14）

## 覆盖反馈
- `69db0d5009efdb7249bd5329` — `smashup::titan-trigger-on-power-change`
- `69db213209efdb7249bd5387` — `smashup::titan-trigger-on-power-change`

## 结论概览
- `69db0d5009efdb7249bd5329`：**resolved**
- `69db213209efdb7249bd5387`：**closed（规则正常 / 误读）**

---

## 1. `69db0d5009efdb7249bd5329` 根因与修复

### 用户反馈
> 打出让自己随从攻击力上升的战术后并不能让恐龙的泰坦发动效果

### 根因
`Fort Titanosaurus` 之前只在 `onActionPlayed` 且 `ACTION_PLAYED.payload.targetMinionUid` 已经直接存在时，才会起“给随从/泰坦放置 +1 标记”的后续交互。

但恐龙的两类加力量战术并不都走这条路径：
- `dino_augmentation_pod`：先打出战术，再通过交互选择目标随从，最后在 handler 中 `addTempPower`
- `dino_howl_pod`：直接对所有己方随从批量 `addTempPower`

因此原实现会漏掉“**行动打出后，真正的加力量目标在后续交互或批量效果里才确定**”的场景，导致玩家看到“力量确实加了，但泰坦没触发”。

### 修复方式
本轮把 Fort Titanosaurus 的后续交互抽成共享入口 `queueFortTitanosaurusOngoingChoice(...)`，并补到三条真实触发链：
1. 原有 `onActionPlayed` 的直接目标随从场景
2. `dino_augmentation` 交互选定目标后的 handler
3. `dino_howl` 对多个己方随从批量加力量后的 onPlay 结果

同时把后续交互从“只能处理单目标”扩成“**单次提示里列出所有本次被影响的己方随从**”，避免 `dino_howl` 这类批量效果重复弹多个提示。

### 本轮验证
```powershell
npx vitest run src/games/smashup/__tests__/smashup.smoke.test.ts -t "Fort Titanosaurus|克苏鲁"
```
- 通过
- 覆盖：
  - `Fort Titanosaurus 会在 dino_augmentation 交互选中己方随从后起持续交互`
  - `Fort Titanosaurus 会在 dino_howl 影响多个己方随从时只创建一个选择提示`

```powershell
npx vitest run src/games/smashup/__tests__/factionAbilities.test.ts -t "dino_augmentation|dino_howl"
```
- 通过
- 确认恐龙原有 onPlay/交互链未被本次修复破坏

```powershell
npx eslint src/games/smashup/abilities/titans.ts src/games/smashup/abilities/dinosaurs.ts src/games/smashup/__tests__/smashup.smoke.test.ts
```
- 通过（0 errors，warnings 为仓库既有/可忽略级别）

### 收口判断
本条是**真实 bug**，且已由新的 smoke 覆盖直接证明：
- `dino_augmentation` 选中目标后，Fort Titanosaurus 现在会起后续选择
- `dino_howl` 同时影响多个己方随从时，只会起一个包含全部合法目标的选择提示

---

## 2. `69db213209efdb7249bd5387` 规则复核

### 用户反馈
> 好像发泰坦效果也会增加

### 规则与实现核查结果
克苏鲁泰坦（`cthulhu_cthulhu_titan`）规则文本是：
- **持续**：在你**打出**或**抓**疯狂牌后，为此泰坦放置 +1 战力标记
- **天赋**：抓 1 张疯狂牌，或者把你手中的 1 张疯狂牌交给另一位玩家

当前实现与规则一致：
- `MADNESS_DRAWN` → 加对应数量标记
- `ACTION_PLAYED` 且打出的就是 `special_madness` → 加 1 标记
- `CARD_TRANSFERRED`（把疯狂牌交给别人）→ **不会**加标记

仓库现有 smoke 也已经断言：
```powershell
npx vitest run src/games/smashup/__tests__/smashup.smoke.test.ts -t "Fort Titanosaurus|克苏鲁"
```
其中：
- `克苏鲁在场时你抽疯狂卡后按抽取数量获得力量标记` 通过
- `克苏鲁在场时你打出疯狂卡后获得 1 枚力量标记` 通过
- `克苏鲁泰坦天赋在只有转交分支时会起目标交互并把疯狂卡交给对手` 通过

最后一条用例对应的真实语义就是：**转交疯狂牌不会给克苏鲁加标记**。

### 反馈包截图复核
已实际查看截图：
- `D:/gongzuo/webgame/BoardGame/temp/feedback-closeout/2026-04-13T16-09-31-728Z/images/69db213209efdb7249bd5387-01.jpg`

肉眼观察：
1. 右侧 `R'lyeh` 基地上的克苏鲁泰坦右上角计数为 **0**。
2. 截图中看不出“转交疯狂牌后仍额外加了标记”的证据。
3. 这与当前代码和 smoke 断言一致，说明该反馈更像**规则误读或对瞬时表现的误解**，而不是已证实的状态层 bug。

### 收口判断
本条不支持按 bug 继续修复，按**规则正常 / 误报关闭**处理更合适。

---

## 3. 本轮直接改动文件
- `D:/gongzuo/webgame/BoardGame/src/games/smashup/abilities/titans.ts`
- `D:/gongzuo/webgame/BoardGame/src/games/smashup/abilities/dinosaurs.ts`
- `D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/smashup.smoke.test.ts`

## 4. 最终裁定
- `69db0d5009efdb7249bd5329` → **resolved**
- `69db213209efdb7249bd5387` → **closed**
