## Context

`fantasyrealms` 当前已经起草 foundation 与双人核心回合两条 change，仓库里也已有对应探索实现；但“牌库里到底有哪些卡、这些卡是否来自正式真相源、当前字段边界是什么”仍缺独立定义。现在 `data/cards.ts` 虽然已经包含 53 张基础卡，却还只是实现事实，不是正式 capability。

这一步的关键不是再补一层 UI，而是把后续所有玩法实现都会依赖的数据底座收口清楚：

- 哪个文件是真相源
- 哪些字段已经可靠
- 哪些字段暂时不能猜
- runtime deck 与 foundation 样例卡位如何复用同一份正式数据

## Goals / Non-Goals

- Goals:
  - 为幻想国度基础卡表建立正式 capability、proposal、tasks 与 spec
  - 让官方 53 张基础卡具备可追溯的录入合同
  - 用测试锁住数量、花色分布、`id` 唯一性与克隆边界
  - 修正文档，把“官方卡表已接入、完整计分未接入”说清楚
- Non-Goals:
  - 不在本轮实现完整计分、封印优先级与野牌解析
  - 不在本轮新增外部 Wiki 抓取或第三方真相源
  - 不在没有正式逐卡中文真相源的前提下猜中文卡名或中文效果

## Decisions

- Decision: 以 `Fantasy_Realms_Cards.xlsx` 作为基础卡表主真相源，以 `规则.txt` 作为玩法边界对照源
  - Why: 当前仓库里只有 xlsx 提供逐卡结构化字段，规则文本只提供总体规则与双人变体，不提供完整逐卡中文名录。

- Decision: 当前 `name` 与 `text` 继续保留英文原文
  - Why: 没有逐卡中文真相源时，直接翻译会把“录入”变成“猜测”，这和数据录入规范冲突。

- Decision: 运行时卡库、foundation 样例卡位都复用同一份官方卡表数据
  - Why: 避免 foundation 再维护一套虚假的演示牌，后续玩法与 UI 容易漂移。

- Decision: 用独立 capability 管理卡表层，而不是把这部分塞回 `fantasyrealms-gameplay`
  - Why: 这不是“抽牌/弃牌循环”的行为变化，而是玩法底层数据合同；后续完整计分也会直接依赖它。

## Risks / Trade-offs

- Risk: 当前 `id` 是根据英文花色与英文卡名人工整理出来的，若未来更换真相源，可能发生命名漂移
  - Mitigation: 在合同文档里显式登记 `id` 规则与 53 张卡的当前映射，后续改动必须显式更新合同和测试。

- Risk: 文档只登记总表，不做逐卡合同，会让后续计分实现时继续回到“看代码猜数据”
  - Mitigation: 本轮合同文档直接列出 53 张卡的行号、源字段与运行时映射。

## Migration Plan

1. 新建 `add-fantasyrealms-official-card-catalog` change。
2. 补 `src/games/fantasyrealms/rule/official-card-table-contract.md`。
3. 为卡表接入新增定向测试。
4. 修正文档口径并运行验证。

## Open Questions

- 未来逐卡中文卡名/效果文案会来自哪一套正式真相源，目前仍待后续 change 决定。
