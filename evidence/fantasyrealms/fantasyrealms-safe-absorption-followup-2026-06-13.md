# Fantasy Realms 可直接吸收项跟进（2026-06-13）

## 本轮新增确认

在上一轮“3 个可单独吸收小项”里，当前根目录与 `fantasyrealms` worktree 的真实状态如下：

1. `src/games/__tests__/fantasyrealmsManifestIntegration.test.ts`
   - 根目录已与 `fantasyrealms` worktree 当前版本一致
   - 本轮未再改

2. `src/games/fantasyrealms/rule/幻想国度规则.md`
   - 根目录已与 `fantasyrealms` worktree 当前版本一致
   - 本轮未再改

3. `src/games/fantasyrealms/manifest.ts`
   - 根目录此前 **尚未** 带上 `thumbnailPath: 'fantasyrealms/thumbnails/cover'`
   - 本轮已补齐，并再次核对到与 `fantasyrealms` worktree 当前版本一致

4. `src/games/fantasyrealms/domain/index.ts`
   - 根目录此前 **尚未** 透出 `getDeckDrawCount`
   - 该差异只是一条 barrel 导出，不改变 UI / 规则 / 运行时状态机
   - 本轮已补齐，并再次核对到与 `fantasyrealms` worktree 当前版本一致

## 本轮实际吸收内容

### A. manifest 缩略图入口

已吸收：

- `src/games/fantasyrealms/manifest.ts`

变更：

- 新增 `thumbnailPath: 'fantasyrealms/thumbnails/cover'`

### B. 缩略图资源

从 `fantasyrealms` worktree 同步到根目录当前工作区：

- `public/assets/i18n/zh-CN/fantasyrealms/thumbnails/compressed/cover.webp`
- `public/assets/i18n/en/fantasyrealms/thumbnails/compressed/cover.webp`

校验结果：

- 两边文件 SHA256 一致：
  - `AB3C82285C5181D3A2EE960E383A9CB33905000ED90C144E994D9843E154ECB5`
- 文件大小一致：
  - `182306` bytes

### C. 领域 barrel 导出

已吸收：

- `src/games/fantasyrealms/domain/index.ts`

变更：

- 新增 `getDeckDrawCount` 对外导出

## 验证结果

已运行定向单测：

- `node scripts/infra/vitest-cli-safe.mjs run src/games/__tests__/fantasyrealmsManifestIntegration.test.ts --configLoader native`

结果：

- `2 passed`

说明：

- 测试主体已通过；
- 终端末尾仍出现若干 `socket hang up / ECONNRESET` 日志，但该命令整体退出码为 `0`，没有影响这条 manifest 集成验证的通过结论。

## 当前额外发现

这两张 `cover.webp` 在根目录里属于：

- 已存在于当前工作区
- 但命中 `.gitignore:93` 的 `public/**/*.webp`

这意味着：

- 它们已经被吸收到**当前根目录工作区现场**
- 但后续若要正式纳入版本控制，提交时不能只看普通 `git status`，需要记住它们是被 ignore 的资源文件

## 剩余仍未确认、继续留待统一裁决的文件

去掉本轮已收口的小项后，仍保留待裁决的主要 dirty worktree 偏移为 `11` 个：

- `src/games/fantasyrealms/Board.tsx`
- `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
- `design-system/games/fantasyrealms.md`
- `docs/games/fantasyrealms/design/README.md`
- `e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai-golden.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts`
- `e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts`
- `e2e/fantasyrealms/helpers/fantasyrealmsOnlineAi.ts`
- `public/locales/en/game-fantasyrealms.json`
- `public/locales/zh-CN/game-fantasyrealms.json`

补充：

- 本轮已再次逐文件核对根目录 vs `fantasyrealms` worktree 当前版；
- 这 `11` 个文件全部仍有真实差异，没有再发现“其实已经一致”的漏网项；
- 后续建议改按批次拍板，见：
  - `evidence/fantasyrealms/fantasyrealms-remaining-decision-batches-2026-06-13.md`

## 一句话结论

本轮又向前收了一小步：**Fantasy Realms 缩略图入口和一个独立领域导出已经在根目录工作区闭合，并通过了定向 manifest 集成测试；未拍板的大头仍只剩 UI / E2E / 文案 / 交互合同那一组。**
