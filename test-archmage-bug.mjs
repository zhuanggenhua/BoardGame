// 临时测试脚本：验证大法师从弃牌堆打出时的触发器行为

import { readFileSync } from 'fs';

// 读取用户提供的状态快照
const stateJson = `{"players":{"0":{"id":"0","vp":2,"hand":[{"uid":"c18","defId":"frankenstein_uberserum","type":"action","owner":"0"},{"uid":"c29","defId":"werewolf_loup_garou","type":"minion","owner":"0"},{"uid":"c9","defId":"frankenstein_the_monster","type":"minion","owner":"0"},{"uid":"c14","defId":"frankenstein_its_alive","type":"action","owner":"0"},{"uid":"c35","defId":"werewolf_chew_toy","type":"action","owner":"0"},{"uid":"c33","defId":"werewolf_frenzy","type":"action","owner":"0"},{"uid":"c26","defId":"werewolf_teenage_wolf","type":"minion","owner":"0"},{"uid":"c12","defId":"frankenstein_jolt","type":"action","owner":"0"},{"uid":"c25","defId":"werewolf_teenage_wolf","type":"minion","owner":"0"},{"uid":"c17","defId":"frankenstein_body_shop","type":"action","owner":"0"}],"deck":[],"discard":[],"minionsPlayed":0,"minionLimit":1,"actionsPlayed":0,"actionLimit":1,"factions":["frankenstein","werewolves"],"sameNameMinionDefId":null},"1":{"id":"1","vp":3,"hand":[{"uid":"c54","defId":"wizard_summon","type":"action","owner":"1"},{"uid":"c60","defId":"wizard_winds_of_change","type":"action","owner":"1"},{"uid":"c76","defId":"zombie_theyre_coming_to_get_you","type":"action","owner":"1"},{"uid":"c77","defId":"zombie_not_enough_bullets","type":"action","owner":"1"},{"uid":"c53","defId":"wizard_mystic_studies","type":"action","owner":"1"},{"uid":"c80","defId":"zombie_mall_crawl","type":"action","owner":"1"},{"uid":"c74","defId":"zombie_lend_a_hand","type":"action","owner":"1"},{"uid":"c42","defId":"wizard_chronomage","type":"minion","owner":"1"},{"uid":"c79","defId":"zombie_mall_crawl","type":"action","owner":"1"}],"deck":[],"discard":[{"uid":"c66","defId":"zombie_tenacious_z","type":"minion","owner":"1"},{"uid":"c78","defId":"zombie_outbreak","type":"action","owner":"1"},{"uid":"c55","defId":"wizard_summon","type":"action","owner":"1"},{"uid":"c68","defId":"zombie_walker","type":"minion","owner":"1"},{"uid":"c67","defId":"zombie_walker","type":"minion","owner":"1"},{"uid":"c72","defId":"zombie_they_keep_coming","type":"action","owner":"1"}],"minionsPlayed":4,"minionLimit":2,"actionsPlayed":1,"actionLimit":1,"factions":["wizards","zombies"],"sameNameMinionDefId":null,"minionsPlayedPerBase":{"0":2,"1":1,"2":1}}},"turnOrder":["0","1"],"currentPlayerIndex":1,"bases":[{"defId":"base_laboratorium","minions":[{"uid":"c47","defId":"wizard_neophyte","controller":"1","owner":"1","basePower":2,"powerCounters":0,"powerModifier":0,"tempPowerModifier":0,"talentUsed":false,"playedThisTurn":true,"attachedActions":[]},{"uid":"c41","defId":"wizard_archmage","controller":"1","owner":"1","basePower":4,"powerCounters":1,"powerModifier":0,"tempPowerModifier":0,"talentUsed":false,"playedThisTurn":true,"attachedActions":[]}],"ongoingActions":[]},{"defId":"base_rhodes_plaza","minions":[{"uid":"c24","defId":"werewolf_howler","controller":"0","owner":"0","basePower":2,"powerCounters":0,"powerModifier":0,"tempPowerModifier":0,"talentUsed":false,"attachedActions":[]},{"uid":"c23","defId":"werewolf_howler","controller":"0","owner":"0","basePower":2,"powerCounters":1,"powerModifier":0,"tempPowerModifier":0,"talentUsed":false,"attachedActions":[]},{"uid":"c48","defId":"wizard_neophyte","controller":"1","owner":"1","basePower":2,"powerCounters":0,"powerModifier":0,"tempPowerModifier":0,"talentUsed":false,"attachedActions":[]},{"uid":"c61","defId":"zombie_lord","controller":"1","owner":"1","basePower":5,"powerCounters":0,"powerModifier":0,"tempPowerModifier":0,"talentUsed":false,"playedThisTurn":true,"attachedActions":[]}],"ongoingActions":[]},{"defId":"base_haunted_house","minions":[{"uid":"c65","defId":"zombie_tenacious_z","controller":"1","owner":"1","basePower":2,"powerCounters":0,"powerModifier":0,"tempPowerModifier":0,"talentUsed":false,"playedThisTurn":true,"attachedActions":[]}],"ongoingActions":[]}],"baseDeck":["base_great_library","base_golem_schloss","base_moot_site","base_standing_stones"],"turnNumber":6,"nextUid":81,"turnDestroyedMinions":[]}`;

const state = JSON.parse(stateJson);

console.log('=== 状态分析 ===');
console.log('P1 当前行动额度:', state.players['1'].actionLimit);
console.log('P1 已打出行动数:', state.players['1'].actionsPlayed);
console.log('P1 已打出随从数:', state.players['1'].minionsPlayed);
console.log('P1 随从额度:', state.players['1'].minionLimit);

console.log('\n=== 基地 0 (Laboratorium) 上的随从 ===');
state.bases[0].minions.forEach(m => {
    console.log(`- ${m.defId} (uid: ${m.uid}), playedThisTurn: ${m.playedThisTurn}`);
});

console.log('\n=== 问题分析 ===');
console.log('大法师 (wizard_archmage) 在基地 0 上');
console.log('大法师的 onMinionPlayed 触发器应该在打出时触发');
console.log('但用户报告说从弃牌堆打出时没有触发');
console.log('预期：actionLimit 应该从 1 增加到 2');
console.log('实际：actionLimit 仍然是 1');
