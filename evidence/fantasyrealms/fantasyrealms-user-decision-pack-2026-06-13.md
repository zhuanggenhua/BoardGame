# Fantasy Realms 当前保留/合并决策包（2026-06-13）

## 一句话结论

现在不是“必须删哪边”。当前最小风险做法是：**正式运行版本先继续用你已经认可过的那版牌桌；另一套正在继续演化的新桌面版先完整保留为候选，不删、不并入正式实现。**

## 先直接回答你最关心的三件事

1. **这不是全部都只能二选一。**
   - 真正只能单选的，只是“正式跑在幻想国度里的那套牌桌 UI / 交互 / 对应验收口径”。
2. **现在可以全部保留的，不少。**
   - 新桌面版代码本身可以继续保留为候选。
   - 历史截图、审计文档、过程说明、比较文档都可以继续保留。
   - 已经证明不冲突的小项，可以单独吸收，不需要跟整套新桌面版绑死。
3. **现在不能两边同时生效的，只有正式入口那一层。**
   - 同一个正式牌桌、同一套正式提示语义、同一套正式验收链，在同一时刻只能先认一套。

## 你现在只需要决定的一句话

是否同意下面这句：

**“正式版本先保留你已认可的通过版本；新桌面版先整体保留为候选，不删，等后面单独审完再决定要不要翻正。”**

我的推荐：**同意这句。**

## 为什么我推荐这个

- 你已经认可过一套通过图，它能锁定一条明确的正式基线。
- 剩下的变化不是零碎边角，而是另一整套桌面版继续往前演化。
- 现在直接吞进去，等于把“已认可正式版”替换成“还没再次确认的新正式版”。
- 但这不等于要删掉新桌面版。它完全可以继续留着，后面再单独审。

## 如果现在改选另一边，会发生什么

- Fantasy Realms 的正式牌桌会直接切到新的桌面版。
- 与它绑定的提示文案、自动化验收口径、截图判断标准也会一起切过去。
- 后面再看问题时，就不能再默认以你已认可那版为正式真相，而要改成按新桌面版继续审。

## 哪些东西现在可以全部保留

- 新桌面版代码，作为候选继续留在当前专项工作树或后续整理集合里。
- 历史截图、evidence、审计文档、过程说明、比较文档。
- 这次已经确认与正式牌桌基线不冲突的小项，例如缩略图入口、规则正文补全、manifest 完整性校验。

## 哪些东西现在不能两边同时生效

- 正式牌桌本体。
- 与正式牌桌绑定的交互提示口径。
- 与正式牌桌绑定的自动化验收链。

## 这一轮真正待裁决的内容，按现实含义其实只有 4 组

1. **正式牌桌本体**
   - 这是唯一真正需要“先认哪一边”的部分。
2. **绑定新交互的提示文案**
   - 只有当正式牌桌切到新桌面版时，才应该一起翻正。
3. **绑定新桌面版的验收链**
   - 这是在证明新桌面版，而不是独立产品功能。
4. **解释这些变化的过程文档**
   - 有价值，但它们本身不是正式产品画面。

## 你如果现在不想删任何一边，也可以

可以。当前完全存在一条低风险路径：

- **不删任何一边**
- **正式版本继续用已认可通过版**
- **新桌面版继续保留为候选**
- **过程材料全部保留**

这条路径不会强迫你现在就做“全删 / 全吞 / 全面翻正”的决定。

## 附录：技术映射

### A. 正式牌桌本体

- `src/games/fantasyrealms/Board.tsx`
- `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`

### B. 绑定新交互的提示文案

- `public/locales/en/game-fantasyrealms.json`
- `public/locales/zh-CN/game-fantasyrealms.json`

### C. 绑定新桌面版的验收链

- `e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai-golden.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts`
- `e2e/fantasyrealms/helpers/fantasyrealmsOnlineAi.ts`

### D. 过程说明

- `design-system/games/fantasyrealms.md`
- `docs/games/fantasyrealms/design/README.md`

### 证据入口

- `evidence/fantasyrealms/fantasyrealms-approved-ui-merge-status-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-dirty-worktree-recommendations-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-remaining-decision-batches-2026-06-13.md`

## 自审结果

- 不看代码也能先知道：这件事**不是全部二选一**。
- 不看文件名也能先知道：**哪些能全保留，哪些只是正式入口不能双生效**。
- 用户现在只需要判断一句话，而不是先理解 11 个文件。
- 文档里已经明确写出：**存在“先不删任何一边，只冻结正式入口”的低风险路径。**
