---
name: show-image-to-user
description: '给用户看本地图入口。BoardGame 项目默认用 PureRef 打开；PureRef 不可用时降级系统图片查看器；用户明确要求在对话内展示时才用 Codex App 内联；用于“打开图/图呢/给我看/我看看”；只展示已验证最终图，不展示候选或失败图。'
---

# Show Image To User

## BoardGame Project Adapter

This project copy is the repository execution entry. It preserves the system image-display safety rules and applies the BoardGame user preference that user-facing image delivery defaults to PureRef.

- 主证据目录：`test-results/evidence-screenshots/<game>/<测试文件>/<用例>/`；目录、文件名和流程阶段遵循 `.spec/knowledge/standards/e2e-verification.md`。
- 候选图、失败图和中间排查图不得作为最终 `passed` 交付；它们只能留在本地 evidence 或标为诊断材料。
- 服务器相册不是默认交付。只有用户明确要求上传、发布链接、服务器相册或手机查看时，才允许发布到 `http://8.148.71.102:18080/#/boardgame/<task-id>`。
- 获得明确上传授权后，只允许更新 `/home/admin/image-preview/data/projects/boardgame/tasks/<task-id>/`，禁止修改预览站壳层、根路由或客户端代码。
- 项目开图脚本入口：

```powershell
npm run verify:open-image -- --viewer pureref --path "<单张最终原图绝对路径>"
node scripts/verify/open-verified-image.mjs --viewer pureref --paths "<00-sequence-index.png>" "<01-labeled-*.png>" "<02-labeled-*.png>"
```

- `scripts/verify/open-verified-image.mjs` 只负责发起并回报查看器动作；脚本成功不等于用户已经看到图片。
- `.spec/skills/show-image-to-user/scripts/label-image-sequence.py` 是项目内唯一的标记脚本，负责生成全尺寸标记副本和序列索引，不覆盖原图。具体何时生成、打开哪组文件仍由本 skill 的通用规则决定。
- 项目证据资格另由 `.spec/knowledge/standards/e2e-verification.md` 和 `.spec/knowledge/standards/ui-change-gates.md` 负责；本节不复制它们的验收正文。
- **当前用户偏好覆盖（强制）**：BoardGame 项目内，用户可见图片交付默认使用 PureRef，包括 Codex App / Codex desktop 环境。只有用户明确说“在这里打开 / 内联展示 / 发在对话里”，或 PureRef 与系统图片查看器都不可用时，才使用 Codex App Markdown 内联作为展示通道。

## Core Rule

Default to **not opening anything** unless the image is either explicitly requested by the user or already selected as a final validated closeout/acceptance image.

- If a screenshot/image is produced as evidence, validation output, or a failed/partial candidate, first validate it as needed and report the absolute path.
- Open/display an image when the user explicitly asks to see/open it, or when a workflow has produced a final closeout/acceptance image that has already passed AI visual validation. In the second case, opening is mandatory: do not stop at "validated", "passed", or a file path.
- User preference: in the BoardGame project, the default user-facing delivery is PureRef, including Codex App / Codex desktop. If PureRef is unavailable, does not stay running, or cannot accept the image, fall back to the Windows/system image viewer. Use Codex App inline Markdown only when the user explicitly asks for in-chat display or external viewers fail.
- For final closeout/acceptance images that have passed AI visual validation and are deliberately selected for user review, proactively display the original artifact in the same turn. Do not wait for another `图呢` / `打开图` request. This preference does not allow displaying intermediate, failed, stale, candidate, or unvalidated images as accepted artifacts.
- Do not treat "E2E passed", "screenshot generated", "evidence updated", "screenshot chain complete", or "I need to inspect the image" as permission to open a local viewer; the image itself must be selected as the final user-facing closeout image and pass visual validation first.
- If the user asks for a path, provide the absolute path and do not open the image.

## Final Response Gate

Before sending any final response for a task that produced or validated a screenshot/image, perform this gate:

1. Did the task select a final user-facing closeout/acceptance image or complete ordered image set?
2. Did AI visual validation pass for that exact original image or every exact original image in the set?
3. Has that exact image or exact image set been displayed in Codex App with Markdown image syntax, or has a PureRef / system-viewer open attempt succeeded or failed with explicit evidence in this same turn?

