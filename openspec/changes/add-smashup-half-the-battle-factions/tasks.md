## 1. Intake Contract
- [x] 1.1 Record local source folder, card/base image hashes, dimensions, copy counts, and atlas slot mapping.
- [x] 1.2 Record Wiki/API comparison source for English names, rules text, counts, powers, breakpoint, and VP data.

## 2. Static Runtime Integration
- [x] 2.1 Generate card/base atlases from the provided local images and compress runtime WebP variants.
- [x] 2.2 Register atlas ids, faction ids, display names, and faction metadata.
- [x] 2.3 Add card/base static data and register it in the Smash Up card/base registry.
- [x] 2.4 Add zh-CN and en locale entries for all new factions, cards, and bases.
- [x] 2.5 Rebuild asset manifests for the new runtime resources.

## 3. Verification
- [x] 3.1 Add intake tests for card counts, deck copy counts, preview refs, bases, locale keys, and atlas paths.
- [x] 3.2 Extend critical image resolver tests for the new Half the Battle atlases.
- [x] 3.3 Run focused Vitest and OpenSpec validation.

## 4. Deferred Gameplay Closeout
- [x] 4.1 Implement representative gameplay handlers for the current high-risk Half the Battle cards and reducer events.
- [x] 4.2 Add focused L2 Vitest coverage for the implemented gameplay chains, including temporary attached-action cleanup.
- [x] 4.3 Complete object-level effect-atom coverage for every new card and base before claiming full faction completion.
- [ ] 4.4 Add direct real-entry L3/L4 E2E with screenshot evidence for the new interaction chains.（2026-08-19 回写：当前只有希瑞、玩乐一整夜和派系选择代表链；非代表对象 direct L3/L4 仍是残余范围）
- [ ] 4.5 Bundle the five source PNG atlases and five compliant runtime WebP atlases into the PR scope per user direction; server asset-source upload remains a production/deployment follow-up because SSH publish credentials are unavailable.（2026-08-19 回写：当前工作区只有 5 个 runtime WebP，5 个源 PNG 图件缺失；该项不能继续视为完成）
- [ ] 4.6 Produce final PR-scope closeout evidence after object-level coverage, E2E, and PR-bundled runtime assets are complete.（2026-08-19 回写：旧 closeout evidence 自检失败，且远端素材发布仍未闭合；四派系保持实施中）
