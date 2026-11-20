import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { EXTERNAL_ROOM_VERSION } from '../../../shared/externalRoom';
import roomSdkV1 from '../roomSdkV1.js?raw';

it('托管房间 SDK 的协议和最新发布记录一致', () => {
    const window: { BoardGameRoomSDK?: { version: number; release: string; createClient: unknown } } = {};
    runInNewContext(roomSdkV1, { window });

    const sdk = window.BoardGameRoomSDK;
    expect(sdk?.version).toBe(EXTERNAL_ROOM_VERSION);
    expect(typeof sdk?.createClient).toBe('function');
    expect(sdk?.release).toMatch(/^1\.\d+\.\d+$/);

    const guide = readFileSync(resolve(process.cwd(), 'public/developers/external-room-sdk.md'), 'utf8');
    const latestRelease = guide.match(/^#### (\d+\.\d+\.\d+)$/m)?.[1];
    expect(latestRelease).toBe(sdk?.release);
});
