import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface ModelProps {
  hot?: string;
  sub?: Record<string, string>;
  incident?: any;
  telemetry?: any;
  whatChanged?: any[];
  activeAnomalies?: string[];
}

// ============================================================================
// CENTRALIZED ANOMALY MARKERS CONFIGURATION
// ============================================================================
export interface AnomalyMarkerDef {
  id: string;
  label: string;
  anomalyType: string;
  target: string; // Target GLB node name to parent/attach to
  subsystem: 'power' | 'thermal' | 'attitude' | 'communication' | 'payload' | 'core';
  localOffset: [number, number, number]; // Position on or slightly above the target surface
  radius: number; // Small radius for professional mission diagnostics
  depth: number; // Subtle 3D thickness (thin cylinder/disc)
  color: string; // Color when active (alert red / warning amber)
  description: string;
}

export const ANOMALY_MARKERS: Record<string, AnomalyMarkerDef> = {
  solarPanelPowerFailure: {
    id: 'solarPanelPowerFailure',
    label: 'Solar Panel Power Failure',
    anomalyType: 'POWER_DEGRADATION',
    target: 'Solar Panels_28',
    subsystem: 'power',
    localOffset: [-4.2, 0.0, 0.08],
    radius: 0.38,
    depth: 0.04,
    color: '#ef4444',
    description: 'Photovoltaic generation degradation / cell string open-circuit'
  },
  solarPanelStarboardFailure: {
    id: 'solarPanelStarboardFailure',
    label: 'Starboard Solar Wing Degradation',
    anomalyType: 'SOLAR_MARGIN_LOW',
    target: 'Solar Panels_28',
    subsystem: 'power',
    localOffset: [4.2, 0.0, 0.08],
    radius: 0.38,
    depth: 0.04,
    color: '#ef4444',
    description: 'Starboard array voltage fluctuation & reduced efficiency'
  },
  antennaCommunicationFailure: {
    id: 'antennaCommunicationFailure',
    label: 'Antenna Communication Failure',
    anomalyType: 'COMMUNICATION_DEGRADATION',
    target: 'Disc_22',
    subsystem: 'communication',
    localOffset: [0.0, 0.0, 0.35],
    radius: 0.32,
    depth: 0.035,
    color: '#ef4444',
    description: 'Carrier link degradation / signal drop below -75 dBm'
  },
  antennaFeedGimbalFault: {
    id: 'antennaFeedGimbalFault',
    label: 'Antenna Feed & Gimbal Fault',
    anomalyType: 'RF_LINK_DROPOUT',
    target: 'Disc.Back_23',
    subsystem: 'communication',
    localOffset: [0.0, 0.0, -0.22],
    radius: 0.28,
    depth: 0.03,
    color: '#f59e0b',
    description: 'High-gain reflector gimbal pointing misalignment'
  },
  cameraLensFault: {
    id: 'cameraLensFault',
    label: 'Camera/Lens Fault',
    anomalyType: 'PAYLOAD_OVERLOAD',
    target: 'Lense_25',
    subsystem: 'payload',
    localOffset: [0.0, 0.0, 0.28],
    radius: 0.30,
    depth: 0.035,
    color: '#ef4444',
    description: 'Primary optical telescope sensor overload / draw > 50W'
  },
  cameraConnectorFault: {
    id: 'cameraConnectorFault',
    label: 'Payload Articulation Fault',
    anomalyType: 'PAYLOAD_ALIGNMENT',
    target: 'Lense.Connector_26',
    subsystem: 'payload',
    localOffset: [0.0, 0.18, 0.05],
    radius: 0.25,
    depth: 0.03,
    color: '#f59e0b',
    description: 'Optical payload gimbal actuator duty cycle warning'
  },
  grillThermalIssue: {
    id: 'grillThermalIssue',
    label: 'Thermal Grill Anomaly',
    anomalyType: 'THERMAL_DISAGREEMENT',
    target: 'Grill1_3',
    subsystem: 'thermal',
    localOffset: [0.0, 0.0, 0.16],
    radius: 0.30,
    depth: 0.035,
    color: '#ef4444',
    description: 'Radiator Louver 1 / Sensor A exceeds redundant sensors by > 20°C'
  },
  grillThermalIssue2: {
    id: 'grillThermalIssue2',
    label: 'Thermal Sensor Noise Fluctuation',
    anomalyType: 'SENSOR_NOISE',
    target: 'Grill2_5',
    subsystem: 'thermal',
    localOffset: [0.0, 0.0, 0.16],
    radius: 0.28,
    depth: 0.03,
    color: '#f59e0b',
    description: 'Thermal channel variance elevated across redundant sensor probes'
  },
  cableConnectionFault: {
    id: 'cableConnectionFault',
    label: 'Cable Connection Fault',
    anomalyType: 'ATTITUDE_DRIFT',
    target: 'Cable1.001_19',
    subsystem: 'attitude',
    localOffset: [0.0, 0.1, 0.06],
    radius: 0.26,
    depth: 0.03,
    color: '#ef4444',
    description: 'ADCS gyro / reaction wheel signal cable connection fault'
  },
  cablePowerBusFault: {
    id: 'cablePowerBusFault',
    label: 'EPS Power Bus Harness Fault',
    anomalyType: 'BUS_VOLTAGE_DROP',
    target: 'Cable3.001_21',
    subsystem: 'power',
    localOffset: [0.0, 0.1, 0.06],
    radius: 0.26,
    depth: 0.03,
    color: '#ef4444',
    description: 'Power distribution harness resistance drop / bus drawdown'
  },
  mainBusAvionicsFault: {
    id: 'mainBusAvionicsFault',
    label: 'Main Bus Avionics Core Failure',
    anomalyType: 'CASCADE_FAILURE',
    target: 'Body_2',
    subsystem: 'core',
    localOffset: [0.0, 0.0, 1.28],
    radius: 0.42,
    depth: 0.045,
    color: '#ef4444',
    description: 'Core spacecraft chassis / multi-subsystem cascading failure'
  }
};

