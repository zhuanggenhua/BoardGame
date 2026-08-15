import { describe, expect, it } from 'vitest';
import type { GameManifestEntry } from '../gameManifest.types';
import {
    applyCreateRoomSetupDefaultsForGame,
    applySetupDefaultsForGame,
    hasPlayerCountConstrainedSetupSelection,
    resolveAllowedPlayerCountsForGame,
} from '../roomSetup';

const setupManifest: GameManifestEntry = {
    id: 'setup-contract-game',
    type: 'game',
    enabled: true,
    titleKey: 'games.setupContract.title',
    descriptionKey: 'games.setupContract.description',
    category: 'card',
    playersKey: 'games.setupContract.players',
    icon: 'G',
    playerOptions: [2, 3, 4, 5, 6],
    setupOptions: {
        variant: {
            type: 'select',
            labelKey: 'setup.variant.label',
            options: [
                {
                    value: 'standard',
                    labelKey: 'setup.variant.standard',
                    playerOptions: [3, 4, 5, 6],
                },
                {
                    value: 'duel',
                    labelKey: 'setup.variant.duel',
                    playerOptions: [2],
                },
            ],
            default: 'standard',
        },
        expansion: {
            type: 'select',
            labelKey: 'setup.expansion.label',
            options: [
                { value: 'base', labelKey: 'setup.expansion.base' },
                { value: 'extra', labelKey: 'setup.expansion.extra' },
            ],
            default: 'base',
            createRoomDefault: 'base',
        },
    },
};

describe('shared room setup manifest contract', () => {
    it('select option playerOptions 会按当前 setup 收敛允许人数', () => {
        expect(resolveAllowedPlayerCountsForGame({
            gameManifest: setupManifest,
            setupData: { setupSelections: { variant: 'duel' } },
        })).toEqual([2]);

        expect(resolveAllowedPlayerCountsForGame({
            gameManifest: setupManifest,
            setupData: { setupSelections: { variant: 'standard' } },
        })).toEqual([3, 4, 5, 6]);
    });

    it('可以识别显式 setup 是否携带人数约束', () => {
        expect(hasPlayerCountConstrainedSetupSelection({
            gameManifest: setupManifest,
            setupSelections: { variant: 'duel', expansion: 'extra' },
            fieldKeys: new Set(['variant']),
        })).toBe(true);

        expect(hasPlayerCountConstrainedSetupSelection({
            gameManifest: setupManifest,
            setupSelections: { variant: 'duel', expansion: 'extra' },
            fieldKeys: new Set(['expansion']),
        })).toBe(false);
    });

    it('普通本地 setup 默认值会修正为当前人数兼容选项', () => {
        expect(applySetupDefaultsForGame({
            gameManifest: setupManifest,
            numPlayers: 2,
            setupSelections: {
                variant: 'standard',
                expansion: 'extra',
            },
        })).toEqual({
            variant: 'duel',
            expansion: 'extra',
        });

        expect(applySetupDefaultsForGame({
            gameManifest: setupManifest,
            numPlayers: 4,
            setupSelections: {
                variant: 'duel',
            },
        })).toEqual({
            variant: 'standard',
            expansion: 'base',
        });
    });

    it('创建房间 setup 默认值会使用 createRoomDefault 重置非持久化偏好', () => {
        expect(applyCreateRoomSetupDefaultsForGame({
            gameManifest: setupManifest,
            numPlayers: 2,
            setupSelections: {
                variant: 'standard',
                expansion: 'extra',
            },
        })).toEqual({
            variant: 'duel',
            expansion: 'base',
        });
    });
});
