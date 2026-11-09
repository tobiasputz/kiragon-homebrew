import { MODULE_ID, secondsRemaining, elapsedClockSeconds } from './engine.mjs';
import { KiragonRuntime } from './runtime.mjs';
import { openDashboard, openPlayerHUD, redraw } from './ui.mjs';
const rt=new KiragonRuntime();rt.onChange=()=>redraw(rt);
Hooks.once('init',()=>{
  game.settings.register(MODULE_ID,'packs',{name:'Kiragon installed mechanic packs',scope:'world',config:false,type:Array,default:[]});
  game.settings.register(MODULE_ID,'enabled',{name:'Kiragon enabled mechanic pack ids',scope:'world',config:false,type:Array,default:[]});
  game.settings.register(MODULE_ID,'autoPlayerHUD',{name:'Automatically open Kiragon HUD for players',scope:'client',config:true,type:Boolean,default:true});
  game.settings.register(MODULE_ID,'clockStates',{name:'Kiragon clock states',scope:'world',config:false,type:Object,default:{}});
});
Hooks.once('ready',async()=>{
  if(game.system.id!=='pf2e'){ui.notifications.error('Kiragon Homebrew Engine requires the Pathfinder 2e system.');return;}
  const api={
    open:()=>rt.gm?openDashboard(rt):openPlayerHUD(rt),openHUD:()=>openPlayerHUD(rt),listPacks:()=>rt.packs(),getPack:id=>rt.pack(id),importPack:(data,options)=>rt.savePack(data,options),enable:(id,enabled=true)=>rt.setEnabled(id,enabled),
    exportPack:id=>JSON.stringify(rt.pack(id),null,2),enroll:(actor,packId,key)=>rt.enroll(actor,packId,key),
    adjust:(actor,packId,trackId,delta,reason)=>rt.adjust(actor,packId,trackId,delta,reason),
    action:(actor,packId,actionId)=>rt.useAction(actor,packId,actionId),
    getState:(actor,packId)=>rt.state(actor,packId),getResource:(actor,packId,trackId)=>{const p=rt.pack(packId),t=p?.tracks.find(x=>x.id===trackId);return t?rt.resource(actor,p,t):null;},
    startClock:(packId,id)=>rt.startClock(packId,id),pauseClock:(packId,id)=>rt.pauseClock(packId,id),resetClock:(packId,id)=>rt.resetClock(packId,id),setBellInterval:(packId,id,minutes)=>rt.setBellInterval(packId,id,minutes),advanceClock:(packId,id,seconds)=>rt.advanceClock(packId,id,seconds),
    importAdversaries:packId=>rt.importAdversaries(packId),importItems:packId=>rt.importItems(packId),migrateLegacy:()=>rt.migrateLegacyAbyss(),sync:()=>rt.syncAll(),
  };
  game.modules.get(MODULE_ID).api=api;
  Hooks.on('getSceneControlButtons',controls=>{
    if(Array.isArray(controls)){const token=controls.find(c=>c.name==='token'||c.name==='tokens');token?.tools?.push?.({name:'kiragon-homebrew',title:'Kiragon Homebrew',icon:'fas fa-scroll',button:true,onClick:game.user?.isGM?api.open:api.openHUD});}
    else{const tokens=controls.tokens??controls.token;if(tokens){tokens.tools??={};tokens.tools['kiragon-homebrew']={name:'kiragon-homebrew',title:'Kiragon Homebrew',icon:'fa-solid fa-scroll',order:Object.keys(tokens.tools).length,button:true,visible:true,onChange:(_event,active)=>{if(active!==false)(game.user?.isGM?api.open():api.openHUD());}};}}
  });
  Hooks.on('renderSettings',(_app,html)=>{
    const root=html?.[0]??html;if(!root?.querySelector)return;const section=root.querySelector('#settings-game')??root.querySelector('.settings-sidebar')??root;
    if(section.querySelector('[data-kiragon-launch]'))return;const b=document.createElement('button');b.type='button';b.dataset.kiragonLaunch='true';b.innerHTML='<i class="fas fa-scroll"></i> Kiragon Homebrew Engine';b.addEventListener('click',game.user?.isGM?api.open:api.openHUD);section.appendChild(b);
  });
  Hooks.on('updateSetting',setting=>{if(String(setting.key??'').startsWith(`${MODULE_ID}.`))redraw(rt);});
  Hooks.on('updateActor',()=>redraw(rt));
  Hooks.on('updateItem',()=>redraw(rt));
  Hooks.on('updateCombat',()=>rt.combatChanged().catch(console.error));
  Hooks.on('createCombat',()=>rt.combatChanged().catch(console.error));
  Hooks.on('deleteCombat',()=>rt.combatChanged().catch(console.error));
  try{await rt.ensureBuiltins();if(rt.primaryGM){await rt.syncAll();await rt.combatChanged();}}catch(e){console.error(MODULE_ID,'Initialization failed',e);ui.notifications.error(`Kiragon: ${e.message}`);}
  if(!game.user.isGM&&game.settings.get(MODULE_ID,'autoPlayerHUD')&&rt.visibleCharacters().some(a=>rt.enabled().some(p=>rt.enrolled(a,p))))openPlayerHUD(rt);
  // Client-side stopwatch display; only the primary GM applies bells.
  setInterval(()=>{
    for(const el of rt.dashboard?.element?.querySelectorAll?.('[data-clock-elapsed]')??[]){
      const p=rt.pack(rt.dashboardPackId??''),def=p?.clocks.find(c=>c.id===el.dataset.clockElapsed);
      if(!def)continue;const st=rt.clock(p.id,def),value=def.repeat?elapsedClockSeconds(st):secondsRemaining(st);
      el.textContent=`${String(Math.floor(value/60)).padStart(2,'0')}:${String(Math.floor(value%60)).padStart(2,'0')}`;
      const next=rt.dashboard?.element?.querySelector?.(`[data-clock-next="${def.id}"]`);
      if(next){const left=secondsRemaining(st);next.textContent=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;}
    }
    for(const el of rt.playerHUD?.element?.querySelectorAll?.('[data-hud-clock]')??[]){
      const p=rt.pack(el.dataset.hudPack),def=p?.clocks.find(c=>c.id===el.dataset.hudClock);
      if(!def)continue;const st=rt.clock(p.id,def),elapsed=elapsedClockSeconds(st),next=secondsRemaining(st);
      const fmt=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
      const elapsedNode=el.querySelector('[data-hud-elapsed]'),nextNode=el.querySelector('[data-hud-next]');
      if(elapsedNode)elapsedNode.textContent=fmt(elapsed);
      if(nextNode)nextNode.textContent=fmt(next);
    }
    if(rt.primaryGM)rt.processClocks();
  },1000);
  console.info('Kiragon Homebrew Engine ready: game.modules.get("kiragon-homebrew").api.open()');
});
