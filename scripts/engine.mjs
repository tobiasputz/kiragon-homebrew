/** Kiragon Homebrew Engine: pure, safely importable JSON rules and calculations. */
export const MODULE_ID = 'kiragon-homebrew';
export const SCHEMA_VERSION = 1;
export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ID = /^[a-z][a-z0-9-]{1,49}$/;
const ALLOWED_ACTIONS = new Set(['adjust','rupture','surrender','overdrive','announce','grant-effect']);
const ALLOWED_SOURCES = new Set(['actor-will','fixed']);
const ALLOWED_ATTACKS = new Set(['save','skill-vs-perception']);
const ALLOWED_EFFECTS = new Set(['flat-modifier','key-attribute']);
export const clone = obj => JSON.parse(JSON.stringify(obj));
export const int = (n, fallback=0) => Number.isFinite(Number(n)) ? Math.trunc(Number(n)) : fallback;
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function validatePack(raw) {
  if (!raw || Array.isArray(raw) || typeof raw !== 'object') throw Error('Pack must be a JSON object.');
  if (raw.schema !== SCHEMA_VERSION) throw Error(`Unsupported schema version. Expected ${SCHEMA_VERSION}.`);
  if (!ID.test(raw.id ?? '')) throw Error('Pack id must be lowercase letters, digits and hyphens (2–50 characters).');
  if (typeof raw.name !== 'string' || raw.name.trim().length < 2 || raw.name.length > 120) throw Error('Pack name must be 2–120 characters.');
  if (!Array.isArray(raw.tracks) || !raw.tracks.length || raw.tracks.length > 12) throw Error('Define 1–12 resource tracks.');
  if (!Array.isArray(raw.clocks) || raw.clocks.length > 8) throw Error('clocks must be an array (up to 8).');
  if (!Array.isArray(raw.actions) || raw.actions.length > 40) throw Error('actions must be an array (up to 40).');
  if (!Array.isArray(raw.adversaries) || raw.adversaries.length > 40) throw Error('adversaries must be an array (up to 40).');
  if (raw.items!==undefined && (!Array.isArray(raw.items) || raw.items.length>100)) throw Error('items must be an array (up to 100).');
  const unique = (items, label) => { const ids=new Set(); for(const x of items) {if(!ID.test(x?.id??''))throw Error(`Invalid ${label} id: ${x?.id}`);if(ids.has(x.id))throw Error(`Duplicate ${label} id: ${x.id}`);ids.add(x.id);} return ids; };
  const clockIds=unique(raw.clocks,'clock');
  const trackIds=unique(raw.tracks,'track');
  unique(raw.actions,'action'); unique(raw.adversaries,'adversary');
  for (const c of raw.clocks) {
    if (typeof c.label!=='string' || !Number.isFinite(c.minutes) || c.minutes<1 || c.minutes>1440 || !Number.isInteger(c.bells) || c.bells<1 || c.bells>100) throw Error(`Clock ${c.id} must have label, minutes (1–1440) and bells (1–100).`);
  }
  for (const t of raw.tracks) {
    if(typeof t.label!=='string'||!ALLOWED_SOURCES.has(t.source))throw Error(`Track ${t.id} requires a label and source actor-will or fixed.`);
    if(t.source==='fixed' && (!Number.isInteger(t.initial)||t.initial<1||t.initial>9999))throw Error(`Track ${t.id} needs a positive integer initial value.`);
    if(t.clock && (!clockIds.has(t.clock.id) || t.clock.loss!=='fractional' || !Number.isFinite(t.clock.fraction) || t.clock.fraction<0||t.clock.fraction>1))throw Error(`Invalid fractional clock drain for ${t.id}.`);
    if(t.tiers){
      if(!Array.isArray(t.tiers)||t.tiers.length>12)throw Error(`Invalid tiers on ${t.id}.`);
      let previous=1.01;
      for(const q of t.tiers){if(typeof q.label!=='string'||!Number.isFinite(q.atOrBelow)||q.atOrBelow<=0||q.atOrBelow>=previous||q.atOrBelow>1||!Number.isInteger(q.power)||q.power<0||q.power>10)throw Error(`Tiers on ${t.id} must descend in remaining fraction with power 0–10.`);previous=q.atOrBelow;}
    }
    for(const e of t.effects??[]){
      if((e.minTier!==undefined&&(!Number.isInteger(e.minTier)||e.minTier<0))||(e.maxTier!==undefined&&(!Number.isInteger(e.maxTier)||e.maxTier<0)))throw Error(`Invalid effect tier filter for ${t.id}`);
      if(!ALLOWED_EFFECTS.has(e.kind))throw Error(`Unknown effect kind on ${t.id}: ${e.kind}`);
      if(e.kind==='flat-modifier' && (typeof e.selector!=='string'||!['missing','remaining','tier','power','fixed'].includes(e.basedOn)||!Number.isFinite(e.multiplier??1)))throw Error(`Invalid flat-modifier for ${t.id}`);
      if(e.kind==='key-attribute' && e.basedOn!=='power')throw Error(`Key attribute effect must use tier power in ${t.id}`);
    }
  }
  for(const a of raw.actions){
    if(typeof a.label!=='string'||!ALLOWED_ACTIONS.has(a.kind)||!trackIds.has(a.track))throw Error(`Invalid action ${a.id}.`);
    if(!['adjust','rupture','surrender','overdrive','announce','grant-effect'].includes(a.kind))throw Error(`Unsupported action ${a.id}.`);
    if(a.kind==='grant-effect' || (a.kind==='overdrive' && a.bonus)){
      const b=a.bonus;
      if(!b||typeof b.selector!=='string'||!Number.isFinite(b.value)||!['circumstance','status','item','untyped'].includes(b.type??'untyped'))throw Error(`Action ${a.id} has invalid bonus effect.`);
    }
  }
  for(const a of raw.adversaries){
    if(!a.actor||a.actor.type!=='npc'||typeof a.actor.name!=='string'||!Array.isArray(a.abilities))throw Error(`Adversary ${a.id} needs PF2e NPC actor data and abilities.`);
    if(a.abilities.length>12)throw Error(`Too many abilities on ${a.id}.`);
    unique(a.abilities,`${a.id} ability`);
    for(const b of a.abilities){if(!ALLOWED_ATTACKS.has(b.kind)||!trackIds.has(b.track))throw Error(`Invalid attack ${a.id}/${b.id}`);
      if(b.kind==='save' && (!['reflex','fortitude','will','perception'].includes(b.defense)||!Number.isInteger(b.dc)))throw Error(`Invalid save/DC for ${a.id}/${b.id}`);
      if(b.kind==='skill-vs-perception'&&typeof b.skill!=='string')throw Error(`Invalid skill for ${a.id}/${b.id}`);
      for(const [degree,loss] of Object.entries(b.erosion??{})) if(!['criticalFailure','failure','success','criticalSuccess'].includes(degree)||!Number.isInteger(loss)||loss<0||loss>100)throw Error(`Invalid outcome for ${a.id}/${b.id}`);
    }
  }
  if(raw.items?.length){unique(raw.items,'item');for(const item of raw.items){if(!item.document||typeof item.document.name!=='string'||typeof item.document.type!=='string'||typeof item.document.system!=='object')throw Error(`Invalid PF2e item document ${item.id}`);}}
  // Any JSON object may carry extra description fields; unknown executable behaviors are never interpreted.
  return clone(raw);
}
export function newActorPack(pack,initialByTrack={},key='str'){
  const tracks={};
  for(const t of pack.tracks)tracks[t.id]={base:Math.max(1,int(initialByTrack[t.id]??t.initial,1)),spent:0,restored:0,surrenderedPower:0,lost:false};
  return {enrolled:true,key:ABILITIES.includes(key)?key:'str',tracks,uses:{}};
}
export function newClock(c){return {durationSec:c.minutes*60,remainingSec:c.minutes*60,deadlineMs:0,running:false,bells:0,combatPaused:false};}
export function secondsRemaining(c,now=Date.now()){return c.running?Math.max(0,Math.ceil((c.deadlineMs-now)/1000)):Math.max(0,int(c.remainingSec));}
export function countedBells(c,def,now=Date.now()){
  return clamp(Math.floor((c.durationSec-secondsRemaining(c,now)+0.00001)/(c.durationSec/def.bells)),0,def.bells);
}
export function timeLoss(t,st,clockState){
  if(!t.clock||!clockState)return 0;
  return Math.floor(st.base*t.clock.fraction*clamp(clockState.bells,0,clockState.totalBells)/clockState.totalBells);
}
export function remaining(t,st,clockState){
  if(!st)return 0;
  if(t.clock?.fraction===1 && clockState && clockState.bells>=clockState.totalBells)return 0;
  return clamp(st.base-timeLoss(t,st,clockState)-Math.max(0,int(st.spent))+Math.max(0,int(st.restored)),0,st.base);
}
export function tierData(t,st,clockState){
  const value=remaining(t,st,clockState);
  if(value===0)return {tier:(t.tiers?.length??0)+1,label:t.terminalLabel??'Lost',power:0,value,lost:true};
  let tier=0,power=0,label=t.normalLabel??'Stable';
  for(const [i,q] of (t.tiers??[]).entries())if(value/st.base<=q.atOrBelow){tier=i+1;power=q.power;label=q.label;}
  return {tier,label,power:Math.max(0,power-int(st.surrenderedPower)),value,lost:!!st.lost};
}
export function effectiveLoss(t,st,clock){return st.base-remaining(t,st,clock);}
export function adjustResource(t,st,clock,delta){
  const next=clone(st);
  if(delta<0)next.spent+=-int(delta);
  if(delta>0)next.restored+=int(delta);
  if(remaining(t,next,clock)<=0)next.lost=true;
  return next;
}
export function applyRupture(t,st,clock,action){const {tier}=tierData(t,st,clock);return Math.max(0,int(action.costByTier?.[tier]??tier));}
export function effectValue(e,t,st,clock){const data=tierData(t,st,clock);const base={remaining:data.value,missing:st.base-data.value,tier:data.tier,power:data.power,fixed:1}[e.basedOn]??0;return base*Number(e.multiplier??1);}
export function degreeName(degree){return ['criticalFailure','failure','success','criticalSuccess'][degree]??null;}
export function outcomeLoss(ability,degree){return int(ability.erosion?.[degreeName(degree)]??0);}
