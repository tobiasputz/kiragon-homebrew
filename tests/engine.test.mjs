import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validatePack, newActorPack, newClock, remaining, tierData, timeLoss, adjustResource, countedBells, secondsRemaining, applyRupture, outcomeLoss, effectValue } from '../scripts/engine.mjs';
const p=validatePack(JSON.parse(fs.readFileSync(new URL('../packs/abyssal-erosion.json',import.meta.url))));
const ex=validatePack(JSON.parse(fs.readFileSync(new URL('../packs/fate-scars-example.json',import.meta.url))));
const t=p.tracks[0],c=p.clocks[0];
const view=(bells)=>({...newClock(c),bells,totalBells:c.bells});
test('builtins validate; import format is engine-wide not Abyss-specific',()=>{
  assert.equal(p.id,'abyssal-erosion');assert.equal(p.adversaries.length,3);assert.equal(ex.tracks[0].initial,8);
  assert.deepEqual(p.adversaries.map(a=>a.actor.system.details.level.value),[12,13,14]);
  assert.deepEqual(p.adversaries.flatMap(a=>a.abilities.map(b=>b.kind)),['save','save','skill-vs-perception']);
});
test('fractional clock advances and reaches 0 exactly at deadline',()=>{
  const s=newActorPack(p,{identity:22},'str').tracks.identity;
  assert.equal(remaining(t,s,view(0)),22);
  assert.equal(remaining(t,s,view(3)),15);
  assert.equal(timeLoss(t,s,view(9)),22);
  assert.equal(remaining(t,s,view(9)),0);
  assert.equal(remaining(t,{...s,restored:50},view(9)),0,'last bell is absolute even with restoration');
});
test('power tiers polarize as Will erodes; cannot regain it by taking more Erosion',()=>{
  const s=newActorPack(p,{identity:20},'wis').tracks.identity;
  assert.deepEqual([0,5,10,15,19].map(n=>tierData(t,{...s,spent:n},view(0)).power),[0,1,2,3,3]);
  assert.equal(tierData(t,{...s,spent:20},view(0)).power,0);
  assert.equal(tierData(t,{...s,spent:16,surrenderedPower:1},view(0)).power,2);
});
test('actions modify resource, recover, and obey cap',()=>{
  const s=newActorPack(p,{identity:16},'int').tracks.identity;
  const drained=adjustResource(t,s,view(0),-3);
  assert.equal(remaining(t,drained,view(0)),13);
  const restored=adjustResource(t,drained,view(0),2);
  assert.equal(remaining(t,restored,view(0)),15);
  assert.equal(remaining(t,adjustResource(t,s,view(0),500),view(0)),16);
  assert.equal(adjustResource(t,s,view(0),-16).lost,true);
});
test('once an external clock has finished, no additional recovery reverses deadline',()=>{
  const t2=ex.tracks[0],c2={...newClock(ex.clocks[0]),bells:4,totalBells:4};
  const state=newActorPack(ex,{fate:8},'cha').tracks.fate;
  assert.equal(remaining(t2,state,c2),4,'partial drain pack survives the clock');
});
test('clock uses elapsed real time, including catch-up',()=>{
  const cstate={...newClock(c),running:true,deadlineMs:300000,remainingSec:5400};
  assert.equal(secondsRemaining(cstate,0),300);
  assert.equal(countedBells(cstate,c,0),8);
  assert.equal(countedBells(cstate,c,400000),9);
});
test('rupture costs and monster save outcomes',()=>{
  const s={...newActorPack(p,{identity:20}).tracks.identity,spent:16};
  assert.equal(applyRupture(t,s,view(0),p.actions.find(a=>a.id==='rupture-resist')),3);
  const abilities=p.adversaries.map(a=>a.abilities[0]);
  assert.deepEqual(abilities.map(b=>outcomeLoss(b,0)),[2,2,0]);
  assert.equal(outcomeLoss(abilities[2],3),2);
  assert.equal(outcomeLoss(abilities[2],2),1);
  assert.equal(effectValue(t.effects[0],t,s,view(0)),-16);
});
test('validator rejects executable/unsafe or broken packs',()=>{
  for(const action of ['arbitrary-javascript','eval','script']){
    const invalid=structuredClone(p);invalid.actions[0].kind=action;
    assert.throws(()=>validatePack(invalid));
  }
  const duplicated=structuredClone(p);duplicated.tracks.push({...duplicated.tracks[0]});assert.throws(()=>validatePack(duplicated));
  const missing=structuredClone(p);missing.actions[0].track='fake';assert.throws(()=>validatePack(missing));
});
