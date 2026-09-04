import { describe, expect, it } from 'vitest';import { QidahenDomain } from '../domain';

import { QIDAHEN_COMMANDS } from '../domain/commands';import { random, apply, getFortificationMaintenanceSelection } from './helpers/paymentSelectionHarness';

describe('七大恨新年结算', () => {
it('轮盘进入新年时会结算朝鲜朝贡、防线维护与兵力耗损', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 6,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'xian-xing') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                };
            }
            if (region.id === 'city-region-18' || region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                };
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    troops: 3,
                    population: 1,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.actionWheelPosition).toBe('wheel-new-year');
        expect(next.currentYearIndex).toBe(0);
        expect(getFortificationMaintenanceSelection(next)?.title).toBe('新年防线维护');
        expect(next.selectedRegionId).toBe('song-jin');
        expect(next.lastSeasonSummary?.title).toBe('新年结算');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('等待大明选择防线维护方式');

        const settled = apply(next, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'auto-pay' },
        });

        expect(settled.currentYearIndex).toBe(1);
        expect(settled.currentYear).toBe('天命五年 1620');
        expect(settled.currentPlayer).toBe('0');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-28');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-28');
        expect(settled.lastSeasonSummary?.title).toBe('新年结算');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 因朝鲜朝贡获得 1 张朝鲜牌');
        expect(settled.koreaDeckCount).toBe(core.koreaDeckCount - 1);
        expect(settled.fortifications.find((fortification) => fortification.id === 'shanhaiguan')?.ruined).toBe(false);
        expect(settled.fortifications.find((fortification) => fortification.id === 'inner-wall')?.ruined).toBe(true);
        expect(settled.fortifications.find((fortification) => fortification.id === 'outer-wall')?.ruined).toBe(true);
        expect(settled.regions.find((region) => region.id === 'jinzhou')?.boundaryTypeByRegionId['city-region-25']).toBe('city');
        expect(settled.regions.find((region) => region.id === 'song-jin')?.troops).toBe(1);
        expect(settled.factions.ming.handCount).toBe(0);
        expect(settled.actionLog.some((entry) => entry.text.includes('已执行新年结算'))).toBe(true);
    });

it('新年防线维护等待选择时点逻辑区辽西，不会把 selectedRegionId 漂离当前焦点', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 6,
            },
        };

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(pending.turnPhase).toBe('season-resolution');
        expect(pending.selectedRegionId).toBe('song-jin');
        expect(getFortificationMaintenanceSelection(pending)?.title).toBe('新年防线维护');
        const anchoredRegionId = pending.selectedRegionId;

        const reselected = apply(pending, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'liao-xi' },
        });

        expect(reselected.turnPhase).toBe('season-resolution');
        expect(reselected.selectedRegionId).toBe(anchoredRegionId);
        expect(getFortificationMaintenanceSelection(reselected)?.title).toBe('新年防线维护');
    });

it('蒙古跨到后金的新年防线维护等待态会重新锚定逻辑区辽西，而不是沿当前玩家默认选区漂到建州', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.turnLabel = '第 1 轮 · 蒙古 · 行动窗口';
        core.turnPhase = 'action-window';
        core.wheelActionUsed = false;
        core.factionActionUsed = false;
        core.actionWheelPosition = 'wheel-hire';
        core.selectedWheelMoveId = 'move-2-one-opponent';
        core.selectedRegionId = 'city-region-25';
        core.selectedActionId = 'khan-edict';
        core.selectedPaymentCardIds = [];
        core.recruitSelection = null;
        core.khanEdictSelection = null;
        core.maShiTradeSelection = null;
        core.wheelDispatchProgress = null;
        core.pendingTargetAction = null;
        core.postBattleSelection = null;
        core.lastSeasonSummary = null;
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                defeatMarkers: 1,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-mao-wenlong',
                })),
            },
            mongol: {
                ...core.factions.mongol,
                defeatMarkers: 1,
            },
            jin: {
                ...core.factions.jin,
                defeatMarkers: 1,
            },
        };
        core.payment = { required: 1, selected: 0, prompt: '需弃 1 / 已选 0' };
        core.actionChoices = [
            { id: 'upgrade-armament', label: '升级军备', cost: 2, detail: '弃 1 张手牌，选择一项已开发军备进行升级。' },
            { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
            { id: 'ma-shi-trade', label: '马市贸易', cost: 1, detail: '弃 1 张手牌，大明选择建立 1-3 个部队，蒙古抽 2 倍张数的手牌。' },
            { id: 'khan-edict', label: '大汗令箭', cost: 1, detail: '弃 1 张手牌，执行征兵训练或外交雇佣，不需再支付花费。' },
        ];
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return { ...region, controller: 'mongol', controlLabel: '蒙古', troops: 2 };
            }
            if (region.id === 'city-region-24') {
                return { ...region, controller: 'ming', controlLabel: '大明', troops: 1 };
            }
            return region;
        });

        const khanEdict = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        const khanResolved = apply(khanEdict, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'recruit-train' },
        });
        const midyear = apply(khanResolved, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '1',
            payload: { moveId: 'move-2-one-opponent' },
        });
        const pending = apply(midyear, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: String(midyear.currentPlayer),
            payload: { moveId: 'move-1-free' },
        });

        expect(midyear.currentPlayer).toBe('2');
        expect(midyear.selectedRegionId).toBe('city-region-13');
        expect(pending.turnPhase).toBe('season-resolution');
        expect(getFortificationMaintenanceSelection(pending)?.title).toBe('新年防线维护');
        expect(pending.selectedRegionId).toBe('song-jin');
    });

