import Chart from '../components/Chart';import Model from '../components/Model';import {PARAMS,pstatus,cls} from '../utils/params';
const SUBS=['power','thermal','attitude','communication','payload'];
export const health=(sub:any)=>sub?Math.max(0,100-SUBS.reduce((a,k)=>a+(sub[k]=='ANOMALY'?10:sub[k]=='AFFECTED'?7:sub[k]=='WARNING'?5:0),0)-(sub.thermal=='ANOMALY'?0:0)):100;
export default function Overview({L,go}:{L:any,go:(p:string)=>void}){const sub=L.sub||{};const inc=L.incident;const pkg=inc;
 return <div className="grid3">
 <div className="col"><div className="card"><h3>Spacecraft Status</h3><div className="big">{health(L.sub)}%<small> Overall Health</small></div>
  {SUBS.map(k=><div className="row" key={k}><span style={{textTransform:'capitalize'}}>{k}</span><b className={cls(sub[k]||'NORMAL')}>{sub[k]||'NORMAL'}</b></div>)}</div>
  <div className="card"><h3>Spacecraft 3D Model (ST-10)</h3><Model hot={sub.thermal} sub={sub} incident={inc} telemetry={L.last} whatChanged={L.wc}/></div></div>
 <div className="col"><div className="card"><h3>Mission Telemetry <small>(real-time from simulator)</small></h3>
  <Chart hist={L.hist} incident={inc} lines={[['temperature_a','#dc2626'],['bus_voltage','#2563eb'],['power','#f59e0b'],['battery_soc','#16a34a']]}/>
  <small>— Temp A (°C) — Bus V — Power (W) — Battery SOC (%)</small></div>
  <div className="card"><h3>What Changed? <small>(baseline → current)</small></h3><table><thead><tr><th>Parameter</th><th>Baseline</th><th>Current</th><th>Change</th><th>Status</th></tr></thead><tbody>
  {L.wc.filter((w:any)=>['temperature_a','bus_voltage','power','battery_soc','attitude_deviation','communication_signal','payload_load'].includes(w.parameter)).map((w:any)=>{const p=PARAMS.find(x=>x[0]==w.parameter)!;const s=pstatus(w.parameter,w.current);
  return <tr key={w.parameter} className={w.significant?'sig':''}><td>{p[1]} ({p[2]})</td><td>{w.baseline}</td><td><b>{w.current}</b></td><td>{w.change_pct>0?'+':''}{w.change_pct}%</td><td className={cls(s)}>{s}</td></tr>})}</tbody></table></div></div>
 <div className="col"><div className="card"><h3>Active Incident</h3>{inc?<><div className={inc.status=='RESOLVED'?'banner ok':'banner bad'}><b>{inc.id} — {pkg.title}</b><br/>{inc.detected} · {inc.status}</div>
  <h4>Observed Facts <small>(from live telemetry)</small></h4><ul>{pkg.observed_facts.map((f:string)=><li key={f}>{f}</li>)}</ul>
  <h4>Possible Causes <small>(hypotheses — not confirmed)</small></h4>{pkg.hypotheses.map((h:any)=><div key={h.cause}>{h.cause} — {h.confidence}%<div className="bar"><i style={{width:h.confidence+'%'}}/></div></div>)}
  <button className="btn" onClick={()=>go('Investigation')}>Open Investigation →</button></>:<p className="muted">No active incident. All monitored parameters consistent with baseline rules.</p>}</div>
  <div className="card"><h3>Subsystem Impact</h3>{SUBS.map(k=>{const s=pkg?.subsystem_impact?.[k]||sub[k]||'NORMAL';return <div className="row" key={k}><span style={{textTransform:'capitalize'}}>{k}</span><b className={cls(s)}>{s}</b><small>{s=='NORMAL'?'No impact':'Impacted'}</small></div>})}</div></div></div>}
