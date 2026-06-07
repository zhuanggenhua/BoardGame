---
name: generated-design-implementation
description: "Use when implementing UI from an AI-generated design mockup, reference screenshot, or target image. Requires reading the real component/content first, measuring the target image's outer container and key internal gaps, then validating the implementation against those measurements and a fresh screenshot."
---

# Generated Design Implementation

Use this skill when the user asks to build UI from a generated design image or reference screenshot.

## Workflow

1. Read the real UI source and list the fields, buttons, states, and forbidden extras.
2. Classify the real content before prompting or implementing:
   - structural anchors that must stay balanced
   - primary user action(s)
   - supporting context
   - optional or low-value controls that should be omitted or visually minimized
   - content contracts versus old-layout artifacts
3. Rebuild the layout for the new carrier:
   - choose a new grid/flow for the carrier instead of copying the old layout
   - place content modules by role, density, and reading path
   - balance the spread through complementary composition, not mirrored weight or equal columns
   - define where each page/region gets visual closure
4. Inspect the target image and measure:
   - outer container width/height ratio
   - container center position
   - key internal gaps and vertical rhythm
   - for fixed-composition modals/overlays: treat the target draft plus the existing shared modal shell in that scene as the source of truth; reuse the same border/corner/title/divider/input/button grammar before tuning the individual form contents
   - for short-height viewports: recover missing fields/buttons by tightening internal rhythm or enabling local scrolling inside that shared shell; near-fullscreen inflation is only a symptom of getting the shell wrong unless the target is itself fullscreen
   - any divider, badge, or marker alignment relative to text
   - support-region occupancy and leftover whitespace budget; if a page is still mostly empty after valid content is placed, the layout grid is wrong and must be rebuilt
   - content density and legibility metrics for list/table regions: row height, thumbnail size, action size, text scale, and whether the table starts at the same visual band as the target
   - primary-action and navigation-control affordance: control height, width, font size, position, decoration weight, and tap target; lightweight navigation can be visually quiet or transparent when the target shows it that way, but it cannot shrink below a usable control
   - normalized action-control scale when the target image and implementation screenshot use different resolutions: measure button size against the book/page/modal container, not only raw pixels
   - anti-decoration checks for actions: action-type-appropriate affordance, readable label, clear hit area, and spacing that keeps the control part of the workflow instead of a tiny page-corner tag. Primary actions usually need a visible frame; navigation controls must not receive a background when the target image shows a transparent text/icon treatment.
5. Implement the UI against those measurements.
6. Add E2E or script checks for both outer size and internal spacing.
7. Re-open the latest screenshot and compare it against the target image, not just the DOM.
8. Before finalizing, create a same-scale side-by-side comparison or focused crops for the target and current screenshot. The comparison must cover the actual criticized region, not only the full page.
9. Produce a visual verdict with concrete mismatches and next edits. If the verdict is below pass level, continue editing; do not stop at "better than before".
10. If the screenshot filename is reused, record a new filename or `LastWriteTime` to avoid cache confusion.

## Non-negotiables

- New UI is not complete until it passes end-to-end on the real page or carrier it is meant to ship in.
- For primary board or main-page rewrites in BoardGame, desktop real-page review is the first gate. Do not move the task's primary status to mobile adaptation while desktop still has blocking UI bugs, unless the user explicitly asks for a different order.
- If real-page review still finds layout breakage, hierarchy drift, overflow, missing core controls, misleading empty states, or any other user-visible bug in the criticized path, do not report the UI as implemented or complete.
- Passing component tests, DOM assertions, or partial screenshots is not enough when the shipped page still fails the target reading path.
- Do not stop at "the right fields exist".
- Do not accept a matching outer frame if the interior spacing is wrong.
- Do not turn "not fullscreen" into the rule itself. The real rule is to converge back to the target draft and the shared shell's component grammar. If content clips, fix the shell's internal rhythm, local scrolling, or compact branch first while preserving center, margins, and component identity.
- Do not call the result close enough unless the target proportions and the key internal gaps are both within range.
- Do not let generated mockups introduce controls that do not exist in the real product.
- Do not use "primary/secondary" as permission to break an existing balanced layout. Hierarchy means ordering attention within the real structure, not resizing or reweighting major regions arbitrarily.
- Do not weaken supporting regions into emptiness. A secondary/supporting area still needs complete information density, rhythm, and visual closure; it is secondary by action priority, not by being underdesigned.
- Do not accept a secondary/supporting page that only becomes "balanced" by leaving a large blank field around a narrow content strip. If the valid content does not occupy the region with a clear rhythm, reconstruct the grid and spacing before fine-tuning.
- Do not accept list/table regions that technically contain the right rows but render as a tiny, pale list. If the target reads as a ledger/table, verify table grammar: visible column rhythm, readable row height, large enough thumbnails/actions, and a top position that does not leave an unintended blank band.
- Do not enlarge low-value metadata just because it is measurable. Recommended counts, badges, filters, and summary text must stay subordinate unless they directly drive the user's next action.
- Do not shrink primary actions or navigation into decoration. If an action creates, joins, confirms, returns, or changes page state, verify readable label size and a mobile-usable hit area. Use action-type-appropriate affordance: visible frames for primary actions, transparent/lightweight treatment for navigation when the target image shows it that way.
- Do not accept fixed-pixel controls as design-matched when the carrier scales. If the book, page, or modal is enlarged for a wide landscape viewport, action buttons and back controls must scale by container ratio too; a 44px tap target is only a minimum usability floor, not visual fidelity. Scaling a navigation control does not mean adding a background when the reference treats it as text/icon navigation.
- Do not include optional controls by default. If a control does not clearly improve the current screen's main workflow, mark it forbidden in the prompt even if similar code exists nearby.
- Do not confuse content inventory with layout copying. Reading the real UI determines what exists and what matters; the new target may adapt spacing and composition to a different carrier such as a book page.
- Do not preserve a flawed old split just because it is "balanced". When the carrier changes, reconstruct the layout grid from the content model. Balance means resolved composition, not mechanical 50/50 density.
- Do not express tab hierarchy by making peer tabs different component classes or wildly different sizes. Same-level tabs must share one visual grammar; active state may use color, weight, underline, marker, or background treatment, not a separate oversized title style.
- Do not finalize without a side-by-side or crop comparison against the target. Human memory of the target is not evidence.
- Do not stop on a passing E2E if the visual verdict is still "revise". Passing tests are only gates for covered metrics, not proof of visual fidelity.
- Treat this skill as the implementation-validation counterpart to image generation. The image-generation step creates a target; this workflow decides whether the shipped UI actually satisfies that target.

## Completion Gate

Before calling a new UI complete, verify all of the following on the real route, modal, board, or page:

1. The primary user path works end-to-end in the shipped carrier, not only in an isolated component state.
2. The latest screenshot for that real carrier has been re-opened and visually checked after the final edit.
3. Any previously identified real-page bug in that path is either fixed or explicitly recorded as still blocking completion.
4. The final report distinguishes:
   - complete implementation
   - blocked by remaining UI bug
   - optional follow-up polish
5. If the task includes both desktop and mobile work, state whether desktop real-page acceptance has already passed. If not, mobile work cannot be the default next stage unless the user explicitly overrides the sequence.

If item 3 is not satisfied, the correct status is "not complete".

## When to read more

- Read `docs/ai-rules/generated-design-implementation.md` for the full project workflow.
- Read `docs/ai-rules/ui-ux.md` for the shared UI rules and entry point.
- Use `visual-verdict` when screenshot-to-reference judgement is required; target pass threshold is 90+ unless the user explicitly sets a different threshold.
