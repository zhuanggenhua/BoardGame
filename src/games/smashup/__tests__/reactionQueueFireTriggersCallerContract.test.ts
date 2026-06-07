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

describe('fireTriggers direct caller contract', () => {
  it('生产代码只允许已审计的 fireTriggers 直执行入口', () => {
    const callers = collectProductionSourceFiles(SMASHUP_ROOT)
      .flatMap((file) => {
        const rel = relative(SMASHUP_ROOT, file).replace(/\\/g, '/');
        const text = readFileSync(file, 'utf8');
        return [...text.matchAll(/\bfireTriggers\s*\(/g)].map((match) => ({
          rel,
          text,
          index: match.index ?? 0,
        }));
      })
      .filter(({ rel }) => rel !== 'domain/ongoingEffects.ts')
      .map(({ rel, text, index }) => {
        const localContext = text.slice(index, index + 600);
        const timing = localContext.match(/fireTriggers\s*\([^,]+,\s*'([^']+)'/)?.[1];
        const hasReplacementPhase = localContext.includes("phase: 'replacement'");
        return { rel, timing, hasReplacementPhase };
      });

    expect(callers).toEqual([
      { rel: 'domain/duel.ts', timing: 'onDuelResolved', hasReplacementPhase: false },
      { rel: 'domain/duel.ts', timing: 'onDuelStarted', hasReplacementPhase: false },
      { rel: 'domain/reducer.ts', timing: 'onMinionDestroyed', hasReplacementPhase: true },
    ]);
  });
});
