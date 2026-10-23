import {expect,it} from 'vitest';
import {createReplayAdapter} from '../../../../engine/adapter';
import {FateDominationDomain} from '../../domain';
import {servantSkillsFor} from '../playerPresentation';
it('赫拉克勒斯三张同名十二试炼按实体定义区分，不能重复绑定第一张',()=>{
 const core=createReplayAdapter(FateDominationDomain,'same-name-cards').setup(['0','1','2']).core;
 const skills=servantSkillsFor(core.players['1']);
 expect(skills).toHaveLength(3);
 expect(skills.map(item=>item.skill.id.split(':')[0])).toEqual(['sc_herc_1','sc_herc_2','sc_herc_3']);
 expect(new Set(skills.map(item=>item.skill.id)).size).toBe(3);
});
