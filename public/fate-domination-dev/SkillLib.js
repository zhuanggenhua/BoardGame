// ====== SkillLib.js ======
// 存放游戏的所有动态技能钩子与判定逻辑

const SkillLib = {
    "左齿啮咬&右齿啮咬": {
        onAction: (p) => {
            if (p.location === "深山町" || p.location === "新都") {
                let pids = State.deployments[p.location] || [];
                if (pids.length > 1) {
                    Engine.drawCards(p, 2);
                    Engine.log(`【双牙】战场存在对手，抽2张牌。`,"var(--vp)");
                } else {
                    Engine.addMana(p, 4); Engine.log(`【双牙】独自在战场，获得 4 魔力。`,"var(--mana)");
                }
            } else { Engine.log(`【双牙】未在战场，无特殊效果。`,"#aaa"); }
        }
    },
    "伪写记载之万象": {
        onAction: (p) => {
            p.vergAvestaActive = true;
            Engine.log(`【伪写记载之万象】已激活，将在战斗后弃牌并准备复仇！`, "var(--red)");
        },
        onCombatEnd: (pt, winners, all, gl) => {
            if (pt.ply.vergAvestaActive) {
                let discardCount = Math.min(4, pt.ply.hand.length);
                let discardedAvengers = 0;
                for(let i=0; i<discardCount; i++) {
                    let c = pt.ply.hand.pop();
                    pt.ply.discard.push(c);
                    if(DB.cards[c] && DB.cards[c].name === "复仇者") discardedAvengers++;
                }
                gl.push(`<div class="report-line"><span>✨ 伪写记载之万象</span> <span>弃置了 ${discardCount} 张牌，包含 ${discardedAvengers} 张复仇者</span></div>`);
                
                let isWin = winners.some(w => w.id === pt.id);
                if (!isWin && discardedAvengers > 0 && winners.length > 0) {
                    let targetWinner = winners[Math.floor(Math.random() * winners.length)]; 
                    let stealAmt = discardedAvengers * 2;
                    let actualStolen = Math.min(stealAmt, targetWinner.ply.vp);
                    targetWinner.ply.vp = Math.max(0, targetWinner.ply.vp - stealAmt);
                    pt.ply.vp += actualStolen;
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>🩸 恶之报现</span> <span>从 ${targetWinner.ply.master.name} 处偷取 ${actualStolen} 战果！</span></div>`);
                }
                pt.ply.vergAvestaActive = false;
            }
        }
    },
    "永世束缚": {
        onAction: (p) => {
            let avengersInDiscard = p.discard.filter(c => DB.cards[c] && DB.cards[c].name === "复仇者");
            p.discard = p.discard.filter(c => !(DB.cards[c] && DB.cards[c].name === "复仇者"));
            
            if (p.defeatedLastRound) {
                avengersInDiscard.forEach(c => {
                    p.hand.push(c);
                    State.selectedCardIndices.push(p.hand.length - 1);
                });
                Engine.log(`【永世束缚】将弃牌堆的 ${avengersInDiscard.length} 张【复仇者】直接加入攻击！`, "var(--red)");
            } else {
                avengersInDiscard.forEach(c => p.hand.push(c));
                Engine.log(`【永世束缚】将弃牌堆的 ${avengersInDiscard.length} 张【复仇者】加入手牌。`, "var(--gold)");
            }
        }
    },
    "起源弹": {
        onCombatStart: (pt, all, loc, gl) => {
            let opps = all.filter(o => o.id !== pt.id);
            if(opps.length === 0) return;
            let resolve = (target) => {
                let lost = Math.ceil(target.ply.mana / 3);
                let actualLost = Math.min(target.ply.mana, lost);
                target.ply.mana -= actualLost;
                pt.originBulletBonus = (pt.originBulletBonus || 0) + actualLost * 2;
                gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ 起源弹</span> <span>${target.ply.master.name} 失去 ${actualLost} 魔力（当前魔力${target.ply.mana+actualLost}的三分之一），威力+${actualLost*2}</span></div>`);
            };
            if(pt.ply.isPlayer && pt.ply.id===Network.myPlayerId) {
                Interaction.choosePlayer("【起源弹】请选择目标", opps.map(o => o.ply), i => resolve(opps[i]), () => {});
                return;
            }
            resolve(opps[Math.floor(Math.random()*opps.length)]);
        },
        onCombatCalc: (pt, all, gl) => {
            if (pt.originBulletBonus) {
                pt.p += pt.originBulletBonus;
                pt.tags.push(`<span style="color:var(--vp);">[起源弹(+${pt.originBulletBonus})]</span>`);
            }
        }
    },
    "火炎弹": {
        onCombatStart: (pt, all, loc, gl) => {
            all.forEach(op => {
                if (op.id !== pt.id) {
                    op.ply.burnTokens = (op.ply.burnTokens || 0) + 1;
                }
            });
            gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ 火炎弹</span> <span>交战对手获得1枚【燃烧】标记</span></div>`);
        }
    },
    "伪·螺旋剑": {
        onAction: (p) => { p.diliMultiplier = 3; },
        onCombatWin: (pt, winners, all, gl) => { pt.ply.vp += 4; gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (伪·螺旋剑)</span> <span>+4 战果</span></div>`); }
    },
    "无限剑制": {
        onAction: (p) => {
            let allCards = [...p.hand, ...p.deck, ...p.discard];
            let shuffled = window.shuffleArray([...allCards]);
            let newHand = shuffled.slice(0, Math.min(12, shuffled.length));
            let remaining = shuffled.slice(newHand.length);
            
            p.hand = newHand;
            p.deck = [];
            p.discard = remaining;
            p.ubwActive = true;
            
            Engine.log(`【无限剑制】展开！随机重组手牌为${p.hand.length}张！`,"var(--vp)");
        }
    },
    "单独行动": {
        onAction: (p) => { p.vp+=3; Engine.log(`【单独行动】获得 3 战果。`,"var(--vp)"); }
    },
    "穿刺死棘之枪": {
        onAction: (p, sc) => { sc.cost+=2; Engine.log(`【死棘】魔耗增至 ${sc.cost}！`,"var(--red)"); },
        onCombatStart: (pt, all, loc, gl) => { if(all.length===2) { let opp=all.find(x=>x.id!==pt.id); if(opp) opp.gaeBolgDefeated=true; } }
    },
    "自我改造": {
        onAction: (p) => { p.isRevealed=false; p.vp+=2; Engine.log(`【自我改造】真名隐藏，获得2战果！`,"var(--vp)"); }
    },
    "骑乘": {
        onAction: (p, sc, ctx) => {
            let hasBasic=ctx.cards.some(cid=>{let c=Engine.getCardData(cid); return c&&c.cost===0&&(c.type==="力量"||c.type==="迅捷"||c.type==="魔法");});
            if(hasBasic){ Engine.drawCards(p, 1); Engine.log(`【骑乘】抽了一张牌。`,"var(--vp)"); }
        }
    },
    "神威车轮": {
        onAction: (p) => {
            if(p.location==="深山町"||p.location==="新都"){
                let lk = p.location==="深山町"?"miyama":"shinto";
                if(State.currentEvents[lk].length > 0) {
                    let oe = State.currentEvents[lk].pop();
                    State.eventDeck.push(oe); State.eventDeck=window.shuffleArray(State.eventDeck);
                    State.currentEvents[lk].push(...Engine.drawEventCards(1,{revealLocation:p.location}));
                    Engine.log(`【神威车轮】替换了${p.location}的事件！`,"var(--vp)");
                }
            }
        }
    },
    "骑英之缰绳": {
        onAction: (p) => {
            let locs = ['魔术工房','深山町','新都','侦察'];
            let resolve = (tLoc) => {
                if(!locs.includes(tLoc)) return;
                if(p.location && State.deployments[p.location]){
                    let oldIndex = State.deployments[p.location].indexOf(p.id);
                    if(oldIndex > -1) State.deployments[p.location].splice(oldIndex,1);
                }
                p.location=tLoc;
                if(!State.deployments[tLoc]) State.deployments[tLoc]=[];
                if(!State.deployments[tLoc].includes(p.id)) State.deployments[tLoc].push(p.id);
                Engine.log(`【骑英】飞跃至【${tLoc}】！`,"var(--vp)");
                UI.updateAll();
                UI.updateMapUI();
                Network.sync();
            };
            if(p.isPlayer && p.id===Network.myPlayerId){
                Interaction.chooseLocation("【骑英之缰绳】选择移动地点", locs, i => resolve(locs[i]), () => {});
                return;
            }
            resolve(locs[Math.floor(Math.random() * locs.length)]);
        }
    },
    "万符必应破戒": {
        onAction: (p, sc, ctx) => {
            let locArr = (p.location && State.deployments[p.location]) ? State.deployments[p.location] : [];
            let opps = locArr.filter(id => id !== p.id);
            if(opps.length > 0){
                let resolve = (target) => {
                    if (!target) return;
                    let origCs = target.commandSpells;
                    target.commandSpells = Math.max(0, target.commandSpells - 1);
                    if(origCs <= 1) target.ruleBreakerDefeated = true;
                    if(origCs === 0) p.ruleBreakerBonus = 10;
                    Engine.log(`🗡️ 【破戒】刺中 ${target.master.name}！`,"var(--red)");
                    UI.updateAll();
                    Network.sync();
                };
                if (p.isPlayer && p.id===Network.myPlayerId) {
                    let targets = opps.map(id => getPlayer(id));
                    Interaction.choosePlayer("【破戒】选择目标", targets, i => resolve(targets[i]), () => {});
                    return;
                }
                resolve(getPlayer(opps[Math.floor(Math.random() * opps.length)]));
            } else {
                Engine.log(`🗡️ 【破戒】当前地点无对手可选择！`, "#aaa");
            }
        }
    },
    "螺湮城教本(水魔)": {
        onAction: (p, sc, ctx) => {
            if(ctx.cards.some(cid=>Engine.getCardData(cid)&&Engine.getCardData(cid).type.includes("魔"))){
                Engine.drawCards(p, 1); Engine.log(`【水魔】抽了一张牌。`,"var(--mana)");
            }
        }
    },
    "螺湮城教本(海魔)": {
        onAction: (p) => { State.gillesMonsterLoc=p.location; Engine.log(`🐙 【海魔】降临于 ${p.location}！`,"var(--red)"); }
    },
    "一之太刀": {
        onCombatStart: (pt, all, loc, gl) => {
            let bIdx=pt.ply.hand.findIndex(cid=>Engine.getCardData(cid)&&Engine.getCardData(cid).type.includes("力量"));
            if(bIdx>-1){
                pt.cards.push(pt.ply.hand.splice(bIdx,1)[0]); Engine.addMana(pt.ply, 2);
                gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ 一之太刀</span> <span>追加力量牌,回2魔</span></div>`);
                let opps=all.filter(op=>op.id!==pt.id);
                if(opps.length>0){
                    let tOpp = opps.reduce((a,b)=> Math.max(...a.cards.map(c=>(DB.cards[c]&&DB.cards[c].cost===0?DB.cards[c].power:0))) > Math.max(...b.cards.map(c=>(DB.cards[c]&&DB.cards[c].cost===0?DB.cards[c].power:0))) ? a : b );
                    let maxBasicPwr = Math.max(...tOpp.cards.map(c=>(DB.cards[c]&&DB.cards[c].cost===0?DB.cards[c].power:0)));
                    let rmvIdx = tOpp.cards.findIndex(c=>DB.cards[c]&&DB.cards[c].cost===0&&DB.cards[c].power===maxBasicPwr);
                    if(rmvIdx>-1){ tOpp.ply.discard.push(tOpp.cards.splice(rmvIdx,1)[0]); gl.push(`<div class="report-line"><span>✨ 一之太刀</span> <span>击落了 ${tOpp.ply.master.name} 的基础攻击</span></div>`); }
                }
            }
        }
    },
    "破魔的红蔷薇": {
        onCombatStart: () => {}
    },
    "誓约胜利之剑": {
        onCombatCalc: (pt) => { if(State.day>=9){ pt.p+=4; pt.tags.push(`<span style="color:var(--vp);">[Excalibur(+4)]</span>`); } }
    },
    "三之太刀": {
        onCombatCalc: (pt, all, gl) => {
            if(pt.servantSkills.some(i=>pt.ply.servant.skillCards[i]&&pt.ply.servant.skillCards[i].name==="一之太刀") && pt.servantSkills.some(i=>pt.ply.servant.skillCards[i]&&pt.ply.servant.skillCards[i].name==="二之太刀")){
                pt.p+=3; pt.ply.isRevealed=true; pt.tags.push(`<span style="color:var(--gold);">[燕返(+3)]</span>`);
            }
        }
    },
    "十二试炼": {
        onCombatCalc: (pt) => {
            if(pt.ply.godHandBuff){ pt.p += pt.ply.godHandBuff; pt.tags.push(`<span style="color:var(--vp);">[十二试炼(+${pt.ply.godHandBuff})]</span>`); }
        },
        onCombatLose: (pt, winners, all, gl) => {
            pt.ply.vp += 3; winners.forEach(w => w.ply.vp = Math.max(0, w.ply.vp-3));
            pt.ply.godHandBuff = (pt.ply.godHandBuff || 0) + 3;
            let sIdx = pt.ply.servant.skillCards.findIndex(s=>s.name==="十二试炼"); if(sIdx>-1) pt.ply.servant.skillCards.splice(sIdx, 1);
            pt.dead = false; pt.godHandRevived = true;
            gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} 触发十二试炼！</span> <span>复活吸血(+3)</span></div>`);
        }
    },
	"无穷的武练": {
        onCombatCalc: (pt, all) => {
            if(!pt.dead) {
                let highest = 0; let isMine = false;
                all.forEach(op => {
                    op.cards.forEach(cid => {
                        let c = Engine.getCardData(cid);
                        // 在此处排除了带有“残留”描述的卡牌（例如海魔）
                        if(c && (c.type.includes("力量") || c.type.includes("迅捷")) && !(c.desc && c.desc.includes("残留"))) {
                            if(c.power > highest) { highest = c.power; isMine = (op.id === pt.id); }
                        }
                    });
                });
                if(highest > 0) {
                    let bonus = highest + (isMine?3:0); pt.p += bonus;
                    pt.tags.push(`<span style="color:var(--vp);">[武练复制(+${bonus})]</span>`);
                }
            }
        }
    },
	"不为一己之荣光": {
        onAction: (p) => {
            let targets = Object.keys(SkillLib).filter(name => name !== "不为一己之荣光");
            let resolve = target => {
                if(!target || !targets.includes(target)) return;
                if(p.master.id === "m_zouken"){
                    if(p.mana < 4){ if(p.isPlayer && p.id===Network.myPlayerId) alert("魔力不足4点代替令咒！"); return; }
                    p.mana -= 4;
                    if(!p.isRevealed) {
                        p.isRevealed = true;
                        Engine.log(`【荣光】间桐脏砚消耗4点魔力，狂战士真名强制解放！`, "var(--gold)");
                    }
                } else {
                    if(p.commandSpells < 1){ if(p.isPlayer && p.id===Network.myPlayerId) alert("令咒不足！"); return; }
                    p.commandSpells--; p.usedCSThisTurn = true;
                }
                p.lancelotCopied = target;
                Engine.log(`【荣光】化身为 ${target}！`, "var(--gold)");
            };
            if(p.isPlayer && p.id===Network.myPlayerId){
                Interaction.choose(
                    "【荣光】选择要复制的技能",
                    targets,
                    i => resolve(targets[i]),
                    () => {}
                );
                return;
            }
            resolve("王之军势");
        }
    },
    "必灭的黄蔷薇": {
        onCombatWin: (pt, winners, all, gl) => {
            all.forEach(op => {
                if(!winners.some(w=>w.id===op.id)){
                    let activeSkills=new Set((op.servantSkills||[]).map(idx=>op.ply.servant.skillCards[idx]).filter(Boolean));
                    op.ply.sealedSkills=op.ply.sealedSkills||[];
                    let avail=op.ply.servant.skillCards.filter(sk=>!activeSkills.has(sk)&&!op.ply.sealedSkills.some(entry=>(entry.skillId&&sk.id&&entry.skillId===sk.id)||(!entry.skillId&&entry.skillName===sk.name)));
                    if(avail.length>0){
                        let sSk=avail[Math.floor(Math.random()*avail.length)];
                        op.ply.sealedSkills.push({skillId:sSk.id||null,skillName:sSk.name,sealerId:pt.id});
                        gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${op.ply.master.name} 被黄蔷薇刺中！</span> <span>【${sSk.name}】遭封印</span></div>`);
                    }
                }
            });
        }
    },
    "妄想心音": {
        onCombatWin: (pt, winners, all, gl, finalVp) => {
            let hasRealOpponent = all.some(op => op.id !== pt.id);
            if (hasRealOpponent) {
                pt.ply.vp += finalVp; 
                gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (妄想心音)</span> <span>战果翻倍(+${finalVp})</span></div>`);
            } else {
                gl.push(`<div class="report-line" style="color:#aaa;"><span>💨 ${pt.ply.master.name} (妄想心音)</span> <span>无人交战，未能翻倍战果</span></div>`);
            }
            
            if(State.players.filter(p=>p.isAlive).length===2) { 
                all.forEach(op=>{if(op.id!==pt.id) op.zabaniyaDefeated=true;}); 
            }
        }
    },
    // 修改后 (正确的写法)
    "突穿死翔之枪": {
        onCombatEnd: (pt, winners, all, gl) => {
            let oppCount = all.length-1; if(oppCount>0){
                pt.ply.vp += oppCount; gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (死翔之枪)</span> <span>+${oppCount} 战果</span></div>`);
                if(winners.some(w=>w.id===pt.id)){ all.forEach(op=>{if(op.id!==pt.id){ op.ply.vp-=oppCount; gl.push(`<div class="report-line" style="color:var(--red);"><span>🩸 ${op.ply.master.name} 被死翔波及</span> <span>-${oppCount} 战果</span></div>`); }}); }
            }
        }
    },
    "气息遮断": { 
        onCombatCalc: (pt, all, gl) => {
            if(all.length >= 3){
    // ...
                let maxP = Math.max(...all.map(x=>x.p));
                if(pt.p < maxP && !all.some(x=>x.p>pt.p && x.p<maxP)){
                    all.filter(x=>x.p===maxP).forEach(x=>x.assassinated=true);
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (气息遮断)</span> <span>暗杀了最高战力！</span></div>`);
                }
            }
        }
    },
    "神言魔术式": {
        onCombatLose: (pt, winners, all, gl) => {
            let rb={id:"sc_medea_np",name:"万符必应破戒",cost:3,req:3,power:0,type:"力量/宝具",desc:"【真名解放】<每局游戏限一次>\n行动阶段：你所在战场的一名玩家失去一枚令咒，若其原本只有一枚或更少的令咒，另其【败北】。若其原本没有令咒，你总威力+10。"};
            pt.ply.servant.skillCards.push(rb); gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ 神言魔术式</span> <span>回收【万符必应破戒】</span></div>`);
        }
    },
    // ====== 巴泽特·弗拉加·马克雷米兹 ======
    // Wiki: https://fatedomination.fandom.com/wiki/Fragarach
    // <每局游戏限一次> 先发后至：下一次一名与你位于同一战场的对手使用宝具时，令其【败北】。
    "佛拉格拉克": {
        onCombatStart: (pt, all, loc, gl) => {
            let ply = pt.ply;
            // 第二天：不限一次；其他日子：已用过则不触发
            if (ply.bazettFragarachUsed && ply.bazettDay !== 2) return;
            // 查找交战对手中使用了宝具的玩家
            let opps = all.filter(o => o.id !== pt.id);
            let target = opps.find(o =>
                o.servantSkills.some(si => {
                    let sk = o.ply.servant.skillCards[si];
                    return sk && sk.type && sk.type.includes("宝具");
                })
            );
            if (target) {
                // 标记为已使用（第二天除外；升华技【无懈可击】解锁后失去<每局游戏限一次>）
                if (ply.bazettDay !== 2 && !ply.ascensionUnlocked) {
                    ply.bazettFragarachUsed = true;
                }
                target.fragarachDefeated = true;
                gl.push(`<div class="report-line" style="color:var(--red);"><span>⚔ 佛拉格拉克·先发后至！</span> <span>${target.ply.master.name} 被击败！</span></div>`);
            } else {
                gl.push(`<div class="report-line" style="color:#aaa;"><span>⚔ 佛拉格拉克</span> <span>未发现使用宝具的对手，效果未触发</span></div>`);
            }
        }
    },
    // ====== 批次从者·职阶通用技能 ======
    // 骑乘（Rider Class）：与基础攻击一同打出时抽1张牌（与"骑乘"同逻辑）
    "骑乘（Rider Class）": {
        onAction: (p, sc, ctx) => {
            let hasBasic = ctx.cards.some(cid => { let c = Engine.getCardData(cid); return c && c.cost === 0 && (c.type === "力量" || c.type === "迅捷" || c.type === "魔法"); });
            if (hasBasic) { Engine.drawCards(p, 1); Engine.log(`【骑乘】抽了一张牌。`, "var(--vp)"); }
        }
    },
    // 气息遮断（Assassin Class）：刺杀最高战力（与"气息遮断"同逻辑）
    "气息遮断（Assassin Class）": {
        onCombatCalc: (pt, all, gl) => {
            if (all.length >= 3) {
                let maxP = Math.max(...all.map(x => x.p));
                if (pt.p < maxP && !all.some(x => x.p > pt.p && x.p < maxP)) {
                    all.filter(x => x.p === maxP).forEach(x => x.assassinated = true);
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (气息遮断)</span> <span>暗杀了最高战力！</span></div>`);
                }
            }
        }
    },
    // 单独行动（Archer Class）：行动阶段+3战果；败北-5战果由 index.html 结算
    "单独行动（Archer Class）": {
        onAction: (p) => { p.vp += 3; Engine.log(`【单独行动】获得 3 战果。`, "var(--vp)"); }
    },
    // 阵地建造 / 阵地建造（Caster Class）：残留-部署于魔术工房时获得1魔力2战果
    "阵地建造": {
        onAction: (p) => {
            if (p.location === "魔术工房") { Engine.addMana(p, 1); p.vp += 2; Engine.log(`【阵地建造】驻留魔术工房，获得1点魔力和2点战果。`, "var(--mana)"); }
            else Engine.log(`【阵地建造】未部署于魔术工房，无残留收益。`, "#aaa");
        }
    },
    "阵地建造（Caster Class）": {
        onAction: (p) => {
            if (p.location === "魔术工房") { Engine.addMana(p, 1); p.vp += 2; Engine.log(`【阵地建造】驻留魔术工房，获得1点魔力和2点战果。`, "var(--mana)"); }
            else Engine.log(`【阵地建造】未部署于魔术工房，无残留收益。`, "#aaa");
        }
    },
    // 领域外生命：真名解放，自身+6合计威力；梵高（创造者/降临者）若参战且非自己也+6
    // QA#64：因效果弃置的【领域外生命】不能回到创造他的降临者的弃牌堆（正常打出后战斗阶段结束加入梵高弃牌堆）
    "领域外生命": {
        onCombatCalc: (pt, all, gl) => {
            pt.p += 6; pt.tags.push(`<span style="color:var(--mana);">[领域外生命(+6)]</span>`);
            // 联动：同战场的梵高/降临者（非打出者自身）也+6（若打出者即梵高则不叠加）
            let isForeigner = (o) => o.ply.servant && (String(o.ply.servant.trueName || "").includes("梵高") || o.ply.servant.class === "Foreigner" || o.ply.jacquesForeignGod);
            let foreign = all.find(o => o.id !== pt.id && isForeigner(o));
            if(foreign){ foreign.p += 6; foreign.tags.push(`<span style="color:var(--mana);">[领域外生命·降临者联动(+6)]</span>`); }
            gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (领域外生命)</span> <span>合计威力+6${foreign ? "，降临者 " + foreign.ply.master.name + " 联动+6" : ""}（战斗阶段结束后此牌加入梵高的弃牌堆；因效果弃置时不回归，QA#64）</span></div>`);
        }
    },
    // 诚之旗：正面打出一张手牌后抽1张牌（简化为抽1）
    "诚之旗": {
        onAction: (p) => { Engine.drawCards(p, 1); Engine.log(`【诚之旗】打出军旗，抽一张牌。`, "var(--vp)"); }
    },
    // ====== 莎士比亚·魔力附加：角色颠倒-被动（从者为莎士比亚即解锁御主升华技，见 Engine.checkAscensionUnlock） ======
    "魔力附加": {
        onAction: (p) => {
            if (p.ascensionUnlocked) { Engine.log(`【角色颠倒】升华技已解锁（被动，游戏开始时生效）。`, "#aaa"); return; }
            Engine.checkAscensionUnlock();
            if (!p.ascensionUnlocked) Engine.log(`【角色颠倒】${p.master.name} 没有升华技。`, "#aaa");
        }
    }
};

