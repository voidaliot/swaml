#!/usr/bin/env bash
# PROTOTYPE P4/P6: regenerates the trace evidence of the hand-written models. Build first (npm run build).
# bash p6/evidence.sh [evidence dir]
set -u
export PATH="/e/GitHub/swaml-vsc-ext/.temp/node26/node-v26.12.0-win-x64:$PATH"
cd "$(dirname "$0")/.."
E=${1:-/e/GitHub/swaml-vsc-ext/.temp/kept/states-p6/evidence}
mkdir -p "$E"
run() { timeout 900 node p6/cases.mjs "$@" 2>&1; }
K="--kinds state,wake,write,send,publish,sample,violation,failure,assert,discardInput"
{
  echo "# Reading sample 8, sampled member (default: a look sees the cells when it runs, WP6-R03)"
  run p4-antipinch-sampled.swaml $K --subjects lifter.,bench. --writes pinchReversals
  echo; echo "# The same with P6_SAMPLE_AT_TRIGGER=1 (a look sees the cells as they were when its cause happened)"
  P6_SAMPLE_AT_TRIGGER=1 run p4-antipinch-sampled.swaml "Q2" $K --subjects lifter.,bench. --writes pinchReversals
  P6_SAMPLE_AT_TRIGGER=1 run p4-antipinch-sampled.swaml "Flip 5000 then 3000 at one" $K --subjects lifter.,bench. --writes pinchReversals
} > "$E/p4-sample8-sampled.txt"
run p4-antipinch-filtered.swaml --kinds state,write,send,violation,failure,assert --subjects lifter. --writes pinchReversals,motorCurrent > "$E/p4-sample8-filtered.txt"
{
  run p4-values.swaml $K --subjects ownAfter.,ownBefore.,heater.,shadowed.,base.,special.,usage.,busy.,Values --writes ready,left,temp,trips,seen50,a,b,flag
  echo; echo "# Variant P6_NO_PENDING_WAKE=1: a write while the machine is busy is lost"
  P6_NO_PENDING_WAKE=1 run p4-values.swaml "Write while" $K --subjects busy.,Values --writes left,flag
} > "$E/p4-values-and-wakes.txt"
run p4-stateloop.swaml --steps 200000 --kinds violation,failure,assert --subjects drain.,slowDrain.,pingPong.,growing.,handshake.,arrival.,asking.,StateLoops > "$E/p4-stateloop.txt"
K6="--kinds state,release,skip,send,publish,write,violation,failure,assert,periodicEnd,discardInput,sample"
run p6-window-10ms.swaml $K6 --subjects controller.,bench.,Window10ms --writes travel > "$E/p6-sample9-window-10ms.txt"
{
  run p6-periodic.swaml "B2" $K6 --subjects window.,bench.diag,bench.sense,Periodic --writes travel,answered
  run p6-periodic.swaml "Entered" $K6 --subjects chain.,bench.toChain,Periodic --writes visited
  run p6-periodic.swaml "Zero-time cycle in" $K6 --subjects spin.,bench.toSpin,Periodic
  run p6-periodic.swaml "grows" --steps 200000 --kinds violation,failure,assert --subjects chain.,Periodic
  run p6-periodic.swaml "End and" $K6 --subjects restart.,Periodic --writes restarts,lastLooks,lookLog
  run p6-periodic.swaml "Deadline" $K6 --subjects longLook.,bench.toLong,Periodic --writes looks
  run p6-periodic.swaml "Messages" $K6 --subjects messages.,in.,Periodic --writes got,ns
} > "$E/p6-periodic-cases.txt"
K6b="--kinds state,skip,send,publish,violation,failure,assert,periodicEnd,discardInput"
{
  run p6-traffic-connection.swaml Light $K6b --subjects light.,bench.ped,ped. --until 80e9
  run p6-traffic-connection.swaml Connection $K6b --subjects manager.,bench.link,link. --until 80e9
} > "$E/p6-traffic-connection-every-100ms.txt"
run p6-heater-supply.swaml --until 700e9 --kinds send,write,violation,failure,assert --subjects heater.,heaterStates.,supply.,supplyStates.,supplyTrap. --writes undervoltage,heating | awk '{ if ($0 ~ / write /) { v=$0; sub(/.*= /,"",v); if (last[$3]==v) next; last[$3]=v } print }' > "$E/p6-heater-supply-bench.txt"
timeout 900 node p6/timing.mjs > "$E/p6-timing-projection.txt" 2>&1
timeout 900 node p6/door.mjs > "$E/p6-door-showcase-rewrites-vs-original.txt" 2>&1
python p6/make-wp5.py && timeout 900 node p6/wp5.mjs > "$E/p4-wp5-44-46-47-rewrites.txt" 2>&1
echo "evidence written to $E"
