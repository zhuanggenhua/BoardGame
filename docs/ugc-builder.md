# UGC Builder 入口

本文只记录 UGC Builder 的当前入口和代码落点。运行时协议、沙箱限制和模板见 [`docs/ugc/`](ugc/)。

## 页面入口

| 路由 | 用途 |
| --- | --- |
| `/dev/ugc` | 统一 Builder 主入口 |
| `/dev/ugc/runtime-view` | iframe 运行时预览 |
| `/dev/ugc/schema` | Schema 演示 |
| `/dev/ugc/scene` | 场景画布演示 |
| `/dev/ugc/rules` | 规则生成演示 |

## 当前链路

1. Builder 收集需求、Schema、数据和布局。
2. PromptGenerator 生成外部 AI 提示词。
3. 用户把外部 AI 输出的 `domain` 对象粘贴回规则代码框。
4. DomainCore 执行器加载 `setup / validate / execute / reduce / isGameOver / playerView`。
5. Builder 预览通过 `UGCRuntimeHost + UGCRuntimeView` 复用运行时链路。
6. 草稿可保存到云端；未登录时回退到 localStorage。

UGC 框架不内置具体游戏规则，也不提供手动代码编辑器。

## 代码入口

| 文件 / 目录 | 职责 |
| --- | --- |
| `src/ugc/builder/pages/UnifiedBuilder.tsx` | Builder 主页面 |
| `src/ugc/builder/ai/PromptGenerator.ts` | 规则提示词生成 |
| `src/ugc/builder/schema/types.ts` | Schema 类型 |
| `src/ugc/builder/ui/DataTable.tsx` | 数据表格 |
| `src/ugc/builder/ui/SceneCanvas.tsx` | 布局画布 |
| `src/ugc/runtime/UGCRuntimeHost.tsx` | 预览宿主 |
| `src/ugc/runtime/UGCRuntimeView.tsx` | 运行时视图 |
| `src/ugc/runtime/domainExecutor.ts` | 规则执行入口 |

## 相关资料

- [UGC 总览](ugc/ugc-overview.md)
- [UGC 规则模板](ugc/ugc-rule-template.md)
- `src/ugc/__tests__/`
- `src/ugc/builder/__tests__/`
- `e2e/_shared/ugc-builder.e2e.ts`

## 验证

```bash
npx vitest run src/ugc/builder/__tests__/UnifiedBuilder.test.ts
npm run test:e2e -- e2e/_shared/ugc-builder.e2e.ts
```
