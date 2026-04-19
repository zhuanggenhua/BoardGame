# Dice Throne 骰面不可见反馈修复（2026-04-09）

## 覆盖反馈
- `69d26b8f6e60b2aef078d89d`
- 标题：`骰面看不见`

## 结论
- 这是一个真实的前端渲染缺口。
- `src/games/dicethrone/ui/assets.ts` 里其实已经准备了骰面 fallback 皮肤与字形：
  - `getDiceFaceFallbackGlyph`
  - `getDiceFaceFallbackSkin`
- 但 `src/games/dicethrone/ui/Dice3D.tsx` 之前没有使用这些 fallback。
- 因此一旦骰图 sprite 没加载成功，骰子面只会渲染一层空白背景，用户就会看到“骰面看不见”。

## 修复
- 文件：`src/games/dicethrone/ui/Dice3D.tsx`
- 修法：
  - 在 sprite 未就绪时，为每个骰面渲染 fallback 皮肤
  - 同时渲染可见的 face glyph / label
  - 补充 `data-face-fallback` / `data-face-symbol` 标记，便于测试锁定

## 验证
1. `npx eslint src/games/dicethrone/ui/Dice3D.tsx src/games/dicethrone/__tests__/StatusEffectsIcons.test.tsx`
2. `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/StatusEffectsIcons.test.tsx --configLoader native -t "dice sprite 缺失时应渲染 fallback 骰面字形，避免整块空白"`

## 验证结果
- ESLint 通过（0 errors）。
- 目标测试通过：
  - `dice sprite 缺失时应渲染 fallback 骰面字形，避免整块空白`
- 当前已能证明：即使 sprite 缺失，Dice3D 仍会渲染可见骰面，而不是空白块。
