import {FATE_ATTACK_BY_ID} from '../data';
import {FATE_ATTACK_CARDS} from '../data';
import {expect,it} from 'vitest';
import {fateCardPreview,fateCardImageAsset} from '../data/cardArtwork';
it('正式攻击图集帧与预加载使用同一来源，不把逻辑帧当独立图片下载',()=>{
 for(const [name,index] of [['swift-low',0],['swift-high',2],['swift-super',3],['remote-control',12],['rush',13],['luck',14]] as const){
  const path=`fate-domination/cards/${name}`;
  expect(fateCardPreview(path)).toEqual({type:'atlas',atlasId:'fate-basic-attacks',index});
  expect(fateCardImageAsset(path)).toBe('fate-domination/cards/basic-attack-atlas');
 }
 expect(fateCardPreview('fate-domination/cards/avenger')).toEqual({type:'image',src:'fate-domination/cards/avenger'});
});

it('魔术基础攻击与力量超高位共用正式攻击图集帧和预加载图',()=>{
 const frames=[
  ['attack-magic-low',4],
  ['attack-magic-mid',5],
  ['attack-magic-high',6],
  ['attack-magic-super',7],
  ['attack-strength-super',11],
 ] as const;
 for(const [name,index] of frames){
  const path=`fate-domination/cards/${name}`;
  expect(fateCardPreview(path)).toEqual({type:'atlas',atlasId:'fate-basic-attacks',index});
  expect(fateCardImageAsset(path)).toBe('fate-domination/cards/basic-attack-atlas');
 }
 expect(FATE_ATTACK_CARDS.filter(card=>['cardA1','cardA2','cardA3','cardA4','cardB4'].includes(card.id)).map(card=>fateCardPreview(card.assetPath))).toEqual(
  frames.map(([,index])=>({type:'atlas',atlasId:'fate-basic-attacks',index})),
 );
});

it('当前 33 张牌目录不包含旧 fallback 技能卡',()=>{
 expect(FATE_ATTACK_CARDS).toHaveLength(33);
 expect(FATE_ATTACK_CARDS.map(card=>card.id)).not.toEqual(expect.arrayContaining(['cardFumble','cardMoment','cardInstant','cardUnknownSkill']));
 expect(FATE_ATTACK_CARDS.map(card=>card.assetPath)).not.toEqual(expect.arrayContaining([
  'fate-domination/cards/skill-fumble','fate-domination/cards/skill-instant-move',
  'fate-domination/cards/skill-moment','fate-domination/cards/skill-unknown',
 ]));
});

it('迅捷三点牌采用原始图集的高速移动名称与帧',()=>{
 const card=FATE_ATTACK_BY_ID.cardQ2;
 expect({name:card.name,cost:card.cost,power:card.power,type:card.type}).toEqual({name:'高速移动',cost:0,power:3,type:'迅捷'});
 expect(fateCardPreview(card.assetPath)).toEqual({type:'atlas',atlasId:'fate-basic-attacks',index:1});
});
