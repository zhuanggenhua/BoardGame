import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const presentation = vi.hoisted(() => ({
    complete: undefined as undefined | ((stage: string) => void),
    reduced: false,
    stop: vi.fn(),
}));
vi.mock('../../../components/common/media/OptimizedImage', () => ({ OptimizedImage: ({ src, alt, className }: any) => <img src={src} alt={alt} className={className} /> }));
vi.mock('../../../core', () => ({ HudPortal: ({ children }: React.PropsWithChildren) => children, UI_Z_INDEX: { modalOverlay: 2100, tutorial: 2300, modalFullscreenGate: 2360 } }));
vi.mock('../../../lib/audio/AudioManager', () => ({ AudioManager: { stopSfx: presentation.stop } }));
vi.mock('../../../lib/audio/commonRegistry', () => ({ COMMON_AUDIO_BASE_PATH: '', loadCommonAudioRegistry: () => new Promise(() => {}) }));
vi.mock('framer-motion', () => ({
    useReducedMotion: () => presentation.reduced,
    motion: {
        button: ({ children, onAnimationComplete, variants: _variants, initial: _initial, animate: _animate, ...props }: any) => {
            presentation.complete = onAnimationComplete;
            return <button {...props}>{children}</button>;
        },
        span: ({ children, variants: _variants, ...props }: any) => <span {...props}>{children}</span>,
    },
}));
import { BetrayalTurnIntroSurface } from '../turnIntroSurface';

describe('turn intro scene lifecycle', () => {
    beforeEach(() => { presentation.reduced = false; presentation.stop.mockClear(); });

    it('accelerates on click, waits for the accelerated exit, and completes once', () => {
        const done = vi.fn();
        render(<BetrayalTurnIntroSurface title="你的回合" skipLabel="加速片头" onComplete={done} />);
        const layer = screen.getByTestId('betrayal-turn-intro-skip');
        expect(Number(layer.style.zIndex)).toBeGreaterThan(2300);
        expect(layer.dataset.presentationStage).toBe('play');
        fireEvent.click(layer);
        expect(layer.dataset.presentationStage).toBe('skip');
        expect(presentation.stop).toHaveBeenCalled();
        expect(done).not.toHaveBeenCalled();
        act(() => presentation.complete?.('play'));
        expect(done).not.toHaveBeenCalled();
        act(() => { presentation.complete?.('skip'); presentation.complete?.('skip'); });
        expect(done).toHaveBeenCalledTimes(1);
    });

    it.each([false, true])('finishes naturally once with reduced motion=%s', reduced => {
        presentation.reduced = reduced;
        const done = vi.fn();
        render(<BetrayalTurnIntroSurface title="你的回合" skipLabel="加速片头" onComplete={done} />);
        act(() => { presentation.complete?.('play'); presentation.complete?.('play'); });
        expect(done).toHaveBeenCalledTimes(1);
    });
    it('keeps the actor and available movement in the same full-width turn banner', () => {
        render(<BetrayalTurnIntroSurface title="你的回合" skipLabel="加速片头" actorLabel="伊莎" subtitle="还可移动 3 步" portraitAsset="betrayal/tokens/explorers/isa-valencia" onComplete={vi.fn()} />);
        const banner = screen.getByTestId('betrayal-turn-intro-banner');
        expect(banner.textContent).toContain('伊莎 · 还可移动 3 步');
        expect(banner.querySelector('img')?.getAttribute('src')).toBe('betrayal/tokens/explorers/isa-valencia');
        expect(screen.getByTestId('betrayal-turn-intro-title').textContent).toBe('你的回合');
    });

});
