import { describe, expect, it } from 'vitest';import { QidahenDomain } from '../domain';

import { QIDAHEN_COMMANDS } from '../domain/commands';
import { getActionChoicesForFaction } from '../domain/factionActionWindow';import { random, lindanInfluenceRegionIds, apply, getDiplomacySelection, getInternalDispatchSelection, factionHandCards, keepOnlyMingHomelandFallback } from './helpers/paymentSelectionHarness';

describe('七大恨人物窗口效果', () => {
it('齐赛诺延在场时会把奈曼部视为蒙古无标记本土，不能再对其执行外交', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-1';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-qisai-noyan',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14' || region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: region.id === 'city-region-14' ? 2 : 0,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        expect(selecting.turnPhase).toBe('khan-edict-choice');
        expect(selecting.selectedRegionId).toBe('city-region-1');
        const chooseDiplomacy = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });
        expect(chooseDiplomacy.turnPhase).toBe('diplomacy-choice');
        expect(chooseDiplomacy.selectedRegionId).toBe('city-region-1');
        const targeted = apply(chooseDiplomacy, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-17' },
        });

        expect(targeted.turnPhase).toBe('diplomacy-choice');
        expect(targeted.selectedRegionId).toBe('city-region-1');
        expect(targeted.explicitRegionId).toBe('city-region-17');
        expect(getDiplomacySelection(targeted)?.sourceRegionId).toBe('city-region-17');
        expect(getDiplomacySelection(targeted)?.targetRegionId).toBeNull();
        expect(getDiplomacySelection(targeted)?.targetHint).toContain('邻近 奈曼部 的区域可执行外交');
        expect(getDiplomacySelection(targeted)?.choices.map((choice) => choice.id)).toEqual(['hire-only']);
    });

it('齐赛诺延在场时移除奈曼部控制标记后会回归蒙古本土', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-1';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-qisai-noyan',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金友好',
                    troops: 0,
                    diplomacyMarkerFaction: 'jin',
                    diplomacyMarkerSide: 'friendly',
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        expect(selecting.turnPhase).toBe('khan-edict-choice');
        expect(selecting.selectedRegionId).toBe('city-region-1');
        const chooseDiplomacy = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });
        expect(chooseDiplomacy.turnPhase).toBe('diplomacy-choice');
        expect(chooseDiplomacy.selectedRegionId).toBe('city-region-1');
        const targeted = apply(chooseDiplomacy, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-17' },
        });

        expect(targeted.turnPhase).toBe('diplomacy-choice');
        expect(targeted.selectedRegionId).toBe('city-region-1');
        expect(targeted.explicitRegionId).toBe('city-region-17');
        expect(getDiplomacySelection(targeted)?.choices.map((choice) => choice.id)).toContain('remove-marker');

        const resolved = apply(targeted, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'remove-marker' },
        });

        expect(resolved.turnPhase).toBe('diplomacy-choice');
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.explicitRegionId).toBe('city-region-17');
        expect(getDiplomacySelection(resolved)?.sourceRegionId).toBe('city-region-17');
        expect(getDiplomacySelection(resolved)?.targetRegionId).toBeNull();
        expect(resolved.regions.find((region) => region.id === 'city-region-17')).toMatchObject({
            controller: 'mongol',
            diplomacyMarkerFaction: null,
            diplomacyMarkerSide: null,
            controlLabel: '蒙古',
        });
        expect(resolved.diplomacyProgress?.resolvedSteps.at(-1)?.summary).toContain('回归 蒙古本土');
    });

it('衮楚克图吉在场时会把敖汉部视为蒙古无标记本土，不能再对其执行外交', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-17';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-gunchu-ketuji',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-17' || region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: region.id === 'city-region-17' ? 2 : 0,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        expect(selecting.turnPhase).toBe('khan-edict-choice');
        expect(selecting.selectedRegionId).toBe('city-region-17');
        const chooseDiplomacy = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });
        expect(chooseDiplomacy.turnPhase).toBe('diplomacy-choice');
        expect(chooseDiplomacy.selectedRegionId).toBe('city-region-17');
        const targeted = apply(chooseDiplomacy, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-19' },
        });

        expect(targeted.turnPhase).toBe('diplomacy-choice');
        expect(targeted.selectedRegionId).toBe('city-region-17');
        expect(targeted.explicitRegionId).toBe('city-region-19');
        expect(getDiplomacySelection(targeted)?.sourceRegionId).toBe('city-region-19');
        expect(getDiplomacySelection(targeted)?.targetRegionId).toBeNull();
        expect(getDiplomacySelection(targeted)?.targetHint).toContain('邻近 敖汉部 的区域可执行外交');
        expect(getDiplomacySelection(targeted)?.choices.map((choice) => choice.id)).toEqual(['hire-only']);
    });

it('衮楚克图吉在场时，战后劫掠自己牌堆会每人口额外多摸 1 张手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-gunchu-ketuji',
                })),
            },
        };
        core.postBattleSelection = {
            actionId: 'raid',
            attackerFactionId: 'mongol',
            sourceRegionId: 'city-region-17',
            sourceRegionName: '奈曼部',
            targetRegionId: 'city-region-19',
            targetRegionName: '敖汉部',
            targetRuntimeRegionId: 'city-region-19',
            committedTroops: 3,
            survivingTroops: 2,
            attackerLosses: 1,
            movementProfileId: null,
            attackerCasualtyPriority: 'highest-level',
            originalController: 'jin',
            originalControlLabel: '后金',
            title: '战后处理',
            summary: '测试',
            choices: [
                {
                    id: 'occupy-plunder-2',
                    mode: 'occupy',
                    regionId: 'city-region-19',
                    plunderPopulation: 2,
                    plunderSource: 'attacker',
                    label: '测试',
                    detail: '测试',
                },
            ],
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'mongol-cavalry-lv2',
                            label: '蒙古骑兵',
                            faction: 'mongol',
                            troopKind: 'cavalry',
                            count: 3,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '1',
            payload: { choiceId: 'occupy-plunder-2' },
        });

        expect(resolved.factions.mongol.handCount).toBe(core.factions.mongol.handCount + 4);
        expect(resolved.factions.mongol.discardPileCount).toBe(core.factions.mongol.discardPileCount);
        expect(resolved.factions.mongol.drawPileCount).toBe(core.factions.mongol.drawPileCount - 4);
        expect(resolved.actionLog[0]?.text).toContain('获得 4 张手牌');
    });

