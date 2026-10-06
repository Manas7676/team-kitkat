# Architecture (upgrade)
Laptop 2 UI (telemetry only, 1 Hz) -> ws /ws/telemetry -> FastAPI -> ws /ws/ui -> Laptop 1 React.
Blind mode: scenario/severity/ground truth stay on Laptop 2; Laptop 1 asks for them only when "Reveal Ground Truth" is clicked (backend sends reveal_request over the same socket).
Backend pipeline (backend/app): TelemetryAnalyzer + IncidentDetector (detector.py; rules in data/scenarios/incident_catalog.json) -> incidents.build/classify ->
EvidenceRetriever (retrieval.py; keyword overlap over data/knowledge/*.json, only matching records) -> InvestigationGenerator (generator.py; deterministic template, swappable for a local LLM)
-> GroundingValidator (drops citations that are not retrieved evidence; withholds the recommendation if none remain) -> MissionMemoryStore (memory.py; data/incidents/memory.json).
InvestigationQA answers only from existing incidents/evidence, otherwise abstains with INSUFFICIENT EVIDENCE. No ML, no external APIs.
Add a scenario: add an entry to incident_catalog.json plus knowledge records, and a generator case on Laptop 2. No frontend change.
