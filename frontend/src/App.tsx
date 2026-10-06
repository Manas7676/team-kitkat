import {useEffect,useRef,useState} from 'react';import Model from './components/Model';import {gen,SCENARIOS} from './utils/gen';
const DEF=(import.meta.env.VITE_WS_URL as string)||'ws://localhost:8000/ws/telemetry';
const SHOW:[string,string,string][]=[['temperature_a','Temperature A','°C'],['temperature_b','Temperature B','°C'],['bus_voltage','Bus Voltage','V'],['power','Power','W'],['battery_soc','Battery SOC','%'],['attitude_deviation','Attitude','°'],['communication_signal','Comm Signal','dBm'],['payload_load','Payload','W']];
export default function App(){const [url,setUrl]=useState(DEF);const [conn,setConn]=useState(false);const [run,setRun]=useState(true);const [blind,setBlind]=useState(true);const [sc,setSc]=useState('NOMINAL');const [sev,setSev]=useState(70);const [tel,setTel]=useState<any>(null);
 const ws=useRef<WebSocket|null>(null);const k=useRef(0);const st=useRef({run,sc,sev,blind});st.current={run,sc,sev,blind};
 useEffect(()=>{let t:any,dead=false;const open=()=>{const w=new WebSocket(url);ws.current=w;w.onopen=()=>setConn(true);w.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type=='reveal_request')w.send(JSON.stringify({type:'ground_truth',data:{scenario:st.current.sc,severity:st.current.sev/100,blind:st.current.blind}}))}catch{}};w.onclose=()=>{setConn(false);if(!dead)t=setTimeout(open,2000)}};open();return()=>{dead=true;clearTimeout(t);ws.current?.close()}},[url]);
 useEffect(()=>{const i=setInterval(()=>{const s=st.current;if(!s.run)return;const d=gen(s.sc,s.sev/100,k.current++);setTel(d);if(ws.current?.readyState==1)ws.current.send(JSON.stringify(d))},1000);return()=>clearInterval(i)},[]);
 const pick=(id:string)=>{setSc(id);k.current=0;if(!blind&&ws.current?.readyState==1)ws.current.send(JSON.stringify({type:'ground_truth',data:{scenario:id,severity:sev/100,blind}}))};
 const base=url.replace(/^ws/,'http').replace(/\/ws\/telemetry$/,'');const resetAll=()=>{fetch(base+'/api/reset',{method:'POST'}).catch(()=>{});setSev(70);pick('NOMINAL')};
 return <div><header><div><b className="title">ST-10 Spacecraft Simulator</b><br/><small>Mission: ORBIT-X / SIMULATION</small></div>
  <div className={run?'pill ok':'pill bad'}>Simulator: {run?'RUNNING':'STOPPED'}</div><div className={conn?'pill ok':'pill bad'}>{conn?'CONNECTED • LAN':'DISCONNECTED'}</div>
  <button className={blind?'btn':'btn ghost'} onClick={()=>setBlind(!blind)}>AI BLIND MODE: {blind?'ON':'OFF'}<br/><small style={{color:'inherit'}}>Faults hidden from ST-10</small></button><button className="btn ghost" onClick={resetAll}>Reset All</button></header>
  <main><div className="grid2"><div className="card"><h3>Spacecraft Model <small>ST-10 (Simplified)</small></h3><Model/></div>
  <div className="card"><h3>Scenario Controls</h3><div className="sc">{SCENARIOS.map(([id,n])=><button key={id} className={'chip'+(sc==id?' on':'')} onClick={()=>pick(id)}>{n}</button>)}</div>
  <p>Severity: <b>{sev}%</b> <input type="range" min={0} max={100} value={sev} onChange={e=>setSev(+e.target.value)}/></p>
  <button className="btn" onClick={()=>setRun(true)}>Start Simulation</button><button className="btn ghost" onClick={()=>setRun(false)}>Stop</button><button className="btn ghost" onClick={()=>pick('NOMINAL')}>Reset Scenario</button>
  <p><small>Backend URL</small><br/><input style={{width:'90%'}} value={url} onChange={e=>setUrl(e.target.value)}/></p>
  <p className="muted">Active scenario (known only to this simulator): <b>{SCENARIOS.find(s=>s[0]==sc)![1]}</b></p></div></div>
  <div className="card" style={{marginTop:12}}><h3>Live Telemetry <small>(generated) → streaming to ST-10</small></h3><div className="grid4">{SHOW.map(([k2,n,u])=><div key={k2}><small>{n} ({u})</small><div className="big">{tel?.[k2]??'—'}</div></div>)}</div></div></main></div>}
