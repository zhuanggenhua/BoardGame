import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import React from 'react';
import { EventStreamRollbackContext } from '../../../engine/hooks/EventStreamRollbackContext';
import type { QidahenCore, QidahenPublicBattleReport } from '../domain/types';
import type { EventStreamEntry } from '../../../engine/types';
import { QIDAHEN_BATTLE_ROLLED } from '../domain/battleVisualEvent';
import { useQidahenBattlePresentation } from '../ui/useQidahenBattlePresentation';

afterEach(cleanup);

it('权威状态进入战后时仍从战前快照展示参战身份，完成后清理且不重播', () => {
    // 只构造本显示投影读取的字段，规则合法性由年度管线测试覆盖。
    const pending = {
        attackerFactionId: 'ming', defenderFactionId: 'mongol',
        sourceRegionId: 'source', targetRegionId: 'target',
        forceCommitments: [{ selectedSpecialPieceIds: ['infantry', 'artillery'] }],
    };
    const before = { roundNumber: 1, pendingTargetAction: pending, postBattleSelection: null } as unknown as QidahenCore;
    const after = { ...before, pendingTargetAction: null, postBattleSelection: {
        attackerFactionId: pending.attackerFactionId, sourceRegionId: pending.sourceRegionId,
        targetRegionId: pending.targetRegionId, originalController: 'mongol', battleRolls: { stages: [] },
    } } as unknown as QidahenCore;
    const view = renderHook(({ core }) => useQidahenBattlePresentation(core), { initialProps: { core: before } });
    expect(view.result.current.committedPieceIds).toEqual([]);
    view.rerender({ core: after });
    expect(view.result.current.active).toBe(true);
    expect(view.result.current.committedPieceIds).toEqual(['infantry', 'artillery']);
    expect(after.pendingTargetAction).toBeNull();
    act(() => view.result.current.complete());
    expect(view.result.current.active).toBe(false);
    expect(view.result.current.committedPieceIds).toEqual([]);
    view.rerender({ core: { ...after } });
    expect(view.result.current.active).toBe(false);
});

it('全灭后从权威事件播放同一次骰果，完成后释放且不会重播', () => {
    const pending = { attackerFactionId: 'ming', defenderFactionId: 'mongol', sourceRegionId: 'source',
        targetRegionId: 'target', targetRuntimeRegionId: 'target', sourceRegionName: '甲', targetRegionName: '乙',
        defenderLabel: '蒙古', forceCommitments: [{ selectedSpecialPieceIds: ['cavalry'] }] };
    const before = { roundNumber: 1, pendingTargetAction: pending, postBattleSelection: null } as unknown as QidahenCore;
    const after = { ...before, pendingTargetAction: null };
    const rolls = { stages: [{ phase: 'cavalry', attackerRolls: [{ raw: 1 }], defenderRolls: [{ raw: 8 }] }] };
    const report = { ...pending, battleId: 'battle-1', selectedPieceIds: ['cavalry'], rolls } as unknown as QidahenPublicBattleReport;
    const entries: EventStreamEntry[] = [{ id: 2, event: { type: QIDAHEN_BATTLE_ROLLED, timestamp: 10, payload: { report } } }];
    const view = renderHook(({ core, events, waiting }) => useQidahenBattlePresentation(core, events, waiting),
        { initialProps: { core: before, events: [] as EventStreamEntry[], waiting: false } });
    view.rerender({ core: after, events: entries, waiting: true });
    expect(view.result.current.active).toBe(true);
    expect(view.result.current.rolls).toBe(rolls);
    expect(view.result.current.battle?.targetRegionName).toBe('乙');
    expect(view.result.current.displayCore).toBe(before);
    expect(view.result.current.committedPieceIds).toEqual(['cavalry']);
    act(() => view.result.current.complete());
    expect(view.result.current.active).toBe(false);
    view.rerender({ core: after, events: entries, waiting: false });
    expect(view.result.current.active).toBe(false);
});

