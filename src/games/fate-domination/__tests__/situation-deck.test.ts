import {expect,it} from 'vitest';
import {createReplayAdapter} from '../../../engine/adapter';
import {FateDominationDomain} from '../domain';
import {projectFatePlayerView} from '../domain/playerView';
const adapter=createReplayAdapter(FateDominationDomain,'situations-setup');
it('十张普通局势烧毁两张，首轮展示一张，A1实际剩余七张',()=>{
 const core=adapter.setup(['0','1','2']).core;
 expect(core.situation.climax).toBe(false);
 expect(core.situationDeck).toHaveLength(7);
 expect(core.situationDeckCount).toBe(7);
 expect(new Set([core.situation.id,...core.situationDeck!.map(card=>card.id)]).size).toBe(8);
 expect(core.situationDeck!.every(card=>!card.climax)).toBe(true);
});
it('下一回合从已确定的局势牌库抽牌，公共投影保留数量不泄露顺序',()=>{
 const state=adapter.setup(['0','1','2']);const core=state.core;
 const next=FateDominationDomain.reduce(core,{type:'BATTLE_RESOLVED',payload:{nextRound:2,result:{playerId:'0',totalVictoryPoints:0}},timestamp:1} as never);
 expect(next.situation.id).toBe(core.situationDeck![0].id);
 expect(next.situationDeck).toHaveLength(6);expect(next.situationDeckCount).toBe(6);
 expect(projectFatePlayerView(next,'0').situationDeck).toEqual([]);
});
