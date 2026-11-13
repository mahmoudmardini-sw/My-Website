/* Cinematic PCB flythrough — Three.js scene for the hero card and cinema mode. */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const TAU = Math.PI * 2;
const TEASER_DURATION = 4;
const CINEMA_DURATION = 10.5;
const ACT_BOUNDARIES = [0, 3.6, 7, CINEMA_DURATION];

const PALETTE = {
  bg: 0x02060c,
  teal: 0x39e6d2,
  tealSoft: 0x1d8d87,
  cyan: 0x77f7ff,
  indigo: 0x7f8cff,
  gold: 0xd0a052,
  amber: 0xf2b85b,
  board: 0x061918,
  boardDeep: 0x04100f,
};

const TEASER_KEYS = [
  { t: 0, p: [18.8, 9.8, 21.5], target: [0, 0.3, 0], fov: 42 },
  { t: 1.15, p: [12.4, 6.4, 14.6], target: [0, 0.58, 0], fov: 41 },
  { t: 2.45, p: [7.1, 3.6, 9.3], target: [0, 0.92, 0], fov: 40 },
  { t: 3.55, p: [4.7, 2.7, 7], target: [0, 1.12, 0], fov: 40 },
];

const CINEMA_KEYS = [
  { t: 0, p: [15.4, 8.2, 18], target: [0, 0.25, 0], fov: 42 },
  { t: 1.25, p: [10.4, 5.4, 13], target: [-0.3, 0.5, 0], fov: 41 },
  { t: 2.7, p: [5.5, 3, 7.7], target: [0, 0.82, 0], fov: 39 },
  { t: 3.9, p: [2.55, 1.7, 3.85], target: [0, 1.28, 0], fov: 36 },
  { t: 5, p: [0.9, 1.42, 1.95], target: [0, 1.62, 0], fov: 34 },
  { t: 6.15, p: [0.45, 2.35, 2.45], target: [0, 2.15, -0.05], fov: 38 },
  { t: 7.55, p: [0.18, 4.2, 4.05], target: [0, 3.35, -0.4], fov: 41 },
  { t: 9.05, p: [0, 6.55, 7.6], target: [0, 4.35, -0.9], fov: 43 },
  { t: 10.5, p: [0, 7.7, 12.6], target: [0, 3.85, -0.3], fov: 44 },
];

const NODE_ENDPOINTS = [
  [-7.4, 0.28, -4.1],
  [7.4, 0.28, -4.1],
  [-9.2, 0.26, 0.1],
  [9.2, 0.26, 0.1],
  [-7.4, 0.28, 4.1],
  [7.4, 0.28, 4.1],
];

const CinematicGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 1.0 },
    uGrain: { value: 0.035 },
    uAberration: { value: 0.0018 },
    uFade: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    uniform float uFade;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 uv = vUv;
      vec2 centered = uv - 0.5;
      float r2 = dot(centered, centered);
      vec2 offset = centered * uAberration * (0.35 + r2 * 2.4);
      vec3 color;
      color.r = texture2D(tDiffuse, uv + offset).r;
      color.g = texture2D(tDiffuse, uv).g;
      color.b = texture2D(tDiffuse, uv - offset).b;

      float vig = smoothstep(0.96, 0.2, r2 * 2.25);
      color *= mix(1.0, vig, uVignette);
      color *= 0.985 + 0.015 * sin(uv.y * uResolution.y * 1.25);

      float grain = hash(uv * uResolution + fract(uTime) * 347.0);
      color += (grain - 0.5) * uGrain;

      gl_FragColor = vec4(max(color, 0.0) * uFade, 1.0);
    }
  `,
};

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundedRectShape(width, depth, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -depth / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + depth - radius);
  shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
  shape.lineTo(x + radius, y + depth);
  shape.quadraticCurveTo(x, y + depth, x, y + depth - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function roundedRectPoints(width, depth, radius, segments = 6) {
  const points = [];
  const halfW = width / 2;
  const halfD = depth / 2;
  const corners = [
    [halfW - radius, halfD - radius, 0],
    [-halfW + radius, halfD - radius, Math.PI / 2],
    [-halfW + radius, -halfD + radius, Math.PI],
    [halfW - radius, -halfD + radius, Math.PI * 1.5],
  ];
  corners.forEach(([cx, cz, start]) => {
    for (let i = 0; i <= segments; i += 1) {
      const angle = start + (i / segments) * (Math.PI / 2);
      points.push(new THREE.Vector3(cx + Math.cos(angle) * radius, 0, cz + Math.sin(angle) * radius));
    }
  });
  return points;
}

function makeGlowTexture(color = "#59f5e4") {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.18, color);
  gradient.addColorStop(0.46, "rgba(89,245,228,0.36)");
  gradient.addColorStop(1, "rgba(89,245,228,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSoftTexture(inner = "rgba(90,245,228,0.65)", outer = "rgba(90,245,228,0)") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.5, inner.replace(/[\d.]+\)$/, "0.18)"));
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeHexPoints(radius, y = 0, rotation = 0) {
  const points = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = rotation + (i / 6) * TAU;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
  }
  return points;
}

function makeLineLoop(points, color, opacity = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  return new THREE.LineLoop(geometry, material);
}

function formatClock(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function makeCameraPath(keys) {
  const positionCurve = new THREE.CatmullRomCurve3(
    keys.map((key) => new THREE.Vector3(...key.p)),
    false,
    "centripetal",
    0.5
  );
  const targetCurve = new THREE.CatmullRomCurve3(
    keys.map((key) => new THREE.Vector3(...key.target)),
    false,
    "centripetal",
    0.5
  );
  return {
    keys,
    positionCurve,
    targetCurve,
    duration: keys[keys.length - 1].t,
  };
}

function sampleCameraPath(path, time, outPosition, outTarget) {
  const keys = path.keys;
  const t = clamp(time, 0, path.duration);
  let index = 0;
  while (index < keys.length - 2 && t > keys[index + 1].t) index += 1;
  const span = Math.max(0.0001, keys[index + 1].t - keys[index].t);
  const local = clamp((t - keys[index].t) / span, 0, 1);
  const u = (index + local) / (keys.length - 1);
  path.positionCurve.getPoint(u, outPosition);
  path.targetCurve.getPoint(u, outTarget);
  const fov = lerp(keys[index].fov, keys[index + 1].fov, local);
  return fov;
}

/* -------------------------------------------------------------------------- */
/* Procedural PCB artwork                                                     */
/* -------------------------------------------------------------------------- */

function createPcbTextures(renderer) {
  const W = 2048;
  const H = 1280;
  const colorCanvas = document.createElement("canvas");
  const glowCanvas = document.createElement("canvas");
  colorCanvas.width = glowCanvas.width = W;
  colorCanvas.height = glowCanvas.height = H;
  const c = colorCanvas.getContext("2d");
  const g = glowCanvas.getContext("2d");
  const random = mulberry32(0x4d4d3236);
  const brightPaths = [];
  const brightPads = [];

  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);

  const maskGradient = c.createRadialGradient(W * 0.5, H * 0.5, 50, W * 0.5, H * 0.5, W * 0.68);
  maskGradient.addColorStop(0, "#0a2827");
  maskGradient.addColorStop(0.45, "#071d1d");
  maskGradient.addColorStop(1, "#041010");
  c.fillStyle = maskGradient;
  c.fillRect(0, 0, W, H);

  c.strokeStyle = "rgba(74, 189, 167, 0.045)";
  c.lineWidth = 1;
  for (let x = 0; x <= W; x += 32) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, H);
    c.stroke();
  }
  for (let y = 0; y <= H; y += 32) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(W, y);
    c.stroke();
  }

  for (let i = 0; i < 24; i += 1) {
    c.beginPath();
    c.ellipse(
      random() * W,
      random() * H,
      90 + random() * 300,
      60 + random() * 220,
      random() * TAU,
      0,
      TAU
    );
    c.fillStyle = i % 3 === 0 ? "rgba(177, 138, 70, 0.026)" : "rgba(36, 160, 142, 0.026)";
    c.fill();
  }

  function strokePath(ctx, points, color, width, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  function drawTrace(points, { bright = false, teal = false, width = 3 } = {}) {
    strokePath(c, points, "#010807", width + 3.4, 0.6);
    strokePath(c, points, teal ? "#2a9a89" : "#8a713e", width + 1.2, 0.52);
    strokePath(c, points, teal ? "#4ed3bc" : "#b99552", width, 0.8);
    if (bright) {
      strokePath(c, points, teal ? "#a8fff2" : "#ffe0a0", width * 0.42, 0.92);
      strokePath(g, points, teal ? "#39e6d2" : "#d0a052", width + 1, 0.5);
      brightPaths.push(points);
    }
  }

  function drawPad(x, y, radius = 7, bright = false, square = false) {
    c.save();
    c.beginPath();
    if (square) c.roundRect(x - radius, y - radius, radius * 2, radius * 2, 2);
    else c.arc(x, y, radius, 0, TAU);
    c.fillStyle = "#d4ad63";
    c.fill();
    c.beginPath();
    if (square) c.roundRect(x - radius * 0.42, y - radius * 0.42, radius * 0.84, radius * 0.84, 1);
    else c.arc(x, y, radius * 0.38, 0, TAU);
    c.fillStyle = "#04100f";
    c.fill();
    c.restore();
    if (bright) {
      g.save();
      g.beginPath();
      g.arc(x, y, radius * 1.7, 0, TAU);
      g.fillStyle = "rgba(57,230,210,0.42)";
      g.fill();
      g.restore();
      brightPads.push([x, y, radius]);
    }
  }

  function makeRoute(x1, y1, x2, y2) {
    const dirX = Math.sign(x2 - x1) || 1;
    const bend = Math.min(130, Math.abs(x2 - x1) * 0.28);
    const midY = y1 + (y2 - y1) * (0.32 + random() * 0.34);
    return [
      [x1, y1],
      [x1 + dirX * bend, y1],
      [x1 + dirX * (bend + Math.abs(midY - y1) * 0.5), midY],
      [x2 - dirX * bend, midY],
      [x2 - dirX * bend * 0.45, y2],
      [x2, y2],
    ];
  }

  function offsetRoute(points, offset) {
    return points.map(([x, y]) => [x, y + offset]);
  }

  /* edge buses ------------------------------------------------------------ */
  for (let side = 0; side < 2; side += 1) {
    for (let bus = 0; bus < 11; bus += 1) {
      const startY = 150 + bus * 92 + random() * 22;
      const startX = side === 0 ? 22 : W - 22;
      const endX = 1024 + (side === 0 ? 1 : -1) * (190 + random() * 280);
      const endY = 360 + random() * 560;
      const route = makeRoute(startX, startY, endX, endY);
      for (let lane = 0; lane < 4; lane += 1) {
        const shifted = offsetRoute(route, lane * 8);
        const bright = bus % 4 === 0 && lane === 1;
        drawTrace(shifted, { bright, teal: bus % 5 === 2, width: lane === 0 ? 3.6 : 2.5 });
        if (lane === 0) drawPad(shifted[0][0] + (side === 0 ? 8 : -8), shifted[0][1], 6.2, bright);
        if (lane === 3) drawPad(endX, endY + lane * 8, 5.2, bright);
      }
    }
  }

  /* top / bottom buses ---------------------------------------------------- */
  for (let side = 0; side < 2; side += 1) {
    for (let bus = 0; bus < 8; bus += 1) {
      const startX = 260 + bus * 210 + random() * 32;
      const startY = side === 0 ? 22 : H - 22;
      const endX = 500 + random() * 1050;
      const endY = 1024 + (side === 0 ? 1 : -1) * (240 + random() * 230);
      const route = makeRoute(startX, startY, endX, endY);
      for (let lane = 0; lane < 3; lane += 1) {
        const shifted = offsetRoute(route, lane * 9);
        const bright = bus % 3 === 0 && lane === 0;
        drawTrace(shifted, { bright, teal: bus % 4 === 1, width: 2.3 });
        if (lane === 0) drawPad(shifted[0][0], shifted[0][1] + (side === 0 ? 8 : -8), 5.6, bright);
      }
    }
  }

  /* radial traces around the SoC ----------------------------------------- */
  for (let i = 0; i < 48; i += 1) {
    const angle = (i / 48) * TAU + random() * 0.08;
    const inner = 190 + random() * 55;
    const outer = 320 + random() * 320;
    const cx = 1024;
    const cy = 640;
    const start = [cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner];
    const end = [cx + Math.cos(angle + 0.13) * outer, cy + Math.sin(angle + 0.13) * outer];
    const route = makeRoute(start[0], start[1], end[0], end[1]);
    const bright = i % 9 === 0;
    drawTrace(route, { bright, teal: i % 4 === 0, width: i % 4 === 0 ? 2.6 : 1.8 });
    drawPad(start[0], start[1], 4.2, bright);
    drawPad(end[0], end[1], 4.4, bright);
  }

  /* BGA field + central hex ----------------------------------------------- */
  for (let row = 0; row < 16; row += 1) {
    for (let col = 0; col < 16; col += 1) {
      const x = 1024 - 150 + col * 20;
      const y = 640 - 150 + row * 20;
      c.beginPath();
      c.arc(x, y, 3.1, 0, TAU);
      c.fillStyle = "rgba(208, 160, 82, 0.6)";
      c.fill();
    }
  }
  const hexOuter = [];
  const hexInner = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = -Math.PI / 2 + (i / 6) * TAU;
    hexOuter.push([1024 + Math.cos(angle) * 245, 640 + Math.sin(angle) * 245]);
    hexInner.push([1024 + Math.cos(angle) * 172, 640 + Math.sin(angle) * 172]);
  }
  c.save();
  c.lineWidth = 4;
  c.strokeStyle = "rgba(77, 226, 204, 0.42)";
  c.beginPath();
  hexOuter.forEach(([x, y], index) => (index === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
  c.closePath();
  c.stroke();
  c.lineWidth = 1.6;
  c.strokeStyle = "rgba(77, 226, 204, 0.28)";
  c.beginPath();
  hexInner.forEach(([x, y], index) => (index === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
  c.closePath();
  c.stroke();
  c.restore();
  g.save();
  g.strokeStyle = "rgba(57,230,210,0.7)";
  g.lineWidth = 5;
  g.beginPath();
  hexOuter.forEach(([x, y], index) => (index === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  g.closePath();
  g.stroke();
  g.restore();

  /* vias ------------------------------------------------------------------ */
  for (let i = 0; i < 210; i += 1) {
    const x = 40 + random() * (W - 80);
    const y = 40 + random() * (H - 80);
    if (Math.hypot(x - 1024, y - 640) < 260) continue;
    drawPad(x, y, 4 + random() * 3.2, i % 17 === 0);
  }

  /* component silkscreen -------------------------------------------------- */
  c.save();
  c.font = '600 15px "Fira Code", monospace';
  c.fillStyle = "rgba(222, 224, 206, 0.42)";
  c.strokeStyle = "rgba(222, 224, 206, 0.34)";
  c.lineWidth = 1.4;
  const labels = ["R", "C", "L", "Q", "U", "J", "D", "TP"];
  for (let i = 0; i < 54; i += 1) {
    const x = 90 + random() * (W - 180);
    const y = 90 + random() * (H - 180);
    if (Math.hypot(x - 1024, y - 640) < 300) continue;
    const w = 24 + random() * 80;
    const h = 14 + random() * 32;
    c.strokeRect(x, y, w, h);
    c.fillText(`${labels[Math.floor(random() * labels.length)]}${Math.floor(random() * 90) + 1}`, x + 4, y - 5);
  }
  c.restore();

  /* board typography ------------------------------------------------------ */
  c.save();
  c.fillStyle = "rgba(222, 230, 212, 0.62)";
  c.font = '700 31px "Fira Code", monospace';
  c.fillText("MM / EDGE-CLOUD", 138, 142);
  c.fillStyle = "rgba(222, 230, 212, 0.38)";
  c.font = '500 19px "Fira Code", monospace';
  c.fillText("REV 2.6  ·  STUTTGART · DE", 140, 174);
  c.fillText("EMBEDDED ↔ CLOUD ↔ AI", 140, 202);
  c.font = '600 22px "Fira Code", monospace';
  c.fillStyle = "rgba(92, 236, 216, 0.5)";
  c.fillText("SOC-01", 880, 928);
  c.fillText("AI CORE", 878, 958);
  c.fillStyle = "rgba(222, 230, 212, 0.32)";
  c.fillText("PWR", 310, 1040);
  c.fillText("IO", 1640, 340);
  c.fillText("RF", 1650, 960);
  c.restore();

  /* edge connector fingers ------------------------------------------------ */
  c.save();
  for (let i = 0; i < 30; i += 1) {
    const x = 670 + i * 23;
    c.fillStyle = i % 3 === 0 ? "#d8b66b" : "#b98f4b";
    c.fillRect(x, H - 34, 14, 30);
  }
  c.restore();

  /* mounting holes -------------------------------------------------------- */
  [
    [130, 130],
    [W - 130, 130],
    [130, H - 130],
    [W - 130, H - 130],
  ].forEach(([x, y]) => {
    c.beginPath();
    c.arc(x, y, 29, 0, TAU);
    c.fillStyle = "#03100f";
    c.fill();
    c.lineWidth = 7;
    c.strokeStyle = "#b99552";
    c.stroke();
    c.beginPath();
    c.arc(x, y, 18, 0, TAU);
    c.fillStyle = "#010606";
    c.fill();
  });

  /* board outline --------------------------------------------------------- */
  c.save();
  c.lineWidth = 5;
  c.strokeStyle = "rgba(3, 8, 8, 0.9)";
  c.strokeRect(6, 6, W - 12, H - 12);
  c.lineWidth = 1.5;
  c.strokeStyle = "rgba(190, 154, 88, 0.42)";
  c.strokeRect(14, 14, W - 28, H - 28);
  c.restore();

  /* grain / wear ---------------------------------------------------------- */
  for (let i = 0; i < 4200; i += 1) {
    c.fillStyle = random() > 0.5 ? "rgba(255,255,255,0.018)" : "rgba(0,0,0,0.03)";
    c.fillRect(random() * W, random() * H, 1.2, 1.2);
  }

  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;
  const glow = new THREE.CanvasTexture(glowCanvas);
  glow.colorSpace = THREE.SRGBColorSpace;
  glow.anisotropy = maxAnisotropy;
  const bump = glow.clone();
  bump.colorSpace = THREE.NoColorSpace;
  bump.needsUpdate = true;
  return { map, glow, bump };
}

function createChipDecal() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 512, 512);
  ctx.translate(256, 256);
  ctx.strokeStyle = "rgba(115, 255, 236, 0.9)";
  ctx.lineWidth = 5;
  ctx.shadowColor = "rgba(57, 230, 210, 0.8)";
  ctx.shadowBlur = 18;
  const drawHex = (radius) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = -Math.PI / 2 + (i / 6) * TAU;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  };
  drawHex(162);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "rgba(115, 255, 236, 0.4)";
  drawHex(112);
  ctx.shadowBlur = 12;
  ctx.fillStyle = "rgba(214, 255, 249, 0.96)";
  ctx.font = '700 94px "Space Grotesk", "Segoe UI", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("MM", 0, -4);
  ctx.fillStyle = "rgba(115, 255, 236, 0.75)";
  ctx.font = '600 20px "Fira Code", monospace';
  ctx.fillText("EDGE CLOUD", 0, 80);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/* -------------------------------------------------------------------------- */
/* Scene                                                                      */
/* -------------------------------------------------------------------------- */

export class HeroScene {
  constructor() {
    this.coreVisual = document.querySelector(".core-visual");
    this.stage = this.coreVisual?.querySelector(".visual-stage");
    this.mount = this.coreVisual?.querySelector("[data-scene-mount]");
    this.canvas = this.coreVisual?.querySelector(".scene-canvas");
    this.launchButton = document.getElementById("cinemaLaunch");
    this.dialog = document.getElementById("cinema");
    this.cinemaStage = document.getElementById("cinemaStage");
    this.cinemaReplay = document.getElementById("cinemaReplay");
    this.cinemaClose = document.getElementById("cinemaClose");
    this.cinemaProgress = document.getElementById("cinemaProgress");
    this.cinemaTimeEl = document.getElementById("cinemaTime");
    this.cinemaAnnounce = document.getElementById("cinemaAnnounce");
    this.cinemaChapters = Array.from(document.querySelectorAll(".cinema__chapter"));
    this.nodeSlots = Array.from(this.coreVisual?.querySelectorAll(".node-slot") || []);
    this.initialized = false;
    this.ready = false;
    this.running = false;
    this.raf = 0;
    this.lastTime = 0;
    this.mode = "idle";
    this.modeTime = 0;
    this.cinemaOpen = false;
    this.cinemaTime = 0;
    this.cinemaDone = false;
    this.cinemaAct = -1;
    this.heroVisible = true;
    this.activeNodeIndex = -1;
    this.hoveredNodeIndex = -1;
    this.idle = { time: 0, angle: 0.58, radius: 7.8, height: 2.5 };
    this.returnTransition = null;
    this.width = 1;
    this.height = 1;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.65);
    this.maxDpr = this.dpr;
    this.qualitySamples = [];
    this.qualityAdjusted = false;
    this.pausedByVisibility = false;
    this.mobileQuery = window.matchMedia("(min-width: 761px)");
    this.reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.captureMode = new URLSearchParams(window.location.search).has("sceneCapture");
    this.forcedQuality = new URLSearchParams(window.location.search).get("sceneQuality") === "high";
    this.teaserPath = makeCameraPath(TEASER_KEYS);
    this.cinemaPath = makeCameraPath(CINEMA_KEYS);
    this.cameraPosition = new THREE.Vector3();
    this.cameraTarget = new THREE.Vector3();
    this.currentTarget = new THREE.Vector3();
    this.idlePosition = new THREE.Vector3();
    this.idleTargetPose = new THREE.Vector3();
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.tmpObject = new THREE.Object3D();
    this.tmpColor = new THREE.Color();
    this._tick = this.tick.bind(this);
  }

  async init() {
    if (this.initialized) return;
    if (!this.coreVisual || !this.stage || !this.mount || !this.canvas) return;
    if (this.reducedMotionQuery.matches) return;

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: this.captureMode,
        stencil: false,
      });
    } catch (error) {
      return;
    }

    this.initialized = true;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(PALETTE.bg, 1);

    this.coreVisual.classList.add("is-webgl");
    try {
      this.createWorld();
      this.createCamera();
      this.createComposer();
      this.setupUI();
      this.setupEvents();
      this.updateSize();
    } catch (error) {
      this.coreVisual.classList.remove("is-webgl");
      this.stopLoop();
      if (window.console && console.warn) console.warn("Hero scene unavailable:", error);
      return;
    }

    this.ready = true;
    this.coreVisual.classList.add("is-scene-ready");
    this.startTeaser();

    /* Warm the shader cache without blocking the reveal. */
    this.renderer.compileAsync(this.scene, this.camera).catch(() => {});

    window.__heroScene = {
      ready: true,
      openCinema: () => this.openCinema(),
      closeCinema: () => this.closeCinema(),
      capturePoster: (width = 1600, height = 1184) => this.captureStill(3.5, width, height),
      captureAt: (time, width = 1200, height = 900) => this.captureStill(time, width, height),
      captureCinemaAt: (time, width = 1600, height = 900) =>
        this.captureCinemaStill(time, width, height),
      captureCinemaFinal: (width = 1920, height = 1080) =>
        this.captureCinemaStill(CINEMA_DURATION, width, height),
    };
  }

  createWorld() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PALETTE.bg);
    scene.fog = new THREE.FogExp2(PALETTE.bg, 0.022);
    this.scene = scene;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    scene.environmentIntensity = 0.42;
    pmrem.dispose();

    const backdrop = new THREE.Mesh(
      new THREE.SphereGeometry(58, 32, 18),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new THREE.Color(0x071622) },
          uBottom: { value: new THREE.Color(0x010308) },
          uWarm: { value: new THREE.Color(0x3c2112) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          void main() {
            vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop;
          uniform vec3 uBottom;
          uniform vec3 uWarm;
          varying vec3 vWorld;
          void main() {
            vec3 dir = normalize(vWorld);
            float height = smoothstep(-0.55, 0.75, dir.y);
            vec3 color = mix(uBottom, uTop, height);
            float warm = smoothstep(0.15, 0.85, dir.x * 0.5 + 0.5) * smoothstep(-0.2, 0.7, dir.y);
            color += uWarm * warm * 0.16;
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      })
    );
    backdrop.renderOrder = -20;
    scene.add(backdrop);
    this.backdrop = backdrop;

    this.glowTexture = makeGlowTexture();
    this.softTexture = makeSoftTexture();
    this.textures = createPcbTextures(this.renderer);
    this.materials = {
      gold: new THREE.MeshStandardMaterial({
        color: 0xc6a15a,
        metalness: 0.96,
        roughness: 0.24,
        envMapIntensity: 1.25,
      }),
      goldDark: new THREE.MeshStandardMaterial({
        color: 0x8e6a34,
        metalness: 0.9,
        roughness: 0.34,
      }),
      chip: new THREE.MeshStandardMaterial({
        color: 0x0b0e12,
        metalness: 0.48,
        roughness: 0.34,
        envMapIntensity: 0.9,
      }),
      lid: new THREE.MeshStandardMaterial({
        color: 0x9ba7ad,
        metalness: 0.94,
        roughness: 0.24,
        envMapIntensity: 1.15,
      }),
      plastic: new THREE.MeshStandardMaterial({
        color: 0x10161a,
        metalness: 0.12,
        roughness: 0.58,
      }),
      ceramic: new THREE.MeshStandardMaterial({
        color: 0x2c251c,
        metalness: 0.16,
        roughness: 0.42,
      }),
      metal: new THREE.MeshStandardMaterial({
        color: 0x8d9aa2,
        metalness: 0.98,
        roughness: 0.2,
        envMapIntensity: 1.3,
      }),
      boardSide: new THREE.MeshStandardMaterial({
        color: 0x061817,
        metalness: 0.24,
        roughness: 0.52,
      }),
    };

    this.boardGroup = new THREE.Group();
    scene.add(this.boardGroup);
    this.buildLighting();
    this.buildBoard();
    this.buildCore();
    this.buildBeams();
    this.buildCloud();
    this.buildDust();
  }

  buildLighting() {
    const scene = this.scene;
    const hemi = new THREE.HemisphereLight(0x3b6f7a, 0x040709, 0.9);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffe3c2, 1.15);
    key.position.set(8, 14, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 38;
    key.shadow.camera.left = -14;
    key.shadow.camera.right = 14;
    key.shadow.camera.top = 11;
    key.shadow.camera.bottom = -11;
    key.shadow.bias = -0.0007;
    key.shadow.normalBias = 0.025;
    scene.add(key);
    this.keyLight = key;

    const rim = new THREE.DirectionalLight(0x35e6d2, 0.7);
    rim.position.set(-11, 7, -9);
    scene.add(rim);
    this.rimLight = rim;

    const fill = new THREE.DirectionalLight(0x7184ff, 0.35);
    fill.position.set(1, 5, -13);
    scene.add(fill);

    const coreLight = new THREE.PointLight(0x4af5df, 2.6, 11, 2);
    coreLight.position.set(0, 1.55, 0);
    scene.add(coreLight);
    this.coreLight = coreLight;

    const warmLight = new THREE.PointLight(0xffb15c, 1.3, 13, 2);
    warmLight.position.set(-7, 2.2, 5.2);
    scene.add(warmLight);

    const coolLight = new THREE.PointLight(0x7888ff, 1.1, 13, 2);
    coolLight.position.set(8, 2.8, -3.2);
    scene.add(coolLight);
  }

  buildBoard() {
    const width = 24;
    const depth = 15;
    const shape = roundedRectShape(width, depth, 0.78);

    const bodyGeometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.55,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 2,
      curveSegments: 18,
    });
    bodyGeometry.rotateX(-Math.PI / 2);
    bodyGeometry.translate(0, -0.61, 0);
    const body = new THREE.Mesh(bodyGeometry, this.materials.boardSide);
    body.receiveShadow = true;
    body.castShadow = true;
    this.boardGroup.add(body);

    const topGeometry = new THREE.ShapeGeometry(shape, 24);
    topGeometry.rotateX(-Math.PI / 2);
    const position = topGeometry.attributes.position;
    const uv = new Float32Array(position.count * 2);
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const z = position.getZ(i);
      uv[i * 2] = (x + width / 2) / width;
      uv[i * 2 + 1] = (depth / 2 - z) / depth;
    }
    topGeometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

    const boardMaterial = new THREE.MeshStandardMaterial({
      map: this.textures.map,
      emissive: 0xffffff,
      emissiveMap: this.textures.glow,
      emissiveIntensity: 0.9,
      bumpMap: this.textures.bump,
      bumpScale: 0.022,
      roughness: 0.62,
      metalness: 0.16,
      envMapIntensity: 0.5,
    });
    this.boardMaterial = boardMaterial;
    const top = new THREE.Mesh(topGeometry, boardMaterial);
    top.position.y = 0.008;
    top.receiveShadow = true;
    this.boardGroup.add(top);
    this.boardTop = top;

    const edgeLine = makeLineLoop(
      roundedRectPoints(width - 0.14, depth - 0.14, 0.75, 10),
      0x3bd8c2,
      0.6
    );
    edgeLine.position.y = 0.025;
    this.boardGroup.add(edgeLine);
    this.boardEdge = edgeLine;

    const underglowMaterial = new THREE.MeshBasicMaterial({
      map: this.softTexture,
      color: 0x1e6b67,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const underglow = new THREE.Mesh(new THREE.PlaneGeometry(31, 23), underglowMaterial);
    underglow.rotation.x = -Math.PI / 2;
    underglow.position.y = -1.15;
    underglow.renderOrder = -2;
    this.boardGroup.add(underglow);
    this.underglow = underglow;

    const auraMaterial = new THREE.MeshBasicMaterial({
      map: this.softTexture,
      color: 0x384f9e,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const aura = new THREE.Mesh(new THREE.PlaneGeometry(46, 33), auraMaterial);
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = -2.2;
    aura.renderOrder = -3;
    this.boardGroup.add(aura);
    this.aura = aura;

    this.buildChipPackage(0, 0, 2.35, 11, true);
    this.buildChipPackage(-4.75, -2.6, 1.32, 8, false);
    this.buildChipPackage(5.15, 2.55, 1.05, 7, false);
    this.buildChipPackage(4.55, -3.55, 0.85, 6, false);
    this.buildPassives();
    this.buildLargeComponents();
    this.buildShields();
    this.buildConnectors();
    this.buildMountingHoles();
    this.buildZoneMarkers();

    const socRing = makeLineLoop(makeHexPoints(2.05, 0.018, Math.PI / 6), 0x58f6e3, 0.55);
    this.boardGroup.add(socRing);
    this.socRing = socRing;
  }

  buildChipPackage(x, z, size, pinsPerSide, hero) {
    const group = new THREE.Group();
    group.position.set(x, 0.012, z);
    const packageGeometry = new RoundedBoxGeometry(size, 0.19, size, 3, Math.min(0.06, size * 0.04));
    const packageMesh = new THREE.Mesh(packageGeometry, this.materials.chip);
    packageMesh.position.y = 0.095;
    packageMesh.castShadow = true;
    packageMesh.receiveShadow = true;
    group.add(packageMesh);

    const lidSize = size * (hero ? 0.68 : 0.62);
    const lid = new THREE.Mesh(
      new RoundedBoxGeometry(lidSize, hero ? 0.09 : 0.07, lidSize, 3, 0.018),
      hero ? this.materials.lid : this.materials.plastic
    );
    lid.position.y = hero ? 0.238 : 0.215;
    lid.castShadow = true;
    group.add(lid);

    if (hero) {
      const decalMaterial = new THREE.MeshBasicMaterial({
        map: createChipDecal(),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        opacity: 0.92,
      });
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(lidSize * 0.92, lidSize * 0.92), decalMaterial);
      decal.rotation.x = -Math.PI / 2;
      decal.position.y = 0.286;
      decal.renderOrder = 3;
      group.add(decal);
      this.chipDecal = decal;
    }

    const pinGeometry = new THREE.BoxGeometry(1, 1, 1);
    const pinCount = pinsPerSide * 4;
    const pins = new THREE.InstancedMesh(pinGeometry, this.materials.gold, pinCount);
    pins.castShadow = true;
    const dummy = this.tmpObject;
    let index = 0;
    for (let side = 0; side < 4; side += 1) {
      for (let i = 0; i < pinsPerSide; i += 1) {
        const offset = (i / (pinsPerSide - 1) - 0.5) * size * 0.84;
        const edge = size / 2 + 0.055;
        if (side === 0) {
          dummy.position.set(offset, 0.05, edge);
          dummy.scale.set(0.055, 0.045, 0.14);
        } else if (side === 1) {
          dummy.position.set(offset, 0.05, -edge);
          dummy.scale.set(0.055, 0.045, 0.14);
        } else if (side === 2) {
          dummy.position.set(edge, 0.05, offset);
          dummy.scale.set(0.14, 0.045, 0.055);
        } else {
          dummy.position.set(-edge, 0.05, offset);
          dummy.scale.set(0.14, 0.045, 0.055);
        }
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        pins.setMatrixAt(index, dummy.matrix);
        index += 1;
      }
    }
    pins.instanceMatrix.needsUpdate = true;
    group.add(pins);

    const glowLine = makeLineLoop(
      [
        new THREE.Vector3(-size / 2 - 0.06, 0.2, -size / 2 - 0.06),
        new THREE.Vector3(size / 2 + 0.06, 0.2, -size / 2 - 0.06),
        new THREE.Vector3(size / 2 + 0.06, 0.2, size / 2 + 0.06),
        new THREE.Vector3(-size / 2 - 0.06, 0.2, size / 2 + 0.06),
      ],
      0x3edcca,
      hero ? 0.35 : 0.18
    );
    group.add(glowLine);
    this.boardGroup.add(group);
    if (hero) this.socGroup = group;
    return group;
  }

  isInsideKeepout(x, z, margin = 0) {
    const keepouts = [
      [0, 0, 2.65 + margin],
      [-4.75, -2.6, 1.3 + margin],
      [5.15, 2.55, 1.05 + margin],
      [4.55, -3.55, 0.9 + margin],
      [-7.2, -3.1, 2.3 + margin],
      [7.3, -2.2, 1.8 + margin],
      [-7.5, 6.2, 2.4 + margin],
      [7.1, 6.2, 2.4 + margin],
      [11.3, 0, 1.2 + margin],
      [-11.4, 0.2, 1.2 + margin],
      [0, -6.8, 1.1 + margin],
      [0, 6.9, 1.4 + margin],
    ];
    if (keepouts.some(([kx, kz, radius]) => Math.hypot(x - kx, z - kz) < radius)) return true;
    if (Math.abs(x) > 11.4 || Math.abs(z) > 7.0) return true;
    return false;
  }

  buildPassives() {
    const count = 168;
    const bodyGeometry = new THREE.BoxGeometry(1, 1, 1);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.44,
      metalness: 0.22,
      envMapIntensity: 0.7,
    });
    const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, count);
    const pads = new THREE.InstancedMesh(bodyGeometry, this.materials.gold, count * 2);
    bodies.castShadow = true;
    bodies.receiveShadow = true;
    pads.receiveShadow = true;
    const random = mulberry32(0x6d6d2d);
    const colors = [0x161a1c, 0x211c17, 0x3a2f25, 0xb9aa92, 0x252a2b, 0x2e211b];
    const dummy = this.tmpObject;
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < 6000) {
      attempts += 1;
      const x = (random() * 2 - 1) * 11.2;
      const z = (random() * 2 - 1) * 6.8;
      if (this.isInsideKeepout(x, z, 0.15)) continue;
      const horizontal = random() > 0.48;
      const long = 0.18 + random() * 0.34;
      const short = 0.095 + random() * 0.13;
      const height = 0.045 + random() * 0.085;
      const width = horizontal ? long : short;
      const depth = horizontal ? short : long;

      dummy.position.set(x, height / 2 + 0.012, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(width, height, depth);
      dummy.updateMatrix();
      bodies.setMatrixAt(placed, dummy.matrix);
      bodies.setColorAt(placed, this.tmpColor.setHex(colors[Math.floor(random() * colors.length)]));

      for (let side = 0; side < 2; side += 1) {
        const sign = side === 0 ? -1 : 1;
        dummy.position.set(
          x + (horizontal ? sign * width * 0.52 : 0),
          0.022,
          z + (horizontal ? 0 : sign * depth * 0.52)
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(
          horizontal ? width * 0.14 : width * 0.92,
          0.035,
          horizontal ? depth * 0.92 : depth * 0.14
        );
        dummy.updateMatrix();
        pads.setMatrixAt(placed * 2 + side, dummy.matrix);
      }
      placed += 1;
    }
    bodies.count = placed;
    pads.count = placed * 2;
    bodies.instanceMatrix.needsUpdate = true;
    pads.instanceMatrix.needsUpdate = true;
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    this.boardGroup.add(bodies, pads);
    this.passiveBodies = bodies;
    this.passivePads = pads;
  }

  buildLargeComponents() {
    const random = mulberry32(0x31af);
    const capPositions = [
      [-8.65, -0.2],
      [-8.25, 2.0],
      [8.6, -0.8],
      [8.25, 2.9],
      [-2.5, -5.6],
      [2.45, 5.6],
    ];
    capPositions.forEach(([x, z]) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.23, 0.23, 0.42, 20),
        new THREE.MeshStandardMaterial({ color: 0x182a35, metalness: 0.55, roughness: 0.32 })
      );
      body.position.y = 0.22;
      body.castShadow = true;
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(0.225, 0.225, 0.02, 20),
        new THREE.MeshStandardMaterial({ color: 0xb8c2c4, metalness: 0.95, roughness: 0.22 })
      );
      top.position.y = 0.44;
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.015, 0.055),
        new THREE.MeshBasicMaterial({ color: 0x57e5d0, toneMapped: false })
      );
      stripe.position.set(0, 0.452, 0);
      group.add(body, top, stripe);
      this.boardGroup.add(group);
    });

    const crystalPositions = [
      [-3.2, 2.5],
      [3.0, -2.3],
      [7.4, 0.6],
    ];
    crystalPositions.forEach(([x, z]) => {
      const crystal = new THREE.Mesh(
        new RoundedBoxGeometry(0.62, 0.16, 0.34, 3, 0.04),
        this.materials.metal
      );
      crystal.position.set(x, 0.1, z);
      crystal.rotation.y = random() > 0.5 ? 0 : Math.PI / 2;
      crystal.castShadow = true;
      this.boardGroup.add(crystal);
    });

    const ledPositions = [
      [-1.45, 1.5, 0x39e6d2],
      [1.5, 1.45, 0x7f8cff],
      [-1.4, -1.45, 0xf2b85b],
      [1.45, -1.5, 0x39e6d2],
      [-6.1, 4.5, 0x39e6d2],
    ];
    this.leds = [];
    ledPositions.forEach(([x, z, color]) => {
      const material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.055, 0.075), material);
      led.position.set(x, 0.045, z);
      this.boardGroup.add(led);
      this.leds.push({ mesh: led, material, phase: random() * TAU, baseColor: new THREE.Color(color) });
    });

    for (let i = 0; i < 7; i += 1) {
      const coil = new THREE.Mesh(
        new RoundedBoxGeometry(0.62, 0.23, 0.5, 3, 0.035),
        this.materials.ceramic
      );
      const angle = (i / 7) * TAU + 0.3;
      coil.position.set(Math.cos(angle) * 6.6, 0.12, Math.sin(angle) * 4.2);
      coil.rotation.y = angle;
      coil.castShadow = true;
      this.boardGroup.add(coil);
    }
  }

  buildShields() {
    const shields = [
      { x: -7.2, z: -3.1, w: 3.2, d: 2.3, h: 0.82, label: "RF" },
      { x: 7.3, z: -2.2, w: 2.45, d: 1.9, h: 0.7, label: "CLOUD" },
    ];
    shields.forEach(({ x, z, w, d, h }) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      const shell = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, 0.06), this.materials.metal);
      shell.position.y = h / 2 + 0.01;
      shell.castShadow = true;
      shell.receiveShadow = true;
      group.add(shell);

      const seam = makeLineLoop(
        [
          new THREE.Vector3(-w / 2 + 0.03, 0.045, -d / 2 + 0.03),
          new THREE.Vector3(w / 2 - 0.03, 0.045, -d / 2 + 0.03),
          new THREE.Vector3(w / 2 - 0.03, 0.045, d / 2 - 0.03),
          new THREE.Vector3(-w / 2 + 0.03, 0.045, d / 2 - 0.03),
        ],
        0x39e6d2,
        0.3
      );
      group.add(seam);

      const holeGeometry = new THREE.CylinderGeometry(0.018, 0.018, 0.012, 6);
      const holes = new THREE.InstancedMesh(
        holeGeometry,
        new THREE.MeshBasicMaterial({ color: 0x05090b }),
        20
      );
      const dummy = this.tmpObject;
      let index = 0;
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          dummy.position.set(-w * 0.28 + col * (w * 0.14), h + 0.012, -d * 0.24 + row * (d * 0.16));
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          holes.setMatrixAt(index, dummy.matrix);
          index += 1;
        }
      }
      holes.instanceMatrix.needsUpdate = true;
      group.add(holes);
      this.boardGroup.add(group);
    });
  }

  buildConnectors() {
    const usbGroup = new THREE.Group();
    usbGroup.position.set(-5.7, 0, 6.75);
    const shell = new THREE.Mesh(new RoundedBoxGeometry(1.45, 0.42, 0.55, 3, 0.08), this.materials.metal);
    shell.position.y = 0.22;
    shell.castShadow = true;
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 0.28), this.materials.plastic);
    slot.position.set(0, 0.25, 0.16);
    usbGroup.add(shell, slot);
    for (let i = 0; i < 9; i += 1) {
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.2), this.materials.gold);
      pin.position.set(-0.36 + i * 0.09, 0.25, 0.25);
      usbGroup.add(pin);
    }
    this.boardGroup.add(usbGroup);

    const header = new THREE.Group();
    header.position.set(7.15, 0, 6.5);
    const headerBody = new THREE.Mesh(
      new RoundedBoxGeometry(3.1, 0.52, 0.72, 3, 0.05),
      this.materials.plastic
    );
    headerBody.position.y = 0.26;
    headerBody.castShadow = true;
    header.add(headerBody);
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 11; col += 1) {
        const pin = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.38, 0.055), this.materials.gold);
        pin.position.set(-1.3 + col * 0.26, 0.48, -0.16 + row * 0.32);
        header.add(pin);
      }
    }
    this.boardGroup.add(header);

    const sideConnector = new THREE.Group();
    sideConnector.position.set(11.55, 0, 0.2);
    sideConnector.rotation.y = Math.PI / 2;
    const sideBody = new THREE.Mesh(
      new RoundedBoxGeometry(1.3, 0.45, 2.2, 3, 0.05),
      this.materials.plastic
    );
    sideBody.position.y = 0.24;
    sideBody.castShadow = true;
    sideConnector.add(sideBody);
    for (let i = 0; i < 8; i += 1) {
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.16), this.materials.gold);
      pin.position.set(-0.48 + i * 0.14, 0.24, 0.92);
      sideConnector.add(pin);
    }
    this.boardGroup.add(sideConnector);

    const fpc = new THREE.Group();
    fpc.position.set(-8.2, 0, 6.3);
    const fpcBody = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.18, 0.72), this.materials.plastic);
    fpcBody.position.y = 0.1;
    fpc.add(fpcBody);
    const fpcSlot = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.035, 0.16), this.materials.goldDark);
    fpcSlot.position.set(0, 0.21, 0.16);
    fpc.add(fpcSlot);
    this.boardGroup.add(fpc);
  }

  buildMountingHoles() {
    const positions = [
      [-10.55, -6.15],
      [10.55, -6.15],
      [-10.55, 6.15],
      [10.55, 6.15],
    ];
    positions.forEach(([x, z]) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.33, 0.035, 8, 28),
        this.materials.gold
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 0.04, z);
      const hole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.29, 0.29, 0.05, 24),
        new THREE.MeshStandardMaterial({ color: 0x010505, metalness: 0.2, roughness: 0.7 })
      );
      hole.position.set(x, 0.035, z);
      this.boardGroup.add(ring, hole);
    });
  }

  buildZoneMarkers() {
    this.zoneMarkers = [];
    NODE_ENDPOINTS.forEach(([x, y, z], index) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.13, 0.19, 24),
        new THREE.MeshBasicMaterial({
          color: 0x39e6d2,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
          toneMapped: false,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.032, z);
      this.boardGroup.add(ring);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTexture,
          color: 0x39e6d2,
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        })
      );
      glow.scale.setScalar(0.6);
      glow.position.set(x, 0.16, z);
      this.boardGroup.add(glow);
      this.zoneMarkers.push({ ring, glow, index });
    });
  }

  buildCore() {
    const core = new THREE.Group();
    core.position.set(0, 1.34, 0);
    this.scene.add(core);
    this.coreGroup = core;
    this.coreRings = [];

    const ringDefinitions = [
      { radius: 1.55, y: 0.02, rotation: 0.18, speed: 0.24, opacity: 0.52, tiltX: 0, tiltZ: 0 },
      { radius: 1.16, y: 0.32, rotation: -0.4, speed: -0.36, opacity: 0.42, tiltX: 0, tiltZ: 0 },
      { radius: 1.92, y: -0.18, rotation: 0.6, speed: 0.15, opacity: 0.28, tiltX: 0, tiltZ: 0 },
      { radius: 1.32, y: 0.04, rotation: 0.1, speed: -0.2, opacity: 0.35, tiltX: 1.16, tiltZ: 0.2 },
      { radius: 1.72, y: 0.12, rotation: -0.35, speed: 0.18, opacity: 0.24, tiltX: 1.32, tiltZ: -0.35 },
    ];
    ringDefinitions.forEach((definition, index) => {
      const ring = makeLineLoop(
        makeHexPoints(definition.radius, 0, definition.rotation),
        index % 2 === 0 ? 0x4cf5e2 : 0x8c96ff,
        definition.opacity
      );
      ring.position.y = definition.y;
      ring.rotation.x = definition.tiltX;
      ring.rotation.z = definition.tiltZ;
      ring.userData.baseRotation = definition.rotation;
      core.add(ring);
      this.coreRings.push({
        mesh: ring,
        speed: definition.speed,
        tiltX: definition.tiltX,
        tiltZ: definition.tiltZ,
      });
    });

    this.tunnelRings = [];
    for (let i = 0; i < 7; i += 1) {
      const radius = 2.35 - i * 0.23;
      const ring = makeLineLoop(
        makeHexPoints(radius, 0, i * 0.17),
        i % 2 === 0 ? 0x39e6d2 : 0x7f8cff,
        0.08 + i * 0.018
      );
      ring.position.y = -1.08 + i * 0.37;
      ring.userData.baseRotation = i * 0.17;
      core.add(ring);
      this.tunnelRings.push(ring);
    }

    const glowMaterial = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0x51f4e2,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const glow = new THREE.Sprite(glowMaterial);
    glow.scale.setScalar(1.75);
    core.add(glow);
    this.coreGlow = glow;

    const coreGeometry = new THREE.IcosahedronGeometry(0.25, 1);
    coreGeometry.computeVertexNormals();
    const coreMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCore: { value: new THREE.Color(0xd8fffa) },
        uEdge: { value: new THREE.Color(0x168f86) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uCore;
        uniform vec3 uEdge;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 1.45);
          vec3 color = mix(uCore, uEdge, fresnel);
          float pulse = 0.9 + 0.1 * sin(uTime * 2.4);
          gl_FragColor = vec4(color * pulse, 1.0);
        }
      `,
      toneMapped: false,
    });
    const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    core.add(coreMesh);
    this.coreMesh = coreMesh;
    this.coreMaterial = coreMaterial;

    const coreWire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.4, 1),
      new THREE.MeshBasicMaterial({
        color: 0x39e6d2,
        wireframe: true,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    core.add(coreWire);
    this.coreWire = coreWire;

    const orbitA = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.006, 5, 64),
      new THREE.MeshBasicMaterial({
        color: 0x7f8cff,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    orbitA.rotation.x = Math.PI / 2.45;
    orbitA.rotation.y = 0.3;
    core.add(orbitA);
    this.coreOrbitA = orbitA;

    const beamMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x39e6d2) },
        uOpacity: { value: 0.28 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float fade = pow(vUv.y, 1.5) * (1.0 - smoothstep(0.82, 1.0, vUv.y));
          gl_FragColor = vec4(uColor, fade * uOpacity);
        }
      `,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 1.08, 1.28, 24, 1, true), beamMaterial);
    beam.position.y = -0.7;
    core.add(beam);
    this.coreBeam = beam;

    const random = mulberry32(0x51a7);
    const count = 240;
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const radius = 0.48 + Math.pow(random(), 0.65) * 1.65;
      const angle = random() * TAU;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (random() - 0.5) * 1.85;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      scales[i] = 0.45 + random() * 1.15;
      phases[i] = random() * TAU;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    particleGeometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: this.dpr },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aScale;
        attribute float aPhase;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float breathe = sin(uTime * 0.8 + aPhase);
          p.xz *= 1.0 + breathe * 0.035;
          p.y += sin(uTime * 1.1 + aPhase * 1.7) * 0.035;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = aScale * uPixelRatio * (34.0 / max(0.2, -mv.z));
          gl_Position = projectionMatrix * mv;
          vAlpha = 0.2 + 0.5 * (0.5 + 0.5 * sin(uTime * 2.1 + aPhase));
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float alpha = smoothstep(0.5, 0.02, d);
          vec3 color = mix(vec3(0.22, 0.95, 0.87), vec3(0.5, 0.56, 1.0), vAlpha * 0.55);
          gl_FragColor = vec4(color, alpha * vAlpha);
        }
      `,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.frustumCulled = false;
    core.add(particles);
    this.coreParticles = particles;

    const corePoint = new THREE.PointLight(0x4bf4e2, 1.5, 7, 2);
    corePoint.position.set(0, 0.1, 0);
    core.add(corePoint);
    this.coreInnerLight = corePoint;
  }

  buildBeams() {
    this.beams = [];
    NODE_ENDPOINTS.forEach((end, index) => {
      const curve = new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(0, 1.32, 0),
          new THREE.Vector3(end[0] * 0.28, 1.52 + (index % 2) * 0.24, end[2] * 0.28),
          new THREE.Vector3(end[0] * 0.72, 0.88, end[2] * 0.72),
          new THREE.Vector3(end[0], 0.09, end[2]),
        ],
        false,
        "centripetal",
        0.5
      );
      const material = new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0x39e6d2 : 0x7f8cff,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 54, 0.013, 4, false), material);
      this.scene.add(tube);

      const pulses = [];
      for (let i = 0; i < 2; i += 1) {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.glowTexture,
            color: index % 2 === 0 ? 0x7ffff2 : 0xaeb5ff,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          })
        );
        sprite.scale.setScalar(0.34);
        this.scene.add(sprite);
        pulses.push({ sprite, offset: i * 0.48 + index * 0.075 });
      }
      this.beams.push({ curve, tube, material, pulses });
    });
  }

  buildCloud() {
    const group = new THREE.Group();
    group.position.set(0, 4.85, -0.65);
    this.scene.add(group);
    this.cloud = { group, materials: [], nodes: [], phase: 0 };

    const positions = [
      [0, 0.1, 0],
      [-2.25, 0.8, -0.45],
      [2.25, 0.62, 0.18],
      [-3.9, -0.45, 0.85],
      [3.75, -0.36, -0.78],
      [-1.18, 1.55, 1.15],
      [1.42, 1.42, -1.05],
      [-2.72, -1.38, -1.18],
      [2.9, -1.25, 1.28],
      [0.12, -1.75, 0.36],
      [-4.35, 1.35, -0.55],
      [4.5, 1.05, 0.58],
      [-4.55, -1.05, -0.38],
      [4.45, -0.8, -1.25],
    ];
    const colors = [0x66f4e4, 0x8d9bff, 0x74e7ff];

    positions.forEach(([x, y, z], index) => {
      const isCenter = index === 0;
      const color = colors[index % colors.length];
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: isCenter ? 0.95 : 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      material.userData.baseOpacity = material.opacity;
      const node = new THREE.Mesh(new THREE.IcosahedronGeometry(isCenter ? 0.13 : 0.065, 0), material);
      node.position.set(x, y, z);
      group.add(node);

      const spriteMaterial = new THREE.SpriteMaterial({
        map: this.glowTexture,
        color,
        transparent: true,
        opacity: isCenter ? 0.55 : 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      spriteMaterial.userData.baseOpacity = spriteMaterial.opacity;
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.copy(node.position);
      sprite.scale.setScalar(isCenter ? 1.25 : 0.72);
      group.add(sprite);
      this.cloud.materials.push(material, spriteMaterial);
      this.cloud.nodes.push({ mesh: node, sprite, baseScale: isCenter ? 1.25 : 0.72, phase: index * 0.8 });
    });

    const edges = new Set();
    const linePositions = [];
    positions.forEach(([x, y, z], index) => {
      const nearest = positions
        .map(([ox, oy, oz], otherIndex) => ({
          otherIndex,
          distance: Math.hypot(x - ox, y - oy, z - oz),
        }))
        .filter((entry) => entry.otherIndex !== index)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 2);
      nearest.forEach(({ otherIndex }) => {
        const key = index < otherIndex ? `${index}-${otherIndex}` : `${otherIndex}-${index}`;
        if (edges.has(key)) return;
        edges.add(key);
        const [ox, oy, oz] = positions[otherIndex];
        linePositions.push(x, y, z, ox, oy, oz);
      });
    });
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x6f9fda,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    lineMaterial.userData.baseOpacity = lineMaterial.opacity;
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    group.add(lines);
    this.cloud.materials.push(lineMaterial);
    this.cloud.lines = lines;

    const random = mulberry32(0x77a1);
    const hazeCount = 280;
    const hazePositions = new Float32Array(hazeCount * 3);
    for (let i = 0; i < hazeCount; i += 1) {
      const radius = Math.pow(random(), 0.6);
      const angle = random() * TAU;
      hazePositions[i * 3] = Math.cos(angle) * radius * 5.3;
      hazePositions[i * 3 + 1] = (random() - 0.5) * 2.7;
      hazePositions[i * 3 + 2] = Math.sin(angle) * radius * 2.2;
    }
    const hazeGeometry = new THREE.BufferGeometry();
    hazeGeometry.setAttribute("position", new THREE.BufferAttribute(hazePositions, 3));
    const hazeMaterial = new THREE.PointsMaterial({
      map: this.glowTexture,
      color: 0x7bdbea,
      size: 0.055,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      toneMapped: false,
    });
    hazeMaterial.userData.baseOpacity = hazeMaterial.opacity;
    const haze = new THREE.Points(hazeGeometry, hazeMaterial);
    group.add(haze);
    this.cloud.materials.push(hazeMaterial);
    this.cloud.haze = haze;

    const cloudRing = makeLineLoop(makeHexPoints(1.35, 0, 0.2), 0x7f8cff, 0.22);
    cloudRing.position.y = -0.2;
    group.add(cloudRing);
    this.cloud.materials.push(cloudRing.material);
    this.cloud.ring = cloudRing;

    const linkGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 2.4, 0),
      new THREE.Vector3(0, 4.6, -0.65),
    ]);
    const linkMaterial = new THREE.LineBasicMaterial({
      color: 0x7f8cff,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const link = new THREE.Line(linkGeometry, linkMaterial);
    this.scene.add(link);
    this.cloud.link = link;
    this.cloud.linkMaterial = linkMaterial;
    this.setCloudOpacity(0.2);
  }

  buildDust() {
    const random = mulberry32(0x1a2b);
    const count = 760;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (random() * 2 - 1) * 26;
      positions[i * 3 + 1] = -4 + random() * 18;
      positions[i * 3 + 2] = (random() * 2 - 1) * 24;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      map: this.glowTexture,
      color: 0x77b9c9,
      size: 0.052,
      transparent: true,
      opacity: 0.46,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      toneMapped: false,
    });
    const dust = new THREE.Points(geometry, material);
    this.scene.add(dust);
    this.dust = dust;
  }

  createCamera() {
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 90);
    this.scene.add(this.camera);
    const position = new THREE.Vector3();
    const target = new THREE.Vector3();
    const fov = sampleCameraPath(this.teaserPath, 0, position, target);
    this.camera.position.copy(position);
    this.camera.fov = fov;
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
    this.currentTarget.copy(target);
    this.cameraPosition.copy(position);
    this.cameraTarget.copy(target);
  }

  createComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.5, 0.88);
    this.gradePass = new ShaderPass(CinematicGradeShader);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.gradePass);
    this.composer.addPass(this.outputPass);
    this.composer.setPixelRatio(this.dpr);
  }

  setupUI() {
    if (this.launchButton) {
      this.launchButton.addEventListener("click", () => this.openCinema());
    }
    if (this.cinemaReplay) {
      this.cinemaReplay.addEventListener("click", () => this.replayCinema());
    }
    if (this.cinemaClose) {
      this.cinemaClose.addEventListener("click", () => this.closeCinema());
    }
    if (this.dialog) {
      this.dialog.addEventListener("close", () => this.handleDialogClose());
    }
    if (this.cinemaProgress) {
      const track = this.cinemaProgress.parentElement;
      if (track) {
        track.setAttribute("role", "progressbar");
        track.setAttribute("aria-valuemin", "0");
        track.setAttribute("aria-valuemax", "100");
        track.setAttribute("aria-valuenow", "0");
      }
    }

    this.nodeSlots.forEach((slot, index) => {
      slot.addEventListener("pointerenter", () => {
        this.hoveredNodeIndex = index;
        this.setActiveNode(index);
      });
      slot.addEventListener("pointerleave", () => {
        if (this.hoveredNodeIndex === index) this.hoveredNodeIndex = -1;
      });
      slot.addEventListener("focusin", () => {
        this.hoveredNodeIndex = index;
        this.setActiveNode(index);
      });
      slot.addEventListener("focusout", () => {
        if (this.hoveredNodeIndex === index) this.hoveredNodeIndex = -1;
      });
    });

    window.addEventListener("languagechange", () => {
      this.cinemaAct = -1;
      this.updateCinemaUI();
    });
  }

  setupEvents() {
    if ("IntersectionObserver" in window) {
      this.observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          this.heroVisible = entry.isIntersecting;
          this.coreVisual.classList.toggle("is-paused", !entry.isIntersecting);
          this.syncLoop();
        },
        { rootMargin: "140px 0px" }
      );
      this.observer.observe(this.coreVisual);
    }

    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeRaf) return;
      this.resizeRaf = requestAnimationFrame(() => {
        this.resizeRaf = 0;
        this.updateSize();
      });
    });
    this.resizeObserver.observe(this.stage);
    if (this.cinemaStage) this.resizeObserver.observe(this.cinemaStage);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stopLoop();
      } else {
        this.lastTime = performance.now();
        this.syncLoop();
      }
    });

    this.mobileQuery.addEventListener?.("change", (event) => {
      if (!event.matches && this.cinemaOpen) this.closeCinema();
      this.syncLoop();
    });

    window.addEventListener("resize", () => {
      if (this.cinemaOpen && window.innerWidth <= 760) this.closeCinema();
    });

    this.reducedMotionQuery.addEventListener?.("change", (event) => {
      if (event.matches) {
        if (this.cinemaOpen) this.closeCinema();
        this.stopLoop();
        this.coreVisual.classList.remove("is-scene-ready");
        this.coreVisual.classList.remove("is-webgl");
      } else if (this.ready) {
        this.coreVisual.classList.add("is-webgl");
        this.coreVisual.classList.add("is-scene-ready");
        this.startTeaser();
      }
    });

    this.canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.stopLoop();
      this.coreVisual.classList.remove("is-scene-ready");
      this.coreVisual.classList.remove("is-webgl");
    });
  }

  updateSize() {
    if (!this.renderer || !this.composer || !this.canvas) return;
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (width < 2 || height < 2) return;
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(this.dpr);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.gradePass.uniforms.uResolution.value.set(width * this.dpr, height * this.dpr);
    if (this.coreParticles) {
      this.coreParticles.material.uniforms.uPixelRatio.value = this.dpr;
    }
  }

  shouldRun() {
    return (
      this.ready &&
      !document.hidden &&
      this.mobileQuery.matches &&
      !this.reducedMotionQuery.matches &&
      (this.cinemaOpen || this.heroVisible)
    );
  }

  syncLoop() {
    if (this.shouldRun()) this.startLoop();
    else this.stopLoop();
  }

  startLoop() {
    if (this.running || !this.renderer) return;
    this.running = true;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this._tick);
  }

  stopLoop() {
    this.running = false;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  tick(now) {
    this.raf = 0;
    if (!this.shouldRun()) {
      this.running = false;
      return;
    }
    const rawDelta = Math.min(0.25, Math.max(0.001, (now - this.lastTime) / 1000));
    const delta = Math.min(rawDelta, 0.05);
    this.lastTime = now;
    this.elapsed += delta;
    this.update(delta, rawDelta);
    this.composer.render();
    this.updateQuality(rawDelta);
    this.raf = requestAnimationFrame(this._tick);
  }

  startTeaser() {
    if (!this.ready) return;
    this.mode = "teaser";
    this.modeTime = 0;
    this.cinemaTime = 0;
    this.cinemaDone = false;
    this.returnTransition = null;
    this.idle.time = 0;
    this.startLoop();
  }

  update(delta, rawDelta = delta) {
    if (this.mode === "teaser") {
      this.modeTime += rawDelta;
      const time = Math.min(this.modeTime, TEASER_DURATION);
      this.applyTeaserCamera(time, true);
      if (this.modeTime >= TEASER_DURATION) {
        this.idle.angle = Math.atan2(this.camera.position.x, this.camera.position.z);
        this.idle.radius = Math.max(6.2, Math.hypot(this.camera.position.x, this.camera.position.z));
        this.idle.height = this.camera.position.y;
        this.idle.time = 0;
        this.mode = "idle";
      }
    } else if (this.mode === "idle") {
      this.idle.time += delta;
      this.applyIdlePose(true);
    } else if (this.mode === "cinema") {
      if (!this.cinemaDone) {
        this.cinemaTime = Math.min(CINEMA_DURATION, this.cinemaTime + rawDelta);
        if (this.cinemaTime >= CINEMA_DURATION) this.cinemaDone = true;
        this.updateCinemaUI();
      }
      this.applyCinemaCamera(this.cinemaTime, true);
    } else if (this.mode === "return" && this.returnTransition) {
      const transition = this.returnTransition;
      transition.time += rawDelta;
      this.idle.time += delta;
      this.computeIdlePose(this.idlePosition, this.idleTargetPose);
      const t = smoothstep(0, 1, transition.time / transition.duration);
      this.cameraPosition.lerpVectors(transition.startPos, this.idlePosition, t);
      this.cameraTarget.lerpVectors(transition.startTarget, this.idleTargetPose, t);
      this.setCamera(lerp(transition.startFov, 40, t), false);
      if (transition.time >= transition.duration) {
        this.returnTransition = null;
        this.mode = "idle";
      }
    }

    this.updateNodeHighlight();
    this.updateEffects(delta);
  }

  computeIdlePose(outPosition, outTarget) {
    const time = this.idle.time;
    const angle = this.idle.angle + time * 0.045;
    outPosition.set(
      Math.sin(angle) * this.idle.radius,
      this.idle.height + Math.sin(time * 0.32) * 0.12,
      Math.cos(angle) * this.idle.radius
    );
    outTarget.set(0, 1.12 + Math.sin(time * 0.24) * 0.04, 0);
  }

  applyIdlePose(shake) {
    this.computeIdlePose(this.cameraPosition, this.cameraTarget);
    this.setCamera(40, shake);
  }

  applyTeaserCamera(time, shake) {
    const fov = sampleCameraPath(this.teaserPath, time, this.cameraPosition, this.cameraTarget);
    this.setCamera(fov, shake);
  }

  applyCinemaCamera(time, shake) {
    const fov = sampleCameraPath(this.cinemaPath, time, this.cameraPosition, this.cameraTarget);
    this.setCamera(fov, shake);
  }

  setCamera(fov, shake) {
    this.camera.position.copy(this.cameraPosition);
    if (shake) {
      const amount = this.cinemaOpen ? 0.012 : 0.006;
      const time = this.elapsed;
      this.camera.position.x += Math.sin(time * 0.63) * amount + Math.sin(time * 1.91) * amount * 0.35;
      this.camera.position.y += Math.cos(time * 0.71) * amount * 0.72;
      this.camera.position.z += Math.sin(time * 0.41) * amount * 0.5;
      this.cameraTarget.x += Math.sin(time * 0.37) * amount * 0.45;
      this.cameraTarget.y += Math.cos(time * 0.53) * amount * 0.3;
    }
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.cameraTarget);
    this.camera.rotateZ(Math.sin(this.elapsed * 0.29) * 0.008 + (this.cinemaOpen ? Math.sin(this.elapsed * 0.77) * 0.003 : 0));
    this.currentTarget.copy(this.cameraTarget);
  }

  updateNodeHighlight() {
    let desired = -1;
    if (this.mode === "teaser") {
      desired = Math.min(5, Math.floor(this.modeTime / 0.55));
    } else if (this.mode === "idle") {
      desired = Math.floor(this.idle.time / 2.2) % 6;
    }
    if (this.hoveredNodeIndex >= 0 && this.mode !== "cinema" && this.mode !== "return") {
      desired = this.hoveredNodeIndex;
    }
    if (this.mode === "cinema" || this.mode === "return") desired = -1;
    this.setActiveNode(desired);
  }

  setActiveNode(index) {
    if (index === this.activeNodeIndex) return;
    this.activeNodeIndex = index;
    this.nodeSlots.forEach((slot, slotIndex) => {
      slot.classList.toggle("is-lit", slotIndex === index);
    });
  }

  updateEffects(delta) {
    const time = this.elapsed;
    const cinemaTime = this.mode === "cinema" ? this.cinemaTime : 0;
    let energy = 0.7 + Math.sin(time * 1.4) * 0.08;
    if (this.mode === "cinema") {
      energy = 0.28 + smoothstep(0.15, 2.9, cinemaTime) * 0.82;
    }

    this.boardMaterial.emissiveIntensity = 0.32 + energy * 0.34;
    this.boardEdge.material.opacity = 0.34 + energy * 0.28;
    this.underglow.material.opacity = 0.25 + energy * 0.18;
    this.aura.material.opacity = 0.13 + energy * 0.07;
    this.socRing.rotation.y = time * 0.16;
    this.socRing.material.opacity = 0.35 + energy * 0.25;

    this.coreGroup.rotation.y = Math.sin(time * 0.2) * 0.1;
    this.coreRings.forEach((ring) => {
      ring.mesh.rotation.y = time * ring.speed;
    });
    this.tunnelRings.forEach((ring, index) => {
      ring.rotation.y = -time * (0.07 + index * 0.018);
      ring.scale.setScalar(1 + Math.sin(time * 0.9 + index) * 0.018);
    });
    const corePulse = 0.5 + 0.5 * Math.sin(time * 2.1);
    this.coreGlow.scale.setScalar(1.65 + corePulse * 0.2);
    this.coreGlow.material.opacity = 0.35 + corePulse * 0.18;
    this.coreMesh.rotation.x = time * 0.26;
    this.coreMesh.rotation.y = time * 0.4;
    this.coreMaterial.uniforms.uTime.value = time;
    this.coreWire.rotation.x = -time * 0.2;
    this.coreWire.rotation.y = -time * 0.31;
    this.coreOrbitA.rotation.z = time * 0.24;
    this.coreParticles.material.uniforms.uTime.value = time;
    this.coreParticles.rotation.y = time * 0.06;
    this.coreLight.intensity = 2.2 + corePulse * 0.9;
    this.coreInnerLight.intensity = 1.2 + corePulse * 0.7;
    this.coreBeam.material.uniforms.uOpacity.value = 0.18 + energy * 0.15;

    this.leds.forEach((led) => {
      const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(time * 2.8 + led.phase));
      led.material.color.copy(led.baseColor).multiplyScalar(0.65 + pulse * 0.7);
    });

    let focus = this.activeNodeIndex;
    if (this.mode === "cinema") {
      if (cinemaTime < 3.6) focus = Math.floor(cinemaTime / 0.5) % 6;
      else if (cinemaTime > 7.45) focus = Math.floor((cinemaTime - 7.45) / 0.55) % 6;
      else focus = -1;
    }
    this.beams.forEach((beam, index) => {
      const boost = index === focus ? 1 : 0;
      beam.material.opacity = 0.065 + boost * 0.2 + energy * 0.035;
      beam.pulses.forEach((pulse) => {
        const u = (time * 0.28 + pulse.offset) % 1;
        beam.curve.getPointAt(u, pulse.sprite.position);
        const shimmer = 0.45 + 0.55 * Math.sin(time * 4.2 + pulse.offset * 11);
        pulse.sprite.material.opacity = (0.13 + boost * 0.62) * shimmer;
        pulse.sprite.scale.setScalar(0.23 + boost * 0.2);
      });
      const marker = this.zoneMarkers[index];
      marker.glow.material.opacity = 0.18 + boost * 0.5;
      marker.ring.material.opacity = 0.28 + boost * 0.55;
    });

    let cloudOpacity = 0.22;
    if (this.mode === "cinema") {
      cloudOpacity = 0.12 + smoothstep(6.05, 8.8, cinemaTime) * 0.88;
    }
    this.setCloudOpacity(cloudOpacity);
    this.cloud.group.rotation.y = Math.sin(time * 0.07) * 0.16;
    this.cloud.nodes.forEach((node, index) => {
      const pulse = 1 + Math.sin(time * 1.35 + node.phase) * 0.07;
      node.sprite.scale.setScalar(node.baseScale * pulse);
      node.mesh.rotation.y = time * 0.3 + index;
    });
    this.cloud.ring.rotation.y = time * 0.1;
    this.cloud.haze.rotation.y = -time * 0.018;
    this.cloud.linkMaterial.opacity = cloudOpacity * 0.16;

    this.dust.rotation.y = time * 0.006;
    this.gradePass.uniforms.uTime.value = time;
    this.bloomPass.strength =
      this.mode === "cinema" && cinemaTime > 3.4 && cinemaTime < 7.2 ? 0.62 : 0.5;
    if (delta === 0) {
      this.gradePass.uniforms.uTime.value = time;
    }
  }

  setCloudOpacity(value) {
    if (!this.cloud) return;
    this.cloudOpacity = value;
    this.cloud.materials.forEach((material) => {
      const base = material.userData.baseOpacity ?? 1;
      material.opacity = base * value;
    });
    if (this.cloud.linkMaterial) {
      this.cloud.linkMaterial.opacity = value * 0.16;
    }
  }

  updateQuality(delta) {
    if (this.qualityAdjusted || this.forcedQuality || this.captureMode) return;
    this.qualitySamples.push(delta);
    if (this.qualitySamples.length < 90) return;
    const average = this.qualitySamples.reduce((sum, value) => sum + value, 0) / this.qualitySamples.length;
    this.qualitySamples.length = 0;
    this.qualityAdjusted = true;
    if (average > 1 / 42) {
      this.dpr = Math.max(1, this.dpr * 0.72);
      this.updateSize();
      this.bloomPass.strength = 0.66;
    }
  }

  updateCinemaUI() {
    if (!this.cinemaProgress) return;
    const elapsed = Math.min(this.cinemaTime, CINEMA_DURATION);
    const ratio = clamp(elapsed / CINEMA_DURATION, 0, 1);
    this.cinemaProgress.style.transform = `scaleX(${ratio.toFixed(4)})`;
    const track = this.cinemaProgress.parentElement;
    if (track) track.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
    if (this.cinemaTimeEl) {
      const label = formatClock(elapsed);
      if (this.cinemaTimeEl.textContent !== label) this.cinemaTimeEl.textContent = label;
    }
    let act = 0;
    if (elapsed >= 7) act = 2;
    else if (elapsed >= 3.6) act = 1;
    if (act !== this.cinemaAct) {
      this.cinemaAct = act;
      this.cinemaChapters.forEach((chapter, index) => {
        const active = index === act;
        chapter.classList.toggle("is-active", active);
        if (active) chapter.setAttribute("aria-current", "step");
        else chapter.removeAttribute("aria-current");
      });
      const activeChapter = this.cinemaChapters[act];
      if (this.cinemaAnnounce && activeChapter) {
        this.cinemaAnnounce.textContent = activeChapter.textContent.trim();
      }
    }
    if (this.dialog) this.dialog.classList.toggle("is-complete", this.cinemaDone);
  }

  openCinema() {
    if (!this.ready || !this.dialog || this.cinemaOpen) return;
    this.cinemaOpen = true;
    this.mode = "cinema";
    this.modeTime = 0;
    this.cinemaTime = 0;
    this.cinemaDone = false;
    this.cinemaAct = -1;
    this.returnTransition = null;
    this.hoveredNodeIndex = -1;
    this.setActiveNode(-1);
    document.documentElement.classList.add("cinema-open");
    document.body.classList.add("cinema-open");
    try {
      if (typeof this.dialog.showModal === "function") this.dialog.showModal();
      else this.dialog.setAttribute("open", "");
    } catch (error) {
      this.dialog.setAttribute("open", "");
    }
    if (this.cinemaStage) this.cinemaStage.appendChild(this.canvas);
    this.updateCinemaUI();
    this.startLoop();
    requestAnimationFrame(() => {
      this.updateSize();
      this.cinemaClose?.focus({ preventScroll: true });
    });
  }

  closeCinema() {
    if (!this.cinemaOpen || this.closing) return;
    this.closing = true;
    if (this.dialog && typeof this.dialog.close === "function" && this.dialog.open) {
      this.dialog.close();
    } else {
      if (this.dialog) this.dialog.removeAttribute("open");
      this.handleDialogClose();
    }
  }

  replayCinema() {
    if (!this.cinemaOpen) return;
    this.mode = "cinema";
    this.cinemaTime = 0;
    this.cinemaDone = false;
    this.cinemaAct = -1;
    this.updateCinemaUI();
    this.startLoop();
  }

  handleDialogClose() {
    this.closing = false;
    if (!this.cinemaOpen) return;
    this.cinemaOpen = false;
    document.documentElement.classList.remove("cinema-open");
    document.body.classList.remove("cinema-open");
    if (this.mount && this.canvas.parentElement !== this.mount) this.mount.appendChild(this.canvas);
    this.returnTransition = {
      startPos: this.camera.position.clone(),
      startTarget: this.currentTarget.clone(),
      startFov: this.camera.fov,
      time: 0,
      duration: 1.55,
    };
    this.idle.time = 0;
    this.idle.angle = 0.58;
    this.idle.radius = 7.8;
    this.idle.height = 2.5;
    this.mode = "return";
    this.updateSize();
    this.startLoop();
    requestAnimationFrame(() => {
      if (this.launchButton && document.activeElement === document.body) {
        this.launchButton.focus({ preventScroll: true });
      }
    });
  }

  renderCapture(width, height) {
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(1);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.gradePass.uniforms.uResolution.value.set(width, height);
    if (this.coreParticles) this.coreParticles.material.uniforms.uPixelRatio.value = 1;
    this.composer.render();
    return this.canvas.toDataURL("image/png");
  }

  captureStill(time, width, height) {
    const previous = {
      mode: this.mode,
      modeTime: this.modeTime,
      elapsed: this.elapsed,
      active: this.activeNodeIndex,
    };
    this.mode = "teaser";
    this.modeTime = time;
    this.elapsed = time;
    this.setActiveNode(2);
    this.applyTeaserCamera(time, false);
    this.updateEffects(0);
    const data = this.renderCapture(width, height);
    this.mode = previous.mode;
    this.modeTime = previous.modeTime;
    this.elapsed = previous.elapsed;
    this.setActiveNode(previous.active);
    this.updateSize();
    return data;
  }

  captureCinemaStill(time, width, height) {
    const previous = {
      mode: this.mode,
      modeTime: this.modeTime,
      elapsed: this.elapsed,
      active: this.activeNodeIndex,
    };
    this.mode = "cinema";
    this.modeTime = time;
    this.cinemaTime = time;
    this.elapsed = time;
    this.setActiveNode(-1);
    this.applyCinemaCamera(time, false);
    this.updateEffects(0);
    const data = this.renderCapture(width, height);
    this.mode = previous.mode;
    this.modeTime = previous.modeTime;
    this.elapsed = previous.elapsed;
    this.setActiveNode(previous.active);
    this.updateSize();
    return data;
  }
}

let heroSceneInstance = null;

export async function initHeroScene() {
  if (heroSceneInstance) return heroSceneInstance;
  const scene = new HeroScene();
  heroSceneInstance = scene;
  await scene.init();
  return scene;
}




