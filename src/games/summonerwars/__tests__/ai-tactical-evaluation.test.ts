import { describe, expect, it } from 'vitest';
import { buildAiDecisionContext, type AiDecisionContext, type AiLegalAction } from '../../../engine/ai';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState } from '../../../engine/types';
import { buildSummonerWarsAiLegalActions } from '../ai';
import '../game';
import { SW_COMMANDS } from '../domain';
import type {
    CellCoord,
    EventCard,
    FactionId,
    SummonerWarsCore,
    UnitCard,
} from '../domain/types';
import { evaluateSummonerWarsBoardState } from '../ai/evaluation';
import { projectSummonerWarsActionDelta } from '../ai/search';
import { createInitializedCore, placeTestUnit, resetInstanceCounter } from './test-helpers';

const testRandom = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(arr: T[]) => [...arr],
};

const makeCore = (options?: { faction0?: FactionId; faction1?: FactionId }): SummonerWarsCore => {
    resetInstanceCounter();
    return createInitializedCore(['0', '1'], testRandom, options);
};

const makeState = (core: SummonerWarsCore): MatchState<SummonerWarsCore> => ({
    core,
    sys: createInitialSystemState(['0', '1'], []),
});

const buildContext = (
    core: SummonerWarsCore,
    difficulty: 'easy' | 'normal' | 'hard' | 'expert' = 'hard',
): AiDecisionContext => buildAiDecisionContext({
    gameId: 'summonerwars',
    matchId: 'local:summonerwars-ai-tactical-evaluation',
    playerId: '0',
    visibleState: makeState(core) as MatchState<unknown>,
    rulesVersion: null,
    decisionBudgetMs: 250,
    source: 'local',
    seatController: { type: 'local-ai', difficulty },
});

const clearNonSummonerUnits = (core: SummonerWarsCore): void => {
    for (const row of core.board) {
        for (const cell of row) {
            if (cell.unit && cell.unit.card.unitClass !== 'summoner') {
                cell.unit = undefined;
            }
        }
    }
    core.players['0'].moveCount = 0;
    core.players['1'].moveCount = 0;
    core.players['0'].attackCount = 0;
    core.players['1'].attackCount = 0;
};

const makeUnitCard = (id: string, overrides: Partial<UnitCard> = {}): UnitCard => ({
    id,
    cardType: 'unit',
    name: overrides.name ?? id,
    unitClass: overrides.unitClass ?? 'common',
    faction: overrides.faction ?? 'necromancer',
    strength: overrides.strength ?? 2,
    life: overrides.life ?? 3,
    cost: overrides.cost ?? 1,
    attackType: overrides.attackType ?? 'melee',
    attackRange: overrides.attackRange ?? 1,
    abilities: overrides.abilities,
    deckSymbols: overrides.deckSymbols ?? [],
    spriteIndex: overrides.spriteIndex,
    spriteAtlas: overrides.spriteAtlas,
});

const makeEventCard = (id: string, overrides: Partial<EventCard> = {}): EventCard => ({
    id,
    cardType: 'event',
    name: overrides.name ?? id,
    faction: overrides.faction ?? 'necromancer',
    cost: overrides.cost ?? 0,
    playPhase: overrides.playPhase ?? 'any',
    effect: overrides.effect ?? '测试事件',
    isActive: overrides.isActive,
    charges: overrides.charges,
    deckSymbols: overrides.deckSymbols ?? [],
});

const projectAction = (context: AiDecisionContext, action: AiLegalAction) => projectSummonerWarsActionDelta({
    context,
    action,
    difficulty: context.difficulty,
    remainingBudgetMs: context.difficulty.simulationBudgetMs,
    scoreScale: 1,
    buildLegalActions: buildSummonerWarsAiLegalActions,
});

