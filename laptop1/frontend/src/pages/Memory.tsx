import {useEffect,useState} from 'react';import {API} from '../hooks/useLive';
const T=({t}:{t:any})=><table><tbody>{Object.entries(t||{}).filter(([k])=>k!='timestamp').map(([k,v])=><tr key={k}><td>{k}</td><td>{String(v)}</td></tr>)}</tbody></table>;
export default function Memory(){const [m,setM]=useState<any[]>([]);const [o,setO]=useState('');
 useEffect(()=>{const f=()=>fetch(API+'/api/memory').then(r=>r.json()).then(setM).catch(()=>{});f();const i=setInterval(f,3000);return()=>clearInterval(i)},[]);
 return <div className="card"><h3>Mission Memory <small>(completed incidents are stored as full reconstruction packages · relevance vs active incident)</small></h3><table><thead><tr><th>ID</th><th>Incident</th><th>Subsystem</th><th>Resolution</th><th>Relevance</th></tr></thead><tbody>
 {m.map(h=>{const r=h.record;return [<tr key={h.id} className={r?'click':''} onClick={()=>r&&setO(o==h.id?'':h.id)}><td><b>{h.id}</b>{r?' ▸':''}</td><td>{h.title}</td><td>{h.subsystem}</td><td>{h.resolution||'—'}</td><td>{h.similarity}%</td></tr>,
 r&&o==h.id&&<tr key={h.id+'d'}><td colSpan={5}><div className="grid2"><div>
  <p><b>{r.scenario_id}</b> · {r.severity} · {r.status} · start {r.start_time?.slice(11,19)} → end {r.end_time?.slice(11,19)||'—'}</p><p><b>Trigger:</b> {r.trigger}</p><p><b>Summary:</b> {r.summary}</p>
  <p><b>Affected:</b> {r.affected_systems.join(', ')||'—'} · <b>Potential:</b> {r.potential_systems.join(', ')||'—'} · <b>Unaffected:</b> {r.unaffected.join(', ')}</p>
  <p><b>Evidence:</b> {r.evidence.map((e:any)=>e.id+' ('+e.source_type+')').join(', ')}</p><p><b>Procedures:</b> {r.procedures.join(', ')}</p>
  <p><b>Hypotheses:</b> {r.hypotheses.map((x:any)=>x.cause+' '+x.confidence+'%').join(' · ')}</p><p><b>Recommendation:</b> {r.recommendation.text} [{r.recommendation.supporting_evidence.join(', ')}]</p>
  <p><b>Operator decision:</b> {r.operator_decision||'—'}</p><p><b>Simulated outcome:</b> {r.outcome?.join('; ')||'—'}</p><p><b>Resolution:</b> {r.resolution}</p><p><b>Ground truth:</b> {r.ground_truth?r.ground_truth.injected?.scenario:'not revealed'}</p></div>
  <div><b>What changed</b><table><tbody>{r.what_changed.map((w:any)=><tr key={w.parameter}><td>{w.parameter}</td><td>{w.baseline} → {w.current}</td><td>{w.change_pct}%</td></tr>)}</tbody></table>
  <b>Initial telemetry</b><T t={r.initial_telemetry}/><b>Abnormal telemetry</b><T t={r.abnormal_telemetry}/><b>Final telemetry</b><T t={r.final_telemetry}/></div></div>
  <b>Timeline</b>{r.timeline.map((t:any,i:number)=><div className="row" key={i}><b>{t.time.slice(11,19)}</b><span style={{flex:1,marginLeft:16}}>{t.event}</span></div>)}</td></tr>]})}</tbody></table></div>}
