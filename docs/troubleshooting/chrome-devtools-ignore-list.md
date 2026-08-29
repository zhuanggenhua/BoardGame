# Chrome DevTools 噪声过滤

用于减少 React、Sentry、动画库等框架堆栈对排查的干扰。现实目标是让控制台优先显示项目业务代码位置，而不是被 `commitPassiveMountOnFiber`、`recursivelyTraversePassiveMountEffects` 等框架调用栈淹没。

## 推荐设置

这是浏览器级设置，配置一次后对本机 Chrome 生效：

1. 打开 Chrome DevTools。
2. 按 `F1` 打开设置。
3. 进入 `Ignore List`。
4. 启用 `Enable Ignore Listing`。
5. 启用 `Automatically add known third-party scripts to ignore list`。
6. 追加模式：

```text
/node_modules/
/react-dom/
/@sentry/
/framer-motion/
```

## 效果

配置前可能看到大量框架栈：

```text
commitPassiveMountOnFiber @ react-dom_client.js:11033
recursivelyTraversePassiveMountEffects @ react-dom_client.js:11010
commitPassiveMountOnFiber @ react-dom_client.js:11201
...
[PromptOverlay] 交互详情: { ... }
```

配置后应优先看到业务栈：

```text
交互选项为空 (pirate-broadside)
  at PromptOverlay (PromptOverlay.tsx:215)
  at Board (Board.tsx:89)
```

## 项目内辅助

### logger 工具

`src/lib/logger.ts` 会尽量过滤框架堆栈，只保留业务上下文。旧用法示例：

```ts
import { logger } from '@/lib/logger';

logger.error(
  '交互选项为空',
  { interactionId: 'xxx', source: 'yyy' },
  ['检查能力源码', '确认是否需要 optionsGenerator'],
);

logger.debug('原始数据', data1, data2);
```

当前接口以实际源码为准；不要为了适配旧文档新增第二套 logger。

### Error.stackTraceLimit

旧文档记录项目曾在开发环境限制堆栈深度：

```ts
if (import.meta.env.DEV) {
  Error.stackTraceLimit = 10;
}
```

当前是否仍存在要看 `src/main.tsx` 或等价入口。

## 临时控制台过滤

如果只想临时过滤当前控制台，可在过滤框输入：

```text
-react-dom -@sentry -framer-motion -commitPassive -recursivelyTraverse
```

缺点是刷新或换环境后需要重新输入，不适合作为团队长期方案。

## 排查边界

- Ignore List 只减少噪声，不会修复代码错误。
- 框架栈被隐藏后，仍要回到用户可见症状、真实入口和业务调用栈定位。
- 如果错误只剩压缩文件或第三方栈，先确认 source map、构建模式和运行环境。