describe('summoner wars AI tactical evaluation', () => {
    it('统一局面价值函数覆盖召唤师安全、击杀窗口、经济和位置控制', () => {
        const safeCore = makeCore();
        clearNonSummonerUnits(safeCore);
        safeCore.phase = 'attack';
        const safeEval = evaluateSummonerWarsBoardState({
            state: makeState(safeCore),
            playerId: '0',
        });

        const threatenedCore = makeCore();
        clearNonSummonerUnits(threatenedCore);
        threatenedCore.phase = 'attack';
        placeTestUnit(threatenedCore, { row: 6, col: 3 }, {
            owner: '1',
            card: makeUnitCard('enemy-threat', { faction: 'paladin', strength: 4, life: 3 }),
        });
        const threatenedEval = evaluateSummonerWarsBoardState({
            state: makeState(threatenedCore),
            playerId: '0',
        });

        expect(threatenedEval.breakdown.summonerSafety.weightedScore)
            .toBeLessThan(safeEval.breakdown.summonerSafety.weightedScore);
        expect(threatenedEval.breakdown.summonerSafety.factors.directThreatDamage).toBeGreaterThan(0);

        const quietAttackCore = makeCore();
        clearNonSummonerUnits(quietAttackCore);
        quietAttackCore.phase = 'attack';
        placeTestUnit(quietAttackCore, { row: 6, col: 2 }, {
            owner: '0',
            card: makeUnitCard('own-ranged', { strength: 3, attackType: 'ranged', attackRange: 3 }),
        });
        placeTestUnit(quietAttackCore, { row: 6, col: 4 }, {
            owner: '1',
            card: makeUnitCard('enemy-champion-safe', {
                faction: 'paladin',
                unitClass: 'champion',
                strength: 3,
                life: 6,
                cost: 4,
            }),
        });
        const quietAttackEval = evaluateSummonerWarsBoardState({
            state: makeState(quietAttackCore),
            playerId: '0',
        });

        const killWindowCore = makeCore();
        clearNonSummonerUnits(killWindowCore);
        killWindowCore.phase = 'attack';
        placeTestUnit(killWindowCore, { row: 6, col: 2 }, {
            owner: '0',
            card: makeUnitCard('own-ranged', { strength: 3, attackType: 'ranged', attackRange: 3 }),
        });
        placeTestUnit(killWindowCore, { row: 6, col: 4 }, {
            owner: '1',
            damage: 3,
            card: makeUnitCard('enemy-champion-wounded', {
                faction: 'paladin',
                unitClass: 'champion',
                strength: 3,
                life: 6,
                cost: 4,
            }),
        });
        const killWindowEval = evaluateSummonerWarsBoardState({
            state: makeState(killWindowCore),
            playerId: '0',
        });
        expect(killWindowEval.breakdown.threatAndKills.weightedScore)
            .toBeGreaterThan(quietAttackEval.breakdown.threatAndKills.weightedScore);

        const poorEconomyCore = makeCore();
        clearNonSummonerUnits(poorEconomyCore);
        poorEconomyCore.players['0'].magic = 0;
        poorEconomyCore.players['0'].hand = [];
        const poorEconomyEval = evaluateSummonerWarsBoardState({
            state: makeState(poorEconomyCore),
            playerId: '0',
        });

        const richEconomyCore = makeCore();
        clearNonSummonerUnits(richEconomyCore);
        richEconomyCore.players['0'].magic = 7;
        richEconomyCore.players['0'].hand = [
            makeEventCard('low-keep-event', { cost: 0 }),
            makeUnitCard('curve-common', { cost: 1, strength: 1, life: 2 }),
        ];
        const richEconomyEval = evaluateSummonerWarsBoardState({
            state: makeState(richEconomyCore),
            playerId: '0',
        });
        expect(richEconomyEval.breakdown.magicEconomy.weightedScore)
            .toBeGreaterThan(poorEconomyEval.breakdown.magicEconomy.weightedScore);

        const weakPositionCore = makeCore();
        clearNonSummonerUnits(weakPositionCore);
        placeTestUnit(weakPositionCore, { row: 7, col: 0 }, {
            owner: '0',
            card: makeUnitCard('own-backline'),
        });
        placeTestUnit(weakPositionCore, { row: 3, col: 3 }, {
            owner: '1',
            card: makeUnitCard('enemy-center', { faction: 'paladin' }),
        });
        const weakPositionEval = evaluateSummonerWarsBoardState({
            state: makeState(weakPositionCore),
            playerId: '0',
        });

        const strongPositionCore = makeCore();
        clearNonSummonerUnits(strongPositionCore);
        placeTestUnit(strongPositionCore, { row: 3, col: 3 }, {
            owner: '0',
            card: makeUnitCard('own-center'),
        });
        placeTestUnit(strongPositionCore, { row: 0, col: 5 }, {
            owner: '1',
            card: makeUnitCard('enemy-corner', { faction: 'paladin' }),
        });
        const strongPositionEval = evaluateSummonerWarsBoardState({
            state: makeState(strongPositionCore),
            playerId: '0',
        });
        expect(strongPositionEval.breakdown.positionControl.weightedScore)
            .toBeGreaterThan(weakPositionEval.breakdown.positionControl.weightedScore);
    });

    it('动作后局面差值能解释移动防守、攻击高价值目标和不可投影降级', () => {
        const moveCore = makeCore();
        clearNonSummonerUnits(moveCore);
        moveCore.phase = 'move';
        moveCore.currentPlayer = '0';
        placeTestUnit(moveCore, { row: 6, col: 3 }, {
            owner: '1',
            card: makeUnitCard('adjacent-threat', { faction: 'paladin', strength: 4 }),
        });
        const moveContext = buildContext(moveCore);
        const defensiveMove = moveContext.legalActions.find((action) => {
            const to = action.metadata?.to as CellCoord | undefined;
            return action.kind === 'move-unit'
                && action.metadata?.sourceIsSummoner === true
                && to?.row === 7
                && to.col !== 3;
        });
        expect(defensiveMove).toBeTruthy();
        const moveProjection = projectAction(moveContext, defensiveMove!);
        const moveDelta = moveProjection.metadata.boardDelta as {
            breakdown: { summonerSafety: { delta: number } };
        };
        expect(moveProjection.metadata.projection).toMatchObject({ status: 'projected' });
        expect(moveDelta.breakdown.summonerSafety.delta).toBeGreaterThan(0);

        const attackCore = makeCore();
        clearNonSummonerUnits(attackCore);
        attackCore.phase = 'attack';
        attackCore.currentPlayer = '0';
        placeTestUnit(attackCore, { row: 6, col: 2 }, {
            owner: '0',
            card: makeUnitCard('own-ranged-attacker', { strength: 8, attackType: 'ranged', attackRange: 3 }),
        });
        placeTestUnit(attackCore, { row: 4, col: 2 }, {
            owner: '1',
            card: makeUnitCard('enemy-common', { faction: 'paladin', strength: 1, life: 8 }),
        });
        placeTestUnit(attackCore, { row: 6, col: 3 }, {
            owner: '1',
            damage: 5,
            card: makeUnitCard('enemy-champion', {
                faction: 'paladin',
                unitClass: 'champion',
                strength: 3,
                life: 6,
                cost: 4,
            }),
        });
        const attackContext = buildContext(attackCore);
        const commonAttack = attackContext.legalActions.find((action) => {
            const target = action.metadata?.target as CellCoord | undefined;
            return action.kind === 'declare-attack' && target?.row === 4 && target.col === 2;
        });
        const championAttack = attackContext.legalActions.find((action) => {
            const target = action.metadata?.target as CellCoord | undefined;
            return action.kind === 'declare-attack' && target?.row === 6 && target.col === 3;
        });
        expect(commonAttack).toBeTruthy();
        expect(championAttack).toBeTruthy();
        const commonProjection = projectAction(attackContext, commonAttack!);
        const championProjection = projectAction(attackContext, championAttack!);
        expect(championProjection.score).toBeGreaterThan(commonProjection.score);
        expect(championProjection.metadata.boardDelta).toBeTruthy();

        const abilityCore = makeCore({ faction0: 'barbaric', faction1: 'paladin' });
        clearNonSummonerUnits(abilityCore);
        abilityCore.phase = 'move';
        abilityCore.currentPlayer = '0';
        placeTestUnit(abilityCore, { row: 4, col: 3 }, {
            owner: '0',
            card: makeUnitCard('prepare-user', {
                faction: 'barbaric',
                abilities: ['prepare'],
            }),
        });
        const abilityContext = buildContext(abilityCore);
        const prepareAction = abilityContext.legalActions.find((action) => {
            return action.kind === 'activate-ability'
                && action.metadata?.abilityId === 'prepare';
        });
        expect(prepareAction).toBeTruthy();
        const prepareProjection = projectAction(abilityContext, prepareAction!);
        expect(prepareProjection.metadata.projection).toMatchObject({
            status: 'projected',
        });

        const unsafeProjection = projectAction(attackContext, {
            actionId: 'unsafe-ability',
            kind: 'activate-ability',
            label: '测试技能',
            commands: [{
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: { abilityId: 'test' },
            }],
        });
        expect(unsafeProjection.score).toBe(0);
        expect(unsafeProjection.metadata.projection).toMatchObject({
            status: 'fallback',
        });
    });

    it('同阶段短线搜索会在动作后重新生成候选并写入 sequence trace', () => {
        const core = makeCore();
        clearNonSummonerUnits(core);
        core.phase = 'summon';
        core.currentPlayer = '0';
        core.players['0'].magic = 6;
        core.players['0'].hand = [
            makeUnitCard('sequence-common-a', { cost: 0, strength: 6, life: 6 }),
            makeUnitCard('sequence-common-b', { cost: 0, strength: 6, life: 6 }),
        ];

        const context = buildContext(core, 'hard');
        const summonAction = context.legalActions.find((action) => {
            return action.kind === 'summon-unit'
                && action.metadata?.cardId === 'sequence-common-a';
        });
        expect(summonAction).toBeTruthy();

        const projection = projectAction(context, summonAction!);
        const sequence = projection.metadata.sequence as {
            score: number;
            actions: string[];
            path: string[];
        };
        expect(projection.metadata.projection).toMatchObject({ status: 'projected' });
        expect(sequence.score).toBeGreaterThan(0);
        expect(sequence.actions).toContain('summon-unit');
        expect(sequence.path.length).toBeGreaterThan(0);
    });

    it('派系 profile 会影响同一局面的维度权重和可解释摘要', () => {
        const core = makeCore();
        clearNonSummonerUnits(core);
        core.phase = 'attack';
        placeTestUnit(core, { row: 6, col: 2 }, {
            owner: '0',
            card: makeUnitCard('profile-attacker', { strength: 3, attackType: 'ranged', attackRange: 3 }),
        });
        placeTestUnit(core, { row: 6, col: 4 }, {
            owner: '1',
            damage: 3,
            card: makeUnitCard('profile-target', {
                faction: 'paladin',
                unitClass: 'champion',
                strength: 3,
                life: 6,
                cost: 4,
            }),
        });

        core.selectedFactions['0'] = 'goblin';
        const goblinEval = evaluateSummonerWarsBoardState({
            state: makeState(core),
            playerId: '0',
        });
        core.selectedFactions['0'] = 'paladin';
        const paladinEval = evaluateSummonerWarsBoardState({
            state: makeState(core),
            playerId: '0',
        });

        expect(goblinEval.profile.factionId).toBe('goblin');
        expect(goblinEval.profile.summary).toContain('哥布林铺场前压');
        expect(paladinEval.profile.factionId).toBe('paladin');
        expect(paladinEval.profile.summary).toContain('圣骑稳健推进');
        expect(goblinEval.breakdown.threatAndKills.weight)
            .toBeGreaterThan(paladinEval.breakdown.threatAndKills.weight);
        expect(paladinEval.breakdown.summonerSafety.weight)
            .toBeGreaterThan(goblinEval.breakdown.summonerSafety.weight);
    });
});
