# Token Cost Notes

本文件是成本估算，不是质量 gate。实际成本主要由参考图复杂度、spec 深度、代码修改量和 render-review 轮次数决定；不得用这里的数字承诺工期或验收结果。

## Where the tokens go per full object reconstruction

| Stage | Est. model tokens | Notes |
|---|---|---|
| Deterministic scripts (probe, assessment, spec, validate, generate, sync) | ~2k-5k total | Run as subprocesses. This is the work that is near-free. |
| Read the reference image | <1k | A small reference; higher-res costs more. |
| Author assessment + detail inventory + spec JSON | ~15k-25k | The spec is the largest text artifact. |
| Write and edit the Three.js factory | ~20k-45k | Scales with part count and edit iterations. |
| Render-review loop (5-8 cycles) | ~30k-70k | The dominant cost; scales linearly with cycles. |
| **Total, one object** | **~80k-180k** | Simple/few-cycles to complex/many-cycles. |

## One render-review cycle in isolation

| Step | Est. model tokens |
|---|---|
| Capture screenshot (browser tool) | ~0 (tool call) |
| Package comparison sheet (stdlib script) | ~0 (subprocess) |
| Inspect the comparison sheet with vision | ~2k-3k |
| Write the review and scores (script) | ~1k-2k |
| **Per cycle** | **~5k-12k** |

## Character reconstruction cost

Characters cost more (more review cycles plus landmark and projection checks): roughly ~150k-350k for a full stylized or likeness-maximized reconstruction with the v1.2 character generator.

## 使用口径

- 脚本 gate、detail counting、sheet packaging 和状态记录应尽量由 deterministic 脚本完成。
- 模型上下文主要花在读图、写 spec、改 factory 和图面对比判断。
- 节省成本的核心不是少读规范，而是先写好 spec，减少无效 render-review 轮次。
- 成本估算不能替代 `strict-quality`、截图对比、浏览器渲染和最终 review 结论。
