export const N:any={temperature_a:45,temperature_b:44,temperature_c:45,bus_voltage:21.0,current:2.1,battery_soc:72,solar_generation:145,attitude_deviation:0.8,communication_signal:-62,communication_latency:120,payload_load:38};
export const SCENARIOS:[string,string][]=[["NOMINAL","Nominal"],["THERMAL_01","Thermal Sensor Anomaly"],["POWER_01","Power Degradation"],["NOISE_01","Sensor Noise"],["ATTITUDE_01","Attitude Drift"],["COMM_01","Communication Degradation"],["PAYLOAD_01","Payload Overload"],["CASCADE_01","Cascading Failure"]];
const r=(a:number)=>(Math.random()*2-1)*a;
export function gen(sc:string,s:number,k:number){const d:any={...N};const e=s*Math.min(1,Math.max(k,0)/8);
 if(sc=="THERMAL_01")d.temperature_a+=55*e;
 else if(sc=="POWER_01"){d.solar_generation*=1-.5*e;d.battery_soc-=30*e;d.bus_voltage-=3.5*e}
 else if(sc=="NOISE_01"){["temperature_a","temperature_b","temperature_c"].forEach(x=>d[x]+=r(12*e));d.bus_voltage+=r(.8*e)}
 else if(sc=="ATTITUDE_01")d.attitude_deviation+=9*e;
 else if(sc=="COMM_01"){d.communication_signal-=40*e;d.communication_latency+=900*e}
 else if(sc=="PAYLOAD_01"){d.payload_load+=40*e;d.battery_soc-=12*e;d.current+=.8*e}
 else if(sc=="CASCADE_01"){d.solar_generation*=1-.6*e;d.battery_soc-=28*e;d.bus_voltage-=3*e;d.payload_load-=15*e;d.communication_signal-=25*e;d.communication_latency+=500*e}
 Object.keys(d).forEach(x=>d[x]+=r(.01*Math.abs(N[x])));d.power=d.bus_voltage*d.current;
 Object.keys(d).forEach(x=>d[x]=Math.round(d[x]*100)/100);d.timestamp=new Date().toISOString().slice(0,19)+"Z";return d}
