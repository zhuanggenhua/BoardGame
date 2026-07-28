import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { THE_GANG_CHALLENGES } from '../domain/expansions';
import { TheGangDomain } from '../domain';
import { theGangCriticalImageResolver, _testExports } from '../criticalImageResolver';
import type { MatchState } from '../../../engine/types';
import type { TheGangCore } from '../domain/types';

const fixedRandom = { random: () => 0 };

const stateOf = (core: TheGangCore): MatchState<TheGangCore> => ({
    core,
    sys: {} as MatchState<TheGangCore>['sys'],
});

const toCompressedAssetFile = (assetPath: string): string => {
    const lastSlashIndex = assetPath.lastIndexOf('/');
    const directory = assetPath.slice(0, lastSlashIndex);
    const fileName = assetPath.slice(lastSlashIndex + 1);
    return `public/assets/i18n/zh-CN/${directory}/compressed/${fileName}.webp`;
};

describe('theGangCriticalImageResolver', () => {
    test('把全部挑战牌素材纳入预热路径，且路径不硬编码 compressed', () => {
        const result = theGangCriticalImageResolver(undefined);
        const expectedChallengePaths = Object.keys(THE_GANG_CHALLENGES)
            .map((challengeId) => `the-gang/rule-assets/challenges/${challengeId}`);

        expect(_testExports.THE_GANG_CHALLENGE_IMAGE_PATHS).toHaveLength(expectedChallengePaths.length);
        expect(result.warm).toEqual(expect.arrayContaining(expectedChallengePaths));
        expect([...result.critical, ...result.warm].some((path) => path.includes('/compressed/'))).toBe(false);
    });

    test('setup 阶段关键加载筹码和牌背，运行阶段关键加载普通扑克牌面', () => {
        const setupResult = theGangCriticalImageResolver(undefined);
        expect(setupResult.critical).toEqual(expect.arrayContaining([
            'the-gang/cards/card-back',
            'the-gang/chips/exit-chip',
            'the-gang/chips/round-1-white-0',
            'the-gang/chips/round-1-white-1',
            'the-gang/chips/round-1-white-8',
            'the-gang/chips/round-4-red-6',
            'the-gang/chips/round-4-red-8',
        ]));
        expect(setupResult.warm).toContain('the-gang/cards/ace-spades');

        const started = {
            ...TheGangDomain.setup(['0', '1', '2'], fixedRandom),
            heistStarted: true,
        };
        const playingResult = theGangCriticalImageResolver(stateOf(started), undefined, '0');

        expect(playingResult.critical).toEqual(expect.arrayContaining([
            'the-gang/cards/ace-spades',
            'the-gang/cards/two-clubs',
            'the-gang/chips/exit-chip',
        ]));
        expect(playingResult.phaseKey).toBe('the-gang:playing:chip-selection:1:0');
    });

    test('预加载列表里的素材路径都能落到本地压缩文件', () => {
        const setupResult = theGangCriticalImageResolver(undefined);
        const started = {
            ...TheGangDomain.setup(['0', '1', '2'], fixedRandom),
            heistStarted: true,
        };
        const playingResult = theGangCriticalImageResolver(stateOf(started), undefined, '0');
        const allPaths = [
            ...setupResult.critical,
            ...setupResult.warm,
            ...playingResult.critical,
            ...playingResult.warm,
        ];
        const missingPaths = [...new Set(allPaths)]
            .map((assetPath) => [assetPath, toCompressedAssetFile(assetPath)] as const)
            .filter(([, filePath]) => !existsSync(filePath));

        expect(missingPaths).toEqual([]);
    });
});
