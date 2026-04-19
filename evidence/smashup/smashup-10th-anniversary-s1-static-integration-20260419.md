# Smash Up 10th Anniversary 三派系 S1 静态接入证据（2026-04-19）

## 范围

- 资源/ID/图集接入：`CARDS7 / BASE6`（`wangling` / `wangling_base`）
- 三派系静态数据接入：`Mermaids / Skeletons / World Champs`
- 派系选择入口与“实施中”横幅入口接入
- locale 键补齐（zh-CN + en）
- 首批基地能力接入：`Arena`、`Hall of Fame`

## 关键文件

- `src/games/smashup/domain/ids.ts`
- `src/games/smashup/domain/atlasCatalog.ts`
- `src/games/smashup/data/cards.ts`
- `src/games/smashup/data/factions/{mermaids,skeletons,world_champs}.ts`
- `src/games/smashup/ui/factionMeta.ts`
- `src/games/smashup/domain/baseAbilities_expansion.ts`
- `public/locales/{zh-CN,en}/game-smashup.json`
- `src/games/smashup/__tests__/cardI18nIntegrity.test.ts`

> e2e 镜像目录 `e2e/src/games/smashup/**` 已同步同名改动。

## 验证记录

### 1) ESLint（改动文件）

命令：

```bash
npx eslint src/games/smashup/domain/ids.ts \
  src/games/smashup/domain/atlasCatalog.ts \
  src/games/smashup/domain/baseAbilities_expansion.ts \
  src/games/smashup/data/cards.ts \
  src/games/smashup/ui/factionMeta.ts \
  src/games/smashup/data/factions/mermaids.ts \
  src/games/smashup/data/factions/skeletons.ts \
  src/games/smashup/data/factions/world_champs.ts \
  src/games/smashup/__tests__/cardI18nIntegrity.test.ts
```

结果：`0 errors`（仅历史 warning，未新增 error）。

### 2) i18n 完整性

命令：

```bash
npm run i18n:check
```

结果：通过（`no missing keys detected`）。

### 3) 目标测试

命令：

```bash
npx vitest run src/games/smashup/__tests__/cardI18nIntegrity.test.ts
```

结果：通过（`22 passed`）。

### 4) OpenSpec 校验

命令：

```bash
openspec validate add-smashup-10th-anniversary-factions --strict --no-interactive
```

结果：通过（`Change ... is valid`）。

## 当前结论

- S1 静态接入链路完成，可在派系列表侧展示三派系并进入卡池/基地数据层。
- S2 机制实现当前已落首批基地能力（Arena/Hall of Fame），三派系卡牌机制仍需继续分批实现。
