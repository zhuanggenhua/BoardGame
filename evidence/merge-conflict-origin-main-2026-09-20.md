# 冲突解决汇报：已验证发布线合并 origin/main

## 1. 背景

- 日期：2026-09-20
- 共同祖先：`520db7e056941056c767c245b0bc119e9b1acc52`
- 已验证发布线：`ac91120544fa8176fc9230066cbdddbd3a033d19`
  - 父提交：`44a213c62154e10a1aafd3204d0f56fe195a2fd8`
  - 补充修正：删除 Mage Wars 校验器中的未使用导入，消除新增 ESLint warning。
- 远端 `origin/main`：`caef41b1e76093e20e01b033ea5e8f105d4cc984`
- 合并提交：`af65d62a7f2e0bbe7ab06de506bbded78dac2084`
- 触发路径：先用 `git merge-tree --write-tree ac9112054 origin/main` 计算无工作区合并，再补齐真实冲突并生成 merge commit。
- 合并目标：把远端 Smash Up POD 资源与主线修复合入已验证发布线；未纳入本地未确认提交 `3aac4438a52789939132636537903954e01cc109`。

## 2. 冲突文件

pre-push 的 Merge conflict guard 识别到 6 个双方都修改过的混合结果文件：

- `public/assets/i18n/assets-manifest.json`
- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`
- `src/games/smashup/__tests__/abilities/ancient-incas.test.ts`
- `src/games/smashup/domain/ids.ts`
- `src/games/smashup/domain/ongoingModifiers.ts`

## 3. 逐文件解决策略

- `public/assets/i18n/assets-manifest.json`
  - 保留双方新增的资源索引与哈希/字节信息，由 Git 自动合并。
  - 未使用整份 ours 或 theirs 覆盖；后续由资源与 i18n 检查确认 JSON 仍可解析。
- `public/locales/en/game-smashup.json`
  - 保留主线已有英文文案与远端 POD 卡牌文案，采用自动合并结果。
- `public/locales/zh-CN/game-smashup.json`
  - 保留主线已有中文文案与远端 POD 卡牌文案，采用自动合并结果。
- `src/games/smashup/__tests__/abilities/ancient-incas.test.ts`
  - 保留本地已验证规则覆盖与远端古代印加 POD 覆盖，采用自动合并结果。
- `src/games/smashup/domain/ids.ts`
  - 保留双方新增的卡牌/变体标识，采用自动合并结果。
- `src/games/smashup/domain/ongoingModifiers.ts`
  - 手工合并导入区：同时保留远端的 POD 变体关系解析与本地的有效基地能力来源解析。
  - 保留远端 `resolveSmashUpVariantRelationForSourceId`、`SmashUpVariantRelation` 及其作用域精确匹配逻辑。
  - 保留本地 `getEffectiveBaseAbilitySourceIds`、基地上下文重写和基地级力量修正遍历逻辑。
  - 这样既不会丢远端 POD 变体策略，也不会丢本地基地能力来源收口。

## 4. 风险与验证

### 已执行

- `git merge-tree --write-tree ac9112054 origin/main`
  - 识别 1 个真实内容冲突：`src/games/smashup/domain/ongoingModifiers.ts`。
- 已解决合并树无残留冲突标记。
- 已生成 merge commit `af65d62a7f2e0bbe7ab06de506bbded78dac2084`。
- 已通过已验证发布线的编码、类型检查、ESLint warning delta、构建和 i18n 检查。
- 构建结果：成功；仅有既有 CSS 解析提示和 chunk 体积提示，没有构建失败。

### 待执行

- 重新执行 pre-push，让 merge conflict evidence 门禁读取本文件。
- 推送 `af65d62a7f2e0bbe7ab06de506bbded78dac2084` 到 `origin/main`。
- 推送成功后按生产部署入口执行服务器更新与 Android stable OTA，并回查远端版本、健康状态和 OTA 文件。

## 5. 结果

- 本次不是整份接受单边版本；6 个重叠文件保留双方有效内容。
- `ongoingModifiers.ts` 的实际冲突已按 POD 变体语义与基地能力来源语义合并。
- 当前唯一待收口动作是带本冲突汇报文档重新执行 pre-push、push 和部署。
