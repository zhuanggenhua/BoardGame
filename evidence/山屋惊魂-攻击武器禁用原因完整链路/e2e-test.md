# 山屋惊魂：攻击武器禁用原因完整链路

## 验证边界

- 本轮只收口“攻击声明里的武器选择可见性 / 禁用原因”切片：玩家攻击前能看到徒手、可用武器、刚获得不可用武器、已使用不可用武器，并且只能用合法武器进入目标选择和攻击结算。
- 本轮不外推为完整攻击系统、完整怪物攻击、完整远程牌面录入、完整作祟或完整山屋规则完成。

## 真相来源

- 规则合同：攻击时玩家声明是否使用武器；每次攻击最多一件；可选择不用；本回合刚获得武器不能用；已经用过的武器不能再次作为本回合攻击武器。
- 实现入口：`resolveAttackWeaponCardStatuses(core)` 保留全部攻击武器并返回可用 / 刚获得 / 已使用状态；Board 攻击武器条读取同一状态模型。
- 真实入口：`e2e/betrayal/non-p0-representative.e2e.ts` 中 “攻击武器禁用原因真实链路：保留刚获得和已使用武器但只允许可用武器攻击”。

## 自动化结果

- 领域 / Board 定向测试：`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "攻击武器|砍刀|匕首|指环|远程武器" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，11 passed / 191 skipped。
- Board 定向测试：`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "攻击武器|砍刀|匕首|指环|弩" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，5 passed / 88 skipped。命令退出码 0；teardown 后的 `socket hang up` / `AbortError` 是既有测试环境噪音，不是失败。
- E2E 静态检查：`npx eslint e2e/betrayal/non-p0-representative.e2e.ts`，0 errors。
- 真实入口 E2E：`npm run test:e2e:ci:file -- e2e/betrayal/non-p0-representative.e2e.ts "攻击武器禁用原因真实链路"`，1 passed。

## 截图证据

1. `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-攻击武器禁用原因完整链路\01-攻击前武器选择状态.jpg`
   - 我实际看到：牌桌处于作祟攻击前；武器条显示 `徒手` 默认选中、`砍刀`可选、`匕首`保留但提示“本回合新获得的武器不能立刻使用”、`指环`保留但提示“这把武器本回合已经使用”。
   - 验收结论：达到本切片要求；不可用武器没有从 UI 消失，玩家能看到为什么不能选。
2. `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-攻击武器禁用原因完整链路\02-选择砍刀后目标高亮.jpg`
   - 我实际看到：选择 `砍刀` 后，武器条显示砍刀为当前选择，叛徒所在角色 token 出现贴合高亮，并提示可点选开战。
   - 验收结论：达到本切片要求；可用武器仍能进入正式地图目标选择，不是只做了禁用提示。
3. `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-攻击武器禁用原因完整链路\03-砍刀攻击后反馈.jpg`
   - 我实际看到：攻击骰盘打开，反馈区显示“使用砍刀”和物理伤害结果；没有显示使用匕首或指环。
   - 验收结论：达到本切片要求；攻击结算使用的是合法选择的砍刀，刚获得 / 已使用武器没有参与结算。

## AI 图面核验

- 整屏 contact sheet：`D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-攻击武器禁用原因完整链路\_ai-audit-contact-sheet-20260725.jpg`。
- 武器条放大自检图：`D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-攻击武器禁用原因完整链路\_ai-audit-weapon-strip-zoom-20260725.jpg`。
- 核验结论：通过。整屏图证明三段真实页面链路，放大图确认第一张整屏图里确实能读到 `徒手 / 砍刀 / 匕首 / 指环` 以及匕首、指环的禁用原因。