If answers 1 and 2 are yes but answer 3 is no, the final response is prohibited. Display/open the image or image set first, then report. A `view_image` preview, OCR/contact-sheet reading, screenshot path, or statement such as "AI validation passed" never satisfies answer 3. In this project, PureRef is the default way to satisfy answer 3; a Markdown image tag with an absolute local path only satisfies answer 3 when the user explicitly selected in-chat display or external viewing failed. Do not wait for the user to say `图呢` when the final validated image is already selected.

Common failure pattern to prevent: after running E2E, inspecting the screenshot with `view_image`, and deciding the UI is acceptable, the assistant replies with only a summary and path. That is incomplete; immediately open the same original screenshot in PureRef, or fall back to the system viewer / explicit inline channel before the final reply.

## Delegation Boundary

- A subagent may resolve paths, validate pixels, generate labels, or run the external viewer command, but its commentary and Markdown are not evidence that the user received a display. The parent agent owns the user-facing turn and must satisfy the Final Response Gate itself.
- If the user explicitly selected Codex App inline display, the parent agent must emit the selected image or numbered image set in its own user-facing response. Do not ask a subagent to emit Markdown and then treat a private subagent message as an inline display.
- A subagent may execute the one required PureRef/system-viewer launch only when the parent delegates that exact action. It must return the command, selected paths, viewer result, and any process evidence. The parent reports that result without claiming an App inline display.
- When the parent cannot determine whether the user-facing channel is Codex App, it must not infer the channel from agent role or tool availability. The user's instruction `在这里打开` selects the App inline channel; all other opening requests use the external-viewer path.

## Multi-State Evidence Gate

Some business behavior cannot be proven by a single screenshot. If the active target includes pagination, page turning, carousel, tabs, accordion, modal open/close, toggle on/off, before/after, PC/mobile comparison, step flow, or branching state, the default acceptance artifact is an ordered image set, not one latest image.

- Pagination/page-turning minimum: open at least two original screenshots as one ordered set: the current/first page before turning and the target/next page after turning. If the button state is part of the requirement, the set must show the relevant left/right button enabled/disabled state.
- A single "after turning" screenshot is not enough to claim pagination validation. It cannot prove the starting page, the page-turn action, the before/after difference, or the business chain.
- Multi-state final delivery must pass AI validation as a set. Validate that the selected images together cover the required states, sequence, and visible controls; do not validate only the prettiest or newest frame.
- The user-facing display action must open the whole ordered set in one PureRef launch attempt by default, or show it in Codex App as numbered Markdown images only when inline display was explicitly selected or external viewing failed, then report the exact order-to-meaning mapping. Do not show only the last image, and do not launch PureRef once per frame.
- Only allow a single image when the user explicitly asks for one frame, such as `只看一张`, `只打开最新图`, or `只看翻页后`. In that case, state that the image is a single-frame proof, not complete business-flow validation.

## Separation Of Responsibilities

