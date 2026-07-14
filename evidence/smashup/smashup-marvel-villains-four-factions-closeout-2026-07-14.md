# 大杀四方漫威反派四派系收口证据（2026-07-14）

## 范围

- 本轮对象：九头蛇、克里、邪恶大师、邪恶六人组。
- 图集来源：用户提供的漫威反派 9 x 6 atlas，前 49 格为有效卡面，后 5 格为空白 / 尾格。
- 正式资源：
  - `public/assets/i18n/zh-CN/smashup/cards/marvel_villains.png`
  - `public/assets/i18n/zh-CN/smashup/cards/compressed/marvel_villains.webp`
- 远端发布口径：本轮先把 PNG、WebP、manifest、代码、测试与 evidence 一并放入 PR；作者合并/发布后再补代表 CDN URL `HEAD 200`。

## 当前结论

| 模块 | 当前结论 | 证据 |
| --- | --- | --- |
| 静态牌组 | 已按九头蛇 11、克里 12、邪恶大师 12、邪恶六人组 14 个唯一卡面建表；四派实体牌数均为 20 | `src/games/smashup/__tests__/marvelVillainsResourceContract.test.ts` |
| 资源链 | 正式 PNG 与 WebP 已落地，根级 / i18n / Smash Up manifest 校验通过 | `npm run assets:validate` |
| 玩法行为 | 49 张唯一卡均有主动能力入口或持续规则注册；L2 行为覆盖四派代表机制 | `src/games/smashup/__tests__/abilities/marvel-villains.test.ts` |
| 派系状态 | 九头蛇、克里、邪恶大师、邪恶六人组已移除 `implementationStatus: 'in_progress'` | `src/games/smashup/ui/factionMeta.ts` |
| 真实入口 | 已从真实派系选择入口验证四派可见、共享图集加载、真实选秀开局与代表能力链 | `e2e/smashup/smashup-marvel-villains-four-factions.e2e.ts` |

## 逐派实现矩阵

| 派系 | 已覆盖机制 |
| --- | --- |
| 九头蛇 | 摧毁己方角色、按被摧毁力量抽牌、额外低力量角色额度、弃牌堆回收、佐拉 / 狂热献身持续力量修正、红骷髅摧毁触发抽牌。 |
| 克里 | 抽牌、额外行动、行动牌回收到牌库顶、行动打出计数力量修正、目标加力并抽牌、至高智慧行动触发加力。 |
| 邪恶大师 | VP 阈值力量 / 抽牌、摧毁换 VP、计分后 VP 与回牌库底、摧毁保护、统治世界计分后移动、厄运之兆空基地限制。 |
| 邪恶六人组 | 临界点降低、低临界点分支、基地神器移动、计分后回牌库底、特殊窗口行动限制、基地能力取消、改变力量到下个己方回合开始过期。 |

## 已通过命令

```powershell
npx vitest run src/games/smashup/__tests__/abilities/marvel-villains.test.ts
```

结果：1 个测试文件通过，10 tests passed。

```powershell
npx vitest run src/games/smashup/__tests__/marvelVillainsResourceContract.test.ts
```

结果：1 个测试文件通过，3 tests passed。

```powershell
npx vitest run src/games/smashup/__tests__/abilities/mega-troopers.test.ts -t "蓝骑士 POD"
npx vitest run src/games/smashup/__tests__/properties/coreProperties.test.ts -t "普通行动卡声明 playNeedsBase"
npx vitest run src/games/smashup/__tests__/abilities/steampunks.test.ts -t "华丽穹顶限制"
```

结果：均通过，用于回归持续力量过期、普通行动目标声明和基地限制相邻机制。

```powershell
npm run test:e2e:file -- e2e/smashup/smashup-marvel-villains-four-factions.e2e.ts
```

结果：2 passed。第一次运行曾因测试场景把多个目标放在同一基地导致卡牌重叠点击被拦截；已将代表目标分散到不同基地并重跑通过。

```powershell
npm run typecheck
openspec validate add-smashup-marvel-villains-four-factions --strict --no-interactive
npm run assets:validate
```

结果：均通过。

## 真实入口 E2E 截图

截图根目录：

```text
D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-marvel-villains-four-factions.e2e
```

关键截图：

- `派系选择页能看到九头蛇、克里、邪恶大师、邪恶六人组，并加载共享漫威反派图集\01-漫威反派四派-派系选择页共享图集可见.jpg`
- `四派系真实选秀后可开局，并完成九头蛇、克里、邪恶大师、邪恶六人组代表能力链\02-九头蛇-派系预览.jpg`
- `四派系真实选秀后可开局，并完成九头蛇、克里、邪恶大师、邪恶六人组代表能力链\03-邪恶大师-派系预览.jpg`
- `四派系真实选秀后可开局，并完成九头蛇、克里、邪恶大师、邪恶六人组代表能力链\04-邪恶六人组-派系预览.jpg`
- `四派系真实选秀后可开局，并完成九头蛇、克里、邪恶大师、邪恶六人组代表能力链\05-克里-派系预览.jpg`
- `四派系真实选秀后可开局，并完成九头蛇、克里、邪恶大师、邪恶六人组代表能力链\06-漫威反派四派-真实选秀开局完成.jpg`
- `四派系真实选秀后可开局，并完成九头蛇、克里、邪恶大师、邪恶六人组代表能力链\08-九头蛇万岁-献祭抽牌后.jpg`
- `四派系真实选秀后可开局，并完成九头蛇、克里、邪恶大师、邪恶六人组代表能力链\09-克里战斗狂怒-加力抽牌后.jpg`
- `四派系真实选秀后可开局，并完成九头蛇、克里、邪恶大师、邪恶六人组代表能力链\10-邪恶大师可接受损失-摧毁得VP后.jpg`
- `四派系真实选秀后可开局，并完成九头蛇、克里、邪恶大师、邪恶六人组代表能力链\11-邪恶六人组移动货物-基地神器移动后.jpg`

## 后置状态

- OpenSpec 玩法与 E2E 项已勾选；PR / 远端发布回查项仍待 PR 创建、作者合并或资源发布后收口。
- `runtimePromptRandomAudit` 与 `interactionTargetTypeAudit` 仍有历史派系失败；本批 `marvel_villains.ts` 已从相关失败列表中移除，未把历史失败计入本轮 blocker。
