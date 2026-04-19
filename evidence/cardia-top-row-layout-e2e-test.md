# Cardia 顶部布局与默认尺寸 E2E 证据

## 测试目标

验证两件事：

- 矮屏视口下，顶部对手卡不会被裁出战场。
- 标准桌面视口下，Cardia 卡牌仍保持原版默认尺寸，不会被整体改小。

## 测试文件

- `e2e/cardia-test-scenario-api.e2e.ts`

## 实际执行

执行命令：

```powershell
npm run test:e2e:cleanup
node scripts/infra/run-e2e-command.mjs isolated e2e/cardia-test-scenario-api.e2e.ts --grep "窄高视口下顶部对手卡应完整显示在战场内|标准视口下卡牌尺寸应保持原版大小"
```

执行结果：

- `2 passed (1.1m)`

## 覆盖用例

- `窄高视口下顶部对手卡应完整显示在战场内`
- `标准视口下卡牌尺寸应保持原版大小`

## 关键断言

- 矮屏用例：
  - 战场容器 `data-testid="cardia-battlefield"` 可见。
  - 顶部对手卡与底部己方卡都在战场边界内。
  - 顶部对手卡没有被裁到视口外。

- 标准视口用例：
  - 1280x900 下卡牌边界框宽高保持原版尺寸范围。
  - 宽度断言范围：`104 ~ 108`
  - 高度断言范围：`158 ~ 162`

## 证据截图

矮屏布局截图绝对路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\cardia-test-scenario-api.e2e\窄高视口下顶部对手卡应完整显示在战场内\窄高视口下顶部对手卡应完整显示在战场内-cardia-top-row-layout-1280x640.png`

截图预览：

![Cardia 顶部布局 E2E 证据](../test-results/evidence-screenshots/cardia-test-scenario-api.e2e/%E7%AA%84%E9%AB%98%E8%A7%86%E5%8F%A3%E4%B8%8B%E9%A1%B6%E9%83%A8%E5%AF%B9%E6%89%8B%E5%8D%A1%E5%BA%94%E5%AE%8C%E6%95%B4%E6%98%BE%E7%A4%BA%E5%9C%A8%E6%88%98%E5%9C%BA%E5%86%85/%E7%AA%84%E9%AB%98%E8%A7%86%E5%8F%A3%E4%B8%8B%E9%A1%B6%E9%83%A8%E5%AF%B9%E6%89%8B%E5%8D%A1%E5%BA%94%E5%AE%8C%E6%95%B4%E6%98%BE%E7%A4%BA%E5%9C%A8%E6%88%98%E5%9C%BA%E5%86%85-cardia-top-row-layout-1280x640.png)

## 结果分析

- 现在的 Cardia 适配是“默认保持原版尺寸，小高度再降级”，不是把所有视口统一缩小。
- 1280x640 下顶部卡牌完整留在战场内，说明裁剪问题已修复。
- 1280x900 下卡牌宽高仍保持原版尺寸范围，说明默认视觉基线已恢复。
