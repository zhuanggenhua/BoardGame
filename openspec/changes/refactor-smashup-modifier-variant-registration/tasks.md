## 1. Analysis
- [x] 1.1 盘点 Smash Up modifier registries 中当前依赖 `_pod` alias 与 `handlesPodInternally` 的调用点
- [x] 1.2 按变体语义分类现有注册点：自动 alias、自管变体、仅基础版

## 2. Registration Seam
- [x] 2.1 在 `ongoingModifiers.ts` 为 power / breakpoint / base power 三类 modifier 引入显式变体注册接口
- [x] 2.2 让 alias 生成与审计输出统一读取新接口语义，而不是直接读布尔补丁
- [x] 2.3 让声明式 helper（如 `registerOngoingPowerModifier`）内部选择稳定的变体注册模式

## 3. SmashUp Migration
- [x] 3.1 迁移 `abilities/ongoing_modifiers.ts` 中现有自管变体注册点，移除对外部布尔补丁的依赖
- [x] 3.2 收敛极地突击队员这类“原版有 ongoing、POD 没有对应 ongoing”的特殊规则到新 seam
- [x] 3.3 确认 shared alias 与 base-only 规则在新 seam 下仍保持当前语义

## 4. Verification
- [x] 4.1 补充 registry 级测试，覆盖 auto alias / self-managed / base-only 三类模式
- [x] 4.2 更新极地突击队员回归测试，锁定原版唯一己方随从时只加一次 +2
- [x] 4.3 运行 Smash Up 定向 Vitest：modifier registry、POD registration、black bear cavalry 能力测试
