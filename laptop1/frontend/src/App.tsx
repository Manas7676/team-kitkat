import { useRef, useState } from 'react'; import { useLive, WSB } from './hooks/useLive'; import { gen } from './utils/gen';
import Alert from './components/Alert'; import Overview from './pages/Overview'; import Telemetry from './pages/Telemetry'; import Incidents from './pages/Incidents'; import Investigation from './pages/Investigation'; import Memory from './pages/Memory'; import Audit from './pages/Audit';
const PAGES = ['Overview', 'Telemetry', 'Incidents', 'Investigation', 'Mission Memory', 'Audit'];
const DEMO: [string, string][] = [['THERMAL', 'THERMAL_01'], ['POWER', 'POWER_01'], ['NOISE', 'NOISE_01'], ['ATTITUDE', 'ATTITUDE_01'], ['COMMUNICATION', 'COMM_01'], ['PAYLOAD', 'PAYLOAD_01'], ['CASCADE', 'CASCADE_01']];
export default function App() {
    const L0 = useLive(); const [sel, setSel] = useState(''); const L = { ...L0, incident: (L0.incidents || []).find((i: any) => i.incident_id == sel) || L0.incident }; const [page, setPage] = useState('Overview'); const [demo, setDemo] = useState(''); const tm = useRef<any>(null);
    const runDemo = (sc: string) => { clearInterval(tm.current); const ws = new WebSocket(WSB + '/ws/telemetry'); let k = -5; ws.onopen = () => { ws.send(JSON.stringify({ type: 'ground_truth', data: { scenario: sc, severity: .7, blind: true } })); tm.current = setInterval(() => ws.send(JSON.stringify(gen(k < 0 ? 'NOMINAL' : sc, .7, k++))), 1000) }; ws.onclose = () => clearInterval(tm.current); setDemo(sc) };
    const inv = (L0.incidents || []).some((i: any) => i.status == 'INVESTIGATING');
    return <div><header><div><b className="title">kitkat have a break</b><br /><small>Mission: ORBIT-X / SIMULATION</small></div>
        <div className={L.live ? 'pill ok' : 'pill bad'}>{L.live ? 'LIVE • LAN' : 'OFFLINE / RECONNECTING'}<br /><small>Last telemetry: {L.last?.timestamp.slice(11, 19) || '—'}</small></div>
        <div className={inv ? 'pill bad' : 'pill ok'}>{inv ? 'INVESTIGATING' : 'NOMINAL'}</div><div><small>{L.last?.timestamp || ''}</small></div></header>
        <nav>{PAGES.map(p => <a key={p} className={p == page ? 'on' : ''} onClick={() => setPage(p)}>{p}</a>)}</nav>
        <Alert L={L0} go={setPage} setSel={setSel} /><main>{page == 'Overview' && <Overview L={L} go={setPage} />}{page == 'Telemetry' && <Telemetry L={L} />}{page == 'Incidents' && <Incidents L={L} go={setPage} setSel={setSel} />}{page == 'Investigation' && <Investigation L={L} />}{page == 'Mission Memory' && <Memory />}{page == 'Audit' && <Audit L={L} />}</main>
        <footer><span>Demo Mode (backup only):</span>{DEMO.map(([n, s]) => <button key={s} className={demo == s ? 'chip on' : 'chip'} onClick={() => runDemo(s)}>{n}</button>)}<span className="muted">Simulation environment · Evidence-grounded decision support · No autonomous spacecraft commands</span></footer></div>
}
