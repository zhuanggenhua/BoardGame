import {fateCardImageAsset} from '../data/cardArtwork';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {FATE_MASTERS,FATE_SERVANTS,FATE_SITUATIONS,FATE_EVENTS,FATE_ATTACK_BY_ID,FATE_ATTACK_CARDS} from '../data';
const manifest=JSON.parse(readFileSync('public/assets/i18n/zh-CN/fate-domination/assets-manifest.json','utf8'));
const key=(path:string)=>{const relative=fateCardImageAsset(path).replace('fate-domination/','');const i=relative.lastIndexOf('/');return `${relative.slice(0,i)}/compressed/${relative.slice(i+1)}`;};
it('当前身份、技能、局势与事件全部解析到正式 manifest，重复事件复用同一真实卡面',()=>{
 expect(FATE_MASTERS).toHaveLength(13);
 expect(FATE_SERVANTS).toHaveLength(14);
 const paths=[...FATE_MASTERS.map(item=>item.assetPath),...FATE_SERVANTS.flatMap(item=>[item.assetPath,...item.skillAssetPaths]),...FATE_SITUATIONS.map(item=>item.assetPath),...FATE_EVENTS.map(item=>item.assetPath)];
 expect(paths.filter(path=>!manifest.files[key(path)])).toEqual([]);
 expect(FATE_EVENTS.find(item=>item.id==='fuyuki_E1')?.assetPath).toBe(FATE_EVENTS.find(item=>item.id==='fuyuki_E2')?.assetPath);
});
it('仅核对当前开放从者的实际牌库，不要求加载未开放角色的所有素材',()=>{
 expect(FATE_SERVANTS).toHaveLength(14);
 const ids=[...new Set(FATE_SERVANTS.flatMap(item=>item.deck??[]))];
 expect(ids.filter(id=>!FATE_ATTACK_BY_ID[id] || !manifest.files[key(FATE_ATTACK_BY_ID[id].assetPath)])).toEqual([]);
 expect(ids.some(id=>['cardFumble','cardMoment','cardInstant','cardUnknownSkill'].includes(id))).toBe(false);
 expect(manifest.files['cards/compressed/basic-attack-atlas']?.variants?.webp).toBeDefined();
});
it('当前 33 张牌目录不包含已退役 fallback 卡牌',()=>{
 expect(FATE_ATTACK_CARDS).toHaveLength(33);
 expect(FATE_ATTACK_CARDS.map(card=>card.id)).not.toEqual(expect.arrayContaining(['cardFumble','cardMoment','cardInstant','cardUnknownSkill']));
});
