import { describe, expect, it } from 'vitest';import { QidahenDomain } from '../domain';

import { QIDAHEN_COMMANDS } from '../domain/commands';import { random, stateOf, apply, getWheelDispatchSelection, factionHandCards, clearRuntimeBattleFixture, setRegionCavalry } from './helpers/paymentSelectionHarness';

describe('七大恨调度进攻与战后入口', () => {
it('突袭待结算会阻塞轮转，直到完成当前结算后才能继续本回合', () => {
        const core = setRegionCavalry(
            clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random)),
            'city-region-24',
            'ming',
            2,
        );
        core.selectedRegionId = 'city-region-24';

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });

        expect(pending.pendingTargetAction).not.toBeNull();
        expect(pending.turnPhase).toBe('resolve-pending');
        expect(pending.selectedRegionId).toBe('city-region-24');
        expect(pending.currentPlayer).toBe('0');

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.pendingTargetAction).toBeNull();
        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.currentPlayer).toBe('0');
        expect(resolved.postBattleSelection?.targetRuntimeRegionId).toBe(resolved.selectedRegionId);
        expect(resolved.factionActionUsed).toBe(true);

        expect(QidahenDomain.validate(stateOf(resolved), {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        }).valid).toBe(false);

        const settled = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(settled.postBattleSelection).toBeNull();
        expect(settled.turnPhase).toBe('action-window');
        expect(settled.selectedRegionId).toBe(resolved.selectedRegionId);

        const next = apply(settled, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.currentPlayer).toBe('1');
        expect(next.turnLabel).toContain('蒙古');
    });

it('轮盘走到进攻调度时会先进入目标选择，再按 travelCost 生成待结算', () => {
        const sourceSelected = apply(setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-24' },
        });

        const targeting = apply(sourceSelected, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.selectedRegionId).toBe('city-region-24');
        expect(targeting.pendingTargetAction).toBeNull();
        expect(targeting.factions.mongol.handCount).toBe(8);
        expect(targeting.factions.mongol.drawPileCount).toBe(18);
        expect(factionHandCards(targeting, 'mongol')).toHaveLength(8);
        expect(targeting.factions.jin.handCount).toBe(12);
        expect(targeting.factions.jin.drawPileCount).toBe(18);
        expect(factionHandCards(targeting, 'jin')).toHaveLength(12);
        expect(getWheelDispatchSelection(targeting)).toMatchObject({
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            restriction: '轮盘进攻/调度 · 调骑 4',
        });
        expect(getWheelDispatchSelection(targeting)?.candidates.find((candidate) => candidate.targetRuntimeRegionId === 'city-region-20')).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            targetRegionName: '土默特部',
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
            boundaryUnitCap: null,
        });

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });

        expect(pending.turnPhase).toBe('resolve-pending');
        expect(pending.selectedRegionId).toBe('city-region-20');
        expect(pending.wheelDispatchProgress).toBeNull();
        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            title: '调度进攻待结算',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRuntimeRegionId: 'city-region-20',
            targetRegionName: '土默特部',
            restriction: '轮盘进攻/调度 · 调骑 4',
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
            boundaryUnitCap: null,
        });
        expect(pending.pendingTargetAction?.resolutionHint).toContain('耗2');
        expect(pending.pendingTargetAction?.resolutionHint).toContain('宁远');
        expect(pending.pendingTargetAction?.resolutionHint).toContain('土默特部');
        expect(pending.pendingTargetAction?.resolutionHint).toContain('出兵2/战力2');
        expect(pending.currentPlayer).toBe('0');
        expect(pending.wheelActionUsed).toBe(true);
        expect(pending.actionLog[0]?.text).toContain('锁定调度目标');
    });

