# 规则对象 × 素材矩阵（第一批 + 主流程）

日期：2026-10-11。\\
基础版当前切片：11 回合主流程 + 第一批 13 御主 + 14 从者。\\
未录入扩展角色进入缺口表，不进入实现。

## 对账

| 规则对象 | 规则数量 | 素材实测 | 承载 | 状态 | 阻塞 |
| --- | --- | --- | --- | --- | --- |
| 棋盘冬木 | 1 | CHM `图片1.png`；TTS 桌面 | 图片，`visible-subject` | 结构与印刷数字 `locked` | 未语义重命名落盘 |
| 御主立牌 | 每玩家 1 | TTS Models/Images；CHM 未单列 | 图片或模型 | `partial` | 第一批 13 立牌未语义命名落盘 |
| 战果标记 | 每玩家 1 | 程序化轨道可表达 | 可读数；图可选 | `locked` 需求；素材 `approved-programmatic` 候选 | 需设计稿确认是否用图 |
| 魔力 0–12 | 每玩家 1 轨 | TTS 魔力表；程序化 | 读数 | 同上 | 脏砚上限 16 必须可显示 |
| 令咒 | 通常 3 | 非卡牌；需 3 枚标记 | token/图 | `partial` | 未定位正式令咒图 |
| 御主身份卡 | 13 | CHM 13 张身份截图 | 卡图 | `locked` 图面；未 runtime 落盘 | 落盘前保持 reference |
| 御主附属 | 因人而异 | CHM 后续截图 + TTS bag | 卡/token | `authority-summary` | 51 张；49 locked + 2 partial |
| 从者概览（金背） | 14 | CHM 14 张（狂化兰斯洛特用 `兰斯洛特1.htm`） | 卡图；开局隐藏 | `locked` 构成；阿尔托莉雅缺数字概览 | 隐藏信息：正面不对其他玩家 |
| 从者技能（红背） | 14×3=42 | CHM 每页 2–4 张技能截图；TTS 有英文 | 卡图 | `authority-summary` | 42 张已登记；逐字完整效果仍待复核 |
| 从者攻击（深蓝背） | 14×12=168 | 概览数字锁定构成；TTS 有单卡 | 卡图 | `authority-summary`（阿尔托莉雅 12 张 blocked） | 168 条索引已对账；逐张完整效果待复核 |
| 局势非高潮 | 10，烧 2，用 8 | CHM 10 个 hashed 图 | 卡图 | `locked`（authority-summary） | 10 张图文已入 situations-10plus3-ocr.md |
| 高潮局势 | 3（命运之夜/身处地狱之门/天之杯） | CHM `高潮.htm` hashed 图 | 卡图 | `locked`（authority-summary） | 3 张图文已入 situations-10plus3-ocr.md |
| 事件 | 20 槽位；16 唯一图 | CHM `冬木1.htm` 截图 | 卡图 | `authority-summary`（19 locked + E0 blocked） | 全集已入 events-fuyuki-ocr.md |
| NPC | 人数&lt;3 时 1 | 复用未选御主立牌 | 立牌 | `deferred` | 第一批可人满 3–7，不阻塞 |
| 牌背金/红/深蓝 | 3 种 | TTS/CHM 可见 | 卡背图 | `partial` | 未单独裁切登记 |

## 布局真相源

- 主棋盘结构：CHM `图片1.png`（A1–H）。
- TTS Workshop JSON 含桌面 ObjectStates，可作坐标参考，不决定视觉风格。
- 无 DOM/BGG 电子版可用。

## 图面已读处置摘要

凡本轮打开过的 CHM 截图均已进 `image-register-first-batch.md`。\\
处置目前全是 `reference` / `duplicate` / `excluded`，尚未 `runtime`。\\
禁止把 temp 截图路径写进 `public/assets`。
