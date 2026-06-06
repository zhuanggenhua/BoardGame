## 1. 独立仓迁出
- [x] 1.1 在 `D:/gongzuo/webgame/flowise-fork/` 建立独立 Flowise fork 仓
- [x] 1.2 将原 `forks/flowise/` 内容安全复制到独立仓
- [x] 1.3 将独立仓直接提交并推送到远端 `main`

## 2. BoardGame 回填
- [x] 2.1 将 `package.json` 的本地启动脚本改为调用 `../flowise-fork/boardgame/scripts/start-boardgame-local.ps1`
- [x] 2.2 将 `flowiseForkBaseline.ts` 的本地源码路径改为 `../flowise-fork`
- [x] 2.3 将相关 OpenSpec / evidence 中的旧路径口径回填为独立仓路径

## 3. 清理内嵌 fork
- [x] 3.1 删除 `forks/flowise/**` 内嵌源码
- [x] 3.2 确认 BoardGame worktree 中不再存在 `forks/flowise` 目录

## 4. 校验
- [x] 4.1 复查 BoardGame 已无代码硬引用 `forks/flowise`
- [x] 4.2 运行 `npm run typecheck`
- [x] 4.3 运行 `npm run i18n:check`
- [x] 4.4 运行 `npx openspec validate add-flowise-workbench-shell-integration --strict --no-interactive`
