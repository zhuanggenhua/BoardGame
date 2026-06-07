---
name: sticker-imagegen
description: "BoardGame 项目的表情生成与接入 workflow。用于角色表情候选生成、白底 cutout 门禁、表情资源登记、catalog/manifest 更新、最窄验证与远端资源同步。"
---

# BoardGame 表情生成与接入

## 什么时候用

命中以下任一场景就用本 skill：

- 生成或重做角色表情、Q 版反应贴纸、seat emote / match emote 资源
- 用户给参考图、已通过样张、生成图路径，要求继续做同角色同风格表情
- 用户选中某张候选后，要求正式接入 DiceThrone / Smash Up / 其他游戏表情资源
- 用户要求修表情透明底、白底 cutout、资源路径、catalog、manifest、R2 资源链路

## 先读

1. `AGENTS.md`
2. `docs/ai-rules/asset-pipeline.md`
3. 若这次涉及对局内座位表情验收，再读：
   - `docs/user-stories/project/seat-emote-recipient-first-acceptance.md`

## 核心原则

1. 第一真相源永远是可见参考图、已通过样张、用户点名通过的生成图。
2. “表情”必须是可读的反应瞬间，不是立绘，不是宣传图。
3. 风格一致性优先于单张花哨。已经选定路线后，后续只改表情和动作，不重开风格。
4. 用户没要求只出一张时，默认至少给 3 张候选。
5. 只要后续目标包含 cutout、透明底入库、正式接入，候选底图默认必须是纯白干净背景；禁止棋盘格假透明。
6. 用户一旦点名“就这张/按这张接入”，任务就从“生成候选”切到“正式落地”。

## 候选生成 SOP

1. 先锁 3 类锚点：
   - 身份锚点：脸型、眼型、发型/兜帽、服装、主色、标志物
   - 风格锚点：Q 版比例、线条、渲染、贴纸感、符号语言
   - 表情锚点：情绪、嘴、眼、手势、动作、梗图符号
2. 提示词只写增量变化：
   - 保留什么：角色身份和已通过风格
   - 改什么：情绪、姿势、动作、符号
   - 禁止什么：大眼萌化、立绘构图、泛化重设计、错误背景
3. 默认生成 3 张候选：
   - 同一角色、同一风格
   - 差异体现在表情强度、手势角度、构图节奏或符号组合上
   - 不能只是同一张轻微重绘
4. 候选展示前先做背景门禁：
   - 纯白/近纯白干净底才可进入后续 cutout 流程
   - 棋盘格、纹理底、渐变底、假透明预览图一律不合格
5. 探索阶段的图默认留在生成目录；不要提前当正式资产。

## 白底与透明底规则

1. 禁止棋盘格假透明预览底。
2. 正式资源必须是透明底；白底方图不能直接入库。
3. 若走“统一白底后去背景”，白底阶段不要先画白色贴纸边、白色外发光、浅灰投影、贴边雾状描边。
4. 这些贴纸边/外光都应在透明底上后补；否则白底和白边会混层。
5. 只写 `pure white background` 不算完成；生成后必须实际核对白底是否干净。

## BoardGame 接入 SOP

当用户选中某张图后，按下面流程落地：

1. 先确认选中的生成图路径，并实际打开核对。
2. 先查旧实现，不要发明新链路：
   - `src/shared/emotes.ts`
   - `src/shared/__tests__/emotes.test.ts`
   - `public/assets/i18n/assets-manifest.json`
   - 现有 `public/assets/i18n/zh-CN/*/emotes/` 目录
3. 确认这张表情的归属：
   - `gameId`
   - `characterId`
   - `emotion`
   - `scope` 是 `common` 还是 `game`
4. 建立稳定 ID 与资源路径：
   - `id` 默认沿用现有 catalog 风格，例如 `dicethrone.moon-elf.confused-v1`
   - `assetPath` 不带扩展名，只写运行时逻辑路径
5. 迁入正式资源目录：
   - PNG：`public/assets/i18n/zh-CN/<gameId>/emotes/<characterId>/<name>.png`
   - WebP：`public/assets/i18n/zh-CN/<gameId>/emotes/<characterId>/compressed/<name>.webp`
6. 更新 `src/shared/emotes.ts`
7. 更新 `src/shared/__tests__/emotes.test.ts`
8. 更新 `public/assets/i18n/assets-manifest.json`
9. 若任务要求远端可用，再走资源检查 / 上传：
   - `npm run assets:check`
   - 按需执行上传链路

## Cutout 验收门禁

以下都不是充分条件：

- 有 alpha
- 四角透明
- 命令跑通
- 远端 200

真正门禁是：

1. 在深色底和浅色底各看一遍边缘。
2. 只要出现以下任一情况，就判不合格：
   - 灰边
   - 黑边
   - 脏边
   - 大块残底
   - 白边粗细失真
   - 主体轮廓被削坏
   - 发丝、耳尖、手指、武器尖端被切坏
3. 不能把“脚本抠出了透明”当完成；最终必须人工看图放行。
4. 如果第一版 cutout 已明显发脏、发灰、残底严重，不再反复调阈值硬救，优先回到重生成或更强编辑链路。

## 推荐工具链

如需本地白底 cutout，可用：

```powershell
node scripts/assets/make_emote_transparent.mjs <input>.png
```

但这只是候选步骤，不是自动放行依据。

## 最窄验证

正式接入后，默认至少执行：

```powershell
npm run assets:manifest
npm run assets:validate
node scripts/infra/vitest-cli-safe.mjs run src/shared/__tests__/emotes.test.ts --configLoader native
```

如果本轮还改了对局内表情显示逻辑，再按影响补跑最窄行为测试，例如：

- `src/components/game/framework/widgets/__tests__/SeatEmoteOverlay.test.tsx`
- `src/server/__tests__/matchEmotes.test.ts`

## 提示词模板

```text
使用可见的【参考图/已通过表情】作为身份和风格参考。
生成同一套表情里的【角色】【情绪/动作】贴纸。
必须保留：【身份锚点】、【风格锚点】、【配色】、【小尺寸可读性】。
本次变体：【具体表情 + 手势/动作 + 反应符号】。
构图：正方形，紧凑，纯白干净背景。
禁止：【已知漂移模式】【棋盘格假透明】【立绘构图】。
```

## 常见失败

以下结果直接判失败，不要继续当可用候选或正式底稿：

- 看起来像同主题新角色，不像同一个角色
- 像立绘/宣传图，不像表情包
- 只有头像，没有反应点
- 风格漂移
- 候选底图不是干净白底
- 正式接入时仍是白底方图、随机文件名、临时目录路径
