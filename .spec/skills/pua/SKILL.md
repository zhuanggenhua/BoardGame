---
name: pua
description: '卡住后的强压诊断入口。用于反复失败、微调无效、甩锅环境、未验证交付；首次失败不用。'
---

# PUA Driver

Use this skill as an internal pressure mode. Push harder, but stay factual,
respectful, and evidence-driven.

## Guardrails

- Do not attack the user or any real person.
- Do not fabricate facts, logs, tests, or certainty.
- Do not use empty threats or repetitive abuse.
- Do not ask the user to do manual work until local search, reading, and
  verification are exhausted.
- If the task is still blocked after real investigation, hand off with
  structured facts.

## Core Rules

1. Stop excuse-making.
2. Search before guessing.
3. Read source before theorizing.
4. Change strategy, not just parameters.
5. Verify after fixing.
6. Extend the fix to adjacent risks when reasonable.

## Escalation Levels

### L1

Use after the second failed attempt.

- Stop the current line of attack.
- Switch to a fundamentally different approach.
- State what made the old approach repetitive or weak.

### L2

Use after the third failed attempt.

- Collect the exact failure signal.
- Read the relevant source, docs, or raw artifact.
- List 3 materially different hypotheses.

### L3

Use after the fourth failed attempt.

- Complete the full checklist below.
- Build the smallest reliable reproduction or isolation.
- Reduce the problem to a narrower boundary before proceeding.

### L4

Use after the fifth failed attempt or when the agent is about to give up.

- Build the smallest possible proof of concept.
- Test in an isolated setup when possible.
- Use a different toolchain, stack, or direction if needed.

## Mandatory Workflow

1. Read the failure literally.
2. Search the exact error, symptom, or rejection.
3. Read raw context: source, docs, logs, config, or data.
4. Verify assumptions with tools.
5. Invert the main assumption and inspect the opposite direction.
6. Execute one new plan with a clear verification target.
7. Verify end to end and scan for adjacent damage or duplicates.

## Failure Patterns

- `loop`: same idea, different parameters
- `give-up`: manual-user fallback, "cannot", or unverified environment blame
- `guess`: no search, no docs, no source reading
- `quality`: superficially done, not actually solved

## Checklist

- Read the exact failure signal.
- Search the core issue with tools.
- Read the raw source or original material.
- Verify versions, paths, permissions, inputs, and assumptions.
- Test an opposite hypothesis.
- Isolate a minimal reproduction or boundary.
- Verify the result after the fix.
- Check for nearby or duplicate issues.

## Safe Exit

If the task succeeds, verify the original outcome and report the evidence. If it remains blocked after completing the checklist, report:

1. Confirmed facts
2. Ruled-out paths
3. Reduced problem scope
4. Best next action
5. Handoff notes
