/**
 * 裁判轨迹系统
 *
 * 保存事件提交阶段产生的审计证据，供测试、回放和诊断查询。
 * 该系统只记录证据，不参与规则授权、事件改写或玩家可见日志。
 */

import type { MatchState, RefereeTraceEntry, RefereeTraceState } from '../types';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';

export interface RefereeTraceSystemConfig {
    /** 最大保留证据条目数 */
    maxEntries?: number;
}

export function createRefereeTraceSystem<TCore>(
    config: RefereeTraceSystemConfig = {},
): EngineSystem<TCore> {
    const { maxEntries = 200 } = config;

    return {
        id: SYSTEM_IDS.REFEREE_TRACE,
        name: '裁判轨迹系统',
        priority: 6,

        setup: (): Partial<{ refereeTrace: RefereeTraceState }> => ({
            refereeTrace: {
                entries: [],
                maxEntries,
                nextId: 1,
            },
        }),

        afterEvents: ({ state, eventCommitEvidence }): HookResult<TCore> | void => {
            if (!eventCommitEvidence || eventCommitEvidence.length === 0) return;

            const currentTrace = state.sys.refereeTrace ?? {
                entries: [],
                maxEntries,
                nextId: 1,
            };
            const normalizedMaxEntries = Number.isFinite(currentTrace.maxEntries)
                ? currentTrace.maxEntries
                : maxEntries;
            let nextId = currentTrace.nextId ?? 1;
            const entries = [...currentTrace.entries];

            for (const evidence of eventCommitEvidence) {
                entries.push({ id: nextId, evidence });
                nextId += 1;
            }

            while (entries.length > normalizedMaxEntries) {
                entries.shift();
            }

            return {
                state: {
                    ...state,
                    sys: {
                        ...state.sys,
                        refereeTrace: {
                            entries,
                            maxEntries: normalizedMaxEntries,
                            nextId,
                        },
                    },
                },
            };
        },
    };
}

export function getRefereeTraceEntries<TCore>(state: MatchState<TCore>): RefereeTraceEntry[] {
    return state.sys.refereeTrace?.entries ?? [];
}
