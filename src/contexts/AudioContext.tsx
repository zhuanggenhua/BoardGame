/**
 * 音频上下文 - 提供全局音频状态和控制
 */
import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { AudioManager } from '../lib/audio/AudioManager';

interface AudioContextValue {
    muted: boolean;
    volume: number;
    toggleMute: () => void;
    setVolume: (volume: number) => void;
    play: (key: string, spriteKey?: string) => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export const AudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [muted, setMuted] = useState(false);
    const [volume, setVolumeState] = useState(1.0);

    // 初始化音频管理器
    useEffect(() => {
        AudioManager.initialize();
        setMuted(AudioManager.muted);
        setVolumeState(AudioManager.volume);
    }, []);

    const toggleMute = useCallback(() => {
        const newMuted = !muted;
        AudioManager.setMuted(newMuted);
        setMuted(newMuted);
    }, [muted]);

    const setVolume = useCallback((vol: number) => {
        AudioManager.setVolume(vol);
        setVolumeState(vol);
    }, []);

    const play = useCallback((key: string, spriteKey?: string) => {
        AudioManager.play(key, spriteKey);
    }, []);

    return (
        <AudioContext.Provider value={{ muted, volume, toggleMute, setVolume, play }}>
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
