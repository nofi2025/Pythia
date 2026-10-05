import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {unstable_getMiniflareWorkerOptions} from 'wrangler';
import {demo} from '../lib/model.ts';
import {snapshot} from '../tests/fixtures/simulation.mjs';
import {calculate} from '../lib/simulation.ts';
import {simulationReport} from '../lib/simulation-report.ts';
const require=createRequire(import.meta.url);
const {Miniflare}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
const config=unstable_getMiniflareWorkerOptions('dist/server/wrangler.json');
const mf=new Miniflare({...config.workerOptions,modules:[config.main,...readdirSync('dist/server',{recursive:true}).filter(f=>f.endsWith('.js')&&f!=='index.js').map(f=>'dist/server/'+f)].map(path=>({type:'ESModule',path:path.startsWith('/')?path:new URL('../'+path,import.meta.url).pathname})),modulesRoot:new URL('../dist/server/',import.meta.url).pathname,cf:false});
try {
 const db=await mf.getD1Database('DB');
 for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql.trim()).run();
 const root=await mf.dispatchFetch('http://localhost/');assert.equal(root.status,200);assert.match(await root.text(),/PYTHIA/);
 assert.equal((await mf.dispatchFetch('http://localhost/api/assessments')).status,401);
 const headers={'oai-authenticated-user-id':'runtime-test','oai-authenticated-user-email':'test@example.invalid','origin':'http://localhost','content-type':'application/json'};
 const a=demo();const scenario=snapshot();a.baseline=structuredClone(scenario.baseline);a.simulations=[scenario];a.simulationDraft.input=structuredClone(scenario.input);
 const saved=await mf.dispatchFetch('http://localhost/api/assessments',{method:'POST',headers,body:JSON.stringify(a)});assert.equal(saved.status,200,await saved.text());
 const loaded=await mf.dispatchFetch('http://localhost/api/assessments?id='+a.id,{headers});assert.equal(loaded.status,200);const record=await loaded.json();assert.equal(record.company.name,a.company.name);assert.deepEqual(record.simulations,[scenario]);assert.deepEqual(record.simulationDraft.input,scenario.input);const result=calculate(record.simulations[0].baseline,record.simulations[0].input);assert.equal(result.cases[1].profit,215000);assert.match(simulationReport(record.simulations[0]),/215,000/);
 record.baseline.price.value=120;const updated=await mf.dispatchFetch('http://localhost/api/assessments',{method:'POST',headers,body:JSON.stringify(record)});assert.equal(updated.status,200);assert.equal((await mf.dispatchFetch('http://localhost/api/assessments',{method:'POST',headers,body:JSON.stringify(record)})).status,409);
 const reloaded=await (await mf.dispatchFetch('http://localhost/api/assessments?id='+a.id,{headers})).json();assert.equal(reloaded.baseline.price.value,120);assert.equal(reloaded.simulations[0].baseline.price.value,100);
 const denied=await mf.dispatchFetch('http://localhost/api/assessments?id='+a.id,{headers:{...headers,'oai-authenticated-user-id':'other-user'}});assert.equal(denied.status,404);
 console.log('PASS: built application renders; anonymous API denied; authenticated D1 create/update/reload, simulator draft and snapshot, report generation, stale conflict and cross-user denial work.');
}finally{await mf.dispose();}
