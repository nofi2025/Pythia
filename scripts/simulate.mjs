import {readFile,writeFile} from 'node:fs/promises';
import {calculate,snapshotSchema} from '../lib/simulation.ts';
import {simulationReport} from '../lib/simulation-report.ts';
const [input,output]=process.argv.slice(2);
if(!input||!output){console.error('Usage: pnpm simulate input.json new-output.json');process.exit(1);}
try{
 const s=snapshotSchema.parse(JSON.parse(await readFile(input,'utf8')));const result=calculate(s.baseline,s.input);
 if(!result.ok)throw Error(result.errors.join('\n'));
 await writeFile(output,JSON.stringify({snapshot:s,result},null,2),{flag:'wx'});
 // No network or AI calls. HTML can be printed to PDF in a browser.
 await writeFile(output+'.html',simulationReport(s),{flag:'wx'});
 console.log(`Calculated ${s.input.title}. Wrote results and ${output}.html. Confidence: ${result.confidence}.`);
}catch(e){console.error(e.message);process.exitCode=1;}
