# Run Laptop 2 (Windows)
  cd ST10-Laptop2\frontend
  copy .env.example .env
  Edit .env: single-PC test -> VITE_WS_URL=ws://localhost:8000/ws/telemetry
             two laptops   -> VITE_WS_URL=ws://192.168.10.1:8000/ws/telemetry
  npm install
  npm run dev -- --host 0.0.0.0
Open the shown URL (http://localhost:5173, or 5174 if Laptop 1 frontend runs on the same PC).
Set this laptop's IP to 192.168.10.2 / 255.255.255.0. Header must show CONNECTED • LAN (the backend URL can also be edited in the UI).
Click "Thermal Sensor Anomaly": Laptop 1 reacts after ~8-10 s (ramp). AI BLIND MODE ON = scenario/severity are sealed and only revealed by Laptop 1's "Reveal Ground Truth".
