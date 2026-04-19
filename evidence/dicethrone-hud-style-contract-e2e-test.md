# DiceThrone HUD 样式合同 E2E 证据

## 背景

本次回归表现为：

- `dicethrone` 左下生命条看起来只剩深色底壳，红色填充消失
- 右侧“下一阶段”按钮退化成接近裸文本，缺少金色按钮壳和阴影

根因不是旧浏览器 fallback 自己被展示，而是 Tailwind v4 产物链里关键 utility / 渐变阴影变量没有稳定进入最终 CSS。

## 验证命令

```bash
npm run build
npm run verify:dicethrone:style-contract
npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "样式合同应保留生命条渐变与下一阶段按钮实体外观"
```

## 证据截图

截图路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Local-match-HUD-样式合同应保留生命条渐变与下一阶段按钮实体外观\02-hud-style-contract.png`

![DiceThrone HUD 样式合同截图](../test-results/evidence-screenshots/dicethrone-simple-start.e2e/Local-match-HUD-样式合同应保留生命条渐变与下一阶段按钮实体外观/02-hud-style-contract.png)

## 肉眼观察结论

1. 左下角 `生命` 资源条存在明显红色渐变填充，且不是纯黑底壳；数字 `50` 仍位于红条内部右侧。
2. 右侧 `下一阶段` 是完整的金色实体按钮，带琥珀渐变和按钮壳，不是只有文字悬浮在背景上。
3. `投掷` 与 `确认` 两个按钮也保留了实体按钮视觉，说明这次不是单个按钮文案层渲染正常、背景层丢失，而是整组 HUD 按钮样式链恢复了。

## 计算样式合同

新增 E2E 断言了以下关键合同：

- `生命` 条 fill 元素存在
- `生命` 条 `backgroundImage` 包含渐变
- `生命` 条 fill 宽度大于 40px，避免只剩 0 宽空壳
- `下一阶段` 按钮存在
- `下一阶段` 按钮 `backgroundImage` 包含渐变
- `下一阶段` 按钮 `boxShadow` 不为 `none`
- `下一阶段` 按钮边框颜色不为透明

## 结论

当前修复已经把 DiceThrone HUD 从“样式回退态”拉回正式视觉态；后续如果 Tailwind 生成链或 legacy PostCSS 兼容链再次破坏这组合同，构建产物校验和本地 E2E 会直接报错。
