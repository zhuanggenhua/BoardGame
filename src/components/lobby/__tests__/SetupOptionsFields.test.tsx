/* @vitest-environment happy-dom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SetupOptionsFields } from '../SetupOptionsFields';
import type { GameManifestEntry } from '../../../games/manifest.types';

const fantasyRealmsManifest: GameManifestEntry = {
    id: 'fantasyrealms',
    type: 'game',
    enabled: true,
    titleKey: 'games.fantasyrealms.title',
    descriptionKey: 'games.fantasyrealms.description',
    category: 'card',
    playersKey: 'games.fantasyrealms.players',
    icon: '🏰',
    setupOptions: {
        expansion: {
            type: 'select',
            labelKey: 'setup.expansion.label',
            presentation: 'segmented',
            options: [
                { value: 'base', labelKey: 'setup.expansion.base' },
                { value: 'cursed-hoard-suits', labelKey: 'setup.expansion.cursedHoardSuits' },
            ],
            default: 'base',
        },
    },
};

describe('SetupOptionsFields', () => {
    it('会优先使用游戏命名空间翻译 setup 文案，而不是把内部 key 直接显示到 UI', () => {
        const t = vi.fn((key: string, options?: { ns?: string; defaultValue?: string }) => {
            if (options?.ns === 'game-fantasyrealms') {
                if (key === 'setup.expansion.label') return '卡组范围';
                if (key === 'setup.expansion.base') return '基础卡组';
                if (key === 'setup.expansion.cursedHoardSuits') return '诅咒宝藏：新花色';
            }
            return options?.defaultValue ?? key;
        });

        render(
            <SetupOptionsFields
                gameManifest={fantasyRealmsManifest}
                selections={{ expansion: 'base' }}
                onSelectionsChange={vi.fn()}
                t={t as never}
                gameNamespace="game-fantasyrealms"
                numPlayers={2}
            />,
        );

        expect(screen.getByText('卡组范围')).toBeInTheDocument();
        expect(screen.getByText('基础卡组')).toBeInTheDocument();
        expect(screen.getByText('诅咒宝藏：新花色')).toBeInTheDocument();
        expect(screen.queryByText('setup.expansion.label')).not.toBeInTheDocument();
    });
});
