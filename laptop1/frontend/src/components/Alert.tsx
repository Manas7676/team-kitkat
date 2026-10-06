import {cls} from '../utils/params';
export default function Alert({L,go,setSel}:{L:any,go:(p:string)=>void,setSel:(id:string)=>void}){
 const act=(L.incidents||[]).filter((i:any)=>i.status=='INVESTIGATING');if(!act.length)return null;
 return <div>{act.map((i:any)=><div className="alert" key={i.incident_id}>
  <b className={cls(i.state)}>⚠ {i.state}</b><span className={'sev '+i.severity.toLowerCase()}>{i.severity}</span><b>{i.title}</b><span>Subsystem: {i.subsystem}</span>
  {i.key_values.slice(0,2).map((k:any)=><span key={k.param}>{k.label}: <b>{k.observed} {k.unit}</b> · Baseline {k.baseline} · Δ {k.delta>0?'+':''}{k.delta} ({k.pct>0?'+':''}{k.pct}%)</span>)}
  <span>{i.detected.slice(11,19)} · <b>INVESTIGATING</b></span><a className="lnk" onClick={()=>{setSel(i.incident_id);go('Investigation')}}>Investigate →</a></div>)}</div>}
