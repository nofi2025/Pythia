import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculate,emptyBaseline,emptySimulation} from '../lib/simulation.ts';
import {assessmentSchema,blank,demo} from '../lib/model.ts';
import {simulationReport} from '../lib/simulation-report.ts';
import {observation} from '../lib/simulation-observation.ts';
import {fixture,snapshot} from './fixtures/simulation.mjs';

test('growth: sales constrained by capacity, expense and delta counted once',()=>{
 const {baseline:b,input:i}=fixture();const r=calculate(b,i);assert.equal(r.ok,true);
 assert.equal(r.baseline.revenue,1000000);assert.equal(r.baseline.profit,200000);
 assert.deepEqual(r.cases.map(c=>c.revenue),[900000,1100000,1250000]);
 assert.deepEqual(r.cases.map(c=>c.profit),[135000,215000,275000]);
 assert.deepEqual(r.cases.map(c=>c.deltaProfit),[-65000,15000,75000]);
 assert.deepEqual(r.cases.map(c=>c.expansionBenefit),[-25000,15000,75000]);
 assert.equal(r.cases[2].unmet,500);assert.equal(r.cases[2].utilization,1);
 assert.equal(r.cases[0].breakEven,5625);assert.equal(r.confidence,'Low');
 assert.equal(r.threshold.growth,6.25);
 i.cases[1].demand=6.25;assert.equal(calculate(b,i).cases[1].expansionBenefit,0);
 i.cases[1].demand=6;assert.ok(calculate(b,i).cases[1].expansionBenefit<0);
 i.cases[1].demand=7;assert.ok(calculate(b,i).cases[1].expansionBenefit>0);
});
test('cost pressure: unchanged capacity, rising unit costs, falling demand',()=>{
 const {baseline:b,input:i}=fixture('cost');b.expansionCost.value=null;b.expansionCost.source='';
 const r=calculate(b,i);assert.equal(r.ok,true);assert.deepEqual(r.cases.map(c=>c.revenue),[800000,900000,1000000]);assert.deepEqual(r.cases.map(c=>Math.round(c.profit)),[24000,106000,200000]);assert.deepEqual(r.cases.map(c=>Math.round(c.deltaProfit)),[-176000,-94000,0]);assert.equal(r.threshold.growth,null);assert.equal(r.cases[0].expansionBenefit,null);
 const text=observation(snapshot('cost'),r).join(' ');assert.match(text,/variable COGS only/);assert.match(text,/not included/);
});
test('sensitivity finds capacity kink, not just endpoints',()=>{
 const {baseline:b,input:i}=fixture();b.expansionCost.value=20;i.cases.forEach((c,j)=>{c.demand=25;c.second=[0,25,50][j];});
 const r=calculate(b,i);assert.equal(r.sensitivity[1].profitEffect,50000);assert.equal(r.sensitivity[0].profitEffect,0);
});
test('UNKNOWN, missing provenance, negative, non-finite and impossible inputs do not produce money',()=>{
 assert.equal(calculate(emptyBaseline(),emptySimulation()).ok,false);
 for(const value of [null,-1,NaN,Infinity]){const {baseline:b,input:i}=fixture();b.price.value=value;const r=calculate(b,i);assert.equal(r.ok,false);assert.equal('cases'in r,false);}
 const {baseline:b,input:i}=fixture();b.capacity.value=0;assert.equal(calculate(b,i).ok,false);b.capacity.value=10000;b.price.source='';assert.equal(calculate(b,i).ok,false);b.price.source='test';i.cases[0].second=-10;assert.equal(calculate(b,i).ok,false);
});
test('thresholds and ratios handle zero demand, nonpositive contribution, infeasible expense and zero revenue',()=>{
 const {baseline:b,input:i}=fixture();b.unitCost.value=110;assert.equal(calculate(b,i).threshold.growth,null);assert.equal(calculate(b,i).cases[0].breakEven,null);
 b.unitCost.value=60;b.expansionCost.value=40;assert.equal(calculate(b,i).threshold.growth,null);
 b.expansionCost.value=10;b.demand.value=0;const r=calculate(b,i);assert.equal(r.threshold.growth,null);assert.equal(r.cases[0].margin,null);assert.equal(r.cases[0].profit,-225000);
});
test('case labels never silently reorder user assumptions',()=>{
 const {baseline:b,input:i}=fixture();i.cases[0].demand=100;const r=calculate(b,i);assert.match(r.warnings.join(' '),/not ordered/);assert.equal(r.cases[0].name,'Downside');
});
test('old assessments get empty baseline and history; snapshots remain immutable and validate',()=>{
 const old=demo();delete old.baseline;delete old.simulations;const upgraded=assessmentSchema.parse(old);assert.equal(upgraded.baseline.demand.value,null);assert.deepEqual(upgraded.simulations,[]);
 const s=snapshot();const a=blank();a.baseline=structuredClone(s.baseline);a.simulations=[s];a.baseline.price.value=1;assert.equal(a.simulations[0].baseline.price.value,100);assert.equal(assessmentSchema.safeParse(a).success,true);a.simulations.push(s);assert.equal(assessmentSchema.safeParse(a).success,false);
});
test('executive report includes evidence, assumptions, financial math and escapes injection',()=>{
 const s=snapshot();s.input.theory='<script>alert(1)</script>';s.riskNotes='<img src=x onerror=alert(1)>';const html=simulationReport(s);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.match(html,/&lt;script&gt;/);for(const needle of ['DRAFT','Company baseline','Pythia Observation','6.3%','Key supplier','135,000','not a confidence interval','Rule-based'])assert.ok(html.includes(needle),needle);
});