it('阿敏在场时后金控制的朝鲜区域会在新年朝贡时每区额外多抽 1 张朝鲜牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 6,
            },
            jin: {
                ...core.factions.jin,
                handCount: 0,
                characters: core.factions.jin.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'jin-amin',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'xian-xing') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                };
            }
            if (region.id === 'city-region-18' || region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                };
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    troops: 3,
                    population: 1,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(settled.koreaDeckCount).toBe(core.koreaDeckCount - 2);
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('后金 因朝鲜朝贡获得 2 张朝鲜牌');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).not.toContain('大明 因朝鲜朝贡获得');
    });

it('新年会对围城区域的攻方执行围城耗损', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                vp: 2,
                handCount: 12,
            },
            jin: {
                ...core.factions.jin,
                handCount: 1,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 4,
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-28',
                    },
                };
            }
            return {
                ...region,
                population: region.troops,
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(settled.regions.find((region) => region.id === 'city-region-25')?.siegeState).toMatchObject({
            attackerFactionId: 'jin',
            attackerTroops: 1,
        });
        expect(settled.factions.jin.handCount).toBe(0);
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('后金 在 山海关 触发围城耗损');
    });

it('新年围城耗损会同步扣减 siegeState.attackerSpecialTroops', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                vp: 2,
                handCount: 12,
            },
            jin: {
                ...core.factions.jin,
                handCount: 1,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 4,
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [
                            {
                                id: 'jin-siege-cavalry-lv2',
                                label: '后金骑兵',
                                faction: 'jin',
                                troopKind: 'cavalry',
                                count: 1,
                                level: 2,
                            },
                            {
                                id: 'jin-siege-infantry-lv1',
                                label: '后金步兵',
                                faction: 'jin',
                                troopKind: 'infantry',
                                count: 1,
                                level: 1,
                            },
                        ],
                        sourceRegionId: 'city-region-28',
                    },
                };
            }
            return {
                ...region,
                population: region.troops,
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'auto-pay' },
        });

        const siegeState = settled.regions.find((region) => region.id === 'city-region-25')?.siegeState;
        const remainingSiegePieceIds = siegeState?.attackerSpecialTroops[0]?.pieceIds ?? [];
        expect(siegeState).toMatchObject({
            attackerFactionId: 'jin',
            attackerTroops: 1,
            attackerSpecialTroops: [
                {
                    id: 'jin-siege-cavalry-lv2',
                    label: '后金骑兵',
                    faction: 'jin',
                    troopKind: 'cavalry',
                    count: 1,
                    level: 2,
                },
            ],
        });
        expect(remainingSiegePieceIds).toHaveLength(1);
        expect(
            settled.pieces
                .filter((piece) => piece.regionId === 'city-region-25' && piece.location === 'siege-attacker')
                .map((piece) => piece.id),
        ).toEqual(remainingSiegePieceIds);
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('移除：后金步兵 x1');
    });

