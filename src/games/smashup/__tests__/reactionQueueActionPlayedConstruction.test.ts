import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SMASHUP_ROOT = join(__dirname, '..');
const ACTION_PLAYED_FACTORY = 'domain/actionPlayEvent.ts';
const NON_GAMEPLAY_EVENT_REFERENCES = new Set([
  'tutorial.ts',
]);

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'rule') return [];
      return collectSourceFiles(fullPath);
    }
    if (!entry.isFile()) return [];
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    return [fullPath];
  });
}

describe('ACTION_PLAYED construction contract', () => {
  it('生产玩法代码应只通过 buildActionPlayedEvent 构造 ACTION_PLAYED 事件', () => {
    const offenders = collectSourceFiles(SMASHUP_ROOT)
      .map((file) => {
        const rel = relative(SMASHUP_ROOT, file).replace(/\\/g, '/');
        return { file, rel };
      })
      .filter(({ rel }) => rel !== ACTION_PLAYED_FACTORY)
      .filter(({ rel }) => !NON_GAMEPLAY_EVENT_REFERENCES.has(rel))
      .flatMap(({ file, rel }) => {
        const text = readFileSync(file, 'utf8');
        const matches = [
          ...text.matchAll(/type\s*:\s*SU_EVENTS\.ACTION_PLAYED/g),
          ...text.matchAll(/type\s*:\s*SU_EVENT_TYPES\.ACTION_PLAYED/g),
        ];
        return matches.map((match) => `${rel}:${text.slice(0, match.index).split(/\r?\n/).length}`);
      });

    expect(offenders).toEqual([]);
  });
});