it('衮楚克图吉在场时，骑兵劫掠自己牌堆会每人口额外多摸 1 张手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'wheel-dispatch',
            title: '调骑 4 待结算',
            attackerFactionId: 'mongol',
            sourceRegionId: 'city-region-17',
            sourceRegionName: '奈曼部',
            targetRegionId: 'city-region-19',
            targetRegionName: '敖汉部',
            targetRuntimeRegionId: 'city-region-19',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 3,
            committedTroops: 3,
            movementProfileId: 'dispatch-cavalry',
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-gunchu-ketuji',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'mongol-cavalry-lv2',
                            label: '蒙古骑兵',
                            faction: 'mongol',
                            troopKind: 'cavalry',
                            count: 3,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 3,
                    specialTroops: [
                        {
                            id: 'jin-cavalry-lv2',
                            label: '后金骑兵',
                            faction: 'jin',
                            troopKind: 'cavalry',
                            count: 1,
                            level: 2,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '1',
            payload: { attackerCavalryPlunder: true },
        });

        expect(resolved.factions.mongol.handCount).toBe(core.factions.mongol.handCount + 4);
        expect(resolved.factions.mongol.discardPileCount).toBe(core.factions.mongol.discardPileCount);
        expect(resolved.factions.mongol.drawPileCount).toBe(core.factions.mongol.drawPileCount - 4);
        expect(resolved.actionLog[0]?.text).toContain('获得 4 张手牌');
    });

it('绰克图台吉在场时会把外喀尔喀部视为蒙古无标记本土，不能再对其执行外交', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-1';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-choghtu-taiji',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-1' || region.id === 'city-region-2') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: region.id === 'city-region-1' ? 2 : 0,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        expect(selecting.turnPhase).toBe('khan-edict-choice');
        expect(selecting.selectedRegionId).toBe('city-region-1');
        const chooseDiplomacy = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });
        expect(chooseDiplomacy.turnPhase).toBe('diplomacy-choice');
        expect(chooseDiplomacy.selectedRegionId).toBe('city-region-1');
        const targeted = apply(chooseDiplomacy, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-2' },
        });

        expect(targeted.turnPhase).toBe('diplomacy-choice');
        expect(targeted.selectedRegionId).toBe('city-region-1');
        expect(targeted.explicitRegionId).toBe('city-region-2');
        expect(getDiplomacySelection(targeted)?.sourceRegionId).toBe('city-region-2');
        expect(getDiplomacySelection(targeted)?.targetRegionId).toBeNull();
        expect(getDiplomacySelection(targeted)?.targetHint).toContain('邻近 外喀尔喀部 的区域可执行外交');
        expect(getDiplomacySelection(targeted)?.choices.map((choice) => choice.id)).toEqual(['hire-only']);
    });

it('林丹·乎图克图在场时会把巴林部视为蒙古无标记本土，不能再对其执行外交', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-1';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-lindan-hutuktu',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-1' || region.id === 'city-region-8') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: region.id === 'city-region-1' ? 2 : 0,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (lindanInfluenceRegionIds.has(region.id) && region.id !== 'city-region-8' && region.id !== 'city-region-14') {
                return {
                    ...region,
                    troops: Math.max(1, region.troops),
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        expect(selecting.turnPhase).toBe('khan-edict-choice');
        expect(selecting.selectedRegionId).toBe('city-region-1');
        const chooseDiplomacy = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });
        expect(chooseDiplomacy.turnPhase).toBe('diplomacy-choice');
        expect(chooseDiplomacy.selectedRegionId).toBe('city-region-1');
        const targeted = apply(chooseDiplomacy, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-8' },
        });

        expect(targeted.turnPhase).toBe('diplomacy-choice');
        expect(targeted.selectedRegionId).toBe('city-region-1');
        expect(targeted.explicitRegionId).toBe('city-region-8');
        expect(getDiplomacySelection(targeted)?.sourceRegionId).toBe('city-region-8');
        expect(getDiplomacySelection(targeted)?.targetRegionId).toBeNull();
        expect(getDiplomacySelection(targeted)?.targetHint).toContain('邻近 巴林部 的区域可执行外交');
        expect(getDiplomacySelection(targeted)?.choices.map((choice) => choice.id)).toEqual(['hire-only']);
    });

it('林丹·乎图克图在场时会在新的蒙古行动窗口前向蒙古区域放置 1 步影响力，且同一窗口不重复触发', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.selectedRegionId = 'city-region-14';
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-lindan-hutuktu',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 3,
                };
            }
            if (region.id === 'city-region-8') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (lindanInfluenceRegionIds.has(region.id) && region.id !== 'city-region-8' && region.id !== 'city-region-14') {
                return {
                    ...region,
                    troops: Math.max(1, region.troops),
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-14' },
        });
        expect(firstWindow.turnPhase).toBe('action-window');
        expect(firstWindow.selectedRegionId).toBe('city-region-8');
        expect(firstWindow.regions.find((region) => region.id === 'city-region-8')).toMatchObject({
            diplomacyMarkerFaction: 'mongol',
            diplomacyMarkerSide: 'friendly',
            controlLabel: '蒙古友好',
        });
        expect(firstWindow.mapTokens.find((token) => token.id === 'diplomacy-marker-city-region-8')).toMatchObject({
            faction: 'mongol',
            imageSrc: 'qidahen/markers/mongol-control-diplomacy-marker-b',
        });

        const sameWindow = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-25' },
        });
        expect(sameWindow.turnPhase).toBe('action-window');
        expect(sameWindow.selectedRegionId).toBe('city-region-25');
        expect(sameWindow.regions.find((region) => region.id === 'city-region-8')).toMatchObject({
            diplomacyMarkerFaction: 'mongol',
            diplomacyMarkerSide: 'friendly',
            controlLabel: '蒙古友好',
        });

        const secondWindow = apply({
            ...sameWindow,
            wheelActionUsed: true,
            factionActionUsed: false,
        }, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-14' },
        });
        expect(secondWindow.turnPhase).toBe('action-window');
        expect(secondWindow.selectedRegionId).toBe('city-region-8');
        expect(secondWindow.regions.find((region) => region.id === 'city-region-8')).toMatchObject({
            controller: 'mongol',
            diplomacyMarkerFaction: 'mongol',
            diplomacyMarkerSide: 'vassal',
            controlLabel: '蒙古附庸',
        });
        expect(secondWindow.actionLog[0]?.text).toContain('林丹·乎图克图');
    });

it('林丹·乎图克图当前选中逻辑区辽西时，会优先向对应的真实运行时区域放置影响力', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.selectedRegionId = 'liao-xi';
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-lindan-hutuktu',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 3,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.id === 'city-region-19-liaoxi') {
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
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-14' },
        });

        expect(firstWindow.regions.find((region) => region.id === 'city-region-19-liaoxi')).toMatchObject({
            diplomacyMarkerFaction: 'mongol',
            diplomacyMarkerSide: 'friendly',
            controlLabel: '蒙古友好',
        });
        expect(firstWindow.selectedRegionId).toBe('city-region-19-liaoxi');
        expect(firstWindow.actionLog[0]?.text).toContain('辽西');
    });

