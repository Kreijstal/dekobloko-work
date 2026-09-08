export function summarizePhase(times,start,end){
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw Error('Invalid phase interval');
 if(times.some((t,i)=>!Number.isFinite(t)||(i&&t<times[i-1])))throw Error('Invalid frame timestamps');
 const frames=times.filter(t=>t>start&&t<=end);
 const gaps=frames.slice(1).map((t,i)=>t-frames[i]);
 const sorted=[...gaps].sort((a,b)=>a-b);
 const percentile=p=>sorted.length?sorted[Math.ceil(sorted.length*p)-1]:null;
 const boundaries=[start,...frames,end];
 const spans=boundaries.slice(1).map((t,i)=>t-boundaries[i]);
 const upper=t=>{let lo=0,hi=frames.length;while(lo<hi){const m=(lo+hi)>>>1;
   if(frames[m]<=t)lo=m+1;else hi=m;}return lo;};
 const windowStarts=end-start>=1000?[start,end-1000,...frames.filter(t=>t<=end-1000)]:[];
 let worstOneSecondFps=null;
 for(const t of windowStarts){const count=upper(t+1000)-upper(t);
   worstOneSecondFps=worstOneSecondFps===null?count:Math.min(worstOneSecondFps,count);}
 return {durationMs:end-start,frames:frames.length,averageFps:frames.length*1000/(end-start),
   frameGapMs:{p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),
     max:sorted.length?sorted.at(-1):null},
   // Include censored edges: a freeze with no subsequent frame must not vanish.
   longestNoNewFrameMs:Math.max(...spans),worstOneSecondFps,
   fullFrameGaps:gaps.length,overBudget:gaps.filter(g=>g>1000/24).length,
   over100ms:gaps.filter(g=>g>100).length,over250ms:gaps.filter(g=>g>250).length,
   over1000ms:gaps.filter(g=>g>1000).length};
}