// Known GLB components catalog
export interface KnownComponent {
  nodeName: string;
  aliasKey: string;
  displayName: string;
  subsystem: 'power' | 'thermal' | 'attitude' | 'communication' | 'payload' | 'core';
  description: string;
}

export const KNOWN_COMPONENTS: KnownComponent[] = [
  {
    nodeName: 'Solar Panels_28',
    aliasKey: 'solar_panel',
    displayName: 'Solar Panels Assembly',
    subsystem: 'power',
    description: 'Photovoltaic generation array wings'
  },
  {
    nodeName: 'Disc_22',
    aliasKey: 'dish',
    displayName: 'High-Gain Dish Reflector',
    subsystem: 'communication',
    description: 'Parabolic antenna reflector for high-speed carrier downlink'
  },
  {
    nodeName: 'Disc.Back_23',
    aliasKey: 'dish_back',
    displayName: 'Dish Rear Housing',
    subsystem: 'communication',
    description: 'Rear parabolic structure and RF waveguide backing'
  },
  {
    nodeName: 'Lense_25',
    aliasKey: 'lens',
    displayName: 'Optical Payload Lens',
    subsystem: 'payload',
    description: 'Primary scientific telescope aperture and imaging focal plane'
  },
  {
    nodeName: 'Lense.Connector_26',
    aliasKey: 'lens_connector',
    displayName: 'Lens Gimbal Connector',
    subsystem: 'payload',
    description: 'Precision articulating connector for optical payload pointing'
  },
  {
    nodeName: 'Lense.Ring_27',
    aliasKey: 'lens_ring',
    displayName: 'Lens Optical Ring Baffle',
    subsystem: 'payload',
    description: 'Sun-shielding baffle ring protecting sensor against solar glare'
  },
  {
    nodeName: 'Grill1_3',
    aliasKey: 'grill_1',
    displayName: 'Thermal Radiator Louver 1 (Sensor A)',
    subsystem: 'thermal',
    description: 'Heat rejection radiator panel with redundant Sensor A probe'
  },
  {
    nodeName: 'Grill2_5',
    aliasKey: 'grill_2',
    displayName: 'Thermal Radiator Louver 2 (Sensor B)',
    subsystem: 'thermal',
    description: 'Heat dissipation louvers with redundant Sensor B probe'
  },
  {
    nodeName: 'Grill3_16',
    aliasKey: 'grill_3',
    displayName: 'Thermal Radiator Louver 3 (Sensor C)',
    subsystem: 'thermal',
    description: 'Passive heat sink louvers with redundant Sensor C probe'
  },
  {
    nodeName: 'Cable1.001_19',
    aliasKey: 'cable_1',
    displayName: 'ADCS Harness Cable 1',
    subsystem: 'attitude',
    description: 'Attitude determination sensor harness & gyro signal conduit'
  },
  {
    nodeName: 'Cable2.001_20',
    aliasKey: 'cable_2',
    displayName: 'ADCS Harness Cable 2',
    subsystem: 'attitude',
    description: 'Reaction wheel control bus & star-tracker interface cable'
  },
  {
    nodeName: 'Cable3.001_21',
    aliasKey: 'cable_3',
    displayName: 'Power Bus Cable 3',
    subsystem: 'power',
    description: 'EPS power distribution harness connecting bus to batteries'
  },
  {
    nodeName: 'Body_2',
    aliasKey: 'body',
    displayName: 'Main Satellite Body & Bus',
    subsystem: 'core',
    description: 'Central spacecraft structural chassis housing OBC and power regulation'
  },
  {
    nodeName: 'Wings.Connector_4',
    aliasKey: 'wings_connector',
    displayName: 'Solar Wing Mount',
    subsystem: 'power',
    description: 'Structural boom mounting the solar panel assembly to main bus'
  }
];

