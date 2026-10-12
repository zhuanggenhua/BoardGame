# Fate/Domination 规则来源表

重锁日期：2026-10-11
历史 Wiki 抓取：2026-09-25（降为 QA 对照，本轮不可达）

## 来源优先级

1. 用户指定的本地中文规则书：`FD全卡图鉴V1.0.chm` 的「前情提要与内容物介绍」「进行一场圣杯战争」。
2. 同一 CHM 的卡牌图鉴截图：中文卡面字段的主图面证据。
3. 本地 TTS Workshop `2047461756.json` 与 `Mods\Images\`：英文描述、牌库构成、卡图候选；不能覆盖中文规则书或中文卡面。
4. Fate/Domination Wiki：只做 QA，核对效果是否被误解；不能覆盖 1–3。
5. 旧 Wiki 合同 `core-rules-v0.1.md`、旧 Open Design v3–v6：候选/历史，不自动升级。

## 已确认本地规则页

| 页面 | 用途 | 状态 |
| --- | --- | --- |
| `前情提要与内容物介绍.htm` | 人数、11 天、淘汰、棋盘 A–H、御主/从者组件、令咒、局势/事件字段 | `locked` |
| `进行一场圣杯战争.htm` | setup、3X、NPC、阶段、移动、出牌、战斗、败北、回合结束顺序 | `locked` |
| `局势.htm` / `高潮.htm` | 局势图鉴入口；正文为截图 | `locked`（10+3 图文合同） |
| `事件.htm` / `冬木.htm` | 事件图鉴入口；正文为截图 | `authority-summary`（20 槽位；E0 blocked） |
| 第一批 13 御主 `.htm` | 身份卡 + 附属截图 | 身份 `locked`；附属 `authority-summary`（49 locked + 2 partial） |
| 第一批 14 从者 `.htm` | 概览卡 + 技能截图 | 概览 `locked`（阿尔托莉雅数字概览 blocked）；技能 `authority-summary` |
| `兰斯洛特1.htm` | FZ 狂化兰斯洛特（Berserker） | 概览 `locked` |
| `兰斯洛特.htm` | Saber 兰斯洛特，第一批排除 | `excluded` |

## Wiki 页面（QA，本轮 blocked）

2026-09-25 曾抓到 `How to Play`、`Keywords`、`Power`、`Objectives` 正文。
2026-10-11 再试 `web_search`、`browse_page`、Chrome MCP，全部失败（空结果 / MCP 无法连接）。详见 `evidence/wiki-qa-blocked-2026-10-11.md`。

Wiki 与 CHM 已知需 QA 的点（Wiki 回来后再核）：

- 人数：CHM 3–7；旧 Wiki How to Play 2–7。
- 中文「局势」= Wiki Event；中文「事件」= Wiki Objective。
- 卫宫士郎「远离尘世的理想乡」：CHM 为首次淘汰失去全部魔力继续游戏（已 lock）；TTS 英文漏写魔力代价。不是中文录入错误。

## TTS / 解压包

| 路径 | 实测 | 用途 |
| --- | --- | --- |
| `Fate_Domination3.4纯净中文版.rar` | 用户已解压 | 容器 |
| `Mods\Workshop\2047461756.json` | 14MB，109 ObjectStates | 英文卡面、 nested 组件 |
| `Mods\Images\` | 1798 文件 | 卡图候选 |
| `Mods\PDF\*836BBE7D*.PDF` | 239MB / 83 页，无文本 | Akashic Records 图鉴 |
| `Mods\PDF\*DAD70548*.PDF` | 61MB / 15 页 | Master Database，不是规则书 |
| TTS bag `Rules and Learning Materials` | Google Docs URL | 英文规则/FAQ，本轮超时不可达 |

## 抓取限制

- Fandom 本轮不可达。
- Google Docs 英文规则/FAQ：无代理超时，本机代理 `127.0.0.1:7897` 拒绝。
- CHM 角色页无正文，只有 `图包\ScreenShot_*.png`。
- CHM 图包整体约 1.7GB；本轮只抽出第一批 + 规则插图 + 狂化兰斯洛特。