it('新年会对围城城市的城内守军按 cityState 人口执行耗损', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 8,
            },
            jin: {
                ...core.factions.jin,
                handCount: 0,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
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
                        attackerTroops: 1,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-24',
                    },
                    cityState: {
                        troops: 3,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'jin-city-infantry-lv1',
                                label: '后金步兵',
                                faction: 'jin',
                                troopKind: 'infantry',
                                count: 3,
                                level: 1,
                            },
                        ],
                    },
                };
            }
            return {
                ...region,
                population: region.troops,
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(settled.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            siegeState: expect.objectContaining({
                attackerFactionId: 'ming',
                attackerTroops: 1,
            }),
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [
                    {
                        id: 'jin-city-infantry-lv1',
                        label: '后金步兵',
                        faction: 'jin',
                        troopKind: 'infantry',
                        count: 2,
                        level: 1,
                    },
                ],
            },
        });
        const cityPieceIds = settled.regions.find((region) => region.id === 'city-region-25')
            ?.cityState?.specialTroops.flatMap((stack) => stack.pieceIds ?? []) ?? [];
        expect(cityPieceIds).toHaveLength(2);
        expect(
            settled.pieces
                .filter((piece) => piece.regionId === 'city-region-25' && piece.location === 'city')
                .map((piece) => piece.id),
        ).toEqual(cityPieceIds);
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('后金 在 山海关 触发守城耗损');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('移除：后金步兵 x1');
    });

it('新年会对非围城城市保留在 cityState 的城内守军执行耗损', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            jin: {
                ...core.factions.jin,
                handCount: 0,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: null,
                    cityState: {
                        troops: 3,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'jin-city-infantry-lv1',
                                label: '后金步兵',
                                faction: 'jin',
                                troopKind: 'infantry',
                                count: 3,
                                level: 1,
                            },
                        ],
                    },
                };
            }
            return {
                ...region,
                population: region.troops,
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(settled.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            siegeState: null,
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [
                    {
                        id: 'jin-city-infantry-lv1',
                        label: '后金步兵',
                        faction: 'jin',
                        troopKind: 'infantry',
                        count: 2,
                        level: 1,
                    },
                ],
            },
        });
        const cityPieceIds = settled.regions.find((region) => region.id === 'city-region-25')
            ?.cityState?.specialTroops.flatMap((stack) => stack.pieceIds ?? []) ?? [];
        expect(cityPieceIds).toHaveLength(2);
        expect(
            settled.pieces
                .filter((piece) => piece.regionId === 'city-region-25' && piece.location === 'city')
                .map((piece) => piece.id),
        ).toEqual(cityPieceIds);
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('后金 在 山海关 触发守城耗损');
    });

it('王化贞在场时新年围城耗损会先免费支持 1 部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 0,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-wang-huazhen',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'xian-xing' || region.id === 'city-region-18' || region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                };
            }
            if (region.id === 'city-region-19-liaoxi') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 4,
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'song-jin',
                    },
                };
            }
            return {
                ...region,
                population: region.troops,
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(settled.regions.find((region) => region.id === 'city-region-19-liaoxi')?.siegeState).toMatchObject({
            attackerFactionId: 'ming',
            attackerTroops: 1,
        });
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 因王化贞在 辽西 免费支持 1 部队');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 在 辽西 触发围城耗损，无法补足 1 点补给，围城部队减员 1');
    });

it('新年防线维护可选择放弃全部防线', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 12,
            },
        };

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(getFortificationMaintenanceSelection(pending)?.choices.map((choice) => choice.id)).toEqual(['auto-pay', 'skip-all']);
        expect(pending.selectedRegionId).toBe('song-jin');

        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(settled.currentYearIndex).toBe(1);
        expect(settled.currentPlayer).toBe('0');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-28');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-28');
        expect(settled.fortifications.every((fortification) => fortification.ruined)).toBe(true);
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明放弃维护 内长城，改为破败');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明放弃维护 锦州，改为破败');
    });

it('新年防线维护会按逻辑区依赖判断蓟镇与辽西失守', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 12,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-19-liaoxi' || region.id === 'city-region-28-jizhen') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'auto-pay' },
        });

        expect(pending.selectedRegionId).toBe('song-jin');
        expect(settled.fortifications.find((fortification) => fortification.id === 'shanhaiguan')?.ruined).toBe(true);
        expect(settled.fortifications.find((fortification) => fortification.id === 'ningyuan')?.ruined).toBe(true);
        expect(settled.fortifications.find((fortification) => fortification.id === 'jinzhou')?.ruined).toBe(true);
        expect(settled.currentPlayer).toBe('0');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-15');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-15');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明失去 蓟镇，山海关 本轮无法修缮，改为破败');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明失去 辽西，宁远 本轮无法修缮，改为破败');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明失去 辽西，锦州 本轮无法修缮，改为破败');
    });

