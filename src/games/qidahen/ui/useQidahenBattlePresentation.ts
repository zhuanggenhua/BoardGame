import React from 'react';
import type { QidahenCore } from '../domain/types';

const rollsFor = (core: QidahenCore) => core.pendingTargetAction?.resolvedBattleRolls ?? core.postBattleSelection?.battleRolls ?? null;
const identityFor = (core: QidahenCore) => {
    const rolls = rollsFor(core);
    const battle = core.pendingTargetAction ?? core.postBattleSelection;
    return rolls && battle ? `${core.roundNumber}:${battle.sourceRegionId}:${battle.targetRegionId}:${JSON.stringify(rolls)}` : null;
};

/** 仅持有真实结算前的显示快照，不改规则状态；刷新已存在的结果不会重新投掷。 */
export function useQidahenBattlePresentation(core: QidahenCore) {
    const identity = identityFor(core);
    const [completed, setCompleted] = React.useState<string | null>(() => identity);
    const [before, setBefore] = React.useState<QidahenCore | null>(null);
    const previousCore = React.useRef(core);
    const active = identity != null && completed !== identity;
    React.useLayoutEffect(() => {
        if (active && !rollsFor(previousCore.current)) setBefore(previousCore.current);
        if (!active) setBefore(null);
        if (identity == null) setCompleted(null);
        previousCore.current = core;
    }, [core, identity, active]);
    const complete = React.useCallback(() => setCompleted(identity), [identity]);
    return { identity, active, rolls: rollsFor(core), displayCore: active && before ? before : core, complete };
}
