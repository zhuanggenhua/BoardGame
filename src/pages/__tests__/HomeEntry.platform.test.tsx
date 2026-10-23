// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { persistHomeEntryStyle } from '../../lib/homeV2Routing';
import { HomeEntry } from '../HomeEntry';

vi.mock('../Home', () => ({
    Home: ({ homeStyle, onHomeStyleChange }: {
        homeStyle: 'modern' | 'classic';
        onHomeStyleChange: (style: 'modern' | 'classic') => void;
    }) => (
        <div>
            <output data-testid="active-home-style">{homeStyle}</output>
            <button type="button" onClick={() => onHomeStyleChange('classic')}>Choose classic</button>
        </div>
    ),
}));
vi.mock('../HomeV2', () => ({ HomeV2: () => <div>retired book homepage</div> }));

function Location() {
    return <output data-testid="location">{useLocation().search}</output>;
}

afterEach(() => {
    cleanup();
    window.localStorage.clear();
    delete document.documentElement.dataset.homeEntryStyle;
    delete document.body.dataset.homeEntryStyle;
});

describe('HomeEntry style selection', () => {
    it('maps the retired book link to modern and preserves unrelated route and storage values', async () => {
        window.localStorage.setItem('bg_home_entry_style', 'book');
        window.localStorage.setItem('unrelated-setting', 'keep-me');
        render(
            <MemoryRouter initialEntries={['/?homeStyle=book&homeV2Draft=1&game=betrayal&section=library']}>
                <HomeEntry />
                <Location />
            </MemoryRouter>,
        );

        await waitFor(() => expect(screen.getByTestId('active-home-style').textContent).toBe('modern'));
        await waitFor(() => expect(screen.getByTestId('location').textContent).not.toContain('homeStyle'));
        expect(screen.getByTestId('location').textContent).toContain('game=betrayal');
        expect(screen.getByTestId('location').textContent).toContain('section=library');
        expect(window.localStorage.getItem('bg_home_entry_style')).toBe('modern');
        expect(window.localStorage.getItem('unrelated-setting')).toBe('keep-me');
        expect(document.documentElement.dataset.homeEntryStyle).toBe('modern');
    });

    it('switches the active homepage and stores the selection for refresh', async () => {
        render(<MemoryRouter initialEntries={['/']}><HomeEntry /><Location /></MemoryRouter>);

        expect(screen.getByTestId('active-home-style').textContent).toBe('modern');
        fireEvent.click(screen.getByRole('button', { name: 'Choose classic' }));

        await waitFor(() => expect(screen.getByTestId('active-home-style').textContent).toBe('classic'));
        expect(window.localStorage.getItem('bg_home_entry_style')).toBe('classic');
        expect(document.body.dataset.homeEntryStyle).toBe('classic');

        act(() => persistHomeEntryStyle('modern'));
        await waitFor(() => expect(screen.getByTestId('active-home-style').textContent).toBe('modern'));
        expect(window.localStorage.getItem('bg_home_entry_style')).toBe('modern');
    });
});
