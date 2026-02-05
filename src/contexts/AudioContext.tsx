import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { AudioManager } from '../lib/audio/AudioManager';
import type { BgmDefinition } from '../lib/audio/types';
import { getAudioSettings, updateAudioSettings, type AudioSettings } from '../api/user-settings';
import { useAuth } from './AuthContext';

interface AudioContextValue {
    muted: boolean;
    masterVolume: number;
    sfxVolume: number;
    bgmVolume: number;
    currentBgm: string | null;
    playlist: BgmDefinition[];
    toggleMute: () => void;
    setMasterVolume: (volume: number) => void;
    setSfxVolume: (volume: number) => void;
    setBgmVolume: (volume: number) => void;
    play: (key: string, spriteKey?: string) => void;
    playBgm: (key: string) => void;
    stopBgm: () => void;
    setPlaylist: (list: BgmDefinition[]) => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export const AudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { token } = useAuth();
    const [muted, setMuted] = useState(false);
    const [masterVolume, setMasterVolumeState] = useState(1.0);
    const [sfxVolume, setSfxVolumeState] = useState(1.0);
    const [bgmVolume, setBgmVolumeState] = useState(0.6);
    const [currentBgm, setCurrentBgmState] = useState<string | null>(null);
    const [playlist, setPlaylist] = useState<BgmDefinition[]>([]);
    const hasRemoteSyncRef = useRef(false);
    const skipNextSyncRef = useRef(false);
    const lastSyncedRef = useRef<AudioSettings | null>(null);

    // 初始化音频管理器
    useEffect(() => {
        AudioManager.initialize();
        setMuted(AudioManager.muted);
        setMasterVolumeState(AudioManager.masterVolume);
        setSfxVolumeState(AudioManager.sfxVolume);
        setBgmVolumeState(AudioManager.bgmVolume);
    }, []);

    // 监听 BGM 状态更新（事件驱动，避免轮询）
    useEffect(() => {
        const unsubscribe = AudioManager.onBgmChange((nextBgm) => {
            setCurrentBgmState(nextBgm);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!token) {
            hasRemoteSyncRef.current = false;
            lastSyncedRef.current = null;
            return;
        }

        let cancelled = false;

        const syncSettings = async () => {
            try {
                const response = await getAudioSettings(token);
                if (cancelled) return;

                if (!response.settings || response.empty) {
                    const localSettings: AudioSettings = {
                        muted: AudioManager.muted,
                        masterVolume: AudioManager.masterVolume,
                        sfxVolume: AudioManager.sfxVolume,
                        bgmVolume: AudioManager.bgmVolume,
                    };
                    await updateAudioSettings(token, localSettings);
                    if (cancelled) return;
                    lastSyncedRef.current = localSettings;
                } else {
                    const remoteSettings = response.settings;
                    skipNextSyncRef.current = true;
                    AudioManager.setMuted(remoteSettings.muted);
                    AudioManager.setMasterVolume(remoteSettings.masterVolume);
                    AudioManager.setSfxVolume(remoteSettings.sfxVolume);
                    AudioManager.setBgmVolume(remoteSettings.bgmVolume);
                    setMuted(remoteSettings.muted);
                    setMasterVolumeState(remoteSettings.masterVolume);
                    setSfxVolumeState(remoteSettings.sfxVolume);
                    setBgmVolumeState(remoteSettings.bgmVolume);
                    lastSyncedRef.current = remoteSettings;
                }

                hasRemoteSyncRef.current = true;
            } catch {
                if (cancelled) return;
                // 同步失败时保持本地设置，并允许后续本地改动继续上报
                hasRemoteSyncRef.current = true;
                lastSyncedRef.current = {
                    muted: AudioManager.muted,
                    masterVolume: AudioManager.masterVolume,
                    sfxVolume: AudioManager.sfxVolume,
                    bgmVolume: AudioManager.bgmVolume,
                };
            }
        };

        void syncSettings();

        return () => {
            cancelled = true;
        };
    }, [token]);

    useEffect(() => {
        if (!token || !hasRemoteSyncRef.current) return;
        if (skipNextSyncRef.current) {
            skipNextSyncRef.current = false;
            return;
        }

        const nextSettings: AudioSettings = {
            muted,
            masterVolume,
            sfxVolume,
            bgmVolume,
        };
        const last = lastSyncedRef.current;
        if (
            last
            && last.muted === nextSettings.muted
            && last.masterVolume === nextSettings.masterVolume
            && last.sfxVolume === nextSettings.sfxVolume
            && last.bgmVolume === nextSettings.bgmVolume
        ) {
            return;
        }

        lastSyncedRef.current = nextSettings;
        void updateAudioSettings(token, nextSettings).catch(() => {
            // 失败时保持本地缓存
        });
    }, [token, muted, masterVolume, sfxVolume, bgmVolume]);

    const toggleMute = useCallback(() => {
        const newMuted = !muted;
        AudioManager.setMuted(newMuted);
        setMuted(newMuted);
    }, [muted]);

    const setMasterVolume = useCallback((vol: number) => {
        AudioManager.setMasterVolume(vol);
        setMasterVolumeState(vol);
    }, []);

    const setSfxVolume = useCallback((vol: number) => {
        AudioManager.setSfxVolume(vol);
        setSfxVolumeState(vol);
    }, []);

    const setBgmVolume = useCallback((vol: number) => {
        AudioManager.setBgmVolume(vol);
        setBgmVolumeState(vol);
    }, []);

    const play = useCallback((key: string, spriteKey?: string) => {
        AudioManager.play(key, spriteKey);
    }, []);

    const playBgm = useCallback((key: string) => {
        AudioManager.playBgm(key);
    }, []);

    const stopBgm = useCallback(() => {
        AudioManager.stopBgm();
    }, []);

    const value = useMemo(() => ({
        muted,
        masterVolume,
        sfxVolume,
        bgmVolume,
        currentBgm,
        playlist,
        toggleMute,
        setMasterVolume,
        setSfxVolume,
        setBgmVolume,
        play,
        playBgm,
        stopBgm,
        setPlaylist,
    }), [
        muted,
        masterVolume,
        sfxVolume,
        bgmVolume,
        currentBgm,
        playlist,
        toggleMute,
        setMasterVolume,
        setSfxVolume,
        setBgmVolume,
        play,
        playBgm,
        stopBgm,
        setPlaylist,
    ]);

    return (
        <AudioContext.Provider value={value}>
            {children}
        </AudioContext.Provider>
    );
};

export const useAudio = (): AudioContextValue => {
    const context = useContext(AudioContext);
    if (!context) {
        throw new Error('useAudio must be used within an AudioProvider');
    }
    return context;
};