- **AI image reading / validation** means the assistant inspects an image to decide whether it passes. Use lightweight previews, OCR, contact sheets, crop scripts, `view_image`, or other assistant-side viewers when necessary. Do not open PureRef for this purpose.
- **User image viewing / acceptance** means the user needs to see the final image. In BoardGame, use PureRef first and fall back to the system image viewer only when PureRef cannot be used. Use Codex App Markdown rendering with the absolute local path only when the user explicitly asks for in-chat display or external viewers fail.
- **Displaying an image is a victory declaration, not a work-in-progress step.** Unless the user explicitly asks to see the image now, Codex inline display, PureRef, or an external viewer means "this is the selected user-facing artifact." Do not use it while still investigating, comparing candidates, checking E2E output, or deciding whether the screenshot passes. Once an image is validated and selected as the final acceptance artifact, user-facing display is required before the final report.
- **Choose exactly one user-facing display channel per delivery.** Before displaying, decide whether this delivery uses Codex App inline Markdown, PureRef, or the system image viewer. After one channel succeeds, do not display/open the same selected image set in another channel in the same turn. If the wrong channel was used by mistake, report that mismatch and wait for an explicit correction request instead of “fixing” it by opening a second viewer.
- Never open every screenshot generated by an E2E run. Pick only the required final acceptance images after validation. Intermediate, diagnostic, failed, stale, or candidate screenshots stay as paths plus written findings.
- For multiple selected images in Codex App, render them as a numbered ordered set with one Markdown image per original artifact. For multiple selected images in PureRef, launching PureRef once per image is a failure even if every file opens; build one image path array and make exactly one PureRef launch attempt for that array. Only fall back to per-file default opening if PureRef is unavailable or does not stay running.
- For multiple selected images, the assistant must also provide an ordered image-to-content mapping in the same turn. The mapping must use the exact inline/PureRef order and explain what each image proves in user-facing terms, such as `1. PC 选择态：事件牌 + 骰盘 + 属性选项`. Do not just say “已打开 8 张图” or rely on filenames.
- If the displayed/opened images are diagnostic, stale, failed, or not yet accepted, the ordered mapping must say that explicitly for each group before describing content. Do not let a visible image imply acceptance merely because it rendered.
- Showing an image to the user is not validation. AI validation is a separate step with a written pass/fail judgment; PureRef / system viewer / explicit Codex inline display is only the display channel after that judgment or after an explicit user request.
- **User-facing opens must use original-resolution acceptance artifacts.** For a single image, open the original screenshot/render/image that proves the target. For multiple images, open full-size labeled duplicates when sequence clarity matters, while preserving and reporting the original paths. Low-resolution previews, contact sheets, OCR crops, thumbnails, or downsampled composites are only for assistant-side validation. Open a contact sheet/composite only when the user explicitly asks for an overview/comparison sheet, or when that composite itself is the final requested deliverable.
- **Blank or labels-only composites are failed artifacts.** A contact sheet, stitched comparison, sequence index, or overview image that shows empty/black panels, labels without the underlying screenshots, broken thumbnails, or placeholder blocks is not a valid user-facing image. Do not open it as an acceptance artifact. Trace it back to the original full-size screenshots and open the smallest complete ordered set that proves the requested flow.

## Multi-Image Sequence Labels

When external-opening multiple final acceptance images in PureRef, default to generating a labeled handoff set before opening. For Codex App inline delivery, use a numbered Markdown image sequence and written order mapping; labeled duplicates are optional unless the sequence would otherwise be ambiguous.

- Use `scripts/label-image-sequence.py` to create full-size labeled duplicates and an optional `00-sequence-index.png`; never overwrite the original evidence images.
- Open `00-sequence-index.png` first when it is generated, then open `01-labeled-*`, `02-labeled-*`, and the rest in the same PureRef call. The PureRef argument order must match the visible numbers.
- Labels must be user-facing step names such as `万箭齐发：弹一手改骰前`, not only filenames, test ids, internal fields, or code symbols.
- Labels must preserve the real object type. If a step is about a card, say `卡牌`; if it is about a skill, say `技能`; if it is about a system response window, say `响应窗口`. Do not copy or invent a generic type from an in-game toast, test name, filename, or helper variable when that would misclassify the object.
- Before generating or opening labeled final images, check that each label matches the foremost visible object in the screenshot, not merely a hidden or covered DOM node. If a screenshot is labeled `卡牌特写` but the visible foreground is a skill/attack showcase, response window, dice panel, loading shell, or any other layer, the screenshot is failed/stale and must be regenerated or relabeled as failed; do not package it as an accepted PureRef sequence.
- For end-to-end screenshot sets, each image after the first must explain its relationship to the previous image: what user/system action happened and what visible result it produced. Use the script's `--transition` field for this. A label like `卡牌特写显示首次奖励骰结果描述` is incomplete by itself; prefer a chain label plus transition such as `万箭齐发卡牌：卡牌特写` with `承接: 从 01 打出万箭齐发 -> 弹出卡牌特写，并显示首次奖励骰结果描述`.
- The first image must state the starting context or precondition, such as `起点: 攻击已选中，万箭齐发仍在手牌，奖励骰尚未结算`. Do not make the user infer why step 2 follows step 1.
- Labeled duplicates are a user-viewing aid, not an AI validation shortcut. Do AI validation separately and do not use a low-resolution contact sheet as a replacement for the full-size per-step images.
- If the user explicitly asks for `原图`, `未压缩`, `不加标记`, or equivalent, open the originals, but still provide a clear ordered mapping and, when useful, generate/open the separate sequence index image.
- Final reporting still needs the written order-to-meaning mapping. The visible labels reduce confusion but do not replace the textual explanation.

Example:

