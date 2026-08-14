# CLAUDE.md

Claude Code entrypoint. The `@import` lines below force-load the `.spec/` core into every session context. The authoritative source is `.spec/`; this file only loads, it defines no rules of its own.

Central doc（项目介绍 + Agent 调度）：

@.spec/AGENTS.md

Knowledge navigation（项目知识导航）：

@.spec/knowledge/README.md

System rules（硬红线）：

@.spec/rules/system.md

Claude-specific:

- Sub-agents and skills are exposed via links: `.claude/agents -> .spec/agents`, `.claude/skills -> .spec/skills`.
- Do not maintain Claude-only rules here. When behavior changes, edit `.spec/`.
