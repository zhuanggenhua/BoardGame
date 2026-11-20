// 旧同屏证据只读解析。正式 Fate 对局由 e2e/fate-domination 的在线房间用例验收。
if (require.main === module) {
  throw new Error('Fate 同屏取证入口已退役。请使用正式在线房间 /play/fate-domination/match/<matchId> 运行验收。');
}

const EXPECTED_PLAYERS = Number(process.env.FATE_EXPECTED_PLAYERS || 7);

const isPlayerInput = command => /^(?:NEXT$|CLICKTEXT |CLICKEXACT |CLICK |SELECT |PRESS |MOVE |DRAG |WHEEL |RELOAD$)/.test(command);
function pendingInputChecks(command, step) {
  if (!isPlayerInput(command) || !step) return [];
  return ['visible','authoritative'].filter(scope => !step.assertions.some(assertion =>
    assertion.path?.[0] === 'after' && assertion.path?.[1] === scope &&
    require('node:util').isDeepStrictEqual(assertion.actual, assertion.expected)));
}
// Narrow before-action test oracle for the primary control; settlement/choices stay explicit.
function nextPrimaryExpectation(before, primaryName) {
  const actor=before.currentPlayerId, player=before.players[actor], order=before.turnOrder;
  if(!player || player.eliminated || !Array.isArray(order) || before.pendingChoice)return null;
  const expectedName=before.phase==='preparation'?'完成准备':before.phase==='outpost'?'结束我的前哨阶段':before.phase==='battle'?'结束我的战斗阶段':before.phase==='action'?(player.selectedAttackIds.length?'确认攻击':'结束行动'):undefined;
  if(primaryName!==undefined&&primaryName!==expectedName)return null;
  if(['preparation','outpost'].includes(before.phase) || (before.phase==='battle'&&!before.battleResolution)){
    const next=order.find(id=>!before.players[id].eliminated&&id!==actor&&!before.phaseCompletedPlayerIds.includes(id));
    if(next)return {phase:before.phase,currentPlayerId:next};
    if(before.phase==='battle')return {phase:'battle',currentPlayerId:actor,resolutionStep:'locations'};
    return {phase:before.phase==='preparation'?'outpost':'action',currentPlayerId:order.find(id=>!before.players[id].eliminated)};
  }
  if(before.phase!=='action')return null;
  if(player.selectedAttackIds.length){
    if(player.selectedAttackIds.length!==2)return null;
    return {phase:'action',currentPlayerId:actor,playerChanges:{
      selectedAttackIds:[],selectedFaceDownIds:[],normalAttackPlayed:true,
      activeAttackIds:[...player.activeAttackIds,...player.selectedAttackIds.filter(id=>player.handIds.includes(id))],
      activeSkills:[...player.activeSkills,...player.selectedAttackIds.filter(id=>!player.handIds.includes(id))],
    }};
  }
  const active=order.filter(id=>before.players[id].locationId&&!before.players[id].eliminated);
  const next=active.find(id=>id!==actor&&!before.players[id].hasPassedAction);
  return {phase:next?'action':'battle',currentPlayerId:next??active[0],playerChanges:{hasPassedAction:true}};
}

