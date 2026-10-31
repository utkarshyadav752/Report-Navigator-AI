import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Eye, Maximize2, ShieldCheck } from 'lucide-react';
import { Report } from '../types/report';

interface KnowledgeAtlas3DProps {
  report?: Report | null;
  onSelectPage?: (pageNumber: number) => void;
  isEmbeddedPreview?: boolean;
  onExpandFullScreen?: () => void;
}

// Session-level guard: if the browser has blocked WebGL context creation in this tab,
// skip further WebGL context requests so Three.js never logs context creation errors.
let webglUnavailableInSession = false;

// Pre-allocated module-scope scratch objects (Zero GC in render loop)
const _dummyMatrix = new THREE.Matrix4();
const _dummyPos = new THREE.Vector3();
const _dummyQuat = new THREE.Quaternion();
const _dummyScale = new THREE.Vector3();
const _tempColor = new THREE.Color();
const _raycaster = new THREE.Raycaster();
const _pointerNdc = new THREE.Vector2();

function createProceduralStoneTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 900; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    const r = (i % 3) + 1;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(100,116,139,0.12)' : 'rgba(255,255,255,0.22)';
    ctx.fillRect(x, y, r * 2, r);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createProceduralCodexPageTexture(
  pageCount: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, 464, 464);

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(44, 48, 424, 28);

  ctx.fillStyle = '#2563eb';
  ctx.fillRect(44, 88, 180, 10);

  for (let row = 0; row < 14; row++) {
    const y = 122 + row * 24;
    ctx.fillStyle = row % 4 === 0 ? '#334155' : '#cbd5e1';
    const width = row % 4 === 0 ? 320 : 410 - (row % 3) * 45;
    ctx.fillRect(44, y, width, 7);
  }

  const barColors = ['#2563eb', '#4f46e5', '#0284c7', '#4338ca', '#1d4ed8'];
  for (let b = 0; b < 5; b++) {
    const bh = 36 + ((b * 23 + pageCount * 11) % 64);
    ctx.fillStyle = barColors[b];
    ctx.fillRect(280 + b * 36, 456 - bh, 24, bh);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createRadialShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
  grad.addColorStop(0.6, 'rgba(15, 23, 42, 0.2)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Interactive 2D Canvas 3D-Projected Knowledge Atlas used when WebGL is blocked or unavailable.
 * Provides smooth 360-degree drag rotation, orbital rings, semantic vector nodes, and clickable page beacons.
 */
const InteractiveCanvas2DAtlas: React.FC<{
  pageCount: number;
  hasReport: boolean;
  onHoverPage: (page: number | null) => void;
  onSelectPage?: (page: number) => void;
}> = ({ pageCount, hasReport, onHoverPage, onSelectPage }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef({ yaw: 0.4, pitch: 0.38, dragging: false, lastX: 0, lastY: 0 });
  const beaconsScreenRef = useRef<Array<{ pageNum: number; x: number; y: number; r: number }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let isDisposed = false;

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth || 800;
      const h = parent.clientHeight || 480;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const project3D = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      yaw: number,
      pitch: number
    ) => {
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const rx = x * cosY - z * sinY;
      const rz = x * sinY + z * cosY;

      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const ry = y * cosP - rz * sinP;
      const rz2 = y * sinP + rz * cosP + 11.5;

      const scale = Math.min(w, h) * 0.82;
      const fov = scale / Math.max(2.5, rz2);
      return {
        sx: w * 0.5 + rx * fov,
        sy: h * 0.56 - ry * fov,
        depth: rz2,
        scale: fov,
      };
    };

    const renderFrame = (time: number) => {
      if (isDisposed) return;
      const parent = canvas.parentElement;
      const w = parent?.clientWidth || 800;
      const h = parent?.clientHeight || 480;

      if (!rotationRef.current.dragging) {
        rotationRef.current.yaw += 0.0045;
      }
      const { yaw, pitch } = rotationRef.current;

      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);

      // Subtle studio radial glow
      const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.52, 20, w * 0.5, h * 0.52, Math.max(w, h) * 0.55);
      bgGrad.addColorStop(0, 'rgba(30, 58, 138, 0.28)');
      bgGrad.addColorStop(0.55, 'rgba(15, 23, 42, 0.14)');
      bgGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Draw orbital ground rings
      for (const ringR of [2.4, 4.2, 5.4]) {
        ctx.beginPath();
        for (let s = 0; s <= 64; s++) {
          const a = (s / 64) * Math.PI * 2;
          const p = project3D(Math.cos(a) * ringR, 0, Math.sin(a) * ringR, w, h, yaw, pitch);
          if (s === 0) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
        }
        ctx.strokeStyle = ringR === 4.2 ? 'rgba(99, 102, 241, 0.35)' : 'rgba(51, 65, 85, 0.45)';
        ctx.lineWidth = ringR === 4.2 ? 1.5 : 1;
        ctx.stroke();
      }

      // Semantic vector satellite nodes
      for (let i = 0; i < 36; i++) {
        const theta = (i / 36) * Math.PI * 2 + time * 0.0003;
        const ringR = 2.65 + (i % 3) * 0.42;
        const yPos = 1.1 + Math.sin(i * 1.7 + time * 0.0015) * 0.55;
        const p = project3D(
          Math.cos(theta) * ringR,
          yPos,
          Math.sin(theta) * ringR,
          w,
          h,
          yaw,
          pitch
        );
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, Math.max(2, p.scale * 0.065), 0, Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(96, 165, 250, 0.75)' : 'rgba(129, 140, 248, 0.75)';
        ctx.fill();
      }

      // Page Pillars & Clickable Beacons
      const screenBeacons: Array<{ pageNum: number; x: number; y: number; r: number }> = [];
      for (let i = 0; i < pageCount; i++) {
        const pageNum = i + 1;
        const angle = (i / pageCount) * Math.PI * 2;
        const radius = 4.2;
        const px = Math.cos(angle) * radius;
        const pz = Math.sin(angle) * radius;

        const baseP = project3D(px, 0, pz, w, h, yaw, pitch);
        const topP = project3D(px, 1.45, pz, w, h, yaw, pitch);
        const beaconP = project3D(
          px,
          1.78 + Math.sin(time * 0.002 + i) * 0.06,
          pz,
          w,
          h,
          yaw,
          pitch
        );

        // Pillar column
        ctx.beginPath();
        ctx.moveTo(baseP.sx, baseP.sy);
        ctx.lineTo(topP.sx, topP.sy);
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.85)';
        ctx.lineWidth = Math.max(4, topP.scale * 0.24);
        ctx.lineCap = 'round';
        ctx.stroke();

        // Beacon crystal
        const br = Math.max(6, beaconP.scale * 0.16);
        ctx.beginPath();
        ctx.arc(beaconP.sx, beaconP.sy, br, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? '#6366f1' : '#38bdf8';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#e0e7ff';
        ctx.stroke();

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '600 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`P.${pageNum}`, beaconP.sx, beaconP.sy - br - 5);

        screenBeacons.push({ pageNum, x: beaconP.sx, y: beaconP.sy, r: br + 6 });
      }
      beaconsScreenRef.current = screenBeacons;

      // Central Knowledge Core & Codex Pedestal
      const coreBase = project3D(0, 0, 0, w, h, yaw, pitch);
      const coreMid = project3D(0, 2.0, 0, w, h, yaw, pitch);
      const coreCrystal = project3D(0, 3.15 + Math.sin(time * 0.0022) * 0.08, 0, w, h, yaw, pitch);

      ctx.beginPath();
      ctx.moveTo(coreBase.sx, coreBase.sy);
      ctx.lineTo(coreMid.sx, coreMid.sy);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = Math.max(10, coreMid.scale * 0.55);
      ctx.stroke();

      // Glowing Crystal Core
      const coreR = Math.max(14, coreCrystal.scale * 0.42);
      const coreGrad = ctx.createRadialGradient(
        coreCrystal.sx,
        coreCrystal.sy,
        2,
        coreCrystal.sx,
        coreCrystal.sy,
        coreR * 1.6
      );
      coreGrad.addColorStop(0, 'rgba(165, 180, 252, 0.95)');
      coreGrad.addColorStop(0.5, 'rgba(79, 70, 229, 0.65)');
      coreGrad.addColorStop(1, 'rgba(79, 70, 229, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(coreCrystal.sx, coreCrystal.sy, coreR * 1.6, 0, Math.PI * 2);
      ctx.fill();

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);

    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [pageCount]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block cursor-grab active:cursor-grabbing"
      onPointerDown={(e) => {
        rotationRef.current.dragging = true;
        rotationRef.current.lastX = e.clientX;
        rotationRef.current.lastY = e.clientY;
      }}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        if (rotationRef.current.dragging) {
          const dx = e.clientX - rotationRef.current.lastX;
          const dy = e.clientY - rotationRef.current.lastY;
          rotationRef.current.yaw += dx * 0.008;
          rotationRef.current.pitch = Math.max(
            0.12,
            Math.min(1.1, rotationRef.current.pitch + dy * 0.006)
          );
          rotationRef.current.lastX = e.clientX;
          rotationRef.current.lastY = e.clientY;
        }

        const hit = beaconsScreenRef.current.find(
          (b) => Math.hypot(b.x - mx, b.y - my) <= b.r
        );
        onHoverPage(hit ? hit.pageNum : null);
      }}
      onPointerUp={() => {
        rotationRef.current.dragging = false;
      }}
      onPointerLeave={() => {
        rotationRef.current.dragging = false;
        onHoverPage(null);
      }}
      onClick={(e) => {
        if (!hasReport || !onSelectPage) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const hit = beaconsScreenRef.current.find(
          (b) => Math.hypot(b.x - mx, b.y - my) <= b.r
        );
        if (hit) {
          onSelectPage(hit.pageNum);
        }
      }}
    />
  );
};

