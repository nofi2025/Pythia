import {readFile,writeFile} from 'node:fs/promises';
import {ingest} from '../lib/ingestion.ts';
import {dependencyFindings,dependencyStress} from '../lib/dependencies.ts';
const [inputPath,outputPath]=process.argv.slice(2);
if(!inputPath||!outputPath){console.error('Usage: pnpm ingest inventory.json result.json');process.exit(1);}
try{
 const bytes=await readFile(inputPath);if(bytes.length>1500000)throw Error('Input exceeds 1.5 MB limit');
 const result=ingest(JSON.parse(bytes.toString('utf8')));
 const output={...result,findings:dependencyFindings(result.assessment),stressCases:result.assessment.nodes.filter(n=>['Vendor','Infrastructure','Identity provider','Region'].includes(n.kind)).map(n=>({node:n.label,...dependencyStress(result.assessment,[n.id])})),method:'Deterministic ingestion; no external network or AI calls. Findings require analyst review.'};
 await writeFile(outputPath,JSON.stringify(output,null,2),{flag:'wx',mode:0o600});
 console.log(`Ingested ${result.assessment.systems.length} systems; ${output.findings.length} findings. Saved ${outputPath}.`);
}catch(error){console.error(error instanceof Error?error.message:'Ingestion failed');process.exit(1);}
