import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {KiragonRuntime} from '../scripts/runtime.mjs';
const read=(id)=>JSON.parse(fs.readFileSync(new URL(`../packs/${id}.json`,import.meta.url)));
function setup(){
  const settings=new Map(),actors=[];const messages=[];
  globalThis.game={user:{id:'gm1',isGM:true},users:[{id:'gm1',isGM:true,active:true}],items:{contents:[]},actors:{contents:actors},combats:{contents:[]},combat:null,settings:{get:(m,k)=>structuredClone(settings.get(`${m}.${k}`)??({packs:[],enabled:[],clockStates:{}}[k])),set:async(m,k,value)=>{settings.set(`${m}.${k}`,structuredClone(value));}}};
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
    constructor(name,type='character',raw=null){this.id=`actor${next++}`;this.name=name;this.type=type;this._flags=structuredClone(raw?.flags??{});this.items=(raw?.items??[]).map(it=>new FakeItem(this,it));this.system=raw?.system??{details:{keyability:{value:'str'}},abilities:{str:{mod:5},dex:{mod:3},con:{mod:3},int:{mod:1},wis:{mod:2},cha:{mod:0}}};this.saves={will:{mod:22,roll:async()=>({degreeOfSuccess:0})},reflex:{roll:async()=>({degreeOfSuccess:0})},fortitude:{roll:async()=>({degreeOfSuccess:1})}};
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
test('manual clock advancement works while paused or running; final bell is absolute',async()=>{
  const {rt,hero}=setup(),p=read('abyssal-erosion');await rt.savePack(p);await rt.setEnabled(p.id,true);await rt.enroll(hero,p.id);
  await rt.startClock(p.id,'severance');await rt.pauseClock(p.id,'severance');
  await rt.advanceClock(p.id,'severance',600);assert.equal(rt.clock(p.id,p.clocks[0]).bells,1);
  await rt.advanceClock(p.id,'severance',4800);assert.equal(rt.clock(p.id,p.clocks[0]).bells,9);
  assert.equal(rt.resource(hero,p,p.tracks[0]).value,0);assert.equal(rt.state(hero,p.id).tracks.identity.lost,true);
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
