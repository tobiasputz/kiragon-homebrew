import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {KiragonRuntime} from '../scripts/runtime.mjs';
const read=(id)=>JSON.parse(fs.readFileSync(new URL(`../packs/${id}.json`,import.meta.url)));
function setup(){
  const settings=new Map(),actors=[];const messages=[];
  globalThis.game={user:{id:'gm1',isGM:true},users:[{id:'gm1',isGM:true,active:true},{id:'player1',isGM:false,active:true}],items:{contents:[]},actors:{contents:actors},combats:{contents:[]},combat:null,settings:{get:(m,k)=>structuredClone(settings.get(`${m}.${k}`)??({packs:[],enabled:[],clockStates:{}}[k])),set:async(m,k,value)=>{settings.set(`${m}.${k}`,structuredClone(value));}}};
  globalThis.ChatMessage={create:async m=>{messages.push(m);return m;}};
  globalThis.ui={notifications:{info:()=>{},warn:()=>{},error:e=>{throw Error(String(e));}}};
  let next=1;
  class FakeItem{
    constructor(actor,data){this.actor=actor;this.data=structuredClone(data);this.id=`item${next++}`;this.type=data.type;this.name=data.name;this.system=this.data.system;this.flags=this.data.flags??{};}
    getFlag(ns,key){return this.flags[ns]?.[key];}
    async update(delta){for(const [key,val] of Object.entries(delta)){if(key==='system.rules')this.system.rules=structuredClone(val);else if(key==='system.description.value')this.system.description.value=val;}}
    async delete(){this.actor.items=this.actor.items.filter(i=>i!==this);}
  }
  class FakeActor{
    constructor(name,type='character',raw=null){this.id=`actor${next++}`;this.name=name;this.type=type;this.ownership=type==='character'?{player1:3}:{};this.hasPlayerOwner=type==='character';this.isOwner=true;this.testUserPermission=(user,level)=>user.isGM||Number(this.ownership[user.id]??0)>=3;this._flags=structuredClone(raw?.flags??{});this.items=(raw?.items??[]).map(it=>new FakeItem(this,it));this.system=raw?.system??{details:{keyability:{value:'str'}},abilities:{str:{mod:5},dex:{mod:3},con:{mod:3},int:{mod:1},wis:{mod:2},cha:{mod:0}}};this.saves={will:{mod:22,roll:async()=>({degreeOfSuccess:0})},reflex:{roll:async()=>({degreeOfSuccess:0})},fortitude:{roll:async()=>({degreeOfSuccess:1})}};
      this.perception={dc:{value:32},roll:async()=>({degreeOfSuccess:1})};this.skills={deception:{roll:async()=>({degreeOfSuccess:3})}};this.conditions=[];
    }
    getFlag(ns,k){return structuredClone(this._flags?.[ns]?.[k]);}
    async setFlag(ns,k,v){(this._flags[ns]??={})[k]=structuredClone(v);}
    async createEmbeddedDocuments(type,items){const result=items.map(it=>new FakeItem(this,it));this.items.push(...result);return result;}
    async deleteEmbeddedDocuments(type,ids){this.items=this.items.filter(it=>!ids.includes(it.id));}
    async increaseCondition(x){this.conditions.push(x);}
  }
  globalThis.Actor={create:async(raw)=>{const a=new FakeActor(raw.name,raw.type,raw);actors.push(a);return a;}};
  globalThis.Item={create:async(raw)=>{const item=new FakeItem({items:[]},raw);game.items.contents.push(item);return item;}};
  const hero=new FakeActor('Test Hero');actors.push(hero);
  return {rt:new KiragonRuntime(),hero,actors,messages,settings};
}
test('save, activate, enroll, erode, restore and remove effects',async()=>{
  const {rt,hero}=setup();const pack=read('abyssal-erosion');
  await rt.savePack(pack);await rt.setEnabled(pack.id,true);await rt.enroll(hero,pack.id);
  assert.equal(rt.resource(hero,pack,pack.tracks[0]).value,22);
  await rt.adjust(hero,pack.id,'identity',-7,'attack');
  assert.equal(rt.resource(hero,pack,pack.tracks[0]).value,15);
  const eff=rt.managedItems(hero)[0];assert.equal(eff.system.rules[0].selector,'will');assert.equal(eff.system.rules[0].value,-7);
  assert.equal(eff.system.rules[1].path,'system.abilities.str.mod');assert.equal(eff.system.rules[1].value,1);
  await rt.adjust(hero,pack.id,'identity',2,'recovery');assert.equal(rt.resource(hero,pack,pack.tracks[0]).value,17);
  await rt.setEnabled(pack.id,false);assert.equal(rt.managedItems(hero).length,0,'disable clears sheet effects, preserving flags');
  await rt.setEnabled(pack.id,true);assert.equal(rt.managedItems(hero).length,1);
  await rt.unEnroll(hero,pack.id);assert.equal(rt.managedItems(hero).length,0);
});
test('Wisdom effect offsets its own Will increase',async()=>{
  const {rt,hero}=setup();const p=read('abyssal-erosion');await rt.savePack(p);await rt.setEnabled(p.id,true);await rt.enroll(hero,p.id,'wis');await rt.adjust(hero,p.id,'identity',-6);
  const rules=rt.managedItems(hero)[0].system.rules;
  assert.equal(rules.find(r=>r.selector==='will').value,-7,'6 Erosion and +1 Wis modifier yields net -6 Will');
  assert.equal(rules.find(r=>r.key==='ActiveEffectLike').value,1);
});
test('independent mechanics and per-pack tracks do not bleed state',async()=>{
  const {rt,hero}=setup(),a=read('abyssal-erosion'),b=read('fate-scars-example');await rt.savePack(a);await rt.savePack(b);await rt.setEnabled(a.id,true);await rt.setEnabled(b.id,true);
  await rt.enroll(hero,a.id);await rt.enroll(hero,b.id);
  await rt.adjust(hero,b.id,'fate',-3);assert.equal(rt.resource(hero,b,b.tracks[0]).value,5);assert.equal(rt.resource(hero,a,a.tracks[0]).value,22);
  await rt.adjust(hero,a.id,'identity',-5);assert.equal(rt.resource(hero,b,b.tracks[0]).value,5);
});
test('manual repeatable bells erode per interval without universal deadline',async()=>{
  const {rt,hero}=setup(),p=read('abyssal-erosion');await rt.savePack(p);await rt.setEnabled(p.id,true);await rt.enroll(hero,p.id);
  await rt.startClock(p.id,'severance');await rt.pauseClock(p.id,'severance');
  await rt.advanceClock(p.id,'severance',600);assert.equal(rt.clock(p.id,p.clocks[0]).bells,1);
  await rt.advanceClock(p.id,'severance',4800);assert.equal(rt.clock(p.id,p.clocks[0]).bells,9);
  assert.equal(rt.resource(hero,p,p.tracks[0]).value,13);
  await rt.advanceClock(p.id,'severance',1200);assert.equal(rt.clock(p.id,p.clocks[0]).bells,11);
  assert.equal(rt.resource(hero,p,p.tracks[0]).value,11);
  await rt.advanceClock(p.id,'severance',6600);assert.equal(rt.resource(hero,p,p.tracks[0]).value,0);
  assert.equal(rt.state(hero,p.id).tracks.identity.lost,true);
  await assert.rejects(()=>rt.adjust(hero,p.id,'identity',1));
});
test('import NPCs is idempotent and signature attacks use PF2e checks',async()=>{
  const {rt,hero,actors}=setup(),p=read('abyssal-erosion');await rt.savePack(p);await rt.setEnabled(p.id,true);await rt.enroll(hero,p.id);
  assert.equal(await rt.importAdversaries(p.id),3);assert.equal(await rt.importAdversaries(p.id),0);
  const regret=actors.find(x=>x.name==='Grasping Regret');await rt.attack(p.id,regret,hero,'grasp');
  assert.equal(rt.resource(hero,p,p.tracks[0]).value,20);assert.ok(hero.conditions.includes('immobilized'));
  await assert.rejects(()=>rt.attack(p.id,regret,hero,'grasp'),/already targeted/);
});
test('legacy actor-state migration removes old effects without wiping other packs',async()=>{
  const {rt,hero}=setup(),p=read('abyssal-erosion');await rt.savePack(p);await rt.setEnabled(p.id,true);
  await hero.setFlag('abyssal-erosion','state',{enrolled:true,baseWill:22,key:'cha',extraErosion:3,restored:1,surrenderedPower:0,lost:false});
  await hero.createEmbeddedDocuments('Item',[{type:'effect',name:'Legacy Erosion',system:{description:{value:'legacy'},rules:[]},flags:{'abyssal-erosion':{managed:true}}}]);
  assert.equal(await rt.migrateLegacyAbyss(),1);assert.equal(rt.resource(hero,p,p.tracks[0]).value,20);assert.equal(hero.items.filter(i=>i.getFlag('abyssal-erosion','managed')).length,0);
});

