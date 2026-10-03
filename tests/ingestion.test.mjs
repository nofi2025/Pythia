import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ingest,ingestionExample} from '../lib/ingestion.ts';
import {dependencyFindings,dependencyStress,dependencyDowntimeCost} from '../lib/dependencies.ts';
test('ingestion preserves provenance and groups explicitly declared shared infrastructure',()=>{
 const r=ingest(ingestionExample),a=r.assessment;assert.equal(a.demo,true);assert.equal(a.systems.length,2);assert(a.systems[0].source.includes('systems[0]'));
 const cloud=a.nodes.filter(n=>n.kind==='Infrastructure');assert.equal(cloud.length,1);
 const stress=dependencyStress(a,[cloud[0].id]);assert.equal(stress.affectedSystems.length,2);assert.equal(stress.affectedProcesses.length,1);
 assert(dependencyFindings(a).some(f=>f.kind==='Shared dependency'&&f.title.includes('Shared cloud')));
 assert(a.scenarios.every(s=>!s.approved&&s.probability.low===null));
});
test('unknown provider information remains unknown, invalid references and duplicate IDs reject atomically',()=>{
 const r=ingest({source:'Customer inventory',company:{name:'Acme'},systems:[{id:'a',name:'App'}]});assert.equal(r.assessment.nodes.length,1);assert.equal(r.warnings.length,2);assert(dependencyFindings(r.assessment).some(f=>f.kind==='Missing dependency evidence'));
 for(const systems of [[{id:'a',name:'App',dependsOn:['missing']}],[{id:'a',name:'A'},{id:'a',name:'B'}],[{id:'a',name:'App',dependsOn:['a']}]])assert.throws(()=>ingest({source:'Test',company:{name:'Acme'},systems}));
});
test('diamond dependency paths and multiple failure seeds do not double-count business processes',()=>{
 const a=ingest(ingestionExample).assessment;const seeds=a.nodes.filter(n=>n.kind==='Infrastructure'||n.kind==='Identity provider').map(n=>n.id);const r=dependencyStress(a,seeds);assert.equal(r.affectedSystems.length,2);assert.equal(r.affectedProcesses.length,1);
 assert.throws(()=>dependencyStress(a,['missing']));
});
test('dependency downtime calculation requires evidenced scope and never infers money from system counts',()=>{
 assert.equal(dependencyDowntimeCost({low:4,high:8},null,{low:25,high:50},'source'),null);
 assert.equal(dependencyDowntimeCost({low:4,high:8},1000,{low:25,high:50},''),null);
 assert.equal(dependencyDowntimeCost({low:4,high:8},1000,{low:25,high:101},'source'),null);
 const c=dependencyDowntimeCost({low:4,high:8},1000,{low:25,high:50},'Customer estimate');assert.equal(c.low,1000);assert.equal(c.high,4000);
});
test('provider normalization handles case and spacing while unknown fields are rejected',()=>{
 const input=structuredClone(ingestionExample);input.systems[1].cloudProvider='  SHARED   CLOUD PROVIDER  ';const a=ingest(input).assessment;assert.equal(a.nodes.filter(n=>n.kind==='Infrastructure').length,1);
 assert.throws(()=>ingest({...input,unrecognized:'do not silently drop'}));
});
