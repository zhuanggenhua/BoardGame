# 法师战争 foundation 完成自审

目标状态：active
当前目标：对 `add-mage-wars-foundation` 当前 worktree 的实施状态做完成前自审，区分已由当前证据证明的 foundation 范围、等待用户人工批准的视觉验收，以及明确不在本轮范围的事项。
非当前历史背景：旧 Open Design v1-v5、旧 HTML 预览、历史 media 生图阻塞和早期 PC 未过记录只作为事故 / 候选记录，不作为当前完成证据。
禁止自动接管：本文件不得把用户尚未明确批准的当前 PC 真实 Board/UI 截图写成 `user-approved`，也不得把 foundation 范围扩展到全 322 张法术、自由构筑、四人模式、豪华竞技场、完整 AI、教程、行动日志 UI 或撤回 UI。
更新时间：2026-08-14 18:57 +08:00

## 当前结论

| 项 | 裁决 | 当前证据 |
| --- | --- | --- |
| OpenSpec change 是否有效 | 已证明 | `openspec validate add-mage-wars-foundation --strict --no-interactive` 返回 `Change 'add-mage-wars-foundation' is valid` |
| tasks 是否全部勾选 | 已证明 | `openspec/changes/add-mage-wars-foundation/tasks.md` 0.1-3.7 均为 `[x]` |
| Mage Wars domain / Board / FX 单测 | 已证明 | 2026-08-01 02:23 +08:00 `npx vitest run src/games/mage-wars`：4 files / 15 tests passed |
| 修改文件 ESLint | 已证明 | 2026-08-14 18:56 +08:00 `npx eslint src/games/mage-wars/Board.tsx e2e/mage-wars/foundation-board-runtime.e2e.ts`：0 errors / 1 warning；warning 为既有 `ZoneOccupant` 未用参数，不阻塞本轮交互验收 |
| 真实入口桌面 / 移动横屏 E2E | 已证明 | 2026-08-14 18:57 +08:00 `node scripts/infra/run-e2e-command.mjs ci e2e/mage-wars/foundation-board-runtime.e2e.ts`：2 tests passed；来源 / 目标 / 移动格视觉语义、攻击骰实际透明度和竞技场范围均有断言 |
| 真实入口桌面选择态 / 攻击结算态截图 | AI 图面已通过；等待用户人工确认 | [evidence.md](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/mage-wars/foundation-board-runtime/evidence.md)；最新原图分别为 `e2e-desktop-board.png`、`e2e-desktop-attack-settlement.png`，截图时间 2026-08-14 18:57:15-16 +08:00 |
| 真实入口移动横屏截图 | secondary 技术证据，不替代 PC 人工验收 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\mage-wars\foundation-board-runtime\e2e-mobile-landscape-board.png`，截图时间 2026-08-14 18:57:22 +08:00 |
| 用户人工批准 | 未证明 | 当前对话尚未收到用户明确“通过 / 可以收口 / 认可此图”的确认 |
| 规则对象覆盖矩阵 | 已证明 foundation 行均已裁定 | `docs/games/mage-wars/design/generated/runtime-board-rule-object-coverage.md` 覆盖 2x3 竞技场、双方学徒法师、法术书、已计划法术、对手计划卡背、公开弃牌堆、骰子、token、来源、目标和阶段入口 |
| 资源链远端 / Android 包 | 已由资源链审计证明 | `docs/games/mage-wars/design/generated/runtime-resource-chain-audit.md` 记录服务器主源、Android file-index 和 ZIP 回查 |

## 需求逐项自审

| 需求 / 门禁 | 当前证据 | 裁决 |
| --- | --- | --- |
| 已获 proposal approval 后再实现 | `proposal.md` 与 `tasks.md` 0.1 记录用户 2026-07-26 批准 foundation 范围 | 通过 |
| 阶段 0 intake 完成 | `tasks.md` 1.1-1.8 全部勾选；`docs/games/mage-wars/intake/**` 存在规则、素材、布局和运行时资源计划 | 通过 |
| 2 人学徒模式 / 24 生命 / 2x3 学徒竞技场 | `domain-flow.test.ts`、`Board.tsx`、真实入口截图和规则对象覆盖矩阵 | 通过 foundation 层 |
| 学徒法术书与 91 张学徒卡 atlas/frame | `apprentice-spellbooks.md`、`apprentice-card-field-contract.md`、`apprentice-card-atlas-contract.md`、`apprentice-spell-atlases.json` | 通过 foundation 层 |
| 基础回合 / 计划 / 施法 / 移动 / 攻击 / 守卫 / 状态 / 胜负主链 | `src/games/mage-wars/__tests__/domain-flow.test.ts` 随 `vitest` 当前通过 | 通过 foundation 层 |
| 隐藏信息边界 | Board 对手已计划法术使用正式卡背；真实截图显示对手计划为卡背；完整隐藏结界揭示和响应窗口仍在 deferred 边界 | 通过 foundation 层 |
| 法术释放 FX | `src/games/mage-wars/ui/fxSetup.ts`、`fxRenderers.tsx`、`eventFxMapper.ts`、`useGameEvents.ts`；`event-fx-mapper.test.ts` 当前通过 | 通过 foundation 层 |
| 规则驱动 UI，不凭直觉省略对象 | `mage-wars-ui-design-memory`、`user-correction-traceability-ledger.md`、`runtime-board-rule-object-coverage.md`、2026-08-14 桌面选择/攻击结算图 | 通过当前 AI 审计；等待人工确认 |
| Open Design / 不生图路线 | 当前真实 Board/UI 实现与证据不依赖 `od media generate`；历史 media 生图失败只保留为事故记录 | 通过 |
| AI 先验收，再人工验收 | 2026-08-14 桌面选择/攻击结算图已由 AI 图面裁决 `PASS`，并已写入当前截图证据索引 | 等待用户人工确认 |

## 当前视觉验收自审

| 用户纠正 / 意图 | 当前实现截图裁决 |
| --- | --- |
| 法术书 6 张，要放大一点 | PASS。底部法术书显示 6 张大卡，卡面主体可读。 |
| 计划牌大小和法术书一致 | PASS。E2E 几何断言已计划法术与法术书卡宽高差不超过 2px。 |
| 右下悬浮圆不能压计划牌 | PASS。右下悬浮圆位于已计划法术外侧。 |
| 弃牌堆能看就显示正面 | PASS。右侧公开弃牌堆显示顶牌正面与数量。 |
| 骰子、token 不能省略 | PASS。攻击骰、效果骰、伤害 token、燃烧 token、守卫 / 行动 token 同屏可见。 |
| 开放式直选 / 场地本体高亮 | PASS。来源单位使用青蓝描边并抬起，敌方可攻击目标使用红色描边，移动格使用蓝色范围，攻击格使用红色范围；交互语义落在竞技场区域 / 场上对象本体上。 |
| 没有规则授权不要常驻确认 | PASS。未出现确认 / 执行 / 取消常驻按钮；`回合结束` 是真实阶段推进动作。 |
| 地图是底层，不要被底图支配 | PASS。法术书、已计划、弃牌和结算层允许覆盖低权重地图纹理，没有被挤出到不可读角落。 |

## 最新验证记录

```powershell
npx eslint src/games/mage-wars/Board.tsx e2e/mage-wars/foundation-board-runtime.e2e.ts
npx vitest run src/games/mage-wars
node scripts/infra/run-e2e-command.mjs ci e2e/mage-wars/foundation-board-runtime.e2e.ts
openspec validate add-mage-wars-foundation --strict --no-interactive
git diff --check -- .spec/skills/mage-wars-ui-design-memory/SKILL.md docs/games/mage-wars/design/reference/user-correction-traceability-ledger.md .spec/knowledge/README.md docs/games/mage-wars/design/generated/runtime-board-rule-object-coverage.md docs/games/mage-wars/design/generated/runtime-board-implementation-audit.md test-results/evidence-screenshots/mage-wars/foundation-board-runtime/evidence.md openspec/changes/add-mage-wars-foundation/tasks.md
```

- 本轮 ESLint：0 errors / 1 warning；warning 为既有 `ZoneOccupant` 未用参数，不影响本轮来源 / 目标 / 移动格 / 攻击骰交互验收。
- 历史 Vitest：通过，4 files / 15 tests passed。
- 本轮 E2E：通过，2 tests passed；来源 / 目标 / 移动格视觉语义、攻击骰实际透明度和竞技场范围断言通过，截图证据已回写到 `test-results/evidence-screenshots/mage-wars/foundation-board-runtime/evidence.md`。
- 历史 OpenSpec：valid。
- `git diff --check`：本轮 Mage Wars 改动无空白错误。

## 仍不得宣称完成的事项

- 不能宣称当前 PC 真实 Board/UI 截图已获用户人工批准；只能说 `AI_PASS / human approval pending`。
- 不能宣称完整 Mage Wars 已完成；全 322 张法术、自由构筑、四人模式、豪华竞技场、扩展法师、完整 AI、教程系统、行动日志 UI 和撤回 UI 都明确不在本轮 foundation 范围。
- 不能宣称完整隐藏结界揭示、揭示费用、反制响应窗口或移动取消未结算法术 / 攻击已经完成；当前只证明 foundation 的准备牌 / 对手计划隐藏边界。
- 不能把旧 Open Design v1-v5、旧 HTML 预览或历史 media 生图记录当作当前通过证据。

## 当前下一步

1. 等待用户对 2026-08-14 18:57:15-16 +08:00 的 PC 真实 Board/UI 原图明确人工确认。
2. 若用户确认通过，可把 `add-mage-wars-foundation` 视为 foundation 实施和验收链完成，并进入提交 / 后续独立 change 的准备。
3. 若用户指出不通过，必须保留用户原话，更新纠正账本和规则对象覆盖矩阵，再回到同一真实入口重构、重跑 E2E、重拍图、重审图。