it('权威事件与仍保留的战果不重复播放；恢复等待时只恢复最近一次，普通重新进入不重播', () => {
    const pending = { attackerFactionId: 'ming', defenderFactionId: 'mongol', sourceRegionId: 'source', targetRegionId: 'target', defenderLabel: '蒙古' };
    const rolls = { stages: [] };
    const before = { roundNumber: 1, pendingTargetAction: pending, postBattleSelection: null } as unknown as QidahenCore;
    const after = { ...before, pendingTargetAction: { ...pending, resolvedBattleRolls: rolls } } as unknown as QidahenCore;
    const report = { ...pending, battleId: 'battle-1', selectedPieceIds: [], rolls } as unknown as QidahenPublicBattleReport;
    const entries: EventStreamEntry[] = [{ id: 4, event: { type: QIDAHEN_BATTLE_ROLLED, timestamp: 10, payload: { report } } }];
    const view = renderHook(({ core, events }) => useQidahenBattlePresentation(core, events),
        { initialProps: { core: before, events: [] as EventStreamEntry[] } });
    view.rerender({ core: after, events: entries });
    expect(view.result.current.active).toBe(true);
    expect(view.result.current.rolls).toBe(rolls);
    act(() => view.result.current.complete());
    expect(view.result.current.active).toBe(false);
    view.unmount();
    const normal = renderHook(() => useQidahenBattlePresentation(after, entries, false));
    expect(normal.result.current.active).toBe(false);
    normal.unmount();
    const waiting = renderHook(() => useQidahenBattlePresentation(after, entries, true));
    expect(waiting.result.current.active).toBe(true);
    act(() => waiting.result.current.complete());
    expect(waiting.result.current.active).toBe(false);
});

it('撤销回退时清理旧战斗表现，之后较小事件编号的新战斗仍可播放', () => {
    const pending = { attackerFactionId: 'ming', defenderFactionId: 'mongol', sourceRegionId: 'a', targetRegionId: 'b', defenderLabel: '蒙古' };
    const core = { roundNumber: 1, pendingTargetAction: pending, postBattleSelection: null } as unknown as QidahenCore;
    const report = { ...pending, battleId: 'battle-1', selectedPieceIds: [], rolls: { stages: [] } } as unknown as QidahenPublicBattleReport;
    const event = { type: QIDAHEN_BATTLE_ROLLED, timestamp: 10, payload: { report } };
    const old: EventStreamEntry[] = [{ id: 10, event: { type: 'OTHER', timestamp: 1, payload: {} } }];
    const view = renderHook(({ entries }) => useQidahenBattlePresentation(core, entries), { initialProps: { entries: old } });
    view.rerender({ entries: [...old, { id: 11, event }] });
    expect(view.result.current.active).toBe(true);
    view.rerender({ entries: [{ id: 8, event: { type: 'OTHER', timestamp: 1, payload: {} } }] });
    expect(view.result.current.active).toBe(false);
    view.rerender({ entries: [{ id: 8, event: { type: 'OTHER', timestamp: 1, payload: {} } }, { id: 9, event }] });
    expect(view.result.current.active).toBe(true);
    act(() => view.result.current.complete());
    expect(view.result.current.active).toBe(false);
});

it('全灭后教程等待期间即使事件流清空，也从正式战报恢复同一次骰果', () => {
    const rolls = { stages: [{ phase: 'cavalry', attackerRolls: [{ raw: 1 }], defenderRolls: [{ raw: 8 }] }] };
    const report = { battleId: 'battle-1', sourceRegionId: 'a', targetRegionId: 'b', targetRegionName: '乙',
        attackerFactionId: 'ming', defenderFactionId: 'mongol', defenderLabel: '蒙古', selectedPieceIds: [], rolls } as unknown as QidahenPublicBattleReport;
    const core = { roundNumber: 1, pendingTargetAction: null, postBattleSelection: null,
        lastSeasonSummary: { id: 'summary', title: '战报', lines: [], battleReport: report } } as unknown as QidahenCore;
    const view = renderHook(() => useQidahenBattlePresentation(core, [], true));
    expect(view.result.current.active).toBe(true);
    expect(view.result.current.rolls).toBe(rolls);
    expect(view.result.current.battle?.targetRegionName).toBe('乙');
    act(() => view.result.current.complete());
    expect(view.result.current.active).toBe(false);
    view.rerender();
    expect(view.result.current.active).toBe(false);
});

