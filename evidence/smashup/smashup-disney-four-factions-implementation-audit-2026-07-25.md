# 大杀四方迪士尼四派系实施审计（代表性玩法验证 + 资源上传阻塞）

## 全面审计自检表

| 项目 | 状态 | 证据 / 说明 |
| --- | --- | --- |
| 对象全集 | `passed` | 已接入 4 个派系：超能陆战队、冰雪奇缘、狮子王、花木兰；每派系 15 张卡，合计 60 张卡；每派系 2 个基地，合计 8 个基地。 |
| L0/L1 静态接入 | `passed` | faction id、atlas、card/base data、locale、faction metadata、critical image preload、game/root manifest 均已接入。 |
| 规则子句表 | `representative_only` | 代码已按卡牌能力实现，但当前 evidence 尚未形成逐卡逐子句完整矩阵。 |
| 完整技能流程矩阵 | `representative_only` | 已有代表性 L2 行为测试与 1 条真实入口 E2E；未覆盖每张卡 / 每个基地的独立 L3/L4。 |
| L2 行为验证 | `representative_only` | `disney-four-factions.test.ts` 覆盖四派系代表性能力、真实出牌管线、刀疤跨基地有效力量回归。 |
| L3/L4 真实入口 | `representative_only` | 已覆盖超能陆战队“升级”真实打牌入口、Disney 选择 prompt、力量指示物、弃牌与收口截图。 |
| 框架消费合同矩阵 | `representative_only` | 代表性覆盖 simple choice、额外出牌额度、力量指示物、保护/限制、持续修正、基地触发；未做全对象消费合同表。 |
| L4 共享链判等矩阵 | `representative_only` | 未建立逐对象“仅配置不同”判等矩阵；不能用一条 E2E 外推全批次 L4。 |
| 旧 evidence / 旧结论对账 | `passed` | 本批次此前只有预审批证据，未发现旧“已完成”结论需要回写。 |
| 真实入口截图核验 | `passed` | 已人工核图：微型机器群显示 `+2`，手牌只剩迷你雪人，右侧弃牌堆显示升级，prompt 已关闭。 |
| 服务器资源主源 | `blocked` | 精确预检命中 2 个对象；实际上传 15 分钟超时，公开 URL 仍 404；SSH 探针返回 `Permission denied (publickey,...)`。 |
| 残余范围声明 | `blocked` | 资源主源未发布；全对象 L0-L4 审计矩阵未闭合。当前只能说“代表性玩法已验证”，不能说“全面审计完成”。 |

## 批次矩阵

| 对象 | 数据录入 | 本地资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 超能陆战队 | `passed` | `passed_local / blocked_remote` | `passed` | `representative_only` | `passed_representative` | `blocked: resource upload` |
| 冰雪奇缘 | `passed` | `passed_local / blocked_remote` | `passed` | `representative_only` | `representative_only` | `blocked: resource upload` |
| 狮子王 | `passed` | `passed_local / blocked_remote` | `passed` | `representative_only` | `representative_only` | `blocked: resource upload` |
| 花木兰 | `passed` | `passed_local / blocked_remote` | `passed` | `representative_only` | `representative_only` | `blocked: resource upload` |

## 范围与工作区

- OpenSpec change：`openspec/changes/add-smashup-disney-four-factions/`
- Worktree：`D:/GA/BoardGame-smashup-disney-four-factions-clean-20260725`
- 分支：`codex/smashup-disney-four-factions-clean-20260725`
- 本轮对象：超能陆战队、冰雪奇缘、狮子王、花木兰。
- 实际 push / PR：未执行，仍需用户后续明确口令。

## 主真相源与 intake 结果

| 字段 | 值 |
| --- | --- |
| 原图路径 | `C:/Users/Dqm/.codex/attachments/11666c73-73f5-40e1-ad6c-9d72601bd77c/image-1.png` |
| 文件大小 | `41,387,810 bytes` |
| 尺寸 | `4888 x 4096` |
| SHA-256 | `4e28237e91b60a3a4faa48aa57b6c0404574cdd372017fa5104781219e1216b0` |
| 用途 | 中文卡图、中文名称、中文规则文本、row-major 顺序、四派系范围识别 |

