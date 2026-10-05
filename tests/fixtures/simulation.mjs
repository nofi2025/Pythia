import {emptyBaseline,emptySimulation} from '../../lib/simulation.ts';
export function fixture(template='growth'){
 const baseline=emptyBaseline();const values={demand:10000,capacity:10000,price:100,unitCost:60,fixedCost:200000,expansionCost:10};
 for(const [k,v]of Object.entries(values))baseline[k]={value:v,source:'Illustrative test fixture; not customer data',origin:'Illustrative sample',confidence:'Medium'};
 const input=emptySimulation();Object.assign(input,{title:template==='growth'?'Expand annual capacity by 25%':'Supplier costs rise while demand falls',theory:'Illustrative model to verify decision arithmetic',template,assumptions:'Illustrative user assumptions, constant price and full-year capacity',confidence:'Low'});
 input.cases.forEach((c,j)=>{c.demand=(template==='growth'?[-10,10,30]:[-20,-10,0])[j];c.second=template==='growth'?25:[20,10,0][j];});
 return {baseline,input};
}
export function snapshot(template='growth') {return {id:crypto.randomUUID(),version:1,createdAt:new Date().toISOString(),company:'Fictional manufacturing company',...fixture(template),dependencies:[{id:'supplier',label:'Key supplier','kind':'Vendor'}],riskNotes:'User assumption: sole supplier may limit availability; financial effect unmodeled.',reviewNotes:''};}
