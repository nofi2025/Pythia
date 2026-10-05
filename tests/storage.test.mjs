import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {demo} from '../lib/model.ts';
import {saveAssessment,getAssessment,listAssessments} from '../db/storage.ts';
import {assessmentHandlers} from '../lib/api.ts';
function database(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const db={prepare(query){return{query,values:[],bind(...values){this.values=values;return this;},async first(){return sql.prepare(query).get(...this.values)??null;},async all(){return{results:sql.prepare(query).all(...this.values)}}}},async batch(stmts){sql.exec('BEGIN');try{const r=stmts.map(s=>({meta:{changes:Number(sql.prepare(s.query).run(...s.values).changes)}}));sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};return{db,sql};
}
test('saved assessments survive reload with structural graph and audit records',async()=>{
 const {db,sql}=database();const a=demo();const saved=await saveAssessment(db,a,'alice');assert.equal(saved.revision,1);
 const loaded=await getAssessment(db,a.id,'alice');assert.equal(loaded.company.name,a.company.name);assert.equal(loaded.revision,1);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM nodes').get().n,a.nodes.length);assert.equal(sql.prepare('SELECT count(*) AS n FROM edges').get().n,a.edges.length);assert.equal(sql.prepare('SELECT count(*) AS n FROM audit').get().n,1);
 assert.equal((await listAssessments(db,'alice')).length,1);assert.equal((await listAssessments(db,'bob')).length,0);assert.equal(await getAssessment(db,a.id,'bob'),null);
});
test('stale and foreign-owner writes cannot change body, graph or audit',async()=>{
 const {db,sql}=database();const a=demo();await saveAssessment(db,a,'alice');
 assert.equal(await saveAssessment(db,a,'alice'),null);a.revision=1;
 const intrusion=structuredClone(a);intrusion.company.name='Injected';intrusion.nodes=[];intrusion.edges=[];
 assert.equal(await saveAssessment(db,intrusion,'bob'),null);assert.equal((await getAssessment(db,a.id,'alice')).company.name,a.company.name);
 a.company.name='Updated';assert.equal((await saveAssessment(db,a,'alice')).revision,2);
 assert.equal(await saveAssessment(db,intrusion,'alice'),null);assert.equal((await getAssessment(db,a.id,'alice')).company.name,'Updated');assert.equal(sql.prepare('SELECT count(*) AS n FROM nodes').get().n,a.nodes.length);assert.equal(sql.prepare('SELECT count(*) AS n FROM audit').get().n,2);
});
test('a failed graph write rolls back the entire assessment and audit transaction',async()=>{
 const {db,sql}=database();const a=demo();await saveAssessment(db,a,'alice');a.revision=1;a.company.name='Must roll back';a.nodes.push(a.nodes[0]);
 await assert.rejects(saveAssessment(db,a,'alice'));assert.equal((await getAssessment(db,a.id,'alice')).company.name,'Northstar Commerce');assert.equal(sql.prepare('SELECT count(*) AS n FROM audit').get().n,1);
});

test('API denies anonymous access and cross-origin writes',async()=>{
 const {db}=database();const anon=assessmentHandlers(()=>db,async()=>null);
 assert.equal((await anon.GET(new Request('https://app.test/api/assessments'))).status,401);
 assert.equal((await anon.POST(new Request('https://app.test/api/assessments',{method:'POST'}))).status,401);
 const api=assessmentHandlers(()=>db,async()=>({userId:'alice'}));
 assert.equal((await api.POST(new Request('https://app.test/api/assessments',{method:'POST',headers:{origin:'https://attacker.test','content-type':'application/json'},body:JSON.stringify(demo())}))).status,403);
});
test('API validates input and supports create, fetch, list, update and conflict responses',async()=>{
 const {db}=database();const api=assessmentHandlers(()=>db,async()=>({userId:'alice'}));const a=demo();
 const post=body=>api.POST(new Request('https://app.test/api/assessments',{method:'POST',headers:{origin:'https://app.test','content-type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)}));
 assert.equal((await post('{bad')).status,400);const invalid=structuredClone(a);invalid.scenarios[0].probability.high=200;assert.equal((await post(invalid)).status,400);
 const r=await post(a);assert.equal(r.status,200);assert.equal((await r.json()).revision,1);
 assert.equal((await post(a)).status,409);a.revision=1;a.company.name='Customer';assert.equal((await post(a)).status,200);
 const get=await api.GET(new Request('https://app.test/api/assessments?id='+a.id));assert.equal((await get.json()).company.name,'Customer');
 const list=await api.GET(new Request('https://app.test/api/assessments'));assert.equal((await list.json()).length,1);
 const other=assessmentHandlers(()=>db,async()=>({userId:'bob'}));assert.equal((await other.GET(new Request('https://app.test/api/assessments?id='+a.id))).status,404);
});

test('saved simulator baseline and snapshots survive API reload and do not change with current baseline',async()=>{
 const {snapshot}=await import('./fixtures/simulation.mjs');const {db}=database();const api=assessmentHandlers(()=>db,async()=>({userId:'alice'}));const a=demo();const s=snapshot();a.baseline=structuredClone(s.baseline);a.simulations=[s];
 const post=body=>api.POST(new Request('https://app.test/api/assessments',{method:'POST',headers:{origin:'https://app.test','content-type':'application/json'},body:JSON.stringify(body)}));
 assert.equal((await post(a)).status,200);const loaded=await (await api.GET(new Request('https://app.test/api/assessments?id='+a.id))).json();assert.deepEqual(loaded.simulations,[s]);loaded.baseline.price.value=120;assert.equal((await post(loaded)).status,200);const refreshed=await getAssessment(db,a.id,'alice');assert.equal(refreshed.baseline.price.value,120);assert.equal(refreshed.simulations[0].baseline.price.value,100);
});