| 产物 | 路径 | 状态 |
| --- | --- | --- |
| 轻量总览 | `temp/smashup-disney-four-factions-intake/overview-2200w.png` | `passed` |
| 单卡裁图 | `temp/smashup-disney-four-factions-intake/cards/slot-00-r1c1.png` 至 `slot-59-r6c10.png` | `passed` |
| 元数据 JSON | `temp/smashup-disney-four-factions-intake/source-and-grid-feasibility.json` | `passed` |

## 静态与资源接入

| 项目 | 文件 / 路径 | 状态 |
| --- | --- | --- |
| 派系 ID | `src/games/smashup/domain/ids.ts` | `passed` |
| card/base atlas | `src/games/smashup/domain/atlasCatalog.ts` | `passed` |
| faction data | `src/games/smashup/data/factions/big_hero_6.ts`, `frozen.ts`, `lion_king.ts`, `mulan.ts` | `passed` |
| registry imports | `src/games/smashup/data/cards.ts` | `passed` |
| gameplay handlers | `src/games/smashup/abilities/disney_four_factions.ts`, `abilities/index.ts` | `passed` |
| ongoing modifiers | `src/games/smashup/domain/ongoingModifiers.ts` | `passed` |
| faction metadata | `src/games/smashup/ui/factionMeta.ts` | `passed` |
| locale | `public/locales/zh-CN/game-smashup.json`, `public/locales/en/game-smashup.json` | `passed` |
| critical preload | `src/games/smashup/__tests__/criticalImageResolver.test.ts` | `passed` |
| game/root manifest | `public/assets/i18n/zh-CN/smashup/assets-manifest.json`, `public/assets/i18n/assets-manifest.json` | `passed_local` |

### 本地正式资源

| 资源 | 源尺寸 | 压缩尺寸 | 状态 |
| --- | --- | --- | --- |
| `public/assets/i18n/zh-CN/smashup/cards/disney_four_factions.png` | `4888 x 4096` | - | `passed` |
| `public/assets/i18n/zh-CN/smashup/cards/compressed/disney_four_factions.webp` | - | `4888 x 4096` | `passed: not downsampled` |
| `public/assets/i18n/zh-CN/smashup/base/disney_four_faction_bases.webp` | `3840 x 2160` | - | `passed` |
| `public/assets/i18n/zh-CN/smashup/base/compressed/disney_four_faction_bases.webp` | - | `3840 x 2160` | `passed: not downsampled` |

## L2 / L3 代表性玩法证据

### L2 行为测试

文件：`src/games/smashup/__tests__/abilities/disney-four-factions.test.ts`

已覆盖：

- 四派系代表性主动能力入口已注册。
- 超能陆战队：微型机器群、新来的学生、升级、团队的努力按指示物 / 额外出牌结算。
- 超能陆战队：升级从真实出牌管线打开选择后，离开手牌并进入弃牌堆。
- 冰雪奇缘：棉花糖只压制同基地敌方角色；真爱的行为先抽牌再给所选角色临时保护。
- 狮子王：木法沙在弃牌堆时触发弃牌条件，并让荣耀石给玩家额外力量。
- 狮子王：刀疤按目标所在基地计算有效力量，跨基地持续修正不会漏算。
- 花木兰：集体训练给己方全场角色放指示物，金宝保护己方角色不受敌方影响。

### L3/L4 真实入口 E2E

文件：`e2e/smashup/smashup-disney-four-factions.e2e.ts`

用例：`超能陆战队升级应从真实打牌入口打开 Disney 选择并给角色放力量标记`

截图：

`D:/GA/BoardGame-smashup-disney-four-factions-clean-20260725/test-results/evidence-screenshots/smashup/smashup-disney-four-factions.e2e/超能陆战队升级应从真实打牌入口打开-Disney-选择并给角色放力量标记/disney-upgrades-resolved.jpg`

人工观察：