export const KnowledgeAtlas3D: React.FC<KnowledgeAtlas3DProps> = ({
  report,
  onSelectPage,
  isEmbeddedPreview = false,
  onExpandFullScreen,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [hoveredPageNum, setHoveredPageNum] = useState<number | null>(null);
  const [staticFallbackMode, setStaticFallbackMode] = useState<boolean>(() => {
    if (webglUnavailableInSession) return true;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  const pointerRef = useRef({ x: 0, y: 0, isHovered: false });
  const reportRef = useRef(report);
  const onSelectPageRef = useRef(onSelectPage);
  useEffect(() => {
    reportRef.current = report;
    onSelectPageRef.current = onSelectPage;
  }, [report, onSelectPage]);

  const pageCount = report ? Math.max(1, Math.min(12, report.pageCount)) : 8;
  const reportTitle = report ? report.title : 'Report Navigator AI — 3D Knowledge Core';
  const vectorCount = report ? report.chunks.length : 0;

  useEffect(() => {
    if (staticFallbackMode || webglUnavailableInSession) return;
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    // Create a single canvas and acquire the WebGL context BEFORE calling THREE.WebGLRenderer.
    // Never call WEBGL_lose_context.loseContext() so the browser never blocks the page for context loss,
    // and if WebGL context creation is unavailable/blocked, bail out cleanly before THREE.WebGLRenderer logs an error.
    const canvas = document.createElement('canvas');
    const contextAttributes: WebGLContextAttributes = {
      alpha: false,
      depth: true,
      stencil: false,
      antialias: true,
      powerPreference: 'default',
      preserveDrawingBuffer: true,
      failIfMajorPerformanceCaveat: false,
    };

    let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
    try {
      gl =
        (canvas.getContext('webgl2', contextAttributes) as WebGL2RenderingContext | null) ||
        (canvas.getContext('webgl', contextAttributes) as WebGLRenderingContext | null);
    } catch {
      gl = null;
    }

    if (!gl || (typeof gl.isContextLost === 'function' && gl.isContextLost())) {
      webglUnavailableInSession = true;
      setStaticFallbackMode(true);
      return;
    }

    const isSoftwareGl = (() => {
      try {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param) || '');
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    const width = mountEl.clientWidth || 800;
    const height = mountEl.clientHeight || 480;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        context: gl as WebGLRenderingContext,
        antialias: !isSoftwareGl,
        powerPreference: 'default',
        preserveDrawingBuffer: true,
      });
    } catch {
      webglUnavailableInSession = true;
      setStaticFallbackMode(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mountEl.innerHTML = '';
    mountEl.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';

    const onContextLost = (e: Event) => {
      e.preventDefault();
      webglUnavailableInSession = true;
      setStaticFallbackMode(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const scene = new THREE.Scene();
    const horizonColor = new THREE.Color(0x0f172a);
    scene.background = horizonColor;
    scene.fog = new THREE.FogExp2(0x0f172a, 0.032);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 120);
    camera.position.set(0, 4.6, 10.2);
    camera.lookAt(0, 1.5, 0);

    // OrbitControls: continuous smooth rotation + mouse-drag rotation + mobile touch rotation
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.5, 0);
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.6;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 4.0;
    controls.maxDistance = 18.0;

    // Three-Point Studio Lighting + Hemisphere Fill
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.9);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.3);
    keyLight.position.set(7, 12, 8);
    keyLight.castShadow = !isSoftwareGl;
    const d = 9;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.95);
    fillLight.position.set(-7, 5, 6);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 1.25);
    rimLight.position.set(-6, 7, -8);
    scene.add(rimLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const stoneBumpTex = createProceduralStoneTexture(maxAniso);
    const codexTex = createProceduralCodexPageTexture(pageCount, maxAniso);
    const shadowDiscTex = createRadialShadowTexture();

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
      metalness: 0.12,
      bumpMap: stoneBumpTex,
      bumpScale: 0.015,
    });

    const plinthStoneMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.65,
      metalness: 0.25,
      bumpMap: stoneBumpTex,
      bumpScale: 0.02,
    });

    const accentMetalMat = new THREE.MeshPhysicalMaterial({
      color: 0x3b82f6,
      roughness: 0.2,
      metalness: 0.88,
      clearcoat: 0.7,
      clearcoatRoughness: 0.15,
    });

    const columnMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.45,
      metalness: 0.45,
    });

    const codexPaperMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: codexTex,
      roughness: 0.62,
      metalness: 0.05,
    });

    const crystalDomeMat = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      roughness: 0.08,
      metalness: 0.05,
      transmission: isSoftwareGl ? 0 : 0.9,
      transparent: true,
      opacity: isSoftwareGl ? 0.38 : 1.0,
      ior: 1.52,
      thickness: 1.2,
      clearcoat: 1.0,
      depthWrite: false,
    });

    const activeBeaconMat = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      emissive: 0x4f46e5,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.5,
    });

    const inactiveBeaconMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.45,
    });

    const shieldGlowMat = new THREE.MeshStandardMaterial({
      color: 0x818cf8,
      emissive: 0x4f46e5,
      emissiveIntensity: 0.7,
      roughness: 0.18,
      metalness: 0.82,
    });

    const groundMesh = new THREE.Mesh(new THREE.CircleGeometry(32, 48), floorMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: shadowDiscTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const contactShadow = new THREE.Mesh(new THREE.CircleGeometry(4.4, 32), contactShadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.015;
    scene.add(contactShadow);

    // Multi-Part Rotational Sculpture Group
    const monumentGroup = new THREE.Group();
    monumentGroup.position.set(0, 0, 0);
    scene.add(monumentGroup);

    const basePlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.35, 0.36, 8),
      plinthStoneMat
    );
    basePlinth.position.y = 0.18;
    basePlinth.castShadow = true;
    basePlinth.receiveShadow = true;
    monumentGroup.add(basePlinth);

    const upperPlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(1.55, 1.85, 0.32, 24),
      plinthStoneMat
    );
    upperPlinth.position.y = 0.52;
    upperPlinth.castShadow = true;
    upperPlinth.receiveShadow = true;
    monumentGroup.add(upperPlinth);

    const baseRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.62, 0.055, 16, 48),
      accentMetalMat
    );
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.68;
    monumentGroup.add(baseRing);

    const lathePoints = [
      new THREE.Vector2(0.65, 0),
      new THREE.Vector2(0.52, 0.2),
      new THREE.Vector2(0.42, 0.8),
      new THREE.Vector2(0.48, 1.25),
      new THREE.Vector2(0.72, 1.45),
    ];
    const pedestalColumn = new THREE.Mesh(
      new THREE.LatheGeometry(lathePoints, 24),
      columnMat
    );
    pedestalColumn.position.y = 0.68;
    pedestalColumn.castShadow = true;
    monumentGroup.add(pedestalColumn);

    const lecternAssembly = new THREE.Group();
    lecternAssembly.position.y = 2.15;
    monumentGroup.add(lecternAssembly);

    const cradleShape = new THREE.Shape();
    cradleShape.moveTo(-1.15, -0.55);
    cradleShape.lineTo(1.15, -0.55);
    cradleShape.lineTo(1.15, 0.55);
    cradleShape.lineTo(-1.15, 0.55);
    cradleShape.closePath();
    const cradleGeo = new THREE.ExtrudeGeometry(cradleShape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04,
    });
    cradleGeo.center();
    const cradleMesh = new THREE.Mesh(cradleGeo, accentMetalMat);
    cradleMesh.rotation.x = -Math.PI * 0.32;
    cradleMesh.castShadow = true;
    lecternAssembly.add(cradleMesh);

    const leftLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 1.12), codexPaperMat);
    leftLeaf.position.set(-0.5, 0.12, 0.02);
    leftLeaf.rotation.x = -Math.PI * 0.32;
    leftLeaf.rotation.z = 0.12;
    leftLeaf.castShadow = true;
    lecternAssembly.add(leftLeaf);

    const rightLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 1.12), codexPaperMat);
    rightLeaf.position.set(0.5, 0.12, 0.02);
    rightLeaf.rotation.x = -Math.PI * 0.32;
    rightLeaf.rotation.z = -0.12;
    rightLeaf.castShadow = true;
    lecternAssembly.add(rightLeaf);

    // 3D Statistical Bar Chart Cluster beside the Codex
    const statChartGroup = new THREE.Group();
    statChartGroup.position.set(-1.35, 0.25, 0.55);
    lecternAssembly.add(statChartGroup);
    const barHeights = [0.28, 0.44, 0.62, 0.82];
    barHeights.forEach((bh, idx) => {
      const barMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, bh, 0.11),
        idx === 3 ? activeBeaconMat : inactiveBeaconMat
      );
      barMesh.position.set((idx - 1.5) * 0.16, bh / 2, 0);
      statChartGroup.add(barMesh);
    });

    // Verification Shield Symbol on the right flank of the Codex
    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(0, 0.32);
    shieldShape.lineTo(0.26, 0.22);
    shieldShape.lineTo(0.22, -0.08);
    shieldShape.lineTo(0, -0.32);
    shieldShape.lineTo(-0.22, -0.08);
    shieldShape.lineTo(-0.26, 0.22);
    shieldShape.closePath();
    const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    });
    shieldGeo.center();
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldGlowMat);
    shieldMesh.position.set(1.35, 0.52, 0.55);
    lecternAssembly.add(shieldMesh);

    const crystalGroup = new THREE.Group();
    crystalGroup.position.y = 1.05;
    lecternAssembly.add(crystalGroup);

    const crystalSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.44, 24, 24),
      crystalDomeMat
    );
    crystalSphere.renderOrder = 5;
    crystalGroup.add(crystalSphere);

    const innerCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), activeBeaconMat);
    crystalGroup.add(innerCore);

    const orbitCurve = new THREE.EllipseCurve(0, 0, 0.82, 0.82, 0, Math.PI * 2, false, 0);
    const orbitPoints3D = orbitCurve
      .getPoints(40)
      .map((p) => new THREE.Vector3(p.x, p.y, 0));
    const tubeCurve = new THREE.CatmullRomCurve3(orbitPoints3D, true);
    const orbitalRing = new THREE.Mesh(
      new THREE.TubeGeometry(tubeCurve, 48, 0.025, 8, true),
      accentMetalMat
    );
    orbitalRing.rotation.x = Math.PI * 0.25;
    orbitalRing.rotation.y = Math.PI * 0.18;
    crystalGroup.add(orbitalRing);

    const outerOrbitalRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.08, 0.018, 12, 48),
      shieldGlowMat
    );
    outerOrbitalRing.rotation.x = -Math.PI * 0.35;
    crystalGroup.add(outerOrbitalRing);

    // Page Pillars Ring
    const clickableBeacons: THREE.Mesh[] = [];
    const pillarBaseGeo = new THREE.CylinderGeometry(0.32, 0.38, 0.18, 12);
    const pillarShaftGeo = new THREE.BoxGeometry(0.38, 1.25, 0.24);
    const pillarTrimGeo = new THREE.BoxGeometry(0.44, 0.08, 0.3);
    const pillarBeaconGeo = new THREE.OctahedronGeometry(0.16, 0);

    for (let i = 0; i < pageCount; i++) {
      const pageNum = i + 1;
      const angle = (i / pageCount) * Math.PI * 2;
      const radius = 4.2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const pGroup = new THREE.Group();
      pGroup.position.set(x, 0, z);
      pGroup.lookAt(0, 0, 0);

      const pShadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), contactShadowMat);
      pShadow.rotation.x = -Math.PI / 2;
      pShadow.position.y = 0.015;
      pGroup.add(pShadow);

      const pBase = new THREE.Mesh(pillarBaseGeo, plinthStoneMat);
      pBase.position.y = 0.09;
      pGroup.add(pBase);

      const pShaft = new THREE.Mesh(pillarShaftGeo, columnMat);
      pShaft.position.y = 0.8;
      pShaft.castShadow = true;
      pGroup.add(pShaft);

      const pCap = new THREE.Mesh(pillarTrimGeo, accentMetalMat);
      pCap.position.y = 1.46;
      pGroup.add(pCap);

      const pBeacon = new THREE.Mesh(
        pillarBeaconGeo,
        i === 0 ? activeBeaconMat : inactiveBeaconMat
      );
      pBeacon.position.y = 1.78;
      pBeacon.userData = { pageNumber: pageNum };
      pGroup.add(pBeacon);
      clickableBeacons.push(pBeacon);

      scene.add(pGroup);
    }

    // InstancedMesh for 36 Semantic Vector Satellites
    const instanceCount = 36;
    const nodeGeo = new THREE.IcosahedronGeometry(0.085, 0);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.75,
    });
    const instancedNodes = new THREE.InstancedMesh(nodeGeo, nodeMat, instanceCount);
    const palette = [0x2563eb, 0x4f46e5, 0x38bdf8, 0x818cf8];

    for (let i = 0; i < instanceCount; i++) {
      const theta = (i / instanceCount) * Math.PI * 2;
      const ringR = 2.65 + (i % 3) * 0.42;
      const yPos = 1.1 + Math.sin(i * 1.7) * 0.65;
      _dummyPos.set(Math.cos(theta) * ringR, yPos, Math.sin(theta) * ringR);
      _dummyQuat.setFromEuler(new THREE.Euler(i * 0.3, theta, 0));
      const scaleVal = 0.85 + (i % 5) * 0.075;
      _dummyScale.set(scaleVal, scaleVal, scaleVal);
      _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
      instancedNodes.setMatrixAt(i, _dummyMatrix);
      _tempColor.setHex(palette[i % palette.length]);
      instancedNodes.setColorAt(i, _tempColor);
    }
    instancedNodes.instanceMatrix.needsUpdate = true;
    if (instancedNodes.instanceColor) instancedNodes.instanceColor.needsUpdate = true;
    instancedNodes.computeBoundingSphere();
    scene.add(instancedNodes);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let frameId = 0;
    let isDisposed = false;
    let lastTime = performance.now();
    let elapsedTotal = 0;

    function afterDraw(cb: () => void) {
      const renderGl = renderer.getContext() as WebGL2RenderingContext;
      const sync =
        renderGl && typeof renderGl.fenceSync === 'function'
          ? renderGl.fenceSync(renderGl.SYNC_GPU_COMMANDS_COMPLETE, 0)
          : null;
      if (renderGl && typeof renderGl.flush === 'function') {
        renderGl.flush();
      }
      const poll = () => {
        if (isDisposed) return;
        const state = sync && renderGl.getSyncParameter(sync, renderGl.SYNC_STATUS);
        if (state === renderGl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) renderGl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function stepScene(dt: number) {
      elapsedTotal += dt;

      // Continuous smooth rotation of core, rings, and satellite cloud
      innerCore.rotation.y += dt * 1.1;
      innerCore.rotation.x += dt * 0.65;
      orbitalRing.rotation.z += dt * 0.75;
      outerOrbitalRing.rotation.y -= dt * 0.55;
      instancedNodes.rotation.y += dt * 0.18;
      shieldMesh.rotation.y = Math.sin(elapsedTotal * 1.5) * 0.25;

      // Subtle hover & pointer parallax
      const targetTiltX = pointerRef.current.y * 0.14;
      const targetTiltY = pointerRef.current.x * 0.24;
      lecternAssembly.rotation.y = THREE.MathUtils.damp(
        lecternAssembly.rotation.y,
        targetTiltY,
        4,
        dt
      );
      crystalGroup.position.y = THREE.MathUtils.damp(
        crystalGroup.position.y,
        1.05 +
          Math.sin(elapsedTotal * 2.0) * 0.06 +
          (pointerRef.current.isHovered ? 0.08 : 0) +
          targetTiltX * 0.1,
        5,
        dt
      );

      for (let i = 0; i < clickableBeacons.length; i++) {
        clickableBeacons[i].rotation.y += dt * 0.9;
      }

      controls.update();
    }

    function animate() {
      if (isDisposed) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      stepScene(dt);
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(() => {
          if (!isDisposed) {
            frameId = requestAnimationFrame(animate);
          }
        });
      } else {
        frameId = requestAnimationFrame(animate);
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      pointerRef.current.x = nx;
      pointerRef.current.y = ny;
      pointerRef.current.isHovered = true;

      _pointerNdc.set(nx, ny);
      _raycaster.setFromCamera(_pointerNdc, camera);
      const intersects = _raycaster.intersectObjects(clickableBeacons, false);
      if (intersects.length > 0) {
        const pNum = intersects[0].object.userData?.pageNumber;
        if (typeof pNum === 'number') {
          setHoveredPageNum(pNum);
          renderer.domElement.style.cursor = 'pointer';
          return;
        }
      }
      setHoveredPageNum(null);
      renderer.domElement.style.cursor = 'grab';
    };

    const onPointerLeave = () => {
      pointerRef.current.isHovered = false;
      setHoveredPageNum(null);
    };

    const onClick = (e: MouseEvent) => {
      if (!reportRef.current || !onSelectPageRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      _pointerNdc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      _raycaster.setFromCamera(_pointerNdc, camera);
      const intersects = _raycaster.intersectObjects(clickableBeacons, false);
      if (intersects.length > 0) {
        const pNum = intersects[0].object.userData?.pageNumber;
        if (typeof pNum === 'number') {
          onSelectPageRef.current(pNum);
        }
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove, { passive: true });
    renderer.domElement.addEventListener('pointerleave', onPointerLeave, { passive: true });
    renderer.domElement.addEventListener('click', onClick);

    const handleResize = () => {
      if (!mountEl) return;
      const w = mountEl.clientWidth || 800;
      const h = mountEl.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => handleResize()) : null;
    if (resizeObserver) {
      resizeObserver.observe(mountEl);
    }

    // Immediate first frame draw then start smooth continuous rotation loop
    stepScene(0.016);
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(animate);

    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.dispose();

      // Dispose all geometries, materials, and procedural textures cleanly
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });
      stoneBumpTex.dispose();
      codexTex.dispose();
      shadowDiscTex.dispose();
      envTarget.dispose();
      renderer.dispose();
    };
  }, [pageCount, staticFallbackMode]);

  return (
    <div
      className={`relative w-full overflow-hidden bg-slate-950 text-slate-100 ${
        isEmbeddedPreview
          ? 'h-full min-h-[440px] rounded-xl border border-slate-800 shadow-sm'
          : 'h-[calc(100vh-4rem)]'
      }`}
      data-testid="knowledge-atlas-3d"
    >
      {/* WebGL Canvas or Interactive 2D Canvas 3D-Projected Fallback */}
      {staticFallbackMode ? (
        <InteractiveCanvas2DAtlas
          pageCount={pageCount}
          hasReport={Boolean(report)}
          onHoverPage={setHoveredPageNum}
          onSelectPage={onSelectPage}
        />
      ) : (
        <div ref={canvasMountRef} className="w-full h-full" />
      )}

      {/* Clean, Minimal Information Overlay (Solid rgba surface over WebGL per threejs skill) */}
      <div className="absolute top-4 left-4 right-4 sm:right-auto z-10 sm:max-w-md pointer-events-auto bg-slate-900/95 border border-slate-800 rounded-xl p-3.5 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-indigo-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            {report
              ? `3D Knowledge Atlas · ${report.pageCount} Pages · ${vectorCount} Vectors`
              : 'Interactive 3D Evidence Core · Smooth Rotation Active'}
          </span>
          {isEmbeddedPreview && onExpandFullScreen && (
            <button
              type="button"
              onClick={onExpandFullScreen}
              className="px-2.5 py-1 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" />
              Expand 3D View
            </button>
          )}
        </div>
        <h3 className="text-sm font-semibold text-white mt-1 truncate">{reportTitle}</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {hoveredPageNum && report
            ? `Hovering Page ${hoveredPageNum} Beacon — Click to inspect verbatim source`
            : 'Drag with mouse or touch to rotate 360° · Scroll to zoom'}
        </p>
        {report && onSelectPage && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400 font-mono tabular-nums">
              {report.tables.length} tables · {report.insights.length} insights
            </span>
            <button
              type="button"
              onClick={() => onSelectPage(hoveredPageNum || 1)}
              className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Eye className="w-3 h-3" />
              Inspect Source Page {hoveredPageNum || 1}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