test('generic PF2e item import is idempotent and retains ordinary item rules',async()=>{
  const {rt}=setup(),p=read('fate-scars-example');await rt.savePack(p);
  assert.equal(await rt.importItems(p.id),1);assert.equal(await rt.importItems(p.id),0);
  const item=game.items.contents[0];assert.equal(item.name,'Fate Scar (Example Effect)');
  assert.equal(item.system.rules[0].key,'FlatModifier');assert.equal(item.getFlag('kiragon-homebrew','template'),'fate-scar-effect');
});

test('only genuinely player-owned characters are eligible for clocks, enrollment, and monster targets',async()=>{
  const {rt,hero,actors}=setup(),pack=read('abyssal-erosion');
  const unassigned=new hero.constructor('GM-only character');unassigned.hasPlayerOwner=false;unassigned.ownership={};unassigned.testUserPermission=()=>false;
  const npc=new hero.constructor('NPC','npc');
  actors.push(unassigned,npc);
  assert.deepEqual(rt.playerCharacters().map(a=>a.id),[hero.id]);
  await rt.savePack(pack);await rt.setEnabled(pack.id,true);
  await assert.rejects(()=>rt.enroll(unassigned,pack.id),/owned by a non-GM player/);
  await rt.enroll(hero,pack.id);
});
test('stopwatch can reset without restoring any drained Will',async()=>{
  const {rt,hero}=setup(),p=read('abyssal-erosion');
  await rt.savePack(p);await rt.setEnabled(p.id,true);await rt.enroll(hero,p.id);
  await rt.startClock(p.id,'severance');await rt.pauseClock(p.id,'severance');
  await rt.advanceClock(p.id,'severance',1200);
  assert.equal(rt.resource(hero,p,p.tracks[0]).value,20);
  await rt.resetClock(p.id,'severance');
  assert.equal(rt.clock(p.id,p.clocks[0]).bells,0);
  assert.equal(rt.resource(hero,p,p.tracks[0]).value,20);
  await rt.setBellInterval(p.id,'severance',5);
  assert.equal(rt.pack(p.id).clocks[0].minutes,5);
  await rt.startClock(p.id,'severance');await rt.pauseClock(p.id,'severance');
  await rt.advanceClock(p.id,'severance',300);
  assert.equal(rt.resource(hero,rt.pack(p.id),rt.pack(p.id).tracks[0]).value,19);
});

