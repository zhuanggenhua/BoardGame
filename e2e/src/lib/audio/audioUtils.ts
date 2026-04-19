import type { SoundKey } from './types';
import { playSound } from './useGameAudio';

export interface RandomSoundOptions {
    /** 最小重复间隔次数（避免连续相同） */
    minGap?: number;
    /** 可选权重（与 keys 一一对应） */
    weights?: number[];
}

export interface DiceRollSoundPool {
    /** 单颗骰子（diceCount=1）专用 key */
    single: SoundKey;
    /** 多颗骰子（diceCount>=2）随机池 */
    multiple: SoundKey[];
}

const lastIndexByGroup = new Map<string, number>();

const pickWeightedIndex = (weights: number[]): number => {
    const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
    if (total <= 0) return 0;
    const rand = Math.random() * total;
    let acc = 0;
    for (let i = 0; i < weights.length; i += 1) {
        acc += Math.max(0, weights[i]);
        if (rand < acc) return i;
    }
    return weights.length - 1;
};

export const pickRandomSoundKey = (
    groupId: string,
    keys: SoundKey[],
    options: RandomSoundOptions = {}
): SoundKey => {
    if (keys.length === 0) {
        throw new Error('[Audio] pickRandomSoundKey 需要至少一个音效 key');
    }

    const { minGap = 1, weights } = options;
    const prevIndex = lastIndexByGroup.get(groupId);

    const tryPick = () => {
        if (weights && weights.length === keys.length) {
            return pickWeightedIndex(weights);
        }
        return Math.floor(Math.random() * keys.length);
    };

    let nextIndex = tryPick();
    if (prevIndex !== undefined && keys.length > 1) {
        let attempts = 0;
        while (nextIndex === prevIndex && attempts < minGap) {
            nextIndex = tryPick();
            attempts += 1;
        }
        if (nextIndex === prevIndex) {
            nextIndex = (prevIndex + 1) % keys.length;
        }
    }

    lastIndexByGroup.set(groupId, nextIndex);
    return keys[nextIndex];
};

export const pickDiceRollSoundKey = (
    groupId: string,
    diceCount: number,
    pool: DiceRollSoundPool,
    options: RandomSoundOptions = {}
): SoundKey => {
    const normalizedCount = Number.isFinite(diceCount) ? Math.max(1, Math.floor(diceCount)) : 1;
    if (normalizedCount <= 1) {
        return pool.single;
    }

    const multiKeys = pool.multiple.length > 0 ? pool.multiple : [pool.single];
    return pickRandomSoundKey(groupId, multiKeys, options);
};

export const playRandomSound = (
    groupId: string,
    keys: SoundKey[],
    options?: RandomSoundOptions
): SoundKey => {
    const key = pickRandomSoundKey(groupId, keys, options);
    playSound(key);
    return key;
};
