import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SMASHUP_ROOT = join(__dirname, '..');

const INTERACTIVE_REPLACEMENT_SOURCES = [
  {
    sourceId: 'base_nine_lives_intercept',
    sourceFile: 'domain/baseAbilities_expansion.ts',
    triggerDefId: 'base_house_of_nine_lives',
  },
  {
    sourceId: 'giant_ant_drone_prevent_destroy',
    sourceFile: 'abilities/giant_ants.ts',
    triggerDefId: 'giant_ant_drone',
  },
  {
    sourceId: 'pirate_buccaneer_move',
    sourceFile: 'abilities/pirates.ts',
    triggerDefId: 'pirate_buccaneer',
  },
] as const;

function readSmashUpFile(relativePath: string): string {
  return readFileSync(join(SMASHUP_ROOT, relativePath), 'utf8');
}

function extractPreventDestroyWhitelist(): string[] {
  const reducer = readSmashUpFile('domain/reducer.ts');
  const match = reducer.match(/const PREVENT_DESTROY_SOURCE_IDS = \[([\s\S]*?)\];/);
  expect(match, 'processDestroyTriggers 必须显式声明 PREVENT_DESTROY_SOURCE_IDS 合同').not.toBeNull();
  return [...match![1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

function extractEngineGuidePreventDestroyIds(): string[] {
  const guide = readSmashUpFile('rule/ENGINE_GUIDE.md');
  const matches = [...guide.matchAll(/`([a-z0-9_]+)`/g)]
    .map((entry) => entry[1])
    .filter((id) =>
      id.endsWith('_intercept')
      || id.endsWith('_prevent_destroy')
      || id.endsWith('_move')
      || id === 'kitty_cats_hang_in_there');
  return [...new Set(matches)];
}

function readProjectEngineSystemsGuide(): string {
  return readFileSync(join(SMASHUP_ROOT, '..', '..', '..', '.spec', 'knowledge', 'standards', 'engine-systems.md'), 'utf8');
}

function readSmashUpEngineGuide(): string {
  return readSmashUpFile('rule/ENGINE_GUIDE.md');
}

describe('destroy pendingSave replacement contract', () => {
  it('交互式 onMinionDestroyed replacement sourceId 必须全部进入 pending-save 白名单', () => {
    const whitelist = extractPreventDestroyWhitelist();

    for (const { sourceId, sourceFile, triggerDefId } of INTERACTIVE_REPLACEMENT_SOURCES) {
      const source = readSmashUpFile(sourceFile);
      expect(source, `${sourceFile} 应继续声明 ${sourceId} 交互入口`).toContain(`sourceId: '${sourceId}'`);
      expect(source, `${triggerDefId} 应继续注册为 onMinionDestroyed replacement`).toContain(
        `registerTrigger('${triggerDefId}', 'onMinionDestroyed'`,
      );
      expect(source, `${triggerDefId} replacement 入口必须继续标记 phase:'replacement'`).toContain(
        "phase: 'replacement'",
      );
      expect(whitelist, `${sourceId} 创建交互后必须让 processDestroyTriggers 暂缓 MINION_DESTROYED`).toContain(
        sourceId,
      );
    }
  });

  it('SmashUp ENGINE_GUIDE 的 pending-save sourceId 示例必须与 runtime 白名单保持一致', () => {
    expect(extractEngineGuidePreventDestroyIds().sort()).toEqual(extractPreventDestroyWhitelist().sort());
  });

  it('项目总规范只保留路由，SmashUp pendingSave 白名单合同必须落在游戏文档', () => {
    const engineSystemsGuide = readProjectEngineSystemsGuide();
    expect(engineSystemsGuide).toContain('具体游戏 runtime 例外');
    expect(engineSystemsGuide).toContain('docs/games/<gameId>/');

    const smashUpEngineGuide = readSmashUpEngineGuide();
    expect(smashUpEngineGuide).toContain('PREVENT_DESTROY_SOURCE_IDS');

    for (const { sourceId } of INTERACTIVE_REPLACEMENT_SOURCES) {
      expect(smashUpEngineGuide, `SmashUp ENGINE_GUIDE 应点名 ${sourceId} 所属合同`).toContain(sourceId);
    }
  });
});
