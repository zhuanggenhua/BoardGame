# Decisions（决策记录 · ADR）

用 ADR 记录为什么这样划边界、为什么定这种结构、为什么采用某个长期职责归属。执行规则不写在这里。

## 怎么写一条 ADR

- 一个决策 = 一个文件 `NNNN-<slug>.md`，编号递增。
- 一旦记录不改写；被推翻就新增一条，把旧状态标成“被 NNNN 取代”。
- 无 frontmatter。格式：

      # NNNN · <一句话决策>

      - 日期：YYYY-MM-DD
      - 状态：生效 | 被 NNNN 取代

      ## 背景

      ## 决策

      ## 后果

## 索引

| 编号 | 决策 | 状态 |
| --- | --- | --- |
| 0001 | [AI 规范与 OpenSpec 分离](0001-ai-spec-structure-migration.md) | 生效 |
| 0002 | [时点-机会-结算升级为平台级规则内核](0002-timing-opportunity-resolution-core.md) | 生效 |
