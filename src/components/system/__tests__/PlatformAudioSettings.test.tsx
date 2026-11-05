// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PlatformAudioSettings } from '../PlatformAudioSettings';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../contexts/AudioContext', () => ({ AudioProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../game/framework/widgets/AudioControlSection', () => ({ AudioControlSection: () => <input aria-label="音乐音量" type="range"/> }));
afterEach(cleanup);
it('音频内容保留原控件，不再新增浮球关闭按钮', async () => {
    render(<PlatformAudioSettings isDark={false}/>);
    expect(await screen.findByLabelText('音乐音量')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
});
