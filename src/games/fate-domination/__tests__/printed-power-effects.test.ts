import { expect, it } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { FateDominationDomain } from '../domain';
import { FATE_SITUATIONS, FATE_EVENTS } from '../data';
import { calculateFatePower } from '../domain/power';
function fixture(){const core=createReplayAdapter(FateDominationDomain,'printed-power').setup(['0','1','2']).core;core.situation=FATE_SITUATIONS.find(s=>s.id==='sit1')!;core.players['0'].locationId='miyama';core.players['0'].deploymentSlot=null;core.players['0'].hand=[{id:'a',definitionId:'cardB1'},{id:'b',definitionId:'cardB2'}];core.players['0'].activeAttackIds=['a','b'];core.battlefield.miyama.playerIds=['0'];core.battlefield.miyama.eventCards=[];return core;}
it('局势属性增益逐张计算，阴影/诅咒和相同属性合计增益均消费',()=>{
 const core=fixture();core.situation=FATE_SITUATIONS.find(s=>s.id==='sit4')!;expect(calculateFatePower(core,'0',['a','b'])).toBe(9);
 core.situation=FATE_SITUATIONS.find(s=>s.id==='sit9')!;expect(calculateFatePower(core,'0',['a','b'])).toBe(7);
 core.situation=FATE_SITUATIONS.find(s=>s.id==='sit10')!;expect(calculateFatePower(core,'0',['a','b'])).toBe(8);
});
it('事件属性威力逐张加，地利翻倍和归零独立消费',()=>{
 const core=fixture();core.battlefield.miyama.eventCards=[FATE_EVENTS.find(e=>e.id==='fuyuki_E5')!];expect(calculateFatePower(core,'0',['a','b'])).toBe(11);
 core.players['0'].deploymentSlot=0;core.battlefield.miyama.eventCards=[FATE_EVENTS.find(e=>e.id==='fuyuki_E7')!];expect(calculateFatePower(core,'0',['a','b'])).toBe(11);
 core.battlefield.miyama.eventCards=[FATE_EVENTS.find(e=>e.id==='fuyuki_E8')!];expect(calculateFatePower(core,'0',['a','b'])).toBe(5);
});
it('铤而走险按并列末位人数占名次，偷袭读取真实真名状态',()=>{
 const core=fixture();core.players['0'].victoryPoints=1;core.players['1'].victoryPoints=0;core.players['2'].victoryPoints=0;
 core.battlefield.miyama.eventCards=[FATE_EVENTS.find(e=>e.id==='fuyuki_E1')!];expect(calculateFatePower(core,'0',['a','b'])).toBe(9);
 core.battlefield.miyama.eventCards=[FATE_EVENTS.find(e=>e.id==='fuyuki_E13')!];expect(calculateFatePower(core,'0',['a','b'])).toBe(10);
 core.players['0'].isRevealed=true;expect(calculateFatePower(core,'0',['a','b'])).toBe(5);
});
