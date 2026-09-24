# Fate/Domination intake

状态：`S0 in_progress`

本目录只承载新游戏的规则、来源、对象全集和数据录入合同。
当前阶段不创建 Board、runtime UI、正式 manifest 或玩法实现。

## 当前真相源

- 主真相源：Fate/Domination Wiki，入口页
  `https://fatedomination.fandom.com/wiki/Fate/Domination_Wiki`
- 规则主页：`https://fatedomination.fandom.com/wiki/How_to_Play`
- 规则分类：`https://fatedomination.fandom.com/wiki/Category:Rules`
- 对照源：Fate/Domination Wiki 的对象页、分类页和页面内卡面/规则图。
- 抓取日期：2026-09-22。

直接请求 Fandom 页面在当前环境超时，因此本轮以搜索索引返回的页面正文/摘要作为
可回查证据，并在规则来源表中保留页面 URL。后续若需要锁定卡面文字、数量或图像
字段，必须继续补原始页面或图片证据，不能用本轮摘要猜测。

## 已产出

- `rules/source-index.md`：规则来源、页面清单和抓取限制。
- `rules/core-rules-v0.1.md`：首版核心规则合同，明确已确认与未确认内容。
- `catalog/required-data-v0.1.md`：根据规则反推的必要数据清单和抓取顺序。

## 状态口径

- `locked`：规则或对象字段有明确来源定位，可以作为下一层数据输入。
- `partial`：已找到对象/页面，但仍缺完整列表、字段或图面证据。
- `blocked`：当前来源无法读取或存在冲突，不能猜测。
- `deferred`：规则上存在，但不阻塞当前最小可玩切片。
