import {it,expect} from 'vitest';
import {createReplayAdapter} from '../../../engine/adapter';
import {FateDominationDomain} from '../domain';
import {fateDominationCriticalImageResolver} from '../criticalImageResolver';
import {FATE_SERVANT_BY_ID} from '../data';
import {fateTokenAsset, fateCommandSealPreview} from '../data/identityArtwork';
it('首屏尚未部署时头像、令咒与常显技能也属于关键图片',()=>{
 const G=createReplayAdapter(FateDominationDomain,'visible-opening').setup(['0','1','2']);
 const result=fateDominationCriticalImageResolver(G,'zh-CN','0');
 for(const id of G.core.playerIds)expect(result.critical).toContain(fateTokenAsset(G.core.players[id].masterId));
 const viewer=G.core.players['0'];
 expect(result.critical).toContain(FATE_SERVANT_BY_ID[viewer.servantId].assetPath);
 for(const asset of FATE_SERVANT_BY_ID[viewer.servantId].skillAssetPaths??[])expect(result.critical).toContain(asset);
 const seal=fateCommandSealPreview(viewer.masterId);
 if(seal?.type==='image')expect(result.critical).toContain(seal.src);
});
it('按观看者加载手牌和技能，不把全部角色图库预载或暴露暗置从者',()=>{
 const G=createReplayAdapter(FateDominationDomain,'assets').setup(['0','1','2']);G.core.phase='action';G.core.currentPlayerId='1';
 const result=fateDominationCriticalImageResolver(G,'zh-CN','0');
 expect(result.critical).toContain('fate-domination/skills/sc_saber_1');
 expect([...result.critical,...result.warm]).not.toContain(FATE_SERVANT_BY_ID['servant-heracles'].assetPath);
 expect([...result.critical,...result.warm]).not.toContain(FATE_SERVANT_BY_ID['servant-medusa'].assetPath);
 expect(result.replaceStaticCritical).toBe(true);
});
