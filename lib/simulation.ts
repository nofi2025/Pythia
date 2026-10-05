import {z} from 'zod';
const amount=z.number().finite().min(0).max(1e12).nullable();
const note=z.string().max(4000);
export const confidenceSchema=z.enum(['Unknown','Low','Medium','High']);
export const inputSchema=z.object({value:amount,source:note,origin:z.enum(['Company data','User assumption','Illustrative sample']),confidence:confidenceSchema});
export const baselineKeys=['demand','capacity','price','unitCost','fixedCost','expansionCost'] as const;
export const baselineLabels:Record<typeof baselineKeys[number],string>={demand:'Annual demand · units',capacity:'Annual capacity · units',price:'Selling price · USD/unit',unitCost:'Variable COGS · USD/unit',fixedCost:'Annual fixed operating expenses · USD',expansionCost:'Annual expense per added capacity unit · USD'};
export const baselineSchema=z.object({demand:inputSchema,capacity:inputSchema,price:inputSchema,unitCost:inputSchema,fixedCost:inputSchema,expansionCost:inputSchema});
export type Baseline=z.infer<typeof baselineSchema>;
export const emptyBaseline=():Baseline=>Object.fromEntries(baselineKeys.map(k=>[k,{value:null,source:'',origin:'Company data',confidence:'Unknown'}])) as Baseline;
export const caseNames=['Downside','Base','Upside'] as const;
const percent=z.number().finite().min(-100).max(1000).nullable();
export const simulationInputSchema=z.object({title:z.string().max(200),theory:note,template:z.enum(['growth','cost']),assumptions:note,confidence:confidenceSchema,cases:z.array(z.object({name:z.enum(caseNames),demand:percent,second:percent})).length(3)}).superRefine((v,c)=>{
 if(v.cases.some((x,i)=>x.name!==caseNames[i]))c.addIssue({code:'custom',message:'Cases must be Downside, Base, Upside in order.'});
 if(v.template==='growth'&&v.cases.some(x=>x.second!==null&&x.second<0))c.addIssue({code:'custom',message:'Capacity expansion must be 0–1,000%.'});
});
export type SimulationInput=z.infer<typeof simulationInputSchema>;
export const emptySimulation=():SimulationInput=>({title:'',theory:'',template:'growth',assumptions:'',confidence:'Unknown',cases:caseNames.map(name=>({name,demand:null,second:null}))});
export const draftSchema=z.object({input:simulationInputSchema,dependencyIds:z.array(z.string().max(100)).max(200),riskNotes:note,reviewNotes:note});
export const emptyDraft=()=>({input:emptySimulation(),dependencyIds:[] as string[],riskNotes:'',reviewNotes:''});
export const snapshotSchema=z.object({id:z.string().min(1).max(100),version:z.literal(1),createdAt:z.string().datetime(),company:z.string().max(200),baseline:baselineSchema,input:simulationInputSchema,dependencies:z.array(z.object({id:z.string().max(100),label:z.string().max(200),kind:z.string().max(8000)})).max(200),riskNotes:note,reviewNotes:note});
export type SimulationSnapshot=z.infer<typeof snapshotSchema>;
export const secondLabel=(input:SimulationInput)=>input.template==='growth'?'Capacity expansion':'Supplier / unit COGS change';
export const formulas=[
 'Demand = baseline demand × (1 + demand change / 100).',
 'Capacity = baseline capacity × (1 + capacity expansion / 100); unchanged in cost-pressure model.',
 'Units sold = min(demand, capacity); unmet demand = max(0, demand − capacity).',
 'Revenue = units sold × selling price. Variable COGS = units sold × unit COGS × (1 + supplier change / 100).',
 'Operating expenses = baseline fixed expenses + added capacity × annual expense per added capacity unit (growth only).',
 'Operating profit = revenue − variable COGS − operating expenses. Margin = profit / revenue. Utilization = units sold / capacity.',
 'Delta = scenario − current baseline. Expansion benefit = scenario profit − profit at unchanged capacity under the SAME demand.',
 'Break-even units = operating expenses / (selling price − scenario unit COGS), only for positive contribution.'
];
export const limitations='One annual period, one blended product/service, constant price and unit economics, full-year capacity availability, and sales limited by capacity. Assumes all served demand converts to sales. Taxes, financing, cash flow, one-time capex, working capital, timing, demand-price feedback and dependency outages are not modeled. Include annual depreciation/operating expense in expansion expense; assess cash investment separately. Case names are user labels, not probabilities or forecasts.';
export function validateSimulation(b:Baseline,i:SimulationInput):string[]{
 const bp=baselineSchema.safeParse(b),ip=simulationInputSchema.safeParse(i);
 if(!bp.success||!ip.success)return [...(!bp.success?bp.error.issues.map(x=>`${x.path.join('.')}: ${x.message}`):[]),...(!ip.success?ip.error.issues.map(x=>`${x.path.join('.')}: ${x.message}`):[])];
 const errors:string[]=[];
 for(const k of baselineKeys.filter(k=>i.template==='growth'||k!=='expansionCost')){if(b[k].value===null)errors.push(`${baselineLabels[k]} is UNKNOWN.`);if(!b[k].source.trim())errors.push(`Add source or assumption for ${baselineLabels[k]}.`);}
 if(b.capacity.value===0)errors.push('Annual capacity must be greater than zero.');
 if(!i.title.trim())errors.push('Name this decision.');
 if(!i.theory.trim())errors.push('Describe what you are considering.');
 if(!i.assumptions.trim())errors.push('Explain the case assumptions and their source.');
 for(const c of i.cases){if(c.demand===null)errors.push(`${c.name}: demand change is UNKNOWN.`);if(c.second===null)errors.push(`${c.name}: ${secondLabel(i)} is UNKNOWN.`);}
 return errors;
}
export function calculate(b:Baseline,i:SimulationInput){
 const errors=validateSimulation(b,i);if(errors.length)return {ok:false as const,errors};
 const demand=b.demand.value!,capacity=b.capacity.value!,price=b.price.value!,unitCost=b.unitCost.value!,fixedCost=b.fixedCost.value!;
 const outcome=(d:number,s:number)=>{
  const requested=demand*(1+d/100),cap=capacity*(1+(i.template==='growth'?s:0)/100),unit=unitCost*(1+(i.template==='cost'?s:0)/100);
  const expansionExpense=i.template==='growth'?(cap-capacity)*b.expansionCost.value!:0;
  const units=Math.min(requested,cap),revenue=units*price,cogs=units*unit,opex=fixedCost+expansionExpense,profit=revenue-cogs-opex;
  const contribution=price-unit,breakEven=contribution>0?opex/contribution:null;
  return {demand:requested,capacity:cap,units,unmet:Math.max(0,requested-cap),revenue,cogs,opex,totalCost:cogs+opex,profit,margin:revenue>0?profit/revenue:null,utilization:units/cap,expansionExpense,breakEven,breakEvenFeasible:breakEven!==null&&breakEven<=cap};
 };
 const baseline=outcome(0,0);
 const cases=i.cases.map(c=>{const r=outcome(c.demand!,c.second!);return {...r,name:c.name,deltaProfit:r.profit-baseline.profit,deltaRevenue:r.revenue-baseline.revenue,expansionBenefit:i.template==='growth'?r.profit-outcome(c.demand!,0).profit:null};});
 const base=i.cases[1];
 const spread=(index:'demand'|'second')=>{const vals=i.cases.map(c=>c[index]!);const low=Math.min(...vals),high=Math.max(...vals);const a=outcome(index==='demand'?low:base.demand!,index==='second'?low:base.second!),z=outcome(index==='demand'?high:base.demand!,index==='second'?high:base.second!);return {label:index==='demand'?'Demand change':secondLabel(i),low,high,profitEffect:Math.abs(z.profit-a.profit)};};
 const sensitivity=[spread('demand'),spread('second')];
 // Endpoints alone miss the capacity kink when added expense exceeds incremental sales.
 if(i.template==='growth'&&capacity>0){const kink=(demand*(1+base.demand!/100)/capacity-1)*100;const s=sensitivity[1];if(kink>s.low&&kink<s.high){const profits=[s.low,kink,s.high].map(v=>outcome(base.demand!,v).profit);s.profitEffect=Math.max(...profits)-Math.min(...profits);}}
 const contribution=price-unitCost,extraCap=capacity*base.second!/100,cost=extraCap*(b.expansionCost.value??0);
 let threshold:{growth:number|null,message:string}={growth:null,message:'Capacity-expansion threshold is not applicable to the cost-pressure model.'};
 if(i.template==='growth'){
  if(extraCap===0)threshold={growth:null,message:'Base case adds no capacity; expansion and maintaining capacity are identical.'};
  else if(contribution<=0||cost>=extraCap*contribution)threshold={growth:null,message:'No demand level makes expansion strictly more profitable under Base-case unit economics and expansion expense.'};
  else if(demand===0)threshold={growth:null,message:'Demand-growth threshold is UNKNOWN because baseline demand is zero.'};
  else {const growth=((capacity+cost/contribution)/demand-1)*100;threshold={growth,message:`At ${growth.toFixed(1)}% demand growth, expansion and maintaining capacity break even; above it, expansion is more profitable. Holds Base-case expansion and unit economics fixed.`};}
 }
 const levels=['Unknown','Low','Medium','High'];const confidence=levels[Math.min(levels.indexOf(i.confidence),...baselineKeys.filter(k=>i.template==='growth'||k!=='expansionCost').map(k=>levels.indexOf(b[k].confidence)))];
 const warnings:string[]=[];if(cases[0].profit>cases[1].profit||cases[1].profit>cases[2].profit)warnings.push('Case labels are not ordered by profit. Review your Downside/Base/Upside assumptions.');
 if(cases.some(c=>c.unmet>0))warnings.push('Capacity limits sales in at least one case; unmet demand is not recognized as revenue.');
 if(confidence==='Unknown')warnings.push('Input confidence is UNKNOWN. These are conditional calculations, not validated estimates.');
 return {ok:true as const,baseline,cases,sensitivity,threshold,confidence,warnings};
}
export type SimulationResult=Extract<ReturnType<typeof calculate>,{ok:true}>;
