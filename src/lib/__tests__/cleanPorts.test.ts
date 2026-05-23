import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    DEFAULT_DEV_PORTS,
    DEV_PROCESS_MATCHERS,
    isRepoDevProcess,
    resolveCleanPortsConfig,
} from '../../../scripts/infra/clean_ports.js';

const packageJsonPath = path.resolve(process.cwd(), 'package.json');

describe('clean_ports 开发清理策略', () => {
    it('默认配置不应再把共享 E2E 端口 5173 当成开发清理目标', () => {
        expect(DEFAULT_DEV_PORTS).toEqual([4273, 4173, 18000, 18001]);
        expect(DEFAULT_DEV_PORTS).not.toContain(5173);
    });

    it('默认配置应保持安全模式，不自动扫描并终止仓库内的开发进程树', () => {
        const config = resolveCleanPortsConfig({
            env: {},
            args: [],
            cwd: 'D:/gongzuo/webgame/BoardGame',
        });

        expect(config.aggressiveProcessCleanup).toBe(false);
        expect(config.strictPortCleanup).toBe(false);
        expect(config.ports).toEqual(DEFAULT_DEV_PORTS);
    });

    it('只有显式传入 --aggressive 时，才允许启用进程树扫描', () => {
        const config = resolveCleanPortsConfig({
            env: {},
            args: ['--aggressive'],
            cwd: 'D:/gongzuo/webgame/BoardGame',
        });

        expect(config.aggressiveProcessCleanup).toBe(true);
        expect(config.ports).toEqual(DEFAULT_DEV_PORTS);
    });

    it('仓库内进程识别仍应只匹配当前仓库的开发启动链', () => {
        const cwd = 'D:/gongzuo/webgame/BoardGame';

        expect(isRepoDevProcess(
            'node D:/gongzuo/webgame/BoardGame/scripts/infra/vite-with-logging.js',
            { cwd, matchers: DEV_PROCESS_MATCHERS },
        )).toBe(true);
        expect(isRepoDevProcess(
            'node D:/other-project/scripts/infra/vite-with-logging.js',
            { cwd, matchers: DEV_PROCESS_MATCHERS },
        )).toBe(false);
        expect(isRepoDevProcess(
            'node D:/gongzuo/webgame/BoardGame/custom-worker.js',
            { cwd, matchers: DEV_PROCESS_MATCHERS },
        )).toBe(false);
    });
});

describe('npm predev 生命周期脚本', () => {
    it('默认启动链不应再自动执行 clean_ports，避免误伤其他 AI 或共享 runtime', () => {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const predevScripts = [
            packageJson.scripts.predev,
            packageJson.scripts['predev:no-hot'],
            packageJson.scripts['predev:un'],
            packageJson.scripts['predev:lite'],
        ];

        for (const script of predevScripts) {
            expect(script).not.toContain('scripts/infra/clean_ports.js');
        }

        expect(packageJson.scripts['clean:ports']).toContain('scripts/infra/clean_ports.js');
    });
});