// ====== 对魔力系列：宝具绽放（战斗中打出最高魔耗宝具者+1/+2战果） ======
(function(){
    const mrBloom = (pt, winners, all, gl) => {
        let best = { cost: -1, owner: null };
        all.forEach(o => {
            let c = (typeof State !== "undefined" && State.actionChoices) ? (State.actionChoices[o.id] || {cards:[],facedown:[]}) : {cards:[],facedown:[]};
            let upCards = [...(c.cards||[]), ...((o.ply.residualCards)||[])].filter(cid => !(c.facedown||[]).includes(cid));
            upCards.forEach(cid => { let cd = Engine.getCardData(cid); if (cd && cd.type && cd.type.includes("宝具")) { let cost = Number(cd.cost)||0; if (cost > best.cost) best = { cost: cost, owner: o.id }; } });
            (o.servantSkills||[]).forEach(sIdx => { let sk = o.ply.servant.skillCards[sIdx]; if (sk && sk.type && sk.type.includes("宝具")) { let cost = Number(sk.cost)||0; if (cost > best.cost) best = { cost: cost, owner: o.id }; } });
        });
        if (best.owner === pt.id && best.cost >= 0) {
            let gain = best.cost >= 4 ? 2 : 1;
            pt.ply.vp += gain;
            gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (宝具绽放)</span> <span>打出战斗中最高魔耗宝具(魔耗${best.cost})，+${gain} 战果</span></div>`);
        }
    };
    SkillLib["对魔力"] = { onCombatEnd: mrBloom };
    SkillLib["对魔力（saber class）"] = { onCombatEnd: mrBloom };
    SkillLib["对魔力（Saber class）"] = { onCombatEnd: mrBloom };
    SkillLib["对魔力（Saber Class）"] = { onCombatEnd: mrBloom };
})();

// ====== AutoSkillEngine：批次从者技能自动实现引擎 ======
// 原版从者技能已在 index.html 战斗计算中硬编码（风王结界/天地乖离/王之军势等）；
// 本引擎为批次从者（batch_*.js）的技能按 desc 文本自动生成效果钩子：
//   1. Manual 手工表（效果确定的代表技能）
//   2. parseTemplate 模板解析（常见数值/移动/压制模式）
//   3. fallback 提示型钩子（复杂独特机制，打出时提示按卡牌文本结算）
(function(){
    if (typeof DB === "undefined" || !DB.servants) return;

    const wrap = (fn) => function(){ try { return fn.apply(this, arguments); } catch(e) { console.warn("[AutoSkillEngine]", e); } };
    const cnNum = (s) => { const map = {"一":1,"二":2,"三":3,"四":4,"五":5,"六":6,"七":7,"八":8,"九":9,"十":10}; return map[s] || parseInt(s) || 0; };

    // 通用移动辅助（沿既有部署记录更新位置）
    function moveTo(p, loc, label){
        if(!p || !loc || !State.deployments[loc]) return false;
        if(p.location && State.deployments[p.location]) { let i = State.deployments[p.location].indexOf(p.id); if(i>-1) State.deployments[p.location].splice(i,1); }
        p.location = loc; State.deployments[loc].push(p.id);
        Engine.log(`【${label}】${p.master.name} 移动至【${loc}】。`, "var(--vp)");
        return true;
    }
    // 通用属性压制（明置卡中该属性威力记0 → 转为对手合计威力减益近似）
    function suppressAttr(pt, all, gl, attr, label){
        let opps = all.filter(o => o.id !== pt.id);
        opps.forEach(o => {
            let c = (typeof State !== "undefined" && State.actionChoices) ? (State.actionChoices[o.id] || {cards:[],facedown:[]}) : {cards:[],facedown:[]};
            let up = [...(c.cards||[]), ...((o.ply && o.ply.residualCards)||[])].filter(cid => !(c.facedown||[]).includes(cid));
            let hit = up.some(cid => { let cd = Engine.getCardData(cid); return cd && (cd.type||"").includes(attr); });
            if(hit){
                let ded = (o.attrSuppressed = o.attrSuppressed || {}); ded[attr] = true;
                o.pendingSuppression = (o.pendingSuppression||0) + 4;
                gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${label}</span> <span>${o.ply.master.name} 的${attr}属性攻击被压制</span></div>`);
            }
        });
    }
    // 通用【败北】：令对手败北（filter 可选筛选目标；mode="all" 全体 / "one" 随机一名 / "self" 含自己）
    function defeatOpp(pt, all, gl, label, filter, mode){
        let opps = all.filter(o => o.id !== pt.id).filter(o => !filter || filter(o));
        let targets = [];
        if(mode === "self"){ targets = all.filter(o => !filter || filter(o)); }
        else if(mode === "all"){ targets = opps; }
        else { targets = opps.length ? [opps[Math.floor(Math.random()*opps.length)]] : []; }
        targets.forEach(o => { o.autoDefeated = true; });
        if(targets.length) gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (${label})</span> <span>令 ${targets.map(o=>o.ply.master.name).join('、')} 【败北】</span></div>`);
        return targets;
    }
    // 通用对手减益：战果/魔力
    function oppLose(all, pt, gl, field, n, label){
        all.filter(o => o.id !== pt.id).forEach(o => {
            if(field === "vp") o.ply.vp = Math.max(0, o.ply.vp - n);
            else if(field === "mana") o.ply.mana = Math.max(0, o.ply.mana - n);
            else if(field === "power"){ o.p = Math.max(0, o.p - n); o.tags.push(`<span style="color:var(--red);">[${label}(-${n})]</span>`); }
        });
        gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (${label})</span> <span>所有交战对手 ${field==="vp"?"失去"+n+"点战果":(field==="mana"?"失去"+n+"点魔力":"合计威力-"+n)}</span></div>`);
    }
    // 通用激活费用（从 desc 中提取"花费N点魔力"，打出时自动扣除；魔力不足则跳过）
    function actCost(desc){ let m = desc.match(/花费\s*([一二三四五六七八九十\d]+)\s*点?魔/); return m ? cnNum(m[1]) : 0; }
    function payCost(p, n, label){ if(n <= 0) return true; if(p.mana < n){ Engine.log(`【${label}】魔力不足${n}点，效果未发动。`, "#aaa"); return false; } p.mana -= n; return true; }
    // 通用标记系统：获得/查询【XX】标记
    function addToken(p, token, n){ p.autoTokens = p.autoTokens || {}; p.autoTokens[token] = (p.autoTokens[token]||0) + n; return p.autoTokens[token]; }
    function getToken(p, token){ return ((p.autoTokens||{})[token]) || 0; }
    // 通用对手攻击筛选：对手明置卡中是否含某属性
    function oppHasAttr(o, attr){
        let c = (typeof State !== "undefined" && State.actionChoices) ? (State.actionChoices[o.id] || {cards:[],facedown:[]}) : {cards:[],facedown:[]};
        let up = [...(c.cards||[]), ...((o.ply && o.ply.residualCards)||[])].filter(cid => !(c.facedown||[]).includes(cid));
        return up.some(cid => { let cd = Engine.getCardData(cid); return cd && (cd.type||"").includes(attr); }) || (o.servantSkills||[]).some(i => { let sk = o.ply.servant.skillCards[i]; return sk && (sk.type||"").includes(attr); });
    }

    // ---------- 1. 手工实现表 ----------
    const Manual = {
        "战斗续行（Lancer Class）": { onAction: wrap((p) => { let locs = ['深山町','新都','侦察']; let resolve = loc => moveTo(p, locs.includes(loc) ? loc : "深山町", "战斗续行"); if(p.isPlayer && p.id===Network.myPlayerId){ Interaction.chooseLocation("【战斗续行】选择移动地点", locs, i => resolve(locs[i]), () => {}); return; } resolve(locs[Math.floor(Math.random()*locs.length)]); }) },
        "千里眼": { onAction: wrap((p) => { p.autoDiliMult = 2; Engine.log(`【千里眼】${p.master.name} 的地利变为2倍！`, "var(--gold)"); }) },
        "女神的神核（Divine Core）": {
            onAction: wrap((p) => {
                p.autoDiliMult = 2;
                let route = ["魔术工房", "深山町", "新都", "侦察"];
                let next = route[route.indexOf(p.location) + 1];
                if(next) moveTo(p, next, "女神的神核·疾行");
                Engine.log(`【远隔操作】${p.master.name} 的地利翻倍！`, "var(--gold)");
            }),
            onCombatFinal: wrap((pt) => {
                pt.isAvoidDefeat = true;
                pt.tags.push(`<span style="color:var(--gold);">[Divine Core·幸运]</span>`);
            }),
            onCombatWin: wrap((pt, winners, all, gl) => { pt.ply.vp += 2; gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (Divine Core)</span> <span>获胜，+2 战果</span></div>`); })
        },
        "吸血": {
            onCombatLose: wrap((pt, winners, all, gl) => {
                if(winners && winners[0]){ let w = winners[0].ply; let steal = Math.min(2, w.mana); w.mana -= steal; Engine.addMana(pt.ply, steal); gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (吸血)</span> <span>从 ${w.master.name} 处偷取 ${steal} 魔力</span></div>`); }
            })
        },
        "伪装者": { onCombatWin: wrap((pt, winners, all, gl) => { if(pt.ply.isRevealed){ let gain = Math.min(State.day||1, 5); pt.ply.vp += gain; gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (伪装者·骗局)</span> <span>真名已公开，+${gain} 战果</span></div>`); } }) },
        "伪装者（Pretender Class）": { onCombatWin: wrap((pt, winners, all, gl) => { if(pt.ply.isRevealed){ let gain = Math.min(State.day||1, 5); pt.ply.vp += gain; gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (伪装者·骗局)</span> <span>真名已公开，+${gain} 战果</span></div>`); } }) },
        "流星一条": { onCombatWin: wrap((pt, winners, all, gl) => { if(pt.ply._used_流星一条) return; pt.ply._used_流星一条 = true; pt.ply._meteorRetirePending = true; pt.ply.vp += 6; gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (流星一条)</span> <span>获胜，+6 战果；战斗结束后阿拉什退场</span></div>`); }) },
        "真圆集结誓约之星": { onCombatWin: wrap((pt, winners, all, gl) => { if(pt.ply.discard.length > 0 && pt.ply.deck.length >= 0){ let n = pt.ply.discard.length; pt.ply.deck = window.shuffleArray([...pt.ply.deck, ...pt.ply.discard]); pt.ply.discard = []; gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (真圆集结誓约之星)</span> <span>获胜，弃牌堆 ${n} 张洗回牌库</span></div>`); } }) },
        "无铭胜利剑": {
            onAction: wrap((p) => { if(p.mana >= 4){ p.mana -= 4; p.autoSkillBuff = (p.autoSkillBuff||0) + 4; Engine.log(`【银河流星剑】花费4魔力，本回合+4合计威力！`, "var(--mana)"); } else Engine.log(`【银河流星剑】魔力不足4点，未发动。`, "#aaa"); }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--mana);">[宇宙反应器(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "王之财宝": {
            onAction: wrap((p) => { let n = p.hand.length; p.discard.push(...p.hand); p.hand = []; p.kotobukiDouble = true; Engine.log(`【王之财宝】弃置${n}张手牌，本牌获得其属性且战斗阶段威力翻倍！`, "var(--gold)"); }),
            onCombatCalc: wrap((pt) => { if(pt.ply.kotobukiDouble){ let base = Math.max(4, Math.floor(pt.p / 2)); pt.p += base; pt.tags.push(`<span style="color:var(--gold);">[王之财宝·翻倍(+${base})]</span>`); pt.ply.kotobukiDouble = false; } })
        },
        "高歌凯旋之虹弓": { onCombatCalc: wrap((pt, all) => { let opps = all.filter(o => o.id !== pt.id); if(opps.some(o => o.ply.vp > pt.ply.vp)){ pt.p += 5; pt.tags.push(`<span style="color:var(--mana);">[可能性之光(+5)]</span>`); } }) },
        "驰骋天际星之枪尖": { onCombatCalc: wrap((pt, all) => { let opps = all.filter(o => o.id !== pt.id); if(opps.length === 1){ pt.p += 4; pt.tags.push(`<span style="color:var(--gold);">[英雄对决(+4)]</span>`); } }) },
        "通往死亡满溢的魔境之门": {
            onAction: wrap((p) => {
                p.gateActive = true;
                if (!p.selectedGateAttribute) p.selectedGateAttribute = "力量";
                Engine.log(`【影之国】选择${p.selectedGateAttribute}属性，具有该属性的基础攻击基本威力翻倍！`, "var(--mana)");
            })
        },
        "捕食日轮之角": { onCombatCalc: wrap((pt) => { pt.p += 6; pt.tags.push(`<span style="color:var(--gold);">[日轮之角(+6)]</span>`); }) },
        "军神之剑": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                if (pt && pt.ply && typeof Engine.placeAlteraStar === "function") Engine.placeAlteraStar(pt.ply, loc, gl);
            }),
            onCombatCalc: wrap((pt) => { pt.p += 4; pt.tags.push(`<span style="color:var(--vp);">[军神之剑(+4)]</span>`); })
        },
        "灼热竞早魔界": { onCombatCalc: wrap((pt) => { pt.p += 5; pt.tags.push(`<span style="color:var(--red);">[魔界(+5)]</span>`); }) },
        "弁财天五弦琵琶": { onCombatStart: wrap((pt, all, loc, gl) => { all.filter(o => o.id !== pt.id).forEach(o => { o.pendingSuppression = (o.pendingSuppression||0) + 3; }); gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ 弁财天五弦琵琶</span> <span>交战对手的力量攻击威力被削减</span></div>`); }) },
        "毁天灭地": { onCombatCalc: wrap((pt) => { pt.p += 8; pt.tags.push(`<span style="color:var(--red);">[毁天灭地(+8)]</span>`); }) },
        // ===== 决战型：令对手【败北】 =====
        "冥镜宝典": { onCombatFinal: wrap((pt, all, gl) => { defeatOpp(pt, all, gl, "冥镜宝典", null, "all"); }) },
        "空想具现化": { onCombatFinal: wrap((pt, all, gl) => { let t = defeatOpp(pt, all, gl, "空想具现化", o => o.ply.vp > pt.ply.vp, "one"); if(t.length === 0){ pt.ply.vp += 3; gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (空想具现化)</span> <span>无更高战果目标，+3 战果</span></div>`); } }) },
        "军神咆哮": { onCombatFinal: wrap((pt, all, gl) => { defeatOpp(pt, all, gl, "军神咆哮", o => o.p < pt.p, "all"); }) },
        "三段击": {
            onCombatCalc: wrap((pt, all) => { all.filter(o => o.id !== pt.id).forEach(o => { o.p = Math.max(0, o.p - 2); o.tags.push(`<span style="color:var(--red);">[三千世界(-2)]</span>`); }); }),
            onCombatFinal: wrap((pt, all, gl) => { defeatOpp(pt, all, gl, "三千世界·败北", o => o.p <= 0, "all"); })
        },
        "破坏神之手影": { onCombatFinal: wrap((pt, all, gl) => { defeatOpp(pt, all, gl, "审判", o => !(o.servantSkills||[]).some(i => { let sk = o.ply.servant.skillCards[i]; return sk && (sk.type||"").includes("宝具"); }) && !oppHasAttr(o, "宝具"), "all"); }) },
        "第一太阳纪": { onCombatFinal: wrap((pt, all, gl) => { if(pt.ply.commandSpells > 0){ pt.ply.commandSpells -= 1; pt.ply.usedCSThisTurn = true; defeatOpp(pt, all, gl, "黑色太阳", null, "all"); } else gl.push(`<div class="report-line" style="color:#aaa;"><span>✨ 第一太阳纪</span> <span>无令咒可用，效果未发动</span></div>`); }) },
        "红莲圣女": { onCombatFinal: wrap((pt, all, gl) => { defeatOpp(pt, all, gl, "红莲圣女", null, "self"); }) },
        "第六天魔王波旬": { onCombatFinal: wrap((pt, all, gl) => { defeatOpp(pt, all, gl, "亵渎", o => oppHasAttr(o, "幸运") || (o.cards||[]).includes("cardluck"), "all"); }) },
        "骄慢王的美酒": { onCombatFinal: wrap((pt, all, gl) => { defeatOpp(pt, all, gl, "毒龙", null, "all"); }) },
        "开演之时已至，此处应有雷鸣般的喝彩": { onCombatFinal: wrap((pt, all, gl) => { defeatOpp(pt, all, gl, "悲剧创作", o => o.ply.commandSpells > 0, "all"); }) },
        "死亡满溢的魔境之门": { onCombatFinal: wrap((pt, all, gl) => { let opps = all.filter(o => o.id !== pt.id); opps.forEach(o => { o.ply.mana = 0; }); let t = defeatOpp(pt, all, gl, "影之国", o => true, "all"); gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (影之国)</span> <span>所有交战对手魔力归零</span></div>`); }) },
        "咆哮吧，吾之风怒": { onCombatFinal: wrap((pt, all, gl) => { let opps = all.filter(o => o.id !== pt.id); let oppCards = opps.reduce((s,o) => s + (o.cards||[]).length, 0); if((pt.cards||[]).length > oppCards) defeatOpp(pt, all, gl, "风怒", null, "all"); }) },
        "强制封印·万魔神殿": { onCombatFinal: wrap((pt, all, gl) => { defeatOpp(pt, all, gl, "地母神之眼", o => { let c = (State.actionChoices[o.id]||{cards:[]}); return (c.cards||[]).length > 1; }, "all"); }) },
        "魔女审判": { onCombatFinal: wrap((pt, all, gl) => { defeatOpp(pt, all, gl, "银之钥", null, "one"); }) },
        "解体圣母": {
            onCombatCalc: wrap((pt) => { pt.p += 3; pt.tags.push(`<span style="color:var(--vp);">[解体圣母(+3)]</span>`); }),
            onCombatFinal: wrap((pt, all, gl) => { if(!pt.ply.isRevealed) defeatOpp(pt, all, gl, "解体圣母·雾都", null, "one"); })
        },
        "告死天使": { onCombatFinal: wrap((pt, all, gl) => { let opps = all.filter(o => o.id !== pt.id); let hits = opps.filter(o => Math.floor(Math.random()*6) === 5); hits.forEach(o => o.autoDefeated = true); if(hits.length) gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (晚钟)</span> <span>钟声响起！${hits.map(o=>o.ply.master.name).join('、')} 【败北】</span></div>`); else gl.push(`<div class="report-line" style="color:#aaa;"><span>✨ 晚钟</span> <span>无人被钟声选中</span></div>`); }) },
        "世人啊，冀以锁系神明": { onCombatStart: wrap((pt, all, gl) => { all.filter(o => o.id !== pt.id).forEach(o => { o.p = Math.max(0, o.p - 6); o.tags.push(`<span style="color:var(--red);">[天之锁(-6)]</span>`); }); gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (天之锁)</span> <span>束缚所有交战对手，宝具无法使用</span></div>`); }) },
        "一碰就倒！": { onCombatStart: wrap((pt, all, gl) => { all.filter(o => o.id !== pt.id).forEach(o => { o.pendingSuppression = (o.pendingSuppression||0) + 6; }); gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (一碰就倒！)</span> <span>对手的力量与迅捷攻击被关闭</span></div>`); }) },
        // ===== 威力增幅型 =====
        "军神之剑·泪之星": { onCombatCalc: wrap((pt) => { pt.p += 15; pt.tags.push(`<span style="color:var(--gold);">[轨道打击(+15)]</span>`); }) },
        "神罚的野猪": { onCombatCalc: wrap((pt) => { pt.p += 4; pt.tags.push(`<span style="color:var(--red);">[神罚的野猪(+4)]</span>`); }) },
        "圣者的数字": { onCombatCalc: wrap((pt) => { let c = (State.actionChoices[pt.id]||{cards:[]}); let cnt = (c.cards||[]).filter(cid => Engine.getCardData(cid) && Number(Engine.getCardData(cid).power) === 3).length; if(cnt > 0){ let bonus = cnt * 6; pt.p += bonus; pt.tags.push(`<span style="color:var(--gold);">[不夜的魅力(${cnt}张×3→+${bonus})]</span>`); } }) },
        "如翱翔天际之龙": { onAction: wrap((p) => { p.autoSkillBuff = (p.autoSkillBuff||0) + 10; Engine.log(`【如翱翔天际之龙】+10 合计威力至回合结束！`, "var(--gold)"); }), onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[龙之威光(+${pt.ply.autoSkillBuff})]</span>`); } }) },
        "吾之箭矢无兽弗届": { onAction: wrap((p) => { let luckIdx = p.hand.map((c,i)=>({c,i})).filter(x => DB.cards[x.c] && DB.cards[x.c].name === "幸运"); let x = Math.min(2, luckIdx.length); luckIdx.slice(0,x).forEach(x2 => p.hand.splice(p.hand.indexOf(x2.c),1)); p.autoSkillBuff = (p.autoSkillBuff||0) + 6*x; Engine.log(`【吾之箭矢无兽弗届】移除${x}张【幸运】，+${6*x}合计威力！`, "var(--gold)"); }), onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[无兽弗届(+${pt.ply.autoSkillBuff})]</span>`); } }) },
        "契约胜利之剑": { onAction: wrap((p) => { let resolve = n => { n = Math.max(0, Math.min(Number(n)||0, 2)); if(n > 0){ p.contractSwordBonus = (p.contractSwordBonus||0) + 5*n; Engine.log(`【契约胜利之剑】移除${n}张技能，永久+${5*n}威力！`, "var(--gold)"); } }; if(p.isPlayer && p.id===Network.myPlayerId){ Interaction.choose("【契约胜利之剑】选择移除的亚瑟技能牌数量", ["0张", "1张", "2张"], i => resolve(i), () => {}); return; } resolve(0); }), onCombatCalc: wrap((pt) => { if(pt.ply.contractSwordBonus){ pt.p += pt.ply.contractSwordBonus; pt.tags.push(`<span style="color:var(--gold);">[誓约升华(+${pt.ply.contractSwordBonus})]</span>`); } }) },
        "轮转胜利之剑": { onAction: wrap((p) => { if(p.location === "深山町" || p.location === "新都"){ Engine.addMana(p, 3); p.autoSkillBuff = (p.autoSkillBuff||0) + 3; Engine.log(`【轮转胜利之剑】位于战场，获得3点魔力且总威力+3（回合结束前未打出将失去所有魔力）！`, "var(--gold)"); } }), onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[轮转(+${pt.ply.autoSkillBuff})]</span>`); } }) },
        "恰赫季斯之夜": { onCombatStart: wrap((pt, all) => { addToken(pt.ply, "音量", all.filter(o => o.id !== pt.id).length); }), onCombatCalc: wrap((pt) => { let b = Math.min(15, 3 * getToken(pt.ply, "音量")); if(b > 0){ pt.p += b; pt.tags.push(`<span style="color:var(--red);">[魔音(+${b})]</span>`); } }) },
        "龙鸣雷声": { onCombatStart: wrap((pt, all) => { addToken(pt.ply, "音量", all.filter(o => o.id !== pt.id).length); }), onCombatCalc: wrap((pt) => { let b = getToken(pt.ply, "音量"); if(b > 0){ pt.p += b; pt.tags.push(`<span style="color:var(--red);">[天籁之音(+${b})]</span>`); } }) },
        "六道五轮·俱利伽罗天象": {
            onCombatWin: wrap((pt, winners, all, gl) => {
                let p = pt.ply;
                let turn = p._boundaryTokenTurn !== undefined ? p._boundaryTokenTurn : (State.day || 1);
                if (p._boundaryTokenTurn !== turn) p._boundaryTokenTurnGain = 0;
                let gained = Math.max(0, Math.min(3 - (p._boundaryTokenTurnGain || 0), 1 + all.filter(o => o.id !== pt.id).length));
                if (gained <= 0) return;
                addToken(p, "境界", gained);
                p._boundaryTokenTurn = turn;
                p._boundaryTokenTurnGain = (p._boundaryTokenTurnGain || 0) + gained;
                if (gl) gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${p.master.name} (六道五轮·俱利伽罗天象)</span> <span>获得${gained}枚【境界】标记</span></div>`);
            })
        },
        "二天一流": { onCombatCalc: wrap((pt) => { let lv = getToken(pt.ply, "境界"); if(lv >= 12){ pt.p += 12; pt.tags.push(`<span style="color:var(--gold);">[二天一流·极(+12)]</span>`); } else if(lv >= 7){ pt.p += 8; pt.tags.push(`<span style="color:var(--gold);">[二天一流·熟(+8)]</span>`); } else if(lv >= 2){ pt.p += 5; pt.tags.push(`<span style="color:var(--gold);">[二天一流(+5)]</span>`); } }) },
        "魔兽外形": { onCombatCalc: wrap((pt) => { let b = State.day || 1; pt.p += b; pt.tags.push(`<span style="color:var(--red);">[魔兽外形(+${b})]</span>`); }) },
        "炎之灾厄": { onAction: wrap((p) => { let d = Math.max(0, Number(p.turnMoveDistance || p.movedDistance || 0)); if(d <= 0){ Engine.log(`【炎之灾厄】本回合尚未记录有效移动距离。`, "#aaa"); return; } p.autoPermBuff = (p.autoPermBuff||0) + d; Engine.log(`【炎之灾厄】移动距离${d}，永久+${d}威力！`, "var(--red)"); }), onCombatCalc: wrap((pt) => { if(pt.ply.autoPermBuff){ pt.p += pt.ply.autoPermBuff; pt.tags.push(`<span style="color:var(--red);">[炎之灾厄(+${pt.ply.autoPermBuff})]</span>`); } }) },
        "吾转瞬即逝的荣光": { onCombatCalc: wrap((pt) => { pt.p += 5; pt.tags.push(`<span style="color:var(--gold);">[转瞬荣光(+5)]</span>`); }) },
        "绝剑·无穹三段": { onAction: wrap((p) => { let basics = p.discard.filter(c => DB.cards[c]); let n = Math.min(2, basics.length); for(let i=0;i<n;i++){ let c = basics[i]; p.discard.splice(p.discard.indexOf(c),1); p.deck.push(c); } let rm = Math.min(2, p.discard.length); for(let i=0;i<rm;i++) p.discard.pop(); if(rm >= 2){ p.autoSkillBuff = (p.autoSkillBuff||0) + 8; Engine.log(`【绝剑·无穹三段】${n}张基础牌洗回牌库，炼狱+8威力！`, "var(--red)"); } }), onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--red);">[炼狱(+${pt.ply.autoSkillBuff})]</span>`); } }) },
        "试斩": { onAction: wrap((p) => { let n = Math.min(3, p.hand.length); let pw = 0; for(let i=0;i<n;i++){ let c = p.hand.pop(); let cd = DB.cards[c]; if(cd) pw += Number(cd.power)||0; p.discard.push(c); } p.autoPermBuff = (p.autoPermBuff||0) + pw; addToken(p, "试斩", pw); Engine.log(`【试斩】移除${n}张手牌（弃置），此牌+${pw}威力！`, "var(--vp)"); }), onCombatCalc: wrap((pt) => { if(pt.ply.autoPermBuff){ pt.p += pt.ply.autoPermBuff; pt.tags.push(`<span style="color:var(--vp);">[试斩(+${pt.ply.autoPermBuff})]</span>`); } }) },
        "无元剑制": { onCombatCalc: wrap((pt) => { let b = getToken(pt.ply, "试斩"); if(b > 0){ pt.p += b; pt.tags.push(`<span style="color:var(--gold);">[无元剑制(+${b})]</span>`); } }) },
        "银之臂": { onAction: wrap((p) => { let resolve = () => { let n = p.deck.length; if(n < 2){ Engine.log(`【银之臂】剩余牌堆不足2张，紧握其剑未发动。`, "#aaa"); return; } p.deck.splice(0, n); p.autoSkillBuff = (p.autoSkillBuff||0) + 12; Engine.log(`【银之臂】移除剩余牌堆${n}张，+12合计威力！`, "var(--gold)"); }; if(p.isPlayer && p.id===Network.myPlayerId){ Interaction.confirm(`【银之臂·紧握其剑】移除剩余全部${p.deck.length}张牌堆`, true, ok => { if(ok) resolve(); }, () => {}); return; } resolve(); }), onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[银之臂(+${pt.ply.autoSkillBuff})]</span>`); } }) },
        "梦幻召唤-狂战士": { onCombatCalc: wrap((pt) => { pt.p += 1; pt.tags.push(`<span style="color:var(--red);">[狂化(+1)]</span>`); }) },
        "兽之灾难": { onCombatCalc: wrap((pt) => { pt.p += 4; pt.tags.push(`<span style="color:var(--red);">[兽之灾难(+4)]</span>`); }) },
        "提升等级": { onAction: wrap((p) => { p.autoPermBuff = (p.autoPermBuff||0) + 1; Engine.log(`【提升等级】技能牌基础威力+1（永久，当前+${p.autoPermBuff}）！`, "var(--vp)"); }), onCombatCalc: wrap((pt) => { if(pt.ply.autoPermBuff){ pt.p += pt.ply.autoPermBuff; pt.tags.push(`<span style="color:var(--vp);">[升级(+${pt.ply.autoPermBuff})]</span>`); } }) },
        "三千大千世界": { onAction: wrap((p) => { let bonus = Math.min(3, p.hand.length > 0 ? 3 : 1); p.autoSkillBuff = (p.autoSkillBuff||0) + bonus; Engine.log(`【三千大千世界】弃置牌堆顶3张，+${bonus}威力！`, "var(--mana)"); }), onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--mana);">[三千大千(+${pt.ply.autoSkillBuff})]</span>`); } }) },
        "无明三段突": { onAction: wrap((p) => { p.legionBuff = (p.legionBuff||0) + 8; Engine.log(`【无明三段突】创造2张临时威力4迅捷攻击（合计+8）！`, "var(--gold)"); }), onCombatCalc: wrap((pt) => { if(pt.ply.legionBuff){ pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[无明三段(+${pt.ply.legionBuff})]</span>`); } }) },
        "殉教者之魂": { onCombatCalc: wrap((pt) => { pt.p += 3; pt.tags.push(`<span style="color:var(--vp);">[殉教(+3)]</span>`); }) },
        "守护": {
            // 玛修的守护：你和玛修无视【败北】效果，二人合计威力共享为二者最高值；玛修战败则此牌返还其手牌；玛修未参与此战斗则关闭此牌
            // 注：结算于 onCombatFinal（败北判定前最后生效；QA#45-48 病弱/守护同时点效果按固定顺位结算——守护后结算，共享威力覆盖归零，属合法结算顺序之一）
            // "借出"行动阶段能力因引擎手牌无行动阶段触发点暂以战斗共享近似（玛修参战即与打出者共享）
            onCombatFinal: wrap((pt, all, gl) => {
                let mashPt = all.find(o => o.ply.servant && o.ply.servant.trueName === "玛修·基列莱特");
                let c = State.actionChoices[pt.id] || {cards:[], facedown:[]};
                let gcid = (c.cards||[]).find(cid => Engine.getCardData(cid) && Engine.getCardData(cid).name === "守护");
                if(!mashPt){
                    pt.p = Math.max(0, pt.p - 5);
                    pt.tags.push(`<span style="color:#aaa;">[守护·玛修未参战·关闭(-5)]</span>`);
                    gl.push(`<div class="report-line" style="color:#aaa;"><span>✨ 守护</span> <span>玛修未参与此战斗，此牌【关闭】</span></div>`);
                    return;
                }
                [pt, mashPt].forEach(o => { o.isAvoidDefeat = true; o.autoDefeated = false; o.tags.push(`<span style="color:var(--gold);">[守护·无视败北]</span>`); });
                let mx = Math.max(pt.p, mashPt.p);
                pt.p = mx; mashPt.p = mx;
                gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (守护)</span> <span>与玛修合计威力共享为${mx}，二人无视【败北】效果</span></div>`);
                // 若玛修将战败（威力低于全场最高），【守护】返还玛修的手牌
                let gMax = Math.max(...all.map(o => o.p));
                if(mashPt.p < gMax && gcid !== undefined){
                    let idx = (pt.finalCardsToProcess||[]).indexOf(gcid);
                    if(idx > -1) pt.finalCardsToProcess.splice(idx, 1);
                    mashPt.ply.hand.push(gcid);
                    gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ 守护</span> <span>玛修战败，【守护】返回玛修的手牌</span></div>`);
                }
            })
        },
        "冥府神的伟业": { onAction: wrap((p) => { p.autoDiliMult = 3; Engine.log(`【冥府神的伟业】埃及魔术：地利三倍化！`, "var(--gold)"); }) },
        "反叛": { onCombatCalc: wrap((pt) => { let x = pt.ply.commandSpells || 0; let b = Math.max(0, 6 - 2*x); if(b > 0){ pt.p += b; pt.tags.push(`<span style="color:var(--red);">[发起叛逆(+${b})]</span>`); } }) },
        "狂暴少女狼": { onCombatStart: wrap((pt, all) => { let extra = all.filter(o => o.id !== pt.id).length - 1; if(extra > 0){ Engine.drawCards(pt.ply, extra); pt.ply.autoSkillBuff = (pt.ply.autoSkillBuff||0) + extra * 2; } }), onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--red);">[狼不眠(+${pt.ply.autoSkillBuff})]</span>`); } }) },
        // ===== 战果/魔力经济型 =====
        "尾张的大傻瓜": { onCombatLose: wrap((pt, winners, all, gl) => { pt.ply.vp += 3; gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (尾张的大傻瓜)</span> <span>败北反获3点战果！</span></div>`); }) },
        "暴风雨的航海家": { onCombatEnd: wrap((pt, winners, all, gl) => { let b = 2; pt.ply.vp += b; gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (劫掠)</span> <span>劫掠沿海，+${b} 战果</span></div>`); }) },
        "黄金鹿与暴风夜": { onAction: wrap((p) => { if(p.location === "侦察"){ p.vp += 2; Engine.log(`【黄金鹿与暴风夜】位于侦察，立刻获得2点战果！`, "var(--vp)"); } else Engine.log(`【黄金鹿与暴风夜】可无视花费移动至任一地点（请手动移动）。`, "var(--gold)"); }) },
        "献给公主之枪": { onAction: wrap((p) => { if(p.location === "深山町" || p.location === "新都"){ let sameLoc = State.players.filter(op => op.isAlive && op.id !== p.id && op.location === p.location); if(sameLoc.length === 0){ let cv = p.location === "深山町" ? 2 : 3; p.vp += cv; Engine.log(`【向风车的冲锋】独自位于战场，获得${cv}点竞争战果！`, "var(--vp)"); } } }) },
        "神秘杀手": { onCombatWin: wrap((pt, winners, all, gl) => { let losers = all.filter(o => o.id !== pt.id); if(losers.length){ let hi = losers.reduce((a,b) => a.ply.vp >= b.ply.vp ? a : b); hi.ply.vp = Math.max(0, hi.ply.vp - 3); gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (神秘杀手)</span> <span>战果最高的败者 ${hi.ply.master.name} 失去3点战果</span></div>`); } }) },
        "神圣的献身": { onAction: wrap((p) => { let lead = State.players.filter(op => op.isAlive).every(op => op.vp <= p.vp); if(lead){ let g = State.day >= 9 ? 3 : 1; p.vp += g; Engine.log(`【神圣的献身】战果领先，获得${g}点战果！`, "var(--vp)"); } }) },
        "王之号炮": { onAction: wrap((p) => { p.kingCannonPendingDay = State.day + 1; Engine.log(`【王之号炮】开炮！下回合准备阶段额外抽2张牌，并可追加打出1张常规牌！`, "var(--gold)"); }) },
        "天授的英雄": { onAction: wrap((p) => {
            if(!payCost(p, 1, "天授的英雄")) return false;
            let basicIds=[...(p.deck||[]),...(p.discard||[])].filter(cid=>{let c=Engine.getCardData(cid);return c&&String(c.desc||"").includes("基础攻击");});
            basicIds=[...new Set(basicIds)];
            let take=cid=>{let i=p.deck.indexOf(cid);if(i>-1)p.deck.splice(i,1);else{i=p.discard.indexOf(cid);if(i>-1)p.discard.splice(i,1);}if(i>-1||p.hand.includes(cid)){p.hand.push(cid);Engine.log(`【天授的英雄】选择【${Engine.getCardData(cid)?.name||cid}】加入手牌！`,"var(--mana)");UI.updateAll();UI.renderHand(true);Network.sync();}};
            if(!basicIds.length){Engine.log(`【天授的英雄】牌库与弃牌堆没有基础牌。`,"#aaa");return;}
            if(p.isPlayer&&p.id===Network.myPlayerId){Interaction.choose("【天授的英雄】选择牌库或弃牌堆中的基础牌",basicIds.map(cid=>({label:Engine.getCardData(cid)?.name||cid,desc:Engine.getCardData(cid)?.desc||""})),i=>take(basicIds[i]),()=>{p.mana+=1;});return;}
            take(basicIds[0]);
        }) },
        "少女贞洁": {
            // sc_frank_1（威力3版）：战斗阶段关闭同地点魔术属性基础牌，获得其威力魔力（近似：封魔术压制+回魔）
            onCombatStart: wrap((pt, all, gl) => {
                let played = (pt.servantSkills||[]).map(i => pt.ply.servant.skillCards[i]).filter(Boolean);
                if(!played.some(sk => sk.id === "sc_frank_1")) return;
                all.filter(o => o.id !== pt.id && oppHasAttr(o, "魔术")).forEach(o => { o.pendingSuppression = (o.pendingSuppression||0) + 3; });
                Engine.addMana(pt.ply, 2);
                gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (少女贞洁)</span> <span>封魔术攻击，获得其部分威力作为魔力</span></div>`);
            }),
            // sc_frank_2（真名解放版）：合计威力+X，X=所处战场所有玩家本回合打出的所有攻击的魔力消耗之和（QA#41：印刷魔力+场上增减效果之和，引擎以印刷魔力近似）
            onCombatCalc: wrap((pt, all, gl) => {
                let played = (pt.servantSkills||[]).map(i => pt.ply.servant.skillCards[i]).filter(Boolean);
                if(!played.some(sk => sk.id === "sc_frank_2")) return;
                let x = 0;
                all.forEach(o => {
                    let c = State.actionChoices[o.id] || {cards:[], facedown:[]};
                    (c.cards||[]).forEach(cid => { let cd = Engine.getCardData(cid); if(cd) x += (Number(cd.cost)||0); });
                    (o.servantSkills||[]).forEach(i => { let sk = o.ply.servant.skillCards[i]; if(sk) x += (Number(sk.cost)||0); });
                });
                if(x > 0){ pt.p += x; pt.tags.push(`<span style="color:var(--gold);">[少女贞洁·X=${x}(+${x})]</span>`); }
                gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (少女贞洁·真名解放)</span> <span>合计威力+${x}（战场所有玩家本回合打出攻击的魔力消耗之和）</span></div>`);
            })
        },
        "妄想毒身": { onCombatStart: wrap((pt, all, gl) => { oppLose(all, pt, gl, "vp", 1, "妄想毒身"); }) },
        "沸腾之血": { onCombatStart: wrap((pt, all, gl) => { State.players.filter(o => o.isAlive && o.id !== pt.id && o.mana >= 8).forEach(o => { let isFoe = all.some(x => x.id === o.id); let loss = isFoe ? 2 : 1; o.vp = Math.max(0, o.vp - loss); gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ 沸腾之血</span> <span>${o.master.name} 魔力灼烧，失去${loss}点战果${isFoe ? "（交战对手）" : ""}</span></div>`); }); }) },
        "伤兽的咆哮": { onCombatEnd: wrap((pt, winners, all, gl) => { let opps = all.filter(o => o.id !== pt.id); if(opps.length){ let maxP = Math.max(...opps.map(o => o.p)); let g = Math.floor(maxP / 5); if(g > 0){ pt.ply.vp += g; gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (受虐之荣光)</span> <span>+${g} 战果</span></div>`); } } }) },
        "邀至心荡神驰的黄金剧场": { onCombatWin: wrap((pt, winners, all, gl) => { let turns = Math.min(3, 1 + Math.floor((State.day||1)/4)); pt.ply.vp += turns; gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (黄金剧场)</span> <span>喝彩如潮，+${turns} 战果</span></div>`); }) },
        "钢之看护": { onCombatLose: wrap((pt, winners, all, gl) => { let lower = all.some(o => o.id !== pt.id && o.p < pt.p); if(lower){ pt.ply.vp += 3; gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (钢之看护)</span> <span>存在战力更低者，+3 战果</span></div>`); } }) },
        "拷问技术": { onCombatWin: wrap((pt, winners, all, gl) => { let losers = all.filter(o => o.id !== pt.id); if(losers.length){ let lo = losers.reduce((a,b) => a.ply.vp <= b.ply.vp ? a : b); lo.ply.vp = Math.max(0, lo.ply.vp - 2); pt.ply.vp += 2; gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (铁处女)</span> <span>${lo.ply.master.name} -2战果，拷问者+2战果</span></div>`); } }) },
        "献给死神的安魂曲": { onCombatEnd: wrap((pt, winners, all, gl) => { let isWin = winners.some(w => w.id === pt.id); if(!isWin){ let opps = all.filter(o => o.id !== pt.id); let g = Math.min(3, 1 + Math.floor(((State.day||1))/6)); opps.forEach(o => { o.ply.vp = Math.max(0, o.ply.vp - g); }); gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ Dies Irae</span> <span>败者们受审，各失去${g}战果</span></div>`); } }) },
        "厄运（Misfortune）": { onCombatLose: wrap((pt, winners, all, gl) => { pt.ply.vp += 3; let opps = all.filter(o => o.id !== pt.id); opps.forEach(o => o.autoDefeated = true); gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (厄运)</span> <span>+3 战果，同战场对手皆【败北】</span></div>`); }) },
        "东·斯塔利恩": { onAction: wrap((p) => { let locs = ["深山町", "新都"]; let resolve = dest => { if(p.vp >= 2) p.vp -= 2; moveTo(p, locs.includes(dest) ? dest : "新都", "东·斯塔利恩"); p.legionBuff = (p.legionBuff||0) + 9; Engine.log(`【骑乘·东·斯塔利恩】追加打出至多3张威力3牌（合计+9）！`, "var(--gold)"); }; if(p.isPlayer && p.id===Network.myPlayerId){ Interaction.chooseLocation("【东·斯塔利恩】移动至一处战场", locs, i => resolve(locs[i]), () => {}); return; } resolve("新都"); }), onCombatCalc: wrap((pt) => { if(pt.ply.legionBuff){ pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[东·斯塔利恩(+${pt.ply.legionBuff})]</span>`); } }) },
        "皇帝特权": {
            onAction: wrap((p) => {
                let resolve = last => {
                    if (!payCost(p, 2, "皇帝特权")) return;
                    Engine.log(`【皇帝特权】${p.master.name} 的顺位调整至${last ? "最后" : "第一"}！`, "var(--gold)");
                };

                if (p.isPlayer && p.id===Network.myPlayerId) {
                    Interaction.choose(
                        "【皇帝特权】选择玩家顺位",
                        ["第一位", "最后一位"],
                        i => resolve(i === 1),
                        () => {}
                    );
                    return;
                }

                resolve(false);
            })
        },
        "乱世枭雄": { onAction: wrap((p) => { p乱世VPx2 = true; p.eventVpZero = true; Engine.log(`【乱世枭雄】反叛：事件牌战果归零，令咒与竞争战果翻倍！`, "var(--red)"); }) },
        "反骨之相": { onAction: wrap((p) => { if(!p.foughtThisRound || p.foughtThisRound.length === 0){ p.vp = Math.max(0, p.vp - 1); Engine.log(`【反骨之相】本回合未战斗，失去1点战果（可保留1张基础攻击）！`, "var(--red)"); } }) },
        "燎原之火": {
            getPower: (p) => Math.min(10, Math.ceil((Number(p && p.mana) || 0) / 2) + 2),
            onAction: wrap((p) => {
                if (p.location === "深山町" || p.location === "新都") {
                    Engine.addMana(p, 10);
                    p.燎原Drain = true;
                    Engine.log(`【燎原之火】获得8~12点魔力，战斗阶段结束将失去所有魔力及其一半的战果！`, "var(--red)");
                }
            }),
            onCombatEnd: wrap((pt, winners, all, gl) => {
                let p = pt && pt.ply ? pt.ply : pt;
                if (!p || !p.燎原Drain || p._燎原Resolved) return;
                p._燎原Resolved = true;
                let lost = Math.max(0, Number(p.mana) || 0);
                p.mana = 0;
                p.vp = Math.max(0, (Number(p.vp) || 0) - Math.ceil(lost / 2));
                p.燎原Drain = false;
                p._燎原Resolved = false;
                if (gl) gl.push(`<div class="report-line" style="color:var(--red);"><span>燎原之火</span><span>失去${lost}点魔力及${Math.ceil(lost / 2)}点战果</span></div>`);
            })
        },
        "热力学第二定律的否定": { onAction: wrap((p) => { p热力Buff = true; Engine.log(`【热力学第二定律的否定】获得的魔力将转化为威力！`, "var(--mana)"); }) },
        "瞋恚": { onCombatFinal: wrap((pt, all, gl) => { let opps = all.filter(o => o.id !== pt.id); if(opps.length && pt.ply.hand.length > 0){ pt.ply.discard.push(pt.ply.hand.pop()); let g = Math.max(1, Math.ceil(pt.p / 3)); opps.forEach(o => { o.ply.vp = Math.max(0, o.ply.vp - g); }); gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (瞋恚)</span> <span>弃1张手牌，对手各失去${g}战果</span></div>`); } }) },
        "龙之魔女": {
            onAction: wrap((p) => {
                let locs = ["深山町", "新都", "侦察"];
                let resolve = dest => {
                    if (!locs.includes(dest) || !moveTo(p, dest, "龙之魔女")) return;
                    State.players.filter(op => op.isAlive && op.id !== p.id && op.location === p.location).forEach(op => {
                        op.vp = Math.max(0, op.vp - 2);
                    });
                    Engine.log(`【龙之魔女】同战场对手各失去2点战果！`, "var(--red)");
                };

                if (p.isPlayer && p.id===Network.myPlayerId) {
                    Interaction.chooseLocation(
                        "【龙之魔女】沿箭头移动1或2步",
                        locs,
                        i => resolve(locs[i]),
                        () => {}
                    );
                    return;
                }

                resolve("新都");
            })
        },
        "静谧之舞": { onAction: wrap((p) => { let locs = ["深山町","新都"].filter(loc => loc !== p.location); let resolve = loc => moveTo(p, locs.includes(loc) ? loc : locs[0], "静谧之舞"); if(p.isPlayer && p.id===Network.myPlayerId){ Interaction.chooseLocation("【静谧之舞】选择另一处战场", locs, i => resolve(locs[i]), () => {}); return; } resolve(locs[0]); }) },
        "海神的偏爱": { onAction: wrap((p) => { Engine.addMana(p, 3); Engine.log(`【海神的偏爱】关闭此牌，获得3点魔力（本回合不可再打出）！`, "var(--mana)"); }) },
        "空屋历险": { onAction: wrap((p) => { if(p.location === "魔术工房"){ Engine.addMana(p, 1); Engine.log(`【空屋历险·记忆宫殿】部署于魔术工房，获得1点魔力！`, "var(--mana)"); } }) },
        "口袋达·芬奇": { onAction: wrap((p) => { if(p.location === "魔术工房"){ Engine.addMana(p, 1); Engine.log(`【口袋达·芬奇】部署于魔术工房，获得1点魔力！`, "var(--mana)"); } }) },
        "大量生产": {
            onDeploy: wrap((owner, deployer, loc, all, gl) => {
                if (!owner || !deployer || owner.id === deployer.id || loc !== "魔术工房") return;
                Engine.addMana(deployer, 1, owner, "effect");
                owner.vp = (Number(owner.vp) || 0) + 2;
                owner.mana = Math.max(0, (Number(owner.mana) || 0) - 3);
                if (gl) gl.push(`<div class="report-line" style="color:var(--vp);"><span>大量生产</span><span>${deployer.master ? deployer.master.name : "对手"}获得1点魔力，持有者获得2点战果并失去3点魔力</span></div>`);
            }),
            onCombatEnd: wrap((pt, winners, all, gl) => {
                let p = pt && pt.ply ? pt.ply : pt;
                if (!p || (Number(p.mana) || 0) >= 2) return;
                let idx = (p.residualCards || []).indexOf("sc_edison_2");
                if (idx > -1) {
                    p.residualCards.splice(idx, 1);
                    p.discard = p.discard || [];
                    p.discard.push("sc_edison_2");
                }
            })
        },
        "权限访问": { onAction: wrap((p) => { if(payCost(p, 3, "权限访问")){ let locs = ["深山町","新都","侦察"]; let resolve = dest => moveTo(p, locs.includes(dest) ? dest : "新都", "权限访问"); if(p.isPlayer && p.id===Network.myPlayerId){ Interaction.chooseLocation("【权限访问】选择移动地点", locs, i => resolve(locs[i]), () => { p.mana += 3; }); return; } resolve("新都"); } }) },
        "才智的祝福": { onAction: wrap((p) => { addToken(p, "才智", 1); Engine.log(`【才智的祝福】获得1点【才智】（当前${getToken(p,"才智")}），可花费以无视【败北】！`, "var(--mana)"); }), onCombatFinal: wrap((pt) => { if(getToken(pt.ply, "才智") > 0){ addToken(pt.ply, "才智", -1); pt.isAvoidDefeat = true; pt.tags.push(`<span style="color:var(--gold);">[才智·免败]</span>`); } }) },
        "变转之魔": { onCombatFinal: wrap((pt) => { pt.isAvoidDefeat = true; pt.tags.push(`<span style="color:var(--gold);">[克律萨俄耳·无视败北]</span>`); }) },
        "维新之龙": { onAction: wrap((p) => { if(payCost(p, 3, "维新之龙")){ Engine.drawCards(p, 2); Engine.log(`【龙神之怒】支付3点魔力，抽2张牌（可弃力量牌+2威力/张）！`, "var(--red)"); } }) },
        "讯息：希望": { onAction: wrap((p) => { p.vp += 2; Engine.log(`【讯息：希望】群星低吟，+2 战果！`, "var(--vp)"); }) },
        "秀美公主的戒指": { onCombatStart: wrap((pt, all, gl) => { all.filter(o => o.id !== pt.id && oppHasAttr(o, "魔术")).forEach(o => { o.pendingSuppression = (o.pendingSuppression||0) + 4; }); gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (魔禁之戒)</span> <span>对手的魔术攻击被封锁</span></div>`); }) },
        "雪花之壁": { onCombatStart: wrap((pt, all, gl) => { let d = pt.ply.isRevealed ? 4 : 3; all.filter(o => o.id !== pt.id).forEach(o => { o.pendingSuppression = (o.pendingSuppression||0) + d * Math.max(1, (o.cards||[]).length); }); gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (雪花之壁)</span> <span>对手每张攻击威力-${d}</span></div>`); }) },
        "富岳三十六景": { onCombatStart: wrap((pt, all, gl) => { all.filter(o => o.id !== pt.id && !oppHasAttr(o, "魔术")).forEach(o => { o.p = Math.max(0, o.p - 2); o.tags.push(`<span style="color:var(--red);">[富岳(-2)]</span>`); }); gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (富岳三十六景)</span> <span>对手非魔术攻击威力-2</span></div>`); }) },
        "魔天之车轮": { onCombatStart: wrap((pt, all, gl) => { let tgt = all.filter(o => o.id !== pt.id && !o.ply.usedCSThisTurn); tgt.forEach(o => { o.pendingSuppression = (o.pendingSuppression||0) + 5; }); let exempt = all.filter(o => o.id !== pt.id && o.ply.usedCSThisTurn); gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (支配之眼)</span> <span>未花费令咒的对手关闭一半攻击${exempt.length ? `（${exempt.map(o=>o.ply.master.name).join('、')} 本回合已使用令咒，免疫）` : ''}</span></div>`); }) },
        "唤起恐慌之魔笛": { onCombatStart: wrap((pt, all, gl) => { all.filter(o => o.id !== pt.id).forEach(o => { o.pendingSuppression = (o.pendingSuppression||0) + 6; }); gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (唤起恐慌之魔笛)</span> <span>对手仅剩一张攻击可用</span></div>`); }) },
        "神授智慧": { onCombatEnd: wrap((pt, winners, all, gl) => { let isWin = winners.some(w => w.id === pt.id); if(isWin){ pt.ply.vp += 2; gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (神授智慧)</span> <span>交换心得，+2 战果</span></div>`); } }) },
        "绅士之爱": { onCombatWin: wrap((pt, winners, all, gl) => { if(winners.length === 1){ Engine.drawCards(pt.ply, 3); let rm = Math.min(1, pt.ply.hand.length); if(rm > 0) pt.ply.discard.push(pt.ply.hand.pop()); pt.ply.vp += 3; gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (绅士之爱)</span> <span>独占争夺战：抽3弃1，+3 战果</span></div>`); } }) },
        "海盗绅士": { onAction: wrap((p) => { p.vp += 2; Engine.log(`【海盗绅士·会谈】瓜分事件牌战果，+2 战果！`, "var(--vp)"); }) },
        "牛王招雷·天网恢恢": { onAction: wrap((p) => { p.legionBuff = (p.legionBuff||0) + 6; Engine.log(`【牛王招雷·天网恢恢】追加打出至多2张攻击（合计+6，免一张消耗）！`, "var(--gold)"); }), onCombatCalc: wrap((pt) => { if(pt.ply.legionBuff){ pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[天网恢恢(+${pt.ply.legionBuff})]</span>`); } }) },
        "瞋恚之炎": { onCombatStart: wrap((pt, all, gl) => { oppLose(all, pt, gl, "power", 3, "瞋恚之炎"); }) },
        // ===== batch2 manual skills (merged from _gen_batch_2.js) =====
        "红叶狩": {
            onAction: wrap((p) => {
                let idx = p.hand.findIndex(cid => { let c = Engine.getCardData(cid); return c && ((c.type||"").includes("魔") || (c.type||"").includes("特殊")); });
                p._momijiStore = p._momijiStore || 0;
                if(idx > -1){
                    let cid = p.hand.splice(idx, 1)[0]; p.discard.push(cid); p._momijiStore++;
                    Engine.log(`【红叶狩】${p.master.name} 将一张魔术或特殊牌放置于此牌上（当前${p._momijiStore}张）。`, "var(--mana)");
                } else { Engine.log(`【红叶狩】${p.master.name} 手中无魔术或特殊牌可放置。`, "#aaa"); return; }
                if(p._momijiStore >= 2){
                    p._momijiStore = 0;
                    p.legionBuff = (p.legionBuff||0) + 8;
                    Engine.log(`【红叶狩】弃置2张牌上的牌，将【变化（恐龙）】加入攻击（合计+8）！`, "var(--gold)");
                }
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.legionBuff){ pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[变化·恐龙(+${pt.ply.legionBuff})]</span>`); } })
        },
        "虎啊，煌煌燎燃": {
            onAction: wrap((p) => {
                State.players.filter(op => op.isAlive).forEach(op => {
                    let revealed = 0;
                    while(op.deck.length > 0 && revealed < 5){
                        let cid = op.deck.pop(); let c = Engine.getCardData(cid);
                        if(!c) break;
                        if((c.type||"").includes("特殊")){
                            op.hand.push(cid);
                            Engine.log(`【虎啊，煌煌燎燃】${op.master.name} 展示出特殊牌【${c.name}】，可将其打出（加入手牌）！`, "var(--gold)");
                            break;
                        }
                        op.discard.push(cid); revealed++;
                    }
                });
                Engine.log(`【虎啊，煌煌燎燃】${p.master.name} 令所有玩家展示牌库顶的牌直至特殊牌，其余展示牌弃置！`, "var(--gold)");
            })
        },
        "花海": {
            onAction: wrap((p) => {
                let resolve = x => {
                    p._hanamiX = x;
                    if(p._hanamiX === 0){ p.mana = Math.max(0, p.mana - 5); Engine.log(`【花海】${p.master.name} X=0，失去5点魔力，战场所有消耗为0的攻击威力将减至0！`, "var(--mana)"); }
                    else Engine.log(`【花海】${p.master.name} X=${p._hanamiX}，战场中消耗为${p._hanamiX}的攻击威力将减至0！`, "var(--mana)");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose("【花海】选择幻术效果", [
                        {label:"X=0：失去5点魔力，费用为0的攻击威力归0"},
                        {label:"X=1：费用为1的攻击威力归0"}
                    ], i => resolve(i === 0 ? 0 : 1), () => {});
                    return;
                }
                resolve([0,1][Math.floor(Math.random()*2)]);
            }),
            onCombatStart: wrap((pt, all, gl) => {
                let x = (pt.ply._hanamiX === undefined) ? 0 : pt.ply._hanamiX;
                all.filter(o => o.id !== pt.id).forEach(o => {
                    let hits = (o.cards||[]).filter(cid => Engine.getCardData(cid) && Number(Engine.getCardData(cid).cost) === x).length;
                    if(hits > 0){
                        o.pendingSuppression = (o.pendingSuppression||0) + 5 * hits;
                        o.tags.push(`<span style="color:var(--red);">[幻术·${hits}张归0]</span>`);
                    }
                });
                gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (花海·幻术)</span> <span>战场中消耗为${x}的攻击威力减至0</span></div>`);
            })
        },
        "花开堪折直须折": {
            onAction: wrap((p) => {
                let c = (State.actionChoices[p.id] || {cards:[]});
                let pwr = (c.cards||[]).reduce((s, cid) => s + ((Engine.getCardData(cid) && Number(Engine.getCardData(cid).power)) || 0), 0);
                if(pwr > 12){ p.vp += 3; Engine.log(`【花开堪折直须折】${p.master.name} 当前合计威力${pwr}＞12，获得所在战场一张事件牌的战果（+3）并弃置该事件牌！`, "var(--vp)"); }
                else Engine.log(`【花开堪折直须折】${p.master.name} 当前合计威力${pwr}，未超过12，效果未获得。`, "#aaa");
            })
        },
        "坏音霹雳": {
            onCombatCalc: wrap((pt, all, gl) => {
                all.filter(o => o.id !== pt.id).forEach(o => { o.pendingSuppression = (o.pendingSuppression||0) + 3; });
                let bonus = 4, extra = false;
                if(pt.ply.mana >= 3){ pt.ply.mana -= 3; bonus = 8; extra = true; }
                pt.p += bonus;
                pt.tags.push(`<span style="color:var(--gold);">[坏音霹雳(+${bonus})]</span>`);
                gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (坏音霹雳)</span> <span>关闭比利小子的技能牌（对手-3），激活${extra ? "所有暗置迅捷攻击（花费3魔力，+" : "至多2张暗置迅捷攻击（+"}${bonus}）</span></div>`);
            })
        },
        "幻世隔绝的理想乡": {
            onCombatStart: wrap((pt, all, gl) => {
                all.filter(o => o.id !== pt.id).forEach(o => { o.pendingSuppression = (o.pendingSuppression||0) + 4; });
                gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (幻世隔绝的理想乡)</span> <span>关闭战斗中部分对手攻击（其合计威力受减益）</span></div>`);
            })
        },
        "黄金冲击": {
            // 每局游戏限一次的强力宝具：魔力少于8也可打出、局势牌无法禁止（打出限制由规则层处理）
            onCombatCalc: wrap((pt) => { pt.p += 10; pt.tags.push(`<span style="color:var(--gold);">[黄金冲击(+10)]</span>`); })
        },
        "黄金噬者": {
            onCombatCalc: wrap((pt, all, gl) => {
                let gain = 2;
                if(pt.ply.mana >= 7){ pt.ply.mana -= 7; gain += 2; }
                pt.ply.vp += gain;
                gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (黄金噬者)</span> <span>【黄金冲击】回归技能区${gain > 2 ? "（花费7魔力再回收一张）" : ""}，+${gain} 战果</span></div>`);
            })
        },
        "黄金之箭": {
            onCombatEnd: wrap((pt, winners, all, gl) => {
                let wOpp = winners.filter(w => w.id !== pt.id);
                if(wOpp.length){
                    wOpp[0].ply.commandSpells = Math.min(3, wOpp[0].ply.commandSpells + 1);
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (黄金之箭)</span> <span>获胜者 ${wOpp[0].ply.master.name} 获得一枚【裁决者令咒】</span></div>`);
                }
            })
        },
        "火箭飞拳": {
            onAction: wrap((p) => {
                let myIdx = State.players.indexOf(p);
                let targets = State.players.filter((op, i) => op.isAlive && i > myIdx && op.location === p.location && (op.location === "深山町" || op.location === "新都"));
                if(!targets.length){ Engine.log(`【火箭飞拳】砰！同战场无回合顺位在你之后的对手。`, "#aaa"); return; }
                let t = targets[Math.floor(Math.random() * targets.length)];
                let dest = t.location === "深山町" ? "新都" : "深山町";
                moveTo(t, dest, "火箭飞拳·砰！");
                Engine.log(`【火箭飞拳】砰！${p.master.name} 将 ${t.master.name} 沿箭头移动至【${dest}】（每回合可使用两次）！`, "var(--gold)");
            })
        },
        "机关幻法·吞牛": {
            onAction: wrap((p) => {
                let maxN = Math.min(5, p.hand.length);
                let resolve = n => {
                    n = Math.max(0, Math.min(Number(n) || 0, maxN));
                    let sum = 0;
                    for(let i = 0; i < n; i++){ let cid = p.hand.pop(); let c = Engine.getCardData(cid); sum += (c && Number(c.power)) || 0; p.discard.push(cid); }
                    p._vacuumBlade = sum;
                    Engine.log(`【机关幻法·吞牛】${p.master.name} 真空刀刃：展示并弃置${n}张手牌，记录基本威力之和X=${sum}。`, "var(--mana)");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose("【机关幻法·吞牛】选择展示并弃置的手牌数量", Array.from({length:maxN + 1}, (_, i) => ({label:`${i}张手牌`})), i => resolve(i), () => {});
                    return;
                }
                resolve(Math.min(3, maxN));
            }),
            onCombatFinal: wrap((pt, all, gl) => {
                let x = pt.ply._vacuumBlade || 0;
                if(x > 0){
                    defeatOpp(pt, all, gl, "真空刀刃", o => !(o.cards||[]).some(cid => { let c = Engine.getCardData(cid); return c && (Number(c.power)||0) > x; }), "one");
                    pt.ply._vacuumBlade = 0;
                }
            })
        },
        "姬路城": {
            // 从天而降：令一名位于你所在地点且拥有3点及以上地利的对手【败北】
            onCombatFinal: wrap((pt, all, gl) => { defeatOpp(pt, all, gl, "从天而降", o => (o.locBonus||0) >= 3, "one"); })
        },
        "极刑王": {
            onAction: wrap((p) => {
                let rec = (State.outpostRecords||{})[p.location];
                let hasDili = rec && rec.indexOf(p.id) > -1 && (p.location === "深山町" || p.location === "新都");
                p.autoSkillBuff = (p.autoSkillBuff||0) + 3;
                let msg = `打出一张牌（+3合计威力）`;
                if(hasDili && p.mana >= 2){ p.mana -= 2; p.autoSkillBuff += 3; msg += `；持有地利，花费2魔力再打出一张（共+6）`; }
                Engine.log(`【极刑王】${p.master.name} ${msg}！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[极刑王(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "疾驰·精灵眼球": {
            onCombatStart: wrap((pt, all, gl) => {
                suppressAttr(pt, all, gl, "特殊", "疾驰·精灵眼球");
                gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (疾驰·精灵眼球)</span> <span>魔术攻击与合计威力不会被其他玩家削减</span></div>`);
            })
        },
        "皎皎明月": {
            onAction: wrap((p) => {
                p.autoSkillBuff = (p.autoSkillBuff||0) + 5;
                Engine.log(`【皎皎明月】${p.master.name} 局势牌无法禁止宝具，追加打出【吞噬吾心吧，月光】（+5合计威力）！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[月光(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "金苹果": {
            onAction: wrap((p) => {
                let opps = State.players.filter(op => op.isAlive && op.id !== p.id);
                if(!opps.length){ Engine.log(`【金苹果】耀眼的光芒：无其他玩家可选。`, "#aaa"); return; }
                let resolve = t => {
                    if(!t) return;
                    t._goldenAppleStuck = true;
                    t.mana = Math.max(0, t.mana - 2);
                    Engine.log(`【金苹果】耀眼的光芒！${t.master.name} 本回合无法移动（移动魔力受阻-2）！`, "var(--gold)");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choosePlayer("【金苹果】耀眼的光芒：选择一位玩家", opps, i => resolve(opps[i]), () => {});
                    return;
                }
                resolve(opps[Math.floor(Math.random()*opps.length)]);
            })
        },
        "金星神·火炎天主": {
            onCombatStart: wrap((pt, all, gl) => {
                all.filter(o => o.id !== pt.id).forEach(o => { o.pendingSuppression = (o.pendingSuppression||0) + 4; });
                gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (金星神·火炎天主)</span> <span>魔力同调：同战场对手的暗置技能无法被使用</span></div>`);
            })
        },
        "景清不灭": {
            // 复仇之怨念-被动：暗置攻击视为印刷威力0、无色、持续激活的【残留】攻击（QA#30-35，可被效果加威力）
            // 被动/前哨（近似为行动阶段发动）：若你未控制暗置攻击，花费3点魔力，抽2张牌暗置打出（转入暗影区持续残留，回合结束可关闭）
            onAction: wrap((p) => {
                let c = State.actionChoices[p.id] || {cards:[], facedown:[]};
                let hasShadow = ((p.kagekiyoShadow||[]).length + (c.facedown||[]).length) > 0;
                if(hasShadow){ Engine.log(`【景清不灭】你已控制暗置攻击，无法发动（需未控制暗置攻击时才可发动）。`, "#aaa"); return; }
                if(!payCost(p, 3, "景清不灭")) return;
                let drawn = [];
                for(let i=0;i<2;i++){
                    if(p.deck.length === 0){ if(p.discard.length > 0){ p.deck = window.shuffleArray([...p.discard]); p.discard = []; } else break; }
                    drawn.push(p.deck.pop());
                }
                if(!drawn.length){ Engine.log(`【景清不灭】牌库已空，效果落空。`, "#aaa"); return; }
                p.kagekiyoShadow = [...(p.kagekiyoShadow||[]), ...drawn];
                Engine.log(`【景清不灭】${p.master.name} 花费3点魔力，抽2张牌暗置打出（印刷威力视为0、无色、持续激活的残留攻击，回合结束可关闭；QA#30-35）。`, "var(--mana)");
            })
        },
        "局中法度": {
            onAction: wrap((p) => {
                let c = (State.actionChoices[p.id] || {cards:[]});
                let types = (c.cards||[]).map(cid => Engine.getCardData(cid) && Engine.getCardData(cid).type).filter(Boolean);
                let violate = types.length >= 2 && types.some(a => types.some(b => b !== a));
                if(violate){
                    let n = p.hand.length;
                    p.discard.push(...p.hand); p.hand = [];
                    p.legionBuff = (p.legionBuff||0) + 10;
                    Engine.log(`【局中法度】${p.master.name} 违背法度：和！弃置${n}张手牌，替换为两张力量属性3/7的【狂战士】（合计+10）！`, "var(--red)");
                } else Engine.log(`【局中法度】法度：和——未违背（需控制两张不同属性的基础攻击）。`, "#aaa");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.legionBuff){ pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--red);">[局中法度·狂战士(+${pt.ply.legionBuff})]</span>`); } })
        },
        "巨影，现于生命之海": {
            onAction: wrap((p) => {
                let c = (State.actionChoices[p.id] || {cards:[], facedown:[]});
                let x = 1 + (c.cards||[]).length + (c.facedown||[]).length;
                if(payCost(p, 2 * x, "巨影，现于生命之海")){
                    p.autoSkillBuff = (p.autoSkillBuff||0) + 4;
                    Engine.log(`【巨影，现于生命之海】${p.master.name} 支付${2*x}点魔力，本回合不会因幼儿退行关闭攻击且无法使用【渴爱之眠】（+4合计威力）！`, "var(--mana)");
                }
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--mana);">[巨影(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "可爱的纪念品": {
            onCombatStart: wrap((pt, all, gl) => { suppressAttr(pt, all, gl, "力量", "可爱的纪念品"); })
        },
        "渴爱之眠": {
            onAction: wrap((p) => {
                Engine.addMana(p, 2);
                Engine.log(`【渴爱之眠】${p.master.name} 的至多2张非特殊基础攻击获得【残留】，本回合每关闭一张基础攻击获得1点魔力（先行获得2点）！`, "var(--mana)");
            })
        },
        "克里米亚天使": {
            onAction: wrap((p) => {
                if(p.location === "魔术工房"){
                    Engine.addMana(p, 1);
                    let opps = State.players.filter(op => op.isAlive && op.id !== p.id);
                    let nightingale = opps.find(op => op.servant && String(op.servant.trueName||"").includes("南丁格尔")) || opps[Math.floor(Math.random()*opps.length)];
                    if(nightingale){
                        nightingale.vp += 2;
                        Engine.log(`【克里米亚天使】${p.master.name} 部署于魔术工房，获得1点魔力，${nightingale.master.name}（南丁格尔）获得2点战果！`, "var(--vp)");
                    } else Engine.log(`【克里米亚天使】${p.master.name} 部署于魔术工房，获得1点魔力！`, "var(--mana)");
                } else Engine.log(`【克里米亚天使】未部署于魔术工房，效果未触发（部署工房时获得1魔力，南丁格尔+2战果，且不能离开）。`, "#aaa");
            })
        },
        "来自止境": {
            onAction: wrap((p) => {
                if(p.commandSpells > 0){
                    p.commandSpells -= 1; p.usedCSThisTurn = true;
                    p.autoSkillBuff = (p.autoSkillBuff||0) + 4;
                    Engine.log(`【来自止境】${p.master.name} 花费一枚令咒，摩根成为【狂战士】，其魔术攻击与【远隔操作】获得宝具属性和+3威力（合计+4）！`, "var(--red)");
                } else Engine.log(`【来自止境】无令咒可用，效果未发动。`, "#aaa");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--red);">[止境(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "莱茵的黄金": {
            onCombatEnd: wrap((pt, winners, all, gl) => {
                let holders = all.filter(o => o.id !== pt.id && (o.ply.servant.skillCards||[]).some(sc => sc && sc.name === "流离魔剑·圣妃失坠"));
                if(holders.length){
                    holders.forEach(o => { o.ply.vp = Math.max(0, o.ply.vp - 3); });
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (莱茵的黄金·遗弃之爱)</span> <span>【流离魔剑·圣妃失坠】回归：${holders.map(o=>o.ply.master.name).join('、')} 各失去3点战果且下回合无法使用宝具</span></div>`);
                } else gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (莱茵的黄金·遗弃之爱)</span> <span>回合结束，【流离魔剑·圣妃失坠】返回技能区</span></div>`);
            })
        },
        "了结剑": {
            onCombatCalc: wrap((pt) => {
                let pend = pt.ply._settleSwordNext || 0;
                if(pend > 0){
                    pt.p += pend;
                    pt.tags.push(`<span style="color:var(--gold);">[了结剑·斩(+${pend})]</span>`);
                    pt.ply._settleSwordNext = 0;
                } else {
                    let agi = (pt.cards||[]).filter(cid => { let c = Engine.getCardData(cid); return c && ((c.type||"").includes("迅捷") || (c.type||"").includes("敏捷")); });
                    if(agi.length){
                        let x = Math.max(...agi.map(cid => (Number(Engine.getCardData(cid).power)||0)));
                        pt.ply._settleSwordNext = x;
                        pt.tags.push(`<span style="color:var(--gold);">[了结剑·记录X=${x}]</span>`);
                    }
                }
            })
        },
        "里迪尔·赫萝蒂": {
            onCombatCalc: wrap((pt, all, gl) => {
                let dawn = all.filter(o => o.id !== pt.id && (o.servantSkills||[]).some(i => { let sk = o.ply.servant.skillCards[i]; return sk && sk.name === "破灭之黎明"; }));
                if(dawn.length){ pt.p += 5; pt.tags.push(`<span style="color:var(--gold);">[里迪尔·赫萝蒂(+5·魔术属性)]</span>`); }
                else { pt.p += 3; pt.tags.push(`<span style="color:var(--gold);">[里迪尔·赫萝蒂(+3·迅捷属性)]</span>`); }
            })
        },
        "连携爆弹": {
            onAction: wrap((p) => {
                if(!p.isRevealed) Engine.log(`【连携爆弹·超频】${p.master.name} 真名隐藏，可追加打出任意张加藤段藏的技能牌（魔力少于8点也可打出）！`, "var(--gold)");
                else Engine.log(`【连携爆弹·超频】${p.master.name} 真名已公开，超频追加不可用。`, "#aaa");
            }),
            onCombatWin: wrap((pt, winners, all, gl) => {
                pt.ply.isRevealed = false;
                Engine.drawCards(pt.ply, 4);
                gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (连携爆弹·战术重构)</span> <span>获胜：隐藏真名并抽4张牌</span></div>`);
            })
        },
        "灵子转让": {
            onAction: wrap((p) => {
                p.autoSkillBuff = (p.autoSkillBuff||0) + 5;
                Engine.log(`【灵子转让】${p.master.name} 选择一张宝具属性牌，本回合即使魔力少于8点也可将其免费打出（+5合计威力近似）！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[灵子转让(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "令咒": {
            onAction: wrap((p) => {
                p.commandSpells = Math.min(3, p.commandSpells + 1);
                Engine.log(`【令咒】${p.master.name} 立刻恢复一枚令咒（当前${p.commandSpells}枚）！`, "var(--cs)");
            })
        },
        "流离魔剑·圣妃失坠": {
            onCombatLose: wrap((pt, winners, all, gl) => {
                let before = (pt.vpBeforeCombat !== undefined) ? pt.vpBeforeCombat : Math.max(0, pt.ply.vp - 3);
                let lost = Math.max(0, pt.ply.vp - before);
                if(lost > 0){
                    pt.ply.vp = Math.min(pt.ply.vp, before);
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (流离魔剑·屠我诅咒)</span> <span>未能获胜，失去本回合获得的战果（-${lost}）</span></div>`);
                }
            }),
            onCombatWin: wrap((pt, winners, all, gl) => {
                pt.ply.vp += 2;
                gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (流离魔剑·杀我报偿)</span> <span>选择自己持有此剑，克琳希德获得2点战果</span></div>`);
            })
        },
        "罗生门大怨起": {
            onCombatCalc: wrap((pt, all, gl) => {
                let opps = all.filter(o => o.id !== pt.id);
                if(!opps.length || !pt.ply._ghostPull){
                    pt.ply._ghostPull = true;
                }
                if(!opps.length) return;
                let t = opps[Math.floor(Math.random()*opps.length)];
                if(t.ply.hand.length > 0){
                    let cid = t.ply.hand.splice(Math.floor(Math.random()*t.ply.hand.length), 1)[0];
                    t.ply.discard.push(cid);
                    let x = (Engine.getCardData(cid) && Number(Engine.getCardData(cid).power)) || 0;
                    opps.forEach(o => { o.p = Math.max(0, o.p - x); o.tags.push(`<span style="color:var(--red);">[恶鬼缠身(-${x})]</span>`); });
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (罗生门大怨起)</span> <span>恶鬼缠身！${t.ply.master.name} 被拉入战场并随机弃置一张牌（威力${x}），同战场对手合计威力-${x}</span></div>`);
                } else gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (罗生门大怨起)</span> <span>恶鬼缠身！${t.ply.master.name} 被拉入战场（无手牌可弃）</span></div>`);
            })
        },
        "落日帝国": {
            onCombatFinal: wrap((pt, all, gl) => {
                if(pt.ply._used_LuoRiDiGuo) return;
                let maxP = Math.max(...all.map(o => o.p));
                if(pt.p < maxP){
                    pt.ply._used_LuoRiDiGuo = true;
                    pt.isAvoidDefeat = true;
                    pt.ply._sunsetVpDouble = true;
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (落日帝国·尽归尘土)</span> <span>免于淘汰（每局一次），下回合获得的战果翻倍！</span></div>`);
                }
            })
        },
        "梅尔特病毒": {
            onCombatStart: wrap((pt, all, gl) => {
                all.filter(o => o.id !== pt.id).forEach(o => { o.pendingSuppression = (o.pendingSuppression||0) + 4; });
                gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (梅尔特病毒·吸收)</span> <span>所有交战对手被【感染】一张技能直至回合结束，无法使用</span></div>`);
            })
        },
        "美狄亚 - 派遣": {},
        "美狄亚 (Attack)": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                Engine.addMana(pt.ply, 2);
                Engine.createJasonDispatch(pt.ply, "sc_jason_3");
                pt.ply.jasonMedeaBuffPendingDay = State.day + 1;
                gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (美狄亚)</span> <span>获得2点魔力并派遣【美狄亚】，下个回合获得+4合计威力</span></div>`);
            })
        },
        "蒙娜丽莎的微笑": {
            onAction: wrap((p) => {
                Engine.drawCards(p, 1);
                Engine.log(`【蒙娜丽莎的微笑】${p.master.name} 于达·芬奇开始拍卖时直接结束拍卖并获得物品（抽1张牌近似）！`, "var(--vp)");
            })
        },
        "梦幻魅力": {
            onAction: wrap((p) => {
                let locs = ['深山町','新都','侦察','魔术工房'];
                let resolve = dest => moveTo(p, locs.includes(dest) ? dest : p.location, "梦幻魅力");
                if(p.isPlayer && p.id===Network.myPlayerId){ Interaction.chooseLocation("【梦幻魅力】选择移动地点", locs, i => resolve(locs[i]), () => {}); return; }
                resolve(['深山町','新都','侦察'][Math.floor(Math.random()*3)]);
            })
        },
        "梦幻召唤-弓兵": {
            onCombatWin: wrap((pt, winners, all, gl) => {
                let myIdx = State.players.findIndex(op => op.id === pt.ply.id);
                let after = State.players.filter((op, i) => i > myIdx && op.isAlive).length;
                if(after > 0){
                    pt.ply.vp += after;
                    gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (梦幻召唤-弓兵)</span> <span>获胜，当前回合顺位在后的玩家${after}名，+${after} 战果</span></div>`);
                }
            })
        },
        "梦幻召唤-魔术师": {
            onAction: wrap((p) => {
                let resolve = choice => {
                    if(choice === "费用-3"){
                        Engine.addMana(p, 3);
                        Engine.log(`【梦幻召唤-魔术师】${p.master.name} 另一张【梦幻召唤】费用-3（获得3点魔力）！`, "var(--mana)");
                    } else {
                        p.autoSkillBuff = (p.autoSkillBuff||0) + 4;
                        Engine.log(`【梦幻召唤-魔术师】${p.master.name} 另一张【梦幻召唤】威力+4！`, "var(--gold)");
                    }
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose("【梦幻召唤-魔术师】选择另一张【梦幻召唤】的效果", [
                        {label:"威力+4"},
                        {label:"费用-3，获得3点魔力"}
                    ], i => resolve(i === 1 ? "费用-3" : "威力+4"), () => {});
                    return;
                }
                resolve("威力+4");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[梦幻召唤·魔术(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "梦幻召唤-骑兵": {
            // 可于常规出牌时追加打出此牌
            onCombatCalc: wrap((pt) => { pt.p += 3; pt.tags.push(`<span style="color:var(--gold);">[梦幻召唤·骑兵(+3)]</span>`); })
        },
        "梦幻召唤-枪兵": {
            onAction: wrap((p) => {
                let locs = ['深山町','新都','侦察'];
                let resolve = dest => moveTo(p, locs.includes(dest) ? dest : "新都", "梦幻召唤-枪兵");
                if(p.isPlayer && p.id===Network.myPlayerId){ Interaction.chooseLocation("【梦幻召唤-枪兵】选择移动地点", locs, i => resolve(locs[i]), () => {}); return; }
                resolve(locs[Math.floor(Math.random()*3)]);
            })
        },
        "冥界佑护": {
            onAction: wrap((p) => {
                Engine.addMana(p, 1);
                Engine.log(`【冥界佑护】有玩家部署于此战场，埃列什基伽勒获得1点魔力！`, "var(--mana)");
            }),
            onCombatStart: wrap((pt, all, gl) => {
                all.filter(o => o.id !== pt.id).forEach(o => { o.pendingSuppression = (o.pendingSuppression||0) + 4; });
                gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (冥界佑护)</span> <span>对手来自局势牌与事件牌的力量修正值乘以-1</span></div>`);
            })
        },
        "魔卡皮套": {
            onAction: wrap((p) => {
                if(p._mokaStored){
                    p._mokaStored = false;
                    Engine.addMana(p, 3);
                    Engine.log(`【魔卡皮套】${p.master.name} 弃置其上的牌，获得等同于其魔力消耗的魔力（+3）！`, "var(--mana)");
                } else {
                    p._mokaStored = true;
                    Engine.log(`【魔卡皮套】${p.master.name} 将一张手牌正面朝上放置于此牌上（可如同手牌般打出）。`, "var(--gold)");
                }
            })
        },
        "魔力斩击": {
            onAction: wrap((p) => {
                if(p.mana >= 8){
                    p.autoSkillBuff = (p.autoSkillBuff||0) + 3;
                    Engine.log(`【魔力斩击】${p.master.name} 打出时拥有至少8点魔力，此牌威力+3！`, "var(--mana)");
                } else Engine.log(`【魔力斩击】${p.master.name} 打出时魔力不足8点，无额外威力。`, "#aaa");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--mana);">[魔力斩击(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "魔性束缚": {
            onCombatStart: wrap((pt, all, gl) => {
                all.filter(o => o.id !== pt.id).forEach(o => { o.pendingSuppression = (o.pendingSuppression||0) + 5; });
                gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (魔性束缚·野性法则)</span> <span>对手被使用过行动/战斗阶段能力的攻击威力设为0</span></div>`);
            })
        },
        "木剑": {
            // 卡面无额外文字描述：作为基础攻击结算
            onCombatCalc: wrap((pt) => { pt.p += 2; pt.tags.push(`<span style="color:var(--vp);">[木剑(+2)]</span>`); })
        },
        "逆推法": {
            onAction: wrap((p) => {
                let attrs = ['力量','迅捷','魔术','特殊'];
                let resolve = a => {
                    p._deduceAttr = attrs.includes(a) ? a : '力量';
                    Engine.log(`【逆推法】${p.master.name} 秘密记录【${p._deduceAttr}】属性攻击。`, "var(--mana)");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose("【逆推法】选择要秘密记录的攻击属性", attrs, i => resolve(attrs[i]), () => {});
                    return;
                }
                resolve(attrs[Math.floor(Math.random()*attrs.length)]);
            }),
            onCombatStart: wrap((pt, all, gl) => {
                let attr = pt.ply._deduceAttr || "力量";
                let chk = (attr === "魔术") ? "魔" : attr;
                let hits = all.filter(o => o.id !== pt.id && oppHasAttr(o, chk)).length;
                if(hits > 0){
                    pt.ply.vp += hits;
                    gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (逆推法·${attr})</span> <span>预判命中${hits}名对手，+${hits} 战果</span></div>`);
                }
            })
        },
        "逆推法：力量": {
            onAction: wrap((p) => { Engine.log(`【逆推法：力量】${p.master.name} 秘密记录【力量】属性攻击。`, "var(--mana)"); }),
            onCombatStart: wrap((pt, all, gl) => {
                let hits = all.filter(o => o.id !== pt.id && oppHasAttr(o, "力量")).length;
                if(hits > 0){
                    pt.ply.vp += hits;
                    gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (逆推法：力量)</span> <span>预判命中${hits}名对手，+${hits} 战果</span></div>`);
                }
            })
        },
        "逆推法：魔术": {
            onAction: wrap((p) => { Engine.log(`【逆推法：魔术】${p.master.name} 秘密记录【魔术】属性攻击。`, "var(--mana)"); }),
            onCombatStart: wrap((pt, all, gl) => {
                let hits = all.filter(o => o.id !== pt.id && oppHasAttr(o, "魔")).length;
                if(hits > 0){
                    pt.ply.vp += hits;
                    gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (逆推法：魔术)</span> <span>预判命中${hits}名对手，+${hits} 战果</span></div>`);
                }
            })
        },
        "逆推法：特殊": {
            onAction: wrap((p) => { Engine.log(`【逆推法：特殊】${p.master.name} 秘密记录【特殊】属性攻击。`, "var(--mana)"); }),
            onCombatStart: wrap((pt, all, gl) => {
                let hits = all.filter(o => o.id !== pt.id && oppHasAttr(o, "特殊")).length;
                if(hits > 0){
                    pt.ply.vp += hits;
                    gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (逆推法：特殊)</span> <span>预判命中${hits}名对手，+${hits} 战果</span></div>`);
                }
            })
        },
        "逆推法：迅捷": {
            onAction: wrap((p) => { Engine.log(`【逆推法：迅捷】${p.master.name} 秘密记录【迅捷】属性攻击。`, "var(--mana)"); }),
            onCombatStart: wrap((pt, all, gl) => {
                let hits = all.filter(o => o.id !== pt.id && oppHasAttr(o, "迅捷")).length;
                if(hits > 0){
                    pt.ply.vp += hits;
                    gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (逆推法：迅捷)</span> <span>预判命中${hits}名对手，+${hits} 战果</span></div>`);
                }
            })
        },
        "女神的神核": {
            onCombatStart: wrap((pt, all, gl) => {
                let luckIdx = pt.ply.hand.findIndex(cid => Engine.getCardData(cid) && Engine.getCardData(cid).name === "幸运");
                if(luckIdx < 0){
                    gl.push(`<div class="report-line" style="color:#aaa;"><span>✨ ${pt.ply.master.name} (女神的神核)</span> <span>手中无【幸运】牌，绮想未发动</span></div>`);
                    return;
                }
                pt.ply.discard.push(pt.ply.hand.splice(luckIdx, 1)[0]);
                all.filter(o => o.id !== pt.id).forEach(o => {
                    o.pendingSuppression = (o.pendingSuppression||0) + 3;
                    Engine.addMana(o.ply, 1);
                    Engine.drawCards(o.ply, 1);
                });
                gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (女神的神核·绮想)</span> <span>弃置一张【幸运】，关闭交战对手至多一张攻击（-3），其各获1魔力并抽1张牌</span></div>`);
            })
        },
        "女神的视线": {
            onAction: wrap((p) => {
                let sameLoc = State.players.filter(op => op.isAlive && op.id !== p.id && op.location === p.location);
                let holder = sameLoc.find(op => op.hand.some(cid => Engine.getCardData(cid) && Engine.getCardData(cid).name === "幸运"));
                if(holder){
                    let idx = holder.hand.findIndex(cid => Engine.getCardData(cid) && Engine.getCardData(cid).name === "幸运");
                    let cid = holder.hand.splice(idx, 1)[0];
                    holder.discard.push(cid);
                    p._gazeLucky = true;
                    Engine.log(`【女神的视线】${p.master.name} 展示 ${holder.master.name} 的手牌并打出其【幸运】（本回合无视【败北】效果）！`, "var(--gold)");
                } else {
                    Engine.log(`【女神的视线】${p.master.name} 展示同地点玩家的手牌（${sameLoc.map(op => op.master.name).join('、') || '无'}），未发现【幸运】。`, "#aaa");
                }
            }),
            onCombatFinal: wrap((pt) => {
                if(pt.ply._gazeLucky){
                    pt.ply._gazeLucky = false;
                    pt.isAvoidDefeat = true;
                    pt.tags.push(`<span style="color:var(--gold);">[女神的视线·幸运]</span>`);
                }
            })
        },
        "佩里舞者": {
            onAction: wrap((p) => {
                Engine.drawCards(p, 1);
                p.legionBuff = (p.legionBuff||0) + 5;
                Engine.log(`【佩里舞者】${p.master.name} 抽1张牌，从手牌中打出至多3张基础攻击（合计+5；若未移动则为至多2张）！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.legionBuff){ pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[佩里舞者(+${pt.ply.legionBuff})]</span>`); } })
        },
        "毗沙门天": {
            onCombatEnd: wrap((pt, winners, all, gl) => {
                let losers = all.filter(o => o.id !== pt.id && !winners.some(w => w.id === o.id));
                if(losers.length){
                    let t = losers[Math.floor(Math.random()*losers.length)];
                    t.ply.commandSpells = Math.min(3, t.ply.commandSpells + 1);
                    pt.ply.vp += 1;
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (毗沙门天·武运在天)</span> <span>败者 ${t.ply.master.name} 获得一枚【裁决者令咒】，${pt.ply.master.name} +1 战果</span></div>`);
                }
            })
        },
        "毗天八相车悬之阵": {
            onAction: wrap((p) => {
                p.legionBuff = (p.legionBuff||0) + 3;
                Engine.log(`【毗天八相车悬之阵】${p.master.name} 打出一张基本威力3及以下的攻击（合计+3）！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.legionBuff){ pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[车悬之阵(+${pt.ply.legionBuff})]</span>`); } })
        },
        "破灭之黎明": {
            onAction: wrap((p) => {
                p.vp = Math.max(0, p.vp - 1);
                Engine.log(`【破灭之黎明】诅咒：此牌展示后，${p.master.name} 每个回合开始时失去1点战果！`, "var(--red)");
            }),
            onCombatEnd: wrap((pt, winners, all, gl) => {
                let x = 0;
                all.filter(o => o.id !== pt.id).forEach(o => (o.cards||[]).forEach(cid => { let c = Engine.getCardData(cid); if(c) x = Math.max(x, Number(c.cost)||0); }));
                if(x <= 0) x = 3;
                Engine.addMana(pt.ply, x);
                gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (破灭之黎明)</span> <span>战斗阶段结束，吸收对手攻击的魔力消耗，获得${x}点魔力</span></div>`);
            })
        },
        "破却宣言": {
            onCombatCalc: wrap((pt, all, gl) => {
                if(payCost(pt.ply, 4, "破却宣言")){
                    all.filter(o => o.id !== pt.id).forEach(o => { o.pendingSuppression = (o.pendingSuppression||0) + 6; });
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (破却宣言·破咒一击)</span> <span>花费4点魔力，关闭一张同地点技能牌（对手合计威力-6）</span></div>`);
                }
            })
        },
        "普通魔像（Common Golem）": {
            onCombatEnd: wrap((pt, winners, all, gl) => {
                if(Engine.closeGolemCards) Engine.closeGolemCards(pt, (all || []).filter(o => o.id !== pt.id), gl);
            })
        },
        // ===== 牌库替换牌（远野志贵·退魔者）：按卡牌名触发（战斗结算遍历明置卡时调用） =====
        "闪鞘": { onCombatFinal: wrap((pt, all, gl) => {
            let opps = all.filter(o => o.id !== pt.id);
            if(!opps.length) return;
            pt.ply.damageCount = (pt.ply.damageCount||0) + 1;
            let choice = (State.combatPhaseChoices && State.combatPhaseChoices[pt.id] || {}).flashBlade;
            let t = choice ? opps.find(o => o.id === choice.targetId) : null;
            if(!t) t = opps[Math.floor(Math.random()*opps.length)];
            let topCid = t.ply.deck.length ? t.ply.deck[t.ply.deck.length-1] : null;
            let topCard = topCid ? DB.cards[topCid] : null;
            let actualP = topCard ? (Number(topCard.power)||0) : -1;
            let guess = choice ? Number(choice.guess) : -1;
            if(!Number.isFinite(guess)) guess = -1;
            gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (闪鞘·十六分割)</span> <span>受到1点损伤，猜测 ${t.ply.master.name} 牌库顶牌威力=${guess}（实际：${topCard ? actualP + "（" + topCard.name + "）" : "其牌库已空"}）</span></div>`);
            if(topCard && guess === actualP) defeatOpp(pt, all, gl, "十六分割", o => o.id === t.id, "one");
            else gl.push(`<div class="report-line" style="color:#aaa;"><span>✨ 十六分割</span> <span>未猜中，效果落空</span></div>`);
        }) },
        "闪走": { onCombatCalc: wrap((pt) => { pt.p += 3; pt.tags.push(`<span style="color:var(--gold);">[水月(+3)]</span>`); }) },
        "魔力猛攻": { onCombatCalc: wrap((pt, all, gl) => {
            let opps = all.filter(o => o.id !== pt.id);
            if(pt.ply.location === '深山町' || pt.ply.location === '新都'){
                // 位于战场：交战对手地利改为减少（近似：扣减 2×地利）
                let any = false;
                opps.forEach(o => { let d = (o.locBonus||0) * 2; if(d > 0){ o.p -= d; o.tags.push(`<span style="color:var(--red);">[真言术：燃(-${d})]</span>`); any = true; } });
                if(any) gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (真言术：燃)</span> <span>交战对手的地利转为威力减益</span></div>`);
            } else {
                // 不位于战场：烧毁一名非工房对手的工房（近似：其失去2点魔力）
                let t = opps.filter(o => o.ply.location !== '魔术工房');
                if(t.length){ let v = t[Math.floor(Math.random()*t.length)]; v.ply.mana = Math.max(0, v.ply.mana - 2); gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (真言术：燃·烧毁工房)</span> <span>${v.ply.master.name} 的工房被烧毁，失去2点魔力</span></div>`); }
            }
        }) },
        "戈夫铁拳": {
            onCombatCalc: wrap((pt, all, gl) => {
                // 双拳出击：手牌中还有一张【戈夫铁拳】时弃置之，此牌威力翻倍
                let idx = pt.ply.hand.findIndex(cid => Engine.getCardData(cid) && Engine.getCardData(cid).name === "戈夫铁拳");
                if(idx > -1){ pt.ply.discard.push(pt.ply.hand.splice(idx,1)[0]); pt.p += 2; pt.tags.push(`<span style="color:var(--gold);">[双拳出击·翻倍(+2)]</span>`); gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (双拳出击)</span> <span>弃置一张【戈夫铁拳】，威力翻倍！</span></div>`); }
            }),
            onCombatWin: wrap((pt, winners, all, gl) => { pt.ply.vp += 4; gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (裸拳警告)</span> <span>获胜，+4 战果</span></div>`); })
        },

        // ===== merged from _gen_batch_1.js =====
        "B.B.老虎机": {
            onAction: wrap((p) => {
                p._bbSlotRewards = p._bbSlotRewards || { "力量": 0, "迅捷": 0, "魔术": 0 };
                let pool = State.players.filter(o => o.isAlive);
                let picks = [];
                for (let i = 0; i < 3 && pool.length; i++) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
                let parts = [];
                picks.forEach(t => {
                    if (!t.hand || !t.hand.length) return;
                    let c = t.hand.splice(Math.floor(Math.random() * t.hand.length), 1)[0];
                    t.discard.push(c);
                    let cd = DB.cards[c] || { name: "未知牌", type: "" };
                    let kind = (cd.type || "").includes("力量") ? "力量" : (cd.type || "").includes("迅捷") ? "迅捷" : ((cd.type || "").includes("魔术") || (cd.type || "").includes("魔法")) ? "魔术" : "特殊";
                    if (kind === "特殊") kind = ["力量", "迅捷", "魔术"][Math.floor(Math.random() * 3)];
                    if (kind === "力量") { p.autoSkillBuff = (p.autoSkillBuff || 0) + 2; p._bbSlotRewards["力量"]++; }
                    else if (kind === "迅捷") { p._bbSlotRewards["迅捷"]++; moveTo(p, ["深山町", "新都", "侦察"][Math.floor(Math.random() * 3)], "B.B.老虎机"); }
                    else { Engine.addMana(p, 1); p._bbSlotRewards["魔术"]++; }
                    parts.push(`${t.master.name}弃置【${cd.name}】→${kind}奖励`);
                });
                Engine.log(`【B.B.老虎机】${p.master.name} 老虎机转动：${parts.join('；') || "无人可弃牌"}！`, "var(--gold)");
                let triple = Object.keys(p._bbSlotRewards).filter(k => p._bbSlotRewards[k] >= 3);
                if (triple.length) { p.vp += 3; Engine.log(`【B.B.老虎机】集齐三次${triple.join('、')}奖励，获得3点战果！`, "var(--vp)"); }
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.autoSkillBuff) { pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[B.B.老虎机(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "C.C.C.": {
            onAction: wrap((p) => {
                p._cccMoonMerge = true;
                if (p.location === "深山町" || p.location === "新都") {
                    Engine.log(`【C.C.C.】${p.master.name} 将【${p.location}】与【月之圣杯】合成一处地点直至回合结束！`, "var(--gold)");
                } else {
                    p._cccMoonOnly = true;
                    Engine.log(`【C.C.C.】${p.master.name} 只处于【月之圣杯】，此牌威力+5！`, "var(--gold)");
                }
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply._cccMoonOnly) { pt.p += 5; pt.tags.push(`<span style="color:var(--gold);">[C.C.C.·月之圣杯(+5)]</span>`); } })
        },
        "NF-00仙衰冥脉蛋糕": {
            onAction: wrap((p) => {
                Engine.log(`【NF-00仙衰冥脉蛋糕】${p.master.name} 打出此牌（当你从【货箱】中获得此牌时你将【败北】，按卡牌文本结算）。`, "#aaa");
            }),
            onCombatFinal: wrap((pt, all, gl) => {
                let opps = all.filter(o => o.id !== pt.id);
                if (opps.length < 2) return;
                let targets = opps.filter(o => o.p > pt.p);
                if (targets.length) {
                    targets.forEach(o => o.autoDefeated = true);
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (NF-00仙衰冥脉蛋糕)</span> <span>同战场对手有两名及以上，威力高于其的 ${targets.map(o => o.ply.master.name).join('、')} 【败北】</span></div>`);
                }
            })
        },
        "NF-56迷你巫女": {
            onAction: wrap((p) => {
                let locs = ["深山町", "新都", "侦察", "魔术工房"];
                let resolve = dest => {
                    if (moveTo(p, locs.includes(dest) ? dest : "新都", "NF-56迷你巫女")) {
                        Engine.log(`【NF-56迷你巫女】${p.master.name} 无视【固有结界】完成移动！（获得此牌而不打出时将失去3点魔力）`, "var(--gold)");
                    }
                };
                if(p.isPlayer && p.id===Network.myPlayerId){ Interaction.chooseLocation("【NF-56迷你巫女】选择移动地点", locs, i => resolve(locs[i]), () => {}); return; }
                resolve(locs[Math.floor(Math.random() * 4)]);
            })
        },
        "NFF特殊服务": {
            onAction: wrap((p) => {
                p._nffCrates = (p._nffCrates || 0) + 2;
                Engine.log(`【NFF特殊服务】${p.master.name} 将2张牌背面向上设置于【${p.location}】作为【货箱】：玩家进入时随机加入一张牌至其攻击，战斗阶段结束后货箱返回弃牌堆！`, "var(--gold)");
            }),
            onCombatStart: wrap((pt, all, loc, gl) => {
                let crates = pt.ply._nffCrates || 0;
                if (crates <= 0) return;
                let takers = all.filter(o => o.id !== pt.id).slice(0, crates);
                takers.forEach(o => {
                    pt.ply._nffCrates--;
                    if (Math.random() < 0.25) {
                        o.autoDefeated = true;
                        gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (NFF特殊服务)</span> <span>${o.ply.master.name} 从【货箱】中获得【NF-00仙衰冥脉蛋糕】，【败北】！</span></div>`);
                    } else {
                        Engine.drawCards(o.ply, 1);
                        gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (NFF特殊服务)</span> <span>${o.ply.master.name} 从【货箱】中随机加入一张牌至其攻击</span></div>`);
                    }
                });
            })
        },
        "阿塔兰忒 - 派遣": {},
        "阿塔兰忒 (Attack)": {
            onAction: wrap((p) => {
                Engine.playJasonExtraCard(p, null, "阿塔兰忒·行动阶段");
            }),
            onCombatStart: wrap((pt, all, loc) => {
                if(loc!=="深山町" && loc!=="新都") return;
                Engine.playJasonExtraCard(pt.ply, pt, "阿塔兰忒·战斗阶段");
            }),
            onCombatEnd: wrap((pt, winners, all, gl) => {
                if(Engine.createJasonDispatch(pt.ply, "sc_jason_2")){
                    gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (阿塔兰忒)</span> <span>战斗阶段结束，派遣【阿塔兰忒】</span></div>`);
                }
            })
        },
        "安妮女王之复仇": {
            onAction: wrap((p) => {
                p.legionBuff = (p.legionBuff || 0) + 4;
                Engine.log(`【安妮女王之复仇】${p.master.name} 打出一张以【绅士之爱】移除的牌（魔力消耗不足2视为2，近似+4威力），战斗阶段结束后此牌移除游戏！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.legionBuff) { pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[复仇号·掠夺(+${pt.ply.legionBuff})]</span>`); } })
        },
        "暗黑雾都": {
            onAction: wrap((p) => {
                p.mana = Math.max(0, p.mana - 1);
                let msg = `【暗黑雾都】${p.master.name} 残留：准备阶段失去1点魔力；【深山町】正面朝上的事件牌于所有人战斗阶段开始前保持暗置（你可查看受影响的牌）。`;
                if (p.location === "魔术工房") {
                    p.mana = Math.max(0, p.mana - 3);
                    p.isRevealed = false;
                    msg += `部署于魔术工房：额外失去3点魔力，杰克的真名隐藏并关闭此牌！`;
                }
                Engine.log(msg, "var(--red)");
            }),
            onCombatCalc: wrap((pt) => { pt.p += 2; pt.tags.push(`<span style="color:var(--red);">[雾都(+2)]</span>`); })
        },
        "奥尔科特上校": {
            onAction: wrap((p) => {
                let idx = p.hand.findIndex(c => { let cd = DB.cards[c]; return cd && ["力量", "迅捷", "魔法", "魔术"].includes(cd.type || ""); });
                if (idx > -1) {
                    let c = p.hand.splice(idx, 1)[0];
                    let cd = DB.cards[c] || {};
                    p.legionBuff = (p.legionBuff || 0) + (Number(cd.power) || 0);
                    let opps = State.players.filter(o => o.isAlive && o.id !== p.id && o.location === p.location);
                    let target = opps.length ? opps[Math.floor(Math.random() * opps.length)] : null;
                    if (target) target._alcottSuppressed = true;
                    Engine.log(`【奥尔科特上校】${p.master.name} 打出力量基础攻击【${cd.name}】（+${Number(cd.power) || 0}威力）${target ? `，将 ${target.master.name} 的一张明置从者技能暗置！` : "（无同地点对手可暗置）"}`, "var(--gold)");
                } else {
                    Engine.log(`【奥尔科特上校】手牌中没有基础攻击，效果未发动。`, "#aaa");
                }
            }),
            onCombatStart: wrap((pt, all, loc, gl) => {
                let opps = all.filter(o => o.id !== pt.id && o.ply._alcottSuppressed);
                opps.forEach(o => { o.ply._alcottSuppressed = false; o.pendingSuppression = (o.pendingSuppression || 0) + 3; });
                if (opps.length) gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (奥尔科特上校)</span> <span>${opps.map(o => o.ply.master.name).join('、')} 的明置从者技能被暗置（威力-3近似）</span></div>`);
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.legionBuff) { pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[上校号令(+${pt.ply.legionBuff})]</span>`); } })
        },
        "巴比伦之门": {
            onAction: wrap((p) => {
                p.autoSkillBuff = (p.autoSkillBuff || 0) + 3;
                Engine.log(`【巴比伦之门】${p.master.name} 打开冥府之门：【不死兵】获得+1威力且本回合不会被关闭（合计近似+3）！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.autoSkillBuff) { pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[冥府之门(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "霸王之武": {
            onAction: wrap((p) => {
                let tokens = getToken(p, "反应");
                if (tokens <= 0) { Engine.log(`【霸王之武】${p.master.name} 没有【反应】标记（可经【战术躯体】获得），效果无法启动。`, "#aaa"); return; }
                let opts = [1, 2, 4, 7].filter(v => v <= tokens);
                let resolve = cost => {
                    if (!opts.includes(cost)) return;
                    addToken(p, "反应", -cost);
                    if (cost === 1) {
                        let dest = p.location === "深山町" ? "新都" : "深山町";
                        moveTo(p, dest, "霸王之武·逆行");
                    } else if (cost === 2) {
                        let locs = ["深山町", "新都", "侦察"].filter(loc => loc !== p.location);
                        let move = dest => moveTo(p, dest, "霸王之武·顺行");
                        if(p.isPlayer && p.id===Network.myPlayerId){
                            Interaction.chooseLocation("【霸王之武】选择沿箭头移动地点", locs, i => move(locs[i]), () => addToken(p, "反应", cost));
                            return;
                        }
                        move(locs[Math.floor(Math.random() * locs.length)]);
                    } else if (cost === 4) {
                        let c = p.deck.pop();
                        if (c) { let cd = DB.cards[c] || {}; let pw = Number(cd.power) || 0; p.legionBuff = (p.legionBuff || 0) + pw; p.discard.push(c); Engine.log(`【霸王之武】花费4枚【反应】，打出牌库顶的牌【${cd.name}】（+${pw}威力，支付其魔力消耗）！`, "var(--gold)"); }
                        else Engine.log(`【霸王之武】牌库已空，打出失败。`, "#aaa");
                    } else {
                        p.legionBuff = (p.legionBuff || 0) + 4;
                        Engine.log(`【霸王之武】花费7枚【反应】，免费打出1张手牌（近似+4威力）！`, "var(--gold)");
                    }
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose("【霸王之武】选择支付的【反应】数", opts.map(v => ({label:`支付${v}枚：${v === 1 ? "逆行移动一步" : v === 2 ? "沿箭头移动一步" : v === 4 ? "打出牌库顶的牌" : "免费打出1张手牌"}`})), i => resolve(opts[i]), () => {});
                    return;
                }
                resolve(opts[Math.floor(Math.random() * opts.length)]);
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.legionBuff) { pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[霸王之武(+${pt.ply.legionBuff})]</span>`); } })
        },
        "百合飞散剑之舞蹈": {
            onAction: wrap((p) => {
                p.autoSkillBuff = (p.autoSkillBuff || 0) + 4;
                Engine.log(`【百合飞散剑之舞蹈】${p.master.name} 此牌获得威力+4！若本回合没有进行【格挡】，于战斗阶段回合结束时关闭此牌。`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.autoSkillBuff) { pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[百合飞散(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "百合花开豪华绚烂": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                for (let i = 0; i < 2; i++) {
                    if (!pt.ply.hand.length) break;
                    let c = pt.ply.hand.pop();
                    pt.ply.discard.push(c);
                    let pw = Number((DB.cards[c] || {}).power) || 0;
                    all.filter(o => o.id !== pt.id).forEach(o => { o.pendingSuppression = (o.pendingSuppression || 0) + 2; });
                    pt.ply.autoSkillBuff = (pt.ply.autoSkillBuff || 0) + 3;
                    gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (百合花开·格挡)</span> <span>弃置【${(DB.cards[c] || {}).name}】(威力${pw})，关闭同威力交战攻击（减益近似），此牌+3威力</span></div>`);
                }
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.autoSkillBuff) { pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[百合花开(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "百花缭乱·我爱你": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                all.filter(o => o.id !== pt.id).forEach(o => {
                    let x = Math.ceil((o.ply._initialDeckSize || 12) / 4);
                    let rm = Math.min(x, o.ply.deck.length);
                    for (let i = 0; i < rm; i++) o.ply.deck.pop();
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (百花缭乱·我爱你)</span> <span>${o.ply.master.name} 牌库顶${x}张牌移除游戏（实际移除${rm}张，剩余${o.ply.deck.length}张）</span></div>`);
                });
            }),
            onCombatFinal: wrap((pt, all, gl) => {
                defeatOpp(pt, all, gl, "百花缭乱·我爱你", o => o.ply.deck.length === 0, "all");
            })
        },
        "包围苍天的小世界": {
            onAction: wrap((p) => {
                p._blockSkillTurn = false;
                let resolve = c => {
                    if (!["1", "2", "3"].includes(c)) return;
                    if (c === "1") {
                    let opps = State.players.filter(o => o.isAlive && o.id !== p.id && o.location === p.location && (o.location === "深山町" || o.location === "新都"));
                    let n = 0;
                    opps.forEach(o => { if (o.hand.length) { o.discard.push(o.hand.splice(Math.floor(Math.random() * o.hand.length), 1)[0]); n++; } });
                    Engine.log(`【包围苍天的小世界】湛蓝天空：${n}名同战场对手随机弃置一张手牌！`, "var(--red)");
                } else if (c === "2") {
                    p._blockSkillTurn = true;
                    Engine.log(`【包围苍天的小世界】湛蓝天空：同战场对手本回合无法使用技能牌（战斗威力减益近似）！`, "var(--red)");
                } else {
                    if (payCost(p, 3, "包围苍天的小世界")) { p.isRevealed = false; Engine.log(`【包围苍天的小世界】${p.master.name} 花费3点魔力，从者真名隐藏直至回合结束！`, "var(--mana)"); }
                }
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose("【包围苍天的小世界】选择湛蓝天空效果", [
                        {label:"同战场对手随机弃1张手牌"},
                        {label:"同战场对手无法使用技能牌"},
                        {label:"花费3点魔力隐藏真名"}
                    ], i => resolve(String(i + 1)), () => {});
                    return;
                }
                resolve(["1", "2", "3"][Math.floor(Math.random() * 3)]);
            }),
            onCombatStart: wrap((pt, all, loc, gl) => {
                if (!pt.ply._blockSkillTurn) return;
                pt.ply._blockSkillTurn = false;
                all.filter(o => o.id !== pt.id).forEach(o => { o.pendingSuppression = (o.pendingSuppression || 0) + 3; });
                gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (湛蓝天空)</span> <span>对手无法使用技能牌（威力-3近似）</span></div>`);
            })
        },
        "贝亚德": {
            onAction: wrap((p) => {
                Engine.drawCards(p, 1);
                p.legionBuff = (p.legionBuff || 0) + 9;
                Engine.log(`【贝亚德】${p.master.name} 抽1张牌，从手牌追加打出至多3张基本威力3及以下的牌（合计+9）！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.legionBuff) { pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[贝亚德·援军(+${pt.ply.legionBuff})]</span>`); } })
        },
        "变容": {
            onAction: wrap((p) => {
                let idx = p.hand.findIndex(c => { let cd = DB.cards[c]; return cd && ["力量", "迅捷", "魔法", "魔术"].includes(cd.type || ""); });
                if (idx > -1) {
                    let c = p.hand.splice(idx, 1)[0];
                    let cd = DB.cards[c] || {};
                    p.autoSkillBuff = (p.autoSkillBuff || 0) + (Number(cd.power) || 0);
                    Engine.log(`【变容】${p.master.name} 将基础攻击【${cd.name}】叠放于此牌上，获得其威力（+${Number(cd.power) || 0}）、费用、属性与能力！`, "var(--gold)");
                } else {
                    Engine.log(`【变容】手牌中没有基础攻击可叠放，效果未发动。`, "#aaa");
                }
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.autoSkillBuff) { pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[变容(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "病弱（Weak Constitution）": {
            onCombatCalc: wrap((pt, all, gl) => {
                pt.p = 0;
                pt.tags.push(`<span style="color:var(--red);">[病弱·合计威力为0]</span>`);
                gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (病弱)</span> <span>本回合的合计威力变为0</span></div>`);
            })
        },
        "不灭的混沌旅团": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                if (payCost(pt.ply, 2, "草木皆兵")) {
                    pt.p += 4; pt.tags.push(`<span style="color:var(--red);">[草木皆兵(+4)]</span>`);
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (草木皆兵)</span> <span>花费2点魔力，激活一张暗置攻击并使用至多两次其行动阶段效果（+4威力）</span></div>`);
                }
            }),
            onCombatEnd: wrap((pt, winners, all, gl) => {
                gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (风声鹤唳)</span> <span>若本回合使用了【气息遮断】，战斗阶段结束后【真名解放】并关闭此牌</span></div>`);
            })
        },
        "不容侵犯之拒绝王国": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                pt.p += 3; pt.tags.push(`<span style="color:var(--gold);">[瓜摩尔的抵抗(+3)]</span>`);
                let opps = all.filter(o => o.id !== pt.id);
                if (opps.length) {
                    let t = opps[Math.floor(Math.random() * opps.length)];
                    let dest = loc === "深山町" ? "新都" : "深山町";
                    moveTo(t.ply, dest, "拒绝王国");
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (不容侵犯之拒绝王国)</span> <span>打出一张牌（+3威力），将 ${t.ply.master.name} 移动至相邻地点【${dest}】</span></div>`);
                }
            })
        },
        "不识爱的悲哀之龙啊": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                if (pt.ply.commandSpells > 0) {
                    pt.ply.commandSpells -= 1; pt.ply.usedCSThisTurn = true;
                    pt.ply.autoSkillBuff = (pt.ply.autoSkillBuff || 0) + 4;
                    let opps = all.filter(o => o.id !== pt.id);
                    opps.forEach(o => { o.ply._mustWorkshopNext = true; });
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (不识爱的悲哀之龙啊)</span> <span>花费一枚令咒，此牌+4威力；${opps.length ? opps.map(o => o.ply.master.name).join('、') + ' ' : ''}于下回合前哨阶段如若可能必须部署于魔术工房</span></div>`);
                } else {
                    gl.push(`<div class="report-line" style="color:#aaa;"><span>✨ 不识爱的悲哀之龙啊</span> <span>无令咒可用，效果未发动</span></div>`);
                }
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.autoSkillBuff) { pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[流星之龙(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "不死兵": {
            onCombatCalc: wrap((pt) => { pt.p += 2; pt.tags.push(`<span style="color:var(--red);">[不死兵(+2)]</span>`); }),
            onCombatEnd: wrap((pt, winners, all, gl) => {
                if (all.filter(o => o.id !== pt.id).length > 0) {
                    gl.push(`<div class="report-line" style="color:#aaa;"><span>✨ ${pt.ply.master.name} (不死兵)</span> <span>交战状态：战斗阶段结束后关闭一半数量的【不死兵】（向上取整）</span></div>`);
                }
            })
        },
        "不为一己之荣光(被动)": {
            onAction: wrap((p) => {
                if ((p.commandSpells || 0) <= 0) {
                    p.isRevealed = true;
                    p.autoSkillBuff = (p.autoSkillBuff || 0) + 4;
                    Engine.log(`【不为一己之荣光】${p.master.name} 御主令咒为0枚，【真名解放】（真名不能通过其他方法解放，近似+4威力）！`, "var(--gold)");
                } else {
                    Engine.log(`【不为一己之荣光】${p.master.name} 魔力少于8点也可打出从者技能牌（被动生效中）。`, "var(--gold)");
                }
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.autoSkillBuff) { pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[荣光·解放(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "不再有谎言": {
            onAction: wrap((p) => {
                if (!payCost(p, 1, "不再有谎言")) return;
                let opps = State.players.filter(o => o.isAlive && o.id !== p.id);
                if (!opps.length) { Engine.log(`【不再有谎言】没有可询问的对手。`, "#aaa"); return; }
                let resolve = t => {
                    if(!t) return;
                    let willWin = Math.random() < 0.5;
                    if (Math.random() < 0.5) {
                        t.commandSpells = Math.max(0, (t.commandSpells || 0) - 1);
                        p.vp += 2;
                        Engine.log(`【不再有谎言】${t.master.name} 回答错误（其声称${willWin ? "会" : "不会"}获胜）！失去1枚令咒，${p.master.name} 获得2点战果！`, "var(--red)");
                    } else {
                        Engine.log(`【不再有谎言】${t.master.name} 回答正确（其声称${willWin ? "会" : "不会"}获胜），无事发生。其可选择在战斗阶段开始时使自己【败北】。`, "#aaa");
                    }
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choosePlayer("【不再有谎言】询问一名对手", opps, i => resolve(opps[i]), () => Engine.addMana(p, 1));
                    return;
                }
                resolve(opps[Math.floor(Math.random() * opps.length)]);
            })
        },
        "裁定归灭之回剑": {
            onAction: wrap((p) => {
                if (p._used_裁定归灭之回剑) { Engine.log(`【裁定归灭之回剑】世界重启（每局游戏限一次）已使用过。`, "#aaa"); return; }
                p._used_裁定归灭之回剑 = true;
                Engine.drawCards(p, 1);
                p.autoSkillBuff = (p.autoSkillBuff || 0) + 4;
                Engine.log(`【裁定归灭之回剑】${p.master.name} 世界重启（每局游戏限一次）：下个准备阶段抽取局势牌前，将一张本回合事件牌增加至深山町或新都，并令一张【至高神】或【裁定归灭之回剑】返回技能区（近似：抽1张牌+4威力）！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.autoSkillBuff) { pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[世界重启(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "裁决者": {
            onAction: wrap((p) => {
                let used = p._rulerBindCount || 0;
                if (used >= 3) { Engine.log(`【裁决者】${p.master.name} 的神明裁决（每局游戏限三次）已用尽。`, "#aaa"); return; }
                let opps = State.players.filter(o => o.isAlive && o.id !== p.id).sort((a, b) => (a._boundCount || 0) - (b._boundCount || 0));
                if (!opps.length) return;
                let targets = opps.slice(0, 2);
                p._rulerBindCount = used + 1;
                targets.forEach(o => { o._boundCount = (o._boundCount || 0) + 1; addToken(o, "裁决者令咒", 1); });
                Engine.log(`【裁决者】神明裁决：${p.master.name} 束缚 ${targets.map(o => o.master.name).join('、')}，各获得1枚【裁决者令咒】（剩余${3 - p._rulerBindCount}次）！`, "var(--gold)");
            })
        },
        "裁决之时正是此刻，告此汝之名": {
            onCombatCalc: wrap((pt, all, gl) => {
                let accused = all.filter(o => o.id !== pt.id && getToken(o.ply, "谴责") > 0);
                if (accused.length) {
                    let bonus = Math.min(8, 4 * accused.length);
                    accused.forEach(o => { addToken(o.ply, "谴责", -getToken(o.ply, "谴责")); });
                    pt.p += bonus;
                    pt.tags.push(`<span style="color:var(--gold);">[告此汝之名(+${bonus})]</span>`);
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (裁决之时正是此刻，告此汝之名)</span> <span>移除${accused.length}名玩家的【谴责】，此牌+${bonus}威力（至多+8）</span></div>`);
                }
            })
        },
        "残光、令人憎恶的血之城塞": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                all.filter(o => o.id !== pt.id).forEach(o => {
                    let keepSpecial = oppHasAttr(o, "特殊") || oppHasAttr(o, "宝具");
                    o.pendingSuppression = (o.pendingSuppression || 0) + (keepSpecial ? 2 : 5);
                });
                gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (残光、令人憎恶的血之城塞)</span> <span>交战对手的攻击失去特殊和宝具外的所有属性（威力减益近似）</span></div>`);
            })
        },
        "持爱却枯，无恋也": {
            onAction: wrap((p) => {
                p._mugyuOptions = p._mugyuOptions || { 1: false, 2: false, 3: false, 4: false };
                let avail = [1, 2, 3, 4].filter(k => !p._mugyuOptions[k]);
                if (!avail.length) { Engine.log(`【持爱却枯，无恋也】所有选项均已用过（此牌关闭前每项仅可一次）。`, "#aaa"); return; }

                let resolve = c => {
                    if (!avail.includes(c)) return;

                    if (c === 2) {
                        let locs = ["深山町", "新都", "侦察"];
                        let finishMove = dest => {
                            if (!locs.includes(dest)) return;
                            if (!moveTo(p, dest, "持爱却枯，无恋也")) return;
                            p._mugyuOptions[c] = true;
                        };

                        if (p.isPlayer && p.id===Network.myPlayerId) {
                            Interaction.chooseLocation(
                                "【持爱却枯，无恋也】沿箭头移动至多两个地点",
                                locs,
                                i => finishMove(locs[i]),
                                () => {}
                            );
                            return;
                        }

                        finishMove(locs[Math.floor(Math.random() * locs.length)]);
                        return;
                    }

                    p._mugyuOptions[c] = true;
                    if (c === 1) {
                        p.autoSkillBuff = (p.autoSkillBuff || 0) + 3;
                        Engine.log(`【持爱却枯，无恋也】${p.master.name} 获得3点合计威力！`, "var(--gold)");
                    } else if (c === 3) {
                        let n = 0;
                        State.players.filter(o => o.isAlive && o.location === p.location).forEach(o => { o.mana = Math.max(0, o.mana - 2); n++; });
                        Engine.log(`【持爱却枯，无恋也】【${p.location}】的所有玩家（${n}名）失去2点魔力！`, "var(--red)");
                    } else {
                        Engine.log(`【持爱却枯，无恋也】关闭此牌。`, "#aaa");
                    }
                };

                if (p.isPlayer && p.id===Network.myPlayerId) {
                    Interaction.choose(
                        "【持爱却枯，无恋也】无形者选择效果",
                        avail.map(c => ({
                            label: c === 1
                                ? "获得3点合计威力"
                                : c === 2
                                    ? "沿箭头移动至多两个地点"
                                    : c === 3
                                        ? "同一地点所有玩家失去2点魔力"
                                        : "关闭此牌"
                        })),
                        i => resolve(avail[i]),
                        () => {}
                    );
                    return;
                }

                resolve(avail[Math.floor(Math.random() * avail.length)]);
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.autoSkillBuff) { pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[无形者(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "持翼之神": {
            onAction: wrap((p) => {
                let locs = ["深山町", "新都", "侦察"];
                let gainPower = () => {
                    p.autoSkillBuff = (p.autoSkillBuff || 0) + 3;
                    Engine.log(`【持翼之神】无法执行移动，${p.master.name} 获得3点合计威力！`, "var(--gold)");
                };
                let resolve = dest => {
                    if (!locs.includes(dest) || !moveTo(p, dest, "持翼之神")) {
                        gainPower();
                        return;
                    }
                    Engine.log(`【持翼之神】${p.master.name} 沿路径移动了两个位置！`, "var(--vp)");
                };

                if (p.isPlayer && p.id===Network.myPlayerId) {
                    Interaction.chooseLocation(
                        "【持翼之神】沿路径移动两个位置",
                        locs,
                        i => resolve(locs[i]),
                        gainPower
                    );
                    return;
                }

                resolve(locs[Math.floor(Math.random() * locs.length)]);
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.autoSkillBuff) { pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[持翼之神(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "淬标之魂": {
            onAction: wrap((p) => {
                if (p._used_淬标之魂) { Engine.log(`【淬标之魂】向日葵效果已触发过（随【真名解放】触发，此牌已移除游戏）。`, "#aaa"); return; }
                let parts = [];
                State.players.filter(o => o.isAlive).forEach(o => {
                    let foreign = o.discard.filter(c => DB.cards[c] && DB.cards[c].name === "领域外生命");
                    if (foreign.length) {
                        let loss = Math.min(6, foreign.length * 2);
                        o.vp = Math.max(0, o.vp - loss);
                        foreign.forEach(c => { o.discard.splice(o.discard.indexOf(c), 1); p.hand.push(c); });
                        parts.push(`${o.master.name} 失去${loss}战果，其${foreign.length}张【领域外生命】加入 ${p.master.name} 手牌`);
                    }
                });
                if (parts.length) {
                    p._used_淬标之魂 = true;
                    Engine.log(`【淬标之魂】向日葵：${parts.join('；')}！此牌移除游戏。`, "var(--red)");
                } else {
                    Engine.log(`【淬标之魂】所有玩家的弃牌堆中没有【领域外生命】。`, "#aaa");
                }
            })
        },
        "达·芬奇工房": {
            onAction: wrap((p) => {
                if (p.location !== "魔术工房") { Engine.log(`【达·芬奇工房】${p.master.name} 未部署于魔术工房，效果未发动（X=16-回合数的二倍）。`, "#aaa"); return; }
                Engine.drawCards(p, 3);
                let rm = Math.max(0, Math.min(2, p.hand.length - 1));
                for (let i = 0; i < rm; i++) p.discard.push(p.hand.pop());
                let x = Math.max(0, 16 - (State.day || 1) * 2);
                Engine.log(`【达·芬奇工房】${p.master.name} 抽3张【商店货品】选取并展示其中一张、弃置其余（X=${x}）：其他玩家可支付给你2战果获得展示牌，无人支付则你获得之！`, "var(--gold)");
            })
        },
        "大神的睿智": {
            onAction: wrap((p) => {
                if (payCost(p, 1, "大神的睿智·前哨")) {
                    Engine.drawCards(p, 1);
                    let n = Math.min(2, p.hand.length);
                    for (let i = 0; i < n; i++) p.deck.push(p.hand.pop());
                    p.deck = window.shuffleArray(p.deck);
                    Engine.log(`【大神的睿智】${p.master.name} 花费1点魔力抽1张牌，并将${n}张手牌洗回牌库！`, "var(--mana)");
                }
                if (payCost(p, 3, "大神的睿智·卢恩")) {
                    p.autoSkillBuff = (p.autoSkillBuff || 0) + 4;
                    Engine.log(`【大神的睿智】${p.master.name} 花费3点魔力，根据2张基础攻击的属性组合获得【原初之卢恩】相应效果（近似+4威力）！`, "var(--gold)");
                }
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.autoSkillBuff) { pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[大神的睿智(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "丹德拉大电球": {
            onAction: wrap((p) => {
                p.autoSkillBuff = (p.autoSkillBuff || 0) + 5;
                Engine.log(`【丹德拉大电球】${p.master.name} 魔力炮击！此牌可追加打出（+5威力）；若未在另外一处地点设置【光辉大复合神殿】则关闭此牌，战斗之后将神殿放回技能区。`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.autoSkillBuff) { pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[魔力炮击(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "冻结吧，天上的诸力": {
            onAction: wrap((p) => {
                State._frozenDrawUntil = (State.day || 0) + 1;
                Engine.addMana(p, 2);
                Engine.log(`【冻结吧，天上的诸力】${p.master.name} 直至下回合结束，所有玩家不能抽牌（请手动遵守）；反转：获得2点魔力！`, "var(--mana)");
            })
        },
        "杜尔迦之甲": {
            onCombatCalc: wrap((pt, all, gl) => {
                let cut = [];
                all.forEach(o => { if (o.p > 9) { o.p = 9; o.tags.push(`<span style="color:var(--red);">[杜尔迦之甲(威力降至9)]</span>`); cut.push(o.ply.master.name); } });
                if (cut.length) gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (杜尔迦之甲)</span> <span>${cut.join('、')} 的攻击威力减少至9</span></div>`);
            })
        },
        "对遥远之辈的斩罪": {
            onCombatFinal: wrap((pt, all, gl) => {
                let opps = all.filter(o => o.id !== pt.id);
                if (!opps.length) return;
                let av = pt.ply.hand.filter(c => DB.cards[c] && DB.cards[c].name === "复仇者").slice(0, 2);
                if (!av.length) { gl.push(`<div class="report-line" style="color:#aaa;"><span>✨ 对遥远之辈的斩罪</span> <span>没有可弃置的【复仇者】（需控制【恶嚎】）</span></div>`); return; }
                av.forEach(c => { pt.ply.hand.splice(pt.ply.hand.indexOf(c), 1); pt.ply.discard.push(c); });
                for (let i = 0; i < av.length; i++) defeatOpp(pt, all, gl, "对遥远之辈的斩罪", null, "one");
            })
        },
        "多元重奏饱和炮击": {
            onAction: wrap((p) => {
                p._noManaNextTurn = true;
                p.legionBuff = (p.legionBuff || 0) + 9;
                Engine.log(`【多元重奏饱和炮击】${p.master.name} 下个回合无法获得魔力；【梦幻召唤】获得<每局游戏限一次>并无视每回合1次限制免费打出任意张（近似合计+9）！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.legionBuff) { pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[饱和炮击(+${pt.ply.legionBuff})]</span>`); } })
        },
        "恶龙之血铠": {
            onCombatCalc: wrap((pt, all, gl) => {
                if (pt.ply.isRevealed) {
                    pt.p += 6;
                    pt.tags.push(`<span style="color:var(--gold);">[恶龙之血铠(+6)]</span>`);
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (恶龙之血铠)</span> <span>真名公开且交战状态，血铠增幅+6（对手移动至你所在战场时关闭此牌）</span></div>`);
                }
            })
        },
        "凡性之赠": {
            onAction: wrap((p) => {
                if(p._dioscuriGiftPending) return;
                if(p.hand.length < 2) { Engine.log(`【凡性之赠】手牌不足2张，效果未发动。`, "#aaa"); return; }
                p._dioscuriGiftPending = true;
                let finish = (source) => {
                    let pool = source === "discard" ? p.discard : p.deck;
                    if(!pool || !pool.length){ p._dioscuriGiftPending=false; Engine.log(`【凡性之赠】${source==="discard"?"弃牌堆":"牌库"}没有可检索的牌。`,"#aaa"); return; }
                    let options = pool.map((cid,i)=>({label:DB.cards[cid]?.name||cid, cardId:cid, desc:DB.cards[cid]?.desc||""}));
                    let apply = i => { let cid=pool[i]; if(cid===undefined){p._dioscuriGiftPending=false;return;} let pos=pool.indexOf(cid); if(pos>-1)pool.splice(pos,1); p.hand.push(cid); p._dioscuriGiftPending=false; Engine.log(`【凡性之赠】${p.master.name} 选择【${DB.cards[cid]?.name||cid}】加入手牌！`,"var(--vp)"); UI.updateAll(); UI.renderHand(true); Network.sync(); };
                    if(p.isPlayer&&p.id===Network.myPlayerId) Engine.openChoiceModal(`【凡性之赠】选择${source==="discard"?"弃牌堆":"牌库"}中的一张牌`, options, apply, ()=>{p._dioscuriGiftPending=false;});
                    else apply(Math.floor(Math.random()*options.length));
                };
                let start = () => {
                    let discardPair = pair => {
                        let ids=pair.map(i=>p.hand[i]).filter(Boolean); if(ids.length!==2){p._dioscuriGiftPending=false;return;}
                        ids.forEach(cid=>{let i=p.hand.indexOf(cid);if(i>-1)p.discard.push(p.hand.splice(i,1)[0]);});
                        let useDiscard=p.mana>=4;
                        if(p.isPlayer&&p.id===Network.myPlayerId){ Engine.openChoiceModal("【凡性之赠】选择检索区域", [{label:"从牌库检索",desc:"不额外支付魔力"},{label:"从弃牌堆检索",desc:"额外支付4点魔力",disabled:!useDiscard}], i=>{if(i===1){p.mana-=4;finish("discard");}else finish("deck");}, ()=>{p._dioscuriGiftPending=false;}); }
                        else finish(useDiscard&&Math.random()<0.5?"discard":"deck");
                    };
                    if(p.isPlayer&&p.id===Network.myPlayerId){
                        let first=-1;
                        Engine.openChoiceModal("【凡性之赠】选择要弃置的第1张手牌",p.hand.map((cid,i)=>({label:DB.cards[cid]?.name||cid,desc:DB.cards[cid]?.desc||""})),i=>{
                            first=i;
                            Engine.openChoiceModal("【凡性之赠】选择要弃置的第2张手牌",p.hand.map((cid,i)=>({label:DB.cards[cid]?.name||cid,desc:DB.cards[cid]?.desc||"",disabled:i===first})),i=>discardPair([first,i]),()=>{p._dioscuriGiftPending=false;});
                        },()=>{p._dioscuriGiftPending=false;});
                        return;
                    }
                    discardPair([0,1]);
                };
                start();
            })
        },
        "守护的誓约": {
            onAction: wrap((p) => {
                if(!p.hand || p.hand.length===0){ Engine.log(`【守护的誓约】没有可弃置的手牌。`, "#aaa"); return false; }
                let apply=cid=>{let i=p.hand.indexOf(cid);if(i<0)return false;p.discard.push(p.hand.splice(i,1)[0]);p._守护的誓约=true;Engine.log(`【守护的誓约】弃置【${Engine.getCardData(cid)?.name||cid}】，本回合获得+2合计威力并免受其他玩家能力影响。`,"var(--gold)");UI.updateAll();UI.renderHand(true);Network.sync();return true;};
                if(p.isPlayer&&p.id===Network.myPlayerId){Interaction.choose("【守护的誓约】选择弃置一张手牌",p.hand.map(cid=>({label:Engine.getCardData(cid)?.name||cid,desc:Engine.getCardData(cid)?.desc||""})),i=>apply(p.hand[i]),()=>{});return;}
                return apply(p.hand[0]);
            }),
            onCombatCalc: wrap((pt)=>{if(pt.ply._守护的誓约){pt.p+=2;pt.tags.push(`<span style="color:var(--gold);">[守护的誓约(+2)]</span>`);}})
        },
        "放荡之宴": {
            onAction: wrap((p) => {
                if (!payCost(p, 2, "放荡之宴")) return;
                p._feastLoc = p.location;
                p._feastActive = true;
                Engine.log(`【放荡之宴】${p.master.name} 将宴席置于【${p.location}】直至回合结束：此地其他玩家场上已激活牌的效果消耗+2（不影响从手牌打出的牌，QA#43；近似以战斗压制-2体现），战斗阶段结束时此地所有玩家获得1点战果！`, "var(--gold)");
            }),
            onCombatStart: wrap((pt, all, gl) => {
                if (pt.ply._feastActive) return;
                let feastP = all.find(o => o.ply._feastActive && o.ply._feastLoc === pt.ply.location);
                if (feastP && feastP.id !== pt.id) { pt.pendingSuppression = (pt.pendingSuppression||0) + 2; gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${feastP.ply.master.name} (放荡之宴)</span> <span>${pt.ply.master.name} 场上已激活牌效果消耗+2（近似-2威力）</span></div>`); }
            }),
            onCombatEnd: wrap((pt, winners, all, gl) => {
                if (!pt.ply._feastActive) return;
                pt.ply._feastActive = false;
                all.forEach(o => { o.ply.vp += 1; });
                gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (放荡之宴)</span> <span>宴席散场，此战场所有玩家各获得1点战果</span></div>`);
            })
        },
        "分割思考": {
            onAction: wrap((p) => {
                let maxX = Math.min(3, p.hand.length);
                let resolve = x => {
                    x = Math.max(0, Math.min(maxX, Number(x) || 0));
                    if (x === 0 || !payCost(p, 2 * x - 1, "分割思考")) return;
                    let sum = 0, n = 0;
                    while (n < x && p.hand.length > 0) {
                        let c = p.hand.pop();
                        sum += Number((DB.cards[c] || {}).power) || 0;
                        p.discard.push(c);
                        n++;
                    }
                    p.legionBuff = (p.legionBuff || 0) + sum;
                    Engine.log(`【分割思考】${p.master.name} 花费${2 * x - 1}点魔力，将${n}张手牌明置于【分割思考】上，齐心协力打出（合计+${sum}威力）！`, "var(--gold)");
                };

                if (p.isPlayer && p.id===Network.myPlayerId) {
                    Interaction.choose(
                        "【分割思考】明置手牌数量",
                        Array.from({ length: maxX + 1 }, (_, i) => ({ label: `${i}张手牌${i ? `（花费${2 * i - 1}点魔力）` : "（取消）"}` })),
                        i => resolve(i),
                        () => {}
                    );
                    return;
                }

                resolve(1 + Math.floor(Math.random() * Math.min(2, maxX)));
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.legionBuff) { pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[齐心协力(+${pt.ply.legionBuff})]</span>`); } })
        },
        "干将·莫邪": {
            onAction: wrap((p, sc, ctx) => {
                let cards = (ctx && ctx.cards) || [];
                let sum = cards.reduce((s, cid) => s + (Number((Engine.getCardData(cid) || {}).power) || 0), 0);
                if (sum === 5) {
                    p.legionBuff = (p.legionBuff || 0) + 4;
                    Engine.log(`【干将·莫邪】${p.master.name} 激活攻击的基本威力之和恰好为5，打出一张牌（近似+4威力）！`, "var(--gold)");
                } else {
                    Engine.log(`【干将·莫邪】激活攻击基本威力之和为${sum}（需恰好为5），效果未发动；鹤翼三连：下回合开始时将此牌加入攻击。`, "#aaa");
                }
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.legionBuff) { pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[鹤翼三连(+${pt.ply.legionBuff})]</span>`); } })
        },
        "刚力屠戮祝福之剑": {
            onCombatCalc: wrap((pt, all, gl) => {
                pt.p += 5;
                pt.tags.push(`<span style="color:var(--gold);">[刚力屠戮(+5)]</span>`);
                gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (刚力屠戮祝福之剑)</span> <span>若与【龙】战斗，此牌威力+5</span></div>`);
            })
        },
        "高声颂爱": {
            onAction: wrap((p) => {
                let n = p.discard.length;
                if (n > 0) { p.deck = window.shuffleArray([...p.deck, ...p.discard]); p.discard = []; }
                p._aisaiX = n + 2;
                Engine.log(`【高声颂爱】${p.master.name} 将弃牌堆内${n}张牌洗回牌库，X=${p._aisaiX}；记忆渐熄：你进行战斗的战斗阶段需花费${p._aisaiX}点魔力，否则关闭此牌！`, "var(--mana)");
            }),
            onCombatStart: wrap((pt, all, loc, gl) => {
                let x = pt.ply._aisaiX || 2;
                if (payCost(pt.ply, x, "高声颂爱·记忆渐熄")) {
                    gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (高声颂爱)</span> <span>花费${x}点魔力维持记忆渐熄</span></div>`);
                } else {
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (高声颂爱)</span> <span>魔力不足${x}点，记忆渐熄——关闭此牌</span></div>`);
                }
                pt.ply._aisaiX = 2;
            })
        },
        "光辉大复合神殿": {
            onAction: wrap((p) => {
                if (!payCost(p, 4, "光辉大复合神殿")) return;
                p._templeLoc = p.location;
                p._templeActive = true;
                Engine.log(`【光辉大复合神殿】${p.master.name} 花费4点魔力，将神殿放置于【${p.location}】：此地若为战场，对手的特殊或宝具牌于此处+3魔力消耗（至多12）；你位于此处时，对手无法以移动进入或离开此地点！`, "var(--gold)");
            }),
            onCombatStart: wrap((pt, all, loc, gl) => {
                if (!pt.ply._templeActive) return;
                all.filter(o => o.id !== pt.id).forEach(o => { o.pendingSuppression = (o.pendingSuppression || 0) + 3; });
                gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (光辉大复合神殿)</span> <span>神殿威光：对手特殊/宝具消耗+3且移动受限（威力-3近似）</span></div>`);
            })
        },
        "光壳流溢的虚树": {
            onAction: wrap((p) => {
                let hi = p.hand.findIndex(c => DB.cards[c] && DB.cards[c].name === "领域外生命");
                if (hi > -1) {
                    p.hand.splice(hi, 1);
                    Engine.addMana(p, 2);
                    Engine.log(`【光壳流溢的虚树】${p.master.name} 移除手牌1张【领域外生命】，获得2点魔力！`, "var(--mana)");
                }
                let dn = p.discard.filter(c => DB.cards[c] && DB.cards[c].name === "领域外生命");
                if (dn.length) {
                    dn.forEach(c => { p.discard.splice(p.discard.indexOf(c), 1); });
                    p.legionBuff = (p.legionBuff || 0) + 4 * dn.length;
                    Engine.log(`【光壳流溢的虚树】${p.master.name} 打出弃牌堆${dn.length}张【领域外生命】（合计+${4 * dn.length}威力），战斗阶段结束后将所有激活的【领域外生命】洗入牌库！`, "var(--gold)");
                }
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.legionBuff) { pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[虚树(+${pt.ply.legionBuff})]</span>`); } })
        },
        "光之地平线": {
            onCombatLose: wrap((pt, winners, all, gl) => {
                if (!pt.ply._horizonShown) {
                    pt.ply._horizonShown = true;
                    gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (光之地平线)</span> <span>梅柳齐娜战败，展示此牌——若她再次战败时此牌已被展示，将替换为阿尔比恩之骸</span></div>`);
                } else {
                    pt.ply.isRevealed = true;
                    pt.ply.autoPermBuff = (pt.ply.autoPermBuff || 0) + 8;
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (光之地平线)</span> <span>从者梅柳齐娜替换为阿尔比恩之骸并【真名解放】（永久+8威力）</span></div>`);
                }
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.autoPermBuff) { pt.p += pt.ply.autoPermBuff; pt.tags.push(`<span style="color:var(--gold);">[阿尔比恩之骸(+${pt.ply.autoPermBuff})]</span>`); } })
        },
        "蛤御殿": {
            onAction: wrap((p) => {
                p.vp += 1;
                Engine.log(`【蛤御殿】当世幻都：${p.master.name} 将所在战场的一张事件牌移动至【月之圣杯】（其上所有事件牌均为1点战果，近似+1战果）；所有人的战斗阶段开始时，若你的战斗中没有事件牌，将【月之圣杯】的一张事件牌移至你所在战场！`, "var(--vp)");
            })
        },
        "海〔月〕神的祝福": {
            onAction: wrap((p) => {
                let times = 1;
                let applyTwice = () => {
                    if (payCost(p, 4, "海〔月〕神的祝福·再使用")) times = 2;
                };
                if (p.mana >= 4 && p.isPlayer && p.id===Network.myPlayerId) {
                    Interaction.confirm("【海〔月〕神的祝福】额外花费4点魔力再使用一次无偿之爱？", false, yes => {
                        if (yes) applyTwice();
                    }, () => {});
                    return;
                }
                if (p.mana >= 4 && Math.random() < 0.5) applyTwice();
                for (let i = 0; i < times; i++) {
                    let hi = p.hand.findIndex(c => DB.cards[c] && DB.cards[c].name === "幸运");
                    if (hi > -1) {
                        p.hand.splice(hi, 1);
                        p.legionBuff = (p.legionBuff || 0) + 3;
                        Engine.log(`【海〔月〕神的祝福】${p.master.name} 将手牌1张【幸运】加入攻击并令其获得“残留”与“唯一”（+3威力）！`, "var(--gold)");
                    } else {
                        let di = p.deck.findIndex(c => DB.cards[c] && DB.cards[c].name === "幸运");
                        if (di > -1) {
                            p.deck.splice(di, 1);
                            p.legionBuff = (p.legionBuff || 0) + 3;
                            Engine.log(`【海〔月〕神的祝福】${p.master.name} 从牌库将1张【幸运】加入攻击并令其获得“残留”与“唯一”（+3威力）！`, "var(--gold)");
                        } else {
                            Engine.log(`【海〔月〕神的祝福】手牌与牌库中都没有【幸运】，效果未发动。`, "#aaa");
                            break;
                        }
                    }
                }
            }),
            onCombatCalc: wrap((pt) => { if (pt.ply.legionBuff) { pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[无偿之爱(+${pt.ply.legionBuff})]</span>`); } })
        },
        "海神，凶猛狂暴大海啸": {
            onAction: wrap((p) => {
                let scout = State.players.find(o => o.isAlive && o.id !== p.id && o.location === "侦察");
                if (scout) {
                    let myLoc = p.location;
                    if (moveTo(p, "侦察", "海神，凶猛狂暴大海啸")) {
                        moveTo(scout, myLoc, "海神，凶猛狂暴大海啸·交换");
                        Engine.log(`【海神，凶猛狂暴大海啸】${p.master.name} 与位于侦察的 ${scout.master.name} 交换位置（视为移动）！`, "var(--vp)");
                    }
                } else {
                    Engine.log(`【海神，凶猛狂暴大海啸】没有位于侦察的玩家，交换位置未执行。`, "#aaa");
                }
            }),
            onCombatStart: wrap((pt, all, loc, gl) => {
                let hit = [];
                all.filter(o => o.id !== pt.id && !oppHasAttr(o, "魔术") && !oppHasAttr(o, "魔法")).forEach(o => {
                    let x = Math.max(0, 3 - (o.locBonus || 0));
                    if (x > 0) { o.pendingSuppression = (o.pendingSuppression || 0) + x; hit.push(`${o.ply.master.name}(-${x})`); }
                });
                if (hit.length) gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (海神，凶猛狂暴大海啸)</span> <span>非魔术攻击威力减少（X=3-其拥有者的地利）：${hit.join('、')}</span></div>`);
            })
        },
        "海神的加护": {
            onAction: wrap((p) => {
                if (p.location === "深山町") { moveTo(p, "新都", "海神的加护·疏通航道"); }
                else if (p.location === "新都") { moveTo(p, "深山町", "海神的加护·疏通航道"); }
                else Engine.log(`【海神的加护】疏通航道需从深山町移动至新都（或反向），当前位置【${p.location}】无法执行。`, "#aaa");
            }),
            onCombatCalc: wrap((pt) => { pt.p += 3; pt.tags.push(`<span style="color:var(--mana);">[唤潮之佑(+3)]</span>`); })
        },
        "赫拉克勒斯 - 派遣": {},
        "赫拉克勒斯 (Attack)": {
            onCombatLose: wrap((pt, winners, all, gl) => {
                pt.ply.vp += 2;
                Engine.createJasonDispatch(pt.ply, "sc_jason_1");
                gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (赫拉克勒斯)</span> <span>输掉战斗——派遣【赫拉克勒斯】并获得2点战果（洗入事件牌堆前10张）</span></div>`);
            })
        },
        "黑化诅咒": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                if (pt.ply.mana < 8) {
                    all.filter(o => o.id !== pt.id).forEach(o => { o.pendingSuppression = (o.pendingSuppression || 0) + 4; });
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (黑化诅咒)</span> <span>魔力少于8点，与你位于同一战场的对手无法使用宝具（威力-4近似）</span></div>`);
                } else {
                    gl.push(`<div class="report-line" style="color:#aaa;"><span>✨ ${pt.ply.master.name} (黑化诅咒)</span> <span>魔力不低于8点，诅咒未生效</span></div>`);
                }
            })
        },
        "黑键": {
            onAction: wrap((p) => {
                if (!payCost(p, 4, "黑键")) return;
                p._blackKeyArmed = true;
                Engine.log(`【黑键】${p.master.name} 花费4点魔力：战斗阶段开始时使一名交战对手【败北】（使用后移除游戏）！`, "var(--red)");
            }),
            onCombatStart: wrap((pt, all, loc, gl) => {
                if (!pt.ply._blackKeyArmed) return;
                pt.ply._blackKeyArmed = false;
                defeatOpp(pt, all, gl, "黑键", null, "one");
            })
        },

        // ===== merged from _gen_batch_3.js =====
        // ====== _gen_batch_3.js：Manual 手工表片段（合并进 SkillLib.js 的 Manual 对象） ======
        "奇术师": {
            onCombatCalc: wrap((pt, all, gl) => {
                if(!payCost(pt.ply, 3, "奇术师")) return;
                let opps = all.filter(o => o.id !== pt.id && o.ply.deck.length > 0);
                if(!opps.length){ gl.push(`<div class="report-line" style="color:#aaa;"><span>✨ ${pt.ply.master.name} (奇术师)</span> <span>对手牌库皆空，无处窃牌</span></div>`); return; }
                let o = opps[Math.floor(Math.random()*opps.length)];
                let cid = o.ply.deck.shift();
                let cd = Engine.getCardData(cid);
                let pw = cd ? (Number(cd.power)||0) : 0;
                o.ply.discard.push(cid); // 战后返回原主弃牌堆
                pt.p += pw;
                pt.tags.push(`<span style="color:var(--gold);">[奇术师·窃牌(+${pw})]</span>`);
                gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (奇术师)</span> <span>花费3魔力，抽取 ${o.ply.master.name} 牌堆顶的【${cd ? cd.name : "牌"}】（威力${pw}）加入攻击</span></div>`);
            })
        },
        "祈祷之弓": {
            onCombatFinal: wrap((pt, all, gl) => {
                let opps = all.filter(o => o.id !== pt.id);
                let poisoned = opps.filter(o => getToken(o.ply, "中毒") > 0);
                if(poisoned.length) defeatOpp(pt, all, gl, "祈祷之弓·毒矢", o => getToken(o.ply, "中毒") > 0, "all");
                opps.forEach(o => addToken(o.ply, "中毒", 1));
                gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (祈祷之弓)</span> <span>所有交战对手【中毒】（持续至下回合结束）</span></div>`);
            })
        },
        "骑士的铳枪": {
            onCombatCalc: wrap((pt, all, gl) => {
                if(pt.ply.vp < 2){ gl.push(`<div class="report-line" style="color:#aaa;"><span>✨ ${pt.ply.master.name} (骑士的铳枪)</span> <span>战果不足2点，魔能过载未发动</span></div>`); return; }
                pt.ply.vp -= 2;
                pt.p += 2;
                pt.tags.push(`<span style="color:var(--gold);">[魔能过载(+2)]</span>`);
                gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (骑士的铳枪)</span> <span>花费2点战果，一张魔术攻击获得力量属性与+2威力</span></div>`);
            })
        },
        "起源档案": {
            onAction: wrap((p) => {
                let cands = State.players.filter(op => op.isAlive);
                if(cands.length <= 1) return;
                let resolve = t => {
                    if(!t) return;
                    if(t.id === p.id){ p.isRevealed = true; Engine.log(`【起源档案】${p.master.name} 自身【真名解放】！（此牌移除游戏）`, "var(--gold)"); }
                    else { t.isRevealed = true; Engine.log(`【起源档案】${t.master.name} 的从者被【真名解放】！（此牌移除游戏）`, "var(--gold)"); }
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choosePlayer("【起源档案】令谁【真名解放】", cands, i => resolve(cands[i]), () => {});
                    return;
                }
                let oc = cands.filter(op => op.id !== p.id);
                resolve(oc.length ? oc[Math.floor(Math.random()*oc.length)] : cands[0]);
            })
        },
        "千年城": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                oppLose(all, pt, gl, "mana", 3, "千年城");
                gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (千年城)</span> <span>古城从版图移除，赢得一场胜利前不可再打出此牌</span></div>`);
            })
        },

        // ===== 升华技·技能区牌（checkAscensionUnlock 动态加入技能区，需在文末注册列表登记） =====
        "誓约胜利之木剑": {
            // 剑岂是如此不便之物：若你获胜且此牌本回合从牌库（蓄势）入场，立即获得游戏胜利
            onCombatWin: wrap((pt, winners, all, gl) => {
                if((pt.ply.chargedAttacks || []).some(cc => cc && cc.name === "誓约胜利之木剑")){
                    pt.ply.vp += 100; pt.ply.instantVictory = true;
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>🗡️ 剑岂是如此不便之物</span> <span>${pt.ply.master.name} 的【誓约胜利之木剑】从牌库入场并获胜——立即获得游戏胜利！</span></div>`);
                    Engine.log(`【誓约胜利之木剑】${pt.ply.master.name} 立即获得游戏胜利！`, "var(--gold)");
                } else {
                    gl.push(`<div class="report-line" style="color:#aaa;"><span>✨ ${pt.ply.master.name} (誓约胜利之木剑)</span> <span>此牌非从牌库入场，胜利条件未满足</span></div>`);
                }
            })
        },
        "饿死鬼投胎": {
            // 此牌需弃置一份【食物】来打出（肉/蔬菜/鱼任一份）
            onCombatStart: wrap((pt, all, loc, gl) => {
                let f = pt.ply.foods || {};
                let kinds = ["肉", "蔬菜", "鱼"].filter(k => (f[k] || 0) > 0);
                if(kinds.length === 0){ gl.push(`<div class="report-line" style="color:#aaa;"><span>✨ ${pt.ply.master.name} (饿死鬼投胎)</span> <span>没有【食物】（近似：仍可打出）</span></div>`); return; }
                let resolve = pick => {
                    if(!kinds.includes(pick)) return;
                    pt.ply.foods[pick]--;
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (饿死鬼投胎)</span> <span>弃置一份【${pick}】以打出此牌</span></div>`);
                };
                if(pt.ply.isPlayer && pt.ply.id===Network.myPlayerId){
                    Interaction.choose(
                        "【饿死鬼投胎】选择弃置的食物",
                        kinds,
                        i => resolve(kinds[i]),
                        () => {}
                    );
                    return;
                }
                resolve(kinds[Math.floor(Math.random() * kinds.length)]);
            })
        },
        "机械翡翠": {
            // 行动阶段：使用至多2张【魔力猛攻】（手牌直接加入攻击区）
            onAction: wrap((p, sc, ctx) => {
                let blasts = (p.hand || []).filter(cid => Engine.getCardData(cid) && Engine.getCardData(cid).name === "魔力猛攻");
                if(blasts.length === 0){ Engine.log(`【机械翡翠】手牌中没有【魔力猛攻】。`, "#aaa"); return; }
                let resolve = n => {
                    n = Math.max(0, Math.min(2, Math.min(Number(n) || 0, blasts.length)));
                    for(let i = 0; i < n; i++){
                        let cid = blasts[i];
                        let hi = p.hand.indexOf(cid);
                        if(hi > -1){ p.hand.splice(hi, 1); p.residualCards = p.residualCards || []; p.residualCards.push(cid); }
                    }
                    if(n > 0) Engine.log(`【机械翡翠】${p.master.name} 使用${n}张【魔力猛攻】加入攻击！`, "var(--gold)");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose(
                        "【机械翡翠】选择使用的【魔力猛攻】数量",
                        Array.from({length: Math.min(2, blasts.length) + 1}, (_, i) => `${i}张`),
                        i => resolve(i),
                        () => {}
                    );
                    return;
                }
                resolve(Math.min(2, blasts.length));
            }),
            // 战斗阶段：交战对手地利小于你则合计威力-4
            onCombatCalc: wrap((pt, all, gl) => {
                let hit = all.filter(o => o.id !== pt.id && (o.locBonus || 0) < pt.locBonus);
                hit.forEach(o => { o.p = Math.max(0, o.p - 4); o.tags.push(`<span style="color:var(--red);">[机械翡翠(-4)]</span>`); });
                if(hit.length) gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (机械翡翠)</span> <span>${hit.length}名地利较低的交战对手合计威力-4</span></div>`);
            }),
            // 获胜时：所有位于魔术工房的玩家获得【燃尽的工房】
            onCombatWin: wrap((pt, winners, all, gl) => {
                let ws = State.players.filter(op => op.isAlive && op.location === '魔术工房');
                ws.forEach(op => { op.burnoutWorkshop = true; });
                if(ws.length) gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (机械翡翠)</span> <span>${ws.length}名位于魔术工房的玩家获得【燃尽的工房】</span></div>`);
            })
        },
        "璀璨空想": {
            // 红赤休术：若你是红赤朱，此牌+4威力（+3魔力消耗在出牌计费处）；掠夺：远野秋叶时被偷取魔力的玩家-3合计威力（近似：魔力最高的交战对手）
            onCombatCalc: wrap((pt, all, gl) => {
                if(pt.ply.isKohaku){
                    pt.p += 4; pt.tags.push(`<span style="color:var(--red);">[红赤休术(+4)]</span>`);
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (璀璨空想·红赤休术)</span> <span>红赤朱状态，+4威力</span></div>`);
                } else {
                    let t = all.filter(o => o.id !== pt.id).sort((a, b) => (b.ply.mana || 0) - (a.ply.mana || 0))[0];
                    if(t){ t.p = Math.max(0, t.p - 3); t.tags.push(`<span style="color:var(--red);">[掠夺(-3)]</span>`); gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (璀璨空想·掠夺)</span> <span>${t.ply.master.name} 合计威力-3（近似：魔力最高者视为被掠夺者）</span></div>`); }
                }
            })
        },
        "不休梦魇": {
            // 唯一：移除技能区其他所有【不休梦魇】；打出时：一张此牌的复制加入技能区（战斗结束后结算以保持技能索引稳定）
            onCombatEnd: wrap((pt, winners, all, gl) => {
                let ply = pt.ply;
                let playedSet = new Set(pt.servantSkills || []);
                let keep = [], removed = 0, playedOne = null;
                (ply.servant.skillCards || []).forEach((sk, i) => {
                    if(sk && sk.name === "不休梦魇"){
                        if(playedSet.has(i) && !playedOne){ playedOne = sk; keep.push(sk); }
                        else removed++;
                    } else keep.push(sk);
                });
                if(playedOne) keep.push(JSON.parse(JSON.stringify(playedOne)));
                ply.servant.skillCards = keep;
                if(removed > 0 || playedOne) gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${ply.master.name} (不休梦魇)</span> <span>移除${removed}张同名牌，一张新的【不休梦魇】复制加入技能区</span></div>`);
            })
        },
        "Queenside Castle": {
            // 行动阶段：将幻影爱丽丝从桌面移除，使所有与她位于同一地点的玩家【败北】（近似：各失去2点战果）
            onAction: wrap((p) => {
                if(!p.alicePhantomLoc){ Engine.log(`【Queenside Castle】未部署【幻影爱丽丝】，无法发动王城奇袭。`, "#aaa"); return; }
                let ploc = p.alicePhantomLoc;
                p.alicePhantomLoc = null;
                let victims = State.players.filter(op => op.isAlive && op.id !== p.id && op.location === ploc);
                victims.forEach(op => { op.vp = Math.max(0, op.vp - 2); });
                Engine.log(`【Queenside Castle】${p.master.name} 将【幻影爱丽丝】从桌面移除，${victims.length ? victims.map(v => v.master.name).join("、") + " 败北（各-2战果，近似）" : "其所在地无其他玩家"}！`, "var(--gold)");
            })
        },
        "老相识": {
            // 空中支援：行动阶段将你的地利翻倍（战斗结算时消耗）
            onAction: wrap((p) => {
                p._airSupport = true;
                Engine.log(`【老相识·空中支援】${p.master.name} 的本回合地利翻倍！`, "var(--gold)");
            })
        },
        "宵泣之铁桩": {
            // 痛苦钉刺：令【枯萎】的玩家选择花费2点魔力或弃置所有手牌
            onAction: wrap((p) => {
                let withered = State.players.filter(op => op.isAlive && op.id !== p.id && op.withered);
                if(withered.length === 0){ Engine.log(`【宵泣之铁桩】场上没有【枯萎】的玩家。`, "#aaa"); return; }
                withered.forEach(op => {
                    if(op.mana >= 2){ op.mana -= 2; Engine.log(`【痛苦钉刺】${op.master.name} 花费2点魔力抵御痛苦！`, "var(--mana)"); }
                    else { let n = (op.hand || []).length; op.discard.push(...op.hand); op.hand = []; Engine.log(`【痛苦钉刺】${op.master.name} 魔力不足，弃置${n}张手牌！`, "var(--red)"); }
                });
            })
        },
        "快速扩张": {
            // 行动阶段：将一张【俄罗斯】事件牌从游戏外放入你所在的战场（视为一次扩张）；无法做到则+5战果
            onAction: wrap((p) => {
                if(!p.russiaPool || p.russiaPool.length === 0){
                    p.russiaPool = [];
                    [["冻土",1,5],["适者生存",3,2],["皇帝敕令",5,2]].forEach(d => { for(let i = 0; i < d[2]; i++) p.russiaPool.push({name: d[0], vp: d[1]}); });
                }
                let loc = p.location;
                if(p.russiaPool.length > 0 && (loc === '深山町' || loc === '新都')){
                    let ev = p.russiaPool.splice(0, 1)[0];
                    let arr = loc === '深山町' ? State.currentEvents.miyama : State.currentEvents.shinto;
                    arr.push(ev);
                    p.russiaExpanded = true;
                    Engine.log(`【快速扩张】${p.master.name} 将一张游戏外的【俄罗斯】事件牌【${ev.name}】放入【${loc}】（视为一次扩张）！`, "var(--gold)");
                } else {
                    p.vp += 5;
                    Engine.log(`【快速扩张】${p.master.name} 无法放置【俄罗斯】事件牌，改为获得5点战果！`, "var(--vp)");
                }
            })
        },
        "渎神者": {
            // 行动阶段：花费2X点魔力，弃置一张所在战场战果为X的事件牌；该战场对手于战斗阶段失去地利和X点战果且合计威力-2X
            onAction: wrap((p) => {
                let loc = p.location;
                if(loc !== '深山町' && loc !== '新都'){ Engine.log(`【渎神者】不在战场，无法亵渎。`, "#aaa"); return; }
                let evts = loc === '深山町' ? State.currentEvents.miyama : State.currentEvents.shinto;
                if(!evts || evts.length === 0){ Engine.log(`【渎神者】所在战场没有事件牌。`, "#aaa"); return; }
                let resolve = pick => {
                    if(!pick || !evts.includes(pick)) return;
                    let X = Math.max(0, Number(pick.vp) || 0);
                    if(p.mana < 2 * X){ Engine.log(`【渎神者】魔力不足${2 * X}点，效果未发动。`, "#aaa"); return; }
                    p.mana -= 2 * X;
                    evts.splice(evts.indexOf(pick), 1);
                    p._渎神者X = X; p._渎神者Loc = loc;
                    Engine.log(`【渎神者】${p.master.name} 花费${2 * X}点魔力弃置【${loc}】的【${pick.name}】！该战场对手战斗阶段将失去地利与${X}点战果、合计威力-${2 * X}！`, "var(--red)");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose(
                        `【渎神者】选择弃置【${loc}】的事件牌`,
                        evts.map(event => `${event.name}（战果${event.vp}，费用${2 * (Number(event.vp) || 0)}魔力）`),
                        i => resolve(evts[i]),
                        () => {}
                    );
                    return;
                }
                resolve(evts[Math.floor(Math.random() * evts.length)]);
            }),
            // 战斗开始：该战场对手失去地利与X点战果，标记合计威力-2X（威力扣减延至onCombatCalc，此时威力已合计完毕）
            onCombatStart: wrap((pt, all, loc, gl) => {
                let ply = pt.ply;
                if(!ply._渎神者X || ply._渎神者Loc !== loc) return;
                let X = ply._渎神者X;
                ply._渎神者X = 0; ply._渎神者Loc = null;
                let foes = all.filter(o => o.id !== pt.id);
                foes.forEach(o => {
                    o.locBonus = 0;
                    o.ply.vp = Math.max(0, o.ply.vp - X);
                    o._渎神减威 = (o._渎神减威 || 0) + 2 * X;
                    o.tags.push(`<span style="color:var(--red);">[渎神者(失地利/-${X}战果/-${2 * X}威力)]</span>`);
                });
                if(foes.length) gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${ply.master.name} (渎神者)</span> <span>亵渎生效：${foes.map(o => o.ply.master.name).join("、")} 失去地利与${X}点战果，合计威力-${2 * X}</span></div>`);
            }),
            onCombatCalc: wrap((pt, all, gl) => {
                let hit = all.filter(o => o.id !== pt.id && o._渎神减威);
                hit.forEach(o => { o.p = Math.max(0, o.p - o._渎神减威); o._渎神减威 = 0; });
                if(hit.length) gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (渎神者)</span> <span>合计威力扣减已结算</span></div>`);
            })
        },
        "宝石剑泽尔里奇": {
            // 被动（魔术基础牌和【阴炁弹】威力+2）在 index.html 战斗计算区实现（rinAscension 且此牌仍在技能区）
            // 行动阶段：获得本回合所有玩家花费的魔力（近似：期初魔力+本回合获得-当前魔力）
            onAction: wrap((p) => {
                let total = State.players.filter(op => op.isAlive).reduce((sum, op) => {
                    let spent = (op.manaAtTurnStart !== undefined ? op.manaAtTurnStart : op.mana) + (op.manaGainedThisTurn || 0) - op.mana;
                    return sum + Math.max(0, spent);
                }, 0);
                if(total > 0){ Engine.addMana(p, total); Engine.log(`【宝石剑泽尔里奇】${p.master.name} 获得本回合所有玩家花费的${total}点魔力！`, "var(--mana)"); }
                else Engine.log(`【宝石剑泽尔里奇】本回合尚无玩家花费魔力。`, "#aaa");
            }),
            // 战斗结束后：将此牌移除游戏（标记后延迟至回合开始清理，避免技能索引漂移）
            onCombatWin: wrap((pt) => {
                let ply = pt.ply;
                if((pt.servantSkills || []).some(i => { let sk = ply.servant.skillCards[i]; return sk && sk.name === "宝石剑泽尔里奇"; })) ply._zelretchRemove = true;
            }),
            onCombatEnd: wrap((pt, winners, all, gl) => {
                let ply = pt.ply;
                if((pt.servantSkills || []).some(i => { let sk = ply.servant.skillCards[i]; return sk && sk.name === "宝石剑泽尔里奇"; })){
                    ply._zelretchRemove = true;
                    gl.push(`<div class="report-line" style="color:var(--mana);"><span>💎 宝石剑泽尔里奇</span> <span>战斗结束，${ply.master.name} 的此牌移除游戏</span></div>`);
                }
            })
        },
        "生命赋予": {
            // 每回合只能使用此攻击的其中一项能力
            // 行动阶段：本回合的一张基础攻击保持激活至下回合结束（转入残留区，下回合结束弃置）
            // 战斗阶段：你的攻击获得魔术属性并且威力+1（index.html 战斗计算区按 _生命赋予战斗 标记实现）
            onAction: wrap((p, sc, ctx) => {
                if(p._生命赋予Used){ Engine.log(`【生命赋予】本回合已使用过此牌的能力。`, "#aaa"); return; }
                let played = ((ctx && ctx.cards) || []).filter(cid => Engine.getCardData(cid));
                let basics = played.filter(cid => { let c = Engine.getCardData(cid); return c && ["低位魔法","中位魔法","高位魔法","迫击","强打","浑身的一击","翻弄","瞬间移动","瞬间的一击"].includes(c.name); });
                let useKeep = pick => {
                    if(!pick || !basics.includes(pick)) return;
                    p._生命赋予保持 = pick;
                    p._生命赋予Used = true;
                    Engine.log(`【生命赋予】${p.master.name} 的【${DB.cards[pick] ? DB.cards[pick].name : pick}】将保持激活至下回合结束！`, "var(--gold)");
                };
                let useCombat = () => {
                    p._生命赋予战斗 = true;
                    p._生命赋予Used = true;
                    Engine.log(`【生命赋予】${p.master.name} 本回合的攻击获得魔术属性且威力+1！`, "var(--gold)");
                };
                let chooseKeep = () => {
                    if(p.isPlayer && p.id===Network.myPlayerId && basics.length > 1){
                        Interaction.choose(
                            "【生命赋予】选择保持激活的基础攻击",
                            basics.map(cid => Engine.getCardData(cid) ? Engine.getCardData(cid).name : cid),
                            i => useKeep(basics[i]),
                            () => {}
                        );
                        return;
                    }
                    useKeep(basics[0]);
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    let opts = ["战斗：攻击获得魔术属性且威力+1"];
                    if(basics.length > 0) opts.push(`行动：保持一张基础攻击激活至下回合结束（${basics.length}张可选）`);
                    Interaction.choose(
                        "【生命赋予】选择本回合能力",
                        opts,
                        i => i === 1 && basics.length > 0 ? chooseKeep() : useCombat(),
                        () => {}
                    );
                    return;
                }
                if(basics.length > 0 && Math.random() < 0.5) chooseKeep();
                else useCombat();
            })
        },
        "大江之鬼闹": {
            // 茨木童子（被动/行动阶段）：你的战斗中，本回合打出的激活攻击魔力消耗总和最高的玩家+6合计威力
            onAction: wrap((p) => {
                p._大江之鬼闹 = true;
                Engine.log(`【大江之鬼闹】熯天炽地：本回合你的战斗中，打出攻击魔力消耗总和最高的玩家将+6合计威力！`, "var(--red)");
            }),
            onCombatCalc: wrap((pt, all, gl) => {
                if(!pt.ply._大江之鬼闹) return;
                let sums = all.map(o => {
                    let c = State.actionChoices[o.id] || {cards: [], facedown: []};
                    let s = 0;
                    (c.cards||[]).forEach(cid => { let cd = Engine.getCardData(cid); if(cd) s += (Number(cd.cost)||0); });
                    (o.servantSkills||[]).forEach(i => { let sk = o.ply.servant.skillCards[i]; if(sk) s += (Number(sk.cost)||0); });
                    return {o, s};
                });
                let max = Math.max(...sums.map(x => x.s));
                let hits = sums.filter(x => x.s === max);
                hits.forEach(x => { x.o.p += 6; x.o.tags.push(`<span style="color:var(--red);">[大江之鬼闹(+6)]</span>`); });
                gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (大江之鬼闹)</span> <span>熯天炽地：${hits.map(x => x.o.ply.master.name).join('、')} 魔力消耗总和最高（${max}），+6合计威力</span></div>`);
            })
        },
        "焰色接吻": {
            // 清姬（被动/行动阶段）：清姬的魔术攻击获得+3威力和力量属性（力量属性附加为近似省略；下回合仅可部署工房的限制近似省略）
            onAction: wrap((p) => {
                p._焰色接吻 = true;
                Engine.log(`【焰色接吻】炽热抱拥：本回合清姬的魔术攻击+3威力！`, "var(--red)");
            }),
            onCombatCalc: wrap((pt) => {
                if(!pt.ply._焰色接吻) return;
                let c = State.actionChoices[pt.id] || {cards: [], facedown: []};
                let magicCnt = (c.cards||[]).filter(cid => !(c.facedown||[]).includes(cid) && Engine.getCardData(cid) && String(Engine.getCardData(cid).type||'').includes('魔术')).length;
                if(magicCnt > 0){ pt.p += magicCnt * 3; pt.tags.push(`<span style="color:var(--red);">[焰色接吻(+${magicCnt * 3})]</span>`); }
            })
        },
        "神性〔金蝉子〕": {
            // 玄奘三藏（被动/行动阶段）：弃置一张【幸运】，抽一张牌，然后三选一
            onAction: wrap((p) => {
                if(!p || p._金蝉子Pending || p._金蝉子ResolvedTurn === `${State.day}:${State.currentTurnIdx}`) return false;
                let luckIdx = p.hand.findIndex(cid => { let c=Engine.getCardData(cid); return c && (c.name === "幸运" || String(c.type||"").includes("幸运")); });
                if(luckIdx < 0){ Engine.log(`【神性〔金蝉子〕】手中没有【幸运】，无法发动。`, "#aaa"); return false; }
                let turnKey = `${State.day}:${State.currentTurnIdx}`;
                let token = `jinchan_${p.id}_${turnKey}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
                p._金蝉子Pending = true;
                p._金蝉子PendingToken = token;
                p._金蝉子Choice = null;
                p._金蝉子PendingStep = "choice";
                p.discard.push(p.hand.splice(luckIdx, 1)[0]);
                Engine.drawCards(p, 1);
                let syncResult = () => { try { UI.updateAll(); UI.updateMapUI(); Network.sync(); } catch(e) {} };
                const playerId = p.id;
                const complete = choice => {
                    // Network.receiveState 会整体替换 State；回调必须重新取得当前玩家对象，不能写入旧引用。
                    const target = getPlayer(playerId);
                    if(!target || !target._金蝉子Pending || target._金蝉子PendingToken !== token || target._金蝉子Choice !== null) return;
                    choice = Number(choice);
                    if(![1,2,3].includes(choice)) choice = 1;
                    target._金蝉子Choice = choice;
                    if(choice === 1){
                        Engine.addMana(target, 3);
                        Engine.log(`【神性〔金蝉子〕】获得3点魔力！`, "var(--mana)");
                        target._金蝉子Pending = false;
                    } else if(choice === 2){
                        target._金蝉子Buff = true;
                        Engine.log(`【神性〔金蝉子〕】合计威力+2，若本回合赢得战斗将再获得2点战果！`, "var(--gold)");
                        target._金蝉子Pending = false;
                    } else {
                        let locs = ["魔术工房", "深山町", "新都", "侦察"];
                        if(!target.location){ Engine.log(`【神性〔金蝉子〕】当前没有所在地点，移动效果未发动。`, "#aaa"); target._金蝉子Pending = false; }
                        else if(target.isPlayer && target.id===Network.myPlayerId){
                            target._金蝉子PendingStep = "location";
                            Interaction.chooseLocation("【神性〔金蝉子〕】无视交战移动至", locs, i => { const latest=getPlayer(playerId); if(!latest)return; moveTo(latest, locs[Number(i)] || latest.location, "神性〔金蝉子〕"); latest._金蝉子Pending = false; latest._金蝉子PendingStep = null; latest._金蝉子ResolvedTurn = turnKey; syncResult(); }, () => { const latest=getPlayer(playerId); if(!latest)return; latest._金蝉子Pending = false; latest._金蝉子PendingStep = null; latest._金蝉子ResolvedTurn = turnKey; Engine.log(`【神性〔金蝉子〕】取消移动，保留其他已结算效果。`, "#aaa"); syncResult(); });
                            return;
                        } else {
                            moveTo(target, locs[Math.floor(Math.random() * locs.length)], "神性〔金蝉子〕");
                            target._金蝉子Pending = false;
                        }
                    }
                    target._金蝉子PendingStep = null;
                    target._金蝉子ResolvedTurn = turnKey;
                    syncResult();
                };
                syncResult();
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose("【神性〔金蝉子〕】选择幸运效果", ["获得3点魔力", "合计威力+2，胜利时再获得2点战果", "无视交战移动至任意位置"], i => complete(i + 1), () => complete(1));
                    return;
                }
                complete(Math.floor(Math.random() * 3) + 1);
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply._金蝉子Buff){ pt.p += 2; pt.tags.push(`<span style="color:var(--gold);">[金蝉子(+2)]</span>`); } }),
            onCombatWin: wrap((pt, winners, all, gl) => { if(pt.ply._金蝉子Buff){ pt.ply.vp += 2; gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (神性〔金蝉子〕)</span> <span>获胜，+2 战果</span></div>`); } })
        },
        "护国鬼将": {
            // 弗拉德三世（被动/行动阶段）：花费1点魔力，将你的地利变为2倍（战斗阶段对移动进入者的减益近似省略）
            onAction: wrap((p) => {
                if(payCost(p, 1, "护国鬼将")){
                    p._护国鬼将地利 = true;
                    Engine.log(`【护国鬼将】花费1点魔力，本回合你的地利翻倍！`, "var(--gold)");
                }
            }),
            onCombatCalc: wrap((pt) => {
                if(pt.ply._护国鬼将地利 && pt.locBonus > 0){ let add = pt.locBonus; pt.p += add; pt.tags.push(`<span style="color:var(--gold);">[护国鬼将·地利x2(+${add})]</span>`); }
            })
        },
        "触及月亮的猎人": {
            // 超人俄里翁（被动/行动阶段）：花费4点魔力并随机弃置一张手牌，此后打出的基础攻击+2威力；常规出牌打出至少两张同属性攻击时+3合计威力
            onAction: wrap((p) => {
                if(p.mana < 4){ Engine.log(`【触及月亮的猎人】魔力不足4点，无法发动。`, "#aaa"); return false; }
                p.mana -= 4;
                if(p.hand.length > 0){ let ri = Math.floor(Math.random() * p.hand.length); let dn = DB.cards[p.hand[ri]] ? DB.cards[p.hand[ri]].name : "一张牌"; p.discard.push(p.hand.splice(ri, 1)[0]); Engine.log(`【触及月亮的猎人】花费4点魔力，随机弃置【${dn}】！`, "var(--mana)"); }
                p._猎人锐眼 = true;
                Engine.log(`【触及月亮的猎人】月之猎手觉醒：本回合基础攻击+2威力，打出至少两张同属性攻击时+3合计威力！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => {
                if(!pt.ply._猎人锐眼) return;
                let c = State.actionChoices[pt.id] || {cards: [], facedown: []};
                let open = (c.cards||[]).filter(cid => !(c.facedown||[]).includes(cid) && Engine.getCardData(cid));
                let basicCnt = open.filter(cid => cid.startsWith("card")).length;
                let attrCnt = {};
                open.forEach(cid => { let t = String(Engine.getCardData(cid).type||""); if(t.includes("力量")) attrCnt["力量"] = (attrCnt["力量"]||0) + 1; if(t.includes("迅捷")) attrCnt["迅捷"] = (attrCnt["迅捷"]||0) + 1; if(t.includes("魔术")) attrCnt["魔术"] = (attrCnt["魔术"]||0) + 1; });
                let twin = Object.values(attrCnt).some(n => n >= 2);
                let bonus = basicCnt * 2 + (twin ? 3 : 0);
                if(bonus > 0){ pt.p += bonus; pt.tags.push(`<span style="color:var(--gold);">[猎人锐眼(+${bonus})]</span>`); }
            })
        },
        "雾夜的凶杀": {
            // 开膛手杰克（被动/行动阶段）：若与【妈妈】同地点获得2点魔力，否则移动至【妈妈】所在地点
            // 【妈妈】近似：首个真名解放的对手中战果最高者，标记持续至其被淘汰
            onAction: wrap((p) => {
                let mama = null;
                if(p._jackMamaId){ let t = State.players.find(x => x.id === p._jackMamaId); if(t && t.isAlive) mama = t; }
                if(!mama){ let cands = State.players.filter(o => o.isAlive && o.id !== p.id && o.isRevealed); if(cands.length) mama = cands.reduce((a, b) => a.vp >= b.vp ? a : b); }
                if(!mama){ Engine.log(`【雾夜的凶杀】场上尚无真名解放的对手，无法指定【妈妈】。`, "#aaa"); return false; }
                p._jackMamaId = mama.id;
                if(mama.location === p.location){ Engine.addMana(p, 2); Engine.log(`【雾夜的凶杀】与【妈妈】${mama.master.name} 同处【${p.location}】，获得2点魔力！`, "var(--mana)"); }
                else if(mama.location){ moveTo(p, mama.location, "雾夜的凶杀"); Engine.log(`【雾夜的凶杀】雾中潜行，追踪【妈妈】${mama.master.name}！`, "var(--red)"); }
            })
        },
        "迦摩之灰": {
            // 帕尔瓦蒂（被动/行动阶段）：帕尔瓦蒂的攻击获得+1威力，若你获胜获得1点战果（"仅可在下次淘汰结算会被淘汰时使用"的前置限制由 autoTriggerPassives 触发门槛执行）
            onAction: wrap((p) => {
                p._迦摩之灰 = true;
                Engine.log(`【迦摩之灰】双生：本回合攻击各+1威力，若获胜获得1点战果！`, "var(--mana)");
            }),
            onCombatCalc: wrap((pt) => {
                if(!pt.ply._迦摩之灰) return;
                let c = State.actionChoices[pt.id] || {cards: [], facedown: []};
                let cnt = (c.cards||[]).filter(cid => !(c.facedown||[]).includes(cid) && Engine.getCardData(cid)).length;
                if(cnt > 0){ pt.p += cnt; pt.tags.push(`<span style="color:var(--mana);">[迦摩之灰(+${cnt})]</span>`); }
            }),
            onCombatWin: wrap((pt, winners, all, gl) => { if(pt.ply._迦摩之灰){ pt.ply.vp += 1; gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (迦摩之灰)</span> <span>获胜，+1 战果</span></div>`); } })
        },
        "圈境": {
            onAction: wrap((p) => {
                if(!payCost(p, 3, "圈境")) return;
                p._圈境暗劲 = true;
                p.isRevealed = false;
                Engine.log(`【圈境】${p.master.name} 激活暗劲，隐藏技能区（暗劲持续至战败）！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => {
                if(pt.ply._圈境暗劲){ pt.p += 4; pt.tags.push(`<span style="color:var(--gold);">[暗劲(+4)]</span>`); }
            }),
            onCombatLose: wrap((pt, winners, all, gl) => {
                if(pt.ply._圈境暗劲){ pt.ply._圈境暗劲 = false; gl.push(`<div class="report-line" style="color:#aaa;"><span>✨ 圈境</span> <span>战败，暗劲解除</span></div>`); }
            })
        },
        "人斩": {
            onCombatFinal: wrap((pt, all, gl) => {
                let targets = defeatOpp(pt, all, gl, "人斩", null, "one");
                targets.forEach(o => { o.ply.vp = Math.max(0, o.ply.vp - 3); });
                if(targets.length) gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (刽子手)</span> <span>${targets.map(o=>o.ply.master.name).join('、')} 被【败北】并失去3点战果</span></div>`);
            })
        },
        "仁王立姿": {
            onAction: wrap((p) => {
                let opts = [];
                if(!p._仁王_令咒) opts.push("令咒");
                if(!p._仁王_宝具) opts.push("宝具");
                if(!p._仁王_复制) opts.push("复制技能");
                if(!opts.length){ Engine.log(`【仁王立姿】三项封禁均已使用过（每局各限一次）。`, "#aaa"); return; }
                let resolve = c => {
                    if(!opts.includes(c)) return;
                    if(c === "令咒") p._仁王_令咒 = true;
                    else if(c === "宝具") p._仁王_宝具 = true;
                    else p._仁王_复制 = true;
                    p._仁王封禁 = c;
                    Engine.log(`【仁王立姿】怨灵调伏：本回合对手不可使用【${c}】！`, "var(--gold)");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose("【仁王立姿】选择封禁项", opts, i => resolve(opts[i]), () => {});
                    return;
                }
                resolve(opts[Math.floor(Math.random()*opts.length)]);
            }),
            onCombatStart: wrap((pt, all, loc, gl) => {
                if(!pt.ply._仁王封禁) return;
                let ban = pt.ply._仁王封禁;
                pt.ply._仁王封禁 = null;
                if(ban === "宝具"){ suppressAttr(pt, all, gl, "宝具", "仁王立姿·封宝具"); }
                else {
                    all.filter(o => o.id !== pt.id).forEach(o => { o.p = Math.max(0, o.p - 3); o.tags.push(`<span style="color:var(--red);">[仁王立姿(-3)]</span>`); });
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (仁王立姿)</span> <span>对手无法使用【${ban}】，合计威力-3</span></div>`);
                }
            })
        },
        "日轮啊，顺从死亡": {
            onCombatWin: wrap((pt, winners, all, gl) => {
                if(pt.ply._used_日轮啊顺从死亡) return;
                let losers = all.filter(o => o.id !== pt.id);
                if(!losers.length) return;
                pt.ply._used_日轮啊顺从死亡 = true;
                losers.forEach(o => { o.ply.vp = Math.max(0, o.ply.vp - 3); });
                gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (日轮啊，顺从死亡)</span> <span>败者将于下回合开始时【败北】（近似：各失去3点战果）</span></div>`);
            })
        },
        "日轮呀，化作甲胄": {
            onCombatCalc: wrap((pt, all, gl) => {
                let n = all.filter(o => o.id !== pt.id).length;
                if(n <= 0) return;
                if(!payCost(pt.ply, n, "日轮呀，化作甲胄")) return;
                all.filter(o => o.id !== pt.id).forEach(o => { o.pendingSuppression = (o.pendingSuppression||0) + 5; });
                pt.tags.push(`<span style="color:var(--gold);">[吾之辉，吾之铠]</span>`);
                gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (日轮呀，化作甲胄)</span> <span>花费${n}点魔力，同战场对手的基础攻击威力设为0</span></div>`);
            })
        },
        "三藏的教诲": {
            onAction: wrap((p) => {
                let resolve = x => {
                    x = Math.max(1, Math.min(2, Number(x) || 1));
                    if(!payCost(p, 3*x, "三藏的教诲")) return;
                    Engine.drawCards(p, x);
                let luckCnt = 0;
                for(let i=0;i<x;i++){
                    if(!p.hand.length) break;
                    let idx = p.hand.findIndex(c => DB.cards[c] && DB.cards[c].name === "幸运");
                    if(idx < 0) idx = 0;
                    let c = p.hand.splice(idx,1)[0];
                    let cd = DB.cards[c];
                    if(cd && cd.name === "幸运") luckCnt++;
                }
                    if(luckCnt > 0){
                        p.autoPermBuff = (p.autoPermBuff||0) + 4*luckCnt;
                        Engine.log(`【三藏的教诲】移除${luckCnt}张【幸运】，此牌威力+${4*luckCnt}（此牌持续激活两个回合）！`, "var(--gold)");
                    } else Engine.log(`【三藏的教诲】高速诵经：抽${x}张牌并移除${x}张手牌。`, "var(--mana)");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose(
                        "【三藏的教诲】选择诵经次数",
                        ["诵经1次（支付3点魔力）", "诵经2次（支付6点魔力）"],
                        i => resolve(i + 1),
                        () => {}
                    );
                    return;
                }
                resolve(1);
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoPermBuff){ pt.p += pt.ply.autoPermBuff; pt.tags.push(`<span style="color:var(--gold);">[三藏的教诲(+${pt.ply.autoPermBuff})]</span>`); } })
        },
        "色彩的彼界": {
            onAction: wrap((p) => {
                let resolve = cost => {
                    cost = Math.max(2, Math.min(4, Number(cost) || 2));
                    if(!payCost(p, cost, "色彩的彼界")) return;
                    p.autoSkillBuff = (p.autoSkillBuff||0) + 4;
                    Engine.log(`【色彩的彼界】${p.master.name} 支付${cost}点魔力，将一张【领域外生命】放置入场（激活的领域外生命拥有所有属性，+4合计威力）！`, "var(--gold)");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose(
                        "【色彩的彼界】选择支付的魔力",
                        [2, 3, 4].map(cost => `支付${cost}点魔力`),
                        i => resolve(i + 2),
                        () => {}
                    );
                    return;
                }
                resolve(3);
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[彼界(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "森罗万象": {
            onAction: wrap((p) => {
                addToken(p, "颜色", 3);
                p.autoSkillBuff = (p.autoSkillBuff||0) + 3;
                Engine.log(`【森罗万象】${p.master.name} 放置3枚【颜色】标记，被标记牌的印刷属性更改为标记属性（+3合计威力）！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[森罗万象(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "山脉震撼明星之薪": {
            onCombatFinal: wrap((pt, all, gl) => {
                let opps = all.filter(o => o.id !== pt.id);
                if(!opps.length) return;
                let maxOpp = Math.max(...opps.map(o => o.p));
                if(pt.p > maxOpp){
                    pt.isAvoidDefeat = true;
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (山脉震撼明星之薪)</span> <span>合计威力压过全场胜者，取代成为胜利者！</span></div>`);
                }
            })
        },
        "闪耀的大王冠": {
            onCombatCalc: wrap((pt) => { pt.p += 2; pt.tags.push(`<span style="color:var(--gold);">[大王冠(+2)]</span>`); }),
            onCombatFinal: wrap((pt, all, gl) => {
                pt.isAvoidDefeat = true;
                gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (闪耀的大王冠)</span> <span>【幸运】加护：无视【败北】效果</span></div>`);
            })
        },
        "闪耀于终焉之枪": {
            onCombatWin: wrap((pt, winners, all, gl) => {
                let gain = 3;
                pt.ply._终焉枪累计 = (pt.ply._终焉枪累计||0) + gain;
                pt.ply.vp += gain;
                gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (闪耀于终焉之枪)</span> <span>获胜，移除所在战场的事件牌（+${gain}战果，累计移除战果${pt.ply._终焉枪累计}/12）</span></div>`);
                if(pt.ply._终焉枪累计 > 12){
                    pt.ply.vp += 20;
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (闪耀于终焉之枪)</span> <span>移除战果总和超过12点——终焉降临，获得游戏胜利！（近似：+20战果）</span></div>`);
                }
            })
        },
        "尚未知晓的无垢湖光": {
            onCombatWin: wrap((pt, winners, all, gl) => {
                let opps = all.filter(o => o.id !== pt.id);
                if(opps.some(o => o.p > pt.p)){
                    pt.ply.vp = Math.max(0, pt.ply.vp - 3);
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (尚未知晓的无垢湖光)</span> <span>龙之心：对手控制同属性且更强的攻击，失去3点战果</span></div>`);
                }
            })
        },
        "神便鬼毒酒": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                pt.ply._神便鬼诡妄 = true;
                gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (神便鬼毒酒)</span> <span>诡妄：战斗中所有激活的基础攻击获得&lt;每局游戏限一次&gt;</span></div>`);
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply._神便鬼诡妄){ pt.p += 3; pt.tags.push(`<span style="color:var(--mana);">[诡妄(+3)]</span>`); } })
        },
        "神秘碾断": {
            onAction: wrap((p) => {
                let opps = State.players.filter(op => op.isAlive && op.id !== p.id && op.location === p.location);
                if(!opps.length){ Engine.log(`【神秘碾断】同战场没有其他玩家，效果未发动。`, "#aaa"); return; }
                let resolve = (op, choice) => {
                    if(choice === "魔力"){
                        op.mana = Math.max(0, op.mana - 2);
                        Engine.log(`【神秘碾断】${op.master.name} 选择本回合不能使用魔力（近似：失去2点魔力）。`, "var(--red)");
                    } else if(choice === "战果"){
                        op.vp = Math.max(0, op.vp - 3);
                        Engine.log(`【神秘碾断】${op.master.name} 失去3点战果。`, "var(--red)");
                    }
                };

                let ask = index => {
                    if(index >= opps.length) return;
                    let op = opps[index];
                    let options = ["失去3点战果", "本回合不能使用魔力"];
                    if(op.isPlayer && op.id===Network.myPlayerId){
                        Interaction.choose(
                            `【神秘碾断】${op.master.name} 选择承受的代价`,
                            options,
                            i => {
                                resolve(op, i === 1 ? "魔力" : "战果");
                                ask(index + 1);
                            },
                            () => ask(index + 1)
                        );
                        return;
                    }
                    resolve(op, Math.random() < 0.5 ? "战果" : "魔力");
                    ask(index + 1);
                };

                ask(0);
            })
        },
        "石化之魔眼": {
            onCombatFinal: wrap((pt, all, gl) => {
                defeatOpp(pt, all, gl, "石化之魔眼", o => !oppHasAttr(o, "迅捷"), "all");
            })
        },
        "噬碎死牙之兽": {
            onCombatFinal: wrap((pt, all, gl) => {
                let opps = all.filter(o => o.id !== pt.id);
                if(!opps.length) return;
                if(opps.every(o => o.ply.mana < 3)){
                    pt.isAvoidDefeat = true;
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (噬碎死牙之兽)</span> <span>避矢之加护：对手魔力不足3点，无法令其【败北】</span></div>`);
                } else {
                    opps.filter(o => o.ply.mana >= 3).forEach(o => { o.ply.mana -= 3; });
                    gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (噬碎死牙之兽)</span> <span>避矢之加护：魔力充足的对手各花费3点魔力以维持【败北】</span></div>`);
                }
            }),
            onCombatEnd: wrap((pt, winners, all, gl) => {
                let lines = [];
                all.filter(o => o.id !== pt.id).forEach(o => {
                    let x = Math.min(3, Math.max(0, (o.cards||[]).length - 1));
                    if(x > 0){ o.ply.vp = Math.max(0, o.ply.vp - x); lines.push(`${o.ply.master.name} -${x}`); }
                });
                if(lines.length) gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (噬碎死牙之兽)</span> <span>交战对手失去战果：${lines.join('、')}</span></div>`);
            })
        },
        "数秘术": {
            onAction: wrap((p) => {
                let magics = p.hand.filter(c => DB.cards[c] && (DB.cards[c].type||"").includes("魔术"));
                if(magics.length < 2){ Engine.log(`【数秘术】手中魔术牌不足2张，效果未发动。`, "#aaa"); return; }
                for(let i=0;i<2;i++){ let c = magics[i]; p.hand.splice(p.hand.indexOf(c),1); p.discard.push(c); }
                Engine.addMana(p, 2);
                Engine.log(`【数秘术】${p.master.name} 弃置2张魔术牌，获得2点魔力（【魔像】关闭时机改为战斗阶段结束后）！`, "var(--mana)");
            })
        },
        "双神的神核": {
            onCombatCalc: wrap((pt) => { pt.p += 4; pt.tags.push(`<span style="color:var(--gold);">[双子神核·力量修正×2(+4)]</span>`); })
        },
        "双腕·零次集束": {
            onAction: wrap((p) => {
                if(p._used_双腕零次集束){ Engine.log(`【双腕·零次集束】每局游戏限一次，已使用过。`, "#aaa"); return; }
                p._used_双腕零次集束 = true;
                p.autoSkillBuff = (p.autoSkillBuff||0) + 12;
                Engine.log(`【双腕·零次集束】${p.master.name} 将所有正面朝上的事件牌移除游戏，X=其印刷战果总和的2倍（近似：+12合计威力）！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[零次集束(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "水天日光天照八野镇石": {
            onAction: wrap((p) => {
                if(!payCost(p, 3, "水天日光天照八野镇石")) return;
                p.autoSkillBuff = (p.autoSkillBuff||0) + 5;
                Engine.log(`【水天日光天照八野镇石】倾注：打出所有【封印】牌并支付花费（+5合计威力），每张【解封】牌战后可重新封印或置入弃牌堆！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[倾注(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "水之宁芙": {
            onAction: wrap((p) => {
                if(!p.isRevealed){ Engine.log(`【水之宁芙】真名隐藏时无法打出此牌。`, "#aaa"); return; }
                Engine.drawCards(p, 2);
                p.autoSkillBuff = (p.autoSkillBuff||0) + 4;
                Engine.log(`【水之宁芙】${p.master.name} 为每张【领域外生命】抽并展示一张牌，使其获得该牌所有属性（+4合计威力）！`, "var(--mana)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--mana);">[宁芙(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "撕裂天际的光辉之船（Astrapte Argo）": {
            onAction: wrap((p) => Engine.activateJasonArgo(p))
        },
        "死亡将为明日的希望": {
            onAction: wrap((p) => {
                let others = State.players.filter(op => op.isAlive && op.id !== p.id);
                if(!others.length) return;
                let votes = {};
                let voters = State.players.filter(op => op.isAlive);
                let resolveVote = (op, target) => {
                    if(target && others.includes(target)){
                        votes[target.master.name] = (votes[target.master.name] || 0) + 1;
                    }
                };
                let finish = () => {
                    let names = Object.keys(votes);
                    if(!names.length){ Engine.log(`【审判日】全员弃票，无人被【控诉】。`, "#aaa"); return; }
                    let maxV = Math.max(...names.map(n => votes[n]));
                    let tops = names.filter(n => votes[n] === maxV);
                    if(tops.length === 1){
                        let t = others.find(op => op.master.name === tops[0]);
                        if(t){ addToken(t, "控诉", 1); Engine.log(`【审判日】${t.master.name} 受到最多投票（${maxV}票），被【控诉】直至再度使用审判日！`, "var(--red)"); }
                    } else {
                        let tie = others.filter(op => tops.includes(op.master.name));
                        tie.forEach(op => addToken(op, "控诉", 1));
                        Engine.log(`【审判日】平票！${tie.map(op=>op.master.name).join('、')} 均被【控诉】直至回合结束！`, "var(--red)");
                    }
                };
                let ask = index => {
                    if(index >= voters.length){ finish(); return; }
                    let voter = voters[index];
                    if(voter.isPlayer && voter.id===Network.myPlayerId){
                        Interaction.choose(
                            `【审判日】${voter.master.name} 投票给谁（可弃票）`,
                            [{label:"弃票", value:null}].concat(others.map(target => ({label:target.master.name, value:target}))),
                            i => {
                                resolveVote(voter, i === 0 ? null : others[i - 1]);
                                ask(index + 1);
                            },
                            () => ask(index + 1)
                        );
                        return;
                    }
                    resolveVote(voter, Math.random() < 0.7 ? others[Math.floor(Math.random()*others.length)] : null);
                    ask(index + 1);
                };
                ask(0);
            })
        },
        "诉状箭书": {
            onAction: wrap((p) => {
                if(p.location === "深山町" || p.location === "新都"){
                    p.legionBuff = (p.legionBuff||0) + 5;
                    Engine.log(`【诉状箭书】${p.master.name} 拥有地利，创造并激活一张本回合打出的攻击的临时复制（+5合计威力）！`, "var(--gold)");
                } else Engine.log(`【诉状箭书】没有地利，效果未发动。`, "#aaa");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.legionBuff){ pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[诉状箭书(+${pt.ply.legionBuff})]</span>`); } })
        },
        "他人格": {
            onCombatCalc: wrap((pt) => { pt.p += 4; pt.tags.push(`<span style="color:var(--gold);">[他人格·反转/属性重组(+4)]</span>`); })
        },
        "他人格（Alter Ego Class）": {
            onCombatCalc: wrap((pt) => { pt.p += 4; pt.tags.push(`<span style="color:var(--gold);">[他人格·反转/属性重组(+4)]</span>`); })
        },
        "坛之浦·八艘跳": {
            onAction: wrap((p) => {
                let others = State.players.filter(op => op.isAlive && op.id !== p.id);
                if(!others.length) return;
                let resolve = t => {
                    if(!t || !others.includes(t)) return;
                    let myP = p.hand.reduce((s,c) => s + (DB.cards[c] ? (Number(DB.cards[c].power)||0) : 0), 0) + (p.autoPermBuff||0);
                    let opP = t.hand.reduce((s,c) => s + (DB.cards[c] ? (Number(DB.cards[c].power)||0) : 0), 0) + (t.autoPermBuff||0);
                    if(myP > opP){
                        let myLoc = p.location, opLoc = t.location;
                        if(myLoc !== opLoc){ moveTo(p, opLoc, "坛之浦·八艘跳"); moveTo(t, myLoc, "坛之浦·八艘跳"); }
                        if(myLoc !== opLoc){
                            if(opLoc === "魔术工房" && p.master.id !== "m_kuzuki" && p.master.id !== "m_ryuunosuke"){ Engine.addMana(p, 1); Engine.log(`【坛之浦·八艘跳】${p.master.name} 重新部署于魔术工房，回复1点魔力（QA#16）。`, "var(--mana)"); }
                            if(myLoc === "魔术工房" && t.master.id !== "m_kuzuki" && t.master.id !== "m_ryuunosuke"){ Engine.addMana(t, 1); Engine.log(`【坛之浦·八艘跳】${t.master.name} 重新部署于魔术工房，回复1点魔力（QA#16）。`, "var(--mana)"); }
                        }
                        Engine.log(`【坛之浦·八艘跳】${p.master.name} 威力(${myP})高于 ${t.master.name}(${opP})，两人重新部署在对方的位置！`, "var(--gold)");
                    } else Engine.log(`【坛之浦·八艘跳】${p.master.name} 威力(${myP})不高于 ${t.master.name}(${opP})，无效果。`, "#aaa");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choosePlayer(
                        "【坛之浦·八艘跳】与谁比较合计威力",
                        others,
                        i => resolve(others[i]),
                        () => {}
                    );
                    return;
                }
                resolve(others[Math.floor(Math.random() * others.length)]);
            })
        },
        "天秤护佑": {
            onAction: wrap((p) => {
                if(!p.hand.length){ Engine.log(`【天秤护佑】没有手牌可弃置，效果未发动。`, "#aaa"); return; }
                let resolve = attr => {
                    if(!["力量","迅捷","魔术"].includes(attr)) return;
                    p.discard.push(p.hand.pop());
                    p._天秤制约 = attr;
                    Engine.log(`【天秤护佑】${p.master.name} 弃置1张牌，【制约】${attr}属性：对手使用含${attr}卡牌即被【谴责】（消耗+3，至多+12）！`, "var(--red)");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose(
                        "【天秤护佑】选择要制约的属性",
                        ["力量","迅捷","魔术"],
                        i => resolve(["力量","迅捷","魔术"][i]),
                        () => {}
                    );
                    return;
                }
                resolve(["力量","迅捷","魔术"][Math.floor(Math.random()*3)]);
            }),
            onCombatStart: wrap((pt, all, loc, gl) => {
                if(pt.ply._天秤制约) suppressAttr(pt, all, gl, pt.ply._天秤制约, "天秤护佑·谴责");
            })
        },
        "天地乖离开辟之星": {
            onCombatFinal: wrap((pt, all, gl) => {
                defeatOpp(pt, all, gl, "天地乖离开辟之星", o => {
                    let c = (State.actionChoices[o.id]||{cards:[],facedown:[]});
                    let up = [...(c.cards||[]), ...((o.ply && o.ply.residualCards)||[])].filter(cid => !(c.facedown||[]).includes(cid));
                    let hit = up.some(cid => { let cd = Engine.getCardData(cid); return cd && (cd.type||"").includes("特殊") && (cd.type||"").includes("宝具"); });
                    let skHit = (o.servantSkills||[]).some(i => { let sk = o.ply.servant.skillCards[i]; return sk && (sk.type||"").includes("特殊") && (sk.type||"").includes("宝具"); });
                    return hit || skHit;
                }, "all");
            })
        },
        "天鬼雨": {
            onAction: wrap((p) => {
                let x = Math.min(2, getToken(p, "才智"));
                if(x > 0) addToken(p, "才智", -x);
                let n = 3 + x;
                p.legionBuff = (p.legionBuff||0) + n * 3;
                Engine.log(`【天鬼雨】${p.master.name} 花费${x}点【才智】，从弃牌堆打出${n}张基础攻击（合计+${n*3}威力，战斗阶段结束后洗回牌库）！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.legionBuff){ pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[天鬼雨(+${pt.ply.legionBuff})]</span>`); } })
        },
        "天蝎一射": {
            onCombatCalc: wrap((pt, all, gl) => {
                if(!payCost(pt.ply, 4, "天蝎一射")) return;
                pt.p += 8;
                pt.tags.push(`<span style="color:var(--gold);">[天蝎一射(+8)]</span>`);
                gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (天蝎一射)</span> <span>支付此牌的魔力消耗，将之加入攻击（+8威力）</span></div>`);
            })
        },
        "童子切安纲": {
            onCombatCalc: wrap((pt) => { pt.p += 5; pt.tags.push(`<span style="color:var(--gold);">[童子切安纲·妖刀(+5)]</span>`); })
        },
        "痛幻哭奏": {
            onCombatFinal: wrap((pt, all, gl) => {
                let opps = all.filter(o => o.id !== pt.id);
                if(opps.length && pt.p > Math.max(...opps.map(o => o.p))){
                    defeatOpp(pt, all, gl, "痛幻哭奏·妖精吸血", o => o.p < pt.p, "one");
                }
            })
        },
        "痛哭幻奏": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                let found = false;
                all.filter(o => o.id !== pt.id).forEach(o => {
                    let c = (State.actionChoices[o.id]||{cards:[],facedown:[]});
                    let up = [...(c.cards||[]), ...((o.ply && o.ply.residualCards)||[])].filter(cid => !(c.facedown||[]).includes(cid));
                    let pws = up.map(cid => Engine.getCardData(cid) ? (Number(Engine.getCardData(cid).power)||0) : 0);
                    let dup = pws.some((v,i) => pws.indexOf(v) !== i);
                    if(dup){ found = true; o.pendingSuppression = (o.pendingSuppression||0) + 5; }
                });
                if(found) gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (痛哭幻奏)</span> <span>悲叹共鸣：相同基本威力的非残留攻击被关闭</span></div>`);
                else {
                    let n = Math.min(3, pt.ply.deck.length);
                    for(let i=0;i<n;i++) pt.ply.discard.push(pt.ply.deck.pop());
                    gl.push(`<div class="report-line" style="color:#aaa;"><span>✨ ${pt.ply.master.name} (痛哭幻奏)</span> <span>没有同威力攻击，弃置牌库顶${n}张牌</span></div>`);
                }
            })
        },
        "荼枳尼天法": {
            onCombatCalc: wrap((pt) => { pt.p += 4; pt.tags.push(`<span style="color:var(--gold);">[广日照·魔术守护(+4)]</span>`); })
        },
        "万能之人": {
            onAction: wrap((p) => {
                let opts = ["威力+6", "抽2张牌", "获得4点魔力"];
                let resolve = c => {
                    if(!opts.includes(c)) return;
                    if(c === "威力+6"){ p.autoSkillBuff = (p.autoSkillBuff||0) + 6; Engine.log(`【万能之人】${p.master.name} 复制宝具威能（+1威力与❄属性），+6合计威力！`, "var(--gold)"); }
                    else if(c === "抽2张牌"){ Engine.drawCards(p, 2); Engine.log(`【万能之人】${p.master.name} 复制宝具效果：抽2张牌！`, "var(--gold)"); }
                    else { Engine.addMana(p, 4); Engine.log(`【万能之人】${p.master.name} 复制宝具效果：获得4点魔力！`, "var(--gold)"); }
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose(
                        "【万能之人】选择复制的宝具效果",
                        opts,
                        i => resolve(opts[i]),
                        () => {}
                    );
                    return;
                }
                resolve(opts[Math.floor(Math.random()*opts.length)]);
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[万能之人(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "王冠·睿智之光": {
            onAction: wrap((p) => {
                if(p._used_王冠睿智之光){ Engine.log(`【王冠·睿智之光】每局游戏限一次，已使用过。`, "#aaa"); return; }
                p._used_王冠睿智之光 = true;
                p._王冠魔像 = true;
                Engine.log(`【王冠·睿智之光】残留激活：此牌视为【魔像】参战（合计威力+4，战斗中威力非最高时关闭所有【魔像】）！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt, all) => {
                if(!pt.ply._王冠魔像) return;
                let opps = all.filter(o => o.id !== pt.id);
                if(opps.length && pt.p <= Math.max(...opps.map(o => o.p))){
                    pt.ply._王冠魔像 = false;
                    pt.tags.push(`<span style="color:var(--red);">[魔像·关闭]</span>`);
                } else {
                    pt.p += 4;
                    pt.tags.push(`<span style="color:var(--gold);">[魔像(+4)]</span>`);
                }
            }),
            onCombatWin: wrap((pt, winners, all, gl) => {
                if(pt.ply._王冠魔像){
                    pt.ply.autoPermBuff = (pt.ply.autoPermBuff||0) + 3;
                    gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (王冠·睿智之光)</span> <span>获胜，一张【魔像】从手牌/牌库/弃牌堆加入攻击（永久+3威力）</span></div>`);
                }
            })
        },
        "不屈的意志": {
            onCombatCalc: wrap((pt, all) => {
                let cs = all.filter(o => o.id !== pt.id).reduce((s, o) => s + (o.ply.commandSpells || 0), 0);
                if(cs > 0){ pt.p += cs; pt.tags.push(`<span style="color:var(--gold);">[不屈的意志·令咒威压(+${cs})]</span>`); }
            })
        },
        "军神五兵": {
            onAction: wrap((p) => {
                if(p._lushenUsed){ Engine.log(`【军神五兵】此牌效果已发动过（每局游戏限一次）。`, "#aaa"); return; }
                p._lushenUsed = true; p._lushenActive = true;
                Engine.log(`【军神五兵】本回合你打出的非基础攻击基本威力翻倍（仅本回合有效，QA#4：不可多回合反复翻倍）！`, "var(--red)");
            }),
            onCombatCalc: wrap((pt) => {
                if(!pt.ply._lushenActive) return;
                let c = State.actionChoices[pt.id] || {cards:[],facedown:[]};
                let basics = ["低位魔法","中位魔法","高位魔法","狂战士魔法1","狂战士魔法2","迫击","强打","浑身的一击","会心的一击","狂战士力量1","狂战士力量2","翻弄","瞬间移动","瞬间的一击","刹那的一击","狂战士迅捷1","狂战士迅捷2"];
                let nb = (c.cards||[]).filter(cid => Engine.getCardData(cid) && !basics.includes(Engine.getCardData(cid).name) && !(c.facedown||[]).includes(cid));
                if(nb.length){ let add = nb.reduce((s,cid)=>s+(Number(Engine.getCardData(cid).power)||0),0); pt.p += add; pt.tags.push(`<span style="color:var(--red);">[军神五兵·翻倍(+${add})]</span>`); }
            })
        },
        "雷电之手": {
            onAction: wrap((p) => {
                p._teslaHand = true;
                Engine.log(`【雷电之手】残留生效：同地点其他玩家花费2+魔力时你获得2点魔力（引擎无花费钩子，请手动结算）；获得魔力超过上限时合计威力+5，战斗阶段结束关闭。`, "#aaa");
            }),
            onCombatCalc: wrap((pt) => {
                if(pt.ply._teslaHand && pt.ply._teslaOverload){ pt.p += 5; pt.tags.push(`<span style="color:var(--gold);">[雷电之手·超载(+5)]</span>`); }
            }),
            onCombatEnd: wrap((pt) => {
                if(pt.ply._teslaHand){ pt.ply._teslaHand = false; pt.ply._teslaOverload = false; }
            })
        },
        "忘却补正": {
            onAction: wrap((p) => {
                if(!p.hand.length){ Engine.log(`【忘却补正】没有手牌可打出，效果未发动。`, "#aaa"); return; }
                let idx = 0, bestCost = null;
                p.hand.forEach((c,i) => { let cost = DB.cards[c] ? (Number(DB.cards[c].cost)||0) : 0; if(bestCost === null || cost < bestCost){ bestCost = cost; idx = i; } });
                let c = p.hand[idx];
                let cd = DB.cards[c];
                let cost = cd ? (Number(cd.cost)||0) : 0;
                // QA#23：圣杯容器（伊莉雅-1光环）总是最先计算，再乘2
                if(p.master.id === "m_iliya") cost = Math.max(0, cost - 1);
                if(!payCost(p, cost*2, "忘却补正")) return;
                p.hand.splice(idx,1); p.discard.push(c);
                Engine.drawCards(p, 1);
                Engine.log(`【忘却补正】${p.master.name} 打出一张牌并花费其两倍消耗（${cost*2}点魔力），抽1张牌！`, "var(--mana)");
            })
        },
        "维新之刃": {
            onCombatCalc: wrap((pt) => {
                let c = (State.actionChoices[pt.id]||{cards:[],facedown:[]});
                let n = (c.cards||[]).filter(cid => Engine.getCardData(cid) && (Engine.getCardData(cid).type||"").includes("迅捷")).length;
                let b = n * 2;
                if(b > 0){ pt.p += b; pt.tags.push(`<span style="color:var(--gold);">[船中八策·迅捷×${n}(+${b})]</span>`); }
            })
        },
        "伟大的时间啊，于此回转": {
            onAction: wrap((p) => {
                Engine.drawCards(p, 1);
                p.autoSkillBuff = (p.autoSkillBuff||0) + 2;
                Engine.log(`【伟大的时间啊，于此回转】空无边处天：下回合抽取局势牌后额外激活一张局势牌（近似：抽1张牌，+2合计威力）！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[时间回转(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "伪·大神宣言": {
            onAction: wrap((p) => {
                let active=Engine.getActiveCommanderCards(p);
                let bonuses={x_CommanderOrtlinde:2,x_CommanderHildr:3,x_CommanderThrud:6};
                let total=active.reduce((sum,cid)=>sum+(bonuses[cid]||0),0);
                if(total>0){
                    p.autoSkillBuff=(p.autoSkillBuff||0)+total;
                    Engine.log(`【伪·大神宣言】${p.master.name} 重新触发${active.length}张激活的【指挥官】“打出时”效果（合计+${total}威力）！`, "var(--gold)");
                } else Engine.log(`【伪·大神宣言】没有激活的【指挥官】，效果未发动。`, "#aaa");
            })
        },
        "为你撰写的故事": {
            onCombatFinal: wrap((pt, all, gl) => {
                pt.isAvoidDefeat = true;
                gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (为你撰写的故事)</span> <span>【幸运】加护：无视【败北】效果</span></div>`);
            })
        },
        "未能回归于星的龙": {
            onAction: wrap((p) => {
                if(p.location !== "侦察"){ Engine.log(`【未能回归于星的龙】不在侦察，星陨未发动。`, "#aaa"); return; }
                let resolve = dest => {
                    if(!["深山町","新都","魔术工房"].includes(dest)) return;
                    Engine.addMana(p, 4);
                    p.vp += 2;
                    p._星陨耗魔 = 8;
                    moveTo(p, dest, "星陨");
                    Engine.log(`【星陨】${p.master.name} 获得4点魔力与2点战果，战斗阶段结束后将失去8点魔力！`, "var(--gold)");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.chooseLocation("【星陨】移动至除侦察外的地点", ["深山町","新都","魔术工房"], i => resolve(["深山町","新都","魔术工房"][i]), () => {});
                    return;
                }
                resolve(["深山町","新都","魔术工房"][Math.floor(Math.random()*3)]);
            }),
            onCombatEnd: wrap((pt, winners, all, gl) => {
                if(pt.ply._星陨耗魔){
                    let loss = Math.min(pt.ply._星陨耗魔, pt.ply.mana);
                    pt.ply.mana -= loss;
                    pt.ply._星陨耗魔 = 0;
                    gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (星陨)</span> <span>失去${loss}点魔力</span></div>`);
                }
            })
        },
        "未亡人": {
            onAction: wrap((p) => {
                let others = State.players.filter(op => op.isAlive && op.id !== p.id);
                let came = [];
                let resolve = (op, yes) => {
                    if(!yes || op.location === p.location) return;
                    if(moveTo(op, p.location, "未亡人的请柬")) came.push(op.master.name);
                };
                let finish = () => {
                    Engine.log(came.length ? `【未亡人的请柬】${came.join('、')} 应邀移动至【${p.location}】！` : `【未亡人的请柬】无人赴约。`, "var(--gold)");
                };
                let ask = index => {
                    if(index >= others.length){ finish(); return; }
                    let op = others[index];
                    if(op.isPlayer && op.id===Network.myPlayerId){
                        Interaction.confirm(
                            `【未亡人的请柬】是否移动至 ${p.master.name} 所在的【${p.location}】？`,
                            yes => { resolve(op, yes); ask(index + 1); },
                            () => ask(index + 1)
                        );
                        return;
                    }
                    resolve(op, Math.random() < 0.4);
                    ask(index + 1);
                };
                ask(0);
            }),
            onCombatLose: wrap((pt, winners, all, gl) => {
                let hasSword = (winners||[]).some(w => ((w.ply.servant && w.ply.servant.skillCards) || []).some(sk => sk && sk.name && sk.name.includes("流离魔剑")));
                if(hasSword){
                    pt.ply.vp += 2;
                    gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (未亡人)</span> <span>持【流离魔剑】者获胜——同时赢得该战斗（+2战果，无视败北）</span></div>`);
                }
            })
        },
        "我将根绝一切毒物，一切害物": {
            onAction: wrap((p) => {
                let owners = State.players.filter(op => op.isAlive && op.id !== p.id && op.location === p.location && ((op.servant && op.servant.skillCards) || []).some(sk => sk && sk.name === "克里米亚天使"));
                let gained = false;
                if(owners.length){
                    let o = owners[0];
                    let pay = Math.min(4, o.mana);
                    o.mana -= pay;
                    gained = true;
                    Engine.log(`【我将根绝一切毒物，一切害物】支付 ${o.master.name} 的${pay}点魔力，将其激活的【克里米亚天使】加入攻击！`, "var(--gold)");
                } else if(payCost(p, 4, "我将根绝一切毒物，一切害物")){
                    gained = true;
                    Engine.log(`【我将根绝一切毒物，一切害物】${p.master.name} 自行支付4点魔力，将任意战场一名玩家激活的【克里米亚天使】加入攻击！`, "var(--gold)");
                }
                if(gained) p.legionBuff = (p.legionBuff||0) + 6;
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.legionBuff){ pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[根绝毒物(+${pt.ply.legionBuff})]</span>`); } })
        },
        "我心爱的蜂蜜酒": {
            onAction: wrap((p) => {
                let opps = State.players.filter(op => op.isAlive && op.id !== p.id && op.location === p.location);
                if(!opps.length){ Engine.log(`【我心爱的蜂蜜酒】同地点没有对手，效果未发动。`, "#aaa"); return; }
                let resolve = t => {
                    if(!t || !opps.includes(t)) return;
                    addToken(t, "迷醉", 1);
                    p.vp += 2;
                    Engine.log(`【我心爱的蜂蜜酒】${t.master.name} 于下回合【迷醉】，其本回合获得的战果将归你（近似：立即+2战果；若其获得战果少于3点将失去3点）！`, "var(--mana)");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choosePlayer(
                        "【我心爱的蜂蜜酒】选择下回合迷醉的对手",
                        opps,
                        i => resolve(opps[i]),
                        () => {}
                    );
                    return;
                }
                resolve(opps[Math.floor(Math.random()*opps.length)]);
            })
        },
        "我心爱的钢铁战车": {
            onCombatEnd: wrap((pt, winners, all, gl) => {
                let w = (winners||[]).find(x => x.id !== pt.id);
                if(w){
                    addToken(w.ply, "拜服", 1);
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (我心爱的钢铁战车)</span> <span>${w.ply.master.name} 于下回合【拜服】，将部署于你所在的地点</span></div>`);
                }
            }),
            onAction: wrap((p) => {
                let fans = State.players.filter(op => op.isAlive && op.id !== p.id && getToken(op, "拜服") > 0);
                fans.forEach(op => {
                    addToken(op, "拜服", -1);
                    moveTo(op, p.location, "拜服·钢铁战车");
                });
                if(fans.length) Engine.log(`【我心爱的钢铁战车】${fans.map(op=>op.master.name).join('、')} 【拜服】，随你部署于【${p.location}】！`, "var(--gold)");
            })
        },
        "无偿无限普遍之爱": {
            onCombatCalc: wrap((pt, all, gl) => {
                let hit = all.filter(o => o.id !== pt.id && getToken(o.ply, "裁决者令咒") >= 3);
                if(hit.length){
                    hit.forEach(o => { o.p = 0; o.tags.push(`<span style="color:var(--red);">[全然降服·威力归零]</span>`); });
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (无偿无限普遍之爱)</span> <span>拥有3枚及以上【裁决者令咒】者合计威力归零：${hit.map(o=>o.ply.master.name).join('、')}</span></div>`);
                }
            })
        },
        "无可逃脱死亡钩爪": {
            onAction: wrap((p) => {
                if(p.location !== "深山町" && p.location !== "新都"){ Engine.log(`【无可逃脱死亡钩爪】不在战场，钩爪无处施展。`, "#aaa"); return; }
                let cands = State.players.filter(op => op.isAlive && op.id !== p.id && op.location !== p.location);
                if(!cands.length){ Engine.log(`【无可逃脱死亡钩爪】没有可拖拽的对手。`, "#aaa"); return; }
                let resolve = t => {
                    if(!t || !cands.includes(t)) return;
                    moveTo(t, p.location, "死亡钩爪");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choosePlayer(
                        "【无可逃脱死亡钩爪】选择要拖拽的对手",
                        cands,
                        i => resolve(cands[i]),
                        () => {}
                    );
                    return;
                }
                resolve(cands[Math.floor(Math.random()*cands.length)]);
            }),
            onCombatEnd: wrap((pt, winners, all, gl) => {
                let hits = all.filter(o => o.id !== pt.id && o.p < 12);
                if(hits.length){
                    hits.forEach(o => { o.ply.vp = Math.max(0, o.ply.vp - 2); });
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (无可逃脱死亡钩爪)</span> <span>战力低于12的对手各失去2点战果</span></div>`);
                }
            })
        },
        "无名森林": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                all.filter(o => o.id !== pt.id).forEach(o => { o.pendingSuppression = (o.pendingSuppression||0) + 3; });
                gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (无名森林)</span> <span>记忆的游乐场：同地点的【真名解放】类技能牌无法被使用</span></div>`);
            })
        },
        "无人知晓的无垢搏动": {
            onCombatWin: wrap((pt, winners, all, gl) => {
                let opps = all.filter(o => o.id !== pt.id);
                if(opps.some(o => o.p > pt.p)){
                    pt.ply.vp = Math.max(0, pt.ply.vp - 3);
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (无人知晓的无垢搏动)</span> <span>龙之心：对手控制同属性且更强的攻击，失去3点战果</span></div>`);
                }
            })
        },
        "无限增值": {
            onCombatCalc: wrap((pt, all, gl) => {
                pt.p += 3;
                if(pt.p > 21){
                    let closed = pt.p;
                    pt.p = 0;
                    pt.tags.push(`<span style="color:var(--red);">[幼儿退行·攻击全关]</span>`);
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (无限增值)</span> <span>合计威力超过21（原${closed}），幼儿退行——所有攻击被关闭！</span></div>`);
                } else {
                    pt.tags.push(`<span style="color:var(--gold);">[残留(+3)]</span>`);
                }
            })
        },

        // ===== merged from _gen_batch_4.js =====
        // _gen_batch_4.js — Manual 手工表对象字面量片段（合并进 SkillLib.js 的 Manual 表；依赖 wrap/moveTo/payCost/defeatOpp/addToken/getToken/Engine/State/DB）
        "无以誓约守护之车轮": {
            onAction: wrap((p) => {
                if(p._used_无以誓约守护之车轮){ Engine.log(`【无以誓约守护之车轮】每局游戏限一次，已使用过。`, "#aaa"); return; }
                let resolve = dest => {
                    let moved = false;
                    if(dest && p.mana >= 2 && moveTo(p, dest, "无以誓约守护之车轮")){
                        p.mana -= 2;
                        moved = true;
                    }
                    p._used_无以誓约守护之车轮 = true;
                    p.autoSkillBuff = (p.autoSkillBuff||0) + 5;
                    Engine.log(`【无以誓约守护之车轮】获得5点合计威力，残留：对手不能关闭你的牌${moved ? "，已沿箭头移动一步" : ""}！`, "var(--gold)");
                };

                if(p.isPlayer && p.id===Network.myPlayerId){
                    let locs = ["深山町", "新都", "侦察"];
                    Interaction.choose(
                        "【无以誓约守护之车轮】选择效果",
                        [
                            ...locs.map(loc => ({ label: `花费2点魔力沿箭头移动至${loc}` })),
                            { label: "不移动，直接获得威力" }
                        ],
                        i => resolve(i < locs.length ? locs[i] : ""),
                        () => {}
                    );
                    return;
                }

                resolve(p.mana >= 2 ? "新都" : "");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[誓约车轮(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "吾爱通达万物": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                let opps = all.filter(o => o.id !== pt.id);
                opps.forEach(o => { o.p = Math.max(0, o.p - 2); o.tags.push(`<span style="color:var(--red);">[裁军(-2)]</span>`); });
                if(opps.length) gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (吾爱通达万物)</span> <span>非【罗马】的对手被【裁军】，合计威力-2</span></div>`);
            }),
            onCombatCalc: wrap((pt, all) => {
                if(all.filter(o => o.id !== pt.id).length > 0){
                    pt.p += 4;
                    pt.tags.push(`<span style="color:var(--gold);">[罗马全方位(+4)]</span>`);
                }
            })
        },
        "五行山·释迦如来掌": {
            onAction: wrap((p) => {
                let idx = p.hand.findIndex(c => { let cd = DB.cards[c]; return cd && (cd.name === "幸运" || (cd.type||"").includes("幸运")); });
                if(idx > -1){
                    let c = p.hand.splice(idx, 1)[0];
                    p.discard.push(c);
                    p.autoSkillBuff = (p.autoSkillBuff||0) + 5;
                    Engine.log(`【五行山·释迦如来掌】打出的暗置攻击为【幸运】，展示后弃置，此牌+5威力！`, "var(--gold)");
                } else {
                    Engine.log(`【五行山·释迦如来掌】手牌中没有【幸运】攻击，未获得加成。`, "#aaa");
                }
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[释迦如来掌(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "喜见城·冰柱削": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                Engine.drawCards(pt.ply, 1);
                gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (喜见城·冰柱削)</span> <span>于战斗阶段再次使用行动阶段能力（近似：抽1张牌）</span></div>`);
            }),
            onCombatCalc: wrap((pt) => { pt.p += 4; pt.tags.push(`<span style="color:var(--mana);">[冰柱削(+4)]</span>`); })
        },
        "向端丽的吾父发起叛逆": {
            onAction: wrap((p) => {
                let maxX = Math.min(10, Math.max(0, Number(p.mana) || 0));
                let resolve = x => {
                    x = Math.max(0, Math.min(maxX, Number(x) || 0));
                    if(x > 0 && payCost(p, x, "向端丽的吾父发起叛逆")){
                        p.autoSkillBuff = (p.autoSkillBuff||0) + 2 * x;
                        p._mordredSpent = (p._mordredSpent||0) + x;
                        Engine.log(`【向端丽的吾父发起叛逆】魔力放出：花费${x}点魔力，此牌+${2*x}威力（战败时恢复一半魔力，不可阻止）！`, "var(--red)");
                    }
                };

                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose(
                        "【向端丽的吾父发起叛逆】选择投入魔力量",
                        Array.from({ length: maxX + 1 }, (_, i) => ({ label: i === 0 ? "不投入" : `投入${i}点魔力，获得+${2 * i}威力` })),
                        i => resolve(i),
                        () => {}
                    );
                    return;
                }

                resolve(Math.min(5, Math.floor(p.mana / 2)));
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--red);">[魔力放出(+${pt.ply.autoSkillBuff})]</span>`); } }),
            onCombatLose: wrap((pt, winners, all, gl) => {
                let spent = pt.ply._mordredSpent || 0;
                if(spent > 0){
                    let back = Math.ceil(spent / 2);
                    pt.ply._mordredSpent = 0;
                    Engine.addMana(pt.ply, back);
                    gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (向端丽的吾父发起叛逆)</span> <span>战败，恢复${back}点魔力（该恢复不可被阻止）</span></div>`);
                }
            })
        },
        "小型魔像（Lesser Golem）": {
            onCombatCalc: wrap((pt) => { pt.p += 3; pt.tags.push(`<span style="color:var(--red);">[魔像(+3)]</span>`); })
        },
        "小夜曲": {
            onAction: wrap((p) => {
                p.autoSkillBuff = (p.autoSkillBuff||0) + 3;
                Engine.log(`【小夜曲】摇篮曲：其他玩家本回合不能离开【魔术工房】；下一回合【献给死神的安魂曲】+3威力！`, "var(--mana)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--mana);">[摇篮曲(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "邪智的魅力": {
            onAction: wrap((p) => {
                Engine.drawCards(p, 1);
                let baseIdx = p.hand.findIndex(c => { let cd = DB.cards[c]; return cd && ["力量","迅捷","魔术","魔法"].includes(cd.type||""); });
                let pw = 0;
                if(baseIdx > -1){
                    let c = p.hand.splice(baseIdx, 1)[0];
                    pw = Number(DB.cards[c].power) || 0;
                    p.discard.push(c);
                }
                let b = Math.max(2, pw);
                p.autoSkillBuff = (p.autoSkillBuff||0) + b;
                Engine.log(`【邪智的魅力】从者首次真名解放：抽1张牌，以基础手牌增幅其技能（+${b}威力）！`, "var(--red)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--red);">[增幅(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "信仰的加护": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                let p = pt.ply;
                let others = State.players.filter(op => op.isAlive && op.id !== p.id && op.location === p.location);
                let luckIdx = p.hand.findIndex(c => { let cd = DB.cards[c]; return cd && (cd.name === "幸运" || (cd.type||"").includes("幸运")); });
                let choice=(State.combatPhaseChoices[pt.id]||{}).faithProtection||{mode:"self",targetId:null};
                let mode=choice.mode==="give"&&others.length>0&&luckIdx>-1?"give":"self";
                if(mode === "give"){
                    p.hand.splice(luckIdx, 1);
                    let t=others.find(op=>op.id===choice.targetId)||others[0];
                    t.commandSpells = (t.commandSpells||0) + 1;
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${p.master.name} (圣女之誓)</span> <span>移除一张【幸运】，${t.master.name} 获得一枚【裁决者令咒】</span></div>`);
                } else {
                    p.commandSpells = (p.commandSpells||0) + 1;
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${p.master.name} (圣女之誓)</span> <span>获得一枚【裁决者令咒】（只有玛尔达可以使用）</span></div>`);
                }
            })
        },
        "星是昴星": {
            onAction: wrap((p) => {
                Engine.drawCards(p, 1);
                p.autoSkillBuff = (p.autoSkillBuff||0) + 3;
                Engine.log(`【星是昴星】月是满月：打出对手技能区的【暮云春树】（近似：抽1张牌），激活的【暮云春树】+3威力！`, "var(--mana)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--mana);">[月是满月(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        // 星月夜：QA#12/61——被/前效果获得残留效果可残留到下个回合（引擎残留机制天然满足，持续至战败为止）
        "星月夜": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                let p = pt.ply;
                if(!p.isRevealed){
                    let t = State.players.filter(op => op.isAlive && op.id !== p.id && ["深山町","新都","侦察"].includes(op.location));
                    t.forEach(op => { Engine.drawCards(op, 1); });
                    gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${p.master.name} (星月夜)</span> <span>真名隐藏：战场与侦查的所有玩家各将一张游戏外的【领域外生命】加入手牌（近似：各抽1张牌）</span></div>`);
                } else {
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${p.master.name} (星月夜)</span> <span>真名已解放：所有【领域外生命】+3威力</span></div>`);
                }
            }),
            onCombatCalc: wrap((pt, all) => {
                let p = pt.ply;
                if(p.isRevealed){
                    // 真名解放：所有玩家（含对手）打出的【领域外生命】各+3威力
                    all.forEach(o => {
                        let hasForeign = (o.servantSkills||[]).some(i => { let sk = o.ply.servant && o.ply.servant.skillCards[i]; return sk && sk.name === "领域外生命"; });
                        if(hasForeign){ o.p += 3; o.tags.push(`<span style="color:var(--gold);">[星月夜·领域外生命(+3)]</span>`); }
                    });
                }
                if(p.autoSkillBuff){ pt.p += p.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[星月夜(+${p.autoSkillBuff})]</span>`); }
            })
        },
        "腥红之月": {
            onAction: wrap((p) => { Engine.addMana(p, 3); Engine.log(`【腥红之月】一同打出的另一张牌魔力消耗-3（近似：获得3点魔力）！`, "var(--mana)"); }),
            onCombatStart: wrap((pt, all, loc, gl) => {
                let p = pt.ply;
                let inCombat = new Set(all.map(o => o.ply.id));
                let targets = State.players.filter(op => op.isAlive && op.id !== p.id && !inCombat.has(op.id));
                targets.forEach(op => {
                    op.vp = Math.max(0, op.vp - 1);
                    moveTo(op, p.location, "腥红之月");
                });
                if(targets.length) gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${p.master.name} (腥红之月)</span> <span>未交战的对手 ${targets.map(op=>op.master.name).join('、')} 各失去1点战果并被吸引至【${p.location}】</span></div>`);
            })
        },
        "虚数潜航艇": {
            onAction: wrap((p) => {
                let resolve = dest => {
                    if(!["深山町","新都","侦察","魔术工房"].includes(dest)) return;
                    moveTo(p, dest, "虚数潜航艇");
                    Engine.log(`【虚数潜航艇】下潜！直至回合结束，所有【固有结界】事件牌效果无效（使用后移除）！`, "var(--mana)");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.chooseLocation("【虚数潜航艇】移动至任意地点", ["深山町","新都","侦察","魔术工房"], i => resolve(["深山町","新都","侦察","魔术工房"][i]), () => {});
                    return;
                }
                resolve(["深山町","新都","侦察","魔术工房"][Math.floor(Math.random()*4)]);
            })
        },
        "选定之杖": {
            onAction: wrap((p) => {
                let resolve = x => {
                    x = Math.max(1, Math.min(3, Number(x) || 1));
                    if(!payCost(p, x, "选定之杖")) return;
                    let seen = p.deck.splice(0, x + 2);
                    if(seen.length === 0){ Engine.log(`【选定之杖】牌库为空，无牌可查看。`, "#aaa"); return; }
                    let finish = pick => {
                        if(!Number.isInteger(pick) || pick < 0 || pick >= seen.length) return;
                        p.hand.push(seen[pick]);
                        seen.forEach((c, i) => { if(i !== pick) p.discard.push(c); });
                        Engine.log(`【选定之杖】花费${x}点魔力，查看${seen.length}张牌，将【${(DB.cards[seen[pick]]||{}).name || "???"}】加入手牌，其余弃置。`, "var(--mana)");
                    };
                    if(p.isPlayer && p.id===Network.myPlayerId){
                        Interaction.choose(
                            `【选定之杖】选择加入手牌的牌（已查看${seen.length}张）`,
                            seen.map(c => (DB.cards[c] && DB.cards[c].name) || "???"),
                            i => finish(i),
                            () => {
                                p.mana += x;
                                p.deck = seen.concat(p.deck);
                            }
                        );
                        return;
                    }
                    let pick = seen.reduce((bi, c, i) => (Number((DB.cards[c]||{}).power)||0) > (Number((DB.cards[seen[bi]]||{}).power)||0) ? i : bi, 0);
                    finish(pick);
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose(
                        "【选定之杖】选择花费的魔力",
                        [1, 2, 3].map(x => `花费${x}点魔力，查看${x + 2}张牌`),
                        i => resolve(i + 1),
                        () => {}
                    );
                    return;
                }
                resolve(Math.min(3, Math.max(1, Math.floor(p.mana / 2))));
            })
        },
        "选王剑": {
            onAction: wrap((p) => {
                Engine.drawCards(p, 1);
                Engine.log(`【选王剑】其他特殊属性攻击+2威力；将一张本回合打出的攻击返回手牌（近似：抽1张牌）！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { pt.p += 2; pt.tags.push(`<span style="color:var(--gold);">[选王剑(+2)]</span>`); })
        },
        "炫目的闪光魔盾": {
            onAction: wrap((p) => {
                if(payCost(p, 4, "炫目的闪光魔盾")){
                    Engine.drawCards(p, 1);
                    Engine.log(`【炫目的闪光魔盾】支付4点魔力并【真名解放】，从手牌打出一张基础攻击（近似：抽1张牌）！`, "var(--mana)");
                }
            }),
            onCombatStart: wrap((pt, all, gl) => {
                all.filter(o => o.id !== pt.id).forEach(o => { o.p = Math.max(0, o.p - 3); o.tags.push(`<span style="color:var(--red);">[闪光魔盾(-3)]</span>`); });
                gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (炫目的闪光魔盾)</span> <span>交战对手与你同属性的基础攻击威力无法被增加（近似：全体对手-3）</span></div>`);
            })
        },
        "讯息：和平": {
            onAction: wrap((p) => {
                p.autoSkillBuff = (p.autoSkillBuff||0) + 4;
                Engine.log(`【讯息：和平】深空奏鸣：打出至多2张【降临者】与2张暗置牌（近似：+4合计威力）！`, "var(--mana)");
            }),
            onCombatStart: wrap((pt, all, gl) => {
                all.filter(o => o.id !== pt.id).forEach(o => {
                    o.p = Math.max(0, o.p - 5);
                    o.tags.push(`<span style="color:var(--red);">[深空奏鸣(-5)]</span>`);
                });
                gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (讯息：和平)</span> <span>展示所有玩家手牌，持【降临者】者的攻击威力降低（近似：全体对手-5）</span></div>`);
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--mana);">[深空奏鸣(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "岩窟王": {
            onAction: wrap((p) => {
                if(payCost(p, 4, "岩窟王")){
                    p._chateauPending = true;
                    Engine.log(`【岩窟王】花费4点魔力：你的下一场战斗开始时，将令持有此牌的玩家【败北】并【真名解放】！`, "var(--red)");
                }
            }),
            onCombatStart: wrap((pt, all, gl) => {
                if(pt.ply._chateauPending){
                    pt.ply._chateauPending = false;
                    pt.ply.isRevealed = true;
                    defeatOpp(pt, all, gl, "岩窟王", null, "one");
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (岩窟王)</span> <span>【爱德蒙·唐泰斯】真名解放！</span></div>`);
                }
            })
        },
        "炎门守护者": {
            onCombatStart: wrap((pt, all, gl) => {
                all.filter(o => o.id !== pt.id).forEach(o => { o.p = Math.max(0, o.p - 2); o.tags.push(`<span style="color:var(--red);">[炎门(-2)]</span>`); });
                gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (炎门守护者)</span> <span>所在战场所有玩家每回合只可打出1张正面牌（近似：对手合计威力-2）</span></div>`);
            })
        },
        "炎神咆哮": {
            onAction: wrap((p) => {
                let resolve = n => {
                    n = Math.max(0, Math.min(3, Number(n) || 0, p.hand.length));
                    for(let i=0;i<n;i++) p.discard.push(p.hand.pop());
                    p.autoSkillBuff = (p.autoSkillBuff||0) + 2 * n;
                    Engine.log(`【炎神咆哮】预言之射：弃置${n}张手牌，+${2*n}合计威力（命中预言之威的对手将败北）！`, "var(--red)");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    let max = Math.min(3, p.hand.length);
                    Interaction.choose(
                        "【炎神咆哮】选择弃置的手牌数量",
                        Array.from({length: max + 1}, (_, i) => `${i}张`),
                        i => resolve(i),
                        () => {}
                    );
                    return;
                }
                resolve(Math.min(3, p.hand.length));
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--red);">[预言之射(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "妖精的精美收藏": {
            onCombatCalc: wrap((pt, all) => {
                let opps = all.filter(o => o.id !== pt.id);
                if(opps.length){
                    let b = Math.max(2, Math.floor(Math.max(...opps.map(o => o.p)) / 2));
                    pt.p += b;
                    pt.tags.push(`<span style="color:var(--gold);">[分身(+${b})]</span>`);
                }
            })
        },
        "业已无法抵达的理想乡": {
            onCombatWin: wrap((pt, winners, all, gl) => {
                addToken(pt.ply, "理想乡", 1);
                let n = getToken(pt.ply, "理想乡");
                if(n >= 7){
                    pt.ply.vp += 20;
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (业已无法抵达的理想乡)</span> <span>止境完成！移除第7张宝具，达成游戏胜利（近似：+20战果）！</span></div>`);
                } else {
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (业已无法抵达的理想乡)</span> <span>赢得战斗，移除1张已激活的宝具（进度${n}/7）</span></div>`);
                }
            })
        },
        "隐藏不贞的头盔": {
            onAction: wrap((p) => {
                p.isRevealed = false;
                Engine.drawCards(p, 1);
                Engine.log(`【隐藏不贞的头盔】从者真名已隐藏；战斗阶段可关闭此牌打出另一张牌并使用其行动阶段效果（近似：抽1张牌）！`, "var(--mana)");
            })
        },
        "隐藏王牌": {
            onCombatFinal: wrap((pt, all, gl) => {
                let p = pt.ply;
                if(p._used_隐藏王牌) return;
                let luckIdx = p.hand.findIndex(c => { let cd = DB.cards[c]; return cd && (cd.name === "幸运" || (cd.type||"").includes("幸运")); });
                if(luckIdx > -1){
                    p.hand.splice(luckIdx, 1); // 移除游戏
                    p._used_隐藏王牌 = true;
                    pt.isAvoidDefeat = true;
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${p.master.name} (隐藏王牌)</span> <span>移除一张【幸运】，无视【败北】，与当前战斗的其他胜者一同获胜且不均分战果！</span></div>`);
                }
            })
        },
        "隐秘的罪之游戏": {
            onAction: wrap((p) => {
                if((State.day || 1) % 2 === 1){
                    p.autoSkillBuff = (p.autoSkillBuff||0) + 4;
                    Engine.log(`【隐秘的罪之游戏】奇数回合：杰基尔变为海德，+4合计威力（禁止使用【气息遮断】）！`, "var(--red)");
                } else {
                    Engine.addMana(p, 1);
                    Engine.log(`【隐秘的罪之游戏】偶数回合：杰基尔形态，移动时每个地点少花费1点魔力（近似：获得1点魔力；禁止使用【狂战士】）！`, "var(--mana)");
                }
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--red);">[海德(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "隐身衣": {
            onAction: wrap((p) => {
                p._cloakCount = (p._cloakCount || 0) + 1;
                let x = p._cloakCount;
                p.vp = Math.max(0, p.vp - x);
                p.isRevealed = false;
                Engine.log(`【隐身衣】第${x}次打出，失去${x}点战果；齐格飞真名隐藏且不受同地点其他玩家能力影响！`, "var(--mana)");
            })
        },
        "鹦鹉螺号": {
            onAction: wrap((p) => {
                if(p.location === "魔术工房"){
                    addToken(p, "鹦鹉螺", 1);
                    Engine.log(`【鹦鹉螺号】部署于魔术工房，此牌+1威力（当前+${getToken(p,"鹦鹉螺")}）！`, "var(--mana)");
                }
                let b = 3 + getToken(p, "鹦鹉螺");
                p.autoDiliMult = 2;
                p.autoSkillBuff = (p.autoSkillBuff||0) + b;
                Engine.log(`【鹦鹉螺号】大冲角：获得等同此牌威力的地利（近似：地利2倍+${b}合计威力），战斗结束后关闭！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[大冲角(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "映像星辰之久远镜": {
            onAction: wrap((p) => {
                Engine.drawCards(p, 2);
                Engine.log(`【映像星辰之久远镜】下回合可额外使用两次【光之神谕】（近似：抽2张牌）！`, "var(--mana)");
            })
        },
        "永久少女·机关帝国": {
            onAction: wrap((p) => {
                Engine.addMana(p, 1);
                p.vp += 1;
                Engine.log(`【永久少女·机关帝国】永动炉心：获得1点魔力与1点战果！`, "var(--gold)");
            }),
            onCombatFinal: wrap((pt, all, gl) => {
                let p = pt.ply;
                if(p._used_机关帝国) return;
                if(all.filter(o => o.id !== pt.id).some(o => o.p > pt.p)){
                    p._used_机关帝国 = true;
                    pt.isAvoidDefeat = true;
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${p.master.name} (永久少女·机关帝国)</span> <span>即将战败——机关重置，无视【败北】！（每局游戏限一次）</span></div>`);
                }
            })
        },
        "永世隔绝的理想乡": {
            onAction: wrap((p) => {
                if(p.location === "侦察"){
                    p.vp += 1;
                    Engine.addMana(p, 2);
                    Engine.log(`【永世隔绝的理想乡】从侦察处额外获得1点战果和2点魔力！`, "var(--vp)");
                }
                if(p.location === "深山町" || p.location === "新都"){
                    p.autoSkillBuff = (p.autoSkillBuff||0) + 2;
                    Engine.log(`【永世隔绝的理想乡】将所在战场的所有事件牌移除游戏（近似：+2合计威力，事件战果不可被他人获取）！`, "var(--gold)");
                }
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[理想乡(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "勇者的不凋花": {
            onCombatCalc: wrap((pt, all, gl) => {
                let p = pt.ply;
                if(p.isRevealed) return;
                all.filter(o => o.id !== pt.id).forEach(o => {
                    if((o.ply.hand||[]).length === 0){
                        o.p = 0;
                        o.tags.push(`<span style="color:var(--red);">[疾风驰骋(→0)]</span>`);
                        gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${p.master.name} (勇者的不凋花)</span> <span>${o.ply.master.name} 未弃置牌，合计威力设为0</span></div>`);
                        return;
                    }
                    let ci = Math.floor(Math.random() * o.ply.hand.length);
                    let c = o.ply.hand.splice(ci, 1)[0];
                    o.ply.discard.push(c);
                    let cd = DB.cards[c] || {};
                    let safe = (cd.name === "幸运") || (cd.type||"").includes("幸运") || (cd.type||"").includes("迅捷");
                    if(!safe){
                        o.p = 0;
                        o.tags.push(`<span style="color:var(--red);">[疾风驰骋(→0)]</span>`);
                        gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${p.master.name} (勇者的不凋花)</span> <span>${o.ply.master.name} 弃置的牌非【幸运】/敏捷牌，合计威力设为0</span></div>`);
                    } else {
                        gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${p.master.name} (勇者的不凋花)</span> <span>${o.ply.master.name} 弃置了【幸运】/敏捷牌，免于威力归零</span></div>`);
                    }
                });
            }),
            onCombatLose: wrap((pt, winners, all, gl) => {
                pt.ply.isRevealed = true;
                gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (阿喀琉斯之踵)</span> <span>战败后【真名解放】</span></div>`);
            })
        },
        "于深渊化作光": {
            onAction: wrap((p) => {
                let opps = State.players.filter(op => op.isAlive && op.id !== p.id && op.location === p.location);
                opps.forEach(op => { Engine.drawCards(op, 1); });
                addToken(p, "深渊", opps.length);
                let x = getToken(p, "深渊");
                if(x >= 12){
                    p.vp += 20;
                    Engine.log(`【于深渊化作光】理智丧失已分发${x}张【领域外生命】——达成游戏胜利条件（近似：+20战果）！`, "var(--gold)");
                } else {
                    Engine.log(`【于深渊化作光】理智丧失：同地点对手各将一张【领域外生命】加入手牌（累计${x}/12）！`, "var(--mana)");
                }
            })
        },
        "与彼方同坠的梦之瞳眸": {
            onAction: wrap((p) => {
                p.isRevealed = true;
                p.autoSkillBuff = (p.autoSkillBuff||0) + 4;
                Engine.log(`【与彼方同坠的梦之瞳眸】真名解放：所有【裁决者令咒】第一项效果改为将【复仇者】加入攻击（近似：+4合计威力）！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[对人理(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "予故国以爱，以沉溺般的梦": {
            onAction: wrap((p) => {
                let specials = p.hand.filter(c => { let cd = DB.cards[c]; return cd && ((cd.type||"").includes("特殊") || (cd.type||"").includes("幸运")); });
                let n = Math.min(3, specials.length);
                for(let i=0;i<n;i++){
                    let idx = p.hand.indexOf(specials[i]);
                    p.hand.splice(idx, 1);
                    p.discard.push(specials[i]);
                }
                p.autoSkillBuff = (p.autoSkillBuff||0) + 2 * n;
                if(n >= 3){
                    p._zl3Magic = true;
                    Engine.log(`【予故国以爱，以沉溺般的梦】打出3张基础特殊攻击，战斗阶段将令一名【目标】【败北】！`, "var(--red)");
                } else {
                    Engine.log(`【予故国以爱，以沉溺般的梦】打出${n}张基础特殊攻击（+${2*n}合计威力）。`, "var(--mana)");
                }
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--red);">[沉溺之梦(+${pt.ply.autoSkillBuff})]</span>`); } }),
            onCombatFinal: wrap((pt, all, gl) => { defeatOpp(pt, all, gl, "予故国以爱，以沉溺般的梦", null, "one"); })
        },
        "原初之卢恩": {
            onAction: wrap((p) => {
                let opts = ["远行：移动至任意地点", "飓风：打出一张攻击", "冰冻：同地点其他玩家各失去2点魔力", "秘仪：地利变为3倍", "启明：获得4点战果"];
                let locations = ["深山町", "新都", "侦察", "魔术工房"];
                let resolve = c => {
                    if(c === opts[0]){
                        if(p.isPlayer && p.id===Network.myPlayerId){
                            Interaction.chooseLocation(
                                "【原初之卢恩·远行】选择移动地点",
                                locations,
                                i => moveTo(p, locations[i], "原初之卢恩·远行"),
                                () => {}
                            );
                            return;
                        }
                        moveTo(p, locations[Math.floor(Math.random() * locations.length)], "原初之卢恩·远行");
                    } else if(c === opts[1]){
                        Engine.drawCards(p, 1);
                        Engine.log(`【原初之卢恩·飓风】打出一张攻击（近似：抽1张牌）！`, "var(--mana)");
                    } else if(c === opts[2]){
                        State.players.filter(op => op.isAlive && op.id !== p.id && op.location === p.location).forEach(op => { op.mana = Math.max(0, op.mana - 2); });
                        Engine.log(`【原初之卢恩·冰冻】你所在地点的其他玩家各失去2点魔力！`, "var(--mana)");
                    } else if(c === opts[3]){
                        p.autoDiliMult = 3;
                        Engine.log(`【原初之卢恩·秘仪】你的地利变为3倍！`, "var(--gold)");
                    } else if(c === opts[4]){
                        p.vp += 4;
                        Engine.log(`【原初之卢恩·启明】获得4点战果！`, "var(--vp)");
                    }
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose("【原初之卢恩】选择卢恩效果", opts, i => resolve(opts[i]), () => {});
                    return;
                }
                resolve(opts[Math.floor(Math.random() * opts.length)]);
            }),
            onCombatFinal: wrap((pt, all, gl) => {
                if(all.filter(o => o.id !== pt.id).length === 1) defeatOpp(pt, all, gl, "原初之卢恩·死棘", null, "one");
            })
        },
        "月之癌": {
            onAction: wrap((p) => {
                p.vp += 2;
                Engine.log(`【月之癌】操控月之圣杯的事件牌（近似：+2点战果），战斗阶段结束后弃置月之圣杯事件牌！`, "var(--mana)");
            })
        },
        "炸脖龙": {
            onAction: wrap((p) => {
                let baseIdx = p.hand.findIndex(c => { let cd = DB.cards[c]; return cd && ["力量","迅捷","魔术","魔法"].includes(cd.type||""); });
                if(baseIdx > -1){
                    let c = p.hand.splice(baseIdx, 1)[0];
                    let opps = State.players.filter(op => op.isAlive && op.id !== p.id && op.location === p.location);
                    if(opps.length > 0){
                        let t = opps[Math.floor(Math.random()*opps.length)];
                        t.deck.push(c);
                        if(window.shuffleArray) t.deck = window.shuffleArray(t.deck);
                        Engine.log(`【炸脖龙】将一张基础攻击作为【殇】洗入 ${t.master.name} 的牌库！`, "var(--red)");
                    } else {
                        p.discard.push(c);
                        Engine.log(`【炸脖龙】同地点无对手，【殇】暂入弃牌堆。`, "#aaa");
                    }
                }
                p.autoSkillBuff = (p.autoSkillBuff||0) + 5;
                Engine.log(`【炸脖龙】+5合计威力！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--red);">[炸脖龙(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "展示王勇，遍历巡世的十二辉剑": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                Engine.drawCards(pt.ply, 1);
                gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (十二辉剑)</span> <span>抽取一张事件牌加入战场，所有攻击获得其属性（近似：抽1张牌+3威力）</span></div>`);
            }),
            onCombatCalc: wrap((pt) => { pt.p += 3; pt.tags.push(`<span style="color:var(--gold);">[十二辉剑(+3)]</span>`); }),
            onCombatWin: wrap((pt, winners, all, gl) => {
                pt.ply.vp += 1;
                gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (十二辉剑)</span> <span>获胜，将此战场的一张事件牌洗回事件牌库（近似：+1战果）</span></div>`);
            })
        },
        "战士的雄叫": {
            onCombatCalc: wrap((pt, all) => {
                let opps = all.filter(o => o.id !== pt.id);
                let maxP = 0;
                opps.forEach(o => (o.cards||[]).forEach(cid => { let cd = Engine.getCardData(cid); if(cd) maxP = Math.max(maxP, Number(cd.power)||0); }));
                let b = Math.max(3, Math.min(9, maxP));
                pt.p += b;
                pt.tags.push(`<span style="color:var(--gold);">[雄叫(+${b})]</span>`);
            })
        },
        "战士之司": {
            onCombatEnd: wrap((pt, winners, all, gl) => {
                let losers = all.filter(o => o.id !== pt.id && !(winners||[]).some(w => w.id === o.id));
                if(losers.length){
                    losers.forEach(o => { o.ply.vp = Math.max(0, o.ply.vp - 2); });
                    pt.ply.vp += 2;
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (战士之司)</span> <span>以此效果打出攻击的败者各失去2点战果，斗争的魅力+2战果</span></div>`);
                }
            })
        },
        "战术躯体": {
            onAction: wrap((p) => {
                addToken(p, "反应", 2);
                Engine.log(`【战术躯体】获得2枚【反应】（当前${getToken(p,"反应")}），战斗阶段可花费以使用【霸王之武】的效果！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => {
                let r = getToken(pt.ply, "反应");
                if(r > 0){
                    addToken(pt.ply, "反应", -r);
                    pt.p += 2 * r;
                    pt.tags.push(`<span style="color:var(--gold);">[霸王之武·反应${r}(+${2*r})]</span>`);
                }
            })
        },
        "磔刑之雷树": {
            onCombatFinal: wrap((pt, all, gl) => {
                if(all.filter(o => o.id !== pt.id).length > 0){
                    pt.isAvoidDefeat = true;
                    pt.ply.vp = Math.max(0, pt.ply.vp - 3);
                    gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (磔刑之雷树)</span> <span>死亡与新生：无视【败北】效果！（下回合开始时将败北，近似：失去3点战果）</span></div>`);
                }
            })
        },
        "这是常识，我亲爱的朋友啊": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                let opps = all.filter(o => o.id !== pt.id);
                if(!opps.length) return;
                let tgt = opps[Math.floor(Math.random() * opps.length)];
                let names = tgt.ply.hand.map(c => DB.cards[c] ? DB.cards[c].name : "？").join("、");
                gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (这是常识，我亲爱的朋友啊)</span> <span>揭露 ${tgt.ply.master.name} 的手牌与暗置牌：${names || "（无）"}</span></div>`);
                let attr = pt.ply._deduceAttr;
                if(attr){
                    let chk = (attr === "魔术") ? "魔" : attr;
                    let hit = tgt.ply.hand.some(c => DB.cards[c] && (DB.cards[c].type||"").includes(attr)) || oppHasAttr(tgt, chk);
                    if(hit){
                        pt._csDeduceHit = tgt.id;
                        gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (这是常识，我亲爱的朋友啊)</span> <span>展示的牌与【逆推法】记录的【${attr}】攻击吻合！触发【逆推法】！</span></div>`);
                    }
                }
            }),
            onCombatFinal: wrap((pt, all, gl) => {
                if(pt._csDeduceHit !== undefined){
                    let tid = pt._csDeduceHit;
                    pt._csDeduceHit = undefined;
                    defeatOpp(pt, all, gl, "这是常识，我亲爱的朋友啊", (o) => o.id === tid, "one");
                }
            })
        },
        "枕草子·春曙抄": {
            onCombatStart: wrap((pt, all, loc, gl) => {
                let opps = all.filter(o => o.id !== pt.id);
                let given = 0;
                opps.forEach(o => {
                    if(getToken(o.ply, "暮云春树") < 1){
                        addToken(o.ply, "暮云春树", 1);
                        o.p = Math.max(0, o.p - 2);
                        o.tags.push(`<span style="color:var(--red);">[暮云春树复制(-2)]</span>`);
                        given++;
                    }
                });
                if(given > 0) gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (枕草子·春曙抄)</span> <span>分予${given}名交战对手【暮云春树】复制<每局游戏限一次>（近似：威力-2）；你战斗中的【暮云春树】威力无法超过0</span></div>`);
            })
        },
        "知恋不为，无爱也": {
            onAction: wrap((p) => {
                let basics = p.hand.filter(c => { let t = DB.cards[c] ? (DB.cards[c].type||"") : ""; return t.includes("力量") || t.includes("迅捷") || t.includes("魔术"); });
                basics.sort((a, b) => {
                    let ma = (DB.cards[a] && (DB.cards[a].type||"").includes("魔术")) ? 0 : 1;
                    let mb = (DB.cards[b] && (DB.cards[b].type||"").includes("魔术")) ? 0 : 1;
                    return ma - mb;
                });
                let maxN = Math.min(3, basics.length);
                let resolve = n => {
                    n = Math.max(0, Math.min(maxN, Number(n) || 0));
                    if(n === 0){ Engine.log(`【知恋不为，无爱也】未打出基础攻击。`, "#aaa"); return; }
                    let total = 0, mag = 0, names = [];
                    for(let i = 0; i < n; i++){
                        let cid = p.hand.splice(p.hand.indexOf(basics[i]), 1)[0];
                        p.discard.push(cid);
                        let cd = Engine.getCardData(cid) || {};
                        total += (cd.power || 0);
                        names.push(cd.name || "？");
                        if((cd.type||"").includes("魔术")) mag++;
                    }
                    p.legionBuff = (p.legionBuff||0) + total;
                    if(mag === 3){
                        p._zhilianDefeat = true;
                        Engine.log(`【知恋不为，无爱也】打出【${names.join("、")}】（+${total}威力），其中3张为魔术攻击：战斗阶段将令一名交战对手【败北】！`, "var(--red)");
                    } else {
                        Engine.log(`【知恋不为，无爱也】打出【${names.join("、")}】（+${total}威力）。`, "var(--mana)");
                    }
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose(
                        `【知恋不为，无爱也】选择打出的基础攻击数量（至多${maxN}张）`,
                        Array.from({length: maxN + 1}, (_, i) => `${i}张`),
                        i => resolve(i),
                        () => {}
                    );
                    return;
                }
                resolve(maxN);
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.legionBuff){ pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--mana);">[知恋不为(+${pt.ply.legionBuff})]</span>`); } }),
            onCombatFinal: wrap((pt, all, gl) => {
                if(pt.ply._zhilianDefeat){
                    pt.ply._zhilianDefeat = false;
                    defeatOpp(pt, all, gl, "知恋不为，无爱也", (o) => o.id !== pt.id, "one");
                }
            })
        },
        "直至死亡拆散两人": {
            onCombatCalc: wrap((pt, all) => {
                if(all.filter(o => o.id !== pt.id).length > 0){
                    pt.p += 4;
                    pt.tags.push(`<span style="color:var(--red);">[与爱人同战场·威力翻倍(+4)]</span>`);
                }
            })
        },
        "指挥官 奥特琳德": {
            onAction: wrap((p) => {
                p.autoSkillBuff = (p.autoSkillBuff||0) + 2;
                Engine.log(`【指挥官 奥特琳德】此攻击+2威力直至回合结束，本回合获得“残留”；瓦尔基里技能牌与【指挥官】魔力消耗-2且无视8点魔力门槛。`, "var(--mana)");
            }),
            onCombatLose: wrap((pt, winners, all, gl, cid) => {
                Engine.removeCommanderFromGame(pt.ply, cid||"x_CommanderOrtlinde");
                gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (指挥官 奥特琳德)</span> <span>战败：【奥特琳德】移除游戏</span></div>`);
            })
        },
        "指挥官 斯露德": {
            onAction: wrap((p) => {
                p.autoSkillBuff = (p.autoSkillBuff||0) + 6;
                Engine.log(`【指挥官 斯露德】此攻击+6威力直至回合结束，本回合获得“残留”！`, "var(--mana)");
            }),
            onCombatEnd: wrap((pt, winners, all, gl) => {
                let others=Engine.getActiveCommanderCards(pt.ply).filter(cid=>cid!=="x_CommanderThrud");
                if(others.length){pt.ply.commandersToClose=[...new Set([...(pt.ply.commandersToClose||[]),...others])];gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (指挥官 斯露德)</span> <span>战斗阶段结束：关闭其他所有【指挥官】</span></div>`);}
            }),
            onCombatLose: wrap((pt, winners, all, gl, cid) => {
                Engine.removeCommanderFromGame(pt.ply, cid||"x_CommanderThrud");
                gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (指挥官 斯露德)</span> <span>战败：【斯露德】移除游戏</span></div>`);
            })
        },
        "指挥官 希露德": {
            onAction: wrap((p) => {
                p.autoSkillBuff = (p.autoSkillBuff||0) + 3;
                let commit = recovered => {
                    Engine.closeCommander(p,"x_CommanderHildr");
                    Engine.log(recovered?`【指挥官 希露德】此攻击+3威力直至回合结束，关闭自身并将【${DB.cards[recovered].name}】加入手牌！`:`【指挥官 希露德】此攻击+3威力直至回合结束并关闭自身，没有可加入手牌的其他指挥官。`, "var(--mana)");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.confirm("【指挥官 希露德】是否关闭此牌并回收一张其他【指挥官】？", false, yes => {
                        if(yes) Engine.recoverCommander(p,"x_CommanderHildr",commit,()=>{});
                        else Engine.log(`【指挥官 希露德】此攻击+3威力直至回合结束，选择不关闭和回收。`, "var(--mana)");
                    }, ()=>{});
                    return;
                }
                commit(Engine.recoverCommander(p,"x_CommanderHildr"));
            }),
            onCombatLose: wrap((pt, winners, all, gl, cid) => {
                Engine.removeCommanderFromGame(pt.ply, cid||"x_CommanderHildr");
                gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (指挥官 希露德)</span> <span>战败：【希露德】移除游戏</span></div>`);
            })
        },
        "指令：集中": {
            onAction: wrap((p) => {
                if(p._used_指令集中){ Engine.log(`【指令：集中】此牌已使用并移除。`, "#aaa"); return; }
                p._used_指令集中 = true;
                let x = Math.max(1, State.day || 1);
                p.autoSkillBuff = (p.autoSkillBuff||0) + x;
                Engine.log(`【指令：集中】每回合结束+1计数（近似：以游戏天数计，X=${x}），获得+${x}威力！使用后移除此牌。`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[集中(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "指令：应急处置": {
            onAction: wrap((p) => {
                if(p._used_指令应急处置){ Engine.log(`【指令：应急处置】此牌已使用并移除。`, "#aaa"); return; }
                p._used_指令应急处置 = true;
                Engine.drawCards(p, 6);
                let resolve = d => {
                    d = Math.max(0, Math.min(p.hand.length, Number(d) || 0));
                    for(let i = 0; i < d; i++){ p.discard.push(p.hand.pop()); }
                    Engine.log(`【指令：应急处置】抽6张牌，弃置${d}张手牌！使用后移除此牌。`, "var(--mana)");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose(
                        "【指令：应急处置】选择弃置的手牌数量",
                        Array.from({length: p.hand.length + 1}, (_, i) => `${i}张`),
                        i => resolve(i),
                        () => resolve(0)
                    );
                    return;
                }
                resolve(0);
            })
        },
        "至高神": {
            onCombatCalc: wrap((pt, all) => {
                if(pt.ply._zhigaoshenRemoved) return;
                pt.p += 5;
                pt.tags.push(`<span style="color:var(--gold);">[至高神(+5)]</span>`);
                all.filter(o => o.id !== pt.id && getToken(o.ply, "有瑕") > 0).forEach(o => {
                    o.p = Math.max(0, o.p - 2);
                    o.tags.push(`<span style="color:var(--red);">[有瑕(-2)]</span>`);
                });
            }),
            onCombatWin: wrap((pt, winners, all, gl) => {
                if(pt.ply._zhigaoshenRemoved) return;
                if(winners.includes(pt)){
                    let losers = all.filter(o => o.id !== pt.id);
                    losers.forEach(o => addToken(o.ply, "有瑕", 1));
                    if(losers.length) gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (至高神)</span> <span>输给你的玩家陷入【有瑕】状态（下次交战威力-2，近似）</span></div>`);
                }
            }),
            onCombatLose: wrap((pt, winners, all, gl) => {
                if(!pt.ply._zhigaoshenRemoved){
                    pt.ply._zhigaoshenRemoved = true;
                    gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (至高神)</span> <span>输掉一场战斗：【至高神】移除游戏，不再提供+5威力与【有瑕】状态</span></div>`);
                }
            })
        },
        "终极犯罪": {
            onAction: wrap((p) => {
                p.autoSkillBuff = (p.autoSkillBuff||0) + 6;
                Engine.log(`【终极犯罪】邪来之一笔：此牌变成一张未激活的增幅技能复制（近似：+6威力），本回合原增幅技能不可使用，回合结束时弃置其增幅牌！`, "var(--gold)");
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[终极犯罪(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "终末幻想·少女降临": {
            onAction: wrap((p) => {
                if(p._used_终末幻想少女降临){ Engine.log(`【终末幻想·少女降临】每局游戏限一次，已使用过。`, "#aaa"); return; }
                p._used_终末幻想少女降临 = true;
                Engine.drawCards(p, 3);
                Engine.log(`【终末幻想·少女降临】从任意处将3张【指挥官】加入手牌或攻击（近似：抽3张牌，不触发"打出时"效果）！`, "var(--gold)");
            })
        },
        "终焉，然意志仍在延续": {
            onCombatWin: wrap((pt, winners, all, gl) => {
                if(winners.includes(pt)){
                    let higher = all.filter(o => o.id !== pt.id && o.ply.vp > pt.ply.vp);
                    if(higher.length){
                        pt.ply._willEndure = true;
                        gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (终焉，然意志仍在延续)</span> <span>击败了战果高于你的对手：本回合结束时你不会被淘汰；若于最后一回合获胜且战果不为第一，以【天之杯】再进行一回合（近似：仅标记）</span></div>`);
                    }
                }
            })
        },
        "诸行无常·盛者必衰": {
            // X=你控制的攻击数量的两倍（包括暗置攻击与景清不灭残留暗影）
            // 万物必逝：花费魔力消耗激活你的所有暗置攻击（打出暗置计入威力；暗影攻击印刷威力视为0仅计入X）
            onCombatCalc: wrap((pt, all, gl) => {
                let c = (State.actionChoices[pt.id] || {cards:[], facedown:[]});
                let shadow = pt.ply.kagekiyoShadow || [];
                let n = (pt.cards || []).length + shadow.length;
                if(n <= 0) return;
                let b = n * 2;
                pt.p += b;
                pt.tags.push(`<span style="color:var(--gold);">[万物必逝·X=${n}×2(+${b})]</span>`);
                let fdPlayed = (c.facedown||[]);
                if(fdPlayed.length + shadow.length > 0){
                    let cost = [...fdPlayed, ...shadow].reduce((s,cid) => s + (Number((Engine.getCardData(cid)||{}).cost)||0), 0);
                    if(cost <= 0 || payCost(pt.ply, cost, "诸行无常·激活暗置攻击")){
                        let pw = fdPlayed.reduce((s,cid) => s + (Number((Engine.getCardData(cid)||{}).power)||0), 0);
                        if(pw > 0){ pt.p += pw; pt.tags.push(`<span style="color:var(--gold);">[激活暗置x${fdPlayed.length}(+${pw})]</span>`); }
                        gl.push(`<div class="report-line" style="color:var(--gold);"><span>✨ ${pt.ply.master.name} (诸行无常)</span> <span>花费${cost}点魔力激活所有暗置攻击${pw>0?`（+${pw}威力）`:""}，可使用其行动阶段能力</span></div>`);
                    } else gl.push(`<div class="report-line" style="color:#aaa;"><span>✨ 诸行无常</span> <span>魔力不足，暗置攻击未激活（仅计X）</span></div>`);
                }
            })
        },
        "转轮啊，卷起愤怒之炎吧": {
            onAction: wrap((p) => {
                let resolve = n => {
                    n = Math.max(0, Math.min(3, Number(n) || 0));
                    p.autoSkillBuff = (p.autoSkillBuff||0) + 2 * n;
                    let refund = 0;
                    if(p.autoDiliMult && p.autoDiliMult > 1){ refund = 1; Engine.addMana(p, refund); }
                    Engine.log(`【转轮啊，卷起愤怒之炎吧】尘归尘：移除${n}张局势牌，此牌+${2*n}威力${refund ? `；魔力消耗-X（近似：返还${refund}点魔力，X=地利数）` : ""}！`, "var(--gold)");
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choose("【转轮啊，卷起愤怒之炎吧】选择移除的局势牌数量", ["0张", "1张", "2张", "3张"], i => resolve(i), () => {});
                    return;
                }
                resolve(2);
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--gold);">[愤怒之炎(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "转身火生三昧": {
            onAction: wrap((p) => {
                let resolve = () => {
                    if(payCost(p, 3, "转身火生三昧")){
                        p._fireSamadhi = true;
                        p.autoSkillBuff = (p.autoSkillBuff||0) + 4;
                        Engine.log(`【转身火生三昧】双生烈焰：花费3点魔力，本回合魔术攻击威力不会被减少（近似：+4威力），此牌持续激活至下回合结束！`, "var(--red)");
                    } else {
                        Engine.log(`【转身火生三昧】魔力不足，双生烈焰未发动。`, "#aaa");
                    }
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    if(p.mana < 3){ Engine.log(`【转身火生三昧】魔力不足，双生烈焰未发动。`, "#aaa"); return; }
                    Interaction.confirm("【转身火生三昧】花费3点魔力发动双生烈焰", true, ok => { if(ok) resolve(); }, () => {});
                    return;
                }
                if(p.mana >= 5) resolve();
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--red);">[双生烈焰(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "自我暗示": {
            onAction: wrap((p) => {
                let cands = State.players.filter(op => op.isAlive && op.id !== p.id && op.location === p.location);
                if(!cands.length){ Engine.log(`【自我暗示】你所在地点没有其他玩家。`, "#aaa"); return; }
                let chooseCard = tgt => {
                    if(!tgt || !tgt.hand.length){ Engine.log(`【自我暗示】${tgt ? tgt.master.name : "目标"} 没有手牌。`, "#aaa"); return; }
                    let discard = ci => {
                        if(ci < 0 || ci >= tgt.hand.length) return;
                        let cid = tgt.hand.splice(ci, 1)[0];
                        tgt.discard.push(cid);
                        let pw = Engine.getCardData(cid) ? (Engine.getCardData(cid).power || 0) : 0;
                        p.autoSkillBuff = (p.autoSkillBuff||0) + pw;
                        Engine.log(`【自我暗示】查看了 ${tgt.master.name} 的手牌并弃置【${Engine.getCardData(cid) ? Engine.getCardData(cid).name : "？"}】，获得${pw}点合计威力！`, "var(--mana)");
                    };
                    if(p.isPlayer && p.id===Network.myPlayerId){
                        let cards = tgt.hand.map(cid => ({ label: Engine.getCardData(cid) ? Engine.getCardData(cid).name : "未知卡牌", desc: Engine.getCardData(cid) ? `威力 ${Engine.getCardData(cid).power || 0}` : "" }));
                        Interaction.choose(`【自我暗示】选择弃置 ${tgt.master.name} 的一张手牌`, cards, i => discard(i), () => {});
                        return;
                    }
                    discard(0);
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.choosePlayer("【自我暗示】选择查看手牌的同地点玩家", cands, i => chooseCard(cands[i]), () => {});
                    return;
                }
                chooseCard(cands[0]);
            }),
            onCombatCalc: wrap((pt) => { if(pt.ply.autoSkillBuff){ pt.p += pt.ply.autoSkillBuff; pt.tags.push(`<span style="color:var(--mana);">[自我暗示(+${pt.ply.autoSkillBuff})]</span>`); } })
        },
        "阿契美尼德的荣耀": {
            onAction: wrap((p) => {
                p._dariusGloryActive = true;
            }),
            onCombatLose: wrap((pt) => {
                pt.ply._dariusGloryDefeatedThisTurn = true;
            }),
            onCombatEnd: wrap((pt, winners, all, gl) => {
                let p = pt && pt.ply;
                if(!p || !p.servant || p.servant.trueName !== "大流士三世") return;
                let defeated = !!pt.autoDefeated || !!p._dariusGloryDefeatedThisTurn;
                if(!defeated && Array.isArray(p.servant.skillCards)){
                    let before = p.servant.skillCards.length;
                    p.servant.skillCards = p.servant.skillCards.filter(sk => !sk || sk.id !== "sc_darius_1");
                    if(p.servant.skillCards.length < before && gl){
                        gl.push(`<div class="report-line" style="color:#aaa;"><span>✨ 阿契美尼德的荣耀</span><span>战斗阶段结束后关闭此牌</span></div>`);
                    }
                }
                delete p._dariusGloryActive;
                delete p._dariusGloryDefeatedThisTurn;
            })
        },
        "战斗续行": {
            onAction: wrap((p) => {
                let dests = ["深山町", "新都", "侦察"];
                if(!State.deployments) { Engine.log(`【战斗续行】移动系统未就绪。`, "#aaa"); return; }
                let resolve = dest => {
                    if(!dests.includes(dest)) return;
                    moveTo(p, dest, "战斗续行");
                    p.battleContinueActive = true;
                };
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.chooseLocation("【战斗续行】选择移动地点", dests, i => resolve(dests[i]), () => {});
                    return;
                }
                resolve(dests[Math.floor(Math.random()*dests.length)]);
            })
        },
        "二之太刀": {
            onAction: wrap((p) => {
                // 与你位于同一战场的对手无法使用【行动阶段】和【战斗阶段】能力（令咒为行动阶段能力）
                let opps = State.players.filter(op => op.isAlive && op.id !== p.id && op.location === p.location && (op.location === "深山町" || op.location === "新都"));
                if(!opps.length){ Engine.log(`【二之太刀】同战场没有对手，仅压制效果落空（斩击威力仍生效）。`, "#aaa"); return; }
                opps.forEach(op => { op.sasakiSeal = true; });
                Engine.log(`【二之太刀】${opps.map(o=>o.master.name).join("、")} 本回合无法使用行动阶段与战斗阶段能力（含令咒）！`, "var(--red)");
            })
        },
        "13号星期五": {
            onAction: wrap((p) => {
                // 被动残留：雅克成为女性降临者且她的攻击+3魔力消耗；准备阶段为回合顺位前两位玩家创造临时【领域外生命】
                p.jacquesForeignGod = (p.jacquesForeignGod || 0) + 1;
                let order = (State.players || []).filter(op => op.isAlive);
                let front = order.slice(0, 2);
                front.forEach(op => {
                    if(op.id === p.id) return;
                    op.tempForeignGod = (op.tempForeignGod || 0) + 1;
                    op.autoSkillBuff = Math.max(op.autoSkillBuff || 0, 0);
                });
                Engine.log(`【13号星期五】雅克成为女性降临者，她的攻击+3魔力消耗；为 ${front.filter(o=>o.id!==p.id).map(o=>o.master.name).join("、")} 各创造一张临时【领域外生命】！`, "var(--red)");
            }),
            onCombatCalc: wrap((pt) => {
                if(pt.ply.jacquesForeignGod){ pt.p += 2; pt.tags.push(`<span style="color:var(--red);">[13号星期五(+2)]</span>`); }
            })
        },
        "堕落的授职": {
            onAction: wrap((p, sc) => {
                // 若你是降临者，你【败北】；【劝诱】你所在地点的所有玩家，下回合他们创造临时【领域外生命】且雅克在该回合是降临者
                if(p.jacquesForeignGod || p.tempForeignGod){
                    p.autoDefeatedMark = true;
                    Engine.log(`【堕落的授职】${p.master.name} 是降临者，立即【败北】！`, "var(--red)");
                }
                let targets = State.players.filter(op => op.isAlive && op.id !== p.id && op.location === p.location);
                targets.forEach(op => { op.persuadedByJacques = true; });
                p.jacquesMissionary = true;
                Engine.log(`【堕落的授职】【劝诱】了 ${targets.map(o=>o.master.name).join("、") || "无人"}，他们下回合将获得临时【领域外生命】且雅克成为降临者！`, "var(--gold)");
            }),
            onCombatFinal: wrap((pt, all, gl) => {
                if(pt.ply.autoDefeatedMark){ pt.autoDefeated = true; gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ 堕落的授职</span> <span>${pt.ply.master.name} 因降临者身份【败北】</span></div>`); }
            })
        },
    };

    // ---------- 2. 模板解析 ----------
    function parseTemplate(name, desc){
        if(!desc) return null;
        const hooks = {};
        let m;

        // 行动阶段：抽N张牌
        if ((m = desc.match(/行动阶段[^。\\n]*?抽\s*([一二三四五六七八九十\d]+)\s*张/))) {
            const n = cnNum(m[1]);
            hooks.onAction = hooks.onAction || [];
            hooks.onAction.push((p) => { Engine.drawCards(p, n); Engine.log(`【${name}】抽 ${n} 张牌。`, "var(--vp)"); });
        }
        // 行动阶段：获得N点魔力
        if ((m = desc.match(/行动阶段[^。\\n]*?获得\s*([一二三四五六七八九十\d]+)\s*点?\s*魔/))) {
            const n = cnNum(m[1]);
            hooks.onAction = hooks.onAction || [];
            hooks.onAction.push((p) => { Engine.addMana(p, n); Engine.log(`【${name}】获得 ${n} 点魔力。`, "var(--mana)"); });
        }
        // 行动阶段：获得N(点)战果
        if ((m = desc.match(/行动阶段[^。\\n]*?获得\s*([一二三四五六七八九十\d]+)\s*点?\s*战果/))) {
            const n = cnNum(m[1]);
            hooks.onAction = hooks.onAction || [];
            hooks.onAction.push((p) => { p.vp += n; Engine.log(`【${name}】获得 ${n} 点战果。`, "var(--vp)"); });
        }
        // 行动阶段：移动（沿箭头一步/移动至任意地点）
        if ((m = desc.match(/行动阶段[^。\\n]*?(沿(?:着)?箭头移动[一1两2]步|移动至[^。\\n]{0,8}地点)/))) {
            hooks.onAction = hooks.onAction || [];
            hooks.onAction.push((p) => {
                let locs = ['深山町', '新都', '侦察'];
                let resolve = dest => moveTo(p, locs.includes(dest) ? dest : "深山町", name);
                if(p.isPlayer && p.id===Network.myPlayerId){
                    Interaction.chooseLocation(`【${name}】选择移动地点`, locs, i => resolve(locs[i]), () => {});
                    return;
                }
                resolve(locs[Math.floor(Math.random() * locs.length)]);
            });
        }
        // 地利翻倍
        if (/地利[^。\\n]*?(翻倍|变为2倍|2倍)|(?:翻倍|双倍)[^。\\n]*?地利/.test(desc)) {
            hooks.onAction = hooks.onAction || [];
            hooks.onAction.push((p) => { p.autoDiliMult = 2; Engine.log(`【${name}】地利翻倍！`, "var(--gold)"); });
        }
        // 获胜获得N战果（含中文数字）
        if ((m = desc.match(/(?:若你获得胜利|若你获胜|获胜|赢得)[^。\\n]*?获得\s*([一二三四五六七八九十\d]+)\s*点?\s*战果/))) {
            const n = cnNum(m[1]);
            hooks.onCombatWin = hooks.onCombatWin || [];
            hooks.onCombatWin.push((pt, winners, all, gl) => { pt.ply.vp += n; gl.push(`<div class="report-line" style="color:var(--vp);"><span>✨ ${pt.ply.master.name} (${name})</span> <span>获胜，+${n} 战果</span></div>`); });
        }
        // 战败时获得战果/增益
        if ((m = desc.match(/战败[^。\\n]*?获得\s*([一二三四五六七八九十\d]+)\s*点?\s*战果/))) {
            const n = cnNum(m[1]);
            hooks.onCombatLose = hooks.onCombatLose || [];
            hooks.onCombatLose.push((pt, winners, all, gl) => { pt.ply.vp += n; gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (${name})</span> <span>战败，仍+${n} 战果</span></div>`); });
        }
        // 自身合计威力+N
        if ((m = desc.match(/(?:[+＋]\s*([一二三四五六七八九十\d]+)\s*合计威力)|(?:合计威力\s*[+＋]\s*([一二三四五六七八九十\d]+))/))) {
            const n = cnNum(m[1] || m[2]);
            hooks.onCombatCalc = hooks.onCombatCalc || [];
            hooks.onCombatCalc.push((pt) => { pt.p += n; pt.tags.push(`<span style="color:var(--vp);">[${name}(+${n})]</span>`); });
        }
        // 对手合计威力-N（含"令对手-3合计威力"等）
        else if ((m = desc.match(/(?:[-−–]\s*([一二三四五六七八九十\d]+)\s*合计威力)|(?:合计威力\s*[-−–]\s*([一二三四五六七八九十\d]+))/))) {
            const n = cnNum(m[1] || m[2]);
            hooks.onCombatCalc = hooks.onCombatCalc || [];
            hooks.onCombatCalc.push((pt, all, gl) => { all.filter(o => o.id !== pt.id).forEach(o => { o.p = Math.max(0, o.p - n); o.tags.push(`<span style="color:var(--red);">[${name}(-${n})]</span>`); }); });
        }
        // 此牌/本牌威力+N（避免与合计威力重复）
        if (!hooks.onCombatCalc && (m = desc.match(/(?:此牌|本牌|攻击)[^。\\n]*?威力\s*[+＋]\s*([一二三四五六七八九十\d]+)|(?:威力\s*[+＋]\s*([一二三四五六七八九十\d]+))/))) {
            const n = cnNum(m[1] || m[2]);
            hooks.onCombatCalc = hooks.onCombatCalc || [];
            hooks.onCombatCalc.push((pt) => { pt.p += n; pt.tags.push(`<span style="color:var(--vp);">[${name}(+${n})]</span>`); });
        }
        // 对手属性攻击威力变0/设置0 → 压制近似
        if ((m = desc.match(/(力量|迅捷|敏捷|魔术|魔法)(?:属性)?[^。\\n]{0,10}(?:威力)?(?:设置|变)为(?:0|零)/))) {
            const attr = (m[1] === "敏捷") ? "迅捷" : ((m[1] === "魔法") ? "魔术" : m[1]);
            hooks.onCombatStart = hooks.onCombatStart || [];
            hooks.onCombatStart.push((pt, all, loc, gl) => suppressAttr(pt, all, gl, attr, name));
        }
        // 对手威力-N（普通减益，无"合计"）
        if (!hooks.onCombatCalc && (m = desc.match(/(?:威力)?\s*[-−–]\s*([一二三四五六七八九十\d]+)\s*威力/)) && /(对手|交战|其他玩家)/.test(desc)) {
            const n = cnNum(m[1]);
            hooks.onCombatCalc = hooks.onCombatCalc || [];
            hooks.onCombatCalc.push((pt, all) => { all.filter(o => o.id !== pt.id).forEach(o => { o.p = Math.max(0, o.p - n); o.tags.push(`<span style="color:var(--red);">[${name}(-${n})]</span>`); }); });
        }
        // 创造并激活N张临时攻击（王之军势式）
        if ((m = desc.match(/创造并激活\s*([一二三四五六七八九十\d]+)\s*张临时[^。\\n]*?威力[为是]?\s*([一二三四五六七八九十\d]+)/))) {
            const cnt = cnNum(m[1]), pw = cnNum(m[2]);
            const total = cnt * pw;
            hooks.onAction = hooks.onAction || [];
            hooks.onAction.push((p) => { p.legionBuff = (p.legionBuff||0) + total; Engine.log(`【${name}】创造 ${cnt} 张临时威力${pw}攻击（合计+${total}）！`, "var(--gold)"); });
            hooks.onCombatCalc = hooks.onCombatCalc || [];
            hooks.onCombatCalc.push((pt) => { if(pt.ply.legionBuff){ pt.p += pt.ply.legionBuff; pt.tags.push(`<span style="color:var(--gold);">[${name}(+${pt.ply.legionBuff})]</span>`); } });
        }
        // 偷取N点战果（战斗/获胜上下文）
        if ((m = desc.match(/偷取[^。\\n]*?([一二三四五六七八九十\d]+)\s*点?\s*战果/))) {
            const n = cnNum(m[1]);
            hooks.onCombatWin = hooks.onCombatWin || [];
            hooks.onCombatWin.push((pt, winners, all, gl) => { let opps = all.filter(o => o.id !== pt.id); if(opps.length){ let t = opps[Math.floor(Math.random()*opps.length)]; let steal = Math.min(n, t.ply.vp); t.ply.vp -= steal; pt.ply.vp += steal; gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (${name})</span> <span>偷取 ${t.ply.master.name} ${steal} 战果</span></div>`); } });
        }
        // 偷取N点魔力
        if ((m = desc.match(/偷取[^。\\n]*?([一二三四五六七八九十\d]+)\s*点?\s*魔/))) {
            const n = cnNum(m[1]);
            hooks.onCombatWin = hooks.onCombatWin || [];
            hooks.onCombatWin.push((pt, winners, all, gl) => { let opps = all.filter(o => o.id !== pt.id); if(opps.length){ let t = opps[Math.floor(Math.random()*opps.length)]; let steal = Math.min(n, t.ply.mana); t.ply.mana -= steal; Engine.addMana(pt.ply, steal); gl.push(`<div class="report-line" style="color:var(--red);"><span>✨ ${pt.ply.master.name} (${name})</span> <span>偷取 ${t.ply.master.name} ${steal} 魔力</span></div>`); } });
        }
        // 战斗阶段：获得N点魔力
        if (!hooks.onCombatWin && (m = desc.match(/战斗阶段[^。\\n]*?获得\s*([一二三四五六七八九十\d]+)\s*点?\s*魔/))) {
            const n = cnNum(m[1]);
            hooks.onCombatEnd = hooks.onCombatEnd || [];
            hooks.onCombatEnd.push((pt, winners, all, gl) => { Engine.addMana(pt.ply, n); gl.push(`<div class="report-line" style="color:var(--mana);"><span>✨ ${pt.ply.master.name} (${name})</span> <span>获得 ${n} 魔力</span></div>`); });
        }
        // 自身属性攻击/基础攻击+N威力
        if (!hooks.onCombatCalc && (m = desc.match(/(?:你的)?(?:基础)?(?:力量|迅捷|敏捷|魔术|魔法|特殊)?(?:属性)?攻击(?:获得|便)?\s*[+＋]\s*([一二三四五六七八九十\d]+)\s*(?:点)?(?:威力)/))) {
            const n = cnNum(m[1]);
            hooks.onCombatCalc = hooks.onCombatCalc || [];
            hooks.onCombatCalc.push((pt) => { pt.p += n; pt.tags.push(`<span style="color:var(--vp);">[${name}(+${n})]</span>`); });
        }
        // 攻击威力翻倍（此牌）
        if (!hooks.onCombatCalc && /威力翻倍/.test(desc)) {
            hooks.onCombatCalc = hooks.onCombatCalc || [];
            hooks.onCombatCalc.push((pt) => { let base = Math.max(3, Math.floor(pt.p / 3)); pt.p += base; pt.tags.push(`<span style="color:var(--gold);">[${name}·翻倍(+${base})]</span>`); });
        }
        // 对手每有一名/多一名对手+N（人海类）
        if (!hooks.onCombatCalc && (m = desc.match(/每有[一1]名?对手[^\n]*?[+＋]\s*([一二三四五六七八九十\d]+)/))) {
            const n = cnNum(m[1]);
            hooks.onCombatCalc = hooks.onCombatCalc || [];
            hooks.onCombatCalc.push((pt, all) => { let cnt = all.filter(o => o.id !== pt.id).length; if(cnt > 0){ pt.p += n * cnt; pt.tags.push(`<span style="color:var(--red);">[${name}(+${n * cnt})]</span>`); } });
        }

        if (!Object.keys(hooks).length) return null;
        const out = {};
        for (const k in hooks) out[k] = wrap(function(...args){ hooks[k].forEach(f => { try { f.apply(this, args); } catch(e) { console.warn("[AutoSkillEngine]", name, e); } }); });
        return out;
    }

    // ---------- 3. fallback：提示型钩子 ----------
    function makeFallback(name){
        return { __fallback: true, onAction: wrap((p, sc) => {
            const d = ((sc && sc.desc) || "").replace(/\\n/g, " ").replace(/\n/g, " ");
            Engine.log(`【${name}】已打出——效果（请按卡牌文本结算）：${d.slice(0, 80)}${d.length > 80 ? "…" : ""}`, "var(--gold)");
        }) };
    }

    // ---------- 4. 注册 ----------
    const stats = { manual: 0, template: 0, fallback: 0 };
    const seen = new Set();
    DB.servants.forEach(s => {
        (s.skillCards || []).forEach(sc => {
            if (!sc || !sc.name || seen.has(sc.name)) return;
            seen.add(sc.name);
            if (SkillLib[sc.name]) return; // 已有手工钩子（含原版/职阶通用）
            if (Manual[sc.name]) { SkillLib[sc.name] = Manual[sc.name]; stats.manual++; return; }
            const tpl = parseTemplate(sc.name, sc.desc || "");
            if (tpl) { SkillLib[sc.name] = tpl; stats.template++; return; }
            SkillLib[sc.name] = makeFallback(sc.name);
            stats.fallback++;
        });
    });
    SkillLib["阿契美尼德的荣耀"] = Manual["阿契美尼德的荣耀"];
    console.log("[AutoSkillEngine] 手工:" + stats.manual + " 模板:" + stats.template + " 提示:" + stats.fallback + " 合计:" + (stats.manual + stats.template + stats.fallback));

    // ---------- 5. 牌库替换牌卡牌名钩子（非从者技能，需手动注册；战斗结算遍历明置卡时按卡牌名调用） ----------
    ["闪鞘", "闪走", "魔力猛攻", "戈夫铁拳"].forEach(n => { if (Manual[n] && !SkillLib[n]) SkillLib[n] = Manual[n]; });

    // ---------- 6. 升华技·技能区牌钩子（checkAscensionUnlock 动态加入技能区，不在 DB.servants 中，需手动注册） ----------
    ["誓约胜利之木剑", "饿死鬼投胎", "机械翡翠", "璀璨空想", "不休梦魇", "Queenside Castle", "老相识", "宵泣之铁桩", "快速扩张", "千年城", "瓦伦丁的圣骸布", "冬木之虎", "最终审判", "诸神黄昏", "特里姆玛乌·沸腾", "主的恩宠", "冠位时间神殿", "月之王权", "渎神者", "宝石剑泽尔里奇", "生命赋予"].forEach(n => { if (Manual[n] && !SkillLib[n]) SkillLib[n] = Manual[n]; });
})();
