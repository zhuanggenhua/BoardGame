---
name: brainstorming
description: You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation.
---

# Brainstorming Ideas Into Designs

## Overview
Help turn ideas into fully formed designs and specs through natural collaborative dialogue.

Start by understanding the current project context, then ask questions one at a time to refine the idea. Once you understand what you're building, present the design in small sections (200-300 words), checking after each section whether it looks right so far.

## The Process

### Understanding the idea
1. Check out the current project state first (files, docs, recent commits)
2. Ask questions one at a time to refine the idea
3. Prefer multiple choice questions when possible, but open-ended is fine too
4. Only one question per message - if a topic needs more exploration, break it into multiple questions
5. Focus on understanding: purpose, constraints, success criteria

### Exploring approaches
1. Propose 2-3 different approaches with trade-offs
2. Present options conversationally with your recommendation and reasoning
3. Lead with your recommended option and explain why

### Presenting the design
1. Once you believe you understand what you're building, present the design
2. Break it into sections of 200-300 words
3. Ask after each section whether it looks right so far
4. Cover: architecture, components, data flow, error handling, testing
5. Be ready to go back and clarify if something doesn't make sense

## After the Design

### Documentation
1. Write the validated design to `docs/plans/YYYY-MM-DD-<topic>-design.md`
2. Use `elements-of-style:writing-clearly-and-concisely` skill if available
3. Commit the design document to git

### Implementation (if continuing)
1. Ask: "Ready to set up for implementation?"
2. Use `superpowers:using-git-worktrees` to create isolated workspace
3. Use `superpowers:writing-plans` to create detailed implementation plan

## Key Principles
- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended when possible
- **YAGNI ruthlessly** - Remove unnecessary features from all designs
- **Explore alternatives** - Always propose 2-3 approaches before settling
- **Incremental validation** - Present design in sections, validate each
- **Be flexible** - Go back and clarify when something doesn't make sense
