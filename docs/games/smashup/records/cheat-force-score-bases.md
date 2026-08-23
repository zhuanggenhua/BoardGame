# Smash Up 强制基地计分调试命令

本文只记录 Smash Up 专用调试命令，不作为通用测试规范。

## 命令

`CHEAT_COMMANDS.FORCE_SCORE_BASES_WITH_MINIONS`

## 用途

把所有有随从的基地临时压到达标状态，用于验证基地计分、afterScoring 和连锁结算。

## 行为

- 只处理有随从的基地。
- 通过 `tempBreakpointModifiers` 临时降低分上限。
- 不修改基地定义。
- 刷新基地或重置游戏后不应继续依赖该临时状态。

## 验证

```bash
npx vitest run src/games/smashup/__tests__/force-score-bases-cheat.test.ts
```