it('调度进攻待结算时点逻辑区辽西，不会把 selectedRegionId 漂离真实待结算目标区', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });

        expect(pending.turnPhase).toBe('resolve-pending');
        expect(pending.selectedRegionId).toBe('city-region-20');
        expect(pending.pendingTargetAction?.targetRuntimeRegionId).toBe('city-region-20');

        const reselected = apply(pending, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'liao-xi' },
        });

        expect(reselected.turnPhase).toBe('resolve-pending');
        expect(reselected.selectedRegionId).toBe('city-region-20');
        expect(reselected.explicitRegionId).toBe('liao-xi');
        expect(reselected.pendingTargetAction).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            targetRegionName: '土默特部',
        });

        const resolved = apply(reselected, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-20');
        expect(resolved.explicitRegionId).toBe('liao-xi');
        expect(resolved.postBattleSelection?.targetRuntimeRegionId).toBe('city-region-20');
    });

it('轮盘调骑目标选择中点到只有步兵的己方区域时，会回退到更优的合法骑兵来源区', () => {
        const core = setRegionCavalry(setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 1), 'jinzhou', 'ming', 3);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [
                        {
                            id: 'ming-city-region-14-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.controller === 'ming' && region.id !== 'city-region-24' && region.id !== 'jinzhou' && region.id !== 'city-region-14') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(getWheelDispatchSelection(targeting)).toMatchObject({
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
        });

        const rebound = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-14' },
        });

        expect(rebound.turnPhase).toBe('dispatch-targeting');
        expect(rebound.selectedRegionId).toBe('city-region-24');
        expect(rebound.explicitRegionId).toBe('city-region-14');
        expect(getWheelDispatchSelection(rebound)).toMatchObject({
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
        });
        expect(getWheelDispatchSelection(rebound)?.candidates.length).toBeGreaterThan(0);
    });

it('轮盘调骑目标选择中点到逻辑区辽西时，会把 selectedRegionId 收到真实运行时目标区', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'jinzhou', 'ming', 2);
        core.selectedRegionId = 'jinzhou';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion || region.id !== 'city-region-19-liaoxi') {
                return region;
            }
            return {
                ...region,
                controller: 'neutral',
                controlLabel: '中立',
                troops: 0,
                population: 0,
                specialTroops: [],
                diplomacyMarkerFaction: null,
                diplomacyMarkerSide: null,
                cityState: null,
                siegeState: null,
            };
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        const dispatchSelection = getWheelDispatchSelection(targeting);
        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.selectedRegionId).toBe('jinzhou');
        expect(dispatchSelection?.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                targetRegionId: 'city-region-19-liaoxi',
                targetRuntimeRegionId: 'city-region-19-liaoxi',
                targetRegionName: '辽西',
            }),
        ]));

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'liao-xi' },
        });

        expect(pending.turnPhase).toBe('resolve-pending');
        expect(pending.selectedRegionId).toBe('city-region-19-liaoxi');
        expect(pending.wheelDispatchProgress).toBeNull();
        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            sourceRegionId: 'jinzhou',
            sourceRegionName: '锦州',
            targetRegionId: 'city-region-19-liaoxi',
            targetRegionName: '辽西',
            targetRuntimeRegionId: 'city-region-19-liaoxi',
        });
        expect(pending.actionLog[0]?.text).toContain('辽西');
    });

it('轮盘调骑从逻辑区辽东起手后，误点无骑兵友方区重建选择时仍会保留来源规则名', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-15-liaodong', 'ming', 2);
        core.selectedRegionId = 'liao-dong';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [
                        {
                            id: 'ming-city-region-14-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                        },
                    ],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    cityState: null,
                    siegeState: null,
                };
            }
            if (region.controller === 'ming' && region.id !== 'city-region-15-liaodong' && region.id !== 'city-region-14') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.selectedRegionId).toBe('city-region-15-liaodong');
        expect(getWheelDispatchSelection(targeting)).toMatchObject({
            sourceRegionId: 'city-region-15-liaodong',
            sourceRegionName: '辽东',
        });

        const rebound = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-14' },
        });

        expect(rebound.turnPhase).toBe('dispatch-targeting');
        expect(rebound.selectedRegionId).toBe('city-region-15-liaodong');
        expect(getWheelDispatchSelection(rebound)).toMatchObject({
            sourceRegionId: 'city-region-15-liaodong',
            sourceRegionName: '辽东',
        });
        expect(getWheelDispatchSelection(rebound)?.candidates[0]?.pathLabel).toContain('辽东');
        expect(getWheelDispatchSelection(rebound)?.candidates[0]?.resolutionHint).toContain('辽东');
    });