it('新年会按有效威望与当年顺位结算本年纪年卡归属并支付半数手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.playerIds = ['2', '1', '0'];
        core.currentPlayer = '2';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                playerId: '0',
                vp: 1,
                handCount: 4,
            },
            mongol: {
                ...core.factions.mongol,
                playerId: '1',
                vp: 1,
                handCount: 3,
            },
            jin: {
                ...core.factions.jin,
                playerId: '2',
                vp: 1,
                handCount: 5,
            },
        };

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '2',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'auto-pay' },
        });

        expect(settled.factions.ming.vp).toBe(2);
        expect(settled.factions.mongol.vp).toBe(1);
        expect(settled.factions.jin.vp).toBe(1);
        expect(settled.factions.ming.handCount).toBeLessThanOrEqual(2);
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 以');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('获得本年纪年卡，威望 +1');
    });

it('首次新年结算后会按新纪年顺位重置到本年先手势力', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.currentYearIndex = 1;
        core.currentYear = '天命五年 1620';
        core.currentFactionOrder = ['ming', 'mongol', 'jin'];
        core.currentPlayer = '0';
        core.factionActionUsed = true;
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 12,
            },
            mongol: {
                ...core.factions.mongol,
                handCount: 8,
            },
            jin: {
                ...core.factions.jin,
                handCount: 8,
            },
        };

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(pending.selectedRegionId).toBe('song-jin');
        expect(settled.currentYearIndex).toBe(2);
        expect(settled.currentYear).toBe('天命六年 1621');
        expect(settled.currentFactionOrder).toEqual(['mongol', 'jin', 'ming']);
        expect(settled.currentPlayer).toBe('1');
        expect(settled.roundNumber).toBe(2);
        expect(settled.turnPhase).toBe('action-window');
        expect(settled.factionActionUsed).toBe(false);
        expect(settled.wheelActionUsed).toBe(false);
        expect(settled.turnLabel).toContain('蒙古');
        expect(settled.selectedRegionId).toBe('city-region-14');
        expect(settled.actionChoices.map((action) => action.label)).toEqual([
            '突袭作战',
            '马市贸易',
            '大汗令箭',
        ]);
        expect(settled.factions.ming.characters.filter((character) => character.inPlay).map((character) => character.name)).toEqual([]);
        expect(settled.factions.mongol.characters.filter((character) => character.inPlay).map((character) => character.name)).toEqual([
            '林丹·乎图克图',
            '绰克图台吉',
        ]);
        expect(settled.factions.jin.characters.filter((character) => character.inPlay).map((character) => character.name)).toEqual([
            '努尔哈赤',
            '额亦都',
            '代善',
        ]);
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 本年人物：无新增出场');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('蒙古 本年人物：台吉中择一；当前启用 绰克图台吉');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('后金 本年人物：任意人物牌；当前启用 代善');
    });

it('纪年卡代表人物候选会跳过已在场人物并启用下一位', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.currentYearIndex = 1;
        core.currentYear = '天命五年 1620';
        core.currentFactionOrder = ['ming', 'mongol', 'jin'];
        core.currentPlayer = '0';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 12,
            },
            mongol: {
                ...core.factions.mongol,
                handCount: 8,
            },
            jin: {
                ...core.factions.jin,
                handCount: 8,
                characters: core.factions.jin.characters.map((character) => (
                    character.id === 'jin-daisan'
                        ? { ...character, inPlay: true }
                        : character
                )),
            },
        };

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(pending.selectedRegionId).toBe('song-jin');
        expect(settled.currentPlayer).toBe('0');
        expect(settled.turnPhase).toBe('action-window');
        expect(settled.selectedRegionId).toBe('song-jin');
        expect(settled.factions.jin.characters.filter((character) => character.inPlay).map((character) => character.name)).toEqual([
            '努尔哈赤',
            '额亦都',
            '代善',
            '阿敏',
        ]);
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('后金 本年人物：任意人物牌；当前启用 阿敏');
    });

