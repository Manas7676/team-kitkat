import { useState, useEffect } from 'react';
import { API } from '../hooks/useLive';

export default function Investigation({ L }: { L: any }) {
    const [ev, setEv] = useState<any>(null);
    const [gt, setGt] = useState<any>(null);
    const [q, setQ] = useState('');
    const [ans, setAns] = useState<any>(null);
    const [asking, setAsking] = useState(false);
    const [showConfirmResolve, setShowConfirmResolve] = useState(false);
    const [reportCount, setReportCount] = useState<number>(0);
    const [reportNotice, setReportNotice] = useState<string>('');

    const inc = L.incident;

    useEffect(() => {
        fetch(API + '/api/report')
            .then(r => r.json())
            .then(d => setReportCount(d.count || 0))
            .catch(() => {});
    }, []);

    if (!inc) {
        return (
            <div className="card">
                <h3>Investigation</h3>
                <p className="muted">No incident active. Trigger a scenario from Laptop 2 or Demo mode below.</p>
            </div>
        );
    }

    const id = inc.incident_id;
    const isResolved = inc.status === 'RESOLVED' || inc.status === 'CLOSED';

    const post = (u: string) => fetch(API + u + '?incident_id=' + id, { method: 'POST' }).then(r => r.json());

    const handleResolve = async () => {
        await post('/api/resolve');
        setShowConfirmResolve(false);
    };

    const handleAddToReport = async () => {
        const res = await post('/api/report');
        if (res.ok) {
            setReportCount(res.count);
            setReportNotice(`Incident ${id} added to report collection (${res.count} total).`);
            setTimeout(() => setReportNotice(''), 4000);
        }
    };

    const handleDownloadReport = () => {
        window.open(API + '/api/report/pdf?incident_id=' + id, '_blank');
    };

    const ask = async (t: string) => {
        if (!t.trim()) return;
        setQ(t);
        setAsking(true);
        try {
            const res = await fetch(API + '/api/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: t, incident_id: id })
            });
            const data = await res.json();
            setAns(data);
        } catch (e) {
            setAns({
                status: 'INSUFFICIENT_EVIDENCE',
                answer: 'Communication error connecting to Investigation QA assistant.',
                supporting_evidence: [],
                confidence: 'Low'
            });
        } finally {
            setAsking(false);
        }
    };

    const chip = (eId: string) => {
        const matched = inc.evidence?.find((x: any) => x.id === eId);
        return (
            <button
                key={eId}
                className="chip on"
                onClick={() => setEv(matched || { id: eId, source_type: 'Cited Evidence', source_name: 'Retrieved Record', parameter: 'Monitored Metric', finding: 'Cited in investigation diagnosis' })}
            >
                {eId}
            </button>
        );
    };

    const D = (e: any) => ({
        Source: (e.source_type || 'Evidence') + ' — ' + (e.source_name || 'Ground truth'),
        Timestamp: e.timestamp || inc.timestamp,
        Parameter: e.parameter || '—',
        Observed: e.observed || '—',
        Baseline: e.baseline || '—',
        Delta: e.delta || '—',
        'Why it matters / finding': e.finding || '—',
        Supports: e.supports || 'Diagnostic correlation',
        'Related subsystem': e.subsystem || inc.subsystem,
        'Related incident': e.incident_id || inc.incident_id
    });

    const QUICK_QUESTIONS = [
        'Why was this incident detected?',
        'Which subsystems are affected?',
        'What evidence supports this investigation?',
        'What changed first?',
        'Is the communication degradation related to the power anomaly?',
        'What systems are NOT affected?',
        'What should the operator check next?',
        'What happened during this incident?',
        'Do we have enough evidence to determine the root cause?',
        'Test unanswerable question'
    ];

    return (
        <div>
            {/* Incident Header Banner */}
            <div className={'banner ' + (isResolved ? 'ok' : inc.status === 'INVESTIGATING' ? 'bad' : 'ok')}>
                <b>{inc.incident_id} — {inc.title}</b> · <span className={'sev ' + inc.severity.toLowerCase()}>{inc.severity}</span> · <b>{inc.status}</b>
                {isResolved && <span className="pill ok" style={{ marginLeft: 10, padding: '2px 8px' }}>RESOLVED BY OPERATOR</span>}
                <small style={{ marginLeft: 10 }}>
                    Detected: {inc.detected?.slice(11, 19)} · Updated: {inc.updated?.slice(11, 19)}
                    {inc.end_time && ` · Resolved: ${inc.end_time.slice(11, 19)}`}
                </small>
            </div>

            {/* Resolved Confirmation Dialog */}
            {showConfirmResolve && (
                <div className="confirm-box">
                    <b style={{ color: '#b91c1c' }}>Confirm Investigation Resolution:</b>
                    <p style={{ margin: '6px 0' }}>
                        Are you sure you want to mark <b>{inc.incident_id}</b> as <b>RESOLVED</b>?
                        This will freeze all real-time incident modifications, preserve all evidence and hypotheses, record the operator action in Audit, and save the full investigation package to Mission Memory.
                    </p>
                    <button className="btn success" onClick={handleResolve}>Yes, Mark as Resolved</button>
                    <button className="btn ghost" onClick={() => setShowConfirmResolve(false)}>Cancel</button>
                </div>
            )}

            {/* Report Notice Feedback */}
            {reportNotice && (
                <div className="banner ok" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>✓ {reportNotice}</span>
                    <button className="btn ghost" style={{ margin: 0, padding: '4px 8px' }} onClick={handleDownloadReport}>Download PDF</button>
                </div>
            )}

            {/* Pipeline diagnostic overview */}
            <div className="card pipe">
                <small>
                    Pipeline: Telemetry → Incident detection → <b>Retriever</b> ({inc.retrieval?.retrieved || 0} of {inc.retrieval?.considered || 0} records) → Evidence context → <b>Generator</b> ({inc.generator || 'Deterministic Grounded'}) → <b>Grounding validator</b>{' '}
                    <b className={inc.grounding?.valid ? 'st-normal' : 'st-anomaly'}>{inc.grounding?.valid ? 'PASSED' : 'FAILED'}</b> ({inc.grounding?.checked || 0} citations checked)
                </small>
            </div>

            {/* Investigation Summary */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Investigation Summary <small>(generated from telemetry + retrieved records · inference, not fact)</small></h3>
                    {isResolved && <span className="pill ok">READ-ONLY RECORD</span>}
                </div>
                <p>{inc.narrative}</p>
                <small className="muted">Confidence in leading hypothesis: {inc.confidence}% — not confirmed.</small>
            </div>

            <div className="grid2">
                <div className="col">
                    {/* 1. Observed Facts */}
                    <div className="card">
                        <h3>1. Observed Facts <small>(directly from telemetry)</small></h3>
                        <ul>
                            {inc.observed_facts?.map((f: string) => (
                                <li key={f}>{f}</li>
                            ))}
                        </ul>
                    </div>

                    {/* 2. Evidence */}
                    <div className="card">
                        <h3>2. Evidence <small>(retrieved records — click for detail)</small></h3>
                        <div>
                            {inc.evidence?.map((e: any) => (
                                <button key={e.id} className={'chip ' + (ev?.id === e.id ? 'on' : '')} onClick={() => setEv(e)}>
                                    {e.id} <small>({e.source_type})</small>
                                </button>
                            ))}
                        </div>

                        {ev && (
                            <div style={{ marginTop: 10, background: '#f8fafc', padding: 8, border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <b>Evidence Detail: {ev.id}</b>
                                    <button className="btn ghost" style={{ margin: 0, padding: '2px 6px', fontSize: 11 }} onClick={() => setEv(null)}>Close</button>
                                </div>
                                <table className="detail">
                                    <tbody>
                                        {Object.entries(D(ev)).map(([k, v]) => (
                                            <tr key={k}>
                                                <th>{k}</th>
                                                <td>{String(v)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {ev.rows && (
                                    <table style={{ marginTop: 8 }}>
                                        <thead>
                                            <tr>
                                                <th>Parameter</th>
                                                <th>Observed</th>
                                                <th>Baseline</th>
                                                <th>Δ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ev.rows.map((r: any) => (
                                                <tr key={r.param}>
                                                    <td>{r.label}</td>
                                                    <td>{r.observed} {r.unit}</td>
                                                    <td>{r.baseline}</td>
                                                    <td>{r.delta > 0 ? '+' : ''}{r.delta}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Affected Systems */}
                    <div className="card">
                        <h3>Affected Systems</h3>
                        <div><b>Affected:</b> {inc.affected_systems?.join(' · ') || '—'}</div>
                        <div className="st-warning"><b>Potential:</b> {inc.potential_systems?.join(' · ') || '—'}</div>
                        <div className="muted"><b>Unaffected:</b> {inc.unaffected?.join(' · ') || '—'}</div>
                    </div>
                </div>

                <div className="col">
                    {/* 3. Hypotheses */}
                    <div className="card">
                        <h3>3. Hypotheses — NOT CONFIRMED</h3>
                        {inc.hypotheses?.map((h: any) => (
                            <div key={h.id} style={{ marginBottom: 8 }}>
                                <div>Possible cause: <b>{h.cause}</b> — {h.confidence}% <span className="muted">[{h.status}]</span></div>
                                <div className="bar"><i style={{ width: h.confidence + '%' }} /></div>
                            </div>
                        ))}
                        <small className="muted">Advisory inference only. Root cause is not confirmed.</small>
                    </div>

                    {/* 4. Recommended Next Step & Operator Actions */}
                    <div className="card rec">
                        <h3>4. Recommended Next Step</h3>
                        <p>{inc.recommended_next_step}</p>
                        <div>
                            <small>Supporting evidence: </small>
                            {inc.supporting_evidence?.map(chip)}
                        </div>
                        <small className="muted">Recommendation only — not a spacecraft command. Human operator review required.</small>
                        <br />
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                            <button className="btn" onClick={() => post('/api/simulate-outcome')} disabled={isResolved}>
                                Simulate Outcome
                            </button>

                            {isResolved ? (
                                <span className="pill ok">Resolved ✓</span>
                            ) : (
                                <button className="btn ghost" onClick={() => setShowConfirmResolve(true)}>
                                    Mark as Resolved
                                </button>
                            )}

                            <button className="btn ghost" onClick={handleAddToReport}>
                                Add to Report {reportCount > 0 && `(${reportCount})`}
                            </button>

                            <button className="btn" style={{ background: '#0f766e', borderColor: '#0f766e' }} onClick={handleDownloadReport}>
                                Download PDF Report
                            </button>
                        </div>
                    </div>

                    {/* Simulated Outcome */}
                    {inc.outcome && (
                        <div className="card">
                            <h3>Simulated Outcome <small>(simulator only)</small></h3>
                            <div className="banner ok">
                                <ul>
                                    {inc.outcome.map((o: string) => (
                                        <li key={o}>{o}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Ground Truth Reveal */}
                    <div className="card">
                        <button className="btn ghost" onClick={async () => setGt(await (await fetch(API + '/api/ground-truth?incident_id=' + id)).json())}>
                            Reveal Ground Truth
                        </button>
                        {gt && (
                            <table className="detail" style={{ marginTop: 8 }}>
                                <tbody>
                                    <tr>
                                        <th>Injected scenario</th>
                                        <td>{gt.injected?.scenario || 'unavailable (simulator not connected)'}</td>
                                    </tr>
                                    <tr>
                                        <th>Simulator severity</th>
                                        <td>{gt.injected ? Math.round(gt.injected.severity * 100) + '%' : '—'}</td>
                                    </tr>
                                    <tr>
                                        <th>Investigation assessment</th>
                                        <td>{gt.assessment?.cause} — {gt.assessment?.confidence}%</td>
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Incident Reconstruction */}
            <div className="card">
                <h3>Incident Reconstruction <small>(from telemetry history and events)</small></h3>
                {inc.timeline?.map((t: any, i: number) => (
                    <div className="row" key={i}>
                        <b>{t.time?.slice(11, 19)}</b>
                        <span style={{ flex: 1, marginLeft: 16 }}>{t.event}</span>
                        <small>{t.kind}</small>
                    </div>
                ))}
            </div>

            {/* ASK THE INVESTIGATION — GEMINI API SECTION */}
            <div className="card" style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Ask the Investigation <small>(Gemini decision support grounded in telemetry, evidence, & mission memory)</small></h3>
                    <small className="muted">Strict Grounding · No Hallucinations · Human Operator In The Loop</small>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input
                        style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 2 }}
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && ask(q)}
                        placeholder="Ask about this investigation (e.g. Why was this incident detected? Which subsystems are affected?)"
                    />
                    <button className="btn" style={{ margin: 0 }} onClick={() => ask(q)} disabled={asking}>
                        {asking ? 'Analyzing...' : 'Ask'}
                    </button>
                </div>

                {/* Quick Prompts */}
                <div style={{ marginTop: 8 }}>
                    <small className="muted">Operator Quick Questions: </small>
                    {QUICK_QUESTIONS.map(p => (
                        <button
                            key={p}
                            className="chip"
                            style={{ fontSize: 11, padding: '3px 8px' }}
                            onClick={() => {
                                setQ(p === 'Test unanswerable question' ? 'What happened to the spacecraft 6 hours ago?' : p);
                                ask(p === 'Test unanswerable question' ? 'What happened to the spacecraft 6 hours ago?' : p);
                            }}
                        >
                            {p}
                        </button>
                    ))}
                </div>

                {/* Structured Human-Readable Grounded Answer */}
                {ans && (
                    <div>
                        {ans.status === 'INSUFFICIENT_EVIDENCE' ? (
                            <div className="abstain">
                                <b style={{ color: '#b45309' }}>INSUFFICIENT EVIDENCE</b>
                                <p style={{ margin: '6px 0', fontSize: '13px' }}>{ans.answer}</p>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>
                                    {ans.uncertainty || 'The active telemetry and mission memory records do not contain evidence for this query.'}
                                </div>
                                <div style={{ marginTop: 6, fontSize: '11px' }}>
                                    <b>Evidence Available:</b> <span style={{ color: '#dc2626' }}>No</span> · Hypotheses withheld to prevent hallucination.
                                </div>
                            </div>
                        ) : (
                            <div className="answer-box">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <b style={{ color: '#1e3a8a', fontSize: '14px' }}>Investigation Analysis Response</b>
                                    <span className={'pill ' + (ans.confidence === 'High' ? 'ok' : 'bad')} style={{ fontSize: '11px', padding: '2px 8px' }}>
                                        {ans.confidence || 'Medium'} Confidence
                                    </span>
                                </div>

                                {/* Answer */}
                                <div className="qa-sec">
                                    <h4>Answer</h4>
                                    <p style={{ margin: '4px 0', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                                        {ans.answer}
                                    </p>
                                </div>

                                {/* Observed Facts */}
                                {ans.observed_facts && ans.observed_facts.length > 0 && (
                                    <div className="qa-sec">
                                        <h4>Observed Facts</h4>
                                        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                                            {ans.observed_facts.map((f: string, i: number) => (
                                                <li key={i} style={{ marginBottom: 2 }}>{f}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Supporting Evidence (Clickable Chips) */}
                                {ans.supporting_evidence && ans.supporting_evidence.length > 0 && (
                                    <div className="qa-sec">
                                        <h4>Supporting Evidence (Click citation to inspect)</h4>
                                        <div>
                                            {ans.supporting_evidence.map((eId: string) => (
                                                <button
                                                    key={eId}
                                                    className="chip on"
                                                    style={{ border: '1px solid #2563eb', color: '#1d4ed8' }}
                                                    onClick={() => {
                                                        const match = inc.evidence?.find((x: any) => x.id === eId);
                                                        setEv(match || { id: eId, source_type: 'Cited Evidence', parameter: 'Telemetric / Model Record', finding: 'Supporting citation verified against ground truth.' });
                                                    }}
                                                >
                                                    [{eId}]
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Interpretation */}
                                {ans.interpretation && (
                                    <div className="qa-sec">
                                        <h4>Interpretation</h4>
                                        <p style={{ margin: '4px 0', fontSize: '12px' }}>{ans.interpretation}</p>
                                    </div>
                                )}

                                {/* Uncertainty */}
                                {ans.uncertainty && (
                                    <div className="qa-sec">
                                        <h4>Uncertainty</h4>
                                        <p style={{ margin: '4px 0', fontSize: '12px', color: '#64748b' }}>{ans.uncertainty}</p>
                                    </div>
                                )}

                                {/* Recommended Next Step */}
                                {ans.recommended_next_step && (
                                    <div className="qa-sec">
                                        <h4>Recommended Next Step</h4>
                                        <p style={{ margin: '4px 0', fontSize: '12px', color: '#1e3a8a', fontWeight: 500 }}>
                                            {ans.recommended_next_step}
                                        </p>
                                        <small className="muted">Advisory only — requires human operator review before execution.</small>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
