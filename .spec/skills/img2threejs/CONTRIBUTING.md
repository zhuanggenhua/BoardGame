# Contributing to img2threejs

本文件是上游开发说明，不是 BoardGame 执行规范。

## 可改区域

- `grimoire/`：geometry、material、intake、review 规则。
- `forge/`：pipeline 脚本、generator、validator、review harness。
- `forge/tests/`：schema、gate、generator 和回归测试。
- `SKILL.md` / `README.md`：入口和资料索引。

## 不变量

- code-only procedural Three.js 是默认承诺。
- 脚本保持 Python 3.10+ stdlib；不新增静默 pip 依赖。
- 不静默下载 mesh、贴图包或外部生成资产。
- projection / generative-assist 只能是显式 opt-in，并在输出中标明非默认路径。
- 新 gate、schema 字段或 generator 行为必须有测试。

## 本地验证

```bash
python3 forge/tests/test_pipeline.py
python3 forge/stage2_spec/validate_sculpt_spec.py spec.json --strict-quality
```

历史路线和升级背景见 [`ROADMAP.md`](ROADMAP.md) 与 [`docs/UPGRADE_PLAN.md`](docs/UPGRADE_PLAN.md)，不得用它们替代当前 gate。
