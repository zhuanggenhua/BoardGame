# Smash Up 老派系 OR / 二选一交互 E2E 证据（2026-05-03）

## 范围

本轮确认并补齐的老派系 OR / 二选一交互：

1. `wizard_neophyte`
2. `zombie_walker`
3. `alien_scout_return`

已确认仓库内原本就有端到端覆盖的老派系相关 OR / 可选分支：

- `trickster_gnome`：`e2e/smashup/smashup-gnome-skip.e2e.ts`
- `robot_hoverbot`：`e2e/smashup/smashup-robot-hoverbot*.e2e.ts`、`e2e/smashup/smashup-multistep-misc.e2e.ts`
- `pirate_king_move`：`e2e/smashup/smashup-complex-multi-base-scoring.e2e.ts`

## 本轮新增 / 更新测试

文件：

- `e2e/smashup/smashup-gameplay.e2e.ts`

新增用例：

1. `老派系 OR：Wizard Neophyte 可选放入手牌或作为额外行动打出，并能走完整额外行动链路`
2. `老派系 OR：Zombie Walker 可选弃掉或放回牌库顶，并能走完整弃牌分支`
3. `老派系 OR：Alien Scout 计分后可选返回手牌或留在基地，并能走完整返回手牌链路`

## 实际执行

### ESLint

```bash
npx eslint e2e/smashup/smashup-gameplay.e2e.ts
```

结果：0 errors（仅保留仓库既有 `no-explicit-any` warnings）

### E2E

```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-gameplay.e2e.ts "老派系 OR"
```

结果：3 passed

## 截图证据与肉眼结论

### 1. Wizard Neophyte

#### A. 提示出现

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\老派系-OR：Wizard-Neophyte-可选放入手牌或作为额外行动打出，并能走完整额外行动链路\legacy-or-wizard-neophyte-prompt-visible.png`

肉眼观察：

- 画面中央明确显示牌库顶行动卡 **Mystic Studies / 秘术学习** 本体，不是只剩文案。
- 下方同时存在两个按钮：`放入手牌`、`作为额外行动打出`，符合 OR 二选一交互。
- 左侧基地上能看到已打出的 `Neophyte`，说明这是其真实打出后触发的链路。

验收判断：

- 达标；截图直接证明 `wizard_neophyte` 不是自动结算，而是玩家在两条正常效果之间二选一。

#### B. 选择“作为额外行动打出”后

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\老派系-OR：Wizard-Neophyte-可选放入手牌或作为额外行动打出，并能走完整额外行动链路\legacy-or-wizard-neophyte-play-extra-resolved.png`

肉眼观察：

- 右下弃牌区可见 `Mystic Studies / 秘术学习` 本体，说明它已被实际打出，而不是留在牌库顶或回到手牌。
- 底部还可见后续两张牌（`First Mate`、`Invader`）留在手牌区域，说明牌库顶行动卡已经被消耗，其余卡还在。
- 交互按钮已消失，链路已收口。

验收判断：

- 达标；截图与状态断言共同证明“额外行动打出”分支真实执行完成。

---

### 2. Zombie Walker

#### A. 提示出现

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\老派系-OR：Zombie-Walker-可选弃掉或放回牌库顶，并能走完整弃牌分支\legacy-or-zombie-walker-prompt-visible.png`

肉眼观察：

- 画面中央明确显示牌库顶随从 `First Mate / 大副` 本体。
- 下方同时存在 `弃掉` 与 `放回牌库顶` 两个按钮。
- 左侧基地上可见已打出的 `Walker`，说明这是其真实能力链路。

验收判断：

- 达标；截图直接证明 `zombie_walker` 是正常 OR 选择，而不是写死为单分支。

#### B. 选择“弃掉”后

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\老派系-OR：Zombie-Walker-可选弃掉或放回牌库顶，并能走完整弃牌分支\legacy-or-zombie-walker-discard-resolved.png`

肉眼观察：

- 右下弃牌区可见 `First Mate / 大副` 本体，且弃牌计数为 `1`。
- 中央选择弹层已经关闭。
- 牌库顶那张被看的牌不再停留在中央浮层。

验收判断：

- 达标；截图直接证明“弃掉”分支已经实际落入弃牌堆。

---

### 3. Alien Scout

> 这条链路为了同时满足“真实返回手牌”与“真实看得到回手结果”，测试场景使用了 **两个侦察兵同时触发**：先在“强制效果顺序选择”里点第一个侦察兵，再在第二个侦察兵仍待处理时抓取第一个侦察兵已经回手的真实 UI。

#### A. 第一个侦察兵的返回手牌提示

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\老派系-OR：Alien-Scout-计分后可选返回手牌或留在基地，并能走完整返回手牌链路\legacy-or-alien-scout-prompt-visible.png`

肉眼观察：

- 顶部明确出现 `侦察兵：基地记分后，是否将此侦察兵返回手牌？`
- 基地上的侦察兵本体被高亮出来，可直接点击；这符合该能力真实 UI，不是伪造的双按钮弹窗。
- 仅有 `留在基地` 按钮作为“不返回”分支，说明“返回手牌”分支由点击随从本体触发。

验收判断：

- 达标；截图证明 `alien_scout_return` 的真实交互形态就是“点随从返回 / 点按钮不返回”。

#### B. 点击第一个侦察兵后，卡已真实回到手牌

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\老派系-OR：Alien-Scout-计分后可选返回手牌或留在基地，并能走完整返回手牌链路\legacy-or-alien-scout-return-in-hand.png`

肉眼观察：

- 截图本体直接就是回到手牌区后的 `Scout / 侦察兵` 卡牌，不是日志、不是调试文本。
- 卡面内容清晰可见，说明返回手牌结果已经真实渲染到 UI。
- 这张图是在第二个侦察兵仍待处理时截取，因此不是靠回合结束后补拍或伪造状态。

验收判断：

- 达标；这是本轮最关键的“结果截图”，直接证明所选分支已经把侦察兵放回手牌。

#### C. 第二个侦察兵处理完后，整条计分链收口

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\老派系-OR：Alien-Scout-计分后可选返回手牌或留在基地，并能走完整返回手牌链路\legacy-or-alien-scout-return-resolved.png`

肉眼观察：

- 基地方案 / 返回手牌提示已经消失，说明交互没有卡死在中间态。
- 画面已回到下一阶段主棋盘，记分后的基地清空。
- 右下只剩本次计分后进入弃牌区的 `Archmage / 大法师`，没有残留交互浮层。

验收判断：

- 达标；截图证明侦察兵 OR 分支执行后，后续队列也已完整收口，没有留下悬空 prompt。

## 结论

老派系里**确实存在 OR / 二选一效果**，不是只有仙灵泰坦这一条：

- 巫师：`wizard_neophyte`
- 僵尸：`zombie_walker`
- 外星人：`alien_scout_return`

其中本轮已补齐直接端到端覆盖的是：

- `wizard_neophyte`
- `zombie_walker`
- `alien_scout_return`

所以当前结论是：

1. **OR 不是仙灵独有机制**，老派系里本来就有。
2. **老派系缺的直连 E2E 已补上**。
3. Alien Scout 这条还额外证明了其真实 UI 不是“双按钮弹窗”，而是：
   - 点侦察兵本体 = 返回手牌
   - 点 `留在基地` = 不返回