it('轮盘调骑从逻辑区蓟镇起手后，误点无骑兵友方区重建选择时仍会保留来源规则名', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-28-jizhen', 'ming', 2);
        core.selectedRegionId = 'ji-zhen';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-27') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [
                        {
                            id: 'ming-city-region-27-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                        },
                    ],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    cityState: null,
                    siegeState: null,
                };
            }
            if (region.controller === 'ming' && region.id !== 'city-region-28-jizhen' && region.id !== 'city-region-27') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.selectedRegionId).toBe('city-region-28-jizhen');
        expect(getWheelDispatchSelection(targeting)).toMatchObject({
            sourceRegionId: 'city-region-28-jizhen',
            sourceRegionName: '蓟镇',
        });

        const rebound = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-27' },
        });

        expect(rebound.turnPhase).toBe('dispatch-targeting');
        expect(rebound.selectedRegionId).toBe('city-region-28-jizhen');
        expect(getWheelDispatchSelection(rebound)).toMatchObject({
            sourceRegionId: 'city-region-28-jizhen',
            sourceRegionName: '蓟镇',
        });
        expect(getWheelDispatchSelection(rebound)?.candidates[0]?.pathLabel).toContain('蓟镇');
        expect(getWheelDispatchSelection(rebound)?.candidates[0]?.resolutionHint).toContain('蓟镇');
    });

it('轮盘调骑开始时若当前选中区没有合法骑兵来源，会同步把 selectedRegionId 收到回退后的真实来源区', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'jinzhou', 'ming', 3);
        core.selectedRegionId = 'city-region-14';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [
                        {
                            id: 'ming-city-region-14-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.controller === 'ming' && region.id !== 'jinzhou' && region.id !== 'city-region-14') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        const dispatchSelection = getWheelDispatchSelection(targeting);
        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.selectedRegionId).toBe('jinzhou');
        expect(dispatchSelection).toMatchObject({
            sourceRegionId: 'jinzhou',
            sourceRegionName: '锦州',
        });
        expect(dispatchSelection?.candidates.length).toBeGreaterThan(0);
    });

it('调骑 4 在结构化兵种区域只会投入骑兵，不会拿步兵冒充骑兵', () => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        core.selectedRegionId = 'city-region-16';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'ming-cavalry-lv2',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 1,
                            level: 2,
                        },
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        const dispatchSelection = getWheelDispatchSelection(targeting);
        const candidate = dispatchSelection?.candidates.find((item) => item.targetRuntimeRegionId === 'city-region-14');
        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.selectedRegionId).toBe('city-region-16');
        expect(dispatchSelection?.sourceRegionId).toBe('city-region-16');
        expect(dispatchSelection?.restriction).toBe('轮盘进攻/调度 · 调骑 4');
        expect(candidate).toMatchObject({
            sourceAvailableTroops: 1,
            committedTroops: 1,
            attackPressure: 1,
        });
        expect(candidate?.resolutionHint).toContain('出兵1/战力1');
    });

