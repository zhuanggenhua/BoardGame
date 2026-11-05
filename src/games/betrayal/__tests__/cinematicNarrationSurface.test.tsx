// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CinematicNarrationPanel } from '../cinematicNarrationSurface';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: () => '序章' }) }));
describe('序章阅读保护', () => {
    it('全屏序章使用实色背景，底下的阶段文字不再透过标题', () => {
        render(<CinematicNarrationPanel testId="opening" presentation="stage" variant="opening" label="英雄序章" text="尘土飞扬，房间里传来声音。" />);
        expect(screen.getByTestId('opening').className).toContain('bg-[#030605]');
        expect(screen.getByTestId('opening').className).not.toContain('bg-[rgba(0,0,0,0.42)]');
        expect(screen.getByText('英雄序章')).toBeTruthy();
    });
});
