# Mage Wars 当前 UI 端到端覆盖审计

> 审计日期：2026-09-30
> 文档类型：`audit`
> 状态：`REVISE`
> 目标：检查当前 Mage Wars 运行时 UI 是否存在“有 UI、没有真实入口 E2E”的对象，并为每项建立直接覆盖或明确分类。

## 1. 本轮范围

- 游戏：`mage-wars`
- UI 真相源：`src/games/mage-wars/Board.tsx`、`src/games/mage-wars/ui/`
- E2E 真相源：`e2e/mage-wars/*.e2e.ts`
- 重点对象：法师魔杖、元素魔杖、选书页、组书编辑器、操作日志 / 撤回、公开视角返回、墙体牌面、效果骰和相关新增动作 dock。
- 不把教程截图单独当作法师魔杖或全量 Mage Wars 证明。
- 不把单测、DOM 存在、静态 `data-testid` 或旧截图单独当作真实入口通过。

## 2. 静态覆盖扫描

| 扫描项 | 结果 | 解释 |
| --- | ---: | --- |
| `src/games/mage-wars` 静态 `data-testid` | 153 | 当前运行时 UI / FX 标识总数 |
| 被 `e2e/mage-wars` 直接文字引用的静态 ID | 145 | 直接被 E2E selector / locator 引用 |
| 未被文字直接引用的静态 ID | 8 | 3 个运行时对象走间接锚点；5 个是单测 probe / mock |
| 运行时实际缺少 E2E 的对象 | 0（静态审计结论） | 见下方间接覆盖与分类 |

未直接文字引用的 8 个 ID：

- `mage-wars-back-to-self-view`：通过教程真实入口 `data-tutorial-id="mw-back-to-self-view"` 点击，并断言回到己方视角。
- `mage-wars-wall-object`：通过正式墙边 `mage-wars-wall-edge-*` 进入真实施放链，再断言墙牌预览和墙体状态。
- `mage-wars-toast-probe`：仅 `Board.fx.test.tsx` 测试宿主，用于读取 toast，不是玩家 UI owner。
- `mock-burst-particles`、`mock-card-preview`、`mock-damage-flash`、`mock-optimized-image`、`mock-summon-hybrid-effect`：仅单测 mock，不是正式运行时 UI。

## 3. 重点 UI 覆盖矩阵

| UI 对象 | 直接入口 / 真实动作 | E2E | 当前证据 | 当前结论 |
| --- | --- | --- | --- | --- |
| 法师魔杖目标选择、绑定法术、支付、快速重绑 | 正式双人牌桌点击准备区法师魔杖、己方法师、候选法术、第二次绑定 | `e2e/mage-wars/online-runtime.e2e.ts`：`正式页面法师魔杖施放和快速重绑覆盖法术选择 UI` | `02-法师魔杖-绑定选择-候选法术.jpg` 暴露弹层过大、候选本体不可读、内部 ID；当前旧证据失效 | `REVISE` |
| 元素魔杖目标选择、绑定法术、取消分支 | 正式双人牌桌点击元素魔杖、目标法师、候选法术、取消 | `e2e/mage-wars/online-runtime.e2e.ts`：`正式页面元素魔杖施放和快速重绑覆盖法术选择 UI`；取消分支在同文件后续测试 | 2026-09-30 当前运行截图 07-12 | `PASS` |
| 选书页标准起始书 | 正式 `/play/mage-wars?setupGate=true` 选择四本标准书并确认 | `e2e/mage-wars/mage-selection.e2e.ts`、`create-room-entry.e2e.ts` | `mage-selection.e2e.ts`：5 passed；含视口、素材比例、绑定法师和进入牌桌断言 | `PASS` |
| 组书编辑器 | 正式选书页进入新建、筛选、卡池、数量、导入、保存、编辑、删除、回到牌桌计划 | `e2e/mage-wars/mage-selection.e2e.ts`：组书编辑器完整用例 | 当前运行截图 29-42；真实牌桌计划态收口 | `PASS` |
| 操作日志 UI | 正式牌桌移动后打开日志面板，读取玩家可见记录 | `e2e/mage-wars/online-runtime.e2e.ts`：`正式页面操作日志与撤回 UI 覆盖真实移动、申请、同意和状态回退` | 2026-09-30 当前运行截图 13-16 | `PASS` |
| 撤回申请 / 审批 / 状态回退 | 正式双人牌桌 guest 申请、host 同意、服务端状态回到原区 | 同上 | 2026-09-30 当前运行截图 14-16；审批后丛林灰狼回到原区域 | `PASS` |
| 公开视角横幅与返回己方视角 | 正式教程牌桌点击对手眼睛、点击返回按钮、断言同一弃牌槽 owner 恢复 | `e2e/mage-wars/mage-wars-tutorial.e2e.ts`：`opponent-public-view` / `back-to-self-view` | 真实点击与 `data-mage-wars-public-view-*`、弃牌 owner 断言 | `covered` |
| 墙体牌面 | 正式牌桌选择墙边、施放墙法术、读取边界墙牌和视线 / 穿越伤害 | `online-runtime.e2e.ts` 墙体用例 | `mage-wars-wall-card-preview`、墙边状态、通行伤害和截图 | `covered` |
| 效果骰新 UI | 正式攻击点击来源与目标，读取原生 D12 CSS mesh、稳定面、原始值 / 修正值、燃烧 token | `online-runtime.e2e.ts`：`正式页面有效果骰近战攻击独立证据覆盖`；foundation runtime 另有稳定层断言 | 2026-09-30 同次运行 4 张截图 + 46 帧 GIF | `PASS` |
| 选中单位 / 法师动作 dock | 正式牌桌点击来源实体，再点击能力按钮和合法目标 | `online-runtime.e2e.ts` 群兽法杖、治疗之光、复原术、对象能力用例 | dock 可见、来源框、目标高亮、结果事件和截图 | `covered` |
| 卡牌放大 / 法师详情 | 正式牌桌或选书页点击检查入口，打开并关闭原始素材详情 | `foundation-board-runtime.e2e.ts`、`mage-selection.e2e.ts`、教程 E2E | overlay、source card id、关闭动作和素材断言 | `covered` |