it('毛文龙在场时会在新的大明行动窗口前免费训练东江部队，且同一窗口不重复触发', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-22';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: [{ id: 'artillery-tech', name: '火炮技术', level: 2 }],
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-mao-wenlong',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion || region.id !== 'city-region-22') {
                return region;
            }
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 3,
                specialTroops: [
                    { id: 'ming-dongjiang-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 2, pieceIds: ['ming-dongjiang-piece-1'] },
                    { id: 'ming-dongjiang-cavalry-lv3', label: '大明骑兵', faction: 'ming', troopKind: 'cavalry', count: 1, level: 3, pieceIds: ['ming-dongjiang-piece-2'] },
                    { id: 'ming-dongjiang-artillery-lv1', label: '大明炮兵', faction: 'ming', troopKind: 'artillery', count: 1, level: 1, pieceIds: ['ming-dongjiang-piece-3'] },
                ],
            };
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-22' },
        });
        expect(firstWindow.turnPhase).toBe('action-window');
        expect(firstWindow.selectedRegionId).toBe('city-region-22');
        const dongjiang = firstWindow.regions.find((region) => region.id === 'city-region-22');
        expect(dongjiang).toMatchObject({
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ id: 'ming-dongjiang-infantry-lv3', troopKind: 'infantry', count: 1, level: 3, pieceIds: ['ming-dongjiang-piece-1'] }),
                expect.objectContaining({ id: 'ming-dongjiang-cavalry-lv4', troopKind: 'cavalry', count: 1, level: 4, pieceIds: ['ming-dongjiang-piece-2'] }),
                expect.objectContaining({ id: 'ming-dongjiang-artillery-lv2', troopKind: 'artillery', count: 1, level: 2, pieceIds: ['ming-dongjiang-piece-3'] }),
            ]),
        });
        expect(
            firstWindow.pieces
                .filter((piece) => piece.regionId === 'city-region-22' && piece.location === 'field')
                .map((piece) => piece.id),
        ).toEqual(['ming-dongjiang-piece-1', 'ming-dongjiang-piece-2', 'ming-dongjiang-piece-3']);
        expect(firstWindow.actionLog[0]?.text).toContain('毛文龙在东江免费训练 3 个部队');

        const sameWindow = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        });
        expect(sameWindow.turnPhase).toBe('action-window');
        expect(sameWindow.selectedRegionId).toBe('song-jin');
        expect(sameWindow.regions.find((region) => region.id === 'city-region-22')?.specialTroops).toEqual(
            firstWindow.regions.find((region) => region.id === 'city-region-22')?.specialTroops,
        );
    });

it('熊廷弼免费训练对结构化同栈只升级前 4 个棋子并保留 pieceIds', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'song-jin';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: [{ id: 'artillery-tech', name: '火炮技术', level: 2 }],
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-xiong-tingbi',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'ming-songjin-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 5,
                            level: 2,
                            pieceIds: [
                                'ming-songjin-piece-1',
                                'ming-songjin-piece-2',
                                'ming-songjin-piece-3',
                                'ming-songjin-piece-4',
                                'ming-songjin-piece-5',
                            ],
                        },
                    ],
                };
            }
            if (region.controller === 'ming') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    siegeState: null,
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        });

        const songjin = firstWindow.regions.find((region) => region.id === 'song-jin');
        expect(firstWindow.selectedRegionId).toBe('song-jin');
        expect(songjin?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'ming-songjin-infantry-lv3',
                troopKind: 'infantry',
                count: 4,
                level: 3,
                pieceIds: [
                    'ming-songjin-piece-1',
                    'ming-songjin-piece-2',
                    'ming-songjin-piece-3',
                    'ming-songjin-piece-4',
                ],
            }),
            expect.objectContaining({
                id: 'ming-songjin-infantry-lv2',
                troopKind: 'infantry',
                count: 1,
                level: 2,
                pieceIds: ['ming-songjin-piece-5'],
            }),
        ]));
        expect(
            firstWindow.pieces
                .filter((piece) => piece.regionId === 'song-jin' && piece.location === 'field' && piece.level === 3)
                .map((piece) => piece.id),
        ).toEqual([
            'ming-songjin-piece-1',
            'ming-songjin-piece-2',
            'ming-songjin-piece-3',
            'ming-songjin-piece-4',
        ]);
        expect(firstWindow.pieces.find((piece) => piece.id === 'ming-songjin-piece-5')).toMatchObject({
            sourceStackId: 'ming-songjin-infantry-lv2',
            regionId: 'song-jin',
            location: 'field',
            level: 2,
        });
        expect(firstWindow.actionLog[0]?.text).toContain('熊廷弼在行动前免费训练 4 个部队');
        expect(firstWindow.actionLog[0]?.text).toContain('皮岛：大明步兵 x4 升至 3 级');
    });

it('毛文龙免费训练会先并回东江的非围城 cityState 特殊部队再训练', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-22';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: [{ id: 'artillery-tech', name: '火炮技术', level: 2 }],
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-mao-wenlong',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion || region.id !== 'city-region-22') {
                return region;
            }
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 0,
                population: 0,
                specialTroops: [],
                cityState: {
                    troops: 2,
                    population: 2,
                    specialTroops: [
                        { id: 'ming-dongjiang-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 2 },
                        { id: 'ming-dongjiang-artillery-lv1', label: '大明炮兵', faction: 'ming', troopKind: 'artillery', count: 1, level: 1 },
                    ],
                },
            };
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-22' },
        });

        expect(firstWindow.regions.find((region) => region.id === 'city-region-22')).toMatchObject({
            troops: 2,
            population: 2,
            cityState: null,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ id: 'ming-dongjiang-infantry-lv3', troopKind: 'infantry', count: 1, level: 3 }),
                expect.objectContaining({ id: 'ming-dongjiang-artillery-lv2', troopKind: 'artillery', count: 1, level: 2 }),
            ]),
        });
        expect(firstWindow.actionLog[0]?.text).toContain('毛文龙在东江免费训练 2 个部队');
    });

it('毛文龙在新行动窗口触发免费训练时，会把 selectedRegionId 保持在真实训练区东江', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-22';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: [{ id: 'artillery-tech', name: '火炮技术', level: 2 }],
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-mao-wenlong',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [
                        { id: 'ming-dongjiang-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 2 },
                        { id: 'ming-dongjiang-cavalry-lv3', label: '大明骑兵', faction: 'ming', troopKind: 'cavalry', count: 1, level: 3 },
                        { id: 'ming-dongjiang-artillery-lv1', label: '大明炮兵', faction: 'ming', troopKind: 'artillery', count: 1, level: 1 },
                    ],
                };
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        });

        expect(firstWindow.selectedRegionId).toBe('city-region-22');
        expect(firstWindow.actionLog[0]?.text).toContain('毛文龙在东江免费训练 3 个部队');
    });

it('孙元化与袁崇焕同时在场时会先进入弃 2 牌打科技选择', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-sun-yuanhua' || character.id === 'ming-yuan-chonghuan',
                })),
            },
        };

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        });

        expect(firstWindow.turnPhase).toBe('sun-yuanhua-tech-choice');
        expect(firstWindow.selectedRegionId).toBe('city-region-25');
        expect(firstWindow.sunYuanhuaTechSelection).toMatchObject({
            source: 'sun-yuanhua',
            requiredCardCount: 2,
        });
        expect(firstWindow.sunYuanhuaTechSelection?.candidateCardIds.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(firstWindow.actionLog[0]?.text).toContain('孙元化可在行动前弃 2 张手牌');
    });

