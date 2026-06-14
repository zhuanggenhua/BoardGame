# Fantasy Realms 剩余待裁决批次（2026-06-13）

## 当前结论

在继续复查后，上一轮剩余的 `11` 个文件：

- 没有任何一个已经和 `fantasyrealms` worktree 当前版一致
- 也没有再出现“只差一行、且与通过 UI 无关”的新可吸收小项

所以当前可以明确说：

- **可直接自动吸收的安全小项，已经基本吸完**
- 剩下这 `11` 个文件都需要后续统一拍板

## 建议按 4 个批次决策

### 批次 A：UI 真体

这批一旦动，就是直接接受 dirty worktree 的下一版桌面真相。

- `src/games/fantasyrealms/Board.tsx`
- `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`

推荐口径：

- 默认继续 `保留 committed 线`
- 只有当你明确要接受 dirty worktree 当前 UI 方向时，才整批吸收

原因：

- `Board.tsx` diff 量仍然极大：`1097 insertions / 747 deletions`
- 配套 foundation 测试已经跟着那版 UI 合同一起改了
- 这不是“修个边角”，而是整套交互 / 壳层 / 动效 / 命名一起偏移

### 批次 B：交互文案合同

这批本身不改布局，但它们直接承认 dirty UI 的交互语义。

- `public/locales/en/game-fantasyrealms.json`
- `public/locales/zh-CN/game-fantasyrealms.json`

推荐口径：

- 默认继续 `保留 committed 线`

原因：

- 新增的是 `deckCueDraw`、`drawChoiceHint`、`confirmDiscardHint` 这类提示
- 它们在语义上绑定：
  - 点左上牌库
  - 先点对象再确认
  - 双人开局先摸 `2` 张
- 如果先吸文案，等于先认了这套 dirty 交互合同

### 批次 C：E2E / helper 验证链

这批是 dirty 当前 UI 的证明链，不应先于 UI 真体落地。

- `e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai-golden.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts`
- `e2e/fantasyrealms/helpers/fantasyrealmsOnlineAi.ts`

推荐口径：

- 默认继续 `保留 committed 线`

原因：

- 这里面已经系统性切到了 dirty 当前实现的术语和行为：
  - `stacked-layout` -> `compact-layout`
  - `抓一张牌` -> 牌库主按钮 / `从牌库摸 2 张并弃 1 张`
  - 新动效类名
  - 首页真实建房入口全流程
- 尤其 `fantasyrealms-online-basic.e2e.ts` 差异最大：
  - `644 insertions / 79 deletions`
- 这批不只是测试文本改名，而是在证明另一套更往前走的当前实现

### 批次 D：设计/规范解释文档

这批不是产品实现真体，但它们在解释 dirty 当前交互为何成立。

- `design-system/games/fantasyrealms.md`
- `docs/games/fantasyrealms/design/README.md`

推荐口径：

- 默认先单列，不并入“通过 UI 自动吸收集合”

原因：

- 它们新增的重点是：
  - 交互来源裁定状态
  - 当前实现只算待裁定交互，不算正式视觉真相
  - `compact-landscape` 命名和证据口径
- 这些内容本身有价值
- 但它们是在给 dirty worktree 当前阶段“补解释”，不是 artifact 通过 UI 本体

## 现在最小风险的统一拍板方式

如果要最快收口，建议你后续直接按下面 4 选项批：

1. `批次 A 保留 committed 线`
2. `批次 B 保留 committed 线`
3. `批次 C 保留 committed 线`
4. `批次 D 先单列，不并实现`

如果你想改成接受 dirty 当前版，也最好按这 4 批单独翻转，而不是一次性整包吞。

## 一句话结论

到这一步，能自动吸收的安全边角已经基本收完；剩余 `11` 个文件全都属于“接受就会承认 dirty 当前 UI / 交互 / 验证链”的范围，已经不适合 agent 再替你自动拍板。  