it('调骑 4 占领空区时会转移骑兵栈，而不是转移高等级步兵栈', () => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        core.selectedRegionId = 'city-region-16';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv4',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 4,
                        },
                        {
                            id: 'ming-cavalry-lv2',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 1,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-14' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });
        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            troops: 2,
            specialTroops: [
                {
                    id: 'ming-infantry-lv4',
                    label: '大明步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 2,
                    level: 4,
                },
            ],
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'ming',
            troops: 1,
            specialTroops: [
                {
                    id: 'ming-cavalry-lv2',
                    label: '大明骑兵',
                    faction: 'ming',
                    troopKind: 'cavalry',
                    count: 1,
                    level: 2,
                },
            ],
        });
    });

it('调步 2 占领空区时不会把骑兵栈当作步兵转移', () => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        core.actionWheelPosition = 'wheel-recruit-train';
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'ming-cavalry-lv4',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 1,
                            level: 4,
                        },
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const dispatchSelection = getWheelDispatchSelection(targeting);
        const candidate = dispatchSelection?.candidates.find((item) => item.targetRuntimeRegionId === 'city-region-20');
        expect(dispatchSelection?.restriction).toBe('轮盘进攻/调度 · 调步 2');
        expect(candidate).toMatchObject({
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
        });

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });
        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 1,
            specialTroops: [
                {
                    id: 'ming-cavalry-lv4',
                    label: '大明骑兵',
                    faction: 'ming',
                    troopKind: 'cavalry',
                    count: 1,
                    level: 4,
                },
            ],
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'ming',
            troops: 2,
            specialTroops: [
                {
                    id: 'ming-infantry-lv2',
                    label: '大明步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 2,
                    level: 2,
                },
            ],
        });
    });

it('结构化区域没有骑兵时不会进入调骑 4 目标选择', () => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        core.selectedRegionId = 'city-region-16';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 3,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 0,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('city-region-16');
        expect(next.wheelDispatchProgress).toBeNull();
        expect(next.pendingTargetAction).toBeNull();
    });

it('调度目标选择不会把己方友好区列为可攻击目标', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-recruit-train';
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                };
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'neutral',
                    diplomacyMarkerFaction: 'ming',
                    diplomacyMarkerSide: 'friendly',
                    controlLabel: '大明友好',
                    troops: 0,
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        const dispatchSelection = getWheelDispatchSelection(targeting);
        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.selectedRegionId).toBe('city-region-24');
        expect(dispatchSelection?.sourceRegionId).toBe('city-region-24');
        expect(dispatchSelection?.candidates.some((candidate) => candidate.targetRuntimeRegionId === 'city-region-16')).toBe(false);
        expect((dispatchSelection?.candidates.length ?? 0)).toBeGreaterThan(0);
        expect(dispatchSelection?.candidates.some((candidate) => candidate.targetRuntimeRegionId === 'city-region-20')).toBe(true);
    });

it('调度进攻打入中立区时会按人口生成中立守军并在未突破时保留中立控制', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 1);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 3,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(getWheelDispatchSelection(targeting)?.candidates.some((candidate) => candidate.targetRuntimeRegionId === 'city-region-20')).toBe(true);

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });

        expect(pending.pendingTargetAction?.targetRuntimeRegionId).toBe('city-region-20');

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'neutral',
            controlLabel: '中立',
            troops: 2,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-20')?.note).toContain('中立守军');
        expect(resolved.pendingTargetAction).toBeNull();
    });

it('调度进攻打入旱灾中立区时不会按真实人口生成中立守军', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 1);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 3,
                    eventMarkers: [{
                        id: 'drought-marker-city-region-20',
                        kind: 'drought' as const,
                        label: '旱灾标记',
                        sourceCardDefId: 'qidahen-atlas05-1608-mongol-drought',
                        imageSrc: 'qidahen/markers/drought-marker',
                    }],
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        const targetRegion = resolved.regions.find((region) => region.id === 'city-region-20');
        expect(targetRegion?.note).not.toContain('中立守军');
        expect(targetRegion?.population).toBe(3);
    });

