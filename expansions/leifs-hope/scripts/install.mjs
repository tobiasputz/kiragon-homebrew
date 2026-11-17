import { freshState } from './rules.mjs';
const SCOPE = 'kiragon-homebrew';
const KEY = 'leifsHopeKind';
const BASE = 'modules/kiragon-homebrew/expansions/leifs-hope';
async function load(filename) {
 const r = await fetch(`${BASE}/data/${filename}`,{cache:'no-store'});
 if(!r.ok) throw new Error(`Cannot fetch ${filename} (${r.status}). Check file location under Data/modules/kiragon-homebrew/expansions/leifs-hope.`);
 return await r.json();
}
async function folder(name,type){
 let f=game.folders.find(x=>x.type===type && x.name===name);
 return f ?? await Folder.create({name,type,color:'#222b36',sorting:'a'});
}
export async function install() {
 if(!game.user?.isGM) throw new Error('Run this installer as a GM.');
 if(game.system?.id !== 'pf2e') throw new Error('This expansion is for the Pathfinder 2e system.');
 if(!game.modules.get(SCOPE)?.active) throw new Error('Enable the existing Kiragon Homebrew module first.');
 const [actorSources, entries, boons] = await Promise.all([load('actors.json'),load('encounters.json'),load('boons.json')]);
 const af=await folder('Kiragon — Abyss: Leif’s Hope','Actor');
 const jf=await folder('Kiragon — Abyss: Leif’s Hope','JournalEntry');
 const itf=await folder('Kiragon — Abyss: Leif’s Hope','Item');
 const result={actors:0,journals:0,items:0,macros:0,existing:0};
 for(const entry of actorSources){
  const match=game.actors.find(a=>a.getFlag(SCOPE,'leifsHopeActor')===entry.slug);
  if(match){result.existing++;continue;}
  const doc=foundry.utils.deepClone(entry.actor);
  doc.folder=af.id; doc.flags={...(doc.flags??{}),[SCOPE]:{leifsHopeActor:entry.slug}};
  await Actor.create(doc);
  result.actors++;
 }
 for(const entry of entries){
  const match=game.journal.find(j=>j.getFlag(SCOPE,KEY)==='encounter'&&j.getFlag(SCOPE,'leifsHopeId')===entry.id);
  if(match){result.existing++;continue;}
  await JournalEntry.create({name:entry.title,folder:jf.id,flags:{[SCOPE]:{[KEY]:'encounter',leifsHopeId:entry.id}},pages:[
    {name:'GM Guide & Read-Aloud',type:'text',text:{format:1,content:`${entry.portrait?`<figure><img style="max-height:380px;object-fit:contain" src="${entry.portrait}"></figure>`:""}${entry.html}`}}
  ]});result.journals++;
 }
 if(!game.journal.find(j=>j.getFlag(SCOPE,KEY)==='state')){
  await JournalEntry.create({name:'Kiragon — Leif’s Hope: Encounter State (GM Only)',folder:jf.id,flags:{[SCOPE]:{[KEY]:'state',leifsHopeState:freshState()}},pages:[{name:'Saved Tracker State',type:'text',text:{format:1,content:'<p>Keep this journal. It stores the encounter counters in Foundry world flags, independently of the Kiragon Erosion stopwatch. All scoring macros use this journal; do not delete it mid-session.</p>'}}]});result.journals++;
 }
 for(const b of boons){
  if(game.items.find(i=>i.getFlag(SCOPE,'leifsHopeBoon')===b.id)){result.existing++;continue;}
  const doc=foundry.utils.deepClone(b);delete doc.id;
  doc.folder=itf.id;doc.flags={[SCOPE]:{leifsHopeBoon:b.id}};
  await Item.create(doc);result.items++;
 }
 const macros=[
  ['Kiragon — Install Leif’s Hope','install','scripts/install.mjs','install'],
  ['Kiragon — Open Erosion Dashboard','erosion','scripts/runtime.mjs','openKiragon'],
  ['Kiragon — Footsteps Chase','footsteps','scripts/runtime.mjs',"openProgress('footsteps')"],
  ['Kiragon — Grief Comfort','grief','scripts/runtime.mjs',"openProgress('grief')"],
  ['Kiragon — Joy & Anger Contest','competition','scripts/runtime.mjs','openCompetition'],
  ['Kiragon — Four Who Are One','four','scripts/runtime.mjs','openFour'],
  ['Kiragon — Leif’s Hope Boss','boss','scripts/runtime.mjs',"openProgress('boss')"],
  ['Kiragon — Reform Emotion (Selected)','reform','scripts/runtime.mjs','reformEmotion'],
  ['Kiragon — Reset Abyss Trackers','reset','scripts/runtime.mjs','reset']
 ];
 for(const [name,id,file,method] of macros){
  const existing=game.macros.find(m=>m.getFlag(SCOPE,'leifsHopeMacro')===id);
  if(existing){result.existing++;continue;}
  const command=id==='install'?`await (await import('/${BASE}/${file}')).install();`:
   method.includes('(')?`await (await import('/${BASE}/${file}')).${method};`:`await (await import('/${BASE}/${file}')).${method}();`;
  await Macro.create({name,type:'script',command,img:`${BASE}/assets/portraits/${id==='competition'?'joy':id==='boss'?'resignation':id==='grief'?'grief':'hope'}.png`,flags:{[SCOPE]:{leifsHopeMacro:id}}});result.macros++;
 }
 ui.notifications.info(`Leif’s Hope installed: ${result.actors} actors, ${result.journals} journals, ${result.items} gifts, ${result.macros} macros (${result.existing} existing).`);
 console.info('Kiragon — Leif’s Hope installed',result);
 return result;
}