it('全灭重连时只为表现恢复公开参战兵牌，不改变权威状态或手牌', () => {
    const soldier = { id: 'lost', faction: 'ming', level: 2, regionId: 'a' };
    const token = { id: 'lost-token', type: 'army', pieceId: 'lost', faction: 'ming', regionId: 'a' };
    const report = { battleId: 'battle-restore', sourceRegionId: 'a', targetRegionId: 'b', targetRegionName: '乙',
        attackerFactionId: 'ming', defenderFactionId: 'mongol', defenderLabel: '蒙古', selectedPieceIds: ['lost'],
        battlefield: { pieces: [soldier], mapTokens: [token] }, rolls: { stages: [] } } as unknown as QidahenPublicBattleReport;
    const core = { roundNumber: 1, pendingTargetAction: null, postBattleSelection: null, pieces: [], mapTokens: [],
        handCards: [{ id: 'private' }], lastSeasonSummary: { id: 's', title: '战报', lines: [], battleReport: report } } as unknown as QidahenCore;
    const view = renderHook(() => useQidahenBattlePresentation(core, [], true));
    expect(view.result.current.displayCore.pieces).toEqual([soldier]);
    expect(view.result.current.displayCore.mapTokens).toEqual([token]);
    expect(view.result.current.displayCore.handCards).toBe(core.handCards);
    expect(core.pieces).toEqual([]);
    expect(JSON.stringify(report)).not.toContain('private');
    act(() => view.result.current.complete());
    expect(view.result.current.displayCore).toBe(core);
});

it('撤退选择仍在时，教程重连也能恢复战前兵牌', () => {
    const soldier = { id: 'lost', faction: 'ming', level: 2, regionId: 'a' };
    const token = { id: 'lost-token', type: 'army', pieceId: 'lost', faction: 'ming', regionId: 'a' };
    const rolls = { stages: [] };
    const report = { battleId: 'retreat', sourceRegionId: 'a', targetRegionId: 'b', targetRegionName: '乙',
        attackerFactionId: 'ming', defenderFactionId: 'mongol', defenderLabel: '蒙古', selectedPieceIds: ['lost'],
        battlefield: { pieces: [soldier], mapTokens: [token] }, rolls } as unknown as QidahenPublicBattleReport;
    const core = { roundNumber: 1, pendingTargetAction: { ...report, resolvedBattleRolls: rolls, battleReport: report },
        postBattleSelection: null, pieces: [], mapTokens: [] } as unknown as QidahenCore;
    const view = renderHook(() => useQidahenBattlePresentation(core, [], true));
    expect(view.result.current.displayCore.pieces).toEqual([soldier]);
    expect(view.result.current.rolls).toBe(rolls);
    act(() => view.result.current.complete());
    expect(view.result.current.active).toBe(false);
});

it('普通对局播放中断线重同步，事件流清空时保留正式战报；重新进入已结束对局不重播', () => {
    const pending = { attackerFactionId: 'ming', defenderFactionId: 'mongol', sourceRegionId: 'a', targetRegionId: 'b', defenderLabel: '蒙古' };
    const rolls = { stages: [] };
    const report = { ...pending, battleId: 'battle-1', selectedPieceIds: [], rolls } as unknown as QidahenPublicBattleReport;
    const before = { roundNumber: 1, pendingTargetAction: pending, postBattleSelection: null } as unknown as QidahenCore;
    const after = { ...before, pendingTargetAction: null, lastSeasonSummary: { id: 's', title: '战报', lines: [], battleReport: report } } as QidahenCore;
    let context = { watermark: null, seq: 0, reconcileSeq: 0 };
    const wrapper = ({ children }: React.PropsWithChildren) => <EventStreamRollbackContext.Provider value={context}>{children}</EventStreamRollbackContext.Provider>;
    const view = renderHook(({ core, events }) => useQidahenBattlePresentation(core, events), { wrapper,
        initialProps: { core: before, events: [] as EventStreamEntry[] } });
    view.rerender({ core: after, events: [{ id: 2, event: { type: QIDAHEN_BATTLE_ROLLED, timestamp: 1, payload: { report } } }] });
    expect(view.result.current.active).toBe(true);
    context = { ...context, seq: 1 };
    view.rerender({ core: after, events: [] });
    expect(view.result.current.active).toBe(true);
    expect(view.result.current.rolls).toBe(rolls);
    act(() => view.result.current.complete());
    expect(view.result.current.active).toBe(false);
    view.unmount();
    const reentered = renderHook(() => useQidahenBattlePresentation(after, [], false));
    expect(reentered.result.current.active).toBe(false);
});