// Helper interface for live 3D anomaly marker instance in Three.js
interface AnomalyMarkerInstance {
  def: AnomalyMarkerDef;
  group: THREE.Group;
  disc: THREE.Mesh;
  shadow: THREE.Mesh;
  rim: THREE.Mesh;
  discMat: THREE.MeshStandardMaterial;
  shadowMat: THREE.MeshBasicMaterial;
  rimMat: THREE.MeshBasicMaterial;
  currentOpacity: number;
}

export default function Model(props: ModelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);
  const [selectedNodeName, setSelectedNodeName] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [expanded, setExpanded] = useState<boolean>(false);

  // ==========================================================================
  // ANOMALY CONTROLLER STATE
  // By default in NORMAL state: empty set -> all markers are COMPLETELY INVISIBLE!
  // ==========================================================================
  const [activeAnomalySet, setActiveAnomalySet] = useState<Set<string>>(new Set());

  // 3D Scene refs
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const gltfRootRef = useRef<THREE.Group | null>(null);

  // Index of named nodes and marker instances
  const nodeIndexRef = useRef<Map<string, { node: THREE.Object3D; meshes: THREE.Mesh[] }>>(new Map());
  const markersRef = useRef<Map<string, AnomalyMarkerInstance>>(new Map());

  // ==========================================================================
  // ANOMALY CONTROLLER API (setAnomaly, clearAllAnomalies, setActiveAnomalies)
  // ==========================================================================
  const setAnomaly = useCallback((anomalyId: string, active: boolean) => {
    setActiveAnomalySet(prev => {
      const next = new Set(prev);
      if (active) {
        next.add(anomalyId);
      } else {
        next.delete(anomalyId);
      }
      return next;
    });
  }, []);

  const clearAllAnomalies = useCallback(() => {
    setActiveAnomalySet(new Set());
    setSelectedAnomalyId(null);
  }, []);

  const setActiveAnomalies = useCallback((anomalyIds: string[]) => {
    setActiveAnomalySet(new Set(anomalyIds));
  }, []);

  // Sync with incoming props.activeAnomalies or telemetry/incident if provided
  useEffect(() => {
    if (props.activeAnomalies && Array.isArray(props.activeAnomalies)) {
      setActiveAnomalySet(new Set(props.activeAnomalies));
      return;
    }

    // Live Incident mapping from mission operations
    const { hot, sub = {}, incident } = props;
    const sid = incident?.scenario_id || '';

    const newActive = new Set<string>();

    if (sid === 'POWER_01' || sub.power === 'ANOMALY') {
      newActive.add('solarPanelPowerFailure');
      newActive.add('cablePowerBusFault');
    }
    if (sid === 'COMM_01' || sub.communication === 'ANOMALY') {
      newActive.add('antennaCommunicationFailure');
    }
    if (sid === 'PAYLOAD_01' || sub.payload === 'ANOMALY') {
      newActive.add('cameraLensFault');
    }
    if (sid === 'THERMAL_01' || sub.thermal === 'ANOMALY' || hot === 'ANOMALY') {
      newActive.add('grillThermalIssue');
    }
    if (sid === 'NOISE_01' || sub.thermal === 'WARNING') {
      newActive.add('grillThermalIssue2');
    }
    if (sid === 'ATTITUDE_01' || sub.attitude === 'ANOMALY') {
      newActive.add('cableConnectionFault');
    }
    if (sid === 'CASCADE_01') {
      newActive.add('solarPanelPowerFailure');
      newActive.add('antennaCommunicationFailure');
      newActive.add('cameraLensFault');
      newActive.add('mainBusAvionicsFault');
    }

    if (newActive.size > 0) {
      setActiveAnomalySet(newActive);
    }
  }, [props.activeAnomalies, props.incident, props.sub, props.hot]);

  // Expose clean Anomaly Controller API globally on window
  useEffect(() => {
    const api = {
      setAnomaly,
      clearAllAnomalies,
      setActiveAnomalies,
      getActiveAnomalies: () => Array.from(activeAnomalySet),
      listAnomalies: () => Object.keys(ANOMALY_MARKERS),
      getAnomalyConfig: (id: string) => ANOMALY_MARKERS[id]
    };
    (window as any).ST10_ANOMALIES = api;
    (window as any).setAnomaly = setAnomaly;
    (window as any).clearAllAnomalies = clearAllAnomalies;
    (window as any).setActiveAnomalies = setActiveAnomalies;

    return () => {
      delete (window as any).ST10_ANOMALIES;
      delete (window as any).setAnomaly;
      delete (window as any).clearAllAnomalies;
      delete (window as any).setActiveAnomalies;
    };
  }, [setAnomaly, clearAllAnomalies, setActiveAnomalies, activeAnomalySet]);

  // Active anomaly set ref for continuous render loop access
  const activeAnomalySetRef = useRef(activeAnomalySet);
  activeAnomalySetRef.current = activeAnomalySet;

  // ==========================================================================
  // THREE.JS SCENE SETUP & GLB LOADING
  // ==========================================================================
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let width = Math.max(100, Math.floor(container.clientWidth || 320));
    let height = Math.max(100, Math.floor(container.clientHeight || 260));

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(4.5, 3.2, 5.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2.0;
    controls.maxDistance = 20;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // PROFESSIONAL MISSION LIGHTING
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunLight.position.set(10, 14, 10);
    scene.add(sunLight);

    const earthAlbedo = new THREE.DirectionalLight(0x38bdf8, 1.0);
    earthAlbedo.position.set(-8, -10, -6);
    scene.add(earthAlbedo);

    const fillLight = new THREE.DirectionalLight(0xfef08a, 0.5);
    fillLight.position.set(-6, 8, 6);
    scene.add(fillLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    // BACKGROUND STARFIELD
    const starGeo = new THREE.BufferGeometry();
    const starCount = 450;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      const r = 30 + Math.random() * 30;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      starPos[i] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i + 2] = r * Math.cos(phi);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x93c5fd, size: 0.5, transparent: true, opacity: 0.6 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // HELPER: BUILD 3D CIRCULAR ANOMALY MARKER OBJECT
    const create3DAnomalyMarker = (def: AnomalyMarkerDef): AnomalyMarkerInstance => {
      const group = new THREE.Group();
      group.name = `marker_${def.id}`;
      group.userData = { isAnomalyMarker: true, markerId: def.id, def };

      // 1. Contact Drop-Shadow Disc (Soft subtle depth effect behind the indicator)
      const shadowGeom = new THREE.CircleGeometry(def.radius * 1.15, 32);
      const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const shadow = new THREE.Mesh(shadowGeom, shadowMat);
      shadow.position.z = -def.depth * 0.55;
      shadow.renderOrder = 996;
      group.add(shadow);

      // 2. 3D Circular Indicator Body (Small thin cylinder/disc with physical 3D substance)
      const discGeom = new THREE.CylinderGeometry(def.radius, def.radius, def.depth, 32);
      // Orient cylinder so its circular cap faces along Z
      discGeom.rotateX(Math.PI / 2);

      const colorHex = new THREE.Color(def.color);
      const discMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.35,
        metalness: 0.25,
        emissive: colorHex,
        emissiveIntensity: 0.25,
        transparent: true,
        opacity: 0, // In NORMAL state: COMPLETELY INVISIBLE!
        depthWrite: true
      });
      const disc = new THREE.Mesh(discGeom, discMat);
      disc.userData = { isAnomalyMarker: true, markerId: def.id };
      disc.renderOrder = 998;
      group.add(disc);

      // 3. Subtle Outer Bevel Rim Ring (Aerospace machined bezel highlight)
      const rimGeom = new THREE.RingGeometry(def.radius * 0.92, def.radius * 1.04, 36);
      const rimMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const rim = new THREE.Mesh(rimGeom, rimMat);
      rim.position.z = def.depth * 0.55;
      rim.renderOrder = 999;
      group.add(rim);

      // In NORMAL state: COMPLETELY INVISIBLE
      group.visible = false;

      return {
        def,
        group,
        disc,
        shadow,
        rim,
        discMat,
        shadowMat,
        rimMat,
        currentOpacity: 0
      };
    };

    // LOAD THE GLB ASSET
    const loader = new GLTFLoader();
    setLoading(true);
    setLoadError(null);

    const modelUrl = '/simple_satellite_low_poly_free.glb';

    loader.load(
      modelUrl,
      (gltf) => {
        const rawModel = gltf.scene;

        const wrapper = new THREE.Group();
        wrapper.name = 'satellite_wrapper';
        scene.add(wrapper);
        gltfRootRef.current = wrapper;

        rawModel.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(rawModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        rawModel.position.set(-center.x, -center.y, -center.z);
        wrapper.add(rawModel);

        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const targetSize = 4.0;
        const scale = targetSize / maxDim;
        wrapper.scale.setScalar(scale);
        wrapper.updateMatrixWorld(true);

        camera.position.set(4.5, 3.2, 5.5);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();

        // Index nodes and create separate cloned materials
        const nodeMap = new Map<string, { node: THREE.Object3D; meshes: THREE.Mesh[] }>();
        const markerInstances = new Map<string, AnomalyMarkerInstance>();

        wrapper.traverse((obj) => {
          if (obj.name) {
            const meshes: THREE.Mesh[] = [];
            obj.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                if (Array.isArray(mesh.material)) {
                  mesh.material = mesh.material.map(m => m.clone());
                } else if (mesh.material) {
                  mesh.material = mesh.material.clone();
                }
                meshes.push(mesh);
              }
            });
            nodeMap.set(obj.name, { node: obj, meshes });
          }
        });

        // ======================================================================
        // ATTACH ANOMALY MARKERS DIRECTLY TO THEIR ASSOCIATED SATELLITE NODES
        // When satellite rotates, zooms, or pans, markers stay firmly attached!
        // ======================================================================
        Object.values(ANOMALY_MARKERS).forEach((def) => {
          const targetEntry = nodeMap.get(def.target);
          if (targetEntry) {
            const markerInst = create3DAnomalyMarker(def);
            // Position relative to target component's local space
            markerInst.group.position.set(def.localOffset[0], def.localOffset[1], def.localOffset[2]);

            // Parent marker directly to the target node inside the satellite hierarchy
            targetEntry.node.add(markerInst.group);
            markerInstances.set(def.id, markerInst);
          }
        });

        nodeIndexRef.current = nodeMap;
        markersRef.current = markerInstances;
        setLoading(false);
      },
      (xhr) => {
        if (xhr.total > 0) {
          setLoadProgress(Math.round((xhr.loaded / xhr.total) * 100));
        }
      },
      (err) => {
        console.error('Error loading satellite GLB:', err);
        setLoadError('Failed to load simple_satellite_low_poly_free.glb');
        setLoading(false);
      }
    );

    // CLICK INTERACTION & RAYCASTING
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerDown = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      if (!gltfRootRef.current) return;

      const intersects = raycaster.intersectObjects(gltfRootRef.current.children, true);
      if (intersects.length > 0) {
        // Check if user clicked an anomaly marker directly
        let hitMarker: AnomalyMarkerInstance | null = null;
        for (const hit of intersects) {
          let curr: THREE.Object3D | null = hit.object;
          while (curr && curr !== gltfRootRef.current) {
            if (curr.userData?.isAnomalyMarker && curr.userData?.markerId) {
              hitMarker = markersRef.current.get(curr.userData.markerId) || null;
              break;
            }
            curr = curr.parent;
          }
          if (hitMarker) break;
        }

        if (hitMarker) {
          // Identify clicked anomaly
          setSelectedAnomalyId(hitMarker.def.id);
          setSelectedNodeName(hitMarker.def.target);
          return;
        }

        // Otherwise select component node
        let hitObj: THREE.Object3D | null = intersects[0].object;
        let matchedNodeName = hitObj.name;
        while (hitObj && hitObj !== gltfRootRef.current) {
          if (hitObj.name && (KNOWN_COMPONENTS.some(k => k.nodeName === hitObj!.name) || nodeIndexRef.current.has(hitObj.name))) {
            matchedNodeName = hitObj.name;
            break;
          }
          hitObj = hitObj.parent;
        }
        if (matchedNodeName) {
          setSelectedNodeName(matchedNodeName);
          // Check if this component has an active anomaly
          const assocAnomaly = Object.values(ANOMALY_MARKERS).find(
            m => m.target === matchedNodeName && activeAnomalySetRef.current.has(m.id)
          );
          setSelectedAnomalyId(assocAnomaly ? assocAnomaly.id : null);
        }
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);

    // ANIMATION & MARKER VISUAL CONTROLLER LOOP
    const clock = new THREE.Clock();
    let reqId: number;

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      const deltaTime = Math.min(clock.getDelta(), 0.1);

      if (autoRotate && gltfRootRef.current) {
        gltfRootRef.current.rotation.y = elapsedTime * 0.12;
      }

      controls.update();

      // Slow, professional breathing pulse (~0.4 Hz, gentle and calm)
      const slowPulse = Math.sin(elapsedTime * 2.5);
      const scaleBreath = 1.0 + 0.04 * slowPulse; // Subtle 4% breathing scale
      const emissivePulse = 0.25 + 0.15 * slowPulse;

      const activeSet = activeAnomalySetRef.current;
      const markers = markersRef.current;

      // UPDATE EACH 3D ANOMALY MARKER'S VISIBILITY, OPACITY & DEPTH
      markers.forEach((marker) => {
        const isActive = activeSet.has(marker.def.id);

        // Smooth fade-in and fade-out transition
        const targetOpacity = isActive ? 0.78 : 0.0;
        marker.currentOpacity += (targetOpacity - marker.currentOpacity) * Math.min(1.0, deltaTime * 6.5);

        if (marker.currentOpacity > 0.005) {
          // ==================================================================
          // ANOMALY STATE: MARKER IS VISIBLE ON SATELLITE COMPONENT
          // ==================================================================
          marker.group.visible = true;

          // Apply subtle 3D breathing pulse to the indicator
          marker.group.scale.setScalar(scaleBreath);

          // Partial transparency (0.65–0.85) so satellite surface remains slightly visible behind it
          const activeDiscOpacity = Math.min(0.85, Math.max(0.65, marker.currentOpacity * (0.76 + 0.08 * slowPulse)));
          marker.discMat.opacity = activeDiscOpacity;
          marker.discMat.emissiveIntensity = emissivePulse;

          // Subtle contact drop-shadow depth under the marker
          marker.shadowMat.opacity = marker.currentOpacity * 0.35;

          // Subtle machined bezel rim
          marker.rimMat.opacity = marker.currentOpacity * 0.45;
        } else {
          // ==================================================================
          // NORMAL STATE: COMPLETELY INVISIBLE!
          // Does NOT appear as dots, outlines, shadows, or glowing objects!
          // ==================================================================
          marker.group.visible = false;
          marker.discMat.opacity = 0;
          marker.shadowMat.opacity = 0;
          marker.rimMat.opacity = 0;
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // RESIZE OBSERVER (PREVENTS GRID HORIZONTAL EXPANSION BLOWOUT)
    let lastW = width;
    let lastH = height;

    const handleResize = () => {
      if (!container) return;
      const newW = Math.max(100, Math.floor(container.clientWidth));
      const newH = Math.max(100, Math.floor(container.clientHeight));

      if (Math.abs(newW - lastW) < 2 && Math.abs(newH - lastH) < 2) return;
      lastW = newW;
      lastH = newH;
      width = newW;
      height = newH;

      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH, false);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(reqId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      renderer.dispose();
      controls.dispose();
    };
  }, [expanded]);

  // Focus camera on a target component
  const focusOnNode = (nodeName: string) => {
    setSelectedNodeName(nodeName);
    const entry = nodeIndexRef.current.get(nodeName);
    if (!entry || !cameraRef.current || !controlsRef.current || !gltfRootRef.current) return;

    setAutoRotate(false);
    const box = new THREE.Box3().setFromObject(entry.node);
    const center = box.getCenter(new THREE.Vector3());

    controlsRef.current.target.copy(center);
    cameraRef.current.position.set(center.x + 2.5, center.y + 2.0, center.z + 3.0);
  };

  const resetCamera = () => {
    setSelectedAnomalyId(null);
    setSelectedNodeName(null);
    if (!cameraRef.current || !controlsRef.current) return;
    controlsRef.current.target.set(0, 0, 0);
    cameraRef.current.position.set(4.5, 3.2, 5.5);
    setAutoRotate(true);
  };

  const activeAnomalyList = useMemo(() => {
    return Array.from(activeAnomalySet)
      .map(id => ANOMALY_MARKERS[id])
      .filter(Boolean);
  }, [activeAnomalySet]);

  const selectedAnomalyDef = selectedAnomalyId ? ANOMALY_MARKERS[selectedAnomalyId] : null;
  const selectedComp = selectedNodeName ? KNOWN_COMPONENTS.find(c => c.nodeName === selectedNodeName) : null;

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden', userSelect: 'none' }}>
      {/* 3D VIEWPORT CONTAINER */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          height: expanded ? '440px' : '260px',
          background: 'linear-gradient(145deg, #070d19 0%, #0d1b2e 50%, #0a1120 100%)',
          borderRadius: '6px',
          overflow: 'hidden',
          boxSizing: 'border-box',
          border: activeAnomalyList.length > 0 ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
          transition: 'height 0.25s ease, border-color 0.3s ease',
          boxShadow: activeAnomalyList.length > 0 ? '0 0 16px rgba(239, 68, 68, 0.3)' : 'none'
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'block'
          }}
        />

        {/* LOADING INDICATOR */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(7, 13, 25, 0.9)',
              color: '#93c5fd',
              fontSize: '12px',
              fontWeight: 600,
              zIndex: 30,
              gap: 8
            }}
          >
            <span>🛰️ Loading simple_satellite_low_poly_free.glb... {loadProgress > 0 ? `${loadProgress}%` : ''}</span>
            <div style={{ width: '140px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  background: '#38bdf8',
                  width: `${loadProgress || 45}%`,
                  transition: 'width 0.2s ease'
                }}
              />
            </div>
          </div>
        )}

        {loadError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(185, 28, 28, 0.9)',
              color: '#fff',
              fontSize: '12px',
              padding: 16,
              zIndex: 30
            }}
          >
            ⚠️ {loadError}
          </div>
        )}

        {/* TOP STATUS BAR & CAMERA CONTROLS */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            pointerEvents: 'none',
            zIndex: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'auto' }}>
            {activeAnomalyList.length > 0 ? (
              <span
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  animation: 'pulse 1s infinite'
                }}
              >
                <span>🚨</span>
                {activeAnomalyList.length} 3D ANOMALY MARKER{activeAnomalyList.length > 1 ? 'S' : ''} ACTIVE
              </span>
            ) : (
              <span
                style={{
                  background: 'rgba(22, 163, 74, 0.85)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <span>●</span> NORMAL STATE (MARKERS INVISIBLE)
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 4, pointerEvents: 'auto' }}>
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              title="Toggle Auto-Rotation"
              style={{
                background: autoRotate ? '#2563eb' : 'rgba(15, 23, 42, 0.8)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '3px',
                fontSize: '10px',
                padding: '3px 6px',
                cursor: 'pointer'
              }}
            >
              {autoRotate ? '⏸ Spin' : '▶ Spin'}
            </button>
            <button
              onClick={resetCamera}
              title="Reset 3D Camera"
              style={{
                background: 'rgba(15, 23, 42, 0.8)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '3px',
                fontSize: '10px',
                padding: '3px 6px',
                cursor: 'pointer'
              }}
            >
              ↺ Reset
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              title={expanded ? 'Minimize' : 'Expand 3D View'}
              style={{
                background: 'rgba(15, 23, 42, 0.8)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '3px',
                fontSize: '10px',
                padding: '3px 6px',
                cursor: 'pointer'
              }}
            >
              {expanded ? '▲ Collapse' : '▼ Expand'}
            </button>
          </div>
        </div>

        {/* BOTTOM ACTIVE ANOMALIES STRIP */}
        {activeAnomalyList.length > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              right: 8,
              background: 'rgba(185, 28, 28, 0.94)',
              color: '#fff',
              padding: '6px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              zIndex: 20
            }}
          >
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
              <b>ACTIVE 3D MARKER:</b> {activeAnomalyList.map(a => a.label).join(' · ')}
            </div>
            <button
              onClick={() => focusOnNode(activeAnomalyList[0].target)}
              style={{
                background: '#fff',
                color: '#b91c1c',
                border: 'none',
                fontWeight: 700,
                fontSize: '10px',
                padding: '3px 8px',
                borderRadius: '3px',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              Focus Marker →
            </button>
          </div>
        )}
      </div>

      {/* ANOMALY MARKER CONTROLLER TOOLBAR */}
      <div style={{ marginTop: 8, padding: '6px 8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>
            3D ANOMALY MARKER CONTROLLER
          </span>
          {activeAnomalySet.size > 0 && (
            <button
              onClick={clearAllAnomalies}
              style={{
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                fontSize: '10px',
                padding: '2px 6px',
                cursor: 'pointer'
              }}
            >
              Clear All Anomalies ✕
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Object.values(ANOMALY_MARKERS).map((marker) => {
            const isActive = activeAnomalySet.has(marker.id);
            return (
              <button
                key={marker.id}
                onClick={() => setAnomaly(marker.id, !isActive)}
                style={{
                  background: isActive ? '#dc2626' : '#ffffff',
                  color: isActive ? '#ffffff' : '#1e293b',
                  border: isActive ? '1.5px solid #991b1b' : '1px solid #cbd5e1',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '3px 7px',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 0 8px rgba(220, 38, 38, 0.35)' : 'none'
                }}
              >
                {isActive ? '● ' : '○ '}
                {marker.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SELECTED ANOMALY / COMPONENT INSPECTOR DRAWER */}
      {(selectedAnomalyDef || selectedComp) && (
        <div
          style={{
            marginTop: 8,
            padding: '8px 10px',
            background: selectedAnomalyDef ? '#fff1f2' : '#f8fafc',
            border: selectedAnomalyDef ? '1px solid #fecdd3' : '1px solid #cbd5e1',
            borderRadius: '4px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ color: selectedAnomalyDef ? '#be123c' : '#1e293b', fontSize: '12px' }}>
              {selectedAnomalyDef ? `🚨 ${selectedAnomalyDef.label}` : selectedComp?.displayName}
            </b>
            <button
              onClick={() => { setSelectedAnomalyId(null); setSelectedNodeName(null); }}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '11px' }}
            >
              ✕
            </button>
          </div>

          <div style={{ fontSize: '11px', marginTop: 2, color: '#475569' }}>
            <b>Component:</b> <code>{selectedAnomalyDef ? selectedAnomalyDef.target : selectedComp?.nodeName}</code> ·{' '}
            {selectedAnomalyDef ? selectedAnomalyDef.description : selectedComp?.description}
          </div>

          <div style={{ marginTop: 4, fontSize: '11px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>
              <b>Marker Status:</b>{' '}
              <span
                style={{
                  color: selectedAnomalyDef && activeAnomalySet.has(selectedAnomalyDef.id) ? '#dc2626' : '#15803d',
                  fontWeight: 600
                }}
              >
                {selectedAnomalyDef && activeAnomalySet.has(selectedAnomalyDef.id)
                  ? 'ACTIVE (3D Circular Indicator Visible)'
                  : 'NORMAL (Invisible)'}
              </span>
            </span>
            {selectedAnomalyDef && (
              <span>
                <b>Anomaly Type:</b> <code>{selectedAnomalyDef.anomalyType}</code>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
