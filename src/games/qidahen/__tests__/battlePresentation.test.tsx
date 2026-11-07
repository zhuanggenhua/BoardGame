import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { QidahenCore } from '../domain/types';
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
