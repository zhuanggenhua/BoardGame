# SmashUp 泰坦预览 E2E 证据

## 范围

- 页面：大杀四方派系选择详情页
- 场景：海盗派系详情中的泰坦预览
- 目标：确认泰坦预览不再空白，能实际加载卡图

## 执行方式

- 测试文件：`e2e/smashup-faction-selection-spacing.e2e.ts`
- 用例名：`海盗派系详情中的泰坦预览应加载真实卡图`
- 命令：

```bash
npm run test:e2e:ci:file -- e2e/smashup-faction-selection-spacing.e2e.ts "海盗派系详情中的泰坦预览应加载真实卡图"
```

## 关键截图

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-faction-selection-spacing.e2e\海盗派系详情中的泰坦预览应加载真实卡图\海盗派系详情中的泰坦预览应加载真实卡图-pirates-titan-preview-loaded.png`

## 肉眼观察

- 左侧“泰坦预览”区域已显示海怪克拉肯的完整卡图，不是空白框或纯底色占位。
- 卡图内能看到泰坦插画、英文标题 `The Kraken` 和中文覆盖文案，说明 renderer 已拿到有效 atlas 并完成渲染。
- 右侧普通派系卡预览也保持正常，说明这次修复没有把派系详情里的其他卡牌预览链路带坏。

## 结论

- 本轮回归点已修复：泰坦详情预览恢复为真实卡图加载。
