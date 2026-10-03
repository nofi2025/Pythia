import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demo,blank,assessmentSchema,hypothesis,newSystem} from '../lib/model.ts';
import {exposure,moneyRange,graphAnalysis,priority,likelihood} from '../lib/engine.ts';
import {reportHtml} from '../lib/report.ts';

test('financial range and annual percentage calculations use deterministic endpoints',()=>{
  const a=demo(),s=a.scenarios[0];
  assert.deepEqual(exposure(s).loss,{low:15000,high:75000});
  assert.deepEqual(exposure(s).expected,{low:1500,high:18750});
  assert.equal(exposure(s).confidence,'Low');
  assert.equal(moneyRange({low:15001,high:75001}),'$15,000 – $75,100');
});
test('missing included values or sources never produce a known total',()=>{
  for(const mutate of [s=>s.financial[1].range.low=null,s=>s.financial[1].source='',s=>s.financial[0].source='']){
    const s=demo().scenarios[0];mutate(s);assert.equal(exposure(s).loss,null);assert.equal(exposure(s).expected,null);
  }
  const s=demo().scenarios[0];s.probability.low=null;assert.equal(exposure(s).expected,null);
});
test('confirmed zero is distinct from unknown and bounds round outward',()=>{
  const s=demo().scenarios[0];s.financial.forEach(f=>{f.range={low:0,high:0};});
  assert.deepEqual(exposure(s).loss,{low:0,high:0});assert.equal(moneyRange({low:1,high:12}),'$0 – $100');
});
test('schema rejects inverted bounds, invalid probabilities, dangling references and approvals without review',()=>{
  for(const mutate of [a=>a.scenarios[0].probability.high=101,a=>a.scenarios[0].downtime={low:5,high:1},a=>a.edges[0].target='missing',a=>a.scenarios[0].approved=true,a=>a.thresholds.low=50,a=>a.scenarios[0].financial[0].range.low=-1]){
    const a=demo();mutate(a);assert.equal(assessmentSchema.safeParse(a).success,false);
  }
  const a=demo();a.scenarios[0].approved=true;a.scenarios[0].notes='Reviewed';a.scenarios[0].status='Reviewed';a.scenarios[0].financial[0].source='';assert.equal(assessmentSchema.safeParse(a).success,false);
});
test('priority and configurable likelihood show uncertainty',()=>{
  const a=demo(),s=a.scenarios[0];assert.equal(priority(s),'High');assert.equal(likelihood(s,a),'Medium');
  a.thresholds.high=20;assert.equal(likelihood(s,a),'Medium–High');
  Object.keys(s.severity).forEach(k=>s.severity[k]=3);s.probability.low=null;assert.equal(priority(s),'Investigate');
  s.status='Closed';assert.equal(priority(s),'Closed');
});
test('dependency reach handles cycles without self-counting',()=>{
  const a=demo();const cloud=graphAnalysis(a).find(n=>n.id===a.systems[2].id);assert.equal(cloud.upstream.length,3);assert.equal(cloud.spof,true);
  a.edges.push({id:'cycle',source:a.systems[2].id,target:a.systems[0].id,critical:true,alternative:''});
  for(const n of graphAnalysis(a)){assert(!n.upstream.includes(n.id));assert(n.upstream.length<a.nodes.length);}
});
test('report requires review, excludes draft scenario content and escapes untrusted text',()=>{
  const a=demo();assert.throws(()=>reportHtml(a));a.summary='<script>alert(1)</script>';a.scenarios[0].approved=true;a.scenarios[0].status='Reviewed';a.scenarios[0].notes='Checked ranges and sources';a.scenarios[1].description='UNAPPROVED_SECRET_SCENARIO';
  const html=reportHtml(a);assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('UNAPPROVED_SECRET_SCENARIO'));
  for(let n=1;n<=10;n++)assert(html.includes(`<h2>${n}.`));assert(html.includes('<svg'));assert(html.includes('ILLUSTRATIVE SAMPLE'));
});
test('new assessments contain no invented financial inputs or probabilities',()=>{
  const a=blank();assert.equal(a.company.revenue,null);const s=hypothesis(newSystem());assert.equal(s.probability.low,null);assert.equal(exposure(s).loss,null);assert.equal(s.approved,false);
});
