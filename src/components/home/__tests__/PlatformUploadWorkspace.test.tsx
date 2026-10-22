// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformUploadWorkspace } from '../PlatformUploadWorkspace';
const api = vi.hoisted(() => ({ listGameSubmissions: vi.fn(async () => ({ items: [] })), saveGameSubmission: vi.fn(), submitGameSubmission: vi.fn(), uploadSubmissionCover: vi.fn() }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ token: 'test', user: { id: 'owner', username: '用户' } }) }));
vi.mock('../../../api/game-submissions', () => api);
beforeEach(() => { vi.clearAllMocks(); URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn(); });
afterEach(cleanup);
describe('投稿封面选择', () => {
    it('拒绝新文件后清除旧文件，不能把旧封面悄悄提交', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const { container } = render(<QueryClientProvider client={client}><PlatformUploadWorkspace onLogin={() => {}} /></QueryClientProvider>);
        await waitFor(() => expect(api.listGameSubmissions).toHaveBeenCalled());
        const input = container.querySelector('input[type=file]')!;
        fireEvent.change(input, { target: { files: [new File(['image'], 'old.png', { type: 'image/png' })] } });
        expect(screen.getByAltText('投稿封面预览')).toBeTruthy();
        const large = new File(['x'], 'large.png', { type: 'image/png' });
        Object.defineProperty(large, 'size', { value: 11 * 1024 * 1024 });
        fireEvent.change(input, { target: { files: [large] } });
        expect(screen.getByRole('alert').textContent).toContain('10 MB');
        expect(screen.queryByAltText('投稿封面预览')).toBeNull();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    });
});