```powershell
python ".spec/skills/show-image-to-user/scripts/label-image-sequence.py" `
  --out-dir "<evidence-dir>\_labeled-for-pureref" `
  --title "交互流程截图顺序" `
  --image "<absolute-image-path-1>" --label "万箭齐发卡牌：打牌前" --transition "起点：攻击已选中，卡牌仍在手牌" `
  --image "<absolute-image-path-2>" --label "万箭齐发卡牌：卡牌特写" --transition "从 01 打出万箭齐发 -> 弹出卡牌特写，并显示首次奖励骰结果描述"
```

When the user explicitly asks to open/show an image, treat these expressions as the same user-visible action:

- `打开图片`
- `打开图`
- `图呢`
- `给我看图`
- `截图呢`
- `我看看`
- `重新打开`

For those explicit requests, the task is to make the image visible to the user, not merely to report a path.

## Hard Rule: Assistant Preview Is Not User Display

When the user explicitly asks to see/open an image, do **not** satisfy the request with assistant-only preview tools.

- **`Viewed Image` is forbidden before explicit opening is delivered.** After a user says `打开`、`打开图`、`打开图片`、`给我看图`、`图呢`、`我看看` or an equivalent request, do not call `view_image` or any tool that produces a `Viewed Image` event before the selected image is actually displayed in Codex App or opened through PureRef/system viewer. `Viewed Image` means the assistant inspected a local file; it does not mean the user saw it. If it appears before the user-visible action, classify the request as `OPEN_REQUEST_EXECUTION_FAILED`, immediately perform the required user-visible action with the same original path, and do not describe the preview as an opening attempt.
- **Explicit opening has priority over AI inspection.** For an explicitly requested image, resolve the path and deliver it first. AI-side inspection may occur only after that delivery when separately needed for analysis, and must never replace or delay it.
- `view_image`, OCR/contact-sheet reading, crops, thumbnails, or any other assistant-side visual inspection is **AI validation**, not the user-visible display action.
- A Markdown image tag emitted to the user in Codex App with an absolute local path is **user-visible display** only when inline display is explicitly selected or used as a fallback.
- In BoardGame, open PureRef first to satisfy `图呢` / `给我看图` / `打开图` unless the user explicitly asks for in-chat display.
- If PureRef fails or is unavailable, fall back to the system image viewer; use Codex App inline display only if the user explicitly asks for it or external viewers cannot be used.
- After using `view_image` for AI validation, if the user says `图呢`, `给我看图`, `打开图`, or equivalent, immediately open the selected image through the BoardGame PureRef-first workflow. Do not answer with “已经看过/已经显示/路径在...” unless a user-facing display/open attempt has been made and verified or has failed with evidence.
- A final validated closeout image must be displayed to the user before claiming visual delivery complete. Assistant-side preview alone is incomplete.

## Immediate Response Rule For Explicit User Requests

When the user explicitly asks `图呢`, `截图呢`, `给我看图`, `打开图`, `打开图片`, `我看看`, or equivalent, the first user-facing delivery in BoardGame must be PureRef. If PureRef fails or is unavailable, attempt the system image viewer. Use Codex App inline display only when the user explicitly asks for in-chat display or external viewers cannot be used.

