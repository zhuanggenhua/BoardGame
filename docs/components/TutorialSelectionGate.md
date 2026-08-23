# TutorialSelectionGate 组件索引

`TutorialSelectionGate` 用于在教程模式下临时遮挡选角 / 选阵营 UI，避免教程自动 setup 前闪出可操作选择界面。

## 当前入口

| 目标 | 文件 |
| --- | --- |
| 组件实现 | [TutorialSelectionGate.tsx](../../src/components/game/framework/TutorialSelectionGate.tsx) |
| 组件测试 | [TutorialSelectionGate.test.tsx](../../src/components/game/framework/__tests__/TutorialSelectionGate.test.tsx) |

## 使用口径

- `isTutorialMode` 表示路由或模式层已进入教程。
- `isTutorialActive` 表示教程系统已激活。
- 任一条件为真时渲染遮罩，不渲染 children。
- 组件只负责遮罩，不负责自动选择角色 / 阵营，也不承载教程流程规则。

## 示例形态

```tsx
<TutorialSelectionGate
  isTutorialMode={gameMode?.mode === 'tutorial'}
  isTutorialActive={isTutorialActive}
  loadingText={t('ui.loading', { defaultValue: '加载中...' })}
>
  <SelectionView />
</TutorialSelectionGate>
```