test('running stopwatch counts real elapsed seconds and rings bell at ten minutes',async()=>{
  const {rt,hero}=setup(),p=read('abyssal-erosion');await rt.savePack(p);await rt.setEnabled(p.id,true);await rt.enroll(hero,p.id);
  await rt.startClock(p.id,'severance');
  const states=rt.clockStates(),key='abyssal-erosion/severance';
  states[key].anchorMs=Date.now()-600_100;
  await game.settings.set('kiragon-homebrew','clockStates',states);
  await rt.processClocks();
  assert.equal(rt.clock(p.id,p.clocks[0]).bells,1);
  assert.equal(rt.resource(hero,p,p.tracks[0]).value,21);
});
test('built-in upgrade preserves pre-existing two-point Erosion per bell',async()=>{
  const {rt,hero}=setup(),old=read('abyssal-erosion');
  old.version='1.3.0';old.tracks[0].clock.amount=2;old.clocks[0].pauseDuringCombat=true;
  await rt.savePack(old);await rt.setEnabled(old.id,true);await rt.enroll(hero,old.id);
  await rt.advanceClock(old.id,'severance',1800);
  assert.equal(rt.resource(hero,old,old.tracks[0]).value,16);
  globalThis.fetch=async()=>({ok:true,json:async()=>read('abyssal-erosion')});
  await rt.ensureBuiltins();
  const p=rt.pack('abyssal-erosion');
  assert.equal(p.tracks[0].clock.amount,1);
  assert.equal(p.clocks[0].pauseDuringCombat,false);
  assert.equal(rt.resource(hero,p,p.tracks[0]).value,16);
  await rt.advanceClock(p.id,'severance',600);
  assert.equal(rt.resource(hero,p,p.tracks[0]).value,15);
});