- Do not answer with only a path, evidence location, or statement that a screenshot exists.
- Do not use assistant-side image preview, OCR, contact sheet, or `view_image` as the first delivery action.
- A tool transcript containing `Viewed Image` before Markdown delivery or an external open attempt is a hard failure, even if the assistant later describes the image correctly.
- Do not spend the turn only re-reading this skill if a current selected image path can be resolved from the task context or latest evidence output; open first, then report.
- If the user says the image was not opened/displayed after a screenshot-producing task, treat that as a delivery failure, not as a new request for explanation. Resolve the exact final image or ordered image set from the latest evidence, make the user-visible display/open attempt in the same turn, and only then explain whether the previous failure was missing documentation, missing reference, or execution noncompliance.
- If the user asks to fix the documentation before continuing, update this skill only when the existing canonical rule lacks the failing trigger, exception, or minimum evidence. If the rule already exists, classify the incident as execution noncompliance and do not create a parallel project rule; still open/display the image set before ending the turn.
- For a continued task where the user previously requested PureRef/external viewing for the same image set, a later complaint such as `图没打开`, `截图呢`, or `继续` inherits that display channel unless the user asks for inline display instead. Do not downgrade to path-only or assistant preview.
- If the latest relevant image is failed, stale, diagnostic, or not visually accepted, still open it when the user explicitly asks to see it now, but label it as `unvalidated/failed/current diagnostic`, not as the final acceptance image.
- If no current image path is known, resolve the newest relevant screenshot from the current worktree and task-specific evidence folder, then open it. Only ask the user when multiple equally plausible current images remain after checking timestamps and task names.
- If the user explicitly says `原图`, `压缩前`, `未压缩`, `原始截图`, or equivalent, validation derivatives are disallowed as user-visible targets. Do not open a contact sheet, resized preview, thumbnail, crop, OCR helper image, or compressed comparison image unless the user specifically asks for that derivative. Resolve and open the original evidence artifact(s) that the derivative came from.
- Image selection must match the user's active visual target, not any loosely related screenshot. If the active complaint says mobile/phone/横屏/移动端, prefer paths or screenshot names containing those terms and reject `pc-regression`, `desktop`, `PC`, or unrelated regression folders unless the user explicitly asks for PC. If the active complaint says PC, reject mobile-only evidence. Broad OR matching such as `unrelated-game|教程|移动|横屏` is prohibited because it can select a stale or wrong-side image.
   - When both PC and mobile screenshots exist, display the side the user is asking about first. If the task is comparison, display/open both selected current images in one ordered set; do not show only the newest timestamp if it belongs to the wrong side.
   - When displaying both PC and mobile screenshots, group and order them deliberately: PC baseline/current step first, then the matching mobile step, or otherwise state the chosen order. If screenshots are different workflow stages, label the stage explicitly; do not let the user infer which image is which from a mixed board.
- If the active visual target is a flow or multi-state UI, such as entry -> first page -> last page, setup -> action -> result, PC + mobile, before/after, or opening/closing states, one screenshot is incomplete unless the user explicitly asks for a single frame. Select and display/open the minimal complete ordered set, then provide the ordered mapping.
   - For pagination/page-turning, the minimal complete set is at least two images: before turning and after turning. If there are previous/next buttons on the left and right, the screenshots must make those controls visible when their state matters.
- If the user says the opened image is empty, wrong, stale, or asks why there is only one image, treat that as a delivery failure. First inspect the path that was opened, then replace it with the correct original screenshot(s) or complete sequence; do not defend the old artifact and do not just open one arbitrary replacement unless the target really is a single-frame proof.
- A compliant response to an explicit open/show request must include an attempted PureRef launch, followed by the system viewer only when PureRef fails, unless no local file exists or the user explicitly selected Codex App inline display.
## Required Workflow

1. Resolve the exact image path.
   - If the user asks to view screenshots after a code/data/style change in the same task, do not reuse older evidence screenshots by default. First regenerate the screenshot from the current worktree, current route/test, and current runtime entry that exercises the changed behavior, then open that fresh artifact.
   - If the available screenshot predates the latest relevant edit, treat it as stale. A stale image can be reported as historical evidence only; it must not be opened as the current acceptance image unless the user explicitly asks for that old file.
   - When the user's purpose is visual acceptance of a fix, the image path must prove same-source freshness: same repository/worktree, same changed feature path, and modified after the relevant edit or produced by a just-run screenshot command.
   - If the assistant created a resized preview, contact sheet, thumbnail, crop, OCR helper image, or other validation-only derivative, trace it back to the original evidence image(s) and select those original path(s) for user-visible opening. Do not open the derivative merely because it is the newest image.
   - Prefer the newest relevant screenshot if the conversation says `刚刚的图` or `重新打开`.
   - If multiple plausible images exist, decide whether the target is a single-frame proof or a flow. For a single-frame proof, pick the newest image matching the current task name. For a flow, open the smallest ordered sequence that proves the flow; do not collapse it to the newest single image.
   - If no image exists yet, first generate the screenshot/image, then display it.

