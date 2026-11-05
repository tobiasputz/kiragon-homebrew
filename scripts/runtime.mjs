import { MODULE_ID, ABILITIES, validatePack, clone, int, clamp, newActorPack, newClock, secondsRemaining, countedBells, elapsedClockSeconds, remaining, tierData, effectiveLoss, adjustResource, applyRupture, effectValue, outcomeLoss, degreeName } from './engine.mjs';

export class KiragonRuntime {
  constructor(){this.processing=false;this.onChange=()=>{};this.lastDraw=0;}
  get gm(){return !!game.user?.isGM;}
  get primaryGM(){const users=game.users.filter(u=>u.active&&u.isGM).sort((a,b)=>a.id.localeCompare(b.id));return users[0]?.id===game.user?.id;}
  requireGM(){if(!this.gm)throw Error('Only the GM may modify Kiragon rules and world resources.');}
  packs(){return game.settings.get(MODULE_ID,'packs')??[];}
  pack(id){return this.packs().find(p=>p.id===id)??null;}
  enabled(){return game.settings.get(MODULE_ID,'enabled')??[];}
  isEnabled(id){return this.enabled().includes(id);}
  clockStates(){return game.settings.get(MODULE_ID,'clockStates')??{};}
  clockKey(packId,clockId){return `${packId}/${clockId}`;}
  clock(packId,c){const old=this.clockStates()[this.clockKey(packId,c.id)]??newClock(c);return c.repeat?{...old,repeat:true,durationSec:c.minutes*60}:old;}
  state(actor,packId){return actor?.getFlag(MODULE_ID,'packs')?.[packId]??null;}
  enrolled(actor,id){return this.state(actor,id)?.enrolled===true;}
  entry(actor,pack,track){return this.state(actor,pack.id)?.tracks?.[track.id]??null;}
  clockView(pack,track){if(!track.clock)return null;const def=pack.clocks.find(c=>c.id===track.clock.id);if(!def)return null;return {...this.clock(pack.id,def),totalBells:def.bells};}
  resource(actor,pack,track){const st=this.entry(actor,pack,track);if(!st)return null;const clock=this.clockView(pack,track);return {...tierData(track,st,clock),base:st.base,missing:effectiveLoss(track,st,clock),spent:st.spent,restored:st.restored,surrenderedPower:st.surrenderedPower};}
  actorKey(actor){const expected=actor.system?.details?.keyability?.value; if(ABILITIES.includes(expected))return expected;return [...ABILITIES].sort((a,b)=>Number(actor.system?.abilities?.[b]?.mod??0)-Number(actor.system?.abilities?.[a]?.mod??0))[0];}
  sourceValue(actor,track){if(track.source==='fixed')return track.initial;const n=Number(actor.saves?.will?.mod??actor.system?.saves?.will?.value);if(!Number.isFinite(n)||n<1)throw Error(`Cannot read a positive starting Will modifier for ${actor.name}. Check the PF2e sheet.`);return Math.trunc(n);}
  async chat(html){return ChatMessage.create({speaker:{alias:'Kiragon Homebrew'},content:`<div class="kiragon-chat">${html}</div>`});}
  e(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  async savePack(pack,{replace=false}={}){
    this.requireGM();const next=validatePack(pack);const old=this.packs();const index=old.findIndex(p=>p.id===next.id);
    if(index>=0&&!replace)throw Error(`Pack ${next.id} exists. Edit the existing pack or select a different id.`);
    if(index>=0){if(old[index].tracks.some(t=>!next.tracks.some(n=>n.id===t.id)) && game.actors.contents.some(a=>this.enrolled(a,next.id)))throw Error('Cannot remove track IDs while characters are enrolled. Reset their pack first.');old[index]=next;}else old.push(next);
    await game.settings.set(MODULE_ID,'packs',old);await this.syncAll();this.onChange();return next;
  }
  async deletePack(id){this.requireGM();if(game.actors.contents.some(a=>this.enrolled(a,id)))throw Error('Reset or unenroll all actors first. Their state will not be silently discarded.');const old=this.packs();await game.settings.set(MODULE_ID,'packs',old.filter(p=>p.id!==id));await this.setEnabled(id,false);const states=this.clockStates();for(const k of Object.keys(states))if(k.startsWith(id+'/'))delete states[k];await game.settings.set(MODULE_ID,'clockStates',states);this.onChange();}
  async setEnabled(id,enabled){this.requireGM();if(!this.pack(id)&&enabled)throw Error('Unknown pack.');const ids=new Set(this.enabled());enabled?ids.add(id):ids.delete(id);await game.settings.set(MODULE_ID,'enabled',[...ids]);if(!enabled){const p=this.pack(id);if(p){for(const c of p.clocks){const x=this.clock(id,c);if(x.running)await this.updateClock(id,c.id,{...x,remainingSec:secondsRemaining(x),running:false,deadlineMs:0,...(c.repeat?{elapsedSec:elapsedClockSeconds(x),anchorMs:0}: {})});}}}await this.syncAll();this.onChange();}
  async ensureBuiltins(){if(!this.primaryGM)return;const old=this.packs();let changed=false;
    for(const file of ['abyssal-erosion','fate-scars-example']){try{
      const response=await fetch(`modules/${MODULE_ID}/packs/${file}.json`);if(!response.ok)throw Error(response.status);
      const builtin=validatePack(await response.json());const index=old.findIndex(x=>x.id===file);
      if(index<0){old.push(builtin);changed=true;}
      else if(file==='abyssal-erosion'&&old[index].version==='1.1.0'){
        // Migration from the original 90-minute absolute deadline. Resource spending is
        // preserved, but elapsed clocks reset because the old and new drains differ.
        old[index]=builtin;changed=true;
        const states=this.clockStates();delete states[this.clockKey(file,'severance')];
        await game.settings.set(MODULE_ID,'clockStates',states);
        ui.notifications?.warn('Kiragon Abyssal Erosion updated: the old 90-minute clock was reset. Start the new repeating 10-minute bell when ready. Existing character Erosion is preserved.');
      }
    }catch(e){console.error(MODULE_ID,'Failed to load builtin pack',file,e);}}
    if(changed)await game.settings.set(MODULE_ID,'packs',old);
    this.onChange();
  }
  async enroll(actor,packId,key){this.requireGM();const pack=this.pack(packId);if(!pack||!this.isEnabled(packId))throw Error('Enable a valid pack first.');if(actor?.type!=='character')throw Error('Choose a PF2e player character.');if(this.enrolled(actor,packId))throw Error(`${actor.name} is already enrolled in ${pack.name}.`);
    const initial={};for(const t of pack.tracks)initial[t.id]=this.sourceValue(actor,t);
    const all=clone(actor.getFlag(MODULE_ID,'packs')??{});all[packId]=newActorPack(pack,initial,key??this.actorKey(actor));await actor.setFlag(MODULE_ID,'packs',all);await this.syncActor(actor);await this.chat(`<b>${this.e(actor.name)}</b> enters <b>${this.e(pack.name)}</b>.`);this.onChange();}
  async changeKey(actor,packId,key){this.requireGM();if(!ABILITIES.includes(key))throw Error('Invalid ability.');await this.mutateState(actor,packId,s=>{s.key=key;});}
  async mutateState(actor,packId,fn){this.requireGM();const all=clone(actor.getFlag(MODULE_ID,'packs')??{});if(!all[packId]?.enrolled)throw Error(`${actor.name} is not enrolled in ${packId}.`);fn(all[packId]);await actor.setFlag(MODULE_ID,'packs',all);await this.syncActor(actor);this.onChange();}
  async adjust(actor,packId,trackId,delta,reason='GM adjustment'){
    this.requireGM();const p=this.pack(packId);const t=p?.tracks.find(x=>x.id===trackId);if(!t)throw Error('Unknown pack/track.');const old=this.state(actor,packId);if(!old)throw Error('Actor not enrolled.');if(old.tracks[trackId].lost)throw Error(`${actor.name} is already lost. Use GM reset to undo permanent loss.`);
    const before=this.resource(actor,p,t).value;
    await this.mutateState(actor,packId,s=>{s.tracks[trackId]=adjustResource(t,s.tracks[trackId],this.clockView(p,t),int(delta));});
    const after=this.resource(actor,p,t).value;
    await this.chat(`<b>${this.e(actor.name)}</b>: ${this.e(reason)} — ${this.e(t.label)} ${before} → ${after}.${before>0&&after===0?` <b>LOST: ${this.e(t.terminalLabel??'Identity dissolved')}</b>`:''}`);return after;
  }
  async unEnroll(actor,packId){this.requireGM();const all=clone(actor.getFlag(MODULE_ID,'packs')??{});delete all[packId];await actor.setFlag(MODULE_ID,'packs',all);await this.syncActor(actor);this.onChange();}
  async resetPack(packId){this.requireGM();for(const a of game.actors.contents.filter(a=>this.enrolled(a,packId)))await this.unEnroll(a,packId);const p=this.pack(packId);const states=this.clockStates();for(const c of p?.clocks??[])states[this.clockKey(packId,c.id)]=newClock(c);await game.settings.set(MODULE_ID,'clockStates',states);this.onChange();}
  managedItems(actor){return actor.items.filter(i=>i.type==='effect'&&i.getFlag(MODULE_ID,'managed')===true);}
  effectRules(actor,pack,track,st){
    const s=this.state(actor,pack.id),clock=this.clockView(pack,track),data=tierData(track,st,clock);const rules=[];
    for(const e of track.effects??[]){
      if(Number.isInteger(e.minTier)&&data.tier<e.minTier)continue;
      if(Number.isInteger(e.maxTier)&&data.tier>e.maxTier)continue;
      if(e.kind==='flat-modifier'){
        let value=effectValue(e,track,st,clock);
        // A Wisdom polarization RE also raises Will. Offset it so the Will/identity loss is not cancelled.
        if(e.selector==='will'&&s.key==='wis'&&e.basedOn==='missing')value-=data.power;
        if(value!==0){const re={key:'FlatModifier',selector:e.selector,value,label:e.label??track.label};if(e.type&&e.type!=='untyped')re.type=e.type;rules.push(re);}
      }
      if(e.kind==='key-attribute'&&data.power>0&&!st.lost){rules.push({key:'ActiveEffectLike',mode:'add',path:`system.abilities.${s.key}.mod`,value:data.power,priority:50});}
    }
    return rules;
  }
  async syncActor(actor){if(!this.gm||actor.type!=='character')return;
    const wanted=new Map();const all=actor.getFlag(MODULE_ID,'packs')??{};
    for(const p of this.packs().filter(p=>this.isEnabled(p.id)&&all[p.id]?.enrolled)){
      const tracks=all[p.id].tracks??{};
      for(const t of p.tracks){const st=tracks[t.id];if(!st)continue;const data=this.resource(actor,p,t);if(data.value===0&&!st.lost){const x=clone(all);x[p.id].tracks[t.id].lost=true;await actor.setFlag(MODULE_ID,'packs',x);await this.chat(`<b>${this.e(actor.name)}</b> reaches zero ${this.e(t.label)} and becomes <b>${this.e(t.terminalLabel??'LOST')}</b>.`);}
        const rules=this.effectRules(actor,p,t,st);if(!rules.length)continue;
        const key=`${p.id}/${t.id}`;
        wanted.set(key,{name:`Kiragon: ${t.label} — ${p.name}`,type:'effect',img:'icons/magic/symbols/rune-sigil-black-pink.webp',system:{description:{value:`<p>${this.e(p.name)} · ${this.e(t.label)}: ${data.value}/${st.base} · ${this.e(data.label)} · Key ${this.e(all[p.id].key)} +${data.power}</p>`},duration:{value:-1,unit:'unlimited',sustained:false},traits:{value:[]},rules},flags:{[MODULE_ID]:{managed:true,source:key}}});
      }
    }
    for(const item of this.managedItems(actor)){const key=item.getFlag(MODULE_ID,'source');if(!wanted.has(key)){await item.delete();continue;}const expect=wanted.get(key);wanted.delete(key);
      if(JSON.stringify(item.system.rules)!==JSON.stringify(expect.system.rules)||item.system.description?.value!==expect.system.description.value)await item.update({'system.rules':expect.system.rules,'system.description.value':expect.system.description.value});
    }
    if(wanted.size)await actor.createEmbeddedDocuments('Item',[...wanted.values()]);
  }
  async syncAll(){if(!this.primaryGM)return;for(const actor of game.actors.contents.filter(a=>a.type==='character'))try{await this.syncActor(actor);}catch(e){console.error(MODULE_ID,'Failed syncing',actor.name,e);ui.notifications.error(`${actor.name}: ${e.message}`);}this.onChange();}
  usageTag(action,pack){if(action.once==='expedition')return 'expedition';if(action.once==='encounter-or-bell'){const combat=game.combat;return combat?.started?`combat:${combat.id}`:`bell:${pack.clocks.map(c=>this.clock(pack.id,c).bells).join(',')}`;}return null;}
  async useAction(actor,packId,actionId){this.requireGM();const p=this.pack(packId),action=p?.actions.find(x=>x.id===actionId);if(!action)throw Error('Unknown action.');const t=p.tracks.find(x=>x.id===action.track),st=this.entry(actor,p,t);if(!st)throw Error('Actor not enrolled.');if(st.lost)throw Error('Character already lost.');const data=this.resource(actor,p,t);if((action.requiresTier??0)>data.tier)throw Error(`Requires polarization tier ${action.requiresTier}.`);
    const group=action.group??action.id,tag=this.usageTag(action,p);const used=this.state(actor,p.id)?.uses?.[group];if(tag&&used===tag)throw Error('This action has already been used in the current interval.');
    if(action.kind==='surrender'&&data.power<int(action.surrender??1))throw Error('Not enough polarization power to surrender.');
    if(tag)await this.mutateState(actor,p.id,s=>{s.uses[group]=tag;});
    if(action.kind==='adjust')await this.adjust(actor,p.id,t.id,int(action.amount),action.label);
    else if(action.kind==='rupture'){const cost=applyRupture(t,this.entry(actor,p,t),this.clockView(p,t),action);await this.adjust(actor,p.id,t.id,-cost,action.label);}
    else if(action.kind==='surrender'){await this.mutateState(actor,p.id,s=>{s.tracks[t.id].surrenderedPower+=int(action.surrender??1);s.tracks[t.id]=adjustResource(t,s.tracks[t.id],this.clockView(p,t),int(action.restore??0));});await this.chat(`<b>${this.e(actor.name)}</b> uses ${this.e(action.label)}: ${this.e(action.description??'')}`);}
    else if(action.kind==='overdrive'){await this.adjust(actor,p.id,t.id,int(action.amount??-1),action.label);if(!this.entry(actor,p,t).lost&&action.bonus)await this.grantEffect(actor,p,action);}
    else if(action.kind==='grant-effect'){await this.grantEffect(actor,p,action);await this.chat(`<b>${this.e(actor.name)}</b> uses ${this.e(action.label)}.`);}
    else await this.chat(`<b>${this.e(actor.name)}</b>: ${this.e(action.label)}. ${this.e(action.description??'')}`);
    this.onChange();
  }
  async grantEffect(actor,p,action){const b=action.bonus;if(!b)return;const r={key:'FlatModifier',selector:b.selector,value:b.value,label:action.label};if(b.type&&b.type!=='untyped')r.type=b.type;if(b.removeAfterRoll)r.removeAfterRoll='if-enabled';await actor.createEmbeddedDocuments('Item',[{name:`Kiragon: ${action.label}`,type:'effect',img:'icons/magic/control/buff-strength-muscle-damage.webp',system:{description:{value:`<p>${this.e(action.description??'Temporary homebrew bonus')}</p>`},duration:{value:1,unit:'minutes',sustained:false},traits:{value:[]},rules:[r]},flags:{[MODULE_ID]:{temporary:true,source:`${p.id}/${action.id}`}}}]);}
  async updateClock(packId,id,state){this.requireGM();const all=this.clockStates();all[this.clockKey(packId,id)]=state;await game.settings.set(MODULE_ID,'clockStates',all);this.onChange();}
  async startClock(packId,id){this.requireGM();const p=this.pack(packId),def=p?.clocks.find(c=>c.id===id);if(!def)throw Error('Clock not found.');if(!this.isEnabled(packId))throw Error('Enable the pack first.');const old=this.clock(packId,def);if(old.running)return;const rem=secondsRemaining(old);if(!def.repeat&&rem<=0)throw Error('Clock expired; reset the expedition to start again.');const active=!!game.combats.contents.find(c=>c.started);const paused=!!(def.pauseDuringCombat&&active);
    await this.updateClock(packId,id,{...old,remainingSec:rem,running:!paused,deadlineMs:paused?0:Date.now()+rem*1000,combatPaused:paused,...(def.repeat?{elapsedSec:elapsedClockSeconds(old),anchorMs:paused?0:Date.now()}: {})});await this.chat(`<b>${this.e(def.label)}</b> started (${def.minutes} min).`);}
  async pauseClock(packId,id){this.requireGM();const p=this.pack(packId),def=p?.clocks.find(c=>c.id===id);const old=this.clock(packId,def);await this.updateClock(packId,id,{...old,running:false,remainingSec:secondsRemaining(old),deadlineMs:0,combatPaused:false,...(def.repeat?{elapsedSec:elapsedClockSeconds(old),anchorMs:0}: {})});}
  async advanceClock(packId,id,seconds){this.requireGM();const p=this.pack(packId),def=p?.clocks.find(c=>c.id===id);const old=this.clock(packId,def);const rem=Math.max(0,secondsRemaining(old)-int(seconds));await this.updateClock(packId,id,def.repeat?{...old,elapsedSec:elapsedClockSeconds(old)+Math.max(0,int(seconds)),anchorMs:old.running?Date.now():0}:{...old,remainingSec:rem,deadlineMs:old.running?Date.now()+rem*1000:0});await this.processClocks();}
  async processClocks(){if(!this.primaryGM||this.processing)return;this.processing=true;
    try{let all=this.clockStates(),changed=false;for(const p of this.packs().filter(x=>this.isEnabled(x.id)))for(const def of p.clocks){const key=this.clockKey(p.id,def.id),c=all[key]??newClock(def);const bells=countedBells(c,def);if(bells>c.bells){all[key]={...c,bells,...(!def.repeat&&bells>=def.bells?{running:false,remainingSec:0,deadlineMs:0}:{})};changed=true;for(let n=c.bells+1;n<=bells;n++)await this.chat(`<b>${this.e(def.label)}: Bell ${n}${def.repeat?'':`/${def.bells}`}</b>${!def.repeat&&n===def.bells?' — The deadline is reached.':''}`);}
      else if(!def.repeat&&secondsRemaining(c)===0){all[key]={...c,running:false,remainingSec:0,deadlineMs:0};changed=true;}
    }
    if(changed){await game.settings.set(MODULE_ID,'clockStates',all);await this.syncAll();}
    }catch(e){console.error(MODULE_ID,e);ui.notifications?.error(`Clock error: ${e.message}`);}finally{this.processing=false;}
  }
  async combatChanged(){if(!this.primaryGM)return;const active=!!game.combats.contents.find(c=>c.started);const all=this.clockStates();let changed=false;for(const p of this.packs().filter(x=>this.isEnabled(x.id)))for(const def of p.clocks.filter(x=>x.pauseDuringCombat)){const key=this.clockKey(p.id,def.id),c=all[key]??newClock(def);if(active&&c.running){all[key]={...c,running:false,remainingSec:secondsRemaining(c),deadlineMs:0,combatPaused:true,...(def.repeat?{elapsedSec:elapsedClockSeconds(c),anchorMs:0}: {})};changed=true;}
    else if(!active&&c.combatPaused){const rem=Math.max(0,secondsRemaining(c)-int(def.combatCostMinutes*60));all[key]=def.repeat?{...c,elapsedSec:elapsedClockSeconds(c)+Math.max(0,int(def.combatCostMinutes*60)),anchorMs:Date.now(),running:true,combatPaused:false}:{...c,remainingSec:rem,running:rem>0,deadlineMs:rem>0?Date.now()+rem*1000:0,combatPaused:false};changed=true;}
  }
  if(changed){await game.settings.set(MODULE_ID,'clockStates',all);await this.processClocks();this.onChange();}}
  async importAdversaries(packId){this.requireGM();const pack=this.pack(packId);if(!pack)throw Error('Unknown pack.');let n=0;for(const a of pack.adversaries){const found=game.actors.contents.some(actor=>actor.getFlag(MODULE_ID,'pack')===packId&&actor.getFlag(MODULE_ID,'adversary')===a.id);if(found)continue;const raw=clone(a.actor);raw.flags??={};raw.flags[MODULE_ID]={pack:packId,adversary:a.id};await Actor.create(raw,{renderSheet:false});n++;}ui.notifications.info(`${n} Kiragon NPCs imported; existing entries skipped.`);this.onChange();return n;}

  async importItems(packId){
    this.requireGM();const pack=this.pack(packId);if(!pack)throw Error('Unknown pack.');let n=0;
    for(const item of pack.items??[]){
      const exists=game.items.contents.some(i=>i.getFlag(MODULE_ID,'pack')===packId&&i.getFlag(MODULE_ID,'template')===item.id);
      if(exists)continue;const data=clone(item.document);data.flags??={};data.flags[MODULE_ID]={pack:packId,template:item.id};
      await Item.create(data,{renderSheet:false});n++;
    }
    ui.notifications.info(`${n} Kiragon PF2e world items imported; existing entries skipped.`);this.onChange();return n;
  }
  getAdversary(packId,actor){const p=this.pack(packId);return p?.adversaries.find(a=>a.id===actor?.getFlag(MODULE_ID,'adversary')&&actor.getFlag(MODULE_ID,'pack')===packId)??null;}
  async attack(packId,monster,target,abilityId){this.requireGM();const p=this.pack(packId),adv=this.getAdversary(packId,monster),ab=adv?.abilities.find(a=>a.id===abilityId);if(!ab||!this.enrolled(target,packId))throw Error('Select an imported monster and an enrolled character.');
    const combat=game.combat;const tag=combat?.started?`round:${combat.id}:${combat.round}`:`bell:${p.clocks.map(c=>this.clock(packId,c).bells).join(',')}`;
    const uses=monster.getFlag(MODULE_ID,'attackUses')??{};const useKey=`${abilityId}:${target.id}`;if(uses[useKey]===tag)throw Error('This signature attack already targeted this creature in the current round/interval.');
    let stat,dc,degree;
    if(ab.kind==='save'){
      stat=ab.defense==='perception'?target.perception:target.saves?.[ab.defense];dc=ab.dc;
    }else{
      stat=monster.skills?.[ab.skill];dc=Number(target.perception?.dc?.value??(10+target.perception?.mod));
    }
    if(!stat?.roll||!Number.isFinite(dc))throw Error('PF2e statistic or DC unavailable. Check NPC/character sheet.');
    const roll=await stat.roll({dc:{value:dc},skipDialog:false});degree=roll?.degreeOfSuccess??roll?.options?.degreeOfSuccess??roll?.roll?.degreeOfSuccess;
    if(!Number.isInteger(degree)){ui.notifications.warn('PF2e did not return a degree of success. No Erosion applied; resolve the roll manually.');return;}
    await monster.setFlag(MODULE_ID,'attackUses',{...uses,[useKey]:tag});const value=outcomeLoss(ab,degree);
    await this.chat(`<b>${this.e(monster.name)}</b> uses <b>${this.e(ab.label)}</b> against ${this.e(target.name)} (${this.e(degreeName(degree))}): <b>${value} ${this.e(p.tracks.find(t=>t.id===ab.track)?.label??'resource')} lost</b>. ${this.e(ab.note??'')}`);
    if(value>0)await this.adjust(target,packId,ab.track,-value,`${monster.name}: ${ab.label}`);
    if(degree===0&&ab.conditionOnCriticalFailure){if(target.increaseCondition)try{await target.increaseCondition(ab.conditionOnCriticalFailure);}catch(e){ui.notifications.warn(`Apply ${ab.conditionOnCriticalFailure} manually: ${e.message}`);}}
    this.onChange();
  }
  async migrateLegacyAbyss(){this.requireGM();const p=this.pack('abyssal-erosion');if(!p||!this.isEnabled(p.id))throw Error('Enable the Abyssal Erosion pack first.');let n=0;for(const a of game.actors.contents.filter(a=>a.type==='character')){
    const old=a.getFlag('abyssal-erosion','state');if(!old?.enrolled||this.enrolled(a,p.id))continue;
    const all=clone(a.getFlag(MODULE_ID,'packs')??{});all[p.id]=newActorPack(p,{identity:old.baseWill},old.key);const s=all[p.id].tracks.identity;s.spent=int(old.extraErosion);s.restored=int(old.restored);s.surrenderedPower=int(old.surrenderedPower);s.lost=!!old.lost;await a.setFlag(MODULE_ID,'packs',all);
    const legacy=a.items.filter(i=>i.getFlag('abyssal-erosion','managed')||i.getFlag('abyssal-erosion','overdrive'));if(legacy.length)await a.deleteEmbeddedDocuments('Item',legacy.map(i=>i.id));await this.syncActor(a);n++;
  }
  ui.notifications.info(`${n} legacy Abyssal Erosion characters migrated. Old clock not migrated; do not enable both modules simultaneously.`);return n;
  }
}
