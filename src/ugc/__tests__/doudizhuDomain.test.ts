import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RuntimeDomainExecutor } from '../runtime/domainExecutor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const previewPath = path.resolve(__dirname, '../../../docs/ugc/doudizhu-preview.ugc.json');

let rulesCode = '';

beforeAll(async () => {
  const jsonText = await readFile(previewPath, 'utf-8');
  const parsed = JSON.parse(jsonText) as { rulesCode?: string };
  rulesCode = String(parsed.rulesCode || '');
});

async function setupExecutor(playerIds: string[] = ['player-1', 'player-2', 'player-3']) {
  const executor = new RuntimeDomainExecutor({ timeoutMs: 200 });
  const loadResult = await executor.loadCode(rulesCode);
  expect(loadResult.success).toBe(true);
  const setupResult = await executor.setup(playerIds, 42);
  expect(setupResult.success).toBe(true);
  return { executor, state: setupResult.result! };
}

describe('DouDiZhu DomainCore', () => {
  it('setup 应发牌并固定地主为首位', async () => {
    const { state } = await setupExecutor();
    const zones = state.publicZones as Record<string, unknown>;
    const hands = zones.hands as Record<string, Array<{ id: string }>>;

    expect(state.activePlayerId).toBe('player-1');
    expect(zones.landlordId).toBe('player-1');
    expect(hands['player-1'].length).toBe(20);
    expect(hands['player-2'].length).toBe(17);
    expect(hands['player-3'].length).toBe(17);
    expect(state.players['player-1'].handCount).toBe(20);
  });

  it('validate 应拒绝非当前玩家出牌与无上家时 PASS', async () => {
    const { executor, state } = await setupExecutor();
    const invalidTurn = await executor.validate(state, {
      type: 'PLAY_CARD',
      playerId: 'player-2',
      payload: { cardIds: [] },
      timestamp: Date.now(),
    });
    expect(invalidTurn.success).toBe(true);
    expect(invalidTurn.result?.valid).toBe(false);

    const invalidPass = await executor.validate(state, {
      type: 'PASS',
      playerId: 'player-1',
      payload: {},
      timestamp: Date.now(),
    });
    expect(invalidPass.success).toBe(true);
    expect(invalidPass.result?.valid).toBe(false);
  });

  it('出牌与连续 PASS 应推进回合并清空上轮出牌', async () => {
    const { executor, state: initial } = await setupExecutor();
    const zones = initial.publicZones as Record<string, unknown>;
    const hands = zones.hands as Record<string, Array<{ id: string }>>;
    const firstCardId = hands['player-1'][0].id;

    const playCommand = {
      type: 'PLAY_CARD',
      playerId: 'player-1',
      payload: { cardIds: [firstCardId] },
      timestamp: Date.now(),
    };
    const validation = await executor.validate(initial, playCommand);
    expect(validation.result?.valid).toBe(true);

    const executeResult = await executor.execute(initial, playCommand, 7);
    expect(executeResult.success).toBe(true);

    const reduceResult = await executor.reduce(initial, executeResult.result![0]);
    expect(reduceResult.success).toBe(true);
    let state = reduceResult.result!;
    let nextZones = state.publicZones as Record<string, unknown>;

    expect(state.activePlayerId).toBe('player-2');
    expect(nextZones.lastPlay).not.toBeNull();
    expect(Number(nextZones.passCount || 0)).toBe(0);

    const passCommand = {
      type: 'PASS',
      playerId: 'player-2',
      payload: {},
      timestamp: Date.now(),
    };
    const passValidation = await executor.validate(state, passCommand);
    expect(passValidation.result?.valid).toBe(true);

    const passExec = await executor.execute(state, passCommand, 8);
    const passReduced = await executor.reduce(state, passExec.result![0]);
    state = passReduced.result!;
    nextZones = state.publicZones as Record<string, unknown>;
    expect(state.activePlayerId).toBe('player-3');
    expect(Number(nextZones.passCount || 0)).toBe(1);

    const passCommand2 = {
      type: 'PASS',
      playerId: 'player-3',
      payload: {},
      timestamp: Date.now(),
    };
    const passExec2 = await executor.execute(state, passCommand2, 9);
    const passReduced2 = await executor.reduce(state, passExec2.result![0]);
    state = passReduced2.result!;
    nextZones = state.publicZones as Record<string, unknown>;

    expect(state.activePlayerId).toBe('player-1');
    expect(nextZones.lastPlay).toBeNull();
    expect(Number(nextZones.passCount || 0)).toBe(0);
  });
});