const compactState = state => {
  const c = state?.core || state || {};
  const source = c.players;
  const entries = Array.isArray(source)
    ? source.map((p, i) => [String(p?.id ?? c.playerIds?.[i] ?? i), p])
    : Object.entries(source || {});
  const players = Object.fromEntries(entries.map(([id, p]) => [String(id), {
    masterId: p?.masterId ?? null,
    servantId: p?.servantId ?? null,
    locationId: p?.locationId ?? null,
    mana: p?.mana ?? null, commandSpells:p?.commandSpells??null, eliminated:p?.eliminated??false, normalAttackPlayed:p?.normalAttackPlayed??false,
    victoryPoints: p?.victoryPoints ?? null,
    handIds: Array.isArray(p?.hand) ? p.hand.map(x => x?.id ?? x?.cardId ?? null) : [],
    handCount: Array.isArray(p?.hand) ? p.hand.length : null,
    selectedAttackIds: p?.selectedAttackIds ?? [],
    selectedFaceDownIds: p?.selectedFaceDownIds ?? [],
    activeAttackIds: p?.activeAttackIds ?? [],
    activeSkills: p?.activeSkills ?? [],
    hasPassedAction: p?.hasPassedAction ?? false,
    discardIds: Array.isArray(p?.discard) ? p.discard.map(x => x?.id ?? x?.cardId ?? null) : [],
    deckCount: Array.isArray(p?.deck) ? p.deck.length : null,
  }]));
  return {
    gameId: c.gameId ?? null,
    round:c.round ?? null, gameOver:Boolean(state?.sys?.gameover), gameResult:c.gameResult ?? null, systemGameResult:state?.sys?.gameover??null,
    phase: c.phase ?? null,
    currentPlayerId: c.currentPlayerId ?? null,
    turnOrder: c.turnOrder ?? [],
    phaseCompletedPlayerIds: c.phaseCompletedPlayerIds ?? [],
    playerIds: c.playerIds ?? Object.keys(players),
    pendingChoice:state?.sys?.interaction?.current ? {id:state.sys.interaction.current.id,playerId:state.sys.interaction.current.playerId} : null,
    actionCount: c.actionCount ?? null,
    players,
    miyamaPlayerIds: c.battlefield?.miyama?.playerIds ?? null,
  };
};


// Read the product-owned persisted snapshot for this exact natural local match.
// No harness, dispatch, state injection, storage write or replacement path exists.
function readPersistedSnapshot(expectedUrl) {
  const expected=new URL(expectedUrl), current=new URL(location.href), seed=expected.searchParams.get('seed');
  if(current.origin!==expected.origin||current.pathname!==expected.pathname||current.searchParams.get('seed')!==seed||current.searchParams.has('playerID'))throw new Error('Capture navigated outside its original match identity');
  const raw=localStorage.getItem('local_match_snapshot_v1:fate-domination:'+seed);
  if(!raw)return null;
  const snapshot=JSON.parse(raw);
  if(snapshot.version!==1||snapshot.gameId!=='fate-domination'||snapshot.seed!==seed||!snapshot.state?.core||!snapshot.state?.sys)return null;
  const isVisible=el=>{const r=el.getBoundingClientRect(),style=getComputedStyle(el);return r.width>0&&r.height>0&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0;};
  const terminal=document.querySelector('[data-testid="endgame-overlay"]');
  const stats=Array.from(document.querySelectorAll('.fd-self-stats b')).map(el=>Number(el.textContent));
  const phaseText=document.querySelector('.fd-runtime-round')?.textContent||'';
  const visible={text:document.body.innerText,gameOver:Boolean(terminal&&isVisible(terminal)),phaseText,round:Number(phaseText.match(/第\s*(\d+)\s*回合/)?.[1]),selfLabel:document.querySelector('.fd-self-identity')?.getAttribute('aria-label'),mana:stats[0],victoryPoints:stats[1],controls:Array.from(document.querySelectorAll('button,select')).filter(isVisible).map(el=>({name:el.getAttribute('aria-label')||el.innerText,disabled:Boolean(el.disabled),ariaDisabled:el.getAttribute('aria-disabled')}))};
  return {snapshot,visible};
}
function validateSample(sample){
  const snapshot=sample?.snapshot;
  if(!snapshot||snapshot.state.core.gameId!=='fate-domination'||!Number.isInteger(snapshot.state.core.round)||typeof snapshot.state.core.phase!=='string'||!snapshot.state.core.currentPlayerId||snapshot.numPlayers!==EXPECTED_PLAYERS)throw new Error('Valid authoritative persisted state missing; stop capture');
  return sample;
}

module.exports={readPersistedSnapshot,validateSample,compactState,pendingInputChecks,nextPrimaryExpectation};