## 4. 当前验证结果

### 已完成的本轮窄回归

```text
node scripts/infra/vitest-cli-safe.mjs run \
  src/games/mage-wars/__tests__/effectDieGeometry.test.ts \
  src/games/mage-wars/__tests__/Board.fx.test.tsx \
  src/games/mage-wars/__tests__/MageSelectionGate.test.tsx \
  --config vitest.config.core.ts --configLoader native \
  --pool forks --no-file-parallelism --maxWorkers 1 \
  --testTimeout 300000 --hookTimeout 300000
```

结果：`3 files passed / 80 tests passed`。

### 已存在的直接真实入口证据

- 法师魔杖黄金录屏：`evidence/mage-wars/mage-wars-golden-video-pass-20260924.json`
- Mage Wars 在线入口 manifest：`evidence/mage-wars/mage-wars-online-runtime-pass-manifest-20260923.json`
- 组书编辑器直接 E2E：`e2e/mage-wars/mage-selection.e2e.ts`
- 操作日志 / 撤回真实入口测试已存在于当前工作树：`e2e/mage-wars/online-runtime.e2e.ts`

## 5. 2026-09-30 当前运行收口

- `node scripts/infra/run-e2e-single.mjs default e2e/mage-wars/mage-selection.e2e.ts`：`5 passed`。
- 法师魔杖真实入口：`1 passed`，当前截图 6 张。
- 元素魔杖真实入口：`1 passed`，当前截图 6 张。
- 操作日志 / 撤回真实入口：`1 passed`，当前截图 4 张。
- 效果骰真实入口：启用 `MAGE_WARS_RECORD_FX_VIDEO=1` 后 `1 passed`，同次生成 4 张截图、46 帧 GIF。
- `evidence/mage-wars/mage-wars-ui-e2e-pass-manifest-20260930.json`：`PASS`，`open-verified-image --dry-run`：`MEDIA_COUNT=42`。

## 6. 图面核验（已被用户反馈推翻）

- 失败图：`02-法师魔杖-绑定选择-候选法术.jpg`。
- 直接问题：中央弹层过大，遮住竞技场和底部法术书牌列；候选项主要是文字行，不是清晰候选法术牌本体；画面泄漏 `beastmaster_apprentice` 等内部 ID。
- 现实影响：玩家第一眼无法判断要点哪张法术牌，持续决策对象被遮挡，旧图不能作为 UI 通过证据。
- 当前结论：整组 `REVISE`；E2E 绿灯只保留为功能诊断，不构成图面 PASS。

## 7. 当前结论

- 当前不能宣称法师魔杖 UI 图面通过；本条目标必须回到同一真实入口修复后重拍。
- 静态 UI / E2E 覆盖结论仍只表示“有真实测试链”，不表示选择态图面可用。
- 在逐图审计全部 `PASS` 前，不生成新的最终 manifest，也不交付 viewer。
