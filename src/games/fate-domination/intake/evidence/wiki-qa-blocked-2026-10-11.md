# Wiki QA 角色重定与本轮抓取失败

日期：2026-10-11。

## 角色重定

用户当轮裁定：

- 规则书优先用本地中文包（CHM）。
- Wiki 主要做 QA，防止卡牌效果理解错误。
- Wiki 爬不到就用本地，不阻塞 S0。

因此 Wiki 不再是主真相源。旧 `intake/README.md`（2026-09-25）写「主真相源 = Wiki」已作废。

## 本轮尝试

| 通道 | 目标 | 结果 |
| --- | --- | --- |
| `web_search` `site:fatedomination.fandom.com How to Play` | 规则 QA | 空结果 |
| `browse_page` `https://fatedomination.fandom.com/wiki/How_to_Play` | 规则 QA | 空结果 |
| Chrome MCP `chrome_navigate` | 同上 | Failed to connect to MCP server |
| Google Docs TTS Rules / FAQ | 英文规则对照 | 无代理超时；`127.0.0.1:7897` 连接拒绝 |

## 历史对照（不覆盖 CHM）

2026-09-25 浏览器曾抓到 Wiki `How to Play`：2–7 人、11 轮、Prep/Outpost/Action/Combat、8/9/10 淘汰、20 张 Objective、10+3 Event。\\
该摘要可继续当 QA 清单，等 Wiki 可达时复核，不能改写 CHM 已锁字段。

## 必需 QA 队列（恢复网络后）

1. 卫宫士郎 Avalon / 远离尘世的理想乡。
2. 间桐脏砚魔力上限 16。
3. 远坂凛第一回合令咒强制。
4. 局势 vs Event、事件 vs Objective 中英术语。
5. 第一批技能宝具英文页，只核理解、不改中文原文。

状态：`blocked`（QA 通道）；不阻塞本地 CHM 合同与设计前置包。