it('进攻压力会受实际可投入兵力截断，而不是只看边界宽度', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 1);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    troops: 1,
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 3,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });

        expect(pending.pendingTargetAction).toMatchObject({
            sourceAvailableTroops: 1,
            committedTroops: 1,
            attackPressure: 1,
            boundaryUnitCap: null,
        });

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'neutral',
            controlLabel: '中立',
            troops: 2,
        });
        expect(resolved.actionLog[0]?.text).toContain('投入 1 部队');
    });

it('调度进攻攻下空区后会进入战后处理，并在占领后把已投入部队从源区移入目标区', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });
        const committedSourceStack = resolved.regions
            .find((region) => region.id === 'city-region-24')
            ?.specialTroops[0];
        const committedPieceIds = committedSourceStack?.pieceIds ?? [];

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-20');
        expect(resolved.postBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            committedTroops: 2,
        });
        expect(committedPieceIds).toHaveLength(2);
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 2,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'neutral',
            controlLabel: '中立',
            troops: 0,
        });

        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.selectedRegionId).toBe('city-region-20');
        expect(occupied.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 0,
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'ming',
            controlLabel: '大明附庸',
            diplomacyMarkerFaction: 'ming',
            diplomacyMarkerSide: 'vassal',
            troops: 2,
        });
        expect(
            occupied.regions
                .find((region) => region.id === 'city-region-20')
                ?.specialTroops[0]
                ?.pieceIds,
        ).toEqual(committedPieceIds);
        expect(
            occupied.pieces
                .filter((piece) => piece.regionId === 'city-region-20' && piece.location === 'field')
                .map((piece) => piece.id),
        ).toEqual(committedPieceIds);
        expect(occupied.regions.find((region) => region.id === 'city-region-20')?.note).toContain('进驻 2 个幸存部队');
        expect(occupied.mapTokens.find((token) => token.id === 'diplomacy-marker-city-region-20')).toMatchObject({
            faction: 'ming',
            imageSrc: 'qidahen/markers/ming-control-diplomacy-marker-a',
        });
    });

it('战后处理等待选择时点逻辑区辽西，不会把 selectedRegionId 漂离真实战场目标区', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-20');
        expect(resolved.postBattleSelection?.targetRuntimeRegionId).toBe('city-region-20');

        const reselected = apply(resolved, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'liao-xi' },
        });

        expect(reselected.turnPhase).toBe('post-battle-decision');
        expect(reselected.selectedRegionId).toBe('city-region-20');
        expect(reselected.explicitRegionId).toBe('liao-xi');
        expect(reselected.postBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            targetRegionName: '土默特部',
        });

        const occupied = apply(reselected, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.selectedRegionId).toBe('city-region-20');
        expect(occupied.explicitRegionId).toBe('liao-xi');
    });

it('战后处理可按人口数量选择劫掠并按低保真抽牌结算', () => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        core.selectedRegionId = 'city-region-24';
        core.actionWheelPosition = 'wheel-recruit-train';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                    population: 0,
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 3,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection?.choices.find((choice) => choice.id === 'occupy-plunder-3')).toMatchObject({
            mode: 'occupy',
            plunderPopulation: 3,
        });

        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy-plunder-3' },
        });

        expect(occupied.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'ming',
            controlLabel: '大明附庸',
            population: 0,
            troops: 3,
        });
        expect(occupied.factions.ming.handCount).toBe(core.factions.ming.handCount + 3);
        expect(occupied.drawPileCount).toBe(core.drawPileCount - 6);
        expect(occupied.discardPileCount).toBe(core.discardPileCount + 3);
        expect(occupied.handCards.length).toBe(core.handCards.length + 3);
        expect(occupied.regions.find((region) => region.id === 'city-region-20')?.note).toContain('劫掠移除 3 人口');
        expect(occupied.actionLog[0]?.text).toContain('劫掠');
        expect(occupied.lastSeasonSummary?.lines.some((line) => line.includes('劫掠移除 3 人口'))).toBe(true);
    });

