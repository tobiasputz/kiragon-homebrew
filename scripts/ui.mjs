import { MODULE_ID, ABILITIES, secondsRemaining, clone } from './engine.mjs';

const escapeHtml = v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmtTime = s=>`${String(Math.floor(Math.max(0,s)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,s)%60)).padStart(2,'0')}`;
const button=(label,act,attrs='',theme='',disabled=false)=>`<button type="button" data-action="${escapeHtml(act)}" ${attrs} class="${escapeHtml(theme)}" ${disabled?'disabled':''}>${escapeHtml(label)}</button>`;
const select=(items,current,attrs)=>`<select ${attrs}>${items.map(({value,label})=>`<option value="${escapeHtml(value)}" ${current===value?'selected':''}>${escapeHtml(label)}</option>`).join('')}</select>`;
let selectedPack=null,editorOpen=false,editorText='';
export function openDashboard(rt){
  const Base=foundry.applications?.api?.ApplicationV2;
  if(!Base)throw Error('Foundry v13 or newer is required.');
  if(!rt.dashboard){
    class KiragonDashboard extends Base{
      static DEFAULT_OPTIONS={id:'kiragon-homebrew-dashboard',window:{title:'Kiragon · Homebrew Engine',resizable:true},position:{width:980,height:780}};
      async _renderHTML(){return makePanel(rt);}
      _replaceHTML(result,content){content.replaceChildren(result);}
    }
    rt.dashboard=new KiragonDashboard();
  }
  rt.dashboard.render({force:true});
}
export function redraw(rt){if(rt.dashboard?.rendered)rt.dashboard.render({force:true});}
function renderActor(rt,actor,p){
  const state=rt.state(actor,p.id),isGM=rt.gm;
  if(!state)return `<div class="kg-actor"><div class="kg-line"><strong>${escapeHtml(actor.name)}</strong><span class="kg-subtle">Not enrolled</span>${isGM&&rt.isEnabled(p.id)?button('Enroll','enroll',`data-actor="${actor.id}"`):''}</div></div>`;
  const trackCards=p.tracks.map(t=>{
    const data=rt.resource(actor,p,t),theme=t.themes?.[state.key];const pct=Math.round(100*data.value/data.base);
    return `<div class="kg-track ${data.lost?'kg-lost':''}"><div class="kg-line"><b>${escapeHtml(t.label)}</b><span class="kg-resource">${data.value} / ${data.base}</span></div>
      <div class="kg-meter"><span style="width:${Math.max(0,Math.min(100,pct))}%"></span></div>
      <div class="kg-subtle">${escapeHtml(data.label)} · ${pct}% remaining · ${data.power>0?`+${data.power} key ability power · `:''}Spent ${data.spent}, restored ${data.restored}${data.lost?' · LOST':''}</div>
      ${theme?`<div class="kg-subtle">${escapeHtml(theme.name)} — Surge: ${escapeHtml(theme.surge)}; Crash: ${escapeHtml(theme.crash)}</div>`:''}
    </div>`;
  }).join('');
  const actions=isGM&&rt.isEnabled(p.id)?`<div class="kg-controls">${p.actions.map(a=>{
    const t=p.tracks.find(t=>t.id===a.track),data=rt.resource(actor,p,t),tag=rt.usageTag(a,p),used=tag&&state.uses?.[a.group??a.id]===tag;
    return button(a.label,'action',`data-actor="${actor.id}" data-id="${escapeHtml(a.id)}" title="${escapeHtml(a.description??'')}"`,a.kind==='rupture'||(a.kind==='adjust'&&a.amount<0)?'danger':'',used||data.lost||data.tier<(a.requiresTier??0));
  }).join('')}${button('Unenroll','unenroll',`data-actor="${actor.id}"`,'muted')}</div>`:'';
  return `<div class="kg-actor"><div class="kg-line"><h3>${escapeHtml(actor.name)}</h3><div class="kg-inline">Key ${isGM?select(ABILITIES.map(a=>({value:a,label:a.toUpperCase()})),state.key,`data-key="${actor.id}"`):escapeHtml(state.key.toUpperCase())}</div></div>
    <div class="kg-tracks">${trackCards}</div>${actions}</div>`;
}
function renderClock(rt,p,c){const st=rt.clock(p.id,c);const remaining=secondsRemaining(st);return `<div class="kg-clock"><div class="kg-line"><div><div class="kg-subtle">${escapeHtml(c.label.toUpperCase())}</div><div class="kg-timer" data-clock-time="${escapeHtml(c.id)}">${fmtTime(remaining)}</div></div><div><b>Bell ${st.bells}/${c.bells}</b><div class="kg-subtle">${st.running?'Running':st.combatPaused?'Paused during combat':'Paused'}</div></div></div>
  <div class="kg-meter"><span style="width:${Math.round(100*remaining/st.durationSec)}%"></span></div>
  ${rt.gm&&rt.isEnabled(p.id)?`<div class="kg-controls">
    ${button('Start / Resume','start',`data-id="${c.id}"`,'',st.running||remaining<=0)}
    ${button('Pause','pause',`data-id="${c.id}"`,'',!st.running)}
    ${button('−1 min','advance',`data-id="${c.id}" data-seconds="60"`)}
    ${button('−5 min','advance',`data-id="${c.id}" data-seconds="300"`)}
    ${button('−10 min','advance',`data-id="${c.id}" data-seconds="600"`)}
  </div>`:''}
  </div>`;}
