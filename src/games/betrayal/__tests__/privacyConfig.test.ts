import { describe, expect, it } from 'vitest';
import { engineConfig } from '../game';

describe('小黑屋联机随机策略', () => {
  it('不向客户端同步权威随机种子，并启用事件流玩家投影', () => {
    expect(engineConfig.randomSyncPolicy).toBe('server-only');
    const stream = engineConfig.systems.find((system) => system.id === 'eventStream');
    expect(stream?.playerView).toBeTypeOf('function');
  });
});