it('孙元化确认弃 2 牌后会升级科技并扣掉手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-sun-yuanhua' || character.id === 'ming-yuan-chonghuan',
                })),
            },
        };

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        });
        const selectedCardIds = factionHandCards(selecting, 'ming').slice(0, 2).map((card) => card.id);
        expect(selectedCardIds).toHaveLength(2);

        const selectedTwice = selectedCardIds.reduce((state, cardId) => apply(state, {
            type: QIDAHEN_COMMANDS.SELECT_SUN_YUANHUA_TECH_CARD,
            playerId: '0',
            payload: { cardId },
        }), selecting);

        const resolved = apply(selectedTwice, {
            type: QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH,
            playerId: '0',
            payload: { choiceId: 'confirm' },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.sunYuanhuaTechSelection).toBeNull();
        expect(resolved.factions.ming.handCount).toBe(core.factions.ming.handCount - 2);
        expect(resolved.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount + 2);
        expect(resolved.discardPileCount).toBe(core.discardPileCount + 2);
        expect(resolved.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech')?.level).toBe(2);
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.lastSeasonSummary?.title).toBe('孙元化弃牌科技');
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('火炮技术 升至 2 级');
        expect(resolved.actionLog[0]?.text).toContain('孙元化弃 2 张手牌');
    });

it('孙元化跳过后同窗口仍会继续触发高第和王化贞', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-yuan-chonghuan' || character.id === 'ming-sun-yuanhua' || character.id === 'ming-gao-di' || character.id === 'ming-wang-huazhen',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 2,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 3, level: 1 },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 1,
                    specialTroops: [
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                    ],
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        expect(firstWindow.turnPhase).toBe('sun-yuanhua-tech-choice');
        expect(firstWindow.selectedRegionId).toBe('city-region-25');

        const afterSunSkip = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH,
            playerId: '0',
            payload: { choiceId: 'skip' },
        });
        expect(afterSunSkip.turnPhase).toBe('gao-di-dispatch-choice');
        expect(afterSunSkip.selectedRegionId).toBe('city-region-25');
        expect(afterSunSkip.gaoDiDispatchSelection).toMatchObject({
            source: 'gao-di',
            sourceRegionId: 'city-region-25',
        });
        expect(afterSunSkip.actionLog[0]?.text).toContain('高第可在行动前弃 1 张手牌；弃牌后再选择调度目标');

        const afterGaoSkip = apply(afterSunSkip, {
            type: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            playerId: '0',
            payload: { choiceId: 'skip' },
        });
        expect(afterGaoSkip.turnPhase).toBe('internal-dispatch-choice');
        expect(getInternalDispatchSelection(afterGaoSkip)).toMatchObject({
            source: 'wang-huazhen',
            sourceRegionId: 'city-region-25',
        });
    });

it('孙元化弃牌科技等待确认时点逻辑区宁远，不会把后续人物窗口来源漂离真实当前区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-yuan-chonghuan' || character.id === 'ming-sun-yuanhua' || character.id === 'ming-gao-di' || character.id === 'ming-wang-huazhen',
                })),
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
                    troops: 3,
                    population: 2,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 3, level: 1 },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 1,
                    specialTroops: [
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                    ],
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(firstWindow.turnPhase).toBe('sun-yuanhua-tech-choice');
        expect(firstWindow.selectedRegionId).toBe('city-region-25');

        const reselected = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'ning-yuan' },
        });

        expect(reselected.turnPhase).toBe('sun-yuanhua-tech-choice');
        expect(reselected.selectedRegionId).toBe('city-region-25');

        const afterSunSkip = apply(reselected, {
            type: QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH,
            playerId: '0',
            payload: { choiceId: 'skip' },
        });

        expect(afterSunSkip.turnPhase).toBe('gao-di-dispatch-choice');
        expect(afterSunSkip.selectedRegionId).toBe('city-region-25');
        expect(afterSunSkip.gaoDiDispatchSelection).toMatchObject({
            source: 'gao-di',
            sourceRegionId: 'city-region-25',
        });

        const afterGaoSkip = apply(afterSunSkip, {
            type: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            playerId: '0',
            payload: { choiceId: 'skip' },
        });

        expect(afterGaoSkip.turnPhase).toBe('internal-dispatch-choice');
        expect(afterGaoSkip.selectedRegionId).toBe('city-region-25');
        expect(getInternalDispatchSelection(afterGaoSkip)).toMatchObject({
            source: 'wang-huazhen',
            sourceRegionId: 'city-region-25',
        });
    });

it('孙元化弃牌科技等待确认时点逻辑区宁远，确认后仍会保住真实焦点并继续进入高第窗口', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-yuan-chonghuan' || character.id === 'ming-sun-yuanhua' || character.id === 'ming-gao-di' || character.id === 'ming-wang-huazhen',
                })),
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
                    troops: 3,
                    population: 2,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 3, level: 1 },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 1,
                    specialTroops: [
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                    ],
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        const reselected = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'ning-yuan' },
        });
        const selectedCardIds = factionHandCards(reselected, 'ming').slice(0, 2).map((card) => card.id);
        expect(selectedCardIds).toHaveLength(2);

        const selectedTwice = selectedCardIds.reduce((state, cardId) => apply(state, {
            type: QIDAHEN_COMMANDS.SELECT_SUN_YUANHUA_TECH_CARD,
            playerId: '0',
            payload: { cardId },
        }), reselected);

        const resolved = apply(selectedTwice, {
            type: QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH,
            playerId: '0',
            payload: { choiceId: 'confirm' },
        });

        expect(resolved.turnPhase).toBe('gao-di-dispatch-choice');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech')?.level).toBe(2);
        expect(resolved.gaoDiDispatchSelection).toMatchObject({
            source: 'gao-di',
            sourceRegionId: 'city-region-25',
        });
        expect(resolved.actionLog[0]?.text).toContain('高第可在行动前弃 1 张手牌；弃牌后再选择调度目标');
    });

it('高第在场时会先进入弃牌调度选择，跳过后同窗口仍会继续触发王化贞免费调度', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-gao-di' || character.id === 'ming-wang-huazhen',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 2,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 3, level: 1 },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 1,
                    specialTroops: [
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                    ],
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(firstWindow.turnPhase).toBe('gao-di-dispatch-choice');
        expect(firstWindow.selectedRegionId).toBe('city-region-25');
        expect(firstWindow.gaoDiDispatchSelection).toMatchObject({
            source: 'gao-di',
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
        });
        expect(firstWindow.gaoDiDispatchSelection?.candidateCardIds.length ?? 0).toBeGreaterThanOrEqual(3);
        expect(firstWindow.actionLog[0]?.text).toContain('高第可在行动前弃 1 张手牌；弃牌后再选择调度目标');

        const skipped = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            playerId: '0',
            payload: { choiceId: 'skip' },
        });

        expect(skipped.turnPhase).toBe('internal-dispatch-choice');
        expect(skipped.gaoDiDispatchSelection).toBeNull();
        expect(getInternalDispatchSelection(skipped)).toMatchObject({
            source: 'wang-huazhen',
            sourceRegionId: 'city-region-25',
        });
        expect(skipped.actionLog[0]?.text).toContain('王化贞可在行动前免费调度 2 个部队；直接在地图上选择调度目标');
    });

