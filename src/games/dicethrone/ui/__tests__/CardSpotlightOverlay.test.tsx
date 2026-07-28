import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';

import { CardSpotlightOverlay } from '../CardSpotlightOverlay';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            exists: () => false,
        },
    }),
}));

vi.mock('../../../../core', async () => {
    const actual = await vi.importActual<typeof import('../../../../core')>('../../../../core');
    return {
        ...actual,
        HudPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    };
});

vi.mock('../../../../components/common/media/CardPreview', () => ({
    CardPreview: () => <div data-testid="mock-card-preview" />,
}));

vi.mock('framer-motion', () => {
    const motion = new Proxy({}, {
        get: (_target, tag) => {
            return ({ children, ...rest }: { children?: React.ReactNode }) => (
                React.createElement(tag as string, rest, children)
            );
        },
    });

    return {
        motion,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => (
            <>{children}</>
        ),
    };
});

afterEach(() => {
    vi.useRealTimers();
});

describe('CardSpotlightOverlay', () => {
    it('自建卡牌短展示保留 3 秒自动关闭合同，但不靠内容点击关闭', () => {
        vi.useFakeTimers();
        const onClose = vi.fn();

        render(
            <CardSpotlightOverlay
                queue={[{
                    id: 'watch-out-1000',
                    cardId: 'watch-out',
                    timestamp: 1000,
                    playerId: '1',
                    playerName: '对手',
                    previewRef: {
                        type: 'atlas',
                        atlasId: 'dicethrone-moon-elf-cards',
                        index: 1,
                    },
                }]}
                onClose={onClose}
                autoCloseDelay={3000}
            />,
        );

        fireEvent.click(document.querySelector('[data-testid="card-spotlight-overlay"]') as Element);
        expect(onClose).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(2999);
        });
        expect(onClose).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(onClose).toHaveBeenCalledWith('watch-out-1000');
    });
});
