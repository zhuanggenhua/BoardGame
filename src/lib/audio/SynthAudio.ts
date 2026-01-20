/**
 * 占位符音频生成脚本
 * 
 * 由于无法直接生成真实音频文件，这里创建一个简单的降级方案：
 * 使用 Web Audio API 的 OscillatorNode 生成简单的合成音效
 * 
 * 使用方法：
 * 1. 将此文件的 SynthAudio 导入到 AudioManager
 * 2. 在音频加载失败时自动回退到合成音
 */

// 合成音效类型
type SynthType = 'beep' | 'pop' | 'fanfare' | 'buzz' | 'soft-pop' | 'sweep';

// 合成音效配置
const SYNTH_PRESETS: Record<string, { type: SynthType; frequency: number; duration: number; volume?: number }> = {
    place_x: { type: 'pop', frequency: 440, duration: 0.1, volume: 0.4 },
    place_o: { type: 'pop', frequency: 330, duration: 0.1, volume: 0.4 },
    victory: { type: 'fanfare', frequency: 392, duration: 0.6, volume: 0.3 }, // 保持柔和的胜利音
    draw: { type: 'buzz', frequency: 150, duration: 0.4, volume: 0.2 },
    hover: { type: 'beep', frequency: 880, duration: 0.05, volume: 0.1 },
    click: { type: 'beep', frequency: 660, duration: 0.08, volume: 0.2 },
};

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
}

/**
 * 播放合成音效
 */
export function playSynthSound(key: string): void {
    const preset = SYNTH_PRESETS[key];
    if (!preset) return;

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // 根据类型选择波形
    switch (preset.type) {
        case 'fanfare':
            oscillator.type = 'triangle'; // 柔和的波形
            break;
        case 'buzz':
            oscillator.type = 'sawtooth';
            break;
        case 'pop':
        case 'soft-pop':
        default:
            oscillator.type = 'sine';
    }

    const now = ctx.currentTime;
    const volume = preset.volume ?? 0.3;

    // 优化的包络线，避免“卡嗒”声
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + preset.duration);

    oscillator.frequency.setValueAtTime(preset.frequency, now);

    // 仅保留胜利音效的滑音，使其更有节奏感
    if (preset.type === 'fanfare') {
        oscillator.frequency.exponentialRampToValueAtTime(preset.frequency * 1.5, now + preset.duration);
    }

    oscillator.start(now);
    oscillator.stop(now + preset.duration);
}

/**
 * 获取所有可用的合成音效键
 */
export function getSynthSoundKeys(): string[] {
    return Object.keys(SYNTH_PRESETS);
}
