---
name: planning-with-files
description: A skill that enables persistent planning and "working memory" on disk using markdown files.
---

# Planning with Files (Manus-style)

This skill enables the agent to maintain a persistent "working memory" on disk, allowing for complex, multi-step tasks to be executed reliably without losing context.

## Core Files (The "Disk")
The agent MUST manage three specific markdown files in the project root:

1.  **`task_plan.md`** (The Map): Stores the high-level goals, phases, and status.
2.  **`findings.md`** (The Knowledge): Stores research, technical decisions, and content "scraped" from the environment.
3.  **`progress.md`** (The Log): Stores a chronological log of actions, identifying "where we are" after a restart.

## Rules of Engagement

### 1. The "Plan First" Rule
**NEVER** start a complex coding or research task without first checking for (or creating) a `task_plan.md`.
- If one exists, **READ IT** to ground yourself.
- If none exists, **CREATE IT** using the `task_plan.md` template from the `references/` folder.

### 2. The "2-Action" Rule (Context Offloading)
The agent has a limited "RAM" (context window). To prevent "context drift":
- **Every 2 browser actions** (search, visit, read), you **MUST** summarize and save findings to `findings.md`.
- **Every 2 major file edits**, you **MUST** update `progress.md`.
- **NEVER** keep large blobs of text (like docs or scrape results) in your context. Save them to `findings.md` immediately.

### 3. The "Read Before Write" Rule (Attention Manipulation)
Before making a significant technical decision or starting a new phase:
- **READ** `task_plan.md` again.
- This forces the global goal back into the "recent tokens" of your attention span, reducing hallucinations.

### 4. The "3-Strike" Error Protocol
If a tool or action fails:
1.  **Attempt 1**: Analyze the error, fix the arguments, and retry. Log in `progress.md`.
2.  **Attempt 2**: Try a *different* tool or approach (e.g., if `grep` fails, use `find`). Log the pivot in `progress.md`.
3.  **Attempt 3**: **STOP**. Do not loop. Write a "Blocker" status to `task_plan.md` and ask the user for help.

## Workflow Triggers
Activate this skill when:
- The user asks for a "plan" or "roadmap".
- The task involves >3 files or >2 distinct phases.
- The user mentions "context lost" or "where were we?".

## Setup
If the files do not exist, copy the templates from the `references/` directory of this skill to the project root.