// Unenrollment regressions: exercise genuine runtime operations, not only
// arithmetic helper functions. All checks use mock Foundry actor/item docs.
test('unenroll clears exactly its own actor flags and rule-element items',async()=>{
  const {rt,hero}=setup(),a=read('abyssal-erosion'),b=read('fate-scars-example');
  b.tracks[0].effects.push({kind:'flat-modifier',selector:'perception',basedOn:'fixed',multiplier:-1});
  await rt.savePack(a);await rt.savePack(b);
  await rt.setEnabled(a.id,true);await rt.setEnabled(b.id,true);
  await rt.enroll(hero,a.id);await rt.enroll(hero,b.id);
  await rt.adjust(hero,a.id,'identity',-7);await rt.adjust(hero,b.id,'fate',-3);
  await hero.createEmbeddedDocuments('Item',[{type:'effect',name:'Unrelated PF2e effect',system:{rules:[],description:{value:'unrelated'}},flags:{}}]);
  const otherBefore=structuredClone(rt.state(hero,b.id));
  await rt.unEnroll(hero,a.id);
  assert.equal(rt.enrolled(hero,a.id),false);
  assert.equal(rt.enrolled(hero,b.id),true);
  assert.deepEqual(rt.state(hero,b.id),otherBefore);
  assert.equal(rt.managedItems(hero).length,1);
  assert.equal(rt.managedItems(hero)[0].getFlag('kiragon-homebrew','source'),`${b.id}/fate`);
  assert.ok(hero.items.some(i=>i.name==='Unrelated PF2e effect'));
  assert.equal(rt.resource(hero,b,b.tracks[0]).value,5);
});
test('unenroll works while pack disabled and UI retains Unenroll control',async()=>{
  const {rt,hero}=setup(),pack=read('abyssal-erosion');
  await rt.savePack(pack);await rt.setEnabled(pack.id,true);await rt.enroll(hero,pack.id);
  await rt.adjust(hero,pack.id,'identity',-5);
  await rt.setEnabled(pack.id,false);
  assert.equal(rt.enrolled(hero,pack.id),true);
  const {renderActor}=await import('../scripts/ui.mjs');
  assert.match(renderActor(rt,hero,pack),/data-action="unenroll"/);
  await rt.unEnroll(hero,pack.id);
  assert.equal(rt.state(hero,pack.id),null);
  assert.equal(rt.managedItems(hero).length,0);
  await rt.setEnabled(pack.id,true);
  assert.equal(rt.managedItems(hero).length,0);
});
test('unenroll is idempotent and removes a stranded orphan effect',async()=>{
  const {rt,hero}=setup(),p=read('abyssal-erosion');
  await rt.savePack(p);await rt.setEnabled(p.id,true);
  await rt.enroll(hero,p.id);
  await rt.unEnroll(hero,p.id);
  await rt.unEnroll(hero,p.id);
  await hero.createEmbeddedDocuments('Item',[{type:'effect',name:'Stale Kiragon effect',system:{rules:[],description:{value:''}},flags:{'kiragon-homebrew':{managed:true,source:'abyssal-erosion/identity'}}}]);
  assert.equal(rt.managedItems(hero).length,1);
  await rt.unEnroll(hero,p.id);
  assert.equal(rt.managedItems(hero).length,0);
  assert.equal(rt.enrolled(hero,p.id),false);
});
test('failed deletion refuses to lose enrollment, later retry succeeds',async()=>{
  const {rt,hero}=setup(),p=read('abyssal-erosion');
  await rt.savePack(p);await rt.setEnabled(p.id,true);await rt.enroll(hero,p.id);
  await rt.adjust(hero,p.id,'identity',-6);
  const item=rt.managedItems(hero)[0];const realDelete=item.delete.bind(item);
  item.delete=async()=>{throw Error('Foundry refused delete');};
  const original=structuredClone(rt.state(hero,p.id));
  await assert.rejects(()=>rt.unEnroll(hero,p.id),/Foundry refused delete/);
  assert.deepEqual(rt.state(hero,p.id),original);
  assert.equal(rt.managedItems(hero).length,1);
  item.delete=realDelete;
  await rt.unEnroll(hero,p.id);
  assert.equal(rt.state(hero,p.id),null);
  assert.equal(rt.managedItems(hero).length,0);
});
test('partial effect removal failure preserves actor enrollment for retry',async()=>{
  const {rt,hero}=setup(),p=read('abyssal-erosion');
  await rt.savePack(p);await rt.setEnabled(p.id,true);await rt.enroll(hero,p.id);
  await hero.createEmbeddedDocuments('Item',[{type:'effect',name:'extra linked effect',system:{rules:[],description:{value:''}},flags:{'kiragon-homebrew':{managed:true,source:'abyssal-erosion/other'}}}]);
  const second=rt.managedItems(hero).find(i=>i.name==='extra linked effect');
  const realDelete=second.delete.bind(second);
  second.delete=async()=>{throw Error('delete failed after first item');};
  await assert.rejects(()=>rt.unEnroll(hero,p.id),/delete failed after first item/);
  assert.equal(rt.enrolled(hero,p.id),true);
  second.delete=realDelete;
  await rt.unEnroll(hero,p.id);
  assert.equal(rt.enrolled(hero,p.id),false);
  assert.equal(rt.managedItems(hero).length,0);
});
test('stopwatch never touches an unenrolled character, other enrolled characters still drain',async()=>{
  const {rt,hero,actors}=setup(),p=read('abyssal-erosion');
  const second=new hero.constructor('Second PC');actors.push(second);
  await rt.savePack(p);await rt.setEnabled(p.id,true);
  await rt.enroll(hero,p.id);await rt.enroll(second,p.id);
  await rt.startClock(p.id,'severance');await rt.pauseClock(p.id,'severance');
  await rt.advanceClock(p.id,'severance',600);
  assert.equal(rt.resource(hero,p,p.tracks[0]).value,21);
  await rt.unEnroll(hero,p.id);
  await rt.advanceClock(p.id,'severance',600);
  assert.equal(rt.state(hero,p.id),null);
  assert.equal(rt.managedItems(hero).length,0);
  assert.equal(rt.resource(second,p,p.tracks[0]).value,20);
});
test('re-enrollment establishes a fresh track but preserves running global clock',async()=>{
  const {rt,hero}=setup(),p=read('abyssal-erosion');
  await rt.savePack(p);await rt.setEnabled(p.id,true);await rt.enroll(hero,p.id);
  await rt.startClock(p.id,'severance');await rt.pauseClock(p.id,'severance');
  await rt.advanceClock(p.id,'severance',1200);
  assert.equal(rt.resource(hero,p,p.tracks[0]).value,20);
  await rt.unEnroll(hero,p.id);
  assert.equal(rt.clock(p.id,p.clocks[0]).bells,2);
  await rt.enroll(hero,p.id);
  assert.equal(rt.clock(p.id,p.clocks[0]).bells,2);
  assert.equal(rt.resource(hero,p,p.tracks[0]).value,20,'current expedition bells apply to newly enrolled characters');
});
test('resetPack removes all actor enrollments and clock state',async()=>{
  const {rt,hero,actors}=setup(),p=read('abyssal-erosion');
  const second=new hero.constructor('Second PC');actors.push(second);
  await rt.savePack(p);await rt.setEnabled(p.id,true);
  await rt.enroll(hero,p.id);await rt.enroll(second,p.id);
  await rt.advanceClock(p.id,'severance',600);
  await rt.resetPack(p.id);
  assert.equal(rt.state(hero,p.id),null);
  assert.equal(rt.state(second,p.id),null);
  assert.equal(rt.managedItems(hero).length,0);
  assert.equal(rt.managedItems(second).length,0);
  assert.equal(rt.clock(p.id,p.clocks[0]).bells,0);
});
test('silent Foundry item deletion failure is caught and enrollment remains',async()=>{
  const {rt,hero}=setup(),p=read('abyssal-erosion');
  await rt.savePack(p);await rt.setEnabled(p.id,true);await rt.enroll(hero,p.id);
  await rt.adjust(hero,p.id,'identity',-5);
  const item=rt.managedItems(hero)[0];const original=item.delete.bind(item);
  item.delete=async()=>undefined;
  await assert.rejects(()=>rt.unEnroll(hero,p.id),/Failed to delete/);
  assert.equal(rt.enrolled(hero,p.id),true);
  item.delete=original;
  await rt.unEnroll(hero,p.id);
  assert.equal(rt.enrolled(hero,p.id),false);
});
test('only the GM may unenroll; a missing actor is rejected',async()=>{
  const {rt,hero}=setup(),p=read('abyssal-erosion');
  await rt.savePack(p);await rt.setEnabled(p.id,true);await rt.enroll(hero,p.id);
  game.user={id:'player1',isGM:false};
  await assert.rejects(()=>rt.unEnroll(hero,p.id),/Only the GM/);
  assert.equal(rt.enrolled(hero,p.id),true);
  game.user={id:'gm1',isGM:true};
  await assert.rejects(()=>rt.unEnroll(null,p.id),/valid character/);
});
test('failed actor flag persistence reconstructs effects from unchanged enrollment',async()=>{
  const {rt,hero}=setup(),p=read('abyssal-erosion');
  await rt.savePack(p);await rt.setEnabled(p.id,true);await rt.enroll(hero,p.id);
  await rt.adjust(hero,p.id,'identity',-5);
  const original=hero.setFlag.bind(hero);
  hero.setFlag=async()=>{throw Error('Actor update rejected');};
  await assert.rejects(()=>rt.unEnroll(hero,p.id),/Actor update rejected/);
  assert.equal(rt.enrolled(hero,p.id),true);
  assert.equal(rt.managedItems(hero).length,1,'automatic rollback restores managed effects');
  hero.setFlag=original;
  await rt.unEnroll(hero,p.id);
});
