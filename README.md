# ST-10 Spacecraft Simulator (Laptop 2) — Team KitKat

[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![License](https://img.shields.io/badge/Status-Offline%20Deterministic-green)]()

The **Spacecraft Simulator (Laptop 2)** serves as the high-fidelity telemetry generator and anomaly injection testbed for the **ST-10 Mission Operations Copilot** ecosystem. It generates streaming satellite subsystem telemetry at 1 Hz and transmits it in real-time over WebSockets to the Mission Operations Copilot (Laptop 1).

---

## 🛰️ Overview

In the ST-10 dual-laptop configuration:
* **Laptop 1 (Mission Operations Copilot)**: Ingests telemetry, detects anomalies, queries deterministic mission knowledge bases, correlates incidents, and suggests corrective procedures.
* **Laptop 2 (Spacecraft Simulator - This Repo)**: Simulates spacecraft telemetry, models nominal operations and anomaly scenarios, and validates Copilot detection accuracy using a sealed **"AI Blind Mode"** ground truth protocol.

---

## ✨ Key Features

- **Real-Time Telemetry Streaming (1 Hz)**: Streams 11 distinct telemetry channels via WebSocket (`ws://<host>:8000/ws/telemetry`).
- **Interactive Simulator UI**: React + Vite dashboard featuring a visual spacecraft subsystem model, scenario selection chips, severity adjustment slider, and live data telemetry tiles.
- **AI Blind Mode**: Ground truth (active scenario name and severity) remains sealed within Laptop 2. Laptop 1 only receives raw sensor telemetry until an operator clicks **"Reveal Ground Truth"**, initiating a handshake verification.
- **7 Anomaly Injection Scenarios**:
  - `THERMAL_01`: Thermal sensor A drift / runaway temperature spike.
  - `POWER_01`: Solar panel degradation and accelerated battery discharge.
  - `NOISE_01`: Sensor bus white noise perturbation across multiple channels.
  - `ATTITUDE_01`: Reaction wheel anomaly / attitude orientation deviation.
  - `COMM_01`: Signal attenuation (dBm drop) and communications packet latency spike.
  - `PAYLOAD_01`: High-draw payload anomaly with excessive current consumption.
  - `CASCADE_01`: Compound cascading failure across power, communications, and thermal subsystems.
- **Headless Python Generator (`tools/sim.py`)**: Standalone CLI script for automated test pipelines and headless anomaly simulation.
- **One-Click Windows Launcher (`START_LAPTOP2.bat`)**: Automated dependency check, installation, and multi-interface host launch.

---

## 📊 Telemetry Channels & Schema

Each telemetry packet is streamed as JSON every 1 second:

| Field | Type | Unit | Description | Nominal Range |
|---|---|---|---|---|
| `timestamp` | string | ISO UTC | UTC timestamp of packet generation | — |
| `temperature_a` | float | °C | Thermal Sensor A (Payload / Core) | 43 – 47 °C |
| `temperature_b` | float | °C | Thermal Sensor B (Avionics) | 42 – 46 °C |
| `temperature_c` | float | °C | Thermal Sensor C (Battery pack) | 43 – 47 °C |
| `bus_voltage` | float | V | Main EPS Bus Voltage | 20.5 – 21.5 V |
| `current` | float | A | Total System Current Draw | 1.9 – 2.3 A |
| `power` | float | W | Computed System Power (`voltage * current`) | ~40 – 48 W |
| `battery_soc` | float | % | Battery State of Charge | 68 – 76 % |
| `solar_generation`| float | W | Solar Array Power Output | 140 – 150 W |
| `attitude_deviation`| float | ° | Attitude Offset from Target Pointing | 0.5 – 1.2° |
| `communication_signal` | float | dBm | RF Transceiver Received Signal Strength | -65 to -59 dBm |
| `communication_latency`| float | ms | Comm Round-Trip Latency | 100 – 140 ms |
| `payload_load` | float | W | Active Scientific Payload Draw | 35 – 41 W |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher) and `npm`
- **Python** 3.10+ (optional, only for the standalone CLI runner in `tools/`)

### Option 1: Quick Start (Windows Launcher)
Simply double-click:
```bat
START_LAPTOP2.bat
```
This automatically verifies dependencies, runs `npm install` if needed, and starts the Vite development server bound to all local network interfaces (`0.0.0.0`).

---

### Option 2: Manual Start (Web Simulator)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Copy the environment configuration:
   ```bash
   copy .env.example .env
   ```

3. Configure your backend WebSocket target in `.env`:
   - **Single PC Testing**:
     ```env
     VITE_WS_URL=ws://localhost:8000/ws/telemetry
     ```
   - **Dual-Laptop LAN Setup**:
     ```env
     VITE_WS_URL=ws://192.168.10.1:8000/ws/telemetry
     ```

4. Install dependencies and start the simulator:
   ```bash
   npm install
   npm run dev -- --host 0.0.0.0
   ```

5. Open the UI in your browser:
   - Local: `http://localhost:5173` (or `5174` if port is occupied)
   - LAN: `http://<laptop2-ip>:5173`

---

### Option 3: Headless CLI Simulator (`tools/sim.py`)

Run telemetry scenarios directly from the terminal without launching the frontend:

```bash
cd tools
pip install -r requirements.txt

# Run nominal baseline
python sim.py --scenario NOMINAL

# Inject a thermal anomaly with 70% severity after 10 seconds in blind mode
python sim.py --scenario THERMAL_01 --severity 0.7 --after 10 --blind

# Point to custom backend IP
python sim.py --url ws://192.168.10.1:8000/ws/telemetry --scenario CASCADE_01 --severity 0.8
```

---

## 🌐 Dual-Laptop Network Configuration

To run Laptop 1 and Laptop 2 over a dedicated Ethernet switch or direct crossover cable:

1. **Laptop 1 (Mission Operations Copilot)**:
   - IP Address: `192.168.10.1`
   - Subnet Mask: `255.255.255.0`
   - Start backend: `uvicorn app.main:app --host 0.0.0.0 --port 8000`

2. **Laptop 2 (Spacecraft Simulator)**:
   - IP Address: `192.168.10.2`
   - Subnet Mask: `255.255.255.0`
   - Ensure you can ping Laptop 1: `ping 192.168.10.1`
   - Open Simulator UI and verify header status shows **`CONNECTED • LAN`**.

---

## 📁 Repository Structure

```text
team-kitkat/
├── docs/                      # Architectural & protocol specifications
│   ├── ARCHITECTURE.md        # Pipeline and blind mode architecture
│   ├── CONTRACT.md            # Intersystem protocol and channel definition
│   ├── TELEMETRY_SCHEMA.md    # Field definitions and units
│   ├── TEST_PLAN.md           # End-to-end integration checklist
│   └── TROUBLESHOOTING.md     # Common failure modes and diagnostics
├── frontend/                  # React + Vite Simulator Dashboard
│   ├── src/
│   │   ├── components/        # Subsystem visualizer components
│   │   ├── utils/             # Telemetry formula & ramp generator
│   │   ├── App.tsx            # Main simulator control panel
│   │   └── styles.css         # Dark theme mission control styling
│   ├── package.json
│   └── vite.config.ts
├── tools/                     # Standalone CLI tools
│   ├── requirements.txt       # Python dependencies (websockets)
│   └── sim.py                 # Standalone async WebSocket generator
├── START_LAPTOP2.bat          # Automated Windows runner
├── RUN_LAPTOP2.md             # Execution instructions
└── README.md                  # Project overview and documentation
```

---

## 🔍 Validation & Blind Mode Workflow

1. Start both Laptop 1 and Laptop 2.
2. Confirm header status reads **`CONNECTED • LAN`**.
3. Toggle **`AI BLIND MODE: ON`** on Laptop 2.
4. Select **`Thermal Sensor Anomaly`** and adjust severity to `70%`.
5. Observe telemetry streaming in real time — `temperature_a` ramps over 8 seconds.
6. Check Laptop 1: Incident #024 is autonomously raised, relevant evidence retrieved, and recommendations generated without any foreknowledge of the fault.
7. Click **`Reveal Ground Truth`** on Laptop 1 to verify match against Laptop 2's ground truth.