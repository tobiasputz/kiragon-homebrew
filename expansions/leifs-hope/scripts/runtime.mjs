import { freshState, getContestRow, contestScore, nextContestRound, reconcile, advanceVP } from './rules.mjs';
const SCOPE = 'kiragon-homebrew';
const STATE_KEY = 'leifsHopeState';
const ENTRY_KEY = 'leifsHopeKind';
const BASE = 'modules/kiragon-homebrew/expansions/leifs-hope';
const UI = () => foundry.applications.api.DialogV2;
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function assertGM() {
  if (!game.user?.isGM) throw new Error('Only a GM can change the Kiragon Abyss encounter state.');
}
function stateJournal() {
  const entry = game.journal.find(j => j.getFlag(SCOPE, ENTRY_KEY) === 'state');
  if (!entry) throw new Error('Abyss encounter state journal is missing. Run the Kiragon — Install Leif’s Hope macro first.');
  return entry;
}
async function getState() {
  const entry = stateJournal();
  return [entry, foundry.utils.deepClone(entry.getFlag(SCOPE, STATE_KEY) ?? freshState())];
}
async function putState(entry, state) { await entry.setFlag(SCOPE, STATE_KEY, state); }
function characters() {
  const all = game.actors.contents.filter(a => a.type === 'character' && (a.hasPlayerOwner || a.getFlag(SCOPE,'packs')?.['abyssal-erosion']));
  return all.length ? all : game.actors.contents.filter(a => a.type === 'character');
}
function kiragon() {
  const mod = game.modules.get(SCOPE);
  if (!mod?.active || !mod.api?.adjust) throw new Error('Kiragon Homebrew is not enabled, or its api.adjust() method is unavailable. No Erosion has been changed.');
  return mod.api;
}
async function getBoons() {
  const r = await fetch(`${BASE}/data/boons.json`, {cache: 'no-store'});
  if (!r.ok) throw new Error('Could not load the expansion boon definitions. Check file placement.');
  return await r.json();
}
async function grantBoon(actor, emotion) {
  const existing = actor.items.find(i => i.getFlag(SCOPE, 'leifsHopeBoon') === emotion || i.name === (emotion === 'joy' ? 'Gift of Joy (Abyss)' : 'Gift of Anger (Abyss)'));
  if (existing) return existing;
  const world = game.items.find(i => i.getFlag(SCOPE, 'leifsHopeBoon') === emotion);
  const defs = await getBoons();
  const src = world ? world.toObject() : defs.find(d=>d.id === emotion);
  if (!src) throw new Error('Boon source missing: ' + emotion);
  const doc = foundry.utils.deepClone(src);
  delete doc._id; delete doc.folder; delete doc.ownership; delete doc._stats; delete doc.id;
  doc.flags = {...(doc.flags ?? {}), [SCOPE]: {...(doc.flags?.[SCOPE] ?? {}), leifsHopeBoon: emotion}};
  const created = await actor.createEmbeddedDocuments('Item', [doc]);
  if (!created?.length) throw new Error('Foundry did not create the gift Item on the PC.');
  return created[0];
}
async function reconcilePrize(entry, state, actor) {
  const row = getContestRow(state.competition, actor.id);
  if (!row.winner) return;
  if (!row.erosionApplied) {
    // Persist the attempt before and after calling the existing Kiragon Erosion API.
    const api = kiragon();
    const result = await api.adjust(actor, 'abyssal-erosion', 'identity', -1, `Contest of Feelings: 5 ${row.winner}`);
    if (result === false) throw new Error('Kiragon rejected the Erosion adjustment. Check enrollment and active pack.');
    row.erosionApplied = true;
    await putState(entry,state);
  }
  if (!row.boonGranted) {
    await grantBoon(actor,row.winner);
    row.boonGranted = true;
    await putState(entry,state);
  }
}
function contestRows(state) {
  const actors=characters();
  const rows=actors.map(a => {
    const r=getContestRow(state.competition,a.id);
    const result=r.winner ? (r.winner==='joy'?'☀ Joy':'🔥 Anger') : '—';
    return `<tr><td>${escape(a.name)}</td><td>${r.joy}/5</td><td>${r.anger}/5</td><td>${result}${r.winner && (!r.erosionApplied || !r.boonGranted) ? ' ⚠ PENDING' : ''}</td></tr>`;
  }).join('');
  const choices=actors.map(a=>`<option value="${escape(a.id)}">${escape(a.name)}</option>`).join('');
  return {rows,choices};
}
export async function openCompetition() {
  assertGM();
  const [entry,state] = await getState();
  const c=state.competition;
  const {rows,choices}=contestRows(state);
  const active=c.status === 'active';
  const content=`<div style="min-width:530px;max-width:680px"><h2>The Contest of Feelings</h2>
  <p><b>Round ${c.round}/5</b> · <b>Status:</b> ${escape(c.status)} · <b>Reconciliation:</b> Joy ${c.reconciliation.joy}/3, Anger ${c.reconciliation.anger}/3</p>
  <table><thead><tr><th>PC</th><th>Happiness</th><th>Anger</th><th>Outcome</th></tr></thead><tbody>${rows}</tbody></table>
  <p><small>First 5 in either = 1 Erosion via your existing Kiragon pack + permanent Gift of Joy/Anger. Neither by the end = nothing. Existing stopwatch remains unchanged.</small></p>
  <div class="form-group"><label>Character</label><select name="pc">${choices}</select></div>
  <div class="form-group"><label>Emotion</label><select name="emotion"><option value="joy">Happiness</option><option value="anger">Anger</option></select></div>
  <div class="form-group"><label>Point change</label><select name="delta"><option value="1">+1 (failed save / hit)</option><option value="2">+2 (critical)</option><option value="-1">-1 (correction)</option><option value="-2">-2 (correction)</option></select></div>
  <div class="form-group"><label>Reconcile with</label><select name="reconcile"><option value="joy">Joy</option><option value="anger">Anger</option></select></div>
  <p><small>Each reconciliation check: +1 success / +2 crit success; critical failure -1 via correction. Both need 3. Every emotion disperses at 0 HP and reforms; nothing dies.</small></p></div>`;
  const btn=(action,label,callback)=>({action,label,callback});
  const buttons=[
    ...(active?[btn('apply','Apply Points',(ev,b)=>({op:'apply',actorId:b.form.elements.pc.value,emotion:b.form.elements.emotion.value,delta:Number(b.form.elements.delta.value)})),
      btn('reconcile','Reconcile +1',(ev,b)=>({op:'reconcile',emotion:b.form.elements.reconcile.value,delta:1})),
      btn('reconcilecrit','Reconcile +2',(ev,b)=>({op:'reconcile',emotion:b.form.elements.reconcile.value,delta:2})),
      btn('next','Next Round',()=>({op:'next'}))]:[]),
    btn('repair','Repair Pending Gifts',()=>({op:'repair'})),
    btn('close','Close',()=>null)
  ];
  const response = await UI().wait({window:{title:'Kiragon — Joy vs Anger'},content,buttons,rejectClose:false});
  if (!response) return;
  try {
    if(response.op === 'apply') {
      const actor=game.actors.get(response.actorId); if(!actor || actor.type!=='character') throw new Error('Select a player character');
      const updated=contestScore(c,actor.id,response.emotion,response.delta);
      await putState(entry,state);
      if(updated.threshold) {
        try {await reconcilePrize(entry,state,actor);} catch(e) {ui.notifications.error(`Threshold reached, reward pending: ${e.message}`);}
      } else if(!updated.changed) ui.notifications.warn(updated.reason || 'No change');
    } else if(response.op === 'reconcile') { reconcile(c,response.emotion,response.delta); await putState(entry,state); }
    else if(response.op === 'next') {nextContestRound(c); await putState(entry,state);}
    else if(response.op === 'repair') {
      for(const [id,row] of Object.entries(c.scores)) if(row.winner && (!row.erosionApplied || !row.boonGranted)){
        const actor=game.actors.get(id);
        if (actor) {try{await reconcilePrize(entry,state,actor);}catch(e){ui.notifications.error(`${actor.name}: ${e.message}`);}}
      }
    }
  } catch(e) {ui.notifications.error(e.message); console.error('Kiragon Leifs Hope contest',e);}
  return openCompetition();
}
export async function openProgress(section) {
  assertGM();
  if(!['footsteps','grief','boss'].includes(section)) throw new Error('Unsupported encounter');
  const [entry,state]=await getState();
  const data=state[section], cap={footsteps:3,grief:3,boss:6}[section];
  const title={footsteps:'Footsteps — Chase',grief:'Grief — Comfort',boss:'Leif’s Hope — Final Boss'}[section];
  const stages=['Fear of Failure','Fear of Pain','Fear of Trying Again'];
  const stage=section==='boss'?stages[Math.min(2,Math.floor(data.vp/2))]:null;
  const content=`<div style="min-width:420px"><h2>${escape(title)}</h2><h1>${data.vp}/${cap} Victory Points</h1>
    ${stage?`<p><b>Current barrier:</b> ${escape(stage)} · Stage ${Math.min(3,Math.floor(data.vp/2)+1)}/3</p><p>GM: two-action rescue attempt, DC 31 normally (select DC 33 for harder approaches). Only the current two-point barrier may lose VP. Resignation cannot be killed: 0 HP suppresses it for one round.</p>`:''}
    ${section==='footsteps'?`<p>Rounds: ${data.rounds}/3. DC 31; Survival DC 33. On failure after 3 rounds: DC 31 Will saves (failure frightened 1, crit fail frightened 2).</p>`:''}
    ${section==='grief'?'<p>Comfort with Diplomacy, Medicine, Religion or Occultism DC 31. Violence only disperses Grief; it cannot die.</p>':''}
    ${section==='boss'?`<p><b>Fractured Certainty:</b> ${state.boss.fracture?'ACTIVE — next check +2, no boss reactions':'Inactive'} (toggle when 60 cumulative damage in a round).</p>`:''}
    <p><small>Critical success +2; success +1; failure 0; critical failure -1. A personal appeal may score +1 without a roll if the GM decides.</small></p></div>`;
  const btn=(action,label,value)=>({action,label,callback:()=>value});
  const buttons=[btn('crit','Critical Success +2',{op:'vp',delta:2}),btn('success','Success +1',{op:'vp',delta:1}),btn('fail','Critical Failure −1',{op:'vp',delta:-1}),
    ...(section==='footsteps'?[btn('round','Next Round',{op:'round'})]:[]),
    ...(section==='boss'?[btn('fracture','Toggle Fracture',{op:'fracture'})]:[]),btn('close','Close',null)];
  const result=await UI().wait({window:{title:'Kiragon — '+title},content,buttons,rejectClose:false});
  if(!result) return;
  if(result.op==='vp') {advanceVP(state,section,result.delta);if(section==='boss'&&state.boss.fracture&&result.delta>0) state.boss.fracture=false;}
  if(result.op==='round') state.footsteps.rounds=Math.min(3,state.footsteps.rounds+1);
  if(result.op==='fracture') state.boss.fracture=!state.boss.fracture;
  await putState(entry,state);
  if(section==='boss'&&state.boss.resolved) ui.notifications.info('Leif’s Hope can stand and return willingly. Resignation lives on, but releases its hold.');
  if(section==='grief'&&state.grief.vp===3) ui.notifications.info('Grief accepts the party’s comfort and may accompany them.');
  return openProgress(section);
}
export async function openFour() {
  assertGM();
  const [entry,state]=await getState();
  const keys=['fear','shame','love','anger'];
  const content=`<h2>The Four Who Are One</h2><p>All four figures are authentic fragments of Leif. Recognize each emotion; none can die.</p>
  ${keys.map(k=>`<p><b>${escape(k.toUpperCase())}</b>: ${state.four[k]?'✔ Accepted':'○ Not yet accepted'}</p>`).join('')}
  <label>Fragment</label><select name="fragment">${keys.map(k=>`<option value="${k}">${escape(k)}</option>`).join('')}</select>`;
  const res=await UI().wait({window:{title:'Kiragon — The Four Who Are One'},content,buttons:[
    {action:'accept',label:'Accept Fragment',callback:(e,b)=>({op:'set',key:b.form.elements.fragment.value,value:true})},
    {action:'undo',label:'Undo',callback:(e,b)=>({op:'set',key:b.form.elements.fragment.value,value:false})},
    {action:'close',label:'Close',callback:()=>null}],rejectClose:false});
  if(!res) return;
  state.four[res.key]=res.value;
  await putState(entry,state);
  if(keys.every(k=>state.four[k])) ui.notifications.info('All four fragments recognized. Proceed toward Leif’s Hope.');
  return openFour();
}
export async function openJournal() {
  assertGM();
  const j=game.journal.find(x=>x.getFlag(SCOPE,ENTRY_KEY)==='encounter'&&x.getFlag(SCOPE,'leifsHopeId')==='footsteps');
  if(j) j.sheet.render(true); else ui.notifications.warn('No encounter journals yet. Run the installer.');
}
export async function reset() {
  assertGM();
  const yes = await UI().confirm({window:{title:'Reset Leif’s Hope encounter trackers'},content:'<p>Reset competition counters, all encounter VP, and Four fragments? This will <b>not</b> restore lost Erosion Will and will <b>not</b> remove earned permanent gifts.</p>',rejectClose:false});
  if(!yes) return;
  const [entry]=await getState();
  await putState(entry,freshState());
  ui.notifications.info('Leif’s Hope tracker reset. Kiragon Erosion state and earned gifts were left untouched.');
}
export async function openKiragon() {
  const api=game.modules.get('kiragon-homebrew')?.api;
  if(!api?.open) throw new Error('The original Kiragon module is not active.');
  return api.open();
}

export async function reformEmotion() {
  assertGM();
  const selected=canvas?.tokens?.controlled ?? [];
  if (!selected.length) throw new Error('Select an Abyss emotion token first.');
  let count=0;
  for (const token of selected) {
    const actor=token.actor;
    if (!actor || !actor.getFlag(SCOPE,'leifsHopeActor')) continue;
    const hp=actor.system.attributes?.hp;
    if (!hp || hp.value>0) continue;
    const kind=actor.getFlag(SCOPE,'leifsHopeActor');
    await actor.update({'system.attributes.hp.value':kind==='resignation'?hp.max:1});
    count++;
  }
  ui.notifications.info(`${count} emotion(s) reformed. No emotion was permanently killed.`);
}
