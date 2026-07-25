# Smash Up Disney 四派系实施审计（阿拉丁 / 美女与野兽 / 圣诞夜惊魂 / 无敌破坏王）

目标状态：blocked
当前目标：把四个 Disney 派系做到可交作者审阅；本地实现、测试与真实入口 E2E 已过，服务器素材主源上传未过。
非当前历史背景：Dice Throne / audio / 其它 worktree 脏改不属于本任务。
禁止自动接管：除非用户重新授权，不得把无关 Dice Throne 素材、audio manifest 或其它游戏改动纳入本次提交/推送。
更新时间：2026-07-25

## 全面审计自检表

| 项 | 状态 | 证据 / 说明 |
| --- | --- | --- |
| 对象全集 | passed | 四派系 55 张卡 + 8 个基地已在静态测试覆盖；见 `src/games/smashup/__tests__/disneyFactionsStatic.test.ts` |
| 规则子句表 | representative_only | intake 合同已列 55 张卡规则原子子句；本轮未把每个原子子句都补到独立 L3/L4 |
| 静态注册 / locale / atlas | passed | `disneyFactionsStatic.test.ts` + `criticalImageResolver.test.ts`：21 passed |
| 玩法机制 L2 | representative_only | `disney-factions-abilities.test.ts`：9 passed，覆盖愿望、弃牌触发、基地修正、角色修正、计分后、糖果国王等代表链 |
| 真实入口 L3/L4 | representative_only | Disney 派系选择 + 真实打出“愿望”抽四派系牌：2 passed |
| 新 UI / 新交互 | passed | `aladdin_wish` simple-choice direct E2E 已覆盖 prompt 出现、选择抽牌、interaction 清空 |
| 资源链 | blocked | 本地压缩图与 manifest 通过；服务器上传 `Permission denied (publickey,...)`，公开 URL 仍 404 |
| OpenSpec | passed | `openspec validate add-smashup-disney-aladdin-beauty-nightmare-ralph --strict --no-interactive` |
| 残余范围声明 | blocked | 未过服务器素材主源上传，不能称为 push-ready；对象级全量 L3/L4 仍是代表性覆盖 |

## 批次矩阵

| 派系 | 数据 / 静态 | 资源 | 玩法 | E2E | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| 阿拉丁 | passed | blocked: server upload | representative_passed | passed: 愿望真实入口 | blocked |
| 美女与野兽 | passed | blocked: server upload | representative_passed | passed: 选派系 + 愿望抽牌命中贝儿 | blocked |
| 圣诞夜惊魂 | passed | blocked: server upload | representative_passed | passed: 选派系 + 愿望抽牌命中怪物花环 | blocked |
| 无敌破坏王 | passed | blocked: server upload | representative_passed | passed: 选派系 + 愿望抽牌命中糖果国王 | blocked |

## 已验证命令

| 命令 | 结果 |
| --- | --- |
| `npx vitest run src/games/smashup/__tests__/abilities/disney-factions-abilities.test.ts` | 9 passed |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/runtimePromptRandomAudit.test.ts --config vitest.config.audit.ts --configLoader native` | 3 passed |
| `npx vitest run src/games/smashup/__tests__/disneyFactionsStatic.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts` | 21 passed |
| `npx eslint ...`（Disney 相关 TS/E2E 文件） | 0 errors；`reduce.ts/types.ts` 仅既有 warnings |
| `npm run typecheck -- --pretty false` | passed |
| `npm run i18n:check` | no missing keys detected |
| `npm run assets:validate` | manifest validate passed |
| `openspec validate add-smashup-disney-aladdin-beauty-nightmare-ralph --strict --no-interactive` | valid |
| `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-disney-four-factions.e2e.ts` | 2 passed |

## E2E 截图核验

| 截图 | 人工观察 |
| --- | --- |
| `D:\GA\BoardGame-smashup-disney-20260725\test-results\evidence-screenshots\smashup\smashup-disney-four-factions.e2e\派系选择页能看到阿拉丁、美女与野兽、圣诞夜惊魂、无敌破坏王并加载迪士尼图集\01-迪士尼四派系-派系选择页可见.jpg` | 派系详情页可见无敌破坏王卡图，Disney atlas 已加载 |
| `D:\GA\BoardGame-smashup-disney-20260725\test-results\evidence-screenshots\smashup\smashup-disney-four-factions.e2e\真实打出“愿望”后可从迪士尼-prompt-抽到四派系牌并清空交互\03-愿望-迪士尼prompt出现.jpg` | “愿望”prompt 出现，真实打牌入口触发 |
| `D:\GA\BoardGame-smashup-disney-20260725\test-results\evidence-screenshots\smashup\smashup-disney-four-factions.e2e\真实打出“愿望”后可从迪士尼-prompt-抽到四派系牌并清空交互\04-愿望-抽到四派系牌并收口.jpg` | 手牌出现阿布、贝儿、怪物花环、糖果国王；交互已清空 |

## 资源链状态

| 资源 | 本地状态 | 远端状态 |
| --- | --- | --- |
| `public/assets/i18n/zh-CN/smashup/cards/compressed/disney.webp` | exists, 7,904,230 bytes, SHA-256 `37BC0C782FCB2839F9155B610681768A1B6BF233257107CC60C671DED035C2E3` | upload failed; `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/disney.webp` HEAD 404 |
| `public/assets/i18n/zh-CN/smashup/base/compressed/disney_bases.webp` | exists, 1,534,842 bytes, SHA-256 `2CBBC4ED8B68ED678774883D3088C7C93997DE68DC6A68721CDADABFD7C9ACA7` | upload failed; `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/disney_bases.webp` HEAD 404 |

上传命令已定向到单个文件，未扩大到全 Smash Up 历史素材：

- `node scripts/assets/upload-to-server.js --asset-prefix public/assets/i18n/zh-CN/smashup/cards/compressed/disney.webp`
- `node scripts/assets/upload-to-server.js --asset-prefix public/assets/i18n/zh-CN/smashup/base/compressed/disney_bases.webp`

两条均失败于同一外部权限点：

```text
admin@8.148.71.102: Permission denied (publickey,gssapi-keyex,gssapi-with-mic).
```

## 当前结论

本地实现、静态注册、i18n、typecheck、manifest 校验、代表性行为测试和真实入口 E2E 已通过；但服务器素材主源发布未完成，公开资源域名仍 404。因此当前不能宣称“已 push-ready”。最小补救动作是提供/恢复可用于 `admin@8.148.71.102` 的发布 SSH 凭据后，重跑两条定向上传命令并取得两个公开 URL 的 `HEAD 200`。
