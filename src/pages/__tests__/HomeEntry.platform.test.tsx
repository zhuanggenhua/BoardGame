// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomeEntry } from '../HomeEntry';
vi.mock('../Home', () => ({ Home: () => <div>统一平台首页</div> }));
vi.mock('../HomeV2', () => ({ HomeV2: () => <div>旧书本首页</div> }));
function Location() { return <output data-testid="location">{useLocation().search}</output>; }
afterEach(cleanup);
describe('正式首页入口统一', () => {
    it('旧书本链接进入新首页，同时保留目标游戏和其他真实路由参数', async () => {
        render(<MemoryRouter initialEntries={['/?homeStyle=book&homeV2Draft=1&game=betrayal&section=library']}><HomeEntry /><Location /></MemoryRouter>);
        await waitFor(() => expect(screen.getByText('统一平台首页')).toBeTruthy());
        expect(screen.queryByText('旧书本首页')).toBeNull();
        await waitFor(() => expect(screen.getByTestId('location').textContent).not.toContain('homeStyle'));
        expect(screen.getByTestId('location').textContent).toContain('game=betrayal');
        expect(document.documentElement.dataset.homeEntryStyle).toBe('platform');
    });
});
