## 1. 合同与 workflow

- [x] 1.1 固化 `wangling.png / wangling_base.png` 的 truth-source 合同、atlas 几何与索引表
- [x] 1.2 更新 `.windsurf/skills/data-entry-workflow/SKILL.md`，补齐 Smash Up 的 `intake` / `implementation` 分流规则
- [x] 1.3 收紧 `docs/games/smashup/workflows/smashup-faction-intake.md` 为 intake-only 文档
- [x] 1.4 新增 `docs/games/smashup/workflows/smashup-faction-implementation.md`，定义逐派系实施、验证与统一收口流程

## 2. 运行时接入

- [x] 2.1 新增 `wangling` card/base atlas 槽位，并接入 `ids.ts`、`atlasCatalog.ts` 与相关预览/预加载链路
- [x] 2.2 接入 `Mermaids / Skeletons / World Champs` 的 faction metadata、card/base 数据与 locale
- [ ] 2.3 为 `World Champs` 逐张建立“直接复用 / 复制改名 / 全新实现”的裁定表，并按裁定落地

## 3. 玩法实现

- [ ] 3.1 `Mermaids` 分三批实施：配置复用批 → 新机制/共享扩展批 → 新 UI/交互 + 对应 E2E 批
- [ ] 3.2 `Skeletons` 分三批实施：配置复用批 → 新机制/共享扩展批 → 新 UI/交互 + 对应 E2E 批
- [ ] 3.3 `World Champs` 分三批实施：配置复用批 → 新机制/共享扩展批 → 新 UI/交互 + 对应 E2E 批
- [ ] 3.4 若实施中发现共享抽象缺口，直接进行可复用扩展重构（禁止临时代码），并同步测试与 evidence
- [ ] 3.5 每完成一个派系，立即完成该派系的规则核对、共享链路扩审与必要测试

## 4. 验证与留证

- [ ] 4.1 运行相关 Smash Up Vitest / 审计测试
- [ ] 4.2 补充并运行相关 E2E，覆盖新增交互类型与关键真实链路
- [ ] 4.3 产出 evidence 文档并记录关键截图绝对路径
- [ ] 4.4 如新增 atlas 进入运行时资源链路，完成压缩、R2 上传与远端回查
- [ ] 4.5 运行 `openspec validate add-smashup-10th-anniversary-factions --strict --no-interactive`
