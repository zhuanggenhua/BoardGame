import {it,expect} from 'vitest';
import {createReplayAdapter} from '../../../engine/adapter';
import {FateDominationDomain} from '../domain';
import {fateDominationCriticalImageResolver} from '../criticalImageResolver';
import {FATE_SERVANT_BY_ID} from '../data';
it('按观看者加载手牌和技能，不把全部角色图库预载或暴露暗置从者',()=>{
 const G=createReplayAdapter(FateDominationDomain,'assets').setup(['0','1','2']);G.core.phase='action';G.core.currentPlayerId='1';
 const result=fateDominationCriticalImageResolver(G,'zh-CN','0');
 expect(result.critical).toContain('fate-domination/skills/sc_saber_1');
 expect([...result.critical,...result.warm]).not.toContain(FATE_SERVANT_BY_ID['servant-heracles'].assetPath);
 expect([...result.critical,...result.warm]).not.toContain(FATE_SERVANT_BY_ID['servant-medusa'].assetPath);
 expect(result.replaceStaticCritical).toBe(true);
});
