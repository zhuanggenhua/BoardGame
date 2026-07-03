import { spawnSync } from 'child_process';
import path from 'path';
import { describe, expect, it } from 'vitest';

const runPublishPlan = (...assetPaths: string[]) => {
    const result = spawnSync(
        process.execPath,
        [
            path.join(process.cwd(), 'scripts', 'assets', 'upload-to-r2.js'),
            '--android-package-publish-plan',
            ...assetPaths,
        ],
        {
            cwd: process.cwd(),
            encoding: 'utf8',
        },
    );

    return {
        status: result.status,
        output: `${result.stdout}\n${result.stderr}`,
    };
};

describe('upload-to-r2 安卓素材包刷新预演', () => {
    it('DiceThrone 游戏资源上传后应刷新 DiceThrone 安卓素材包并复用共享音频包', () => {
        const result = runPublishPlan(
            'official/i18n/zh-CN/dicethrone/images/barbarian/compressed/player-board.webp',
            'official/atlas-configs/dicethrone/ability-cards-common.atlas.json',
        );

        expect(result.status).toBe(0);
        expect(result.output).toContain('游戏资源变更: dicethrone');
        expect(result.output).toContain('共享音频变更: 否');
        expect(result.output).toContain('scripts/mobile/publish-android-game-packages.mjs --game dicethrone --reuse-shared-audio');
    });

    it('共享音频上传后应刷新共享音频包和全部游戏 manifest', () => {
        const result = runPublishPlan(
            'official/i18n/zh-CN/dicethrone/images/barbarian/compressed/player-board.webp',
            'official/common/audio/sfx/compressed/click.ogg',
        );

        expect(result.status).toBe(0);
        expect(result.output).toContain('游戏资源变更: dicethrone');
        expect(result.output).toContain('共享音频变更: 是');
        expect(result.output).toContain('scripts/mobile/publish-android-game-packages.mjs');
        expect(result.output).not.toContain('--game dicethrone --reuse-shared-audio');
    });
});
