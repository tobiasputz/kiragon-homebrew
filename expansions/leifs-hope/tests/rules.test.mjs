import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState, getContestRow, contestScore, nextContestRound, reconcile, advanceVP} from '../scripts/rules.mjs';
test('first emotion to five locks that PC into one gift',()=>{
 const c=freshState().competition;
 for (let i=0;i<4;i++) contestScore(c,'pc1','joy',1);
 contestScore(c,'pc1','anger',2);
 assert.deepEqual(contestScore(c,'pc1','joy',2),{changed:true,winner:'joy',threshold:true});
 assert.equal(c.scores.pc1.joy,5);
 assert.equal(c.scores.pc1.anger,2);
 assert.equal(contestScore(c,'pc1','anger',2).changed,false);
 assert.equal(c.scores.pc1.anger,2);
});
test('five-round contest ends; no threshold grants no reward',()=>{
 const c=freshState().competition;
 contestScore(c,'pc2','anger',2);contestScore(c,'pc2','anger',2);contestScore(c,'pc2','joy',2);contestScore(c,'pc2','joy',2);
 for(let n=0;n<5;n++) nextContestRound(c);
 assert.equal(c.status,'ended');assert.equal(c.round,5);
 assert.equal(c.scores.pc2.winner,null);
 assert.equal(contestScore(c,'pc2','anger',1).changed,false);
});
test('reconciliation of both emotions ends competition early',()=>{
 const c=freshState().competition;
 reconcile(c,'joy',2);reconcile(c,'joy',2);assert.equal(c.reconciliation.joy,3);
 reconcile(c,'anger',1);assert.equal(c.status,'active');
 reconcile(c,'anger',2);assert.equal(c.status,'reconciled');
});
test('VP scores clip to per-barrier 2 points; stages cannot be lost',()=>{
 const s=freshState();
 assert.equal(advanceVP(s,'boss',2),2);
 assert.equal(advanceVP(s,'boss',-1),2);
 assert.equal(advanceVP(s,'boss',2),4);
 assert.equal(advanceVP(s,'boss',2),6);
 assert.equal(s.boss.resolved,true);
});
test('chase and grief track independent VP',()=>{
 const s=freshState();advanceVP(s,'footsteps',2);advanceVP(s,'footsteps',2);
 assert.equal(s.footsteps.vp,3);assert.equal(s.grief.vp,0);
 advanceVP(s,'grief',2);advanceVP(s,'grief',-1);assert.equal(s.grief.vp,1);
});
test('score is clamped to zero and max five',()=>{
 const c=freshState().competition;getContestRow(c,'p');contestScore(c,'p','joy',-2);assert.equal(c.scores.p.joy,0);
 for (let i=0;i<3;i++) contestScore(c,'p','joy',2);
 assert.equal(c.scores.p.joy,5);
});
