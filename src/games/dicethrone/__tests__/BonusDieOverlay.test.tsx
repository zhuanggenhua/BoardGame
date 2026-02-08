import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { BonusDieInfo } from '../domain/types';
import { BonusDieOverlay } from '../ui/BonusDieOverlay';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, string | number>) => {
            if (!options) return key;
            const params = Object.entries(options)
                .map(([paramKey, value]) => `${paramKey}=${value}`)
                .join(',');
            return `${key}:${params}`;
        },
    }),
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

const buildBonusDice = (): BonusDieInfo[] => [
    { index: 0, value: 4, face: 'taiji' },
    { index: 1, value: 4, face: 'taiji' },
    { index: 2, value: 4, face: 'taiji' },
];

describe('BonusDieOverlay', () => {
    it('有太极时显示重掷提示与确认伤害按钮', () => {
        const html = renderToStaticMarkup(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                bonusDice={buildBonusDice()}
                canReroll
                onReroll={vi.fn()}
                onSkipReroll={vi.fn()}
                showTotal
                rerollCostAmount={2}
                rerollCostTokenId="taiji"
            />
        );

        expect(html).toContain('bonusDie.selectToReroll:cost=2,token=tokens.taiji.name');
        expect(html).toContain('bonusDie.confirmDamage');
        expect(html).toContain('bonusDie.total');
        expect(html).toContain('cursor-pointer');
        expect(html).toContain('bg-purple-600/80');
        expect(html).toContain('(bonusDie.knockdownTrigger)');
    });

    it('无太极时显示无法重掷提示与继续按钮', () => {
        const html = renderToStaticMarkup(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                bonusDice={buildBonusDice()}
                canReroll={false}
                onReroll={vi.fn()}
                onSkipReroll={vi.fn()}
                showTotal
                rerollCostAmount={2}
                rerollCostTokenId="taiji"
            />
        );

        expect(html).toContain('bonusDie.noTokenToReroll:token=tokens.taiji.name');
        expect(html).toContain('bonusDie.continue');
        expect(html).not.toContain('bonusDie.confirmDamage');
        expect(html).not.toContain('cursor-pointer');
        expect(html).not.toContain('bg-purple-600/80');
    });
});
