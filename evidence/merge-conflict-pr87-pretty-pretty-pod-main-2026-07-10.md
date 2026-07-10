# PR #87 Pretty Pretty POD 与主线合并审计记录（2026-07-10）

## 背景

- 原始 PR：`#87 接入 Pretty Pretty POD 派系`
- PR 原 head：`16d28cda106b0f3afc3914c231a90d432a864e64`
- 合入的主线提交：`d3539dfad10e843c3ede7c88a96b8938b3d529da`
- 共同父提交：`da82e67afbbe9af038e4897666f2cd564126ae99`
- 执行现场：独立临时 clone 的 detached HEAD；没有修改用户当前主工作区。

## 双侧内容

PR 一侧新增 Pretty Pretty POD 的四个派系：

- 猫咪 POD、小马 POD、妖精 POD、公主 POD。
- 对应卡牌、基地、能力、图集、派系选择元数据、中英文文案与测试。

主线一侧新增并已通过门禁的内容：

- 鲨鱼 POD、龙卷风 POD、全明星 POD。
- 圣骑士 DIY、神圣炽天使及对应资源与注册。

## 双侧重叠文件

1. `public/locales/en/game-smashup.json`
   - 结构化三方合并，保留 Pretty Pretty POD、三套既有 POD 与圣骑士全部英文键。
2. `public/locales/zh-CN/game-smashup.json`
   - 结构化三方合并，保留双方全部中文键。
3. `src/games/smashup/data/cards.ts`
   - 同时保留 Pretty Pretty POD 四派系、三套既有 POD 与圣骑士卡牌注册。
4. `src/games/smashup/domain/atlasCatalog.ts`
   - 同时保留 Pretty Pretty POD、三套既有 POD 与圣骑士图集注册。
5. `src/games/smashup/domain/ids.ts`
   - 同时保留双方派系标识、图集标识与中文显示名。
6. `src/games/smashup/ui/factionMeta.ts`
   - 同时保留双方派系选择元数据。

两份文案、卡牌注册和标识注册出现 Git 文本冲突；文案使用 JSON 三方合并器递归合并并拒绝同键异值，结果未发现同键异值。其余重叠文件逐项核对新增标识，最终没有整份采用任一父提交，也没有删除单边独有内容。

## 审查修复

- 妖精 POD 的泰坦妮亚回手分支资源足迹改为只包含对手随从，与实际提示目标一致。
- 小马 POD 的海星在找不到来源随从时不再把场上任意己方随从误判为“其他随从”。
- 公主 POD 的格丽泽尔达额外行动限定为 `princesses_heirloom_pod`，不能用于任意战术。
- 删除英文图集映射中三项重复 POD 基地键，保留 Pretty Pretty POD 专用压缩图集映射。
- 小马 POD 的 Pinkie 中文显示名改为“萍琪”。

## 验证

- 妖精、小马、公主能力与 Pretty Pretty POD 基地测试：4 个文件、69 条测试通过。
- `npm run typecheck`：通过。
- `npm run i18n:check`：通过。
- 定向 ESLint：通过。
- 英文图集映射 JSON 解析通过，共 657 个映射键，无重复键。
- 两份本地化 JSON 解析通过，冲突标记扫描无命中。

## 结果

- Pretty Pretty POD 与主线已有圣骑士、鲨鱼 POD、龙卷风 POD、全明星 POD 均完整保留。
- 本文档随本次 merge commit 一同提交，供合并冲突质量门审计。
