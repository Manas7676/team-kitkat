import Chart from '../components/Chart';import {PARAMS,pstatus,cls} from '../utils/params';
export default function Telemetry({L}:{L:any}){const base:any=Object.fromEntries(L.wc.map((w:any)=>[w.parameter,w.baseline]));
 return <div className="grid4">{PARAMS.map(([k,n,u])=>{const v=L.last?.[k];const b=base[k];return <div className="card" key={k}><h4>{n} ({u})</h4>
  <div className="big">{v??'—'}<small> {u}</small></div><small>Baseline {b??'—'} · Δ {v!=null&&b!=null?(v-b).toFixed(2):'—'} · <b className={cls(v!=null?pstatus(k,v):'normal')}>{v!=null?pstatus(k,v):'NORMAL'}</b></small>
  <small className="muted"><br/>{L.last?.timestamp}</small><Chart hist={L.hist} lines={[[k,'#2563eb']]} h={110}/></div>})}</div>}
