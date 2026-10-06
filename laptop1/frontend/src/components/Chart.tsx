import {LineChart,Line,XAxis,YAxis,Tooltip,ReferenceLine,ResponsiveContainer,CartesianGrid} from 'recharts';
export default function Chart({hist,lines,incident,h=220}:{hist:any[],lines:[string,string][],incident?:any,h?:number}){
 const data=hist.map(d=>({...d,t:d.timestamp.slice(11,19)}));const m=incident&&incident.detected.slice(11,19);
 return <ResponsiveContainer width="100%" height={h}><LineChart data={data}><CartesianGrid stroke="#eef1f6"/><XAxis dataKey="t" fontSize={10} minTickGap={40}/><YAxis fontSize={10} domain={['auto','auto']}/><Tooltip/>
 {lines.map(([k,c])=><Line key={k} dataKey={k} stroke={c} dot={false} isAnimationActive={false} strokeWidth={1.6}/>)}
 {m&&data.some(d=>d.t==m)&&<ReferenceLine x={m} stroke="#dc2626" strokeDasharray="4 3" label={{value:'Anomaly detected '+m,fontSize:10,fill:'#dc2626'}}/>}</LineChart></ResponsiveContainer>}
