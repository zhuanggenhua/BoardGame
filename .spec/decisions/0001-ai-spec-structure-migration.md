# 0001: AI 规范与 OpenSpec 分离

## 结论

AI 规范归 `.spec/`；产品规格、提案和产品任务归 `openspec/`。两边互不复制正文。


## 职责

| 职责 | 当前入口 |
| --- | --- |
| AI 硬边界 | `.spec/rules/` |
| 项目标准与知识 | `.spec/knowledge/` |
| 项目 workflow | `.spec/skills/` |
| 结构裁决 | `.spec/decisions/` |
| 产品规格与任务 | `openspec/` |

## 迁移规则

- 旧 AI 规范正文迁入 `.spec` 后删除旧入口；追溯靠 Git 历史。
- OpenSpec 文档不得承载 AI 执行规范。
- 迁移裁决只记录职责去向，不复制旧正文全文。
- 结构 lint 检查目录、索引、链接和 frontmatter。
