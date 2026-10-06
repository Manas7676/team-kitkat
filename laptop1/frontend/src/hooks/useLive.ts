import {useEffect,useState} from 'react';
export const API=(import.meta.env.VITE_BACKEND_URL as string)||`http://${location.hostname}:8000`;
export const WSB=API.replace(/^http/,'ws');
export function useLive(){const [st,setSt]=useState<any>({hist:[],audit:[],incident:null,incidents:[],sub:null,wc:[],last:null,rx:0,online:false});const [now,setNow]=useState(Date.now());
 useEffect(()=>{let ws:WebSocket,t:any,dead=false;const i=setInterval(()=>setNow(Date.now()),1000);
  const open=()=>{ws=new WebSocket(WSB+'/ws/ui');ws.onopen=()=>setSt((s:any)=>({...s,online:true}));
   ws.onclose=()=>{setSt((s:any)=>({...s,online:false}));if(!dead)t=setTimeout(open,2000)};
   ws.onmessage=e=>{const m=JSON.parse(e.data);setSt((s:any)=>m.type=='snapshot'?{...s,incident:m.incident,incidents:m.incidents,audit:m.audit}:{...s,hist:[...s.hist,m.data].slice(-300),last:m.data,rx:Date.now(),sub:m.subsystems,wc:m.what_changed,incident:m.incident,incidents:m.incidents,audit:m.audit})}};
  open();return()=>{dead=true;clearTimeout(t);clearInterval(i);ws?.close()}},[]);
 return {...st,live:st.online&&now-st.rx<4000}}
