import React from 'react';
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
import { AudioManager } from '../AudioManager';
import type { GameAudioConfig } from '../types';
import { EventStreamRollbackContext, type EventStreamRollbackValue } from '../../../engine/hooks/EventStreamRollbackContext';

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

  it('初始化后会后台预热非核心音效，并跳过已作为关键音效预热的 key', async () => {
    const config: GameAudioConfig = {
      criticalSounds: ['sfx-critical'],
      warmSounds: ['sfx-critical', 'sfx-warm', 'sfx-warm'],
      feedbackResolver: () => null,
    };

    renderHook(() => useGameAudio({ config, gameId: 'cardia', G: {}, ctx: {} }));

    await waitFor(() => {
      expect(AudioManager.preloadKeys).toHaveBeenCalledWith(['sfx-critical']);
    });

    await waitFor(() => {
      expect(AudioManager.preloadKeys).toHaveBeenCalledWith(['sfx-warm']);
    });
  });

  it('optimistic rollback 后恢复旧 eventEntries 时不应重播旧音效，只应播放新增事件', async () => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    const config: GameAudioConfig = {
      feedbackResolver: (event) => typeof event.audioKey === 'string' ? event.audioKey : null,
    };

    const oldEntry = {
      id: 1,
      event: {
        type: 'TEST_SOUND',
        audioKey: 'sfx-old',
        timestamp: 1000,
      },
    };

    const newEntry = {
      id: 2,
      event: {
        type: 'TEST_SOUND',
        audioKey: 'sfx-new',
        timestamp: 2000,
      },
    };

    let rollbackValue: EventStreamRollbackValue = {
      watermark: null,
      seq: 0,
      reconcileSeq: 0,
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      React.createElement(EventStreamRollbackContext.Provider, { value: rollbackValue }, children)
    );

    const { rerender } = renderHook(
      ({ entries }: { entries: unknown[] }) => useGameAudio({ config, gameId: 'cardia', G: {}, ctx: {}, eventEntries: entries }),
      {
        initialProps: { entries: [] },
        wrapper,
      },
    );

    await waitFor(() => {
      expect(AudioManager.initialize).toHaveBeenCalled();
    });

    rerender({ entries: [oldEntry] });

    await waitFor(() => {
      expect(AudioManager.play).toHaveBeenCalledWith('sfx-old');
    });

    expect((AudioManager.play as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);

    rollbackValue = {
      watermark: null,
      seq: 1,
      reconcileSeq: 0,
    };

    rerender({ entries: [] });

    now = 2000;
    rerender({ entries: [oldEntry] });

    await waitFor(() => {
      expect((AudioManager.play as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    });

    now = 3000;
    rerender({ entries: [oldEntry, newEntry] });

    await waitFor(() => {
      expect(AudioManager.play).toHaveBeenCalledWith('sfx-new');
    });

    expect((AudioManager.play as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });
});