- 微型机器群可见，并显示 `+2` 力量指示物。
- 手牌中可见迷你雪人，说明机器人实验室的“放置指示物后抽牌”副作用已触发。
- 右侧弃牌堆可见升级，说明升级从真实手牌出牌入口结算后进入弃牌堆。
- Disney 选择 prompt 已关闭，行动额外出牌提示仍可见，链路已回到可继续操作状态。

## 已运行验证

| 命令 | 结果 |
| --- | --- |
| `openspec validate add-smashup-disney-four-factions --strict --no-interactive` | `passed` |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/disney-four-factions.test.ts --configLoader native` | `passed: 7 tests` |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/disney-four-factions.test.ts src/games/smashup/__tests__/disneyFourFactionsIntake.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts --configLoader native` | `passed: 3 files / 34 tests` |
| `npm run typecheck` | `passed` |
| `npm run i18n:check` | `passed` |
| `npm run assets:validate` | `passed` |
| `npx eslint <touched TS/E2E files>` | `passed: 0 errors` |
| `npm run test:e2e:ci:file -- e2e/smashup/smashup-disney-four-factions.e2e.ts` | `passed` |

## 资源主源发布状态

### 精确预检

命令：

```powershell
node scripts/assets/upload-to-server.js --check --asset-prefix i18n/zh-CN/smashup/cards/compressed/disney_four_factions --asset-prefix i18n/zh-CN/smashup/base/compressed/disney_four_faction_bases
```

结果：`passed`，只命中 2 个对象：

- `official/i18n/zh-CN/smashup/base/compressed/disney_four_faction_bases.webp`，`1261136 bytes`，`md5=7ac1390a0dbf7d15ba9a2615ae24bbaa`
- `official/i18n/zh-CN/smashup/cards/compressed/disney_four_factions.webp`，`8103102 bytes`，`md5=1c9bf55534a3e6a7bcbf13c2320df038`

### 实际上传

命令：

```powershell
node scripts/assets/upload-to-server.js --asset-prefix i18n/zh-CN/smashup/cards/compressed/disney_four_factions --asset-prefix i18n/zh-CN/smashup/base/compressed/disney_four_faction_bases
```

结果：`blocked`，命令等待约 15 分钟后仍未返回，被超时中断。

后续清理：

- 已停止残留的 `scripts/assets/upload-to-server.js` 进程。
- 未停止无关的 NotebookLM MCP 进程。

### 公开 URL 回查

| URL | HEAD 状态 |
| --- | --- |
| `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/disney_four_factions.webp` | `404 Not Found` |
| `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/disney_four_faction_bases.webp` | `404 Not Found` |

### SSH 阻塞归因

命令：

```powershell
ssh -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=20 -o ServerAliveCountMax=1 -o StrictHostKeyChecking=yes admin@8.148.71.102 "echo boardgame-asset-ssh-ok"
```

结果：

```text
admin@8.148.71.102: Permission denied (publickey,gssapi-keyex,gssapi-with-mic).
```

本机环境未发现 `ASSET_SERVER_SSH_TARGET` / `ASSET_SERVER_SSH_KEY_PATH` / `ASSET_SERVER_SSH_KNOWN_HOSTS_PATH`；仓库 workflow 显示这些值在 CI secrets 中配置。当前阻塞不是资源路径问题，而是本地没有可用的服务器发布 SSH 凭据。

## 残余范围与作者 handoff 口径

- `blocked`：服务器资源主源未发布，默认线上资源基址仍会请求 404；必须由具备 `ASSET_SERVER_SSH_*` 凭据的环境重新执行精确上传并拿到 `HEAD 200`。
- `representative_only`：当前只完成代表性玩法验证；尚未形成每张卡 / 每个基地的完整 L0/L1/L2/L3/L4 矩阵。
- `not pushed`：本地分支尚未 push，PR 尚未创建。
- 可交给作者审查的口径：代码、静态接入、代表性行为测试、代表性真实入口 E2E 已完成；资源发布与全对象审计仍需补齐后才能称为“全面完成 / 发布可上线”。
