import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_STATS_ENDPOINT } from '../admin-stats';

const repoRoot = process.cwd();

function collectSourceFiles(relativePath: string): string[] {
    const absolutePath = path.join(repoRoot, relativePath);
    const stats = statSync(absolutePath);

    if (stats.isFile()) {
        return [absolutePath];
    }

    return readdirSync(absolutePath).flatMap((entry) => {
        const childPath = path.join(relativePath, entry);
        const absoluteChildPath = path.join(repoRoot, childPath);
        const childStats = statSync(absoluteChildPath);
        if (childStats.isDirectory()) {
            return collectSourceFiles(childPath);
        }
        return /\.(ts|tsx)$/.test(entry) ? [absoluteChildPath] : [];
    });
}

describe('前端后台请求合同', () => {
    it('后台统计合同指向真实管理统计入口，而不是认证入口', () => {
        expect(ADMIN_STATS_ENDPOINT).toBe('/admin-api/stats');
        expect(ADMIN_STATS_ENDPOINT).not.toBe('/auth/admin/stats');
    });

    it('首页和大厅链路不得直接拼后台入口，必须通过 api 合同 Module', () => {
        const guardedFiles = [
            ...collectSourceFiles('src/components/home-v2'),
            path.join(repoRoot, 'src/hooks/useGamePopularityRanking.ts'),
            path.join(repoRoot, 'src/pages/Home.tsx'),
            path.join(repoRoot, 'src/pages/HomeV2.tsx'),
            path.join(repoRoot, 'src/pages/HomeV2Draft.tsx'),
        ];
        const violations = guardedFiles.flatMap((file) => {
            const content = readFileSync(file, 'utf8');
            if (!/\b(?:ADMIN_API_URL|AUTH_API_URL)\b/.test(content)) {
                return [];
            }
            return [path.relative(repoRoot, file)];
        });

        expect(violations).toEqual([]);
    });
});
