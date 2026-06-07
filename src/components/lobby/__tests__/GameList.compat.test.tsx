import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameConfig } from '../../../config/games.config';
import { GameListCard } from '../GameList';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            if (key === 'common:game_details.people') return '人';
            if (key === 'common:category.card') return '卡牌';
            return typeof options?.defaultValue === 'string' ? options.defaultValue : key;
        },
        i18n: { language: 'zh-CN' },
    }),
}));

const baseGame: GameConfig = {
    id: 'compat-test',
    type: 'game',
    titleKey: 'games.compat-test.title',
    descriptionKey: 'games.compat-test.description',
    playersKey: 'games.compat-test.players',
    playerOptions: [2, 4],
    category: 'card',
    tags: [],
    icon: 'X',
};

describe('GameListCard compatibility sizing', () => {
    it('默认卡片缩略图应提供 4:3 padding 兜底高度', () => {
        const { container } = render(
            <GameListCard game={baseGame} index={0} onGameClick={vi.fn()} />,
        );

        const thumbnail = container.querySelector('.bg-slate-900') as HTMLElement | null;
        expect(thumbnail?.style.paddingTop).toBe('75%');
        expect(thumbnail?.style.height).toBe('0px');
    });

    it('HomeV2 紧凑卡片缩略图应提供正方形兜底高度', () => {
        const { container } = render(
            <GameListCard game={baseGame} index={0} onGameClick={vi.fn()} variant="homeV2Compact" />,
        );

        const holder = container.querySelector('[style*="border-image-source"]') as HTMLElement | null;
        expect(holder?.style.paddingTop).toBe('100%');
        expect(holder?.style.height).toBe('0px');
    });

    it('HomeV2 行卡缩略图应提供显式宽高', () => {
        render(
            <GameListCard game={baseGame} index={0} onGameClick={vi.fn()} variant="homeV2Row" />,
        );

        const link = screen.getByRole('link');
        const thumb = link.querySelector('.rounded-\\[18px\\]') as HTMLElement | null;
        expect(thumb?.style.width).toBe('86px');
        expect(thumb?.style.height).toBe('86px');
    });
});
