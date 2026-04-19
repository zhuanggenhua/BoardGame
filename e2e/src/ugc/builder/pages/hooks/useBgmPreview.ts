/**
 * BGM 预览 hook
 * 从 UnifiedBuilder.tsx 提取
 */

import { useMemo, useEffect } from 'react';
import { useAudio } from '../../../../contexts/AudioContext';
import { AudioManager } from '../../../../lib/audio/AudioManager';
import type { BgmDefinition } from '../../../../lib/audio/types';
import type { LayoutComponent } from '../../context';

export function useBgmPreview(layout: LayoutComponent[], isPreviewMode: boolean) {
  const { playBgm, stopBgm, setPlaylist } = useAudio();

  const bgmEntries = useMemo(() => {
    return layout
      .filter(comp => comp.type === 'bgm')
      .map((comp, index) => {
        const rawKey = comp.data.bgmKey ?? comp.data.key;
        const rawName = comp.data.bgmName ?? comp.data.name;
        const rawSrc = comp.data.bgmSrc ?? comp.data.src;
        const rawBasePath = comp.data.bgmBasePath ?? comp.data.basePath;
        const rawVolume = comp.data.bgmVolume;
        const rawEnabled = comp.data.bgmEnabled;
        const rawAutoPlay = comp.data.bgmAutoPlay;
        const key = typeof rawKey === 'string' ? rawKey.trim() : '';
        const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : `背景音乐${index + 1}`;
        const src = typeof rawSrc === 'string' ? rawSrc.trim() : '';
        const basePath = typeof rawBasePath === 'string' ? rawBasePath.trim() : '';
        const volume = typeof rawVolume === 'number' && !Number.isNaN(rawVolume) ? rawVolume : 0.6;
        const enabled = rawEnabled !== false;
        const autoPlay = rawAutoPlay !== false;
        return {
          key,
          name,
          src,
          basePath,
          volume: Math.max(0, Math.min(1, volume)),
          enabled,
          autoPlay,
        };
      });
  }, [layout]);

  const bgmList = useMemo<BgmDefinition[]>(() => {
    return bgmEntries
      .filter(entry => entry.enabled && entry.key && entry.src)
      .map(entry => ({
        key: entry.key,
        name: entry.name,
        src: entry.src,
        volume: entry.volume,
      }));
  }, [bgmEntries]);

  const bgmBasePath = useMemo(() => {
    const uniquePaths = Array.from(new Set(bgmEntries.map(entry => entry.basePath).filter(Boolean)));
    return uniquePaths.length === 1 ? uniquePaths[0] : '';
  }, [bgmEntries]);

  const autoPlayBgmKey = useMemo(() => {
    const target = bgmEntries.find(entry => entry.enabled && entry.autoPlay && entry.key && entry.src);
    return target?.key ?? null;
  }, [bgmEntries]);

  useEffect(() => {
    if (!isPreviewMode) {
      setPlaylist([]);
      stopBgm();
      return;
    }

    if (bgmList.length === 0) {
      setPlaylist([]);
      stopBgm();
      return;
    }

    AudioManager.registerAll({ bgm: bgmList }, bgmBasePath);
    setPlaylist(bgmList);
    if (autoPlayBgmKey) {
      playBgm(autoPlayBgmKey);
    } else {
      stopBgm();
    }
  }, [isPreviewMode, bgmList, bgmBasePath, autoPlayBgmKey, playBgm, stopBgm, setPlaylist]);
}
