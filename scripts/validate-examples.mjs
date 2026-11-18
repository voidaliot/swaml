import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {relative,sep} from 'node:path';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),cli=fileURLToPath(new URL('out/src/cli/main.js',root));
async function walk(path){const files=[];for(const e of await readdir(new URL(path,root),{withFileTypes:true})){if(e.name==='invalid')continue;if(e.isDirectory())files.push(...await walk(path+e.name+'/'));else if(e.name.endsWith('.swaml'))files.push(path+e.name);}return files;}
const positive=await walk('examples/');const run=files=>spawnSync(process.execPath,[cli,'--json',...files.map(f=>fileURLToPath(new URL(f,root)))],{encoding:'utf8',timeout:30000});
const checked=run(positive);if(checked.status!==0)throw Error(checked.stderr||checked.stdout);const report=JSON.parse(checked.stdout);
for(const name of (await readdir(new URL('examples/invalid/',root))).filter(f=>f.endsWith('.swaml'))){const r=run(['examples/invalid/'+name]);if(r.status!==1||!JSON.parse(r.stdout).errorCount)throw Error('Negative example was not rejected: '+name);}
// Every documented warning is pinned by file, code and position, so a new or vanished warning fails the gate.
const documentedWarnings={
    // The interrupt region discards input while inactive, as the example shows.
    'examples/19-interruptible-function.swaml':['SW2012 19:7'],
    // An abort that arrives outside the interruptible conversion is discarded, as the calibration bench shows.
    'examples/32-calibration-bench.swaml':['SW2012 82:9'],
    'examples/showcase/autosar-adaptive-v2x-telemetry.swaml':[
        // beginOwnEvent: transmitHazard checks the signed trailer against the frame built before signing.
        'SW2011 1078:7',
        // camCycle: transmitAwareness checks the trailer against, and records, the frame built before signing.
        'SW2011 1133:9',
        // repeatHazard: re-checks the event after signing, but the identity check uses the frame built before it.
        'SW2011 1178:9',
        // hazardLifecycle (migrated, states in the flow): the hazardCleared line's transmitHazard reaches the same pre-signing frame comparison.
        'SW2011 1208:11',
        // sampleTick: takeSample re-checks consent and the application state; the sampling divider is not re-read.
        'SW2011 1582:7',
        // The backoff wait is interruptible only while it runs; an abort outside it is deliberately discarded.
        'SW2012 1787:7',
        // uploadBuffered: the upload counter follows an acknowledgement compared with the batch read before the upload.
        'SW2011 1829:11'],
    // The NvM write-all cancel request only matters while the write-all runs; outside it, it is discarded.
    'examples/showcase/autosar-classic-door-controller.swaml':['SW2012 1342:7'],
    // flushWindow: storeRollup counts the rollup after the store request, under checks made before it.
    'examples/showcase/cloud-fleet-monitoring.swaml':['SW2011 1474:7',
        // circuit (migrated, states in the flow): write(t) runs in the else of the trip test and writes the failure count after
        // the store request, under that test, which the look made before the request.
        'SW2011 1430:13']};
const actualWarnings={};for(const d of report.diagnostics.filter(d=>d.severity===2)){const file=relative(fileURLToPath(root),fileURLToPath(d.uri)).split(sep).join('/');(actualWarnings[file]??=[]).push(`${d.code} ${d.range.start.line+1}:${d.range.start.character+1}`);}
for(const list of [...Object.values(actualWarnings),...Object.values(documentedWarnings)])list.sort();
assert.deepEqual(actualWarnings,documentedWarnings,'Example warnings differ from the documented warnings');
console.log(`Validated ${positive.length} complete examples and rejected both negative fixtures; ${report.diagnostics.filter(d=>d.severity===2).length} documented warning(s).`);