it('战后处理可选择抽被占领者牌堆进行劫掠', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.actionWheelPosition = 'wheel-recruit-train';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                    population: 0,
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 2,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection?.choices.find((choice) => choice.id === 'occupy-plunder-defender-2')).toMatchObject({
            mode: 'occupy',
            plunderPopulation: 2,
            plunderSource: 'defender',
        });

        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy-plunder-defender-2' },
        });

        expect(occupied.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'ming',
            controlLabel: '大明',
            population: 0,
            troops: 5,
        });
        expect(occupied.factions.ming.handCount).toBe(core.factions.ming.handCount + 2);
        expect(occupied.drawPileCount).toBe(core.drawPileCount);
        expect(occupied.factions.ming.drawPileCount).toBe(core.factions.ming.drawPileCount);
        expect(occupied.factions.jin.drawPileCount).toBe(core.factions.jin.drawPileCount - 2);
        expect(occupied.discardPileCount).toBe(core.discardPileCount);
        expect(occupied.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount);
        expect(occupied.factions.jin.discardPileCount).toBe(core.factions.jin.discardPileCount);
        expect(occupied.handCards.length).toBe(core.handCards.length + 2);
        expect(occupied.actionLog[0]?.text).toContain('抽后金牌堆获得 2 张手牌');
    });

it('朝鲜区域即使有异常人口数据也不会生成劫掠选项', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-diplomacy';
        core.selectedRegionId = 'city-region-5';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-5') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                    population: 0,
                };
            }
            if (region.id === 'xian-xing') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 3,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'xian-xing' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection?.targetRuntimeRegionId).toBe('xian-xing');
        expect(resolved.postBattleSelection?.choices.map((choice) => choice.id)).toEqual(expect.arrayContaining([
            'occupy',
            'withdraw:city-region-5',
        ]));
        expect(resolved.postBattleSelection?.choices.some((choice) => choice.plunderPopulation > 0)).toBe(false);

        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.factions.ming.handCount).toBe(core.factions.ming.handCount + 1);
        expect(occupied.koreaDeckCount).toBe(core.koreaDeckCount - 1);
        expect(occupied.actionLog[0]?.text).toContain('抽朝鲜牌 1 张');
    });

it('阿敏在场时后金攻陷朝鲜区域会额外多抽 1 张朝鲜牌', () => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        core.currentPlayer = '2';
        core.actionWheelPosition = 'wheel-diplomacy';
        core.selectedRegionId = 'city-region-5';
        core.factions = {
            ...core.factions,
            jin: {
                ...core.factions.jin,
                characters: core.factions.jin.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'jin-amin',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-5') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 6,
                    population: 0,
                };
            }
            if (region.id === 'xian-xing') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '2',
            payload: { moveId: 'move-1-free' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '2',
            payload: { regionId: 'xian-xing' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });
        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '2',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.factions.jin.handCount).toBe(core.factions.jin.handCount + 2);
        expect(occupied.koreaDeckCount).toBe(core.koreaDeckCount - 2);
        expect(occupied.actionLog[0]?.text).toContain('抽朝鲜牌 2 张');
    });

it('战后可选择放弃占领并退回相邻友方区域', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        const withdrawn = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'withdraw:city-region-24' },
        });

        expect(withdrawn.selectedRegionId).toBe('city-region-24');
        expect(withdrawn.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 2,
        });
        expect(withdrawn.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'neutral',
            controlLabel: '中立',
            troops: 0,
        });
        expect(withdrawn.actionLog[0]?.text).toContain('放弃占领');
    });

