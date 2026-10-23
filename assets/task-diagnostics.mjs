// Bounded, document-local diagnostics. No keys, prompts, response text or persisted user data.
const samples=[];
export function recordTaskTiming(stage,start,status='success'){samples.push({stage,durationMs:Math.max(0,Math.round(performance.now()-start)),status,time:Date.now()});if(samples.length>120)samples.shift();}
export function taskTimings(){return structuredClone(samples);}