it('新年兵力耗损会同步扣除结构化部队栈', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 0,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'xian-xing' || region.id === 'city-region-18' || region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                };
            }
            if (region.id !== 'song-jin') {
                return region;
            }
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 4,
                population: 1,
                specialTroops: [
                    { id: 'ming-songjin-infantry-lv4', label: '大明精锐步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 4 },
                    { id: 'ming-songjin-infantry-lv1', label: '大明低级步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
                ],
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        expect(pending.actionWheelPosition).toBe('wheel-new-year');
        expect(getFortificationMaintenanceSelection(pending)?.title).toBe('新年防线维护');
        expect(pending.selectedRegionId).toBe('song-jin');

        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        const songjin = settled.regions.find((region) => region.id === 'song-jin');
        const remainingSongjinPieceIds = songjin?.specialTroops[0]?.pieceIds ?? [];
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-28');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-28');
        expect(songjin?.troops).toBe(1);
        expect(songjin?.specialTroops).toHaveLength(1);
        expect(songjin?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'ming-songjin-infantry-lv4', label: '大明精锐步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 4 }),
        ]));
        expect(remainingSongjinPieceIds).toHaveLength(1);
        expect(
            settled.pieces
                .filter((piece) => piece.regionId === 'song-jin' && piece.location === 'field')
                .map((piece) => piece.id),
        ).toEqual(remainingSongjinPieceIds);
        expect(songjin?.note).toContain('兵力耗损损失 3 部队');
        expect(songjin?.note).toContain('低级先损');
        expect(songjin?.note).toContain('移除：大明低级步兵 x2、大明精锐步兵 x1');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 在 皮岛 触发兵力耗损，无法补足 3 点补给，部队减员 3（低级先损）（移除：大明低级步兵 x2、大明精锐步兵 x1）');
    });

it('王化贞在场时新年兵力耗损会先为每个区域免费支持 1 部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 0,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-wang-huazhen',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'xian-xing' || region.id === 'city-region-18' || region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                };
            }
            if (region.id !== 'song-jin') {
                return region;
            }
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 4,
                population: 1,
                specialTroops: [
                    { id: 'ming-songjin-infantry-lv4', label: '大明精锐步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 4 },
                    { id: 'ming-songjin-infantry-lv1', label: '大明低级步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
                ],
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        const songjin = settled.regions.find((region) => region.id === 'song-jin');
        expect(pending.selectedRegionId).toBe('song-jin');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-28');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-28');
        expect(songjin?.troops).toBe(2);
        expect(songjin?.specialTroops).toHaveLength(1);
        expect(songjin?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'ming-songjin-infantry-lv4', label: '大明精锐步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 4 }),
        ]));
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 因王化贞在 皮岛 免费支持 1 部队');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 在 皮岛 触发兵力耗损，无法补足 2 点补给，部队减员 2（低级先损）（移除：大明低级步兵 x2）');
    });

it('新年兵力耗损可选择高级先损并保留低级部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 0,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'xian-xing' || region.id === 'city-region-18' || region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                };
            }
            if (region.id !== 'song-jin') {
                return region;
            }
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 4,
                population: 1,
                specialTroops: [
                    { id: 'ming-songjin-infantry-lv4', label: '大明精锐步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 4 },
                    { id: 'ming-songjin-infantry-lv1', label: '大明低级步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
                ],
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all', attritionPriority: 'highest-level' },
        });

        const songjin = settled.regions.find((region) => region.id === 'song-jin');
        expect(pending.selectedRegionId).toBe('song-jin');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-28');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-28');
        expect(songjin?.troops).toBe(1);
        expect(songjin?.specialTroops).toHaveLength(1);
        expect(songjin?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'ming-songjin-infantry-lv2', label: '大明低级步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 2 }),
        ]));
        expect(songjin?.note).toContain('高级先损');
        expect(songjin?.note).toContain('移除：大明精锐步兵 x2、大明低级步兵 x1');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 在 皮岛 触发兵力耗损，无法补足 3 点补给，部队减员 3（高级先损）（移除：大明精锐步兵 x2、大明低级步兵 x1）');
    });

