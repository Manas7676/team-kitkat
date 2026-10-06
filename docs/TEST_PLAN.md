# Test plan (tick each)
1 Backend starts, 2 Laptop1 UI opens, 3 Laptop2 UI opens & CONNECTED, 4 Overview shows nominal 92-100% health,
5 Thermal: Temp A chart rises, incident #024 appears, Observed Facts/Evidence (click chips)/Hypotheses NOT CONFIRMED/Recommendation shown,
6 Simulate Outcome -> outcome + Audit entry, 7 Reveal Ground Truth -> THERMAL_01 / 70% / Sensor malfunction 87%,
8 Power/Noise/Attitude/Comm/Payload/Cascade: Telemetry page values and subsystem status change (no incident package yet),
9 Stop Laptop 2 -> header OFFLINE / RECONNECTING with last telemetry time; restart -> LIVE • LAN,
10 Footer Demo Mode buttons drive the backend with Laptop 2 off. Reset All clears incident/audit.