it('高第与王化贞从逻辑区宁远进入人物窗口时，会把 selectedRegionId 收到真实运行时来源区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'ning-yuan';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-gao-di' || character.id === 'ming-wang-huazhen',
                })),
            },
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
                    troops: 3,
                    population: 2,
                    specialTroops: [
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 3, level: 1 },
                    ],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 1,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                    ],
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'ning-yuan' },
        });

        expect(firstWindow.turnPhase).toBe('gao-di-dispatch-choice');
        expect(firstWindow.selectedRegionId).toBe('city-region-24');
        expect(firstWindow.gaoDiDispatchSelection).toMatchObject({
            source: 'gao-di',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
        });

        const skipped = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            playerId: '0',
            payload: { choiceId: 'skip' },
        });

        expect(skipped.turnPhase).toBe('internal-dispatch-choice');
        expect(skipped.selectedRegionId).toBe('city-region-24');
        expect(getInternalDispatchSelection(skipped)).toMatchObject({
            source: 'wang-huazhen',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
        });
    });

it('高第与王化贞人物窗口内点逻辑区宁远时，高第只重建来源区，王化贞会按真实运行时目标直接完成调度', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-gao-di' || character.id === 'ming-wang-huazhen',
                })),
            },
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
                    troops: 3,
                    population: 2,
                    specialTroops: [
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 3, level: 1 },
                    ],
                    cityState: null,
                    siegeState: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 1,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                    ],
                    cityState: null,
                    siegeState: null,
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(firstWindow.turnPhase).toBe('gao-di-dispatch-choice');
        expect(firstWindow.selectedRegionId).toBe('city-region-25');
        expect(firstWindow.gaoDiDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
        });

        const retargetedGaoDi = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'ning-yuan' },
        });

        expect(retargetedGaoDi.turnPhase).toBe('gao-di-dispatch-choice');
        expect(retargetedGaoDi.selectedRegionId).toBe('city-region-25');
        expect(retargetedGaoDi.explicitRegionId).toBe('ning-yuan');
        expect(retargetedGaoDi.gaoDiDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            displayAnchorRegionId: 'ning-yuan',
            displayAnchorRegionName: '宁远',
        });

        const skipped = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            playerId: '0',
            payload: { choiceId: 'skip' },
        });

        expect(skipped.turnPhase).toBe('internal-dispatch-choice');
        expect(skipped.selectedRegionId).toBe('city-region-25');
        expect(getInternalDispatchSelection(skipped)).toMatchObject({
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
            displayAnchorRegionId: 'city-region-25',
            displayAnchorRegionName: '山海关',
        });

        const retargetedWang = apply(skipped, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'ning-yuan' },
        });

        expect(retargetedWang.turnPhase).toBe('action-window');
        expect(retargetedWang.selectedRegionId).toBe('city-region-24');
        expect(retargetedWang.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 0,
        });
        expect(retargetedWang.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 4,
        });
        expect(retargetedWang.actionLog[0]?.text).toContain('王化贞令 山海关 向 宁远 免费调度 1 个部队');
    });

it('高第弃 1 张手牌后可以按所选数量调度部队到相邻友方区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-gao-di',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    population: 2,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 4, level: 2 },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 1,
                    specialTroops: [
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                    ],
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        const selectedCardId = factionHandCards(selecting, 'ming')[0]?.id;
        expect(selectedCardId).toBeTruthy();

        const selectedCard = apply(selecting, {
            type: QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD,
            playerId: '0',
            payload: { cardId: selectedCardId! },
        });
        const choiceId = selectedCard.gaoDiDispatchSelection?.candidates.find((candidate) => (
            candidate.targetRegionId === 'city-region-24'
            && candidate.mode === 'troops'
            && candidate.committedTroops === 3
        ))?.id;
        expect(choiceId).toBeTruthy();

        const resolved = apply(selectedCard, {
            type: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            playerId: '0',
            payload: { choiceId: choiceId! },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.gaoDiDispatchSelection).toBeNull();
        expect(resolved.selectedRegionId).toBe('city-region-24');
        expect(resolved.factions.ming.handCount).toBe(core.factions.ming.handCount - 1);
        expect(resolved.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount + 1);
        expect(resolved.discardPileCount).toBe(core.discardPileCount + 1);
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 1,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 4,
        });
        expect(resolved.lastSeasonSummary?.title).toBe('高第弃牌调度');
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('调度 3 个部队');
        expect(resolved.actionLog[0]?.text).toContain('弃 1 张手牌');
    });

it('高第弃 1 张手牌后可以按所选数量调度人口到相邻友方区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'song-jin';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-gao-di',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 6,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 1,
                    specialTroops: [
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                    ],
                };
            }
            return region;
        });

        const droughtCore = {
            ...core,
            regions: core.regions.map((region) => (
                region.id === 'city-region-25'
                    ? {
                        ...region,
                        eventMarkers: [{
                            id: 'drought-marker-city-region-25',
                            kind: 'drought' as const,
                            label: '旱灾标记',
                            sourceCardDefId: 'qidahen-atlas05-1613-northeast-drought',
                            imageSrc: 'qidahen/markers/drought-marker',
                        }],
                    }
                    : region
            )),
        };
        const droughtSelecting = apply(droughtCore, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        const droughtCardId = factionHandCards(droughtSelecting, 'ming')[1]?.id
            ?? factionHandCards(droughtSelecting, 'ming')[0]?.id;
        expect(droughtCardId).toBeTruthy();
        const droughtSelectedCard = apply(droughtSelecting, {
            type: QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD,
            playerId: '0',
            payload: { cardId: droughtCardId! },
        });
        expect(droughtSelectedCard.gaoDiDispatchSelection?.maxPopulation).toBe(0);
        expect(droughtSelectedCard.gaoDiDispatchSelection?.candidates.some((candidate) => candidate.mode === 'population')).toBe(false);

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        const selectedCardId = factionHandCards(selecting, 'ming')[1]?.id ?? factionHandCards(selecting, 'ming')[0]?.id;
        expect(selectedCardId).toBeTruthy();

        const selectedCard = apply(selecting, {
            type: QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD,
            playerId: '0',
            payload: { cardId: selectedCardId! },
        });
        const choiceId = selectedCard.gaoDiDispatchSelection?.candidates.find((candidate) => (
            candidate.targetRegionId === 'city-region-24'
            && candidate.mode === 'population'
            && candidate.committedPopulation === 5
        ))?.id;
        expect(choiceId).toBeTruthy();

        const resolved = apply(selectedCard, {
            type: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            playerId: '0',
            payload: { choiceId: choiceId! },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-24');
        expect(resolved.factions.ming.handCount).toBe(core.factions.ming.handCount - 1);
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            population: 1,
            troops: 2,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            population: 6,
            troops: 1,
        });
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('调度 5 个人口');
        expect(resolved.actionLog[0]?.text).toContain('调度');
        expect(resolved.actionLog[0]?.text).toContain('5 个人口');
    });

