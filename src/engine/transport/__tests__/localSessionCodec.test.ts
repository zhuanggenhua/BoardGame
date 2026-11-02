import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialSystemState } from '../../pipeline';
import { buildLocalMatchSnapshotKey, persistLocalMatchSnapshot, readLocalMatchSnapshot, type LocalMatchSnapshot } from '../localSession';
import { decodeLocalMatchSnapshot, encodeLocalMatchSnapshot } from '../localSessionCodec';

const snapshot = (large = false): LocalMatchSnapshot => ({
    version: 1, gameId: 'storage-test', seed: 'same-match', numPlayers: 2, randomCursor: 42, savedAt: 1,
    state: { core: { rounds: Array.from({ length: large ? 8000 : 2 }, (_, turn) => ({ turn, text: '军队、手牌、骰子🙂'.repeat(12) })) }, sys: createInitialSystemState(['0', '1'], [], 'storage-test') },
});

describe('本地对局存档无损编码与兼容', () => {
    beforeEach(() => localStorage.clear());
    it('普通小存档保持旧明文，字段和随机游标不变', () => {
        const input = snapshot();
        expect(JSON.parse(encodeLocalMatchSnapshot(input))).toEqual(input);
        expect(decodeLocalMatchSnapshot(JSON.stringify(input))).toEqual(input);
    });
    it('大存档可装入浏览器容量且逐字段完整还原中文、表情与历史', () => {
        const input = snapshot(true);
        expect(JSON.stringify(input).length).toBeGreaterThan(1024 * 1024);
        const encoded = encodeLocalMatchSnapshot(input);
        expect(encoded.length).toBeLessThan(1024 * 1024);
        expect(decodeLocalMatchSnapshot(encoded)).toEqual(input);
    });
    it('既有读取owner仍接受明文v1存档', () => {
        const input = snapshot();
        localStorage.setItem(buildLocalMatchSnapshotKey(input.gameId, input.seed), JSON.stringify(input));
        expect(readLocalMatchSnapshot(input)).toEqual(input);
    });
    it('同一存档键大写小覆盖，不留下另一份进度或丢失游标', () => {
        const input = snapshot(true);
        persistLocalMatchSnapshot(input);
        expect(readLocalMatchSnapshot(input)?.state).toEqual(input.state);
        expect(readLocalMatchSnapshot(input)?.randomCursor).toBe(42);
        const next = snapshot();
        persistLocalMatchSnapshot(next);
        expect(readLocalMatchSnapshot(next)?.state).toEqual(next.state);
        expect(localStorage.length).toBe(1);
    });
    it('损坏编码和不兼容版本按原读取合同拒绝', () => {
        const input = snapshot();
        const key = buildLocalMatchSnapshotKey(input.gameId, input.seed);
        localStorage.setItem(key, JSON.stringify({ storageCodec: 'gzip-base64-v1', payload: 'not-gzip' }));
        expect(readLocalMatchSnapshot(input)).toBeNull();
        localStorage.setItem(key, JSON.stringify({ ...input, version: 99 }));
        expect(readLocalMatchSnapshot(input)).toBeNull();
    });
});