2. Open or display the image immediately for explicit user-visible image requests, and for final validated closeout/acceptance images only.
   - First choice in BoardGame: reuse the existing PureRef window if PureRef is already running.
   - Before opening, always check for a running `PureRef` process. If one exists, call `C:\Program Files\PureRef\PureRef.exe` with the image path and treat that as an attempt to add/focus the image in the existing PureRef session.
   - If PureRef is installed but not running, start PureRef with the image path.
   - When opening multiple final acceptance images, pass all selected image paths in one PureRef launch call. Do not loop `Start-Process` once per image, because that can create one PureRef process/window per screenshot. Before running the command, self-check that the command has one `Start-Process -FilePath $pureRef` call for the whole array, not a `foreach` around PureRef.
   - For a multi-image closeout, the intended result is one PureRef session containing the selected images. If PureRef still opens multiple processes after a single multi-path launch, report the before/after process IDs and do not describe it as one reused window.
   - After any PureRef attempt, wait briefly and re-check `PureRef` process IDs. Do not claim the image reused the existing PureRef window unless there was a running PureRef process before the attempt and no new PureRef process ID appeared after the attempt.
   - If a new PureRef process appears after trying to reuse an existing one, report `PUREREF_OPENED_NEW_PROCESS` and do not describe the result as “reused the same PureRef”.
   - If PureRef is unavailable, does not stay running, or fails to accept the image, use the Windows default image opener.
   - Use Codex App inline Markdown only when the user explicitly asks for `在这里打开 / 内联展示 / 发在对话里`, or when both PureRef and the system image viewer cannot be used. In that case, render the original image inline with Markdown using an absolute filesystem path, e.g. `![说明](D:/absolute/path/image.png)`. Prefer forward slashes in Windows paths. If a path contains spaces or characters that may confuse Markdown, use angle brackets inside the image target, e.g. `![说明](<D:/path with spaces/image.png>)`.

3. Do not wait for the user to open it manually after they explicitly ask to open/show it.
   - The assistant must execute the open/display action whenever a local image path is available and the user explicitly requested viewing/opening.
   - Do not say “你自己打开这个路径” unless all automated open/display methods failed and the failure has been reported.

4. Do not stop at a path for explicit open/show requests.
   - A reply like `图片在 xxx` is not enough when the user asked to open or see the image.
   - If a path is useful, mention it only after the image has been opened or displayed.

5. For validation/evidence without an explicit open/show request, open only final validated closeout/acceptance images.
   - Provide or render the screenshot's absolute path.
   - Say whether AI validation passed, failed, or was not performed.
   - Launch PureRef by default, then Windows Photos/system viewer if PureRef fails; render in Codex App inline only when the user explicitly asks for in-chat display or external viewers fail, and only when the image is the final validated closeout/acceptance image.
   - If AI validation passed and the image is the final closeout/acceptance image, display it immediately before reporting completion. A final response that says only `passed`, `validated`, or gives a path is incomplete.
   - Do not open failed, candidate, partial, diagnostic, stale, intermediate, bulk E2E, or unvalidated screenshots automatically.
   - If the image is being opened only so the assistant can inspect it, do not use PureRef and do not present it as user-facing display. Use a low-resolution preview/contact sheet/OCR/crop, `view_image`, or another assistant-side inspection tool instead.

6. Keep AI validation separate.
   - Showing the image to the user does not mean AI has validated it.
   - If the task also requires AI visual validation, perform that as a separate step and write a visible judgment: what is shown, what matches, what differs, and whether it passes.
   - AI validation passing does not imply the image should be opened for the user unless the image is a final acceptance/closeout artifact or the user asked to open/show it.
   - User-facing display before AI validation is complete is prohibited unless the user explicitly requested to see that exact image despite it being unvalidated.

## Failure Handling

- If the image viewer cannot locate the file, immediately verify the path with a directory listing and retry with the resolved absolute path.
- If the image was generated by Playwright or another screenshot tool, check that the file exists and has non-zero size before retrying.
- If Codex App inline display was explicitly selected or used as a fallback but the user says the image did not render, treat that as a display failure and fall back to PureRef or the system image viewer with the same exact original path.
- If the user asked to reuse PureRef and no `PureRef` process is running, say clearly that there was no existing PureRef window to reuse, then start PureRef and verify that it stays running.
- If `Start-Process` returns successfully but no `PureRef` process remains, treat that as a PureRef open failure and immediately fall back to Codex App inline display or the Windows default image opener.
- If an existing PureRef process is running but the open command creates an additional PureRef process, treat it as “PureRef opened a new instance/window”, not as successful reuse. Report the before/after process IDs so the user can see what happened.
- If both Codex App inline display and external opening fail, report the attempted path, whether the file exists, attempted display/open channel, and next minimal fix.

## Codex App Inline Display

Do not prefer this channel by default in BoardGame. Use it only when the user explicitly asks for in-chat display, or when PureRef and the system image viewer cannot be used:

```markdown
![用户可懂的图片说明](D:/absolute/path/to/image.png)
```

