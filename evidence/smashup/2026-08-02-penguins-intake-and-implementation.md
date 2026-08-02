# 2026-08-02 企鹅派系录入与实装证据

## 来源与素材

- 用户提供卡牌图集：`C:\Users\Dqm\.codex\attachments\aad75450-1739-4012-80ae-505dc015b5bc\image-1.png`
  - SHA-256：`B34AC6108260ECDCB21B3896A179438FA637FFF65B73535C3B1E0BD2868B22B7`
  - 尺寸：`2914x4096`
- 企鹅基地图集沿用项目内已有素材源：
  - SHA-256：`6BEE13FE3B910D0A4DD48C0F260EBDD5D38C0A958D434C4BA0AC4BDF164619C2`
  - 尺寸：`2096x1492`
- 官方核对来源：
  - AEG 在线规则书：`https://smashup-rulebook.alderac.com/wiki/Penguins`
  - AEG World Tour Event Kit 插页：`https://www.alderac.com/wp-content/uploads/2020/02/SU-WTEventKit-AEG5557-InsertSheet-copy.pdf`
- 实装口径：用户提供的旧中文图集文本作为本次玩法真相源；官方来源用于核对牌张数量、基地存在性与“从牌库顶打出”类通用机制。

## 图集与数据矩阵

- 卡牌图集：`public/assets/i18n/zh-CN/smashup/cards/penguins.png`
- 卡牌压缩图集：`public/assets/i18n/zh-CN/smashup/cards/compressed/penguins.webp`
- 基地图集：`public/assets/i18n/zh-CN/smashup/base/penguins.png`
- 基地压缩图集：`public/assets/i18n/zh-CN/smashup/base/compressed/penguins.webp`
- 牌组构成：15 种唯一牌，20 张总牌。
- 基地构成：2 张唯一基地。基地原图实际为 `2x2`，其中 `slot 0/1` 均为浮冰，`slot 2/3` 均为殖民地；数据只注册去重后的 `slot 0` 与 `slot 2`。

| 对象 | 数量 | 状态 |
| --- | ---: | --- |
| 冲浪企鹅 | 1 | 已录入并实装移动己方随从 |
| 跳舞企鹅 | 1 | 已录入并实装被打出时尝试改为打出牌库顶牌的可玩近似 |
| 时髦企鹅 | 1 | 已录入并实装从牌库打出时抓 2 张牌 |
| 企鹅司令 | 1 | 已录入并实装登场打出牌库顶第一个随从 |
| 乔装企鹅 | 1 | 已录入并实装天赋打出牌库顶第一个随从 |
| 秘密任务 | 1 | 已录入并实装手牌置底、抓牌、洗牌流程 |
| 破壳而出 | 2 | 已录入并实装打出牌库顶第一个随从 |
| 反刍企鹅 | 1 | 已录入并实装展示牌库顶 3 张并选择行动牌 |
| 企鹅宝宝 | 4 | 已录入并实装从牌库打出时可打出手牌中力量不大于 3 的随从 |
| 渴望飞翔的工作 | 2 | 已录入并实装“打出企鹅帝皇/选择基地群体 +1 力量”分支 |
| 跳上船 | 1 | 已录入并实装计分后替换基地近似流程 |
| 我不能区分他们 | 1 | 已录入并实装弃掉己方随从、展示并打出下一只不同名企鹅 |
| 水晶礼品 | 1 | 已录入并实装基地打出后给下一只随从 +2 力量 |
| 在冰下 | 1 | 已录入并实装选择基地，按该基地随从数展示并可打出随从 |
| 冰滑道 | 1 | 已录入并实装计分后抓 1 张牌 |
| 浮冰 | 1 | 已录入并实装回合开始时打出牌库顶牌 |
| 殖民地 | 1 | 已录入并实装每次在此基地打出随从时展示并可打出牌库顶随从 |

## 验证

- `openspec validate add-smashup-penguins-faction --strict`：通过。
- `node scripts/assets/generate_asset_manifests.js --root public/assets/i18n/zh-CN --id smashup`：通过。
- `node scripts/assets/generate_asset_manifests.js`：通过。
- `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id smashup`：通过。
- `node scripts/assets/generate_asset_manifests.js --validate`：通过。
- `npm run typecheck -- --pretty false`：通过。
- `npx vitest run src/games/smashup/__tests__/abilities/penguins.test.ts --reporter=dot`：通过。
- `npm run i18n:check`：通过。
- `npm run build`：通过；仅保留项目既有 CSS / 字体解析 / chunk size / dynamic import 警告。

## 服务器素材上传状态

- 上传预检命令：
  - `node scripts/assets/upload-to-server.js --check --asset-prefix i18n/zh-CN/smashup/cards/compressed/penguins --asset-prefix i18n/zh-CN/smashup/base/compressed/penguins`
- 预检结果：
  - `official/i18n/zh-CN/smashup/cards/compressed/penguins.webp`，`1902054` bytes，MD5 `1f5b8980fd64017b008ee96276fe21f9`
  - `official/i18n/zh-CN/smashup/base/compressed/penguins.webp`，`1118082` bytes，MD5 `c2ad8a5ed2bd9921b3bcd7932cb75126`
- 正式上传状态：阻塞。
  - 上传命令两次超时未返回成功。
  - 直接 SSH 探测 `admin@8.148.71.102 boardgame-asset-publish` 返回 `Permission denied (publickey,gssapi-keyex,gssapi-with-mic).`
  - 公网代表性 URL `HEAD` 仍为 `404`。
- 结论：PR 已包含 PNG 与 WebP 图集及 manifest；服务器 CDN 发布需要拥有对应 SSH 权限的维护者执行。

## 残余风险

- 跳舞企鹅、我不能区分他们、跳上船等涉及“替换/打断当前结算”的复杂条款已经做到可游玩近似；当前引擎事件模型不一定能完全等同实体规则中的所有时序细节。
- 已补关键代表性测试覆盖静态构成、图集格位、派系元数据、破壳而出从牌库打出与时髦企鹅从牌库打出抓牌。