it('旱灾标记区域在新年补给耗损中人口视为 0', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 0,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'xian-xing' || region.id === 'city-region-18' || region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                };
            }
            if (region.id !== 'song-jin') {
                return region;
            }
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 2,
                population: 4,
                eventMarkers: [{
                    id: 'drought-marker-song-jin',
                    kind: 'drought',
                    label: '旱灾标记',
                    sourceCardDefId: 'qidahen-atlas05-1608-mongol-drought',
                    imageSrc: 'qidahen/markers/drought-marker',
                }],
                specialTroops: [
                    { id: 'ming-songjin-infantry-lv1-a', label: '大明低级步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                    { id: 'ming-songjin-infantry-lv1-b', label: '大明低级步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                ],
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        const songjin = settled.regions.find((region) => region.id === 'song-jin');
        expect(songjin?.population).toBe(4);
        expect(songjin?.troops).toBe(0);
        expect(songjin?.specialTroops).toEqual([]);
        expect(songjin?.eventMarkers).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'drought-marker-song-jin', kind: 'drought' }),
        ]));
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 在 皮岛 触发兵力耗损，无法补足 2 点补给，部队减员 2');
    });

it('新年会对朝鲜区域执行仅手牌支付的耗损', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 0,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id !== 'city-region-29') {
                return region;
            }
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 2,
                population: 6,
                specialTroops: [
                    { id: 'ming-hanseong-mercenary-lv2', label: '朝鲜雇佣军', faction: 'ming', troopKind: 'infantry', count: 2, level: 2 },
                ],
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        const hanseong = settled.regions.find((region) => region.id === 'city-region-29');
        expect(pending.selectedRegionId).toBe('song-jin');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-29');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-29');
        expect(hanseong?.troops).toBe(0);
        expect(hanseong?.specialTroops).toEqual([]);
        expect(hanseong?.note).toContain('朝鲜耗损');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 在 汉城 触发朝鲜耗损，无法补足 2 点补给，部队减员 2');
    });

it('毛文龙在场时大明位于朝鲜的部队不会触发新年朝鲜耗损', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 0,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-mao-wenlong',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id !== 'city-region-29') {
                return region;
            }
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 2,
                population: 6,
                specialTroops: [
                    { id: 'ming-hanseong-mercenary-lv2', label: '朝鲜雇佣军', faction: 'ming', troopKind: 'infantry', count: 2, level: 2 },
                ],
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        const hanseong = settled.regions.find((region) => region.id === 'city-region-29');
        expect(pending.selectedRegionId).toBe('song-jin');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-29');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-29');
        expect(hanseong?.troops).toBe(2);
        expect(hanseong?.specialTroops).toHaveLength(1);
        expect(hanseong?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ label: '朝鲜雇佣军', faction: 'ming', troopKind: 'infantry', count: 2, level: 2 }),
        ]));
        expect(hanseong?.note).not.toContain('朝鲜耗损');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).not.toContain('大明 在 汉城 触发朝鲜耗损');
    });

it('新年会对友好标记中立区执行中立耗损，不吃当地人口补给', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 0,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id !== 'city-region-27') {
                return region;
            }
            return {
                ...region,
                controller: 'neutral',
                diplomacyMarkerFaction: 'ming',
                diplomacyMarkerSide: 'friendly',
                controlLabel: '大明友好',
                troops: 2,
                population: 5,
                specialTroops: [
                    { id: 'ming-shuntian-regular-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 2 },
                ],
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        const baoding = settled.regions.find((region) => region.id === 'city-region-27');
        expect(pending.selectedRegionId).toBe('song-jin');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-28');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-28');
        expect(baoding?.troops).toBe(0);
        expect(baoding?.specialTroops).toEqual([]);
        expect(baoding?.note).toContain('中立耗损');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 在 保定 触发中立耗损，无法补足 2 点补给，部队减员 2');
    });

it('新年大漠耗损只禁止大明正规军吃补给，雇佣军仍可使用当地人口', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 0,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id !== 'city-region-20') {
                return region;
            }
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 3,
                population: 1,
                specialTroops: [
                    { id: 'ming-tumote-regular-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 2 },
                    { id: 'ming-tumote-mercenary-cavalry-lv2', label: '大明雇佣骑兵', faction: 'ming', troopKind: 'cavalry', count: 1, level: 2 },
                ],
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        const tumote = settled.regions.find((region) => region.id === 'city-region-20');
        expect(pending.selectedRegionId).toBe('song-jin');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-28');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-28');
        expect(tumote?.troops).toBe(1);
        expect(tumote?.specialTroops).toHaveLength(1);
        expect(tumote?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'ming-tumote-mercenary-cavalry-lv2', label: '大明雇佣骑兵', faction: 'ming', troopKind: 'cavalry', count: 1, level: 2 }),
        ]));
        expect(tumote?.note).toContain('大漠耗损');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 在 土默特部 触发大漠耗损，无法补足 2 点补给，部队减员 2');
    });
});