Rules:

- The image target MUST be an absolute filesystem path, not a relative path.
- Use the original screenshot/render/image selected for user viewing, not a thumbnail, crop, OCR helper, or assistant-side preview.
- A successful inline Markdown render counts as the user-visible display action for this skill only when this channel was explicitly selected or used as a fallback.
- `view_image` does not count; it is only for assistant-side inspection.
- If the user asks for PureRef, system viewer, external opening, or says the inline image did not show, use the external workflow.

## Windows Commands

Use this workflow by default for BoardGame user-facing image delivery. Prefer and verify the existing PureRef process/window whenever possible. For multiple images, pass every selected image path in one `Start-Process` call:

```powershell
$imagePaths = @(
    '<absolute-image-path-1>',
    '<absolute-image-path-2>'
)
$pureRef = 'C:\Program Files\PureRef\PureRef.exe'
$existingPureRef = Get-Process -Name PureRef -ErrorAction SilentlyContinue
$existingPureRefIds = @($existingPureRef | Select-Object -ExpandProperty Id)

if (Test-Path -LiteralPath $pureRef) {
    Start-Process -FilePath $pureRef -ArgumentList $imagePaths
    Start-Sleep -Seconds 2
    $pureRefAfterOpen = Get-Process -Name PureRef -ErrorAction SilentlyContinue
    $pureRefAfterOpenIds = @($pureRefAfterOpen | Select-Object -ExpandProperty Id)
    $newPureRefIds = @($pureRefAfterOpenIds | Where-Object { $existingPureRefIds -notcontains $_ })
    if ($pureRefAfterOpen) {
        if ($existingPureRef -and $newPureRefIds.Count -eq 0) {
            Write-Output "OPENED_WITH_EXISTING_PUREREF=$($imagePaths.Count)"
        } elseif ($existingPureRef -and $newPureRefIds.Count -gt 0) {
            Write-Output "PUREREF_OPENED_NEW_PROCESS=$($newPureRefIds -join ',')"
            Write-Output "PURE_REF_BEFORE=$($existingPureRefIds -join ',')"
            Write-Output "PURE_REF_AFTER=$($pureRefAfterOpenIds -join ',')"
        } else {
            Write-Output "OPENED_WITH_NEW_PUREREF=$($pureRefAfterOpenIds -join ',')"
        }
    } else {
        Write-Output "PUREREF_DID_NOT_STAY_RUNNING"
        foreach ($imagePath in $imagePaths) {
            Start-Process -FilePath $imagePath
        }
    }
} else {
    foreach ($imagePath in $imagePaths) {
        Start-Process -FilePath $imagePath
    }
    Write-Output "OPENED_WITH_DEFAULT_VIEWER=$($imagePaths.Count)"
}
```

If PureRef is unavailable, use the system default image viewer as fallback:

```powershell
Start-Process -FilePath '<absolute-image-path>'
```

When using `Start-Process`, do not mark AI validation complete. It only opens the image for the user.

## Changelog

- 2026-08-12: Unified viewer order: Codex App uses inline Markdown; outside Codex App, PureRef is the default and the system image viewer is the fallback. `view_image` remains assistant-only validation.
- 2026-08-13: Updated BoardGame user preference: user-facing image delivery defaults to PureRef even in Codex App / Codex desktop; Codex inline display is only explicit request or fallback.
- 2026-07-26: Added a multi-state evidence gate: pagination, page-turning, tabs, toggles, before/after, PC/mobile comparison, and flow states default to an ordered image set. Pagination now requires at least before-turning and after-turning screenshots, and the full set must be displayed together for user acceptance.
- 2026-07-26: Added a hard final-response gate requiring a same-turn user-facing display/open attempt for any selected final image that already passed AI validation. This prevents finishing with only `view_image`, a path, or a written pass verdict and waiting for the user to ask `图呢`.
- 2026-07-21: Added default multi-image PureRef sequence labeling with `scripts/label-image-sequence.py`, so final screenshot sets can be opened with visible order numbers and user-facing step names. Clarified that labels must preserve real object types, such as card vs skill vs response window, and that E2E sets must include previous-step transition notes.
- 2026-07-18: Clarified the active user preference that final validated closeout/acceptance images must be proactively opened in PureRef as original artifacts, while intermediate, failed, stale, candidate, and unvalidated images remain path-only unless explicitly requested.
