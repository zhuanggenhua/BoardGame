# Examples of Planning with Files

## Example 1: Implementing a New Feature

**User Request**: "Add a dark mode toggle to the settings page."

**Agent Action 1: Create Plan**
*Agent creates `task_plan.md` using the template.*

```markdown
# Task Plan - Dark Mode
## Goal
Implement a persistent dark mode toggle in the Settings page that updates the global UI theme.

## Phases
- [ ] Phase 1: Theme Context Setup
- [ ] Phase 2: UI Component Implementation
- [ ] Phase 3: Persistence Logic (localStorage)
```

**Agent Action 2: Research**
*Agent checks existing CSS variables. Creates `findings.md`.*

```markdown
# Findings
## Research
- Found `colors.css` defining root variables.
- We are using Tailwind, so we need `darkMode: 'class'` in config.
```

## Example 2: Handling a "Lost" Session

**Situation**: The agent API timed out or the window was closed. You come back to the prompt.

**Agent Action**:
1. Check `progress.md`. "Last action: Modified `tailwind.config.js` at 14:02".
2. Check `task_plan.md`. "Phase 1: Pending".
3. **Resume**: "I see I was configuring Tailwind. Let me verify the file content and proceed."
