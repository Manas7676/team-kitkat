# Upgrade summary
Laptop 1 backend NEW: detector.py, retrieval.py, generator.py, incidents.py, memory.py, data/knowledge/*.json, data/scenarios/incident_catalog.json, data/incidents/.
Laptop 1 backend MODIFIED: main.py (multi-incident state, auto-close, cascade escalation, reveal handshake, /api/ask, /api/memory), investigation.py (removed thermal-only detect/build_package, added LABELS).
Laptop 1 frontend NEW: components/Alert.tsx. MODIFIED: App.tsx, hooks/useLive.ts, pages/Incidents|Investigation|Memory|Overview.tsx, styles.css.
Laptop 2 MODIFIED: frontend/src/App.tsx only (ground truth sent on reveal_request; sent unprompted only when Blind Mode is OFF).
Limitations: fixed-threshold rules; the "LLM" is a template generator; affected systems whose telemetry did not change are shown as Potential; delete data/incidents/memory.json to clear Mission Memory.
