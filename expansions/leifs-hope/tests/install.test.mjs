import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
function collection(){const arr=[];return {contents:arr,find:fn=>arr.find(fn),push:x=>arr.push(x)};}
function doc(data){const v=JSON.parse(JSON.stringify(data));v.getFlag=(scope,key)=>v.flags?.[scope]?.[key];return v;}
test('installer creates expected world docs and macros, and is idempotent', async()=>{
 globalThis.game={user:{isGM:true},system:{id:'pf2e'},modules:new Map([['kiragon-homebrew',{active:true}]]),folders:collection(),actors:collection(),journal:collection(),items:collection(),macros:collection()};
 globalThis.foundry={utils:{deepClone:x=>JSON.parse(JSON.stringify(x))}};
 globalThis.ui={notifications:{info:()=>{}}};
 const factory=(coll,type)=>({create:async data=>{const d=doc({...data,id:`${type}_${coll.contents.length+1}`});coll.push(d);return d;}});
 globalThis.Folder=factory(game.folders,'folder');
 globalThis.Actor=factory(game.actors,'actor');
 globalThis.JournalEntry=factory(game.journal,'journal');
 globalThis.Item=factory(game.items,'item');
 globalThis.Macro=factory(game.macros,'macro');
 globalThis.fetch=async url=>{const p=path.resolve(here,'..','..','..','..','..','..',url.replace(/^modules\//,''));
 // test sources live under .../leifs-hope/data
 const file=path.resolve(here,'../data/',path.basename(url));
 try{const value=JSON.parse(await readFile(file,'utf8'));return {ok:true,json:async()=>value};}catch{return {ok:false,status:404};}};
 const {install}=await import('../scripts/install.mjs');
 const a=await install();
 assert.deepEqual([a.actors,a.journals,a.items,a.macros],[9,6,2,9]);
 assert.equal(game.actors.contents.find(x=>x.name==='The Ecstatic — Joy').prototypeToken.texture.src.includes('/joy.webp'),true);
 assert.equal(game.macros.contents.some(x=>x.command.includes('openProgress(\'boss\')')),true);
 const b=await install();
 assert.deepEqual([b.actors,b.journals,b.items,b.macros],[0,0,0,0]);
 assert.equal(b.existing,25);
});