function renderMonster(rt,p){if(!p.adversaries.length)return '<p class="kg-subtle">No NPCs defined in this pack. You can add adversaries to the JSON.</p>';
  const monsters=game.actors.contents.filter(a=>a.type==='npc'&&rt.getAdversary(p.id,a));
  const targets=game.actors.contents.filter(a=>a.type==='character'&&rt.enrolled(a,p.id));
  const opts=[];for(const monster of monsters){const def=rt.getAdversary(p.id,monster);for(const a of def.abilities)opts.push({value:`${monster.id}:${a.id}`,label:`${monster.name} — ${a.label}`});}
  return `<div class="kg-card"><p class="kg-subtle">Signature abilities use PF2e statistics and reduce a custom resource instead of HP. Other NPC attacks stay on their normal PF2e sheets.</p>
  <div class="kg-controls">${rt.gm?button('Import NPCs','import-npcs'):''}
  ${rt.gm&&opts.length&&targets.length?`${select(opts,opts[0].value,'data-attack-choice')}${select(targets.map(a=>({value:a.id,label:a.name})),targets[0].id,'data-attack-target')}${button('Resolve Erosion ability','attack','','danger')}`:''}</div>
  ${!monsters.length?'<p class="kg-subtle">Import this pack’s NPCs to use their signature attacks.</p>':''}</div>`;
}
function makePanel(rt){
  const all=rt.packs();if(!all.some(p=>p.id===selectedPack))selectedPack=rt.enabled().find(id=>all.some(p=>p.id===id))??all[0]?.id??null;
  const p=rt.pack(selectedPack),gm=rt.gm;rt.dashboardPackId=selectedPack;
  const outer=document.createElement('div');outer.className='kiragon-panel';
  outer.innerHTML=`<header class="kg-header"><div><div class="kg-kicker">KIRAGON · WORLDBUILDING TOOLS</div><h1>Homebrew Engine</h1></div><div class="kg-tag">PF2e · Modular</div></header>
    ${all.length?`<div class="kg-toolbar"><label>Mechanic pack ${select(all.map(x=>({value:x.id,label:x.name})),selectedPack,'data-pack-select')}</label><span class="kg-subtle">${escapeHtml(p?.version??'')}</span>${gm&&p?button(rt.isEnabled(p.id)?'Disable pack':'Enable pack','toggle-pack',`data-id="${escapeHtml(p.id)}"`):''}</div>`:'<p>No mechanic packs installed yet. Import a pack to get started.</p>'}
    ${p?`<p class="kg-description">${escapeHtml(p.description??'No description')}</p>${!rt.isEnabled(p.id)?'<div class="kg-warning">This pack is disabled. Enable it to enroll characters and run its clocks. Existing sheet effects are removed while disabled.</div>':''}
      <section><h2>Clocks</h2>${p.clocks.length?p.clocks.map(c=>renderClock(rt,p,c)).join(''):'<p class="kg-subtle">This pack has no clocks.</p>'}</section>
      <section><h2>Character resources</h2>${game.actors.contents.filter(a=>a.type==='character').map(a=>renderActor(rt,a,p)).join('')||'<p>No player character actors found.</p>'}</section>
      <section><h2>Adversaries</h2>${renderMonster(rt,p)}</section>
      <section><h2>PF2e World Items</h2><div class="kg-card"><p class="kg-subtle">${(p.items??[]).length} item templates (feats, effects, spells, equipment or other PF2e item documents).</p>${gm?button('Import pack items','import-items','','',!(p.items?.length)):''}</div></section>`:''}
    <section class="kg-tools"><h2>Pack Library &amp; JSON Editor</h2>
      <p class="kg-subtle">Import any compatible JSON pack. Your definitions are saved in this world. No scripts from imported packs are executed.</p>
      ${gm?`<div class="kg-controls">${button('Import JSON file','import-file')}${button('Edit selected pack','edit-pack','','',!p)}${button('New from example','new-pack')}${button('Export pack','export-pack','','',!p)}${button('Validate & Save JSON','save-json')}</div>
        <input data-file-picker type="file" accept=".json,application/json" hidden>
        <details data-editor ${editorOpen?'open':''}><summary>Pack JSON (editable)</summary><textarea data-json-editor rows="15" spellcheck="false" placeholder="Paste a Kiragon pack JSON here or click Edit selected pack">${escapeHtml(editorText)}</textarea><div class="kg-subtle">Saving an existing pack replaces its definition. Back up or export it first. Pack ids, track ids and clock ids should remain stable.</div></details>
        <div class="kg-controls">${button('Reset this pack: remove actor states and clocks','reset-pack','','danger',!p)}${button('Import old Abyssal Erosion character states','migrate','','',!p||p.id!=='abyssal-erosion')}${button('Delete selected pack','delete-pack','','danger',!p)}</div>`:
        '<p class="kg-subtle">Only the GM can install, edit or run mechanic packs.</p>'}
    </section>`;
  const run=async fn=>{try{await fn();}catch(e){console.error(MODULE_ID,e);ui.notifications.error(e.message||String(e));}finally{redraw(rt);}};
  outer.querySelector('[data-pack-select]')?.addEventListener('change',e=>{selectedPack=e.currentTarget.value;redraw(rt);});
  outer.querySelectorAll('[data-key]').forEach(node=>node.addEventListener('change',()=>run(()=>rt.changeKey(game.actors.get(node.dataset.key),p.id,node.value))));
  outer.querySelector('[data-editor]')?.addEventListener('toggle',e=>{editorOpen=e.target.open;});
  outer.querySelector('[data-json-editor]')?.addEventListener('input',e=>{editorText=e.target.value;});
  outer.querySelector('[data-file-picker]')?.addEventListener('change',e=>run(async()=>{
    const file=e.currentTarget.files[0];if(!file)return;if(file.size>2_000_000)throw Error('Pack file exceeds 2 MB limit.');const obj=JSON.parse(await file.text());const exists=!!rt.pack(obj.id);if(exists&&!(await confirm(`Replace existing pack ${obj.id}? Actor state and track ids will be retained.`)))return;await rt.savePack(obj,{replace:exists});selectedPack=obj.id;ui.notifications.info(`Imported ${obj.name}`);
  }));
  outer.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.action==='import-file'){outer.querySelector('[data-file-picker]').click();return;}run(async()=>{
    const act=btn.dataset.action;btn.disabled=true;const actor=game.actors.get(btn.dataset.actor);
    switch(act){
      case 'enroll':await rt.enroll(actor,p.id);break;
      case 'unenroll':if(await confirm(`Unenroll ${actor.name} from ${p.name}? This clears their ${p.name} state and managed effects.`))await rt.unEnroll(actor,p.id);break;
      case 'action':await rt.useAction(actor,p.id,btn.dataset.id);break;
      case 'toggle-pack':await rt.setEnabled(p.id,!rt.isEnabled(p.id));break;
      case 'start':await rt.startClock(p.id,btn.dataset.id);break;
      case 'pause':await rt.pauseClock(p.id,btn.dataset.id);break;
      case 'advance':await rt.advanceClock(p.id,btn.dataset.id,Number(btn.dataset.seconds));break;
      case 'import-npcs':await rt.importAdversaries(p.id);break;
      case 'import-items':await rt.importItems(p.id);break;
      case 'attack':{
        const [id,ability]=outer.querySelector('[data-attack-choice]').value.split(':');const monster=game.actors.get(id);const target=game.actors.get(outer.querySelector('[data-attack-target]').value);await rt.attack(p.id,monster,target,ability);break;}
      case 'import-file':outer.querySelector('[data-file-picker]').click();return;
      case 'edit-pack':{
        editorOpen=true;const details=outer.querySelector('[data-editor]');details.open=true;editorText=JSON.stringify(p,null,2);outer.querySelector('[data-json-editor]').value=editorText;ui.notifications.info('Pack loaded into editor. Save or export a backup before changing ids.');return;}
      case 'new-pack':{
        editorOpen=true;const details=outer.querySelector('[data-editor]');details.open=true;const example=clone(rt.pack('fate-scars-example')??p);example.id='new-kiragon-mechanic';example.name='My New Kiragon Mechanic';example.version='0.1.0';example.adversaries=[];editorText=JSON.stringify(example,null,2);outer.querySelector('[data-json-editor]').value=editorText;return;}
      case 'save-json':{
        const txt=editorText;if(!txt.trim())throw Error('Paste or load a pack JSON into the editor first.');if(txt.length>2_000_000)throw Error('JSON exceeds 2MB limit.');const obj=JSON.parse(txt);const exists=!!rt.pack(obj.id);if(exists&&!(await confirm(`Overwrite ${obj.id} with this JSON?`)))return;await rt.savePack(obj,{replace:exists});selectedPack=obj.id;await rt.syncAll();ui.notifications.info(`Saved pack ${obj.name}`);break;}
      case 'export-pack':{
        const blob=new Blob([JSON.stringify(p,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${p.id}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);return;}
      case 'reset-pack':if(await confirm(`Reset ALL ${p.name} character state and clocks? This cannot be undone.`))await rt.resetPack(p.id);break;
      case 'delete-pack':if(await confirm(`Delete ${p.name} from this world's library? Export a backup first.`)){await rt.deletePack(p.id);selectedPack=null;}break;
      case 'migrate':if(await confirm('Migrate old Abyssal Erosion character state? Old managed effects are deleted. Turn OFF the old module first. Clock state is not migrated.'))await rt.migrateLegacyAbyss();break;
    }
  });}));
  return outer;
}
async function confirm(message){return foundry.applications.api.DialogV2.confirm({window:{title:'Kiragon Homebrew Engine'},content:`<p>${escapeHtml(message)}</p>`});}
