# 召唤师战争在线基础流程 E2E 证据（2026-04-12）

- RoomList 业务修正：`activeMatch` 存在时隐藏“创建房间”按钮，仅保留返回当前对局/离开或销毁入口。
- 关联静态校验：
  - `npx eslint src/components/lobby/RoomList.tsx e2e/src/components/lobby/RoomList.tsx src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts e2e/src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts`
  - `node scripts/infra/vitest-cli-safe.mjs run src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts --configLoader native`

## 在线基础流程 E2E（通过）

- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/summonerwars/summonerwars.e2e.ts "在线对局流程：召唤、移动、建造、攻击与弃牌"`
- 结果：通过
- 关键截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线对局流程：召唤、移动、建造、攻击与弃牌\online-flow-after-discard.png`

### 肉眼观察
1. 截图里可以同时看到棋盘单位、右侧阶段条、结束阶段按钮与底部手牌，说明房间创建、选阵营、进入正式对局后的主 UI 链路已打通。
2. 顶部红色提示为“弃牌获取魔力”，底部手牌里已有 1 张卡被抬起并半透明，说明流程已经真正走到魔力阶段的弃牌步骤，而不是停留在前面的召唤/移动/攻击中间态。
3. 右侧阶段条当前高亮在“召唤”下方的后续阶段区域，且“结束阶段”按钮仍可见，说明完整流程已从召唤推进过移动、建造、攻击并完成弃牌收口，满足“基础流程全链路端到端”验收标准。

## 额外补跑：移动横屏基础流程（未通过，不能作为收口证据）

- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/summonerwars/summonerwars.e2e.ts "移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌"`
- 结果：失败
- 失败点：`mobile-basic-flow-shell-ratios` 断言失败，表现为移动端 board-shell 与 PC 参考构图比例不一致。
- 当前判断：这说明召唤师战争的**在线核心流程**已经通过，但**移动横屏布局**仍有额外回归，暂时不能宣称移动端也一起收口。
