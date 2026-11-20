import type { BetrayalCore } from '../../src/games/betrayal/game';

export interface MummyGoldenMoment {
    id: string;
    shot: string;
    visible: { url: string; playerId: string | null; gameOver: boolean; scenarioScope: string | null };
    authoritative: {
        matchId: string;
        phase: BetrayalCore['phase'];
        currentPlayer: string;
        activePlayer: BetrayalCore['activePlayerId'];
        room: BetrayalCore['activeRoomId'];
        characters: BetrayalCore['selectedExplorerByPlayerId'];
        gameOver: boolean;
        discovery: string | null;
        roll: string | null;
        pendingTrade: string | null;
        pendingDamage: string | null;
        outcome: string | null;
        eventsDrawn: number | null;
        mummy: BetrayalCore['scenarioRuntime']['mummy'];
        inventory: Array<{ playerId: string; roomId: string; inventory: string[]; traits: BetrayalCore['currentExplorer']['traits'] }>;
    };
}

export function buildMummyGoldenSteps(moments: readonly MummyGoldenMoment[], matchId: string, holySymbolId: string) {
    return moments.map((after, index) => {
        const before = moments[index - 1] ?? after;
        const state = after.authoritative;
        const verified = [{ name: '正式房间', actual: state.matchId as unknown, expected: matchId as unknown }];
        const check = (name: string, actual: unknown, expected: unknown) => verified.push({ name, actual, expected });
        const cards = (moment: MummyGoldenMoment, playerId: string) =>
            moment.authoritative.inventory.find(seat => seat.playerId === playerId)!.inventory;

        if (after.id.startsWith('06-')) check('事件的知识检定', state.roll, 'eventTraitCheck');
        if (after.id.startsWith('10-')) check('揭示物品', state.discovery, 'item');
        if (after.id.startsWith('12-')) {
            const might = (moment: MummyGoldenMoment) => moment.authoritative.inventory.find(seat => seat.playerId === '0')!.traits.might;
            check('受治席力量恢复', might(after) > might(before), true);
            check('急救包消耗', cards(after, '1').some(id => id.startsWith('medical-kit')), false);
        }
        if (after.id.startsWith('14-')) check('交易需房主答复', state.pendingTrade, '0');
        if (after.id.startsWith('15-')) {
            check('房主收到地图', cards(after, '0').includes('map'), true);
            check('第二席收到兔脚', cards(after, '1').includes('rope'), true);
            check('待确认交易退场', state.pendingTrade, null);
        }
        if (after.id.startsWith('17-')) {
            check('预兆作祟骰', state.roll, 'hauntRoll');
            check('服务端切换到作祟', state.phase, 'haunt');
            check('揭示席取得同一枚圣符', cards(after, '2').includes(holySymbolId), true);
        }
        if (after.id.startsWith('18-')) {
            check('阵营读本', after.visible.scenarioScope, after.visible.playerId === '2' ? 'traitor' : 'heroes');
        }
        if (after.id.startsWith('19-')) check('实际怪物移动骰', state.roll, 'monsterMoveRoll');
        if (after.id.startsWith('21-')) check('实际攻防骰', state.roll, 'attackRoll');
        if (after.id.startsWith('23')) check('由受伤席分配', state.pendingDamage, '0');
        if (after.id.startsWith('24-')) check('伤害分配已结算', state.pendingDamage, null);
        if (after.id.startsWith('26-')) check('拾起者实际持有女孩', state.mummy?.girlHolderPlayerId, '2');
        if (after.id.startsWith('28-')) {
            check('女孩已交给木乃伊', state.mummy?.girlHeldByMummy, true);
            check('木乃伊持有本局探索出的圣符', state.mummy?.mummyCarriedOmenIds.includes(holySymbolId), true);
            check('返棺之前对局继续', state.gameOver, false);
        }
        if (after.id.startsWith('32-')) {
            check('terminal-gameover', state.gameOver, true);
            check('正式终局报告可见', after.visible.gameOver, true);
            check('叛徒胜利', state.outcome, 'traitor');
            check('报告保留本局抽过的事件', state.eventsDrawn, 1);
        }
        return { id: after.id, action: after.id.slice(after.id.indexOf('-') + 1), before, after, assertions: verified };
    });
}
