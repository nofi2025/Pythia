import type {Assessment,Range} from './model';
import {known} from './engine';
export type Finding={kind:string,title:string,basis:string,evidence:string[],affectedSystems:string[],affectedProcesses:string[],confidence:'Low'|'Medium',question:string};
export function dependencyIndex(a:Assessment){
 const reverse=new Map<string,Set<string>>();const forward=new Map<string,Set<string>>();
 for(const e of a.edges){if(!reverse.has(e.target))reverse.set(e.target,new Set());reverse.get(e.target)!.add(e.source);if(!forward.has(e.source))forward.set(e.source,new Set());forward.get(e.source)!.add(e.target);}
 const reachable=(seeds:string[],map=reverse)=>{const visited=new Set(seeds),queue=[...seeds];for(let i=0;i<queue.length;i++)for(const id of map.get(queue[i])??[]){if(!visited.has(id)){visited.add(id);queue.push(id);}}return visited;};
 return {reverse,forward,reachable};
}
export function dependencyStress(a:Assessment,failedIds:string[]){
 const ids=new Set(a.nodes.map(n=>n.id));if(!failedIds.length||failedIds.some(id=>!ids.has(id)))throw Error('Choose existing dependency nodes');
 const affected=dependencyIndex(a).reachable(failedIds);
 return {assumption:'Conditional interruption: every recorded dependency propagates failure. Alternatives, partial service, recovery timing and actual failure probabilities are not validated.',failedIds:[...new Set(failedIds)],affectedNodeIds:[...affected],affectedSystems:a.systems.filter(s=>affected.has(s.id)).map(s=>s.name),affectedProcesses:a.nodes.filter(n=>n.kind==='Business process'&&affected.has(n.id)).map(n=>n.label),confidence:'Low' as const};
}
export function dependencyFindings(a:Assessment):Finding[]{
 const ix=dependencyIndex(a),findings:Finding[]=[];
 const add=(n:Assessment['nodes'][number],kind:string,title:string,basis:string,question:string)=>{const impact=dependencyStress(a,[n.id]);findings.push({kind,title,basis,evidence:[n.id,...a.edges.filter(e=>e.target===n.id).map(e=>e.id)],affectedSystems:impact.affectedSystems,affectedProcesses:impact.affectedProcesses,confidence:'Low',question});};
 for(const n of a.nodes){
  const direct=ix.reverse.get(n.id)?.size??0;
  if(direct>=2&&['Vendor','Infrastructure','Identity provider','Region'].includes(n.kind))add(n,'Shared dependency',`${n.label}: shared ${n.kind.toLowerCase()}`,`${direct} direct recorded dependents. Common-cause outage is a hypothesis, not proof of correlated failure.`,'Confirm isolation, provider architecture and independent failover.');
  const reach=ix.reachable([n.id]);if(reach.size>direct+1)add(n,'Cascading impact',`${n.label}: indirect dependencies`,`${reach.size-1} reachable dependents; ${direct} direct. Reach is deduplicated across paths.`,'Validate which indirect processes stop or degrade and at what time.');
  if([...ix.forward.get(n.id)??[]].some(next=>ix.reachable([next],ix.forward).has(n.id)))add(n,'Dependency cycle',`${n.label}: circular recovery dependency`,'A directed cycle exists in the entered dependency graph.','Can these systems recover independently after a simultaneous failure?');
 }
 // Legacy inventories may name vendors without explicit provider nodes.
 const vendors=new Map<string,typeof a.systems>();for(const s of a.systems){const v=s.vendor.trim().toLowerCase().replace(/\s+/g,' ');if(v){if(!vendors.has(v))vendors.set(v,[]);vendors.get(v)!.push(s);}}
 for(const [vendor,systems]of vendors)if(systems.length>1&&!a.nodes.some(n=>n.kind==='Vendor'&&n.label.trim().toLowerCase().replace(/\s+/g,' ')===vendor))findings.push({kind:'Vendor concentration',title:`${systems[0].vendor}: multiple systems`,basis:'Matching declared vendor names; no common infrastructure or outage probability established.',evidence:systems.map(s=>s.id),affectedSystems:systems.map(s=>s.name),affectedProcesses:[],confidence:'Low',question:'Verify common provider dependencies and model a shared vendor node if applicable.'});
 for(const s of a.systems){if(!ix.forward.get(s.id)?.size)findings.push({kind:'Missing dependency evidence',title:`${s.name}: no underlying dependencies`,basis:'No outgoing dependency edges exist. This is a data gap, not evidence of independence.',evidence:[s.id],affectedSystems:[s.name],affectedProcesses:[],confidence:'Low',question:'Request cloud hosting, identity, network, API, data source and key-person dependencies.'});}
 return findings;
}
/** Count shared business interruption once; requires explicit scope, duration and rate. */
export function dependencyDowntimeCost(hours:Range,companyHourlyCost:number|null,affectedShare:Range,source:string){
 if(!known(hours)||companyHourlyCost===null||!Number.isFinite(companyHourlyCost)||companyHourlyCost<0||!known(affectedShare)||affectedShare.high!>100||!source.trim())return null;
 return {low:hours.low!*companyHourlyCost*affectedShare.low!/100,high:hours.high!*companyHourlyCost*affectedShare.high!/100,formula:'downtime hours × company-wide hourly cost × affected share / 100',source,confidence:'Low' as const,limitation:'Conditional downtime cost only; excludes recovery and other costs. Affected share must be justified; system count is not a financial allocation.'};
}