it('战后放弃占领并退回己方围城城市时，会直接并入 siegeState 而不是落到城市顶层', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.postBattleSelection = {
            actionId: 'raid',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-20',
            targetRegionName: '土默特部',
            targetRuntimeRegionId: 'city-region-20',
            committedTroops: 3,
            survivingTroops: 2,
            attackerLosses: 1,
            movementProfileId: null,
            attackerCasualtyPriority: 'highest-level',
            originalController: 'neutral',
            originalControlLabel: '中立',
            title: '战后处理',
            summary: '测试',
            choices: [
                {
                    id: 'withdraw:city-region-25',
                    mode: 'withdraw',
                    regionId: 'city-region-25',
                    plunderPopulation: 0,
                    plunderSource: null,
                    label: '回退山海关',
                    detail: '测试',
                },
            ],
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 3, level: 1, pieceIds: ['ming-ningyuan-infantry-piece-1', 'ming-ningyuan-infantry-piece-2', 'ming-ningyuan-infantry-piece-3'] },
                        { id: 'ming-ningyuan-cavalry-lv2', label: '大明骑兵', faction: 'ming', troopKind: 'cavalry', count: 1, level: 2, pieceIds: ['ming-ningyuan-cavalry-piece-1'] },
                    ],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 2,
                        attackerSpecialTroops: [
                            { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1, pieceIds: ['ming-shanhaiguan-infantry-piece-1', 'ming-shanhaiguan-infantry-piece-2'] },
                        ],
                        sourceRegionId: 'city-region-24',
                    },
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const withdrawn = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'withdraw:city-region-25' },
        });

        expect(withdrawn.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 1,
        });
        expect(withdrawn.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 0,
            population: 0,
            siegeState: {
                attackerFactionId: 'ming',
                attackerTroops: 4,
                attackerSpecialTroops: [
                    expect.objectContaining({ id: 'ming-shanhaiguan-infantry-lv1', count: 2 }),
                    expect.objectContaining({ id: 'ming-ningyuan-infantry-lv1', count: 2 }),
                ],
            },
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [],
            },
        });
        const withdrawnSiegeRegion = withdrawn.regions.find((region) => region.id === 'city-region-25');
        const withdrawnSiegePieceIds = withdrawnSiegeRegion?.siegeState?.attackerSpecialTroops.flatMap((stack) => stack.pieceIds ?? []) ?? [];
        expect(withdrawnSiegePieceIds.sort()).toEqual([
            'ming-shanhaiguan-infantry-piece-1',
            'ming-shanhaiguan-infantry-piece-2',
            'ming-ningyuan-infantry-piece-1',
            'ming-ningyuan-infantry-piece-2',
        ].sort());
        expect(
            withdrawn.pieces
                .filter((piece) => piece.regionId === 'city-region-25' && piece.location === 'siege-attacker')
                .map((piece) => piece.id)
                .sort(),
        ).toEqual(withdrawnSiegePieceIds.slice().sort());
        expect(withdrawn.actionLog[0]?.text).toContain('撤回 山海关');
    });

it('战后处理会把相邻友好区也列为可回退目标', () => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        core.actionWheelPosition = 'wheel-recruit-train';
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                };
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'neutral',
                    diplomacyMarkerFaction: 'ming',
                    diplomacyMarkerSide: 'friendly',
                    controlLabel: '大明友好',
                    troops: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection?.choices.some((choice) => choice.id === 'withdraw:city-region-16')).toBe(true);

        const withdrawn = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'withdraw:city-region-16' },
        });

        expect(withdrawn.selectedRegionId).toBe('city-region-16');
        expect(withdrawn.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            controlLabel: '大明友好',
            troops: 4,
        });
        expect(withdrawn.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'neutral',
            controlLabel: '中立',
            troops: 0,
        });
    });

it('战斗胜负会按剩余部队数判定，攻方即使未杀光守军也可突破进入战后处理', () => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        core.actionWheelPosition = 'wheel-recruit-train';
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 4,
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-20');
        expect(resolved.postBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            survivingTroops: 3,
            attackerLosses: 3,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'neutral',
            controlLabel: '中立',
            troops: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-20')?.note).toContain('兵力劣势');
        expect(resolved.actionLog[0]?.text).toContain('以 3 比 1 压倒守军');
    });
});
