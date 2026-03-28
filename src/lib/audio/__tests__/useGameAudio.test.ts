import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseAudio = {
  setPlaylist: vi.fn(),
  playBgm: vi.fn(),
  stopBgm: vi.fn(),
  bgmSelections: {},
  setActiveBgmContext: vi.fn(),
};

vi.mock('/src/contexts/AudioContext.tsx', () => ({
  useAudio: () => mockUseAudio,
}));

vi.mock('../commonRegistry', () => ({
  COMMON_AUDIO_BASE_PATH: 'common/audio',
  loadCommonAudioRegistry: vi.fn(async () => ({ entries: [] })),
}));

vi.mock('../AudioManager', () => ({
  AudioManager: {
    registerRegistryEntries: vi.fn(),
    preloadKeys: vi.fn(),
    initialize: vi.fn(),
    registerAll: vi.fn(),
    stopBgm: vi.fn(),
    play: vi.fn(),
    isFailed: vi.fn(() => false),
  },
}));

import { useGameAudio } from '../useGameAudio';
import type { GameAudioConfig } from '../types';

describe('useGameAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAudio.bgmSelections = {};
  });

  it('bgmRules 为空时不应自动播放默认音乐', async () => {
    const config: GameAudioConfig = {
      bgm: [
        { key: 'bgm-1', name: 'BGM 1', src: 'bgm-1.mp3' },
        { key: 'bgm-2', name: 'BGM 2', src: 'bgm-2.mp3' },
      ],
      bgmRules: [],
      feedbackResolver: () => null,
    };

    const { rerender } = renderHook(() => useGameAudio({ config, gameId: 'cardia', G: {}, ctx: {} }));

    await waitFor(() => {
      expect(mockUseAudio.setPlaylist).toHaveBeenCalledWith(config.bgm);
    });

    expect(mockUseAudio.playBgm).not.toHaveBeenCalled();
    expect(mockUseAudio.stopBgm).toHaveBeenCalled();
    expect(mockUseAudio.setActiveBgmContext).not.toHaveBeenCalled();

    const stopCallsAfterMount = mockUseAudio.stopBgm.mock.calls.length;
    rerender();

    await waitFor(() => {
      expect(mockUseAudio.stopBgm.mock.calls.length).toBe(stopCallsAfterMount);
    });
  });
});