it('高第弃牌调度会把非围城 cityState 城市识别为可用来源区，并正确搬出守军', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-gao-di',
                })),
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
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            { id: 'ming-shanhaiguan-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 2 },
                        ],
                    },
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 1,
                    specialTroops: [],
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(selecting.gaoDiDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
            maxTroops: 2,
            maxPopulation: 2,
        });

        const selectedCardId = factionHandCards(selecting, 'ming')[0]?.id;
        expect(selectedCardId).toBeTruthy();

        const selectedCard = apply(selecting, {
            type: QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD,
            playerId: '0',
            payload: { cardId: selectedCardId! },
        });
        const choiceId = selectedCard.gaoDiDispatchSelection?.candidates.find((candidate) => (
            candidate.targetRegionId === 'city-region-24'
            && candidate.mode === 'troops'
            && candidate.committedTroops === 2
        ))?.id;
        expect(choiceId).toBeTruthy();

        const resolved = apply(selectedCard, {
            type: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            playerId: '0',
            payload: { choiceId: choiceId! },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 0,
            population: 2,
            specialTroops: [],
            cityState: null,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 3,
            specialTroops: [
                expect.objectContaining({ id: 'ming-shanhaiguan-infantry-lv2', count: 2 }),
            ],
        });
    });

it('高第弃牌调度可把部队增援到己方围城区域，并直接并入 siegeState', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-24';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-gao-di',
                })),
            },
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
                    troops: 3,
                    population: 2,
                    specialTroops: [
                        { id: 'ming-ningyuan-cavalry-lv1', label: '大明骑兵', faction: 'ming', troopKind: 'cavalry', count: 1, level: 1, pieceIds: ['ming-ningyuan-cavalry-piece-1'] },
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1, pieceIds: ['ming-ningyuan-infantry-piece-1', 'ming-ningyuan-infantry-piece-2'] },
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
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-24' },
        });
        const selectedCardId = factionHandCards(selecting, 'ming')[0]?.id;
        expect(selectedCardId).toBeTruthy();

        const selectedCard = apply(selecting, {
            type: QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD,
            playerId: '0',
            payload: { cardId: selectedCardId! },
        });

        expect(selectedCard.gaoDiDispatchSelection?.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                targetRegionId: 'city-region-25',
                mode: 'troops',
                committedTroops: 2,
            }),
        ]));
        expect(selectedCard.gaoDiDispatchSelection?.candidates.find((candidate) => (
            candidate.targetRegionId === 'city-region-25'
            && candidate.mode === 'population'
        ))).toBeUndefined();

        const choiceId = selectedCard.gaoDiDispatchSelection?.candidates.find((candidate) => (
            candidate.targetRegionId === 'city-region-25'
            && candidate.mode === 'troops'
            && candidate.committedTroops === 2
        ))?.id;
        expect(choiceId).toBeTruthy();

        const resolved = apply(selectedCard, {
            type: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            playerId: '0',
            payload: { choiceId: choiceId! },
        });

        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 1,
            population: 2,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 0,
            population: 0,
            siegeState: {
                attackerFactionId: 'ming',
                attackerTroops: 4,
                attackerSpecialTroops: [
                    expect.objectContaining({ id: 'ming-shanhaiguan-infantry-lv1', count: 2 }),
                    expect.objectContaining({ id: 'ming-ningyuan-cavalry-lv1', count: 1 }),
                    expect.objectContaining({ id: 'ming-ningyuan-infantry-lv1', count: 1 }),
                ],
            },
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [],
            },
        });
        const siegeRegion = resolved.regions.find((region) => region.id === 'city-region-25');
        const siegeAttackerPieceIds = siegeRegion?.siegeState?.attackerSpecialTroops.flatMap((stack) => stack.pieceIds ?? []) ?? [];
        expect(siegeAttackerPieceIds.sort()).toEqual([
            'ming-shanhaiguan-infantry-piece-1',
            'ming-shanhaiguan-infantry-piece-2',
            'ming-ningyuan-cavalry-piece-1',
            'ming-ningyuan-infantry-piece-1',
        ].sort());
        expect(
            resolved.pieces
                .filter((piece) => piece.regionId === 'city-region-25' && piece.location === 'siege-attacker')
                .map((piece) => piece.id)
                .sort(),
        ).toEqual(siegeAttackerPieceIds.slice().sort());
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('增援围城部队 2 个部队');
        expect(resolved.actionLog[0]?.text).toContain('增援围城部队 2 个部队');
    });

it('王化贞在场时会在新的大明行动窗口前进入免费内部调度选择，点击绿色目标后本窗口不重复触发', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        keepOnlyMingHomelandFallback(core);
        core.currentPlayer = '0';
        core.selectedRegionId = 'song-jin';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
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
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-artillery-lv2', label: '大明炮兵', faction: 'ming', troopKind: 'artillery', count: 1, level: 2 },
                        { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(firstWindow.turnPhase).toBe('internal-dispatch-choice');
        expect(firstWindow.selectedRegionId).toBe('city-region-25');
        expect(getInternalDispatchSelection(firstWindow)).toMatchObject({
            source: 'wang-huazhen',
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
            maxTroops: 2,
        });
        expect(getInternalDispatchSelection(firstWindow)?.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                targetRegionId: 'city-region-24',
                targetRegionName: '宁远',
                committedTroops: 2,
            }),
        ]));
        expect(firstWindow.actionLog[0]?.text).toContain('王化贞可在行动前免费调度 2 个部队；直接在地图上选择调度目标');

        const retargetedSource = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        });

        expect(retargetedSource.turnPhase).toBe('internal-dispatch-choice');
        expect(retargetedSource.selectedRegionId).toBe('city-region-25');
        expect(retargetedSource.explicitRegionId).toBe('song-jin');
        expect(getInternalDispatchSelection(retargetedSource)).toMatchObject({
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
        });
        expect(getInternalDispatchSelection(retargetedSource)?.candidates.length ?? 0).toBeGreaterThan(0);

        const resolved = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-24' },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-24');
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 1,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 3,
        });
        expect(resolved.actionLog[0]?.text).toContain('王化贞令 山海关 向 宁远 免费调度 2 个部队');

        const sameWindow = apply(resolved, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(sameWindow.turnPhase).toBe('action-window');
        expect(sameWindow.selectedRegionId).toBe('city-region-25');
        expect(sameWindow.regions.find((region) => region.id === 'city-region-25')?.troops).toBe(1);
        expect(sameWindow.regions.find((region) => region.id === 'city-region-24')?.troops).toBe(3);
        expect(sameWindow.actionLog[0]?.text).toBe(resolved.actionLog[0]?.text);
    });

