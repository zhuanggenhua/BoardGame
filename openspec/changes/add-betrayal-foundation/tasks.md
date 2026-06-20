# 山屋惊魂 foundation 实现任务

## 0. Approval Gate

- [x] 0.1 用户明确批准 `add-betrayal-foundation` proposal 的范围与边界
- [x] 0.2 完成 Step 1：先从规则提炼运行时 UI，确认必要元素和布局；不得再用“资料录入壳层”充当 UI 设计稿
- [x] 0.3 完成 Step 2：在 Step 1 同布局上生成不同风格稿，并明确选定唯一方向
- [x] 0.4 完成 Step 3：在已选定风格下生成不同界面稿，默认至少覆盖运行时，并补到角色选择 / 结算等界面
- [x] 0.5 补齐 `docs/games/betrayal/requirement-alignment.md`，形成需求对齐矩阵
- [x] 0.6 补齐 `evidence/betrayal/betrayal-architecture-review-2026-06-16.md`，确认当前为默认模式并记录后续拆分判断
- [x] 0.7 补齐 `design-system/games/betrayal.md`，冻结 UI 三步门禁、运行时优先方向与禁止项

## 1. 合同与资源落点

- [x] 1.1 锁定本轮真相源、PDF 可读性结论与首批候选资源范围
- [x] 1.2 明确当前 `public/assets/betrayal/` 只是 intake 暂存目录，正式运行时目录应为 `public/assets/i18n/zh-CN/betrayal/`
- [x] 1.3 把首批候选资源迁移到正式运行时目录并重生成 manifest

## 2. 新游戏 foundation skeleton

- [x] 2.1 建立 `src/games/betrayal/manifest.ts`、`thumbnail.tsx`、`game.ts`、`Board.tsx`
- [x] 2.2 建立 `public/locales/zh-CN/game-betrayal.json` 与 `public/locales/en/game-betrayal.json`
- [x] 2.3 通过 `npm run generate:manifests` 让 `betrayal` 进入客户端 manifest 体系

## 3. 验证与收口

- [x] 3.1 运行最小类型/测试验证，证明 skeleton 可被加载
- [x] 3.2 明确记录本轮未完成项：房间板块裁图、楼层板、OCR/人工录规则、正式玩法
- [x] 3.3 运行 `openspec validate add-betrayal-foundation --strict --no-interactive`
