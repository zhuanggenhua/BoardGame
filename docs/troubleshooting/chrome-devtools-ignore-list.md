# Chrome DevTools 噪声过滤

用于减少 React、Sentry、动画库等框架堆栈对排查的干扰。

## 推荐设置

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

## 项目内辅助

- `src/lib/logger.ts` 会尽量清理框架堆栈，只保留业务上下文。
- `src/main.tsx` 在开发环境限制 `Error.stackTraceLimit`，避免超长堆栈。

如果需要临时过滤控制台，可搜索排除：

```text
-react-dom -@sentry -framer-motion -commitPassive -recursivelyTraverse
```
