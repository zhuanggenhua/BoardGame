import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ load: vi.fn(), stop: vi.fn(), playLoop: vi.fn(), register: vi.fn(), initialize: vi.fn() }));
vi.mock('../../../lib/audio/AudioManager', () => ({ AudioManager: { initialize: mocks.initialize, registerRegistryEntries: mocks.register, playLoop: mocks.playLoop } }));
vi.mock('../../../lib/audio/commonRegistry', () => ({ COMMON_AUDIO_BASE_PATH: 'common/audio', loadCommonAudioRegistry: mocks.load }));
import { useBetrayalAmbience, BETRAYAL_AMBIENCE_KEY } from '../useBetrayalAmbience';

beforeEach(() => { vi.clearAllMocks(); mocks.load.mockResolvedValue({ entries: [] }); mocks.playLoop.mockReturnValue(mocks.stop); });
describe('Betrayal atmosphere lifetime', () => {
    it('starts once across playing turns and stops when leaving play', async () => {
        const view = renderHook(({active}) => useBetrayalAmbience(active), {initialProps:{active:true}});
        await act(async () => {});
        expect(mocks.playLoop).toHaveBeenCalledExactlyOnceWith(BETRAYAL_AMBIENCE_KEY, 0.08);
        view.rerender({active:true});
        expect(mocks.playLoop).toHaveBeenCalledTimes(1);
        view.rerender({active:false});
        expect(mocks.stop).toHaveBeenCalledTimes(1);
    });
    it('cannot start a late registry request after unmount', async () => {
        let resolve!: (value: {entries: []}) => void;
        mocks.load.mockReturnValue(new Promise(r => { resolve = r; }));
        const view = renderHook(() => useBetrayalAmbience(true));
        view.unmount();
        await act(async () => { resolve({entries:[]}); });
        expect(mocks.playLoop).not.toHaveBeenCalled();
    });
});
