import {z} from 'zod';
import {blank,newSystem,assessmentSchema,hypothesis,uid,type Assessment} from './model';
const name=z.string().trim().min(1).max(200);
const text=z.string().max(8000);
const inputSchema=z.object({
  source:name,
  illustrative:z.boolean().optional(),
  company:z.object({name,industry:text.optional(),revenue:z.number().nonnegative().optional(),downtimeCost:z.number().nonnegative().optional()}).strict(),
  systems:z.array(z.object({
    id:name,name,type:text.optional(),vendor:text.optional(),purpose:text.optional(),
    ai:z.boolean().optional(),critical:z.boolean().optional(),
    processes:z.array(name).max(40).optional(),dependsOn:z.array(name).max(50).optional(),
    cloudProvider:text.optional(),identityProvider:text.optional(),region:text.optional(),
    controls:text.optional(),alternatives:text.optional(),source:text.optional(),
  }).strict()).min(1).max(100),
}).strict();
export type IngestionResult={assessment:Assessment;warnings:string[];source:string};
const key=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,' ');

/** Ingest only explicit customer declarations. Shared provider nodes are links to review, not discovered vendor architecture. */
export function ingest(input:unknown):IngestionResult{
  const data=inputSchema.parse(input);const a=blank();a.demo=data.illustrative??false;a.company={...a.company,...data.company,source:data.source};
  if(new Set(data.systems.map(s=>s.id)).size!==data.systems.length)throw Error('Duplicate input system IDs');
  const refs=new Map(data.systems.map(s=>[s.id,uid()]));const names=new Map<string,string>();const warnings:string[]=[];
  const node=(kind:string,label:string)=>{const k=kind+':'+key(label);let id=names.get(k);if(!id){id=uid();names.set(k,id);a.nodes.push({id,label:label.trim(),kind});}return id;};
  const connect=(source:string,target:string,critical:boolean)=>{if(source===target)throw Error('Self-dependencies are not allowed');if(!a.edges.some(e=>e.source===source&&e.target===target))a.edges.push({id:uid(),source,target,critical,alternative:''});};
  for(const [i,s]of data.systems.entries()){
    const system={...newSystem(),id:refs.get(s.id)!,name:s.name,type:s.type??'Other',vendor:s.vendor?.trim()??'',purpose:s.purpose??'',ai:s.ai??false,critical:s.critical??true,processes:(s.processes??[]).join('; '),controls:s.controls??'',alternatives:s.alternatives??'',source:`${s.source||data.source} / systems[${i}] / input ID ${s.id}`};
    a.systems.push(system);a.nodes.push({id:system.id,label:system.name,kind:system.ai?'AI system':'Technology system'});
    for(const p of s.processes??[])connect(node('Business process',p),system.id,system.critical);
    for(const [kind,value]of [['Vendor',s.vendor],['Infrastructure',s.cloudProvider],['Identity provider',s.identityProvider],['Region',s.region]])if(value?.trim())connect(system.id,node(kind!,value),system.critical);
    for(const dependency of s.dependsOn??[]){const target=refs.get(dependency);if(!target)throw Error(`Unknown dependency ID '${dependency}' for '${s.id}'`);connect(system.id,target,system.critical);}
    if(!s.cloudProvider?.trim())warnings.push(`${s.name}: underlying cloud provider is UNKNOWN; request vendor evidence.`);
    if(!s.identityProvider?.trim())warnings.push(`${s.name}: identity provider is UNKNOWN; verify shared sign-in dependencies.`);
    if(!s.source&&!data.source)warnings.push(`${s.name}: source missing`);
  }
  a.scenarios=a.systems.filter(s=>s.critical).map(s=>hypothesis(s,s.ai?'Hallucination/error':'Outage'));
  assessmentSchema.parse(a);
  return {assessment:a,warnings,source:data.source};
}

export const ingestionExample={illustrative:true,source:'Illustrative inventory export — replace before customer use',company:{name:'Example company',industry:'Retail'},systems:[{id:'orders',name:'Order platform',vendor:'Commerce vendor',cloudProvider:'Shared cloud provider',identityProvider:'Company SSO',processes:['Customer orders'],dependsOn:['payments']},{id:'payments',name:'Payment gateway',vendor:'Payment vendor',cloudProvider:'Shared cloud provider',identityProvider:'Company SSO',processes:['Customer orders']}]};
