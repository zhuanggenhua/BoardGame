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
    it('卡牌阅读特写不会被旧的自动关闭延迟收走，只能由明确关闭动作收口', () => {
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

        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(onClose).not.toHaveBeenCalled();

        fireEvent.click(document.querySelector('[data-testid="card-spotlight-overlay"]') as Element);
        expect(onClose).not.toHaveBeenCalled();
    });
});