it('王化贞内部调度会真实把 2 个部队从源区搬到友方目标区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
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
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-artillery-lv2', label: '大明炮兵', faction: 'ming', troopKind: 'artillery', count: 1, level: 2 },
                        { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    specialTroops: [],
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        const choiceId = getInternalDispatchSelection(selecting)?.candidates.find((candidate) => candidate.targetRegionId === 'city-region-24')?.id;
        expect(choiceId).toBeTruthy();

        const resolved = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_INTERNAL_DISPATCH,
            playerId: '0',
            payload: { choiceId: choiceId! },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect('internalDispatchSelection' in resolved).toBe(false);
        expect(resolved.selectedRegionId).toBe('city-region-24');
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 1,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', count: 1, level: 1 }),
        ]));
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 3,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'ming-shanhaiguan-artillery-lv2', label: '大明炮兵', count: 1, level: 2 }),
            expect.objectContaining({ id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', count: 1, level: 1 }),
        ]));
        expect(resolved.lastSeasonSummary?.title).toBe('王化贞免费调度');
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('大明因王化贞免费调度，自 山海关 向 宁远 调动 2 个部队');
        expect(resolved.actionLog[0]?.text).toContain('王化贞令 山海关 向 宁远 免费调度 2 个部队');
    });

it('王化贞内部调度会把非围城 cityState 城市识别为可用来源区，并正确搬出守军', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
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
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            { id: 'ming-shanhaiguan-artillery-lv2', label: '大明炮兵', faction: 'ming', troopKind: 'artillery', count: 1, level: 2 },
                            { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                        ],
                    },
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    specialTroops: [],
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(getInternalDispatchSelection(selecting)).toMatchObject({
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
            maxTroops: 2,
        });
        const choiceId = getInternalDispatchSelection(selecting)?.candidates.find((candidate) => candidate.targetRegionId === 'city-region-24')?.id;
        expect(choiceId).toBeTruthy();

        const resolved = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_INTERNAL_DISPATCH,
            playerId: '0',
            payload: { choiceId: choiceId! },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 0,
            population: 2,
            specialTroops: [],
            cityState: null,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 3,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'ming-shanhaiguan-artillery-lv2', count: 1 }),
            expect.objectContaining({ id: 'ming-shanhaiguan-infantry-lv1', count: 1 }),
        ]));
    });

it('王化贞内部调度可把部队增援到己方围城区域，并直接并入 siegeState', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-24';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
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
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [
                        { id: 'ming-ningyuan-artillery-lv2', label: '大明炮兵', faction: 'ming', troopKind: 'artillery', count: 1, level: 2, pieceIds: ['ming-ningyuan-artillery-piece-1'] },
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1, pieceIds: ['ming-ningyuan-infantry-piece-1'] },
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
                        attackerTroops: 3,
                        attackerSpecialTroops: [
                            { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1, pieceIds: ['ming-shanhaiguan-infantry-piece-1'] },
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
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-24' },
        });

        expect(getInternalDispatchSelection(selecting)?.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                targetRegionId: 'city-region-25',
                committedTroops: 2,
            }),
        ]));
        const choiceId = getInternalDispatchSelection(selecting)?.candidates.find((candidate) => candidate.targetRegionId === 'city-region-25')?.id;
        expect(choiceId).toBeTruthy();

        const resolved = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_INTERNAL_DISPATCH,
            playerId: '0',
            payload: { choiceId: choiceId! },
        });

        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 0,
            population: 0,
            siegeState: {
                attackerFactionId: 'ming',
                attackerTroops: 5,
                attackerSpecialTroops: [
                    expect.objectContaining({ id: 'ming-shanhaiguan-infantry-lv1', count: 1 }),
                    expect.objectContaining({ id: 'ming-ningyuan-artillery-lv2', count: 1 }),
                    expect.objectContaining({ id: 'ming-ningyuan-infantry-lv1', count: 1 }),
                ],
            },
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [],
            },
        });
        const internalSiegeRegion = resolved.regions.find((region) => region.id === 'city-region-25');
        const internalSiegePieceIds = internalSiegeRegion?.siegeState?.attackerSpecialTroops.flatMap((stack) => stack.pieceIds ?? []) ?? [];
        expect(internalSiegePieceIds.sort()).toEqual([
            'ming-shanhaiguan-infantry-piece-1',
            'ming-ningyuan-artillery-piece-1',
            'ming-ningyuan-infantry-piece-1',
        ].sort());
        expect(
            resolved.pieces
                .filter((piece) => piece.regionId === 'city-region-25' && piece.location === 'siege-attacker')
                .map((piece) => piece.id)
                .sort(),
        ).toEqual(internalSiegePieceIds.slice().sort());
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('增援围城 2 个部队');
        expect(resolved.actionLog[0]?.text).toContain('免费增援围城 2 个部队');
    });

it('熊廷弼在场时会在新的大明行动窗口前免费训练最多4个部队，且同一窗口不重复触发', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        keepOnlyMingHomelandFallback(core);
        core.currentPlayer = '0';
        core.selectedRegionId = 'song-jin';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: [{ id: 'artillery-tech', name: '火炮技术', level: 2 }],
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-xiong-tingbi',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [
                        { id: 'ming-dongjiang-artillery-lv1', label: '大明炮兵', faction: 'ming', troopKind: 'artillery', count: 1, level: 1 },
                        { id: 'ming-dongjiang-cavalry-lv2', label: '大明骑兵', faction: 'ming', troopKind: 'cavalry', count: 1, level: 2 },
                    ],
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        });

        expect(firstWindow.turnPhase).toBe('action-window');
        expect(firstWindow.selectedRegionId).toBe('song-jin');
        expect(firstWindow.regions.find((region) => region.id === 'song-jin')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'ming-song-jin-xiong-tingbi-regular-infantry-lv3',
                label: '大明步兵',
                faction: 'ming',
                troopKind: 'infantry',
                count: 3,
                level: 3,
            }),
        ]));
        expect(firstWindow.regions.find((region) => region.id === 'city-region-22')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'ming-dongjiang-artillery-lv2',
                label: '大明炮兵',
                faction: 'ming',
                troopKind: 'artillery',
                count: 1,
                level: 2,
            }),
            expect.objectContaining({
                id: 'ming-dongjiang-cavalry-lv2',
                label: '大明骑兵',
                faction: 'ming',
                troopKind: 'cavalry',
                count: 1,
                level: 2,
            }),
        ]));
        expect(firstWindow.actionLog[0]?.text).toContain('熊廷弼在行动前免费训练 4 个部队');
        expect(firstWindow.actionLog[0]?.text).toContain('皮岛：大明步兵 x3 升至 3 级');
        expect(firstWindow.actionLog[0]?.text).toContain('东江：大明炮兵 x1 升至 2 级');

        const sameWindow = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-22' },
        });

        expect(sameWindow.turnPhase).toBe('action-window');
        expect(sameWindow.selectedRegionId).toBe('city-region-22');
        expect(sameWindow.regions.find((region) => region.id === 'song-jin')?.specialTroops).toEqual(
            firstWindow.regions.find((region) => region.id === 'song-jin')?.specialTroops,
        );
        expect(sameWindow.regions.find((region) => region.id === 'city-region-22')?.specialTroops).toEqual(
            firstWindow.regions.find((region) => region.id === 'city-region-22')?.specialTroops,
        );
    });