it('预测确认同战同结果不重播，不同战斗及撤销后的重做仍能播放', () => {
    const pending = { attackerFactionId: 'ming', defenderFactionId: 'mongol', sourceRegionId: 'a', targetRegionId: 'b', defenderLabel: '蒙古' };
    const report = { ...pending, battleId: 'turn-1', selectedPieceIds: [], rolls: { stages: [] } } as unknown as QidahenPublicBattleReport;
    const core = { roundNumber: 1, pendingTargetAction: null, postBattleSelection: null } as unknown as QidahenCore;
    let context = { watermark: null as number | null, seq: 0, reconcileSeq: 0 };
    const wrapper = ({ children }: React.PropsWithChildren) => <EventStreamRollbackContext.Provider value={context}>{children}</EventStreamRollbackContext.Provider>;
    const view = renderHook(({ entries }) => useQidahenBattlePresentation(core, entries), { wrapper, initialProps: { entries: [] as EventStreamEntry[] } });
    const entry = (id: number, value: QidahenPublicBattleReport): EventStreamEntry => ({ id, event: { type: QIDAHEN_BATTLE_ROLLED, timestamp: 1, payload: { report: value } } });
    view.rerender({ entries: [entry(2, report)] });
    expect(view.result.current.active).toBe(true);
    act(() => view.result.current.complete());
    context = { ...context, reconcileSeq: 1 };
    view.rerender({ entries: [entry(3, report)] });
    expect(view.result.current.active).toBe(false);
    const next = { ...report, battleId: 'turn-2' };
    view.rerender({ entries: [entry(3, report), entry(4, next)] });
    expect(view.result.current.active).toBe(true);
    act(() => view.result.current.complete());
    context = { ...context, seq: 1, watermark: 1 };
    view.rerender({ entries: [entry(2, report)] });
    expect(view.result.current.active).toBe(true);
});

it('同一战斗确认骰果不同时用权威结果替换预测结果', () => {
    const pending = { attackerFactionId: 'ming', defenderFactionId: 'mongol', sourceRegionId: 'a', targetRegionId: 'b', defenderLabel: '蒙古' };
    const predicted = { ...pending, battleId: 'turn-1', selectedPieceIds: [], rolls: { stages: [] } } as unknown as QidahenPublicBattleReport;
    const confirmed = { ...predicted, rolls: { ...predicted.rolls, summary: 'authoritative' } };
    const core = { roundNumber: 1, pendingTargetAction: null, postBattleSelection: null } as unknown as QidahenCore;
    let context = { watermark: null, seq: 0, reconcileSeq: 0 };
    const wrapper = ({ children }: React.PropsWithChildren) => <EventStreamRollbackContext.Provider value={context}>{children}</EventStreamRollbackContext.Provider>;
    const view = renderHook(({ entries }) => useQidahenBattlePresentation(core, entries), { wrapper, initialProps: { entries: [] as EventStreamEntry[] } });
    const entry = (id: number, report: QidahenPublicBattleReport): EventStreamEntry => ({ id, event: { type: QIDAHEN_BATTLE_ROLLED, timestamp: 1, payload: { report } } });
    view.rerender({ entries: [entry(2, predicted)] });
    context = { ...context, reconcileSeq: 1 };
    view.rerender({ entries: [entry(3, confirmed)] });
    expect(view.result.current.rolls).toBe(confirmed.rolls);
    act(() => view.result.current.complete());
    expect(view.result.current.active).toBe(false);
});
