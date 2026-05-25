import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SMASHUP_ROOT = join(__dirname, '..');

function collectProductionSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'rule') return [];
      return collectProductionSourceFiles(fullPath);
    }
    if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) return [];
    return [fullPath];
  });
}

describe('direct trigger caller contract', () => {
  it('生产代码不得新增未审计的 fireTriggerForSource 直执行入口', () => {
    const callers = collectProductionSourceFiles(SMASHUP_ROOT)
      .flatMap((file) => {
        const rel = relative(SMASHUP_ROOT, file).replace(/\\/g, '/');
        const text = readFileSync(file, 'utf8');
        return [...text.matchAll(/\bfireTriggerForSource\s*\(/g)].map((match) => ({
          rel,
          text,
          index: match.index ?? 0,
        }));
      })
      .filter(({ rel }) => rel !== 'domain/ongoingEffects.ts');

    expect(callers.map(({ rel }) => rel)).toEqual(['domain/index.ts']);
    expect(callers).toHaveLength(1);

    const [{ text, index }] = callers;
    const functionStart = text.lastIndexOf('function processImmediateStartTurnMinionTriggers', index);
    expect(functionStart).toBeGreaterThanOrEqual(0);
    const localContext = text.slice(Math.max(0, index - 1200), index + 1200);
    expect(localContext).toContain('playedEvent.payload.defId');
    expect(localContext).toContain("'onTurnStart'");
    expect(localContext).toContain('skipImmediateStartTurnMinionTriggers: true');
  });
});