it('熊廷弼当前选中逻辑区宁远时，会优先训练对应的真实运行时区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'ning-yuan';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: [{ id: 'artillery-tech', name: '火炮技术', level: 2 }],
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-xiong-tingbi',
                })),
            },
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
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        });

        expect(firstWindow.regions.find((region) => region.id === 'city-region-24')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'ming-city-region-24-xiong-tingbi-regular-infantry-lv3',
                label: '大明步兵',
                faction: 'ming',
                troopKind: 'infantry',
                count: 4,
                level: 3,
            }),
        ]));
        expect(firstWindow.regions.find((region) => region.id === 'song-jin')).toMatchObject({
            troops: 1,
            specialTroops: [],
        });
        expect(firstWindow.selectedRegionId).toBe('city-region-24');
        expect(firstWindow.actionLog[0]?.text).toContain('宁远：大明步兵 x4 升至 3 级');
    });

it('熊廷弼免费训练会先并回非围城 cityState 守军，再按总兵优先训练该城市', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'jinzhou';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: [{ id: 'artillery-tech', name: '火炮技术', level: 2 }],
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-xiong-tingbi',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 3,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            if (region.controller === 'ming') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    siegeState: null,
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'jinzhou' },
        });

        expect(firstWindow.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 3,
            population: 2,
            cityState: null,
            specialTroops: [
                expect.objectContaining({
                    id: 'ming-city-region-25-xiong-tingbi-regular-infantry-lv3',
                    label: '大明步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 3,
                    level: 3,
                }),
            ],
        });
        expect(firstWindow.regions.find((region) => region.id === 'song-jin')).toMatchObject({
            troops: 1,
            cityState: null,
            specialTroops: [
                expect.objectContaining({
                    id: 'ming-song-jin-xiong-tingbi-regular-infantry-lv3',
                    label: '大明步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 1,
                    level: 3,
                }),
            ],
        });
        expect(firstWindow.actionLog[0]?.text).toContain('熊廷弼在行动前免费训练 4 个部队');
        expect(firstWindow.actionLog[0]?.text).toContain('山海关：大明步兵 x3 升至 3 级');
        expect(firstWindow.actionLog[0]?.text).toContain('皮岛：大明步兵 x1 升至 3 级');
    });

it('熊廷弼免费训练会识别只在 cityState 中保留的大明结构化部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'jinzhou';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: [{ id: 'artillery-tech', name: '火炮技术', level: 2 }],
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-xiong-tingbi',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-song-jin-infantry-lv2',
                                label: '大明步兵',
                                faction: 'ming',
                                troopKind: 'infantry',
                                count: 1,
                                level: 2,
                            },
                            {
                                id: 'ming-song-jin-artillery-lv1',
                                label: '大明炮兵',
                                faction: 'ming',
                                troopKind: 'artillery',
                                count: 1,
                                level: 1,
                            },
                        ],
                    },
                };
            }
            if (region.controller === 'ming') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    siegeState: null,
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'jinzhou' },
        });

        expect(firstWindow.regions.find((region) => region.id === 'song-jin')).toMatchObject({
            controller: 'neutral',
            troops: 2,
            population: 2,
            cityState: null,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'ming-song-jin-infantry-lv3',
                    troopKind: 'infantry',
                    count: 1,
                    level: 3,
                }),
                expect.objectContaining({
                    id: 'ming-song-jin-artillery-lv2',
                    troopKind: 'artillery',
                    count: 1,
                    level: 2,
                }),
            ]),
        });
        expect(firstWindow.actionLog[0]?.text).toContain('熊廷弼在行动前免费训练 2 个部队');
        expect(firstWindow.actionLog[0]?.text).toContain('皮岛：大明步兵 x1 升至 3 级');
        expect(firstWindow.actionLog[0]?.text).toContain('大明炮兵 x1 升至 2 级');
    });

it('毛文龙与袁崇焕同场时会在新的大明行动窗口前离场', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-22';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-mao-wenlong' || character.id === 'ming-yuan-chonghuan',
                })),
            },
        };

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-22' },
        });

        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('city-region-22');
        expect(next.factions.ming.characters.find((character) => character.id === 'ming-mao-wenlong')?.inPlay).toBe(false);
        expect(next.factions.ming.characters.find((character) => character.id === 'ming-yuan-chonghuan')?.inPlay).toBe(true);
        expect(next.actionLog[0]?.text).toContain('毛文龙与袁崇焕同场');
    });

it('绰克图台吉在场时会在每个新的蒙古行动窗口前于外喀尔喀部免费建立 2 个骑兵，且同一窗口不重复触发', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.selectedRegionId = 'city-region-2';
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-choghtu-taiji',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion || region.id !== 'city-region-2') {
                return region;
            }
            return {
                ...region,
                controller: 'mongol',
                controlLabel: '蒙古',
                troops: 0,
                diplomacyMarkerFaction: null,
                diplomacyMarkerSide: null,
                specialTroops: [],
            };
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-2' },
        });
        expect(firstWindow.turnPhase).toBe('action-window');
        expect(firstWindow.selectedRegionId).toBe('city-region-2');
        expect(firstWindow.regions.find((region) => region.id === 'city-region-2')).toMatchObject({
            troops: 2,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'mongol-choghtu-taiji-cavalry-lv2',
                    troopKind: 'cavalry',
                    count: 2,
                    level: 2,
                }),
            ]),
        });
        expect(firstWindow.factions.mongol.troops).toBe(core.factions.mongol.troops + 2);

        const sameWindow = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-14' },
        });
        expect(sameWindow.turnPhase).toBe('action-window');
        expect(sameWindow.selectedRegionId).toBe('city-region-14');
        expect(sameWindow.regions.find((region) => region.id === 'city-region-2')?.troops).toBe(2);
        expect(sameWindow.factions.mongol.troops).toBe(firstWindow.factions.mongol.troops);

        const nextWindowSource = {
            ...sameWindow,
            wheelActionUsed: true,
            factionActionUsed: false,
        };
        const secondWindow = apply(nextWindowSource, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-2' },
        });
        expect(secondWindow.turnPhase).toBe('action-window');
        expect(secondWindow.selectedRegionId).toBe('city-region-2');
        expect(secondWindow.regions.find((region) => region.id === 'city-region-2')).toMatchObject({
            troops: 4,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'mongol-choghtu-taiji-cavalry-lv2',
                    count: 4,
                }),
            ]),
        });
        expect(secondWindow.factions.mongol.troops).toBe(firstWindow.factions.mongol.troops + 2);
        expect(secondWindow.actionLog[0]?.text).toContain('漠北援军');
    });
});
