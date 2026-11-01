import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SWAML_LANGUAGE_VERSION } from '../language/edition.js';
const digest=(text:string|Buffer)=>createHash('sha256').update(text).digest('hex');
/** File/implementation identity belongs to this Node host, never the language core. */
export async function implementationIdentity(){
    const pkg=JSON.parse(await readFile(new URL('../../../package.json',import.meta.url),'utf8'));
    const paths=['cli/simulate','cli/run','cli/options','cli/evidence','simulation/simulator','simulation/values','simulation/timing','language/semantic','language/swaml-module','language/edition','language/swaml-validator','language/swaml-scope','language/swaml-document-builder','language/path-services','language/formatter','language/presentation','language/projection','language/standard-library','language/language-server','language/generated/ast','language/generated/grammar','language/generated/module'];
    const artifacts=await Promise.all(paths.map(async p=>({path:'src/'+p+'.js',sha256:digest(await readFile(new URL('../'+p+'.js',import.meta.url)))})));
    let dependencyLockSha256:string|undefined;try{dependencyLockSha256=digest(await readFile(new URL('../../../package-lock.json',import.meta.url)));}catch{/* A vendored workspace identifies dependencies through its own host pin. */}
    return {package:pkg.name,version:pkg.version,languageVersion:SWAML_LANGUAGE_VERSION,node:process.version,platform:process.platform,dependencies:pkg.dependencies,dependencyLockSha256,artifacts};
}
